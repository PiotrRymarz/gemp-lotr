import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { readServerResponse } from '../../testing/files';
import { ApiError, INVALID_RESPONSE_STATUS } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { TableDraftApi } from './table-draft-api.service';

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

describe('TableDraftApi', () => {
  let api: TableDraftApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_QUERY_STRING, useValue: '?participantId=admin-target' },
      ],
    });
    api = TestBed.inject(TableDraftApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function expectCall(method: string, path: string, data: Record<string, string>): TestRequest {
    const req = backend.expectOne((r) => r.url === '/gemp-lotr-server' + path);
    expect(req.request.method).toBe(method);
    expect(sentData(req)).toEqual({ participantId: 'admin-target', ...data });
    return req;
  }

  it('gets the draft status (getTableDraft), not cached', async () => {
    const result = firstValueFrom(api.getStatus('tdraft-1'));
    const req = expectCall('GET', '/tableDraft/tdraft-1', {});
    expect(req.request.params.has('_')).toBe(true);
    req.flush(readServerResponse('table-draft-status.xml'));
    const status = (await result)!;
    expect(status.players.map((player) => player.name)).toEqual(['alice', 'bob', 'carol']);
    expect(status.choices.map((choice) => choice.id)).toEqual(['1_2', '1_45*', '1_2']);
  });

  it('reads another answer as nothing, as the legacy page ignored it', async () => {
    const result = firstValueFrom(api.getStatus('tdraft-1'));
    expectCall('GET', '/tableDraft/tdraft-1', {}).flush('<availablePicks/>');
    expect(await result).toBeNull();
  });

  it('declares a card (makeTableDraftPick) and reads the status it answers', async () => {
    const result = firstValueFrom(api.pick('tdraft-1', '1_2'));
    expectCall('POST', '/tableDraft/tdraft-1', { choiceId: '1_2' }).flush(readServerResponse('table-draft-chosen.xml'));
    expect((await result).choices[0].chosen).toBe(true);
  });

  it('fails a pick answered with another root', async () => {
    const result = firstValueFrom(api.pick('tdraft-1', '1_2'));
    expectCall('POST', '/tableDraft/tdraft-1', { choiceId: '1_2' }).flush('<pickResult/>');
    await expect(result).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(INVALID_RESPONSE_STATUS));
  });

  it('passes failures on as ApiError (404: no such draft, 400: not on offer)', async () => {
    const status = firstValueFrom(api.getStatus('gone'));
    expectCall('GET', '/tableDraft/gone', {}).flush('', { status: 404, statusText: 'Not Found' });
    await expect(status).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(404));

    const pick = firstValueFrom(api.pick('tdraft-1', 'nope'));
    expectCall('POST', '/tableDraft/tdraft-1', { choiceId: 'nope' }).flush('', { status: 400, statusText: 'Bad' });
    await expect(pick).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.is(400));
  });
});
