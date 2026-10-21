import { snow as snowSurf } from '../paint/surfaces.js';
import { debris, scorch, crate, drum, sandbags } from '../paint/props.js';
import { trench, barbedWire, meshHedgehog, meshBunker, meshBoulder } from '../kit/terrain.js';
import { shade } from '../paint/core.js';
import { RNG } from '../../core/RNG.js';

// FROZEN FRONTLINE: a snowbound, war-torn front (White Fang's level).
//
// A central combat corridor of churned snow criss-crossed by tread ruts
// (including the siege tank's own giant ones) and shell craters, with the
// battle's leftovers built up toward the flanks: snow-capped dry-stone walls
// with breaches, post-and-rail fences, Czech hedgehogs, sandbag nests,
// trench runs, rows of leaning utility poles with sagging wires, burnt-out
// trucks, carts and tanks (burning, smoking), crate and drum dumps.
//
// Everything continuous across chunks (ruts, pole lines) is a seeded
// function of y, so seams never show. Params:
//   craters 0..1, walls 0..1, wrecks 0..1, fires 0..1, poles (bool)

const LEN = 512;
const SNOW = [0.9, 0.93, 0.97];
const DIRT = [0.33, 0.3, 0.27];
const TAU = Math.PI * 2;

export default {
  id: 'frontline',
  label: 'Frozen frontline',
  defaults: { craters: 0.8, walls: 0.8, wrecks: 0.7, fires: 0.6, poles: true },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    // Tread ruts: [gauge, band width, phase, amplitude, wavelength, base x, kind].
    const R = new RNG(`${seed}:ruts`);
    const ruts = [
      { x: 0, gauge: 176, w: 30, amp: 34, wl: 1700, ph: R.angle(), big: true },     // White Fang's own path
      { x: -40, gauge: 176, w: 30, amp: 60, wl: 2300, ph: R.angle(), big: true, fade: true },
    ];
    for (let i = 0; i < 9; i++) ruts.push({ x: R.range(-260, 260), gauge: R.range(24, 34), w: R.range(6, 8), amp: R.range(30, 120), wl: R.range(900, 2600), ph: R.angle(), tilt: R.range(-0.25, 0.25) });
    const rutX = (r, y) => r.x + Math.sin(y / r.wl * TAU + r.ph) * r.amp + (r.tilt || 0) * ((y % 4000) - 2000) * 0.1;
    // Utility pole lines down both flanks (one pole every 150 units).
    const poleAt = (side, m) => {
      const Rp = new RNG(`${seed}:pole:${side}:${m}`);
      return { x: side * (212 + Math.sin(m * 0.37) * 18) + Rp.range(-6, 6), y: m * 150 + Rp.range(-10, 10), lean: Rp.chance(0.2) ? Rp.range(-0.5, 0.5) : Rp.range(-0.06, 0.06), down: Rp.chance(0.08), seed: Rp.next() };
    };
    const S = { P, seed, ruts, rutX, poleAt, dust: [0.75, 0.78, 0.82] };
    S.layers = [{
      id: 'ground', z: 0, x0: -470, x1: 470, length: LEN, ppu: 1.35, glow: P.fires > 0,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay, c) => mesh(mb, lay, S, c),
    }];
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

