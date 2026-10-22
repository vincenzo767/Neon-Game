import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT, FADE_INOUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer, MINE_LOOK } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { IV, buildIronVein, wheelsOf } from '../../world/tank/ironVeinModel.js';
import { TrackTrail } from '../../world/tank/TrackTrail.js';
import { GroundScars, jagged } from '../../world/tank/GroundScars.js';
import { TL } from '../../world/tank/tankTextures.js';

// IRON VEIN runtime rig: the open-pit mining fortress as a physical machine.
//
//   Movement   world-space pose (x, y, heading), signed speed and turn rate
//              with low acceleration (it is enormous). It only moves along its
//              heading. Movement states: enter, advance (crawling forward with
//              the cutter in the ground), reposition (cutter raised, backing up
//              onto a new lane), excavate (stopped, cutter grinding), hold
//              (stabilised for a barrage), prep / charge / brake / recover (Bore
//              Charge), critical (overdrive), defeat. Six track units roll at
//              v ± ω·half-gauge; the texture, wheels and sprockets follow.
//   Cutter     the cutter head spins about its tilted axis with inertia (rpm
//              eases toward the state's target, reverses through zero). The
//              carrier pivots on its hinge (lower into the cut / raise) and
//              slides on the thrust rams; four hydraulic cylinders are spanned
//              between hull and carrier every frame, so they visibly extend and
//              compress. Engaged = lowered + spinning: the picks are in the
//              ground, debris sprays the way the bottom of the cutter is moving,
//              and the trench is laid down at the real contact point.
//   Ground     world-space ribbons: tread prints from the tracks, the
//              excavation trench along the cutter's path, cracks and molten
//              fissures (GroundScars); 3D rock spikes, boulders and rubble.
//   Weapons    two ore cannons (yaw, twin barrels recoil in turn), two spoil
//              conveyors (slew, belt runs), the cutter, two auxiliary chip
//              launchers, the deep-core drive. Every projectile, telegraph and
//              flash starts at its mechanism on the 3D model.
//   Parts      ore cannons, conveyors and the cutter drive are breakable BossKit
//              parts riding their projected mounts; a broken part stays broken
//              and its attacks stop (a dead cutter drive also ends drilling).
//
// The BossController keeps HP, phases, transitions and the death timeline.

const TIP_HOME = 330;      // screen row of the cutter tip at the top of a pass
const TIP_CUT = 62;        // how far one excavation pass advances
const TIP_Y = IV.length[1];
const SPAN = 30;           // lateral range of the passes (the benches start just outside it)
const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const DRIVE = {
  enter: { vmax: 2.6, rev: 1, accel: 0.03, brake: 0.034, om: 0.004, dev: 0.04 },
  advance: { vmax: 0.36, rev: 0.4, accel: 0.006, brake: 0.012, om: 0.0035, dev: 0.18 },
  reposition: { vmax: 0.8, rev: 0.8, accel: 0.01, brake: 0.018, om: 0.005, dev: 0.22 },
  critical: { vmax: 0.55, rev: 1.0, accel: 0.012, brake: 0.02, om: 0.006, dev: 0.24 },
  charge: { vmax: 5.4, rev: 1, accel: 0.11, brake: 0.2, om: 0, dev: 0 },
  back: { vmax: 1.1, rev: 1.1, accel: 0.016, brake: 0.026, om: 0.005, dev: 0.22 },
};

const SPEC = {
  chip: { shape: 'kunai', color: 'yellow', n: 3, spread: 0.3, speed: 3.0 },
  chipMk: { shape: 'rice', color: 'yellow', n: 2, spread: 0.18, speed: 3.6 },
  frag: { shape: 'bigorb', color: 'orange', n: 2, spread: 0.55, speed: 1.45 },
  spoil: { shape: 'orb', color: 'orange', n: 1, speed: 2.0 },
  spoilBig: { shape: 'bigorb', color: 'orange', n: 1, speed: 1.35, fixed: true },
  spoilFine: { shape: 'rice', color: 'yellow', n: 1, speed: 2.5 },
  shellFrag: { shape: 'rice', color: 'yellow', n: 7, speed: 2.0 },
  seismic: { shape: 'orb', color: 'orange', n: 1, speed: 2.4, fixed: true },
  erupt: { shape: 'orb', color: 'red', n: 5, speed: 1.5 },
  core: { shape: 'rice', color: 'red', n: 14, speed: 1.9 },
  boulderFrag: { shape: 'orb', color: 'orange', n: 8, speed: 1.7 },
  bounceFrag: { shape: 'rice', color: 'orange', n: 6, speed: 2.1 },
  aux: { shape: 'kunai', color: 'orange', n: 3, spread: 0.22, speed: 3.3 },
  debris: { shape: 'rice', color: 'orange', n: 1, speed: 2.6, fixed: true },
};

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x; out[1] = -y; out[2] = 1; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx; out[1] = -sy; out[2] = h; return out; },
  frame() {},
};

const KEYS = ['x', 'y', 'h', 'tl', 'tr', 'bob', 'pitch', 'roll', 'lift', 'thrust', 'spin', 'sag'];
const ARR = ['cy', 'vy', 'ay', 'belt', 'rc'];
const mat = () => new Float32Array(16);

