import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/** Leaves the app for another page in the same tab (e.g. the legacy hall after logging in). */
@Injectable({ providedIn: 'root' })
export class PageNavigation {
  private readonly window = inject(DOCUMENT).defaultView;

  go(url: string): void {
    this.window?.location.assign(url);
  }
}
