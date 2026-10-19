import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W, H } from '../util.js';
import { PALS, hull, body, camo, weather, track, turret, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot } from '../roster/art.js';

// GROUND — WHITE FANG (arctic siege tank)
// A long, low wedge on four tracks with an ice-breaker ram, twin railguns on
// a central turret and frost-mortar sleds riding the rear deck. Fights along
// a frozen front, down an ice canyon, through a research station, over a
// crevassed glacier and finally in an avalanche field.
// Signature: telegraphed railgun lances, frost mortars whose impact zones
// shatter into shard rings, ram charges down a marked lane.

const S = {
  shard: { shape: 'kunai', color: 'blue', n: 5, spread: 0.55, speed: 3.4 },
  shardMk: { shape: 'kunai', color: 'cyan', n: 3, spread: 0.25, speed: 4.4 },
  frost: { shape: 'rice', color: 'cyan', n: 12, speed: 1.6 },
  icicle: { shape: 'rice', color: 'cyan', n: 6, speed: 2.2, turn: 0.17 },
  icicleB: { shape: 'rice', color: 'blue', n: 6, speed: 2.6, turn: -0.12 },
  rain: { shape: 'rice', color: 'violet', n: 2, speed: 2.6 },
  slug: { shape: 'bigorb', color: 'blue', n: 1, speed: 2.4, fixed: true, split: { shape: 'rice', color: 'cyan', n: 8, speed: 1.9 }, splitAt: 70 },
};

const AVALANCHE = { shape: 'orb', color: 'violet', n: 18, speed: 2.0, gap: 1 };
const MUZZLES = [-9, 9];
const lance = (c, w, warn = 55) => {
  for (const ox of MUZZLES) P.laser(w, c.e, w.aimAngle(c.e.x + ox, c.e.y + 110) + (ox > 0 ? 0.04 : -0.04), { warn, fire: 22, width: 9, ox, oy: 110, rgb: [0.6, 0.9, 1] });
};

