import { every } from '../util.js';
import { PALS, hull, body, camo, weather, track, turret, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot } from '../roster/art.js';
import { WhiteFangRig } from './whiteFangRig.js';

// GROUND — WHITE FANG (arctic siege tank), level 1 of the campaign.
//
// The tank is a real 3D vehicle in the Frozen Frontline arena world
// (whiteFangRig.js + world/tank/): it drives on its tracks, leaves tread
// prints, and every weapon fires from its own muzzle on the model:
//   twin railguns (turret)      RAIL LANCE: telegraphed beams
//   two frost-mortar pods       FROST SLUGS: ballistic shells, marked impacts, shard rings
//                               ICICLE SPIRAL: rotating streams (with the sensor launcher)
//   two side cannons            SHARD FAN: alternating fans along the barrels
//   ice-breaker ram             RAM CHARGE: telegraphed lane, a real charge down it
//   (terrain)                   AVALANCHE: a rolling snow wall with a safe gap
// The four mounts are breakable parts; a broken mount stays broken for the
// rest of the fight and its attacks stop.
//
// The 2D sprites below are only the fallback when no arena world is up.

const mount = (kind, side) => ({
  label: kind === 'mortar' ? 'FROST MORTAR' : 'SIDE CANNON',
  sprite: kind === 'mortar' ? 'wf_sled' : 'wf_cannon',
  mount: kind, side, free: true, quietClear: true,
  r: kind === 'mortar' ? 19 : 15, hp: kind === 'mortar' ? 110 : 90,
  medals: 3, score: kind === 'mortar' ? 7000 : 6000, bossDamage: kind === 'mortar' ? 0.07 : 0.06,
  skip: (c) => !!(c.rig && c.rig.isDestroyed(kind, side)),
  onSpawn: (pe, c) => c.rig && c.rig.partSpawned(kind, side, pe),
  onClear: (p, c) => c.rig && c.rig.partCleared(kind, side, p),
  onDown: (c) => c.rig && c.rig.partDestroyed(kind, side),
});

const MOUNTS = ['mortarL', 'mortarR', 'cannonL', 'cannonR'];

// ------------------------------------------------------------------ 2D fallback art

function hullArt(ctx) {
  const pal = PALS.arctic, meta = { lights: [], treads: [], stacks: [] };
  both((s) => { track(ctx, pal, meta, s > 0 ? 70 : -102, s > 0 ? 102 : -70, -108, -10); track(ctx, pal, meta, s > 0 ? 70 : -102, s > 0 ? 102 : -70, 4, 98); });
  both((s) => { ctx.beginPath(); ctx.rect(s > 0 ? 62 : -72, -112, 10, 214); armour(ctx, pal, -72, 72); rivetRow(ctx, pal, s * 67, -106, s * 67, 96, 6); });
  const outline = [0, -118, 44, -116, 62, -96, 64, 60, 52, 92, 30, 108, 0, 112];
  const path = () => mpoly(ctx, outline);
  meta.lights.push(...body(ctx, pal, outline, [-64, -118, 128, 230], 'whitefang', { vents: 4, hazards: 1 }));
  camo(ctx, path, ['#5a6672', '#8e9aa8', '#dfe6ee', '#3a434e'], 7, 30, 20);
  weather(ctx, path, 0.25);
  const ram = () => mpoly(ctx, [0, 104, 48, 100, 70, 112, 60, 122, 0, 130]);
  ram(); armour(ctx, { plate: ['#2a3038', '#9aa6b4', '#f2f6fa'] }, -70, 70);
  ctx.fillStyle = '#d8e0ea';
  for (let x = -60; x <= 60; x += 10) { poly(ctx, [x - 4, 122, x + 4, 122, x, 132]); ctx.fill(); }
  ctx.beginPath(); ctx.rect(-40, -112, 80, 34); armour(ctx, pal, -40, 40);
  vent(ctx, pal, -32, -108, 64, 10, 0.4, false);
  both((s) => { circ(ctx, s * 24, -88, 7); ctx.fillStyle = '#1a1e22'; ctx.fill(); meta.stacks.push([s * 24, -88]); });
  both((s) => { ctx.beginPath(); ctx.rect(s * 62 - 14, -76, 28, 30); armour(ctx, pal, s * 62 - 14, s * 62 + 14); hazard(ctx, pal, s * 62 - 14, -50, 28, 4); });
  for (const ox of [-9, 9]) {
    ctx.beginPath(); ctx.rect(ox - 3, 6, 6, 104); armour(ctx, pal, ox - 3, ox + 3);
    for (let y = 22; y < 104; y += 12) { ctx.fillStyle = '#2a323c'; ctx.fillRect(ox - 4.2, y, 8.4, 3); }
    ctx.fillStyle = '#050608'; ctx.fillRect(ox - 1.6, 106, 3.2, 4);
  }
  turret(ctx, pal, 0, 4, 30, 0);
  circ(ctx, 0, 4, 18); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  both((s) => { ctx.beginPath(); ctx.rect(s * 40 - 7, 18, 14, 18); armour(ctx, pal, s * 40 - 7, s * 40 + 7); });
  keyLight(ctx, -110, -130, 110, 130, 1);
  core(ctx, pal, 0, -28, 7, '#7ad0ff');
  for (const ox of [-9, 9]) glowDot(ctx, ox, 104, 3, 'rgba(140,220,255,1)');
  both((s) => { lamp(ctx, s * 54, 100, pal.light, 1.4); meta.lights.push({ x: s * 54, y: 100, c: pal.light, ph: s > 0 ? 0 : 0.5 }); });
  return meta;
}

