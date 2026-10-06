import { WORLD_W, WORLD_H, GRAZE_RADIUS } from '../core/constants.js';
import { SpatialGrid } from '../core/SpatialGrid.js';
import { Pool } from '../core/Pool.js';
import { BulletSystem } from './BulletSystem.js';
import { Particles, FADE_OUT } from '../fx/Particles.js';
import { Explosions } from '../fx/Explosions.js';
import { Player } from './Player.js';
import { KIND_SPLIT, splitBullet } from '../patterns/index.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT } from '../core/damage.js';

// The gameplay world: every live object of a play session plus the API that
// pilots, enemies and scenes use to interact (damage, cancel, beams, items).
//
// Scenes own presentation (parallax, HUD, menus); the World owns rules.

export { GRAZE_RADIUS };
export const COLLECT_LINE = 170;      // above this line, items auto-collect
export const SHOT_NORMAL = 0;
export const SHOT_FLAK = 1;           // bursts for area damage on hit/expiry (aux = radius)

const MAX_POWER_BONUS = 1000;

export class World {
  constructor(game) {
    this.g = game;
    const r = game.renderer;
    this.r = r;
    this.F = {
      glow: r.frame('glow'), core: r.frame('core'), ring: r.frame('ring'), white: r.frame('white'),
      spark: r.frame('spark'), laser: r.frame('laser'), hitbox: r.frame('hitbox'), slash: r.frame('slash'),
      items: { P: r.frame('item_P'), B: r.frame('item_B'), S: r.frame('item_S'), L: r.frame('item_L'), M: r.frame('item_M') },
    };
    this.BF = r.bulletFrames;
    this.rng = game.rng;
    this.fxRng = game.fxRng;

    this.bullets = new BulletSystem(6000);   // enemy
    this.shots = new BulletSystem(1800);     // player
    this.shots.onExpire = (i) => { if (this.shots.kind[i] === SHOT_FLAK) this._flakBurst(i); };
    this.bullets.onExpire = (i) => { if (this.bullets.kind[i] === KIND_SPLIT) splitBullet(this, i); };
    this.lasers = [];        // telegraphed enemy lasers
    /** Difficulty scaling applied by the pattern library and enemy factory. */
    this.diff = { density: 1, speed: 1, fireRate: 1 };
    this.boss = null;        // enemy shown on the boss HP bar
    this.spawned = 0;        // enemies spawned (for kill-rate tallies)
    this.fxLow = new Particles(5000);
    this.fxHigh = new Particles(16000);
    this.explosions = new Explosions(game, this.fxLow, this.fxHigh);
    this.bulletGrid = new SpatialGrid(WORLD_W, WORLD_H, 32, 6000, 6000);
    this.enemyGrid = new SpatialGrid(WORLD_W, WORLD_H, 48, 256, 2048);
    this.enemies = new Pool(() => ({}), 64);
    this.items = new Pool(() => ({}), 128);
    this.beams = [];
    this._beamPool = [];

    this.player = null;
    this._score = 0;
    this.scoreMul = 1;      // difficulty score multiplier (applied to every gain)
    this.graze = 0;
    this.kills = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.maxChain = 0;
    this.medalValue = 100;
    this.autoCollect = 0;
    this.decoy = null;      // {x, y} when the player is cloaked
    this.t = 0;
    /** Scene hook: (type, data) for banners, cut-ins, game over... */
    this.onEvent = null;
  }

  event(type, data) { if (this.onEvent) this.onEvent(type, data); }

  // Score: every `score += n` gain is scaled by the difficulty multiplier.
  get score() { return this._score; }
  set score(v) {
    const d = v - this._score;
    this._score = d > 0 ? this._score + Math.round(d * this.scoreMul) : v;
  }
  /** Set the score without the multiplier (continues). */
  setScoreRaw(v) { this._score = v; }

  setPlayer(def, opts) {
    this.player = new Player(this, def, opts);
    return this.player;
  }

  // ---------------------------------------------------------------- queries

  /** Point enemies should aim at (decoy while cloaked). */
  get aimX() { return this.decoy ? this.decoy.x : this.player ? this.player.x : WORLD_W / 2; }
  get aimY() { return this.decoy ? this.decoy.y : this.player ? this.player.y : WORLD_H; }

  aimAngle(x, y) { return Math.atan2(this.aimY - y, this.aimX - x); }

