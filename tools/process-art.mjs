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
//   <id>_wings@2x.png / <id>_wings_outline@2x.png    (config `wings`) the sprite with wing
//                                                     pixels hidden under held weapons filled
//                                                     from the mirrored wing
//   <id>.layers.json                                 (config `wings`) generated layer masks;
//                                                     otherwise hand-written, read for the overlay
//   <id>_turret.png                                  (config `turret`) cut-out from a sheet
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
function removeBackground(img, holes = [], tol = 16, feather = 1.5, maxGrad = 10, glowRule = CFG.glowRule, mode = CFG.bg, pale = false) {
  if (mode === 'checker') return removeChecker(img, holes, feather, pale);
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
  // Enclosed background (gaps the edge fill can't reach), seeded from the config.
  for (const [x, y] of holes) { const p = y * w + x; if (!bg[p] && bgLike(p)) { bg[p] = 1; stack.push(p); } }
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

const nbrs = (p, w, h) => {
  const x = p % w, y = (p / w) | 0;
  return [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
};

/**
 * Painted checkerboard background (two light neutral greys with sharp edges):
 * flood-fill light neutral pixels from the edges (the black line art stops
 * it), remove enclosed pockets (light neutral areas holding both checker
 * greys), then eat the grey anti-aliasing fringe next to the cut.
 * `pale`: pale tinted pixels count as background too (a soft glow baked over
 * the checkerboard, e.g. a concept sheet).
 */
function removeChecker(img, holes = [], feather = 1.5, pale = false) {
  const { data, w, h } = img;
  const N = w * h;
  const lum = (p) => 0.3 * data[p * 4] + 0.59 * data[p * 4 + 1] + 0.11 * data[p * 4 + 2];
  const hi = (p) => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const lo = (p) => Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const bgLike = (p) => (hi(p) - lo(p) <= 20 && lum(p) >= 180) || (pale && lo(p) >= 150 && lum(p) >= 185);
  const bg = new Uint8Array(N);
  const fill = (seeds) => {
    const stack = [];
    for (const p of seeds) if (!bg[p] && bgLike(p)) { bg[p] = 1; stack.push(p); }
    while (stack.length) {
      for (const q of nbrs(stack.pop(), w, h)) if (q >= 0 && !bg[q] && bgLike(q)) { bg[q] = 1; stack.push(q); }
    }
  };
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) edge.push(y * w, w - 1 + y * w);
  fill(edge);
  fill(holes.map(([x, y]) => y * w + x));
  // Enclosed pockets: connected light neutral areas holding both greys.
  const seen = new Uint8Array(N);
  let pockets = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (bg[p0] || seen[p0] || !bgLike(p0)) continue;
    const comp = [p0], stack = [p0];
    seen[p0] = 1;
    while (stack.length) {
      for (const q of nbrs(stack.pop(), w, h)) if (q >= 0 && !seen[q] && !bg[q] && bgLike(q)) { seen[q] = 1; stack.push(q); comp.push(q); }
    }
    if (comp.length < 150) continue;
    let dark = 0, light = 0;
    for (const p of comp) { const l = lum(p); if (l < 228) dark++; else if (l > 242) light++; }
    if (dark > comp.length * 0.12 && light > comp.length * 0.12) { for (const p of comp) bg[p] = 1; pockets++; }
  }
  // Fringe: grey anti-aliasing between the checkerboard and the line art.
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let p = 0; p < N; p++) {
      if (bg[p] || hi(p) - lo(p) > 26 || lum(p) < 110) continue;
      if (nbrs(p, w, h).some((q) => q >= 0 && bg[q])) add.push(p);
    }
    for (const p of add) bg[p] = 1;
  }
  const mask = new Float32Array(N);
  for (let p = 0; p < N; p++) mask[p] = bg[p] ? 0 : 1;
  const soft = boxBlur(mask, w, h, Math.max(1, Math.round(feather)));
  for (let p = 0; p < N; p++) {
    const a = bg[p] ? 0 : Math.min(1, soft[p] * 2);
    data[p * 4 + 3] = Math.round(Math.min(data[p * 4 + 3], a * 255));
  }
  img.pockets = pockets;
  return img;
}

