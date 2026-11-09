import { inject, Injectable, Provider, signal } from '@angular/core';
import { Notifier } from '../../core/notifier/notifier';

/**
 * The merchant page's Notifier: its yes/no questions are asked in the page's own "Merchant operation" dialog
 * (`gd-merchant-question`), which shows the item beside the question as the legacy dialog did; messages and text
 * questions go on to the app's Notifier (the shell's `gd-notifier`).
 */
@Injectable()
export class MerchantNotifier extends Notifier {
  private readonly app = inject(Notifier, { skipSelf: true });
  private resolve: ((yes: boolean) => void) | null = null;

  /** The question being asked, or null. */
  readonly asking = signal<string | null>(null);

  alert(message: string): Promise<void> {
    return this.app.alert(message);
  }

  askText(message: string, defaultValue?: string): Promise<string | null> {
    return this.app.askText(message, defaultValue);
  }

  /** A question asked while another is open answers No to the earlier one. */
  confirm(message: string): Promise<boolean> {
    this.answer(false);
    this.asking.set(message);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** Yes or No (also closing the dialog, or Escape). */
  answer(yes: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.asking.set(null);
    resolve?.(yes);
  }
}

/** The merchant route's view providers, after MERCHANT_SERVICES: its services ask through MerchantNotifier. */
export const MERCHANT_VIEW_PROVIDERS: Provider[] = [
  MerchantNotifier,
  { provide: Notifier, useExisting: MerchantNotifier },
];
