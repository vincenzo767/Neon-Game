import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, outline, neonLines } from '../fx/art.js';
import { tessArt, tessMechaFx, PAL } from './tessArt.js';
import { renderShots, renderSlash, renderCut, renderCopy, buildSprites as buildFxSprites } from './tessFx.js';

// TESS KURO — WIREGHOST (stealth mecha)
// Short-range piercing blades · Focus: close-quarters slash that cuts bullets
// Special: cloak (enemy aim locks onto a decoy) · Bomb: Thousand Cuts
// Ultimate: Shadow Clones that mirror her attacks
//
// TESS ART TEST: the hand-made mecha art (tessArt.js) replaces drawShip()
// when it loads; drawShip() stays as the automatic fallback. Crescents are
// thrown from the two forearm blades; the leg blades (feet) never fire.
// Clones and the decoy are full copies of the mecha. FX are violet outside,
// orange inside.

const VIOLET = [0.75, 0.4, 1.0];
const UP = -Math.PI / 2;
const CLONE_OFFSETS = [[-70, 14], [70, 14], [-130, 34], [130, 34]];
const REF = 130; // blade crescents cross the old crescent paths this far ahead (near the end of their short range)

/** Angle from a blade at (mx, my) through the point the old shot (from ox, oy at angle a) reached REF ahead. */
function aimAcross(mx, my, ox, oy, a) {
  return Math.atan2(oy + Math.sin(a) * REF - my, ox + Math.cos(a) * REF - mx);
}

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

/**
 * Fire one volley from (x, y). Used by Tess and by each shadow clone (a full
 * copy: same blades, same pattern). Art test (approved): every crescent
 * leaves a forearm blade, never the leg blades (feet).
 */
function volley(p, w, x, y, dmgMul, self) {
  const t = p.tier, S = w.shots;
  const flash = (name, size) => {
    const [fx, fy] = self ? tessArt.animatedAnchor(p, name) : (([ax, ay]) => [x + ax, y + ay])(tessArt.anchor(name));
    tessMechaFx.muzzleFlash(p, w, fx, fy, size);
  };
  if (p.focus) {
    // Close-quarters slash: big damage, also cuts enemy bullets it touches.
    // The swinging blade alternates; the small crescent leaves that blade.
    const sx = x, sy = y - 34, r = 30 + t * 6;
    w.damageCircle(sx, sy, r, (4 + t * 0.6) * dmgMul);
    w.cancelCircle(sx, sy, r * 0.8);
    const flip = (p.ps.flip = -p.ps.flip);
    p.ps.slashes.push({ x: sx, y: sy, r, t: 0, flip });
    const name = flip < 0 ? 'bladeMidL' : 'bladeMidR', [mx, my] = tessArt.anchor(name);
    const i = w.shot(x + mx, y + my, aimAcross(mx, my, 0, -16, UP), 10, p.ps.fBlade, 1.4, 7);
    if (i >= 0) { S.behave(i, 1.4 * dmgMul, 22, 1); S.motion(i, -0.25, 0, 3.5, 10); S.aux[i] = 2; }
    if (self) p.ps[flip < 0 ? 'kickL' : 'kickR'] = 1;
    flash(name, 18);
    return;
  }
  // The fan splits across the two blades; the middle crescent of an odd count alternates.
  const n = t + 1, used = new Set();
  for (let k = 0; k < n; k++) {
    const a0 = UP + (k / Math.max(1, n - 1) - 0.5) * (n > 1 ? 0.45 : 0);
    const side = k * 2 < n - 1 ? -1 : k * 2 > n - 1 ? 1 : p.ps.mid;
    const name = side < 0 ? 'bladeMidL' : 'bladeMidR', [mx, my] = tessArt.anchor(name);
    const i = w.shot(x + mx, y + my, aimAcross(mx, my, 0, -16, a0), 9.5, p.ps.fBlade, 1.5, 7);
    if (i >= 0) { S.behave(i, 1.5 * dmgMul, 22, 1); S.motion(i, -0.25, 0, 3.5, 10); S.aux[i] = 1; }
    used.add(name);
  }
  for (const name of used) flash(name, 14);
}

