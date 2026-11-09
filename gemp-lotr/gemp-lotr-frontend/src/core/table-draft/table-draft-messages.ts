/** The table draft page's wording (tableDraftUi.js). "Make a pick" and "Draft is finished" are shared (core/draft). */
import { TableDraftRound } from './table-draft-models';

export { DRAFT_FINISHED, MAKE_A_PICK } from '../draft/draft-messages';

/** Shown once the player has declared a card and the others have not all done so. */
export const WAITING_FOR_OTHERS = 'Waiting for others to pick a card';

/** What the legacy page wrote in the chat when a call failed (processError); polling stops then. */
export const CONNECTION_LOST: readonly string[] = [
  'There was a problem communicating with the server, if the draft is finished, table has been removed, otherwise you have lost connection to the server.',
  'Refresh the page (press F5) to resume the draft, or press back on your browser to get back to the Game Hall.',
];

/** Shown when the page was opened without ?eventId= (the legacy page asked for /tableDraft/null). */
export const NO_TABLE_DRAFT_EVENT = 'No draft was chosen: open this page from the hall.';

/** Seconds as m:ss (formatTime); a timer past its end shows 0:00. */
export function formatTimeRemaining(seconds: number): string {
  const left = Math.max(0, Math.floor(seconds));
  const secs = left % 60;
  return `${Math.floor(left / 60)}:${secs < 10 ? '0' : ''}${secs}`;
}

/** "Make a pick - Pack 1/3 (1:05)": the line with the pack and the time left, each when the server gives it. */
export function withRoundAndTime(line: string, round: TableDraftRound | null, secondsRemaining: number | null): string {
  let result = line;
  if (round !== null) {
    result += ` - Pack ${round.current}/${round.total}`;
  }
  if (secondsRemaining !== null) {
    result += ` (${formatTimeRemaining(secondsRemaining)})`;
  }
  return result;
}
