import { TestBed } from '@angular/core/testing';
import { readServerXml } from '../../testing/files';
import { CardImageService } from '../cards/card-image.service';
import { merchantCards } from './merchant-cards';
import { parseMerchantPage } from './merchant-parsers';

describe('merchantCards', () => {
  const page = parseMerchantPage(readServerXml('merchant.xml'));
  let images: CardImageService;

  beforeEach(() => (images = TestBed.inject(CardImageService)));

  it('shows nothing before the first page', () => {
    expect(merchantCards(null, { images, foilImage: null, hideMerchant: false })).toEqual([]);
  });

  it('puts packs first, shows the copies owned and the buttons the item has', () => {
    const cards = merchantCards(page, { images, foilImage: '/foil.gif', hideMerchant: false });
    expect(cards.map((c) => c.item.blueprintId)).toEqual(['FotR - Booster', '1_1', '1_2*', '1_3', '1_319']);
    expect(cards.map((c) => c.view.count)).toEqual([0, 5, 1, 0, 2]);
    expect(cards.map((c) => c.view.role)).toEqual(['pack', 'card', 'card', 'card', 'card']);
    expect(cards.map((c) => c.view.border)).toEqual([false, true, true, true, true]);
    expect(cards.map((c) => c.sell)).toEqual([
      null,
      { price: 150, disabled: false },
      { price: 900, disabled: false },
      null,
      { price: 7, disabled: false },
    ]);
    // Buying is disabled only when it costs more than the 1234 the player has
    expect(cards.map((c) => c.buy)).toEqual([
      { price: 300, disabled: false },
      { price: 420, disabled: false },
      null,
      { price: 2000, disabled: true },
      { price: 1234, disabled: false },
    ]);
    expect(cards.map((c) => c.tradeFoil)).toEqual([false, true, false, false, false]);
    expect(cards[1].view.ref).toEqual({ kind: 'merchant', blueprintId: '1_1', item: page.items[0] });
  });

  it('draws foils with the foil layer, and sites landscape', () => {
    const cards = merchantCards(page, { images, foilImage: '/foil.gif', hideMerchant: false });
    expect(cards[2].view.foilImage).toBe('/foil.gif');
    expect(cards[1].view.foilImage).toBeNull();
    expect(cards[4].view.horizontal).toBe(true);
    expect(cards[1].view.horizontal).toBe(false);
  });

  it('hides every button with "Hide merchant"', () => {
    const cards = merchantCards(page, { images, foilImage: null, hideMerchant: true });
    expect(cards.every((c) => c.sell === null && c.buy === null && !c.tradeFoil)).toBe(true);
    expect(cards.map((c) => c.view.count)).toEqual([0, 5, 1, 0, 2]);
  });
});
