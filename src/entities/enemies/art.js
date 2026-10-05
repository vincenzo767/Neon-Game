import { mirrorPath, chrome, outline, glowDot, neonLines, neonStroke } from '../../fx/art.js';

// Procedural art for the syndicate fleet. Visual identity: dark gunmetal
// hulls, crimson/magenta neon, orange thrusters. Unless noted, enemies face
// DOWN (toward the player): the nose is at the bottom of the sprite.

const TAU = Math.PI * 2;
const RED = 'rgba(255,50,90,1)';
const MAG = 'rgba(255,60,200,1)';
const metal = (ctx, x0, x1) => chrome(ctx, x0, x1, '#120c12', '#4a3c4a', '#a8949f');
const dark = (ctx, x0, x1) => chrome(ctx, x0, x1, '#0b080c', '#2c242e', '#615463');

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function regular(ctx, cx, cy, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function bolts(ctx, pts, r = 0.7) {
  ctx.fillStyle = '#6b5d6a';
  for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], r, 0, TAU); ctx.fill(); }
}

// ------------------------------------------------------------------ air

function dart(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 4, 4, 12, 2, 12, 9, 5, 16, 3, 27, 0, 29]);
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx);
  neonLines(ctx, cx, [4, 5, 11.5, 3, 4.5, 16, 2.5, 26], RED, 0.7, 5);
  glowDot(ctx, cx, 4, 2.5, 'rgba(255,140,40,1)');
  ctx.fillStyle = '#ff3355'; ctx.beginPath(); ctx.ellipse(cx, 18, 1.5, 3.5, 0, 0, TAU); ctx.fill();
}

function car(ctx, w, h) {
  const cx = w / 2;
  // Underglow.
  ctx.save(); ctx.shadowColor = MAG; ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255,60,200,0.5)'; ctx.fillRect(3, 4, w - 6, h - 8);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(2.5, 2, w - 5, h - 4, 5);
  ctx.fillStyle = chrome(ctx, 0, w, '#1a0f22', '#5e2f6e', '#c08ad0'); ctx.fill(); outline(ctx);
  // Windshield (front = bottom) and rear window.
  ctx.fillStyle = 'rgba(20,30,50,0.95)';
  ctx.beginPath(); ctx.roundRect(5, h - 15, w - 10, 7, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(5.5, 7, w - 11, 5, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(140,200,255,0.5)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(6, h - 13); ctx.lineTo(w - 8, h - 14); ctx.stroke();
  glowDot(ctx, 6, h - 3, 2.6, 'rgba(255,250,220,1)');
  glowDot(ctx, w - 6, h - 3, 2.6, 'rgba(255,250,220,1)');
  ctx.fillStyle = '#ff2040'; ctx.fillRect(4, 2.5, 4, 1.4); ctx.fillRect(w - 8, 2.5, 4, 1.4);
}

function bike(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 3, 4, 4, 14, 3, 26, 0, 29]);
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx);
  neonLines(ctx, cx, [3.5, 6, 3.5, 24], MAG, 0.7, 5);
  ctx.fillStyle = '#20141c'; ctx.beginPath(); ctx.arc(cx, 13, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff2b66'; ctx.fillRect(cx - 2.5, 12, 5, 1.6);
  glowDot(ctx, cx, h - 2, 2.5, 'rgba(255,250,220,1)');
  glowDot(ctx, cx, 2, 2.2, 'rgba(255,40,60,1)');
}

function minelayer(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  regular(ctx, cx, cy, w / 2 - 1, 12);
  const g = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, w / 2);
  g.addColorStop(0, '#7a6a7a'); g.addColorStop(0.7, '#2a2030'); g.addColorStop(1, '#0c080e');
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 3.6, 0, TAU); ctx.fill();
    glowDot(ctx, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 2.2, RED);
  }
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU);
  ctx.fillStyle = 'rgba(255,80,160,0.35)'; ctx.fill(); neonStroke(ctx, MAG, 0.8, 6);
}

