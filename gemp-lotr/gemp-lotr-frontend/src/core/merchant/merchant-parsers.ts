import { attr, boolAttr, intAttr, parseXml, requiredAttr, rootElement } from '../api/xml';
import { MerchantItem, MerchantPage } from './merchant-models';

/**
 * <merchant currency count><card|pack blueprintId count [buyPrice] [sellPrice] [tradeFoil]/>*</merchant>
 * (MerchantRequestHandler.getMerchantOffers). Any other root is an empty page, as the legacy page showed nothing then.
 */
export function parseMerchantPage(doc: Document): MerchantPage {
  const root = rootElement(doc, 'merchant');
  if (!root) {
    return { currency: 0, total: 0, items: [] };
  }
  const items = Array.from(root.children)
    .filter((element) => element.tagName === 'card' || element.tagName === 'pack')
    .map((element): MerchantItem => ({
      kind: element.tagName === 'pack' ? 'pack' : 'card',
      blueprintId: requiredAttr(element, 'blueprintId'),
      owned: intAttr(element, 'count', 0),
      buyPrice: priceAttr(element, 'buyPrice'),
      sellPrice: priceAttr(element, 'sellPrice'),
      tradeFoil: boolAttr(element, 'tradeFoil'),
    }));
  return { currency: intAttr(root, 'currency', 0), total: intAttr(root, 'count', 0), items };
}

function priceAttr(element: Element, name: string): number | null {
  const value = attr(element, name);
  if (value === null || value === '') {
    return null;
  }
  const price = parseInt(value, 10);
  return Number.isNaN(price) ? null : price;
}

/**
 * The answer to POST /merchant/buy, /sell or /tradeFoil: "OK", or (still with status 200) <error message="..."/> when
 * the merchant refused. Gives the refusal's message, '' when it has none, or null for success.
 */
export function merchantRefusal(body: string): string | null {
  if (!body.trimStart().startsWith('<')) {
    return null;
  }
  let root: Element | null;
  try {
    root = rootElement(parseXml(body), 'error');
  } catch {
    return null;
  }
  if (!root) {
    return null;
  }
  const message = attr(root, 'message');
  return message === null || message === 'null' ? '' : message;
}
