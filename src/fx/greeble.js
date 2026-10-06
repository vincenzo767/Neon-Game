import { RNG } from '../core/RNG.js';

// Procedural greeble generator (UPDATE_02 §4.2 / §4.3).
//
// Decorates any vehicle or boss shape so large machines look built, not
// drawn: panel seams, rivet rows, hazard stripes, vents, exhaust ports, pipes,
// cable bundles, small idle lights, energy cores and turbine discs, plus the
// fake top-left key light every part gets.
//
// Conventions (same as all procedural art): Canvas2D in WORLD units, and the
// caller has translated the context so (0, 0) is the sprite centre. The
// caller clips to the hull shape before calling `greeble`; features are laid
// out in the right half and mirrored across x = 0 so machines read as
// designed rather than noisy.
//
// Palettes come from the faction data files (`faction.greeble`), so each
// syndicate's machines share a material language:
//   plate [dark, mid, light]  seam  hi (highlight)  rivet  hazard [a, b]
//   pipe [dark, mid, light]   cable [jacket, band]  light  core  vent
//
// `greeble` returns the idle lights it placed ({x, y, c, ph}, centre
// relative) so the runtime can blink them (bosses/look.js).

const TAU = Math.PI * 2;

export const rngFor = (seed) => new RNG(`greeble:${seed}`);

// ------------------------------------------------------------ materials

/** Horizontal metallic band gradient across [x0, x1] (curved-surface sheen). */
export function metal(ctx, pal, x0, x1, bands = 1) {
  const [d, m, l] = pal.plate;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  // A single bright band slightly left of centre (key light is top-left).
  g.addColorStop(0, d);
  g.addColorStop(0.22, m);
  g.addColorStop(0.4, l);
  g.addColorStop(0.55, m);
  if (bands > 1) { g.addColorStop(0.72, l); g.addColorStop(0.8, m); }
  g.addColorStop(1, d);
  return g;
}

/** Vertical variant for long hulls seen from above. */
export function metalV(ctx, pal, y0, y1) {
  const [d, m, l] = pal.plate;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, l);
  g.addColorStop(0.3, m);
  g.addColorStop(1, d);
  return g;
}

/**
 * Fake top-left key light over whatever is already drawn in the box
 * (source-atop, so it only shades existing pixels): lighter toward the top
 * left, darker toward the bottom right.
 */
