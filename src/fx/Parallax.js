import { WORLD_W, WORLD_H } from '../core/constants.js';

// Sprite parallax layers drawn over the shader background:
//   renderBack: light shafts + mid-level hover traffic
//   renderFore: foreground structures (girders, rooftops, holo billboards)
//   renderStreaks: weather/ambient streaks (rain, embers, data, debris),
//                  drawn by the scene just under enemy bullets
// Driven by a biome's `parallax` block. Cosmetic only (fx RNG).

const FG_SPEED = 2.6;
const MID_SPEED = 1.3;

const DEFAULT_STYLE = {
  structs: ['girder', 'roof', 'holo'],
  streak: { kind: 'rain', n: 140, color: [0.7, 0.85, 1], speed: 13, slant: 0.12, alpha: 0.1 },
  shafts: [[0.3, 0.9, 1], [1, 0.3, 0.8]],
  traffic: true,
};

export class Parallax {
  constructor(game, biome = null) {
    this.g = game;
    const r = game.renderer;
    this.F = {
      girder: r.frame('girder'), roofs: [0, 1, 2].map((i) => r.frame(`roof${i}`)), holo: r.frame('holo'),
      beam: r.frame('beam'), rain: r.frame('rain'), white: r.frame('white'), glow: r.frame('glow'),
      shards: [0, 1, 2, 3].map((i) => r.frame(`shard${i}`)),
    };
    this.R = game.fxRng;
    this.setStyle(biome);
  }

  setStyle(biome) {
    const st = biome ? { ...biome.parallax, traffic: biome.parallax.traffic ?? biome.bg.mode === 0 } : DEFAULT_STYLE;
    this.style = st;
    this.structs = [];
    this.structTimer = 0;
    this.traffic = [];
    if (st.traffic) for (let i = 0; i < 14; i++) this.traffic.push(this._newCar(this.R.range(0, WORLD_H)));
    this.streaks = [];
    const s = st.streak;
    for (let i = 0; i < s.n; i++) this.streaks.push(this._newStreak(this.R.range(-40, WORLD_H)));
    for (let y = -80; y < WORLD_H; y += 190) this._spawnStruct(y);
  }

  _newStreak(y) {
    const R = this.R, s = this.style.streak;
    return {
      x: R.range(-40, WORLD_W + 40), y, v: s.speed * R.range(0.75, 1.25), a: s.alpha * R.range(0.5, 1.3),
      ph: R.range(0, 6.28), sz: R.range(0.6, 1.4), f: R.pick(this.F.shards), rot: R.angle(),
    };
  }

  _newCar(y) {
    const R = this.R, lane = R.int(0, 5), up = lane % 2 === 0;
    return {
      x: 40 + lane * 80 + R.range(-10, 10), y,
      vy: up ? R.range(-1.2, -0.4) : R.range(1.6, 2.6),
      col: R.pick([[0.3, 0.9, 1], [1, 0.3, 0.8], [1, 0.75, 0.3]]),
    };
  }

  _spawnStruct(y) {
    const R = this.R, F = this.F;
    if (!this.style.structs || !this.style.structs.length) return; // arena worlds: no sprite structures
    if (R.chance(0.2)) return;
    const kind = R.pick(this.style.structs);
    if (kind === 'girder') {
      this.structs.push({ f: F.girder, x: R.range(120, 360), y, rot: R.range(-0.25, 0.25), s: 1.3, a: 0.95, add: 0 });
    } else if (kind === 'roof') {
      const left = R.chance(0.5);
      this.structs.push({ f: R.pick(F.roofs), x: left ? R.range(-20, 50) : R.range(WORLD_W - 50, WORLD_W + 20), y, rot: 0, s: 1, a: 0.95, add: 0 });
    } else {
      const left = R.chance(0.5);
      this.structs.push({ f: F.holo, x: left ? R.range(40, 90) : R.range(WORLD_W - 90, WORLD_W - 40), y, rot: R.range(-0.1, 0.1), s: 1, a: 0.7, add: 1, holo: true });
    }
  }

