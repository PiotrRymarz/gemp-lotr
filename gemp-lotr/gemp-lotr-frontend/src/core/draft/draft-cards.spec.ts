import { TestBed } from '@angular/core/testing';
import { CardImageService } from '../cards/card-image.service';
import { choiceViews, draftedViews } from './draft-cards';
import { DraftChoice } from './draft-models';

describe('draft cards', () => {
  let images: CardImageService;

  beforeEach(() => (images = TestBed.inject(CardImageService)));

  const card = (id: string): DraftChoice => ({ id, blueprintId: id, url: null });
  const picture: DraftChoice = { id: 'fp-elven', blueprintId: null, url: 'https://example.test/fp-elven.png' };

  it('draws a card pick as its card, with its foil layer, and keeps the choice in its ref', () => {
    const [plain, foil, site] = choiceViews([card('1_2'), card('1_45*'), card('1_319')], {
      images,
      foilImage: '/holo.jpg',
    });
    expect(plain.ref).toEqual({ kind: 'draftChoice', blueprintId: '1_2', choice: card('1_2') });
    expect(plain).toMatchObject({
      role: 'card',
      imageUrl: images.resolve('1_2', 'picks').imageUrl,
      horizontal: false,
      foilImage: null,
      border: true,
      count: null,
    });
    expect(foil.foilImage).toBe('/holo.jpg');
    expect(site.horizontal).toBe(images.resolve('1_319', 'picks').horizontal);
  });

  it('shows foils plain when the player turned the foil layer off', () => {
    expect(choiceViews([card('1_45*')], { images, foilImage: null })[0].foilImage).toBeNull();
  });

  it('draws a picture pick as its picture, without a border, as the legacy "rules" card', () => {
    const [view] = choiceViews([picture], { images, foilImage: '/holo.jpg' });
    expect(view).toMatchObject({
      ref: { kind: 'draftChoice', blueprintId: 'rules', choice: picture },
      imageUrl: 'https://example.test/fp-elven.png',
      border: false,
      errata: false,
      foilImage: null,
    });
  });

  it('draws one card per drafted copy, in order', () => {
    const views = draftedViews(['1_1', '1_13', '1_13*'], { images, foilImage: '/holo.jpg' });
    expect(views.map((v) => v.ref)).toEqual([
      { kind: 'drafted', blueprintId: '1_1' },
      { kind: 'drafted', blueprintId: '1_13' },
      { kind: 'drafted', blueprintId: '1_13*' },
    ]);
    expect(views.map((v) => v.foilImage)).toEqual([null, null, '/holo.jpg']);
    expect(views.every((v) => v.border && v.count === null)).toBe(true);
  });
});
