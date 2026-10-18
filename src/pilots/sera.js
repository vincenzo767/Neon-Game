import { mirrorPath, chrome, neonLines, outline, canopy, glowDot } from '../fx/art.js';
import { TAU, W, H, targets, stun, shipScale } from './common.js';
import { seraArt } from './seraArt.js';
import { rigState, step as rigStep, release, flare, charge } from './seraRig.js';
import {
  seraFxSprites, frames as fxFrames, hitSpark, volleyFx, shatter, snow, bladeVapour,
  renderShots, renderFrost, renderField, fieldSnow, renderStorm, stormParticles, freezeBurst,
  renderRain, arrowImpact, renderFrozenBullets, renderAbsolute, absoluteParticles, makeIceField, iceFieldShatter,
} from './seraFx.js';

// SERA VOSS — GLACIER (frost archer) · LEGENDARY (ASSET_NOTES.md, the owner's
// ice-mecha specification; decisions 1A, 2B, 3A, 4A)
// Frost Shards: volleys of 4 / 8 / 12 / 16 piercing ice shards from her bow;
// every hit builds frost on an enemy (slower and slower, then frozen solid)
// Zero Field (passive): enemy bullets freeze and shatter at its edge (unlimited)
// Glacial Focus: faster volleys, a bigger Zero Field
// Special: Ice Storm Surge (a storm expands from her; every enemy it reaches
// freezes for 7 s) · Bomb: Frost Arrow Rain (countless ice arrows from the sky
// freeze anything they touch, bullets too) · Ultimate: Absolute Zero (the whole
// screen freezes for 12 s, bosses too; only she moves and attacks)
//
// The hand-made mecha art (seraArt.js + seraRig.js + seraFx.js) replaces
// drawShip() when it loads; drawShip() stays as the automatic fallback. Every
// shard leaves the nock at her drawing fist; the crystal leg spikes (feet) never
// fire. No thrusters: frost vapour off the ice-blade wings.

const ICE = [0.6, 0.9, 1.0];
const FIRE_CD = 7, FOCUS_CD = 4;   // steps between volleys (Glacial Focus fires faster)
const SPEED = 14;
const REF = 220;                   // the fan's lanes are laid out this far ahead of her, centred on her
const FROST_HIT = 0.08;            // frost per shard hit (regular enemies; full at ~13 hits)
const SLOW = 0.6;                  // full frost: their AI (moving, firing) runs 60 % slower
const FREEZE_T = 90;               // full frost: frozen solid 1.5 s, then thawed back to half
const FROST_FADE = 0.004;          // frost fades this much a step once they stop being hit (after 0.5 s)
const FIELD_R = 60, FIELD_FOCUS = 95; // Zero Field radius (Glacial Focus expands it)
const STORM_R = 260, STORM_V = 9, STORM_T = 420, STORM_LIFE = 150, STORM_DMG = 10, STORM_BOSS = 30;
const RAIN_T = 180, RAIN_FREEZE = 180;
const ABS_T = 720, ABS_ACT = 20, ABS_REL = 12; // Absolute Zero: 12 s; the activation; the release

