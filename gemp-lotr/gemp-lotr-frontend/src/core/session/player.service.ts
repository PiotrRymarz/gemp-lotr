import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { GempHttp } from '../api/gemp-http.service';
import { parsePlayer, Player } from './player';

/** What is known about who is logged in: not asked yet or waiting, a player, or nobody (not logged in). */
export type PlayerState = { status: 'unknown' } | { status: 'player'; player: Player } | { status: 'anonymous' };

/**
 * The logged-in player, from GET /player (what the legacy hall asks, communication.js getPlayerInfoShared), with the
 * session's participantId, so an admin acting as a player gets that player. Asked once, on the first load(); 401
 * (not logged in) means nobody. Any other failure leaves it unknown and rejects, so a later load() asks again.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly http = inject(GempHttp);
  private readonly state_ = signal<PlayerState>({ status: 'unknown' });
  private pending: Promise<Player | null> | null = null;

  readonly state = this.state_.asReadonly();

  /** The logged-in player, or null (not logged in, or not known yet). */
  readonly player = computed(() => {
    const state = this.state_();
    return state.status === 'player' ? state.player : null;
  });

  /** Asks the server who is logged in (once; later calls share the answer). */
  load(): Promise<Player | null> {
    this.pending ??= firstValueFrom(this.http.getJson<unknown>('/player')).then(
      (json) => {
        const player = parsePlayer(json);
        this.state_.set(player ? { status: 'player', player } : { status: 'anonymous' });
        return player;
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is(401)) {
          this.state_.set({ status: 'anonymous' });
          return null;
        }
        this.pending = null;
        throw error;
      },
    );
    return this.pending;
  }

  /** Forgets the answer and asks again (after logging in or out); the state keeps the old answer until then. */
  refresh(): Promise<Player | null> {
    this.pending = null;
    return this.load();
  }
}
