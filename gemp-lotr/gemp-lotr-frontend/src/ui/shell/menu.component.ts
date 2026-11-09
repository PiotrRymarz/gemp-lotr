import { afterNextRender, Component, ElementRef, inject, Injector, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellLink } from './shell-links';

let menus = 0;

/**
 * The navigation as a menu, for screens too narrow for the shell's nav (the theme shows one or the other): a button
 * that opens a panel of the same links. Enter, Space or a click toggles it; Arrow Down on the button opens it at the
 * first link; Arrow Up/Down, Home and End move between the links; Escape closes it and gives the focus back to the
 * button; following a link, or the focus leaving the menu (a click elsewhere), closes it.
 *
 * DOM contract: `gd-menu.gd-menu` (`data-open` while open) with `button.gd-button[data-action=menu]`
 * (`aria-expanded`, `aria-controls`) and `nav.gd-menu__panel` (`hidden` while closed) holding an `a.gd-menu__link`
 * per page (`data-page`; `aria-current=page` on the page shown).
 */
@Component({
  selector: 'gd-menu',
  imports: [RouterLink],
  host: { class: 'gd-menu', '[attr.data-open]': "open() ? '' : null", '(focusout)': 'onFocusOut($event)' },
  template: `
    <button
      #button
      type="button"
      class="gd-button"
      data-action="menu"
      title="Menu"
      aria-label="Menu"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      (click)="toggle()"
      (keydown)="onButtonKey($event)"
    ></button>
    <nav
      #panel
      class="gd-menu__panel"
      aria-label="Pages"
      [id]="panelId"
      [hidden]="!open()"
      (keydown)="onPanelKey($event)"
    >
      @for (link of links(); track link.page) {
        @if ('route' in link) {
          <a
            class="gd-menu__link"
            [routerLink]="link.route"
            [attr.data-page]="link.page"
            [attr.aria-current]="link.page === current() ? 'page' : null"
            (click)="close()"
            >{{ link.label }}</a
          >
        } @else {
          <a class="gd-menu__link" [href]="link.href" [attr.data-page]="link.page" (click)="close()">{{
            link.label
          }}</a>
        }
      }
    </nav>
  `,
})
export class MenuComponent {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly links = input.required<readonly ShellLink[]>();
  /** The page shown (its route's `data.page`). */
  readonly current = input<string | null>(null);

  protected readonly panelId = `gd-menu-${++menus}`;
  protected readonly open = signal(false);

  toggle(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  protected onButtonKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.focusLink(0);
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
    }
  }

  protected onPanelKey(event: KeyboardEvent): void {
    const links = this.linkElements();
    const at = links.indexOf(event.target as HTMLAnchorElement);
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: links.length - 1 };
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.button().nativeElement.focus();
    } else if (event.key in moves) {
      event.preventDefault();
      links[(moves[event.key] + links.length) % links.length]?.focus();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const to = event.relatedTarget as Node | null;
    if (!to || !this.host.nativeElement.contains(to)) {
      this.close();
    }
  }

  /** Once the panel shows (it can't take the focus while hidden). */
  private focusLink(index: number): void {
    afterNextRender(() => this.linkElements()[index]?.focus(), { injector: this.injector });
  }

  private linkElements(): HTMLAnchorElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLAnchorElement>('.gd-menu__link'));
  }
}
