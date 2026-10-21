import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT, FADE_INOUT, FADE_FLICKER } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { WF } from '../../world/tank/whiteFangModel.js';
import { TrackTrail } from '../../world/tank/TrackTrail.js';

// WHITE FANG runtime rig: the tank as a physical vehicle in the arena world.
//
//   Movement   world-space pose (x, y, heading), signed speed and turn rate
//              with acceleration / braking limits; it can only move along
//              its heading (no strafing), so lateral repositioning means
//              turning, driving and straightening out. Left / right track
//              travel follows v ± ω·half-gauge (pivot turns counter-rotate).
//   Weapons    twin railguns on a slewing turret, two yawing side cannons,
//              two elevating frost-mortar pods, the ram. Every projectile,
//              laser and telegraph starts at its weapon's muzzle, projected
//              from the 3D model to the gameplay plane each step.
//   Ground     tread ribbons (world space), snow spray at the track ends and
//              the ram, exhaust, contact shadow and planar sun shadow.
//   Parts      the four breakable mounts are BossKit parts whose hitboxes
//              ride the projected mounts; a broken mount stays broken for
//              the rest of the fight and its attacks stop.
//
// The BossController still owns HP, phases, transitions and the death
// timeline; this rig only replaces the 2D sprite and the easing movement.
// Without an arena world (no 3D pass) the rig runs the same logic on a flat
// orthographic camera and the boss keeps its 2D sprite.

const HOME_Y = 182;        // screen row of the hull centre
const HULL_Z = 30;
const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const DRIVE = {
  patrol: { vmax: 1.2, rev: 0.9, accel: 0.018, brake: 0.04, om: 0.008, dev: 0.2 },
  enter: { vmax: 3.0, rev: 1.0, accel: 0.05, brake: 0.045, om: 0.008, dev: 0.05 },
  ram: { vmax: 7.2, rev: 1.6, accel: 0.24, brake: 0.32, om: 0.0, dev: 0 },
  back: { vmax: 1.5, rev: 1.5, accel: 0.03, brake: 0.05, om: 0.008, dev: 0.2 },
};

const SPEC = {
  shard: { shape: 'kunai', color: 'blue', n: 5, spread: 0.5, speed: 3.3 },
  shardMk: { shape: 'kunai', color: 'cyan', n: 3, spread: 0.22, speed: 4.2 },
  frost: { shape: 'rice', color: 'cyan', n: 12, speed: 1.6 },
  icicleC: { shape: 'rice', color: 'cyan', n: 4, speed: 2.1 },
  icicleM: { shape: 'rice', color: 'blue', n: 3, speed: 2.4 },
  debris: { shape: 'rice', color: 'violet', n: 1, speed: 2.7, fixed: true },
};

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x; out[1] = -y; out[2] = 1; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx; out[1] = -sy; out[2] = h; return out; },
  frame() {},
};

const KEYS = ['x', 'y', 'h', 'tl', 'tr', 'bob', 'pitch', 'roll', 'ty', 'pop', 'popA'];