export class IronVeinRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    this.s = { x: 0, y: 0, h: 0, tl: 0, tr: 0, bob: 0, pitch: 0, roll: 0, lift: 0.05, thrust: 0, spin: 0, sag: 0, cy: [0, 0], vy: [IV.convYaw[0], IV.convYaw[1]], ay: [0, 0], belt: [0, 0], rc: [0, 0, 0, 0] };
    this.p = { ...this.s };
    for (const k of ARR) this.p[k] = [...this.s[k]];
    this.v = 0; this.om = 0; this.acc = 0; this.slip = 0;
    this.goal = null;
    this.mode = 'enter';       // drive profile
    this.ms = 'enter';         // movement state (reported, drives FX)
    this.hold = 0;             // steps left of stabilisation for a weapon
    this.wp = { phase: 'reposition', t: 0, sx: W / 2 };
    // Cutter.
    this.rpm = 0; this.rpmT = 0.05;
    this.engage = 0;           // 0 raised .. 1 cutting (target for the carrier)
    this.thrustT = 0;
    this.hubGlow = 0.3;        // drive hub / core heat
    this.strain = 0;           // shudder of the carrier under load
    this.dist = 0;             // contact odometer (trench texture)
    // Weapons.
    this.cannonT = [null, null];       // per-cannon aim target (world) for crossfire
    this.heat = [0, 0];                // cannon heat glow
    this.barrelAlt = [0, 0];
    this.beltV = [0.4, 0.4];           // belt speeds (units / step)
    this.cyc = [0, Math.PI];           // spoil cyclone angles
    this.dead = { ore: [false, false], conv: [false, false], cutter: [false] };
    this.partHp = {};
    this.partEnt = {};
    this.fires = [];
    // Attacks in flight.
    this.heavy = null; this.queue = null;
    this.cf = null; this.sz = null; this.dc = null; this.cl = null; this.bore = null;
    this.flashes = []; this.lines = [];
    this.spikes = []; this.boulders = []; this.rubble = []; this.erupts = [];
    this.critical = false; this.odT = 0;
    // Ground marks.
    this.treads = new TrackTrail(42, 2);
    this.trench = new TrackTrail(132, 1);
    this.scars = new GroundScars();
    this.M = {
      world: mat(), chassis: mat(), hull: mat(), carrier: mat(), cutS: mat(), cutter: mat(),
      can: [mat(), mat()], bar: [mat(), mat(), mat(), mat()], conv: [mat(), mat()], aux: [mat(), mat()],
      tmp: mat(), tmp2: mat(), wheel: mat(), pad: mat(), span: mat(), rock: mat(),
    };
    this.t = 0;
    this.deathT = -1;
    this.wreck = false;
    this.placed = false;
    this.flash = 0;
    this.pr = [0, 0, 0, 0];
    this.wp3 = [0, 0, 0];
    this.q3 = [0, 0, 0];
    this.grindD = 0; this.clankD = 0;
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get cutterOK() { return !this.dead.cutter[0]; }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view) {
      if (this.view) { const i = this.view.extras.indexOf(this); if (i >= 0) this.view.extras.splice(i, 1); }
      this.view = v && v.cam ? v : null;
      this.cam = this.view ? this.view.cam : ORTHO;
      if (this.view) {
        this.view.extras.push(this);
        if (!this.wreck) this.view.speedTarget = 0; // the quarry holds still for the duel
      }
      this.treads.clear(); this.trench.clear(); this.scars.clear();
      this.spikes.length = 0; this.rubble.length = 0;
      this.placed = false;
    }
    if (this.view) this.cam.frame(1);
  }

  _world(sx, sy, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, this.view ? this.view.floorZ : 0, out) || out; }

  /** Goal for the model origin so that the cutter tip lands on screen point (sx, row). */
  _goalTip(sx, row) {
    const p = this._world(sx, row, this.q3);
    this.goal = this.goal || [0, 0, 0];
    this.goal[0] = p[0]; this.goal[1] = p[1] + TIP_Y; this.goal[2] = 0;
  }

  /** Current screen row of the cutter tip (ground level). */
  _tipRow() { return this._scr(this.M.chassis, 0, TIP_Y, 0)[1]; }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e, s = this.s;
    this._attach();
    if (!this.placed) {
      const row = c.state === 'enter' ? -40 : TIP_HOME;
      const p = this._world(c.state === 'enter' ? W / 2 : this.wp.sx, row);
      s.x = p[0]; s.y = p[1] + TIP_Y; s.h = 0; this.v = c.state === 'enter' ? 2.2 : 0;
      this.placed = true;
      for (const k of KEYS) this.p[k] = s[k];
    }
    for (const k of KEYS) this.p[k] = s[k];
    for (const k of ARR) for (let i = 0; i < s[k].length; i++) this.p[k][i] = s[k][i];
    this.t++;
    this.treads.step(); this.trench.step(); this.scars.step();

    switch (c.state) {
      case 'enter': this.mode = 'enter'; this.ms = 'enter'; this.engage = 0; this._goalTip(W / 2, TIP_HOME); break;
      case 'fight': this._fight(); break;
      case 'transition': this.mode = 'reposition'; this.ms = 'hold'; this.goal = null; this._endAttacks(); this.engage = 0; break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._drive();
    this._cutter();
    this._suspension();
    this._weaponsAnim();
    this._pose(1);
    // The entity rides the hull (screen projection of its centre deck).
    const pc = this._scr(this.M.hull, 0, -20, 60);
    e.x = pc[0]; e.y = pc[1];
    e.rot = -s.h;
    e.scale = this.pr[2] || 1;
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._critical();
    this._updateCrossfire();
    this._updateSeismic();
    this._updateDeepCore();
    this._updateCollapse();
    this._updateBore();
    this._runQueue();
    this._updateRocks();
    if (this.is3D) this._fx();
    this._sound();
    for (let i = this.flashes.length - 1; i >= 0; i--) if (++this.flashes[i].t >= this.flashes[i].life) this.flashes.splice(i, 1);
    for (let i = this.lines.length - 1; i >= 0; i--) if (++this.lines[i].t >= this.lines[i].life) this.lines.splice(i, 1);
    this.fanOn = false; this.cycOn = false;
  }

  // ------------------------------------------------------------ fight AI

  _fight() {
    const c = this.c, w = this.w, wp = this.wp;
    if (this.bore) return; // the bore charge owns movement
    if (this.hold > 0) {
      this.hold--;
      this.goal = null;
      this.mode = 'reposition';
      this.ms = this.engage > 0.5 ? 'excavate' : 'hold';
      return;
    }
    // Excavation passes: crawl forward with the cutter in the ground, then
    // lift it, back up onto a new lane and cut again.
    const span = ((c.phase && c.phase.move && c.phase.move.span) || SPAN);
    wp.t++;
    if (wp.phase === 'reposition') {
      this.mode = this.critical ? 'critical' : 'reposition';
      this.ms = this.critical ? 'critical' : 'reposition';
      this.engage = 0;
      this._goalTip(wp.sx, TIP_HOME);
      if ((Math.hypot(this.goal[0] - this.s.x, this.goal[1] - this.s.y) < 6 && Math.abs(this.v) < 0.2) || wp.t > 330) {
        wp.phase = 'advance'; wp.t = 0;
        wp.ax = clamp(wp.sx + w.rng.range(-26, 26), W / 2 - span, W / 2 + span);
      }
    } else {
      this.mode = this.critical ? 'critical' : 'advance';
      this.ms = this.critical ? 'critical' : 'advance';
      this.engage = this.cutterOK ? 1 : 0;
      this._goalTip(wp.ax, TIP_HOME + TIP_CUT * (this.critical ? 1.25 : 1));
      if ((Math.hypot(this.goal[0] - this.s.x, this.goal[1] - this.s.y) < 5 && Math.abs(this.v) < 0.1) || wp.t > Math.round(300 / (c.intensity || 1))) {
        wp.phase = 'reposition'; wp.t = 0;
        let x = W / 2 + w.rng.range(-span, span);
        if (Math.abs(x - wp.ax) < 30) x = clamp(wp.ax + w.rng.sign() * w.rng.range(36, 70), W / 2 - span, W / 2 + span);
        wp.sx = x;
      }
    }
  }

  /** Stabilise (brake to a stop) for n steps; cut = keep the cutter grinding. */
  stabilise(n, cut = false) {
    this.hold = Math.max(this.hold, n);
    if (cut && this.cutterOK) this.engage = 1;
    else if (!cut) this.engage = Math.min(this.engage, 0.3);
  }

  // ------------------------------------------------------------ physics

  _drive() {
    const s = this.s, D = DRIVE[this.mode] || DRIVE.reposition, g = this.goal;
    let vd = 0, hd = s.h;
    if (g && this.c.state !== 'dying') {
      const dx = g[0] - s.x, dy = g[1] - s.y, dist = Math.hypot(dx, dy);
      const fx = Math.sin(s.h), fy = -Math.cos(s.h);
      const along = dx * fx + dy * fy, dir = along >= 0 ? 1 : -1;
      if (dist > 2.5) {
        let want = dir > 0 ? Math.atan2(dx, -dy) : Math.atan2(-dx, dy);
        want = clamp(wrapA(want), -D.dev, D.dev);
        if (dist < 30) want *= dist / 30;
        hd = want;
        const err = wrapA(hd - s.h);
        const stopV = Math.sqrt(2 * D.brake * Math.abs(along));
        vd = dir * Math.min(dir > 0 ? D.vmax : D.rev, stopV) * Math.max(0, Math.cos(err)) ** 3;
      } else hd = 0;
    } else if (this.c.state !== 'dying') hd = this.hold > 0 ? s.h : 0;
    // Slew: the hull swings slowly toward the wanted heading (skid steer).
    const omD = clamp(wrapA(hd - s.h) * 0.05, -D.om, D.om);
    this.om += clamp(omD - this.om, -0.0008, 0.0008);
    if (D.om === 0) this.om *= 0.5;
    const dv = vd - this.v, rate = Math.abs(vd) > Math.abs(this.v) && Math.sign(vd || 1) === Math.sign(this.v || vd || 1) ? D.accel : D.brake;
    const v0 = this.v;
    this.v += clamp(dv, -rate, rate);
    if (Math.abs(this.v) < 0.002 && vd === 0) this.v = 0;
    this.acc = this.v - v0;
    s.h += this.om;
    s.x += Math.sin(s.h) * this.v;
    s.y += -Math.cos(s.h) * this.v;
    const half = IV.tracks[0].x;
    // Track slip (spinning up for the bore charge) turns the belts without moving the hull.
    s.tl += this.v + this.om * half + this.slip;
    s.tr += this.v - this.om * half + this.slip;
  }

  /** Cutter head: rpm inertia, carrier lift / thrust (hydraulics), contact. */
  _cutter() {
    const s = this.s, c = this.c;
    if (!this.cutterOK) { this.rpmT = c.state === 'dying' ? 0 : 0.012 * Math.sign(this.rpm || 1); this.engage = 0; }
    else if (c.state !== 'fight' || (!this.fanOn && !this.bore && !this.dc && !this.sz)) this.rpmT = (this.engage > 0.5 ? 0.11 : 0.045) * Math.sign(this.rpmT || 1);
    // Heavy rotor: rpm eases (and passes through zero when the cutter reverses).
    const dr = this.rpmT - this.rpm;
    this.rpm += clamp(dr, -0.004, 0.004);
    s.spin += this.rpm;
    // Carrier hydraulics: lower into the cut (front down), raise to travel.
    const liftT = this.c.state === 'dying' ? s.lift : 0.055 - 0.1 * Math.min(1.3, this.engage);
    s.lift += clamp(liftT - s.lift, -0.0016, 0.0016);
    s.thrust += clamp(this.thrustT - s.thrust, -0.35, 0.35);
    this.engaged = this.cutterOK && s.lift < -0.012 && Math.abs(this.rpm) > 0.05;
    // Carrier shudder under load.
    this.strain += ((this.engaged ? Math.min(1, Math.abs(this.rpm) * 5 + Math.abs(this.v) * 0.8) : 0) - this.strain) * 0.08;
    this.hubGlow += (((this.dc ? 1.6 : 0.35) + (this.critical ? 0.5 : 0) + Math.abs(this.rpm) * 2) - this.hubGlow) * 0.05;
    if (this.engaged) this.dist += Math.abs(this.v);
  }

  _suspension() {
    const s = this.s, c = this.c, R = this.w.fxRng;
    const spd = Math.min(1.5, Math.abs(this.v) * 2);
    const bump = (Math.sin(s.tl * 0.11) + Math.sin(s.tr * 0.09 + 1.3)) * 0.5;
    const pitchT = clamp(this.acc * 9, -0.03, 0.03) + Math.sin(s.tl * 0.07) * 0.004 * spd - this.strain * 0.006;
    const rollT = clamp(-this.om * 3, -0.025, 0.025) + (Math.sin(s.tl * 0.05) - Math.sin(s.tr * 0.055)) * 0.004 * spd;
    s.pitch += (pitchT - s.pitch) * 0.1;
    s.roll += (rollT - s.roll) * 0.1;
    s.bob += (bump * 0.6 * spd - s.bob) * 0.18;
    const shake = c.state === 'transition' ? 0.6 * (1 - c.st / 144) : c.state === 'dying' ? 1 : this.strain * 0.35 + (this.bore && this.bore.phase === 'prep' ? 0.6 : 0) + (this.dc && this.dc.phase === 'charge' ? 0.5 : 0);
    if (shake) { s.bob += R.range(-0.5, 0.5) * shake; s.pitch += R.range(-0.003, 0.003) * shake; s.roll += R.range(-0.003, 0.003) * shake; }
  }

  /** Slew cannons / aux toward their targets, settle recoil, run the belts. */
  _weaponsAnim() {
    const s = this.s, w = this.w, live = this.c.state === 'fight' || this.c.state === 'enter';
    const tgt = this._world(w.aimX, w.aimY, this.wp3);
    for (let i = 0; i < 2; i++) {
      if (live && !this.dead.ore[i]) {
        const t = this.cannonT[i] || tgt;
        const want = clamp(this._yawTo(IV.cannons[i], t), -1.4, 1.4);
        s.cy[i] += clamp(wrapA(want - s.cy[i]), -0.03, 0.03);
      }
      if (live) {
        const want = clamp(this._yawTo(IV.aux[i], tgt, true), -1.1, 1.1);
        s.ay[i] += clamp(wrapA(want - s.ay[i]), -0.05, 0.05);
      }
      // Conveyor booms sweep while the cyclone runs, drift back to rest otherwise.
      if (!this.dead.conv[i]) {
        const sweep = this.cycOn ? Math.sin(this.t * 0.035 + i * Math.PI) * 0.32 : 0;
        s.vy[i] += clamp(IV.convYaw[i] + sweep - s.vy[i], -0.012, 0.012);
        const bv = this.cycOn ? 2.4 : this.critical ? 1.2 : 0.45;
        this.beltV[i] += (bv - this.beltV[i]) * 0.03;
        s.belt[i] += this.beltV[i];
      }
      this.heat[i] = Math.max(0, this.heat[i] - 0.012);
    }
    for (let k = 0; k < 4; k++) s.rc[k] *= 0.84;
  }

  /** Yaw (local Rz convention) that points a mount at world point t. */
  _yawTo(pivot, t, onCarrier = false) {
    const s = this.s, cs = Math.cos(s.h), sn = Math.sin(s.h);
    const dx = t[0] - s.x, dy = t[1] - s.y;
    const py = pivot[1] + (onCarrier ? s.thrust : 0);
    const lx = dx * cs + dy * sn - pivot[0], ly = dx * sn - dy * cs - py;
    return Math.atan2(-lx, ly);
  }

  // ------------------------------------------------------------- pose

  _pose(alpha) {
    const s = this.s, p = this.p, M = this.M, T = M.tmp, T2 = M.tmp2;
    const L = (k) => lerp(p[k], s[k], alpha);
    const x = L('x'), y = L('y'), h = p.h + wrapA(s.h - p.h) * alpha;
    const z0 = this.view ? this.view.floorZ : 0;
    const cs = Math.cos(h), sn = Math.sin(h), Wm = M.world;
    Wm.fill(0); Wm[0] = cs; Wm[1] = sn; Wm[4] = sn; Wm[5] = -cs; Wm[10] = 1; Wm[12] = x; Wm[13] = y; Wm[14] = z0; Wm[15] = 1;
    M.chassis.set(Wm);
    // Hull on its suspension (pivot at the centre of mass), sagging when dying.
    M4.mul(Wm, M4.trans(0, -80, L('bob') + 22 - L('sag') * 6, T), M.hull);
    M4.mul(M.hull, M4.rotX(L('pitch') - L('sag') * 0.02, T), M.hull);
    M4.mul(M.hull, M4.rotY(L('roll') + L('sag') * 0.025, T), M.hull);
    M4.mul(M.hull, M4.trans(0, 80, -22, T), M.hull);
    // Carrier: thrust slide, then pivot on the hinge.
    const hg = IV.hinge;
    M4.mul(M.hull, M4.trans(0, L('thrust') + hg[1], hg[2], T), M.carrier);
    M4.mul(M.carrier, M4.rotX(L('lift'), T), M.carrier);
    M4.mul(M.carrier, M4.trans(0, -hg[1], -hg[2], T), M.carrier);
    const C = IV.cutter;
    M4.mul(M.carrier, M4.trans(C.c[0], C.c[1], C.c[2], T), M.cutS);
    M4.mul(M.cutS, M4.rotX(-C.tilt, T), M.cutS);
    M4.mul(M.cutS, M4.rotZ(lerp(p.spin, s.spin, alpha), T), M.cutter);
    for (let i = 0; i < 2; i++) {
      const cn = IV.cannons[i];
      M4.mul(M.hull, M4.trans(cn[0], cn[1], cn[2], T), M.can[i]);
      M4.mul(M.can[i], M4.rotZ(lerp(p.cy[i], s.cy[i], alpha), T2), M.can[i]);
      for (let j = 0; j < 2; j++) {
        const b = IV.cannonBarrels[j], r = lerp(p.rc[i * 2 + j], s.rc[i * 2 + j], alpha);
        M4.mul(M.can[i], M4.trans(b[0], b[1] - r * 7, b[2], T), M.bar[i * 2 + j]);
      }
      const cv = IV.conveyors[i];
      M4.mul(M.hull, M4.trans(cv[0], cv[1], cv[2], T), M.conv[i]);
      M4.mul(M.conv[i], M4.rotZ(lerp(p.vy[i], s.vy[i], alpha), T2), M.conv[i]);
      const ax = IV.aux[i];
      M4.mul(M.carrier, M4.trans(ax[0], ax[1], ax[2], T), M.aux[i]);
      M4.mul(M.aux[i], M4.rotZ(lerp(p.ay[i], s.ay[i], alpha), T2), M.aux[i]);
    }
    this.alphaPose = { tl: L('tl'), tr: L('tr'), b0: lerp(p.belt[0], s.belt[0], alpha), b1: lerp(p.belt[1], s.belt[1], alpha) };
  }

  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.wp3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    return { x: ax, y: ay, ang: Math.atan2(b[1] - ay, b[0] - ax) };
  }

  /** Point on the cutter rim at disc angle th (local; +y = toward the ground contact) → screen, plus its tangent angle. */
  _rim(th, out = {}) {
    const R = IV.cutter.R + 6, c = Math.cos(th), s = Math.sin(th), dir = Math.sign(this.rpm || 1);
    const a = this._scr(this.M.cutS, c * R, s * R, 4), ax = a[0], ay = a[1];
    const b = this._scr(this.M.cutS, c * R - s * 20 * dir, s * R + c * 20 * dir, 4);
    out.x = ax; out.y = ay; out.tan = Math.atan2(b[1] - ay, b[0] - ax);
    return out;
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

  _mountPt(kind, i) {
    if (kind === 'ore') return this._scr(this.M.can[i], 0, 4, 18);
    if (kind === 'conv') return this._scr(this.M.conv[i], 0, 34, 22);
    return this._scr(this.M.cutS, 0, 0, 40);
  }

  partDestroyed(kind, i) {
    const w = this.w, R = w.fxRng;
    this.dead[kind][i] = true;
    const p = this._mountPt(kind, i), x = p[0], y = p[1];
    const big = kind === 'cutter' ? 1.8 : 1.3;
    w.explosions.blast(x, y, big, [1, 0.55, 0.2]);
    w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-16, 16), y + R.range(-12, 12), 0.9, [1, 0.45, 0.15]));
    w.explosions.sparks(x, y, 30, [1, 0.7, 0.3], 6, 32, 4);
    w.g.camera.addTrauma(kind === 'cutter' ? 0.5 : 0.32);
    w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35);
    this._shards(x, y, 12);
    sfx.play('partDown', { pan: (x - W / 2) / W });
    if (kind === 'cutter') {
      sfx.play('engineFail', { pan: (x - W / 2) / W });
      this.engage = 0;
      if (this.bore && this.bore.phase !== 'return') this.bore.phase = 'brake';
      if (this.dc && this.dc.phase !== 'cool') { this.dc.phase = 'cool'; this.dc.t = 0; for (const f of this.dc.fis) if (f.scar) f.scar.glow = 0.2; }
    }
    if (kind === 'ore') this.cannonT[i] = null;
    this.fires.push({ kind, i, s: kind === 'cutter' ? 1 : 0.7 });
  }

  /** Mount hitboxes ride the projected 3D mounts. */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const d = part.d, pe = part.e;
      const q = this._mountPt(d.mount, d.side);
      pe.x = q[0]; pe.y = q[1];
      if (this.is3D) pe.f = null;
    }
  }

  /**
   * Contact: the hull footprint is solid; the cutter's disc only hurts while
   * it is spinning hard (its active window), not just because it is there.
   */
  _contact() {
    const c = this.c, w = this.w, p = w.player;
    if (c.state !== 'fight') { this.quad = null; return; }
    const M = this.M.chassis, q = [];
    for (const [lx, ly] of [[-126, -262], [126, -262], [126, 100], [-126, 100]]) { const a = this._scr(M, lx, ly, 20); q.push(a[0], a[1]); }
    this.quad = q;
    const hitOK = p && p.collidable && !p.invulnerable;
    if (hitOK && inQuad(q, p.x, p.y, -4)) { p.hit(); return; }
    // Cutter disc (projected centre + radius).
    const ctr = this._scr(this.M.cutS, 0, 0, 10), cx = ctr[0], cy = ctr[1], rr = IV.cutter.R * ctr[2] * 0.92;
    this.cutHit = Math.abs(this.rpm) > 0.1 && this.cutterOK;
    if (this.cutHit && hitOK && Math.hypot(p.x - cx, (p.y - cy) * 1.1) < rr) p.hit();
    if (this.bore && this.bore.phase === 'charge') {
      for (const en of w.enemies.active) {
        if (!en.alive || en === c.e || en.kind === 'bosspart' || !en.ground) continue;
        if (inQuad(q, en.x, en.y, en.r) || Math.hypot(en.x - cx, en.y - cy) < rr) w.damage(en, 9999, 0);
      }
    }
  }

  // ------------------------------------------------------- critical state

  _phaseFrac() {
    const c = this.c;
    if (!c.floors || !c.phase) return 1;
    return (c.e.hp - c.floors[c.index]) / Math.max(1, c.phase.hp);
  }

  /** Critical Overdrive: the last phase below 45 % (or a desperation phase). */
  _critical() {
    const c = this.c;
    if (this.critical || c.state !== 'fight' || !c.phases) return;
    const last = c.index === c.phases.length - 1 || (c.phase && c.phase.desperation);
    if (!last || !(c.phase && c.phase.overdrive)) return;
    if (this._phaseFrac() > 0.45 && !c.phase.desperation) return;
    this.critical = true; this.odT = 0;
    const w = this.w;
    if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'CRITICAL OVERDRIVE', desperation: true, boss: c.name });
    w.g.renderer.post.flash(1, 0.3, 0.1, 0.35, 0.03);
    w.g.camera.addTrauma(0.4);
    sfx.play('coreCharge', { pan: 0 });
    this._steam(1.6);
  }

  // ---------------------------------------------------------- heavy queue

  _canHeavy(name) {
    if (this.c.state !== 'fight') return false;
    if (this.heavy) { if (!this.queue && this.heavy !== name) this.queue = name; return false; }
    return true;
  }

  _heavyDone(name) { if (this.heavy === name) this.heavy = null; }

  _runQueue() {
    if (!this.queue || this.heavy || this.c.state !== 'fight') return;
    const q = this.queue;
    this.queue = null;
    if (q === 'crossfire') this.startCrossfire();
    else if (q === 'seismic') this.startSeismic();
    else if (q === 'deepcore') this.startDeepCore();
    else if (q === 'collapse') this.startCollapse();
    else if (q === 'bore') this.startBore();
  }

  get quiet() { return !!(this.bore && this.bore.phase === 'charge') || !!(this.dc && this.dc.phase === 'discharge'); }

  // -------------------------------------------- 1. ROTARY CUTTER FAN

  /** Spin up, then fling chips and fragments off the rim, sweeping to one side. */
  cutterFan(t, rate = 1) {
    const c = this.c, w = this.w;
    if (c.state !== 'fight' || this.bore || this.dc) return;
    const K = Math.round(170 / rate);
    if (!this.cutterOK) { this.auxBurst(t, rate * 0.8); return; }
    const ph = t % K, cyc = Math.floor(t / K), side = cyc & 1 ? 1 : -1;
    this.fanOn = true;
    this.engage = Math.max(this.engage, 1);
    if (ph < 44) {
      this.rpmT = 0.22 * side;                  // the cutter reverses into the new direction
      if (ph % 6 === 0 && this.is3D) { const q = this._contactW(); this.view.fx._spark(q[0], q[1], q[2] + 2, 3); }
      return;
    }
    this.rpmT = 0.22 * side;
    if (Math.abs(this.rpm) < 0.12 || Math.sign(this.rpm) !== side) return; // not up to speed yet
    const u = (ph - 44) / Math.max(1, K - 70);
    if (u > 1) return;
    const kk = Math.max(5, Math.round(8 / (1 + 0.15 * (c.mk - 1))));
    const th = Math.PI / 2 + side * (0.25 + 0.95 * u);       // bottom of the disc, sweeping out to the side
    if (ph % kk === 0) {
      const r = this._rim(th, this.rimO || (this.rimO = {}));
      // Thrown the way the rim moves, but always into the lower field (a fan the pilot can read).
      const ang = clamp(wrapA(lerp(Math.PI / 2, wrapA(r.tan), 0.5) + side * 0.2), Math.PI / 2 - 1.0, Math.PI / 2 + 1.0);
      P.fan(w, r.x, r.y, ang, SPEC.chip);
      if (c.mk >= 2) P.fan(w, r.x, r.y, ang - side * 0.4, SPEC.chipMk);
      if (this.is3D && ph % (kk * 2) === 0) this._gravel(1.2);
    }
    if (ph % 18 === 9) {
      const r = this._rim(th + side * 0.3, this.rimO);
      P.fan(w, r.x, r.y, Math.PI / 2 + side * (0.15 + 0.5 * u), SPEC.frag);
      sfx.play('rockChip', { pan: (r.x - W / 2) / W });
    }
  }

  /** Auxiliary chip launchers: aimed narrow bursts from both pods. */
  auxBurst(t, rate = 1, force = false) {
    const c = this.c, w = this.w;
    if (c.state !== 'fight' || (this.quiet && !force)) return;
    const K = Math.max(20, Math.round(64 / rate));
    for (let i = 0; i < 2; i++) {
      if (!force && (t + i * (K >> 1)) % K !== 0) continue;
      const mz = this._muzzle(this.M.aux[i], IV.auxMuzzle);
      P.fan(w, mz.x, mz.y, mz.ang, SPEC.aux);
      this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 6, kind: 'aux' });
      if (this.is3D) { const q = this.wp3; this.view.fx._smoke(q[0], q[1], q[2], 0.25, 0.4, 0.6); }
      sfx.play('auxPop', { pan: (mz.x - W / 2) / W });
    }
  }

  // -------------------------------------------- 2. SPOIL CYCLONE

  /** The conveyors run up and throw crushed ore from their heads in rotating streams. */
  spoilCyclone(t, rate = 1) {
    const c = this.c, w = this.w;
    if (c.state !== 'fight' || this.quiet) return;
    this.cycOn = true;
    const k = (n) => Math.max(3, Math.round(n / (rate * (c.intensity || 1) * (1 + 0.12 * (c.mk - 1)))));
    for (let i = 0; i < 2; i++) {
      if (this.dead.conv[i] || this.beltV[i] < 1.6) continue;
      const dir = i ? -1 : 1;
      const m = this._scr(this.M.conv[i], IV.convDischarge[0], IV.convDischarge[1] + 6, IV.convDischarge[2]);
      const x = m[0], y = m[1];
      if ((t + i * 4) % k(9) === 0) {
        this.cyc[i] += dir * 0.27;
        for (let s = 0; s < 2; s++) P.shoot(w, x, y, this.cyc[i] + s * Math.PI, SPEC.spoil.speed, dir > 0 ? SPOIL_R : SPOIL_L);
        if (this.is3D && (t >> 1) % 2 === 0) this._spill(i);
      }
      if ((t + i * 20) % k(44) === 0) P.shoot(w, x, y, Math.PI / 2 + dir * w.rng.range(0.3, 0.9), SPEC.spoilBig.speed, dir > 0 ? BIG_R : BIG_L);
      if (c.mk >= 2 && (t + i * 2) % k(8) === 0) P.shoot(w, x, y, this.cyc[i] + Math.PI / 3, SPEC.spoilFine.speed, SPEC.spoilFine);
      if (t % 24 === i * 12) sfx.play('conveyor', { pan: (x - W / 2) / W });
    }
  }

  // -------------------------------------------- 3. ORE CANNON CROSSFIRE

  startCrossfire(volleys = 3) {
    if (this.dead.ore[0] && this.dead.ore[1]) return false;
    if (!this._canHeavy('crossfire')) return false;
    this.heavy = 'crossfire';
    const w = this.w;
    this.cf = { v: 0, n: volleys + (this.c.mk >= 2 ? 1 : 0), phase: 'aim', t: 0, base: clamp(w.aimX, 80, W - 80), shift: w.rng.sign() * 56 };
    this._crossLanes();
    this.stabilise(40);
    return true;
  }

  /** Lanes of the current volley: the left cannon covers the right lane and vice versa (they cross). */
  _crossLanes() {
    const f = this.cf, w = this.w;
    const centre = clamp(f.base + f.shift * f.v, 70, W - 70);
    f.lanes = [clamp(centre + 46, 40, W - 40), clamp(centre - 46, 40, W - 40)];
    for (let i = 0; i < 2; i++) this.cannonT[i] = this._world(f.lanes[i], H - 40, [0, 0, 0]);
    void w;
  }

  _updateCrossfire() {
    const f = this.cf, w = this.w, c = this.c;
    if (!f) return;
    if (c.state !== 'fight' || (this.dead.ore[0] && this.dead.ore[1])) { this._endCrossfire(); return; }
    f.t++;
    this.hold = Math.max(this.hold, 2);
    if (f.phase === 'aim') {
      if (f.t >= 30) { f.phase = 'charge'; f.t = 0; sfx.play('cannonLoad', { pan: 0 }); }
    } else if (f.phase === 'charge') {
      // Telegraph: a line from each barrel along the exact path of its shell.
      for (let i = 0; i < 2; i++) {
        if (this.dead.ore[i]) continue;
        this.heat[i] = Math.min(1, f.t / 30);
        const mz = this._muzzle(this.M.bar[i * 2], IV.cannonMuzzle);
        f.mz = f.mz || [];
        f.mz[i] = mz;
        if (f.t % 2 === 0) this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 700, t: 0, life: 3, k: f.t / 32 });
      }
      if (f.t >= 32) { f.phase = 'fire'; f.t = 0; }
    } else if (f.phase === 'fire') {
      for (let i = 0; i < 2; i++) {
        if (this.dead.ore[i] || f.t !== i * 10) continue;
        for (let j = 0; j < 2; j++) this._oreShell(i, j, j * 5);
      }
      if (f.t >= 26) { f.phase = 'recover'; f.t = 0; }
    } else if (f.phase === 'recover') {
      if (f.t >= 26) {
        f.v++;
        if (f.v >= f.n) { this._endCrossfire(); return; }
        this._crossLanes();
        f.phase = 'aim'; f.t = 0;
      }
    }
  }

  _endCrossfire() {
    this.cf = null; this.cannonT[0] = this.cannonT[1] = null;
    this._heavyDone('crossfire');
  }

  /** One heavy ore shell from cannon i, barrel j; it bursts into fragments near its lane's end. */
  _oreShell(i, j, delay = 0) {
    const w = this.w;
    const go = () => {
      if (this.dead.ore[i] || this.c.state !== 'fight') return;
      const mz = this._muzzle(this.M.bar[i * 2 + j], IV.cannonMuzzle);
      const d = Math.hypot(this.cf ? this.cf.lanes[i] - mz.x : 200, H - 40 - mz.y);
      const sp = 3.2 * w.diff.speed;
      const spec = { shape: 'bigorb', color: 'orange', n: 1, speed: 3.2, fixed: true, split: SPEC.shellFrag, splitAt: Math.max(30, Math.round((d * 0.72) / sp)) };
      P.shoot(w, mz.x, mz.y, mz.ang, spec.speed, spec);
      this.s.rc[i * 2 + j] = 1;
      this.heat[i] = 1;
      this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 9, kind: 'cannon' });
      if (this.is3D) { const q = this.wp3; for (let k = 0; k < 2; k++) this.view.fx._smoke(q[0], q[1], q[2], 0.45, 0.55, 0.7); this.view.fx._spark(q[0], q[1], q[2], 4); }
      w.g.camera.addTrauma(0.1);
      sfx.play('oreCannon', { pan: (mz.x - W / 2) / W });
    };
    if (delay) w.explosions.schedule(delay, go); else go();
  }

  /** Overdrive: fast alternating aimed ore shells (no telegraph lines, smaller bursts). */
  _snapShell(i) {
    const w = this.w;
    if (this.dead.ore[i]) return;
    const j = this.barrelAlt[i] ^= 1;
    const mz = this._muzzle(this.M.bar[i * 2 + j], IV.cannonMuzzle);
    P.shoot(w, mz.x, mz.y, mz.ang, 3.0, SNAP);
    this.s.rc[i * 2 + j] = 1; this.heat[i] = Math.min(1, this.heat[i] + 0.4);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 7, kind: 'cannon' });
    sfx.play('oreCannon', { pan: (mz.x - W / 2) / W });
  }

  // -------------------------------------------- 4. SEISMIC FAULT LINES

  startSeismic(n = 0) {
    if (!this._canHeavy('seismic')) return false;
    this.heavy = 'seismic';
    const w = this.w, c = this.c;
    n = n || (c.mk >= 3 ? 3 : 2);
    const xs = [clamp(w.aimX, 40, W - 40)];
    for (let k = 1; k < n; k++) {
      let x, tries = 0;
      do { x = w.rng.range(40, W - 40); tries++; } while (tries < 12 && xs.some((o) => Math.abs(o - x) < 90));
      xs.push(x);
    }
    this.sz = { t: 0, lanes: xs.map((x) => ({ x })), phase: 'stab' };
    this.stabilise(150, true);
    this.thrustT = -4;
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateSeismic() {
    const z = this.sz, w = this.w, c = this.c, R = w.fxRng;
    if (!z) return;
    if (c.state !== 'fight') { this.sz = null; this._heavyDone('seismic'); return; }
    z.t++;
    if (z.phase === 'stab') {
      this.rpmT = 0.18 * Math.sign(this.rpm || 1);
      if (z.t < 24) return;
      // The cutter bites: a crack runs from the cut down each lane.
      z.phase = 'crack'; z.t = 0;
      const y0 = Math.min(H - 120, this._tipRow() + 24);
      const WARN = 72;
      for (const L of z.lanes) {
        const pts = [];
        for (let sy = y0; sy <= H + 40; sy += 18) {
          const p = this._world(L.x + w.fxRng.range(-7, 7), sy, this.q3);
          pts.push(p[0], p[1]);
        }
        L.scar = this.scars.add(pts, { w: 30, w0: 6, grow: 44, life: 1500, glow: 0.05, period: 70 });
        L.hz = c.kit.hazard({
          type: 'lane', x: L.x, w: 56, y0, warn: WARN, fire: 20, color: [1, 0.5, 0.15],
          onFire: (h, ww) => this._erupt(h, L),
        });
      }
      sfx.play('seismicCrack', { pan: 0 });
    } else if (z.phase === 'crack') {
      for (const L of z.lanes) {
        if (L.scar) L.scar.glow = Math.min(1.4, z.t / 50);
        // Dust lifts out of the opening crack.
        if (this.is3D && z.t % 5 === 0) {
          const p = this._world(L.x + R.range(-8, 8), R.range(this._tipRow() + 30, H), this.q3);
          this.view.fx.dust(p[0], p[1], 0, 0.45, this.view.dustCol || [0.5, 0.44, 0.36], 2);
        }
      }
      w.g.camera.addTrauma(0.012);
      if (z.t >= 72) { z.phase = 'erupt'; z.t = 0; }
    } else if (z.phase === 'erupt') {
      for (const L of z.lanes) if (L.scar) L.scar.glow = Math.max(0, 1.8 - z.t / 40);
      if (z.t > 70) { this.sz = null; this.thrustT = 0; this._heavyDone('seismic'); }
    }
  }

  /** Rock spikes burst up along a marked lane, fragments scatter. */
  _erupt(h, L) {
    const w = this.w, R = w.fxRng;
    const y0 = h.y0 ?? 0;
    for (let sy = Math.max(y0 + 10, 0); sy < H + 10; sy += 34) {
      const x = h.x + R.range(-12, 12), p = this._world(x, sy, [0, 0, 0]);
      this.spikes.push({ x: p[0], y: p[1], t: -Math.round((sy - y0) / 40), life: 56, r: R.range(7, 12), hh: R.range(18, 34), rot: R.angle(), lean: [R.range(-0.25, 0.25), R.range(-0.25, 0.25)], mesh: R.chance(0.5) ? 'iv.spike' : 'iv.boulder2' });
      if (this.is3D && R.chance(0.6)) this.view.fx.dust(p[0], p[1], 0, 0.6, this.view.dustCol || [0.5, 0.44, 0.36], 3);
    }
    for (let j = 0; j < 7; j++) P.shoot(w, h.x + w.rng.range(-22, 22), H - j * 22 - w.rng.range(0, 20), -Math.PI / 2 + w.rng.range(-0.35, 0.35), SPEC.seismic.speed + j * 0.15, SPEC.seismic);
    w.g.camera.addTrauma(0.14);
    sfx.play('seismicErupt', { pan: (h.x - W / 2) / W });
    void L;
  }

  // -------------------------------------------- 5. DEEP-CORE BREACH

  startDeepCore() {
    if (!this._canHeavy('deepcore')) return false;
    this.heavy = 'deepcore';
    this.dc = { phase: 'lock', t: 0, fis: [] };
    this.stabilise(400, this.cutterOK);
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateDeepCore() {
    const d = this.dc, w = this.w, c = this.c, R = w.fxRng;
    if (!d) return;
    if (c.state !== 'fight') { this.dc = null; this.thrustT = 0; this._heavyDone('deepcore'); return; }
    d.t++;
    this.hold = Math.max(this.hold, 2);
    const src = this.cutterOK ? this._scr(this.M.cutS, 0, IV.cutter.R + 4, 0) : this._scr(this.M.hull, 0, -90, 0);
    const sx = src[0], sy = src[1];
    if (d.phase === 'lock') {
      // The cutter spins down and locks; the thrust rams compress; the carrier presses down.
      this.rpmT = 0;
      this.engage = this.cutterOK ? 1.3 : 0;
      this.thrustT = -8;
      if (d.t >= 36) {
        d.phase = 'charge'; d.t = 0;
        const n = this.cutterOK ? (c.mk >= 2 ? 8 : 6) : 4, CH = 96;
        for (let k = 0; k < n; k++) {
          // Fissures fan out from the cut, across the lower field.
          const a = Math.PI / 2 + ((k + 0.5) / n - 0.5) * (this.cutterOK ? 2.9 : 2.2) + w.rng.range(-0.08, 0.08);
          const len = (this.cutterOK ? w.rng.range(170, 300) : w.rng.range(110, 170));
          const scr = jagged(w.rng, sx, sy + 6, a, len, 24, 0.3);
          const pts = [];
          for (let j = 0; j < scr.length; j += 2) { const p = this._world(scr[j], scr[j + 1], this.q3); pts.push(p[0], p[1]); }
          const scar = this.scars.add(pts, { w: 26, w0: 6, grow: CH - 20, life: 1700, glow: 0.1, period: 70 });
          const f = { scar, hz: [] };
          // Eruption points along it (near ones first).
          for (let j = 4; j < scr.length; j += 6) {
            const ex = scr[j], ey = scr[j + 1];
            if (ex < 10 || ex > W - 10 || ey > H + 10) continue;
            const dd = Math.hypot(ex - sx, ey - sy);
            f.hz.push(c.kit.hazard({ type: 'circle', x: ex, y: ey, r: 24, warn: CH + 26 + Math.round(dd / 14), fire: 14, color: [1, 0.35, 0.1], boom: false, onFire: (h, ww) => this._burst(h) }));
          }
          d.fis.push(f);
        }
        sfx.play('coreCharge', { pan: (sx - W / 2) / W });
      }
    } else if (d.phase === 'charge') {
      const k = d.t / 96;
      for (const f of d.fis) f.scar.glow = 0.2 + k * 1.4;
      this.hubGlow = 1 + k * 2.2;
      w.g.camera.addTrauma(0.01 + k * 0.02);
      // Energy drawn into the drive hub.
      if (d.t % 2 === 0) {
        const hub = this.cutterOK ? this._scr(this.M.cutS, 0, 0, 44) : this._scr(this.M.hull, 0, -90, 82);
        const a = R.angle(), r = R.range(30, 60), H2 = w.fxHigh;
        const j = H2.spawn(w.F.spark, hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r, -Math.cos(a) * r / 10, -Math.sin(a) * r / 10, 10);
        if (j >= 0) { H2.size(j, 5, 1.5); H2.color(j, 2.4, 0.8, 0.2, 1.6, 0.2, 0.05); H2.look(j, 1, 1, FADE_OUT, 0.6); }
      }
      if (this.is3D && d.t % 8 === 0) for (const f of d.fis) if (R.chance(0.4)) { const P0 = f.scar.pts, j = 2 * Math.floor(R.next() * (P0.length / 2)); this.view.fx._smoke(P0[j], P0[j + 1], 1, 0.3, 0.2, 0.8); }
      if (d.t >= 96) {
        d.phase = 'discharge'; d.t = 0;
        const hub = this.cutterOK ? this._scr(this.M.cutS, 0, 0, 44) : this._scr(this.M.hull, 0, -90, 82);
        w.g.renderer.post.flash(1, 0.45, 0.15, 0.5, 0.04);
        w.g.renderer.post.shockwave(hub[0], hub[1], 0.05, 0.02, 0.7);
        w.g.camera.addTrauma(0.6);
        P.ring(w, hub[0], hub[1] + 10, SPEC.core, w.rng.angle());
        if (c.mk >= 2) P.ring(w, hub[0], hub[1] + 10, { ...SPEC.core, n: 12, speed: 1.4 }, w.rng.angle());
        this.flashes.push({ x: hub[0], y: hub[1], ang: 0, t: 0, life: 26, kind: 'core' });
        sfx.play('coreBlast', { pan: (hub[0] - W / 2) / W });
      }
    } else if (d.phase === 'discharge') {
      for (const f of d.fis) f.scar.glow = 2.2 - d.t * 0.01;
      if (d.t >= 70) { d.phase = 'cool'; d.t = 0; this._steam(1.4); sfx.play('steamVent', { pan: 0 }); }
    } else if (d.phase === 'cool') {
      for (const f of d.fis) f.scar.glow = Math.max(0, f.scar.glow - 0.025);
      this.thrustT = 0; this.engage = 0.2;
      if (this.is3D && d.t % 6 === 0) this._steam(0.6);
      if (d.t >= 70) { this.dc = null; this.hold = 0; this._heavyDone('deepcore'); }
    }
  }

  /** One fissure eruption: molten rock + a small ring of fragments. */
  _burst(h) {
    const w = this.w, R = w.fxRng;
    P.ring(w, h.x, h.y, SPEC.erupt, w.rng.angle());
    this.erupts.push({ x: h.x, y: h.y, t: 0, life: 22 });
    w.explosions.sparks(h.x, h.y, 10, [1, 0.5, 0.15], 4, 24, 3);
    if (this.is3D) {
      const p = this._world(h.x, h.y, [0, 0, 0]);
      for (let k = 0; k < 3; k++) this.view.fx._ember(p[0] + R.range(-6, 6), p[1] + R.range(-6, 6), 2, 1.4);
      this.view.fx.dust(p[0], p[1], 0, 0.5, [0.4, 0.3, 0.24], 2);
      this.spikes.push({ x: p[0], y: p[1], t: 0, life: 40, r: R.range(6, 9), hh: R.range(12, 20), rot: R.angle(), lean: [R.range(-0.3, 0.3), R.range(-0.3, 0.3)], mesh: 'iv.spike', hot: 1 });
    }
    sfx.play('seismicErupt', { pan: (h.x - W / 2) / W });
  }

  // -------------------------------------------- 6. QUARRY COLLAPSE

  startCollapse(n = 0) {
    if (!this._canHeavy('collapse')) return false;
    this.heavy = 'collapse';
    const c = this.c, w = this.w;
    n = n || (c.mk >= 2 ? 6 : 5);
    this.cl = { t: 0, n, k: 0, gap: 22 };
    this.stabilise(30);
    sfx.play('rockfall', { pan: 0 });
    void w;
    return true;
  }

  _updateCollapse() {
    const L = this.cl, w = this.w, c = this.c;
    if (!L) return;
    if (c.state !== 'fight') { this.cl = null; this._heavyDone('collapse'); return; }
    L.t++;
    if (L.k < L.n && L.t % L.gap === 1) {
      // Target: the first at the player, then spots across the lower field.
      const tx = L.k === 0 ? clamp(w.aimX, 40, W - 40) : w.rng.range(40, W - 40);
      const ty = L.k === 0 ? clamp(w.aimY, H * 0.5, H - 40) : w.rng.range(H * 0.48, H - 50);
      const side = tx < W / 2 ? -1 : 1;
      const to = this._world(tx, ty, [0, 0, 0]);
      // The rock breaks loose from the quarry bench on that side.
      const from = [to[0] + side * w.rng.range(-20, 20) + side * 300, to[1] + w.rng.range(-60, 60), w.rng.range(60, 90)];
      const T = 64;
      const hz = c.kit.hazard({
        type: 'circle', x: tx, y: ty, r: 34, warn: T, fire: 8, color: [1, 0.55, 0.2], crater: true,
        onFire: (h, ww) => this._boulderHit(h, b),
      });
      const b = { from, to, T, t: 0, apex: 70, r: w.fxRng.range(15, 21), axis: [w.fxRng.range(-1, 1), w.fxRng.range(-1, 1)], hz, mesh: L.k & 1 ? 'iv.boulder' : 'iv.boulder2', bounce: w.rng.chance(0.4) };
      this.boulders.push(b);
      L.k++;
      if (this.is3D) for (let k = 0; k < 4; k++) this.view.fx.dust(from[0] - side * 10, from[1], from[2] - 20, 0.6, this.view.dustCol || [0.5, 0.44, 0.36], 2);
    }
    if (L.k >= L.n && L.t > L.n * L.gap + 90) { this.cl = null; this._heavyDone('collapse'); }
  }

  _boulderHit(h, b) {
    const w = this.w, R = w.fxRng;
    P.ring(w, h.x, h.y, SPEC.boulderFrag, w.rng.angle());
    w.g.camera.addTrauma(0.22);
    sfx.play('boulderImpact', { pan: (h.x - W / 2) / W });
    this._shards(h.x, h.y, 10, [0.6, 0.48, 0.36]);
    if (this.is3D) {
      const p = this._world(h.x, h.y, [0, 0, 0]);
      this.view.fx.dust(p[0], p[1], 0, 1.3, this.view.dustCol || [0.5, 0.44, 0.36], 6);
      for (let k = 0; k < 3; k++) this.rubble.push({ x: p[0] + R.range(-14, 14), y: p[1] + R.range(-14, 14), r: R.range(4, 8), rot: R.angle(), t: 0, life: 1500, mesh: 'iv.chunk' });
    }
    b.done = true;
    if (b.bounce && this.c.state === 'fight') {
      // It hops once more, further down, before it shatters.
      const tx = clamp(h.x + w.rng.range(-50, 50), 30, W - 30), ty = Math.min(H - 30, h.y + w.rng.range(40, 70));
      const to = this._world(tx, ty, [0, 0, 0]);
      const nb = { from: [b.to[0], b.to[1], 4], to, T: 26, t: 0, apex: 26, r: b.r * 0.7, axis: b.axis, mesh: b.mesh, bounce: false };
      nb.hz = this.c.kit.hazard({ type: 'circle', x: tx, y: ty, r: 22, warn: 26, fire: 6, color: [1, 0.55, 0.2], crater: false, onFire: (h2) => { P.ring(w, h2.x, h2.y, SPEC.bounceFrag, w.rng.angle()); nb.done = true; sfx.play('boulderImpact', { pan: (h2.x - W / 2) / W }); } });
      this.boulders.push(nb);
    }
  }

  // -------------------------------------------- 7. BORE CHARGE

  startBore() {
    if (!this.cutterOK || this.bore) return false;
    if (!this._canHeavy('bore')) return false;
    this.heavy = 'bore';
    this.bore = { phase: 'align', t: 0, lane: clamp(this.w.aimX, W / 2 - 80, W / 2 + 80) };
    this.hold = 0;
    return true;
  }

  _updateBore() {
    const r = this.bore, c = this.c, w = this.w, s = this.s;
    if (!r) return;
    if (c.state !== 'fight') { this.bore = null; this.slip = 0; this.thrustT = 0; this._heavyDone('bore'); return; }
    r.t++;
    switch (r.phase) {
      case 'align':
        this.mode = 'reposition'; this.ms = 'reposition'; this.engage = 0;
        this._goalTip(r.lane, TIP_HOME - 10);
        if ((Math.hypot(this.goal[0] - s.x, this.goal[1] - s.y) < 6 && Math.abs(s.h) < 0.04 && Math.abs(this.v) < 0.1) || r.t > 200) {
          r.phase = 'prep'; r.t = 0;
          r.lx = this._scr(this.M.chassis, 0, TIP_Y, 0)[0];
          c.kit.hazard({ type: 'lane', x: r.lx, w: 170, warn: 78, fire: 70, lethal: false, color: [1, 0.5, 0.15], y0: this._tipRow() - 6 });
          sfx.play('boreRev', { pan: (r.lx - W / 2) / W });
        }
        break;
      case 'prep': {
        // Brace, cutter slows, then winds up; the tracks spin against the brakes; thrust extends.
        this.mode = 'reposition'; this.ms = 'prep'; this.goal = null;
        this.engage = 0.4;
        this.rpmT = r.t < 22 ? 0.02 : 0.32;
        this.slip = r.t < 30 ? 0 : Math.min(1.6, (r.t - 30) * 0.05);
        this.thrustT = r.t < 30 ? -3 : 12;
        w.g.camera.addTrauma(0.012);
        if (this.is3D && r.t % 4 === 0) for (const st of IV.stacks) { const q = M4.point(this.M.hull, st[0], st[1], st[2], [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.8, 0.9, 1.6); }
        if (r.t >= 78) { r.phase = 'charge'; r.t = 0; this.slip = 0; w.g.camera.addTrauma(0.3); sfx.play('drillGrind', { pan: 0, v: 1 }); }
        break;
      }
      case 'charge':
        this.mode = 'charge'; this.ms = 'charge';
        this.engage = 1;
        this._goalTip(r.lx, H + 400);
        w.g.camera.addTrauma(0.05);
        // Rock thrown off both sides of the cut, chips off the rim, aux pods firing.
        if (r.t % 7 === 0 && this.v > 2.5) {
          for (const sd of [-1, 1]) {
            const rm = this._rim(Math.PI / 2 + sd * 1.1, this.rimO || (this.rimO = {}));
            P.shoot(w, rm.x, rm.y, Math.PI / 2 - sd * w.rng.range(0.9, 1.4), SPEC.debris.speed, SPEC.debris);
          }
        }
        if (r.t % 24 === 12) this.auxBurst(0, 1, true);
        if (this._tipRow() > H - 150 || r.t > 110) {
          r.phase = 'brake'; r.t = 0;
          const q = this._scr(this.M.chassis, 0, TIP_Y - 4, 2);
          if (w.arena && w.arena.fx) w.arena.fx.impact(q[0], q[1], 34, { crater: false });
          w.g.camera.addTrauma(0.5);
          w.g.renderer.post.shockwave(q[0], q[1], 0.03, 0.02, 0.5);
          P.ring(w, q[0], q[1], SPEC.boulderFrag, w.rng.angle());
          sfx.play('ramImpact', { pan: (q[0] - W / 2) / W });
          sfx.play('brakeScreech', { pan: (q[0] - W / 2) / W });
        }
        break;
      case 'brake':
        this.mode = 'charge'; this.ms = 'brake'; this.goal = null;
        this.thrustT = 0;
        if (Math.abs(this.v) < 0.05 && r.t > 12) { r.phase = 'recover'; r.t = 0; this._steam(1); sfx.play('steamVent', { pan: 0 }); }
        break;
      case 'recover':
        this.mode = 'back'; this.ms = 'recover'; this.goal = null; this.engage = 0;
        this.rpmT = 0.03;
        if (r.t > 46) { r.phase = 'return'; r.t = 0; }
        break;
      case 'return':
        this.mode = 'back'; this.ms = 'reposition'; this.engage = 0;
        this._goalTip(clamp(r.lx, W / 2 - SPAN, W / 2 + SPAN), TIP_HOME);
        if (Math.hypot(this.goal[0] - s.x, this.goal[1] - s.y) < 7 || r.t > 420) {
          this.bore = null; this.wp.phase = 'reposition'; this.wp.t = 0; this.wp.sx = clamp(r.lx, W / 2 - SPAN, W / 2 + SPAN);
          this._heavyDone('bore');
        }
        break;
      default: break;
    }
  }

  // -------------------------------------------- 8. OVERDRIVE BARRAGE

  /**
   * Critical Overdrive: a rolling multi-system sequence. Each window leads
   * with one system so the field stays readable:
   *   cannons → conveyors + seismic → cutter + cannons → seismic + aux
   */
  overdrive(t) {
    if (!this.critical || this.c.state !== 'fight') return;
    const w = this.w;
    this.odT++;
    const T = this.odT % 640;
    if (T < 150) {
      if (T % 22 === 0) this._snapShell(((T / 22) | 0) & 1);
      this.cutterFan(t, 0.55);
    } else if (T < 340) {
      this.spoilCyclone(t, 1.25);
      if (T === 220) this.startSeismic(2);
    } else if (T < 500) {
      this.cutterFan(t, 1.35);
      if (T % 44 === 0) this._snapShell(((T / 44) | 0) & 1);
    } else {
      if (T === 505) this.startSeismic(3);
      this.auxBurst(t, 1.3);
    }
    void w;
  }

  // ------------------------------------------------------------ rocks

  _boulderPos(b, u, out = [0, 0, 0]) {
    u = clamp(u, 0, 1);
    out[0] = lerp(b.from[0], b.to[0], u); out[1] = lerp(b.from[1], b.to[1], u);
    out[2] = lerp(b.from[2], b.to[2] + b.r * 0.6, u) + 4 * b.apex * u * (1 - u);
    return out;
  }

  _updateRocks() {
    for (let i = this.spikes.length - 1; i >= 0; i--) if (++this.spikes[i].t >= this.spikes[i].life) this.spikes.splice(i, 1);
    for (let i = this.rubble.length - 1; i >= 0; i--) if (++this.rubble[i].t >= this.rubble[i].life) this.rubble.splice(i, 1);
    for (let i = this.erupts.length - 1; i >= 0; i--) if (++this.erupts[i].t >= this.erupts[i].life) this.erupts.splice(i, 1);
    const hz = this.c.kit.hazards;
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      b.t++;
      if (b.done || b.t > b.T + 2 || (b.hz && !hz.includes(b.hz))) { this.boulders.splice(i, 1); continue; }
      // Dust and pebbles shed along the fall.
      if (this.is3D && b.t % 4 === 0) { const p = this._boulderPos(b, b.t / b.T, this.q3); this.view.fx._smoke(p[0], p[1], p[2], 0.25, 0.1, 0.4); }
    }
  }

  // --------------------------------------------------------- lifecycle

  _endAttacks() {
    this.cf = null; this.sz = null; this.dc = null; this.cl = null; this.bore = null;
    this.heavy = null; this.queue = null;
    this.hold = 0; this.slip = 0; this.thrustT = 0;
    this.cannonT[0] = this.cannonT[1] = null;
    this.boulders.length = 0;
    this.lines.length = 0;
    for (const sc of this.scars.list) sc.glow = 0;
  }

  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng, s = this.s;
    if (this.deathT < 0) { this.deathT = 0; this._endAttacks(); this.mode = 'charge'; this.ms = 'defeat'; this.engage = 0; }
    this.deathT++;
    this.goal = null;
    this.rpmT = 0;
    // Hydraulic failure: the carrier slumps onto the cutter, the hull settles.
    s.lift += (-0.09 - s.lift) * 0.02;
    s.sag = Math.min(1, s.sag + 0.008);
    this.hubGlow = 1.2 + Math.sin(st * (0.2 + st * 0.004)) * (0.6 + st * 0.01);
    if (st % 11 === 0 && st < 108) {
      const pick = R.int(0, 5);
      const pt = pick < 2 ? this._scr(this.M.can[pick], 0, 0, 16) : pick < 4 ? this._scr(this.M.conv[pick - 2], 0, 40, 24) : this._scr(this.M.hull, R.range(-60, 60), R.range(-200, 20), 70);
      w.explosions.blast(pt[0], pt[1], R.range(0.7, 1.15), [1, 0.5, 0.2]);
      if (this.is3D) this._steam(0.6);
    }
    if (st % 17 === 0 && st < 100) sfx.play('hydraulic', { pan: 0 });
    if (st === 112) {
      // Core breach: the deep-core reactor and the drive hub go up together.
      const q = this._scr(this.M.hull, 0, -90, 80), hub = this._scr(this.M.cutS, 0, 0, 40);
      w.explosions.blast(q[0], q[1], 2.8, [1, 0.45, 0.15]);
      w.explosions.blast(hub[0], hub[1], 2.2, [1, 0.35, 0.1]);
      w.g.camera.addTrauma(0.85);
      this.dead.conv[0] = this.dead.conv[1] = true;
      this.dead.cutter[0] = true;
      if (this.is3D) {
        const fx = this.view.fx;
        fx.decal('scorch', s.x, s.y - 40, 0.45, 340, R.angle(), 9000);
        for (const [lx, ly, z, sc] of [[0, -90, 80, 1.6], [-50, -20, 60, 1.1], [56, -130, 70, 1.2], [0, 60, 64, 1], [-60, -220, 86, 0.9], [62, 30, 60, 0.9]]) {
          const p = M4.point(this.M.hull, lx, ly, z, [0, 0, 0]);
          fx.addFire(p[0], p[1], p[2], sc, 5400);
        }
        const cp = this._contactW();
        fx.dust(cp[0], cp[1], 0, 2.2, this.view.dustCol || [0.5, 0.44, 0.36], 10);
        for (let k = 0; k < 6; k++) this.rubble.push({ x: cp[0] + R.range(-50, 50), y: cp[1] + R.range(-30, 40), r: R.range(5, 10), rot: R.angle(), t: 0, life: 99999, mesh: 'iv.chunk' });
      }
      this._shards(hub[0], hub[1], 18, [0.6, 0.48, 0.36]);
    }
    if (st > 112) this.wreck = true;
    if (st === 130 && this.view) this.view.speedTarget = this.view.baseSpeed; // the advance resumes past the wreck
  }

  // ---------------------------------------------------------- world fx

  /** World point where the cutter meets the ground. */
  _contactW() { return M4.point(this.M.cutS, 0, IV.cutter.R + 6, -2, this.q3); }

  _shards(x, y, n, col = [0.75, 0.7, 0.62]) {
    const w = this.w, shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < n; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(45, 75));
      if (j < 0) continue;
      L.size(j, R.range(6, 12)); L.color(j, col[0], col[1], col[2], col[0] * 0.4, col[1] * 0.4, col[2] * 0.4); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
  }

  _steam(s = 1) {
    if (!this.is3D) return;
    const fx = this.view.fx, R = this.w.fxRng;
    for (const [lx, ly, lz] of [[-80, 60, 70], [80, 60, 70], [-40, 40, 74], [40, 40, 74]]) {
      if (!R.chance(0.6 * s)) continue;
      const q = M4.point(this.M.carrier, lx, ly, lz, [0, 0, 0]);
      fx._steam(q[0], q[1], q[2], 0.8 * s);
    }
  }

  /** Gravel spray off the cutter, thrown the way the bottom of the disc is moving. */
  _gravel(s = 1) {
    const fx = this.view.fx, R = this.w.fxRng, P2 = fx.p, F = fx.F, M = this.M;
    const dir = Math.sign(this.rpm || 1);
    for (let k = 0; k < 4 * s; k++) {
      const th = Math.PI / 2 + R.range(-0.5, 0.5);
      const rr = IV.cutter.R + 4, q = M4.point(M.cutS, Math.cos(th) * rr, Math.sin(th) * rr, 2, [0, 0, 0]);
      const d = M4.dir(M.cutS, -Math.sin(th) * dir, Math.cos(th) * dir * 0.3, 0, [0, 0, 0]);
      const sp = R.range(1.2, 3.2) * s;
      const i = P2.spawn(F.chunk, q[0], q[1], Math.max(1, q[2]), d[0] * sp, d[1] * sp, R.range(1.2, 3), R.range(30, 55));
      if (i >= 0) { P2.s0[i] = P2.s1[i] = R.range(2, 4.5); P2.r[i] = P2.r1[i] = 0.42; P2.g[i] = P2.g1[i] = 0.35; P2.b[i] = P2.b1[i] = 0.28; P2.grav[i] = -0.12; P2.vr[i] = R.range(-0.2, 0.2); P2.drag[i] = 0.985; }
    }
  }

  /** Ore spilling off a conveyor head (falls to the ground in a dust plume). */
  _spill(i) {
    const fx = this.view.fx, R = this.w.fxRng, P2 = fx.p, F = fx.F;
    const q = M4.point(this.M.conv[i], 0, IV.convDischarge[1] + 8, IV.convDischarge[2] - 2, [0, 0, 0]);
    const d = M4.dir(this.M.conv[i], R.range(-0.2, 0.2), 1, 0, [0, 0, 0]);
    const n = P2.spawn(F.chunk, q[0], q[1], q[2], d[0] * R.range(0.6, 1.4), d[1] * R.range(0.6, 1.4), R.range(-0.2, 0.4), R.range(40, 60));
    if (n >= 0) { P2.s0[n] = P2.s1[n] = R.range(2.5, 5); P2.r[n] = P2.r1[n] = 0.5; P2.g[n] = P2.g1[n] = 0.38; P2.b[n] = P2.b1[n] = 0.28; P2.grav[n] = -0.1; P2.vr[n] = R.range(-0.2, 0.2); }
    if (R.chance(0.4)) fx.dust(q[0], q[1], q[2] - 10, 0.35, this.view.dustCol || [0.5, 0.44, 0.36], 1);
  }

  /** Tread prints, trench, track dust, cutter contact debris, exhaust, steam, fires. */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, s = this.s, M = this.M, c = this.c;
    const P2 = fx.p, F = fx.F, dust = this.view.dustCol || [0.52, 0.45, 0.37];
    // Tread prints along the front track units (the middle and rear units run in the same ruts).
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1, T = IV.tracks[0], ty = (T.y0 + T.y1) / 2;
      const q = M4.point(M.chassis, side * T.x, ty, 0, [0, 0, 0]);
      this.treads.add(k, q[0], q[1], k ? s.tr : s.tl, !this.wreck);
    }
    // The trench, wherever the cutter is actually in the ground.
    const cp = this._contactW();
    // Only a forward cut lays trench (turning on the spot or backing up doesn't).
    this.trench.add(0, cp[0], cp[1], this.dist, this.engaged && this.v > 0.05 && Math.abs(this.om) < 0.003 && !this.wreck);
    // Dust kicked off the track ends (rear when advancing, front when reversing), more when slipping.
    for (let u = 0; u < 3; u++) {
      const T = IV.tracks[u];
      for (let k = 0; k < 2; k++) {
        const vt = (k ? s.tr - this.p.tr : s.tl - this.p.tl), a = Math.abs(vt);
        if (a < 0.08 || !R.chance(Math.min(0.5, a * 0.5) * (u === 1 ? 0.5 : 1))) continue;
        const side = k ? 1 : -1, end = vt > 0 ? T.y0 - 6 : T.y1 + 8;
        const q = M4.point(M.chassis, side * T.x + R.range(-14, 14), end, 3, [0, 0, 0]);
        const bk = vt > 0 ? -1 : 1, d = M4.dir(M.chassis, R.range(-0.4, 0.4), bk * R.range(0.3, 0.9) * Math.min(3, a + 0.4), 0, [0, 0, 0]);
        const i = P2.spawn(R.pick(F.dust), q[0], q[1], q[2], d[0], d[1], R.range(0.3, 0.9), R.range(50, 80));
        if (i >= 0) { P2.s0[i] = 8 + a * 3; P2.s1[i] = 26 + a * 8; P2.r[i] = dust[0]; P2.g[i] = dust[1]; P2.b[i] = dust[2]; P2.r1[i] = dust[0] * 1.12; P2.g1[i] = dust[1] * 1.12; P2.b1[i] = dust[2] * 1.12; P2.a[i] = 0.5; P2.drag[i] = 0.96; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.02; }
      }
    }
    // Cutter at work: rock chips and gravel thrown the way the bottom of the disc
    // moves, dust rolling off the contact, sparks off hard rock.
    if (this.engaged) {
      const load = Math.min(1.6, Math.abs(this.rpm) * 7 + Math.abs(this.v));
      if (R.chance(0.5 * load)) this._gravel(Math.min(1.4, load));
      if (this.t % Math.max(2, Math.round(7 - load * 3)) === 0) {
        for (const sd of [-1, 1]) {
          const q = M4.point(M.cutS, sd * R.range(30, 70), IV.cutter.R + R.range(-4, 8), 0, [0, 0, 0]);
          const i = P2.spawn(R.pick(F.dust), q[0], q[1], 2, sd * R.range(0.2, 0.7) + R.range(-0.2, 0.2), R.range(-0.6, 0.1), R.range(0.3, 0.7), R.range(60, 100));
          if (i >= 0) { P2.s0[i] = 12; P2.s1[i] = 40 + load * 14; P2.r[i] = dust[0]; P2.g[i] = dust[1]; P2.b[i] = dust[2]; P2.r1[i] = dust[0] * 1.15; P2.g1[i] = dust[1] * 1.15; P2.b1[i] = dust[2] * 1.15; P2.a[i] = 0.55; P2.drag[i] = 0.96; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.025; }
        }
      }
      if (R.chance(0.12 * load)) fx._spark(cp[0] + R.range(-40, 40), cp[1] + R.range(-6, 6), 2, 3);
    }
    // Exhaust: darker and denser under load.
    const load = Math.min(1, Math.abs(this.acc) * 40 + Math.abs(this.v) * 0.5 + this.strain * 0.6 + (this.bore ? 0.6 : 0));
    if (!this.wreck && this.t % Math.max(3, Math.round(10 - load * 7)) === 0) {
      for (const st of IV.stacks) { const q = M4.point(M.hull, st[0], st[1], st[2], [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.5 + load * 0.45, 0.55 + load * 0.35, 1.3); }
    }
    // Overdrive: steam and sparks from the stressed joints.
    if (this.critical && !this.wreck) {
      if (this.t % 9 === 0) this._steam(0.5);
      if (R.chance(0.08)) { const q = M4.point(M.hull, R.range(-70, 70), R.range(-160, 30), 70, [0, 0, 0]); fx._spark(q[0], q[1], q[2], 4); }
    }
    // Broken parts burn and spark; a battered hull smokes.
    for (const f of this.fires) {
      const q = f.kind === 'ore' ? M4.point(M.can[f.i], 0, 0, 14, [0, 0, 0]) : f.kind === 'conv' ? M4.point(M.conv[f.i], 0, 20, 14, [0, 0, 0]) : M4.point(M.cutS, 0, 0, 36, [0, 0, 0]);
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2], f.s, 0.9, 1.3);
      if (R.chance(0.05)) fx._spark(q[0], q[1], q[2], 6);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
    const frac = c.e.hp / Math.max(1, this._hp0());
    if (frac < 0.45 && this.t % (frac < 0.2 ? 5 : 11) === 0) {
      const site = [[-50, -60], [44, -120], [-30, -200], [40, 0]][R.int(0, 3)];
      const q = M4.point(M.hull, site[0], site[1], 72, [0, 0, 0]);
      fx._smoke(q[0], q[1], q[2], 0.6, 0.85, 1.1);
    }
    this.treads.trim(this.cam.cy - 1400);
    this.trench.trim(this.cam.cy - 1400);
  }

  /** Engine / drill sound pacing. */
  _sound() {
    if (this.c.state === 'dying' || this.wreck) return;
    const pan = (this.c.e.x - W / 2) / W;
    if (this.engaged) {
      this.grindD += Math.abs(this.rpm) * 3 + 0.1;
      if (this.grindD > 6) { this.grindD = 0; sfx.play('drillGrind', { pan, v: Math.min(1, Math.abs(this.rpm) * 4) }); }
    }
    this.clankD += Math.abs(this.v) + this.slip;
    if (this.clankD > 18) { this.clankD = 0; sfx.play('trackClank', { pan, v: Math.min(1, Math.abs(this.v) + this.slip * 0.4) }); }
  }

  // ------------------------------------------------------------ render

  renderWorld(view, alpha) {
    if (view !== this.view) return;
    const s = this.s;
    if (this.wreck && this.c.state !== 'dying') {
      const q = this.cam.project(s.x, s.y, 0, this.pr);
      if (q[1] > H + 420) { const i = view.extras.indexOf(this); if (i >= 0) view.extras.splice(i, 1); return; }
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('iv', buildIronVein);
    const cam = view.cam, M = this.M, hdr = !!this.w.g.renderer.post.hdr;
    this._pose(this.c.e.alive ? alpha : 1);
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.8), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    const z0 = view.floorZ || 0;
    // 1) Ground: trench, tread prints, cracks (multiply), molten fissures (glow).
    let n = this.trench.build(z0 + 0.8);
    R.trail(cam, this.trench.data, n, hdr, TL.EXCAV);
    n = this.treads.build(z0 + 1);
    R.trail(cam, this.treads.data, n, hdr, TL.TREAD);
    this.scars.build(z0 + 1.2);
    R.trail(cam, this.scars.dark, this.scars.nDark, hdr, TL.CRACK);
    // 2) The machine.
    R.begin(cam, view.atmo, light, MINE_LOOK);
    const dmg = this.wreck ? 1 : Math.min(0.75, (1 - this.c.e.hp / this._hp0()) * 0.9);
    const heat = this.wreck ? 0.12 + 0.06 * Math.sin(this.t * 0.2) : this.critical ? 0.12 + 0.08 * Math.sin(this.t * 0.3) : 0;
    const fl = this.flash * 0.2;
    const P0 = this.alphaPose;
    R.draw('iv.frame', M.chassis, { snow: 0.35, damage: dmg * 0.5 });
    for (let u = 0; u < 3; u++) {
      R.draw(`iv.trackL${u}`, M.chassis, { scroll: [0, P0.tl / 72], snow: 0.25, damage: dmg * 0.3 });
      R.draw(`iv.trackR${u}`, M.chassis, { scroll: [0, P0.tr / 72], snow: 0.25, damage: dmg * 0.3 });
      const T = IV.tracks[u], ws = wheelsOf(T);
      for (const side of [-1, 1]) {
        const dist = side < 0 ? P0.tl : P0.tr;
        for (let k = 0; k < ws.length; k++) {
          const end = k === 0 || k === ws.length - 1, r = end ? T.r : T.r * 0.8;
          M4.mul(M.chassis, M4.trans(side * (T.x + T.hw + 0.6), ws[k], end ? T.r : T.r * 0.8 + 0.4, M.tmp), M.wheel);
          M4.mul(M.wheel, M4.rotX(-dist / r, M.tmp), M.wheel);
          M4.mul(M.wheel, scaleM(side * 2.4, r, r, M.tmp), M.wheel);
          R.draw('iv.wheel', M.wheel, { snow: 0.3, damage: dmg * 0.4 });
        }
      }
    }
    const blink = this.wreck ? 0 : this.c.state === 'dying' ? ((this.t >> 2) & 1) * 1.6 : this.critical ? 0.6 + 1.0 * ((this.t >> 3) & 1) : 0.45 + 0.35 * (Math.sin(this.t * 0.09) > 0.2 ? 1 : 0);
    R.draw('iv.hull', M.hull, { glow: blink, flash: fl, damage: dmg, heat, snow: 0.14 });
    R.draw('iv.carrier', M.carrier, { flash: fl, damage: dmg, heat, snow: 0.14 });
    R.draw('iv.hood', M.cutS, { flash: fl, damage: dmg, heat, snow: 0.12 });
    const hub = this.hubGlow * (this.cutterOK ? 1 : 0.15);
    const pc = this.partEnt.cutter0, cf = pc && pc.alive && pc.flash > 0 ? 0.6 : 0;
    const cd = pc && pc.alive && pc.maxHp ? 1 - pc.hp / pc.maxHp : 0;
    R.draw('iv.cutter', M.cutter, { glow: hub, flash: Math.max(fl, cf), damage: Math.max(dmg * 0.7, cd * 0.7, this.cutterOK ? 0 : 0.75), heat: heat + (this.dc ? this.hubGlow * 0.05 : 0) + (this.cutterOK ? 0 : 0.05), snow: 0.15 });
    if (!this.cutterOK) R.draw('iv.hubWreck', M.cutS, { damage: 1, heat: 0.2 });
    // Hydraulic cylinders between hull and carrier (they extend and compress).
    for (const [a, b] of IV.pistons) {
      const A = M4.point(M.hull, a[0], a[1], a[2], [0, 0, 0]), B = M4.point(M.carrier, b[0], b[1], b[2], [0, 0, 0]);
      const mid = [lerp(A[0], B[0], 0.58), lerp(A[1], B[1], 0.58), lerp(A[2], B[2], 0.58)];
      R.draw('iv.cyl', spanM(A, mid, 5.2, M.span), { damage: dmg * 0.6 });
      R.draw('iv.rod', spanM(mid, B, 3, M.span), {});
    }
    for (let i = 0; i < 2; i++) {
      const po = this.partEnt[`ore${i}`], pv = this.partEnt[`conv${i}`];
      const of = po && po.alive && po.flash > 0 ? 0.7 : 0, vf = pv && pv.alive && pv.flash > 0 ? 0.7 : 0;
      const od = po && po.alive && po.maxHp ? 1 - po.hp / po.maxHp : 0, vd = pv && pv.alive && pv.maxHp ? 1 - pv.hp / pv.maxHp : 0;
      if (this.dead.ore[i]) R.draw('iv.cannonWreck', M.can[i], { damage: 1, heat: 0.12 });
      else {
        R.draw('iv.cannonBase', M.can[i], { glow: 0.5 + this.heat[i], flash: Math.max(fl, of), damage: Math.max(dmg, od * 0.8), heat: this.heat[i] * 0.15 });
        for (let j = 0; j < 2; j++) R.draw('iv.cannonBarrel', M.bar[i * 2 + j], { flash: of * 0.5, damage: dmg, heat: this.heat[i] * 0.35 });
      }
      if (this.dead.conv[i]) R.draw('iv.convWreck', M.conv[i], { damage: 1, heat: 0.1 });
      else {
        R.draw('iv.conveyor', M.conv[i], { glow: 0.5, flash: Math.max(fl, vf), damage: Math.max(dmg, vd * 0.8), snow: 0.3 });
        R.draw('iv.belt', M.conv[i], { scroll: [0, -(i ? P0.b1 : P0.b0) / 60], snow: 0 });
      }
      R.draw('iv.aux', M.aux[i], { flash: fl, damage: dmg, snow: 0.3 });
    }
    // Loose rock: seismic spikes, falling boulders, rubble.
    const rk = M.rock;
    for (const sp of this.spikes) {
      if (sp.t < 0) continue;
      const k = sp.t < 6 ? sp.t / 6 : sp.t > sp.life - 18 ? Math.max(0, (sp.life - sp.t) / 18) : 1;
      M4.trans(sp.x, sp.y, z0 - sp.hh * (1 - k) * 0.9, rk);
      M4.mul(rk, M4.rotZ(sp.rot, M.tmp), rk);
      M4.mul(rk, M4.rotX(sp.lean[0], M.tmp), rk);
      M4.mul(rk, M4.rotY(sp.lean[1], M.tmp), rk);
      M4.mul(rk, scaleM(sp.r, sp.r, sp.hh / (sp.mesh === 'iv.spike' ? 2.2 : 1), M.tmp), rk);
      R.draw(sp.mesh, rk, { snow: 0.2, heat: sp.hot ? 0.8 * (1 - sp.t / sp.life) : 0 });
    }
    for (const b of this.boulders) {
      if (b.t <= 0) continue;
      const u = (b.t - 1 + alpha) / b.T, p = this._boulderPos(b, u, this.q3);
      M4.trans(p[0], p[1], p[2] - b.r * 0.5, rk);
      M4.mul(rk, M4.rotX(u * 7 * b.axis[0], M.tmp), rk);
      M4.mul(rk, M4.rotY(u * 7 * b.axis[1], M.tmp), rk);
      M4.mul(rk, scaleM(b.r, b.r, b.r, M.tmp), rk);
      R.draw(b.mesh, rk, { snow: 0.2 });
    }
    for (const r of this.rubble) {
      const k = Math.min(1, (r.life - r.t) / 200);
      M4.trans(r.x, r.y, z0 - r.r * (1 - k), rk);
      M4.mul(rk, M4.rotZ(r.rot, M.tmp), rk);
      M4.mul(rk, scaleM(r.r, r.r, r.r * 0.7, M.tmp), rk);
      R.draw(r.mesh, rk, { snow: 0.3 });
    }
    // 3) Contact occlusion + soft planar shadow.
    R.beginShadow(cam, MINE_LOOK.shadow);
    M4.mul(M.chassis, M4.mul(M4.trans(0, -82, 0, M.tmp), scaleM(140, 196, 1, M.tmp2), M.tmp2), M.pad);
    R.contact(M.pad, 0.62, [0.25, 0.35], z0 + 1.6);
    const items = this._items();
    const sh = 1.12, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < 3; k++) {
      const j = (k - 1) * 0.05, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], z0 + 2 + k * 0.6, 0.2);
    }
    // 4) Molten fissures glow last (additive, depth tested: the hull hides what runs under it).
    if (this.scars.nGlow) R.trail(cam, this.scars.glow, this.scars.nGlow, hdr, TL.CRACK, [1.9, 0.55, 0.14]);
    R.end();
    this._pose(1);
  }

  _items() {
    const M = this.M, out = [['iv.hull', M.hull], ['iv.carrier', M.carrier], ['iv.hood', M.cutS], ['iv.cutter', M.cutter]];
    for (let u = 0; u < 3; u++) out.push([`iv.trackL${u}`, M.chassis], [`iv.trackR${u}`, M.chassis]);
    for (let i = 0; i < 2; i++) {
      out.push(this.dead.ore[i] ? ['iv.cannonWreck', M.can[i]] : ['iv.cannonBase', M.can[i]]);
      if (!this.dead.ore[i]) out.push(['iv.cannonBarrel', M.bar[i * 2]], ['iv.cannonBarrel', M.bar[i * 2 + 1]]);
      out.push(this.dead.conv[i] ? ['iv.convWreck', M.conv[i]] : ['iv.conveyor', M.conv[i]]);
    }
    return out;
  }

  _hp0() {
    const c = this.c;
    return c.floors && c.phases ? c.floors[0] + c.phases[0].hp : c.e.hp || 1;
  }

  /** Under entities: boulder shadows on the ground. */
  renderUnder(b, alpha) {
    const F = this.w.F;
    for (const bo of this.boulders) {
      if (bo.t <= 0) continue;
      const u = (bo.t - 1 + alpha) / bo.T, g = this._boulderPos(bo, u, [0, 0, 0]);
      const q = this.cam.project(g[0], g[1], this.view ? this.view.floorZ : 0, this.pr);
      const k = 1 - Math.min(1, g[2] / (bo.apex + 90));
      b.draw(F.glow, q[0], q[1], (14 + 22 * k) * q[2], (10 + 14 * k) * q[2], 0, 0, 0, 0, 0.2 + 0.45 * k, 0);
    }
  }

  /** Over entities (under bullets): flashes, aim lines, hub energy, eruptions, bore chevrons. */
  renderOver(b, alpha) {
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t;
    for (const ln of this.lines) {
      const a = (1 - ln.t / ln.life) * (0.5 + 0.5 * ln.k), blink = (this.w.t >> 2) & 1 ? 1 : 0.7;
      b.draw(KF.laser, ln.x + Math.cos(ln.ang) * ln.len / 2, ln.y + Math.sin(ln.ang) * ln.len / 2, ln.len, 3 + ln.k * 5, ln.ang, 2.2, 1.0, 0.3, a * blink, 1);
      b.draw(F.glow, ln.x, ln.y, 26 + 30 * ln.k, 26 + 30 * ln.k, 0, 2.2, 1.0, 0.3, 0.5 * a, 1);
    }
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      if (f.kind === 'cannon') {
        b.draw(F.glow, f.x, f.y, 46 * k, 46 * k, 0, 2.2, 1.2, 0.4, 0.85 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 14, f.y + Math.sin(f.ang) * 14, 40 * k, 12 * k, f.ang, 2.4, 1.5, 0.6, 0.9 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 22 * k, 5 * k, f.ang + s2 * 1.2, 2, 1.2, 0.5, 0.6 * k, 1);
      } else if (f.kind === 'aux') {
        b.draw(F.glow, f.x, f.y, 24 * k, 24 * k, 0, 2.2, 1.3, 0.5, 0.7 * k, 1);
      } else if (f.kind === 'core') {
        b.draw(F.glow, f.x, f.y, 260 * k, 220 * k, 0, 2, 0.5, 0.15, 0.7 * k, 1);
        b.draw(F.ring, f.x, f.y, 300 * (1 - k), 260 * (1 - k), 0, 2.2, 0.7, 0.2, 0.8 * k, 1);
      }
    }
    // Drive hub heat (deep-core charge, overdrive).
    if (this.cutterOK && (this.dc || this.critical) && this.c.state === 'fight') {
      const h = this._scr(this.M.cutS, 0, 0, 44), k = Math.min(1, this.hubGlow / 3);
      b.draw(F.glow, h[0], h[1], (40 + 60 * k) * h[2], (40 + 60 * k) * h[2], 0, 2, 0.45, 0.12, 0.25 + 0.4 * k * (0.8 + 0.2 * Math.sin(t * 0.6)), 1);
    }
    for (const e of this.erupts) {
      const k = 1 - e.t / e.life;
      b.draw(F.glow, e.x, e.y, 70 * k + 20, 60 * k + 16, 0, 2.2, 0.7, 0.2, 0.75 * k, 1);
    }
    // Bore lane: chevrons rolling down the lane while it winds up.
    if (this.bore && this.bore.phase === 'prep') {
      const r = this.bore, y0 = this._tipRow(), blink = (t >> 2) & 1 ? 1 : 0.55;
      for (let k = 0; k < 7; k++) {
        const y = y0 + 30 + ((k * 46 + r.t * 3) % 300);
        if (y > H) continue;
        for (const s2 of [-1, 1]) b.draw(KF.laser, r.lx + s2 * 12, y, 30, 4, Math.PI / 2 - s2 * 0.75, 2.2, 1.1, 0.3, 0.6 * blink, 1);
      }
    }
    // Burning parts.
    for (const f of this.fires) {
      if (f.x === undefined) continue;
      const q = this.cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.i * 3);
      b.draw(F.glow, q[0], q[1], 30 * f.s * fl, 26 * f.s * fl, 0, 2, 0.7, 0.2, 0.55, 1);
    }
  }

  dispose() {
    if (this.view) { const i = this.view.extras.indexOf(this); if (i >= 0) this.view.extras.splice(i, 1); this.view.speedTarget = null; }
  }
}

