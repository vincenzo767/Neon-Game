import { fbmTile } from '../paint/noise.js';

// Painted material layers for the 3D White Fang (and any later 3D boss that
// wants them). Canvas2D on the main thread, once per GL context (~60 ms):
// every layer is S×S, RGB = albedo, A = specular mask (paint ≈ 0.35, bare
// metal ≈ 0.9, snow ≈ 0.45). Uploaded unpremultiplied as a TEXTURE_2D_ARRAY
// so tiling uses REPEAT and mipmaps stay seam-free.

export const TL = {
  ARMOR: 0,     // arctic white plate armour (panels, bolts, grime, chipped paint)
  DARK: 1,      // gunmetal steel
  TRACK: 2,     // track links with grousers and packed snow (8 links per tile along v)
  GRILLE: 3,    // engine / cooling grille slats
  SNOW: 4,      // packed snow and ice build-up
  BARREL: 5,    // machined dark steel (u around, v along)
  MARK: 6,      // v 0..0.5 hazard stripes, v 0.5..1 stencil markings
  GLOW: 7,      // emissive lenses / strips (white; tinted per draw)
  WHEEL: 8,     // road wheel / sprocket face
  SCORCH: 9,    // burnt, blistered metal (destroyed mounts, wreck)
  TREAD: 10,    // tread print in snow (multiplier / 2) for the track trail
  // SANDBREAKER (desert siege train)
  GOLD: 11,     // sandstone-gold armour plate (metallic: specular tinted by albedo)
  BRONZE: 12,   // aged dark bronze / brass fittings (metallic)
  SAND: 13,     // sand drifts settled on the train
  SBMARK: 14,   // v 0..0.5 hazard stripes, v 0.5..1 Sandbreaker stencils
  RWHEEL: 15,   // spoked railway wheel face (counterweight, crank boss)
  WAKE: 16,     // sand ploughed off the line (multiplier / 2) for the train's wake
  // IRON VEIN (open-pit mining fortress)
  IVPAINT: 17,  // industrial ochre paint over steel: chipped, dust-caked, oil-stained
  RUSTY: 18,    // weathered gunmetal with rust bloom, grease and dust
  CARBIDE: 19,  // tool steel of the cutter picks: heat temper bands (metallic)
  ROCK: 20,     // broken stone with strata and ore flecks (boulders, spikes, ore loads)
  BELT: 21,     // conveyor belt rubber carrying crushed ore (v along the belt)
  IVTRACK: 22,  // heavy track links caked with quarry dirt (8 links per tile along v)
  IVMARK: 23,   // v 0..0.5 hazard stripes, v 0.5..1 Iron Vein stencils
  EXCAV: 24,    // excavation trench (multiplier / 2): crushed rock, pick grooves, berms
  CRACK: 25,    // ground fracture (multiplier / 2): jagged crack down the middle of the strip
};
export const LAYERS = 26;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function canvas(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return c;
}

/** Grey canvas of a tileable fbm field (cached per size/seed). */
const NOISE = new Map();
function noise(S, base, oct, seed, lo = 0, hi = 1) {
  const key = `${S}:${base}:${oct}:${seed}:${lo}:${hi}`;
  if (NOISE.has(key)) return NOISE.get(key);
  const f = fbmTile(S, base, oct, seed);
  const c = canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(0, Math.min(1, (f[i] - lo) / (hi - lo)));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255); d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  NOISE.set(key, c);
  return c;
}

/** Tiled draw of a canvas so every layer wraps seamlessly. */
function overlay(ctx, src, op, alpha, S) {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, 0, 0, S, S);
  ctx.restore();
}

/** Draw fn at (x, y) and at its wrapped copies so shapes crossing the border tile. */
function wrap(S, x, y, r, fn) {
  for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) {
    const xx = x + dx, yy = y + dy;
    if (xx + r < 0 || xx - r > S || yy + r < 0 || yy - r > S) continue;
    fn(xx, yy);
  }
}

// ------------------------------------------------------------ armour

/**
 * Plate armour: recursive panel split, seams with a bevel highlight, bolt
 * rows, grime streaks under bolts, chipped paint along edges, scratches.
 * o: { base, var, seam, light, chip, grime, seed, wear }
 */