export class WhiteFangRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    this.s = { x: 0, y: 0, h: 0, tl: 0, tr: 0, bob: 0, pitch: 0, roll: 0, ty: 0, pop: 0, popA: 0, cy: [0, 0], el: [0, 0], rr: [0, 0], cr: [0, 0] };
    this.p = { ...this.s, cy: [0, 0], el: [0, 0], rr: [0, 0], cr: [0, 0] };
    this.v = 0; this.om = 0; this.acc = 0; this.popV = 0;
    this.goal = null;          // world [x, y] the tank drives to
    this.mode = 'enter';
    this.hold = false;         // stabilise (brake, no driving) for a weapon
    this.wp = { t: 0, sx: W / 2, sy: HOME_Y };
    this.charge = [0, 0];      // railgun capacitor charge
    this.vent = 0;             // residual heat on the coils (cool-down glow)
    this.sensor = 0.4;         // optic brightness (target acquisition)
    this.cannonAim = [0, 0];
    this.podT = [0, 0];        // pod elevation targets
    this.dead = { mortar: [false, false], cannon: [false, false] };
    this.partHp = {};
    this.partEnt = {};
    this.trail = new TrackTrail(36, 2);
    this.shells = [];
    this.walls = [];
    this.flashes = [];
    this.fires = [];
    this.rail = null; this.railQ = null; this.railAlt = 0;
    this.ram = null;
    this.mort = [null, null];
    this.spin = [0, 0, 0];
    this.t = 0;
    this.deathT = -1;
    this.wreck = false;
    this.placed = false;
    this.flash = 0;
    this.M = { world: new Float32Array(16), chassis: new Float32Array(16), hull: new Float32Array(16), turret: new Float32Array(16), rail: [new Float32Array(16), new Float32Array(16)], cannon: [new Float32Array(16), new Float32Array(16)], barrel: [new Float32Array(16), new Float32Array(16)], pod: [new Float32Array(16), new Float32Array(16)], tmp: new Float32Array(16), tmp2: new Float32Array(16), wheel: new Float32Array(16), pad: new Float32Array(16) };
    this.pr = [0, 0, 0, 0];
    this.wp3 = [0, 0, 0];
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get busy() { return !!(this.rail || this.ram || this.walls.length); }

  // ------------------------------------------------------------ binding

  /** Follow the arena's current world view (3D) or fall back to the flat camera. */
  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view) {
      if (this.view) { const i = this.view.extras.indexOf(this); if (i >= 0) this.view.extras.splice(i, 1); }
      this.view = v && v.cam ? v : null;
      this.cam = this.view ? this.view.cam : ORTHO;
      if (this.view) {
        this.view.extras.push(this);
        if (!this.wreck) this.view.speedTarget = 0; // the field holds still for the duel
      }
      if (this.placed) this.trail.clear();
      this.placed = false;
    }
    if (this.view) this.cam.frame(1);
  }

  /** Screen point → world point on the ground. */
  _world(sx, sy, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, this.view ? this.view.floorZ : 0, out) || out; }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, w = this.w, e = c.e, s = this.s;
    this._attach();
    if (!this.placed) {
      const p = this._world(W / 2, c.state === 'enter' ? -170 : HOME_Y);
      s.x = p[0]; s.y = p[1]; s.h = 0; this.v = c.state === 'enter' ? 2.4 : 0;
      this.placed = true;
      Object.assign(this.p, { ...s, cy: [...s.cy], el: [...s.el], rr: [...s.rr], cr: [...s.cr] });
    }
    for (const k of KEYS) this.p[k] = s[k];
    for (const k of ['cy', 'el', 'rr', 'cr']) { this.p[k][0] = s[k][0]; this.p[k][1] = s[k][1]; }
    this.t++;
    this.trail.step();

    switch (c.state) {
      case 'enter': this.mode = 'enter'; this._goalScreen(W / 2, HOME_Y); break;
      case 'fight': this._fight(); break;
      case 'transition': this.mode = 'patrol'; this.goal = null; this._endAttacks(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._drive();
    this._suspension();
    this._weaponsAnim();
    this._pose(1);
    // Entity follows the hull (screen projection of its centre).
    const pc = this._scr(this.M.world, 0, 0, HULL_Z);
    e.x = pc[0]; e.y = pc[1];
    e.rot = -s.h;
    e.scale = this.pr[2] || 1;
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._updateRail();
    this._updateMortars();
    this._updateShells();
    this._updateWalls();
    this._updateRam();
    if (this.is3D) this._fx();
    for (let i = this.flashes.length - 1; i >= 0; i--) if (++this.flashes[i].t >= this.flashes[i].life) this.flashes.splice(i, 1);
    this.spiralOn = false; // re-armed by the spiral attack on the next step
  }

  // ------------------------------------------------------------ fight AI

  _fight() {
    const c = this.c, w = this.w;
    if (this.ram) return; // the ram sequence owns movement
    this.mode = 'patrol';
    if (this.hold) { this.goal = null; return; }
    // Patrol: pick a firing position, drive there, stop, fire, move on.
    const wp = this.wp, ph = c.phase || {}, span = (ph.move && ph.move.span) || 80;
    wp.t--;
    if (wp.t <= 0) {
      const R = w.rng;
      let x = W / 2 + R.range(-span, span);
      if (Math.abs(x - wp.sx) < 40) x = clamp(wp.sx + R.sign() * R.range(50, 90), W / 2 - span, W / 2 + span);
      wp.sx = x; wp.sy = HOME_Y + R.range(-14, 22);
      wp.t = Math.round(R.range(170, 280) / (c.intensity || 1));
    }
    this._goalScreen(wp.sx, wp.sy);
  }

  _goalScreen(sx, sy) { this.goal = this._world(sx, sy, this.goal || [0, 0, 0]); }

  // ------------------------------------------------------------ physics

  _drive() {
    const s = this.s, D = DRIVE[this.mode] || DRIVE.patrol, g = this.goal;
    let vd = 0, hd = s.h;
    const base = 0;
    if (g && !this.hold && this.c.state !== 'dying') {
      const dx = g[0] - s.x, dy = g[1] - s.y, dist = Math.hypot(dx, dy);
      const fx = Math.sin(s.h), fy = -Math.cos(s.h);
      const along = dx * fx + dy * fy, dir = along >= 0 ? 1 : -1;
      if (dist > 2.5) {
        let want = dir > 0 ? Math.atan2(dx, -dy) : Math.atan2(-dx, dy);
        want = base + clamp(wrapA(want - base), -D.dev, D.dev);
        if (dist < 26) want = lerp(base, want, dist / 26);
        hd = want;
        const err = wrapA(hd - s.h);
        const stopV = Math.sqrt(2 * D.brake * Math.abs(along));
        vd = dir * Math.min(dir > 0 ? D.vmax : D.rev, stopV) * Math.max(0, Math.cos(err)) ** 3;
      } else hd = base;
    } else if (this.c.state !== 'dying') hd = this.hold ? s.h : base;
    // Turning: the hull swings slowly toward the wanted heading.
    const omD = clamp(wrapA(hd - s.h) * 0.06, -D.om, D.om);
    this.om += clamp(omD - this.om, -0.0011, 0.0011);
    if (D.om === 0) this.om *= 0.5;
    const dv = vd - this.v, rate = Math.abs(vd) > Math.abs(this.v) && Math.sign(vd || 1) === Math.sign(this.v || vd || 1) ? D.accel : D.brake;
    const v0 = this.v;
    this.v += clamp(dv, -rate, rate);
    if (Math.abs(this.v) < 0.003 && vd === 0) this.v = 0;
    this.acc = this.v - v0;
    s.h += this.om;
    s.x += Math.sin(s.h) * this.v;
    s.y += -Math.cos(s.h) * this.v;
    const half = WF.track.x;
    s.tl += this.v + this.om * half;
    s.tr += this.v - this.om * half;
  }

  _suspension() {
    const s = this.s, c = this.c, R = this.w.fxRng;
    const spd = Math.min(1.5, Math.abs(this.v));
    const bump = (Math.sin(s.tl * 0.13) + Math.sin(s.tr * 0.11 + 1.3)) * 0.5;
    const pitchT = clamp(this.acc * 6, -0.045, 0.045) + Math.sin(s.tl * 0.09) * 0.006 * spd;
    const rollT = clamp(-this.om * 2.5, -0.03, 0.03) + (Math.sin(s.tl * 0.07) - Math.sin(s.tr * 0.075)) * 0.005 * spd;
    s.pitch += (pitchT - s.pitch) * 0.12;
    s.roll += (rollT - s.roll) * 0.12;
    s.bob += (bump * 0.8 * spd - s.bob) * 0.2;
    // Engine shudder: wind-up, phase breaks, dying.
    const shake = c.state === 'transition' ? 0.8 * (1 - c.st / 144) : c.state === 'dying' ? 1 : this.ram && this.ram.phase === 'windup' ? 0.7 : 0;
    if (shake) { s.bob += R.range(-0.6, 0.6) * shake; s.pitch += R.range(-0.004, 0.004) * shake; s.roll += R.range(-0.004, 0.004) * shake; }
    if (s.popA || this.popV) {
      this.popV -= 0.32;
      s.pop = Math.max(0, s.pop + this.popV);
      if (s.pop === 0 && this.popV < 0) { this.popV = Math.abs(this.popV) > 2 ? -this.popV * 0.25 : 0; }
      if (this.popV) s.popA += 0.06;
    }
  }

  /** Slew the turret / cannons, settle recoil, raise and stow the pods. */
  _weaponsAnim() {
    const s = this.s, w = this.w;
    const tgt = this._world(w.aimX, w.aimY, this.wp3);
    // Turret: the railguns track the player (slower while charging, locked when firing).
    const R = this.rail;
    if (this.c.state === 'fight' || this.c.state === 'enter') {
      const rate = R ? (R.phase === 'fire' ? 0 : R.phase === 'charge' ? 0.006 : 0.022) : 0.012;
      const want = clamp(this._yawTo(WF.turret, tgt), -0.62, 0.62);
      s.ty += clamp(wrapA(want - s.ty), -rate, rate);
      for (let i = 0; i < 2; i++) {
        if (this.dead.cannon[i]) continue;
        const wa = clamp(this._yawTo(WF.cannons[i], tgt), -1.25, 1.25);
        s.cy[i] += clamp(wrapA(wa - s.cy[i]), -0.045, 0.045);
        this.cannonAim[i] = Math.abs(wrapA(wa - s.cy[i]));
      }
    } else if (this.c.state === 'dying') s.ty += 0.004 * Math.sin(this.t * 0.05);
    for (let i = 0; i < 2; i++) {
      s.rr[i] *= 0.86; s.cr[i] *= 0.8;
      const el = this.dead.mortar[i] ? 0 : this.podT[i];
      s.el[i] += clamp(el - s.el[i], -0.04, 0.04);
    }
    this.vent = Math.max(0, this.vent - 0.006);
    this.sensor += ((R ? 1.4 : this.ram ? 1.2 : 0.45) - this.sensor) * 0.08;
  }

  /** Yaw (my Rz convention) that points a hull-mounted pivot at world point t. */
  _yawTo(pivot, t) {
    const s = this.s, cs = Math.cos(s.h), sn = Math.sin(s.h);
    const dx = t[0] - s.x, dy = t[1] - s.y;
    const lx = dx * cs + dy * sn - pivot[0], ly = dx * sn - dy * cs - pivot[1];
    return Math.atan2(-lx, ly);
  }

  // ------------------------------------------------------------- pose

  /** Fill this.M with the part matrices at render alpha. */
  _pose(alpha) {
    const s = this.s, p = this.p, M = this.M, T = M.tmp, T2 = M.tmp2;
    const L = (k) => lerp(p[k], s[k], alpha);
    const x = L('x'), y = L('y'), h = p.h + wrapA(s.h - p.h) * alpha;
    const z0 = this.view ? this.view.floorZ : 0;
    const cs = Math.cos(h), sn = Math.sin(h), Wm = M.world;
    Wm.fill(0); Wm[0] = cs; Wm[1] = sn; Wm[4] = sn; Wm[5] = -cs; Wm[10] = 1; Wm[12] = x; Wm[13] = y; Wm[14] = z0; Wm[15] = 1;
    M.chassis.set(Wm);
    // Hull on its suspension (pivot ~18 units up).
    M4.mul(Wm, M4.trans(0, 0, L('bob') + 18, T), M.hull);
    M4.mul(M.hull, M4.rotX(L('pitch'), T), M.hull);
    M4.mul(M.hull, M4.rotY(L('roll'), T), M.hull);
    M4.mul(M.hull, M4.trans(0, 0, -18, T), M.hull);
    // Turret (+ the death "pop": blown up off its race and tumbling).
    M4.mul(M.hull, M4.trans(WF.turret[0], WF.turret[1], WF.turret[2] + L('pop'), T), M.turret);
    M4.mul(M.turret, M4.rotZ(L('ty'), T), M.turret);
    const pa = L('popA');
    if (pa) { M4.mul(M.turret, M4.rotX(Math.sin(pa) * 0.5, T), M.turret); M4.mul(M.turret, M4.rotY(pa * 0.35, T), M.turret); }
    for (let i = 0; i < 2; i++) {
      const rr = lerp(p.rr[i], s.rr[i], alpha), cr = lerp(p.cr[i], s.cr[i], alpha);
      M4.mul(M.turret, M4.trans(WF.rails[i][0], WF.rails[i][1] - rr * 9, WF.rails[i][2], T), M.rail[i]);
      M4.mul(M.hull, M4.trans(WF.cannons[i][0], WF.cannons[i][1], WF.cannons[i][2], T), M.cannon[i]);
      M4.mul(M.cannon[i], M4.rotZ(lerp(p.cy[i], s.cy[i], alpha), T2), M.cannon[i]);
      M4.mul(M.cannon[i], M4.trans(0, -cr * 5, 0, T), M.barrel[i]);
      M4.mul(M.hull, M4.trans(WF.mortars[i][0], WF.mortars[i][1], WF.mortars[i][2], T), M.pod[i]);
      M4.mul(M.pod[i], M4.rotX(lerp(p.el[i], s.el[i], alpha), T2), M.pod[i]);
    }
    this.alphaPose = { tl: L('tl'), tr: L('tr') };
  }

  /** Local point under matrix m → screen [sx, sy, k, depth] (also leaves the world point in this.wp3). */
  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.wp3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + screen-space firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    return { x: ax, y: ay, ang: Math.atan2(b[1] - ay, b[0] - ax) };
  }

  // ------------------------------------------------------------ parts

  isDestroyed(kind, i) { return this.dead[kind][i]; }

  partSpawned(kind, i, pe) {
    const key = `${kind}${i}`;
    if (this.partHp[key] !== undefined) pe.hp = Math.min(pe.hp, this.partHp[key]);
    pe.maxHp = pe.maxHp || pe.hp;
    this.partEnt[key] = pe;
    if (this.is3D) pe.f = null;
  }

  partCleared(kind, i, part) { this.partHp[`${kind}${i}`] = part.e.hp; }

  partDestroyed(kind, i) {
    const w = this.w;
    this.dead[kind][i] = true;
    const m = kind === 'mortar' ? this.M.pod[i] : this.M.cannon[i];
    const p = this._scr(m, 0, kind === 'mortar' ? 18 : 0, 8), x = p[0], y = p[1];
    w.explosions.blast(x, y, 1.3, [0.6, 0.85, 1]);
    w.explosions.schedule(6, () => w.explosions.blast(x + w.fxRng.range(-14, 14), y + w.fxRng.range(-10, 10), 0.8, [1, 0.5, 0.2]));
    w.explosions.sparks(x, y, 26, [1, 0.75, 0.35], 6, 30, 4);
    w.g.camera.addTrauma(0.3);
    w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35);
    const shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < 10; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(50, 80));
      if (j < 0) continue;
      L.size(j, R.range(7, 13)); L.color(j, 0.85, 0.88, 0.92, 0.3, 0.3, 0.32); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
    sfx.play('partDown', { pan: (x - W / 2) / W });
    this.fires.push({ kind, i, s: kind === 'mortar' ? 0.9 : 0.6 });
    if (kind === 'mortar') { this.mort[i] = null; this.podT[i] = 0; }
  }

  /** Mount hitboxes ride the projected 3D mounts. */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const d = part.d, i = d.side, pe = part.e;
      const m = d.mount === 'mortar' ? this.M.pod[i] : this.M.cannon[i];
      const q = this._scr(m, 0, d.mount === 'mortar' ? 16 : 2, 8);
      pe.x = q[0]; pe.y = q[1];
      if (this.is3D) pe.f = null;
    }
  }

  /** Body contact: the hull footprint as a screen quad (also crushes ground units while ramming). */
  _contact() {
    const c = this.c, w = this.w, p = w.player;
    if (c.state !== 'fight') return;
    const M = this.M.chassis, q = [];
    for (const [lx, ly] of [[-100, -146], [100, -146], [100, 150], [-100, 150]]) { const a = this._scr(M, lx, ly, 14); q.push(a[0], a[1]); }
    this.quad = q;
    // Signed distances to the four edges (positive inside, whatever the screen winding).
    const sg = (q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0]) > 0 ? 1 : -1;
    const inside = (x, y, pad) => {
      for (let k = 0; k < 4; k++) {
        const ax = q[k * 2], ay = q[k * 2 + 1], bx = q[((k + 1) % 4) * 2], by = q[((k + 1) % 4) * 2 + 1];
        const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
        if (((ex * (y - ay) - ey * (x - ax)) / l) * sg < -pad) return false;
      }
      return true;
    };
    // The player must be clearly over the hull (a few units of grace at the edges).
    if (p && p.collidable && !p.invulnerable && inside(p.x, p.y, -4)) p.hit();
    if (this.ram && this.ram.phase === 'charge') {
      for (const en of w.enemies.active) {
        if (!en.alive || en === c.e || en.kind === 'bosspart' || !en.ground) continue;
        if (inside(en.x, en.y, en.r)) w.damage(en, 9999, 0);
      }
    }
  }

  // ---------------------------------------------------------- railguns

  /** Rail Lance: 'both' barrels together or 'alt' (one barrel, alternating). Queued while busy. */
  startRail(mode = 'both') {
    if (this.c.state !== 'fight') return false;
    if (this.rail || this.ram || this.walls.some((wl) => wl.t < wl.warn + 40)) { this.railQ = mode; return false; }
    const order = mode === 'alt' ? [this.railAlt++ % 2] : [0, 1];
    this.rail = { t: 0, phase: 'acquire', order, lasers: [] };
    this.railQ = null;
    return true;
  }

  _updateRail() {
    const R = this.rail, w = this.w, c = this.c;
    if (!R) { if (this.railQ && c.state === 'fight' && !this.ram) this.startRail(this.railQ); return; }
    if (c.state !== 'fight') { this.rail = null; this.hold = false; return; }
    R.t++;
    this.hold = true;
    const WARN = Math.round(56 / Math.min(1.25, c.intensity || 1)), FIRE = 22;
    if (R.phase === 'acquire') {
      const tgt = this._world(w.aimX, w.aimY, [0, 0, 0]);
      const err = Math.abs(wrapA(clamp(this._yawTo(WF.turret, tgt), -0.62, 0.62) - this.s.ty));
      if ((err < 0.04 && Math.abs(this.v) < 0.15) || R.t > 40) {
        R.phase = 'charge'; R.t = 0;
        for (const i of R.order) {
          const mz = this._muzzle(this.M.rail[i], WF.railMuzzle);
          R.lasers[i] = P.laser(w, c.e, mz.ang, { warn: WARN, fire: FIRE, width: 10, ox: mz.x - c.e.x, oy: mz.y - c.e.y, rgb: [0.55, 0.88, 1] });
        }
        sfx.play('railCharge', { pan: (c.e.x - W / 2) / W });
      }
      return;
    }
    // Keep each beam glued to its barrel (the turret still creeps while charging).
    for (const i of R.order) {
      const L = R.lasers[i];
      if (!L) continue;
      const mz = this._muzzle(this.M.rail[i], WF.railMuzzle);
      L.ox = mz.x - c.e.x; L.oy = mz.y - c.e.y;
      if (R.phase === 'charge') L.ang = mz.ang;
    }
    if (R.phase === 'charge') {
      for (const i of R.order) this.charge[i] = Math.min(1, R.t / WARN);
      if (R.t % 4 === 0) for (const i of R.order) {
        const mz = this._muzzle(this.M.rail[i], WF.railMuzzle), H2 = w.fxHigh, Rr = w.fxRng;
        const a = Rr.angle(), d = Rr.range(16, 30), j = H2.spawn(w.F.spark, mz.x + Math.cos(a) * d, mz.y + Math.sin(a) * d, -Math.cos(a) * d / 9, -Math.sin(a) * d / 9, 9);
        if (j >= 0) { H2.size(j, 4, 1.5); H2.color(j, 1.2, 1.8, 2.4, 0.4, 0.8, 1.6); H2.look(j, 1, 1, FADE_OUT, 0.6); }
      }
      if (R.t >= WARN) {
        R.phase = 'fire'; R.t = 0;
        const post = w.g.renderer.post;
        for (const i of R.order) {
          this.s.rr[i] = 1; this.charge[i] = 0;
          const mz = this._muzzle(this.M.rail[i], WF.railMuzzle);
          this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 10, kind: 'rail' });
          w.explosions.sparks(mz.x, mz.y, 10, [0.7, 0.95, 1], 5, 18, 3);
          post.shockwave(mz.x, mz.y, 0.02, 0.025, 0.25);
        }
        this.s.pitch += 0.02;
        this.vent = 1;
        post.flash(0.7, 0.9, 1, 0.16, 0.06);
        w.g.camera.addTrauma(0.32);
        sfx.play('railFire', { pan: (c.e.x - W / 2) / W });
      }
    } else if (R.phase === 'fire') {
      if (R.t >= FIRE) { R.phase = 'cool'; R.t = 0; }
    } else if (R.phase === 'cool') {
      if (R.t > 36) { this.rail = null; this.hold = false; }
    }
  }

  // ----------------------------------------------------------- mortars

  /** Frost Slugs: each working pod raises, fires one heavy shell at a marked spot, stows. */
  mortarVolley() {
    if (this.c.state !== 'fight') return;
    const w = this.w;
    let k = 0;
    for (let i = 0; i < 2; i++) {
      if (this.dead.mortar[i] || this.mort[i]) continue;
      // First pod: where the player is; second: a lane beside it (moving sideways is the answer).
      const off = k === 0 ? 0 : w.rng.sign() * w.rng.range(70, 110);
      this.mort[i] = { t: -k * 18, tx: clamp(w.aimX + off, 40, W - 40), ty: clamp(w.aimY - w.rng.range(0, 40), H * 0.45, H - 40), fired: false };
      k++;
      if (this.c.mk >= 2) this.mort[i].extra = true;
    }
  }

  _updateMortars() {
    const w = this.w, c = this.c;
    for (let i = 0; i < 2; i++) {
      const m = this.mort[i];
      if (!m) { if (!this.spiralOn) this.podT[i] = 0; continue; }
      if (c.state !== 'fight' || this.dead.mortar[i]) { this.mort[i] = null; continue; }
      m.t++;
      if (m.t < 0) continue;
      this.podT[i] = 0.95;
      if (!m.fired && m.t >= 26) {
        m.fired = true;
        this._shell(i, m.tx, m.ty);
        if (m.extra) this._shell(i, clamp(m.tx + w.rng.sign() * 60, 40, W - 40), clamp(m.ty - 50, H * 0.4, H - 40), 14);
      }
      if (m.t > 70) this.mort[i] = null;
    }
  }

  /** Launch one shell from pod i toward screen point (tx, ty). */
  _shell(i, tx, ty, delay = 0) {
    const w = this.w, c = this.c;
    const mz = this._scr(this.M.pod[i], WF.mortarMouth[0], WF.mortarMouth[1], WF.mortarMouth[2]);
    const from = [this.wp3[0], this.wp3[1], this.wp3[2]];
    const to = this._world(tx, ty, [0, 0, 0]);
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const T = Math.round(62 + dist * 0.06) + delay;
    const hz = c.kit.hazard({
      type: 'circle', x: tx, y: ty, r: 40, warn: T, fire: 8, color: [0.5, 0.85, 1], crater: true,
      onFire: (h, ww) => {
        P.ring(ww, h.x, h.y, SPEC.frost, ww.rng.angle());
        ww.g.camera.addTrauma(0.2);
        this._snowBurst(h.x, h.y, 1.4);
        sfx.play('shellImpact', { pan: (h.x - W / 2) / W });
      },
    });
    this.shells.push({ hz, from, to, T, t: -delay, apex: 230 + dist * 0.15 });
    this.s.el[i] = Math.max(0, this.s.el[i] - 0.18); // kick
    this.flashes.push({ x: mz[0], y: mz[1], ang: -Math.PI / 2, t: 0, life: 8, kind: 'mortar' });
    if (this.is3D) for (let k = 0; k < 4; k++) this.view.fx._smoke(from[0], from[1], from[2] + 2, 0.55, 0.25, 1.4);
    w.g.camera.addTrauma(0.12);
    sfx.play('mortarLaunch', { pan: (mz[0] - W / 2) / W });
  }

  _updateShells() {
    const hz = this.c.kit.hazards;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const sh = this.shells[k];
      sh.t++;
      if (sh.t >= sh.T || !hz.includes(sh.hz)) { this.shells.splice(k, 1); continue; }
      if (sh.t > 0 && this.is3D && sh.t % 3 === 0) {
        const p = this._shellPos(sh, sh.t / sh.T);
        this.view.fx._steam(p[0], p[1], p[2], 0.35);
      }
    }
  }

  _shellPos(sh, u) {
    u = clamp(u, 0, 1);
    return [lerp(sh.from[0], sh.to[0], u), lerp(sh.from[1], sh.to[1], u), lerp(sh.from[2], sh.to[2], u) + 4 * sh.apex * u * (1 - u)];
  }

  // ------------------------------------------------------- icicle spiral

  /** Rotating icicle streams from the sensor launcher and every working mortar pod. */
  spiral(t) {
    const w = this.w, c = this.c;
    this.spiralOn = true;
    for (let i = 0; i < 2; i++) if (!this.dead.mortar[i] && !this.mort[i]) this.podT[i] = 0.55;
    if (this.rail && this.rail.phase !== 'cool') return;
    const k = (n) => Math.max(3, Math.round(n / ((c.intensity || 1) * (1 + 0.15 * (c.mk - 1)))));
    if (t % k(8) === 0) {
      const m = this._scr(this.M.turret, WF.sensor[0], WF.sensor[1], WF.sensor[2] + 2);
      this.spin[0] += 0.16;
      P.ring(w, m[0], m[1], SPEC.icicleC, this.spin[0]);
    }
    for (let i = 0; i < 2; i++) {
      if (this.dead.mortar[i] || t % k(11) !== (i * 5) % k(11)) continue;
      const m = this._scr(this.M.pod[i], WF.mortarMouth[0], WF.mortarMouth[1], WF.mortarMouth[2]);
      this.spin[1 + i] += i ? 0.13 : -0.13;
      P.ring(w, m[0], m[1], SPEC.icicleM, this.spin[1 + i]);
    }
  }

  // ------------------------------------------------------- side cannons

  /** Shard Fan: each working cannon fires a fan along its barrel when it bears. */
  cannonVolley(t) {
    const w = this.w, c = this.c;
    if (this.ram && this.ram.phase === 'windup') return;
    const k = Math.max(4, Math.round(56 / ((c.intensity || 1) * (1 + 0.15 * (c.mk - 1)))));
    for (let i = 0; i < 2; i++) {
      if (this.dead.cannon[i] || (t + i * (k >> 1)) % k !== 0) continue;
      const mz = this._muzzle(this.M.barrel[i], WF.cannonMuzzle);
      const sway = Math.sin(t * 0.031 + i * 2) * 0.22;
      P.fan(w, mz.x, mz.y, mz.ang + sway, SPEC.shard);
      if (c.mk >= 2) P.fan(w, mz.x, mz.y, mz.ang, SPEC.shardMk);
      this.s.cr[i] = 1;
      this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 7, kind: 'cannon' });
      if (this.is3D) { const q = this.wp3; this.view.fx._smoke(q[0], q[1], q[2], 0.35, 0.3, 0.6); }
      sfx.play('cannonFire', { pan: (mz.x - W / 2) / W });
    }
  }

  // --------------------------------------------------------- ram charge

  startRam() {
    if (this.c.state !== 'fight' || this.ram || this.rail || this.walls.length) return false;
    const w = this.w;
    const lane = clamp(w.aimX, 118, W - 118);
    this.ram = { phase: 'align', t: 0, lane };
    this.hold = false;
    return true;
  }

  _updateRam() {
    const r = this.ram, c = this.c, w = this.w, s = this.s;
    if (!r) return;
    if (c.state !== 'fight') { this.ram = null; return; }
    r.t++;
    const tipY = () => this._scr(this.M.chassis, 0, WF.length[1], 4)[1];
    switch (r.phase) {
      case 'align':
        this.mode = 'patrol';
        this._goalScreen(r.lane, HOME_Y - 16);
        if ((Math.hypot(this.goal[0] - s.x, this.goal[1] - s.y) < 5 && Math.abs(s.h) < 0.03 && Math.abs(this.v) < 0.1) || r.t > 110) {
          r.phase = 'windup'; r.t = 0;
          c.kit.hazard({ type: 'lane', x: r.lane, w: 236, warn: 54, fire: 46, lethal: false, color: [0.55, 0.85, 1], y0: tipY() - 10 });
          sfx.play('ramRev', { pan: (r.lane - W / 2) / W });
        }
        break;
      case 'windup':
        this.mode = 'patrol'; this.goal = null; this.hold = true;
        if (this.is3D && r.t % 4 === 0) for (const st of WF.stacks) { const q = M4.point(this.M.hull, st[0], st[1], st[2], [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.8, 0.9, 1.8); }
        w.g.camera.addTrauma(0.015);
        if (r.t >= 54) { r.phase = 'charge'; r.t = 0; this.hold = false; w.g.camera.addTrauma(0.3); }
        break;
      case 'charge':
        this.mode = 'ram';
        this._goalScreen(r.lane, H + 400);
        w.g.camera.addTrauma(0.05);
        // Snow and ice thrown off the plough (dodgeable debris).
        if (r.t % 6 === 0 && this.v > 3) {
          for (const sd of [-1, 1]) {
            const q = this._scr(this.M.chassis, sd * 104, 120, 6);
            P.shoot(w, q[0], q[1], Math.PI / 2 - sd * w.rng.range(0.6, 1.1), SPEC.debris.speed, SPEC.debris);
          }
        }
        if (tipY() > H - 26 || r.t > 90) {
          r.phase = 'brake'; r.t = 0;
          const q = this._scr(this.M.chassis, 0, WF.length[1] - 6, 2);
          this._snowBurst(q[0], q[1], 2.4);
          if (w.arena && w.arena.fx) w.arena.fx.impact(q[0], q[1], 30, { crater: false });
          w.g.camera.addTrauma(0.55);
          w.g.renderer.post.shockwave(q[0], q[1], 0.03, 0.02, 0.5);
          sfx.play('ramImpact', { pan: (q[0] - W / 2) / W });
        }
        break;
      case 'brake':
        this.mode = 'ram'; this.goal = null;
        if (Math.abs(this.v) < 0.05 && r.t > 10) { r.phase = 'recover'; r.t = 0; }
        break;
      case 'recover':
        this.mode = 'back'; this.goal = null;
        if (r.t > 34) { r.phase = 'return'; r.t = 0; }
        break;
      case 'return':
        this.mode = 'back';
        this._goalScreen(r.lane, HOME_Y);
        if (Math.hypot(this.goal[0] - s.x, this.goal[1] - s.y) < 6 || r.t > 360) { this.ram = null; this.wp.t = 30; }
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------- avalanche

  /** Avalanche: a rolling wall of snow from the top edge with one clear safe gap. */
  startAvalanche() {
    if (this.c.state !== 'fight' || this.ram || this.walls.length) return false;
    const w = this.w, gw = this.c.mk >= 2 ? 92 : 104;
    const gx = clamp(w.rng.chance(0.5) ? w.aimX + w.rng.sign() * w.rng.range(60, 150) : w.rng.range(80, W - 80), gw / 2 + 16, W - gw / 2 - 16);
    this.walls.push({ t: 0, warn: 84, y: -70, speed: 2.7, thick: 66, gap: [gx - gw / 2, gx + gw / 2] });
    sfx.play('avalanche');
    return true;
  }

  _updateWalls() {
    const w = this.w, p = w.player, c = this.c;
    for (let k = this.walls.length - 1; k >= 0; k--) {
      const wl = this.walls[k];
      if (c.state !== 'fight') { this.walls.splice(k, 1); continue; }
      wl.t++;
      if (wl.t < wl.warn) { if (wl.t % 20 === 0) w.g.camera.addTrauma(0.04); continue; }
      wl.y += wl.speed;
      w.g.camera.addTrauma(0.012);
      // Snow spray along the leading edge.
      const L = w.fxLow, R = w.fxRng;
      for (let n = 0; n < 3; n++) {
        const x = R.range(0, W);
        if (x > wl.gap[0] + 6 && x < wl.gap[1] - 6) continue;
        const j = L.spawn(w.r.frame('smoke'), x, wl.y + wl.thick * 0.45, R.range(-0.6, 0.6), R.range(1.5, 3.5), R.range(26, 44));
        if (j >= 0) { L.size(j, R.range(14, 22), R.range(30, 50)); L.color(j, 0.95, 0.97, 1, 0.8, 0.86, 0.95); L.phys(j, 0.96, 0); L.look(j, 0.55, 0, FADE_INOUT); }
      }
      if (p && p.collidable && !p.invulnerable && Math.abs(p.y - wl.y) < wl.thick * 0.42 + p.hitR && !(p.x - p.hitR > wl.gap[0] && p.x + p.hitR < wl.gap[1])) p.hit();
      if (wl.y > H + 90) this.walls.splice(k, 1);
    }
  }

  // --------------------------------------------------------- lifecycle

  /** Phase break / defeat: drop scheduled attacks (lasers are cleared by the controller). */
  _endAttacks() {
    this.rail = null; this.railQ = null; this.hold = false; this.ram = null;
    this.mort[0] = this.mort[1] = null;
    this.spiralOn = false;
    this.podT[0] = this.podT[1] = 0;
    this.shells.length = 0;
    this.walls.length = 0;
    this.charge[0] = this.charge[1] = 0;
  }

  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng;
    if (this.deathT < 0) { this.deathT = 0; this._endAttacks(); this.mode = 'ram'; }
    this.deathT++;
    this.goal = null;
    // Mounts cook off one after another (projected from the model).
    if (st % 13 === 0 && st < 108) {
      const pick = R.int(0, 5);
      const pt = pick < 2 ? this._scr(this.M.pod[pick], 0, 18, 10) : pick < 4 ? this._scr(this.M.cannon[pick - 2], 0, 0, 10) : this._scr(this.M.turret, R.range(-30, 30), R.range(-30, 30), 20);
      w.explosions.blast(pt[0], pt[1], R.range(0.7, 1.1), [1, 0.5, 0.2]);
    }
    if (st === 112) {
      // Final breach: the turret is blown off its race.
      this.popV = 7.5; this.s.popA = 0.01;
      const q = this._scr(this.M.turret, 0, 0, 10);
      w.explosions.blast(q[0], q[1], 2.6, [1, 0.6, 0.25]);
      w.g.camera.addTrauma(0.8);
      if (this.is3D) {
        const fx = this.view.fx, s = this.s;
        fx.decal('scorch', s.x, s.y, 0.45, 300, R.angle(), 9000);
        for (const [lx, ly, sc] of [[0, -100, 1.5], [-40, 40, 1.1], [44, -20, 1.2], [-70, -120, 0.8], [62, 60, 0.9]]) {
          const p = M4.point(this.M.hull, lx, ly, 48, [0, 0, 0]);
          fx.addFire(p[0], p[1], p[2], sc, 5400);
        }
      }
    }
    if (st > 112) this.wreck = true;
    if (st === 130 && this.view) this.view.speedTarget = this.view.baseSpeed; // the advance resumes
  }

  // ---------------------------------------------------------- world fx

  /** Snow / ice burst at a screen point (impacts, the ram). */
  _snowBurst(sx, sy, s = 1) {
    const w = this.w, L = w.fxLow, H2 = w.fxHigh, R = w.fxRng;
    for (let k = 0; k < 10 * s; k++) {
      const a = R.angle(), sp = R.range(0.6, 2.6) * s;
      const j = L.spawn(w.r.frame('smoke'), sx, sy, Math.cos(a) * sp, Math.sin(a) * sp * 0.7, R.range(30, 55));
      if (j >= 0) { L.size(j, 10 * s, 34 * s); L.color(j, 0.95, 0.97, 1, 0.75, 0.82, 0.9); L.phys(j, 0.93, 0); L.look(j, 0.6, 0, FADE_INOUT); }
    }
    const shards = w.explosions.f.shards;
    for (let k = 0; k < 12 * s; k++) {
      const a = R.angle(), sp = R.range(2, 5) * s;
      const j = H2.spawn(shards[k % shards.length], sx, sy, Math.cos(a) * sp, Math.sin(a) * sp - 1, R.range(24, 40));
      if (j >= 0) { H2.size(j, R.range(3, 6)); H2.color(j, 1.3, 1.6, 2, 0.6, 0.8, 1.2); H2.phys(j, 0.95, 0.1); H2.spin(j, R.angle(), R.range(-0.3, 0.3)); H2.look(j, 1, 1, FADE_OUT); }
    }
  }

  /** Spray, exhaust, tread prints, burning mounts (world space). */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, s = this.s, M = this.M, c = this.c;
    const P2 = fx.p, F = fx.F;
    // Tread prints from both tracks' contact centres.
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1, q = M4.point(M.chassis, side * WF.track.x, -10, 0, [0, 0, 0]);
      this.trail.add(k, q[0], q[1], k ? s.tr : s.tl, !this.wreck);
    }
    this.trail.trim(this.cam.cy - 1200);
    // Snow thrown off the moving tracks (rear when advancing, front when reversing).
    for (let k = 0; k < 2; k++) {
      const vt = k ? s.tr - this.p.tr : s.tl - this.p.tl, a = Math.abs(vt);
      if (a < 0.2 || !R.chance(Math.min(0.9, a * 0.35))) continue;
      const side = k ? 1 : -1, end = vt > 0 ? WF.track.y0 - 6 : WF.track.y1 + 8;
      const q = M4.point(M.chassis, side * WF.track.x + R.range(-12, 12), end, 3, [0, 0, 0]);
      const bk = vt > 0 ? -1 : 1, d = M4.dir(M.chassis, R.range(-0.4, 0.4), bk * R.range(0.4, 1.1) * Math.min(3, a), 0, [0, 0, 0]);
      const i = P2.spawn(R.pick(F.dust), q[0], q[1], q[2], d[0], d[1], R.range(0.4, 1.2) * Math.min(2, a), R.range(40, 70));
      if (i >= 0) { P2.s0[i] = 6 + a * 2; P2.s1[i] = 18 + a * 6; P2.r[i] = 0.93; P2.g[i] = 0.95; P2.b[i] = 0.99; P2.r1[i] = 0.85; P2.g1[i] = 0.9; P2.b1[i] = 0.97; P2.a[i] = 0.6; P2.drag[i] = 0.95; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.03; }
      if (a > 2.5) fx._spark(q[0], q[1], q[2], 1);
    }
    // The ram ploughs snow aside when it drives forward hard.
    if (this.v > 1.6) {
      for (const sd of [-1, 1]) {
        if (!R.chance(Math.min(1, this.v * 0.18))) continue;
        const q = M4.point(M.chassis, sd * R.range(40, 104), R.range(120, 150), 4, [0, 0, 0]);
        const d = M4.dir(M.chassis, sd * R.range(1, 2.4), R.range(0.6, 1.6), 0, [0, 0, 0]);
        const i = P2.spawn(R.pick(F.dust), q[0], q[1], q[2], d[0], d[1], R.range(0.8, 2.2), R.range(50, 80));
        if (i >= 0) { P2.s0[i] = 14; P2.s1[i] = 46; P2.r[i] = P2.g[i] = 0.96; P2.b[i] = 1; P2.r1[i] = 0.86; P2.g1[i] = 0.9; P2.b1[i] = 0.97; P2.a[i] = 0.7; P2.drag[i] = 0.95; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.04; }
      }
    }
    // Exhaust: darker and denser under load.
    const load = Math.min(1, Math.abs(this.acc) * 30 + Math.abs(this.v) * 0.3 + (this.ram ? 0.6 : 0));
    if (!this.wreck && this.t % Math.max(3, Math.round(9 - load * 6)) === 0) {
      for (const st of WF.stacks) { const q = M4.point(M.hull, st[0], st[1], st[2], [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.45 + load * 0.4, 0.45 + load * 0.4, 1.2); }
    }
    // Coolant vapour after a railgun shot / sustained fire.
    if (this.vent > 0.3 && this.t % 5 === 0) for (const sd of [-1, 1]) { const q = M4.point(M.turret, sd * 28, -6, 24, [0, 0, 0]); fx._steam(q[0], q[1], q[2], 0.6 * this.vent); }
    // Broken mounts burn and spark; a battered hull smokes.
    for (const f of this.fires) {
      const m = f.kind === 'mortar' ? M.pod[f.i] : M.cannon[f.i];
      const q = M4.point(m, 0, f.kind === 'mortar' ? 14 : 0, 6, [0, 0, 0]);
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2], f.s, 0.9, 1.3);
      if (R.chance(0.04)) fx._spark(q[0], q[1], q[2], 6);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
    const frac = c.e.hp / Math.max(1, c.floors ? c.floors[0] + c.phases[0].hp : c.e.hp);
    if (frac < 0.45 && this.t % (frac < 0.2 ? 5 : 11) === 0) {
      const site = [[-40, -60], [44, 10], [-20, 70], [30, -110]][R.int(0, 3)];
      const q = M4.point(M.hull, site[0], site[1], 47, [0, 0, 0]);
      fx._smoke(q[0], q[1], q[2], 0.6, 0.85, 1.1);
    }
  }

  // ------------------------------------------------------------ render

  /** 3D pass (called by ArenaWorld inside its GL pass, depth-tested). */
  renderWorld(view, alpha) {
    if (view !== this.view) return;
    const s = this.s;
    if (this.wreck && this.c.state !== 'dying') {
      // Leave the wreck until it scrolls away behind the player.
      const q = this.cam.project(s.x, s.y, 0, this.pr);
      if (q[1] > H + 360) { const i = view.extras.indexOf(this); if (i >= 0) view.extras.splice(i, 1); return; }
    }
    const R = tankRenderer(view.wgl, view.qname);
    const cam = view.cam, M = this.M;
    this._pose(this.c.e.alive ? alpha : 1);
    // Light: the arena's sun azimuth, raised so the hull reads clearly from above.
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.82), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    // 1) Tread prints.
    const n = this.trail.build(view.floorZ + 1);
    R.trail(cam, this.trail.data, n, !!this.w.g.renderer.post.hdr);
    // 2) The tank.
    R.begin(cam, view.atmo, light);
    const dmg = this.wreck ? 1 : Math.min(0.75, (1 - this.c.e.hp / this._hp0()) * 0.9);
    const heat = this.wreck ? 0.35 + 0.15 * Math.sin(this.t * 0.2) : 0;
    const fl = this.flash * 0.2; // subtle: under sustained fire the hull flashes every step
    const P0 = this.alphaPose;
    R.draw('frame', M.chassis, { snow: 0.3, damage: dmg * 0.5 });
    R.draw('trackL', M.chassis, { scroll: [0, P0.tl / 72], snow: 0.1, damage: dmg * 0.3 });
    R.draw('trackR', M.chassis, { scroll: [0, P0.tr / 72], snow: 0.1, damage: dmg * 0.3 });
    for (const side of [-1, 1]) {
      const dist = side < 0 ? P0.tl : P0.tr;
      for (let k = 0; k < WF.wheels.length; k++) {
        const y = WF.wheels[k], end = k === 0 || k === WF.wheels.length - 1, r = end ? 12 : 9.6;
        M4.mul(M.chassis, M4.trans(side * (WF.track.x + WF.track.hw + 0.6), y, end ? WF.track.r : 10.4, M.tmp), M.wheel);
        M4.mul(M.wheel, M4.rotX(-dist / r, M.tmp), M.wheel);
        M4.mul(M.wheel, scaleM(side * 2.2, r, r, M.tmp), M.wheel);
        R.draw('wheel', M.wheel, { snow: 0.2, damage: dmg * 0.4 });
      }
    }
    const lamp = this.wreck ? 0 : this.c.state === 'dying' ? ((this.t >> 2) & 1) * 1.6 : this.ram ? 0.9 + 0.6 * ((this.t >> 3) & 1) : 0.35 + 0.35 * (Math.sin(this.t * 0.08) > 0.3 ? 1 : 0);
    R.draw('hull', M.hull, { glow: lamp, flash: fl, damage: dmg, heat });
    R.draw('turret', M.turret, { glow: this.wreck ? 0 : this.sensor + Math.max(this.charge[0], this.charge[1]) * 0.8, flash: fl, damage: dmg, heat });
    for (let i = 0; i < 2; i++) {
      const ch = this.charge[i], pulse = ch > 0 ? 0.6 + 0.4 * Math.sin(this.t * (0.5 + ch)) : 0;
      R.draw('rail', M.rail[i], { glow: this.wreck ? 0 : 0.25 + ch * 2.4 * pulse + this.vent * 0.6, flash: fl, damage: dmg, heat: heat + this.vent * 0.12 });
      const pc = this.partEnt[`cannon${i}`], pm = this.partEnt[`mortar${i}`];
      const cf = pc && pc.alive && pc.flash > 0 ? 1 : 0, mf = pm && pm.alive && pm.flash > 0 ? 1 : 0;
      const cd = pc && pc.alive && pc.maxHp ? 1 - pc.hp / pc.maxHp : 0, md = pm && pm.alive && pm.maxHp ? 1 - pm.hp / pm.maxHp : 0;
      if (this.dead.cannon[i]) R.draw('cannonWreck', M.cannon[i], { damage: 1, heat: 0.4 });
      else { R.draw('cannonBase', M.cannon[i], { glow: 0.6, flash: Math.max(fl, cf * 0.7), damage: Math.max(dmg, cd * 0.8) }); R.draw('cannonBarrel', M.barrel[i], { flash: cf * 0.5, damage: dmg }); }
      if (this.dead.mortar[i]) R.draw('mortarWreck', M.pod[i], { damage: 1, heat: 0.45 });
      else R.draw('mortarPod', M.pod[i], { glow: 0.4 + this.s.el[i] * 0.8, flash: Math.max(fl, mf * 0.7), damage: Math.max(dmg, md * 0.8) });
    }
    // 3) Contact occlusion + soft planar shadow (three jittered passes), drawn after the
    //    tank so the hull hides its own shadow; planes sit ~2 units up to stay clear of
    //    the terrain in the depth buffer.
    R.beginShadow(cam);
    M4.mul(M.chassis, M4.mul(M4.trans(0, 2, 0, M.tmp), scaleM(118, 166, 1, M.tmp2), M.tmp2), M.pad);
    R.contact(M.pad, 0.62, [0.3, 0.45], view.floorZ + 1.6);
    const items = this._items(true);
    const sh = 0.95, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < 3; k++) {
      const j = (k - 1) * 0.05, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], view.floorZ + 2 + k * 0.6, 0.27);
    }
    R.end();
    this._pose(1); // gameplay projections use the simulation pose
  }

  /** Parts casting shadows: [[mesh, matrix], ...]. */
  _items() {
    const M = this.M, out = [['hull', M.hull], ['turret', M.turret], ['rail', M.rail[0]], ['rail', M.rail[1]], ['trackL', M.chassis], ['trackR', M.chassis]];
    for (let i = 0; i < 2; i++) {
      out.push(this.dead.cannon[i] ? ['cannonWreck', M.cannon[i]] : ['cannonBase', M.cannon[i]]);
      if (!this.dead.cannon[i]) out.push(['cannonBarrel', M.barrel[i]]);
      out.push(this.dead.mortar[i] ? ['mortarWreck', M.pod[i]] : ['mortarPod', M.pod[i]]);
    }
    return out;
  }

  _hp0() {
    const c = this.c;
    return c.floors && c.phases ? c.floors[0] + c.phases[0].hp : c.e.hp || 1;
  }

  /** Under entities: shell shadows on the ground, avalanche shadow. */
  renderUnder(b, alpha) {
    const F = this.w.F;
    for (const sh of this.shells) {
      if (sh.t <= 0) continue;
      const u = (sh.t - 1 + alpha) / sh.T, g = this._shellPos(sh, u);
      const q = this.cam.project(g[0], g[1], this.view ? this.view.floorZ : 0, this.pr);
      const k = 1 - Math.min(1, (g[2] - sh.to[2]) / (sh.apex * 1.1));
      b.draw(F.glow, q[0], q[1], (10 + 14 * k) * q[2], (8 + 10 * k) * q[2], 0, 0, 0, 0, 0.25 + 0.45 * k, 0);
    }
    for (const wl of this.walls) {
      if (wl.t < wl.warn) continue;
      const y = wl.y + wl.thick * 0.7;
      for (const [x0, x1] of [[0, wl.gap[0]], [wl.gap[1], W]]) if (x1 > x0) b.draw(this.c.kit.F.white, (x0 + x1) / 2, y, x1 - x0, 30, 0, 0.1, 0.14, 0.22, 0.4, 0);
    }
  }

  /** Over entities (under bullets): shells, muzzle flashes, burning mounts, avalanche. */
  renderOver(b, alpha) {
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t;
    // Muzzle flashes.
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      if (f.kind === 'rail') {
        b.draw(F.glow, f.x, f.y, 70 * k, 70 * k, 0, 0.7, 1.4, 2.2, 0.9 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 26 * k, f.y + Math.sin(f.ang) * 26 * k, 60 * k, 18 * k, f.ang, 1.6, 2, 2.4, 0.9 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 40 * k, 6 * k, f.ang + s2 * Math.PI / 2, 1.2, 1.8, 2.4, 0.7 * k, 1);
      } else if (f.kind === 'cannon') {
        b.draw(F.glow, f.x, f.y, 34 * k, 34 * k, 0, 2, 1.2, 0.5, 0.8 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 10, f.y + Math.sin(f.ang) * 10, 28 * k, 9 * k, f.ang, 2.2, 1.5, 0.8, 0.9 * k, 1);
      } else {
        b.draw(F.glow, f.x, f.y, 46 * k, 46 * k, 0, 1.4, 1.5, 1.7, 0.8 * k, 1);
      }
    }
    // Frost shells in flight (grow as they climb toward the camera).
    for (const sh of this.shells) {
      if (sh.t <= 0) continue;
      const u = (sh.t - 1 + alpha) / sh.T, g = this._shellPos(sh, u), g2 = this._shellPos(sh, u + 0.02);
      const q = this.cam.project(g[0], g[1], g[2], this.pr), x = q[0], y = q[1], k = q[2];
      const q2 = this.cam.project(g2[0], g2[1], g2[2], [0, 0, 0, 0]);
      const ang = Math.atan2(q2[1] - y, q2[0] - x);
      b.draw(KF.laser, x - Math.cos(ang) * 14 * k, y - Math.sin(ang) * 14 * k, 34 * k, 9 * k, ang, 0.6, 1.2, 2, 0.7, 1);
      b.draw(F.glow, x, y, 26 * k, 26 * k, 0, 0.6, 1.1, 1.8, 0.8, 1);
      b.draw(KF.core, x, y, 8 * k, 8 * k, 0, 1.6, 1.9, 2.2, 1, 1);
    }
    // Burning mounts: flame tongues over the wreckage.
    for (const f of this.fires) {
      if (f.x === undefined) continue;
      const q = this.cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.i * 3);
      b.draw(F.glow, q[0], q[1], 30 * f.s * fl, 26 * f.s * fl, 0, 2, 0.7, 0.2, 0.55, 1);
      b.draw(F.glow, q[0] + Math.sin(t * 0.3) * 2, q[1] - 4, 14 * f.s * fl, 18 * f.s * fl, 0, 2.2, 1.4, 0.5, 0.6, 1);
    }
    // Avalanche: warning chevrons + gap markers, then the rolling wall.
    for (const wl of this.walls) {
      const [g0, g1] = wl.gap;
      if (wl.t < wl.warn) {
        const blink = (t >> 3) & 1 ? 1 : 0.45, k = wl.t / wl.warn;
        for (let x = 20; x < W; x += 40) {
          if (x > g0 && x < g1) continue;
          for (const s2 of [-1, 1]) b.draw(KF.laser, x + s2 * 6, 22 + k * 10, 16, 3, Math.PI / 2 + s2 * 0.8, 1.9, 1.9, 2.1, 0.65 * blink, 1);
        }
        b.draw(KF.white, W / 2, 6, W, 12, 0, 0.9, 0.95, 1, 0.25 * blink, 1);
        for (const gx of [g0, g1]) b.draw(KF.laser, gx, H / 2, H, 3, Math.PI / 2, 0.5, 1.6, 2.2, 0.45 * blink, 1);
        b.draw(KF.white, (g0 + g1) / 2, H / 2, g1 - g0, H, 0, 0.3, 0.9, 1.4, 0.06 * blink, 1);
        continue;
      }
      // The wall body: an opaque mass of snow with a powder cloud trailing it and
      // spray along the leading edge; the safe gap stays clear and outlined.
      const smoke = w.r.frame('smoke'), th = wl.thick;
      b.draw(KF.white, (g0 + g1) / 2, (wl.y + H) / 2, g1 - g0, H - wl.y, 0, 0.3, 0.9, 1.4, 0.1, 1);
      for (const [x0, x1] of [[-20, g0], [g1, W + 20]]) {
        if (x1 <= x0) continue;
        const cx = (x0 + x1) / 2, ww = x1 - x0;
        b.draw(KF.white, cx, wl.y - th * 1.1, ww, th * 1.4, 0, 0.8, 0.84, 0.92, 0.55, 0);      // powder cloud behind
        b.draw(KF.white, cx, wl.y - th * 0.05, ww, th * 0.85, 0, 0.66, 0.72, 0.84, 0.96, 0);   // shaded face of the wall
        b.draw(KF.white, cx, wl.y - th * 0.38, ww, th * 0.22, 0, 0.97, 0.98, 1, 0.95, 0);     // sunlit crest
        b.draw(KF.white, cx, wl.y + th * 0.42, ww, 10, 0, 0.12, 0.15, 0.22, 0.55, 0);        // leading-edge shadow
        b.draw(F.glow, cx, wl.y + th * 0.3, ww * 1.05, 22, 0, 1.0, 1.1, 1.25, 0.35, 1);
      }
      for (let x = -10; x < W + 20; x += 18) {
        if (x > g0 + 4 && x < g1 - 4) continue;
        for (let r = 0; r < 3; r++) {
          const jx = Math.sin(x * 0.37 + r * 2.1 + t * 0.21) * 6, jy = Math.cos(x * 0.21 + r * 1.3 + t * 0.17) * 8;
          const sz = 44 + r * 10 + Math.sin(x + r) * 8;
          b.draw(smoke, x + jx, wl.y - r * 18 + jy, sz, sz * 0.8, x * 0.1 + t * 0.02, 0.78 + r * 0.07, 0.82 + r * 0.06, 0.92 + r * 0.03, 0.85, 0);
        }
        b.draw(F.glow, x, wl.y + wl.thick * 0.35, 30, 14, 0, 1.2, 1.3, 1.45, 0.35, 1);
      }
      for (const gx of [g0, g1]) b.draw(KF.laser, gx, wl.y - th * 0.3, th * 2.6, 4, Math.PI / 2, 0.5, 1.6, 2.4, 0.9, 1);
    }
  }

  /** Called when the boss object is dropped (scene change). */
  dispose() {
    if (this.view) { const i = this.view.extras.indexOf(this); if (i >= 0) this.view.extras.splice(i, 1); this.view.speedTarget = null; }
  }
}

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

export { HOME_Y, TAU };
