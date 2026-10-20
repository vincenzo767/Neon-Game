import { concrete, steelDeck, asphalt, gravel } from '../paint/surfaces.js';
import { crate, drum, debris, scorch, truck, carColor, car } from '../paint/props.js';
import { RNG } from '../../core/RNG.js';

// INDUSTRIAL REACTOR COMPLEX
//
// mode 'hall'      inside a reactor hall: a line of reactor pits whose cores
//                  glow up through the floor, radial coolant pipes, catwalk
//                  bridges, machinery blocks, crane rails overhead, alarm
//                  beacons (red alert), steam, sparks
// mode 'plant'     the plant outside: containment domes, hyperboloid cooling
//                  towers trailing steam, turbine halls, transformer yards,
//                  pipe racks, roads, fences
//
// Params: mode, alert 0..1 (red alarm lighting), damage 0..1, steam 0..1,
//         core [r, g, b] core colour, towers 0..1 (plant)

const LEN = 512, PIT_STEP = 768;

export default {
  id: 'reactor',
  label: 'Reactor complex',
  defaults: { mode: 'hall', alert: 0.6, damage: 0.4, steam: 0.6, core: [1, 0.45, 0.18], towers: 0.8 },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const S = { P, seed: cfg.seed || cfg.id, dust: [0.4, 0.4, 0.42] };
    const hall = P.mode === 'hall';
    S.layers = [{
      id: 'floor', z: 0, x0: -480, x1: 480, length: LEN, ppu: hall ? 1.4 : 1.2, glow: true, cut: hall,
      layout: (c) => (hall ? layoutHall(c, S) : layoutPlant(c, S)),
      paint: (p, lay, nb, c) => (hall ? paintHall(p, lay, nb, c, S) : paintPlant(p, lay, nb, c, S)),
      mesh: (mb, lay) => (hall ? meshHall(mb, lay, S) : meshPlant(mb, lay, S)),
    }];
    if (hall) S.atmosphere = { surfaces: [{ type: 'lava', z: -40, hot: P.core, crust: [0.05, 0.02, 0.02], flow: [0.2, 1, 0.5, 0.2] }] };
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

// ================================================================== hall

const pitY = (k) => k * PIT_STEP + 380;

function layoutHall(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { pits: [], blocks: [], rails: [], cats: [], anchors: [], pipes: [], clutter: [] };
  for (let k = Math.floor((y0 - 400) / PIT_STEP); k <= Math.floor((y1 + 400) / PIT_STEP); k++) {
    const y = pitY(k);
    if (y >= y0 && y < y1) {
      lay.pits.push({ y, r: 120 });
      lay.anchors.push({ type: 'glow', x: 0, y, z: -10, r: 200, c: P.core, a: 0.55, flicker: true });
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + 0.26;
        lay.anchors.push({ type: 'beacon', x: Math.cos(ang) * 150, y: y + Math.sin(ang) * 150, z: 26, c: [1, 0.08, 0.04], period: 46 + a * 3 });
        lay.pipes.push({ y, ang });
      }
      lay.cats.push({ y, rot: R.range(0, 0.6) });
      if (R.chance(P.steam)) lay.anchors.push({ type: 'steam', x: R.range(-60, 60), y, z: 10, s: 2.2 });
    }
  }
  // Machinery blocks along the walls; crane rails overhead every 256.
  for (const s of [-1, 1]) for (let y = Math.ceil(y0 / 64) * 64; y < y1; y += 64) {
    if (R.chance(0.65)) lay.blocks.push({ x: s * R.range(250, 330), y: y + R.range(-8, 8), w: R.range(40, 90), d: R.range(36, 56), h: R.range(20, 60), kind: R.pick(['pump', 'tank', 'cabinet', 'turbine']) });
    if (R.chance(0.15)) lay.anchors.push({ type: 'spark', x: s * 230, y, z: 30 });
  }
  for (let y = Math.ceil(y0 / 256) * 256; y < y1; y += 256) lay.rails.push({ y });
  for (let i = 0; i < 4; i++) if (R.chance(P.alert)) lay.anchors.push({ type: 'searchlight', x: R.sign() * 340, y: R.range(y0, y1), z: 60, c: [1, 0.1, 0.05], base: R.angle(), sweep: 3.2, speed: 0.04 });
  for (let i = 0; i < 8; i++) lay.clutter.push({ x: R.sign() * R.range(180, 420), y: R.range(y0, y1), seed: R.next() });
  lay.seed = R.next();
  return lay;
}

