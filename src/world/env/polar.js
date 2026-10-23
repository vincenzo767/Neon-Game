import { sampleField } from '../paint/noise.js';
import { meshShip, shipSize } from '../kit/ships.js';
import { RNG } from '../../core/RNG.js';
import { CHUNK, NCH, FLOE_OUT, leadEdge, escortsAt, bergsAt } from './polarMap.js';

// PACK ICE LEAD: the frozen channel where WHITEOUT BREAKER lies at anchor
// (level 2-2, all five of its arena configs; the level's waves fly over it).
//
// The map (world/env/polarMap.js, shared with the boss rig) is a straight
// lead of black water through the pack:
//   water     the animated sea (z = 0): deep navy with dark teal channels,
//             whitecaps and wind streaks; the warship's hull ploughs a foam
//             band into it (rig) and impacts ring it
//   brash     a translucent layer over the lead: slush, brash ice and small
//             ice cakes drifting near the floe edge, frazil foam in the seams,
//             an oil slick round the burning escorts (smooth, no blocks)
//   pack      the painted ice field beyond the floe band (snow, bare blue ice,
//             pressure ridges, refrozen leads, cracks, shadows of everything
//             standing on it) and the solids:
//               floes   thick broken slabs along both lead edges: blue-white
//                       walls, snow tops, tilted and rafted, dark water seams
//               bergs   towering faceted icebergs and long ice-cliff walls
//                       (strata, crevasses, snow caps, translucent blue toes)
//               escorts burning escort warships stopped in the water lane
//               debris  broken hull plates, twisted girders, containers and
//                       drums frozen into the floes, a toppled mast, buoys
// PERIODIC: every layer repeats every PERIOD (NCH chunks), built once.
//
// Params: smoke 0..1, wrecks 0..1, brash 0..1, bergs 0..1, storm 0..1 (sea state).

const LEN = CHUNK;
const XW = 560;
const TAU = Math.PI * 2;
const pmod = (a, n) => ((a % n) + n) % n;
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const F = (x, y, s) => sampleField('fbm', x, y, s);
const IZ = 2.2;   // painted pack surface height

export default {
  id: 'polar',
  label: 'Pack Ice Lead (periodic arctic channel)',
  defaults: { smoke: 0.7, wrecks: 0.8, brash: 0.8, bergs: 1, storm: 0.3 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || 'polar'; // one lead for every phase arena: only params / light differ
    const S = { P, seed, dust: [0.86, 0.9, 0.95] };
    const st = P.storm;
    S.atmosphere = {
      surfaces: [{
        type: 'water', z: 0,
        deep: [0.004, 0.026 + st * 0.005, 0.075],
        shallow: [0.02, 0.1, 0.17],
        sky: [0.42 - st * 0.08, 0.5 - st * 0.08, 0.62 - st * 0.06],
        wave: [0.85 + st * 0.6, 1.3 - st * 0.15, 1.0 + st * 0.4, 0.75 + st * 0.6],
        foam: [0.62 + st * 0.3, 0.6 - st * 0.12, 0.75 + st * 0.2, 0],
        wind: [1, -0.35],
        hq: [0.6, 0.7, 0.7, 0],
      }],
      glowTint: [0.95, 1, 1.08],
    };
    S.layers = [
      {
        id: 'brash', z: 0.35, x0: -330, x1: 330, length: LEN, ppu: 0.85, blend: true, period: NCH,
        layout: (c) => periodic(c, S, brashLayout),
        paint: (p, lay, nb, c) => paintBrash(p, lay, nb, c, S),
      },
      {
        id: 'pack', z: IZ, x0: -XW, x1: XW, length: LEN, ppu: 0.8, cut: true, glow: true, period: NCH,
        layout: (c) => periodic(c, S, layout),
        paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
        mesh: (mb, lay) => mesh(mb, lay, S),
      },
    ];
    S.surfacesTopDown = [{ z: IZ, contains: (x, y) => Math.abs(x) > leadEdge(x >= 0 ? 1 : -1, y) + 2 }, { z: 0, water: true }];
    S.floorZ = 0;
    return S;
  },
};

// ----------------------------------------------------- periodic helpers