/** Shards per volley: 4 / 8 / 12 / 16. */
const volley = (t) => 4 * t;
/** Damage per shard (tuned with tools/dps.mjs: boss T4 ≈ 130 shot, ≈ 150 focus). */
const shardDmg = (t, focus) => (focus ? 0.42 + 0.053 * t : 0.84 + 0.112 * t);
const isBoss = (e) => !!(e.boss || e.ctrl || e.kind === 'bosspart');

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Ice-blade outriggers (longer with tier).
  for (const s of [-1, 1]) {
    const L = 10 + tier * 3;
    ctx.beginPath(); ctx.moveTo(cx + s * 12, 18); ctx.lineTo(cx + s * (12 + L), 30); ctx.lineTo(cx + s * (12 + L * 0.6), 40); ctx.lineTo(cx + s * 12, 36); ctx.closePath();
    const g = ctx.createLinearGradient(cx + s * 12, 0, cx + s * (12 + L), 0);
    g.addColorStop(0, 'rgba(160,220,255,0.95)'); g.addColorStop(1, 'rgba(230,250,255,0.6)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,50,80,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  mirrorPath(ctx, cx, [0, 2, 5, 8, 9, 18, 12, 30, 11, 44, 6, 52, 0, 53]);
  ctx.fillStyle = chrome(ctx, cx - 12, cx + 12, '#0a1420', '#5a7a96', '#e0f0ff'); ctx.fill(); outline(ctx);
  ctx.strokeStyle = 'rgba(10,30,50,0.6)'; ctx.lineWidth = 0.5;
  for (const y of [14, 24, 34, 44]) { ctx.beginPath(); ctx.moveTo(cx - 9, y); ctx.lineTo(cx + 9, y); ctx.stroke(); }
  glowDot(ctx, cx, 5, 3, 'rgba(170,230,255,1)');
  if (tier >= 2) for (const s of [-1, 1]) glowDot(ctx, cx + s * 9, 20, 2.4, 'rgba(170,230,255,1)');
  if (tier >= 3) for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 7, 44, 3, 6, 0, 0, TAU); ctx.fillStyle = 'rgba(140,210,255,0.85)'; ctx.fill(); outline(ctx, 0.5); }
  if (tier >= 4) neonLines(ctx, cx, [4, 10, 10, 2, 8, 14, 16, 8], 'rgba(200,240,255,1)', 0.8, 6);
  canopy(ctx, cx, 28, 3, 5, '#ffffff', '#aee8ff', '#0a2034');
}

// ------------------------------------------------------------- freezing

/** Track an enemy that carries frost or ice (for the FX and the thaw). */
function track(p, e) { if (!e.frostTracked) { e.frostTracked = true; p.ps.frosty.push(e); } }

/**
 * Chill a regular enemy: its AI (moving and firing) runs only part of the time
 * as frost builds, and its clock is held back on the skipped steps, so paths
 * and fire schedules slow down together. Restored once the frost is gone.
 * (Bosses and boss parts are never chilled: their controllers own their phases.)
 */
function chill(e) {
  if (!e.ai || e.ai.chilled || e.ai.stunned || isBoss(e)) return;
  const ai = e.ai;
  const wrap = (en, w) => {
    if (!(en.frost > 0.001)) { en.ai = ai; return ai(en, w); }
    en.frostAcc = (en.frostAcc || 0) + 1 - SLOW * en.frost;
    if (en.frostAcc >= 1) { en.frostAcc -= 1; return ai(en, w); }
    en.t--;
  };
  wrap.chilled = true;
  e.ai = wrap;
}

/** Freeze an enemy solid for `steps` (regular: stunned in an ice casing; bosses only show frost). */
function freeze(p, e, steps) {
  track(p, e);
  if (isBoss(e)) { e.frost = Math.max(e.frost || 0, 0.6); return; }
  stun(e, steps);
  if (!(e.frozenT > 0)) { e.frozenMax = steps; e.iceAge = 0; }
  e.frozenT = Math.max(e.frozenT || 0, steps);
}

/** Frost fades, casings count down and break (each step). */
function stepFrost(p, w) {
  const ps = p.ps;
  for (const e of ps.frosty) {
    if (!e.alive) { e.frostTracked = false; continue; }
    if (e.frozenT > 0) e.iceAge = (e.iceAge || 0) + 1;
    if (e.frozenT > 0 && --e.frozenT === 0) {
      // The casing fractures and breaks away; it thaws back to half frost.
      shatter(w, e.x, e.y, 1.5);
      e.frost = isBoss(e) ? 0 : 0.5;
      e.frostHit = w.t;
    }
    if (!(e.frozenT > 0) && e.frost > 0 && w.t - (e.frostHit || 0) > 30) e.frost = Math.max(0, e.frost - FROST_FADE);
    if (!(e.frost > 0) && !(e.frozenT > 0)) e.frostTracked = false;
  }
  if (ps.frosty.length) ps.frosty = ps.frosty.filter((e) => e.frostTracked);
}

