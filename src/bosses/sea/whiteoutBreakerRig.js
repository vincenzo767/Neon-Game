import * as P from '../../patterns/index.js';
import { WORLD_W as W, WORLD_H as H } from '../../core/constants.js';
import { FADE_OUT } from '../../fx/Particles.js';
import { sfx } from '../../audio/sfx.js';
import { tankRenderer } from '../../world/tank/TankRenderer.js';
import { M4 } from '../../world/tank/TankMesh.js';
import { TL } from '../../world/tank/tankTextures.js';
import { WB, TYPES, buildWhiteoutBreaker } from '../../world/tank/whiteoutBreakerModel.js';
import { iceAt } from '../../world/env/polarMap.js';

// WHITEOUT BREAKER runtime rig: the colossal polar fortress lying STATIONARY
// in the Pack Ice Lead (world/env/polar.js + polarMap.js), fought section by
// section from the bow to the stern.
//
//   Placement  the hull is fixed in world space (bow toward the pilot, stern up
//              the screen, ≈ 3030 units long): it never sails. Heave and roll
//              are a few tenths of a unit; recoil and impacts shake it.
//   Camera     the rig owns the arena camera for the duel. Fly-in: the camera
//              races up the lead and brakes onto the bow. Each section has a
//              world anchor; during a phase transition the camera holds on the
//              dying section's destruction, then travels along the real hull
//              (eased) to the next anchor — every mount, projectile origin,
//              hitbox and telegraph is re-projected from world space each step.
//              Pitch lifts for the frost-beam charge; heavy fire kicks it.
//   Sections   ten arsenal sections (WB.sections) = the boss's ten phases. The
//              active section's mounts fire; destroyed sections stay as burning
//              wreckage; sections ahead idle (turrets scan, radars turn).
//   Mounts     77 weapon mounts, each a breakable part, each animated from its
//              own pivot: yaw within its arc, barrel elevation, per-barrel
//              recoil, gatling spin, VLS doors, launcher training, charge glow.
//              Every bullet, shell, rocket, missile, flash and telegraph starts
//              at its muzzle / tube / cell on the model.
//   Attacks    a per-section scheduler (one heavy attack at a time, light
//              harassment in between) running the section's own abilities —
//              see SCHED below; 43 attacks across the ten sections.
//   Beam       WHITEOUT BEAM (section 8, and a damaged copy in the final
//              arsenal): charge (core forms, focusing emitters light in turn,
//              vapour gathers, the swept wedge is marked), sweep (lethal on
//              contact, hitbox = the drawn core), cooldown (venting). Focusing
//              emitters lost → a narrower beam; the emitter lost → no beam.
//
// The BossController keeps HP, phases, transitions and the death timeline.

const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const smoother = (t) => { const k = clamp(t, 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); };

// Camera framing per section: [model y of the focus point, screen row it is held on].
const FOCUS = [[0, 474], [-484, 252], [-764, 252], [-1044, 252], [-1324, 250], [-1604, 252], [-1884, 252], [-2164, 252], [-2372, 186], [-2730, 256]];
const ENTER_RUN = 620;       // world units the camera races up the lead during the fly-in
const PAN_T = 84;            // steps of the camera move between sections
const PAN_AT = 50;           // transition step where the move starts (after the section's destruction)
const LOOK = { cover: [0.92, 0.95, 1.0], bounce: [0.1, 0.14, 0.17], shadow: [0.0, 0.02, 0.04], metal: [TL.BARREL, TL.BARREL], gloss: 0.28 };

const SPEC = {
  heavy: { shape: 'bigorb', color: 'red', n: 1, speed: 2.4, split: { shape: 'rice', color: 'red', n: 12, speed: 1.75 }, splitAt: 74, fixed: true },
  heavyMk: { shape: 'bigorb', color: 'red', n: 1, speed: 2.6, split: { shape: 'rice', color: 'red', n: 16, speed: 1.9 }, splitAt: 70, fixed: true },
  shell: { shape: 'orb', color: 'red', n: 3, spread: 0.16, speed: 2.6 },
  shell1: { shape: 'orb', color: 'red', n: 1, speed: 2.8, fixed: true },
  fan7: { shape: 'orb', color: 'red', n: 7, spread: 1.0, speed: 2.0 },
  fan5p: { shape: 'orb', color: 'pink', n: 5, spread: 0.7, speed: 1.75 },
  broad: { shape: 'orb', color: 'red', n: 6, spread: 1.0, speed: 2.0 },
  mg: { shape: 'rice', color: 'red', n: 1, speed: 3.4, fixed: true },
  mgO: { shape: 'rice', color: 'pink', n: 1, speed: 3.0, fixed: true },
  ac: { shape: 'rice', color: 'red', n: 1, speed: 3.2, fixed: true },
  flakOrb: { shape: 'orb', color: 'red', n: 1, speed: 2.2, fixed: true },
  ring18: { shape: 'orb', color: 'red', n: 18, speed: 1.55 },
  ring12r: { shape: 'rice', color: 'pink', n: 12, speed: 2.1 },
  ring8: { shape: 'orb', color: 'red', n: 8, speed: 1.5 },
  ring16: { shape: 'orb', color: 'red', n: 16, speed: 1.6 },
  rocket: { shape: 'kunai', color: 'orange', n: 1, speed: 1.5, accel: 0.05, maxSpd: 4.0, fixed: true },
  rocketC: { shape: 'kunai', color: 'orange', n: 1, speed: 2.6, fixed: true },
  mineBurst: { shape: 'orb', color: 'red', n: 10, speed: 1.6, accel: -0.016, minSpd: 0.35 },
  frost: { shape: 'kunai', color: 'cyan', n: 1, speed: 2.6, fixed: true },
  frostFan: { shape: 'kunai', color: 'cyan', n: 7, spread: 1.2, speed: 2.2 },
  frostOrb: { shape: 'orb', color: 'cyan', n: 3, spread: 0.4, speed: 2.0 },
  frostRing: { shape: 'orb', color: 'cyan', n: 20, speed: 1.5 },
  frostRing2: { shape: 'rice', color: 'blue', n: 16, speed: 2.0 },
  shards: { shape: 'kunai', color: 'cyan', n: 10, speed: 2.0 },
  frostBig: { shape: 'bigorb', color: 'white', n: 1, speed: 1.9, fixed: true },
  gust: { shape: 'rice', color: 'cyan', n: 1, speed: 2.7, fixed: true },
};

/** Flat stand-in camera when no arena world is up (2D fallback). */
const ORTHO = {
  ortho: true, cy: 0, x: 0, y: 0, pitch: 0, roll: 0,
  project(x, y, z, out = [0, 0, 0, 0]) { out[0] = x + W / 2; out[1] = H - (y - this.y) * 0.9 - 80; out[2] = 0.9; out[3] = 1000; return out; },
  unproject(sx, sy, h = 0, out = [0, 0, 0]) { out[0] = sx - W / 2; out[1] = this.y + (H - 80 - sy) / 0.9; out[2] = h; return out; },
  footprint() { return { x0: -W, x1: W, y0: this.y - 200, y1: this.y + 900 }; },
  frame() {},
};

// Section schedulers: heavy rotation, gap between heavies (steps at rate 1), light harassment.
const SCHED = [
  { heavy: ['bowSalvo', 'arcticFan', 'crossGrid', 'hammer'], gap: 46, light: 'lightBow' },
  { heavy: ['tripleSalvo', 'flakCurtain', 'converge', 'turretCross'], gap: 44, light: 'lightSecs' },
  { heavy: ['rocketFan', 'saturation', 'staggered', 'minefield'], gap: 44, light: 'lightSides' },
  { heavy: ['vlsSat', 'hunter', 'splitTraj', 'delayed'], gap: 50, light: null },
  { heavy: ['ironRain', 'trackSweep', 'crossLane', 'rotFlak', 'gapCollapse'], gap: 40, light: 'lightAc' },
  { heavy: ['dualSalvo', 'artilleryWalk', 'missileLattice', 'explosiveRing'], gap: 40, light: 'deckSat' },
  { heavy: ['portBroadside', 'stbdBroadside', 'alternating', 'crossSweep', 'polarShard'], gap: 40, light: 'lightPods' },
  { heavy: ['frostSlugs', 'glacialRing', 'whiteoutGust', 'frozenCorridor', 'cryoSurge'], gap: 44, light: 'lightCryo' },
  { heavy: ['beam', 'auxVolley', 'beam', 'auxVolley'], gap: 36, light: null },
  { heavy: ['totalSat', 'finalWhiteout', 'polarSiege', 'lastBattery', 'requiem', 'finalWhiteout'], gap: 34, light: 'lightFinal' },
];
const CALLOUT = {
  bowSalvo: 'BOWBREAKER SALVO', arcticFan: 'ARCTIC FAN', hammer: 'HAMMER SHOT', crossGrid: 'CROSSFIRE GRID',
  tripleSalvo: 'TRIPLE SALVO', converge: 'CONVERGING FIRE', flakCurtain: 'FLAK CURTAIN', turretCross: 'TURRET CROSSFIRE',
  rocketFan: 'ROCKET FAN', saturation: 'SATURATION VOLLEY', staggered: 'STAGGERED BARRAGE', minefield: 'ROCKET MINEFIELD',
  vlsSat: 'VLS SATURATION', hunter: 'HUNTER SALVO', splitTraj: 'SPLIT TRAJECTORY', delayed: 'DELAYED DETONATION',
  ironRain: 'IRON RAIN', trackSweep: 'TRACKING SWEEP', crossLane: 'CROSS-LANE SATURATION', rotFlak: 'ROTATING FLAK', gapCollapse: 'GAP COLLAPSE',
  dualSalvo: 'DUAL SALVO', artilleryWalk: 'ARTILLERY WALK', missileLattice: 'MISSILE LATTICE', explosiveRing: 'EXPLOSIVE RING',
  portBroadside: 'PORTSIDE BROADSIDE', stbdBroadside: 'STARBOARD BROADSIDE', alternating: 'ALTERNATING FLANKS', crossSweep: 'CROSSFIRE SWEEP', polarShard: 'POLAR SHARD BURST',
  frostSlugs: 'FROST SLUGS', glacialRing: 'GLACIAL RING', whiteoutGust: 'WHITEOUT GUST', frozenCorridor: 'FROZEN CORRIDOR', cryoSurge: 'CRYO SURGE',
  beam: 'WHITEOUT BEAM', auxVolley: 'FOCUSING ARRAY VOLLEY',
  totalSat: 'TOTAL SATURATION', polarSiege: 'POLAR SIEGE', requiem: 'WHITEOUT REQUIEM', lastBattery: 'LAST BATTERY', finalWhiteout: 'FINAL WHITEOUT',
};

