import { mirrorPath, chrome, outline, glowDot, neonLines, neonStroke, vgrad } from '../fx/art.js';
import { BULLET_COLORS } from '../fx/sprites.js';
import { keyLight, rivetRow, hazard } from '../fx/greeble.js';
import { FACTIONS } from '../data/factions/index.js';
import {
  hull, crawler, carrier, leviathan, leviathanSub, titan, hive, hiveVeins, maw,
  tentacleSprite, decalDent, decalMachinery, decalWound, decalCrack, fanRotor, glyphRing,
} from './hulls.js';

// Procedural art for the six archetype bosses, their breakable parts and a
// few boss-only effect sprites. Same conventions as enemy art: drawn in
// world units, facing DOWN (toward the player).
//
// M4d retrofit: the boss bodies live in hulls.js (faction palettes, greeble
// detail, screen-dominating scale). Sprite names are unchanged.

const TAU = Math.PI * 2;
const G = Object.fromEntries(Object.entries(FACTIONS).map(([k, f]) => [k, f.greeble]));
const rust = (ctx, x0, x1) => chrome(ctx, x0, x1, ...G.ironclad.plate);
const steel = (ctx, x0, x1) => chrome(ctx, x0, x1, ...G.stratos.plate);
const navy = (ctx, x0, x1) => chrome(ctx, x0, x1, ...G.blacktide.plate);
const ivory = (ctx, x0, x1) => chrome(ctx, x0, x1, '#1c2029', '#8a92a2', '#d6dae4');

const ORANGE = 'rgba(255,140,40,1)';
const CYAN = 'rgba(90,230,255,1)';
const RED = 'rgba(255,40,70,1)';
const MAGENTA = 'rgba(255,42,154,1)';
const ACID = 'rgba(120,255,110,1)';
const VIOLET = 'rgba(190,90,255,1)';

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

// ================================================================= PARTS

function mortar(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 5);
  ctx.fillStyle = rust(ctx, 0, w); ctx.fill(); outline(ctx);
  hazard(ctx, G.ironclad, 4, 3, w - 8, 3, 1.6);
  for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 7], [6, 7]]) {
    circle(ctx, cx + ox, cy + oy, 4.6); ctx.fillStyle = '#0a0604'; ctx.fill(); outline(ctx, 0.5);
  }
  rivetRow(ctx, G.ironclad, 4, h - 4, w - 4, h - 4, 3.2, 0.45);
  keyLight(ctx, 0, 0, w, h);
  for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 7], [6, 7]]) glowDot(ctx, cx + ox, cy + oy, 2.4, ORANGE);
}

function wingPod(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 8, 6, 11, 22, 8, h - 6, 3, h - 2, 0, h - 1]);
  ctx.fillStyle = steel(ctx, cx - 11, cx + 11); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#c8d4e4'; ctx.fillRect(cx - 9, 8, 18, 2);
  for (const s of [-1, 1]) { ctx.fillStyle = '#05080e'; ctx.fillRect(cx + s * 5 - 1.5, h - 10, 3, 9); }
  keyLight(ctx, 0, 0, w, h);
  glowDot(ctx, cx, 15, 4, CYAN);
  neonLines(ctx, cx, [9, 8, 10, 22], CYAN, 0.6, 4);
}

function interceptor(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 3, 6, 10, 10, 10, 14, 3, 16, 2, 21, 0, 22]);
  ctx.fillStyle = steel(ctx, 0, w); ctx.fill(); outline(ctx, 0.6);
  glowDot(ctx, cx, 4, 2.5, CYAN);
  glowDot(ctx, cx, 17, 2, RED);
}

function torpedo(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 0, 2.5, 3, 3, h - 4, 1.5, h, 0, h]);
  ctx.fillStyle = navy(ctx, cx - 3, cx + 3); ctx.fill(); outline(ctx, 0.4);
  glowDot(ctx, cx, 2, 2.5, 'rgba(255,90,60,1)');
}

function shoulderCannon(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.roundRect(4, 2, w - 8, h - 10, 4);
  ctx.fillStyle = ivory(ctx, 4, w - 4); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#ff2a9a'; ctx.fillRect(6, 6, w - 12, 1.6);
  for (const s of [-1, 1]) { ctx.fillStyle = '#20222c'; ctx.fillRect(cx + s * 5 - 2, h - 12, 4, 11); outline(ctx, 0.4); }
  keyLight(ctx, 0, 0, w, h);
  glowDot(ctx, cx, 11, 4, MAGENTA);
}

function crystalNode(ctx, w, h) {
  const cx = w / 2;
  poly(ctx, [cx, 1, cx + 10, 14, cx + 6, h - 2, cx - 6, h - 2, cx - 10, 14]);
  const g = vgrad(ctx, 0, h, 'rgba(230,200,255,0.95)', 'rgba(110,40,200,0.95)');
  ctx.fillStyle = g; ctx.fill(); neonStroke(ctx, VIOLET, 0.8, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, h - 3); ctx.moveTo(cx - 9, 14); ctx.lineTo(cx + 9, 14); ctx.stroke();
  glowDot(ctx, cx, h * 0.55, 5, ACID);
}

