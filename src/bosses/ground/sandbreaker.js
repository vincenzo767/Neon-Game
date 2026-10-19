import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W, H } from '../util.js';
import { PALS, hull, body, camo, weather, track, turret, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, pipe } from '../roster/art.js';

// GROUND — SANDBREAKER (desert assault tank)
// A fast, low main battle tank with a dozer blade, slat armour and a long
// 140 mm smoothbore on a rear-set turret. Where White Fang is a slow siege
// wedge, Sandbreaker is a raider: it sweeps the width of the screen,
// strafes with its coaxial guns and lays mines behind it.
// Arenas: dune-sea convoy → burning oil field → canyon pass → oasis ruins
// → salt-flat sandstorm.
// Signature: the long gun's heavy AP slug (telegraphed), sand-plough
// curtains thrown up by the blade, minefields that arm and burst.

const S = {
  coax: { shape: 'rice', color: 'orange', n: 3, spread: 0.18, speed: 3.6 },
  coaxMk: { shape: 'rice', color: 'yellow', n: 2, spread: 0.08, speed: 4.4 },
  scatter: { shape: 'orb', color: 'orange', n: 9, spread: 1.1, speed: 2.3 },
  slug: { shape: 'bigorb', color: 'yellow', n: 1, speed: 5.2, fixed: true },
  slugWake: { shape: 'rice', color: 'orange', n: 2, spread: 2.6, speed: 1.4, fixed: true },
  mine: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.6, accel: -0.045, minSpd: 0, fixed: true, split: { shape: 'orb', color: 'yellow', n: 10, speed: 1.7 }, splitAt: 110 },
  plough: { shape: 'orb', color: 'orange', n: 16, speed: 1.9, gap: 1 },
  sand: { shape: 'rice', color: 'yellow', n: 2, speed: 2.8 },
  shell: { shape: 'orb', color: 'orange', n: 10, speed: 1.8 },
};

// Muzzle of the long gun (sprite-local), coax guns either side of the mantlet.
const GUN_Y = 128;

