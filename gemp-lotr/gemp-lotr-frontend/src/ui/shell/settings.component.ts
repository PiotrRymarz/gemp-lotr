import { Component, inject } from '@angular/core';
import { AutoZoomSetting } from '../../core/platform/auto-zoom-setting';
import { THEME_LABELS, THEMES, ThemeService } from '../../core/platform/theme.service';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { SettingsService } from './settings.service';

/**
 * The settings, for every page: the theme and the hover zoom (absent on touch devices, which have no hover). A
 * `gd-dialog`, opened through SettingsService (the shell's settings button, the deck builder toolbar's).
 *
 * DOM contract: `dialog.gd-dialog[data-dialog=settings]` holding `.gd-settings` with a `label.gd-settings__field` per
 * setting (`data-setting` = theme, auto-zoom), each with `.gd-settings__label` and its control
 * `.gd-settings__control` (theme: a `select`; auto-zoom: an `input[type=checkbox]`). A change applies at once.
 */
@Component({
  selector: 'gd-settings',
  imports: [DialogComponent],
  host: { style: 'display: contents' },
  template: `
    <gd-dialog name="settings" heading="Settings" [open]="settings.isOpen()" (closed)="settings.close()">
      <div class="gd-settings">
        <label class="gd-settings__field" data-setting="theme">
          <span class="gd-settings__label">Theme</span>
          <select class="gd-settings__control" (change)="selectTheme($event)">
            @for (option of themes; track option.name) {
              <option [value]="option.name" [selected]="option.name === theme.theme()">{{ option.label }}</option>
            }
          </select>
        </label>
        @if (zoom.available) {
          <label class="gd-settings__field" data-setting="auto-zoom">
            <input type="checkbox" class="gd-settings__control" [checked]="zoom.enabled()" (change)="setZoom($event)" />
            <span class="gd-settings__label">Zoom cards on hover</span>
          </label>
        }
      </div>
    </gd-dialog>
  `,
})
export class SettingsComponent {
  protected readonly settings = inject(SettingsService);
  protected readonly theme = inject(ThemeService);
  protected readonly zoom = inject(AutoZoomSetting);
  protected readonly themes = THEMES.map((name) => ({ name, label: THEME_LABELS[name] }));

  protected selectTheme(event: Event): void {
    void this.theme.select((event.target as HTMLSelectElement).value);
  }

  protected setZoom(event: Event): void {
    if ((event.target as HTMLInputElement).checked !== this.zoom.enabled()) {
      this.zoom.toggle();
    }
  }
}