function armour(S, o) {
  const c = canvas(S), ctx = c.getContext('2d');
  const sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(o.seed);
  ctx.fillStyle = o.base; ctx.fillRect(0, 0, S, S);
  sx.fillStyle = `rgb(${o.paintSpec},${o.paintSpec},${o.paintSpec})`; sx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 4, 5, o.seed + 1, 0.15, 0.85), 'multiply', o.var, S);
  overlay(ctx, noise(S, 8, 5, o.seed + 2), 'screen', o.var * 0.45, S);
  // Panels.
  const panels = [];
  const split = (x, y, w, h, d) => {
    if (d > 3 || (w < S * 0.2 && h < S * 0.2) || (d > 1 && R() < 0.25)) { panels.push([x, y, w, h]); return; }
    if (w >= h) { const k = Math.round(w * (0.35 + R() * 0.3) / 8) * 8; split(x, y, k, h, d + 1); split(x + k, y, w - k, h, d + 1); }
    else { const k = Math.round(h * (0.35 + R() * 0.3) / 8) * 8; split(x, y, w, k, d + 1); split(x, y + k, w, h - k, d + 1); }
  };
  split(0, 0, S, S, 0);
  for (const [x, y, w, h] of panels) {
    const t = R();
    ctx.fillStyle = t < 0.5 ? `rgba(255,255,255,${0.04 + R() * 0.06})` : `rgba(20,30,40,${0.03 + R() * 0.07})`;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // Soft inner shading toward the bottom-right (panels are slightly domed).
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  }
  // Grime streaks running "down" the plate (+v).
  for (let i = 0; i < 70 * o.grime; i++) {
    const x = R() * S, y = R() * S, len = 20 + R() * 90, w = 1 + R() * 3;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(${o.grimeCol},${0.1 + R() * 0.16})`); g.addColorStop(1, `rgba(${o.grimeCol},0)`);
    ctx.fillStyle = g;
    wrap(S, x, y + len / 2, len, (xx, yy) => ctx.fillRect(xx, yy - len / 2, w, len));
  }
  // Seams: dark groove + bevel highlight + shadow.
  ctx.lineWidth = 2;
  for (const [x, y, w, h] of panels) {
    ctx.strokeStyle = o.seam; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = o.light; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 3, y + h - 3); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(x + w - 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.lineTo(x + 3, y + h - 3); ctx.stroke();
    ctx.lineWidth = 2;
    sx.strokeStyle = 'rgb(40,40,40)'; sx.lineWidth = 2; sx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  // Bolts along the seams.
  const bolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(bx + 0.8, by + 0.8, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = o.boltCol; ctx.beginPath(); ctx.arc(bx, by, 2.1, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(bx - 0.6, by - 0.6, 0.9, 0, 7); ctx.fill();
    // Rust / grime weep under the bolt.
    const g = ctx.createLinearGradient(0, by, 0, by + 16);
    g.addColorStop(0, `rgba(${o.grimeCol},0.22)`); g.addColorStop(1, `rgba(${o.grimeCol},0)`);
    ctx.fillStyle = g; ctx.fillRect(bx - 1, by + 2, 2, 16);
    sx.fillStyle = 'rgb(210,210,210)'; sx.beginPath(); sx.arc(bx, by, 1.6, 0, 7); sx.fill();
  };
  for (const [x, y, w, h] of panels) {
    if (R() < 0.25) continue;
    const step = 18 + Math.round(R() * 8);
    for (let k = x + 8; k < x + w - 6; k += step) { bolt(k, y + 7); if (R() < 0.6) bolt(k, y + h - 7); }
    for (let k = y + 8 + step; k < y + h - 6 - step / 2; k += step) { bolt(x + 7, k); if (R() < 0.6) bolt(x + w - 7, k); }
  }
  // Chipped paint: irregular flakes along the seams, exposing darker metal (shiny).
  for (let i = 0; i < 260 * o.wear; i++) {
    const [x, y, w, h] = panels[(R() * panels.length) | 0];
    const side = (R() * 4) | 0;
    const px = side === 0 ? x + R() * w : side === 1 ? x + w - 2 - R() * 6 : side === 2 ? x + R() * w : x + 2 + R() * 6;
    const py = side === 0 ? y + 2 + R() * 6 : side === 1 ? y + R() * h : side === 2 ? y + h - 2 - R() * 6 : y + R() * h;
    const r = 1 + R() * R() * 6, n = 5 + ((R() * 4) | 0), pts = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.283, rr = r * (0.5 + R() * 0.7); pts.push(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
    const path = (cx) => { cx.beginPath(); cx.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) cx.lineTo(pts[k], pts[k + 1]); cx.closePath(); };
    path(ctx); ctx.fillStyle = o.chip; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.7; ctx.stroke();
    path(sx); sx.fillStyle = 'rgb(235,235,235)'; sx.fill();
  }
  // Scratches.
  for (let i = 0; i < 120 * o.wear; i++) {
    const x = R() * S, y = R() * S, a = R() * 6.283, l = 4 + R() * 26;
    ctx.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(20,24,28,0.25)';
    ctx.lineWidth = 0.6 + R() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    sx.strokeStyle = 'rgb(200,200,200)'; sx.lineWidth = 0.8; sx.beginPath(); sx.moveTo(x, y); sx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); sx.stroke();
  }
  if (o.post) o.post(ctx, sx, R, panels);
  // Fine grain on top so nothing reads as flat vector fill.
  overlay(ctx, noise(S, 64, 3, o.seed + 9), 'overlay', 0.18, S);
  return [c, sp];
}

// -------------------------------------------------------------- tracks

function track(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(77), L = S / 8; // 8 links per tile along v
  ctx.fillStyle = '#121518'; ctx.fillRect(0, 0, S, S);
  sx.fillStyle = 'rgb(30,30,30)'; sx.fillRect(0, 0, S, S);
  for (let k = 0; k < 8; k++) {
    const y = k * L;
    // Link plate.
    const g = ctx.createLinearGradient(0, y, 0, y + L);
    g.addColorStop(0, '#565e66'); g.addColorStop(0.5, '#3a4148'); g.addColorStop(1, '#262b30');
    ctx.fillStyle = g; ctx.fillRect(S * 0.03, y + L * 0.1, S * 0.94, L * 0.78);
    // Grouser bar (raised cleat across the link): lit top edge, shadow below.
    ctx.fillStyle = '#7d868f'; ctx.fillRect(S * 0.05, y + L * 0.28, S * 0.9, L * 0.2);
    ctx.fillStyle = '#a5adb5'; ctx.fillRect(S * 0.05, y + L * 0.28, S * 0.9, L * 0.05);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(S * 0.05, y + L * 0.48, S * 0.9, L * 0.08);
    sx.fillStyle = 'rgb(220,220,220)'; sx.fillRect(S * 0.05, y + L * 0.28, S * 0.9, L * 0.2);
    // Centre guide horns and end connectors.
    for (const gx of [0.44, 0.56]) { ctx.fillStyle = '#2b3036'; ctx.fillRect(S * gx - 6, y + L * 0.55, 12, L * 0.3); ctx.fillStyle = '#6e767e'; ctx.fillRect(S * gx - 6, y + L * 0.55, 12, 3); }
    for (const ex of [0.03, 0.97]) { ctx.fillStyle = '#1c2024'; ctx.beginPath(); ctx.arc(S * ex, y + L * 0.5, L * 0.18, 0, 7); ctx.fill(); ctx.fillStyle = '#80888f'; ctx.beginPath(); ctx.arc(S * ex, y + L * 0.5, L * 0.08, 0, 7); ctx.fill(); }
    // Packed snow and ice in the gaps and on the plate (random per link).
    for (let i = 0; i < 14; i++) {
      const px = S * (0.05 + R() * 0.9), py = y + L * (R() < 0.7 ? 0.58 + R() * 0.36 : 0.1 + R() * 0.14), r = 2 + R() * 7;
      ctx.fillStyle = `rgba(${210 + R() * 30},${218 + R() * 30},${228 + R() * 25},${0.35 + R() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.4, r * 0.7, 0, 0, 7); ctx.fill();
      sx.fillStyle = 'rgb(110,110,110)'; sx.beginPath(); sx.ellipse(px, py, r * 1.4, r * 0.7, 0, 0, 7); sx.fill();
    }
  }
  overlay(ctx, noise(S, 16, 4, 81), 'overlay', 0.35, S);
  return [c, sp];
}

