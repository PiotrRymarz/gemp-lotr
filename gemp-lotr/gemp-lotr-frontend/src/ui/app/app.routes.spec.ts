import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { ThemeService } from '../../core/platform/theme.service';
import { provideFakeNotifier } from '../../testing/fake-notifier';
import { DeckbuilderPageComponent } from '../deckbuilder/deckbuilder-page.component';
import { LoginPageComponent } from '../login/login-page.component';
import { MerchantPageComponent } from '../merchant/merchant-page.component';
import { MerchantNotifier } from '../merchant/merchant-notifier';
import { MerchantService } from '../../core/merchant/merchant.service';
import { SoloDraftService } from '../../core/solo-draft/solo-draft.service';
import { SoloDraftPageComponent } from '../solo-draft/solo-draft-page.component';
import { TableDraftService } from '../../core/table-draft/table-draft.service';
import { TableDraftPageComponent } from '../table-draft/table-draft-page.component';
import { HallComms } from '../../core/hall/hall-comms.service';
import { HallPageComponent } from '../hall/hall-page.component';
import { AppComponent } from './app.component';
import { APP_ROUTES } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(APP_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeNotifier(),
        { provide: PAGE_QUERY_STRING, useValue: '' },
      ],
    });
    // jsdom loads no stylesheets: the page's theme CSS is "loaded" at once (theme-pages.spec.ts tests the waiting)
    vi.spyOn(TestBed.inject(ThemeService), 'loadPage').mockResolvedValue();
  });

  afterEach(() => TestBed.inject(HttpTestingController).match(() => true));

  let harness: RouterTestingHarness;
  beforeEach(async () => (harness = await RouterTestingHarness.create()));

  async function open(url: string) {
    const page = await harness.navigateByUrl(url);
    return { page, url: TestBed.inject(Router).url };
  }

  it('loads the deck builder at deckbuilder, with or without a trailing slash', async () => {
    expect((await open('/deckbuilder')).page).toBeInstanceOf(DeckbuilderPageComponent);
    expect((await open('/deckbuilder/')).page).toBeInstanceOf(DeckbuilderPageComponent);
  });

  it('loads the login page at login, with its own LoginService', async () => {
    const { page, url } = await open('/login?participantId=bob');
    expect(page).toBeInstanceOf(LoginPageComponent);
    expect(url).toBe('/login?participantId=bob');
    expect(harness.routeNativeElement!.classList).toContain('gd-login');
    expect(TestBed.inject(Router).routerState.snapshot.root.firstChild!.title).toBe('GEMP: LotR-TCG - Login');
  });

  it('loads the merchant at merchant, with its own MerchantService asking through MerchantNotifier', async () => {
    const { page, url } = await open('/merchant');
    expect(page).toBeInstanceOf(MerchantPageComponent);
    expect(url).toBe('/merchant');
    expect(harness.routeNativeElement!.classList).toContain('gd-merchant');
    expect(TestBed.inject(Router).routerState.snapshot.root.firstChild!.title).toBe('GEMP: LotR-TCG - Merchant');
    const backend = TestBed.inject(HttpTestingController);
    expect(backend.match((req) => req.url === '/gemp-lotr-server/merchant')).toHaveLength(1);
    expect(() => TestBed.inject(MerchantService)).toThrow();
    expect(() => TestBed.inject(MerchantNotifier)).toThrow();
  });

  it('loads the solo draft at draft/solo (no shell link: the hall opens it), with its own SoloDraftService', async () => {
    const { page, url } = await open('/draft/solo?eventId=20261101');
    expect(page).toBeInstanceOf(SoloDraftPageComponent);
    expect(url).toBe('/draft/solo?eventId=20261101');
    expect(harness.routeNativeElement!.classList).toContain('gd-solo-draft');
    expect(TestBed.inject(Router).routerState.snapshot.root.firstChild!.title).toBe('GEMP: LotR-TCG - Draft');
    // The event comes from the page's own query string (PAGE_QUERY_STRING, empty here): nothing is asked
    expect(harness.routeNativeElement!.dataset['state']).toBe('no-event');
    expect(TestBed.inject(HttpTestingController).match(() => true)).toEqual([]);
    expect(() => TestBed.inject(SoloDraftService)).toThrow();
  });

  it('loads the table draft at draft/table (no shell link: the hall opens it), with its own TableDraftService', async () => {
    const { page, url } = await open('/draft/table?eventId=tdraft-1');
    expect(page).toBeInstanceOf(TableDraftPageComponent);
    expect(url).toBe('/draft/table?eventId=tdraft-1');
    expect(harness.routeNativeElement!.classList).toContain('gd-table-draft');
    expect(TestBed.inject(Router).routerState.snapshot.root.firstChild!.title).toBe('GEMP: LotR-TCG - Draft');
    // The event comes from the page's own query string (PAGE_QUERY_STRING, empty here): nothing is asked
    expect(harness.routeNativeElement!.dataset['state']).toBe('no-event');
    expect(TestBed.inject(HttpTestingController).match(() => true)).toEqual([]);
    expect(() => TestBed.inject(TableDraftService)).toThrow();
  });

  it('loads the hall at hall, with its own services, starting its poll and chat and stopping them when left', async () => {
    const { page, url } = await open('/hall');
    expect(page).toBeInstanceOf(HallPageComponent);
    expect(url).toBe('/hall');
    expect(harness.routeNativeElement!.classList).toContain('gd-hall');
    expect(TestBed.inject(Router).routerState.snapshot.root.firstChild!.title).toBe('GEMP: LotR-TCG - Main Hall');
    const backend = TestBed.inject(HttpTestingController);
    const calls = backend.match((req) => req.url === '/gemp-lotr-server/hall' || req.url.includes('/chat/'));
    expect(calls).toHaveLength(2);
    expect(() => TestBed.inject(HallComms)).toThrow();

    await open('/merchant');
    expect(calls.every((call) => call.cancelled)).toBe(true);
  });

  it('keeps the query string (?theme=, ?participantId=)', async () => {
    const { page, url } = await open('/deckbuilder/?theme=modern&participantId=bob');
    expect(page).toBeInstanceOf(DeckbuilderPageComponent);
    expect(url).toBe('/deckbuilder?theme=modern&participantId=bob');
  });

  it('sends the app root and unknown addresses to the deck builder', async () => {
    expect(await open('/')).toEqual({ page: expect.any(DeckbuilderPageComponent), url: '/deckbuilder' });
    expect((await open('/no/such/page?theme=classic')).url).toBe('/deckbuilder?theme=classic');
  });

  it('shows the page in the root component (<gemp-app>, no box of its own)', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/deckbuilder');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.style.display).toBe('contents');
    expect(el.querySelector('router-outlet + .gd-page')).not.toBeNull();
  });
});
