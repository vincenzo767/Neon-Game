import { pilotArt } from '../../core/pilotArt.js';
import { Atlas } from '../../core/gl/Atlas.js';
import { FADE_OUT } from '../../fx/Particles.js';

// Hand-made mecha art for a pilot (ART_PIPELINE.md). One instance per pilot:
//
//   const art = createMechaArt({ id: 'kairo', defaults, pal, flames, ... });
//
// The sprite is split into a body and two wing layers with feathered masks
// (public/assets/pilots/<id>/<id>.layers.json). The layers live in the
// pilot's own small texture, built the first time the pilot is drawn, so
// pilot art never fills the shared atlas (SpriteBatch switches textures). All
// motion is code-driven from player state. Everything here is visual except
// `anchor()`, which also places the pilot's real shot origins.
// Coordinates in the JSON files are @2x image pixels (<id>.anchors.json).
//
// cfg:
//   id          pilot id (art from pilotArt(id))
//   defaults    built-in copy of <id>.anchors.json: gameplay anchors never
//               depend on whether the file loaded
//   pal         { core, hot, mid, edge }: HDR colours, hottest to outermost
//   flames      [{ name, len, wid, hot = 1, over = false, cap = Infinity }]
//               thruster flames at anchors (len × thruster level, capped);
//               `over` draws on top of the art, `hot` < 1 keeps a plume mostly `mid`
//   nozzles     anchors that get a lit nozzle glow on top of the art
//   exhaust     anchors that emit exhaust particles
//   wingAnchors anchor-name prefixes that move with the wing layers (muzzles)
//   size        default height in world units

export const SIZES = [90, 68, 80];
const VARIANTS = ['plain', 'outline'];

// ---------------------------------------------------- atlas: FX textures
// White alpha shapes, tinted per draw; built once per atlas, shared by pilots.

