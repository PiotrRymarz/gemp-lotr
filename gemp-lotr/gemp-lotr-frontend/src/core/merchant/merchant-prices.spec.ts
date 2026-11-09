import { readLegacyWebFile } from '../../testing/files';
import { buyQuestion, sellQuestion, TRADE_FOIL_QUESTION } from './merchant-messages';
import { formatPrice, priceParts } from './merchant-prices';

describe('merchant prices', () => {
  it('splits silver into gold and two-digit silver (formatPrice)', () => {
    expect(priceParts(0)).toEqual({ gold: 0, silver: '00' });
    expect(priceParts(7)).toEqual({ gold: 0, silver: '07' });
    expect(priceParts(1234)).toEqual({ gold: 12, silver: '34' });
    expect(priceParts(400)).toEqual({ gold: 4, silver: '00' });
    expect(formatPrice(1205)).toBe('12G 05S');
  });

  it('asks the legacy questions', () => {
    const legacy = readLegacyWebFile('js/gemp-022/merchantUi.js');
    expect(sellQuestion(150)).toBe('Do you want to sell this item for 1G 50S?');
    expect(buyQuestion(2000)).toBe('Do you want to buy this item for 20G 00S?');
    expect(legacy).toContain('"Do you want to sell this item for " + formattedBuyPrice + "?"');
    expect(legacy).toContain('"Do you want to buy this item for " + formattedSellPrice + "?"');
    expect(legacy).toContain(`"${TRADE_FOIL_QUESTION}"`);
  });
});
