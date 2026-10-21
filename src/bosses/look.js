import { LOOKS } from './looks.js';
import { HULL_META } from './hulls.js';
import { factionById } from '../data/factions/index.js';
import { hexRgb } from '../fx/greeble.js';
import { FADE_OUT, FADE_INOUT, FADE_FLICKER } from '../fx/Particles.js';

// Runtime visual layer for a retrofitted boss (UPDATE_02 §4.4 / §4.7 / §5).
// Owned by the BossController; purely cosmetic (fxRng only, never touches
// HP, phases, patterns or collision).
//
//   renderUnder    drop shadow on the ground layer (airborne bosses)
//   renderSurface  idle animation (treads, fans, wake, veins, tentacles)
//                  and damage decals, drawn before the arena's vision veil
//   renderOver     blinking idle lights and the weak-point glow
//   update         damage-state transitions (66% / 33% of phase HP), smoke,
//                  sparks, exhaust, wake, death leftovers
//   hit            faction hit effect (sparks, flak, splash, arcs, crystal
//                  chips, ink), throttled

const TAU = Math.PI * 2;
const DEATH_FINAL = 112; // matches BossController's DEATH.final

export class BossLook {
  constructor(c) {
    this.c = c;
    this.w = c.w;
    this.L = LOOKS[c.def.id] || c.def.look || null;
    this.fac = this.L ? factionById(this.L.faction) : null;
    this.t = 0;
    this.stage = 0;          // 0 pristine, 1 ≤66% phase HP, 2 ≤33%
    this.phaseIdx = -1;
    this.hitT = 0;
    this.treadPh = 0;
    this.rgb = new Map();
    const f = c.e.f;
    this.visR = f ? Math.max(c.e.r, Math.min(f.w, f.h) * 0.42) : c.e.r;
  }

  get active() { return !!this.L; }

  _col(hex) {
    let v = this.rgb.get(hex);
    if (!v) { v = hexRgb(hex); this.rgb.set(hex, v); }
    return v;
  }

  /** Remaining fraction of the current phase's HP (1 outside a phase). */
  _phaseFrac() {
    const c = this.c;
    if (!c.phase || c.state === 'enter') return 1;
    return Math.max(0, Math.min(1, (c.e.hp - c.floor) / c.phase.hp));
  }

  /** Sprite-local offset → world, following the boss's rotation and scale. */
  _xf(ox, oy, x, y) {
    const e = this.c.e, cs = Math.cos(e.rot), sn = Math.sin(e.rot), s = e.scale;
    return [x + (ox * cs - oy * sn) * s, y + (ox * sn + oy * cs) * s];
  }

  _pos(alpha = 1) {
    const e = this.c.e;
    return [e.px + (e.x - e.px) * alpha, e.py + (e.y - e.py) * alpha];
  }

  // ------------------------------------------------------------- update

  update() {
    if (!this.L) return;
    const c = this.c, w = this.w, e = c.e, R = w.fxRng;
    this.t++;
    if (this.hitT > 0) this.hitT--;
    // Damage stage resets at each new phase (the HP bar refills per phase).
    if (c.index !== this.phaseIdx && c.state === 'fight') { this.phaseIdx = c.index; this.stage = 0; }
    if (c.state === 'fight') {
      const f = this._phaseFrac();
      const st = f <= 0.33 ? 2 : f <= 0.66 ? 1 : 0;
      if (st > this.stage) { this.stage = st; this._breakOff(st); }
    }
    const [x, y] = this._pos();
    const sites = this.L.sites;
    // Damaged: smoke (machines) or ichor drips (organic) from the broken sites.
    if (this.stage > 0 && e.f) {
      const n = this.stage === 1 ? 1 : 3;
      if (this.t % (this.stage === 1 ? 7 : 4) === 0) {
        const [ox, oy] = sites[R.int(0, n - 1)];
        const [sx, sy] = this._xf(ox, oy, x, y);
        if (this.L.organic) this._drip(sx, sy);
        else this._smoke(sx, sy, this.stage);
      }
      if (this.stage === 2 && !this.L.organic && this.t % 11 === 0) {
        const [ox, oy] = sites[R.int(0, 3)];
        const [sx, sy] = this._xf(ox, oy, x, y);
        w.explosions.sparks(sx, sy, 5, [1, 0.75, 0.35], 3.2, 16, 3);
      }
    }
    this._animUpdate(x, y);
    if (c.state === 'dying') this._deathUpdate(x, y);
  }

