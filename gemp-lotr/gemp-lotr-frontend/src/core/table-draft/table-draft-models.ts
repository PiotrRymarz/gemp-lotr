import { DraftChoice, DraftedCard } from '../draft/draft-models';

/** A pick on offer at the table (<availablePick id blueprintId [chosen]>). */
export interface TableDraftChoice extends DraftChoice {
  /** The player has declared this card for the pick and waits for the others (draft-highlight). */
  chosen: boolean;
}

/** A seat at the table (<player name hasChosen>), in table order. */
export interface TableDraftPlayer {
  name: string;
  /** The player has declared a card for the current pick. */
  hasChosen: boolean;
}

/** The pack being drafted (<roundsInfo currentRound roundsTotal>): "Pack 1/3". */
export interface TableDraftRound {
  current: number;
  total: number;
}

/** What the server says about the draft (<draftStatus>), for the player asking. */
export interface TableDraftStatus {
  /** Seats in table order. */
  players: TableDraftPlayer[];
  /** Packs pass down the list (" > ") when true, up it (" < ") when false; true when the server leaves it out. */
  pickOrderAscending: boolean;
  /** The player's drafted pool, sorted by the server (sort:cardType,culture,name). */
  drafted: DraftedCard[];
  /** The pack on offer, in server order; the same card can be on offer twice. Empty once the draft is finished. */
  choices: TableDraftChoice[];
  /** Seconds left for this pick, for a timed draft; null without a timer. */
  secondsRemaining: number | null;
  round: TableDraftRound | null;
}
