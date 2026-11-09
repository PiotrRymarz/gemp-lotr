import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CardImageService } from '../../core/cards/card-image.service';
import { foilOverlayImage, readFoilPresentation } from '../../core/cards/foil-presentation';
import { merchantCards } from '../../core/merchant/merchant-cards';
import { BUY_BUTTON, SELL_BUTTON, TRADE_FOIL_BUTTON } from '../../core/merchant/merchant-messages';
import { MerchantService } from '../../core/merchant/merchant.service';
import { CardComponent } from '../shared/card/card.component';
import { FitCardsDirective } from '../shared/fit-cards/fit-cards.directive';
import { MerchantPriceComponent } from './merchant-price.component';

/**
 * The merchant's offers on the current page (merchantUi.addCardToList): packs first, then the cards, each with the
 * copies the player owns and, unless "Hide merchant", its buttons: "Sell for" (the merchant buys a copy), "Buy for"
 * (disabled when the player can't afford it) and "Trade 4 for foil". Using a card does nothing; its details show
 * the card information. The offers are sized to fit the box (fitCards).
 *
 * DOM contract: `.gd-merchant-grid` holding `.gd-merchant-grid__cards` (the fitCards box, `data-count`) with one
 * `.gd-offer` per item (`data-kind` = card or pack, `data-orientation`, `data-owned` = copies owned), holding its
 * `button.gd-card` (the copies in `.gd-card__count`), then `button.gd-button.gd-offer__action` with `data-action` =
 * sell, buy (`disabled` and `data-unaffordable` when it costs more than the currency) or trade-foil, each holding
 * `span.gd-offer__label` and, for a price, `gd-price`. While an operation is asked about or under way the buttons do
 * nothing (MerchantService.busy; the page shows it).
 */
@Component({
  selector: 'gd-merchant-grid',
  imports: [CardComponent, FitCardsDirective, MerchantPriceComponent],
  host: { class: 'gd-merchant-grid' },
  template: `
    <div class="gd-merchant-grid__cards" [attr.data-count]="cards().length" [gdFitCards]="fitCards()">
      @for (card of cards(); track $index) {
        <div
          class="gd-offer"
          [attr.data-kind]="card.item.kind"
          [attr.data-orientation]="card.view.horizontal ? 'horizontal' : 'vertical'"
          [attr.data-owned]="card.item.owned"
        >
          <button [gdCard]="card.view"></button>
          @if (card.sell; as sell) {
            <button
              type="button"
              class="gd-button gd-offer__action"
              data-action="sell"
              (click)="merchant.sell(card.item)"
            >
              <span class="gd-offer__label">{{ labels.sell }}</span>
              <gd-price [price]="sell.price" />
            </button>
          }
          @if (card.buy; as buy) {
            <button
              type="button"
              class="gd-button gd-offer__action"
              data-action="buy"
              [attr.data-unaffordable]="buy.disabled ? '' : null"
              [disabled]="buy.disabled"
              (click)="merchant.buy(card.item)"
            >
              <span class="gd-offer__label">{{ labels.buy }}</span>
              <gd-price [price]="buy.price" />
            </button>
          }
          @if (card.tradeFoil) {
            <button
              type="button"
              class="gd-button gd-offer__action"
              data-action="trade-foil"
              (click)="merchant.tradeFoil(card.item)"
            >
              <span class="gd-offer__label">{{ labels.tradeFoil }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class MerchantGridComponent {
  protected readonly merchant = inject(MerchantService);
  private readonly images = inject(CardImageService);
  private readonly foilImage = foilOverlayImage(readFoilPresentation(inject(DOCUMENT).cookie));
  protected readonly labels = { sell: SELL_BUTTON, buy: BUY_BUTTON, tradeFoil: TRADE_FOIL_BUTTON };

  protected readonly cards = computed(() =>
    merchantCards(this.merchant.page(), {
      images: this.images,
      foilImage: this.foilImage,
      hideMerchant: this.merchant.hideMerchant(),
    }),
  );

  protected readonly fitCards = computed(() => this.cards().map((card) => ({ horizontal: card.view.horizontal })));
}
