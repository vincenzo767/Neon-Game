import { WORLD_W } from '../../core/constants.js';

// Movement scripts. Each mover is (e, w, p) where p holds the merged
// parameters (enemy defaults <- wave template overrides). Movers keep their
// state on e.data. Directional movers use p.dir (+1 = rightward).

/** Ground scroll speed in world px/step (matches the city shader near the bottom). */
export const GROUND_SPEED = 1.5;

export const MOVERS = {
  /** Enter to stopY, hover/sway for `hold` steps, then exit (down | up | side). */
  dive(e, w, p) {
    const d = e.data;
    if (!d.ph) {
      e.y += Math.max(p.minSpeed ?? 0.8, (p.stopY - e.y) * 0.05);
      if (e.y >= p.stopY - 1) { d.ph = 1; d.t0 = e.t; }
    } else if (d.ph === 1) {
      e.x += Math.sin((e.t - d.t0) * 0.035) * (p.sway ?? 0.5);
      if (e.t - d.t0 > p.hold) { d.ph = 2; d.v = 0; }
    } else {
      d.v = Math.min((d.v || 0) + 0.08, p.exitSpeed ?? 4);
      if (p.exit === 'up') e.y -= d.v;
      else if (p.exit === 'side') e.x += d.v * (e.x < WORLD_W / 2 ? -1 : 1);
      else e.y += d.v;
    }
  },

  /** Constant velocity with optional sine sway. */
  straight(e, w, p) {
    e.x += (p.vx || 0) + (p.amp ? Math.cos(e.t * p.freq) * p.amp * p.freq : 0);
    e.y += p.vy ?? 2;
  },

  /** Curving swoop: heading rotates by turn*dir each step. */
  swoop(e, w, p) {
    const d = e.data;
    if (d.ang === undefined) d.ang = p.ang ?? Math.PI / 2 - 0.6 * (p.dir || 1);
    d.ang += (p.turn ?? 0.012) * (p.dir || 1);
    e.x += Math.cos(d.ang) * p.speed;
    e.y += Math.sin(d.ang) * p.speed;
    if (p.face) e.rot = d.ang - Math.PI / 2;
  },

  /** Descend while weaving horizontally around the spawn x. */
  sine(e, w, p) {
    const d = e.data;
    if (d.x0 === undefined) d.x0 = e.x;
    e.y += p.speed ?? 1.6;
    e.x = d.x0 + Math.sin(e.t * (p.freq ?? 0.04) + (p.phase || 0)) * (p.amp ?? 50);
  },

  /** Cross the screen horizontally at a fixed height. */
  strafe(e, w, p) {
    e.x += (p.speed ?? 2) * (p.dir || 1);
    e.y += p.vy || 0;
    if (p.face) e.rot = (p.dir || 1) > 0 ? 0 : Math.PI;
  },

  /** Kamikaze: accelerate toward the player with a limited turn rate. */
  chase(e, w, p) {
    const d = e.data;
    if (d.ang === undefined) { d.ang = Math.PI / 2; d.spd = p.speed ?? 2; }
    if (e.t < (p.lockAfter ?? 200)) {
      let t = w.aimAngle(e.x, e.y) - d.ang;
      t = Math.atan2(Math.sin(t), Math.cos(t));
      const tr = p.turn ?? 0.05;
      d.ang += t > tr ? tr : t < -tr ? -tr : t;
    }
    d.spd = Math.min(d.spd + (p.accel ?? 0.1), p.max ?? 7);
    e.x += Math.cos(d.ang) * d.spd;
    e.y += Math.sin(d.ang) * d.spd;
    e.rot = d.ang - Math.PI / 2;
  },

  /** Big units: ease to stopY, drift side to side, leave after `hold`. */
  hover(e, w, p) {
    const d = e.data;
    if (d.x0 === undefined) d.x0 = e.x;
    if (!d.ph) {
      e.y += Math.max(0.5, (p.stopY - e.y) * 0.03);
      if (e.y >= p.stopY - 1) { d.ph = 1; d.t0 = e.t; }
    } else if (d.ph === 1) {
      const k = e.t - d.t0;
      e.x = d.x0 + Math.sin(k * (p.freq ?? 0.012)) * (p.amp ?? 60);
      e.y = p.stopY + Math.sin(k * 0.02) * 8;
      if (p.hold && k > p.hold) d.ph = 2;
    } else {
      e.y += (d.v = Math.min((d.v || 0) + 0.04, 2.5));
    }
  },

  /** Circle a centre point that slowly descends. */
  orbit(e, w, p) {
    const d = e.data;
    if (d.cx === undefined) { d.cx = p.cx ?? e.x; d.cy = p.cy ?? e.y; d.a = p.a0 || 0; }
    d.a += (p.speed ?? 0.03) * (p.dir || 1);
    d.cy += p.drift ?? 0.6;
    const r = Math.min(p.radius ?? 60, e.t * 1.2);
    e.x = d.cx + Math.cos(d.a) * r;
    e.y = d.cy + Math.sin(d.a) * r;
  },

  /** Ground units ride the scroll, plus their own road velocity. */
  ground(e, w, p) {
    e.y += GROUND_SPEED + (p.vy || 0);
    e.x += (p.vx || 0) + (p.amp ? Math.sin(e.t * (p.freq ?? 0.02)) * p.amp * (p.freq ?? 0.02) : 0);
  },
};

