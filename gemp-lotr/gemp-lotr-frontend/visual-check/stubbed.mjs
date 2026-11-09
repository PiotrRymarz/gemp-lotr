// Screenshots each legacy page and its Angular page side by side with no Gemp server: both are served from disk (the
// legacy web root and the Angular build output) and the server's answers come from the page's module in pages/ (see
// pages/index.mjs and README.md). Needs a build of the Angular app (npm run build). It compares nothing by itself;
// `--compare` (or compare.mjs) compares two runs.
//
//   node stubbed.mjs [--page deckbuilder,...] [--scenario collection,...] [--theme classic|modern]
//                    [--angular '<path>' | '?<query>'] [--viewport 1440x900,phone,tablet] [--touch]
//                    [--out report-stubbed] [--timeout 10000]
//   node stubbed.mjs --compare <dirA> <dirB> [--threshold 2] [--tolerance 0]
//
// Writes <out>/<page>-<scenario>-<size>-{legacy,angular}.png (the deck builder's without "<page>-"). --touch emulates
// a phone or tablet (a touch screen, so `pointer: coarse`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { compareDirs } from './compare.mjs';
import { settle } from './lib/steps.mjs';
import { ORIGIN, route } from './lib/stub-server.mjs';
import { PAGES } from './pages/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Window size presets for --viewport. */
export const VIEWPORTS = { desktop: '1440x900', laptop: '1280x800', phone: '390x844', tablet: '820x1180' };

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    page: { type: 'string' },
    scenario: { type: 'string' },
    only: { type: 'string' },
    theme: { type: 'string', default: 'classic' },
    angular: { type: 'string' },
    legacy: { type: 'string' },
    viewport: { type: 'string' },
    sizes: { type: 'string' },
    touch: { type: 'boolean', default: false },
    out: { type: 'string', default: 'report-stubbed' },
    timeout: { type: 'string', default: '10000' },
    compare: { type: 'boolean', default: false },
    threshold: { type: 'string', default: '2' },
    tolerance: { type: 'string', default: '0' },
  },
});

if (options.compare) {
  if (positionals.length !== 2) {
    console.error('usage: node stubbed.mjs --compare <dirA> <dirB> [--threshold 2] [--tolerance 0]');
    process.exit(2);
  }
  const failed = compareDirs(positionals[0], positionals[1], {
    threshold: Number(options.threshold),
    tolerance: Number(options.tolerance),
  });
  process.exit(failed ? 1 : 0);
}

const list = (value) => (value ? new Set(value.split(',').map((s) => s.trim())) : null);
const pageNames = list(options.page);
const scenarioNames = list(options.scenario ?? options.only);
const pages = PAGES.filter((p) => !pageNames || pageNames.has(p.name));
for (const name of pageNames ?? []) {
  if (!PAGES.some((p) => p.name === name)) {
    console.error(`unknown page ${name} (pages: ${PAGES.map((p) => p.name).join(', ')})`);
    process.exit(2);
  }
}

const sizes = (options.viewport ?? options.sizes ?? 'desktop').split(',').map((s) => {
  const label = VIEWPORTS[s] ?? s;
  const [width, height] = label.split('x').map(Number);
  if (!width || !height) {
    console.error(`bad viewport ${s} (WxH or ${Object.keys(VIEWPORTS).join(', ')})`);
    process.exit(2);
  }
  return { width, height, label };
});

/**
 * The Angular page's address: --angular as a path (starting with /) replaces the page's, as a query (?a=b or a=b)
 * is added to it; then ?theme=<--theme>, unless the address names a theme.
 */
function angularAddress(page) {
  let address = page.angular;
  const given = options.angular;
  if (given?.startsWith('/')) address = given;
  else if (given) address += (address.includes('?') ? '&' : '?') + given.replace(/^\?/, '');
  const url = new URL(address, ORIGIN);
  if (!url.searchParams.has('theme')) url.searchParams.set('theme', options.theme);
  return url.pathname + url.search;
}

const outDir = path.resolve(HERE, options.out);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const timeout = Number(options.timeout);
const failures = [];
let shots = 0;
for (const page of pages) {
  const angular = angularAddress(page);
  const theme = new URL(angular, ORIGIN).searchParams.get('theme');
  for (const size of sizes) {
    const mode = { theme, touch: options.touch, width: size.width, height: size.height };
    for (const scenario of page.scenarios.filter((s) => !scenarioNames || scenarioNames.has(s.name))) {
      const skipped = page.skip?.(scenario, mode) || scenario.skip?.(mode);
      if (skipped) {
        console.log(`skip ${page.name}/${scenario.name} ${size.label}: ${skipped}`);
        continue;
      }
      const sides = [...(page.legacy ? [['legacy', options.legacy ?? page.legacy]] : []), ['angular', angular]];
      for (const [which, address] of sides) {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          ...(options.touch ? { isMobile: true, hasTouch: true } : {}),
        });
        context.setDefaultTimeout(timeout);
        const log = [];
        await route(context, log, page.answer, scenario);
        const tab = await context.newPage();
        tab.on('pageerror', (error) => log.push(`page error: ${error.message}`));
        const file = path.join(outDir, `${page.prefix ?? `${page.name}-`}${scenario.name}-${size.label}-${which}.png`);
        try {
          await tab.goto(ORIGIN + address);
          await settle(tab);
          if (which === 'angular' || !scenario.angularOnly) await scenario.act(tab, which);
          // A scenario with a request left unanswered (`pending`) never goes idle: a short wait instead
          if (scenario.pending) await tab.waitForTimeout(400);
          else await settle(tab);
          await tab.screenshot({ path: file });
          shots++;
          console.log(`${file}${log.length ? `\n  ${[...new Set(log)].join('\n  ')}` : ''}`);
        } catch (error) {
          failures.push(`${page.name}/${scenario.name} ${size.label} ${which}: ${error.message.split('\n')[0]}`);
          console.log(`FAILED ${failures.at(-1)}`);
        }
        await context.close();
      }
    }
  }
}
await browser.close();
console.log(
  `${shots} screenshots in ${outDir}, ${failures.length} failed${failures.length ? `:\n  ${failures.join('\n  ')}` : ''}`,
);
process.exit(failures.length ? 1 : 0);
