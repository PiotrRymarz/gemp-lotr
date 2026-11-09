import { Component, computed, inject, signal } from '@angular/core';
import { GENERIC_COMMUNICATION_ERROR } from '../../core/api/api-error';
import { SoloDraftService, SoloDraftStatus } from '../../core/solo-draft/solo-draft.service';
import { DraftPicksComponent } from '../draft/draft-picks.component';
import { DraftedPoolComponent } from '../draft/drafted-pool.component';
import { CardInfoComponent } from '../shared/card-info/card-info.component';

/** Arrow keys on the separator move it by this much (px). */
export const RESIZE_STEP = 10;

/** The pane a theme that shows one pane at a time (phones) shows: the tab bar's choice. */
export type SoloDraftPane = 'picks' | 'drafted';

/** The page's `data-state` for each SoloDraftService status. */
const STATES: Record<SoloDraftStatus, string> = {
  loading: 'loading',
  picking: 'picking',
  finished: 'finished',
  failed: 'error',
  noEvent: 'no-event',
};

/**
 * The solo draft page (soloDraft.html): the picks on offer above, under the line that says what to do ("Make a
 * pick", "Draft is finished", or why there is no draft), then the separator, then the cards drafted so far; and the
 * card information. Loads the draft when shown. The separator resizes the picks (dragging it or with the arrow keys)
 * and closes or opens them with its toggle, as the legacy layout's resizer did; the page only records the height
 * asked for, the theme keeps it within its limits.
 *
 * DOM contract: `.gd-solo-draft` with `data-state` (loading, picking, finished, error, no-event), `data-busy` while a
 * pick is under way, `data-picks` (open, closed), `data-pane` (picks, drafted: the tab bar's choice, for themes that
 * show one pane at a time) and `--gd-picks-height` (px, once resized); holding `section.gd-solo-draft__picks` with
 * `p.gd-solo-draft__message` (`role=status`), `.gd-solo-draft__error` (`role=alert`, only in the error state, with
 * `button.gd-solo-draft__retry`) and `gd-draft-picks`; `div.gd-solo-draft__separator` (`role=separator`,
 * `data-dragging` while dragged) holding `button.gd-solo-draft__toggle` (`aria-expanded`);
 * `section.gd-solo-draft__drafted` with `h2.gd-solo-draft__heading` (its `.gd-solo-draft__count`) and
 * `gd-drafted-pool`; `div.gd-page__tabs` (`role=tablist`) with a `button.gd-page__tab` (`role=tab`, `data-pane`,
 * `aria-selected`) per pane; then `gd-card-info`.
 */
@Component({
  selector: 'gd-solo-draft-page',
  imports: [DraftPicksComponent, DraftedPoolComponent, CardInfoComponent],
  host: {
    class: 'gd-solo-draft',
    '[attr.data-state]': 'state()',
    '[attr.data-busy]': "draft.picking() ? '' : null",
    '[attr.data-picks]': "picksOpen() ? 'open' : 'closed'",
    '[attr.data-pane]': 'pane()',
    '[attr.aria-busy]': "draft.status() === 'loading' || draft.picking()",
    '[style.--gd-picks-height]': "picksHeight() === null ? null : picksHeight() + 'px'",
  },
  template: `
    <section class="gd-solo-draft__picks" id="gd-pane-picks" aria-label="Picks" [hidden]="!picksOpen()">
      <p class="gd-solo-draft__message" role="status">{{ draft.message() }}</p>
      @if (draft.status() === 'failed') {
        <div class="gd-solo-draft__error" role="alert">
          <p class="gd-solo-draft__error-text">{{ errorText }}</p>
          <button type="button" class="gd-button gd-solo-draft__retry" (click)="retry()">Try again</button>
        </div>
      }
      <gd-draft-picks [choices]="draft.choices()" />
    </section>
    <div
      class="gd-solo-draft__separator"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the picks"
      tabindex="0"
      [attr.data-dragging]="dragging() ? '' : null"
      (pointerdown)="startResize($event)"
      (keydown)="resizeWithKeys($event)"
    >
      <button
        type="button"
        class="gd-solo-draft__toggle"
        [attr.aria-expanded]="picksOpen()"
        [attr.aria-label]="picksOpen() ? 'Close the picks' : 'Open the picks'"
        [title]="picksOpen() ? 'Close' : 'Open'"
        (click)="togglePicks()"
      ></button>
    </div>
    <section class="gd-solo-draft__drafted" id="gd-pane-drafted" aria-labelledby="gd-solo-draft-heading">
      <h2 class="gd-solo-draft__heading" id="gd-solo-draft-heading">
        Drafted cards <span class="gd-solo-draft__count">{{ draft.draftedCount() }}</span>
      </h2>
      <gd-drafted-pool [copies]="draft.draftedCopies()" />
    </section>
    <div class="gd-page__tabs" role="tablist" aria-label="Show">
      @for (tab of tabs; track tab.pane) {
        <button
          type="button"
          role="tab"
          class="gd-page__tab"
          [attr.data-pane]="tab.pane"
          [attr.aria-controls]="'gd-pane-' + tab.pane"
          [attr.aria-selected]="pane() === tab.pane"
          (click)="showPane(tab.pane)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
    <gd-card-info />
  `,
})
export class SoloDraftPageComponent {
  protected readonly draft = inject(SoloDraftService);
  protected readonly errorText = GENERIC_COMMUNICATION_ERROR;
  protected readonly tabs: readonly { pane: SoloDraftPane; label: string }[] = [
    { pane: 'picks', label: 'Picks' },
    { pane: 'drafted', label: 'Drafted' },
  ];

