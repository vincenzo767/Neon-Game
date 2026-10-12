import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, W, H, ringPulse, chainTargets, nearestN, targets, stun, shipScale } from './common.js';
import { oduyaArt, oduyaMechaFx } from './oduyaArt.js';
import { renderLightning } from './oduyaFx.js';

// ODUYA REX — THUNDERJAW (thunder god mecha)
// Chain-lightning strands that evolve as he fights · Focus: thunder spears
// Special: Thundershock (stun everything 2 s, then it explodes)
// Bomb: Storm Cell (5 in stock) · Ultimate: God Thunder Barrage
//
// ODUYA ART TEST: the hand-made mecha art (oduyaArt.js) replaces drawShip()
// when it loads; drawShip() stays as the automatic fallback. All lightning
// leaves the two gold fists; the drill legs (feet) never fire.

const ELEC = [0.55, 0.68, 1.0];
const WHITE = [0.9, 0.95, 1.0];

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Hover skirt.
  mirrorPath(ctx, cx, [0, 8, 18, 10, 24, 18, 25, 46, 20, 52, 0, 53]);
  ctx.fillStyle = chrome(ctx, cx - 25, cx + 25, '#0c0f16', '#3a4256', '#8e9ab4'); ctx.fill(); outline(ctx, 1.1);
  ctx.fillStyle = 'rgba(140,170,255,0.5)';
  for (const s of [-1, 1]) ctx.fillRect(cx + s * 23 - 1, 20, 2, 24);
  // Tier 2+: side mortar pods.
  if (tier >= 2) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(cx + s * 22 - 5, 14, 10, 18, 3);
    ctx.fillStyle = chrome(ctx, cx + s * 22 - 5, cx + s * 22 + 5); ctx.fill(); outline(ctx, 0.7);
    for (const y of [18, 26]) glowDot(ctx, cx + s * 22, y, 2.2, 'rgba(140,170,255,1)');
  }
  // Tier 3+: tesla coils at the back.
  if (tier >= 3) for (const s of [-1, 1]) {
    ctx.fillStyle = '#20263a'; ctx.fillRect(cx + s * 12 - 2.5, 40, 5, 10);
    for (let y = 41; y < 50; y += 2) { ctx.fillStyle = '#c08a40'; ctx.fillRect(cx + s * 12 - 3, y, 6, 0.9); }
    glowDot(ctx, cx + s * 12, 40, 3.2, 'rgba(200,220,255,1)');
  }
  // Turret.
  ctx.beginPath(); ctx.arc(cx, 28, 11, 0, Math.PI * 2);
  ctx.fillStyle = chrome(ctx, cx - 11, cx + 11, '#10141e', '#4a5672', '#b4c2e0'); ctx.fill(); outline(ctx);
  // Twin plasma barrels.
  for (const s of [-1, 1]) { ctx.fillStyle = '#141824'; ctx.beginPath(); ctx.rect(cx + s * 4 - 1.8, 4, 3.6, 18); ctx.fill(); outline(ctx, 0.5); }
  for (const s of [-1, 1]) glowDot(ctx, cx + s * 4, 5, 2.4, 'rgba(160,190,255,1)');
  // Tier 4: capacitor ring around the turret.
  if (tier >= 4) {
    ctx.beginPath(); ctx.arc(cx, 28, 14, 0, Math.PI * 2);
    ctx.save(); ctx.shadowColor = '#9cf'; ctx.shadowBlur = 8; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  canopy(ctx, cx, 30, 3.2, 3.6, '#ffffff', '#8aa6ff', '#0a1430');
  neonLines(ctx, cx, [18, 10, 24, 18, 25, 46, 20, 52], 'rgba(140,170,255,1)', 0.7, 5);
}

function drawCoil(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = '#1a2032'; ctx.beginPath(); ctx.rect(cx - 3, 3, 6, h - 6); ctx.fill(); outline(ctx, 0.6);
  for (let y = 4; y < h - 4; y += 2.2) { ctx.fillStyle = '#c08a40'; ctx.fillRect(cx - 3.5, y, 7, 0.9); }
  glowDot(ctx, cx, 3, 3, 'rgba(200,220,255,1)');
}

const boltSprite = (ctx, w, h) => drawBolt(ctx, w, h, 'rgba(140,170,255,0.9)');

