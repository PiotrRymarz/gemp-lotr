import { DraftedCard } from '../draft/draft-models';
import { addPicked, poolCounts } from '../draft/drafted-pool';
import { TableDraftChoice, TableDraftPlayer } from './table-draft-models';

/**
 * The drafted pool to show after a poll, as tableDraftUi.processDraftStatus kept it: unchanged when the server's pool
 * holds the same cards (the same array, so nothing is redrawn); the shown pool with the one new copy added at the end
 * when that is the only change (so the cards do not move under the player after each pick); otherwise the server's
 * pool, in its order.
 */
export function mergePolledPool(shown: DraftedCard[], polled: DraftedCard[]): DraftedCard[] {
  const before = poolCounts(shown);
  const after = poolCounts(polled);
  let added: string | null = null;
  let addedCopies = 0;
  for (const [blueprintId, count] of after) {
    const difference = count - (before.get(blueprintId) ?? 0);
    if (difference > 0) {
      added = blueprintId;
      addedCopies += difference;
    }
  }
  const removed = [...before].some(([blueprintId, count]) => (after.get(blueprintId) ?? 0) < count);
  if (removed) {
    return polled;
  }
  if (addedCopies === 0) {
    return shown;
  }
  return addedCopies === 1 && added !== null ? addPicked(shown, [{ blueprintId: added, count: 1 }]) : polled;
}

/** The same pack, with the same card declared (the legacy page only redrew the picks when either changed). */
export function sameChoices(a: readonly TableDraftChoice[], b: readonly TableDraftChoice[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (choice, i) =>
        choice.id === b[i].id &&
        choice.blueprintId === b[i].blueprintId &&
        choice.url === b[i].url &&
        choice.chosen === b[i].chosen,
    )
  );
}

export function samePlayers(a: readonly TableDraftPlayer[], b: readonly TableDraftPlayer[]): boolean {
  return (
    a.length === b.length && a.every((player, i) => player.name === b[i].name && player.hasChosen === b[i].hasChosen)
  );
}
