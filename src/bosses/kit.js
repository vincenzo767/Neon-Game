import { WORLD_W as W, WORLD_H as H } from '../core/constants.js';
import { DMG_IGNORES_SHIELDS } from '../core/damage.js';
import { segDist2 } from '../entities/World.js';
import * as P from '../patterns/index.js';
import { GHOST_LEVELS } from './art.js';
import { factionFrame } from '../fx/factionSkins.js';
import { ARCHETYPE_FACTION } from '../data/factions/index.js';

// Boss mechanics toolkit (M4c), owned by a BossController as `ctrl.kit`.
// Everything here belongs to the current phase: parts, minions, hazards and
// wells are cleared when the phase ends or the boss is defeated.
//
//   parts     breakable sub-targets riding on the boss (own HP, medals);
//             `eye` parts open and close and forward damage to the boss
//   minions   escorts / drone swarms (plain World enemies with custom AI)
//   hazards   telegraphed attacks that are not bullets:
//               circle   artillery zone: marked floor area, then detonation
//               lane     vertical strip (charges, torpedo lanes)
//               arc      melee swipe sweeping a sector around the boss
//               tendril  a grab reaching in from a screen edge
//             `lethal: false` hazards are telegraphs only (bullets do the harm)
//   wells     gravity wells that bend enemy bullet paths
//   ghosts    bullets that fade in and out (frame swap per step)
//   glyph     bullets arranged in an alien glyph that expands outward

export const KIND_GHOST = 9;
const GHOST_ORB = { big: false };
const GHOST_BIG = { big: true };

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ------------------------------------------------------------- glyphs

/** Polylines in unit space (y down); sampled into bullet positions. */
const GLYPH_LINES = {
  eye: [
    [[-1, 0], [-0.5, -0.45], [0, -0.55], [0.5, -0.45], [1, 0], [0.5, 0.45], [0, 0.55], [-0.5, 0.45], [-1, 0]],
    [[0, -0.28], [0.28, 0], [0, 0.28], [-0.28, 0], [0, -0.28]],
  ],
  trident: [[[0, 1], [0, -1]], [[-0.7, -1], [-0.7, -0.3], [0.7, -0.3], [0.7, -1]], [[-0.4, 0.6], [0.4, 0.6]]],
  star: [[[0, -1], [0.59, 0.81], [-0.95, -0.31], [0.95, -0.31], [-0.59, 0.81], [0, -1]]],
  rune: [[[-1, -1], [1, -1], [-1, 1], [1, 1]], [[0, -1], [0, 1]], [[-0.6, 0], [0.6, 0]]],
};
const glyphCache = {};

function glyphPoints(name, n) {
  const key = `${name}:${n}`;
  if (glyphCache[key]) return glyphCache[key];
  const lines = GLYPH_LINES[name] || GLYPH_LINES.eye;
  const segs = [];
  let total = 0;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const len = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
    segs.push([l[i - 1], l[i], len]);
    total += len;
  }
  const pts = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total;
    for (const [a, b, len] of segs) {
      if (d <= len) { const t = d / len; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); break; }
      d -= len;
    }
  }
  return (glyphCache[key] = pts);
}

// ---------------------------------------------------------------- kit

export class BossKit {
  constructor(ctrl) {
    this.c = ctrl;
    this.w = ctrl.w;
    const r = ctrl.w.r;
    this.F = {
      white: r.frame('white'), glow: r.frame('glow'), ring: r.frame('ring'), laser: r.frame('laser'),
      slash: r.frame('slash'), tendril: r.frame('fx_tendril'), core: r.frame('core'),
    };
    this.ghostFrames = {
      orb: Array.from({ length: GHOST_LEVELS }, (_, k) => r.frame(`ghost_orb_${k}`).id),
      big: Array.from({ length: GHOST_LEVELS }, (_, k) => r.frame(`ghost_big_${k}`).id),
    };
    this.parts = [];
    this.minions = [];
    this.hazards = [];
    this.wells = [];
    this.fx = [];       // short-lived boss-owned visuals (death rays...)
  }

  // ------------------------------------------------------------- parts

