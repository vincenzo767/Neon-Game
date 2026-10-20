import { makeCanvas, noiseSet } from './noise.js';

// Painter: Canvas2D in WORLD coordinates for one rectangular chunk of a
// plane layer. The context transform maps world (x, y) → texture pixels, with
// +y (forward) toward the top row, so painters work in the same units as the
// geometry. Patterns are anchored to the world origin: every chunk of a layer
// shares the same continuous material noise, so chunk seams are invisible.
//
// Colours are CSS strings or [r, g, b] (0..1) arrays.

const TAU = Math.PI * 2;

export const css = (c, a = 1) => {
  if (typeof c === 'string') return c;
  const k = c.length > 3 ? c[3] * a : a;
  return `rgba(${Math.round(Math.max(0, Math.min(1, c[0])) * 255)},${Math.round(Math.max(0, Math.min(1, c[1])) * 255)},${Math.round(Math.max(0, Math.min(1, c[2])) * 255)},${k})`;
};
export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** Multiply a colour by k, optionally mixing toward `to` by t. */
export const shade = (c, k = 1, to = null, t = 0) => {
  const a = typeof c === 'string' ? hex(c) : c;
  const out = [a[0] * k, a[1] * k, a[2] * k];
  if (to) for (let i = 0; i < 3; i++) out[i] += (to[i] - out[i]) * t;
  return out.map((v) => Math.max(0, Math.min(1, v)));
};
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Rectangle corners (centre x, y; width w along x, depth d along y; rotation). */
export function rectPts(x, y, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
  const out = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) out.push(x + u * c - v * s, y + u * s + v * c);
  return out;
}

export class Painter {
  /**
   * @param canvas target (OffscreenCanvas or canvas)
   * @param rect   {x0, x1, y0, y1} world rect the canvas covers
   * @param ppu    texture pixels per world unit
   * @param env    { sun: {dx, dy, elev}, R, emissive (Painter for the glow map) }
   */
  constructor(canvas, rect, ppu, env = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rect = rect;
    this.ppu = ppu;
    this.env = env;
    this.N = noiseSet();
    this.pats = new Map();
    this.pool = [];
    this.depth = 0;
    this.shadowCanvas = null;
    this.reset();
  }

  /** World transform: (x, y) → ((x - x0)·ppu, (y1 - y)·ppu). */
  get xf() { const { x0, y1 } = this.rect, k = this.ppu; return [k, 0, 0, -k, -x0 * k, y1 * k]; }

  reset() {
    this.ctx.setTransform(...this.xf);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /** World units per texture pixel (for pixel-scale detail). */
  px(n = 1) { return n / this.ppu; }

  pat(name) {
    let p = this.pats.get(name);
    if (!p) {
      const img = name.startsWith('m:') ? this.N.masks[name.slice(2)] : this.N[name];
      if (!img) throw new Error(`no noise "${name}"`);
      p = { pat: this.ctx.createPattern(img, 'repeat'), size: img.width };
      this.pats.set(name, p);
    }
    return p;
  }

  // ---------------------------------------------------------------- paths

  poly(pts) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    return this;
  }

