import { readServerResponse, readServerXml } from '../../testing/files';
import { merchantRefusal, parseMerchantPage } from './merchant-parsers';

describe('merchant parsers', () => {
  it('reads a page of offers, in server order', () => {
    expect(parseMerchantPage(readServerXml('merchant.xml'))).toEqual({
      currency: 1234,
      total: 57,
      items: [
        { kind: 'card', blueprintId: '1_1', owned: 5, buyPrice: 150, sellPrice: 420, tradeFoil: true },
        { kind: 'pack', blueprintId: 'FotR - Booster', owned: 0, buyPrice: null, sellPrice: 300, tradeFoil: false },
        { kind: 'card', blueprintId: '1_2*', owned: 1, buyPrice: 900, sellPrice: null, tradeFoil: false },
        { kind: 'card', blueprintId: '1_3', owned: 0, buyPrice: null, sellPrice: 2000, tradeFoil: false },
        { kind: 'card', blueprintId: '1_319', owned: 2, buyPrice: 7, sellPrice: 1234, tradeFoil: false },
      ],
    });
  });

  it('reads another root as an empty page', () => {
    const doc = new DOMParser().parseFromString('<collection count="3"/>', 'application/xml');
    expect(parseMerchantPage(doc)).toEqual({ currency: 0, total: 0, items: [] });
  });

  it('tells a refusal from success', () => {
    expect(merchantRefusal(readServerResponse('merchant-ok.txt'))).toBeNull();
    expect(merchantRefusal('')).toBeNull();
    expect(merchantRefusal(readServerResponse('merchant-error.xml'))).toBe(
      'Unable to remove required currency from your collection',
    );
    expect(merchantRefusal('<error/>')).toBe('');
    expect(merchantRefusal('<error message="null"/>')).toBe('');
    expect(merchantRefusal('<result>OK</result>')).toBeNull();
    expect(merchantRefusal('<not xml')).toBeNull();
  });
});