/** Clear everything but the largest connected opaque piece (neighbours on a sheet). */
function largestPiece(img) {
  const { data, w, h } = img, N = w * h, lab = new Int32Array(N);
  let best = 0, bestN = 0, id = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (lab[p0] || data[p0 * 4 + 3] < 24) continue;
    const stack = [p0];
    lab[p0] = ++id;
    let n = 0;
    while (stack.length) {
      n++;
      for (const q of nbrs(stack.pop(), w, h)) if (q >= 0 && !lab[q] && data[q * 4 + 3] >= 24) { lab[q] = id; stack.push(q); }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  for (let p = 0; p < N; p++) if (lab[p] !== best) data[p * 4 + 3] = 0;
  return img;
}

/**
 * Glowing FX art painted over a checkerboard → a sprite with soft alpha.
 * The checkerboard (flood-filled from the edges, plus enclosed pockets holding
 * both greys, plus any light neutral grey) becomes transparent. Every other
 * pixel is "un-blended" from a mid-grey background B: it gets the least
 * opacity that explains how far it is from B (tint, darkness, or white
 * brightness), and its colour is solved from pixel = a·F + (1−a)·B. So pale
 * green glow turns into translucent emerald, black crystal and white cores
 * stay solid.
 */
function keyFx(img, tint = 'emerald', B = 208) {
  const { data, w, h } = img, N = w * h;
  const lum = (p) => 0.3 * data[p * 4] + 0.59 * data[p * 4 + 1] + 0.11 * data[p * 4 + 2];
  const spread = (p) => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) - Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const neutralLight = (p) => spread(p) <= 22 && lum(p) >= 160;
  const bg = new Uint8Array(N), stack = [];
  for (let x = 0; x < w; x++) for (const p of [x, x + (h - 1) * w]) if (!bg[p] && neutralLight(p)) { bg[p] = 1; stack.push(p); }
  for (let y = 0; y < h; y++) for (const p of [y * w, w - 1 + y * w]) if (!bg[p] && neutralLight(p)) { bg[p] = 1; stack.push(p); }
  while (stack.length) for (const q of nbrs(stack.pop(), w, h)) if (q >= 0 && !bg[q] && neutralLight(q)) { bg[q] = 1; stack.push(q); }
  const seen = new Uint8Array(N);
  for (let p0 = 0; p0 < N; p0++) { // enclosed checker pockets
    if (bg[p0] || seen[p0] || !neutralLight(p0)) continue;
    const comp = [p0];
    seen[p0] = 1;
    for (let k = 0; k < comp.length; k++) for (const q of nbrs(comp[k], w, h)) if (q >= 0 && !seen[q] && !bg[q] && neutralLight(q)) { seen[q] = 1; comp.push(q); }
    let dk = 0, lt = 0;
    for (const p of comp) { const l = lum(p); if (l < 205) dk++; else if (l > 220) lt++; }
    if (comp.length >= 30 && dk > comp.length * 0.1 && lt > comp.length * 0.1) for (const p of comp) bg[p] = 1;
  }
  for (let p = 0; p < N; p++) {
    const i = p * 4, l = lum(p), sp = spread(p);
    if (bg[p] || (sp <= 14 && l >= 160 && l < 242)) { data[i + 3] = 0; continue; }
    let a = Math.max(sp / 80, l < B ? ((B - l) / B) * 1.4 : 0, l > B && sp <= 30 ? (l - B) / (255 - B) : 0);
    a = Math.min(1, a);
    if (a < 0.04) { data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(B + (data[i + c] - B) / a)));
    data[i + 3] = Math.round(a * 255);
  }
  // Soft glow: the checkerboard still shows through it as grain, and solved
  // colours drift grey. Smooth the alpha there and tint it (emerald or red).
  const al = new Float32Array(N);
  for (let p = 0; p < N; p++) al[p] = data[p * 4 + 3] / 255;
  const sm = boxBlur(al, w, h, 2);
  for (let p = 0; p < N; p++) {
    const i = p * 4, a = al[p];
    if (a >= 0.75) continue;
    const s = Math.min(a, sm[p]) * (1 - a / 0.75) + a * (a / 0.75); // fade into the smoothed value
    data[i + 3] = Math.round(Math.max(0, s) * 255);
    const l = (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / 255, k = 0.65 * (1 - a / 0.75);
    const em = tint === 'red' ? [255 * Math.min(1, l * 1.15), 40 * l + 10, 50 * l + 15] : [70 * l + 20, 255 * Math.min(1, l * 1.15), 150 * l + 30];
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - k) + em[c] * k);
  }
  return img;
}

/** Point in polygon (even-odd rule). */
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const mirrorPoly = (poly, axis) => poly.map(([x, y]) => [2 * axis - x, y]).reverse();