  rectPath(x, y, w, h) { this.ctx.beginPath(); this.ctx.rect(x, y, w, h); return this; }
  circlePath(x, y, r) { this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, TAU); return this; }
  ellipsePath(x, y, rx, ry, rot = 0) { this.ctx.beginPath(); this.ctx.ellipse(x, y, rx, ry, rot, 0, TAU); return this; }

  /** Whole chunk (with a margin). */
  allPath(m = 4) {
    const { x0, x1, y0, y1 } = this.rect;
    return this.rectPath(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m);
  }

  /** Run fn clipped to a path function. */
  clip(pathFn, fn) {
    const c = this.ctx;
    c.save();
    if (pathFn) { pathFn(); c.clip(); }
    fn(this);
    c.restore();
    return this;
  }

  // ---------------------------------------------------------------- fills

  /** Fill the current path. */
  fill(color, alpha = 1, op = 'source-over') {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    c.fillStyle = css(color);
    c.fill();
    c.restore();
    return this;
  }

  stroke(color, width, alpha = 1, op = 'source-over') {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    c.strokeStyle = css(color);
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.stroke();
    c.restore();
    return this;
  }

  /** Fill the whole chunk. */
  base(color) { this.allPath(); return this.fill(color); }

  /**
   * Composite a noise pattern over everything (or within o.path).
   * @param name  noise ('grain', 'fine', 'fbm', 'large', 'ridged', 'cells', 'streak', 'm:<mask>')
   * @param scale world units per pattern tile
   * @param op    composite op ('multiply', 'overlay', 'screen', 'soft-light', 'destination-out', ...)
   * @param o     { rot, ox, oy, sy (stretch), path }
   */
  noise(name, scale, op = 'overlay', alpha = 0.5, o = {}) {
    const c = this.ctx, P = this.pat(name);
    c.save();
    if (o.path) { o.path(); c.clip(); }
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    c.translate(o.ox || 0, o.oy || 0);
    if (o.rot) c.rotate(o.rot);
    const s = scale / P.size;
    c.scale(s, o.sy ? s * o.sy : s);
    c.fillStyle = P.pat;
    c.fillRect(-1e6, -1e6, 2e6, 2e6);
    c.restore();
    return this;
  }

  // ----------------------------------------------------------- isolation

  _acquire() {
    let S = this.pool[this.depth];
    if (!S) S = this.pool[this.depth] = makeCanvas(this.canvas.width, this.canvas.height);
    this.depth++;
    const c = S.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, S.width, S.height);
    c.setTransform(...this.xf);
    return S;
  }

  _release() { this.depth--; }

  _blit(img, alpha = 1, op = 'source-over', blurPx = 0) {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    if (blurPx > 0.5) {
      // Blur via the shadow of an off-canvas copy (no ctx.filter needed).
      const W = img.width + 64;
      c.shadowColor = 'rgba(0,0,0,1)';
      c.shadowBlur = blurPx;
      c.shadowOffsetX = W;
      c.drawImage(img, -W, 0);
    } else c.drawImage(img, 0, 0);
    c.restore();
  }

  /**
   * Paint fn into an isolated layer, optionally worn (holes punched by a
   * noise mask), tinted, or blurred, then composite it.
   *   o.wear  [mask, scale, alpha]   erase speckles (worn paint, broken edges)
   *   o.keep  [mask, scale]          keep only where the mask is opaque
   *   o.alpha, o.op, o.blur (world units)
   */
  layer(fn, o = {}) {
    const S = this._acquire();
    const prev = this.ctx;
    this.ctx = S.getContext('2d');
    try {
      fn(this);
      if (o.wear) this.noise(`m:${o.wear[0]}`, o.wear[1], 'destination-out', o.wear[2] ?? 1);
      if (o.keep) this.noise(`m:${o.keep[0]}`, o.keep[1], 'destination-in', 1);
      if (o.grain) this.noise('grain', 128 / this.ppu, 'overlay', o.grain); // material grain on the layer
    } finally {
      this.ctx = prev;
    }
    this._blit(S, o.alpha ?? 1, o.op || 'source-over', (o.blur || 0) * this.ppu);
    this._release();
    return this;
  }

  /** Paint `color` where a noise mask is opaque (patchy layers), within o.path. */
  patch(mask, scale, color, alpha = 1, o = {}) {
    return this.layer((p) => {
      if (o.path) { o.path(); p.ctx.clip(); }
      p.noise(`m:${mask}`, scale, 'source-over', 1, { rot: o.rot, ox: o.ox, oy: o.oy, sy: o.sy });
      p.ctx.save();
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.globalCompositeOperation = 'source-in';
      p.ctx.fillStyle = css(color);
      p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
      p.ctx.restore();
      if (o.detail) p.noise(o.detail[0], o.detail[1], 'overlay', o.detail[2] ?? 0.4);
    }, { alpha, op: o.op });
  }

  // ------------------------------------------------------------ strokes

  line(pts, width, color, alpha = 1, o = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    if (o.op) c.globalCompositeOperation = o.op;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    if (o.close) c.closePath();
    c.lineWidth = width;
    c.lineCap = o.cap || 'butt';
    c.lineJoin = o.join || 'round';
    if (o.dash) { c.setLineDash(o.dash); c.lineDashOffset = o.dashOffset || 0; }
    c.strokeStyle = css(color);
    c.stroke();
    c.restore();
    return this;
  }

  /** Jagged crack: random walk from (x, y) along angle a, with branches. */
  crack(R, x, y, a, len, width = 0.6, color = [0.03, 0.03, 0.03], alpha = 0.75, branches = 2) {
    const pts = [x, y];
    let px = x, py = y, ang = a;
    const n = Math.max(3, Math.round(len / 5));
    for (let i = 0; i < n; i++) {
      ang += R.range(-0.55, 0.55);
      px += Math.cos(ang) * (len / n); py += Math.sin(ang) * (len / n);
      pts.push(px, py);
      if (branches > 0 && R.chance(0.16)) this.crack(R, px, py, ang + R.sign() * R.range(0.5, 1.2), len * R.range(0.2, 0.45), width * 0.7, color, alpha, branches - 1);
    }
    return this.line(pts, width, color, alpha, { cap: 'round' });
  }

  // ------------------------------------------------------------ gradients

  radial(x, y, r, stops, op = 'source-over', alpha = 1, sy = 1) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (sy !== 1) c.scale(1, sy);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [t, col, a] of stops) g.addColorStop(t, css(col, a ?? 1));
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.restore();
    return this;
  }

  /** Linear gradient fill of a path fn (default: whole chunk). */
  linear(x0, y0, x1, y1, stops, path = null, op = 'source-over', alpha = 1) {
    const c = this.ctx;
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (const [t, col, a] of stops) g.addColorStop(t, css(col, a ?? 1));
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = op;
    if (path) path(); else this.allPath();
    c.fillStyle = g;
    c.fill();
    c.restore();
    return this;
  }

  // ------------------------------------------------------------- shadows

  get sun() { return this.env.sun || { dx: 0.55, dy: -0.45, elev: 0.75 }; }

  /**
   * Queue a shadow caster: footprint polygon (world xy) spanning heights
   * z0..z1 above this plane. The shadow is the footprint swept along the sun
   * direction; casters are drawn opaque into one buffer and composited once
   * (no double-darkening where shadows overlap), with a soft edge.
   */
  shadow(pts, z1, z0 = 0) {
    if (this.phase === 'draw') return this;
    const sun = this.sun;
    if (!this.shadowCanvas) {
      this.shadowCanvas = makeCanvas(this.canvas.width, this.canvas.height);
      this.shadowCtx = this.shadowCanvas.getContext('2d');
    }
    const c = this.shadowCtx;
    c.setTransform(...this.xf);
    c.fillStyle = '#000';
    const k = 1 / Math.tan(sun.elev), ax = sun.dx * k, ay = sun.dy * k;
    const n = pts.length / 2;
    const at = (i, z) => [pts[i * 2] + ax * z, pts[i * 2 + 1] + ay * z];
    for (const z of z0 === z1 ? [z0] : [z0, z1]) {
      c.beginPath();
      for (let i = 0; i < n; i++) { const [x, y] = at(i, z); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.closePath(); c.fill();
    }
    if (z1 > z0) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, [ax0, ay0] = at(i, z0), [bx0, by0] = at(j, z0), [bx1, by1] = at(j, z1), [ax1, ay1] = at(i, z1);
      c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(bx0, by0); c.lineTo(bx1, by1); c.lineTo(ax1, ay1); c.closePath(); c.fill();
    }
    return this;
  }

  shadowBox(x, y, w, d, h, rot = 0, z0 = 0) { return this.shadow(rectPts(x, y, w, d, rot), h, z0); }

  shadowCircle(x, y, r, h, z0 = 0, n = 10) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    return this.shadow(pts, h, z0);
  }

  /** Composite queued shadows. strength 0..1, softness in world units. */
  flushShadows(strength = 0.55, soft = 3, color = [0.02, 0.03, 0.06]) {
    if (!this.shadowCanvas) return this;
    const sc = this.shadowCtx;
    sc.save();
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = css(color);
    sc.fillRect(0, 0, this.shadowCanvas.width, this.shadowCanvas.height);
    sc.restore();
    this._blit(this.shadowCanvas, strength, 'source-over', soft * this.ppu);
    sc.save();
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, this.shadowCanvas.width, this.shadowCanvas.height);
    sc.restore();
    return this;
  }

  /**
   * Props with shadows underneath them. fn(R) runs twice with identical
   * seeded randomness: first only its shadows are recorded (drawing goes to
   * a throwaway context), then shadows are composited, then fn draws for real
   * (shadow calls ignored). Shadows queued before the call (buildings) are
   * flushed together with the props' shadows.
   */
  props(makeR, fn, strength = this.env.shadow ?? 0.55, soft = 2.2) {
    if (!Painter.dummy) Painter.dummy = makeCanvas(2, 2);
    const real = this.ctx, glow = this.env.glow, realGlow = glow && glow.ctx;
    this.ctx = Painter.dummy.getContext('2d');
    if (glow) glow.ctx = this.ctx;
    this.phase = 'shadow';
    try { fn(makeR()); } finally {
      this.ctx = real;
      if (glow) glow.ctx = realGlow;
      this.phase = null;
    }
    this.flushShadows(strength, soft);
    this.phase = 'draw';
    try { fn(makeR()); } finally { this.phase = null; }
    return this;
  }

  // -------------------------------------------------------------- local

  /** Paint in a local frame: translate to (x, y), rotate by rot. */
  at(x, y, rot, fn) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    fn(c, this);
    c.restore();
    return this;
  }
}
