import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, outline, neonLines } from '../fx/art.js';
import { DMG_IGNORES_SHIELDS, DMG_INSTANT_KILL } from '../core/damage.js';
import { crescentPts } from './miguerreFx.js';
import { tessArt, tessMechaFx } from './tessArt.js';
import {
  renderShots, renderCut, renderClones, renderShadow, renderWaves, buildSprites as buildFxSprites,
  bladeRelease, shadowParticles, shadowBurst, cloneBurst, waveTrail, cutFx,
} from './tessFx.js';
import { buildUltSprites, ultParticles, renderUlt, launchFx, annihilate, detonateFx, SQ } from './tessUltFx.js';
import { rigState, step as rigStep, release } from './tessRig.js';
import { TESS, clampT } from './tessTuning.js';

// TESS KURO — WIREGHOST (blade mecha)
// Crescent Blades: homing crescents at any range that cut bullets on their path
// Focus: two glitch clones ahead of her throw her exact volley
// Special: Shadow Form (10 s, every attack phases through her)
// Bomb: Thousand Cuts + a three-crescent fan from her and both clones
// Ultimate: Void Cross Annihilation (her lover Miguerre Zo'Rajah's crescent, crossed
// with a void spear; it clears its path and detonates like a nuclear blast)
//
// TESS v2 (ASSET_NOTES.md "Rebuild v2"): the component mecha (tessArt.js +
// tessRig.js + tessFx.js) replaces drawShip() when the art loads; drawShip()
// stays as the automatic fallback. Every volley is one arm's slash, the arms
// alternating; the crescents leave that blade along its length. The leg
// blades (feet) never fire.

const VIOLET = [0.75, 0.4, 1.0];
const UP = -Math.PI / 2;
const KILL = DMG_INSTANT_KILL | DMG_IGNORES_SHIELDS;
const TAG_SELF = 1, TAG_CLONE = 3;
const NEVER = 1 << 30;

/** Main bosses (arena bosses, their parts, the stage core) resist the ultimate; mid-bosses do not. */
const isMainBoss = (e) => !!(e.ctrl || e.kind === 'bosspart' || (e.boss && e.kind !== 'gatekeeper'));
const onField = (e) => e.alive && !e.untargetable && e.x > -20 && e.x < WORLD_W + 20 && e.y > -20 && e.y < WORLD_H + 20;
const inSight = (e) => e.alive && !e.untargetable && e.x > 0 && e.x < WORLD_W && e.y > 0 && e.y < WORLD_H;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Tier 2+: wingtip blade fins.
  if (tier >= 2) {
    const len = tier >= 4 ? 14 : 9;
    mirrorPath(ctx, cx, [20, 30, 23, 30 - len, 24.5, 31, 22, 35]);
    ctx.fillStyle = '#2a1d3a'; ctx.fill(); outline(ctx, 0.6);
    neonLines(ctx, cx, [20.5, 30, 23, 30 - len], 'rgba(255,90,200,1)', 0.7, 5);
  }
  // Flying-wing hull.
  mirrorPath(ctx, cx, [0, 2, 4, 10, 23, 33, 23, 38, 15, 36, 9, 42, 0, 38]);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#4b3d60'); g.addColorStop(0.45, '#17121f'); g.addColorStop(1, '#07050a');
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  // Facets.
  ctx.fillStyle = 'rgba(160,130,210,0.18)';
  mirrorPath(ctx, cx, [0, 3, 3.5, 11, 10, 25, 0, 28]); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx, 3); ctx.lineTo(cx, 38); ctx.stroke();
  neonLines(ctx, cx, [4, 10, 23, 33, 15, 36, 9, 42], 'rgba(190,110,255,1)', 0.7, 6);
  // Tier 3+: forward blade canards.
  if (tier >= 3) {
    mirrorPath(ctx, cx, [5, 14, 13, 8, 9, 19]);
    ctx.fillStyle = '#20172c'; ctx.fill(); outline(ctx, 0.5);
    neonLines(ctx, cx, [5.5, 14, 13, 8], 'rgba(255,90,200,1)', 0.6, 4);
  }
  // Tier 4: tail spikes.
  if (tier >= 4) {
    mirrorPath(ctx, cx, [3, 38, 6, 46, 1, 41]);
    ctx.fillStyle = '#1a1222'; ctx.fill(); outline(ctx, 0.5);
  }
  // Cockpit slit.
  ctx.save(); ctx.shadowColor = '#ff4fd0'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ff7ae0';
  mirrorPath(ctx, cx, [0, 12, 1.6, 16, 0.8, 22, 0, 22]); ctx.fill();
  ctx.restore();
}

