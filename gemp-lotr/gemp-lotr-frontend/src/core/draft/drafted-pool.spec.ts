import { addPicked, choiceBlueprintId, draftedCopies, poolCounts, poolSize } from './drafted-pool';

describe('drafted pool', () => {
  const pool = [
    { blueprintId: '1_1', count: 1 },
    { blueprintId: '1_13', count: 2 },
  ];

  it('adds the picked cards after the drafted ones, even a card already drafted', () => {
    expect(
      addPicked(pool, [
        { blueprintId: '1_1', count: 1 },
        { blueprintId: '1_9', count: 0 },
      ]),
    ).toEqual([...pool, { blueprintId: '1_1', count: 1 }]);
    expect(pool).toHaveLength(2);
  });

  it('lists one entry per copy, in pool order', () => {
    expect(draftedCopies([...pool, { blueprintId: '1_1', count: 1 }])).toEqual(['1_1', '1_13', '1_13', '1_1']);
    expect(draftedCopies([])).toEqual([]);
  });

  it('counts copies per card and in all', () => {
    const all = [...pool, { blueprintId: '1_1', count: 2 }];
    expect([...poolCounts(all)]).toEqual([
      ['1_1', 3],
      ['1_13', 2],
    ]);
    expect(poolSize(all)).toBe(5);
    expect(poolSize([])).toBe(0);
  });

  it('draws a pick shown by a picture as the "rules" card, as the legacy page did', () => {
    expect(choiceBlueprintId({ id: '1_2', blueprintId: '1_2', url: null })).toBe('1_2');
    expect(choiceBlueprintId({ id: 'x', blueprintId: null, url: '/x.png' })).toBe('rules');
  });
});
