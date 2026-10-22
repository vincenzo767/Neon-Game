import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT, FADE_INOUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer, SAND_LOOK } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { SB, buildSandbreaker } from '../../world/tank/sandbreakerModel.js';
import { TrackTrail } from '../../world/tank/TrackTrail.js';
import { TL } from '../../world/tank/tankTextures.js';
import { railX, RAIL } from '../../world/env/railLine.js';

// SANDBREAKER runtime rig: the boss as a real train on the Dune Sea main line.
//
//   Track      the locomotive's position is ONE number (world y along the
//              shared rail line, world/env/railLine.js). Every vehicle is
//              placed from its two rail pivots (driver group / bogies), so
//              heading follows the curve and the wheels stay on the rails.
//   Couplings  cars are chained behind with buffer gaps + slack: the slack
//              answers the locomotive's acceleration a few steps later per car
//              (stretch when it pulls, buffers bunch when it brakes, clank).
//   Speed      the train has a real speed (wheel spin ω = v / r, chuffs,
//              dust, rail clack). The camera rides with the convoy at its
//              cruise speed (the arena scrolls BACKWARD: the train advances
//              toward the player while the field streams up the screen), and
//              the train holds its screen row by accelerating / braking
//              relative to it — so a ram is a genuine surge down the line.
//   Weapons    loco: two side cannons (yaw, alternating barrels), twin main
//              battery (yaw, load, telegraph, recoil), mortar battery
//              (elevates). Artillery car: heavy howitzer (yaw + elevation),
//              two rotary guns (yaw + barrel spin). Rocket car: two launchers
//              (yaw + elevation). Every bullet, shell, rocket and telegraph
//              leaves from its muzzle on the 3D model.
//   Parts      nine breakable mounts (BossKit parts riding the projected
//              mounts); a broken mount stays broken, its attacks stop; losing
//              all of a car's weapons disables (burns) that car.
//
// The BossController still owns HP, phases, transitions and the death
// timeline. Without an arena world the rig runs on a flat camera and the
// boss shows its 2D fallback sprite.

const HOME_ROW = 360;     // screen row of the ram tip while cruising
const CRUISE = 1.4;       // convoy speed (world units / step)
const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pmod = (a, n) => ((a % n) + n) % n;

const L0 = SB.loco;
// Vehicles in train order: extents along model y and the two rail pivots.
const VEH = [
  { kind: 'loco', front: L0.front, rear: L0.rear, piv: L0.pivots, mesh: 'sb.loco' },
  ...SB.cars.map((c, i) => ({ kind: c.kind, front: c.half, rear: -c.half, piv: [c.bogies[0], c.bogies[1]], mesh: `sb.car${i + 1}`, car: c })),
];
const GAP = [0, 14, 18, 18];   // end-to-end distance with buffers touching
const NV = VEH.length;

const SPEC = {
  goldN: { shape: 'rice', color: 'orange', n: 5, spread: 0.32, speed: 3.4 },
  goldW: { shape: 'orb', color: 'orange', n: 9, spread: 1.15, speed: 2.3 },
  goldMk: { shape: 'rice', color: 'yellow', n: 3, spread: 0.6, speed: 2.8 },
  mbShell: { shape: 'bigorb', color: 'orange', n: 1, speed: 4.0, fixed: true, split: { shape: 'rice', color: 'orange', n: 8, speed: 2.2 }, splitAt: 62 },
  mbWake: { shape: 'rice', color: 'orange', n: 3, spread: 0.5, speed: 2.6 },
  frag: { shape: 'orb', color: 'orange', n: 10, speed: 1.7 },
  fragBig: { shape: 'rice', color: 'orange', n: 14, speed: 2.0 },
  cross: { shape: 'rice', color: 'orange', n: 2, spread: 0.08, speed: 3.6 },
  crossR: { shape: 'orb', color: 'orange', n: 1, speed: 3.0 },
  sweep: { shape: 'orb', color: 'orange', n: 1, speed: 2.5 },
  sweepMk: { shape: 'rice', color: 'yellow', n: 1, speed: 3.1 },
  rocketFrag: { shape: 'orb', color: 'orange', n: 6, speed: 1.9 },
  debris: { shape: 'rice', color: 'orange', n: 1, speed: 2.6, fixed: true },
};

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x; out[1] = -y; out[2] = 1; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx; out[1] = -sy; out[2] = h; return out; },
  frame() {},
};

const mat = () => new Float32Array(16);
const pair = () => [mat(), mat()];