export default {
  id: 'tess',
  name: 'TESS KURO',
  vehicle: 'WIREGHOST',
  role: 'Stealth Mecha',
  bio: 'Ex-syndicate infiltrator turned precinct ghost. Tess flies the Wireghost, a violet mecha with a long blade on each forearm. She fights at knife range: she slips inside the bullet storm and cuts it apart from within.',
  color: VIOLET,
  css: '#c07aff',
  stats: { speed: 4, power: 4, range: 1, bomb: 2 },
  speed: { normal: 4.9, focus: 2.2 },
  hitbox: 2.2,
  bombStock: 2,
  engines: [[-4, 20], [4, 20]],
  engineColor: [0.8, 0.4, 1.0],
  optionSprite: null,
  // Procedural fallback, matched to pilot-portrait-main.jpg (long scarlet hair, red eyes, dark bodysuit).
  portrait: { skin: '#f2d6d0', hair: '#d8264a', style: 'long', eyes: 'eyes', iris: '#d0203a', suit: '#2a2c3c' },
  weapons: {
    main: 'Wire Blades — short-range piercing crescents thrown from both forearm blades',
    focus: 'Ghost Slash — a forearm-blade arc that cuts bullets',
  },
  // Art test: the Wireghost's paint (violet / lilac armour, red light lines) + violet energy.
  palette: { armour: '#b8b4e6', frame: '#2c2648', plating: '#5a46a8', energy: '#c07aff' },
  art: tessArt,
  special: {
    name: 'CLOAK',
    desc: 'Vanish: enemy aim locks onto a decoy, double graze charge',
    cooldown: 720,
    duration: 240,
    activate(p, w) {
      w.decoy = { x: p.x, y: p.y };
      p.ps.cloak = 1;
      p.alpha = 0.3;
      w.r.post.aberrate(0.015);
    },
    end(p, w) { w.decoy = null; p.ps.cloak = 0; p.alpha = 1; },
  },
  bomb: {
    name: 'THOUSAND CUTS',
    duration: 110,
    activate(p) { p.ps.cuts = []; },
    update(p, w, t) {
      w.cancelAll();
      if (t % 3 === 0 && t < 96) {
        const E = w.enemies.active.filter((e) => e.alive && e.y > 0);
        const tgt = E.length && w.rng.chance(0.6) ? w.rng.pick(E) : { x: w.rng.range(40, WORLD_W - 40), y: w.rng.range(40, WORLD_H - 120) };
        const a = w.rng.angle(), L = 420;
        const cut = { x0: tgt.x - Math.cos(a) * L, y0: tgt.y - Math.sin(a) * L, x1: tgt.x + Math.cos(a) * L, y1: tgt.y + Math.sin(a) * L, t: 0 };
        p.ps.cuts.push(cut);
        w.damageLine(cut.x0, cut.y0, cut.x1, cut.y1, 14, 9);
        w.explosions.sparks(tgt.x, tgt.y, 8, [1.0, 0.45, 0.1], 5, 16, 4);
        w.explosions.sparks(tgt.x, tgt.y, 6, VIOLET, 6, 14, 5);
        w.r.post.shockwave(tgt.x, tgt.y, 0.012, 0.025, 0.25);
        w.g.camera.addTrauma(0.08);
      }
      for (const c of p.ps.cuts) c.t++;
      p.ps.cuts = p.ps.cuts.filter((c) => c.t < 12);
    },
    end(p) { p.ps.cuts = []; },
  },
  ultimate: {
    name: 'SHADOW CLONES',
    duration: 360,
    activate(p) {
      p.ps.clones = CLONE_OFFSETS.map(([dx, dy]) => ({ dx, dy, x: p.x, y: p.y, px: p.x, py: p.y }));
    },
    update(p, w) {
      for (const c of p.ps.clones) {
        c.px = c.x; c.py = c.y;
        c.x += (Math.min(WORLD_W - 12, Math.max(12, p.x + c.dx)) - c.x) * 0.25;
        c.y += (Math.min(WORLD_H - 18, Math.max(22, p.y + c.dy)) - c.y) * 0.25;
        w.cancelCircle(c.x, c.y, 14);
        w.damageCircle(c.x, c.y, 14, 0.5);
      }
    },
    end(p, w) {
      for (const c of p.ps.clones) w.explosions.sparks(c.x, c.y, 12, VIOLET, 4, 20, 4);
      p.ps.clones = null;
    },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_tess_${t}`, 50, 46, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('t_blade', 18, 18, drawBlade, { scale: 3 });
    tessArt.buildSprites(atlas);
    buildFxSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => tessArt.renderMecha(p, b, x, y, a),
  exhaust: tessArt.exhaust,
  renderShots,
  hitSpark: tessMechaFx.hitSpark,

  init(p, w) {
    p.ps.fBlade = w.r.frame('t_blade');
    p.ps.slashes = [];
    p.ps.flip = 1;
    p.ps.mid = 1;
    p.ps.cloak = 0;
  },

  reset(p, w) {
    w.decoy = null;
    p.ps.cloak = 0;
    p.alpha = 1;
  },

  update(p) {
    tessArt.animate(p);
    // The swinging arm of a Ghost Slash kicks out, then settles.
    p.ps.kickL = (p.ps.kickL || 0) * 0.78;
    p.ps.kickR = (p.ps.kickR || 0) * 0.78;
    for (const s of p.ps.slashes) s.t++;
    if (p.ps.slashes.length) p.ps.slashes = p.ps.slashes.filter((s) => s.t < 10);
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    p.fireCd = p.focus ? 8 : 6;
    p.ps.mid = -p.ps.mid;
    volley(p, w, p.x, p.y, 1, true);
    if (p.ps.clones) for (const c of p.ps.clones) volley(p, w, c.x, c.y, 0.6, false);
  },

  renderBelow(p, b, x, y, alpha) {
    const F = p.F;
    // Cloak decoy: a flickering full copy of the mecha.
    if (p.ps.cloak && p.w.decoy) {
      const d = p.w.decoy, fl = (p.t >> 1) % 5 === 0 ? 0.25 : 0.6;
      const dx = d.x + Math.sin(p.t * 0.7) * 1.5;
      if (!renderCopy(p, b, dx, d.y, fl, 0.7)) {
        const f = p.frames[p.tier - 1];
        b.draw(f, dx, d.y, f.w, f.h, 0, VIOLET[0], VIOLET[1], VIOLET[2], fl, 1);
      }
      b.draw(F.ring, d.x, d.y, 70, 70, p.t * 0.05, PAL.mid[0], PAL.mid[1], PAL.mid[2], 0.3, 1);
    }
    // Shadow clones: full copies of the mecha (same pose, wings, thrusters and blades).
    if (p.ps.clones) {
      for (const c of p.ps.clones) {
        const cx = c.px + (c.x - c.px) * alpha, cy = c.py + (c.y - c.py) * alpha;
        b.draw(F.glow, cx, cy, 90, 90, 0, PAL.mid[0] * 0.5, PAL.mid[1] * 0.5, PAL.mid[2] * 0.5, 0.35, 1);
        if (renderCopy(p, b, cx, cy, 0.85)) continue;
        const f = p.frames[p.tier - 1];
        b.draw(f, cx, cy, f.w, f.h, 0, 0.15, 0.1, 0.25, 0.85, 0);
        b.draw(f, cx, cy, f.w, f.h, 0, VIOLET[0], VIOLET[1], VIOLET[2], 0.5, 1);
      }
    }
  },

  renderFx(p, b) {
    for (const s of p.ps.slashes) renderSlash(p, b, s);
    if (p.ps.cuts) for (const c of p.ps.cuts) renderCut(p, b, c);
  },
};