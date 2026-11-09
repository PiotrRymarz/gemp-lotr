import { InjectionToken } from '@angular/core';
import { CardRef } from './card-ref';

/**
 * What the page does with a card, whatever gesture the view maps to it. The shared card (ui/shared gd-card) uses
 * whatever its page provides: the deck builder's DeckbuilderActions, the merchant's MerchantCardActions, ...
 */
export interface CardActions {
  /** The card was used (click, Enter, Space). */
  activate(ref: CardRef): void;
  /** The player asked for the card's details (shift-click, right-click, long press, drag up). */
  showInfo(ref: CardRef): void;
}

/** The page's CardActions, provided by its route services (DECKBUILDER_SERVICES, MERCHANT_SERVICES). */
export const CARD_ACTIONS = new InjectionToken<CardActions>('CARD_ACTIONS');