function gunship(ctx, w, h) {
  const cx = w / 2;
  // Tail boom (up), stub wings with rocket pods.
  ctx.fillStyle = dark(ctx, cx - 3, cx + 3); ctx.fillRect(cx - 2.5, 2, 5, 24); ctx.strokeStyle = '#05030a'; ctx.strokeRect(cx - 2.5, 2, 5, 24);
  ctx.fillStyle = '#211a26'; ctx.fillRect(cx - 9, 3, 18, 3);
  for (const s of [-1, 1]) {
    ctx.fillStyle = metal(ctx, 0, w); ctx.fillRect(cx + (s > 0 ? 10 : -24), 30, 14, 5); outline(ctx, 0.5);
    ctx.fillStyle = '#1a1218'; ctx.fillRect(cx + s * 20 - 3, 28, 6, 12); ctx.strokeStyle = '#05030a'; ctx.strokeRect(cx + s * 20 - 3, 28, 6, 12);
    glowDot(ctx, cx + s * 20, 40, 2, RED);
  }
  mirrorPath(ctx, cx, [0, 18, 7, 22, 10, 34, 8, 50, 4, 58, 0, 60]);
  ctx.fillStyle = metal(ctx, cx - 10, cx + 10); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(30,10,30,0.95)'; ctx.beginPath(); ctx.ellipse(cx, 49, 4.5, 6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,80,160,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  // Chin gun.
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(cx - 1, 57, 2, 6);
}

function rotor(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 1;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
  g.addColorStop(0, 'rgba(120,110,130,0.25)'); g.addColorStop(0.9, 'rgba(120,110,130,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(30,25,35,0.9)'; ctx.lineWidth = 2.4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
  }
  ctx.fillStyle = '#3a2c3e'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
}

function sniper(ctx, w, h) {
  const cx = w / 2;
  ctx.fillStyle = '#0a080c'; ctx.fillRect(cx - 1.4, 18, 2.8, h - 18);
  ctx.strokeStyle = 'rgba(255,50,90,0.8)'; ctx.lineWidth = 0.5; ctx.strokeRect(cx - 1.4, 18, 2.8, h - 18);
  regular(ctx, cx, 14, 12, 6, Math.PI / 6);
  ctx.fillStyle = metal(ctx, cx - 12, cx + 12); ctx.fill(); outline(ctx);
  glowDot(ctx, cx, 14, 5, RED);
  neonLines(ctx, cx, [6, 5, 11, 10], RED, 0.6, 4);
}

function laserpod(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  poly(ctx, [cx, h - 1, 1, 4, w - 1, 4]);
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx);
  ctx.beginPath(); ctx.arc(cx, cy + 2, 8, 0, TAU);
  ctx.fillStyle = '#100410'; ctx.fill(); neonStroke(ctx, MAG, 1, 6);
  glowDot(ctx, cx, cy + 2, 6, 'rgba(255,60,200,1)');
  bolts(ctx, [6, 7, w - 6, 7]);
}

function spinner(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, r = i % 2 ? 5 : w / 2 - 1;
    const a2 = a + (i % 2 ? 0 : 0.35);
    i ? ctx.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r) : ctx.moveTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
  }
  ctx.closePath();
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx);
  neonStroke(ctx, 'rgba(255,120,40,0.7)', 0.5, 4);
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fillStyle = '#140a10'; ctx.fill();
  glowDot(ctx, cx, cy, 3.5, 'rgba(255,140,40,1)');
}

function bug(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = 'rgba(160,255,120,0.35)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 5, cy - 2, 5, 2.4, s * 0.5, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(cx, cy, 3.4, 6, 0, 0, TAU);
  ctx.fillStyle = metal(ctx, cx - 4, cx + 4); ctx.fill(); outline(ctx, 0.6);
  glowDot(ctx, cx, cy + 3, 2, 'rgba(120,255,80,1)');
}

/** Faces +X (rotated to its flight heading). */
function bomber(ctx, w, h) {
  const cy = h / 2;
  poly(ctx, [w - 1, cy, w - 18, cy - 6, 30, cy - h / 2 + 2, 18, cy - h / 2 + 2, 24, cy - 8, 4, cy - 8, 1, cy - 3,
    1, cy + 3, 4, cy + 8, 24, cy + 8, 18, cy + h / 2 - 2, 30, cy + h / 2 - 2, w - 18, cy + 6]);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#120c12'); g.addColorStop(0.5, '#5a4858'); g.addColorStop(1, '#120c12');
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 1);
  neonLines(ctx, 0, [30, cy - h / 2 + 3, w - 18, cy - 5], RED, 0.8, 5);
  ctx.beginPath(); ctx.moveTo(30, cy + h / 2 - 3); ctx.lineTo(w - 18, cy + 5); neonStroke(ctx, RED, 0.8, 5);
  for (const oy of [-14, 14]) glowDot(ctx, 4, cy + oy * 0.5, 3, 'rgba(255,150,50,1)');
  ctx.fillStyle = 'rgba(30,10,30,0.95)'; ctx.beginPath(); ctx.ellipse(w - 14, cy, 5, 2.5, 0, 0, TAU); ctx.fill();
  // Bomb bay.
  ctx.fillStyle = '#0a060a'; ctx.fillRect(30, cy - 3, 16, 6);
  ctx.strokeStyle = 'rgba(255,60,90,0.6)'; ctx.lineWidth = 0.5; ctx.strokeRect(30, cy - 3, 16, 6);
}

