import { every } from '../util.js';
import { PALS, hull, shipHull, circ, armour, both, keyLight, hazard, core, glowDot, weather } from '../roster/art.js';
import { CoralSiegeRig } from './coralSiegeRig.js';

// SEA — CORAL SIEGE (dreadnought-class coastal-assault battleship), level 2-1,
// the first naval boss, Ironclad Brotherhood.
//
// A real 3D battleship in the Lagoon Anchorage (coralSiegeRig.js +
// world/tank/coralSiegeModel.js + world/env/lagoon.js / lagoonMap.js). It
// steams bow-first down the winding channel toward the pilot — accelerating,
// turning, heeling, ploughing a bow wave and leaving a curved wake — while
// every weapon fires from its real mount:
//   main turrets A / B / C     TRIPLE-GUN SALVO: train, aim lines, barrels fire in turn (recoil, blast on the
//                              water); air-burst rounds or plunging shells onto marked impact zones
//   wing turrets + twins       CRIMSON BROADSIDE: trained abeam, staggered volleys, fans walking forward
//   six CIWS gatlings          ANTI-AIR SATURATION: aimed bursts, sweeps and lanes with corridors
//   two VLS batteries          HARBORBREAKER MISSILE SALVO: doors open, cold launch, guided / curving missiles
//   ASW rocket launchers       DEPTH CHARGE RING: charges splash in round the pilot, sink, detonate (rings)
//   the whole ship             TIDAL WAKE BARRAGE: flank speed and an S-turn, batteries firing abeam
//   main turrets               COASTAL BOMBARDMENT: shells the shore installations (they burn from then on),
//                              then walks impacts from the shore into the corridor
//   the squall                 MONSOON SCREEN: rain, heavier sea, lightning, wind-bent gatling streams
//   engines + all systems      DREADNOUGHT OVERDRIVE (final phase, below 62 % of it): faster, harder turns
//   all surviving systems      SCORCHED REEF (below 30 % / the desperation phase): rolling windows, deck fires
// Eight breakable parts: the three main turrets, the two secondary groups
// (twin mount + its side's three gatlings), the two VLS batteries and the
// bridge (fire control: without it aimed fire stops leading the pilot).
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

const PARTS = ['turA', 'turB', 'turC', 'secL', 'secR', 'vlsL', 'vlsR', 'bridge'];
const HL = 160, HW = 62;

// ------------------------------------------------------------------ art (2D fallback, bow down)

