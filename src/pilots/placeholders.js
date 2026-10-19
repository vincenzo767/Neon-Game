import { mirrorPath, chrome, neonLines, outline, canopy, glowDot, drawBolt } from '../fx/art.js';
import { UP, muzzle, ringPulse, targets, shipScale } from './common.js';

// Placeholder pilots, roster slots 19-27 (the select grid's third row).
// Each one is playable with a simple shared kit and a procedural placeholder
// mecha (hull shape and shot pattern vary per slot), so the slot can be
// tested until its real pilot concept arrives. To fill a slot: give it its
// own src/pilots/<id>.js and swap it into PILOTS in index.js.
//
// `portrait: null` draws the silhouette with a "?" (ui/portraits.js).

const SLOTS = [
  { n: 19, css: '#ff6a6a', hull: 'dart', shot: 'spread' },
  { n: 20, css: '#6affc0', hull: 'delta', shot: 'twin' },
  { n: 21, css: '#6aa8ff', hull: 'boom', shot: 'needle' },
  { n: 22, css: '#ffa04a', hull: 'delta', shot: 'spread' },
  { n: 23, css: '#d07aff', hull: 'boom', shot: 'twin' },
  { n: 24, css: '#f0f06a', hull: 'dart', shot: 'needle' },
  { n: 25, css: '#4ae0ff', hull: 'boom', shot: 'spread' },
  { n: 26, css: '#ff6ad0', hull: 'dart', shot: 'twin' },
  { n: 27, css: '#a0ff5a', hull: 'delta', shot: 'needle' },
];

const SHOT_TEXT = {
  spread: ['Fan Shot — a spread that widens with tier', 'Focus Fan — the spread closes to a tight stream'],
  twin: ['Twin Lines — parallel bolts, more lines with tier', 'Focus Lines — the lines close together'],
  needle: ['Needles — fast piercing bolts straight ahead', 'Focus Needle — one fast, heavy piercing stream'],
};

const HULLS = {
  // Half-outlines for mirrorPath (x, y pairs from the nose down), 36x50 box.
  dart: [0, 0, 4, 10, 6, 24, 14, 36, 14, 44, 6, 42, 4, 48, 0, 48],
  delta: [0, 2, 5, 14, 17, 38, 17, 44, 8, 42, 5, 48, 0, 47],
  boom: [0, 4, 4, 14, 6, 26, 10, 26, 10, 8, 14, 10, 15, 44, 9, 46, 5, 40, 3, 48, 0, 48],
};

const hexRgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
const rgba = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

function drawShip(ctx, w, h, tier, hull, col) {
  const cx = w / 2;
  mirrorPath(ctx, cx, HULLS[hull]);
  ctx.fillStyle = chrome(ctx, cx - 10, cx + 10, '#101218', '#4a5262', '#c8d0dc'); ctx.fill(); outline(ctx);
  // Slot-colour stripe down the spine and tier lights on the wings.
  ctx.fillStyle = rgba(col, 0.9); ctx.fillRect(cx - 1.2, 14, 2.4, 26);
  for (let k = 0; k < tier; k++) for (const s of [-1, 1]) glowDot(ctx, cx + s * (7 + k * 2), 34 + k * 1.5, 1, rgba(col, 1));
  if (tier >= 4) neonLines(ctx, cx, HULLS[hull].slice(2, 10), rgba(col, 1), 0.8, 6);
  canopy(ctx, cx, 18, 2.4, 4.2, '#ffffff', rgba(col, 1), '#0a0c14');
}