  update() {
    for (const s of this.structs) s.y += FG_SPEED;
    if (this.structs.length && this.structs[0].y > WORLD_H + 140) this.structs = this.structs.filter((s) => s.y < WORLD_H + 140);
    if (--this.structTimer <= 0) { this._spawnStruct(-120); this.structTimer = this.R.int(50, 90); }
    for (let i = 0; i < this.traffic.length; i++) {
      const c = this.traffic[i];
      c.y += MID_SPEED + c.vy;
      if (c.y > WORLD_H + 30 || c.y < -60) this.traffic[i] = this._newCar(c.vy + MID_SPEED > 0 ? -40 : WORLD_H + 20);
    }
    const st = this.style.streak;
    const up = st.kind === 'embers';
    for (let i = 0; i < this.streaks.length; i++) {
      const d = this.streaks[i];
      d.y += up ? -d.v : d.v;
      d.x -= d.v * st.slant;
      if (up) d.x += Math.sin(d.y * 0.03 + d.ph) * 0.4;
      d.rot += 0.02;
      if (d.y > WORLD_H + 30 || d.y < -40) {
        this.streaks[i] = this._newStreak(up ? WORLD_H + 20 : -30);
      }
    }
  }

  renderBack(b, alpha, t) {
    const F = this.F, sh = this.style.shafts;
    for (let k = 0; sh && sh.length && k < 3; k++) {
      const x = 80 + k * 160 + Math.sin(t * 0.3 + k * 2) * 40;
      const a = 0.05 + 0.03 * Math.sin(t * 0.8 + k);
      const col = sh[k % sh.length];
      b.draw(F.beam, x, WORLD_H * 0.45, 90, 900, 0.35 + Math.sin(t * 0.2 + k) * 0.08, col[0], col[1], col[2], a, 1);
    }
    for (const c of this.traffic) {
      const y = c.y - (MID_SPEED + c.vy) * (1 - alpha);
      const dir = c.vy + MID_SPEED > 0 ? 1 : -1;
      b.draw(F.white, c.x, y, 7, 13, 0, 0.05, 0.06, 0.09, 0.9, 0);
      b.draw(F.glow, c.x - 2, y + 6 * dir, 10, 10, 0, c.col[0] * 1.5, c.col[1] * 1.5, c.col[2] * 1.5, 0.8, 1);
      b.draw(F.glow, c.x + 2, y + 6 * dir, 10, 10, 0, c.col[0] * 1.5, c.col[1] * 1.5, c.col[2] * 1.5, 0.8, 1);
      b.draw(F.glow, c.x, y - 6 * dir, 8, 8, 0, 1.2, 0.1, 0.15, 0.6, 1);
    }
  }

  renderFore(b, alpha, t) {
    for (const s of this.structs) {
      const y = s.y - FG_SPEED * (1 - alpha);
      let a = s.a;
      if (s.holo) a *= 0.6 + 0.4 * ((((t * 20) | 0) % 7) ? 1 : 0.2);
      b.draw(s.f, s.x, y, s.f.w * s.s, s.f.h * s.s, s.rot, 1, 1, 1, a, s.add);
    }
  }

  /** Back-compat: back + fore in one call (pilot select). */
  render(b, alpha, t) { this.renderBack(b, alpha, t); this.renderFore(b, alpha, t); }

  renderStreaks(b, alpha) {
    const F = this.F, st = this.style.streak, c = st.color;
    const up = st.kind === 'embers';
    for (const d of this.streaks) {
      const dy = (up ? -d.v : d.v) * (1 - alpha);
      const x = d.x + d.v * st.slant * (1 - alpha), y = d.y - dy;
      switch (st.kind) {
        case 'embers': {
          const fl = 0.6 + 0.4 * Math.sin(d.ph + y * 0.1);
          b.draw(F.glow, x, y, 7 * d.sz, 7 * d.sz, 0, c[0] * 2, c[1] * 2, c[2] * 2, d.a * fl, 1);
          break;
        }
        case 'data':
          b.draw(F.rain, x, y, 3, 40 * d.sz, 0, c[0], c[1], c[2], d.a, 1);
          b.draw(F.white, x, y + 20 * d.sz, 3, 3, 0, c[0] * 2, c[1] * 2, c[2] * 2, d.a * 1.5, 1);
          break;
        case 'debris':
          b.draw(d.f, x, y, 8 * d.sz, 8 * d.sz, d.rot, 0.5, 0.5, 0.6, d.a, 0);
          break;
        default:
          b.draw(F.rain, x, y, 2, 28, st.slant, c[0], c[1], c[2], d.a, 1);
      }
    }
  }

  /** Back-compat alias. */
  renderRain(b, alpha) { this.renderStreaks(b, alpha); }
}
