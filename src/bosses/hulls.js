import { mirrorPath, glowDot, canopy } from '../fx/art.js';
import {
  greeble, keyLight, bevel, plateFill, metal, rivetRow, hazard, vent, pipe, cables, turbine, core, lamp,
} from '../fx/greeble.js';
import { FACTIONS } from '../data/factions/index.js';

// M4d boss visual retrofit (UPDATE_02 §4.2–4.4): screen-dominating hulls
// (50–80% of the 480-unit field width) in each owning faction's palette,
// detailed with the greeble generator and lit from the top left.
//
// Visual only. Every sprite keeps its name, and each design is built around
// the anchor points the boss logic already uses (part offsets, gun ports,
// muzzles, wing positions), so bullets still leave the hull where the art
// shows a weapon. Collision radii are unchanged.
//
// Drawn centre-relative (each drawer runs with (0, 0) at the sprite centre),
// facing DOWN. `HULL_META[sprite]` records idle lights and animated features
// (tread strips, lift fans) for the runtime look layer (bosses/look.js).

const TAU = Math.PI * 2;
const PAL = Object.fromEntries(Object.entries(FACTIONS).map(([k, f]) => [k, f.greeble]));

/** sprite name → { lights: [{x, y, c, ph}], treads?, fans?, ... } */
export const HULL_META = {};

/** Wrap a centre-relative drawer as an atlas draw fn that records meta. */
export function hull(name, fn) {
  return (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    HULL_META[name] = fn(ctx, w, h) || { lights: [] };
    ctx.restore();
  };
}

const mpoly = (ctx, pts) => mirrorPath(ctx, 0, pts);
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
const circ = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
function clipTo(ctx, path, fn) { ctx.save(); path(); ctx.clip(); const r = fn(); ctx.restore(); return r; }
const both = (fn) => { fn(1); fn(-1); };

/** Bolted ring (turret race / part mount). */
function mountRing(ctx, pal, x, y, r) {
  circ(ctx, x, y, r); ctx.fillStyle = '#07080a'; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = metal(ctx, pal, x - r, x + r); ctx.stroke();
  ctx.lineWidth = 0.6; ctx.strokeStyle = '#020203'; circ(ctx, x, y, r + 1.2); ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ctx.fillStyle = pal.rivet;
    circ(ctx, x + Math.cos(a) * (r + 0.1), y + Math.sin(a) * (r + 0.1), 0.6); ctx.fill();
  }
}

/** Weld seam: bright dashed bead along a polyline. */
function weld(ctx, pts, color = 'rgba(255,170,90,0.55)') {
  ctx.save();
  ctx.setLineDash([1.2, 1]);
  ctx.strokeStyle = color; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke(); ctx.restore();
}

// =============================================================== IRONCLAD
// Colossus Crawler: four-tread siege platform on outrigger sponsons, engine
// deck with smokestacks, reactor weak point, main gun and dozer ram.
// Anchors: turrets (±38,-30), mortar bays (±36,44), muzzle (0,76).

function tread(ctx, pal, s, y0, y1, out) {
  const xi = 96, xo = 142, fender = 20;
  const l = s > 0 ? xi : -xo, r = s > 0 ? xo : -xi;
  ctx.beginPath(); ctx.roundRect(l, y0, r - l, y1 - y0, 7);
  ctx.fillStyle = '#0b0807'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#020101'; ctx.stroke();
  // Static links (the look layer scrolls a copy over the exposed strip).
  ctx.lineWidth = 1.7; ctx.strokeStyle = 'rgba(112,96,80,0.55)';
  ctx.beginPath();
  for (let y = y0 + 4; y < y1 - 3; y += 5) { ctx.moveTo(l + 2, y); ctx.lineTo(r - 2, y); }
  ctx.stroke();
  // Drive sprockets at both ends of the exposed strip.
  const ex0 = s > 0 ? l + fender : l, ex1 = s > 0 ? r : r - fender, mx = (ex0 + ex1) / 2;
  for (const y of [y0 + 9, y1 - 9]) {
    circ(ctx, mx, y, 7.5); ctx.fillStyle = metal(ctx, pal, mx - 8, mx + 8); ctx.fill();
    ctx.strokeStyle = '#030201'; ctx.lineWidth = 0.8; ctx.stroke();
    circ(ctx, mx, y, 2.4); ctx.fillStyle = '#120a06'; ctx.fill();
  }
  // Armoured fender over the inner edge.
  const fx = s > 0 ? l : r - fender;
  ctx.beginPath(); ctx.rect(fx, y0 + 5, fender, y1 - y0 - 10);
  plateFill(ctx, pal, fx, fx + fender); bevel(ctx, pal, 0.8);
  rivetRow(ctx, pal, fx + 3, y0 + 9, fx + 3, y1 - 9, 5);
  rivetRow(ctx, pal, fx + fender - 3, y0 + 9, fx + fender - 3, y1 - 9, 5);
  hazard(ctx, pal, fx, y0 + 5, fender, 6); hazard(ctx, pal, fx, y1 - 11, fender, 6);
  out.push({ x0: ex0 + 1.5, x1: ex1 - 1.5, y0: y0 + 17, y1: y1 - 17 });
}