  /** Crossing a damage threshold: a chunk of hull blows off. */
  _breakOff(stage) {
    const w = this.w, R = w.fxRng, [x, y] = this._pos();
    const k = stage === 1 ? 0 : 2;
    for (let i = k; i < k + 2; i++) {
      const [sx, sy] = this._xf(this.L.sites[i][0], this.L.sites[i][1], x, y);
      w.explosions.blast(sx, sy, 0.7, this.L.weak.rgb);
      if (this.L.organic) { for (let j = 0; j < 10; j++) this._drip(sx, sy, true); continue; }
      // Armour plates shed and tumble away (Ironclad "armor_shed", everyone else too).
      const shards = w.explosions.f.shards, L = w.fxLow;
      for (let j = 0; j < 5; j++) {
        const p = L.spawn(shards[j % shards.length], sx, sy, R.range(-2.5, 2.5), R.range(-3.5, -0.5), R.range(50, 80));
        if (p < 0) continue;
        L.size(p, R.range(8, 14)); L.color(p, 0.55, 0.5, 0.45, 0.25, 0.22, 0.2);
        L.phys(p, 0.985, 0.16); L.spin(p, R.angle(), R.range(-0.25, 0.25)); L.look(p, 1, 0, FADE_OUT);
      }
    }
    w.g.camera.addTrauma(0.18);
  }

  _smoke(x, y, stage) {
    const w = this.w, R = w.fxRng, L = w.fxLow;
    const i = L.spawn(w.r.frame('smoke'), x + R.range(-3, 3), y, R.range(-0.3, 0.3), R.range(-1.6, -0.8), R.range(40, 70));
    if (i < 0) return;
    L.size(i, 8, stage === 2 ? 34 : 24); L.color(i, 0.16, 0.15, 0.15, 0.05, 0.05, 0.05);
    L.phys(i, 0.98, -0.01); L.look(i, stage === 2 ? 0.75 : 0.55, 0, FADE_INOUT);
    if (stage === 2 && R.chance(0.3)) {
      const H = w.fxHigh, j = H.spawn(w.F.glow, x, y, R.range(-0.4, 0.4), R.range(-1.2, -0.4), 18);
      if (j >= 0) { H.size(j, 10, 4); H.color(j, 2, 0.8, 0.2, 1, 0.2, 0); H.look(j, 0.8, 1, FADE_FLICKER); }
    }
  }

  _drip(x, y, burst = false) {
    const w = this.w, R = w.fxRng, H = w.fxHigh, c = this.L.ichor;
    const i = H.spawn(w.F.spark, x + R.range(-4, 4), y, burst ? R.range(-3, 3) : R.range(-0.2, 0.2), burst ? R.range(-3, 1) : 0.4, R.range(30, 50));
    if (i < 0) return;
    H.size(i, 5, 2); H.color(i, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4);
    H.phys(i, 0.97, 0.08); H.look(i, 0.9, 1, FADE_OUT, 0.4);
  }

