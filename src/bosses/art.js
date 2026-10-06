import { mirrorPath, chrome, outline, glowDot, neonLines, neonStroke, vgrad } from '../fx/art.js';
import { BULLET_COLORS } from '../fx/sprites.js';

// Procedural art for the six archetype bosses, their breakable parts and a
// few boss-only effect sprites. Same conventions as enemy art: drawn in
// world units, facing DOWN (toward the player).
//
// Palettes by archetype:
//   ground  gunmetal + rust, hazard orange      aerial  steel blue + cyan
//   sea     navy grey + amber searchlights      mecha   white armour + red visor
//   alien   violet carapace + acid green        abyssal flesh black-purple + bone

const TAU = Math.PI * 2;
const metal = (ctx, x0, x1) => chrome(ctx, x0, x1, '#120f0d', '#4c4640', '#b4aaa0');
const rust = (ctx, x0, x1) => chrome(ctx, x0, x1, '#140a06', '#5a3420', '#b0805a');
const steel = (ctx, x0, x1) => chrome(ctx, x0, x1, '#0a1018', '#3a5070', '#b8d0ee');
const navy = (ctx, x0, x1) => chrome(ctx, x0, x1, '#080c12', '#2c3644', '#8a98aa');
const ivory = (ctx, x0, x1) => chrome(ctx, x0, x1, '#16161e', '#5c6072', '#b4b8c8');

const ORANGE = 'rgba(255,140,40,1)';
const CYAN = 'rgba(90,230,255,1)';
const AMBER = 'rgba(255,200,80,1)';
const RED = 'rgba(255,40,70,1)';
const ACID = 'rgba(120,255,110,1)';
const VIOLET = 'rgba(190,90,255,1)';
const BLOOD = 'rgba(255,40,40,1)';

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

function hlines(ctx, x0, x1, y0, y1, step, color = 'rgba(0,0,0,0.55)', width = 0.7) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
}

// ================================================================ GROUND

/** Colossus Crawler: four-tread siege platform with a central main gun. */
function crawler(ctx, w, h) {
  const cx = w / 2;
  for (const ox of [-24, 0, 24]) glowDot(ctx, cx + ox, 8, 8, ORANGE);
  // Treads (outer + inner on each side).
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [[62, 84], [46, 60]]) {
      const xa = cx + s * x0, xb = cx + s * x1, l = Math.min(xa, xb), r = Math.max(xa, xb);
      ctx.fillStyle = '#0d0b0a'; ctx.beginPath(); ctx.roundRect(l, 10, r - l, h - 20, 4); ctx.fill(); outline(ctx);
      hlines(ctx, l + 1, r - 1, 13, h - 12, 4.5, 'rgba(110,100,90,0.6)', 1);
      for (let y = 22; y < h - 14; y += 22) { circle(ctx, (l + r) / 2, y, (r - l) * 0.3); ctx.fillStyle = metal(ctx, l, r); ctx.fill(); outline(ctx, 0.5); }
    }
  }
  // Hull.
  mirrorPath(ctx, cx, [0, 14, 30, 16, 46, 28, 48, 112, 40, 132, 18, 142, 0, 144]);
  ctx.fillStyle = rust(ctx, cx - 48, cx + 48); ctx.fill(); outline(ctx, 1.3);
  hlines(ctx, cx - 40, cx + 40, 36, 120, 21, 'rgba(10,5,2,0.75)', 0.9);
  // Hazard stripes on the bow.
  ctx.save(); mirrorPath(ctx, cx, [0, 124, 40, 124, 40, 132, 18, 142, 0, 144]); ctx.clip();
  for (let x = cx - 50; x < cx + 50; x += 8) { poly(ctx, [x, 120, x + 4, 120, x - 6, 146, x - 10, 146]); ctx.fillStyle = 'rgba(255,170,30,0.85)'; ctx.fill(); }
  ctx.restore();
  // Vents.
  for (const s of [-1, 1]) for (const y of [40, 56, 72]) {
    ctx.fillStyle = '#0a0503'; ctx.fillRect(cx + s * 34 - 5, y, 10, 6);
    glowDot(ctx, cx + s * 34, y + 3, 4, ORANGE);
  }
  // Main turret + gun (fixed, facing down).
  ctx.fillStyle = metal(ctx, cx - 7, cx + 7); ctx.fillRect(cx - 6, 84, 12, 62); outline(ctx);
  ctx.fillStyle = '#1a1410'; ctx.fillRect(cx - 7, 138, 14, 8);
  circle(ctx, cx, 74, 24); ctx.fillStyle = metal(ctx, cx - 24, cx + 24); ctx.fill(); outline(ctx, 1.1);
  circle(ctx, cx, 74, 14); ctx.fillStyle = rust(ctx, cx - 14, cx + 14); ctx.fill(); outline(ctx);
  glowDot(ctx, cx, 74, 7, RED);
  neonLines(ctx, cx, [46, 30, 48, 110, 18, 141, 40, 131], ORANGE, 0.9, 6);
}

