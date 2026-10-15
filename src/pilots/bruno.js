import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, chrome, outline, glowDot, drawBolt, neonLines } from '../fx/art.js';
import { SHOT_FLAK } from '../entities/World.js';
import { brunoArt } from './brunoArt.js';
import {
  renderShots, flakBurst, muzzleFlash, buildSprites as buildFxSprites,
  rigEvents, focusParticles, focusMuzzle, renderFocus, renderShield, absorbFx, shieldParticles,
  blastBurst, renderBlast, renderUlt, nukeBurst, tierFx,
} from './brunoFx.js';
import { rigState, step as rigStep, fired, volleyFired } from './brunoRig.js';
import { BRUNO, clampT, ampNow, dmgMul, shieldR } from './brunoTuning.js';

// BRUNO HAGEN — IRONHOUND (heavy-artillery mecha)
// Explosive flak spread · Focus: shoulder-cannon barrage · Special: Reactive Shield
// Bomb: Flak Barrage · Ultimate: Carpet-Bomb Run + final nuke
//
// BRUNO v2 (ASSET_NOTES.md "Rebuild v2"): the component mecha (brunoArt.js +
// brunoRig.js + brunoFx.js) replaces drawShip() when the art loads; drawShip()
// stays as the automatic fallback. The flak fan leaves the two hand guns (the
// side cannons add a pair from tier 3); the focus barrage leaves the shoulder
// cannons. The feet never fire. FX: violet outside, orange inside.

const UP = -Math.PI / 2;

/** Big explosion (bomb, ultimate): the airburst look at scale s, with the blast's shockwave and shake. */
function boom(w, x, y, s) {
  flakBurst(w, x, y, 46 * s);
  w.r.post.shockwave(x, y, 0.012 * s, 0.012 + 0.004 * s, 0.12 + 0.1 * s);
  w.r.post.heat(0.25 * s);
  w.g.camera.addTrauma(0.12 * s);
}

const REF = 170; // fan shells are aimed through the old fan's lanes this far ahead

/** Angle from a muzzle at (mx, my) (offsets from the player) through the old shot's lane (from ox, oy at angle a) REF ahead. */
function aimFrom(mx, my, ox, oy, a) {
  const tx = ox + Math.cos(a) * REF, ty = oy + Math.sin(a) * REF;
  return Math.atan2(ty - my, tx - mx);
}

function segDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2));
  const ex = x0 + dx * u - px, ey = y0 + dy * u - py;
  return ex * ex + ey * ey;
}

const ARMOR = (ctx, x0, x1) => chrome(ctx, x0, x1, '#16180f', '#555a3a', '#b0b28a');

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Tier 4: armour skirts + missile racks behind the hull.
  if (tier >= 4) {
    mirrorPath(ctx, cx, [8, 30, 26, 34, 26, 44, 10, 46]);
    ctx.fillStyle = '#23251a'; ctx.fill(); outline(ctx);
    ctx.fillStyle = '#c33';
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ctx.fillRect(cx + s * (18 + k * 2.4) - 0.8, 36, 1.6, 6);
  }
  // Hull.
  mirrorPath(ctx, cx, [0, 3, 6, 5, 9, 13, 10, 21, 22, 25, 24, 33, 22, 39, 12, 41, 10, 49, 0, 50]);
  ctx.fillStyle = ARMOR(ctx, cx - 24, cx + 24); ctx.fill(); outline(ctx, 1);
  // Armour plate seams.
  ctx.strokeStyle = 'rgba(10,10,6,0.8)'; ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 21); ctx.lineTo(cx + 10, 21);
  ctx.moveTo(cx - 10, 33); ctx.lineTo(cx + 10, 33);
  ctx.moveTo(cx, 21); ctx.lineTo(cx, 49);
  ctx.stroke();
  // Hazard stripes on wings.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(s > 0 ? cx + 13 : cx - 22, 27, 9, 5); ctx.clip();
    for (let k = -2; k < 6; k++) {
      ctx.fillStyle = k & 1 ? '#111' : '#ff9a1a';
      ctx.beginPath();
      const x = (s > 0 ? cx + 13 : cx - 22) + k * 2.5;
      ctx.moveTo(x, 27); ctx.lineTo(x + 2.5, 27); ctx.lineTo(x + 0.5, 32); ctx.lineTo(x - 2, 32); ctx.fill();
    }
    ctx.restore();
  }
  // Visor slit.
  ctx.fillStyle = '#100800'; ctx.fillRect(cx - 5, 10, 10, 4);
  ctx.save(); ctx.shadowColor = '#ffa030'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffc060'; ctx.fillRect(cx - 4, 11, 8, 2); ctx.restore();
  // Tier 2+: chin turret.
  if (tier >= 2) {
    ctx.fillStyle = '#2b2e1e'; ctx.beginPath(); ctx.arc(cx, 19, 3.4, 0, Math.PI * 2); ctx.fill(); outline(ctx, 0.6);
    ctx.fillStyle = '#111'; ctx.fillRect(cx - 0.8, 12.5, 1.6, 6);
  }
  // Tier 3+: wing gun pods.
  if (tier >= 3) {
    for (const s of [-1, 1]) {
      const x = cx + s * 17;
      ctx.fillStyle = ARMOR(ctx, x - 3, x + 3); ctx.fillRect(x - 3, 16, 6, 12); ctx.strokeStyle = '#05060a'; ctx.lineWidth = 0.6; ctx.strokeRect(x - 3, 16, 6, 12);
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x - 0.9, 10, 1.8, 7);
      glowDot(ctx, x, 10, 1.8, 'rgba(255,170,60,1)');
    }
  }
  neonLines(ctx, cx, [10, 21.5, 22, 25.5], 'rgba(255,160,50,1)', 0.7, 5);
}

