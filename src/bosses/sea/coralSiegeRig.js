import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer, NAVAL_LOOK } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { CS, buildCoralSiege } from '../../world/tank/coralSiegeModel.js';
import { ShipWake } from '../../world/tank/ShipWake.js';
import { channelX, channelSlope, SHIP_ROOM, installationsIn, buoysIn } from '../../world/env/lagoonMap.js';

// CORAL SIEGE runtime rig: the coastal-assault battleship as a real vessel in
// the Lagoon Anchorage (world/env/lagoon.js + lagoonMap.js).
//
//   Helm       world pose (x, y, heading h: forward = (sin h, cos h)), speed v.
//              It steams BOW-FIRST down the winding channel toward the pilot:
//              pure pursuit on a look-ahead point (channel centre + its lane),
//              a rudder with a slew limit, turn rate ∝ rudder × speed (a big
//              hull answers slowly), acceleration limits. Lane changes, the
//              channel's bends, the Tidal Wake S-turns and the overdrive are
//              all real heading changes; the hull heels outward in a turn.
//   Scroll     the rig owns the arena camera for the duel: the field runs
//              BACKWARD (the ship advances on the pilot) and the camera eases
//              to hold the ship on its row, lagging when it accelerates (it
//              surges toward the pilot, then the camera catches up). Lateral
//              framing follows the channel and the ship; the camera lifts its
//              pitch in the overdrive and rolls a touch into hard turns.
//   Water      the hull is modelled below z = 0 (the sea clips it at a real
//              waterline). Every step the rig writes the ship's pose and speed
//              into the water surface (bow cushion, waterline foam, pressure
//              ripples, near Kelvin crests, hull shading) and up to six
//              disturbance rings (impacts, muzzle blast, depth charges). The
//              wake history (ShipWake) becomes foam ribbons that follow the
//              path it really took. Bow spray, side spray in turns, propeller
//              churn and water columns are particles.
//   Weapons    main turrets A (bow), B (port wing), C (starboard wing): yaw
//              within their arcs, elevation, barrels recoil one by one;
//              secondary twins; six CIWS gatlings (rotor spins); two VLS
//              batteries (cell doors open, missiles cold-launch and pitch
//              over); two ASW rocket launchers. Every bullet, shell, missile,
//              charge, flash and telegraph starts at its mechanism.
//   Abilities  Triple-Gun Salvo, Crimson Broadside, Anti-Air Saturation,
//              Harborbreaker Missile Salvo, Depth Charge Ring, Tidal Wake
//              Barrage, Coastal Bombardment, Monsoon Screen, Dreadnought
//              Overdrive, Scorched Reef.
//   Parts      main turrets ×3, secondary groups ×2 (twin + 3 CIWS each),
//              VLS batteries ×2, the bridge: persistent breakable parts; a
//              broken weapon stops at once. A dead bridge loses fire control
//              (aimed fire stops leading the pilot, the radar stops).
//
// The BossController keeps HP, phases, transitions and the death timeline.

const HOME_ROW = 168;          // screen row of the ship's origin (deck height) during the duel
const CRUISE = 0.72;           // default advance speed (world units / step)
const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = (v) => (v < 0 ? -1 : 1);

const SPEC = {
  shell: { shape: 'bigorb', color: 'red', n: 1, speed: 2.5, split: { shape: 'rice', color: 'red', n: 12, speed: 1.85 }, splitAt: 78, fixed: true },
  shellMk: { shape: 'bigorb', color: 'red', n: 1, speed: 2.7, split: { shape: 'rice', color: 'red', n: 16, speed: 2.0 }, splitAt: 72, fixed: true },
  plungeRing: { shape: 'orb', color: 'red', n: 11, speed: 1.75 },
  broad: { shape: 'orb', color: 'red', n: 4, spread: 0.9, speed: 2.1 },
  broadOrb: { shape: 'orb', color: 'pink', n: 3, spread: 0.5, speed: 1.8 },
  sec: { shape: 'orb', color: 'red', n: 2, spread: 0.1, speed: 2.8 },
  aa: { shape: 'rice', color: 'red', n: 1, speed: 3.5, fixed: true },
  aaAimed: { shape: 'rice', color: 'pink', n: 1, speed: 3.1, fixed: true },
  tidal: { shape: 'orb', color: 'red', n: 3, spread: 0.5, speed: 2.2 },
  depthRing: { shape: 'rice', color: 'red', n: 14, speed: 1.55 },
  depthRing2: { shape: 'orb', color: 'pink', n: 9, speed: 1.05 },
  debris: { shape: 'orb', color: 'orange', n: 4, spread: 0.8, speed: 1.9 },
  walkRing: { shape: 'rice', color: 'orange', n: 7, speed: 1.6 },
  storm: { shape: 'rice', color: 'pink', n: 1, speed: 2.9, angVel: 0.006, fixed: true },
  stormB: { shape: 'rice', color: 'pink', n: 1, speed: 2.9, angVel: -0.006, fixed: true },
  stormOrb: { shape: 'orb', color: 'red', n: 4, spread: 0.5, speed: 1.6, accel: 0.01, maxSpd: 2.6 },
};
const MSPLIT = { shape: 'rice', color: 'red', n: 7, speed: 1.6 };

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true, cy: 0, x: 0, pitch: 0, roll: 0,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x; out[1] = -y; out[2] = 1; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx; out[1] = -sy; out[2] = h; return out; },
  footprint() { return { x0: 0, x1: W, y0: -H, y1: 0 }; },
  frame() {},
};

const KEYS = ['x', 'y', 'h', 'pitch', 'roll', 'heave', 'sink', 'radar'];
const ARR = ['my', 'me', 'mr', 'sy', 'sr', 'cy', 'cp', 'crot', 'vd', 'ry', 're'];
const mat = () => new Float32Array(16);
const SIDE = (k) => (k < 3 ? 0 : 1);         // CIWS k → its secondary group
const VLS_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].sort((a, b) => ((a * 7) % 12) - ((b * 7) % 12));

