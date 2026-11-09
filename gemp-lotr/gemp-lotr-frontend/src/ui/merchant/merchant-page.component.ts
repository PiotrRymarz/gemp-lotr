import { Component, inject } from '@angular/core';
import { MerchantService } from '../../core/merchant/merchant.service';
import { CardInfoComponent } from '../shared/card-info/card-info.component';
import { MerchantFilterComponent } from './merchant-filter.component';
import { MerchantGridComponent } from './merchant-grid.component';
import { MerchantQuestionComponent } from './merchant-question.component';

/**
 * The merchant page (merchant.html): the filter and controls above the offers, the "Merchant operation" question and
 * the card information. Loads the first page when shown.
 *
 * DOM contract: `.gd-merchant` with `data-state` (loading until the first page has arrived, then ready),
 * `data-busy` while an operation is asked about or under way and `data-hide-merchant` when the buttons are hidden;
 * holding `section.gd-merchant__filter` (`gd-merchant-filter`), `section.gd-merchant__offers`
 * (`gd-merchant-grid`), then `gd-merchant-question` and `gd-card-info`.
 */
@Component({
  selector: 'gd-merchant-page',
  imports: [MerchantFilterComponent, MerchantGridComponent, MerchantQuestionComponent, CardInfoComponent],
  host: {
    class: 'gd-merchant',
    '[attr.data-state]': "merchant.page() ? 'ready' : 'loading'",
    '[attr.data-busy]': "merchant.busy() ? '' : null",
    '[attr.data-hide-merchant]': "merchant.hideMerchant() ? '' : null",
    '[attr.aria-busy]': '!merchant.page()',
  },
  template: `
    <section class="gd-merchant__filter" aria-label="Filter"><gd-merchant-filter /></section>
    <section class="gd-merchant__offers" aria-label="Offers"><gd-merchant-grid /></section>
    <gd-merchant-question />
    <gd-card-info />
  `,
})
export class MerchantPageComponent {
  protected readonly merchant = inject(MerchantService);

  constructor() {
    this.merchant.load();
  }
}
