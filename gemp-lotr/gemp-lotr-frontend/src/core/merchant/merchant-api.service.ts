import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FormData } from '../api/form-codec';
import { GempHttp } from '../api/gemp-http.service';
import { MerchantPage } from './merchant-models';
import { merchantRefusal, parseMerchantPage } from './merchant-parsers';

/** The merchant said no (the call itself worked): its message, e.g. "Unable to remove required currency ...". */
export class MerchantRefusedError extends Error {
  constructor(readonly serverMessage: string) {
    super(`The merchant refused: ${serverMessage}`);
    this.name = 'MerchantRefusedError';
  }
}

/**
 * The merchant's server calls (MerchantRequestHandler), as the legacy communication.js made them (named in each
 * comment). participantId is added by GempHttp. Failed calls arrive as ApiError; a refused operation (answered with
 * status 200 and <error message>) as MerchantRefusedError.
 */
@Injectable({ providedIn: 'root' })
export class MerchantApi {
  private readonly http = inject(GempHttp);

  /**
   * getMerchant: a page of what the merchant trades and the player owns. ownedMin 0 lists everything the merchant
   * sells plus the player's cards; above 0 only the player's items with at least that many copies.
   */
  getOffers(filter: string, ownedMin: number, start: number, count: number): Observable<MerchantPage> {
    return this.http.getXml('/merchant', { filter, ownedMin, start, count }).pipe(map(parseMerchantPage));
  }

  /** buyItem: the player buys one copy for `price` (the item's sellPrice). */
  buy(blueprintId: string, price: number): Observable<void> {
    return this.operation('/merchant/buy', { blueprintId, price });
  }

  /** sellItem: the player sells one copy for `price` (the item's buyPrice). */
  sell(blueprintId: string, price: number): Observable<void> {
    return this.operation('/merchant/sell', { blueprintId, price });
  }

  /** tradeInFoil: 4 copies and 4G (400 silver) for one foil copy. */
  tradeFoil(blueprintId: string): Observable<void> {
    return this.operation('/merchant/tradeFoil', { blueprintId });
  }

  private operation(path: string, data: FormData): Observable<void> {
    return this.http.postText(path, data).pipe(
      map((body) => {
        const refusal = merchantRefusal(body);
        if (refusal !== null) {
          throw new MerchantRefusedError(refusal);
        }
      }),
    );
  }
}