export function crawler(ctx) {
  const pal = PAL.ironclad, lights = [], treads = [];
  // Treads on outriggers (two per side, in tandem).
  both((s) => { tread(ctx, pal, s, -112, -14, treads); tread(ctx, pal, s, 2, 104, treads); });
  // Sponson arms with hydraulic rams.
  both((s) => {
    for (const [ya, yb] of [[-80, -54], [20, 46]]) {
      const x0 = s > 0 ? 52 : -100;
      ctx.beginPath(); ctx.rect(x0, ya, 48, yb - ya);
      plateFill(ctx, pal, x0, x0 + 48); bevel(ctx, pal);
      pipe(ctx, pal, x0 + 2, ya + 5, x0 + 46, ya + 5, 2.2);
      pipe(ctx, pal, x0 + 2, yb - 5, x0 + 46, yb - 5, 2.2);
      hazard(ctx, pal, x0 + 15, ya + 9.5, 18, yb - ya - 19);
    }
  });
  // Main hull.
  const H = () => mpoly(ctx, [0, -108, 36, -108, 56, -94, 62, -62, 64, 42, 56, 78, 40, 94, 0, 100]);
  H(); plateFill(ctx, pal, -64, 64, 2); bevel(ctx, pal, 1.3);
  clipTo(ctx, H, () => lights.push(...greeble(ctx, pal, [-64, -108, 128, 208], {
    seed: 'crawler', panel: 11, rivets: 0.6, vents: 4, pipes: 4, cables: 2, hazards: 2, lights: 3, glow: 0.6,
  }).lights));
  // Welded scrap patches (Brotherhood repairs).
  for (const [x, y, s] of [[-46, 6, 1], [40, -46, 0.8], [-30, 66, 0.7], [50, 30, 0.9]]) {
    const p = [x - 9 * s, y - 6 * s, x + 7 * s, y - 8 * s, x + 10 * s, y + 4 * s, x - 2 * s, y + 9 * s, x - 10 * s, y + 3 * s];
    poly(ctx, p); ctx.fillStyle = metal(ctx, pal, x - 10, x + 10); ctx.fill();
    weld(ctx, [...p, p[0], p[1]]);
  }
  // Engine deck: radiator + smokestacks.
  ctx.beginPath(); ctx.rect(-44, -104, 88, 40); plateFill(ctx, pal, -44, 44); bevel(ctx, pal);
  vent(ctx, pal, -34, -100, 68, 12, 0.7, false);
  for (const s of [-1, 1]) {
    circ(ctx, s * 26, -78, 10.5); ctx.fillStyle = metal(ctx, pal, s * 26 - 11, s * 26 + 11); ctx.fill(); ctx.strokeStyle = '#020101'; ctx.lineWidth = 1; ctx.stroke();
    circ(ctx, s * 26, -78, 7.4); ctx.fillStyle = '#050302'; ctx.fill();
  }
  // Reactor housing (weak point).
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * 15, -48 + Math.sin(a) * 15); }
  ctx.closePath(); plateFill(ctx, pal, -15, 15); bevel(ctx, pal);
  // Part mounts.
  for (const s of [-1, 1]) mountRing(ctx, pal, s * 38, -30, 15.5);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#080503'; ctx.fillRect(s * 36 - 16, 28, 32, 32);
    hazard(ctx, pal, s * 36 - 18, 26, 36, 4); hazard(ctx, pal, s * 36 - 18, 58, 36, 4);
  }
  // Main turret + gun.
  ctx.beginPath(); ctx.rect(-5, 30, 10, 48); plateFill(ctx, pal, -5, 5); bevel(ctx, pal, 0.7);
  ctx.beginPath(); ctx.rect(-7, 44, 14, 6); plateFill(ctx, pal, -7, 7); bevel(ctx, pal, 0.6);
  ctx.beginPath(); ctx.rect(-8.5, 74, 17, 10); plateFill(ctx, pal, -8.5, 8.5); bevel(ctx, pal, 0.7);
  ctx.fillStyle = '#050302'; for (const s of [-1, 1]) ctx.fillRect(s * 5 - 1.2, 76, 2.4, 6);
  circ(ctx, 0, 8, 30); plateFill(ctx, pal, -30, 30); bevel(ctx, pal, 1.2);
  circ(ctx, 0, 8, 20); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  rivetRow(ctx, pal, -16, -6, 16, -6, 4);
  circ(ctx, 9, 0, 6); ctx.fillStyle = metal(ctx, pal, 3, 15); ctx.fill(); ctx.strokeStyle = '#020101'; ctx.stroke();
  ctx.fillStyle = '#0a0604'; ctx.fillRect(-14, 14, 10, 4);
  // Dozer ram with teeth.
  const ram = () => mpoly(ctx, [0, 92, 64, 90, 82, 96, 76, 108, 0, 108]);
  ram(); plateFill(ctx, pal, -82, 82); bevel(ctx, pal);
  clipTo(ctx, ram, () => hazard(ctx, pal, -84, 95, 168, 7, 3.4));
  ctx.fillStyle = metal(ctx, pal, -80, 80);
  for (let x = -72; x <= 72; x += 9) { poly(ctx, [x - 3, 107, x + 3, 107, x, 112]); ctx.fill(); }
  keyLight(ctx, -150, -118, 150, 118, 1);
  // Emissives (after the key light so they stay hot).
  for (const s of [-1, 1]) glowDot(ctx, s * 26, -78, 7, 'rgba(255,120,30,1)');
  core(ctx, pal, 0, -48, 8, '#ff7a1a');
  for (const s of [-1, 1]) { glowDot(ctx, s * 60, 98, 4.5, 'rgba(255,210,120,1)'); lights.push({ x: s * 119, y: -110, c: pal.light, ph: s > 0 ? 0 : 0.5 }); lamp(ctx, s * 119, -110, pal.light, 1.6); }
  return { lights, treads, stacks: [[-26, -78], [26, -78]] };
}

// ================================================================ STRATOS
// Skywarden Carrier: swept flying-wing carrier with a flight deck, twin lift
// fans, segmented tail. Anchors: bays (±46,10), pods (±74,38), wing guns
// (±80,30), beam emitters along y 30, nose (0,50).

