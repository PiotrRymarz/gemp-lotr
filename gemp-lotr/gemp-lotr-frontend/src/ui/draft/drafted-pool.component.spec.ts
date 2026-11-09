import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CARD_ACTIONS, CardActions } from '../../core/cards/card-actions';
import { CardRef } from '../../core/cards/card-ref';
import { DraftedPoolComponent, NOTHING_DRAFTED } from './drafted-pool.component';

@Component({
  imports: [DraftedPoolComponent],
  template: `<gd-drafted-pool [copies]="copies()" />`,
})
class Host {
  readonly copies = signal<readonly string[]>(['1_1', '1_13', '1_13']);
}

describe('DraftedPoolComponent', () => {
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
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('gd-drafted-pool')!;
    const cards = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.gd-drafted-pool__cards > button.gd-card'));
    return { fixture, el, cards };
  }

  it('shows a card per drafted copy, in order', async () => {
    const { el, cards } = await render();
    expect(el.classList).toContain('gd-drafted-pool');
    expect(el.dataset['count']).toBe('3');
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['1_1', '1_13', '1_13']);
    expect(el.querySelector('.gd-drafted-pool__empty')).toBeNull();
  });

  it('hands clicks and detail requests to the page as drafted cards', async () => {
    const { cards } = await render();
    cards()[0].click();
    cards()[1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    expect(used).toEqual(['activate drafted 1_1', 'info drafted 1_13']);
  });

  it('says when nothing is drafted yet, and adds the copies of a pick after the others', async () => {
    const { fixture, el, cards } = await render();
    fixture.componentInstance.copies.set([]);
    await fixture.whenStable();
    expect(cards()).toEqual([]);
    expect(el.querySelector('.gd-drafted-pool__empty')!.textContent).toBe(NOTHING_DRAFTED);
    fixture.componentInstance.copies.set(['1_30', '1_30']);
    await fixture.whenStable();
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['1_30', '1_30']);
  });
});
