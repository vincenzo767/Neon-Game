import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, wing, nozzles, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, turret, turbine, weather, body } from '../roster/art.js';

// AERIAL — IRONWING FORTRESS (airborne military fortress)
// A flying battleship: a thick armoured lifting body held up by four
// shrouded lift fans, bristling with flak turrets, a broadside battery on
// each flank and a spinal cannon down the centreline. It escorts itself —
// launching gunships from a rear deck. Where the carrier is a fleet in the
// sky, Ironwing is a castle: flak walls, crossing fire and a beam that sweeps.
// Arenas: a military airbase → megacity skyline → over a carrier group →
// a flak corridor through the mountains → the overcast bastion above the clouds.

const S = {
  flak: { shape: 'bigorb', color: 'yellow', n: 1, speed: 2.6, accel: -0.03, minSpd: 0.4, fixed: true, split: { shape: 'orb', color: 'orange', n: 8, speed: 1.6 } },
  broad: { shape: 'rice', color: 'yellow', n: 4, spread: 0.3, speed: 3 },
  broadMk: { shape: 'kunai', color: 'orange', n: 2, spread: 0.1, speed: 3.6 },
  wall: { shape: 'orb', color: 'orange', n: 15, speed: 1.8, gap: 1 },
  gunship: { shape: 'rice', color: 'yellow', n: 3, spread: 0.3, speed: 2.8 },
  shell: { shape: 'orb', color: 'yellow', n: 6, spread: 0.9, speed: 2.4 },
};

const FANS = [[-86, -50, 26], [86, -50, 26], [-86, 54, 22], [86, 54, 22]];

const flakTurret = (ox, oy, off) => ({
  label: 'FLAK TURRET', sprite: 'iw_flak', ox, oy, r: 13, hp: 85, medals: 3, score: 6500, bossDamage: 0.06, aim: true,
  attack(pe, c, w, t) {
    if (!every(c, t, 75, off)) return;
    const i = P.shoot(w, pe.x, pe.y, w.aimAngle(pe.x, pe.y) + w.rng.range(-0.15, 0.15), S.flak.speed, S.flak);
    if (i >= 0) w.bullets.maxAge[i] = 40 + w.rng.int(0, 30);          // fused at a random range
  },
});