function periodic(c, S, fn) {
  const km = pmod(c.k, NCH);
  if (km === c.k) return fn(c, S);
  const dy = (c.k - km) * LEN;
  const lay = fn({ ...c, k: km, y0: c.y0 - dy, y1: c.y1 - dy, R: new RNG(`${S.seed}:${fn.name}:${km}`) }, S);
  return shiftLayout(lay, dy);
}

function shiftLayout(lay, dy) {
  for (const key of Object.keys(lay)) {
    const v = lay[key];
    if (Array.isArray(v)) lay[key] = v.map((o) => shiftObj(o, dy));
    else if (v && typeof v === 'object') lay[key] = shiftObj(v, dy);
    else if (key === 'y0' || key === 'y1') lay[key] = v + dy;
  }
  return lay;
}

function shiftObj(o, dy) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const n = { ...o };
  for (const k of ['y', 'y0', 'y1']) if (typeof n[k] === 'number') n[k] += dy;
  if (Array.isArray(n.pts)) n.pts = n.pts.map((v, i) => (i & 1 ? v + dy : v));
  return n;
}

// ------------------------------------------------------------- layout

function brashLayout(c) {
  const { R } = c, cakes = [];
  // Small ice cakes drifting in the lane between the hull and the floe edge.
  for (let i = 0; i < 12; i++) {
    const side = R.sign(), y = R.range(c.y0, c.y1), x = side * R.range(118, leadEdge(side, y) - 4);
    cakes.push({ x, y, r: R.range(2.5, 9), a: R.angle() });
  }
  return { k: c.k, y0: c.y0, y1: c.y1, cakes, escorts: escortsAt(c.k), seed: R.next() };
}

/** Irregular polygon (flat xy list, counter-clockwise) round (x, y). */
function blob(R, x, y, rx, ry, n, jit = 0.28, rot = 0) {
  const pts = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R.range(-0.25, 0.25) * (TAU / n), d = 1 + R.range(-jit, jit);
    const u = Math.cos(a) * rx * d, v = Math.sin(a) * ry * d;
    pts.push(x + u * cr - v * sr, y + u * sr + v * cr);
  }
  return pts;
}

