import { every } from '../util.js';
import { PALS, hull, body, camo, weather, track, mpoly, poly, circ, armour, both, keyLight, vent, rivetRow, core, lamp, pipe } from '../roster/art.js';
import { SandbreakerRig } from './sandbreakerRig.js';

// GROUND — SANDBREAKER (armoured siege locomotive), level 2 of the campaign.
//
// A real 3D train on the Dune Sea main line (sandbreakerRig.js + world/tank/):
// a locomotive with a beast-head ram and three armoured cars, all following
// the same curving rails, coupled with slack. Every weapon fires from its
// own muzzle on the model:
//   side cannons (loco)          GOLDEN BARRAGE: lanes either side of you, narrow / wide fans
//   twin main battery (loco)     heavy shells after a load + aim telegraph
//   mortar battery (loco)        SIEGE ARTILLERY: marked ballistic shells,
//   heavy howitzer (artillery car)  with the howitzer's heavier rounds
//   side cannons + rotary guns   CROSSFIRE CONVOY: front and rear cover different lanes, then swap
//   rotary guns (artillery car)  ROTARY GUN SWEEP: dashed sweeping arcs
//   rocket launchers (rocket car) ROCKET SALVO: staggered rockets onto marked spots
//   (the whole convoy)           SANDSTORM BOMBARDMENT: dust front + walked impacts
//   the ram                      LOCOMOTIVE RAM: a full-power surge down the line
// Nine mounts are breakable parts; a broken mount stays broken for the rest
// of the fight and its attacks stop. Losing all of a car's weapons disables it.
//
// The 2D sprites below are only the fallback when no arena world is up.

const mount = (kind, side, label, o) => ({
  label, sprite: o.sprite, mount: kind, side, free: true, quietClear: true,
  r: o.r, hp: o.hp, medals: o.medals ?? 3, score: o.score, bossDamage: o.bd,
  skip: (c) => !!(c.rig && c.rig.isDestroyed(kind, side)),
  onSpawn: (pe, c) => c.rig && c.rig.partSpawned(kind, side, pe),
  onClear: (p, c) => c.rig && c.rig.partCleared(kind, side, p),
  onDown: (c) => c.rig && c.rig.partDestroyed(kind, side),
});

const MOUNTS = ['cannonL', 'cannonR', 'main', 'mortar', 'howitzer', 'rotaryL', 'rotaryR', 'rocketL', 'rocketR'];

// ------------------------------------------------------------------ 2D fallback art

function hullArt(ctx) {
  const pal = PALS.desert, meta = { lights: [], treads: [], stacks: [] };
  both((s) => { track(ctx, pal, meta, s > 0 ? 64 : -96, s > 0 ? 96 : -64, -104, 92); });
  const outline = [0, -110, 54, -108, 66, -92, 66, 64, 58, 84, 36, 100, 0, 112];
  const path = () => mpoly(ctx, outline);
  meta.lights.push(...body(ctx, pal, outline, [-66, -110, 132, 222], 'sandbreaker', { vents: 3, hazards: 0, pipes: 1 }));
  camo(ctx, path, ['#c8a874', '#8a6a42', '#e6d0a2', '#6a4e30'], 11, 26, 22);
  weather(ctx, path, 0.3);
  // Beast-head ram.
  ctx.beginPath(); poly(ctx, [-60, 84, 60, 84, 30, 118, 0, 128, -30, 118]); armour(ctx, pal, -60, 60, 2);
  both((s) => { circ(ctx, s * 16, 96, 4); ctx.fillStyle = '#ffb040'; ctx.fill(); });
  // Boiler spine and main battery.
  ctx.beginPath(); ctx.rect(-20, -60, 40, 120); armour(ctx, pal, -20, 20);
  for (let y = -50; y <= 50; y += 25) { ctx.fillStyle = '#5a4022'; ctx.fillRect(-21, y, 42, 4); }
  circ(ctx, 0, -76, 24); armour(ctx, pal, -24, 24);
  both((s) => { ctx.beginPath(); ctx.rect(s * 10 - 3, -76, 6, 110); armour(ctx, pal, s * 10 - 3, s * 10 + 3); });
  vent(ctx, pal, -46, -104, 92, 14, 0.3, false);
  rivetRow(ctx, pal, -60, -100, -60, 70, 7); rivetRow(ctx, pal, 60, -100, 60, 70, 7);
  pipe(ctx, pal, -36, -40, -36, 60, 1.6);
  pipe(ctx, pal, 36, -40, 36, 60, 1.6);
  keyLight(ctx, -110, -120, 110, 130, 1);
  core(ctx, pal, 0, -84, 6, '#ff9a3a');
  both((s) => { lamp(ctx, s * 46, 96, pal.light, 1.5); meta.lights.push({ x: s * 46, y: 96, c: pal.light, ph: s > 0 ? 0 : 0.5 }); });
  return meta;
}

function mountArt(ctx, w, h) {
  const pal = PALS.desert, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 1.5, h * 0.45, 3, h * 0.55); armour(ctx, pal, cx - 1.5, cx + 1.5);
  ctx.beginPath(); ctx.roundRect(3, h * 0.2, w - 6, h * 0.35, 3); armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

