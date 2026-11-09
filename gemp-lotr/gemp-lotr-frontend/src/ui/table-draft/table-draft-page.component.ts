import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TableDraftPhase, TableDraftService } from '../../core/table-draft/table-draft.service';
import { DraftPaneResizer } from '../draft/draft-pane-resizer';
import { DraftPicksComponent } from '../draft/draft-picks.component';
import { DraftedPoolComponent } from '../draft/drafted-pool.component';
import { CardInfoComponent } from '../shared/card-info/card-info.component';

/** The pane a theme that shows one pane at a time (phones) shows: the tab bar's choice. */
export type TableDraftPane = 'picks' | 'drafted' | 'chat';

/** The page's `data-state` for each TableDraftService phase. */
const STATES: Record<TableDraftPhase, string> = {
  loading: 'loading',
  picking: 'picking',
  waiting: 'waiting',
  finished: 'finished',
  lost: 'lost',
  noEvent: 'no-event',
};

/**
 * The table draft page (tableDraft.html): above, the line that says what to do ("Make a pick - Pack 1/3 (1:05)",
 * "Waiting for others to pick a card ...", "Draft is finished", or why there is no draft), the table (the seats in
 * order, those who declared a card marked, joined by the way the packs pass) and the pack on offer, the declared card
 * marked; then the separator; then the cards drafted so far and the chat; and the card information. Polls the draft
 * while shown (TableDraftService.start/stop). Once a call failed, the warnings and a way to start again take the
 * line's place. The separator works as the solo draft's (DraftPaneResizer).
 *
 * The chat region is a placeholder for now (an empty `section` with its label): the "Draft-{eventId}" room is wired
 * in with the shared chat.
 *
 * DOM contract: `.gd-table-draft` with `data-state` (loading, picking, waiting, finished, lost, no-event),
 * `data-busy` while a card is being declared, `data-picks` (open, closed), `data-pane` (picks, drafted, chat: the tab
 * bar's choice) and `--gd-picks-height` (px, once resized); holding `section.gd-table-draft__picks` with
 * `p.gd-table-draft__message` (`role=status`), `.gd-table-draft__notices` (`role=alert`, lost state only:
 * `p.gd-table-draft__notice` per warning, `button.gd-table-draft__retry`), `ol.gd-table-draft__seats`
 * (`data-direction` = down, up) with an `li.gd-table-draft__seat` per seat (`data-chosen`; after the first, a
 * `span.gd-table-draft__pass` " > " or " < " before the `span.gd-table-draft__name`) and `gd-draft-picks`;
 * `div.gd-table-draft__separator` with `button.gd-table-draft__toggle` (as the solo draft's);
 * `section.gd-table-draft__drafted` with `h2.gd-table-draft__heading` (`.gd-table-draft__count`) and
 * `gd-drafted-pool`; `section.gd-table-draft__chat` (empty); `div.gd-page__tabs` with a `button.gd-page__tab` per
 * pane; then `gd-card-info`.
 */
@Component({
  selector: 'gd-table-draft-page',
  imports: [DraftPicksComponent, DraftedPoolComponent, CardInfoComponent],
  host: {
    class: 'gd-table-draft',
    '[attr.data-state]': 'state()',
    '[attr.data-busy]': "draft.picking() ? '' : null",
    '[attr.data-picks]': "picksOpen() ? 'open' : 'closed'",
    '[attr.data-pane]': 'pane()',
    '[attr.aria-busy]': "draft.phase() === 'loading' || draft.picking()",
    '[style.--gd-picks-height]': "picksHeight() === null ? null : picksHeight() + 'px'",
  },
  template: `
    <section class="gd-table-draft__picks" id="gd-pane-picks" aria-label="Picks" [hidden]="!picksOpen()">
      <p class="gd-table-draft__message" role="status">{{ draft.message() }}</p>
      @if (draft.notices().length > 0) {
        <div class="gd-table-draft__notices" role="alert">
          @for (notice of draft.notices(); track $index) {
            <p class="gd-table-draft__notice">{{ notice }}</p>
          }
          <button type="button" class="gd-button gd-table-draft__retry" (click)="retry()">Try again</button>
        </div>
      }
      <ol
        class="gd-table-draft__seats"
        [attr.data-direction]="draft.pickOrderAscending() ? 'down' : 'up'"
        [attr.aria-label]="'Table, packs passing ' + (draft.pickOrderAscending() ? 'down' : 'up') + ' the list'"
      >
        @for (seat of draft.players(); track $index; let first = $first) {
          <li
            class="gd-table-draft__seat"
            [attr.data-chosen]="seat.hasChosen ? '' : null"
            [attr.aria-label]="seat.hasChosen ? seat.name + ', has picked' : seat.name"
          >
            @if (!first) {
              <span class="gd-table-draft__pass" aria-hidden="true">{{ draft.passSeparator() }}</span>
            }
            <span class="gd-table-draft__name">{{ seat.name }}</span>
          </li>
        }
      </ol>
      <gd-draft-picks [choices]="draft.choices()" />
    </section>
    <div
      class="gd-table-draft__separator"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the picks"
      tabindex="0"
      [attr.data-dragging]="resizer.dragging() ? '' : null"
      (pointerdown)="resizer.startResize($event)"
      (keydown)="resizer.resizeWithKeys($event)"
    >
      <button
        type="button"
        class="gd-table-draft__toggle"
        [attr.aria-expanded]="picksOpen()"
        [attr.aria-label]="picksOpen() ? 'Close the picks' : 'Open the picks'"
        [title]="picksOpen() ? 'Close' : 'Open'"
        (click)="resizer.toggle()"
      ></button>
    </div>
    <section class="gd-table-draft__drafted" id="gd-pane-drafted" aria-labelledby="gd-table-draft-heading">
      <h2 class="gd-table-draft__heading" id="gd-table-draft-heading">
        Drafted cards <span class="gd-table-draft__count">{{ draft.draftedCount() }}</span>
      </h2>
      <gd-drafted-pool [copies]="draft.draftedCopies()" />
    </section>
    <section class="gd-table-draft__chat" id="gd-pane-chat" aria-label="Chat"></section>
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
export class TableDraftPageComponent {
  protected readonly draft = inject(TableDraftService);
  protected readonly tabs: readonly { pane: TableDraftPane; label: string }[] = [
    { pane: 'picks', label: 'Picks' },
    { pane: 'drafted', label: 'Drafted' },
    { pane: 'chat', label: 'Chat' },
  ];

  protected readonly state = computed(() => STATES[this.draft.phase()]);
  /** The pane chosen in the tab bar, for themes that show one pane at a time. */
  protected readonly pane = signal<TableDraftPane>('picks');
  protected readonly resizer = new DraftPaneResizer({
    page: '.gd-table-draft',
    picks: '.gd-table-draft__picks',
    toggle: '.gd-table-draft__toggle',
  });
  protected readonly picksOpen = this.resizer.picksOpen;
  protected readonly picksHeight = this.resizer.picksHeight;

  constructor() {
    // The route's injector outlives the page: polling is the page's, from when it is shown until it is left
    this.draft.start();
    inject(DestroyRef).onDestroy(() => this.draft.stop());
  }

  protected retry(): void {
    this.draft.start();
  }

  /** Choosing the picks' tab also opens them, in case the separator closed them. */
  protected showPane(pane: TableDraftPane): void {
    this.pane.set(pane);
    if (pane === 'picks') {
      this.picksOpen.set(true);
    }
  }
}
