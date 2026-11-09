import { TestBed } from '@angular/core/testing';
import { AutoZoomSetting } from '../../core/platform/auto-zoom-setting';
import { PAGE_QUERY_STRING } from '../../core/platform/page-location';
import { THEME_LABELS, THEMES, ThemeService } from '../../core/platform/theme.service';
import { SettingsComponent } from './settings.component';
import { SettingsService } from './settings.service';

describe('SettingsComponent', () => {
  let settings: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_QUERY_STRING, useValue: '' }] });
    settings = TestBed.inject(SettingsService);
    // jsdom takes touch events, which counts as a touch device: these tests are on a computer unless they say not
    Object.defineProperty(TestBed.inject(AutoZoomSetting), 'available', { value: true });
  });

  async function render() {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector<HTMLDialogElement>('dialog.gd-dialog')!;
    const open = async () => {
      settings.show();
      await fixture.whenStable();
    };
    return { fixture, el, dialog, open };
  }

  it('is a settings dialog with a field per setting (DOM contract)', async () => {
    const { dialog, open } = await render();
    expect(dialog.dataset['dialog']).toBe('settings');
    expect(dialog.querySelector('.gd-dialog__title')!.textContent).toBe('Settings');
    await open();
    const fields = Array.from(dialog.querySelectorAll<HTMLLabelElement>('.gd-settings > label.gd-settings__field'));
    expect(fields.map((field) => field.dataset['setting'])).toEqual(['theme', 'auto-zoom']);
    expect(fields.every((field) => field.querySelector('.gd-settings__label') !== null)).toBe(true);
    const theme = fields[0].querySelector<HTMLSelectElement>('select.gd-settings__control')!;
    expect(Array.from(theme.options).map((o) => [o.value, o.textContent])).toEqual(
      THEMES.map((name) => [name, THEME_LABELS[name]]),
    );
    expect(fields[1].querySelector('input[type=checkbox].gd-settings__control')).not.toBeNull();
  });

  it('opens and closes through SettingsService', async () => {
    const { fixture, dialog, open } = await render();
    expect(dialog.open).toBe(false);
    await open();
    expect(dialog.open).toBe(true);
    // The first control has the focus, as in every dialog
    expect(document.activeElement).toBe(dialog.querySelector('select.gd-settings__control'));
    dialog.querySelector<HTMLButtonElement>('.gd-dialog__close')!.click();
    await fixture.whenStable();
    expect(settings.isOpen()).toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('changes the theme', async () => {
    const { dialog, open } = await render();
    const themes = TestBed.inject(ThemeService);
    const select = vi.spyOn(themes, 'select').mockResolvedValue();
    await open();
    const theme = dialog.querySelector<HTMLSelectElement>('select.gd-settings__control')!;
    expect(theme.value).toBe(themes.theme());
    theme.value = 'modern';
    theme.dispatchEvent(new Event('change'));
    expect(select).toHaveBeenCalledWith('modern');
  });

  it('turns the hover zoom on and off', async () => {
    const { fixture, dialog, open } = await render();
    const zoom = TestBed.inject(AutoZoomSetting);
    const initial = zoom.enabled();
    await open();
    const box = dialog.querySelector<HTMLInputElement>('input[type=checkbox].gd-settings__control')!;
    expect(box.checked).toBe(initial);
    box.click();
    await fixture.whenStable();
    expect(zoom.enabled()).toBe(!initial);
    expect(box.checked).toBe(!initial);
    zoom.toggle();
  });

  it('has no hover zoom setting on touch devices', async () => {
    Object.defineProperty(TestBed.inject(AutoZoomSetting), 'available', { value: false });
    const { dialog, open } = await render();
    await open();
    expect(dialog.querySelector('[data-setting="auto-zoom"]')).toBeNull();
  });
});
