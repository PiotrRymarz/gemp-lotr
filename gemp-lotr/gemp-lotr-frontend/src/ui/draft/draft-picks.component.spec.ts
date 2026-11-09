import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CARD_ACTIONS, CardActions } from '../../core/cards/card-actions';
import { CardImageService } from '../../core/cards/card-image.service';
import { CardRef } from '../../core/cards/card-ref';
import { DraftChoice } from '../../core/draft/draft-models';
import { DraftPicksComponent } from './draft-picks.component';

const CARD = (id: string): DraftChoice => ({ id, blueprintId: id, url: null });
const PICTURE: DraftChoice = { id: 'fp-elven', blueprintId: null, url: 'https://example.test/fp-elven.png' };

@Component({
  imports: [DraftPicksComponent],
  template: `<gd-draft-picks [choices]="choices()" />`,
})
class Host {
  readonly choices = signal<readonly (DraftChoice & { chosen?: boolean })[]>([CARD('1_2'), CARD('1_319'), PICTURE]);
}

describe('DraftPicksComponent', () => {
  let used: string[];

  beforeEach(() => {
    used = [];
    const actions: CardActions = {
      activate: (ref: CardRef) => used.push(`activate ${ref.kind} ${ref.blueprintId}`),
      showInfo: (ref: CardRef) => used.push(`info ${ref.kind} ${ref.blueprintId}`),
    };
    TestBed.configureTestingModule({ providers: [{ provide: CARD_ACTIONS, useValue: actions }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('gd-draft-picks')!;
    const cards = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.gd-draft-picks__cards > button.gd-card'));
    return { fixture, el, cards };
  }

  it('shows a card per pick on offer, in order, with its choice id', async () => {
    const { el, cards } = await render();
    expect(el.classList).toContain('gd-draft-picks');
    expect(el.dataset['count']).toBe('3');
    expect(cards().map((c) => c.dataset['choice'])).toEqual(['1_2', '1_319', 'fp-elven']);
    expect(cards()[0].querySelector('img')!.getAttribute('src')).toBe(
      TestBed.inject(CardImageService).resolve('1_2', 'picks').imageUrl,
    );
    expect(cards()[0].dataset['picture']).toBeUndefined();
  });

  it('shows a pick shown by a picture as that picture, without a border', async () => {
    const { cards } = await render();
    const picture = cards()[2];
    expect(picture.dataset['picture']).toBe('');
    expect(picture.dataset['borderless']).toBe('');
    expect(picture.querySelector('img')!.getAttribute('src')).toBe('https://example.test/fp-elven.png');
  });

  it('makes the pick on a click and shows its details on a shift-click or right-click', async () => {
    const { cards } = await render();
    cards()[0].click();
    cards()[1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    cards()[2].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(used).toEqual(['activate draftChoice 1_2', 'info draftChoice 1_319', 'info draftChoice rules']);
  });

  it('marks the cards declared for the pick (table draft), every copy', async () => {
    const { fixture, cards } = await render();
    expect(cards().map((c) => c.dataset['chosen'])).toEqual([undefined, undefined, undefined]);
    fixture.componentInstance.choices.set([
      { ...CARD('1_2'), chosen: true },
      { ...CARD('1_319'), chosen: false },
      { ...CARD('1_2'), chosen: true },
    ]);
    await fixture.whenStable();
    expect(cards().map((c) => c.dataset['chosen'])).toEqual(['', undefined, '']);
  });

  it('shows the picks of the moment (none while a pick is under way)', async () => {
    const { fixture, el, cards } = await render();
    fixture.componentInstance.choices.set([]);
    await fixture.whenStable();
    expect(cards()).toEqual([]);
    expect(el.dataset['count']).toBe('0');
  });
});
