// Pilot art pipeline (ART_PIPELINE.md). Repeatable: reads a pilot's hand-made
// art from src/pilot concept art/<folder>/ (never modified) and writes
// game-ready files to public/assets/pilots/<id>/. Settings: tools/art.config.mjs.
//
//   node tools/process-art.mjs <id>                   process everything
//   node tools/process-art.mjs <id> --reset-anchors   also overwrite <id>.anchors.json
//   node tools/process-art.mjs <id> --demo-bgremoval  run the background-removal path
//                                                     on a synthetic dark/red-glow copy
//
// Outputs (OUT):
//   <id>_back@2x.png / <id>_back@1x.png              in-game sprite (360 / 180 px tall + padding)
//   <id>_back_outline@2x.png / _outline@1x.png       same with a dark outline
//   <id>_front@2x.png / <id>_front@1x.png            select preview + cut-in (600 / 300 px tall)
//   <id>_portrait.jpg / <id>_portrait_sm.jpg         4:5 crop (432x540 / 240x300)
//   <id>.anchors.json                                anchor points in @2x image pixels
// <id>.layers.json (layer masks) is hand-written; it is only read for the overlay.
// Previews (screenshots/<id>/process/): before/after sheets + anchor/mask overlay.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PILOT_ART } from './art.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ID = argv.find((a) => !a.startsWith('--'));
const CFG = PILOT_ART[ID];
if (!CFG) { console.error(`usage: node tools/process-art.mjs <${Object.keys(PILOT_ART).join('|')}> [--reset-anchors] [--demo-bgremoval]`); process.exit(1); }
const SRC = path.join(ROOT, 'src/pilot concept art', CFG.folder);
const OUT = path.join(ROOT, 'public/assets/pilots', ID);
const PREVIEW = path.join(ROOT, 'screenshots', ID, 'process');
const args = new Set(argv);

const BACK_H = { '2x': 360, '1x': 180 };     // trimmed sprite height per export
const PAD = { '2x': 6, '1x': 3 };            // transparent border (room for the outline)
const OUTLINE = { '2x': 4, '1x': 2 };        // outline thickness in export pixels
const OUTLINE_RGB = [8, 10, 18];
const FRONT_H = { '2x': 600, '1x': 300 };

const BACK_SRC = CFG.back;
const SOURCE_ANCHORS = CFG.anchors;

// ------------------------------------------------------------------ helpers

