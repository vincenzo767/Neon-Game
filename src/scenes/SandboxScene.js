import { WORLD_W, WORLD_H } from '../core/constants.js';
import { SpatialGrid } from '../core/SpatialGrid.js';
import { Pool } from '../core/Pool.js';
import { BulletSystem } from '../entities/BulletSystem.js';
import { Particles, FADE_OUT } from '../fx/Particles.js';
import { Explosions } from '../fx/Explosions.js';
import { COLOR_NAMES } from '../fx/sprites.js';

// M1 ENGINE SANDBOX
// A stress/feel test that exercises every engine system: fixed-step loop,
// input, instanced rendering, pooling, spatial-hash collision, camera
// shake, hit-stop, layered explosions and the full post-FX chain.
// Replaced by the real stage flow in M2/M3, but kept as a dev scene.

const PLAYER_SPEED = 4.6;
const PLAYER_FOCUS_SPEED = 2.0;
const HIT_RADIUS = 2.5;
const GRAZE_RADIUS = 22;
const DENSITY = [
  { arms: 6, label: 'LOW' },
  { arms: 12, label: 'MED' },
  { arms: 22, label: 'HIGH' },
  { arms: 34, label: 'MANIC' },
];
const C = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i]));
const TAU = Math.PI * 2;

export class SandboxScene {
  enter(game) {
    this.g = game;
    const r = game.renderer;
    this.F = {
      ship: r.frame('ship_test'), glow: r.frame('glow'), core: r.frame('core'),
      hitbox: r.frame('hitbox'), ring: r.frame('ring'), pshot: r.frame('pshot'),
      drone: r.frame('drone'), emitter: r.frame('emitter'), girder: r.frame('girder'),
      roofs: [0, 1, 2].map((i) => r.frame(`roof${i}`)), holo: r.frame('holo'),
      beam: r.frame('beam'), rain: r.frame('rain'), white: r.frame('white'), spark: r.frame('spark'),
    };
    this.BF = r.bulletFrames;

    this.bullets = new BulletSystem(6000);
    this.shots = new BulletSystem(600);
    this.fxLow = new Particles(4000);
    this.fxHigh = new Particles(14000);
    this.explosions = new Explosions(game, this.fxLow, this.fxHigh);
    this.bulletGrid = new SpatialGrid(WORLD_W, WORLD_H, 32, 6000, 6000);
    this.enemyGrid = new SpatialGrid(WORLD_W, WORLD_H, 48, 128, 1024);
    this.enemies = new Pool(() => ({}), 32);

    this.player = {
      x: WORLD_W / 2, y: WORLD_H - 80, px: WORLD_W / 2, py: WORLD_H - 80,
      bank: 0, fireCd: 0, invuln: 120, bombCd: 0, focus: false,
    };
    this.density = 1;
    this.t = 0;
    this.graze = 0;
    this.kills = 0;
    this.hits = 0;
    this.coreRespawn = 0;

    this._initParallax();
    this._spawnCore();
    this._buildHud();
    this._banner('SYSTEM CHECK', 'M1 ENGINE SANDBOX', 150);
  }

  exit() { this.g.hud.innerHTML = ''; }

  // ------------------------------------------------------------------ HUD

  _buildHud() {
    this.g.hud.innerHTML = `
      <div class="hud-banner" id="banner"></div>
      <div class="hud-hint">
        <b>ARROWS</b> move · <b>Z</b> shot · <b>SHIFT</b> focus · <b>X</b> bomb · <b>C</b> blast · <b>V</b> break-apart<br>
        <b>1-4</b> density · <b>T</b> CRT · <b>G</b> quality · <b>H</b> shake · <b>R</b> reset · <b>\`</b> stats
      </div>`;
    this.bannerEl = this.g.hud.querySelector('#banner');
    this.bannerT = 0;
  }

  _banner(title, sub, steps) {
    this.bannerEl.innerHTML = `${title}<small>${sub}</small>`;
    this.bannerEl.classList.add('show');
    this.bannerT = steps;
  }

  // ------------------------------------------------------------- parallax

