import { Camera3D } from './Camera3D.js';
import { arenaSetup } from './chunkBuilder.js';
import { WorldFX } from './WorldFX.js';
import { worldFxFrames } from './fxAtlas.js';
import { RNG } from '../core/RNG.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';

// Runtime for one arena configuration: a perspective camera flying forward,
// chunk streaming for every plane layer (requested ahead of the camera from
// the BuildService, released once behind it), the GL draw pass and the world
// FX. Presentation only — it never touches gameplay state.
//
// Lifecycle
//   new ArenaWorld(game, cfg, service, wgl)   starts requesting chunks
//   ready                                     every chunk in view is uploaded
//   update()                                  one simulation step
//   render(...)                               GL pass (background slot)
//   renderGround(b) / renderParticles(b)      sprite FX (batch)
//   dispose()                                 frees GPU memory, cancels jobs

const BASE_SPEED = 1.15;        // world units per step at scroll 1 (≈ the old stage scroll)
const QUALITY = {
  low: { ppu: 0.6, glow: false, detail: 0, fx: 'low' },
  medium: { ppu: 0.8, glow: true, detail: 0.35, fx: 'medium' },
  high: { ppu: 1.0, glow: true, detail: 0.45, fx: 'high' },
};

export class ArenaWorld {
  /**
   * @param cfg arena config (bosses/arenas/*): { id, env, params, light, scroll, camera, wind, ... }
   */
  constructor(game, cfg, service, wgl, opts = {}) {
    this.g = game;
    this.cfg = cfg;
    this.svc = service;
    this.wgl = wgl;
    this.setup = arenaSetup(cfg);
    this.S = this.setup.S;
    this.light = this.setup.light;
    this.layers = [...this.S.layers].sort((a, b) => a.z - b.z);
    this.qname = opts.quality || game.settings.data.quality || 'high';
    this.Q = QUALITY[this.qname] || QUALITY.high;
    this.cam = new Camera3D(cfg.camera || {});
    this.cam.y = this.cam.py = opts.startY ?? 0;
    this.speed = this.baseSpeed = (cfg.scroll ?? 1) * BASE_SPEED;
    this.wind = cfg.wind || [0.6, 0.25];
    this.R = new RNG(`fx:${cfg.id}:${Date.now() & 0xffff}`);
    this.chunks = new Map();      // `${layer}:${k}` → chunk record
    this.dynAnchors = [];
    this.anchors = [];
    this.movers = [];
    // 3D actors drawn inside the world pass (depth-tested with the terrain):
    // { renderWorld(view, alpha) }, e.g. the White Fang tank (bosses/ground).
    this.extras = [];
    this.speedTarget = null; // eased scroll override (a boss holding the field)
    // Chunks kept streamed BEHIND the camera (cfg.keepBehind): arenas whose boss runs the
    // field backward have a buffer ready the moment the scroll reverses.
    this.keepBehind = cfg.keepBehind || 0;
    this.time = 0;
    this.disposed = false;
    this.floorZ = this.S.floorZ ?? (this.layers[0] ? this.layers[0].z : 0);
    this.dustCol = cfg.dust || this.S.dust || [0.48, 0.44, 0.38];
    this.fx = new WorldFX(this, worldFxFrames(game.renderer), this.Q.fx);
    // Atmosphere: sky backdrop, water / lava surfaces, fog overrides.
    const A = this.S.atmosphere || {};
    this.sky = cfg.sky || A.sky || null;
    this.surfaces = A.surfaces || [];
    this.atmo = {
      fogCol: cfg.fogCol || A.fogCol || this.light.fogCol,
      fog: cfg.fog || A.fog || this.light.fog,
      hfog: A.hfog || null,
      exposure: (cfg.exposure ?? 1) * this.light.exposure,
      caustics: A.caustics || null,
      glowTint: A.glowTint || [1, 1, 1],
      sunDir: this.light.sunDir,
      sunCol: this.light.sunCol,
      time: 0,
    };
    const fc = this.atmo.fogCol;
    this.baseSky = { mode: 3, top: fc.map((v) => v * 0.95), bottom: fc.map((v) => v * 0.75) };
    this.stats = { requested: 0, ready: 0, bytes: 0 };
    this.uploads = [];
    this._sync(true);
  }

  // ------------------------------------------------------------ streaming

