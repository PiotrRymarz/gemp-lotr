import { inject, Injectable } from '@angular/core';
import { CardActions } from '../cards/card-actions';
import { CardInfoService } from '../cards/card-info.service';
import { CardRef } from '../cards/card-ref';
import { SoloDraftService } from './solo-draft.service';

/**
 * What the solo draft's cards do (soloDraftUi.clickCardFunction): using a pick on offer makes that pick; using a
 * drafted card does nothing; asking for a card's details shows the card information.
 */
@Injectable()
export class SoloDraftCardActions implements CardActions {
  private readonly draft = inject(SoloDraftService);
  private readonly cardInfo = inject(CardInfoService);

  activate(ref: CardRef): void {
    if (ref.kind === 'draftChoice') {
      void this.draft.pick(ref.choice);
    }
  }

  showInfo(ref: CardRef): void {
    this.cardInfo.show(ref);
  }
}