function paintHall(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  concrete(p, { color: [0.34, 0.34, 0.35], joints: [48, 48] });
  steelDeck(p, { path: () => p.rectPath(-210, y0 - 4, 420, y1 - y0 + 8), color: [0.3, 0.31, 0.32], plates: [32, 32], rust: 0.4 });
  // Hazard bands bordering the reactor walk and painted lane arrows.
  p.layer(() => {
    for (const s of [-1, 1]) p.line([s * 214, y0 - 4, s * 214, y1 + 4], 5, [0.9, 0.7, 0.1], 1, { dash: [8, 8], dashOffset: -(y0 % 16) });
  }, { wear: ['fine_60', 50, 1], alpha: 0.85 });
  for (const L of all) for (const pit of L.pits) {
    // Containment ring: thick concrete collar with yellow/black hazard edge.
    p.circlePath(0, pit.y, pit.r + 34).fill([0.42, 0.42, 0.44]);
    p.noise('fbm', 120, 'soft-light', 0.5, { path: () => p.circlePath(0, pit.y, pit.r + 34) });
    for (let a = 0; a < 48; a++) {
      const a0 = (a / 48) * Math.PI * 2, a1 = ((a + 0.5) / 48) * Math.PI * 2;
      p.ctx.beginPath(); p.ctx.arc(0, pit.y, pit.r + 30, a0, a1); p.ctx.arc(0, pit.y, pit.r + 22, a1, a0, true); p.ctx.closePath();
      p.fill([0.9, 0.72, 0.1], 0.9);
    }
    for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2; p.circlePath(Math.cos(ang) * (pit.r + 12), pit.y + Math.sin(ang) * (pit.r + 12), 3).fill([0.15, 0.15, 0.16]); }
  }
  p.props(() => new RNG(`rh:${lay.seed}`), (Rp) => {
    for (const L of all) for (const b of L.blocks) p.shadowBox(b.x, b.y, b.w, b.d, b.h);
    for (const L of all) for (const r of L.rails) p.shadowBox(0, r.y, 900, 8, 150, 0, 140);
    for (const L of all) for (const cl of L.clutter) {
      const Rc = new RNG(`rhc:${cl.seed}`);
      if (Rc.chance(0.5)) for (let k = 0; k < 4; k++) drum(p, cl.x + Rc.range(-6, 6), cl.y + Rc.range(-6, 6), { color: [0.75, 0.6, 0.1] });
      else crate(p, Rc, cl.x, cl.y, Rc.range(6, 10), Rc.range(-0.3, 0.3), { color: [0.42, 0.44, 0.46] });
      if (Rc.chance(S.P.damage)) { scorch(p, Rc, cl.x, cl.y, 20); debris(p, Rc, cl.x, cl.y, 24, 30); }
    }
  }, 0.55, 3);
  if (p.env.glow) for (const L of all) for (const pit of L.pits) p.env.glow.radial(0, pit.y, pit.r + 80, [[0, P.core, 0.8], [0.7, P.core, 0.35], [1, P.core, 0]], 'lighter');
  // Open the pits (alpha 0): the core glows below.
  for (const L of all) for (const pit of L.pits) p.circlePath(0, pit.y, pit.r).fill([0, 0, 0], 1, 'destination-out');
}

