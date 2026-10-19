import { css, shade, mix } from './core.js';

// Flat props painted into terrain chunks (seen from above), each queuing its
// own soft shadow. At ~6 world units per metre a car is ~11×26 units and
// ~9 tall, so it barely moves in perspective: painting it into the ground
// texture is indistinguishable from geometry and costs nothing at runtime.
//
// All painters take the Painter, a centre, a rotation (0 = facing +y) and
// options. Colours are [r, g, b].

const TAU = Math.PI * 2;

const CAR_COLORS = [
  [0.75, 0.75, 0.74], [0.12, 0.12, 0.13], [0.45, 0.46, 0.48], [0.55, 0.08, 0.07], [0.12, 0.2, 0.38],
  [0.85, 0.85, 0.82], [0.26, 0.3, 0.27], [0.62, 0.52, 0.32], [0.18, 0.22, 0.3], [0.7, 0.62, 0.1],
];
export const carColor = (R) => R.pick(CAR_COLORS);

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

/** Light sheen across a rounded body: lit side toward the sun. */
function sheen(p, c, w, l, rot) {
  const s = p.sun;
  // Sun direction in the prop's local frame.
  const cs = Math.cos(-rot), sn = Math.sin(-rot);
  const lx = -(s.dx * cs - s.dy * sn), ly = -(s.dx * sn + s.dy * cs);
  const g = c.createLinearGradient(lx * w * 0.5, ly * l * 0.5, -lx * w * 0.5, -ly * l * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  return g;
}

/**
 * Passenger car. o: { color, kind: 'sedan'|'hatch'|'suv'|'van', burnt, wrecked, lights }
 * Returns its footprint size for callers that need it.
 */
export function car(p, x, y, rot, o = {}) {
  const kind = o.kind || 'sedan';
  const dims = { sedan: [11, 26, 8], hatch: [10.5, 22, 8.5], suv: [12, 28, 10], van: [12, 30, 12] }[kind];
  const [w, l, h] = dims;
  p.shadowBox(x, y, w * 0.96, l * 0.96, h, rot);
  if (o.burnt) return burntCar(p, x, y, rot, w, l, o);
  const col = o.color || [0.6, 0.6, 0.6];
  p.at(x, y, rot, (c) => {
    // Tyres peeking out.
    c.fillStyle = '#0b0b0c';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) c.fillRect(sx * w / 2 - (sx > 0 ? 1.4 : 0), sy * l * 0.3 - 2.4, 1.4, 4.8);
    // Body.
    rr(c, -w / 2, -l / 2, w, l, 3.2);
    c.fillStyle = css(col); c.fill();
    c.lineWidth = 0.5; c.strokeStyle = css(shade(col, 0.45)); c.stroke();
    // Bonnet / boot panels.
    const roofL = kind === 'van' ? l * 0.62 : kind === 'suv' ? l * 0.5 : l * 0.38;
    const roofY = kind === 'van' ? -l * 0.12 : -l * 0.04;
    c.fillStyle = css(shade(col, 1.08));
    rr(c, -w / 2 + 1.2, roofY - roofL / 2 - 0.6, w - 2.4, roofL + 1.2, 2.2); c.fill();
    // Glass: windscreen (front, +y) and rear window.
    const glass = (y0, y1, inset) => {
      c.beginPath();
      c.moveTo(-w / 2 + 1 + inset, y0); c.lineTo(w / 2 - 1 - inset, y0); c.lineTo(w / 2 - 1.4, y1); c.lineTo(-w / 2 + 1.4, y1); c.closePath();
      const g = c.createLinearGradient(-w / 2, y1, w / 2, y0);
      g.addColorStop(0, '#0b1119'); g.addColorStop(0.55, '#26384a'); g.addColorStop(1, '#6c8196');
      c.fillStyle = g; c.fill();
    };
    glass(roofY + roofL / 2 + (kind === 'van' ? 2.6 : 4.2), roofY + roofL / 2 + 0.4, 1.2);
    if (kind !== 'van') glass(roofY - roofL / 2 - 0.4, roofY - roofL / 2 - 3.2, 1.0);
    // Roof.
    c.fillStyle = css(shade(col, 1.15));
    rr(c, -w / 2 + 1.6, roofY - roofL / 2 + 0.2, w - 3.2, roofL - 0.4, 2); c.fill();
    // Lights.
    c.fillStyle = o.lights ? '#fff6d0' : '#d8dcd8';
    c.fillRect(-w / 2 + 1, l / 2 - 1.2, 2.4, 1); c.fillRect(w / 2 - 3.4, l / 2 - 1.2, 2.4, 1);
    c.fillStyle = '#8a1010';
    c.fillRect(-w / 2 + 1, -l / 2 + 0.3, 2.4, 1); c.fillRect(w / 2 - 3.4, -l / 2 + 0.3, 2.4, 1);
    // Mirrors.
    c.fillStyle = css(shade(col, 0.7));
    c.fillRect(-w / 2 - 0.9, roofY + roofL / 2 + 1.4, 1.2, 1.4); c.fillRect(w / 2 - 0.3, roofY + roofL / 2 + 1.4, 1.2, 1.4);
    // Sheen.
    rr(c, -w / 2, -l / 2, w, l, 3.2);
    c.fillStyle = sheen(p, c, w, l, rot); c.fill();
    if (o.wrecked) {
      c.globalAlpha = 0.7; c.fillStyle = '#1a1714';
      c.beginPath(); c.ellipse(-w * 0.15, l * 0.25, w * 0.35, l * 0.18, 0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(-w / 2, l * 0.1); c.lineTo(w * 0.1, l * 0.32); c.lineTo(w / 2, l * 0.2); c.stroke();
    }
  });
  if (o.lights && p.env.glow) {
    const g = p.env.glow;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (const s of [-1, 1]) { const lx = s * (w / 2 - 2), ly = l / 2; g.radial(x + lx * cs - ly * sn, y + lx * sn + ly * cs, 3, [[0, [1, 0.95, 0.8], 1], [1, [1, 0.9, 0.6], 0]], 'lighter'); }
  }
  return [w, l];
}

function burntCar(p, x, y, rot, w, l, o) {
  // Scorch halo on the ground first.
  p.radial(x, y, l * 0.85, [[0, [0.03, 0.025, 0.02], 0.85], [0.6, [0.05, 0.04, 0.035], 0.45], [1, [0.05, 0.04, 0.04], 0]]);
  p.at(x, y, rot, (c) => {
    rr(c, -w / 2, -l / 2, w, l, 3);
    c.fillStyle = '#1a1512'; c.fill();
    // Rust and heat-bleached paint.
    c.save(); c.clip();
    c.fillStyle = 'rgba(120,58,24,0.75)';
    c.beginPath(); c.ellipse(w * 0.2, -l * 0.18, w * 0.4, l * 0.22, 0.3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(160,140,120,0.35)';
    c.beginPath(); c.ellipse(-w * 0.25, l * 0.25, w * 0.3, l * 0.14, -0.4, 0, TAU); c.fill();
    c.restore();
    // Empty window holes and the gutted cabin.
    c.fillStyle = '#050403';
    c.fillRect(-w / 2 + 1.8, -l * 0.18, w - 3.6, l * 0.42);
    c.strokeStyle = 'rgba(90,70,55,0.9)'; c.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-w / 2 + 2, -l * 0.15 + i * 2.6); c.lineTo(w / 2 - 2, -l * 0.15 + i * 2.6); c.stroke(); }
    c.lineWidth = 0.7; c.strokeStyle = '#0a0806';
    rr(c, -w / 2, -l / 2, w, l, 3); c.stroke();
  });
  if (p.env.glow && o.embers !== false) p.env.glow.radial(x, y, l * 0.35, [[0, [1, 0.35, 0.05], 0.7], [1, [1, 0.2, 0], 0]], 'lighter');
}

