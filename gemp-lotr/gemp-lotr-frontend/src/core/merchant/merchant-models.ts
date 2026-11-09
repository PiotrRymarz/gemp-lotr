/** One item of GET /merchant: a card (blueprint with "_") or a pack. */
export interface MerchantItem {
  kind: 'card' | 'pack';
  blueprintId: string;
  /** Copies the player owns (in "My cards"). */
  owned: number;
  /** What the merchant pays for one copy, in silver ("Sell for"); only for items the player owns. */
  buyPrice: number | null;
  /** What the merchant asks for one copy, in silver ("Buy for"); only for items the merchant sells. */
  sellPrice: number | null;
  /** The player may trade 4 copies and 4G for the foil version (4+ copies of a non-foil card). */
  tradeFoil: boolean;
}

/** One page of GET /merchant. */
export interface MerchantPage {
  /** The player's currency, in silver (100 silver = 1 gold). */
  currency: number;
  /** Items matching the filter, on every page. */
  total: number;
  /** The page's items, in server order. */
  items: MerchantItem[];
}

/** What the player can do with an item. */
export type MerchantOperation = 'buy' | 'sell' | 'tradeFoil';
