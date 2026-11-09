import { Provider } from '@angular/core';
import { CARD_ACTIONS } from '../cards/card-actions';
import { SoloDraftCardActions } from './solo-draft-card-actions';
import { SoloDraftService } from './solo-draft.service';

/**
 * The solo draft page's own state, for its route's providers. SoloDraftApi, GempHttp, the Notifier and
 * CardInfoService are app-wide. The shared cards reach SoloDraftCardActions through CARD_ACTIONS.
 */
export const SOLO_DRAFT_SERVICES: Provider[] = [
  SoloDraftService,
  SoloDraftCardActions,
  { provide: CARD_ACTIONS, useExisting: SoloDraftCardActions },
];