function orbiter(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 2, 0, TAU);
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#2a2030'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 2, 0, TAU); neonStroke(ctx, 'rgba(120,255,160,0.9)', 0.8, 6);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    ctx.fillStyle = '#4a3c4a'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (w / 2 - 2), cy + Math.sin(a) * (w / 2 - 2), 2.6, 0, TAU); ctx.fill();
  }
  glowDot(ctx, cx, cy, 6, 'rgba(120,255,160,1)');
}

function splitter(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 8, 6, a, 0, TAU);
    ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx, 0.6);
  }
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fillStyle = '#1a0a0a'; ctx.fill();
  glowDot(ctx, cx, cy, 5, 'rgba(255,170,40,1)');
  ctx.strokeStyle = 'rgba(255,170,40,0.6)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
}

function seeker(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 6);
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx);
  for (const [ox, oy] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
    ctx.fillStyle = '#0a060c'; ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 4.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,110,255,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
    glowDot(ctx, cx + ox, cy + oy, 2.2, 'rgba(190,110,255,1)');
  }
  bolts(ctx, [cx, 7, cx, h - 7, 7, cy, w - 7, cy]);
}

function frigate(ctx, w, h) {
  const cx = w / 2;
  // Engine glow at the stern (top).
  for (const ox of [-14, 0, 14]) glowDot(ctx, cx + ox, 6, 6, 'rgba(255,140,50,1)');
  mirrorPath(ctx, cx, [0, 4, 18, 6, 22, 30, 46, 52, 46, 64, 22, 72, 18, 104, 8, 116, 0, 118]);
  ctx.fillStyle = metal(ctx, cx - 46, cx + 46); ctx.fill(); outline(ctx, 1.2);
  // Armour plates.
  ctx.strokeStyle = 'rgba(10,6,12,0.8)'; ctx.lineWidth = 0.8;
  for (const y of [20, 40, 72, 92]) { ctx.beginPath(); ctx.moveTo(cx - 18, y); ctx.lineTo(cx + 18, y); ctx.stroke(); }
  // Bridge.
  ctx.fillStyle = dark(ctx, cx - 9, cx + 9); ctx.fillRect(cx - 9, 44, 18, 22); outline(ctx);
  ctx.fillStyle = 'rgba(255,50,90,0.9)'; ctx.fillRect(cx - 7, 60, 14, 2);
  // Turret bumps.
  for (const [ox, oy] of [[-30, 58], [30, 58], [-10, 86], [10, 86], [0, 106]]) {
    ctx.fillStyle = '#2a2030'; ctx.beginPath(); ctx.arc(cx + ox, oy, 4.5, 0, TAU); ctx.fill(); outline(ctx, 0.6);
    glowDot(ctx, cx + ox, oy + 2, 2, RED);
  }
  neonLines(ctx, cx, [22, 31, 45, 52, 18, 72, 18, 104], RED, 0.8, 6);
}

function carrier(ctx, w, h) {
  const cx = w / 2;
  for (const ox of [-34, -12, 12, 34]) glowDot(ctx, cx + ox, 8, 7, 'rgba(255,140,50,1)');
  mirrorPath(ctx, cx, [0, 6, 22, 8, 26, 20, 62, 40, 64, 70, 40, 78, 26, 98, 12, 106, 0, 108]);
  ctx.fillStyle = metal(ctx, cx - 64, cx + 64); ctx.fill(); outline(ctx, 1.2);
  // Hangar bays (glowing doors).
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#0a060a'; ctx.fillRect(cx + s * 44 - 9, 46, 18, 20);
    const g = ctx.createLinearGradient(0, 46, 0, 66);
    g.addColorStop(0, 'rgba(255,60,120,0.1)'); g.addColorStop(1, 'rgba(255,60,120,0.9)');
    ctx.fillStyle = g; ctx.fillRect(cx + s * 44 - 7, 48, 14, 16);
  }
  ctx.fillStyle = dark(ctx, cx - 14, cx + 14); ctx.fillRect(cx - 14, 30, 28, 46); outline(ctx);
  ctx.strokeStyle = 'rgba(10,6,12,0.8)';
  for (let y = 34; y < 76; y += 6) { ctx.beginPath(); ctx.moveTo(cx - 12, y); ctx.lineTo(cx + 12, y); ctx.stroke(); }
  neonLines(ctx, cx, [26, 21, 62, 41, 26, 98, 12, 106], MAG, 0.9, 6);
  glowDot(ctx, cx, 96, 5, RED);
}

