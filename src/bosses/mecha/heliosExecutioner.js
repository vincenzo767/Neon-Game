import * as P from '../../patterns/index.js';
import { every, clamp, DOWN, TAU, W, H } from '../util.js';
import { PALS, hull, limb, mpoly, poly, circ, armour, both, keyLight, hazard, vent, rivetRow, core, lamp, glowDot, weather, body } from '../roster/art.js';

// MECHA — HELIOS EXECUTIONER (advanced humanoid war machine)
// A tall, slender duelling frame in ivory and burnished gold, powered by a
// fan of solar collector blades behind its shoulders. It carries a long
// glaive with a heated edge and focuses sunlight through its collectors
// into lances. It fights like a duellist: blinks to a new position, cuts a
// telegraphed arc, then rakes the ground with converging solar beams.
// Arenas: a ruined metropolitan district → a solar-tower array → a burning
// skyscraper crown → the orbital mirror → facing the sun.

const S = {
  feather: { shape: 'rice', color: 'yellow', n: 7, spread: 1.1, speed: 2.8 },
  ray: { shape: 'kunai', color: 'yellow', n: 1, speed: 4.4, fixed: true },
  cut: { shape: 'rice', color: 'orange', n: 15, spread: 2.2, speed: 2.4 },
  halo: { shape: 'orb', color: 'yellow', n: 16, speed: 1.6 },
  haloB: { shape: 'orb', color: 'orange', n: 16, speed: 2.1 },
  flare: { shape: 'bigorb', color: 'yellow', n: 1, speed: 1.4, fixed: true, split: { shape: 'rice', color: 'white', n: 16, speed: 2.4 }, splitAt: 90 },
};

// Collector blades fanned behind the shoulders (angles, sprite-local).
const BLADES = [-2.6, -2.2, -1.8, -1.34, -0.94, -0.54];

const collector = (k, off) => ({
  label: 'SOLAR COLLECTOR', sprite: 'he_blade', ox: Math.cos(BLADES[k]) * 92, oy: Math.sin(BLADES[k]) * 92 + 10, r: 11, hp: 70, medals: 3, score: 6000, bossDamage: 0.05,
  attack(pe, c, w, t) { if (every(c, t, 100, off)) P.aimed(w, pe.x, pe.y, S.ray); },
});

// ------------------------------------------------------------------ art

