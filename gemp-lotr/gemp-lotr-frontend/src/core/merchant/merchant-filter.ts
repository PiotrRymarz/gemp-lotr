import { SelectOption } from '../collection/card-filter';

/**
 * The merchant's filter: the legacy js/gemp-022/cardFilter.js (LegacyCardFilter), which is not the deck builder's
 * CardFilter: other lists, other wording, and its own filter string. Field values, their option lists, which fields
 * show, and the filter string sent to GET /merchant.
 */

export interface MerchantFilterFields {
  /** #setSelect */
  set: string;
  /** The "Card name" input; every space-separated word becomes a name: term. */
  name: string;
  sort: string;
  rarity: string;
  /** Selected culture codes. */
  cultures: readonly string[];
  cardType: string;
  keyword: string;
  /** #type: product (packs, cards, foils, ...). */
  product: string;
  /** Shown only for characters (cardType contains COMPANION, ALLY or MINION). */
  race: string;
  /** Shown only for items (cardType contains POSSESSION or ARTIFACT). */
  itemClass: string;
  /** Shown only for events (cardType contains EVENT). */
  phase: string;
}

export type MerchantSelectField = Exclude<keyof MerchantFilterFields, 'cultures' | 'name'>;

/** A disabled separator line in a select (`<option disabled>----------</option>`). */
export interface MerchantSelectOption extends SelectOption {
  disabled?: boolean;
}

const SEPARATOR: MerchantSelectOption = { value: '----------', label: '----------', disabled: true };

function opts(...pairs: [string, string][]): MerchantSelectOption[] {
  return pairs.map(([value, label]) => ({ value, label }));
}

export const MERCHANT_SET_OPTIONS: readonly MerchantSelectOption[] = [
  ...opts(
    ['0-34,50-200,404', 'All Sets'],
    ['0-19', 'Official Decipher Sets'],
    ['30-33', 'The Hobbit Sets'],
    ['50-69,100', "Player's Council Errata"],
    ['100-149', "Player's Council VSets"],
    ['50-69,100-149', "All Player's Council Cards"],
  ),
  SEPARATOR,
  ...opts(
    ['fotr_block', 'Fellowship Block'],
    ['pc_fotr_block', 'Fellowship Block (PC)'],
    ['ttt_block', 'Towers Block'],
    ['king_block', 'King Block'],
    ['war_block', 'War of the Ring Block'],
    ['hunter_block', 'Hunters Block'],
    ['towers_standard', 'Towers Standard'],
    ['ts_reflections', 'Enhanced Towers Standard'],
    ['rotk_sta', 'King Standard'],
    ['movie', 'Movie Block'],
    ['pc_movie', 'Movie Block (PC)'],
    ['war_standard', 'War of the Ring standard'],
    ['standard', 'Standard'],
    ['expanded', 'Expanded'],
    ['pc_expanded', 'Expanded (PC)'],
    ['french', 'French Format'],
  ),
  SEPARATOR,
  ...opts(
    ['404', '404 - Future Prizes'],
    ['0', '00 - Promo'],
    ['1', '01 - The Fellowship of the Ring'],
    ['51', '01E - The Fellowship of the Ring (PC Errata)'],
    ['2', '02 - Mines of Moria'],
    ['52', '02E - Mines of Moria (PC Errata)'],
    ['3', '03 - Realms of the Elf-lords'],
    ['53', '03E - Realms of the Elf-lords (PC Errata)'],
    ['4', '04 - The Two Towers'],
    ['54', '04E - The Two Towers (PC Errata)'],
    ['5', "05 - Battle of Helm's Deep"],
    ['6', '06 - Ents of Fangorn'],
    ['7', '07 - The Return of the King'],
    ['57', '07E - The Return of the King (PC Errata)'],
    ['8', '08 - Siege of Gondor'],
    ['58', '08E - Siege of Gondor (PC Errata)'],
    ['9', '09 - Reflections'],
    ['59', '09E - Reflections (PC Errata)'],
    ['10', '10 - Mount Doom'],
    ['60', '10E - Mount Doom (PC Errata)'],
    ['11', '11 - Shadows'],
    ['61', '11E - Shadows (PC Errata)'],
    ['12', '12 - Black Rider'],
    ['13', '13 - Bloodlines'],
    ['63', '13E - Bloodlines (PC Errata)'],
    ['14', '14 - Expanded Middle-earth'],
    ['15', '15 - The Hunters'],
    ['65', '15E - The Hunters (PC Errata)'],
    ['16', '16 - The Wraith Collection'],
    ['17', '17 - Rise of Saruman'],
    ['18', '18 - Treachery & Deceit'],
    ['19', '19 - Ages End'],
    ['69', '19E - Ages End (PC Errata)'],
    ['101', 'V1 - Shadow of the Past (PC)'],
    ['102', 'V2 - King of the Golden Hall (PC)'],
    ['103', 'V3 - The Pelennor Fields (PC)'],
    ['30', '30 - The Hobbit: Main Deck'],
    ['31', '31 - The Hobbit: Expansion 1'],
    ['32', '32 - The Hobbit: Expansion 2'],
    ['33', '33 - The Hobbit: Expansion 3'],
  ),
  SEPARATOR,
  ...opts(
    ['70-89,150-200', "All Player's Council Playtest Cards"],
    ['test_pc_fotr_block', 'PLAYTEST - Fellowship Block (PC)'],
    ['test_pc_movie', 'PLAYTEST - Movie Block (PC)'],
    ['test_pc_expanded', 'PLAYTEST - Expanded (PC)'],
  ),
];