export function carrier(ctx) {
  const pal = PAL.stratos, lights = [];
  const W = () => mpoly(ctx, [0, -100, 12, -96, 20, -72, 40, -76, 108, -64, 166, -50, 170, -36, 124, -10, 64, 24, 34, 50, 20, 76, 0, 88]);
  W(); plateFill(ctx, pal, -170, 170, 2); bevel(ctx, pal, 1.3);
  clipTo(ctx, W, () => lights.push(...greeble(ctx, pal, [-170, -100, 340, 190], {
    seed: 'carrier', panel: 13, rivets: 0.25, vents: 3, pipes: 1, hazards: 1, lights: 4, glow: 0.4,
  }).lights));
  // White leading-edge armour band.
  both((s) => {
    ctx.beginPath(); ctx.moveTo(s * 170, -36); ctx.lineTo(s * 124, -10); ctx.lineTo(s * 64, 24); ctx.lineTo(s * 34, 50);
    ctx.lineWidth = 4.2; ctx.strokeStyle = '#05070c'; ctx.stroke();
    ctx.lineWidth = 2.8; ctx.strokeStyle = '#c8d4e4'; ctx.stroke();
  });
  // Lift fans (the look layer spins a rotor over them).
  for (const s of [-1, 1]) {
    circ(ctx, s * 112, -18, 21); ctx.fillStyle = metal(ctx, pal, s * 112 - 21, s * 112 + 21); ctx.fill(); ctx.strokeStyle = '#020306'; ctx.lineWidth = 1; ctx.stroke();
    turbine(ctx, pal, s * 112, -18, 18, 12);
  }
  // Engine nozzles on the trailing edge.
  for (const s of [-1, 1]) for (const x of [44, 78]) {
    circ(ctx, s * x, -70 + (x - 44) * 0.18, 6.5); ctx.fillStyle = metal(ctx, pal, s * x - 7, s * x + 7); ctx.fill();
    ctx.strokeStyle = '#020306'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // Fuselage / flight deck.
  const D = () => mpoly(ctx, [0, -104, 14, -100, 22, -78, 27, -40, 28, 40, 20, 66, 0, 78]);
  D(); ctx.fillStyle = metal(ctx, { plate: ['#3a4250', '#a8b4c4', '#e4eaf2'] }, -28, 28); ctx.fill(); bevel(ctx, pal, 1);
  ctx.save(); D(); ctx.clip();
  ctx.fillStyle = 'rgba(20,28,40,0.55)'; ctx.fillRect(-16, -96, 32, 150);
  ctx.strokeStyle = 'rgba(240,248,255,0.85)'; ctx.lineWidth = 0.9; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, 50); ctx.stroke(); ctx.setLineDash([]);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 15, -94); ctx.lineTo(s * 15, 52); ctx.stroke(); }
  for (let y = 36; y < 54; y += 6) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(0, y + 4); ctx.lineTo(10, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(240,248,255,0.8)'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('07', 0, -60);
  ctx.restore();
  for (let y = -88; y <= 44; y += 12) for (const s of [-1, 1]) { lamp(ctx, s * 22, y, pal.light, 0.8); if ((y / 12) % 2 === 0) lights.push({ x: s * 22, y, c: pal.light, ph: ((y + 88) / 132) * 0.8 }); }
  // Segmented tail + twin fins.
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.rect(-10 + k * 1.5, -104 + k * 5, 20 - k * 3, 4);
    plateFill(ctx, pal, -10, 10); ctx.strokeStyle = '#020306'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  both((s) => { poly(ctx, [s * 12, -82, s * 26, -100, s * 30, -98, s * 20, -78]); plateFill(ctx, pal, s * 12, s * 30); bevel(ctx, pal, 0.6); });
  // Hangar bays with open doors.
  for (const s of [-1, 1]) {
    const x = s * 46;
    ctx.fillStyle = '#03050a'; ctx.fillRect(x - 13, -2, 26, 24);
    const g = ctx.createLinearGradient(0, -2, 0, 22); g.addColorStop(0, 'rgba(58,224,255,0.08)'); g.addColorStop(1, 'rgba(58,224,255,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x - 11, 0, 22, 20);
    ctx.strokeStyle = 'rgba(0,20,30,0.7)'; ctx.lineWidth = 0.5;
    for (let y = 3; y < 20; y += 3) { ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.stroke(); }
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.rect(x + d * 15 - 2, -3, 4, 26); plateFill(ctx, pal, x + d * 15 - 2, x + d * 15 + 2); bevel(ctx, pal, 0.5); }
    hazard(ctx, pal, x - 13, 22, 26, 3);
  }
  // Pod pylons.
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(s * 74 - 5, 18, 10, 14); plateFill(ctx, pal, s * 74 - 5, s * 74 + 5); bevel(ctx, pal, 0.5); }
  canopy(ctx, 0, 60, 7, 11, '#ffffff', '#7ae8ff', '#06203a');
  keyLight(ctx, -172, -106, 172, 106, 0.9);
  core(ctx, pal, 0, -30, 9, '#3ae0ff');
  for (const s of [-1, 1]) for (const x of [44, 78]) glowDot(ctx, s * x, -70 + (x - 44) * 0.18, 5, 'rgba(90,230,255,1)');
  lamp(ctx, -168, -42, '#ff3040', 1.6); lamp(ctx, 168, -42, '#40ff80', 1.6);
  lights.push({ x: -168, y: -42, c: '#ff3040', ph: 0 }, { x: 168, y: -42, c: '#40ff80', ph: 0 });
  return { lights, fans: [[-112, -18, 18], [112, -18, 18]], nozzles: [[-44, -70], [44, -70], [-78, -64], [78, -64]] };
}

// ============================================================== BLACK TIDE
// Leviathan-class Dreadnought: trimaran battleship. Main hull with deck guns
// and broadside ports, outrigger hulls on brass gantries, sonar dome at the
// bow. Anchors: guns (0,52) (0,-54) (±30,-6); ports x ±50, y -40..40.

