import { steelDeck, concrete, rock as rockSurf } from '../paint/surfaces.js';
import { meshBoulder } from '../kit/terrain.js';
import { crate, drum, debris, scorch } from '../paint/props.js';
import { RNG } from '../../core/RNG.js';

// FOUNDRY / STEEL MILL with molten channels.
//
//   lava   surface at z = -10 (animated molten metal, emissive)
//   floor  z = 0: steel deck plates and cast concrete, cut open over the
//          channels (alpha) — a meandering main channel along the flight
//          path and side runs across it; glowing rims, scorched plates
//   solids hall columns + open roof trusses, overhead gantry cranes with
//          ladles, furnaces with glowing mouths, crucibles, grating bridges
//          over the channels, smokestacks, pipe racks
//
// Params: heat 0..1 (glow / embers), damage 0..1, channels 0..1 (side runs),
//         hall (bool: columns + trusses), cool (bool: crusted, dimmer metal),
//         floor 'plant' | 'rock' (a natural magma cavern: stalagmites, boulders)

const LEN = 512, HALL = 250, TRUSS_Z = 168;

export default {
  id: 'foundry',
  label: 'Foundry / steel mill with molten channels',
  defaults: { heat: 0.8, damage: 0.5, channels: 0.7, hall: true, cool: false, floor: 'plant' },

  setup(cfg) {
    const P = { ...this.defaults, ...(cfg.params || {}) };
    const seed = cfg.seed || cfg.id;
    // Main channel: centre line and half-width as smooth functions of y.
    const cx = (y) => 34 * Math.sin(y / 410 + 1.3) + 14 * Math.sin(y / 163);
    const hw = (y) => 22 + 7 * Math.sin(y / 230 + 0.4);
    const sideAt = (m) => {
      const R = new RNG(`${seed}:side:${m}`);
      if (R.next() > P.channels) return null;
      return { y: m * 300 + R.range(40, 260), dir: R.sign(), len: R.range(160, 420), w: R.range(10, 16), wob: R.range(0, 6) };
    };
    const sidesIn = (y0, y1) => {
      const out = [];
      for (let m = Math.floor((y0 - 60) / 300); m <= Math.floor((y1 + 60) / 300); m++) { const s = sideAt(m); if (s) out.push(s); }
      return out;
    };
    const S = { P, seed, cx, hw, sidesIn, dust: [0.3, 0.28, 0.26] };
    S.atmosphere = { surfaces: [{ type: 'lava', z: -10, hot: P.cool ? [0.8, 0.22, 0.03] : [1, 0.34, 0.05], crust: [0.1, 0.05, 0.03], flow: [0, -1, 1.1, P.cool ? 0.85 : 0.5] }], glowTint: [1, 1, 1] };
    S.layers = [{
      id: 'floor', z: 0, x0: -470, x1: 470, length: LEN, ppu: 1.35, cut: true, glow: true,
      layout: (c) => layout(c, S),
      paint: (p, lay, nb, c) => paint(p, lay, nb, c, S),
      mesh: (mb, lay, c) => mesh(mb, lay, c, S),
    }];
    S.surfacesTopDown = [{ z: 0 }];
    return S;
  },
};

/** Polygon of the main channel over [y0, y1]. */
function channelPoly(S, y0, y1, grow = 0) {
  const L = [], Rr = [];
  for (let y = y0; y <= y1 + 0.1; y += 16) { const c = S.cx(y), w = S.hw(y) + grow; L.push(c - w, y); Rr.push(c + w, y); }
  const pts = [...L];
  for (let i = Rr.length - 2; i >= 0; i -= 2) pts.push(Rr[i], Rr[i + 1]);
  return pts;
}

function sidePoly(S, s, grow = 0) {
  const pts = [], back = [];
  const x0 = S.cx(s.y);
  for (let t = 0; t <= 1.001; t += 0.08) {
    const x = x0 + s.dir * s.len * t, y = s.y + Math.sin(t * 7 + s.wob) * 10;
    pts.push(x, y - s.w / 2 - grow); back.push(x, y + s.w / 2 + grow);
  }
  for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
  return pts;
}

