import { every } from '../util.js';
import { PALS, hull, body, weather, mpoly, circ, armour, both, keyLight, hazard, core, lamp, vent, glowDot } from '../roster/art.js';
import { UrbanDevastatorRig } from './urbanDevastatorRig.js';

// GROUND — URBAN DEVASTATOR (armoured pursuit supercar), level 4 of the campaign.
//
// A real 3D vehicle on the Downtown Siege boulevard (urbanDevastatorRig.js +
// world/tank/urbanDevastatorModel.js + world/env/downtown.js): a colossal
// armoured supercar fleeing the pilot through the ruined city. It drives the
// shared road model — following the bends at the junctions, changing lanes by
// steering, choosing the left or right branch at the forks, drifting — while
// every weapon fires from its real mount:
//   twin rear cannons          REAR PURSUIT BARRAGE: alternating aimed streams, expanding fans
//   side rotary cannons        SIDEWINDER CROSSFIRE: deploy, sweep, crossing streams (lane change per volley)
//   missile pods               MISSILE PURSUIT: staggered pairs, smoke trails, limited guidance, late burst
//   the whole car              APEX DRIFT BARRAGE: telegraphed drift, outside gun fires along the arc
//   the whole car              ROADBLOCK BREAKER: smashes a barrier line, debris rains back down the road
//   rear turbine emitter       TURBINE DISCHARGE: spool, tracking warning beam, discharge, cool-down
//   rear + side guns           FULL-LANE SUPPRESSION: waves over five of six lanes, the gap walks
//   turbine + repair system    TURBO REPAIR OVERDRIVE: at low HP in the last phase, it boosts away and
//                              restores a limited amount of real HP (once), then CRITICAL PURSUIT
// Seven breakable parts (rear cannons, side cannons, missile pods, the turbine
// emitter); a broken part stays broken and its attacks stop. Without the
// turbine the discharge becomes a weak thruster vent and the repair is halved.
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

const MOUNTS = ['rearL', 'rearR', 'sideL', 'sideR', 'podL', 'podR', 'turbine'];
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ art (2D fallback, nose up)

function hullArt(ctx) {
  const pal = PALS.urban, meta = { lights: [], treads: [], stacks: [] };
  // Fat tyres at the corners.
  both((s) => {
    for (const [y, r] of [[-62, 13], [70, 16]]) { ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.roundRect(s * 70 - 9, y - r, 18, r * 2, 4); ctx.fill(); }
  });
  // Low wedge body: pointed nose at the top, broad haunches and the turbine at the bottom.
  const outline = [0, -112, 22, -100, 50, -60, 60, -10, 62, 40, 70, 64, 72, 100, 40, 112, 0, 112];
  meta.lights.push(...body(ctx, pal, outline, [-72, -112, 144, 224], 'urbandevastator', { vents: 2, hazards: 1, pipes: 1 }));
  weather(ctx, () => mpoly(ctx, outline), 0.3);
  // Canopy, spine, swept blades.
  ctx.beginPath(); ctx.ellipse(0, -20, 18, 34, 0, 0, TAU); ctx.fillStyle = '#0c1118'; ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,220,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.rect(-7, 16, 14, 60); armour(ctx, pal, -7, 7);
  both((s) => { ctx.beginPath(); ctx.moveTo(s * 58, -4); ctx.lineTo(s * 92, 14); ctx.lineTo(s * 90, 22); ctx.lineTo(s * 58, 40); ctx.closePath(); armour(ctx, pal, s * 58, s * 92); });
  // Rear wing, turbine, thrusters, taillights.
  ctx.beginPath(); ctx.rect(-70, 88, 140, 10); armour(ctx, pal, -70, 70);
  circ(ctx, 0, 100, 18); ctx.fillStyle = '#101418'; ctx.fill();
  circ(ctx, 0, 100, 13); ctx.strokeStyle = '#3ad8ff'; ctx.lineWidth = 2.5; ctx.stroke();
  core(ctx, pal, 0, 100, 5, '#ff8a3a');
  both((s) => {
    ctx.fillStyle = '#ff2a3a'; ctx.fillRect(s * 30 - (s > 0 ? 0 : 26), 106, 26, 3);
    for (const x of [44, 58]) { circ(ctx, s * x, 108, 4); ctx.fillStyle = '#0a0c10'; ctx.fill(); glowDot(ctx, s * x, 108, 2, 'rgba(80,220,255,1)'); }
    vent(ctx, pal, s * 24 - 10, 60, 20, 14, 0);
    hazard(ctx, pal, s * 52 - 8, 74, 16, 4);
  });
  keyLight(ctx, -100, -112, 100, 112, 1);
  both((s) => { lamp(ctx, s * 20, -98, '#ffffff', 1.4); meta.lights.push({ x: s * 20, y: -98, c: '#ffffff', ph: 0 }); });
  return meta;
}

