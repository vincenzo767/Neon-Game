import { compileProgram, drawFullscreen, FULLSCREEN_VS } from '../core/gl/glUtil.js';

// Procedural neon megacity seen from a tilted overhead camera (2.5D).
// Rendered as one fullscreen fragment shader into the HDR scene target,
// underneath all sprite layers. Every visual parameter is a uniform so the
// stage generator (M3) can drive biomes: Skyway, Spire, Harbor, Foundry...

const FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scroll;      // world scroll distance (city blocks)
uniform vec2 u_shake;        // camera offset in uv
uniform vec3 u_base;         // rooftop base colour
uniform vec3 u_fog;          // distance fog / sky
uniform vec3 u_neonA;
uniform vec3 u_neonB;
uniform float u_tilt;        // perspective strength 0..0.8
uniform float u_bright;      // overall brightness (keep low for bullet readability)
in vec2 v_uv; out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }

// Returns ground-plane coordinates for a screen point under a tilted camera:
// rows near the top of the screen are further away (compressed + fogged).
vec2 ground(vec2 uv, out float depth) {
  float y = uv.y;
  depth = 1.0 / (1.0 - y * u_tilt);
  float x = (uv.x - 0.5) * depth;
  float z = y * depth;                       // distance along the plane grows faster toward the top
  return vec2(x * 5.0, z * 5.0);
}

void main() {
  vec2 uv = v_uv + u_shake;
  float depth;
  vec2 g = ground(uv, depth);
  g.y += u_scroll;

  vec2 cell = floor(g);
  vec2 f = fract(g);
  float h = hash(cell);
  float h2 = hash(cell + 17.7);
  float aa = fwidth(g.x) * 1.5;

  // Roads run along the low edge of each block.
  float roadW = 0.16;
  float roadX = 1.0 - smoothstep(roadW - aa, roadW + aa, f.x);
  float roadY = 1.0 - smoothstep(roadW - aa, roadW + aa, f.y);
  float road = max(roadX, roadY);

  // Rooftops: inset blocks with slight height-based shading.
  vec2 rf = (f - roadW) / (1.0 - roadW);
  float edge = min(min(rf.x, 1.0 - rf.x), min(rf.y, 1.0 - rf.y));
  vec3 col = u_base * (0.35 + h * 0.65);
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.25, edge);           // bevel shading
  float rim = 1.0 - smoothstep(0.0, 0.03 + aa, edge);
  col += mix(u_neonA, u_neonB, step(0.5, h2)) * rim * step(0.55, h) * 0.9; // neon roof trims

  // Rooftop light dots (windows / beacons) in a sub-grid.
  vec2 sub = floor(rf * 6.0);
  float lit = step(0.82, hash(cell * 7.0 + sub));
  vec2 sf = fract(rf * 6.0) - 0.5;
  float dotm = smoothstep(0.25, 0.0, length(sf)) * lit * step(0.05, edge);
  vec3 winCol = mix(vec3(1.0, 0.75, 0.4), u_neonA, step(0.6, hash(cell + sub)));
  col += winCol * dotm * 0.45;

  // Holographic sign blocks: some roofs carry a pulsing emissive panel.
  if (h2 > 0.86) {
    vec2 p = abs(rf - 0.5);
    float panel = step(max(p.x, p.y * 1.8), 0.28);
    float bars = step(0.5, fract(rf.y * 10.0 - u_time * 1.5));
    float flick = 0.7 + 0.3 * step(0.1, hash1(floor(u_time * 12.0) + h * 91.0));
    col = mix(col, mix(u_neonB, u_neonA, bars) * 1.6 * flick, panel * 0.85);
  }

  // Roads: wet asphalt + lane dashes + streaming traffic lights.
  vec3 roadCol = vec3(0.02, 0.025, 0.04);
  float dash = step(0.5, fract(g.y * 3.0)) * (1.0 - smoothstep(0.004, 0.01 + aa, abs(f.x - roadW * 0.5)));
  roadCol += vec3(0.3, 0.3, 0.2) * dash * 0.25;
  // Vertical-road traffic: two directions, headlights white, tails red.
  float laneA = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.x - roadW * 0.28));
  float laneB = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.x - roadW * 0.72));
  float tA = fract(g.y * 2.0 + u_time * 1.6 + hash1(cell.x) * 10.0);
  float tB = fract(g.y * 2.0 - u_time * 1.1 + hash1(cell.x + 3.0) * 10.0);
  roadCol += vec3(1.0, 0.95, 0.85) * laneA * smoothstep(0.9, 1.0, tA) * 1.3 * roadX;
  roadCol += vec3(1.0, 0.1, 0.15) * laneB * smoothstep(0.9, 1.0, tB) * 1.0 * roadX;
  // Horizontal-road traffic.
  float laneC = 1.0 - smoothstep(0.0, 0.025 + aa, abs(f.y - roadW * 0.5));
  float tC = fract(g.x * 1.5 + u_time * 1.3 * (hash1(cell.y) > 0.5 ? 1.0 : -1.0) + hash1(cell.y) * 7.0);
  roadCol += mix(u_neonA, vec3(1.0, 0.9, 0.7), 0.5) * laneC * smoothstep(0.93, 1.0, tC) * 1.0 * roadY * (1.0 - roadX);
  // Wet reflection streaks of neighbouring neon.
  roadCol += mix(u_neonA, u_neonB, h) * 0.08 * (0.5 + 0.5 * sin(g.y * 30.0 + h * 20.0));

  col = mix(col, roadCol, road);

  // Volumetric light shafts sweeping across the city.
  float shaft = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ang = 0.35 + fi * 0.2 + sin(u_time * 0.15 + fi * 2.0) * 0.12;
    float d = dot(uv - vec2(0.2 + fi * 0.35, 1.1), vec2(cos(ang), sin(ang)));
    shaft += smoothstep(0.08, 0.0, abs(d)) * (0.5 + 0.5 * sin(u_time * 0.7 + fi * 1.7));
  }
  col += u_neonA * shaft * 0.05 * (0.3 + uv.y);

  // Distance fog / horizon glow toward the top.
  float fogAmt = clamp((depth - 1.0) * 0.55, 0.0, 1.0);
  col = mix(col, u_fog, fogAmt);
  col += u_neonB * pow(uv.y, 6.0) * 0.25;

  o = vec4(col * u_bright, 1.0);
}`;

// Biome palettes — expanded in M3 with every biome from the design doc.
export const BIOMES = {
  skyway: {
    base: [0.16, 0.18, 0.26], fog: [0.10, 0.04, 0.16],
    neonA: [0.1, 0.9, 1.0], neonB: [1.0, 0.2, 0.7], tilt: 0.55, bright: 0.55,
  },
  foundry: {
    base: [0.22, 0.12, 0.10], fog: [0.25, 0.06, 0.02],
    neonA: [1.0, 0.5, 0.1], neonB: [1.0, 0.15, 0.05], tilt: 0.5, bright: 0.55,
  },
  harbor: {
    base: [0.08, 0.18, 0.16], fog: [0.02, 0.12, 0.08],
    neonA: [0.4, 1.0, 0.3], neonB: [0.1, 0.6, 1.0], tilt: 0.5, bright: 0.5,
  },
};

export class Background {
  constructor(gl) {
    this.gl = gl;
    this.program = compileProgram(gl, FULLSCREEN_VS, FS, 'background');
    this.scroll = 0;
    this.speed = 0.012; // blocks per step
    this.biome = BIOMES.skyway;
  }

  update() { this.scroll += this.speed; }

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
    drawFullscreen(gl);
  }
}
