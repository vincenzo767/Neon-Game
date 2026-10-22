import { FLAME_FRAMES } from './fxAtlas.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';

// World-anchored effects for an ArenaWorld. Everything lives in WORLD
// coordinates and is projected through the arena camera when drawn, so smoke
// rises from the wreck it belongs to, drifts on the arena wind and scrolls
// away with the ground; craters and tread marks stay where they were made.
//
// Sources
//   anchors   from chunk data: fire, smoke, steam, lamp, beacon, spark,
//             glow, searchlight, vent (bubbles), dust
//   impacts   gameplay events (artillery, blasts, boss death) → decal + debris
//   trails    moving bosses → tread marks / wakes
//
// Budgets scale with the quality preset; nothing allocates per frame once
// the pools exist. Cosmetic only (own RNG stream), never touches gameplay.

const MAX_P = { low: 320, medium: 560, high: 820 };
const MAX_DECALS = 160;
// Smoke fill budget, in screens of overdraw per frame. Tall burning skylines
// put rooftop plumes close to the camera, where each puff can cover half the
// screen; past the budget the largest puffs are thinned (stable per-particle
// order, smoothed, soft edge) so the plume keeps its shape instead of
// flooding the half-float target.
const FILL_BUDGET = { low: 8, medium: 14, high: 22 };
const MAX_PUFF = 230;  // projected puff size cap (world units)
const BIG = 48;        // puffs smaller than this are never thinned
const pmod = (a, n) => ((a % n) + n) % n;

class Pool {
  constructor(n) {
    const F = Float32Array;
    this.n = n; this.count = 0; this.seq = 0;
    for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 's0', 's1', 'r', 'g', 'b', 'r1', 'g1', 'b1', 'a', 'add', 'rot', 'vr', 'drag', 'grav', 'fade', 'h']) this[k] = new F(n);
    this.f = new Array(n);
  }

  spawn(f, x, y, z, vx, vy, vz, life) {
    if (this.count >= this.n) return -1;
    const i = this.count++;
    this.f[i] = f; this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = this.s1[i] = 10; this.r[i] = this.g[i] = this.b[i] = 1;
    this.r1[i] = this.g1[i] = this.b1[i] = 1; this.a[i] = 1; this.add[i] = 0; this.rot[i] = 0; this.vr[i] = 0;
    this.drag[i] = 1; this.grav[i] = 0; this.fade[i] = 0;
    this.h[i] = (this.seq++ * 0.6180339887) % 1; // stable thinning order
    return i;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 's0', 's1', 'r', 'g', 'b', 'r1', 'g1', 'b1', 'a', 'add', 'rot', 'vr', 'drag', 'grav', 'fade', 'h']) this[k][i] = this[k][j];
    this.f[i] = this.f[j];
  }
}

export class WorldFX {
  constructor(world, F, quality = 'high') {
    this.W = world;              // ArenaWorld (camera, wind, surfaces)
    this.F = F;                  // fxAtlas frames
    this.R = world.R;
    this.p = new Pool(MAX_P[quality] || MAX_P.high);
    this.decals = [];
    this.t = 0;
    this.tmp = [0, 0, 0, 0];
    this.q = quality;
    this.budget = (FILL_BUDGET[quality] || FILL_BUDGET.high) * WORLD_W * WORLD_H;
    this.keep = 1;
    const n = this.p.n;
    this.vis = { i: new Int32Array(n), x: new Float32Array(n), y: new Float32Array(n), s: new Float32Array(n), a: new Float32Array(n) };
  }

  // ------------------------------------------------------------ spawning

  _smoke(x, y, z, s, dark, rise = 1) {
    const R = this.R, P = this.p, w = this.W.wind;
    const i = P.spawn(R.pick(this.F.smoke), x + R.range(-4, 4) * s, y + R.range(-4, 4) * s, z, w[0] * 0.3 + R.range(-0.15, 0.15), w[1] * 0.3 + R.range(-0.15, 0.15), R.range(0.5, 0.9) * rise, R.range(150, 230));
    if (i < 0) return;
    // Dense and dark at the source, thinning to a lighter, sunlit grey as it climbs.
    const c = 0.36 - dark * 0.3, c1 = 0.5 - dark * 0.18;
    P.s0[i] = 12 * s; P.s1[i] = 78 * s;
    P.r[i] = c * 1.06; P.g[i] = c; P.b[i] = c * 0.96; P.r1[i] = c1 * 1.04; P.g1[i] = c1; P.b1[i] = c1 * 0.98;
    P.a[i] = 0.42 + dark * 0.22; P.rot[i] = R.angle(); P.vr[i] = R.range(-0.006, 0.006); P.drag[i] = 0.995; P.fade[i] = 1;
  }

