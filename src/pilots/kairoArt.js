import { pilotArt } from '../core/pilotArt.js';
import { FADE_OUT } from '../fx/Particles.js';

// KAIRO ART TEST (KAIRO_ART_TEST.md): the hand-made Stormlance mecha and its
// code-built effects. Everything here is visual, except `anchor()`, which
// also places Kairo's real shot origins (the rifles, approved in Step 1).
//
// The sprite is split at atlas-build time into three layers with feathered
// masks (public/assets/pilots/kairo/kairo.layers.json): body, left and right
// wing-binder + rifle. All motion is code-driven from player state.
// Coordinates in the JSON files are @2x image pixels (kairo.anchors.json).

/** Tunables (the test range changes these live). */
export const LOOK = {
  size: 90,            // mecha height in world units (owner's pick; test range cycles SIZES)
  outline: true,       // use the dark-outline sprite variant
  widthMul: 1,         // shot / beam visual width multiplier
  glowMul: 1,          // shot / beam outer-glow strength multiplier
  debug: false,        // F9 overlay (anchors, hitbox, layer outlines)
};
export const SIZES = [90, 68, 80];

// Built-in copy of kairo.anchors.json: used when the file can't be loaded, so
// shot origins (gameplay) never depend on whether the art loaded.
const DEFAULT_ANCHORS = {
  image: { w: 240, h: 372, artH: 360, pad: 6 },
  anchors: {
    hitbox: [119.8, 135.3], head: [119.8, 67.2],
    rifleL: [32, 150.7], rifleR: [207.6, 150.7],
    capL: [89.5, 56.1], capR: [148.3, 56.1],
    wingL: [28.3, 7.2], wingR: [211.4, 7.2],
    footL: [89.5, 328.9], footR: [150.1, 328.9],
    calfL: [87.6, 262.1], calfR: [149.5, 262.1],
    packL: [89.5, 156.9], packR: [148.3, 156.9],
  },
};

export const anchorData = () => pilotArt('kairo')?.anchors || DEFAULT_ANCHORS;
/** World units per @2x image pixel at the current size. */
export const unitsPerPx = () => LOOK.size / anchorData().image.artH;

/** Anchor offset from the hitbox (= player.x/y) in world units, at rest. */
export function anchor(name) {
  const A = anchorData().anchors, k = unitsPerPx();
  const p = A[name], h = A.hitbox;
  return [(p[0] - h[0]) * k, (p[1] - h[1]) * k];
}

// ------------------------------------------------------------- palette

// Sampled from FX Sprite Sheet.png: white-hot core → cyan → electric blue → violet edge.
export const PAL = {
  core: [2.2, 2.4, 2.6],
  cyan: [0.45, 1.35, 2.0],
  blue: [0.22, 0.5, 1.7],
  violet: [0.45, 0.25, 1.1],
};

// ---------------------------------------------------- atlas: FX textures

function lanceTex(ctx, w, h) {
  // White alpha shape: soft-edged flat core, tail fading to the left, diamond tip at the right.
  const tip = w * 0.2, body = w - tip;
  const along = ctx.createLinearGradient(0, 0, body, 0);
  along.addColorStop(0, 'rgba(255,255,255,0)');
  along.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  along.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = along;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.42); ctx.lineTo(body, h * 0.12); ctx.lineTo(w, h / 2); ctx.lineTo(body, h * 0.88); ctx.lineTo(0, h * 0.58);
  ctx.closePath(); ctx.fill();
}