function layout(c, S) {
  const { R, y0, y1, k } = c, P = S.P;
  const lay = { k, y0, y1, floes: [], bergs: [], escorts: [], debris: [], anchors: [], ridges: [], leads: [], seed: R.next() };
  // ---- Floe band: chunky broken ice beyond each lead edge. The first row is a rafted
  // pressure ridge of tall blocks (blue walls catching the light, snow tops), then thick
  // slabs; dark water shows in every seam. Irregular sizes, some blocks tipped up.
  for (const side of [-1, 1]) {
    for (let u = R.range(-4, 2); u < FLOE_OUT + 8; ) {
      const ridge = u < 34, cw = ridge ? R.range(20, 40) : R.range(28, 52);
      for (let y = y0 + R.range(0, 14); y < y1; ) {
        const ch = cw * R.range(0.7, 1.6), cy = y + ch / 2, e = leadEdge(side, cy);
        const cx = side * (e + u + cw / 2) + R.range(-3, 3);
        const gap = ridge ? R.range(2.5, 7) : R.range(1.8, 4.5);
        const sq = R.chance(0.5);   // squarish block or a rounded floe
        const pts = blob(R, cx, cy, cw / 2 - gap, ch / 2 - gap, sq ? R.int(4, 6) : R.int(6, 9), sq ? 0.14 : 0.24, R.range(-0.5, 0.5));
        const tall = ridge && R.chance(0.55);
        const top = tall ? R.range(12, 30) : ridge ? R.range(6, 11) : R.range(4.5, 9);
        lay.floes.push({ pts, top, tilt: tall && R.chance(0.35) ? [R.range(-0.16, 0.16), R.range(-0.16, 0.16)] : [R.range(-0.04, 0.04), R.range(-0.04, 0.04)], snow: R.range(0.8, 1), x: cx, y: cy, tall });
        // Rafted block: a broken piece shoved up onto the slab.
        if (R.chance(0.16)) lay.floes.push({ pts: blob(R, cx + R.range(-4, 4), cy + R.range(-4, 4), cw * 0.24, ch * 0.2, 5, 0.3, R.angle()), top: top + R.range(4, 9), base: top - 2, tilt: [R.range(-0.2, 0.2), R.range(-0.2, 0.2)], snow: 0.7, x: cx, y: cy });
        // Small chunks drifting in the seam beside it.
        if (ridge && R.chance(0.3)) { const r = R.range(2.5, 5); lay.floes.push({ pts: blob(R, cx - side * (cw / 2 + 3), cy + R.range(-ch / 3, ch / 3), r, r * 0.8, 5, 0.3, R.angle()), top: R.range(1.2, 2.4), base: -2, tilt: [0, 0], snow: 0.8, x: cx, y: cy, cake: true }); }
        y += ch;
      }
      u += cw;
    }
  }
  // ---- Ice cakes floating in the lane (3D, a few; the brash layer paints the small stuff).
  for (let i = 0; i < 7; i++) {
    const side = R.sign(), y = R.range(y0, y1), e = leadEdge(side, y), x = side * R.range(136, e - 10);
    if (escortsAt(k).some((es) => Math.abs(es.y - y) < 80 && es.side === side)) continue;
    const r = R.range(5, 12);
    lay.floes.push({ pts: blob(R, x, y, r, r * R.range(0.6, 1), R.int(5, 7), 0.3, R.angle()), top: R.range(1.6, 3.2), base: -2, tilt: [0, 0], snow: R.range(0.5, 0.9), x, y, cake: true });
  }
  // ---- Bergs and ice-cliff walls.
  if (P.bergs > 0) for (const b of bergsAt(k)) lay.bergs.push({ ...b, h: b.h * (0.6 + 0.4 * P.bergs) });
  // ---- Escorts burning in the water lane.
  for (const es of escortsAt(k)) {
    const sz = shipSize(es.type), lowered = pmod(k + es.y, 3) === 0;
    lay.escorts.push({ ...es, lowered });
    const c0 = Math.cos(es.rot), s0 = Math.sin(es.rot), at = (v) => [es.x - s0 * v, es.y + c0 * v];
    const [fx, fy] = at(sz.l * 0.1), [ax, ay] = at(-sz.l * 0.22);
    lay.anchors.push({ type: 'fire', x: fx, y: fy, z: 14, s: R.range(1.2, 1.8) });
    if (R.chance(0.7)) lay.anchors.push({ type: 'fire', x: ax, y: ay, z: 10, s: R.range(0.8, 1.3) });
    lay.anchors.push({ type: 'smoke', x: fx, y: fy, z: 30, s: 2.2 + P.smoke * 0.8, dark: 0.95 });
    if (R.chance(0.5 * P.smoke)) lay.anchors.push({ type: 'smoke', x: ax, y: ay, z: 22, s: 1.6, dark: 0.85 });
  }
  // ---- Debris frozen into the floe band: hull plates, girders, containers, drums, a mast, buoys.
  for (let i = 0; i < 9 * P.wrecks; i++) {
    const side = R.sign(), y = R.range(y0 + 10, y1 - 10), e = leadEdge(side, y), x = side * (e + R.range(8, FLOE_OUT - 6));
    lay.debris.push({ kind: R.pick(['plate', 'plate', 'girder', 'container', 'drums', 'mast', 'platform']), x, y, rot: R.angle(), side, seed: R.next() });
  }
  for (let i = 0; i < 2; i++) { const side = R.sign(), y = R.range(y0, y1); lay.debris.push({ kind: 'buoy', x: side * (leadEdge(side, y) - R.range(8, 20)), y, rot: 0, side, seed: R.next() }); }
  for (const d of lay.debris) if (d.kind === 'platform' || (d.kind === 'plate' && R.chance(0.3))) lay.anchors.push({ type: 'smoke', x: d.x, y: d.y, z: 10, s: 1.1, dark: 0.8 });
  // ---- Painted pack detail: pressure ridges and refrozen leads beyond the floe band.
  for (let i = 0; i < 7; i++) { const side = R.sign(), y = R.range(y0, y1); lay.ridges.push({ x: side * R.range(leadEdge(side, y) + FLOE_OUT, XW - 20), y, a: R.range(-0.6, 0.6) + (R.chance(0.5) ? Math.PI / 2 : 0), l: R.range(60, 180) }); }
  for (let i = 0; i < 3; i++) { const side = R.sign(), y = R.range(y0, y1), pts = []; let x = side * (leadEdge(side, y) + FLOE_OUT + R.range(10, 60)), yy = y; const a0 = R.range(-0.9, 0.9); for (let s = 0; s < 8; s++) { pts.push(x, yy); x += side * Math.cos(a0 + R.range(-0.4, 0.4)) * 18; yy += Math.sin(a0 + R.range(-0.4, 0.4)) * 18; } lay.leads.push({ pts, w: R.range(3, 7) }); }
  return lay;
}

