import { Provider } from '@angular/core';
import { CARD_ACTIONS } from '../cards/card-actions';
import { CollectionService } from '../collection/collection.service';
import { DeckLibraryService } from '../deck/deck-library.service';
import { DeckService } from '../deck/deck.service';
import { PackDeliveryService } from '../delivery/pack-delivery.service';
import { PacksService } from '../packs/packs.service';
import { DeckbuilderActions } from './deckbuilder-actions.service';

/**
 * The deck builder's own state, provided by its route (app.routes.ts), so it belongs to the page rather than the app.
 * They ask the player through the Notifier, which the app provides. The services every page shares (GempHttp,
 * DeckbuilderApi, FormatsService, CardImageService, CardInfoService, ...) stay `providedIn: 'root'`. The shared cards
 * reach DeckbuilderActions through CARD_ACTIONS.
 */
export const DECKBUILDER_SERVICES: Provider[] = [
  DeckService,
  DeckLibraryService,
  CollectionService,
  PacksService,
  PackDeliveryService,
  DeckbuilderActions,
  { provide: CARD_ACTIONS, useExisting: DeckbuilderActions },
];