function leviathanShape(ctx, pal, sub) {
  const lights = [];
  const OUT = (s) => poly(ctx, [s * 84, -72, s * 96, -88, s * 108, -76, s * 112, 70, s * 102, 94, s * 88, 76]);
  const MAIN = () => mpoly(ctx, [0, -138, 28, -132, 46, -112, 54, -72, 56, 62, 48, 100, 30, 124, 0, 140]);
  if (sub) {
    // Submerged silhouette under the surface + periscope wake.
    ctx.save(); ctx.globalAlpha = 0.6;
    for (const s of [-1, 1]) { OUT(s); ctx.fillStyle = '#04101c'; ctx.fill(); }
    MAIN(); ctx.fillStyle = '#04101c'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) { OUT(s); ctx.stroke(); }
    MAIN(); ctx.stroke();
    ctx.fillStyle = 'rgba(200,245,255,0.5)';
    for (let k = 0; k < 9; k++) { circ(ctx, (k % 2 ? 4 : -4), -6 + k * 9, 2.6 - k * 0.22); ctx.fill(); }
    glowDot(ctx, 0, -8, 4.5, 'rgba(255,220,120,0.9)');
    return { lights: [] };
  }
  // Outriggers with barnacle crust.
  for (const s of [-1, 1]) {
    OUT(s); plateFill(ctx, pal, s * 84, s * 112); bevel(ctx, pal, 1.1);
    clipTo(ctx, () => OUT(s), () => {
      greeble(ctx, pal, [s > 0 ? 84 : -112, -88, 28, 182], { seed: `levi-out${s}`, mirror: false, panel: 9, rivets: 0.5, vents: 2 });
      ctx.fillStyle = 'rgba(200,210,180,0.55)';
      for (let k = 0; k < 40; k++) { const y = -70 + ((k * 37) % 150), x = s * (s > 0 ? 109 - (k % 3) : 109 - (k % 3)); circ(ctx, x, y, 0.8 + (k % 3) * 0.4); ctx.fill(); }
      ctx.fillStyle = 'rgba(63,138,114,0.35)'; ctx.fillRect(s > 0 ? 104 : -112, -80, 8, 170);
    });
    lamp(ctx, s * 98, -78, pal.light, 1.3); lights.push({ x: s * 98, y: -78, c: pal.light, ph: s > 0 ? 0.25 : 0.75 });
  }
  // Brass gantries.
  for (const y of [-50, 6, 60]) for (const s of [-1, 1]) {
    pipe(ctx, pal, s * 54, y - 4, s * 86, y - 4, 1.5); pipe(ctx, pal, s * 54, y + 4, s * 86, y + 4, 1.5);
    for (let k = 0; k < 4; k++) pipe(ctx, pal, s * (56 + k * 8), y - 4, s * (60 + k * 8), y + 4, 0.7, false);
  }
  // Main hull + deck.
  MAIN(); plateFill(ctx, pal, -56, 56, 2); bevel(ctx, pal, 1.3);
  const DECK = () => mpoly(ctx, [0, -128, 22, -122, 40, -104, 46, -70, 46, 60, 40, 94, 24, 116, 0, 128]);
  DECK(); ctx.fillStyle = metal(ctx, { plate: ['#121a14', '#3a4a3a', '#6e8064'] }, -46, 46); ctx.fill(); ctx.strokeStyle = '#020403'; ctx.lineWidth = 0.8; ctx.stroke();
  clipTo(ctx, DECK, () => {
    ctx.strokeStyle = 'rgba(8,12,8,0.5)'; ctx.lineWidth = 0.5;
    for (let y = -126; y < 128; y += 4) { ctx.beginPath(); ctx.moveTo(-46, y); ctx.lineTo(46, y); ctx.stroke(); }
    // Verdigris stains.
    for (let k = 0; k < 26; k++) {
      const x = ((k * 53) % 84) - 42, y = ((k * 97) % 240) - 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, 'rgba(63,160,120,0.28)'); g.addColorStop(1, 'rgba(63,160,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
    }
    lights.push(...greeble(ctx, pal, [-46, -128, 92, 256], { seed: 'levi-deck', panel: 0, vents: 3, pipes: 3, cables: 2, lights: 3, hazards: 1, glow: 0.4 }).lights);
  });
  // Superstructure + bridge + funnels.
  const SUP = () => mpoly(ctx, [0, -32, 18, -28, 20, 20, 12, 28, 0, 30]);
  SUP(); plateFill(ctx, pal, -20, 20); bevel(ctx, pal, 1);
  clipTo(ctx, SUP, () => greeble(ctx, pal, [-20, -32, 40, 62], { seed: 'levi-sup', panel: 7, rivets: 0.7 }));
  for (const y of [-20, -6]) {
    ctx.beginPath(); ctx.ellipse(0, y, 9, 6, 0, 0, TAU); ctx.fillStyle = metal(ctx, pal, -9, 9); ctx.fill(); ctx.strokeStyle = '#d8a640'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, y, 6, 3.8, 0, 0, TAU); ctx.fillStyle = '#030303'; ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,215,110,0.95)';
  for (let x = -13; x <= 10; x += 5) ctx.fillRect(x, 16, 3, 2);
  // Mast + radar.
  pipe(ctx, pal, 0, 4, 0, -2, 1.2, false);
  // Gun rings (deck guns are breakable parts that sit on these).
  for (const [x, y] of [[0, 52], [0, -54], [-30, -6], [30, -6], [0, 80]]) mountRing(ctx, pal, x, y, 11);
  // Broadside ports (brass-rimmed).
  for (const s of [-1, 1]) for (let y = -40; y <= 40; y += 10) {
    const big = y % 20 === 0;
    circ(ctx, s * 51, y, big ? 3.4 : 2.2); ctx.fillStyle = '#020202'; ctx.fill();
    ctx.strokeStyle = '#d8a640'; ctx.lineWidth = 0.9; ctx.stroke();
  }
  // Anchors + chains at the bow.
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(s * 22 - 3, 108, 6, 6);
    ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 0.8; ctx.setLineDash([1.2, 0.8]);
    ctx.beginPath(); ctx.moveTo(s * 22, 108); ctx.lineTo(s * 8, 92); ctx.stroke(); ctx.setLineDash([]);
  }
  // Sonar dome.
  ctx.beginPath(); ctx.ellipse(0, 114, 11, 8, 0, 0, TAU);
  const sg = ctx.createRadialGradient(-3, 111, 1, 0, 114, 11); sg.addColorStop(0, '#d0fff4'); sg.addColorStop(0.5, '#1a8a78'); sg.addColorStop(1, '#03100e');
  ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = '#d8a640'; ctx.lineWidth = 1; ctx.stroke();
  keyLight(ctx, -118, -142, 118, 142, 1);
  for (const s of [-1, 1]) for (let y = -40; y <= 40; y += 20) glowDot(ctx, s * 51, y, 3, 'rgba(255,200,80,1)');
  core(ctx, pal, 0, 34, 7, '#3affd2');
  for (const y of [-20, -6]) glowDot(ctx, 0, y, 3, 'rgba(255,120,40,0.9)');
  return { lights, funnels: [[0, -20], [0, -6]] };
}
export const leviathan = (ctx) => leviathanShape(ctx, PAL.blacktide, false);
export const leviathanSub = (ctx) => leviathanShape(ctx, PAL.blacktide, true);

// ================================================================== HELIX
// Titan Enforcer, three forms: armoured with folded binders (a), binders
// open with energy wings (b), burning core with armour blown off (c).
// The mech body is the M4c layout scaled ×1.25 so the anchors still sit on
// it: shoulders (±37,-26), rifles (±46,40), wing feathers (±68,-20),
// laser blades (±50,90), chest core (0,-16).

const CERAMIC = { plate: ['#11141b', '#525a6a', '#949cab'] };

