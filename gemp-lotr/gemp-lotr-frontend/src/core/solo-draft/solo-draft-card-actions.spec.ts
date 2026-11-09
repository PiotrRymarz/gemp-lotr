import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideFakeNotifier } from '../../testing/fake-notifier';
import { CARD_ACTIONS } from '../cards/card-actions';
import { CardInfoService } from '../cards/card-info.service';
import { CardRef, zoneOf } from '../cards/card-ref';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { SoloDraftCardActions } from './solo-draft-card-actions';
import { SOLO_DRAFT_SERVICES } from './solo-draft-services';
import { SoloDraftService } from './solo-draft.service';

describe('SoloDraftCardActions', () => {
  const choice = { id: '1_2', blueprintId: '1_2', url: null };
  const choiceRef: CardRef = { kind: 'draftChoice', blueprintId: '1_2', choice };
  const draftedRef: CardRef = { kind: 'drafted', blueprintId: '1_13' };
  let pick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        ...SOLO_DRAFT_SERVICES,
        { provide: PAGE_QUERY_STRING, useValue: '?eventId=20261101' },
      ],
    });
    pick = vi.spyOn(TestBed.inject(SoloDraftService), 'pick').mockResolvedValue();
  });

  it('is the route services’ CARD_ACTIONS', () => {
    expect(TestBed.inject(CARD_ACTIONS)).toBe(TestBed.inject(SoloDraftCardActions));
  });

  it('makes the pick when a pick on offer is used', () => {
    TestBed.inject(CARD_ACTIONS).activate(choiceRef);
    expect(pick).toHaveBeenCalledWith(choice);
  });

  it('does nothing when a drafted card is used', () => {
    TestBed.inject(CARD_ACTIONS).activate(draftedRef);
    expect(pick).not.toHaveBeenCalled();
  });

  it('shows the card information of either', () => {
    const info = TestBed.inject(CardInfoService);
    TestBed.inject(CARD_ACTIONS).showInfo(choiceRef);
    expect(info.card()).toBe(choiceRef);
    TestBed.inject(CARD_ACTIONS).showInfo(draftedRef);
    expect(info.card()).toBe(draftedRef);
    expect(pick).not.toHaveBeenCalled();
  });

  it('gives the zones the legacy page created the cards with', () => {
    expect(zoneOf(choiceRef)).toBe('picks');
    expect(zoneOf(draftedRef)).toBe('drafted');
  });
});