const mat = () => new Float32Array(16);
/** a · b → o (column-major 4×4), unrolled and allocation-free; o may alias a or b. */
function mm(a, b, o) {
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
  const a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    o[c * 4] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3;
    o[c * 4 + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
    o[c * 4 + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3;
    o[c * 4 + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
  }
  return o;
}
const scaleM = (x, y, z, o) => { M4.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; };

export class WhiteoutBreakerRig {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.view = null;
    this.cam = ORTHO;
    this.X0 = 0; this.Y0 = 0; this.z0 = 0;
    this.s = { heave: 0, roll: 0, pitch: 0, radar: 0 };
    this.p = { ...this.s };
    this.kick = { roll: 0, vr: 0, pitch: 0, vp: 0 };
    this.placed = false; this.ctrlCam = false; this.released = false;
    this.camKick = 0; this.pan = null; this.camV = 0;
    this.t = 0; this.deathT = -1; this.wreck = false;
    // Mounts.
    this.mt = WB.mounts.map((d) => {
      const T = TYPES[d.type], nb = T.barrels ? T.barrels.length : 1;
      const m = {
        ...d, T, yaw: d.rest, pyaw: d.rest, el: T.rest || 0, pel: T.rest || 0, elT: null, yawT: null, aim: null,
        rec: new Float32Array(nb), prec: new Float32Array(nb), heat: 0, spin: 0, pspin: 0, spinV: 0, charge: 0, dead: false, hit: 0,
        alt: 0, idle: (d.id * 1.37) % TAU,
        M: mat(), Mb: Array.from({ length: nb }, mat), Mc: mat(),
      };
      if (d.type === 'vls') { m.doors = new Float32Array(16); m.pdoors = new Float32Array(16); m.doorT = new Float32Array(16); m.Md = Array.from({ length: 16 }, mat); m.cell = 0; }
      return m;
    });
    this.G = WB.sections.map(() => ({}));
    for (const m of this.mt) (this.G[m.sec][m.part] = this.G[m.sec][m.part] || []).push(m);
    this.secDead = new Array(10).fill(false);
    this.secFire = new Array(10).fill(0);
    this.partHp = {}; this.partEnt = {};
    // Attacks.
    this.atk = null; this.rot = 0; this.cool = 60; this.sec = 0; this.desp = false;
    this.later = [];
    this.hist = [];
    this.mid = 0;
    // Projectiles / FX state.
    this.shells = []; this.pops = []; this.tracked = []; this.spikes = []; this.patches = []; this.debris = [];
    this.flashes = []; this.lines = []; this.zones = []; this.lanes = []; this.marks = []; this.rings = []; this.fires = [];
    this.fb = null;           // frost beam state
    this.cold = 0; this.coldT = 0; this.gust = 0; this.gustDir = 1; this.gustT = 0;
    this.M = { hull: mat(), tmp: mat(), tmp2: mat(), deb: mat(), pad: mat(), radar: mat() };
    this.pr = [0, 0, 0, 0]; this.q3 = [0, 0, 0]; this.wp = [0, 0, 0]; this.mw3 = [0, 0, 0];
    this.vis = [0, 0];
    this.bodyX = 0;
    this.surf = null; this.flash = 0;
  }

  get is3D() { return !!this.view && !this.cam.ortho; }
  get rate() { return (this.c.intensity || 1) * (1 + 0.12 * (this.c.mk - 1)) * (this.desp ? 1.25 : 1); }

  // ------------------------------------------------------------ binding

  _attach() {
    const v = (this.w.arena && this.w.arena.view) || null;
    if (v === this.view) { if (this.view) this.cam.frame(1); return; }
    if (this.view) {
      const i = this.view.extras.indexOf(this);
      if (i >= 0) this.view.extras.splice(i, 1);
      if (this.ctrlCam) this.view.speedTarget = this.view.baseSpeed;
      if (this.pitch0 !== undefined) { this.view.cam.pitch = this.pitch0; this.view.cam.roll = 0; }
      this._releaseSurface();
    }
    this.view = v && v.cam ? v : null;
    this.cam = this.view ? this.view.cam : ORTHO;
    this.ctrlCam = false;
    if (this.view) {
      this.view.extras.push(this);
      if (!this.wreck && !this.released) { this.ctrlCam = true; this.view.speedTarget = null; }
      this.view.camFollow = (vw) => this._follow(vw);
      this.pitch0 = this.cam.pitch;
      this.z0 = this.view.floorZ || 0;
      this.surf = this.view.surfaces.find((s) => s.type === 'water') || null;
      if (this.surf) { this.surf.ship = { a: new Float32Array(4), b: new Float32Array(4), c: new Float32Array(4) }; this.surf.rings = new Float32Array(24); }
      this.cam.frame(1);
    }
    // A new world (Hell's desperation arena): the hull moves under the camera so the
    // current section is framed at once (the camera never teleports).
    if (this.placed && this.view) this._placeFor(this.sec);
    this.shells.length = 0; this.pops.length = 0; this.debris.length = 0; this.rings.length = 0; this.spikes.length = 0; this.patches.length = 0;
  }

  _releaseSurface() { if (this.surf) { delete this.surf.ship; delete this.surf.rings; } this.surf = null; }

  /** World y offset (from the camera target) of screen row `row` at height z. */
  _rowOff(row, z = 30) {
    const q = this.cam.unproject(W / 2, row, this.z0 + z, this.q3);
    return q ? q[1] - this.cam.y : 0;
  }

  /** Camera target y that frames section k. */
  _anchor(k) {
    const [fy, row] = FOCUS[k];
    return (this.Y0 - fy) - this._rowOff(row);
  }

  /** Lay the hull so that section k's anchor is where the camera is now. */
  _placeFor(k) {
    const [fy, row] = FOCUS[k];
    this.Y0 = this.cam.y + this._rowOff(row) + fy;
  }

  _place() {
    this.placed = true;
    this.cam.frame && this.cam.frame(1);
    if (this.c.state === 'enter') {
      // The fortress lies ahead up the lead; the camera races in and brakes onto the bow.
      const [fy, row] = FOCUS[0];
      this.Y0 = this.cam.y + ENTER_RUN + this._rowOff(row) + fy;
      this.camV = this.view ? Math.max(0.5, this.view.speed) : 0;
      if (this.is3D) sfx.play('shipHorn', { pan: 0, v: 0.8 });
    } else this._placeFor(this.sec);
    for (const k of Object.keys(this.s)) this.p[k] = this.s[k];
  }

  // ------------------------------------------------------------- update

  update() {
    const c = this.c, e = c.e;
    this._attach();
    if (!this.placed) { this.sec = (c.phase && c.phase.section) || 0; this._place(); }
    for (const k of Object.keys(this.s)) this.p[k] = this.s[k];
    for (const m of this.mt) {
      m.pyaw = m.yaw; m.pel = m.el; m.pspin = m.spin; m.prec.set(m.rec);
      if (m.doors) m.pdoors.set(m.doors);
    }
    this.t++;
    switch (c.state) {
      case 'enter': this.sec = 0; break;
      case 'fight': this._fight(); break;
      case 'transition': this._transition(); break;
      case 'dying': this._dying(); break;
      default: break;
    }
    this._camera();
    this._motion();
    this._mounts();
    this._visible();
    this._pose(1, this.c.state === 'dying' ? -1 : this.sec);
    if (this.is3D) { e.f = null; e.f2 = null; this.flash = e.flash > 0 ? 1 : this.flash * 0.7; }
    c.ease = 0;
    this._body();
    this._parts();
    this._runLater();
    this._updateAttack();
    this._updateBeam();
    this._updateShells();
    this._updatePops();
    this._track();
    this._updateSpikes();
    this._updateLanes();
    this._updateDebris();
    this._updateRings();
    this._updateEnv();
    this._water();
    if (this.is3D) this._fx();
    for (const L of [this.flashes, this.lines, this.zones, this.marks]) for (let i = L.length - 1; i >= 0; i--) if (++L[i].t >= L[i].life) L.splice(i, 1);
  }

  // ------------------------------------------------------------- camera

  _camera() {
    if (!this.ctrlCam || !this.view) return;
    const c = this.c, cam = this.cam;
    let sp;
    if (c.state === 'enter') {
      // Race up the lead, then brake hard onto the bow anchor (arrives as the fly-in ends).
      const d = this._anchor(0) - cam.y, vT = clamp(d * 0.034, 0, 7.5);
      this.camV += clamp(vT - this.camV, -0.16, 0.12);
      sp = Math.min(this.camV, Math.max(0, d));
    } else if (this.pan) {
      const f = this.pan, u = (c.st - f.t0) / f.T;
      const yT = lerp(f.a, this._anchor(f.k), smoother(u));
      sp = yT - cam.y;
      if (u >= 1) this.pan = null;
    } else if (c.state === 'dying' && this.deathT > 150) sp = 0;
    else sp = clamp((this._anchor(this.sec) - cam.y) * 0.08, -3, 3);
    this.view.speed = sp;
  }

  /** After each camera step: lateral sway toward the pilot, pitch lift for the beam, kicks, roll. */
  _follow(vw) {
    const cam = vw.cam, p = this.w.player;
    const beamLift = this.fb && this.fb.phase === 'charge' ? 0.03 * smooth(this.fb.t / 60) : this.fb && this.fb.phase === 'fire' ? 0.03 : 0;
    const panDip = this.pan ? -0.022 * Math.sin(clamp((this.c.st - this.pan.t0) / this.pan.T, 0, 1) * Math.PI) : 0;
    const tx = this.wreck ? 0 : clamp(((p ? p.x : W / 2) - W / 2) * 0.05, -12, 12);
    cam.x += clamp((tx - cam.x) * 0.03, -1, 1);
    const pT = (this.pitch0 ?? cam.pitch) + beamLift + panDip + this.camKick;
    cam.pitch += (pT - cam.pitch) * 0.04;
    const rT = Math.sin(this.t * 0.007) * 0.003 + this.kick.roll * 0.4;
    cam.roll += (rT - cam.roll) * 0.05;
    this.camKick *= 0.9;
  }

  // ------------------------------------------------------------ physics

  _motion() {
    const s = this.s, K = this.kick, t = this.t;
    // A fortress this size hardly moves: a slow heave on the swell, recoil and impact shudder.
    K.vr += -K.roll * 0.04 - K.vr * 0.09; K.roll += K.vr;
    K.vp += -K.pitch * 0.05 - K.vp * 0.1; K.pitch += K.vp;
    s.heave += ((Math.sin(t * 0.017) * 0.45 + Math.sin(t * 0.031 + 1.3) * 0.25) - s.heave) * 0.05;
    s.roll = K.roll * 0.02 + Math.sin(t * 0.011) * 0.0006;
    s.pitch = K.pitch * 0.006;
    s.radar += this.secDead[8] || this.wreck ? 0 : 0.03;
  }

  /** Slew every mount toward its target, settle recoil, spin rotors, open / close doors. */
  _mounts() {
    const c = this.c, fight = c.state === 'fight' && !this.wreck;
    const pilot = this._pilotW();
    for (const m of this.mt) {
      for (let j = 0; j < m.rec.length; j++) m.rec[j] *= 0.86;
      m.heat = Math.max(0, m.heat - 0.008);
      m.hit = Math.max(0, m.hit - 1);
      if (m.dead) { m.spinV *= 0.95; m.spin += m.spinV; continue; }
      if (m.T.fixed) {
        if (m.doors) for (let k = 0; k < 16; k++) m.doors[k] += clamp(m.doorT[k] - m.doors[k], -0.08, 0.08);
        continue;
      }
      const active = fight && m.sec === this.sec;
      let want;
      if (m.yawT !== null) want = m.yawT;
      else if (m.aim) want = this._yawTo(m, m.aim);
      else if (active) want = this._yawTo(m, pilot);
      else want = m.rest + Math.sin(this.t * 0.004 + m.idle) * 0.35 * Math.min(1, m.arc);   // idle scan
      if (m.malf) want = m.yaw + m.malf;
      const lo = m.rest - m.arc, hi = m.rest + m.arc;
      want = m.malf ? want : clamp(m.rest + wrapA(want - m.rest), lo, hi);
      const fast = this.desp ? 1.25 : 1;
      m.yaw += clamp(wrapA(want - m.yaw), -m.T.yaw * fast, m.T.yaw * fast);
      const eT = m.elT ?? m.T.rest;
      m.el += clamp(clamp(eT, m.T.el[0], m.T.el[1]) - m.el, -0.02, 0.02);
      if (m.T.spin) { m.spinV += ((m.heat > 0.05 ? 0.95 : 0.03) - m.spinV) * 0.08; m.spin += m.spinV; }
      m.charge = Math.max(0, m.charge - (m.chargeHold ? 0 : 0.02));
    }
  }

  _pilotW() { return this._world(this.w.aimX, this.w.aimY, 0, this.wp); }

  /** Screen point → world point on the plane z = h. */
  _world(sx, sy, h = 0, out = [0, 0, 0]) { return this.cam.unproject(sx, sy, this.z0 + h, out) || out; }

  /** Surface height (absolute z) at world (x, y): the hull's deck, floe / pack ice, or the sea. */
  _zAt(x, y) { const deck = this._onHull(x, y); return this.z0 + (deck || (iceAt(x, y) ? 2.4 : 0)); }

  /** Screen point → the world point on whatever surface is under it (deck, ice or water). */
  _surf(sx, sy, out = [0, 0, 0]) {
    const q = this._world(sx, sy, 27, out), deck = this._onHull(q[0], q[1]);
    if (deck) return this._world(sx, sy, deck, out);
    this._world(sx, sy, 0, out);
    if (iceAt(out[0], out[1])) this._world(sx, sy, 2.4, out);
    return out;
  }

  /** Yaw (mount Rz: 0 = toward the bow, + = toward model −x) that points mount m at world point t. */
  _yawTo(m, t) {
    const dx = (this.X0 - t[0]) - m.x, dy = (this.Y0 - t[1]) - m.y;
    return Math.atan2(-dx, dy);
  }

  /** Model → world (static placement; the few-tenths heave / roll are ignored for gameplay). */
  _mw(x, y, z, out = this.mw3) { out[0] = this.X0 - x; out[1] = this.Y0 - y; out[2] = this.z0 + z; return out; }

  // --------------------------------------------------------------- pose

  /** Which model-y range is worth drawing / posing (camera footprint + tall structures). */
  _visible() {
    const fp = this.cam.footprint(0, 60);
    this.vis[0] = this.Y0 - (fp.y1 + 200);   // model y (stern side): tall structures beyond the top edge project into view
    this.vis[1] = this.Y0 - (fp.y0 - 40);    // model y (bow side)
  }

  _secVisible(k) { const S = WB.sections[k]; return S.y1 >= this.vis[0] && S.y0 <= this.vis[1]; }

  /** Pose the hull and mounts. sec >= 0: only that section's mounts (gameplay steps). */
  _pose(alpha, sec = -1) {
    if (this._posedT === this.t && this._posedA === alpha && (this._posedS === -1 || this._posedS === sec)) return;
    this._posedT = this.t; this._posedA = alpha; this._posedS = sec;
    const s = this.s, p = this.p, M = this.M, T = M.tmp, T2 = M.tmp2;
    const L = (k) => lerp(p[k], s[k], alpha);
    const Hm = M.hull;
    // Hull: rotated π (bow toward −y), heave, a whisper of roll and pitch.
    M4.ident(Hm); Hm[0] = -1; Hm[5] = -1; Hm[12] = this.X0; Hm[13] = this.Y0; Hm[14] = this.z0 + L('heave');
    mm(Hm, M4.rotY(L('roll'), T), Hm);
    mm(Hm, M4.rotX(L('pitch'), T), Hm);
    for (const m of this.mt) {
      if ((sec >= 0 && m.sec !== sec) || m.y < this.vis[0] - 60 || m.y > this.vis[1] + 60) continue;
      const Tp = m.T, yaw = m.pyaw + wrapA(m.yaw - m.pyaw) * alpha, el = lerp(m.pel, m.el, alpha);
      mm(Hm, M4.trans(m.x, m.y, m.z, T), m.M);
      if (m.small) mm(m.M, scaleM(0.72, 0.72, 0.72, T2), m.M);
      if (Tp.fixed) {
        if (m.doors && (m.doors.some((d) => d > 0.01) || m.pdoors.some((d) => d > 0.01))) for (let k = 0; k < 16; k++) {
          const cell = Tp.cells[k], d = m.Md[k], o = lerp(m.pdoors[k], m.doors[k], alpha);
          mm(m.M, M4.trans(cell[0] > 0 ? cell[0] + 4.4 : cell[0] - 4.4, cell[1], Tp.top + 0.15, T), d);
          if (cell[0] < 0) mm(d, M4.rotZ(Math.PI, T2), d);
          mm(d, M4.rotY(o * 1.9, T2), d);
        }
        continue;
      }
      if (!Tp.headYaw) mm(m.M, M4.rotZ(yaw, T2), m.M);
      if (Tp.single) {
        const pv = Tp.pivot, mc = m.Mc;
        mm(m.M, M4.trans(pv[0], pv[1], pv[2], T), mc);
        if (Tp.headYaw) mm(mc, M4.rotZ(yaw, T2), mc);
        mm(mc, M4.rotX(el, T2), mc);
        mm(mc, M4.trans(0, -lerp(m.prec[0], m.rec[0], alpha) * Tp.kick, 0, T), mc);
        if (Tp.spin) mm(mc, M4.rotY(lerp(m.pspin, m.spin, alpha), T2), mc);
      } else {
        for (let j = 0; j < Tp.barrels.length; j++) {
          const b = Tp.barrels[j], mb = m.Mb[j];
          mm(m.M, M4.trans(b[0], b[1], b[2], T), mb);
          mm(mb, M4.rotX(el, T2), mb);
          mm(mb, M4.trans(0, -lerp(m.prec[j], m.rec[j], alpha) * Tp.kick, 0, T), mb);
        }
      }
    }
    mm(Hm, M4.trans(WB.radar[0], WB.radar[1], WB.radar[2], T), M.radar);
    mm(M.radar, M4.rotZ(L('radar'), T2), M.radar);
  }

  _scr(m, x, y, z) {
    const q = M4.point(m, x, y, z, this.q3);
    return this.cam.project(q[0], q[1], q[2], this.pr);
  }

  /** Barrel / cradle matrix and local muzzle point of mount m, barrel j. */
  _mzSrc(m, j) {
    const T = m.T;
    if (T.single) return [m.Mc, T.muzzles[j % T.muzzles.length]];
    return [m.Mb[j % m.Mb.length], [0, T.muzzle, 0]];
  }

  /** Screen position + firing angle of a muzzle (barrel axis +y). */
  _mz(m, j, out = {}) {
    const [Mx, pt] = this._mzSrc(m, j);
    const a = this._scr(Mx, pt[0], pt[1], pt[2]), ax = a[0], ay = a[1], k = a[2];
    const b = this._scr(Mx, pt[0], pt[1] + 40, pt[2]);
    out.x = ax; out.y = ay; out.k = k; out.ang = Math.atan2(b[1] - ay, b[0] - ax);
    return out;
  }

  _mzW(m, j, out = [0, 0, 0]) { const [Mx, pt] = this._mzSrc(m, j); return M4.point(Mx, pt[0], pt[1] + 1, pt[2], out); }

  // ------------------------------------------------------------ hull body

  /** The boss's hit body rides the active section's forward deck under the pilot's guns. */
  _body() {
    const e = this.c.e, p = this.w.player, S = WB.sections[this.sec];
    let lx = 0;
    if (p) { const q = this._world(p.x, p.y, 30, this.q3); lx = this.X0 - q[0]; }
    const fy = this.sec === 0 ? -150 : S.y1 - 70, hw = WB.station(fy)[2] - 18;
    this.bodyX += (clamp(lx, -hw, hw) - this.bodyX) * 0.25;
    const q = this._scr(this.M.hull, this.bodyX, fy, WB.deckZ(fy) + 12);
    e.x = clamp(q[0], -18, W + 18); e.y = clamp(q[1], -18, H + 18);
    e.r = 66; e.rot = 0; e.scale = this.pr[2] || 1;
  }

  // ------------------------------------------------------------- parts

  isDestroyed(id) { return this.mt[id].dead; }

  partSpawned(id, pe) {
    const key = `m${id}`;
    if (this.partHp[key] !== undefined) pe.hp = Math.min(pe.hp, this.partHp[key]);
    pe.maxHp = pe.maxHp || pe.hp;
    this.partEnt[key] = pe;
    if (this.is3D) pe.f = null;
  }

  partCleared(id, part) { this.partHp[`m${id}`] = part.e.hp; }

  _mountTop(m) { return this._scr(m.M, 0, 0, Math.min(m.T.top * 0.6, 14)); }

  partDestroyed(id, quiet = false) {
    const m = this.mt[id];
    if (m.dead) return;
    m.dead = true; m.aim = null; m.yawT = null; m.elT = null; m.charge = 0;
    const w = this.w, R = w.fxRng, q = this._mountTop(m), x = q[0], y = q[1];
    const big = m.type === 'tri' || m.type === 'twin' || m.type === 'beam' || m.type === 'rarr' ? 1.9 : m.type === 'ciws' || m.type === 'ac' || m.type === 'aux' ? 0.95 : 1.35;
    w.explosions.blast(x, y, big, m.type === 'cryo' || m.type === 'beam' || m.type === 'aux' ? [0.5, 0.9, 1] : [1, 0.45, 0.25]);
    w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-14, 14), y + R.range(-10, 10), big * 0.6, [1, 0.4, 0.2]));
    w.explosions.sparks(x, y, 26, [1, 0.6, 0.4], 6, 30, 4);
    if (!quiet) { w.g.camera.addTrauma(big > 1.5 ? 0.45 : 0.25); w.g.renderer.post.shockwave(x, y, 0.025, 0.02, 0.35); }
    this._shards(x, y, Math.round(8 * big));
    const wq = M4.point(m.M, 0, 0, 6, [0, 0, 0]);
    this._plates(wq, Math.round(3 * big));
    // Ammunition cooks off in rocket and missile mounts (a few seconds of popping, then it stops).
    if (m.type === 'pod' || m.type === 'rarr' || m.type === 'mbox' || m.type === 'vls') m.cook = 70;
    if (m.type === 'cryo' || m.type === 'beam' || m.type === 'aux') { this._iceBurst(wq[0], wq[1], wq[2], 1.2); sfx.play('iceShatter', { pan: (x - W / 2) / W }); }
    sfx.play('partDown', { pan: (x - W / 2) / W });
    this.fires.push({ m, s: big * 0.7, t: 0 });
  }

  /** Part hitboxes ride the projected mounts (kept inside the World's field box). */
  _parts() {
    for (const part of this.c.kit.parts) {
      if (part.dead || !part.e.alive) continue;
      const m = this.mt[part.d.mountId], pe = part.e;
      const q = this._mountTop(m);
      pe.x = clamp(q[0], -18, W + 18); pe.y = clamp(q[1], -18, H + 18);
      if (pe.flash > 0) m.hit = 6;
      if (this.is3D) pe.f = null;
    }
  }

  // ------------------------------------------------------------- phases

  _fight() {
    const c = this.c;
    const k = (c.phase && c.phase.section) ?? 0;
    if (k !== this.sec || this.pan) { this.sec = k; this.pan = null; }
    if (c.phase && c.phase.desperation && !this.desp) this._goDesperate();
    const p = this.w.player;
    if (p) { this.hist.push(p.x, p.y); if (this.hist.length > 240) this.hist.splice(0, 2); }
    this.cold += clamp((this.sec === 7 ? 0.55 : this.sec === 8 ? 0.75 : this.sec === 9 ? 0.6 : 0.1) + this.coldT - this.cold, -0.004, 0.004);
  }

  _goDesperate() {
    this.desp = true;
    this.c._emit && this.c._emit('bossPhaseCard', { number: this.c.index + 1, total: this.c.total, name: 'WHITEOUT', desperation: true, boss: this.c.name });
    this.w.g.renderer.post.flash(0.8, 0.95, 1, 0.35, 0.03);
    sfx.play('executionAlarm', { pan: 0 });
  }

  _transition() {
    const c = this.c, st = c.st;
    const old = this.sec, next = c.phases[c.index + 1] ? (c.phases[c.index + 1].section ?? old) : old;
    if (st === 1) {
      this._endAttacks();
      if (next !== old) this._sectionDown(old);
      else { this.w.g.renderer.post.flash(0.7, 0.9, 1, 0.3, 0.04); this.coldT = 0.3; }
    }
    if (st === PAN_AT && next !== old) {
      this.pan = { a: this.cam.y, k: next, t0: st, T: PAN_T };
      this._callout(`ADVANCING — ${WB.sections[next].name}`, 'gold');
    }
    if (st === PAN_AT + PAN_T) this.sec = next;
  }

  /** A section's HP is gone: its surviving mounts detonate in sequence, then a central blast. */
  _sectionDown(k) {
    const w = this.w, R = w.fxRng, list = this.mt.filter((m) => m.sec === k && !m.dead);
    this.secDead[k] = true;
    list.sort(() => R.next() - 0.5);
    list.forEach((m, i) => this._later(4 + i * Math.max(3, Math.floor(36 / Math.max(1, list.length))), () => this.partDestroyed(m.id, true), true));
    const S = WB.sections[k];
    for (let i = 0; i < 9; i++) this._later(4 + i * 5, () => {
      const q = this._scr(this.M.hull, R.range(-90, 90), lerp(S.y1, S.y0, R.next()), 34);
      w.explosions.blast(q[0], q[1], R.range(0.7, 1.3), [1, 0.5, 0.25]);
    }, true);
    this._later(44, () => {
      const q = this._scr(this.M.hull, 0, S.mid, 34), x = q[0], y = q[1];
      w.explosions.blast(x, y, 3.0, [1, 0.5, 0.2]);
      w.explosions.schedule(6, () => w.explosions.blast(x + R.range(-60, 60), y + R.range(-30, 30), 2, [1, 0.6, 0.3]));
      w.g.camera.addTrauma(0.8);
      w.g.renderer.post.shockwave(x, y, 0.05, 0.02, 0.6);
      w.g.renderer.post.flash(1, 0.7, 0.4, 0.3, 0.04);
      const mid = this._mw(0, S.mid, 0, [0, 0, 0]);
      for (const sx of [-1, 1]) { this._splash(mid[0] + sx * 134, mid[1] + R.range(-60, 60), 2, true); this._ring(mid[0] + sx * 140, mid[1], 30, 3, 1.1, 110); }
      this._plates(this._mw(0, S.mid, 40, [0, 0, 0]), 14);
      this._shards(x, y, 26);
      if (this.is3D) for (let i = 0; i < 3; i++) { const p = this._mw(R.range(-80, 80), lerp(S.y1, S.y0, R.next()), 32, [0, 0, 0]); this.view.fx.addFire(p[0], p[1], p[2], R.range(1.1, 1.8), 60 * 100); }
      sfx.play('bossDeath', { pan: 0, v: 0.6 });
    }, true);
  }

  _callout(text, cls = 'red') { if (this.c._emit) this.c._emit('bossCallout', { text, cls }); }

  // --------------------------------------------------------- scheduling

  /** Delayed action (steps). keep = survives the end of the section's attacks (destruction FX). */
  _later(n, fn, keep = false) { this.later.push({ n, fn, keep }); }

  _runLater() {
    for (let i = this.later.length - 1; i >= 0; i--) {
      const L = this.later[i];
      if (--L.n > 0) continue;
      this.later.splice(i, 1);
      if (L.keep || this.c.state === 'fight') L.fn();
    }
  }

  /** Called every step by the phase's pattern: run the section's scheduler. */
  tick(t) {
    const c = this.c;
    if (c.state !== 'fight' || this.wreck) return;
    const S = SCHED[this.sec];
    if (!this.atk && --this.cool <= 0) {
      for (let n = 0; n < S.heavy.length; n++) {
        const name = S.heavy[this.rot++ % S.heavy.length];
        if (this._start(name)) break;
      }
      if (!this.atk) this.cool = 30;
    }
    if (S.light && (!this.atk || this.atk.light)) this[`_light_${S.light}`](t);
  }

  _start(name) {
    const fn = this[`_A_${name}`];
    if (!fn) return false;
    const f = { name, t: 0, light: false };
    if (this[`_S_${name}`] && this[`_S_${name}`](f) === false) return false;
    this.atk = f;
    if (CALLOUT[name]) this._callout(CALLOUT[name], name === 'beam' || name === 'finalWhiteout' ? 'gold' : 'red');
    return true;
  }

  _updateAttack() {
    const f = this.atk;
    if (!f) return;
    if (this.c.state !== 'fight') { this._endAttacks(); return; }
    f.t++;
    if (this[`_A_${f.name}`](f)) {
      this._releaseMounts(this.sec);
      this.atk = null;
      this.cool = Math.round(SCHED[this.sec].gap / Math.min(1.6, this.rate));
    }
  }

  _releaseMounts(k) { for (const m of this.mt) if (m.sec === k) { m.aim = null; m.yawT = null; m.elT = null; m.chargeHold = false; if (m.doorT) m.doorT.fill(0); } }

  _endAttacks() {
    this.atk = null; this.fb = null; this.gust = 0;
    this.later = this.later.filter((L) => L.keep);
    for (const m of this.mt) { m.aim = null; m.yawT = null; m.elT = null; m.chargeHold = false; if (m.doorT) m.doorT.fill(0); }
    this.lines.length = 0; this.marks.length = 0;
    this.zones = this.zones.filter((z) => z.kind === 'patch');
    this.lanes.length = 0;
    this.cool = 70;
  }

  // ------------------------------------------------------- mount helpers

  _live(sec, key) { return (this.G[sec][key] || []).filter((m) => !m.dead); }
  _liveSec(sec, types) { return this.mt.filter((m) => m.sec === sec && !m.dead && (!types || types.includes(m.type))); }

  _onTarget(m, tol = 0.07) { return !m.aim || Math.abs(wrapA(this._yawTo(m, m.aim) - m.yaw)) < tol; }

  _aimAt(m, sx, sy) { m.aim = this._world(clamp(sx, -40, W + 40), clamp(sy, 0, H + 60), 0, m.aim || [0, 0, 0]); m.yawT = null; }

  _angTo(mz, sx, sy) { return Math.atan2(sy - mz.y, sx - mz.x); }

  /** Telegraph: aim line along the barrel (or toward a point). */
  _line(mz, ang, len, k, col = [2.4, 0.3, 0.35]) { this.lines.push({ x: mz.x, y: mz.y, ang, len, t: 0, life: 3, k, col }); }

  /**
   * Fire barrel / tube j of mount m: recoil, muzzle flash, smoke, sound, kick;
   * spec (optional) is fired from the muzzle along `ang` (default: the barrel's
   * screen direction). Returns the muzzle.
   */
  _shot(m, j, spec, ang = null, o = {}) {
    if (m.dead) return null;
    const w = this.w, T = m.T, mz = this._mz(m, j, o.mzOut || (this._mzo || (this._mzo = {})));
    const a = ang ?? mz.ang;
    if (spec) { if (spec.n > 1) P.fan(w, mz.x, mz.y, a, spec); else P.shoot(w, mz.x, mz.y, a, spec.speed, spec); }
    const ri = T.single ? 0 : j % m.rec.length;
    m.rec[ri] = 1; m.heat = Math.min(1, m.heat + (T.spin ? 0.25 : 0.3));
    const kind = m.type === 'tri' || m.type === 'twin' ? 'heavy' : m.type === 'ciws' || m.type === 'ac' ? 'mg' : m.type === 'cryo' || m.type === 'aux' ? 'cryo' : m.type === 'pod' || m.type === 'rarr' || m.type === 'mbox' ? 'rocket' : 'med';
    if (kind !== 'mg' || this.t % 2 === 0) this.flashes.push({ x: mz.x, y: mz.y, ang: a, t: 0, life: kind === 'heavy' ? 13 : kind === 'mg' ? 4 : 8, kind, w: this._mzW(m, j, [0, 0, 0]), k: mz.k * (o.scale || 1) });
    const pan = (mz.x - W / 2) / W;
    if (kind === 'heavy') {
      const wq = this._mzW(m, j, this.q3), dir = M4.dir(m.T.single ? m.Mc : m.Mb[ri], 0, 1, 0, [0, 0, 0]), hz = Math.hypot(dir[0], dir[1]) || 1;
      if (this.is3D) for (let k = 0; k < 4; k++) this.view.fx._smoke(wq[0] + dir[0] * k * 8, wq[1] + dir[1] * k * 8, wq[2] + dir[2] * k * 8, 0.7 - k * 0.1, 0.3, 0.5);
      this._ring(wq[0] + (dir[0] / hz) * 30, wq[1] + (dir[1] / hz) * 30, 5, 2, m.type === 'tri' ? 0.5 : 0.35, 36);
      this.kick.vr += (m.x > 0 ? 1 : -1) * 0.0025; this.kick.vp += 0.002;
      w.g.camera.addTrauma(m.type === 'tri' ? 0.11 : 0.08);
      this.camKick = Math.min(0.01, this.camKick + 0.003);
      if (j === 0) w.g.renderer.post.shockwave(mz.x, mz.y, 0.01, 0.02, 0.22);
      sfx.play('navalGun', { pan, v: m.type === 'tri' ? 1 : 0.75 });
    } else if (kind === 'mg') {
      if (this.t % 5 === 0) sfx.play(m.type === 'ciws' ? 'ciws' : 'autoCannon', { pan });
    } else if (kind === 'rocket') {
      const wq = this._mzW(m, j, this.q3);
      if (this.is3D) { const back = M4.dir(m.Mc, 0, -1, 0, [0, 0, 0]); for (let k = 0; k < 2; k++) this.view.fx._smoke(wq[0] + back[0] * (12 + k * 8), wq[1] + back[1] * (12 + k * 8), wq[2] + back[2] * 10, 0.45, 0.2, 0.4); }
      sfx.play(m.type === 'mbox' ? 'vlsLaunch' : 'rocketLaunch', { pan });
    } else if (kind === 'cryo') {
      const wq = this._mzW(m, j, this.q3);
      if (this.is3D) for (let k = 0; k < 2; k++) this.view.fx._steam(wq[0], wq[1], wq[2], 0.6);
      sfx.play('cryoShot', { pan });
    } else {
      const wq = this._mzW(m, j, this.q3);
      if (this.is3D && this.w.fxRng.chance(0.5)) this.view.fx._smoke(wq[0], wq[1], wq[2], 0.4, 0.3, 0.5);
      sfx.play(m.type === 'mortar' ? 'mortarLaunch' : m.type === 'flak' ? 'cannonFire' : 'autoCannon', { pan });
    }
    return mz;
  }

  /** A tracked projectile (rocket / missile / heavy shell / mine): its bullet is found each step by its tag for trails and its burst. */
  _tracked(m, j, spec, ang, kind, o = {}) {
    const w = this.w, mz = this._shot(m, j, null, ang, o);
    if (!mz) return null;
    const id = ++this.mid;
    let s = spec, tag;
    if (spec.split) { tag = { ...spec.split, _wb: id }; s = { ...spec, split: tag }; }
    if (o.splitAt) s = { ...s, splitAt: o.splitAt };
    const i = P.shoot(w, mz.x, mz.y, ang, s.speed, s);
    if (i < 0) return null;
    if (!tag) { tag = { _wb: id }; w.bullets.ref[i] = tag; }
    const tr = { tag, kind, x: mz.x, y: mz.y, ang, trail: [], alive: true, seen: true, life: 0, splitAt: s.splitAt || 0, zone: o.zone || null, burst: o.burst || 0 };
    this.tracked.push(tr);
    if (o.mine) this.tracked.push({ tag: o.mine, kind: 'mine', x: 0, y: 0, ang: 0, trail: [], alive: true, seen: false, life: 0, wait: 300, burst: 1 });
    return tr;
  }

  // ------------------------------------------------- shells (3D, lobbed)

  /**
   * A lobbed 3D round from barrel j of m onto world point (tx, ty): its impact
   * zone is marked on the water / ice at once; at impact a splash or an ice
   * shatter, a ring wave, the burst spec, and the zone is lethal.
   */
  _lob(m, j, pt, o = {}) {
    const mz = this._shot(m, j, null, null, o);
    if (!mz) return;
    const q = this._mzW(m, j, [0, 0, 0]), T = o.T || 62, tx = pt[0], ty = pt[1], tz = pt[2];
    this.shells.push({ x0: q[0], y0: q[1], z0: q[2], x1: tx, y1: ty, z1: tz, t: 0, T, apex: o.apex || 200, r: o.r || 40, ring: o.ring || null, ring2: o.ring2 || null, frost: !!o.frost, trail: [] });
    if (!o.noZone) this.zones.push({ kind: o.frost ? 'frost' : 'shell', x: tx, y: ty, z: tz + 0.6, r: o.r || 40, t: 0, life: T + 2 });
  }

  _updateShells() {
    const w = this.w;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const sh = this.shells[k];
      sh.t++;
      const u = sh.t / sh.T;
      sh.px = sh.x; sh.py = sh.y; sh.pz = sh.z;
      sh.x = lerp(sh.x0, sh.x1, u); sh.y = lerp(sh.y0, sh.y1, u); sh.z = lerp(sh.z0, sh.z1, u) + 4 * sh.apex * u * (1 - u);
      if (sh.t % 2 === 0) { sh.trail.push(sh.x, sh.y, sh.z); if (sh.trail.length > 30) sh.trail.splice(0, 3); }
      if (sh.t < sh.T) continue;
      this.shells.splice(k, 1);
      const q = this.cam.project(sh.x1, sh.y1, sh.z1, this.pr), x = q[0], y = q[1], rs = sh.r * q[2];
      this._impact(sh.x1, sh.y1, sh.z1, sh.r / 30, sh.frost);
      if (this.c.state === 'fight') {
        this._lethal(x, y, rs);
        if (sh.ring) P.ring(w, x, y, sh.ring, w.rng.angle());
        if (sh.ring2) w.explosions.schedule(8, () => { if (this.c.state === 'fight') P.ring(w, x, y, sh.ring2, w.rng.angle()); });
      }
    }
  }

  _lethal(x, y, r, lethal = false) {
    const p = this.w.player;
    if (p && p.collidable && !p.invulnerable && Math.hypot(p.x - x, p.y - y) < r + p.hitR) p.hit(lethal);
  }

  /** Impact at world (x, y, z): on the deck, on ice or in the sea — blast, ring wave, debris, decal. */
  _impact(x, y, z, s = 1, frost = false) {
    const w = this.w, R = w.fxRng, q = this.cam.project(x, y, z, this.pr), sx = q[0], sy = q[1];
    const deck = z > this.z0 + 12, ice = !deck && z > this.z0 + 1;
    if (frost) {
      this._iceBurst(x, y, z, 1.1 * s);
      w.explosions.blast(sx, sy, 0.7 * s, [0.6, 0.95, 1.2]);
      this.patches.push({ x, y, z: z + 0.3, r: 0, R: 26 * s + R.range(0, 10), t: 0, life: 520, rot: R.angle() });
      sfx.play('iceShatter', { pan: (sx - W / 2) / W });
    } else if (deck) {
      // A shell bursting on the fortress's own (wrecked) deck: sparks, torn plating, scorch.
      w.explosions.blast(sx, sy, 0.95 * s, [1, 0.5, 0.25]);
      w.explosions.sparks(sx, sy, 16, [1, 0.65, 0.35], 5, 26, 3);
      if (this.is3D) { this.view.fx._spark(x, y, z + 2, 10); this.view.fx.decal('scorch', x, y, z + 0.3, 34 * s, R.angle(), 2400); this.view.fx._smoke(x, y, z + 3, 0.8 * s, 0.7, 1); }
      this._plates([x, y, z], 2);
      this.kick.vp += 0.002 * s;
      sfx.play('shellImpact', { pan: (sx - W / 2) / W });
    } else if (ice) {
      this._iceBurst(x, y, z, s);
      w.explosions.blast(sx, sy, 0.9 * s, [1, 0.55, 0.3]);
      if (this.is3D) { this.view.fx.decal('crater', x, y, z + 0.4, 20 * s, R.angle(), 3000); this.view.fx.decal('scorch', x, y, z + 0.3, 40 * s, R.angle(), 3000); }
      sfx.play('iceShatter', { pan: (sx - W / 2) / W });
      sfx.play('shellImpact', { pan: (sx - W / 2) / W });
    } else {
      this._splash(x, y, 1.2 * s, true);
      this._ring(x, y, 6, 2.6, 0.9, 60);
      w.explosions.blast(sx, sy, 0.75 * s, [1, 0.6, 0.35]);
      if (this.is3D) this.view.fx.decal('foam', x, y, 0.7, 60 * s, R.angle(), 200);
      sfx.play('waterSplash', { pan: (sx - W / 2) / W });
    }
    w.g.camera.addTrauma(0.1 * s);
    w.g.renderer.post.shockwave(sx, sy, 0.012 * s, 0.02, 0.28);
  }

  // ------------------------------------------------ VLS cold launch

  /** Cold launch from cell `cell` of VLS block m: popped out, booster lights, pitches over, becomes a missile bullet. */
  _pop(m, cell, o) {
    if (m.dead) return;
    const c0 = m.T.cells[cell], q = M4.point(m.M, c0[0], c0[1], m.T.top + 2, [0, 0, 0]);
    const side = c0[0] > 0 ? -1 : 1;  // world-space outboard (the model is rotated π)
    m.doorT[cell] = 1;
    this.pops.push({ x: q[0], y: q[1], z: q[2], vx: side * 0.25, vy: 0, vz: 1.3, t: 0, T: 20, ox: side, ...o });
    const sq = this.cam.project(q[0], q[1], q[2], this.pr);
    this.flashes.push({ x: sq[0], y: sq[1], ang: -Math.PI / 2, t: 0, life: 10, kind: 'launch', w: q, k: sq[2] });
    if (this.is3D) for (let k = 0; k < 3; k++) this.view.fx._steam(q[0], q[1], q[2] + 2, 0.9);
    sfx.play('vlsLaunch', { pan: (sq[0] - W / 2) / W });
  }

  _updatePops() {
    const w = this.w;
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const m = this.pops[k];
      m.t++;
      m.vz += m.t < 6 ? -0.04 : 0.16;
      m.x += m.vx; m.y += m.vy; m.z += m.vz;
      m.vx += m.ox * 0.02; m.vy -= 0.02;
      if (this.is3D && m.t > 5 && m.t % 2 === 0) this.view.fx._smoke(m.x, m.y, m.z - 6, 0.4, 0.2, 0.3);
      if (m.t < m.T) continue;
      this.pops.splice(k, 1);
      if (this.c.state !== 'fight') continue;
      const q = this.cam.project(m.x, m.y, m.z, this.pr);
      const ang = m.ang ?? Math.atan2(w.aimY - q[1], w.aimX - q[0]) + (m.off || 0);
      const id = ++this.mid, spec = { ...m.spec }, tag = spec.split ? { ...spec.split, _wb: id } : { _wb: id };
      if (spec.split) spec.split = tag;
      const i = P.shoot(w, q[0], q[1], ang, spec.speed, spec);
      if (i < 0) continue;
      if (!spec.split) w.bullets.ref[i] = tag;
      this.tracked.push({ tag, kind: 'missile', x: q[0], y: q[1], ang, trail: [], alive: true, seen: true, life: 0, splitAt: spec.splitAt || 0, burst: spec.split ? 1 : 0 });
      if (m.guided) this.marks.push({ kind: 'reticle', x: w.aimX, y: w.aimY, t: 0, life: 50 });
    }
  }

  /** Follow our tagged bullets for trails; burst effects where split rounds go off. */
  _track() {
    if (!this.tracked.length) return;
    const B = this.w.bullets, live = new Map();
    for (let i = 0; i < B.count; i++) { const r = B.ref[i]; if (r && r._wb) live.set(r, i); }
    for (let k = this.tracked.length - 1; k >= 0; k--) {
      const m = this.tracked[k];
      const i = live.get(m.tag);
      if (i === undefined) {
        if (!m.seen) { if (--m.wait <= 0) this.tracked.splice(k, 1); continue; }
        if (m.alive) {
          m.alive = false;
          if (m.burst && m.life >= m.splitAt * 0.8 && m.x > -10 && m.x < W + 10 && m.y > -10 && m.y < H + 10) {
            const q = this._surf(m.x, m.y, [0, 0, 0]), frost = m.kind === 'frost', deck = q[2] > this.z0 + 12;
            this.w.explosions.blast(m.x, m.y, m.kind === 'mine' ? 0.9 : 0.7, frost ? [0.6, 0.95, 1.2] : [1, 0.5, 0.25]);
            if (frost) this._iceBurst(q[0], q[1], q[2], 0.6);
            else if (deck) { if (this.is3D) { this.view.fx._spark(q[0], q[1], q[2] + 2, 6); this.view.fx.decal('scorch', q[0], q[1], q[2] + 0.3, 20, this.w.fxRng.angle(), 1800); } }
            else if (q[2] > this.z0 + 1) this._iceBurst(q[0], q[1], q[2], 0.5);
            else this._splash(q[0], q[1], 0.6);
            if (m.kind === 'mine') sfx.play('shellImpact', { pan: (m.x - W / 2) / W });
          }
          if (m.zone) m.zone.life = m.zone.t;
        }
        m.trail.shift(); m.trail.shift();
        if (!m.trail.length) this.tracked.splice(k, 1);
        continue;
      }
      m.seen = true;
      m.x = B.x[i]; m.y = B.y[i]; m.ang = B.ang[i]; m.life++;
      if (m.kind === 'rocket' || m.kind === 'missile') {
        if (this.t % 2 === 0) { m.trail.push(m.x, m.y); if (m.trail.length > (m.kind === 'missile' ? 44 : 30)) m.trail.splice(0, 2); }
        if (this.is3D && this.t % 5 === 0) { const q = this._world(m.x, m.y, 40, this.q3); this.view.fx._smoke(q[0], q[1], q[2], 0.22, 0.2, 0.3); }
      }
    }
  }

  // ------------------------------------------------------ ice spikes & lanes

  _spike(x, y, s, delay = 0, life = 200, z = this._zAt(x, y)) { this.spikes.push({ x, y, z, s, t: -delay, life, rot: this.w.fxRng.angle(), tilt: this.w.fxRng.range(-0.25, 0.25), tilt2: this.w.fxRng.range(-0.25, 0.25) }); }

  _updateSpikes() {
    for (let k = this.spikes.length - 1; k >= 0; k--) {
      const s = this.spikes[k];
      s.t++;
      if (s.t === 1) {
        if (this.is3D && this.w.fxRng.chance(0.5)) this._iceBurst(s.x, s.y, s.z, 0.35 * s.s / 14);
        if (s.z < this.z0 + 1 && this.w.fxRng.chance(0.4)) this._splash(s.x, s.y, 0.4);
      }
      if (s.t > s.life) this.spikes.splice(k, 1);
    }
    for (let k = this.patches.length - 1; k >= 0; k--) { const p = this.patches[k]; p.t++; p.r += (p.R - p.r) * 0.08; if (p.t > p.life) this.patches.splice(k, 1); }
  }

  /** Frozen-corridor lanes: telegraph, then eruption (lethal inside the strip for `hot` steps). */
  _updateLanes() {
    const w = this.w;
    for (let k = this.lanes.length - 1; k >= 0; k--) {
      const L = this.lanes[k];
      L.t++;
      if (L.t === L.warn) {
        // Ice formations erupt along the lane, shards burst out of its sides.
        for (let row = L.y0; row <= H + 20; row += 26) {
          const q = this._surf(L.x + w.fxRng.range(-L.w * 0.25, L.w * 0.25), row, [0, 0, 0]);
          this._spike(q[0], q[1], w.fxRng.range(12, 20), Math.round((row - L.y0) / 26) * 1.5, 150, q[2]);
        }
        if (this.c.state === 'fight') for (let row = L.y0 + 40; row < H; row += 110) for (const sd of [-1, 1]) P.fan(w, L.x + sd * L.w * 0.5, row, sd > 0 ? 0 : Math.PI, SPEC.frostFan);
        w.g.camera.addTrauma(0.2);
        sfx.play('iceShatter', { pan: (L.x - W / 2) / W });
      }
      if (L.t >= L.warn && L.t < L.warn + L.hot && this.c.state === 'fight') {
        const p = w.player;
        if (p && p.collidable && !p.invulnerable && Math.abs(p.x - L.x) < L.w * 0.5 + p.hitR && p.y > L.y0) p.hit();
      }
      if (L.t > L.warn + L.hot + 40) this.lanes.splice(k, 1);
    }
  }

  // =====================================================================
  //                         SECTION ABILITIES
  // =====================================================================

  get _g() { return this.G[this.sec]; }
  _m(key, i = 0) { const L = this._live(this.sec, key); return L[i % Math.max(1, L.length)] || null; }

  // ---------------------------------------------------------- 0. BOW

  _S_bowSalvo() { return this._live(0, 'twinL').length + this._live(0, 'twinR').length > 0; }
  /** BOWBREAKER SALVO: the twin heavies alternate, each laying both barrels on the pilot (heavy rounds that burst). */
  _A_bowSalvo(f) {
    const guns = [...this._live(0, 'twinL'), ...this._live(0, 'twinR')], r = this.rate, w = this.w;
    if (!guns.length) return true;
    for (const g of guns) this._aimAt(g, w.aimX, w.aimY);
    if (f.t < 24) { if (f.t % 2 === 0) for (const g of guns) { const mz = this._mz(g, 0); this._line(mz, mz.ang, 460, f.t / 24); } return false; }
    const gap = Math.max(18, Math.round(32 / r)), k = Math.floor((f.t - 24) / gap);
    if ((f.t - 24) % gap === 0 && k < 8) {
      const g = guns[k % guns.length], spec = this.c.mk >= 2 ? SPEC.heavyMk : SPEC.heavy;
      for (let j = 0; j < 2; j++) this._later(1 + j * 6, () => { if (!g.dead) { const mz = this._mz(g, j); this._tracked(g, j, spec, this._angTo(mz, w.aimX, w.aimY) + (j - 0.5) * 0.12, 'heavy', { burst: 1 }); } });
    }
    return k >= 8 && f.t > 24 + gap * 8 + 20;
  }

  _S_arcticFan() { return this._live(0, 'tri').length > 0; }
  /** ARCTIC FAN: the triple gun fans red orbs from each barrel, the fans rotating out across the arena. */
  _A_arcticFan(f) {
    const g = this._m('tri'), w = this.w, r = this.rate;
    if (!g) return true;
    const sweep = Math.sin(f.t * 0.03) * 0.5;
    g.yawT = null; this._aimAt(g, w.aimX + sweep * 260, w.aimY);
    const gap = Math.max(16, Math.round(30 / r)), k = Math.floor(f.t / gap);
    if (f.t > 20 && f.t % gap === 0 && k < 7) for (let j = 0; j < 3; j++) this._later(1 + j * 4, () => { if (!g.dead) { const mz = this._mz(g, j); this._shot(g, j, SPEC.fan7, this._angTo(mz, w.aimX, w.aimY) + (j - 1) * 0.3 + (k & 1 ? 0.16 : -0.16)); } });
    return k >= 7 && f.t > gap * 7 + 30;
  }

  _S_hammer() { return this._live(0, 'tri').length > 0; }
  /** HAMMER SHOT: the triple gun elevates and lobs a single huge round onto the marked point → radial bursts. */
  _A_hammer(f) {
    const g = this._m('tri'), w = this.w;
    if (!g) return true;
    if (f.t === 1 || f.t === 110) {
      const p = w.player, vx = p ? p.x - (p.px ?? p.x) : 0;
      const tq = this._surf(clamp(w.aimX + vx * 30, 40, W - 40), clamp(w.aimY, 320, H - 40), [0, 0, 0]);
      f.tq = tq; g.aim = [tq[0], tq[1], 0]; g.elT = 0.55;
      this.zones.push({ kind: 'hammer', x: tq[0], y: tq[1], z: tq[2] + 0.6, r: 58, t: 0, life: 40 + 66 });
      sfx.play('hydraulic', { pan: 0 });
    }
    if ((f.t === 40 || f.t === 150) && f.tq) {
      this._lob(g, 1, f.tq, { T: 66, apex: 280, r: 58, ring: SPEC.ring18, ring2: SPEC.ring12r, noZone: true });
      for (const j of [0, 2]) this._later(j + 2, () => this._shot(g, j, null));
      this.w.g.camera.addTrauma(0.2);
    }
    return f.t > 230;
  }

  _S_crossGrid() { return this._live(0, 'acL').length + this._live(0, 'acR').length > 0; }
  /** CROSSFIRE GRID: the bow autocannons rake intersecting streams across the bottom, leaving narrow corridors. */
  _A_crossGrid(f) {
    const L = this._live(0, 'acL')[0], R = this._live(0, 'acR')[0], r = this.rate;
    if (!L && !R) return true;
    const u = (f.t % 120) / 120, pass = Math.floor(f.t / 120);
    const gap = Math.max(3, Math.round(5 / r));
    const lanes = [[W * (0.95 - u * 0.75), H - 20], [W * (0.05 + u * 0.75), H - 20]];
    [L, R].forEach((m, i) => {
      if (!m) return;
      this._aimAt(m, lanes[i][0] + (pass & 1 ? 40 : -40), lanes[i][1]);
      if (f.t > 16 && f.t % gap === i) { const mz = this._mz(m, f.t & 1); this._shot(m, f.t & 1, SPEC.ac, this._angTo(mz, lanes[i][0], lanes[i][1])); }
    });
    const tri = this._m('tri');
    if (tri && f.t % 70 === 40) { const mz = this._mz(tri, 1); this._shot(tri, 1, SPEC.fan5p, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    return f.t >= 360;
  }

  _light_lightBow(t) {
    const r = this.rate, cyc = Math.round(130 / r), q = t % cyc, m = this._live(0, (Math.floor(t / cyc) & 1) ? 'acR' : 'acL')[0];
    if (!m) return;
    if (q < 24) this._aimAt(m, this.w.aimX, this.w.aimY);
    if (q > 8 && q < 24 && q % 4 === 0) { const mz = this._mz(m, q & 1); this._shot(m, q & 1, SPEC.ac, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    if (q === 26) m.aim = null;
  }

  // ------------------------------------------------- 1. TRIPLE ARTILLERY DECK

  _S_tripleSalvo() { return this._liveSec(1, ['tri']).length > 0; }
  /** TRIPLE SALVO: each turret in turn trains and fires its three guns in a staggered heavy sequence. */
  _A_tripleSalvo(f) {
    const order = ['triL', 'triC', 'triR'].map((k) => this._live(1, k)[0]).filter(Boolean), w = this.w, r = this.rate;
    if (!order.length) return true;
    if (f.t === 1) { f.k = 0; f.ph = 0; f.end = 0; }
    if (f.k >= order.length * (this.c.mk >= 2 ? 2 : 1)) return f.t > f.end + 30;
    const g = order[f.k % order.length];
    this._aimAt(g, w.aimX, w.aimY);
    f.ph++;
    if (f.ph < Math.round(26 / Math.min(1.5, r))) { if (f.ph % 2 === 0) for (let j = 0; j < 3; j++) { const mz = this._mz(g, j); this._line(mz, mz.ang, 500, f.ph / 26); } return false; }
    const q = f.ph - Math.round(26 / Math.min(1.5, r));
    if (q % 7 === 0 && q < 21) { const j = q / 7, mz = this._mz(g, j); this._tracked(g, j, this.c.mk >= 2 ? SPEC.heavyMk : SPEC.heavy, this._angTo(mz, w.aimX, w.aimY) + (j - 1) * 0.1, 'heavy', { burst: 1 }); }
    if (q > 30) { g.aim = null; f.k++; f.ph = 0; f.end = f.t; }
    return false;
  }

  _S_converge() { return this._liveSec(1, ['tri']).length > 0; }
  /** CONVERGING FIRE: the wing turrets hammer where the pilot WAS, the centre turret sweeps across. */
  _A_converge(f) {
    const L = this._live(1, 'triL')[0], R = this._live(1, 'triR')[0], C = this._live(1, 'triC')[0], w = this.w, r = this.rate;
    const n = this.hist.length, past = n >= 80 ? [this.hist[n - 80], this.hist[n - 79]] : [w.aimX, w.aimY];
    const gap = Math.max(12, Math.round(20 / r));
    for (const [m, i] of [[L, 0], [R, 1]]) {
      if (!m) continue;
      this._aimAt(m, past[0], past[1]);
      if (f.t > 20 && f.t % gap === i * Math.floor(gap / 2)) { const j = (f.t / gap) % 3 | 0, mz = this._mz(m, j); this._shot(m, j, SPEC.shell, this._angTo(mz, past[0], past[1])); }
    }
    if (C) {
      C.aim = null; C.yawT = Math.sin(f.t * 0.025) * 0.75;
      if (f.t > 20 && f.t % Math.max(10, Math.round(16 / r)) === 0) this._shot(C, (f.t >> 4) % 3, SPEC.fan5p);
    }
    return f.t >= 230;
  }

  _S_flakCurtain() { return this._live(1, 'flak').length > 0; }
  /** FLAK CURTAIN: flak rounds timed to burst across a band ahead of the pilot — expanding clusters. */
  _A_flakCurtain(f) {
    const F = this._live(1, 'flak'), w = this.w, r = this.rate;
    if (!F.length) return true;
    const gap = Math.max(6, Math.round(10 / r)), k = Math.floor(f.t / gap);
    if (f.t % gap === 0 && k < 18) {
      const m = F[k % F.length], tx = ((k * 0.618) % 1) * (W - 60) + 30, ty = 300 + ((k * 0.382) % 1) * 200;
      this._aimAt(m, tx, ty);
      const mz = this._mz(m, k & 3), d = Math.hypot(tx - mz.x, ty - mz.y);
      const at = Math.max(14, Math.round(d / (SPEC.flakOrb.speed * w.diff.speed)));
      this._tracked(m, k & 3, { ...SPEC.flakOrb, split: { shape: 'rice', color: 'red', n: 8, speed: 1.35 } }, this._angTo(mz, tx, ty), 'flak', { splitAt: at, burst: 1 });
      this.marks.push({ kind: 'flak', x: tx, y: ty, t: 0, life: at });
    }
    return k >= 18 && f.t > 18 * gap + 60;
  }

  _S_turretCross() { return this._liveSec(1, ['tri']).length > 0; }
  /** TURRET CROSSFIRE: each turret holds its own lane, crossing the others'; the lanes shift between volleys. */
  _A_turretCross(f) {
    const T = ['triL', 'triC', 'triR'].map((k) => this._live(1, k)[0]), w = this.w, r = this.rate;
    const lanes = [W * 0.18, W * 0.5, W * 0.82], shift = Math.floor(f.t / 90);
    const gap = Math.max(5, Math.round(8 / r));
    T.forEach((m, i) => {
      if (!m) return;
      const lx = lanes[(2 - i + shift) % 3] + (shift & 1 ? 30 : -30);
      this._aimAt(m, lx, H - 30);
      if (f.t % 90 > 24 && f.t % 90 < 74 && f.t % gap === i) { const j = (f.t / gap) % 3 | 0, mz = this._mz(m, j); this._shot(m, j, SPEC.shell1, this._angTo(mz, lx, H - 30) + Math.sin(f.t * 0.2 + i) * 0.04); }
    });
    return f.t >= 270;
  }

  _light_lightSecs(t) {
    const r = this.rate, cyc = Math.round(150 / r), q = t % cyc, m = this._live(1, 'secs')[(Math.floor(t / cyc) & 1)];
    if (!m) return;
    if (q < 40) this._aimAt(m, this.w.aimX, this.w.aimY);
    if (q === 30 || q === 36) { const mz = this._mz(m, q === 30 ? 0 : 1); this._shot(m, q === 30 ? 0 : 1, SPEC.shell, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    if (q === 42) m.aim = null;
  }

  // ------------------------------------------------------- 2. ROCKET BATTERY

  _rocket(m, tube, ang, spec = SPEC.rocket, o = {}) { return this._tracked(m, tube, spec, ang, 'rocket', o); }

  _S_rocketFan() { return this._liveSec(2, ['pod']).length > 0; }
  /** ROCKET FAN: the deck pods ripple their tubes in widening arcs. */
  _A_rocketFan(f) {
    const pods = [...this._live(2, 'podsF'), ...this._live(2, 'podsA')], w = this.w, r = this.rate;
    if (!pods.length) return true;
    for (const p of pods) { this._aimAt(p, w.aimX, w.aimY); p.elT = 0.32; }
    const gap = Math.max(3, Math.round(5 / r)), k = Math.floor((f.t - 20) / gap);
    if (f.t >= 20 && (f.t - 20) % gap === 0 && k < 40) {
      const p = pods[k % pods.length], tube = (k >> 1) % 20, wave = Math.floor(k / 10);
      const mz = this._mz(p, tube), spread = (((k % 10) - 4.5) / 4.5) * (0.35 + wave * 0.18);
      this._rocket(p, tube, this._angTo(mz, w.aimX, w.aimY) + spread);
    }
    return k >= 40 && f.t > 20 + 40 * gap + 30;
  }

  _S_saturation() { return this._liveSec(2, ['pod']).length > 0; }
  /** SATURATION VOLLEY: every launcher fires a synchronised burst at once, three times. */
  _A_saturation(f) {
    const L = this._liveSec(2, ['pod', 'rarr']), w = this.w, r = this.rate;
    if (!L.length) return true;
    for (const p of L) { this._aimAt(p, w.aimX, w.aimY); p.elT = 0.3; }
    const gap = Math.max(28, Math.round(46 / r));
    if (f.t >= 30 && (f.t - 30) % gap === 0 && (f.t - 30) / gap < 3) {
      const v = (f.t - 30) / gap;
      L.forEach((p, i) => { for (let n = 0; n < 3; n++) this._later(n * 3, () => { if (!p.dead) { const tb = (v * 7 + n * 5 + i) % p.T.muzzles.length, mz = this._mz(p, tb); this._rocket(p, tb, this._angTo(mz, w.aimX, w.aimY) + (n - 1) * 0.22 + (i - L.length / 2) * 0.05); } }); });
      w.g.camera.addTrauma(0.12);
    }
    return f.t > 30 + gap * 3 + 30;
  }

  _S_staggered() { return this._live(2, 'sides').length > 0; }
  /** STAGGERED BARRAGE: the side launchers send rockets across in successive diagonal waves. */
  _A_staggered(f) {
    const S = this._live(2, 'sides'), w = this.w, r = this.rate;
    if (!S.length) return true;
    const gap = Math.max(26, Math.round(40 / r)), wave = Math.floor(f.t / gap), q = f.t % gap;
    if (wave >= 6) return f.t > 6 * gap + 40;
    const m = S[wave % S.length];
    m.aim = null; m.yawT = m.rest; m.elT = 0.25;
    if (q < 15 && q % 3 === 0) {
      // Each wave crosses the arena diagonally from its launcher's side.
      const tb = (wave * 5 + q / 3) % 20, mz = this._mz(m, tb), fromLeft = mz.x < W / 2;
      this._rocket(m, tb, fromLeft ? Math.PI / 2 - 0.62 - q * 0.02 : Math.PI / 2 + 0.62 + q * 0.02, SPEC.rocketC);
    }
    return false;
  }

  _S_minefield() { return this._live(2, 'array').length > 0; }
  /** ROCKET MINEFIELD: the heavy array fires onto marked points; each rocket bursts there into a short-lived cluster. */
  _A_minefield(f) {
    const m = this._live(2, 'array')[0], w = this.w, r = this.rate;
    if (!m) return true;
    if (f.t === 1) {
      f.pts = [];
      const n = 9 + (this.c.mk >= 2 ? 3 : 0);
      for (let i = 0; i < n; i++) f.pts.push([clamp(w.aimX + w.rng.range(-170, 170), 30, W - 30), clamp(w.aimY + w.rng.range(-170, 40), 260, H - 30)]);
      f.zones = f.pts.map(([x, y]) => { const q = this._surf(x, y, [0, 0, 0]); const z = { kind: 'mine', x: q[0], y: q[1], z: q[2] + 0.6, r: 24, t: 0, life: 400 }; this.zones.push(z); return z; });
      this._aimAt(m, w.aimX, w.aimY); m.elT = 0.4;
      sfx.play('hydraulic', { pan: 0 });
    }
    const gap = Math.max(4, Math.round(7 / r));
    if (f.t >= 40 && (f.t - 40) % gap === 0) {
      const k = (f.t - 40) / gap;
      if (k < f.pts.length) {
        const [tx, ty] = f.pts[k], tb = (k * 3) % 28, mz = this._mz(m, tb), d = Math.hypot(tx - mz.x, ty - mz.y);
        const at = Math.max(10, Math.round(d / (SPEC.rocketC.speed * w.diff.speed)));
        this._tracked(m, tb, { ...SPEC.rocketC, split: SPEC.mineBurst }, this._angTo(mz, tx, ty), 'rocket', { splitAt: at, burst: 1, zone: f.zones[k] });
      }
    }
    return f.t > 40 + f.pts.length * gap + 90;
  }

  _light_lightSides(t) {
    const r = this.rate, cyc = Math.round(120 / r), q = t % cyc, m = this._live(2, 'sides')[(Math.floor(t / cyc) & 1)];
    if (!m) return;
    if (q < 30) { this._aimAt(m, this.w.aimX, this.w.aimY); m.elT = 0.25; }
    if (q === 22 || q === 26) { const tb = (t >> 3) % 20, mz = this._mz(m, tb); this._rocket(m, tb, this._angTo(mz, this.w.aimX, this.w.aimY) + (q === 22 ? -0.1 : 0.1)); }
    if (q === 32) { m.aim = null; m.elT = null; }
  }

  // ---------------------------------------------- 3. VERTICAL MISSILE COMPLEX

  _vlsAll() { return [...this._live(3, 'vlsF'), ...this._live(3, 'vlsA')]; }

  /** Pick a VLS block + cell (rippling through the doors). */
  _vlsCell(blocks, k) { const b = blocks[k % blocks.length]; return [b, (b.cell++ * 7) % 16]; }

  _S_vlsSat() { return this._vlsAll().length > 0; }
  /** VLS SATURATION: the cells ripple open and cold-launch staggered waves that turn on the pilot (capped seeker). */
  _A_vlsSat(f) {
    const B = this._vlsAll(), r = this.rate;
    if (!B.length) return true;
    const n = 12 + (this.c.mk >= 2 ? 4 : 0), gap = Math.max(5, Math.round(9 / r));
    if (f.t === 1) for (const b of B) for (let k = 0; k < 4; k++) b.doorT[(b.cell + k * 7) % 16] = 1;
    if (f.t >= 18 && (f.t - 18) % gap === 0) {
      const k = (f.t - 18) / gap;
      if (k < n) {
        const [b, cell] = this._vlsCell(B, k);
        this._pop(b, cell, { guided: k % 3 === 0, off: ((k % 5) - 2) * 0.22, spec: { shape: 'kunai', color: 'pink', n: 1, speed: 1.3, accel: 0.05, maxSpd: 3.3, homing: 0.02, homingTime: 56, fixed: true } });
      }
    }
    return f.t > 18 + n * gap + 60;
  }

  _S_hunter() { return this._liveSec(3, ['mbox']).length > 0; }
  /** HUNTER SALVO: the trainable boxes fire guided pairs on interception paths (limited seeker; a late sidestep beats it). */
  _A_hunter(f) {
    const L = this._liveSec(3, ['mbox']), w = this.w, r = this.rate;
    if (!L.length) return true;
    for (const m of L) { this._aimAt(m, w.aimX, w.aimY); m.elT = 0.35; }
    const gap = Math.max(26, Math.round(40 / r)), k = Math.floor((f.t - 24) / gap);
    if (f.t >= 24 && (f.t - 24) % gap === 0 && k < 4) {
      const m = L[k % L.length];
      for (let s = 0; s < 2; s++) this._later(s * 6, () => {
        if (m.dead) return;
        const tb = (k * 2 + s) % 4, mz = this._mz(m, tb);
        this._tracked(m, tb, { shape: 'kunai', color: 'pink', n: 1, speed: 1.2, accel: 0.05, maxSpd: 3.4, homing: 0.028, homingTime: 66, fixed: true }, this._angTo(mz, w.aimX, w.aimY) + (s ? 0.55 : -0.55), 'missile');
      });
      this.marks.push({ kind: 'reticle', x: w.aimX, y: w.aimY, t: 0, life: 60 });
    }
    return k >= 4 && f.t > 24 + 4 * gap + 40;
  }

  _S_splitTraj() { return this._vlsAll().length > 0; }
  /** SPLIT TRAJECTORY: missile groups pop out and split into left / right / centre lanes to shut escape routes. */
  _A_splitTraj(f) {
    const B = this._vlsAll(), w = this.w, r = this.rate;
    if (!B.length) return true;
    const gap = Math.max(4, Math.round(6 / r)), n = 15;
    if (f.t >= 12 && (f.t - 12) % gap === 0) {
      const k = (f.t - 12) / gap;
      if (k < n) {
        const [b, cell] = this._vlsCell(B, k), lane = k % 3;
        const ang = Math.PI / 2 + (lane === 0 ? 0.5 : lane === 1 ? -0.5 : 0);
        this._pop(b, cell, { ang, spec: { shape: 'kunai', color: 'red', n: 1, speed: 2.1, angVel: lane === 0 ? -0.006 : lane === 1 ? 0.006 : 0, accel: 0.02, maxSpd: 3.2, fixed: true } });
      }
    }
    void w;
    return f.t > 12 + n * gap + 50;
  }

  _S_delayed() { return this._liveSec(3, ['mbox']).length > 0; }
  /** DELAYED DETONATION: missiles fly to points round the pilot and drop timed charges that burst later. */
  _A_delayed(f) {
    const L = this._liveSec(3, ['mbox']), w = this.w, r = this.rate;
    if (!L.length) return true;
    const gap = Math.max(10, Math.round(16 / r)), n = 6;
    if (f.t >= 20 && (f.t - 20) % gap === 0) {
      const k = (f.t - 20) / gap;
      if (k < n) {
        const m = L[k % L.length], tb = k % 4;
        const a = (k / n) * TAU + w.rng.range(-0.3, 0.3), tx = clamp(w.aimX + Math.cos(a) * 90, 30, W - 30), ty = clamp(w.aimY + Math.sin(a) * 70 - 40, 260, H - 30);
        this._aimAt(m, tx, ty); m.elT = 0.3;
        const mz = this._mz(m, tb), d = Math.hypot(tx - mz.x, ty - mz.y), at = Math.max(12, Math.round(d / (2.4 * w.diff.speed)));
        const ring = { shape: 'orb', color: 'red', n: 12, speed: 1.4, _wb: ++this.mid };
        const mine = { shape: 'bigorb', color: 'white', n: 1, speed: 0.12, split: ring, splitAt: 70, fixed: true };
        this._tracked(m, tb, { shape: 'kunai', color: 'pink', n: 1, speed: 2.4, split: mine, fixed: true }, this._angTo(mz, tx, ty), 'missile', { splitAt: at, burst: 1, mine: ring });
      }
    }
    return f.t > 20 + n * gap + 150;
  }

  // ------------------------------------------- 4. MACHINE-GUN DEFENSE GRID

  _ciws4() { return [...this._live(4, 'gridL'), ...this._live(4, 'gridR')]; }

  _S_ironRain() { return this._ciws4().length > 0; }
  /** IRON RAIN: every gatling pours a stream, each sweeping slowly on its own phase — overlapping red rain. */
  _A_ironRain(f) {
    const C = this._ciws4(), r = this.rate;
    if (!C.length) return true;
    const gap = Math.max(4, Math.round(6 / r));
    for (const m of C) {
      m.aim = null; m.yawT = m.rest + Math.sin(f.t * 0.012 + m.id * 1.3) * 0.55 - (m.x < 0 ? -0.2 : 0.2);
      if (f.t > 20 && f.t % 60 < 44 && (f.t + m.id) % gap === 0) this._shot(m, 0, SPEC.mg);
    }
    return f.t >= 260;
  }

  _S_trackSweep() { return this._ciws4().length > 0; }
  /** TRACKING SWEEP: the forward gatlings track the pilot with a lagging aim point. */
  _A_trackSweep(f) {
    const C = this._ciws4().filter((m) => m.y > -1300), w = this.w, r = this.rate;
    if (!C.length) return true;
    if (f.t === 1) f.ax = w.aimX + (w.rng.sign() * 120);
    f.ax += clamp((w.aimX - f.ax) * 0.035, -2.4, 2.4);
    const gap = Math.max(3, Math.round(5 / r));
    C.forEach((m, i) => {
      this._aimAt(m, f.ax + (i - 1.5) * 26, w.aimY);
      if (f.t > 16 && (f.t + i) % gap === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.mgO, this._angTo(mz, f.ax + (i - 1.5) * 26, w.aimY)); }
    });
    return f.t >= 220;
  }

  _S_crossLane() { return this._ciws4().length > 0; }
  /** CROSS-LANE SATURATION: port guns rake the starboard lanes and vice versa; the lanes step each cycle. */
  _A_crossLane(f) {
    const C = this._ciws4(), r = this.rate, step = Math.floor(f.t / 70);
    if (!C.length) return true;
    const gap = Math.max(4, Math.round(6 / r));
    for (const m of C) {
      const left = m.x > 0;   // model +x = world −x (screen left)
      const lx = left ? W * (0.62 + ((step + m.id) % 3) * 0.13) : W * (0.12 + ((step + m.id) % 3) * 0.13);
      this._aimAt(m, lx, H - 20);
      if (f.t % 70 > 14 && (f.t + m.id) % gap === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.mg, this._angTo(mz, lx, H - 20)); }
    }
    return f.t >= 280;
  }

  _S_rotFlak() { return this._live(4, 'guns').some((m) => m.type === 'flak'); }
  /** ROTATING FLAK: the centreline gun arrays traverse through wide arcs, spraying orb bursts. */
  _A_rotFlak(f) {
    const F = this._live(4, 'guns').filter((m) => m.type === 'flak'), r = this.rate;
    if (!F.length) return true;
    const gap = Math.max(5, Math.round(8 / r));
    F.forEach((m, i) => {
      m.aim = null; m.yawT = Math.sin(f.t * 0.02 * (i ? -1 : 1) + i * 1.6) * 1.4;
      if (f.t > 16 && f.t % gap === i * 2) this._shot(m, (f.t / gap) % 4 | 0, SPEC.flakOrb);
    });
    return f.t >= 240;
  }

  _S_gapCollapse() { return this._ciws4().length > 1; }
  /** GAP COLLAPSE: the grid walls fire in from both sides, squeezing the safe corridor, then resets. */
  _A_gapCollapse(f) {
    const C = this._ciws4(), w = this.w, r = this.rate;
    if (f.t === 1) f.cx = clamp(w.aimX, 110, W - 110);
    const u = smooth(f.t / 200), half = lerp(170, 46, u);
    const gap = Math.max(3, Math.round(5 / r));
    C.forEach((m, i) => {
      const left = m.x > 0, k = (i % 4) / 3;
      const lx = left ? lerp(0, f.cx - half, 0.35 + k * 0.65) : lerp(W, f.cx + half, 0.35 + k * 0.65);
      this._aimAt(m, lx, H - 10);
      if (f.t > 18 && (f.t + i) % gap === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.mg, this._angTo(mz, lx, H - 10)); }
    });
    if (f.t % 4 === 0 && f.t > 18) this.marks.push({ kind: 'gap', x: f.cx, y: H - 40, w: half * 2, t: 0, life: 5 });
    return f.t >= 240;
  }

  _light_lightAc(t) {
    const r = this.rate, cyc = Math.round(100 / r), q = t % cyc, L = this._live(4, 'guns').filter((m) => m.type === 'ac');
    const m = L[Math.floor(t / cyc) % Math.max(1, L.length)];
    if (!m) return;
    if (q < 24) this._aimAt(m, this.w.aimX, this.w.aimY);
    if (q > 10 && q < 24 && q % 4 === 0) { const mz = this._mz(m, q & 1); this._shot(m, q & 1, SPEC.ac, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    if (q === 26) m.aim = null;
  }

  // ------------------------------------------------------------ 5. FUSION

  _S_dualSalvo() { return this._liveSec(5, ['twin', 'mbox']).length > 0; }
  /** DUAL SALVO: heavy shells and missiles in coordinated alternation. */
  _A_dualSalvo(f) {
    const A = this._live(5, 'twA')[0], MB = this._live(5, 'missiles'), w = this.w, r = this.rate;
    const cyc = Math.max(60, Math.round(90 / r)), q = f.t % cyc, v = Math.floor(f.t / cyc);
    if (v >= 3) return true;
    if (A) { this._aimAt(A, w.aimX, w.aimY); if (q === 24 || q === 30) { const j = q === 24 ? 0 : 1, mz = this._mz(A, j); this._tracked(A, j, SPEC.heavy, this._angTo(mz, w.aimX, w.aimY), 'heavy', { burst: 1 }); } }
    for (const m of MB) { this._aimAt(m, w.aimX, w.aimY); m.elT = 0.3; }
    if (q === 54 || q === 62) MB.forEach((m, i) => { const tb = (v * 2 + (q === 62 ? 1 : 0)) % 4, mz = this._mz(m, tb); this._tracked(m, tb, { shape: 'kunai', color: 'red', n: 1, speed: 2.0, angVel: (m.x > 0 ? -1 : 1) * 0.006, accel: 0.02, maxSpd: 3.4, fixed: true }, this._angTo(mz, w.aimX, w.aimY) + (m.x > 0 ? 0.5 : -0.5), 'missile'); void i; });
    return false;
  }

  _S_artilleryWalk() { return this._liveSec(5, ['twin']).length > 0; }
  /** ARTILLERY WALK: impact marks walk toward and through the pilot; the twins lob a shell onto each in turn. */
  _A_artilleryWalk(f) {
    const T = this._liveSec(5, ['twin']), w = this.w, r = this.rate;
    if (!T.length) return true;
    if (f.t === 1) {
      const sx = w.rng.chance(0.5) ? 40 : W - 40, n = 7;
      f.pts = [];
      for (let k = 0; k < n; k++) { const u = k / (n - 1); f.pts.push(this._surf(lerp(sx, W - sx, u * 0.9) * 0.4 + (w.aimX + (u - 0.5) * 160) * 0.6, clamp(lerp(300, w.aimY + 30, u), 280, H - 30), [0, 0, 0])); }
      for (const m of T) m.elT = 0.5;
    }
    const gap = Math.max(9, Math.round(14 / r));
    if (f.t >= 20 && (f.t - 20) % gap === 0) {
      const k = (f.t - 20) / gap;
      if (k < f.pts.length) { const m = T[k % T.length], pt = f.pts[k]; m.aim = [pt[0], pt[1], 0]; this._lob(m, k & 1, pt, { T: 56, apex: 220, r: 36, ring: SPEC.ring8 }); }
    }
    return f.t > 20 + f.pts.length * gap + 70;
  }

  _S_missileLattice() { return this._live(5, 'missiles').length > 0; }
  /** MISSILE LATTICE: crossing curved missile paths from both boxes form a lattice with diamond gaps. */
  _A_missileLattice(f) {
    const MB = this._live(5, 'missiles'), r = this.rate;
    if (!MB.length) return true;
    const gap = Math.max(7, Math.round(11 / r)), n = 16;
    for (const m of MB) { m.aim = null; m.yawT = m.rest + (m.x > 0 ? 0.25 : -0.25); m.elT = 0.25; }
    if (f.t >= 16 && (f.t - 16) % gap === 0) {
      const k = (f.t - 16) / gap;
      if (k < n) { const m = MB[k % MB.length], left = m.x > 0, tb = k % 4; this._tracked(m, tb, { shape: 'kunai', color: 'pink', n: 1, speed: 2.2, angVel: (left ? -1 : 1) * 0.0075, fixed: true }, Math.PI / 2 + (left ? 0.85 : -0.85) + (k % 2 ? 0.12 : -0.12), 'missile'); }
    }
    return f.t > 16 + n * gap + 30;
  }

  _S_explosiveRing() { return this._live(5, 'twB').length > 0; }
  /** EXPLOSIVE RING: slow heavy rounds that burst into radial rings. */
  _A_explosiveRing(f) {
    const B = this._live(5, 'twB')[0], w = this.w, r = this.rate;
    if (!B) return true;
    this._aimAt(B, w.aimX, w.aimY - 60);
    const gap = Math.max(32, Math.round(48 / r)), k = Math.floor((f.t - 20) / gap);
    if (f.t >= 20 && (f.t - 20) % gap === 0 && k < 4) { const j = k & 1, mz = this._mz(B, j); this._tracked(B, j, { shape: 'bigorb', color: 'red', n: 1, speed: 1.5, split: SPEC.ring16, splitAt: 66, fixed: true }, this._angTo(mz, w.aimX + (k % 3 - 1) * 80, w.aimY - 60), 'heavy', { burst: 1 }); }
    return k >= 4 && f.t > 20 + 4 * gap + 40;
  }

  _light_deckSat(t) {
    const r = this.rate, cyc = Math.round(80 / r), q = t % cyc, m = this._live(5, 'secs')[(Math.floor(t / cyc) & 1)];
    if (!m) return;
    if (q < 30) this._aimAt(m, this.w.aimX, this.w.aimY);
    if (q === 22 || q === 27) { const j = q === 22 ? 0 : 1, mz = this._mz(m, j); this._shot(m, j, SPEC.shell, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    if (q === 32) m.aim = null;
  }

  // --------------------------------------------------- 6. POLAR FLANK BATTERIES

  /** One side's broadside volley: each barrel lays a broad fan; the fans walk with `walk` (0..1). */
  _broadVolley(side, walk, spec = SPEC.broad) {
    const L = this._live(6, side);
    for (const m of L) {
      const outward = m.x < 0 ? 1 : -1;   // + yaw = toward model −x
      m.aim = null; m.yawT = m.rest + outward * lerp(0.55, -0.2, walk);
      for (let j = 0; j < 2; j++) this._later(j * 5 + (m.y < -1900 ? 4 : 0), () => { if (!m.dead) this._shot(m, j, spec, null); });
    }
    return L.length;
  }

  _S_portBroadside() { return this._live(6, 'port').length > 0; }
  /** PORTSIDE BROADSIDE: the port turrets swing out and fire broad fans, walking forward. */
  _A_portBroadside(f) {
    const gap = Math.max(26, Math.round(40 / this.rate));
    if (f.t < 26) { for (const m of this._live(6, 'port')) { m.aim = null; m.yawT = m.rest + 0.55; } return false; }
    if ((f.t - 26) % gap === 0 && (f.t - 26) / gap < 4 && !this._broadVolley('port', (f.t - 26) / gap / 3)) return true;
    return f.t > 26 + gap * 4 + 20;
  }

  _S_stbdBroadside() { return this._live(6, 'stbd').length > 0; }
  _A_stbdBroadside(f) {
    const gap = Math.max(26, Math.round(40 / this.rate));
    if (f.t < 34) { for (const m of this._live(6, 'stbd')) { m.aim = null; m.yawT = m.rest - 0.55; } return false; }
    if ((f.t - 34) % gap === 0 && (f.t - 34) / gap < 4 && !this._broadVolley('stbd', (f.t - 34) / gap / 3)) return true;
    return f.t > 34 + gap * 4 + 20;
  }

  _S_alternating() { return this._live(6, 'port').length + this._live(6, 'stbd').length > 0; }
  /** ALTERNATING FLANKS: port and starboard answer each other, the safe corridors shifting between volleys. */
  _A_alternating(f) {
    const gap = Math.max(22, Math.round(34 / this.rate));
    if (f.t >= 20 && (f.t - 20) % gap === 0) {
      const v = (f.t - 20) / gap;
      if (v < 8) this._broadVolley(v & 1 ? 'stbd' : 'port', ((v >> 1) % 4) / 3, v % 4 < 2 ? SPEC.broad : SPEC.fan5p);
    }
    return f.t > 20 + gap * 8 + 20;
  }

  _S_crossSweep() { return this._live(6, 'port').length + this._live(6, 'stbd').length > 0; }
  /** CROSSFIRE SWEEP: each side's guns rake the OPPOSITE lane, then the lanes sweep toward each other. */
  _A_crossSweep(f) {
    const w = this.w, r = this.rate, u = smooth(f.t / 220), gap = Math.max(6, Math.round(10 / r));
    for (const side of ['port', 'stbd']) {
      const L = this._live(6, side), lx = side === 'port' ? lerp(W * 0.9, W * 0.45, u) : lerp(W * 0.1, W * 0.55, u);
      L.forEach((m, i) => {
        this._aimAt(m, lx, H - 40);
        if (f.t > 24 && (f.t + i * 3) % gap === 0) { const j = (f.t / gap) & 1, mz = this._mz(m, j); this._shot(m, j, SPEC.shell1, this._angTo(mz, lx, H - 40)); }
      });
    }
    void w;
    return f.t >= 240;
  }

  _S_polarShard() { return this._live(6, 'flak').length > 0; }
  /** POLAR SHARD BURST: flak shells burst into fans of ice-like shards. */
  _A_polarShard(f) {
    const F = this._live(6, 'flak'), w = this.w, r = this.rate;
    if (!F.length) return true;
    const gap = Math.max(12, Math.round(18 / r)), k = Math.floor((f.t - 16) / gap);
    if (f.t >= 16 && (f.t - 16) % gap === 0 && k < 10) {
      const m = F[k % F.length], tx = clamp(w.aimX + w.rng.range(-150, 150), 40, W - 40), ty = clamp(w.aimY - w.rng.range(80, 200), 240, H - 80);
      this._aimAt(m, tx, ty);
      const mz = this._mz(m, k & 3), at = Math.max(14, Math.round(Math.hypot(tx - mz.x, ty - mz.y) / (2.2 * w.diff.speed)));
      this._tracked(m, k & 3, { shape: 'orb', color: 'cyan', n: 1, speed: 2.2, split: SPEC.shards, fixed: true }, this._angTo(mz, tx, ty), 'frost', { splitAt: at, burst: 1 });
      this.marks.push({ kind: 'flak', x: tx, y: ty, t: 0, life: at, frost: true });
    }
    return k >= 10 && f.t > 16 + 10 * gap + 40;
  }

  _light_lightPods(t) {
    const r = this.rate, cyc = Math.round(140 / r), q = t % cyc, m = this._live(6, 'rockets')[(Math.floor(t / cyc) & 1)];
    if (!m) return;
    if (q < 34) { this._aimAt(m, this.w.aimX, this.w.aimY); m.elT = 0.3; }
    if (q === 24 || q === 28 || q === 32) { const tb = (t + q) % 20, mz = this._mz(m, tb); this._rocket(m, tb, this._angTo(mz, this.w.aimX, this.w.aimY) + (q - 28) * 0.04); }
    if (q === 36) { m.aim = null; m.elT = null; }
  }

  // ------------------------------------------------ 7. CRYOGENIC WEAPON ARRAY

  _S_frostSlugs() { return this._liveSec(7, ['mortar']).length > 0; }
  /** FROST SLUGS: the frost mortars lob freezing shells round the pilot; each bursts into shards and leaves ice. */
  _A_frostSlugs(f) {
    const M = this._liveSec(7, ['mortar']), w = this.w, r = this.rate;
    if (!M.length) return true;
    const gap = Math.max(10, Math.round(16 / r)), n = 8;
    if (f.t >= 16 && (f.t - 16) % gap === 0) {
      const k = (f.t - 16) / gap;
      if (k < n) {
        const m = M[k % M.length], a = w.rng.angle(), d = k % 3 === 0 ? 0 : w.rng.range(50, 130);
        const pt = this._surf(clamp(w.aimX + Math.cos(a) * d, 30, W - 30), clamp(w.aimY + Math.sin(a) * d * 0.8, 280, H - 30), [0, 0, 0]);
        m.aim = [pt[0], pt[1], 0]; m.elT = 0.95;
        this._lob(m, k & 1, pt, { T: 62, apex: 260, r: 34, ring: SPEC.shards, frost: true });
      }
    }
    return f.t > 16 + n * gap + 70;
  }

  _S_glacialRing() { return this._live(7, 'cryoC').length > 0; }
  /** GLACIAL RING: a ring of frost is marked round the pilot; ice erupts round it and radial waves roll out from its heart. */
  _A_glacialRing(f) {
    const C = this._live(7, 'cryoC')[0], w = this.w;
    if (!C) return true;
    if (f.t === 1) {
      const q = this._surf(w.aimX, w.aimY, [0, 0, 0]);
      f.c = q; f.sx = w.aimX; f.sy = w.aimY;
      this.zones.push({ kind: 'glacial', x: q[0], y: q[1], z: q[2] + 0.6, r: 120, t: 0, life: 72 });
      C.chargeHold = true; this._aimAt(C, w.aimX, w.aimY);
      sfx.play('frostCharge', { pan: 0, dur: 1.2 });
    }
    if (f.t < 70) { C.charge = Math.min(1, C.charge + 0.03); if (f.t % 3 === 0) { const mz = this._mz(C, 0); this.marks.push({ kind: 'gather', x: mz.x, y: mz.y, t: 0, life: 12 }); } }
    if (f.t === 70) {
      C.chargeHold = false; this._shot(C, 0, null);
      for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; this._spike(f.c[0] + Math.cos(a) * 120, f.c[1] + Math.sin(a) * 120, 16, k % 3, 140); }
      P.ring(w, f.sx, f.sy, SPEC.frostRing, w.rng.angle());
      w.explosions.schedule(14, () => { if (this.c.state === 'fight') P.ring(w, f.sx, f.sy, SPEC.frostRing2, w.rng.angle()); });
      this._iceBurst(f.c[0], f.c[1], f.c[2], 1.4);
      w.g.renderer.post.flash(0.6, 0.9, 1, 0.22, 0.05);
      w.g.camera.addTrauma(0.3);
      sfx.play('iceShatter', { pan: 0 });
    }
    return f.t > 130;
  }

  _S_whiteoutGust() { return this._live(7, 'cryoWing').length > 0; }
  /** WHITEOUT GUST: a wind-driven frost spray sweeps the arena; the wing projectors stream drifting cyan fire into it. */
  _A_whiteoutGust(f) {
    const L = this._live(7, 'cryoWing'), w = this.w, r = this.rate;
    if (!L.length) return true;
    if (f.t === 1) { this.gustDir = w.rng.sign(); this.gustT = 1; }
    this.gust = Math.min(1, this.gust + 0.02);
    const gap = Math.max(4, Math.round(7 / r));
    L.forEach((m, i) => {
      m.aim = null; m.yawT = m.rest + Math.sin(f.t * 0.02 + i * 2) * 0.5;
      if (f.t > 30 && f.t < 210 && (f.t + i * 3) % gap === 0) this._shot(m, 0, { ...SPEC.gust, angVel: this.gustDir * 0.0045 });
    });
    if (f.t > 210) this.gust = Math.max(0, this.gust - 0.04);
    return f.t >= 240;
  }

  _S_frozenCorridor() { return this._liveSec(7, ['cryo']).length > 0; }
  /** FROZEN CORRIDOR: frost markers mark lanes; ice formations erupt along them (lethal while erupting). */
  _A_frozenCorridor(f) {
    const w = this.w;
    if (f.t === 1 || f.t === 120) {
      const n = 3, lw = 54, xs = [];
      const base = clamp(w.aimX, 40, W - 40);
      xs.push(base);
      const others = [base - 150, base + 150, base - 300, base + 300].filter((x) => x > 30 && x < W - 30);
      for (const x of others) if (xs.length < n) xs.push(x);
      for (const x of xs) this.lanes.push({ x, w: lw, y0: 150, t: 0, warn: 70, hot: 26 });
      for (const m of this._liveSec(7, ['cryo'])) this._aimAt(m, base, H - 100);
      sfx.play('frostCharge', { pan: 0, dur: 1.1 });
    }
    return f.t >= 250;
  }

  _S_cryoSurge() { return this._liveSec(7, ['cryo']).length > 0; }
  /** CRYO SURGE: every projector charges (emitters flare, frost gathers) and discharges a freezing burst. */
  _A_cryoSurge(f) {
    const L = this._liveSec(7, ['cryo']), w = this.w;
    if (!L.length) return true;
    if (f.t === 1) { for (const m of L) { m.chargeHold = true; this._aimAt(m, w.aimX, w.aimY); } sfx.play('frostCharge', { pan: 0, dur: 1.5 }); this.coldT = 0.25; }
    if (f.t < 90) for (const m of L) { m.charge = Math.min(1, m.charge + 0.014); if (f.t % 3 === 0) { const mz = this._mz(m, 0); this.marks.push({ kind: 'gather', x: mz.x, y: mz.y, t: 0, life: 12 }); } }
    if (f.t === 90) {
      for (const m of L) {
        m.chargeHold = false;
        const mz = this._shot(m, 0, null);
        if (!mz) continue;
        P.ring(w, mz.x, mz.y, SPEC.frostRing, w.rng.angle());
        for (let k = 0; k < 5; k++) P.shoot(w, mz.x, mz.y, this._angTo(mz, w.aimX, w.aimY) + (k - 2) * 0.32, SPEC.frostBig.speed, SPEC.frostBig);
      }
      w.g.renderer.post.flash(0.6, 0.9, 1, 0.32, 0.04);
      w.g.camera.addTrauma(0.35);
      this.coldT = 0;
    }
    return f.t > 140;
  }

  _light_lightCryo(t) {
    const r = this.rate, cyc = Math.round(120 / r), q = t % cyc, m = this._live(7, 'cryoC')[0];
    if (!m) return;
    if (q < 30) this._aimAt(m, this.w.aimX, this.w.aimY);
    if (q === 26) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.frostOrb, this._angTo(mz, this.w.aimX, this.w.aimY)); }
    if (q === 32) m.aim = null;
  }

  // ------------------------------------------------------- 8. FROST BEAM

  _S_beam() { return this._live(8, 'emitter').length > 0; }
  /** WHITEOUT BEAM: see _updateBeam (the attack waits for its full cycle). */
  _A_beam(f) {
    if (f.t === 1) this._beamStart(this._live(8, 'emitter')[0], [...this._live(8, 'auxL'), ...this._live(8, 'auxR')]);
    this._beamCiws(f.t);
    return !this.fb;
  }

  _S_auxVolley() { return [...this._live(8, 'auxL'), ...this._live(8, 'auxR')].length > 0 || this._live(8, 'ciws').length > 0; }
  /** Focusing-array volley between beams: the aux emitters fire cyan shard fans; the CIWS keep the pressure on. */
  _A_auxVolley(f) {
    const A = [...this._live(8, 'auxL'), ...this._live(8, 'auxR')], w = this.w, r = this.rate;
    const gap = Math.max(16, Math.round(24 / r));
    A.forEach((m, i) => {
      this._aimAt(m, w.aimX, w.aimY); m.elT = 0.05;
      if (f.t > 20 && (f.t + i * 6) % gap === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.frostFan, this._angTo(mz, w.aimX, w.aimY)); }
    });
    if (!A.length) this._beamCiws(f.t, 1.6);
    return f.t >= 150;
  }

  /** Defensive gatlings: sparse bursts during the beam's charge / cooldown (never during the sweep). */
  _beamCiws(t, k = 1) {
    if (this.fb && this.fb.phase === 'fire') return;
    const C = this._live(this.sec, this.sec === 8 ? 'ciws' : 'battery').filter((m) => m.type === 'ciws'), w = this.w;
    const cyc = Math.round(60 / (k * this.rate)), q = t % cyc, m = C[Math.floor(t / cyc) % Math.max(1, C.length)];
    if (!m) return;
    if (q < 20) this._aimAt(m, w.aimX, w.aimY);
    if (q > 8 && q < 20 && q % 4 === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.mgO, this._angTo(mz, w.aimX, w.aimY)); }
  }

  /**
   * Start a beam cycle from emitter `em` with focusing emitters `aux`.
   * Modes rotate: left half, right half, centre lance, double (left then right).
   */
  _beamStart(em, aux, o = {}) {
    if (!em || em.dead) return false;
    const modes = ['left', 'right', 'center', 'double'];
    const mode = o.mode || modes[(this.beamN = (this.beamN || 0) + 1) % 4];
    // Each focusing emitter lost narrows the beam (the stern emitter has none: full width for its size).
    const focus = aux.length ? aux.filter((m) => !m.dead).length / 4 : 1;
    const width = (o.small ? 40 : 54) * (0.6 + 0.4 * focus) * (this.desp ? 1.1 : 1);
    const chargeT = Math.round((o.small ? 120 : 150) / Math.min(1.25, Math.sqrt(this.rate)));
    this.fb = { phase: 'charge', t: 0, em, aux, mode, width, chargeT, fireT: o.small ? 80 : 96, coolT: 80, sweep: 0, ang: 0, a0: 0, a1: 0, pass: 0, small: !!o.small };
    this._beamWedge(this.fb, 0);
    em.chargeHold = true;
    sfx.play('frostCharge', { pan: 0, dur: chargeT / 60 });
    sfx.play('executionAlarm', { pan: 0, v: 0.6 });
    return true;
  }

  /** Wedge (screen angles, 0 = right, π/2 = down) of pass p for the beam's mode. */
  _beamWedge(f, p) {
    const D = Math.PI / 2;
    const m = f.mode === 'double' ? (p === 0 ? 'left' : 'right') : f.mode;
    if (m === 'left') { f.a0 = D + 1.08; f.a1 = D + 0.06; }
    else if (m === 'right') { f.a0 = D - 1.08; f.a1 = D - 0.06; }
    else { f.a0 = D - 0.24; f.a1 = D + 0.24; }
  }

  _beamOrigin(f) { return this._mz(f.em, 0, this._bo || (this._bo = {})); }

  _updateBeam() {
    const f = this.fb, w = this.w;
    if (!f) return;
    if (this.c.state !== 'fight' || f.em.dead) { if (f.em) f.em.chargeHold = false; this.fb = null; return; }
    f.t++;
    const o = this._beamOrigin(f);
    // The head trains along the beam: aim at the water point the current beam angle crosses.
    const ang = f.phase === 'fire' ? f.ang : f.a0;
    const tx = o.x + Math.cos(ang) * 260, ty = o.y + Math.sin(ang) * 260;
    f.em.aim = this._world(clamp(tx, -200, W + 200), clamp(ty, o.y + 40, H + 300), 0, f.em.aim || [0, 0, 0]);
    f.em.elT = -0.03;
    for (const a of f.aux) if (!a.dead) { a.aim = f.em.aim; a.elT = 0.1; }
    if (f.phase === 'charge') {
      const k = f.t / f.chargeT;
      f.em.charge = Math.min(1, k * 1.05);
      // Focusing emitters light in sequence; vapour and crystals gather round the head.
      f.aux.forEach((a, i) => { if (!a.dead) a.charge = clamp((k - 0.15 - i * 0.12) * 3, 0, 1); });
      if (f.t % 2 === 0) this.marks.push({ kind: 'gather', x: o.x + w.fxRng.range(-60, 60), y: o.y + w.fxRng.range(-50, 50), tx: o.x, ty: o.y, t: 0, life: 14 });
      if (this.is3D && f.t % 4 === 0) { const q = this._mzW(f.em, 0, this.q3); this.view.fx._steam(q[0] + w.fxRng.range(-20, 20), q[1] + w.fxRng.range(-20, 20), q[2], 0.8); }
      if (f.t >= f.chargeT) {
        f.phase = 'fire'; f.t = 0; f.ang = f.a0;
        w.g.renderer.post.flash(0.75, 0.95, 1, 0.5, 0.05);
        w.g.renderer.post.shockwave(o.x, o.y, 0.05, 0.03, 0.6);
        w.g.renderer.post.aberrate(0.012);
        w.g.camera.addTrauma(0.5);
        sfx.play('frostBeam', { pan: 0, dur: f.fireT / 60 });
      }
    } else if (f.phase === 'fire') {
      const u = smooth(f.t / f.fireT);
      f.ang = lerp(f.a0, f.a1, u);
      w.g.camera.addTrauma(0.05);
      w.g.renderer.post.heat(0.05);
      // Lethal contact: the hitbox is the drawn core.
      const p = w.player, len = 1100, ex = o.x + Math.cos(f.ang) * len, ey = o.y + Math.sin(f.ang) * len;
      if (p && p.collidable && !p.invulnerable && segDist(p.x, p.y, o.x, o.y, ex, ey) < f.width * 0.42 + p.hitR) p.hit(true);
      // Frost vapour and freezing water along the beam.
      if (this.is3D && f.t % 3 === 0) {
        for (let k = 0; k < 2; k++) {
          const d = w.fxRng.range(80, 700), sx = o.x + Math.cos(f.ang) * d, sy = o.y + Math.sin(f.ang) * d;
          if (sx < -40 || sx > W + 40 || sy > H + 40) continue;
          const q = this._surf(sx, sy, [0, 0, 0]);
          this.view.fx._steam(q[0], q[1], q[2] + 2, 1.1);
          if (f.t % 8 === 0 && k === 0) this.patches.push({ x: q[0], y: q[1], z: q[2] + 0.3, r: 0, R: w.fxRng.range(16, 30), t: 0, life: 700, rot: w.fxRng.angle() });
        }
      }
      if (f.t >= f.fireT) {
        if (f.mode === 'double' && f.pass === 0) { f.pass = 1; f.phase = 'charge'; f.t = Math.round(f.chargeT * 0.62); this._beamWedge(f, 1); sfx.play('frostCharge', { pan: 0, dur: 0.9 }); }
        else { f.phase = 'cool'; f.t = 0; }
      }
    } else if (f.phase === 'cool') {
      f.em.charge = Math.max(0, 1 - f.t / f.coolT);
      for (const a of f.aux) a.charge = Math.max(0, a.charge - 0.03);
      if (this.is3D && f.t % 3 === 0) { const q = this._mzW(f.em, 0, this.q3); this.view.fx._steam(q[0], q[1], q[2] + 4, 1.4); }
      if (f.t >= f.coolT) { f.em.chargeHold = false; f.em.aim = null; for (const a of f.aux) a.aim = null; this.fb = null; }
    }
  }

  // ------------------------------------------------------- 9. FINAL ARSENAL

  _S_totalSat() { return this._liveSec(9).length > 0; }
  /** TOTAL SATURATION: heavy guns, gatlings, rockets and missiles all at once. */
  _A_totalSat(f) {
    const w = this.w, r = this.rate, T = this._live(9, 'triS')[0], V = this._live(9, 'vlsS'), B = this._live(9, 'battery');
    if (T) { this._aimAt(T, w.aimX, w.aimY); if (f.t > 24 && f.t % Math.max(36, Math.round(54 / r)) === 0) { const j = (f.t >> 4) % 3, mz = this._mz(T, j); this._tracked(T, j, SPEC.heavyMk, this._angTo(mz, w.aimX, w.aimY), 'heavy', { burst: 1 }); } }
    for (const m of B) {
      if (m.type === 'ciws') { m.aim = null; m.yawT = m.rest + Math.sin(f.t * 0.018 + m.id) * 0.5; if (f.t > 20 && f.t % 60 < 36 && f.t % Math.max(4, Math.round(6 / r)) === 0) this._shot(m, 0, SPEC.mg); }
      else { this._aimAt(m, w.aimX, w.aimY); m.elT = 0.3; if (f.t % Math.max(18, Math.round(28 / r)) === 10) { const tb = (f.t >> 2) % 20, mz = this._mz(m, tb); this._rocket(m, tb, this._angTo(mz, w.aimX, w.aimY) + w.rng.range(-0.3, 0.3)); } }
    }
    if (V.length && f.t % Math.max(16, Math.round(24 / r)) === 5) { const [b, cell] = this._vlsCell(V, f.t); this._pop(b, cell, { off: w.rng.range(-0.5, 0.5), spec: { shape: 'kunai', color: 'pink', n: 1, speed: 1.4, accel: 0.04, maxSpd: 3.2, homing: 0.018, homingTime: 50, fixed: true } }); }
    return f.t >= 260;
  }

  _S_polarSiege() { return this._live(9, 'triS').length > 0; }
  /** POLAR SIEGE: crossing fans while heavy shells land on timed impact zones. */
  _A_polarSiege(f) {
    const T = this._live(9, 'triS')[0], w = this.w, r = this.rate;
    if (!T) return true;
    const cyc = Math.max(46, Math.round(70 / r)), q = f.t % cyc, v = Math.floor(f.t / cyc);
    if (v >= 4) return f.t > 4 * cyc + 50;
    if (q === 1) { const side = v & 1 ? 1 : -1; T.aim = null; T.yawT = side * 0.6; T.elT = 0.06; }
    if (q === 22 || q === 26 || q === 30) { const j = (q - 22) / 4; this._shot(T, j, SPEC.fan7, null); }
    if (q === 36) {
      const pt = this._surf(clamp(w.aimX + w.rng.range(-60, 60), 40, W - 40), clamp(w.aimY + w.rng.range(-40, 20), 300, H - 30), [0, 0, 0]);
      T.yawT = null; T.aim = [pt[0], pt[1], 0]; T.elT = 0.5;
      this._lob(T, 1, pt, { T: 60, apex: 240, r: 44, ring: SPEC.ring16 });
    }
    return false;
  }

  _S_requiem() { return this._live(9, 'emitterS').length > 0 || this._live(9, 'battery').length > 0; }
  /** WHITEOUT REQUIEM: the damaged emitter sprays rotating frost spirals while the batteries keep the pressure. */
  _A_requiem(f) {
    const E = this._live(9, 'emitterS')[0], w = this.w, r = this.rate;
    this.gust = Math.min(0.7, this.gust + 0.01);
    if (E) {
      E.aim = null; E.yawT = Math.sin(f.t * 0.02) * 0.6; E.elT = 0.05; E.charge = 0.6 + 0.4 * Math.sin(f.t * 0.3);
      if (f.t > 20 && f.t % Math.max(6, Math.round(9 / r)) === 0) {
        const mz = this._mz(E, 0);
        for (let k = 0; k < 3; k++) P.shoot(w, mz.x, mz.y, f.t * 0.07 + (k / 3) * TAU, 1.9, SPEC.frost);
        if (f.t % 4 === 0) sfx.play('cryoShot', { pan: 0 });
      }
    }
    this._light_lightFinal(f.t, 1.3);
    if (f.t > 230) this.gust = Math.max(0, this.gust - 0.03);
    return f.t >= 260;
  }

  _S_lastBattery() { return this._live(9, 'battery').some((m) => m.type === 'pod') || this._live(9, 'vlsS').length > 0; }
  /** LAST BATTERY: every remaining launcher empties in staggered salvos, in rapid succession. */
  _A_lastBattery(f) {
    const pods = this._live(9, 'battery').filter((m) => m.type === 'pod'), V = this._live(9, 'vlsS'), w = this.w, r = this.rate;
    const gap = Math.max(3, Math.round(5 / r));
    for (const m of pods) { this._aimAt(m, w.aimX, w.aimY); m.elT = 0.32; }
    if (f.t > 20 && f.t < 200 && f.t % gap === 0) {
      const k = f.t / gap;
      if (pods.length && k % 3 !== 2) { const m = pods[k % pods.length], tb = k % 20, mz = this._mz(m, tb); this._rocket(m, tb, this._angTo(mz, w.aimX, w.aimY) + Math.sin(k * 0.7) * 0.45); }
      else if (V.length) { const [b, cell] = this._vlsCell(V, k); this._pop(b, cell, { off: Math.sin(k) * 0.6, spec: { shape: 'kunai', color: 'red', n: 1, speed: 2.2, accel: 0.02, maxSpd: 3.4, fixed: true } }); }
    }
    return f.t >= 240;
  }

  _S_finalWhiteout() { return this._live(9, 'emitterS').length > 0; }
  /** FINAL WHITEOUT: the stern emitter sweeps a (narrower) whiteout beam, then the batteries break out in dense patterns. */
  _A_finalWhiteout(f) {
    if (f.t === 1) { if (!this._beamStart(this._live(9, 'emitterS')[0], [], { small: true })) return true; }
    if (this.fb) { this._beamCiws(f.t, 1.2); return false; }
    if (!f.after) f.after = f.t;
    const q = f.t - f.after, w = this.w;
    const T = this._live(9, 'triS')[0];
    if (T && (q === 10 || q === 40 || q === 70)) { T.aim = null; T.yawT = (q / 30 - 1.3) * 0.5; for (let j = 0; j < 3; j++) this._later(j * 3, () => this._shot(T, j, SPEC.fan7, null)); }
    void w;
    return q > 110;
  }

  _light_lightFinal(t, k = 1) {
    const C = this._live(9, 'battery').filter((m) => m.type === 'ciws'), w = this.w;
    const cyc = Math.round(70 / (k * this.rate)), q = t % cyc, m = C[Math.floor(t / cyc) % Math.max(1, C.length)];
    if (!m) return;
    if (q < 24) this._aimAt(m, w.aimX, w.aimY);
    if (q > 10 && q < 24 && q % 4 === 0) { const mz = this._mz(m, 0); this._shot(m, 0, SPEC.mgO, this._angTo(mz, w.aimX, w.aimY)); }
  }

  // ============================================================ world FX

  _ring(x, y, r, vr, s, life) { this.rings.push({ x, y, r, vr, s, s0: s, t: 0, life }); if (this.rings.length > 12) this.rings.shift(); }

  _updateRings() {
    for (let k = this.rings.length - 1; k >= 0; k--) {
      const g = this.rings[k];
      g.t++; g.r += g.vr; g.vr *= 0.985; g.s = g.s0 * (1 - g.t / g.life);
      if (g.t >= g.life) this.rings.splice(k, 1);
    }
  }

  /** Cold, gust and snow levels; wind spray during a gust. */
  _updateEnv() {
    if (this.gustT && this.gust <= 0.01 && !this.atk) this.gustT = 0;
    this.coldT *= 0.995;
  }

  /** Write the stationary hull and the rings into the water surface. */
  _water() {
    const S = this.surf;
    if (!S) return;
    const a = S.ship.a, b = S.ship.b, c = S.ship.c;
    a[0] = this.X0; a[1] = this.Y0 + 1515; a[2] = -1; a[3] = 0;
    b[0] = 1515; b[1] = WB.beam; b[2] = 0.05; b[3] = 1;
    c[0] = 0; c[1] = 0; c[2] = 0; c[3] = 0.21;
    const R = S.rings;
    R.fill(0);
    let n = 0;
    for (let k = this.rings.length - 1; k >= 0 && n < 6; k--, n++) { const g = this.rings[k]; R[n * 4] = g.x; R[n * 4 + 1] = g.y; R[n * 4 + 2] = g.r; R[n * 4 + 3] = Math.max(0, g.s); }
  }

  _shards(x, y, n, col = [0.42, 0.46, 0.52]) {
    const w = this.w, shards = w.explosions.f.shards, L = w.fxLow, R = w.fxRng;
    for (let k = 0; k < n; k++) {
      const j = L.spawn(shards[k % shards.length], x, y, R.range(-3.5, 3.5), R.range(-4, 0.5), R.range(45, 75));
      if (j < 0) continue;
      L.size(j, R.range(6, 12)); L.color(j, col[0], col[1], col[2], col[0] * 0.4, col[1] * 0.4, col[2] * 0.4); L.phys(j, 0.985, 0.17); L.spin(j, R.angle(), R.range(-0.3, 0.3)); L.look(j, 1, 0, FADE_OUT);
    }
  }

  /** Armour plates blown off: real 3D pieces that tumble and land on the deck / ice or splash into the sea. */
  _plates(q, n) {
    const R = this.w.fxRng;
    if (this.debris.length > 36) this.debris.splice(0, this.debris.length - 36);
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(1.2, 3.4);
      this.debris.push({ mesh: R.chance(0.5) ? 'wb.plate' : 'wb.chunk', x: q[0], y: q[1], z: q[2] + 4, sx: R.range(4, 9), sy: R.range(4, 9), sz: R.range(3, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.range(2.5, 5.5), wx: R.range(-0.25, 0.25), wy: R.range(-0.25, 0.25), wz: R.range(-0.25, 0.25), ax: 0, ay: 0, az: 0, life: 0 });
    }
  }

  /** Is world (x, y) over the hull (debris lands on the deck there)? */
  _onHull(x, y) { const ly = this.Y0 - y; if (ly > 0 || ly < -3030) return 0; const st = WB.station(ly); return Math.abs(this.X0 - x) < st[2] ? st[3] : 0; }

  _updateDebris() {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      if (p.life > (p.rest ? 260 : 400)) { this.debris.splice(i, 1); continue; }
      p.life++;
      if (p.rest) continue;
      p.vz -= 0.16; p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.ax += p.wx; p.ay += p.wy; p.az += p.wz;
      const deck = this._onHull(p.x, p.y), ground = this.z0 + (deck || (iceAt(p.x, p.y) ? 3 : 0));
      if (p.z <= ground) {
        if (ground > 0) { p.z = ground; p.rest = true; if (!deck) this._iceBurst(p.x, p.y, ground, 0.25); }
        else if (!p.sunk) { p.sunk = true; p.vx *= 0.2; p.vy *= 0.2; p.vz = -0.25; this._splash(p.x, p.y, 0.35); }
      }
      if (p.sunk && p.z < -20) this.debris.splice(i, 1);
    }
  }

  /** Ice shattering at world (x, y, z): white chunks and crystals thrown up, a frost mist. */
  _iceBurst(x, y, z, s = 1) {
    if (!this.is3D) return;
    const fx = this.view.fx, P2 = fx.p, F = fx.F, R = this.w.fxRng;
    for (let k = 0; k < Math.round(14 * s); k++) {
      const a = R.angle(), sp = R.range(0.8, 2.6) * s;
      const i = P2.spawn(F.chunk, x, y, z + 1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(2, 5) * s, R.range(40, 70));
      if (i < 0) break;
      P2.s0[i] = P2.s1[i] = R.range(2, 4.5) * Math.sqrt(s); P2.r[i] = P2.r1[i] = 0.86; P2.g[i] = P2.g1[i] = 0.94; P2.b[i] = P2.b1[i] = 1.04;
      P2.grav[i] = -0.13; P2.vr[i] = R.range(-0.2, 0.2); P2.drag[i] = 0.99;
    }
    for (let k = 0; k < Math.round(10 * s); k++) {
      const a = R.angle(), sp = R.range(0.5, 2) * s;
      const i = P2.spawn(F.flake, x, y, z + 1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.5, 4) * s, R.range(30, 55));
      if (i < 0) break;
      P2.s0[i] = 4 * s; P2.s1[i] = 2 * s; P2.r[i] = 0.92; P2.g[i] = 0.98; P2.b[i] = 1.1; P2.r1[i] = 0.75; P2.g1[i] = 0.9; P2.b1[i] = 1.1; P2.grav[i] = -0.1; P2.a[i] = 0.9; P2.add[i] = 1;
    }
    for (let k = 0; k < Math.round(3 * s) + 1; k++) {
      const i = P2.spawn(R.pick(F.smoke), x + R.range(-6, 6) * s, y + R.range(-6, 6) * s, z + 2, R.range(-0.3, 0.3), R.range(-0.3, 0.3), R.range(0.3, 0.9), R.range(60, 90));
      if (i < 0) break;
      P2.s0[i] = 10 * s; P2.s1[i] = 44 * s; P2.r[i] = 0.9; P2.g[i] = 0.95; P2.b[i] = 1; P2.r1[i] = 0.82; P2.g1[i] = 0.88; P2.b1[i] = 0.95; P2.a[i] = 0.55; P2.fade[i] = 1; P2.drag[i] = 0.98; P2.rot[i] = R.angle();
    }
  }

  /** Water thrown up: a column (shell / charge) or a low splash. */
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

  /** Smoke from stacks, machinery steam, damage smoke / fire / sparks, cook-offs, broken mounts burning, waterline churn. */
  _fx() {
    const fx = this.view.fx, R = this.w.fxRng, M = this.M, c = this.c, t = this.t;
    const inView = (y) => y > this.vis[0] && y < this.vis[1];
    // Exhaust stacks (grey haze; black when the section is hurt) and machinery steam.
    if (!this.wreck && t % 8 === 0) for (const st of WB.stacks) if (inView(st[1])) { const q = M4.point(M.hull, st[0], st[1], st[2] + 2, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.55, 0.35, 1); }
    if (t % 16 === 0) for (const v of WB.vents) if (inView(v[1])) { const q = M4.point(M.hull, v[0], v[1], v[2], [0, 0, 0]); fx._steam(q[0], q[1], q[2], 0.7); }
    // Warm machinery against freezing water: steam rising off the waterline.
    if (t % 12 === 0) { const ly = lerp(this.vis[0], this.vis[1], R.next()); if (ly < 0 && ly > -3030) { const sd = R.sign(), st = WB.station(ly), q = M4.point(M.hull, sd * (st[1] + 1), ly, 1, [0, 0, 0]); fx._steam(q[0], q[1], 1.5, 0.9); } }
    // Active section damage: smoke below 60 %, sparks below 35 %, fires below 20 %.
    if (c.state === 'fight') {
      const fr = this._secFrac(), S = WB.sections[this.sec];
      if (fr < 0.6 && t % (fr < 0.35 ? 3 : 6) === 0) { const q = M4.point(M.hull, R.range(-80, 80), lerp(S.y0, S.y1, R.next()), 34, [0, 0, 0]); fx._smoke(q[0], q[1], q[2], 0.7, 0.85, 1); }
      if (fr < 0.35 && R.chance(0.1)) { const q = M4.point(M.hull, R.range(-80, 80), lerp(S.y0, S.y1, R.next()), 36, [0, 0, 0]); fx._spark(q[0], q[1], q[2], 6); }
      if (fr < 0.2 && t % 40 === 0 && this.secFire[this.sec] < 2) { this.secFire[this.sec]++; const q = M4.point(M.hull, R.range(-70, 70), lerp(S.y0, S.y1, R.next()), 34, [0, 0, 0]); fx.addFire(q[0], q[1], q[2], R.range(0.9, 1.3), 60 * 120); }
    }
    // Broken mounts burn; cook-offs throw sparks and rockets for a few seconds.
    const nF = this.fires.length;
    this.fires.forEach((f, i) => {
      const m = f.m;
      if (!inView(m.y)) return;
      const q = M4.point(m.M, 0, 0, 6, this.q3), fresh = i >= nF - 6;
      if (t % (fresh ? 9 : 22) === (m.id % 9)) fx._smoke(q[0], q[1], q[2] + 4, f.s * (fresh ? 1 : 0.75), 0.9, 1.1);
      if (R.chance(fresh ? 0.05 : 0.015)) fx._spark(q[0], q[1], q[2], 5);
      if (R.chance(fresh ? 0.1 : 0.03)) fx._ember(q[0] + R.range(-5, 5), q[1] + R.range(-5, 5), q[2] + 3, f.s);
      f.x = q[0]; f.y = q[1]; f.z = q[2];
      if (m.cook > 0) {
        m.cook--;
        if (m.cook % 7 === 0) {
          const sq = this.cam.project(q[0], q[1], q[2], this.pr);
          this.w.explosions.blast(sq[0] + R.range(-8, 8), sq[1] + R.range(-8, 8), R.range(0.35, 0.6), [1, 0.6, 0.3]);
          fx._spark(q[0], q[1], q[2] + 4, 10);
          if (m.cook % 21 === 0) sfx.play('auxPop', { pan: (sq[0] - W / 2) / W });
        }
      }
    });
    // Frozen-lead churn: foam bursts against the hull where the swell slaps it.
    if (t % 7 === 0) {
      const ly = lerp(Math.max(-3030, this.vis[0]), Math.min(0, this.vis[1]), R.next()), sd = R.sign(), st = WB.station(ly);
      const q = M4.point(M.hull, sd * (st[1] + 3), ly, 0, [0, 0, 0]);
      const i = fx.p.spawn(fx.F.foam, q[0], q[1], 0.7, 0, 0, 0, R.range(60, 100));
      if (i >= 0) { const P2 = fx.p; P2.s0[i] = 8; P2.s1[i] = 30; P2.r[i] = P2.g[i] = P2.b[i] = 0.95; P2.r1[i] = 0.8; P2.g1[i] = 0.88; P2.b1[i] = 0.92; P2.a[i] = 0.45; P2.rot[i] = R.angle(); P2.drag[i] = 1; }
    }
  }

  _secFrac() {
    const c = this.c;
    if (!c.floors || !c.phase || c.state !== 'fight') return 1;
    return clamp((c.e.hp - c.floors[c.index]) / Math.max(1, c.phase.hp), 0, 1);
  }

  // ------------------------------------------------------------- dying

  /** Defeat: the final weapons fail and spin, lights flicker, cook-offs, the emitter overloads, the stern blows. */
  _dying() {
    const c = this.c, w = this.w, st = c.st, R = w.fxRng;
    const S = WB.sections[9];
    if (this.deathT < 0) {
      this.deathT = 0; this._endAttacks();
      this.failQ = this.mt.filter((m) => !m.dead && m.sec >= this.sec).sort(() => R.next() - 0.5);
      for (const m of this.failQ) if (m.T.single || m.T.barrels) m.malf = R.sign() * R.range(0.04, 0.1);
      sfx.play('engineFail', { pan: 0 });
      sfx.play('shipHorn', { pan: 0, v: 0.6 });
      this._callout('FINAL ARSENAL FAILING', 'gold');
    }
    this.deathT++;
    const every = Math.max(6, Math.floor(96 / Math.max(1, this.failQ.length)));
    if (st % every === 3 && this.failQ.length && st < 100) { const m = this.failQ.shift(); if (m.type !== 'beam') this.partDestroyed(m.id, true); else this.failQ.push(m); }
    if (st % 6 === 0 && st < 110) { const q = this._scr(this.M.hull, R.range(-90, 90), lerp(S.y0 + 150, S.y1, R.next()), 34); w.explosions.blast(q[0], q[1], R.range(0.6, 1.1), [1, 0.5, 0.25]); w.g.camera.addTrauma(0.06); }
    // The stern emitter overloads: it flares brighter and brighter, venting frost.
    const em = this.mt.find((m) => m.sec === 9 && m.type === 'beam');
    if (em && !em.dead && st > 60) { em.charge = Math.min(1, (st - 60) / 40); em.chargeHold = true; if (st % 4 === 0) { const mz = this._mz(em, 0); this.marks.push({ kind: 'gather', x: mz.x + R.range(-50, 50), y: mz.y + R.range(-40, 40), tx: mz.x, ty: mz.y, t: 0, life: 12 }); } }
    if (st === 100 && em && !em.dead) this.partDestroyed(em.id, true);
    if (st === 112) {
      const q = this._scr(this.M.hull, 0, -2780, 40);
      w.explosions.blast(q[0], q[1], 3.6, [1, 0.5, 0.2]);
      w.explosions.schedule(4, () => w.explosions.blast(q[0], q[1] - 20, 2.6, [0.6, 0.95, 1.2]));
      w.explosions.schedule(10, () => w.explosions.blast(q[0] + R.range(-70, 70), q[1] + R.range(-40, 40), 2, [1, 0.6, 0.3]));
      w.g.camera.addTrauma(1);
      w.g.renderer.post.flash(0.85, 0.95, 1, 0.75, 0.025);
      w.g.renderer.post.shockwave(q[0], q[1], 0.08, 0.03, 1);
      const mid = this._mw(0, -2780, 0, [0, 0, 0]);
      for (const [lx, ly] of [[-140, -2650], [140, -2650], [-140, -2860], [140, -2860], [0, -3040]]) { const p = this._mw(lx, ly, 0, [0, 0, 0]); this._splash(p[0], p[1], 2.2, true); }
      this._ring(mid[0], mid[1], 80, 4, 1.2, 140);
      this._plates(this._mw(0, -2780, 44, [0, 0, 0]), 24);
      this._shards(q[0], q[1], 30);
      this._iceBurst(mid[0], mid[1], 40, 3);
      if (this.is3D) { const fx = this.view.fx; for (const [lx, ly, sc] of [[0, -2640, 1.8], [-50, -2760, 1.6], [50, -2780, 1.5], [0, -2860, 2], [-70, -2950, 1.2], [70, -2950, 1.2]]) { const p = this._mw(lx, ly, 34, [0, 0, 0]); fx.addFire(p[0], p[1], p[2], sc, 60 * 400); } }
      for (const m of this.mt) if (m.sec === 9 && !m.dead) this.partDestroyed(m.id, true);
      sfx.play('bossDeath', { pan: 0 });
      sfx.play('iceShatter', { pan: 0 });
    }
    if (st > 112) this.wreck = true;
    if (st === 150 && this.view && this.ctrlCam) { this.view.speedTarget = this.view.baseSpeed; this.ctrlCam = false; this.released = true; }
  }

  // ============================================================ render

  renderWorld(view, alpha) {
    if (view !== this.view) return;
    if (this.wreck && this.c.state !== 'dying') {
      // After the kill the rig no longer steps: the wreck stays in the ice until it is far behind.
      const q = this.cam.project(this.X0, this.Y0 - 3030, 0, this.pr);
      if (q[1] > H + 1600) {
        const i = view.extras.indexOf(this);
        if (i >= 0) view.extras.splice(i, 1);
        this._releaseSurface();
        return;
      }
      this._visible();
    }
    const R = tankRenderer(view.wgl, view.qname);
    R.ensure('wb', buildWhiteoutBreaker);
    const cam = view.cam, M = this.M;
    this._pose(this.c.e.alive ? alpha : 1);
    const sd = view.light.sunDir, hz = Math.hypot(sd[0], sd[1]) || 1;
    const el = Math.max(Math.asin(Math.min(1, sd[2])), 0.7), ce = Math.cos(el), se = Math.sin(el);
    const light = { dir: [sd[0] / hz * ce, sd[1] / hz * ce, se], col: view.light.sunCol, amb: view.light.ambient };
    const A = view.atmo, z0 = view.floorZ || 0, t = this.t;
    R.begin(cam, A, light, LOOK);
    const pl = this._pointLight();
    if (pl) R.pointLight(pl[0], pl[1], pl[2]);
    const fl = this.flash * 0.06, snow = 0.14;
    const items = [];
    for (let k = 0; k < 10; k++) {
      if (!this._secVisible(k)) continue;
      const dead = this.secDead[k], act = k === this.sec && this.c.state === 'fight';
      const dmg = dead ? 0.85 : act ? (1 - this._secFrac()) * 0.55 : 0;
      R.draw(`wb.sec${k}`, M.hull, { flash: act ? fl : 0, damage: dmg, heat: dead ? 0.03 + 0.02 * Math.sin(t * 0.2 + k) : 0, snow });
      items.push([`wb.sec${k}`, M.hull]);
      // Lights: steady, flickering when critical, dark (with a dying flicker) once destroyed.
      const fr = act ? this._secFrac() : 1, crit = act && fr < 0.25;
      const g = dead ? (((t + k * 7) >> 3) % 9 === 0 ? 0.4 : 0.03) : crit ? 0.5 + 0.6 * ((t >> 3) & 1) : this.c.state === 'dying' && k === 9 ? ((t >> 2) & 1) * 1.2 : 1.1;
      R.draw(`wb.lights${k}`, M.hull, { glow: g, snow: 0 });
      R.draw(`wb.ice${k}`, M.hull, { glow: 0, snow: 0.8 });
      if (k === 8) {
        R.draw('wb.glass8', M.hull, { glow: dead ? 0.05 : 0.7, damage: dmg * 0.5, snow: 0 });
        R.draw('wb.radar', M.radar, { damage: dmg, snow: 0.3 });
      }
    }
    // Mounts.
    for (const m of this.mt) {
      if (m.y < this.vis[0] - 40 || m.y > this.vis[1] + 40) continue;
      const Tp = m.T;
      if (m.dead) { R.draw(`wb.${Tp.wreck}`, m.M, { damage: 1, heat: 0.1, snow: 0.1 }); continue; }
      const pe = this.partEnt[`m${m.id}`], pd = pe && pe.alive && pe.maxHp ? 1 - pe.hp / pe.maxHp : 0;
      const hf = m.hit > 0 ? 0.35 : 0;
      const o = { glow: 0.8 + m.heat * 0.6, flash: Math.max(fl, hf), damage: pd * 0.75, snow: 0.12 };
      R.draw(`wb.${Tp.house}`, m.M, o);
      if (m.type === 'tri' || m.type === 'twin' || m.type === 'beam' || m.type === 'rarr') items.push([`wb.${Tp.house}`, m.M]);
      if (Tp.fixed) {
        // Doors: one merged draw while all are shut; per door only while some are moving.
        if (m.doors) {
          let open = false;
          for (let k = 0; k < 16; k++) if (m.doors[k] > 0.01 || m.pdoors[k] > 0.01) { open = true; break; }
          if (!open) R.draw('wb.vlsDoorsClosed', m.M, { damage: pd * 0.5, snow: 0.1 });
          else for (let k = 0; k < 16; k++) R.draw('wb.vlsDoor', m.Md[k], { damage: pd * 0.5, snow: 0.1 });
        }
        continue;
      }
      const bo = { glow: 0.8, damage: pd * 0.4, heat: m.heat * 0.22, snow: 0.05, flash: hf };
      if (Tp.single) {
        R.draw(`wb.${Tp.barrel}`, m.Mc, bo);
        if (Tp.glow) {
          const flick = m.type === 'beam' && m.small && !this.wreck ? (0.6 + 0.4 * Math.sin(t * 0.9) * Math.sin(t * 0.37)) : 1;
          R.draw(`wb.${Tp.glow}`, m.Mc, { glow: (0.25 + m.charge * 2.2) * flick, snow: 0 });
        }
      } else for (let j = 0; j < m.Mb.length; j++) R.draw(`wb.${Tp.barrel}`, m.Mb[j], bo);
    }
    // Rounds in flight, VLS boosters, ice spikes, trapped floes, frost patches, debris.
    const T = M.tmp, T2 = M.tmp2, dm = M.deb;
    for (const sh of this.shells) {
      if (sh.px === undefined) continue;
      const dx = sh.x - sh.px, dy = sh.y - sh.py, dz = sh.z - sh.pz, yaw = Math.atan2(-dx, dy), pitch = Math.atan2(dz, Math.hypot(dx, dy));
      M4.trans(sh.x, sh.y, sh.z, dm); mm(dm, M4.rotZ(yaw, T), dm); mm(dm, M4.rotX(pitch, T), dm);
      if (sh.frost) mm(dm, scaleM(1.1, 1.1, 1.1, T2), dm);
      R.draw(sh.frost ? 'wb.cryoShell' : 'wb.shell', dm, { glow: 1.4, snow: 0 });
    }
    for (const m of this.pops) {
      const k = Math.min(1, m.t / m.T), pitch = Math.PI / 2 - k * 1.1;
      M4.trans(m.x, m.y, m.z, dm); mm(dm, M4.rotZ(Math.atan2(-m.ox, -1), T), dm); mm(dm, M4.rotX(pitch, T), dm);
      R.draw('wb.missile', dm, { glow: 1.2, snow: 0 });
    }
    for (const s of this.spikes) {
      if (s.t <= 0) continue;
      const up = smooth(s.t / 8), down = s.t > s.life - 40 ? smooth((s.life - s.t) / 40) : 1, hgt = s.s * 2.2 * up * down;
      M4.trans(s.x, s.y, s.z + hgt * 0.15, dm); mm(dm, M4.rotZ(s.rot, T), dm); mm(dm, M4.rotX(s.tilt, T), dm); mm(dm, M4.rotY(s.tilt2, T), dm);
      mm(dm, scaleM(s.s * 0.32, s.s * 0.32, hgt, T2), dm);
      R.draw('wb.spike', dm, { glow: 1, snow: 0 });
    }
    for (const p of this.patches) {
      const a = p.t > p.life - 60 ? (p.life - p.t) / 60 : 1;
      M4.trans(p.x, p.y, p.z - (1 - a) * 1.5, dm); mm(dm, M4.rotZ(p.rot, T), dm); mm(dm, scaleM(p.r, p.r * 0.8, 1, T2), dm);
      R.draw('wb.icePatch', dm, { glow: 0.6, snow: 0 });
    }
    for (const p of this.debris) {
      M4.trans(p.x, p.y, p.z, dm);
      mm(dm, M4.rotZ(p.az, T), dm); mm(dm, M4.rotX(p.ax, T), dm); mm(dm, M4.rotY(p.ay, T), dm);
      mm(dm, scaleM(p.sx, p.sy, p.sz, T2), dm);
      R.draw(p.mesh, dm, { damage: 0.6, heat: p.life < 60 ? 0.2 : 0, snow: 0.05 });
    }
    // Shadows on the water and the dark contact region along the hull.
    const low = view.qname === 'low';
    R.beginShadow(cam, LOOK.shadow);
    for (let k = 0; k < 10; k++) {
      if (!this._secVisible(k)) continue;
      const S = WB.sections[k], len = (S.y1 - S.y0) / 2;
      mm(M.hull, mm(M4.trans(0, (S.y0 + S.y1) / 2, 0, T), scaleM(150, len + 4, 1, T2), T2), M.pad);
      R.contact(M.pad, 0.32, [0.3, 0.45], z0 + 0.8);
    }
    const sh = 1.05, se2 = Math.sin(sh), ce2 = Math.cos(sh);
    for (let k = 0; k < (low ? 0 : 1); k++) {
      const j = (k - 0.5) * 0.06, ax = sd[0] / hz, ay = sd[1] / hz, cj = Math.cos(j), sj = Math.sin(j);
      R.shadowPass(items, [(ax * cj - ay * sj) * ce2, (ax * sj + ay * cj) * ce2, se2], z0 + 1 + k * 0.5, 0.22);
    }
    R.end();
  }

  _pointLight() {
    let best = null, bw = 0;
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, wgt = k * (f.kind === 'heavy' ? 2.4 : f.kind === 'launch' ? 1.6 : 0.8);
      if (wgt > bw) { bw = wgt; best = f; }
    }
    if (this.fb && this.fb.phase !== 'cool') {
      const q = this._mzW(this.fb.em, 0, [0, 0, 0]), k = this.fb.phase === 'fire' ? 3 : this.fb.em.charge * 2;
      if (k > bw) return [q, 260, [0.8 * k, 1.6 * k, 2.4 * k]];
    }
    if (!best) return null;
    const col = best.kind === 'cryo' ? [0.6, 1.6, 2.4] : [2.6, 1.4, 0.7];
    return [best.w, best.kind === 'heavy' ? 170 : 90, col.map((v) => v * bw)];
  }

  /** Under entities: telegraphs on the water / ice, muzzle light pools, lane markers, searchlights. */
  renderUnder(b, alpha) {
    if (!this.is3D) return;
    const F = this.w.F, KF = this.c.kit.F, t = this.w.t, cam = this.cam;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const z of this.zones) {
      const q = cam.project(z.x, z.y, z.z, this.pr), r = z.r * q[2], k = z.t / z.life, blink = (t >> 2) & 1 ? 1 : 0.55;
      if (z.kind === 'shell' || z.kind === 'hammer') {
        const big = z.kind === 'hammer' ? 1.25 : 1;
        b.draw(F.glow, q[0], q[1], r * 2 * k, r * 2 * k * 0.9, 0, 1, 0.35, 0.15, 0.25 * blink * big, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1, r * 1.9, t * 0.05, 1.8, 0.4, 0.25, 0.7 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1 * (1 - k), r * 1.9 * (1 - k), 0, 2, 2, 2, 0.5, 1);
        for (let n = 0; n < 4; n++) b.draw(KF.laser, q[0], q[1], r * 1.2, 3, n * Math.PI / 2 + Math.PI / 4 * (z.kind === 'hammer' ? 1 : 0), 2, 0.6, 0.3, 0.6, 1);
      } else if (z.kind === 'frost' || z.kind === 'glacial') {
        b.draw(F.glow, q[0], q[1], r * 2.2, r * 2, 0, 0.3, 0.8, 1.2, 0.16 + 0.2 * k, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1, r * 1.9, -t * 0.04, 0.8, 1.8, 2.4, 0.75 * blink, 1);
        b.draw(F.ring, q[0], q[1], r * 2.1 * (1 - k * 0.9), r * 1.9 * (1 - k * 0.9), 0, 1.6, 2.2, 2.4, 0.55, 1);
        const n = z.kind === 'glacial' ? 12 : 6;
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + t * 0.02; b.draw(KF.laser, q[0] + Math.cos(a) * r * 1.05, q[1] + Math.sin(a) * r * 0.95, r * 0.25, 2.4, a, 1.2, 2, 2.4, 0.7 * blink, 1); }
      } else if (z.kind === 'mine') {
        b.draw(F.ring, q[0], q[1], r * 2, r * 1.8, t * 0.06, 2.4, 1.1, 0.3, 0.7 * blink, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.6, 2.6, t * 0.06, 2.4, 1.2, 0.3, 0.6, 1);
        b.draw(KF.laser, q[0], q[1], r * 1.6, 2.6, t * 0.06 + Math.PI / 2, 2.4, 1.2, 0.3, 0.6, 1);
      }
    }
    // Frozen-corridor lanes: cyan hatched strips with crawling frost markers, flaring before the eruption.
    for (const L of this.lanes) {
      const k = Math.min(1, L.t / L.warn), hot = L.t >= L.warn && L.t < L.warn + L.hot;
      const h = H - L.y0 + 40, cy = L.y0 + h / 2, a = hot ? 0.5 : 0.12 + 0.18 * k * ((t >> 2) & 1 ? 1 : 0.6);
      b.draw(F.white, L.x, cy, L.w, h, 0, 0.35, 0.8, 1.1, a * 0.6, 1);
      for (const s of [-1, 1]) b.draw(KF.laser, L.x + s * L.w / 2, cy, h, 3, Math.PI / 2, 0.8, 1.8, 2.4, 0.4 + 0.5 * k, 1);
      for (let y = L.y0 + ((t * 2) % 40); y < H; y += 40) b.draw(KF.laser, L.x, y, L.w * 0.8, 2, 0.5, 1.2, 2, 2.4, 0.35 * k, 1);
    }
    // Muzzle light on the water.
    for (const f of this.flashes) {
      if (!f.w) continue;
      const k = 1 - f.t / f.life, q = cam.project(f.w[0], f.w[1], 0, this.pr), big = f.kind === 'heavy' ? 2.4 : 1;
      const c = f.kind === 'cryo' ? [0.6, 1.4, 2.4] : [2.4, 1.3, 0.6];
      b.draw(F.glow, q[0], q[1], 90 * big * k * q[2], 60 * big * k * q[2], 0, c[0], c[1], c[2], 0.2 * k, 1);
    }
    // Searchlights from the command tower sweep the lead.
    if (!this.secDead[8] && !this.wreck && this._secVisible(8)) {
      const cone = this.view.fx.F.cone;
      for (let i = 0; i < 2; i++) {
        const sl = WB.searchlights[i], q = this._scr(this.M.hull, sl[0], sl[1], 0).slice();
        const ang = Math.PI / 2 + Math.sin(t * 0.011 + i * 2.1) * 0.9;
        b.draw(cone, q[0] + Math.cos(ang) * 150, q[1] + Math.sin(ang) * 150, 300, 90, ang, 1, 0.97, 0.85, 0.07, 1);
      }
    }
  }

  /** Over entities (under bullets): flashes, aim lines, trails, the frost beam, frost and whiteout overlays. */
  renderOver(b, alpha) {
    if (!this.is3D) return;
    const w = this.w, F = w.F, KF = this.c.kit.F, t = w.t, cam = this.cam;
    if (!(this.wreck && this.c.state !== 'dying')) this._pose(this.c.e.alive ? alpha : 1);
    for (const ln of this.lines) {
      const a = (1 - ln.t / ln.life) * (0.5 + 0.5 * Math.min(1, ln.k)), c = ln.col;
      b.draw(KF.laser, ln.x + Math.cos(ln.ang) * ln.len / 2, ln.y + Math.sin(ln.ang) * ln.len / 2, ln.len, 2 + Math.min(1, ln.k) * 3, ln.ang, c[0], c[1], c[2], a * 0.5, 1);
    }
    // Shell tracers (the rounds themselves are 3D).
    for (const sh of this.shells) {
      const T = sh.trail;
      for (let j = 0; j + 5 < T.length; j += 3) {
        const p0 = cam.project(T[j], T[j + 1], T[j + 2], this.pr).slice(), p1 = cam.project(T[j + 3], T[j + 4], T[j + 5], this.pr), u = j / T.length;
        b.draw(KF.laser, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 1, 2 + u * 3, Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), sh.frost ? 0.8 : 1.0, sh.frost ? 1.1 : 0.9, sh.frost ? 1.3 : 0.85, 0.08 + u * 0.18, 1);
      }
      const q = cam.project(sh.x, sh.y, sh.z, this.pr), hot = sh.frost ? [0.6, 1.6, 2.4] : [2.4, 1.1, 0.4];
      b.draw(F.glow, q[0], q[1], 24 * q[2], 24 * q[2], 0, hot[0], hot[1], hot[2], 0.75, 1);
    }
    for (const m of this.pops) {
      if (m.t < 5) continue;
      const q = cam.project(m.x, m.y, m.z - 7, this.pr), fl = 0.8 + 0.2 * Math.sin(t * 1.7 + m.t);
      b.draw(F.glow, q[0], q[1], 30 * fl * q[2], 30 * fl * q[2], 0, 2.4, 1.3, 0.5, 0.85, 1);
    }
    // Flashes.
    for (const f of this.flashes) {
      const k = 1 - (f.t + alpha) / f.life;
      if (k <= 0) continue;
      const s = f.k || 1, ca = Math.cos(f.ang), sa = Math.sin(f.ang);
      if (f.kind === 'heavy') {
        b.draw(F.glow, f.x, f.y, 70 * s * k, 70 * s * k, 0, 2.4, 1.5, 0.7, 0.95 * k, 1);
        b.draw(KF.laser, f.x + ca * 24 * s, f.y + sa * 24 * s, 60 * s * k, 20 * s * k, f.ang, 2.4, 1.6, 0.8, 0.95 * k, 1);
        b.draw(KF.laser, f.x + ca * 38 * s, f.y + sa * 38 * s, 38 * s * k, 9 * s * k, f.ang, 2.4, 2.2, 1.8, 0.8 * k, 1);
        for (const s2 of [-1, 1]) b.draw(KF.laser, f.x, f.y, 28 * s * k, 7 * k, f.ang + s2 * 1.25, 2.4, 1.2, 0.5, 0.6 * k, 1);
        b.draw(F.ring, f.x + ca * 10, f.y + sa * 10, 58 * s * (1 - k * 0.6), 50 * s * (1 - k * 0.6), 0, 2.2, 1.4, 0.8, 0.45 * k, 1);
      } else if (f.kind === 'med') {
        b.draw(F.glow, f.x, f.y, 32 * s * k, 32 * s * k, 0, 2.4, 1.3, 0.6, 0.85 * k, 1);
        b.draw(KF.laser, f.x + ca * 10, f.y + sa * 10, 26 * s * k, 7 * s * k, f.ang, 2.4, 1.5, 0.8, 0.85 * k, 1);
      } else if (f.kind === 'mg') {
        b.draw(F.glow, f.x, f.y, 16 * k, 16 * k, 0, 2.4, 1.6, 0.8, 0.8 * k, 1);
        b.draw(KF.laser, f.x + ca * 6, f.y + sa * 6, 14 * k, 4 * k, f.ang, 2.4, 1.8, 1, 0.8 * k, 1);
      } else if (f.kind === 'rocket') {
        b.draw(F.glow, f.x, f.y, 34 * s * k, 34 * s * k, 0, 2.4, 1.4, 0.5, 0.85 * k, 1);
        b.draw(KF.laser, f.x - ca * 14, f.y - sa * 14, 30 * s * k, 10 * s * k, f.ang, 2, 1.4, 1, 0.5 * k, 1);
      } else if (f.kind === 'cryo') {
        b.draw(F.glow, f.x, f.y, 44 * s * k, 44 * s * k, 0, 0.7, 1.8, 2.4, 0.9 * k, 1);
        b.draw(KF.laser, f.x + ca * 14, f.y + sa * 14, 40 * s * k, 12 * s * k, f.ang, 1.2, 2.2, 2.4, 0.85 * k, 1);
        b.draw(F.ring, f.x, f.y, 50 * s * (1 - k), 50 * s * (1 - k), 0, 1.2, 2, 2.4, 0.4 * k, 1);
      } else if (f.kind === 'launch') {
        b.draw(F.glow, f.x, f.y, 54 * s * k, 54 * s * k, 0, 2.4, 1.6, 0.8, 0.85 * k, 1);
        b.draw(F.ring, f.x, f.y, 70 * s * (1 - k), 64 * s * (1 - k), 0, 1.6, 1.6, 1.6, 0.4 * k, 1);
      }
    }
    // Rocket / missile trails and bodies.
    for (const m of this.tracked) {
      if (m.kind !== 'rocket' && m.kind !== 'missile') continue;
      const T = m.trail, mis = m.kind === 'missile';
      for (let j = 0; j + 3 < T.length; j += 2) {
        const u = j / T.length, x0 = T[j], y0 = T[j + 1], x1 = T[j + 2], y1 = T[j + 3];
        b.draw(KF.laser, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) + 1, (mis ? 3.2 : 2.2) + u * (mis ? 6.5 : 4), Math.atan2(y1 - y0, x1 - x0), 1.05, 1.0, 1.05, (mis ? 0.08 : 0.06) + u * (mis ? 0.3 : 0.24), 1);
      }
      if (m.alive && m.seen) {
        const cx = Math.cos(m.ang), sy = Math.sin(m.ang), fl = 0.75 + 0.25 * Math.sin(t * 1.9 + m.tag._wb), L = mis ? 1.7 : 1.2;
        b.draw(KF.laser, m.x - cx * 15 * L, m.y - sy * 15 * L, 22 * fl * L, 6.5 * L, m.ang, 2.4, 1.3, 0.55, 0.95, 1);
        b.draw(F.glow, m.x - cx * 11 * L, m.y - sy * 11 * L, 20 * fl * L, 20 * fl * L, 0, 2.4, 1.0, 0.45, 0.75, 1);
        b.draw(F.white, m.x - cx * 2, m.y - sy * 2, 15 * L, 3.8 * L, m.ang, mis ? 0.66 : 0.38, mis ? 0.68 : 0.36, mis ? 0.72 : 0.34, 1, 0);
        b.draw(F.white, m.x + cx * 5 * L, m.y + sy * 5 * L, 3.4 * L, 2.6 * L, m.ang, 1.4, 0.2, 0.15, 1, 0);
        for (const s2 of [-1, 1]) b.draw(F.white, m.x - cx * 8 * L - sy * s2 * 2.8 * L, m.y - sy * 8 * L + cx * s2 * 2.8 * L, 4.4 * L, 1.7, m.ang + s2 * 0.6, 0.3, 0.3, 0.34, 1, 0);
      }
    }
    // Delayed charges: blinking countdown rings round each mine; flak / shard burst marks.
    for (const m of this.tracked) if (m.kind === 'mine' && m.alive && m.seen) { const blink = (t >> 2) & 1 ? 1 : 0.5; b.draw(F.ring, m.x, m.y, 46 - m.life * 0.25, 46 - m.life * 0.25, t * 0.08, 2.4, 0.4, 0.4, 0.6 * blink, 1); }
    for (const mk of this.marks) {
      const k = mk.t / mk.life;
      if (mk.kind === 'reticle') { const a = (1 - k) * ((t >> 2) & 1 ? 1 : 0.55); b.draw(F.ring, mk.x, mk.y, 42 - k * 14, 42 - k * 14, t * 0.05, 2.2, 0.3, 0.8, 0.5 * a, 1); }
      else if (mk.kind === 'flak') { const c = mk.frost ? [0.8, 1.8, 2.4] : [2.4, 1.2, 0.4]; b.draw(F.ring, mk.x, mk.y, 24 * (1 - k) + 6, 24 * (1 - k) + 6, 0, c[0], c[1], c[2], 0.35, 1); }
      else if (mk.kind === 'gather') {
        const x = mk.tx !== undefined ? lerp(mk.x, mk.tx, k) : mk.x, y = mk.ty !== undefined ? lerp(mk.y, mk.ty, k) : mk.y;
        b.draw(F.glow, x, y, 10 * (1 - k) + 4, 10 * (1 - k) + 4, 0, 1, 2, 2.4, 0.8 * (1 - k), 1);
      } else if (mk.kind === 'gap') {
        b.draw(KF.laser, mk.x - mk.w / 2, mk.y, 60, 2.4, Math.PI / 2, 2.4, 0.8, 0.3, 0.35, 1);
        b.draw(KF.laser, mk.x + mk.w / 2, mk.y, 60, 2.4, Math.PI / 2, 2.4, 0.8, 0.3, 0.35, 1);
      }
    }
    // Burning mounts glow over the hull.
    for (const f of this.fires) {
      if (f.x === undefined || f.m.y < this.vis[0] || f.m.y > this.vis[1]) continue;
      const q = cam.project(f.x, f.y, f.z, this.pr), fl = 0.75 + 0.25 * Math.sin(t * 0.5 + f.x);
      b.draw(F.glow, q[0], q[1], 34 * f.s * fl, 30 * f.s * fl, 0, 2, 0.7, 0.2, 0.45, 1);
    }
    // Emitter / projector charge glows.
    for (const m of this.mt) {
      if (m.dead || m.charge < 0.05 || m.y < this.vis[0] || m.y > this.vis[1]) continue;
      const mz = this._mz(m, 0, this._cg || (this._cg = {})), k = m.charge, big = m.type === 'beam' ? (m.small ? 1.3 : 2) : m.type === 'aux' ? 0.7 : 1;
      const fl = 0.85 + 0.15 * Math.sin(t * 0.7 + m.id);
      b.draw(F.glow, mz.x, mz.y, 60 * big * k * fl, 60 * big * k * fl, 0, 0.7, 1.7, 2.4, 0.8 * k, 1);
      b.draw(F.glow, mz.x, mz.y, 22 * big * k, 22 * big * k, 0, 2.2, 2.3, 2.4, 0.95 * k, 1);
      if (m.type === 'beam') b.draw(F.ring, mz.x, mz.y, 90 * big * (1 - (t % 30) / 30) * k, 90 * big * (1 - (t % 30) / 30) * k, 0, 0.8, 1.8, 2.4, 0.4 * k, 1);
    }
    this._renderGlows(b, F, t);
    this._renderBeam(b, F, KF, t);
    this._renderWeather(b, F, KF, t);
  }

  /**
   * Bloom on the hull's warning lights and lit gun ports (WB.glows): steady with a
   * twinkle; flickering on a critical section or the dying final arsenal; dark once
   * a section is destroyed.
   */
  _renderGlows(b, F, t) {
    const Hm = this.M.hull;
    for (let k = 0; k < 10; k++) {
      if (!this._secVisible(k) || this.secDead[k]) continue;
      const act = k === this.sec && this.c.state === 'fight', crit = act && this._secFrac() < 0.25, dying = this.c.state === 'dying' && k === 9;
      const L = WB.glows[k];
      for (let i = 0; i < L.length; i++) {
        const g = L[i];
        if (g[1] < this.vis[0] || g[1] > this.vis[1]) continue;
        let a = g[3] === 0 ? 0.6 : 0.42;
        if (crit) a *= ((t + i * 3) >> 3) & 1 ? 1 : 0.12;
        else if (dying) a *= ((t + i) >> 2) & 1 ? 1 : 0.08;
        else a *= 0.8 + 0.2 * Math.sin(t * 0.08 + i * 1.7);
        const q = this._scr(Hm, g[0], g[1], g[2]);
        if (q[1] < -20 || q[1] > H + 20) continue;
        const s = (g[3] === 0 ? 15 : 11) * q[2];
        if (g[3] === 0) b.draw(F.glow, q[0], q[1], s, s, 0, 2.4, 0.22, 0.18, a, 1);
        else b.draw(F.glow, q[0], q[1], s * 0.8, s * 1.3, 0, 2.4, 1.25, 0.4, a, 1);
      }
    }
  }

  /** The frost beam: telegraph wedge while charging, then the sweeping beam (core = hitbox). */
  _renderBeam(b, F, KF, t) {
    const f = this.fb;
    if (!f) return;
    const o = this._beamOrigin(f), len = 1100;
    if (f.phase === 'charge') {
      // The exact sector the beam will sweep (plus its half-width), filled and pulsing;
      // a countdown ring closes on the head; chevrons show the sweep direction.
      const k = Math.min(1, f.t / f.chargeT);
      this._wedge(b, F, KF, o, f.a0, f.a1, f.width, 0.35 + 0.65 * k, t, true);
      b.draw(F.ring, o.x, o.y, 140 * (1 - k) + 24, 140 * (1 - k) + 24, 0, 0.8, 1.8, 2.4, 0.7, 1);
      return;
    }
    if (f.phase !== 'fire') return;
    // The part of the sector still to be swept stays marked.
    this._wedge(b, F, KF, o, f.ang, f.a1, f.width, 0.45, t, false);
    const ft = f.t, ramp = Math.min(1, ft / 5, (f.fireT - ft) / 8 + 0.2), wv = f.width * ramp * (0.94 + 0.06 * Math.sin(t * 1.7));
    const a = f.ang, mx = o.x + Math.cos(a) * len / 2, my = o.y + Math.sin(a) * len / 2;
    b.draw(KF.laser, mx, my, len, wv * 3.4, a, 0.35, 0.8, 1.4, 0.14, 1);      // outer haze
    b.draw(KF.laser, mx, my, len, wv * 1.8, a, 0.7, 1.6, 2.4, 0.5, 1);        // cyan glow
    b.draw(KF.laser, mx, my, len, wv, a, 2.4, 2.4, 2.4, 1, 1);                 // white core (= the hitbox width)
    b.draw(F.glow, o.x, o.y, wv * 3.2, wv * 3.2, 0, 0.8, 1.8, 2.4, 0.9, 1);
    b.draw(F.glow, o.x, o.y, wv * 2, wv * 2, 0, 2.4, 2.4, 2.4, 1, 1);
    // Ice crystals streaming along the beam and frost ejecta off its edges.
    for (let i = 0; i < 26; i++) {
      const h1 = Math.sin((i + 1) * 91.7) * 43758.5, u = ((h1 - Math.floor(h1)) + t * 0.025) % 1, d = u * len, side = (i & 1 ? 1 : -1) * wv * (0.4 + 0.5 * ((i * 7) % 5) / 5);
      const x = o.x + Math.cos(a) * d - Math.sin(a) * side, y = o.y + Math.sin(a) * d + Math.cos(a) * side;
      b.draw(F.glow, x, y, 6, 6, 0, 1.6, 2.2, 2.4, 0.7, 1);
    }
  }

  /**
   * Danger sector from origin o between screen angles a0 → a1, widened by the beam's
   * half-width: strips across the bisector fill it, bands crawl outward, the edges burn
   * bright; `chev` adds chevrons pointing along the sweep.
   */
  _wedge(b, F, KF, o, a0, a1, width, k, t, chev) {
    const span = a1 - a0, mid = (a0 + a1) / 2, half = Math.abs(span) / 2, blink = (t >> 2) & 1 ? 1 : 0.7;
    const ca = Math.cos(mid), sa = Math.sin(mid);
    for (let r = 40; r < 980; r += 34) {
      const chord = 2 * r * Math.tan(Math.min(1.35, half)) + width, crawl = ((r / 34 - t * 0.12) % 4 + 4) % 4 < 1 ? 1.8 : 1;
      b.draw(F.white, o.x + ca * r, o.y + sa * r, 32, chord, mid, 0.35, 0.75, 1.15, 0.075 * k * crawl * blink, 1);
    }
    for (const [a, s] of [[a0, -1], [a1, 1]]) {
      const e = a + s * Math.sign(span || 1) * Math.atan2(width * 0.5, 300);
      b.draw(KF.laser, o.x + Math.cos(e) * 490, o.y + Math.sin(e) * 490, 980, 3 + 3 * k, e, 0.9, 1.9, 2.4, 0.75 * k * blink, 1);
    }
    if (!chev) return;
    const dir = Math.sign(span || 1);
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.012 + i / 4) % 1), a = a0 + span * u, r = 170 + i * 70;
      const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r, tang = a + dir * Math.PI / 2;
      for (const s of [-1, 1]) b.draw(KF.laser, x - Math.cos(tang) * 6 + Math.cos(tang + s * 2.3) * 8, y - Math.sin(tang) * 6 + Math.sin(tang + s * 2.3) * 8, 18, 3.5, tang + s * 2.3, 2.4, 2.4, 2.4, 0.7 * k, 1);
    }
  }

  /** Frost vignette (cryo / beam sections), whiteout gusts, wind-driven snow, polar mist. */
  _renderWeather(b, F, KF, t) {
    const cold = this.cold + this.coldT;
    if (cold > 0.02) {
      for (const [x, y, wd, h] of [[-20, H / 2, 160, H * 1.3], [W + 20, H / 2, 160, H * 1.3], [W / 2, -30, W * 1.4, 150], [W / 2, H + 30, W * 1.4, 130]]) b.draw(F.glow, x, y, wd, h, 0, 0.75, 0.9, 1.1, 0.16 * cold, 1);
    }
    // Wind-driven snow: denser in the later sections and in a gust.
    const n = Math.round(40 + 50 * Math.min(1, cold) + 120 * this.gust), dir = this.gust > 0.05 ? this.gustDir : 1;
    const sl = 0.3 + this.gust * 1.1;
    for (let k = 0; k < n; k++) {
      const h1 = Math.sin(k * 12.9898) * 43758.5453, h2 = Math.sin(k * 78.233) * 12543.123;
      const fx = h1 - Math.floor(h1), fy = h2 - Math.floor(h2), sp = 2 + fx * 3 + this.gust * 8;
      const x = (((fx * (W + 120) + dir * t * sp * sl) % (W + 120)) + (W + 120)) % (W + 120) - 60, y = ((fy * (H + 80) + t * sp) % (H + 80)) - 40;
      const s = 1.6 + fy * 2.6;
      if (this.gust > 0.2 && k % 3 === 0) b.draw(KF.laser, x, y, 10 + 30 * this.gust, 1.6, dir * (Math.PI / 2 - Math.atan2(1, sl)), 1, 1.05, 1.15, 0.22 * this.gust, 1);
      else b.draw(F.glow, x, y, s * 2, s * 2, 0, 1.2, 1.25, 1.35, 0.4, 1);
    }
    // Whiteout gust: sheets of blown spray across the arena.
    if (this.gust > 0.02) {
      for (let k = 0; k < 7; k++) {
        const y = ((k * 97 + t * 1.3) % (H + 200)) - 100, x = ((dir * t * 9 + k * 211) % (W + 400) + (W + 400)) % (W + 400) - 200;
        b.draw(F.glow, x, y, 380, 120, 0.15 * dir, 0.9, 0.95, 1.05, 0.12 * this.gust, 0);
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

/** Distance from point (px, py) to segment a→b. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}

export { FOCUS };
