import { Provider } from '@angular/core';
import { CARD_ACTIONS } from '../cards/card-actions';
import { MerchantCardActions } from './merchant-card-actions';
import { MerchantService } from './merchant.service';

/**
 * The merchant page's own state, for its route's providers. MerchantApi, GempHttp, the Notifier, CardImageService and
 * CardInfoService are app-wide. The shared cards reach MerchantCardActions through CARD_ACTIONS.
 */
export const MERCHANT_SERVICES: Provider[] = [
  MerchantService,
  MerchantCardActions,
  { provide: CARD_ACTIONS, useExisting: MerchantCardActions },
];
