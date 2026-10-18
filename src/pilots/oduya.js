import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, W, H, ringPulse, chainTargets, nearestN, targets, stun, shipScale } from './common.js';
import { oduyaArt, oduyaMechaFx } from './oduyaArt.js';
import { renderLightning, nodeBurst, fistFlash, spearBurst, clapFx, detonateGod, launchGod, godParticles } from './oduyaFx.js';
import { rigState, step as rigStep, punch, hold, flare } from './oduyaRig.js';
import { ODUYA } from './oduyaTuning.js';

// ODUYA REX — THUNDERJAW (thunder god mecha)
// Chain-lightning strands that evolve as he fights · Focus: thunder spears
// Special: Thundershock (a lightning web stuns everything 2 s, then it explodes)
// Bomb: Storm Cell (5 in stock) · Ultimate: God Thunder
//
// ODUYA v2 (ASSET_NOTES.md "Rebuild v2"): the component mecha (oduyaArt.js +
// oduyaRig.js + oduyaFx.js) replaces drawShip() when the art loads; drawShip()
// stays as the automatic fallback. Every bolt is a punch: it leaves the
// punching gold fist. Each attack has a beginning (punch / charge), a
// traveling phase (a leader racing along the chain, a web, a storm cloud, a
// thunder core) and a detonation. The drill legs (feet) never fire.

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
// - Main: every few steps a punch throws a lightning strand from that fist; its
//   leader races through up to `strands` targets (the damage lands as it
//   arrives), each hit arcing to enemies around it. From 5 strands each punch
//   also throws short arcs from the fist (v2: they replace the tesla coils;
//   2 arcs from 5 strands, 4 from 8).
// - Focus: punches that throw volleys of thunder spears, more with more strands.

const STRAND_MIN = 3, STRAND_MAX = 10;
const EVO_STEP = 600;        // 10 s per strand
const EVO_PER_HIT = 0.5;     // each lightning hit adds this many steps of progress
const STRIKE_CD = 4;         // main strand: a strike every 4 steps (15 / s)
const HOP = 190;             // chain reach between targets
const ARC_R = 55;            // arcs to enemies this close to a hit
const SPEAR_CD = 7;

/** Damage of one strand hit at a strand level (boss DPS ~42 at 3 strands, ~70 at 10, plus fist arcs). */
const strandDmg = (n) => 2.0 + 0.27 * n;
const spearCount = (n) => 2 + Math.floor((n - 3) / 2);
const arcCount = (n) => (n >= 8 ? 4 : n >= 5 ? 2 : 0);
const onField = (e) => e.alive && !e.untargetable && e.x > -20 && e.x < W + 20 && e.y > -20 && e.y < H + 20;

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

/** A bolt for the renderer (the storm cloud's strikes, the ultimate's detonation). */
function skyStrike(p, x0, y0, x1, y1, width, life = 7) {
  p.ps.strikes.push({ x0, y0, x1, y1, w: width, t: 0, life, s: p.w.fxRng.next() * 100 });
}

/** World point of the fist on `side`, posed (just after a punch: at full extension). */
const fistAt = (p, side) => oduyaArt.animatedAnchor(p, side < 0 ? 'fistL' : 'fistR');

/**
 * A leader: a bolt that races from (x0, y0) through nodes at ODUYA.leader.speed;
 * a node's damage lands when the leader arrives. es[k] is the enemy at node k
 * (null for a bare point: the segment to it then damages what it crosses).
 */
function leader(p, x0, y0, es, pts, d, width, opts = {}) {
  p.ps.leaders.push({
    pts: [[x0, y0], ...pts], es: [null, ...es], k: 1, hx: x0, hy: y0, d, w: width,
    hit: new Set(es.filter(Boolean)), arcs: [], t: 0, done: false, life: 5, s: p.w.fxRng.next() * 100, ...opts,
  });
}