  /** Faction hit effect at the point shots strike (front of the hull, player's column). */
  hit() {
    if (!this.L || this.hitT > 0) return;
    this.hitT = 3;
    const w = this.w, R = w.fxRng, e = this.c.e, p = w.player;
    const span = this.visR * 0.8;
    const x = Math.max(e.x - span, Math.min(e.x + span, p ? p.x : e.x)) + R.range(-8, 8);
    const y = e.y + R.range(0.1, 0.6) * this.visR;
    const H = w.fxHigh;
    switch (this.fac.hitFx) {
      case 'sparks': w.explosions.sparks(x, y, 4, [1, 0.6, 0.2], 3.5, 14, 3); break;
      case 'flak': w.explosions.sparks(x, y, 3, [0.6, 0.95, 1], 4, 12, 3); break;
      case 'splash':
        for (let k = 0; k < 4; k++) {
          const i = H.spawn(w.F.spark, x, y, R.range(-1.5, 1.5), R.range(-3.5, -1.5), 22);
          if (i >= 0) { H.size(i, 4, 2); H.color(i, 1.2, 1.6, 2, 0.4, 0.7, 1); H.phys(i, 0.97, 0.22); H.look(i, 0.9, 1, FADE_OUT, 0.3); }
        }
        break;
      case 'arc':
        for (let k = 0; k < 2; k++) {
          const a = R.angle(), i = H.spawn(w.F.spark, x, y, Math.cos(a) * 5, Math.sin(a) * 5, 7);
          if (i >= 0) { H.size(i, 9, 3); H.color(i, 1.4, 1.8, 2.4, 2, 0.4, 1.6); H.phys(i, 0.8, 0); H.look(i, 1, 1, FADE_FLICKER, 1.2); }
        }
        break;
      case 'crystal': {
        const shards = w.explosions.f.shards;
        for (let k = 0; k < 3; k++) {
          const i = H.spawn(shards[k % shards.length], x, y, R.range(-2.5, 2.5), R.range(-3, -0.5), 26);
          if (i >= 0) { H.size(i, 5, 2); H.color(i, 2, 0.9, 1.8, 0.8, 0.4, 1.6); H.phys(i, 0.96, 0.12); H.spin(i, R.angle(), 0.3); H.look(i, 1, 1, FADE_OUT); }
        }
        break;
      }
      case 'ink': {
        const L = w.fxLow, i = L.spawn(w.r.frame('smoke'), x, y, R.range(-0.6, 0.6), R.range(-0.8, 0.2), 34);
        if (i >= 0) { L.size(i, 6, 20); L.color(i, 0.04, 0, 0.05, 0, 0, 0); L.phys(i, 0.95, 0); L.look(i, 0.85, 0, FADE_INOUT); }
        w.explosions.sparks(x, y, 2, [1, 0.15, 0.25], 2.5, 12, 2.5);
        break;
      }
    }
  }

  // ------------------------------------------------------- idle animation