function mortar(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 5);
  ctx.fillStyle = rust(ctx, 0, w); ctx.fill(); outline(ctx);
  for (const [ox, oy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    circle(ctx, cx + ox, cy + oy, 4.6); ctx.fillStyle = '#0a0604'; ctx.fill(); outline(ctx, 0.5);
    glowDot(ctx, cx + ox, cy + oy, 2.4, ORANGE);
  }
}

// ================================================================ AERIAL

/** Skywarden Carrier: flying-wing carrier with hangar bays. */
function carrier(ctx, w, h) {
  const cx = w / 2;
  for (const ox of [-60, -22, 22, 60]) glowDot(ctx, cx + ox, 12, 9, CYAN);
  mirrorPath(ctx, cx, [0, 6, 30, 10, 62, 24, 98, 46, 98, 58, 72, 64, 48, 86, 26, 114, 0, 122]);
  ctx.fillStyle = steel(ctx, cx - 98, cx + 98); ctx.fill(); outline(ctx, 1.3);
  // Panel lines.
  ctx.strokeStyle = 'rgba(5,10,20,0.7)'; ctx.lineWidth = 0.7;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 30, 12); ctx.lineTo(cx + s * 30, 100); ctx.moveTo(cx + s * 62, 26); ctx.lineTo(cx + s * 60, 64); ctx.stroke(); }
  // Hangar bays.
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#04070c'; ctx.fillRect(cx + s * 46 - 11, 38, 22, 20);
    const g = vgrad(ctx, 38, 58, 'rgba(90,230,255,0.05)', 'rgba(90,230,255,0.85)');
    ctx.fillStyle = g; ctx.fillRect(cx + s * 46 - 9, 40, 18, 16);
    hlines(ctx, cx + s * 46 - 9, cx + s * 46 + 9, 42, 56, 3, 'rgba(0,20,30,0.6)', 0.5);
  }
  // Bridge spine.
  mirrorPath(ctx, cx, [0, 20, 10, 24, 12, 90, 6, 104, 0, 106]);
  ctx.fillStyle = navy(ctx, cx - 12, cx + 12); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(150,240,255,0.9)'; ctx.fillRect(cx - 6, 86, 12, 3);
  glowDot(ctx, cx, 98, 6, CYAN);
  neonLines(ctx, cx, [62, 25, 97, 46, 48, 86, 26, 113, 72, 64, 48, 86], CYAN, 0.9, 7);
  // Wingtip lights.
  glowDot(ctx, cx - 96, 52, 4, RED); glowDot(ctx, cx + 96, 52, 4, 'rgba(80,255,120,1)');
}