export const MERCHANT_SORT_OPTIONS = opts(
  ['', 'Sort by:'],
  ['name', 'Name'],
  ['twilight,name', 'Twilight'],
  ['siteNumber,name', 'Site number'],
  ['strength,name', 'Strength'],
  ['vitality,name', 'Vitality'],
  ['cardType,name', 'Card type'],
  ['culture,name', 'Culture'],
);

export const MERCHANT_RARITY_OPTIONS = opts(
  ['', 'Rarity:'],
  ['R', 'Rare'],
  ['U', 'Uncommon'],
  ['C', 'Common'],
  ['A', 'Alternate Image'],
  ['P', 'Promo'],
  ['X', 'Rare+'],
  ['S', 'Fixed'],
  ['C,U,P,S', "Poorman's"],
);

export const MERCHANT_CARD_TYPE_OPTIONS = opts(
  ['', 'All Card Types'],
  ['COMPANION,ALLY,MINION', 'Characters'],
  ['POSSESSION,ARTIFACT', 'Items'],
  ['SITE', 'Sites'],
  ['ALLY', 'Allies'],
  ['ARTIFACT', 'Artifacts'],
  ['COMPANION', 'Companions'],
  ['CONDITION', 'Conditions'],
  ['EVENT', 'Events'],
  ['FOLLOWER', 'Followers'],
  ['MINION', 'Minions'],
  ['POSSESSION', 'Possessions'],
);

export const MERCHANT_KEYWORD_OPTIONS = opts(
  ['', 'No keyword filtering'],
  ['ARCHER', 'Archer'],
  ['BATTLEGROUND', 'Battleground'],
  ['BEACON', 'Beacon'],
  ['BESIEGER', 'Besieger'],
  ['CORSAIR', 'Corsair'],
  ['DWELLING', 'Dwelling'],
  ['EASTERLING', 'Easterling'],
  ['ENDURING', 'Enduring'],
  ['ENGINE', 'Engine'],
  ['FIERCE', 'Fierce'],
  ['FOREST', 'Forest'],
  ['FORTIFICATION', 'Fortification'],
  ['HUNTER', 'Hunter'],
  ['KNIGHT', 'Knight'],
  ['LURKER', 'Lurker'],
  ['MACHINE', 'Machine'],
  ['MARSH', 'Marsh'],
  ['MOUNTAIN', 'Mountain'],
  ['MUSTER', 'Muster'],
  ['PIPEWEED', 'Pipeweed'],
  ['PLAINS', 'Plains'],
  ['RANGER', 'Ranger'],
  ['RING_BOUND', 'Ring-bound'],
  ['RIVER', 'River'],
  ['SEARCH', 'Search'],
  ['SOUTHRON', 'Southron'],
  ['SPELL', 'Spell'],
  ['STEALTH', 'Stealth'],
  ['TALE', 'Tale'],
  ['TENTACLE', 'Tentacle'],
  ['TRACKER', 'Tracker'],
  ['TWILIGHT', 'Twilight'],
  ['UNDERGROUND', 'Underground'],
  ['UNHASTY', 'Unhasty'],
  ['VALIANT', 'Valiant'],
  ['VILLAGER', 'Villager'],
  ['WARG_RIDER', 'Warg-rider'],
  ['WEATHER', 'Weather'],
  ['WISE', 'Wise'],
);

