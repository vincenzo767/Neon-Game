import { WORLD_W as W, WORLD_H as H } from '../core/constants.js';
import { biomeArena, resolveArena } from './arenas.js';
import { transitionFor } from './transitions.js';
import { ScoreStars } from './ScoreStars.js';
import { installArenaBackground } from './ArenaBackground.js';
import { worldSystem } from '../world/index.js';

// Boss arena mode (UPDATE_01 §1.3). While a main boss is up, the Arena owns
// the background layers: shader mode + palette, parallax set, weather and
// arena-only ambient layers. Each phase change crossfades with a themed
// effect; the background mode and parallax swap at the effect's midpoint,
// when the screen is fully covered, while colours and scroll speed blend
// smoothly up to it.
//
// Level mode (level rework): showLevel(id) puts a level's arena world on
// screen for the whole level — waves, mini-boss and boss. Boss phases then
// only change the arena's MOOD (vision veil / tint, eased), never the world.
// The first view is held under a cover until its chunks are built.
//
// Lifecycle (driven by StageScene from world events):
//   showLevel(id, biome)    level mode: this arena from the first wave on
//   mood(arena)             phase visibility / tint over the level arena
//   enter(stageBiome)       arena mode on; remembers the stage biome
//   transitionTo(arena, fx) crossfade to a phase arena (snaps any running one)
//   finish()                complete the running transition immediately
//   exit()                  crossfade back to the stage biome, then mode off
//   reset()                 hard off (new stage / restart)
// Presentation only: it never touches gameplay state, except the ScoreStars
// it hosts (bullet → score conversion, kept here so stars outlive the boss).