function wingPod(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 2, 8, 6, 11, 22, 8, h - 6, 3, h - 2, 0, h - 1]);
  ctx.fillStyle = steel(ctx, cx - 11, cx + 11); ctx.fill(); outline(ctx);
  for (const s of [-1, 1]) { ctx.fillStyle = '#05080e'; ctx.fillRect(cx + s * 5 - 1.5, h - 10, 3, 9); }
  glowDot(ctx, cx, 14, 4, CYAN);
  neonLines(ctx, cx, [9, 8, 10, 22], CYAN, 0.6, 4);
}

function interceptor(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 1, 3, 6, 10, 10, 10, 14, 3, 16, 2, 21, 0, 22]);
  ctx.fillStyle = steel(ctx, 0, w); ctx.fill(); outline(ctx, 0.6);
  glowDot(ctx, cx, 4, 2.5, CYAN);
  glowDot(ctx, cx, 17, 2, RED);
}

// =================================================================== SEA

function leviathanHull(ctx, w, h, sub) {
  const cx = w / 2;
  const hull = [0, 4, 22, 10, 42, 34, 48, 74, 48, 150, 38, 186, 18, 206, 0, 210];
  if (sub) {
    // Submerged: dark silhouette under water, periscope wake.
    mirrorPath(ctx, cx, hull);
    ctx.fillStyle = 'rgba(4,14,26,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.5)';
    for (let k = 0; k < 7; k++) { circle(ctx, cx + (k % 2 ? 4 : -4), 112 + k * 9, 2.4 - k * 0.25); ctx.fill(); }
    glowDot(ctx, cx, 110, 4, 'rgba(255,220,120,0.9)');
    return;
  }
  // Wake foam at the stern (top).
  for (let k = 0; k < 6; k++) glowDot(ctx, cx + (k - 2.5) * 9, 6, 7, 'rgba(220,245,255,0.8)');
  mirrorPath(ctx, cx, hull);
  ctx.fillStyle = navy(ctx, cx - 48, cx + 48); ctx.fill(); outline(ctx, 1.3);
  // Deck.
  mirrorPath(ctx, cx, [0, 14, 18, 18, 34, 40, 38, 76, 38, 148, 30, 180, 14, 198, 0, 201]);
  ctx.fillStyle = chrome(ctx, cx - 38, cx + 38, '#16110c', '#4a3a28', '#8a7050'); ctx.fill(); outline(ctx, 0.6);
  hlines(ctx, cx - 36, cx + 36, 24, 196, 5, 'rgba(20,12,6,0.45)', 0.5);
  // Superstructure + bridge windows.
  mirrorPath(ctx, cx, [0, 78, 16, 82, 18, 122, 10, 130, 0, 131]);
  ctx.fillStyle = navy(ctx, cx - 18, cx + 18); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(255,215,110,0.95)';
  for (let x = -12; x <= 9; x += 5) ctx.fillRect(cx + x, 118, 3, 2);
  // Funnels.
  for (const y of [88, 102]) { ctx.fillStyle = '#0a0d12'; ctx.fillRect(cx - 5, y, 10, 8); glowDot(ctx, cx, y + 4, 3, ORANGE); }
  // Turret rings (deck guns are breakable parts that sit on these).
  for (const [ox, oy] of [[0, 52], [0, 158], [0, 182], [-30, 100], [30, 100]]) {
    circle(ctx, cx + ox, oy, 9); ctx.fillStyle = '#16120e'; ctx.fill(); outline(ctx, 0.6);
  }
  // Broadside gun ports.
  for (const s of [-1, 1]) for (let y = 60; y < 150; y += 14) glowDot(ctx, cx + s * 46, y, 2.6, AMBER);
  neonLines(ctx, cx, [42, 35, 48, 74, 48, 150, 38, 186], AMBER, 0.8, 6);
}
const leviathan = (ctx, w, h) => leviathanHull(ctx, w, h, false);
const leviathanSub = (ctx, w, h) => leviathanHull(ctx, w, h, true);

