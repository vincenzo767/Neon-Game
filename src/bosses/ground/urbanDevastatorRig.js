import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer, CAR_LOOK } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { UD, buildUrbanDevastator } from '../../world/tank/urbanDevastatorModel.js';
import { SkidTrail } from '../../world/tank/SkidTrail.js';
import { TL } from '../../world/tank/tankTextures.js';
import { ROAD, roadX, roadSlope, splitAt, nextFork, nextBend, forkAt, isSplit, envelope } from '../../world/env/downtownRoad.js';

// URBAN DEVASTATOR runtime rig: the armoured pursuit supercar as a driven
// vehicle on the Downtown Siege boulevard (world/env/downtownRoad.js).
//
//   Chase      the rig owns the arena camera for the duel: it runs the scroll
//              at chase speed (the city streams past) and pans the camera
//              laterally to frame the car through bends and forks. The car
//              drives AWAY from the pursuing pilot (nose up the screen), so
//              its rear — turbine, thrusters, rear guns, taillights — faces
//              the player. It holds its screen row with a speed controller.
//   Driving    world pose (x, y), travel direction θ, speed v, slip angle β
//              (heading h = θ + β). Steering is pure pursuit toward a look-
//              ahead point on the road at the target lane (bicycle model:
//              dθ ≤ v·tan(δmax)/wheelbase), so the car follows the road's
//              real bends, changes lanes by steering, and takes the left or
//              right branch of a fork. Drifts raise β (the rear slides out,
//              the front wheels countersteer) on top of the same path, so a
//              drift never leaves the road. Suspension: pitch from
//              acceleration, roll from lateral acceleration and slip, bob
//              from road bumps and impacts; wheels spin from the odometer
//              (rear wheels slip under turbo / drift); front wheels steer.
//   Marks      SkidTrail: one ribbon per tyre at its real contact point,
//              intensity from the driving state (scuff → black drift arcs);
//              tyre smoke and sparks spawn at the contact patches and trail
//              off behind the wheels.
//   Weapons    rear quarter cannons (yaw, twin barrels recoil in turn), side
//              rotary cannons (deploy from the waist, yaw, rotor spins),
//              missile pods (cover opens, six tubes), rear turbine (fan spool,
//              glow, discharge). Every bullet, telegraph and flash starts at
//              its mechanism on the 3D model.
//   Attacks    Rear Pursuit Barrage, Sidewinder Crossfire, Missile Pursuit,
//              Apex Drift Barrage, Roadblock Breaker, Turbine Discharge,
//              Full-Lane Suppression, Turbo Repair Overdrive (+ Critical
//              Pursuit after the repair).
//   Parts      rear cannons ×2, side cannons ×2, missile pods ×2, turbine
//              emitter: breakable BossKit parts riding their projected mounts;
//              a broken part stays broken and its attacks stop. A dead turbine
//              turns the discharge into a weak thruster vent and halves the
//              repair.
//
// The BossController keeps HP, phases, transitions and the death timeline.

const HOME_ROW = 196;          // screen row of the car's centre while pursuing
const CHASE = 4.4;             // camera (scroll) speed during the duel, world units / step
const WB = UD.wheelbase;
const STEER_MAX = 0.5;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = (v) => (v < 0 ? -1 : 1);

const SPEC = {
  bar: { shape: 'rice', color: 'pink', n: 3, spread: 0.22, speed: 3.1 },
  barWide: { shape: 'rice', color: 'red', n: 9, spread: 1.5, speed: 2.0 },
  side: { shape: 'rice', color: 'pink', n: 1, speed: 3.3 },
  sideB: { shape: 'orb', color: 'red', n: 2, spread: 0.16, speed: 2.5 },
  drift: { shape: 'rice', color: 'pink', n: 2, spread: 0.1, speed: 2.7 },
  driftOrb: { shape: 'orb', color: 'red', n: 1, speed: 2.0 },
  deb: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.1, fixed: true },
  debR: { shape: 'rice', color: 'orange', n: 1, speed: 2.9, fixed: true },
  debRing: { shape: 'rice', color: 'orange', n: 5, speed: 1.7 },
  turbRing: { shape: 'bigorb', color: 'pink', n: 14, speed: 1.75 },
  turbRice: { shape: 'rice', color: 'red', n: 26, speed: 2.5 },
  vent: { shape: 'orb', color: 'red', n: 10, speed: 2.0 },
  sup: { shape: 'rice', color: 'red', n: 1, speed: 4.0, fixed: true },
  supSide: { shape: 'rice', color: 'pink', n: 1, speed: 3.4, fixed: true },
};
const MSPLIT = { shape: 'rice', color: 'red', n: 6, speed: 1.6 };

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true, cy: 0, x: 0,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x; out[1] = -y; out[2] = 1; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx; out[1] = -sy; out[2] = h; return out; },
  frame() {},
};

const KEYS = ['x', 'y', 'h', 'pitch', 'roll', 'bob', 'steer', 'fan', 'lift'];
const ARR = ['spin', 'comp', 'ry', 'sy', 'rot', 'rc', 'pod', 'dep'];
const mat = () => new Float32Array(16);