  _ember(x, y, z, s = 1) {
    const R = this.R, P = this.p, w = this.W.wind;
    const i = P.spawn(this.F.ember, x, y, z, w[0] * 0.5 + R.range(-0.4, 0.4), w[1] * 0.5 + R.range(-0.4, 0.4), R.range(0.8, 2.2), R.range(40, 90));
    if (i < 0) return;
    P.s0[i] = 2.4 * s; P.s1[i] = 1.2 * s; P.r[i] = 2.2; P.g[i] = 1.1; P.b[i] = 0.3; P.r1[i] = 1.4; P.g1[i] = 0.3; P.b1[i] = 0.05;
    P.add[i] = 1; P.drag[i] = 0.985; P.fade[i] = 2;
  }

  _spark(x, y, z, n = 8) {
    const R = this.R, P = this.p;
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(0.8, 2.6);
      const i = P.spawn(this.F.spark, x, y, z, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.5, 2.5), R.range(18, 40));
      if (i < 0) return;
      P.s0[i] = 4; P.s1[i] = 2; P.r[i] = 2.4; P.g[i] = 2.1; P.b[i] = 1.4; P.r1[i] = 1.6; P.g1[i] = 0.6; P.b1[i] = 0.1;
      P.add[i] = 1; P.grav[i] = -0.09; P.drag[i] = 0.97; P.rot[i] = a;
    }
  }

  _steam(x, y, z, s) {
    const R = this.R, P = this.p, w = this.W.wind;
    const i = P.spawn(R.pick(this.F.smoke), x, y, z, w[0] * 0.4 + R.range(-0.2, 0.2), w[1] * 0.4 + R.range(-0.2, 0.2), R.range(0.6, 1.1), R.range(70, 110));
    if (i < 0) return;
    P.s0[i] = 8 * s; P.s1[i] = 40 * s; P.r[i] = P.g[i] = P.b[i] = 0.9; P.r1[i] = P.g1[i] = P.b1[i] = 1; P.a[i] = 0.35; P.fade[i] = 1; P.rot[i] = R.angle();
  }

  /** Churned foam left behind a moving hull. */
  _wake(x, y, b, sp) {
    const R = this.R, P = this.p;
    // Two arms of the Kelvin wake spreading outward + churned water down the middle.
    for (const side of [-1, 0, 1]) {
      if (side === 0 && R.chance(0.5)) continue;
      const i = P.spawn(this.F.foam, x + side * b * 0.35 + R.range(-2, 2), y + R.range(-3, 3), 0.8, side * (0.12 + sp * 0.18) + R.range(-0.05, 0.05), R.range(-0.05, 0.05), 0, R.range(110, 150));
      if (i < 0) return;
      P.s0[i] = b * (side ? 0.32 : 0.55); P.s1[i] = b * (side ? 0.9 : 1.5);
      P.r[i] = P.g[i] = P.b[i] = 0.92; P.r1[i] = 0.7; P.g1[i] = 0.82; P.b1[i] = 0.86;
      P.a[i] = side ? 0.32 : 0.24; P.rot[i] = R.angle(); P.vr[i] = R.range(-0.004, 0.004); P.drag[i] = 0.995; P.fade[i] = 0;
    }
  }

  /** Bow wave spray. */
  _bow(x, y, b) {
    const R = this.R, P = this.p;
    const i = P.spawn(this.F.foam, x + R.range(-0.3, 0.3) * b, y, 1, R.range(-0.6, 0.6), R.range(-0.2, 0.2), 0, 40);
    if (i < 0) return;
    P.s0[i] = b * 0.5; P.s1[i] = b * 1.2; P.r[i] = P.g[i] = P.b[i] = 1; P.a[i] = 0.6; P.rot[i] = R.angle(); P.drag[i] = 0.96;
  }

  /** Dust / debris kicked up (impacts, collapses). */
  dust(x, y, z, s = 1, col = [0.5, 0.45, 0.38], n = 8) {
    const R = this.R, P = this.p;
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(0.2, 1.2) * s;
      const i = P.spawn(R.pick(this.F.dust), x, y, z + 2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.7), R.range(80, 140));
      if (i < 0) return;
      P.s0[i] = 12 * s; P.s1[i] = 50 * s; P.r[i] = col[0]; P.g[i] = col[1]; P.b[i] = col[2]; P.r1[i] = col[0] * 1.1; P.g1[i] = col[1] * 1.1; P.b1[i] = col[2] * 1.1;
      P.a[i] = 0.6; P.drag[i] = 0.97; P.fade[i] = 1; P.rot[i] = R.angle();
    }
    for (let k = 0; k < n; k++) {
      const a = R.angle(), sp = R.range(1, 3) * s;
      const i = P.spawn(this.F.chunk, x, y, z + 2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.5, 4), R.range(40, 70));
      if (i < 0) return;
      P.s0[i] = P.s1[i] = R.range(2, 4.5); P.r[i] = P.r1[i] = col[0] * 0.7; P.g[i] = P.g1[i] = col[1] * 0.7; P.b[i] = P.b1[i] = col[2] * 0.7;
      P.grav[i] = -0.12; P.vr[i] = R.range(-0.2, 0.2); P.drag[i] = 0.99;
    }
  }

  // ------------------------------------------------------------ decals

  /** Ground decal at world (x, y, z). kind: 'crater' | 'scorch' | 'tread' | 'foam' | 'track' */
  decal(kind, x, y, z, size, rot = 0, life = 1800) {
    if (this.decals.length >= MAX_DECALS) this.decals.shift();
    this.decals.push({ kind, x, y, z, size, rot, life, max: life });
  }

  /** Gameplay impact at a SCREEN point (480×640 units): crater + dust + debris. */
  impact(sx, sy, r = 30, o = {}) {
    const p = this.W.groundAt(sx, sy);
    if (!p) return null;
    const water = p.water;
    if (water) {
      this.decal('foam', p[0], p[1], p[2] + 0.5, r * 2.2, 0, 160);
      this._splash(p[0], p[1], p[2], r / 30);
      return p;
    }
    this.decal(o.crater === false ? 'scorch' : 'crater', p[0], p[1], p[2] + 0.4, r * (o.crater === false ? 2.4 : 1.6), this.R.angle(), o.life || 2400);
    this.dust(p[0], p[1], p[2], r / 30, this.W.dustCol, 7);
    if (o.fire) this.addFire(p[0], p[1], p[2] + 1, o.fire, 600);
    return p;
  }

  _splash(x, y, z, s) {
    const R = this.R, P = this.p;
    for (let k = 0; k < 14; k++) {
      const a = R.angle(), sp = R.range(0.5, 1.6) * s;
      const i = P.spawn(this.F.flake, x, y, z, Math.cos(a) * sp, Math.sin(a) * sp, R.range(2, 4.5) * s, R.range(30, 50));
      if (i < 0) return;
      P.s0[i] = 6 * s; P.s1[i] = 3 * s; P.r[i] = P.g[i] = P.b[i] = 0.95; P.r1[i] = 0.8; P.g1[i] = 0.9; P.b1[i] = 1; P.grav[i] = -0.12; P.a[i] = 0.8;
    }
    const i = P.spawn(this.F.ring, x, y, z + 0.5, 0, 0, 0, 40);
    if (i >= 0) { P.s0[i] = 10 * s; P.s1[i] = 70 * s; P.a[i] = 0.6; P.r[i] = P.g[i] = P.b[i] = 0.95; }
  }

  /** Temporary fire (impact aftermath, boss wreck). */
  addFire(x, y, z, s = 1, life = 900) {
    this.W.dynAnchors.push({ type: 'fire', x, y, z, s, life });
  }

  /** Trail stamp at a SCREEN point: tread marks on ground, foam on water. */
  trail(sx, sy, width, rot = 0) {
    const p = this.W.groundAt(sx, sy);
    if (!p) return;
    if (p.water) this.decal('foam', p[0], p[1], p[2] + 0.5, width, rot, 220);
    else this.decal('track', p[0], p[1], p[2] + 0.3, width, rot, 1500);
  }

  // ------------------------------------------------------------ update

  update(anchors) {
    this.t++;
    const R = this.R, cam = this.W.cam, q = this.q === 'low' ? 0.5 : this.q === 'medium' ? 0.75 : 1;
    const pr = this.tmp;
    // Anchors: emit only when on screen (or just above it, so smoke is already rising when it scrolls in).
    for (const a of anchors) {
      cam.project(a.x, a.y, a.z, pr);
      if (pr[3] < cam.near || pr[0] < -120 || pr[0] > WORLD_W + 120 || pr[1] < -260 || pr[1] > WORLD_H + 140) continue;
      switch (a.type) {
        case 'fire':
          if (R.chance(0.15 * a.s * q)) this._smoke(a.x, a.y, a.z + 4, a.s, 0.85);
          if (R.chance(0.12 * a.s * q)) this._ember(a.x + R.range(-6, 6) * a.s, a.y + R.range(-6, 6) * a.s, a.z + 2, a.s);
          break;
        case 'smoke':
          if (R.chance(0.11 * a.s * q)) this._smoke(a.x, a.y, a.z, a.s, a.dark ?? 0.7);
          break;
        case 'steam':
          if (R.chance(0.2 * q)) this._steam(a.x, a.y, a.z, a.s || 1);
          break;
        case 'spark':
          if (R.chance(0.012)) this._spark(a.x, a.y, a.z, R.int(6, 14));
          break;
        case 'dust':
          if (R.chance(0.03 * q)) this.dust(a.x, a.y, a.z, a.s || 1, this.W.dustCol, 2);
          break;
        case 'lightning':
          if (!a.bolt && R.chance(a.rate || 0.002)) {
            a.bolt = 14; a.seed = R.next();
            const post = this.W.g.renderer.post;
            post.flash(0.75, 0.8, 1, 0.16, 0.05);
            this.W.cloudFlash(a.x, a.y, 260 * a.s);
            this.W.g.camera.addTrauma(0.04);
          }
          if (a.bolt) a.bolt--;
          break;
        case 'bubbles':
          if (R.chance(0.25 * q)) {
            const i = this.p.spawn(this.F.ring, a.x + R.range(-6, 6), a.y + R.range(-6, 6), a.z, R.range(-0.1, 0.1), R.range(-0.1, 0.1), R.range(0.8, 1.6), R.range(90, 160));
            if (i >= 0) { const P2 = this.p, k = R.range(2, 5) * (a.s || 1); P2.s0[i] = k; P2.s1[i] = k * 1.4; P2.r[i] = P2.r1[i] = 0.7; P2.g[i] = P2.g1[i] = 0.9; P2.b[i] = P2.b1[i] = 1; P2.a[i] = 0.5; P2.add[i] = 1; P2.drag[i] = 0.995; }
          }
          break;
        case 'rockfall':
          // Chunks drop from the cave-in and kick up dust where they land.
          if (R.chance(0.03 * (a.s || 1))) {
            const i = this.p.spawn(this.F.chunk, a.x + R.range(-30, 30), a.y + R.range(-30, 30), a.z, R.range(-0.3, 0.3), R.range(-0.3, 0.3), 0, 160);
            if (i >= 0) { const P2 = this.p, k = R.range(3, 7); P2.s0[i] = P2.s1[i] = k; P2.r[i] = P2.r1[i] = 0.42; P2.g[i] = P2.g1[i] = 0.39; P2.b[i] = P2.b1[i] = 0.35; P2.grav[i] = -0.14; P2.vr[i] = R.range(-0.15, 0.15); P2.drag[i] = 1; P2.fade[i] = 3; }
          }
          break;
        default: break;
      }
    }
    // Movers: wakes behind ships, funnel smoke.
    for (const m of this.W.movers) {
      const [ox, oy] = this.W.moverOffset(m);
      const x = m.x + ox, y = m.y + oy;
      cam.project(x, y, 0, pr);
      if (pr[1] < -200 || pr[1] > WORLD_H + 200) continue;
      if (m.kind === 'ship') {
        const fx = -Math.sin(m.rot), fy = Math.cos(m.rot);
        if (this.t % 5 === 0) this._wake(x - fx * m.l * 0.5, y - fy * m.l * 0.5, m.b, Math.abs(m.vy) + Math.abs(m.vx));
        if (this.t % 5 === 0) this._bow(x + fx * m.l * 0.45, y + fy * m.l * 0.45, m.b);
        if (this.t % 6 === 0) for (const s of m.stacks || []) this._smoke(s[0] + ox, s[1] + oy, s[2], 0.7, m.burning ? 0.85 : 0.5);
      }
    }
    // Dynamic anchors (temporary fires) age out.
    const dyn = this.W.dynAnchors;
    for (let i = dyn.length - 1; i >= 0; i--) if (--dyn[i].life <= 0) dyn.splice(i, 1);
    // Particles.
    const P = this.p, w = this.W.wind;
    let i = 0;
    while (i < P.count) {
      if (--P.life[i] <= 0) { P.kill(i); continue; }
      const d = P.drag[i];
      P.vx[i] = P.vx[i] * d + w[0] * 0.004; P.vy[i] = P.vy[i] * d + w[1] * 0.004; P.vz[i] = P.vz[i] * d + P.grav[i];
      P.x[i] += P.vx[i]; P.y[i] += P.vy[i]; P.z[i] += P.vz[i];
      if (P.grav[i] < 0 && P.z[i] < this.W.floorZ) {
        if (P.fade[i] === 3 && P.vz[i] < -2) { this.dust(P.x[i], P.y[i], this.W.floorZ, 0.6, this.W.dustCol, 2); P.life[i] = Math.min(P.life[i], 40); }
        P.z[i] = this.W.floorZ; P.vz[i] *= -0.25; P.vx[i] *= 0.6; P.vy[i] *= 0.6;
      }
      P.rot[i] += P.vr[i];
      i++;
    }
    for (let k = this.decals.length - 1; k >= 0; k--) {
      const dc = this.decals[k];
      if (--dc.life <= 0 || dc.y < cam.y - 900 || dc.y > cam.y + 3000) this.decals.splice(k, 1);
    }
  }

  // ------------------------------------------------------------ render

  /** Ground decals + anchored lights/flames: drawn right after the world pass. */
  renderGround(b, anchors) {
    const cam = this.W.cam, F = this.F, pr = this.tmp, t = this.t;
    for (const dc of this.decals) {
      cam.project(dc.x, dc.y, dc.z, pr);
      if (pr[1] < -100 || pr[1] > WORLD_H + 100) continue;
      const k = pr[2], fade = Math.min(1, dc.life / 120);
      const sz = dc.size * k;
      switch (dc.kind) {
        case 'crater':
          b.draw(F.pool, pr[0], pr[1], sz * 1.9, sz * 1.7, dc.rot, 0, 0, 0, 0.7 * fade, 0);
          b.draw(F.pool, pr[0], pr[1], sz, sz * 0.9, dc.rot, 0, 0, 0, 0.9 * fade, 0);
          b.draw(F.ring, pr[0] - sz * 0.05, pr[1] - sz * 0.05, sz * 1.05, sz * 0.95, 0, 0.5, 0.47, 0.42, 0.35 * fade, 0);
          if (dc.max - dc.life < 200) b.draw(F.glow, pr[0], pr[1], sz * 1.4, sz * 1.4, 0, 1.6, 0.6, 0.15, 0.6 * (1 - (dc.max - dc.life) / 200), 1);
          break;
        case 'scorch':
          b.draw(F.pool, pr[0], pr[1], sz, sz * 0.9, dc.rot, 0, 0, 0, 0.6 * fade, 0);
          break;
        case 'track':
          b.draw(F.white, pr[0], pr[1], sz * 0.22, sz * 0.12, dc.rot, 0.03, 0.03, 0.03, 0.35 * fade, 0);
          break;
        case 'foam':
          b.draw(F.foam, pr[0], pr[1], sz, sz * 0.9, dc.rot + t * 0.002, 0.9, 0.95, 1, 0.55 * fade, 0);
          break;
        default: break;
      }
    }
    // Headlights / tail lights of moving traffic at night.
    for (const m of this.W.movers) {
      if (!m.lights) continue;
      const [ox, oy] = this.W.moverOffset(m);
      const fx = -Math.sin(m.rot), fy = Math.cos(m.rot);
      cam.project(m.x + ox + fx * (m.l * 0.5 + 14), m.y + oy + fy * (m.l * 0.5 + 14), this.W.floorZ + 1, pr);
      if (pr[1] < -60 || pr[1] > WORLD_H + 60 || pr[0] < -60 || pr[0] > WORLD_W + 60) continue;
      b.draw(F.pool, pr[0], pr[1], 22 * pr[2], 30 * pr[2], m.rot, 1, 0.92, 0.75, 0.22, 1);
      cam.project(m.x + ox - fx * m.l * 0.5, m.y + oy - fy * m.l * 0.5, this.W.floorZ + 4, pr);
      b.draw(F.pool, pr[0], pr[1], 10 * pr[2], 8 * pr[2], 0, 1, 0.1, 0.05, 0.35, 1);
    }
    const all = this.W.dynAnchors.length ? anchors.concat(this.W.dynAnchors) : anchors;
    for (const a of all) {
      cam.project(a.x, a.y, a.z, pr);
      if (pr[3] < cam.near || pr[0] < -100 || pr[0] > WORLD_W + 100 || pr[1] < -100 || pr[1] > WORLD_H + 100) continue;
      const k = pr[2];
      switch (a.type) {
        case 'fire': {
          const s = a.s * k, fl = 0.78 + 0.22 * Math.sin(t * 0.37 + a.x) * Math.sin(t * 0.23 + a.y);
          const wx = this.W.wind[0], wy = -this.W.wind[1];
          b.draw(F.pool, pr[0], pr[1], 130 * s, 120 * s, 0, 1.25, 0.42, 0.1, 0.3 * fl, 1);          // light thrown around
          b.draw(F.pool, pr[0], pr[1], 46 * s, 42 * s, 0, 0, 0, 0, 0.35, 0);                      // charred base
          const ph = Math.round(a.x * 7 + a.y * 3);
          // Flames: a broad base, tongues licking downwind, a white-hot core.
          b.draw(F.flames[pmod((t >> 2) + ph, FLAME_FRAMES)], pr[0], pr[1], 44 * s * fl, 40 * s * fl, (a.x * 0.37) % 6.28, 1.5, 1.05, 0.7, 0.95, 1);
          b.draw(F.flames[pmod((t >> 2) + ph + 3, FLAME_FRAMES)], pr[0] + wx * 7 * s, pr[1] + wy * 7 * s, 34 * s, 30 * s, t * 0.013 + ph, 1.3, 0.75, 0.4, 0.85, 1);
          b.draw(F.flames[pmod((t >> 3) + ph + 5, FLAME_FRAMES)], pr[0] + wx * 13 * s, pr[1] + wy * 13 * s, 24 * s, 22 * s, -t * 0.017, 1.1, 0.5, 0.2, 0.7, 1);
          b.draw(F.glow, pr[0], pr[1], 26 * s * fl, 24 * s * fl, 0, 1.5, 0.95, 0.5, 0.42, 1);
          break;
        }
        case 'lamp': {
          // Strip-light fixture + soft pool: never a round bright dot (bullets are round dots).
          b.draw(F.pool, pr[0], pr[1] + 3 * k, 34 * k, 26 * k, 0, a.c[0], a.c[1], a.c[2], 0.09, 1);
          b.draw(F.white, pr[0], pr[1], (a.len || 9) * k, 1.6 * k, a.rot || 0, a.c[0] * 1.3, a.c[1] * 1.3, a.c[2] * 1.3, 0.55, 1);
          break;
        }
        case 'glow':
          b.draw(F.pool, pr[0], pr[1], a.r * 2 * k, a.r * 1.8 * k, 0, a.c[0], a.c[1], a.c[2], (a.a ?? 0.4) * (a.flicker ? 0.75 + 0.25 * Math.sin(t * 0.2 + a.x) : 1), 1);
          break;
        case 'beacon':
          // Short soft blink with a halo, dimmer than any bullet.
          if ((t + Math.round(a.x * 3)) % (a.period || 80) < 8) { b.draw(F.pool, pr[0], pr[1], 26 * k, 26 * k, 0, a.c[0], a.c[1], a.c[2], 0.35, 1); b.draw(F.glow, pr[0], pr[1], 5 * k, 5 * k, 0, a.c[0] * 1.4, a.c[1] * 1.4, a.c[2] * 1.4, 0.6, 1); }
          break;
        case 'lightning': {
          if (!a.bolt) break;
          const k2 = a.bolt / 14, Rb = new (this.R.constructor)(Math.floor(a.seed * 1e9));
          b.draw(F.pool, pr[0], pr[1], 520 * k * a.s, 420 * k * a.s, 0, 0.6, 0.7, 1, 0.55 * k2, 1);
          // Branching bolt in screen space across the cloud top.
          let x0 = pr[0], y0 = pr[1], ang = Rb.angle();
          for (let s2 = 0; s2 < 9; s2++) {
            const l = Rb.range(18, 40) * k * a.s, x1 = x0 + Math.cos(ang) * l, y1 = y0 + Math.sin(ang) * l;
            b.draw(F.white, (x0 + x1) / 2, (y0 + y1) / 2, l, 2.2, ang, 1.6, 1.7, 2.2, 0.9 * k2, 1);
            if (Rb.chance(0.3)) { const ba = ang + Rb.sign() * Rb.range(0.6, 1.2), bl = l * 0.8; b.draw(F.white, x1 + Math.cos(ba) * bl / 2, y1 + Math.sin(ba) * bl / 2, bl, 1.2, ba, 1.4, 1.5, 2, 0.7 * k2, 1); }
            x0 = x1; y0 = y1; ang += Rb.range(-0.7, 0.7);
          }
          break;
        }
        case 'aurora': {
          // Curtains seen from above: a wavy luminous band drifting slowly.
          for (let s2 = 0; s2 < 16; s2++) {
            const u = (s2 - 7.5) * 26 * a.s, wave = Math.sin(t * 0.01 + s2 * 0.5 + a.x) * 30;
            const px = pr[0] + u * k, py = pr[1] + wave * k;
            const fl = 0.6 + 0.4 * Math.sin(t * 0.03 + s2 * 0.9 + a.y);
            b.draw(F.pool, px, py, 36 * k * a.s, 120 * k * a.s, 0.3 + Math.sin(t * 0.007 + s2) * 0.2, a.c[0], a.c[1], a.c[2], 0.16 * fl, 1);
          }
          break;
        }
        case 'shaftlight': {
          // Sunlight shaft through the water: a soft slanted band that sways.
          const sway = Math.sin(t * 0.008 + a.x) * 0.12;
          b.draw(F.cone, pr[0] + 40 * k, pr[1] - 80 * k, 420 * k * a.s, 120 * k * a.s, -1.2 + sway, 0.7, 0.95, 1, 0.07, 1);
          break;
        }
        case 'jellyfish': {
          // Drifting, pulsing bell with trailing glow.
          const ph = t * 0.05 + a.x * 0.1, pulse = 0.75 + 0.25 * Math.sin(ph * 2);
          const dx = Math.sin(t * 0.004 + a.y) * 30 * k, dy = Math.cos(t * 0.003 + a.x) * 20 * k;
          b.draw(F.pool, pr[0] + dx, pr[1] + dy, 34 * k * a.s * pulse, 30 * k * a.s * pulse, 0, a.c[0], a.c[1], a.c[2], 0.22, 1);
          b.draw(F.ring, pr[0] + dx, pr[1] + dy, 14 * k * a.s * pulse, 14 * k * a.s * pulse, 0, a.c[0] * 1.4, a.c[1] * 1.4, a.c[2] * 1.4, 0.5, 1);
          for (let s2 = 1; s2 < 4; s2++) b.draw(F.glow, pr[0] + dx - Math.sin(ph) * s2 * 3 * k, pr[1] + dy + s2 * 7 * k * a.s, 5 * k, 5 * k, 0, a.c[0], a.c[1], a.c[2], 0.3 / s2, 1);
          break;
        }
        case 'pulse': {
          // Heartbeat glow (organic interiors): double thump every ~70 steps.
          const ph = ((t + Math.round(a.x)) % 70) / 70, beat = Math.exp(-((ph - 0.1) ** 2) * 300) + 0.6 * Math.exp(-((ph - 0.25) ** 2) * 300);
          b.draw(F.pool, pr[0], pr[1], a.r * 2 * k, a.r * 1.8 * k, 0, a.c[0], a.c[1], a.c[2], (a.a ?? 0.3) * (0.3 + beat), 1);
          break;
        }
        case 'searchlight': {
          const ang = (a.base ?? -Math.PI / 2) + (a.sweep > 3 ? t * (a.speed || 0.01) : Math.sin(t * (a.speed || 0.01) + a.x) * (a.sweep ?? 0.8));
          const sc = a.c || [1, 0.95, 0.8];
          b.draw(F.cone, pr[0] + Math.cos(ang) * 150 * k, pr[1] + Math.sin(ang) * 150 * k, 300 * k, 90 * k, ang, sc[0], sc[1], sc[2], 0.13, 1);
          break;
        }
        default: break;
      }
    }
  }

  /** Smoke, dust, embers, sparks: above the ground layers, under entities. */
  renderParticles(b, alpha) {
    const cam = this.W.cam, P = this.p, pr = this.tmp, V = this.vis;
    // Pass 1: project, fade, cull; measure the fill of the large blended puffs.
    let m = 0, fill = 0;
    for (let i = 0; i < P.count; i++) {
      cam.project(P.x[i], P.y[i], P.z[i], pr);
      if (pr[3] < cam.near + 10) continue;
      const t = 1 - P.life[i] / P.max[i];
      let a = P.a[i];
      if (P.fade[i] === 1) a *= Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.3);
      else if (P.fade[i] === 2) a *= (1 - t) * (0.6 + 0.4 * Math.sin(i * 1.7 + P.life[i]));
      else if (P.fade[i] === 3) a *= Math.min(1, P.life[i] / 30);
      else a *= 1 - t * t;
      if (a < 0.01) continue;
      const s = Math.min(MAX_PUFF, (P.s0[i] + (P.s1[i] - P.s0[i]) * Math.sqrt(t)) * pr[2]);
      if (pr[0] < -s || pr[0] > WORLD_W + s || pr[1] < -s || pr[1] > WORLD_H + s) continue;
      if (s > BIG && !P.add[i]) fill += s * s * (P.f[i].h / P.f[i].w);
      V.i[m] = i; V.x[m] = pr[0]; V.y[m] = pr[1]; V.s[m] = s; V.a[m] = a; m++;
    }
    // Smoothed share of the large puffs that fit the budget.
    const target = fill > this.budget ? this.budget / fill : 1;
    this.keep += (target - this.keep) * (target < this.keep ? 0.12 : 0.03);
    const keep = this.keep, soft = 0.08, boost = Math.min(1.5, 1 / Math.sqrt(Math.max(keep, 0.05)));
    // Pass 2: draw.
    for (let v = 0; v < m; v++) {
      const i = V.i[v], s = V.s[v];
      let a = V.a[v];
      if (keep < 0.999 && s > BIG && !P.add[i]) {
        const wgt = (keep + soft - P.h[i]) / soft;
        if (wgt <= 0) continue;
        a = Math.min(0.95, a * boost * Math.min(1, wgt));
      }
      const t = 1 - P.life[i] / P.max[i];
      const f = P.f[i];
      const w = f === this.F.spark ? s * 3 : s;
      b.draw(f, V.x[v], V.y[v], w, s * (f.h / f.w), P.rot[i],
        P.r[i] + (P.r1[i] - P.r[i]) * t, P.g[i] + (P.g1[i] - P.g[i]) * t, P.b[i] + (P.b1[i] - P.b[i]) * t, a, P.add[i]);
    }
    void alpha;
  }
}