function hullArt(ctx) {
  const pal = PALS.helios, meta = { lights: [], treads: [], stacks: [], thrusters: [] };
  // Collector blades: long gold-foil vanes fanned behind.
  for (const a of BLADES) both((s) => {
    const ang = s > 0 ? a : -Math.PI - a;
    ctx.save(); ctx.translate(0, 10); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(30, -6); ctx.lineTo(112, -10); ctx.lineTo(118, 0); ctx.lineTo(112, 10); ctx.lineTo(30, 6); ctx.closePath();
    const g = ctx.createLinearGradient(30, -10, 30, 10); g.addColorStop(0, '#5a4418'); g.addColorStop(0.45, '#f0d890'); g.addColorStop(0.55, '#c8a050'); g.addColorStop(1, '#3a2a10');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#201608'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,10,0.5)'; ctx.lineWidth = 0.5;
    for (let x = 40; x < 110; x += 7) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x, 7); ctx.stroke(); }
    ctx.restore();
  });
  // Slender legs (mostly hidden below the hips) and a narrow waist.
  both((s) => { limb(ctx, pal, s * 14, -10, s * 22, -78, 14); ctx.beginPath(); ctx.ellipse(s * 22, -84, 9, 13, 0, 0, TAU); armour(ctx, pal, s * 22 - 9, s * 22 + 9); });
  // Torso: tapered chest with a sunburst reactor.
  const chest = [0, -24, 18, -26, 34, -4, 36, 22, 24, 44, 0, 50];
  meta.lights.push(...body(ctx, pal, chest, [-36, -26, 72, 76], 'helios', { vents: 1, hazards: 0, pipes: 0, cables: 1, lights: 2, glow: 0.5 }));
  weather(ctx, () => mpoly(ctx, chest), 0.12);
  // Pauldrons and the head with its crest.
  both((s) => { ctx.beginPath(); ctx.ellipse(s * 40, 10, 16, 20, s * 0.3, 0, TAU); armour(ctx, pal, s * 40 - 16, s * 40 + 16, 2); });
  ctx.beginPath(); ctx.moveTo(0, 74); ctx.lineTo(9, 60); ctx.lineTo(8, 46); ctx.lineTo(-8, 46); ctx.lineTo(-9, 60); ctx.closePath(); armour(ctx, pal, -9, 9);
  ctx.fillStyle = '#ffe080'; ctx.fillRect(-6, 58, 12, 2.4);
  // Right arm holding the glaive across the body.
  limb(ctx, pal, 40, 14, 56, 48, 12);
  ctx.save(); ctx.translate(56, 48); ctx.rotate(0.25);
  ctx.beginPath(); ctx.rect(-2.5, -70, 5, 150); armour(ctx, { plate: ['#2a2016', '#8a7448', '#d8c08a'] }, -2.5, 2.5);
  ctx.beginPath(); ctx.moveTo(-3, 80); ctx.quadraticCurveTo(16, 96, 2, 122); ctx.lineTo(-4, 120); ctx.quadraticCurveTo(4, 98, -3, 86); ctx.closePath();
  const bg = ctx.createLinearGradient(-4, 80, 16, 120); bg.addColorStop(0, '#fff4c0'); bg.addColorStop(1, '#ff9a30');
  ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  // Left arm open, palm emitter.
  limb(ctx, pal, -40, 14, -58, 46, 12);
  glowDot(ctx, -58, 50, 4, 'rgba(255,220,120,1)');
  // Sunburst core.
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.strokeStyle = 'rgba(255,220,120,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, 10 + Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 16, 10 + Math.sin(a) * 16); ctx.stroke(); }
  keyLight(ctx, -120, -110, 120, 130, 1);
  core(ctx, pal, 0, 10, 8, '#ffd050');
  both((s) => meta.thrusters.push([s * 20, -96]));
  meta.lights.push({ x: -58, y: 50, c: '#ffe080', ph: 0 }, { x: 0, y: 59, c: '#ffe080', ph: 0.5 });
  return meta;
}

function bladeArt(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.moveTo(cx, 1); ctx.lineTo(w - 2, cy); ctx.lineTo(cx, h - 1); ctx.lineTo(2, cy); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#c8a050'); g.addColorStop(1, '#4a3410');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#201608'; ctx.lineWidth = 0.8; ctx.stroke();
  glowDot(ctx, cx, cy, 3, 'rgba(255,230,140,1)');
}

