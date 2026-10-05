import { compileProgram, drawFullscreen, FULLSCREEN_VS } from '../core/gl/glUtil.js';

// Procedural biome backgrounds, rendered as one fullscreen fragment shader
// into the HDR scene target underneath all sprite layers.
//
// Modes (see stages/biomes.js):
//   0 CITY     tilted megacity: rooftops, neon trims, holo panels, traffic
//   1 HARBOR   acid water with ripples + container piers
//   2 FOUNDRY  riveted plates split by flowing magma rivers
//   3 VOID     data-core grid, falling data streams, pulsing nodes
//   4 ORBITAL  starfield, planet limb + atmosphere, elevator cable
//   5 STORM    churning cloud deck with lightning, the Storm Ring arc
// The tilted ground-plane modes share fog and volumetric light shafts.

const FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scroll;
uniform vec2 u_shake;
uniform vec3 u_base;
uniform vec3 u_fog;
uniform vec3 u_neonA;
uniform vec3 u_neonB;
uniform float u_tilt;
uniform float u_bright;
uniform float u_detail;
uniform float u_flash;
uniform int u_mode;
in vec2 v_uv; out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

// Ground-plane coordinates under a tilted camera (top of screen = far away).
vec2 ground(vec2 uv, out float depth) {
  depth = 1.0 / (1.0 - uv.y * u_tilt);
  return vec2((uv.x - 0.5) * depth * 5.0, uv.y * depth * 5.0 + u_scroll);
}

vec3 city(vec2 g, float aa) {
  vec2 cell = floor(g), f = fract(g);
  float h = hash(cell), h2 = hash(cell + 17.7);
  float roadW = 0.16;
  float roadX = 1.0 - smoothstep(roadW - aa, roadW + aa, f.x);
  float roadY = 1.0 - smoothstep(roadW - aa, roadW + aa, f.y);
  float road = max(roadX, roadY);

  vec2 rf = (f - roadW) / (1.0 - roadW);
  float edge = min(min(rf.x, 1.0 - rf.x), min(rf.y, 1.0 - rf.y));
  vec3 col = u_base * (0.35 + h * 0.65);
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.25, edge);
  float rim = 1.0 - smoothstep(0.0, 0.03 + aa, edge);
  col += mix(u_neonA, u_neonB, step(0.5, h2)) * rim * step(0.55 - u_detail * 0.3, h) * 0.9;
  // Spire detail: stepped tower tops.
  if (u_detail > 0.6) {
    float inner = 1.0 - smoothstep(0.0, 0.02 + aa, abs(edge - 0.22));
    col += mix(u_neonB, u_neonA, h) * inner * step(0.4, h2) * 0.5;
  }
  vec2 sub = floor(rf * 6.0);
  float lit = step(0.82 - u_detail * 0.1, hash(cell * 7.0 + sub));
  vec2 sf = fract(rf * 6.0) - 0.5;
  float dotm = smoothstep(0.25, 0.0, length(sf)) * lit * step(0.05, edge);
  col += mix(vec3(1.0, 0.75, 0.4), u_neonA, step(0.6, hash(cell + sub))) * dotm * 0.45;
  if (h2 > 0.86 - u_detail * 0.1) {
    vec2 p = abs(rf - 0.5);
    float panel = step(max(p.x, p.y * 1.8), 0.28);
    float bars = step(0.5, fract(rf.y * 10.0 - u_time * 1.5));
    float flick = 0.7 + 0.3 * step(0.1, hash1(floor(u_time * 12.0) + h * 91.0));
    col = mix(col, mix(u_neonB, u_neonA, bars) * 1.6 * flick, panel * 0.85);
  }
  vec3 roadCol = vec3(0.02, 0.025, 0.04);
  float dash = step(0.5, fract(g.y * 3.0)) * (1.0 - smoothstep(0.004, 0.01 + aa, abs(f.x - roadW * 0.5)));
  roadCol += vec3(0.3, 0.3, 0.2) * dash * 0.25;
  float laneA = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.x - roadW * 0.28));
  float laneB = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.x - roadW * 0.72));
  float tA = fract(g.y * 2.0 + u_time * 1.6 + hash1(cell.x) * 10.0);
  float tB = fract(g.y * 2.0 - u_time * 1.1 + hash1(cell.x + 3.0) * 10.0);
  roadCol += vec3(1.0, 0.95, 0.85) * laneA * smoothstep(0.9, 1.0, tA) * 1.3 * roadX;
  roadCol += vec3(1.0, 0.1, 0.15) * laneB * smoothstep(0.9, 1.0, tB) * 1.0 * roadX;
  float laneC = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.y - roadW * 0.5));
  float tC = fract(g.x * 1.5 + u_time * 1.3 * (hash1(cell.y) > 0.5 ? 1.0 : -1.0) + hash1(cell.y) * 7.0);
  roadCol += mix(u_neonA, vec3(1.0, 0.9, 0.7), 0.5) * laneC * smoothstep(0.93, 1.0, tC) * roadY * (1.0 - roadX);
  roadCol += mix(u_neonA, u_neonB, h) * 0.08 * (0.5 + 0.5 * sin(g.y * 30.0 + h * 20.0));
  return mix(col, roadCol, road);
}

