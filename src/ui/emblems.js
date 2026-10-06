import { FACTIONS } from '../data/factions/index.js';

// Code-generated faction emblems (UPDATE_02 §2.8). Original marks drawn with
// Canvas2D in each faction's palette and cached as data URLs for the DOM
// intro cards (and later the M7 UI).
//
//   cog     Ironclad Brotherhood: armoured gear with a hazard chevron
//   wings   Stratos Cartel: swept wings around a diamond
//   anchor  Black Tide: anchor-trident over waves
//   helix   Helix Dynamics: double helix in a hexagon
//   star    Choir of the Outer Star: eight-point star with an orbit
//   eye     Drowned Covenant: lidless eye with tendrils

const TAU = Math.PI * 2;
const cache = new Map();

function stroke(ctx, color, w, blur = 6) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}

const MARKS = {
  cog(ctx, p) {
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU, r = i % 2 ? 30 : 36;
      ctx.lineTo(Math.cos(a - 0.08) * r, Math.sin(a - 0.08) * r);
      ctx.lineTo(Math.cos(a + 0.08) * r, Math.sin(a + 0.08) * r);
    }
    ctx.closePath(); ctx.fillStyle = p.primary; ctx.fill(); stroke(ctx, p.glow, 2);
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fillStyle = '#120806'; ctx.fill(); stroke(ctx, p.accent, 2);
    ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(0, 10); ctx.lineTo(12, -2); ctx.lineTo(12, -10); ctx.lineTo(0, 2); ctx.lineTo(-12, -10); ctx.closePath();
    ctx.fillStyle = p.accent; ctx.fill();
  },
  wings(ctx, p) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 6, -4);
      ctx.lineTo(s * 40, -22); ctx.lineTo(s * 34, -12); ctx.lineTo(s * 42, -8); ctx.lineTo(s * 30, 0); ctx.lineTo(s * 36, 6); ctx.lineTo(s * 8, 8);
      ctx.closePath(); ctx.fillStyle = p.secondary; ctx.fill(); stroke(ctx, p.glow, 1.6);
    }
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 2); ctx.lineTo(0, 22); ctx.lineTo(-10, 2); ctx.closePath();
    ctx.fillStyle = p.primary; ctx.fill(); stroke(ctx, p.glow, 2);
  },
  anchor(ctx, p) {
    ctx.beginPath(); ctx.arc(0, -24, 6, 0, TAU); stroke(ctx, p.glow, 3);
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 22); stroke(ctx, p.glow, 4);
    ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); stroke(ctx, p.glow, 3);
    ctx.beginPath(); ctx.arc(0, 4, 22, 0.25 * Math.PI, 0.75 * Math.PI); stroke(ctx, p.glow, 4);
    for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 15.5, 20 - Math.abs(s) * 0); ctx.lineTo(s * 15.5 - 4, 14); ctx.lineTo(s * 15.5 + 4, 14); ctx.closePath(); ctx.fillStyle = p.glow; if (s) ctx.fill(); }
    ctx.beginPath();
    for (let x = -34; x <= 34; x += 2) ctx.lineTo(x, 32 + Math.sin(x * 0.35) * 3);
    stroke(ctx, p.accent, 2.4);
  },
  helix(ctx, p) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); }
    ctx.closePath(); ctx.fillStyle = p.primary; ctx.fill(); stroke(ctx, p.secondary, 2.4);
    for (const [sgn, col] of [[1, p.accent], [-1, p.glow]]) {
      ctx.beginPath();
      for (let y = -22; y <= 22; y += 1) ctx.lineTo(sgn * Math.sin(y * 0.22) * 11, y);
      stroke(ctx, col, 3);
    }
    for (let y = -18; y <= 18; y += 7) { ctx.beginPath(); ctx.moveTo(-Math.sin(y * 0.22) * 11, y); ctx.lineTo(Math.sin(y * 0.22) * 11, y); stroke(ctx, p.secondary, 1.2, 2); }
  },
  star(ctx, p) {
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 12, -0.4, 0, TAU); stroke(ctx, p.accent, 1.6);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU - Math.PI / 2, r = i % 2 ? 11 : (i % 4 ? 22 : 32); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = p.primary; ctx.fill(); stroke(ctx, p.secondary, 2);
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fillStyle = p.glow; ctx.fill(); stroke(ctx, p.accent, 1.5);
  },
  eye(ctx, p) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 10);
      ctx.quadraticCurveTo(Math.cos(a) * 26 + (i % 2 ? 6 : -6), Math.sin(a) * 26, Math.cos(a) * 36, Math.sin(a) * 36);
      stroke(ctx, p.accent, 2.2, 4);
    }
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, -30, 34, 0); ctx.quadraticCurveTo(0, 30, -34, 0);
    ctx.fillStyle = p.secondary; ctx.fill(); stroke(ctx, p.secondary, 1.5);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fillStyle = p.glow; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 3, 9, 0, 0, TAU); ctx.fillStyle = '#000'; ctx.fill();
  },
};

/** Data URL of a faction's emblem, `size` CSS px square (cached). */
export function emblemURL(fid, size = 96) {
  const key = `${fid}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const f = FACTIONS[fid];
  const c = document.createElement('canvas');
  const dpr = 2;
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d');
  ctx.scale((size * dpr) / 100, (size * dpr) / 100);
  ctx.translate(50, 50);
  // Badge: dark disc with a faction ring.
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fillStyle = 'rgba(6,8,12,0.92)'; ctx.fill();
  stroke(ctx, f.palette.glow, 2.4, 10);
  ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
  (MARKS[f.emblem] || MARKS.cog)(ctx, f.palette);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