/**
 * Clip a polygon to one side of the line a→b, shifted `off` px toward the kept
 * side's opposite (off > 0 keeps a strip past the line: an overlap tab).
 * keep = +1: the side left of a→b (cross > 0), -1: the other side.
 */
function clipPoly(poly, a, b, keep, off = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const side = ([x, y]) => keep * ((dx * (y - a[1]) - dy * (x - a[0])) / L) + off;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = side(P), sq = side(Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([+(P[0] + (Q[0] - P[0]) * t).toFixed(1), +(P[1] + (Q[1] - P[1]) * t).toFixed(1)]);
    }
  }
  return out;
}

/**
 * Component layers (config `parts`, source pixels) for a rigged pilot: named,
 * mirrored parts (e.g. a hand cannon, an inner and an outer wing blade). A part
 * with `split: [a, b]` becomes two sections across that line: `<name>Root`
 * (the side holding the pivot) and `<name>Tip` (with an `overlap` px tab under
 * the root, so the joint is seamless at rest). `exclude` names parts drawn
 * over this one: their pixels never go into it. Opt-in: `side: 'L' | 'R'` makes
 * a one-sided part (its poly is used as given, not mirrored; e.g. Lin's whip and
 * spear); `src: 'under'` takes the layer's pixels from the weapon-free image
 * (the `wings` fill, see fillWings).
 */
function partLayers(Pc, P) {
  const layers = {}, polys = {};
  for (const part of Pc.list) {
    polys[part.name] = part.side ? { [part.side]: part.poly } : { L: part.poly, R: mirrorPoly(part.poly, Pc.axis) };
  }
  for (const part of Pc.list) {
    for (const s of part.side ? [part.side] : ['L', 'R']) {
      const mir = s === 'R' && !part.side;
      const m = ([x, y]) => (mir ? [2 * Pc.axis - x, y] : [x, y]);
      const poly = polys[part.name][s], pivot = m(part.pivot);
      const exclude = (part.exclude || []).filter((n) => polys[n][s]).map((n) => polys[n][s].map(P));
      const base = { pivot: P(pivot), exclude, part: part.name, side: s, ...(part.src ? { src: part.src } : {}) };
      if (!part.split) { layers[part.name + s] = { ...base, poly: poly.map(P) }; continue; }
      const a = m(part.split[0]), b = m(part.split[1]);
      // Which side of a→b holds the pivot (the root)?
      const cr = Math.sign((b[0] - a[0]) * (pivot[1] - a[1]) - (b[1] - a[1]) * (pivot[0] - a[0]));
      layers[`${part.name}Tip${s}`] = { ...base, poly: clipPoly(poly, a, b, -cr, part.overlap ?? 8).map(P), section: 'tip' };
      layers[`${part.name}Root${s}`] = { ...base, poly: clipPoly(poly, a, b, cr).map(P), section: 'root' };
    }
  }
  return layers;
}

/**
 * Wing source for the layer split (config `wings`, source pixels): inside a
 * wing polygon, pixels covered by a held weapon (`keep` polygons) take the
 * mirrored wing's pixel; where the mirror is covered too, they are filled
 * from their neighbours, growing inward. Opt-in `fillAll` fills every covered
 * pixel (body too, not only the wings) and `fillGrow` grows the covered area by
 * that many px (the weapon's outline and glow go too): the rigged Lin v2 draws
 * its body and wings from this image, so moving weapons leave no hole. Opt-in
 * `fillSmooth: n` relaxes the neighbour-filled pixels n times (each becomes the
 * mean of its 8 neighbours), turning the fill's streaks into soft gradients.
 * Opt-in `fillMirror: false`: never copy the mirror (it holds a different part,
 * e.g. Sera's other arm); every covered pixel is filled from its neighbours.
 * Opt-in `fillClear: [poly, …]`: pixels covered on both sides inside these
 * polygons (and their mirror) become transparent instead (gaps between spikes).
 */
