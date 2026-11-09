import { formatTimeRemaining, MAKE_A_PICK, withRoundAndTime } from './table-draft-messages';

describe('table draft messages', () => {
  it('formats the time left as m:ss, and a timer past its end as 0:00', () => {
    expect(formatTimeRemaining(65)).toBe('1:05');
    expect(formatTimeRemaining(600)).toBe('10:00');
    expect(formatTimeRemaining(9)).toBe('0:09');
    expect(formatTimeRemaining(-3)).toBe('0:00');
  });

  it('adds the pack and the time left, each when given', () => {
    expect(withRoundAndTime(MAKE_A_PICK, { current: 1, total: 3 }, 65)).toBe('Make a pick - Pack 1/3 (1:05)');
    expect(withRoundAndTime(MAKE_A_PICK, { current: 2, total: 3 }, null)).toBe('Make a pick - Pack 2/3');
    expect(withRoundAndTime(MAKE_A_PICK, null, 5)).toBe('Make a pick (0:05)');
    expect(withRoundAndTime(MAKE_A_PICK, null, null)).toBe('Make a pick');
  });
});