function layout(c, S) {
  const { R, y0, y1 } = c, P = S.P;
  const lay = { cols: [], trusses: [], gantries: [], furnaces: [], crucibles: [], bridges: [], stacks: [], racks: [], anchors: [], clutter: [] };
  if (P.hall) {
    for (let y = Math.ceil(y0 / 96) * 96; y < y1; y += 96) {
      for (const s of [-1, 1]) lay.cols.push({ x: s * HALL, y });
      lay.trusses.push({ y, broken: R.chance(P.damage * 0.4) });
    }
  }
  if (R.chance(0.55)) {
    const y = R.range(y0 + 60, y1 - 60);
    lay.gantries.push({ y, tx: S.cx(y) + R.range(-20, 20), ladle: R.chance(0.6) });
    lay.anchors.push({ type: 'glow', x: S.cx(y), y, z: 2, r: 60, c: [1, 0.45, 0.1], a: 0.5, flicker: true });
  }
  // Furnaces line the hall walls; their mouths face the floor.
  for (const s of [-1, 1]) if (R.chance(0.6)) {
    const y = R.range(y0 + 70, y1 - 70);
    lay.furnaces.push({ x: s * R.range(330, 400), y, w: R.range(70, 100), d: R.range(80, 120), h: R.range(60, 90), face: -s });
    lay.anchors.push({ type: 'glow', x: s * 300, y, z: 6, r: 70, c: [1, 0.5, 0.15], a: 0.45, flicker: true });
    lay.anchors.push({ type: 'smoke', x: s * R.range(330, 400), y, z: 90, s: 1.4, dark: 0.6 });
  }
  for (let i = 0; i < 2; i++) if (R.chance(0.5)) lay.crucibles.push({ x: R.sign() * R.range(120, 220), y: R.range(y0 + 30, y1 - 30), r: R.range(12, 18), tilt: R.chance(0.3) });
  for (let y = Math.ceil(y0 / 170) * 170 + 40; y < y1; y += 170) lay.bridges.push({ y, w: R.range(14, 22) });
  for (const sd of S.sidesIn(y0, y1)) if (sd.y >= y0 && sd.y < y1) lay.bridges.push({ y: sd.y, side: sd, w: 12 });
  if (R.chance(0.45)) lay.stacks.push({ x: R.sign() * R.range(420, 460), y: R.range(y0, y1), r: R.range(14, 20), h: R.range(170, 230) });
  for (const st of lay.stacks) lay.anchors.push({ type: 'smoke', x: st.x, y: st.y, z: st.h, s: 2.2, dark: 0.75 });
  for (const s of [-1, 1]) if (R.chance(0.5)) lay.racks.push({ x: s * R.range(150, 200), y0: R.range(y0, y1 - 200), len: R.range(120, 200) });
  // Sparks and steam along the channel, embers in the heat.
  for (let k = 0; k < 4; k++) {
    const y = R.range(y0, y1), x = S.cx(y) + R.sign() * S.hw(y);
    lay.anchors.push({ type: R.chance(0.5) ? 'spark' : 'steam', x, y, z: 2, s: 1 });
  }
  for (let k = 0; k < 2 * P.heat; k++) { const y = R.range(y0, y1); lay.anchors.push({ type: 'fire', x: S.cx(y) + R.sign() * (S.hw(y) + R.range(4, 30)), y, z: 1, s: R.range(0.5, 0.8) }); }
  for (let i = 0; i < 10; i++) lay.clutter.push({ x: R.sign() * R.range(70, 440), y: R.range(y0, y1), seed: R.next() });
  lay.spires = [];
  if (P.floor === 'rock') for (let i = 0; i < 14; i++) { const x = R.sign() * R.range(120, 460), y = R.range(y0, y1); lay.spires.push({ x, y, r: R.range(10, 34), h: R.range(20, 140), seed: R.next() }); }
  lay.seed = R.next();
  return lay;
}