  _animUpdate(x, y) {
    const c = this.c, w = this.w, e = c.e, R = w.fxRng, meta = e.f && HULL_META[e.f.name];
    if (!meta || c.state === 'dying') return;
    const H = w.fxHigh, L = w.fxLow;
    switch (this.L.anim) {
      case 'crawler': {
        this.treadPh += 0.35 + Math.hypot(e.x - e.px, e.y - e.py) * 0.9;
        // Track marks left on the arena floor behind the outer tread units.
        const tfx = w.arena && w.arena.fx;
        if (tfx && this.t % 9 === 0 && meta.treads && meta.treads.length) {
          let lo = meta.treads[0], hi = lo;
          for (const tr of meta.treads) { if (tr.x0 < lo.x0) lo = tr; if (tr.x1 > hi.x1) hi = tr; }
          for (const tr of lo === hi ? [lo] : [lo, hi]) { const [sx, sy] = this._xf((tr.x0 + tr.x1) / 2, tr.y0 - 10, x, y); tfx.trail(sx, sy, (tr.x1 - tr.x0) * 1.1, e.rot); }
        }
        // Smokestack exhaust puffs.
        if (this.t % 8 === 0) for (const [ox, oy] of meta.stacks) {
          const [sx, sy] = this._xf(ox, oy, x, y);
          const i = L.spawn(w.r.frame('smoke'), sx, sy, R.range(-0.3, 0.3), R.range(-1.8, -1.1), 46);
          if (i >= 0) { L.size(i, 7, 22); L.color(i, 0.2, 0.18, 0.16, 0.06, 0.05, 0.05); L.phys(i, 0.98, -0.01); L.look(i, 0.6, 0, FADE_INOUT); }
          if (R.chance(0.35)) { const j = H.spawn(w.F.spark, sx, sy, R.range(-0.6, 0.6), R.range(-2.5, -1), 20); if (j >= 0) { H.size(j, 3, 1); H.color(j, 2, 1, 0.3, 1, 0.3, 0); H.look(j, 1, 1, FADE_FLICKER); } }
        }
        break;
      }
      case 'ship': {
        // Generic warship / platform: foam along the waterline sized from the
        // hull (meta.hw, meta.hl), bow spray, stern wake and funnel smoke.
        // L.submerged: only a bubble trail; L.moored: no bow wave.
        const hw = meta.hw || 50, hl = meta.hl || 120, sub = this.L.submerged;
        if (this.t % 3 === 0) {
          const pts = sub ? [[R.range(-hw * 0.4, hw * 0.4), R.range(-hl, hl)]]
            : [[R.sign() * (hw + R.range(0, 6)), R.range(-hl * 0.6, hl * 0.6)], [R.range(-hw * 0.5, hw * 0.5), -hl - R.range(4, 14)], ...(this.L.moored ? [] : [[R.range(-hw * 0.3, hw * 0.3), hl + 4]])];
          for (const [ox, oy] of pts) {
            const [sx, sy] = this._xf(ox, oy, x, y);
            const i = L.spawn(w.F.glow, sx, sy, R.range(-0.3, 0.3) + (oy > hl * 0.8 ? ox * 0.01 : 0), sub ? -0.6 : R.range(-0.9, -0.4), sub ? 40 : 70);
            if (i >= 0) { L.size(i, sub ? 4 : 6, sub ? 8 : 18); L.color(i, 0.8, 0.95, 1, 0.5, 0.7, 0.8); L.look(i, sub ? 0.5 : 0.28, 1, FADE_OUT); }
          }
        }
        // Foam decals on the arena's water surface (world-space wake).
        const fx = w.arena && w.arena.fx;
        if (fx && !sub && !this.L.moored && this.t % 10 === 0) { const [sx, sy] = this._xf(0, -hl, x, y); fx.trail(sx, sy, hw * 1.6, e.rot); }
        if (!sub && this.t % 10 === 0) for (const [ox, oy] of meta.funnels || []) {
          const [sx, sy] = this._xf(ox, oy, x, y);
          const i = L.spawn(w.r.frame('smoke'), sx, sy, 0, -1.2, 50);
          if (i >= 0) { L.size(i, 6, 20); L.color(i, 0.18, 0.18, 0.2, 0.05, 0.05, 0.06); L.phys(i, 0.98, -0.01); L.look(i, 0.55, 0, FADE_INOUT); }
        }
        break;
      }
      case 'leviathan': {
        const sub = e.f.name === 'b_leviathan_sub';
        // Wake foam / bubbles along the hulls and stern.
        if (this.t % 3 === 0) {
          const pts = sub ? [[R.range(-30, 30), R.range(-120, 120)]] : [[R.sign() * R.range(100, 112), R.range(-60, 90)], [R.range(-26, 26), -136], [R.sign() * 52, R.range(-100, 100)]];
          for (const [ox, oy] of pts) {
            const [sx, sy] = this._xf(ox, oy, x, y);
            const i = L.spawn(w.F.glow, sx, sy, R.range(-0.2, 0.2), sub ? -0.6 : R.range(-0.9, -0.5), sub ? 40 : 70);
            if (i >= 0) { L.size(i, sub ? 4 : 6, sub ? 8 : 18); L.color(i, 0.8, 0.95, 1, 0.5, 0.7, 0.8); L.look(i, sub ? 0.5 : 0.28, 1, FADE_OUT); }
          }
        }
        if (!sub && this.t % 10 === 0) for (const [ox, oy] of meta.funnels || []) {
          const [sx, sy] = this._xf(ox, oy, x, y);
          const i = L.spawn(w.r.frame('smoke'), sx, sy, 0, -1.2, 50);
          if (i >= 0) { L.size(i, 6, 20); L.color(i, 0.18, 0.18, 0.2, 0.05, 0.05, 0.06); L.phys(i, 0.98, -0.01); L.look(i, 0.55, 0, FADE_INOUT); }
        }
        break;
      }
    }
  }

