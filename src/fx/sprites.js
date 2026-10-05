import { RNG } from '../core/RNG.js';

// Procedural sprite definitions. Everything visual is drawn here with
// Canvas2D at startup and packed into the atlas — no image files.
//
// Conventions:
//  * Sprites that have a heading (bullets, shots, sparks) face +X.
//  * Ships face UP (-Y) and are drawn with rotation 0.
//  * FX sprites are white/greyscale so they can be tinted at draw time.

// Danger-coded bullet palette. Semantics (finalised in M3):
//  red = aimed, pink = fast, orange = heavy, yellow = curving, green = slow
//  field, cyan = lasers/beam-adjacent, blue = rain/curtain, violet = homing.
export const BULLET_COLORS = {
  red: [1.0, 0.16, 0.24],
  pink: [1.0, 0.3, 0.85],
  orange: [1.0, 0.55, 0.1],
  yellow: [1.0, 0.92, 0.25],
  green: [0.35, 1.0, 0.45],
  cyan: [0.2, 0.95, 1.0],
  blue: [0.35, 0.5, 1.0],
  violet: [0.7, 0.35, 1.0],
  white: [0.92, 0.95, 1.0],
};
export const COLOR_NAMES = Object.keys(BULLET_COLORS);
export const BULLET_SHAPES = ['orb', 'rice', 'kunai', 'bigorb'];

const css = (c, a = 1, mul = 1) =>
  `rgba(${Math.min(255, c[0] * 255 * mul) | 0},${Math.min(255, c[1] * 255 * mul) | 0},${Math.min(255, c[2] * 255 * mul) | 0},${a})`;

const OUTLINE = 'rgba(6,2,14,0.95)';

// ---------------------------------------------------------------- bullets

function drawOrb(ctx, w, h, col) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 0.4;
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.42, '#ffffff');
  g.addColorStop(0.62, css(col, 1, 1.3));
  g.addColorStop(1, css(col, 1, 0.85));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fill();
}

function drawRice(ctx, w, h, col) {
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, (h - 0.8) / (w - 0.8));
  const R = w / 2 - 0.4;
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.78);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, '#ffffff');
  g.addColorStop(0.65, css(col, 1, 1.3));
  g.addColorStop(1, css(col, 1, 0.85));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawKunai(ctx, w, h, col) {
  const cy = h / 2;
  const shape = (inset) => {
    ctx.beginPath();
    ctx.moveTo(w - inset, cy);
    ctx.lineTo(w * 0.35, inset);
    ctx.lineTo(inset, cy - h * 0.18);
    ctx.lineTo(inset + w * 0.12, cy);
    ctx.lineTo(inset, cy + h * 0.18);
    ctx.lineTo(w * 0.35, h - inset);
    ctx.closePath();
  };
  ctx.fillStyle = OUTLINE; shape(0.3); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, css(col, 1, 0.8));
  g.addColorStop(0.6, css(col, 1, 1.3));
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g; shape(1.6); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(w * 0.3, cy); ctx.lineTo(w - 3, cy); ctx.stroke();
}

// --------------------------------------------------------------- generic FX

