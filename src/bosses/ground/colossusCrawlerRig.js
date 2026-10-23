import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer, CRAWLER_LOOK } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { CC, buildColossusCrawler } from '../../world/tank/colossusCrawlerModel.js';
import { TL } from '../../world/tank/tankTextures.js';
import { ROAD, sitesIn, footHold, LEAP_MAX } from '../../world/env/overpassMap.js';

// COLOSSUS CRAWLER runtime rig: the eight-legged siege machine as a walking,
// climbing, leaping body on the Burning Overpass (world/env/overpassMap.js).
//
//   Body       world pose (x, y, z, heading, pitch, roll). On the road a
//              velocity controller drives it toward the AI's goal (a screen
//              row held while the scroll drifts, a climb entry, a pad...);
//              heading turns toward the pilot at a limited rate. A damped
//              spring carries footfall / landing compression; pitch and roll
//              follow acceleration, turning and the gait.
//   Legs       eight 3-joint legs (hip yaw, femur, knee) solved by IK every
//              frame from the hull to each foot's WORLD position. Feet are
//              planted in the world: they only move during their swing.
//   Gait       alternating tetrapod (L1 R2 L3 R4 / R1 L2 R3 L4) with a ripple
//              inside each group, duty ≈ 0.64 (≥ 2 feet down per side). The
//              gait clock advances with distance travelled, turning and foot
//              error; stride and step rate grow with speed. A swinging foot
//              aims ahead of its home (lead from the body velocity) and lands
//              on a foothold from the shared map (street, a site's roof or its
//              wall — never inside a building). Plants trigger compression,
//              dust, sparks, a footprint at the real contact and a thud.
//   Climb      walk to a site's entry, face the wall, rear up, haul up the
//              wall (front feet on the roof edge / wall, rear on the street)
//              and crest onto the pad; the camera holds and pans to the site.
//   Leap       crouch, launch (ballistic arc with an apex), tuck, reach,
//              land (all eight feet planted on the landing surface, deep
//              compression, shockwave, crater); a landing zone is marked.
//   AI         priorities: defeat → incoming threats (adaptive evasion) →
//              the execution leap (≤ 50 % HP) → siege reclamation → terrain
//              (leave a roof) → requested tactics (vertical breach, leaps) →
//              wander / hold row, with anti-camping lane pressure.
//   Weapons    heavy cannons (yaw, recoil), shoulder rotaries (deploy, yaw,
//              spin), missile pods (covers), mortars (yaw, elevate: real 3D
//              shells), front battery, front-leg guns, the core emitter.
//              Every bullet, telegraph and flash starts at its mechanism.
//   Parts      2 heavy cannons, 2 rotaries, 2 pods, 2 mortars, the core
//              emitter, 8 legs (a broken leg limps: slower, lower steps).
//
// The BossController keeps HP, phases, transitions and the death timeline.

const HOME_ROW = 214;          // screen row of the hull centre while fighting on the road
const DRIFT = 0.55;            // scroll while fighting (the crawler walks back to hold its row)
const L1 = CC.femur, L2 = CC.tibia;
const REACH = CC.coxa + L1 + L2 - 14;
const SWF = 0.36;              // swing fraction of the gait cycle
const GROUP = [0, 1, 0, 1, 1, 0, 1, 0];
const RIPPLE = [0, 0.06, 0.12, 0.18, 0, 0.06, 0.12, 0.18];
const SITE_SC = 0.8;           // stance scale on a roof pad
const EXEC_R = 96;             // lethal landing radius (world units)
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const sgn = (v) => (v < 0 ? -1 : 1);
const frac = (v) => v - Math.floor(v);

const SPEC = {
  shell: { shape: 'bigorb', color: 'red', n: 1, speed: 3.1, fixed: true },
  shellSplit: { shape: 'bigorb', color: 'red', n: 1, speed: 2.7, fixed: true, split: { shape: 'rice', color: 'orange', n: 9, speed: 1.7 }, splitAt: 62 },
  shellFan: { shape: 'orb', color: 'red', n: 3, spread: 0.3, speed: 2.6 },
  rot: { shape: 'orb', color: 'pink', n: 1, speed: 3.0 },
  batt: { shape: 'bigorb', color: 'pink', n: 6, spread: 1.1, speed: 2.0, scale: 1.1 },
  battBolt: { shape: 'rice', color: 'red', n: 1, speed: 4.4 },
  kunai: { shape: 'kunai', color: 'yellow', n: 2, spread: 0.14, speed: 3.2 },
  mortRing: { shape: 'orb', color: 'orange', n: 10, speed: 1.8 },
  stomp: { shape: 'rice', color: 'orange', n: 10, speed: 1.8 },
  land: { shape: 'orb', color: 'red', n: 18, speed: 1.7 },
  landRice: { shape: 'rice', color: 'pink', n: 24, speed: 2.3 },
  coreRing: { shape: 'bigorb', color: 'red', n: 16, speed: 1.75 },
  coreRice: { shape: 'rice', color: 'pink', n: 28, speed: 2.5 },
  laneMissile: { shape: 'kunai', color: 'pink', n: 1, speed: 3.4, fixed: true },
  debris: { shape: 'rice', color: 'orange', n: 1, speed: 1.4, fixed: true },
};
const MSPLIT = { shape: 'rice', color: 'red', n: 6, speed: 1.6 };

/** Flat stand-in camera when no arena world is up (2D fallback): same world, no perspective. */
function orthoCam() {
  return {
    ortho: true, x: 0, px: 0, y: 0, cy: 0, near: 1, pitch: 0,
    project(x, y, z, out = [0, 0, 0, 0]) { out[0] = W / 2 + (x - this.x); out[1] = H * 0.6 - (y - this.y) - z * 0.25; out[2] = 1; out[3] = 1000; return out; },
    unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx - W / 2 + this.x; out[1] = this.y + (H * 0.6 - sy) - h * 0.25; out[2] = h; return out; },
    frame() { this.cy = this.y; },
  };
}

const KEYS = ['x', 'y', 'z', 'h', 'pitch', 'roll', 'plate', 'arm'];
const ARR = ['f', 'hcY', 'hcR', 'rotY', 'rotD', 'rotS', 'pod', 'mortY', 'mortE'];
const mat = () => new Float32Array(16);
const mats = (n) => Array.from({ length: n }, mat);