// ------------------------------------------------------------- layout

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { craters: [], walls: [], fences: [], hogs: [], nests: [], trenches: [], wrecks: [], dumps: [], bunkers: [], rocks: [], anchors: [], debris: [] };
  // Craters: fewer and smaller in the central lane so the fight stays readable.
  for (let i = 0; i < 5 + 12 * P.craters; i++) {
    const x = R.range(-300, 300), centre = Math.abs(x) < 120;
    if (centre && R.chance(0.45)) continue;
    lay.craters.push({ x, y: R.range(y0, y1), r: R.range(8, centre ? 18 : 26) * (R.chance(0.08) ? 1.6 : 1), seed: R.next() });
  }
  // Dry-stone walls on the flanks (with breaches), sometimes one running across.
  for (const side of [-1, 1]) {
    if (!R.chance(0.55 * P.walls + 0.25)) continue;
    const x = side * R.range(140, 205), ya = R.range(y0 + 10, y1 - 200), len = R.range(140, 300), pts = [];
    let px = x, py = ya, a = Math.PI / 2 + R.range(-0.35, 0.35);
    for (let s = 0; s < len; s += 24) { pts.push([px, py]); a += R.range(-0.15, 0.15); px += Math.cos(a) * 24; py += Math.sin(a) * 24; }
    lay.walls.push({ pts, gaps: [R.int(1, Math.max(1, pts.length - 3))], seed: R.next() });
  }
  if (R.chance(0.35 * P.walls)) {
    const y = R.range(y0 + 60, y1 - 60), pts = [];
    for (let x = -460; x <= 460; x += 24) pts.push([x, y + Math.sin(x * 0.01 + y) * 10]);
    const g = Math.round((R.range(-120, 120) + 460) / 24);
    lay.walls.push({ pts, gaps: [g, g + 1, g + 2, g + 3, g + 4, R.int(2, 8), R.int(30, 37)], seed: R.next(), cross: true });
  }
  // Post-and-rail fences (some flattened).
  for (let i = 0; i < 2; i++) if (R.chance(0.6)) {
    const side = R.sign(), x = side * R.range(130, 250), y = R.range(y0, y1), a = R.range(-0.6, 0.6) + (R.chance(0.5) ? Math.PI / 2 : 0);
    lay.fences.push({ x, y, a, n: R.int(4, 9), broken: R.next(), seed: R.next() });
  }
  // Czech hedgehog rows.
  if (R.chance(0.6)) {
    const side = R.sign(), x0 = side * R.range(110, 160), y = R.range(y0 + 40, y1 - 40);
    for (let k = 0; k < R.int(3, 6); k++) lay.hogs.push({ x: x0 + side * k * R.range(20, 30), y: y + R.range(-12, 12), rot: R.angle() });
  }
  if (R.chance(0.4)) for (let k = 0; k < 3; k++) lay.hogs.push({ x: R.range(-150, 150), y: R.range(y0, y1), rot: R.angle() });
  // Sandbag nests and trench runs on the flanks.
  if (R.chance(0.5)) lay.nests.push({ x: R.sign() * R.range(150, 250), y: R.range(y0 + 30, y1 - 30), r: R.range(14, 22), seed: R.next() });
  if (R.chance(0.45)) {
    const side = R.sign(), xa = side * R.range(175, 215), ya = R.range(y0 + 20, y1 - 220), pts = [];
    for (let y = ya; y < ya + 220; y += R.range(26, 40)) pts.push(xa + side * R.range(-20, 60), y);
    lay.trenches.push(pts);
  }
  // Wrecks: trucks, carts, tanks; most still burning or smoking.
  for (let i = 0; i < 2 + 3 * P.wrecks; i++) {
    if (!R.chance(0.6)) continue;
    const side = R.sign(), x = side * R.range(120, 250), y = R.range(y0 + 30, y1 - 30), kind = R.pick(['truck', 'truck', 'cart', 'tank', 'halftrack']);
    const w = { kind, x, y, rot: R.range(-0.9, 0.9) + (R.chance(0.5) ? Math.PI : 0), seed: R.next(), burning: R.chance(P.fires) };
    lay.wrecks.push(w);
    if (w.burning) lay.anchors.push({ type: 'fire', x: x + R.range(-4, 4), y: y + R.range(-4, 4), z: 6, s: R.range(0.8, 1.3) });
    else lay.anchors.push({ type: 'smoke', x, y, z: 6, s: R.range(0.9, 1.4), dark: 0.8 });
  }
  // Supply dumps: crates and drums.
  for (let i = 0; i < 2; i++) if (R.chance(0.55)) lay.dumps.push({ x: R.sign() * R.range(130, 250), y: R.range(y0, y1), seed: R.next() });
  if (R.chance(0.35)) lay.bunkers.push({ x: R.sign() * R.range(190, 280), y: R.range(y0 + 40, y1 - 40), w: R.range(26, 36), d: R.range(20, 28), h: R.range(10, 14), rot: R.range(-0.3, 0.3) });
  for (let i = 0; i < 4; i++) lay.rocks.push({ x: R.sign() * R.range(140, 330), y: R.range(y0, y1), r: R.range(6, 14), h: R.range(5, 12), seed: R.next() });
  // Smoke columns drifting over the field, a few loose fires.
  for (let i = 0; i < 2 + 3 * P.fires; i++) {
    const x = R.range(-300, 300), y = R.range(y0, y1);
    lay.anchors.push(R.chance(0.3 * P.fires) && Math.abs(x) > 120 ? { type: 'fire', x, y, z: 1, s: R.range(0.5, 0.9) } : { type: 'smoke', x, y, z: 2, s: R.range(1, 1.8), dark: R.range(0.5, 0.8) });
  }
  for (let i = 0; i < 6; i++) lay.debris.push({ x: R.range(-300, 300), y: R.range(y0, y1), r: R.range(12, 30) });
  lay.seed = R.next();
  return lay;
}