function sledArt(ctx, w, h) {
  const pal = PALS.arctic, cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 4); armour(ctx, pal, 0, w);
  for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 6], [6, 6]]) { circ(ctx, cx + ox, cy + oy, 4); ctx.fillStyle = '#0a0d10'; ctx.fill(); }
  hazard(ctx, pal, 4, h - 6, w - 8, 3);
  keyLight(ctx, 0, 0, w, h);
  for (const [ox, oy] of [[-6, -5], [6, -5]]) glowDot(ctx, cx + ox, cy + oy, 2, 'rgba(140,220,255,1)');
}

function cannonArt(ctx, w, h) {
  const pal = PALS.arctic, cx = w / 2;
  ctx.beginPath(); ctx.rect(cx - 2.5, h * 0.4, 5, h * 0.6); armour(ctx, pal, cx - 2.5, cx + 2.5);
  circ(ctx, cx, h * 0.38, w * 0.38); armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

// ------------------------------------------------------------------ boss

export default {
  id: 'white_fang',
  name: 'WHITE FANG',
  title: 'ARCTIC SIEGE TANK',
  archetype: 'ground',
  sprite: 'b_whitefang', scale: 1, r: 86, glow: [0.6, 0.9, 1], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_whitefang', 220, 268, hull('b_whitefang', hullArt));
    add('wf_sled', 28, 30, sledArt, 2.5);
    add('wf_cannon', 26, 30, cannonArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: 22, r: 14, rgb: [0.5, 0.85, 1] },
    sites: [[-40, -80], [44, -20], [-20, 70], [38, 74], [-80, -60], [80, 40]],
  },
  parts: {
    mortarL: mount('mortar', 0), mortarR: mount('mortar', 1),
    cannonL: mount('cannon', 0), cannonR: mount('cannon', 1),
  },
  desperation: { name: 'WHITEOUT' },

  phases: [
    {
      name: 'RAIL LANCE', hp: 720, arena: 'wf_frozen_frontline', transitionFx: 'flash',
      move: { span: 70 }, parts: MOUNTS,
      patterns: ['railLance', 'frostSlugs'], musicLayer: 'ground_p1',
    },
    {
      name: 'ICICLE STORM', hp: 770, arena: 'wf_ice_canyon', transitionFx: 'ice_crack',
      move: { span: 95 }, parts: MOUNTS,
      patterns: ['icicleSpiral', 'shardFan', 'railAlt'], musicLayer: 'ground_p2',
    },
    {
      name: 'RAM CHARGE', hp: 810, arena: 'wf_research_facility', transitionFx: 'screen_tear',
      move: { span: 80 }, parts: MOUNTS,
      patterns: ['ramCharge', 'shardFan'], musicLayer: 'ground_p3',
    },
    {
      name: 'AVALANCHE', hp: 860, arena: 'wf_glacial_chasm', transitionFx: 'ice_crack',
      move: { span: 90 }, parts: MOUNTS,
      patterns: ['avalanche', 'frostSlugs', 'shardFanSlow'], musicLayer: 'ground_p4',
    },
    {
      name: 'FROZEN FURY', hp: 940, arena: 'wf_avalanche_field', transitionFx: 'cloud_burst',
      move: { span: 100 }, parts: MOUNTS, intensity: 1.1,
      patterns: ['railAlt', 'shardFan', 'ramCharge', 'avalanche', 'frostSlugsSlow'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    railLance(c, w, t) { if (every(c, t, 210, 20)) c.rig.startRail('both'); },
    railAlt(c, w, t) { if (every(c, t, 170, 60)) c.rig.startRail('alt'); },
    frostSlugs(c, w, t) { if (every(c, t, 150, 90)) c.rig.mortarVolley(); },
    frostSlugsSlow(c, w, t) { if (every(c, t, 260, 150)) c.rig.mortarVolley(); },
    icicleSpiral(c, w, t) { c.rig.spiral(t); },
    shardFan(c, w, t) { c.rig.cannonVolley(t); },
    // Half rate, and silent while an avalanche is rolling.
    shardFanSlow(c, w, t) { if (!c.rig.walls.length && t % 2 === 0) c.rig.cannonVolley(t / 2); },
    ramCharge(c, w, t) { if (every(c, t, 420, 140)) c.rig.startRam(); },
    avalanche(c, w, t) { if (every(c, t, 330, 40)) c.rig.startAvalanche(); },
  },

  update(c) {
    if (!c.rig) c.rig = new WhiteFangRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