function alienCore(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 2, 6 + i, (i / 3) * Math.PI, 0, TAU);
    ctx.strokeStyle = 'rgba(140,255,120,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  glowDot(ctx, cx, cy, w * 0.36, ACID);
  circle(ctx, cx, cy, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
}

function eye(open) {
  return (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
    ctx.fillStyle = '#2a0a20'; ctx.fill(); outline(ctx);
    if (!open) {
      ctx.strokeStyle = 'rgba(160,70,140,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(4, cy); ctx.quadraticCurveTo(cx, cy + 5, w - 4, cy); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 3, h / 2 - 3, 0, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, w / 2);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.35, '#ffb020'); g.addColorStop(0.8, '#a01010'); g.addColorStop(1, '#300008');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#050000'; ctx.beginPath(); ctx.ellipse(cx, cy, 2.2, h / 2 - 5, 0, 0, TAU); ctx.fill();
    // Veins.
    ctx.strokeStyle = 'rgba(200,20,30,0.7)'; ctx.lineWidth = 0.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * (w / 2 - 3), cy - 2); ctx.lineTo(cx + s * 8, cy + 1); ctx.stroke(); }
  };
}

// ============================================================ BOSS FX

/** Black veil with a soft transparent hole (vision radius). */
function darkHole(ctx, w, h) {
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.92)'); g.addColorStop(0.8, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Faded copies of the violet orb (ghost bullets fade in and out). */
function ghostOrb(alpha, big) {
  const col = BULLET_COLORS.violet;
  return (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, R = w / 2 - 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0a0612'; circle(ctx, cx, cy, R); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f0e6ff');
    g.addColorStop(1, `rgba(${col.map((c) => Math.round(c * 255)).join(',')},1)`);
    ctx.fillStyle = g; circle(ctx, cx, cy, R * 0.8); ctx.fill();
    if (big) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.6; circle(ctx, cx, cy, R * 0.55); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
}

function tendril(ctx, w, h) {
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(70,20,80,1)'); g.addColorStop(0.5, 'rgba(150,60,170,1)');
  g.addColorStop(0.7, 'rgba(70,20,80,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(230,200,190,0.8)';
  for (let x = 3; x < w; x += 7) { poly(ctx, [x, cy - 3, x + 3, cy - 7, x + 2, cy - 2]); ctx.fill(); poly(ctx, [x + 3, cy + 3, x + 6, cy + 7, x + 5, cy + 2]); ctx.fill(); }
}

export const GHOST_LEVELS = 4;

export function buildBossSprites(atlas) {
  const add = (name, w, h, fn, scale = 1.3) => atlas.add(name, w, h, fn, { scale });
  // Hull resolution: 1.5 texels/unit on a 4096 atlas, reduced on 2048.
  const HS = atlas.size >= 4096 ? 1.5 : 0.8;
  const body = (name, w, h, fn) => add(name, w, h, hull(name, fn), HS);
  body('b_crawler', 300, 236, crawler);
  body('b_carrier', 344, 212, carrier);
  body('b_leviathan', 236, 284, leviathan);
  body('b_leviathan_sub', 236, 284, leviathanSub);
  body('b_titan_a', 304, 236, titan(0));
  body('b_titan_b', 304, 236, titan(1));
  body('b_titan_c', 304, 236, titan(2));
  body('b_hive', 300, 312, hive);
  body('b_maw', 344, 336, maw(false));
  body('b_maw_open', 344, 336, maw(true));
  add('bx_hive_veins', 300, 312, hull('bx_hive_veins', hiveVeins), HS * 0.6);
  add('bx_tentacle', 96, 18, tentacleSprite, 2);
  add('bx_fan', 38, 38, fanRotor, 2);
  add('bx_glyphring', 128, 128, glyphRing, 1.5);
  add('bd_dent', 40, 34, decalDent, 1.6);
  add('bd_machinery', 34, 30, decalMachinery, 2);
  add('bd_wound', 40, 24, decalWound, 1.6);
  add('bd_crack', 40, 40, decalCrack, 1.4);

  add('bp_mortar', 30, 30, mortar, 2.5);
  add('bp_wingpod', 22, 40, wingPod, 2.5);
  add('b_interceptor', 20, 22, interceptor, 3);
  add('b_torpedo', 7, 22, torpedo, 3);
  add('bp_shoulder', 26, 30, shoulderCannon, 2.5);
  add('bp_crystal', 22, 36, crystalNode, 2.5);
  add('bp_alien_core', 30, 30, alienCore, 2.5);
  add('bp_eye', 30, 22, eye(true), 2.5);
  add('bp_eye_shut', 30, 22, eye(false), 2.5);
  add('fx_darkhole', 128, 128, darkHole, 1);
  add('fx_tendril', 28, 16, tendril, 2);
  const A = [0.62, 0.34, 0.15, 0.04];
  for (let k = 0; k < GHOST_LEVELS; k++) {
    add(`ghost_orb_${k}`, 12, 12, ghostOrb(A[k], false), 3);
    add(`ghost_big_${k}`, 26, 26, ghostOrb(A[k], true), 2.5);
  }
}
