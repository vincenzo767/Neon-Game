import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { FADE_OUT } from '../fx/Particles.js';
import { kairoArt, LOOK, PAL, anchor, anchorData, unitsPerPx, kairoFrames, animatedAnchor, buildKairoSprites, renderMecha, animate, exhaust } from './kairoArt.js';
import { LANCE_R, SHARD_TAG, renderShots, renderBeam, muzzleFx, hitSpark, rigEvents, beamParticles } from './kairoFx.js';
import { rigState, step as rigStep, fired } from './kairoRig.js';

// KAIRO VANCE — STORMLANCE (interceptor mecha)
// Piercing rail lasers · Focus: continuous rail beam · Special: phase-dash
// Bomb: Arc Cascade · Ultimate: Orbital Rail Strike Grid
//
// KAIRO ART (v2, ASSET_NOTES.md "Rebuild v2"): a component mecha (kairoArt.js
// + kairoRig.js + kairoFx.js) replaces drawShip() when the art loads;
// drawShip() stays as the automatic fallback. Approved gameplay changes:
// lances keep the original pattern (spacing and angles, from chest level);
// the tier-3/4 option pods became glowing lance emitters on the inner / outer
// wing tips, angled outward (same shot count and damage); the focus beam leaves the blue chest plate after a 0.2 s
// charge. The feet never fire.

const CYAN = [0.3, 0.95, 1.0];
const UP = -Math.PI / 2;

function drawShip(ctx, w, h, tier) {
  const cx = w / 2;
  // Tier 2+: swept wing blades behind the main wing.
  if (tier >= 2) {
    mirrorPath(ctx, cx, [4, 24, 21, 29, 22, 34, 6, 34]);
    ctx.fillStyle = chrome(ctx, 0, w, '#0c1018', '#334055', '#7d8ea8');
    ctx.fill(); outline(ctx);
  }
  // Tier 4: dorsal tail fins.
  if (tier >= 4) {
    mirrorPath(ctx, cx, [3, 36, 12, 47, 11, 51, 3, 47]);
    ctx.fillStyle = '#1a2230'; ctx.fill(); outline(ctx);
    neonLines(ctx, cx, [4, 37, 11, 47], 'rgba(90,240,255,1)', 0.7, 5);
  }
  // Main hull.
  mirrorPath(ctx, cx, [0, 1, 2, 9, 4, 19, 6, 24, 20, 36, 21, 41, 8, 39, 6, 46, 3, 50, 0, 50]);
  ctx.fillStyle = chrome(ctx, cx - 21, cx + 21);
  ctx.fill(); outline(ctx);
  // Panel lines.
  ctx.strokeStyle = 'rgba(8,12,20,0.75)'; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, 24); ctx.lineTo(cx, 49);
  ctx.moveTo(cx - 7, 38); ctx.lineTo(cx + 7, 38);
  ctx.stroke();
  // Neon trims (leading edges + intakes).
  neonLines(ctx, cx, [6, 24.5, 20, 36, 3, 46, 5, 30], 'rgba(90,240,255,1)', 0.8, 6);
  // Tier 3+: wingtip rail barrels.
  if (tier >= 3) {
    for (const s of [-1, 1]) {
      const x = cx + s * 18;
      ctx.fillStyle = '#0e131c';
      ctx.fillRect(x - 1.4, 22, 2.8, 16);
      ctx.strokeStyle = 'rgba(90,240,255,0.9)'; ctx.lineWidth = 0.6;
      ctx.strokeRect(x - 1.4, 22, 2.8, 16);
      glowDot(ctx, x, 22, 2.6, 'rgba(90,240,255,1)');
    }
  }
  // Tier 4: glowing spine.
  if (tier >= 4) {
    ctx.beginPath(); ctx.moveTo(cx, 26); ctx.lineTo(cx, 47);
    ctx.save(); ctx.shadowColor = '#5ff'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#bff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  canopy(ctx, cx, 16, 2.4, 5.5, '#ffffff', '#5fe8ff', '#082038');
  // Nav lights.
  ctx.fillStyle = '#ff3355'; ctx.fillRect(cx - 21, 36, 1.6, 3);
  ctx.fillStyle = '#33ff99'; ctx.fillRect(cx + 19.4, 36, 1.6, 3);
}