function meshHall(mb, lay, S) {
  for (const pit of lay.pits) {
    // Pit wall: inner face of a cylinder going down to the core.
    mb.lathe(0, pit.y, [[pit.r, -40], [pit.r, 0]], 'concrete_dark', { seg: 32, top: false });
    // Core housing in the pit: a lattice cage + fuel rods.
    mb.lathe(0, pit.y, [[pit.r * 0.55, -40], [pit.r * 0.55, -16], [pit.r * 0.4, -10]], 'metal_dark', { seg: 20, top: 'reactor_core' });
    for (const p2 of lay.pipes.filter((q) => q.y === pit.y)) {
      const c = Math.cos(p2.ang), s = Math.sin(p2.ang);
      mb.beam([c * (pit.r + 30), pit.y + s * (pit.r + 30), 6], [c * 300, pit.y + s * 300, 10], 8, 8, 'steel_painted');
      mb.box(c * (pit.r + 40), pit.y + s * (pit.r + 40), 0, 18, 18, 14, p2.ang, { top: 'metal_dark', side: 'steel_painted' });
    }
  }
  for (const ct of lay.cats) {
    // Catwalk across the pit with rails.
    const len = 330, c = Math.cos(ct.rot), s = Math.sin(ct.rot);
    mb.box(0, ct.y, 18, len, 12, 2, ct.rot, { top: 'grating', side: 'steel_yellow' });
    for (const side of [-1, 1]) mb.box(-s * side * 6, ct.y + c * side * 6, 20, len, 0.8, 6, ct.rot, { top: 'steel_yellow', side: 'steel_yellow' });
    mb.box(0, ct.y, 0, 10, 10, 18, 0, { top: 'steel_painted', side: 'steel_painted' });
  }
  for (const b of lay.blocks) {
    if (b.kind === 'tank') mb.lathe(b.x, b.y, [[b.d * 0.45, 0], [b.d * 0.45, b.h], [b.d * 0.3, b.h + 6], [0, b.h + 8]], 'steel_painted', { seg: 14 });
    else if (b.kind === 'turbine') { mb.box(b.x, b.y, 0, b.w, b.d, b.h * 0.5, 0, { top: 'metal_dark', side: 'steel_painted' }); mb.lathe(b.x, b.y, [[b.d * 0.3, b.h * 0.5], [b.d * 0.35, b.h * 0.7], [0, b.h * 0.75]], 'steel_yellow', { seg: 12 }); }
    else mb.box(b.x, b.y, 0, b.w, b.d, b.h, 0, { top: b.kind === 'pump' ? 'metal_dark' : 'roof_metal', side: b.kind === 'cabinet' ? 'control_panel' : 'steel_painted' });
  }
  for (const r of lay.rails) {
    mb.box(0, r.y, 140, 900, 8, 10, 0, { top: 'steel_yellow', side: 'steel_yellow' });
    mb.box(Math.sin(r.y) * 120, r.y, 128, 26, 22, 12, 0, { top: 'metal_dark', side: 'steel_yellow' });
  }
}

// ================================================================= plant

function layoutPlant(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { towers: [], domes: [], halls: [], yards: [], racks: [], anchors: [], stacks: [], vehicles: [] };
  for (const s of [-1, 1]) {
    if (R.chance(P.towers)) {
      const x = s * R.range(250, 380), y = R.range(y0 + 120, y1 - 120), r = R.range(70, 95), h = R.range(220, 300);
      lay.towers.push({ x, y, r, h });
      for (let k = 0; k < 2; k++) lay.anchors.push({ type: 'steam', x: x + R.range(-20, 20), y: y + R.range(-20, 20), z: h, s: 4.5 });
    }
  }
  if (R.chance(0.6)) {
    const y = R.range(y0 + 120, y1 - 120);
    lay.domes.push({ x: R.range(-60, 60), y, r: R.range(70, 90) });
    lay.halls.push({ x: R.sign() * 150, y, w: 80, d: 200, h: 46 });
    lay.anchors.push({ type: 'beacon', x: 0, y, z: 120, c: [1, 0.1, 0.05], period: 60 });
  }
  for (let i = 0; i < 2; i++) if (R.chance(0.5)) lay.yards.push({ x: R.sign() * R.range(100, 380), y: R.range(y0 + 50, y1 - 50), seed: R.next() });
  for (const s of [-1, 1]) if (R.chance(0.6)) lay.racks.push({ x: s * R.range(90, 200), y0: y0, y1: y1 });
  if (R.chance(0.4)) { const x = R.sign() * R.range(380, 440), y = R.range(y0, y1), h = R.range(160, 240); lay.stacks.push({ x, y, h }); lay.anchors.push({ type: 'smoke', x, y, z: h, s: 1.6, dark: 0.3 }); lay.anchors.push({ type: 'beacon', x, y, z: h + 2, c: [1, 0.1, 0.05], period: 70 }); }
  for (let i = 0; i < 2; i++) lay.vehicles.push({ x: R.range(-40, 40), y: R.range(y0, y1), rot: R.chance(0.5) ? 0 : Math.PI, color: carColor(R) });
  lay.seed = R.next();
  return lay;
}

