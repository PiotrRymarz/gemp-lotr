import { inject, Injectable } from '@angular/core';
import { CardActions } from '../cards/card-actions';
import { CardInfoService } from '../cards/card-info.service';
import { CardRef } from '../cards/card-ref';

/**
 * What the merchant's cards do (merchantUi.clickCardFunction): using a card does nothing (buying, selling and the
 * foil trade have buttons of their own); asking for its details shows the card information.
 */
@Injectable()
export class MerchantCardActions implements CardActions {
  private readonly cardInfo = inject(CardInfoService);

  activate(): void {
    // Nothing, as in the legacy page
  }

  showInfo(ref: CardRef): void {
    this.cardInfo.show(ref);
  }
}