function fortress(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  regular(ctx, cx, cy, h / 2 - 2, 6, Math.PI / 6);
  ctx.fillStyle = metal(ctx, 0, w); ctx.fill(); outline(ctx, 1.4);
  regular(ctx, cx, cy, h / 2 - 14, 6, Math.PI / 6);
  ctx.fillStyle = dark(ctx, 0, w); ctx.fill(); outline(ctx);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const x = cx + Math.cos(a) * (h / 2 - 8), y = cy + Math.sin(a) * (h / 2 - 8);
    ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); outline(ctx, 0.6);
    glowDot(ctx, x, y, 3.5, RED);
  }
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fillStyle = '#10040c'; ctx.fill();
  neonStroke(ctx, MAG, 1.4, 10);
  glowDot(ctx, cx, cy, 15, 'rgba(255,60,200,1)');
}

// ------------------------------------------------------------- ground

function turretBase(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  regular(ctx, cx, cy, w / 2 - 1, 8, Math.PI / 8);
  ctx.fillStyle = dark(ctx, 0, w); ctx.fill(); outline(ctx);
  regular(ctx, cx, cy, w / 2 - 5, 8, Math.PI / 8);
  ctx.strokeStyle = 'rgba(255,50,90,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
  bolts(ctx, [cx - 9, cy - 9, cx + 9, cy - 9, cx - 9, cy + 9, cx + 9, cy + 9]);
}

/** Barrel facing +X from the sprite centre (rotated to aim). */
function turretGun(ctx, w, h) {
  const cy = h / 2;
  ctx.fillStyle = metal(ctx, 0, w); ctx.fillRect(w / 2, cy - 2, w / 2 - 1, 4); outline(ctx, 0.5);
  ctx.beginPath(); ctx.arc(w / 2, cy, 6.5, 0, TAU);
  ctx.fillStyle = metal(ctx, w / 2 - 6, w / 2 + 6); ctx.fill(); outline(ctx);
  glowDot(ctx, w / 2, cy, 2.2, RED);
}

function flakBase(ctx, w, h) {
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 4);
  ctx.fillStyle = dark(ctx, 0, w); ctx.fill(); outline(ctx);
  ctx.save(); ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 4); ctx.clip();
  for (let k = -6; k < 12; k++) {
    ctx.fillStyle = k & 1 ? '#111' : 'rgba(255,150,30,0.6)';
    ctx.beginPath(); ctx.moveTo(k * 4, 0); ctx.lineTo(k * 4 + 4, 0); ctx.lineTo(k * 4 - 2, 5); ctx.lineTo(k * 4 - 6, 5); ctx.fill();
  }
  ctx.restore();
  bolts(ctx, [6, h - 6, w - 6, h - 6]);
}

function flakGun(ctx, w, h) {
  const cy = h / 2, cx = w / 2;
  for (const oy of [-3.5, 3.5]) { ctx.fillStyle = metal(ctx, 0, w); ctx.fillRect(cx, cy + oy - 1.5, w / 2 - 1, 3); outline(ctx, 0.4); }
  ctx.beginPath(); ctx.roundRect(cx - 7, cy - 6.5, 14, 13, 3);
  ctx.fillStyle = metal(ctx, cx - 7, cx + 7); ctx.fill(); outline(ctx);
  glowDot(ctx, cx, cy, 2.2, 'rgba(255,150,40,1)');
}

