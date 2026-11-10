import { Provider } from '@angular/core';
import { ChatService } from '../chat/chat.service';
import { HallComms } from './hall-comms.service';
import { HallSession } from './hall-session.service';
import { HallTablesService } from './tables/hall-tables.service';

/**
 * The hall's own state, for its route's providers: the long-poll, the chat, the logged-in-or-not session and the
 * tables (4.2a). HallApi, HallTablesApi, ChatApi, GempHttp, PlayerService, Timers and LocalSettings are app-wide.
 * Parts 4.2b-4.5 add theirs here.
 */
export const HALL_SERVICES: Provider[] = [HallComms, ChatService, HallSession, HallTablesService];
