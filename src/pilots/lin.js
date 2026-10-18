import { mirrorPath, outline, canopy, glowDot, drawBolt, neonStroke } from '../fx/art.js';
import { UP, TAU, W, H, ringPulse, nearestN, targets, stun, shipScale } from './common.js';
import { DMG_IGNORES_SHIELDS } from '../core/damage.js';
import { FADE_OUT } from '../fx/Particles.js';
import { linArt, PAL } from './linArt.js';
import {
  linFxSprites, renderShots, hitSpark, burst, wingGlitter, renderTurrets,
  renderFieldGround, renderFieldRoots, renderRain, renderUlt, renderVoid,
  T_SHARD, T_SPEAR, T_SPLIT, T_NEEDLE,
  whipRelease, fieldWave, crystalBloom, voidFlakes, along, PORTAL_Y,
} from './linFx.js';
import { rigState, step as rigStep, lash, thrust, drawBack, flare, coil } from './linRig.js';

// LIN HAYASE — PETAL ENGINE (emerald crystal knight)
// Crystal shards, seeds that grow into swarm turrets · Focus: splitting
// emerald spears (the turrets throw them too) · Special: Root Field (wrap,
// hold 1.5 s, crush) · Bomb: Spear Rain (3 s, through shields)
// Ultimate: Cosmic Spear (a giant spear and the starry rift it leaves)
//
// LIN v2 (ASSET_NOTES.md "Rebuild v2"): the component mecha (linArt.js +
// linRig.js + linFx.js) replaces drawShip() when the art loads; drawShip()
// stays as the automatic fallback. The whip is swung out in front of him and
// lashes with every volley: the shards leave its glowing crystals. Spears
// leave the blade of his thrusting spear. The crystal legs (feet) never fire.
// No thrusters: the butterfly wings beat.

const LEAF = [0.25, 1.0, 0.45];
const MAX_TURRETS = [3, 4, 6, 8];
const SPEAR_CD = 8;
const REF = 150;          // focus spears cross his centre line this far ahead
const SPLIT_R = 160;      // a split shard looks this far for another enemy
const FIELD_R = 300, FIELD_HOLD = 90; // v2: the field reaches 300 (was 200)
const SHARD_REF = 200;    // whip shards cross the old fan's lanes (from the waist spike) this far ahead
const ULT_CHARGE = 72;    // v2: the Cosmic Spear charges 1.2 s (was 0.83 s)

/** Focus spear damage per tier; split shards deal half. */
const spearDmg = (t) => 2.3 + 0.32 * t;
const spearCount = (t) => (t >= 2 ? 2 : 1);

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Leaf wings (more with tier).
  for (let k = 0; k < 1 + tier; k++) for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 26); ctx.rotate(s * (0.6 + k * 0.32));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -14, 0, -26 + k * 2); ctx.quadraticCurveTo(-7, -14, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, -26);
    g.addColorStop(0, '#103a20'); g.addColorStop(1, k % 2 ? '#c8ffe0' : '#3aff8a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,255,220,0.6)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -22); ctx.stroke();
    ctx.restore();
  }
  // Pod body.
  mirrorPath(ctx, cx, [0, 6, 7, 12, 9, 28, 7, 40, 3, 46, 0, 47]);
  const g = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
  g.addColorStop(0, '#0c2014'); g.addColorStop(0.45, '#2a9a6a'); g.addColorStop(1, '#0a1a10');
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  // Crystal veins.
  ctx.beginPath(); ctx.moveTo(cx, 14); ctx.quadraticCurveTo(cx - 5, 30, cx, 44); ctx.moveTo(cx, 14); ctx.quadraticCurveTo(cx + 5, 30, cx, 44);
  neonStroke(ctx, 'rgba(120,255,170,1)', 0.6, 5);
  if (tier >= 3) for (const s of [-1, 1]) glowDot(ctx, cx + s * 6, 36, 3.2, 'rgba(200,255,220,1)');
  if (tier >= 4) for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 3, 1.6, a, 0, TAU);
    ctx.fillStyle = 'rgba(160,255,200,0.95)'; ctx.fill();
  }
  canopy(ctx, cx, 20, 3, 5, '#ffffff', '#9affc0', '#0a2a18');
}

