import { mirrorPath, glowDot, canopy } from '../../fx/art.js';
import { greeble, keyLight, bevel, plateFill, metal, rivetRow, hazard, vent, pipe, turbine, core, lamp } from '../../fx/greeble.js';
import { hull } from '../hulls.js';

// Art kit for the roster expansion (24 new bosses). Same conventions as the
// M4d hulls: Canvas2D in world units, centre-relative, facing DOWN (+y toward
// the player), lit from the top left, detailed with the greeble generator.
// Realistic finishes: weathered paint, camouflage, bare steel and restrained
// emissives — not neon.
//
// Every drawer returns or pushes into `meta` (idle lights, treads, stacks,
// fans, nozzles, thrusters, funnels) for the runtime look layer.

const TAU = Math.PI * 2;

/** Greeble palettes: plate [dark, mid, light], seam, hi, rivet, hazard, pipe, cable, light, core, vent. */
export const PALS = {
  arctic: { plate: ['#3a4048', '#b9c2cc', '#eef3f8'], seam: 'rgba(20,26,34,0.75)', hi: 'rgba(255,255,255,0.45)', rivet: '#8a96a4', hazard: ['#2a3a52', '#d8e2ec'], pipe: ['#20262e', '#7a8696', '#cfd8e2'], cable: ['#1a1e24', '#5aa8e0'], light: '#9fdcff', core: '#5ac8ff', vent: '#7ad0ff' },
  desert: { plate: ['#3a2a18', '#a9845a', '#e2c79a'], seam: 'rgba(40,24,10,0.8)', hi: 'rgba(255,240,210,0.4)', rivet: '#7a5a38', hazard: ['#2a1a0a', '#d8a64a'], pipe: ['#2a1c10', '#7a5c3c', '#d2b088'], cable: ['#1c1208', '#c08a3a'], light: '#ffc870', core: '#ff9a3a', vent: '#ff8a3a' },
  urban: { plate: ['#1c1a1c', '#5a4448', '#9a8084'], seam: 'rgba(10,6,8,0.85)', hi: 'rgba(255,220,220,0.3)', rivet: '#7a6064', hazard: ['#c02828', '#1a1214'], pipe: ['#141012', '#5a4a4e', '#a89094'], cable: ['#120c0e', '#e04040'], light: '#ff6a5a', core: '#ff3a3a', vent: '#ff5a3a' },
  mining: { plate: ['#2a2218', '#7a6448', '#c2a274'], seam: 'rgba(20,14,8,0.85)', hi: 'rgba(255,230,190,0.35)', rivet: '#9a7a52', hazard: ['#ffb81a', '#1a1208'], pipe: ['#1a140c', '#6a5038', '#c09868'], cable: ['#140e08', '#ffa020'], light: '#ffc050', core: '#ff8a1a', vent: '#ff6a10' },
  navy: { plate: ['#20262c', '#6c7680', '#b4bec8'], seam: 'rgba(10,14,18,0.8)', hi: 'rgba(230,240,255,0.35)', rivet: '#8a949e', hazard: ['#ffcc1a', '#141a20'], pipe: ['#141a20', '#5a6670', '#aab6c2'], cable: ['#101418', '#ffb020'], light: '#ffe090', core: '#ff7a3a', vent: '#ff8a3a' },
  coastal: { plate: ['#1e2a2a', '#5e7a72', '#a8c2b6'], seam: 'rgba(10,18,16,0.8)', hi: 'rgba(230,255,245,0.35)', rivet: '#7a948a', hazard: ['#ff7a2a', '#142020'], pipe: ['#121a1a', '#4e6660', '#9ab4aa'], cable: ['#0e1414', '#ff8a3a'], light: '#ffd080', core: '#ff5a3a', vent: '#ff6a3a' },
  oil: { plate: ['#121212', '#3e3c3a', '#7e7a74'], seam: 'rgba(4,4,4,0.85)', hi: 'rgba(255,220,180,0.25)', rivet: '#6a6660', hazard: ['#ffc21a', '#121212'], pipe: ['#0e0e0e', '#4a4844', '#8a8680'], cable: ['#0a0a0a', '#ff9a20'], light: '#ffb040', core: '#ff7a10', vent: '#ff6a10' },
  sub: { plate: ['#0c1012', '#2a3238', '#5a666e'], seam: 'rgba(0,4,6,0.85)', hi: 'rgba(180,220,255,0.25)', rivet: '#3a4650', hazard: ['#2ac8a0', '#0a1012'], pipe: ['#0a0e10', '#2a363e', '#5a6a74'], cable: ['#080c0e', '#2ac8a0'], light: '#7affd8', core: '#2affc0', vent: '#2ad8b0' },
  steel: { plate: ['#1a1e24', '#5a6470', '#a4b0bc'], seam: 'rgba(8,10,14,0.85)', hi: 'rgba(220,235,255,0.35)', rivet: '#7a8694', hazard: ['#ffc21a', '#14181e'], pipe: ['#12161a', '#4a5460', '#9aa6b2'], cable: ['#0e1216', '#5ab0ff'], light: '#a8d8ff', core: '#4ab8ff', vent: '#6ac0ff' },
  bomber: { plate: ['#2a2420', '#6e6458', '#a89c8a'], seam: 'rgba(16,12,8,0.8)', hi: 'rgba(255,240,220,0.3)', rivet: '#8a7e6e', hazard: ['#ffb01a', '#1c1610'], pipe: ['#16120e', '#5a5046', '#a69886'], cable: ['#120e0a', '#ff9a20'], light: '#ffcc80', core: '#ff8a2a', vent: '#ff7a1a' },
  storm: { plate: ['#14181e', '#3c4654', '#7e8c9e'], seam: 'rgba(4,6,10,0.85)', hi: 'rgba(200,220,255,0.3)', rivet: '#5a6878', hazard: ['#9ab8ff', '#10141a'], pipe: ['#0e1216', '#3a4452', '#7c8a9c'], cable: ['#0a0e12', '#9ab8ff'], light: '#c8d8ff', core: '#9ab8ff', vent: '#aac4ff' },
  frost: { plate: ['#2a323c', '#8c98a8', '#dfe6ee'], seam: 'rgba(14,20,28,0.8)', hi: 'rgba(255,255,255,0.4)', rivet: '#7a8898', hazard: ['#3a8adf', '#e8eef4'], pipe: ['#1a2028', '#6a7686', '#c4ceda'], cable: ['#141a20', '#5ab8ff'], light: '#a8e0ff', core: '#5ad0ff', vent: '#7ad8ff' },
  sand: { plate: ['#3a2c1a', '#9a7c52', '#d8bc8a'], seam: 'rgba(36,22,8,0.8)', hi: 'rgba(255,240,200,0.35)', rivet: '#7a6040', hazard: ['#d84a1a', '#2a1c0c'], pipe: ['#241a0e', '#6e5636', '#c4a272'], cable: ['#1a120a', '#ff8a2a'], light: '#ffc060', core: '#ff7a2a', vent: '#ff8a3a' },
  helios: { plate: ['#2a2418', '#a89060', '#f0e2b4'], seam: 'rgba(30,22,8,0.8)', hi: 'rgba(255,250,220,0.45)', rivet: '#b89a5a', hazard: ['#f0f0e8', '#3a2e18'], pipe: ['#201a10', '#8a7448', '#e2cc94'], cable: ['#18120a', '#ffd060'], light: '#fff0b0', core: '#ffd050', vent: '#ffc040' },
  foundry: { plate: ['#141414', '#4c4440', '#8e847a'], seam: 'rgba(6,4,4,0.85)', hi: 'rgba(255,220,180,0.3)', rivet: '#7a6a5e', hazard: ['#ff8a1a', '#141210'], pipe: ['#100e0c', '#4a403a', '#8a7c70'], cable: ['#0c0a08', '#ff6a1a'], light: '#ffa040', core: '#ff6a10', vent: '#ff5a10' },
  rock: { plate: ['#1a1614', '#4a403a', '#867a70'], seam: 'rgba(8,6,4,0.85)', hi: 'rgba(240,220,200,0.25)', rivet: '#5a4e46', hazard: ['#8a6a4a', '#1a1614'], pipe: ['#14100e', '#3e3430', '#7a6e64'], cable: ['#100c0a', '#c8a070'], light: '#e8c8a0', core: '#c86a3a', vent: '#d87a4a' },
  void: { plate: ['#0c0a10', '#3a3448', '#7a7090'], seam: 'rgba(4,2,8,0.85)', hi: 'rgba(220,210,255,0.3)', rivet: '#4a425a', hazard: ['#8a7ab0', '#0c0a10'], pipe: ['#0a080e', '#342e42', '#6e6684'], cable: ['#08060c', '#b0a0ff'], light: '#c8b8ff', core: '#a090ff', vent: '#b0a0ff' },
  crimson: { plate: ['#1a0a0c', '#5a2228', '#a85a60'], seam: 'rgba(10,2,4,0.85)', hi: 'rgba(255,200,200,0.3)', rivet: '#7a3a40', hazard: ['#ff4a4a', '#1a0a0c'], pipe: ['#14080a', '#4a1e22', '#94545a'], cable: ['#100608', '#ff5a5a'], light: '#ff9a8a', core: '#ff3a3a', vent: '#ff4a4a' },
  regent: { plate: ['#0a0a12', '#2e2a40', '#6e6890'], seam: 'rgba(2,2,6,0.85)', hi: 'rgba(230,220,255,0.35)', rivet: '#4a4664', hazard: ['#e0c8ff', '#0a0a12'], pipe: ['#08080e', '#2a2638', '#625c80'], cable: ['#06060a', '#d0b0ff'], light: '#e8d8ff', core: '#c8a8ff', vent: '#d0b8ff' },
  hadal: { plate: ['#06100e', '#1e3a36', '#4a7a70'], seam: 'rgba(0,6,4,0.85)', hi: 'rgba(160,255,230,0.25)', rivet: '#2a4a44', hazard: ['#3affd0', '#06100e'], pipe: ['#040c0a', '#1a3430', '#44706a'], cable: ['#030806', '#3affd0'], light: '#7affe0', core: '#3affd0', vent: '#3affc0' },
  monarch: { plate: ['#0c1416', '#2c4a4a', '#6a9a8e'], seam: 'rgba(2,8,8,0.85)', hi: 'rgba(220,255,240,0.3)', rivet: '#c8a858', hazard: ['#d8b858', '#0c1416'], pipe: ['#081012', '#284040', '#5e8a80'], cable: ['#060c0e', '#e8c868'], light: '#ffe8a0', core: '#7affd0', vent: '#5affc0' },
  furnace: { plate: ['#0a0808', '#2e2622', '#5e524a'], seam: 'rgba(4,2,2,0.85)', hi: 'rgba(255,200,160,0.25)', rivet: '#4a3e36', hazard: ['#ff6a1a', '#0a0808'], pipe: ['#080606', '#2a221e', '#5a4c44'], cable: ['#060404', '#ff5a10'], light: '#ff9a50', core: '#ff5a10', vent: '#ff4a10' },
  abyss: { plate: ['#08060a', '#241c2a', '#52445c'], seam: 'rgba(2,0,4,0.85)', hi: 'rgba(220,180,255,0.25)', rivet: '#3a2e44', hazard: ['#a04aff', '#08060a'], pipe: ['#060408', '#201826', '#4a3c54'], cable: ['#040306', '#c06aff'], light: '#d0a0ff', core: '#ff3a6a', vent: '#c04aff' },
};