function drawPod(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = ARMOR(ctx, 0, w); ctx.fillRect(1, 4, w - 2, h - 5);
  ctx.strokeStyle = '#05060a'; ctx.lineWidth = 0.6; ctx.strokeRect(1, 4, w - 2, h - 5);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(cx - 1, 0, 2, 6);
  glowDot(ctx, cx, h - 3, 2, 'rgba(255,160,60,1)');
}

function drawFlak(ctx, w, h) { glowDot(ctx, w / 2, h / 2, w / 2, 'rgba(255,150,40,1)'); }
function drawShell(ctx, w, h) { drawBolt(ctx, w, h, 'rgba(255,140,40,1)', '#fff0c0'); }

function drawBomber(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 5, 10, 6, 26, 44, 40, 44, 46, 8, 44, 6, 60, 16, 66, 16, 69, 0, 68]);
  ctx.fillStyle = chrome(ctx, 0, w, '#101208', '#3b3f2a', '#80846a'); ctx.fill(); outline(ctx, 1.2);
  for (const s of [-1, 1]) for (const ex of [16, 30]) glowDot(ctx, cx + s * ex, 45, 3, 'rgba(190,110,255,1)');
  ctx.fillStyle = '#ffb040'; ctx.fillRect(cx - 3, 12, 6, 3);
}

/** Pick an airburst target: a live enemy if any, otherwise a random spot up-field. */
function burstTarget(w) {
  const E = w.enemies.active.filter((e) => e.alive && e.y > 0);
  if (E.length && w.rng.chance(0.7)) {
    const e = w.rng.pick(E);
    return [e.x + w.rng.range(-20, 20), e.y + w.rng.range(-20, 20)];
  }
  return [w.rng.range(30, WORLD_W - 30), w.rng.range(40, WORLD_H * 0.6)];
}

/** One wave of five bombers (alternate waves shifted half a lane). */
function bomberWave(k) {
  const xs = [60, 150, 240, 330, 420].map((x) => Math.min(WORLD_W - 30, x + (k & 1 ? 45 : 0)));
  return xs.map((x, j) => ({ x, y: WORLD_H + 80 + Math.abs(j - 2) * 50, py: WORLD_H + 80, drop: j * 2 }));
}

/** Every enemy inside the playfield (the nuke's targets). */
const inField = (e) => e.alive && !e.untargetable && e.x > -e.r && e.x < WORLD_W + e.r && e.y > -e.r && e.y < WORLD_H + e.r;

