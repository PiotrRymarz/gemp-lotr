// Compares two folders of screenshots (e.g. two runs of stubbed.mjs) pixel by pixel.
//
//   node compare.mjs <dirA> <dirB> [--threshold 2] [--tolerance 0]
//
// For each PNG in either folder: the pixels where some channel (RGBA) differs by more than --threshold levels, and
// their bounding box. Exits with 1 if a file is missing on one side, the sizes differ, or more than --tolerance pixels
// differ in some file. Also run by `stubbed.mjs --compare <dirA> <dirB>`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';

/** The pixels of two PNG files that differ by more than `threshold` in some channel: { count, box } or { error }. */
export function comparePng(fileA, fileB, threshold = 2) {
  const a = PNG.sync.read(fs.readFileSync(fileA));
  const b = PNG.sync.read(fs.readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height) {
    return { error: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  let count = 0;
  let box = null;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      let differs = false;
      for (let c = 0; c < 4 && !differs; c++) differs = Math.abs(a.data[i + c] - b.data[i + c]) > threshold;
      if (!differs) continue;
      count++;
      if (!box) box = { left: x, top: y, right: x, bottom: y };
      else {
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y);
      }
    }
  }
  return { count, box };
}

const describeBox = (box) =>
  `${box.left},${box.top} to ${box.right},${box.bottom} (${box.right - box.left + 1}x${box.bottom - box.top + 1})`;

/** Compares every PNG of two folders, prints one line per file and returns the number of files over `tolerance`. */
export function compareDirs(dirA, dirB, { threshold = 2, tolerance = 0, log = console.log } = {}) {
  const pngs = (dir) => new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.png')));
  const inA = pngs(dirA);
  const inB = pngs(dirB);
  const names = [...new Set([...inA, ...inB])].sort();
  let failed = 0;
  let same = 0;
  for (const name of names) {
    if (!inA.has(name) || !inB.has(name)) {
      failed++;
      log(`${name}: only in ${inA.has(name) ? dirA : dirB}`);
      continue;
    }
    const result = comparePng(path.join(dirA, name), path.join(dirB, name), threshold);
    if (result.error) {
      failed++;
      log(`${name}: ${result.error}`);
    } else if (result.count === 0) {
      same++;
      log(`${name}: same`);
    } else {
      if (result.count > tolerance) failed++;
      log(`${name}: ${result.count} px differ, ${describeBox(result.box)}`);
    }
  }
  log(`${names.length} files: ${same} same, ${failed} over tolerance (${tolerance} px, threshold ${threshold} levels)`);
  return failed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      threshold: { type: 'string', default: '2' },
      tolerance: { type: 'string', default: '0' },
    },
  });
  if (positionals.length !== 2) {
    console.error('usage: node compare.mjs <dirA> <dirB> [--threshold 2] [--tolerance 0]');
    process.exit(2);
  }
  const failed = compareDirs(positionals[0], positionals[1], {
    threshold: Number(values.threshold),
    tolerance: Number(values.tolerance),
  });
  process.exit(failed ? 1 : 0);
}