function drawSeed(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
  const g = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, w / 2);
  g.addColorStop(0, '#eaffef'); g.addColorStop(0.5, '#3ad87a'); g.addColorStop(1, '#0a3018');
  ctx.fillStyle = g; ctx.fill();
}

function drawBud(ctx, w, h) {
  // Fallback swarm turret: a small emerald crystal with four blades.
  const cx = w / 2, cy = h / 2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.785;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5, 4.4, 2, a, 0, TAU);
    ctx.fillStyle = 'rgba(80,230,150,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,30,15,0.8)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  glowDot(ctx, cx, cy, 3.6, 'rgba(220,255,230,1)');
}

const shardSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(90,255,150,0.85)', '#f0fff4');
const needleSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(150,255,190,0.85)');

// ------------------------------------------------------------- the kit

/** World position of an anchor at rest (procedural fallback uses the same offsets). */
const at = (p, name) => { const [x, y] = linArt.anchor(name); return [p.x + x, p.y + y]; };

/** Focus: spears from the blade, aimed to cross the centre line REF ahead. */
function throwSpears(p, w) {
  const ps = p.ps, S = w.shots, t = p.tier, n = spearCount(t), d = spearDmg(t);
  thrust(p, 3);
  const [bx, by] = linArt.animatedAnchor(p, 'blade');
  const a0 = Math.atan2(p.y - REF - by, p.x - bx);
  for (let k = 0; k < n; k++) {
    const off = k - (n - 1) / 2;
    const i = w.shot(bx + off * 6, by, a0 + off * 0.05, 22, ps.fShard, d, 6);
    if (i >= 0) S.behave(i, d, 40, 0, 0, 0, T_SPEAR);
  }
  linArt.frames().fx && spearFlash(p, w, bx, by);
}

/** World points along the whip (handle, crystals of the handle half, the joint, the tip), posed. */
const whipPts = (p) => ['whipHand', 'whipMid', 'whipJoint', 'whipTip'].map((n) => linArt.animatedAnchor(p, n));

/**
 * Main: a lash, and a fan of shards leaving the whip's crystals (from the
 * handle half out to the tip), each aimed through the old fan's lane.
 */
function whipShards(p, w) {
  const t = p.tier, S = w.shots, ps = p.ps;
  lash(p);
  const pts = whipPts(p), [cx, cy] = at(p, 'core');
  const n = 2 + t, d = 0.8 + t * 0.075;
  for (let k = 0; k < n; k++) {
    const a = UP + (k / (n - 1) - 0.5) * 0.5;
    const [sx, sy] = along(pts, 0.3 + 0.7 * k / (n - 1));
    const ang = Math.atan2(cy + Math.sin(a) * SHARD_REF - sy, cx + Math.cos(a) * SHARD_REF - sx);
    const i = w.shot(sx, sy, ang, 13, ps.fShard, d, 5, 0.9 + t * 0.08);
    if (i >= 0) S.behave(i, d, 0, 0, 0, 0, T_SHARD);
    whipRelease(w, sx, sy, ang);
  }
}

function spearFlash(p, w, x, y) {
  const Hp = w.fxHigh, fx = linArt.frames().fx;
  let i = Hp.spawn(p.F.glow, x, y - 2, 0, -0.6, 3);
  if (i >= 0) { Hp.size(i, 26, 14); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); Hp.look(i, 0.6, 1, FADE_OUT); }
  i = Hp.spawn(fx.flare, x, y - 2, 0, -0.6, 4);
  if (i >= 0) { Hp.size(i, 30, 18); Hp.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.mid[0], PAL.mid[1], PAL.mid[2]); Hp.look(i, 0.75, 1, FADE_OUT); }
}

/** A spear that landed splits into up to 3 shards at the nearest other enemies. */
function splitShards(p, w) {
  const S = w.shots;
  for (const sp of p.ps.splits) {
    const list = nearestN(w, sp.x, sp.y, 3, SPLIT_R, new Set([sp.src]));
    for (const e of list) {
      const a = Math.atan2(e.y - sp.y, e.x - sp.x), r = (sp.src.alive ? sp.src.r : 0) + 7;
      const i = w.shot(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, a, 16, p.ps.fShard, sp.dmg, 5);
      if (i >= 0) S.behave(i, sp.dmg, 16, 0, 0.12, 0, T_SPLIT);
    }
  }
  p.ps.splits.length = 0;
}