function fillWings(img, cfg) {
  const { data, w, h } = img;
  const out = Buffer.from(data);
  const wings = [cfg.wingL, mirrorPoly(cfg.wingL, cfg.axis)];
  const inKeep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cfg.keep.some((k) => inPoly(x, y, k))) inKeep[y * w + x] = 1;
  const g = cfg.fillGrow || 0, cov = g ? new Uint8Array(w * h) : inKeep;
  if (g) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inKeep[y * w + x]) continue;
    for (let yy = Math.max(0, y - g); yy <= Math.min(h - 1, y + g); yy++) for (let xx = Math.max(0, x - g); xx <= Math.min(w - 1, x + g); xx++) cov[yy * w + xx] = 1;
  }
  const covered = (x, y) => cov[y * w + x] === 1;
  const left = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!covered(x, y) || (!cfg.fillAll && !wings.some((wp) => inPoly(x, y, wp)))) continue;
    const mx = Math.round(2 * cfg.axis - x), p = (y * w + x) * 4;
    if (cfg.fillMirror !== false && mx >= 0 && mx < w && !covered(mx, y)) {
      const q = (y * w + mx) * 4;
      for (let c = 0; c < 4; c++) out[p + c] = data[q + c];
    } else left.add(y * w + x);
  }
  if (cfg.fillClear) {
    const clear = [...cfg.fillClear, ...cfg.fillClear.map((c) => mirrorPoly(c, cfg.axis))];
    for (const p of [...left]) {
      const x = p % w, y = (p / w) | 0;
      if (clear.some((c) => inPoly(x, y, c))) { out[p * 4 + 3] = 0; left.delete(p); }
    }
  }
  const filled = left.size;
  const fillIdx = cfg.fillSmooth ? [...left] : null;
  for (let pass = 0; pass < 400 && left.size; pass++) {
    const done = [];
    for (const p of left) {
      let n = 0;
      const acc = [0, 0, 0, 0];
      for (const q of nbrs(p, w, h)) {
        if (q < 0 || left.has(q)) continue;
        for (let c = 0; c < 4; c++) acc[c] += out[q * 4 + c];
        n++;
      }
      if (n) done.push([p, acc.map((v) => Math.round(v / n))]);
    }
    for (const [p, v] of done) { for (let c = 0; c < 4; c++) out[p * 4 + c] = v[c]; left.delete(p); }
  }
  for (let pass = 0; pass < (cfg.fillSmooth || 0); pass++) {
    const nv = fillIdx.map((p) => {
      const x = p % w, y = (p / w) | 0, acc = [0, 0, 0, 0];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h) { const q = (yy * w + xx) * 4; for (let c = 0; c < 4; c++) acc[c] += out[q + c]; n++; }
      }
      return acc.map((v) => Math.round(v / n));
    });
    fillIdx.forEach((p, i) => { for (let c = 0; c < 4; c++) out[p * 4 + c] = nv[i][c]; });
  }
  return { data: out, w, h, filled };
}

/**
 * Opt-in `erase` (source px): remove FX painted into the sprite (e.g. Sera's
 * nocked ice arrows). `clear` polygons become transparent; `strokes`
 * ([x0, y0, x1, y1, width]) are filled from their neighbours (growing inward,
 * or cleared where the strip crosses open background on both sides,
 * then relaxed `smooth` times); `keep` polygons are never touched. `largest:
 * true` then keeps only the largest connected piece (drops leftover fragments).
 */
