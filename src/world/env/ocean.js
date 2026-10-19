import { meshShip, shipSize } from '../kit/ships.js';
import { debris } from '../paint/props.js';
import { RNG } from '../../core/RNG.js';

// OPEN OCEAN: an animated sea (calm swell → storm surge → maelstrom), a
// convoy / battle group under way (moving ships with wakes and funnel
// smoke), burning wrecks settling in the water, oil slicks, debris fields,
// life rafts, whitecaps and spray.
//
//   sea     water surface shader at z = 0 (waves, fresnel, sun glint, foam)
//   flot    overlay layer at z = 0.6: oil slicks, debris, foam patches (alpha)
//   movers  ships (geometry drawn with a moving offset; wakes + smoke follow)
//
// Params: storm 0..1, convoy 0..1 (ships), wrecks 0..1, oil 0..1, fires 0..1,
//         swirl 0..1 (maelstrom at the arena centre line, far ahead),
//         deep / shallow / skyCol colours, night (bool),
//         rigs 0..1 (offshore platforms: legs, decks, derricks, flare booms,
//         helidecks; burning when fires > 0), ice 0..1 (drifting floes)

const LEN = 512;

export default {
  id: 'ocean',
  label: 'Open ocean',
  defaults: { storm: 0.3, convoy: 0.6, wrecks: 0.4, oil: 0.3, fires: 0.4, swirl: 0, rigs: 0, ice: 0 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    const st = P.storm;
    const S = { P, seed, dust: [0.85, 0.9, 0.95] };
    S.atmosphere = {
      surfaces: [{
        type: 'water', z: 0,
        deep: P.deep || [0.02 + st * 0.0, 0.07 - st * 0.02, 0.11 - st * 0.03],
        shallow: P.shallow || [0.04, 0.16 - st * 0.05, 0.2 - st * 0.05],
        sky: P.skyCol || [0.5 - st * 0.25, 0.58 - st * 0.28, 0.66 - st * 0.3],
        wave: [0.55 + st * 1.1, 1 - st * 0.3, 0.8 + st * 0.6, 0.4 + st * 1.2],
        foam: [0.12 + st * 0.6, 0.9 - st * 0.35, 0.25 + st * 0.7, 0],
        swirl: P.swirl ? [0, 0, 900, P.swirl] : [0, 0, 0, 0],
        wind: [1, 0.3 + st],
      }],
    };
    if (P.swirl) S.swirlFollow = true; // the vortex centre tracks ahead of the camera (ArenaWorld)
    S.layers = [{
      id: 'flot', z: 0.6, x0: -520, x1: 520, length: LEN, ppu: 0.9, blend: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay) => { for (const w of lay.wrecks) meshShip(mb, w.type, w.x, w.y, w.rot, { burnt: true, lowered: true }); for (const r of lay.rigs) meshRig(mb, r); for (const f of lay.floes) meshFloe(mb, f); },
    }];
    S.surfacesTopDown = [{ z: 0, water: true }];
    return S;
  },
};

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { movers: [], wrecks: [], slicks: [], debris: [], rafts: [], anchors: [], rigs: [], floes: [] };
  // Offshore platforms (well clear of the flight line so they frame it).
  if (P.rigs > 0) for (let i = 0; i < 2; i++) if (R.chance(P.rigs * 0.8)) {
    const s = R.sign(), x = s * R.range(115, 230), y = R.range(y0 + 90, y1 - 90), rot = R.range(-0.3, 0.3) + (s > 0 ? 0 : Math.PI);
    const rig = { x, y, rot, w: R.range(56, 78), d: R.range(56, 78), burning: R.chance(P.fires * 0.6), seed: R.next() };
    lay.rigs.push(rig);
    const c = Math.cos(rot), sn = Math.sin(rot), bx = x - c * (rig.w / 2 + 46), by = y - sn * (rig.w / 2 + 46);
    lay.anchors.push({ type: 'fire', x: bx, y: by, z: 52, s: rig.burning ? 2.4 : 1.3 });
    lay.anchors.push({ type: 'smoke', x: bx, y: by, z: 70, s: rig.burning ? 2.4 : 1.2, dark: 0.85 });
    lay.anchors.push({ type: 'beacon', x, y, z: 110, c: [1, 0.15, 0.1], period: 60 });
    if (rig.burning) for (let k = 0; k < 2; k++) lay.anchors.push({ type: 'fire', x: x + R.range(-20, 20), y: y + R.range(-20, 20), z: 46, s: R.range(1.2, 1.8) });
    lay.slicks.push({ x: x + R.range(-60, 60), y: y + R.range(-60, 60), r: R.range(60, 120), fire: rig.burning && R.chance(0.5), seed: R.next() });
  }
  for (let i = 0; i < 26 * P.ice; i++) lay.floes.push({ x: R.range(-520, 520), y: R.range(y0, y1), r: R.range(6, 22), seed: R.next() });
  // Convoy lanes: ships steaming forward (slower than the camera) or against it.
  if (R.chance(P.convoy)) {
    const n = R.int(1, 2);
    for (let i = 0; i < n; i++) {
      const type = R.pick(['destroyer', 'frigate', 'freighter', 'tanker', 'patrol', 'freighter']);
      const S2 = shipSize(type);
      const x = R.sign() * R.range(110, 250), y = R.range(y0 + 60, y1 - 60);
      const ahead = R.chance(0.65);
      const speed = ahead ? R.range(0.25, 0.55) : -R.range(0.3, 0.6);
      lay.movers.push({ kind: 'ship', type, x, y, rot: ahead ? 0 : Math.PI, vx: 0, vy: speed, l: S2.l, b: S2.b, burning: R.chance(P.fires * 0.3) });
    }
  }
  if (R.chance(P.wrecks)) {
    const type = R.pick(['freighter', 'destroyer', 'tanker', 'trawler']);
    const x = R.sign() * R.range(90, 330), y = R.range(y0 + 80, y1 - 80), rot = R.angle();
    lay.wrecks.push({ type, x, y, rot });
    const S2 = shipSize(type);
    for (let k = 0; k < 2; k++) {
      const t = R.range(-0.35, 0.35);
      lay.anchors.push({ type: R.chance(P.fires) ? 'fire' : 'smoke', x: x - Math.sin(rot) * S2.l * t, y: y + Math.cos(rot) * S2.l * t, z: 8, s: R.range(1.2, 2), dark: 0.85 });
    }
    lay.slicks.push({ x, y, r: S2.l * 0.7, fire: R.chance(P.fires * 0.5), seed: R.next() });
  }
  for (let i = 0; i < 3 * P.oil; i++) if (R.chance(0.6)) {
    const x = R.range(-480, 480), y = R.range(y0, y1), fire = R.chance(P.fires * 0.5);
    lay.slicks.push({ x, y, r: R.range(40, 110), fire, seed: R.next() });
    if (fire) for (let k = 0; k < 3; k++) lay.anchors.push({ type: 'fire', x: x + R.range(-40, 40), y: y + R.range(-40, 40), z: 1, s: R.range(0.8, 1.3) });
  }
  for (let i = 0; i < 4; i++) lay.debris.push({ x: R.range(-480, 480), y: R.range(y0, y1), r: R.range(14, 40), seed: R.next() });
  for (let i = 0; i < 2; i++) if (R.chance(0.35)) lay.rafts.push({ x: R.range(-400, 400), y: R.range(y0, y1), rot: R.angle() });
  if (P.storm > 0.4) for (let k = 0; k < 3; k++) lay.anchors.push({ type: 'lightning', x: R.range(-600, 600), y: R.range(y0, y1), z: 420, s: 1.2, rate: 0.002 * P.storm });
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  // Transparent overlay: only slicks, debris, rafts and foam patches.
  p.ctx.clearRect(-1e5, -1e5, 2e5, 2e5);
  const all = [lay, ...nb.filter(Boolean)];
  for (const L of all) for (const sl of L.slicks) {
    const R = new RNG(`slick:${sl.seed}`);
    for (let k = 0; k < 7; k++) {
      const x = sl.x + R.range(-0.5, 0.5) * sl.r, y = sl.y + R.range(-0.5, 0.5) * sl.r, r = sl.r * R.range(0.35, 0.65);
      p.radial(x, y, r, [[0, [0.02, 0.02, 0.025], 0.85], [0.7, [0.03, 0.03, 0.04], 0.6], [1, [0.05, 0.05, 0.06], 0]], 'source-over', 1, R.range(0.5, 1));
      // Rainbow sheen at the edge.
      p.radial(x + 4, y - 3, r * 0.9, [[0.6, [0.2, 0.25, 0.4], 0], [0.85, [0.35, 0.3, 0.45], 0.18], [1, [0.3, 0.4, 0.3], 0]], 'screen');
    }
    if (sl.fire) p.radial(sl.x, sl.y, sl.r * 0.5, [[0, [0.15, 0.06, 0.02], 0.7], [1, [0.1, 0.04, 0.02], 0]]);
  }
  for (const L of all) for (const d of L.debris) debris(p, new RNG(`od:${d.seed}`), d.x, d.y, d.r, Math.round(d.r * 0.8), { color: [0.42, 0.36, 0.28] });
  for (const L of all) for (const r of L.rafts) p.at(r.x, r.y, r.rot, (cx) => {
    cx.fillStyle = 'rgb(230,110,30)'; cx.beginPath(); cx.ellipse(0, 0, 5, 7, 0, 0, 6.29); cx.fill();
    cx.fillStyle = 'rgb(60,40,30)'; cx.beginPath(); cx.ellipse(0, 0, 3, 4.5, 0, 0, 6.29); cx.fill();
  });
  // Wreck foam halos and slicks around the hulks.
  for (const L of all) for (const w of L.wrecks) p.radial(w.x, w.y, shipSize(w.type).l * 0.65, [[0, [0.85, 0.9, 0.92], 0.35], [1, [0.8, 0.85, 0.9], 0]], 'source-over', 1, 0.45);
  void S;
}

