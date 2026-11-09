/**
 * A page in the shell's navigation: one the app shows (`route`, a path of the app, under /gemp-lotr/ng/) or a legacy
 * page (`href`, loaded in full). `page` is its name, the same as its route's `data.page`, so the link of the page on
 * screen can be marked.
 */
export type ShellLink =
  | { readonly page: string; readonly label: string; readonly route: string }
  | { readonly page: string; readonly label: string; readonly href: string };

/** The legacy hall, where the app's title leads. */
export const HALL_HREF = '/gemp-lotr/hall.html';

/** The shell's navigation, in order. A newly ported page adds its entry (and replaces its legacy one). */
export const SHELL_LINKS: readonly ShellLink[] = [
  { page: 'hall', label: 'Game Hall', href: HALL_HREF },
  { page: 'deckbuilder', label: 'Deck Builder', route: '/deckbuilder' },
];
