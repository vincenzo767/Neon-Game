import { every } from '../util.js';
import { PALS, hull, body, weather, mpoly, circ, armour, both, keyLight, hazard, core, lamp, vent } from '../roster/art.js';
import { ColossusCrawlerRig } from './colossusCrawlerRig.js';

// GROUND — COLOSSUS CRAWLER (eight-legged apocalypse engine), the MAIN BOSS
// of the ground campaign (level 5), Ironclad Brotherhood.
//
// A real 3D machine on the Burning Overpass (colossusCrawlerRig.js +
// world/tank/colossusCrawlerModel.js + world/env/overpass.js / overpassMap.js):
// eight IK legs on a planted tetrapod gait, climbing the structures beside the
// highway, leaping between them, evading the pilot's ultimate, repairing on a
// rooftop, and — below 50 % HP — trying to crush the pilot under its chassis.
// Every weapon fires from its real mount:
//   twin heavy cannons      SIEGE CORE BARRAGE: wind-up, staggered shells, last-seen / predicted aim
//   rotaries + battery      CRIMSON FLAK STORM: flank sweeps, magenta fans with gaps, leg-gun kunai
//   mortars                 ARTILLERY COLLAPSE: real 3D shells onto marked road zones
//   all systems             EIGHTFOLD SUPPRESSION: coordinated windows, two lanes always free
//   the legs                CATACLYSMIC FOOTFALL: marked stamps, shockwave rings, it bears down the road
//   the legs                VERTICAL BREACH: climbs a structure and fights from the roof
//   the legs                AERIAL SIEGE LEAP: crouch, launch, marked landing, shockwave
//   the AI                  ADAPTIVE EVASION PROTOCOL: leaps off-screen from an ultimate, scuttles from bombs / beams
//   repair system           SIEGE RECLAMATION: rooftop repair, real capped healing (overload / core loss cut it short)
//   the whole machine       APOCALYPSE EXECUTION LEAP: unlocks at 50 % HP; lethal only inside the zone at impact
//   all systems             FINAL CATACLYSM: after the repair, rolling windows + short hops
// Seventeen breakable parts: 2 heavy cannons, 2 rotaries, 2 missile pods,
// 2 mortars, the core emitter and all 8 legs (a broken leg limps).
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

const TAU = Math.PI * 2;
const WEAPONS = ['hcL', 'hcR', 'rotL', 'rotR', 'podL', 'podR', 'mortL', 'mortR', 'core'];
const LEGS = ['leg0', 'leg1', 'leg2', 'leg3', 'leg4', 'leg5', 'leg6', 'leg7'];
const ALL = [...WEAPONS, ...LEGS];

// ------------------------------------------------------------------ art (2D fallback, front down)

function hullArt(ctx) {
  const pal = PALS.steel, meta = { lights: [], treads: [], stacks: [] };
  // Eight legs: femur out to a high knee, tibia down to the foot.
  both((s) => {
    for (const [hy, kx, ky, fx, fy] of [[60, 120, 90, 150, 150], [20, 140, 34, 190, 60], [-20, 140, -34, 190, -60], [-60, 120, -90, 150, -150]]) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(s * 60, hy); ctx.lineTo(s * kx, ky); ctx.stroke();
      ctx.strokeStyle = '#1d2025'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(s * kx, ky); ctx.lineTo(s * fx, fy); ctx.stroke();
      circ(ctx, s * kx, ky, 10); ctx.fillStyle = '#3a3e45'; ctx.fill();
      circ(ctx, s * fx, fy, 9); ctx.fillStyle = '#15171a'; ctx.fill();
      lamp(ctx, s * kx, ky - 4, '#ff2a2a', 1);
    }
  });
  meta.lights.push(...body(ctx, pal, [0, 128, 44, 116, 64, 70, 66, -60, 50, -110, 0, -122, -50, -110, -66, -60, -64, 70, -44, 116], [-70, -126, 140, 254], 'colossuscrawler', { vents: 2, hazards: 2, pipes: 2 }));
  weather(ctx, () => mpoly(ctx, [0, 128, 44, 116, 64, 70, 66, -60, 50, -110, 0, -122, -50, -110, -66, -60, -64, 70, -44, 116]), 0.3);
  // Core housing and eye (front = +y = down the screen).
  ctx.beginPath(); ctx.rect(-22, 70, 44, 60); armour(ctx, pal, -22, 22);
  core(ctx, pal, 0, 128, 9, '#ff3030');
  circ(ctx, 0, 128, 14); ctx.strokeStyle = '#3ad8ff'; ctx.lineWidth = 2; ctx.stroke();
  both((s) => {
    ctx.beginPath(); ctx.rect(s * 50 - 7, 70, 14, 70); armour(ctx, pal, s * 50 - 7, s * 50 + 7);  // heavy cannons
    circ(ctx, s * 50, 140, 7); ctx.fillStyle = '#ff4020'; ctx.fill();
    ctx.beginPath(); ctx.rect(s * 42 - 14, -66, 28, 32); armour(ctx, pal, s * 42 - 14, s * 42 + 14); // pods
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { circ(ctx, s * 42 - 9 + i * 6, -58 + j * 12, 2.2); ctx.fillStyle = '#ff2020'; ctx.fill(); }
    vent(ctx, pal, s * 30 - 10, -10, 20, 14, 0);
    hazard(ctx, pal, s * 40 - 10, 100, 20, 4);
  });
  keyLight(ctx, -200, -170, 200, 170, 1);
  return meta;
}

