import { signal } from '@angular/core';

/** Arrow keys on the separator move it by this much (px). */
export const RESIZE_STEP = 10;

/**
 * The separator under the picks of a draft page (solo and table draft), as the legacy layout's resizer: dragging it
 * or the arrow keys resize the picks, its toggle (or Enter) closes or opens them. It only records the height asked
 * for; the theme keeps it within its limits. `page` and `picks` are the page's and the picks' selectors, `toggle` the
 * toggle's (a press on it is not a drag).
 */
export class DraftPaneResizer {
  readonly picksOpen = signal(true);
  /** The picks' height as last dragged to, or null for the theme's default. */
  readonly picksHeight = signal<number | null>(null);
  readonly dragging = signal(false);

  constructor(private readonly selectors: { page: string; picks: string; toggle: string }) {}

  toggle(): void {
    this.picksOpen.update((open) => !open);
  }

  /** Dragging the separator: the picks' bottom edge follows the pointer. */
  startResize(event: PointerEvent): void {
    if (!this.picksOpen() || event.button !== 0 || (event.target as Element).closest(this.selectors.toggle)) {
      return;
    }
    event.preventDefault();
    const separator = event.currentTarget as HTMLElement;
    const page = separator.closest(this.selectors.page) as HTMLElement;
    separator.setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
    const move = (e: PointerEvent) => {
      const top = page.getBoundingClientRect().top;
      this.picksHeight.set(Math.round(e.clientY - top - separator.offsetHeight / 2));
    };
    const stop = () => {
      separator.removeEventListener('pointermove', move);
      separator.removeEventListener('pointerup', stop);
      separator.removeEventListener('pointercancel', stop);
      this.dragging.set(false);
      // Keep what the theme allowed, so the next drag or key press starts from what is shown
      const shown = page.querySelector<HTMLElement>(this.selectors.picks)?.getBoundingClientRect().height;
      if (shown) {
        this.picksHeight.set(Math.round(shown));
      }
    };
    separator.addEventListener('pointermove', move);
    separator.addEventListener('pointerup', stop);
    separator.addEventListener('pointercancel', stop);
  }

  /** Down makes the picks taller, Up shorter; Enter closes or opens them. */
  resizeWithKeys(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.toggle();
      return;
    }
    const step = event.key === 'ArrowDown' ? RESIZE_STEP : event.key === 'ArrowUp' ? -RESIZE_STEP : 0;
    if (step && this.picksOpen()) {
      event.preventDefault();
      const picks = (event.currentTarget as HTMLElement)
        .closest(this.selectors.page)
        ?.querySelector<HTMLElement>(this.selectors.picks);
      const current = this.picksHeight() ?? picks?.getBoundingClientRect().height ?? 0;
      this.picksHeight.set(Math.round(current + step));
    }
  }
}
