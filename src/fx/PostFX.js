import { compileProgram, createTarget, destroyTarget, drawFullscreen, FULLSCREEN_VS } from '../core/gl/glUtil.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';

// Post-processing pipeline:
//
//   scene (HDR) ──► bright-pass ½ ──► blur H/V ½ ─┐
//                                 └─► ¼ blur H/V ─┤
//   scene ───────────────────────────────────────┴─► composite ──► screen
//
// Composite applies (in order): CRT barrel warp, shockwave refraction,
// heat haze, chromatic aberration, bloom add, ACES tonemap, flash overlay,
// vignette, scanlines + aperture mask, film grain.

const MAX_WAVES = 8;

const BRIGHT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_threshold;
in vec2 v_uv; out vec4 o;
void main() {
  // 4-tap box downsample keeps tiny bright bullets from flickering.
  vec3 c = texture(u_src, v_uv + u_texel * vec2(-0.5, -0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2( 0.5, -0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2(-0.5,  0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2( 0.5,  0.5)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float w = smoothstep(u_threshold, u_threshold + 0.5, l);
  o = vec4(c * w, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_dir; // texel step * spread
in vec2 v_uv; out vec4 o;
void main() {
  // 9-tap gaussian folded into 5 bilinear fetches.
  vec3 c = texture(u_src, v_uv).rgb * 0.2270270270;
  c += texture(u_src, v_uv + u_dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(u_src, v_uv - u_dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(u_src, v_uv + u_dir * 3.2307692308).rgb * 0.0702702703;
  c += texture(u_src, v_uv - u_dir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv; out vec4 o;
void main() {
  vec3 c = texture(u_src, v_uv + u_texel * vec2(-0.5, -0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2( 0.5, -0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2(-0.5,  0.5)).rgb
         + texture(u_src, v_uv + u_texel * vec2( 0.5,  0.5)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_bloomA;
uniform sampler2D u_bloomB;
uniform vec2 u_res;
uniform float u_time;
uniform vec4 u_waves[${MAX_WAVES}];   // x, y (uv), radius (uv height units), strength
uniform int u_waveCount;
uniform float u_aberr;
uniform float u_bloom;
uniform float u_crt;
uniform float u_haze;
uniform vec4 u_flash;                 // rgb, amount
uniform float u_saturation;
in vec2 v_uv; out vec4 o;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;

  if (u_crt > 0.5) {
    vec2 cc = uv * 2.0 - 1.0;
    vec2 off = abs(cc.yx) / vec2(7.0, 5.5);
    cc += cc * off * off;
    uv = cc * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  }

  // Shockwave refraction: a sine lens profile across each ring's thickness.
  vec2 disp = vec2(0.0);
  float ringLight = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= u_waveCount) break;
    vec4 w = u_waves[i];
    vec2 d = uv - w.xy;
    d.x *= aspect;
    float dist = length(d);
    float thick = 0.05 + w.z * 0.25;
    float diff = dist - w.z;
    if (abs(diff) < thick) {
      float k = 1.0 - abs(diff) / thick;
      float s = sin(diff / thick * 3.14159265) * k;
      vec2 dir = d / max(dist, 1e-4);
      dir.x /= aspect;
      disp -= dir * s * w.w;
      ringLight += k * k * w.w * 6.0;
    }
  }

  // Heat haze: low-frequency wobble, strongest near the bottom of the screen.
  if (u_haze > 0.0) {
    float hz = u_haze * (0.4 + 0.6 * (1.0 - uv.y));
    disp += vec2(sin(uv.y * 90.0 + u_time * 7.0), cos(uv.x * 70.0 + u_time * 5.0)) * 0.0016 * hz;
  }

  vec2 suv = uv + disp;
  vec2 cdir = suv - 0.5;
  float ca = u_aberr + dot(cdir, cdir) * 0.004; // slight baseline lens fringe at edges
  vec3 col;
  col.r = texture(u_scene, suv + cdir * ca).r;
  col.g = texture(u_scene, suv).g;
  col.b = texture(u_scene, suv - cdir * ca).b;

  vec3 bloom = texture(u_bloomA, suv).rgb * 0.7 + texture(u_bloomB, suv).rgb * 0.9;
  col += bloom * u_bloom;
  col += vec3(0.6, 0.85, 1.0) * ringLight;

  col = aces(col * 1.05);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, u_saturation);
  col = mix(col, u_flash.rgb, clamp(u_flash.a, 0.0, 1.0));

  // Vignette.
  vec2 vv = uv - 0.5;
  col *= 1.0 - dot(vv, vv) * 0.9;

  if (u_crt > 0.5) {
    float scan = 0.78 + 0.22 * sin((uv.y * u_res.y) * 3.14159265 * 0.5);
    col *= scan;
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 mask = m < 1.0 ? vec3(1.08, 0.94, 0.94) : m < 2.0 ? vec3(0.94, 1.08, 0.94) : vec3(0.94, 0.94, 1.08);
    col *= mask;
    col *= 1.12;
  }

  col += (hash(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5) * 0.025;
  o = vec4(col, 1.0);
}`;

export class PostFX {
  constructor(gl, hdr) {
    this.gl = gl;
    this.hdr = hdr;
    this.initGL();

    // Live effect state.
    this.waves = [];
    this.waveData = new Float32Array(MAX_WAVES * 4);
    this.aberration = 0;
    this.flashColor = [1, 1, 1];
    this.flashAmount = 0;
    this.flashDecay = 0.1;
    this.haze = 0;
    this.baseHaze = 0;
    this.saturation = 1;
    this.time = 0;
    this.bloomStrength = 1;
    this.crt = false;
  }

  /** Compile the passes; after a context loss the old targets are simply dropped (M7c). */
  initGL() {
    const gl = this.gl;
    this.bright = compileProgram(gl, FULLSCREEN_VS, BRIGHT_FS, 'bright');
    this.blur = compileProgram(gl, FULLSCREEN_VS, BLUR_FS, 'blur');
    this.copy = compileProgram(gl, FULLSCREEN_VS, COPY_FS, 'copy');
    this.composite = compileProgram(gl, FULLSCREEN_VS, COMPOSITE_FS, 'composite');
    this.targets = null;
  }

  resize(w, h) {
    const gl = this.gl;
    if (this.targets) for (const t of Object.values(this.targets)) destroyTarget(gl, t);
    const mk = (tw, th, depth = false) => {
      let t = this.hdr ? createTarget(gl, tw, th, true, depth) : null;
      if (!t) { this.hdr = false; t = createTarget(gl, tw, th, false, depth); }
      return t;
    };
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.targets = {
      scene: mk(w, h, true), // depth: the arena world pass (world/)
      halfA: mk(hw, hh), halfB: mk(hw, hh),
      quarterA: mk(qw, qh), quarterB: mk(qw, qh),
    };
    this.w = w;
    this.h = h;
  }

  // ---- Effect triggers (world coordinates) --------------------------------

  /** Expanding refraction ring. strength ~0.01 (small) .. 0.06 (bomb). */
  shockwave(x, y, strength = 0.03, speed = 0.018, maxRadius = 0.6) {
    if (this.waves.length >= MAX_WAVES) this.waves.shift();
    this.waves.push({ x, y, r: 0, strength, s0: strength, speed, maxRadius });
  }

  aberrate(amount) { this.aberration = Math.min(0.06, this.aberration + amount); }

  flash(r, g, b, amount = 0.6, decay = 0.08) {
    this.flashColor[0] = r; this.flashColor[1] = g; this.flashColor[2] = b;
    this.flashAmount = Math.max(this.flashAmount, amount);
    this.flashDecay = decay;
  }

  heat(amount) { this.haze = Math.min(2, this.haze + amount); }

  update(dt) {
    const k = dt * 60;
    this.time += dt;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r += w.speed * k;
      w.strength = w.s0 * Math.max(0, 1 - w.r / w.maxRadius);
      if (w.r >= w.maxRadius) this.waves.splice(i, 1);
    }
    this.aberration *= Math.pow(0.86, k);
    if (this.aberration < 1e-4) this.aberration = 0;
    this.flashAmount = Math.max(0, this.flashAmount - this.flashDecay * k);
    this.haze += (this.baseHaze - this.haze) * (1 - Math.pow(0.95, k));
  }

  /** Bind the HDR scene target for world rendering. */
  bindScene() {
    const gl = this.gl;
    const t = this.targets.scene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
  }

  _pass(program, target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.w, target ? target.h : this.h);
    gl.useProgram(program.prog);
  }

  _blur(src, tmp, spread) {
    const gl = this.gl;
    this._pass(this.blur, tmp);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform2f(this.blur.u.u_dir, spread / src.w, 0);
    drawFullscreen(gl);
    this._pass(this.blur, src);
    gl.bindTexture(gl.TEXTURE_2D, tmp.tex);
    gl.uniform2f(this.blur.u.u_dir, 0, spread / src.h);
    drawFullscreen(gl);
  }

  /** Run the chain and present to the default framebuffer. */
  present(camOffX, camOffY) {
    const gl = this.gl;
    const T = this.targets;
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);

    // Bright pass -> half res.
    this._pass(this.bright, T.halfA);
    gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
    gl.uniform1i(this.bright.u.u_src, 0);
    gl.uniform2f(this.bright.u.u_texel, 1 / T.scene.w, 1 / T.scene.h);
    gl.uniform1f(this.bright.u.u_threshold, this.hdr ? 0.85 : 0.6);
    drawFullscreen(gl);
    this._blur(T.halfA, T.halfB, 1.0);

    // Quarter res, two wide passes for a soft halo.
    this._pass(this.copy, T.quarterA);
    gl.bindTexture(gl.TEXTURE_2D, T.halfA.tex);
    gl.uniform2f(this.copy.u.u_texel, 1 / T.halfA.w, 1 / T.halfA.h);
    drawFullscreen(gl);
    this._blur(T.quarterA, T.quarterB, 1.5);
    this._blur(T.quarterA, T.quarterB, 2.5);

    // Composite.
    const c = this.composite;
    this._pass(c, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.halfA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.quarterA.tex);
    gl.uniform1i(c.u.u_scene, 0);
    gl.uniform1i(c.u.u_bloomA, 1);
    gl.uniform1i(c.u.u_bloomB, 2);
    gl.uniform2f(c.u.u_res, this.w, this.h);
    gl.uniform1f(c.u.u_time, this.time);

    const n = Math.min(this.waves.length, MAX_WAVES);
    for (let i = 0; i < n; i++) {
      const w = this.waves[i];
      // World -> screen uv (uv.y is up).
      this.waveData[i * 4] = (w.x - camOffX) / WORLD_W;
      this.waveData[i * 4 + 1] = 1 - (w.y - camOffY) / WORLD_H;
      this.waveData[i * 4 + 2] = w.r;
      this.waveData[i * 4 + 3] = w.strength;
    }
    gl.uniform4fv(c.u.u_waves, this.waveData);
    gl.uniform1i(c.u.u_waveCount, n);
    gl.uniform1f(c.u.u_aberr, this.aberration);
    gl.uniform1f(c.u.u_bloom, this.bloomStrength);
    gl.uniform1f(c.u.u_crt, this.crt ? 1 : 0);
    gl.uniform1f(c.u.u_haze, this.haze);
    gl.uniform4f(c.u.u_flash, this.flashColor[0], this.flashColor[1], this.flashColor[2], this.flashAmount);
    gl.uniform1f(c.u.u_saturation, this.saturation);
    drawFullscreen(gl);
    gl.activeTexture(gl.TEXTURE0);
  }
}
