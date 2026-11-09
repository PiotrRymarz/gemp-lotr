import { Location } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { ChatService } from '../../core/chat/chat.service';
import { parseServerMarkup } from '../../core/chat/chat-markup';
import { HallComms } from '../../core/hall/hall-comms.service';
import { LOGIN_REQUIRED, LOGIN_REQUIRED_TITLE } from '../../core/hall/hall-messages';
import { HallSession } from '../../core/hall/hall-session.service';
import {
  DEFAULT_HALL_TAB,
  findHallTab,
  HALL_TAB_STORAGE_KEY,
  HallTab,
  visibleHallTabs,
} from '../../core/hall/hall-tabs';
import { LocalSettings } from '../../core/platform/local-settings.service';
import { PAGE_HASH } from '../../core/platform/page-location';
import { PlayerService } from '../../core/session/player.service';
import { ChatComponent } from '../shared/chat/chat.component';
import { MarkupComponent } from '../shared/chat/markup.component';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { HallConnectionComponent } from './hall-connection.component';
import { DECKBUILDER_HREF, HALL_DISCLAIMER, HALL_INFO_LINKS, hallLoginUrl } from './hall-links';
import { HallPlaceholderComponent } from './hall-placeholder.component';

/** Arrow keys on the chat's resize bar change its height by this much (px; hallUi.js HallChatResizer). */
export const CHAT_RESIZE_STEP = 20;
/** localStorage key of the chat's height (px) as last resized. */
export const CHAT_HEIGHT_KEY = 'gemp.hall.chatHeight';