  /** Chunk index range needed for a layer at the current camera pose. */
  _range(L, ahead = 1) {
    const fp = this.cam.footprint(L.z, 60);
    if (!Number.isFinite(fp.y0)) return null;
    // Streaming leads in the direction of travel (a boss can run the field backward).
    const back = this.speed < -0.05;
    const a = Math.floor((fp.y0 - 160) / L.length) - (back ? ahead + 2 : 0) - this.keepBehind, b = Math.floor((fp.y1 + 220) / L.length) + (back ? 0 : ahead);
    return [a, b];
  }

  /**
   * Periodic layers (`layer.period` chunks) repeat along y: chunk k is built as
   * chunk k mod period and drawn shifted by whole periods. All of its chunks
   * stay resident, so once the first lap is built nothing more is ever needed.
   */
  _wrap(L, k) { const n = L.period; return n ? ((k % n) + n) % n : k; }

  /** Nearest image (to the camera) of chunk k of a periodic layer. */
  _near(L, k) {
    const n = L.period;
    return n ? k + n * Math.round((this.cam.y / L.length - k) / n) : k;
  }

  _sync(first = false) {
    const keep = new Set();
    for (const L of this.layers) {
      const r = this._range(L);
      if (!r) continue;
      for (let k = r[0]; k <= r[1]; k++) {
        const kk = this._wrap(L, k), key = `${L.id}:${kk}`;
        keep.add(key);
        if (!this.chunks.has(key)) this._request(L, kk, first);
      }
      // The rest of a periodic layer queues behind what is needed now.
      if (L.period) for (let k = 0; k < L.period; k++) if (!this.chunks.has(`${L.id}:${k}`)) this._request(L, k, false);
    }
    // Release chunks well behind the camera (keep a little slack against flicker).
    for (const [key, c] of this.chunks) {
      if (keep.has(key)) continue;
      const L = this.layers.find((l) => l.id === c.layer);
      if (L && L.period) continue;
      const r = L && this._range(L, 2);
      if (!r || c.k < r[0] - 1 || c.k > r[1] + 2) this._free(key, c);
    }
  }

  /**
   * Build priority (lower first). Nearest to the camera first; the incoming arena's
   * first view beats prefetching — but the SHOWN arena's chunks that are on screen
   * right now beat everything, and a shown arena running backward (a boss driving
   * the field) keeps its short lead ahead of any prefetch.
   */
  _priority(L, k, first) {
    k = this._near(L, k);
    let pri = (first ? -1e6 : 0) + Math.abs(k * L.length - this.cam.y) + L.z * 0.01;
    if (this.shown) {
      const fp = this.cam.footprint(L.z, 0);
      if (k * L.length < fp.y1 && (k + 1) * L.length > fp.y0) pri -= 3e6;
      else if (this.speed < -0.05) pri -= 2e6;
    }
    return pri;
  }

  _request(L, k, first) {
    const key = `${L.id}:${k}`;
    const rec = { layer: L.id, k, state: 'pending', born: 0, anchors: [] };
    this.chunks.set(key, rec);
    this.stats.requested++;
    const pri = this._priority(L, k, first);
    this.svc.chunk(this.cfg, L.id, k, { ppu: this.Q.ppu, glow: this.Q.glow }, pri, this).then((d) => {
      if (this.disposed || this.chunks.get(key) !== rec) { closeBitmaps(d); return; }
      // GPU uploads (texImage2D + mipmaps) are spread over frames: one per update.
      this.uploads.push([rec, d]);
      if (first && this.uploads.length === 1 && !this.time) this._drainUploads(1);
    }).catch((err) => {
      if (err.message !== 'cancelled') console.warn(`[world] ${this.cfg.id} ${key}:`, err.message);
      if (this.chunks.get(key) === rec) rec.state = 'failed';
    });
  }

  _upload(rec, d) {
    const w = this.wgl;
    rec.tex = d.canvas ? w.texture(d.canvas) : null;
    rec.glow = d.glow ? w.texture(d.glow, false) : null;
    rec.plane = w.mesh(d.plane);
    rec.solid = d.solid ? w.mesh(d.solid) : null;
    rec.anchors = d.anchors || [];
    rec.movers = (d.movers || []).map((m) => ({ ...m, gl: m.mesh && m.mesh.count ? w.mesh(m.mesh) : null, mesh: null }));
    rec.state = 'ready';
    rec.born = this.time;
    rec.restores = w.restores;
    rec.bytes = (d.canvas ? d.canvas.width * d.canvas.height * 5.3 : 0) + (d.glow ? d.glow.width * d.glow.height * 4 : 0) + rec.plane.bytes + (rec.solid ? rec.solid.bytes : 0);
    this.stats.bytes += rec.bytes;
    this.stats.ready++;
    closeBitmaps(d);
    this._rebuildAnchors();
  }