function torpedo(ctx, w, h) {
  const cx = w / 2;
  mirrorPath(ctx, cx, [0, 0, 2.5, 3, 3, h - 4, 1.5, h, 0, h]);
  ctx.fillStyle = navy(ctx, cx - 3, cx + 3); ctx.fill(); outline(ctx, 0.4);
  glowDot(ctx, cx, 2, 2.5, 'rgba(255,90,60,1)');
}

// ================================================================= MECHA

/** Titan Enforcer, front view. form 0 armoured, 1 wings deployed, 2 burning core. */
function titan(form) {
  return (ctx, w, h) => {
    const cx = w / 2;
    const hot = form === 2;
    if (form >= 1) {
      // Energy wings behind the shoulders.
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          poly(ctx, [cx + s * 30, 34 + k * 6, cx + s * (70 - k * 2), 6 + k * 14, cx + s * (72 - k * 3), 18 + k * 14, cx + s * 34, 42 + k * 6]);
          ctx.fillStyle = hot ? `rgba(255,${60 + k * 30},40,0.55)` : `rgba(${90 + k * 30},200,255,0.5)`;
          ctx.fill(); neonStroke(ctx, hot ? RED : CYAN, 0.6, 6);
        }
      }
    }
    // Legs (thrusters at the bottom).
    for (const s of [-1, 1]) {
      mirrorPath(ctx, cx + s * 18, [0, 86, 9, 90, 10, 126, 6, 134, 0, 136]);
      ctx.fillStyle = ivory(ctx, cx + s * 18 - 10, cx + s * 18 + 10); ctx.fill(); outline(ctx);
      glowDot(ctx, cx + s * 18, 136, 6, hot ? ORANGE : CYAN);
    }
    // Arms + blades.
    for (const s of [-1, 1]) {
      poly(ctx, [cx + s * 40, 40, cx + s * 54, 46, cx + s * 52, 92, cx + s * 42, 96, cx + s * 36, 60]);
      ctx.fillStyle = ivory(ctx, cx + s * 36, cx + s * 54); ctx.fill(); outline(ctx);
      poly(ctx, [cx + s * 46, 92, cx + s * 50, 92, cx + s * 52, 142, cx + s * 47, 138]);
      ctx.fillStyle = hot ? 'rgba(255,120,80,0.95)' : 'rgba(200,240,255,0.95)'; ctx.fill(); neonStroke(ctx, hot ? RED : CYAN, 0.7, 8);
    }
    // Torso.
    mirrorPath(ctx, cx, [0, 30, 22, 32, 34, 42, 30, 70, 20, 90, 0, 94]);
    ctx.fillStyle = ivory(ctx, cx - 34, cx + 34); ctx.fill(); outline(ctx, 1.1);
    // Shoulder armour.
    for (const s of [-1, 1]) {
      poly(ctx, [cx + s * 22, 28, cx + s * 46, 30, cx + s * 52, 46, cx + s * 30, 48]);
      ctx.fillStyle = ivory(ctx, cx + s * 22, cx + s * 52); ctx.fill(); outline(ctx);
      ctx.fillStyle = hot ? '#401010' : '#c02030'; ctx.fillRect(cx + s * 37 - 4, 36, 8, 3);
    }
    // Chest core.
    circle(ctx, cx, 60, form >= 1 ? 11 : 8);
    ctx.fillStyle = '#0a0c14'; ctx.fill(); outline(ctx);
    glowDot(ctx, cx, 60, form >= 1 ? 12 : 8, hot ? 'rgba(255,60,30,1)' : form === 1 ? CYAN : 'rgba(255,80,90,1)');
    // Head + visor.
    mirrorPath(ctx, cx, [0, 10, 8, 12, 10, 24, 6, 30, 0, 31]);
    ctx.fillStyle = ivory(ctx, cx - 10, cx + 10); ctx.fill(); outline(ctx);
    ctx.fillStyle = RED; ctx.save(); ctx.shadowColor = RED; ctx.shadowBlur = 6; ctx.fillRect(cx - 7, 20, 14, 2.6); ctx.restore();
    // Antenna.
    neonLines(ctx, cx, [3, 12, 12, 2], hot ? RED : '#ffd060', 0.7, 4);
    if (hot) {
      // Cracked armour glowing from inside.
      ctx.strokeStyle = 'rgba(255,90,40,0.95)'; ctx.lineWidth = 0.8;
      ctx.save(); ctx.shadowColor = RED; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 20, 38); ctx.lineTo(cx - 10, 50); ctx.lineTo(cx - 14, 66);
      ctx.moveTo(cx + 24, 44); ctx.lineTo(cx + 12, 54); ctx.lineTo(cx + 18, 78);
      ctx.moveTo(cx - 6, 74); ctx.lineTo(cx + 4, 86);
      ctx.stroke(); ctx.restore();
    }
  };
}