// -------------------------------------------------------------- paint

function paint(p, lay, nb, c) {
  const { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  // Snow field with bare blue ice, older grey floes, wind-packed relief.
  p.base([0.84, 0.89, 0.95]);
  p.patch('fbm_60', 300, [0.6, 0.73, 0.84], 0.42);
  p.patch('large_50', 700, [0.7, 0.77, 0.85], 0.35);
  p.noise('ridged', 220, 'soft-light', 0.38);
  p.noise('grain', 128 / p.ppu, 'overlay', 0.25);
  // Refrozen leads: dark grey-blue new ice in thin winding bands, with a frosted rim.
  for (const L of all) for (const ld of L.leads) { p.line(ld.pts, ld.w + 3, [0.72, 0.8, 0.88], 0.6); p.line(ld.pts, ld.w, [0.2, 0.28, 0.36], 0.85); }
  // Pressure ridges: rubble lines of broken blocks with their shadows.
  for (const L of all) for (const r of L.ridges) {
    const R = new RNG(`pridge:${Math.round(r.x)}:${Math.round(r.y)}`), c0 = Math.cos(r.a), s0 = Math.sin(r.a);
    for (let k = 0; k < r.l / 3; k++) {
      const t = (k / (r.l / 3) - 0.5) * r.l, x = r.x + c0 * t + R.range(-4, 4), y = r.y + s0 * t + R.range(-4, 4), sz = R.range(2, 5);
      p.shadowBox(x, y, sz, sz, sz * 1.3, R.angle());
      p.at(x, y, R.angle(), (cx) => { cx.fillStyle = `rgba(${200 + R.int(0, 50)},${220 + R.int(0, 30)},${238 + R.int(0, 17)},1)`; cx.fillRect(-sz / 2, -sz / 2, sz, sz); });
    }
  }
  // Cracks across the pack.
  const Rc = new RNG(`pcrack:${lay.seed}`);
  for (let i = 0; i < 14; i++) { const side = Rc.sign(), y = Rc.range(y0, y1); p.crack(Rc, side * Rc.range(250, XW), y, Rc.angle(), Rc.range(30, 90), 0.8, [0.32, 0.42, 0.52], 0.55, 2); }
  // Shadows of the bergs, floes and debris standing on / beside the pack.
  p.props(() => new RNG(`pp:${lay.seed}`), () => {
    for (const L of all) for (const b of L.bergs) p.shadowCircle(b.x, b.y, b.r * 0.9, b.h, 0, 12);
    for (const L of all) for (const f of L.floes) if (!f.cake) p.shadow(f.pts, f.top, 0);
    for (const L of all) for (const d of L.debris) if (d.kind === 'container') p.shadowBox(d.x, d.y, 9, 24, 12, d.rot);
  }, 0.42, 3);
  // Soot round the burning debris.
  for (const L of all) for (const a of L.anchors) if (a.type === 'smoke' && a.z < 20) p.radial(a.x, a.y, 26, [[0, [0.12, 0.12, 0.13], 0.55], [1, [0.2, 0.2, 0.22], 0]]);
  if (p.env.glow) for (const L of all) for (const a of L.anchors) if (a.type === 'fire') p.env.glow.radial(a.x, a.y, 60 * a.s, [[0, [1, 0.45, 0.12], 0.5], [1, [1, 0.3, 0.05], 0]], 'lighter');
  // Cut out the lead and the inner floe band (the 3D slabs and the open water show there).
  for (const side of [-1, 1]) {
    p.ctx.beginPath();
    for (let y = y0 - 24; y <= y1 + 24; y += 6) p.ctx.lineTo(side * (leadEdge(side, y) + FLOE_OUT * 0.55 + 6 * Math.sin(y * 0.07)), y);
    p.ctx.lineTo(0, y1 + 24); p.ctx.lineTo(0, y0 - 24);
    p.ctx.closePath();
    p.fill([0, 0, 0], 1, 'destination-out');
  }
}


// ------------------------------------------------------------- brash

function paintBrash(p, lay, nb, c) {
  const { y0, y1 } = c;
  p.ctx.clearRect(-1e5, -1e5, 2e5, 2e5);
  // Half-resolution field, upscaled with filtering: smooth gradients, no blocky texels.
  const W = Math.ceil(p.canvas.width / 2), H = Math.ceil(p.canvas.height / 2);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const cx2 = cv.getContext('2d'), img = cx2.createImageData(W, H), d = img.data;
  const { x0, x1 } = p.rect;
  const cakes = [...lay.cakes, ...nb.filter(Boolean).flatMap((L) => L.cakes)];
  const escorts = [...lay.escorts, ...nb.filter(Boolean).flatMap((L) => L.escorts)];
  for (let j = 0; j < H; j++) {
    const y = y1 - ((j + 0.5) / H) * (y1 - y0);
    const eL = leadEdge(-1, y), eR = leadEdge(1, y);
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0), side = x >= 0 ? 1 : -1;
      const dd = (side > 0 ? eR : eL) - side * x;            // distance in from the lead edge
      if (dd < -6) continue;
      const n = F(x, y, 160), n2 = sampleField('fine', x, y, 64), n3 = sampleField('ridged', x, y, 96);
      let r = 0, g = 0, b = 0, a = 0;
      // Frazil: a thin grey-green film right against the floe edge.
      const slush = (1 - sm(0, 8 + n * 10, dd)) * (0.35 + 0.4 * n2);
      if (slush > 0.02) { r = 0.42; g = 0.52; b = 0.56; a = slush * 0.5; }
      // Brash: sparse broken bits of ice in the lane near the edge (ridged noise threshold).
      const br = sm(0.8, 0.86, n3 * 0.7 + n2 * 0.4) * (1 - sm(14, 60, dd)) * 0.9;
      if (br > a) { r = 0.86 + n2 * 0.08; g = 0.9 + n2 * 0.06; b = 0.94; a = br; }
      // Foam lace along the very edge, lapping the floes.
      const lace = Math.max(0, 1 - Math.abs(dd - 2 - n * 6) / 3) * sm(0.35, 0.6, n2);
      if (lace > 0.02) { r = r * (1 - lace) + 0.96 * lace; g = g * (1 - lace) + 0.98 * lace; b = b * (1 - lace) + lace; a = Math.max(a, lace * 0.9); }
      // Ice cakes: rounded pancakes with a raised white rim.
      for (const ck of cakes) {
        const q = Math.hypot(x - ck.x, y - ck.y);
        if (q > ck.r + 3) continue;
        const k = 1 - sm(ck.r - 1.2, ck.r + 0.4, q + (n2 - 0.5) * 2), rim = Math.max(0, 1 - Math.abs(q - ck.r + 0.8) / 1.2);
        r = r * (1 - k) + (0.82 + rim * 0.15) * k; g = g * (1 - k) + (0.88 + rim * 0.1) * k; b = b * (1 - k) + 0.95 * k; a = Math.max(a, k * 0.95);
      }
      // Oil slick round the burning escorts: a dark iridescent sheen.
      for (const es of escorts) {
        const q = Math.hypot((x - es.x) * 1.4, y - es.y);
        if (q > 120) continue;
        const k = (1 - sm(40, 120, q + n * 30)) * 0.55;
        if (k > 0.02) { const ir = 0.5 + 0.5 * Math.sin(n2 * 12 + q * 0.08); r = r * (1 - k) + (0.02 + ir * 0.05) * k; g = g * (1 - k) + (0.03 + ir * 0.03) * k; b = b * (1 - k) + (0.05 + (1 - ir) * 0.05) * k; a = Math.max(a, k); }
      }
      const o = (j * W + i) * 4;
      d[o] = Math.min(255, r * 255); d[o + 1] = Math.min(255, g * 255); d[o + 2] = Math.min(255, b * 255); d[o + 3] = Math.min(255, a * 255);
    }
  }
  cx2.putImageData(img, 0, 0);
  p.ctx.save();
  p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  p.ctx.imageSmoothingEnabled = true;
  p.ctx.imageSmoothingQuality = 'high';
  p.ctx.drawImage(cv, 0, 0, p.canvas.width, p.canvas.height);
  p.ctx.restore();
}