function gunArt(ctx, w, h) {
  const pal = PALS.steel, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 3, h * 0.45, 6, h * 0.55); armour(ctx, pal, cx - 3, cx + 3);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h * 0.5, 4); armour(ctx, pal, 0, w);
  hazard(ctx, pal, 4, 4, w - 8, 3);
  keyLight(ctx, 0, 0, w, h);
}

function jointArt(ctx, w, h) {
  const pal = PALS.steel;
  circ(ctx, w / 2, h / 2, w / 2 - 2); armour(ctx, pal, 0, w);
  circ(ctx, w / 2, h / 2, 3); ctx.fillStyle = '#ff2020'; ctx.fill();
  void TAU;
}

export default {
  id: 'colossus_crawler',
  name: 'COLOSSUS CRAWLER',
  title: 'EIGHT-LEGGED APOCALYPSE ENGINE',
  archetype: 'ground',
  sprite: 'b_cc8', scale: 1, r: 62, glow: [1, 0.3, 0.2], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_cc8', 420, 340, hull('b_cc8', hullArt));
    add('cc_gun', 24, 30, gunArt, 2.5);
    add('cc_joint', 26, 26, jointArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: 110, r: 20, rgb: [1, 0.25, 0.2] },
    sites: [[-40, 60], [40, 70], [-30, -30], [36, 10], [0, 90], [-56, 20]],
  },
  parts: {
    hcL: mount('hc', 0, 'HEAVY CANNON', { sprite: 'cc_gun', r: 17, hp: 120, score: 8000, bd: 0.05 }),
    hcR: mount('hc', 1, 'HEAVY CANNON', { sprite: 'cc_gun', r: 17, hp: 120, score: 8000, bd: 0.05 }),
    rotL: mount('rot', 0, 'ROTARY CANNON', { sprite: 'cc_gun', r: 14, hp: 100, score: 7000, bd: 0.04 }),
    rotR: mount('rot', 1, 'ROTARY CANNON', { sprite: 'cc_gun', r: 14, hp: 100, score: 7000, bd: 0.04 }),
    podL: mount('pod', 0, 'MISSILE POD', { sprite: 'cc_gun', r: 15, hp: 110, score: 7000, bd: 0.04 }),
    podR: mount('pod', 1, 'MISSILE POD', { sprite: 'cc_gun', r: 15, hp: 110, score: 7000, bd: 0.04 }),
    mortL: mount('mort', 0, 'MORTAR', { sprite: 'cc_gun', r: 14, hp: 110, score: 7000, bd: 0.04 }),
    mortR: mount('mort', 1, 'MORTAR', { sprite: 'cc_gun', r: 14, hp: 110, score: 7000, bd: 0.04 }),
    core: mount('core', 0, 'SIEGE CORE EMITTER', { sprite: 'cc_joint', r: 20, hp: 260, score: 15000, bd: 0.08, medals: 5 }),
    ...Object.fromEntries(LEGS.map((n, i) => [n, mount('leg', i, 'LEG ACTUATOR', { sprite: 'cc_joint', r: 13, hp: 150, score: 5000, bd: 0.03, medals: 2 })])),
  },
  desperation: { name: 'SCORCHED EARTH' },

  // All five arenas are the Burning Overpass (env overpass, one map) in five
  // moods; in campaign level mode the level arena stays up and phases only set mood.
  // move: { speed (crawl, units/step), wander (repositioning rate), evade (adaptive evasion on) }.
  // The 50 % execution leap is gated by the boss's total HP (any phase).
  // The last phase holds SIEGE RECLAMATION (once, below 45 % of its HP, restoring
  // 30 % of it — halved without the core emitter) and then FINAL CATACLYSM.
  // Standard plays phases 1, 3, 5: together they contain all eleven abilities.
  phases: [
    {
      name: 'AWAKENING OF THE COLOSSUS', hp: 760, arena: 'cc_burning_overpass', transitionFx: 'flash',
      move: { speed: 1.5, wander: 0.8 }, parts: ALL,
      patterns: ['siegeBarrage', 'flakSlow'], musicLayer: 'ground_p1',
    },
    {
      name: 'CRIMSON SIEGE', hp: 800, arena: 'cc_tunnel_collapse', transitionFx: 'screen_tear',
      move: { speed: 1.7, wander: 1 }, parts: ALL,
      patterns: ['flak', 'artillery', 'siegeBarrageSlow', 'missilesSlow'], musicLayer: 'ground_p2',
    },
    {
      name: 'EIGHTFOLD ADVANCE', hp: 840, arena: 'cc_scrapyard_sunset', transitionFx: 'rockfall',
      move: { speed: 2.4, wander: 1.4 }, parts: ALL,
      patterns: ['footfall', 'suppressionSlow', 'artillerySlow', 'flakSlow', 'siegeBarrageSlow', 'climbSlow'], musicLayer: 'ground_p3',
    },
    {
      name: 'VERTICAL BREACH', hp: 880, arena: 'cc_molten_floor', transitionFx: 'lava_flood',
      move: { speed: 2.4, wander: 1.2, evade: true }, parts: ALL,
      patterns: ['climb', 'hopSlow', 'core', 'flakSlow', 'missiles', 'siegeBarrageSlow'], musicLayer: 'ground_p4',
    },
    {
      name: 'APOCALYPSE ENGINE', hp: 960, arena: 'cc_ash_siege_field', transitionFx: 'flash',
      move: { speed: 2.6, wander: 1.4, evade: true }, parts: ALL, intensity: 1.1, final: true,
      repairAt: 0.45, repairHeal: 0.3, repairs: 1,
      patterns: ['core', 'suppression', 'footfallSlow', 'artillerySlow', 'flakSlow', 'siegeBarrageSlow', 'climbSlow', 'cataclysm'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    siegeBarrage(c, w, t) { c.rig.siegeBarrage(t, 1); },
    siegeBarrageSlow(c, w, t) { if (!c.rig.critical && !c.rig.heavy) c.rig.siegeBarrage(t, 0.6); },
    flak(c, w, t) { if (every(c, t, 420, 60)) c.rig.startFlak(); },
    flakSlow(c, w, t) { if (!c.rig.critical && every(c, t, 640, 300)) c.rig.startFlak(2); },
    artillery(c, w, t) { if (every(c, t, 400, 160)) c.rig.startArtillery(); },
    artillerySlow(c, w, t) { if (!c.rig.critical && every(c, t, 640, 360)) c.rig.startArtillery(4); },
    missiles(c, w, t) { if (every(c, t, 460, 230)) c.rig.startMissiles(); },
    missilesSlow(c, w, t) { if (!c.rig.critical && every(c, t, 620, 420)) c.rig.startMissiles(4); },
    suppression(c, w, t) { if (!c.rig.critical && every(c, t, 560, 100)) c.rig.startSuppression(); },
    suppressionSlow(c, w, t) { if (every(c, t, 760, 480)) c.rig.startSuppression(); },
    footfall(c, w, t) { if (every(c, t, 540, 140)) c.rig.startFootfall(); },
    footfallSlow(c, w, t) { if (!c.rig.critical && every(c, t, 820, 560)) c.rig.startFootfall(); },
    core(c, w, t) { if (!c.rig.critical && every(c, t, 640, 260)) c.rig.startCore(); },
    // Tactics the AI takes when it is free to (it may hold them back to keep its evasion ready).
    climb(c, w, t) { if (every(c, t, 720, 200)) c.rig.req = 'climb'; },
    climbSlow(c, w, t) { if (!c.rig.critical && every(c, t, 1100, 620)) c.rig.req = 'climb'; },
    hopSlow(c, w, t) { if (every(c, t, 600, 450) && !c.rig.req) c.rig.req = 'hop'; },
    cataclysm(c, w, t) { c.rig.cataclysm(t); },
  },

  update(c) {
    if (!c.rig) c.rig = new ColossusCrawlerRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