// -------------------------------------------------------------- paint

function rutPts(S, r, y0, y1, off) {
  const pts = [];
  for (let y = y0 - 24; y <= y1 + 24; y += 8) pts.push(S.rutX(r, y) + off, y);
  return pts;
}

/** One track band pressed into snow: berms, compressed band, grouser marks. */
function band(p, pts, w, big, alpha = 1) {
  p.line(pts, w + (big ? 10 : 4), [1, 1, 1], 0.4 * alpha);                       // pushed-up berms
  p.line(pts, w + (big ? 4 : 1.6), [0.6, 0.65, 0.74], 0.25 * alpha);                // berm shadow lip
  p.line(pts, w, [0.7, 0.75, 0.84], 0.6 * alpha);                                 // compressed band
  if (big) p.line(pts, w * 0.86, [0.5, 0.54, 0.62], 0.35 * alpha, { dash: [3.2, 5.8] }); // grouser prints
  if (big) p.line(pts, w * 0.25, [0.32, 0.3, 0.3], 0.25 * alpha, { dash: [40, 30] });  // dirty slush in the middle
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  snowSurf(p, { color: SNOW, wind: -0.5 });
  // Trampled, dirtier snow where the fighting has been heaviest (the lane and around wrecks).
  p.patch('fbm_60', 520, [0.72, 0.75, 0.8], 0.35);
  p.patch('fbm_70', 300, [0.58, 0.58, 0.6], 0.18);
  // Tread ruts (continuous across chunks).
  for (const r of S.ruts) {
    const a = r.fade ? 0.55 : 1;
    for (const s of [-1, 1]) band(p, rutPts(S, r, y0, y1, s * r.gauge / 2), r.w, !!r.big, a);
  }
  for (const L of all) for (const t of L.trenches) trench(p, t, 11, { bag: [0.78, 0.78, 0.74] });
  p.props(() => new RNG(`fl:${lay.seed}`), (Rp) => {
    for (const L of all) for (const cr of L.craters) crater(p, new RNG(`flc:${cr.seed}`), cr.x, cr.y, cr.r);
    for (const L of all) for (const w of L.walls) wallPaint(p, w);
    for (const L of all) for (const f of L.fences) fencePaint(p, f);
    for (const L of all) for (const h of L.hogs) p.shadowBox(h.x, h.y, 10, 10, 8, h.rot);
    for (const L of all) for (const n of L.nests) {
      const ring = [];
      for (let a = 0; a <= 5.6; a += 0.4) ring.push(n.x + Math.cos(a) * n.r, n.y + Math.sin(a) * n.r * 0.85);
      sandbags(p, ring, { color: [0.74, 0.72, 0.66] });
      barbedWire(p, [n.x - n.r * 1.8, n.y - n.r * 1.4, n.x + n.r * 1.8, n.y - n.r * 1.5]);
    }
    for (const L of all) for (const w of L.wrecks) wreckPaint(p, w);
    for (const L of all) for (const d of L.dumps) {
      const Rd = new RNG(`fld:${d.seed}`);
      for (let k = 0; k < 6; k++) crate(p, Rd, d.x + Rd.range(-14, 14), d.y + Rd.range(-12, 12), Rd.range(5, 8), Rd.range(-0.4, 0.4), { color: [0.45, 0.33, 0.2] });
      for (let k = 0; k < 5; k++) drum(p, d.x + Rd.range(-18, 18), d.y + Rd.range(-16, 16), { color: Rd.pick([[0.3, 0.33, 0.24], [0.42, 0.2, 0.12], [0.22, 0.26, 0.3]]) });
    }
    for (const L of all) for (const b of L.bunkers) p.shadowBox(b.x, b.y, b.w, b.d, b.h + 2.5, b.rot);
    for (const L of all) for (const r of L.rocks) p.shadowCircle(r.x, r.y, r.r * 0.85, r.h, 0, 8);
    if (P.poles) poleShadows(p, S, y0, y1);
    for (const L of all) for (const d of L.debris) debris(p, Rp, d.x, d.y, d.r, 26, { color: [0.35, 0.33, 0.3] });
    // Spent shell casings glinting in the snow.
    for (let i = 0; i < 40; i++) p.at(Rp.range(-460, 460), Rp.range(y0, y1), Rp.angle(), (cx) => { cx.fillStyle = 'rgba(200,160,70,0.9)'; cx.fillRect(-0.9, -0.35, 1.8, 0.7); });
  }, 0.5, 2.6);
  // Fires light up the snow around them.
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.45, 0.12], 0.55], [1, [1, 0.3, 0.05], 0]], 'lighter');
}