/** Leaders race on; arriving at a node deals its damage, arcs to enemies around it and bursts. */
function stepLeaders(p, w) {
  const ps = p.ps, sp = ODUYA.leader.speed;
  for (const L of ps.leaders) {
    if (L.done) { L.t++; continue; }
    let move = sp;
    while (!L.done && move > 0) {
      const e = L.es[L.k];
      if (e && e.alive) L.pts[L.k] = [e.x, e.y]; // the node follows its enemy while the leader is on its way
      const [tx, ty] = L.pts[L.k], dx = tx - L.hx, dy = ty - L.hy, dd = Math.hypot(dx, dy);
      if (dd > move) { L.hx += dx / dd * move; L.hy += dy / dd * move; break; }
      move -= dd; L.hx = tx; L.hy = ty;
      let hits = 0;
      if (e) {
        if (e.alive) {
          w.damage(e, L.k === 1 ? L.d : L.d * 0.7);
          hits++;
          if (L.arcR) for (const o of targets(w)) {
            if (L.hit.has(o) || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > (L.arcR + o.r) ** 2) continue;
            L.hit.add(o);
            w.damage(o, L.d * 0.5);
            L.arcs.push([e.x, e.y, o.x, o.y]);
            hits++;
          }
          if (L.burst !== false) nodeBurst(p, w, tx, ty, L.w);
        }
      } else {
        const [px, py] = L.pts[L.k - 1];
        w.damageLine(px, py, tx, ty, 10, L.d);
      }
      if (L.evolve) evolve(p, w, hits * EVO_PER_HIT);
      if (++L.k >= L.pts.length) L.done = true;
    }
  }
  if (ps.leaders.length) ps.leaders = ps.leaders.filter((L) => !L.done || L.t < L.life);
}

/** From 5 strands: short arcs from the punching fist to the nearest enemies (they replace the coils). */
function fistArcs(p, w, x0, y0, mul) {
  const na = arcCount(p.ps.strands);
  if (!na) return;
  const near = nearestN(w, x0, y0, na, ODUYA.fistArcs.reach);
  for (let k = 0; k < na && near.length; k++) {
    const e = near[k % near.length];
    leader(p, x0, y0, [e], [[e.x, e.y]], ODUYA.fistArcs.dmg * mul, 3.6, { burst: false, life: 4 });
  }
}

/** Main weapon: a punch, and a strand from that fist through up to `strands` targets. */
function strike(p, w) {
  const ps = p.ps, n = ps.strands, d = strandDmg(n), side = rigState(p).next;
  w.shotsFired++; // no projectile, but the audio director voices one crackle per strike
  const [rx, ry] = oduyaArt.anchor(side < 0 ? 'fistL' : 'fistR');
  const chain = chainTargets(w, p.x + rx, p.y + ry, n, HOP);
  punch(p, side, chain.length ? Math.atan2(chain[0].y - p.y - ry, chain[0].x - p.x - rx) : null);
  const [x0, y0] = fistAt(p, side);
  if (chain.length) leader(p, x0, y0, chain, chain.map((e) => [e.x, e.y]), d, 9, { arcR: ARC_R, evolve: true });
  else leader(p, x0, y0, [null], [[x0 + w.fxRng.range(-40, 40), y0 - 280]], d, 9); // nothing locked: it cracks straight ahead
  fistArcs(p, w, x0, y0, 1);
  fistFlash(p, w, x0, y0, 28);
}

/** Focus: a punch, and a volley of thunder spears from that fist. */
function spears(p, w) {
  const ps = p.ps, S = w.shots, c = spearCount(ps.strands), side = rigState(p).next;
  punch(p, side, null);
  const [fx] = oduyaArt.anchor(side < 0 ? 'fistL' : 'fistR');
  const [x0, y0] = fistAt(p, side);
  for (let k = 0; k < c; k++) {
    const off = (k - (c - 1) / 2);
    // Aim inward so the volley converges ahead of the mecha's centre.
    const a = UP + Math.atan2(-fx + off * 6, 220) + off * 0.02;
    const i = w.shot(x0 + off * 5, y0, a, 30, ps.fBolt, 1.65, 6);
    if (i >= 0) { S.behave(i, 1.65, 30, 1); S.aux[i] = 4; S.ref[i] = { hit: 0 }; }
  }
  fistArcs(p, w, x0, y0, SPEAR_CD / STRIKE_CD);
  fistFlash(p, w, x0, y0, 34);
}

/** Spears that just hit something burst there (cosmetic). */
function spearHits(p, w) {
  const S = w.shots;
  for (let i = 0; i < S.count; i++) {
    const r = S.ref[i];
    if (S.aux[i] !== 4 || !r || !S.hitUid[i] || S.hitUid[i] === r.hit) continue;
    r.hit = S.hitUid[i];
    spearBurst(p, w, S.x[i], S.y[i]);
  }
}

// ------------------------------------------------------------- special: the web

/** Greedy nearest-neighbour order from (x, y): the path the web races along. */
function webOrder(list, x, y) {
  const left = list.slice(), out = [];
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((e, k) => { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; bi = k; } });
    const [e] = left.splice(bi, 1);
    out.push(e); x = e.x; y = e.y;
  }
  return out;
}

