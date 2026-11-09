import { inject, Injectable } from '@angular/core';
import { CardActions } from '../cards/card-actions';
import { CardInfoService } from '../cards/card-info.service';
import { CardRef } from '../cards/card-ref';
import { TableDraftService } from './table-draft.service';

/**
 * What the table draft's cards do (tableDraftUi.clickCardFunction): using a card of the pack declares it for the
 * pick; using a drafted card does nothing; asking for a card's details shows the card information.
 */
@Injectable()
export class TableDraftCardActions implements CardActions {
  private readonly draft = inject(TableDraftService);
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
