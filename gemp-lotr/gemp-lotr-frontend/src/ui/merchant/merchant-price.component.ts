import { Component, computed, input } from '@angular/core';
import { priceParts } from '../../core/merchant/merchant-prices';

/**
 * A price or the player's currency, in gold and two-digit silver (common.js formatPrice, which drew a gold and a
 * silver coin image after each number). The theme draws the coins.
 *
 * DOM contract: `span.gd-price` (`aria-label` "<gold> gold <silver> silver") holding `span.gd-price__gold` and
 * `span.gd-price__silver` (the numbers, `aria-hidden`), with a space between them.
 */
@Component({
  selector: 'gd-price',
  host: {
    class: 'gd-price',
    role: 'img',
    '[attr.aria-label]': "parts().gold + ' gold ' + parts().silver + ' silver'",
  },
  template: `<span class="gd-price__gold" aria-hidden="true">{{ parts().gold }}</span
    >&ngsp;<span class="gd-price__silver" aria-hidden="true">{{ parts().silver }}</span>`,
})
export class MerchantPriceComponent {
  /** In silver. */
  readonly price = input.required<number>();
  protected readonly parts = computed(() => priceParts(this.price()));
}
