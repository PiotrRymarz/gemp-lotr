import { attr, boolAttr, childElements, firstChild, intAttr } from '../api/xml';
import { parseDraftChoices, parsePickedCards } from '../draft/draft-parsers';
import { TableDraftStatus } from './table-draft-models';

/** A <draftStatus> answer (TableDraftClassic.getDocument), read as tableDraftUi.processDraftStatus read it. */
export function parseTableDraftStatus(root: Element): TableDraftStatus {
  const picks = childElements(root, 'availablePick');
  const order = firstChild(root, 'pickOrderAscending');
  const time = firstChild(root, 'timeRemaining');
  const rounds = firstChild(root, 'roundsInfo');
  return {
    players: childElements(root, 'player').map((player) => ({
      name: attr(player, 'name') ?? '',
      hasChosen: boolAttr(player, 'hasChosen'),
    })),
    pickOrderAscending: order === null || boolAttr(order, 'value'),
    drafted: parsePickedCards(root),
    choices: parseDraftChoices(root).map((choice, i) => ({ ...choice, chosen: boolAttr(picks[i], 'chosen') })),
    secondsRemaining: time && attr(time, 'value') !== null ? intAttr(time, 'value', 0) : null,
    round: rounds ? { current: intAttr(rounds, 'currentRound', 0), total: intAttr(rounds, 'roundsTotal', 0) } : null,
  };
}
