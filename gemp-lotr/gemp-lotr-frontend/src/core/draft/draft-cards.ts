import { CardImageService } from '../cards/card-image.service';
import { CardView } from '../cards/card-view';
import { DraftChoice } from './draft-models';
import { choiceBlueprintId } from './drafted-pool';

/** What the draft cards are drawn with. */
export interface DraftCardsOptions {
  images: CardImageService;
  /** Foil layer image for foil cards (from the player's foil setting), or null to show foils plain. */
  foilImage: string | null;
}

/**
 * The picks on offer as the legacy pages drew them (soloDraftUi / tableDraftUi): a card pick as its card (zone
 * "picks"), with its foil layer and errata marker; a pick shown by a picture as that picture, without a border, sized
 * as the "rules" card the legacy page created for it.
 */
export function choiceViews(choices: readonly DraftChoice[], { images, foilImage }: DraftCardsOptions): CardView[] {
  return choices.map((choice) => {
    const blueprintId = choiceBlueprintId(choice);
    const image = images.resolve(blueprintId, 'picks');
    const picture = choice.blueprintId === null;
    return {
      ref: { kind: 'draftChoice', blueprintId, choice },
      role: 'card',
      imageUrl: picture ? (choice.url ?? image.imageUrl) : image.imageUrl,
      horizontal: image.horizontal,
      errata: !picture && image.errata,
      foilImage: !picture && image.foil ? foilImage : null,
      border: !picture,
      count: null,
      overlayImage: null,
    };
  });
}

/** One card per drafted copy (draftedCopies), in pool order, drawn as the legacy pages did (zone "drafted"). */
export function draftedViews(copies: readonly string[], { images, foilImage }: DraftCardsOptions): CardView[] {
  return copies.map((blueprintId) => {
    const image = images.resolve(blueprintId, 'drafted');
    return {
      ref: { kind: 'drafted', blueprintId },
      role: 'card',
      imageUrl: image.imageUrl,
      horizontal: image.horizontal,
      errata: image.errata,
      foilImage: image.foil ? foilImage : null,
      border: true,
      count: null,
      overlayImage: null,
    };
  });
}