function makePilot({ n, css, hull, shot }) {
  const id = `p${n}`;
  const col = hexRgb(css);
  return {
    id,
    placeholder: true,
    name: `PILOT ${n}`,
    vehicle: `PROTOTYPE-${n}`,
    role: 'Placeholder',
    bio: `Open roster slot ${n}. Pilot, mecha and abilities are placeholders until the concept arrives.`,
    color: col,
    css,
    stats: { speed: 3, power: 3, range: 3, bomb: 3 },
    speed: { normal: 4.8, focus: 2.1 },
    hitbox: 2.2,
    bombStock: 3,
    engines: hull === 'boom' ? [[-12, 44], [12, 44]] : [[0, 46]],
    engineColor: col,
    portrait: null,
    weapons: { main: SHOT_TEXT[shot][0], focus: SHOT_TEXT[shot][1] },
    special: {
      name: 'PULSE',
      desc: 'Clears enemy bullets around the mecha and damages anything caught in the ring',
      cooldown: 8,
      duration: 0,
      activate(p, w) {
        w.cancelCircle(p.x, p.y, 110);
        w.damageCircle(p.x, p.y, 110, 6);
        ringPulse(w, p.x, p.y, col, 16, 110, 16);
      },
    },
    bomb: {
      name: 'SHOCKWAVE',
      duration: 90,
      activate(p, w) { w.g.camera.addTrauma(0.5); },
      update(p, w, t) {
        w.cancelAll();
        if (t % 15 === 0) {
          for (const e of targets(w)) w.damage(e, 5);
          ringPulse(w, p.x, p.y, col, 20, 420, 22, 0.6);
        }
      },
    },
    ultimate: {
      name: 'OVERDRIVE',
      duration: 240,
      activate(p, w) { w.r.post.flash(col[0], col[1], col[2], 0.6, 0.03); w.g.camera.addTrauma(0.7); },
      update(p, w, t) {
        w.cancelAll();
        if (t % 20 === 0) {
          for (const e of targets(w)) w.damage(e, 7);
          w.r.post.shockwave(p.x, p.y, 0.03, 0.03, 0.6);
          ringPulse(w, p.x, p.y, col, 30, 520, 26, 0.7);
        }
      },
    },

    sprites(atlas) {
      const s = shipScale(atlas);
      for (let t = 1; t <= 4; t++) atlas.add(`ship_${id}_${t}`, 36, 50, (c, w, h) => drawShip(c, w, h, t, hull, col), { scale: s });
      atlas.add(`${id}_bolt`, 16, 6, (c, w, h) => drawBolt(c, w, h, rgba(col, 1)), { scale: s });
    },

    init(p, w) { p.ps.fBolt = w.r.frame(`${id}_bolt`); },

    fire(p, w) {
      if (p.fireCd > 0) return;
      const t = p.tier, S = w.shots, f = p.ps.fBolt;
      const put = (x, a, spd, dmg, pierce = 0) => { const i = w.shot(x, p.y - 22, a, spd, f, dmg, 6, 1); if (i >= 0) S.behave(i, dmg, 70, pierce); };
      if (shot === 'spread') {
        p.fireCd = p.focus ? 4 : 6;
        const k = [1, 3, 3, 5][t - 1], arc = p.focus ? 0.12 : 0.25 + 0.1 * t; // odd counts: one bolt always flies straight
        for (let j = 0; j < k; j++) put(p.x, UP + (k > 1 ? (j / (k - 1) - 0.5) * arc : 0), 12, 1.4);
      } else if (shot === 'twin') {
        p.fireCd = p.focus ? 4 : 5;
        const k = 1 + t, gap = p.focus ? 5 : 10;
        for (let j = 0; j < k; j++) put(p.x + (j - (k - 1) / 2) * gap, UP, 13, 0.9);
      } else {
        p.fireCd = p.focus ? 4 : 6;
        if (p.focus) put(p.x, UP, 17, 2.2 + 0.7 * t, 1);
        else for (const dx of t >= 3 ? [-10, 0, 10] : [-6, 6]) put(p.x + dx, UP, 15, 1.1 + 0.2 * t);
      }
      muzzle(w, p.x, p.y - 24, col, 10);
    },
  };
}

export const PLACEHOLDER_PILOTS = SLOTS.map(makePilot);