function glowTex(ctx, w, h) {
  // Elongated soft glow, brightest toward the head (right), long fading tail.
  ctx.save();
  ctx.translate(w * 0.72, h / 2);
  ctx.scale(1, h / w * 1.4);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.36);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, -w, w * 2, w * 2);
  ctx.restore();
  const tail = ctx.createLinearGradient(0, 0, w * 0.75, 0);
  tail.addColorStop(0, 'rgba(255,255,255,0)');
  tail.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = tail;
  ctx.beginPath(); ctx.ellipse(w * 0.4, h / 2, w * 0.4, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function beamTex(ctx, w, h) {
  // Cross-section of a solid beam: flat across the middle, soft edges (drawn stretched along x).
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.24, 'rgba(255,255,255,1)');
  g.addColorStop(0.76, 'rgba(255,255,255,1)');
  g.addColorStop(0.84, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function flameTex(ctx, w, h) {
  // Teardrop pointing down: round head at the top, tapering tail.
  const cx = w / 2, r = w * 0.42;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - r, r * 1.05);
  ctx.bezierCurveTo(cx - r, h * 0.55, cx - r * 0.2, h * 0.8, cx, h);
  ctx.bezierCurveTo(cx + r * 0.2, h * 0.8, cx + r, h * 0.55, cx + r, r * 1.05);
  ctx.arc(cx, r * 1.05, r, 0, Math.PI, true);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soften the sides
  const s = ctx.createLinearGradient(0, 0, w, 0);
  s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.3, 'rgba(0,0,0,0)');
  s.addColorStop(0.7, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function flareTex(ctx, w, h) {
  // Four-point star with a hot centre.
  const cx = w / 2, cy = h / 2;
  for (const [sx, sy] of [[1, 0.09], [0.09, 1]]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.22);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function shardTex(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w * 0.55, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w * 0.55, h); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------- atlas: mecha layers

const K = { fx: null, art: null }; // atlas frames (rebuilt with the atlas)
export const kairoFrames = () => K;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function polyPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Feathered polygon mask, optionally eroded by `erode` px. */
function maskCanvas(w, h, poly, feather, erode = 0) {
  const raw = canvas(w, h), c = raw.getContext('2d');
  c.fillStyle = '#fff';
  polyPath(c, poly); c.fill();
  if (erode > 0) {
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = erode * 2; c.lineJoin = 'round';
    polyPath(c, poly); c.stroke();
  }
  if (!feather) return raw;
  const out = canvas(w, h), o = out.getContext('2d');
  o.filter = `blur(${feather}px)`;   // ignored where unsupported: hard-edged mask
  o.drawImage(raw, 0, 0);
  return out;
}

function polyBox(poly, pad, w, h) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(w, Math.ceil(x1 + pad)); y1 = Math.min(h, Math.ceil(y1 + pad));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Split the sprite image into body / wingL / wingR canvases (+ crop boxes). */
export function splitLayers(img, layers) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sx = W / anchorData().image.w; // layers.json is in @2x pixels; scale if a 1x image is passed
  const sc = (p) => p.map(([x, y]) => [x * sx, y * sx]);
  const feather = (layers.feather ?? 3) * sx, seam = (layers.seam ?? 6) * sx;
  const out = {};
  const pixels = (cv) => cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  // Wing coverage m (feathered) and the seam-eroded wing interiors e (hard).
  const m = new Float32Array(W * H), e = new Uint8Array(W * H);
  for (const L of Object.values(layers.layers)) {
    const md = pixels(maskCanvas(W, H, sc(L.poly), feather)), ed = pixels(maskCanvas(W, H, sc(L.poly), 0, seam));
    for (let p = 0; p < W * H; p++) {
      m[p] = Math.max(m[p], md[p * 4 + 3] / 255);
      if (ed[p * 4 + 3] > 127) e[p] = 1;
    }
  }
  // Body = the exact "over" complement of the wings, so body + wings at rest
  // reproduce the original pixel for pixel (alpha a, wing coverage m:
  // body alpha = a(1-m)/(1-am)). Fully opaque pixels in the seam band (inside
  // a wing but outside its eroded interior) keep their full art: hidden at
  // rest, they fill the gap when a wing slides outward.
  const body = canvas(W, H), bc = body.getContext('2d', { willReadFrequently: true });
  bc.drawImage(img, 0, 0, W, H);
  const id = bc.getImageData(0, 0, W, H), d = id.data;
  for (let p = 0; p < W * H; p++) {
    const a = d[p * 4 + 3] / 255, mm = m[p];
    if (mm <= 0 || (a >= 1 && !e[p])) continue;
    const den = 1 - a * mm;
    d[p * 4 + 3] = den > 1e-4 ? Math.round(255 * a * (1 - mm) / den) : 0;
  }
  bc.putImageData(id, 0, 0);
  out.body = { canvas: body, box: { x: 0, y: 0, w: W, h: H } };
  for (const [name, L] of Object.entries(layers.layers)) {
    const box = polyBox(sc(L.poly), feather * 2, W, H);
    const c = canvas(box.w, box.h), cx = c.getContext('2d');
    cx.drawImage(maskCanvas(W, H, sc(L.poly), feather), -box.x, -box.y);
    cx.globalCompositeOperation = 'source-in';
    cx.drawImage(img, -box.x, -box.y, W, H);
    out[name] = { canvas: c, box, pivot: [L.pivot[0] * sx, L.pivot[1] * sx] };
  }
  return out;
}

/** Atlas builder (part of the pilot's `sprites`). */
export function buildKairoSprites(atlas) {
  const s = 3;
  K.fx = {
    lance: atlas.add('k_lance', 64, 16, lanceTex, { scale: s }),
    glow: atlas.add('k_lglow', 64, 32, glowTex, { scale: 2 }),
    beam: atlas.add('k_beam', 16, 32, beamTex, { scale: 2 }),
    flame: atlas.add('k_flame', 16, 40, flameTex, { scale: s }),
    flare: atlas.add('k_flare', 32, 32, flareTex, { scale: 2 }),
    shard: atlas.add('k_shard', 16, 8, shardTex, { scale: s }),
  };
  K.art = null;
  const art = pilotArt('kairo');
  if (!art || !art.layers) return;
  try {
    // 2x art on a 4096 atlas; half texel density on the 2048 fallback.
    const scale = atlas.size >= 4096 ? 1 : 0.5;
    const A = anchorData();
    const sets = {};
    for (const variant of ['plain', 'outline']) {
      const img = art.images[variant === 'outline' ? 'outline2x' : 'back2x'];
      const parts = splitLayers(img, art.layers);
      const set = {};
      set.full = { frame: atlas.add(`k_mecha_${variant}`, A.image.w, A.image.h, (c, w, h) => c.drawImage(img, 0, 0, w, h), { scale }), box: { x: 0, y: 0, w: A.image.w, h: A.image.h } };
      for (const [name, p] of Object.entries(parts)) {
        set[name] = {
          frame: atlas.add(`k_${name}_${variant}`, p.box.w, p.box.h, (c, w, h) => c.drawImage(p.canvas, 0, 0, w, h), { scale }),
          box: p.box, pivot: p.pivot,
        };
      }
      sets[variant] = set;
    }
    K.art = sets;
  } catch (err) {
    console.warn('[art] kairo: layer split failed, using procedural sprites', err);
    K.art = null;
  }
}

// ------------------------------------------------------------ animation

/** Advance the cosmetic animation state (called from the pilot's update; no RNG). */
export function animate(p) {
  const ps = p.ps;
  const ease = (k, target, rate) => { ps[k] = (ps[k] ?? 0) + (target - (ps[k] ?? 0)) * rate; };
  ease('flare', p.focus && p.state === 'alive' ? 1 : 0, 0.18);
  ease('fold', ps.phase > 0 ? 1 : 0, 0.35);
  // Thruster level: idle 1, moving 1.4, moving up 2, dash 3.2.
  const moving = Math.abs(p.moveX) + Math.abs(p.moveY) > 0.2;
  const thr = ps.phase > 0 ? 3.2 : p.moveY < -0.2 ? 2 : moving ? 1.4 : 1;
  ease('thr', thr, 0.25);
  // Dash trail points.
  const tr = ps.trail || (ps.trail = []);
  if (ps.phase > 0) { tr.push([p.x, p.y]); if (tr.length > 14) tr.shift(); } else if (tr.length) tr.shift();
}

/** Wing offset (px, @2x space) and rotation for side s (-1 left, +1 right). */
function wingPose(p, s) {
  const ps = p.ps, flare = ps.flare || 0, fold = ps.fold || 0;
  const breath = Math.sin(p.t * 0.06);
  const out = flare * 8 - fold * 6 + breath * 0.8;            // + = outward
  const ox = s * out - p.bank * 5;                            // banking: far wing in, near wing out
  const rot = s * (0.035 * (flare - fold) + 0.006 * breath);
  return { ox, rot };
}

/**
 * Draw the mecha. Returns false when the art isn't available (the Player then
 * draws the procedural sprite).
 */
export function renderMecha(p, b, x, y, a) {
  const set = K.art && K.art[LOOK.outline ? 'outline' : 'plain'];
  if (!set) return false;
  const A = anchorData(), hb = A.anchors.hitbox, k = unitsPerPx(), F = p.F;
  const bob = Math.sin(p.t * 0.07) * 0.8;
  const rot = p.bank * 0.14;                      // up to ~8°
  const sq = 1 - Math.abs(p.bank) * 0.08;         // slight horizontal squash
  const cr = Math.cos(rot), sr = Math.sin(rot);
  // @2x image px (relative to the hitbox anchor) -> world.
  const place = (lx, ly) => {
    const dx = lx * k * sq, dy = ly * k;
    return [x + dx * cr - dy * sr, y + bob + dx * sr + dy * cr];
  };
  const fsz = LOOK.size / 68;

  // Thruster flames under the feet (drawn first: the feet cover the roots).
  const thr = p.ps.thr || 1;
  const flame = (name, len, wid, i) => {
    const an = A.anchors[name];
    const fl = 0.88 + 0.12 * Math.sin(p.t * 2.3 + i * 1.7) + 0.06 * Math.sin(p.t * 5.1 + i);
    const L = len * fl * fsz, Wd = wid * fsz;
    const [fx, fy] = place(an[0] - hb[0], an[1] - hb[1]);
    const ux = -sr, uy = cr; // local "down"
    const at = (d) => [fx + ux * d, fy + uy * d];
    let [cx, cy] = at(L * 0.5);
    b.draw(K.fx.flame, cx, cy, Wd * 1.7, L * 1.15, rot, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.75 * a, 1);
    b.draw(K.fx.flame, cx, cy, Wd, L, rot, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.9 * a, 1);
    [cx, cy] = at(L * 0.25);
    b.draw(K.fx.flame, cx, cy, Wd * 0.45, L * 0.5, rot, PAL.core[0], PAL.core[1], PAL.core[2], a, 1);
    b.draw(F.glow, fx, fy + 1, Wd * 2.6, Wd * 2.6, 0, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.45 * a, 1);
  };
  // Main back thrusters: wide blue plumes from the backpack nozzles, washing
  // down behind the legs (the body covers their roots).
  flame('packL', 26 * thr, 15, 4);
  flame('packR', 26 * thr, 15, 5);
  flame('footL', 12 * thr, 7, 0);
  flame('footR', 12 * thr, 7, 1);

  const drawPart = (part, ox = 0, prot = 0, tint = null, alpha = a, add = 0) => {
    const bx = part.box;
    let cx = bx.x + bx.w / 2 - hb[0], cy = bx.y + bx.h / 2 - hb[1];
    if (prot && part.pivot) {
      // Rotate the layer's centre about its pivot.
      const px = part.pivot[0] - hb[0], py = part.pivot[1] - hb[1];
      const c = Math.cos(prot), s = Math.sin(prot), dx = cx - px, dy = cy - py;
      cx = px + dx * c - dy * s; cy = py + dx * s + dy * c;
    }
    const [wx, wy] = place(cx + ox, cy);
    const t = tint || [1, 1, 1];
    b.draw(part.frame, wx, wy, bx.w * k * sq, bx.h * k, rot + prot, t[0], t[1], t[2], alpha, add);
  };

  drawPart(set.body);
  const L = wingPose(p, -1), R = wingPose(p, 1);
  drawPart(set.wingL, L.ox, L.rot);
  drawPart(set.wingR, R.ox, R.rot);

  // Backpack nozzle glow on top of the art, so the back thrusters read as lit.
  for (const [name, i] of [['packL', 0], ['packR', 1]]) {
    const an = A.anchors[name], [nx, ny] = place(an[0] - hb[0], an[1] - hb[1]);
    const fl = 0.85 + 0.15 * Math.sin(p.t * 1.9 + i * 2.1), gw = 16 * fsz * fl * (0.8 + thr * 0.2);
    b.draw(F.glow, nx, ny + 2 * fsz, gw * 1.5, gw, 0, PAL.blue[0], PAL.blue[1], PAL.blue[2], 0.55 * a, 1);
    b.draw(F.glow, nx, ny + 2 * fsz, gw * 0.7, gw * 0.45, 0, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.8 * a, 1);
  }

  // Small calf-vent flames + glows (painted red vents stay visible).
  flame('calfL', 5 * Math.min(thr, 1.6), 3.5, 2);
  flame('calfR', 5 * Math.min(thr, 1.6), 3.5, 3);

  if (p.state === 'dying') drawPart(set.full, 0, 0, [3, 0.6, 0.6], 0.9, 1);

  // Focus: hitbox as a small glowing dot at the hitbox anchor.
  if (p.focus && p.state === 'alive') {
    b.draw(F.glow, x, y, 14, 14, 0, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], 0.9, 1);
    b.draw(F.core, x, y, 5, 5, 0, 2.4, 2.4, 2.4, 1, 1);
  }
  return true;
}

/** World-space pose of an anchor including the current wing animation (muzzle flashes). */
export function animatedAnchor(p, name) {
  const A = anchorData(), hb = A.anchors.hitbox, k = unitsPerPx(), an = A.anchors[name];
  let lx = an[0] - hb[0], ly = an[1] - hb[1];
  const side = name.endsWith('L') ? -1 : name.endsWith('R') ? 1 : 0;
  if (side && (name.startsWith('rifle') || name.startsWith('wing')) && K.art) {
    const set = K.art.plain, part = side < 0 ? set.wingL : set.wingR, pose = wingPose(p, side);
    const px = part.pivot[0] - hb[0], py = part.pivot[1] - hb[1];
    const c = Math.cos(pose.rot), s = Math.sin(pose.rot), dx = lx - px, dy = ly - py;
    lx = px + dx * c - dy * s + pose.ox; ly = py + dx * s + dy * c;
  }
  const rot = p.bank * 0.14, sq = 1 - Math.abs(p.bank) * 0.08;
  const dx = lx * k * sq, dy = ly * k;
  return [p.x + dx * Math.cos(rot) - dy * Math.sin(rot), p.y + dx * Math.sin(rot) + dy * Math.cos(rot)];
}

/** Exhaust particles at the foot nozzles. Returns false without art (default engines). */
export function exhaust(p, w) {
  if (!K.art) return false;
  const H = w.fxHigh, R = w.fxRng, F = p.F, thr = p.ps.thr || 1, fsz = LOOK.size / 68;
  for (const name of ['packL', 'packR', 'footL', 'footR']) {
    const [ax, ay] = anchor(name);
    const i = H.spawn(F.glow, p.x + ax + R.range(-1, 1), p.y + ay + 4 * fsz, R.range(-0.2, 0.2), R.range(2.5, 4) * (0.8 + thr * 0.25), R.range(6, 10));
    if (i < 0) return true;
    H.size(i, R.range(7, 10) * fsz, 2);
    H.color(i, PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], PAL.blue[0] * 0.4, PAL.blue[1] * 0.4, PAL.blue[2] * 0.6);
    H.look(i, 0.6 * p.alpha, 1, FADE_OUT);
  }
  return true;
}