const SPOIL_R = { shape: 'orb', color: 'orange', angVel: 0.006 };
const SPOIL_L = { shape: 'orb', color: 'orange', angVel: -0.006 };
const BIG_R = { shape: 'bigorb', color: 'orange', angVel: -0.009 };
const BIG_L = { shape: 'bigorb', color: 'orange', angVel: 0.009 };
const SNAP = { shape: 'bigorb', color: 'orange', n: 1, speed: 3.0, fixed: true, split: { shape: 'rice', color: 'yellow', n: 5, speed: 2.0 }, splitAt: 55 };

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

/** Matrix mapping the unit cylinder (y 0..1, radius 1) onto segment a → b with radius r. */
function spanM(a, b, r, o) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / L, fy = dy / L, fz = dz / L;
  // x axis: horizontal, perpendicular to the segment; z axis completes the frame.
  let xx = -fy, xy = fx, xz = 0;
  const xl = Math.hypot(xx, xy) || 1; xx /= xl; xy /= xl;
  const zx = xy * fz - xz * fy, zy = xz * fx - xx * fz, zz = xx * fy - xy * fx;
  o.fill(0);
  o[0] = xx * r; o[1] = xy * r; o[2] = xz * r;
  o[4] = dx; o[5] = dy; o[6] = dz;
  o[8] = zx * r; o[9] = zy * r; o[10] = zz * r;
  o[12] = a[0]; o[13] = a[1]; o[14] = a[2]; o[15] = 1;
  return o;
}

/** Point inside a projected quad (any winding), with `pad` units of grace. */
function inQuad(q, x, y, pad) {
  const sg = (q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0]) > 0 ? 1 : -1;
  for (let k = 0; k < 4; k++) {
    const ax = q[k * 2], ay = q[k * 2 + 1], bx = q[((k + 1) % 4) * 2], by = q[((k + 1) % 4) * 2 + 1];
    const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
    if (((ex * (y - ay) - ey * (x - ax)) / l) * sg < -pad) return false;
  }
  return true;
}

export { TIP_HOME };