function drawGlow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawCore(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSpark(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2, h / 2 - 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.addColorStop(0.86, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSmoke(ctx, w, h) {
  const rng = new RNG(1337);
  for (let i = 0; i < 14; i++) {
    const a = rng.angle();
    const d = rng.range(0, w * 0.18);
    const x = w / 2 + Math.cos(a) * d;
    const y = h / 2 + Math.sin(a) * d;
    const r = rng.range(w * 0.18, w * 0.32);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawShard(ctx, w, h, seed) {
  const rng = new RNG(seed);
  const n = rng.int(4, 6);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const r = rng.range(0.55, 1) * (w / 2 - 1);
    pts.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * rng.range(0.5, 1)]);
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#8a93a8');
  g.addColorStop(0.5, '#3a4050');
  g.addColorStop(1, '#14161e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.9)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function drawBeam(ctx, w, h) {
  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);
  // Fade both ends.
  ctx.globalCompositeOperation = 'destination-in';
  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.2, 'rgba(0,0,0,1)');
  gy.addColorStop(0.8, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function drawWhite(ctx, w, h) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
}

function drawRain(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(w * 0.25, 0, w * 0.5, h);
}

function drawHitbox(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.strokeStyle = 'rgba(255,40,80,1)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2); ctx.fill();
}

// ------------------------------------------------------------ player shots

function drawPlayerShot(ctx, w, h) {
  // Deliberately thin, desaturated and translucent: player fire must never
  // hide enemy bullets.
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(120,200,255,0)');
  g.addColorStop(0.6, 'rgba(170,230,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 0.3, h / 2 - 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ ships

/** Test interceptor (replaced by per-pilot vehicles in M2). Faces up. */
function drawInterceptor(ctx, w, h) {
  const cx = w / 2;
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(cx, 1);
    ctx.lineTo(cx + 5, 15);
    ctx.lineTo(cx + 7, 22);
    ctx.lineTo(w - 2, 33);
    ctx.lineTo(w - 2, 39);
    ctx.lineTo(cx + 8, 37);
    ctx.lineTo(cx + 5, h - 3);
    ctx.lineTo(cx - 5, h - 3);
    ctx.lineTo(cx - 8, 37);
    ctx.lineTo(2, 39);
    ctx.lineTo(2, 33);
    ctx.lineTo(cx - 7, 22);
    ctx.lineTo(cx - 5, 15);
    ctx.closePath();
  };
  // Chrome body.
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#141a26');
  g.addColorStop(0.35, '#5d6d86');
  g.addColorStop(0.5, '#c8d4e6');
  g.addColorStop(0.65, '#5d6d86');
  g.addColorStop(1, '#141a26');
  ctx.fillStyle = g;
  hull(); ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = '#05070c';
  hull(); ctx.stroke();
  // Neon trim.
  ctx.save();
  ctx.shadowColor = 'rgba(60,230,255,1)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(90,240,255,1)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 23); ctx.lineTo(3, 34);
  ctx.moveTo(cx + 7, 23); ctx.lineTo(w - 3, 34);
  ctx.moveTo(cx - 4, h - 4); ctx.lineTo(cx - 6, 30);
  ctx.moveTo(cx + 4, h - 4); ctx.lineTo(cx + 6, 30);
  ctx.stroke();
  ctx.restore();
  // Panel lines.
  ctx.strokeStyle = 'rgba(10,14,22,0.8)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, 26); ctx.lineTo(cx, h - 4);
  ctx.moveTo(cx - 8, 36); ctx.lineTo(cx + 8, 36);
  ctx.stroke();
  // Cockpit canopy.
  const cg = ctx.createLinearGradient(cx, 12, cx, 28);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.3, '#ff7ad9');
  cg.addColorStop(1, '#3a0a40');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(cx, 21, 2.8, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  // Wingtip lights.
  ctx.fillStyle = '#ff3355'; ctx.fillRect(2, 33, 2, 3);
  ctx.fillStyle = '#33ff99'; ctx.fillRect(w - 4, 33, 2, 3);
}

/** Basic enemy drone (sandbox / M3 roster seed). Faces down. */
function drawDrone(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  // Rotor rings.
  for (const [ox, oy] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
    ctx.strokeStyle = 'rgba(255,90,60,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 5.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(40,20,30,0.9)';
    ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + ox, cy + oy); ctx.stroke();
  }
  // Hex body.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = cx + Math.cos(a) * 10, y = cy + Math.sin(a) * 10;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 11);
  g.addColorStop(0, '#9a8aa8');
  g.addColorStop(0.6, '#3c3046');
  g.addColorStop(1, '#16101c');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#05030a'; ctx.lineWidth = 0.8; ctx.stroke();
  // Eye.
  ctx.save();
  ctx.shadowColor = '#ff2040'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff3050';
  ctx.beginPath(); ctx.arc(cx, cy + 2, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe0e6';
  ctx.beginPath(); ctx.arc(cx, cy + 2, 1.3, 0, Math.PI * 2); ctx.fill();
}

/** Heavy gun-core used as the sandbox pattern emitter. Faces down. */
function drawCore2(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  // Armour petals.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -w * 0.48, 0, -w * 0.2);
    g.addColorStop(0, '#59506a');
    g.addColorStop(1, '#1b1624');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, -w * 0.2);
    ctx.lineTo(-9, -w * 0.44);
    ctx.lineTo(0, -w * 0.49);
    ctx.lineTo(9, -w * 0.44);
    ctx.lineTo(6, -w * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#08060c'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = 'rgba(255,60,140,0.9)';
    ctx.fillRect(-1, -w * 0.45, 2, 4);
    ctx.restore();
  }
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.24);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, '#ff6ad0');
  g.addColorStop(0.6, '#5a1050');
  g.addColorStop(1, '#120614');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,220,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.27, 0, Math.PI * 2); ctx.stroke();
}

