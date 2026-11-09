import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, firstValueFrom, from, map, Observable, of, Subject, switchMap } from 'rxjs';
import { GENERIC_COMMUNICATION_ERROR } from '../api/api-error';
import { CardImageService } from '../cards/card-image.service';
import { Notifier } from '../notifier/notifier';
import { ImagePreloader } from '../platform/image-preloader.service';
import { MerchantApi, MerchantRefusedError } from './merchant-api.service';
import {
  buildMerchantFilter,
  dynamicFilters,
  hobbitCulturesShown,
  INITIAL_MERCHANT_FILTER,
  MerchantFilterFields,
  MerchantSelectField,
  normalizeMerchantFilter,
} from './merchant-filter';
import { buyQuestion, MERCHANT_REFUSED, sellQuestion, TRADE_FOIL_QUESTION } from './merchant-messages';
import { MerchantItem, MerchantOperation, MerchantPage } from './merchant-models';

/** Page size slider limits, and where it starts (LegacyCardFilter: count 18, slider 4-40). */
export const MERCHANT_PAGE_SIZE_MIN = 4;
export const MERCHANT_PAGE_SIZE_MAX = 40;
export const MERCHANT_INITIAL_PAGE_SIZE = 18;

/** The "Owned >=" choices. */
export const OWNED_MIN_OPTIONS: readonly number[] = [0, 1, 2, 3, 4, 5];

interface MerchantRequest {
  filter: string;
  ownedMin: number;
  start: number;
  count: number;
}

/** A question the merchant is asking about an item (the legacy "Merchant operation" dialog showed the card). */
export interface MerchantQuestion {
  operation: MerchantOperation;
  item: MerchantItem;
}

/**
 * State of the merchant page, ported from merchantUi.js and the LegacyCardFilter it uses: the filter, "Owned >=",
 * "Hide merchant", paging, the page of offers from GET /merchant with the player's currency, and buying, selling and
 * trading for foils, each after a yes/no question through the Notifier.
 *
 * As in the deck builder, only the newest page request is shown, and a page appears once its images have loaded.
 * See README.md for what differs from the legacy page.
 */
@Injectable()
export class MerchantService {
  private readonly api = inject(MerchantApi);
  private readonly images = inject(CardImageService);
  private readonly preloader = inject(ImagePreloader);
  private readonly notifier = inject(Notifier);

  readonly fields = signal<MerchantFilterFields>(INITIAL_MERCHANT_FILTER);
  /** "Owned >=": 0 lists what the merchant sells too; above 0 only the player's items with that many copies. */
  readonly ownedMin = signal(0);
  /** "Hide merchant": the cards show without their buttons. */
  readonly hideMerchant = signal(false);

  /** First item of the page, and items per page. */
  readonly start = signal(0);
  readonly count = signal(MERCHANT_INITIAL_PAGE_SIZE);
  readonly page = signal<MerchantPage | null>(null);
  readonly previousDisabled = signal(true);
  readonly nextDisabled = signal(true);
  /** The page size slider is enabled once the first page has arrived. */
  readonly sliderDisabled = signal(true);

  /** The player's currency in silver ("pocket"), once a page has arrived. */
  readonly currency = computed(() => this.page()?.currency ?? null);
  /** Which of race, item class and phase show for the chosen card type. */
  readonly dynamicFilters = computed(() => dynamicFilters(this.fields().cardType));
  /** Whether the Hobbit culture buttons show for the chosen set. */
  readonly hobbitCulturesShown = computed(() => hobbitCulturesShown(this.fields().set));

  /** The question being asked, so the view can show the item beside it; null when none is open. */
  readonly question = signal<MerchantQuestion | null>(null);
  /** An operation is being asked about or is under way: no other one starts meanwhile. */
  readonly busy = signal(false);

  private readonly requests = new Subject<MerchantRequest>();

