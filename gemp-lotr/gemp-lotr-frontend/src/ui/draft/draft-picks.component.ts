import { Component, computed, input } from '@angular/core';
import { choiceViews } from '../../core/draft/draft-cards';
import { DraftChoice } from '../../core/draft/draft-models';
import { CardComponent } from '../shared/card/card.component';
import { FitCardsDirective } from '../shared/fit-cards/fit-cards.directive';
import { injectDraftCardsOptions } from './draft-cards-options';

/**
 * The picks on offer (solo and table draft): one card per choice, in server order, sized to fit the box (fitCards).
 * Using a card makes that pick and asking for its details shows them, through the page's CARD_ACTIONS (the ref is a
 * `draftChoice`). A pick shown by a picture is that picture, without a card border.
 *
 * DOM contract: `.gd-draft-picks` (`data-count` = picks on offer) holding `.gd-draft-picks__cards` (the fitCards box)
 * with a `button.gd-card` per pick (`data-choice` = its id; `data-picture` for a pick shown by a picture; `data-chosen`
 * for the card declared for the pick, table draft only: every copy of it).
 */
@Component({
  selector: 'gd-draft-picks',
  imports: [CardComponent, FitCardsDirective],
  host: { class: 'gd-draft-picks', '[attr.data-count]': 'views().length' },
  template: `
    <div class="gd-draft-picks__cards" [gdFitCards]="fitCards()">
      @for (view of views(); track $index) {
        <button
          [gdCard]="view"
          [attr.data-choice]="choices()[$index].id"
          [attr.data-picture]="choices()[$index].blueprintId === null ? '' : null"
          [attr.data-chosen]="choices()[$index].chosen ? '' : null"
        ></button>
      }
    </div>
  `,
})
export class DraftPicksComponent {
  /** The picks on offer; `chosen` marks the card declared for the pick (table draft). */
  readonly choices = input.required<readonly (DraftChoice & { chosen?: boolean })[]>();

  private readonly options = injectDraftCardsOptions();
  protected readonly views = computed(() => choiceViews(this.choices(), this.options));
  protected readonly fitCards = computed(() => this.views().map((view) => ({ horizontal: view.horizontal })));
}