export const mpoly = (ctx, pts) => mirrorPath(ctx, 0, pts);
export function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
export const circ = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
export function clipTo(ctx, path, fn) { ctx.save(); path(); ctx.clip(); const r = fn(); ctx.restore(); return r; }
export const both = (fn) => { fn(1); fn(-1); };

/** Fill the current path as an armour plate (metal gradient + bevel). */
export function armour(ctx, pal, x0, x1, b = 1) { plateFill(ctx, pal, x0, x1, b); bevel(ctx, pal, 1); }

/** Greeble-detailed mirrored body. pts: right-half outline (mirrorPath). */
export function body(ctx, pal, pts, rect, seed, opt = {}) {
  const path = () => mpoly(ctx, pts);
  path(); armour(ctx, pal, rect[0], rect[0] + rect[2], 2);
  const g = clipTo(ctx, path, () => greeble(ctx, pal, rect, { seed, panel: 11, rivets: 0.5, vents: 3, pipes: 2, cables: 1, hazards: 1, lights: 3, glow: 0.35, ...opt }));
  return g.lights;
}

/** Camouflage / weathering blotches over a path (realistic paint schemes). */
export function camo(ctx, path, cols, seed = 1, n = 26, size = 18) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.save(); path(); ctx.clip();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    const x = (rnd() - 0.5) * 340, y = (rnd() - 0.5) * 300, r = size * (0.6 + rnd());
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; const rr = r * (0.6 + rnd() * 0.6); ctx.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Grime / soot streaks running back from the front (weathering). */
export function weather(ctx, path, k = 0.35) {
  ctx.save(); path(); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const x = ((i * 37) % 300) - 150, y = ((i * 53) % 260) - 130, l = 10 + ((i * 17) % 30);
    ctx.fillStyle = `rgba(10,8,6,${k * (0.3 + ((i * 7) % 10) / 20)})`;
    ctx.fillRect(x, y, 1.6, l);
  }
  ctx.restore();
}