/** Box truck / lorry / military truck. o: { color, cargo: 'box'|'flat'|'tank'|'canvas', burnt } */
export function truck(p, x, y, rot, o = {}) {
  const w = o.w || 15, l = o.l || 48, h = 18;
  p.shadowBox(x, y, w * 0.95, l * 0.97, h, rot);
  const col = o.color || [0.85, 0.85, 0.82];
  const cab = o.cab || [0.7, 0.12, 0.08];
  p.at(x, y, rot, (c) => {
    const cabL = 11;
    if (o.burnt) {
      rr(c, -w / 2, -l / 2, w, l, 2); c.fillStyle = '#16120f'; c.fill();
      c.fillStyle = 'rgba(110,50,20,0.7)'; c.fillRect(-w / 2 + 2, -l / 2 + 4, w - 4, l * 0.5);
      c.fillStyle = '#060504'; c.fillRect(-w / 2 + 2, l / 2 - cabL + 1, w - 4, 4);
      return;
    }
    // Cab.
    rr(c, -w / 2 + 0.5, l / 2 - cabL, w - 1, cabL, 2.4); c.fillStyle = css(cab); c.fill();
    c.fillStyle = '#122030'; c.fillRect(-w / 2 + 1.5, l / 2 - 3.6, w - 3, 2.4);
    c.fillStyle = css(shade(cab, 1.2)); c.fillRect(-w / 2 + 1.5, l / 2 - cabL + 1.5, w - 3, 5);
    // Cargo body.
    const by0 = -l / 2, by1 = l / 2 - cabL - 1;
    rr(c, -w / 2, by0, w, by1 - by0, 1.2);
    if (o.cargo === 'tank') {
      const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, '#5e6266'); g.addColorStop(0.4, '#d8dde0'); g.addColorStop(1, '#4c5054');
      c.fillStyle = g; c.fill();
    } else if (o.cargo === 'canvas') {
      c.fillStyle = css(o.color || [0.3, 0.33, 0.22]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.6;
      for (let yy = by0 + 4; yy < by1; yy += 5) { c.beginPath(); c.moveTo(-w / 2, yy); c.lineTo(w / 2, yy); c.stroke(); }
    } else {
      c.fillStyle = css(col); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.5;
      for (let yy = by0 + 3; yy < by1; yy += 3) { c.beginPath(); c.moveTo(-w / 2 + 0.6, yy); c.lineTo(w / 2 - 0.6, yy); c.stroke(); }
    }
    rr(c, -w / 2, -l / 2, w, l, 2);
    c.fillStyle = sheen(p, c, w, l, rot); c.fill();
  });
  return [w, l];
}