  _deathUpdate(x, y) {
    const c = this.c, w = this.w, R = w.fxRng, st = c.st;
    // Chain reaction across the hull's damage sites (§4.7).
    if (st < DEATH_FINAL && st % 9 === 0 && c.e.f) {
      const [ox, oy] = this.L.sites[R.int(0, this.L.sites.length - 1)];
      const [sx, sy] = this._xf(ox, oy, x, y);
      w.explosions.blast(sx, sy, R.range(0.6, 1.1), this.L.weak.rgb);
    }
    if (st === DEATH_FINAL) this._leftovers(x, y);
  }

  /** Debris rain + something left on the ground (fire, crystal, ink). */
  _leftovers(x, y) {
    const w = this.w, R = w.fxRng, L = w.fxLow, H = w.fxHigh, shards = w.explosions.f.shards;
    for (let k = 0; k < 36; k++) {
      const a = R.angle(), s = R.range(2, 7);
      const i = L.spawn(shards[k % shards.length], x + R.range(-30, 30), y + R.range(-30, 30), Math.cos(a) * s, Math.sin(a) * s - 3, R.range(60, 100));
      if (i >= 0) { L.size(i, R.range(6, 14)); L.color(i, 0.5, 0.45, 0.4, 0.2, 0.18, 0.16); L.phys(i, 0.985, 0.18); L.spin(i, R.angle(), R.range(-0.3, 0.3)); L.look(i, 1, 0, FADE_OUT); }
    }
    const fx = this.fac.hitFx;
    for (let k = 0; k < 14; k++) {
      const px = x + R.range(-1, 1) * this.visR, py = y + R.range(-0.7, 0.7) * this.visR;
      const i = L.spawn(fx === 'ink' ? w.r.frame('smoke') : w.F.glow, px, py, 0, fx === 'ink' ? 0 : -0.15, R.range(150, 240));
      if (i < 0) continue;
      if (fx === 'ink') { L.size(i, 30, 40); L.color(i, 0.03, 0, 0.04); L.look(i, 0.8, 0, FADE_INOUT); }
      else if (fx === 'crystal') { L.size(i, 14, 6); L.color(i, 1.2, 0.5, 1.4, 0.4, 0.2, 0.6); L.look(i, 0.7, 1, FADE_FLICKER); }
      else { L.size(i, R.range(16, 26), 6); L.color(i, 1.8, 0.7, 0.2, 0.8, 0.15, 0); L.look(i, 0.75, 1, FADE_FLICKER); }
    }
    for (let k = 0; k < 24; k++) {
      const i = H.spawn(w.F.spark, x + R.range(-1, 1) * this.visR, y - R.range(60, 200), R.range(-0.4, 0.4), R.range(2, 4), 70);
      if (i >= 0) { H.size(i, 4, 2); H.color(i, 1.6, 1, 0.5, 0.6, 0.2, 0.1); H.phys(i, 1, 0.05); H.look(i, 0.9, 1, FADE_FLICKER, 0.5); }
    }
  }

  // ------------------------------------------------------------- render

  renderUnder(b, alpha) {
    const L = this.L, e = this.c.e;
    if (!L || !L.shadow || !e.f) return;
    const [x, y] = this._pos(alpha), s = L.shadow;
    b.draw(e.f, x + s.dx, y + s.dy, e.f.w * e.scale * 0.96, e.f.h * e.scale * 0.96, e.rot, 0, 0, 0, s.a, 0);
  }

