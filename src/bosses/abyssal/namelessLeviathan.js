import * as P from '../../patterns/index.js';
import { every, clamp, dens, ghostRing, tendril, DOWN, TAU, W, H } from '../util.js';
import { hull, mpoly, poly, circ, both, keyLight, chitin, glowDot, tentacle, eyeball } from '../roster/art.js';

// ABYSSAL — NAMELESS LEVIATHAN (colossal abyssal entity)
// Too large to fit on the screen: what the player fights is a head — a
// cliff of scarred grey hide, a crown of eyes in uneven rows, a jaw that
// splits four ways, and arms that come in from the edges of the dark. Its
// body continues past the top of the screen into the trench. Every eye can
// fire; gazes linger as ghost-light; arms slam in from the edges; its
// heartbeat shakes the water; at the end it simply tries to swallow you.
// Arenas: the abyssal plain → a leviathan graveyard (whale-fall bones) →
// a forgotten sanctuary → inside its body → the nameless dark.

const S = {
  gaze: { shape: 'orb', color: 'violet', n: 22, speed: 1.3 },
  eye: { shape: 'kunai', color: 'pink', n: 3, spread: 0.2, speed: 3 },
  beat: { shape: 'orb', color: 'red', n: 20, speed: 1.5 },
  beatB: { shape: 'rice', color: 'pink', n: 16, speed: 2 },
  swallow: { shape: 'rice', color: 'violet', n: 1, speed: 1.6, fixed: true },
  dark: { shape: 'orb', color: 'violet', n: 16, speed: 1.4, gap: 1 },
};

// Eyes (sprite-local) — weak points ride on the central pair.
const EYES = [[-46, 30, 9], [46, 30, 9], [-74, 6, 6], [74, 6, 6], [-24, 54, 7], [24, 54, 7], [-96, -20, 5], [96, -20, 5], [0, 16, 11]];

const eyePart = (k, off) => ({
  label: 'EYE', sprite: 'nl_eye', ox: EYES[k][0], oy: EYES[k][1], r: EYES[k][2] + 4, hp: 70, medals: 3, score: 6000, bossDamage: 0.05, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 70, off)) P.aimed(w, pe.x, pe.y, S.eye); },
});

// ------------------------------------------------------------------ art

const HIDE = ['#0c0a0e', '#3a3440', '#7a7084'];

function hullArt(ctx) {
  const meta = { lights: [], treads: [], stacks: [] };
  // The body continuing up and off the screen (top of the sprite fades).
  const bg = ctx.createLinearGradient(0, -150, 0, -40);
  bg.addColorStop(0, 'rgba(12,10,14,0)'); bg.addColorStop(1, '#2a2430');
  ctx.beginPath(); ctx.moveTo(-90, -150); ctx.lineTo(90, -150); ctx.lineTo(118, -30); ctx.lineTo(-118, -30); ctx.closePath(); ctx.fillStyle = bg; ctx.fill();
  // Head mass: overlapping hide plates, scarred.
  chitin(ctx, 0, 10, 128, 92, 0, HIDE);
  for (const [x, y, rx, ry] of [[-60, -30, 50, 34], [60, -30, 50, 34], [0, -50, 60, 30], [-80, 30, 36, 40], [80, 30, 36, 40]]) chitin(ctx, x, y, rx, ry, 0, HIDE);
  ctx.strokeStyle = 'rgba(200,180,200,0.18)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 14; k++) { const x = ((k * 53) % 200) - 100, y = ((k * 37) % 110) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 6 + (k % 3) * 4); ctx.stroke(); }
  // Four-way jaw at the front.
  for (const a of [-0.5, 0.5]) { ctx.save(); ctx.translate(0, 80); ctx.rotate(a); chitin(ctx, 0, 24, 26, 34, 0, HIDE); ctx.restore(); }
  ctx.beginPath(); ctx.ellipse(0, 96, 34, 18, 0, 0, TAU); ctx.fillStyle = '#060206'; ctx.fill();
  for (let k = 0; k < 12; k++) { const a = Math.PI * 0.1 + (k / 11) * Math.PI * 0.8, x = Math.cos(a) * 32, y = 96 - Math.sin(a) * 14; poly(ctx, [x - 2.5, y, x + 2.5, y, x, y + 9]); ctx.fillStyle = '#d8d0c0'; ctx.fill(); }
  // Eyes in uneven rows.
  for (const [x, y, r] of EYES) { eyeball(ctx, x, y, r, '#c84aff'); meta.lights.push({ x, y, c: '#d070ff', ph: (x + y) * 0.01 }); }
  // Glow patches of bioluminescence along the hide.
  for (let k = 0; k < 18; k++) glowDot(ctx, ((k * 61) % 220) - 110, ((k * 29) % 90) - 60, 1.5, 'rgba(160,90,255,1)');
  keyLight(ctx, -140, -150, 140, 130, 0.4);
  return meta;
}