/** Bus (city bus or coach). */
export function bus(p, x, y, rot, o = {}) {
  const w = 15, l = o.l || 70;
  p.shadowBox(x, y, w * 0.96, l * 0.98, 19, rot);
  const col = o.color || [0.85, 0.75, 0.15];
  p.at(x, y, rot, (c) => {
    rr(c, -w / 2, -l / 2, w, l, 3);
    c.fillStyle = css(o.burnt ? [0.09, 0.08, 0.07] : col); c.fill();
    if (!o.burnt) {
      c.fillStyle = css(shade(col, 0.82));
      for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + 2, -l / 2 + 8 + k * 14, w - 4, 7);
      c.fillStyle = '#0d1520'; c.fillRect(-w / 2 + 1.4, l / 2 - 4, w - 2.8, 3);
    } else {
      c.fillStyle = 'rgba(120,60,25,0.6)'; c.fillRect(-w / 2 + 1, -l / 4, w - 2, l / 2);
      c.fillStyle = '#050403'; for (let k = 0; k < 5; k++) c.fillRect(-w / 2 + 2, -l / 2 + 6 + k * 12, w - 4, 6);
    }
    rr(c, -w / 2, -l / 2, w, l, 3);
    c.fillStyle = sheen(p, c, w, l, rot); c.fill();
  });
}