  renderSurface(b, alpha) {
    const L = this.L, c = this.c, e = c.e;
    if (!L || !e.f) return;
    const w = this.w, F = w.F, t = w.t, [x, y] = this._pos(alpha);
    const meta = HULL_META[e.f.name];
    const sc = e.scale;
    // Idle animation overlays.
    if (meta) {
      switch (L.anim) {
        case 'crawler':
          for (const tr of meta.treads || []) {
            const ph = this.treadPh % 5, cx = (tr.x0 + tr.x1) / 2, tw = tr.x1 - tr.x0;
            for (let yy = tr.y0 + ph; yy < tr.y1; yy += 5) {
              const [px, py] = this._xf(cx, yy, x, y);
              b.draw(F.white, px, py, tw * sc, 1.5 * sc, e.rot, 0.03, 0.02, 0.015, 0.85, 0);
              const [qx, qy] = this._xf(cx, yy + 1.6, x, y);
              b.draw(F.white, qx, qy, tw * sc, 0.8 * sc, e.rot, 0.5, 0.42, 0.34, 0.6, 0);
            }
          }
          break;
        case 'carrier': {
          const fan = w.r.frame('bx_fan');
          for (const [ox, oy, r] of meta.fans || []) {
            const [px, py] = this._xf(ox, oy, x, y);
            b.draw(fan, px, py, r * 2 * sc, r * 2 * sc, t * 0.45 * (ox > 0 ? 1 : -1), 1, 1, 1, 0.85, 0.2);
          }
          for (const [ox, oy] of meta.nozzles || []) {
            const [px, py] = this._xf(ox, oy - 10, x, y), fl = 0.75 + 0.25 * Math.sin(t * 0.9 + ox);
            b.draw(F.laser, px, py, 26 * fl * sc, 9 * sc, e.rot - Math.PI / 2, 0.4, 1.4, 2, 0.75, 1);
            b.draw(F.glow, px, py + 8, 18 * sc, 18 * sc, 0, 0.3, 1, 1.6, 0.5 * fl, 1);
          }
          break;
        }
        case 'titan':
          for (const [ox, oy] of meta.thrusters || []) {
            const up = oy < 0, [px, py] = this._xf(ox, oy + (up ? -9 : 9), x, y), fl = 0.7 + 0.3 * Math.sin(t * 1.1 + ox);
            const hot = e.f.name === 'b_titan_c';
            b.draw(F.laser, px, py, 22 * fl * sc, 8 * sc, e.rot + (up ? -Math.PI / 2 : Math.PI / 2), hot ? 2 : 0.6, hot ? 0.7 : 1.2, hot ? 0.3 : 2, 0.7, 1);
          }
          break;
        case 'hive': {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
          b.draw(w.r.frame('bx_hive_veins'), x, y, e.f.w * sc, e.f.h * sc, e.rot, 0.6, 1.4, 0.9, 0.25 + 0.4 * pulse, 1);
          const ring = w.r.frame('bx_glyphring');
          b.draw(ring, x, y - 6 * sc, 270 * sc, 270 * sc, t * 0.004, 0.9, 0.5, 1.4, 0.22, 1);
          b.draw(ring, x, y - 6 * sc, 200 * sc, 200 * sc, -t * 0.007, 0.4, 1.2, 0.8, 0.18, 1);
          break;
        }
        case 'alien': {
          // Non-organic alien constructs: counter-rotating glyph rings and a
          // pulsing core glow (L.rings: [{ r, rgb, spin, a }], L.pulse rgb).
          const ring = w.r.frame('bx_glyphring'), pulse = 0.5 + 0.5 * Math.sin(t * 0.07);
          for (const rg of L.rings || []) b.draw(ring, x, y, rg.r * 2 * sc, rg.r * 2 * sc, t * (rg.spin || 0.004), rg.rgb[0], rg.rgb[1], rg.rgb[2], (rg.a ?? 0.25) * (0.7 + 0.3 * pulse), 1);
          if (L.pulse) { const [px, py] = this._xf(L.weak.x, L.weak.y, x, y); b.draw(F.glow, px, py, L.weak.r * 4 * sc, L.weak.r * 4 * sc, 0, L.pulse[0], L.pulse[1], L.pulse[2], 0.25 + 0.35 * pulse, 1); }
          break;
        }
        case 'maw': {
          const ten = w.r.frame('bx_tentacle');
          for (let k = 0; k < 6; k++) {
            const base = [0.35, 0.95, 1.57, 2.2, 2.8, -0.3][k];
            const a = base + Math.sin(t * 0.03 + k * 1.7) * 0.22;
            const [px, py] = this._xf(Math.cos(a) * 76, Math.sin(a) * 62, x, y);
            const L2 = 96 * sc, ang = a + e.rot + Math.sin(t * 0.05 + k) * 0.15;
            b.draw(ten, px + Math.cos(ang) * L2 / 2, py + Math.sin(ang) * L2 / 2, L2, 18 * sc, ang, 1, 1, 1, 0.95, 0);
          }
          break;
        }
      }
    }
    // Damage decals (§4.4: dents, cracks, exposed machinery / wounds).
    if (this.stage > 0 && c.state !== 'enter' && !L.noDecals) {
      // Never more decals than the hull has damage sites (mini-bosses define four).
      const n = Math.min(this.stage === 1 ? 2 : 6, L.sites.length);
      for (let i = 0; i < n; i++) {
        const [ox, oy] = L.sites[i], [px, py] = this._xf(ox, oy, x, y);
        if (L.organic) {
          const k = L.ichor, gl = 0.6 + 0.4 * Math.sin(t * 0.1 + i);
          b.draw(w.r.frame('bd_wound'), px, py, 34 * sc, 20 * sc, e.rot + i * 0.7, k[0] * gl, k[1] * gl, k[2] * gl, 1, 0);
          if (this.stage === 2) b.draw(w.r.frame('bd_crack'), px, py, 40 * sc, 40 * sc, i, k[0] * 1.6, k[1] * 1.6, k[2] * 1.6, 0.7, 1);
        } else {
          b.draw(w.r.frame(this.stage === 2 && i % 2 === 0 ? 'bd_machinery' : 'bd_dent'), px, py, 30 * sc, 26 * sc, e.rot + i * 1.3, 1, 1, 1, 1, 0);
          if (this.stage === 2) {
            const fl = 0.5 + 0.5 * Math.sin(t * 0.7 + i * 2);
            b.draw(F.glow, px, py, 16 * sc, 16 * sc, 0, 2, 0.7, 0.2, 0.25 + 0.25 * fl, 1);
          }
        }
      }
    }
  }