vec3 harbor(vec2 g, float aa) {
  vec2 cell = floor(g), f = fract(g);
  float n = fbm(g * 1.5 + vec2(u_time * 0.15, u_time * 0.1));
  float rip = sin(g.y * 14.0 + n * 6.0 + u_time * 2.0) * 0.5 + 0.5;
  vec3 water = mix(vec3(0.01, 0.035, 0.03), u_neonA * 0.14, n * 0.6) + u_neonA * pow(rip, 18.0) * 0.07;
  float streak = smoothstep(0.92, 1.0, sin(g.x * 3.1 + hash(vec2(cell.x, 1.0)) * 6.0) * 0.5 + 0.5);
  water += mix(u_neonA, u_neonB, step(0.5, hash(vec2(cell.x, 0.0)))) * 0.08 * streak * (0.6 + 0.4 * sin(g.y * 20.0 + u_time * 3.0));
  // Long piers in some columns, stacked with shipping containers.
  float pierCol = step(hash(vec2(cell.x, 7.0)), 0.4);
  float inPier = pierCol * smoothstep(0.18 - aa, 0.18 + aa, f.x) * (1.0 - smoothstep(0.82 - aa, 0.82 + aa, f.x));
  vec2 sp = vec2(f.x * 3.0, g.y * 4.0);
  vec2 sub = floor(sp);
  float ch = hash(sub + cell.x * 13.0);
  vec3 cont = mix(vec3(0.35, 0.08, 0.05), vec3(0.05, 0.25, 0.3), step(0.5, ch));
  cont = mix(cont, vec3(0.4, 0.32, 0.05), step(0.82, ch));
  vec2 sf = fract(sp);
  float box = step(0.08, sf.x) * step(sf.x, 0.92) * step(0.06, sf.y) * step(sf.y, 0.94) * step(0.25, ch);
  vec3 pier = mix(vec3(0.07, 0.08, 0.09), cont * (0.55 + 0.4 * fract(ch * 7.0)), box);
  pier *= 0.85 + 0.15 * step(0.5, fract(sf.x * 6.0)); // corrugation
  pier += u_neonB * (1.0 - smoothstep(0.0, 0.015 + aa, abs(f.x - 0.19))) * step(0.5, fract(g.y * 2.0)) * 0.9;
  return mix(water, pier, inPier);
}