function paint(p, lay, nb, c, S) {
  const { y0, y1 } = c, P = S.P;
  const all = [lay, ...nb.filter(Boolean)];
  if (P.floor === 'rock') { rockSurf(p, { color: [0.2, 0.17, 0.16] }); p.patch('ridged_70', 500, [0.08, 0.06, 0.05], 0.6); }
  else {
    concrete(p, { color: [0.3, 0.29, 0.27], joints: [64, 64] });
    steelDeck(p, { path: () => p.rectPath(-HALL + 30, y0 - 4, (HALL - 30) * 2, y1 - y0 + 8), color: [0.27, 0.27, 0.27], plates: [40, 30], rust: 0.8 });
  }
  // Heat scorching around the molten runs (drawn before cutting them out).
  const sides = S.sidesIn(y0 - 100, y1 + 100);
  p.poly(channelPoly(S, y0 - 40, y1 + 40, 26)).fill([0.06, 0.05, 0.045], 0.75);
  p.poly(channelPoly(S, y0 - 40, y1 + 40, 10)).fill([0.03, 0.025, 0.02], 0.9);
  for (const sd of sides) { p.poly(sidePoly(S, sd, 14)).fill([0.05, 0.045, 0.04], 0.75); p.poly(sidePoly(S, sd, 5)).fill([0.02, 0.02, 0.02], 0.9); }
  p.patch('fbm_60', 300, [0.05, 0.045, 0.04], 0.45);
  // Hazard paint along walkway edges.
  if (P.floor !== 'rock') p.layer(() => {
    for (const s of [-1, 1]) p.line([s * (HALL - 30), y0 - 4, s * (HALL - 30), y1 + 4], 3, [0.85, 0.65, 0.1], 1, { dash: [6, 6], dashOffset: -(y0 % 12) });
  }, { wear: ['fine_60', 40, 1], alpha: 0.75 });
  p.props(() => new RNG(`fd:${lay.seed}`), (Rp) => {
    for (const L of all) for (const col of L.cols) p.shadowBox(col.x, col.y, 8, 8, TRUSS_Z);
    for (const L of all) for (const t of L.trusses) if (!t.broken) p.shadowBox(0, t.y, HALL * 2, 4, TRUSS_Z + 8, 0, TRUSS_Z);
    for (const L of all) for (const g of L.gantries) p.shadowBox(0, g.y, HALL * 2, 12, 150, 0, 140);
    for (const L of all) for (const f of L.furnaces) p.shadowBox(f.x, f.y, f.w, f.d, f.h);
    for (const L of all) for (const cr of L.crucibles) p.shadowCircle(cr.x, cr.y, cr.r, 18);
    for (const L of all) for (const st of L.stacks) p.shadowCircle(st.x, st.y, st.r, st.h);
    for (const L of all) for (const rk of L.racks) p.shadowBox(rk.x, rk.y0 + rk.len / 2, 10, rk.len, 38, 0, 30);
    for (const L of all) for (const cl of L.clutter) {
      const Rc = new RNG(`fc:${cl.seed}`);
      if (Rc.chance(0.4)) for (let k = 0; k < 4; k++) drum(p, cl.x + Rc.range(-6, 6), cl.y + Rc.range(-6, 6), { color: [0.3, 0.28, 0.25] });
      else if (Rc.chance(0.5)) crate(p, Rc, cl.x, cl.y, Rc.range(6, 10), Rc.range(-0.4, 0.4), { color: [0.4, 0.38, 0.34] });
      else { scorch(p, Rc, cl.x, cl.y, 18); debris(p, Rc, cl.x, cl.y, 20, 25, { color: [0.3, 0.28, 0.26] }); }
      // Ingot stacks.
      if (Rc.chance(0.3)) for (let k = 0; k < 6; k++) p.at(cl.x + 20 + (k % 3) * 7, cl.y + Math.floor(k / 3) * 5, 0, (cx) => { cx.fillStyle = 'rgb(70,64,58)'; cx.fillRect(-3, -2, 6, 4); });
    }
  }, 0.55, 3);
  // Glow map: hot rims + light thrown onto the floor.
  if (p.env.glow) {
    const g = p.env.glow, hot = P.cool ? [0.9, 0.3, 0.05] : [1, 0.45, 0.1];
    g.poly(channelPoly(S, y0 - 40, y1 + 40, 34)).fill(hot, 0.12 * P.heat, 'lighter');
    g.poly(channelPoly(S, y0 - 40, y1 + 40, 12)).fill(hot, 0.35 * P.heat, 'lighter');
    for (const sd of sides) { g.poly(sidePoly(S, sd, 18)).fill(hot, 0.12 * P.heat, 'lighter'); g.poly(sidePoly(S, sd, 6)).fill(hot, 0.3 * P.heat, 'lighter'); }
    for (const L of all) for (const f of L.furnaces) g.radial(f.x + f.face * f.w * 0.6, f.y, 80, [[0, [1, 0.5, 0.15], 0.6], [1, [1, 0.3, 0.05], 0]], 'lighter');
  }
  // Cut the channels open (alpha 0): the lava surface shows through.
  p.poly(channelPoly(S, y0 - 40, y1 + 40)).fill([0, 0, 0], 1, 'destination-out');
  for (const sd of sides) p.poly(sidePoly(S, sd)).fill([0, 0, 0], 1, 'destination-out');
  // Crusted metal lip on the cut edge.
  p.poly(channelPoly(S, y0 - 40, y1 + 40)).stroke([0.25, 0.12, 0.06], 2.5, 0.9, 'source-atop');
}

