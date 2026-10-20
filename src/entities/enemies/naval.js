import * as P from '../../patterns/index.js';
import { WORLD_H } from '../../core/constants.js';
import { PALS, hull, shipHull, circ, armour, both, keyLight, glowDot, turret, weather, rivetRow } from '../../bosses/roster/art.js';
import { FADE_OUT, FADE_INOUT } from '../../fx/Particles.js';

// Surface warships for sea levels (level rework). They sit ON the water:
// they ride the sea's scroll like ground units, sail toward the player at
// their own speed, and leave bow spray and a foam wake on the surface.
// Art is drawn into its own small texture on first use (the main atlas is
// full), through the same lazy path as the roster bosses (`pack`).

const DOWN = Math.PI / 2;

const S = {
  bowGun: { shape: 'orb', color: 'orange', n: 1, speed: 3.0, layers: 3, dSpeed: 0.4, fixed: true },
  rhib: { shape: 'rice', color: 'yellow', n: 2, spread: 0.3, speed: 3.2 },
  missile: { shape: 'kunai', color: 'red', n: 1, speed: 1.4, accel: 0.03, maxSpd: 3.6, homing: 0.025, homingTime: 70, fixed: true },
  corvFan: { shape: 'rice', color: 'orange', n: 9, spread: 1.1, speed: 2.4 },
  corvRing: { shape: 'orb', color: 'red', n: 14, speed: 1.7 },
  corvAA: { shape: 'rice', color: 'yellow', n: 3, spread: 0.24, speed: 3.4 },
  mineBurst: { shape: 'orb', color: 'orange', n: 10, speed: 2.0 },
};

// ------------------------------------------------------------------ art

function gunboatArt(ctx) {
  const pal = PALS.navy, meta = { lights: [], hw: 12, hl: 31 };
  const { path } = shipHull(ctx, pal, 62, 24, 'n_gunboat');
  weather(ctx, path, 0.3);
  ctx.beginPath(); ctx.rect(-7, -10, 14, 16); armour(ctx, pal, -7, 7, 1);
  for (let k = -1; k <= 1; k++) { ctx.fillStyle = 'rgba(30,50,70,0.95)'; ctx.fillRect(k * 4 - 1.4, 3, 2.8, 2); }
  turret(ctx, pal, 0, 14, 4.5, 1, 11, 2);
  ctx.fillStyle = '#1a2026'; ctx.fillRect(-2, -24, 4, 6);
  keyLight(ctx, -12, -31, 12, 31);
  return meta;
}

function missileBoatArt(ctx) {
  const pal = PALS.coastal, meta = { lights: [], hw: 15, hl: 41 };
  const { path } = shipHull(ctx, pal, 82, 30, 'n_missileboat');
  weather(ctx, path, 0.35);
  // Twin canister launchers per beam, angled outboard.
  both((s) => { for (const y of [-18, -4]) { ctx.save(); ctx.translate(s * 8, y); ctx.rotate(s * 0.25); ctx.beginPath(); ctx.rect(-4, -6, 8, 12); armour(ctx, pal, -4, 4); ctx.fillStyle = '#0e1414'; ctx.fillRect(-2.5, 4, 5, 2); ctx.restore(); } });
  ctx.beginPath(); ctx.rect(-8, 6, 16, 14); armour(ctx, pal, -8, 8, 1);
  for (let k = -1; k <= 1; k++) { ctx.fillStyle = 'rgba(30,50,60,0.95)'; ctx.fillRect(k * 4.5 - 1.6, 17, 3.2, 2); }
  circ(ctx, 0, 2, 3.5); armour(ctx, pal, -3.5, 3.5);
  turret(ctx, pal, 0, 28, 4, 1, 9, 2);
  keyLight(ctx, -15, -41, 15, 41);
  return meta;
}

function rhibArt(ctx) {
  const meta = { lights: [], hw: 8, hl: 20 };
  // Inflatable tubes around a dark hull, outboard motor at the stern.
  ctx.beginPath(); ctx.roundRect(-8, -19, 16, 38, [7, 7, 8, 8]);
  const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, '#1c1c1a'); g.addColorStop(0.5, '#4a4a44'); g.addColorStop(1, '#141412');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.roundRect(-5, -15, 10, 31, 5); ctx.fillStyle = '#2c3034'; ctx.fill();
  ctx.fillStyle = '#5a5e60'; ctx.fillRect(-3.5, -4, 7, 6);
  ctx.fillStyle = '#0c0c0c'; ctx.fillRect(-2, -22, 4, 4);
  ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-1, 9, 2, 6); // gunner on the bow mount
  keyLight(ctx, -8, -19, 8, 19);
  return meta;
}