  renderOver(b, alpha) {
    const L = this.L, c = this.c, e = c.e;
    if (!L || !e.f) return;
    const F = this.w.F, t = this.w.t, [x, y] = this._pos(alpha), sc = e.scale;
    // Idle lights blink on their own phase.
    const meta = HULL_META[e.f.name];
    if (meta && c.state !== 'dying') {
      for (const l of meta.lights) {
        if (Math.sin(t * 0.06 + l.ph * TAU) < 0.25) continue;
        const [px, py] = this._xf(l.x, l.y, x, y), col = this._col(l.c);
        b.draw(F.glow, px, py, 9 * sc, 9 * sc, 0, col[0] * 1.6, col[1] * 1.6, col[2] * 1.6, 0.8, 1);
        b.draw(F.core, px, py, 2.6 * sc, 2.6 * sc, 0, 2, 2, 2, 1, 1);
      }
    }
    // Weak point: brighter and faster the more of the phase is gone.
    if (L.noWeak) return; // drawn by the boss itself (3D emissive)
    const wk = L.weak, dmg = c.state === 'dying' ? 1 : 1 - this._phaseFrac();
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.08 + dmg * 0.22));
    const [px, py] = this._xf(wk.x, wk.y, x, y), r = wk.r * sc * (1 + 0.18 * pulse + 0.35 * dmg);
    const a = 0.3 + 0.55 * dmg + 0.15 * pulse;
    b.draw(F.glow, px, py, r * 2.4, r * 2.4, 0, wk.rgb[0] * 1.4, wk.rgb[1] * 1.4, wk.rgb[2] * 1.4, a, 1);
    b.draw(F.core, px, py, r * 0.7, r * 0.7, 0, 1.6 + dmg, 1.6 + dmg, 1.6 + dmg, 0.4 + 0.6 * dmg, 1);
  }
}