function grille(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, S, S);
  sx.fillStyle = 'rgb(60,60,60)'; sx.fillRect(0, 0, S, S);
  const n = 16, h = S / n;
  for (let k = 0; k < n; k++) {
    const y = k * h;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#9aa3ac'); g.addColorStop(0.35, '#5c646c'); g.addColorStop(0.7, '#2a3036'); g.addColorStop(1, '#0d0f12');
    ctx.fillStyle = g; ctx.fillRect(0, y, S, h * 0.72);
    sx.fillStyle = 'rgb(200,200,200)'; sx.fillRect(0, y, S, h * 0.15);
  }
  // Frame bars every quarter.
  for (let k = 0; k < 4; k++) { ctx.fillStyle = '#3d444b'; ctx.fillRect(k * S / 4, 0, 6, S); ctx.fillStyle = '#7b848c'; ctx.fillRect(k * S / 4, 0, 2, S); }
  overlay(ctx, noise(S, 8, 4, 91), 'multiply', 0.35, S);
  return [c, sp];
}

function snow(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(5);
  ctx.fillStyle = '#e9eef4'; ctx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 4, 5, 101, 0.2, 0.9), 'multiply', 0.22, S);
  // Blue-grey hollows and bright crusts.
  for (let i = 0; i < 90; i++) {
    const x = R() * S, y = R() * S, r = 6 + R() * 30;
    wrap(S, x, y, r * 1.6, (xx, yy) => {
      const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, r);
      g.addColorStop(0, R() < 0.5 ? 'rgba(160,185,215,0.22)' : 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(xx, yy, r * 1.6, r, R(), 0, 7); ctx.fill();
    });
  }
  sx.fillStyle = 'rgb(90,90,90)'; sx.fillRect(0, 0, S, S);
  // Sparkle grains (high spec).
  for (let i = 0; i < 1400; i++) {
    const x = R() * S, y = R() * S;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`; ctx.fillRect(x, y, 1, 1);
    sx.fillStyle = 'rgb(255,255,255)'; sx.fillRect(x, y, 1, 1);
  }
  return [c, sp];
}

function barrel(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(17);
  ctx.fillStyle = '#4b535b'; ctx.fillRect(0, 0, S, S);
  // Brushed: fine streaks along v.
  for (let i = 0; i < 900; i++) {
    const x = R() * S;
    ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, 0, 1, S);
  }
  sx.fillStyle = 'rgb(200,200,200)'; sx.fillRect(0, 0, S, S);
  // Machined bands across the barrel.
  for (let k = 0; k < 4; k++) {
    const y = k * S / 4 + S / 8;
    ctx.fillStyle = '#23282d'; ctx.fillRect(0, y, S, 10);
    ctx.fillStyle = '#9aa3ab'; ctx.fillRect(0, y - 2, S, 2);
    sx.fillStyle = 'rgb(90,90,90)'; sx.fillRect(0, y, S, 10);
  }
  overlay(ctx, noise(S, 8, 4, 19), 'multiply', 0.2, S);
  return [c, sp];
}

function marks(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  // v 0..0.5: worn hazard stripes.
  ctx.fillStyle = '#e0b21e'; ctx.fillRect(0, 0, S, S / 2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S, S / 2); ctx.clip();
  ctx.fillStyle = '#16181b';
  for (let x = -S; x < S * 2; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - S / 2, S / 2); ctx.lineTo(x - S / 2, S / 2); ctx.fill(); }
  ctx.restore();
  overlay(ctx, noise(S, 8, 5, 31, 0.3, 0.8), 'multiply', 0.35, S);
  // v 0.5..1: off-white panel with stencil markings.
  ctx.fillStyle = '#d3d9df'; ctx.fillRect(0, S / 2, S, S / 2);
  ctx.fillStyle = 'rgba(28,34,42,0.85)';
  ctx.font = `bold ${S * 0.16}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('WF-01', S / 2, S * 0.66);
  ctx.font = `bold ${S * 0.07}px Arial, sans-serif`;
  ctx.fillText('IRONCLAD SYNDICATE', S / 2, S * 0.82);
  ctx.fillStyle = '#c4422a'; ctx.fillRect(S * 0.1, S * 0.9, S * 0.8, S * 0.03);
  sx.fillStyle = 'rgb(90,90,90)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

function glow(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfefff'); g.addColorStop(0.75, '#6d90b0'); g.addColorStop(0.9, '#23303c'); g.addColorStop(1, '#111820');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(20,30,40,0.5)'; ctx.lineWidth = S * 0.015;
  for (const r of [0.22, 0.34]) { ctx.beginPath(); ctx.arc(S / 2, S / 2, S * r, 0, 7); ctx.stroke(); }
  sx.fillStyle = 'rgb(255,255,255)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

function wheel(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const m = S / 2;
  ctx.fillStyle = '#16191c'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2a2f34'; ctx.beginPath(); ctx.arc(m, m, S * 0.48, 0, 7); ctx.fill();
  // Sprocket teeth.
  ctx.fillStyle = '#4c545c';
  for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283; ctx.beginPath(); ctx.arc(m + Math.cos(a) * S * 0.44, m + Math.sin(a) * S * 0.44, S * 0.05, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#7a838b'; ctx.beginPath(); ctx.arc(m, m, S * 0.36, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a636b'; ctx.beginPath(); ctx.arc(m, m, S * 0.3, 0, 7); ctx.fill();
  // Lightening holes / spokes.
  ctx.fillStyle = '#121417';
  for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283 + 0.3; ctx.beginPath(); ctx.arc(m + Math.cos(a) * S * 0.2, m + Math.sin(a) * S * 0.2, S * 0.06, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#9aa3ab'; ctx.beginPath(); ctx.arc(m, m, S * 0.09, 0, 7); ctx.fill();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; ctx.fillStyle = '#2b3035'; ctx.beginPath(); ctx.arc(m + Math.cos(a) * S * 0.065, m + Math.sin(a) * S * 0.065, S * 0.015, 0, 7); ctx.fill(); }
  // Snow caked on the lower rim.
  ctx.fillStyle = 'rgba(232,238,245,0.7)'; ctx.beginPath(); ctx.arc(m, m, S * 0.47, 0.3, 2.2); ctx.lineTo(m, m); ctx.fill();
  sx.fillStyle = 'rgb(170,170,170)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

function scorch(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(55);
  ctx.fillStyle = '#1b1a19'; ctx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 4, 5, 57, 0.2, 0.9), 'screen', 0.18, S);
  for (let i = 0; i < 140; i++) {
    const x = R() * S, y = R() * S, r = 3 + R() * 18;
    ctx.fillStyle = R() < 0.4 ? `rgba(110,60,30,${0.2 + R() * 0.3})` : `rgba(70,70,72,${0.2 + R() * 0.3})`;
    wrap(S, x, y, r, (xx, yy) => { ctx.beginPath(); ctx.arc(xx, yy, r, 0, 7); ctx.fill(); });
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) { let x = R() * S, y = R() * S; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; ctx.lineTo(x, y); } ctx.stroke(); }
  sx.fillStyle = 'rgb(60,60,60)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

/**
 * Tread print in snow, stored as multiplier / 2 (0.5 = unchanged ground):
 * berms of pushed-up snow at the edges, compressed snow in the band, a dark
 * imprint for every grouser (one link per 1/8 of v, matching TRACK).
 */
function tread(S) {
  const c = canvas(S), ctx = c.getContext('2d');
  const R = rng(91), L = S / 8;
  const v = (m) => { const k = Math.round(Math.max(0, Math.min(1, m / 2)) * 255); return `rgb(${k},${k},${Math.min(255, k + 6)})`; };
  ctx.fillStyle = v(1); ctx.fillRect(0, 0, S, S);
  // Outer shadowed troughs and bright berms.
  for (const [x0, x1, m] of [[0, 0.06, 0.92], [0.06, 0.12, 1.16], [0.12, 0.16, 0.84], [0.84, 0.88, 0.84], [0.88, 0.94, 1.18], [0.94, 1, 0.95]]) { ctx.fillStyle = v(m); ctx.fillRect(x0 * S, 0, (x1 - x0) * S, S); }
  // Compressed band.
  ctx.fillStyle = v(0.8); ctx.fillRect(S * 0.16, 0, S * 0.68, S);
  for (let k = 0; k < 8; k++) {
    const y = k * L;
    ctx.fillStyle = v(0.56); ctx.fillRect(S * 0.18, y + L * 0.28, S * 0.64, L * 0.2);  // grouser imprint
    ctx.fillStyle = v(0.95); ctx.fillRect(S * 0.18, y + L * 0.48, S * 0.64, L * 0.06); // its lit lip
    ctx.fillStyle = v(0.7); ctx.fillRect(S * 0.46, y + L * 0.6, S * 0.08, L * 0.25);   // guide horns
  }
  // Exposed dark ice / frozen soil patches inside the band.
  const n = noise(S, 8, 4, 93, 0.55, 0.85);
  ctx.save(); ctx.beginPath(); ctx.rect(S * 0.18, 0, S * 0.64, S); ctx.clip();
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(n, 0, 0); ctx.restore();
  for (let i = 0; i < 60; i++) { ctx.fillStyle = v(0.9 + R() * 0.3); ctx.fillRect(R() * S, R() * S, 2 + R() * 5, 1 + R() * 3); }
  const sp = canvas(S); sp.getContext('2d').fillStyle = '#fff'; sp.getContext('2d').fillRect(0, 0, S, S);
  return [c, sp];
}

// ------------------------------------------------------ SANDBREAKER layers

/** Brass plate extras: sand settled along seams, heat temper tints, polished wear. */
function brassPost(S, sand, heat) {
  return (ctx, sx, R, panels) => {
    for (const [x, y, w, h] of panels) {
      if (R() < 0.55) {
        const g = ctx.createLinearGradient(0, y + h - 12, 0, y + h - 2);
        g.addColorStop(0, 'rgba(222,190,128,0)'); g.addColorStop(1, `rgba(222,190,128,${0.3 + R() * 0.25 * sand})`);
        ctx.fillStyle = g; ctx.fillRect(x + 2, y + h - 12, w - 4, 10);
      }
      // Rubbed-bright raised centre of the panel (worn by sand blasting).
      if (R() < 0.4) {
        const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.5);
        g.addColorStop(0, 'rgba(255,236,170,0.16)'); g.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        sx.fillStyle = 'rgba(255,255,255,0.18)'; sx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6);
      }
    }
    // Heat discolouration: straw → violet-blue temper rings in blotches.
    for (let i = 0; i < 9 * heat; i++) {
      const x = R() * S, y = R() * S, r = 20 + R() * 60;
      wrap(S, x, y, r, (xx, yy) => {
        const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, r);
        g.addColorStop(0, 'rgba(70,52,96,0.2)'); g.addColorStop(0.5, 'rgba(120,70,40,0.14)'); g.addColorStop(1, 'rgba(200,150,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, r, 0, 7); ctx.fill();
      });
    }
    // Sand-blasted haze over everything.
    overlay(ctx, noise(S, 6, 5, 141, 0.45, 0.95), 'screen', 0.12 * sand, S);
  };
}

function sandLayer(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(133);
  ctx.fillStyle = '#d0a86c'; ctx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 4, 5, 135, 0.2, 0.9), 'multiply', 0.25, S);
  // Wind ripples.
  for (let k = 0; k < 26; k++) {
    const y = (k / 26) * S;
    ctx.strokeStyle = 'rgba(120,84,40,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin((x / S) * 6.283 * 2 + k) * 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,190,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y - 2 + Math.sin((x / S) * 6.283 * 2 + k) * 4); ctx.stroke();
  }
  sx.fillStyle = 'rgb(45,45,45)'; sx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) {
    const x = R() * S, y = R() * S;
    ctx.fillStyle = R() < 0.5 ? `rgba(255,240,205,${0.3 + R() * 0.4})` : `rgba(90,60,30,${0.2 + R() * 0.3})`;
    ctx.fillRect(x, y, 1 + R(), 1 + R());
    if (R() < 0.15) { sx.fillStyle = 'rgb(200,200,200)'; sx.fillRect(x, y, 1, 1); }
  }
  return [c, sp];
}

