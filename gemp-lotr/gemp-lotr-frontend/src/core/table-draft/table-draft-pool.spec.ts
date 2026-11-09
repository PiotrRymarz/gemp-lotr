import { mergePolledPool, sameChoices, samePlayers } from './table-draft-pool';

describe('table draft pool and pack', () => {
  const shown = [
    { blueprintId: '1_13', count: 2 },
    { blueprintId: '1_1', count: 1 },
  ];

  it('keeps the shown pool (the same array) when the server has the same cards, in any order', () => {
    const polled = [
      { blueprintId: '1_1', count: 1 },
      { blueprintId: '1_13', count: 2 },
    ];
    expect(mergePolledPool(shown, polled)).toBe(shown);
  });

  it('adds the one new copy at the end, so nothing moves', () => {
    const polled = [
      { blueprintId: '1_1', count: 2 },
      { blueprintId: '1_13', count: 2 },
    ];
    expect(mergePolledPool(shown, polled)).toEqual([...shown, { blueprintId: '1_1', count: 1 }]);
  });

  it("takes the server's pool when more than one copy is new", () => {
    const polled = [
      { blueprintId: '1_1', count: 1 },
      { blueprintId: '1_2', count: 1 },
      { blueprintId: '1_13', count: 3 },
    ];
    expect(mergePolledPool(shown, polled)).toBe(polled);
    const twoOfOne = [{ blueprintId: '1_1', count: 3 }, shown[0]];
    expect(mergePolledPool(shown, twoOfOne)).toBe(twoOfOne);
  });

  it("takes the server's pool when a card went away", () => {
    const polled = [
      { blueprintId: '1_13', count: 1 },
      { blueprintId: '1_1', count: 1 },
      { blueprintId: '1_2', count: 1 },
    ];
    expect(mergePolledPool(shown, polled)).toBe(polled);
  });

  it('compares packs card by card, declared card included', () => {
    const pack = [
      { id: '1_2', blueprintId: '1_2', url: null, chosen: false },
      { id: '1_3', blueprintId: '1_3', url: null, chosen: false },
    ];
    expect(
      sameChoices(
        pack,
        pack.map((choice) => ({ ...choice })),
      ),
    ).toBe(true);
    expect(sameChoices(pack, [pack[0]])).toBe(false);
    expect(sameChoices(pack, [pack[1], pack[0]])).toBe(false);
    expect(sameChoices(pack, [{ ...pack[0], chosen: true }, pack[1]])).toBe(false);
  });

  it('compares seats in order, with whether each has declared', () => {
    const seats = [
      { name: 'alice', hasChosen: false },
      { name: 'bob', hasChosen: true },
    ];
    expect(
      samePlayers(
        seats,
        seats.map((seat) => ({ ...seat })),
      ),
    ).toBe(true);
    expect(samePlayers(seats, [seats[1], seats[0]])).toBe(false);
    expect(samePlayers(seats, [{ ...seats[0], hasChosen: true }, seats[1]])).toBe(false);
  });
});