/** Main battle tank (intact or burnt-out wreck). o: { color, turret (rad), burnt } */
export function tank(p, x, y, rot, o = {}) {
  const w = 22, l = 44;
  p.shadowBox(x, y, w, l, 14, rot);
  const col = o.burnt ? [0.11, 0.1, 0.09] : (o.color || [0.3, 0.32, 0.24]);
  p.at(x, y, rot, (c) => {
    // Tracks.
    c.fillStyle = '#121211';
    c.fillRect(-w / 2, -l / 2, 5, l); c.fillRect(w / 2 - 5, -l / 2, 5, l);
    c.strokeStyle = 'rgba(80,80,76,0.6)'; c.lineWidth = 0.5;
    for (let yy = -l / 2 + 1; yy < l / 2; yy += 2.2) { c.beginPath(); c.moveTo(-w / 2, yy); c.lineTo(-w / 2 + 5, yy); c.moveTo(w / 2 - 5, yy); c.lineTo(w / 2, yy); c.stroke(); }
    // Hull.
    c.beginPath(); c.moveTo(-w / 2 + 4, -l / 2 + 2); c.lineTo(w / 2 - 4, -l / 2 + 2); c.lineTo(w / 2 - 4, l / 2 - 5); c.lineTo(w / 2 - 7, l / 2 - 1); c.lineTo(-w / 2 + 7, l / 2 - 1); c.lineTo(-w / 2 + 4, l / 2 - 5); c.closePath();
    c.fillStyle = css(col); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.stroke();
    c.fillStyle = css(shade(col, 0.75)); c.fillRect(-w / 2 + 6, -l / 2 + 3, w - 12, 8);
    // Turret + gun.
    c.save(); c.translate(0, 2); c.rotate(o.turret || 0);
    c.fillStyle = css(shade(col, 1.1)); c.beginPath(); c.ellipse(0, 0, 7.5, 9, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = css(shade(col, 0.6)); c.fillRect(-1.1, 6, 2.2, o.burnt ? 14 : 24);
    c.fillStyle = css(shade(col, 1.25)); c.beginPath(); c.arc(-2.5, -2, 2, 0, TAU); c.fill();
    c.restore();
    if (o.burnt) { c.fillStyle = 'rgba(120,55,20,0.55)'; c.beginPath(); c.ellipse(3, -6, 6, 9, 0.3, 0, TAU); c.fill(); }
    c.beginPath(); c.rect(-w / 2, -l / 2, w, l); c.fillStyle = sheen(p, c, w, l, rot); c.fill();
  });
}

/** Concrete Jersey barrier segment centred at (x, y), length len along rot. */
export function jersey(p, x, y, rot, len = 20, o = {}) {
  const w = 3.6;
  p.shadowBox(x, y, w, len, 5.5, rot);
  p.at(x, y, rot, (c) => {
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    const b = o.color || [0.62, 0.61, 0.58];
    g.addColorStop(0, css(shade(b, 0.7))); g.addColorStop(0.45, css(shade(b, 1.12))); g.addColorStop(1, css(shade(b, 0.6)));
    c.fillStyle = g; c.fillRect(-w / 2, -len / 2, w, len);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-w / 2, -len / 2, w, 0.5); c.fillRect(-w / 2, len / 2 - 0.5, w, 0.5);
    if (o.stripe) { c.fillStyle = 'rgba(220,180,30,0.8)'; c.fillRect(-0.4, -len / 2, 0.8, len); }
  });
}

/** Rubble pile: lit concrete chunks with rebar. */
export function rubble(p, R, x, y, r, o = {}) {
  const base = o.color || [0.5, 0.48, 0.45];
  p.radial(x, y, r * 1.25, [[0, [0.12, 0.11, 0.1], 0.5], [1, [0.1, 0.1, 0.1], 0]]);
  const n = Math.round(6 + r * 0.9);
  for (let i = 0; i < n; i++) {
    const a = R.angle(), d = Math.sqrt(R.next()) * r, s = R.range(1.8, 4.5) * (1 - d / r * 0.5) * (o.scale || 1);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    const h = s * R.range(0.5, 1.4);
    p.shadowCircle(cx, cy, s * 0.8, h * (1.4 - d / r), 0, 6);
    const pts = [];
    const k = R.int(4, 6), r0 = R.angle();
    for (let j = 0; j < k; j++) { const aa = r0 + (j / k) * TAU, rr2 = s * R.range(0.7, 1.15); pts.push(cx + Math.cos(aa) * rr2, cy + Math.sin(aa) * rr2); }
    const col = shade(base, R.range(0.65, 1.2));
    p.poly(pts).fill(col);
    // Lit face toward the sun + dark face away.
    const s2 = p.sun;
    p.ctx.save(); p.poly(pts); p.ctx.clip();
    p.ctx.translate(-s2.dx * s * 0.5, -s2.dy * s * 0.5);
    p.poly(pts).fill([1, 1, 1], 0.18);
    p.ctx.restore();
    if (o.rebar && R.chance(0.3)) p.line([cx, cy, cx + R.range(-6, 6), cy + R.range(-6, 6)], 0.5, [0.35, 0.18, 0.08], 0.9);
  }
}

/** Scattered small debris: fragments, papers, glass. */
export function debris(p, R, x, y, r, n = 30, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = R.angle(), d = R.next() * r, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, s = R.range(0.5, 1.8);
    const t = R.next();
    const col = t < 0.15 ? [0.75, 0.8, 0.85] : t < 0.6 ? shade(o.color || [0.45, 0.43, 0.4], R.range(0.6, 1.3)) : [0.12, 0.11, 0.1];
    p.at(cx, cy, R.angle(), (c) => { c.fillStyle = css(col, R.range(0.6, 1)); c.fillRect(-s / 2, -s / 3, s, s * 0.66); });
  }
}

