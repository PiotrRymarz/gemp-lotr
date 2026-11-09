import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiError, INVALID_RESPONSE_STATUS } from '../api/api-error';
import { GempHttp } from '../api/gemp-http.service';
import { rootElement } from '../api/xml';
import { TableDraftStatus } from './table-draft-models';
import { parseTableDraftStatus } from './table-draft-parsers';

/**
 * The table draft's server calls (TableDraftRequestHandler), as the legacy communication.js made them (named in each
 * comment). participantId is added by GempHttp; none is cached. Both answer the player's <draftStatus>. Failed calls
 * arrive as ApiError: 404 = no such live table draft tournament in its draft stage (or solo table draft in deck
 * building / registration), leagues included, or, for a pick, the draft is finished; 400 = the card is not on offer.
 */
@Injectable({ providedIn: 'root' })
export class TableDraftApi {
  private readonly http = inject(GempHttp);

  /** getTableDraft: where the draft is. Null for another root (the legacy page ignored it). */
  getStatus(eventId: string): Observable<TableDraftStatus | null> {
    return this.http.getXml(this.draftPath(eventId)).pipe(
      map((doc) => {
        const root = rootElement(doc, 'draftStatus');
        return root ? parseTableDraftStatus(root) : null;
      }),
    );
  }

  /**
   * makeTableDraftPick: declares the card for this pick (the pick is made once every player has declared one; until
   * then it can be changed) and answers where the draft is then.
   */
  pick(eventId: string, choiceId: string): Observable<TableDraftStatus> {
    return this.http.postXml(this.draftPath(eventId), { choiceId }).pipe(
      map((doc) => {
        const root = rootElement(doc, 'draftStatus');
        if (!root) {
          throw new ApiError(INVALID_RESPONSE_STATUS, 'Unexpected answer to a table draft pick');
        }
        return parseTableDraftStatus(root);
      }),
    );
  }

  /** Not encoded, as in the legacy page: the server takes the id from the raw path, without decoding it. */
  private draftPath(eventId: string): string {
    return `/tableDraft/${eventId}`;
  }
}