const BASE_SCROLL = 0.012; // Background's stage scroll speed
const MAX_POOL = 3;        // arena worlds alive at once (shown + incoming + prefetched)
const HOLD_MAX = 40;       // max steps a transition may hold full cover for a late arena build
const LOAD_MAX = 60 * 10;  // a level's first view waits at most this long under the cover
const COVER_FADE = 45;     // steps to lift the cover once the level arena is ready
const MOOD_EASE = 0.03;    // per-step easing of phase darkness / light / tint
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
Object.assign(AMBIENT, {
  dust: {
    init: (R) => Array.from({ length: 30 }, () => ({ x: R.range(0, W), y: R.range(0, H), s: R.range(40, 110), v: R.range(0.2, 0.6), ph: R.range(0, 6.28) })),
    update(s) { for (const f of s) { f.y += f.v; if (f.y > H + 60) f.y = -60; } },
    draw(b, F, s, t) { for (const f of s) b.draw(F.smoke, f.x + Math.sin(t * 0.3 + f.ph) * 20, f.y, f.s, f.s, f.ph, 0.4, 0.33, 0.26, 0.12, 0); },
  },
  sandstorm: {
    init: (R) => Array.from({ length: 70 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(4, 9), l: R.range(30, 90) })),
    update(s) { for (const f of s) { f.x += f.v; f.y += f.v * 0.15; if (f.x > W + 60) { f.x = -60; f.y = Math.random() * H; } } },
    draw(b, F, s) { for (const f of s) b.draw(F.laser, f.x, f.y, f.l, 3, 0.15, 1, 0.75, 0.45, 0.22, 0); },
  },
  heat: {
    init: () => null,
    update(s, arena) { arena.g.renderer.post.heat(0.03); },
    draw() {},
  },
  lightning: {
    init: () => ({ t: 0 }),
    update(s, arena) {
      // Cosmetic only (Math.random): never touches the gameplay RNG.
      if (Math.random() < 0.006) {
        arena.bg.flash = 1;
        arena.g.renderer.post.flash(0.75, 0.8, 1, 0.12, 0.05);
        arena.g.camera.addTrauma(0.05);
      }
    },
    draw() {},
  },
  marine_snow: {
    init: (R) => Array.from({ length: 80 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(0.2, 0.6), ph: R.range(0, 6.28) })),
    update(s) { for (const f of s) { f.y += f.v; f.x += Math.sin(f.y * 0.02 + f.ph) * 0.2; if (f.y > H + 4) f.y = -4; } },
    draw(b, F, s) { for (const f of s) b.draw(F.white, f.x, f.y, 1.6, 1.6, 0, 0.7, 0.85, 0.9, 0.5, 1); },
  },
  alarm: {
    init: () => null,
    draw(b, F, s, t) {
      const a = 0.12 * Math.max(0, Math.sin(t * 5));
      b.draw(F.white, W / 2, H / 2, W + 20, H + 20, 0, 0.8, 0, 0, a, 1);
      for (const x of [8, W - 8]) b.draw(F.laser, x, H / 2, H, 10, Math.PI / 2, 2, 0.2, 0.1, a * 4, 1);
    },
  },
  tractor_beams: {
    init: (R) => [0, 1, 2].map(() => ({ x: R.range(60, W - 60), ph: R.range(0, 6.28), sp: R.range(0.2, 0.5) })),
    draw(b, F, s, t) {
      for (const l of s) {
        const x = l.x + Math.sin(t * l.sp + l.ph) * 60;
        b.draw(F.beam, x, H * 0.5, 110, H * 1.2, 0, 0.4, 1.2, 0.5, 0.08 + 0.03 * Math.sin(t * 4 + l.ph), 1);
        for (let k = 0; k < 4; k++) b.draw(F.ring, x, ((t * 60 + k * 160 + l.ph * 50) % (H + 80)) - 40, 70, 22, 0, 0.4, 1.2, 0.5, 0.18, 1);
      }
    },
  },
  spores: {
    init: (R) => Array.from({ length: 40 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(0.2, 0.7), ph: R.range(0, 6.28), s: R.range(3, 8) })),
    update(s) { for (const f of s) { f.y -= f.v; f.x += Math.sin(f.y * 0.03 + f.ph) * 0.5; if (f.y < -10) f.y = H + 10; } },
    draw(b, F, s, t) { for (const f of s) b.draw(F.glow, f.x, f.y, f.s * 3, f.s * 3, 0, 0.5, 1.4, 0.4, 0.3 + 0.2 * Math.sin(t * 3 + f.ph), 1); },
  },
  sanity: {
    // Abyssal "sanity" distortion: breathing heat-haze, aberration spikes.
    init: () => ({ t: 0 }),
    update(s, arena) {
      s.t++;
      const post = arena.g.renderer.post;
      post.heat(0.02 + 0.02 * Math.sin(s.t * 0.05));
      if (s.t % 150 === 0) { post.aberrate(0.012); post.shockwave(W / 2, H / 2, 0.01, 0.01, 0.8); }
    },
    draw(b, F, s, t) {
      const a = 0.1 + 0.06 * Math.sin(t * 0.8);
      b.draw(F.ring, W / 2, H / 2, W * 1.8, H * 1.5, 0, 0.3, 0, 0.25, a, 0);
    },
  },
});
Object.assign(AMBIENT, {
  // Re-entry: plasma sheath streaks rushing past the screen edges, flickering hot.
  reentry: {
    init: (R) => Array.from({ length: 34 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(9, 18), l: R.range(60, 180), w: R.range(1.5, 4), ph: R.range(0, 6.28) })),
    update(s) { for (const f of s) { f.y -= f.v; if (f.y < -f.l) { f.y = H + f.l; } } },
    draw(b, F, s, t) {
      for (const f of s) {
        const edge = Math.min(1, (Math.abs(f.x - W / 2) / (W / 2)) * 1.6);
        b.draw(F.laser, f.x, f.y, f.l, f.w, Math.PI / 2, 2, 0.9 + 0.3 * Math.sin(t * 9 + f.ph), 0.35, 0.18 * edge, 1);
      }
      b.draw(F.glow, -40, H / 2, 260, H * 1.4, 0, 1.6, 0.55, 0.15, 0.12 + 0.04 * Math.sin(t * 7), 1);
      b.draw(F.glow, W + 40, H / 2, 260, H * 1.4, 0, 1.6, 0.55, 0.15, 0.12 + 0.04 * Math.sin(t * 6.3), 1);
    },
  },
  // Wind-blown sea spray in storms.
  spray: {
    init: (R) => Array.from({ length: 40 }, () => ({ x: R.range(0, W), y: R.range(0, H), v: R.range(5, 9), s: R.range(10, 30) })),
    update(s) { for (const f of s) { f.x += f.v; f.y += f.v * 0.25; if (f.x > W + 30) { f.x = -30; f.y = Math.random() * H; } } },
    draw(b, F, s) { for (const f of s) b.draw(F.smoke, f.x, f.y, f.s * 2, f.s, 0.2, 0.85, 0.9, 0.95, 0.08, 0); },
  },
});
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
      darkhole: r.frame('fx_darkhole'), smoke: r.frame('smoke'),
    };
    this.R = game.fxRng;
    this.world = world;
    // Arena-only shader scenes (modes >= 10) render through the stage Background.
    installArenaBackground(this.bg, r.gl);
    // Arena rework: authored phase arenas are rendered by the world system.
    this.sys = worldSystem(game);
    this.pool = new Map();   // arena config id → ArenaWorld (current, incoming, prefetched)
    this.view = null;        // the ArenaWorld on screen
    this.stars = new ScoreStars(world);
    this.reset();
  }

  reset(keepId = null) {
    this.levelRec = null;
    this.cover = 0;
    this.loadT = 0;
    this.moodTo = null;
    this.active = false;
    this.exiting = false;
    this.tr = null;
    this.cur = null;
    this.home = null;
    this.amb = [];
    this.bg.speed = BASE_SCROLL;
    this.stars.clear();
    for (const [id, v] of this.pool) if (id !== keepId) { v.dispose(); this.pool.delete(id); }
    this.view = null;
    this.bg.world = null;
  }

  get transitioning() { return !!this.tr; }

  // ------------------------------------------------------------ level mode

  /**
   * Show level arena `id` for the whole level (no transition: the scene is
   * covered until the first view is built, then the cover lifts).
   */
  showLevel(id, biome) {
    const rec = resolveArena({ id });
    if (!rec.world) return false;
    this.enter(biome);
    this.levelRec = rec;
    const v = this._worldFor(rec.world);
    this._swap({ to: rec, toView: v, swapped: false });
    this.bg.speed = BASE_SCROLL * rec.scrollSpeed;
    this.cover = 1;
    this.loadT = 0;
    this.moodTo = null;
    return true;
  }

  /** True while a level's first view is still being built (the scene waits). */
  get loading() { return !!this.levelRec && this.cover >= 1; }

  /** Level mode: true. Phase arenas then only set the mood. */
  get locked() { return !!this.levelRec; }

  /**
   * A boss phase's arena in level mode: keep the level world, ease toward
   * that arena's visibility (Light Pool), darkness and tint.
   */
  mood(arena) {
    if (!this.levelRec) return;
    const rec = arena ? resolveArena(arena) : this.levelRec;
    this.moodTo = { darkness: rec.darkness || 0, light: rec.light || 0, tint: rec.tint || this.levelRec.tint || null };
  }

  _updateMood() {
    const m = this.moodTo, cur = this.cur;
    if (!m || !cur) return;
    if (cur === this.levelRec) this.cur = { ...cur }; // never write into the shared recipe
    const c = this.cur;
    c.darkness += (m.darkness - (c.darkness || 0)) * MOOD_EASE * 2;
    // The light pool snaps open / shut with the veil (a radius easing from 0 reads as a pinhole).
    c.light = m.darkness > 0 ? m.light : (c.darkness < 0.05 ? 0 : c.light);
    if (m.tint) {
      const t = c.tint ? [...c.tint] : [m.tint[0], m.tint[1], m.tint[2], 0];
      for (let i = 0; i < 4; i++) t[i] += (m.tint[i] - t[i]) * MOOD_EASE;
      c.tint = t;
    } else if (c.tint) {
      c.tint = [c.tint[0], c.tint[1], c.tint[2], c.tint[3] * (1 - MOOD_EASE)];
      if (c.tint[3] < 0.005) c.tint = null;
    }
  }

  /** Scroll of the arena's ground / water plane at screen row `sy` (world px per step). */
  groundSpeed(sy) {
    const v = this.view;
    return v && v.groundSpeedAt ? v.groundSpeedAt(sy) : 1.5;
  }

  /** Lateral ground shift at screen row `sy` (a boss panning the camera), world px per step. */
  groundShift(sy) {
    const v = this.view;
    return v && v.groundShiftAt ? v.groundShiftAt(sy) : 0;
  }

  enter(stageBiome) {
    this.active = true;
    this.exiting = false;
    this.home = stageBiome;
    this.cur = biomeArena(stageBiome);
  }

  // ------------------------------------------------------- arena worlds

  /**
   * Start building an arena before it is needed (boss WARNING, each phase
   * start for the next phase). Keeps at most MAX_POOL worlds alive.
   */
  prefetch(arena) {
    if (!arena) return null;
    const rec = arena.bg && arena.parallax ? arena : resolveArena(arena);
    if (!rec.world) return null;
    return this._worldFor(rec.world);
  }

  _worldFor(cfg) {
    let v = this.pool.get(cfg.id);
    if (v && !v.disposed) return v;
    v = this.sys.create(cfg);
    this.pool.set(cfg.id, v);
    // Bound the pool: drop the oldest world that is neither shown nor incoming.
    if (this.pool.size > MAX_POOL) {
      for (const [id, w] of this.pool) {
        if (w === this.view || w === v || (this.tr && this.tr.toView === w)) continue;
        w.dispose(); this.pool.delete(id); break;
      }
    }
    return v;
  }

  _dropView(keep = null) {
    for (const [id, w] of this.pool) if (w !== keep && w === this.view) { w.dispose(); this.pool.delete(id); }
  }

  /** Crossfade to `arena` (a phase's arena block, or a resolved recipe). */
  transitionTo(arena, fx = 'flash', dur = 100) {
    if (!this.active) return;
    this.finish();
    const to = arena.bg && arena.parallax ? arena : resolveArena(arena);
    const work = cloneBg(this.bg.biome);
    this.bg.biome = work; // private copy, blended in place up to the swap
    const tr = { from: this.cur, to, name: fx, fx: transitionFor(fx), dur, t: 0, swapped: false, start: cloneBg(work), speed0: this.bg.speed, hold: 0 };
    tr.toView = to.world ? this._worldFor(to.world) : null;
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
    if (this.levelRec) { this.mood(null); return; }
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
    for (const v of this.pool.values()) v.dispose();
    this.pool.clear();
    this.view = null;
    this.bg.world = null;
  }

  _swap(tr) {
    tr.swapped = true;
    this.bg.setBiome(cloneBg(tr.to.bg));
    this.parallax.setStyle(tr.to);
    // World arenas replace the background slot; the outgoing world is freed
    // now that the transition fully covers the screen.
    const next = tr.toView || null;
    if (this.view && this.view !== next) this._dropView(next);
    this.view = next;
    this.bg.world = next;
    this.cur = tr.to;
    this.amb = [];
    for (const raw of tr.to.ambient) {
      const name = AMBIENT_ALIAS[raw] || raw, A = AMBIENT[name];
      if (A) this.amb.push({ A, s: A.init(this.R) });
    }
  }

  update() {
    this.stars.update();
    this.sys.check();
    for (const v of this.pool.values()) if (v !== this.view) v.idle(); // prefetched arenas upload gradually
    if (!this.active) return;
    if (this.cover > 0) {
      this.loadT++;
      if (this.cover < 1 || (this.view && this.view.ready) || this.loadT > LOAD_MAX) this.cover = Math.max(0, this.cover - 1 / COVER_FADE);
    }
    this._updateMood();
    const tr = this.tr;
    if (tr) {
      // Hold full coverage at the midpoint (a few frames at most) if the
      // incoming arena's first view is still being built: never show holes.
      const atSwap = !tr.swapped && (tr.t + 1) / tr.dur >= 0.5;
      if (atSwap && tr.toView && !tr.toView.ready && tr.hold < HOLD_MAX) tr.hold++;
      else tr.t++;
      const k = tr.t / tr.dur;
      if (!tr.swapped) {
        const m = smooth(k / 0.5);
        lerpBg(this.bg.biome, tr.start, tr.to.bg, m);
        this.bg.speed = tr.speed0 + (BASE_SCROLL * tr.to.scrollSpeed - tr.speed0) * m;
        if (k >= 0.5) this._swap(tr);
      }
      if (tr.t >= tr.dur) this.finish();
    }
    if (this.view) this.view.update();
    if (this.cur && this.cur.noStructs) this.parallax.structs.length = 0;
    for (const a of this.amb) if (a.A.update) a.A.update(a.s, this);
  }

  /** World-space FX hooks for gameplay presentation (impacts, tread marks, wakes). */
  get fx() { return this.view ? this.view.fx : null; }

  /** Arena layers + transition effect: over the parallax, under all entities. */
  renderUnder(b, alpha, time) {
    if (!this.active) return;
    const F = this.F, cur = this.cur;
    if (this.view) this.view.renderFx(b, alpha);
    if (cur) {
      if (cur.darkness > 0) b.draw(F.white, W / 2, H / 2, W + 20, H + 20, 0, 0, 0, 0, cur.darkness, 0);
      if (cur.tint) { const c = cur.tint; b.draw(F.white, W / 2, H / 2, W + 20, H + 20, 0, c[0], c[1], c[2], c[3], 0); }
      for (const a of this.amb) a.A.draw(b, F, a.s, time);
    }
    const tr = this.tr;
    if (tr) tr.fx.draw(b, F, Math.min(1, Math.max(0, (tr.t - 1 + alpha) / tr.dur)), tr, time);
    if (this.cover > 0) b.draw(F.white, W / 2, H / 2, W + 40, H + 40, 0, 0, 0, 0, smooth(this.cover), 0);
  }

  /** Score stars: over the world, under enemy bullets. */
  renderOver(b, alpha) {
    if (this.active && this.cur && this.cur.light > 0) this._renderVision(b);
    this.stars.render(b, alpha);
  }

  /**
   * Abyssal darkness: a veil over enemies and the background with a pool of
   * light around the player. Bullets render after this, so they stay visible.
   */
  _renderVision(b) {
    const p = this.world.player, F = this.F, cur = this.cur;
    const x = p ? p.x : W / 2, y = p ? p.y : H * 0.8;
    const a = Math.min(0.92, cur.darkness + 0.1); // faint silhouettes survive
    const s = cur.light * 2.6, h = s / 2;
    b.draw(F.darkhole, x, y, s, s, 0, 1, 1, 1, a, 0);
    const k = (x0, y0, x1, y1) => { if (x1 > x0 && y1 > y0) b.draw(F.white, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, 0, 0, 0, a, 0); };
    k(-20, -20, W + 20, y - h);
    k(-20, y + h, W + 20, H + 20);
    k(-20, y - h, x - h, y + h);
    k(x + h, y - h, W + 20, y + h);
  }
}