/** The tab a link's #fragment names ("#help/formats" → Help), or null. */
function tabOfHash(hash: string): HallTab | null {
  const slug = hash.replace(/^#/, '').split('/')[0];
  return slug ? findHallTab(slug) : null;
}

/**
 * The Game Hall (hall.html): the tabs, each tab's panel, the main bar, the chat and the disclaimer. The Game Hall
 * tab's panel starts with the link buttons and the message of the day; the tabs' content comes with the later parts
 * of the hall (a placeholder each until then: tables 4.2, Help and Server Info 4.3, Events and My Account 4.4, Admin
 * 4.5). The main bar holds the connection readout, the Deck-builder link and Play, and the server clock. The tab
 * opened is the link's #fragment's, else the one last opened, else the Game Hall; choosing a tab writes its link into
 * the address bar. Opening the hall (or later a tab that needs logging in) starts the hall's poll and chat
 * (HallSession); leaving the page stops them, and coming back starts them afresh. The chat's resize bar sets
 * its height (dragging it or with Up and Down); the page records the height asked for, the theme keeps it within its
 * limits.
 *
 * DOM contract: `.gd-hall` (`data-tab` = the tab shown, `data-chat` = builtin | discord, `--gd-chat-height` in px once
 * resized) holding `div.gd-hall__tabs` (`role=tablist`) with a `button.gd-hall__tab` per tab shown (`role=tab`,
 * `data-tab`, `aria-selected`, `aria-controls`); a `section.gd-hall__panel` per tab (`role=tabpanel`, `data-tab`,
 * `hidden` unless shown): the Game Hall's holds `div.gd-hall__info` (`nav.gd-hall__links` of `a.gd-hall__link`
 * (`data-link`, the label in a `span.gd-hall__link-label`, struck through with `s`), `p.gd-hall__motd` with
 * `b.gd-hall__motd-label` "MOTD:" and `gd-markup` when there is one, empty otherwise) and then the tab's
 * `gd-hall-placeholder`, every other panel its `gd-hall-placeholder`. Then `div.gd-hall__bar` with
 * `gd-hall-connection`, `div.gd-hall__actions` (`a.gd-hall__action[data-action=deckbuilder]`,
 * `button.gd-hall__action[data-action=play]`, each with a `span.gd-hall__action-label`) and `p.gd-hall__clock` (the
 * date and the time on two lines, empty before the first update); `div.gd-hall__resizer` (`role=separator`,
 * `data-dragging` while dragged); `gd-chat`; `p.gd-hall__disclaimer`; and `gd-dialog[data-dialog=login-required]`.
 */
@Component({
  selector: 'gd-hall-page',
  imports: [ChatComponent, MarkupComponent, DialogComponent, HallConnectionComponent, HallPlaceholderComponent],
  host: {
    class: 'gd-hall',
    '[attr.data-tab]': 'shown().slug',
    '[attr.data-chat]': "chat.discord() ? 'discord' : 'builtin'",
    '[style.--gd-chat-height]': "chatHeight() === null ? null : chatHeight() + 'px'",
  },
  template: `
    <div class="gd-hall__tabs" role="tablist" aria-label="Game Hall">
      @for (tab of tabs(); track tab.slug) {
        <button
          type="button"
          role="tab"
          class="gd-hall__tab"
          [id]="'gd-hall-tab-' + tab.slug"
          [attr.data-tab]="tab.slug"
          [attr.aria-controls]="'gd-hall-panel-' + tab.slug"
          [attr.aria-selected]="tab.slug === shown().slug"
          [attr.tabindex]="tab.slug === shown().slug ? 0 : -1"
          (click)="select(tab)"
          (keydown)="tabKey($event)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
    @for (tab of tabs(); track tab.slug) {
      <section
        class="gd-hall__panel"
        role="tabpanel"
        [id]="'gd-hall-panel-' + tab.slug"
        [attr.data-tab]="tab.slug"
        [attr.aria-labelledby]="'gd-hall-tab-' + tab.slug"
        [hidden]="tab.slug !== shown().slug"
      >
        @if (tab.slug === 'game-hall') {
          <div class="gd-hall__info">
            <nav class="gd-hall__links" aria-label="Links">
              @for (link of links; track link.link) {
                <a class="gd-hall__link" [attr.data-link]="link.link" [href]="link.href" target="_blank">
                  @if (link.struck) {
                    <span class="gd-hall__link-label"
                      ><s>{{ link.label }}</s></span
                    >
                  } @else {
                    <span class="gd-hall__link-label">{{ link.label }}</span>
                  }
                </a>
              }
            </nav>
            <p class="gd-hall__motd">
              @if (motd(); as motd) {
                <b class="gd-hall__motd-label">MOTD:</b>&ngsp;<gd-markup [nodes]="motd" />
              }
            </p>
          </div>
        }
        <gd-hall-placeholder [tab]="tab" />
      </section>
    }
    <div class="gd-hall__bar">
      <gd-hall-connection [loginUrl]="loginUrl()" />
      <div class="gd-hall__actions">
        <a class="gd-hall__action" data-action="deckbuilder" [href]="deckbuilder" target="_blank"
          ><span class="gd-hall__action-label">Deck-builder</span></a
        >
        <button type="button" class="gd-hall__action" data-action="play" (click)="play()">
          <span class="gd-hall__action-label">Play</span>
        </button>
      </div>
      <p class="gd-hall__clock" aria-label="Server time">
        @if (clock(); as clock) {
          {{ clock.date }}<br />{{ clock.time }}
        }
      </p>
    </div>
    <div
      class="gd-hall__resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the chat"
      tabindex="0"
      [attr.data-dragging]="dragging() ? '' : null"
      (pointerdown)="startResize($event)"
      (keydown)="resizeWithKeys($event)"
    ></div>
    <gd-chat
      label="Game Hall chat"
      [lines]="chat.lines()"
      [users]="chat.users()"
      [ignored]="chat.ignored()"
      [status]="chat.userListStatus()"
      [canSend]="chat.canSend()"
      [stopped]="chat.stopped()"
      [loggedOut]="chat.loggedOut()"
      [discord]="chat.discord()"
      [userName]="player.player()?.name ?? null"
      [loginUrl]="loginUrl()"
      (send)="chat.send($event)"
      (ignoreToggle)="chat.toggleIgnore($event)"
      (incognitoChange)="chat.setIncognito($event)"
      (discordChange)="chat.setDiscord($event)"
    />
    <p class="gd-hall__disclaimer">{{ disclaimer }}</p>
    <gd-dialog
      name="login-required"
      [heading]="loginRequiredTitle"
      [open]="session.loginRequired()"
      (closed)="session.dismissLoginRequired()"
    >
      <p class="gd-hall__login-required">{{ loginRequired }}</p>
      <div class="gd-dialog__actions" gdDialogActions>
        <a class="gd-button" data-action="login" [href]="loginUrl()">Register or log in</a>
        <button type="button" class="gd-button" data-action="close" (click)="session.dismissLoginRequired()">
          Close
        </button>
      </div>
    </gd-dialog>
  `,
})
export class HallPageComponent {
  protected readonly chat = inject(ChatService);
  protected readonly comms = inject(HallComms);
  protected readonly session = inject(HallSession);
  protected readonly player = inject(PlayerService);
  private readonly settings = inject(LocalSettings);
  private readonly location = inject(Location);

  protected readonly links = HALL_INFO_LINKS;
  protected readonly deckbuilder = DECKBUILDER_HREF;
  protected readonly disclaimer = HALL_DISCLAIMER;
  protected readonly loginRequiredTitle = LOGIN_REQUIRED_TITLE;
  protected readonly loginRequired = LOGIN_REQUIRED;

  protected readonly tabs = computed(() => visibleHallTabs(this.session.adminTabShown()));
  /** The tab chosen (it may wait for the Admin tab to show, once the player is known). */
  private readonly active = signal<HallTab>(this.initialTab());
  /** The tab shown: the one chosen, or the Game Hall while that one isn't shown. */
  protected readonly shown = computed(() => {
    const active = this.active();
    return this.tabs().find((tab) => tab.slug === active.slug) ?? findHallTab(DEFAULT_HALL_TAB)!;
  });
  protected readonly loginUrl = computed(() => hallLoginUrl(`#${this.shown().slug}`));

  protected readonly motd = computed(() => {
    const motd = this.comms.motd();
    return motd ? parseServerMarkup(motd) : null;
  });
  /** The server clock, its date over its time. */
  protected readonly clock = computed(() => {
    const time = this.comms.serverTime();
    if (!time) {
      return null;
    }
    const [date, clock] = time.split(' ');
    return { date, time: clock ?? '' };
  });

  /** The chat's height as last resized, or null for the theme's default. */
  protected readonly chatHeight = signal<number | null>(this.savedChatHeight());
  protected readonly dragging = signal(false);

  constructor() {
    void this.session.begin(this.active().login);
    // The hall's services belong to the route, whose injector outlives the page: leaving it stops the poll and chat
    inject(DestroyRef).onDestroy(() => this.session.stop());
    // The poll found the viewer not logged in: on a tab that needs logging in, the "Not logged in" dialog says so
    effect(() => {
      if (this.session.started() && this.comms.connection().state === 'loggedout') {
        untracked(() => this.session.requireLogin(this.shown().login));
      }
    });
  }

  protected select(tab: HallTab): void {
    this.active.set(tab);
    this.settings.write(HALL_TAB_STORAGE_KEY, tab.slug);
    this.location.replaceState(this.location.path(false) + '#' + tab.slug);
    if (tab.login) {
      this.session.loginTabOpened();
    }
  }

  /** Left and Right (Home, End) choose the tab next to the focused one, as in a tab list. */
  protected tabKey(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const at = tabs.findIndex((tab) => tab.slug === (event.currentTarget as HTMLElement).dataset['tab']);
    const next =
      event.key === 'ArrowRight'
        ? (at + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (at - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) {
      return;
    }
    event.preventDefault();
    this.select(tabs[next]);
    const list = (event.currentTarget as HTMLElement).parentElement;
    list?.querySelector<HTMLElement>(`[data-tab="${tabs[next].slug}"]`)?.focus();
  }

  /** Play: the table popup comes with the tables (4.2); a visitor is asked to log in. */
  protected play(): void {
    if (this.session.loggedOut()) {
      this.session.requireLogin();
    }
  }

  /** Dragging the resize bar: the chat's top edge follows the pointer. */
  protected startResize(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const bar = event.currentTarget as HTMLElement;
    const chat = bar.parentElement?.querySelector<HTMLElement>('gd-chat');
    if (!chat) {
      return;
    }
    bar.setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
    const bottom = chat.getBoundingClientRect().bottom;
    const move = (e: PointerEvent) => this.chatHeight.set(Math.round(bottom - e.clientY));
    const stop = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', stop);
      bar.removeEventListener('pointercancel', stop);
      this.dragging.set(false);
      // Keep what the theme allowed, so the next drag or key press starts from what is shown
      this.chatHeight.set(Math.round(chat.getBoundingClientRect().height));
      this.saveChatHeight();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
  }

  /** Up makes the chat taller, Down shorter. */
  protected resizeWithKeys(event: KeyboardEvent): void {
    const step = event.key === 'ArrowUp' ? CHAT_RESIZE_STEP : event.key === 'ArrowDown' ? -CHAT_RESIZE_STEP : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    const chat = (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('gd-chat');
    const current = this.chatHeight() ?? chat?.getBoundingClientRect().height ?? 0;
    this.chatHeight.set(Math.round(current + step));
    this.saveChatHeight();
  }

  private initialTab(): HallTab {
    const stored = this.settings.read(HALL_TAB_STORAGE_KEY);
    return (
      tabOfHash(inject(PAGE_HASH)) ??
      (stored ? (findHallTab(stored) ?? tabOfHash(stored)) : null) ??
      findHallTab(DEFAULT_HALL_TAB)!
    );
  }

  private savedChatHeight(): number | null {
    const saved = Number(this.settings.read(CHAT_HEIGHT_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  }

  private saveChatHeight(): void {
    const height = this.chatHeight();
    if (height !== null) {
      this.settings.write(CHAT_HEIGHT_KEY, String(height));
    }
  }
}
