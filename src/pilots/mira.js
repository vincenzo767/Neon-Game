import { WORLD_W, WORLD_H } from '../core/constants.js';
import { mirrorPath, outline, canopy, glowDot, drawBolt, neonStroke } from '../fx/art.js';
import { miraArt, miraFx } from './miraArt.js';

// MIRA SOLENNE — HALO SPRITE (drone mecha)
// Homing light-needles · Focus: tight hard-homing needles · Special: shield orbs
// Bomb: Halo Bloom · Ultimate: Prism Lattice (reflects every enemy bullet)
//
// MIRA ART TEST: the hand-made mecha art (miraArt.js) replaces drawShip()
// when it loads; drawShip() stays as the automatic fallback. Needles leave
// from the chest gun (the arm guns add the outermost pair from tier 3);
// the feet never fire.

const GOLD = [1.0, 0.82, 0.4];
const PINK = [1.0, 0.5, 0.8];
const UP = -Math.PI / 2;
const TAU = Math.PI * 2;
const REF = 240; // arm-gun needles aim where the old outer needles were this far ahead
const { SHARD_TAG } = miraFx;

function drawShip(ctx, w, h, tier) {
  const cx = w / 2, cy = 22;
  // Feather petals (more with each tier).
  const petals = 1 + tier;
  for (let k = 0; k < petals; k++) {
    for (const s of [-1, 1]) {
      const a = (0.35 + k * 0.32) * s;
      ctx.save();
      ctx.translate(cx + s * 4, cy + 6);
      ctx.rotate(Math.PI / 2 * s + a * 0.6);
      const g = ctx.createLinearGradient(0, 0, 18, 0);
      g.addColorStop(0, '#fff8ea'); g.addColorStop(0.7, '#e8c7a0'); g.addColorStop(1, 'rgba(255,170,200,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(9, 0, 10 - k * 0.8, 2.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,40,0.8)'; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.restore();
    }
  }
  // Halo ring with nodes.
  ctx.beginPath(); ctx.ellipse(cx, cy, 17, 17, 0, 0, TAU);
  neonStroke(ctx, 'rgba(255,215,120,1)', 1.2, 8);
  if (tier >= 4) { ctx.beginPath(); ctx.ellipse(cx, cy, 20.5, 20.5, 0, 0, TAU); neonStroke(ctx, 'rgba(255,140,210,0.9)', 0.7, 6); }
  const nodes = [4, 6, 8, 8][tier - 1];
  for (let k = 0; k < nodes; k++) {
    const a = (k / nodes) * TAU - Math.PI / 2;
    glowDot(ctx, cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 2.2, 'rgba(255,220,140,1)');
  }
  // Pearl pod body.
  mirrorPath(ctx, cx, [0, 3, 5, 10, 7.5, 20, 7, 30, 4, 38, 0, 41]);
  const g = ctx.createRadialGradient(cx - 3, 16, 1, cx, 22, 20);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e9dccd'); g.addColorStop(1, '#6f5a4c');
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  // Gold seams.
  ctx.strokeStyle = 'rgba(200,150,60,0.9)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(cx - 6, 27); ctx.quadraticCurveTo(cx, 31, cx + 6, 27); ctx.stroke();
  if (tier >= 3) { ctx.beginPath(); ctx.moveTo(cx - 7, 20); ctx.quadraticCurveTo(cx, 24, cx + 7, 20); ctx.stroke(); }
  canopy(ctx, cx, 15, 2.6, 5, '#ffffff', '#ff9ad5', '#4a1030');
  glowDot(ctx, cx, 38, 3, 'rgba(255,200,120,1)');
}

function drawDrone(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 5.2, 0, TAU);
  neonStroke(ctx, 'rgba(255,215,120,1)', 0.9, 5);
  const g = ctx.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 4);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9a070');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, TAU); ctx.fill();
  outline(ctx, 0.5);
}

function drawNeedle(ctx, w, h) { drawBolt(ctx, w, h, 'rgba(255,190,120,0.9)', '#fff6e0'); }

// Hex lattice segments (computed once).
function hexSegments(size) {
  const segs = [];
  const hw = Math.sqrt(3) * size, vs = size * 1.5;
  for (let row = -1; row * vs < WORLD_H + size; row++) {
    for (let col = -1; col * hw < WORLD_W + hw; col++) {
      const cx = col * hw + (row & 1 ? hw / 2 : 0), cy = row * vs;
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 6) * TAU + Math.PI / 6, a1 = ((k + 1) / 6) * TAU + Math.PI / 6;
        const x0 = cx + Math.cos(a0) * size, y0 = cy + Math.sin(a0) * size;
        const x1 = cx + Math.cos(a1) * size, y1 = cy + Math.sin(a1) * size;
        segs.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, len: size, ang: Math.atan2(y1 - y0, x1 - x0), ph: (row * 7 + col * 3) % 10 });
      }
    }
  }
  return segs;
}
let LATTICE = null;