const sled = (ox, off) => ({
  label: 'FROST MORTAR', sprite: 'wf_sled', ox, oy: -62, r: 14, hp: 100, medals: 3, score: 7000, bossDamage: 0.07,
  attack(pe, c, w, t) {
    if (!every(c, t, 140, off)) return;
    artillery(c, w.aimX, w.aimY, 44, 72, S.frost);
    if (c.mk >= 2) artillery(c, w.aimX + w.rng.sign() * 80, w.aimY - 30, 38, 82, null);
  },
});
const cannon = (ox, off) => ({
  label: 'SIDE CANNON', sprite: 'wf_cannon', ox, oy: 26, r: 13, hp: 85, medals: 3, score: 6000, bossDamage: 0.06, aim: true,
  attack(pe, c, w, t) { if (every(c, t, 50, off)) P.aimed(w, pe.x, pe.y, S.shardMk); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.arctic, meta = { lights: [], treads: [], stacks: [] };
  both((s) => { track(ctx, pal, meta, s > 0 ? 70 : -102, s > 0 ? 102 : -70, -108, -10); track(ctx, pal, meta, s > 0 ? 70 : -102, s > 0 ? 102 : -70, 4, 98); });
  // Track skirts.
  both((s) => { ctx.beginPath(); ctx.rect(s > 0 ? 62 : -72, -112, 10, 214); armour(ctx, pal, -72, 72); rivetRow(ctx, pal, s * 67, -106, s * 67, 96, 6); });
  const outline = [0, -118, 44, -116, 62, -96, 64, 60, 52, 92, 30, 108, 0, 112];
  const path = () => mpoly(ctx, outline);
  meta.lights.push(...body(ctx, pal, outline, [-64, -118, 128, 230], 'whitefang', { vents: 4, hazards: 1 }));
  camo(ctx, path, ['#5a6672', '#8e9aa8', '#dfe6ee', '#3a434e'], 7, 30, 20);
  weather(ctx, path, 0.25);
  // Ice-breaker ram: serrated steel prow.
  const ram = () => mpoly(ctx, [0, 104, 48, 100, 70, 112, 60, 122, 0, 130]);
  ram(); armour(ctx, { plate: ['#2a3038', '#9aa6b4', '#f2f6fa'] }, -70, 70);
  ctx.fillStyle = '#d8e0ea';
  for (let x = -60; x <= 60; x += 10) { poly(ctx, [x - 4, 122, x + 4, 122, x, 132]); ctx.fill(); }
  // Engine deck with intake grilles and exhausts.
  ctx.beginPath(); ctx.rect(-40, -112, 80, 34); armour(ctx, pal, -40, 40);
  vent(ctx, pal, -32, -108, 64, 10, 0.4, false);
  both((s) => { circ(ctx, s * 24, -88, 7); ctx.fillStyle = '#1a1e22'; ctx.fill(); meta.stacks.push([s * 24, -88]); });
  // Rear deck: mortar sled rails.
  both((s) => { ctx.beginPath(); ctx.rect(s * 62 - 14, -76, 28, 30); armour(ctx, pal, s * 62 - 14, s * 62 + 14); hazard(ctx, pal, s * 62 - 14, -50, 28, 4); });
  // Central turret with twin railguns (long rails, coil rings).
  for (const ox of MUZZLES) {
    ctx.beginPath(); ctx.rect(ox - 3, 6, 6, 104); armour(ctx, pal, ox - 3, ox + 3);
    for (let y = 22; y < 104; y += 12) { ctx.fillStyle = '#2a323c'; ctx.fillRect(ox - 4.2, y, 8.4, 3); }
    ctx.fillStyle = '#050608'; ctx.fillRect(ox - 1.6, 106, 3.2, 4);
  }
  turret(ctx, pal, 0, 4, 30, 0);
  circ(ctx, 0, 4, 18); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  both((s) => { ctx.beginPath(); ctx.rect(s * 40 - 7, 18, 14, 18); armour(ctx, pal, s * 40 - 7, s * 40 + 7); });
  keyLight(ctx, -110, -130, 110, 130, 1);
  core(ctx, pal, 0, -28, 7, '#7ad0ff');
  for (const ox of MUZZLES) glowDot(ctx, ox, 104, 3, 'rgba(140,220,255,1)');
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

export default {
  id: 'white_fang',
  name: 'WHITE FANG',
  title: 'ARCTIC SIEGE TANK',
  archetype: 'ground',
  sprite: 'b_whitefang', scale: 1, r: 54, glow: [0.6, 0.9, 1], score: 150000,
  deathSequence: 'tank_cookoff',
  art(add) {
    add('b_whitefang', 220, 268, hull('b_whitefang', hullArt));
    add('wf_sled', 28, 30, sledArt, 2.5);
    add('wf_cannon', 26, 30, cannonArt, 2.5);
  },
  look: {
    faction: 'ironclad', anim: 'crawler',
    weak: { x: 0, y: -28, r: 18, rgb: [0.5, 0.85, 1] },
    sites: [[-40, -80], [44, -20], [-20, 70], [38, 74], [-86, -60], [86, 40]],
  },
  parts: { sledL: sled(-62, 0), sledR: sled(62, 70), cannonL: cannon(-40, 0), cannonR: cannon(40, 25) },
  desperation: { name: 'WHITEOUT' },

  phases: [
    {
      name: 'RAIL LANCE', hp: 720, arena: 'wf_frozen_frontline', transitionFx: 'flash',
      move: { type: 'hover', amp: 80, y: 130 }, parts: ['cannonL', 'cannonR'],
      patterns: ['railLance', 'shardFan'], musicLayer: 'ground_p1',
    },
    {
      name: 'FROST SLUGS', hp: 770, arena: 'wf_ice_canyon', transitionFx: 'ice_crack',
      move: { type: 'sweep', amp: 110, y: 120, freq: 0.012 }, parts: ['sledL', 'sledR'],
      patterns: ['frostSlug', 'shardFan'], musicLayer: 'ground_p2',
    },
    {
      name: 'ICICLE STORM', hp: 810, arena: 'wf_research_facility', transitionFx: 'screen_tear',
      move: { type: 'figure8', amp: 90, ampY: 25, y: 125 }, parts: ['sledL', 'sledR', 'cannonL', 'cannonR'],
      patterns: ['railLance', 'icicleSpiral'], musicLayer: 'ground_p3',
    },
    {
      name: 'RAM CHARGE', hp: 860, arena: 'wf_glacial_chasm', transitionFx: 'ice_crack',
      move: { type: 'hover', amp: 70, y: 120 },
      patterns: ['ramCharge', 'icicleSpiral', 'shardFan'], musicLayer: 'ground_p4',
    },
    {
      name: 'AVALANCHE', hp: 940, arena: 'wf_avalanche_field', transitionFx: 'cloud_burst',
      move: { type: 'sweep', amp: 100, y: 125, freq: 0.011 }, intensity: 1.1,
      patterns: ['railLance', 'ramCharge', 'avalanche', 'icicleSpiral'], musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    railLance(c, w, t) {
      if (every(c, t, 170) && !c.data.charging) lance(c, w, 60);
      if (c.mk >= 3 && every(c, t, 170, 85) && !c.data.charging) lance(c, w, 45);
    },
    shardFan(c, w, t) {
      if (!c.data.charging && every(c, t, 54)) P.fan(w, c.e.x, c.e.y + 118, DOWN + Math.sin(t * 0.03) * 0.3, S.shard);
      if (c.mk >= 2 && every(c, t, 54, 27)) P.aimed(w, c.e.x, c.e.y + 118, S.shardMk);
    },
    frostSlug(c, w, t) { if (every(c, t, 70)) P.aimed(w, c.e.x, c.e.y + 110, S.slug); },
    icicleSpiral(c, w, t) {
      if (!c.data.charging && every(c, t, 7)) P.spiral(w, c.e, S.icicle, 'icicle');
      if (c.mk >= 2 && every(c, t, 10)) P.spiral(w, c.e, S.icicleB, 'icicleB');
    },
    // Ram charge: lock a lane on the player, telegraph it, plough down it.
    ramCharge(c, w, t) {
      const k = t % 360;
      if (k === 0) {
        c.data.cx = clamp(w.aimX, 90, W - 90);
        c.kit.hazard({ type: 'lane', x: c.data.cx, w: 150, warn: 70, fire: 45, color: [0.6, 0.9, 1] });
      }
      c.data.charging = k < 120;
      if (k < 70) { c.mx = c.data.cx; c.my = 110; c.ease = 0.07; }
      else if (k < 115) {
        c.mx = c.data.cx; c.my = H - 70; c.ease = 0.15;
        if (k % 4 === 0) w.explosions.sparks(c.e.x + w.fxRng.range(-60, 60), c.e.y + 90, 4, [0.85, 0.95, 1], 4, 22, 3);
        if (k % 6 === 0) P.rain(w, S.rain);
        w.g.camera.addTrauma(0.04);
      } else if (k < 200) { c.mx = c.data.cx; c.my = 125; c.ease = 0.04; }
    },
    // Avalanche: a rolling wall of snow from the top with a gap.
    avalanche(c, w, t) {
      if (every(c, t, 160)) P.curtain(w, AVALANCHE);
    },
  },

  update(c) { if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.9) * 0.004; },
};