vec3 foundry(vec2 g, float aa) {
  vec2 cell = floor(g), f = fract(g);
  float h = hash(cell);
  vec3 plate = u_base * (0.35 + 0.4 * h);
  float seam = 1.0 - smoothstep(0.0, 0.03 + aa, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  plate *= 1.0 - seam * 0.6;
  plate += smoothstep(0.04, 0.0, length(abs(f - 0.5) - 0.4)) * 0.12;
  float n = fbm(g * 0.45 + vec2(0.0, u_time * 0.03));
  float river = smoothstep(0.045, 0.0, abs(n - 0.5));
  float flow = fbm(g * 2.0 + vec2(0.0, -u_time * 0.6));
  vec3 lava = mix(vec3(0.7, 0.12, 0.01), vec3(1.0, 0.5, 0.12), flow) * (0.85 + 0.15 * sin(u_time * 3.0 + g.y));
  vec3 col = mix(plate, lava, river);
  col += vec3(1.0, 0.3, 0.05) * smoothstep(0.18, 0.0, abs(n - 0.5)) * 0.12;
  if (h > 0.9) col += u_neonA * smoothstep(0.25, 0.0, length(f - 0.5)) * (0.6 + 0.4 * sin(u_time * 4.0 + h * 20.0));
  return col;
}

vec3 voidGrid(vec2 g, float aa) {
  vec2 gg = g * 2.0;
  vec2 cell = floor(gg), f = fract(gg);
  float w = 0.02 + aa * 2.0;
  float lx = 1.0 - smoothstep(0.0, w, min(f.x, 1.0 - f.x));
  float ly = 1.0 - smoothstep(0.0, w, min(f.y, 1.0 - f.y));
  vec3 col = vec3(0.004, 0.01, 0.02);
  col += u_neonA * max(lx, ly) * 0.2;
  float ch = hash(vec2(cell.x, 3.0));
  float stream = fract(gg.y * 0.3 + u_time * (0.4 + ch) + ch * 10.0);
  col += mix(u_neonA, u_neonB, step(0.8, ch)) * lx * smoothstep(0.75, 1.0, stream) * 1.6;
  float node = smoothstep(0.1, 0.0, length(min(f, 1.0 - f)));
  float hc = hash(cell);
  col += u_neonB * node * step(0.6, hc) * (0.6 + 0.4 * sin(u_time * 3.0 + hc * 20.0));
  float blk = step(0.94, hash(cell + 7.0)) * step(0.15, f.x) * step(f.x, 0.85) * step(0.15, f.y) * step(f.y, 0.85);
  col += mix(u_neonA, u_neonB, hash(cell + 3.0)) * blk * 0.3 * (0.5 + 0.5 * sin(u_time * 5.0 + cell.y));
  return col;
}

vec3 orbital(vec2 uv) {
  float asp = u_res.x / u_res.y;
  vec3 col = vec3(0.0, 0.004, 0.012);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 p = uv * vec2(asp, 1.0) * (30.0 + fi * 25.0) + vec2(0.0, u_scroll * (2.0 + fi * 3.0));
    vec2 c = floor(p), f = fract(p) - 0.5;
    float h = hash(c + fi * 17.0);
    float s = step(0.9, h) * smoothstep(0.09, 0.0, length(f - (vec2(hash(c + 1.3), hash(c + 2.7)) - 0.5) * 0.6));
    col += vec3(0.8, 0.9, 1.0) * s * (0.3 + 0.7 * fract(h * 13.0)) * (0.7 + 0.3 * sin(u_time * 3.0 + h * 40.0));
  }
  vec2 d = (uv - vec2(0.5, -1.55)) * vec2(asp, 1.0);
  float dist = length(d), pr = 1.85;
  float planet = smoothstep(pr + 0.004, pr - 0.004, dist);
  vec2 sp = d * 3.0 + vec2(u_time * 0.01, u_scroll * 0.2);
  float cl = fbm(sp * 2.0);
  vec3 surf = mix(vec3(0.02, 0.07, 0.18), vec3(0.05, 0.2, 0.32), fbm(sp * 0.8));
  surf += vec3(0.85, 0.9, 0.95) * smoothstep(0.5, 0.78, cl) * 0.5;
  surf += vec3(1.0, 0.7, 0.3) * step(0.94, hash(floor(sp * 40.0))) * 0.5 * (1.0 - smoothstep(0.45, 0.7, cl));
  col = mix(col, surf, planet);
  col += u_base * 1.8 * smoothstep(pr + 0.14, pr, dist) * (1.0 - planet * 0.7);
  // Elevator cable with climbing lights, truss rails and passing ring nodes.
  float cx = abs(uv.x - 0.5);
  col = mix(col, vec3(0.1, 0.12, 0.16), smoothstep(0.013, 0.0, cx));
  float lights = step(0.8, fract(uv.y * 6.0 + u_scroll * 1.2));
  col += u_neonA * smoothstep(0.004, 0.0, abs(cx - 0.008)) * (0.3 + lights * 1.6);
  col += vec3(0.25, 0.3, 0.4) * smoothstep(0.003, 0.0, abs(cx - 0.035)) * 0.5;
  float node = fract(uv.y * 0.8 + u_scroll * 0.25);
  col += u_neonB * smoothstep(0.02, 0.0, abs(node - 0.5)) * smoothstep(0.22, 0.0, cx) * 0.7;
  return col;
}

