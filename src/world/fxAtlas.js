import { Atlas } from '../core/gl/Atlas.js';
import { noiseSet } from './paint/noise.js';

// Sprite frames for world-anchored effects (fire, smoke, dust, steam, foam,
// light pools, sparks, weather). Drawn once with Canvas2D into a small atlas
// of its own (the main atlas is full); every frame carries `.tex`, so the
// SpriteBatch draws them in the same pass as everything else.
//
// Smoke / dust / steam are painted near-white with soft self-shadowing (lit
// from the upper left, like the arenas) and tinted per particle.

const TAU = Math.PI * 2;
export const FLAME_FRAMES = 8;

function hashf(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

/** Fire seen from above: a turbulent cluster of flame tongues. */
function flame(f) {
  return (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.globalCompositeOperation = 'lighter';
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + hashf(k * 3.1) * 0.6;
      const ph = f / FLAME_FRAMES * TAU + hashf(k) * TAU;
      const len = w * (0.18 + 0.2 * (0.5 + 0.5 * Math.sin(ph)) + hashf(k + 9) * 0.12);
      const wid = w * (0.08 + 0.05 * hashf(k + 4));
      c.save();
      c.translate(cx, cy);
      c.rotate(a + Math.sin(ph * 1.3) * 0.15);
      const g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.3, 'rgba(255,170,60,0.75)'); g.addColorStop(0.7, 'rgba(220,70,10,0.45)'); g.addColorStop(1, 'rgba(120,20,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -wid);
      c.quadraticCurveTo(len * 0.55, -wid * 1.4 + Math.sin(ph * 2) * wid, len, Math.sin(ph) * wid * 0.6);
      c.quadraticCurveTo(len * 0.55, wid * 1.4 + Math.sin(ph * 2) * wid, 0, wid);
      c.closePath(); c.fill();
      c.restore();
    }
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.26);
    core.addColorStop(0, 'rgba(255,255,230,1)'); core.addColorStop(0.5, 'rgba(255,200,90,0.8)'); core.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = core; c.beginPath(); c.arc(cx, cy, w * 0.26, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  };
}

/** Soft billowing puff, lit from the upper left; `wisp` breaks the edge up more. */
function puff(seed, wisp = 0.5) {
  return (c, w, h) => {
    const N = noiseSet();
    const cx = w / 2, cy = h / 2, R = w * 0.42;
    const blobs = 12;
    for (let k = 0; k < blobs; k++) {
      const a = hashf(seed * 13 + k) * TAU, d = Math.sqrt(hashf(seed * 7 + k * 3)) * R * 0.55;
      const r = R * (0.32 + 0.3 * hashf(seed + k * 5));
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const g = c.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.55, 'rgba(205,205,210,0.8)'); g.addColorStop(1, 'rgba(150,150,160,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // Self-shadow on the lower right.
    c.globalCompositeOperation = 'source-atop';
    const sh = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(60,60,70,0.1)'); sh.addColorStop(1, 'rgba(40,40,50,0.55)');
    c.fillStyle = sh; c.fillRect(0, 0, w, h);
    // Wispy, noisy edge.
    c.globalCompositeOperation = 'destination-in';
    const pat = c.createPattern(N.masks.fbm_35, 'repeat');
    c.save(); c.translate(hashf(seed) * 200, hashf(seed + 1) * 200); c.scale(0.25 + wisp * 0.1, 0.25 + wisp * 0.1); c.fillStyle = pat; c.fillRect(-2000, -2000, 4000, 4000); c.restore();
    c.globalCompositeOperation = 'source-over';
  };
}

function radial(stops) {
  return (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [t, col] of stops) g.addColorStop(t, col);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  };
}

function streak(c, w, h) {
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); c.fill();
}

function ring(c, w, h) {
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = w * 0.08;
  c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0, TAU); c.stroke();
}

function foam(c, w, h) {
  const N = noiseSet();
  radial([[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])(c, w, h);
  c.globalCompositeOperation = 'destination-in';
  const pat = c.createPattern(N.masks.fine_50, 'repeat');
  c.save(); c.scale(0.3, 0.3); c.fillStyle = pat; c.fillRect(0, 0, w * 4, h * 4); c.restore();
  c.globalCompositeOperation = 'source-over';
}

/** Searchlight / light-shaft cone (narrow end at the left). */
function cone(c, w, h) {
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, h / 2 - 1); c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(0, h / 2 + 1); c.closePath(); c.fill();
  c.globalCompositeOperation = 'destination-in';
  const v = c.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
}

function flake(c, w, h) {
  radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']])(c, w, h);
}

function chunk(c, w, h) {
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(w * 0.1, h * 0.3); c.lineTo(w * 0.6, h * 0.05); c.lineTo(w * 0.95, h * 0.5); c.lineTo(w * 0.55, h * 0.95); c.lineTo(w * 0.15, h * 0.75); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.moveTo(w * 0.6, h * 0.05); c.lineTo(w * 0.95, h * 0.5); c.lineTo(w * 0.55, h * 0.95); c.closePath(); c.fill();
}

let FX = null;

/** Build (once) and return the world FX frames; re-uploads after a context restore. */
export function worldFxFrames(r) {
  if (FX && FX.restores === r.restores) return FX.frames;
  if (!FX) {
    const atlas = new Atlas(1024, 1);
    const F = {};
    const add = (name, w, h, fn, scale = 2) => (F[name] = atlas.add(name, w, h, fn, { scale }));
    F.flames = [];
    for (let f = 0; f < FLAME_FRAMES; f++) F.flames.push(add(`wf_flame${f}`, 48, 48, flame(f), 2));
    F.smoke = [0, 1, 2, 3].map((k) => add(`wf_smoke${k}`, 64, 64, puff(k + 1, 0.5), 2));
    F.dust = [0, 1].map((k) => add(`wf_dust${k}`, 64, 64, puff(k + 11, 0.9), 2));
    F.glow = add('wf_glow', 64, 64, radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]), 1);
    F.pool = add('wf_pool', 64, 64, radial([[0, 'rgba(255,255,255,0.8)'], [0.6, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]), 1);
    F.ember = add('wf_ember', 8, 8, radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]), 4);
    F.spark = add('wf_spark', 16, 4, streak, 4);
    F.ring = add('wf_ring', 32, 32, ring, 2);
    F.foam = add('wf_foam', 48, 48, foam, 2);
    F.cone = add('wf_cone', 96, 48, cone, 2);
    F.flake = add('wf_flake', 8, 8, flake, 4);
    F.chunk = add('wf_chunk', 12, 12, chunk, 4);
    F.white = add('wf_white', 4, 4, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); }, 4);
    FX = { atlas, frames: F, own: atlas.frames, restores: -1 };
  }
  const tex = FX.atlas.upload(r.gl);
  for (const fr of FX.own) fr.tex = tex;
  FX.restores = r.restores;
  return FX.frames;
}