/** Shell crater in snow: dirty ejecta, lit snow rim, dark frozen-earth bowl. */
function crater(p, R, x, y, r) {
  const s = p.sun;
  // Ejecta: soot and earth flung over the snow.
  p.radial(x, y, r * 2.3, [[0, DIRT, 0.55], [0.55, shade(DIRT, 1.4), 0.3], [1, [0.6, 0.6, 0.62], 0]]);
  for (let i = 0; i < 26; i++) {
    const a = R.angle(), d = r * R.range(1.1, 2.4), rr = R.range(0.6, 2.6) * (1.6 - d / (r * 2.4));
    p.circlePath(x + Math.cos(a) * d, y + Math.sin(a) * d, rr).fill(R.chance(0.3) ? [0.92, 0.94, 0.97] : shade(DIRT, R.range(0.5, 1.1)), 0.85);
  }
  // Raised rim: bright on the sun side, shaded on the far side.
  p.circlePath(x, y, r * 1.22).fill([0.62, 0.62, 0.64], 0.95);
  p.ctx.save(); p.circlePath(x, y, r * 1.22); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.3, y - s.dy * r * 0.3, r * 1.15).fill([0.93, 0.95, 0.98], 0.9);
  p.ctx.restore();
  // Bowl: frozen dark earth, deepest at the centre; snow lodged on the shaded wall.
  p.circlePath(x, y, r).fill([0.17, 0.15, 0.14]);
  p.radial(x, y, r, [[0, [0.06, 0.055, 0.05], 1], [0.7, [0.14, 0.13, 0.12], 0.6], [1, [0.2, 0.19, 0.18], 0]]);
  p.ctx.save(); p.circlePath(x, y, r); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.55, y - s.dy * r * 0.55, r * 0.95).fill([0, 0, 0], 0.4);            // rim shadow
  p.radial(x + s.dx * r * 0.5, y + s.dy * r * 0.5, r * 0.5, [[0, [0.8, 0.84, 0.9], 0.45], [1, [0.8, 0.84, 0.9], 0]]); // snow in the lee
  p.ctx.restore();
  for (let i = 0; i < 5; i++) { const a = R.angle(); p.crack(R, x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, a, r * R.range(0.6, 1.4), 0.6, [0.25, 0.25, 0.27], 0.5, 1); }
}

/** Painted base + shadow of a stone wall run (the wall itself is 3D). */
function wallPaint(p, w) {
  const R = new RNG(`flw:${w.seed}`);
  for (let i = 0; i < w.pts.length - 1; i++) {
    const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
    if (w.gaps.includes(i)) {
      // Breach: tumbled stones and dirty snow.
      for (let k = 0; k < 7; k++) { const t = R.next(), px = ax + (bx - ax) * t + R.range(-10, 10), py = ay + (by - ay) * t + R.range(-10, 10); p.shadowCircle(px, py, R.range(2, 4), R.range(2, 4), 0, 6); p.circlePath(px, py, R.range(1.8, 3.6)).fill(shade([0.5, 0.5, 0.52], R.range(0.7, 1.2))); }
      continue;
    }
    const a = Math.atan2(by - ay, bx - ax), l = Math.hypot(bx - ax, by - ay);
    p.shadowBox((ax + bx) / 2, (ay + by) / 2, l + 1, 11, 11, a);
    p.line([ax, ay, bx, by], 14, [0.7, 0.72, 0.76], 0.5); // snow drift banked against it
  }
}