function shoulderCannon(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath(); ctx.roundRect(4, 2, w - 8, h - 10, 4);
  ctx.fillStyle = ivory(ctx, 4, w - 4); ctx.fill(); outline(ctx);
  for (const s of [-1, 1]) { ctx.fillStyle = '#20222c'; ctx.fillRect(cx + s * 5 - 2, h - 12, 4, 11); outline(ctx, 0.4); }
  glowDot(ctx, cx, 10, 4, RED);
}

// ================================================================= ALIEN

/** Hive Sovereign: organic carapace with crystal spines and a green eye-core. */
function hive(ctx, w, h) {
  const cx = w / 2, cy = h * 0.45;
  // Tendril fins.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i - 2.5) * 0.42;
    const x1 = cx + Math.cos(a) * 74, y1 = cy + Math.sin(a) * 70;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.25) * 30, cy + Math.sin(a - 0.25) * 30);
    ctx.quadraticCurveTo(cx + Math.cos(a) * 60 - 8, cy + Math.sin(a) * 50, x1, y1);
    ctx.quadraticCurveTo(cx + Math.cos(a) * 60 + 8, cy + Math.sin(a) * 54, cx + Math.cos(a + 0.25) * 30, cy + Math.sin(a + 0.25) * 30);
    ctx.fillStyle = 'rgba(60,20,80,0.95)'; ctx.fill(); neonStroke(ctx, ACID, 0.6, 5);
  }
  // Back spines.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    poly(ctx, [cx + Math.cos(a - 0.08) * 34, cy + Math.sin(a - 0.08) * 34, cx + Math.cos(a) * (62 + (i % 2) * 12), cy + Math.sin(a) * (58 + (i % 2) * 10), cx + Math.cos(a + 0.08) * 34, cy + Math.sin(a + 0.08) * 34]);
    ctx.fillStyle = 'rgba(170,110,255,0.85)'; ctx.fill(); neonStroke(ctx, VIOLET, 0.5, 6);
  }
  // Carapace.
  ctx.beginPath(); ctx.ellipse(cx, cy, 44, 40, 0, 0, TAU);
  const g = ctx.createRadialGradient(cx - 12, cy - 14, 4, cx, cy, 46);
  g.addColorStop(0, '#9a70c0'); g.addColorStop(0.55, '#3a1a58'); g.addColorStop(1, '#10061c');
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.2);
  // Ridges.
  ctx.strokeStyle = 'rgba(200,150,255,0.35)'; ctx.lineWidth = 0.8;
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, 44 - k * 9, 40 - k * 8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  // Eye-core.
  ctx.beginPath(); ctx.ellipse(cx, cy + 8, 16, 12, 0, 0, TAU); ctx.fillStyle = '#041004'; ctx.fill();
  glowDot(ctx, cx, cy + 8, 15, ACID);
  ctx.fillStyle = '#020a02'; ctx.beginPath(); ctx.ellipse(cx, cy + 8, 2.5, 9, 0, 0, TAU); ctx.fill();
}

