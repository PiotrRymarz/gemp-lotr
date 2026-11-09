import { Component, computed, input } from '@angular/core';
import { HallTab } from '../../core/hall/hall-tabs';

/** What each tab will show, for its placeholder's name. */
const CONTENT: Readonly<Record<string, string>> = {
  'game-hall': 'Tables',
  help: 'Help',
  events: 'Events',
  info: 'Server Info',
  users: 'Users',
  account: 'My Account',
  admin: 'Admin',
};

/**
 * Where a later part of the hall rewrite will draw a tab's content (HallTab.part: tables 4.2, Help and Server Info
 * 4.3, Events, Users and My Account 4.4, Admin 4.5). Empty; named for assistive technology. Each part replaces its
 * tab's placeholder with its own component.
 *
 * DOM contract: `gd-hall-placeholder.gd-hall-placeholder` (`data-tab`, `data-part`, `role=region`, `aria-label`
 * "Tables — coming in 4.2").
 */
@Component({
  selector: 'gd-hall-placeholder',
  host: {
    class: 'gd-hall-placeholder',
    role: 'region',
    '[attr.data-tab]': 'tab().slug',
    '[attr.data-part]': 'tab().part',
    '[attr.aria-label]': 'label()',
  },
  template: '',
})
export class HallPlaceholderComponent {
  readonly tab = input.required<HallTab>();
  protected readonly label = computed(
    () => `${CONTENT[this.tab().slug] ?? this.tab().label} — coming in ${this.tab().part}`,
  );
}