const smoke = (ox, off) => ({
  label: 'SMOKE LAUNCHER', sprite: 'sb_smoke', ox, oy: 4, r: 12, hp: 80, medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (!every(c, t, 120, off)) return;
    // Smoke canisters: a short fan that slows and hangs in the air.
    for (let k = -1; k <= 1; k++) P.shoot(w, pe.x, pe.y, DOWN + k * 0.5 + Math.sign(ox) * 0.4, 2.2, { shape: 'bigorb', color: 'orange', accel: -0.03, minSpd: 0.4, split: S.shell, splitAt: 70 });
  },
});
const hmg = (ox, off) => ({
  label: 'ROOF MG', sprite: 'sb_hmg', ox, oy: -30, r: 11, hp: 70, medals: 3, score: 5000, bossDamage: 0.05, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 9, off) && (t % 120) < 60) P.aimed(w, pe.x, pe.y, S.coaxMk); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.desert, meta = { lights: [], treads: [], stacks: [] };
  // Wide track units, partly hidden by sand skirts.
  both((s) => { track(ctx, pal, meta, s > 0 ? 64 : -96, s > 0 ? 96 : -64, -104, 92); });
  // Slat (cage) armour along the sides.
  both((s) => {
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.4;
    for (let y = -96; y < 88; y += 7) { ctx.beginPath(); ctx.moveTo(s * 98, y); ctx.lineTo(s * 108, y + 3); ctx.stroke(); }
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s * 108, -98); ctx.lineTo(s * 108, 92); ctx.stroke();
  });
  // Hull: long and low with a sharply sloped glacis.
  const outline = [0, -110, 54, -108, 66, -92, 66, 64, 58, 84, 36, 100, 0, 102];
  const path = () => mpoly(ctx, outline);
  meta.lights.push(...body(ctx, pal, outline, [-66, -110, 132, 212], 'sandbreaker', { vents: 3, hazards: 0, pipes: 1 }));
  camo(ctx, path, ['#c8a874', '#8a6a42', '#e6d0a2', '#6a4e30'], 11, 26, 22);
  weather(ctx, path, 0.3);
  // Glacis plate and driver's hatch.
  ctx.beginPath(); ctx.moveTo(-58, 80); ctx.lineTo(58, 80); ctx.lineTo(36, 100); ctx.lineTo(-36, 100); ctx.closePath();
  armour(ctx, pal, -58, 58);
  circ(ctx, -18, 70, 6); armour(ctx, pal, -24, -12);
  // Dozer blade across the bow.
  ctx.beginPath(); ctx.moveTo(-90, 104); ctx.lineTo(90, 104); ctx.lineTo(96, 116); ctx.lineTo(-96, 116); ctx.closePath();
  armour(ctx, { plate: ['#2a2018', '#9a8a70', '#e8dcc4'], hi: 'rgba(255,255,255,0.4)' }, -96, 96);
  ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 1;
  for (let x = -84; x <= 84; x += 12) { ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, 115); ctx.stroke(); }
  both((s) => { ctx.beginPath(); ctx.rect(s * 52 - 4, 84, 8, 22); armour(ctx, pal, s * 52 - 4, s * 52 + 4); });
  // Engine deck: louvres, exhausts, jerry cans.
  vent(ctx, pal, -46, -104, 92, 14, 0.3, false);
  both((s) => { ctx.beginPath(); ctx.rect(s * 30 - 7, -90, 14, 10); ctx.fillStyle = '#1a140c'; ctx.fill(); meta.stacks.push([s * 30, -92]); });
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.rect(-52 + k * 11, -78, 9, 14); armour(ctx, { plate: ['#2a3018', '#5a6a32', '#8a9a5a'] }, -52 + k * 11, -43 + k * 11); }
  // Stowage basket at the rear of the turret.
  ctx.strokeStyle = '#2a1e10'; ctx.lineWidth = 1;
  ctx.strokeRect(-34, -60, 68, 18);
  for (let x = -30; x < 34; x += 6) { ctx.beginPath(); ctx.moveTo(x, -60); ctx.lineTo(x, -42); ctx.stroke(); }
  ctx.fillStyle = '#7a6a48'; ctx.fillRect(-28, -56, 24, 10); ctx.fillStyle = '#4a5a2e'; ctx.fillRect(4, -56, 22, 10);
  // Long smoothbore with thermal sleeve, fume extractor and muzzle brake.
  ctx.beginPath(); ctx.rect(-4.5, 0, 9, GUN_Y - 6); armour(ctx, pal, -4.5, 4.5);
  ctx.beginPath(); ctx.rect(-6.5, 54, 13, 16); armour(ctx, pal, -6.5, 6.5);
  ctx.beginPath(); ctx.rect(-7, GUN_Y - 10, 14, 10); armour(ctx, pal, -7, 7);
  ctx.fillStyle = '#050403'; ctx.fillRect(-2.5, GUN_Y - 3, 5, 3);
  // Turret: angular, set back, with a commander's sight.
  ctx.beginPath(); poly(ctx, [-30, -40, 30, -40, 44, -6, 34, 26, 12, 34, -12, 34, -34, 26, -44, -6]);
  armour(ctx, pal, -44, 44, 2);
  camo(ctx, () => poly(ctx, [-30, -40, 30, -40, 44, -6, 34, 26, 12, 34, -12, 34, -34, 26, -44, -6]), ['#c8a874', '#8a6a42', '#e6d0a2'], 5, 8, 12);
  rivetRow(ctx, pal, -28, -34, 28, -34, 6);
  circ(ctx, 20, -16, 8); armour(ctx, pal, 12, 28);
  ctx.beginPath(); ctx.rect(14, -8, 12, 7); ctx.fillStyle = '#0a1418'; ctx.fill();
  circ(ctx, -18, -14, 6); armour(ctx, pal, -24, -12);
  // Coaxial guns at the mantlet.
  both((s) => { ctx.beginPath(); ctx.rect(s * 12 - 1.5, 28, 3, 20); armour(ctx, pal, s * 12 - 1.5, s * 12 + 1.5); });
  pipe(ctx, pal, -60, -20, -60, 60, 1.6);
  pipe(ctx, pal, 60, -20, 60, 60, 1.6);
  keyLight(ctx, -110, -120, 110, 130, 1);
  core(ctx, pal, 0, -84, 6, '#ff9a3a');
  both((s) => { lamp(ctx, s * 46, 96, pal.light, 1.5); meta.lights.push({ x: s * 46, y: 96, c: pal.light, ph: s > 0 ? 0 : 0.5 }); });
  return meta;
}