function paintPlant(p, lay, nb, c, S) {
  const { y0, y1 } = c;
  const all = [lay, ...nb.filter(Boolean)];
  gravel(p, { color: [0.45, 0.44, 0.42] });
  concrete(p, { path: () => p.rectPath(-470, y0 - 4, 940, y1 - y0 + 8), color: [0.52, 0.51, 0.49], joints: [40, 40] });
  asphalt(p, { path: () => p.rectPath(-50, y0 - 4, 100, y1 - y0 + 8), color: [0.22, 0.22, 0.23] });
  p.layer(() => { p.line([0, y0 - 20, 0, y1 + 20], 1.2, [0.9, 0.75, 0.1], 1, { dash: [12, 10], dashOffset: -((y0 - 20) % 22) }); }, { wear: ['fine_60', 50, 1], alpha: 0.7 });
  for (const L of all) for (const t of L.towers) p.circlePath(t.x, t.y, t.r * 1.25).fill([0.4, 0.4, 0.38]);
  p.props(() => new RNG(`rp:${lay.seed}`), (Rp) => {
    for (const L of all) for (const t of L.towers) p.shadowCircle(t.x, t.y, t.r * 0.9, t.h, 0, 16);
    for (const L of all) for (const d of L.domes) p.shadowCircle(d.x, d.y, d.r, d.r * 1.3, 0, 16);
    for (const L of all) for (const h of L.halls) p.shadowBox(h.x, h.y, h.w, h.d, h.h);
    for (const L of all) for (const s of L.stacks) p.shadowCircle(s.x, s.y, 9, s.h, 0, 8);
    for (const L of all) for (const r of L.racks) p.shadowBox(r.x, (y0 + y1) / 2, 10, y1 - y0 + 200, 34, 0, 26);
    for (const L of all) for (const yd of L.yards) {
      const Ry = new RNG(`yd:${yd.seed}`);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) p.shadowBox(yd.x + (i - 2.5) * 16, yd.y + (j - 1) * 22, 8, 10, 14);
      void Ry;
    }
    for (const L of all) for (const v of L.vehicles) Rp.chance(0.5) ? car(p, v.x, v.y, v.rot, { color: v.color }) : truck(p, v.x, v.y, v.rot, { cargo: 'tank' });
  }, 0.55, 2.5);
}

function meshPlant(mb, lay) {
  for (const t of lay.towers) {
    // Hyperboloid cooling tower.
    const prof = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10, z = u * t.h, r = t.r * (0.62 + 0.38 * Math.pow((u - 0.72) / 0.72, 2)); prof.push([r, z]); }
    mb.lathe(t.x, t.y, prof, 'cooling_tower', { seg: 26, top: false });
    mb.lathe(t.x, t.y, [[t.r * 0.62 - 3, t.h * 0.2], [t.r * 0.62 - 3, t.h]], 'concrete_dark', { seg: 26, top: false });
  }
  for (const d of lay.domes) {
    const prof = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; prof.push([Math.cos(a) * d.r + 0.01, d.r * 0.55 + Math.sin(a) * d.r * 0.75]); }
    mb.lathe(d.x, d.y, [[d.r, 0], [d.r, d.r * 0.55], ...prof.slice(1)], 'containment', { seg: 28 });
  }
  for (const h of lay.halls) {
    mb.box(h.x, h.y, 0, h.w, h.d, h.h, 0, { top: 'roof_metal', side: 'facade_industrial' });
    for (let k = -2; k <= 2; k++) mb.box(h.x, h.y + k * 36, h.h, h.w * 0.3, 10, 4, 0, { top: 'metal_dark', side: 'metal_dark' });
  }
  for (const s of lay.stacks) mb.lathe(s.x, s.y, [[11, 0], [8, s.h], [8.5, s.h + 3]], 'stack_stripes', { seg: 12, top: 'scorch' });
  for (const r of lay.racks) {
    for (let y = Math.ceil(r.y0 / 48) * 48; y < r.y1; y += 48) mb.box(r.x, y, 0, 3, 3, 30, 0, { top: 'steel_painted', side: 'steel_painted' });
    for (const o of [-3, 0, 3]) mb.beam([r.x + o, r.y0, 31], [r.x + o, r.y1, 31], 2.6, 2.6, o ? 'steel_painted' : 'steel_yellow');
  }
  for (const yd of lay.yards) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) mb.box(yd.x + (i - 2.5) * 16, yd.y + (j - 1) * 22, 0, 8, 10, 12, 0, { top: 'metal_dark', side: 'steel_painted' });
}