/** An enemy held in an ice casing for `steps` (visual; Absolute Zero holds its AI through World.enemyHold). */
function encase(p, e, steps) {
  track(p, e);
  if (!(e.frozenT > 0)) { e.frozenMax = steps; e.iceAge = 0; }
  e.frozenT = Math.max(e.frozenT || 0, steps);
  e.held = true;
  if (isBoss(e)) e.frost = Math.max(e.frost || 0, 0.6);
}

/** Absolute Zero holds every enemy (bosses included, while they fight) through World.enemyHold. */
function holdAll(p, w) {
  w.enemyHold = (e) => !!(p.ps.az && p.ps.az.frozen) && (!e.ctrl || e.ctrl.state === 'fight');
}

/** Stop enemy bullet i dead, in ice. */
function freezeBullet(B, i) {
  B.dyn[i] = 0;
  if (B.spd[i] !== 0) B.setHeading(i, B.ang[i], 0);
}

/** Every frozen enemy bullet shatters (cleared). */
function shatterFrozen(w) {
  const B = w.bullets;
  let i = 0, n = 0;
  while (i < B.count) {
    if (B.spd[i] === 0 && B.dyn[i] === 0) { if (n++ < 60 || (i & 3) === 0) shatter(w, B.x[i], B.y[i], 0.6, n < 30); B.remove(i); } else i++;
  }
}

// ------------------------------------------------------------- the Zero Field

/**
 * Zero Field (passive, unlimited per the owner's 2B): every enemy bullet that
 * reaches its edge freezes into a crystal there and shatters. Lasers and beams
 * aren't bullets and pass through.
 */
function stepField(p, w) {
  const ps = p.ps, zf = ps.zf, alive = p.state === 'alive';
  const target = alive ? (p.focus ? FIELD_FOCUS : FIELD_R) : 0;
  if (target > zf.r + 10 && zf.pulse <= 0) { zf.pulse = 1; zf.pulseR = zf.r; } // focus: the expansion ripple
  zf.r += (target - zf.r) * 0.18;
  zf.up += ((p.focus ? 1 : 0) - zf.up) * 0.15;
  if (zf.pulse > 0) { zf.pulse -= 0.06; zf.pulseR += 6; }
  if (zf.hits.length) zf.hits = zf.hits.filter((h) => p.t - h.t < 22);
  if (!alive || zf.r < 20) return;
  const B = w.bullets, R2 = zf.r * zf.r;
  let i = 0, n = 0;
  while (i < B.count) {
    const dx = B.x[i] - p.x, dy = B.y[i] - p.y;
    if (dx * dx + dy * dy < R2) {
      if (n++ < 6) {
        shatter(w, B.x[i], B.y[i], 0.7);
        if (zf.hits.length < 24) zf.hits.push({ a: Math.atan2(dy, dx), x: B.x[i], y: B.y[i], t: p.t });
      }
      B.remove(i);
    } else i++;
  }
  fieldSnow(p, w);
}

// ------------------------------------------------------------- the kit

/** A volley of Frost Shards from the nock, its lanes laid out across her path. */
function frostVolley(p, w) {
  const t = p.tier, S = w.shots, n = volley(t), d = shardDmg(t, p.focus);
  const [nx, ny] = seraArt.animatedAnchor(p, 'nock');
  const span = (30 + 9 * n) * (p.focus ? 0.45 : 1);
  release(p);
  for (let k = 0; k < n; k++) {
    const u = n > 1 ? k / (n - 1) - 0.5 : 0;
    const ang = Math.atan2(p.y - REF - ny, p.x + u * span - nx);
    // Staggered lanes: alternate shards start a little behind and fly a touch slower.
    const back = (k & 1) * 6, sp = SPEED - (k & 1) * 1.2;
    const i = w.shot(nx - Math.cos(ang) * back, ny - Math.sin(ang) * back, ang, sp, p.ps.fShard, d, 5, 1 + t * 0.06);
    if (i >= 0) S.behave(i, d, 0, 1);
  }
  volleyFx(p, w, nx, ny);
}