  nearestEnemy(x, y, maxDist = 1e9) {
    let best = null, bd = maxDist * maxDist;
    for (const e of this.enemies.active) {
      if (!e.alive || e.untargetable || e.y < -10) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ----------------------------------------------------------------- spawning

  /** Player shot. Returns index (or -1). Configure with shots.behave(i, ...). */
  shot(x, y, angle, speed, frame, damage = 1, radius = 5, scale = 1) {
    const i = this.shots.spawn(x, y, angle, speed, frame.id, 0, radius, scale);
    if (i >= 0) this.shots.damage[i] = damage;
    return i;
  }

  /** Register a damaging beam for this step only (re-declare every step). */
  beam(x0, y0, x1, y1, width, damage, rgb, add = 1, flags = 0) {
    const b = this._beamPool.pop() || {};
    b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1;
    b.w = width; b.dmg = damage; b.rgb = rgb; b.add = add; b.flags = flags;
    this.beams.push(b);
    return b;
  }

  spawnEnemy(props) {
    const e = this.enemies.obtain();
    e.kind = 'enemy'; e.r = 14; e.hp = 10; e.t = 0; e.flash = 0; e.rot = 0; e.scale = 1;
    e.score = 100; e.ult = 1.5; e.blast = 0.7; e.drops = null; e.ai = null; e.f = null;
    e.untargetable = false; e.glow = null; e.lastBomb = -1; e.onDeath = null; e.data = {};
    e.ground = false; e.f2 = null; e.rot2 = 0; e.elite = false; e.armor = 1; e.entered = false;
    e.boss = false; e.def = null; e.name = ''; e.onDamage = null; e.ctrl = null;
    Object.assign(e, props);
    e.maxHp = e.hp;
    this.spawned++;
    e.px = e.x; e.py = e.y;
    return e;
  }

  spawnItem(kind, x, y, spread = 1) {
    const it = this.items.obtain();
    it.kind = kind; it.x = it.px = x; it.y = it.py = y;
    it.vx = this.fxRng.range(-1.2, 1.2) * spread;
    it.vy = this.fxRng.range(-3.6, -2.4);
    it.t = 0; it.magnet = false;
    return it;
  }

  // ------------------------------------------------------------ damage API

  /** `flags`: core/damage.js bitmask. Main bosses resolve them in e.onDamage (bosses/BossController). */
  damage(e, dmg, flags = 0) {
    if (!e.alive || e.untargetable) return;
    let armor = e.armor;
    if (e.onDamage) {
      dmg = e.onDamage(e, dmg, flags, this);
      if (!(dmg > 0)) return;
      armor = 1;
    } else if (flags & DMG_INSTANT) {
      dmg = Math.max(dmg, e.hp);
      armor = 1;
    } else if (flags & DMG_IGNORES_SHIELDS && armor < 1) armor = 1;
    e.hp -= dmg * armor;
    e.flash = 2;
    this.score += Math.ceil(dmg * 2);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    this.kills++;
    this.chain++;
    this.chainTimer = 120;
    if (this.chain > this.maxChain) this.maxChain = this.chain;
    this.score += Math.round(e.score * (1 + Math.min(this.chain, 100) * 0.05));
    if (e.blast > 0) this.explosions.blast(e.x, e.y, e.blast, e.blastTint || null);
    if (e.drops) for (const k of e.drops) this.spawnItem(k, e.x, e.y, e.drops.length > 3 ? 2 : 1);
    if (this.player) this.player.addUlt(e.ult);
    if (e.onDeath) e.onDeath(e, this);
    for (const L of this.lasers) if (L.owner === e) L.dead = true;
    this.event('kill', e);
  }

  damageCircle(x, y, r, dmg, flags = 0) {
    for (const e of this.enemies.active) {
      if (!e.alive || e.untargetable) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.r;
      if (dx * dx + dy * dy < rr * rr) this.damage(e, dmg, flags);
    }
  }

  /** Damage enemies near a segment. `once` (a bomb id) prevents repeat hits. */
  damageLine(x0, y0, x1, y1, width, dmg, once = -1, flags = 0) {
    for (const e of this.enemies.active) {
      if (!e.alive || e.untargetable || e.y < -20) continue;
      if (once >= 0 && e.lastBomb === once) continue;
      if (segDist2(e.x, e.y, x0, y0, x1, y1) < (width + e.r) ** 2) {
        if (once >= 0) e.lastBomb = once;
        this.damage(e, dmg, flags);
      }
    }
  }

  // ------------------------------------------------------- bullet cancelling

  _cancelFx = (x, y, c) => {
    this.score += 10;
    const H = this.fxHigh;
    const i = H.spawn(this.F.spark, x, y, this.fxRng.range(-1, 1), this.fxRng.range(-2.5, -0.5), 16);
    if (i >= 0) { H.size(i, 4); H.color(i, c[0] * 2, c[1] * 2, c[2] * 2, c[0], c[1], c[2]); H.look(i, 1, 1, FADE_OUT, 0.5); }
  };

  cancelAll() { this.bullets.clearAll(this._cancelFx); }
  cancelCircle(x, y, r) { this.bullets.clearRadius(x, y, r, this._cancelFx); }
  cancelLine(x0, y0, x1, y1, w) { this.bullets.clearLine(x0, y0, x1, y1, w, this._cancelFx); }

  // ------------------------------------------------------------------ update

  update() {
    this.t++;
    for (const b of this.beams) this._beamPool.push(b);
    this.beams.length = 0;
    if (this.chainTimer > 0 && --this.chainTimer === 0) this.chain = 0;
    if (this.autoCollect > 0) this.autoCollect--;

    if (this.player) this.player.update();

    for (const e of this.enemies.active) {
      if (!e.alive) continue;
      e.px = e.x; e.py = e.y;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.ai) e.ai(e, this);
      // Remove enemies that entered the field and then left it (or got stuck off-screen).
      const inside = e.x > -20 && e.x < WORLD_W + 20 && e.y > -20 && e.y < WORLD_H + 20;
      if (inside) e.entered = true;
      else if ((e.entered && (e.y > WORLD_H + 80 || e.y < -120 || e.x < -100 || e.x > WORLD_W + 100)) || e.t > 3600) e.alive = false;
    }

    this._steerShots();
    this._steerBullets();
    this._updateLasers();
    this.bullets.update();
    this.shots.update();
    this._collide();
    this.enemies.sweep();
    this._updateItems();
    this.items.sweep();
    this.explosions.update();
    this.fxLow.update();
    this.fxHigh.update();
  }

  _steerShots() {
    const S = this.shots;
    if (!this.enemies.count) return;
    for (let i = 0; i < S.count; i++) {
      const h = S.homing[i];
      if (h <= 0) continue;
      const tgt = this.nearestEnemy(S.x[i], S.y[i], 420);
      if (!tgt) continue;
      let d = Math.atan2(tgt.y - S.y[i], tgt.x - S.x[i]) - S.ang[i];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      S.setHeading(i, S.ang[i] + (d > h ? h : d < -h ? -h : d));
    }
  }

  /** Enemy homing bullets steer toward the aim point for `aux` steps. */
  _steerBullets() {
    const B = this.bullets, ax = this.aimX, ay = this.aimY;
    for (let i = 0; i < B.count; i++) {
      const h = B.homing[i];
      if (h <= 0 || B.age[i] > B.aux[i]) continue;
      let d = Math.atan2(ay - B.y[i], ax - B.x[i]) - B.ang[i];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      B.setHeading(i, B.ang[i] + (d > h ? h : d < -h ? -h : d));
    }
  }

  // ----------------------------------------------------------- enemy lasers

  /**
   * Telegraphed laser owned by enemy `owner`: a thin warning line for
   * `warn` steps, then a lethal beam for `fire` steps. Follows its owner.
   * opts: { warn, fire, width, len, ox, oy, angVel, track, rgb }
   */
  enemyLaser(owner, ang, o = {}) {
    const L = {
      owner, ang, t: 0, dead: false,
      warn: o.warn ?? 50, fire: o.fire ?? 60, width: o.width ?? 14, len: o.len ?? 900,
      ox: o.ox ?? 0, oy: o.oy ?? 0, angVel: o.angVel ?? 0, track: !!o.track,
      rgb: o.rgb || [1, 0.25, 0.45], x0: owner.x, y0: owner.y,
    };
    this.lasers.push(L);
    return L;
  }

  _updateLasers() {
    const p = this.player;
    for (const L of this.lasers) {
      if (!L.owner.alive) L.dead = true;
      if (L.dead) continue;
      L.t++;
      L.x0 = L.owner.x + L.ox;
      L.y0 = L.owner.y + L.oy;
      if (L.t < L.warn) {
        if (L.track) {
          let d = this.aimAngle(L.x0, L.y0) - L.ang;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          L.ang += d * 0.08;
        }
      } else {
        L.ang += L.angVel;
        if (L.t > L.warn + L.fire) { L.dead = true; continue; }
        if (L.fire > 0 && p && p.collidable && !p.invulnerable) {
          const x1 = L.x0 + Math.cos(L.ang) * L.len, y1 = L.y0 + Math.sin(L.ang) * L.len;
          if (segDist2(p.x, p.y, L.x0, L.y0, x1, y1) < (L.width * 0.35 + p.hitR) ** 2) p.hit();
        }
      }
    }
    if (this.lasers.length && this.lasers.some((L) => L.dead)) this.lasers = this.lasers.filter((L) => !L.dead);
  }

  clearLasers() { this.lasers.length = 0; }

  _flakBurst(i) {
    const S = this.shots, x = S.x[i], y = S.y[i], r = S.aux[i] || 24;
    this.damageCircle(x, y, r, S.damage[i], S.dflags[i]);
    const H = this.fxHigh, R = this.fxRng;
    let k = H.spawn(this.F.glow, x, y, 0, 0, 8);
    if (k >= 0) { H.size(k, r * 1.6, r * 2.2); H.color(k, 2, 1.1, 0.4, 1.2, 0.3, 0.05); H.look(k, 0.7, 1); }
    k = H.spawn(this.F.ring, x, y, 0, 0, 9);
    if (k >= 0) { H.size(k, r * 0.5, r * 2.2); H.color(k, 1.6, 0.9, 0.4); H.look(k, 0.5, 1); }
    for (let n = 0; n < 3; n++) {
      const a = R.angle(), sp = R.range(1, 3.5);
      k = H.spawn(this.F.spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(8, 14));
      if (k < 0) break;
      H.size(k, 3); H.color(k, 2, 1.4, 0.6, 1, 0.3, 0); H.phys(k, 0.9); H.look(k, 1, 1, FADE_OUT, 0.4);
    }
  }

  _collide() {
    const p = this.player, B = this.bullets, grid = this.bulletGrid;
    const E = this.enemies.active;

    // Enemy bullets vs player: hit + graze through the spatial hash.
    B.buildGrid(grid);
    if (p && p.collidable) {
      const n = grid.queryCircle(p.x, p.y, GRAZE_RADIUS + 10);
      const res = grid.results;
      let hit = false;
      for (let k = 0; k < n; k++) {
        const i = res[k];
        const dx = B.x[i] - p.x, dy = B.y[i] - p.y;
        const d2 = dx * dx + dy * dy;
        const rr = B.radius[i] + p.hitR;
        if (d2 < rr * rr && !p.invulnerable) { hit = true; break; }
        const gr = B.radius[i] + GRAZE_RADIUS;
        if (!B.grazed[i] && d2 < gr * gr) {
          B.grazed[i] = 1;
          this.graze++;
          this.score += 20;
          p.onGraze();
          this.explosions.sparks(B.x[i], B.y[i], 2, [0.8, 0.95, 1], 2.5, 10, 3);
        }
      }
      // Body contact with enemies.
      if (!hit && !p.invulnerable) {
        for (const e of E) {
          if (!e.alive || e.untargetable || e.ground) continue;
          const dx = e.x - p.x, dy = e.y - p.y, rr = e.r * 0.6 + p.hitR;
          if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
        }
      }
      if (hit) p.hit();
    }

    // Player shots vs enemies through the enemy grid.
    const eg = this.enemyGrid;
    eg.clear();
    for (let e = 0; e < E.length; e++) {
      const en = E[e];
      if (en.alive && !en.untargetable) eg.insertAABB(e, en.x - en.r, en.y - en.r, en.x + en.r, en.y + en.r);
    }
    const S = this.shots;
    let i = 0;
    while (i < S.count) {
      const sx = S.x[i], sy = S.y[i], sr = S.radius[i];
      const m = eg.queryCircle(sx, sy, sr);
      let consumed = false;
      for (let k = 0; k < m; k++) {
        const en = E[eg.results[k]];
        if (!en.alive || en.y < -10) continue;
        const dx = en.x - sx, dy = en.y - sy, rr = en.r + sr;
        if (dx * dx + dy * dy >= rr * rr) continue;
        if (S.kind[i] === SHOT_FLAK) { this._flakBurst(i); consumed = true; break; }
        this.damage(en, S.damage[i], S.dflags[i]);
        if (!S.pierce[i]) {
          this.explosions.hitSpark(sx, sy - 4, Math.PI / 2, [0.6, 0.9, 1]);
          consumed = true;
          break;
        } else if ((this.t + i) % 4 === 0) {
          this.explosions.hitSpark(sx, sy, S.ang[i] + Math.PI, [0.6, 0.9, 1]);
        }
      }
      if (consumed) S.remove(i); else i++;
    }

    // Beams vs enemies.
    for (const b of this.beams) {
      if (b.dmg <= 0) continue;
      for (const e of E) {
        if (!e.alive || e.untargetable || e.y < -10) continue;
        if (segDist2(e.x, e.y, b.x0, b.y0, b.x1, b.y1) < (b.w * 0.5 + e.r) ** 2) {
          this.damage(e, b.dmg, b.flags);
          if ((this.t & 3) === 0) this.explosions.hitSpark(e.x + this.fxRng.range(-6, 6), e.y + e.r * 0.6, Math.PI / 2, b.rgb);
        }
      }
    }
  }

  _updateItems() {
    const p = this.player;
    const canCollect = p && p.state === 'alive';
    const magR = p && p.focus ? 70 : 40;
    for (const it of this.items.active) {
      it.px = it.x; it.py = it.y;
      it.t++;
      if (canCollect) {
        const dx = p.x - it.x, dy = p.y - it.y;
        const d = Math.hypot(dx, dy);
        if (d < 20) { this._collect(it); continue; }
        if (it.magnet || this.autoCollect > 0 || p.y < COLLECT_LINE || d < magR) it.magnet = true;
        if (it.magnet) {
          const sp = 11 / (d || 1);
          it.vx = dx * sp; it.vy = dy * sp;
        }
      } else it.magnet = false;
      if (!it.magnet) {
        it.vy = Math.min(it.vy + 0.08, 1.7);
        it.vx *= 0.95;
      }
      it.x += it.vx;
      it.y += it.vy;
      if (it.x < 8) { it.x = 8; it.vx = Math.abs(it.vx); }
      if (it.x > WORLD_W - 8) { it.x = WORLD_W - 8; it.vx = -Math.abs(it.vx); }
      if (it.y > WORLD_H + 20) {
        it.alive = false;
        if (it.kind === 'M') this.medalValue = 100; // dropped a medal: chain broken
      }
    }
  }

  _collect(it) {
    it.alive = false;
    const p = this.player;
    switch (it.kind) {
      case 'P':
        if (p.power >= 400) this.score += MAX_POWER_BONUS;
        else p.addPower(25);
        break;
      case 'B': p.bombs = Math.min(8, p.bombs + 1); break;
      case 'S':
        if (p.speedLevel < 3) p.speedLevel++;
        else this.score += 2000;
        this.event('speed', p.speedLevel);
        break;
      case 'L': p.lives = Math.min(8, p.lives + 1); this.event('extend'); break;
      case 'M':
        this.score += this.medalValue;
        this.event('medal', this.medalValue);
        this.medalValue = Math.min(10000, this.medalValue + 100);
        break;
    }
    this.explosions.sparks(it.x, it.y, 4, [1, 0.9, 0.5], 2, 12, 3);
    this.event('item', it.kind);
  }

  // ------------------------------------------------------------------ render

  _drawEnemy(b, e, alpha) {
    if (!e.f) return;
    const F = this.F;
    const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
    const w = e.f.w * e.scale, h = e.f.h * e.scale;
    if (e.elite) {
      const pulse = 0.5 + 0.3 * Math.sin(e.t * 0.2);
      b.draw(F.glow, x, y, w * 2.4, h * 2.4, 0, 1.4, 0.15, 0.2, pulse, 1);
    } else if (e.glow) b.draw(F.glow, x, y, w * 2, h * 2, 0, e.glow[0], e.glow[1], e.glow[2], 0.35, 1);
    b.draw(e.f, x, y, w, h, e.rot, 1, 1, 1, 1, 0);
    if (e.f2) b.draw(e.f2, x, y, e.f2.w * e.scale, e.f2.h * e.scale, e.rot2, 1, 1, 1, 1, 0);
    if (e.flash > 0) b.draw(e.f, x, y, w, h, e.rot, 1.5, 1.5, 1.5, 0.8, 1);
  }

  /** Ground units: drawn under foreground structures and air units. */
  renderGround(b, alpha) {
    for (const e of this.enemies.active) if (e.ground) this._drawEnemy(b, e, alpha);
  }

  _renderLasers(b) {
    const F = this.F;
    for (const L of this.lasers) {
      if (L.dead) continue;
      const len = L.len, c = L.rgb;
      const mx = L.x0 + Math.cos(L.ang) * len / 2, my = L.y0 + Math.sin(L.ang) * len / 2;
      if (L.t < L.warn) {
        // Telegraph: thin flickering line that tightens as it's about to fire.
        const k = L.t / L.warn;
        const a = ((L.t >> 2) & 1 ? 0.7 : 0.35) * (0.5 + k * 0.5);
        b.draw(F.laser, mx, my, len, 3 + (1 - k) * 4, L.ang, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, a, 1);
        b.draw(F.glow, L.x0, L.y0, 20 + k * 20, 20 + k * 20, 0, c[0] * 2, c[1] * 2, c[2] * 2, 0.6 * k, 1);
      } else if (L.fire > 0) {
        const ft = L.t - L.warn;
        const ramp = Math.min(1, ft / 5, (L.fire - ft) / 8);
        const wv = L.width * ramp * (0.92 + 0.08 * Math.sin(L.t * 1.9));
        b.draw(F.laser, mx, my, len, wv * 3, L.ang, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 0.8, 1);
        b.draw(F.laser, mx, my, len, wv, L.ang, 2.2, 2.2, 2.2, 1, 1);
        b.draw(F.glow, L.x0, L.y0, wv * 5, wv * 5, 0, c[0] * 2, c[1] * 2, c[2] * 2, 0.9, 1);
      }
    }
  }

  /** Everything between the parallax and the enemy-bullet layer. */
  renderMid(b, alpha) {
    const F = this.F, frames = this.r.frames;
    this.fxLow.render(b, frames, alpha);

    for (const e of this.enemies.active) if (!e.ground) this._drawEnemy(b, e, alpha);

    for (const it of this.items.active) {
      const x = it.px + (it.x - it.px) * alpha, y = it.py + (it.y - it.py) * alpha;
      const f = F.items[it.kind];
      const pulse = 0.8 + 0.2 * Math.sin(it.t * 0.2);
      b.draw(F.glow, x, y, 34 * pulse, 34 * pulse, 0, 1, 0.9, 0.6, 0.25, 1);
      const sx = it.kind === 'M' ? Math.max(0.15, Math.abs(Math.cos(it.t * 0.12))) : 1;
      b.draw(f, x, y, f.w * sx, f.h, 0, 1, 1, 1, 1, 0);
    }

    // Player shots stay translucent so enemy bullets always read on top.
    this.shots.render(b, frames, alpha, F.glow, { glowAlpha: 0, alpha: 0.5, add: 1 });

    for (const bm of this.beams) {
      const dx = bm.x1 - bm.x0, dy = bm.y1 - bm.y0;
      const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const mx = (bm.x0 + bm.x1) / 2, my = (bm.y0 + bm.y1) / 2;
      const fl = 0.9 + 0.1 * Math.sin(this.t * 1.7 + len);
      const c = bm.rgb;
      b.draw(F.laser, mx, my, len, bm.w * 2.6 * fl, ang, c[0], c[1], c[2], 0.55, bm.add);
      b.draw(F.laser, mx, my, len, bm.w * 0.9 * fl, ang, 1.6, 1.6, 1.6, 0.9, bm.add);
    }

    if (this.player) this.player.render(b, alpha);
    this.fxHigh.render(b, frames, alpha);
    if (this.player) this.player.renderFx(b, alpha);
  }

  /** Enemy bullets + player hitbox (always topmost world layer). */
  renderTop(b, alpha) {
    this._renderLasers(b);
    this.bullets.render(b, this.r.frames, alpha, this.F.glow);
    if (this.player) this.player.renderTop(b, alpha);
  }
}

/** Squared distance from point (px,py) to segment (x0,y0)-(x1,y1). */
export function segDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  let t = ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = x0 + dx * t - px, ey = y0 + dy * t - py;
  return ex * ex + ey * ey;
}
