import { Provider } from '@angular/core';
import { ChatService } from '../chat/chat.service';
import { HallComms } from './hall-comms.service';
import { HallSession } from './hall-session.service';

/**
 * The hall's own state, for its route's providers: the long-poll, the chat and the logged-in-or-not session. HallApi,
 * ChatApi, GempHttp, PlayerService, Timers and LocalSettings are app-wide. Parts 4.2-4.5 add theirs here.
 */
export const HALL_SERVICES: Provider[] = [HallComms, ChatService, HallSession];
