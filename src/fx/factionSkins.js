import { ENEMIES } from '../entities/enemies/index.js';
import { FACTIONS, tagEnemyRoster } from '../data/factions/index.js';
import { greeble, hexRgb } from './greeble.js';

// Faction-tinted enemy variants (UPDATE_02 §3).
//
// Every M3 enemy sprite gets one recoloured copy per faction, registered in
// the atlas as `<sprite>@<factionId>`. Behaviour and patterns are untouched:
// `skinEnemy` only swaps the frames an enemy is drawn with.
//
// Recolour rule (per pixel, on the already-rasterised base sprite):
//   - saturated bright pixels (lights, canopies, neon trim) → faction glow
//   - saturated mid pixels (paint) → faction primary / accent
//   - desaturated pixels (metal) keep their shading, pulled toward the
//     faction's plate colour
// so silhouettes stay identical and each syndicate reads as one fleet.
// Big hulls also get a light greeble pass (seams + rivets) masked to the
// solid body.

const BIG = new Set(['e_truck', 'e_carrier', 'e_frigate', 'e_fortress', 'e_bomber', 'e_tank', 'e_walker', 'e_gunship']);

function spriteNames() {
  const s = new Set();
  for (const d of Object.values(ENEMIES)) { s.add(d.sprite); if (d.sprite2) s.add(d.sprite2); }
  return [...s];
}

const lerp = (a, b, t) => a + (b - a) * t;

function recolor(img, fac) {
  const d = img.data;
  const glow = hexRgb(fac.palette.glow), prim = hexRgb(fac.palette.primary), acc = hexRgb(fac.palette.accent);
  const plate = hexRgb(fac.greeble.plate[1]);
  const pm = Math.max(...plate) || 1;
  const nrm = (c) => { const m = Math.max(...c) || 1; return c.map((v) => v / m); };
  const G = nrm(glow), P = nrm(prim), A = nrm(acc), M = plate.map((v) => v / pm);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 6) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx > 0 ? (mx - mn) / mx : 0;
    let out;
    if (s > 0.32 && mx > 0.22) {
      // Paint / emissive: keep brightness, take the faction hue.
      const T = mx > 0.78 ? G : (r > b ? P : A);
      const k = Math.min(1, 0.55 + s * 0.6);
      out = [lerp(r, T[0] * mx, k), lerp(g, T[1] * mx, k), lerp(b, T[2] * mx, k)];
      if (mx > 0.78) { const lift = 0.15 * (1 - s); out = out.map((v) => Math.min(1, v + lift)); }
    } else {
      // Metal: preserve luminance, tint toward the faction plate.
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      out = [lerp(r, l * M[0] * 1.15, 0.45), lerp(g, l * M[1] * 1.15, 0.45), lerp(b, l * M[2] * 1.15, 0.45)];
    }
    d[i] = Math.min(255, out[0] * 255); d[i + 1] = Math.min(255, out[1] * 255); d[i + 2] = Math.min(255, out[2] * 255);
  }
}

/** Greeble layer composited only where the body is solid (alpha > 0.85). */
function greebleOnto(img, tw, th, f, fac, seed) {
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.scale(tw / f.w, th / f.h);
  ctx.translate(f.w / 2, f.h / 2);
  greeble(ctx, fac.greeble, [-f.w / 2, -f.h / 2, f.w, f.h], { seed, panel: Math.max(7, f.w / 7), rivets: 0.5, lights: 0 });
  const gd = ctx.getImageData(0, 0, tw, th).data, d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 217 || gd[i + 3] === 0) continue;
    const a = (gd[i + 3] / 255) * 0.55;
    d[i] = lerp(d[i], gd[i], a); d[i + 1] = lerp(d[i + 1], gd[i + 1], a); d[i + 2] = lerp(d[i + 2], gd[i + 2], a);
  }
}