function plant(p, w, x, y, life) {
  const T = p.ps.turrets, cap = MAX_TURRETS[p.tier - 1] + 5;
  if (T.length >= cap) T.shift();
  T.push({ x: Math.max(10, Math.min(W - 10, x)), y: Math.max(20, Math.min(H - 30, y)), t: 0, life, seed: w.fxRng.next() * 10 });
  ringPulse(w, x, y, LEAF, 6, 30, 14);
}

/** Root Field: wrap every enemy inside that isn't held yet. */
function grab(p, w) {
  const fd = p.ps.field;
  for (const e of targets(w)) {
    if (fd.seen.has(e) || (e.x - fd.x) ** 2 + (e.y - fd.y) ** 2 > (fd.R + e.r) ** 2) continue;
    fd.seen.add(e);
    stun(e, fd.crush - fd.t + 4);
    fd.held.push({ e, born: fd.t, seed: w.fxRng.next() * TAU });
  }
}

export default {
  id: 'lin',
  name: 'LIN HAYASE',
  vehicle: 'PETAL ENGINE',
  role: 'Bio-tech Craft',
  bio: 'A botanist from the Crown\'s sky-gardens who grew his own war machine: the Petal Engine, an emerald crystal knight on butterfly wings. Lin\'s spears split on everything they touch, and the swarm he plants keeps fighting after he has moved on.',
  color: LEAF,
  css: '#3aff8a',
  // Art test: the Petal Engine's paint (teal crystal, black frame, pale glow) + emerald light.
  palette: { armour: '#2ac8a8', frame: '#0a1a14', trim: '#e8ffd0', energy: '#3aff8a' },
  stats: { speed: 3, power: 4, range: 4, bomb: 4 },
  speed: { normal: 4.4, focus: 2.0 },
  hitbox: 2.4,
  bombStock: 3,
  engines: [[0, 22]],
  engineColor: [0.4, 1.0, 0.6],
  optionSprite: 'l_bud',
  optionSpin: 0,
  // Procedural fallback, matched to pilot-portrait.jpg (short auburn hair, amber eyes).
  portrait: { skin: '#f2d4b8', hair: '#c0703a', style: 'spiky', eyes: 'eyes', iris: '#d8a030', suit: '#e0b020' },
  weapons: {
    main: 'Crystal Whip — every lash throws a fan of emerald shards off the whip; seeds grow into swarm turrets',
    focus: 'Emerald Spears — spears split on every enemy they hit; the swarm throws them too',
  },
  art: linArt,
  special: {
    name: 'ROOT FIELD',
    desc: 'Plant the spear: roots wrap every enemy in a wide field, hold them 1.5 s, then crush them; the field eats bullets',
    cooldown: 600,
    duration: FIELD_HOLD + 22,
    activate(p, w) {
      p.ps.field = { x: p.x, y: p.y, R: FIELD_R, t: 0, crush: FIELD_HOLD, held: [], seen: new Set() };
      grab(p, w);
      w.cancelCircle(p.x, p.y, 90);
      thrust(p, 20); // the spear is planted
      fieldWave(w, p.x, p.y, FIELD_R);
      w.r.post.flash(0.3, 1, 0.5, 0.2, 0.06);
      w.g.camera.addTrauma(0.25);
    },
    update(p, w, t) {
      const fd = p.ps.field;
      if (!fd) return;
      fd.t = t;
      if (t < 40) { coil(p, 1 - t / 40); flare(p, 1 - t / 40); }
      if (t < fd.crush) {
        w.cancelCircle(fd.x, fd.y, fd.R * Math.min(1, t / 18));
        if (t % 6 === 0) grab(p, w);
      } else if (t === fd.crush) {
        // Crush: lethal to normal enemies; bosses can't be held and take a heavy hit.
        for (const { e } of fd.held) {
          if (!e.alive) continue;
          const boss = e.boss || e.ctrl || e.kind === 'bosspart', x = e.x, y = e.y;
          w.damage(e, boss ? 40 : Math.max(30, e.hp * 4));
          burst(w, x, y, boss ? 1.6 : 1);
        }
        w.r.post.flash(0.3, 1, 0.5, 0.25, 0.06);
        w.g.camera.addTrauma(0.4);
      }
    },
    end(p) { p.ps.field = null; },
  },
  bomb: {
    name: 'SPEAR RAIN',
    duration: 180, // 3 s
    activate(p, w) {
      p.ps.rain = [];
      p.ps.portal = { t: 0, closeT: 0 };
      thrust(p, 160); // the spear raised to the sky
      w.r.post.flash(0.3, 1, 0.5, 0.25, 0.06);
      w.r.post.shockwave(W / 2, PORTAL_Y, 0.03, 0.02, 0.6);
    },
    update(p, w, t) {
      w.cancelAll();
      const ps = p.ps, R = w.rng;
      if (ps.portal) {
        ps.portal.t = t;
        flare(p, t < 160 ? 0.6 : 0);
        if (t === 164) {
          // The portal shatters.
          ps.portal.closeT = t;
          for (let k = 0; k < 6; k++) burst(w, (k + 0.5) / 6 * W, PORTAL_Y, 1.1);
          w.r.post.flash(0.4, 1, 0.6, 0.35, 0.05);
          w.g.camera.addTrauma(0.4);
        }
      }
      // Countless spears: two a step (a big one every 10), half of them aimed at enemies.
      if (t <= 168) for (let k = 0; k < 2; k++) {
        const T = targets(w);
        const e = T.length && R.chance(0.5) ? R.pick(T) : null;
        const tx = e ? e.x + R.range(-12, 12) : R.range(10, W - 10), ty = e ? e.y : R.range(30, H - 110);
        const big = k === 0 && t % 10 === 0;
        const y0 = PORTAL_Y + R.range(-8, 8) - R.range(0, 60); // out of the portal (staggered)
        ps.rain.push({ x: tx - 3 * (ty - y0) / 26, y: y0, tx, ty, vx: 3, vy: 26, big, n: ps.rainN = (ps.rainN || 0) + 1 });
      }
      for (const s of ps.rain) {
        s.x += s.vx; s.y += s.vy;
        if (s.y < s.ty) continue;
        s.dead = true;
        w.damageCircle(s.tx, s.ty, s.big ? 64 : 40, s.big ? 7 : 3, DMG_IGNORES_SHIELDS);
        // Every hit opens a star seal (owner's pick); big ones also burst.
        if (s.big || (s.n & 1)) ps.stars.push({ x: s.tx, y: s.ty, t: 0, life: s.big ? 24 : 15, size: s.big ? 96 : 50, rot: w.fxRng.range(-0.4, 0.4) });
        else hitSpark(w, s.tx, s.ty, -Math.PI / 2);
        if (s.big) { burst(w, s.tx, s.ty, 1.2); w.g.camera.addTrauma(0.08); }
        crystalBloom(w, s.tx, s.ty, s.big);
      }
      ps.rain = ps.rain.filter((s) => !s.dead);
    },
    end(p) { p.ps.rain = []; p.ps.portal = null; },
  },
  ultimate: {
    name: 'COSMIC SPEAR',
    duration: 240, // 4 s
    activate(p, w) {
      p.ps.ult = { phase: 'charge', t: 0, hit: new Set(), fade: 1, charge: ULT_CHARGE };
      w.r.post.flash(0.4, 1, 0.6, 0.35, 0.05);
    },
    update(p, w, t) {
      const u = p.ps.ult;
      if (!u) return;
      u.t = t;
      if (u.phase === 'charge') {
        w.cancelAll();
        // The spear is drawn back and tilted, the wings flare, the whip coils; stars gather at the spear.
        drawBack(p, Math.min(1, t / 20)); flare(p, 1); coil(p, 0.6);
        if (t % 12 === 0) w.g.camera.addTrauma(0.05 + 0.15 * t / ULT_CHARGE);
        const [bx, by] = linArt.animatedAnchor(p, 'blade'), fx = linArt.frames().fx, R = w.fxRng;
        if (fx && t % 2 === 0) {
          const a = R.range(0, TAU), d = R.range(80, 160);
          const i = w.fxHigh.spawn(fx.flare, bx + Math.cos(a) * d, by + Math.sin(a) * d, -Math.cos(a) * d / 18, -Math.sin(a) * d / 18, 18);
          if (i >= 0) { w.fxHigh.size(i, R.range(6, 12), 3); w.fxHigh.color(i, PAL.core[0], PAL.core[1], PAL.core[2], PAL.hot[0], PAL.hot[1], PAL.hot[2]); w.fxHigh.look(i, 0.9, 1, FADE_OUT); }
        }
        if (t < ULT_CHARGE) return;
        // Launch: the spear thrusts and the giant spear leaves from in front of him, straight up.
        thrust(p, 12);
        Object.assign(u, { phase: 'fly', x: p.x, y0: p.y - 30, headY: p.y - 30, w: 110 });
        w.r.post.flash(0.5, 1, 0.7, 0.45, 0.05);
        w.r.post.shockwave(p.x, p.y - 40, 0.05, 0.02, 0.6);
        w.g.camera.addTrauma(0.6);
        burst(w, p.x, p.y - 40, 1.5);
      }
      u.headY -= 22;
      const top = Math.max(-10, u.headY);
      u.fade = t > 210 ? Math.max(0, (240 - t) / 30) : 1;
      voidFlakes(w, u, u.w * 1.4);
      // The head hits everything it passes once, massively.
      for (const e of targets(w)) {
        if (u.hit.has(e) || Math.abs(e.x - u.x) > u.w / 2 + e.r || e.y < u.headY - 20 || e.y > u.headY + 90) continue;
        u.hit.add(e);
        w.damage(e, 120, DMG_IGNORES_SHIELDS);
        burst(w, e.x, e.y, 1.3);
      }
      // The rift it leaves keeps burning and clears bullets.
      if (u.fade > 0.2 && top < u.y0) {
        const bm = w.beam(u.x, u.y0, u.x, top, u.w, 1.1, LEAF, 1, DMG_IGNORES_SHIELDS);
        bm.skin = true;
        w.cancelLine(u.x, u.y0, u.x, top, u.w * 1.1);
      }
    },
    end(p) { p.ps.ult = null; },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_lin_${t}`, 56, 50, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('l_bud', 16, 16, drawBud, { scale: s });
    atlas.add('l_seed', 8, 10, drawSeed, { scale: s });
    atlas.add('l_petal', 16, 6, shardSprite, { scale: s });
    atlas.add('l_needle', 14, 4, needleSprite, { scale: s });
    linFxSprites(atlas);
    linArt.buildSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => linArt.renderMecha(p, b, x, y, a),
  exhaust: wingGlitter,
  renderShots,
  hitSpark,
  /** A focus spear that lands splits (queued: shots can't spawn during collision). */
  shotHit(w, i, en) {
    const p = w.player, S = w.shots;
    if (S.aux[i] !== T_SPEAR) return;
    p.ps.splits.push({ x: S.x[i], y: S.y[i], src: en, dmg: S.damage[i] * 0.5 });
  },

  init(p, w) {
    const ps = p.ps;
    ps.fShard = w.r.frame('l_petal');
    ps.fNeedle = w.r.frame('l_needle');
    ps.fSeed = w.r.frame('l_seed');
    ps.fBud = w.r.frame('l_bud');
    ps.Fr = { spear: w.r.frame('l_spear'), crystal: w.r.frame('l_crystal'), root: w.r.frame('l_root') };
    ps.seeds = [];
    ps.turrets = [];
    ps.splits = [];
    ps.rain = [];
    ps.stars = [];
    ps.field = null;
    ps.ult = null;
    ps.portal = null;
    rigState(p);
  },

  reset(p) { p.ps.seeds = []; p.ps.splits = []; },

  update(p, w) {
    linArt.animate(p);
    rigStep(p);
    const ps = p.ps, S = w.shots;
    if (ps.splits.length) splitShards(p, w);
    for (const h of ps.stars) h.t++;
    if (ps.stars.length) ps.stars = ps.stars.filter((h) => h.t < h.life);
    // Seeds fly, slow down and grow into swarm turrets.
    for (const s of ps.seeds) {
      s.px = s.x; s.py = s.y;
      s.y += s.vy; s.vy *= 0.94; s.t++;
      if (s.t >= 26) { plant(p, w, s.x, s.y, 200 + p.tier * 30); s.dead = true; }
    }
    ps.seeds = ps.seeds.filter((s) => !s.dead);
    // Turrets: needles at the nearest enemy; in focus, splitting spears at the
    // locked target. They also eat bullets that touch them.
    const lock = p.focus && p.firing ? nearestN(w, p.x, p.y - 40, 1, 600)[0] : null;
    for (const tu of ps.turrets) {
      tu.t++;
      w.cancelCircle(tu.x, tu.y, 9);
      const tg = lock || nearestN(w, tu.x, tu.y, 1, 380)[0];
      tu.rot = tg ? Math.atan2(tg.y - tu.y, tg.x - tu.x) - UP : (tu.rot || 0) * 0.9;
      if (tu.t % (p.focus ? 12 : 14) !== 0) continue;
      const a = tg ? Math.atan2(tg.y - tu.y, tg.x - tu.x) : UP;
      if (p.focus) {
        const d = spearDmg(p.tier) * 0.35;
        const i = w.shot(tu.x, tu.y, a, 18, ps.fShard, d, 5);
        if (i >= 0) S.behave(i, d, 50, 0, 0.05, 0, T_SPEAR);
      } else {
        const i = w.shot(tu.x, tu.y, a, 11, ps.fNeedle, 0.6, 4);
        if (i >= 0) S.behave(i, 0.6, 80, 0, 0.08, 0, T_NEEDLE);
      }
    }
    ps.turrets = ps.turrets.filter((tu) => tu.t < tu.life);
  },

  optionLayout(p) {
    const n = p.tier >= 2 ? p.tier - 1 : 0, out = [];
    for (let k = 0; k < n; k++) {
      const a = p.t * 0.04 + (k / n) * TAU;
      out.push(p.focus ? [(k - (n - 1) / 2) * 16, -22] : [Math.cos(a) * 34, Math.sin(a) * 18 + 8]);
    }
    return out;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots, ps = p.ps;
    if (p.focus) {
      p.fireCd = SPEAR_CD;
      throwSpears(p, w);
      // Option drones throw small splitting spears too.
      for (const o of p.options) {
        const d = spearDmg(t) * 0.3;
        const i = w.shot(o.x, o.y - 6, UP, 20, ps.fShard, d, 5);
        if (i >= 0) S.behave(i, d, 40, 0, 0.04, 0, T_SPEAR);
      }
    } else {
      p.fireCd = 6;
      whipShards(p, w);
      for (const o of p.options) {
        const i = w.shot(o.x, o.y - 6, UP, 12, ps.fNeedle, 0.5, 4);
        if (i >= 0) S.behave(i, 0.5, 90, 0, 0.06, 0, T_NEEDLE);
      }
    }
    // A seed every few volleys (more often unfocused).
    if ((p.t % (p.focus ? 48 : 30)) < 6 && ps.seeds.length < 3) {
      ps.seeds.push({ x: p.x + w.rng.range(-30, 30), y: p.y - 20, px: p.x, py: p.y, vy: -9, t: 0 });
    }
  },

  /** Option drones: small swarm turrets (false without the art → default buds). */
  renderOptions(p, b, alpha) {
    if (!linArt.extra('turret')) return false;
    const list = p.options.map((o) => ({
      x: o.px + (o.x - o.px) * alpha, y: o.py + (o.y - o.py) * alpha, t: 30, life: 1e9, seed: o.i * 1.7, rot: 0,
    }));
    renderTurrets(p, b, list, alpha, 16);
    return true;
  },

  renderBelow(p, b, x, y, alpha) {
    const F = p.F;
    renderFieldGround(p, b);
    renderTurrets(p, b, p.ps.turrets, alpha);
    for (const s of p.ps.seeds) {
      const sx = s.px + (s.x - s.px) * alpha, sy = s.py + (s.y - s.py) * alpha;
      b.draw(F.glow, sx, sy, 20, 20, 0, LEAF[0], LEAF[1], LEAF[2], 0.4, 1);
      b.draw(p.ps.fSeed, sx, sy, 8, 10, s.t * 0.2, 1, 1, 1, 1, 0);
    }
  },

  renderUnder: (p, b) => renderVoid(p, b),

  renderFx(p, b) {
    renderFieldRoots(p, b);
    renderRain(p, b);
    renderUlt(p, b);
  },
};