function gunArt(ctx, w, h) {
  const pal = PALS.urban, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 3, h * 0.45, 6, h * 0.55); armour(ctx, pal, cx - 3, cx + 3);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h * 0.5, 4); armour(ctx, pal, 0, w);
  hazard(ctx, pal, 4, 4, w - 8, 3);
  keyLight(ctx, 0, 0, w, h);
}

function podArt(ctx, w, h) {
  const pal = PALS.urban;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 3); armour(ctx, pal, 0, w);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { circ(ctx, w * 0.25 + i * w * 0.25, h * 0.35 + j * h * 0.3, 2.6); ctx.fillStyle = '#0a0406'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'urban_devastator',
  name: 'URBAN DEVASTATOR',
  title: 'ARMOURED PURSUIT SUPERCAR',
  archetype: 'ground',
  sprite: 'b_devastator', scale: 1, r: 64, glow: [1, 0.3, 0.45], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_devastator', 200, 240, hull('b_devastator', hullArt));
    add('ud_gun', 24, 30, gunArt, 2.5);
    add('ud_pod', 30, 24, podArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: 100, r: 18, rgb: [1, 0.35, 0.5] },
    sites: [[-40, 60], [40, 70], [-30, -30], [36, 10], [0, 90], [-56, 20]],
  },
  parts: {
    rearL: mount('rear', 0, 'REAR CANNON', { sprite: 'ud_gun', r: 16, hp: 100, score: 7000, bd: 0.05 }),
    rearR: mount('rear', 1, 'REAR CANNON', { sprite: 'ud_gun', r: 16, hp: 100, score: 7000, bd: 0.05 }),
    sideL: mount('side', 0, 'SIDE CANNON', { sprite: 'ud_gun', r: 15, hp: 110, score: 7000, bd: 0.05 }),
    sideR: mount('side', 1, 'SIDE CANNON', { sprite: 'ud_gun', r: 15, hp: 110, score: 7000, bd: 0.05 }),
    podL: mount('pod', 0, 'MISSILE LAUNCHER', { sprite: 'ud_pod', r: 16, hp: 120, score: 8000, bd: 0.06 }),
    podR: mount('pod', 1, 'MISSILE LAUNCHER', { sprite: 'ud_pod', r: 16, hp: 120, score: 8000, bd: 0.06 }),
    turbine: mount('turbine', 0, 'TURBINE EMITTER', { sprite: 'ud_pod', r: 22, hp: 240, score: 12000, bd: 0.08, medals: 5 }),
  },
  desperation: { name: 'URBAN COLLAPSE' },

  // All five phase arenas are the same Downtown Siege city and road (env
  // downtown, one seed) in different moods: dusk siege, night financial
  // district, expressway collapse at sunset, burning boulevard, flooded core.
  // In campaign level mode the level arena stays up and phases only set mood.
  // move: { weave (lane-change rate), cornerDrift (drift through the sharp bends) }.
  // The last phase holds TURBO REPAIR (once, below 40 % of its HP, restoring 30 %
  // of it — halved without the turbine) and then CRITICAL PURSUIT.
  // Standard plays phases 1, 3, 5: together they contain all eight attacks.
  phases: [
    {
      name: 'PURSUIT BARRAGE', hp: 720, arena: 'ud_downtown_siege', transitionFx: 'flash',
      move: { weave: 0.45 }, parts: MOUNTS,
      patterns: ['rearBarrage', 'missileSlow'], musicLayer: 'ground_p1',
    },
    {
      name: 'LANE ASSAULT', hp: 770, arena: 'ud_collapsed_metro', transitionFx: 'screen_tear',
      move: { weave: 1 }, parts: MOUNTS,
      patterns: ['sidewinder', 'missiles', 'rearBarrageSlow'], musicLayer: 'ground_p2',
    },
    {
      name: 'APEX DRIFT', hp: 820, arena: 'ud_rail_yard', transitionFx: 'rockfall',
      move: { weave: 0.8, cornerDrift: true }, parts: MOUNTS,
      patterns: ['apexDrift', 'sidewinderSlow', 'roadblockSlow', 'rearBarrageSlow'], musicLayer: 'ground_p3',
    },
    {
      name: 'URBAN SUPPRESSION', hp: 860, arena: 'ud_tower_inferno', transitionFx: 'flash',
      move: { weave: 0.8, cornerDrift: true }, parts: MOUNTS,
      patterns: ['roadblock', 'suppression', 'missileSlow'], musicLayer: 'ground_p4',
    },
    {
      name: 'TURBINE OVERDRIVE', hp: 940, arena: 'ud_flooded_core', transitionFx: 'water_flood',
      move: { weave: 0.9, cornerDrift: true }, parts: MOUNTS, intensity: 1.1, overdrive: true,
      repairAt: 0.4, repairHeal: 0.3, repairs: 1,
      patterns: ['turbine', 'suppressionSlow', 'rearBarrageSlow', 'apexDriftSlow', 'critical'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    rearBarrage(c, w, t) { c.rig.rearBarrage(t, 1); },
    rearBarrageSlow(c, w, t) { if (!c.rig.critical && !c.rig.heavy) c.rig.rearBarrage(t, 0.55); },
    sidewinder(c, w, t) { if (every(c, t, 430, 60)) c.rig.startSidewinder(); },
    sidewinderSlow(c, w, t) { if (every(c, t, 640, 260)) c.rig.startSidewinder(2); },
    missiles(c, w, t) { if (every(c, t, 400, 200)) c.rig.startMissiles(); },
    missileSlow(c, w, t) { if (!c.rig.critical && every(c, t, 560, 300)) c.rig.startMissiles(4); },
    // Drift and roadblock need clear road (no fork, no junction): they retry until they get it.
    apexDrift(c, w, t) { if (c.data.drift || every(c, t, 380, 100)) c.data.drift = !c.rig.startDrift() && !c.rig.heavy; },
    apexDriftSlow(c, w, t) { if (!c.rig.critical && (c.data.drift || every(c, t, 700, 420))) c.data.drift = !c.rig.startDrift() && !c.rig.heavy; },
    roadblock(c, w, t) { if (c.data.block || every(c, t, 520, 150)) c.data.block = !c.rig.startRoadblock() && !c.rig.heavy; },
    roadblockSlow(c, w, t) { if (c.data.block || every(c, t, 760, 480)) c.data.block = !c.rig.startRoadblock() && !c.rig.heavy; },
    turbine(c, w, t) { if (!c.rig.critical && every(c, t, 600, 180)) c.rig.startTurbine(); },
    suppression(c, w, t) { if (every(c, t, 470, 60)) c.rig.startSuppression(); },
    suppressionSlow(c, w, t) { if (!c.rig.critical && every(c, t, 660, 400)) c.rig.startSuppression(3); },
    critical(c, w, t) { c.rig.overdrive(t); },
  },

  update(c) {
    if (!c.rig) c.rig = new UrbanDevastatorRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
