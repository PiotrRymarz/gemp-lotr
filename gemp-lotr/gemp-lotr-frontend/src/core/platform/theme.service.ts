import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { readCookie, writeCookie } from './cookies';
import { PAGE_QUERY_STRING } from './page-location';

/**
 * The themes. Each is a base stylesheet bundle (angular.json, `theme-<name>.css`, from src/themes/<name>/base.css) plus
 * one bundle per page (`theme-<name>-<page>.css`, from src/themes/<name>/<page>.css).
 */
export const THEMES = ['classic', 'modern'] as const;
export type ThemeName = (typeof THEMES)[number];

/** The pages with theme CSS of their own: a route names its page in `data: { page }` (app.routes.ts). */
export const THEME_PAGES = ['deckbuilder'] as const;
export type ThemePage = (typeof THEME_PAGES)[number];

/** Shown in the theme picker. */
export const THEME_LABELS: Readonly<Record<ThemeName, string>> = { classic: 'Classic', modern: 'Modern' };

/** Computers get the legacy look. */
export const DEFAULT_THEME: ThemeName = 'classic';
/** Phones and tablets (see isMobileDevice). */
export const MOBILE_THEME: ThemeName = 'modern';

/** Remembers the player's choice on this device (path /gemp-lotr, like the legacy settings cookies). */
export const THEME_COOKIE = 'gempTheme';
/** The cookie's earlier name (the deck builder's own), read when THEME_COOKIE is absent. */
export const LEGACY_THEME_COOKIE = 'deckbuilderTheme';

/** Set on <html>, so a theme's CSS can tell which theme is active if it needs to. */
export const THEME_ATTRIBUTE = 'data-theme';
/** Marks the theme's <link>s (and only them), with their bundle's name (`classic`, `classic-deckbuilder`, ...). */
export const THEME_LINK_ATTRIBUTE = 'data-theme-stylesheet';

/**
 * The page's `<meta name="viewport">` per theme. The classic theme keeps the legacy page's default (none: phones lay it
 * out 980px wide and zoom out); the modern theme is laid out at the device's width, edge to edge (`viewport-fit=cover`,
 * so its CSS can keep clear of notches with the safe-area insets).
 */
export const THEME_VIEWPORTS: Readonly<Record<ThemeName, string | null>> = {
  classic: null,
  modern: 'width=device-width, initial-scale=1, viewport-fit=cover',
};
/** Marks the viewport <meta> the service added, so it only ever removes its own. */
export const THEME_VIEWPORT_ATTRIBUTE = 'data-theme-viewport';

/** How long the first paint (or a page) waits for a theme stylesheet before showing anyway. */
export const THEME_LOAD_TIMEOUT_MS = 10_000;

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function isThemePage(value: unknown): value is ThemePage {
  return typeof value === 'string' && (THEME_PAGES as readonly string[]).includes(value);
}

/** The bundles (and so the <link>s) of a theme on a page: the theme's base, then the page's own, which wins over it. */
export function themeBundles(theme: ThemeName, page: ThemePage | null): string[] {
  return page ? [theme, `${theme}-${page}`] : [theme];
}

/**
 * A phone or tablet: a touch screen as the main input, and no side longer than a small laptop's. The same rule as
 * the legacy mobile pages (js/gemp-022/mobileView.js, GempView.isMobileDevice).
 */
export function isMobileDevice(window: Window | null): boolean {
  if (!window) {
    return false;
  }
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
  return coarse && shortSide < 1100;
}

/** The theme to use: the address (?theme=), then the remembered choice, then the device. Unknown names are ignored. */
export function resolveTheme(fromQuery: string | null, fromCookie: string | null, mobile: boolean): ThemeName {
  if (isThemeName(fromQuery)) {
    return fromQuery;
  }
  if (isThemeName(fromCookie)) {
    return fromCookie;
  }
  return mobile ? MOBILE_THEME : DEFAULT_THEME;
}