  constructor() {
    const subscription = this.requests
      .pipe(
        switchMap((request) =>
          this.api.getOffers(request.filter, request.ownedMin, request.start, request.count).pipe(
            switchMap((page) => this.withImagesLoaded(page)),
            catchError(() => {
              void this.notifier.alert(GENERIC_COMMUNICATION_ERROR);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe((page) => this.display(page));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** The filter string for the current fields (sent to GET /merchant). */
  filter(): string {
    return buildMerchantFilter(this.fields());
  }

  /** A select of the filter was changed: back to the first page. */
  setField(field: MerchantSelectField, value: string): void {
    this.fields.update((fields) => normalizeMerchantFilter({ ...fields, [field]: value }));
    this.reloadFromStart();
  }

  /** The "Card name" input was changed (on change, as the legacy input: Enter or leaving it). */
  setName(name: string): void {
    this.fields.update((fields) => ({ ...fields, name }));
    this.reloadFromStart();
  }

  toggleCulture(code: string): void {
    this.fields.update((fields) => ({
      ...fields,
      cultures: fields.cultures.includes(code) ? fields.cultures.filter((c) => c !== code) : [...fields.cultures, code],
    }));
    this.reloadFromStart();
  }

  /** "Owned >=" was changed; the page stays where it is, as in the legacy page. */
  setOwnedMin(ownedMin: number): void {
    this.ownedMin.set(ownedMin);
    this.load();
  }

  /** "Hide merchant" was toggled; the page is reloaded, as in the legacy page. */
  setHideMerchant(hide: boolean): void {
    this.hideMerchant.set(hide);
    this.load();
  }

  previousPage(): void {
    this.disableNavigation();
    this.start.update((start) => Math.max(0, start - this.count()));
    this.load();
  }

  nextPage(): void {
    this.disableNavigation();
    this.start.update((start) => start + this.count());
    this.load();
  }

  setPageSize(count: number): void {
    this.start.set(0);
    this.count.set(count);
    this.load();
  }

  /** Loads the current page (LegacyCardFilter.getCollection). */
  load(): void {
    this.requests.next({
      filter: this.filter(),
      ownedMin: this.ownedMin(),
      start: this.start(),
      count: this.count(),
    });
  }

  /** "Sell for": the merchant buys one copy for the item's buyPrice. */
  sell(item: MerchantItem): Promise<void> {
    const price = item.buyPrice;
    if (price === null) {
      return Promise.resolve();
    }
    return this.operate('sell', item, sellQuestion(price), () => this.api.sell(item.blueprintId, price));
  }

  /** "Buy for": the merchant sells one copy for the item's sellPrice; nothing when the player can't afford it. */
  buy(item: MerchantItem): Promise<void> {
    const price = item.sellPrice;
    const currency = this.currency();
    if (price === null || (currency !== null && price > currency)) {
      return Promise.resolve();
    }
    return this.operate('buy', item, buyQuestion(price), () => this.api.buy(item.blueprintId, price));
  }

  /** "Trade 4 for foil". */
  tradeFoil(item: MerchantItem): Promise<void> {
    if (!item.tradeFoil) {
      return Promise.resolve();
    }
    return this.operate('tradeFoil', item, TRADE_FOIL_QUESTION, () => this.api.tradeFoil(item.blueprintId));
  }

  /** Asks, then runs the operation and reloads the page (whatever the merchant answered, as the legacy page did). */
  private async operate(
    operation: MerchantOperation,
    item: MerchantItem,
    question: string,
    call: () => Observable<void>,
  ): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      this.question.set({ operation, item });
      const yes = await this.notifier.confirm(question);
      this.question.set(null);
      if (!yes) {
        return;
      }
      try {
        await firstValueFrom(call());
      } catch (error) {
        if (!(error instanceof MerchantRefusedError)) {
          await this.notifier.alert(GENERIC_COMMUNICATION_ERROR);
          return;
        }
        await this.notifier.alert(error.serverMessage || MERCHANT_REFUSED);
      }
      this.load();
    } finally {
      this.question.set(null);
      this.busy.set(false);
    }
  }

  private reloadFromStart(): void {
    this.start.set(0);
    this.load();
  }

  private disableNavigation(): void {
    this.previousDisabled.set(true);
    this.nextDisabled.set(true);
  }

  /** Waits for the page's card images (and the errata layers), up to IMAGE_PRELOAD_TIMEOUT_MS. */
  private withImagesLoaded(page: MerchantPage): Observable<MerchantPage> {
    if (!this.preloader.supported) {
      return of(page);
    }
    const urls = new Set<string>();
    for (const item of page.items) {
      const image = this.images.resolve(item.blueprintId, item.kind === 'pack' ? 'pack' : 'player');
      urls.add(image.imageUrl);
      if (item.kind === 'card' && image.errata) urls.add('/gemp-lotr/images/errata-vertical.png');
    }
    return from(this.preloader.load(urls)).pipe(map(() => page));
  }

  private display(page: MerchantPage): void {
    this.page.set(page);
    this.previousDisabled.set(this.start() === 0);
    this.nextDisabled.set(this.start() + this.count() >= page.total);
    this.sliderDisabled.set(false);
  }
}