  _initParallax() {
    const R = this.g.fxRng;
    this.structs = [];
    this.structTimer = 0;
    this.traffic = [];
    for (let i = 0; i < 14; i++) this.traffic.push(this._newCar(R.range(0, WORLD_H)));
    this.rain = [];
    for (let i = 0; i < 140; i++) {
      this.rain.push({ x: R.range(-40, WORLD_W + 40), y: R.range(-40, WORLD_H), v: R.range(11, 16), a: R.range(0.05, 0.14) });
    }
    // Pre-seed a few structures so the first frame isn't empty.
    for (let y = -80; y < WORLD_H; y += 190) this._spawnStruct(y);
  }

  _newCar(y) {
    const R = this.g.fxRng;
    const lane = R.int(0, 5);
    const up = lane % 2 === 0;
    return {
      x: 40 + lane * 80 + R.range(-10, 10),
      y,
      vy: up ? R.range(-1.2, -0.4) : R.range(1.6, 2.6), // relative to scroll
      col: R.pick([[0.3, 0.9, 1], [1, 0.3, 0.8], [1, 0.75, 0.3]]),
    };
  }

  _spawnStruct(y) {
    const R = this.g.fxRng;
    const kind = R.next();
    if (kind < 0.35) {
      this.structs.push({ f: this.F.girder, x: R.range(120, 360), y, rot: R.range(-0.25, 0.25), s: 1.3, a: 0.95, add: 0 });
    } else if (kind < 0.8) {
      const left = R.chance(0.5);
      this.structs.push({ f: R.pick(this.F.roofs), x: left ? R.range(-20, 50) : R.range(WORLD_W - 50, WORLD_W + 20), y, rot: 0, s: 1, a: 0.95, add: 0 });
      if (R.chance(0.6)) {
        this.structs.push({ f: this.F.holo, x: left ? 70 : WORLD_W - 70, y: y + R.range(-20, 20), rot: 0, s: 1, a: 0.7, add: 1, holo: true });
      }
    }
  }

  _updateParallax() {
    const FG_SPEED = 2.6, MID_SPEED = 1.3;
    for (const s of this.structs) s.y += FG_SPEED;
    this.structs = this.structs.filter((s) => s.y < WORLD_H + 140);
    if (--this.structTimer <= 0) {
      this._spawnStruct(-120);
      this.structTimer = this.g.fxRng.int(50, 90);
    }
    for (let i = 0; i < this.traffic.length; i++) {
      const c = this.traffic[i];
      c.y += MID_SPEED + c.vy;
      if (c.y > WORLD_H + 30 || c.y < -60) this.traffic[i] = this._newCar(c.vy + MID_SPEED > 0 ? -40 : WORLD_H + 20);
    }
    for (const d of this.rain) {
      d.y += d.v; d.x -= d.v * 0.12;
      if (d.y > WORLD_H + 30) { d.y = -30; d.x = this.g.fxRng.range(-20, WORLD_W + 60); }
    }
  }

  // ---------------------------------------------------------------- enemies

  _spawnCore() {
    const e = this.enemies.obtain();
    Object.assign(e, {
      kind: 'core', x: WORLD_W / 2, y: -60, px: WORLD_W / 2, py: -60, r: 26,
      hp: 900, maxHp: 900, t: 0, flash: 0, angle: 0, phase: 0,
    });
  }

  _spawnDroneWave() {
    const R = this.g.rng;
    const fromLeft = R.chance(0.5);
    for (let k = 0; k < 4; k++) {
      const e = this.enemies.obtain();
      const x = fromLeft ? 60 + k * 40 : WORLD_W - 60 - k * 40;
      Object.assign(e, {
        kind: 'drone', x, y: -30 - k * 30, px: x, py: -30 - k * 30, r: 14,
        hp: 14, maxHp: 14, t: -k * 12, flash: 0, baseX: x, fireT: 40 + k * 10, dir: fromLeft ? 1 : -1,
      });
    }
  }

