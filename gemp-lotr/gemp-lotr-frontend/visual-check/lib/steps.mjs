// Steps that scenarios of any page share. `which` is 'legacy' or 'angular'.

/** Waits for the page's requests to end and its rendering to settle. */
export async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

/** Rests the mouse on an element past the hover zoom's delay. */
export async function hover(page, selector) {
  await page.hover(selector);
  await page.waitForTimeout(800);
}

/**
 * Chooses a pane in the Angular page's tab bar (`.gd-page__tab[data-pane=...]`), when the theme shows it (the modern
 * theme on a phone or tablet shows one pane at a time); true if it did. Does nothing on the legacy page.
 */
export async function showPane(page, which, pane) {
  if (which !== 'angular') return false;
  const tab = page.locator(`.gd-page__tab[data-pane="${pane}"]`);
  if (!(await tab.isVisible())) return false;
  await tab.click();
  await page.waitForTimeout(100);
  return true;
}

/** Opens the shell's menu (`gd-menu`), when the theme shows it; true if it did. Does nothing on the legacy page. */
export async function openMenu(page, which) {
  if (which !== 'angular') return false;
  const button = page.locator('.gd-menu [data-action="menu"]');
  if (!(await button.isVisible())) return false;
  await button.click();
  return true;
}
