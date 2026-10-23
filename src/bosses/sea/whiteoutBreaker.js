import { PALS, hull, shipHull, circ, armour, both, keyLight, hazard, core, glowDot, weather, camo } from '../roster/art.js';
import { WB } from '../../world/tank/whiteoutBreakerModel.js';
import { WhiteoutBreakerRig } from './whiteoutBreakerRig.js';

// SEA — WHITEOUT BREAKER (colossal polar fortress warship), level 2-2.
//
// A real 3D warship ≈ 3030 units long lying STATIONARY in the Pack Ice Lead
// (whiteoutBreakerRig.js + world/tank/whiteoutBreakerModel.js +
// world/env/polar.js / polarMap.js). It never sails: the pilot starts at the
// icebreaker bow and fights aft through TEN ARSENAL SECTIONS — the boss's ten
// phases, each its own HP pool, weapons, abilities and destruction. When a
// section's HP is gone its surviving mounts detonate in sequence and the
// camera travels along the real hull to the next section.
//
//   1 ICEBREAKER BOW BATTERY       Bowbreaker Salvo · Arctic Fan · Hammer Shot · Crossfire Grid
//   2 TRIPLE ARTILLERY DECK        Triple Salvo · Converging Fire · Flak Curtain · Turret Crossfire
//   3 ROCKET BATTERY               Rocket Fan · Saturation Volley · Staggered Barrage · Rocket Minefield
//   4 VERTICAL MISSILE COMPLEX     VLS Saturation · Hunter Salvo · Split Trajectory · Delayed Detonation
//   5 MACHINE-GUN DEFENSE GRID     Iron Rain · Tracking Sweep · Cross-Lane Saturation · Rotating Flak · Gap Collapse
//   6 FUSION DECK                  Dual Salvo · Artillery Walk · Missile Lattice · Explosive Ring · Deck Saturation
//   7 POLAR FLANK BATTERIES        Portside / Starboard Broadside · Alternating Flanks · Crossfire Sweep · Polar Shard Burst
//   8 CRYOGENIC WEAPON ARRAY       Frost Slugs · Glacial Ring · Whiteout Gust · Frozen Corridor · Cryo Surge
//   9 WHITEOUT FROST BEAM          Whiteout Beam (lethal on contact, telegraphed sweep) · focusing-array volleys
//  10 FINAL ARSENAL                Total Saturation · Polar Siege · Whiteout Requiem · Last Battery · Final Whiteout
//
// Every weapon mount (77) is a breakable part riding its projected mount; a
// broken mount stops firing at once. Focusing emitters lost narrow the beam;
// the main emitter lost ends the beam. Every difficulty fights all ten
// sections (phaseSets); fewer-phase difficulties get proportionally less HP.
//
// The 2D sprites below are only the fallback when no arena world is up.

const HL = 150, HW = 52;

function hullArt(ctx) {
  const pal = PALS.frost, meta = { lights: [], treads: [], stacks: [], hw: HW, hl: HL, funnels: [] };
  ctx.beginPath(); ctx.ellipse(0, HL - 34, HW * 0.92, 44, 0, 0, Math.PI); ctx.fillStyle = '#7a1e18'; ctx.fill();
  const { path, lights } = shipHull(ctx, pal, HL * 2, HW * 2, 'whiteout');
  meta.lights.push(...lights);
  camo(ctx, path, ['#5b636c', '#454c54', '#3a4048', '#6a727c'], 17, 30, 22);
  weather(ctx, path, 0.35);
  ctx.beginPath(); ctx.moveTo(-HW * 0.6, HL - 40); ctx.quadraticCurveTo(0, HL + 14, HW * 0.6, HL - 40); ctx.lineWidth = 3; ctx.strokeStyle = '#8a2a20'; ctx.stroke();
  for (const y of [90, 20, -50, -120]) { circ(ctx, 0, y, 16); armour(ctx, pal, -16, 16); }
  hazard(ctx, pal, -36, -88, 72, 3);
  keyLight(ctx, -80, -170, 80, 170, 1);
  core(ctx, pal, 0, -2, 6, '#5ad0ff');
  both((s) => { glowDot(ctx, s * (HW - 4), 10, 2.4, s > 0 ? 'rgba(80,255,120,1)' : 'rgba(255,60,60,1)'); meta.lights.push({ x: s * (HW - 4), y: 10, c: s > 0 ? '#50ff78' : '#ff3c3c', ph: 0 }); });
  return meta;
}

function turretArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2, cy = h * 0.38;
  for (const dx of [-4, 4]) { ctx.beginPath(); ctx.rect(cx + dx - 1.6, cy, 3.2, h * 0.62); armour(ctx, pal, cx + dx - 1.6, cx + dx + 1.6); }
  ctx.beginPath(); ctx.moveTo(cx - w * 0.42, cy - h * 0.25); ctx.lineTo(cx + w * 0.42, cy - h * 0.25); ctx.lineTo(cx + w * 0.34, cy + h * 0.12); ctx.lineTo(cx - w * 0.34, cy + h * 0.12); ctx.closePath();
  armour(ctx, pal, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

function ciwsArt(ctx, w, h) {
  const pal = PALS.frost, cx = w / 2, cy = h * 0.42;
  ctx.beginPath(); ctx.rect(cx - 1.4, cy, 2.8, h * 0.58); armour(ctx, pal, cx - 1.4, cx + 1.4);
  ctx.beginPath(); ctx.roundRect(cx - w * 0.36, cy - h * 0.3, w * 0.72, h * 0.5, w * 0.3); armour(ctx, { plate: ['#6a7480', '#e8eef4', '#ffffff'] }, 0, w);
  keyLight(ctx, 0, 0, w, h);
}

// ------------------------------------------------------------------ parts

const LABEL = {
  tri: 'TRIPLE TURRET', twin: 'TWIN HEAVY TURRET', sec: 'SECONDARY TWIN', ac: 'BOW AUTOCANNON', ciws: 'CIWS MOUNT', flak: 'FLAK MOUNT',
  pod: 'ROCKET POD', rarr: 'HEAVY ROCKET ARRAY', vls: 'VLS BLOCK', mbox: 'MISSILE BATTERY', mortar: 'FROST MORTAR', cryo: 'CRYO PROJECTOR',
  beam: 'WHITEOUT EMITTER', aux: 'FOCUSING EMITTER',
};
// [hit radius, hp, medals, weight (share of the section's stagger)]
const SIZE = {
  tri: [26, 150, 5, 3], twin: [22, 120, 4, 2.5], sec: [14, 70, 2, 1], ac: [10, 45, 1, 0.6], ciws: [11, 45, 1, 0.6], flak: [13, 60, 2, 1],
  pod: [14, 70, 2, 1], rarr: [22, 140, 4, 2.5], vls: [20, 90, 3, 1.5], mbox: [15, 80, 2, 1.2], mortar: [14, 70, 2, 1], cryo: [17, 110, 3, 2],
  beam: [30, 320, 6, 4], aux: [11, 70, 2, 1],
};

const weightOf = (sec) => WB.mounts.filter((m) => m.sec === sec).reduce((a, m) => a + SIZE[m.type][3], 0);
const WEIGHT = WB.sections.map((s) => weightOf(s.k));

function mountPart(m) {
  const [r, hp, medals, wgt] = SIZE[m.type];
  const side = m.x < -8 ? 'PORT ' : m.x > 8 ? 'STARBOARD ' : '';
  const big = r >= 20;
  return {
    label: `${m.small ? 'STERN ' : side}${LABEL[m.type]}`, sprite: big ? 'wb_turret' : 'wb_ciws', mountId: m.id, free: true, quietClear: true,
    r, hp: m.small ? 200 : hp, medals, score: big ? 9000 : 4000,
    // Breaking every mount of a section takes ~35 % of the section's HP with it.
    bossDamage: (0.35 * wgt) / WEIGHT[m.sec],
    skip: (c) => !!(c.rig && c.rig.isDestroyed(m.id)),
    onSpawn: (pe, c) => c.rig && c.rig.partSpawned(m.id, pe),
    onClear: (p, c) => c.rig && c.rig.partCleared(m.id, p),
    onDown: (c) => c.rig && c.rig.partDestroyed(m.id),
  };
}

const PARTS = Object.fromEntries(WB.mounts.map((m) => [`m${m.id}`, mountPart(m)]));
const partsOf = (k) => WB.mounts.filter((m) => m.sec === k).map((m) => `m${m.id}`);

// Section HP before the difficulty's phaseHpScale (Extreme / Hell ×0.8, Hard ×0.72, Standard / Medium ×0.62).
const SECTION_HP = [950, 1020, 1060, 1100, 1400, 1480, 1540, 1600, 1720, 1980];
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default {
  id: 'whiteout_breaker',
  name: 'WHITEOUT BREAKER',
  title: 'POLAR FORTRESS WARSHIP',
  archetype: 'sea',
  sprite: 'b_whiteout', scale: 1, r: 66, glow: [0.6, 0.9, 1], score: 200000,
  deathSequence: 'sink_and_explode',
  art(add) {
    add('b_whiteout', 130, 330, hull('b_whiteout', hullArt));
    add('wb_turret', 30, 34, turretArt, 2.5);
    add('wb_ciws', 20, 24, ciwsArt, 2.5);
  },
  look: {
    faction: 'blacktide', anim: 'none', noDecals: true, noWeak: true,
    weak: { x: 0, y: -2, r: 16, rgb: [0.5, 0.85, 1] },
    sites: [[-30, 40], [30, -30], [-10, 100], [20, -110], [-36, -60], [36, 70]],
  },
  parts: PARTS,
  desperation: { name: 'WHITEOUT' },

  // Ten authored phases = ten sections, all on the same Pack Ice Lead world (the
  // camera travels along the hull between them). Every difficulty fights all ten;
  // fewer-phase difficulties scale the HP down instead of skipping sections.
  phaseSets: { 1: ALL, 2: ALL, 3: ALL, 4: ALL, 5: ALL },
  phaseHpScale: { 1: 0.5, 2: 0.55, 3: 0.62, 4: 0.72, 5: 0.8 },
  phases: WB.sections.map((S, k) => ({
    name: k === 9 ? 'FINAL ARSENAL' : S.name, hp: SECTION_HP[k], section: k,
    arena: 'wb_pack_ice', transitionFx: k === 0 ? 'flash' : 'section_shift',
    move: { type: 'center' }, parts: partsOf(k), intensity: 1 + k * 0.025, final: k === 9,
    patterns: ['sec'], musicLayer: `sea_p${1 + Math.floor(k / 2)}`,
  })),

  attacks: {
    // The rig runs the active section's scheduler (heavy rotation + light harassment).
    sec(c, w, t) { c.rig.tick(t); },
  },

  // Reinforcements: air formations only (surface boats would sail across the deck that
  // fills the screen), and none while a frost-beam cycle is up (its telegraph stays clear).
  summonFilter: (tpl) => !tpl.ground && !(tpl.tags || []).includes('naval'),
  summonHold: (c) => !!(c.rig && c.rig.fb),

  update(c) {
    if (!c.rig) c.rig = new WhiteoutBreakerRig(c);
    c.rig.update();
  },
  renderUnder(c, b, alpha) { if (c.rig) c.rig.renderUnder(b, alpha); },
  renderOver(c, b, alpha) { if (c.rig) c.rig.renderOver(b, alpha); },
};
