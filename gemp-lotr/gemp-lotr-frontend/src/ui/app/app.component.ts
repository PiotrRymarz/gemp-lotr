import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellComponent } from '../shell/shell.component';

/**
 * The app's root: the shell (ui/shell: the header, the settings) around the page of the current address
 * (app.routes.ts). It draws no box of its own; the theme decides the shell's.
 */
@Component({
  selector: 'gemp-app',
  imports: [RouterOutlet, ShellComponent],
  host: { style: 'display: contents' },
  template: `<gd-shell><router-outlet /></gd-shell>`,
})
export class AppComponent {}