  /** Spawn the named parts (from def.parts) for the current phase. */
  spawnParts(names = []) {
    const c = this.c, w = this.w, r = w.r, defs = c.def.parts || {};
    for (const name of names) {
      const d = defs[name];
      if (!d || (d.skip && d.skip(c))) continue; // e.g. a mount already destroyed in an earlier phase
      const pe = w.spawnEnemy({
        kind: 'bosspart', name: d.label || name, x: c.e.x + (d.ox || 0), y: c.e.y + (d.oy || 0), r: d.r || 14,
        hp: Math.max(1, Math.round((d.hp || 60) * c.hpScale)),
        // Parts reusing enemy art wear the owning faction's colours (M4d, cosmetic).
        f: factionFrame(r, d.sprite, ARCHETYPE_FACTION[c.archetype]),
        f2: d.sprite2 ? factionFrame(r, d.sprite2, ARCHETYPE_FACTION[c.archetype]) : null, scale: d.scale || 1,
        score: (d.score || 5000) * c.mk, blast: d.blast ?? 0.9, glow: d.glow || null,
        drops: Array(d.medals ?? 3).fill('M'), ult: 6,
        onDeath: () => this._partDown(part),
      });
      pe.entered = true;
      const part = { name, d, e: pe, open: true };
      if (d.onSpawn) d.onSpawn(pe, c); // e.g. carry a mount's damage over from the last phase
      if (d.eye) {
        // Weak point: takes damage itself (breakable, drops medals) and
        // forwards a multiple of it to the boss, through any shield.
        pe.onDamage = (e, dmg, flags) => {
          if (!part.open) return 0;
          w.damage(c.e, dmg * (d.eye.forward || 2), flags | DMG_IGNORES_SHIELDS);
          return dmg;
        };
      }
      this.parts.push(part);
    }
    this._placeParts();
  }

  _partDown(part) {
    const c = this.c;
    part.dead = true;
    this.w.event('bossPartDown', { name: part.d.label || part.name, medals: part.d.medals ?? 3 });
    // Breaking a part staggers the boss: a chunk of the phase's HP.
    if (part.d.bossDamage && c.state === 'fight') this.w.damage(c.e, c.phase.hp * part.d.bossDamage, DMG_IGNORES_SHIELDS);
    if (part.d.onDown) part.d.onDown(c, this.w);
  }

  get partsAlive() { let n = 0; for (const p of this.parts) if (!p.dead && p.e.alive) n++; return n; }
  partAlive(name) { return this.parts.some((p) => p.name === name && !p.dead && p.e.alive); }

  _placeParts() {
    const e = this.c.e, w = this.w;
    for (const p of this.parts) {
      if (p.dead || !p.e.alive) continue;
      const pe = p.e;
      if (!p.d.free) {
        // Riding on the hull. `free` parts (teleporting cores) are placed by their attack.
        pe.x = e.x + (p.d.ox || 0);
        pe.y = e.y + (p.d.oy || 0);
      }
      if (p.d.aim) pe.rot2 = w.aimAngle(pe.x, pe.y);
    }
  }

  _updateParts() {
    const c = this.c, w = this.w, fight = c.state === 'fight' && c.pt >= 30;
    this._placeParts();
    for (const p of this.parts) {
      if (p.dead || !p.e.alive) continue;
      const d = p.d, pe = p.e;
      if (d.eye) {
        const cyc = (d.eye.open || 150) + (d.eye.shut || 150);
        const k = (c.pt + (d.eye.offset || 0)) % cyc;
        const open = k < (d.eye.open || 150);
        if (open !== p.open) {
          p.open = open;
          pe.f = w.r.frame(open ? d.sprite : d.eye.shutSprite);
          if (open) w.explosions.sparks(pe.x, pe.y, 6, [1, 0.6, 0.2], 3, 16, 3);
        }
        pe.untargetable = !open;
      }
      if (fight && d.attack && (!d.eye || p.open)) d.attack(pe, c, w, c.pt - 30);
    }
  }

  // ----------------------------------------------------------- minions

  /** Escort / swarm unit. spec: { sprite, x, y, hp, r, score, drops, ai(m, c, w), scale, glow } */
  spawnMinion(s) {
    const w = this.w, c = this.c;
    const m = w.spawnEnemy({
      kind: 'bossminion', name: s.name || 'ESCORT', x: s.x, y: s.y, r: s.r || 10,
      hp: Math.max(1, Math.round((s.hp || 6) * (w.diff.hp || 1))), f: w.r.frame(s.sprite), scale: s.scale || 1,
      score: s.score || 300, blast: s.blast ?? 0.5, glow: s.glow || null, drops: s.drops || null, ult: 1,
    });
    m.data = { ...(s.data || {}) };
    m.ai = (me) => s.ai(me, c, w);
    this.minions.push(m);
    return m;
  }

