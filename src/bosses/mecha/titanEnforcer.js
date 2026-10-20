import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, W } from '../util.js';

// MECHA — TITAN ENFORCER
// Humanoid war machine. Signature: transforming phases (armoured → wings
// deployed → burning core), melee blade swipes across a telegraphed arc,
// spiral danmaku, and a low-HP desperation protocol. Corporate plaza →
// rooftop helipad in the rain → inside a data-core → orbital elevator →
// red-alert desperation.

const S = {
  rifle: { shape: 'kunai', color: 'red', n: 1, speed: 4.2, layers: 4, dSpeed: 0.5, fixed: true },
  rifleMk: { shape: 'kunai', color: 'pink', n: 3, spread: 0.3, speed: 3.6, layers: 2, dSpeed: 0.5 },
  missile: { shape: 'kunai', color: 'orange', n: 2, spread: 1.4, speed: 2.2, homing: 0.04, homingTime: 70 },
  spiralA: { shape: 'orb', color: 'pink', n: 6, speed: 2.2, turn: 0.13 },
  spiralB: { shape: 'rice', color: 'cyan', n: 6, speed: 2.8, turn: -0.09 },
  spiralC: { shape: 'orb', color: 'red', n: 8, speed: 2.4, turn: 0.17 },
  feather: { shape: 'rice', color: 'cyan', n: 5, spread: 0.5, speed: 3.0 },
  slashWave: { shape: 'rice', color: 'white', n: 11, spread: 1.6, speed: 2.6 },
  burst: { shape: 'bigorb', color: 'red', n: 14, speed: 1.8 },
};

const ARM = 46;

/** Melee swipe: lunge into the player's column and sweep a bladed arc below. */
function swipe(c, w, dir, delay = 0) {
  c.data.lungeX = clamp(w.aimX, 80, W - 80);
  c.data.lungeT = 60 + delay;
  const a0 = dir > 0 ? Math.PI * 0.1 : Math.PI * 0.9;
  c.kit.hazard({
    type: 'arc', follow: true, fx: 0, fy: 30, r: 280, a0, a1: Math.PI - a0, warn: 50 + delay, fire: 16, color: [1, 0.3, 0.45],
    onFire: (h, w2) => {
      // The blade throws a wave of shrapnel along its path.
      P.fan(w2, h.cx, h.cy, DOWN, S.slashWave);
      w2.g.camera.addTrauma(0.3);
      w2.g.renderer.post.aberrate(0.006);
    },
  });
}

const shoulder = (ox, off) => ({
  label: 'SHOULDER CANNON', sprite: 'bp_shoulder', ox, oy: -26, r: 13, hp: 90, medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) { if (every(c, t, 90, off)) P.aimed(w, pe.x, pe.y, S.missile); },
});