  _updateEnemies() {
    const p = this.player;
    const R = this.g.rng;
    let drones = 0;
    for (const e of this.enemies.active) {
      e.px = e.x; e.py = e.y;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.kind === 'core') this._updateCore(e);
      else {
        drones++;
        // Swoop in, sway, then leave downward.
        if (e.t < 70) e.y += 2.2;
        else if (e.t < 520) e.x = e.baseX + Math.sin((e.t - 70) * 0.03) * 40 * e.dir;
        else e.y += 1.8;
        if (e.y > WORLD_H + 40) e.alive = false;
        if (e.t > 60 && --e.fireT <= 0 && e.t < 520) {
          e.fireT = 70;
          const aim = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = -1; k <= 1; k++) {
            this.bullets.spawn(e.x, e.y + 8, aim + k * 0.18, 3.2, this.BF.kunai.red, C.red, 3);
          }
        }
      }
    }
    if (drones === 0 && R.chance(0.02)) this._spawnDroneWave();
    if (this.coreRespawn > 0 && --this.coreRespawn === 0) this._spawnCore();
  }

  _updateCore(e) {
    if (e.t < 90) { e.y += (150 - e.y) * 0.04; return; }
    const t = e.t;
    e.x = WORLD_W / 2 + Math.sin(t * 0.009) * 110;
    e.y = 150 + Math.sin(t * 0.017) * 26;
    const B = this.bullets, BF = this.BF;
    const d = DENSITY[this.density];

    // Layer 1: rotating multi-arm orb spiral.
    if (t % 3 === 0) {
      e.angle += 0.13;
      const n = d.arms;
      for (let k = 0; k < n; k++) {
        const a = e.angle + (k / n) * TAU;
        const col = k % 2 ? C.pink : C.violet;
        B.spawn(e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, a, 2.3, BF.orb[COLOR_NAMES[col]], col, 3.2);
      }
    }
    // Layer 2: counter-rotating curving rice, decelerate then re-accelerate.
    if (t % 7 === 0) {
      const n = Math.max(4, d.arms >> 1);
      for (let k = 0; k < n; k++) {
        const a = -e.angle * 0.7 + (k / n) * TAU;
        const i = B.spawn(e.x, e.y, a, 4.2, BF.rice.cyan, C.cyan, 2.5);
        if (i >= 0) B.motion(i, -0.05, 0.006, 1.6, 4.2);
      }
    }
    // Layer 3 (HIGH+): slow aimed rings of big orbs.
    if (this.density >= 2 && t % 50 === 0) {
      const p = this.player;
      const aim = Math.atan2(p.y - e.y, p.x - e.x);
      for (let k = 0; k < 16; k++) {
        B.spawn(e.x, e.y, aim + (k / 16) * TAU, 1.5, BF.bigorb.orange, C.orange, 7);
      }
    }
    // Layer 4 (MANIC): yellow rain curtain from the top edge.
    if (this.density >= 3 && t % 4 === 0) {
      const x = this.g.rng.range(10, WORLD_W - 10);
      B.spawn(x, -10, Math.PI / 2 + this.g.rng.range(-0.1, 0.1), this.g.rng.range(2.5, 3.5), BF.orb.yellow, C.yellow, 2.5, 0.8);
    }
  }

  _killEnemy(e) {
    e.alive = false;
    this.kills++;
    if (e.kind === 'core') {
      this.explosions.breakApart(e.x, e.y, 34, 7);
      this.bullets.clearAll((x, y, c) => this.explosions.sparks(x, y, 1, c, 2, 16, 4));
      this.coreRespawn = 260;
      this._banner('CORE DOWN', 'BREAK-APART SEQUENCE', 110);
    } else {
      this.explosions.blast(e.x, e.y, 0.7);
      this.g.hitStop(1);
    }
  }

  // ----------------------------------------------------------------- player

  _updatePlayer() {
    const p = this.player, inp = this.g.input, ex = this.explosions;
    p.px = p.x; p.py = p.y;
    p.focus = inp.down('focus');
    const sp = p.focus ? PLAYER_FOCUS_SPEED : PLAYER_SPEED;
    p.x = Math.min(WORLD_W - 14, Math.max(14, p.x + inp.moveX * sp));
    p.y = Math.min(WORLD_H - 20, Math.max(24, p.y + inp.moveY * sp));
    p.bank += (inp.moveX - p.bank) * 0.2;
    if (p.invuln > 0) p.invuln--;
    if (p.bombCd > 0) p.bombCd--;

    // Shooting.
    if (p.fireCd > 0) p.fireCd--;
    if (inp.down('shot') && p.fireCd === 0) {
      p.fireCd = 4;
      const up = -Math.PI / 2;
      const spread = p.focus ? 0.03 : 0.14;
      const id = this.F.pshot.id;
      for (let k = -2; k <= 2; k++) {
        const off = p.focus ? k * 5 : k * 7;
        this.shots.spawn(p.x + off, p.y - 18, up + k * spread, 15, id, C.cyan, 6, 0.8);
      }
    }

    // Engine exhaust.
    const H = this.fxHigh, R = this.g.fxRng;
    for (const side of [-5, 5]) {
      const i = H.spawn(this.F.glow, p.x + side, p.y + 22, R.range(-0.2, 0.2), R.range(2.5, 4), R.range(8, 14));
      if (i >= 0) {
        H.size(i, R.range(9, 12), 2);
        H.color(i, 0.8, 1.6, 2.4, 0.3, 0.2, 1.2);
        H.look(i, 0.8, 1, FADE_OUT);
      }
    }

    // Bomb.
    if (inp.pressed('bomb') && p.bombCd === 0) this._bomb();

    // Dev FX triggers.
    if (inp.pressed('special')) {
      ex.blast(this.g.fxRng.range(60, WORLD_W - 60), this.g.fxRng.range(80, 360), this.g.fxRng.range(0.6, 2.4));
    }
    if (inp.pressed('ultimate')) {
      ex.breakApart(this.g.fxRng.range(120, WORLD_W - 120), this.g.fxRng.range(140, 300), 40, 6);
    }
  }

  _bomb() {
    const p = this.player, post = this.g.renderer.post, ex = this.explosions;
    p.bombCd = 90;
    p.invuln = Math.max(p.invuln, 90);
    // Cancel every bullet into sparks.
    this.bullets.clearAll((x, y, c) => ex.sparks(x, y, 1, c, 2.5, 20, 4));
    for (const e of this.enemies.active) {
      e.hp -= 60; e.flash = 6;
      if (e.hp <= 0 && e.alive) this._killEnemy(e);
    }
    ex.blast(p.x, p.y - 60, 1.4, [0.3, 0.8, 1.0]);
    post.shockwave(p.x, p.y, 0.07, 0.022, 1.2);
    post.flash(0.7, 0.95, 1.0, 0.7, 0.035);
    post.aberrate(0.03);
    this.g.camera.addTrauma(0.6);
    this.g.hitStop(6);
    this.g.input.rumble(1, 0.6, 400);
  }

  _playerHit() {
    const p = this.player, post = this.g.renderer.post, ex = this.explosions;
    this.hits++;
    ex.blast(p.x, p.y, 1.6, [0.4, 0.8, 1.0]);
    this.bullets.clearRadius(p.x, p.y, 140, (x, y, c) => ex.sparks(x, y, 1, c, 2, 14, 4));
    post.flash(1, 0.15, 0.25, 0.55, 0.05);
    post.aberrate(0.04);
    this.g.camera.addTrauma(0.7);
    this.g.camera.kick(0, 10);
    this.g.hitStop(10);
    this.g.input.rumble(1, 1, 300);
    p.invuln = 150;
  }

  // ------------------------------------------------------------- collision

  _collide() {
    const p = this.player, B = this.bullets, grid = this.bulletGrid;

    // Enemy bullets vs player (hit + graze) via spatial hash.
    B.buildGrid(grid);
    const reach = GRAZE_RADIUS + 8;
    const n = grid.queryCircle(p.x, p.y, reach);
    const res = grid.results;
    let hit = false;
    for (let k = 0; k < n; k++) {
      const i = res[k];
      const dx = B.x[i] - p.x, dy = B.y[i] - p.y;
      const d2 = dx * dx + dy * dy;
      const rr = B.radius[i] + HIT_RADIUS;
      if (d2 < rr * rr) { hit = true; break; }
      const gr = B.radius[i] + GRAZE_RADIUS;
      if (!B.grazed[i] && d2 < gr * gr) {
        B.grazed[i] = 1;
        this.graze++;
        this.explosions.sparks(B.x[i], B.y[i], 2, [0.8, 0.95, 1], 2.5, 10, 3);
      }
    }
    if (hit && p.invuln === 0) this._playerHit();

    // Player shots vs enemies via enemy grid.
    const eg = this.enemyGrid, E = this.enemies.active;
    eg.clear();
    for (let e = 0; e < E.length; e++) {
      const en = E[e];
      eg.insertAABB(e, en.x - en.r, en.y - en.r, en.x + en.r, en.y + en.r);
    }
    const S = this.shots;
    let i = 0;
    while (i < S.count) {
      const sx = S.x[i], sy = S.y[i];
      const m = eg.queryCircle(sx, sy, S.radius[i]);
      let consumed = false;
      for (let k = 0; k < m; k++) {
        const en = E[eg.results[k]];
        if (!en.alive || en.y < 0) continue;
        const dx = en.x - sx, dy = en.y - sy, rr = en.r + S.radius[i];
        if (dx * dx + dy * dy < rr * rr) {
          en.hp -= S.damage[i];
          en.flash = 2;
          this.explosions.hitSpark(sx, sy - 4, Math.PI / 2, [0.5, 0.9, 1]);
          if (en.hp <= 0) this._killEnemy(en);
          consumed = true;
          break;
        }
      }
      if (consumed) S.remove(i); else i++;
    }
  }

  // ------------------------------------------------------------------ update

  update() {
    const g = this.g, inp = g.input;
    this.t++;

    // Dev toggles (raw keys, not remappable).
    for (let k = 0; k < 4; k++) {
      if (inp.keyPressed(`Digit${k + 1}`)) {
        this.density = k;
        this._banner(`DENSITY ${DENSITY[k].label}`, 'BULLET STRESS TEST', 70);
      }
    }
    if (inp.keyPressed('KeyT')) g.settings.set('crt', !g.settings.data.crt);
    if (inp.keyPressed('KeyG')) {
      const order = ['high', 'medium', 'low'];
      const q = order[(order.indexOf(g.settings.data.quality) + 1) % 3];
      g.settings.set('quality', q);
      this._banner(`QUALITY ${q.toUpperCase()}`, 'RENDER SCALE', 60);
    }
    if (inp.keyPressed('KeyH')) {
      const levels = [0, 0.5, 1, 1.5];
      const cur = levels.indexOf(g.settings.data.shake);
      g.settings.set('shake', levels[(cur + 1) % levels.length]);
      this._banner(`SHAKE ${Math.round(g.settings.data.shake * 100)}%`, 'SCREEN SHAKE', 60);
    }
    if (inp.keyPressed('KeyR')) { this.exit(); this.enter(g); return; }

    if (this.bannerT > 0 && --this.bannerT === 0) this.bannerEl.classList.remove('show');

    g.renderer.background.update();
    this._updateParallax();
    this._updatePlayer();
    this._updateEnemies();
    this.bullets.update();
    this.shots.update();
    this._collide();
    this.enemies.sweep();
    this.explosions.update();
    this.fxLow.update();
    this.fxHigh.update();

    const dbg = g.debug;
    dbg.set('bullets', `${this.bullets.count} (density ${DENSITY[this.density].label})`);
    dbg.set('shots', this.shots.count);
    dbg.set('particles', `${this.fxLow.count + this.fxHigh.count}`);
    dbg.set('enemies', this.enemies.count);
    dbg.set('graze', `${this.graze}  kills ${this.kills}  hits ${this.hits}`);
  }

  // ------------------------------------------------------------------ render

  render(r, alpha) {
    const b = r.batch, F = this.F, frames = r.frames, t = this.g.time;
    const p = this.player;

    // Volumetric light shafts (additive, very low alpha).
    for (let k = 0; k < 3; k++) {
      const x = 80 + k * 160 + Math.sin(t * 0.3 + k * 2) * 40;
      const a = 0.05 + 0.03 * Math.sin(t * 0.8 + k);
      const col = k === 1 ? [1, 0.3, 0.8] : [0.3, 0.9, 1];
      b.draw(F.beam, x, WORLD_H * 0.45, 90, 900, 0.35 + Math.sin(t * 0.2 + k) * 0.08, col[0], col[1], col[2], a, 1);
    }

    // Mid layer: hover traffic.
    for (const c of this.traffic) {
      const y = c.y - (1.3 + c.vy) * (1 - alpha);
      b.draw(F.white, c.x, y, 7, 13, 0, 0.05, 0.06, 0.09, 0.9, 0);
      const dir = c.vy + 1.3 > 0 ? 1 : -1;
      b.draw(F.glow, c.x - 2, y + 6 * dir, 10, 10, 0, c.col[0] * 1.5, c.col[1] * 1.5, c.col[2] * 1.5, 0.8, 1);
      b.draw(F.glow, c.x + 2, y + 6 * dir, 10, 10, 0, c.col[0] * 1.5, c.col[1] * 1.5, c.col[2] * 1.5, 0.8, 1);
      b.draw(F.glow, c.x, y - 6 * dir, 8, 8, 0, 1.2, 0.1, 0.15, 0.6, 1);
    }

    // Foreground structures (above the city, below the action).
    for (const s of this.structs) {
      const y = s.y - 2.6 * (1 - alpha);
      let a = s.a;
      if (s.holo) a *= 0.6 + 0.4 * ((((t * 20) | 0) % 7) ? 1 : 0.2);
      b.draw(s.f, s.x, y, s.f.w * s.s, s.f.h * s.s, s.rot, 1, 1, 1, a, s.add);
    }

    // Smoke & debris under ships.
    this.fxLow.render(b, frames, alpha);

    // Enemies.
    for (const e of this.enemies.active) {
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      const f = e.kind === 'core' ? F.emitter : F.drone;
      const rot = e.kind === 'core' ? this.t * 0.01 : 0;
      if (e.kind === 'core') b.draw(F.glow, x, y, 140, 140, 0, 1.0, 0.2, 0.7, 0.35, 1);
      b.draw(f, x, y, f.w, f.h, rot, 1, 1, 1, 1, 0);
      if (e.flash > 0) b.draw(f, x, y, f.w, f.h, rot, 1.5, 1.5, 1.5, 0.8, 1);
    }

    // Player shots: under the player and enemy bullets, low intensity.
    this.shots.render(b, frames, alpha, F.glow, { glowAlpha: 0, alpha: 0.4, add: 1, tint: [0.55, 0.85, 1] });

    // Player.
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const blink = p.invuln > 0 && ((this.t >> 2) & 1);
    if (!blink) {
      const squash = 1 - Math.abs(p.bank) * 0.2;
      b.draw(F.ship, px, py, F.ship.w * squash, F.ship.h, p.bank * 0.06, 1, 1, 1, 1, 0);
    }
    const flick = 0.85 + 0.15 * Math.sin(t * 60);
    b.draw(F.glow, px - 5, py + 22, 14 * flick, 20 * flick, 0, 0.6, 1.4, 2.4, 0.9, 1);
    b.draw(F.glow, px + 5, py + 22, 14 * flick, 20 * flick, 0, 0.6, 1.4, 2.4, 0.9, 1);

    // Fire, sparks, flashes.
    this.fxHigh.render(b, frames, alpha);

    // Rain (faint, never over bullets).
    for (const d of this.rain) {
      b.draw(F.rain, d.x + d.v * 0.12 * (1 - alpha), d.y - d.v * (1 - alpha), 2, 28, 0.12, 0.7, 0.85, 1, d.a, 1);
    }

    // Enemy bullets on top of everything in the world layer.
    this.bullets.render(b, frames, alpha, F.glow);

    // Focus indicators.
    if (p.focus) {
      b.draw(F.ring, px, py, GRAZE_RADIUS * 2.6, GRAZE_RADIUS * 2.6, 0, 0.3, 0.9, 1, 0.25, 1);
      b.draw(F.hitbox, px, py, 10, 10, this.t * 0.05, 1, 1, 1, 1, 0);
    }
  }
}
