import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiError, INVALID_RESPONSE_STATUS } from '../api/api-error';
import { GempHttp } from '../api/gemp-http.service';
import { parseCollectionPage } from '../api/parsers';
import { rootElement } from '../api/xml';
import { DraftChoice, DraftedCard, PickResult } from '../draft/draft-models';
import { draftedCardsOf, parseDraftChoices, parsePickedCards } from '../draft/draft-parsers';

/** How the legacy page asked for the drafted cards: sorted by the server, all of them in one page. */
export const DRAFTED_CARDS_SORT = 'sort:cardType,culture,name';
export const DRAFTED_CARDS_COUNT = 1000;

/**
 * The solo draft's server calls (SoloDraftRequestHandler, and the draft collection from CollectionRequestHandler),
 * as the legacy communication.js made them (named in each comment). participantId is added by GempHttp; none is
 * cached. Failed calls arrive as ApiError: 404 = no such live solo draft league (or it has not started) or tournament
 * (or it is past deck building), or, for a pick, the draft is finished; 400 = the choice is not on offer.
 */
@Injectable({ providedIn: 'root' })
export class SoloDraftApi {
  private readonly http = inject(GempHttp);

  /** getDraft: the picks on offer (<availablePicks>); none once the draft is finished. */
  getChoices(eventId: string): Observable<DraftChoice[]> {
    return this.http.getXml(this.draftPath(eventId)).pipe(
      map((doc) => {
        const root = rootElement(doc, 'availablePicks');
        return root ? parseDraftChoices(root) : [];
      }),
    );
  }

  /** makeDraftPick: the cards the pick gave and the next picks (<pickResult>); no next picks after the last one. */
  pick(eventId: string, choiceId: string): Observable<PickResult> {
    return this.http.postXml(this.draftPath(eventId), { choiceId }).pipe(
      map((doc) => {
        const root = rootElement(doc, 'pickResult');
        if (!root) {
          // Another root would read as "finished"; the legacy page ignored it and showed nothing
          throw new ApiError(INVALID_RESPONSE_STATUS, 'Unexpected answer to a draft pick');
        }
        return { picked: parsePickedCards(root), choices: parseDraftChoices(root) };
      }),
    );
  }

  /** getCollection(eventId, "sort:cardType,culture,name", 0, 1000): the cards drafted so far. */
  getDraftedCards(eventId: string): Observable<DraftedCard[]> {
    return this.http
      .getXml(`/collection/${eventId}`, {
        filter: DRAFTED_CARDS_SORT,
        start: 0,
        count: DRAFTED_CARDS_COUNT,
      })
      .pipe(map((doc) => draftedCardsOf(parseCollectionPage(doc).items)));
  }

  /** Not encoded, as in the legacy page: the server takes the id from the raw path, without decoding it. */
  private draftPath(eventId: string): string {
    return `/soloDraft/${eventId}`;
  }
}