/** A track unit (exposed strip recorded for the tread animation). */
export function track(ctx, pal, meta, x0, x1, y0, y1) {
  ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 6);
  ctx.fillStyle = '#0b0a09'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#020101'; ctx.stroke();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(110,100,90,0.5)';
  ctx.beginPath(); for (let y = y0 + 4; y < y1 - 3; y += 5) { ctx.moveTo(x0 + 2, y); ctx.lineTo(x1 - 2, y); } ctx.stroke();
  const mx = (x0 + x1) / 2;
  for (const y of [y0 + 8, y1 - 8]) { circ(ctx, mx, y, Math.min(7, (x1 - x0) * 0.35)); ctx.fillStyle = metal(ctx, pal, mx - 8, mx + 8); ctx.fill(); }
  meta.treads.push({ x0: x0 + 1.5, x1: x1 - 1.5, y0: y0 + 15, y1: y1 - 15 });
}

/** Turret with barrels pointing down (+y). */
export function turret(ctx, pal, x, y, r, barrels = 1, len = 30, bw = 3) {
  for (let k = 0; k < barrels; k++) {
    const bx = x + (k - (barrels - 1) / 2) * bw * 2.2;
    ctx.beginPath(); ctx.rect(bx - bw / 2, y, bw, len); plateFill(ctx, pal, bx - bw / 2, bx + bw / 2); bevel(ctx, pal, 0.5);
    ctx.fillStyle = '#050403'; ctx.fillRect(bx - bw * 0.3, y + len - 2, bw * 0.6, 2);
  }
  circ(ctx, x, y, r); armour(ctx, pal, x - r, x + r);
  circ(ctx, x, y, r * 0.62); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();
  rivetRow(ctx, pal, x - r * 0.6, y - r * 0.5, x + r * 0.6, y - r * 0.5, 3);
  circ(ctx, x - r * 0.35, y - r * 0.3, r * 0.22); ctx.fillStyle = metal(ctx, pal, x - r, x); ctx.fill();
}