/**
 * Chooses the theme and keeps exactly its stylesheets for the current page linked: the theme's base and the page's
 * own. `init()` runs before the app starts (an app initializer), so nothing is drawn before the base has loaded;
 * the router waits for `loadPage()` before it shows a page (ui/app/theme-pages.ts), and `setPage()` drops the
 * previous page's stylesheet once the page is shown. `select()` switches theme at runtime. New stylesheets always load
 * next to the old ones, which are removed only then, so the page never shows unstyled. Only the CSS changes: the
 * app's state (the deck being edited, the collection page) stays as it is.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly queryString = inject(PAGE_QUERY_STRING);
  private readonly current = signal<ThemeName>(DEFAULT_THEME);
  /** The theme and page asked for last (the theme is shown once its stylesheets have loaded). */
  private target: ThemeName = DEFAULT_THEME;
  private page: ThemePage | null = null;
  /** The latest theme or page change, so an earlier one that finishes loading later doesn't win. */
  private requested: object | null = null;
  /** Each link's first load (or error, or timeout), so a link already loaded isn't waited for again. */
  private readonly loading = new WeakMap<HTMLLinkElement, Promise<void>>();

  readonly theme = this.current.asReadonly();

  /** Resolves the theme and waits for its base stylesheet. A `?theme=` in the address is remembered, as a choice. */
  init(): Promise<void> {
    const fromQuery = new URLSearchParams(this.queryString).get('theme');
    if (isThemeName(fromQuery)) {
      this.remember(fromQuery);
    }
    const cookies = this.document.cookie;
    const fromCookie = readCookie(cookies, THEME_COOKIE) ?? readCookie(cookies, LEGACY_THEME_COOKIE);
    const theme = resolveTheme(fromQuery, fromCookie, this.mobileDevice());
    return this.apply(theme, this.page);
  }

  /** The player's choice: remembered, and applied once its stylesheets have loaded. Unknown names are ignored. */
  async select(theme: string): Promise<void> {
    if (!isThemeName(theme)) {
      return;
    }
    this.remember(theme);
    await this.apply(theme, this.page);
  }

  /**
   * Loads the current theme's stylesheet for a page about to be shown, keeping the current ones (the page on screen
   * still needs them). A page without theme CSS of its own (null, or an unknown name) needs only the base.
   */
  async loadPage(page: string | null): Promise<void> {
    const bundles = themeBundles(this.target, isThemePage(page) ? page : null);
    await Promise.all(this.link(bundles).map((link) => this.whenLoaded(link)));
  }

  /** The page now shown: its stylesheets are kept (and loaded if missing), any other page's are removed. */
  setPage(page: string | null): Promise<void> {
    return this.apply(this.target, isThemePage(page) ? page : null, false);
  }

  private async apply(theme: ThemeName, page: ThemePage | null, show = true): Promise<void> {
    const request = {};
    this.requested = request;
    this.target = theme;
    this.page = page;
    const wanted = this.link(themeBundles(theme, page));
    await Promise.all(wanted.map((link) => this.whenLoaded(link)));
    if (this.requested !== request) {
      // A later change replaced this one while it loaded; it removes what it doesn't need
      return;
    }
    for (const old of this.themeLinks()) {
      if (!wanted.includes(old)) {
        old.remove();
      }
    }
    if (show || theme !== this.current()) {
      this.show(theme);
    }
  }

  /**
   * The <link>s of these bundles, in order: the ones already on the page, and new ones added after the existing
   * theme links (so they win over them while both are present). A theme's base goes before its pages' links.
   */
  private link(bundles: string[]): HTMLLinkElement[] {
    return bundles.map((bundle) => {
      const links = this.themeLinks();
      const existing = links.find((link) => link.getAttribute(THEME_LINK_ATTRIBUTE) === bundle);
      if (existing) {
        return existing;
      }
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = this.stylesheetUrl(bundle);
      link.setAttribute(THEME_LINK_ATTRIBUTE, bundle);
      this.loading.set(link, this.loaded(link));
      const ownPage = isThemeName(bundle)
        ? links.find((other) => other.getAttribute(THEME_LINK_ATTRIBUTE)!.startsWith(`${bundle}-`))
        : undefined;
      if (ownPage) {
        ownPage.before(link);
      } else if (links.length > 0) {
        links[links.length - 1].after(link);
      } else {
        this.document.head.appendChild(link);
      }
      return link;
    });
  }

  private themeLinks(): HTMLLinkElement[] {
    return Array.from(this.document.head.querySelectorAll<HTMLLinkElement>(`link[${THEME_LINK_ATTRIBUTE}]`));
  }

  private show(theme: ThemeName): void {
    this.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
    this.setViewport(THEME_VIEWPORTS[theme]);
    this.current.set(theme);
  }

  private setViewport(content: string | null): void {
    const head = this.document.head;
    let meta = head.querySelector<HTMLMetaElement>(`meta[${THEME_VIEWPORT_ATTRIBUTE}]`);
    if (content === null) {
      meta?.remove();
      return;
    }
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.name = 'viewport';
      meta.setAttribute(THEME_VIEWPORT_ATTRIBUTE, '');
      head.appendChild(meta);
    }
    meta.content = content;
  }

  /** Next to the app's other files, whatever the address it is served under (`<base href>`). */
  private stylesheetUrl(bundle: string): string {
    return new URL(`theme-${bundle}.css`, this.document.baseURI).href;
  }

  private whenLoaded(link: HTMLLinkElement): Promise<void> {
    return this.loading.get(link) ?? Promise.resolve();
  }

  /** Resolves on load, on error (the page then shows without the theme rather than not at all) or on timeout. */
  private loaded(link: HTMLLinkElement): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, THEME_LOAD_TIMEOUT_MS);
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', done, { once: true });
    });
  }

  private remember(theme: ThemeName): void {
    writeCookie(this.document, THEME_COOKIE, theme);
  }

  private mobileDevice(): boolean {
    return isMobileDevice(this.document.defaultView);
  }
}