export class UrbanDevastatorRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    // Pose (prev / current for interpolation).
    this.s = { x: 0, y: 0, h: 0, pitch: 0, roll: 0, bob: 0, steer: 0, fan: 0, lift: 0, spin: [0, 0, 0, 0], comp: [0, 0, 0, 0], ry: [Math.PI, Math.PI], sy: [UD.sideRest[0], UD.sideRest[1]], rot: [0, 0], rc: [0, 0, 0, 0], pod: [0, 0], dep: [0, 0] };
    this.p = { ...this.s };
    for (const k of ARR) this.p[k] = [...this.s[k]];
    // Driving.
    this.v = 0; this.th = 0; this.beta = 0; this.betaT = 0; this.acc = 0; this.dth = 0;
    this.grip = 1; this.slip = 0;         // rear wheelspin (turbo / launch / drift)
    this.lane = 0;                         // target lateral offset on the unsplit road
    this.forkK = null; this.forkSide = 1;
    this.rowT = HOME_ROW;
    this.cv = 0;                           // camera speed (owned during the duel)
    this.ctrlCam = false; this.released = false;
    this.weaveT = 120;
    this.brake = 0;                        // brake-light / dive signal
    this.bump = 0;
    this.cornerDrift = null;
    // Weapons.
    this.dead = { rear: [false, false], side: [false, false], pod: [false, false], turbine: [false] };
    this.partHp = {}; this.partEnt = {};
    this.heat = [0, 0, 0, 0];              // rear L, rear R, side L, side R
    this.alt = [0, 0];
    this.rotV = [0, 0];                    // rotor speeds
    this.depT = [0, 0];                    // side-gun deploy targets
    this.podT = [0, 0];                    // pod cover targets
    this.fanV = 0.08; this.fanT = 0.08;    // turbine fan speed
    this.glowT = 0.4; this.tGlow = 0.4;    // turbine glow
    this.sideAim = [null, null];           // forced side-gun yaw (sweeps)
    this.rearAim = [null, null];
    this.fires = [];
    // Attacks in flight.
    this.heavy = null; this.queue = null;
    this.sw = null; this.ms = null; this.dr = null; this.rb = null; this.tb = null; this.su = null; this.rep = null;
    this.missiles = []; this.reticles = []; this.mid = 0;
    this.flashes = []; this.lines = []; this.arcs = []; this.chevrons = null;
    this.debris = []; this.block = null;
    this.critical = false; this.odT = 0; this.empower = 0;
    this.repairs = 0; this.repPhase = -1;
    // Marks.
    this.skids = new SkidTrail(UD.wheels.map((wh) => wh.w * 0.85), 1500);
    this.M = {
      world: mat(), hull: mat(), wheel: [mat(), mat(), mat(), mat()], hub: [mat(), mat(), mat(), mat()],
      rg: [mat(), mat()], rb: [mat(), mat(), mat(), mat()], sg: [mat(), mat()], sr: [mat(), mat()],
      pd: [mat(), mat()], pc: [mat(), mat()], fan: mat(), core: mat(),
      tmp: mat(), tmp2: mat(), span: mat(), pad: mat(), deb: mat(),
    };
    this.t = 0;
    this.deathT = -1;
    this.wreck = false;
    this.placed = false;
    this.flash = 0;
    this.pr = [0, 0, 0, 0];
    this.q3 = [0, 0, 0];
    this.wp3 = [0, 0, 0];
    this.engD = 0; this.screechD = 0;
    this.light = null;                     // strongest flash this frame (point light on the bodywork)
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get turbineOK() { return !this.dead.turbine[0]; }
  get rate() { return (this.c.intensity || 1) * (this.empower > 0 ? 1.35 : 1) * (1 + 0.12 * (this.c.mk - 1)); }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view) {
      const scr = this.placed ? this._scr(this.M.world, 0, 0, 0) : null;
      const keep = scr ? [scr[0], scr[1]] : null;
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
          // The chase owns the scroll and the lateral framing for the duel.
          this.ctrlCam = true;
          this.view.speedTarget = null;
          if (!this.placed) this.cv = this.view.speed;
          this.view.speed = this.cv;
        }
        this.view.camFollow = (vw) => this._follow(vw);
        // A new arena world: frame the road at once.
        this.cam.x = this.cam.px = roadX(this.cam.y + 380) * 0.85;
        this.cam.frame(1);
      }
      this.skids.clear();
      this.debris.length = 0; this.block = null;
      if (keep) this._placeAt(keep[1], true);
    }
    if (this.view) this.cam.frame(1);
  }

  /** Screen point → world point on the plane z = h. */
  _world(sx, sy, h = 0, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, (this.view ? this.view.floorZ : 0) + h, out) || out; }

  /** Put the car's centre on screen row `row`, on the road at its lane. */
  _placeAt(row, keepLane = false) {
    const p = this._world(W / 2, row, 0, this.q3);
    const y = p[1];
    if (!keepLane) this.lane = 0;
    const s = this.s;
    s.x = roadX(y) + this._offAt(y); s.y = y;
    this.th = Math.atan(roadSlope(y)); this.beta = 0; s.h = this.th;
    for (const k of KEYS) this.p[k] = s[k];
    this._pose(1);
  }

  _row() { return this._scr(this.M.world, 0, 0, 20)[1]; }

  /** Camera framing: pan toward the car and the road (called right after the camera steps). */
  _follow(vw) {
    const cam = vw.cam;
    if (this.wreck || this.c.state === 'dying') {
      const tx = roadX(cam.y + 380) * 0.85;
      cam.x += clamp(tx - cam.x, -1.2, 1.2) * 0.04;
      return;
    }
    const s = this.s, ty = s.y;
    let tx = s.x * 0.78 + roadX(ty + 200) * 0.22;
    // Keep the whole car on screen in the widest moments (forks, turbo swerves).
    tx = clamp(tx, s.x - 120, s.x + 120);
    cam.x += clamp((tx - cam.x) * 0.05, -3, 3);
  }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e, s = this.s;
    this._attach();
    if (!this.placed) {
      this.placed = true;
      // The car roars in from behind the pursuing pilot and settles ahead.
      this._placeAt(c.state === 'enter' ? H + 260 : HOME_ROW);
      this.v = c.state === 'enter' ? Math.max(this.cv, 1) + 4 : this.cv;
      if (c.state === 'enter' && this.is3D) sfx.play('turboBlast', { pan: 0 });
    }
    for (const k of KEYS) this.p[k] = s[k];
    for (const k of ARR) for (let i = 0; i < s[k].length; i++) this.p[k][i] = s[k][i];
    this.t++;
    this.skids.step();
    if (this.empower > 0) this.empower--;

    switch (c.state) {
      case 'enter': this.rowT = HOME_ROW; this.lane = 0; break;
      case 'fight': this._fight(); break;
      case 'transition': this.rowT = HOME_ROW; this._endAttacks(); this._cruise(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._speedCamera();
    this._drive();
    this._suspension();
    this._weaponsAnim();
    this._pose(1);
    const pc = this._scr(this.M.hull, 0, -30, 50);
    e.x = pc[0]; e.y = pc[1];
    e.rot = 0;
    e.scale = this.pr[2] || 1;
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._repairCheck();
    this._updateSidewinder();
    this._updateMissiles();
    this._updateDrift();
    this._updateRoadblock();
    this._updateTurbine();
    this._updateSuppression();
    this._updateRepair();
    this._runQueue();
    this._trackMissiles();
    this._updateDebris();
    if (this.is3D) { this._fx(); this._sound(); }
    for (let i = this.flashes.length - 1; i >= 0; i--) if (++this.flashes[i].t >= this.flashes[i].life) this.flashes.splice(i, 1);
    for (let i = this.lines.length - 1; i >= 0; i--) if (++this.lines[i].t >= this.lines[i].life) this.lines.splice(i, 1);
    for (let i = this.arcs.length - 1; i >= 0; i--) if (++this.arcs[i].t >= this.arcs[i].life) this.arcs.splice(i, 1);
    for (let i = this.reticles.length - 1; i >= 0; i--) if (++this.reticles[i].t >= this.reticles[i].life) this.reticles.splice(i, 1);
  }

  // ------------------------------------------------------------ fight AI

  _phaseMove() { const ph = this.c.phase; return (ph && ph.move) || {}; }

  _fight() {
    if (this.rep) return;                 // turbo repair owns the drive
    if (this.dr && this.dr.phase !== 'tele') return; // the apex drift owns lane and slip
    this._cruise();
  }

  /** Lane weaving, fork choices, corner drifts (nothing here fires). */
  _cruise() {
    const c = this.c, w = this.w, s = this.s, mv = this._phaseMove();
    const weave = (mv.weave ?? 0.5) * (this.critical ? 1.5 : 1);
    if (!this.rb || this.rb.phase === 'done') this.rowT = HOME_ROW + Math.sin(this.t * 0.013) * 12 + (this.tb && this.tb.phase === 'fire' ? 26 : 0);
    // Fork ahead: pick a branch early and move to that side before the island starts.
    const fk = nextFork(s.y - 40), inF = forkAt(s.y + 120) || forkAt(s.y);
    if (fk && fk.y0 - s.y < 760 && this.forkK !== fk.k) {
      this.forkK = fk.k;
      this.forkSide = Math.abs(this.lane) > 18 ? sgn(this.lane) : w.rng.sign();
      if (this.c.state === 'fight' && this.is3D) sfx.play('tireScreech', { pan: this.forkSide * 0.3, v: 0.4 });
    }
    if (fk && fk.y0 - s.y < 760 && this.forkK === fk.k) this.lane = this.forkSide * ROAD.carRange;
    else if (!inF && c.state === 'fight' && !this.su && !(this.rb && this.rb.phase !== 'done')) {
      // Lane changes (by steering): more often in later phases.
      if (--this.weaveT <= 0 && weave > 0) {
        let nl = w.rng.range(-ROAD.carRange, ROAD.carRange);
        if (Math.abs(nl - this.lane) < 40) nl = clamp(this.lane + w.rng.sign() * w.rng.range(50, 90), -ROAD.carRange, ROAD.carRange);
        this.lane = nl;
        this.weaveT = Math.round(w.rng.range(170, 300) / weave);
      }
    }
    // Corner drifts through the sharper bends (later phases): the rear steps out, then catches.
    const bend = nextBend(s.y);
    if (bend && !this.cornerDrift && !this.dr && !inF && (mv.cornerDrift || this.critical) && bend.size > 0.22 && bend.y - s.y < 230 && bend.y - s.y > 120) {
      this.cornerDrift = { t: 0, dir: bend.turn, k: bend.k };
      if (this.is3D) sfx.play('tireScreech', { pan: bend.turn * 0.3, v: 0.7 });
    }
  }

  /** Target lateral offset (from the centreline) at world y: the lane, or the chosen fork carriageway. */
  _offAt(y) {
    const sp = splitAt(y), k = clamp((sp - ROAD.base) / 40, 0, 1);
    if (k <= 0) return this.lane;
    const f = forkAt(y), side = f && f.k === this.forkK ? this.forkSide : sgn(this.lane);
    return lerp(this.lane, side * sp, k);
  }

  // ------------------------------------------------------------ physics

  /** Camera (scroll) speed: the chase speed during the duel, held back if the terrain ahead isn't built yet. */
  _speedCamera() {
    if (!this.ctrlCam || !this.view) return;
    const c = this.c, dying = c.state === 'dying';
    let T = dying ? (this.deathT > 150 ? this.view.baseSpeed : 0) : CHASE * (this.rep && this.rep.phase !== 'warn' ? 1.12 : 1);
    if (!dying && !this._aheadReady()) T = Math.min(T, this.view.baseSpeed * 1.4);
    const rate = dying ? 0.05 : c.state === 'enter' ? 0.025 : 0.02;
    this.cv += clamp(T - this.cv, -rate, rate);
    this.view.speed = this.cv;
  }

  /** True when the periodic chunks up to ~2 screens ahead are uploaded. */
  _aheadReady() {
    const v = this.view;
    if (!v || !v.layers) return true;
    if ((this._arT || 0) > this.t) return this._arV;
    this._arT = this.t + 15;
    let ok = true;
    for (const L of v.layers) {
      if (!L.period) continue;
      const fp = v.cam.footprint(L.z, 0);
      if (!Number.isFinite(fp.y1)) continue;
      for (let k = Math.floor(fp.y1 / L.length); k <= Math.floor((fp.y1 + 1400) / L.length); k++) {
        const ch = v.chunks.get(`${L.id}:${v._wrap(L, k)}`);
        if (!ch || ch.state !== 'ready') { ok = false; break; }
      }
    }
    this._arV = ok;
    return ok;
  }

  _drive() {
    const s = this.s, c = this.c, dying = c.state === 'dying';
    // ---- Speed: hold the target screen row (critically damped, rate limited).
    const row = this._row();
    let want;
    if (dying) want = this.deathT < 150 ? Math.max(0, this.v - 0.05) : this.v;
    else {
      const boost = this.rep && this.rep.phase === 'boost';
      const g = c.state === 'enter' ? 0.03 : boost ? 0.05 : 0.02;
      want = this.cv + clamp((row - this.rowT) * g, -2.4, c.state === 'enter' || boost ? 5 : 3.4);
      if (this.rb && this.rb.phase === 'charge') want = this.cv + 3.2;
    }
    if (!this.view) want = 0;
    const accel = (this.rep && this.rep.phase === 'boost') || (this.rb && this.rb.phase === 'charge') ? 0.16 : 0.07;
    const v0 = this.v;
    this.v += clamp(want - this.v, dying ? -0.06 : -0.13, accel);
    this.v = Math.max(0, this.v);
    this.acc = this.v - v0;
    this.brake = Math.max(this.brake * 0.9, this.acc < -0.05 ? Math.min(1, -this.acc * 10) : 0);
    // ---- Steering (pure pursuit on the road at the target lane / carriageway).
    const LA = 140 + this.v * 20;
    const yl = s.y + LA * Math.cos(this.th);
    const xl = roadX(yl) + this._offAt(yl);
    let hd = Math.atan2(xl - s.x, Math.max(30, yl - s.y));
    if (dying) hd = lerp(hd, this.th, 0.6);
    const drifting = this.dr && (this.dr.phase === 'entry' || this.dr.phase === 'slide');
    const dmax = Math.max(0.002, (this.v * Math.tan(STEER_MAX)) / WB) * (drifting ? 1.7 : 1);
    const dth = clamp(wrapA(hd - this.th) * 0.12, -dmax, dmax);
    this.dth += (dth - this.dth) * 0.35;
    this.th += this.dth;
    // ---- Slip angle: drifts (attack), corner drifts, the defeat spin; grip catches it otherwise.
    let bt = 0, br = 0.06;
    if (this.dr) { bt = this.dr.beta; br = this.dr.phase === 'entry' ? 0.07 : this.dr.phase === 'recover' ? 0.05 : 0.04; }
    else if (this.cornerDrift) {
      const cd = this.cornerDrift; cd.t++;
      bt = cd.dir * (cd.t < 50 ? 0.34 : 0) + (cd.t > 50 && cd.t < 64 ? -cd.dir * 0.05 : 0);
      if (cd.t > 80) this.cornerDrift = null;
    } else if (this.rep && this.rep.phase === 'boost') bt = this.rep.swerve * Math.sin(this.rep.t * 0.07) * 0.28;
    if (dying) { bt = this.spinDir * Math.min(2.8, this.deathT * 0.035); br = 0.05; }
    this.beta += clamp(bt - this.beta, -br, br);
    s.h = this.th + this.beta;
    this.grip = 1 - Math.min(1, Math.abs(this.beta) * 1.6);
    // ---- Integrate.
    s.x += Math.sin(this.th) * this.v;
    s.y += Math.cos(this.th) * this.v;
    // Never leave the asphalt (impacts / defeat): clamp to the current carriageway envelope.
    const off = s.x - roadX(s.y), lim = envelope(s.y) - 90;
    if (Math.abs(off) > lim) s.x = roadX(s.y) + sgn(off) * lim;
    // ---- Visual steering: into the path; countersteer while sliding.
    const pathSteer = Math.atan((WB * this.dth) / Math.max(0.5, this.v));
    const steerT = clamp(pathSteer * 1.4 - this.beta * 0.7, -0.55, 0.55);
    s.steer += clamp(steerT - s.steer, -0.05, 0.05);
    // ---- Wheels: front roll with the road; rear spin up under turbo / launch / slide.
    this.slip += ((this.rep && this.rep.phase === 'boost' ? 1.2 : 0) + (this.rb && this.rb.phase === 'charge' ? 0.6 : 0) + Math.abs(this.beta) * 1.4 + (this.acc > 0.08 ? 0.5 : 0) - this.slip) * 0.1;
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k], lock = dying && this.deathT > 20 && this.deathT < 120 ? 0.15 : 1;
      s.spin[k] += ((this.v * lock) / wh.r) * (wh.front ? 1 : 1 + this.slip * 0.8);
    }
  }

  _suspension() {
    const s = this.s, c = this.c, R = this.w.fxRng;
    const alat = this.v * this.dth;                       // lateral acceleration (+ right)
    const pitchT = clamp(this.acc * 0.45, -0.035, 0.03) - this.brake * 0.02 + (this.tb && this.tb.phase === 'fire' && this.tb.t < 10 ? 0.04 : 0);
    const rollT = clamp(-alat * 3.2, -0.07, 0.07) - this.beta * 0.06;
    s.pitch += (pitchT - s.pitch) * 0.12;
    s.roll += (rollT - s.roll) * 0.12;
    // Road surface: fine vibration at speed, bumps over cracks / manholes, impact jolts.
    this.bump *= 0.86;
    if (R.chance(0.02 * this.v)) this.bump += R.range(0.6, 1.6);
    const vib = Math.sin(this.t * 1.7) * 0.25 * Math.min(1, this.v / 4);
    s.bob += (vib + this.bump * Math.sin(this.t * 0.9) - s.bob) * 0.3;
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k];
      // Compression: load transfer from roll and pitch (+ = compressed).
      const load = -s.roll * wh.x * 0.6 * -1 + s.pitch * wh.y * 0.12 + (R.chance(0.04) ? R.range(-0.6, 0.6) : 0);
      s.comp[k] += (clamp(load, -4, 4) - s.comp[k]) * 0.25;
    }
    const shake = c.state === 'dying' ? 0.8 : c.state === 'transition' ? 0.4 * (1 - c.st / 144) : 0;
    if (shake) { s.bob += R.range(-1, 1) * shake; s.roll += R.range(-0.004, 0.004) * shake; }
  }

  /** Slew guns toward their targets, settle recoil, spin rotors and the fan, open / close covers. */
  _weaponsAnim() {
    const s = this.s, w = this.w, live = this.c.state === 'fight' || this.c.state === 'enter';
    for (let i = 0; i < 2; i++) {
      const pv = UD.rearGuns[i];
      if (live && !this.dead.rear[i]) {
        const t = this.rearAim[i] || this._world(w.aimX, w.aimY, pv[2], this.wp3);
        const want = clamp(wrapA(this._yawTo(pv, t) - Math.PI), -0.95, 0.95) + Math.PI;
        s.ry[i] += clamp(wrapA(want - s.ry[i]), -0.04, 0.04);
      }
      const sv = UD.sideGuns[i];
      if (!this.dead.side[i]) {
        const rest = UD.sideRest[i];
        let want = rest;
        if (this.sideAim[i] !== null) want = this.sideAim[i];
        else if (live && s.dep[i] > 0.5) want = rest + clamp(wrapA(this._yawTo(sv, this._world(w.aimX, w.aimY, sv[2], this.wp3)) - rest), -0.7, 0.7);
        s.sy[i] += clamp(wrapA(want - s.sy[i]), -0.05, 0.05);
        s.dep[i] += clamp(this.depT[i] - s.dep[i], -0.04, 0.04);
        this.rotV[i] += ((this.depT[i] > 0.5 ? (this._firingSide(i) ? 0.75 : 0.25) : 0) - this.rotV[i]) * 0.06;
        s.rot[i] += this.rotV[i];
      } else { s.dep[i] = Math.max(0, s.dep[i] - 0.05); }
      s.pod[i] += clamp((this.dead.pod[i] ? 0 : this.podT[i]) - s.pod[i], -0.06, 0.06);
      this.heat[i] = Math.max(0, this.heat[i] - 0.02);
      this.heat[i + 2] = Math.max(0, this.heat[i + 2] - 0.015);
    }
    for (let k = 0; k < 4; k++) s.rc[k] *= 0.8;
    // Turbine fan and glow (spool inertia).
    this.fanV += (this.fanT * (this.turbineOK ? 1 : 0.15) - this.fanV) * 0.03;
    s.fan += this.fanV;
    this.tGlow += (this.glowT * (this.turbineOK ? 1 : 0.2) - this.tGlow) * 0.06;
    this.fanT = this.tb ? this.fanT : this.rep ? 1.1 : this.critical ? 0.35 : 0.14 + this.v * 0.02;
    this.glowT = this.tb ? this.glowT : this.rep ? 2.2 : this.critical ? 1.0 : 0.5 + Math.max(0, this.acc) * 4;
  }

  _firingSide(i) { return (this.sw && this.sw.phase === 'fire') || (this.dr && this.dr.phase === 'slide') || (this.su && this.su.phase === 'fire') || this.c.state === 'enter' ? true : this.heat[i + 2] > 0.2; }

  /** Yaw (local Rz convention) that points a hull-mounted pivot at world point t. */
  _yawTo(pivot, t) {
    const s = this.s, ch = Math.cos(s.h), sh = Math.sin(s.h);
    const dx = t[0] - s.x, dy = t[1] - s.y;
    const lx = dx * ch - dy * sh - pivot[0], ly = dx * sh + dy * ch - pivot[1];
    return Math.atan2(-lx, ly);
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
    // Body on its suspension (pivot near the centre of mass).
    M4.mul(Wm, M4.trans(0, -10, 30 + L('bob') + L('lift'), T), M.hull);
    M4.mul(M.hull, M4.rotX(L('pitch'), T), M.hull);
    M4.mul(M.hull, M4.rotY(L('roll'), T), M.hull);
    M4.mul(M.hull, M4.trans(0, 10, -30, T), M.hull);
    // Wheels on the ground (steer about z, spin about the axle).
    const st = L('steer');
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k];
      M4.mul(Wm, M4.trans(wh.x, wh.y, wh.r, T), M.hub[k]);
      if (wh.front) M4.mul(M.hub[k], M4.rotZ(-st, T), M.hub[k]);
      M4.mul(M.hub[k], M4.rotX(-LA('spin', k), T), M.wheel[k]);
    }
    for (let i = 0; i < 2; i++) {
      const rg = UD.rearGuns[i];
      M4.mul(M.hull, M4.trans(rg[0], rg[1], rg[2], T), M.rg[i]);
      M4.mul(M.rg[i], M4.rotZ(LA('ry', i), T2), M.rg[i]);
      for (let j = 0; j < 2; j++) {
        const b = UD.rearBarrels[j];
        M4.mul(M.rg[i], M4.trans(b[0], b[1] - LA('rc', i * 2 + j) * 7, b[2], T), M.rb[i * 2 + j]);
      }
      const sg = UD.sideGuns[i], dep = LA('dep', i);
      M4.mul(M.hull, M4.trans(sg[0], sg[1], sg[2] - 11 + dep * 11, T), M.sg[i]);
      M4.mul(M.sg[i], M4.rotZ(LA('sy', i), T2), M.sg[i]);
      M4.mul(M.sg[i], M4.trans(UD.sideRotor[0], UD.sideRotor[1], UD.sideRotor[2], T), M.sr[i]);
      M4.mul(M.sr[i], M4.rotY(LA('rot', i), T2), M.sr[i]);
      const pd = UD.pods[i];
      M4.mul(M.hull, M4.trans(pd[0], pd[1], pd[2], T), M.pd[i]);
      M4.mul(M.pd[i], M4.rotZ(Math.PI, T2), M.pd[i]);
      M4.mul(M.pd[i], M4.rotX(UD.podPitch, T2), M.pd[i]);
      M4.mul(M.pd[i], M4.trans(0, 13.6, 10, T), M.pc[i]);
      M4.mul(M.pc[i], M4.rotX(LA('pod', i) * 1.75, T2), M.pc[i]);
    }
    const tc = UD.turbine.c;
    M4.mul(M.hull, M4.trans(tc[0], tc[1], tc[2], T), M.core);
    M4.mul(M.core, M4.rotY(L('fan'), T2), M.fan);
  }

  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.wp3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt, out = {}) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    out.x = ax; out.y = ay; out.ang = Math.atan2(b[1] - ay, b[0] - ax);
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
    if (kind === 'rear') return this._scr(this.M.rg[i], 0, 0, 8);
    if (kind === 'side') return this._scr(this.M.sg[i], 0, 2, 10);
    if (kind === 'pod') return this._scr(this.M.pd[i], 0, 4, 0);
    return this._scr(this.M.core, 0, -4, 0);
  }

  partDestroyed(kind, i) {
    const w = this.w, R = w.fxRng;
    this.dead[kind][i] = true;
    const p = this._mountPt(kind, i), x = p[0], y = p[1];
    const big = kind === 'turbine' ? 1.8 : 1.25;
    w.explosions.blast(x, y, big, [1, 0.4, 0.3]);
    w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-16, 16), y + R.range(-12, 12), 0.9, [1, 0.35, 0.25]));
    w.explosions.sparks(x, y, 30, [1, 0.6, 0.4], 6, 32, 4);
    w.g.camera.addTrauma(kind === 'turbine' ? 0.55 : 0.32);
    w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35);
    this._shards(x, y, 12);
    sfx.play('partDown', { pan: (x - W / 2) / W });
    if (kind === 'turbine') {
      sfx.play('engineFail', { pan: 0 });
      if (this.tb && this.tb.phase !== 'cool') { this.tb.phase = 'cool'; this.tb.t = 0; if (this.tb.laser) this.tb.laser.dead = true; }
      if (this.rep && this.rep.phase === 'repair') this._repairFail();
    }
    if (kind === 'side') { this.depT[i] = 0; this.sideAim[i] = null; }
    if (kind === 'pod') this.podT[i] = 0;
    if (kind === 'rear') this.rearAim[i] = null;
    this.fires.push({ kind, i, s: kind === 'turbine' ? 1.1 : 0.7 });
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

  /** Contact: the car's projected footprint is solid (only while fighting). */
  _contact() {
    const c = this.c, p = this.w.player;
    if (c.state !== 'fight') { this.quad = null; return; }
    const q = [];
    for (const [lx, ly] of [[-86, -156], [86, -156], [86, 170], [-86, 170]]) { const a = this._scr(this.M.world, lx, ly, 24); q.push(a[0], a[1]); }
    this.quad = q;
    if (p && p.collidable && !p.invulnerable && inQuad(q, p.x, p.y, -4)) p.hit();
  }

  // ---------------------------------------------------------- heavy queue

  _canHeavy(name) {
    if (this.c.state !== 'fight' || this.rep) return false;
    if (this.heavy) { if (!this.queue && this.heavy !== name) this.queue = name; return false; }
    return true;
  }

  _heavyDone(name) { if (this.heavy === name) this.heavy = null; }

  _runQueue() {
    if (!this.queue || this.heavy || this.c.state !== 'fight' || this.rep) return;
    const q = this.queue;
    this.queue = null;
    if (q === 'sidewinder') this.startSidewinder();
    else if (q === 'missiles') this.startMissiles();
    else if (q === 'drift') this.startDrift();
    else if (q === 'roadblock') this.startRoadblock();
    else if (q === 'turbine') this.startTurbine();
    else if (q === 'suppress') this.startSuppression();
  }

  /** Light fire pauses while the turbine discharges and during the repair. */
  get quiet() { return !!(this.tb && (this.tb.phase === 'aim' || this.tb.phase === 'fire')) || !!this.rep; }

  // ------------------------------------------- 1. REAR PURSUIT BARRAGE

  /** Twin rear cannons: alternating aimed streams with a drifting sweep, an expanding wide fan every third cycle. */
  rearBarrage(t, rate = 1) {
    const c = this.c, w = this.w;
    if (c.state !== 'fight' || this.quiet || this.su) return;
    const r = rate * this.rate, K = Math.round(230 / r), ph = t % K, cyc = Math.floor(t / K);
    if (ph > 110) return;
    const sweep = (cyc & 1 ? 1 : -1) * (-0.35 + (ph / 110) * 0.7);
    for (let i = 0; i < 2; i++) {
      if (this.dead.rear[i]) continue;
      // Each gun leads its own line either side of the pilot; the sweep pushes the gap across.
      const tx = clamp(w.aimX + (i ? 1 : -1) * 34 + sweep * 120, 20, W - 20);
      this.rearAim[i] = this._world(tx, w.aimY, UD.rearGuns[i][2], [0, 0, 0]);
      const every = Math.max(4, Math.round(9 / r));
      if ((ph + i * (every >> 1)) % every === 0) this._rearShot(i, SPEC.bar);
    }
    if (cyc % 3 === 2 && ph === 60) for (let i = 0; i < 2; i++) if (!this.dead.rear[i]) this._rearShot(i, SPEC.barWide, true);
    if (ph === 110) this.rearAim[0] = this.rearAim[1] = null;
  }

  _rearShot(i, spec, big = false) {
    const j = (this.alt[i] ^= 1), m = this.M.rb[i * 2 + j];
    const mz = this._muzzle(m, UD.rearMuzzle, this.mzO || (this.mzO = {}));
    P.fan(this.w, mz.x, mz.y, mz.ang, spec);
    this.s.rc[i * 2 + j] = 1;
    this.heat[i] = Math.min(1, this.heat[i] + (big ? 0.6 : 0.25));
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: big ? 10 : 6, kind: big ? 'cannon' : 'rear', w: M4.point(m, 0, UD.rearMuzzle[1] + 4, 0, [0, 0, 0]) });
    if (this.is3D && (big || this.w.fxRng.chance(0.35))) { const q = M4.point(m, 0, UD.rearMuzzle[1], 0, [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.3, 0.45, 0.5); }
    sfx.play(big ? 'heavyCannon' : 'autoCannon', { pan: (mz.x - W / 2) / W });
  }

  // ------------------------------------------- 2. SIDEWINDER CROSSFIRE

  startSidewinder(volleys = 0) {
    if (this.dead.side[0] && this.dead.side[1]) return false;
    if (!this._canHeavy('sidewinder')) return false;
    this.heavy = 'sidewinder';
    this.sw = { phase: 'deploy', t: 0, v: 0, n: volleys || (3 + (this.c.mk >= 2 ? 1 : 0)) };
    this.depT[0] = this.depT[1] = 1;
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateSidewinder() {
    const f = this.sw, c = this.c, w = this.w;
    if (!f) return;
    if (c.state !== 'fight' || (this.dead.side[0] && this.dead.side[1]) || this.rep) { this._endSidewinder(); return; }
    f.t++;
    if (f.phase === 'deploy') {
      // Aim lines along each barrel while the guns rise.
      if (f.t > 12 && f.t % 2 === 0) for (let i = 0; i < 2; i++) if (!this.dead.side[i]) { const mz = this._muzzle(this.M.sr[i], UD.sideMuzzle); this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 500, t: 0, life: 3, k: f.t / 40, col: [2.2, 0.4, 0.9] }); }
      if (f.t >= 40) { f.phase = 'fire'; f.t = 0; this._volleyStart(); }
    } else if (f.phase === 'fire') {
      const T = 78, u = f.t / T;
      // Each gun sweeps from outward-back across to the far lane: the two streams cross.
      for (let i = 0; i < 2; i++) {
        if (this.dead.side[i]) continue;
        const rest = UD.sideRest[i], dir = i ? 1 : -1;
        const k = (f.v + i) & 1 ? u : 1 - u;
        this.sideAim[i] = rest + dir * (-0.55 + 1.1 * k) * -1;
        const every = Math.max(3, Math.round(5 / this.rate));
        if ((f.t + i * 2) % every === 0) this._sideShot(i, f.t % (every * 3) === 0 ? SPEC.sideB : SPEC.side);
      }
      if (f.t >= T) { f.phase = 'gap'; f.t = 0; }
    } else if (f.phase === 'gap') {
      this.sideAim[0] = this.sideAim[1] = null;
      if (f.t >= 34) {
        f.v++;
        if (f.v >= f.n) { f.phase = 'retract'; f.t = 0; this.depT[0] = this.depT[1] = 0; }
        else { f.phase = 'fire'; f.t = 0; this._volleyStart(); }
      }
    } else if (f.phase === 'retract') { if (f.t >= 40) this._endSidewinder(); }
  }

  /** Each volley starts with a lane change (by steering): the crossfire geometry shifts with the car. */
  _volleyStart() {
    if (!isSplit(this.s.y + 300)) this.lane = clamp(-sgn(this.lane || this.w.rng.sign()) * this.w.rng.range(30, ROAD.carRange), -ROAD.carRange, ROAD.carRange);
    sfx.play('rotaryCannon', { pan: 0 });
  }

  _sideShot(i, spec) {
    const mz = this._muzzle(this.M.sr[i], UD.sideMuzzle, this.mzS || (this.mzS = {}));
    P.fan(this.w, mz.x, mz.y, mz.ang, spec);
    this.heat[i + 2] = Math.min(1, this.heat[i + 2] + 0.18);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 4, kind: 'rotary', w: M4.point(this.M.sr[i], 0, UD.sideMuzzle[1], 0, [0, 0, 0]) });
    if (this.t % 6 === 0) sfx.play('rotaryCannon', { pan: (mz.x - W / 2) / W });
  }

  _endSidewinder() {
    this.sw = null; this.sideAim[0] = this.sideAim[1] = null;
    if (!this.dr && !this.su) this.depT[0] = this.depT[1] = 0;
    this._heavyDone('sidewinder');
  }

  // ------------------------------------------- 3. MISSILE PURSUIT

  startMissiles(n = 0) {
    if (this.dead.pod[0] && this.dead.pod[1]) return false;
    if (!this._canHeavy('missiles')) return false;
    this.heavy = 'missiles';
    this.ms = { phase: 'open', t: 0, k: 0, n: n || (6 + 2 * (this.c.mk - 1)) };
    this.podT[0] = this.podT[1] = 1;
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateMissiles() {
    const f = this.ms, c = this.c;
    if (!f) return;
    if (c.state !== 'fight' || (this.dead.pod[0] && this.dead.pod[1]) || this.rep) { this._endMissiles(); return; }
    f.t++;
    if (f.phase === 'open') { if (f.t >= 28) { f.phase = 'fire'; f.t = 0; } }
    else if (f.phase === 'fire') {
      const gap = Math.max(12, Math.round(22 / this.rate));
      if (f.t % gap === 1 && f.k < f.n) {
        // Staggered pairs: one from each pod, tubes in turn.
        for (let i = 0; i < 2; i++) if (!this.dead.pod[i]) this._launch(i, (f.k + i * 3) % 6, i * 4);
        f.k++;
      }
      if (f.k >= f.n && f.t > f.n * gap + 30) { f.phase = 'close'; f.t = 0; this.podT[0] = this.podT[1] = 0; }
    } else if (f.phase === 'close') { if (f.t >= 30) this._endMissiles(); }
  }

  _launch(i, tube, delay = 0) {
    const w = this.w;
    const go = () => {
      if (this.dead.pod[i] || this.c.state !== 'fight') return;
      const tb = UD.podTubes[tube], m = this.M.pd[i];
      const mz = this._muzzle(m, [tb[0], UD.podMuzzle, tb[2]]);
      // Guidance is limited (turn rate + duration): a sidestep beats it. It bursts late in its flight.
      const ref = { ...MSPLIT, _ud: ++this.mid };
      const spec = { shape: 'kunai', color: 'pink', n: 1, speed: 1.1, accel: 0.045, maxSpd: 3.3, homing: 0.021, homingTime: 72, split: ref, splitAt: 150, fixed: true };
      P.shoot(w, mz.x, mz.y, mz.ang, spec.speed, spec);
      this.missiles.push({ ref, x: mz.x, y: mz.y, trail: [], life: 0, alive: true });
      this.reticles.push({ x: w.aimX, y: w.aimY, t: 0, life: 46 });
      this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 8, kind: 'launch', w: M4.point(m, tb[0], UD.podMuzzle, tb[2], [0, 0, 0]) });
      if (this.is3D) { const q = M4.point(m, tb[0], UD.podMuzzle + 2, tb[2], [0, 0, 0]); for (let k = 0; k < 3; k++) this.view.fx._smoke(q[0], q[1], q[2], 0.45, 0.35, 0.8); }
      sfx.play('rocketLaunch', { pan: (mz.x - W / 2) / W });
    };
    if (delay) w.explosions.schedule(delay, go); else go();
  }

  /** Follow our missile bullets (by their split spec) for smoke trails and exhaust. */
  _trackMissiles() {
    if (!this.missiles.length) return;
    const B = this.w.bullets;
    const live = new Map();
    for (let i = 0; i < B.count; i++) { const r = B.ref[i]; if (r && r._ud) live.set(r, i); }
    for (let k = this.missiles.length - 1; k >= 0; k--) {
      const m = this.missiles[k];
      const i = live.get(m.ref);
      if (i === undefined) { m.alive = false; m.trail.shift(); m.trail.shift(); if (!m.trail.length) this.missiles.splice(k, 1); continue; }
      m.x = B.x[i]; m.y = B.y[i]; m.ang = B.ang[i]; m.life++;
      if (this.t % 2 === 0) { m.trail.push(m.x, m.y); if (m.trail.length > 36) m.trail.splice(0, 2); }
      if (this.is3D && this.t % 3 === 0) { const q = this._world(m.x, m.y, 30, this.q3); this.view.fx._smoke(q[0], q[1], q[2], 0.22, 0.25, 0.3); }
    }
  }

  _endMissiles() { this.ms = null; this.podT[0] = this.podT[1] = 0; this._heavyDone('missiles'); }

  // ------------------------------------------- 4. APEX DRIFT BARRAGE

  startDrift() {
    if (isSplit(this.s.y + 250) || forkAt(this.s.y + 400) || this.cornerDrift) return false;
    if (!this._canHeavy('drift')) return false;
    this.heavy = 'drift';
    const bend = nextBend(this.s.y);
    // Across the road from the side it is on (or into a bend that is coming up).
    let dir = Math.abs(this.lane) > 15 ? -sgn(this.lane) : bend && bend.y - this.s.y < 500 ? bend.turn : this.w.rng.sign();
    this.dr = { phase: 'tele', t: 0, dir, beta: 0 };
    this.chevrons = { dir, t: 0 };
    sfx.play('engineRoar', { pan: dir * 0.3, v: 1 });
    return true;
  }

  _updateDrift() {
    const d = this.dr, c = this.c, w = this.w;
    if (!d) return;
    if (c.state !== 'fight' || this.rep) { this._endDrift(); return; }
    d.t++;
    if (d.phase === 'tele') {
      if (this.chevrons) this.chevrons.t = d.t;
      this.depT[0] = this.depT[1] = 1;
      if (d.t >= 40) { d.phase = 'entry'; d.t = 0; this.lane = d.dir * ROAD.carRange; sfx.play('tireScreech', { pan: d.dir * 0.4, v: 1 }); }
    } else if (d.phase === 'entry') {
      d.beta = d.dir * 0.56 * Math.min(1, d.t / 12);
      if (d.t >= 14) { d.phase = 'slide'; d.t = 0; this.chevrons = null; }
    } else if (d.phase === 'slide') {
      d.beta = d.dir * (0.56 + Math.sin(d.t * 0.21) * 0.06);
      // The gun on the outside of the arc fires outward as the body swings; the rear guns spray along the arc.
      const out = d.dir > 0 ? 0 : 1, inn = 1 - out;
      const every = Math.max(3, Math.round(4 / this.rate));
      if (!this.dead.side[out] && d.t % every === 0) this._sideShot(out, SPEC.drift);
      if (!this.dead.side[inn] && d.t % (every * 3) === 0) this._sideShot(inn, SPEC.driftOrb);
      if (d.t % Math.max(8, Math.round(12 / this.rate)) === 0) for (let i = 0; i < 2; i++) if (!this.dead.rear[i]) { this.rearAim[i] = null; this._rearShot(i, SPEC.driftOrb); }
      w.g.camera.addTrauma(0.015);
      if (d.t >= 66) { d.phase = 'recover'; d.t = 0; }
    } else if (d.phase === 'recover') {
      d.beta = d.t < 12 ? -d.dir * 0.08 : 0;
      if (d.t >= 28) this._endDrift();
    }
  }

  _endDrift() {
    this.dr = null; this.chevrons = null;
    if (!this.sw && !this.su) this.depT[0] = this.depT[1] = 0;
    this._heavyDone('drift');
  }

  // ------------------------------------------- 5. ROADBLOCK BREAKER

  startRoadblock() {
    const s = this.s, yb = s.y + 760;
    if (isSplit(yb) || forkAt(yb - 200) || forkAt(yb + 200) || Math.abs(yb - Math.round((yb - 256) / 512) * 512 - 256) < 70) return false;
    if (!this._canHeavy('roadblock')) return false;
    this.heavy = 'roadblock';
    const R = this.w.rng, cx = roadX(yb) + this.lane, pieces = [];
    // A line of jersey barriers across the car's path, burnt hulks wedged in.
    const n = 9;
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * 23 + R.range(-2, 2);
      if (Math.abs(x - roadX(yb)) > envelope(yb) - 6) continue;
      pieces.push({ mesh: 'ud.barrier', x, y: yb + R.range(-3, 3), z: 0, rot: R.range(-0.08, 0.08), sx: 22, sy: 1.8, sz: 1.8, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, ax: 0, ay: 0, az: 0, rest: true, static: true });
    }
    for (const dx of [-62, 50]) pieces.push({ mesh: 'ud.hulk', x: cx + dx + R.range(-8, 8), y: yb + R.range(10, 20), z: 0, rot: Math.PI / 2 + R.range(-0.4, 0.4), sx: 1.7, sy: 1.7, sz: 1.7, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, ax: 0, ay: 0, az: 0, rest: true, static: true });
    this.block = { y: yb, x: cx, pieces, hit: false };
    for (const p of pieces) this.debris.push(p);
    this.rb = { phase: 'brake', t: 0 };
    this.c._emit && this.c._emit('bossCallout', { text: 'ROADBLOCK AHEAD', cls: 'red' });
    return true;
  }

  _updateRoadblock() {
    const r = this.rb, c = this.c, w = this.w, s = this.s;
    if (!r) return;
    if (c.state !== 'fight' || this.rep) { if (r.phase !== 'done') { this.rb = null; this._heavyDone('roadblock'); } else this.rb = null; return; }
    r.t++;
    const b = this.block;
    const nose = s.y + UD.length[1] * Math.cos(this.th);
    if (r.phase === 'brake') {
      // Brakes on: it drops back so the barrier line scrolls into view ahead of it.
      this.rowT = HOME_ROW + 112;
      if (r.t === 1) sfx.play('tireScreech', { pan: 0, v: 0.8 });
      if (b.y - nose < 175 || r.t > 190) {
        r.phase = 'charge'; r.t = 0;
        // Telegraph the debris lanes below the car before it hits.
        const bx = this._scr(this.M.world, 0, 0, 0)[0];
        for (const dx of [-70, 0, 70]) c.kit.hazard({ type: 'lane', x: clamp(bx + dx, 30, W - 30), w: 46, warn: 44, fire: 50, lethal: false, color: [1, 0.55, 0.2], y0: HOME_ROW + 60 });
        sfx.play('engineRoar', { pan: 0, v: 1 });
      }
    } else if (r.phase === 'charge') {
      this.rowT = HOME_ROW + 36;
      if (nose >= b.y - 6) this._smash();
      if (r.t > 120) { r.phase = 'done'; this._heavyDone('roadblock'); }
    } else if (r.phase === 'recover') {
      this.rowT = HOME_ROW;
      if (r.t > 60) { r.phase = 'done'; this._heavyDone('roadblock'); }
    }
  }

  /** The car hits the roadblock: barriers and hulks fly, debris rains back toward the pilot. */
  _smash() {
    const w = this.w, b = this.block, R = w.fxRng, s = this.s;
    if (!b || b.hit) return;
    b.hit = true;
    this.rb.phase = 'recover'; this.rb.t = 0;
    const imp = this._scr(this.M.world, 0, UD.length[1], 12), ix = imp[0], iy = imp[1];
    for (const p of b.pieces) {
      p.static = false; p.rest = false;
      const dx = p.x - s.x, side = sgn(dx);
      const hitCar = Math.abs(dx) < 100;
      p.vx = side * R.range(0.8, 3.2) + (hitCar ? side * 1.2 : 0);
      p.vy = this.v * (hitCar ? R.range(0.75, 1.15) : R.range(0.2, 0.6));
      p.vz = hitCar ? R.range(2.5, 5.2) : R.range(0.8, 2);
      p.wx = R.range(-0.15, 0.15); p.wy = R.range(-0.2, 0.2); p.wz = R.range(-0.1, 0.1);
      p.life = 0; p.emit = hitCar && R.chance(0.5);
    }
    // Chunks broken off the barriers, a fireball where the nose hits.
    w.explosions.blast(ix, iy, 1.3, [1, 0.6, 0.3]);
    for (let k = 0; k < 24; k++) this.debris.push({ mesh: 'ud.chunk', x: s.x + R.range(-80, 80), y: b.y + R.range(-6, 6), z: R.range(2, 10), rot: R.angle(), sx: R.range(4, 9), sy: R.range(4, 8), sz: R.range(3, 7), vx: R.range(-3, 3), vy: this.v * R.range(0.5, 1.1), vz: R.range(1.5, 4.5), wx: R.range(-0.3, 0.3), wy: R.range(-0.3, 0.3), wz: R.range(-0.3, 0.3), ax: 0, ay: 0, az: 0, life: 0 });
    // Debris thrown back down the road (bullets: the 3D pieces are cosmetic).
    for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 + w.rng.range(-0.75, 0.75);
      P.shoot(w, ix + w.rng.range(-40, 40), iy, a, SPEC.deb.speed + w.rng.range(-0.3, 0.4), SPEC.deb);
    }
    for (let k = 0; k < 14; k++) P.shoot(w, ix + w.rng.range(-60, 60), iy + w.rng.range(-8, 8), Math.PI / 2 + w.rng.range(-0.9, 0.9), SPEC.debR.speed + w.rng.range(-0.6, 0.6), SPEC.debR);
    w.g.camera.addTrauma(0.55);
    w.g.renderer.post.shockwave(ix, iy, 0.035, 0.02, 0.45);
    w.explosions.sparks(ix, iy, 40, [1, 0.75, 0.4], 7, 30, 4);
    this._shards(ix, iy, 16, [0.62, 0.6, 0.56]);
    this.bump += 4; this.s.pitch -= 0.03;
    if (this.is3D) {
      const fx = this.view.fx;
      fx.dust(s.x, b.y, 2, 1.8, this.view.dustCol || [0.5, 0.46, 0.4], 9);
      for (let k = 0; k < 10; k++) fx._spark(s.x + R.range(-60, 60), b.y, 6, 3);
    }
    sfx.play('barrierCrash', { pan: (ix - W / 2) / W });
  }

  /** Loose 3D debris: flies, tumbles, bounces once and settles on the road. */
  _updateDebris() {
    const w = this.w, cy = this.cam.cy || 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      if (p.y < cy - 1000) { this.debris.splice(i, 1); continue; }
      if (p.static || p.rest) continue;
      p.life = (p.life || 0) + 1;
      p.vz -= 0.22; p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.ax += p.wx; p.ay += p.wy; p.az += p.wz;
      if (p.z <= 0) {
        p.z = 0;
        if (p.vz < -2.2) {
          p.vz *= -0.32; p.vx *= 0.6; p.vy *= 0.5; p.wx *= 0.5; p.wy *= 0.5;
          if (this.is3D) this.view.fx.dust(p.x, p.y, 1, 0.5, this.view.dustCol || [0.5, 0.46, 0.4], 2);
          // A heavy piece landing in view throws a few fragments (secondary hazard).
          if (p.emit && this.c.state === 'fight') {
            p.emit = false;
            const q = this.cam.project(p.x, p.y, 4, this.pr);
            if (q[1] > 0 && q[1] < H) P.ring(w, q[0], q[1], SPEC.debRing, w.rng.angle());
          }
        } else { p.rest = true; p.vz = 0; p.ax = Math.round(p.ax / (Math.PI / 2)) * (Math.PI / 2); p.ay = Math.round(p.ay / (Math.PI / 2)) * (Math.PI / 2); }
      }
    }
  }

  // ------------------------------------------- 6. TURBINE DISCHARGE

  startTurbine() {
    if (!this._canHeavy('turbine')) return false;
    this.heavy = 'turbine';
    this.tb = { phase: 'spool', t: 0, laser: null };
    sfx.play('turbineCharge', { pan: 0 });
    return true;
  }

  _updateTurbine() {
    const d = this.tb, c = this.c, w = this.w, R = w.fxRng;
    if (!d) return;
    if (c.state !== 'fight' || this.rep) { if (d.laser) d.laser.dead = true; this.tb = null; this._heavyDone('turbine'); return; }
    d.t++;
    const tc = this._scr(this.M.core, 0, -8, 0), tx = tc[0], ty = tc[1];
    if (!this.turbineOK && d.phase !== 'cool') {
      // No emitter: a weak vent from the thrusters instead (ring, no beam).
      if (d.t === 30) { P.ring(w, tx, ty, SPEC.vent, w.rng.angle()); this.flashes.push({ x: tx, y: ty, ang: 0, t: 0, life: 14, kind: 'vent' }); sfx.play('turboBlast', { pan: 0 }); }
      if (d.t > 60) { d.phase = 'cool'; d.t = 0; }
      return;
    }
    if (d.phase === 'spool') {
      this.fanT = 0.2 + (d.t / 80) * 1.3; this.glowT = 0.6 + (d.t / 80) * 2.6;
      // Energy drawn into the turbine.
      if (d.t % 2 === 0) {
        const a = R.angle(), r = R.range(40, 80), H2 = w.fxHigh;
        const j = H2.spawn(w.F.spark, tx + Math.cos(a) * r, ty + Math.sin(a) * r, -Math.cos(a) * r / 10, -Math.sin(a) * r / 10, 10);
        if (j >= 0) { H2.size(j, 6, 1.6); if (d.t % 4) H2.color(j, 0.4, 1.6, 2.4, 0.1, 0.5, 1); else H2.color(j, 2.4, 0.4, 0.6, 1, 0.1, 0.2); H2.look(j, 1, 1, FADE_OUT, 0.6); }
      }
      w.g.camera.addTrauma(0.006 + d.t * 0.0002);
      if (d.t >= 80) {
        d.phase = 'aim'; d.t = 0;
        d.laser = w.enemyLaser(c.e, w.aimAngle(tx, ty), { warn: 40, fire: 34, width: 34, len: 900, track: true, rgb: [1, 0.3, 0.6], ox: tx - c.e.x, oy: ty - c.e.y });
      }
    } else if (d.phase === 'aim' || d.phase === 'fire') {
      if (d.laser) { d.laser.ox = tx - c.e.x; d.laser.oy = ty - c.e.y; }
      if (d.phase === 'aim' && d.t >= 40) {
        d.phase = 'fire'; d.t = 0;
        w.g.renderer.post.flash(1, 0.4, 0.75, 0.45, 0.04);
        w.g.renderer.post.shockwave(tx, ty, 0.05, 0.02, 0.7);
        w.g.camera.addTrauma(0.6);
        P.ring(w, tx, ty, SPEC.turbRing, w.rng.angle());
        if (c.mk >= 2 || c.intensity > 1) P.ring(w, tx, ty, SPEC.turbRice, w.rng.angle());
        this.flashes.push({ x: tx, y: ty, ang: d.laser ? d.laser.ang : Math.PI / 2, t: 0, life: 30, kind: 'turbine', w: M4.point(this.M.core, 0, -20, 0, [0, 0, 0]) });
        this.bump += 3;
        sfx.play('turbineDischarge', { pan: 0 });
      }
      if (d.phase === 'fire') { this.glowT = 3.2; if (d.t >= 36) { d.phase = 'cool'; d.t = 0; this._steam(1.2); sfx.play('steamVent', { pan: 0 }); } }
    } else if (d.phase === 'cool') {
      this.fanT = 0.1; this.glowT = 0.3;
      if (this.is3D && d.t % 5 === 0) this._steam(0.6);
      if (d.t >= 70) { this.tb = null; this._heavyDone('turbine'); }
    }
  }

  // ------------------------------------------- 7. FULL-LANE SUPPRESSION

  startSuppression(waves = 0) {
    if (this.dead.rear[0] && this.dead.rear[1] && this.dead.side[0] && this.dead.side[1]) return false;
    if (!this._canHeavy('suppress')) return false;
    this.heavy = 'suppress';
    const gap = this.w.rng.int(1, 4);
    this.su = { phase: 'warn', t: 0, v: 0, n: waves || (4 + (this.c.mk >= 2 ? 1 : 0)), gap, dir: this.w.rng.sign() };
    this.depT[0] = this.depT[1] = 1;
    this._supLanes();
    return true;
  }

  /** Six screen lanes; each wave covers all but a two-lane gap that walks across. */
  _supLanes() {
    const f = this.su, LW = W / 6;
    f.cover = [];
    for (let k = 0; k < 6; k++) if (k !== f.gap && k !== f.gap + 1) f.cover.push(LW * (k + 0.5));
    for (const x of f.cover) this.c.kit.hazard({ type: 'lane', x, w: LW - 10, warn: 34, fire: 46, lethal: false, color: [1, 0.25, 0.45], y0: HOME_ROW + 70 });
  }

  _updateSuppression() {
    const f = this.su, c = this.c, w = this.w;
    if (!f) return;
    if (c.state !== 'fight' || this.rep) { this._endSuppression(); return; }
    f.t++;
    if (f.phase === 'warn') {
      if (f.t >= 34) { f.phase = 'fire'; f.t = 0; }
    } else if (f.phase === 'fire') {
      const dens = 1 + f.v * 0.18;
      const every = Math.max(2, Math.round(6 / (this.rate * dens)));
      if (f.t % every === 0) {
        // Rear guns take the inner lanes, side guns the outer ones; every barrel fires at its lane's foot.
        for (const x of f.cover) {
          const outer = x < W * 0.25 || x > W * 0.75;
          const i = x < W / 2 ? 0 : 1;
          if (outer && !this.dead.side[i]) { this.sideAim[i] = this._yawTo(UD.sideGuns[i], this._world(x, H - 20, UD.sideGuns[i][2], [0, 0, 0])); this._sideShot(i, SPEC.supSide); }
          else if (!this.dead.rear[i]) {
            this.rearAim[i] = this._world(x, H - 20, UD.rearGuns[i][2], [0, 0, 0]);
            const j = (this.alt[i] ^= 1), m = this.M.rb[i * 2 + j];
            const mz = this._muzzle(m, UD.rearMuzzle, this.mzO || (this.mzO = {}));
            P.shoot(w, mz.x, mz.y, Math.atan2(H - mz.y, x - mz.x), SPEC.sup.speed, SPEC.sup);
            this.s.rc[i * 2 + j] = 1; this.heat[i] = Math.min(1, this.heat[i] + 0.1);
            if (f.t % (every * 2) === 0) this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 4, kind: 'rear', w: M4.point(m, 0, UD.rearMuzzle[1], 0, [0, 0, 0]) });
          }
        }
        if (f.t % (every * 4) === 0) sfx.play('autoCannon', { pan: 0 });
      }
      // Midway through the volley the car changes lane: the weapon origins move with it.
      if (f.t === 20 && !isSplit(this.s.y + 300)) this.lane = clamp(-this.lane || f.dir * ROAD.carRange, -ROAD.carRange, ROAD.carRange);
      if (f.t >= 46) {
        f.phase = 'gap'; f.t = 0;
        this.rearAim[0] = this.rearAim[1] = null; this.sideAim[0] = this.sideAim[1] = null;
      }
    } else if (f.phase === 'gap') {
      if (f.t >= 30) {
        f.v++;
        if (f.v >= f.n) { this._endSuppression(); return; }
        f.gap = clamp(f.gap + f.dir, 0, 4);
        if (f.gap === 0 || f.gap === 4) f.dir = -f.dir;
        this._supLanes();
        f.phase = 'warn'; f.t = 0;
      }
    }
  }

  _endSuppression() {
    this.su = null;
    this.rearAim[0] = this.rearAim[1] = null; this.sideAim[0] = this.sideAim[1] = null;
    if (!this.sw && !this.dr) this.depT[0] = this.depT[1] = 0;
    this._heavyDone('suppress');
  }

  // ------------------------------------------- 8. TURBO REPAIR OVERDRIVE

  _phaseFrac() {
    const c = this.c;
    if (!c.floors || !c.phase) return 1;
    return (c.e.hp - c.floors[c.index]) / Math.max(1, c.phase.hp);
  }

  /** Low HP in the last phase: the emergency turbo-repair (limited, real HP). */
  _repairCheck() {
    const c = this.c;
    if (c.state !== 'fight' || this.rep || !c.phase || !c.phase.overdrive) return;
    if (this.repPhase !== c.index) { this.repPhase = c.index; this.repairs = 0; this.repCd = 0; }
    if (this.repCd > 0) { this.repCd--; return; }
    const max = c.phase.desperation ? 1 : (c.phase.repairs ?? 1);
    if (this.repairs >= max || this._phaseFrac() > (c.phase.repairAt ?? 0.4)) return;
    this.repairs++;
    this._endAttacks(true);
    this.rep = { phase: 'warn', t: 0, healed: 0, swerve: this.w.rng.sign(), total: Math.round(c.phase.hp * (c.phase.repairHeal ?? 0.3) * (this.turbineOK ? 1 : 0.5)) };
    if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'TURBO REPAIR', desperation: true, boss: c.name });
    c._emit && c._emit('bossCallout', { text: 'TURBO REPAIR — HIT IT NOW', cls: 'red' });
    this.w.g.renderer.post.flash(0.3, 0.9, 1, 0.3, 0.04);
    sfx.play('turboSpool', { pan: 0 });
  }

  _updateRepair() {
    const r = this.rep, c = this.c, w = this.w, R = w.fxRng;
    if (!r) return;
    if (c.state !== 'fight') { this.rep = null; return; }
    r.t++;
    if (r.phase === 'warn') {
      this.rowT = HOME_ROW;
      if (r.t >= 50) {
        r.phase = 'boost'; r.t = 0;
        this.lane = isSplit(this.s.y + 300) ? this.lane : -sgn(this.lane || 1) * ROAD.carRange;
        w.g.camera.addTrauma(0.45);
        w.g.renderer.post.aberrate && w.g.renderer.post.aberrate(0.015);
        sfx.play('turboBlast', { pan: 0 });
      }
    } else if (r.phase === 'boost') {
      this.rowT = 124;
      if (r.t >= 90) { r.phase = 'repair'; r.t = 0; sfx.play('repairHum', { pan: 0 }); }
    } else if (r.phase === 'repair') {
      this.rowT = 134 + Math.sin(r.t * 0.04) * 8;
      // Real healing: HP climbs back toward the phase's top, a little each step.
      const T = 150, step = r.total / T, room = c.floors[c.index] + c.phase.hp - c.e.hp;
      const add = Math.max(0, Math.min(step, room, r.total - r.healed));
      c.e.hp += add; r.healed += add;
      if (r.t % 4 === 0) {
        // Repair arcs crawl across the bodywork.
        const a = this._scr(this.M.hull, R.range(-70, 70), R.range(-140, 150), R.range(36, 66)).slice(), b = this._scr(this.M.hull, R.range(-70, 70), R.range(-140, 150), R.range(36, 66));
        this.arcs.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], t: 0, life: 8, seed: R.next() });
      }
      if (r.t % 30 === 0) sfx.play('repairHum', { pan: 0 });
      if (r.t >= T || r.healed >= r.total - 0.5) { r.phase = 'return'; r.t = 0; }
    } else if (r.phase === 'return') {
      this.rowT = HOME_ROW;
      if (r.t >= 70) {
        this.rep = null; this.repCd = 600;
        this.empower = 600;
        if (!this.critical) {
          this.critical = true; this.odT = 0;
          if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'CRITICAL PURSUIT', desperation: true, boss: c.name });
          w.g.camera.addTrauma(0.3);
        }
      }
    }
  }

  /** The emitter died mid-repair: the repair stops where it is. */
  _repairFail() {
    const r = this.rep;
    if (!r) return;
    r.phase = 'return'; r.t = 0;
    this.c._emit && this.c._emit('bossCallout', { text: 'REPAIR INTERRUPTED', cls: 'gold' });
    const q = this._scr(this.M.core, 0, 0, 0);
    this.w.explosions.sparks(q[0], q[1], 40, [0.4, 1, 1.4], 6, 30, 4);
  }

  // ------------------------------------------- CRITICAL PURSUIT

  /** After the repair: rolling windows, one leading system each, so the field stays readable. */
  overdrive(t) {
    if (!this.critical || this.c.state !== 'fight' || this.rep) return;
    this.odT++;
    const T = this.odT % 760;
    if (T < 170) { this.rearBarrage(t, 1.35); if (T === 30) this.startMissiles(4); }
    else if (T < 330) { if (T === 175) this.startSidewinder(2); this.rearBarrage(t, 0.5); }
    else if (T < 450) { if (T === 335) this.startDrift(); }
    else if (T < 600) { if (T === 455) this.startSuppression(3); }
    else if (T === 605) { if (this.turbineOK) this.startTurbine(); else this.startMissiles(6); }
  }

  // --------------------------------------------------------- lifecycle

  _endAttacks(keepRepair = false) {
    if (this.tb && this.tb.laser) this.tb.laser.dead = true;
    this.sw = null; this.ms = null; this.dr = null; this.su = null; this.tb = null;
    if (this.rb && this.rb.phase !== 'done') this.rb = null;
    if (!keepRepair) this.rep = null;
    this.heavy = null; this.queue = null;
    this.chevrons = null;
    this.depT[0] = this.depT[1] = 0; this.podT[0] = this.podT[1] = 0;
    this.sideAim[0] = this.sideAim[1] = null; this.rearAim[0] = this.rearAim[1] = null;
    this.lines.length = 0;
  }

  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng, s = this.s;
    if (this.deathT < 0) {
      this.deathT = 0; this._endAttacks();
      this.spinDir = this.beta !== 0 ? sgn(this.beta) : w.rng.sign();
      sfx.play('tireScreech', { pan: 0, v: 1 });
    }
    this.deathT++;
    this.rowT = HOME_ROW;
    this.fanT = st < 70 ? 0.6 : 0; this.glowT = st < 70 ? 1.4 + Math.sin(st * 0.8) : 0.05;
    // Mounts cook off while it spins out.
    if (st % 12 === 0 && st < 108) {
      const pick = R.int(0, 6);
      const pt = pick < 2 ? this._scr(this.M.rg[pick], 0, 0, 8) : pick < 4 ? this._scr(this.M.sg[pick - 2], 0, 0, 8) : pick < 6 ? this._scr(this.M.pd[pick - 4], 0, 0, 0) : this._scr(this.M.hull, R.range(-60, 60), R.range(-120, 120), 60);
      w.explosions.blast(pt[0], pt[1], R.range(0.7, 1.15), [1, 0.45, 0.25]);
      if (this.is3D) this._steam(0.5);
    }
    if (st === 70) {
      // Turbine failure: the fan shreds.
      const q = this._scr(this.M.core, 0, -6, 0);
      w.explosions.sparks(q[0], q[1], 50, [1, 0.8, 0.5], 8, 34, 5);
      w.explosions.blast(q[0], q[1], 1.3, [1, 0.5, 0.3]);
      this.dead.turbine[0] = true;
      sfx.play('engineFail', { pan: 0 });
    }
    if (st === 112) {
      const q = this._scr(this.M.hull, 0, -60, 50);
      w.explosions.blast(q[0], q[1], 2.8, [1, 0.45, 0.2]);
      w.g.camera.addTrauma(0.85);
      this.dead.rear[0] = this.dead.rear[1] = this.dead.side[0] = this.dead.side[1] = this.dead.pod[0] = this.dead.pod[1] = true;
      if (this.is3D) {
        const fx = this.view.fx;
        fx.decal('scorch', s.x, s.y, 0.45, 320, R.angle(), 9000);
        for (const [lx, ly, z, sc] of [[0, -110, 60, 1.6], [-50, -40, 50, 1.1], [52, -120, 56, 1.2], [0, 60, 48, 1], [40, 120, 40, 0.8]]) {
          const p = M4.point(this.M.hull, lx, ly, z, [0, 0, 0]);
          fx.addFire(p[0], p[1], p[2], sc, 5400);
        }
      }
      this._shards(q[0], q[1], 20);
    }
    if (st > 112) this.wreck = true;
    if (st === 150 && this.view && this.ctrlCam) { this.view.speedTarget = this.view.baseSpeed; this.ctrlCam = false; this.released = true; }
  }

  // ---------------------------------------------------------- world fx

  _shards(x, y, n, col = [0.5, 0.52, 0.56]) {
    const w = this.w, shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < n; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(45, 75));
      if (j < 0) continue;
      L.size(j, R.range(6, 12)); L.color(j, col[0], col[1], col[2], col[0] * 0.4, col[1] * 0.4, col[2] * 0.4); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
  }

  _steam(sc = 1) {
    if (!this.is3D) return;
    const fx = this.view.fx, R = this.w.fxRng;
    for (const [lx, ly, lz] of [[-36, -114, 54], [36, -114, 54], [0, -150, 62], [-60, -60, 50], [60, -60, 50]]) {
      if (!R.chance(0.6 * sc)) continue;
      const q = M4.point(this.M.hull, lx, ly, lz, [0, 0, 0]);
      fx._steam(q[0], q[1], q[2], 0.8 * sc);
    }
  }

  /** Tyre marks, smoke and sparks at the contact patches; exhaust; burning mounts; damage smoke. */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, s = this.s, M = this.M, c = this.c;
    const P2 = fx.p, F = fx.F;
    const vx = Math.sin(this.th) * this.v, vy = Math.cos(this.th) * this.v;
    const fb = [Math.sin(s.h), Math.cos(s.h)]; // body forward (world)
    const boost = this.rep && this.rep.phase === 'boost', launch = this.rb && this.rb.phase === 'charge';
    const slide = Math.abs(this.beta), dying = c.state === 'dying' && this.deathT < 130;
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k], q = M4.point(M.world, wh.x, wh.y, 0, [0, 0, 0]);
      // Mark intensity: scuff while cruising, darker in turns, black under drift / brake / turbo launch.
      let a = 0.1 + Math.min(0.25, Math.abs(this.v * this.dth) * 6);
      if (!wh.front) a += slide * 1.5 + (boost ? 0.75 : 0) + (launch ? 0.5 : 0) + Math.max(0, this.acc) * 3;
      else a += slide * 0.7;
      a += this.brake * 0.6 + (dying ? 0.8 : 0);
      if (this.wreck || this.v < 0.2) a = 0;
      this.skids.add(k, q[0], q[1], Math.min(1, a));
      // Tyre smoke: light dust at speed, white-grey clouds while sliding, bursts under braking.
      const smoke = (wh.front ? 0.3 : 1) * (slide * 2.2 + (boost ? 0.9 : 0) + this.brake * 0.8 + (dying ? 1 : 0) + (launch ? 0.4 : 0));
      if (smoke > 0.08 && R.chance(Math.min(0.9, smoke * 0.5))) {
        const i = P2.spawn(R.pick(F.dust), q[0] + R.range(-6, 6), q[1] + R.range(-6, 6), 4, vx * 0.35 + R.range(-0.5, 0.5), vy * 0.35 + R.range(-0.5, 0.5), R.range(0.2, 0.6), R.range(50, 90));
        if (i >= 0) { const g = this.dead.turbine[0] && !wh.front ? 0.45 : 0.72; P2.s0[i] = 10; P2.s1[i] = 44 + smoke * 20; P2.r[i] = g; P2.g[i] = g; P2.b[i] = g * 1.02; P2.r1[i] = g * 1.08; P2.g1[i] = g * 1.08; P2.b1[i] = g * 1.1; P2.a[i] = Math.min(0.6, 0.25 + smoke * 0.2); P2.drag[i] = 0.965; P2.fade[i] = 1; P2.rot[i] = R.angle(); P2.grav[i] = -0.01; }
      } else if (this.v > 2 && R.chance(0.05)) fx.dust(q[0], q[1], 1, 0.35, this.view.dustCol || [0.46, 0.43, 0.4], 1);
      // Sparks from the rims / chassis scraping: hard slides, turbo launches, a damaged corner, the defeat spin.
      const dmg = (k === 2 && (this.dead.rear[0] || this.dead.pod[0])) || (k === 3 && (this.dead.rear[1] || this.dead.pod[1]));
      const spk = (wh.front ? 0.4 : 1) * (Math.max(0, slide - 0.25) * 2 + (boost ? 0.6 : 0) + (dying ? 1.2 : 0)) + (dmg && this.v > 2 ? 0.25 : 0) + (this.bump > 2 ? 0.5 : 0);
      if (spk > 0.05 && R.chance(Math.min(1, spk))) {
        for (let n = 0; n < 2; n++) {
          const sp = R.range(1.5, 4);
          const i = P2.spawn(F.spark, q[0] + R.range(-wh.w * 0.4, wh.w * 0.4), q[1] - wh.r * 0.6, R.range(1, 3), vx * 0.55 - fb[0] * sp + R.range(-1, 1), vy * 0.55 - fb[1] * sp, R.range(0.4, 1.8), R.range(14, 26));
          if (i >= 0) { P2.s0[i] = 4.5; P2.s1[i] = 2; P2.r[i] = 2.6; P2.g[i] = 2.0; P2.b[i] = 1.2; P2.r1[i] = 1.8; P2.g1[i] = 0.6; P2.b1[i] = 0.12; P2.add[i] = 1; P2.grav[i] = -0.12; P2.drag[i] = 0.96; P2.rot[i] = Math.PI / 2 + R.range(-0.5, 0.5); }
        }
      }
    }
    // Exhaust: thruster heat shimmer + flame particles; the turbine plume under turbo / discharge.
    const pw = Math.min(1.6, 0.25 + Math.max(0, this.acc) * 8 + (boost ? 1.2 : 0) + (launch ? 0.6 : 0) + (this.critical ? 0.2 : 0));
    if (!this.wreck) {
      for (const e of UD.exhausts) {
        if (!R.chance(0.35 + pw * 0.4)) continue;
        const q = M4.point(M.hull, e[0], e[1] - 8, e[2], [0, 0, 0]), d = M4.dir(M.hull, 0, -1, 0, [0, 0, 0]);
        const sp = R.range(1.5, 3) * (0.6 + pw);
        const i = P2.spawn(fx.F.ember, q[0], q[1], q[2], vx * 0.7 + d[0] * sp, vy * 0.7 + d[1] * sp, R.range(-0.1, 0.2), R.range(8, 16));
        if (i >= 0) { P2.s0[i] = 6 + pw * 4; P2.s1[i] = 2; P2.r[i] = 0.5; P2.g[i] = 1.6; P2.b[i] = 2.4; P2.r1[i] = 1.4; P2.g1[i] = 0.5; P2.b1[i] = 0.3; P2.add[i] = 1; P2.drag[i] = 0.94; P2.fade[i] = 0; }
      }
      // Dark smoke from a failing / damaged drivetrain.
      const frac = c.e.hp / Math.max(1, this._hp0());
      if ((frac < 0.35 || this.dead.turbine[0]) && this.t % (frac < 0.18 ? 4 : 8) === 0) {
        const q = M4.point(M.hull, R.range(-30, 30), -150, 40, [0, 0, 0]);
        fx._smoke(q[0], q[1], q[2], 0.55, 0.9, 0.9);
      }
      if (this.critical && R.chance(0.06)) { const q = M4.point(M.hull, R.range(-70, 70), R.range(-140, 120), 56, [0, 0, 0]); fx._spark(q[0], q[1], q[2], 4); }
    }
    // Broken mounts burn and spark.
    for (const f of this.fires) {
      const q = f.kind === 'rear' ? M4.point(M.rg[f.i], 0, 0, 8, [0, 0, 0]) : f.kind === 'side' ? M4.point(M.sg[f.i], 0, 0, 6, [0, 0, 0]) : f.kind === 'pod' ? M4.point(M.pd[f.i], 0, 0, 0, [0, 0, 0]) : M4.point(M.core, 0, -4, 0, [0, 0, 0]);
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2], f.s, 0.9, 1.1);
      if (R.chance(0.06)) fx._spark(q[0], q[1], q[2], 5);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
    this.skids.trim((this.cam.cy || 0) - 900);
  }

  /** Engine and tyre sound pacing. */
  _sound() {
    if (this.wreck) return;
    const pan = (this.c.e.x - W / 2) / W;
    this.engD += 0.6 + Math.max(0, this.acc) * 30 + (this.rep && this.rep.phase === 'boost' ? 2 : 0);
    if (this.engD > 70) { this.engD = 0; sfx.play('engineRoar', { pan, v: Math.min(1, 0.4 + Math.max(0, this.acc) * 8 + (this.critical ? 0.3 : 0)) }); }
    const slide = Math.abs(this.beta) + this.brake * 0.5;
    if (slide > 0.2) { this.screechD += slide; if (this.screechD > 9) { this.screechD = 0; sfx.play('tireScreech', { pan, v: Math.min(1, slide) }); } }
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
      const q = this.cam.project(s.x, s.y, 0, this.pr);
      if (q[1] > H + 500) { const i = view.extras.indexOf(this); if (i >= 0) view.extras.splice(i, 1); return; }
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('ud', buildUrbanDevastator);
    const cam = view.cam, M = this.M, hdr = !!this.w.g.renderer.post.hdr;
    this._pose(this.c.e.alive ? alpha : 1);
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.75), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    const z0 = view.floorZ || 0;
    // 1) Tyre marks.
    const n = this.skids.build(z0 + 0.5);
    R.trail(cam, this.skids.data, n, hdr, TL.SKID);
    // 2) The car.
    R.begin(cam, view.atmo, light, CAR_LOOK);
    const pl = this._pointLight();
    if (pl) R.pointLight(pl[0], pl[1], pl[2]);
    const dmg = this.wreck ? 1 : Math.min(0.7, (1 - this.c.e.hp / this._hp0()) * 0.85);
    const heat = this.wreck ? 0.03 + 0.02 * Math.sin(this.t * 0.2) : 0;
    // Hit flash kept subtle: glossy black paint washed white under fire reads wrong.
    const fl = this.flash * 0.05, dust = 0;
    const o = { flash: fl, damage: dmg, heat, snow: dust };
    for (const k of ['body', 'fenders', 'spine', 'wing', 'blades']) R.draw(`ud.${k}`, M.hull, o);
    R.draw('ud.canopy', M.hull, { flash: fl, damage: dmg * 0.5, snow: 0 });
    const dyingFl = this.c.state === 'dying' ? ((this.t >> 2) & 1) : 1;
    const tailG = this.wreck ? 0.05 : (0.9 + this.brake * 1.6 + (this.critical ? 0.4 * ((this.t >> 3) & 1) : 0)) * dyingFl * (dmg > 0.5 && (this.t % 37) < 3 ? 0.2 : 1);
    R.draw('ud.tail', M.hull, { glow: tailG, snow: 0 });
    R.draw('ud.head', M.hull, { glow: this.wreck ? 0 : 1.1 * dyingFl, snow: 0 });
    const cy = this.wreck ? 0 : this.tGlow * (this.rep ? 0.9 + 0.3 * Math.sin(this.t * 0.4) : 1);
    R.draw('ud.cyan', M.hull, { glow: cy, snow: 0 });
    R.draw('ud.fan', M.fan, { damage: this.turbineOK ? dmg * 0.4 : 0.9, heat: this.turbineOK ? 0 : 0.15, snow: 0 });
    const pt = this.partEnt.turbine0, tf = pt && pt.alive && pt.flash > 0 ? 0.7 : 0;
    R.draw('ud.core', M.core, { glow: this.turbineOK && !this.wreck ? 0.6 + this.tGlow * 0.8 : 0.04, flash: tf, snow: 0 });
    // Wheels + suspension links (spanned between the body and each hub every frame).
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k];
      R.draw(wh.front ? 'ud.wheelF' : 'ud.wheelR', M.wheel[k], { damage: dmg * 0.3, snow: 0.05 });
      const sx = sgn(wh.x), hubIn = M4.point(M.hub[k], -sx * wh.w * 0.35, 0, 0, [0, 0, 0]);
      for (const [ax, ay, az] of [[sx * 44, wh.y + 10, 22], [sx * 44, wh.y - 10, 12]]) {
        const A = M4.point(M.hull, ax, ay, az, [0, 0, 0]);
        R.draw('ud.link', spanM(A, hubIn, 1, M.span), {});
      }
      const top = M4.point(M.hull, sx * 52, wh.y - 4, 44, [0, 0, 0]), hubTop = M4.point(M.hub[k], -sx * wh.w * 0.3, 0, wh.r * 0.35, [0, 0, 0]);
      R.draw('ud.coil', spanM(hubTop, top, 1.8, M.span), {});
    }
    // Weapons.
    for (let i = 0; i < 2; i++) {
      const pr = this.partEnt[`rear${i}`], ps = this.partEnt[`side${i}`], pp = this.partEnt[`pod${i}`];
      const hf = (pe) => (pe && pe.alive && pe.flash > 0 ? 0.35 : 0), hd = (pe) => (pe && pe.alive && pe.maxHp ? 1 - pe.hp / pe.maxHp : 0);
      if (this.dead.rear[i]) R.draw('ud.rearWreck', M.rg[i], { damage: 1, heat: 0.12 });
      else {
        R.draw('ud.rearGunBase', M.rg[i], { glow: 0.6 + this.heat[i], flash: Math.max(fl, hf(pr)), damage: Math.max(dmg, hd(pr) * 0.8), snow: dust });
        for (let j = 0; j < 2; j++) R.draw('ud.rearBarrel', M.rb[i * 2 + j], { flash: hf(pr) * 0.5, damage: dmg * 0.5, heat: this.heat[i] * 0.3, snow: 0 });
      }
      if (this.dead.side[i]) R.draw('ud.sideWreck', M.sg[i], { damage: 1, heat: 0.12 });
      else {
        R.draw('ud.sideGunBase', M.sg[i], { flash: Math.max(fl, hf(ps)), damage: Math.max(dmg, hd(ps) * 0.8), snow: dust });
        R.draw('ud.rotor', M.sr[i], { flash: hf(ps) * 0.5, heat: this.heat[i + 2] * 0.35, snow: 0 });
      }
      if (this.dead.pod[i]) R.draw('ud.podWreck', M.pd[i], { damage: 1, heat: 0.1 });
      else {
        R.draw('ud.podBase', M.pd[i], { flash: Math.max(fl, hf(pp)), damage: Math.max(dmg, hd(pp) * 0.8), snow: dust });
        R.draw('ud.podCover', M.pc[i], { flash: hf(pp) * 0.5, damage: dmg, snow: dust });
      }
    }
    // Loose debris (roadblock).
    const dm = M.deb;
    for (const p of this.debris) {
      M4.trans(p.x, p.y, z0 + p.z, dm);
      M4.mul(dm, M4.rotZ(p.rot + p.az, M.tmp), dm);
      M4.mul(dm, M4.rotX(p.ax, M.tmp), dm);
      M4.mul(dm, M4.rotY(p.ay, M.tmp), dm);
      M4.mul(dm, scaleM(p.sx, p.sy, p.sz, M.tmp), dm);
      R.draw(p.mesh, dm, { snow: 0.1, damage: p.mesh === 'ud.hulk' ? 0.6 : 0.2 });
    }
    // 3) Contact occlusion (body + each tyre) and the soft planar shadow.
    R.beginShadow(cam, CAR_LOOK.shadow);
    M4.mul(M.world, M4.mul(M4.trans(0, 8, 0, M.tmp), scaleM(84, 166, 1, M.tmp2), M.tmp2), M.pad);
    R.contact(M.pad, 0.6, [0.3, 0.35], z0 + 1.2);
    for (let k = 0; k < 4; k++) {
      const wh = UD.wheels[k];
      M4.mul(M.world, M4.mul(M4.trans(wh.x, wh.y, 0, M.tmp), scaleM(wh.w * 0.7, wh.r * 0.85, 1, M.tmp2), M.tmp2), M.pad);
      R.contact(M.pad, 0.75, [0.4, 0.5], z0 + 1.4);
    }
    const items = this._items();
    const sh = 1.12, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < 3; k++) {
      const j = (k - 1) * 0.05, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], z0 + 2 + k * 0.6, 0.2);
    }
    R.end();
    this._pose(1);
  }

  /** The brightest flash this frame lights the bodywork (muzzle, turbine, launch). */
  _pointLight() {
    let best = null, bw = 0;
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, wgt = k * (f.kind === 'turbine' ? 3 : f.kind === 'cannon' ? 1.6 : 1);
      if (wgt > bw) { bw = wgt; best = f; }
    }
    if (best) {
      const col = best.kind === 'turbine' ? [2.4, 0.8, 1.6] : best.kind === 'launch' ? [2.2, 1.2, 0.6] : [2.4, 0.5, 0.9];
      return [best.w, best.kind === 'turbine' ? 180 : 90, col.map((v) => v * bw)];
    }
    if (this.tGlow > 1.2 && this.turbineOK) { const q = M4.point(this.M.core, 0, -16, 0, this.q3); return [q, 120, [0.3 * this.tGlow, 0.9 * this.tGlow, 1.3 * this.tGlow]]; }
    return null;
  }

  _items() {
    const M = this.M, out = [['ud.body', M.hull], ['ud.fenders', M.hull], ['ud.spine', M.hull], ['ud.wing', M.hull], ['ud.blades', M.hull], ['ud.canopy', M.hull]];
    for (let k = 0; k < 4; k++) out.push([UD.wheels[k].front ? 'ud.wheelF' : 'ud.wheelR', M.wheel[k]]);
    for (let i = 0; i < 2; i++) {
      out.push(this.dead.rear[i] ? ['ud.rearWreck', M.rg[i]] : ['ud.rearGunBase', M.rg[i]]);
      out.push(this.dead.side[i] ? ['ud.sideWreck', M.sg[i]] : ['ud.sideGunBase', M.sg[i]]);
      out.push(this.dead.pod[i] ? ['ud.podWreck', M.pd[i]] : ['ud.podBase', M.pd[i]]);
    }
    return out;
  }

  /** Under entities: light on the road (head / tail / turbine / muzzle pools), drift and roadblock chevrons. */
  renderUnder(b, alpha) {
    if (!this.is3D || this.wreck && this.c.state !== 'dying') return;
    const F = this.w.F, KF = this.c.kit.F, t = this.w.t, M = this.M;
    this._pose(this.c.e.alive ? alpha : 1);
    const g = (lx, ly, sx, sy, r, gg, bb, a) => { const q = this._scr(M.world, lx, ly, 0); b.draw(F.glow, q[0], q[1], sx * q[2], sy * q[2], 0, r, gg, bb, a, 1); };
    // Headlights reaching up the road ahead of the nose.
    for (const s2 of [-1, 1]) { g(s2 * 30, 250, 70, 120, 1.2, 1.15, 1, 0.13); g(s2 * 26, 340, 60, 90, 1.2, 1.15, 1, 0.07); }
    // Taillight and turbine glow on the asphalt behind the car.
    const tail = 0.12 + this.brake * 0.22;
    g(0, -190, 220, 70, 2.2, 0.15, 0.25, tail);
    const tg = Math.min(1, this.tGlow / 3);
    g(0, -215, 120 + tg * 120, 70 + tg * 60, 0.4, 1.4, 2.2, 0.08 + tg * 0.3);
    // Muzzle light pools.
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, q = this.cam.project(f.w[0], f.w[1], 0, this.pr);
      const big = f.kind === 'turbine' ? 4 : f.kind === 'cannon' ? 1.8 : 1;
      b.draw(F.glow, q[0], q[1] + 10, 90 * big * k * q[2], 50 * big * k * q[2], 0, 2.2, 0.5, 0.9, 0.22 * k, 1);
    }
    // Apex drift telegraph: chevrons sweeping across the road the way it will go.
    if (this.chevrons) {
      const d = this.chevrons.dir, blink = (t >> 2) & 1 ? 1 : 0.5;
      for (let k = 0; k < 5; k++) {
        const ly = 230 + k * 40, lx = d * (20 + ((k * 30 + this.chevrons.t * 4) % 150));
        const q = this._scr(M.world, lx, ly, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, q[0], q[1] + s2 * 7 * q[2], 26 * q[2], 4 * q[2], d > 0 ? s2 * 0.7 : Math.PI - s2 * 0.7, 2.4, 0.4, 0.9, 0.7 * blink, 1);
      }
    }
    // Roadblock warning: flashing hazard markers along the barrier line.
    if (this.block && !this.block.hit) {
      const blink = (t >> 3) & 1;
      for (const p of this.block.pieces) {
        const q = this.cam.project(p.x, p.y, 10, this.pr);
        if (q[1] < -30 || q[1] > H) continue;
        b.draw(F.glow, q[0], q[1], 30 * q[2], 30 * q[2], 0, 2.4, 0.6, 0.2, blink ? 0.55 : 0.2, 1);
      }
    }
  }

  /** Over entities (under bullets): flashes, aim lines, exhaust flames, missile trails, repair arcs, reticles. */
  renderOver(b, alpha) {
    if (!this.is3D) return;
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t, M = this.M;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const ln of this.lines) {
      const a = (1 - ln.t / ln.life) * (0.5 + 0.5 * ln.k), c = ln.col || [2.2, 0.4, 0.8];
      b.draw(KF.laser, ln.x + Math.cos(ln.ang) * ln.len / 2, ln.y + Math.sin(ln.ang) * ln.len / 2, ln.len, 2 + ln.k * 3, ln.ang, c[0], c[1], c[2], a * 0.6, 1);
    }
    // Thruster flames and the turbine plume (stronger under acceleration / turbo / discharge).
    if (!this.wreck && this.c.state !== 'dying') {
      const boost = this.rep && this.rep.phase === 'boost';
      const pw = Math.min(1.8, 0.35 + Math.max(0, this.acc) * 9 + (boost ? 1.3 : 0) + (this.rb && this.rb.phase === 'charge' ? 0.7 : 0));
      const fl = 0.8 + 0.2 * Math.sin(t * 1.3);
      for (const e of UD.exhausts) {
        const a = this._scr(M.hull, e[0], e[1] - 4, e[2]).slice(), bq = this._scr(M.hull, e[0], e[1] - 30 - pw * 30, e[2]);
        const ang = Math.atan2(bq[1] - a[1], bq[0] - a[0]), len = Math.hypot(bq[0] - a[0], bq[1] - a[1]);
        b.draw(KF.laser, (a[0] + bq[0]) / 2, (a[1] + bq[1]) / 2, len, 9 * a[2] * fl, ang, 0.5, 1.4, 2.4, 0.55, 1);
        b.draw(F.glow, a[0], a[1], 18 * a[2], 18 * a[2], 0, 0.8, 1.8, 2.6, 0.6, 1);
      }
      const tg = this.turbineOK ? Math.min(3.2, this.tGlow) : 0.2;
      const tc = this._scr(M.core, 0, -6, 0).slice(), te = this._scr(M.core, 0, -60 - tg * 30, 0);
      b.draw(F.glow, tc[0], tc[1], (34 + tg * 18) * tc[2], (34 + tg * 18) * tc[2], 0, 2.4, 0.8, 0.5, 0.35 + tg * 0.12, 1);
      b.draw(F.ring, tc[0], tc[1], 56 * tc[2], 52 * tc[2], 0, 0.4, 1.4, 2.4, 0.18 + tg * 0.1, 1);
      if (tg > 1.2 || boost) {
        const ang = Math.atan2(te[1] - tc[1], te[0] - tc[0]), len = Math.hypot(te[0] - tc[0], te[1] - tc[1]);
        b.draw(KF.laser, (tc[0] + te[0]) / 2, (tc[1] + te[1]) / 2, len, (28 + tg * 6) * tc[2], ang, 0.6, 1.4, 2.4, 0.35 * fl, 1);
      }
      // Turbo speed lines down the sides of the screen.
      if (boost || (this.rep && this.rep.phase === 'repair')) {
        const R = w.fxRng;
        for (let k = 0; k < 6; k++) { const x = R.chance(0.5) ? R.range(10, 120) : R.range(W - 120, W - 10), y = R.range(0, H); b.draw(KF.laser, x, y, 4, R.range(60, 140), Math.PI / 2, 1.4, 1.6, 2, 0.12, 1); }
      }
    }
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      if (f.kind === 'cannon' || f.kind === 'rear') {
        const s = f.kind === 'cannon' ? 1.4 : 0.85;
        b.draw(F.glow, f.x, f.y, 40 * s * k, 40 * s * k, 0, 2.4, 0.5, 0.9, 0.85 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 12 * s, f.y + Math.sin(f.ang) * 12 * s, 34 * s * k, 10 * s * k, f.ang, 2.4, 1.2, 1.4, 0.9 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 18 * s * k, 4 * k, f.ang + s2 * 1.2, 2.2, 0.8, 1.0, 0.55 * k, 1);
      } else if (f.kind === 'rotary') {
        b.draw(F.glow, f.x, f.y, 22 * k, 22 * k, 0, 2.4, 0.6, 1.2, 0.8 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 8, f.y + Math.sin(f.ang) * 8, 20 * k, 6 * k, f.ang, 2.4, 1.2, 1.6, 0.8 * k, 1);
      } else if (f.kind === 'launch') {
        b.draw(F.glow, f.x, f.y, 34 * k, 34 * k, 0, 2.4, 1.4, 0.6, 0.8 * k, 1);
      } else if (f.kind === 'turbine') {
        b.draw(F.glow, f.x, f.y, 280 * k, 240 * k, 0, 2.4, 0.6, 1.4, 0.7 * k, 1);
        b.draw(F.ring, f.x, f.y, 340 * (1 - k), 300 * (1 - k), 0, 1.0, 1.6, 2.4, 0.8 * k, 1);
      } else if (f.kind === 'vent') {
        b.draw(F.glow, f.x, f.y, 90 * k, 80 * k, 0, 2.2, 0.6, 0.4, 0.6 * k, 1);
      }
    }
    // Missile smoke trails and exhaust flares.
    for (const m of this.missiles) {
      const T = m.trail;
      for (let j = 0; j + 3 < T.length; j += 2) {
        const u = j / T.length, x0 = T[j], y0 = T[j + 1], x1 = T[j + 2], y1 = T[j + 3];
        b.draw(KF.laser, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) + 1, 2 + u * 3, Math.atan2(y1 - y0, x1 - x0), 1.1, 0.9, 1.1, 0.06 + u * 0.22, 1);
      }
      if (m.alive) {
        const cx = Math.cos(m.ang), sy = Math.sin(m.ang), fl = 0.75 + 0.25 * Math.sin(t * 1.9 + m.ref._ud);
        b.draw(KF.laser, m.x - cx * 15, m.y - sy * 15, 18 * fl, 6, m.ang, 2.4, 1.3, 0.6, 0.9, 1);
        b.draw(F.glow, m.x - cx * 10, m.y - sy * 10, 16 * fl, 16 * fl, 0, 2.4, 1.0, 0.5, 0.7, 1);
        b.draw(F.white, m.x - cx * 2, m.y - sy * 2, 15, 3.6, m.ang, 0.2, 0.2, 0.23, 1, 0);
        b.draw(F.white, m.x - cx * 2 - sy * 0.8, m.y - sy * 2 + cx * 0.8, 13, 1, m.ang, 0.55, 0.56, 0.6, 1, 0);
        for (const s2 of [-1, 1]) b.draw(F.white, m.x - cx * 8 - sy * s2 * 2.6, m.y - sy * 8 + cx * s2 * 2.6, 4, 1.6, m.ang + s2 * 0.6, 0.18, 0.18, 0.2, 1, 0);
      }
    }
    for (const r of this.reticles) {
      const k = r.t / r.life, a = (1 - k) * ((t >> 2) & 1 ? 1 : 0.55);
      b.draw(F.ring, r.x, r.y, 40 - k * 14, 40 - k * 14, t * 0.05, 2.2, 0.3, 0.8, 0.5 * a, 1);
    }
    // Repair: arcs across the bodywork, cyan pulse, progress bar.
    for (const a of this.arcs) {
      const k = 1 - a.t / a.life, n = 6;
      let px = a.x0, py = a.y0;
      for (let j = 1; j <= n; j++) {
        const u = j / n, jit = j < n ? Math.sin(a.seed * 40 + j * 2.3 + a.t) * 9 : 0;
        const x = lerp(a.x0, a.x1, u) + jit, y = lerp(a.y0, a.y1, u) - jit * 0.6;
        b.draw(KF.laser, (px + x) / 2, (py + y) / 2, Math.hypot(x - px, y - py), 2.4, Math.atan2(y - py, x - px), 0.6, 2, 2.6, 0.8 * k, 1);
        px = x; py = y;
      }
    }
    if (this.rep && this.c.state === 'fight') {
      const r = this.rep, q = this._scr(M.hull, 0, -40, 50), pulse = 0.6 + 0.4 * Math.sin(t * 0.3);
      if (r.phase === 'repair' || r.phase === 'boost' || r.phase === 'warn') b.draw(F.ring, q[0], q[1], 260 * q[2] * (1 + 0.1 * Math.sin(t * 0.2)), 220 * q[2], 0, 0.4, 1.6, 2.2, 0.25 * pulse, 1);
      if (r.phase === 'repair' || r.phase === 'return') {
        const bw = 120, by = q[1] + 120 * q[2], fill = r.total ? r.healed / r.total : 0;
        b.draw(F.white, q[0], by, bw + 4, 8, 0, 0.05, 0.08, 0.1, 0.7, 0);
        b.draw(F.white, q[0] - bw / 2 + (bw * fill) / 2, by, bw * fill, 4, 0, 0.4, 2, 2.4, 0.95, 1);
      }
    }
    // Burning mounts.
    for (const f of this.fires) {
      if (f.x === undefined) continue;
      const q = this.cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.i * 3);
      b.draw(F.glow, q[0], q[1], 30 * f.s * fl, 26 * f.s * fl, 0, 2, 0.7, 0.2, 0.55, 1);
    }
  }

  dispose() {
    if (this.view) {
      const i = this.view.extras.indexOf(this);
      if (i >= 0) this.view.extras.splice(i, 1);
      if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
    }
  }
}

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

/** Matrix mapping the unit cylinder (y 0..1, radius 1) onto segment a → b with radius r. */
function spanM(a, b, r, o) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / L, fy = dy / L, fz = dz / L;
  let xx = -fy, xy = fx;
  const xl = Math.hypot(xx, xy) || 1; xx /= xl; xy /= xl;
  const zx = xy * fz, zy = -xx * fz, zz = xx * fy - xy * fx;
  o.fill(0);
  o[0] = xx * r; o[1] = xy * r; o[2] = 0;
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

export { HOME_ROW, CHASE };
