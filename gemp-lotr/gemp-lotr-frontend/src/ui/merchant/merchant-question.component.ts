import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CardImageService } from '../../core/cards/card-image.service';
import { foilOverlayImage, readFoilPresentation } from '../../core/cards/foil-presentation';
import { MERCHANT_DIALOG_TITLE, questionWording } from '../../core/merchant/merchant-messages';
import { MerchantService } from '../../core/merchant/merchant.service';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { MerchantNotifier } from './merchant-notifier';
import { MerchantPriceComponent } from './merchant-price.component';

/**
 * The "Merchant operation" dialog (merchantUi.displayMerchantAction): the item, large, with its wiki link, beside the
 * question and Yes / No. Shows MerchantNotifier's questions; Escape or the close button is No.
 *
 * DOM contract: `gd-dialog` `data-dialog=merchant-question` holding `.gd-merchant-question` with
 * `.gd-merchant-question__item` (`figure.gd-merchant-question__card` with `data-orientation`, `data-borderless` for
 * a pack, `data-foil`, holding `img.gd-merchant-question__image` and `img.gd-merchant-question__foil`; then
 * `a.gd-merchant-question__wiki` when the card has a wiki page) and `.gd-merchant-question__text` (`p` with the
 * question, the price as `gd-price`, then `button.gd-button` `data-action` = yes, no). As in the legacy dialog, the
 * first control (the wiki link, else Yes) has the focus when it opens.
 */
@Component({
  selector: 'gd-merchant-question',
  imports: [DialogComponent, MerchantPriceComponent],
  host: { style: 'display: contents' },
  template: `
    <gd-dialog name="merchant-question" [heading]="title" [open]="asking() !== null" (closed)="notifier.answer(false)">
      @if (asking() !== null) {
        <div class="gd-merchant-question">
          @if (item(); as item) {
            <div class="gd-merchant-question__item">
              <figure
                class="gd-merchant-question__card"
                [attr.data-orientation]="item.horizontal ? 'horizontal' : 'vertical'"
                [attr.data-borderless]="item.pack ? '' : null"
                [attr.data-foil]="item.foil ? '' : null"
              >
                <img class="gd-merchant-question__image" [src]="item.imageUrl" alt="" />
                @if (item.foil) {
                  <img class="gd-merchant-question__foil" [src]="item.foil" alt="" />
                }
              </figure>
              @if (item.wikiUrl) {
                <a class="gd-merchant-question__wiki" [href]="item.wikiUrl" target="_blank">Wiki</a>
              }
            </div>
          }
          <div class="gd-merchant-question__text">
            <p class="gd-merchant-question__message">
              @if (wording(); as w) {
                {{ w.before }}<gd-price [price]="w.price" />{{ w.after }}
              } @else {
                {{ asking() }}
              }
            </p>
            <button type="button" class="gd-button" data-action="yes" (click)="notifier.answer(true)">Yes</button>
            <button type="button" class="gd-button" data-action="no" (click)="notifier.answer(false)">No</button>
          </div>
        </div>
      }
    </gd-dialog>
  `,
})
export class MerchantQuestionComponent {
  protected readonly notifier = inject(MerchantNotifier);
  private readonly merchant = inject(MerchantService);
  private readonly images = inject(CardImageService);
  private readonly foilImage = foilOverlayImage(readFoilPresentation(inject(DOCUMENT).cookie));
  protected readonly title = MERCHANT_DIALOG_TITLE;
  protected readonly asking = this.notifier.asking;

  /** The item asked about, drawn as the legacy full card. */
  protected readonly item = computed(() => {
    const question = this.merchant.question();
    if (!question) {
      return null;
    }
    const pack = question.item.kind === 'pack';
    const image = this.images.resolve(question.item.blueprintId, pack ? 'pack' : 'player');
    return {
      imageUrl: image.imageUrl,
      horizontal: image.horizontal,
      pack,
      foil: !pack && image.foil ? this.foilImage : null,
      wikiUrl: image.hasWiki ? image.wikiUrl : null,
    };
  });

  /** The question around its price, to draw the price as the page does; null for a question without one. */
  protected readonly wording = computed(() => {
    const question = this.merchant.question();
    if (!question) {
      return null;
    }
    const wording = questionWording(question.operation);
    const price = question.operation === 'sell' ? question.item.buyPrice : question.item.sellPrice;
    return wording.priced && price !== null ? { before: wording.before, after: wording.after, price } : null;
  });
}