function truck(ctx, w, h) {
  const cx = w / 2;
  // Hover pads.
  for (const y of [14, 40, 66]) for (const s of [-1, 1]) glowDot(ctx, cx + s * (w / 2 - 3), y, 4, 'rgba(255,60,120,0.9)');
  // Cargo (rear, top) + cab (front, bottom).
  ctx.beginPath(); ctx.roundRect(4, 2, w - 8, 56, 2);
  ctx.fillStyle = metal(ctx, 4, w - 4); ctx.fill(); outline(ctx);
  ctx.strokeStyle = 'rgba(10,6,12,0.8)'; ctx.lineWidth = 0.9;
  for (let y = 8; y < 56; y += 7) { ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w - 6, y); ctx.stroke(); }
  ctx.beginPath(); ctx.roundRect(6, 60, w - 12, h - 62, 4);
  ctx.fillStyle = dark(ctx, 6, w - 6); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(20,30,50,0.95)'; ctx.fillRect(9, h - 12, w - 18, 5);
  glowDot(ctx, 10, h - 3, 2.6, 'rgba(255,250,220,1)'); glowDot(ctx, w - 10, h - 3, 2.6, 'rgba(255,250,220,1)');
  // Roof mortar.
  ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.arc(cx, 28, 7, 0, TAU); ctx.fill(); outline(ctx);
  glowDot(ctx, cx, 28, 3.5, RED);
}

function walker(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.strokeStyle = '#2a222c'; ctx.lineWidth = 4;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * 12, cy + dy * 8); ctx.lineTo(cx + dx * 20, cy + dy * 18); ctx.stroke();
  }
  ctx.strokeStyle = '#05030a'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.roundRect(cx - 11, cy - 11, 22, 20, 4);
  ctx.fillStyle = metal(ctx, cx - 11, cx + 11); ctx.fill(); outline(ctx);
  glowDot(ctx, cx, cy + 2, 3.5, RED);
  // Front energy shield (bottom).
  ctx.beginPath(); ctx.arc(cx, cy - 6, 22, 0.35, Math.PI - 0.35);
  ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,80,200,0.45)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - 6, 22, 0.35, Math.PI - 0.35); neonStroke(ctx, MAG, 0.8, 8);
}

function tank(ctx, w, h) {
  const cx = w / 2;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#16101a'; ctx.fillRect(cx + (s > 0 ? 13 : -21), 4, 8, h - 8); outline(ctx, 0.6);
    for (let y = 7; y < h - 6; y += 5) glowDot(ctx, cx + s * 17, y, 1.4, 'rgba(255,60,120,0.7)');
  }
  ctx.beginPath(); ctx.roundRect(cx - 14, 6, 28, h - 12, 3);
  ctx.fillStyle = metal(ctx, cx - 14, cx + 14); ctx.fill(); outline(ctx);
  ctx.strokeStyle = 'rgba(10,6,12,0.8)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - 12, 14); ctx.lineTo(cx + 12, 14); ctx.moveTo(cx - 12, h - 14); ctx.lineTo(cx + 12, h - 14); ctx.stroke();
}

function tankGun(ctx, w, h) {
  const cy = h / 2, cx = w / 2;
  ctx.fillStyle = metal(ctx, 0, w); ctx.fillRect(cx, cy - 2.2, w / 2 - 1, 4.4); outline(ctx, 0.5);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(w - 4, cy - 2.8, 3, 5.6);
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU);
  ctx.fillStyle = dark(ctx, cx - 9, cx + 9); ctx.fill(); outline(ctx);
  glowDot(ctx, cx - 2, cy, 2.4, RED);
}

/** Register every enemy sprite in the atlas. */
export function buildEnemySprites(atlas) {
  const add = (name, w, h, fn, scale = 2.5) => atlas.add(name, w, h, fn, { scale });
  add('e_dart', 26, 30, dart, 3);
  add('e_car', 22, 38, car, 3);
  add('e_bike', 14, 30, bike, 3);
  add('e_minelayer', 46, 46, minelayer);
  add('e_gunship', 54, 64, gunship);
  add('e_rotor', 70, 70, rotor, 2);
  add('e_sniper', 28, 44, sniper, 3);
  add('e_laserpod', 36, 36, laserpod);
  add('e_spinner', 32, 32, spinner);
  add('e_bug', 18, 16, bug, 3);
  add('e_bomber', 80, 56, bomber, 2);
  add('e_orbiter', 30, 30, orbiter);
  add('e_splitter', 34, 34, splitter);
  add('e_seeker', 38, 38, seeker);
  add('e_frigate', 96, 120, frigate, 2);
  add('e_carrier', 130, 110, carrier, 2);
  add('e_fortress', 150, 130, fortress, 1.6);
  add('e_turret', 30, 30, turretBase);
  add('e_turret_gun', 30, 14, turretGun, 3);
  add('e_flak', 36, 36, flakBase);
  add('e_flak_gun', 36, 16, flakGun, 3);
  add('e_truck', 40, 82, truck);
  add('e_walker', 46, 46, walker);
  add('e_tank', 42, 50, tank);
  add('e_tank_gun', 44, 20, tankGun, 2.5);
}