/** Ice Storm Surge: the wave front grows; each enemy freezes as it reaches it; bullets it passes shatter. */
function stepStorm(p, w) {
  const st = p.ps.storm;
  if (!st) return;
  st.t++;
  const r0 = st.r;
  st.r = Math.min(STORM_R, st.r + STORM_V);
  if (st.r > r0) {
    for (const e of targets(w)) {
      if (st.hit.has(e)) continue;
      const d = Math.hypot(e.x - st.x, e.y - st.y) - (e.r || 0);
      if (d > st.r) continue;
      st.hit.add(e);
      w.damage(e, isBoss(e) ? STORM_BOSS : STORM_DMG);
      if (e.alive) freeze(p, e, STORM_T);
      freezeBurst(w, e);
    }
    const B = w.bullets;
    let i = 0;
    while (i < B.count) {
      const d = Math.hypot(B.x[i] - st.x, B.y[i] - st.y);
      if (d < st.r && d > r0 - 12) { if ((i & 3) === 0) shatter(w, B.x[i], B.y[i], 0.6, false); B.remove(i); } else i++;
    }
    for (const s of st.spikes) if (s.t0 < 0 && Math.hypot(s.x - st.x, s.y - st.y) < st.r) { s.t0 = st.t; snow(w, s.x, s.y, 3, 8, -0.6); }
  }
  stormParticles(p, w);
  if (st.t >= st.life) {
    for (const s of st.spikes) if (s.t0 >= 0) shatter(w, s.x, s.y - s.h / 2, 1.2);
    p.ps.storm = null;
  }
}