  _free(key, c) {
    const w = this.wgl;
    if (c.state === 'ready') {
      w.freeTexture(c.tex); w.freeTexture(c.glow); w.freeMesh(c.plane); w.freeMesh(c.solid);
      for (const m of c.movers || []) w.freeMesh(m.gl);
      this.stats.bytes -= c.bytes || 0;
    }
    c.state = 'freed';
    this.chunks.delete(key);
    this._rebuildAnchors();
  }

  _rebuildAnchors() {
    const out = [], mv = [];
    for (const c of this.chunks.values()) {
      if (c.state !== 'ready') continue;
      const L = this.layers.find((l) => l.id === c.layer);
      if (L && L.period) continue; // placed per visible image (_periodicAnchors)
      for (const a of c.anchors) out.push(a);
      for (const m of c.movers || []) mv.push(m);
    }
    this.baseAnchors = out;
    this.anchors = out;
    this.movers = mv;
    this._akey = null;
    this._periodicAnchors();
  }

  /** Anchors of periodic layers, shifted onto every image near the camera (refreshed as it moves). */
  _periodicAnchors() {
    let key = '';
    const imgs = [];
    for (const L of this.layers) {
      if (!L.period) continue;
      const fp = this.cam.footprint(L.z, 300);
      if (!Number.isFinite(fp.y0)) continue;
      const a = Math.floor((fp.y0 - 300) / L.length), b = Math.floor((fp.y1 + 400) / L.length);
      key += `${L.id}:${a}:${b};`;
      imgs.push([L, a, b]);
    }
    if (!imgs.length || key === this._akey) return;
    this._akey = key;
    const out = (this.baseAnchors || []).slice();
    for (const [L, a, b] of imgs) {
      for (let k = a; k <= b; k++) {
        const c = this.chunks.get(`${L.id}:${this._wrap(L, k)}`);
        if (!c || c.state !== 'ready') { this._akey = null; continue; }
        const dy = (k - c.k) * L.length;
        if (!dy) { for (const an of c.anchors) out.push(an); continue; }
        const img = c.img || (c.img = new Map());
        if (!img.has(k)) img.set(k, c.anchors.map((an) => ({ ...an, y: an.y + dy })));
        for (const an of img.get(k)) out.push(an);
      }
    }
    this.anchors = out;
  }

  /** Current offset of a mover (deterministic: start + velocity × arena time). */
  moverOffset(m, alpha = 1) {
    const t = this.time - 1 + alpha;
    return [m.vx * t, m.vy * t, 0];
  }

  /** Upload up to n finished chunks (nearest first). */
  _drainUploads(n) {
    if (!this.uploads.length) return;
    this.uploads.sort((p, q) => Math.abs(p[0].k * 512 - this.cam.y) - Math.abs(q[0].k * 512 - this.cam.y));
    for (let i = 0; i < n && this.uploads.length; i++) {
      const [rec, d] = this.uploads.shift();
      if (this.disposed || rec.state !== 'pending') { closeBitmaps(d); continue; }
      this._upload(rec, d);
    }
  }

  /** True when every chunk the camera currently sees is on the GPU. */
  get ready() {
    if (!this.wgl.matTex) return false; // the shared material library is still being painted
    // Not shown yet (prefetched / incoming): upload everything that has arrived.
    if (this.uploads.length) this._drainUploads(this.uploads.length);
    for (const L of this.layers) {
      const fp = this.cam.footprint(L.z, 0);
      if (!Number.isFinite(fp.y0)) continue;
      for (let k = Math.floor(fp.y0 / L.length); k <= Math.floor(fp.y1 / L.length); k++) {
        const c = this.chunks.get(`${L.id}:${this._wrap(L, k)}`);
        if (!c || (c.state !== 'ready' && c.state !== 'failed')) return false;
      }
    }
    return true;
  }

  /** Fraction of visible chunks ready (loading UI / tests). */
  get progress() {
    let n = 0, r = 0;
    for (const c of this.chunks.values()) { n++; if (c.state === 'ready') r++; }
    return n ? r / n : 1;
  }

  // ------------------------------------------------------------ update