function sbMarks(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  // v 0..0.5: worn hazard stripes (amber / black).
  ctx.fillStyle = '#d99a1c'; ctx.fillRect(0, 0, S, S / 2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S, S / 2); ctx.clip();
  ctx.fillStyle = '#17120c';
  for (let x = -S; x < S * 2; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - S / 2, S / 2); ctx.lineTo(x - S / 2, S / 2); ctx.fill(); }
  ctx.restore();
  overlay(ctx, noise(S, 8, 5, 151, 0.3, 0.8), 'multiply', 0.4, S);
  // v 0.5..1: dark bronze panel with gold stencils.
  ctx.fillStyle = '#3b2d1b'; ctx.fillRect(0, S / 2, S, S / 2);
  overlay(ctx, noise(S, 6, 4, 153, 0.3, 0.9), 'soft-light', 0.5, S);
  ctx.fillStyle = 'rgba(232,186,92,0.9)';
  ctx.font = `bold ${S * 0.16}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SB-02', S / 2, S * 0.66);
  ctx.font = `bold ${S * 0.065}px Arial, sans-serif`;
  ctx.fillText('IRONCLAD SYNDICATE', S / 2, S * 0.81);
  ctx.fillStyle = '#b8381e'; ctx.fillRect(S * 0.1, S * 0.9, S * 0.8, S * 0.03);
  sx.fillStyle = 'rgb(120,120,120)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

/** Spoked railway wheel face: polished tyre, spokes, bronze counterweight, hub. */
function railWheel(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const m = S / 2;
  ctx.fillStyle = '#100d0a'; ctx.fillRect(0, 0, S, S);
  // Tyre: polished running edge, darker flange.
  ctx.fillStyle = '#9a9690'; ctx.beginPath(); ctx.arc(m, m, S * 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a443c'; ctx.beginPath(); ctx.arc(m, m, S * 0.45, 0, 7); ctx.fill();
  ctx.fillStyle = '#1c1712'; ctx.beginPath(); ctx.arc(m, m, S * 0.4, 0, 7); ctx.fill();
  // Spokes.
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * 6.283, ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = S * 0.045;
    ctx.beginPath(); ctx.moveTo(m + ca * S * 0.1, m + sa * S * 0.1); ctx.lineTo(m + ca * S * 0.41, m + sa * S * 0.41); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,170,0.35)'; ctx.lineWidth = S * 0.01;
    ctx.beginPath(); ctx.moveTo(m + ca * S * 0.1, m + sa * S * 0.1); ctx.lineTo(m + ca * S * 0.41, m + sa * S * 0.41); ctx.stroke();
  }
  // Counterweight crescent (opposite the crank) and a hazard-red balance mark.
  ctx.fillStyle = '#4c3a22';
  ctx.beginPath(); ctx.arc(m, m, S * 0.4, 2.2, 4.1); ctx.arc(m, m, S * 0.17, 4.1, 2.2, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,150,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#a3321b'; ctx.fillRect(m - S * 0.36, m - S * 0.015, S * 0.08, S * 0.03);
  // Hub.
  ctx.fillStyle = '#b48a44'; ctx.beginPath(); ctx.arc(m, m, S * 0.12, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2c18'; ctx.beginPath(); ctx.arc(m, m, S * 0.07, 0, 7); ctx.fill();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; ctx.fillStyle = '#e0c47a'; ctx.beginPath(); ctx.arc(m + Math.cos(a) * S * 0.095, m + Math.sin(a) * S * 0.095, S * 0.012, 0, 7); ctx.fill(); }
  // Sand caked into the lower spokes.
  ctx.fillStyle = 'rgba(205,168,108,0.45)'; ctx.beginPath(); ctx.arc(m, m, S * 0.4, 0.4, 2.0); ctx.lineTo(m, m); ctx.fill();
  overlay(ctx, noise(S, 8, 4, 161), 'overlay', 0.3, S);
  sx.fillStyle = 'rgb(150,150,150)'; sx.fillRect(0, 0, S, S);
  sx.strokeStyle = 'rgb(250,250,250)'; sx.lineWidth = S * 0.05; sx.beginPath(); sx.arc(m, m, S * 0.475, 0, 7); sx.stroke();
  return [c, sp];
}

/**
 * Sand ploughed off the line by the train (multiplier / 2): swept, darker
 * ballast down the middle with streaks along the direction of travel,
 * pushed-up berms of sand at the edges.
 */
function wake(S) {
  const c = canvas(S), ctx = c.getContext('2d');
  const R = rng(171);
  const v = (m) => { const k = Math.round(Math.max(0, Math.min(1, m / 2)) * 255); return `rgb(${k},${k},${k})`; };
  ctx.fillStyle = v(1); ctx.fillRect(0, 0, S, S);
  for (const [x0, x1, m] of [[0, 0.07, 1.06], [0.07, 0.13, 1.14], [0.13, 0.18, 0.9], [0.82, 0.87, 0.9], [0.87, 0.93, 1.14], [0.93, 1, 1.06]]) { ctx.fillStyle = v(m); ctx.fillRect(x0 * S, 0, (x1 - x0) * S, S); }
  ctx.fillStyle = v(0.86); ctx.fillRect(S * 0.18, 0, S * 0.64, S);
  for (let i = 0; i < 70; i++) {
    const x = S * (0.18 + R() * 0.64), w = 1 + R() * 3;
    ctx.fillStyle = v(R() < 0.6 ? 0.72 + R() * 0.1 : 1.05);
    ctx.fillRect(x, 0, w, S);
  }
  const n = noise(S, 8, 4, 173, 0.5, 0.9);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.3; ctx.drawImage(n, 0, 0); ctx.restore();
  const sp = canvas(S); sp.getContext('2d').fillStyle = '#fff'; sp.getContext('2d').fillRect(0, 0, S, S);
  return [c, sp];
}

// ------------------------------------------------------- IRON VEIN layers

/** Mining plate extras: dust caked in the lower seams, oil runs, heat bloom, rust weeps. */
function minePost(S, rust, oil) {
  return (ctx, sx, R, panels) => {
    for (const [x, y, w, h] of panels) {
      // Quarry dust packed into the lower edge of each panel.
      if (R() < 0.7) {
        const g = ctx.createLinearGradient(0, y + h - 16, 0, y + h - 2);
        g.addColorStop(0, 'rgba(150,122,92,0)'); g.addColorStop(1, `rgba(150,122,92,${0.35 + R() * 0.3})`);
        ctx.fillStyle = g; ctx.fillRect(x + 2, y + h - 16, w - 4, 14);
        sx.fillStyle = 'rgba(30,30,30,0.6)'; sx.fillRect(x + 2, y + h - 10, w - 4, 8);
      }
      // Rust blooms in panel corners.
      if (R() < 0.45 * rust) {
        const cx = x + (R() < 0.5 ? 6 : w - 6), cy = y + (R() < 0.5 ? 6 : h - 6), r = 10 + R() * 26;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(120,52,18,0.55)'); g.addColorStop(0.6, 'rgba(140,70,30,0.25)'); g.addColorStop(1, 'rgba(140,70,30,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    // Oil / grease runs (dark, glossy).
    for (let i = 0; i < 26 * oil; i++) {
      const x = R() * S, y = R() * S, len = 16 + R() * 70, w = 2 + R() * 5;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(16,12,8,0.55)'); g.addColorStop(1, 'rgba(16,12,8,0)');
      wrap(S, x, y + len / 2, len, (xx, yy) => { ctx.fillStyle = g; ctx.fillRect(xx, yy - len / 2, w, len); sx.fillStyle = 'rgba(230,230,230,0.5)'; sx.fillRect(xx, yy - len / 2, w, len * 0.6); });
    }
    overlay(ctx, noise(S, 6, 5, 211, 0.45, 0.95), 'multiply', 0.22, S);
    overlay(ctx, noise(S, 24, 4, 213, 0.55, 0.95), 'screen', 0.12, S); // dust haze
  };
}

/** Pick steel: bright machined tip, temper colours toward the shank, soot. */
function carbide(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(221);
  // v runs along the pick (0 = base, 1 = tip), u around it.
  const g = ctx.createLinearGradient(0, S, 0, 0);
  g.addColorStop(0, '#2c2620'); g.addColorStop(0.35, '#5a4a3a'); g.addColorStop(0.55, '#6b5a7a');
  g.addColorStop(0.68, '#8a7a52'); g.addColorStop(0.8, '#c9c6bf'); g.addColorStop(1, '#eeeae2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 600; i++) { ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; ctx.fillRect(R() * S, 0, 1, S); }
  for (let k = 0; k < 3; k++) { const y = S * (0.25 + k * 0.12); ctx.fillStyle = 'rgba(10,8,6,0.5)'; ctx.fillRect(0, y, S, 5); }
  overlay(ctx, noise(S, 8, 4, 223), 'multiply', 0.25, S);
  const gs = sx.createLinearGradient(0, S, 0, 0);
  gs.addColorStop(0, 'rgb(90,90,90)'); gs.addColorStop(0.7, 'rgb(200,200,200)'); gs.addColorStop(1, 'rgb(255,255,255)');
  sx.fillStyle = gs; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

/** Quarried stone: layered strata, fractures, oxidised ore flecks. */
function rock(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(231);
  ctx.fillStyle = '#7a6a58'; ctx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 4, 5, 233, 0.15, 0.9), 'multiply', 0.5, S);
  overlay(ctx, noise(S, 16, 5, 235), 'overlay', 0.45, S);
  for (let k = 0; k < 14; k++) {
    const y = (k / 14) * S + R() * 8;
    ctx.strokeStyle = R() < 0.5 ? 'rgba(40,30,22,0.35)' : 'rgba(200,180,150,0.22)'; ctx.lineWidth = 1 + R() * 3;
    ctx.beginPath(); for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin((x / S) * 6.283 + k) * 5); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(16,12,8,0.6)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 40; i++) { let x = R() * S, y = R() * S; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
  sx.fillStyle = 'rgb(40,40,40)'; sx.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) {
    const x = R() * S, y = R() * S, r = 1 + R() * 4;
    ctx.fillStyle = R() < 0.5 ? `rgba(170,90,40,${0.5 + R() * 0.4})` : `rgba(60,62,66,${0.5 + R() * 0.4})`;
    wrap(S, x, y, r, (xx, yy) => { ctx.beginPath(); ctx.arc(xx, yy, r, 0, 7); ctx.fill(); });
    if (R() < 0.3) { sx.fillStyle = 'rgb(210,210,210)'; sx.fillRect(x, y, 2, 2); }
  }
  return [c, sp];
}

/** Conveyor belt: dark rubber with cleats, crushed ore and dust riding on it. */
function belt(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(241);
  ctx.fillStyle = '#1c1916'; ctx.fillRect(0, 0, S, S);
  overlay(ctx, noise(S, 8, 4, 243), 'overlay', 0.4, S);
  sx.fillStyle = 'rgb(50,50,50)'; sx.fillRect(0, 0, S, S);
  for (let k = 0; k < 8; k++) { const y = k * S / 8; ctx.fillStyle = '#2e2924'; ctx.fillRect(S * 0.06, y, S * 0.88, 6); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(S * 0.06, y, S * 0.88, 1.5); }
  // Ore load: heaped in the middle of the belt (troughed idlers).
  for (let i = 0; i < 260; i++) {
    const x = S * (0.5 + (R() - 0.5) * (R() * 0.8)), y = R() * S, r = 2 + R() * 9;
    const tone = R();
    ctx.fillStyle = tone < 0.45 ? `rgb(${110 + R() * 40},${88 + R() * 30},${66 + R() * 24})` : tone < 0.75 ? `rgb(${70 + R() * 30},${62 + R() * 20},${56 + R() * 20})` : `rgb(${150 + R() * 50},${76 + R() * 30},${36 + R() * 20})`;
    wrap(S, x, y, r, (xx, yy) => { ctx.beginPath(); ctx.ellipse(xx, yy, r, r * (0.6 + R() * 0.4), R() * 3, 0, 7); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,240,210,0.18)'; ctx.fillRect(x - r * 0.4, y - r * 0.4, r * 0.5, r * 0.3);
  }
  return [c, sp];
}

/** Heavy track links with quarry dirt packed between the grousers. */
function ivTrack(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  const R = rng(251), L = S / 8;
  ctx.fillStyle = '#16120e'; ctx.fillRect(0, 0, S, S);
  sx.fillStyle = 'rgb(30,30,30)'; sx.fillRect(0, 0, S, S);
  for (let k = 0; k < 8; k++) {
    const y = k * L;
    const g = ctx.createLinearGradient(0, y, 0, y + L);
    g.addColorStop(0, '#5c564e'); g.addColorStop(0.5, '#3e3934'); g.addColorStop(1, '#27231f');
    ctx.fillStyle = g; ctx.fillRect(S * 0.02, y + L * 0.08, S * 0.96, L * 0.8);
    ctx.fillStyle = '#7a7268'; ctx.fillRect(S * 0.04, y + L * 0.24, S * 0.92, L * 0.24);
    ctx.fillStyle = '#b0a798'; ctx.fillRect(S * 0.04, y + L * 0.24, S * 0.92, L * 0.05);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(S * 0.04, y + L * 0.48, S * 0.92, L * 0.1);
    sx.fillStyle = 'rgb(225,225,225)'; sx.fillRect(S * 0.04, y + L * 0.24, S * 0.92, L * 0.06);
    for (const ex of [0.02, 0.98]) { ctx.fillStyle = '#1a1612'; ctx.beginPath(); ctx.arc(S * ex, y + L * 0.5, L * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#857c70'; ctx.beginPath(); ctx.arc(S * ex, y + L * 0.5, L * 0.09, 0, 7); ctx.fill(); }
    for (let i = 0; i < 16; i++) {
      const px = S * (0.04 + R() * 0.92), py = y + L * (R() < 0.75 ? 0.58 + R() * 0.36 : 0.08 + R() * 0.14), r = 2 + R() * 8;
      ctx.fillStyle = `rgba(${118 + R() * 40},${92 + R() * 30},${66 + R() * 24},${0.45 + R() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(px, py, r * 1.5, r * 0.7, 0, 0, 7); ctx.fill();
      sx.fillStyle = 'rgb(40,40,40)'; sx.beginPath(); sx.ellipse(px, py, r * 1.5, r * 0.7, 0, 0, 7); sx.fill();
    }
  }
  overlay(ctx, noise(S, 16, 4, 253), 'overlay', 0.35, S);
  return [c, sp];
}