/** Offshore production platform: jacket legs, two-level deck, modules, derrick, flare boom, helideck. */
function meshRig(mb, r) {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const at = (u, v) => [r.x + u * c - v * s, r.y + u * s + v * c];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [x, y] = at(u * r.w * 0.38, v * r.d * 0.38); mb.box(x, y, -4, 6, 6, 40, r.rot, { top: 'steel_yellow', side: 'steel_yellow' }); }
  for (const v of [-1, 1]) { const a = at(-r.w * 0.38, v * r.d * 0.38), b = at(r.w * 0.38, v * r.d * 0.38); mb.beam([a[0], a[1], 14], [b[0], b[1], 14], 2, 2, 'steel_painted'); }
  mb.box(r.x, r.y, 36, r.w, r.d, 4, r.rot, { top: 'grating', side: 'steel_painted' });
  mb.box(r.x, r.y, 40, r.w * 0.94, r.d * 0.94, 8, r.rot, { top: r.burning ? 'roof_burnt' : 'grating', side: 'facade_industrial' });
  const R = { k: r.seed * 1000 };
  const rnd = () => { R.k = (R.k * 9301 + 49297) % 233280; return R.k / 233280; };
  for (let k = 0; k < 4; k++) { const [x, y] = at((rnd() - 0.5) * r.w * 0.6, (rnd() - 0.5) * r.d * 0.6); const m = ['container_orange', 'container_grey', 'container_blue', 'steel_painted'][k]; mb.box(x, y, 48, 12 + rnd() * 10, 10 + rnd() * 8, 6 + rnd() * 8, r.rot, { top: m, side: m }); }
  const [dx, dy] = at(r.w * 0.22, -r.d * 0.2);
  mb.lathe(dx, dy, [[10, 48], [2, 110]], 'lattice', { seg: 4, top: false });
  const [hx, hy] = at(r.w * 0.25, r.d * 0.3);
  mb.box(hx, hy, 56, 26, 26, 2, r.rot, { top: 'helipad', side: 'steel_painted' });
  const a = at(-r.w / 2, 0), b = at(-r.w / 2 - 46, 0);
  mb.beam([a[0], a[1], 44], [b[0], b[1], 52], 3, 3, 'lattice');
}

/** Drifting ice floe: a flat slab riding the swell. */
function meshFloe(mb, f) {
  const pts = [];
  const n = 9;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, rr = f.r * (0.65 + 0.35 * Math.sin(f.seed * 50 + k * 2.3)); pts.push(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.8); }
  mb.prism(pts, -1, 1.2, { top: 'ice', side: 'ice' });
  const inner = pts.map((v, i) => (i % 2 ? f.y + (v - f.y) * 0.7 : f.x + (v - f.x) * 0.7));
  mb.prism(inner, 1.2, 2.2, { top: 'snow', side: 'snow' });
}