/** Scorch mark (blast burn), optional crater hole. */
export function scorch(p, R, x, y, r, o = {}) {
  p.radial(x, y, r, [[0, [0.02, 0.018, 0.015], 0.95], [0.45, [0.04, 0.035, 0.03], 0.75], [1, [0.06, 0.05, 0.05], 0]]);
  // Splatter rays.
  for (let i = 0; i < 9; i++) {
    const a = R.angle(), l = r * R.range(0.8, 1.5);
    p.line([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l], R.range(1, 2.5), [0.03, 0.03, 0.03], 0.4, { cap: 'round' });
  }
  if (o.crater) crater(p, R, x, y, r * 0.45, o);
}

/** Impact crater: dark bowl, lit rim, ejecta. */
export function crater(p, R, x, y, r, o = {}) {
  const s = p.sun;
  const rim = o.rim || [0.45, 0.42, 0.38];
  // Ejecta ring.
  for (let i = 0; i < 18; i++) {
    const a = R.angle(), d = r * R.range(1.05, 1.7);
    p.circlePath(x + Math.cos(a) * d, y + Math.sin(a) * d, R.range(0.6, 2)).fill(shade(rim, R.range(0.6, 1.1)), 0.8);
  }
  p.circlePath(x, y, r * 1.12).fill(shade(rim, 0.9), 0.9);
  // Bowl: shaded on the sun side (the far wall faces the light).
  p.circlePath(x, y, r).fill([0.08, 0.075, 0.07]);
  p.radial(x + s.dx * r * 0.35, y + s.dy * r * 0.35, r * 0.95, [[0, [0.3, 0.28, 0.26], 0.6], [1, [0.2, 0.18, 0.16], 0]]);
  p.ctx.save(); p.circlePath(x, y, r); p.ctx.clip();
  p.circlePath(x - s.dx * r * 0.4, y - s.dy * r * 0.4, r).fill([0, 0, 0], 0.45);
  p.ctx.restore();
}

/** Tyre skid marks along a path. */
export function skid(p, pts, gauge = 8, alpha = 0.35) {
  for (const s of [-1, 1]) {
    const q = [];
    for (let i = 0; i < pts.length; i += 2) q.push(pts[i] + s * gauge / 2, pts[i + 1]);
    p.line(q, 1.6, [0.02, 0.02, 0.02], alpha, { cap: 'round' });
  }
}

/** Street lamp seen from above (pole + arm + head) with the pole's long shadow. */
export function lamp(p, x, y, armDir, o = {}) {
  const h = o.h || 48, arm = o.arm || 10;
  p.shadowCircle(x, y, 0.9, h, 0, 6);
  p.shadow([x - 0.6, y, x + 0.6, y, x + 0.6 + armDir * arm, y + 0.4, x - 0.6 + armDir * arm, y + 0.4], h, h - 1.5);
  if (!o.shadowOnly) {
    p.circlePath(x, y, 1.3).fill([0.3, 0.3, 0.32]);
    p.line([x, y, x + armDir * arm, y], 1, [0.38, 0.39, 0.4]);
    p.ellipsePath(x + armDir * arm, y, 2.2, 1.3).fill(o.on ? [1, 0.92, 0.7] : [0.5, 0.52, 0.55]);
  }
  if (o.on && p.env.glow && p.phase !== 'shadow') p.env.glow.radial(x + armDir * arm * 1.3, y, 20, [[0, [1, 0.75, 0.45], 0.32], [1, [1, 0.6, 0.3], 0]], 'lighter');
}

/** Deciduous tree crown from above: clustered leaf blobs, lit from the sun. */
export function tree(p, R, x, y, r, o = {}) {
  const h = o.h || r * 2.4;
  p.shadowCircle(x, y, r * 0.8, h, h * 0.35, 9);
  const base = o.color || [0.2, 0.3, 0.14];
  const s = p.sun;
  for (let i = 0; i < 9; i++) {
    const a = R.angle(), d = R.next() * r * 0.55, br = r * R.range(0.4, 0.62);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    p.radial(cx, cy, br, [[0, shade(base, 1.0)], [0.75, shade(base, 0.75)], [1, shade(base, 0.6), 0]]);
    p.radial(cx - s.dx * br * 0.3, cy - s.dy * br * 0.3, br * 0.6, [[0, shade(base, 1.6, [0.7, 0.75, 0.4], 0.15), 0.6], [1, base, 0]]);
  }
  if (o.dead) p.circlePath(x, y, r * 0.9).fill([0.2, 0.15, 0.1], 0.5);
}