  protected readonly state = computed(() => STATES[this.draft.status()]);
  /** The pane chosen in the tab bar, for themes that show one pane at a time. */
  protected readonly pane = signal<SoloDraftPane>('picks');
  protected readonly picksOpen = signal(true);
  /** The picks' height as last dragged to, or null for the theme's default. */
  protected readonly picksHeight = signal<number | null>(null);
  protected readonly dragging = signal(false);

  constructor() {
    void this.draft.load();
  }

  protected retry(): void {
    void this.draft.load();
  }

  /** Choosing the picks' tab also opens them, in case the separator closed them. */
  protected showPane(pane: SoloDraftPane): void {
    this.pane.set(pane);
    if (pane === 'picks') {
      this.picksOpen.set(true);
    }
  }

  protected togglePicks(): void {
    this.picksOpen.update((open) => !open);
  }

  /** Dragging the separator: the picks' bottom edge follows the pointer. */
  protected startResize(event: PointerEvent): void {
    if (!this.picksOpen() || event.button !== 0 || (event.target as Element).closest('.gd-solo-draft__toggle')) {
      return;
    }
    event.preventDefault();
    const separator = event.currentTarget as HTMLElement;
    const page = separator.closest('.gd-solo-draft') as HTMLElement;
    separator.setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
    const move = (e: PointerEvent) => {
      const top = page.getBoundingClientRect().top;
      this.picksHeight.set(Math.round(e.clientY - top - separator.offsetHeight / 2));
    };
    const stop = () => {
      separator.removeEventListener('pointermove', move);
      separator.removeEventListener('pointerup', stop);
      separator.removeEventListener('pointercancel', stop);
      this.dragging.set(false);
      // Keep what the theme allowed, so the next drag or key press starts from what is shown
      const shown = page.querySelector<HTMLElement>('.gd-solo-draft__picks')?.getBoundingClientRect().height;
      if (shown) {
        this.picksHeight.set(Math.round(shown));
      }
    };
    separator.addEventListener('pointermove', move);
    separator.addEventListener('pointerup', stop);
    separator.addEventListener('pointercancel', stop);
  }

  /** Down makes the picks taller, Up shorter; Enter closes or opens them. */
  protected resizeWithKeys(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.togglePicks();
      return;
    }
    const step = event.key === 'ArrowDown' ? RESIZE_STEP : event.key === 'ArrowUp' ? -RESIZE_STEP : 0;
    if (step && this.picksOpen()) {
      event.preventDefault();
      const picks = (event.currentTarget as HTMLElement)
        .closest('.gd-solo-draft')
        ?.querySelector<HTMLElement>('.gd-solo-draft__picks');
      const current = this.picksHeight() ?? picks?.getBoundingClientRect().height ?? 0;
      this.picksHeight.set(Math.round(current + step));
    }
  }
}