function corvetteArt(ctx) {
  const pal = PALS.navy, meta = { lights: [], hw: 24, hl: 66, funnels: [] };
  const { path, lights } = shipHull(ctx, pal, 132, 48, 'n_corvette');
  meta.lights.push(...lights);
  weather(ctx, path, 0.35);
  // Superstructure block, mast and funnel.
  ctx.beginPath(); ctx.rect(-14, -14, 28, 36); armour(ctx, pal, -14, 14, 2);
  ctx.beginPath(); ctx.rect(-9, 2, 18, 16); armour(ctx, pal, -9, 9);
  for (let k = -2; k <= 2; k++) { ctx.fillStyle = 'rgba(30,50,70,0.95)'; ctx.fillRect(k * 3.4 - 1.2, 15, 2.4, 2); }
  ctx.beginPath(); ctx.ellipse(0, -24, 7, 9, 0, 0, Math.PI * 2); armour(ctx, pal, -7, 7);
  ctx.beginPath(); ctx.ellipse(0, -25, 4.5, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#0c1014'; ctx.fill();
  meta.funnels.push([0, -25]);
  // Main gun forward, CIWS aft, launchers amidships.
  turret(ctx, pal, 0, 40, 8, 1, 18, 3);
  turret(ctx, pal, 0, -46, 5, 2, 9, 2);
  both((s) => { ctx.beginPath(); ctx.rect(s * 17 - 5, -36, 10, 18); armour(ctx, pal, s * 17 - 5, s * 17 + 5); ctx.fillStyle = '#10161a'; ctx.fillRect(s * 17 - 3, -34, 6, 14); });
  rivetRow(ctx, pal, -20, 56, 20, 56, 4);
  ctx.fillStyle = '#ffd040'; ctx.fillRect(-10, -62, 20, 2); // helideck edge marking
  keyLight(ctx, -24, -66, 24, 66);
  both((s) => glowDot(ctx, s * 22, 10, 1.6, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'));
  return meta;
}

function mineArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = w * 0.32;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45); ctx.stroke();
    ctx.fillStyle = '#6a6458'; circ(ctx, cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45, 1.6); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r);
  g.addColorStop(0, '#8a8478'); g.addColorStop(0.5, '#3e3a34'); g.addColorStop(1, '#141210');
  circ(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(160,60,30,0.55)'; ctx.fillRect(cx - r, cy - 1, r * 2, 2); // rust band
}

export const NAVAL_PACK = {
  id: 'pack:naval',
  art(add) {
    add('n_gunboat', 28, 66, hull('n_gunboat', gunboatArt));
    add('n_missileboat', 34, 86, hull('n_missileboat', missileBoatArt));
    add('n_rhib', 18, 42, hull('n_rhib', rhibArt));
    add('n_corvette', 52, 136, hull('n_corvette', corvetteArt));
    add('n_mine', 26, 26, mineArt);
  },
};

// ------------------------------------------------------- surface effects

/** Bow spray + foam wake on the water (cosmetic; own RNG). */
function wake(e, w, hw, hl, every = 4) {
  if (e.t % every || e.y < -hl || e.y > WORLD_H + hl) return;
  const R = w.fxRng, L = w.fxLow, F = w.F;
  const s = e.scale || 1;
  for (const [ox, oy, big] of [[R.sign() * hw * 0.9, hl * 0.7, 0], [R.range(-hw, hw) * 0.4, -hl, 1]]) {
    const i = L.spawn(F.glow, e.x + ox * s, e.y + oy * s, R.range(-0.25, 0.25), -0.3, big ? 60 : 34);
    if (i >= 0) { L.size(i, big ? 6 : 4, big ? hw * 1.4 : 10); L.color(i, 0.85, 0.95, 1, 0.55, 0.7, 0.8); L.look(i, big ? 0.3 : 0.4, 1, FADE_OUT); }
  }
  const fx = w.arena && w.arena.fx;
  if (fx && e.t % (every * 3) === 0) fx.trail(e.x, e.y - hl * s, hw * 1.5 * s, e.rot);
}

function funnelSmoke(e, w, ox, oy) {
  if (e.t % 9) return;
  const R = w.fxRng, L = w.fxLow;
  const i = L.spawn(w.r.frame('smoke'), e.x + ox, e.y + oy, R.range(-0.2, 0.2), -1, 46);
  if (i >= 0) { L.size(i, 5, 16); L.color(i, 0.2, 0.2, 0.22, 0.08, 0.08, 0.09); L.phys(i, 0.98, -0.01); L.look(i, 0.5, 0, FADE_INOUT); }
}

// --------------------------------------------------------------- roster

export const NAVAL_ENEMIES = {
  gunboat: {
    name: 'Patrol Gunboat', sprite: 'n_gunboat', pack: NAVAL_PACK, surface: true, ground: true, r: 13, hp: 26, score: 600,
    move: 'ground', mp: { vy: 0.35, amp: 18, freq: 0.012 },
    drops: [['P', 0.3], ['M', 0.5]],
    update: (e, w) => wake(e, w, 12, 31),
    fire: [
      { start: 40, every: 70, fn: (e, w) => P.stack(w, e.x, e.y + 26, w.aimAngle(e.x, e.y), S.bowGun) },
    ],
  },
  missileboat: {
    name: 'Missile Boat', sprite: 'n_missileboat', pack: NAVAL_PACK, surface: true, ground: true, r: 16, hp: 46, score: 1100,
    move: 'ground', mp: { vy: 0.1 },
    drops: [['P', 0.5], ['M', 0.8]],
    update: (e, w) => wake(e, w, 15, 41),
    fire: [
      { start: 50, every: 120, fn: (e, w) => { for (const s of [-1, 1]) P.shoot(w, e.x + s * 10, e.y - 10, DOWN + s * 1.1, S.missile.speed, S.missile); } },
      { start: 110, every: 120, elite: true, fn: (e, w) => { for (const s of [-1, 1]) P.shoot(w, e.x + s * 10, e.y + 6, DOWN + s * 0.6, S.missile.speed, S.missile); } },
    ],
  },
  rhib: {
    name: 'Fast Attack Craft', sprite: 'n_rhib', pack: NAVAL_PACK, surface: true, ground: true, r: 9, hp: 7, score: 250, blast: 0.5,
    move: 'ground', mp: { vy: 1.5, amp: 50, freq: 0.03 },
    drops: [['M', 0.3]],
    update: (e, w) => { e.rot = Math.cos(e.t * (e.p.freq ?? 0.03)) * -0.35 * Math.sign(e.p.amp || 1); wake(e, w, 8, 20, 3); },
    fire: [{ start: 30, every: 60, fn: (e, w) => P.aimed(w, e.x, e.y + 14, S.rhib) }],
  },
  corvette: {
    name: 'Corvette', sprite: 'n_corvette', pack: NAVAL_PACK, surface: true, ground: true, r: 30, hp: 230, score: 5000, big: true,
    move: 'ground', mp: { vy: -0.9 },
    drops: [['P', 1], ['P', 1], ['M', 1], ['M', 1], ['B', 0.2]],
    update: (e, w) => { wake(e, w, 24, 66, 3); funnelSmoke(e, w, 0, -25); },
    fire: [
      { start: 60, every: 80, fn: (e, w) => P.aimed(w, e.x, e.y + 60, S.corvFan) },
      { start: 100, every: 150, fn: (e, w) => P.ring(w, e.x, e.y, S.corvRing, w.aimAngle(e.x, e.y)) },
      { start: 40, every: 24, elite: true, fn: (e, w) => P.aimed(w, e.x, e.y - 46, S.corvAA) },
    ],
  },
  seamine: {
    name: 'Sea Mine', sprite: 'n_mine', pack: NAVAL_PACK, surface: true, ground: true, r: 10, hp: 10, score: 200,
    move: 'ground', mp: { vy: 0, amp: 10, freq: 0.02 },
    drops: [['M', 0.25]],
    update: (e, w) => {
      e.rot = Math.sin(e.t * 0.05) * 0.3;
      // Proximity fuse: bursts when the player comes close.
      const p = w.player;
      if (p && !e.data.armed && e.y > 40 && Math.hypot(p.x - e.x, p.y - e.y) < 70) { e.data.armed = true; e.hp = 0; e.alive = false; P.ring(w, e.x, e.y, S.mineBurst, w.rng.angle()); w.explosions.blast(e.x, e.y, 0.7, [1, 0.6, 0.2]); }
    },
    onDeath: (e, w) => { if (!e.data.armed) P.ring(w, e.x, e.y, S.mineBurst, w.rng.angle()); },
    fire: [],
  },
};