/** Mining drill cone pointing down, with spiral flutes. */
export function drill(ctx, pal, x, y, r, len) {
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.lineTo(x, y + len); ctx.closePath();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, '#2a2a2c'); g.addColorStop(0.35, '#b8b8bc'); g.addColorStop(0.5, '#f0f0f2'); g.addColorStop(0.7, '#8a8a90'); g.addColorStop(1, '#1e1e20');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#08080a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.lineTo(x, y + len); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(20,20,22,0.8)'; ctx.lineWidth = 2.2;
  for (let k = -6; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x - r, y + k * len / 8); ctx.lineTo(x + r, y + k * len / 8 + len / 5); ctx.stroke(); }
  ctx.restore();
}

/** Swept wing (right half mirrored): root/tip chords, sweep, with control surfaces. */
export function wing(ctx, pal, pts, seed, opt = {}) {
  const path = () => mpoly(ctx, pts);
  path(); armour(ctx, pal, -200, 200, 2);
  return clipTo(ctx, path, () => greeble(ctx, pal, [-200, -140, 400, 280], { seed, panel: 15, rivets: 0.2, vents: 1, pipes: 0, cables: 0, hazards: 0, lights: 2, glow: 0.2, ...opt })).lights;
}

/** Jet nozzles along the rear (−y), recorded for the afterburner animation. */
export function nozzles(ctx, pal, meta, list, r = 6) {
  for (const [x, y] of list) {
    circ(ctx, x, y, r); ctx.fillStyle = metal(ctx, pal, x - r, x + r); ctx.fill(); ctx.strokeStyle = '#020304'; ctx.lineWidth = 0.8; ctx.stroke();
    circ(ctx, x, y, r * 0.6); ctx.fillStyle = '#0a0a0c'; ctx.fill();
    (meta.nozzles = meta.nozzles || []).push([x, y + 10]);
  }
}

