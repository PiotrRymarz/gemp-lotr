import { CollectionItem } from '../api/models';
import { attr, childElements, intAttr, requiredAttr } from '../api/xml';
import { DraftChoice, DraftedCard } from './draft-models';

/** The <availablePick id [blueprintId] [url]/> children of a draft answer, in server order. */
export function parseDraftChoices(root: Element): DraftChoice[] {
  return childElements(root, 'availablePick').map((pick) => ({
    id: requiredAttr(pick, 'id'),
    blueprintId: attr(pick, 'blueprintId'),
    url: attr(pick, 'url'),
  }));
}

/** The <pickedCard blueprintId count/> children of a draft answer, in server order (copies without a count: none). */
export function parsePickedCards(root: Element): DraftedCard[] {
  return childElements(root, 'pickedCard')
    .map((card) => ({ blueprintId: requiredAttr(card, 'blueprintId'), count: intAttr(card, 'count', 0) }))
    .filter((card) => card.count > 0);
}

/** The cards of a draft collection page (GET /collection/{eventId}); packs are left out, as the legacy page did. */
export function draftedCardsOf(items: readonly CollectionItem[]): DraftedCard[] {
  return items
    .filter((item) => item.kind === 'card' && item.count > 0)
    .map((item) => ({ blueprintId: item.blueprintId, count: item.count }));
}