function gunship(c, w, side) {
  const e = c.e;
  c.kit.spawnMinion({
    sprite: 'b_interceptor', name: 'GUNSHIP', x: e.x + side * 40, y: e.y - 60, r: 10, hp: 9, score: 450, glow: [1, 0.7, 0.3],
    drops: w.rng.chance(0.3) ? ['M'] : null, data: { side },
    ai(m, c2, w2) {
      const d = m.data;
      if (m.t < 40) { m.x += d.side * 2.4; m.y -= 0.4; }
      else if (m.t < 200) {
        m.x += (clamp(w2.aimX + d.side * 90, 30, W - 30) - m.x) * 0.03; m.y += (H * 0.35 - m.y) * 0.03;
        if (m.t % 45 === 0) P.aimed(w2, m.x, m.y, S.gunship);
      } else { m.y -= 3; }
    },
  });
}

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.steel, meta = { lights: [], treads: [], stacks: [], fans: [] };
  // Stub wings carrying the lift fans in armoured rings.
  const wingPts = [0, -70, 60, -80, 118, -70, 124, 72, 110, 86, 60, 80, 0, 74];
  meta.lights.push(...wing(ctx, pal, wingPts, 'ironwing_w', { lights: 3, hazards: 1 }));
  weather(ctx, () => mpoly(ctx, wingPts), 0.4);
  for (const [x, y, r] of FANS) {
    circ(ctx, x, y, r + 6); armour(ctx, pal, x - r - 6, x + r + 6);
    turbine(ctx, pal, x, y, r, 14);
    circ(ctx, x, y, r * 0.3); armour(ctx, pal, x - 8, x + 8);
    meta.fans.push([x, y, r]);
  }
  // Main hull: a long armoured citadel with a pointed prow.
  const hullPts = [0, 132, 22, 118, 46, 80, 50, -96, 40, -124, 0, -128];
  meta.lights.push(...body(ctx, pal, hullPts, [-50, -128, 100, 260], 'ironwing', { vents: 4, hazards: 2, pipes: 2, lights: 3 }));
  weather(ctx, () => mpoly(ctx, hullPts), 0.4);
  // Belt armour plates along the flanks.
  both((s) => { for (let y = -90; y < 80; y += 22) { ctx.beginPath(); ctx.rect(s * 50 - (s > 0 ? 8 : 0), y, 8, 20); armour(ctx, pal, s * 50 - 8, s * 50 + 8); } });
  // Broadside batteries (three barrels each side, pointing outward-down).
  both((s) => { for (let k = 0; k < 3; k++) { const y = -30 + k * 30; ctx.beginPath(); ctx.rect(s > 0 ? 54 : -70, y - 2, 16, 4); armour(ctx, pal, -70, 70); } });
  // Spinal cannon down the centreline.
  ctx.beginPath(); ctx.rect(-6, 10, 12, 130); armour(ctx, pal, -6, 6);
  for (let y = 30; y < 130; y += 16) { ctx.fillStyle = '#20262c'; ctx.fillRect(-7, y, 14, 3); }
  ctx.fillStyle = '#050608'; ctx.fillRect(-3, 136, 6, 4);
  // Bridge tower and rear flight deck.
  ctx.beginPath(); ctx.rect(-18, -20, 36, 26); armour(ctx, pal, -18, 18);
  for (let k = -3; k <= 3; k++) { ctx.fillStyle = '#9ad0ff'; ctx.globalAlpha = 0.7; ctx.fillRect(k * 4.6 - 1.6, 2, 3.2, 2.4); }
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.rect(-30, -122, 60, 46); ctx.fillStyle = '#2a3036'; ctx.fill();
  hazard(ctx, pal, -30, -80, 60, 4);
  ctx.strokeStyle = 'rgba(230,230,230,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -100, 12, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(230,230,230,0.6)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, -100);
  nozzles(ctx, pal, meta, [[-30, -130], [30, -130], [-104, -88], [104, -88]], 7);
  keyLight(ctx, -140, -140, 140, 140, 1);
  core(ctx, pal, 0, -50, 8, '#4ab8ff');
  both((s) => { glowDot(ctx, s * 122, 74, 2.6, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * 122, y: 74, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  for (const [x, y] of [[-24, -122], [24, -122], [-24, -78], [24, -78]]) meta.lights.push({ x, y, c: '#ffd070', ph: (x + y) * 0.01 });
  return meta;
}

function flakArt(ctx, w, h) {
  const pal = PALS.steel, cx = w / 2, cy = h * 0.42;
  for (const dx of [-3.2, 3.2]) { ctx.beginPath(); ctx.rect(cx + dx - 1.4, cy, 2.8, h * 0.58); armour(ctx, pal, cx + dx - 1.4, cx + dx + 1.4); }
  circ(ctx, cx, cy, w * 0.4); armour(ctx, pal, 0, w);
  ctx.beginPath(); ctx.rect(cx - 5, cy - 7, 10, 4); ctx.fillStyle = '#10141a'; ctx.fill();
  keyLight(ctx, 0, 0, w, h);
}

export default {
  id: 'ironwing_fortress',
  name: 'IRONWING FORTRESS',
  title: 'AIRBORNE MILITARY FORTRESS',
  archetype: 'aerial',
  sprite: 'b_ironwing', scale: 1, r: 60, glow: [0.6, 0.8, 1], score: 150000,
  deathSequence: 'spin_out',
  art(add) {
    add('b_ironwing', 268, 290, hull('b_ironwing', hullArt));
    add('iw_flak', 26, 30, flakArt, 2.5);
  },
  look: {
    faction: 'stratos', anim: 'carrier',
    weak: { x: 0, y: -50, r: 18, rgb: [0.4, 0.75, 1] },
    shadow: { dx: 36, dy: 56, a: 0.34 },
    sites: [[-40, -60], [40, 30], [-86, -50], [86, 54], [-20, 90], [30, -110]],
  },
  parts: {
    flakFL: flakTurret(-36, 50, 0), flakFR: flakTurret(36, 50, 37),
    flakRL: flakTurret(-60, -10, 18), flakRR: flakTurret(60, -10, 55),
  },
  desperation: { name: 'LAST BASTION' },

  phases: [
    {
      name: 'BROADSIDE', hp: 760, arena: 'iw_airbase_assault', transitionFx: 'flash',
      move: { type: 'hover', amp: 60, y: 125, freq: 0.006 }, parts: ['flakFL', 'flakFR'],
      patterns: ['broadside', 'shellFan'], musicLayer: 'aerial_p1',
    },
    {
      name: 'SPINAL BEAM', hp: 810, arena: 'iw_megacity_skyline', transitionFx: 'flash',
      move: { type: 'sweep', amp: 80, y: 125, freq: 0.006 }, parts: ['flakRL', 'flakRR'],
      patterns: ['gunships', 'spinalBeam'], musicLayer: 'aerial_p2',
    },
    {
      name: 'FLAK WALL', hp: 850, arena: 'iw_carrier_group', transitionFx: 'cloud_burst',
      move: { type: 'hover', amp: 80, y: 125, freq: 0.007 }, parts: ['flakFL', 'flakFR', 'flakRL', 'flakRR'],
      patterns: ['broadside', 'flakWall'], musicLayer: 'aerial_p3',
    },
    {
      name: 'GUNSHIP SORTIE', hp: 890, arena: 'iw_flak_corridor', transitionFx: 'cloud_burst',
      move: { type: 'figure8', amp: 80, ampY: 20, y: 125, freq: 0.008 },
      patterns: ['spinalBeam', 'flakWall', 'gunships'], musicLayer: 'aerial_p4',
    },
    {
      name: 'BASTION BARRAGE', hp: 970, arena: 'iw_overcast_bastion', transitionFx: 'cloud_burst',
      move: { type: 'hover', amp: 100, y: 125, freq: 0.008 }, intensity: 1.1,
      patterns: ['broadside', 'spinalBeam', 'flakWall', 'shellFan'], musicLayer: 'aerial_p5',
    },
  ],

  attacks: {
    // Broadside: the flank batteries fire outward-down crossing streams.
    broadside(c, w, t) {
      if ((t % 120) < 60 && every(c, t, 10)) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P.fan(w, c.e.x + s * 68, c.e.y - 30 + k * 30, DOWN - s * (0.55 + Math.sin(t * 0.05) * 0.25), k === 1 && c.mk >= 2 ? S.broadMk : S.broad);
    },
    // Flak wall: a curtain with a gap plus air bursts across the screen.
    flakWall(c, w, t) {
      if (every(c, t, 140)) P.curtain(w, S.wall);
      if (every(c, t, 30, 15)) {
        const i = P.shoot(w, c.e.x + w.rng.range(-60, 60), c.e.y + 60, DOWN + w.rng.range(-0.7, 0.7), S.flak.speed, S.flak);
        if (i >= 0) w.bullets.maxAge[i] = 35 + w.rng.int(0, 40);
      }
    },
    // Spinal cannon: a telegraphed beam that sweeps across the screen.
    spinalBeam(c, w, t) {
      if (t % 300 === 40) {
        const dir = w.aimX < c.e.x ? -1 : 1;
        P.laser(w, c.e, DOWN - dir * 0.5, { warn: 70, fire: 130, width: 16, ox: 0, oy: 136, angVel: dir * 0.008, rgb: [0.5, 0.75, 1] });
      }
    },
    gunships(c, w, t) {
      if (every(c, t, 150)) { gunship(c, w, -1); gunship(c, w, 1); }
    },
    shellFan(c, w, t) { if (every(c, t, 50, 25)) P.fan(w, c.e.x, c.e.y + 130, w.aimAngle(c.e.x, c.e.y + 130), S.shell); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.0015; },
};
