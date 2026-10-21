import { compileProgram } from '../../core/gl/glUtil.js';
import { TFLOATS, M4 } from './TankMesh.js';
import { paintTankLayers, layerPixels, LAYERS, TL } from './tankTextures.js';
import { buildWhiteFang } from './whiteFangModel.js';

// GL resources for 3D boss parts drawn inside the arena world pass (depth
// tested against the terrain and solids, lit by the arena's sun).
//
//   tank     lit parts: sun (elevation clamped so the hull reads), sky and
//            snow-bounce fill, Blinn specular from the spec mask, snow
//            settling on up-facing surfaces, emissive strips (charge glow),
//            scorch damage, hit flash, distance fog
//   shadow   planar projection of the parts onto the ground (three jittered
//            passes → soft penumbra; equal-depth rejection stops a pass from
//            double-darkening), plus a soft contact-occlusion pad
//   trail    tread prints: multiplicative ribbon (DST_COLOR × src, src ≤ 2)
//
// One instance per GL context; rebuilt after a context restore.

const STRIDE = TFLOATS * 4;

const TANK_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec3 a_uvl;
layout(location=3) in vec4 a_col;
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec3 u_eye;
uniform vec3 u_fwd;
uniform vec2 u_scroll;
out vec3 v_world; out vec3 v_nrm; out vec3 v_uvl; out vec4 v_col; out float v_depth;
void main() {
  vec4 w = u_model * vec4(a_pos, 1.0);
  v_world = w.xyz;
  v_nrm = mat3(u_model) * a_nrm;
  v_uvl = vec3(a_uvl.xy + u_scroll, a_uvl.z);
  v_col = a_col;
  v_depth = dot(w.xyz - u_eye, u_fwd);
  gl_Position = u_vp * w;
}`;

const TANK_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform sampler2D u_noise;
uniform vec3 u_sunDir;
uniform vec3 u_sunCol;
uniform vec3 u_amb;
uniform vec3 u_eye;
uniform vec3 u_fogCol;
uniform vec3 u_fog;
uniform float u_exposure;
uniform float u_glow;      // emissive intensity for this draw
uniform float u_flash;     // hit flash
uniform float u_damage;    // 0..1 scorching
uniform float u_snow;      // snow cover on up-facing surfaces
uniform float u_heat;      // warm glow (overheated vents, burning wreck)
in vec3 v_world; in vec3 v_nrm; in vec3 v_uvl; in vec4 v_col; in float v_depth;
out vec4 o;
void main() {
  vec4 t = texture(u_tex, v_uvl);
  vec3 N = normalize(v_nrm);
  vec3 V = normalize(u_eye - v_world);
  if (dot(N, V) < -0.2) N = -N; // mirrored instances: keep normals facing out
  float spec = t.a;
  vec3 alb = t.rgb * v_col.rgb;
  float em = v_col.a;
  // Snow settles on up-facing surfaces, broken up by world-space noise.
  float n1 = texture(u_noise, v_world.xy * 0.011).r, n2 = texture(u_noise, v_world.xy * 0.05 + 0.3).g;
  float sn = smoothstep(0.62, 0.95, N.z) * smoothstep(0.38, 0.62, n1 * 0.7 + n2 * 0.45) * u_snow * (1.0 - em);
  alb = mix(alb, vec3(0.93, 0.96, 1.0), sn);
  spec = mix(spec, 0.45, sn);
  // Scorch damage: blotchy soot that grows with u_damage.
  float sc = smoothstep(0.75 - u_damage * 0.55, 0.85 - u_damage * 0.5, texture(u_noise, v_world.xy * 0.018 + 0.7).r);
  alb *= mix(1.0, 0.22, sc * u_damage);
  // Lighting: key sun (wrapped a touch), sky dome, bounce off the snow.
  vec3 L = normalize(u_sunDir);
  float ndl = max(0.0, dot(N, L) * 0.92 + 0.08);
  vec3 sky = u_amb * (0.42 + 0.48 * N.z);
  vec3 bounce = vec3(0.55, 0.6, 0.68) * 0.3 * clamp(0.5 - 0.5 * N.z, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float sp = pow(max(0.0, dot(N, H)), mix(14.0, 80.0, spec)) * (0.1 + 1.4 * spec * spec);
  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.0) * 0.14;
  // Kept under the bloom threshold: only specular glints and emissives glow.
  vec3 col = alb * (sky + u_sunCol * ndl * 0.9 + bounce) * 0.9 + u_sunCol * sp * (1.0 - em) + u_amb * rim;
  col += v_col.rgb * t.rgb * em * u_glow * 2.2;
  col += vec3(1.0, 0.42, 0.12) * u_heat * (0.4 + 0.6 * sc) * (1.0 - N.z * 0.5);
  col = mix(col, vec3(1.7, 1.75, 1.85), u_flash * 0.45);
  col *= u_exposure;
  float f = clamp((v_depth - u_fog.x) / max(1.0, u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z;
  o = vec4(mix(col, u_fogCol, f), 1.0);
}`;