/** The web races enemy to enemy; each one it reaches is stunned until the 2 s detonation. */
function stepWeb(p, w, t) {
  const sh = p.ps.shock;
  if (!sh || sh.k >= sh.list.length) return;
  let move = ODUYA.web.speed;
  while (sh.k < sh.list.length && move > 0) {
    const e = sh.list[sh.k], dx = e.x - sh.hx, dy = e.y - sh.hy, dd = Math.hypot(dx, dy);
    if (dd > move) { sh.hx += dx / dd * move; sh.hy += dy / dd * move; break; }
    move -= dd; sh.hx = e.x; sh.hy = e.y;
    if (e.alive) { stun(e, Math.max(1, 120 - t)); nodeBurst(p, w, e.x, e.y, 6); }
    sh.reached.push(e);
    sh.k++;
  }
}

// ------------------------------------------------------------- ultimate: God Thunder

function stepGod(p, w, t) {
  const G = p.ps.god, U = ODUYA.ult;
  if (!G) return;
  G.t = t;
  if (G.ph === 'charge') {
    // Both fists drawn back and raised, wings wide; lightning streams from the fists into the core.
    G.x = p.x; G.y = p.y - 58;
    hold(p, -1, 2); flare(p, 1);
    if (t >= U.charge) {
      G.ph = 'travel'; G.t0 = t; G.y0 = G.y;
      G.speed = Math.max(0.5, (G.y - U.top) / U.travel);
      hold(p, 1, 14); // both fists thrust: the core launches
      launchGod(p, w, G);
    }
  } else if (G.ph === 'travel') {
    flare(p, 0.5);
    G.y = Math.max(U.top, G.y - G.speed);
    w.cancelCircle(G.x, G.y, U.cancelR);
    if ((t - G.t0) % U.lashEvery === 0) {
      for (const e of targets(w)) {
        if ((e.x - G.x) ** 2 + (e.y - G.y) ** 2 > U.lashR * U.lashR) continue;
        w.damage(e, U.lashDmg);
        p.ps.bolts.push({ pts: [[G.x, G.y], [e.x, e.y]], arcs: [], t: 0, life: 5, w: 6, s: w.fxRng.next() * 100 });
        G.lashes++;
      }
    }
    if (t - G.t0 >= U.travel) { G.ph = 'crit'; G.t0 = t; }
  } else if (G.ph === 'crit') {
    w.cancelCircle(G.x, G.y, U.cancelR);
    if (t - G.t0 >= U.crit) {
      G.ph = 'boom'; G.t0 = t;
      if (!G.nuked) {
        G.nuked = true;
        for (const e of w.enemies.active) if (onField(e)) { w.damage(e, U.nukeDmg); G.nukeHits++; }
        w.cancelAll();
        detonateGod(p, w, G);
      }
    }
  } else if (G.ph === 'boom') {
    const bt = t - G.t0;
    if (bt < 40) {
      w.cancelAll();
      // Bolts slam down across the whole width (cosmetic: the detonation already hit everything).
      if (bt % 2 === 0) for (let k = 0; k < 3; k++) {
        const x = w.fxRng.range(10, W - 10);
        skyStrike(p, x + w.fxRng.range(-30, 30), -20, x, w.fxRng.range(H * 0.3, H + 10), 8, 8);
      }
    }
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
  // The Thunderjaw's paint (black armour, gold trim) + blue-white lightning.
  palette: { armour: '#1a1c24', frame: '#0c0e14', trim: '#e8b830', energy: '#6aa8ff' },
  stats: { speed: 2, power: 5, range: 4, bomb: 5 },
  speed: { normal: 3.8, focus: 1.7 },
  hitbox: 3.0,
  bombStock: 5,
  engines: [[-12, 24], [12, 24]],
  engineColor: [0.5, 0.6, 1.0],
  optionSprite: null,
  // Procedural fallback, matched to pilot-portrait.jpg (white hair and beard, laurel, glowing eyes).
  portrait: { skin: '#d8b48e', hair: '#ece6d8', style: 'long', eyes: 'cyber', accent: 'beard', iris: '#e8f4ff', suit: '#5a4a32' },
  weapons: {
    main: 'Thunder Strand — every punch throws lightning from that fist; it races through up to 10 targets and arcs to everything around them; gains strands as he fights',
    focus: 'Thunder Spears — punches that throw volleys of lightning-fast piercing spears',
  },
  art: oduyaArt,
  special: {
    name: 'THUNDERSHOCK',
    desc: 'Clap the fists: a lightning web races through every enemy on screen, stuns them 2 s, then they explode',
    cooldown: 600,
    duration: 124,
    activate(p, w) {
      w.cancelCircle(p.x, p.y, 160);
      punch(p, -1); punch(p, 1); hold(p, 1, 16);
      const [lx, ly] = oduyaArt.anchor('fistL'), [rx, ry] = oduyaArt.anchor('fistR');
      const x0 = p.x + (lx + rx) / 2, y0 = p.y + (ly + ry) / 2 - 10;
      p.ps.shock = { list: webOrder(targets(w), x0, y0), k: 0, hx: x0, hy: y0, x0, y0, reached: [] };
      clapFx(p, w, x0, y0);
    },
    update(p, w, t) {
      const sh = p.ps.shock;
      if (!sh) return;
      if (t < 30) flare(p, 1 - t / 30);
      stepWeb(p, w, t);
      if (t !== 120) return;
      for (const e of sh.list) {
        if (!e.alive) continue;
        const x = e.x, y = e.y, boss = e.boss || e.ctrl || e.kind === 'bosspart';
        // Electrified enemies explode (lethal); bosses can't be stunned and take a heavy hit.
        w.damage(e, boss ? 30 : Math.max(30, e.hp * 4));
        nodeBurst(p, w, x, y, 14);
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
    activate(p, w) {
      p.ps.storm = { t: 0 };
      punch(p, -1); punch(p, 1); hold(p, 1, 18); // both fists punch up into the sky
      w.r.post.flash(0.5, 0.65, 1, 0.2, 0.06);
    },
    update(p, w, t) {
      const st = p.ps.storm, B = ODUYA.storm;
      w.cancelAll();
      if (!st) return;
      st.t = t;
      flare(p, t < 100 ? 0.8 : 0);
      // Bolts climb from both fists into the cloud (feeding it), then it rains lightning.
      if ((t < B.from && t % 2 === 0) || t % 10 === 0) for (const side of [-1, 1]) {
        const [fx, fy] = fistAt(p, side);
        p.ps.bolts.push({ pts: [[fx, fy], [fx + side * 40 + w.fxRng.range(-30, 30), B.cloudY]], arcs: [], t: 0, life: 4, w: 6, s: w.fxRng.next() * 100 });
      }
      if (t >= B.from && t <= B.to && (t - B.from) % B.every === 0) {
        const T = targets(w);
        const e = T.length && w.rng.chance(0.75) ? w.rng.pick(T) : { x: w.rng.range(30, W - 30), y: w.rng.range(40, H - 140) };
        skyStrike(p, e.x + w.fxRng.range(-30, 30), B.cloudY, e.x, e.y, 7, 8);
        w.damageCircle(e.x, e.y, 46, 9);
        w.explosions.sparks(e.x, e.y, 10, WHITE, 5, 16, 4);
        if (t % 12 === 0) w.r.post.flash(0.6, 0.7, 1, 0.12, 0.08);
      }
      if (t === B.clap) {
        // The closing thunderclap.
        ringPulse(w, W / 2, H * 0.4, ELEC, 20, 420, 26);
        w.r.post.flash(0.7, 0.85, 1, 0.45, 0.05);
        w.r.post.shockwave(W / 2, H * 0.35, 0.05, 0.02, 0.9);
        w.g.camera.addTrauma(0.5);
      }
    },
    end(p) { p.ps.storm = null; },
  },
  ultimate: {
    name: 'GOD THUNDER',
    duration: ODUYA.ult.dur, // 7 s
    activate(p, w) {
      p.ps.god = { ph: 'charge', t: 0, t0: 0, x: p.x, y: p.y - 58, y0: 0, speed: 0, lashes: 0, nuked: false, nukeHits: 0 };
      w.r.post.flash(0.5, 0.65, 1, 0.25, 0.05);
    },
    update(p, w, t) { stepGod(p, w, t); },
    end(p) { p.ps.god = null; },
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
    const ps = p.ps;
    ps.fBolt = w.r.frame('o_bolt');
    ps.strands = STRAND_MIN;
    ps.evo = 0;
    ps.bolts = [];
    ps.strikes = [];
    ps.leaders = [];
    ps.shock = null;
    ps.storm = null;
    ps.god = null;
    rigState(p);
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
    rigStep(p);
    const ps = p.ps;
    if (p.state === 'alive') evolve(p, w, 1);
    stepLeaders(p, w);
    spearHits(p, w);
    if (ps.god) godParticles(p, w, ps.god);
    for (const s of ps.bolts) s.t++;
    if (ps.bolts.length) ps.bolts = ps.bolts.filter((s) => s.t < s.life);
    for (const s of ps.strikes) s.t++;
    if (ps.strikes.length) ps.strikes = ps.strikes.filter((s) => s.t < s.life);
  },

  optionLayout: () => [],

  fire(p, w) {
    if (p.fireCd > 0) return;
    if (p.focus) {
      p.fireCd = SPEAR_CD;
      spears(p, w);
    } else {
      p.fireCd = STRIKE_CD;
      strike(p, w);
    }
  },

  renderFx(p, b) { renderLightning(p, b); },
};
