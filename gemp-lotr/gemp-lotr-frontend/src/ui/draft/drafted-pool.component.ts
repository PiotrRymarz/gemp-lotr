import { Component, computed, input } from '@angular/core';
import { draftedViews } from '../../core/draft/draft-cards';
import { CardComponent } from '../shared/card/card.component';
import { FitCardsDirective } from '../shared/fit-cards/fit-cards.directive';
import { injectDraftCardsOptions } from './draft-cards-options';

/** Said in the drafted pool's place before anything is drafted (for themes that show it). */
export const NOTHING_DRAFTED = 'No cards drafted yet.';

/**
 * The cards drafted so far (solo and table draft): one card per copy, in pool order, sized to fit the box
 * (fitCards). Using a card does what the page's CARD_ACTIONS says for a `drafted` ref (nothing, in the solo draft);
 * asking for its details shows them.
 *
 * DOM contract: `.gd-drafted-pool` (`data-count` = copies drafted) holding `.gd-drafted-pool__cards` (the fitCards
 * box) with a `button.gd-card` per copy, and `p.gd-drafted-pool__empty` while nothing is drafted.
 */
@Component({
  selector: 'gd-drafted-pool',
  imports: [CardComponent, FitCardsDirective],
  host: { class: 'gd-drafted-pool', '[attr.data-count]': 'views().length' },
  template: `
    <div class="gd-drafted-pool__cards" [gdFitCards]="fitCards()">
      @for (view of views(); track $index) {
        <button [gdCard]="view"></button>
      }
    </div>
    @if (views().length === 0) {
      <p class="gd-drafted-pool__empty">{{ nothingDrafted }}</p>
    }
  `,
})
export class DraftedPoolComponent {
  /** One blueprint per drafted copy (draftedCopies). */
  readonly copies = input.required<readonly string[]>();

  protected readonly nothingDrafted = NOTHING_DRAFTED;
  private readonly options = injectDraftCardsOptions();
  protected readonly views = computed(() => draftedViews(this.copies(), this.options));
  protected readonly fitCards = computed(() => this.views().map((view) => ({ horizontal: view.horizontal })));
}