// ------------------------------------------------------------- the kit
//
// Owner's redesign (ASSET_NOTES.md): an immortal god of thunder. Nothing he
// fires is a bullet except the focus thunder spears.
// - Strands do not follow power tiers: he starts with 3 and gains one every
//   10 seconds alive (lightning hits speed this up), up to 10. Death costs 2.
// - Main: every few steps a lightning strand leaves a fist and chains through
//   up to `strands` targets; each hit also arcs to enemies around it.
// - Focus: volleys of thunder spears, more with more strands.
// - Coils (2 from 5 strands, 4 from 8) throw short arcs, no bullets.

const STRAND_MIN = 3, STRAND_MAX = 10;
const EVO_STEP = 600;        // 10 s per strand
const EVO_PER_HIT = 0.5;     // each lightning hit adds this many steps of progress
const STRIKE_CD = 4;         // main strand: a strike every 4 steps (15 / s)
const HOP = 190;             // chain reach between targets
const ARC_R = 55;            // arcs to enemies this close to a hit
const SPEAR_CD = 7;

/** Damage of one strand hit at a strand level (boss DPS ~42 at 3 strands, ~70 at 10, plus coils). */
const strandDmg = (n) => 2.0 + 0.27 * n;
const spearCount = (n) => 2 + Math.floor((n - 3) / 2);
const coilCount = (n) => (n >= 8 ? 4 : n >= 5 ? 2 : 0);

function evolve(p, w, amount) {
  const ps = p.ps;
  if (ps.evoLock || ps.strands >= STRAND_MAX) return;
  ps.evo += amount;
  if (ps.evo < EVO_STEP) return;
  ps.evo -= EVO_STEP;
  ps.strands++;
  w.event('toast', { text: `THUNDER · ${ps.strands} STRANDS`, cls: 'pc' });
  ringPulse(w, p.x, p.y, ELEC, 12, 120, 16);
}

/** A sky strike for the renderer (bomb, special detonation, ultimate). */
function skyStrike(p, x0, y0, x1, y1, width, life = 7) {
  p.ps.strikes.push({ x0, y0, x1, y1, w: width, t: 0, life, s: p.w.fxRng.next() * 100 });
}

/** Main weapon: one strand from a fist through up to `strands` targets. */
function strike(p, w) {
  const ps = p.ps, n = ps.strands, d = strandDmg(n);
  const name = (ps.side = -ps.side) < 0 ? 'fistL' : 'fistR';
  const [fx, fy] = oduyaArt.anchor(name), x0 = p.x + fx, y0 = p.y + fy;
  const chain = chainTargets(w, x0, y0, n, HOP);
  const pts = [[x0, y0]], arcs = [], hit = new Set(chain);
  let hits = 0;
  chain.forEach((e, k) => {
    w.damage(e, k === 0 ? d : d * 0.7);
    pts.push([e.x, e.y]);
    hits++;
    // Arc to anything close to this hit (half damage, once per strike).
    for (const o of targets(w)) {
      if (hit.has(o) || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > (ARC_R + o.r) ** 2) continue;
      hit.add(o);
      w.damage(o, d * 0.5);
      arcs.push([e.x, e.y, o.x, o.y]);
      hits++;
    }
  });
  if (!chain.length) {
    // Nothing locked: the bolt cracks straight ahead and hurts what it crosses.
    const tx = x0 + w.fxRng.range(-40, 40), ty = y0 - 280;
    w.damageLine(x0, y0, tx, ty, 10, d);
    pts.push([tx, ty]);
  } else if ((p.t >> 2) & 1) {
    oduyaMechaFx.hitSpark(w, chain[0].x, chain[0].y + chain[0].r * 0.4, Math.PI / 2);
  }
  ps.bolts.push({ pts, arcs, t: 0, life: 5, w: 9, s: w.fxRng.next() * 100 });
  ps[name === 'fistL' ? 'kickL' : 'kickR'] = 0.35;
  const [mx, my] = oduyaArt.animatedAnchor(p, name);
  oduyaMechaFx.muzzleFlash(p, w, mx, my, 28);
  evolve(p, w, hits * EVO_PER_HIT);
}

