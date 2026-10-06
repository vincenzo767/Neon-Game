import * as P from '../../patterns/index.js';
import { every, artillery, clamp, DOWN, W, H } from '../util.js';

// GROUND TANK — COLOSSUS CRAWLER
// Four-tread siege platform. Signature: destructible turrets and mortar
// pods, track-crushing charges down a telegraphed lane, and artillery that
// marks floor zones before impact. Burning overpass → collapsed tunnel →
// scrapyard at sunset → molten foundry floor → ash-choked siege field.

const S = {
  shell: { shape: 'bigorb', color: 'orange', n: 1, speed: 2.6, layers: 4, dSpeed: 0.45, fixed: true },
  shellMk: { shape: 'bigorb', color: 'orange', n: 3, spread: 0.5, speed: 2.4, layers: 3, dSpeed: 0.4 },
  turret: { shape: 'kunai', color: 'red', n: 3, spread: 0.28, speed: 3.6 },
  flak: { shape: 'rice', color: 'yellow', n: 9, spread: 1.5, speed: 2.5 },
  rubble: { shape: 'rice', color: 'orange', n: 2, speed: 2.2, scale: 1.2 },
  mortarBurst: { shape: 'orb', color: 'orange', n: 10, speed: 2.0 },
  scrap: { shape: 'orb', color: 'yellow', n: 14, speed: 1.9 },
  scrapMk: { shape: 'rice', color: 'orange', n: 14, speed: 2.6 },
  lava: { shape: 'orb', color: 'red', n: 5, speed: 2.3, turn: 0.19 },
  lavaB: { shape: 'rice', color: 'orange', n: 5, speed: 2.9, turn: -0.13 },
  siege: { shape: 'orb', color: 'red', n: 7, speed: 2.1, turn: 0.15 },
  dust: { shape: 'rice', color: 'yellow', n: 6, spread: 2.6, speed: 1.6 },
};

const MUZZLE_Y = 76;
const mainGun = (c, w, spec = S.shell) => P.aimed(w, c.e.x, c.e.y + MUZZLE_Y, spec);

/** Shared part definitions (turrets ride the hull, mortars mark artillery zones). */
const turret = (ox, off) => ({
  label: 'TURRET', sprite: 'e_turret', sprite2: 'e_turret_gun', ox, oy: -30, r: 15, hp: 90, aim: true,
  medals: 3, score: 6000, bossDamage: 0.06,
  attack(pe, c, w, t) {
    if (every(c, t, 46, off)) P.aimed(w, pe.x, pe.y, S.turret);
    if (c.mk >= 3 && every(c, t, 46, off + 12)) P.aimed(w, pe.x, pe.y, S.turret, 0.3);
  },
});
const mortar = (ox, off) => ({
  label: 'MORTAR POD', sprite: 'bp_mortar', ox, oy: 44, r: 15, hp: 110, medals: 4, score: 8000, bossDamage: 0.08,
  attack(pe, c, w, t) {
    if (!every(c, t, 150, off)) return;
    // Lobbed shells: one zone on the player, Mk II+ adds a bracketing zone.
    artillery(c, w.aimX, w.aimY, 46, 70, S.mortarBurst);
    if (c.mk >= 2) artillery(c, w.aimX + w.rng.sign() * 90, w.aimY - 40, 40, 80, null);
  },
});

