// Portrait-only pilots: crops each painted portrait to a 4:5 head-and-shoulders
// box and writes public/assets/pilots/<id>/<id>_portrait.jpg (432x540) and
// <id>_portrait_sm.jpg (240x300), the same outputs as tools/process-art.mjs.
// Pilots with full mecha art get their portrait from process-art.mjs instead.
//
//   node tools/process-portraits.mjs           all pilots below
//   node tools/process-portraits.mjs nova cass  just those

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'pilot concept art');
const OUT = path.join(ROOT, 'public', 'assets', 'pilots');

// crop: { left, top, width, height } 4:5 box in source pixels.
export const PORTRAITS = {
  nova: { folder: 'Nova-7', crop: { left: 140, top: 40, width: 480, height: 600 } },
  rufus: { folder: 'Rufus Graine', crop: { left: 120, top: 0, width: 520, height: 650 } },
  aiko: { folder: 'Aiko Branot', crop: { left: 220, top: 20, width: 560, height: 700 } }, // tight to the head and neck
  pike: { folder: 'Maj. Eldon Pike', crop: { left: 0, top: 0, width: 432, height: 540 } },
  zuri: { folder: 'Zuri Ankara', crop: { left: 40, top: 0, width: 480, height: 600 } },
  cass: { folder: 'Cass Rivera', crop: { left: 80, top: 0, width: 600, height: 750 } },
  holt: { folder: 'Holt & Holt', crop: { left: 192, top: 0, width: 800, height: 1000 } },
  warden: { folder: 'Warden', crop: { left: 0, top: 40, width: 640, height: 800 } },
  vincenzo: { folder: 'Vincenzo The Conqueror', crop: { left: 180, top: 60, width: 720, height: 900 } },
  quincy: { folder: 'Quincy', crop: { left: 40, top: 0, width: 640, height: 800 } },
};

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PORTRAITS);
for (const id of ids) {
  const cfg = PORTRAITS[id];
  if (!cfg) { console.error(`unknown pilot ${id}`); process.exitCode = 1; continue; }
  const src = path.join(SRC, cfg.folder, 'portrait.jpg');
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const crop = sharp(src).extract(cfg.crop);
  await crop.clone().resize(432, 540).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(dir, `${id}_portrait.jpg`));
  await crop.clone().resize(240, 300).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(dir, `${id}_portrait_sm.jpg`));
  const c = cfg.crop;
  console.log(`${id}: ${id}_portrait.jpg 432x540, ${id}_portrait_sm.jpg 240x300 (from ${c.width}x${c.height} crop at ${c.left},${c.top})`);
}