const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=2) in vec3 a_uvl;
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec3 u_light;   // toward the light (normalised, z > 0)
uniform float u_plane;  // ground height the shadow lands on
uniform int u_mode;     // 0 projected mesh, 1 contact pad (unit quad)
out vec2 v_q;
void main() {
  vec4 w = u_model * vec4(a_pos, 1.0);
  if (u_mode == 0) w.xyz -= u_light * ((w.z - u_plane) / u_light.z);
  else w.z = u_plane;
  v_q = a_pos.xy;
  gl_Position = u_vp * w;
}`;

const SHADOW_FS = `#version 300 es
precision highp float;
precision highp int;
uniform float u_alpha;
uniform int u_mode;
uniform vec3 u_shCol;
uniform vec2 u_soft;     // contact pad: corner radius, softness (unit-quad space)
in vec2 v_q;
out vec4 o;
void main() {
  float a = u_alpha;
  if (u_mode == 1) {
    vec2 q = abs(v_q) - vec2(1.0 - u_soft.x);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_soft.x;
    a *= 1.0 - smoothstep(-u_soft.y, 0.0, d);
  }
  o = vec4(u_shCol * a, a);
}`;

const TRAIL_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_uva;
uniform mat4 u_vp;
out vec3 v_uva;
void main() { v_uva = a_uva; gl_Position = u_vp * vec4(a_pos, 1.0); }`;

