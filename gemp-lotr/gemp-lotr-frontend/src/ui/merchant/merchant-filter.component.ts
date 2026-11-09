import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import {
  cultureImage,
  MERCHANT_CARD_TYPE_OPTIONS,
  MERCHANT_CULTURES,
  MERCHANT_HOBBIT_CULTURES,
  MERCHANT_ITEM_CLASS_OPTIONS,
  MERCHANT_KEYWORD_OPTIONS,
  MERCHANT_PHASE_OPTIONS,
  MERCHANT_PRODUCT_OPTIONS,
  MERCHANT_RACE_OPTIONS,
  MERCHANT_RARITY_OPTIONS,
  MERCHANT_SET_OPTIONS,
  MERCHANT_SORT_OPTIONS,
  MerchantSelectField,
  MerchantSelectOption,
} from '../../core/merchant/merchant-filter';
import { HIDE_MERCHANT_LABEL, OWNED_MIN_LABEL } from '../../core/merchant/merchant-messages';
import {
  MERCHANT_PAGE_SIZE_MAX,
  MERCHANT_PAGE_SIZE_MIN,
  MerchantService,
  OWNED_MIN_OPTIONS,
} from '../../core/merchant/merchant.service';
import { MerchantPriceComponent } from './merchant-price.component';

/** A select of the filter: its field, its accessible name and its options. */
interface FilterSelect {
  field: MerchantSelectField;
  label: string;
  options: readonly MerchantSelectOption[];
}

/** The Wiki's card search, offered above the filter ("Looking for more?"). */
export const WIKI_CARD_SEARCH = 'https://wiki.lotrtcgpc.net/wiki/Special:RunQuery/CardSearch';

/**
 * The merchant's filter and controls (LegacyCardFilter.buildUi, with merchantUi's pocket, "Hide merchant" and
 * "Owned >="): paging and the page size, the Wiki's card search, the set, name, sort and rarity, the culture toggles
 * (the Hobbit ones only for a Hobbit set), card type, keyword and product type, and race, item class or phase for the
 * card types that have them. The legacy selects had no labels (their first option says what they are); here each has
 * an accessible name.
 *
 * DOM contract: `.gd-merchant-filter` holding
 * - `.gd-pager`: `button.gd-pager__previous` and `button.gd-pager__next` (`data-icon`), and `.gd-pager__track` holding
 *   `input[type=range].gd-pager__size` (cards per page);
 * - `p.gd-merchant-filter__wiki` with its link;
 * - `.gd-merchant-filter__inputs`: `.gd-merchant-field[data-field]` (set, name, sort, rarity), each a `label`
 *   holding a visually hideable `span.gd-merchant-field__label` and the `select` or `input[type=text]`;
 * - `.gd-merchant-filter__details`: `.gd-cultures` (`role=group`) with `.gd-cultures__group[data-group]` (main,
 *   hobbit; `hidden` when not shown) of `label.gd-culture` (`data-culture`, `data-active`) holding a visually hidden
 *   checkbox `.gd-culture__input` and `img.gd-culture__icon`; then `.gd-merchant-filter__selects` with the fields
 *   cardType, keyword, product, race, itemClass and phase (`hidden` when they don't apply);
 * - `.gd-merchant-filter__pocket` (`span.gd-merchant-filter__pocket-label`, then `gd-price` once known);
 * - `label.gd-merchant-filter__hide` (`span` text, `input[type=checkbox]`) and `label.gd-merchant-filter__owned`
 *   (`span` text, `select`).
 */
@Component({
  selector: 'gd-merchant-filter',
  imports: [NgTemplateOutlet, MerchantPriceComponent],
  host: { class: 'gd-merchant-filter' },
  templateUrl: './merchant-filter.component.html',
})
export class MerchantFilterComponent {
  protected readonly merchant = inject(MerchantService);

  protected readonly pageSize = { min: MERCHANT_PAGE_SIZE_MIN, max: MERCHANT_PAGE_SIZE_MAX };
  protected readonly ownedMinOptions = OWNED_MIN_OPTIONS;
  protected readonly labels = { hide: HIDE_MERCHANT_LABEL, ownedMin: OWNED_MIN_LABEL };
  protected readonly wiki = WIKI_CARD_SEARCH;

  protected readonly inputSelects: readonly FilterSelect[] = [
    { field: 'sort', label: 'Sort', options: MERCHANT_SORT_OPTIONS },
    { field: 'rarity', label: 'Rarity', options: MERCHANT_RARITY_OPTIONS },
  ];
  protected readonly setSelect: FilterSelect = { field: 'set', label: 'Set', options: MERCHANT_SET_OPTIONS };
  protected readonly detailSelects: readonly FilterSelect[] = [
    { field: 'cardType', label: 'Card type', options: MERCHANT_CARD_TYPE_OPTIONS },
    { field: 'keyword', label: 'Keyword', options: MERCHANT_KEYWORD_OPTIONS },
    { field: 'product', label: 'Type', options: MERCHANT_PRODUCT_OPTIONS },
    { field: 'race', label: 'Race', options: MERCHANT_RACE_OPTIONS },
    { field: 'itemClass', label: 'Item class', options: MERCHANT_ITEM_CLASS_OPTIONS },
    { field: 'phase', label: 'Phase', options: MERCHANT_PHASE_OPTIONS },
  ];
  protected readonly cultureGroups = [
    { id: 'main', cultures: MERCHANT_CULTURES },
    { id: 'hobbit', cultures: MERCHANT_HOBBIT_CULTURES },
  ];
  protected readonly cultureImage = cultureImage;

  protected readonly selected = computed(() => new Set(this.merchant.fields().cultures));

  protected value(field: MerchantSelectField): string {
    return this.merchant.fields()[field];
  }

  /** Race, item class and phase show only for the card types that have them. */
  protected hidden(field: MerchantSelectField): boolean {
    const shown = this.merchant.dynamicFilters();
    return (
      (field === 'race' && !shown.race) ||
      (field === 'itemClass' && !shown.itemClass) ||
      (field === 'phase' && !shown.phase)
    );
  }

  protected groupHidden(group: string): boolean {
    return group === 'hobbit' && !this.merchant.hobbitCulturesShown();
  }

  protected set(field: MerchantSelectField, event: Event): void {
    this.merchant.setField(field, (event.target as HTMLSelectElement).value);
  }

  protected setName(event: Event): void {
    this.merchant.setName((event.target as HTMLInputElement).value);
  }

  protected setPageSize(event: Event): void {
    this.merchant.setPageSize(Number((event.target as HTMLInputElement).value));
  }

  protected setOwnedMin(event: Event): void {
    this.merchant.setOwnedMin(Number((event.target as HTMLSelectElement).value));
  }

  protected setHideMerchant(event: Event): void {
    this.merchant.setHideMerchant((event.target as HTMLInputElement).checked);
  }
}
