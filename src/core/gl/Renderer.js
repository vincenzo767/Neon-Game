import { Atlas } from './Atlas.js';
import { SpriteBatch } from './SpriteBatch.js';
import { PostFX } from '../../fx/PostFX.js';
import { Background } from '../../fx/Background.js';
import { buildSprites } from '../../fx/sprites.js';
import { WORLD_W, WORLD_H } from '../constants.js';
import { resetFullscreenVao } from './glUtil.js';

// Owns the WebGL2 context, canvas sizing (3:4 letterbox), the sprite atlas,
// the batcher, the background and the post-processing chain.

export class Renderer {
  /** @param spriteBuilders extra fns(atlas) that add content sprites (pilots, enemies...) */
  constructor(canvas, stage, settings, spriteBuilders = []) {
    this.canvas = canvas;
    this.stage = stage;
    this.settings = settings;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;

    const hdr = !!gl.getExtension('EXT_color_buffer_float');
    // Update 02: 4096² when the GPU allows it (screen-dominating boss art and
    // faction enemy variants); content builders scale down on a 2048 atlas.
    // `?atlas=2048` forces the small-GPU fallback (M7c test aid).
    const forced = Number(new URLSearchParams(location.search).get('atlas')) || 0;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const size = forced === 2048 || max < 4096 ? 2048 : 4096;
    // M7c: if the content doesn't fit (small GPUs), rebuild the whole atlas at
    // a lower texel density. Sprites keep their world size, only get softer.
    for (let texel = 1; ; texel *= 0.85) {
      try {
        this._buildAtlas(size, texel, spriteBuilders);
        break;
      } catch (err) {
        if (!/Atlas full/.test(err.message) || texel < 0.4) throw err;
        console.warn(`[atlas] ${size}² full at texel scale ${texel.toFixed(2)}; retrying smaller`);
      }
    }
    this.frames = this.atlas.frames;
    this.texture = this.atlas.upload(gl);

    this.batch = new SpriteBatch(gl, 32768);
    this.post = new PostFX(gl, hdr);
    this.background = new Background(gl);

    this.cssW = 0;
    this.cssH = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // M7c: survive a WebGL context loss (driver reset, GPU switch, tab
    // eviction). The atlas lives on a CPU canvas, so everything can be rebuilt.
    this.lost = false;
    this.restores = 0;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // ask the browser to restore it
      this.lost = true;
      stage.classList.add('gl-lost');
    });
    canvas.addEventListener('webglcontextrestored', () => this.restoreGL());
    settings.onChange((key) => { if (key === 'quality') this.resize(); });
  }

  /** Draw every sprite into a fresh atlas (timings kept for the stats overlay). */
  _buildAtlas(size, texel, spriteBuilders) {
    this.atlas = new Atlas(size, texel);
    this.buildMs = {};
    let t0 = performance.now();
    const { bulletFrames } = buildSprites(this.atlas);
    this.buildMs.core = Math.round(performance.now() - t0);
    this.bulletFrames = bulletFrames;
    for (const build of spriteBuilders) {
      t0 = performance.now();
      build(this.atlas);
      const k = build.name || 'builder'; // pilot builders all share the name 'sprites'
      this.buildMs[k] = (this.buildMs[k] || 0) + Math.round(performance.now() - t0);
    }
  }

  /** Rebuild every GL object on the restored context, keeping all game state. */
  restoreGL() {
    const gl = this.gl;
    resetFullscreenVao();
    this.post.hdr = !!gl.getExtension('EXT_color_buffer_float');
    this.texture = this.atlas.upload(gl);
    this.batch.initGL();
    this.post.initGL();
    this.background.initGL();
    this.post.resize(this.canvas.width, this.canvas.height);
    this.lost = false;
    this.restores++;
    this.stage.classList.remove('gl-lost');
  }

  /** Sprite frame by name: main atlas first, then lazily built textures (boss art). */
  frame(name) {
    const f = this.extraFrames && this.extraFrames.get(name);
    return f || this.atlas.get(name);
  }

  /** Register frames that live in their own texture (frame.tex). */
  addFrames(frames) {
    if (!this.extraFrames) this.extraFrames = new Map();
    for (const fr of frames) { fr.id = this.frames.length; this.frames.push(fr); this.extraFrames.set(fr.name, fr); }
  }

  hasFrame(name) { return !!(this.extraFrames && this.extraFrames.has(name)) || this.atlas.has(name); }

  /** Fit the 3:4 play field into the window and size the backing store. */
  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const aspect = WORLD_W / WORLD_H;
    let h = vh, w = h * aspect;
    if (w > vw) { w = vw; h = w / aspect; }
    w = Math.floor(w); h = Math.floor(h);
    this.cssW = w; this.cssH = h;
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
    // UI overlays scale their font with the stage.
    this.stage.style.setProperty('--u', `${h / WORLD_H}px`);

    const q = this.settings.qualityPreset;
    const dpr = Math.min(window.devicePixelRatio || 1, q.dprCap);
    const pw = Math.max(240, Math.round(w * dpr * q.renderScale));
    const ph = Math.max(320, Math.round(h * dpr * q.renderScale));
    if (pw !== this.canvas.width || ph !== this.canvas.height || !this.post.targets) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.post.resize(pw, ph);
    }
    this.post.bloomStrength = q.bloom;
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  /** Start a frame: bind the HDR scene buffer and draw the city background. */
  begin(camera, time, alpha = 1) {
    const gl = this.gl;
    this.batch.resetStats();
    this.post.crt = this.settings.data.crt;
    this.post.bindScene();
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.background.render(this.width, this.height, time, alpha,
      camera.offsetX / WORLD_W * 0.6, -camera.offsetY / WORLD_H * 0.6);
    this.batch.begin(this.texture, camera.offsetX, camera.offsetY);
  }

  end(camera) {
    this.batch.end();
    this.post.present(camera.offsetX, camera.offsetY);
  }
}