function mesh(mb, lay, c, S) {
  for (const sp of lay.spires || []) meshBoulder(mb, sp.x, sp.y, sp.r, sp.h, sp.seed, 'rock_dark');
  for (const col of lay.cols) {
    mb.box(col.x, col.y, 0, 8, 8, TRUSS_Z, 0, { top: 'steel_painted', side: 'steel_painted' });
    mb.box(col.x, col.y, 0, 14, 14, 4, 0, { top: 'concrete', side: 'concrete' });
  }
  for (const t of lay.trusses) {
    if (t.broken) {
      mb.beam([-HALL, t.y, TRUSS_Z], [-HALL * 0.2, t.y + 18, TRUSS_Z - 70], 4, 6, 'rust');
      continue;
    }
    mb.beam([-HALL, t.y, TRUSS_Z], [HALL, t.y, TRUSS_Z], 4, 6, 'steel_painted');
    mb.beam([-HALL, t.y, TRUSS_Z + 26], [HALL, t.y, TRUSS_Z + 26], 3, 4, 'steel_painted');
    for (let k = -4; k <= 4; k++) mb.beam([k * HALL / 5, t.y, TRUSS_Z], [(k + 0.5) * HALL / 5, t.y, TRUSS_Z + 26], 1.6, 1.6, 'steel_painted');
  }
  for (const g of lay.gantries) {
    mb.box(0, g.y, 140, HALL * 2, 12, 10, 0, { top: 'steel_yellow', side: 'steel_yellow' });
    mb.box(g.tx, g.y, 130, 22, 20, 10, 0, { top: 'metal_dark', side: 'metal_dark' });
    if (g.ladle) {
      mb.beam([g.tx - 8, g.y, 130], [g.tx - 8, g.y, 82], 1, 1, 'metal_dark');
      mb.beam([g.tx + 8, g.y, 130], [g.tx + 8, g.y, 82], 1, 1, 'metal_dark');
      mb.lathe(g.tx, g.y, [[9, 54], [15, 60], [17, 76], [17.5, 84], [15, 86]], 'rust', { seg: 14, top: 'molten_top' });
    }
  }
  for (const f of lay.furnaces) {
    mb.box(f.x, f.y, 0, f.w, f.d, f.h, 0, { top: 'roof_metal', side: 'facade_industrial', sides: [null, f.face > 0 ? 'furnace_mouth' : null, null, f.face < 0 ? 'furnace_mouth' : null] });
    mb.cyl(f.x + f.w * 0.2, f.y - f.d * 0.2, f.h, 8, 50, 'rust', { seg: 10 });
  }
  for (const cr of lay.crucibles) mb.lathe(cr.x, cr.y, [[cr.r * 0.6, 0], [cr.r, 6], [cr.r * 1.1, 16], [cr.r * 1.05, 19]], 'rust', { seg: 14, top: 'molten_top' });
  for (const st of lay.stacks) {
    mb.lathe(st.x, st.y, [[st.r * 1.3, 0], [st.r, 20], [st.r * 0.85, st.h], [st.r * 0.95, st.h + 4]], 'concrete_dark', { seg: 14, top: 'scorch' });
  }
  for (const rk of lay.racks) {
    for (let y = rk.y0; y <= rk.y0 + rk.len; y += 40) mb.box(rk.x, y, 0, 3, 3, 34, 0, { top: 'steel_painted', side: 'steel_painted' });
    for (const o of [-3, 0, 3]) mb.beam([rk.x + o, rk.y0, 36], [rk.x + o, rk.y0 + rk.len, 36], 2.4, 2.4, o ? 'steel_painted' : 'rust');
  }
  // Grating bridges over the main channel (and over side runs where they leave it).
  for (const b of lay.bridges) {
    const cx = S.cx(b.y), w = S.hw(b.y) + 14;
    if (b.side) { const x = cx + b.side.dir * 70; mb.box(x, b.y, 2, b.w, b.side.w + 18, 1.5, 0, { top: 'grating', side: 'steel_painted' }); continue; }
    mb.box(cx, b.y, 2, w * 2, b.w, 1.5, 0, { top: 'grating', side: 'steel_painted' });
    for (const s of [-1, 1]) mb.box(cx, b.y + s * b.w / 2, 3.5, w * 2, 0.8, 5, 0, { top: 'steel_yellow', side: 'steel_yellow' });
  }
}
