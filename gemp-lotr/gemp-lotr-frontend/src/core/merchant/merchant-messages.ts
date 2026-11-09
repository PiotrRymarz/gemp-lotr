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

export function sellQuestion(price: number): string {
  return `Do you want to sell this item for ${formatPrice(price)}?`;
}

export function buyQuestion(price: number): string {
  return `Do you want to buy this item for ${formatPrice(price)}?`;
}

export const TRADE_FOIL_QUESTION =
  'Do you want to trade 4 of this card and 4G in currency for a foil version of the card?';

/** Shown when the merchant refuses without saying why (new: the legacy page said nothing). */
export const MERCHANT_REFUSED = 'The merchant could not complete this operation.';