export class SandbreakerRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    // Track state (sim + previous step for render interpolation).
    this.Y = 0; this.pY = 0;           // locomotive origin, world y along the line
    this.v = 0; this.acc = 0;          // train speed (forward = -y), last step's change
    this.dist = 0; this.pdist = 0;     // odometer (wheel rotation)
    this.cv = 0;                       // camera / convoy speed
    this.cruiseT = CRUISE;
    this.ctrlCam = false;
    this.mode = 'enter';
    this.rowT = HOME_ROW;
    this.hold = 0;                     // steps left of "stabilise for artillery"
    this.slack = new Float32Array(NV); this.pslack = new Float32Array(NV); this.slackV = new Float32Array(NV);
    this.accHist = new Float32Array(64);
    this.bob = new Float32Array(NV); this.pitch = new Float32Array(NV); this.roll = new Float32Array(NV); this.kick = new Float32Array(NV);
    this.vp = VEH.map(() => ({ x: 0, y: 0, h: 0, Y: 0 }));
    this.skew = 0;                     // death: the locomotive slews off line a little
    // Weapons.
    this.scY = [0, 0]; this.scR = [[0, 0], [0, 0]]; this.scAlt = [0, 0]; this.scAim = [null, null]; this.scErr = [1, 1]; this.scHeat = [0, 0]; this.scN = [0, 0];
    this.ty = 0; this.mbR = [0, 0]; this.mbs = null; this.mbHeat = 0; this.mbLoad = 0;
    this.el = 0; this.elT = 0;
    this.hy = 0; this.he = 0; this.heT = 0; this.hR = [0, 0]; this.howAim = null;
    this.ry = [0, 0]; this.rs = [0, 0]; this.rv = [0, 0]; this.rAim = [null, null]; this.rHeat = [0, 0];
    this.py = [0, 0]; this.pe = [0, 0]; this.peT = [0, 0];
    this.radar = 0;
    this.dead = { cannon: [false, false], main: [false], mortar: [false], rotary: [false, false], how: [false], rocket: [false, false] };
    this.carDead = [false, false, false, false];
    this.partHp = {};
    this.partEnt = {};
    // Attacks in flight.
    this.shells = []; this.rockets = []; this.flashes = []; this.fires = [];
    this.heavy = null; this.queue = null;
    this.siege = null; this.sweep = null; this.salvo = null; this.storm = null; this.ram = null;
    this.stormA = 0;
    this.trail = new TrackTrail(190, 1);
    this.M = {
      veh: VEH.map(mat), body: VEH.map(mat), sc: pair(), scb: [pair(), pair()], tur: mat(), mb: pair(), mor: mat(),
      how: mat(), hb: pair(), rot: pair(), gat: pair(), pod: pair(), radar: mat(),
      tmp: mat(), tmp2: mat(), tmp3: mat(), w: mat(), cpl: mat(), pad: mat(), rod: mat(),
    };
    this.t = 0;
    this.deathT = -1;
    this.wreck = false;
    this.placed = false;
    this.flash = 0;
    this.pop = 0; this.popV = 0; this.popA = 0;
    this.pr = [0, 0, 0, 0];
    this.wp3 = [0, 0, 0];
    this.q3 = [0, 0, 0];
    this.chuffD = 0; this.clackD = 0; this.clankCd = 0;
  }

  get is3D() { return !!this.view && !this.cam.ortho; }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view) {
      const row = this.placed ? this._noseRow() : null;
      if (this.view) {
        const i = this.view.extras.indexOf(this);
        if (i >= 0) this.view.extras.splice(i, 1);
        if (this.ctrlCam) { this.view.speedTarget = this.view.baseSpeed; }
      }
      this.view = v && v.cam ? v : null;
      this.cam = this.view ? this.view.cam : ORTHO;
      this.ctrlCam = false;
      if (this.view) {
        this.view.extras.push(this);
        if (!this.wreck && !this.released) {
          // The convoy owns the scroll for the duel: the field streams backward under the train.
          this.ctrlCam = true;
          this.view.speedTarget = null;
          if (!this.placed) this.cv = -this.view.speed;
          this.view.speed = -this.cv;
        }
      }
      this.trail.clear();
      if (this.view) this.cam.frame(1);
      if (row !== null) this._placeAt(row); // a new arena world: keep the train where it was on screen
    }
    if (this.view) this.cam.frame(1);
  }

  /** Screen point → world point on the ground. */
  _world(sx, sy, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, this.view ? this.view.floorZ : 0, out) || out; }

  /** Put the ram tip on screen row `row` (world y from the camera). */
  _placeAt(row) {
    const p = this._world(W / 2, row, [0, 0, 0]);
    this.Y = this.pY = p[1] + L0.front;
    this.slack.fill(0); this.pslack.fill(0);
    this._pose(1);
  }

  _noseRow() {
    const m = this.M.veh[0], q = M4.point(m, 0, L0.front, 10, this.q3);
    return this.cam.project(q[0], q[1], q[2], this.pr)[1];
  }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e;
    this._attach();
    if (!this.placed) {
      this.placed = true;
      this._placeAt(c.state === 'enter' ? -200 : HOME_ROW);
      this.v = c.state === 'enter' ? this.cv + 3 : this.cv;
    }
    this.pY = this.Y; this.pdist = this.dist; this.pslack.set(this.slack);
    this.t++;
    this.trail.step();

    switch (c.state) {
      case 'enter':
        this.mode = 'enter'; this.rowT = HOME_ROW;
        if (c.st === 40 && this.is3D) sfx.play('trainHorn', { pan: 0 });
        break;
      case 'fight': this._fight(); break;
      case 'transition': this.mode = 'cruise'; this.rowT = this._homeRow(); this._endAttacks(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._drive();
    this._couplings();
    this._suspension();
    this._weaponsAnim();
    this._pose(1);
    // The boss entity rides the locomotive's forward half (where shots from below land first).
    const pc = this._scr(this.M.body[0], 0, 60, 46);
    e.x = pc[0]; e.y = pc[1];
    e.rot = 0;
    e.scale = this.pr[2] || 1;
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._updateMain();
    this._updateSiege();
    this._updateShells();
    this._updateSweep();
    this._updateSalvo();
    this._updateRockets();
    this._updateStorm();
    this._updateRam();
    this._runQueue();
    if (this.is3D) { this._fx(); this._sound(); }
    for (let i = this.flashes.length - 1; i >= 0; i--) if (++this.flashes[i].t >= this.flashes[i].life) this.flashes.splice(i, 1);
  }

  _homeRow() { const ph = this.c.phase; return (ph && ph.move && ph.move.row) || HOME_ROW; }

  _fight() {
    const ph = this.c.phase || {};
    this.cruiseT = ((ph.move && ph.move.cruise) || CRUISE) * (this.hold > 0 ? 0.45 : 1);
    if (this.hold > 0) this.hold--;
    if (this.ram) return; // the ram owns the drive
    this.mode = 'cruise';
    this.rowT = this._homeRow() + Math.sin(this.t * 0.011) * 10;
  }

  // -------------------------------------------------------------- drive

  _drive() {
    const dying = this.c.state === 'dying';
    if (this.ctrlCam && this.view) {
      const cT = dying ? 0 : this.c.state === 'enter' || this.c.state === 'transition' ? CRUISE : this.cruiseT;
      const rate = this.c.state === 'enter' ? 0.03 : 0.012; // the field reverses quickly as the convoy arrives
      this.cv += clamp(cT - this.cv, -rate, rate);
      this.view.speed = -this.cv;
    }
    const v0 = this.v;
    switch (this.mode) {
      case 'charge': this.v += clamp(this.cv + this.ram.boost - this.v, -0.2, 0.14); break;
      case 'brake': this.v += clamp(this.cv - 1.1 - this.v, -0.17, 0.05); break;
      // Brakes locked: the camera rides the slide down to a stop with the wreck.
      case 'dead': this.v += clamp((this.ctrlCam ? this.cv : 0) - this.v, -0.03, 0.03); break;
      default: {
        // Hold the screen row: critically damped (gain g, stiffness g / 4), rate limited.
        const g = this.mode === 'enter' ? 0.05 : 0.06, err = this.rowT - this._noseRow();
        const want = this.cv + clamp(err * g * 0.25, -2.2, this.mode === 'enter' ? 5.5 : 3.2);
        this.v += clamp((want - this.v) * g, -0.09, 0.09);
      }
    }
    if (!this.view) this.v = 0;
    this.v = Math.max(0, this.v);
    this.acc = this.v - v0;
    this.Y -= this.v;
    this.dist += this.v;
    this.accHist[this.t & 63] = this.acc;
  }

  /** Coupling slack: each car answers the pull / push a few steps after the one ahead. */
  _couplings() {
    for (let k = 1; k < NV; k++) {
      const a = this.accHist[(this.t - k * 5) & 63];
      const target = clamp(a * 46, -1.6, 4);
      const prev = this.slackV[k];
      this.slackV[k] = (this.slackV[k] + (target - this.slack[k]) * 0.09) * 0.84;
      this.slack[k] = clamp(this.slack[k] + this.slackV[k], -1.6, 4.5);
      // Buffers slamming together after a pull (or a hard brake) clank.
      if (prev > 0.06 && this.slackV[k] <= 0 && this.slack[k] < 0.5 && this.clankCd <= 0 && this.is3D) {
        this.clankCd = 18;
        sfx.play('coupleClank', { pan: 0 });
        const p = this._cplPoint(k);
        this.view.fx._spark(p[0], p[1], p[2], 4);
      }
    }
    if (this.clankCd > 0) this.clankCd--;
  }

  _suspension() {
    const sp = Math.min(1.4, this.v / 2), R = this.w.fxRng, c = this.c;
    for (let k = 0; k < NV; k++) {
      const V = VEH[k], Yk = this.vp[k].Y || this.Y;
      // Rail joints under each pivot: a little dip right after the wheels cross.
      let j = 0;
      for (const p of V.piv) j += Math.exp(-pmod(-(Yk - p), RAIL.joint) / RAIL.joint * 16);
      const bobT = -j * 0.7 * sp + this.kick[k] * 0.4;
      this.bob[k] += (bobT - this.bob[k]) * 0.35;
      this.pitch[k] += (clamp(-this.acc * 5, -0.03, 0.03) - this.kick[k] * 0.01 - this.pitch[k]) * 0.15;
      // Lean into the curve.
      const sl = (railX(Yk - 40) - railX(Yk + 40)) / 80, sl0 = this.vp[k].h;
      this.roll[k] += (clamp((sl - sl0) * this.v * 2, -0.02, 0.02) - this.roll[k]) * 0.1;
      this.kick[k] *= 0.8;
      const shake = c.state === 'dying' ? 1 : c.state === 'transition' ? 0.6 * (1 - c.st / 144) : this.ram && this.ram.phase === 'announce' ? 0.6 : 0;
      if (shake && k < 2) { this.bob[k] += R.range(-0.5, 0.5) * shake; this.roll[k] += R.range(-0.003, 0.003) * shake; }
    }
    if (this.popV || this.pop) {
      this.popV -= 0.3;
      this.pop = Math.max(0, this.pop + this.popV);
      if (this.pop === 0 && this.popV < 0) this.popV = Math.abs(this.popV) > 2 ? -this.popV * 0.25 : 0;
      if (this.popV) this.popA += 0.05;
    }
  }

  /** Slew / settle every mount toward its current aim. */
  _weaponsAnim() {
    const w = this.w, live = this.c.state === 'fight' || this.c.state === 'enter';
    const player = this._world(w.aimX, w.aimY, [0, 0, 0]);
    // Side cannons: within their sponson arcs.
    for (let i = 0; i < 2; i++) {
      for (let b = 0; b < 2; b++) this.scR[i][b] *= 0.82;
      this.scHeat[i] = Math.max(0, this.scHeat[i] - 0.008);
      if (this.dead.cannon[i] || !live) continue;
      const lo = i ? -1.5 : -0.35, hi = i ? 0.35 : 1.5;
      const want = clamp(this._yawTo(0, L0.cannons[i], this.scAim[i] || player), lo, hi);
      this.scY[i] += clamp(wrapA(want - this.scY[i]), -0.045, 0.045);
      this.scErr[i] = Math.abs(wrapA(want - this.scY[i]));
    }
    // Main battery tracks the player (slower while loading, locked while firing).
    const mb = this.mbs;
    if (live && !this.dead.main[0]) {
      const rate = mb ? (mb.phase === 'fire' ? 0 : mb.phase === 'load' ? 0.006 : 0.024) : 0.01;
      this.ty += clamp(wrapA(clamp(this._yawTo(0, L0.turret, player), -0.5, 0.5) - this.ty), -rate, rate);
    }
    for (let b = 0; b < 2; b++) { this.mbR[b] *= 0.88; this.hR[b] *= 0.86; }
    this.mbHeat = Math.max(0, this.mbHeat - 0.006);
    this.mbLoad = mb && mb.phase === 'load' ? Math.min(1, this.mbLoad + 0.025) : Math.max(0, this.mbLoad - 0.08);
    // Mortar battery and howitzer elevation.
    this.el += clamp((this.dead.mortar[0] ? 0 : this.elT) - this.el, -0.035, 0.035);
    this.he += clamp((this.dead.how[0] ? 0 : this.heT) - this.he, -0.03, 0.03);
    if (live && !this.dead.how[0] && !this.carDead[1]) {
      const want = clamp(this._yawTo(1, SB.cars[0].how, this.howAim || player), -0.7, 0.7);
      this.hy += clamp(wrapA(want - this.hy), -0.02, 0.02);
    }
    // Rotary guns: yaw toward their aim, barrels spin with the fire rate.
    for (let i = 0; i < 2; i++) {
      this.rs[i] += this.rv[i];
      this.rHeat[i] = Math.max(0, this.rHeat[i] - 0.006);
      if (!this.sweep && !this.rFiring) this.rv[i] *= 0.97;
      if (this.dead.rotary[i] || !live || (this.sweep && this.sweep.phase === 'sweep')) continue;
      const want = clamp(this._yawTo(1, SB.cars[0].rot[i], this.rAim[i] || player), -1.6, 1.6);
      this.ry[i] += clamp(wrapA(want - this.ry[i]), -0.035, 0.035);
    }
    this.rFiring = false;
    // Rocket pods: raise for a salvo, stow otherwise.
    for (let i = 0; i < 2; i++) {
      const t = this.dead.rocket[i] ? 0 : this.peT[i];
      this.pe[i] += clamp(t - this.pe[i], -0.025, 0.025);
      if (live && !this.dead.rocket[i]) this.py[i] += clamp(wrapA(clamp(this._yawTo(2, SB.cars[1].pods[i], player), -0.4, 0.4) - this.py[i]), -0.012, 0.012);
    }
    if (!this.wreck) this.radar += 0.035;
  }

  /** Yaw (model rotZ convention) that points a mount on vehicle k at world point t. */
  _yawTo(k, pivot, t) {
    const p = this.vp[k], cs = Math.cos(p.h), sn = Math.sin(p.h);
    const dx = t[0] - p.x, dy = t[1] - p.y;
    const lx = dx * cs + dy * sn - pivot[0], ly = dx * sn - dy * cs - pivot[1];
    return Math.atan2(-lx, ly);
  }

  // ---------------------------------------------------------------- pose

  /** Place every vehicle on the rails and fill the part matrices (render alpha). */
  _pose(alpha) {
    const M = this.M, T = M.tmp, T2 = M.tmp2;
    const z0 = this.view ? this.view.floorZ : 0;
    let Yk = lerp(this.pY, this.Y, alpha);
    for (let k = 0; k < NV; k++) {
      const V = VEH[k];
      if (k) Yk += -VEH[k - 1].rear + GAP[k] + lerp(this.pslack[k], this.slack[k], alpha) + V.front;
      const yf = Yk - V.piv[0], yr = Yk - V.piv[1];
      const xf = railX(yf), xr = railX(yr), dx = xf - xr, dy = yf - yr;
      let h = Math.atan2(dx, -dy);
      const t = -V.piv[1] / (V.piv[0] - V.piv[1]);
      let ox = xr + dx * t, oy = yr + dy * t;
      if (k === 0 && this.skew) { h += this.skew; ox += this.skew * 40; }
      const vp = this.vp[k];
      vp.x = ox; vp.y = oy; vp.h = h; vp.Y = Yk;
      const cs = Math.cos(h), sn = Math.sin(h), Wm = M.veh[k];
      Wm.fill(0); Wm[0] = cs; Wm[1] = sn; Wm[4] = sn; Wm[5] = -cs; Wm[10] = 1; Wm[12] = ox; Wm[13] = oy; Wm[14] = z0; Wm[15] = 1;
      // Sprung body: bob, pitch, roll about a pivot just above the frame.
      const B = M.body[k];
      M4.mul(Wm, M4.trans(0, 0, this.bob[k] + 30, T), B);
      M4.mul(B, M4.rotX(this.pitch[k], T), B);
      M4.mul(B, M4.rotY(this.roll[k] + (k === 0 ? this.skew * 0.8 : 0), T), B);
      M4.mul(B, M4.trans(0, 0, -30, T), B);
    }
    const B0 = M.body[0], B1 = M.body[1], B2 = M.body[2], B3 = M.body[3];
    // Locomotive mounts.
    for (let i = 0; i < 2; i++) {
      M4.mul(B0, M4.trans(L0.cannons[i][0], L0.cannons[i][1], L0.cannons[i][2], T), M.sc[i]);
      M4.mul(M.sc[i], M4.rotZ(this.scY[i], T2), M.sc[i]);
      for (let b = 0; b < 2; b++) M4.mul(M.sc[i], M4.trans(L0.scBarrels[b][0], L0.scBarrels[b][1] - this.scR[i][b] * 6, L0.scBarrels[b][2], T), M.scb[i][b]);
    }
    M4.mul(B0, M4.trans(L0.turret[0], L0.turret[1], L0.turret[2] + this.pop, T), M.tur);
    M4.mul(M.tur, M4.rotZ(this.ty, T), M.tur);
    if (this.popA) { M4.mul(M.tur, M4.rotX(Math.sin(this.popA) * 0.45, T), M.tur); M4.mul(M.tur, M4.rotY(this.popA * 0.3, T), M.tur); }
    for (let b = 0; b < 2; b++) M4.mul(M.tur, M4.trans(L0.mbBarrels[b][0], L0.mbBarrels[b][1] - this.mbR[b] * 11, L0.mbBarrels[b][2], T), M.mb[b]);
    M4.mul(B0, M4.trans(L0.mortar[0], L0.mortar[1], L0.mortar[2], T), M.mor);
    M4.mul(M.mor, M4.rotX(this.el, T), M.mor);
    // Artillery car.
    const C1 = SB.cars[0];
    M4.mul(B1, M4.trans(C1.how[0], C1.how[1], C1.how[2], T), M.how);
    M4.mul(M.how, M4.rotZ(this.hy, T), M.how);
    for (let b = 0; b < 2; b++) {
      M4.mul(M.how, M4.trans(C1.howBarrels[b][0], C1.howBarrels[b][1], C1.howBarrels[b][2], T), M.hb[b]);
      M4.mul(M.hb[b], M4.rotX(this.he, T), M.hb[b]);
      M4.mul(M.hb[b], M4.trans(0, -this.hR[b] * 8, 0, T), M.hb[b]);
    }
    for (let i = 0; i < 2; i++) {
      M4.mul(B1, M4.trans(C1.rot[i][0], C1.rot[i][1], C1.rot[i][2], T), M.rot[i]);
      M4.mul(M.rot[i], M4.rotZ(this.ry[i], T), M.rot[i]);
      M4.mul(M.rot[i], M4.trans(C1.gatling[0], C1.gatling[1], C1.gatling[2], T), M.gat[i]);
      M4.mul(M.gat[i], M4.rotY(this.rs[i], T), M.gat[i]);
    }
    // Rocket car, command car.
    const C2 = SB.cars[1];
    for (let i = 0; i < 2; i++) {
      M4.mul(B2, M4.trans(C2.pods[i][0], C2.pods[i][1], C2.pods[i][2], T), M.pod[i]);
      M4.mul(M.pod[i], M4.rotZ(this.py[i], T), M.pod[i]);
      M4.mul(M.pod[i], M4.rotX(this.pe[i], T), M.pod[i]);
    }
    const C3 = SB.cars[2];
    M4.mul(B3, M4.trans(C3.radar[0], C3.radar[1], C3.radar[2], T), M.radar);
    M4.mul(M.radar, M4.rotZ(this.radar, T), M.radar);
    this.alphaDist = lerp(this.pdist, this.dist, alpha);
  }

  /** Local point under matrix m → screen [sx, sy, k, depth] (world point left in this.wp3). */
  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.wp3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + screen-space firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    const r = { x: ax, y: ay, ang: Math.atan2(b[1] - ay, b[0] - ax) };
    this._scr(m, pt[0], pt[1], pt[2]); // leave the muzzle's world point in wp3
    return r;
  }

  /** World point of coupling k (between vehicle k-1 and k), on the rail line. */
  _cplPoint(k) {
    return M4.point(this.M.veh[k], 0, VEH[k].front + (GAP[k] + this.slack[k]) / 2, SB.couplerZ, [0, 0, 0]);
  }

  // --------------------------------------------------------------- parts

  isDestroyed(kind, i) { return this.dead[kind][i]; }

  partSpawned(kind, i, pe) {
    const key = `${kind}${i}`;
    if (this.partHp[key] !== undefined) pe.hp = Math.min(pe.hp, this.partHp[key]);
    pe.maxHp = pe.maxHp || pe.hp;
    this.partEnt[key] = pe;
    if (this.is3D) pe.f = null;
  }

  partCleared(kind, i, part) { this.partHp[`${kind}${i}`] = part.e.hp; }

  /** Mount anchor (matrix + local point) for a part kind. */
  _mountAt(kind, i) {
    const M = this.M;
    switch (kind) {
      case 'cannon': return [M.sc[i], 0, 4, 8];
      case 'main': return [M.tur, 0, 4, 12];
      case 'mortar': return [M.mor, 0, 16, 10];
      case 'how': return [M.how, 0, 2, 12];
      case 'rotary': return [M.rot[i], 0, 0, 8];
      case 'rocket': return [M.pod[i], 0, 4, 16];
      default: return [M.body[0], 0, 0, 40];
    }
  }

  partDestroyed(kind, i) {
    const w = this.w;
    this.dead[kind][i] = true;
    const [m, x0, y0, z0] = this._mountAt(kind, i);
    const p = this._scr(m, x0, y0, z0), x = p[0], y = p[1];
    w.explosions.blast(x, y, 1.4, [1, 0.6, 0.25]);
    w.explosions.schedule(6, () => w.explosions.blast(x + w.fxRng.range(-14, 14), y + w.fxRng.range(-10, 10), 0.8, [1, 0.45, 0.15]));
    w.explosions.sparks(x, y, 26, [1, 0.75, 0.35], 6, 30, 4);
    w.g.camera.addTrauma(0.3);
    w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35);
    this._debris(x, y, 10);
    sfx.play('partDown', { pan: (x - W / 2) / W });
    this.fires.push({ kind, i, s: kind === 'main' || kind === 'how' ? 0.9 : 0.6 });
    if (kind === 'main') this.mbs = null;
    if (kind === 'rocket') this.peT[i] = 0;
    // A car with every weapon gone is disabled: it burns and is towed along.
    if (!this.carDead[1] && this.dead.rotary[0] && this.dead.rotary[1] && this.dead.how[0]) this._disableCar(1);
    if (!this.carDead[2] && this.dead.rocket[0] && this.dead.rocket[1]) this._disableCar(2);
  }

  _disableCar(k) {
    const w = this.w, V = VEH[k];
    this.carDead[k] = true;
    if (k === 1) { this.sweep = null; if (this.heavy === 'sweep') this.heavy = null; }
    if (k === 2) { this.salvo = null; if (this.heavy === 'rocket') this.heavy = null; }
    for (let n = 0; n < 5; n++) {
      w.explosions.schedule(n * 7, () => {
        const q = this._scr(this.M.body[k], w.fxRng.range(-36, 36), w.fxRng.range(V.rear * 0.8, V.front * 0.8), 44);
        w.explosions.blast(q[0], q[1], w.fxRng.range(0.9, 1.5), [1, 0.5, 0.18]);
        w.g.camera.addTrauma(0.12);
      });
    }
    sfx.play('explode3', { pan: 0 });
    // Fires ride the car (it is still being towed), so they live in the rig, not on the ground.
    for (const ly of [V.front * 0.5, 0, V.rear * 0.5]) this.fires.push({ car: k, lx: w.fxRng.range(-24, 24), ly, s: 1.1 });
  }

  /** Mount hitboxes ride the projected mounts. */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const d = part.d, pe = part.e;
      const [m, x0, y0, z0] = this._mountAt(d.mount, d.side);
      const q = this._scr(m, x0, y0, z0);
      pe.x = q[0]; pe.y = q[1];
      if (this.is3D) pe.f = null;
      // Mounts on the long train ride off the top of the screen at times: never let
      // World's off-screen / age cull take them (they stay until destroyed or the phase ends).
      pe.entered = false;
      if (pe.t > 1800) pe.t = 1800;
    }
  }

  /** Body contact: every vehicle's footprint (the ram is the business end). */
  _contact() {
    const c = this.c, w = this.w, p = w.player;
    if (c.state !== 'fight' || !p || !p.collidable || p.invulnerable) return;
    for (let k = 0; k < NV; k++) {
      const V = VEH[k], hw = k === 0 ? 74 : 50;
      const q = this._quad(this.M.veh[k], hw, V.rear, V.front);
      if (q[1] > H + 40 && q[5] > H + 40) continue;
      if (inQuad(q, p.x, p.y, -4)) { p.hit(); return; }
    }
  }

  _quad(m, hw, y0, y1) {
    const q = this.quadBuf || (this.quadBuf = new Float32Array(8));
    let i = 0;
    for (const [lx, ly] of [[-hw, y0], [hw, y0], [hw, y1], [-hw, y1]]) { const a = this._scr(m, lx, ly, 20); q[i++] = a[0]; q[i++] = a[1]; }
    return q;
  }

  // ---------------------------------------------------- attack: barrage

  get quiet() { return !!((this.ram && this.ram.phase !== 'recover') || (this.storm && this.storm.phase === 'strike')); }

  /** Golden Barrage: side cannons pick lanes either side of the player and fire alternating narrow / wide fans. */
  barrage(t, rate = 1) {
    const w = this.w, c = this.c;
    if (this.quiet) return;
    const k = Math.max(8, Math.round(46 / (rate * (c.intensity || 1) * (1 + 0.15 * (c.mk - 1)))));
    const off = ((t / 180) | 0) % 2 ? 70 : 34;
    for (let i = 0; i < 2; i++) {
      if (this.dead.cannon[i]) continue;
      const lane = clamp(w.aimX + (i ? off : -off), 30, W - 30);
      this.scAim[i] = this._world(lane, w.aimY, this.scAim[i] || [0, 0, 0]);
      if ((t + i * (k >> 1)) % k !== 0 || this.scErr[i] > 0.3) continue;
      const wide = this.scN[i]++ % 2 === 1;
      this._cannonShot(i, wide ? SPEC.goldW : SPEC.goldN);
      if (c.mk >= 2 || (c.intensity || 1) > 1.05) this._cannonShot(i, SPEC.goldMk, true);
    }
  }

  _cannonShot(i, spec, same = false) {
    const w = this.w;
    if (!same) this.scAlt[i] = 1 - this.scAlt[i];
    const b = this.scAlt[i];
    const mz = this._muzzle(this.M.scb[i][b], L0.scMuzzle);
    P.fan(w, mz.x, mz.y, mz.ang, spec);
    if (same) return;
    this.scR[i][b] = 1;
    this.scHeat[i] = Math.min(1, this.scHeat[i] + 0.12);
    this.kick[0] += 0.4;
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 7, kind: 'cannon' });
    if (this.is3D) { const q = this.wp3; this.view.fx._smoke(q[0], q[1], q[2], 0.35, 0.35, 0.6); }
    sfx.play('cannonFire', { pan: (mz.x - W / 2) / W });
  }

  // ------------------------------------------------ attack: main battery

  /** Twin main battery: acquire → load (breech glow + aim telegraph) → alternating heavy shells → cool. */
  mainSalvo() {
    if (this.c.state !== 'fight' || this.dead.main[0] || this.mbs || this.quiet) return false;
    this.mbs = { phase: 'aim', t: 0, shots: 0 };
    return true;
  }

  _updateMain() {
    const S = this.mbs, w = this.w, c = this.c;
    if (!S) return;
    if (c.state !== 'fight' || this.dead.main[0]) { this.mbs = null; return; }
    S.t++;
    if (S.phase === 'aim' && S.t > 26) { S.phase = 'load'; S.t = 0; this.hold = Math.max(this.hold, 90); }
    else if (S.phase === 'load' && S.t >= Math.round(48 / Math.min(1.25, c.intensity || 1))) { S.phase = 'fire'; S.t = 0; }
    else if (S.phase === 'fire') {
      if (S.t === 1 || S.t === 9 || (c.mk >= 2 && (S.t === 17 || S.t === 25))) {
        const b = S.shots++ % 2, mz = this._muzzle(this.M.mb[b], L0.mbMuzzle);
        P.shoot(w, mz.x, mz.y, mz.ang, SPEC.mbShell.speed, SPEC.mbShell);
        P.fan(w, mz.x, mz.y, mz.ang, SPEC.mbWake);
        this.mbR[b] = 1;
        this.mbHeat = Math.min(1, this.mbHeat + 0.45);
        this.kick[0] += 1.6;
        this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 11, kind: 'main' });
        w.explosions.sparks(mz.x, mz.y, 10, [1, 0.8, 0.4], 5, 16, 3);
        w.g.camera.addTrauma(0.16);
        w.g.renderer.post.shockwave(mz.x, mz.y, 0.015, 0.02, 0.22);
        if (this.is3D) { const q = this.wp3; for (let n = 0; n < 3; n++) this.view.fx._smoke(q[0], q[1], q[2], 0.5, 0.4, 0.7); }
        sfx.play('heavyCannon', { pan: (mz.x - W / 2) / W });
      }
      if (S.t > 34) { S.phase = 'cool'; S.t = 0; }
    } else if (S.phase === 'cool' && S.t > 40) this.mbs = null;
  }

  // ---------------------------------------------- attack: siege artillery

  /** Siege Artillery: mortar battery + howitzer lob marked shells; the convoy steadies to fire. */
  startSiege(n = 0) {
    if (!this._canHeavy('siege') || (this.dead.mortar[0] && (this.dead.how[0] || this.carDead[1]))) return false;
    this.heavy = 'siege';
    this.siege = { t: 0, n: n || (this.c.mk >= 2 ? 4 : 3), fired: 0 };
    this.hold = Math.max(this.hold, 150);
    return true;
  }

  _updateSiege() {
    const S = this.siege, w = this.w, c = this.c;
    if (!S) { this.elT = 0; this.heT = 0; return; }
    if (c.state !== 'fight') { this.siege = null; this._heavyDone('siege'); return; }
    S.t++;
    this.elT = this.dead.mortar[0] ? 0 : 0.95;
    this.heT = this.dead.how[0] || this.carDead[1] ? 0 : 0.55;
    // Targets: the player's spot first, then lanes beside it (moving sideways is the answer).
    const fire = (from) => {
      const k = S.fired++, off = k === 0 ? 0 : (k % 2 ? 1 : -1) * w.rng.range(70, 120);
      const tx = clamp(w.aimX + off, 40, W - 40), ty = clamp(w.aimY - w.rng.range(0, 50), H * 0.42, H - 40);
      if (from === 'mortar') this._shell(this.M.mor, L0.mortarMouth, tx, ty, { r: 38, delay: 0, kind: 'mortar' });
      else this._shell(this.M.hb[k % 2], SB.cars[0].howMuzzle, tx, ty, { r: 46, big: true, kind: 'how', barrel: k % 2 });
    };
    if (S.t >= 30 && S.t < 30 + S.n * 22 && (S.t - 30) % 22 === 0) {
      const useHow = !this.dead.how[0] && !this.carDead[1] && (S.fired % 2 === 1 || this.dead.mortar[0]);
      if (useHow) fire('how'); else if (!this.dead.mortar[0]) fire('mortar');
    }
    if (S.t > 40 + S.n * 22 + 40) { this.siege = null; this._heavyDone('siege'); }
  }

  /** Launch one ballistic shell from a mouth (matrix + local point) toward screen point (tx, ty). */
  _shell(m, mouth, tx, ty, o = {}) {
    const w = this.w, c = this.c;
    const mz = this._scr(m, mouth[0], mouth[1], mouth[2]);
    const from = [this.wp3[0], this.wp3[1], this.wp3[2]];
    const to = this._world(tx, ty, [0, 0, 0]);
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const T = Math.round((o.big ? 70 : 62) + dist * 0.05) + (o.delay || 0);
    const big = !!o.big;
    const hz = c.kit.hazard({
      type: 'circle', x: tx, y: ty, r: o.r || 38, warn: T, fire: 8, color: [1, 0.62, 0.22], crater: true,
      onFire: (h, ww) => {
        P.ring(ww, h.x, h.y, big ? SPEC.fragBig : SPEC.frag, ww.rng.angle());
        ww.g.camera.addTrauma(big ? 0.28 : 0.2);
        this._sandBurst(h.x, h.y, big ? 1.9 : 1.4);
        sfx.play('sandBlast', { pan: (h.x - W / 2) / W });
      },
    });
    this.shells.push({ hz, from, to, T, t: -(o.delay || 0), apex: (big ? 300 : 240) + dist * 0.15, big });
    if (o.kind === 'how') { this.hR[o.barrel || 0] = 1; this.kick[1] += 1.4; } else { this.el = Math.max(0, this.el - 0.2); this.kick[0] += 0.8; }
    this.flashes.push({ x: mz[0], y: mz[1], ang: -Math.PI / 2, t: 0, life: big ? 11 : 8, kind: big ? 'how' : 'mortar' });
    if (this.is3D) for (let k = 0; k < (big ? 6 : 4); k++) this.view.fx._smoke(from[0], from[1], from[2] + 2, big ? 0.7 : 0.55, 0.3, 1.3);
    w.g.camera.addTrauma(big ? 0.16 : 0.12);
    sfx.play(big ? 'heavyCannon' : 'mortarLaunch', { pan: (mz[0] - W / 2) / W });
  }

  _updateShells() {
    const hz = this.c.kit.hazards;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const sh = this.shells[k];
      sh.t++;
      if (sh.t >= sh.T || !hz.includes(sh.hz)) { this.shells.splice(k, 1); continue; }
      if (sh.t > 0 && this.is3D && sh.t % 3 === 0) {
        const p = this._shellPos(sh, sh.t / sh.T);
        this.view.fx._smoke(p[0], p[1], p[2], 0.18, 0.15, 0.2);
      }
    }
  }

  _shellPos(sh, u) {
    u = clamp(u, 0, 1);
    return [lerp(sh.from[0], sh.to[0], u), lerp(sh.from[1], sh.to[1], u), lerp(sh.from[2], sh.to[2], u) + 4 * sh.apex * u * (1 - u)];
  }

  // ------------------------------------------------- attack: crossfire

  /**
   * Crossfire Convoy: the locomotive's cannons and the artillery car's rotary
   * guns cover different lane groups, then swap (with a breather between), so
   * the safe gap keeps moving rather than closing.
   */
  crossfire(t) {
    const w = this.w, c = this.c;
    if (this.quiet || (this.sweep && this.sweep.phase === 'sweep')) return;
    const cyc = 260, ph = t % cyc, A = ph < 110, B = ph >= 130 && ph < 240;
    if (!A && !B) return;
    const outer = [70, W - 70], inner = [W / 2 - 46, W / 2 + 46];
    const front = A ? outer : inner, rear = A ? inner : outer;
    const k = Math.max(5, Math.round(8 / ((c.intensity || 1) * (1 + 0.12 * (c.mk - 1)))));
    for (let i = 0; i < 2; i++) {
      if (!this.dead.cannon[i]) {
        this.scAim[i] = this._world(front[i], w.aimY, this.scAim[i] || [0, 0, 0]);
        if ((t + i * 3) % k === 0 && this.scErr[i] < 0.35) this._cannonShot(i, SPEC.cross);
      }
      if (!this.dead.rotary[i] && !this.carDead[1]) {
        this.rAim[i] = this._world(rear[i], w.aimY + 30, this.rAim[i] || [0, 0, 0]);
        this.rv[i] = Math.min(0.55, this.rv[i] + 0.04);
        this.rFiring = true;
        if ((t + i * 4) % (k + 1) === 0) this._gatShot(i, SPEC.crossR);
      }
    }
  }

  _gatShot(i, spec) {
    const mz = this._muzzle(this.M.gat[i], SB.cars[0].gatMuzzle);
    if (mz.y < -30) return;
    P.fan(this.w, mz.x, mz.y, mz.ang, spec);
    this.rHeat[i] = Math.min(1, this.rHeat[i] + 0.03);
    this.kick[1] += 0.12;
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 4, kind: 'gat' });
    sfx.play('gatling', { pan: (mz.x - W / 2) / W });
  }

  // ---------------------------------------------- attack: rotary sweep

  startSweep() {
    if (!this._canHeavy('sweep') || this.carDead[1] || (this.dead.rotary[0] && this.dead.rotary[1])) return false;
    this.heavy = 'sweep';
    this.sweep = { phase: 'spin', t: 0, dir: this.w.rng.sign() };
    return true;
  }

  _updateSweep() {
    const S = this.sweep, c = this.c;
    if (!S) return;
    if (c.state !== 'fight' || this.carDead[1]) { this.sweep = null; this._heavyDone('sweep'); return; }
    S.t++;
    const A0 = 1.15, DUR = 150;
    if (S.phase === 'spin') {
      for (let i = 0; i < 2; i++) {
        this.rv[i] = Math.min(0.7, this.rv[i] + 0.02);
        const start = (i ? -1 : 1) * S.dir * A0;
        this.ry[i] += clamp(wrapA(start - this.ry[i]), -0.04, 0.04);
      }
      if (S.t === 4) sfx.play('steamVent', { pan: 0 });
      if (S.t > 44) { S.phase = 'sweep'; S.t = 0; }
    } else if (S.phase === 'sweep') {
      const u = S.t / DUR;
      for (let i = 0; i < 2; i++) {
        if (this.dead.rotary[i]) continue;
        const s0 = (i ? -1 : 1) * S.dir * A0;
        this.ry[i] = s0 - (i ? -1 : 1) * S.dir * 2 * A0 * u;
        this.rv[i] = 0.7;
        // Bursts with breaks: dashed arcs the pilot can slip through.
        const per = Math.max(3, Math.round(4 / (c.intensity || 1)));
        if ((S.t % 18) < 11 && S.t % per === i % per) {
          this._gatShot(i, SPEC.sweep);
          if (c.mk >= 2 && S.t % (per * 2) === 0) this._gatShot(i, SPEC.sweepMk);
        }
      }
      if (S.t >= DUR) { S.phase = 'down'; S.t = 0; }
    } else if (S.phase === 'down') {
      for (let i = 0; i < 2; i++) this.rv[i] *= 0.95;
      if (S.t > 40) { this.sweep = null; this._heavyDone('sweep'); }
    }
  }

  // --------------------------------------------- attack: rocket salvo

  startSalvo() {
    if (!this._canHeavy('rocket') || this.carDead[2] || (this.dead.rocket[0] && this.dead.rocket[1])) return false;
    const w = this.w, c = this.c, q = [];
    const per = c.mk >= 2 ? 6 : 5;
    let k = 0;
    for (let n = 0; n < per; n++) for (let i = 0; i < 2; i++) {
      if (this.dead.rocket[i]) continue;
      const tx = clamp(w.aimX + (n % 2 ? 1 : -1) * w.rng.range(20, 150) + (i ? 30 : -30), 34, W - 34);
      const ty = clamp(w.aimY + w.rng.range(-170, 30), H * 0.3, H - 30);
      q.push({ i, tube: (n * 2 + i) % SB.cars[1].tubes.length, at: 40 + k++ * 7, tx, ty });
    }
    this.heavy = 'rocket';
    this.salvo = { t: 0, q };
    for (let i = 0; i < 2; i++) this.peT[i] = 0.55;
    return true;
  }

  _updateSalvo() {
    const S = this.salvo, c = this.c;
    if (!S) { this.peT[0] = this.peT[1] = 0; return; }
    if (c.state !== 'fight' || this.carDead[2]) { this.salvo = null; this._heavyDone('rocket'); return; }
    S.t++;
    for (const r of S.q) if (r.at === S.t && !this.dead.rocket[r.i]) this._rocket(r);
    const last = S.q.length ? S.q[S.q.length - 1].at : 0;
    if (S.t > last + 50) { this.salvo = null; this._heavyDone('rocket'); }
  }

  _rocket(r) {
    const w = this.w, c = this.c, tube = SB.cars[1].tubes[r.tube];
    const mz = this._scr(this.M.pod[r.i], tube[0], tube[1] + 2, tube[2]);
    const from = [this.wp3[0], this.wp3[1], this.wp3[2]];
    const to = this._world(r.tx, r.ty, [0, 0, 0]);
    const T = Math.round(76 + Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.03);
    const hz = c.kit.hazard({
      type: 'circle', x: r.tx, y: r.ty, r: 30, warn: T, fire: 7, color: [1, 0.45, 0.15], crater: false,
      onFire: (h, ww) => {
        P.ring(ww, h.x, h.y, SPEC.rocketFrag, ww.rng.angle());
        this._sandBurst(h.x, h.y, 1.0);
        ww.g.camera.addTrauma(0.1);
        sfx.play('sandBlast', { pan: (h.x - W / 2) / W });
      },
    });
    // Climb out of the tube, arc over, dive at the marker (no steering after launch).
    const side = r.i ? 1 : -1;
    const rk = { hz, from, to, T, t: 0, apex: 46 + w.rng.range(0, 26), wob: side * w.rng.range(20, 50), ph: w.rng.angle(), e0: 0 };
    // Where the path comes into view (screen row 24).
    for (let e = 0, q = [0, 0, 0]; e < 0.9; e += 0.05) { this._rocketPath(rk, e, q); if (this.cam.project(q[0], q[1], q[2], this.pr)[1] > 24) { rk.e0 = e; break; } }
    this.rockets.push(rk);
    this.kick[2] += 0.5;
    this.flashes.push({ x: mz[0], y: mz[1], ang: -Math.PI / 2, t: 0, life: 7, kind: 'rocket' });
    if (this.is3D) for (let k = 0; k < 3; k++) this.view.fx._smoke(from[0], from[1], from[2], 0.45, 0.2, 0.9);
    sfx.play('rocketLaunch', { pan: (mz[0] - W / 2) / W });
  }

  /** Point at path fraction e (straight run + lofted arc + a lateral weave). */
  _rocketPath(rk, e, out) {
    out[0] = lerp(rk.from[0], rk.to[0], e) + Math.sin(e * Math.PI) * rk.wob;
    out[1] = lerp(rk.from[1], rk.to[1], e);
    out[2] = lerp(rk.from[2], rk.to[2], e) + 4 * rk.apex * e * (1 - e) + (1 - e) * 6;
    return out;
  }

  /**
   * Position at flight time u (0..1). The launcher rides far up the train, often
   * above the screen: the rocket boosts through that part of its path in the
   * first 30% of the flight, then spends the rest in view (readable trail).
   */
  _rocketPos(rk, u, out = [0, 0, 0]) {
    u = clamp(u, 0, 1);
    const e0 = rk.e0 || 0;
    const e = e0 > 0 ? (u < 0.3 ? (u / 0.3) * e0 : e0 + ((u - 0.3) / 0.7) * (1 - e0)) : u * (0.55 + 0.45 * u);
    return this._rocketPath(rk, e, out);
  }

  _updateRockets() {
    const hz = this.c.kit.hazards;
    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const rk = this.rockets[k];
      rk.t++;
      if (rk.t >= rk.T || !hz.includes(rk.hz)) { this.rockets.splice(k, 1); continue; }
      const p = this._rocketPos(rk, rk.t / rk.T, this.q3);
      if (this.is3D) this.view.fx._smoke(p[0], p[1], p[2], 0.22, 0.05, 0.15);
      // Screen-space exhaust trail: the path stays readable over the busy ground.
      const q = this.cam.project(p[0], p[1], p[2], this.pr), L = this.w.fxLow, R = this.w.fxRng;
      if (q[1] > -20) {
        const j = L.spawn(this.w.r.frame('smoke'), q[0] + R.range(-1.5, 1.5), q[1] + R.range(-1.5, 1.5), 0, 0, R.range(26, 38));
        if (j >= 0) { L.size(j, 5 * q[2], 18 * q[2]); L.color(j, 0.95, 0.9, 0.82, 0.7, 0.66, 0.6); L.phys(j, 0.9, -0.01); L.look(j, 0.55, 0, FADE_OUT); }
      }
    }
  }

  // ---------------------------------------------- attack: sandstorm

  /** Sandstorm Bombardment: the light browns out, a dust front rolls in, artillery walks marked impacts. */
  startStorm() {
    if (!this._canHeavy('storm')) return false;
    const w = this.w, n = this.c.mk >= 2 ? 7 : 6, marks = [];
    const gx = w.rng.range(90, W - 90);
    for (let k = 0; k < n; k++) marks.push({ x: clamp(gx + (k - (n - 1) / 2) * w.rng.range(52, 70) + w.rng.range(-18, 18), 36, W - 36), y: clamp(w.aimY + w.rng.range(-200, 40), H * 0.3, H - 34) });
    // Always land one on the player's spot.
    marks[w.rng.int(0, n - 1)] = { x: clamp(w.aimX, 36, W - 36), y: clamp(w.aimY, H * 0.3, H - 34) };
    this.heavy = 'storm';
    this.storm = { phase: 'gather', t: 0, marks, k: 0 };
    sfx.play('avalanche');
    return true;
  }

  _updateStorm() {
    const S = this.storm, c = this.c;
    this.stormA += ((S && S.phase !== 'clear' ? 1 : 0) - this.stormA) * 0.02;
    if (!S) return;
    if (c.state !== 'fight') { this.storm = null; this._heavyDone('storm'); return; }
    S.t++;
    if (S.phase === 'gather' && S.t > 70) { S.phase = 'strike'; S.t = 0; this.hold = Math.max(this.hold, 200); }
    else if (S.phase === 'strike') {
      if (S.t % 20 === 1 && S.k < S.marks.length) {
        const mk = S.marks[S.k++];
        // Mortar / howitzer if they still work, else the barrage comes from the rear batteries off-screen.
        const how = !this.dead.how[0] && !this.carDead[1] && S.k % 2 === 0;
        if (how) this._shell(this.M.hb[S.k % 2], SB.cars[0].howMuzzle, mk.x, mk.y, { r: 44, big: true, kind: 'how', barrel: S.k % 2 });
        else if (!this.dead.mortar[0]) this._shell(this.M.mor, L0.mortarMouth, mk.x, mk.y, { r: 40, kind: 'mortar' });
        else if (!this.carDead[2]) this._rocket({ i: this.dead.rocket[0] ? 1 : 0, tube: S.k % 9, tx: mk.x, ty: mk.y });
      }
      if (S.t > S.marks.length * 20 + 80) { S.phase = 'clear'; S.t = 0; }
    } else if (S.phase === 'clear' && S.t > 90) { this.storm = null; this._heavyDone('storm'); }
  }

  // ---------------------------------------------------- attack: ram

  /** Locomotive Ram: horn, steam and a marked lane, then a full-power surge down the line. */
  startRam() {
    if (!this._canHeavy('ram')) return false;
    this.heavy = 'ram';
    this.ram = { phase: 'announce', t: 0, boost: 4.6 };
    this.mbs = null;
    const tip = this._scr(this.M.veh[0], 0, L0.front, 6);
    this.c.kit.hazard({ type: 'lane', x: tip[0], w: 170, warn: 72, fire: 60, lethal: false, color: [1, 0.55, 0.2], y0: tip[1] - 6 });
    sfx.play('trainHorn', { pan: (tip[0] - W / 2) / W });
    return true;
  }

  _updateRam() {
    const r = this.ram, c = this.c, w = this.w;
    if (!r) return;
    if (c.state !== 'fight') { this.ram = null; this._heavyDone('ram'); return; }
    r.t++;
    switch (r.phase) {
      case 'announce':
        this.mode = 'cruise'; this.rowT = this._homeRow() - 26; // draws back a little, building pressure
        if (this.is3D && r.t % 3 === 0) for (const st of L0.stacks) { const q = M4.point(this.M.body[0], st[0], st[1], st[2], [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.9, 0.85, 1.8); }
        if (this.is3D && r.t % 10 === 0) this._steamBurst(1);
        w.g.camera.addTrauma(0.012);
        if (r.t >= 72) { r.phase = 'charge'; r.t = 0; this.mode = 'charge'; w.g.camera.addTrauma(0.3); sfx.play('ramRev', { pan: 0 }); }
        break;
      case 'charge': {
        this.mode = 'charge';
        w.g.camera.addTrauma(0.04);
        const tip = this._scr(this.M.veh[0], 0, L0.front, 4);
        // Ballast and sand thrown off the plough (dodgeable).
        if (r.t % 6 === 0 && this.v - this.cv > 2) for (const sd of [-1, 1]) {
          const q = this._scr(this.M.veh[0], sd * 56, L0.front - 30, 6);
          P.shoot(w, q[0], q[1], Math.PI / 2 - sd * w.rng.range(0.7, 1.2), SPEC.debris.speed, SPEC.debris);
        }
        if (tip[1] > H - 150 || r.t > 100) {
          r.phase = 'brake'; r.t = 0; this.mode = 'brake';
          w.g.camera.addTrauma(0.45);
          w.g.renderer.post.shockwave(tip[0], tip[1], 0.03, 0.02, 0.5);
          this._sandBurst(tip[0], tip[1], 2.2);
          sfx.play('brakeScreech', { pan: (tip[0] - W / 2) / W });
          sfx.play('ramImpact', { pan: (tip[0] - W / 2) / W });
        }
        break;
      }
      case 'brake':
        this.mode = 'brake';
        if (this.v <= this.cv - 0.9 || r.t > 50) { r.phase = 'recover'; r.t = 0; this.mode = 'cruise'; }
        break;
      case 'recover':
        this.mode = 'cruise'; this.rowT = this._homeRow();
        if (Math.abs(this._noseRow() - this.rowT) < 14 || r.t > 300) { this.ram = null; this._heavyDone('ram'); }
        break;
      default: break;
    }
  }

  // ------------------------------------------------------ scheduling

  _canHeavy(name) {
    if (this.c.state !== 'fight') return false;
    if (this.heavy && this.heavy !== name) { if (!this.queue) this.queue = name; return false; }
    return !this.heavy;
  }

  _heavyDone(name) {
    if (this.heavy === name) { this.heavy = null; this.qWait = 34; }
  }

  _runQueue() {
    if (this.qWait > 0) { this.qWait--; return; }
    if (!this.queue || this.heavy || this.c.state !== 'fight') return;
    const q = this.queue;
    this.queue = null;
    ({ siege: () => this.startSiege(), sweep: () => this.startSweep(), rocket: () => this.startSalvo(), storm: () => this.startStorm(), ram: () => this.startRam() })[q]();
  }

  _endAttacks() {
    this.mbs = null; this.siege = null; this.sweep = null; this.salvo = null; this.storm = null; this.ram = null;
    this.heavy = null; this.queue = null; this.hold = 0;
    this.shells.length = 0; this.rockets.length = 0;
    this.elT = 0; this.heT = 0; this.peT[0] = this.peT[1] = 0;
    if (this.mode === 'charge' || this.mode === 'brake') this.mode = 'cruise';
  }

  // ------------------------------------------------------------ death

  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng;
    if (this.deathT < 0) {
      this.deathT = 0;
      this._endAttacks();
      this.mode = 'dead';
      sfx.play('engineFail', { pan: 0 });
    }
    this.deathT++;
    // Brakes lock: sparks off every wheel set while it slides to a stop.
    if (this.is3D && this.v > 0.2 && st % 2 === 0) {
      for (let k = 0; k < NV; k++) for (const p of VEH[k].piv) for (const s of [-1, 1]) {
        if (!R.chance(0.35)) continue;
        const q = M4.point(this.M.veh[k], s * SB.gauge, p, SB.railTop, [0, 0, 0]);
        this.view.fx._spark(q[0], q[1], q[2], 2);
      }
    }
    // The locomotive slews and lists as it grinds off the line.
    this.skew += (0.07 - this.skew) * 0.02;
    // Mounts and cars cook off one after another.
    if (st % 11 === 0 && st < 108) {
      const picks = [['cannon', 0], ['cannon', 1], ['main', 0], ['mortar', 0], ['how', 0], ['rotary', 0], ['rotary', 1], ['rocket', 0], ['rocket', 1]];
      const [kind, i] = picks[R.int(0, picks.length - 1)];
      const [m, x0, y0, z0] = this._mountAt(kind, i), q = this._scr(m, x0, y0, z0);
      w.explosions.blast(q[0], q[1], R.range(0.7, 1.15), [1, 0.5, 0.2]);
    }
    if (this.is3D && st % 7 === 0 && st < 110) this._steamBurst(0.8);
    if (st === 112) {
      // Boiler breach: the main battery is blown off its barbette, the rocket car goes up.
      this.popV = 7; this.popA = 0.01;
      const q = this._scr(this.M.body[0], 0, -10, 70);
      w.explosions.blast(q[0], q[1], 2.8, [1, 0.6, 0.25]);
      const q2 = this._scr(this.M.body[2], 0, 0, 44);
      w.explosions.blast(q2[0], q2[1], 1.8, [1, 0.5, 0.2]);
      w.explosions.sparks(q2[0], q2[1], 40, [1, 0.8, 0.4], 8, 40, 5);
      w.g.camera.addTrauma(0.85);
      if (this.is3D) {
        const fx = this.view.fx;
        for (let k = 0; k < 3; k++) { const p = this.vp[k]; fx.decal('scorch', p.x, p.y, (this.view.floorZ || 0) + 0.5, 260, R.angle(), 9000); }
        for (const [k, lx, ly, sc] of [[0, 0, -40, 1.6], [0, -30, 60, 1.1], [0, 34, -110, 1.0], [0, 0, 120, 0.9], [1, 0, -20, 1.2], [2, -10, 10, 1.4], [2, 20, -60, 1.0]]) {
          const p = M4.point(this.M.body[k], lx, ly, 56, [0, 0, 0]);
          fx.addFire(p[0], p[1], p[2], sc, 5400);
        }
      }
    }
    if (st > 112) this.wreck = true;
    if (st === 130 && this.view) {
      // The advance resumes past the wreck.
      this.ctrlCam = false; this.released = true;
      this.view.speedTarget = this.view.baseSpeed;
    }
  }

  // ------------------------------------------------------------ fx

  _steamBurst(s = 1) {
    const fx = this.view.fx, B = this.M.body[0];
    for (const [x, y, z] of [...L0.safety, ...L0.vents]) {
      const q = M4.point(B, x, y, z, this.q3);
      fx._steam(q[0], q[1], q[2], 0.8 * s);
    }
    sfx.play('steamVent', { pan: 0 });
  }

  /** Sand / ballast burst at a screen point (impacts, the ram). */
  _sandBurst(sx, sy, s = 1) {
    const w = this.w, L = w.fxLow, H2 = w.fxHigh, R = w.fxRng;
    for (let k = 0; k < 11 * s; k++) {
      const a = R.angle(), sp = R.range(0.5, 2.4) * s;
      const j = L.spawn(w.r.frame('smoke'), sx, sy, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 0.3, R.range(34, 60));
      if (j >= 0) { L.size(j, 10 * s, 38 * s); L.color(j, 0.86, 0.7, 0.48, 0.66, 0.54, 0.4); L.phys(j, 0.93, 0); L.look(j, 0.62, 0, FADE_INOUT); }
    }
    const shards = w.explosions.f.shards;
    for (let k = 0; k < 10 * s; k++) {
      const a = R.angle(), sp = R.range(2, 5) * s;
      const j = H2.spawn(shards[k % shards.length], sx, sy, Math.cos(a) * sp, Math.sin(a) * sp - 1, R.range(24, 40));
      if (j >= 0) { H2.size(j, R.range(2.5, 5)); H2.color(j, 0.75, 0.6, 0.4, 0.35, 0.28, 0.2); H2.phys(j, 0.95, 0.12); H2.spin(j, R.angle(), R.range(-0.3, 0.3)); H2.look(j, 1, 0, FADE_OUT); }
    }
    w.explosions.sparks(sx, sy, Math.round(6 * s), [1, 0.7, 0.35], 4, 18, 3);
  }

  _debris(x, y, n) {
    const w = this.w, shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < n; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(50, 80));
      if (j < 0) continue;
      L.size(j, R.range(6, 12)); L.color(j, 0.75, 0.58, 0.3, 0.25, 0.2, 0.15); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
  }

  /** Exhaust, steam, wheel dust, ballast, sparks, the sand wake, burning mounts (world space). */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, M = this.M, P2 = fx.p, F = fx.F;
    const v = this.v;
    // Sand wake behind the plough (one ribbon over the bed and its shoulders).
    if (!this.wreck) {
      const ty = this.vp[0].Y - L0.front + 20;
      this.trail.add(0, railX(ty), ty, this.dist, v > 0.05);
    }
    // Dust kicked off every wheel set; ballast chips flicked out by the drivers.
    const load = Math.min(1, Math.abs(this.acc) * 24 + v * 0.22 + (this.mode === 'charge' ? 0.8 : 0));
    if (v > 0.15) {
      for (let k = 0; k < NV; k++) {
        if (this.vp[k].Y && this._offscreen(k)) continue;
        for (const p of VEH[k].piv) for (const s of [-1, 1]) {
          // Budget: ~2 puffs per step for the whole train (the world's fires need the pool too).
          if (P2.count > P2.n * 0.6 || !R.chance(Math.min(0.3, v * 0.05 + load * 0.08))) continue;
          const q = M4.point(M.veh[k], s * (SB.gauge + R.range(8, 26)), p + R.range(-24, 18), 4, this.q3);
          const d = M4.dir(M.veh[k], s * R.range(0.3, 1.1), -R.range(0.2, 0.9) * Math.min(2.5, v * 0.6), 0, [0, 0, 0]);
          const i = P2.spawn(R.pick(F.dust), q[0], q[1], q[2], d[0], d[1], R.range(0.25, 0.7), R.range(45, 75));
          if (i >= 0) { P2.s0[i] = 8 + v * 2; P2.s1[i] = 26 + v * 8; P2.r[i] = 0.95; P2.g[i] = 0.78; P2.b[i] = 0.54; P2.r1[i] = 0.9; P2.g1[i] = 0.76; P2.b1[i] = 0.56; P2.a[i] = 0.34; P2.drag[i] = 0.95; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.02; }
        }
      }
    }
    // Plough spray at speed (ram).
    if (v - this.cv > 1.5) for (const sd of [-1, 1]) {
      if (!R.chance(0.8)) continue;
      const q = M4.point(M.veh[0], sd * R.range(30, 60), L0.front - R.range(0, 30), 6, this.q3);
      const d = M4.dir(M.veh[0], sd * R.range(1.2, 2.6), R.range(0.4, 1.4), 0, [0, 0, 0]);
      const i = P2.spawn(R.pick(F.dust), q[0], q[1], q[2], d[0], d[1], R.range(0.6, 1.8), R.range(50, 80));
      if (i >= 0) { P2.s0[i] = 14; P2.s1[i] = 48; P2.r[i] = 0.86; P2.g[i] = 0.72; P2.b[i] = 0.5; P2.r1[i] = 0.76; P2.g1[i] = 0.64; P2.b1[i] = 0.48; P2.a[i] = 0.62; P2.drag[i] = 0.95; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.03; }
    }
    // Brake sparks at the drivers when braking hard.
    if (this.mode === 'brake' && this.t % 2 === 0) for (const y of L0.drivers) for (const s of [-1, 1]) if (R.chance(0.4)) { const q = M4.point(M.veh[0], s * SB.gauge, y, SB.railTop, this.q3); fx._spark(q[0], q[1], q[2], 2); }
    // Exhaust: darker and denser under load, a column per stack.
    const dying = this.c.state === 'dying';
    if (!this.wreck && this.t % Math.max(2, Math.round(8 - load * 6)) === 0) {
      for (const st of L0.stacks) { const q = M4.point(M.body[0], st[0], st[1], st[2], this.q3); fx._smoke(q[0], q[1], q[2], 0.5 + load * 0.5, dying ? 0.95 : 0.55 + load * 0.35, 1.4); }
    }
    // Safety valves feather steam now and then; hot barrels shimmer.
    if (!this.wreck && this.t % 140 === 0) this._steamBurst(0.6);
    if (this.mbHeat > 0.3 && this.t % 6 === 0) for (let b = 0; b < 2; b++) { const q = M4.point(M.mb[b], 0, 70, 2, this.q3); fx._steam(q[0], q[1], q[2], 0.4 * this.mbHeat); }
    // Broken mounts burn; a battered loco smokes from its deck.
    for (const f of this.fires) {
      let q;
      if (f.car !== undefined) q = M4.point(M.body[f.car], f.lx, f.ly, 46, this.q3);
      else { const [m, x0, y0, z0] = this._mountAt(f.kind, f.i); q = M4.point(m, x0, y0, z0, this.q3); }
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2], f.s, 0.9, 1.3);
      if (R.chance(0.05)) fx._spark(q[0], q[1], q[2], 5);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
    const frac = this.c.e.hp / Math.max(1, this._hp0());
    if (frac < 0.45 && this.t % (frac < 0.2 ? 5 : 11) === 0) {
      const site = [[-30, -60], [34, 10], [-20, 70], [24, -110]][R.int(0, 3)];
      const q = M4.point(M.body[0], site[0], site[1], 60, this.q3);
      fx._smoke(q[0], q[1], q[2], 0.6, 0.85, 1.1);
    }
  }

  /** Engine beat and rail clatter, paced by the real wheel travel. */
  _sound() {
    if (this.wreck || this.c.state === 'dying') return;
    const quarter = (Math.PI * 2 * L0.dr) / 4, pan = (this.c.e.x - W / 2) / W;
    this.chuffD += this.v;
    if (this.chuffD >= quarter) { this.chuffD -= quarter; sfx.play('chuff', { pan, v: Math.min(1, 0.35 + Math.abs(this.acc) * 20 + (this.mode === 'charge' ? 0.5 : 0)) }); }
    this.clackD += this.v;
    if (this.clackD >= RAIL.joint) { this.clackD -= RAIL.joint; sfx.play('railClack', { pan, v: Math.min(1, this.v / 2.5) }); }
  }

  _offscreen(k) {
    const V = VEH[k], m = this.M.veh[k];
    const a = this._scr(m, 0, V.rear, 0)[1];
    return a < -60 || this._scr(m, 0, V.front, 0)[1] > H + 80;
  }

  _hp0() {
    const c = this.c;
    return c.floors && c.phases ? c.floors[0] + c.phases[0].hp : c.e.hp || 1;
  }

  // ------------------------------------------------------------ render

  /** 3D pass (called by ArenaWorld inside its GL pass, depth-tested). */
  renderWorld(view, alpha) {
    if (view !== this.view) return;
    if (this.wreck && this.c.state !== 'dying') {
      // The wreck stays until its last car has scrolled away behind the player.
      const m = this.M.veh[NV - 1], q = this._scr(m, 0, VEH[NV - 1].rear, 0);
      if (q[1] > H + 220) { const i = view.extras.indexOf(this); if (i >= 0) view.extras.splice(i, 1); return; }
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('sb', buildSandbreaker);
    const cam = view.cam, M = this.M;
    this._pose(this.c.e.alive ? alpha : 1);
    // Light: the arena's sun azimuth, raised so the hull reads clearly from above.
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.8), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    const z0 = view.floorZ || 0;
    // 1) Sand wake over the bed (hidden under the sleepers by depth).
    const n = this.trail.build(z0 + RAIL.bedZ + 0.5);
    R.trail(cam, this.trail.data, n, !!this.w.g.renderer.post.hdr, TL.WAKE);
    // 2) The train.
    R.begin(cam, view.atmo, light, SAND_LOOK);
    const dmg = this.wreck ? 1 : Math.min(0.75, (1 - this.c.e.hp / this._hp0()) * 0.9);
    const heat = this.wreck ? 0.3 + 0.12 * Math.sin(this.t * 0.2) : 0;
    const fl = this.flash * 0.2;
    const d = this.alphaDist;
    const vis = [];
    for (let k = 0; k < NV; k++) vis[k] = !this._offscreen(k);
    // Running gear.
    if (vis[0]) {
      R.draw('sb.locoFrame', M.veh[0], { snow: 0.15, damage: dmg * 0.5 });
      for (const s of [-1, 1]) {
        for (const y of L0.drivers) this._wheel(R, M.veh[0], s, y, L0.dr, d, dmg);
        for (const y of L0.pony) this._wheel(R, M.veh[0], s, y, L0.pr, d, dmg);
        this._rods(R, s, d, dmg);
      }
      M4.mul(M.veh[0], M4.trans(0, (L0.trailing[0] + L0.trailing[1]) / 2, 0, M.tmp), M.w);
      R.draw('sb.bogie', M.w, { snow: 0.15, damage: dmg * 0.4 });
      for (const s of [-1, 1]) for (const y of L0.trailing) this._wheel(R, M.veh[0], s, y, L0.tr, d, dmg);
    }
    for (let k = 1; k < NV; k++) {
      if (!vis[k]) continue;
      const cd = this.carDead[k] ? 1 : dmg;
      for (const b of VEH[k].piv) {
        M4.mul(M.veh[k], M4.trans(0, b, 0, M.tmp), M.w);
        R.draw('sb.bogie', M.w, { snow: 0.15, damage: cd * 0.4 });
        for (const s of [-1, 1]) for (const a of SB.bogie.axles) this._wheel(R, M.veh[k], s, b + a, SB.bogie.r, d, cd);
      }
    }
    // Drawbars between the vehicles.
    for (let k = 1; k < NV; k++) {
      if (!vis[k] && !vis[k - 1]) continue;
      const a = M4.point(M.veh[k - 1], 0, VEH[k - 1].rear - 4, SB.couplerZ, [0, 0, 0]), b = M4.point(M.veh[k], 0, VEH[k].front + 4, SB.couplerZ, [0, 0, 0]);
      spanM(a, b, M.cpl);
      R.draw('sb.coupler', M.cpl, { snow: 0.1 });
    }
    // Bodies.
    const lampG = this.wreck ? 0 : this.c.state === 'dying' ? ((this.t >> 2) & 1) * 1.6 : this.ram ? 0.9 + 0.7 * ((this.t >> 3) & 1) : 0.55 + 0.3 * Math.sin(this.t * 0.06);
    if (vis[0]) R.draw('sb.loco', M.body[0], { glow: lampG, flash: fl, damage: dmg, heat, snow: 0.45 });
    for (let k = 1; k < NV; k++) if (vis[k]) R.draw(VEH[k].mesh, M.body[k], { glow: this.wreck || this.carDead[k] ? 0.1 : lampG * 0.8, flash: fl * 0.5, damage: this.carDead[k] ? 0.9 : dmg * 0.8, heat: this.carDead[k] ? 0.25 + 0.1 * Math.sin(this.t * 0.17 + k) : heat, snow: 0.45 });
    // Weapons.
    const pf = (key) => { const p = this.partEnt[key]; return p && p.alive && p.flash > 0 ? 0.7 : 0; };
    const pd = (key) => { const p = this.partEnt[key]; return p && p.alive && p.maxHp ? (1 - p.hp / p.maxHp) * 0.8 : 0; };
    if (vis[0]) {
      for (let i = 0; i < 2; i++) {
        if (this.dead.cannon[i]) { R.draw('sb.wreck', M.sc[i], { damage: 1, heat: 0.4 }); continue; }
        const k = `cannon${i}`;
        R.draw('sb.scBase', M.sc[i], { glow: 0.7, flash: Math.max(fl, pf(k)), damage: Math.max(dmg, pd(k)) });
        for (let b = 0; b < 2; b++) R.draw('sb.scBarrel', M.scb[i][b], { flash: pf(k) * 0.6, damage: dmg, heat: this.scHeat[i] * 0.35 });
      }
      if (this.dead.main[0]) { if (!this.wreck) R.draw('sb.wreck', M.tur, { damage: 1, heat: 0.45 }); }
      if (!this.dead.main[0] || this.wreck) {
        R.draw('sb.mbTurret', M.tur, { glow: 0.6 + this.mbLoad * 1.6, flash: Math.max(fl, pf('main0')), damage: Math.max(dmg, pd('main0')), heat: this.mbLoad * 0.25 });
        for (let b = 0; b < 2; b++) R.draw('sb.mbBarrel', M.mb[b], { flash: pf('main0') * 0.5, damage: dmg, heat: this.mbHeat * 0.5 + this.mbLoad * 0.15 });
      }
      if (this.dead.mortar[0]) R.draw('sb.wreck', M.mor, { damage: 1, heat: 0.45 });
      else R.draw('sb.mortar', M.mor, { glow: 0.4 + this.el * 0.9, flash: Math.max(fl, pf('mortar0')), damage: Math.max(dmg, pd('mortar0')) });
    }
    if (vis[1]) {
      if (this.dead.how[0]) R.draw('sb.wreck', M.how, { damage: 1, heat: 0.45 });
      else {
        R.draw('sb.howTurret', M.how, { flash: pf('how0'), damage: Math.max(dmg, pd('how0')) });
        for (let b = 0; b < 2; b++) R.draw('sb.howBarrel', M.hb[b], { flash: pf('how0') * 0.5, damage: dmg });
      }
      for (let i = 0; i < 2; i++) {
        if (this.dead.rotary[i]) { R.draw('sb.wreck', M.rot[i], { damage: 1, heat: 0.4 }); continue; }
        const k = `rotary${i}`;
        R.draw('sb.rotBase', M.rot[i], { glow: 0.6, flash: pf(k), damage: Math.max(dmg, pd(k)) });
        R.draw('sb.gatling', M.gat[i], { flash: pf(k) * 0.5, damage: dmg, heat: this.rHeat[i] * 0.5 });
      }
    }
    if (vis[2]) for (let i = 0; i < 2; i++) {
      if (this.dead.rocket[i]) { R.draw('sb.wreck', M.pod[i], { damage: 1, heat: 0.4 }); continue; }
      const k = `rocket${i}`;
      R.draw('sb.rocketPod', M.pod[i], { flash: pf(k), damage: Math.max(dmg, pd(k)) });
    }
    if (vis[3]) R.draw('sb.radar', M.radar, { damage: dmg });
    // 3) Contact occlusion + soft planar sun shadow (three jittered passes).
    R.beginShadow(cam, SAND_LOOK.shadow);
    for (let k = 0; k < NV; k++) {
      if (!vis[k]) continue;
      const V = VEH[k], hw = k === 0 ? 60 : 54, hl = (V.front - V.rear) / 2, cy = (V.front + V.rear) / 2;
      M4.mul(M.veh[k], M4.mul(M4.trans(0, cy, 0, M.tmp), scaleM(hw, hl, 1, M.tmp2), M.tmp3), M.pad);
      R.contact(M.pad, 0.5, [0.22, 0.4], z0 + RAIL.sleeperZ[1] + 0.8);
    }
    // Shadow planes sit just above the sleeper tops so they land on the bed, sleepers and sand alike.
    const items = this._items(vis);
    const sh = 0.95, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < 3; k++) {
      const j = (k - 1) * 0.05, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], z0 + RAIL.sleeperZ[1] + 1.6 + k * 0.6, 0.26);
    }
    R.end();
    this._pose(1); // gameplay projections use the simulation pose
  }

  _wheel(R, m, s, y, r, d, dmg) {
    const M = this.M;
    M4.mul(m, M4.trans(s * (SB.gauge - 7), y, SB.railTop + r, M.tmp), M.w);
    M4.mul(M.w, M4.rotX(-d / r - (s > 0 ? Math.PI / 2 : 0), M.tmp), M.w);
    M4.mul(M.w, scaleM(s * 14, r, r, M.tmp), M.w);
    R.draw('sb.wheel', M.w, { snow: 0, damage: dmg * 0.4 });
  }

  /** Coupling rod, main rod and crosshead on side s, driven by the real wheel angle. */
  _rods(R, s, d, dmg) {
    const M = this.M, m = M.veh[0], cr = L0.crank, zc = SB.railTop + L0.dr;
    const th = d / L0.dr + (s > 0 ? Math.PI / 2 : 0);
    const dy = cr * Math.sin(th), dz = cr * Math.cos(th);
    M4.mul(m, M4.trans(s * L0.rodX, dy, zc + dz, M.tmp), M.rod);
    M4.mul(M.rod, scaleM(s, 1, 1, M.tmp), M.rod);
    R.draw('sb.rodC', M.rod, { snow: 0, damage: dmg * 0.4 });
    const py = L0.drivers[1] + dy, pz = zc + dz, ry = Math.sqrt(L0.mainLen * L0.mainLen - dz * dz);
    M4.mul(m, M4.trans(s * (L0.rodX + 3.5), py, pz, M.tmp), M.rod);
    M4.mul(M.rod, M4.rotX(Math.atan2(-dz, ry), M.tmp), M.rod);
    M4.mul(M.rod, scaleM(s, 1, 1, M.tmp), M.rod);
    R.draw('sb.rodM', M.rod, { snow: 0, damage: dmg * 0.4 });
    M4.mul(m, M4.trans(s * L0.rodX, py + ry, zc, M.tmp), M.rod);
    R.draw('sb.cross', M.rod, { snow: 0, damage: dmg * 0.4 });
  }

  /** Parts casting shadows: [[mesh, matrix], ...]. */
  _items(vis) {
    const M = this.M, out = [];
    if (vis[0]) {
      out.push(['sb.loco', M.body[0]], ['sb.mbTurret', M.tur], ['sb.mbBarrel', M.mb[0]], ['sb.mbBarrel', M.mb[1]]);
      out.push(this.dead.mortar[0] ? ['sb.wreck', M.mor] : ['sb.mortar', M.mor]);
      for (let i = 0; i < 2; i++) out.push(this.dead.cannon[i] ? ['sb.wreck', M.sc[i]] : ['sb.scBase', M.sc[i]]);
    }
    for (let k = 1; k < NV; k++) if (vis[k]) out.push([VEH[k].mesh, M.body[k]]);
    if (vis[1] && !this.dead.how[0]) out.push(['sb.howTurret', M.how], ['sb.howBarrel', M.hb[0]], ['sb.howBarrel', M.hb[1]]);
    if (vis[2]) for (let i = 0; i < 2; i++) if (!this.dead.rocket[i]) out.push(['sb.rocketPod', M.pod[i]]);
    return out;
  }

  /** Under entities: storm haze, shell and rocket ground shadows. */
  renderUnder(b, alpha) {
    const F = this.w.F, KF = this.c.kit.F, w = this.w, t = w.t;
    // Sandstorm: the light browns out and dust sheets roll across the ground,
    // UNDER the bullets and the pilot so threats stay readable.
    if (this.stormA > 0.01) {
      const a = this.stormA, smoke = w.r.frame('smoke');
      b.draw(KF.white, W / 2, H / 2, W, H, 0, 0.34, 0.23, 0.11, 0.45 * a, 0);
      for (let k = 0; k < 14; k++) {
        const x = pmod(k * 97 + t * (1.6 + (k % 3) * 0.5), W + 260) - 130, y = (k * 151) % H;
        b.draw(smoke, x, y + Math.sin(t * 0.01 + k) * 20, 280, 180, k + t * 0.003, 0.82, 0.64, 0.4, 0.42 * a, 0);
      }
    }
    for (const sh of this.shells) {
      if (sh.t <= 0) continue;
      const u = (sh.t - 1 + alpha) / sh.T, g = this._shellPos(sh, u);
      const q = this.cam.project(g[0], g[1], this.view ? this.view.floorZ : 0, this.pr);
      const k = 1 - Math.min(1, (g[2] - sh.to[2]) / (sh.apex * 1.1));
      b.draw(F.glow, q[0], q[1], (10 + 16 * k) * q[2], (8 + 11 * k) * q[2], 0, 0, 0, 0, 0.25 + 0.45 * k, 0);
    }
    for (const rk of this.rockets) {
      const g = this._rocketPos(rk, (rk.t - 1 + alpha) / rk.T, this.q3);
      const q = this.cam.project(g[0], g[1], this.view ? this.view.floorZ : 0, this.pr);
      b.draw(F.glow, q[0], q[1], 12 * q[2], 8 * q[2], 0, 0, 0, 0, 0.35, 0);
    }
  }

  /** Over entities (under bullets): muzzle flashes, telegraphs, shells, rockets, flames. */
  renderOver(b, alpha) {
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t;
    // Main battery: aim telegraph from both muzzles while it loads.
    if (this.mbs && this.mbs.phase === 'load') {
      const k = this.mbLoad, blink = (t >> 2) & 1 ? 1 : 0.55;
      for (let i = 0; i < 2; i++) {
        const mz = this._muzzle(this.M.mb[i], L0.mbMuzzle);
        const len = 620, cx = mz.x + Math.cos(mz.ang) * len / 2, cy = mz.y + Math.sin(mz.ang) * len / 2;
        b.draw(KF.laser, cx, cy, len, 2 + k * 2, mz.ang, 1.8, 0.9, 0.3, (0.25 + 0.45 * k) * blink, 1);
        b.draw(F.glow, mz.x, mz.y, 18 + 26 * k, 18 + 26 * k, 0, 2, 1.1, 0.4, 0.5 + 0.4 * k, 1);
      }
    }
    // Muzzle flashes.
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      const ca = Math.cos(f.ang), sa = Math.sin(f.ang);
      switch (f.kind) {
        case 'main':
          b.draw(F.glow, f.x, f.y, 86 * k, 86 * k, 0, 2.2, 1.3, 0.5, 0.9 * k, 1);
          b.draw(KF.laser, f.x + ca * 30 * k, f.y + sa * 30 * k, 72 * k, 22 * k, f.ang, 2.4, 1.6, 0.7, 0.95 * k, 1);
          for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 46 * k, 8 * k, f.ang + s2 * 1.2, 2, 1.3, 0.5, 0.7 * k, 1);
          break;
        case 'cannon':
          b.draw(F.glow, f.x, f.y, 36 * k, 36 * k, 0, 2.2, 1.3, 0.5, 0.85 * k, 1);
          b.draw(KF.laser, f.x + ca * 12, f.y + sa * 12, 34 * k, 10 * k, f.ang, 2.4, 1.6, 0.7, 0.95 * k, 1);
          break;
        case 'gat':
          b.draw(F.glow, f.x, f.y, 22 * k, 22 * k, 0, 2.4, 1.6, 0.6, 0.8 * k, 1);
          b.draw(KF.laser, f.x + ca * 8, f.y + sa * 8, 18 * k, 6 * k, f.ang, 2.4, 1.8, 0.8, 0.9 * k, 1);
          break;
        case 'how':
          b.draw(F.glow, f.x, f.y, 70 * k, 70 * k, 0, 2.2, 1.2, 0.45, 0.85 * k, 1);
          break;
        default:
          b.draw(F.glow, f.x, f.y, 48 * k, 48 * k, 0, 2, 1.2, 0.5, 0.8 * k, 1);
      }
    }
    // Shells in flight (grow as they climb toward the camera).
    for (const sh of this.shells) {
      if (sh.t <= 0) continue;
      const u = (sh.t - 1 + alpha) / sh.T, g = this._shellPos(sh, u), g2 = this._shellPos(sh, u + 0.02);
      const q = this.cam.project(g[0], g[1], g[2], this.pr), x = q[0], y = q[1], k = q[2] * (sh.big ? 1.25 : 1);
      const q2 = this.cam.project(g2[0], g2[1], g2[2], [0, 0, 0, 0]);
      const ang = Math.atan2(q2[1] - y, q2[0] - x);
      b.draw(KF.laser, x - Math.cos(ang) * 14 * k, y - Math.sin(ang) * 14 * k, 34 * k, 9 * k, ang, 2, 1.1, 0.4, 0.7, 1);
      b.draw(F.glow, x, y, 26 * k, 26 * k, 0, 2, 1.1, 0.45, 0.8, 1);
      b.draw(KF.core, x, y, 8 * k, 8 * k, 0, 2.2, 1.9, 1.4, 1, 1);
    }
    // Rockets: dark body, white-hot motor, glow.
    for (const rk of this.rockets) {
      const u = (rk.t - 1 + alpha) / rk.T, g = this._rocketPos(rk, u, [0, 0, 0]), g2 = this._rocketPos(rk, u + 0.02, [0, 0, 0]);
      const q = this.cam.project(g[0], g[1], g[2], this.pr), x = q[0], y = q[1], k = q[2];
      const q2 = this.cam.project(g2[0], g2[1], g2[2], [0, 0, 0, 0]);
      const ang = Math.atan2(q2[1] - y, q2[0] - x), ca = Math.cos(ang), sa = Math.sin(ang);
      b.draw(KF.white, x, y, 24 * k, 6 * k, ang, 0.24, 0.2, 0.14, 1, 0);
      b.draw(KF.white, x + ca * 10 * k, y + sa * 10 * k, 6 * k, 6 * k, ang, 1, 0.72, 0.3, 1, 0);
      b.draw(KF.laser, x - ca * 19 * k, y - sa * 19 * k, 28 * k, 9 * k, ang, 2.4, 1.6, 0.7, 0.95, 1);
      b.draw(F.glow, x - ca * 13 * k, y - sa * 13 * k, 34 * k, 34 * k, 0, 2.2, 1.2, 0.4, 0.7, 1);
    }
    // Burning mounts: flame tongues over the wreckage.
    for (const f of this.fires) {
      if (f.x === undefined) continue;
      const q = this.cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + (f.i || f.ly || 0) * 3);
      b.draw(F.glow, q[0], q[1], 30 * f.s * fl, 26 * f.s * fl, 0, 2, 0.7, 0.2, 0.55, 1);
      b.draw(F.glow, q[0] + Math.sin(t * 0.3) * 2, q[1] - 4, 14 * f.s * fl, 18 * f.s * fl, 0, 2.2, 1.4, 0.5, 0.6, 1);
    }
    // Ram: blinking chevrons down the locomotive's lane and its edges while it builds pressure.
    if (this.ram && this.ram.phase === 'announce') {
      const tip = this._scr(this.M.veh[0], 0, L0.front, 6), x = tip[0], blink = (t >> 3) & 1 ? 1 : 0.45;
      const hw = 82 * tip[2];
      for (let y = tip[1] + 30 + ((t * 2) % 44); y < H + 20; y += 44) {
        for (const s2 of [-1, 1]) b.draw(KF.laser, x + s2 * 13, y, 30, 5, Math.PI / 2 - s2 * 0.75, 2.2, 1.2, 0.35, 0.7 * blink, 1);
      }
      for (const s2 of [-1, 1]) b.draw(KF.laser, x + s2 * hw, (tip[1] + H) / 2, H - tip[1], 3, Math.PI / 2, 2.2, 1.1, 0.3, 0.55 * blink, 1);
    }
    // Storm: warning band while the dust front gathers.
    if (this.storm && this.storm.phase === 'gather') {
      const blink = (t >> 3) & 1 ? 1 : 0.4;
      for (let x = 20; x < W; x += 40) for (const s2 of [-1, 1]) b.draw(KF.laser, x + s2 * 6, 24, 16, 3, Math.PI / 2 + s2 * 0.8, 2, 1.4, 0.6, 0.6 * blink, 1);
      b.draw(KF.white, W / 2, 6, W, 12, 0, 1, 0.75, 0.4, 0.22 * blink, 1);
    }
  }

  /** Called when the boss object is dropped (scene change). */
  dispose() {
    if (this.view) {
      const i = this.view.extras.indexOf(this);
      if (i >= 0) this.view.extras.splice(i, 1);
      this.view.speedTarget = this.view.baseSpeed;
    }
  }
}

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

/** Matrix taking the unit drawbar (y 0..1) from world point a to world point b. */
function spanM(a, b, o) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy) || 1;
  o.fill(0);
  o[0] = -dy / l; o[1] = dx / l;          // x: horizontal, across the bar
  o[4] = dx; o[5] = dy; o[6] = dz;        // y: the bar itself (unit → full length)
  o[10] = 1;
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

export { HOME_ROW, TAU };
