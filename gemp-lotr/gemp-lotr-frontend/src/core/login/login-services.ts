import { Provider } from '@angular/core';
import { LoginService } from './login.service';

/**
 * The login page's own state, provided by its route. LoginApi, PlayerService, the Notifier and the platform services
 * it uses are app-wide.
 */
export const LOGIN_SERVICES: Provider[] = [LoginService];