function smokeArt(ctx, w, h) {
  const pal = PALS.desert, cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 3, w - 4, h - 6, 3); armour(ctx, pal, 0, w);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { circ(ctx, cx - 6 + k * 6, cy - 4 + j * 8, 2.6); ctx.fillStyle = '#100a04'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

function hmgArt(ctx, w, h) {
  const pal = PALS.desert, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 1.5, h * 0.45, 3, h * 0.55); armour(ctx, pal, cx - 1.5, cx + 1.5);
  ctx.beginPath(); ctx.roundRect(3, h * 0.2, w - 6, h * 0.35, 3); armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'sandbreaker',
  name: 'SANDBREAKER',
  title: 'DESERT ASSAULT TANK',
  archetype: 'ground',
  sprite: 'b_sandbreaker', scale: 1, r: 52, glow: [1, 0.7, 0.3], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_sandbreaker', 228, 262, hull('b_sandbreaker', hullArt));
    add('sb_smoke', 24, 26, smokeArt, 2.5);
    add('sb_hmg', 22, 30, hmgArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'crawler',
    weak: { x: 0, y: -84, r: 16, rgb: [1, 0.6, 0.2] },
    sites: [[-36, -70], [40, 10], [-20, 60], [30, 76], [-80, -40], [80, 30]],
  },
  parts: { smokeL: smoke(-48, 0), smokeR: smoke(48, 60), hmgL: hmg(-20, 0), hmgR: hmg(20, 5) },
  desperation: { name: 'SCORCHED SANDS' },

  phases: [
    {
      name: 'CONVOY STRAFE', hp: 700, arena: 'sb_dune_convoy', transitionFx: 'flash',
      move: { type: 'sweep', amp: 150, y: 120, freq: 0.014 }, parts: ['hmgL', 'hmgR'],
      patterns: ['coaxStrafe', 'scatterShell'], musicLayer: 'ground_p1',
    },
    {
      name: 'MINEFIELD', hp: 760, arena: 'sb_oil_field', transitionFx: 'sandstorm',
      move: { type: 'hover', amp: 120, y: 125, freq: 0.012 }, parts: ['smokeL', 'smokeR'],
      patterns: ['mainGun', 'mineField'], musicLayer: 'ground_p2',
    },
    {
      name: 'PLOUGH RUN', hp: 800, arena: 'sb_canyon_pass', transitionFx: 'rockfall',
      move: { type: 'sweep', amp: 90, y: 120, freq: 0.016 }, parts: ['hmgL', 'hmgR', 'smokeL', 'smokeR'],
      patterns: ['coaxStrafe', 'plough', 'scatterShell'], musicLayer: 'ground_p3',
    },
    {
      name: 'HEAVY SHELLING', hp: 850, arena: 'sb_oasis_ruins', transitionFx: 'sandstorm',
      move: { type: 'figure8', amp: 120, ampY: 30, y: 125 },
      patterns: ['mainGun', 'mineField', 'coaxStrafe'], musicLayer: 'ground_p4',
    },
    {
      name: 'SANDSTORM', hp: 930, arena: 'sb_salt_flats', transitionFx: 'sandstorm',
      move: { type: 'sweep', amp: 160, y: 120, freq: 0.018 }, intensity: 1.1,
      patterns: ['mainGun', 'plough', 'sandstorm', 'scatterShell'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    // Coaxial strafe: short aimed bursts that walk across as the tank sweeps.
    coaxStrafe(c, w, t) {
      if ((t % 90) < 48 && every(c, t, 6)) for (const s of [-1, 1]) P.aimed(w, c.e.x + s * 12, c.e.y + 46, S.coax, s * 0.05);
    },
    scatterShell(c, w, t) {
      if (every(c, t, 80, 30)) P.fan(w, c.e.x, c.e.y + GUN_Y, DOWN, S.scatter);
      if (c.mk >= 2 && every(c, t, 160, 70)) artillery(c, w.aimX, w.aimY, 40, 70, S.shell);
    },
    // Main gun: lock-on line, then a fast AP slug that sheds sparks as it flies.
    mainGun(c, w, t) {
      const k = t % 150;
      if (k === 0) {
        c.data.ang = w.aimAngle(c.e.x, c.e.y + GUN_Y);
        P.laser(w, c.e, c.data.ang, { warn: 50, fire: 4, width: 3, ox: 0, oy: GUN_Y, rgb: [1, 0.8, 0.3] });
      }
      if (k === 50) {
        P.shoot(w, c.e.x, c.e.y + GUN_Y, c.data.ang, S.slug.speed, S.slug);
        P.ring(w, c.e.x, c.e.y + GUN_Y, S.slugWake, c.data.ang);
        w.g.camera.addTrauma(0.12);
        w.explosions.sparks(c.e.x, c.e.y + GUN_Y, 10, [1, 0.8, 0.4], 5, 16, 3);
      }
      if (c.mk >= 3 && k === 80) P.aimed(w, c.e.x, c.e.y + GUN_Y, S.coaxMk);
    },
    // Minefield: mines skid out, stop, arm, then burst into rings.
    mineField(c, w, t) {
      if (every(c, t, 110, 40)) {
        const n = c.mk >= 2 ? 3 : 2;
        for (let k = 0; k < n; k++) P.shoot(w, c.e.x, c.e.y + 60, DOWN + (k - (n - 1) / 2) * 0.55 + w.rng.range(-0.1, 0.1), S.mine.speed, S.mine);
      }
    },
    // Plough: the blade throws up a wall of sand with one gap.
    plough(c, w, t) {
      if (every(c, t, 150, 20)) {
        P.curtain(w, S.plough);
        w.g.camera.addTrauma(0.06);
      }
    },
    // Sandstorm: blowing grit from the windward side plus a lane gust.
    sandstorm(c, w, t) {
      if (every(c, t, 4)) {
        const y = w.rng.range(40, H * 0.75);
        P.shoot(w, -8, y, 0.12 + w.rng.range(-0.05, 0.05), 2.6, S.sand);
      }
      if (every(c, t, 240, 120)) {
        const x = clamp(w.aimX, 70, W - 70);
        c.kit.hazard({ type: 'lane', x, w: 110, warn: 60, fire: 30, color: [1, 0.75, 0.35] });
      }
    },
  },

  update(c) { if (c.state === 'fight') c.e.rot = (c.e.x - c.e.px) * -0.004; },
};