  update() {
    if (this.disposed) return;
    this.shown = true;
    if (this.speedTarget !== null) {
      const d = this.speedTarget - this.speed;
      this.speed = Math.abs(d) < 0.002 ? this.speedTarget : this.speed + d * 0.025;
    }
    this.cam.speed = this.speed;
    this.cam.step(this.speed);
    this.time++;
    this.atmo.time = this.time / 60;
    this.cam.frame(1);
    if (this.time % 10 === 0) {
      if (this.shown) this.svc.reprioritise(this, (m) => { const L = this.layers.find((l) => l.id === m.layer); return L ? this._priority(L, m.k, false) : 0; });
      this._sync();
    }
    this._drainUploads(1);
    this.svc.pump();
    this._periodicAnchors();
    this.fx.update(this.anchors);
    for (const s of this.surfaces) if (s.flash && s.flash[3] > 0) s.flash[3] = Math.max(0, s.flash[3] * 0.82 - 0.01);
  }

  /** Lightning inside the cloud decks: light them from within around (x, y). */
  cloudFlash(x, y, r) {
    for (const s of this.surfaces) if (s.type === 'cloud') s.flash = [x, y, r, 1.4];
  }

  /** Waiting in the wings (prefetched / incoming): trickle uploads in, one per step. */
  idle() {
    if (this.disposed) return;
    this.shown = false;
    this._drainUploads(1);
  }

  // ------------------------------------------------------------ queries

  /**
   * Screen point (480×640 units) → world point on the topmost walkable
   * surface under it (env `surfaceAt`, else the lowest layer). Adds .water.
   */
  groundAt(sx, sy) {
    const cam = this.cam;
    const tops = this.S.surfacesTopDown || [{ z: this.floorZ }];
    for (const s of tops) {
      const p = cam.unproject(sx, sy, s.z);
      if (!p) continue;
      if (!s.contains || s.contains(p[0], p[1])) { p.water = !!s.water; return p; }
    }
    return null;
  }

  /** World → screen projection (for scene code). */
  project(x, y, z, out) { return this.cam.project(x, y, z, out); }

  /**
   * Screen-space scroll (units per step) of the main ground / water plane at
   * screen row `sy`: ground units and surface ships ride it, so a tank stays
   * on the road it was spawned on. Rows sampled every 40 units, refreshed
   * each step (the camera never changes speed mid-level).
   */
  groundSpeedAt(sy) {
    const cam = this.cam, tab = this._gs || (this._gs = { t: -1, v: new Float32Array(18) });
    if (tab.t !== cam.y || tab.s !== this.speed) {
      tab.t = cam.y; tab.s = this.speed;
      const z = (this.S.surfacesTopDown && this.S.surfacesTopDown[0].z) ?? this.floorZ;
      const p = [0, 0, 0], q = [0, 0, 0, 0];
      for (let i = 0; i < tab.v.length; i++) {
        const y = i * 40 - 20;
        const w = cam.unproject(240, y, z, p);
        tab.v[i] = w ? cam.project(w[0], w[1] - this.speed, z, q)[1] - y : 0;
        // Rows past the horizon: reuse the row below (the sign follows the scroll direction).
        if (!w || !Number.isFinite(tab.v[i])) tab.v[i] = Math.abs(this.speed) <= 0.001 ? 0 : i ? tab.v[i - 1] : 0.5 * Math.sign(this.speed);
      }
    }
    const f = Math.min(tab.v.length - 1.001, Math.max(0, (sy + 20) / 40)), i = f | 0;
    return tab.v[i] + (tab.v[i + 1] - tab.v[i]) * (f - i);
  }

  // ------------------------------------------------------------ render