export default {
  id: 'mira',
  name: 'MIRA SOLENNE',
  vehicle: 'HALO SPRITE',
  role: 'Drone Mecha',
  bio: 'A former orbital-relay engineer who now flies her own swarm in the Halo Sprite, a white and gold mecha with twin arm guns. Mira\'s needles find any target she sees, and she sees almost everything.',
  color: GOLD,
  css: '#ffd27a',
  // Art test: the Halo Sprite's paint (white/grey armour, gold trim) + gold energy.
  palette: { armour: '#eceef2', frame: '#4a4e58', trim: '#f2b01e', energy: '#ffd27a' },
  stats: { speed: 3, power: 3, range: 4, bomb: 3 },
  speed: { normal: 4.3, focus: 1.9 },
  hitbox: 2.6,
  bombStock: 3,
  engines: [[0, 18]],
  engineColor: [1.0, 0.7, 0.45],
  optionSprite: 'm_drone',
  // Procedural fallback, matched to pilot_portrait.jpg (ash-blonde hair, red eyes, violet outfit).
  portrait: { skin: '#f6dccb', hair: '#cfc6ae', style: 'long', eyes: 'eyes', iris: '#d8202c', suit: '#8a5cc8' },
  weapons: {
    main: 'Light Needles — a wide homing spread from the chest gun; the arm guns join from tier 3',
    focus: 'Seeker Lance — tight hard-homing needles',
  },
  art: miraArt,
  special: {
    name: 'SHIELD ORBS',
    desc: 'Three orbiting orbs erase bullets they touch',
    cooldown: 540,
    duration: 360,
    activate(p) { p.ps.orbs = true; },
    update(p, w, t) {
      for (let k = 0; k < 3; k++) {
        const a = t * 0.11 + (k / 3) * TAU;
        const ox = p.x + Math.cos(a) * 34, oy = p.y + Math.sin(a) * 34;
        w.cancelCircle(ox, oy, 12);
        w.damageCircle(ox, oy, 6, 0.4);
      }
    },
    end(p) { p.ps.orbs = false; },
  },
  bomb: {
    name: 'HALO BLOOM',
    duration: 90,
    activate(p) { p.ps.bloom = { x: p.x, y: p.y, t: 0 }; },
    update(p, w, t) {
      const bl = p.ps.bloom;
      bl.t = t;
      const r = t * 11;
      w.cancelCircle(bl.x, bl.y, r);
      for (const e of w.enemies.active) {
        if (!e.alive || e.lastBomb === w.bombId) continue;
        if (Math.hypot(e.x - bl.x, e.y - bl.y) < r + e.r) { e.lastBomb = w.bombId; w.damage(e, 26); }
      }
      if (t % 2 === 0) {
        const H = w.fxHigh, R = w.fxRng;
        for (let k = 0; k < 6; k++) {
          const a = R.angle();
          const i = H.spawn(p.F.glow, bl.x + Math.cos(a) * r, bl.y + Math.sin(a) * r, Math.cos(a) * 2, Math.sin(a) * 2, 20);
          if (i < 0) break;
          H.size(i, 16, 4); H.color(i, 2, 1.6, 0.8, 1, 0.4, 0.7); H.look(i, 0.8, 1);
        }
      }
    },
    end(p) { p.ps.bloom = null; },
  },
  ultimate: {
    name: 'PRISM LATTICE',
    duration: 300,
    activate(p) {
      if (!LATTICE) LATTICE = hexSegments(40);
      p.ps.lattice = true;
    },
    update(p, w, t) {
      // Every enemy bullet is refracted back as a homing player shot.
      const B = w.bullets, S = w.shots, H = w.fxHigh;
      for (let i = 0; i < B.count; i++) {
        const si = S.spawn(B.x[i], B.y[i], B.ang[i] + Math.PI, Math.max(4, B.spd[i] * 1.5), B.frame[i], B.color[i], B.radius[i] + 3, B.scale[i]);
        if (si >= 0) S.behave(si, 1.4, 160, 0, 0.06);
        if ((i & 3) === 0) {
          const k = H.spawn(p.F.glow, B.x[i], B.y[i], 0, 0, 10);
          if (k >= 0) { H.size(k, 18, 6); H.color(k, 2, 1.7, 1); H.look(k, 0.6, 1); }
        }
      }
      B.count = 0;
      if (t % 30 === 0) w.r.post.shockwave(p.x, p.y, 0.012, 0.02, 0.5);
    },
    end(p) { p.ps.lattice = false; },
  },

  sprites(atlas) {
    for (let t = 1; t <= 4; t++) atlas.add(`ship_mira_${t}`, 46, 44, (c, w, h) => drawShip(c, w, h, t), { scale: 3 });
    atlas.add('m_drone', 12, 12, drawDrone, { scale: 3 });
    atlas.add('m_needle', 18, 4, drawNeedle, { scale: 3 });
    miraArt.buildSprites(atlas);
  },

  // Hand-made art hooks (each returns false without the art → procedural look).
  renderShip: (p, b, x, y, a) => miraArt.renderMecha(p, b, x, y, a),
  exhaust: miraArt.exhaust,
  renderShots: miraFx.renderShots,
  hitSpark: miraFx.hitSpark,

  update(p) { miraArt.animate(p); },

  init(p, w) {
    p.ps.fNeedle = w.r.frame('m_needle');
    p.ps.orbs = false;
  },

  reset(p) { p.ps.orbs = false; },

  optionLayout(p) {
    const n = p.tier, out = [];
    if (p.focus) {
      const slots = [[-10, 16], [10, 16], [-20, 24], [20, 24]];
      for (let k = 0; k < n; k++) out.push(slots[k]);
    } else {
      for (let k = 0; k < n; k++) {
        const a = p.t * 0.05 + (k / n) * TAU;
        out.push([Math.cos(a) * 30, Math.sin(a) * 20 + 4]);
      }
    }
    return out;
  },

  fire(p, w) {
    if (p.fireCd > 0) return;
    const t = p.tier, S = w.shots, f = p.ps.fNeedle;
    p.fireCd = p.focus ? 5 : 6;
    const n = 2 + t;
    const spread = p.focus ? 0.12 : 0.55;
    const homing = p.focus ? 0.14 : 0.06;
    const speed = p.focus ? 13 : 11;
    // Art test (approved): the fan leaves from the chest gun; from tier 3 the
    // outermost pair leaves from the arm guns, aimed where the old outer
    // needles were REF ahead. The feet never fire.
    const [gx, gy] = miraArt.anchor('gun');
    const armsFrom = t >= 3;
    for (let k = 0; k < n; k++) {
      const d = (k / (n - 1) - 0.5) * spread;
      const ox = (k - (n - 1) / 2) * 4;
      let x = p.x + gx + ox, y = p.y + gy, a = UP + d;
      if (armsFrom && (k === 0 || k === n - 1)) {
        const [mx, my] = miraArt.anchor(k === 0 ? 'armL' : 'armR');
        const tx = ox + Math.tan(d) * (-16 + REF);
        x = p.x + mx; y = p.y + my; a = UP + Math.atan2(tx - mx, my + REF);
      }
      const i = w.shot(x, y, a, speed, f, 0.8, 5);
      if (i >= 0) { S.behave(i, p.focus ? 0.9 : 0.75, 140, 0, homing); S.aux[i] = t; } // aux: visual tag
    }
    const flash = (name, size) => { const [fx, fy] = miraArt.animatedAnchor(p, name); miraFx.muzzleFlash(p, w, fx, fy, size); };
    flash('gun', 22);
    if (armsFrom) { flash('armL', 18); flash('armR', 18); }
    for (const o of p.options) {
      const i = w.shot(o.x, o.y - 6, UP, 12, f, 0.6, 5);
      if (i >= 0) { S.behave(i, 0.6, 140, 0, 0.1); S.aux[i] = SHARD_TAG; }
    }
  },

  renderAbove(p, b, x, y) {
    if (!p.ps.orbs) return;
    const F = p.F, t = p.specialT, d = p.def.special.duration - t;
    const fade = t < 60 && (t >> 2) & 1 ? 0.4 : 1;
    for (let k = 0; k < 3; k++) {
      const a = d * 0.11 + (k / 3) * TAU;
      const ox = x + Math.cos(a) * 34, oy = y + Math.sin(a) * 34;
      b.draw(F.glow, ox, oy, 40, 40, 0, PINK[0], PINK[1], PINK[2], 0.6 * fade, 1);
      b.draw(F.core, ox, oy, 12, 12, 0, 2, 1.8, 1.4, fade, 1);
      b.draw(F.ring, ox, oy, 26, 26, 0, GOLD[0], GOLD[1], GOLD[2], 0.6 * fade, 1);
    }
  },

  renderFx(p, b) {
    const F = p.F;
    const bl = p.ps.bloom;
    if (bl) {
      const r = bl.t * 11, a = 1 - bl.t / 90;
      b.draw(F.ring, bl.x, bl.y, r * 2.3, r * 2.3, 0, 2, 1.6, 0.8, a, 1);
      b.draw(F.glow, bl.x, bl.y, r * 1.2, r * 1.2, 0, 1, 0.6, 0.8, a * 0.25, 1);
    }
    if (p.ps.lattice && LATTICE) {
      const el = p.def.ultimate.duration - p.ultT;
      const fade = Math.min(1, el / 20, p.ultT / 30);
      for (const s of LATTICE) {
        const pulse = 0.5 + 0.5 * Math.sin(el * 0.15 + s.ph);
        const c = s.ph & 1 ? GOLD : PINK;
        b.draw(F.laser, s.x, s.y, s.len, 5, s.ang, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, (0.18 + 0.25 * pulse) * fade, 1);
      }
    }
  },
};

