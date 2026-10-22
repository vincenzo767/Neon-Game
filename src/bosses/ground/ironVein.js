import { every } from '../util.js';
import { PALS, hull, body, weather, track, drill, mpoly, circ, armour, both, keyLight, hazard, core, lamp, pipe, turbine } from '../roster/art.js';
import { IronVeinRig } from './ironVeinRig.js';

// GROUND — IRON VEIN (open-pit mining war fortress), level 3 of the campaign.
//
// A real 3D machine in the Open-Pit Mine (ironVeinRig.js + world/tank/): a
// colossal tracked excavator built around a tilted rotary cutter head. It
// crawls forward in excavation passes with the cutter in the ground (leaving
// a trench and track ruts), backs up onto a new lane, and fights with
// mechanisms that all fire from their real positions on the model:
//   rotary cutter head            ROTARY CUTTER FAN: chips and fragments off the rim
//   two spoil conveyors           SPOIL CYCLONE: rotating ore streams from the heads
//   two ore cannons               ORE CANNON CROSSFIRE: telegraphed crossing lanes, bursting shells
//   cutter + hydraulics           SEISMIC FAULT LINES: cracks run down lanes, rock spikes erupt
//   drive hub (deep core)         DEEP-CORE BREACH: glowing fissures fan out and erupt
//   (the quarry benches)          QUARRY COLLAPSE: boulders break off the walls onto marked spots
//   the whole machine             BORE CHARGE: a real charge down a marked lane, cutting a trench
//   everything (low HP)           OVERDRIVE BARRAGE: the critical state of the last phase
// Five parts are breakable (ore cannons, conveyors, the cutter drive); a broken
// part stays broken and its attacks stop. Without the cutter drive the
// machine can't drill: no fan (the aux launchers take over), no bore charge,
// a weaker deep-core vent from the deck reactor, no trench.
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

const MOUNTS = ['oreL', 'oreR', 'convL', 'convR', 'cutter'];
const HEAD_Y = 112;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.mining, meta = { lights: [], treads: [], stacks: [] };
  // Six track units in three pairs (the fortress is long and heavy).
  for (const [y0, y1] of [[-118, -64], [-48, 10], [26, 84]]) both((s) => track(ctx, pal, meta, s > 0 ? 66 : -96, s > 0 ? 96 : -66, y0, y1));
  // Segmented body: three articulated sections joined by thrust rams.
  const sections = [[-118, -62], [-54, 12], [20, 84]];
  for (let i = 0; i < 3; i++) {
    const [y0, y1] = sections[i], hw = 64 - i * 2;
    const pts = [0, y0, hw - 8, y0, hw, y0 + 8, hw, y1 - 8, hw - 8, y1, 0, y1];
    const path = () => mpoly(ctx, pts);
    meta.lights.push(...body(ctx, pal, pts, [-hw, y0, hw * 2, y1 - y0], 'ironvein' + i, { vents: 2, hazards: 1, pipes: 2, lights: 2 }));
    weather(ctx, path, 0.5);
    hazard(ctx, pal, -hw + 4, y1 - 6, hw * 2 - 8, 4);
  }
  for (const y of [-58, 16]) both((s) => { pipe(ctx, pal, s * 30, y - 8, s * 30, y + 8, 4, false); pipe(ctx, pal, s * 50, y - 8, s * 50, y + 8, 3, false); });
  // Rear section: power plant with cooling fan and exhaust.
  turbine(ctx, pal, 0, -92, 18, 12);
  both((s) => { circ(ctx, s * 42, -104, 6); ctx.fillStyle = '#120c06'; ctx.fill(); meta.stacks.push([s * 42, -104]); });
  // Middle: ore hoppers glowing with heat.
  both((s) => {
    ctx.beginPath(); ctx.rect(s * 26 - 14, -44, 28, 40); armour(ctx, pal, s * 26 - 14, s * 26 + 14);
    ctx.fillStyle = '#2a1408'; ctx.fillRect(s * 26 - 10, -40, 20, 32);
    const g = ctx.createRadialGradient(s * 26, -24, 1, s * 26, -24, 16);
    g.addColorStop(0, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(120,30,0,0)');
    ctx.fillStyle = g; ctx.fillRect(s * 26 - 10, -40, 20, 32);
  });
  // Front section: cutter-head carrier and gripper shoes.
  both((s) => { ctx.beginPath(); ctx.rect(s * 70 - 6, 30, 12, 46); armour(ctx, pal, s * 70 - 6, s * 70 + 6); });
  // Cutter head: a full-width disc of disc cutters, plus the pilot drill.
  circ(ctx, 0, HEAD_Y - 12, 62); ctx.fillStyle = '#1a140c'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, HEAD_Y - 6, 70, 26, 0, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.rect(-70, HEAD_Y - 32, 140, 52); armour(ctx, { plate: ['#2a2622', '#8a8278', '#d8d0c4'], hi: 'rgba(255,255,255,0.4)' }, -70, 70, 2);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI; ctx.strokeStyle = 'rgba(20,16,10,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, HEAD_Y - 6); ctx.lineTo(Math.cos(a) * 72, HEAD_Y - 6 + Math.sin(a) * 26); ctx.stroke(); }
  for (let k = 0; k < 14; k++) { const x = -60 + k * 9.2, y = HEAD_Y - 6 + Math.sin(k * 1.7) * 10; circ(ctx, x, y, 3); ctx.fillStyle = '#c8c0b4'; ctx.fill(); ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.8; ctx.stroke(); }
  ctx.restore();
  drill(ctx, pal, 0, HEAD_Y - 2, 13, 26);
  keyLight(ctx, -110, -130, 110, 140, 1);
  core(ctx, pal, 0, -16, 8, '#ff8a1a');
  both((s) => { lamp(ctx, s * 58, 88, '#ffe0a0', 1.8); meta.lights.push({ x: s * 58, y: 88, c: '#ffe0a0', ph: s > 0 ? 0 : 0.5 }); });
  both((s) => { lamp(ctx, s * 60, -60, pal.light, 1.2); meta.lights.push({ x: s * 60, y: -60, c: '#ffa020', ph: 0.25 }); });
  return meta;
}