function titanBody(ctx, pal, form) {
  const hot = form === 2;
  const trim = hot ? 'rgba(255,90,40,0.95)' : '#ff2a9a';
  const S = 1.25;
  ctx.save(); ctx.scale(S, S);
  // Backpack thrusters.
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(s * 24 - 8, -76, 16, 26, 4); plateFill(ctx, pal, s * 24 - 8, s * 24 + 8); bevel(ctx, pal, 0.6);
    circ(ctx, s * 24, -73, 5); ctx.fillStyle = '#05060a'; ctx.fill();
  }
  // Legs with pistons and foot thrusters.
  for (const s of [-1, 1]) {
    mirrorPath(ctx, s * 18, [0, 13, 10, 17, 11, 53, 7, 61, 0, 63]);
    plateFill(ctx, CERAMIC, s * 18 - 11, s * 18 + 11); bevel(ctx, pal, 0.7);
    pipe(ctx, pal, s * 18 + s * 8, 20, s * 18 + s * 9, 48, 1.1);
    ctx.fillStyle = trim; ctx.fillRect(s * 18 - 6, 40, 12, 1.4);
  }
  // Arms, forearm cannons and blades.
  for (const s of [-1, 1]) {
    poly(ctx, [s * 40, -33, s * 56, -27, s * 54, 19, s * 42, 24, s * 35, -13]);
    plateFill(ctx, CERAMIC, s * 35, s * 56); bevel(ctx, pal, 0.8);
    pipe(ctx, pal, s * 44, -24, s * 46, 12, 1);
    ctx.beginPath(); ctx.rect(s * 47 - 3.5, 8, 7, 18); plateFill(ctx, pal, s * 47 - 3.5, s * 47 + 3.5); bevel(ctx, pal, 0.5);
    poly(ctx, [s * 46, 19, s * 50, 19, s * 53, 72, s * 47, 66]);
    ctx.fillStyle = hot ? 'rgba(255,130,90,0.95)' : 'rgba(210,235,255,0.95)'; ctx.fill();
    ctx.strokeStyle = hot ? '#ff3020' : '#3a9aff'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  // Torso over exposed waist machinery.
  ctx.fillStyle = '#0a0b10'; ctx.fillRect(-18, 8, 36, 14);
  cables(ctx, { cable: ['#0a0c12', '#ff2a9a'] }, -14, 10, 14, 18, 4, 2);
  const T = () => mpoly(ctx, [0, -45, 23, -43, 36, -33, 32, -5, 21, 13, 0, 18]);
  T(); plateFill(ctx, CERAMIC, -36, 36, 2); bevel(ctx, pal, 1);
  clipTo(ctx, T, () => greeble(ctx, { ...pal, plate: CERAMIC.plate }, [-36, -45, 72, 63], { seed: `titan${form}`, panel: 8, rivets: 0.2, vents: 2 }));
  // Abs plates.
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.rect(-9, 0 + k * 4.2, 18, 3.4); plateFill(ctx, pal, -9, 9); }
  // Pauldrons (shoulder cannons mount on top).
  for (const s of [-1, 1]) {
    poly(ctx, [s * 18, -48, s * 50, -46, s * 58, -28, s * 50, -16, s * 24, -20]);
    plateFill(ctx, CERAMIC, s * 18, s * 58); bevel(ctx, pal, 1);
    ctx.fillStyle = trim; ctx.fillRect(s * 38 - 9, -40, 18, 2.2);
    rivetRow(ctx, pal, s * 22, -45, s * 48, -43, 4);
  }
  // Corporate mark: hexagon with a double helix (original).
  ctx.save(); ctx.translate(0, 4);
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } ctx.closePath();
  ctx.strokeStyle = trim; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); for (let y = -3.5; y <= 3.5; y += 0.5) ctx.lineTo(Math.sin(y * 1.4) * 2.2, y); ctx.stroke();
  ctx.beginPath(); for (let y = -3.5; y <= 3.5; y += 0.5) ctx.lineTo(-Math.sin(y * 1.4) * 2.2, y); ctx.stroke();
  ctx.restore();
  // Chest core housing.
  circ(ctx, 0, -13, form >= 1 ? 11 : 9); ctx.fillStyle = '#07080c'; ctx.fill(); ctx.strokeStyle = '#020203'; ctx.lineWidth = 1; ctx.stroke();
  // Head + visor.
  mpoly(ctx, [0, -63, 8, -61, 10, -49, 6, -43, 0, -42]);
  plateFill(ctx, CERAMIC, -10, 10); bevel(ctx, pal, 0.7);
  ctx.save(); ctx.shadowColor = hot ? '#ff3020' : '#3a9aff'; ctx.shadowBlur = 6;
  ctx.fillStyle = hot ? '#ff4030' : '#7ac8ff'; ctx.fillRect(-7, -54, 14, 2.6); ctx.restore();
  ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 0.7;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 3, -61); ctx.lineTo(s * 12, -71); ctx.stroke(); }
  if (hot) {
    // Armour blown off: exposed machinery + glowing cracks.
    for (const [x, y, w, h] of [[-30, -36, 12, 14], [18, -10, 12, 12], [-26, -2, 10, 10]]) {
      ctx.fillStyle = '#0a0506'; ctx.fillRect(x, y, w, h);
      for (let k = 0; k < 3; k++) pipe(ctx, pal, x + 1, y + 2 + k * 4, x + w - 1, y + 2 + k * 4, 0.9, false);
      glowDot(ctx, x + w / 2, y + h / 2, 4, 'rgba(255,90,30,0.9)');
    }
    ctx.save(); ctx.shadowColor = '#ff2010'; ctx.shadowBlur = 6; ctx.strokeStyle = 'rgba(255,110,50,0.95)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-20, -38); ctx.lineTo(-10, -26); ctx.lineTo(-14, -10);
    ctx.moveTo(24, -32); ctx.lineTo(12, -22); ctx.lineTo(18, 4);
    ctx.moveTo(-6, 0); ctx.lineTo(4, 12); ctx.moveTo(40, -40); ctx.lineTo(48, -30);
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function titanWings(ctx, pal, form) {
  const hot = form === 2, lights = [];
  for (const s of [-1, 1]) {
    // Binder armour: folded against the back (a) or swung open (b, c).
    const B = form === 0
      ? () => poly(ctx, [s * 44, -54, s * 112, -96, s * 134, -78, s * 124, -28, s * 64, -16])
      : () => poly(ctx, [s * 46, -50, s * 136, -112, s * 150, -90, s * 132, -20, s * 62, -12]);
    if (form >= 1) {
      // Energy feathers fanned behind the binders.
      for (let k = 0; k < 5; k++) {
        poly(ctx, [s * 54, -26 + k * 6, s * (148 - k * 8), -70 + k * 20, s * (146 - k * 10), -54 + k * 20, s * 58, -18 + k * 6]);
        ctx.fillStyle = hot ? `rgba(255,${70 + k * 25},40,0.45)` : `rgba(${70 + k * 25},170,255,0.42)`;
        ctx.fill(); ctx.strokeStyle = hot ? 'rgba(255,80,40,0.9)' : 'rgba(120,200,255,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
    B(); plateFill(ctx, CERAMIC, s * 44, s * 150, 2); bevel(ctx, pal, 1.1);
    clipTo(ctx, B, () => lights.push(...greeble(ctx, { ...pal, plate: CERAMIC.plate }, [s > 0 ? 44 : -150, -112, 106, 100], {
      seed: `binder${s}${form}`, mirror: false, panel: 10, rivets: 0.3, vents: 2, hazards: 1, lights: 2, glow: 0.5,
    }).lights));
    ctx.save(); B(); ctx.clip();
    ctx.strokeStyle = hot ? 'rgba(255,90,40,0.9)' : '#ff2a9a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(s * 50, -30); ctx.lineTo(s * 150, form === 0 ? -76 : -94); ctx.stroke();
    ctx.restore();
    // Binder hinge piston.
    pipe(ctx, pal, s * 40, -40, s * 62, -30, 1.6);
  }
  return lights;
}

export const titan = (form) => (ctx) => {
  const pal = PAL.helix;
  const lights = titanWings(ctx, pal, form);
  titanBody(ctx, pal, form);
  keyLight(ctx, -152, -118, 152, 118, 0.9);
  const hot = form === 2;
  glowDot(ctx, 0, -16, form >= 1 ? 15 : 11, hot ? 'rgba(255,60,30,1)' : form === 1 ? 'rgba(58,154,255,1)' : 'rgba(255,42,154,1)');
  for (const s of [-1, 1]) {
    glowDot(ctx, s * 30, -91, 7, hot ? 'rgba(255,120,40,1)' : 'rgba(80,170,255,1)');
    glowDot(ctx, s * 22.5, 79, 6, hot ? 'rgba(255,120,40,1)' : 'rgba(80,170,255,1)');
  }
  return { lights, thrusters: [[-30, -91], [30, -91], [-22.5, 79], [22.5, 79]] };
};

// ============================================================= OUTER STAR
// Hive Sovereign: layered iridescent carapace fused with crystal, a crown of
// faceted spines, long tendril fins with crystal tips, and the eye-core
// weak point. Anchors: crystal nodes (±58,36) (0,-52); core (0,2).

function shard(ctx, x0, y0, x1, y1, w, light = '#ffd8f4', dark = '#5a1a9a') {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  const mx = x0 + (x1 - x0) * 0.25, my = y0 + (y1 - y0) * 0.25;
  poly(ctx, [x0, y0, mx + nx, my + ny, x1, y1]); ctx.fillStyle = light; ctx.fill();
  poly(ctx, [x0, y0, mx - nx, my - ny, x1, y1]); ctx.fillStyle = dark; ctx.fill();
  poly(ctx, [x0, y0, mx + nx, my + ny, x1, y1, mx - nx, my - ny]);
  ctx.strokeStyle = 'rgba(255,240,255,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
}

function tendrilFin(ctx, a, len, wid) {
  const cx = 0, cy = -6, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  ctx.beginPath();
  ctx.moveTo(cx + ca * 30 + nx * wid, cy + sa * 30 + ny * wid);
  ctx.quadraticCurveTo(cx + ca * len * 0.6 + nx * wid * 1.4 + 8, cy + sa * len * 0.6 + ny * wid * 1.2, cx + ca * len, cy + sa * len);
  ctx.quadraticCurveTo(cx + ca * len * 0.6 - nx * wid * 0.6, cy + sa * len * 0.6 - ny * wid * 0.6, cx + ca * 30 - nx * wid, cy + sa * 30 - ny * wid);
  const g = ctx.createLinearGradient(cx, cy, cx + ca * len, cy + sa * len);
  g.addColorStop(0, '#2a0c40'); g.addColorStop(0.7, '#14061e'); g.addColorStop(1, '#0a0410');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(90,255,176,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
  // Segment ridges.
  ctx.strokeStyle = 'rgba(200,150,255,0.25)';
  for (let k = 0.3; k < 0.95; k += 0.11) {
    const px = cx + ca * len * k, py = cy + sa * len * k, ww = wid * (1.1 - k);
    ctx.beginPath(); ctx.moveTo(px + nx * ww, py + ny * ww); ctx.lineTo(px - nx * ww, py - ny * ww); ctx.stroke();
  }
  shard(ctx, cx + ca * (len - 4), cy + sa * (len - 4), cx + ca * (len + 14), cy + sa * (len + 14), 3.2);
}

export function hive(ctx) {
  const lights = [];
  const cy = -6;
  // Floating geometric rings (static base; the look layer adds a rotating one).
  ctx.strokeStyle = 'rgba(200,150,255,0.35)'; ctx.lineWidth = 0.9;
  for (const r of [-0.35, 0.35]) { ctx.beginPath(); ctx.ellipse(0, cy, 132, 38, r, 0, TAU); ctx.stroke(); }
  // Tendril fins.
  for (const [k, len, wid] of [[0.32, 138, 9], [0.78, 142, 10], [1.25, 130, 9], [1.72, 112, 8]]) {
    tendrilFin(ctx, Math.PI / 2 + k, len, wid); tendrilFin(ctx, Math.PI / 2 - k, len, wid);
  }
  // Crown of crystal spines.
  for (let i = -4; i <= 4; i++) {
    const a = -Math.PI / 2 + i * 0.26, L = 96 + (Math.abs(i) % 2 ? -18 : 18) - Math.abs(i) * 4;
    shard(ctx, Math.cos(a) * 46, cy + Math.sin(a) * 40, Math.cos(a) * L, cy + Math.sin(a) * L, 6 - Math.abs(i) * 0.4);
  }
  // Crystal growth clusters fused into the shell.
  for (const [x, y, a0] of [[80, 18, 0.2], [-80, 18, Math.PI - 0.2], [64, -46, -0.6], [-64, -46, Math.PI + 0.6]]) {
    for (let k = -1; k <= 1; k++) {
      const a = a0 + k * 0.42, L = 16 + (k === 0 ? 10 : 2);
      shard(ctx, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 4);
    }
  }
  // Carapace: three iridescent layers with radial plate seams.
  for (const [rx, ry, d] of [[86, 72, 0], [64, 54, 1], [42, 36, 2]]) {
    ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
    const g = ctx.createRadialGradient(-rx * 0.35, cy - ry * 0.4, 4, 0, cy, rx);
    g.addColorStop(0, d === 2 ? '#9a74b8' : '#7a54a0'); g.addColorStop(0.5, '#30144a'); g.addColorStop(1, '#0e0418');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#05010a'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,255,0.25)'; ctx.lineWidth = 0.6;
    const n = 10 - d * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + d * 0.3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * 0.7, cy + Math.sin(a) * ry * 0.7); ctx.lineTo(Math.cos(a) * rx * 0.98, cy + Math.sin(a) * ry * 0.98); ctx.stroke();
    }
  }
  // Iridescent sheen.
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, 86, 72, 0, 0, TAU); ctx.clip();
  const sh = ctx.createLinearGradient(-86, cy - 72, 86, cy + 72);
  sh.addColorStop(0, 'rgba(90,255,176,0.16)'); sh.addColorStop(0.5, 'rgba(255,122,216,0.05)'); sh.addColorStop(1, 'rgba(90,120,255,0.14)');
  ctx.fillStyle = sh; ctx.fillRect(-86, cy - 72, 172, 144);
  ctx.restore();
  // Bioluminescent spots (blink at runtime).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2, x = Math.cos(a) * 74, y = cy + Math.sin(a) * 62;
    lamp(ctx, x, y, '#5affb0', 1.6); lights.push({ x, y, c: '#5affb0', ph: i / 8 });
  }
  keyLight(ctx, -150, -136, 150, 136, 0.8);
  // Eye-core.
  ctx.beginPath(); ctx.ellipse(0, 2, 20, 15, 0, 0, TAU); ctx.fillStyle = '#041004'; ctx.fill();
  ctx.strokeStyle = '#020802'; ctx.lineWidth = 1.2; ctx.stroke();
  glowDot(ctx, 0, 2, 19, 'rgba(120,255,110,1)');
  ctx.fillStyle = '#020a02'; ctx.beginPath(); ctx.ellipse(0, 2, 2.8, 11, 0, 0, TAU); ctx.fill();
  return { lights };
}