function eraseArt(img, cfg) {
  const { data, w, h } = img;
  const keep = cfg.keep || [], kept = (x, y) => keep.some((k) => inPoly(x, y, k));
  let cleared = 0;
  for (const poly of cfg.clear || []) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let y = Math.max(0, Math.min(...ys) | 0); y <= Math.min(h - 1, Math.max(...ys)); y++) for (let x = Math.max(0, Math.min(...xs) | 0); x <= Math.min(w - 1, Math.max(...xs)); x++) {
      if (inPoly(x, y, poly) && !kept(x, y)) { data[(y * w + x) * 4 + 3] = 0; cleared++; }
    }
  }
  const left = new Set();
  for (const [x0, y0, x1, y1, wd] of cfg.strokes || []) {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, r = wd / 2;
    for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - r)); y <= Math.min(h - 1, Math.max(y0, y1) + r); y++) for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - r)); x <= Math.min(w - 1, Math.max(x0, x1) + r); x++) {
      const t = (x - x0) * ux + (y - y0) * uy;
      const o = (x - x0) * uy - (y - y0) * ux;
      if (t < 0 || t > L || Math.abs(o) > r || kept(x, y)) continue;
      // Over open background (transparent just past both edges of the strip): clear it, don't fill.
      const side = (k) => { const xx = Math.round(x + uy * (k - o)), yy = Math.round(y - ux * (k - o)); return xx < 0 || yy < 0 || xx >= w || yy >= h || data[(yy * w + xx) * 4 + 3] < (cfg.bgAlpha ?? 40); };
      if (side(r + 6) && side(-r - 6)) { data[(y * w + x) * 4 + 3] = 0; cleared++; continue; }
      left.add(y * w + x);
    }
  }
  const filled = [...left];
  for (let pass = 0; pass < 400 && left.size; pass++) {
    const done = [];
    for (const p of left) {
      let n = 0;
      const acc = [0, 0, 0, 0];
      for (const q of nbrs(p, w, h)) {
        if (q < 0 || left.has(q)) continue;
        for (let c = 0; c < 4; c++) acc[c] += data[q * 4 + c];
        n++;
      }
      if (n) done.push([p, acc.map((v) => Math.round(v / n))]);
    }
    for (const [p, v] of done) { for (let c = 0; c < 4; c++) data[p * 4 + c] = v[c]; left.delete(p); }
  }
  for (let pass = 0; pass < (cfg.smooth || 0); pass++) {
    const nv = filled.map((p) => {
      const x = p % w, y = (p / w) | 0, acc = [0, 0, 0, 0];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h) { const q = (yy * w + xx) * 4; for (let c = 0; c < 4; c++) acc[c] += data[q + c]; n++; }
      }
      return acc.map((v) => Math.round(v / n));
    });
    filled.forEach((p, i) => { for (let c = 0; c < 4; c++) data[p * 4 + c] = nv[i][c]; });
  }
  console.log(`[${ID}] erase: ${cleared} px cleared, ${filled.length} px filled from neighbours`);
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
  if (!hasRealAlpha(img)) { removeBackground(img, label === 'back' ? CFG.holes : [], undefined, undefined, undefined, undefined, CFG.bg, !!CFG.bgPale); removed = true; }
  if (label === 'back' && CFG.erase) { eraseArt(img, CFG.erase); if (CFG.erase.largest) largestPiece(img); } // opt-in: drop leftover fragments
  cleanAlpha(img);
  const box = alphaBox(img);
  const out = await exportsOf(img, box);
  return { before, box, out, removed, src: img };
}

/** Trim to `box`, then the @2x / @1x exports (BACK_H tall plus padding). */
async function exportsOf(img, box) {
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
  return out;
}