function hullArt(ctx) {
  const pal = PALS.coastal, meta = { lights: [], treads: [], stacks: [], hw: HW, hl: HL, funnels: [] };
  const { path, lights } = shipHull(ctx, pal, HL * 2, HW * 2, 'coralsiege');
  meta.lights.push(...lights);
  weather(ctx, path, 0.45);
  // Wing sponsons with their turrets' barbettes.
  both((s) => { ctx.beginPath(); ctx.moveTo(s * 40, -60); ctx.lineTo(s * 74, -50); ctx.lineTo(s * 74, 40); ctx.lineTo(s * 40, 60); ctx.closePath(); armour(ctx, pal, s * 40, s * 74); circ(ctx, s * 58, 30, 14); armour(ctx, pal, s * 44, s * 72); });
  ctx.beginPath(); ctx.rect(-26, -110, 52, 60); armour(ctx, pal, -26, 26, 2);
  ctx.beginPath(); ctx.rect(-16, -96, 32, 30); armour(ctx, pal, -16, 16);
  for (const y of [100]) { circ(ctx, 0, y, 21); armour(ctx, pal, -21, 21); }
  hazard(ctx, pal, -HW * 0.6, -150, HW * 1.2, 3);
  keyLight(ctx, -90, -180, 90, 180, 1);
  core(ctx, pal, 0, -60, 6, '#ff5a3a');
  both((s) => { glowDot(ctx, s * (HW - 4), 0, 2.4, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * (HW - 4), y: 0, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  return meta;
}

function turretArt(ctx, w, h) {
  const pal = PALS.coastal, cx = w / 2, cy = h * 0.36;
  for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.rect(cx + dx - 1.5, cy, 3, h * 0.64); armour(ctx, pal, cx + dx - 1.5, cx + dx + 1.5); }
  ctx.beginPath(); ctx.moveTo(cx - w * 0.45, cy - h * 0.28); ctx.lineTo(cx + w * 0.45, cy - h * 0.28); ctx.lineTo(cx + w * 0.42, cy + h * 0.1); ctx.lineTo(cx - w * 0.42, cy + h * 0.1); ctx.closePath();
  armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

function boxArt(ctx, w, h) {
  const pal = PALS.coastal;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 3); armour(ctx, pal, 0, w);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { circ(ctx, w * 0.33 + i * w * 0.34, h * 0.25 + j * h * 0.25, 2.4); ctx.fillStyle = '#0a0406'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'coral_siege',
  name: 'CORAL SIEGE',
  title: 'DREADNOUGHT COASTAL-ASSAULT BATTLESHIP',
  archetype: 'sea',
  sprite: 'b_coralsiege', scale: 1, r: 64, glow: [1, 0.55, 0.35], score: 150000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_coralsiege', 150, 350, hull('b_coralsiege', hullArt));
    add('cs_turret', 34, 40, turretArt, 2.5);
    add('cs_box', 24, 30, boxArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: -60, r: 16, rgb: [1, 0.45, 0.3] },
    sites: [[-40, 20], [40, -40], [-20, 120], [24, -120], [-44, -80], [44, 90]],
  },
  parts: {
    turA: mount('main', 0, 'A TURRET', { sprite: 'cs_turret', r: 26, hp: 260, score: 12000, bd: 0.06, medals: 5 }),
    turB: mount('main', 1, 'B TURRET', { sprite: 'cs_turret', r: 26, hp: 240, score: 12000, bd: 0.06, medals: 5 }),
    turC: mount('main', 2, 'C TURRET', { sprite: 'cs_turret', r: 26, hp: 240, score: 12000, bd: 0.06, medals: 5 }),
    secL: mount('sec', 0, 'PORT SECONDARY BATTERY', { sprite: 'cs_box', r: 17, hp: 160, score: 8000, bd: 0.04 }),
    secR: mount('sec', 1, 'STARBOARD SECONDARY BATTERY', { sprite: 'cs_box', r: 17, hp: 160, score: 8000, bd: 0.04 }),
    vlsL: mount('vls', 0, 'PORT MISSILE BATTERY', { sprite: 'cs_box', r: 21, hp: 200, score: 9000, bd: 0.05 }),
    vlsR: mount('vls', 1, 'STARBOARD MISSILE BATTERY', { sprite: 'cs_box', r: 21, hp: 200, score: 9000, bd: 0.05 }),
    bridge: mount('bridge', 0, 'COMMAND BRIDGE', { sprite: 'cs_box', r: 30, hp: 380, score: 15000, bd: 0.08, medals: 6 }),
  },
  desperation: { name: 'SCORCHED REEF' },

  // All five phase arenas are the same Lagoon Anchorage (env lagoon, one seed)
  // in different moods; in campaign level mode the level arena stays up and
  // phases only set mood (the Monsoon squall is drawn by the rig either way).
  // move: { speed (advance, world units / step), weave (lane-change rate) }.
  // The final phase escalates on its own HP: DREADNOUGHT OVERDRIVE below
  // `overdriveAt`, SCORCHED REEF below `criticalAt` (Hell's desperation phase
  // starts there). Standard plays phases 1, 3, 5: together they contain all
  // ten abilities.
  phases: [
    {
      name: 'OPENING SALVO', hp: 760, arena: 'cs_tropical_harbor', transitionFx: 'flash',
      move: { speed: 0.62, weave: 0.45 }, parts: PARTS,
      patterns: ['salvo', 'aaLight', 'secLight', 'broadsideLight'], musicLayer: 'sea_p1',
    },
    {
      name: 'CRIMSON BROADSIDE', hp: 800, arena: 'cs_reef_shallows', transitionFx: 'water_flood',
      move: { speed: 0.72, weave: 0.8 }, parts: PARTS,
      patterns: ['broadside', 'tidal', 'salvoSlow', 'aaLight'], musicLayer: 'sea_p2',
    },
    {
      name: 'HARBORBREAKER', hp: 840, arena: 'cs_island_beachhead', transitionFx: 'flash',
      move: { speed: 0.7, weave: 0.6 }, parts: PARTS,
      patterns: ['missiles', 'aaSat', 'depthSlow', 'tidalSlow', 'secLight'], musicLayer: 'sea_p3',
    },
    {
      name: 'DEPTH CHARGE ASSAULT', hp: 880, arena: 'cs_lagoon_anchorage', transitionFx: 'water_flood',
      move: { speed: 0.66, weave: 0.6 }, parts: PARTS,
      patterns: ['depth', 'coastal', 'broadsideSlow', 'missilesSlow', 'aaLight'], musicLayer: 'sea_p4',
    },
    {
      name: 'MONSOON SCREEN', hp: 980, arena: 'cs_monsoon_strait', transitionFx: 'water_flood',
      move: { speed: 0.78, weave: 0.7 }, parts: PARTS, intensity: 1.08,
      final: true, overdriveAt: 0.62, criticalAt: 0.3,
      patterns: ['monsoon', 'salvoFinal', 'coastalFinal', 'tidalFinal', 'overdrive', 'scorched'], musicLayer: 'sea_p5',
    },
  ],

  attacks: {
    salvo(c, w, t) { if (every(c, t, 430, 40)) c.rig.startSalvo(); },
    salvoSlow(c, w, t) { if (every(c, t, 700, 330)) c.rig.startSalvo(); },
    salvoFinal(c, w, t) { if (!c.rig.overdrive && every(c, t, 520, 90)) c.rig.startSalvo(); },
    broadside(c, w, t) { if (every(c, t, 470, 140)) c.rig.startBroadside(); },
    broadsideLight(c, w, t) { if (every(c, t, 760, 520)) c.rig.startBroadside(3); },
    broadsideSlow(c, w, t) { if (every(c, t, 820, 640)) c.rig.startBroadside(4); },
    aaSat(c, w, t) { if (every(c, t, 640, 260)) c.rig.startAA(); },
    aaLight(c, w, t) { c.rig.aaLight(t, 1); },
    secLight(c, w, t) { c.rig.secLight(t, 1); },
    missiles(c, w, t) { if (every(c, t, 460, 70)) c.rig.startMissiles(); },
    missilesSlow(c, w, t) { if (every(c, t, 780, 560)) c.rig.startMissiles(6); },
    depth(c, w, t) { if (every(c, t, 430, 50)) c.rig.startDepth(c.mk >= 2 || (t / 430 | 0) % 2 === 1); },
    depthSlow(c, w, t) { if (every(c, t, 820, 620)) c.rig.startDepth(false); },
    tidal(c, w, t) { if (every(c, t, 860, 420)) c.rig.startTidal(); },
    tidalSlow(c, w, t) { if (every(c, t, 1100, 760)) c.rig.startTidal(); },
    tidalFinal(c, w, t) { if (!c.rig.overdrive && every(c, t, 900, 600)) c.rig.startTidal(); },
    // Coastal bombardment needs installations in view: it retries until it gets some.
    coastal(c, w, t) { if (c.data.coast || every(c, t, 620, 220)) c.data.coast = !c.rig.startCoastal() && !c.rig.heavy; },
    coastalFinal(c, w, t) { if (!c.rig.overdrive && (c.data.coast || every(c, t, 760, 380))) c.data.coast = !c.rig.startCoastal() && !c.rig.heavy; },
    monsoon(c, w, t) { c.rig.startMonsoon(); if (!c.rig.overdrive) c.rig.stormFire(t); },
    overdrive(c, w, t) { c.rig.overdriveTick(t); },
    scorched(c, w, t) { c.rig.scorched(t); },
  },

  update(c) {
    if (!c.rig) c.rig = new CoralSiegeRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