function eyeArt(ctx, w, h) { eyeball(ctx, w / 2, h / 2, w * 0.4, '#c84aff'); }

export default {
  id: 'nameless_leviathan',
  name: 'NAMELESS LEVIATHAN',
  title: 'COLOSSAL ABYSSAL ENTITY',
  archetype: 'abyssal',
  sprite: 'b_nameless', scale: 1, r: 70, glow: [0.75, 0.35, 1], score: 150000,
  deathSequence: 'dissolve',
  art(add) {
    add('b_nameless', 300, 300, hull('b_nameless', hullArt));
    add('nl_eye', 22, 22, eyeArt, 2.5);
  },
  look: {
    faction: 'drowned', anim: 'maw', organic: true, ichor: [0.7, 0.3, 1],
    weak: { x: 0, y: 16, r: 22, rgb: [0.75, 0.35, 1] },
    sites: [[-46, 30], [46, 30], [-74, 6], [74, 6], [-96, -20], [96, -20]],
  },
  parts: { eyeL: eyePart(0, 0), eyeR: eyePart(1, 35), eyeFL: eyePart(4, 15), eyeFR: eyePart(5, 50), eyeOL: eyePart(2, 25), eyeOR: eyePart(3, 60) },
  desperation: { name: 'THE NAMELESS DARK' },

  phases: [
    {
      name: 'THE GAZE', hp: 780, arena: 'nl_abyssal_plain', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 40, y: 120, freq: 0.004 }, parts: ['eyeL', 'eyeR'],
      patterns: ['gaze', 'heartbeat'], musicLayer: 'abyssal_p1',
    },
    {
      name: 'GRASPING ARMS', hp: 830, arena: 'nl_whale_fall', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 50, y: 120, freq: 0.004 }, parts: ['eyeFL', 'eyeFR'],
      patterns: ['arms', 'gaze'], musicLayer: 'abyssal_p2',
    },
    {
      name: 'HEARTBEAT', hp: 870, arena: 'nl_sanctuary', transitionFx: 'water_flood',
      move: { type: 'center', y: 120 }, parts: ['eyeOL', 'eyeOR', 'eyeL', 'eyeR'],
      patterns: ['heartbeat', 'darkness'], musicLayer: 'abyssal_p3',
    },
    {
      name: 'INSIDE THE BEAST', hp: 910, arena: 'nl_inside', transitionFx: 'membrane',
      move: { type: 'hover', amp: 50, y: 120, freq: 0.005 },
      patterns: ['heartbeat', 'arms', 'gaze'], musicLayer: 'abyssal_p4',
    },
    {
      name: 'THE NAMELESS DARK', hp: 1000, arena: 'nl_nameless_dark', transitionFx: 'darkness_swallow',
      move: { type: 'hover', amp: 60, y: 120, freq: 0.005 }, intensity: 1.1, parts: ['eyeL', 'eyeR', 'eyeFL', 'eyeFR'],
      patterns: ['swallow', 'arms', 'gaze', 'darkness'], musicLayer: 'abyssal_p5',
    },
  ],

  attacks: {
    // Gaze: lingering ghost-light rings from the central eye.
    gaze(c, w, t) { if (every(c, t, 60)) ghostRing(c, w, c.e.x, c.e.y + 16, S.gaze, t * 0.021); },
    // Heartbeat: a double pulse — two rings in quick succession, then a pause.
    heartbeat(c, w, t) {
      const k = t % 120;
      if (k === 0 || k === 16) { P.ring(w, c.e.x, c.e.y, k ? S.beatB : S.beat, w.rng.angle()); w.g.camera.addTrauma(0.1); }
    },
    // Arms: tendrils reach in from the edges of the dark, through the player.
    arms(c, w, t) { if (every(c, t, 90, 30)) { tendril(c, w, 55, 40, 22); if (c.mk >= 2) tendril(c, w, 70, 40, 18); } },
    // Darkness: walls of the dark roll down with one gap.
    darkness(c, w, t) { if (every(c, t, 140, 50)) P.curtain(w, S.dark); },
    // Swallow: the jaw opens; a well drags everything in; a ring closes in.
    swallow(c, w, t) {
      const k = t % 300;
      if (k === 0) c.kit.well({ x: c.e.x, y: c.e.y + 96, r: 320, strength: 0.035, life: 180, follow: true, fx: 0, fy: 96 });
      if (k === 40) {
        const n = dens(w, 26), cx = c.e.x, cy = c.e.y + 96;
        for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI + 0.05, px = clamp(cx + Math.cos(a) * 330, -30, W + 30), py = clamp(cy + Math.sin(a) * 330, -30, H + 30); P.shoot(w, px, py, Math.atan2(cy - py, cx - px), S.swallow.speed, S.swallow); }
      }
    },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = Math.sin(c.w.t * 0.004) * 0.02; },
};