// ----------------------------------------------------- parallax structures

function drawGirder(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a3242');
  g.addColorStop(0.15, '#151a24');
  g.addColorStop(0.85, '#0b0e14');
  g.addColorStop(1, '#05070a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Truss bracing.
  ctx.strokeStyle = '#212938';
  ctx.lineWidth = 2;
  const step = h * 1.1;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x, 4); ctx.lineTo(x + step, h - 4);
    ctx.moveTo(x, h - 4); ctx.lineTo(x + step, 4);
  }
  ctx.stroke();
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, h * 0.4, w, h * 0.2);
  // Rim light + rivets.
  ctx.fillStyle = 'rgba(80,220,255,0.9)';
  ctx.fillRect(0, 1, w, 1);
  ctx.fillStyle = 'rgba(255,60,160,0.6)';
  ctx.fillRect(0, h - 2, w, 1);
  ctx.fillStyle = '#4a5468';
  for (let x = 6; x < w; x += 12) {
    ctx.beginPath(); ctx.arc(x, 4.5, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, h - 4.5, 0.9, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRoof(ctx, w, h, seed) {
  const rng = new RNG(seed);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#262c3a');
  g.addColorStop(1, '#0c0f16');
  ctx.fillStyle = g;
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.strokeStyle = '#3a4458'; ctx.lineWidth = 1.2;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  // Vents / AC units.
  for (let i = 0; i < 5; i++) {
    const x = rng.range(8, w - 26), y = rng.range(8, h - 26);
    const s = rng.range(8, 16);
    ctx.fillStyle = '#1a1f2a';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#323b4d'; ctx.lineWidth = 0.6;
    ctx.strokeRect(x, y, s, s);
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.32, 0, Math.PI * 2); ctx.stroke();
  }
  // Helipad.
  if (rng.chance(0.6)) {
    const x = w * 0.6, y = h * 0.6, r = Math.min(w, h) * 0.18;
    ctx.strokeStyle = 'rgba(255,210,60,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `bold ${r}px sans-serif`;
    ctx.fillStyle = 'rgba(255,210,60,0.7)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', x, y + 1);
  }
  // Neon edge strip.
  const neon = rng.pick(['rgba(80,230,255,1)', 'rgba(255,60,170,1)', 'rgba(255,170,40,1)']);
  ctx.save();
  ctx.shadowColor = neon; ctx.shadowBlur = 5;
  ctx.fillStyle = neon;
  ctx.fillRect(4, h - 5, w - 8, 1.2);
  ctx.restore();
  // Beacon.
  ctx.fillStyle = '#ff2040';
  ctx.beginPath(); ctx.arc(6, 6, 1.5, 0, Math.PI * 2); ctx.fill();
}

function drawHolo(ctx, w, h) {
  ctx.fillStyle = 'rgba(40,200,255,0.12)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,240,255,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  // Pseudo text blocks.
  const rng = new RNG(77);
  ctx.fillStyle = 'rgba(160,250,255,0.85)';
  for (let row = 0; row < 3; row++) {
    let x = 6;
    while (x < w - 10) {
      const len = rng.range(4, 12);
      ctx.fillRect(x, 7 + row * 9, len, 4);
      x += len + 3;
    }
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 0.7);
}

// ------------------------------------------------------------- beams / melee

/** Horizontal laser segment: soft vertical profile, stretched along a beam. */
function drawLaser(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.25)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Crescent slash arc, open side facing -X (the cut travels toward +X). */
function drawSlash(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 1;
  const g = ctx.createRadialGradient(cx - R * 0.3, cy, R * 0.5, cx, cy, R);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.8, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0.6)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx - R * 0.38, cy, R * 0.98, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------- items