/** Focus: a volley of thunder spears from one fist. */
function spears(p, w) {
  const ps = p.ps, S = w.shots, c = spearCount(ps.strands);
  const name = (ps.side = -ps.side) < 0 ? 'fistL' : 'fistR';
  const [fx, fy] = oduyaArt.anchor(name);
  for (let k = 0; k < c; k++) {
    const off = (k - (c - 1) / 2);
    // Aim inward so the volley converges ahead of the mecha's centre.
    const a = UP + Math.atan2(-fx + off * 6, 220) + off * 0.02;
    const i = w.shot(p.x + fx + off * 5, p.y + fy, a, 30, ps.fBolt, 1.65, 6);
    if (i >= 0) { S.behave(i, 1.65, 30, 1); S.aux[i] = 4; }
  }
  const [mx, my] = oduyaArt.animatedAnchor(p, name);
  oduyaMechaFx.muzzleFlash(p, w, mx, my, 34);
  ps[name === 'fistL' ? 'kickL' : 'kickR'] = 0.6;
}

/** Coils: each throws a short arc at the nearest enemy (no bullets). */
function coils(p, w) {
  for (const o of p.options) {
    const [e] = nearestN(w, o.x, o.y, 1, 230);
    if (!e) continue;
    w.damage(e, 1.2);
    p.ps.bolts.push({ pts: [[o.x, o.y - 6], [e.x, e.y]], arcs: [], t: 0, life: 4, w: 3.6, s: w.fxRng.next() * 100 });
  }
}