export function keyLight(ctx, x0, y0, x1, y1, k = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(255,250,240,${0.22 * k})`);
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.45 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Embossed edge on the current path: light top-left lip, dark bottom-right lip. */
export function bevel(ctx, pal, w = 0.9) {
  ctx.save();
  ctx.lineWidth = w;
  ctx.strokeStyle = pal.hi;
  ctx.translate(-0.45, -0.45);
  ctx.stroke();
  ctx.translate(0.9, 0.9);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = '#030406';
  ctx.stroke();
}

/** Fill the current path as a lit armour plate. */
export function plateFill(ctx, pal, x0, x1, bands = 1) {
  ctx.fillStyle = metal(ctx, pal, x0, x1, bands);
  ctx.fill();
}

// ------------------------------------------------------------- features

export function rivetRow(ctx, pal, x0, y0, x1, y1, step = 4, r = 0.55) {
  const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.arc(x + 0.3, y + 0.3, r, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.rivet;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU); ctx.fill();
  }
}

/** Diagonal hazard stripes inside a box. */
export function hazard(ctx, pal, x, y, w, h, stripe = 3.2) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = pal.hazard[1]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pal.hazard[0];
  for (let k = -h; k < w + h; k += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x + k, y); ctx.lineTo(x + k + stripe, y); ctx.lineTo(x + k + stripe - h, y + h); ctx.lineTo(x + k - h, y + h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.6; ctx.strokeRect(x, y, w, h);
}

/** Slatted vent / exhaust grille with an optional hot glow behind it. */
export function vent(ctx, pal, x, y, w, h, glow = 0, vertical = w < h) {
  ctx.fillStyle = '#050608'; ctx.fillRect(x, y, w, h);
  if (glow > 0) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, pal.vent); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = glow; ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = pal.plate[1]; ctx.lineWidth = 0.7;
  ctx.beginPath();
  if (vertical) for (let k = x + 1.5; k < x + w - 0.5; k += 2) { ctx.moveTo(k, y + 0.5); ctx.lineTo(k, y + h - 0.5); }
  else for (let k = y + 1.5; k < y + h - 0.5; k += 2) { ctx.moveTo(x + 0.5, k); ctx.lineTo(x + w - 0.5, k); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.7; ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = pal.hi; ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
}

/** A run of pipe: cylinder shading across its width, with clamps. */
export function pipe(ctx, pal, x0, y0, x1, y1, r = 1.4, clamps = true) {
  const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.translate(x0, y0); ctx.rotate(a);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, pal.pipe[2]); g.addColorStop(0.35, pal.pipe[1]); g.addColorStop(1, pal.pipe[0]);
  ctx.fillStyle = g; ctx.fillRect(0, -r, len, r * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 0.5; ctx.strokeRect(0, -r, len, r * 2);
  if (clamps) {
    ctx.fillStyle = pal.plate[0];
    for (let k = 3; k < len - 1; k += 9) ctx.fillRect(k, -r - 0.5, 1.4, r * 2 + 1);
  }
  ctx.restore();
}

/** Bundle of cables sagging between two points. */
export function cables(ctx, pal, x0, y0, x1, y1, n = 3, sag = 4) {
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 1.3;
    ctx.beginPath();
    ctx.moveTo(x0 + o, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + o + sag, (y0 + y1) / 2 + sag * 0.5, x1 + o, y1);
    ctx.strokeStyle = '#020203'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = i === 1 ? pal.cable[1] : pal.cable[0]; ctx.lineWidth = 0.9; ctx.stroke();
  }
}

/** Turbine disc: shroud, blades, hub (static art; runtime may overlay a spinning copy). */
export function turbine(ctx, pal, x, y, r, blades = 10) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = metal(ctx, pal, x - r, x + r); ctx.fill();
  ctx.strokeStyle = '#020304'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.fillStyle = '#06080c'; ctx.fill();
  ctx.fillStyle = pal.plate[1];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.lineTo(x + Math.cos(a + 0.18) * r * 0.82, y + Math.sin(a + 0.18) * r * 0.82);
    ctx.lineTo(x + Math.cos(a + 0.42) * r * 0.8, y + Math.sin(a + 0.42) * r * 0.8);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y, r * 0.24, 0, TAU);
  ctx.fillStyle = metal(ctx, pal, x - r * 0.24, x + r * 0.24); ctx.fill();
  ctx.strokeStyle = '#020304'; ctx.lineWidth = 0.6; ctx.stroke();
}

/** Glowing energy core in a dark housing ring. */
export function core(ctx, pal, x, y, r, color = pal.core) {
  ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU);
  ctx.fillStyle = metal(ctx, pal, x - r * 1.25, x + r * 1.25); ctx.fill();
  ctx.strokeStyle = '#020304'; ctx.lineWidth = 0.8; ctx.stroke();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, '#05060a');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
}

/** Unlit lamp socket (the lit state is drawn at runtime). */
export function lamp(ctx, x, y, color, r = 1.1) {
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.55; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------- generator

/** Split a rect into panels (BSP), stopping at `min` size. */
function panels(R, x, y, w, h, min, out, depth = 0) {
  const canV = w > min * 2, canH = h > min * 2;
  if ((!canV && !canH) || depth > 5 || (depth > 1 && R.next() < 0.18)) { out.push([x, y, w, h]); return; }
  const vert = canV && (!canH || (w > h ? R.next() < 0.75 : R.next() < 0.3));
  if (vert) {
    const s = w * R.range(0.32, 0.68);
    panels(R, x, y, s, h, min, out, depth + 1); panels(R, x + s, y, w - s, h, min, out, depth + 1);
  } else {
    const s = h * R.range(0.32, 0.68);
    panels(R, x, y, w, s, min, out, depth + 1); panels(R, x, y + s, w, h - s, min, out, depth + 1);
  }
}

const overlaps = (a, list, pad = 1) => list.some((b) => a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] && a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1]);

/**
 * Decorate a region with mechanical detail. The caller has clipped to the
 * hull; `rect` = [x, y, w, h] in centre-relative units. With `mirror`, the
 * features are generated in the right half (x >= 0) and mirrored.
 *
 * opt: seed, mirror(true), panel(min panel size, 0 = off), rivets(0..1),
 *      vents, pipes, cables, hazards, lights, cores, turbines, glow(vent glow)
 * @returns {{lights: {x:number,y:number,c:string,ph:number}[]}}
 */
export function greeble(ctx, pal, rect, opt = {}) {
  const R = rngFor(opt.seed || 'x');
  const mirror = opt.mirror !== false;
  let [x, y, w, h] = rect;
  if (mirror) { const x1 = x + w; x = Math.max(0, x); w = x1 - x; }
  const draws = [];
  const used = [];
  const lights = [];

  // Panel seams + rivet rows.
  if (opt.panel) {
    const list = [];
    panels(R, x, y, w, h, opt.panel, list);
    for (const [px, py, pw, ph] of list) {
      const tint = R.next();
      const riv = R.next() < (opt.rivets ?? 0.4);
      draws.push(() => {
        if (tint < 0.22) { ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(px, py, pw, ph); }
        else if (tint > 0.86) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px, py, pw, ph); }
        ctx.strokeStyle = pal.seam; ctx.lineWidth = 0.7;
        ctx.strokeRect(px, py, pw, ph);
        ctx.strokeStyle = pal.hi; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.moveTo(px + 0.7, py + ph - 0.7); ctx.lineTo(px + 0.7, py + 0.7); ctx.lineTo(px + pw - 0.7, py + 0.7); ctx.stroke();
        if (riv) rivetRow(ctx, pal, px + 1.6, py + 1.6, px + pw - 1.6, py + 1.6, 3.6, 0.45);
      });
    }
  }

  const place = (fw, fh) => {
    for (let t = 0; t < 14; t++) {
      const r = [x + R.range(0, Math.max(0.1, w - fw)), y + R.range(0, Math.max(0.1, h - fh)), fw, fh];
      if (!overlaps(r, used)) { used.push(r); return r; }
    }
    return null;
  };

  for (let i = 0; i < (opt.cores || 0); i++) {
    const s = R.range(5, 8), r = place(s * 2.6, s * 2.6);
    if (r) draws.push(() => core(ctx, pal, r[0] + r[2] / 2, r[1] + r[3] / 2, s));
  }
  for (let i = 0; i < (opt.turbines || 0); i++) {
    const s = R.range(6, 10), r = place(s * 2.1, s * 2.1);
    if (r) draws.push(() => turbine(ctx, pal, r[0] + r[2] / 2, r[1] + r[3] / 2, s, 9));
  }
  for (let i = 0; i < (opt.vents || 0); i++) {
    const big = R.next() < 0.5, vw = big ? R.range(8, 14) : R.range(4, 7), vh = big ? R.range(4, 7) : R.range(8, 14);
    const r = place(vw, vh), glow = opt.glow ?? 0.5;
    if (r) draws.push(() => vent(ctx, pal, r[0], r[1], r[2], r[3], R.next() < 0.6 ? glow : 0));
  }
  for (let i = 0; i < (opt.hazards || 0); i++) {
    const r = place(R.range(8, 16), R.range(3, 5));
    if (r) draws.push(() => hazard(ctx, pal, r[0], r[1], r[2], r[3], 2.2));
  }
  for (let i = 0; i < (opt.pipes || 0); i++) {
    const vertical = R.next() < 0.6, len = R.range(14, 30), r = place(vertical ? 4 : len, vertical ? len : 4);
    if (r) {
      const n = R.int(1, 3);
      draws.push(() => {
        for (let k = 0; k < n; k++) {
          if (vertical) pipe(ctx, pal, r[0] + 1 + k * 2.4, r[1], r[0] + 1 + k * 2.4, r[1] + r[3], 0.95);
          else pipe(ctx, pal, r[0], r[1] + 1 + k * 2.4, r[0] + r[2], r[1] + 1 + k * 2.4, 0.95);
        }
      });
    }
  }
  for (let i = 0; i < (opt.cables || 0); i++) {
    const r = place(R.range(10, 22), R.range(6, 12));
    if (r) {
      const n = R.int(2, 4);
      draws.push(() => cables(ctx, pal, r[0], r[1], r[0] + r[2], r[1] + r[3], n, 3));
    }
  }
  for (let i = 0; i < (opt.lights || 0); i++) {
    const r = place(3, 3);
    if (!r) continue;
    const lx = r[0] + 1.5, ly = r[1] + 1.5, c = R.next() < 0.75 ? pal.light : '#ff3040', ph = R.next();
    lights.push({ x: lx, y: ly, c, ph });
    if (mirror) lights.push({ x: -lx, y: ly, c, ph: (ph + 0.5) % 1 });
    draws.push(() => lamp(ctx, lx, ly, c));
  }

  for (const d of draws) d();
  if (mirror) {
    ctx.save();
    ctx.scale(-1, 1);
    for (const d of draws) d();
    ctx.restore();
  }
  return { lights };
}

/** Parse '#rrggbb' to [r, g, b] in 0..1 (for runtime tints). */
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