// ----------------------------------------------------------------- mesh

/** Ice slab: irregular footprint, walls from `zb` up to a tilted top, snow-capped. */
function slab(mb, f) {
  const pts = f.pts, n = pts.length / 2, zb = f.base ?? -2.5;
  const ice = mb.mat('ice'), snow = mb.mat('snow');
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
  cx /= n; cy /= n;
  const zt = (x, y) => f.top + (x - cx) * f.tilt[0] + (y - cy) * f.tilt[1];
  // Walls: deep translucent blue at the waterline, bright blue-white up the face, a
  // white rim of packed snow at the top edge.
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n, ax = pts[k * 2], ay = pts[k * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1, nx = (by - ay) / len, ny = -(bx - ax) / len;
    const za = zt(ax, ay), zb2 = zt(bx, by), u1 = len / ice.size[0];
    const ma = Math.max(zb, za * 0.45), mbz = Math.max(zb, zb2 * 0.45), ra = za - Math.min(1.6, za * 0.15), rb = zb2 - Math.min(1.6, zb2 * 0.15);
    mb.quad([[ax, ay, zb], [bx, by, zb], [bx, by, mbz], [ax, ay, ma]], [[0, -zb / ice.size[1]], [u1, -zb / ice.size[1]], [u1, -mbz / ice.size[1]], [0, -ma / ice.size[1]]], ice.layer, [nx, ny, 0.12], { tint: [0.42, 0.72, 1.1], occ: [0.5, 0.5, 0.9, 0.9] });
    mb.quad([[ax, ay, ma], [bx, by, mbz], [bx, by, rb], [ax, ay, ra]], [[0, -ma / ice.size[1]], [u1, -mbz / ice.size[1]], [u1, -rb / ice.size[1]], [0, -ra / ice.size[1]]], ice.layer, [nx, ny, 0.18], { tint: [0.74, 0.92, 1.14] });
    mb.quad([[ax, ay, ra], [bx, by, rb], [bx, by, zb2], [ax, ay, za]], [[0, 0], [u1, 0], [u1, 0.1], [0, 0.1]], snow.layer, [nx, ny, 0.4], { tint: [0.95, 0.98, 1.04] });
  }
  // Snow top (fan; a soft rim of bare ice shows round the edge).
  const nz = [-f.tilt[0], -f.tilt[1], 1], l = Math.hypot(nz[0], nz[1], nz[2]);
  const col = mb.light(nz[0] / l, nz[1] / l, nz[2] / l, 1, [f.snow, f.snow * 1.02, f.snow * 1.05]);
  const c0 = mb.vert(cx, cy, zt(cx, cy) + 0.4, cx / snow.size[0], -cy / snow.size[1], snow.layer, col);
  const ring = [];
  for (let k = 0; k < n; k++) { const x = pts[k * 2], y = pts[k * 2 + 1]; ring.push(mb.vert(x, y, zt(x, y), x / snow.size[0], -y / snow.size[1], snow.layer, col)); }
  for (let k = 0; k < n; k++) mb.tri(c0, ring[k], ring[(k + 1) % n]);
}

