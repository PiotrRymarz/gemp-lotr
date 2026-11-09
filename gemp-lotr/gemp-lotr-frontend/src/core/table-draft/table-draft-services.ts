import { Provider } from '@angular/core';
import { CARD_ACTIONS } from '../cards/card-actions';
import { TableDraftCardActions } from './table-draft-card-actions';
import { TableDraftService } from './table-draft.service';

/**
 * The table draft page's own state, for its route's providers. TableDraftApi, GempHttp, the Notifier, IntervalTimer
 * and CardInfoService are app-wide. The shared cards reach TableDraftCardActions through CARD_ACTIONS.
 */
export const TABLE_DRAFT_SERVICES: Provider[] = [
  TableDraftService,
  TableDraftCardActions,
  { provide: CARD_ACTIONS, useExisting: TableDraftCardActions },
];
