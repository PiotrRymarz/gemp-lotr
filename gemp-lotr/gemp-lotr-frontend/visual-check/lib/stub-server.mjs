// The stub server shared by every page of stubbed.mjs: serves the legacy web root and the Angular build output from
// disk through Playwright routes, answers /gemp-lotr-server/ requests from the page module (and the scenario's own
// `answers`), and replaces card images (on i.lotrtcgpc.net) with labelled placeholders, the same on both pages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FRONTEND = path.resolve(HERE, '../..');
export const WEB = path.resolve(FRONTEND, '../gemp-lotr-async/src/main/web');
export const BUILD = path.join(WEB, 'ng');
export const RESPONSES = path.join(FRONTEND, 'src/testing/server-responses');
export const ORIGIN = 'http://gemp.test';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/** A card-sized placeholder with the image's name, so cards can be told apart. */
export function placeholder(url) {
  const name = decodeURIComponent(url.pathname.split('/').pop());
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="357" height="497" viewBox="0 0 357 497">
<rect width="357" height="497" fill="hsl(${hue} 40% 35%)"/><rect x="20" y="20" width="317" height="250" fill="hsl(${hue} 30% 55%)"/>
<text x="178" y="340" font-family="sans-serif" font-size="34" fill="#fff" text-anchor="middle">${name}</text></svg>`;
}

const isImage = (url) => /\.(jpe?g|png|gif)$/i.test(url.pathname);

/**
 * Routes every request of `context`. `answer(path, url, request, scenario)` is the page module's: the server's answer
 * for a /gemp-lotr-server/ path (without that prefix), as { json } | { xml } | { file, type } (from
 * src/testing/server-responses) | { status }, or null (404, logged). A scenario's `answers[path]` comes first.
 */
export async function route(context, log, answer, scenario) {
  await context.route(/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) {
      if (isImage(url)) return route.fulfill({ contentType: 'image/svg+xml', body: placeholder(url) });
      return route.fulfill({ status: 404, body: '' });
    }
    if (url.pathname.startsWith('/gemp-lotr-server/')) {
      const p = url.pathname.replace('/gemp-lotr-server', '');
      const found = scenario.answers?.[p] ?? answer(p, url, request, scenario);
      if (!found) {
        log.push(`unanswered ${request.method()} ${url.pathname}`);
        return route.fulfill({ status: 404, body: '' });
      }
      if (found.status) return route.fulfill({ status: found.status, body: '' });
      if (found.json) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(found.json) });
      if (found.xml) return route.fulfill({ contentType: 'application/xml', body: found.xml });
      return route.fulfill({ path: path.join(RESPONSES, found.file), contentType: found.type ?? 'application/xml' });
    }
    let file;
    if (url.pathname.startsWith('/gemp-lotr/ng/')) {
      file = path.join(BUILD, url.pathname.slice('/gemp-lotr/ng/'.length));
      // As the server does (WebRequestHandler): an app route (no extension) that isn't a file serves the app's index
      const appRoute = !path.basename(url.pathname).includes('.') || url.pathname.endsWith('/');
      if (appRoute && (!fs.existsSync(file) || fs.statSync(file).isDirectory())) file = path.join(BUILD, 'index.html');
    } else {
      file = path.join(WEB, url.pathname.replace(/^\/gemp-lotr\//, ''));
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (isImage(url)) return route.fulfill({ contentType: 'image/svg+xml', body: placeholder(url) });
      log.push(`missing ${url.pathname}`);
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ path: file, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream' });
  });
}