function crystalNode(ctx, w, h) {
  const cx = w / 2;
  poly(ctx, [cx, 1, cx + 10, 14, cx + 6, h - 2, cx - 6, h - 2, cx - 10, 14]);
  const g = vgrad(ctx, 0, h, 'rgba(230,200,255,0.95)', 'rgba(110,40,200,0.95)');
  ctx.fillStyle = g; ctx.fill(); neonStroke(ctx, VIOLET, 0.8, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx, h - 3); ctx.moveTo(cx - 9, 14); ctx.lineTo(cx + 9, 14); ctx.stroke();
  glowDot(ctx, cx, h * 0.55, 5, ACID);
}

function alienCore(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 2, 6 + i, (i / 3) * Math.PI, 0, TAU);
    ctx.strokeStyle = 'rgba(140,255,120,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  glowDot(ctx, cx, cy, w * 0.36, ACID);
  circle(ctx, cx, cy, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
}

// =============================================================== ABYSSAL

/** Maw of the Deep Below. open = jaws spread, gullet burning. */
function maw(open) {
  return (ctx, w, h) => {
    const cx = w / 2, cy = h * 0.5;
    const R = h * 0.46;
    // Tentacle stubs around the rim.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.1;
      const r0 = R * 0.9, r1 = R * (1.12 + (i % 3) * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.12) * r0, cy + Math.sin(a - 0.12) * r0 * 0.8);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.1) * r1 * 1.05, cy + Math.sin(a + 0.1) * r1 * 0.82, cx + Math.cos(a + 0.05) * r1, cy + Math.sin(a + 0.05) * r1 * 0.8);
      ctx.lineTo(cx + Math.cos(a + 0.12) * r0, cy + Math.sin(a + 0.12) * r0 * 0.8);
      ctx.fillStyle = '#1a0a1e'; ctx.fill(); ctx.strokeStyle = 'rgba(150,60,170,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    // Fleshy ring.
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.8, 0, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
    g.addColorStop(0, '#2a0812'); g.addColorStop(0.7, '#3c1430'); g.addColorStop(1, '#12040e');
    ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.4);
    // Wrinkles.
    ctx.strokeStyle = 'rgba(120,40,90,0.5)'; ctx.lineWidth = 0.7;
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * TAU;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.5);
      ctx.lineTo(cx + Math.cos(a + 0.05) * R * 0.92, cy + Math.sin(a + 0.05) * R * 0.74); ctx.stroke();
    }
    // Gullet.
    const gr = R * (open ? 0.56 : 0.42);
    ctx.beginPath(); ctx.ellipse(cx, cy, gr, gr * 0.8, 0, 0, TAU);
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    gg.addColorStop(0, open ? '#ff6a30' : '#600010'); gg.addColorStop(0.45, open ? '#a00818' : '#200008'); gg.addColorStop(1, '#050002');
    ctx.fillStyle = gg; ctx.fill();
    // Teeth rings.
    for (const [rr, n, len] of [[gr * 1.02, 18, gr * 0.32], [gr * 0.7, 12, gr * 0.22]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (rr < gr ? 0.15 : 0);
        const bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr * 0.8;
        const tx = cx + Math.cos(a) * (rr - len), ty = cy + Math.sin(a) * (rr - len) * 0.8;
        const px = -Math.sin(a) * 3.2, py = Math.cos(a) * 3.2 * 0.8;
        poly(ctx, [bx + px, by + py, tx, ty, bx - px, by - py]);
        ctx.fillStyle = '#e8dcc8'; ctx.fill(); ctx.strokeStyle = 'rgba(40,20,20,0.8)'; ctx.lineWidth = 0.4; ctx.stroke();
      }
    }
    if (open) glowDot(ctx, cx, cy, gr * 0.5, BLOOD);
  };
}