/** Pulsing vein network for the Hive (drawn additive by the look layer). */
export function hiveVeins(ctx) {
  ctx.lineCap = 'round';
  const cy = -6;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.1;
    let x = Math.cos(a) * 22, y = cy + Math.sin(a) * 18;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 1; k <= 5; k++) {
      const r = 22 + k * 13, wob = Math.sin(i * 3.1 + k * 1.7) * 0.2;
      x = Math.cos(a + wob) * r; y = cy + Math.sin(a + wob) * r * 0.84;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(120,255,180,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
}

// ================================================================ DROWNED
// Maw of the Deep Below: a fleshy maw ringed by coral-crusted cathedral
// stonework, long suckered tentacles, bone ribs, eye sockets for the eye
// weak points (±70,-38) (0,-62) (±92,14), and the crimson gullet core.

function stoneArch(ctx, a, r0, r1) {
  ctx.save();
  ctx.rotate(a);
  // Broken arch segment: two pillars and a lintel, crusted with coral.
  const g = ctx.createLinearGradient(r0, -14, r1, 14);
  g.addColorStop(0, '#d8d0bc'); g.addColorStop(0.5, '#8a8272'); g.addColorStop(1, '#2a2620');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.rect(r0, -15, r1 - r0, 7); ctx.rect(r0, 8, r1 - r0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r1, -15); ctx.quadraticCurveTo(r1 + 14, 0, r1, 15); ctx.lineTo(r1 - 5, 15); ctx.quadraticCurveTo(r1 + 6, 0, r1 - 5, -15); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#06060a'; ctx.lineWidth = 0.9;
  ctx.strokeRect(r0, -15, r1 - r0, 7); ctx.strokeRect(r0, 8, r1 - r0, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5;
  for (let x = r0 + 6; x < r1; x += 6) { ctx.beginPath(); ctx.moveTo(x, -15); ctx.lineTo(x, -8); ctx.moveTo(x + 3, 8); ctx.lineTo(x + 3, 15); ctx.stroke(); }
  // Coral crust.
  for (let k = 0; k < 9; k++) {
    const x = r0 + ((k * 13) % (r1 - r0)), y = (k % 2 ? -1 : 1) * (6 + (k % 3) * 4);
    ctx.fillStyle = k % 3 === 0 ? 'rgba(192,20,42,0.75)' : 'rgba(90,168,136,0.8)';
    circ(ctx, x, y, 1.6 + (k % 3) * 0.8); ctx.fill();
  }
  ctx.restore();
}

function tentacle(ctx, a, r0, len, wid, curl) {
  ctx.save(); ctx.rotate(a);
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, x = r0 + len * t, y = Math.sin(t * Math.PI * 1.2) * curl * t;
    pts.push([x, y, wid * (1 - t * 0.9)]);
  }
  ctx.beginPath();
  pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w) : ctx.moveTo(x, y - w)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2]);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -wid, 0, wid);
  g.addColorStop(0, '#3a1a34'); g.addColorStop(0.5, '#1a0a1a'); g.addColorStop(1, '#06030a');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(160,70,150,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.fillStyle = 'rgba(232,224,204,0.75)';
  for (let k = 1; k < 11; k++) { const [x, y, w] = pts[k]; circ(ctx, x, y + w * 0.45, Math.max(0.5, w * 0.28)); ctx.fill(); }
  ctx.restore();
}

