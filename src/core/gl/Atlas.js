import { SPRITE_PX } from '../constants.js';

// Runtime texture atlas. Every sprite in the game is drawn procedurally with
// Canvas2D into one big texture at startup, so the whole scene can render
// with a single texture binding (and usually a single draw call).

const PAD = 4; // texels of empty border per sprite (prevents mip/filter bleed)

export class Atlas {
  constructor(size = 2048) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.frames = [];          // by id
    this.byName = new Map();   // name -> frame
    this.cx = 0;
    this.cy = 0;
    this.rowH = 0;
  }

  /**
   * Rasterise a sprite. drawFn(ctx, w, h) draws in WORLD units inside a
   * w x h box (the context is pre-scaled to SPRITE_PX texels per unit).
   * @param {object} [opt] { inset: true } samples only the interior (solid fills)
   */
  add(name, w, h, drawFn, opt = {}) {
    const scale = opt.scale || SPRITE_PX;
    const pw = Math.ceil(w * scale);
    const ph = Math.ceil(h * scale);
    const bw = pw + PAD * 2;
    const bh = ph + PAD * 2;
    if (this.cx + bw > this.size) {
      this.cx = 0;
      this.cy += this.rowH;
      this.rowH = 0;
    }
    if (this.cy + bh > this.size) throw new Error(`Atlas full while adding "${name}"`);
    const x = this.cx + PAD;
    const y = this.cy + PAD;
    this.cx += bw;
    this.rowH = Math.max(this.rowH, bh);

    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, pw, ph);
    ctx.clip();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawFn(ctx, w, h);
    ctx.restore();

    const inset = opt.inset ? 2 : 0;
    const s = this.size;
    const frame = {
      id: this.frames.length,
      name,
      w, h,
      u0: (x + inset) / s,
      v0: (y + inset) / s,
      u1: (x + pw - inset) / s,
      v1: (y + ph - inset) / s,
    };
    this.frames.push(frame);
    this.byName.set(name, frame);
    return frame;
  }

  get(name) {
    const f = this.byName.get(name);
    if (!f) throw new Error(`Unknown sprite "${name}"`);
    return f;
  }

  has(name) { return this.byName.has(name); }

  upload(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Premultiply on upload: the sprite shader works in premultiplied alpha,
    // which lets additive and alpha-blended sprites share one blend mode.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = tex;
    return tex;
  }
}
