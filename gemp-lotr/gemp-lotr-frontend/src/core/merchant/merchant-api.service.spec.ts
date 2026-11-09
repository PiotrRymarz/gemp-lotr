import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { readServerResponse } from '../../testing/files';
import { ApiError } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { MerchantApi, MerchantRefusedError } from './merchant-api.service';

/** Request bodies/params as a plain object, without the cache-busting "_" parameter. */
function sentData(req: TestRequest): Record<string, string> {
  const params = req.request.method === 'GET' ? req.request.params : (req.request.body as typeof req.request.params);
  const result: Record<string, string> = {};
  for (const key of params.keys()) {
    if (key !== '_') {
      result[key] = params.get(key)!;
    }
  }
  return result;
}

describe('MerchantApi', () => {
  let api: MerchantApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_QUERY_STRING, useValue: '?participantId=admin-target' },
      ],
    });
    api = TestBed.inject(MerchantApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function expectCall(method: string, path: string, data: Record<string, string>): TestRequest {
    const req = backend.expectOne((r) => r.url === '/gemp-lotr-server' + path);
    expect(req.request.method).toBe(method);
    expect(sentData(req)).toEqual({ participantId: 'admin-target', ...data });
    return req;
  }

  async function run<T>(
    call$: Observable<T>,
    method: string,
    path: string,
    data: Record<string, string>,
    body: string,
  ) {
    const result = firstValueFrom(call$);
    expectCall(method, path, data).flush(body);
    return result;
  }

  it('gets a page of offers (getMerchant), not cached', async () => {
    const result = firstValueFrom(api.getOffers('product:card set:1', 2, 18, 18));
    const req = expectCall('GET', '/merchant', {
      filter: 'product:card set:1',
      ownedMin: '2',
      start: '18',
      count: '18',
    });
    expect(req.request.params.has('_')).toBe(true);
    req.flush(readServerResponse('merchant.xml'));
    const page = await result;
    expect(page.currency).toBe(1234);
    expect(page.items.length).toBe(5);
  });

  it('buys, sells and trades for a foil with the legacy parameters', async () => {
    const ok = readServerResponse('merchant-ok.txt');
    await expect(
      run(api.buy('1_1', 420), 'POST', '/merchant/buy', { blueprintId: '1_1', price: '420' }, ok),
    ).resolves.toBeUndefined();
    await expect(
      run(api.sell('1_1', 150), 'POST', '/merchant/sell', { blueprintId: '1_1', price: '150' }, ok),
    ).resolves.toBeUndefined();
    await expect(
      run(api.tradeFoil('1_1'), 'POST', '/merchant/tradeFoil', { blueprintId: '1_1' }, ok),
    ).resolves.toBeUndefined();
  });

  it('turns a refusal (status 200, <error message>) into MerchantRefusedError', async () => {
    const refused = run(
      api.buy('1_3', 2000),
      'POST',
      '/merchant/buy',
      { blueprintId: '1_3', price: '2000' },
      readServerResponse('merchant-error.xml'),
    );
    await expect(refused).rejects.toBeInstanceOf(MerchantRefusedError);
    await expect(refused).rejects.toMatchObject({
      serverMessage: 'Unable to remove required currency from your collection',
    });
  });

  it('reports failed calls as ApiError', async () => {
    const result = firstValueFrom(api.tradeFoil('1_1'));
    expectCall('POST', '/merchant/tradeFoil', { blueprintId: '1_1' }).flush('', {
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 401 });
  });
});
