import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, Subject, tap, throwError } from 'rxjs';
import { SessionService } from '../session/session.service';
import { ApiError } from './api-error';
import { FormData, toFormParams } from './form-codec';
import { parseXml } from './xml';

/** Base path of the Gemp server API (RootUriRequestHandler). */
export const SERVER_URL = '/gemp-lotr-server';

/** Response header the server sets when opened-pack contents are waiting to be shown (Delivery-Service-Opened-Pack). */
export const OPENED_PACK_HEADER = 'Delivery-Service-Opened-Pack';

export interface RequestOptions {
  /** Send the session's participantId (default true; the legacy client sent it with nearly every call). */
  participant?: boolean;
  /** GET only: add a cache-busting parameter, like jQuery's cache:false (default true). */
  noCache?: boolean;
}

/** A successful answer with its HTTP status (see GempHttp.postForStatus). */
export interface StatusResponse {
  status: number;
  body: string;
}

/**
 * Low-level access to the Gemp server, matching how the legacy communication.js talks to it:
 * form-encoded parameters (strictly encoded), participantId added, GETs not cached, failures turned into ApiError,
 * and the opened-pack delivery header reported through openedPackAnnounced$.
 */
@Injectable({ providedIn: 'root' })
export class GempHttp {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly openedPackAnnounced = new Subject<void>();

  /** Emits whenever a response says opened-pack contents are ready to be fetched (see PackDeliveryService). */
  readonly openedPackAnnounced$: Observable<void> = this.openedPackAnnounced.asObservable();

  getText(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<string> {
    let params = toFormParams(this.withParticipant(data, options));
    if (options.noCache !== false) {
      params = params.set('_', String(Date.now()));
    }
    return this.handle(this.http.get(SERVER_URL + path, { params, responseType: 'text', observe: 'response' }));
  }

  /** POSTs the data form-encoded (HttpParams bodies are sent as application/x-www-form-urlencoded). */
  postText(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<string> {
    const body = toFormParams(this.withParticipant(data, options));
    return this.handle(this.http.post(SERVER_URL + path, body, { responseType: 'text', observe: 'response' }));
  }

  /**
   * POSTs like postText, but also gives the status of a successful answer, for the calls whose 2xx status means
   * something (POST /login answers 202 when the account's password was reset).
   */
  postForStatus(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<StatusResponse> {
    const body = toFormParams(this.withParticipant(data, options));
    return this.http.post(SERVER_URL + path, body, { responseType: 'text', observe: 'response' }).pipe(
      tap((response) => this.announceOpenedPack(response)),
      map((response) => ({ status: response.status, body: response.body ?? '' })),
      catchError((error: unknown) => throwError(() => ApiError.from(error))),
    );
  }

  getXml(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<Document> {
    return this.getText(path, data, options).pipe(map(GempHttp.toXml));
  }

  postXml(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<Document> {
    return this.postText(path, data, options).pipe(map(GempHttp.toXml));
  }

  getJson<T>(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<T> {
    return this.getText(path, data, options).pipe(map((text) => GempHttp.toJson<T>(text)));
  }

  postJson<T>(path: string, data: FormData = {}, options: RequestOptions = {}): Observable<T> {
    return this.postText(path, data, options).pipe(map((text) => GempHttp.toJson<T>(text)));
  }

  private withParticipant(data: FormData, options: RequestOptions): FormData {
    if (options.participant === false) {
      return data;
    }
    return { participantId: this.session.participantId, ...data };
  }

  private handle(response$: Observable<HttpResponse<string>>): Observable<string> {
    return response$.pipe(
      tap((response) => this.announceOpenedPack(response)),
      map((response) => response.body ?? ''),
      catchError((error: unknown) => throwError(() => ApiError.from(error))),
    );
  }

  private announceOpenedPack(response: HttpResponse<string>): void {
    if (response.headers.get(OPENED_PACK_HEADER) === 'true') {
      this.openedPackAnnounced.next();
    }
  }

  private static toXml(text: string): Document {
    try {
      return parseXml(text);
    } catch (error) {
      throw ApiError.from(error);
    }
  }

  private static toJson<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw ApiError.from(error);
    }
  }
}
