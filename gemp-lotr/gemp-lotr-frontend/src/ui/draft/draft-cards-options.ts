import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { CardImageService } from '../../core/cards/card-image.service';
import { foilOverlayImage, readFoilPresentation } from '../../core/cards/foil-presentation';
import { DraftCardsOptions } from '../../core/draft/draft-cards';

/** How the draft cards are drawn: the card images, and the foil layer from the player's foil setting (cookie). */
export function injectDraftCardsOptions(): DraftCardsOptions {
  return {
    images: inject(CardImageService),
    foilImage: foilOverlayImage(readFoilPresentation(inject(DOCUMENT).cookie)),
  };
}
