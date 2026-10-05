import { Atlas } from './Atlas.js';
import { SpriteBatch } from './SpriteBatch.js';
import { PostFX } from '../../fx/PostFX.js';
import { Background } from '../../fx/Background.js';
import { buildSprites } from '../../fx/sprites.js';
import { WORLD_W, WORLD_H } from '../constants.js';

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
    this.atlas = new Atlas(2048);
    const { bulletFrames } = buildSprites(this.atlas);
    this.bulletFrames = bulletFrames;
    for (const build of spriteBuilders) build(this.atlas);
    this.frames = this.atlas.frames;
    this.texture = this.atlas.upload(gl);

    this.batch = new SpriteBatch(gl, 32768);
    this.post = new PostFX(gl, hdr);
    this.background = new Background(gl);

    this.cssW = 0;
    this.cssH = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange((key) => { if (key === 'quality') this.resize(); });
  }

  frame(name) { return this.atlas.get(name); }

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
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.background.render(this.width, this.height, time, alpha,
      camera.offsetX / WORLD_W * 0.6, -camera.offsetY / WORLD_H * 0.6);
    this.batch.begin(this.texture, camera.offsetX, camera.offsetY);
  }

  end(camera) {
    this.batch.end();
    this.post.present(camera.offsetX, camera.offsetY);
  }
}
