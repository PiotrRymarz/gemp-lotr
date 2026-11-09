import { Injectable, signal } from '@angular/core';

/** Whether the settings dialog (`gd-settings`, in the shell) is open; anything on any page may open it. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly open_ = signal(false);

  readonly isOpen = this.open_.asReadonly();

  show(): void {
    this.open_.set(true);
  }

  close(): void {
    this.open_.set(false);
  }
}
