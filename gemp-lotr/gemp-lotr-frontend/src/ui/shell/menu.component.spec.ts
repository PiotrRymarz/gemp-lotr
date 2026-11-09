import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuComponent } from './menu.component';
import { HALL_HREF, ShellLink } from './shell-links';

/** Two links, a legacy page and an app page (the arrow keys' wrapping below counts on two) */
const LINKS: readonly ShellLink[] = [
  { page: 'hall', label: 'Game Hall', href: HALL_HREF },
  { page: 'deckbuilder', label: 'Deck Builder', route: '/deckbuilder' },
];

@Component({ template: '' })
class PageComponent {}

@Component({
  imports: [MenuComponent],
  template: `<gd-menu [links]="links" current="deckbuilder" /><button type="button" class="outside">Elsewhere</button>`,
})
class HostComponent {
  readonly links = LINKS;
}

describe('MenuComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'deckbuilder', component: PageComponent }])] }),
  );

  async function render() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const menu = el.querySelector<HTMLElement>('gd-menu')!;
    const button = menu.querySelector<HTMLButtonElement>('button[data-action="menu"]')!;
    const panel = menu.querySelector<HTMLElement>('nav.gd-menu__panel')!;
    const links = () => Array.from(panel.querySelectorAll<HTMLAnchorElement>('a.gd-menu__link'));
    const key = async (target: HTMLElement, key: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    const settle = () => fixture.whenStable();
    return { fixture, el, menu, button, panel, links, key, settle };
  }

  it('is a button and a panel of the navigation links (DOM contract)', async () => {
    const { menu, button, panel, links } = await render();
    expect(menu.classList).toContain('gd-menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.hidden).toBe(true);
    expect(links().map((a) => a.dataset['page'])).toEqual(LINKS.map((link) => link.page));
    expect(links().map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page']);
  });

  it('opens and closes with its button', async () => {
    const { menu, button, panel, settle } = await render();
    button.click();
    await settle();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hasAttribute('data-open')).toBe(true);
    expect(panel.hidden).toBe(false);
    button.click();
    await settle();
    expect(panel.hidden).toBe(true);
    expect(menu.hasAttribute('data-open')).toBe(false);
  });

  it('opens with Arrow Down at the first link, moves with the arrows, Home and End, and closes on Escape', async () => {
    const { button, panel, links, key } = await render();
    button.focus();
    await key(button, 'ArrowDown');
    expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(links()[0]);
    await key(links()[0], 'ArrowDown');
    expect(document.activeElement).toBe(links()[1]);
    await key(links()[1], 'ArrowDown');
    expect(document.activeElement).toBe(links()[0]);
    await key(links()[0], 'ArrowUp');
    expect(document.activeElement).toBe(links()[1]);
    await key(links()[1], 'Home');
    expect(document.activeElement).toBe(links()[0]);
    await key(links()[0], 'End');
    expect(document.activeElement).toBe(links()[1]);
    await key(links()[1], 'Escape');
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('closes on Escape on its button', async () => {
    const { button, panel, key, settle } = await render();
    button.click();
    await settle();
    await key(button, 'Escape');
    expect(panel.hidden).toBe(true);
  });

  it('closes when a link is followed or the focus leaves it', async () => {
    const { el, button, panel, links, key, settle } = await render();
    button.focus();
    await key(button, 'ArrowDown');
    links()[1].click();
    await settle();
    expect(panel.hidden).toBe(true);

    await key(button, 'ArrowDown');
    expect(panel.hidden).toBe(false);
    el.querySelector<HTMLButtonElement>('.outside')!.focus();
    await settle();
    expect(panel.hidden).toBe(true);
  });
});
