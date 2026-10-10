// Faction bullet language (UPDATE_02 §4.5, M7c). Regular enemies fire their
// syndicate's bullet shape:
//
//   Ironclad   slug     elongated capsule pointing along its path
//   Stratos    needle   thin streak
//   Black Tide torpedo  capsule with fins and a bubble trail
//   Helix      bolt     jagged lightning dart
//   Outer Star shard    faceted crystal
//   Drowned    void     dark orb with a coloured rim
//
// Only the SHAPE changes: every bullet keeps its danger colour (the pattern's
// colour code), dark outline and white-hot core, and its hitbox radius stays
// the one the pattern authored. Small shapes (orb / rice / kunai) are skinned;
// big orbs and boss fire are untouched. Skins need atlas room, so a 2048
// atlas (small GPUs) keeps the base shapes.

import { BULLET_COLORS, COLOR_NAMES } from './sprites.js';

export const FACTION_BULLET = {
  ironclad: 'slug', stratos: 'needle', blacktide: 'torpedo',
  helix: 'bolt', outerstar: 'shard', drowned: 'void',
};
/** Pattern shapes that faction skins replace. */
export const SKINNED_SHAPES = new Set(['orb', 'rice', 'kunai']);

const OUTLINE = 'rgba(6,2,14,0.95)';
const css = (c, a = 1, mul = 1) =>
  `rgba(${Math.min(255, c[0] * 255 * mul) | 0},${Math.min(255, c[1] * 255 * mul) | 0},${Math.min(255, c[2] * 255 * mul) | 0},${a})`;

function fillPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function capsule(ctx, x0, y0, x1, y1) {
  const r = (y1 - y0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x0 + r, y1);
  ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
}

/** Hot gradient along +x: colour at the tail, white at the nose. */
function hot(ctx, w, col) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, css(col, 1, 0.85));
  g.addColorStop(0.55, css(col, 1, 1.3));
  g.addColorStop(1, '#ffffff');
  return g;
}

const DRAW = {
  // 16×8 capsule, blunt back, white-hot nose.
  slug(ctx, w, h, col) {
    ctx.fillStyle = OUTLINE; capsule(ctx, 0.3, 0.3, w - 0.3, h - 0.3);
    ctx.fillStyle = hot(ctx, w, col); capsule(ctx, 1.4, 1.4, w - 1.2, h - 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; capsule(ctx, w * 0.55, h * 0.36, w - 1.8, h * 0.64);
  },
  // 22×5 thin streak.
  needle(ctx, w, h, col) {
    const cy = h / 2;
    ctx.fillStyle = OUTLINE; fillPath(ctx, [[w, cy], [w * 0.15, 0.2], [0, cy], [w * 0.15, h - 0.2]]);
    ctx.fillStyle = hot(ctx, w, col); fillPath(ctx, [[w - 0.8, cy], [w * 0.2, 1.1], [1.2, cy], [w * 0.2, h - 1.1]]);
    ctx.fillStyle = '#ffffff'; fillPath(ctx, [[w - 1.2, cy], [w * 0.5, cy - 0.55], [w * 0.35, cy], [w * 0.5, cy + 0.55]]);
  },
  // 18×9 capsule with fins; bubble dots trailing behind.
  torpedo(ctx, w, h, col) {
    const bx = w * 0.3; // body starts after the bubble trail
    ctx.fillStyle = 'rgba(200,240,255,0.55)';
    for (const [x, y, r] of [[1.2, h * 0.35, 0.9], [3.4, h * 0.65, 1.1], [5.2, h * 0.4, 0.8]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = OUTLINE;
    fillPath(ctx, [[bx + 0.2, 0.2], [bx + 3.2, h * 0.3], [bx + 3.2, h * 0.7], [bx + 0.2, h - 0.2]]); // fins
    capsule(ctx, bx + 1, h * 0.18, w - 0.3, h * 0.82);
    ctx.fillStyle = hot(ctx, w, col); capsule(ctx, bx + 2, h * 0.3, w - 1.2, h * 0.7);
  },
  // 18×9 jagged lightning dart.
  bolt(ctx, w, h, col) {
    const pts = (k) => [[w - k, h / 2], [w * 0.62, k + 0.4], [w * 0.55, h * 0.42], [w * 0.28, k], [k, h * 0.55], [w * 0.4, h - k - 0.4], [w * 0.47, h * 0.6], [w * 0.7, h - k]];
    ctx.fillStyle = OUTLINE; fillPath(ctx, pts(0.2));
    ctx.fillStyle = hot(ctx, w, col); fillPath(ctx, pts(1.3));
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(w * 0.25, h * 0.5); ctx.lineTo(w * 0.55, h * 0.45); ctx.lineTo(w * 0.5, h * 0.58); ctx.lineTo(w - 1.6, h / 2); ctx.stroke();
  },
  // 14×10 faceted diamond.
  shard(ctx, w, h, col) {
    const c = [w * 0.42, h / 2];
    ctx.fillStyle = OUTLINE; fillPath(ctx, [[w - 0.2, h / 2], [w * 0.45, 0.2], [0.2, h / 2], [w * 0.45, h - 0.2]]);
    const tri = (a, b, fill) => { ctx.fillStyle = fill; fillPath(ctx, [c, a, b]); };
    const N = [w - 1.4, h / 2], T = [w * 0.45, 1.4], L = [1.4, h / 2], B = [w * 0.45, h - 1.4];
    tri(N, T, '#ffffff'); tri(T, L, css(col, 1, 1.3)); tri(L, B, css(col, 1, 0.8)); tri(B, N, css(col, 1, 1.05));
  },
  // 12×12 dark orb, coloured rim (the Covenant's void orbs).
  void(ctx, w, h, col) {
    const cx = w / 2, cy = h / 2, R = w / 2 - 0.4;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 0.85);
    g.addColorStop(0, 'rgba(10,0,12,1)');
    g.addColorStop(0.55, 'rgba(20,0,16,1)');
    g.addColorStop(0.8, css(col, 1, 1.25));
    g.addColorStop(1, css(col, 1, 0.8));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx + R * 0.3, cy - R * 0.3, R * 0.14, 0, Math.PI * 2); ctx.fill();
  },
};

const SIZE = { slug: [16, 8], needle: [22, 5], torpedo: [18, 9], bolt: [18, 9], shard: [14, 10], void: [12, 12] };

/**
 * Atlas builder: one sprite per faction shape × danger colour. Publishes
 * `atlas.factionBullets[factionId][colour] = frame id` (null on a 2048 atlas).
 */
export function buildFactionBullets(atlas) {
  atlas.factionBullets = null;
  if (atlas.size < 4096) return;
  const out = {};
  for (const [fid, shape] of Object.entries(FACTION_BULLET)) {
    out[fid] = {};
    const [w, h] = SIZE[shape];
    for (const name of COLOR_NAMES) {
      const col = BULLET_COLORS[name];
      out[fid][name] = atlas.add(`fb_${shape}_${name}`, w, h, (c, ww, hh) => DRAW[shape](c, ww, hh, col), { scale: 3 }).id;
    }
  }
  atlas.factionBullets = out;
}