vec3 storm(vec2 g, vec2 uv) {
  vec2 q = g * 0.35 + vec2(u_time * 0.02, 0.0);
  float n = fbm(q * 1.2);
  float n2 = fbm(q * 2.7 + n * 1.5);
  vec3 col = mix(u_fog * 0.6, u_base * 0.9, smoothstep(0.3, 0.8, n2));
  col += vec3(0.9, 0.9, 1.0) * pow(smoothstep(0.55, 0.9, n2), 3.0) * 0.2;
  col += vec3(0.7, 0.75, 1.0) * u_flash * smoothstep(0.35, 0.9, n2) * 1.6;
  // The Storm Ring: a colossal arc hanging over the cloud deck.
  float asp = u_res.x / u_res.y;
  vec2 rc = (uv - vec2(-0.3, 1.9)) * vec2(asp, 1.0);
  float d = length(rc);
  float ring = smoothstep(0.035, 0.0, abs(d - 1.6));
  float seg = step(0.5, fract(atan(rc.y, rc.x) * 60.0 - u_time * 0.5));
  col = mix(col, vec3(0.07, 0.07, 0.11), ring * 0.9);
  col += u_neonB * smoothstep(0.006, 0.0, abs(d - 1.575)) * (0.4 + 0.6 * seg) * 0.9;
  col += u_neonA * smoothstep(0.006, 0.0, abs(d - 1.625)) * 0.5;
  return col;
}

void main() {
  vec2 uv = v_uv + u_shake;
  float depth;
  vec2 g = ground(uv, depth);
  float aa = fwidth(g.x) * 1.5;
  vec3 col;
  bool plane = true;
  if (u_mode == 1) col = harbor(g, aa);
  else if (u_mode == 2) col = foundry(g, aa);
  else if (u_mode == 3) col = voidGrid(g, aa);
  else if (u_mode == 4) { col = orbital(uv); plane = false; }
  else if (u_mode == 5) col = storm(g, uv);
  else col = city(g, aa);

  // Volumetric light shafts.
  float shaft = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ang = 0.35 + fi * 0.2 + sin(u_time * 0.15 + fi * 2.0) * 0.12;
    float sd = dot(uv - vec2(0.2 + fi * 0.35, 1.1), vec2(cos(ang), sin(ang)));
    shaft += smoothstep(0.08, 0.0, abs(sd)) * (0.5 + 0.5 * sin(u_time * 0.7 + fi * 1.7));
  }
  col += u_neonA * shaft * 0.05 * (0.3 + uv.y);

  if (plane) {
    col = mix(col, u_fog, clamp((depth - 1.0) * 0.55, 0.0, 1.0));
    col += u_neonB * pow(uv.y, 6.0) * 0.25;
  }
  o = vec4(col * u_bright, 1.0);
}`;

export class Background {
  constructor(gl) {
    this.gl = gl;
    this.program = compileProgram(gl, FULLSCREEN_VS, FS, 'background');
    this.scroll = 0;
    this.speed = 0.012; // blocks per step
    this.flash = 0;     // lightning (storm mode)
    this.biome = {
      mode: 0, base: [0.16, 0.18, 0.26], fog: [0.10, 0.04, 0.16],
      neonA: [0.1, 0.9, 1.0], neonB: [1.0, 0.2, 0.7], tilt: 0.55, bright: 0.55, detail: 0.3,
    };
    /** Called when lightning strikes (scene hooks a screen flash / thunder). */
    this.onLightning = null;
  }

  setBiome(bg) { this.biome = bg; this.flash = 0; }

  update() {
    this.scroll += this.speed;
    this.flash *= 0.86;
    // Cosmetic lightning in storm biomes (Math.random: never affects gameplay).
    if (this.biome.mode === 5 && Math.random() < 0.006) {
      this.flash = 1;
      if (this.onLightning) this.onLightning();
    }
  }

  render(width, height, time, alpha, shakeU = 0, shakeV = 0) {
    const gl = this.gl;
    const p = this.program;
    const b = this.biome;
    gl.disable(gl.BLEND);
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res, width, height);
    gl.uniform1f(p.u.u_time, time);
    gl.uniform1f(p.u.u_scroll, this.scroll + this.speed * (alpha - 1)); // interpolated
    gl.uniform2f(p.u.u_shake, shakeU, shakeV);
    gl.uniform3fv(p.u.u_base, b.base);
    gl.uniform3fv(p.u.u_fog, b.fog);
    gl.uniform3fv(p.u.u_neonA, b.neonA);
    gl.uniform3fv(p.u.u_neonB, b.neonB);
    gl.uniform1f(p.u.u_tilt, b.tilt);
    gl.uniform1f(p.u.u_bright, b.bright);
    gl.uniform1f(p.u.u_detail, b.detail ?? 0.3);
    gl.uniform1f(p.u.u_flash, this.flash);
    gl.uniform1i(p.u.u_mode, b.mode | 0);
    drawFullscreen(gl);
  }
}