export default {
  id: 'sera',
  name: 'SERA VOSS',
  vehicle: 'GLACIER',
  role: 'Frost Archer',
  legendary: true,
  bio: 'Queen of a frozen court beyond the Upper Breach and wife of Vincenzo the Conqueror. When the Herald stepped through to serve the Precinct, Sera followed him. Where he walks, the storm stops; where she draws her bow, it freezes in the air.',
  color: ICE,
  css: '#9ae4ff',
  stats: { speed: 4, power: 5, range: 5, bomb: 4 },
  previewScale: 1.25, // select card: her front view (wings and the long bow) is tall and narrow
  speed: { normal: 4.6, focus: 2.0 },
  hitbox: 2.6,
  bombStock: 3,
  engines: [[-4, 26], [4, 26]],
  engineColor: [0.6, 0.9, 1.0],
  // Procedural fallback, matched to pilot-portrait.png (silver hair, crystal crown, violet eyes).
  portrait: { skin: '#f4e2d6', hair: '#dfe6ee', style: 'long', eyes: 'eyes', iris: '#b8a8ff', accent: 'crown', suit: '#2a3a66' },
  weapons: {
    main: 'Frost Shards — volleys of 4 / 8 / 12 / 16 piercing ice shards from her bow; hits build frost that slows enemies until they freeze solid · Zero Field: enemy bullets freeze and shatter at its edge',
    focus: 'Glacial Focus — faster volleys and a wider Zero Field',
  },
  art: seraArt,
  special: {
    name: 'ICE STORM SURGE',
    desc: 'A winter storm surges out from her: every enemy it reaches freezes solid for 7 s, and the bullets it passes shatter',
    cooldown: 900,
    duration: STORM_LIFE,
    activate(p, w) {
      const R = w.fxRng, spikes = [];
      for (let k = 0; k < 14; k++) {
        const an = k / 14 * TAU + R.range(-0.2, 0.2), d = R.range(0.3, 0.95) * STORM_R;
        spikes.push({ x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d, h: R.range(26, 46), w: R.range(9, 14), rot: R.range(-0.3, 0.3), t0: -1, n: k });
      }
      p.ps.storm = { x: p.x, y: p.y, r: 0, t: 0, life: STORM_LIFE, hit: new Set(), spikes };
      shatter(w, p.x, p.y, 2.5);
      snow(w, p.x, p.y, 10, 30, 0);
      w.r.post.flash(0.6, 0.85, 1, 0.4, 0.05);
      w.r.post.shockwave(p.x, p.y, 0.05, 0.025, 0.8);
      w.g.camera.addTrauma(0.3);
    },
    update(p) { flare(p, 1); },
  },
  bomb: {
    name: 'FROST ARROW RAIN',
    duration: RAIN_T,
    activate(p, w) {
      p.ps.rain = [];
      p.ps.sky = 0;
      w.r.post.flash(0.6, 0.85, 1, 0.3, 0.05);
    },
    update(p, w, t) {
      const ps = p.ps, R = w.rng, B = w.bullets;
      ps.sky = Math.min(1, t / 15) * (t > RAIN_T - 20 ? (RAIN_T - t) / 20 : 1);
      flare(p, 0.8);
      // Two arrows a step (a big one every 12), more than half aimed at enemies.
      if (t < RAIN_T - 24) {
        const es = targets(w);
        for (let k = 0; k < (t % 12 === 0 ? 3 : 2); k++) {
          const big = t % 12 === 0 && k === 0;
          const e = es.length && R.next() < 0.6 ? es[Math.floor(R.next() * es.length)] : null;
          const tx = e ? e.x + R.range(-8, 8) : R.range(10, W - 10), ty = e ? e.y : R.range(20, H - 60);
          const y0 = -30 - R.range(0, 60);
          ps.rain.push({ x: tx - 2 * (ty - y0) / 24, y: y0, tx, ty, vx: 2, vy: 24, big });
        }
      }
      for (const s of ps.rain) {
        s.x += s.vx; s.y += s.vy;
        if (s.y < s.ty) continue;
        s.done = true;
        const rad = s.big ? 60 : 36;
        w.damageCircle(s.tx, s.ty, rad, s.big ? 16 : 6);
        for (const e of targets(w)) if (e.alive && (e.x - s.tx) ** 2 + (e.y - s.ty) ** 2 < (rad + e.r) ** 2) freeze(p, e, RAIN_FREEZE);
        // Enemy bullets it touches freeze (they shatter when the rain ends).
        for (let i = 0; i < B.count; i++) if ((B.x[i] - s.tx) ** 2 + (B.y[i] - s.ty) ** 2 < rad * rad) freezeBullet(B, i);
        arrowImpact(w, s.tx, s.ty, s.big);
        if (s.big) w.g.camera.addTrauma(0.1);
      }
      if (ps.rain.length) ps.rain = ps.rain.filter((s) => !s.done);
    },
    end(p, w) { p.ps.rain = null; p.ps.sky = 0; shatterFrozen(w); },
  },
  ultimate: {
    name: 'ABSOLUTE ZERO',
    duration: ABS_T, // 12 s; the Player is invulnerable for all of it
    activate(p, w) {
      const R = w.fxRng, veins = [];
      for (let k = 0; k < 10; k++) {
        const an = R.range(0, TAU), x0 = W / 2 + Math.cos(an) * 360, y0 = H / 2 + Math.sin(an) * 420;
        veins.push([x0, y0, x0 + R.range(-160, 160), y0 + R.range(-160, 160), k * 7.7]);
      }
      p.ps.az = { t: 0, life: ABS_T, ACT: ABS_ACT, REL: ABS_REL, veins, ice: makeIceField(R), frozen: false };
      holdAll(p, w);
      w.r.post.aberrate(0.02);
    },
    update(p, w, t) {
      const az = p.ps.az;
      if (!az) return;
      az.t = t;
      flare(p, 1);
      absoluteParticles(p, w);
      if (t < ABS_ACT) { charge(p, t / ABS_ACT); return; }
      if (t === ABS_ACT) {
        w.r.post.flash(0.8, 0.95, 1, 0.8, 0.04);
        w.r.post.shockwave(W / 2, H / 2, 0.08, 0.04, 1.4);
        w.g.camera.addTrauma(0.6);
        w.g.hitStop(4);
      }
      if (t < ABS_T - ABS_REL) {
        // The battlefield holds still (owner's feedback: bosses too): every enemy, bosses and
        // their parts included, stops in an ice casing (its AI and a boss's controller are held,
        // its clock stands still); every enemy bullet, new ones too, stops in ice.
        az.frozen = true;
        if (!w.enemyHold) holdAll(p, w);
        const B = w.bullets;
        // Their clocks stop too: a timed bullet (one that splits or expires) can't go off while frozen.
        for (let i = 0; i < B.count; i++) { if (B.spd[i] === 0 && B.age[i] > 0) B.age[i]--; freezeBullet(B, i); }
        for (const e of w.enemies.active) if (e.alive) encase(p, e, 8);
      } else if (t === ABS_T - ABS_REL) {
        // Release: everything frozen cracks and breaks; frozen bullets are gone, enemies resume.
        az.frozen = false;
        // Every casing cracks for a moment, then they all break together (stepFrost).
        for (const e of p.ps.frosty) if (e.held) { e.held = false; e.frozenT = 20; }
        shatterFrozen(w);
        iceFieldShatter(w, az.ice);
        w.r.post.flash(0.7, 0.9, 1, 0.35, 0.05);
        w.r.post.shockwave(W / 2, H / 2, 0.04, 0.03, 1);
      }
    },
    end(p, w) { p.ps.az = null; if (w) w.enemyHold = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_sera_${t}`, 60, 56, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    seraFxSprites(atlas);
    seraArt.buildSprites(atlas);
  },

  renderShip: (p, b, x, y, a) => seraArt.renderMecha(p, b, x, y, a),
  renderShots,
  exhaust: bladeVapour,
  hitSpark,
  /** Frost: each shard hit builds frost on a regular enemy (bosses only show it); shards hit each enemy once. */
  pierceHit(w, i, e) {
    const p = w.player;
    w.shots.hitT[i] = 1 << 30; // no re-hit on this enemy
    track(p, e);
    e.frostHit = w.t;
    if (isBoss(e)) { e.frost = Math.min(0.6, (e.frost || 0) + 0.03); return; }
    if (e.frozenT > 0) return;
    e.frost = Math.min(1, (e.frost || 0) + FROST_HIT);
    chill(e);
    if (e.frost >= 1) freeze(p, e, FREEZE_T);
  },

  init(p, w) {
    const ps = p.ps;
    ps.fShard = w.r.frame('sv_shard');
    ps.fr = fxFrames(w);
    ps.frosty = [];
    ps.zf = { r: FIELD_R, up: 0, hits: [], pulse: 0, pulseR: 0 };
    ps.storm = null;
    ps.rain = null;
    ps.sky = 0;
    ps.az = null;
    rigState(p);
  },

  reset(p) { p.ps.storm = null; p.ps.az = null; p.ps.rain = null; if (p.w) p.w.enemyHold = null; },

  update(p, w) {
    seraArt.animate(p);
    rigStep(p);
    stepField(p, w);
    stepFrost(p, w);
    stepStorm(p, w);
  },

  optionLayout: () => [],

  fire(p, w) {
    if (p.fireCd > 0) return;
    p.fireCd = p.focus ? FOCUS_CD : FIRE_CD;
    frostVolley(p, w);
  },

  renderAbove(p, b, x, y) { renderField(p, b, x, y, p.alpha); },

  renderFx(p, b) {
    renderFrost(p, b);
    renderStorm(p, b);
    if (p.ps.rain || p.ps.az) renderFrozenBullets(p, b, p.ps.az && p.ps.az.life - p.ps.az.t < ABS_REL + 12 ? 0.8 : 0);
    renderRain(p, b);
    renderAbsolute(p, b);
  },
};