export const maw = (open) => (ctx) => {
  const lights = [];
  const R = 88;
  // Long tentacles behind everything.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    tentacle(ctx, a, R * 0.8, 70 + (i % 3) * 14, 9, (i % 2 ? 1 : -1) * 14);
  }
  // Drowned cathedral stonework fused into the rim.
  for (const a of [-2.35, -0.8, 0.2, 2.94, 1.35, -1.57]) stoneArch(ctx, a, R * 0.86, R * 1.42);
  // Flesh ring.
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.82, 0, 0, TAU);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R);
  g.addColorStop(0, '#4a1830'); g.addColorStop(0.6, '#2c0c20'); g.addColorStop(1, '#0a0208');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#020004'; ctx.lineWidth = 1.6; ctx.stroke();
  // Wrinkles + crimson veins.
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * TAU;
    ctx.strokeStyle = k % 3 ? 'rgba(120,40,90,0.45)' : 'rgba(192,20,42,0.5)'; ctx.lineWidth = k % 3 ? 0.6 : 0.9;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.5);
    ctx.quadraticCurveTo(Math.cos(a + 0.08) * R * 0.8, Math.sin(a + 0.08) * R * 0.66, Math.cos(a + 0.03) * R * 0.95, Math.sin(a + 0.03) * R * 0.78); ctx.stroke();
  }
  // Bone ribs.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + 0.15;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.78, R * 0.64, 0, a, a + 0.32);
    ctx.strokeStyle = '#06030a'; ctx.lineWidth = 4.6; ctx.stroke();
    ctx.strokeStyle = '#d8cfba'; ctx.lineWidth = 3; ctx.stroke();
  }
  // Eye sockets (eye parts sit in these).
  for (const [x, y] of [[-70, -38], [70, -38], [0, -62], [-92, 14], [92, 14]]) {
    ctx.beginPath(); ctx.ellipse(x, y, 19, 14, 0, 0, TAU); ctx.fillStyle = '#3a1428'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, 16, 11, 0, 0, TAU); ctx.fillStyle = '#050002'; ctx.fill();
  }
  // Gullet + teeth rings.
  const gr = R * (open ? 0.56 : 0.42);
  ctx.beginPath(); ctx.ellipse(0, 0, gr, gr * 0.82, 0, 0, TAU);
  const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
  gg.addColorStop(0, open ? '#ff6a30' : '#600010'); gg.addColorStop(0.45, open ? '#a00818' : '#200008'); gg.addColorStop(1, '#050002');
  ctx.fillStyle = gg; ctx.fill();
  for (const [rr, n, len] of [[gr * 1.02, 22, gr * 0.32], [gr * 0.7, 14, gr * 0.22]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rr < gr ? 0.15 : 0);
      const bx = Math.cos(a) * rr, by = Math.sin(a) * rr * 0.82;
      const tx = Math.cos(a) * (rr - len), ty = Math.sin(a) * (rr - len) * 0.82;
      const px = -Math.sin(a) * 3.4, py = Math.cos(a) * 3.4 * 0.82;
      poly(ctx, [bx + px, by + py, tx, ty, bx - px, by - py]);
      const tg = ctx.createLinearGradient(bx, by, tx, ty); tg.addColorStop(0, '#9a8e76'); tg.addColorStop(1, '#f4ecdc');
      ctx.fillStyle = tg; ctx.fill(); ctx.strokeStyle = 'rgba(30,14,14,0.85)'; ctx.lineWidth = 0.4; ctx.stroke();
    }
  }
  // Sea-green bioluminescent spots.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.4, x = Math.cos(a) * R * 0.9, y = Math.sin(a) * R * 0.74;
    lamp(ctx, x, y, '#7affc0', 1.4); lights.push({ x, y, c: '#7affc0', ph: (i * 0.37) % 1 });
  }
  keyLight(ctx, -172, -150, 172, 150, 0.8);
  if (open) glowDot(ctx, 0, 0, gr * 0.5, 'rgba(255,40,40,1)');
  return { lights };
};

