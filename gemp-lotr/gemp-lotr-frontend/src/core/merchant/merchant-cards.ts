import { CardImageService } from '../cards/card-image.service';
import { CardView } from '../cards/card-view';
import { MerchantItem, MerchantPage } from './merchant-models';

/** A price button: the price, and whether the player can afford it. */
export interface MerchantPriceAction {
  price: number;
  /** Buying costs more than the player has: the legacy button was disabled and drawn red. */
  disabled: boolean;
}

/** A card of the merchant page and what the player may do with it. */
export interface MerchantCard {
  view: CardView;
  item: MerchantItem;
  /** "Sell for": the merchant buys a copy (only for owned items). */
  sell: MerchantPriceAction | null;
  /** "Buy for": the merchant sells a copy. */
  buy: MerchantPriceAction | null;
  /** "Trade 4 for foil". */
  tradeFoil: boolean;
}

export interface MerchantCardsOptions {
  images: CardImageService;
  /** Foil layer image for foil cards (from the player's foil setting), or null to show foils plain. */
  foilImage: string | null;
  /** "Hide merchant": the cards show without their buttons. */
  hideMerchant: boolean;
}

/**
 * The cards of a merchant page as merchantUi.addCardToList showed them: packs first, then the cards, in server order
 * (LegacyCardFilter.displayCollection), each with the copies owned (0 included) and its buttons.
 */
export function merchantCards(page: MerchantPage | null, options: MerchantCardsOptions): MerchantCard[] {
  if (!page) {
    return [];
  }
  const items = [...page.items.filter((i) => i.kind === 'pack'), ...page.items.filter((i) => i.kind === 'card')];
  return items.map((item) => merchantCard(item, page.currency, options));
}

function merchantCard(
  item: MerchantItem,
  currency: number,
  { images, foilImage, hideMerchant }: MerchantCardsOptions,
): MerchantCard {
  const pack = item.kind === 'pack';
  const image = images.resolve(item.blueprintId, pack ? 'pack' : 'player');
  const view: CardView = {
    ref: { kind: 'merchant', blueprintId: item.blueprintId, item },
    role: pack ? 'pack' : 'card',
    imageUrl: image.imageUrl,
    horizontal: image.horizontal,
    errata: !pack && image.errata,
    foilImage: !pack && image.foil ? foilImage : null,
    border: !pack,
    count: item.owned,
    overlayImage: null,
  };
  if (hideMerchant) {
    return { view, item, sell: null, buy: null, tradeFoil: false };
  }
  return {
    view,
    item,
    sell: item.buyPrice !== null ? { price: item.buyPrice, disabled: false } : null,
    buy: item.sellPrice !== null ? { price: item.sellPrice, disabled: item.sellPrice > currency } : null,
    tradeFoil: item.tradeFoil,
  };
}
