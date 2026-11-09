import { readServerXml } from '../../testing/files';
import { parseXml } from '../api/xml';
import { parseTableDraftStatus } from './table-draft-parsers';

describe('parseTableDraftStatus', () => {
  it('reads the seats, pass direction, pool, pack, timer and round', () => {
    expect(parseTableDraftStatus(readServerXml('table-draft-status.xml').documentElement)).toEqual({
      players: [
        { name: 'alice', hasChosen: false },
        { name: 'bob', hasChosen: true },
        { name: 'carol', hasChosen: false },
      ],
      pickOrderAscending: true,
      drafted: [
        { blueprintId: '1_1', count: 1 },
        { blueprintId: '1_13', count: 2 },
      ],
      choices: [
        { id: '1_2', blueprintId: '1_2', url: null, chosen: false },
        { id: '1_45*', blueprintId: '1_45*', url: null, chosen: false },
        { id: '1_2', blueprintId: '1_2', url: null, chosen: false },
      ],
      secondsRemaining: 65,
      round: { current: 1, total: 3 },
    });
  });

  it('marks the declared card, every copy of it', () => {
    const status = parseTableDraftStatus(readServerXml('table-draft-chosen.xml').documentElement);
    expect(status.choices.map((choice) => choice.chosen)).toEqual([true, false, true]);
  });

  it('reads a draft without timer, passing the other way', () => {
    const status = parseTableDraftStatus(readServerXml('table-draft-next-pick.xml').documentElement);
    expect(status.secondsRemaining).toBeNull();
    expect(status.pickOrderAscending).toBe(false);
    expect(status.round).toEqual({ current: 2, total: 3 });
  });

  it('reads a finished draft as no pack on offer', () => {
    const status = parseTableDraftStatus(readServerXml('table-draft-finished.xml').documentElement);
    expect(status.choices).toEqual([]);
    expect(status.drafted).toHaveLength(4);
  });

  it('passes packs down the list and has no round or timer when the server leaves them out', () => {
    const status = parseTableDraftStatus(parseXml('<draftStatus><timeRemaining/></draftStatus>').documentElement);
    expect(status).toEqual({
      players: [],
      pickOrderAscending: true,
      drafted: [],
      choices: [],
      secondsRemaining: null,
      round: null,
    });
  });

  it('keeps a timer past its end as the server gives it', () => {
    const doc = parseXml('<draftStatus><timeRemaining value="-2"/></draftStatus>');
    expect(parseTableDraftStatus(doc.documentElement).secondsRemaining).toBe(-2);
  });
});