export class ColossusCrawlerRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = orthoCam();
    this.s = {
      x: 0, y: 0, z: CC.ride, h: Math.PI, pitch: 0, roll: 0, plate: 0, arm: 0,
      f: new Float32Array(24), hcY: [0, 0], hcR: [0, 0], rotY: [0.3, -0.3], rotD: [0, 0], rotS: [0, 0], pod: [0, 0], mortY: [0, 0], mortE: [0.7, 0.7],
    };
    this.p = { ...this.s };
    for (const k of ARR) this.p[k] = this.s[k].slice();
    this.nrm = Array.from({ length: 8 }, () => [0, 0, 1]);
    this.legs = Array.from({ length: 8 }, () => ({ sw: false, u: 0, dur: 20, from: [0, 0, 0], to: [0, 0, 0], loc: 0, lift: 26, zone: null }));
    // Body dynamics.
    this.vx = 0; this.vy = 0; this.acc = 0.06; this.vmax = 1.8;
    this.goal = [0, 0]; this.hGoal = Math.PI; this.turn = 0.02;
    this.comp = 0; this.compV = 0; this.crouch = 0; this.kick = 0;
    this.gz = 0; this.site = null; this.sc = 1; this.gp = 0; this.forceGait = 0; this.stompMode = false;
    this.mv = null; this.act = null; this.req = null;
    // Camera.
    this.cv = DRIFT; this.ctrlCam = false; this.released = false; this.hold = false; this.hide = false; this.pitch0 = 0.42;
    // AI memory.
    this.wT = 0; this.wsx = W / 2; this.wrow = HOME_ROW;
    this.ppx = 0; this.ppy = 0; this.pvx = 0; this.pvy = 0; this.camp = []; this.lastSites = [];
    this.evCd = 360; this.threat = null; this.pUlt = 0; this.pBomb = 0; this.beamT = 0; this.ultSeen = 0;
    this.exCd = 0; this.exUnlocked = false; this.repairs = 0; this.repPhase = -1; this.repCd = 0;
    this.critical = false; this.odT = 0; this.empower = 0;
    // Weapons.
    this.dead = { hc: [false, false], rot: [false, false], pod: [false, false], mort: [false, false], core: [false], leg: [false, false, false, false, false, false, false, false] };
    this.partHp = {}; this.partEnt = {};
    this.hcGlow = [0, 0]; this.heat = [0, 0, 0, 0]; this.alt = 0;
    this.rotT = [0, 0]; this.rotAim = [null, null]; this.hcAim = [null, null]; this.podT = [0, 0];
    this.mortT = [0.7, 0.7]; this.mortAim = [null, null]; this.rotV = [0, 0];
    this.eye = 0.5; this.eyeT = 0.5; this.plateT = 0; this.armT = 0;
    this.heavy = null; this.queue = null;
    this.fk = null; this.ar = null; this.su = null; this.co = null; this.ms = null;
    this.shells = []; this.missiles = []; this.mid = 0; this.zones = [];
    this.flashes = []; this.lines = []; this.arcs = []; this.reticles = []; this.fires = [];
    this.debris = []; this.prints = []; this.printData = new Float32Array(200 * 36); this.printN = 0; this.printDirty = true;
    this.M = {
      world: mat(), hull: mat(), inv: mat(), coxa: mats(8), femur: mats(8), tibia: mats(8), foot: mats(8), legGun: mats(2),
      hc: mats(2), hcb: mats(2), rot: mats(2), rotor: mats(2), pod: mats(2), podc: mats(2), mort: mats(2), mortt: mats(2),
      plateL: mat(), plateR: mat(), repair: mat(), armA: mats(2), armB: mats(2),
      tmp: mat(), tmp2: mat(), loc: mat(), span: mat(), pad: mat(), deb: mat(),
    };
    this.knee = Array.from({ length: 8 }, () => [0, 0, 0]);
    this.t = 0; this.deathT = -1; this.wreck = false; this.placed = false; this.flash = 0;
    this.pr = [0, 0, 0, 0]; this.q3 = [0, 0, 0]; this.v3 = [0, 0, 0]; this.h3 = [0, 0, 0]; this.fh = [0, 0, 0, 0, 0, 1];
    this.stepD = 0; this.servoD = 0;
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get coreOK() { return !this.dead.core[0]; }
  get legsDown() { let n = 0; for (const d of this.dead.leg) if (d) n++; return n; }
  get rate() { return (this.c.intensity || 1) * (this.empower > 0 ? 1.3 : 1) * (1 + 0.12 * (this.c.mk - 1)); }
  get airborne() { return !!(this.mv && this.mv.type === 'leap' && this.mv.phase === 'air'); }
  /** Light fire pauses while the core discharges, during the repair, climbs, leaps and the execution. */
  get quiet() { return !!(this.co && this.co.phase === 'fire') || !!(this.act && this.act.quiet) || !!(this.mv && this.mv.type !== 'climb') || this.c.state !== 'fight'; }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v !== this.view && !(v && !v.cam)) {
      const keep = this.placed ? this._scr(this.M.hull, 0, 0, 0).slice() : null;
      if (this.view) {
        const i = this.view.extras.indexOf(this);
        if (i >= 0) this.view.extras.splice(i, 1);
        if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
        if (this.view.camFollow) this.view.camFollow = null;
      }
      this.view = v;
      this.cam = this.view ? this.view.cam : orthoCam();
      this.ctrlCam = false;
      if (this.view) {
        this.view.extras.push(this);
        if (!this.wreck && !this.released) {
          this.ctrlCam = true;
          this.view.speedTarget = null;
          this.view.speed = this.cv;
        }
        this.view.camFollow = (vw) => this._follow(vw);
        this.pitch0 = this.cam.pitch;
        this.cam.frame(1);
      }
      this.prints.length = 0; this.printDirty = true; this.debris.length = 0; this.shells.length = 0; this.zones.length = 0;
      if (keep) this._placeAt(keep[0], keep[1]);
    }
    if (this.view) this.cam.frame(1);
  }

  /** Screen point → world point on the street (z = h). */
  _world(sx, sy, h = 0, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, (this.view ? this.view.floorZ : 0) + h, out) || out; }

  /** Put the hull centre on screen point (sx, row), standing on the road, feet planted. */
  _placeAt(sx, row) {
    const p = this._world(sx, row, CC.ride, this.q3), s = this.s;
    s.x = clamp(p[0], -ROAD.body, ROAD.body); s.y = p[1]; s.h = Math.PI; s.pitch = 0; s.roll = 0;
    this.site = null; this.sc = 1; this.gz = 0; s.z = CC.ride; this.vx = this.vy = 0;
    this.mv = null; this.act = null; this.stompMode = false; this.forceGait = 0; this.crouch = 0;
    this._pose(1);
    this._plantAll();
    for (const k of KEYS) this.p[k] = s[k];
    this.p.f = s.f.slice();
    this._pose(1);
  }

  /** World point under screen (sx, row) at the hull's height: the hull projects onto that row. */
  _goalAt(sx, row, out = this.q3) { return this._world(sx, row, this.gz + CC.ride, out); }

  _row() { return this._scr(this.M.hull, 0, 0, 0)[1]; }

  /** Lateral camera framing (called right after the camera steps). */
  _follow(vw) {
    const cam = vw.cam, s = this.s;
    let tx;
    if (this.wreck || this.c.state === 'dying') tx = clamp(s.x * 0.4, -80, 80);
    else if (this.mv && this.mv.type === 'leap') tx = clamp(lerp(s.x, this.mv.x1, 0.5) * (this.mv.site ? 0.8 : 0.6), -350, 350);
    else if (this.site || (this.mv && this.mv.type === 'climb')) tx = clamp(s.x * 0.82, -350, 350);
    else tx = clamp(s.x * 0.5, -70, 70);
    cam.x += clamp((tx - cam.x) * 0.04, -3.2, 3.2);
    // A big leap lifts the view a little (more of the road ahead in frame).
    const pt = this.pitch0 + (this.airborne ? 0.05 : 0);
    cam.pitch += (pt - cam.pitch) * 0.04;
  }

  /** Scroll: a slow drift while fighting; held for climbs, repairs, leaps; catches up when the crawler moves up the road. */
  _speedCamera() {
    if (!this.view || !this.ctrlCam) { if (this.cam.ortho) this.cam.y += this.c.state === 'dying' ? 0 : DRIFT * (this.hold ? 0 : 1); return; }
    const c = this.c, dying = c.state === 'dying';
    let T;
    if (dying) T = this.deathT > 150 ? this.view.baseSpeed : 0;
    else {
      T = this.hold ? 0 : DRIFT;
      const row = this._row();
      if (!this.hide && row < HOME_ROW - 30) T += Math.min(5, (HOME_ROW - 30 - row) * 0.03);
      if (this.hide) T = DRIFT * 0.4;
    }
    // Speeds up gently, brakes hard (a catch-up must not overshoot the crawler into the pilot's space).
    this.cv += clamp(T - this.cv, -0.12, 0.035);
    this.view.speed = this.cv;
  }

  // -------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e, s = this.s;
    this._attach();
    if (!this.placed) {
      this.placed = true;
      this._placeAt(W / 2, c.state === 'enter' ? -320 : HOME_ROW);
      if (c.state === 'enter') {
        // Entrance: the machine drops onto the highway from above the screen.
        const g = this._world(W / 2, HOME_ROW, CC.ride, [0, 0, 0]);
        s.z = 380;
        this._startLeap(clamp(g[0], -ROAD.body, ROAD.body), g[1], null, { noCrouch: true, T: 86, apex: 40, ring: false, entrance: true });
      }
    }
    for (const k of KEYS) this.p[k] = s[k];
    for (const k of ARR) { const a = s[k], b = this.p[k]; for (let i = 0; i < a.length; i++) b[i] = a[i]; }
    this.t++;
    if (this.empower > 0) this.empower--;
    if (this.evCd > 0) this.evCd--;
    if (this.exCd > 0) this.exCd--;
    this._trackPlayer();

    switch (c.state) {
      case 'enter': this.hold = true; break;
      case 'fight': this._fight(); break;
      case 'transition': this._endAttacks(); this.act = null; if (this.mv) this.mv.onDone = null; this.hold = !!this.mv || !!this.site; if (!this.mv && this.site) this._leaveRoof(); this._hold(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._speedCamera();
    this._move();
    this._pose(1);
    this._gait();
    this._weaponsAnim();
    this._pose(1);
    const pc = this._scr(this.M.hull, 0, 7, 22);
    // Kept inside the World's field box (entities outside it are culled); above y = -10 shots skip it.
    e.x = clamp(pc[0], -18, W + 18); e.y = clamp(pc[1], -18, H + 18);
    e.rot = 0;
    e.scale = this.pr[2] || 1;
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._parts();
    this._contact();
    this._updateFlak();
    this._updateArtillery();
    this._updateSuppression();
    this._updateCore();
    this._updateMissiles();
    this._runQueue();
    this._trackMissiles();
    this._updateShells();
    this._updateDebris();
    this._updatePrints();
    if (this.is3D) { this._fx(); this._sound(); }
    for (const L of [this.flashes, this.lines, this.arcs, this.reticles, this.zones]) for (let i = L.length - 1; i >= 0; i--) if (++L[i].t >= L[i].life) L.splice(i, 1);
  }

  _trackPlayer() {
    const p = this.w.player;
    if (!p) return;
    const vx = p.x - this.ppx, vy = p.y - this.ppy;
    this.ppx = p.x; this.ppy = p.y;
    if (Math.abs(vx) < 20 && Math.abs(vy) < 20) { this.pvx += (vx - this.pvx) * 0.15; this.pvy += (vy - this.pvy) * 0.15; }
    if (this.t % 10 === 0) { this.camp.push(p.x); if (this.camp.length > 24) this.camp.shift(); }
  }

  /** The pilot holds one lane (x spread over the last ~4 s under 34 units): the lane is pressured. */
  get campLane() {
    const a = this.camp;
    if (a.length < 20) return null;
    let mn = 1e9, mx = -1e9, sum = 0;
    for (const v of a) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; }
    return mx - mn < 34 ? sum / a.length : null;
  }

  _phaseMove() { const ph = this.c.phase; return (ph && ph.move) || {}; }

  // ------------------------------------------------------------ fight AI

  _fight() {
    const mv = this._phaseMove();
    this.vmax = (mv.speed ?? 1.8) * (this.critical ? 1.25 : 1) * (1 - 0.06 * this.legsDown);
    this.acc = this.critical ? 0.08 : 0.06;
    this.hold = !!this.mv || !!this.site || !!(this.act && this.act.hold);
    this.hide = !!(this.act && this.act.type === 'evade' && this.act.hide && (this.w.player && this.w.player.ultT > 0));
    this._threats();
    this._execUnlock();
    if (this.act) this._updateAct();
    if (!this.act && !this.mv) this._decide();
    if (!this.act && !this.mv) this._wander();
    this._repairCheck();
  }

  /** Hold position (transitions): stay where the body is. */
  _hold() { if (!this.mv) { this.goal[0] = this.s.x; this.goal[1] = this.s.y + (this.site ? 0 : this.cv); } }

  /** Roam the road at the home row, facing the pilot; lane pressure when the pilot camps. */
  _wander() {
    const w = this.w, mv = this._phaseMove();
    if (this.site) { this._roofHold(); return; }
    if (--this.wT <= 0) {
      const camp = this.campLane;
      const rate = (mv.wander ?? 1) * (this.critical ? 1.4 : 1);
      if (camp !== null && w.rng.chance(0.6)) this.wsx = clamp(camp + w.rng.range(-50, 50), 110, W - 110);
      else this.wsx = clamp(this.wsx + w.rng.sign() * w.rng.range(60, 150), 100, W - 100);
      this.wrow = HOME_ROW + w.rng.range(-26, 22);
      this.wT = Math.round(w.rng.range(140, 260) / rate);
    }
    const g = this._goalAt(this.wsx, this.wrow);
    this.goal[0] = clamp(g[0], -ROAD.body, ROAD.body); this.goal[1] = g[1];
    this._facePlayer(0.6);
  }

  _facePlayer(lim = 0.6) {
    const p = this.w.player, s = this.s;
    if (!p) { this.hGoal = Math.PI; return; }
    const g = this._world(p.x, p.y, 0, this.h3);
    const h = Math.atan2(g[0] - s.x, g[1] - s.y);
    this.hGoal = Math.PI + clamp(wrapA(h - Math.PI), -lim, lim);
  }

  /** Standing on a pad with nothing to do there: face the pilot, then go back down. */
  _roofHold() {
    const s = this.s;
    this.goal[0] = s.x; this.goal[1] = s.y;
    this._facePlayer(1.2);
  }

  _decide() {
    const c = this.c, w = this.w, p = w.player;
    // 1. Execution leap (≤ 50 % HP), never while repairing / climbing.
    if (this.exUnlocked && this.exCd <= 0 && this.c.pt > 90 && !this.site) { this._startExec(); return; }
    // 2. Stranded on a roof (after an escape, a cut-short repair): leave after a short hold.
    if (this.site) { this.act = { type: 'roof', phase: 'hold', t: 0, holdT: 120, hold: true }; return; }
    // 3. Requested tactics (vertical breach / leaps), unless the pilot's ultimate is nearly ready: keep the evasion in reserve.
    const reserve = p && p.ult >= 85 && this.evCd < 200 && this._phaseMove().evade;
    if (this.req && !reserve && !this.heavy) {
      const r = this.req; this.req = null;
      if (r === 'climb') this._startRoof();
      else if (r === 'hop') this._hop();
    }
  }

  // ---------------------------------------------------- threat evaluation

  /**
   * Incoming threats: the pilot's ultimate (screen-wide, the crawler must
   * leave the screen), a bomb (local: get clear of the pilot's column), a
   * sustained beam through the hull (step out of its line). Reaction time,
   * cooldowns and a success chance: some attacks still land.
   */
  _threats() {
    const w = this.w, p = w.player, mv = this._phaseMove();
    if (!p) return;
    const ultStart = p.ultT > 0 && this.pUlt === 0, bombStart = p.bombT > 0 && this.pBomb === 0;
    this.pUlt = p.ultT; this.pBomb = p.bombT;
    if (ultStart) this.ultSeen++;
    // Beams crossing the hull this step.
    let beamed = false;
    const e = this.c.e;
    for (const b of w.beams) {
      if (b.dmg <= 0 || b.w < 10) continue;
      const dx = b.x1 - b.x0, dy = b.y1 - b.y0, L2b = dx * dx + dy * dy || 1;
      const t = clamp(((e.x - b.x0) * dx + (e.y - b.y0) * dy) / L2b, 0, 1);
      if (Math.hypot(b.x0 + dx * t - e.x, b.y0 + dy * t - e.y) < b.w / 2 + e.r) { beamed = true; break; }
    }
    this.beamT = beamed ? this.beamT + 1 : Math.max(0, this.beamT - 2);
    if (!mv.evade || this.c.state !== 'fight') return;
    if (!this.threat) {
      if (ultStart) this.threat = { kind: 'ult', at: this.t + w.rng.int(12, 22) };
      else if (bombStart && Math.hypot(p.x - e.x, p.y - e.y) < 300) this.threat = { kind: 'bomb', at: this.t + w.rng.int(8, 14) };
      else if (this.beamT >= 10) this.threat = { kind: 'beam', at: this.t + w.rng.int(4, 10) };
    }
    const th = this.threat;
    if (!th || this.t < th.at) return;
    this.threat = null;
    // Committed actions are not abandoned (the repair, the execution, a leap in the air).
    if (this.evCd > 0 || (this.act && this.act.commit) || (this.mv && this.mv.type === 'leap') || this.legsDown >= 5) return;
    const chance = th.kind === 'ult' ? 0.8 : th.kind === 'bomb' ? 0.6 : 0.7;
    if (!w.rng.chance(chance)) return;
    if (th.kind === 'ult') this._evadeLeap();
    else this._evadeDash(th.kind);
  }

  /** Ultimate incoming: leap clear of the screen, onto a structure far up the road (or the road beyond). */
  _evadeLeap() {
    const s = this.s, w = this.w;
    this._endAttacks();
    if (this.mv && this.mv.type === 'climb') this.mv = null;
    const sites = sitesIn(s.y + 620, s.y + LEAP_MAX).filter((st) => Math.hypot(st.cx - s.x, st.cy - s.y) < LEAP_MAX && !this.lastSites.includes(st.j));
    let tx, ty, site = null;
    if (sites.length && w.rng.chance(0.7)) { site = w.rng.pick(sites); tx = site.cx; ty = site.cy; this._remember(site); }
    else { tx = w.rng.range(-ROAD.body, ROAD.body); ty = s.y + w.rng.range(720, 900); }
    this.act = { type: 'evade', phase: 'leap', t: 0, hide: true, commit: true, quiet: true };
    this._callout('EVASION PROTOCOL', 'gold');
    this._startLeap(tx, ty, site, { crouch: 14, apex: 200, ring: false, onDone: () => { this.act = null; } });
    this.evCd = 1100;
  }

  /** Bomb / beam: a fast lateral scuttle out of the pilot's column or the beam's line. */
  _evadeDash(kind) {
    const s = this.s, p = this.w.player, e = this.c.e;
    if (this.site || this.mv) return;
    let dir = sgn(e.x - p.x) || this.w.rng.sign();
    if (Math.abs(s.x + dir * 110) > ROAD.body + 10) dir = -dir;
    this.act = { type: 'evade', phase: 'dash', t: 0, dir, x: clamp(s.x + dir * 140, -ROAD.body - 20, ROAD.body + 20), quiet: false };
    this.evCd = kind === 'bomb' ? 420 : 300;
    sfx.play('hydraulic', { pan: dir * 0.4 });
  }

  // ------------------------------------------------------------ acts

  _updateAct() {
    const a = this.act, s = this.s;
    a.t++;
    switch (a.type) {
      case 'evade':
        if (a.phase === 'dash') {
          this.vmax = 3.4; this.acc = 0.16; this.forceGait = 0.02;
          this.goal[0] = a.x; this.goal[1] = this._goalAt(W / 2, HOME_ROW)[1];
          this._facePlayer(0.6);
          if (a.t > 44) { this.act = null; this.forceGait = 0; }
        }
        break;
      case 'roof': this._updateRoof(a); break;
      case 'regen': this._updateRegen(a); break;
      case 'exec': this._updateExec(a); break;
      case 'stomp': this._updateStomp(a); break;
      case 'hop': if (!this.mv) this.act = null; break;
      default: this.act = null;
    }
    void s;
  }

  _remember(site) { this.lastSites.push(site.j); if (this.lastSites.length > 2) this.lastSites.shift(); }

  /** Choose a reachable climb site: near, not the last used, and its route clear. */
  _pickSite(ya, yb, near = true) {
    const s = this.s, w = this.w;
    const list = sitesIn(s.y + ya, s.y + yb).filter((st) => !this.lastSites.includes(st.j) && Math.hypot(st.cx - s.x, st.cy - s.y) < LEAP_MAX);
    if (!list.length) return null;
    list.sort((a, b) => (Math.abs(a.cy - s.y) - Math.abs(b.cy - s.y)) * (near ? 1 : -1) + w.rng.range(-120, 120));
    return list[0];
  }

  /** Reach a site: climb it from the road when it is close and the legs can take it, else leap onto it. */
  _gotoSite(site, onDone) {
    const s = this.s;
    this._remember(site);
    const climb = !this.site && this.legsDown < 4 && Math.abs(site.cy - s.y) < 460;
    if (climb) { this._callout('VERTICAL BREACH — CLIMBING', 'red'); this._startClimb(site, onDone); }
    else this._startLeap(site.cx, site.cy, site, { ring: this.c.state === 'fight', onDone });
  }

  /** VERTICAL BREACH: climb a structure, fight from its roof, leap away (across to another, or down). */
  _startRoof() {
    const site = this._pickSite(-20, 720);
    if (!site) return false;
    this.act = { type: 'roof', phase: 'go', t: 0, site, holdT: 260 + this.w.rng.int(0, 120), hold: true, hops: 0 };
    this._gotoSite(site, () => { if (this.act && this.act.type === 'roof') { this.act.phase = 'hold'; this.act.t = 0; } });
    return true;
  }

  _updateRoof(a) {
    if (a.phase === 'go') { if (!this.mv && !this.site) this.act = null; return; }
    if (a.phase === 'hold') {
      this._roofHold();
      if (a.t >= a.holdT && !this.heavy) {
        a.phase = 'leave'; a.t = 0;
        // Across to another structure (once) or back down to the street.
        const s = this.s, w = this.w;
        const far = a.hops < 1 && w.rng.chance(0.45) ? sitesIn(s.y - 200, s.y + 700).filter((st) => st.side !== (this.site ? this.site.side : 0) && Math.hypot(st.cx - s.x, st.cy - s.y) < LEAP_MAX) : [];
        if (far.length) {
          const st = w.rng.pick(far);
          a.hops++; this._remember(st);
          this._callout('AERIAL SIEGE LEAP', 'red');
          this._startLeap(st.cx, st.cy, st, { ring: true, onDone: () => { if (this.act === a) { a.phase = 'hold'; a.t = 0; a.holdT = 160; } } });
        } else this._leaveRoof(() => { if (this.act === a) this.act = null; });
      }
    }
  }

  /** Leap from a roof back down to the street at the home row. */
  _leaveRoof(onDone = null) {
    const g = this._world(W / 2 + this.w.rng.range(-60, 60), HOME_ROW + 10, CC.ride, [0, 0, 0]);
    this._startLeap(clamp(g[0], -ROAD.body, ROAD.body), g[1], null, { ring: this.c.state === 'fight', onDone });
  }

  /** Short tactical hop along the road (final phase). */
  _hop() {
    const s = this.s, w = this.w;
    if (this.site || this.mv) return;
    const g = this._world(clamp(W / 2 + w.rng.sign() * w.rng.range(60, 130), 100, W - 100), HOME_ROW + w.rng.range(-30, 20), CC.ride, [0, 0, 0]);
    this.act = { type: 'hop', t: 0, quiet: true };
    this._startLeap(clamp(g[0], -ROAD.body, ROAD.body), g[1], null, { crouch: 16, apex: 80, T: 42, ring: true, small: true, onDone: () => { if (this.act && this.act.type === 'hop') this.act = null; } });
    void s;
  }

  // ------------------------------------------------- movement programs

  _startLeap(tx, ty, site, o = {}) {
    const s = this.s;
    const tz = site ? site.top : 0;
    const d = Math.hypot(tx - s.x, ty - s.y, tz - this.gz);
    this.mv = {
      type: 'leap', phase: o.noCrouch ? 'air' : 'crouch', t: 0, x0: s.x, y0: s.y, z0: s.z, x1: tx, y1: ty, site, tz,
      T: o.T || Math.round(clamp(40 + d * 0.035, 44, 80)), apex: o.apex ?? clamp(110 + d * 0.12, 120, 300), h0: s.h, crouchT: o.crouch ?? 28,
      ring: o.ring !== false, exec: !!o.exec, small: !!o.small, entrance: !!o.entrance, onDone: o.onDone || null, onLand: o.onLand || null, recover: o.recover ?? (o.small ? 18 : 34),
    };
    if (o.noCrouch) this._launch();
    if (site || o.exec) this.hold = true;
  }

  _launch() {
    const m = this.mv, s = this.s, w = this.w;
    m.phase = 'air'; m.t = 0; m.x0 = s.x; m.y0 = s.y; m.z0 = s.z; m.h0 = s.h;
    const dx = m.x1 - s.x, dy = m.y1 - s.y;
    m.h1 = Math.hypot(dx, dy) > 60 ? Math.PI + clamp(wrapA(Math.atan2(dx, dy) - Math.PI), -0.7, 0.7) : s.h;
    if (m.entrance) return;
    // Launch: every foot kicks off its surface.
    for (let i = 0; i < 8; i++) this.legs[i].sw = false;
    if (this.is3D) {
      const fx = this.view.fx, R = w.fxRng;
      for (let i = 0; i < 8; i++) { fx.dust(s.f[i * 3], s.f[i * 3 + 1], s.f[i * 3 + 2], m.small ? 0.8 : 1.4, this.view.dustCol, m.small ? 3 : 6); if (R.chance(0.5)) fx._spark(s.f[i * 3], s.f[i * 3 + 1], s.f[i * 3 + 2] + 2, 6); this._print(i, 1); }
    }
    const q = this._scr(this.M.world, 0, 0, 0);
    w.g.camera.addTrauma(m.small ? 0.2 : 0.4);
    if (!m.small) w.g.renderer.post.shockwave(q[0], q[1], 0.02, 0.02, 0.4);
    this._shards(q[0], q[1], m.small ? 6 : 14);
    sfx.play('crawlerLeap', { pan: (q[0] - W / 2) / W });
  }

  _startClimb(site, onDone) {
    this.mv = { type: 'climb', phase: 'approach', t: 0, site, side: site.side, onDone };
    this.hold = true;
  }

  /** Move the body: the active movement program, else the walk controller. */
  _move() {
    const m = this.mv;
    if (this.c.state === 'dying') { this._collapse(); return; }
    if (m && m.type === 'leap') this._leap(m);
    else if (m && m.type === 'climb') this._climb(m);
    else this._walk();
  }

  _walk() {
    const s = this.s, g = this.goal;
    const dx = g[0] - s.x, dy = g[1] - s.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(this.vmax, d * 0.05 + (d > 4 ? 0.2 : 0));
    const tvx = (dx / d) * sp, tvy = (dy / d) * sp;
    const ax = clamp(tvx - this.vx, -this.acc, this.acc), ay = clamp(tvy - this.vy, -this.acc, this.acc);
    this.vx += ax; this.vy += ay;
    s.x += this.vx; s.y += this.vy;
    if (this.site) {
      const st = this.site, hw = (st.x1 - st.x0) / 2 - 150, hd = st.hd - 140;
      s.x = clamp(s.x, st.cx - Math.max(4, hw), st.cx + Math.max(4, hw)); s.y = clamp(s.y, st.cy - Math.max(4, hd), st.cy + Math.max(4, hd));
    } else s.x = clamp(s.x, -ROAD.body - 90, ROAD.body + 90);
    const dh = clamp(wrapA(this.hGoal - s.h), -this.turn, this.turn);
    s.h = wrapA(s.h + dh);
    // Height: ride height over the surface, minus crouch and the compression spring.
    this.compV += -this.comp * 0.12 - this.compV * 0.22;
    this.comp += this.compV;
    const zt = this.gz + CC.ride * (0.9 + 0.1 * this.sc) - this.crouch - this.comp;
    s.z += (zt - s.z) * 0.25;
    // Attitude: heavy machine — the nose rises under acceleration, it leans out of turns, sways with the gait.
    const hc = Math.cos(s.h), hs = Math.sin(s.h);
    const af = ax * hs + ay * hc, al = ax * hc - ay * hs;
    const sway = Math.sin(this.gp * Math.PI * 4) * 0.008 * Math.min(1, Math.hypot(this.vx, this.vy));
    s.pitch += (clamp(af * 0.9, -0.05, 0.05) - this.kick - s.pitch) * 0.12;
    s.roll += (clamp(-al * 0.9 - dh * 1.2, -0.05, 0.05) + sway - s.roll) * 0.12;
    this.kick *= 0.88;
    this.om = dh;
  }

  _leap(m) {
    const s = this.s, w = this.w, c = this.c;
    m.t++;
    if (m.phase === 'crouch') {
      const k = sm(m.t / m.crouchT);
      this.crouch = (m.exec ? 30 : m.small ? 12 : 21) * k;
      this.goal[0] = s.x; this.goal[1] = s.y; this.vx *= 0.8; this.vy *= 0.8;
      this.hGoal = m.h0;
      this._walk();
      s.pitch += (-0.06 * k - s.pitch) * 0.2;
      if (m.t >= m.crouchT) { this.crouch = 0; this._launch(); }
      return;
    }
    if (m.phase === 'air') {
      const u = m.t / m.T;
      // The execution leap tracks the pilot until 62 % of the flight (limited correction), then commits.
      if (m.exec && u < 0.62 && w.player) {
        const g = this._world(w.player.x, w.player.y, 0, this.q3);
        const tx = clamp(g[0], -150, 150), ty = g[1];
        const dx = tx - m.x1, dy = ty - m.y1, d = Math.hypot(dx, dy);
        if (d > 0.5) { const k = Math.min(1, 2.1 / d); m.x1 += dx * k; m.y1 += dy * k; }
      }
      const e = sm(u * 0.35 + u * 0.65 * u);
      s.x = lerp(m.x0, m.x1, e); s.y = lerp(m.y0, m.y1, e);
      const zEnd = m.tz + CC.ride * (m.site ? SITE_SC * 0.1 + 0.9 : 1);
      s.z = lerp(m.z0, zEnd, u) + 4 * m.apex * u * (1 - u);
      s.h = wrapA(m.h0 + wrapA(m.h1 - m.h0) * sm(u));
      s.pitch = 0.2 * (1 - u) - 0.16 * sm((u - 0.5) * 2);
      s.roll *= 0.9;
      this.vx = (s.x - this.p.x) * 0.3; this.vy = (s.y - this.p.y) * 0.3;
      if (m.t >= m.T) this._land(m);
      return;
    }
    if (m.phase === 'recover') {
      this.goal[0] = s.x; this.goal[1] = s.y;
      if (!this.site && c.state === 'fight') this._facePlayer(0.6);
      this._walk();
      if (m.t >= m.recover) {
        this.mv = null;
        if (m.onDone) m.onDone();
      }
    }
  }

  /** Touchdown: plant all eight feet, absorb, shockwave, crater, debris, bullets. */
  _land(m) {
    const s = this.s, w = this.w, c = this.c, R = w.fxRng;
    m.phase = 'recover'; m.t = 0;
    s.x = m.x1; s.y = m.y1;
    this.site = m.site; this.gz = m.tz; this.sc = m.site ? SITE_SC : 1;
    s.z = m.tz + CC.ride * (0.9 + 0.1 * this.sc);
    this.vx = this.vy = 0;
    this.goal[0] = s.x; this.goal[1] = s.y;
    this._pose(1);
    this._plantAll();
    this.comp = 0; this.compV = m.small ? 2.4 : m.exec ? 6 : 4.4;
    s.pitch = -0.05;
    const q = this._scr(this.M.world, 0, 0, 0), x = q[0], y = q[1];
    const big = m.exec ? 1.8 : m.small ? 0.7 : 1.2;
    w.g.camera.addTrauma(0.35 + 0.35 * big);
    w.g.renderer.post.shockwave(x, y, 0.03 * big, 0.022, 0.5 + 0.3 * big);
    if (m.exec || !m.small) w.g.renderer.post.flash(1, 0.55, 0.3, 0.12 * big, 0.04);
    if (m.exec) w.g.hitStop(4);
    this._shards(x, y, Math.round(14 * big), [0.45, 0.42, 0.4]);
    if (this.is3D) {
      const fx = this.view.fx;
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; fx.dust(s.x + Math.cos(a) * 120 * big, s.y + Math.sin(a) * 120 * big, this.gz, 1.4 * big, this.view.dustCol, 4); }
      fx.decal('crater', s.x, s.y, this.gz + 0.6, 90 * big, R.angle(), 3000);
      fx.decal('scorch', s.x, s.y, this.gz + 0.5, 180 * big, R.angle(), 3000);
      for (let k = 0; k < 12 * big; k++) fx._spark(s.x + R.range(-90, 90), s.y + R.range(-90, 90), this.gz + 2, 4);
      // Concrete chunks thrown out of the crater.
      for (let k = 0; k < 16 * big; k++) { const a = R.angle(), sp = R.range(1, 4); this.debris.push({ mesh: 'cc.chunk', x: s.x + Math.cos(a) * 60, y: s.y + Math.sin(a) * 60, z: this.gz + 4, rot: R.angle(), sx: R.range(3, 8), sy: R.range(3, 7), sz: R.range(2, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(2, 5), wx: R.range(-0.3, 0.3), wy: R.range(-0.3, 0.3), wz: R.range(-0.3, 0.3), ax: 0, ay: 0, az: 0, gz: this.gz, life: 0 }); }
    }
    for (let i = 0; i < 8; i++) this._print(i, 1, 1.25);
    if (c.state === 'fight' && m.ring) {
      P.ring(w, x, y, m.small ? { ...SPEC.land, n: 10 } : SPEC.land, w.rng.angle());
      if (!m.small) P.ring(w, x, y, SPEC.landRice, w.rng.angle());
    }
    if (m.onLand) m.onLand(x, y);
    sfx.play(m.small ? 'crawlerStep' : 'crawlerLand', { pan: (x - W / 2) / W, v: 1 });
  }

  _climb(m) {
    const s = this.s, st = m.site, side = m.side, w = this.w;
    m.t++;
    const face = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (m.phase === 'approach') {
      this.goal[0] = st.entry[0]; this.goal[1] = st.entry[1];
      this.hGoal = face; this.vmax = Math.max(this.vmax, 1.8);
      this._walk();
      if ((Math.hypot(s.x - st.entry[0], s.y - st.entry[1]) < 14 && Math.abs(wrapA(s.h - face)) < 0.12) || m.t > 300) {
        if (m.t > 300) { const cb = m.onDone; this._startLeap(st.cx, st.cy, st, { onDone: cb }); return; }
        m.phase = 'climb'; m.t = 0; m.a0 = Math.abs(s.x); m.y0 = s.y; m.z0 = s.z;
        sfx.play('hydraulic', { pan: side * 0.5 });
      }
      return;
    }
    if (m.phase === 'climb') {
      const T = 132, u = Math.min(1, m.t / T);
      const zTop = st.top + CC.ride * (0.9 + 0.1 * SITE_SC);
      let a, z, pitch;
      if (u < 0.3) { const k = sm(u / 0.3); a = lerp(m.a0, st.x0 - 70, k); z = lerp(m.z0, CC.ride + 34, k); pitch = 0.72 * k; }
      else if (u < 0.75) { const k = sm((u - 0.3) / 0.45); a = lerp(st.x0 - 70, st.x0 + 30, k); z = lerp(CC.ride + 34, zTop + 18, k); pitch = 0.72 + 0.2 * Math.sin(k * Math.PI) - 0.3 * k; }
      else { const k = sm((u - 0.75) / 0.25); a = lerp(st.x0 + 30, Math.abs(st.cx), k); z = lerp(zTop + 18, zTop, k); pitch = 0.42 * (1 - k); }
      s.x = side * a; s.y = lerp(m.y0, st.cy, sm(u)); s.z = z; s.pitch = pitch;
      s.h = wrapA(s.h + clamp(wrapA(face - s.h), -0.03, 0.03)); s.roll *= 0.9;
      this.forceGait = 0.03;
      if (u >= 0.72 && !this.site) { this.site = st; this.gz = st.top; }
      this.sc = lerp(1, SITE_SC, sm((u - 0.5) * 2));
      // Loose concrete shaken off the facade.
      if (this.is3D && m.t % 6 === 0) {
        const fx = this.view.fx, R = w.fxRng, y = s.y + R.range(-120, 120), z = R.range(10, st.top);
        fx.dust(side * (st.x0 - 4), y, z, 0.7, this.view.dustCol, 2);
        const i = fx.p.spawn(fx.F.chunk, side * (st.x0 - 4), y, z, -side * R.range(0.3, 1.2), R.range(-0.4, 0.4), R.range(0, 1), R.range(40, 70));
        if (i >= 0) { const P2 = fx.p; P2.s0[i] = P2.s1[i] = R.range(2, 4.5); P2.r[i] = P2.r1[i] = 0.45; P2.g[i] = P2.g1[i] = 0.43; P2.b[i] = P2.b1[i] = 0.4; P2.grav[i] = -0.14; P2.fade[i] = 3; P2.vr[i] = R.range(-0.2, 0.2); }
      }
      if (m.t % 26 === 0) sfx.play('climbScrape', { pan: side * 0.5 });
      // A few chunks rain onto the street as hazards.
      if (this.c.state === 'fight' && m.t % 24 === 12) {
        const q = this.cam.project(side * (st.x0 - 6), s.y + w.rng.range(-100, 100), st.top * 0.8, this.pr);
        if (q[1] > 0 && q[1] < H && q[0] > 0 && q[0] < W) P.shoot(w, q[0], q[1], Math.PI / 2 + w.rng.range(-0.3, 0.3), SPEC.debris.speed, SPEC.debris);
      }
      if (u >= 1) { m.phase = 'top'; m.t = 0; this.forceGait = 0; this.goal[0] = st.cx; this.goal[1] = st.cy; }
      return;
    }
    // top: settle on the pad and turn toward the pilot.
    this.goal[0] = st.cx; this.goal[1] = st.cy;
    this._facePlayer(1.2);
    this._walk();
    if (m.t > 44) { this.mv = null; if (m.onDone) m.onDone(); }
  }

  // ---------------------------------------------------------------- gait

  /** Home of leg i: where its foot rests for the current body pose (world). */
  _home(i, out) {
    const r = CC.rest[i], sc = this.sc;
    if (this.mv && this.mv.type === 'climb' && this.mv.phase === 'climb') M4.point(this.M.hull, r[0] * sc, r[1] * sc, -CC.ride, out);
    else { M4.point(this.M.world, r[0] * sc, r[1] * sc, 0, out); out[2] = this.gz; }
    return out;
  }

  /** Foothold for a desired point + reach limit from the hip. */
  _hold3(i, x, y, z, out) {
    const st = this.site && !(this.mv && this.mv.type === 'climb' && this.mv.phase !== 'top') ? this.site : null;
    footHold(x, y, z, out, st);
    const hp = CC.hips[i], hw = M4.point(this.M.hull, hp[0], hp[1], hp[2], this.h3);
    const dx = out[0] - hw[0], dy = out[1] - hw[1], dz = out[2] - hw[2], d = Math.hypot(dx, dy, dz);
    if (d > REACH) { const k = REACH / d; out[0] = hw[0] + dx * k; out[1] = hw[1] + dy * k; if (out[5] > 0.5) out[2] = Math.max(out[2], hw[2] + dz * k); }
    return out;
  }

  _plantAll() {
    const s = this.s, h = [0, 0, 0];
    for (let i = 0; i < 8; i++) {
      this._home(i, h);
      const f = this._hold3(i, h[0], h[1], h[2], this.fh);
      s.f[i * 3] = f[0]; s.f[i * 3 + 1] = f[1]; s.f[i * 3 + 2] = f[2];
      this.nrm[i][0] = f[3]; this.nrm[i][1] = f[4]; this.nrm[i][2] = f[5];
      this.legs[i].sw = false;
    }
  }

  _gait() {
    const s = this.s, m = this.mv;
    if (this.c.state === 'dying' && this.deathT > 0) return;
    if (m && m.type === 'leap' && m.phase === 'air') { this._airLegs(m); return; }
    if (m && m.type === 'leap' && m.phase === 'crouch') return;
    const vx = s.x - this.p.x, vy = s.y - this.p.y, sp = Math.hypot(vx, vy);
    const om = Math.abs(wrapA(s.h - this.p.h));
    const stride = clamp(38 + sp * 22, 44, 98) * (this.stompMode ? 1.2 : 1);
    let rate = (sp + om * 170 + Math.abs(s.z - this.p.z) * 0.5) / (2 * stride);
    const h = this.v3;
    let err = 0;
    for (let i = 0; i < 8; i++) { this._home(i, h); err = Math.max(err, Math.hypot(s.f[i * 3] - h[0], s.f[i * 3 + 1] - h[1], (s.f[i * 3 + 2] - h[2]) * 0.5)); }
    if (err > 16) rate = Math.max(rate, 0.012);
    if (this.forceGait) rate = Math.max(rate, this.forceGait);
    if (this.stompMode) rate = Math.max(rate, 0.016);
    rate = Math.min(rate, this.stompMode ? 0.022 : 0.045);
    this.gaitRate = rate;
    this.gp += rate;
    for (let i = 0; i < 8; i++) {
      const g = this.legs[i];
      const loc = frac(this.gp - GROUP[i] * 0.5 - RIPPLE[i]);
      const cross = loc < g.loc && g.loc - loc > 0.5;
      g.loc = loc;
      const fi = i * 3;
      if (!g.sw && cross) {
        this._home(i, h);
        if (Math.hypot(s.f[fi] - h[0], s.f[fi + 1] - h[1], s.f[fi + 2] - h[2]) > 5 || sp > 0.25) {
          g.sw = true; g.u = 0;
          g.dur = clamp(SWF / Math.max(rate, 0.008), 10, this.stompMode ? 40 : 34) * (this.dead.leg[i] ? 1.4 : 1);
          g.from[0] = s.f[fi]; g.from[1] = s.f[fi + 1]; g.from[2] = s.f[fi + 2];
          g.lift = (this.stompMode ? 78 : 22 + sp * 7) * (this.dead.leg[i] ? 0.45 : 1);
          g.zone = null;
          if (this.stompMode && this.act && this.act.type === 'stomp' && i % 4 < 2) g.zone = this._stompZone(i);
        }
      }
      if (!g.sw) continue;
      g.u += 1 / g.dur;
      // Target: ahead of home by the body's travel for the rest of the swing + half a stance.
      this._home(i, h);
      const ahead = (1 - g.u) * g.dur + ((1 - SWF) / Math.max(rate, 0.01)) * 0.5;
      let lx = vx * ahead, ly = vy * ahead;
      const ll = Math.hypot(lx, ly), lm = stride * 0.55;
      if (ll > lm) { lx *= lm / ll; ly *= lm / ll; }
      const t = this._hold3(i, h[0] + lx, h[1] + ly, h[2], this.fh);
      g.to[0] = t[0]; g.to[1] = t[1]; g.to[2] = t[2];
      if (g.zone) { g.zone.x = t[0]; g.zone.y = t[1]; g.zone.z = t[2]; }
      const n = this.nrm[i]; n[0] = t[3]; n[1] = t[4]; n[2] = t[5];
      const e = sm(g.u), up = Math.sin(Math.min(1, g.u) * Math.PI) * g.lift;
      s.f[fi] = lerp(g.from[0], g.to[0], e) - n[0] * up * 0.4;
      s.f[fi + 1] = lerp(g.from[1], g.to[1], e);
      s.f[fi + 2] = lerp(g.from[2], g.to[2], e) + up * (n[2] > 0.5 ? 1 : 0.5);
      if (g.u >= 1) {
        g.sw = false;
        s.f[fi] = g.to[0]; s.f[fi + 1] = g.to[1]; s.f[fi + 2] = g.to[2];
        this._footfall(i, g);
      }
    }
  }

  /** Airborne: legs tuck under the hull, then reach for the landing surface. */
  _airLegs(m) {
    const s = this.s, u = m.t / m.T, q = this.v3;
    const reach = sm((u - 0.62) / 0.38), tuck = 1 - reach;
    for (let i = 0; i < 8; i++) {
      const r = CC.rest[i], k = lerp(0.62, 1, reach) * this.sc;
      M4.point(this.M.hull, r[0] * k, r[1] * k, lerp(-CC.ride * 0.45, -CC.ride - 14, reach) + tuck * 6 * Math.sin(this.t * 0.3 + i), q);
      const fi = i * 3;
      s.f[fi] += (q[0] - s.f[fi]) * 0.35; s.f[fi + 1] += (q[1] - s.f[fi + 1]) * 0.35; s.f[fi + 2] += (q[2] - s.f[fi + 2]) * 0.35;
      this.nrm[i][0] = 0; this.nrm[i][1] = 0; this.nrm[i][2] = 1;
    }
  }

  /** A foot lands: compression, dust, sparks, a print at the contact, a thud. */
  _footfall(i, g) {
    const s = this.s, w = this.w, fi = i * 3, x = s.f[fi], y = s.f[fi + 1], z = s.f[fi + 2], n = this.nrm[i];
    const sp = Math.hypot(this.vx, this.vy), stomp = this.stompMode && this.act && this.act.type === 'stomp';
    const k = stomp ? 2.4 : 0.6 + sp * 0.25;
    this.compV += stomp ? 1.2 : 0.18 + sp * 0.05;
    if (n[2] > 0.5) this._print(i, stomp ? 1 : 0.65 + Math.min(0.3, sp * 0.1), stomp ? 1.25 : 1);
    if (this.is3D) {
      const fx = this.view.fx, R = w.fxRng;
      fx.dust(x, y, z, 0.5 * k, this.view.dustCol, stomp ? 6 : 2);
      if (R.chance(0.3 + sp * 0.15) || stomp) fx._spark(x + R.range(-8, 8), y + R.range(-8, 8), z + 2, stomp ? 10 : 4);
      if (stomp) fx.decal('crater', x, y, z + 0.4, 46, R.angle(), 2400);
    }
    const q = this.cam.project(x, y, z, this.pr);
    if (stomp) {
      w.g.camera.addTrauma(0.22);
      w.g.renderer.post.shockwave(q[0], q[1], 0.018, 0.02, 0.35);
      this.flashes.push({ x: q[0], y: q[1], ang: 0, t: 0, life: 18, kind: 'stomp' });
      if (g && g.zone && this.c.state === 'fight') { P.ring(w, q[0], q[1], SPEC.stomp, w.rng.angle()); g.zone.life = g.zone.t + 6; }
      sfx.play('crawlerLand', { pan: (q[0] - W / 2) / W, v: 0.6 });
    } else {
      if (sp > 1.4 && this.t % 2 === 0) w.g.camera.addTrauma(0.025 * sp);
      if (this.stepD <= 0) { sfx.play('crawlerStep', { pan: (q[0] - W / 2) / W, v: Math.min(1, 0.35 + sp * 0.25) }); this.stepD = 7; }
    }
  }

  _stompZone(i) {
    const z = { x: 0, y: 0, z: 0, r: 40, t: 0, life: 200, kind: 'stomp' };
    this.zones.push(z);
    void i;
    return z;
  }

  // -------------------------------------------------------------- prints

  /** Footprint stamp at leg i's contact (aligned with the leg's outward direction). */
  _print(i, a = 0.7, scale = 1) {
    const s = this.s, fi = i * 3;
    if (this.nrm[i][2] < 0.5) return;
    const hp = CC.hips[i], hw = M4.point(this.M.hull, hp[0], hp[1], 0, this.h3);
    const rot = Math.atan2(s.f[fi] - hw[0], s.f[fi + 1] - hw[1]);
    this.prints.push({ x: s.f[fi], y: s.f[fi + 1], z: s.f[fi + 2] + 0.5, rot, s: 44 * scale, a, t: 0, life: 2400 });
    if (this.prints.length > 200) this.prints.shift();
    this.printDirty = true;
  }

  _updatePrints() {
    const cy = this.cam.cy || 0;
    for (let i = this.prints.length - 1; i >= 0; i--) {
      const p = this.prints[i];
      if (++p.t >= p.life || p.y < cy - 1200) { this.prints.splice(i, 1); this.printDirty = true; }
    }
    if (!this.printDirty && this.t % 30) return;
    this.printDirty = false;
    const D = this.printData;
    let o = 0;
    for (const p of this.prints) {
      const fade = Math.min(1, (p.life - p.t) / 300) * p.a, c = Math.cos(p.rot), sn = Math.sin(p.rot), h = p.s / 2;
      const P2 = (u, v) => [p.x + (u - 0.5) * 2 * h * c + (v - 0.5) * 2 * h * sn, p.y - (u - 0.5) * 2 * h * sn + (v - 0.5) * 2 * h * c];
      const q = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
      for (const [u, v] of q) { const [x, y] = P2(u, v); D[o++] = x; D[o++] = y; D[o++] = p.z; D[o++] = u; D[o++] = v; D[o++] = fade; }
    }
    this.printN = o / 6;
  }

  // --------------------------------------------------------------- pose

  _pose(alpha) {
    const s = this.s, p = this.p, M = this.M, T = M.tmp;
    const L = (k) => lerp(p[k], s[k], alpha);
    const x = L('x'), y = L('y'), z = L('z'), h = p.h + wrapA(s.h - p.h) * alpha;
    const Wm = M.world;
    M4.trans(x, y, this.gz, Wm); M4.mul(Wm, M4.rotZ(-h, T), Wm);
    const Hm = M.hull;
    M4.trans(x, y, z, Hm); M4.mul(Hm, M4.rotZ(-h, T), Hm); M4.mul(Hm, M4.rotX(L('pitch'), T), Hm); M4.mul(Hm, M4.rotY(L('roll'), T), Hm);
    invRigid(Hm, M.inv);
    // Legs: IK from the hull to each foot.
    const f = this.v3;
    for (let i = 0; i < 8; i++) {
      const fi = i * 3, fx = lerp(p.f[fi], s.f[fi], alpha), fy = lerp(p.f[fi + 1], s.f[fi + 1], alpha), fz = lerp(p.f[fi + 2], s.f[fi + 2], alpha);
      M4.point(M.inv, fx, fy, fz, f);
      const hp = CC.hips[i];
      let dx = f[0] - hp[0], dy = f[1] - hp[1];
      if (Math.hypot(dx, dy) < 4) { dx = CC.rest[i][0] - hp[0]; dy = CC.rest[i][1] - hp[1]; }
      const psi = Math.atan2(dy, dx), cu = Math.cos(psi), su = Math.sin(psi);
      const C = [hp[0] + cu * CC.coxa, hp[1] + su * CC.coxa, hp[2] + CC.coxaZ];
      const r = Math.max(8, Math.hypot(dx, dy) - CC.coxa), hz = f[2] - C[2];
      const d = clamp(Math.hypot(r, hz), Math.abs(L1 - L2) + 4, L1 + L2 - 2);
      const phi = Math.atan2(hz, r);
      const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const th = phi + al;
      const K = [C[0] + cu * L1 * Math.cos(th), C[1] + su * L1 * Math.cos(th), C[2] + L1 * Math.sin(th)];
      const Tp = [C[0] + cu * d * Math.cos(phi), C[1] + su * d * Math.cos(phi), C[2] + d * Math.sin(phi)];
      const X = [su, -cu, 0];
      frameM(hp, X, [cu, su, 0], [0, 0, 1], M.loc); M4.mul(Hm, M.loc, M.coxa[i]);
      const Yf = [cu * Math.cos(th), su * Math.cos(th), Math.sin(th)];
      frameM(C, X, Yf, cross(X, Yf), M.loc); M4.mul(Hm, M.loc, M.femur[i]);
      const tl = Math.hypot(Tp[0] - K[0], Tp[1] - K[1], Tp[2] - K[2]) || 1;
      const Yt = [(Tp[0] - K[0]) / tl, (Tp[1] - K[1]) / tl, (Tp[2] - K[2]) / tl];
      frameM(K, X, Yt, cross(X, Yt), M.loc); M4.mul(Hm, M.loc, M.tibia[i]);
      M4.point(Hm, K[0], K[1], K[2], this.knee[i]);
      // Foot: at the tibia's end, flat on its surface, pointing along the leg.
      const tw = M4.point(Hm, Tp[0], Tp[1], Tp[2], [0, 0, 0]), uw = M4.dir(Hm, cu, su, 0, [0, 0, 0]), n = this.nrm[i];
      const dn = uw[0] * n[0] + uw[1] * n[1] + uw[2] * n[2];
      let Y = [uw[0] - n[0] * dn, uw[1] - n[1] * dn, uw[2] - n[2] * dn];
      const yl = Math.hypot(Y[0], Y[1], Y[2]) || 1; Y = [Y[0] / yl, Y[1] / yl, Y[2] / yl];
      frameM(tw, cross(Y, n), Y, n, M.foot[i]);
      if (i === 0 || i === 4) { M4.mul(M.femur[i], M4.trans(CC.legGun[0], CC.legGun[1], CC.legGun[2], T), M.legGun[i ? 1 : 0]); }
    }
    // Weapons.
    for (let i = 0; i < 2; i++) {
      const LA = (k) => lerp(p[k][i], s[k][i], alpha);
      const hc = CC.hc[i];
      M4.mul(Hm, M4.trans(hc[0], hc[1], hc[2], T), M.hc[i]); M4.mul(M.hc[i], M4.rotZ(LA('hcY'), T), M.hc[i]);
      M4.mul(M.hc[i], M4.trans(CC.hcBarrel[0], CC.hcBarrel[1] - LA('hcR') * 9, CC.hcBarrel[2], T), M.hcb[i]);
      const rt = CC.rot[i];
      M4.mul(Hm, M4.trans(rt[0], rt[1], rt[2] - 6.7 + LA('rotD') * 6.7, T), M.rot[i]); M4.mul(M.rot[i], M4.rotZ(LA('rotY'), T), M.rot[i]);
      M4.mul(M.rot[i], M4.trans(CC.rotor[0], CC.rotor[1], CC.rotor[2], T), M.rotor[i]); M4.mul(M.rotor[i], M4.rotY(LA('rotS'), T), M.rotor[i]);
      const pd = CC.pod[i];
      M4.mul(Hm, M4.trans(pd[0], pd[1], pd[2] + 9, T), M.pod[i]); M4.mul(M.pod[i], M4.rotZ(Math.PI, T), M.pod[i]); M4.mul(M.pod[i], M4.rotX(CC.podPitch, T), M.pod[i]);
      M4.mul(M.pod[i], M4.trans(0, 11.4, 7.4, T), M.podc[i]); M4.mul(M.podc[i], M4.rotX(LA('pod') * 1.8, T), M.podc[i]);
      const mo = CC.mort[i];
      M4.mul(Hm, M4.trans(mo[0], mo[1], mo[2], T), M.mort[i]); M4.mul(M.mort[i], M4.rotZ(LA('mortY'), T), M.mort[i]);
      M4.mul(M.mort[i], M4.trans(CC.mortTube[0], CC.mortTube[1], CC.mortTube[2], T), M.mortt[i]); M4.mul(M.mortt[i], M4.rotX(LA('mortE'), T), M.mortt[i]);
      // Repair arms: shoulders on the spine, unfolding over the deck.
      const ar = L('arm'), sd = i ? 1 : -1;
      M4.mul(Hm, M4.trans(sd * 12, CC.spine[1] + 15, CC.spine[2] + 1.5, T), M.armA[i]);
      M4.mul(M.armA[i], M4.rotZ(sd * (0.4 + ar * 0.9) + Math.sin(this.t * 0.05 + i) * 0.25 * ar, T), M.armA[i]);
      M4.mul(M.armA[i], M4.rotX(-0.2 + ar * 0.9, T), M.armA[i]);
      M4.mul(M.armA[i], M4.trans(0, CC.armA, 0, T), M.armB[i]);
      M4.mul(M.armB[i], M4.rotX(-0.4 - ar * 1.6 + Math.sin(this.t * 0.09 + i * 2) * 0.2 * ar, T), M.armB[i]);
    }
    const pl = L('plate');
    M4.mul(Hm, M4.trans(-1.5, -10, 34, T), M.plateL); M4.mul(M.plateL, M4.rotY(pl * 1.9, T), M.plateL);
    M4.mul(Hm, M4.trans(1.5, -10, 34, T), M.plateR); M4.mul(M.plateR, M4.rotY(-pl * 1.9, T), M.plateR);
    M4.mul(Hm, M4.trans(0, 0, 32.5 + pl * 2, T), M.repair);
  }

  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.q3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Screen position + firing angle of a muzzle (local point, local +y axis). */
  _muzzle(m, pt, out = {}) {
    const a = this._scr(m, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1];
    const b = this._scr(m, pt[0], pt[1] + 40, pt[2]);
    out.x = ax; out.y = ay; out.ang = Math.atan2(b[1] - ay, b[0] - ax);
    return out;
  }

  /** Yaw (local Rz) that points a hull-mounted pivot at world point t. */
  _yawTo(pivot, t) {
    const s = this.s, ch = Math.cos(s.h), sh = Math.sin(s.h);
    const dx = t[0] - s.x, dy = t[1] - s.y;
    const lx = dx * ch - dy * sh - pivot[0], ly = dx * sh + dy * ch - pivot[1];
    return Math.atan2(-lx, ly);
  }

  _pWorld(lead = 0, out = [0, 0, 0]) {
    const w = this.w;
    return this._world(clamp(w.aimX + this.pvx * lead, 10, W - 10), clamp(w.aimY + this.pvy * lead, 10, H - 10), 0, out);
  }

  // ------------------------------------------------------------ weapons

  _weaponsAnim() {
    const s = this.s, live = this.c.state === 'fight';
    const pw = this._pWorld(0, [0, 0, 0]);
    for (let i = 0; i < 2; i++) {
      if (!this.dead.hc[i]) {
        const t = this.hcAim[i] || pw;
        const want = live ? clamp(wrapA(this._yawTo(CC.hc[i], t)), -0.8, 0.8) : 0;
        s.hcY[i] += clamp(wrapA(want - s.hcY[i]), -0.035, 0.035);
      }
      s.hcR[i] *= 0.82;
      this.hcGlow[i] *= 0.92;
      if (!this.dead.rot[i]) {
        const rest = i ? -0.35 : 0.35;
        const want = this.rotAim[i] !== null ? this.rotAim[i] : live && s.rotD[i] > 0.5 ? clamp(wrapA(this._yawTo(CC.rot[i], pw)), -1.2, 1.2) : rest;
        s.rotY[i] += clamp(wrapA(want - s.rotY[i]), -0.05, 0.05);
        s.rotD[i] += clamp(this.rotT[i] - s.rotD[i], -0.04, 0.04);
        this.rotV[i] += ((this.rotT[i] > 0.5 ? (this.heat[i] > 0.1 ? 0.8 : 0.3) : 0) - this.rotV[i]) * 0.06;
        s.rotS[i] += this.rotV[i];
      } else s.rotD[i] = Math.max(0, s.rotD[i] - 0.05);
      s.pod[i] += clamp((this.dead.pod[i] ? 0 : this.podT[i]) - s.pod[i], -0.06, 0.06);
      if (!this.dead.mort[i]) {
        const t = this.mortAim[i];
        const want = t ? clamp(wrapA(this._yawTo(CC.mort[i], t) - Math.PI), -1.4, 1.4) + Math.PI : Math.PI;
        s.mortY[i] += clamp(wrapA(want - s.mortY[i]), -0.04, 0.04);
        s.mortE[i] += clamp(this.mortT[i] - s.mortE[i], -0.03, 0.03);
      }
      this.heat[i] = Math.max(0, this.heat[i] - 0.02); this.heat[i + 2] = Math.max(0, this.heat[i + 2] - 0.02);
    }
    s.plate += clamp(this.plateT - s.plate, -0.025, 0.025);
    s.arm += clamp(this.armT - s.arm, -0.02, 0.02);
    this.eye += (this.eyeT * (this.coreOK ? 1 : 0.15) - this.eye) * 0.06;
    this.eyeT = this.co ? this.eyeT : this.critical ? 1.1 : 0.55;
    if (this.stepD > 0) this.stepD--;
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

  _mountW(kind, i, out = [0, 0, 0]) {
    const M = this.M;
    if (kind === 'hc') return M4.point(M.hc[i], 0, 0, 12, out);
    if (kind === 'rot') return M4.point(M.rot[i], 0, 4, 10, out);
    if (kind === 'pod') return M4.point(M.pod[i], 0, 0, -8, out);
    if (kind === 'mort') return M4.point(M.mort[i], 0, 4, 10, out);
    if (kind === 'core') return M4.point(M.hull, 0, 98, 22, out);
    const k = this.knee[i]; out[0] = k[0]; out[1] = k[1]; out[2] = k[2]; return out;
  }

  _mountPt(kind, i) { const q = this._mountW(kind, i, this.h3); return this.cam.project(q[0], q[1], q[2], this.pr); }

  partDestroyed(kind, i) {
    const w = this.w, R = w.fxRng;
    this.dead[kind][i] = true;
    const p = this._mountPt(kind, i), x = p[0], y = p[1];
    const big = kind === 'core' ? 1.9 : kind === 'leg' ? 1 : 1.3;
    w.explosions.blast(x, y, big, [1, 0.4, 0.3]);
    w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-16, 16), y + R.range(-12, 12), 0.9, [1, 0.35, 0.25]));
    w.explosions.sparks(x, y, 30, [1, 0.6, 0.4], 6, 32, 4);
    w.g.camera.addTrauma(kind === 'core' ? 0.55 : 0.3);
    w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35);
    this._shards(x, y, 12);
    sfx.play('partDown', { pan: (x - W / 2) / W });
    if (kind === 'core') {
      sfx.play('engineFail', { pan: 0 });
      if (this.co && this.co.phase !== 'cool') { if (this.co.laser) this.co.laser.dead = true; this.co.phase = 'cool'; this.co.t = 0; }
      if (this.act && this.act.type === 'regen' && this.act.phase === 'repair') this._repairStop('REPAIR INTERRUPTED — CORE DOWN');
    }
    if (kind === 'rot') { this.rotT[i] = 0; this.rotAim[i] = null; }
    if (kind === 'pod') this.podT[i] = 0;
    if (kind === 'leg') { this._callout('LEG ACTUATOR DESTROYED', 'gold'); this.compV += 2; this.s.roll += (i < 4 ? -1 : 1) * 0.04; }
    this.fires.push({ kind, i, s: kind === 'core' ? 1.1 : kind === 'leg' ? 0.55 : 0.75 });
  }

  /** Part hitboxes ride their projected 3D mounts (kept inside the World's bounds). */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const d = part.d, pe = part.e;
      const q = this._mountPt(d.mount, d.side);
      pe.x = clamp(q[0], -18, W + 18); pe.y = clamp(q[1], -18, H + 18);
      if (this.is3D) pe.f = null;
    }
  }

  /** Contact: the hull's projected footprint is solid (not while airborne high). */
  _contact() {
    const c = this.c, p = this.w.player;
    if (c.state !== 'fight' || (this.airborne && this.s.z - this.gz > 110)) { this.quad = null; return; }
    const q = [];
    for (const [lx, ly] of [[-52, -94], [52, -94], [52, 112], [-52, 112]]) { const a = this._scr(this.M.hull, lx, ly, 24); q.push(a[0], a[1]); }
    this.quad = q;
    if (p && p.collidable && !p.invulnerable && inQuad(q, p.x, p.y, -6)) p.hit();
  }

  // ---------------------------------------------------------- heavy queue

  _canHeavy(name) {
    if (this.c.state !== 'fight' || this._blocking()) { if (!this.queue) this.queue = name; return false; }
    if (this.heavy) { if (!this.queue && this.heavy !== name) this.queue = name; return false; }
    return true;
  }

  /** Acts and movements that keep new heavy attacks waiting (holding a roof or dashing does not). */
  _blocking() {
    const a = this.act, m = this.mv;
    return !!(a && a.type !== 'roof' && !(a.type === 'evade' && a.phase === 'dash')) || !!(m && m.type !== 'climb');
  }

  _heavyDone(name) { if (this.heavy === name) this.heavy = null; }

  _runQueue() {
    if (!this.queue || this.heavy || this.c.state !== 'fight' || this._blocking()) return;
    const q = this.queue;
    this.queue = null;
    if (q === 'flak') this.startFlak();
    else if (q === 'artillery') this.startArtillery();
    else if (q === 'suppress') this.startSuppression();
    else if (q === 'core') this.startCore();
    else if (q === 'missiles') this.startMissiles();
    else if (q === 'stomp') this.startFootfall();
  }

  // ------------------------------------------- 1. SIEGE CORE BARRAGE

  /** Twin heavy cannons: wind-up glow, staggered shells that speed up, alternating last-seen / predicted aim. */
  siegeBarrage(t, rate = 1) {
    const c = this.c, w = this.w;
    if (c.state !== 'fight' || this.quiet || this.su || (this.dead.hc[0] && this.dead.hc[1])) return;
    const r = rate * this.rate, K = Math.round(230 / r), ph = t % K, cyc = Math.floor(t / K);
    const SHOTS = [0, 20, 36, 50, 62, 72, 80];
    if (ph === 0) this.lastSeen = this._pWorld(0, [0, 0, 0]);
    if (ph < 28) {
      for (let i = 0; i < 2; i++) if (!this.dead.hc[i]) { this.hcGlow[i] = ph / 28; this.hcAim[i] = this.lastSeen; }
      if (ph % 3 === 0 && ph > 6) for (let i = 0; i < 2; i++) if (!this.dead.hc[i]) { const mz = this._muzzle(this.M.hcb[i], CC.hcMuzzle); this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 520, t: 0, life: 3, k: ph / 28, col: [2.4, 0.3, 0.3] }); }
      return;
    }
    const j = SHOTS.indexOf(ph - 28);
    if (j < 0) { if (ph > 28 + 90) this.hcAim[0] = this.hcAim[1] = null; return; }
    const i = (j + cyc) & 1 ? 1 : 0, gun = this.dead.hc[i] ? 1 - i : i;
    // Even shots at the last seen position, odd ones lead the pilot's movement.
    this.hcAim[gun] = j & 1 ? this._pWorld(26, [0, 0, 0]) : this.lastSeen;
    this._hcShot(gun, j % 3 === 2 ? SPEC.shellSplit : SPEC.shell, j & 1 ? 26 : 0);
    void w;
  }

  _hcShot(i, spec, lead = 0) {
    const w = this.w, m = this.M.hcb[i];
    const mz = this._muzzle(m, CC.hcMuzzle, this.mzH || (this.mzH = {}));
    const ta = Math.atan2(clamp(w.aimY + this.pvy * lead, 0, H) - mz.y, clamp(w.aimX + this.pvx * lead, 0, W) - mz.x);
    const ang = mz.ang + clamp(wrapA(ta - mz.ang), -0.25, 0.25);
    P.shoot(w, mz.x, mz.y, ang, spec.speed, spec);
    P.fan(w, mz.x, mz.y, ang, SPEC.shellFan);
    this.s.hcR[i] = 1; this.hcGlow[i] = 0; this.kick += 0.006;
    this.flashes.push({ x: mz.x, y: mz.y, ang, t: 0, life: 10, kind: 'cannon', w: M4.point(m, 0, CC.hcMuzzle[1] + 4, 0, [0, 0, 0]) });
    if (this.is3D) { const q = M4.point(m, 0, CC.hcMuzzle[1], 0, [0, 0, 0]); this.view.fx._smoke(q[0], q[1], q[2], 0.4, 0.5, 0.5); }
    sfx.play('heavyCannon', { pan: (mz.x - W / 2) / W });
  }

  // ------------------------------------------- 2. CRIMSON FLAK STORM

  startFlak(volleys = 0) {
    if (this.dead.rot[0] && this.dead.rot[1]) return false;
    if (!this._canHeavy('flak')) return false;
    this.heavy = 'flak';
    this.fk = { phase: 'spin', t: 0, v: 0, n: volleys || (3 + (this.c.mk >= 2 ? 1 : 0)), off: this.w.rng.range(-0.1, 0.1) };
    this.rotT[0] = this.rotT[1] = 1;
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateFlak() {
    const f = this.fk, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight' || (this.dead.rot[0] && this.dead.rot[1]) || (this.act && this.act.quiet)) { this._endFlak(); return; }
    f.t++;
    if (f.phase === 'spin') {
      if (f.t > 10 && f.t % 2 === 0) for (let i = 0; i < 2; i++) if (!this.dead.rot[i]) { const mz = this._muzzle(this.M.rotor[i], CC.rotMuzzle); this.lines.push({ x: mz.x, y: mz.y, ang: mz.ang, len: 420, t: 0, life: 3, k: f.t / 34, col: [2.2, 0.4, 1.2] }); }
      this.heat[0] = this.heat[1] = 0.3;
      if (f.t >= 34) { f.phase = 'fire'; f.t = 0; sfx.play('rotaryCannon', { pan: 0 }); }
    } else if (f.phase === 'fire') {
      const T = 96, u = f.t / T;
      for (let i = 0; i < 2; i++) {
        if (this.dead.rot[i]) continue;
        // Each rotary sweeps from its side inward and back: the streams fan out from the flanks.
        const dir = i ? -1 : 1, k = (f.v & 1) ? 1 - u : u;
        this.rotAim[i] = (i ? -1 : 1) * (1.1 - 1.0 * k) * dir * dir + (i ? 0.1 : -0.1);
        const ev = Math.max(3, Math.round(5 / this.rate));
        if ((f.t + i * 2) % ev === 0) this._rotShot(i, SPEC.rot);
      }
      // The front battery: radial fans of magenta shells with walking gaps.
      const be = Math.max(18, Math.round(32 / this.rate));
      if (f.t % be === 4) this._batteryFan(f.off + ((f.t / be) & 1 ? 0.08 : -0.08));
      // Front-leg guns: yellow kunai pairs.
      if (f.t % 18 === 9) this._legGuns();
      if (f.t >= T) { f.phase = 'gap'; f.t = 0; this.rotAim[0] = this.rotAim[1] = null; }
    } else if (f.phase === 'gap') {
      if (f.t >= 34) {
        f.v++;
        if (f.v >= f.n) { f.phase = 'retract'; f.t = 0; this.rotT[0] = this.rotT[1] = 0; }
        else { f.phase = 'fire'; f.t = 0; f.off = w.rng.range(-0.12, 0.12); }
      }
    } else if (f.phase === 'retract' && f.t >= 36) this._endFlak();
  }

  _rotShot(i, spec) {
    const mz = this._muzzle(this.M.rotor[i], CC.rotMuzzle, this.mzR || (this.mzR = {}));
    P.fan(this.w, mz.x, mz.y, mz.ang, spec);
    this.heat[i] = Math.min(1, this.heat[i] + 0.2);
    this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 4, kind: 'rotary', w: M4.point(this.M.rotor[i], 0, CC.rotMuzzle[1], 0, [0, 0, 0]) });
    if (this.t % 6 === 0) sfx.play('rotaryCannon', { pan: (mz.x - W / 2) / W });
  }

  /** Battery fan from the front lip (direction: the hull's forward on screen). */
  _batteryFan(off = 0, spec = SPEC.batt) {
    const w = this.w, Hm = this.M.hull;
    const a = this._scr(Hm, 0, 104, 9).slice(), b = this._scr(Hm, 0, 140, 9);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + off;
    P.fan(w, a[0], a[1], ang, spec);
    for (const k of [0, 2, 3, 5]) { const bt = CC.battery[k], q = this._scr(Hm, bt[0], bt[1] + CC.batteryMuzzle, bt[2]); this.flashes.push({ x: q[0], y: q[1], ang, t: 0, life: 6, kind: 'rotary', w: M4.point(Hm, bt[0], bt[1] + CC.batteryMuzzle, bt[2], [0, 0, 0]) }); }
    sfx.play('autoCannon', { pan: (a[0] - W / 2) / W });
  }

  /** Battery bolts: red streaks from each barrel (the forward cone only). */
  _batteryBolts(spread = 0.25) {
    const w = this.w, Hm = this.M.hull;
    for (const bt of CC.battery) {
      const q = this._scr(Hm, bt[0], bt[1] + CC.batteryMuzzle, bt[2]).slice(), q2 = this._scr(Hm, bt[0], bt[1] + CC.batteryMuzzle + 40, bt[2]);
      const ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]) + w.rng.range(-spread, spread);
      P.shoot(w, q[0], q[1], ang, SPEC.battBolt.speed, SPEC.battBolt);
    }
  }

  /** Front-leg guns: restricted forward arc (only while the leg points forward). */
  _legGuns() {
    const w = this.w;
    for (const [k, li] of [[0, 0], [1, 4]]) {
      if (this.dead.leg[li]) continue;
      const m = this.M.legGun[k], a = this._scr(m, 0, CC.legGunMuzzle[1], 2).slice();
      const f = this._scr(this.M.hull, 0, 0, 0).slice(), fwd = this._scr(this.M.hull, 0, 60, 0);
      const base = Math.atan2(fwd[1] - f[1], fwd[0] - f[0]);
      const aim = w.aimAngle(a[0], a[1]);
      P.fan(w, a[0], a[1], base + clamp(wrapA(aim - base), -0.5, 0.5), SPEC.kunai);
      this.flashes.push({ x: a[0], y: a[1], ang: base, t: 0, life: 4, kind: 'rotary' });
    }
  }

  _endFlak() { this.fk = null; this.rotAim[0] = this.rotAim[1] = null; if (!this.su) this.rotT[0] = this.rotT[1] = 0; this._heavyDone('flak'); }

  // ------------------------------------------- 3. ARTILLERY COLLAPSE

  startArtillery(n = 0) {
    if (this.dead.mort[0] && this.dead.mort[1]) return false;
    if (!this._canHeavy('artillery')) return false;
    this.heavy = 'artillery';
    this.ar = { phase: 'elevate', t: 0, k: 0, n: n || (6 + 2 * (this.c.mk - 1)) };
    this.mortT[0] = this.mortT[1] = 1.15;
    this._callout('INCOMING ARTILLERY', 'red');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateArtillery() {
    const a = this.ar, w = this.w;
    if (!a) return;
    if (this.c.state !== 'fight' || (this.dead.mort[0] && this.dead.mort[1]) || (this.act && this.act.quiet)) { this._endArtillery(); return; }
    a.t++;
    if (a.phase === 'elevate') {
      for (let i = 0; i < 2; i++) this.mortAim[i] = this._pWorld(0, [0, 0, 0]);
      if (a.t >= 26) { a.phase = 'fire'; a.t = 0; }
    } else if (a.phase === 'fire') {
      const gap = Math.max(10, Math.round(17 / this.rate));
      if (a.t % gap === 1 && a.k < a.n) {
        const i = this.dead.mort[a.k & 1] ? (a.k & 1) ^ 1 : a.k & 1;
        // Targets: the pilot, the predicted spot, then brackets across the lanes below the crawler.
        const kind = a.k % 3;
        let sx = w.aimX, sy = w.aimY;
        if (kind === 1) { sx += this.pvx * 50; sy += this.pvy * 50; }
        else if (kind === 2) { sx += w.rng.sign() * w.rng.range(70, 120); sy += w.rng.range(-80, 40); }
        const tg = this._world(clamp(sx, 30, W - 30), clamp(sy, HOME_ROW + 90, H - 30), 0, [0, 0, 0]);
        this.mortAim[i] = tg;
        this._mortarShot(i, tg, a.k % 2 === 0);
        a.k++;
      }
      if (a.k >= a.n && a.t > a.n * gap + 20) this._endArtillery();
    }
  }

  _mortarShot(i, tg, burst) {
    const w = this.w, m = this.M.mortt[i];
    const mz = M4.point(m, 0, CC.mortMuzzle[1], 0, [0, 0, 0]);
    const T = 58;
    this.shells.push({ x0: mz[0], y0: mz[1], z0: mz[2], x1: tg[0], y1: tg[1], z1: 0, t: 0, T, r: 46, burst, apex: 230, trail: [] });
    this.zones.push({ x: tg[0], y: tg[1], z: 0.5, r: 46, t: 0, life: T, kind: 'shell' });
    const q = this.cam.project(mz[0], mz[1], mz[2], this.pr);
    this.flashes.push({ x: q[0], y: q[1], ang: -Math.PI / 2, t: 0, life: 10, kind: 'mortar', w: mz });
    this.kick -= 0.004;
    if (this.is3D) for (let k = 0; k < 3; k++) this.view.fx._smoke(mz[0], mz[1], mz[2] + 4, 0.5, 0.45, 1.2);
    sfx.play('mortarLaunch', { pan: (q[0] - W / 2) / W });
  }

  /** Real shells on a 3D arc; impact detonates on the marked zone. */
  _updateShells() {
    const w = this.w, R = w.fxRng;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const sh = this.shells[k];
      sh.t++;
      const u = sh.t / sh.T;
      sh.x = lerp(sh.x0, sh.x1, u); sh.y = lerp(sh.y0, sh.y1, u); sh.z = lerp(sh.z0, sh.z1, u) + 4 * sh.apex * u * (1 - u);
      if (sh.t % 2 === 0) { sh.trail.push(sh.x, sh.y, sh.z); if (sh.trail.length > 36) sh.trail.splice(0, 3); }
      if (sh.t < sh.T) continue;
      this.shells.splice(k, 1);
      const q = this.cam.project(sh.x1, sh.y1, 0, this.pr), x = q[0], y = q[1], rs = sh.r * q[2];
      w.explosions.blast(x, y, 1.15, [1, 0.5, 0.2]);
      w.g.camera.addTrauma(0.16);
      w.g.renderer.post.shockwave(x, y, 0.015, 0.02, 0.3);
      if (this.is3D) { const fx = this.view.fx; fx.decal('crater', sh.x1, sh.y1, 0.5, sh.r * 1.1, R.angle(), 2400); fx.dust(sh.x1, sh.y1, 0, 1.3, this.view.dustCol, 6); for (let j = 0; j < 4; j++) fx._spark(sh.x1, sh.y1, 2, 5); }
      const p = w.player;
      if (this.c.state === 'fight' && p && p.collidable && !p.invulnerable && Math.hypot(p.x - x, p.y - y) < rs + p.hitR) p.hit();
      if (this.c.state === 'fight' && sh.burst) P.ring(w, x, y, SPEC.mortRing, w.rng.angle());
      sfx.play('shellImpact', { pan: (x - W / 2) / W });
    }
  }

  _endArtillery() { this.ar = null; this.mortT[0] = this.mortT[1] = 0.7; this.mortAim[0] = this.mortAim[1] = null; this._heavyDone('artillery'); }

  // ------------------------------------------- 4. EIGHTFOLD SUPPRESSION

  startSuppression() {
    if (!this._canHeavy('suppress')) return false;
    this.heavy = 'suppress';
    this.su = { t: 0, lanes: null };
    this.rotT[0] = this.rotT[1] = 1; this.podT[0] = this.podT[1] = 1;
    this._callout('EIGHTFOLD SUPPRESSION', 'red');
    return true;
  }

  /**
   * Coordinated windows (never all at once): heavy cannons → rotary streams
   * from the flanks (the middle stays open) → missiles down telegraphed lanes
   * (two lanes always free) → the core's energy burst.
   */
  _updateSuppression() {
    const f = this.su, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight' || (this.act && this.act.quiet)) { this._endSuppression(); return; }
    f.t++;
    const t = f.t, r = this.rate;
    if (t <= 70) {
      if (t % Math.max(10, Math.round(16 / r)) === 0) { const i = (t / 8) & 1; if (!this.dead.hc[i]) { this.hcAim[i] = this._pWorld(t & 16 ? 20 : 0, [0, 0, 0]); this._hcShot(i, SPEC.shell, t & 16 ? 20 : 0); } }
    } else if (t <= 160) {
      const ev = Math.max(3, Math.round(4 / r));
      for (let i = 0; i < 2; i++) {
        if (this.dead.rot[i]) continue;
        const k = (t - 70) / 90;
        this.rotAim[i] = (i ? -1 : 1) * (0.25 + 0.75 * Math.abs(Math.sin(k * Math.PI * 1.5)));
        if ((t + i) % ev === 0) this._rotShot(i, SPEC.rot);
      }
      if (t % 30 === 0) this._batteryBolts(0.5);
    } else if (t <= 250) {
      if (!f.lanes) {
        // Six lanes, four take missiles: two adjacent lanes stay clear.
        const free = w.rng.int(0, 4), LW = W / 6;
        f.lanes = [];
        for (let k = 0; k < 6; k++) if (k !== free && k !== free + 1) f.lanes.push(LW * (k + 0.5));
        for (const x of f.lanes) this.c.kit.hazard({ type: 'lane', x, w: LW - 12, warn: 36, fire: 50, lethal: false, color: [1, 0.25, 0.5], y0: HOME_ROW + 60 });
      }
      const g = t - 196;
      if (g >= 0 && g < f.lanes.length * 7 && g % 7 === 0) {
        const x = f.lanes[g / 7], i = x < W / 2 ? 0 : 1, pod = this.dead.pod[i] ? 1 - i : i;
        if (!this.dead.pod[pod]) this._laneMissile(pod, x);
      }
    } else if (t <= 290) {
      if (t === 262 && this.coreOK) {
        const q = this._scr(this.M.hull, CC.eye[0], CC.eye[1], CC.eye[2]);
        P.ring(w, q[0], q[1], SPEC.coreRing, w.rng.angle());
        this.flashes.push({ x: q[0], y: q[1], ang: Math.PI / 2, t: 0, life: 20, kind: 'core', w: M4.point(this.M.hull, CC.eye[0], CC.eye[1], CC.eye[2], [0, 0, 0]) });
        this.eyeT = 3; this.kick += 0.02;
        sfx.play('coreBlast', { pan: 0 });
      }
    } else this._endSuppression();
  }

  /** A missile from a pod tube straight down a lane (aimed at the lane's foot). */
  _laneMissile(i, x) {
    const w = this.w, tb = CC.podTubes[(this.mid++) % 8], m = this.M.pod[i];
    const mz = this._muzzle(m, [tb[0], CC.podMuzzle, tb[1]]);
    const ang = Math.atan2(H + 20 - mz.y, x - mz.x);
    const ref = { ...MSPLIT, _cc: ++this.mid };
    P.shoot(w, mz.x, mz.y, ang, SPEC.laneMissile.speed, { ...SPEC.laneMissile, split: null });
    this.missiles.push({ ref, x: mz.x, y: mz.y, ang, trail: [], life: 0, alive: true, free: true, vx: Math.cos(ang) * 3.4, vy: Math.sin(ang) * 3.4 });
    this.flashes.push({ x: mz.x, y: mz.y, ang, t: 0, life: 8, kind: 'launch', w: M4.point(m, tb[0], CC.podMuzzle, tb[1], [0, 0, 0]) });
    sfx.play('rocketLaunch', { pan: (mz.x - W / 2) / W });
  }

  _endSuppression() {
    this.su = null; this.hcAim[0] = this.hcAim[1] = null; this.rotAim[0] = this.rotAim[1] = null;
    if (!this.fk) this.rotT[0] = this.rotT[1] = 0;
    if (!this.ms) this.podT[0] = this.podT[1] = 0;
    this._heavyDone('suppress');
  }

  // ------------------------------------------- 5. CATACLYSMIC FOOTFALL

  startFootfall() {
    if (this.site || this.mv || this.legsDown >= 5) return false;
    if (!this._canHeavy('stomp')) return false;
    this.heavy = 'stomp';
    this.act = { type: 'stomp', phase: 'advance', t: 0, n: 0, quiet: false };
    this.stompMode = true;
    this._callout('CATACLYSMIC FOOTFALL', 'red');
    sfx.play('hydraulic', { pan: 0 });
    return true;
  }

  _updateStomp(a) {
    const w = this.w;
    if (this.c.state !== 'fight') { this._endStomp(); return; }
    if (a.phase === 'advance') {
      // Bear down the road toward the pilot, stamping; rotaries keep a slow stream going.
      const row = HOME_ROW + Math.min(150, a.t * 0.9);
      const g = this._goalAt(clamp(w.aimX, 120, W - 120), row);
      this.goal[0] = clamp(g[0], -ROAD.body, ROAD.body); this.goal[1] = g[1];
      this.vmax = 1.3; this._facePlayer(0.5);
      if (a.t % 40 === 20) for (let i = 0; i < 2; i++) if (!this.dead.rot[i]) this._rotShot(i, SPEC.rot);
      if (a.t > 230) { a.phase = 'back'; a.t = 0; this.stompMode = false; }
    } else {
      const g = this._goalAt(W / 2, HOME_ROW);
      this.goal[0] = clamp(g[0], -ROAD.body, ROAD.body); this.goal[1] = g[1];
      this.vmax = 2.2; this._facePlayer(0.6);
      if (a.t > 110) this._endStomp();
    }
  }

  _endStomp() { this.stompMode = false; if (this.act && this.act.type === 'stomp') this.act = null; this._heavyDone('stomp'); }

  // ------------------------------------------- core emitter (signature)

  startCore() {
    if (!this.coreOK || !this._canHeavy('core')) return false;
    this.heavy = 'core';
    this.co = { phase: 'charge', t: 0, laser: null };
    sfx.play('coreCharge', { pan: 0 });
    return true;
  }

  _updateCore() {
    const d = this.co, c = this.c, w = this.w, R = w.fxRng;
    if (!d) return;
    if (c.state !== 'fight' || (this.act && this.act.quiet)) { if (d.laser) d.laser.dead = true; this.co = null; this._heavyDone('core'); return; }
    d.t++;
    const q = this._scr(this.M.hull, CC.eye[0], CC.eye[1], CC.eye[2]), tx = q[0], ty = q[1];
    if (d.phase === 'charge') {
      this.eyeT = 0.6 + (d.t / 80) * 2.6;
      if (d.t % 2 === 0) {
        const a = R.angle(), r = R.range(50, 90), H2 = w.fxHigh;
        const j = H2.spawn(w.F.spark, tx + Math.cos(a) * r, ty + Math.sin(a) * r, -Math.cos(a) * r / 10, -Math.sin(a) * r / 10, 10);
        if (j >= 0) { H2.size(j, 6, 1.6); if (d.t % 4) H2.color(j, 2.4, 0.3, 0.3, 1, 0.1, 0.1); else H2.color(j, 0.4, 1.6, 2.4, 0.1, 0.5, 1); H2.look(j, 1, 1, FADE_OUT, 0.6); }
      }
      w.g.camera.addTrauma(0.005 + d.t * 0.0002);
      if (d.t >= 80) { d.phase = 'aim'; d.t = 0; d.laser = w.enemyLaser(c.e, w.aimAngle(tx, ty), { warn: 40, fire: 34, width: 36, len: 900, track: true, rgb: [1, 0.2, 0.25], ox: tx - c.e.x, oy: ty - c.e.y }); }
    } else if (d.phase === 'aim' || d.phase === 'fire') {
      if (d.laser) { d.laser.ox = tx - c.e.x; d.laser.oy = ty - c.e.y; }
      if (d.phase === 'aim' && d.t >= 40) {
        d.phase = 'fire'; d.t = 0;
        w.g.renderer.post.flash(1, 0.3, 0.25, 0.4, 0.04);
        w.g.renderer.post.shockwave(tx, ty, 0.05, 0.02, 0.7);
        w.g.camera.addTrauma(0.55);
        P.ring(w, tx, ty, SPEC.coreRing, w.rng.angle());
        if (c.mk >= 2 || c.intensity > 1 || this.critical) P.ring(w, tx, ty, SPEC.coreRice, w.rng.angle());
        this.flashes.push({ x: tx, y: ty, ang: d.laser ? d.laser.ang : Math.PI / 2, t: 0, life: 30, kind: 'core', w: M4.point(this.M.hull, CC.eye[0], CC.eye[1] + 6, CC.eye[2], [0, 0, 0]) });
        this.kick += 0.06; this.compV += 2;
        sfx.play('coreBlast', { pan: 0 });
      }
      if (d.phase === 'fire') { this.eyeT = 3.4; if (d.t >= 36) { d.phase = 'cool'; d.t = 0; this._steam(1.2); sfx.play('steamVent', { pan: 0 }); } }
    } else if (d.phase === 'cool') {
      this.eyeT = 0.3;
      if (this.is3D && d.t % 6 === 0) this._steam(0.6);
      if (d.t >= 60) { this.co = null; this._heavyDone('core'); }
    }
  }

  // ------------------------------------------- missiles (pods)

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
    const f = this.ms;
    if (!f) return;
    if (this.c.state !== 'fight' || (this.dead.pod[0] && this.dead.pod[1]) || (this.act && this.act.quiet)) { this._endMissiles(); return; }
    f.t++;
    if (f.phase === 'open') { if (f.t >= 28) { f.phase = 'fire'; f.t = 0; } }
    else if (f.phase === 'fire') {
      const gap = Math.max(12, Math.round(22 / this.rate));
      if (f.t % gap === 1 && f.k < f.n) { for (let i = 0; i < 2; i++) if (!this.dead.pod[i]) this._launch2(i, (f.k * 2 + i * 3) % 8, i * 4); f.k++; }
      if (f.k >= f.n && f.t > f.n * gap + 30) { f.phase = 'close'; f.t = 0; this.podT[0] = this.podT[1] = 0; }
    } else if (f.phase === 'close' && f.t >= 30) this._endMissiles();
  }

  _launch2(i, tube, delay = 0) {
    const w = this.w;
    const go = () => {
      if (this.dead.pod[i] || this.c.state !== 'fight') return;
      const tb = CC.podTubes[tube], m = this.M.pod[i];
      const mz = this._muzzle(m, [tb[0], CC.podMuzzle, tb[1]]);
      const ref = { ...MSPLIT, _cc: ++this.mid };
      const spec = { shape: 'kunai', color: 'pink', n: 1, speed: 1.1, accel: 0.045, maxSpd: 3.3, homing: 0.021, homingTime: 72, split: ref, splitAt: 150, fixed: true };
      P.shoot(w, mz.x, mz.y, mz.ang, spec.speed, spec);
      this.missiles.push({ ref, x: mz.x, y: mz.y, trail: [], life: 0, alive: true });
      this.reticles.push({ x: w.aimX, y: w.aimY, t: 0, life: 46 });
      this.flashes.push({ x: mz.x, y: mz.y, ang: mz.ang, t: 0, life: 8, kind: 'launch', w: M4.point(m, tb[0], CC.podMuzzle, tb[1], [0, 0, 0]) });
      if (this.is3D) { const q = M4.point(m, tb[0], CC.podMuzzle + 2, tb[1], [0, 0, 0]); for (let k = 0; k < 3; k++) this.view.fx._smoke(q[0], q[1], q[2], 0.45, 0.35, 0.8); }
      sfx.play('rocketLaunch', { pan: (mz.x - W / 2) / W });
    };
    if (delay) w.explosions.schedule(delay, go); else go();
  }

  _trackMissiles() {
    if (!this.missiles.length) return;
    const B = this.w.bullets;
    const live = new Map();
    for (let i = 0; i < B.count; i++) { const r = B.ref[i]; if (r && r._cc) live.set(r, i); }
    for (let k = this.missiles.length - 1; k >= 0; k--) {
      const m = this.missiles[k];
      if (m.free) {
        // Lane missiles are plain bullets: the trail follows their straight line.
        m.life++; m.x += m.vx * (this.w.diff.speed || 1); m.y += m.vy * (this.w.diff.speed || 1);
        if (m.life % 2 === 0) { m.trail.push(m.x, m.y); if (m.trail.length > 30) m.trail.splice(0, 2); }
        if (m.y > H + 40) { m.alive = false; m.trail.splice(0, 4); if (!m.trail.length) this.missiles.splice(k, 1); }
        continue;
      }
      const i = live.get(m.ref);
      if (i === undefined) { m.alive = false; m.trail.shift(); m.trail.shift(); if (!m.trail.length) this.missiles.splice(k, 1); continue; }
      m.x = B.x[i]; m.y = B.y[i]; m.ang = B.ang[i]; m.life++;
      if (this.t % 2 === 0) { m.trail.push(m.x, m.y); if (m.trail.length > 36) m.trail.splice(0, 2); }
      if (this.is3D && this.t % 3 === 0) { const q = this._world(m.x, m.y, 30, this.q3); this.view.fx._smoke(q[0], q[1], q[2], 0.22, 0.25, 0.3); }
    }
  }

  _endMissiles() { this.ms = null; if (!this.su) this.podT[0] = this.podT[1] = 0; this._heavyDone('missiles'); }

  // ------------------------------------------- 9. SIEGE RECLAMATION

  _phaseFrac() {
    const c = this.c;
    if (!c.floors || !c.phase) return 1;
    return (c.e.hp - c.floors[c.index]) / Math.max(1, c.phase.hp);
  }

  _repairCheck() {
    const c = this.c;
    if (c.state !== 'fight' || !c.phase || !c.phase.repairAt || this.act || this.mv) return;
    if (this.repPhase !== c.index) { this.repPhase = c.index; this.repairs = 0; this.repCd = 0; }
    if (this.repCd > 0) { this.repCd--; return; }
    const max = c.phase.desperation ? 1 : (c.phase.repairs ?? 1);
    if (this.repairs >= max || this._phaseFrac() > c.phase.repairAt) return;
    const site = this._pickSite(-60, 900);
    this.repairs++;
    this._endAttacks();
    const total = Math.round(c.phase.hp * (c.phase.repairHeal ?? 0.3) * (this.coreOK ? 1 : 0.5));
    this.act = { type: 'regen', phase: 'go', t: 0, total, healed: 0, taken: 0, hold: true, quiet: true, commit: true, site };
    if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'SIEGE RECLAMATION', desperation: true, boss: c.name });
    this._callout('SIEGE RECLAMATION — STOP THE REPAIR', 'red');
    sfx.play('hydraulic', { pan: 0 });
    if (site) this._gotoSite(site, () => this._regenAnchor());
    else this._regenAnchor(); // no structure in reach: repair where it stands
  }

  _regenAnchor() {
    const a = this.act;
    if (!a || a.type !== 'regen') return;
    a.phase = 'open'; a.t = 0; a.hp0 = this.c.e.hp;
    this.plateT = 1; this.armT = 1;
    sfx.play('steamVent', { pan: 0 });
  }

  _updateRegen(a) {
    const c = this.c, w = this.w, R = w.fxRng;
    if (a.phase === 'go') { if (!this.mv && !this.site && a.t > 400) this._regenAnchor(); return; }
    this.goal[0] = this.s.x; this.goal[1] = this.s.y;
    this._facePlayer(1.2);
    if (a.phase === 'open') {
      this.crouch = Math.min(10, a.t * 0.3);
      if (a.t >= 36) { a.phase = 'repair'; a.t = 0; a.last = c.e.hp; sfx.play('repairHum', { pan: 0 }); }
      return;
    }
    if (a.phase === 'repair') {
      // Damage taken while repairing is tracked: too much overloads the repair (the pilot's counterplay).
      a.taken += Math.max(0, a.last - c.e.hp);
      const T = 300, step = a.total / T, room = c.floors[c.index] + c.phase.hp - c.e.hp;
      const add = Math.max(0, Math.min(step, room, a.total - a.healed));
      c.e.hp += add; a.healed += add; a.last = c.e.hp;
      if (a.t % 3 === 0) {
        // Welding arcs from the torches and across exposed plates.
        const tip = [0, 1][a.t % 2], m = this.M.armB[tip];
        const p0 = this._scr(m, 0, CC.armB + 8, 0).slice(), p1 = this._scr(this.M.hull, R.range(-60, 60), R.range(-110, 120), R.range(30, 50));
        this.arcs.push({ x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], t: 0, life: 7, seed: R.next() });
        w.explosions.sparks(p0[0], p0[1], 2, [0.6, 1.4, 2], 3, 14, 3);
        if (this.is3D && a.t % 9 === 0) { const q = M4.point(m, 0, CC.armB + 6, 0, [0, 0, 0]); this.view.fx._spark(q[0], q[1], q[2], 4); this.view.fx._smoke(q[0], q[1], q[2], 0.35, 0.3, 0.6); }
      }
      if (a.t % 30 === 0) sfx.play('repairHum', { pan: 0 });
      // Defensive fire: slow, readable flak from the shoulders.
      if (a.t % 44 === 22) { for (let i = 0; i < 2; i++) if (!this.dead.rot[i]) { this.rotT[i] = 1; this._rotShot(i, { ...SPEC.rot, n: 3, spread: 0.5 }); } }
      if (a.t % 70 === 35) this._batteryFan(w.rng.range(-0.1, 0.1), { ...SPEC.batt, n: 5 });
      if (a.taken > c.phase.hp * 0.22) { this._repairStop('REPAIR OVERLOADED'); return; }
      if (a.t >= T || a.healed >= a.total - 0.5 || a.t > 360) { a.phase = 'close'; a.t = 0; this.plateT = 0; this.armT = 0; this.rotT[0] = this.rotT[1] = 0; }
      return;
    }
    if (a.phase === 'close') {
      this.crouch = Math.max(0, this.crouch - 0.5);
      if (a.t >= 40) {
        a.phase = 'leave'; a.t = 0;
        const done = () => this._regenDone();
        if (this.site) this._leaveRoof(done); else done();
      }
    }
  }

  /** Stop the repair (core down / overloaded): sparks, a stagger, hatches slam shut. */
  _repairStop(text) {
    const a = this.act;
    if (!a || a.type !== 'regen') return;
    a.phase = 'close'; a.t = 0;
    this.plateT = 0; this.armT = 0;
    this._callout(text, 'gold');
    const q = this._scr(this.M.hull, 0, -14, 50);
    this.w.explosions.sparks(q[0], q[1], 40, [0.4, 1, 1.4], 6, 30, 4);
    this.w.explosions.blast(q[0], q[1], 1.1, [0.5, 0.9, 1]);
    this.compV += 3;
  }

  _regenDone() {
    const c = this.c, w = this.w;
    this.act = null; this.repCd = 600; this.crouch = 0;
    if (c.phase && c.phase.final && !this.critical) {
      this.critical = true; this.odT = 0; this.empower = 600;
      if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'FINAL CATACLYSM', desperation: true, boss: c.name });
      w.g.camera.addTrauma(0.35);
      w.g.renderer.post.flash(1, 0.2, 0.15, 0.3, 0.03);
    }
  }

  // ------------------------------------------- 10. APOCALYPSE EXECUTION LEAP

  _execUnlock() {
    if (this.exUnlocked || this.c.state !== 'fight') return;
    if (this.c.e.hp / Math.max(1, this._hp0()) > 0.5) return;
    this.exUnlocked = true; this.exCd = 120;
    const c = this.c;
    if (c._emit) c._emit('bossPhaseCard', { number: c.index + 1, total: c.total, name: 'APOCALYPSE EXECUTION', desperation: true, boss: c.name });
    this.w.g.renderer.post.flash(1, 0.1, 0.1, 0.25, 0.03);
  }

  _startExec() {
    const s = this.s;
    if (this.site || this.mv) return;
    this._endAttacks();
    this.act = { type: 'exec', phase: 'wind', t: 0, hold: true, quiet: true, commit: true, zone: null };
    this.exCd = this.c.w.diff.desperation ? 1200 : 1500;
    this._callout('EXECUTION LEAP — MOVE!', 'red');
    sfx.play('executionAlarm', { pan: 0 });
    const g = this._pWorld(0, [0, 0, 0]);
    this.act.zone = { x: g[0], y: g[1], z: 0.5, r: EXEC_R, t: 0, life: 99999, kind: 'exec' };
    this.zones.push(this.act.zone);
    void s;
  }

  _updateExec(a) {
    const w = this.w, s = this.s;
    if (a.phase === 'wind') {
      // Deep crouch, the eye floods red; the marker follows the pilot (with lag).
      this.crouch = Math.min(30, a.t * 0.55);
      this.eyeT = 1 + a.t / 30;
      this.goal[0] = s.x; this.goal[1] = s.y;
      this._facePlayer(0.8);
      const g = this._pWorld(0, this.q3);
      a.zone.x += (clamp(g[0], -150, 150) - a.zone.x) * 0.08; a.zone.y += (g[1] - a.zone.y) * 0.08;
      if (a.t % 20 === 0) w.g.camera.addTrauma(0.08);
      if (a.t >= 64) {
        a.phase = 'air'; a.t = 0; this.crouch = 0;
        this._startLeap(a.zone.x, a.zone.y, null, { noCrouch: true, exec: true, T: 86, apex: 290, ring: true, recover: 70, onLand: (x, y) => this._crush(x, y), onDone: () => { this.act = null; } });
        a.zone.life = 99999;
      }
      return;
    }
    if (a.phase === 'air' && this.mv && this.mv.exec) { a.zone.x = this.mv.x1; a.zone.y = this.mv.y1; }
  }

  /** The lethal test, at the impact frame only: is the pilot inside the landing zone? */
  _crush(x, y) {
    const w = this.w, p = w.player, a = this.act;
    if (a && a.zone) a.zone.life = a.zone.t + 10;
    const rs = EXEC_R * (this.cam.project(this.s.x, this.s.y, 0, this.pr)[2] || 1);
    if (p && p.collidable && !p.invulnerable && Math.hypot(p.x - x, p.y - y) < rs + p.hitR) {
      p.hit();
      if (p.state === 'dying') p.stateT = 1; // crushed: no death-bomb window
      this._callout('CRUSHED', 'red');
    }
    w.g.renderer.post.aberrate(0.02);
  }

  // ------------------------------------------- 11. FINAL CATACLYSM

  /** After the repair: rolling windows, one leading system each, plus short tactical hops. */
  cataclysm(t) {
    if (!this.critical || this.c.state !== 'fight' || this.act || this.mv) return;
    this.odT++;
    const T = this.odT % 900;
    if (T < 170) { this.siegeBarrage(t, 1.3); if (T === 30) this.startMissiles(4); }
    else if (T === 175) this.startFlak(2);
    else if (T === 380) this.startArtillery(5);
    else if (T === 520) this._hop();
    else if (T === 580) this.startSuppression();
    else if (T === 880) { if (this.coreOK) this.startCore(); else this._hop(); }
  }

  // --------------------------------------------------------- lifecycle

  _endAttacks() {
    if (this.co && this.co.laser) this.co.laser.dead = true;
    this.fk = null; this.ar = null; this.su = null; this.co = null; this.ms = null;
    this.heavy = null; this.queue = null;
    if (this.act && this.act.type === 'stomp') this.act = null;
    this.stompMode = false;
    this.rotT[0] = this.rotT[1] = 0; this.podT[0] = this.podT[1] = 0; this.mortT[0] = this.mortT[1] = 0.7;
    this.rotAim[0] = this.rotAim[1] = null; this.hcAim[0] = this.hcAim[1] = null; this.mortAim[0] = this.mortAim[1] = null;
    this.lines.length = 0;
    for (const z of this.zones) if (z.kind === 'stomp') z.life = z.t;
  }

  /** Defeat: the legs buckle one by one, the core overloads, the hull blows. */
  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng;
    if (this.deathT < 0) {
      this.deathT = 0; this._endAttacks(); this.act = null; this.mv = null;
      this.buckle = []; const order = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => R.next() - 0.5);
      for (let k = 0; k < 8; k++) this.buckle.push({ i: order[k], at: 8 + k * 11 });
      this.plateT = 0; this.armT = 0;
      sfx.play('engineFail', { pan: 0 });
    }
    this.deathT++;
    this.hold = true;
    this.eyeT = st < 70 ? 1.5 + Math.sin(st * 0.9) * 1.2 : st < 112 ? 3.5 : 0;
    for (const b of this.buckle) {
      if (st === b.at) {
        this.dead.leg[b.i] = true;
        const k = this.knee[b.i], q = this.cam.project(k[0], k[1], k[2], this.pr);
        w.explosions.blast(q[0], q[1], 0.9, [1, 0.45, 0.25]);
        w.explosions.sparks(q[0], q[1], 16, [1, 0.6, 0.3], 5, 24, 3);
        if (this.is3D) this.view.fx._smoke(k[0], k[1], k[2], 0.8, 0.9, 1);
        sfx.play('hydraulic', { pan: (q[0] - W / 2) / W });
      }
    }
    if (st % 12 === 6 && st < 108) {
      const kinds = ['hc', 'rot', 'pod', 'mort'], kd = kinds[R.int(0, 3)], i = R.int(0, 1);
      const q = this._mountPt(kd, i);
      w.explosions.blast(q[0], q[1], R.range(0.7, 1.1), [1, 0.45, 0.25]);
      if (this.is3D) this._steam(0.5);
    }
    if (st === 70) {
      const q = this._scr(this.M.hull, CC.eye[0], CC.eye[1], CC.eye[2]);
      w.explosions.sparks(q[0], q[1], 50, [1, 0.5, 0.4], 8, 34, 5);
      w.g.renderer.post.flash(1, 0.3, 0.2, 0.35, 0.04);
      sfx.play('coreCharge', { pan: 0 });
    }
    if (st === 112) {
      const q = this._scr(this.M.hull, 0, 0, 40);
      w.explosions.blast(q[0], q[1], 3, [1, 0.45, 0.2]);
      w.g.camera.addTrauma(0.9);
      w.g.renderer.post.shockwave(q[0], q[1], 0.06, 0.02, 1);
      this.dead.hc[0] = this.dead.hc[1] = this.dead.rot[0] = this.dead.rot[1] = this.dead.pod[0] = this.dead.pod[1] = this.dead.mort[0] = this.dead.mort[1] = this.dead.core[0] = true;
      if (this.is3D) {
        const fx = this.view.fx, s = this.s;
        fx.decal('scorch', s.x, s.y, this.gz + 0.5, 360, R.angle(), 9000);
        for (const [lx, ly, z, sc] of [[0, 90, 40, 1.6], [-40, 0, 44, 1.3], [44, -60, 40, 1.2], [0, -110, 36, 1], [30, 40, 44, 0.9]]) {
          const p = M4.point(this.M.hull, lx, ly, z, [0, 0, 0]);
          fx.addFire(p[0], p[1], p[2], sc, 6000);
        }
        for (let k = 0; k < 18; k++) { const a = R.angle(), sp = R.range(1.5, 4.5); this.debris.push({ mesh: 'cc.plateChunk', x: s.x, y: s.y, z: s.z, rot: R.angle(), sx: R.range(4, 10), sy: R.range(4, 9), sz: R.range(3, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(3, 7), wx: R.range(-0.3, 0.3), wy: R.range(-0.3, 0.3), wz: R.range(-0.3, 0.3), ax: 0, ay: 0, az: 0, gz: this.gz, life: 0 }); }
      }
      this._shards(q[0], q[1], 26);
      sfx.play('crawlerLand', { pan: 0, v: 1 });
    }
    if (st > 112) this.wreck = true;
    if (st === 150 && this.view && this.ctrlCam) { this.view.speedTarget = this.view.baseSpeed; this.ctrlCam = false; this.released = true; }
  }

  /** Death pose: the body sinks as legs give way; dead feet slide outward. */
  _collapse() {
    const s = this.s, st = this.c.st;
    const down = this.dead.leg.filter(Boolean).length;
    const zt = this.gz + Math.max(10, CC.ride - down * 4.5);
    s.z += (zt - s.z) * 0.05;
    s.roll += ((this.dead.leg[0] + this.dead.leg[1] - this.dead.leg[4] - this.dead.leg[5]) * 0.04 - s.roll) * 0.03;
    s.pitch += ((this.dead.leg[0] + this.dead.leg[4] - this.dead.leg[3] - this.dead.leg[7]) * -0.04 - s.pitch) * 0.03;
    for (let i = 0; i < 8; i++) {
      if (!this.dead.leg[i] || st > 130) continue;
      const fi = i * 3, hp = CC.hips[i], hw = M4.point(this.M.hull, hp[0], hp[1], 0, this.h3);
      const dx = s.f[fi] - hw[0], dy = s.f[fi + 1] - hw[1], d = Math.hypot(dx, dy) || 1;
      if (d < 240) { s.f[fi] += (dx / d) * 0.6; s.f[fi + 1] += (dy / d) * 0.6; }
    }
    if (!this.wreck && st % 3 === 0 && this.is3D) { const i = this.w.fxRng.int(0, 7), k = this.knee[i]; this.view.fx._spark(k[0], k[1], k[2], 3); }
  }

  // ---------------------------------------------------------- world fx

  _callout(text, cls = 'red') { if (this.c._emit) this.c._emit('bossCallout', { text, cls }); }

  _hp0() { const c = this.c; return c.floors && c.phases ? c.floors[0] + c.phases[0].hp : c.e.hp || 1; }

  _shards(x, y, n, col = [0.42, 0.44, 0.48]) {
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
    for (const [lx, ly, lz] of [[-26, 110, 50], [26, 110, 50], [0, -120, 44], [-60, -40, 40], [60, -40, 40]]) {
      if (!R.chance(0.6 * sc)) continue;
      const q = M4.point(this.M.hull, lx, ly, lz, [0, 0, 0]);
      fx._steam(q[0], q[1], q[2], 0.8 * sc);
    }
  }

  _updateDebris() {
    const cy = this.cam.cy || 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      if (p.y < cy - 1000 || ++p.life > 2400) { this.debris.splice(i, 1); continue; }
      if (p.rest) continue;
      p.vz -= 0.22; p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.ax += p.wx; p.ay += p.wy; p.az += p.wz;
      if (p.z <= p.gz) { p.z = p.gz; if (p.vz < -2) { p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } else p.rest = true; }
    }
  }

  /** Exhaust, damage smoke, burning parts, hydraulic leaks, the repair glow. */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, M = this.M, c = this.c;
    if (!this.wreck) {
      if (this.t % 5 === 0) for (const [x, y, z] of CC.stacks) { if (R.chance(0.5)) { const q = M4.point(M.hull, x, y, z + 2, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.4, 0.75, 0.9); } }
      const frac = c.e.hp / Math.max(1, this._hp0());
      if (frac < 0.5 && this.t % (frac < 0.25 ? 4 : 8) === 0) { const q = M4.point(M.hull, R.range(-50, 50), R.range(-100, 100), 46, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.6, 0.9, 0.9); }
      if (frac < 0.35 && R.chance(0.08)) { const q = M4.point(M.hull, R.range(-60, 60), R.range(-110, 120), 40, [0, 0, 0]); fx._spark(q[0], q[1], q[2], 5); }
      // Damaged legs leak hydraulic mist and spark at the knee.
      for (let i = 0; i < 8; i++) if (this.dead.leg[i]) { const k = this.knee[i]; if (R.chance(0.12)) fx._spark(k[0], k[1], k[2], 3); if (this.t % 9 === i) fx._steam(k[0], k[1], k[2], 0.4); }
    }
    for (const f of this.fires) {
      const q = this._mountW(f.kind, f.i, [0, 0, 0]);
      if (this.t % 4 === 0) fx._smoke(q[0], q[1], q[2], f.s, 0.9, 1.1);
      if (R.chance(0.06)) fx._spark(q[0], q[1], q[2], 5);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
    }
  }

  _sound() {
    if (this.wreck) return;
    const sp = Math.hypot(this.vx, this.vy);
    this.servoD += sp * 0.5 + Math.abs(this.om || 0) * 40;
    if (this.servoD > 60) { this.servoD = 0; sfx.play('hydraulic', { pan: (this.c.e.x - W / 2) / W }); }
  }

  // ------------------------------------------------------------ render

  renderWorld(view, alpha) {
    if (view !== this.view) return;
    if (this.wreck && this.c.state !== 'dying') {
      const q = this.cam.project(this.s.x, this.s.y, 0, this.pr);
      if (q[1] > H + 600) { const i = view.extras.indexOf(this); if (i >= 0) view.extras.splice(i, 1); return; }
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('cc', buildColossusCrawler);
    this.R = R; // (headless perf checks reach the renderer through the rig)
    const lite = view.qname === 'low'; // low quality (mobile): fewer draws (one shadow pass, single-rod actuators)
    const cam = view.cam, M = this.M, hdr = !!this.w.g.renderer.post.hdr;
    this._pose(this.c.e.alive ? alpha : 1);
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.75), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    // 1) Footprints.
    R.trail(cam, this.printData, this.printN, hdr, TL.FOOT);
    // 2) The machine.
    R.begin(cam, view.atmo, light, CRAWLER_LOOK);
    const pl = this._pointLight();
    if (pl) R.pointLight(pl[0], pl[1], pl[2]);
    const dmg = this.wreck ? 1 : Math.min(0.75, (1 - this.c.e.hp / this._hp0()) * 0.9);
    const heat = this.wreck ? 0.03 + 0.02 * Math.sin(this.t * 0.2) : 0;
    const fl = this.flash * 0.12, snow = 0.05;
    const o = { flash: fl, damage: dmg, heat, snow };
    const dying = this.c.state === 'dying';
    const blink = (this.t >> 3) & 1;
    R.draw('cc.hull', M.hull, o);
    R.draw('cc.core', M.hull, { ...o, damage: this.coreOK ? dmg : 1, heat: this.coreOK ? heat : 0.12 });
    R.draw('cc.battery', M.hull, o);
    const redG = this.wreck ? 0.03 : (this.critical || dmg > 0.5 ? (blink ? 1.6 : 0.5) : 1.1) * (dying ? ((this.t >> 2) & 1) : 1);
    R.draw('cc.red', M.hull, { glow: redG, snow: 0 });
    const regen = this.act && this.act.type === 'regen' && this.act.phase === 'repair';
    R.draw('cc.cyan', M.hull, { glow: this.wreck ? 0 : regen ? 2 + Math.sin(this.t * 0.4) * 0.6 : 0.5, snow: 0 });
    R.draw('cc.eye', M.hull, { glow: this.wreck ? 0 : 0.6 + this.eye * 0.9, snow: 0 });
    R.draw('cc.plateL', M.plateL, o); R.draw('cc.plateR', M.plateR, o);
    if (this.s.plate > 0.05 || this.p.plate > 0.05) R.draw('cc.repair', M.repair, { glow: 1.2 + Math.sin(this.t * 0.3) * 0.4, snow: 0 });
    if (this.s.arm > 0.02) for (let i = 0; i < 2; i++) { R.draw('cc.armA', M.armA[i], o); R.draw('cc.armB', M.armB[i], o); }
    // Weapons.
    const hf = (pe) => (pe && pe.alive && pe.flash > 0 ? 0.4 : 0), hd = (pe) => (pe && pe.alive && pe.maxHp ? 1 - pe.hp / pe.maxHp : 0);
    for (let i = 0; i < 2; i++) {
      const e1 = this.partEnt[`hc${i}`], e2 = this.partEnt[`rot${i}`], e3 = this.partEnt[`pod${i}`], e4 = this.partEnt[`mort${i}`];
      if (this.dead.hc[i]) R.draw('cc.hcWreck', M.hc[i], { damage: 1, heat: 0.12 });
      else { R.draw('cc.hcBase', M.hc[i], { glow: 1, flash: Math.max(fl, hf(e1)), damage: Math.max(dmg, hd(e1) * 0.8), snow }); R.draw('cc.hcBarrel', M.hcb[i], { glow: 0.4 + this.hcGlow[i] * 3, flash: hf(e1) * 0.5, damage: dmg * 0.5, heat: this.hcGlow[i] * 0.3, snow: 0 }); }
      if (this.dead.rot[i]) R.draw('cc.rotWreck', M.rot[i], { damage: 1, heat: 0.12 });
      else { R.draw('cc.rotBase', M.rot[i], { glow: 1, flash: Math.max(fl, hf(e2)), damage: Math.max(dmg, hd(e2) * 0.8), snow }); R.draw('cc.rotor', M.rotor[i], { flash: hf(e2) * 0.5, heat: this.heat[i] * 0.35, snow: 0 }); }
      if (this.dead.pod[i]) R.draw('cc.podWreck', M.pod[i], { damage: 1, heat: 0.1 });
      else { R.draw('cc.podBase', M.pod[i], { glow: 1, flash: Math.max(fl, hf(e3)), damage: Math.max(dmg, hd(e3) * 0.8), snow }); R.draw('cc.podCover', M.podc[i], { flash: hf(e3) * 0.5, damage: dmg, snow }); }
      if (this.dead.mort[i]) R.draw('cc.mortWreck', M.mort[i], { damage: 1, heat: 0.1 });
      else { R.draw('cc.mortBase', M.mort[i], { glow: 1, flash: Math.max(fl, hf(e4)), damage: Math.max(dmg, hd(e4) * 0.8), snow }); R.draw('cc.mortTube', M.mortt[i], { flash: hf(e4) * 0.5, damage: dmg * 0.6, snow: 0 }); }
    }
    // Legs: coxa, femur, tibia, foot, actuators (spanned between the joints every frame).
    for (let i = 0; i < 8; i++) {
      const pe = this.partEnt[`leg${i}`], ld = this.dead.leg[i], lo = { glow: ld ? 0.1 : redG, flash: Math.max(fl, hf(pe)), damage: ld ? 1 : Math.max(dmg, hd(pe) * 0.8), heat: ld ? 0.08 : heat, snow };
      R.draw('cc.coxa', M.coxa[i], lo); R.draw('cc.femur', M.femur[i], lo); R.draw('cc.tibia', M.tibia[i], lo); R.draw('cc.foot', M.foot[i], { ...lo, glow: 0 });
      if (i === 0 || i === 4) R.draw('cc.legGun', M.legGun[i ? 1 : 0], lo);
      this._piston(R, M.coxa[i], [0, -4.4, 19], M.femur[i], [0, 37, 11], 3.3, 1.8, lite);
      this._piston(R, M.femur[i], [0, 53, 12], M.tibia[i], [0, 25, 10], 2.8, 1.6, true);
    }
    // Loose debris.
    const dm = M.deb;
    for (const p of this.debris) {
      M4.trans(p.x, p.y, p.z, dm);
      M4.mul(dm, M4.rotZ(p.rot + p.az, M.tmp), dm); M4.mul(dm, M4.rotX(p.ax, M.tmp), dm); M4.mul(dm, M4.rotY(p.ay, M.tmp), dm);
      M4.mul(dm, scaleM(p.sx, p.sy, p.sz, M.tmp), dm);
      R.draw(p.mesh, dm, { snow: 0.1, damage: p.mesh === 'cc.plateChunk' ? 0.7 : 0.2, heat: p.mesh === 'cc.plateChunk' && p.life < 200 ? 0.2 : 0 });
    }
    // 3) Contact pads under the planted feet + the body, and the soft projected shadow.
    R.beginShadow(cam, CRAWLER_LOOK.shadow);
    const hgt = this.s.z - this.gz;
    for (let i = 0; i < 8; i++) {
      if (this.nrm[i][2] < 0.5) continue;
      const fi = i * 3, fz = this.s.f[fi + 2], lift = Math.max(0, fz - this.gz);
      M4.mul(M4.trans(this.s.f[fi], this.s.f[fi + 1], 0, M.tmp), scaleM(15 + lift * 0.2, 16 + lift * 0.2, 1, M.tmp2), M.pad);
      R.contact(M.pad, Math.max(0, 0.75 - lift * 0.012), [0.5, 0.6], this.gz + 1.3 + (fz > this.gz + 30 ? fz - this.gz : 0) * 0);
    }
    M4.mul(M.world, M4.mul(M4.trans(0, 7, 0, M.tmp), scaleM(62, 112, 1, M.tmp2), M.tmp2), M.pad);
    R.contact(M.pad, clamp(0.55 - (hgt - CC.ride) * 0.003, 0.08, 0.55), [0.35, 0.45], this.gz + 1.1);
    const items = this._items();
    const sh = 1.12, se2 = Math.sin(sh), ce2 = Math.cos(sh), sa = clamp(0.2 - (hgt - CC.ride) * 0.0005, 0.06, 0.2);
    for (let k = 0; k < (lite ? 1 : 2); k++) {
      const j = (k - 0.5) * 0.06, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], this.gz + 2 + k * 0.6, sa * 1.3);
    }
    R.end();
    this._pose(1);
  }

  /** Hydraulic actuator spanned between two joints: barrel + chrome rod (or a single rod). */
  _piston(R, ma, pa, mb, pb, rb, rr, single = false) {
    const M = this.M, A = M4.point(ma, pa[0], pa[1], pa[2], [0, 0, 0]), B = M4.point(mb, pb[0], pb[1], pb[2], [0, 0, 0]);
    if (single) { R.draw('cc.pistonR', spanM(A, B, rr, M.span), { snow: 0 }); return; }
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1, k = Math.min(0.58, 25 / L);
    const Mid = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
    R.draw('cc.pistonB', spanM(A, Mid, rb, M.span), { snow: 0 });
    R.draw('cc.pistonR', spanM(Mid, B, rr, M.span), { snow: 0 });
  }

  _pointLight() {
    let best = null, bw = 0;
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, wgt = k * (f.kind === 'core' ? 3 : f.kind === 'cannon' ? 1.6 : 1);
      if (wgt > bw) { bw = wgt; best = f; }
    }
    if (best) {
      const col = best.kind === 'core' ? [2.6, 0.5, 0.4] : best.kind === 'launch' || best.kind === 'mortar' ? [2.2, 1.2, 0.6] : [2.4, 0.7, 0.5];
      return [best.w, best.kind === 'core' ? 200 : 100, col.map((v) => v * bw)];
    }
    if (this.act && this.act.type === 'regen' && this.s.plate > 0.3) { const q = M4.point(this.M.hull, 0, -14, 60, this.q3); return [q, 150, [0.4, 1.4, 2]]; }
    if (this.eye > 1.2 && this.coreOK) { const q = M4.point(this.M.hull, CC.eye[0], CC.eye[1] + 10, CC.eye[2], this.q3); return [q, 140, [1.2 * this.eye, 0.25 * this.eye, 0.2 * this.eye]]; }
    return null;
  }

  _items() {
    // The big shapes only: the shadow reads the same, at a fraction of the draws.
    const M = this.M, out = this.itemsA || (this.itemsA = []);
    out.length = 0;
    out.push(['cc.hull', M.hull]);
    for (let i = 0; i < 8; i++) out.push(['cc.femur', M.femur[i]], ['cc.tibia', M.tibia[i]]);
    for (let i = 0; i < 2; i++) out.push(this.dead.hc[i] ? ['cc.hcWreck', M.hc[i]] : ['cc.hcBase', M.hc[i]]);
    return out;
  }

  /** Ground-level overlays: light pools, zones (artillery, stomp, landing, execution). */
  renderUnder(b, alpha) {
    if (!this.is3D || (this.wreck && this.c.state !== 'dying')) return;
    const F = this.w.F, KF = this.c.kit.F, t = this.w.t, cam = this.cam;
    this._pose(this.c.e.alive ? alpha : 1);
    // Muzzle / eye light pools on the road.
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, q = cam.project(f.w[0], f.w[1], this.gz, this.pr);
      const big = f.kind === 'core' ? 4 : f.kind === 'cannon' ? 1.8 : 1;
      b.draw(F.glow, q[0], q[1] + 10, 90 * big * k * q[2], 50 * big * k * q[2], 0, 2.4, 0.5, 0.3, 0.22 * k, 1);
    }
    if (this.eye > 0.8) { const q = this._scr(this.M.world, 0, 200, 0); b.draw(F.glow, q[0], q[1], 140 * q[2] * this.eye * 0.5, 90 * q[2] * this.eye * 0.5, 0, 2.4, 0.3, 0.25, 0.1 * this.eye, 1); }
    // Zones.
    for (const z of this.zones) {
      const q = cam.project(z.x, z.y, z.z, this.pr), r = z.r * q[2], blink = (t >> 2) & 1 ? 1 : 0.55;
      if (z.kind === 'shell') {
        const k = z.t / z.life;
        b.draw(F.glow, q[0], q[1], r * 2 * k, r * 2 * k * 0.9, 0, 1, 0.45, 0.1, 0.25 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1, r * 2.1 * 0.9, t * 0.05, 1.6, 0.7, 0.16, 0.7 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1 * (1 - k), r * 1.9 * (1 - k), 0, 2, 2, 2, 0.5, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.2, 3, 0, 2, 0.9, 0.2, 0.6, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.2, 3, Math.PI / 2, 2, 0.9, 0.2, 0.6, 1);
      } else if (z.kind === 'stomp') {
        b.draw(F.glow, q[0], q[1], r * 2, r * 1.8, 0, 2, 0.6, 0.15, 0.22 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2, r * 1.8, 0, 2.2, 0.8, 0.2, 0.65 * blink, 1);
      } else if (z.kind === 'exec') {
        // The execution zone: unmistakable — a pulsing red disc, a closing ring, a crosshair, inward chevrons.
        const mv = this.mv, u = mv && mv.exec && mv.phase === 'air' ? mv.t / mv.T : 0, fast = u > 0.6 ? ((t >> 1) & 1) : blink;
        b.draw(F.glow, q[0], q[1], r * 2.4, r * 2.2, 0, 2.4, 0.1, 0.1, (0.25 + 0.3 * u) * (fast ? 1 : 0.6), 1);
        b.draw(F.ring, q[0], q[1], r * 2.1, r * 1.95, t * 0.04, 2.4, 0.2, 0.2, 0.9 * (fast ? 1 : 0.5), 1);
        b.draw(F.ring, q[0], q[1], r * 2.1 * (1.6 - u * 0.6), r * 1.95 * (1.6 - u * 0.6), 0, 2.4, 1.6, 1.6, 0.6, 1);
        for (const a of [0, Math.PI / 2]) b.draw(KF.laser, q[0], q[1], r * 2.4, 4, a, 2.4, 0.3, 0.3, 0.8, 1);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4, d = r * (1.5 - ((t * 0.02 + k * 0.1) % 0.5));
          for (const s2 of [-1, 1]) b.draw(KF.laser, q[0] + Math.cos(a) * d, q[1] + Math.sin(a) * d, 18, 4, a + Math.PI + s2 * 0.6, 2.4, 0.4, 0.3, 0.85, 1);
        }
      }
    }
    // Landing zone of an ordinary leap.
    const mv = this.mv;
    if (mv && mv.type === 'leap' && mv.ring && !mv.exec && !mv.entrance) {
      const q = cam.project(mv.x1, mv.y1, mv.tz + 0.5, this.pr), r = 112 * q[2] * (mv.small ? 0.6 : 1), blink = (t >> 3) & 1 ? 1 : 0.5;
      b.draw(F.ring, q[0], q[1], r * 2, r * 1.8, t * 0.03, 2.2, 0.6, 0.2, 0.55 * blink, 1);
      b.draw(F.glow, q[0], q[1], r * 1.6, r * 1.4, 0, 2, 0.5, 0.15, 0.12, 1);
    }
  }

  /** Over entities (under bullets): flashes, aim lines, shells, missile trails, repair arcs, bars. */
  renderOver(b, alpha) {
    if (!this.is3D) return;
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t, cam = this.cam;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const ln of this.lines) {
      const a = (1 - ln.t / ln.life) * (0.5 + 0.5 * ln.k), c = ln.col;
      b.draw(KF.laser, ln.x + Math.cos(ln.ang) * ln.len / 2, ln.y + Math.sin(ln.ang) * ln.len / 2, ln.len, 2 + ln.k * 3, ln.ang, c[0], c[1], c[2], a * 0.6, 1);
    }
    // Heavy-cannon muzzle glow while charging; the eye.
    for (let i = 0; i < 2; i++) if (!this.dead.hc[i] && this.hcGlow[i] > 0.05) { const mz = this._muzzle(this.M.hcb[i], CC.hcMuzzle); b.draw(F.glow, mz.x, mz.y, 34 * this.hcGlow[i], 34 * this.hcGlow[i], 0, 2.4, 0.3, 0.2, 0.8 * this.hcGlow[i], 1); }
    if (!this.wreck && this.coreOK) {
      const q = this._scr(this.M.hull, CC.eye[0], CC.eye[1] + 2, CC.eye[2]), e = this.eye;
      b.draw(F.glow, q[0], q[1], (26 + e * 22) * q[2], (26 + e * 22) * q[2], 0, 2.4, 0.25, 0.2, 0.35 + e * 0.15, 1);
      b.draw(F.ring, q[0], q[1], 40 * q[2], 40 * q[2], t * 0.04, 0.4, 1.6, 2.4, 0.25 + e * 0.05, 1);
    }
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      if (f.kind === 'cannon') {
        b.draw(F.glow, f.x, f.y, 60 * k, 60 * k, 0, 2.4, 0.5, 0.3, 0.9 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 16, f.y + Math.sin(f.ang) * 16, 50 * k, 14 * k, f.ang, 2.4, 1.2, 0.8, 0.9 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 26 * k, 5 * k, f.ang + s2 * 1.2, 2.2, 0.8, 0.5, 0.55 * k, 1);
      } else if (f.kind === 'rotary') {
        b.draw(F.glow, f.x, f.y, 22 * k, 22 * k, 0, 2.4, 0.5, 0.9, 0.8 * k, 1);
        b.draw(KF.laser, f.x + Math.cos(f.ang) * 8, f.y + Math.sin(f.ang) * 8, 20 * k, 6 * k, f.ang, 2.4, 1.0, 1.4, 0.8 * k, 1);
      } else if (f.kind === 'launch' || f.kind === 'mortar') {
        b.draw(F.glow, f.x, f.y, 40 * k, 40 * k, 0, 2.4, 1.3, 0.5, 0.8 * k, 1);
      } else if (f.kind === 'core') {
        b.draw(F.glow, f.x, f.y, 300 * k, 260 * k, 0, 2.4, 0.4, 0.35, 0.7 * k, 1);
        b.draw(F.ring, f.x, f.y, 360 * (1 - k), 320 * (1 - k), 0, 2.4, 0.6, 0.5, 0.8 * k, 1);
      } else if (f.kind === 'stomp') {
        b.draw(F.ring, f.x, f.y, 220 * (1 - k), 180 * (1 - k), 0, 2.2, 1.2, 0.6, 0.7 * k, 1);
        b.draw(F.glow, f.x, f.y, 90 * k, 70 * k, 0, 2.2, 1, 0.5, 0.5 * k, 1);
      }
    }
    // Mortar shells in flight (3D arcs, projected) with their smoke trails.
    for (const sh of this.shells) {
      const T = sh.trail;
      let px = null, py = null;
      for (let j = 0; j + 2 < T.length; j += 3) {
        const q = cam.project(T[j], T[j + 1], T[j + 2], this.pr), x = q[0], y = q[1];
        if (px !== null) b.draw(KF.laser, (px + x) / 2, (py + y) / 2, Math.hypot(x - px, y - py) + 1, 3 + (j / T.length) * 4, Math.atan2(y - py, x - px), 0.9, 0.8, 0.8, 0.08 + (j / T.length) * 0.2, 1);
        px = x; py = y;
      }
      const q = cam.project(sh.x, sh.y, sh.z, this.pr);
      b.draw(F.glow, q[0], q[1], 22 * q[2], 22 * q[2], 0, 2.4, 1.2, 0.4, 0.9, 1);
      b.draw(F.white, q[0], q[1], 7 * q[2], 7 * q[2], 0, 0.2, 0.18, 0.16, 1, 0);
    }
    // Missile trails.
    for (const m of this.missiles) {
      const T = m.trail;
      for (let j = 0; j + 3 < T.length; j += 2) {
        const u = j / T.length, x0 = T[j], y0 = T[j + 1], x1 = T[j + 2], y1 = T[j + 3];
        b.draw(KF.laser, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) + 1, 2 + u * 3, Math.atan2(y1 - y0, x1 - x0), 1.1, 0.9, 1.1, 0.06 + u * 0.22, 1);
      }
      if (m.alive && m.ang !== undefined) {
        const cx = Math.cos(m.ang), sy = Math.sin(m.ang), fl = 0.75 + 0.25 * Math.sin(t * 1.9 + m.ref._cc);
        b.draw(KF.laser, m.x - cx * 15, m.y - sy * 15, 18 * fl, 6, m.ang, 2.4, 1.3, 0.6, 0.9, 1);
        b.draw(F.glow, m.x - cx * 10, m.y - sy * 10, 16 * fl, 16 * fl, 0, 2.4, 1.0, 0.5, 0.7, 1);
      }
    }
    for (const r of this.reticles) {
      const k = r.t / r.life, a = (1 - k) * ((t >> 2) & 1 ? 1 : 0.55);
      b.draw(F.ring, r.x, r.y, 40 - k * 14, 40 - k * 14, t * 0.05, 2.2, 0.3, 0.8, 0.5 * a, 1);
    }
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
    // Repair: cyan pulse and the progress bar under the machine.
    const ra = this.act && this.act.type === 'regen' && this.c.state === 'fight' ? this.act : null;
    if (ra && ra.phase !== 'go') {
      const q = this._scr(this.M.hull, 0, -14, 50), pulse = 0.6 + 0.4 * Math.sin(t * 0.3);
      b.draw(F.ring, q[0], q[1], 260 * q[2] * (1 + 0.1 * Math.sin(t * 0.2)), 220 * q[2], 0, 0.4, 1.6, 2.2, 0.25 * pulse, 1);
      const bw = 130, by = Math.min(H - 20, q[1] + 140 * q[2]), fill = ra.total ? ra.healed / ra.total : 0;
      b.draw(F.white, q[0], by, bw + 4, 8, 0, 0.05, 0.08, 0.1, 0.7, 0);
      b.draw(F.white, q[0] - bw / 2 + (bw * fill) / 2, by, bw * fill, 4, 0, 0.4, 2, 2.4, 0.95, 1);
      const over = Math.min(1, ra.taken / Math.max(1, this.c.phase.hp * 0.22));
      b.draw(F.white, q[0] - bw / 2 + (bw * over) / 2, by + 6, bw * over, 2, 0, 2.4, 0.5, 0.2, 0.9, 1);
    }
    for (const f of this.fires) {
      if (f.x === undefined) continue;
      const q = cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.i * 3);
      b.draw(F.glow, q[0], q[1], 30 * f.s * fl, 26 * f.s * fl, 0, 2, 0.7, 0.2, 0.55, 1);
    }
  }

  dispose() {
    if (this.view) {
      const i = this.view.extras.indexOf(this);
      if (i >= 0) this.view.extras.splice(i, 1);
      if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
      this.view.camFollow = null;
      this.cam.pitch = this.pitch0;
    }
  }
}

