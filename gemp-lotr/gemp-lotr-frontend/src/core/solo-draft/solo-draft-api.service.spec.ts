import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { readServerResponse } from '../../testing/files';
import { ApiError, INVALID_RESPONSE_STATUS } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { SoloDraftApi } from './solo-draft-api.service';

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

describe('SoloDraftApi', () => {
  let api: SoloDraftApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_QUERY_STRING, useValue: '?participantId=admin-target' },
      ],
    });
    api = TestBed.inject(SoloDraftApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function expectCall(method: string, path: string, data: Record<string, string>): TestRequest {
    const req = backend.expectOne((r) => r.url === '/gemp-lotr-server' + path);
    expect(req.request.method).toBe(method);
    expect(sentData(req)).toEqual({ participantId: 'admin-target', ...data });
    return req;
  }

  it('gets the picks on offer (getDraft), not cached', async () => {
    const result = firstValueFrom(api.getChoices('20261101'));
    const req = expectCall('GET', '/soloDraft/20261101', {});
    expect(req.request.params.has('_')).toBe(true);
    req.flush(readServerResponse('solo-draft-picks.xml'));
    expect((await result).map((choice) => choice.id)).toEqual(['1_2', '1_45*', '1_319']);
  });

  it('reads no picks from another answer', async () => {
    const result = firstValueFrom(api.getChoices('20261101'));
    expectCall('GET', '/soloDraft/20261101', {}).flush('<collection count="0"/>');
    expect(await result).toEqual([]);
  });

  it('makes a pick (makeDraftPick) with the choice id', async () => {
    const result = firstValueFrom(api.pick('20261101', '1_45*'));
    expectCall('POST', '/soloDraft/20261101', { choiceId: '1_45*' }).flush(
      readServerResponse('solo-draft-pick-result.xml'),
    );
    expect(await result).toEqual({
      picked: [{ blueprintId: '1_2', count: 1 }],
      choices: [
        { id: '1_7', blueprintId: '1_7', url: null },
        { id: '1_12', blueprintId: '1_12', url: null },
      ],
    });
  });

  it('fails a pick answered with another root, rather than reading it as the end of the draft', async () => {
    const result = firstValueFrom(api.pick('20261101', '1_2'));
    expectCall('POST', '/soloDraft/20261101', { choiceId: '1_2' }).flush('<availablePicks/>');
    await expect(result).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(INVALID_RESPONSE_STATUS));
  });

  it('gets the drafted cards (getCollection of the event, sorted, up to 1000)', async () => {
    const result = firstValueFrom(api.getDraftedCards('20261101'));
    expectCall('GET', '/collection/20261101', {
      filter: 'sort:cardType,culture,name',
      start: '0',
      count: '1000',
    }).flush(readServerResponse('solo-draft-collection.xml'));
    expect(await result).toEqual([
      { blueprintId: '1_1', count: 1 },
      { blueprintId: '1_13', count: 2 },
      { blueprintId: '1_178', count: 1 },
    ]);
  });

  it('passes failures on as ApiError (404: no such draft, 400: not on offer)', async () => {
    const choices = firstValueFrom(api.getChoices('gone'));
    expectCall('GET', '/soloDraft/gone', {}).flush('', { status: 404, statusText: 'Not Found' });
    await expect(choices).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(404));

    const pick = firstValueFrom(api.pick('20261101', 'nope'));
    expectCall('POST', '/soloDraft/20261101', { choiceId: 'nope' }).flush('', { status: 400, statusText: 'Bad' });
    await expect(pick).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(400));
  });
});