function lanceTex(ctx, w, h) {
  // Soft-edged flat core, tail fading to the left, diamond tip at the right.
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

const FX = { atlas: null, frames: null };

/** Shared FX textures for this atlas (added once). */
export function fxTextures(atlas) {
  if (FX.atlas === atlas) return FX.frames;
  const s = 3;
  FX.frames = {
    lance: atlas.add('art_lance', 64, 16, lanceTex, { scale: s }),
    glow: atlas.add('art_lglow', 64, 32, glowTex, { scale: 2 }),
    beam: atlas.add('art_beam', 16, 32, beamTex, { scale: 2 }),
    flame: atlas.add('art_flame', 16, 40, flameTex, { scale: s }),
    flare: atlas.add('art_flare', 32, 32, flareTex, { scale: 2 }),
    shard: atlas.add('art_shard', 16, 8, shardTex, { scale: s }),
  };
  FX.atlas = atlas;
  return FX.frames;
}

// ---------------------------------------------------- atlas: mecha layers

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

/**
 * Split a sprite image into body / wing canvases (+ crop boxes).
 * @param imageW width of the @2x image the layer JSON is written for
 */
export function splitLayers(img, layers, imageW) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sx = W / imageW; // layers.json is in @2x pixels; scale if a 1x image is passed
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

// ------------------------------------------------------------ the factory

export function createMechaArt(cfg) {
  const { id, defaults, pal } = cfg;
  const flames = cfg.flames || [];
  const nozzles = cfg.nozzles || [];
  const exhaustAt = cfg.exhaust || [];
  const wingAnchors = cfg.wingAnchors || [];

  /** Tunables (the test range changes these live). */
  const LOOK = {
    size: cfg.size ?? 90,  // mecha height in world units (test range cycles SIZES)
    outline: true,         // use the dark-outline sprite variant
    widthMul: 1,           // shot / beam visual width multiplier
    glowMul: 1,            // shot / beam outer-glow strength multiplier
    debug: false,          // F9 overlay (anchors, hitbox, layer outlines)
  };
  // fx: shared FX frames (main atlas); art: per-variant layer frames in the
  // pilot's own texture (atlas/own/restores track it); failed: no art.
  const K = { fx: null, art: null, atlas: null, own: null, restores: 0, failed: false };

  const anchorData = () => pilotArt(id)?.anchors || defaults;
  /** World units per @2x image pixel at the current size. */
  const unitsPerPx = () => LOOK.size / anchorData().image.artH;

  /** Anchor offset from the hitbox (= player.x/y) in world units, at rest. */
  function anchor(name) {
    const A = anchorData().anchors, k = unitsPerPx();
    const p = A[name], h = A.hitbox;
    return [(p[0] - h[0]) * k, (p[1] - h[1]) * k];
  }

  /** Atlas builder (part of the pilot's `sprites`): shared FX textures only. */
  function buildSprites(atlas) {
    K.fx = fxTextures(atlas);
  }

  /**
   * The pilot's art texture, built on first use (split layers → own small
   * atlas → GPU). Its frames are appended to the renderer's frame list, so
   * particles can use them too (afterimages). Re-uploaded after a WebGL
   * context restore. Returns null without art (procedural fallback).
   */
  function ensureArt(r) {
    if (K.failed || !r) return K.art;
    if (K.art) {
      if (K.restores !== r.restores) {
        const tex = K.atlas.upload(r.gl);
        for (const fr of K.own) fr.tex = tex;
        K.restores = r.restores;
      }
      return K.art;
    }
    const art = pilotArt(id);
    if (!art || !art.layers) { K.failed = true; return null; }
    try {
      const A = anchorData();
      let atlas = null, sets = null;
      for (const size of [1024, 2048]) {
        try {
          atlas = new Atlas(size, 1);
          sets = {};
          for (const variant of VARIANTS) {
            const img = art.images[variant === 'outline' ? 'outline2x' : 'back2x'];
            const parts = splitLayers(img, art.layers, A.image.w);
            const set = {};
            set.full = { frame: atlas.add(`${id}_mecha_${variant}`, A.image.w, A.image.h, (c, w, h) => c.drawImage(img, 0, 0, w, h), { scale: 1 }), box: { x: 0, y: 0, w: A.image.w, h: A.image.h } };
            for (const [name, p] of Object.entries(parts)) {
              set[name] = {
                frame: atlas.add(`${id}_${name}_${variant}`, p.box.w, p.box.h, (c, w, h) => c.drawImage(p.canvas, 0, 0, w, h), { scale: 1 }),
                box: p.box, pivot: p.pivot,
              };
            }
            sets[variant] = set;
          }
          break;
        } catch (err) {
          if (!/Atlas full/.test(err.message) || size === 2048) throw err;
        }
      }
      const tex = atlas.upload(r.gl);
      K.own = atlas.frames;
      for (const fr of K.own) { fr.tex = tex; fr.id = r.frames.length; r.frames.push(fr); }
      K.atlas = atlas;
      K.restores = r.restores;
      K.art = sets;
    } catch (err) {
      console.warn(`[art] ${id}: art texture failed, using procedural sprites`, err);
      K.failed = true;
      K.art = null;
    }
    return K.art;
  }

  // ---------------------------------------------------------- animation

  /** Advance the cosmetic animation state (called from the pilot's update; no RNG). */
  function animate(p) {
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
    const kick = (s < 0 ? ps.kickL : ps.kickR) || 0;            // optional per-side swing (0..1), e.g. a melee slash
    const out = flare * 8 - fold * 6 + breath * 0.8 + kick * 7; // + = outward
    const ox = s * out - p.bank * 5;                            // banking: far wing in, near wing out
    const rot = s * (0.035 * (flare - fold) + 0.006 * breath + 0.14 * kick);
    return { ox, rot };
  }

  /**
   * Draw the mecha. Returns false when the art isn't available (the Player then
   * draws the procedural sprite).
   */
  function renderMecha(p, b, x, y, a) {
    const arts = ensureArt(p.w.r);
    const set = arts && (arts[LOOK.outline ? 'outline' : 'plain'] || arts.outline);
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
    const thr = p.ps.thr || 1;

    // hot: how much white core / `hot` colour the flame gets (wide plumes stay mostly `mid`).
    const flame = (name, len, wid, i, hot = 1) => {
      const an = A.anchors[name];
      if (!an) return;
      const fl = 0.88 + 0.12 * Math.sin(p.t * 2.3 + i * 1.7) + 0.06 * Math.sin(p.t * 5.1 + i);
      const L = len * fl * fsz, Wd = wid * fsz;
      const [fx, fy] = place(an[0] - hb[0], an[1] - hb[1]);
      const ux = -sr, uy = cr; // local "down"
      const at = (d) => [fx + ux * d, fy + uy * d];
      let [cx, cy] = at(L * 0.5);
      b.draw(K.fx.flame, cx, cy, Wd * 1.7, L * 1.15, rot, pal.mid[0], pal.mid[1], pal.mid[2], 0.75 * a, 1);
      b.draw(K.fx.flame, cx, cy, Wd, L, rot, pal.hot[0], pal.hot[1], pal.hot[2], 0.9 * a * hot, 1);
      [cx, cy] = at(L * 0.25);
      b.draw(K.fx.flame, cx, cy, Wd * 0.45 * hot, L * 0.5, rot, pal.core[0], pal.core[1], pal.core[2], a * hot, 1);
      b.draw(F.glow, fx, fy + 1, Wd * 2.6, Wd * 2.6, 0, pal.mid[0], pal.mid[1], pal.mid[2], 0.45 * a * hot, 1);
    };
    const flames$ = (over) => flames.forEach((f, i) => {
      if (!!f.over === over) flame(f.name, f.len * Math.min(thr, f.cap ?? Infinity), f.wid, f.i ?? i, f.hot ?? 1);
    });

    // Flames under the art first (the body covers their roots).
    flames$(false);

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

    // Nozzle glow on top of the art, so the thrusters read as lit.
    nozzles.forEach((name, i) => {
      const an = A.anchors[name];
      if (!an) return;
      const [nx, ny] = place(an[0] - hb[0], an[1] - hb[1]);
      const fl = 0.85 + 0.15 * Math.sin(p.t * 1.9 + i * 2.1), gw = 16 * fsz * fl * (0.8 + thr * 0.2);
      b.draw(F.glow, nx, ny + 2 * fsz, gw * 1.5, gw, 0, pal.mid[0], pal.mid[1], pal.mid[2], 0.35 * a, 1);
      b.draw(F.glow, nx, ny + 2 * fsz, gw * 0.7, gw * 0.45, 0, pal.hot[0], pal.hot[1], pal.hot[2], 0.35 * a, 1);
    });

    // Small flames drawn over the art (vents painted on the armour).
    flames$(true);

    if (p.state === 'dying') drawPart(set.full, 0, 0, [3, 0.6, 0.6], 0.9, 1);

    // Focus: hitbox as a small glowing dot at the hitbox anchor.
    if (p.focus && p.state === 'alive') {
      b.draw(F.glow, x, y, 14, 14, 0, pal.hot[0], pal.hot[1], pal.hot[2], 0.9, 1);
      b.draw(F.core, x, y, 5, 5, 0, 2.4, 2.4, 2.4, 1, 1);
    }
    return true;
  }

  /** World-space pose of an anchor including the current wing animation (muzzle flashes). */
  function animatedAnchor(p, name) {
    const A = anchorData(), hb = A.anchors.hitbox, k = unitsPerPx(), an = A.anchors[name];
    let lx = an[0] - hb[0], ly = an[1] - hb[1];
    const side = name.endsWith('L') ? -1 : name.endsWith('R') ? 1 : 0;
    if (side && wingAnchors.some((w) => name.startsWith(w)) && K.art) {
      const set = K.art.outline, part = side < 0 ? set.wingL : set.wingR, pose = wingPose(p, side);
      const px = part.pivot[0] - hb[0], py = part.pivot[1] - hb[1];
      const c = Math.cos(pose.rot), s = Math.sin(pose.rot), dx = lx - px, dy = ly - py;
      lx = px + dx * c - dy * s + pose.ox; ly = py + dx * s + dy * c;
    }
    const rot = p.bank * 0.14, sq = 1 - Math.abs(p.bank) * 0.08;
    const dx = lx * k * sq, dy = ly * k;
    return [p.x + dx * Math.cos(rot) - dy * Math.sin(rot), p.y + dx * Math.sin(rot) + dy * Math.cos(rot)];
  }

  /** Exhaust particles at the thruster anchors. Returns false without art (default engines). */
  function exhaust(p, w) {
    if (!ensureArt(w.r)) return false;
    const H = w.fxHigh, R = w.fxRng, F = p.F, thr = p.ps.thr || 1, fsz = LOOK.size / 68;
    for (const name of exhaustAt) {
      const [ax, ay] = anchor(name);
      const i = H.spawn(F.glow, p.x + ax + R.range(-1, 1), p.y + ay + 4 * fsz, R.range(-0.2, 0.2), R.range(2.5, 4) * (0.8 + thr * 0.25), R.range(6, 10));
      if (i < 0) return true;
      H.size(i, R.range(7, 10) * fsz, 2);
      H.color(i, pal.hot[0], pal.hot[1], pal.hot[2], pal.mid[0] * 0.4, pal.mid[1] * 0.4, pal.mid[2] * 0.6);
      H.look(i, 0.6 * p.alpha, 1, FADE_OUT);
    }
    return true;
  }

  /** Spawn a fading tinted afterimage of the whole mecha (dash, specials). */
  function afterimage(p, w, life = 16, alpha = 0.5, tint = null) {
    if (!ensureArt(w.r)) return false;
    const full = (K.art[LOOK.outline ? 'outline' : 'plain'] || K.art.outline).full, A = anchorData(), k = unitsPerPx(), hb = A.anchors.hitbox;
    const H = w.fxHigh, i = H.spawn(full.frame, p.x + (A.image.w / 2 - hb[0]) * k, p.y + (A.image.h / 2 - hb[1]) * k, 0, 0, life);
    if (i >= 0) {
      H.size(i, A.image.w * k);
      const t = tint || [pal.hot[0] * 0.25, pal.hot[1] * 0.6, pal.hot[2], pal.mid[0] * 0.3, pal.mid[1] * 0.4, pal.mid[2] * 0.8];
      H.color(i, t[0], t[1], t[2], t[3], t[4], t[5]);
      H.look(i, alpha, 1, FADE_OUT);
    }
    return true;
  }

  return {
    id, pal, LOOK, SIZES,
    frames: () => K,
    ensureArt,
    anchorData, unitsPerPx, anchor, animatedAnchor,
    buildSprites, animate, renderMecha, exhaust, afterimage,
    hasArt: () => !!K.art,
  };
}