/**
 * Iceberg / ice-cliff wall: stacked irregular rings stepping inward, faceted
 * faces lit per facet (deep blue toes, white upper faces, darker crevasse
 * facets, strata bands), jagged peaks, snow caps.
 */
function berg(mb, b) {
  const R = new RNG(`berg:${b.seed}`), ice = mb.mat('ice');
  const n = b.wall ? 16 : R.int(9, 13), L = b.l || 1;
  const radial = [];
  for (let i = 0; i < n; i++) radial.push(R.range(0.78, 1.12));
  const tiers = b.wall
    ? [[-6, 1.06, 0], [b.h * 0.18, 1.0, 0.02], [b.h * 0.5, 0.94, 0.05], [b.h * 0.8, 0.84, 0.1], [b.h, 0.7, 0.16]]
    : [[-6, 1.08, 0], [b.h * 0.22, 1.0, 0.04], [b.h * 0.52, 0.86, 0.1], [b.h * 0.8, 0.62, 0.18], [b.h, 0.38, 0.26]];
  // Lean the berg away from the lead (its inner face is a sheer cliff).
  const lean = -b.side * b.r * 0.12;
  const rings = tiers.map(([z, k, wob], t) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, d = radial[i] * (1 + R.range(-wob, wob));
      pts.push([b.x + Math.cos(a) * b.r * k * d + lean * (t / 4) * (1 + 0.3 * Math.sin(a * 2)), b.y + Math.sin(a) * b.r * L * k * d, z + (t === tiers.length - 1 ? R.range(-0.1, 0.12) * b.h : R.range(-3, 3))]);
    }
    return pts;
  });
  for (let t = 0; t < rings.length - 1; t++) {
    const A = rings[t], B = rings[t + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, p = [A[i], A[j], B[j], B[i]];
      const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const mx = (p[0][0] + p[2][0]) / 2 - b.x, my = (p[0][1] + p[2][1]) / 2 - b.y;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      // Colour: translucent blue toes, white faces higher up, darker crevasse facets, strata.
      const up = t / (rings.length - 1), crev = R.chance(0.16) ? 0.72 : 1, strata = 0.94 + 0.06 * Math.sin(t * 2.3 + i);
      const tint = [(0.62 + 0.36 * up) * crev * strata, (0.86 + 0.16 * up) * crev * strata, (1.12 + 0.04 * up) * crev];
      const w = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), h = p[3][2] - p[0][2];
      mb.quad(p, [[0, -p[0][2] / ice.size[1]], [w / ice.size[0], -p[1][2] / ice.size[1]], [w / ice.size[0], -p[2][2] / ice.size[1]], [0, -p[3][2] / ice.size[1]]], ice.layer, [nx / l, ny / l, nz / l], { tint, occ: [t === 0 ? 0.6 : 0.9, t === 0 ? 0.6 : 0.9, 1, 1] });
      void h;
    }
  }
  // Snow cap on the top ring (fan), plus snow ledges on the upper tier.
  const top = rings[rings.length - 1], snow = mb.mat('snow');
  let cx = 0, cy = 0, cz = 0;
  for (const q of top) { cx += q[0]; cy += q[1]; cz += q[2]; }
  cx /= n; cy /= n; cz /= n;
  const col = mb.light(0, 0, 1, 1, [1, 1.02, 1.05]);
  const c0 = mb.vert(cx, cy, cz + b.h * 0.05, cx / snow.size[0], -cy / snow.size[1], snow.layer, col);
  const ids = top.map((q) => mb.vert(q[0], q[1], q[2], q[0] / snow.size[0], -q[1] / snow.size[1], snow.layer, col));
  for (let i = 0; i < n; i++) mb.tri(c0, ids[i], ids[(i + 1) % n]);
  // Jagged spires on the bigger bergs.
  if (!b.wall && b.h > 100) for (let s = 0; s < 2; s++) {
    const q = top[R.int(0, n - 1)], sx = (q[0] + cx) / 2, sy = (q[1] + cy) / 2, sh = R.range(18, 40), sr = R.range(6, 12);
    const base = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; base.push([sx + Math.cos(a) * sr, sy + Math.sin(a) * sr, cz - 4]); }
    for (let i = 0; i < 5; i++) {
      const A = base[i], B = base[(i + 1) % 5], T = [sx + R.range(-3, 3), sy + R.range(-3, 3), cz + sh];
      const ex = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ey = [T[0] - A[0], T[1] - A[1], T[2] - A[2]];
      let nx = ex[1] * ey[2] - ex[2] * ey[1], ny = ex[2] * ey[0] - ex[0] * ey[2], nz = ex[0] * ey[1] - ex[1] * ey[0];
      if (nx * (A[0] - sx) + ny * (A[1] - sy) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1, c2 = mb.light(nx / l, ny / l, nz / l, 1, [0.9, 1, 1.12]);
      const a = mb.vert(A[0], A[1], A[2], 0, 0, ice.layer, c2), bb = mb.vert(B[0], B[1], B[2], 0.5, 0, ice.layer, c2), tt = mb.vert(T[0], T[1], T[2], 0.25, -0.6, ice.layer, c2);
      mb.tri(a, bb, tt);
    }
  }
}

