import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notifier } from '../../core/notifier/notifier';
import { FakeNotifier, provideFakeNotifier } from '../../testing/fake-notifier';
import { MERCHANT_VIEW_PROVIDERS, MerchantNotifier } from './merchant-notifier';

describe('MerchantNotifier', () => {
  let notifier: MerchantNotifier;
  let app: FakeNotifier;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideFakeNotifier()] });
    app = TestBed.inject(FakeNotifier);
    // As in the merchant route: a child injector of the app's
    const page = createEnvironmentInjector(MERCHANT_VIEW_PROVIDERS, TestBed.inject(EnvironmentInjector));
    notifier = page.get(MerchantNotifier);
    expect(page.get(Notifier)).toBe(notifier);
  });

  it('asks its yes/no questions itself, until answered', async () => {
    const yes = notifier.confirm('Buy?');
    expect(notifier.asking()).toBe('Buy?');
    notifier.answer(true);
    expect(await yes).toBe(true);
    expect(notifier.asking()).toBeNull();

    const no = notifier.confirm('Sell?');
    notifier.answer(false);
    expect(await no).toBe(false);
    expect(app.dialogs).toEqual([]);
  });

  it('answers No to an open question when another is asked', async () => {
    const first = notifier.confirm('First?');
    const second = notifier.confirm('Second?');
    expect(await first).toBe(false);
    expect(notifier.asking()).toBe('Second?');
    notifier.answer(true);
    expect(await second).toBe(true);
  });

  it("passes messages and text questions on to the app's Notifier", async () => {
    app.answers.push('text');
    await notifier.alert('Oops');
    expect(await notifier.askText('Name?')).toBe('text');
    expect(app.dialogs).toEqual(['alert: Oops', 'prompt: Name?']);
  });

  it('does nothing when answered with no question open', () => {
    expect(() => notifier.answer(true)).not.toThrow();
  });
});
