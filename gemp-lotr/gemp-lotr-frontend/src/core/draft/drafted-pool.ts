import { DraftChoice, DraftedCard } from './draft-models';

/** The blueprint the legacy page created for a pick: the card itself, or "rules" for a pick shown by a picture. */
export const PICTURE_CHOICE_BLUEPRINT = 'rules';

export function choiceBlueprintId(choice: DraftChoice): string {
  return choice.blueprintId ?? PICTURE_CHOICE_BLUEPRINT;
}

/**
 * The pool after a pick: the picked cards come after what was drafted before, in the order the server gave them
 * (the legacy page appended their copies; the pool was only sorted when the page was loaded).
 */
export function addPicked(pool: readonly DraftedCard[], picked: readonly DraftedCard[]): DraftedCard[] {
  return [...pool, ...picked.filter((card) => card.count > 0)];
}

/** One entry per copy, in pool order (the legacy page drew a card per copy). */
export function draftedCopies(pool: readonly DraftedCard[]): string[] {
  return pool.flatMap((card) => Array.from({ length: card.count }, () => card.blueprintId));
}

/** How many copies of each card the pool holds, in order of first appearance (for the deck builder or a summary). */
export function poolCounts(pool: readonly DraftedCard[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of pool) {
    counts.set(card.blueprintId, (counts.get(card.blueprintId) ?? 0) + card.count);
  }
  return counts;
}

/** Total number of copies drafted. */
export function poolSize(pool: readonly DraftedCard[]): number {
  return pool.reduce((sum, card) => sum + card.count, 0);
}