export const MERCHANT_PRODUCT_OPTIONS = opts(
  ['', 'All types'],
  ['pack', 'Packs'],
  ['card', 'Cards'],
  ['foil', 'Foils'],
  ['nonFoil', 'Non-foils'],
  ['tengwar', 'Tengwar'],
);

/** The legacy list labels CROW "Warg" (a copy-paste slip); kept, since it is what players see. */
export const MERCHANT_RACE_OPTIONS = opts(
  ['', 'All races'],
  ['BALROG', 'Balrog'],
  ['CREATURE', 'Creature'],
  ['DWARF', 'Dwarf'],
  ['ELF', 'Elf'],
  ['ENT', 'Ent'],
  ['HALF_TROLL', 'Half-troll'],
  ['HOBBIT', 'Hobbit'],
  ['MAIA', 'Maia'],
  ['MAN', 'Man'],
  ['NAZGUL', 'Nazgul'],
  ['ORC', 'Orc'],
  ['SPIDER', 'Spider'],
  ['TREE', 'Tree'],
  ['TROLL', 'Troll'],
  ['URUK_HAI', 'Uruk-hai'],
  ['WIZARD', 'Wizard'],
  ['WRAITH', 'Wraith'],
  ['DRAGON', 'Dragon'],
  ['EAGLE', 'Eagle'],
  ['GIANT', 'Giant'],
  ['WARG', 'Warg'],
  ['CROW', 'Warg'],
);

export const MERCHANT_ITEM_CLASS_OPTIONS = opts(
  ['', 'All classes'],
  ['ARMOR', 'Armor'],
  ['BOX', 'Box'],
  ['BRACERS', 'Bracers'],
  ['BROOCH', 'Brooch'],
  ['CLOAK', 'Cloak'],
  ['GAUNTLETS', 'Gauntlets'],
  ['HAND_WEAPON', 'Hand Weapon'],
  ['HELM', 'Helm'],
  ['HORN', 'Horn'],
  ['MOUNT', 'Mount'],
  ['PALANTIR', 'Palantir'],
  ['PHIAL', 'Phial'],
  ['PIPE', 'Pipe'],
  ['RANGED_WEAPON', 'Ranged Weapon'],
  ['RING', 'Ring'],
  ['SHIELD', 'Shield'],
  ['STAFF', 'Staff'],
  ['CLASSLESS', 'Classless'],
);

export const MERCHANT_PHASE_OPTIONS = opts(
  ['', 'All Phases'],
  ['FELLOWSHIP', 'Fellowship'],
  ['SHADOW', 'Shadow'],
  ['MANEUVER', 'Maneuver'],
  ['ARCHERY', 'Archery'],
  ['ASSIGNMENT', 'Assignment'],
  ['SKIRMISH', 'Skirmish'],
  ['REGROUP', 'Regroup'],
  ['RESPONSE', 'Response'],
);