function mesh(mb, lay, S) {
  for (const f of lay.floes) slab(mb, f);
  for (const b of lay.bergs) berg(mb, b);
  // Escorts stopped in the lane: intact hulls, scorched and burning; some settling.
  for (const es of lay.escorts) meshShip(mb, es.type, es.x, es.y, es.rot, { burnt: false, lowered: es.lowered });
  for (const es of lay.escorts) {
    const sz = shipSize(es.type), c0 = Math.cos(es.rot), s0 = Math.sin(es.rot);
    // Blast holes / scorched superstructure patches.
    for (const v of [sz.l * 0.1, -sz.l * 0.22]) mb.box(es.x - s0 * v, es.y + c0 * v, (es.lowered ? sz.h * 0.35 : sz.h) - 0.2, sz.b * 0.7, sz.l * 0.12, 1.2, es.rot, { top: 'scorch', side: 'scorch' });
  }
  for (const d of lay.debris) debris(mb, d);
  void S;
}

function debris(mb, d) {
  const R = new RNG(`pdeb:${d.seed}`), z = IZ + 4;
  switch (d.kind) {
    case 'plate': {
      // A torn hull plate frozen in at an angle.
      const c = Math.cos(d.rot), s = Math.sin(d.rot), w = R.range(14, 26), h = R.range(10, 18);
      const a = [d.x - c * w / 2, d.y - s * w / 2, z - 2], b = [d.x + c * w / 2, d.y + s * w / 2, z - 2];
      mb.beam([a[0], a[1], a[2] + h * 0.5], [b[0], b[1], b[2] + h * 0.5 + R.range(-4, 4)], 1.4, h, R.chance(0.5) ? 'scorch' : 'hull_grey');
      break;
    }
    case 'girder': {
      for (let k = 0; k < 3; k++) { const a = d.rot + R.range(-0.5, 0.5), l = R.range(14, 30); mb.beam([d.x, d.y, z], [d.x + Math.cos(a) * l, d.y + Math.sin(a) * l, z + R.range(2, 12)], 1.6, 1.6, 'metal_dark'); }
      break;
    }
    case 'container': {
      const mat = R.pick(['container_red', 'container_blue', 'container_grey', 'container_orange']);
      mb.box(d.x, d.y, z - 3, 9, 24, 10, d.rot, { top: 'snow', side: mat });
      break;
    }
    case 'drums': {
      for (let k = 0; k < 5; k++) mb.cyl(d.x + R.range(-6, 6), d.y + R.range(-6, 6), z - 2, 2.2, 6, R.pick(['container_red', 'steel_painted', 'container_blue']), { seg: 8, top: 'snow' });
      break;
    }
    case 'mast': {
      const a = d.rot, l = R.range(40, 60);
      mb.beam([d.x, d.y, z], [d.x + Math.cos(a) * l, d.y + Math.sin(a) * l, z + 6], 2, 2, 'steel_painted');
      mb.beam([d.x + Math.cos(a) * l * 0.7 - Math.sin(a) * 9, d.y + Math.sin(a) * l * 0.7 + Math.cos(a) * 9, z + 4], [d.x + Math.cos(a) * l * 0.7 + Math.sin(a) * 9, d.y + Math.sin(a) * l * 0.7 - Math.cos(a) * 9, z + 5], 1, 1, 'steel_painted');
      break;
    }
    case 'platform': {
      // A burnt-out gun platform: ring, wrecked mount, a bent barrel.
      mb.lathe(d.x, d.y, [[12, z - 2], [12, z + 2], [10, z + 2.6]], 'scorch', { seg: 14 });
      mb.box(d.x, d.y, z + 2, 10, 12, 7, d.rot, { top: 'scorch', side: 'scorch' });
      mb.beam([d.x, d.y, z + 6], [d.x + Math.cos(d.rot) * 22, d.y + Math.sin(d.rot) * 22, z + 3], 2, 2, 'metal_dark');
      break;
    }
    case 'buoy': {
      mb.lathe(d.x, d.y, [[4.5, -3], [5.5, 0], [5.5, 3], [4, 4]], 'container_red', { seg: 12 });
      mb.beam([d.x, d.y, 4], [d.x + 2, d.y, 15], 1, 1, 'steel_painted');
      break;
    }
    default: break;
  }
}

export { XW };