/** Mech limb segment (rounded armour). */
export function limb(ctx, pal, x0, y0, x1, y1, w) {
  const a = Math.atan2(y1 - y0, x1 - x0), l = Math.hypot(x1 - x0, y1 - y0);
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(a);
  ctx.beginPath(); ctx.roundRect(0, -w / 2, l, w, w * 0.4); armour(ctx, pal, 0, l);
  ctx.restore();
}

/** Ship deck outline (bow down) with deck plating, returns the outline path fn. */
export function shipHull(ctx, pal, l, b, seed) {
  const hl = l / 2, hb = b / 2;
  const pts = [0, hl, hb * 0.55, hl - l * 0.1, hb * 0.95, hl - l * 0.26, hb, hl - l * 0.4, hb, -hl + l * 0.1, hb * 0.82, -hl, 0, -hl];
  const path = () => mpoly(ctx, pts);
  path(); armour(ctx, pal, -hb, hb, 2);
  const g = clipTo(ctx, path, () => greeble(ctx, pal, [-hb, -hl, b, l], { seed, panel: 13, rivets: 0.4, vents: 2, pipes: 2, cables: 1, hazards: 1, lights: 3, glow: 0.3 }));
  return { path, lights: g.lights };
}

/** Organic chitin / carapace plate with sheen (alien, abyssal). */
export function chitin(ctx, x, y, rx, ry, rot, cols) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 1, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, cols[2]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, cols[0]);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.ellipse(-rx * 0.1, -ry * 0.12, rx * 0.7, ry * 0.65, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
}

/** Tapering tentacle drawn as a stroked curve with suckers. */
export function tentacle(ctx, pts, w0, w1, col, sucker = 'rgba(230,200,190,0.5)') {
  for (let i = 0; i < pts.length - 1; i++) {
    const t = i / (pts.length - 1), w = w0 + (w1 - w0) * t;
    ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
    if (i % 2 === 0) { circ(ctx, pts[i][0] + w * 0.2, pts[i][1], w * 0.18); ctx.fillStyle = sucker; ctx.fill(); }
  }
}

/** Glowing eye (organic weak points). */
export function eyeball(ctx, x, y, r, iris = '#ffb020') {
  circ(ctx, x, y, r * 1.15); ctx.fillStyle = '#1a0a10'; ctx.fill();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, iris); g.addColorStop(1, '#300808');
  circ(ctx, x, y, r); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#050000'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.18, r * 0.75, 0, 0, TAU); ctx.fill();
}

export { hull, glowDot, canopy, greeble, keyLight, bevel, plateFill, metal, rivetRow, hazard, vent, pipe, turbine, core, lamp };