function railSprite(ctx, w, h) { drawBolt(ctx, w, h, 'rgba(90,240,255,0.9)'); }

// Lances (owner: "like before"): the original pattern, straight at the
// original spacing and outward angles, no inward aim. They leave the chest
// level (oy is the old stagger behind the front pair); the feet never fire.
// Per side s = ±1: x = s·ox, angle = UP + s·d.
const LANCES = [
  { ox: 4, oy: 0, d: 0, dmg: 1.2, tier: 1 },
  { ox: 10, oy: 10, d: 0.07, dmg: 0.9, tier: 2 },
  { ox: 16, oy: 16, d: 0.16, dmg: 0.8, tier: 4 },  // tier-4 extras: angled outward
];

// Wing-tip emitters (tiers 3-4, replacing the pods): glowing lances angled
// outward from each tip [outward angle unfocused, focused]; same shot count
// and damage as the pods.
const TIPS = { 3: ['innerTipL', 'innerTipR'], 4: ['innerTipL', 'innerTipR', 'outerTipL', 'outerTipR'] };
const TIP_ANG = { inner: [0.1, 0.04], outer: [0.22, 0.1] };

export default {
  id: 'kairo',
  name: 'KAIRO VANCE',
  vehicle: 'STORMLANCE',
  role: 'Interceptor Mecha',
  bio: 'Precinct 9\'s fastest pursuit pilot, flying the Stormlance: a white, navy and gold interceptor mecha with twin hand cannons and wing arrays that unfold as it powers up. Kairo flew syndicate courier runs before he flipped, and he still treats every red light as a suggestion.',
  color: CYAN,           // blue rail energy (shots, UI accent)
  css: '#4ff0ff',
  // Art test: the Stormlance's paint (white armour, gunmetal frame, red plating) + blue energy.
  palette: { armour: '#f2f4f8', frame: '#1c2030', plating: '#e0182a', energy: '#4ff0ff' },
  stats: { speed: 5, power: 3, range: 5, bomb: 2 },
  speed: { normal: 5.2, focus: 2.1 },
  hitbox: 2.4,
  bombStock: 2,
  engines: [[-3, 24], [3, 24]],
  engineColor: [0.4, 0.8, 1.0],
  art: kairoArt,           // hand-made art instance (test range, ?test=kairo)
  // Procedural fallback, matched to pilot_portrait.jpg (dark navy hair, brown eyes, blue jacket).
  portrait: { skin: '#e0ae86', hair: '#14202e', iris: '#6a4424', style: 'spiky', eyes: 'eyes', suit: '#24407a' },
  weapons: {
    main: 'Rail Lances — the twin hand cannons fire piercing lances that punch through every target in line; the unfolded wings add tip emitters',
    focus: 'Rail Beam — after a brief charge, a continuous piercing beam from the chest emitter',
  },
  special: {
    name: 'PHASE DASH',
    desc: 'Blink through bullets, untouchable mid-dash',
    cooldown: 100,
    duration: 10,
    activate(p, w) {
      let dx = p.moveX, dy = p.moveY;
      const len = Math.hypot(dx, dy);
      if (len < 0.2) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
      p.ps.dvx = dx * 11; p.ps.dvy = dy * 11;
      p.ps.phase = 24;
      p.ps.moveLock = true;
      w.r.post.aberrate(0.012);
    },
    update(p, w) {
      p.x = Math.min(WORLD_W - 12, Math.max(12, p.x + p.ps.dvx));
      p.y = Math.min(WORLD_H - 18, Math.max(22, p.y + p.ps.dvy));
      const H = w.fxHigh, art = kairoFrames().art;
      if (art) {
        // 3-4 fading blue afterimages of the mecha.
        if (p.specialT % 3 !== 0) return;
        const full = (art[LOOK.outline ? 'outline' : 'plain'] || art.outline).full, A = anchorData(), k = unitsPerPx(), hb = A.anchors.hitbox;
        const i = H.spawn(full.frame, p.x + (A.image.w / 2 - hb[0]) * k, p.y + (A.image.h / 2 - hb[1]) * k, 0, 0, 16);
        if (i >= 0) { H.size(i, A.image.w * k); H.color(i, 0.35, 0.9, 2.2, 0.15, 0.3, 1.4); H.look(i, 0.5, 1, FADE_OUT); }
        return;
      }
      const f = p.frames[p.tier - 1];
      const i = H.spawn(f, p.x, p.y, 0, 0, 14);
      if (i >= 0) { H.size(i, f.w); H.color(i, 0.4, 1.4, 2); H.look(i, 0.45, 1, FADE_OUT); }
    },
    end(p) { p.ps.moveLock = false; },
  },
  bomb: {
    name: 'ARC CASCADE',
    duration: 110,
    activate() {},
    update(p, w, t) {
      w.cancelAll();
      for (let k = 0; k < 6; k++) {
        const x = (k + 0.5) * (WORLD_W / 6) + Math.sin(t * 0.07 + k * 1.3) * 40;
        w.beam(x, WORLD_H + 10, x, -20, 30, 0.9, CYAN);
      }
      if (t % 12 === 0) { w.g.camera.addTrauma(0.15); w.r.post.shockwave(p.x, p.y - 100, 0.015, 0.02, 0.4); }
    },
  },
  ultimate: {
    name: 'ORBITAL RAIL GRID',
    duration: 220,
    activate(p, w) {
      const lines = [...GRID_COLS.map((x) => ({ v: true, p: x })), ...GRID_ROWS.map((y) => ({ v: false, p: y }))];
      // Shuffle strike order (cosmetic RNG: order doesn't change total damage).
      for (let i = lines.length - 1; i > 0; i--) {
        const j = (w.fxRng.next() * (i + 1)) | 0;
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      p.ps.grid = { lines, next: 0, active: [] };
    },
    update(p, w, t) {
      const g = p.ps.grid;
      if (t >= 30) w.cancelAll();
      if (t >= 30 && t < 170 && t % 12 === 6 && g.next < g.lines.length) {
        const ln = g.lines[g.next++];
        ln.fired = t;
        g.active.push(ln);
        w.g.camera.addTrauma(0.25);
        w.r.post.aberrate(0.01);
        const cx = ln.v ? ln.p : WORLD_W / 2, cy = ln.v ? WORLD_H / 2 : ln.p;
        w.r.post.shockwave(cx, cy, 0.02, 0.025, 0.5);
      }
      if (t === 176) {
        for (const ln of g.lines) { ln.fired = t; g.active.push(ln); }
        w.r.post.flash(0.6, 1, 1, 0.6, 0.03);
        w.r.post.shockwave(p.x, p.y, 0.07, 0.025, 1.2);
        w.g.camera.addTrauma(0.9);
        w.g.hitStop(6);
      }
      for (const ln of g.active) {
        const age = t - ln.fired;
        if (age > 12) continue;
        const width = 34 * (1 - age / 14);
        if (ln.v) w.beam(ln.p, WORLD_H + 10, ln.p, -10, width, 2.4, CYAN);
        else w.beam(-10, ln.p, WORLD_W + 10, ln.p, width, 2.4, CYAN);
      }
    },
    end(p) { p.ps.grid = null; },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_kairo_${t}`, 44, 52, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('k_rail', 30, 5, railSprite, { scale: 3 });
    buildKairoSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => renderMecha(p, b, x, y, a),
  exhaust,

  renderBelow(p, b) {
    // Phase-dash: curved ribbon trail through the recent dash path.
    const tr = p.ps.trail;
    if (!tr || tr.length < 2 || !kairoFrames().art) return;
    const F = p.F, n = tr.length;
    for (let k = 1; k < n; k++) {
      const [x0, y0] = tr[k - 1], [x1, y1] = tr[k];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.5) continue;
      const f = k / n, ang = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      // Soft stretched glows (tapered ends) so overlapping segments don't band.
      b.draw(F.glow, mx, my, len * 2.2 + 8, 8 + 20 * f, ang, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.22 * f, 1);
      b.draw(F.glow, mx, my, len * 2 + 4, 3 + 6 * f, ang, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.4 * f, 1);
    }
  },

  init(p, w) {
    p.ps.fRail = w.r.frame('k_rail');
    p.ps.phase = 0;
    p.ps.kr = rigState();
  },

  reset(p) { p.ps.kr.fs = 'off'; p.ps.kr.want = false; },

  update(p, w) {
    if (p.ps.phase > 0) p.ps.phase--;
    p.ps.beam = null; // re-set by fire() while the focus beam is live
    animate(p);
    const ev = rigStep(p); // tier wings, cannon recoil, focus-beam state
    rigEvents(p, w, ev);
    beamParticles(p, w, ev);
  },

  // No floating pods: the wing tips carry the tier-3/4 emitters (fire()).
  optionLayout: () => [],

  fire(p, w) {
    const t = p.tier, S = w.shots, rail = p.ps.fRail, kr = p.ps.kr;
    if (p.focus) {
      // Focus beam from the blue chest plate: the rig charges it for 0.2 s, then it is
      // re-declared every step while held (damage only while active).
      kr.want = true;
      if (kr.fs === 'active') {
        const width = 5 + t * 2, [bx, by] = anchor('chest');
        const bm = w.beam(p.x + bx, p.y + by, p.x + bx, -20, width, 0.2 + 0.06 * t, CYAN);
        bm.skin = 'kairo';
        p.ps.beam = bm;
      }
    }
    if (p.fireCd > 0) return;
    p.fireCd = 5;
    const shoot = (x, y, a, dmg, r, tag) => {
      const i = w.shot(x, y, a, 22, rail, dmg, r);
      if (i >= 0) { S.behave(i, dmg, 0, 1); S.aux[i] = tag; } // aux: visual tag (tier / shard)
    };
    // Wing-tip emitters (tiers 3-4, in and out of focus): glowing lances angled outward.
    if (t >= 3) {
      TIPS[t].forEach((name) => {
        const [tx, ty] = animatedAnchor(p, name), side = name.endsWith('L') ? -1 : 1;
        const d = TIP_ANG[name.startsWith('inner') ? 'inner' : 'outer'][p.focus ? 1 : 0];
        shoot(tx, ty, UP + side * d, 0.7, 5, t);
      });
    }
    if (p.focus) return;
    const [, cy] = anchor('chest');
    for (const L of LANCES) {
      if (t < L.tier) continue;
      for (const s of [-1, 1]) {
        const x = p.x + s * L.ox, y = p.y + cy + L.oy, ang = UP + s * L.d;
        shoot(x, y, ang, L.dmg, LANCE_R[t - 1], t);
        if (L.tier === 1) muzzleFx(p, w, x, y - 4, ang);
      }
    }
    fired(p); // recoil, armour flash, charge pulses
  },

  renderShots,
  hitSpark,

  // The chest beam (charge, live beam, collapse) is drawn over the mecha: it leaves the chest plate.
  renderAbove(p, b, x, y) {
    renderBeam(p, b, x, y);
  },

  renderFx(p, b) {
    const g = p.ps.grid;
    if (!g) return;
    // Targeting lines for strikes that haven't fired yet.
    const F = p.F, blink = (p.t >> 2) & 1 ? 0.5 : 0.25;
    for (const ln of g.lines) {
      if (ln.fired !== undefined && g.active.includes(ln)) continue;
      if (ln.v) b.draw(F.laser, ln.p, WORLD_H / 2, WORLD_H, 4, Math.PI / 2, 1, 0.3, 0.4, blink, 1);
      else b.draw(F.laser, WORLD_W / 2, ln.p, WORLD_W, 4, 0, 1, 0.3, 0.4, blink, 1);
    }
    for (const x of GRID_COLS) for (const y of GRID_ROWS) b.draw(F.ring, x, y, 18, 18, 0, 1, 0.4, 0.5, blink, 1);
  },
};