function fencePaint(p, f) {
  const c = Math.cos(f.a), s = Math.sin(f.a);
  for (let k = 0; k < f.n; k++) p.shadowCircle(f.x + c * k * 14, f.y + s * k * 14, 1, 10, 0, 5);
  p.shadow([f.x, f.y - 0.4, f.x + c * f.n * 14, f.y + s * f.n * 14 - 0.4, f.x + c * f.n * 14, f.y + s * f.n * 14 + 0.4, f.x, f.y + 0.4], 8.5, 7.5);
}

function wreckPaint(p, w) {
  const R = new RNG(`flk:${w.seed}`);
  scorch(p, R, w.x, w.y, w.kind === 'tank' ? 34 : 24);
  const L = w.kind === 'tank' ? [24, 40, 11] : w.kind === 'cart' ? [11, 18, 7] : w.kind === 'halftrack' ? [12, 28, 9] : [12, 30, 11];
  p.shadowBox(w.x, w.y, L[0], L[1], L[2], w.rot);
}

/** Long pole shadows painted on the snow (poles and wires are 3D). */
function poleShadows(p, S, y0, y1) {
  for (const side of [-1, 1]) {
    for (let m = Math.floor((y0 - 200) / 150); m <= Math.ceil((y1 + 200) / 150); m++) {
      const q = S.poleAt(side, m);
      if (q.down) continue;
      p.shadowCircle(q.x, q.y, 1.3, 54, 0, 6);
      p.shadow([q.x - 9, q.y - 0.6, q.x + 9, q.y - 0.6, q.x + 9, q.y + 0.6, q.x - 9, q.y + 0.6], 50, 48);
    }
  }
}

// --------------------------------------------------------------- mesh

function mesh(mb, lay, S) {
  // Stone walls with snow caps.
  for (const w of lay.walls) {
    const R = new RNG(`flm:${w.seed}`);
    for (let i = 0; i < w.pts.length - 1; i++) {
      if (w.gaps.includes(i)) continue;
      const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
      const a = Math.atan2(by - ay, bx - ax), l = Math.hypot(bx - ax, by - ay) + 1, h = R.range(8, 12);
      // Dry-stone: a rubble core plus irregular facing stones, snow lodged on top.
      const cx = (ax + bx) / 2, cy = (ay + by) / 2, ca = Math.cos(a), sa = Math.sin(a);
      mb.box(cx, cy, 0, l, 7, h * 0.75, a, { top: 'rock_dark', side: 'rock_dark' });
      for (let u = -l / 2 + 3; u < l / 2; u += R.range(4.5, 7)) {
        for (const v of [-2.6, 2.6]) {
          const sx = cx + ca * u - sa * v, sy = cy + sa * u + ca * v, sh = h * R.range(0.65, 1.05);
          mb.box(sx, sy, 0, R.range(4.5, 7), R.range(3.6, 5), sh, a + R.range(-0.25, 0.25), { top: R.chance(0.55) ? 'snow' : 'rock', side: R.chance(0.6) ? 'rock' : 'rock_dark' });
        }
      }
    }
  }
  // Post-and-rail fences.
  for (const f of lay.fences) {
    const R = new RNG(`flf:${f.seed}`), c = Math.cos(f.a), s = Math.sin(f.a);
    const post = (k) => [f.x + c * k * 14, f.y + s * k * 14];
    for (let k = 0; k < f.n; k++) {
      const [x, y] = post(k), tilt = R.chance(f.broken * 0.5) ? R.range(-0.5, 0.5) : 0;
      mb.beam([x, y, 0], [x + Math.sin(tilt) * 4, y, 10 * Math.cos(tilt)], 1.6, 1.6, 'timber');
      if (k < f.n - 1 && !R.chance(f.broken * 0.4)) {
        const [x2, y2] = post(k + 1);
        for (const z of [4.5, 8.5]) mb.beam([x, y, z], [x2, y2, z - (R.chance(0.2) ? 4 : 0)], 0.9, 0.9, 'timber');
      }
    }
  }
  for (const h of lay.hogs) meshHedgehog(mb, h.x, h.y, 1.1, h.rot);
  for (const b of lay.bunkers) { meshBunker(mb, b.x, b.y, b.w, b.d, b.h, b.rot); mb.box(b.x, b.y, b.h + 2.5, b.w * 0.82, b.d * 0.82, 1.6, b.rot, { top: 'snow', side: 'snow' }); }
  for (const r of lay.rocks) meshBoulder(mb, r.x, r.y, r.r, r.h, r.seed, 'rock');
  for (const w of lay.wrecks) meshWreck(mb, w);
  for (const d of lay.dumps) {
    const R = new RNG(`fld:${d.seed}`);
    for (let k = 0; k < 6; k++) { const s = R.range(5, 8); mb.box(d.x + R.range(-14, 14), d.y + R.range(-12, 12), 0, s, s, s * 0.8, R.range(-0.4, 0.4), { top: 'timber', side: 'timber' }); }
  }
  // Utility poles with crossarms and sagging wires (both flanks, continuous).
  if (S.P.poles) {
    const y0 = lay.y0, y1 = lay.y1;
    for (const side of [-1, 1]) {
      for (let m = Math.ceil(y0 / 150); m * 150 < y1; m++) {
        const q = S.poleAt(side, m), nx = S.poleAt(side, m + 1);
        if (q.down) { mb.beam([q.x, q.y, 1.2], [q.x + 50 * Math.cos(q.lean + 1), q.y + 50 * Math.sin(q.lean + 1), 1.2], 2.2, 2.2, 'timber'); continue; }
        const top = [q.x + Math.sin(q.lean) * 52, q.y, 52 * Math.cos(q.lean)];
        mb.beam([q.x, q.y, 0], top, 2.2, 2.2, 'timber');
        mb.beam([top[0] - 9, top[1], top[2] - 3], [top[0] + 9, top[1], top[2] - 3], 1.4, 1.4, 'timber');
        if (nx.down) continue;
        const nt = [nx.x + Math.sin(nx.lean) * 52, nx.y, 52 * Math.cos(nx.lean)];
        for (const o of [-8, 8]) {
          const a = [top[0] + o, top[1], top[2] - 2.6], b = [nt[0] + o, nt[1], nt[2] - 2.6];
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 6];
          mb.beam(a, mid, 0.45, 0.45, 'metal_dark');
          mb.beam(mid, b, 0.45, 0.45, 'metal_dark');
        }
      }
    }
  }
}