/** Swaying tentacle overlay for the Maw (faces +x, base at the left edge). */
export function tentacleSprite(ctx, w, h) {
  ctx.save(); ctx.translate(0, h / 2);
  tentacle(ctx, 0, 0, w - 4, h / 2 - 1, 0);
  ctx.restore();
}

// ============================================================ DAMAGE DECALS
// Overlays for the §4.4 damage states, drawn by the look layer at fixed
// sites on the hull. Mechanical bosses dent and expose machinery; organic
// ones split open. Neutral colours where the runtime tints them.

export function decalDent(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(10,8,6,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.26, h * 0.2, 0.4, 0, TAU);
  ctx.strokeStyle = 'rgba(255,240,220,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.2, cy + Math.sin(a) * h * 0.16);
    ctx.lineTo(cx + Math.cos(a + 0.2) * w * 0.38, cy + Math.sin(a + 0.2) * h * 0.34); ctx.stroke();
  }
}

export function decalMachinery(ctx, w, h) {
  const cx = w / 2, cy = h / 2, pal = PAL.ironclad;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = (0.36 + (i % 2) * 0.1) * w; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); }
  ctx.closePath(); ctx.fillStyle = '#060404'; ctx.fill();
  ctx.clip();
  for (let k = 0; k < 4; k++) pipe(ctx, { ...pal, pipe: ['#0c0c0e', '#4a4a50', '#a0a0a8'] }, 0, cy - 9 + k * 6, w, cy - 7 + k * 6, 1.3, false);
  glowDot(ctx, cx - 3, cy + 2, w * 0.18, 'rgba(255,120,40,1)');
  ctx.restore();
  ctx.strokeStyle = 'rgba(200,190,180,0.6)'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) { const a = (i / 9) * TAU, r = (0.36 + (i % 2) * 0.1) * w; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); }
  ctx.stroke();
}

export function decalWound(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.42, cy); ctx.quadraticCurveTo(cx, cy - h * 0.34, cx + w * 0.42, cy); ctx.quadraticCurveTo(cx, cy + h * 0.34, cx - w * 0.42, cy);
  ctx.fillStyle = '#050003'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1; ctx.stroke();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.36);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.3, h * 0.12, 0, 0, TAU); ctx.fill();
}

export function decalCrack(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    let x = cx, y = cy, a = (i / 5) * TAU + 0.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { a += (k % 2 ? 0.5 : -0.4); x += Math.cos(a) * w * 0.12; y += Math.sin(a) * h * 0.12; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

/** Lift-fan rotor for the carrier (spun by the look layer). */
export function fanRotor(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 1;
  ctx.fillStyle = 'rgba(160,190,220,0.85)';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - 0.12) * r, cy + Math.sin(a - 0.12) * r);
    ctx.lineTo(cx + Math.cos(a + 0.2) * r, cy + Math.sin(a + 0.2) * r);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = r * 0.6;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, TAU); ctx.stroke();
}

/** Thin ring with alien glyph marks (rotating halo around the Hive). */
export function glyphRing(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, TAU); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, x = cx + Math.cos(a) * (r - 2), y = cy + Math.sin(a) * (r - 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath();
    if (i % 3 === 0) { ctx.moveTo(-2, -1.5); ctx.lineTo(2, 0); ctx.lineTo(-2, 1.5); }
    else if (i % 3 === 1) { ctx.arc(0, 0, 1.4, 0, TAU); }
    else { ctx.moveTo(0, -2); ctx.lineTo(0, 2); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); }
    ctx.stroke(); ctx.restore();
  }
}
