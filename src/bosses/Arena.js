import { WORLD_W as W, WORLD_H as H } from '../core/constants.js';
import { biomeArena, resolveArena } from './arenas.js';
import { transitionFor } from './transitions.js';
import { ScoreStars } from './ScoreStars.js';

// Boss arena mode (UPDATE_01 §1.3). While a main boss is up, the Arena owns
// the background layers: shader mode + palette, parallax set, weather and
// arena-only ambient layers. Each phase change crossfades with a themed
// effect; the background mode and parallax swap at the effect's midpoint,
// when the screen is fully covered, while colours and scroll speed blend
// smoothly up to it.
//
// Lifecycle (driven by StageScene from world events):
//   enter(stageBiome)       arena mode on; remembers the stage biome
//   transitionTo(arena, fx) crossfade to a phase arena (snaps any running one)
//   finish()                complete the running transition immediately
//   exit()                  crossfade back to the stage biome, then mode off
//   reset()                 hard off (new stage / restart)
// Presentation only: it never touches gameplay state, except the ScoreStars
// it hosts (bullet → score conversion, kept here so stars outlive the boss).

const BASE_SCROLL = 0.012; // Background's stage scroll speed
const COLORS = ['base', 'fog', 'neonA', 'neonB'];
const NUMS = ['tilt', 'bright', 'detail'];

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const cloneBg = (bg) => ({ ...bg, base: [...bg.base], fog: [...bg.fog], neonA: [...bg.neonA], neonB: [...bg.neonB] });

function lerpBg(out, a, b, t) {
  for (const k of COLORS) for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  for (const k of NUMS) out[k] = (a[k] ?? 0.3) + ((b[k] ?? 0.3) - (a[k] ?? 0.3)) * t;
}

// ------------------------------------------------------------ ambient layers

const AMBIENT = {
  searchlights: {
    init: (R) => [0, 1, 2].map((k) => ({ x: 60 + k * 180 + R.range(-30, 30), ph: R.range(0, 6.28), sp: R.range(0.4, 0.8) })),
    draw(b, F, s, t) {
      for (const l of s) {
        const ang = Math.sin(t * l.sp + l.ph) * 0.5;
        b.draw(F.beam, l.x + Math.sin(ang) * 260, H * 0.55 - Math.cos(ang) * 260 + 200, 70, 760, ang, 1, 0.95, 0.75, 0.07, 1);
      }
    },
  },
  aurora: {
    init: () => null,
    draw(b, F, s, t) {
      for (let k = 0; k < 9; k++) {
        const x = k * 60, y = 70 + Math.sin(t * 0.6 + k * 0.8) * 25;
        const c = k % 2 ? [0.3, 1.2, 0.7] : [0.7, 0.4, 1.2];
        b.draw(F.glow, x, y, 140, 90 + Math.sin(t + k) * 30, 0, c[0], c[1], c[2], 0.16, 1);
      }
    },
  },
  snow: {
    init: (R) => Array.from({ length: 90 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(0.6, 1.6), ph: R.range(0, 6.28), s: R.range(2, 4.5) })),
    update(s) { for (const f of s) { f.y += f.v; f.x += Math.sin(f.y * 0.02 + f.ph) * 0.5; if (f.y > H + 8) { f.y = -8; } } },
    draw(b, F, s) { for (const f of s) b.draw(F.glow, f.x, f.y, f.s * 2.4, f.s * 2.4, 0, 1.2, 1.25, 1.35, 0.55, 1); },
  },
  bubbles: {
    init: (R) => Array.from({ length: 45 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(0.5, 1.4), ph: R.range(0, 6.28), s: R.range(4, 11) })),
    update(s) { for (const f of s) { f.y -= f.v; f.x += Math.sin(f.y * 0.03 + f.ph) * 0.4; if (f.y < -12) f.y = H + 12; } },
    draw(b, F, s) { for (const f of s) b.draw(F.ring, f.x, f.y, f.s, f.s, 0, 0.5, 1, 1.2, 0.35, 1); },
  },
  ash: {
    init: (R) => Array.from({ length: 70 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(0.3, 0.9), ph: R.range(0, 6.28), s: R.range(1.5, 3.5) })),
    update(s) { for (const f of s) { f.y += f.v; f.x += Math.sin(f.y * 0.015 + f.ph) * 0.6; if (f.y > H + 8) f.y = -8; } },
    draw(b, F, s) { for (const f of s) b.draw(F.white, f.x, f.y, f.s, f.s, f.ph, 0.35, 0.32, 0.34, 0.6, 0); },
  },
  glyphs: {
    init: (R) => Array.from({ length: 14 }, () => ({ x: R.range(20, W - 20), y: R.range(0, H), v: R.range(0.3, 0.8), r: R.angle(), s: R.range(20, 46) })),
    update(s) { for (const f of s) { f.y += f.v; f.r += 0.01; if (f.y > H + 40) f.y = -40; } },
    draw(b, F, s, t) {
      for (const f of s) b.draw(F.ring, f.x, f.y, f.s, f.s, f.r, 0.3, 1, 0.8, 0.12 + 0.06 * Math.sin(t * 2 + f.r), 1);
    },
  },
};
// Names from boss data that map onto the layers above.
const AMBIENT_ALIAS = { searchlight_beams: 'searchlights', aurora_bands: 'aurora', snowfall: 'snow', ash_fall: 'ash' };