const TRAIL_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform float u_layer;
uniform float u_hdr;
in vec3 v_uva;
out vec4 o;
void main() {
  float m = texture(u_tex, vec3(v_uva.xy, u_layer)).r * 2.0;
  float e = smoothstep(0.0, 0.08, v_uva.x) * smoothstep(1.0, 0.92, v_uva.x);
  m = mix(1.0, m, clamp(v_uva.z, 0.0, 1.0) * e);
  if (u_hdr < 0.5) m = min(m, 1.0);
  o = vec4(vec3(m * 0.98, m * 0.99, m), 1.0);
}`;

const CACHE = new WeakMap();

/** Tank renderer for this WorldGL (built on first use; ~80 ms of painting). */
export function tankRenderer(wgl, quality = 'high') {
  let r = CACHE.get(wgl);
  if (r && r.restores === wgl.restores) return r;
  r = new TankRenderer(wgl, quality, r);
  CACHE.set(wgl, r);
  return r;
}

let MODEL = null; // geometry is plain data: built once per session

export class TankRenderer {
  constructor(wgl, quality, prev) {
    this.wgl = wgl;
    this.gl = wgl.gl;
    this.restores = wgl.restores;
    this.size = quality === 'low' ? 256 : 512;
    this.layers = prev && prev.layers && prev.size === this.size ? prev.layers : null;
    const gl = this.gl;
    this.tank = compileProgram(gl, TANK_VS, TANK_FS, 'tank-lit');
    this.shadow = compileProgram(gl, SHADOW_VS, SHADOW_FS, 'tank-shadow');
    this.trailP = compileProgram(gl, TRAIL_VS, TRAIL_FS, 'tank-trail');
    this.tex = this._textures();
    if (!MODEL) MODEL = buildWhiteFang();
    this.mesh = {};
    for (const [k, d] of Object.entries(MODEL)) this.mesh[k] = this._upload(d);
    this.quad = this._upload(unitQuad());
    this.trailVao = gl.createVertexArray();
    this.trailBuf = gl.createBuffer();
    gl.bindVertexArray(this.trailVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    this.trailCap = 0;
    this.mtmp = new Float32Array(16);
  }

  _textures() {
    const gl = this.gl, S = this.size;
    if (!this.layers) this.layers = paintTankLayers(S).map((p) => layerPixels(p, S));
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(S) + 1, gl.RGBA8, S, S, LAYERS);
    this.layers.forEach((img, k) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, img.data));
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  }

  _upload(d) {
    const gl = this.gl;
    const vao = gl.createVertexArray(), buf = gl.createBuffer(), ibuf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, d.v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE, 36);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.i, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: d.count };
  }

  // ----------------------------------------------------------- tank pass

  /**
   * Bind the lit program for this frame. light: { dir (toward the sun),
   * col, amb }, A: the arena atmosphere (fog, exposure).
   */
  begin(cam, A, light) {
    const gl = this.gl, p = this.tank, u = p.u;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform3fv(u.u_sunDir, light.dir);
    gl.uniform3fv(u.u_sunCol, light.col);
    gl.uniform3fv(u.u_amb, light.amb);
    gl.uniform3fv(u.u_fogCol, A.fogCol);
    // The tank sits in the foreground of a top-down view: a third of the arena haze keeps it crisp.
    gl.uniform3f(u.u_fog, A.fog[0], A.fog[1], A.fog[2] * 0.35);
    gl.uniform1f(u.u_exposure, A.exposure);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.wgl.noiseTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.u_tex, 5);
    gl.uniform1i(u.u_noise, 4);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
  }

  /** o: { scroll [u, v], glow, flash, damage, snow, heat } */
  draw(name, model, o = {}) {
    const m = this.mesh[name];
    if (!m || !m.count) return;
    const gl = this.gl, u = this.tank.u;
    gl.uniformMatrix4fv(u.u_model, false, model);
    gl.uniform2f(u.u_scroll, o.scroll ? o.scroll[0] : 0, o.scroll ? o.scroll[1] : 0);
    gl.uniform1f(u.u_glow, o.glow ?? 0.6);
    gl.uniform1f(u.u_flash, o.flash || 0);
    gl.uniform1f(u.u_damage, o.damage || 0);
    gl.uniform1f(u.u_snow, o.snow ?? 0.35);
    gl.uniform1f(u.u_heat, o.heat || 0);
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  }

  // --------------------------------------------------------- shadow pass

  beginShadow(cam) {
    const gl = this.gl, p = this.shadow, u = p.u;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_shCol, 0.02, 0.035, 0.07);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
  }

  /** Soft contact pad under the hull: model maps the unit quad (±1) onto the footprint. */
  contact(model, alpha, soft = [0.25, 0.35], plane = 0.35) {
    const gl = this.gl, u = this.shadow.u;
    gl.depthMask(false);
    gl.depthFunc(gl.LEQUAL);
    gl.uniform1i(u.u_mode, 1);
    gl.uniformMatrix4fv(u.u_model, false, model);
    gl.uniform1f(u.u_plane, plane);
    gl.uniform1f(u.u_alpha, alpha);
    gl.uniform2fv(u.u_soft, soft);
    gl.bindVertexArray(this.quad.vao);
    gl.drawElements(gl.TRIANGLES, this.quad.count, gl.UNSIGNED_INT, 0);
  }

  /**
   * One projected-shadow pass of a set of parts: [[meshName, model], ...].
   * Each pass lands on its own plane height so passes stack while the
   * overlapping triangles inside one pass don't (depth LESS, write on).
   */
  shadowPass(items, lightDir, plane, alpha) {
    const gl = this.gl, u = this.shadow.u;
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.uniform1i(u.u_mode, 0);
    gl.uniform3fv(u.u_light, lightDir);
    gl.uniform1f(u.u_plane, plane);
    gl.uniform1f(u.u_alpha, alpha);
    for (const [name, model] of items) {
      const m = this.mesh[name];
      if (!m) continue;
      gl.uniformMatrix4fv(u.u_model, false, model);
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    gl.depthFunc(gl.LEQUAL);
  }

  // ---------------------------------------------------------- trail pass

  /** Tread ribbons: data = Float32Array of triangles (x y z u v a), n vertices. */
  trail(cam, data, n, hdr = true) {
    if (!n) return;
    const gl = this.gl, p = this.trailP, u = p.u;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform1f(u.u_layer, TL.TREAD);
    gl.uniform1f(u.u_hdr, hdr ? 1 : 0);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.u_tex, 5);
    gl.bindVertexArray(this.trailVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf);
    if (data.byteLength > this.trailCap) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.trailCap = data.byteLength; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 6);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    // Depth LESS + write: overlapping strips (a track crossing its own path)
    // land once instead of multiplying darker and darker.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
  }

  /** Leave GL the way the world pass expects it. */
  end() {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.activeTexture(gl.TEXTURE0);
  }
}

function unitQuad() {
  const v = new Float32Array(4 * TFLOATS), i = new Uint32Array([0, 1, 2, 0, 2, 3]);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y], k) => { v[k * TFLOATS] = x; v[k * TFLOATS + 1] = y; v[k * TFLOATS + 5] = 1; });
  return { v, i, count: 6 };
}

export { M4 };