/** The culture buttons, in the legacy order (#culture1), each with its image under /gemp-lotr/images/cultures/. */
export const MERCHANT_CULTURES: readonly string[] = [
  'DWARVEN',
  'ELVEN',
  'GANDALF',
  'GONDOR',
  'ROHAN',
  'SHIRE',
  'GOLLUM',
  'DUNLAND',
  'ISENGARD',
  'MEN',
  'MORIA',
  'ORC',
  'RAIDER',
  'SAURON',
  'URUK_HAI',
  'WRAITH',
];

/** The Hobbit draft cultures (#culture2), shown only for a Hobbit set. */
export const MERCHANT_HOBBIT_CULTURES: readonly string[] = [
  'ESGAROTH',
  'GUNDABAD',
  'MIRKWOOD',
  'SMAUG',
  'SPIDER',
  'TROLL',
];

export function cultureImage(code: string): string {
  return `/gemp-lotr/images/cultures/${code.toLowerCase()}.png`;
}

/** What the merchant shows first: all sets, cards only (merchantUi.js: setType("card"), setFilter("product:card")). */
export const INITIAL_MERCHANT_FILTER: MerchantFilterFields = {
  set: MERCHANT_SET_OPTIONS[0].value,
  name: '',
  sort: '',
  rarity: '',
  cultures: [],
  cardType: '',
  keyword: '',
  product: 'card',
  race: '',
  itemClass: '',
  phase: '',
};

/** The Hobbit cultures show when the set's value mentions 30, 31, 32 or 33 (setFilterChanged). */
export function hobbitCulturesShown(set: string): boolean {
  return ['30', '31', '32', '33'].some((number) => set.includes(number));
}

/** Which of race, item class and phase show for a card type (changeDynamicFilters). */
export function dynamicFilters(cardType: string): { race: boolean; itemClass: boolean; phase: boolean } {
  const characters = ['COMPANION', 'ALLY', 'MINION'].some((type) => cardType.includes(type));
  const items = !characters && ['POSSESSION', 'ARTIFACT'].some((type) => cardType.includes(type));
  const events = !characters && !items && cardType.includes('EVENT');
  return { race: characters, itemClass: items, phase: events };
}

/**
 * The fields after the player changed one: a hidden race, item class or phase is cleared, and the Hobbit cultures are
 * unselected when they hide (as the legacy page did when the set or the card type changed).
 */
export function normalizeMerchantFilter(fields: MerchantFilterFields): MerchantFilterFields {
  const shown = dynamicFilters(fields.cardType);
  const hobbit = hobbitCulturesShown(fields.set);
  return {
    ...fields,
    race: shown.race ? fields.race : '',
    itemClass: shown.itemClass ? fields.itemClass : '',
    phase: shown.phase ? fields.phase : '',
    cultures: hobbit ? fields.cultures : fields.cultures.filter((code) => !MERCHANT_HOBBIT_CULTURES.includes(code)),
  };
}

/**
 * The filter string, exactly as the legacy page built it (calculateNormalFilter + calculateFullFilterPostfix, then
 * trimmed), spaces included: the server splits it on spaces. Cultures go in button order, not the order they were
 * clicked.
 */
export function buildMerchantFilter(fields: MerchantFilterFields): string {
  const term = (key: string, value: string): string => (value !== '' ? ` ${key}:${value}` : '');
  const cultures = [...MERCHANT_CULTURES, ...MERCHANT_HOBBIT_CULTURES].filter((code) => fields.cultures.includes(code));
  const cardType = fields.cardType !== '' ? `cardType:${fields.cardType} ` : '';
  const normal =
    cardType +
    (cultures.length > 0 ? ` culture:${cultures.join(',')}` : '') +
    term('keyword', fields.keyword) +
    term('product', fields.product) +
    term('race', fields.race) +
    term('itemClass', fields.itemClass) +
    term('phase', fields.phase);
  const name = fields.name
    ? fields.name
        .split(' ')
        .map((word) => ` name:${word}`)
        .join('')
    : '';
  const postfix = term('set', fields.set) + term('sort', fields.sort) + name + term('rarity', fields.rarity);
  return (normal + postfix).trim();
}