const ITEM_STYLE = {
  P: { fill: ['#ff6a3d', '#a01a10'], text: 'P' },
  B: { fill: ['#4dff8a', '#0d7a35'], text: 'B' },
  S: { fill: ['#4db8ff', '#0d3d8a'], text: 'S' },
  L: { fill: ['#ff5ad9', '#7a0d6a'], text: '1UP' },
};

function drawItem(ctx, w, h, kind) {
  const st = ITEM_STYLE[kind];
  const r = 4;
  const rr = (x, y, ww, hh) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
  };
  ctx.fillStyle = OUTLINE; rr(0.5, 0.5, w - 1, h - 1); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, st.fill[0]); g.addColorStop(1, st.fill[1]);
  ctx.fillStyle = g; rr(2, 2, w - 4, h - 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(4, 3, w - 8, 2);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${st.text.length > 1 ? 7 : 12}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(st.text, w / 2, h / 2 + 1);
}

function drawMedal(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = OUTLINE; ctx.fill();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, '#ffc93d'); g.addColorStop(1, '#8a5500');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.fill();
  // Star badge.
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? R * 0.22 : R * 0.5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------------ build

/** Rasterise every sprite into the atlas. Returns lookup helpers. */
export function buildSprites(atlas) {
  atlas.add('white', 8, 8, drawWhite, { inset: true });
  atlas.add('glow', 64, 64, drawGlow);
  atlas.add('core', 32, 32, drawCore);
  atlas.add('spark', 32, 8, drawSpark);
  atlas.add('ring', 128, 128, drawRing, { scale: 1 });
  atlas.add('smoke', 64, 64, drawSmoke);
  for (let i = 0; i < 4; i++) atlas.add(`shard${i}`, 14, 14, (c, w, h) => drawShard(c, w, h, 100 + i));
  atlas.add('beam', 32, 256, drawBeam, { scale: 1 });
  atlas.add('rain', 2, 28, drawRain);
  atlas.add('hitbox', 10, 10, drawHitbox, { scale: 4 });
  atlas.add('pshot', 26, 7, drawPlayerShot);
  atlas.add('ship_test', 40, 48, drawInterceptor, { scale: 3 });
  atlas.add('drone', 36, 36, drawDrone);
  atlas.add('emitter', 72, 72, drawCore2);
  atlas.add('girder', 256, 34, drawGirder, { scale: 1.5 });
  for (let i = 0; i < 3; i++) atlas.add(`roof${i}`, 110, 90, (c, w, h) => drawRoof(c, w, h, 900 + i), { scale: 1.5 });
  atlas.add('holo', 90, 34, drawHolo);
  atlas.add('laser', 64, 24, drawLaser, { scale: 1 });
  atlas.add('slash', 64, 64, drawSlash);
  for (const k of Object.keys(ITEM_STYLE)) atlas.add(`item_${k}`, 18, 18, (c, w, h) => drawItem(c, w, h, k), { scale: 3 });
  atlas.add('item_M', 16, 16, drawMedal, { scale: 3 });

  // Bullets: [shape][colour] -> frame id.
  const bulletFrames = {};
  for (const shape of BULLET_SHAPES) {
    bulletFrames[shape] = {};
    for (const name of COLOR_NAMES) {
      const col = BULLET_COLORS[name];
      let f;
      if (shape === 'orb') f = atlas.add(`b_orb_${name}`, 12, 12, (c, w, h) => drawOrb(c, w, h, col), { scale: 3 });
      else if (shape === 'bigorb') f = atlas.add(`b_big_${name}`, 26, 26, (c, w, h) => drawOrb(c, w, h, col), { scale: 2.5 });
      else if (shape === 'rice') f = atlas.add(`b_rice_${name}`, 16, 9, (c, w, h) => drawRice(c, w, h, col), { scale: 3 });
      else f = atlas.add(`b_kunai_${name}`, 18, 10, (c, w, h) => drawKunai(c, w, h, col), { scale: 3 });
      bulletFrames[shape][name] = f.id;
    }
  }
  return { bulletFrames };
}