  // ----------------------------------------------------------- hazards

  /** Add a telegraphed hazard (see header). Returns it. */
  hazard(h) {
    const hz = { t: 0, warn: 50, fire: 12, lethal: true, color: [1, 0.3, 0.2], ...h };
    this.hazards.push(hz);
    return hz;
  }

  _updateHazards() {
    const w = this.w, p = w.player;
    const canHit = p && p.collidable && !p.invulnerable;
    for (const h of this.hazards) {
      h.t++;
      if (h.follow) { h.x = this.c.e.x + (h.fx || 0); h.y = this.c.e.y + (h.fy || 0); h.cx = h.x; h.cy = h.y; }
      if (h.t === h.warn) {
        if (h.onFire) h.onFire(h, w);
        if (h.type === 'circle' && h.boom !== false) {
          w.explosions.blast(h.x, h.y, Math.min(2.2, h.r / 40), h.color);
          // Leave a mark on the arena floor (crater / scorch / water foam).
          const fx = w.arena && w.arena.fx;
          if (fx) fx.impact(h.x, h.y, h.r * 0.6, { crater: h.crater });
        }
      }
      if (h.t >= h.warn && h.t < h.warn + h.fire && h.lethal && canHit && this._inside(h, p.x, p.y, p.hitR)) p.hit();
      if (h.update) h.update(h, w);
    }
    if (this.hazards.length && this.hazards.some((h) => h.t >= h.warn + h.fire + (h.linger || 10))) {
      this.hazards = this.hazards.filter((h) => h.t < h.warn + h.fire + (h.linger || 10));
    }
  }

  _inside(h, x, y, r) {
    switch (h.type) {
      case 'circle': return Math.hypot(x - h.x, y - h.y) < h.r + r;
      case 'lane': return Math.abs(x - h.x) < h.w / 2 + r && y > (h.y0 ?? -50) && y < (h.y1 ?? H + 50);
      case 'arc': {
        const k = Math.min(1, (h.t - h.warn) / Math.max(1, h.fire));
        const a = h.a0 + (h.a1 - h.a0) * k;
        const bx = h.cx + Math.cos(a) * h.r, by = h.cy + Math.sin(a) * h.r;
        return segDist2(x, y, h.cx, h.cy, bx, by) < (14 + r) ** 2;
      }
      case 'tendril': {
        const k = smooth((h.t - h.warn) / 8);
        const ex = h.x0 + (h.x1 - h.x0) * k, ey = h.y0 + (h.y1 - h.y0) * k;
        return segDist2(x, y, h.x0, h.y0, ex, ey) < ((h.width || 12) * 0.5 + r) ** 2;
      }
      default: return false;
    }
  }

  // ------------------------------------------------------------- wells

  /** Gravity well bending bullets toward (x, y) within radius r. */
  well(s) {
    const wl = { t: 0, life: 300, r: 140, strength: 0.03, ...s };
    this.wells.push(wl);
    return wl;
  }

  _updateWells() {
    if (!this.wells.length) return;
    const B = this.w.bullets;
    for (const wl of this.wells) {
      wl.t++;
      if (wl.follow) { wl.x = this.c.e.x + (wl.fx || 0); wl.y = this.c.e.y + (wl.fy || 0); }
      const fade = Math.min(1, wl.t / 30, (wl.life - wl.t) / 30);
      const r2 = wl.r * wl.r;
      for (let i = 0; i < B.count; i++) {
        const dx = wl.x - B.x[i], dy = wl.y - B.y[i], d2 = dx * dx + dy * dy;
        if (d2 > r2 || d2 < 16) continue;
        const pull = wl.strength * fade * (1 - Math.sqrt(d2) / wl.r);
        let da = Math.atan2(dy, dx) - B.ang[i];
        da = Math.atan2(Math.sin(da), Math.cos(da));
        B.setHeading(i, B.ang[i] + da * pull);
      }
    }
    this.wells = this.wells.filter((wl) => wl.t < wl.life);
  }

  // ------------------------------------------------------------ ghosts