function cannonArt(ctx, w, h) {
  const pal = PALS.mining, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 3.5, h * 0.42, 7, h * 0.58); armour(ctx, pal, cx - 3.5, cx + 3.5);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h * 0.5, 4); armour(ctx, pal, 0, w);
  hazard(ctx, pal, 4, 4, w - 8, 3);
  keyLight(ctx, 0, 0, w, h);
}

function conveyorArt(ctx, w, h) {
  const pal = PALS.mining;
  ctx.beginPath(); ctx.rect(4, 2, w - 8, h - 4); armour(ctx, pal, 4, w - 4);
  ctx.fillStyle = '#1a120a'; ctx.fillRect(8, 4, w - 16, h - 8);
  ctx.strokeStyle = 'rgba(150,120,80,0.6)'; ctx.lineWidth = 1.4;
  for (let y = 6; y < h - 4; y += 4) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(w - 8, y); ctx.stroke(); }
  for (let k = 0; k < 5; k++) { circ(ctx, 12 + (k * 7) % (w - 22), 8 + k * 5, 2.5); ctx.fillStyle = '#7a5a3a'; ctx.fill(); }
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'iron_vein',
  name: 'IRON VEIN',
  title: 'OPEN-PIT MINING FORTRESS',
  archetype: 'ground',
  sprite: 'b_ironvein', scale: 1, r: 70, glow: [1, 0.55, 0.2], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_ironvein', 216, 272, hull('b_ironvein', hullArt));
    add('iv_cannon', 26, 32, cannonArt, 2.5);
    add('iv_conveyor', 40, 30, conveyorArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: -16, r: 18, rgb: [1, 0.55, 0.15] },
    sites: [[-36, -90], [30, -24], [-30, 50], [40, 60], [-70, -10], [70, -80]],
  },
  parts: {
    oreL: mount('ore', 0, 'ORE CANNON', { sprite: 'iv_cannon', r: 17, hp: 110, score: 7000, bd: 0.06 }),
    oreR: mount('ore', 1, 'ORE CANNON', { sprite: 'iv_cannon', r: 17, hp: 110, score: 7000, bd: 0.06 }),
    convL: mount('conv', 0, 'SPOIL CONVEYOR', { sprite: 'iv_conveyor', r: 18, hp: 120, score: 8000, bd: 0.06 }),
    convR: mount('conv', 1, 'SPOIL CONVEYOR', { sprite: 'iv_conveyor', r: 18, hp: 120, score: 8000, bd: 0.06 }),
    cutter: mount('cutter', 0, 'CUTTER DRIVE', { sprite: 'iv_cannon', r: 22, hp: 260, score: 12000, bd: 0.08, medals: 5 }),
  },
  desperation: { name: 'CRITICAL OVERDRIVE' },

  // move: { span (lateral range of the excavation passes) }. The last phase
  // turns into CRITICAL OVERDRIVE (the sixth stage) below 45 % of its HP.
  phases: [
    {
      name: 'CUTTER ENGAGEMENT', hp: 720, arena: 'iv_open_pit', transitionFx: 'flash',
      move: { span: 24 }, parts: MOUNTS,
      patterns: ['cutterFan', 'auxSlow'], musicLayer: 'ground_p1',
    },
    {
      name: 'SPOIL PROCESSING', hp: 770, arena: 'iv_mine_shaft', transitionFx: 'rockfall',
      move: { span: 28 }, parts: MOUNTS,
      patterns: ['spoilCyclone', 'cutterFanSlow'], musicLayer: 'ground_p2',
    },
    {
      name: 'ORE CANNON CROSSFIRE', hp: 820, arena: 'iv_magma_breach', transitionFx: 'rockfall',
      move: { span: 30 }, parts: MOUNTS,
      patterns: ['oreCrossfire', 'spoilCycloneSlow', 'boreCharge'], musicLayer: 'ground_p3',
    },
    {
      name: 'SEISMIC EXCAVATION', hp: 860, arena: 'iv_supply_tunnel', transitionFx: 'rockfall',
      move: { span: 30 }, parts: MOUNTS,
      patterns: ['seismicFaults', 'spoilCycloneSlow', 'cutterFanSlow'], musicLayer: 'ground_p4',
    },
    {
      name: 'DEEP-CORE BREACH', hp: 940, arena: 'iv_geothermal_plant', transitionFx: 'lava_flood',
      move: { span: 30 }, parts: MOUNTS, intensity: 1.1, overdrive: true,
      patterns: ['deepCore', 'quarryCollapse', 'oreCrossfireSlow', 'boreChargeSlow', 'overdrive'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    cutterFan(c, w, t) { c.rig.cutterFan(t, 1); },
    cutterFanSlow(c, w, t) { if (!c.rig.critical && c.rig.heavy !== 'seismic') c.rig.cutterFan(t, 0.6); },
    auxSlow(c, w, t) { c.rig.auxBurst(t, 0.45); },
    // The conveyors run in shifts (spin up, throw ore, run down) so the streams come in waves.
    spoilCyclone(c, w, t) { if (t % 420 < 270 && c.rig.heavy !== 'deepcore') c.rig.spoilCyclone(t, 1); },
    spoilCycloneSlow(c, w, t) { if (t % 560 < 220 && !c.rig.critical && !c.rig.heavy) c.rig.spoilCyclone(t, 0.6); },
    oreCrossfire(c, w, t) { if (every(c, t, 300, 60)) c.rig.startCrossfire(); },
    oreCrossfireSlow(c, w, t) { if (!c.rig.critical && every(c, t, 470, 200)) c.rig.startCrossfire(2); },
    seismicFaults(c, w, t) { if (every(c, t, 250, 50)) c.rig.startSeismic(); },
    deepCore(c, w, t) { if (!c.rig.critical && every(c, t, 560, 80)) c.rig.startDeepCore(); },
    quarryCollapse(c, w, t) { if (!c.rig.critical && every(c, t, 420, 300)) c.rig.startCollapse(); },
    boreCharge(c, w, t) { if (every(c, t, 460, 180)) c.rig.startBore(); },
    boreChargeSlow(c, w, t) { if (every(c, t, 700, 450)) c.rig.startBore(); },
    overdrive(c, w, t) { c.rig.overdrive(t); },
  },

  update(c) {
    if (!c.rig) c.rig = new IronVeinRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
