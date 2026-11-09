import { existsSync, readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { THEME_LINK_ATTRIBUTE, THEME_PAGES, THEMES, ThemeService } from '../../core/platform/theme.service';
import { Component } from '@angular/core';
import { APP_ROUTES } from './app.routes';
import { loadThemePage, provideThemePages } from './theme-pages';

interface StyleEntry {
  input: string;
  bundleName: string;
  inject?: boolean;
}

const angularJson = JSON.parse(readFileSync('angular.json', 'utf8'));
const styles: StyleEntry[] = Object.values<{ architect: { build: { options: { styles: StyleEntry[] } } } }>(
  angularJson.projects,
)[0].architect.build.options.styles;

function allRoutes(routes: Routes): Route[] {
  return routes.flatMap((route) => [route, ...allRoutes(route.children ?? [])]);
}

const pageRoutes = allRoutes(APP_ROUTES).filter((route) => route.data?.['page'] !== undefined);

describe('theme CSS per page', () => {
  it('has the page routes to check (the deck builder, the login page, the merchant, the solo draft, the table draft, the hall)', () => {
    expect(pageRoutes.map((route) => route.data!['page'])).toEqual(
      expect.arrayContaining(['deckbuilder', 'login', 'merchant', 'solo-draft', 'table-draft', 'hall']),
    );
  });

  it.each(THEMES)('builds the %s base bundle, linked at runtime only', (theme) => {
    expect(styles).toContainEqual({
      input: `src/themes/${theme}/base.css`,
      bundleName: `theme-${theme}`,
      inject: false,
    });
    expect(existsSync(`src/themes/${theme}/base.css`)).toBe(true);
  });

  it('builds every theme bundle with inject: false', () => {
    expect(styles.every((entry) => entry.inject === false)).toBe(true);
  });

  for (const route of pageRoutes) {
    const page = route.data!['page'] as string;
    describe(`the ${route.path} route (page ${page})`, () => {
      it('is a page ThemeService knows', () => {
        expect(THEME_PAGES).toContain(page);
      });

      it.each(THEMES)('has a page bundle in the %s theme', (theme) => {
        const entry = styles.find((style) => style.bundleName === `theme-${theme}-${page}`);
        expect(entry).toEqual({
          input: `src/themes/${theme}/${page}.css`,
          bundleName: `theme-${theme}-${page}`,
          inject: false,
        });
        expect(existsSync(entry!.input)).toBe(true);
      });

      it('waits for its theme CSS before it is shown', () => {
        expect(Object.values(route.resolve ?? {})).toContain(loadThemePage);
      });
    });
  }
});

@Component({ template: 'deck builder' })
class DeckbuilderStub {}

@Component({ template: 'other' })
class OtherStub {}

describe('loadThemePage and provideThemePages', () => {
  const linked = () =>
    Array.from(document.head.querySelectorAll(`link[${THEME_LINK_ATTRIBUTE}]`)).map((link) =>
      link.getAttribute(THEME_LINK_ATTRIBUTE),
    );
  const loadLink = (bundle: string) =>
    document.head.querySelector(`link[${THEME_LINK_ATTRIBUTE}="${bundle}"]`)!.dispatchEvent(new Event('load'));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'deckbuilder',
            component: DeckbuilderStub,
            data: { page: 'deckbuilder' },
            resolve: { t: loadThemePage },
          },
          { path: 'other', component: OtherStub, resolve: { t: loadThemePage } },
        ]),
        provideThemePages(),
        { provide: PAGE_QUERY_STRING, useValue: '?theme=classic' },
      ],
    });
    const starting = TestBed.inject(ThemeService).init();
    loadLink('classic');
    await starting;
  });

  afterEach(() => document.head.querySelectorAll(`link[${THEME_LINK_ATTRIBUTE}]`).forEach((link) => link.remove()));

  it("shows a page only once its theme stylesheet has loaded, then drops it on a page that hasn't one", async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    let shown = false;
    const navigating = harness.navigateByUrl('/deckbuilder').then(() => (shown = true));
    await new Promise((resolve) => setTimeout(resolve));
    expect(linked()).toEqual(['classic', 'classic-deckbuilder']);
    expect(shown).toBe(false);
    expect(router.url).not.toBe('/deckbuilder');
    loadLink('classic-deckbuilder');
    await navigating;
    expect(harness.routeNativeElement?.textContent).toBe('deck builder');

    await harness.navigateByUrl('/other');
    await new Promise((resolve) => setTimeout(resolve));
    expect(harness.routeNativeElement?.textContent).toBe('other');
    expect(linked()).toEqual(['classic']);
  });
});
