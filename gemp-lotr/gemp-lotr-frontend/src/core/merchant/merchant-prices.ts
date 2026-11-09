/** Prices and currency are counted in silver; 100 silver make 1 gold (common.js formatPrice). */
export interface PriceParts {
  gold: number;
  /** Always two digits ("05"). */
  silver: string;
}

export function priceParts(price: number): PriceParts {
  const silver = price % 100;
  return { gold: Math.floor(price / 100), silver: silver < 10 ? `0${silver}` : String(silver) };
}

/**
 * A price as text, "12G 05S". The legacy page drew the gold and silver coin images instead of G and S; a view may do
 * the same with priceParts. The text form is used in the confirmation questions (the Notifier shows plain text).
 */
export function formatPrice(price: number): string {
  const { gold, silver } = priceParts(price);
  return `${gold}G ${silver}S`;
}

/** The trade-in costs 4 copies and this much currency (MerchantService.tradeForFoil). */
export const TRADE_FOIL_COST = 400;
export const TRADE_FOIL_COPIES = 4;
