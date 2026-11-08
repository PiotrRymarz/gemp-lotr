import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { readServerResponse } from '../../testing/files';
import { ApiError } from '../api/api-error';
import { PAGE_QUERY_STRING } from '../platform/page-location';
import { hasPlayerType, parsePlayer, PlayerType } from './player';
import { PlayerService } from './player.service';

describe('parsePlayer', () => {
  it('reads the answer of GET /player', () => {
    const player = parsePlayer(JSON.parse(readServerResponse('player.json')));
    expect(player).toEqual({ name: 'Visual tester', type: 'un', hasTrophies: true });
    expect(hasPlayerType(player, PlayerType.user)).toBe(true);
    expect(hasPlayerType(player, PlayerType.admin)).toBe(false);
  });

  it('is null for anything that names no player, and defaults the other fields', () => {
    expect(parsePlayer(null)).toBeNull();
    expect(parsePlayer('tester')).toBeNull();
    expect(parsePlayer({ type: 'u' })).toBeNull();
    expect(parsePlayer({ name: '' })).toBeNull();
    expect(parsePlayer({ name: 'bob' })).toEqual({ name: 'bob', type: '', hasTrophies: false });
    expect(hasPlayerType(null, PlayerType.user)).toBe(false);
  });
});

describe('PlayerService', () => {
  let backend: HttpTestingController;
  let service: PlayerService;

  function setUp(queryString = '') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_QUERY_STRING, useValue: queryString },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PlayerService);
  }

  afterEach(() => backend.verify());

  const expectPlayerRequest = () =>
    backend.expectOne((r) => r.url === '/gemp-lotr-server/player' && r.method === 'GET');

  it('asks GET /player once and shares the answer', async () => {
    setUp();
    expect(service.state()).toEqual({ status: 'unknown' });
    const first = service.load();
    const second = service.load();
    const request = expectPlayerRequest();
    expect(request.request.params.has('participantId')).toBe(false);
    request.flush(readServerResponse('player.json'));
    await expect(first).resolves.toEqual({ name: 'Visual tester', type: 'un', hasTrophies: true });
    await expect(second).resolves.toBe(await first);
    expect(service.player()?.name).toBe('Visual tester');
    expect(service.state().status).toBe('player');
    await service.load();
  });

  it("sends the session's participantId (an admin acting as a player)", async () => {
    setUp('?participantId=bob');
    const loaded = service.load();
    const request = expectPlayerRequest();
    expect(request.request.params.get('participantId')).toBe('bob');
    request.flush('{"hasTrophies":false,"name":"bob","type":"u"}');
    await expect(loaded).resolves.toMatchObject({ name: 'bob' });
  });

  it('is nobody when not logged in (401)', async () => {
    setUp();
    const loaded = service.load();
    expectPlayerRequest().flush('', { status: 401, statusText: 'Unauthorized' });
    await expect(loaded).resolves.toBeNull();
    expect(service.state()).toEqual({ status: 'anonymous' });
    expect(service.player()).toBeNull();
  });

  it('stays unknown after another failure, and asks again next time', async () => {
    setUp();
    const failed = service.load();
    expectPlayerRequest().flush('', { status: 500, statusText: 'Server Error' });
    await expect(failed).rejects.toBeInstanceOf(ApiError);
    expect(service.state()).toEqual({ status: 'unknown' });
    const retried = service.load();
    expectPlayerRequest().flush(readServerResponse('player.json'));
    await expect(retried).resolves.toMatchObject({ name: 'Visual tester' });
  });
});