function drawBlade(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 0.5;
  const g = ctx.createRadialGradient(cx - R * 0.3, cy, R * 0.4, cx, cy, R);
  g.addColorStop(0, 'rgba(200,120,255,0.3)');
  g.addColorStop(0.75, 'rgba(255,170,240,1)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx - R * 0.45, cy, R * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------- crescents

/** Enemies in sight for a volley of n crescents: a random one each (spread over the field), or null. */
function pickTargets(w, n) {
  const E = w.enemies.active.filter(inSight), out = [];
  for (let k = 0; k < n; k++) out.push(E.length ? E[w.rng.int(0, E.length - 1)] : null);
  return out;
}

/** Nearest enemy in sight from (x, y), preferring ones ahead (a crescent whose target died). */
function nextTarget(w, x, y) {
  let best = null, bd = Infinity;
  for (const e of w.enemies.active) {
    if (!inSight(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2 + (e.y > y + 30 ? 1e5 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * One volley from the blade of arm `side` of the mecha at (x, y) (Tess, or a
 * clone: a full copy with the same pose). The crescents leave the blade along
 * its length, launch at random angles and chase a random enemy in sight.
 */
function volley(p, w, x, y, side, mul, tag) {
  const T = clampT(p), B = TESS.blades, S = w.shots, R = w.rng, s = side < 0 ? 'L' : 'R';
  const n = B.n[T], sz = B.size[T], dmg = B.dmg[T] * mul;
  const [bx, by] = tessArt.animatedAnchor(p, 'bladeBase' + s, x, y), [tx, ty] = tessArt.animatedAnchor(p, 'bladeTip' + s, x, y);
  const tg = pickTargets(w, n);
  for (let k = 0; k < n; k++) {
    const u = 0.22 + 0.72 * (k + 0.5) / n + R.range(-0.04, 0.04);
    const sx = bx + (tx - bx) * u, sy = by + (ty - by) * u;
    const a = UP - side * 0.2 + R.range(-B.spread, B.spread);
    const i = w.shot(sx, sy, a, B.speed[T], p.ps.fBlade, dmg, B.r * sz);
    if (i < 0) break;
    S.behave(i, dmg, 0, 1, 0, 0, tag);
    S.ref[i] = { e: tg[k] };
    bladeRelease(p, w, sx, sy, a, sz, tag === TAG_CLONE);
  }
}

/**
 * Each step: crescents erase enemy bullets along the path they just flew, never
 * hit the same enemy twice, and steer toward their target until they hit it (then fly straight on), or for
 * B.seek steps at most.
 */
function steer(p, w) {
  const S = w.shots, B = TESS.blades, turn = B.turn[clampT(p)];
  for (let i = 0; i < S.count; i++) {
    const tag = S.aux[i];
    if (tag !== TAG_SELF && tag !== TAG_CLONE) continue;
    w.cancelLine(S.px[i], S.py[i], S.x[i], S.y[i], S.radius[i] * 2);
    // Each crescent hits each enemy once: the engine's piercing re-hit (every PIERCE_REHIT
    // steps on the last enemy hit) is switched off by pushing the hit time far ahead.
    if (S.hitUid[i] && S.hitT[i] < NEVER) S.hitT[i] = NEVER;
    const r = S.ref[i];
    if (!r || !r.e) continue;
    const e = r.e;
    if (S.hitUid[i] === e.uid || S.age[i] > B.seek) { r.e = null; continue; }
    if (!e.alive || e.untargetable) { r.e = S.age[i] < B.seek - 10 ? nextTarget(w, S.x[i], S.y[i]) : null; continue; }
    let d = Math.atan2(e.y - S.y[i], e.x - S.x[i]) - S.ang[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    S.setHeading(i, S.ang[i] + clamp(d, -turn, turn));
  }
}

// ------------------------------------------------------------- clones

/** Clones are out in focus and for the whole bomb (alpha p.ps.cloneA fades them in and out). */
const clonesWanted = (p) => p.state === 'alive' && (p.focus || p.ps.bombT >= 0);
const clonesOn = (p) => p.ps.cloneA > 0.5;

function stepClones(p, w) {
  const ps = p.ps, C = TESS.clones, want = clonesWanted(p);
  const was = ps.cloneA;
  ps.cloneA = clamp(ps.cloneA + (want ? 1 : -1) / C.fade, 0, 1);
  ps.clones.forEach((c, k) => {
    const tx = clamp(p.x + C.at[k][0], 14, WORLD_W - 14), ty = clamp(p.y + C.at[k][1], 30, WORLD_H - 30);
    if (was === 0) { c.x = p.x; c.y = p.y; } // they spring out of her
    c.px = c.x; c.py = c.y;
    c.x += (tx - c.x) * (was === 0 ? 0.5 : C.follow);
    c.y += (ty - c.y) * (was === 0 ? 0.5 : C.follow);
  });
  if (was === 0 && ps.cloneA > 0) for (const c of ps.clones) cloneBurst(p, w, c.x, c.y, true);
  if (was > 0 && ps.cloneA === 0) for (const c of ps.clones) cloneBurst(p, w, c.x, c.y, false);
}

// ------------------------------------------------------------- bomb waves

/** Points along a wide crescent wave (convex side forward along its heading). */
function wavePts(v, n = 10) {
  const R = v.w * 0.5, dx = Math.cos(v.ang), dy = Math.sin(v.ang);
  const cx = v.x - dx * R * 0.55, cy = v.y - dy * R * 0.55, out = [];
  for (let j = 0; j <= n; j++) {
    const th = v.ang + (-1 + 2 * j / n) * 1.05;
    out.push([cx + Math.cos(th) * R, cy + Math.sin(th) * R]);
  }
  return out;
}

function stepWaves(p, w) {
  const ps = p.ps, Bm = TESS.bomb;
  for (const v of ps.waves) {
    v.t++;
    v.x += Math.cos(v.ang) * Bm.speed; v.y += Math.sin(v.ang) * Bm.speed;
    for (const [qx, qy] of wavePts(v)) {
      w.cancelCircle(qx, qy, 16);
      for (const e of w.enemies.active) {
        if (!onField(e) || v.hit.has(e)) continue;
        if ((e.x - qx) ** 2 + (e.y - qy) ** 2 < (e.r + 14) ** 2) { v.hit.add(e); w.damage(e, Bm.dmg); cutFx(p, w, e.x, e.y); }
      }
    }
    waveTrail(p, w, v, wavePts(v, 6));
  }
  if (ps.waves.length) ps.waves = ps.waves.filter((v) => v.y > -v.w && v.y < WORLD_H + v.w && v.x > -v.w && v.x < WORLD_W + v.w);
}

// ------------------------------------------------------------- ultimate

/** The cross's hit area at (x, y): the wings (Miguerre's crescent band squashed flat, as circles), the bar and the spear ahead of the core. */
function crossHits(w, U, fn) {
  const c = { x: U.x, y: U.y, w: U.w };
  for (const q of crescentPts(c, 14)) fn(q.mx, U.y + (q.my - U.y) * SQ, q.th * SQ / 2 + 18);
  for (let xx = -U.w * 0.5; xx <= U.w * 0.5; xx += 30) fn(U.x + xx, U.y, 18);
  const top = U.y - TESS.ult.spear;
  for (let yy = U.y; yy >= top; yy -= 24) fn(U.x, yy, 22);
}

function stepUlt(p, w, t) {
  const U = p.ps.ult, X = TESS.ult;
  if (!U) return;
  U.t = t;
  if (U.ph === 'compress') {
    U.x = p.x; U.y = p.y - 40;
    if (t >= X.compress) {
      U.ph = 'travel'; U.t0 = t;
      U.steps = clamp(Math.ceil((U.y - X.top) / X.speed), 1, X.maxTravel);
      launchFx(p, w, U);
    }
  } else if (U.ph === 'travel') {
    U.y -= X.speed;
    const hit = new Set();
    crossHits(w, U, (x, y, r) => {
      w.cancelCircle(x, y, r);
      for (const e of w.enemies.active) if (onField(e) && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) hit.add(e);
    });
    for (const e of hit) {
      if (isMainBoss(e)) { if (t % X.bossEvery === 0) w.damage(e, X.bossDmg, DMG_IGNORES_SHIELDS); continue; }
      if (U.gone.has(e)) continue;
      U.gone.add(e);
      const big = !!(e.boss || e.def?.big);
      w.damage(e, 1, KILL);
      annihilate(p, w, e.x, e.y, big, e.r);
    }
    if (t - U.t0 >= U.steps) { U.ph = 'crit'; U.t0 = t; }
  } else if (U.ph === 'crit') {
    w.cancelCircle(U.x, U.y, 90);
    if (t - U.t0 >= X.crit) {
      U.ph = 'boom'; U.t0 = t;
      if (!U.nuked) {
        U.nuked = true;
        for (const e of w.enemies.active) if (onField(e)) { w.damage(e, X.nukeDmg, DMG_IGNORES_SHIELDS); U.nukeHits++; }
        w.cancelAll();
        detonateFx(p, w, U);
      }
    }
  } else if (U.ph === 'boom' && t - U.t0 < 50) w.cancelAll();
}

// ------------------------------------------------------------- the pilot

export default {
  id: 'tess',
  name: 'TESS KURO',
  vehicle: 'WIREGHOST',
  role: 'Blade Mecha',
  bio: "Ex-syndicate infiltrator turned precinct ghost. The man she loves, Miguerre Zo'Rajah, went rogue among the stars, and Tess flies sector to sector looking for the night he comes back. Her Wireghost, a violet blade mecha, throws his crescent cuts across the whole sky: void tricks she watched him do once, then did better.",
  color: VIOLET,
  css: '#c07aff',
  stats: { speed: 4, power: 4, range: 5, bomb: 3 },
  speed: { normal: 4.9, focus: 2.2 },
  hitbox: 2.2,
  bombStock: 2,
  engines: [[-4, 20], [4, 20]],
  engineColor: [0.8, 0.4, 1.0],
  optionSprite: null,
  // Procedural fallback, matched to pilot-portrait-main.jpg (long scarlet hair, red eyes, dark bodysuit).
  portrait: { skin: '#f2d6d0', hair: '#d8264a', style: 'long', eyes: 'eyes', iris: '#d0203a', suit: '#2a2c3c' },
  weapons: {
    main: 'Crescent Blades — each arm slash throws crescents off the blade that hunt enemies at any range and cut bullets on their path',
    focus: 'Glitch Clones — two glitching copies ahead of her throw her exact volley',
  },
  // The Wireghost's paint (violet / lilac armour, red light lines) + violet energy.
  palette: { armour: '#b8b4e6', frame: '#2c2648', plating: '#5a46a8', energy: '#c07aff' },
  art: tessArt,
  special: {
    name: 'SHADOW FORM',
    desc: 'She becomes a living shadow for 10 s: every attack phases through her',
    cooldown: TESS.shadow.cd,
    duration: TESS.shadow.dur,
    activate(p, w) {
      p.ps.shadow = { t: 0 };
      shadowBurst(p, w, true);
    },
    update(p, w, t) {
      if (!p.ps.shadow) return;
      p.ps.shadow.t = t;
      shadowParticles(p, w);
    },
    end(p, w) {
      if (p.ps.shadow) shadowBurst(p, w, false);
      p.ps.shadow = null;
    },
  },
  bomb: {
    name: 'THOUSAND CUTS',
    duration: TESS.bomb.dur,
    activate(p) { p.ps.cuts = []; p.ps.bombT = 0; },
    update(p, w, t) {
      const ps = p.ps, Bm = TESS.bomb;
      ps.bombT = t;
      w.cancelAll();
      // The three-crescent fan from her and from each clone (both arms slash).
      if (t === Bm.at) {
        const at = [[p.x, p.y - 30], ...ps.clones.map((c) => [c.x, c.y - 30])];
        for (const [x, y] of at) for (const a of Bm.fan) ps.waves.push({ x, y, ang: UP + a, w: Bm.w, t: 0, hit: new Set() });
        release(p, -1); release(p, 1);
        w.r.post.flash(0.8, 0.3, 1, 0.3, 0.06);
        w.r.post.shockwave(p.x, p.y - 40, 0.03, 0.025, 0.4);
        w.g.camera.addTrauma(0.3);
      }
      // Thousand Cuts: screen-wide slash lines (unchanged).
      if (t % 3 === 0 && t < 96) {
        const E = w.enemies.active.filter((e) => e.alive && e.y > 0);
        const tgt = E.length && w.rng.chance(0.6) ? w.rng.pick(E) : { x: w.rng.range(40, WORLD_W - 40), y: w.rng.range(40, WORLD_H - 120) };
        const a = w.rng.angle(), L = 420;
        const cut = { x0: tgt.x - Math.cos(a) * L, y0: tgt.y - Math.sin(a) * L, x1: tgt.x + Math.cos(a) * L, y1: tgt.y + Math.sin(a) * L, t: 0 };
        ps.cuts.push(cut);
        w.damageLine(cut.x0, cut.y0, cut.x1, cut.y1, 14, 9);
        w.explosions.sparks(tgt.x, tgt.y, 8, [1.0, 0.45, 0.1], 5, 16, 4);
        w.explosions.sparks(tgt.x, tgt.y, 6, VIOLET, 6, 14, 5);
        w.r.post.shockwave(tgt.x, tgt.y, 0.012, 0.025, 0.25);
        w.g.camera.addTrauma(0.08);
      }
      for (const c of ps.cuts) c.t++;
      ps.cuts = ps.cuts.filter((c) => c.t < 12);
    },
    end(p) { p.ps.cuts = []; p.ps.bombT = -1; },
  },
  ultimate: {
    name: 'VOID CROSS',
    duration: TESS.ult.dur,
    activate(p, w) {
      p.ps.ult = { ph: 'compress', t: 0, t0: 0, x: p.x, y: p.y - 40, w: TESS.ult.w, steps: 0, gone: new Set(), nuked: false, nukeHits: 0 };
      w.r.post.flash(0.6, 0.3, 1, 0.2, 0.05);
    },
    update(p, w, t) { stepUlt(p, w, t); },
    end(p) { p.ps.ult = null; },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_tess_${t}`, 50, 46, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('t_blade', 18, 18, drawBlade, { scale: 3 });
    tessArt.buildSprites(atlas);
    buildFxSprites(atlas);
    buildUltSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip(p, b, x, y, a) {
    if (p.ps.shadow) return renderShadow(p, b, x, y, a);
    return tessArt.renderMecha(p, b, x, y, a);
  },
  exhaust: tessArt.exhaust,
  renderShots,
  hitSpark: tessMechaFx.hitSpark,
  /** Shadow Form: every attack passes through her. */
  intangible: (p) => !!p.ps.shadow,

  init(p, w) {
    const ps = p.ps;
    ps.fBlade = w.r.frame('t_blade');
    ps.clones = TESS.clones.at.map(() => ({ x: p.x, y: p.y, px: p.x, py: p.y }));
    ps.cloneA = 0;
    ps.waves = [];
    ps.cuts = [];
    ps.bombT = -1;
    ps.shadow = null;
    ps.ult = null;
    rigState(p);
  },

  reset(p) {
    p.ps.shadow = null;
    p.ps.cloneA = 0;
  },

  optionLayout: () => [],

  update(p, w) {
    tessArt.animate(p);
    rigStep(p);
    stepClones(p, w);
    steer(p, w);
    stepWaves(p, w);
    if (p.ps.ult) ultParticles(p, w, p.ps.ult);
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    p.fireCd = TESS.blades.cd;
    const side = release(p, rigState(p).next);
    volley(p, w, p.x, p.y, side, 1, TAG_SELF);
    if (clonesOn(p)) for (const c of p.ps.clones) volley(p, w, c.x, c.y, side, TESS.clones.mul, TAG_CLONE);
  },

  renderBelow(p, b, x, y, alpha) {
    renderClones(p, b, alpha);
  },

  renderFx(p, b) {
    renderWaves(p, b, p.ps.waves, wavePts);
    for (const c of p.ps.cuts) renderCut(p, b, c);
    if (p.ps.ult) renderUlt(p, b, p.ps.ult);
  },
};
