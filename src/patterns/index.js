import { WORLD_W } from '../core/constants.js';
import { COLOR_NAMES } from '../fx/sprites.js';
import { SKINNED_SHAPES } from '../fx/factionBullets.js';

// Bullet-pattern library.
//
// Every emitter takes a *spec* object (defined once as module-level data, so
// firing allocates nothing). Specs are scaled by the world's difficulty:
//   w.diff.density multiplies bullet counts, w.diff.speed multiplies speeds.
//
// Spec fields (all optional unless noted):
//   shape   'orb' | 'rice' | 'kunai' | 'bigorb'        (default 'orb')
//   color   bullet colour name (danger code)           (default 'red')
//   speed   px/step (required)
//   n       bullet count (rings / fans / curtains)
//   spread  total fan angle in radians
//   layers, dSpeed   stack N copies at increasing speeds (streams)
//   accel, angVel, minSpd, maxSpd   motion (decelerating / curving bullets)
//   homing, homingTime   turn rate toward the player's aim point, duration
//   split, splitAt       child spec + age at which the bullet bursts
//   scale, radius        visual scale / collision radius override
//   fixed   true = don't scale count by density

export const KIND_SPLIT = 1;

const CI = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i]));
const RADIUS = { orb: 3.2, rice: 2.6, kunai: 2.8, bigorb: 7 };
const TAU = Math.PI * 2;

const count = (w, s) => (s.fixed ? s.n : Math.max(1, Math.round((s.n || 1) * w.diff.density)));

/** Fire one bullet from spec s. Returns the bullet index or -1. */
export function shoot(w, x, y, ang, spd, s) {
  const B = w.bullets;
  const shape = s.shape || 'orb', color = s.color || 'red', sc = s.scale || 1;
  const k = w.diff.speed;
  // M7c: a regular enemy's small bullets wear its faction's shape (colour,
  // radius and behaviour unchanged; fx/factionBullets.js).
  const fac = w.FB && w.firing && !w.firing.boss && !w.firing.ctrl && w.firing.faction;
  const frame = fac && SKINNED_SHAPES.has(shape) && w.FB[fac] ? w.FB[fac][color] : w.BF[shape][color];
  const i = B.spawn(x, y, ang, spd * k, frame, CI[color], s.radius ?? RADIUS[shape] * sc, sc);
  if (i < 0) return -1;
  if (s.accel || s.angVel) B.motion(i, (s.accel || 0) * k, s.angVel || 0, (s.minSpd ?? 0) * k, (s.maxSpd ?? 99) * k);
  if (s.homing) { B.homing[i] = s.homing; B.aux[i] = s.homingTime || 60; }
  if (s.split) { B.kind[i] = KIND_SPLIT; B.maxAge[i] = s.splitAt || 60; B.ref[i] = s.split; }
  return i;
}

/** n bullets evenly around a circle. */
export function ring(w, x, y, s, base = 0) {
  const n = count(w, s);
  for (let k = 0; k < n; k++) stack(w, x, y, base + (k / n) * TAU, s);
}

/** n bullets across `spread` radians centred on `ang`. */
export function fan(w, x, y, ang, s) {
  const n = count(w, s);
  if (n === 1) { stack(w, x, y, ang, s); return; }
  const sp = s.spread || 0.5;
  for (let k = 0; k < n; k++) stack(w, x, y, ang + (k / (n - 1) - 0.5) * sp, s);
}

/** Fan aimed at the player (or the cloak decoy). */
export function aimed(w, x, y, s, offset = 0) { fan(w, x, y, w.aimAngle(x, y) + offset, s); }

/** One direction, optionally stacked into a stream of increasing speeds. */
export function stack(w, x, y, ang, s) {
  const layers = s.layers || 1;
  for (let l = 0; l < layers; l++) shoot(w, x, y, ang, s.speed + l * (s.dSpeed || 0.5), s);
}

/** Rotating ring: the base angle advances by s.turn each call (state kept on e.data). */
export function spiral(w, e, s, key = 'spiral') {
  const a = (e.data[key] = (e.data[key] || 0) + (s.turn || 0.2));
  ring(w, e.x, e.y, s, a);
}

/** A wall of bullets falling from the top with one gap the player must find. */
export function curtain(w, s) {
  const n = count(w, s);
  const gap = w.rng.int(1, n - 2);
  for (let k = 0; k < n; k++) {
    if (Math.abs(k - gap) <= (s.gap ?? 1)) continue;
    const x = ((k + 0.5) / n) * WORLD_W;
    shoot(w, x, -8, Math.PI / 2, s.speed, s);
  }
}

/** Random drops from the top edge. */
export function rain(w, s) {
  const n = count(w, s);
  for (let k = 0; k < n; k++) {
    shoot(w, w.rng.range(8, WORLD_W - 8), -8, Math.PI / 2 + w.rng.range(-0.15, 0.15), s.speed * w.rng.range(0.8, 1.2), s);
  }
}

/** Random-angle, random-speed spray (explosions, revenge bullets). */
export function burst(w, x, y, s) {
  const n = count(w, s);
  for (let k = 0; k < n; k++) shoot(w, x, y, w.rng.angle(), s.speed * w.rng.range(0.6, 1.2), s);
}

/** Telegraphed laser attached to an enemy (see World.enemyLaser). */
export function laser(w, e, ang, s) { return w.enemyLaser(e, ang, s); }

/** Split handler: bursts a child spec when a KIND_SPLIT bullet expires. */
export function splitBullet(w, i) {
  const B = w.bullets, child = B.ref[i];
  if (!child) return;
  const x = B.x[i], y = B.y[i];
  if (child.aimed) aimed(w, x, y, child);
  else ring(w, x, y, child, child.random ? w.rng.angle() : B.ang[i]);
}