export default {
  id: 'helios_executioner',
  name: 'HELIOS EXECUTIONER',
  title: 'ADVANCED HUMANOID WAR MACHINE',
  archetype: 'mecha',
  sprite: 'b_helios', scale: 1, r: 40, glow: [1, 0.85, 0.45], score: 150000,
  deathSequence: 'meltdown',
  art(add) {
    add('b_helios', 252, 236, hull('b_helios', hullArt));
    add('he_blade', 22, 22, bladeArt, 2.5);
  },
  look: {
    faction: 'helix', anim: 'titan',
    weak: { x: 0, y: 10, r: 14, rgb: [1, 0.85, 0.4] },
    shadow: { dx: 24, dy: 36, a: 0.3 },
    sites: [[-30, 0], [30, 20], [-40, 10], [40, 10], [0, 40], [0, -20]],
  },
  parts: Object.fromEntries(BLADES.slice(0, 3).flatMap((_, k) => [[`bladeR${k}`, collector(k + 3, k * 20)], [`bladeL${k}`, { ...collector(k + 3, k * 20 + 10), ox: -Math.cos(BLADES[k + 3]) * 92 }]])),
  desperation: { name: 'ZENITH' },

  phases: [
    {
      name: 'GLAIVE CUT', hp: 720, arena: 'he_ruined_district', transitionFx: 'flash',
      move: { type: 'figure8', amp: 110, ampY: 30, y: 130, freq: 0.01 }, parts: ['bladeR0', 'bladeL0'],
      patterns: ['featherFan', 'glaiveCut'], musicLayer: 'mecha_p1',
    },
    {
      name: 'SOLAR LANCES', hp: 770, arena: 'he_solar_array', transitionFx: 'flash',
      move: { type: 'hover', amp: 100, y: 130, freq: 0.009 }, parts: ['bladeR1', 'bladeL1', 'bladeR2', 'bladeL2'],
      patterns: ['solarLances', 'featherFan'], musicLayer: 'mecha_p2',
    },
    {
      name: 'HALO BLINK', hp: 820, arena: 'he_skyscraper_crown', transitionFx: 'screen_tear',
      move: { type: 'hover', amp: 110, y: 130, freq: 0.01 },
      patterns: ['blink', 'glaiveCut', 'haloRings'], musicLayer: 'mecha_p3',
    },
    {
      name: 'MIRROR RINGS', hp: 860, arena: 'he_orbital_mirror', transitionFx: 'warp_tunnel',
      move: { type: 'figure8', amp: 100, ampY: 25, y: 130, freq: 0.009 }, parts: ['bladeR0', 'bladeL0', 'bladeR1', 'bladeL1'],
      patterns: ['solarLances', 'haloRings'], musicLayer: 'mecha_p4',
    },
    {
      name: 'SOLAR FLARE', hp: 940, arena: 'he_facing_sun', transitionFx: 'flash',
      move: { type: 'hover', amp: 120, y: 130, freq: 0.011 }, intensity: 1.1,
      patterns: ['blink', 'solarLances', 'glaiveCut', 'solarFlare'], musicLayer: 'mecha_p5',
    },
  ],

  attacks: {
    featherFan(c, w, t) { if (every(c, t, 40)) for (const s of [-1, 1]) P.fan(w, c.e.x + s * 70, c.e.y - 10, DOWN + s * 0.35, S.feather); },
    // Glaive cut: a wide telegraphed arc, then a crescent of shrapnel.
    glaiveCut(c, w, t) {
      if (!every(c, t, 170, 40)) return;
      const dir = w.aimX > c.e.x ? 1 : -1;
      const a0 = dir > 0 ? Math.PI * 0.08 : Math.PI * 0.92;
      c.kit.hazard({
        type: 'arc', follow: true, fx: 0, fy: 40, r: 260, a0, a1: Math.PI - a0, warn: 48, fire: 16, color: [1, 0.75, 0.3],
        onFire: (h, w2) => { P.fan(w2, h.cx, h.cy, DOWN, S.cut); w2.g.camera.addTrauma(0.25); w2.g.renderer.post.aberrate(0.005); },
      });
    },
    // Solar lances: beams from the collectors converge on the player.
    solarLances(c, w, t) {
      if (t % 210 !== 30) return;
      const n = c.mk >= 3 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const ox = (k / (n - 1) - 0.5) * 180, oy = -40;
        const ang = w.aimAngle(c.e.x + ox, c.e.y + oy);
        P.laser(w, c.e, ang + (k - (n - 1) / 2) * 0.12, { warn: 55, fire: 34, width: 8, ox, oy, rgb: [1, 0.85, 0.4] });
      }
    },
    // Blink: vanish in a flash and reappear across the screen.
    blink(c, w, t) {
      const k = t % 230;
      if (k === 0) {
        w.explosions.blast(c.e.x, c.e.y, 0.6, [1, 0.85, 0.4]);
        const x = clamp(W - c.e.x + w.rng.range(-60, 60), 80, W - 80);
        c.snap(x, w.rng.range(110, 170));
        c.data.bx = c.e.x; c.data.by = c.e.y;
        w.g.renderer.post.flash(1, 0.9, 0.6, 0.15, 0.05);
        P.ring(w, c.e.x, c.e.y, S.haloB, w.rng.angle());
      }
      if (k < 70 && c.data.bx != null) { c.mx = c.data.bx; c.my = c.data.by; c.ease = 0.2; }
    },
    haloRings(c, w, t) {
      if (every(c, t, 60)) P.ring(w, c.e.x, c.e.y + 10, S.halo, t * 0.02);
      if (c.mk >= 2 && every(c, t, 60, 30)) P.ring(w, c.e.x, c.e.y + 10, S.haloB, -t * 0.02);
    },
    solarFlare(c, w, t) { if (every(c, t, 120, 60)) for (const s of [-1, 1]) P.shoot(w, c.e.x + s * 40, c.e.y + 20, DOWN + s * 0.5, S.flare.speed, S.flare); },
  },

  update(c) { if (c.state === 'fight' || c.state === 'enter') c.e.rot = (c.mx - c.e.x) * -0.003; },
};
