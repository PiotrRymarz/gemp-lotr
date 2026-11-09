/**
 * What the solo draft and the table draft share: the picks on offer and the cards drafted so far. Both servers write
 * the same <availablePick> and <pickedCard> elements (SoloDraftRequestHandler, TableDraftRequestHandler).
 */

/** One pick on offer (<availablePick id blueprintId url>). */
export interface DraftChoice {
  /** What is sent back as choiceId when this pick is made. */
  id: string;
  /** The card offered; null when the pick is a whole set of cards shown by a picture (`url`). */
  blueprintId: string | null;
  /** The picture of a pick that is not a single card (the legacy page drew it as a "rules" card with this image). */
  url: string | null;
}

/** Copies of one card in the drafted pool (<pickedCard blueprintId count>, or a <card> of the draft collection). */
export interface DraftedCard {
  blueprintId: string;
  count: number;
}

/** What a pick gave and what is offered next (<pickResult>); no choices = the draft is finished. */
export interface PickResult {
  picked: DraftedCard[];
  choices: DraftChoice[];
}