/** Conifer from above (snowy optional). */
export function pine(p, R, x, y, r, o = {}) {
  const h = o.h || r * 3.5;
  p.shadow((() => { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pts.push(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); } return pts; })(), h, h * 0.15);
  const base = o.color || [0.1, 0.2, 0.13];
  for (let k = 3; k >= 1; k--) {
    const rr2 = (r * k) / 3, pts = [];
    const n = 9;
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + k; const d = i % 2 ? rr2 * 0.55 : rr2; pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    p.poly(pts).fill(shade(base, 0.8 + k * 0.1));
    if (o.snow) p.poly(pts).fill([0.9, 0.93, 0.97], 0.16 + 0.08 * (3 - k));
  }
  p.circlePath(x - p.sun.dx * r * 0.2, y - p.sun.dy * r * 0.2, r * 0.25).fill(o.snow ? [0.85, 0.9, 0.95] : shade(base, 1.6), 0.35);
}

/** Small puddle (reflective dark water). */
export function puddle(p, R, x, y, r, o = {}) {
  const pts = [];
  const n = 10;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const d = r * R.range(0.65, 1.1); pts.push(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d); }
  p.poly(pts).fill(o.color || [0.06, 0.07, 0.09], 0.85);
  p.poly(pts).stroke([0.5, 0.55, 0.6], 0.4, 0.3);
}

/** Manhole / drain cover. */
export function manhole(p, x, y) {
  p.circlePath(x, y, 2.6).fill([0.12, 0.12, 0.12]);
  p.circlePath(x, y, 2.6).stroke([0.3, 0.3, 0.28], 0.4, 0.8);
  for (let i = -2; i <= 2; i++) p.line([x - 2, y + i, x + 2, y + i], 0.3, [0.25, 0.25, 0.24], 0.7);
}

/** Shipping container from above (for yards, docks). */
export function container(p, x, y, rot, o = {}) {
  const w = o.w || 14, l = o.l || 36, h = o.h || 15;
  p.shadowBox(x, y, w, l, h + (o.z || 0), rot);
  const col = o.color || [0.55, 0.13, 0.08];
  p.at(x, y, rot, (c) => {
    c.fillStyle = css(o.rusty ? mix(col, [0.35, 0.18, 0.08], 0.5) : col);
    c.fillRect(-w / 2, -l / 2, w, l);
    c.strokeStyle = css(shade(col, 0.55)); c.lineWidth = 0.4;
    for (let yy = -l / 2 + 1.5; yy < l / 2; yy += 1.6) { c.beginPath(); c.moveTo(-w / 2 + 0.6, yy); c.lineTo(w / 2 - 0.6, yy); c.stroke(); }
    c.fillStyle = css(shade(col, 0.6)); c.fillRect(-w / 2, -l / 2, w, 1); c.fillRect(-w / 2, l / 2 - 1, w, 1);
    c.fillStyle = sheen(p, c, w, l, rot); c.fillRect(-w / 2, -l / 2, w, l);
  });
}

/** Wooden crate / pallet stack. */
export function crate(p, R, x, y, s, rot = 0, o = {}) {
  p.shadowBox(x, y, s, s, s * 0.8, rot);
  p.at(x, y, rot, (c) => {
    c.fillStyle = css(o.color || [0.5, 0.36, 0.2]); c.fillRect(-s / 2, -s / 2, s, s);
    c.strokeStyle = 'rgba(40,25,10,0.7)'; c.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-s / 2, -s / 2 + (i * s) / 4); c.lineTo(s / 2, -s / 2 + (i * s) / 4); c.stroke(); }
    c.strokeRect(-s / 2, -s / 2, s, s);
  });
}

/** Oil drum. */
export function drum(p, x, y, o = {}) {
  p.shadowCircle(x, y, 2.4, 6, 0, 8);
  p.circlePath(x, y, 2.4).fill(o.color || [0.2, 0.32, 0.5]);
  p.circlePath(x, y, 1.7).stroke([0, 0, 0], 0.3, 0.5);
  p.circlePath(x - 0.6, y + 0.6, 0.6).fill([0.05, 0.05, 0.05]);
}

/** Sandbag wall along a polyline (military positions). */
export function sandbags(p, pts, o = {}) {
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), n = Math.max(1, Math.round(len / 3.2));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      p.shadowBox(cx, cy, 3.4, 2.4, 4, a);
      p.at(cx, cy, a, (c) => { c.fillStyle = css(shade(o.color || [0.55, 0.48, 0.33], 0.85 + (k % 3) * 0.08)); c.beginPath(); c.roundRect(-1.7, -1.2, 3.4, 2.4, 1); c.fill(); });
    }
  }
}
