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