/** Source px → @2x export px for a processed sprite. */
const to2x = (back) => ([x, y]) => [
  +((x - back.box.left) * back.out['2x'].scale + PAD['2x']).toFixed(1),
  +((y - back.box.top) * back.out['2x'].scale + PAD['2x']).toFixed(1),
];

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

  if (back.src.pockets) log(`checkerboard: ${back.src.pockets} enclosed pockets removed`);

  // Wings (config `wings`): weapon-free wing source and generated layer masks.
  if (CFG.wings) {
    const Wc = CFG.wings, P = to2x(back);
    const filled = fillWings(back.src, Wc);
    const img = (await exportsOf(filled, back.box))['2x'].img;
    await fromRaw(img).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${ID}_wings@2x.png`));
    await fromRaw(outlined(img, OUTLINE['2x'])).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${ID}_wings_outline@2x.png`));
    log(`${ID}_wings@2x.png + outline (${filled.filled} px covered on both sides, filled from neighbours)`);
    const layers = {
      version: 1,
      pilot: ID,
      space: `${ID}_back@2x.png pixels, origin top-left (same as ${ID}.anchors.json); generated from tools/art.config.mjs`,
      feather: Wc.feather ?? 3,
      seam: Wc.seam ?? 10,
      under: true,
      keep: Wc.keep.map((k) => k.map(P)),
      layers: {
        wingL: { pivot: P(Wc.pivotL), poly: Wc.wingL.map(P) },
        wingR: { pivot: P([2 * Wc.axis - Wc.pivotL[0], Wc.pivotL[1]]), poly: mirrorPoly(Wc.wingL, Wc.axis).map(P) },
      },
    };
    fs.writeFileSync(path.join(OUT, `${ID}.layers.json`), anchorsJson(layers));
    log(`${ID}.layers.json written (wings under the body, ${Wc.keep.length} keep polygons)`);
  }

  // Component parts (config `parts`): rigged layers (hard holes in the body, see mechaArt splitLayers).
  if (CFG.parts) {
    const Pc = CFG.parts, P = to2x(back);
    const layers = {
      version: 1,
      pilot: ID,
      space: `${ID}_back@2x.png pixels, origin top-left (same as ${ID}.anchors.json); generated from tools/art.config.mjs`,
      rig: true,
      feather: Pc.feather ?? 0.8,
      grow: Pc.grow ?? 1.5,
      hole: Pc.hole ?? 0,
      ...(Pc.bodySrc ? { bodySrc: Pc.bodySrc } : {}),
      layers: partLayers(Pc, P),
    };
    fs.writeFileSync(path.join(OUT, `${ID}.layers.json`), anchorsJson(layers));
    log(`${ID}.layers.json written (rig: ${Object.keys(layers.layers).join(', ')})`);
  }

  // Turret (config `turret`): one cut-out from a concept sheet.
  if (CFG.turret) {
    const T = CFG.turret;
    const tr = await raw(await sharp(path.join(SRC, T.file)).extract(T.box).png().toBuffer());
    removeChecker(tr, [], 1.5, true);
    largestPiece(tr);
    cleanAlpha(tr);
    let tb = await fromRaw(tr).extract(alphaBox(tr)).png().toBuffer();
    if (T.rotate) tb = await sharp(tb).rotate(T.rotate).png().toBuffer();
    const r = await sharp(tb).resize({ height: T.height, kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    await fromRaw(cleanAlpha({ data: r.data, w: r.info.width, h: r.info.height })).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${ID}_turret.png`));
    log(`${ID}_turret.png: ${r.info.width}x${r.info.height}`);
    await sheet(path.join(PREVIEW, 'turret_before_after.png'), [
      await sharp(path.join(SRC, T.file)).extract(T.box).png().toBuffer(),
      await sharp(path.join(OUT, `${ID}_turret.png`)).toBuffer(),
    ], 260);
  }

  // FX sprites (config `fx`): glowing effect art over a checkerboard → <id>_fx_<name>.png.
  if (CFG.fx) {
    const tiles = [];
    for (const [name, F] of Object.entries(CFG.fx)) {
      const file = path.join(ROOT, F.file);
      // Real alpha (e.g. Miguerre's ultimate-fx.png) is kept; a painted checkerboard is un-blended.
      const src = await raw(F.box ? await sharp(file).extract(F.box).png().toBuffer() : file); // optional crop box
      const im = hasRealAlpha(src) ? src : keyFx(src, F.tint);
      cleanAlpha(im);
      let buf = await fromRaw(im).extract(alphaBox(im, 4)).png().toBuffer();
      if (F.rotate) buf = await sharp(buf).rotate(F.rotate).png().toBuffer();
      const r = await sharp(buf).resize({ height: F.height, kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
      fs.writeFileSync(path.join(OUT, `${ID}_fx_${name}.png`), r);
      const m = await sharp(r).metadata();
      log(`${ID}_fx_${name}.png: ${m.width}x${m.height}`);
      tiles.push(await sharp(file).png().toBuffer(), r);
    }
    await sheet(path.join(PREVIEW, 'fx_before_after.png'), tiles, 320);
  }

  // 5. Front view (select preview, cut-in) and portrait.
  const frontRaw = await raw(path.join(SRC, CFG.front));
  if (!hasRealAlpha(frontRaw)) { removeBackground(frontRaw, CFG.frontHoles, undefined, undefined, undefined, undefined, CFG.frontBg ?? CFG.bg); log(`${CFG.front}: no transparency → background removed by flood fill`); }
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

  // Portrait: 4:5 crop from the top, or the config's `portraitCrop` box (head and shoulders).
  const pm = await sharp(path.join(SRC, CFG.portrait)).metadata();
  const box = CFG.portraitCrop || { left: 0, top: 0, width: pm.width, height: Math.min(pm.height, Math.round(pm.width * 5 / 4)) };
  const crop = sharp(path.join(SRC, CFG.portrait)).extract(box);
  await crop.clone().resize(432, 540).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(OUT, `${ID}_portrait.jpg`));
  await crop.clone().resize(240, 300).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(OUT, `${ID}_portrait_sm.jpg`));
  log(`${ID}_portrait.jpg 432x540, ${ID}_portrait_sm.jpg 240x300 (from ${box.width}x${box.height} crop at ${box.left},${box.top})`);

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
  for (const poly of layers.keep || []) {
    svg += `<polygon points="${poly.map(([x, y]) => `${x * K},${y * K}`).join(' ')}" fill="#0f8" fill-opacity="0.15" stroke="#0f8" stroke-width="1" stroke-dasharray="3 2"/>`;
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
