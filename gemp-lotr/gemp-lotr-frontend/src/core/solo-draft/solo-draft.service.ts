import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { DraftChoice, DraftedCard } from '../draft/draft-models';
import { addPicked, draftedCopies, poolSize } from '../draft/drafted-pool';
import { Notifier } from '../notifier/notifier';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { DRAFT_FINISHED, MAKE_A_PICK, NO_DRAFT_EVENT } from './solo-draft-messages';
import { SoloDraftApi } from './solo-draft-api.service';

/**
 * Where the page is: `loading` (nothing shown yet), `picking`, `finished` (nothing left to pick), `failed` (the draft
 * could not be loaded) or `noEvent` (the page was opened without ?eventId=).
 */
export type SoloDraftStatus = 'loading' | 'picking' | 'finished' | 'failed' | 'noEvent';

/**
 * State of the solo draft page, ported from soloDraftUi.js: the picks on offer (GET /soloDraft/{eventId}), the cards
 * drafted so far (the event's collection, sorted by the server, then each pick's cards after them) and making a pick
 * (POST /soloDraft/{eventId}). The event is the page's ?eventId= (a league code or a tournament id). No polling: a
 * solo draft only changes when the player picks. See README.md for what differs from the legacy page.
 */
@Injectable()
export class SoloDraftService {
  private readonly api = inject(SoloDraftApi);
  private readonly notifier = inject(Notifier);

  /** The page's ?eventId=, or null. */
  readonly eventId: string | null = new URLSearchParams(inject(PAGE_QUERY_STRING)).get('eventId') || null;

  readonly status = signal<SoloDraftStatus>(this.eventId === null ? 'noEvent' : 'loading');
  /** The picks on offer; empty while a pick is under way (the legacy page removed them on click) and once finished. */
  readonly choices = signal<DraftChoice[]>([]);
  /** The drafted pool, in the order the page shows it. */
  readonly drafted = signal<DraftedCard[]>([]);
  /** A pick has been sent and its answer has not arrived. */
  readonly picking = signal(false);

  /** One blueprint per drafted copy (the legacy page drew a card per copy). */
  readonly draftedCopies = computed(() => draftedCopies(this.drafted()));
  readonly draftedCount = computed(() => poolSize(this.drafted()));

  /** The line above the picks: "Make a pick", "Draft is finished", or why there is nothing (null while loading). */
  readonly message = computed(() => {
    switch (this.status()) {
      case 'picking':
        return MAKE_A_PICK;
      case 'finished':
        return DRAFT_FINISHED;
      case 'noEvent':
        return NO_DRAFT_EVENT;
      default:
        return null;
    }
  });

  private generation = 0;

  /** Loads the picks on offer and the drafted cards (getDraftState); both arrive together. */
  async load(): Promise<void> {
    const eventId = this.eventId;
    if (eventId === null) {
      return;
    }
    const generation = ++this.generation;
    try {
      const { choices, drafted } = await firstValueFrom(
        forkJoin({ choices: this.api.getChoices(eventId), drafted: this.api.getDraftedCards(eventId) }),
      );
      if (generation !== this.generation) {
        return;
      }
      this.drafted.set(drafted);
      this.showChoices(choices);
    } catch {
      if (generation !== this.generation) {
        return;
      }
      this.status.set('failed');
      await this.notifier.alert(GENERIC_COMMUNICATION_ERROR);
    }
  }

  /**
   * Makes a pick: the picks are taken away at once, the picked cards are added after the drafted ones and the next
   * picks are shown. Nothing happens for a choice that is not on offer, or while another pick is under way. When the
   * pick fails, the page says so and loads the draft again (the legacy page was left without picks).
   */
  async pick(choice: DraftChoice): Promise<void> {
    const eventId = this.eventId;
    if (eventId === null || this.picking() || this.status() !== 'picking') {
      return;
    }
    if (!this.choices().some((offered) => offered.id === choice.id)) {
      return;
    }
    const generation = ++this.generation;
    this.picking.set(true);
    this.choices.set([]);
    try {
      const result = await firstValueFrom(this.api.pick(eventId, choice.id));
      if (generation !== this.generation) {
        return;
      }
      this.drafted.update((pool) => addPicked(pool, result.picked));
      this.showChoices(result.choices);
    } catch {
      if (generation !== this.generation) {
        return;
      }
      await this.notifier.alert(GENERIC_COMMUNICATION_ERROR);
      this.picking.set(false);
      await this.load();
    } finally {
      if (generation === this.generation) {
        this.picking.set(false);
      }
    }
  }

  private showChoices(choices: DraftChoice[]): void {
    this.choices.set(choices);
    this.status.set(choices.length > 0 ? 'picking' : 'finished');
  }
}
