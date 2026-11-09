// The pages stubbed.mjs knows, in the order it runs them. A new page adds its module here (see README.md).
import deckbuilder from './deckbuilder.mjs';
import hall from './hall.mjs';
import login from './login.mjs';
import merchant from './merchant.mjs';
import soloDraft from './solo-draft.mjs';
import tableDraft from './table-draft.mjs';

export const PAGES = [deckbuilder, login, merchant, soloDraft, tableDraft, hall];
