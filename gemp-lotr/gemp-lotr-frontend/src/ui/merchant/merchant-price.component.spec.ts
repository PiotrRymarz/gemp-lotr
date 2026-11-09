import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MerchantPriceComponent } from './merchant-price.component';

@Component({
  imports: [MerchantPriceComponent],
  template: `<gd-price [price]="price()" />`,
})
class Host {
  readonly price = signal(1205);
}

describe('MerchantPriceComponent', () => {
  it('shows gold and two-digit silver, with a space between, named for screen readers', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const price = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.gd-price')!;
    expect(price.querySelector('.gd-price__gold')!.textContent).toBe('12');
    expect(price.querySelector('.gd-price__silver')!.textContent).toBe('05');
    expect(price.textContent).toBe('12 05');
    expect(price.getAttribute('role')).toBe('img');
    expect(price.getAttribute('aria-label')).toBe('12 gold 05 silver');

    fixture.componentInstance.price.set(7);
    await fixture.whenStable();
    expect(price.textContent).toBe('0 07');
  });
});