  /** Make bullet i a ghost (fades in and out). Call right after spawning. */
  ghost(i) {
    if (i < 0) return;
    const B = this.w.bullets;
    B.kind[i] = KIND_GHOST;
    B.aux[i] = B.frame[i];
    B.ref[i] = B.radius[i] > 5 ? GHOST_BIG : GHOST_ORB;
  }

  _updateGhosts() {
    const B = this.w.bullets, n = GHOST_LEVELS, G = this.ghostFrames;
    for (let i = 0; i < B.count; i++) {
      if (B.kind[i] !== KIND_GHOST) continue;
      // Visible for the first 20 steps so spawns always read, then pulse.
      const v = B.age[i] < 20 ? 1 : 0.5 + 0.5 * Math.sin(B.age[i] * 0.07);
      const lvl = Math.round(v * n); // n = fully visible
      B.frame[i] = lvl >= n ? B.aux[i] : (B.ref[i].big ? G.big : G.orb)[n - 1 - lvl];
    }
  }

  /** Fire spec `s` as bullets laid out on glyph `name`, expanding from (x, y). */
  glyph(x, y, name, s, n = 24, rot = 0, ghost = false) {
    const pts = glyphPoints(name, n), cr = Math.cos(rot), sr = Math.sin(rot);
    for (const [gx, gy] of pts) {
      const px = gx * cr - gy * sr, py = gx * sr + gy * cr;
      const d = Math.hypot(px, py);
      if (d < 0.05) continue;
      const i = P.shoot(this.w, x + px * 6, y + py * 6, Math.atan2(py, px), s.speed * d, s);
      if (ghost) this.ghost(i);
    }
  }

  // ---------------------------------------------------------- lifecycle

  update() {
    this._updateParts();
    this._updateHazards();
    this._updateWells();
    this._updateGhosts();
    for (const f of this.fx) f.t++;
    if (this.fx.length) this.fx = this.fx.filter((f) => f.t < f.life);
  }

  /** End of phase / defeat: parts detonate (no medals), minions and hazards vanish. */
  clearPhase() {
    const w = this.w;
    for (const p of this.parts) {
      if (p.dead || !p.e.alive) continue;
      if (p.d.onClear) p.d.onClear(p, this.c);
      p.e.alive = false;
      if (!p.d.quietClear) w.explosions.blast(p.e.x, p.e.y, 0.7, this.c.def.glow);
    }
    for (const m of this.minions) {
      if (!m.alive) continue;
      m.alive = false;
      w.explosions.blast(m.x, m.y, 0.5);
    }
    this.parts = [];
    this.minions = [];
    this.hazards = [];
    this.wells = [];
  }

  // ------------------------------------------------------------ render

  /** Wells: under entities. */
  renderUnder(b) {
    const F = this.F, t = this.w.t;
    for (const wl of this.wells) {
      const a = Math.min(1, wl.t / 30, (wl.life - wl.t) / 30);
      b.draw(F.glow, wl.x, wl.y, wl.r * 2.2, wl.r * 2.2, 0, 0, 0, 0, 0.55 * a, 0);
      for (let k = 0; k < 3; k++) {
        const s = wl.r * 2 * (1 - ((t * 0.01 + k / 3) % 1));
        b.draw(F.ring, wl.x, wl.y, s, s, t * 0.03 + k, 0.5, 1.2, 0.6, 0.35 * a, 1);
      }
      b.draw(F.core, wl.x, wl.y, 16, 16, 0, 1.4, 0.6, 2, a, 1);
    }
  }

