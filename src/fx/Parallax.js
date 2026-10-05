import { WORLD_W, WORLD_H } from '../core/constants.js';

// Sprite parallax layers drawn over the shader city:
//   light shafts (additive) → mid hover-traffic → foreground structures,
// plus a rain layer that a scene draws later (just under enemy bullets).
// Cosmetic only: uses the fx RNG so it never affects gameplay determinism.

const FG_SPEED = 2.6;
const MID_SPEED = 1.3;

export class Parallax {
  constructor(game) {
    this.g = game;
    const r = game.renderer;
    this.F = {
      girder: r.frame('girder'), roofs: [0, 1, 2].map((i) => r.frame(`roof${i}`)), holo: r.frame('holo'),
      beam: r.frame('beam'), rain: r.frame('rain'), white: r.frame('white'), glow: r.frame('glow'),
    };
    this.R = game.fxRng;
    this.structs = [];
    this.structTimer = 0;
    this.traffic = [];
    for (let i = 0; i < 14; i++) this.traffic.push(this._newCar(this.R.range(0, WORLD_H)));
    this.rain = [];
    for (let i = 0; i < 140; i++) {
      this.rain.push({ x: this.R.range(-40, WORLD_W + 40), y: this.R.range(-40, WORLD_H), v: this.R.range(11, 16), a: this.R.range(0.05, 0.14) });
    }
    for (let y = -80; y < WORLD_H; y += 190) this._spawnStruct(y);
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
    const R = this.R, F = this.F, kind = R.next();
    if (kind < 0.35) {
      this.structs.push({ f: F.girder, x: R.range(120, 360), y, rot: R.range(-0.25, 0.25), s: 1.3, a: 0.95, add: 0 });
    } else if (kind < 0.8) {
      const left = R.chance(0.5);
      this.structs.push({ f: R.pick(F.roofs), x: left ? R.range(-20, 50) : R.range(WORLD_W - 50, WORLD_W + 20), y, rot: 0, s: 1, a: 0.95, add: 0 });
      if (R.chance(0.6)) this.structs.push({ f: F.holo, x: left ? 70 : WORLD_W - 70, y: y + R.range(-20, 20), rot: 0, s: 1, a: 0.7, add: 1, holo: true });
    }
  }

  update() {
    for (const s of this.structs) s.y += FG_SPEED;
    this.structs = this.structs.filter((s) => s.y < WORLD_H + 140);
    if (--this.structTimer <= 0) { this._spawnStruct(-120); this.structTimer = this.R.int(50, 90); }
    for (let i = 0; i < this.traffic.length; i++) {
      const c = this.traffic[i];
      c.y += MID_SPEED + c.vy;
      if (c.y > WORLD_H + 30 || c.y < -60) this.traffic[i] = this._newCar(c.vy + MID_SPEED > 0 ? -40 : WORLD_H + 20);
    }
    for (const d of this.rain) {
      d.y += d.v; d.x -= d.v * 0.12;
      if (d.y > WORLD_H + 30) { d.y = -30; d.x = this.R.range(-20, WORLD_W + 60); }
    }
  }

  render(b, alpha, t) {
    const F = this.F;
    for (let k = 0; k < 3; k++) {
      const x = 80 + k * 160 + Math.sin(t * 0.3 + k * 2) * 40;
      const a = 0.05 + 0.03 * Math.sin(t * 0.8 + k);
      const col = k === 1 ? [1, 0.3, 0.8] : [0.3, 0.9, 1];
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
    for (const s of this.structs) {
      const y = s.y - FG_SPEED * (1 - alpha);
      let a = s.a;
      if (s.holo) a *= 0.6 + 0.4 * ((((t * 20) | 0) % 7) ? 1 : 0.2);
      b.draw(s.f, s.x, y, s.f.w * s.s, s.f.h * s.s, s.rot, 1, 1, 1, a, s.add);
    }
  }

  renderRain(b, alpha) {
    const F = this.F;
    for (const d of this.rain) {
      b.draw(F.rain, d.x + d.v * 0.12 * (1 - alpha), d.y - d.v * (1 - alpha), 2, 28, 0.12, 0.7, 0.85, 1, d.a, 1);
    }
  }
}