export class CoralSiegeRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    this.s = {
      x: 0, y: 0, h: Math.PI, pitch: 0, roll: 0, heave: 0, sink: 0, radar: 0,
      my: [...CS.mainRest], me: [0.05, 0.05, 0.05], mr: new Array(9).fill(0), sy: [...CS.secRest], sr: [0, 0, 0, 0],
      cy: [...CS.ciwsRest], cp: new Array(6).fill(0.15), crot: new Array(6).fill(0), vd: new Array(24).fill(0), ry: [0, 0], re: [0.25, 0.25],
    };
    this.p = { ...this.s };
    for (const k of ARR) this.p[k] = [...this.s[k]];
    // Helm.
    this.v = 0; this.vT = CRUISE; this.acc = 0; this.rud = 0; this.dth = 0;
    this.lane = 0; this.weaveT = 200; this.rowT = HOME_ROW;
    this.cv = 0; this.ctrlCam = false; this.released = false;
    this.kick = { roll: 0, vr: 0, pitch: 0, vp: 0 };
    this.camKick = 0;
    // Weapons.
    this.dead = { main: [false, false, false], sec: [false, false], vls: [false, false], bridge: [false] };
    this.partHp = {}; this.partEnt = {};
    this.mainAim = [null, null, null]; this.meT = [0.05, 0.05, 0.05]; this.mainHeat = [0, 0, 0]; this.mainYawT = [null, null, null];
    this.secAim = [null, null]; this.secYawT = [null, null]; this.secHeat = [0, 0]; this.secAlt = [0, 0];
    this.ciwsAim = new Array(6).fill(null); this.ciwsYawT = new Array(6).fill(null); this.ciwsSpin = new Array(6).fill(0); this.ciwsHeat = new Array(6).fill(0);
    this.vdT = new Array(24).fill(0);
    this.rbuAim = [null, null]; this.reT = [0.25, 0.25]; this.rbuTube = [0, 0];
    // Attacks.
    this.heavy = null; this.queue = null;
    this.sv = null; this.bs = null; this.aa = null; this.ms = null; this.dc = null; this.tw = null; this.cb = null;
    this.salvoN = 0; this.mid = 0;
    this.overdrive = false; this.critical = false; this.odT = 0; this.stage = -1;
    this.monsoon = false; this.storm = 0; this.stormT = 0; this.boltT = 300; this.bolt = null;
    this.shells = []; this.sinkers = []; this.pops = []; this.missiles = []; this.zones = []; this.reticles = [];
    this.flashes = []; this.lines = []; this.debris = []; this.rings = []; this.fires = []; this.deckFires = []; this.burning = [];
    this.destroyed = new Set();
    this.wake = new ShipWake({ life: 600, armLife: 440, vRef: 1.1, sternHalf: 52, bowHalf: 5 });
    this.M = {
      world: mat(), hull: mat(), main: [mat(), mat(), mat()], mb: Array.from({ length: 9 }, mat), sec: [mat(), mat()], sb: Array.from({ length: 4 }, mat),
      ciws: Array.from({ length: 6 }, mat), cr: Array.from({ length: 6 }, mat), vls: [mat(), mat()], vd: Array.from({ length: 24 }, mat),
      rbu: [mat(), mat()], rt: [mat(), mat()], radar: mat(), tmp: mat(), tmp2: mat(), pad: mat(), deb: mat(),
    };
    this.t = 0;
    this.deathT = -1;
    this.wreck = false; this.wreckT = 0;
    this.placed = false;
    this.flash = 0;
    this.pr = [0, 0, 0, 0];
    this.q3 = [0, 0, 0];
    this.wp3 = [0, 0, 0];
    this.bodyLx = 0;
    this.pilotXs = []; this.campT = 0;
    this.engD = 0;
    this.surf = null;
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get fireControl() { return !this.dead.bridge[0]; }
  get rate() { return (this.c.intensity || 1) * (this.overdrive ? 1.25 : 1) * (this.critical ? 1.15 : 1) * (1 + 0.12 * (this.c.mk - 1)); }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view) {
      const keep = this.placed ? this._row() : null;
      if (this.view) {
        const i = this.view.extras.indexOf(this);
        if (i >= 0) this.view.extras.splice(i, 1);
        if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
        this._releaseSurface();
        if (this.pitch0 !== undefined) { this.view.cam.pitch = this.pitch0; this.view.cam.roll = 0; }
      }
      this.view = v && v.cam ? v : null;
      this.cam = this.view ? this.view.cam : ORTHO;
      this.ctrlCam = false;
      if (this.view) {
        this.view.extras.push(this);
        if (!this.wreck && !this.released) {
          // The battleship owns the scroll and the lateral framing for the duel.
          this.ctrlCam = true;
          this.view.speedTarget = null;
          if (!this.placed) this.cv = this.view.speed;
          this.view.speed = this.cv;
        }
        this.view.camFollow = (vw) => this._follow(vw);
        this.pitch0 = this.cam.pitch;
        this.surf = this.view.surfaces.find((s) => s.type === 'water') || null;
        if (this.surf) {
          this.surf.ship = { a: new Float32Array(4), b: new Float32Array(4), c: new Float32Array(4) };
          this.surf.rings = new Float32Array(24);
          this.base = { wave: [...(this.surf.wave || [1, 1, 1, 0.6])], foam: [...(this.surf.foam || [0.3, 0.55, 0.5, 0])], sky: [...this.surf.sky] };
        }
        this.cam.x = this.cam.px = channelX(this.cam.y + 200) * 0.55;
        this.cam.frame(1);
      }
      this.wake.clear();
      this.debris.length = 0; this.shells.length = 0; this.sinkers.length = 0; this.pops.length = 0; this.zones.length = 0; this.rings.length = 0;
      if (keep !== null) this._placeAt(keep, true);
    }
    if (this.view) this.cam.frame(1);
  }

  _releaseSurface() {
    if (this.surf) {
      delete this.surf.ship; delete this.surf.rings;
      if (this.base) { this.surf.wave = this.base.wave; this.surf.foam = this.base.foam; this.surf.sky = this.base.sky; }
    }
    this.surf = null;
  }

  /** Screen point → world point on the plane z = h. */
  _world(sx, sy, h = 0, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, (this.view ? this.view.floorZ : 0) + h, out) || out; }

  /** Put the ship's origin on screen row `row`, in the channel at its lane, heading down it. */
  _placeAt(row, keepLane = false) {
    const p = this._world(W / 2, row, CS.deckZ, this.q3);
    const y = p[1], s = this.s;
    if (!keepLane) this.lane = 0;
    s.x = channelX(y) + this.lane; s.y = y;
    s.h = Math.atan2(-channelSlope(y), -1);
    for (const k of KEYS) this.p[k] = s[k];
    this._pose(1);
  }

  _row() { return this._scr(this.M.world, 0, 0, CS.deckZ)[1]; }

  /** Camera framing (after each camera step): channel + ship laterally, pitch lift and roll into turns. */
  _follow(vw) {
    const cam = vw.cam, s = this.s;
    if (this.wreck || this.c.state === 'dying') {
      cam.x += clamp(channelX(cam.y + 200) * 0.55 - cam.x, -1, 1) * 0.04;
      cam.roll *= 0.95;
      if (this.pitch0 !== undefined) cam.pitch += (this.pitch0 - cam.pitch) * 0.03;
      return;
    }
    const tx = clamp(channelX(s.y - 80) * 0.45 + s.x * 0.55, s.x - 80, s.x + 80);
    cam.x += clamp((tx - cam.x) * 0.04, -2.2, 2.2);
    const pT = (this.pitch0 ?? cam.pitch) + (this.overdrive ? 0.035 : 0) + (this.critical ? 0.015 : 0) + this.camKick;
    cam.pitch += (pT - cam.pitch) * 0.025;
    const rT = clamp(-this.dth * 6, -0.02, 0.02) + Math.sin(this.t * 0.013) * 0.004 * this.storm;
    cam.roll += (rT - cam.roll) * 0.03;
    this.camKick *= 0.9;
  }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e, s = this.s;
    this._attach();
    if (!this.placed) {
      this.placed = true;
      // It steams in from up the channel and settles at its station ahead of the pilot.
      this._placeAt(c.state === 'enter' ? -70 : HOME_ROW);
      this.v = c.state === 'enter' ? 2.6 : CRUISE;
      if (c.state === 'enter' && this.is3D) sfx.play('shipHorn', { pan: 0 });
    }
    for (const k of KEYS) this.p[k] = s[k];
    for (const k of ARR) for (let i = 0; i < s[k].length; i++) this.p[k][i] = s[k][i];
    this.t++;

    switch (c.state) {
      case 'enter': this.rowT = HOME_ROW; this.vT = CRUISE; break;
      case 'fight': this._fight(); break;
      case 'transition': this.rowT = HOME_ROW; this.vT = CRUISE; this._endAttacks(); this._helm(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._speedCamera();
    this._steer();
    this._motion();
    this._weaponsAnim();
    this._pose(1);
    this._body();
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._stageCheck();
    this._updateSalvo();
    this._updateBroadside();
    this._updateAA();
    this._updateMissiles();
    this._updateDepth();
    this._updateTidal();
    this._updateCoastal();
    this._updateStorm();
    this._runQueue();
    this._updateShells();
    this._updatePops();
    this._trackMissiles();
    this._updateSinkers();
    this._updateDebris();
    this._updateRings();
    this._water();
    if (this.is3D) { this._fx(); this._sound(); }
    for (const L of [this.flashes, this.lines, this.reticles, this.zones]) for (let i = L.length - 1; i >= 0; i--) if (++L[i].t >= L[i].life) L.splice(i, 1);
  }

  // ------------------------------------------------------------ fight AI

  _phaseMove() { const ph = this.c.phase; return (ph && ph.move) || {}; }

  _fight() {
    this._helm();
    this._camping();
  }

  /** Lane choice and cruise speed (nothing here fires). */
  _helm() {
    const c = this.c, w = this.w, mv = this._phaseMove();
    const fight = c.state === 'fight';
    let vT = (mv.speed ?? CRUISE);
    if (this.overdrive) vT *= 1.9 + 0.35 * Math.sin(this.t * 0.011);
    if (this.critical) vT *= 1.1;
    if (this.tw) vT = this.tw.vT;
    if (this.cb && this.cb.phase !== 'done') vT *= 0.75;          // steadies for the bombardment
    this.vT = vT;
    this.rowT = HOME_ROW + Math.sin(this.t * 0.009) * 10 + (this.overdrive ? 22 + 14 * Math.sin(this.t * 0.011) : 0) + (this.tw ? this.tw.row : 0);
    if (!fight || this.tw) return;
    // Lane changes by steering: wider and more often in later phases / the overdrive.
    const weave = (mv.weave ?? 0.5) * (this.overdrive ? 1.8 : 1) * (this.critical ? 1.3 : 1);
    if (--this.weaveT <= 0 && weave > 0) {
      let nl = w.rng.range(-SHIP_ROOM, SHIP_ROOM);
      if (Math.abs(nl - this.lane) < 20) nl = clamp(this.lane + w.rng.sign() * w.rng.range(26, 46), -SHIP_ROOM, SHIP_ROOM);
      // Anti-camping: a pilot holding one column gets the bow (and A turret) lined up on it.
      if (this.campT > 220 && w.rng.chance(0.6)) {
        const q = this._world(w.aimX, w.aimY, 0, this.q3);
        nl = clamp(q[0] - channelX(q[1]), -SHIP_ROOM, SHIP_ROOM);
      }
      this.lane = nl;
      this.weaveT = Math.round(w.rng.range(240, 420) / weave);
    }
  }

  _camping() {
    const p = this.w.player;
    if (!p) return;
    this.pilotXs.push(p.x);
    if (this.pilotXs.length > 240) this.pilotXs.shift();
    let lo = Infinity, hi = -Infinity;
    for (const x of this.pilotXs) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    this.campT = hi - lo < 40 ? this.campT + 1 : 0;
  }

  // ------------------------------------------------------------ physics

  /** Camera (scroll) speed: holds the ship on its row, lagging behind its accelerations. */
  _speedCamera() {
    if (!this.ctrlCam || !this.view) return;
    const c = this.c, s = this.s, dying = c.state === 'dying';
    const vy = Math.cos(s.h) * this.v;
    let T;
    if (dying) T = this.deathT > 150 ? this.view.baseSpeed : vy * 0.5;
    else if (c.state === 'enter') T = -CRUISE;
    else T = vy - clamp((this._row() - this.rowT) * 0.014, -1.0, 1.4);
    const rate = c.state === 'enter' || dying ? 0.03 : this.overdrive ? 0.008 : 0.012;
    this.cv += clamp(T - this.cv, -rate, rate);
    this.view.speed = this.cv;
  }

  _steer() {
    const s = this.s, c = this.c, dying = c.state === 'dying';
    // Pure pursuit on a look-ahead point down the channel (the ship heads toward −y).
    const LA = 230 + this.v * 70;
    const yl = s.y - LA, xl = channelX(yl) + this.lane;
    let hd = Math.atan2(xl - s.x, yl - s.y);
    if (dying) hd = s.h + (this.deathT > 40 ? this.spinDir * 0.4 : 0);
    const big = this.overdrive || this.tw || this.critical;
    const rmax = big ? 1 : 0.7;
    const rT = clamp(wrapA(hd - s.h) * 3.4, -rmax, rmax);
    this.rud += clamp(rT - this.rud, -0.014, 0.014);
    const dth = this.rud * Math.max(0.25, this.v) * (this.tw ? 0.0062 : 0.0044);
    this.dth += (dth - this.dth) * 0.2;
    s.h += this.dth;
  }

  _motion() {
    const s = this.s, c = this.c, R = this.w.fxRng;
    const dying = c.state === 'dying';
    // ---- Speed: the engines answer slowly (a 60 000-tonne hull).
    let vT = this.vT;
    if (c.state === 'enter') vT = CRUISE + clamp((this.rowT - this._row()) * 0.012, 0, 2.0);
    if (dying) vT = this.deathT < 120 ? 0.35 : 0.1;
    if (!this.view) vT = 0;
    const up = this.overdrive || this.tw ? 0.009 : c.state === 'enter' ? 0.02 : 0.005;
    const v0 = this.v;
    this.v += clamp(vT - this.v, -0.008, up);
    this.acc = this.v - v0;
    // ---- Integrate along the heading; never leave the fairway.
    s.x += Math.sin(s.h) * this.v;
    s.y += Math.cos(s.h) * this.v;
    const off = s.x - channelX(s.y), lim = SHIP_ROOM + 8;
    if (Math.abs(off) > lim) s.x = channelX(s.y) + sgn(off) * lim;
    // ---- Seakeeping: swell heave / pitch / roll (bigger in the storm), heel in turns,
    // squat under acceleration, recoil and impact kicks on a damped spring.
    const st = 1 + this.storm * 2.6, t = this.t;
    const heaveT = (Math.sin(t * 0.021) * 1.1 + Math.sin(t * 0.037 + 1.3) * 0.6) * st;
    const pitchT = Math.sin(t * 0.017 + 0.4) * 0.0045 * st - this.acc * 0.8 - this.v * 0.0016;
    const rollT = Math.sin(t * 0.013 + 0.7) * 0.0065 * st - this.dth * 10;
    const K = this.kick;
    K.vr += -K.roll * 0.035 - K.vr * 0.07; K.roll += K.vr;
    K.vp += -K.pitch * 0.05 - K.vp * 0.09; K.pitch += K.vp;
    s.heave += (heaveT - s.heave) * 0.06;
    s.pitch += (pitchT - s.pitch) * 0.06;
    s.roll += (rollT - s.roll) * 0.05;
    s.pitch += K.pitch * 0.08; s.roll += K.roll * 0.08;
    if (dying) {
      // Lists to the side of the worst damage, settles by the bow.
      const k = Math.min(1, this.deathT / 150);
      s.roll += (this.listDir * 0.11 * k - s.roll) * 0.03;
      s.pitch += (-0.035 * k - s.pitch) * 0.03;
      s.sink = Math.max(s.sink, (this.deathT - 112) * 0.06);
      s.heave += R.range(-0.2, 0.2) * (this.deathT < 112 ? 1 : 0);
    }
    s.radar += this.fireControl && !this.wreck ? 0.034 : 0;
  }

  /** Slew turrets / mounts toward their targets, settle recoil, spin rotors, open / close doors. */
  _weaponsAnim() {
    const s = this.s, w = this.w, live = (this.c.state === 'fight' || this.c.state === 'enter') && !this.wreck;
    const pilot = this._world(w.aimX, w.aimY, 0, this.wp3);
    const fast = this.overdrive || this.critical ? 1.3 : 1;
    for (let i = 0; i < 3; i++) {
      if (this.dead.main[i]) continue;
      const pv = CS.main[i], arc = CS.mainArc[i];
      let want = CS.mainRest[i];
      if (this.mainYawT[i] !== null) want = this.mainYawT[i];
      else if (this.mainAim[i]) want = this._yawTo(pv, this.mainAim[i]);
      else if (live) want = this._yawTo(pv, pilot);
      want = clamp(wrapA(want), arc[0], arc[1]);
      s.my[i] += clamp(want - s.my[i], -0.022 * fast, 0.022 * fast);
      s.me[i] += clamp(this.meT[i] - s.me[i], -0.012, 0.012);
      this.mainHeat[i] = Math.max(0, this.mainHeat[i] - 0.006);
    }
    for (let k = 0; k < 9; k++) s.mr[k] *= 0.88;
    for (let i = 0; i < 2; i++) {
      if (this.dead.sec[i]) continue;
      let want = CS.secRest[i];
      if (this.secYawT[i] !== null) want = this.secYawT[i];
      else if (this.secAim[i]) want = this._yawTo(CS.sec[i], this.secAim[i]);
      else if (live) want = this._yawTo(CS.sec[i], pilot);
      want = i ? clamp(wrapA(want), -2.9, 0.4) : clamp(wrapA(want), -0.4, 2.9);
      s.sy[i] += clamp(want - s.sy[i], -0.045 * fast, 0.045 * fast);
      this.secHeat[i] = Math.max(0, this.secHeat[i] - 0.01);
    }
    for (let k = 0; k < 4; k++) s.sr[k] *= 0.8;
    for (let k = 0; k < 6; k++) {
      if (this.dead.sec[SIDE(k)]) { this.ciwsSpin[k] *= 0.95; continue; }
      const pv = CS.ciws[k], rest = CS.ciwsRest[k];
      let want = rest;
      if (this.ciwsYawT[k] !== null) want = this.ciwsYawT[k];
      else if (this.ciwsAim[k]) want = this._yawTo(pv, this.ciwsAim[k]);
      else if (live) want = this._yawTo(pv, pilot);
      want = rest + clamp(wrapA(want - rest), -2.4, 2.4);
      s.cy[k] += clamp(wrapA(want - s.cy[k]), -0.12 * fast, 0.12 * fast);
      s.cp[k] += ((this.ciwsAim[k] || this.ciwsYawT[k] !== null ? 0.08 : 0.2) - s.cp[k]) * 0.1;
      this.ciwsSpin[k] += ((this.ciwsHeat[k] > 0.05 ? 0.95 : 0.04) - this.ciwsSpin[k]) * 0.08;
      s.crot[k] += this.ciwsSpin[k];
      this.ciwsHeat[k] = Math.max(0, this.ciwsHeat[k] - 0.03);
    }
    for (let k = 0; k < 24; k++) s.vd[k] += clamp((this.dead.vls[k < 12 ? 0 : 1] ? 0.15 : this.vdT[k]) - s.vd[k], -0.09, 0.09);
    for (let i = 0; i < 2; i++) {
      const want = this.rbuAim[i] ? this._yawTo(CS.rbu[i], this.rbuAim[i]) : 0;
      s.ry[i] += clamp(clamp(wrapA(want), -1.2, 1.2) - s.ry[i], -0.05, 0.05);
      s.re[i] += clamp(this.reT[i] - s.re[i], -0.03, 0.03);
    }
  }

  /** Yaw (local Rz convention) that points a hull-mounted pivot at world point t. */
  _yawTo(pivot, t) {
    const s = this.s, ch = Math.cos(s.h), sh = Math.sin(s.h);
    const dx = t[0] - s.x, dy = t[1] - s.y;
    const lx = dx * ch - dy * sh - pivot[0], ly = dx * sh + dy * ch - pivot[1];
    return Math.atan2(-lx, ly);
  }

  /** Local hull point (x, y) of a world point. */
  _local(t, out = [0, 0]) {
    const s = this.s, ch = Math.cos(s.h), sh = Math.sin(s.h), dx = t[0] - s.x, dy = t[1] - s.y;
    out[0] = dx * ch - dy * sh; out[1] = dx * sh + dy * ch;
    return out;
  }

  // ------------------------------------------------------------- pose

  _pose(alpha) {
    const s = this.s, p = this.p, M = this.M, T = M.tmp, T2 = M.tmp2;
    const L = (k) => lerp(p[k], s[k], alpha);
    const LA = (k, i) => lerp(p[k][i], s[k][i], alpha);
    const x = L('x'), y = L('y'), h = p.h + wrapA(s.h - p.h) * alpha;
    const z0 = this.view ? this.view.floorZ : 0;
    const cs = Math.cos(h), sn = Math.sin(h), Wm = M.world;
    Wm.fill(0); Wm[0] = cs; Wm[1] = -sn; Wm[4] = sn; Wm[5] = cs; Wm[10] = 1; Wm[12] = x; Wm[13] = y; Wm[14] = z0; Wm[15] = 1;
    // Hull on the sea: heave, pitch about the centre of flotation, roll about the keel line.
    M4.mul(Wm, M4.trans(0, 0, L('heave') - L('sink'), T), M.hull);
    M4.mul(M.hull, M4.rotX(L('pitch'), T), M.hull);
    M4.mul(M.hull, M4.rotY(L('roll'), T), M.hull);
    for (let i = 0; i < 3; i++) {
      const pv = CS.main[i];
      M4.mul(M.hull, M4.trans(pv[0], pv[1], pv[2], T), M.main[i]);
      M4.mul(M.main[i], M4.rotZ(LA('my', i), T2), M.main[i]);
      for (let j = 0; j < 3; j++) {
        const b = CS.mainBarrels[j], m = M.mb[i * 3 + j];
        M4.mul(M.main[i], M4.trans(b[0], b[1], b[2], T), m);
        M4.mul(m, M4.rotX(LA('me', i), T2), m);
        M4.mul(m, M4.trans(0, -LA('mr', i * 3 + j) * 9, 0, T), m);
      }
    }
    for (let i = 0; i < 2; i++) {
      const pv = CS.sec[i];
      M4.mul(M.hull, M4.trans(pv[0], pv[1], pv[2], T), M.sec[i]);
      M4.mul(M.sec[i], M4.rotZ(LA('sy', i), T2), M.sec[i]);
      for (let j = 0; j < 2; j++) {
        const b = CS.secBarrels[j], m = M.sb[i * 2 + j];
        M4.mul(M.sec[i], M4.trans(b[0], b[1], b[2], T), m);
        M4.mul(m, M4.rotX(0.05, T2), m);
        M4.mul(m, M4.trans(0, -LA('sr', i * 2 + j) * 5, 0, T), m);
      }
      const vp = CS.vls[i];
      M4.mul(M.hull, M4.trans(vp[0], vp[1], vp[2], T), M.vls[i]);
      for (let k = 0; k < 12; k++) {
        const cell = CS.vlsCells[k], m = M.vd[i * 12 + k];
        M4.mul(M.vls[i], M4.trans(cell[0] + 4.4, cell[1], CS.vlsTop + 0.15, T), m);
        M4.mul(m, M4.rotY(LA('vd', i * 12 + k) * 1.9, T2), m);
      }
      const rp = CS.rbu[i];
      M4.mul(M.hull, M4.trans(rp[0], rp[1], rp[2], T), M.rbu[i]);
      M4.mul(M.rbu[i], M4.rotZ(LA('ry', i), T2), M.rbu[i]);
      M4.mul(M.rbu[i], M4.trans(CS.rbuPivot[0], CS.rbuPivot[1], CS.rbuPivot[2], T), M.rt[i]);
      M4.mul(M.rt[i], M4.rotX(LA('re', i), T2), M.rt[i]);
    }
    for (let k = 0; k < 6; k++) {
      const pv = CS.ciws[k];
      M4.mul(M.hull, M4.trans(pv[0], pv[1], pv[2], T), M.ciws[k]);
      M4.mul(M.ciws[k], M4.rotZ(LA('cy', k), T2), M.ciws[k]);
      M4.mul(M.ciws[k], M4.trans(CS.ciwsRotor[0], CS.ciwsRotor[1], CS.ciwsRotor[2], T), M.cr[k]);
      M4.mul(M.cr[k], M4.rotX(LA('cp', k), T2), M.cr[k]);
      M4.mul(M.cr[k], M4.rotY(LA('crot', k), T2), M.cr[k]);
    }
    M4.mul(M.hull, M4.trans(CS.radar[0], CS.radar[1], CS.radar[2], T), M.radar);
    M4.mul(M.radar, M4.rotZ(L('radar'), T2), M.radar);
  }

  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.wp3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt, out = {}) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1], k = a[2];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    out.x = ax; out.y = ay; out.k = k; out.ang = Math.atan2(b[1] - ay, b[0] - ax);
    return out;
  }

  // ------------------------------------------------------------ hull body

  /** The boss's hit body rides the hull under the pilot's guns (bow, or the wing on that side). */
  _body() {
    const e = this.c.e, p = this.w.player;
    let lx = 0;
    if (p) { const q = this._world(p.x, p.y, CS.deckZ, this.q3); lx = this._local(q, [0, 0])[0]; }
    this.bodyLx += (clamp(lx, -134, 134) - this.bodyLx) * 0.25;
    const wing = Math.abs(this.bodyLx) > 62;
    const q = this._scr(this.M.hull, this.bodyLx, wing ? 46 : 168, CS.deckZ + 4);
    // Kept inside the World's field box (entities outside it are culled).
    e.x = clamp(q[0], -18, W + 18); e.y = clamp(q[1], -18, H + 18);
    e.r = 64;
    e.rot = 0;
    e.scale = this.pr[2] || 1;
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
    if (kind === 'main') return this._scr(this.M.main[i], 0, 0, 10);
    if (kind === 'sec') return this._scr(this.M.sec[i], 0, 0, 6);
    if (kind === 'vls') return this._scr(this.M.vls[i], 0, 0, 4);
    return this._scr(this.M.hull, 0, -52, 66);
  }

  _mountWorld(kind, i, out = [0, 0, 0]) {
    if (kind === 'main') return M4.point(this.M.main[i], 0, 0, 10, out);
    if (kind === 'sec') return M4.point(this.M.sec[i], 0, 0, 6, out);
    if (kind === 'vls') return M4.point(this.M.vls[i], 0, 0, 4, out);
    return M4.point(this.M.hull, 0, -52, 66, out);
  }

  partDestroyed(kind, i) {
    const w = this.w, R = w.fxRng;
    this.dead[kind][i] = true;
    const p = this._mountPt(kind, i), x = p[0], y = p[1];
    const big = kind === 'main' ? 1.9 : kind === 'bridge' ? 2.2 : 1.35;
    w.explosions.blast(x, y, big, [1, 0.45, 0.25]);
    w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-18, 18), y + R.range(-14, 14), 1.0, [1, 0.35, 0.2]));
    w.explosions.schedule(14, () => w.explosions.blast(x + R.range(-24, 24), y + R.range(-18, 18), 0.8, [1, 0.6, 0.3]));
    w.explosions.sparks(x, y, 34, [1, 0.6, 0.4], 6, 34, 4);
    w.g.camera.addTrauma(kind === 'main' || kind === 'bridge' ? 0.55 : 0.35);
    w.g.renderer.post.shockwave(x, y, 0.03, 0.02, 0.4);
    this._shards(x, y, 14);
    const q = this._mountWorld(kind, i, [0, 0, 0]);
    this._plates(q, kind === 'main' ? 9 : 5);
    sfx.play('partDown', { pan: (x - W / 2) / W });
    if (kind === 'main') { this.mainAim[i] = null; this.mainYawT[i] = null; }
    if (kind === 'sec') { this.secAim[i] = null; this.secYawT[i] = null; for (let k = i * 3; k < i * 3 + 3; k++) { this.ciwsAim[k] = null; this.ciwsYawT[k] = null; } }
    if (kind === 'vls') for (let k = 0; k < 12; k++) this.vdT[i * 12 + k] = 0;
    if (kind === 'bridge' && this.c.state === 'fight') { this._callout('BRIDGE DESTROYED — FIRE CONTROL LOST', 'gold'); sfx.play('engineFail', { pan: 0 }); }
    this.fires.push({ kind, i, s: kind === 'main' ? 1.15 : kind === 'bridge' ? 1.4 : 0.8 });
  }

  /** Mount hitboxes ride the projected 3D mounts (kept inside the World's field box). */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const d = part.d, pe = part.e;
      const q = this._mountPt(d.mount, d.side);
      pe.x = clamp(q[0], -18, W + 18); pe.y = clamp(q[1], -18, H + 18);
      if (this.is3D) pe.f = null;
    }
  }

  /** Contact: the hull's projected waterline outline is solid (only while fighting). */
  _contact() {
    const c = this.c, p = this.w.player;
    if (c.state !== 'fight' || !p || !p.collidable || p.invulnerable) return;
    const O = CS.outline, n = O.length;
    let inside = false;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const A = this._scr(this.M.hull, O[a][0], O[a][1], 14), ax = A[0], ay = A[1];
      const B = this._scr(this.M.hull, O[b][0], O[b][1], 14), bx = B[0], by = B[1];
      if ((ay > p.y) !== (by > p.y) && p.x < ((bx - ax) * (p.y - ay)) / (by - ay || 1e-6) + ax) inside = !inside;
    }
    if (inside) p.hit();
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
    if (q === 'salvo') this.startSalvo();
    else if (q === 'broadside') this.startBroadside();
    else if (q === 'aa') this.startAA();
    else if (q === 'missiles') this.startMissiles();
    else if (q === 'depth') this.startDepth();
    else if (q === 'tidal') this.startTidal();
    else if (q === 'coastal') this.startCoastal();
  }

  _callout(text, cls = 'red') { if (this.c._emit) this.c._emit('bossCallout', { text, cls }); }

  // ---------------------------------------- 1. TRIPLE-GUN SALVO (main turrets)

  /** mode: 'direct' (air-burst shells at the pilot) | 'plunge' (shells to marked impact zones) | null (alternate). */
  startSalvo(mode = null) {
    const order = [0, 1, 2].filter((i) => !this.dead.main[i]);
    if (!order.length || !this._canHeavy('salvo')) return false;
    this.heavy = 'salvo';
    const plunge = mode ? mode === 'plunge' : this.salvoN++ % 2 === 1;
    this.sv = { phase: 'aim', t: 0, order, k: 0, j: 0, plunge, zones: null };
    sfx.play('hydraulic', { pan: 0 });
    if (this.salvoN < 3 || plunge) this._callout(plunge ? 'TRIPLE-GUN SALVO — IMPACT ZONES' : 'TRIPLE-GUN SALVO', 'red');
    return true;
  }

  _updateSalvo() {
    const f = this.sv, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endSalvo(); return; }
    f.t++;
    while (f.k < f.order.length && this.dead.main[f.order[f.k]]) { f.k++; f.phase = 'aim'; f.t = 0; }
    if (f.k >= f.order.length) { this._endSalvo(); return; }
    const i = f.order[f.k], r = this.rate;
    if (f.phase === 'aim') {
      if (f.t === 1) {
        // Fire control: the pilot's spot, its predicted spot (lost with the bridge), a bracket.
        const lead = this.fireControl ? 42 : 0;
        const p = this.w.player, vx = p ? (p.x - (p.px ?? p.x)) : 0, vy = p ? (p.y - (p.py ?? p.y)) : 0;
        const pts = [[w.aimX, w.aimY], [w.aimX + vx * lead, w.aimY + vy * lead], [w.aimX + w.rng.sign() * w.rng.range(60, 100), w.aimY + w.rng.range(-50, 30)]];
        f.zones = pts.map(([sx, sy]) => this._world(clamp(sx, 34, W - 34), clamp(sy, 300, H - 30), 0, [0, 0, 0]));
        this.mainAim[i] = f.plunge ? f.zones[0] : this._world(clamp(w.aimX + vx * lead * 0.6, 20, W - 20), w.aimY, 0, [0, 0, 0]);
        this.meT[i] = f.plunge ? 0.36 : 0.06;
        if (f.plunge) for (const z of f.zones) this.zones.push({ x: z[0], y: z[1], z: 0.6, r: 42, t: 0, life: 32 + 18 + 64, kind: 'shell' });
      }
      // Aim lines along the barrels while the turret trains (direct fire).
      if (!f.plunge && f.t > 6 && f.t % 2 === 0) for (let j = 0; j < 3; j++) { const mz = this._muzzle(this.M.mb[i * 3 + j], CS.mainMuzzle); this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 520, t: 0, life: 3, k: f.t / 30, col: [2.4, 0.3, 0.35] }); }
      const err = Math.abs(wrapA(this._yawTo(CS.main[i], this.mainAim[i]) - this.s.my[i]));
      if (f.t >= Math.round(30 / Math.min(1.5, r)) && (err < 0.08 || f.t > 70)) { f.phase = 'fire'; f.t = 0; f.j = 0; }
    } else if (f.phase === 'fire') {
      const gap = Math.max(4, Math.round(7 / r));
      if (f.t % gap === 1 && f.j < 3) { this._mainShot(i, f.j, f.plunge ? f.zones[f.j] : null, { spread: f.j - 1 }); f.j++; }
      if (f.j >= 3 && f.t > gap * 3 + 10) { this.mainAim[i] = null; this.meT[i] = 0.05; f.k++; f.phase = 'aim'; f.t = 0; }
    }
  }

  _endSalvo() {
    if (this.sv) for (const i of this.sv.order) { this.mainAim[i] = null; this.meT[i] = 0.05; }
    this.sv = null; this._heavyDone('salvo');
  }

  /**
   * One big gun fires: recoil, flash, smoke, blast on the water, the round.
   * target: world [x, y, z] → a plunging 3D shell onto it (else a direct-fire round).
   * o: { spread (barrel offset −1..1), spec (direct round), ring (burst spec of a plunging shell),
   *      coastal (installation: a coastal shell instead) }
   */
  _mainShot(i, j, target, o = {}) {
    const w = this.w, m = this.M.mb[i * 3 + j];
    const mz = this._muzzle(m, CS.mainMuzzle, this.mzM || (this.mzM = {}));
    const wq = M4.point(m, 0, CS.mainMuzzle[1] + 2, 0, [0, 0, 0]);
    const dir = M4.dir(m, 0, 1, 0, [0, 0, 0]);
    this.s.mr[i * 3 + j] = 1;
    this.mainHeat[i] = Math.min(1, this.mainHeat[i] + 0.3);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 13, kind: 'main', w: wq, k: mz.k });
    // Muzzle blast flattens the sea under the barrel.
    const hz = Math.hypot(dir[0], dir[1]) || 1;
    this._ring(wq[0] + (dir[0] / hz) * 26, wq[1] + (dir[1] / hz) * 26, 6, 2.2, 0.55, 40);
    if (this.is3D) {
      const fx = this.view.fx;
      for (let k = 0; k < 4; k++) fx._smoke(wq[0] + dir[0] * k * 9, wq[1] + dir[1] * k * 9, wq[2] + dir[2] * k * 9, 0.75 - k * 0.1, 0.25, 0.5);
      this._sprayAt(wq[0] + (dir[0] / hz) * 30, wq[1] + (dir[1] / hz) * 30, 0.5);
    }
    // Recoil heels the ship away from the gun; the shot shakes the camera.
    const side = this._local([wq[0], wq[1]])[0];
    this.kick.vr += -sgn(side) * Math.min(1, Math.abs(side) / 100) * 0.0035;
    this.kick.vp += 0.0012;
    w.g.camera.addTrauma(0.12);
    this.camKick = Math.min(0.012, this.camKick + 0.004);
    if (j === 0) w.g.renderer.post.shockwave(mz.x, mz.y, 0.012, 0.02, 0.25);
    sfx.play('navalGun', { pan: (mz.x - W / 2) / W });
    if (o.coastal) {
      const tg = o.coastal, R = w.fxRng;
      this.shells.push({ x0: wq[0], y0: wq[1], z0: wq[2], x1: tg.x + R.range(-10, 10), y1: tg.y + R.range(-10, 10), z1: tg.z, t: 0, T: 70, apex: 280, kind: 'coastal', r: tg.r, target: tg, last: !!o.last, trail: [] });
    } else if (target) {
      this.shells.push({ x0: wq[0], y0: wq[1], z0: wq[2], x1: target[0], y1: target[1], z1: 0, t: 0, T: 64, apex: 210, kind: 'plunge', r: o.r || 42, ringSpec: o.ring || null, trail: [] });
    } else {
      const sp = o.spec || (this.c.mk >= 2 || this.critical ? SPEC.shellMk : SPEC.shell);
      P.shoot(w, mz.x, mz.y, mz.ang + (o.spread || 0) * 0.07, sp.speed, sp);
    }
  }

  // ------------------------------------------ 2. CRIMSON BROADSIDE

  startBroadside(volleys = 0) {
    const ok = !this.dead.main[1] || !this.dead.main[2] || !this.dead.sec[0] || !this.dead.sec[1];
    if (!ok || !this._canHeavy('broadside')) return false;
    this.heavy = 'broadside';
    this.bs = { phase: 'train', t: 0, v: 0, n: volleys || (6 + (this.c.mk >= 2 ? 2 : 0)), side: this.w.rng.sign() };
    this._callout('CRIMSON BROADSIDE', 'red');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  /** Port / starboard batteries trained abeam fire staggered volleys; each volley's fans walk forward. */
  _updateBroadside() {
    const f = this.bs;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endBroadside(); return; }
    f.t++;
    const sweep = f.v / Math.max(1, f.n - 1);           // 0 → 1 over the volleys: abeam → forward
    const yawW = lerp(1.32, 0.55, sweep), yawS = lerp(1.5, 0.7, sweep);
    this.mainYawT[1] = this.dead.main[1] ? null : yawW; this.mainYawT[2] = this.dead.main[2] ? null : -yawW;
    this.secYawT[0] = this.dead.sec[0] ? null : yawS; this.secYawT[1] = this.dead.sec[1] ? null : -yawS;
    this.meT[1] = this.meT[2] = 0.07;
    if (f.phase === 'train') {
      if (f.t > 8 && f.t % 2 === 0) for (const i of [1, 2]) if (!this.dead.main[i]) { const mz = this._muzzle(this.M.mb[i * 3 + 1], CS.mainMuzzle); this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 420, t: 0, life: 3, k: f.t / 36, col: [2.4, 0.3, 0.4] }); }
      if (f.t >= 36) { f.phase = 'fire'; f.t = 0; }
    } else if (f.phase === 'fire') {
      const gap = Math.max(12, Math.round(24 / this.rate));
      const side = (f.v + (f.side > 0 ? 1 : 0)) & 1;   // 0 port, 1 starboard
      const tt = f.t % gap;
      // The side's wing turret ripples its three guns, then its secondary twin answers.
      if (!this.dead.main[1 + side] && (tt === 1 || tt === 4 || tt === 7)) {
        const j = (tt - 1) / 3, m = this.M.mb[(1 + side) * 3 + j];
        const mz = this._muzzle(m, CS.mainMuzzle, this.mzB || (this.mzB = {}));
        // Each barrel lays its fan at its own angle: three overlapping fans with lanes between them.
        P.fan(this.w, mz.x, mz.y, mz.ang + (j - 1) * 0.24, SPEC.broad);
        this._gunFx(1 + side, j, mz, 0.8);
      }
      if (!this.dead.sec[side] && (tt === 9 || tt === 11)) this._secShot(side, SPEC.broadOrb);
      if (tt === gap - 1) { f.v++; if (f.v >= f.n) { f.phase = 'stow'; f.t = 0; } }
    } else if (f.phase === 'stow') { if (f.t >= 30) this._endBroadside(); }
  }

  /** Muzzle effects without a round (the caller fired the bullets). */
  _gunFx(i, j, mz, scale = 1) {
    const m = this.M.mb[i * 3 + j], wq = M4.point(m, 0, CS.mainMuzzle[1] + 2, 0, [0, 0, 0]), dir = M4.dir(m, 0, 1, 0, [0, 0, 0]);
    this.s.mr[i * 3 + j] = 1;
    this.mainHeat[i] = Math.min(1, this.mainHeat[i] + 0.25);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 11, kind: 'main', w: wq, k: mz.k * scale });
    const hz = Math.hypot(dir[0], dir[1]) || 1;
    this._ring(wq[0] + (dir[0] / hz) * 24, wq[1] + (dir[1] / hz) * 24, 5, 2, 0.45 * scale, 36);
    if (this.is3D) for (let k = 0; k < 3; k++) this.view.fx._smoke(wq[0] + dir[0] * k * 9, wq[1] + dir[1] * k * 9, wq[2], 0.6, 0.25, 0.5);
    const side = this._local([wq[0], wq[1]])[0];
    this.kick.vr += -sgn(side) * 0.003 * scale;
    this.w.g.camera.addTrauma(0.08 * scale);
    sfx.play('navalGun', { pan: (mz.x - W / 2) / W, v: 0.8 });
  }

  _secShot(i, spec) {
    const j = (this.secAlt[i] ^= 1), m = this.M.sb[i * 2 + j];
    const mz = this._muzzle(m, CS.secMuzzle, this.mzS || (this.mzS = {}));
    P.fan(this.w, mz.x, mz.y, mz.ang, spec);
    this.s.sr[i * 2 + j] = 1;
    this.secHeat[i] = Math.min(1, this.secHeat[i] + 0.25);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 7, kind: 'sec', w: M4.point(m, 0, CS.secMuzzle[1], 0, [0, 0, 0]), k: mz.k });
    if (this.is3D && this.w.fxRng.chance(0.4)) { const q = M4.point(m, 0, CS.secMuzzle[1], 0, [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.35, 0.3, 0.5); }
    sfx.play('autoCannon', { pan: (mz.x - W / 2) / W });
  }

  _endBroadside() {
    this.bs = null;
    this.mainYawT[1] = this.mainYawT[2] = null; this.secYawT[0] = this.secYawT[1] = null;
    this.meT[1] = this.meT[2] = 0.05;
    this._heavyDone('broadside');
  }

  // ------------------------------------------ 3. ANTI-AIR SATURATION (CIWS)

  startAA(T = 0) {
    if ((this.dead.sec[0] && this.dead.sec[1]) || !this._canHeavy('aa')) return false;
    this.heavy = 'aa';
    this.aa = { t: 0, T: T || 300 };
    this._callout('ANTI-AIR SATURATION', 'red');
    return true;
  }

  /**
   * Six gatlings, three roles: the deckhouse pair fires aimed bursts, the
   * forward sponson mounts sweep across, the aft ones walk lanes. Every
   * mount keeps its own rhythm, so the streams cross with readable gaps.
   */
  _updateAA() {
    const f = this.aa, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight' || (this.dead.sec[0] && this.dead.sec[1])) { this._endAA(); return; }
    f.t++;
    const r = this.rate;
    for (let k = 0; k < 6; k++) {
      if (this.dead.sec[SIDE(k)]) continue;
      const role = k % 3, ph = f.t + k * 17;
      if (role === 2) {
        // Aimed bursts of seven, leading the pilot when fire control is up.
        this.ciwsYawT[k] = null;
        const p = this.w.player, lead = this.fireControl && p ? 18 : 0;
        this.ciwsAim[k] = this._world(w.aimX + (p ? (p.x - (p.px ?? p.x)) * lead : 0), w.aimY, 0, this.ciwsAim[k] || [0, 0, 0]);
        const cyc = Math.round(64 / r), q = ph % cyc;
        if (q < 21 && q % 3 === 0) this._ciwsShot(k, SPEC.aaAimed, true);
      } else if (role === 0) {
        // Sweeps a 1.3-rad fan through the forward arc, with a breather each pass.
        this.ciwsAim[k] = null;
        const rest = CS.ciwsRest[k], dirn = k < 3 ? -1 : 1;
        this.ciwsYawT[k] = rest + dirn * (0.9 + Math.sin(ph * 0.028) * 0.65);
        if (ph % 90 < 66 && ph % Math.max(3, Math.round(5 / r)) === 0) this._ciwsShot(k, SPEC.aa);
      } else {
        // Lanes: fixed aim points along the bottom edge, stepping each cycle, leaving a corridor.
        const lanes = k < 3 ? [W * 0.12, W * 0.3, W * 0.2] : [W * 0.88, W * 0.7, W * 0.8];
        const li = Math.floor(ph / 80) % 3;
        this.ciwsYawT[k] = null;
        this.ciwsAim[k] = this._world(lanes[li], H - 30, 0, this.ciwsAim[k] || [0, 0, 0]);
        if (ph % 80 < 54 && ph % Math.max(3, Math.round(6 / r)) === 0) this._ciwsShot(k, SPEC.aa);
      }
    }
    if (f.t >= f.T) this._endAA();
  }

  _ciwsShot(k, spec, aimed = false) {
    const m = this.M.cr[k];
    const mz = this._muzzle(m, CS.ciwsMuzzle, this.mzC || (this.mzC = {}));
    const ang = aimed && this.ciwsAim[k] ? Math.atan2(this.w.aimY - mz.y, this.w.aimX - mz.x) * 0.35 + mz.ang * 0.65 : mz.ang;
    P.shoot(this.w, mz.x, mz.y, ang, spec.speed, spec);
    this.ciwsHeat[k] = Math.min(1, this.ciwsHeat[k] + 0.2);
    if (this.t % 2 === 0) this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 4, kind: 'ciws', k: mz.k });
    if (this.t % 5 === 0) sfx.play('ciws', { pan: (mz.x - W / 2) / W });
  }

  _endAA() {
    this.aa = null;
    for (let k = 0; k < 6; k++) { this.ciwsAim[k] = null; this.ciwsYawT[k] = null; }
    this._heavyDone('aa');
  }

  /** Light background fire between the big attacks: one deckhouse gatling bursts at the pilot. */
  aaLight(t, rate = 1) {
    if (this.c.state !== 'fight' || this.aa || this.tw) return;
    const r = rate * this.rate, cyc = Math.round(150 / r), q = t % cyc;
    const k = (Math.floor(t / cyc) & 1) ? 5 : 2;
    if (this.dead.sec[SIDE(k)]) return;
    if (q < 18) { this.ciwsAim[k] = this._world(this.w.aimX, this.w.aimY, 0, this.ciwsAim[k] || [0, 0, 0]); if (q % 3 === 0 && q > 3) this._ciwsShot(k, SPEC.aaAimed, true); }
    else if (q === 18) this.ciwsAim[k] = null;
  }

  /** Secondary twins harass between the big attacks. */
  secLight(t, rate = 1) {
    if (this.c.state !== 'fight' || this.bs || this.tw) return;
    const r = rate * this.rate, cyc = Math.round(200 / r), q = t % cyc, i = (Math.floor(t / cyc) & 1);
    if (this.dead.sec[i]) return;
    if (q < 40) this.secAim[i] = this._world(this.w.aimX, this.w.aimY, 0, this.secAim[i] || [0, 0, 0]);
    if (q === 30 || q === 38) this._secShot(i, SPEC.sec);
    if (q === 40) this.secAim[i] = null;
  }

  // ------------------------------------------ 4. HARBORBREAKER MISSILE SALVO (VLS)

  startMissiles(n = 0) {
    if ((this.dead.vls[0] && this.dead.vls[1]) || !this._canHeavy('missiles')) return false;
    this.heavy = 'missiles';
    this.ms = { phase: 'open', t: 0, k: 0, n: n || (8 + 2 * (this.c.mk - 1)), cells: [0, 0] };
    for (let i = 0; i < 2; i++) if (!this.dead.vls[i]) for (let q = 0; q < 6; q++) this.vdT[i * 12 + VLS_ORDER[q]] = 1;
    this._callout('HARBORBREAKER MISSILE SALVO', 'red');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateMissiles() {
    const f = this.ms;
    if (!f) return;
    if (this.c.state !== 'fight' || (this.dead.vls[0] && this.dead.vls[1])) { this._endMissiles(); return; }
    f.t++;
    if (f.phase === 'open') { if (f.t >= 26) { f.phase = 'fire'; f.t = 0; } }
    else if (f.phase === 'fire') {
      const gap = Math.max(9, Math.round(16 / this.rate));
      if (f.t % gap === 1 && f.k < f.n) {
        let i = f.k & 1;
        if (this.dead.vls[i]) i ^= 1;
        const q = f.cells[i]++ % 12, cell = VLS_ORDER[q];
        this.vdT[i * 12 + cell] = 1;
        if (q + 1 < 12) this.vdT[i * 12 + VLS_ORDER[q + 1]] = 1;   // the next door opens ahead of its launch
        this._pop(i, cell, f.k % 2 === 0);
        f.k++;
      }
      if (f.k >= f.n && f.t > f.n * gap + 20) { f.phase = 'close'; f.t = 0; for (let k = 0; k < 24; k++) this.vdT[k] = 0; }
    } else if (f.phase === 'close') { if (f.t >= 30) this._endMissiles(); }
  }

  /** Cold launch: the missile is pushed up out of its cell, ignites, climbs and pitches over. */
  _pop(i, cell, guided) {
    const c0 = CS.vlsCells[cell], m = this.M.vls[i];
    const q = M4.point(m, c0[0], c0[1], CS.vlsTop + 2, [0, 0, 0]);
    const out = M4.dir(this.M.hull, i ? 1 : -1, 0.25, 0, [0, 0, 0]);
    this.pops.push({ x: q[0], y: q[1], z: q[2], vx: out[0] * 0.25, vy: out[1] * 0.25, vz: 1.2, t: 0, T: 20, i, guided, ox: out[0], oy: out[1] });
    const sq = this.cam.project(q[0], q[1], q[2], this.pr);
    this.flashes.push({ x: sq[0], y: sq[1], ang: -Math.PI / 2, t: 0, life: 10, kind: 'launch', w: q, k: sq[2] });
    if (this.is3D) for (let k = 0; k < 4; k++) this.view.fx._steam(q[0], q[1], q[2] + 2, 0.9);
    sfx.play('vlsLaunch', { pan: (sq[0] - W / 2) / W });
  }

  _updatePops() {
    const w = this.w;
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const m = this.pops[k];
      m.t++;
      m.vz += m.t < 6 ? -0.04 : 0.16;             // the cold-launch pop slows, then the booster lights
      m.x += m.vx; m.y += m.vy; m.z += m.vz;
      m.vx += m.ox * 0.02; m.vy += m.oy * 0.02;   // pitching over, outboard
      if (this.is3D && m.t > 5 && m.t % 2 === 0) this.view.fx._smoke(m.x, m.y, m.z - 6, 0.4, 0.2, 0.3);
      if (m.t < m.T) continue;
      this.pops.splice(k, 1);
      if (this.c.state !== 'fight') continue;
      const q = this.cam.project(m.x, m.y, m.z, this.pr);
      const ref = { ...MSPLIT, _cs: ++this.mid };
      let spec, ang;
      if (m.guided) {
        // Guided: a limited seeker (turn rate + duration) — a late sidestep beats it.
        ang = Math.atan2(w.aimY - q[1], w.aimX - q[0]) + (m.i ? 0.5 : -0.5);
        spec = { shape: 'kunai', color: 'pink', n: 1, speed: 1.2, accel: 0.05, maxSpd: 3.4, homing: 0.022, homingTime: 64, split: ref, splitAt: 140, fixed: true };
        this.reticles.push({ x: w.aimX, y: w.aimY, t: 0, life: 50 });
      } else {
        // Unguided: an outboard dive curving back in on a fixed arc.
        ang = Math.PI / 2 + (m.i ? -0.95 : 0.95);
        spec = { shape: 'kunai', color: 'red', n: 1, speed: 2.2, angVel: m.i ? 0.011 : -0.011, accel: 0.02, maxSpd: 3.2, split: ref, splitAt: 120, fixed: true };
      }
      P.shoot(w, q[0], q[1], ang, spec.speed, spec);
      this.missiles.push({ ref, x: q[0], y: q[1], ang, trail: [], life: 0, alive: true, guided: m.guided });
    }
  }

  /** Follow our missile bullets (by their split spec) for smoke trails; splash where they burst. */
  _trackMissiles() {
    if (!this.missiles.length) return;
    const B = this.w.bullets, live = new Map();
    for (let i = 0; i < B.count; i++) { const r = B.ref[i]; if (r && r._cs) live.set(r, i); }
    for (let k = this.missiles.length - 1; k >= 0; k--) {
      const m = this.missiles[k];
      const i = live.get(m.ref);
      if (i === undefined) {
        if (m.alive) {
          m.alive = false;
          // Detonation at its last point: blast + water column where it came down on the sea.
          if (m.x > -10 && m.x < W + 10 && m.y > -10 && m.y < H + 10) {
            this.w.explosions.blast(m.x, m.y, 0.75, [1, 0.5, 0.3]);
            const q = this._world(m.x, m.y, 0, [0, 0, 0]);
            this._splash(q[0], q[1], 0.7);
          }
        }
        m.trail.shift(); m.trail.shift();
        if (!m.trail.length) this.missiles.splice(k, 1);
        continue;
      }
      m.x = B.x[i]; m.y = B.y[i]; m.ang = B.ang[i]; m.life++;
      if (this.t % 2 === 0) { m.trail.push(m.x, m.y); if (m.trail.length > 40) m.trail.splice(0, 2); }
      if (this.is3D && this.t % 4 === 0) { const q = this._world(m.x, m.y, 40, this.q3); this.view.fx._smoke(q[0], q[1], q[2], 0.22, 0.2, 0.3); }
    }
  }

  _endMissiles() { this.ms = null; for (let k = 0; k < 24; k++) this.vdT[k] = 0; this._heavyDone('missiles'); }

  // ------------------------------------------ 5. DEPTH CHARGE RING (ASW rocket launchers)

  startDepth(big = false) {
    if (!this._canHeavy('depth')) return false;
    this.heavy = 'depth';
    const w = this.w, pts = [[w.aimX, w.aimY]];
    const n = big ? 7 : 5, rad = big ? 110 : 88, a0 = w.rng.angle();
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU; pts.push([w.aimX + Math.cos(a) * rad, w.aimY + Math.sin(a) * rad * 0.85]); }
    const targets = pts.map(([x, y]) => this._world(clamp(x, 28, W - 28), clamp(y, 290, H - 24), 0, [0, 0, 0]));
    this.dc = { phase: 'train', t: 0, k: 0, targets, big };
    for (const tg of targets) this.zones.push({ x: tg[0], y: tg[1], z: 0.6, r: big ? 44 : 36, t: 0, life: 24 + targets.length * 5 + 52, kind: 'depthMark' });
    this._callout(big ? 'DEPTH CHARGE RING — HEAVY' : 'DEPTH CHARGE RING', 'red');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateDepth() {
    const f = this.dc;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endDepth(); return; }
    f.t++;
    const cx = f.targets.reduce((a, q) => a + q[0], 0) / f.targets.length, cy = f.targets.reduce((a, q) => a + q[1], 0) / f.targets.length;
    this.rbuAim[0] = this.rbuAim[1] = [cx, cy, 0];
    this.reT[0] = this.reT[1] = 0.55;
    if (f.phase === 'train') { if (f.t >= 24) { f.phase = 'fire'; f.t = 0; } }
    else if (f.phase === 'fire') {
      if (f.t % 5 === 1 && f.k < f.targets.length) {
        const i = f.k & 1, tube = this.rbuTube[i]++ % 12, tb = CS.rbuTubes[tube], m = this.M.rt[i];
        const q = M4.point(m, tb[0], CS.rbuMuzzle, tb[2], [0, 0, 0]), tg = f.targets[f.k];
        this.shells.push({ x0: q[0], y0: q[1], z0: q[2], x1: tg[0], y1: tg[1], z1: 0, t: 0, T: 46, apex: 120, kind: 'charge', r: f.big ? 44 : 36, big: f.big, trail: [], spin: this.w.fxRng.angle() });
        const sq = this.cam.project(q[0], q[1], q[2], this.pr);
        this.flashes.push({ x: sq[0], y: sq[1], ang: -Math.PI / 2, t: 0, life: 8, kind: 'rocket', w: q, k: sq[2] });
        if (this.is3D) this.view.fx._smoke(q[0], q[1], q[2], 0.5, 0.35, 0.6);
        sfx.play('rocketLaunch', { pan: (sq[0] - W / 2) / W });
        f.k++;
      }
      if (f.k >= f.targets.length && f.t > f.targets.length * 5 + 20) this._endDepth();
    }
  }

  _endDepth() { this.dc = null; this.rbuAim[0] = this.rbuAim[1] = null; this.reT[0] = this.reT[1] = 0.25; this._heavyDone('depth'); }

  /** Charges that have hit the water sink, then detonate under the surface. */
  _updateSinkers() {
    const w = this.w, R = w.fxRng;
    for (let k = this.sinkers.length - 1; k >= 0; k--) {
      const s = this.sinkers[k];
      s.t++;
      if (this.is3D && s.t % 3 === 0) {
        const i = this.view.fx.p.spawn(this.view.fx.F.ring, s.x + R.range(-6, 6), s.y + R.range(-6, 6), 0.6, 0, 0, 0, 30);
        if (i >= 0) { const P2 = this.view.fx.p; P2.s0[i] = 2; P2.s1[i] = 9; P2.r[i] = P2.g[i] = P2.b[i] = 0.9; P2.a[i] = 0.5; }
      }
      if (s.t < s.T) continue;
      this.sinkers.splice(k, 1);
      const q = this.cam.project(s.x, s.y, 0, this.pr), x = q[0], y = q[1], rs = s.r * q[2];
      // Underwater detonation: the sea domes, bursts into a column and throws a ring.
      this._splash(s.x, s.y, s.big ? 2.0 : 1.5, true);
      this._ring(s.x, s.y, 8, s.big ? 3.4 : 2.8, 1.0, 70);
      if (this.is3D) this.view.fx.decal('foam', s.x, s.y, 0.7, s.r * 3, R.angle(), 240);
      w.g.camera.addTrauma(s.big ? 0.22 : 0.16);
      w.g.renderer.post.shockwave(x, y, 0.02, 0.02, 0.35);
      const p = w.player;
      if (this.c.state === 'fight') {
        if (p && p.collidable && !p.invulnerable && Math.hypot(p.x - x, p.y - y) < rs + p.hitR) p.hit();
        P.ring(w, x, y, SPEC.depthRing, w.rng.angle());
        if (s.big) w.explosions.schedule(10, () => { if (this.c.state === 'fight') P.ring(w, x, y, SPEC.depthRing2, w.rng.angle()); });
      }
      sfx.play('depthCharge', { pan: (x - W / 2) / W });
    }
  }

  // ------------------------------------------ 6. TIDAL WAKE BARRAGE

  startTidal() {
    if (!this._canHeavy('tidal')) return false;
    this.heavy = 'tidal';
    this.tw = { phase: 'surge', t: 0, dir: this.lane > 8 ? -1 : this.lane < -8 ? 1 : this.w.rng.sign(), swing: 0, vT: (this._phaseMove().speed ?? CRUISE) * 2.4, row: 24 };
    this._callout('TIDAL WAKE BARRAGE', 'red');
    sfx.play('shipHorn', { pan: 0 });
    return true;
  }

  /** Flank speed and an S-turn; the side batteries fire abeam as the hull swings, so the fans sweep. */
  _updateTidal() {
    const f = this.tw;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endTidal(); return; }
    f.t++;
    this.wake.boost = f.phase === 'settle' ? Math.max(0, this.wake.boost - 0.01) : Math.min(0.9, this.wake.boost + 0.02);
    if (f.phase === 'surge') {
      this.lane = f.dir * SHIP_ROOM;
      if (f.t >= 50) { f.phase = 'swing'; f.t = 0; }
    } else if (f.phase === 'swing') {
      if (f.t === 1) this.lane = (f.swing & 1 ? 1 : -1) * f.dir * -SHIP_ROOM;
      // Batteries trained abeam (outboard of the turn), firing every few steps.
      const gap = Math.max(7, Math.round(11 / this.rate));
      for (const i of [0, 1]) {
        if (!this.dead.sec[i]) { this.secYawT[i] = i ? -1.45 : 1.45; if (f.t % gap === 0) this._secShot(i, SPEC.tidal); }
        if (!this.dead.main[1 + i]) { this.mainYawT[1 + i] = i ? -1.2 : 1.2; if (f.t % (gap * 3) === 2) { const j = (f.t / gap) % 3 | 0, m = this.M.mb[(1 + i) * 3 + j], mz = this._muzzle(m, CS.mainMuzzle, this.mzT || (this.mzT = {})); P.fan(this.w, mz.x, mz.y, mz.ang, SPEC.broad); this._gunFx(1 + i, j, mz, 0.7); } }
      }
      for (let k = 0; k < 6; k++) if (!this.dead.sec[SIDE(k)] && k % 3 === 0) { this.ciwsYawT[k] = CS.ciwsRest[k] + (k < 3 ? 0.6 : -0.6); if (f.t % 6 === 0) this._ciwsShot(k, SPEC.aa); }
      if (f.t >= 130) { f.swing++; f.t = 0; if (f.swing >= 2) { f.phase = 'settle'; f.vT = this._phaseMove().speed ?? CRUISE; f.row = 0; } }
    } else if (f.phase === 'settle') {
      this.secYawT[0] = this.secYawT[1] = null; this.mainYawT[1] = this.mainYawT[2] = null;
      for (let k = 0; k < 6; k++) this.ciwsYawT[k] = null;
      if (f.t >= 70) this._endTidal();
    }
  }

  _endTidal() {
    this.tw = null; this.wake.boost = 0;
    this.secYawT[0] = this.secYawT[1] = null; this.mainYawT[1] = this.mainYawT[2] = null;
    for (let k = 0; k < 6; k++) this.ciwsYawT[k] = null;
    this._heavyDone('tidal');
  }

  // ------------------------------------------ 7. COASTAL BOMBARDMENT

  /** Shell the shore installations in view (lagoonMap), then walk impacts into the corridor. */
  startCoastal() {
    if ((this.dead.main[0] && this.dead.main[1] && this.dead.main[2]) || !this.view) return false;
    const cam = this.cam, fp = cam.footprint(0, -40);
    const cand = installationsIn(fp.y0 + 60, fp.y1 - 20).filter((it) => !this.destroyed.has(it.id) && Math.abs(it.x - cam.x) < 330);
    if (!cand.length) return false;
    if (!this._canHeavy('coastal')) return false;
    this.heavy = 'coastal';
    cand.sort((a, b) => Math.abs(a.y - (cam.y + 100)) - Math.abs(b.y - (cam.y + 100)));
    const targets = cand.slice(0, 3).map((it) => ({ ...it, z: this.view.S && this.view.S.height ? this.view.S.height(it.x, it.y) : 4, shots: 0 }));
    this.cb = { phase: 'train', t: 0, targets, k: 0, walk: null };
    for (const tg of targets) this.zones.push({ x: tg.x, y: tg.y, z: tg.z + 1, r: tg.r + 14, t: 0, life: 200, kind: 'coast' });
    this._callout('COASTAL BOMBARDMENT', 'gold');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateCoastal() {
    const f = this.cb, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endCoastal(); return; }
    f.t++;
    // Each target is engaged by A and the wing turret on its side.
    const turretFor = (tg, n) => { const pref = n % 2 === 0 ? 0 : tg.side < 0 ? 1 : 2; return this.dead.main[pref] ? [0, 1, 2].find((i) => !this.dead.main[i]) : pref; };
    const tg = f.targets[Math.min(f.k, f.targets.length - 1)];
    for (const i of [0, 1, 2]) { this.mainAim[i] = [tg.x, tg.y, 0]; this.meT[i] = 0.5; }
    if (f.phase === 'train') { if (f.t >= 40) { f.phase = 'fire'; f.t = 0; } }
    else if (f.phase === 'fire') {
      const gap = Math.max(10, Math.round(18 / this.rate));
      if (f.t % gap === 1 && f.k < f.targets.length) {
        const i = turretFor(tg, tg.shots);
        if (i !== undefined) this._mainShot(i, tg.shots % 3, null, { coastal: tg, last: tg.shots === 1 });
        tg.shots++;
        if (tg.shots >= 2) f.k++;
      }
      if (f.k >= f.targets.length && f.t > 40) {
        // Walk a line of impacts from the shore toward the pilot's corridor.
        const last = f.targets[0], p0 = this.cam.project(last.x, last.y, 0, this.pr).slice(), N = 4;
        f.walk = [];
        for (let k = 1; k <= N; k++) {
          const u = k / (N + 1), sx = lerp(p0[0], w.aimX, u), sy = lerp(clamp(p0[1], 300, H - 40), w.aimY, u * 0.8);
          f.walk.push(this._world(clamp(sx, 30, W - 30), clamp(sy, 300, H - 30), 0, [0, 0, 0]));
        }
        for (const q of f.walk) this.zones.push({ x: q[0], y: q[1], z: 0.6, r: 34, t: 0, life: 30 + 52 + N * 10, kind: 'shell' });
        f.phase = 'walk'; f.t = 0; f.k = 0;
      }
    } else if (f.phase === 'walk') {
      if (f.t % 10 === 1 && f.k < f.walk.length) {
        const i = [0, 1, 2].find((n) => !this.dead.main[n]);
        if (i !== undefined) this._mainShot(i, f.k % 3, f.walk[f.k], { ring: SPEC.walkRing, r: 34 });
        f.k++;
      }
      if (f.k >= f.walk.length && f.t > 90) this._endCoastal();
    }
  }

  _endCoastal() {
    if (this.cb) for (const i of [0, 1, 2]) { this.mainAim[i] = null; this.meT[i] = 0.05; }
    this.cb = null; this._heavyDone('coastal');
  }

  /** A shell lands on a shore installation: it burns from then on, debris flies into the corridor. */
  _coastImpact(sh) {
    const w = this.w, tg = sh.target, R = w.fxRng;
    const q = this.cam.project(sh.x1, sh.y1, sh.z1, this.pr), x = q[0], y = q[1];
    w.explosions.blast(x, y, sh.last ? 2.0 : 1.4, [1, 0.5, 0.2]);
    w.explosions.sparks(x, y, 24, [1, 0.7, 0.4], 6, 30, 4);
    w.g.camera.addTrauma(0.18);
    w.g.renderer.post.shockwave(x, y, 0.02, 0.02, 0.35);
    if (this.is3D) {
      const fx = this.view.fx;
      fx.decal('scorch', sh.x1, sh.y1, sh.z1 + 0.5, tg.r * 3, R.angle(), 30000);
      fx.decal('crater', sh.x1 + R.range(-8, 8), sh.y1 + R.range(-8, 8), sh.z1 + 0.6, tg.r * 1.1, R.angle(), 30000);
      fx.dust(sh.x1, sh.y1, sh.z1, 1.6, this.view.dustCol, 8);
      for (let k = 0; k < 5; k++) fx._spark(sh.x1, sh.y1, sh.z1 + 6, 6);
    }
    for (let k = 0; k < 6; k++) this.debris.push({ mesh: 'cs.chunk', x: sh.x1 + R.range(-8, 8), y: sh.y1 + R.range(-8, 8), z: sh.z1 + 6, sx: R.range(3, 6), sy: R.range(3, 6), sz: R.range(2, 4), vx: R.range(-2.5, 2.5), vy: R.range(-2.5, 2.5), vz: R.range(2, 4.5), wx: R.range(-0.3, 0.3), wy: R.range(-0.3, 0.3), wz: R.range(-0.3, 0.3), ax: 0, ay: 0, az: 0, life: 0, water: true });
    if (sh.last && !this.destroyed.has(tg.id)) {
      this.destroyed.add(tg.id);
      const big = tg.kind === 'tank' || tg.kind === 'depot';
      if (this.is3D) this.view.fx.addFire(tg.x, tg.y, tg.z + (tg.kind === 'tank' ? 20 : 8), big ? 2.2 : 1.4, 60 * 120);
      this.burning.push({ x: tg.x, y: tg.y, z: tg.z + 24, s: big ? 2.4 : 1.5, t: 0 });
      if (tg.kind === 'tank') w.explosions.schedule(14, () => { const q2 = this.cam.project(tg.x, tg.y, tg.z + 20, this.pr); w.explosions.blast(q2[0], q2[1], 2.6, [1, 0.55, 0.2]); w.g.camera.addTrauma(0.3); });
      sfx.play('explode2', { pan: (x - W / 2) / W });
    }
    // Secondary hazard: burning debris thrown toward the combat corridor.
    if (this.c.state === 'fight' && y > -20 && y < H) P.fan(w, clamp(x, 6, W - 6), clamp(y, 4, H - 4), Math.atan2(w.aimY - y, w.aimX - x), SPEC.debris);
    sfx.play('shellImpact', { pan: (x - W / 2) / W });
  }

  // ------------------------------------------ 8. MONSOON SCREEN

  startMonsoon() {
    if (this.monsoon) return;
    this.monsoon = true; this.stormT = 1; this.boltT = 90;
    this._callout('MONSOON SCREEN', 'gold');
    sfx.play('thunder', { pan: 0 });
  }

  /** The squall: rain, heavier swell and foam, wind spray, lightning; ship and wake work harder. */
  _updateStorm() {
    this.storm += clamp(this.stormT - this.storm, -0.004, 0.004);
    if (this.storm <= 0.01) return;
    const w = this.w, R = w.fxRng;
    if (--this.boltT <= 0) {
      this.boltT = R.int(150, 300);
      this.bolt = { t: 0, x: R.range(40, W - 40), seed: R.next() };
      w.g.renderer.post.flash(0.75, 0.8, 1, 0.16 + 0.1 * this.storm, 0.05);
      w.explosions.schedule(R.int(10, 30), () => sfx.play('thunder', { pan: R.range(-0.6, 0.6) }));
    }
    if (this.bolt && ++this.bolt.t > 14) this.bolt = null;
  }

  /** Storm-driven fire (monsoon phase): wind-bent gatling streams, drifting orbs under the lightning. */
  stormFire(t) {
    if (this.c.state !== 'fight' || this.aa || this.tw || this.storm < 0.4) return;
    const r = this.rate, cyc = Math.round(210 / r), q = t % cyc;
    if (q < 60) {
      for (const k of [0, 3]) if (!this.dead.sec[SIDE(k)] && q % Math.max(4, Math.round(6 / r)) === 0) {
        this.ciwsYawT[k] = CS.ciwsRest[k] + (k ? -1 : 1) * (0.5 + q * 0.012);
        this._ciwsShot(k, k ? SPEC.stormB : SPEC.storm);
      }
    } else if (q === 60) { this.ciwsYawT[0] = this.ciwsYawT[3] = null; }
    if (q === 90) for (const i of [0, 1]) if (!this.dead.sec[i]) this._secShot(i, SPEC.stormOrb);
  }

  // ------------------------------------------ 9 / 10. DREADNOUGHT OVERDRIVE · SCORCHED REEF

  _phaseFrac() {
    const c = this.c;
    if (!c.floors || !c.phase) return 1;
    return (c.e.hp - c.floors[c.index]) / Math.max(1, c.phase.hp);
  }

  /** The last phase escalates: overdrive below `overdriveAt`, Scorched Reef below `criticalAt` (the desperation phase starts there). */
  _stageCheck() {
    const c = this.c, ph = c.phase;
    if (c.state !== 'fight' || !ph) return;
    if (ph.desperation && !this.critical) { this._goOverdrive(true); this._goCritical(true); return; }
    if (!ph.final) return;
    const fr = this._phaseFrac();
    if (!this.overdrive && fr <= (ph.overdriveAt ?? 0.62)) this._goOverdrive();
    if (!this.critical && fr <= (ph.criticalAt ?? 0.3)) this._goCritical();
  }

  _goOverdrive(quiet = false) {
    if (this.overdrive) return;
    this.overdrive = true;
    this.wake.boost = 0.5;
    const c = this.c;
    if (!quiet && c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'DREADNOUGHT OVERDRIVE', desperation: true, boss: c.name });
    this._callout('FLANK SPEED', 'red');
    this.w.g.camera.addTrauma(0.3);
    sfx.play('shipHorn', { pan: 0 });
    sfx.play('executionAlarm', { pan: 0 });
  }

  _goCritical(quiet = false) {
    if (this.critical) return;
    this.critical = true; this.odT = 0;
    const c = this.c;
    if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'SCORCHED REEF', desperation: true, boss: c.name });
    if (!quiet) this.w.g.renderer.post.flash(1, 0.4, 0.2, 0.25, 0.04);
    this.w.g.camera.addTrauma(0.35);
    // The deck catches fire along its length.
    for (const [lx, ly] of [[-30, 120], [40, 60], [-90, 10], [100, -30], [0, -140], [-20, 200]]) this.deckFires.push({ lx, ly, s: this.w.fxRng.range(0.8, 1.3) });
  }

  /** Overdrive: faster, coordinated sequences while it manoeuvres (not used once critical). */
  overdriveTick(t) {
    if (!this.overdrive || this.critical || this.c.state !== 'fight') return;
    this.odT++;
    const T = this.odT % 640;
    if (T === 20) this.startSalvo('direct');
    else if (T === 170) this.startBroadside(4);
    else if (T === 330) this.startMissiles(6);
    else if (T === 470) this.startTidal();
    this.aaLight(t, 1.4);
  }

  /** Scorched Reef: rolling windows of every surviving system; the damaged batteries fire hardest. */
  scorched(t) {
    if (!this.critical || this.c.state !== 'fight') return;
    this.odT++;
    const T = this.odT % 860;
    if (T === 10) this.startSalvo('direct');
    else if (T === 140) this.startMissiles(8);
    else if (T === 280) this.startBroadside(5);
    else if (T === 410) this.startDepth(true);
    else if (T === 540) this.startTidal();
    else if (T === 700) { if (!this.startCoastal()) this.startSalvo('plunge'); }
    this.aaLight(t, 1.3);
    if (this.storm > 0.4) this.stormFire(t);
  }

  // --------------------------------------------------------- shells / rounds

  /** Real rounds on 3D arcs: plunging shells, coastal shells, depth bombs. */
  _updateShells() {
    const w = this.w, R = w.fxRng;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const sh = this.shells[k];
      sh.t++;
      const u = sh.t / sh.T;
      sh.px = sh.x; sh.py = sh.y; sh.pz = sh.z;
      sh.x = lerp(sh.x0, sh.x1, u); sh.y = lerp(sh.y0, sh.y1, u); sh.z = lerp(sh.z0, sh.z1, u) + 4 * sh.apex * u * (1 - u);
      if (sh.t % 2 === 0) { sh.trail.push(sh.x, sh.y, sh.z); if (sh.trail.length > 30) sh.trail.splice(0, 3); }
      if (sh.t < sh.T) continue;
      this.shells.splice(k, 1);
      if (sh.kind === 'coastal') { this._coastImpact(sh); continue; }
      if (sh.kind === 'charge') {
        // Splashes in, then sinks to its depth (detonation delay).
        this._splash(sh.x1, sh.y1, 0.45);
        this._ring(sh.x1, sh.y1, 3, 1.4, 0.35, 30);
        this.sinkers.push({ x: sh.x1, y: sh.y1, t: 0, T: 36 + R.int(0, 14), r: sh.r, big: sh.big });
        for (const z of this.zones) if (z.kind === 'depthMark' && Math.hypot(z.x - sh.x1, z.y - sh.y1) < 4) { z.kind = 'depth'; z.t = 0; z.life = 50; }
        sfx.play('chargeSplash', { pan: 0 });
        continue;
      }
      // Plunging shell into the sea: a tall water column, a ring wave, a burst of orbs.
      const q = this.cam.project(sh.x1, sh.y1, 0, this.pr), x = q[0], y = q[1], rs = sh.r * q[2];
      this._splash(sh.x1, sh.y1, 1.35, true);
      this._ring(sh.x1, sh.y1, 6, 2.6, 0.9, 60);
      w.explosions.blast(x, y, 0.8, [1, 0.6, 0.35]);
      w.g.camera.addTrauma(0.14);
      w.g.renderer.post.shockwave(x, y, 0.014, 0.02, 0.3);
      if (this.is3D) this.view.fx.decal('foam', sh.x1, sh.y1, 0.7, sh.r * 2.4, R.angle(), 200);
      const p = w.player;
      if (this.c.state === 'fight') {
        if (p && p.collidable && !p.invulnerable && Math.hypot(p.x - x, p.y - y) < rs + p.hitR) p.hit();
        P.ring(w, x, y, sh.ringSpec || SPEC.plungeRing, w.rng.angle());
      }
      sfx.play('waterSplash', { pan: (x - W / 2) / W });
    }
  }

  // ------------------------------------------------------------- water

  /** Disturbance ring on the water (shader): start radius, growth per step, strength, life. */
  _ring(x, y, r, vr, s, life) {
    this.rings.push({ x, y, r, vr, s, s0: s, t: 0, life });
    if (this.rings.length > 12) this.rings.shift();
  }

  _updateRings() {
    for (let k = this.rings.length - 1; k >= 0; k--) {
      const g = this.rings[k];
      g.t++; g.r += g.vr; g.vr *= 0.985; g.s = g.s0 * (1 - g.t / g.life);
      if (g.t >= g.life) this.rings.splice(k, 1);
    }
  }

  /** Write the ship and the rings into the water surface; step the wake history. */
  _water() {
    const s = this.s, S = this.surf;
    const M = this.M.world;
    const bow = M4.point(M, 0, CS.length[1] - 4, 0, [0, 0, 0]), stern = M4.point(M, 0, CS.length[0] + 6, 0, [0, 0, 0]);
    const shL = M4.point(M, -132, 104, 0, [0, 0, 0]), shR = M4.point(M, 132, 104, 0, [0, 0, 0]);
    const v = this.wreck ? 0 : this.v * (1 + this.storm * 0.4);
    this.wake.step({ bow, stern, shoulders: [shL, shR], h: s.h, v });
    if (!S) return;
    const sink = Math.min(1, s.sink / 40);
    const a = S.ship.a, b = S.ship.b, c = S.ship.c;
    a[0] = s.x; a[1] = s.y; a[2] = Math.cos(s.h); a[3] = Math.sin(s.h);
    b[0] = CS.length[1] - 2; b[1] = CS.beam; b[2] = this.v * (1 + this.wake.boost * 0.6); b[3] = this.wreck && sink >= 1 ? 0 : 1;
    c[0] = CS.sponson.y0; c[1] = CS.sponson.y1; c[2] = CS.sponsonW; c[3] = 0;
    const R = S.rings;
    R.fill(0);
    let n = 0;
    for (let k = this.rings.length - 1; k >= 0 && n < 6; k--, n++) { const g = this.rings[k]; R[n * 4] = g.x; R[n * 4 + 1] = g.y; R[n * 4 + 2] = g.r; R[n * 4 + 3] = Math.max(0, g.s); }
    // The squall: the sea and its foam build with the storm; the sky darkens.
    if (this.base) {
      const k = this.storm, bw = this.base.wave, bf = this.base.foam;
      S.wave = [bw[0] + (1.5 - bw[0]) * k, bw[1] + (0.85 - bw[1]) * k, bw[2] + (1.4 - bw[2]) * k, bw[3] + (1.5 - bw[3]) * k];
      S.foam = [bf[0] + (0.7 - bf[0]) * k, bf[1] + (0.55 - bf[1]) * k, bf[2] + (0.9 - bf[2]) * k, 0];
      const fl = this.bolt ? 1 - this.bolt.t / 14 : 0;
      S.sky = this.base.sky.map((v2) => v2 * (1 - 0.45 * k) + 0.6 * fl);
    }
  }

  // ---------------------------------------------------------- lifecycle

  _endAttacks() {
    this.sv = null; this.bs = null; this.aa = null; this.ms = null; this.dc = null; this.tw = null; this.cb = null;
    this.heavy = null; this.queue = null;
    for (let i = 0; i < 3; i++) { this.mainAim[i] = null; this.mainYawT[i] = null; this.meT[i] = 0.05; }
    for (let i = 0; i < 2; i++) { this.secAim[i] = null; this.secYawT[i] = null; this.rbuAim[i] = null; this.reT[i] = 0.25; }
    for (let k = 0; k < 6; k++) { this.ciwsAim[k] = null; this.ciwsYawT[k] = null; }
    for (let k = 0; k < 24; k++) this.vdT[k] = 0;
    this.wake.boost = this.overdrive ? 0.5 : 0;
    this.lines.length = 0;
    for (const z of this.zones) if (z.kind === 'coast' || z.kind === 'depthMark') z.life = z.t;
  }

  /** Defeat: weapons fail one by one, the bridge collapses, the magazines go, it lists and sinks. */
  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng;
    if (this.deathT < 0) {
      this.deathT = 0; this._endAttacks();
      this.spinDir = w.rng.sign();
      this.listDir = this.dead.main[1] || this.dead.sec[0] ? -1 : 1;
      this.stormT = Math.min(this.stormT, 0.5);
      // Every surviving system fails in turn.
      this.failQ = [];
      for (let i = 0; i < 3; i++) if (!this.dead.main[i]) this.failQ.push(['main', i]);
      for (let i = 0; i < 2; i++) { if (!this.dead.sec[i]) this.failQ.push(['sec', i]); if (!this.dead.vls[i]) this.failQ.push(['vls', i]); }
      this.failQ.sort(() => R.next() - 0.5);
      if (!this.dead.bridge[0]) this.failQ.splice(Math.min(3, this.failQ.length), 0, ['bridge', 0]);
      sfx.play('engineFail', { pan: 0 });
      sfx.play('shipHorn', { pan: 0, v: 0.6 });
    }
    this.deathT++;
    this.rowT = HOME_ROW;
    const every = Math.max(8, Math.floor(100 / Math.max(1, this.failQ.length)));
    if (st % every === 4 && this.failQ.length) {
      const [kind, i] = this.failQ.shift();
      this.partDestroyed(kind, i);
    }
    // Deck fires spread along the hull.
    if (st % 10 === 0 && st < 110) this.deckFires.push({ lx: R.range(-50, 50), ly: R.range(-200, 220), s: R.range(0.8, 1.4) });
    if (st % 7 === 0 && st < 110) {
      const q = this._scr(this.M.hull, R.range(-60, 60), R.range(-200, 220), CS.deckZ + 4);
      w.explosions.blast(q[0], q[1], R.range(0.6, 1.1), [1, 0.5, 0.25]);
    }
    if (st === 112) {
      // The magazines: one enormous blast amidships, a dome of sea, armour thrown everywhere.
      const q = this._scr(this.M.hull, 0, 40, 30);
      w.explosions.blast(q[0], q[1], 3.4, [1, 0.5, 0.2]);
      w.explosions.schedule(5, () => w.explosions.blast(q[0] + R.range(-40, 40), q[1] + R.range(-30, 30), 2.2, [1, 0.6, 0.3]));
      w.explosions.schedule(11, () => w.explosions.blast(q[0] + R.range(-60, 60), q[1] + R.range(-40, 40), 1.8, [1, 0.4, 0.2]));
      w.g.camera.addTrauma(0.95);
      for (const [lx, ly] of [[0, 120], [-100, 40], [100, 40], [0, -60], [0, -200]]) { const p = M4.point(this.M.world, lx, ly, 0, [0, 0, 0]); this._splash(p[0], p[1], 2.2, true); }
      const mid = M4.point(this.M.world, 0, 0, 0, [0, 0, 0]);
      this._ring(mid[0], mid[1], 60, 4, 1.2, 140);
      this._ring(mid[0], mid[1], 20, 2.6, 0.9, 120);
      this._plates(M4.point(this.M.hull, 0, 40, 30, [0, 0, 0]), 22);
      this._shards(q[0], q[1], 24);
      if (this.is3D) {
        const fx = this.view.fx;
        fx.decal('foam', mid[0], mid[1], 0.7, 520, R.angle(), 1600);
        for (const [lx, ly, sc] of [[0, 160, 1.6], [-40, 40, 1.8], [50, -40, 1.5], [0, -120, 1.4], [-90, 20, 1.1], [90, 20, 1.1]]) { const p = M4.point(this.M.hull, lx, ly, 30, [0, 0, 0]); fx.addFire(p[0], p[1], 6, sc, 4200); }
      }
      sfx.play('bossDeath', { pan: 0 });
    }
    if (st > 112) this.wreck = true;
    if (st === 150 && this.view && this.ctrlCam) { this.view.speedTarget = this.view.baseSpeed; this.ctrlCam = false; this.released = true; }
  }

  // ---------------------------------------------------------- world fx

  _shards(x, y, n, col = [0.48, 0.54, 0.6]) {
    const w = this.w, shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < n; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(45, 75));
      if (j < 0) continue;
      L.size(j, R.range(6, 12)); L.color(j, col[0], col[1], col[2], col[0] * 0.4, col[1] * 0.4, col[2] * 0.4); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
  }

  /** Armour plates blown off a mount: real 3D pieces that tumble and splash into the sea. */
  _plates(q, n) {
    const R = this.w.fxRng;
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(1.2, 3.4);
      this.debris.push({ mesh: R.chance(0.5) ? 'cs.plate' : 'cs.chunk', x: q[0], y: q[1], z: q[2] + 4, sx: R.range(4, 9), sy: R.range(4, 9), sz: R.range(3, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(2.5, 5.5), wx: R.range(-0.25, 0.25), wy: R.range(-0.25, 0.25), wz: R.range(-0.25, 0.25), ax: 0, ay: 0, az: 0, life: 0, water: true });
    }
  }

  /** Loose 3D debris: tumbles, and either lands on the deck plane or splashes into the sea and sinks. */
  _updateDebris() {
    const cy = this.cam.cy || 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      if (Math.abs(p.y - cy) > 1400 || p.life > 400) { this.debris.splice(i, 1); continue; }
      p.life++;
      p.vz -= 0.16; p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.ax += p.wx; p.ay += p.wy; p.az += p.wz;
      if (p.z <= 0 && !p.sunk) {
        p.sunk = true; p.vx *= 0.2; p.vy *= 0.2; p.vz = -0.25; p.wx *= 0.2; p.wy *= 0.2; p.wz *= 0.2;
        this._splash(p.x, p.y, 0.35);
      }
      if (p.sunk && p.z < -20) this.debris.splice(i, 1);
    }
  }

  /**
   * Water thrown up at world (x, y): a column of white water rising and
   * falling back, droplets flung outward, mist drifting on the wind.
   * col = a tall shell / charge column (otherwise a low splash).
   */
  _splash(x, y, s = 1, col = false) {
    if (!this.is3D) return;
    const fx = this.view.fx, P2 = fx.p, F = fx.F, R = this.w.fxRng;
    const nCol = col ? Math.round(10 * s) : Math.round(4 * s);
    for (let k = 0; k < nCol; k++) {
      const i = P2.spawn(R.pick(F.smoke), x + R.range(-6, 6) * s, y + R.range(-6, 6) * s, 1, R.range(-0.3, 0.3) * s, R.range(-0.3, 0.3) * s, (col ? R.range(3.2, 6.5) : R.range(1.5, 3)) * Math.sqrt(s), R.range(50, 80));
      if (i < 0) break;
      P2.s0[i] = 10 * s; P2.s1[i] = (col ? 46 : 30) * s; P2.r[i] = 0.92; P2.g[i] = 0.96; P2.b[i] = 1; P2.r1[i] = 0.8; P2.g1[i] = 0.86; P2.b1[i] = 0.9;
      P2.a[i] = 0.75; P2.grav[i] = -0.11; P2.drag[i] = 0.985; P2.fade[i] = 1; P2.rot[i] = R.angle();
    }
    for (let k = 0; k < Math.round(16 * s); k++) {
      const a = R.angle(), sp = R.range(0.6, 2.2) * s;
      const i = P2.spawn(F.flake, x, y, 2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(2, 5) * s, R.range(30, 55));
      if (i < 0) break;
      P2.s0[i] = 5 * s; P2.s1[i] = 2.5 * s; P2.r[i] = P2.g[i] = P2.b[i] = 0.97; P2.r1[i] = 0.82; P2.g1[i] = 0.9; P2.b1[i] = 1; P2.grav[i] = -0.12; P2.a[i] = 0.85;
    }
    const i = P2.spawn(F.foam, x, y, 0.8, 0, 0, 0, 70);
    if (i >= 0) { P2.s0[i] = 14 * s; P2.s1[i] = 60 * s; P2.r[i] = P2.g[i] = P2.b[i] = 0.95; P2.r1[i] = 0.8; P2.g1[i] = 0.9; P2.b1[i] = 0.95; P2.a[i] = 0.6; P2.rot[i] = R.angle(); P2.drag[i] = 1; }
  }

  /** Light spray (muzzle blast on the water, bow, sides). */
  _sprayAt(x, y, s = 0.5, vx = 0, vy = 0) {
    if (!this.is3D) return;
    const fx = this.view.fx, P2 = fx.p, F = fx.F, R = this.w.fxRng;
    for (let k = 0; k < 3; k++) {
      const i = P2.spawn(F.flake, x + R.range(-4, 4), y + R.range(-4, 4), 1.5, vx + R.range(-0.8, 0.8) * s, vy + R.range(-0.8, 0.8) * s, R.range(1, 2.6) * s, R.range(22, 40));
      if (i < 0) return;
      P2.s0[i] = 4 * s + 1; P2.s1[i] = 2; P2.r[i] = P2.g[i] = P2.b[i] = 0.95; P2.r1[i] = 0.8; P2.g1[i] = 0.9; P2.b1[i] = 1; P2.grav[i] = -0.1; P2.a[i] = 0.75;
    }
    const i = P2.spawn(R.pick(F.smoke), x, y, 2, vx * 0.5 + R.range(-0.2, 0.2), vy * 0.5 + R.range(-0.2, 0.2), R.range(0.2, 0.6), R.range(40, 70));
    if (i >= 0) { P2.s0[i] = 8 * s + 4; P2.s1[i] = 30 * s + 10; P2.r[i] = P2.g[i] = P2.b[i] = 0.92; P2.r1[i] = 0.85; P2.g1[i] = 0.9; P2.b1[i] = 0.95; P2.a[i] = 0.35; P2.fade[i] = 1; P2.drag[i] = 0.97; P2.rot[i] = R.angle(); }
  }

  /** Bow spray, side spray in turns, propeller churn, funnel smoke, damage smoke / fire / sparks. */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, s = this.s, M = this.M, c = this.c;
    const fw = [Math.sin(s.h), Math.cos(s.h)], rt = [Math.cos(s.h), -Math.sin(s.h)];
    const sp = this.wreck ? 0 : this.v * (1 + this.wake.boost);
    // Bow: white water thrown off the stem and the sponson shoulders, more at speed.
    if (sp > 0.25 && R.chance(Math.min(0.95, sp * 0.45 + this.storm * 0.3))) {
      const b = M4.point(M.world, R.range(-4, 4), CS.length[1] - 6, 0, [0, 0, 0]), side = R.sign();
      this._sprayAt(b[0] + rt[0] * side * 6, b[1] + rt[1] * side * 6, 0.45 + sp * 0.25, fw[0] * sp * 0.9 + rt[0] * side * sp * 0.6, fw[1] * sp * 0.9 + rt[1] * side * sp * 0.6);
    }
    if (sp > 0.5 && R.chance(sp * 0.25)) {
      const side = R.sign(), q = M4.point(M.world, side * 134, 104, 0, [0, 0, 0]);
      this._sprayAt(q[0], q[1], 0.4 + sp * 0.15, fw[0] * sp * 0.5 + rt[0] * side * sp * 0.5, fw[1] * sp * 0.5 + rt[1] * side * sp * 0.5);
    }
    // Turning: spray thrown along the outside of the turn.
    if (Math.abs(this.dth) > 0.0012 && R.chance(Math.min(0.8, Math.abs(this.dth) * 260))) {
      const side = -sgn(this.dth), q = M4.point(M.world, side * (R.chance(0.5) ? 150 : 66), R.range(-200, 60), 0, [0, 0, 0]);
      this._sprayAt(q[0], q[1], 0.5, rt[0] * side * 1.2, rt[1] * side * 1.2);
    }
    // Propeller churn behind the stern.
    if (sp > 0.2 && R.chance(0.4 + sp * 0.2)) {
      const q = M4.point(M.world, R.range(-30, 30), CS.length[0] - 8, 0, [0, 0, 0]);
      const i = fx.p.spawn(fx.F.foam, q[0], q[1], 0.8, -fw[0] * 0.3 + R.range(-0.2, 0.2), -fw[1] * 0.3 + R.range(-0.2, 0.2), 0, R.range(60, 100));
      if (i >= 0) { const P2 = fx.p; P2.s0[i] = 14; P2.s1[i] = 46 + sp * 20; P2.r[i] = P2.g[i] = P2.b[i] = 0.95; P2.r1[i] = 0.75; P2.g1[i] = 0.86; P2.b1[i] = 0.9; P2.a[i] = 0.4; P2.rot[i] = R.angle(); P2.vr[i] = R.range(-0.01, 0.01); P2.drag[i] = 0.99; }
    }
    // Funnels: grey haze at cruise, heavy black smoke in the overdrive / when damaged.
    const frac = c.e.hp / Math.max(1, this._hp0()), hard = this.overdrive || this.tw ? 1 : 0;
    if (!this.wreck && this.t % (hard ? 2 : 4) === 0) {
      for (const st of CS.stacks) { const q = M4.point(M.hull, st[0], st[1] - 8, st[2] + 2, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.6 + hard * 0.5, 0.35 + hard * 0.45 + (1 - frac) * 0.3, 1); }
    }
    // Damage: smoke below 60 %, fires and sparks below 35 %, deck fires (Scorched Reef / defeat).
    if (frac < 0.6 && this.t % (frac < 0.35 ? 3 : 6) === 0) { const q = M4.point(M.hull, R.range(-50, 50), R.range(-180, 200), CS.deckZ + 4, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.7, 0.85, 1); }
    if (frac < 0.35 && R.chance(0.08)) { const q = M4.point(M.hull, R.range(-60, 60), R.range(-180, 200), CS.deckZ + 6, [0, 0, 0]); fx._spark(q[0], q[1], q[2], 6); }
    for (const f of this.deckFires) {
      const q = M4.point(M.hull, f.lx, f.ly, CS.deckZ + 3, [0, 0, 0]);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2] + 4, f.s, 0.9, 1.1);
      if (R.chance(0.15)) fx._ember(q[0] + R.range(-6, 6), q[1] + R.range(-6, 6), q[2] + 3, f.s);
    }
    // Broken mounts burn.
    for (const f of this.fires) {
      const q = this._mountWorld(f.kind, f.i, [0, 0, 0]);
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2] + 4, f.s, 0.9, 1.1);
      if (R.chance(0.08)) fx._spark(q[0], q[1], q[2], 5);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
    // Shelled installations keep burning.
    for (const b of this.burning) { b.t++; if (this.t % 5 === 0) fx._smoke(b.x, b.y, b.z, b.s, 0.9, 1.2); }
    // The squall drives spray across the water.
    if (this.storm > 0.3 && R.chance(this.storm * 0.5)) {
      const q = this._world(R.range(-40, W + 40), R.range(120, H), 0, [0, 0, 0]), wd = this.view.wind;
      this._sprayAt(q[0], q[1], 0.6, wd[0] * 1.6, wd[1] * 0.6);
    }
    // The swell slaps the channel buoys.
    if (this.t % 10 === 0) {
      const fp = this.cam.footprint(0, 0);
      for (const b of buoysIn(fp.y0, fp.y1)) {
        if ((this.t / 10 + b.k) % 4) continue;
        const i = fx.p.spawn(fx.F.ring, b.x, b.y, 0.6, 0, 0, 0, 40);
        if (i >= 0) { const P2 = fx.p; P2.s0[i] = 6; P2.s1[i] = 22; P2.r[i] = P2.g[i] = P2.b[i] = 0.9; P2.a[i] = 0.35; }
      }
    }
  }

  _sound() {
    if (this.wreck) return;
    this.engD += 0.5 + this.v * 0.4 + (this.overdrive ? 0.6 : 0);
    if (this.engD > 90) { this.engD = 0; sfx.play('shipEngine', { pan: (this.c.e.x - W / 2) / W, v: Math.min(1, 0.4 + this.v * 0.25) }); }
  }

  _hp0() {
    const c = this.c;
    return c.floors && c.phases ? c.floors[0] + c.phases[0].hp : c.e.hp || 1;
  }

  // ------------------------------------------------------------ render

  renderWorld(view, alpha) {
    if (view !== this.view) return;
    const s = this.s;
    if (this.wreck && this.c.state !== 'dying') {
      // After the kill the rig no longer steps: the wreck settles and sinks on the view's clock.
      if (!this.wreckT) { this.wreckT = view.time; this.wakeClock = view.time; }
      const dt = view.time - this.wreckT;
      s.sink = this.p.sink = Math.max(s.sink, 2.3 + dt * 0.12);
      s.pitch = this.p.pitch = Math.max(-0.09, s.pitch - 0.0002);
      // The rig no longer steps: age the wake and let the disturbance rings die out on the view's clock.
      while (this.wakeClock < view.time) {
        this.wakeClock++;
        const M = this.M.world;
        this.wake.step({ bow: M4.point(M, 0, CS.length[1] - 4, 0, [0, 0, 0]), stern: M4.point(M, 0, CS.length[0] + 6, 0, [0, 0, 0]), shoulders: [M4.point(M, -132, 104, 0, [0, 0, 0]), M4.point(M, 132, 104, 0, [0, 0, 0])], h: s.h, v: 0 });
        this._updateRings();
      }
      if (this.surf && this.surf.ship) {
        this.surf.ship.b[3] = s.sink > 60 ? 0 : 1;
        this.surf.ship.b[2] = 0;
        const Rg = this.surf.rings;
        Rg.fill(0);
        let n = 0;
        for (let k = this.rings.length - 1; k >= 0 && n < 6; k--, n++) { const g = this.rings[k]; Rg[n * 4] = g.x; Rg[n * 4 + 1] = g.y; Rg[n * 4 + 2] = g.r; Rg[n * 4 + 3] = Math.max(0, g.s); }
      }
      const q = this.cam.project(s.x, s.y, 0, this.pr);
      if (s.sink > 90 || q[1] > H + 600) {
        const i = view.extras.indexOf(this);
        if (i >= 0) view.extras.splice(i, 1);
        this._releaseSurface();
        return;
      }
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('cs', buildCoralSiege);
    const cam = view.cam, M = this.M;
    this._pose(this.c.e.alive ? alpha : 1);
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.7), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    const z0 = view.floorZ || 0;
    const A = view.atmo, sc = view.light.sunCol, am = view.light.ambient;
    // 1) Wake foam on the water (arms, then the propeller race).
    this.wake.build(z0 + 0.5);
    const foamCol = [Math.min(1.25, sc[0] * 0.85 + am[0] * 0.55), Math.min(1.25, sc[1] * 0.85 + am[1] * 0.6), Math.min(1.3, sc[2] * 0.85 + am[2] * 0.7)];
    const dark = [0.02, 0.09, 0.12];
    R.foam(cam, A, this.wake.arms, this.wake.nArms, { col: foamCol, dark, profile: 0 });
    R.foam(cam, A, this.wake.wash, this.wake.nWash, { col: foamCol, dark, profile: 1 });
    // 2) The ship.
    R.begin(cam, A, light, NAVAL_LOOK);
    const pl = this._pointLight();
    if (pl) R.pointLight(pl[0], pl[1], pl[2]);
    const dmg = this.wreck ? 1 : Math.min(0.42, (1 - this.c.e.hp / this._hp0()) * 0.5);
    const heat = this.wreck ? 0.04 + 0.02 * Math.sin(this.t * 0.2) : 0;
    const fl = this.flash * 0.08, salt = 0;
    const o = { flash: fl, damage: dmg, heat, snow: salt };
    for (const k of ['hull', 'sponsons', 'deckhouse', 'bridgeBase']) R.draw(`cs.${k}`, M.hull, o);
    R.draw('cs.rails', M.hull, { damage: dmg, snow: 0 });
    R.draw('cs.sponsonRails', M.hull, { damage: dmg, snow: 0 });
    if (this.dead.bridge[0]) R.draw('cs.bridgeWreck', M.hull, { damage: 1, heat: 0.12, snow: 0 });
    else {
      R.draw('cs.bridge', M.hull, { flash: Math.max(fl, this._pf('bridge0')), damage: dmg, snow: salt });
      R.draw('cs.glass', M.hull, { glow: this.wreck ? 0 : 0.6, damage: dmg * 0.5, snow: 0 });
      R.draw('cs.radar', M.radar, { damage: dmg, snow: 0 });
      R.draw('cs.white', M.hull, { glow: this.wreck ? 0 : 1.2, snow: 0 });
    }
    const crit = this.c.e.hp / this._hp0() < 0.2, dyingFl = this.c.state === 'dying' ? ((this.t >> 2) & 1) : 1;
    R.draw('cs.red', M.hull, { glow: this.wreck ? 0.02 : (crit ? 0.6 + 0.6 * ((this.t >> 3) & 1) : 1) * dyingFl, snow: 0 });
    R.draw('cs.cyan', M.hull, { glow: this.wreck || this.dead.bridge[0] ? 0.05 : 0.9, snow: 0 });
    // Weapons.
    for (let i = 0; i < 3; i++) {
      if (this.dead.main[i]) { R.draw('cs.mainWreck', M.main[i], { damage: 1, heat: 0.14 }); continue; }
      const pe = this.partEnt[`main${i}`];
      R.draw('cs.mainHouse', M.main[i], { glow: 0.8 + this.mainHeat[i], flash: Math.max(fl, this._pf(`main${i}`)), damage: Math.max(dmg, this._pd(pe) * 0.8), snow: salt });
      for (let j = 0; j < 3; j++) R.draw('cs.mainBarrel', M.mb[i * 3 + j], { damage: dmg * 0.5, heat: this.mainHeat[i] * 0.25, snow: 0 });
    }
    for (let i = 0; i < 2; i++) {
      if (this.dead.sec[i]) R.draw('cs.secWreck', M.sec[i], { damage: 1, heat: 0.12 });
      else {
        const pe = this.partEnt[`sec${i}`];
        R.draw('cs.secHouse', M.sec[i], { glow: 0.8, flash: Math.max(fl, this._pf(`sec${i}`)), damage: Math.max(dmg, this._pd(pe) * 0.8), snow: salt });
        for (let j = 0; j < 2; j++) R.draw('cs.secBarrel', M.sb[i * 2 + j], { damage: dmg * 0.5, heat: this.secHeat[i] * 0.2, snow: 0 });
      }
      if (this.dead.vls[i]) R.draw('cs.vlsWreck', M.vls[i], { damage: 1, heat: 0.12 });
      else {
        const pe = this.partEnt[`vls${i}`];
        R.draw('cs.vlsBase', M.vls[i], { glow: 0.9, flash: Math.max(fl, this._pf(`vls${i}`)), damage: Math.max(dmg, this._pd(pe) * 0.8), snow: salt });
        for (let k = 0; k < 12; k++) R.draw('cs.vlsDoor', M.vd[i * 12 + k], { damage: dmg, snow: salt });
      }
      R.draw('cs.rbuBase', M.rbu[i], { damage: dmg, snow: salt });
      R.draw('cs.rbuTubes', M.rt[i], { damage: dmg, snow: 0 });
    }
    for (let k = 0; k < 6; k++) {
      if (this.dead.sec[SIDE(k)]) { R.draw('cs.ciwsWreck', M.ciws[k], { damage: 1, heat: 0.1 }); continue; }
      R.draw('cs.ciwsBase', M.ciws[k], { damage: dmg, snow: salt });
      R.draw('cs.ciwsRotor', M.cr[k], { damage: dmg * 0.4, heat: this.ciwsHeat[k] * 0.4, snow: 0 });
    }
    // Rounds in flight, missiles climbing out of their cells, debris, buoys and flotsam.
    const T = M.tmp, T2 = M.tmp2, dm = M.deb;
    for (const sh of this.shells) {
      if (sh.px === undefined) continue;
      const dx = sh.x - sh.px, dy = sh.y - sh.py, dz = sh.z - sh.pz, yaw = Math.atan2(-dx, dy), pitch = Math.atan2(dz, Math.hypot(dx, dy));
      M4.trans(sh.x, sh.y, sh.z, dm); M4.mul(dm, M4.rotZ(yaw, T), dm); M4.mul(dm, M4.rotX(pitch, T), dm);
      if (sh.kind === 'charge') M4.mul(dm, M4.rotY(sh.spin + sh.t * 0.4, T), dm);
      R.draw(sh.kind === 'charge' ? 'cs.charge' : 'cs.shell', dm, { glow: 1.4, snow: 0 });
    }
    for (const m of this.pops) {
      const k = Math.min(1, m.t / m.T), pitch = Math.PI / 2 - k * 1.1;
      M4.trans(m.x, m.y, m.z, dm); M4.mul(dm, M4.rotZ(Math.atan2(-m.ox, m.oy), T), dm); M4.mul(dm, M4.rotX(pitch, T), dm);
      R.draw('cs.missile', dm, { glow: 1.2, snow: 0 });
    }
    for (const p of this.debris) {
      M4.trans(p.x, p.y, z0 + p.z, dm);
      M4.mul(dm, M4.rotZ(p.az, T), dm); M4.mul(dm, M4.rotX(p.ax, T), dm); M4.mul(dm, M4.rotY(p.ay, T), dm);
      M4.mul(dm, scaleM(p.sx, p.sy, p.sz, T2), dm);
      R.draw(p.mesh, dm, { damage: 0.6, heat: p.life < 60 ? 0.2 : 0, snow: 0 });
    }
    const low = view.qname === 'low';
    if (!low) this._props(R, view);
    // 3) Shadow on the water and the dark contact region round the hull.
    R.beginShadow(cam, NAVAL_LOOK.shadow);
    M4.mul(M.world, M4.mul(M4.trans(0, 10, 0, T), scaleM(78, 250, 1, T2), T2), M.pad);
    R.contact(M.pad, 0.35, [0.5, 0.45], z0 + 0.8);
    for (const sd2 of [-1, 1]) { M4.mul(M.world, M4.mul(M4.trans(sd2 * 106, 25, 0, T), scaleM(52, 105, 1, T2), T2), M.pad); R.contact(M.pad, 0.28, [0.4, 0.5], z0 + 0.85); }
    const items = this._items();
    const sh = 1.1, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < (low ? 0 : 2); k++) {
      const j = (k - 0.5) * 0.06, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], z0 + 1 + k * 0.5, 0.16);
    }
    R.end();
    this._pose(1);
  }

  _pf(key) { const pe = this.partEnt[key]; return pe && pe.alive && pe.flash > 0 ? 0.4 : 0; }
  _pd(pe) { return pe && pe.alive && pe.maxHp ? 1 - pe.hp / pe.maxHp : 0; }

  /** Channel buoys and flotsam riding the swell (lagoonMap), drawn with the ship. */
  _props(R, view) {
    const cam = view.cam, fp = cam.footprint(0, 60), t = view.time, dm = this.M.deb, T = this.M.tmp;
    for (const b of buoysIn(fp.y0, fp.y1)) {
      const ph = b.k * 1.7, z = Math.sin(t * 0.045 + ph) * 1.4 - 0.6;
      M4.trans(b.x, b.y, z, dm); M4.mul(dm, M4.rotX(Math.sin(t * 0.04 + ph) * 0.12, T), dm); M4.mul(dm, M4.rotY(Math.cos(t * 0.033 + ph) * 0.1, T), dm);
      R.draw(b.side > 0 ? 'cs.buoyG' : 'cs.buoyR', dm, { glow: 0.6, snow: 0 });
      // Flotsam near every other marker.
      if (b.k % 2) continue;
      for (let j = 0; j < 2; j++) {
        const fx = b.x - b.side * (8 + j * 14) + Math.sin(t * 0.004 + j + ph) * 6, fy = b.y + 18 - j * 30 + Math.cos(t * 0.003 + ph) * 5;
        M4.trans(fx, fy, Math.sin(t * 0.05 + ph + j) * 0.8, dm); M4.mul(dm, M4.rotZ(ph + j + t * 0.002, T), dm); M4.mul(dm, M4.rotX(Math.sin(t * 0.06 + j) * 0.15, T), dm);
        R.draw(j ? 'cs.drum' : 'cs.crate', dm, { damage: 0.2, snow: 0 });
      }
    }
  }

  /** The brightest flash this frame lights the ship (muzzle, launch). */
  _pointLight() {
    let best = null, bw = 0;
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, wgt = k * (f.kind === 'main' ? 2.4 : f.kind === 'launch' ? 1.6 : 0.8);
      if (wgt > bw) { bw = wgt; best = f; }
    }
    if (!best) return null;
    const col = best.kind === 'launch' || best.kind === 'rocket' ? [2.4, 1.3, 0.6] : [2.6, 1.4, 0.7];
    return [best.w, best.kind === 'main' ? 170 : 90, col.map((v) => v * bw)];
  }

  _items() {
    const M = this.M, out = [['cs.hull', M.hull], ['cs.sponsons', M.hull], ['cs.deckhouse', M.hull], ['cs.bridgeBase', M.hull]];
    if (!this.dead.bridge[0]) out.push(['cs.bridge', M.hull]);
    for (let i = 0; i < 3; i++) out.push(this.dead.main[i] ? ['cs.mainWreck', M.main[i]] : ['cs.mainHouse', M.main[i]]);
    for (let i = 0; i < 3; i++) if (!this.dead.main[i]) for (let j = 0; j < 3; j++) out.push(['cs.mainBarrel', M.mb[i * 3 + j]]);
    return out;
  }

  /** Under entities: telegraphs on the water, muzzle light pools, searchlight beams. */
  renderUnder(b, alpha) {
    if (!this.is3D) return;
    const F = this.w.F, KF = this.c.kit.F, t = this.w.t, cam = this.cam;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const z of this.zones) {
      const q = cam.project(z.x, z.y, z.z, this.pr), r = z.r * q[2], k = z.t / z.life, blink = (t >> 2) & 1 ? 1 : 0.55;
      if (z.kind === 'shell') {
        b.draw(F.glow, q[0], q[1], r * 2 * k, r * 2 * k * 0.9, 0, 1, 0.35, 0.15, 0.25 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1, r * 1.9, t * 0.05, 1.8, 0.4, 0.25, 0.7 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1 * (1 - k), r * 1.9 * (1 - k), 0, 2, 2, 2, 0.5, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.2, 3, 0, 2, 0.6, 0.3, 0.6, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.2, 3, Math.PI / 2, 2, 0.6, 0.3, 0.6, 1);
      } else if (z.kind === 'depthMark' || z.kind === 'depth') {
        // Depth marker: dark disc over the sinking charge, a countdown ring closing in, inward ticks.
        const live = z.kind === 'depth';
        b.draw(F.glow, q[0], q[1], r * 2.2, r * 2, 0, 0.1, 0.3, 0.5, 0.18 + (live ? 0.18 * k : 0), 0);
        b.draw(F.ring, q[0], q[1], r * 2, r * 1.8, 0, 2.2, 0.4, 0.6, (live ? 0.8 : 0.45) * blink, 1);
        if (live) b.draw(F.ring, q[0], q[1], r * 2 * (1 - k * 0.85), r * 1.8 * (1 - k * 0.85), 0, 2.4, 1.2, 1.4, 0.7, 1);
        for (let n = 0; n < 4; n++) { const a = (n / 4) * TAU + t * 0.02; b.draw(KF.laser, q[0] + Math.cos(a) * r * 1.1, q[1] + Math.sin(a) * r * 0.98, r * 0.35, 2.4, a, 2.2, 0.5, 0.7, 0.6 * blink, 1); }
      } else if (z.kind === 'coast') {
        // Target designator on a shore installation.
        b.draw(F.ring, q[0], q[1], r * 2.4, r * 2.2, t * 0.04, 2.4, 1.6, 0.3, 0.75 * blink, 1);
        for (let n = 0; n < 4; n++) { const a = (n / 4) * TAU + Math.PI / 4; b.draw(KF.laser, q[0] + Math.cos(a) * r * 1.5, q[1] + Math.sin(a) * r * 1.4, r * 0.6, 2.6, a, 2.4, 1.6, 0.3, 0.8, 1); }
      }
    }
    // Muzzle light on the water.
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, q = cam.project(f.w[0], f.w[1], 0, this.pr);
      const big = f.kind === 'main' ? 2.4 : 1;
      b.draw(F.glow, q[0], q[1], 90 * big * k * q[2], 60 * big * k * q[2], 0, 2.4, 1.3, 0.6, 0.2 * k, 1);
    }
    // Searchlights sweeping the water (dusk, the squall, the overdrive) from the bridge wings.
    const dusk = this.view.light.sunCol[2] < 0.5 || this.storm > 0.3 || this.overdrive;
    if (dusk && !this.dead.bridge[0] && !this.wreck) {
      const cone = this.view.fx.F.cone;
      for (let i = 0; i < 2; i++) {
        const sl = CS.searchlights[i], q = this._scr(this.M.hull, sl[0], sl[1], 0).slice();
        const ang = Math.PI / 2 + Math.sin(t * 0.011 + i * 2.1) * 0.9;
        b.draw(cone, q[0] + Math.cos(ang) * 150, q[1] + Math.sin(ang) * 150, 300, 90, ang, 1, 0.97, 0.85, 0.09, 1);
      }
    }
  }

  /** Over entities (under bullets): flashes, aim lines, missile trails, shell tracers, reticles, rain, lightning. */
  renderOver(b, alpha) {
    if (!this.is3D) return;
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t, cam = this.cam;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const ln of this.lines) {
      const a = (1 - ln.t / ln.life) * (0.5 + 0.5 * Math.min(1, ln.k)), c = ln.col;
      b.draw(KF.laser, ln.x + Math.cos(ln.ang) * ln.len / 2, ln.y + Math.sin(ln.ang) * ln.len / 2, ln.len, 2 + Math.min(1, ln.k) * 3, ln.ang, c[0], c[1], c[2], a * 0.5, 1);
    }
    // Shell tracers and smoke trails (the rounds themselves are 3D).
    for (const sh of this.shells) {
      const T = sh.trail;
      for (let j = 0; j + 5 < T.length; j += 3) {
        const p0 = cam.project(T[j], T[j + 1], T[j + 2], this.pr).slice(), p1 = cam.project(T[j + 3], T[j + 4], T[j + 5], this.pr);
        const u = j / T.length;
        b.draw(KF.laser, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 1, 2 + u * 3, Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 1.0, 0.9, 0.85, 0.08 + u * 0.18, 1);
      }
      const q = cam.project(sh.x, sh.y, sh.z, this.pr);
      const hot = sh.kind === 'charge' ? [0.6, 1.4, 2] : [2.4, 1.1, 0.4];
      b.draw(F.glow, q[0], q[1], 22 * q[2], 22 * q[2], 0, hot[0], hot[1], hot[2], 0.75, 1);
    }
    // VLS boosters climbing out of their cells.
    for (const m of this.pops) {
      if (m.t < 5) continue;
      const q = cam.project(m.x, m.y, m.z - 7, this.pr), fl = 0.8 + 0.2 * Math.sin(t * 1.7 + m.t);
      b.draw(F.glow, q[0], q[1], 30 * fl * q[2], 30 * fl * q[2], 0, 2.4, 1.3, 0.5, 0.85, 1);
      b.draw(KF.laser, q[0], q[1] + 10 * q[2], 26 * fl * q[2], 7 * q[2], Math.PI / 2, 2.4, 1.6, 0.8, 0.8, 1);
    }
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      const s = f.k || 1;
      if (f.kind === 'main') {
        // A battleship gun: a white-hot core, a long blast cone, side jets, a ring of fire and smoke.
        b.draw(F.glow, f.x, f.y, 70 * s * k, 70 * s * k, 0, 2.4, 1.5, 0.7, 0.95 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 26 * s, f.y + Math.sin(f.ang) * 26 * s, 64 * s * k, 22 * s * k, f.ang, 2.4, 1.6, 0.8, 0.95 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 40 * s, f.y + Math.sin(f.ang) * 40 * s, 40 * s * k, 10 * s * k, f.ang, 2.4, 2.2, 1.8, 0.8 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 30 * s * k, 7 * k, f.ang + s2 * 1.25, 2.4, 1.2, 0.5, 0.6 * k, 1);
        b.draw(F.ring, f.x + Math.cos(f.ang) * 10, f.y + Math.sin(f.ang) * 10, 60 * s * (1 - k * 0.6), 52 * s * (1 - k * 0.6), 0, 2.2, 1.4, 0.8, 0.45 * k, 1);
      } else if (f.kind === 'sec') {
        b.draw(F.glow, f.x, f.y, 30 * s * k, 30 * s * k, 0, 2.4, 1.2, 0.6, 0.85 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 10, f.y + Math.sin(f.ang) * 10, 26 * s * k, 7 * s * k, f.ang, 2.4, 1.4, 0.8, 0.85 * k, 1);
      } else if (f.kind === 'ciws') {
        b.draw(F.glow, f.x, f.y, 16 * k, 16 * k, 0, 2.4, 1.6, 0.8, 0.8 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 6, f.y + Math.sin(f.ang) * 6, 14 * k, 4 * k, f.ang, 2.4, 1.8, 1, 0.8 * k, 1);
      } else if (f.kind === 'launch') {
        b.draw(F.glow, f.x, f.y, 54 * s * k, 54 * s * k, 0, 2.4, 1.6, 0.8, 0.85 * k, 1);
        b.draw(F.ring, f.x, f.y, 70 * s * (1 - k), 64 * s * (1 - k), 0, 1.6, 1.6, 1.6, 0.4 * k, 1);
      } else if (f.kind === 'rocket') {
        b.draw(F.glow, f.x, f.y, 28 * s * k, 28 * s * k, 0, 2.4, 1.4, 0.6, 0.8 * k, 1);
      }
    }
    // Missile smoke trails and exhaust.
    for (const m of this.missiles) {
      const T = m.trail;
      for (let j = 0; j + 3 < T.length; j += 2) {
        const u = j / T.length, x0 = T[j], y0 = T[j + 1], x1 = T[j + 2], y1 = T[j + 3];
        b.draw(KF.laser, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) + 1, 2 + u * 3.4, Math.atan2(y1 - y0, x1 - x0), 1.05, 1.0, 1.05, 0.06 + u * 0.24, 1);
      }
      if (m.alive) {
        const cx = Math.cos(m.ang), sy = Math.sin(m.ang), fl = 0.75 + 0.25 * Math.sin(t * 1.9 + m.ref._cs);
        b.draw(KF.laser, m.x - cx * 15, m.y - sy * 15, 20 * fl, 6, m.ang, 2.4, 1.3, 0.6, 0.9, 1);
        b.draw(F.glow, m.x - cx * 10, m.y - sy * 10, 18 * fl, 18 * fl, 0, 2.4, 1.0, 0.5, 0.7, 1);
        b.draw(F.white, m.x - cx * 2, m.y - sy * 2, 15, 3.6, m.ang, 0.62, 0.64, 0.68, 1, 0);
        for (const s2 of [-1, 1]) b.draw(F.white, m.x - cx * 8 - sy * s2 * 2.6, m.y - sy * 8 + cx * s2 * 2.6, 4, 1.6, m.ang + s2 * 0.6, 0.3, 0.3, 0.34, 1, 0);
      }
    }
    for (const r of this.reticles) {
      const k = r.t / r.life, a = (1 - k) * ((t >> 2) & 1 ? 1 : 0.55);
      b.draw(F.ring, r.x, r.y, 42 - k * 14, 42 - k * 14, t * 0.05, 2.2, 0.3, 0.8, 0.5 * a, 1);
    }
    // Burning mounts and deck fires: glow over the hull.
    for (const f of [...this.fires, ...this.deckFires]) {
      if (f.x === undefined) continue;
      const q = cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.x);
      b.draw(F.glow, q[0], q[1], 34 * f.s * fl, 30 * f.s * fl, 0, 2, 0.7, 0.2, 0.5, 1);
    }
    // The squall: slanting rain sheets and a lightning bolt over the far water.
    if (this.storm > 0.02) {
      const n = Math.round(150 * this.storm), wd = this.view.wind, sl = 0.25 + wd[0] * 0.12;
      for (let k = 0; k < n; k++) {
        const h1 = Math.sin(k * 12.9898) * 43758.5453, h2 = Math.sin(k * 78.233) * 12543.123;
        const fx = h1 - Math.floor(h1), fy = h2 - Math.floor(h2), sp = 14 + fx * 10;
        const x = ((fx * (W + 120) + t * sp * sl) % (W + 120)) - 60, y = ((fy * (H + 80) + t * sp) % (H + 80)) - 40;
        b.draw(F.white, x, y, 1.1, 16 + fx * 14, -sl, 0.75, 0.82, 0.95, 0.16 * this.storm, 1);
      }
      if (this.bolt) {
        const k2 = 1 - this.bolt.t / 14, Rb = new (this.w.fxRng.constructor)(Math.floor(this.bolt.seed * 1e9));
        let x0 = this.bolt.x, y0 = -10, ang = Math.PI / 2 + Rb.range(-0.4, 0.4);
        for (let s2 = 0; s2 < 9; s2++) {
          const l = Rb.range(18, 34), x1 = x0 + Math.cos(ang) * l, y1 = y0 + Math.sin(ang) * l;
          b.draw(F.white, (x0 + x1) / 2, (y0 + y1) / 2, l, 2.4, ang, 1.6, 1.7, 2.2, 0.85 * k2, 1);
          if (Rb.chance(0.3)) { const ba = ang + Rb.sign() * Rb.range(0.5, 1), bl = l * 0.7; b.draw(F.white, x1 + Math.cos(ba) * bl / 2, y1 + Math.sin(ba) * bl / 2, bl, 1.2, ba, 1.4, 1.5, 2, 0.65 * k2, 1); }
          x0 = x1; y0 = y1; ang = Math.PI / 2 + Rb.range(-0.7, 0.7);
        }
      }
    }
  }

  dispose() {
    if (this.view) {
      const i = this.view.extras.indexOf(this);
      if (i >= 0) this.view.extras.splice(i, 1);
      if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
      if (this.pitch0 !== undefined) { this.view.cam.pitch = this.pitch0; this.view.cam.roll = 0; }
    }
    this._releaseSurface();
  }
}

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

export { HOME_ROW, CRUISE };
