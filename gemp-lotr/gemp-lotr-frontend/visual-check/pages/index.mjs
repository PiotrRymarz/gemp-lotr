// The pages stubbed.mjs knows, in the order it runs them. A new page adds its module here (see README.md).
import deckbuilder from './deckbuilder.mjs';
import login from './login.mjs';
import merchant from './merchant.mjs';

export const PAGES = [deckbuilder, login, merchant];