export default {
  id: 'oduya',
  name: 'ODUYA REX',
  vehicle: 'THUNDERJAW',
  role: 'Thunder God Mecha',
  bio: 'An immortal god of thunder who walked out of the storm the night the Furnace gates fell. Oduya rides the Thunderjaw, a black and gold mecha crackling with his lightning, and every strike he throws grows stronger the longer he fights.',
  color: ELEC,
  css: '#8aa6ff',
  // Art test: the Thunderjaw's paint (black armour, gold trim) + blue-white lightning.
  palette: { armour: '#1a1c24', frame: '#0c0e14', trim: '#e8b830', energy: '#6aa8ff' },
  stats: { speed: 2, power: 5, range: 4, bomb: 5 },
  speed: { normal: 3.8, focus: 1.7 },
  hitbox: 3.0,
  bombStock: 5,
  engines: [[-12, 24], [12, 24]],
  engineColor: [0.5, 0.6, 1.0],
  optionSprite: 'o_coil',
  // Procedural fallback, matched to pilot-portrait.jpg (white hair and beard, laurel, glowing eyes).
  portrait: { skin: '#d8b48e', hair: '#ece6d8', style: 'long', eyes: 'cyber', accent: 'beard', iris: '#e8f4ff', suit: '#5a4a32' },
  weapons: {
    main: 'Thunder Strand — lightning from both fists that chains through up to 10 targets and arcs to everything around them; gains strands as he fights',
    focus: 'Thunder Spears — volleys of lightning-fast piercing spears',
  },
  art: oduyaArt,
  special: {
    name: 'THUNDERSHOCK',
    desc: 'Electrify every enemy on screen: stunned for 2 s, then they explode',
    cooldown: 600,
    duration: 124,
    activate(p, w) {
      w.cancelCircle(p.x, p.y, 160);
      const list = targets(w);
      for (const e of list) stun(e, 120);
      p.ps.shock = { list };
      ringPulse(w, p.x, p.y, ELEC, 10, 260, 22);
      w.r.post.flash(0.5, 0.7, 1, 0.25, 0.06);
      w.r.post.shockwave(p.x, p.y, 0.04, 0.02, 0.6);
      w.g.camera.addTrauma(0.3);
    },
    update(p, w, t) {
      if (t !== 120 || !p.ps.shock) return;
      for (const e of p.ps.shock.list) {
        if (!e.alive) continue;
        const x = e.x, y = e.y, boss = e.boss || e.ctrl || e.kind === 'bosspart';
        // Electrified enemies explode (lethal); bosses can't be stunned and take a heavy hit.
        w.damage(e, boss ? 30 : Math.max(30, e.hp * 4));
        skyStrike(p, x + w.fxRng.range(-30, 30), -20, x, y, 7, 8);
        w.explosions.blast(x, y, 0.7, [0.35, 0.6, 1.6]);
      }
      w.r.post.flash(0.6, 0.75, 1, 0.3, 0.06);
      w.g.camera.addTrauma(0.4);
      p.ps.shock = null;
    },
    end(p) { p.ps.shock = null; },
  },
  bomb: {
    name: 'STORM CELL',
    duration: 120,
    activate() {},
    update(p, w, t) {
      w.cancelAll();
      if (t % 4 === 0 && t < 108) {
        const T = targets(w);
        const e = T.length && w.rng.chance(0.75) ? w.rng.pick(T) : { x: w.rng.range(30, W - 30), y: w.rng.range(40, H - 140) };
        skyStrike(p, e.x + 20, -10, e.x, e.y, 7, 8);
        w.damageCircle(e.x, e.y, 46, 9);
        w.explosions.sparks(e.x, e.y, 10, WHITE, 5, 16, 4);
        if (t % 12 === 0) w.r.post.flash(0.6, 0.7, 1, 0.12, 0.08);
      }
    },
  },
  ultimate: {
    name: 'GOD THUNDER BARRAGE',
    duration: 420, // 7 s
    activate(p, w) { w.r.post.flash(0.7, 0.85, 1, 0.5, 0.05); },
    update(p, w, t) {
      w.cancelAll();
      if (t >= 400) return;
      // Bolts from the sky across the whole width, top to bottom of the screen.
      if (t % 3 === 0) {
        for (let k = 0; k < 2; k++) {
          const x = w.fxRng.range(10, W - 10), x0 = x + w.fxRng.range(-30, 30);
          skyStrike(p, x0, -20, x, H + 10, 9, 6);
          w.damageLine(x0, -20, x, H + 10, 26, 3);
        }
      }
      // Every half second a bolt hits each enemy on screen.
      if (t % 30 === 0) {
        for (const e of targets(w)) {
          skyStrike(p, e.x + w.fxRng.range(-24, 24), -20, e.x, e.y, 6, 7);
          w.damage(e, 7);
        }
        w.r.post.flash(0.55, 0.7, 1, 0.22, 0.05);
        w.r.post.shockwave(W / 2, H / 3, 0.02, 0.02, 0.5);
        w.g.camera.addTrauma(0.25);
      }
    },
  },

  sprites(atlas) {
    const s = shipScale(atlas);
    for (let t = 1; t <= 4; t++) atlas.add(`ship_oduya_${t}`, 54, 56, (c, w, h) => drawShip(c, w, h, t), { scale: s });
    atlas.add('o_coil', 10, 16, drawCoil, { scale: s });
    atlas.add('o_bolt', 22, 6, boltSprite, { scale: s });
    oduyaArt.buildSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => oduyaArt.renderMecha(p, b, x, y, a),
  exhaust: oduyaArt.exhaust,
  renderShots: oduyaMechaFx.renderShots,
  hitSpark: oduyaMechaFx.hitSpark,

  init(p, w) {
    p.ps.fBolt = w.r.frame('o_bolt');
    p.ps.side = 1;
    p.ps.strands = STRAND_MIN;
    p.ps.evo = 0;
    p.ps.bolts = [];
    p.ps.strikes = [];
    p.ps.shock = null;
  },

  // Death: lose two strands (never below the minimum).
  reset(p) {
    p.ps.strands = Math.max(STRAND_MIN, p.ps.strands - 2);
    p.ps.evo = 0;
    p.ps.shock = null;
  },

  /** tools/dps.mjs: measure at a fixed strand level per "tier" (power does not apply). */
  dpsLevel(p, tier) { p.ps.strands = [3, 5, 7, 10][tier - 1]; p.ps.evoLock = true; },

  update(p, w) {
    oduyaArt.animate(p);
    const ps = p.ps;
    ps.kickL = (ps.kickL || 0) * 0.75;
    ps.kickR = (ps.kickR || 0) * 0.75;
    if (p.state === 'alive') evolve(p, w, 1);
    for (const s of ps.bolts) s.t++;
    if (ps.bolts.length) ps.bolts = ps.bolts.filter((s) => s.t < s.life);
    for (const s of ps.strikes) s.t++;
    if (ps.strikes.length) ps.strikes = ps.strikes.filter((s) => s.t < s.life);
  },

  optionLayout(p) {
    const n = coilCount(p.ps.strands);
    if (!n) return [];
    const base = p.focus ? [[-40, 14], [40, 14]] : [[-62, 20], [62, 20]];
    return n >= 4 ? [...base, [-24, 44], [24, 44]] : base;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    if (p.focus) {
      p.fireCd = SPEAR_CD;
      spears(p, w);
    } else {
      p.fireCd = STRIKE_CD;
      strike(p, w);
    }
    if ((p.t % 10) < (p.focus ? SPEAR_CD : STRIKE_CD)) coils(p, w);
  },

  renderFx(p, b) { renderLightning(p, b); },
};