export default {
  id: 'colossus_crawler',
  name: 'COLOSSUS CRAWLER',
  archetype: 'ground',
  sprite: 'b_crawler', scale: 1, r: 58, glow: [1, 0.5, 0.15], score: 150000,
  deathSequence: 'tank_cookoff',

  parts: {
    turretL: turret(-38, 0),
    turretR: turret(38, 23),
    mortarL: mortar(-36, 0),
    mortarR: mortar(36, 75),
  },

  // Hell only: appended after the last phase (stats derive from it).
  desperation: { name: 'SCORCHED EARTH' },

  phases: [
    {
      name: 'OVERPASS SIEGE',
      hp: 720,
      arena: { theme: 'highway_burning', layers: ['overpass_deck', 'burning_traffic', 'searchlights'], weather: 'embers', scrollSpeed: 0.8 },
      transitionFx: 'flash',
      move: { type: 'hover', amp: 90, y: 130 },
      parts: ['turretL', 'turretR'],
      patterns: ['mainGun', 'flak'],
      musicLayer: 'ground_p1',
    },
    {
      name: 'TUNNEL COLLAPSE',
      hp: 760,
      arena: { theme: 'tunnel_collapse', layers: ['tunnel_floor', 'wall_lamps', 'cave_ins'], weather: 'dust', scrollSpeed: 1.2 },
      transitionFx: 'rockfall',
      move: { type: 'sweep', amp: 120, y: 120 },
      parts: ['mortarL', 'mortarR'],
      patterns: ['mainGun', 'rubble'],
      musicLayer: 'ground_p2',
    },
    {
      name: 'SCRAPYARD SUNSET',
      hp: 800,
      arena: { theme: 'scrapyard_sunset', layers: ['dunes', 'scrap_piles', 'low_sun'], particles: ['sandstorm'], scrollSpeed: 0.8 },
      transitionFx: 'sandstorm',
      move: { type: 'hover', amp: 70, y: 130 },
      patterns: ['charge', 'scrapRing'],
      musicLayer: 'ground_p3',
    },
    {
      name: 'MOLTEN FLOOR',
      hp: 860,
      arena: { theme: 'molten_floor', layers: ['foundry_plates', 'magma_rivers'], weather: 'embers' },
      transitionFx: 'lava_flood',
      move: { type: 'hover', amp: 110, y: 125 },
      parts: ['turretL', 'turretR', 'mortarL', 'mortarR'],
      patterns: ['mainGun', 'lavaSpiral'],
      musicLayer: 'ground_p4',
    },
    {
      name: 'SIEGE CORE',
      hp: 950,
      arena: { theme: 'siege_ashfield', layers: ['ruined_blocks', 'ash_fall', 'searchlights'] },
      transitionFx: 'screen_tear',
      move: { type: 'sweep', amp: 100, y: 125, freq: 0.012 },
      patterns: ['barrage', 'mainGunRapid', 'siegeSpiral', 'charge'],
      intensity: 1.1,
      musicLayer: 'ground_p5',
    },
  ],

  attacks: {
    mainGun(c, w, t) {
      if (every(c, t, 85)) mainGun(c, w);
      if (c.mk >= 2 && every(c, t, 85, 42)) mainGun(c, w, S.shellMk);
    },
    mainGunRapid(c, w, t) { if (every(c, t, 55) && !c.data.charging) mainGun(c, w, S.shellMk); },
    flak(c, w, t) { if (every(c, t, 60, 30)) P.fan(w, c.e.x, c.e.y + 40, DOWN, S.flak); },
    // Cave-in: debris falls from the tunnel ceiling.
    rubble(c, w, t) {
      if (every(c, t, 14)) P.rain(w, S.rubble);
      if (t % 300 === 150) { P.fan(w, c.e.x, c.e.y, DOWN, S.dust); w.g.camera.addTrauma(0.25); }
    },
    // Track-crushing charge: line up on the player, telegraph the lane, run it down.
    charge(c, w, t) {
      const k = t % 330;
      if (k === 0) {
        c.data.cx = clamp(w.aimX, 90, W - 90);
        c.kit.hazard({ type: 'lane', x: c.data.cx, w: 150, warn: 75, fire: 45, color: [1, 0.5, 0.1] });
      }
      c.data.charging = k < 120;
      if (k < 75) { c.mx = c.data.cx; c.my = 110; c.ease = 0.07; }
      else if (k < 120) {
        c.mx = c.data.cx; c.my = H - 80; c.ease = 0.14;
        if (k % 4 === 0) w.explosions.sparks(c.e.x + w.fxRng.range(-60, 60), c.e.y - 60, 3, [1, 0.6, 0.2], 4, 20, 3);
        w.g.camera.addTrauma(0.04);
      } else if (k < 200) { c.mx = c.data.cx; c.my = 125; c.ease = 0.04; }
    },
    scrapRing(c, w, t) {
      if (!c.data.charging && every(c, t, 60)) P.ring(w, c.e.x, c.e.y, S.scrap, w.aimAngle(c.e.x, c.e.y));
      if (c.mk >= 2 && !c.data.charging && every(c, t, 60, 30)) P.ring(w, c.e.x, c.e.y, S.scrapMk, t * 0.1);
    },
    lavaSpiral(c, w, t) {
      if (every(c, t, 6)) P.spiral(w, c.e, S.lava, 'lava');
      if (c.mk >= 2 && every(c, t, 9)) P.spiral(w, c.e, S.lavaB, 'lavaB');
    },
    // Ranging barrage: walking artillery zones across the field.
    barrage(c, w, t) {
      if (!every(c, t, 50)) return;
      artillery(c, w.aimX, w.aimY, 42, 65, S.mortarBurst);
      artillery(c, w.rng.range(40, W - 40), w.rng.range(260, H - 60), 50, 85, null);
      if (c.mk >= 3) artillery(c, w.rng.range(40, W - 40), w.rng.range(260, H - 60), 50, 95, null);
    },
    siegeSpiral(c, w, t) { if (!c.data.charging && every(c, t, 7)) P.spiral(w, c.e, S.siege, 'siege'); },
  },

  update(c) {
    // Treads rumble: tiny vertical judder while it moves.
    if (c.state === 'fight') c.e.rot = Math.sin(c.w.t * 0.9) * 0.004;
  },
};