const raw = async (img) => {
  const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = ({ data, w, h }) => sharp(data, { raw: { width: w, height: h, channels: 4 } });

/** True if the image has meaningful transparency (some pixels well below opaque). */
function hasRealAlpha({ data }) {
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear++;
  return clear > data.length / 4 * 0.02;
}

/**
 * Remove a flat-ish background: flood-fill from every edge pixel through
 * pixels within `tol` of the edge colour (and dark, reddish glow pixels),
 * then feather the cut by `feather` px.
 */
function removeBackground(img, tol = 16, feather = 1.5, maxGrad = 10, glowRule = CFG.glowRule) {
  const { data, w, h } = img;
  // Local contrast: backgrounds and baked glows are smooth; line art and dark
  // armour panels are not, so the fill stops at the silhouette's outline even
  // where the armour is as dark as the background.
  const lumAt = (p) => 0.3 * data[p * 4] + 0.59 * data[p * 4 + 1] + 0.11 * data[p * 4 + 2];
  const grad = (p) => {
    const x = p % w, y = (p / w) | 0, l = lumAt(p);
    let g = 0;
    if (x > 0) g = Math.max(g, Math.abs(l - lumAt(p - 1)));
    if (x < w - 1) g = Math.max(g, Math.abs(l - lumAt(p + 1)));
    if (y > 0) g = Math.max(g, Math.abs(l - lumAt(p - w)));
    if (y < h - 1) g = Math.max(g, Math.abs(l - lumAt(p + w)));
    return g;
  };
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) edge.push(y * w, w - 1 + y * w);
  const med = [0, 1, 2].map((c) => {
    const v = edge.map((p) => data[p * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const bgLike = (p) => {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const d = Math.hypot(r - med[0], g - med[1], b - med[2]);
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    // Baked glow: dark, red-dominant haze around the silhouette.
    const glow = glowRule && lum < 110 && r > g * 1.4 && r > b * 1.3;
    return (d < tol || glow) && grad(p) < maxGrad;
  };
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (const p of edge) if (!bg[p] && bgLike(p)) { bg[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q >= 0 && !bg[q] && bgLike(q)) { bg[q] = 1; stack.push(q); }
    }
  }
  // Feather: alpha = blurred foreground mask (only ever lowers alpha).
  const mask = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = bg[p] ? 0 : 1;
  const soft = boxBlur(mask, w, h, Math.max(1, Math.round(feather)));
  for (let p = 0; p < w * h; p++) {
    const a = bg[p] ? 0 : Math.min(1, soft[p] * 2 - 0.0); // keep the interior solid
    data[p * 4 + 3] = Math.round(Math.min(data[p * 4 + 3], a * 255));
  }
  return img;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
    out[y * w + x] = s / n;
  }
  return out;
}

/** Zero the colour of fully transparent pixels (stops dark halos under filtering)
 *  and snap near-opaque alpha (>= 250) to 255. */
function cleanAlpha(img) {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
    else if (data[i + 3] >= 250) data[i + 3] = 255;
  }
  return img;
}

/** Bounding box of pixels with alpha > thr. */
function alphaBox({ data, w, h }, thr = 8) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > thr) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Dark outline: dilate alpha by r px (disc), fill OUTLINE_RGB, put the art on top. */
function outlined(img, r) {
  const { data, w, h } = img;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let dy = -r; dy <= r && a < 255; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const v = data[(yy * w + xx) * 4 + 3];
      if (v > a) a = v;
    }
    const i = (y * w + x) * 4, fa = data[i + 3] / 255, oa = a / 255;
    const ra = fa + oa * (1 - fa); // art over outline
    out[i + 3] = Math.round(ra * 255);
    for (let c = 0; c < 3; c++) {
      const v = ra > 0 ? (data[i + c] * fa + OUTLINE_RGB[c] * oa * (1 - fa)) / ra : 0;
      out[i + c] = Math.round(v);
    }
  }
  return { data: out, w, h };
}

const checker = (w, h, a = '#3a3f4a', b = '#262a33', s = 12) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="c" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse"><rect width="${s * 2}" height="${s * 2}" fill="${a}"/><rect width="${s}" height="${s}" fill="${b}"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="${b}"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);

/** Side-by-side sheet of PNG buffers over a checkerboard (and over white for halo checks). */
async function sheet(file, bufs, h = 420) {
  const tiles = [];
  for (const b of bufs) {
    const r = await sharp(b).resize({ height: h }).png().toBuffer();
    const m = await sharp(r).metadata();
    for (const bg of ['checker', '#f2f2f2']) {
      const base = bg === 'checker' ? sharp(checker(m.width, h)) : sharp({ create: { width: m.width, height: h, channels: 4, background: bg } });
      tiles.push({ buf: await base.composite([{ input: r }]).png().toBuffer(), w: m.width });
    }
  }
  const W = tiles.reduce((s, t) => s + t.w + 8, 8);
  let x = 8;
  const comp = tiles.map((t) => { const c = { input: t.buf, left: x, top: 8 }; x += t.w + 8; return c; });
  await sharp({ create: { width: W, height: h + 16, channels: 4, background: '#101218' } }).composite(comp).png().toFile(file);
}

/** Pretty JSON with one anchor per line (easy to diff and hand-edit). */
export function anchorsJson(json) {
  return `${JSON.stringify(json, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')}\n`;
}

// ------------------------------------------------------------------ steps

