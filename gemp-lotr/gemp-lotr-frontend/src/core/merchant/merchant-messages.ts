import { MerchantOperation } from './merchant-models';
import { formatPrice } from './merchant-prices';

/** The merchant's wording (merchantUi.js), with the prices as text (see formatPrice). */

/** The question dialog's title ("Merchant operation"). */
export const MERCHANT_DIALOG_TITLE = 'Merchant operation';

/** On the button of an item the player owns: the merchant buys it ("Sell for<br/>price"). */
export const SELL_BUTTON = 'Sell for';
/** On the button of an item the merchant sells ("Buy for<br/>price"). */
export const BUY_BUTTON = 'Buy for';
export const TRADE_FOIL_BUTTON = 'Trade 4 for foil';
export const HIDE_MERCHANT_LABEL = 'Hide merchant';
export const OWNED_MIN_LABEL = 'Owned >=';

export const TRADE_FOIL_QUESTION =
  'Do you want to trade 4 of this card and 4G in currency for a foil version of the card?';

/**
 * The question about an operation, around its price (null for the foil trade, which has none), for a view that draws
 * the price itself (the legacy dialog drew the coin images).
 */
export function questionWording(operation: MerchantOperation): { before: string; after: string; priced: boolean } {
  switch (operation) {
    case 'sell':
      return { before: 'Do you want to sell this item for ', after: '?', priced: true };
    case 'buy':
      return { before: 'Do you want to buy this item for ', after: '?', priced: true };
    case 'tradeFoil':
      return { before: TRADE_FOIL_QUESTION, after: '', priced: false };
  }
}

export function sellQuestion(price: number): string {
  const { before, after } = questionWording('sell');
  return before + formatPrice(price) + after;
}

export function buyQuestion(price: number): string {
  const { before, after } = questionWording('buy');
  return before + formatPrice(price) + after;
}

/** Shown when the merchant refuses without saying why (new: the legacy page said nothing). */
export const MERCHANT_REFUSED = 'The merchant could not complete this operation.';