/** Burnt-out vehicles as solids (rusted, blackened, snow on the flats). */
function meshWreck(mb, w) {
  const R = new RNG(`flv:${w.seed}`), c = Math.cos(w.rot), s = Math.sin(w.rot);
  const at = (u, v) => [w.x + u * c - v * s, w.y + u * s + v * c];
  const box = (u, v, z, bw, bl, bh, mat, top = mat, dr = 0) => { const [x, y] = at(u, v); mb.box(x, y, z, bw, bl, bh, w.rot + dr, { top, side: mat }); };
  switch (w.kind) {
    case 'truck':
      box(0, 9, 0.8, 11, 10, 9, 'metal_dark', 'roof_burnt');
      box(0, -6, 2, 12, 20, 2.5, 'rust');
      if (R.chance(0.6)) box(0, -6, 4.5, 11, 18, 5, 'tarp_canvas', 'tarp_canvas');
      else for (let k = 0; k < 3; k++) box(R.range(-3, 3), -6 + R.range(-6, 6), 4.5, 4.5, 4.5, 4, 'timber', 'timber', R.range(-0.5, 0.5));
      break;
    case 'cart':
      box(0, 0, 3, 10, 16, 4, 'timber', 'timber');
      for (const u of [-6, 6]) { const [x, y] = at(u, 2); mb.lathe(x, y, [[3, 0], [3, 1]], 'timber', { seg: 8 }); }
      for (let k = 0; k < 3; k++) box(R.range(-2, 2), R.range(-5, 5), 7, 4, 4, 3, 'timber', 'snow', R.range(-0.4, 0.4));
      break;
    case 'halftrack':
      box(0, 0, 1, 12, 28, 6, 'metal_dark', 'roof_burnt');
      box(0, 9, 7, 10, 8, 3, 'rust');
      break;
    default: { // tank
      box(0, 0, 1, 22, 38, 7, 'metal_dark', 'roof_burnt');
      const tr = R.range(-1.2, 1.2), [tx, ty] = at(R.range(-2, 2), -2);
      mb.box(tx, ty, 8, 13, 15, 5, w.rot + tr, { top: 'rust', side: 'metal_dark' });
      const ga = w.rot + tr + Math.PI / 2 + R.range(-0.2, 0.2);
      mb.beam([tx, ty, 10.5], [tx + Math.cos(ga) * 24, ty + Math.sin(ga) * 24, R.chance(0.4) ? 4 : 10.5], 1.8, 1.8, 'metal_dark');
    }
  }
}