async function processBack(srcFile, label = 'back') {
  const img = await raw(srcFile);
  const before = await fromRaw({ ...img, data: Buffer.from(img.data) }).png().toBuffer();
  let removed = false;
  if (!hasRealAlpha(img)) { removeBackground(img); removed = true; }
  cleanAlpha(img);
  const box = alphaBox(img);
  const trimmed = await fromRaw(img).extract(box).png().toBuffer();
  const out = {};
  for (const k of ['2x', '1x']) {
    const scale = BACK_H[k] / box.height;
    const w = Math.round(box.width * scale);
    const resized = await sharp(trimmed).resize(w, BACK_H[k], { kernel: 'lanczos3' })
      .extend({ top: PAD[k], bottom: PAD[k], left: PAD[k], right: PAD[k], background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw().toBuffer({ resolveWithObject: true });
    const r = cleanAlpha({ data: resized.data, w: resized.info.width, h: resized.info.height });
    out[k] = { img: r, scale };
  }
  return { before, trimmed, box, out, removed };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PREVIEW, { recursive: true });
  const log = (...a) => console.log(`[${ID}]`, ...a);

  // 1–4. In-game sprite (back view).
  const back = await processBack(path.join(SRC, BACK_SRC));
  log(back.removed ? `${BACK_SRC}: no transparency → background removed by flood fill`
    : `${BACK_SRC}: already transparent → background removal skipped`);
  log(`trim box x${back.box.left} y${back.box.top} ${back.box.width}x${back.box.height}`);
  const written = {};
  for (const k of ['2x', '1x']) {
    const { img } = back.out[k];
    const f = `${ID}_back@${k}.png`, fo = `${ID}_back_outline@${k}.png`;
    await fromRaw(img).png({ compressionLevel: 9 }).toFile(path.join(OUT, f));
    await fromRaw(outlined(img, OUTLINE[k])).png({ compressionLevel: 9 }).toFile(path.join(OUT, fo));
    written[k] = { w: img.w, h: img.h };
    log(`${f} + ${fo}: ${img.w}x${img.h}`);
  }
  await sheet(path.join(PREVIEW, 'back_before_after.png'), [
    back.before,
    await fromRaw(back.out['2x'].img).png().toBuffer(),
    await sharp(path.join(OUT, `${ID}_back_outline@2x.png`)).toBuffer(),
  ]);

  // 5. Front view (select preview, cut-in) and portrait.
  const frontRaw = await raw(path.join(SRC, CFG.front));
  if (!hasRealAlpha(frontRaw)) { removeBackground(frontRaw); log(`${CFG.front}: no transparency → background removed by flood fill`); }
  const front = cleanAlpha(frontRaw);
  const fbox = alphaBox(front);
  const ftrim = await fromRaw(front).extract(fbox).png().toBuffer();
  for (const k of ['2x', '1x']) {
    const f = `${ID}_front@${k}.png`;
    const r = await sharp(ftrim).resize({ height: FRONT_H[k], kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    await fromRaw(cleanAlpha({ data: r.data, w: r.info.width, h: r.info.height })).png({ compressionLevel: 9 }).toFile(path.join(OUT, f));
    log(`${f}: ${r.info.width}x${r.info.height}`);
  }
  await sheet(path.join(PREVIEW, 'front_before_after.png'), [
    await sharp(path.join(SRC, CFG.front)).removeAlpha().png().toBuffer(), // what the hidden RGB holds
    await sharp(path.join(OUT, `${ID}_front@2x.png`)).toBuffer(),
  ]);

  const pm = await sharp(path.join(SRC, CFG.portrait)).metadata();
  const ph = Math.min(pm.height, Math.round(pm.width * 5 / 4));
  const crop = sharp(path.join(SRC, CFG.portrait)).extract({ left: 0, top: 0, width: pm.width, height: ph });
  await crop.clone().resize(432, 540).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(OUT, `${ID}_portrait.jpg`));
  await crop.clone().resize(240, 300).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(OUT, `${ID}_portrait_sm.jpg`));
  log(`${ID}_portrait.jpg 432x540, ${ID}_portrait_sm.jpg 240x300 (from ${pm.width}x${ph} crop)`);

  // 6. Anchors, scaled to the @2x export (origin = its top-left, padding included).
  const anchorsFile = path.join(OUT, `${ID}.anchors.json`);
  if (!fs.existsSync(anchorsFile) || args.has('--reset-anchors')) {
    const s = back.out['2x'].scale, pad = PAD['2x'];
    const anchors = {};
    for (const [k, [x, y]] of Object.entries(SOURCE_ANCHORS)) {
      anchors[k] = [+((x - back.box.left) * s + pad).toFixed(1), +((y - back.box.top) * s + pad).toFixed(1)];
    }
    const json = {
      version: 1,
      pilot: ID,
      space: `${ID}_back@2x.png pixels, origin top-left (1x = half)`,
      image: { w: written['2x'].w, h: written['2x'].h, artH: BACK_H['2x'], pad },
      anchors,
    };
    fs.writeFileSync(anchorsFile, anchorsJson(json));
    log(`${ID}.anchors.json written`);
  } else log(`${ID}.anchors.json kept (use --reset-anchors to regenerate)`);

  if (args.has('--demo-bgremoval')) await demoBgRemoval(log);
  await previewOverlay(log);
}

/** Anchor + layer-mask overlay on the @2x sprite (screenshots/<id>/process/overlay.png). */
async function previewOverlay(log) {
  const lf = path.join(OUT, `${ID}.layers.json`), af = path.join(OUT, `${ID}.anchors.json`);
  if (!fs.existsSync(lf) || !fs.existsSync(af)) return;
  const layers = JSON.parse(fs.readFileSync(lf, 'utf8')), anchors = JSON.parse(fs.readFileSync(af, 'utf8')).anchors;
  const K = 2, img = path.join(OUT, `${ID}_back@2x.png`);
  const m = await sharp(img).metadata();
  const cols = { wingL: '#38f', wingR: '#f3a' };
  let svg = '';
  for (const [k, L] of Object.entries(layers.layers)) {
    svg += `<polygon points="${L.poly.map(([x, y]) => `${x * K},${y * K}`).join(' ')}" fill="${cols[k] || '#ff0'}" fill-opacity="0.18" stroke="${cols[k] || '#ff0'}" stroke-width="1.5"/>`;
    svg += `<circle cx="${L.pivot[0] * K}" cy="${L.pivot[1] * K}" r="4" fill="none" stroke="#fff" stroke-width="1.5"/>`;
  }
  for (const [k, [x, y]] of Object.entries(anchors)) {
    svg += `<circle cx="${x * K}" cy="${y * K}" r="3.5" fill="#0f0" stroke="#000"/><text x="${x * K + 5}" y="${y * K - 4}" fill="#0f0" font-size="10" font-family="monospace" stroke="#000" stroke-width="2" paint-order="stroke">${k}</text>`;
  }
  const W = m.width * K, H = m.height * K;
  await sharp(checker(W, H)).composite([
    { input: await sharp(img).resize(W, H).toBuffer() },
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`) },
  ]).png().toFile(path.join(PREVIEW, 'overlay.png'));
  log(`anchor/layer overlay → screenshots/${ID}/process/overlay.png`);
}

/** Prove the no-transparency path: bake the sprite onto a dark background with
 *  a red glow (like the original export), run the removal, show before/after. */
async function demoBgRemoval(log) {
  const src = await sharp(path.join(SRC, BACK_SRC)).png().toBuffer();
  const m = await sharp(src).metadata();
  const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}">
    <defs><radialGradient id="g" cx="50%" cy="85%" r="45%"><stop offset="0" stop-color="#a01818" stop-opacity="0.85"/><stop offset="1" stop-color="#a01818" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="#14121a"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const baked = await sharp(glow).composite([{ input: src }]).removeAlpha().png().toBuffer();
  const tmp = path.join(PREVIEW, '_demo_baked.png');
  fs.writeFileSync(tmp, baked);
  const r = await processBack(tmp, 'demo');
  fs.unlinkSync(tmp);
  await sheet(path.join(PREVIEW, 'bgremoval_demo.png'), [baked, await fromRaw(r.out['2x'].img).png().toBuffer()]);
  log(`background-removal demo → screenshots/${ID}/process/bgremoval_demo.png (removed=${r.removed})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
