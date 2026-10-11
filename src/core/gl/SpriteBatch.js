import { compileProgram } from './glUtil.js';
import { WORLD_W, WORLD_H } from '../constants.js';

// Instanced sprite batcher.
//
// One quad mesh + one per-instance attribute buffer. Because the atlas is
// premultiplied we use a single blend func (ONE, ONE_MINUS_SRC_ALPHA) for
// everything: a sprite is drawn additively simply by zeroing its output
// alpha (`add` = 1). Mixed additive/alpha sprites therefore never break the
// batch, and the whole frame is typically 1-3 draw calls even with 5k+
// sprites.
//
// Pilot art (core/pilotArt.js) lives in small per-pilot textures: a frame
// with a `tex` field is drawn from that texture. The batch flushes and
// rebinds only when consecutive sprites need different textures, so frames
// from the main atlas (no `tex`) keep batching as before.

const VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_posSize;   // x, y, w, h (world units)
layout(location=2) in vec4 a_uv;        // u0, v0, u1, v1
layout(location=3) in vec4 a_color;     // rgb tint (may exceed 1 for HDR), alpha
layout(location=4) in vec2 a_rotAdd;    // rotation (rad), additive amount 0..1
uniform vec4 u_view;                    // offsetX, offsetY, 2/W, -2/H
out vec2 v_uv;
out vec4 v_color;
out float v_add;
void main() {
  float c = cos(a_rotAdd.x), s = sin(a_rotAdd.x);
  vec2 p = a_corner * a_posSize.zw;
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + a_posSize.xy;
  vec2 clip = (p - u_view.xy) * u_view.zw + vec2(-1.0, 1.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = mix(a_uv.xy, a_uv.zw, a_corner + 0.5);
  v_color = a_color;
  v_add = a_rotAdd.y;
}`;

const FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
in vec4 v_color;
in float v_add;
out vec4 o;
void main() {
  vec4 t = texture(u_tex, v_uv);
  vec4 c = t * vec4(v_color.rgb * v_color.a, v_color.a);
  c.a *= 1.0 - v_add;
  o = c;
}`;

const FLOATS = 14;
const STRIDE = FLOATS * 4;

export class SpriteBatch {
  constructor(gl, capacity = 32768) {
    this.gl = gl;
    this.capacity = capacity;
    this.data = new Float32Array(capacity * FLOATS);
    this.count = 0;
    this.drawCalls = 0;
    this.instances = 0;
    this.viewX = 0;
    this.viewY = 0;
    this.initGL();
  }

  /** Create the GL objects (again after a context loss, M7c). */
  initGL() {
    const gl = this.gl;
    this.program = compileProgram(gl, VS, FS, 'sprite');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const attr = (loc, size, offsetFloats) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offsetFloats * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr(1, 4, 0);
    attr(2, 4, 4);
    attr(3, 4, 8);
    attr(4, 2, 12);
    gl.bindVertexArray(null);
  }

  /** Begin a run of sprites. Camera offset in world units. */
  begin(texture, viewX = 0, viewY = 0) {
    const gl = this.gl;
    this.texture = texture;
    this.mainTexture = texture;
    this.viewX = viewX;
    this.viewY = viewY;
    this.count = 0;
    gl.useProgram(this.program.prog);
    gl.uniform4f(this.program.u.u_view, viewX, viewY, 2 / WORLD_W, -2 / WORLD_H);
    gl.uniform1i(this.program.u.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * Queue a sprite centred on (x, y).
   * @param frame atlas frame
   * @param w,h  size in world units
   * @param rot  rotation in radians (sprites face +x for headings)
   * @param add  0 = alpha blend, 1 = additive, in-between = mix
   */
  draw(frame, x, y, w, h, rot, r, g, b, a, add) {
    const tex = frame.tex || this.mainTexture;
    if (tex !== this.texture) this._bind(tex);
    if (this.count >= this.capacity) this.flush();
    const d = this.data;
    let i = this.count * FLOATS;
    d[i++] = x; d[i++] = y; d[i++] = w; d[i++] = h;
    d[i++] = frame.u0; d[i++] = frame.v0; d[i++] = frame.u1; d[i++] = frame.v1;
    d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = a;
    d[i++] = rot; d[i] = add;
    this.count++;
  }

  /** Convenience: draw at the frame's native size times `scale`. */
  sprite(frame, x, y, scale = 1, rot = 0, a = 1, add = 0) {
    this.draw(frame, x, y, frame.w * scale, frame.h * scale, rot, 1, 1, 1, a, add);
  }

  /** Switch texture mid-run (flushes what was queued for the previous one). */
  _bind(tex) {
    this.flush();
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.texture = tex;
  }

  flush() {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
    this.drawCalls++;
    this.instances += this.count;
    this.count = 0;
  }

  end() { this.flush(); }

  resetStats() { this.drawCalls = 0; this.instances = 0; }
}