  /** Hazard telegraphs + boss fx: over entities, under bullets. */
  renderOver(b, alpha) {
    const F = this.F, t = this.w.t;
    const blink = (t >> 2) & 1 ? 1 : 0.55;
    for (const h of this.hazards) {
      const c = h.color, warn = h.t < h.warn, k = warn ? h.t / h.warn : 1;
      const live = !warn && h.t < h.warn + h.fire;
      const fade = warn ? 1 : Math.max(0, 1 - (h.t - h.warn - h.fire) / (h.linger || 10));
      switch (h.type) {
        case 'circle': {
          if (warn) {
            b.draw(F.glow, h.x, h.y, h.r * 2 * k, h.r * 2 * k, 0, c[0], c[1], c[2], 0.25 * blink, 1);
            b.draw(F.ring, h.x, h.y, h.r * 2.1, h.r * 2.1, t * 0.05, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 0.7 * blink, 1);
            b.draw(F.ring, h.x, h.y, h.r * 2.1 * (1 - k), h.r * 2.1 * (1 - k), 0, 2, 2, 2, 0.5, 1);
            b.draw(F.laser, h.x, h.y, h.r * 1.2, 3, 0, c[0] * 2, c[1] * 2, c[2] * 2, 0.6, 1);
            b.draw(F.laser, h.x, h.y, h.r * 1.2, 3, Math.PI / 2, c[0] * 2, c[1] * 2, c[2] * 2, 0.6, 1);
          } else b.draw(F.glow, h.x, h.y, h.r * 2.6, h.r * 2.6, 0, c[0] * 2, c[1] * 2, c[2] * 2, (live ? 0.9 : 0.5) * fade, 1);
          break;
        }
        case 'lane': {
          const y0 = h.y0 ?? 0, y1 = h.y1 ?? H, my = (y0 + y1) / 2, len = y1 - y0;
          if (warn) {
            b.draw(F.white, h.x, my, h.w, len, 0, c[0], c[1], c[2], 0.08 + 0.12 * k * blink, 1);
            for (const s of [-1, 1]) b.draw(F.laser, h.x + s * h.w / 2, my, len, 4, Math.PI / 2, c[0] * 2, c[1] * 2, c[2] * 2, 0.7 * blink, 1);
          } else if (h.lethal) b.draw(F.white, h.x, my, h.w, len, 0, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, (live ? 0.35 : 0.15) * fade, 1);
          break;
        }
        case 'arc': {
          const n = 14;
          if (warn) {
            for (let s = 0; s <= n; s++) {
              const a = h.a0 + (h.a1 - h.a0) * (s / n);
              b.draw(F.glow, h.cx + Math.cos(a) * h.r, h.cy + Math.sin(a) * h.r, 18, 18, 0, c[0] * 2, c[1] * 2, c[2] * 2, 0.6 * blink, 1);
            }
            for (const a of [h.a0, h.a1]) b.draw(F.laser, h.cx + Math.cos(a) * h.r / 2, h.cy + Math.sin(a) * h.r / 2, h.r, 3, a, c[0] * 2, c[1] * 2, c[2] * 2, 0.6 * blink, 1);
          } else {
            const kk = Math.min(1, (h.t - h.warn) / Math.max(1, h.fire));
            for (let s = 0; s < 5; s++) {
              const a = h.a0 + (h.a1 - h.a0) * Math.max(0, kk - s * 0.04);
              b.draw(F.laser, h.cx + Math.cos(a) * h.r / 2, h.cy + Math.sin(a) * h.r / 2, h.r, 26 - s * 4, a, c[0] * 2, c[1] * 2, c[2] * 2, (0.9 - s * 0.16) * fade, 1);
            }
          }
          break;
        }
        case 'tendril': {
          const len = Math.hypot(h.x1 - h.x0, h.y1 - h.y0), ang = Math.atan2(h.y1 - h.y0, h.x1 - h.x0);
          if (warn) {
            b.draw(F.laser, (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, len, 3, ang, 1.2, 0.3, 1.4, 0.5 * blink, 1);
          } else {
            const kk = smooth((h.t - h.warn) / 8) * fade;
            const segs = Math.ceil((len * kk) / 22);
            for (let s = 0; s < segs; s++) {
              const d = s * 22, wob = Math.sin(t * 0.3 + s * 0.8) * 4;
              const x = h.x0 + Math.cos(ang) * d - Math.sin(ang) * wob, y = h.y0 + Math.sin(ang) * d + Math.cos(ang) * wob;
              const sz = (h.width || 12) * 2.2 * (1 - s / (segs + 4));
              b.draw(F.tendril, x, y, 28, sz, ang, 1, 1, 1, 1, 0);
            }
          }
          break;
        }
      }
    }
    // Shield bubble (barriers; dives draw their own submerged look).
    const c = this.c;
    if (c.shield > 0 && c.state === 'fight' && !c.data.submerged) {
      const e = c.e, x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      b.draw(F.ring, x, y, e.r * 2.8, e.r * 2.8, t * 0.02, 0.5, 0.9, 1.6, 0.35 + 0.1 * Math.sin(t * 0.3), 1);
    }
    for (const f of this.fx) f.draw(b, F, f);
  }
}