  /** GL pass: sky → surfaces → layers (planes + solids) → transparent layers. */
  render(width, height, alpha, shakeX, shakeY) {
    if (this.disposed) return;
    const gl = this.wgl.gl, w = this.wgl, cam = this.cam, A = this.atmo;
    if (!w.matTex) return; // materials not uploaded yet (start-up)
    cam.frame(alpha, shakeX, shakeY);
    // Always lay down a backdrop: the configured sky, or an atmospheric haze in
    // the fog colour, so a chunk still streaming in never shows a blank frame.
    gl.disable(gl.DEPTH_TEST);
    w.drawSky(A, this.sky || this.baseSky, width, height, cam.cy);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    for (const s of this.surfaces) {
      if (this.S.swirlFollow && s.swirl) { s.swirl[0] = 0; s.swirl[1] = cam.cy + 300; }
      const fp = cam.footprint(s.z || 0, 200);
      if (!Number.isFinite(fp.y0)) continue;
      if (s.type === 'cloud' || s.type === 'blackhole') continue;
      if (s.type === 'water') w.drawWater(cam, A, s, fp);
      else if (s.type === 'lava') w.drawLava(cam, A, s, fp);
      else if (s.type === 'planet') w.drawPlanet(cam, A, s, fp);
    }
    w.beginLit(cam, A);
    const det = [this.Q.detail, 0.09];
    const fadeIn = (c) => Math.min(1, (this.time - c.born) / 12 + (c.born === 0 ? 1 : 0));
    // Opaque pass, bottom layer first.
    for (const L of this.layers) {
      if (L.blend) continue;
      if (L.period) {
        // Periodic layer: draw each visible image of its resident chunks, shifted by whole periods.
        const fp = cam.footprint(L.z, 200);
        if (!Number.isFinite(fp.y0)) continue;
        for (let k = Math.floor(fp.y0 / L.length); k <= Math.floor(fp.y1 / L.length); k++) {
          const c = this.chunks.get(`${L.id}:${this._wrap(L, k)}`);
          if (!c || c.state !== 'ready') continue;
          this._restoreIfLost(c);
          const off = this.offBuf || (this.offBuf = [0, 0, 0]);
          off[1] = (k - c.k) * L.length;
          if (c.tex) w.drawLit(c.plane, { plane: c.tex, glow: c.glow, cut: L.cut ? 0.5 : 0.02, detail: L.detail ?? det, offset: off });
          if (c.solid) w.drawLit(c.solid, { cut: 0.5, detail: [this.Q.detail * 0.6, 0.12], offset: off });
        }
        continue;
      }
      for (const c of this.chunks.values()) {
        if (c.layer !== L.id || c.state !== 'ready') continue;
        this._restoreIfLost(c);
        if (c.tex) w.drawLit(c.plane, { plane: c.tex, glow: c.glow, cut: L.cut ? 0.5 : 0.02, detail: L.detail ?? det });
        if (c.solid) w.drawLit(c.solid, { cut: 0.5, detail: [this.Q.detail * 0.6, 0.12] });
      }
    }
    for (const m of this.movers) if (m.gl) w.drawLit(m.gl, { cut: 0.5, offset: this.moverOffset(m, alpha) });
    if (this.extras.length) {
      for (const x of this.extras) x.renderWorld(this, alpha);
      w.beginLit(cam, A);
    }
    // Transparent layers (cloud decks, haze sheets, coastlines over water).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    // Blend layers and cloud decks, bottom to top (the camera looks down).
    const trans = [...this.layers.filter((L) => L.blend).map((L) => ({ z: L.z, L })), ...this.surfaces.filter((s) => s.type === 'cloud' || s.type === 'blackhole').map((s) => ({ z: s.z, s }))].sort((p, q) => p.z - q.z);
    for (const it of trans) {
      if (it.s) {
        const fp = cam.footprint(it.s.z, 240);
        if (it.s.type === 'blackhole') { it.s.bh[0] = 0; it.s.bh[1] = cam.cy + (it.s.ahead ?? 900); if (Number.isFinite(fp.y0)) w.drawBlackHole(cam, A, it.s, fp); }
        else if (Number.isFinite(fp.y0) && cam.ez > it.s.z + 30) w.drawCloud(cam, A, it.s, fp);
        w.beginLit(cam, A);
        continue;
      }
      const L = it.L;
      for (const c of this.chunks.values()) {
        if (c.layer !== L.id || c.state !== 'ready') continue;
        this._restoreIfLost(c);
        if (c.tex) w.drawLit(c.plane, { plane: c.tex, glow: c.glow, cut: 0.0, alpha: (L.alpha ?? 1) * fadeIn(c), detail: [0, 0] });
        if (c.solid) w.drawLit(c.solid, { cut: 0.0 });
      }
    }
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** After a context restore, GPU copies of chunks are gone: rebuild them. */
  _restoreIfLost(c) {
    if (c.restores === this.wgl.restores) return;
    c.state = 'pending';
    this.chunks.delete(`${c.layer}:${c.k}`);
    this._sync(true);
  }

  /** Sprite FX under entities: ground decals, light pools, flames, then smoke. */
  renderFx(b, alpha) {
    if (this.disposed) return;
    this.cam.frame(alpha);
    this.fx.renderGround(b, this.anchors);
    this.fx.renderParticles(b, alpha);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [, d] of this.uploads) closeBitmaps(d);
    this.uploads.length = 0;
    this.svc.cancel(this);
    for (const [key, c] of this.chunks) this._free(key, c);
    this.chunks.clear();
  }

  get memoryMB() { return Math.round(this.stats.bytes / 1e5) / 10; }
}

function closeBitmaps(d) {
  for (const k of ['canvas', 'glow']) if (d && d[k] && typeof d[k].close === 'function') d[k].close();
}

export { WORLD_W, WORLD_H };
