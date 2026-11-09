import { readServerXml } from '../../testing/files';
import { parseCollectionPage } from '../api/parsers';
import { draftedCardsOf, parseDraftChoices, parsePickedCards } from './draft-parsers';

const root = (name: string) => readServerXml(name).documentElement;
const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml').documentElement;

describe('draft parsers', () => {
  it('reads card picks in server order, the blueprint as id', () => {
    expect(parseDraftChoices(root('solo-draft-picks.xml'))).toEqual([
      { id: '1_2', blueprintId: '1_2', url: null },
      { id: '1_45*', blueprintId: '1_45*', url: null },
      { id: '1_319', blueprintId: '1_319', url: null },
    ]);
  });

  it('reads picks shown by a picture (no blueprint, a url)', () => {
    expect(parseDraftChoices(root('solo-draft-picture-picks.xml'))).toEqual([
      { id: 'fp-elven', blueprintId: null, url: '/gemp-lotr/images/draft/fp-elven.png' },
      { id: 'fp-dwarven', blueprintId: null, url: '/gemp-lotr/images/draft/fp-dwarven.png' },
    ]);
  });

  it('reads no picks once the draft is finished', () => {
    expect(parseDraftChoices(root('solo-draft-finished.xml'))).toEqual([]);
  });

  it('reads the picked cards and the next picks of a pick result', () => {
    const result = root('solo-draft-pick-result.xml');
    expect(parsePickedCards(result)).toEqual([{ blueprintId: '1_2', count: 1 }]);
    expect(parseDraftChoices(result).map((choice) => choice.id)).toEqual(['1_7', '1_12']);
  });

  it('reads the last pick result: several cards, no next picks', () => {
    const result = root('solo-draft-last-pick-result.xml');
    expect(parsePickedCards(result)).toEqual([
      { blueprintId: '1_30', count: 2 },
      { blueprintId: '1_31', count: 1 },
    ]);
    expect(parseDraftChoices(result)).toEqual([]);
  });

  it('leaves out picked cards without copies, and only reads direct children', () => {
    const result = xml(
      '<pickResult><pickedCard blueprintId="1_1" count="0"/><pickedCard blueprintId="1_2"/>' +
        '<x><pickedCard blueprintId="1_3" count="1"/><availablePick id="a"/></x></pickResult>',
    );
    expect(parsePickedCards(result)).toEqual([]);
    expect(parseDraftChoices(result)).toEqual([]);
  });

  it('takes the cards of a draft collection, in server order, without packs', () => {
    const page = parseCollectionPage(readServerXml('solo-draft-collection.xml'));
    expect(draftedCardsOf(page.items)).toEqual([
      { blueprintId: '1_1', count: 1 },
      { blueprintId: '1_13', count: 2 },
      { blueprintId: '1_178', count: 1 },
    ]);
    const withPacks = parseCollectionPage(readServerXml('collection-with-packs.xml'));
    expect(draftedCardsOf(withPacks.items).every((card) => !card.blueprintId.includes(' '))).toBe(true);
  });
});