export function buildFactionSkins(atlas) {
  // Runs at renderer start-up, after every module has loaded (the enemy
  // factory imports this file, so tagging can't happen at import time).
  tagEnemyRoster(ENEMIES);
  // Variants need atlas room: 6 factions × the roster. On a 2048 atlas
  // (GPUs without 4096 textures) enemies keep their base art.
  if (atlas.size < 4096) return;
  const S = atlas.size;
  const frames = spriteNames().filter((n) => atlas.has(n)).map((n) => atlas.get(n));
  // ONE readback of the band holding the roster: reading the (GPU-backed)
  // atlas canvas per sprite costs a full readback each time.
  const y0 = Math.floor(Math.min(...frames.map((f) => f.v0)) * S);
  const y1 = Math.ceil(Math.max(...frames.map((f) => f.v1)) * S);
  const band = atlas.ctx.getImageData(0, y0, S, y1 - y0).data;
  // M7c: build every variant on the CPU, reserve its atlas slot, then write
  // them all back with ONE putImageData (was ~126 canvas→canvas uploads,
  // ~20 s of start-up under software GL). Variants start on a fresh atlas
  // row so the write-back band holds nothing else.
  atlas.newRow();
  const out = [];
  for (const f of frames) {
    const sx = Math.round(f.u0 * S), sy = Math.round(f.v0 * S) - y0;
    const tw = Math.round((f.u1 - f.u0) * S), th = Math.round((f.v1 - f.v0) * S);
    const base = new Uint8ClampedArray(tw * th * 4);
    for (let r = 0; r < th; r++) base.set(band.subarray(((sy + r) * S + sx) * 4, ((sy + r) * S + sx + tw) * 4), r * tw * 4);
    for (const fac of Object.values(FACTIONS)) {
      const img = new ImageData(new Uint8ClampedArray(base), tw, th);
      recolor(img, fac);
      if (BIG.has(f.name)) greebleOnto(img, tw, th, f, fac, `${f.name}@${fac.id}`);
      // Reserve the slot (nothing drawn); the frame's u0/v0 give its texel origin.
      const fr = atlas.add(`${f.name}@${fac.id}`, f.w, f.h, () => {}, { scale: tw / f.w, exact: true });
      out.push([fr, img]);
    }
  }
  if (!out.length) return;
  const by0 = Math.round(out[0][0].v0 * S);
  let by1 = by0;
  for (const [fr, img] of out) by1 = Math.max(by1, Math.round(fr.v0 * S) + img.height);
  const dst = new ImageData(S, by1 - by0), D = dst.data;
  for (const [fr, img] of out) {
    const x = Math.round(fr.u0 * S), y = Math.round(fr.v0 * S) - by0, w = img.width;
    for (let r = 0; r < img.height; r++) D.set(img.data.subarray(r * w * 4, (r + 1) * w * 4), ((y + r) * S + x) * 4);
  }
  atlas.ctx.putImageData(dst, 0, by0);
}

/**
 * Spawn hook (entities/enemies/index.js): wear the colours of the faction
 * that owns this part of the stage (World.factionOf, set by StageScene), or
 * the enemy's home faction elsewhere. Cosmetic only.
 */
export function skinEnemy(w, e, def) {
  const fid = (w.factionOf && w.factionOf(def)) || def.faction || null;
  e.faction = fid;
  if (!fid) return;
  const A = w.r.atlas;
  const n1 = `${def.sprite}@${fid}`;
  if (A.has(n1)) e.f = A.get(n1);
  if (def.sprite2) {
    const n2 = `${def.sprite2}@${fid}`;
    if (A.has(n2)) e.f2 = A.get(n2);
  }
}

/** Faction-tinted frame for a sprite name if one exists (boss parts reuse enemy art). */
export function factionFrame(r, name, fid) {
  const A = r.atlas, n = `${name}@${fid}`;
  return fid && A.has(n) ? A.get(n) : r.frame(name);
}