function ivMarks(S) {
  const c = canvas(S), ctx = c.getContext('2d'), sp = canvas(S), sx = sp.getContext('2d');
  ctx.fillStyle = '#d6a21c'; ctx.fillRect(0, 0, S, S / 2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S, S / 2); ctx.clip();
  ctx.fillStyle = '#15120d';
  for (let x = -S; x < S * 2; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - S / 2, S / 2); ctx.lineTo(x - S / 2, S / 2); ctx.fill(); }
  ctx.restore();
  overlay(ctx, noise(S, 8, 5, 261, 0.3, 0.8), 'multiply', 0.45, S);
  ctx.fillStyle = '#2b2622'; ctx.fillRect(0, S / 2, S, S / 2);
  overlay(ctx, noise(S, 6, 4, 263, 0.3, 0.9), 'soft-light', 0.5, S);
  ctx.fillStyle = 'rgba(222,170,60,0.9)';
  ctx.font = `bold ${S * 0.16}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('IV-03', S / 2, S * 0.66);
  ctx.font = `bold ${S * 0.065}px Arial, sans-serif`;
  ctx.fillText('IRONCLAD SYNDICATE', S / 2, S * 0.81);
  ctx.fillStyle = '#b83a1a'; ctx.fillRect(S * 0.1, S * 0.9, S * 0.8, S * 0.03);
  sx.fillStyle = 'rgb(110,110,110)'; sx.fillRect(0, 0, S, S);
  return [c, sp];
}

/**
 * Excavation trench (multiplier / 2): a scraped, darker floor of crushed rock
 * with pick grooves running along the cut, fractured edges and loose spoil
 * pushed up into berms either side.
 */
function excav(S) {
  const c = canvas(S), ctx = c.getContext('2d');
  const R = rng(271);
  const v = (m) => { const k = Math.round(Math.max(0, Math.min(1, m / 2)) * 255); return `rgb(${k},${Math.round(k * 0.98)},${Math.round(k * 0.95)})`; };
  ctx.fillStyle = v(1); ctx.fillRect(0, 0, S, S);
  for (const [x0, x1, m] of [[0, 0.05, 1.1], [0.05, 0.11, 1.22], [0.11, 0.15, 0.7], [0.85, 0.89, 0.7], [0.89, 0.95, 1.22], [0.95, 1, 1.1]]) { ctx.fillStyle = v(m); ctx.fillRect(x0 * S, 0, (x1 - x0) * S, S); }
  ctx.fillStyle = v(0.86); ctx.fillRect(S * 0.15, 0, S * 0.7, S);
  // Pick grooves along the cut.
  for (let i = 0; i < 36; i++) { const x = S * (0.16 + R() * 0.68), w = 1 + R() * 3; ctx.fillStyle = v(R() < 0.65 ? 0.58 + R() * 0.1 : 0.98); ctx.fillRect(x, 0, w, S); }
  // Crushed rock lumps (lit top, dark underside) and fractured edges.
  for (let i = 0; i < 220; i++) {
    const x = S * (0.12 + R() * 0.76), y = R() * S, r = 1.5 + R() * 6;
    wrap(S, x, y, r * 2, (xx, yy) => {
      ctx.fillStyle = v(0.5); ctx.beginPath(); ctx.ellipse(xx + r * 0.3, yy + r * 0.3, r, r * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = v(1.0 + R() * 0.3); ctx.beginPath(); ctx.ellipse(xx, yy, r * 0.85, r * 0.65, R() * 3, 0, 7); ctx.fill();
    });
  }
  for (const side of [0.15, 0.85]) {
    ctx.strokeStyle = v(0.35); ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let y = 0; y <= S; y += 8) ctx.lineTo(S * side + (R() - 0.5) * 10, y); ctx.stroke();
  }
  const n = noise(S, 8, 4, 273, 0.45, 0.9);
  ctx.save(); ctx.beginPath(); ctx.rect(S * 0.12, 0, S * 0.76, S); ctx.clip();
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(n, 0, 0); ctx.restore();
  const sp = canvas(S); sp.getContext('2d').fillStyle = '#fff'; sp.getContext('2d').fillRect(0, 0, S, S);
  return [c, sp];
}

/**
 * Ground fracture (multiplier / 2): a jagged dark crack wandering down the
 * centre of the strip, hairline branches, a lighter heaved lip on each side.
 * The darkness doubles as the glow mask for molten fissures.
 */
function crack(S) {
  const c = canvas(S), ctx = c.getContext('2d');
  const R = rng(281);
  const v = (m) => { const k = Math.round(Math.max(0, Math.min(1, m / 2)) * 255); return `rgb(${k},${k},${k})`; };
  ctx.fillStyle = v(1); ctx.fillRect(0, 0, S, S);
  // Heaved, dusty lips either side of the break.
  const lg = ctx.createLinearGradient(0, 0, S, 0);
  lg.addColorStop(0, v(1)); lg.addColorStop(0.3, v(1.12)); lg.addColorStop(0.45, v(0.8)); lg.addColorStop(0.55, v(0.8)); lg.addColorStop(0.7, v(1.12)); lg.addColorStop(1, v(1));
  ctx.fillStyle = lg; ctx.fillRect(0, 0, S, S);
  // The crack: a periodic jagged line (tiles along v).
  const pts = [];
  for (let k = 0; k <= 16; k++) pts.push([S * 0.5 + (k === 0 || k === 16 ? 0 : (R() - 0.5) * S * 0.18), (k / 16) * S]);
  for (const [w, m] of [[S * 0.09, 0.55], [S * 0.05, 0.22], [S * 0.022, 0.05]]) {
    ctx.strokeStyle = v(m); ctx.lineWidth = w; ctx.lineJoin = 'miter';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  // Hairline branches.
  for (let i = 0; i < 18; i++) {
    const [x0, y0] = pts[1 + Math.floor(R() * 15)];
    let x = x0, y = y0, a = (R() < 0.5 ? 0 : Math.PI) + (R() - 0.5) * 1.2;
    ctx.strokeStyle = v(0.4); ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += Math.cos(a) * S * 0.05; y += Math.sin(a) * S * 0.05; a += (R() - 0.5) * 0.8; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const sp = canvas(S); sp.getContext('2d').fillStyle = '#fff'; sp.getContext('2d').fillRect(0, 0, S, S);
  return [c, sp];
}

/** Paint every layer: returns [{rgb canvas, spec canvas}] in TL order. */
export function paintTankLayers(S = 512) {
  const W = { base: '#c4ccd4', var: 0.42, seam: 'rgba(40,48,58,0.75)', light: 'rgba(255,255,255,0.55)', chip: '#5d646b', grimeCol: '60,58,52', boltCol: '#b3bbc3', grime: 1, wear: 1, seed: 11, paintSpec: 95 };
  const D = { base: '#59616a', var: 0.4, seam: 'rgba(12,15,18,0.8)', light: 'rgba(200,210,220,0.35)', chip: '#8f979e', grimeCol: '30,28,24', boltCol: '#8c949b', grime: 0.7, wear: 1.4, seed: 23, paintSpec: 140 };
  const G = { base: '#d49a30', var: 0.3, seam: 'rgba(58,34,8,0.85)', light: 'rgba(255,232,150,0.6)', chip: '#5c4020', grimeCol: '84,52,18', boltCol: '#f0cc78', grime: 1.0, wear: 1.0, seed: 41, paintSpec: 185, post: brassPost(S, 0.8, 1) };
  const B = { base: '#6e5532', var: 0.42, seam: 'rgba(24,16,6,0.85)', light: 'rgba(240,210,150,0.4)', chip: '#a88a52', grimeCol: '36,24,10', boltCol: '#c9a35e', grime: 0.9, wear: 1.3, seed: 47, paintSpec: 150, post: brassPost(S, 0.6, 0.5) };
  const Y = { base: '#a8843a', var: 0.45, seam: 'rgba(36,26,12,0.85)', light: 'rgba(255,226,150,0.4)', chip: '#4a443e', grimeCol: '58,44,28', boltCol: '#c9b07a', grime: 1.3, wear: 1.8, seed: 61, paintSpec: 110, post: minePost(S, 0.8, 1) };
  const U = { base: '#4c4844', var: 0.5, seam: 'rgba(10,9,8,0.85)', light: 'rgba(210,190,170,0.3)', chip: '#8a6a4a', grimeCol: '70,40,20', boltCol: '#8a8276', grime: 1.4, wear: 1.6, seed: 67, paintSpec: 150, post: minePost(S, 1.4, 1.2) };
  return [armour(S, W), armour(S, D), track(S), grille(S), snow(S), barrel(S), marks(S), glow(S), wheel(S), scorch(S), tread(S),
    armour(S, G), armour(S, B), sandLayer(S), sbMarks(S), railWheel(S), wake(S),
    armour(S, Y), armour(S, U), carbide(S), rock(S), belt(S), ivTrack(S), ivMarks(S), excav(S), crack(S)];
}

/** Merge rgb + spec → ImageData (A = spec). */
export function layerPixels(pair, S) {
  const [rgb, spec] = pair;
  const a = rgb.getContext('2d').getImageData(0, 0, S, S), s = spec.getContext('2d').getImageData(0, 0, S, S).data, d = a.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = s[i];
  return a;
}