export class Arena {
  constructor(game, world, parallax) {
    this.g = game;
    this.bg = game.renderer.background;
    this.parallax = parallax;
    const r = game.renderer;
    this.F = {
      white: r.frame('white'), glow: r.frame('glow'), ring: r.frame('ring'), laser: r.frame('laser'),
      beam: r.frame('beam'), spark: r.frame('spark'), shard: r.frame('shard0'),
    };
    this.R = game.fxRng;
    this.stars = new ScoreStars(world);
    this.reset();
  }

  reset() {
    this.active = false;
    this.exiting = false;
    this.tr = null;
    this.cur = null;
    this.home = null;
    this.amb = [];
    this.bg.speed = BASE_SCROLL;
    this.stars.clear();
  }

  get transitioning() { return !!this.tr; }

  enter(stageBiome) {
    this.active = true;
    this.exiting = false;
    this.home = stageBiome;
    this.cur = biomeArena(stageBiome);
  }

  /** Crossfade to `arena` (a phase's arena block, or a resolved recipe). */
  transitionTo(arena, fx = 'flash', dur = 100) {
    if (!this.active) return;
    this.finish();
    const to = arena.bg && arena.parallax ? arena : resolveArena(arena);
    const work = cloneBg(this.bg.biome);
    this.bg.biome = work; // private copy, blended in place up to the swap
    const tr = { from: this.cur, to, name: fx, fx: transitionFor(fx), dur, t: 0, swapped: false, start: cloneBg(work), speed0: this.bg.speed };
    if (tr.fx.init) tr.fx.init(tr, this.R);
    this.tr = tr;
  }

  /** Complete the running transition now (safe at any point). */
  finish() {
    const tr = this.tr;
    if (!tr) return;
    if (!tr.swapped) this._swap(tr);
    this.bg.speed = BASE_SCROLL * tr.to.scrollSpeed;
    this.tr = null;
    if (this.exiting) this._off();
  }

  /** Hand control back to the stage biome. */
  exit() {
    if (!this.active || !this.home) return;
    this.exiting = false;
    this.transitionTo(biomeArena(this.home), 'fade', 80);
    this.exiting = true;
  }

  _off() {
    this.active = false;
    this.exiting = false;
    this.cur = null;
    this.amb = [];
    this.bg.speed = BASE_SCROLL;
  }

  _swap(tr) {
    tr.swapped = true;
    this.bg.setBiome(cloneBg(tr.to.bg));
    this.parallax.setStyle(tr.to);
    this.cur = tr.to;
    this.amb = [];
    for (const raw of tr.to.ambient) {
      const name = AMBIENT_ALIAS[raw] || raw, A = AMBIENT[name];
      if (A) this.amb.push({ A, s: A.init(this.R) });
    }
  }

  update() {
    this.stars.update();
    if (!this.active) return;
    const tr = this.tr;
    if (tr) {
      tr.t++;
      const k = tr.t / tr.dur;
      if (!tr.swapped) {
        const m = smooth(k / 0.5);
        lerpBg(this.bg.biome, tr.start, tr.to.bg, m);
        this.bg.speed = tr.speed0 + (BASE_SCROLL * tr.to.scrollSpeed - tr.speed0) * m;
        if (k >= 0.5) this._swap(tr);
      }
      if (tr.t >= tr.dur) this.finish();
    }
    if (this.cur && this.cur.noStructs) this.parallax.structs.length = 0;
    for (const a of this.amb) if (a.A.update) a.A.update(a.s);
  }

  /** Arena layers + transition effect: over the parallax, under all entities. */
  renderUnder(b, alpha, time) {
    if (!this.active) return;
    const F = this.F, cur = this.cur;
    if (cur) {
      if (cur.darkness > 0) b.draw(F.white, W / 2, H / 2, W + 20, H + 20, 0, 0, 0, 0, cur.darkness, 0);
      if (cur.tint) { const c = cur.tint; b.draw(F.white, W / 2, H / 2, W + 20, H + 20, 0, c[0], c[1], c[2], c[3], 0); }
      for (const a of this.amb) a.A.draw(b, F, a.s, time);
    }
    const tr = this.tr;
    if (tr) tr.fx.draw(b, F, Math.min(1, Math.max(0, (tr.t - 1 + alpha) / tr.dur)), tr, time);
  }

  /** Score stars: over the world, under enemy bullets. */
  renderOver(b, alpha) { this.stars.render(b, alpha); }
}