function podArt(ctx, w, h) {
  const pal = PALS.desert, cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 3, w - 4, h - 6, 3); armour(ctx, pal, 0, w);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { circ(ctx, cx - 6 + k * 6, cy - 4 + j * 8, 2.6); ctx.fillStyle = '#100a04'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

// ------------------------------------------------------------------ boss

export default {
  id: 'sandbreaker',
  name: 'SANDBREAKER',
  title: 'ARMOURED SIEGE LOCOMOTIVE',
  archetype: 'ground',
  sprite: 'b_sandbreaker', scale: 1, r: 80, glow: [1, 0.7, 0.3], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_sandbreaker', 228, 262, hull('b_sandbreaker', hullArt));
    add('sb_gun', 22, 30, mountArt, 2.5);
    add('sb_pod', 24, 26, podArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: -84, r: 16, rgb: [1, 0.6, 0.2] },
    sites: [[-36, -70], [40, 10], [-20, 60], [30, 76], [-60, -40], [60, 30]],
  },
  parts: {
    cannonL: mount('cannon', 0, 'SIDE CANNON', { sprite: 'sb_gun', r: 16, hp: 90, score: 6000, bd: 0.05 }),
    cannonR: mount('cannon', 1, 'SIDE CANNON', { sprite: 'sb_gun', r: 16, hp: 90, score: 6000, bd: 0.05 }),
    main: mount('main', 0, 'MAIN BATTERY', { sprite: 'sb_gun', r: 22, hp: 150, score: 9000, bd: 0.08, medals: 4 }),
    mortar: mount('mortar', 0, 'MORTAR BATTERY', { sprite: 'sb_pod', r: 19, hp: 110, score: 7000, bd: 0.06 }),
    howitzer: mount('how', 0, 'HEAVY HOWITZER', { sprite: 'sb_gun', r: 20, hp: 130, score: 8000, bd: 0.07, medals: 4 }),
    rotaryL: mount('rotary', 0, 'ROTARY GUN', { sprite: 'sb_gun', r: 14, hp: 80, score: 5000, bd: 0.04 }),
    rotaryR: mount('rotary', 1, 'ROTARY GUN', { sprite: 'sb_gun', r: 14, hp: 80, score: 5000, bd: 0.04 }),
    rocketL: mount('rocket', 0, 'ROCKET BATTERY', { sprite: 'sb_pod', r: 17, hp: 90, score: 6000, bd: 0.04 }),
    rocketR: mount('rocket', 1, 'ROCKET BATTERY', { sprite: 'sb_pod', r: 17, hp: 90, score: 6000, bd: 0.04 }),
  },
  desperation: { name: 'SCORCHED SANDS' },

  // move: { cruise (convoy speed), row (screen row of the ram tip) }
  phases: [
    {
      name: 'CONVOY ARRIVAL', hp: 720, arena: 'sb_dune_convoy', transitionFx: 'flash',
      move: { cruise: 1.4, row: 360 }, parts: MOUNTS,
      patterns: ['goldenBarrage', 'mainSalvoSlow'], musicLayer: 'ground_p1',
    },
    {
      name: 'HEAVY ARTILLERY', hp: 780, arena: 'sb_oil_field', transitionFx: 'sandstorm',
      move: { cruise: 1.1, row: 350 }, parts: MOUNTS,
      patterns: ['siegeArtillery', 'goldenBarrageSlow', 'mainSalvo'], musicLayer: 'ground_p2',
    },
    {
      name: 'CROSSFIRE CONVOY', hp: 820, arena: 'sb_canyon_pass', transitionFx: 'rockfall',
      move: { cruise: 1.5, row: 362 }, parts: MOUNTS,
      patterns: ['crossfire', 'rotarySweep', 'rocketSalvo'], musicLayer: 'ground_p3',
    },
    {
      name: 'ARMORED ADVANCE', hp: 870, arena: 'sb_oasis_ruins', transitionFx: 'sandstorm',
      move: { cruise: 1.7, row: 392 }, parts: MOUNTS,
      patterns: ['ramCharge', 'goldenBarrageSlow', 'rotarySweepSlow'], musicLayer: 'ground_p4',
    },
    {
      name: 'ENRAGED CONVOY', hp: 950, arena: 'sb_salt_flats', transitionFx: 'sandstorm',
      move: { cruise: 1.6, row: 360 }, parts: MOUNTS, intensity: 1.1,
      patterns: ['sandstorm', 'goldenBarrage', 'rocketSalvoSlow', 'ramChargeSlow', 'siegeSlow', 'mainSalvoSlow'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    goldenBarrage(c, w, t) { c.rig.barrage(t, 1); },
    goldenBarrageSlow(c, w, t) { c.rig.barrage(t, 0.6); },
    mainSalvo(c, w, t) { if (every(c, t, 210, 60)) c.rig.mainSalvo(); },
    mainSalvoSlow(c, w, t) { if (every(c, t, 330, 120)) c.rig.mainSalvo(); },
    siegeArtillery(c, w, t) { if (every(c, t, 250, 30)) c.rig.startSiege(); },
    siegeSlow(c, w, t) { if (every(c, t, 460, 300)) c.rig.startSiege(2); },
    crossfire(c, w, t) { c.rig.crossfire(t); },
    rotarySweep(c, w, t) { if (every(c, t, 340, 130)) c.rig.startSweep(); },
    rotarySweepSlow(c, w, t) { if (every(c, t, 520, 260)) c.rig.startSweep(); },
    rocketSalvo(c, w, t) { if (every(c, t, 310, 40)) c.rig.startSalvo(); },
    rocketSalvoSlow(c, w, t) { if (every(c, t, 500, 200)) c.rig.startSalvo(); },
    ramCharge(c, w, t) { if (every(c, t, 430, 170)) c.rig.startRam(); },
    ramChargeSlow(c, w, t) { if (every(c, t, 620, 420)) c.rig.startRam(); },
    sandstorm(c, w, t) { if (every(c, t, 600, 20)) c.rig.startStorm(); },
  },

  update(c) {
    if (!c.rig) c.rig = new SandbreakerRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