// ------------------------------------------------------------- helpers

function scaleM(x, y, z, o) { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; }

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

/** Column-major frame: axes X, Y, Z, origin o. */
function frameM(o, X, Y, Z, out) {
  out[0] = X[0]; out[1] = X[1]; out[2] = X[2]; out[3] = 0;
  out[4] = Y[0]; out[5] = Y[1]; out[6] = Y[2]; out[7] = 0;
  out[8] = Z[0]; out[9] = Z[1]; out[10] = Z[2]; out[11] = 0;
  out[12] = o[0]; out[13] = o[1]; out[14] = o[2]; out[15] = 1;
  return out;
}

/** Inverse of a rigid transform (rotation + translation). */
function invRigid(m, out) {
  out[0] = m[0]; out[1] = m[4]; out[2] = m[8]; out[3] = 0;
  out[4] = m[1]; out[5] = m[5]; out[6] = m[9]; out[7] = 0;
  out[8] = m[2]; out[9] = m[6]; out[10] = m[10]; out[11] = 0;
  out[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
  out[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
  out[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]);
  out[15] = 1;
  return out;
}

/** Matrix mapping the unit cylinder (y 0..1, radius 1) onto segment a → b with radius r. */
function spanM(a, b, r, o) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / L, fy = dy / L, fz = dz / L;
  let xx = -fy, xy = fx;
  const xl = Math.hypot(xx, xy);
  if (xl < 1e-4) { xx = 1; xy = 0; } else { xx /= xl; xy /= xl; }
  const zx = xy * fz, zy = -xx * fz, zz = xx * fy - xy * fx;
  o.fill(0);
  o[0] = xx * r; o[1] = xy * r; o[2] = 0;
  o[4] = dx; o[5] = dy; o[6] = dz;
  o[8] = zx * r; o[9] = zy * r; o[10] = zz * r;
  o[12] = a[0]; o[13] = a[1]; o[14] = a[2]; o[15] = 1;
  return o;
}

function inQuad(q, x, y, pad) {
  const sg = (q[2] - q[0]) * (q[5] - q[1]) - (q[3] - q[1]) * (q[4] - q[0]) > 0 ? 1 : -1;
  for (let k = 0; k < 4; k++) {
    const ax = q[k * 2], ay = q[k * 2 + 1], bx = q[((k + 1) % 4) * 2], by = q[((k + 1) % 4) * 2 + 1];
    const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
    if (((ex * (y - ay) - ey * (x - ax)) / l) * sg < -pad) return false;
  }
  return true;
}

export { HOME_ROW, EXEC_R };