export default {
  id: 'bruno',
  name: 'BRUNO HAGEN',
  vehicle: 'IRONHOUND',
  role: 'Heavy Mecha',
  bio: 'Twenty years on riot detail and two rebuilt knees. Bruno flies the Ironhound, a silver and crimson artillery mecha: two hand guns, two shoulder cannons and a pair of side guns that unfold as it powers up. He doesn\'t dodge so much as soak the storm and send it back.',
  color: [0.75, 0.3, 1.0],
  css: '#b46cff',
  // The Ironhound's paint (silver / blue-grey armour, crimson plates) + violet energy.
  palette: { armour: '#a9abbd', frame: '#2e3038', plating: '#d6283a', energy: '#b46cff' },
  stats: { speed: 2, power: 5, range: 4, bomb: 4 },
  speed: { normal: 3.6, focus: 1.6 },
  hitbox: 3.0,
  bombStock: 4,
  engines: [[-6, 24], [6, 24]],
  engineColor: [0.8, 0.45, 1.0],
  optionSprite: 'b_pod',
  // Procedural fallback, matched to pilot_portrait.jpg (white side-shaved hair, scarred eye, white vest).
  portrait: { skin: '#7a4a32', hair: '#e4e2da', style: 'buzz', eyes: 'eyes', iris: '#8a8f96', accent: 'scar', suit: '#d8d8d2' },
  weapons: {
    main: 'Flak Spread — explosive shells from both hand guns, any range; the side cannons join from tier 3',
    focus: 'Shoulder Barrage — heavy shells from both shoulder cannons after a short charge',
  },
  art: brunoArt,
  special: {
    name: 'REACTIVE SHIELD',
    desc: 'A 6 s shield sphere: immune to everything, and every attack it absorbs powers up his guns',
    cooldown: 900,
    duration: BRUNO.shield.dur,
    activate(p) {
      // A new shield starts from whatever bonus is still in effect.
      p.ps.amp = ampNow(p);
      p.ps.ampT = 0;
      p.ps.shield = { t: 0, n: 0, touch: 0, hitT: 0 };
    },
    update(p, w, t) {
      const sh = p.ps.shield, C = BRUNO.shield, R = shieldR(t);
      sh.t = t;
      // Absorb: every enemy bullet that enters the sphere is removed (so it counts once).
      let n = 0;
      w.bullets.clearRadius(p.x, p.y, R, (x, y) => { n++; absorbFx(p, w, x, y); });
      // Lasers and body contact: one absorbed attack per `touchEvery` steps of contact.
      let touching = false;
      for (const L of w.lasers) {
        if (L.dead || L.t < L.warn || !(L.fire > 0)) continue;
        const x1 = L.x0 + Math.cos(L.ang) * L.len, y1 = L.y0 + Math.sin(L.ang) * L.len;
        if (segDist2(p.x, p.y, L.x0, L.y0, x1, y1) < (L.width * 0.35 + R) ** 2) { touching = true; break; }
      }
      if (!touching) {
        for (const e of w.enemies.active) {
          if (!e.alive || e.untargetable || e.ground) continue;
          const dx = e.x - p.x, dy = e.y - p.y, rr = e.r * 0.6 + R;
          if (dx * dx + dy * dy < rr * rr) { touching = true; break; }
        }
      }
      if (touching && ++sh.touch % C.touchEvery === 0) n++;
      if (n) {
        sh.n += n;
        sh.hitT = 8;
        p.ps.amp = Math.min(C.cap, (p.ps.amp || 0) + n * C.per);
      }
      if (sh.hitT > 0) sh.hitT--;
    },
    end(p) {
      p.ps.shield = null;
      p.ps.ampT = BRUNO.shield.hold + BRUNO.shield.fade; // the bonus window
    },
  },
  bomb: {
    name: 'FLAK BARRAGE',
    duration: 100,
    activate(p, w) {
      // Opening blast centred on Bruno: grows to its damage radius, each enemy hit once.
      p.ps.blast = { x: p.x, y: p.y, t: 0, hit: new Set() };
      blastBurst(p, w, p.x, p.y);
    },
    update(p, w, t) {
      const bl = p.ps.blast, C = BRUNO.bomb;
      bl.t = t;
      if (t <= C.grow) {
        const r = C.r * (1 - (1 - t / C.grow) ** 2);
        for (const e of w.enemies.active) {
          if (!e.alive || e.untargetable || bl.hit.has(e)) continue;
          const dx = e.x - bl.x, dy = e.y - bl.y, rr = r + e.r;
          if (dx * dx + dy * dy < rr * rr) { bl.hit.add(e); w.damage(e, C.dmg); }
        }
      }
      // The original Flak Barrage (unchanged damage).
      w.cancelAll();
      if (t % 3 === 0) {
        const [x, y] = burstTarget(w);
        boom(w, x, y, 0.9);
        w.damageCircle(x, y, 55, 7);
      }
    },
    end(p) { p.ps.blast = null; },
  },
  ultimate: {
    name: 'CARPET-BOMB RUN',
    duration: BRUNO.ult.run + BRUNO.ult.drop + BRUNO.ult.tail,
    activate(p) {
      p.ps.bombers = [];
      p.ps.drops = [];
      p.ps.nuke = { t: 0, x: WORLD_W / 2, y: WORLD_H * 0.42, done: false, hits: 0 };
    },
    update(p, w, t) {
      const U = BRUNO.ult, ps = p.ps, nk = ps.nuke;
      nk.t = t;
      w.cancelAll(); // bullets are cleared throughout the whole sequence
      // Phase B: bomber waves; each drops a bomb every few steps while the run lasts.
      const wave = U.waves.indexOf(t);
      if (wave >= 0) ps.bombers.push(...bomberWave(wave));
      for (const bm of ps.bombers) {
        bm.py = bm.y;
        bm.y -= 4.2;
        if (t <= U.run && bm.y < WORLD_H && bm.y > 0 && ++bm.drop % U.dropEvery === 0) ps.drops.push({ x: bm.x + w.rng.range(-14, 14), y: bm.y + 10, t: 18 });
      }
      ps.bombers = ps.bombers.filter((bm) => bm.y > -120);
      for (const d of ps.drops) {
        d.y += 0.6;
        if (--d.t === 0) {
          boom(w, d.x, d.y, 1.2);
          w.damageCircle(d.x, d.y, U.bombR, U.bombDmg);
        }
      }
      ps.drops = ps.drops.filter((d) => d.t > 0);
      // Phase C: the final bomb lands once, at the end of its drop.
      if (t === U.run + U.drop && !nk.done) {
        nk.done = true;
        for (const e of w.enemies.active) if (inField(e)) { w.damage(e, U.nukeDmg); nk.hits++; }
        nukeBurst(p, w, nk.x, nk.y);
      }
    },
    end(p) { p.ps.bombers = null; p.ps.drops = null; p.ps.nuke = null; },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_bruno_${t}`, 52, 52, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('b_pod', 10, 14, drawPod, { scale: 3 });
    atlas.add('b_flak', 10, 10, drawFlak, { scale: 3 });
    atlas.add('b_shell', 16, 7, drawShell, { scale: 3 });
    atlas.add('b_bomber', 92, 70, drawBomber, { scale: 2 });
    brunoArt.buildSprites(atlas);
    buildFxSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => brunoArt.renderMecha(p, b, x, y, a),
  exhaust: brunoArt.exhaust,
  renderShots,
  flakBurst,

  /** Reactive Shield: total immunity (bullets, lasers, contact) through Player.invulnerable. */
  intangible: (p) => !!p.ps.shield,

  update(p, w) {
    brunoArt.animate(p);
    const ev = rigStep(p); // artillery deployment, recoil, focus cycle
    rigEvents(p, w, ev);
    focusParticles(p, w, ev);
    shieldParticles(p, w);
    const ps = p.ps;
    // The shield bonus window runs down once the shield is gone.
    if (!ps.shield && ps.ampT > 0 && --ps.ampT === 0) ps.amp = 0;
    // Propulsion surges while the artillery unfolds.
    if (ps.br.innerDir > 0 || ps.br.outerDir > 0) ps.thr = Math.max(ps.thr, 1.7);
  },

  init(p, w) {
    p.ps.fFlak = w.r.frame('b_flak');
    p.ps.fShell = w.r.frame('b_shell');
    p.ps.fBomber = w.r.frame('b_bomber');
    p.ps.br = rigState();
    p.ps.shield = null;
    p.ps.amp = 0;
    p.ps.ampT = 0;
  },

  reset(p) {
    p.ps.shield = null; p.ps.amp = 0; p.ps.ampT = 0;
    p.ps.br.fs = 'off'; p.ps.br.want = false;
  },

  // Owner-approved: no option pods; their firepower moved into the side cannons.
  optionLayout: () => [],

  fire(p, w) {
    const br = p.ps.br;
    // Focus: the shoulder cannons charge first (brunoRig); the hand guns keep firing
    // until the barrage starts. Asked every step, before the cooldown.
    if (p.focus) br.want = true;
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots, R = w.rng, ps = p.ps, mul = dmgMul(p);
    if (p.focus && br.fs === 'active') {
      // Shoulder barrage: one heavy shell per wide-bore cannon (T1-T2), plus one per long barrel (T3-T4).
      const F = BRUNO.focus, dmg = F.dmg[clampT(p)] * mul;
      p.fireCd = F.cd;
      for (const g of t >= 3 ? ['wide', 'shoulderTip'] : ['wide']) {
        for (const s of ['L', 'R']) {
          // The old siege-shell targeting: each shell converges on the centre line (its
          // old lane, a few units off centre) REF ahead, so the barrage concentrates.
          const [mx, my] = brunoArt.animatedAnchor(p, g + s), lane = (s === 'L' ? -1 : 1) * (g === 'wide' ? 4 : 10);
          const a = aimFrom(mx - p.x, my - p.y, lane, -22, UP);
          const i = w.shot(mx, my, a, F.speed, ps.fShell, dmg, 6);
          if (i >= 0) S.behave(i, dmg, 0, 0, 0, SHOT_FLAK, F.r); // no fuse: bursts on contact
          focusMuzzle(p, w, mx, my, g === 'wide', s === 'L' ? -1 : 1);
        }
      }
      volleyFired(p);
      w.g.camera.kick(0, 1.6);
      return;
    }
    // Normal fire: the original flak fan (count, spread, cadence), split across the hand guns.
    p.fireCd = BRUNO.flak.cd;
    br.alt ^= 1;
    const n = 3 + t * 2, spread = 0.5 + 0.08 * t, dmg = BRUNO.flak.dmg * mul;
    for (let k = 0; k < n; k++) {
      const a0 = UP + (k / (n - 1) - 0.5) * spread, sp = 9 + R.range(-0.6, 0.6);
      const left = 2 * k < n - 1 || (2 * k === n - 1 && br.alt === 0);
      const [mx, my] = brunoArt.animatedAnchor(p, left ? 'muzzleL' : 'muzzleR');
      const a = aimFrom(mx - p.x, my - p.y, 0, -18, a0);
      const i = w.shot(mx, my, a, sp, ps.fFlak, dmg, 5);
      if (i >= 0) S.behave(i, dmg, 0, 0, 0, SHOT_FLAK, BRUNO.flak.r); // no fuse: flies until it hits or leaves the field
    }
    const size = 20 * tierFx('flash', p);
    for (const s of ['L', 'R']) { const [fx, fy] = brunoArt.animatedAnchor(p, 'muzzle' + s); muzzleFlash(p, w, fx, fy, size, s === 'L' ? -1 : 1); }
    fired(p);
    // Tiers 3-4: the side cannons add one shell each, straight up.
    if (t >= 3) {
      const C = BRUNO.side, sd = C.dmg * mul;
      for (const s of ['L', 'R']) {
        const [mx, my] = brunoArt.animatedAnchor(p, 'sideTip' + s);
        const i = w.shot(mx, my, UP, C.speed, ps.fFlak, sd, 5);
        if (i >= 0) S.behave(i, sd, 0, 0, 0, SHOT_FLAK, C.r);
        muzzleFlash(p, w, mx, my, 14 * tierFx('flash', p), 0);
      }
    }
  },

  renderAbove(p, b, x, y) {
    renderFocus(p, b, x, y);  // shoulder-cannon charge / barrage / recovery
    renderShield(p, b, x, y); // Reactive Shield sphere, absorbed-power gauge, bonus aura
  },

  renderFx(p, b, alpha) {
    renderBlast(p, b);        // the bomb's opening blast
    renderUlt(p, b, alpha);   // bombers, falling bombs, the nuke's warning, drop and blast
  },
};
