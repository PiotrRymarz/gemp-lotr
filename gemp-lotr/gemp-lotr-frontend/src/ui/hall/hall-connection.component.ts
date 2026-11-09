import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { HallComms } from '../../core/hall/hall-comms.service';
import {
  HALL_CONNECTION_LABELS,
  HALL_CONNECTION_STATUS,
  lastUpdateLine,
  loginLink,
  RELOAD_LINK,
} from '../../core/hall/hall-messages';

/**
 * The main bar's connection readout (hallUi.js HallConnectionIndicator): a dot and a word for the hall's connection,
 * a "Log in" link for a visitor, a live region announcing each change of state, and a popup with the state's text,
 * the last update's server time and the detail (its message and its action: reload the page or log in). The popup
 * opens on hover and on keyboard focus while there, and stays open after a click until clicked again, Escape or a
 * click elsewhere.
 *
 * DOM contract: `gd-hall-connection.gd-hall-connection` (`data-state` = connecting | connected | shutdown |
 * reconnecting | disconnected | loggedout, `data-open` while the popup shows) holding
 * `button.gd-hall-connection__readout` (`aria-expanded`, `aria-controls`) with `span.gd-hall-connection__dot` and
 * `span.gd-hall-connection__label`; `a.gd-hall-connection__login` (visitors only); `span.gd-hall-connection__live`
 * (`role=status`, to be hidden visually); `div.gd-hall-connection__popup` (`hidden` when closed) with
 * `p.gd-hall-connection__status`, `p.gd-hall-connection__updated` and, with a detail, `p.gd-hall-connection__message`
 * holding its text and `a.gd-hall-connection__action` (`data-action` = reload | login).
 */
@Component({
  selector: 'gd-hall-connection',
  host: {
    class: 'gd-hall-connection',
    '[attr.data-state]': 'connection().state',
    '[attr.data-open]': "open() ? '' : null",
    '(mouseenter)': 'show(false)',
    '(mouseleave)': 'leave()',
    '(focusin)': 'focusIn()',
    '(focusout)': 'focusOut($event)',
    '(keydown.escape)': 'escape()',
    '(document:click)': 'clickElsewhere($event)',
  },
  template: `
    <button
      type="button"
      class="gd-hall-connection__readout"
      aria-controls="gd-hall-connection-popup"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <span class="gd-hall-connection__dot" aria-hidden="true"></span
      ><span class="gd-hall-connection__label">{{ labels[connection().state] }}</span>
    </button>
    @if (connection().state === 'loggedout') {
      <a class="gd-hall-connection__login" [href]="loginUrl()">Log in</a>
    }
    <span class="gd-hall-connection__live" role="status" aria-live="polite">{{ comms.spoken() }}</span>
    <div id="gd-hall-connection-popup" class="gd-hall-connection__popup" [hidden]="!open()">
      <p class="gd-hall-connection__status">{{ statuses[connection().state] }}</p>
      @if (connection().state !== 'loggedout' || connection().lastUpdate !== null) {
        <p class="gd-hall-connection__updated">{{ updated() }}</p>
      }
      @if (connection().detail; as detail) {
        @if (detail.message || detail.action) {
          <p class="gd-hall-connection__message">
            @if (detail.message) {
              <span>{{ detail.message }}</span
              >&ngsp;
            }
            @if (detail.action === 'reload') {
              <a class="gd-hall-connection__action" data-action="reload" [href]="here()" (click)="reload($event)">{{
                reloadText
              }}</a>
            } @else if (detail.action === 'login') {
              <a class="gd-hall-connection__action" data-action="login" [href]="loginUrl()">{{
                loginText(connection().state)
              }}</a>
            }
          </p>
        }
      }
    </div>
  `,
})
export class HallConnectionComponent {
  /** The login page, coming back to the hall link shown. */
  readonly loginUrl = input('/gemp-lotr/');

  protected readonly comms = inject(HallComms);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly page = inject(DOCUMENT);

  protected readonly labels = HALL_CONNECTION_LABELS;
  protected readonly statuses = HALL_CONNECTION_STATUS;
  protected readonly reloadText = RELOAD_LINK;
  protected readonly loginText = loginLink;
  protected readonly connection = this.comms.connection;
  protected readonly updated = computed(() => lastUpdateLine(this.connection().lastUpdate));

  protected readonly open = signal(false);
  /** Opened by a click: stays open when the pointer or the focus leaves. */
  private readonly pinned = signal(false);

  protected here(): string {
    return this.page.defaultView?.location.href ?? '';
  }

  protected show(pin: boolean): void {
    this.pinned.update((pinned) => pinned || pin);
    this.open.set(true);
  }

  protected close(): void {
    this.pinned.set(false);
    this.open.set(false);
  }

  protected toggle(): void {
    if (this.pinned()) {
      this.close();
    } else {
      this.show(true);
    }
  }

  protected leave(): void {
    if (!this.pinned() && !this.keyboardFocusInside()) {
      this.close();
    }
  }

  /** Keyboard users get the hover's popup while the readout has focus (a click is handled by toggle). */
  protected focusIn(): void {
    if (this.keyboardFocusInside()) {
      this.show(false);
    }
  }

  protected focusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!this.pinned() && !(next && this.host.contains(next))) {
      this.close();
    }
  }

  protected escape(): void {
    if (this.open()) {
      this.close();
      this.host.querySelector<HTMLElement>('.gd-hall-connection__readout')?.focus();
    }
  }

  protected clickElsewhere(event: Event): void {
    if (this.pinned() && !this.host.contains(event.target as Node)) {
      this.close();
    }
  }

  protected reload(event: Event): void {
    event.preventDefault();
    this.page.defaultView?.location.reload();
  }

  private keyboardFocusInside(): boolean {
    const active = this.page.activeElement;
    if (!active || !this.host.contains(active)) {
      return false;
    }
    try {
      return active.matches(':focus-visible');
    } catch {
      return true;
    }
  }
}
