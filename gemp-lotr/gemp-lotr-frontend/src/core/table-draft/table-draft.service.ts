import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { ApiError, GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { DraftChoice, DraftedCard } from '../draft/draft-models';
import { draftedCopies, poolSize } from '../draft/drafted-pool';
import { Notifier } from '../notifier/notifier';
import { IntervalTimer, StopTimer } from '../platform/interval-timer';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import {
  CONNECTION_LOST,
  DRAFT_FINISHED,
  MAKE_A_PICK,
  NO_TABLE_DRAFT_EVENT,
  WAITING_FOR_OTHERS,
  withRoundAndTime,
} from './table-draft-messages';
import { TableDraftApi } from './table-draft-api.service';
import { TableDraftChoice, TableDraftPlayer, TableDraftRound, TableDraftStatus } from './table-draft-models';
import { mergePolledPool, sameChoices, samePlayers } from './table-draft-pool';

/** How often the legacy page asked for the draft status (setInterval in tableDraftUi.init). */
export const TABLE_DRAFT_POLL_MS = 500;

/**
 * Where the page is: `loading` (nothing shown yet), `picking` (a card is to be declared), `waiting` (one is declared,
 * the others have not all declared theirs), `finished` (nothing left to pick), `lost` (a call failed; polling has
 * stopped) or `noEvent` (the page was opened without ?eventId=).
 */
export type TableDraftPhase = 'loading' | 'picking' | 'waiting' | 'finished' | 'lost' | 'noEvent';

/**
 * State of the table draft page, ported from tableDraftUi.js: the player's draft status (GET /tableDraft/{eventId}),
 * polled every 500 ms between start() and stop() (the route starts it and stops it when left; the service also stops
 * when its injector is destroyed) and once the draft is finished or a call failed; and declaring a card (POST
 * /tableDraft/{eventId}). The event is the page's ?eventId= (a tournament id). See README.md for what differs.
 */
@Injectable()
export class TableDraftService {
  private readonly api = inject(TableDraftApi);
  private readonly notifier = inject(Notifier);
  private readonly timer = inject(IntervalTimer);

  /** The page's ?eventId=, or null. */
  readonly eventId: string | null = new URLSearchParams(inject(PAGE_QUERY_STRING)).get('eventId') || null;

  /** Seats in table order, with whether each has declared a card. */
  readonly players = signal<TableDraftPlayer[]>([], { equal: samePlayers });
  /** Packs pass down the seat list when true, up it when false. */
  readonly pickOrderAscending = signal(true);
  /** The pack on offer, with the declared card marked; empty once finished. */
  readonly choices = signal<TableDraftChoice[]>([], { equal: sameChoices });
  /** The drafted pool, in the order the page shows it (see mergePolledPool). */
  readonly drafted = signal<DraftedCard[]>([]);
  /** Seconds left for this pick (timed drafts only), as last told by the server. */
  readonly secondsRemaining = signal<number | null>(null);
  readonly round = signal<TableDraftRound | null>(null, {
    equal: (a, b) => a === b || (a !== null && b !== null && a.current === b.current && a.total === b.total),
  });
  /** A card is being declared and the answer has not arrived. */
  readonly picking = signal(false);

  private readonly loaded = signal(false);
  private readonly lost = signal(false);

  readonly phase = computed<TableDraftPhase>(() => {
    if (this.eventId === null) {
      return 'noEvent';
    }
    if (this.lost()) {
      return 'lost';
    }
    if (!this.loaded()) {
      return 'loading';
    }
    const choices = this.choices();
    if (choices.length === 0) {
      return 'finished';
    }
    return choices.some((choice) => choice.chosen) ? 'waiting' : 'picking';
  });

  /** The line above the picks (null while loading and once the connection is lost: see `notices`). */
  readonly message = computed(() => {
    switch (this.phase()) {
      case 'picking':
        return withRoundAndTime(MAKE_A_PICK, this.round(), this.secondsRemaining());
      case 'waiting':
        return withRoundAndTime(WAITING_FOR_OTHERS, this.round(), this.secondsRemaining());
      case 'finished':
        return DRAFT_FINISHED;
      case 'noEvent':
        return NO_TABLE_DRAFT_EVENT;
      default:
        return null;
    }
  });

  /** Warnings once a call failed (the legacy page wrote them in the chat). */
  readonly notices = computed(() => (this.phase() === 'lost' ? CONNECTION_LOST : []));

  /** Between seats in the table line: " > " when packs pass down the list, " < " when they pass up. */
  readonly passSeparator = computed(() => (this.pickOrderAscending() ? ' > ' : ' < '));

  /** One blueprint per drafted copy (the legacy page drew a card per copy). */
  readonly draftedCopies = computed(() => draftedCopies(this.drafted()));
  readonly draftedCount = computed(() => poolSize(this.drafted()));

  private stopTimer: StopTimer | null = null;
  private poll: Subscription | null = null;
  private generation = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Whether the status is being polled. */
  get running(): boolean {
    return this.stopTimer !== null;
  }

  /** Asks for the status now and then every 500 ms (a failed page starts again, as a page refresh did). */
  start(): void {
    if (this.eventId === null || this.running) {
      return;
    }
    this.lost.set(false);
    this.stopTimer = this.timer.every(TABLE_DRAFT_POLL_MS, () => this.refresh());
    this.refresh();
  }

  /** Stops polling; answers still on their way are dropped. */
  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
    this.cancelPoll();
    this.generation++;
    this.picking.set(false);
  }

  /**
   * Asks for the status once, unless an answer is still awaited (the legacy page asked every 500 ms whatever) or a
   * card is being declared (its answer is the newer status).
   */
  refresh(): void {
    const eventId = this.eventId;
    if (eventId === null || this.lost() || this.poll !== null || this.picking()) {
      return;
    }
    const subscription = this.api.getStatus(eventId).subscribe({
      next: (status) => {
        this.poll = null;
        if (status !== null) {
          this.apply(status);
        }
      },
      error: () => {
        this.poll = null;
        this.lose();
      },
    });
    if (!subscription.closed) {
      this.poll = subscription;
    }
  }

  /**
   * Declares a card of the pack on offer (picks are made once every player has declared one; until then the player
   * may declare another). Nothing happens for a card not on offer, the card already declared, or while another
   * declaration is under way. A 400 (the pack moved on meanwhile) alerts and polling goes on; any other failure is
   * handled as a failed poll.
   */
  async pick(choice: DraftChoice): Promise<void> {
    const eventId = this.eventId;
    const phase = this.phase();
    if (eventId === null || this.picking() || (phase !== 'picking' && phase !== 'waiting')) {
      return;
    }
    const offered = this.choices().find((candidate) => candidate.id === choice.id);
    if (!offered || offered.chosen) {
      return;
    }
    this.cancelPoll();
    const generation = this.generation;
    this.picking.set(true);
    try {
      const status = await firstValueFrom(this.api.pick(eventId, choice.id));
      if (generation === this.generation) {
        this.picking.set(false);
        this.apply(status);
      }
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.picking.set(false);
      if (ApiError.from(error).is(400)) {
        await this.notifier.alert(GENERIC_COMMUNICATION_ERROR);
        this.refresh();
      } else {
        this.lose();
      }
    }
  }

  private apply(status: TableDraftStatus): void {
    this.players.set(status.players);
    this.pickOrderAscending.set(status.pickOrderAscending);
    this.drafted.update((shown) => (this.loaded() ? mergePolledPool(shown, status.drafted) : status.drafted));
    this.choices.set(status.choices);
    this.secondsRemaining.set(status.secondsRemaining);
    this.round.set(status.round);
    this.loaded.set(true);
    if (status.choices.length === 0) {
      // The legacy page stopped polling once the draft was finished
      this.stopTimer?.();
      this.stopTimer = null;
    }
  }

  private lose(): void {
    this.stop();
    this.lost.set(true);
  }

  private cancelPoll(): void {
    this.poll?.unsubscribe();
    this.poll = null;
  }
}