function eye(open) {
  return (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
    ctx.fillStyle = '#2a0a20'; ctx.fill(); outline(ctx);
    if (!open) {
      ctx.strokeStyle = 'rgba(160,70,140,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(4, cy); ctx.quadraticCurveTo(cx, cy + 5, w - 4, cy); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 3, h / 2 - 3, 0, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, w / 2);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.35, '#ffb020'); g.addColorStop(0.8, '#a01010'); g.addColorStop(1, '#300008');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#050000'; ctx.beginPath(); ctx.ellipse(cx, cy, 2.2, h / 2 - 5, 0, 0, TAU); ctx.fill();
    // Veins.
    ctx.strokeStyle = 'rgba(200,20,30,0.7)'; ctx.lineWidth = 0.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * (w / 2 - 3), cy - 2); ctx.lineTo(cx + s * 8, cy + 1); ctx.stroke(); }
  };
}

// ============================================================ BOSS FX

/** Black veil with a soft transparent hole (vision radius). */
function darkHole(ctx, w, h) {
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.92)'); g.addColorStop(0.8, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Faded copies of the violet orb (ghost bullets fade in and out). */
function ghostOrb(alpha, big) {
  const col = BULLET_COLORS.violet;
  return (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, R = w / 2 - 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0a0612'; circle(ctx, cx, cy, R); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f0e6ff');
    g.addColorStop(1, `rgba(${col.map((c) => Math.round(c * 255)).join(',')},1)`);
    ctx.fillStyle = g; circle(ctx, cx, cy, R * 0.8); ctx.fill();
    if (big) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.6; circle(ctx, cx, cy, R * 0.55); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
}

function tendril(ctx, w, h) {
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(70,20,80,1)'); g.addColorStop(0.5, 'rgba(150,60,170,1)');
  g.addColorStop(0.7, 'rgba(70,20,80,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(230,200,190,0.8)';
  for (let x = 3; x < w; x += 7) { poly(ctx, [x, cy - 3, x + 3, cy - 7, x + 2, cy - 2]); ctx.fill(); poly(ctx, [x + 3, cy + 3, x + 6, cy + 7, x + 5, cy + 2]); ctx.fill(); }
}

export const GHOST_LEVELS = 4;

export function buildBossSprites(atlas) {
  const add = (name, w, h, fn, scale = 1.3) => atlas.add(name, w, h, fn, { scale });
  add('b_crawler', 170, 150, crawler);
  add('bp_mortar', 30, 30, mortar, 2.5);
  add('b_carrier', 200, 126, carrier);
  add('bp_wingpod', 22, 40, wingPod, 2.5);
  add('b_interceptor', 20, 22, interceptor, 3);
  add('b_leviathan', 100, 212, leviathan, 1.2);
  add('b_leviathan_sub', 100, 212, leviathanSub, 1);
  add('b_torpedo', 7, 22, torpedo, 3);
  add('b_titan_a', 150, 146, titan(0));
  add('b_titan_b', 150, 146, titan(1));
  add('b_titan_c', 150, 146, titan(2));
  add('bp_shoulder', 26, 30, shoulderCannon, 2.5);
  add('b_hive', 170, 150, hive);
  add('bp_crystal', 22, 36, crystalNode, 2.5);
  add('bp_alien_core', 30, 30, alienCore, 2.5);
  add('b_maw', 210, 170, maw(false), 1.2);
  add('b_maw_open', 210, 170, maw(true), 1.2);
  add('bp_eye', 30, 22, eye(true), 2.5);
  add('bp_eye_shut', 30, 22, eye(false), 2.5);
  add('fx_darkhole', 128, 128, darkHole, 1);
  add('fx_tendril', 28, 16, tendril, 2);
  const A = [0.62, 0.34, 0.15, 0.04];
  for (let k = 0; k < GHOST_LEVELS; k++) {
    add(`ghost_orb_${k}`, 12, 12, ghostOrb(A[k], false), 3);
    add(`ghost_big_${k}`, 26, 26, ghostOrb(A[k], true), 2.5);
  }
}