export default {
  id: 'titan_enforcer',
  name: 'TITAN ENFORCER',
  archetype: 'mecha',
  sprite: 'b_titan_a', scale: 1, r: 44, glow: [1, 0.3, 0.35], score: 150000,
  deathSequence: 'meltdown',

  parts: { shoulderL: shoulder(-37, 0), shoulderR: shoulder(37, 45) },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'OVERLOAD' },

  phases: [
    {
      name: 'PLAZA ENFORCEMENT',
      hp: 720,
      arena: 'te_corporate_plaza',
      transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 140 },
      parts: ['shoulderL', 'shoulderR'],
      patterns: ['rifle', 'swipe'],
      musicLayer: 'mecha_p1',
    },
    {
      name: 'SPIRAL SUPPRESSION',
      hp: 760,
      arena: 'te_helipad_downpour',
      transitionFx: 'screen_tear',
      move: { type: 'figure8', amp: 110, ampY: 30, y: 140 },
      patterns: ['swipe', 'spiralDanmaku', 'rifle'],
      musicLayer: 'mecha_p2',
    },
    {
      name: 'WING FEATHERS',
      hp: 820,
      sprite: 'b_titan_b',
      arena: 'te_data_core',
      transitionFx: 'warp_tunnel',
      move: { type: 'hover', amp: 80, y: 130 },
      parts: ['shoulderL', 'shoulderR'],
      patterns: ['wingFeathers', 'spiralDanmaku'],
      musicLayer: 'mecha_p3',
    },
    {
      name: 'LASER BLADES',
      hp: 870,
      sprite: 'b_titan_b',
      arena: 'te_orbital_ascent',
      transitionFx: 'flash',
      move: { type: 'sweep', amp: 120, y: 135 },
      patterns: ['doubleSwipe', 'laserBlades', 'wingFeathers'],
      musicLayer: 'mecha_p4',
    },
    {
      name: 'DESPERATION PROTOCOL',
      hp: 900,
      sprite: 'b_titan_c',
      arena: 'te_desperation_protocol',
      transitionFx: 'screen_tear',
      move: { type: 'hover', amp: 120, y: 140, freq: 0.016 },
      patterns: ['swipe', 'overdriveSpiral', 'rifle', 'overdrive'],
      intensity: 1.25,
      musicLayer: 'mecha_p5',
    },
  ],

  attacks: {
    rifle(c, w, t) {
      const x = c.e.x + ((t / 60) & 1 ? ARM : -ARM), y = c.e.y + 40;
      if (every(c, t, 60)) P.aimed(w, x, y, S.rifle);
      if (c.mk >= 2 && every(c, t, 60, 30)) P.aimed(w, x, y, S.rifleMk);
    },
    swipe(c, w, t) {
      if (t % 230 === 100) swipe(c, w, (t / 230) & 1 ? 1 : -1);
      if (c.mk >= 3 && t % 230 === 180) swipe(c, w, (t / 230) & 1 ? -1 : 1);
    },
    doubleSwipe(c, w, t) {
      if (t % 260 === 80) { swipe(c, w, 1); swipe(c, w, -1, 40); }
    },
    spiralDanmaku(c, w, t) {
      if (every(c, t, 6)) P.spiral(w, c.e, S.spiralA, 'sa');
      if (every(c, t, 8, 4)) P.spiral(w, c.e, S.spiralB, 'sb');
    },
    overdriveSpiral(c, w, t) {
      if (every(c, t, 5)) P.spiral(w, c.e, S.spiralC, 'sc');
      if (every(c, t, 9, 4)) P.spiral(w, c.e, S.spiralB, 'sb');
    },
    wingFeathers(c, w, t) {
      if (!every(c, t, 40)) return;
      for (const s of [-1, 1]) P.aimed(w, c.e.x + s * 68, c.e.y - 20, S.feather, s * 0.25);
    },
    laserBlades(c, w, t) {
      if (t % 200 === 40) for (const s of [-1, 1]) P.laser(w, c.e, DOWN + s * 0.3, { warn: 55, fire: 70, width: 16, ox: s * 50, oy: 90, track: true, rgb: [0.4, 0.9, 1] });
    },
    // Low-HP overdrive: short boost dashes punctuated by heavy rings.
    overdrive(c, w, t) {
      if (t % 150 === 0) { c.data.dashX = w.rng.range(90, W - 90); c.data.dashT = 24; }
      if (c.data.dashT > 0) { c.data.dashT--; c.mx = c.data.dashX; c.ease = 0.2; if (c.data.dashT === 0) P.ring(w, c.e.x, c.e.y, S.burst, w.aimAngle(c.e.x, c.e.y)); }
    },
  },

  update(c) {
    // Lunge toward the swipe column while a swipe winds up.
    if (c.data.lungeT > 0 && c.state === 'fight') {
      c.data.lungeT--;
      c.mx = c.data.lungeX;
      c.my = 190;
      c.ease = 0.1;
    }
    if (c.state !== 'fight') c.data.lungeT = 0;
    // Thruster sway.
    c.e.rot = Math.sin(c.w.t * 0.05) * 0.03;
  },
};
