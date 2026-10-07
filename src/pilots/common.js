import { WORLD_W, WORLD_H } from '../core/constants.js';
import { FADE_OUT, FADE_FLICKER } from '../fx/Particles.js';

// Shared helpers for the M5 pilots (UPDATE_02 §4.6 player firing concepts):
// muzzle flashes at the barrel, jagged lightning strands, target picking,
// and the atlas scale for vehicle art.

export const UP = -Math.PI / 2;
export const TAU = Math.PI * 2;
export const W = WORLD_W;
export const H = WORLD_H;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Vehicle art resolution: 3 texels/unit on a 4096 atlas, less on 2048. */
export const shipScale = (atlas, s = 3) => (atlas.size >= 4096 ? s : s * 0.55);

/** Small muzzle flash at a barrel (§4.6: "small muzzle flashes at the ship"). */
export function muzzle(w, x, y, rgb, size = 12) {
  const H2 = w.fxHigh;
  const i = H2.spawn(w.F.glow, x, y, 0, -0.6, 4);
  if (i < 0) return;
  H2.size(i, size, size * 0.4);
  H2.color(i, rgb[0] * 2, rgb[1] * 2, rgb[2] * 2, rgb[0], rgb[1], rgb[2]);
  H2.look(i, 0.9, 1, FADE_OUT);
}

/** Burst of sparks (impact flares for heavy shots, ability pops). */
export function burst(w, x, y, rgb, n = 8, speed = 3, life = 16, size = 4) {
  w.explosions.sparks(x, y, n, rgb, speed, life, size);
}

/** Ring pulse particle (shockwave look without post-FX). */
export function ringPulse(w, x, y, rgb, r0, r1, life = 20, a = 0.8) {
  const H2 = w.fxHigh, i = H2.spawn(w.F.ring, x, y, 0, 0, life);
  if (i < 0) return;
  H2.size(i, r0 * 2, r1 * 2);
  H2.color(i, rgb[0] * 1.8, rgb[1] * 1.8, rgb[2] * 1.8, rgb[0], rgb[1], rgb[2]);
  H2.look(i, a, 1, FADE_OUT);
}

/** Drifting glow mote (feathers, petals, embers in abilities). */
export function mote(w, x, y, vx, vy, rgb, size = 6, life = 30, grav = 0, frame = null) {
  const H2 = w.fxHigh, i = H2.spawn(frame || w.F.glow, x, y, vx, vy, life);
  if (i < 0) return;
  H2.size(i, size, size * 0.3);
  H2.color(i, rgb[0] * 1.6, rgb[1] * 1.6, rgb[2] * 1.6, rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5);
  H2.phys(i, 0.98, grav);
  H2.look(i, 0.85, 1, FADE_FLICKER);
}

/** Live, on-screen enemies (optionally excluding bosses). */
export function targets(w, noBoss = false) {
  const out = [];
  for (const e of w.enemies.active) {
    if (!e.alive || e.untargetable || e.y < -10 || e.y > H + 10) continue;
    if (noBoss && (e.boss || e.ctrl || e.kind === 'bosspart')) continue;
    out.push(e);
  }
  return out;
}

/** Up to n enemies nearest to (x, y), closest first. */
export function nearestN(w, x, y, n, maxD = 1e9, exclude = null) {
  const list = targets(w).filter((e) => !exclude || !exclude.has(e));
  list.sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2));
  return list.filter((e) => (e.x - x) ** 2 + (e.y - y) ** 2 < maxD * maxD).slice(0, n);
}

/** Chain from (x, y) through up to `hops` enemies (each nearest to the previous). */
export function chainTargets(w, x, y, hops, reach = 160) {
  const seen = new Set(), out = [];
  let cx = x, cy = y;
  for (let k = 0; k < hops; k++) {
    const [e] = nearestN(w, cx, cy, 1, k === 0 ? 420 : reach, seen);
    if (!e) break;
    seen.add(e); out.push(e);
    cx = e.x; cy = e.y;
  }
  return out;
}

/**
 * Draw a jagged lightning strand between two points (render-time only;
 * `seed` keeps the jitter stable for a few frames).
 */
export function zap(b, F, x0, y0, x1, y1, rgb, width = 4, alpha = 1, seed = 0, segs = 8) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  let px = x0, py = y0;
  for (let k = 1; k <= segs; k++) {
    const t = k / segs;
    const j = k === segs ? 0 : Math.sin(seed * 12.9 + k * 78.2) * Math.min(14, len * 0.08);
    const qx = x0 + dx * t + nx * j, qy = y0 + dy * t + ny * j;
    const mx = (px + qx) / 2, my = (py + qy) / 2, l = Math.hypot(qx - px, qy - py), a = Math.atan2(qy - py, qx - px);
    b.draw(F.laser, mx, my, l + 2, width * 3, a, rgb[0], rgb[1], rgb[2], alpha * 0.6, 1);
    b.draw(F.laser, mx, my, l + 1, width, a, 2, 2, 2, alpha, 1);
    px = qx; py = qy;
  }
}

/** Full-screen tint wash (time-stop, divine light...). */
export function wash(b, F, rgb, a) {
  b.draw(F.white, W / 2, H / 2, W + 40, H + 40, 0, rgb[0], rgb[1], rgb[2], a, 1);
}

/**
 * Stun a regular enemy for `steps`: its AI (movement + fire schedule) pauses,
 * then resumes where it left off. Bosses and boss parts are never stunned
 * (their controllers own phases and transitions).
 */
export function stun(e, steps) {
  if (!e.alive || e.ctrl || e.boss || e.kind === 'bosspart' || !e.ai) return false;
  if (e.ai.stunned) { e.stunT = Math.max(e.stunT, steps); return true; }
  const ai = e.ai;
  e.stunT = steps;
  const wrap = (en) => { if (--en.stunT <= 0) en.ai = ai; };
  wrap.stunned = true; // the pool sets a fresh `ai` on every spawn
  e.ai = wrap;
  return true;
}
