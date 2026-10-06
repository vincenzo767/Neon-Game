import { compileProgram, drawFullscreen, FULLSCREEN_VS } from '../core/gl/glUtil.js';

// Arena-only background scenes for boss phases that the six stage biome
// modes can't express. Same uniform contract as fx/Background.js (palette,
// tilt, brightness, scroll, flash), so the Arena blends palettes the same way;
// modes start at ARENA_MODE_BASE so they never collide with biome modes.
//
//   10 TUNNEL      collapsed underground tunnel: lamps, rubble, wall strips
//   11 DESERT      scrapyard dunes at sunset
//   12 CLOUDS      cloud sea from above (dawn / aurora / re-entry by palette;
//                  detail > 0.7 = high altitude with stars)
//   13 OCEAN       open-ocean storm swell (detail > 0.8 = maelstrom)
//   14 UNDERWATER  trench floor, caustics, god rays
//   15 ICE         arctic floes on black water
//   16 ROOFTOP     rain-slick rooftop helipads
//   17 CIRCUIT     data-core circuitry with travelling pulses
//   18 HIVE        alien mothership interior: membranes, ribs, veins
//   19 CRYSTAL     crystal planet surface
//   20 NEBULA      deep-space nebula (detail > 0.8 = singularity)
//   21 FLOODED     drowned ruined city under rippling water
//   22 CATHEDRAL   sunken nave: columns, stained-glass light pools
//   23 FLESH       inside the creature: pulsing folds and veins
//   24 CRATER      fallen-star impact field: scorched rock, glowing fissures,
//                  alien crystal clusters (Fallen Star Crater biome, Update 02)
//
// Installed by the Arena as a render delegate on the stage Background
// instance (see Arena.js); the Background module itself is unchanged.

export const ARENA_MODE_BASE = 10;
export const AM = {
  TUNNEL: 10, DESERT: 11, CLOUDS: 12, OCEAN: 13, UNDERWATER: 14, ICE: 15, ROOFTOP: 16,
  CIRCUIT: 17, HIVE: 18, CRYSTAL: 19, NEBULA: 20, FLOODED: 21, CATHEDRAL: 22, FLESH: 23, CRATER: 24,
};

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
// x: nearest distance, y: second nearest, z: cell id
vec3 voronoi(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + vec2(hash(n + g), hash(n + g + 19.7)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash(n + g + 3.1); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
float line(float d, float w, float aa) { return 1.0 - smoothstep(w, w + aa + 0.001, d); }

vec2 ground(vec2 uv, out float depth) {
  depth = 1.0 / (1.0 - uv.y * u_tilt);
  return vec2((uv.x - 0.5) * depth * 5.0, uv.y * depth * 5.0 + u_scroll);
}

vec3 tunnel(vec2 g, float aa) {
  float ax = abs(g.x);
  float wall = smoothstep(1.4, 1.5, ax);
  vec3 floorC = vec3(0.05, 0.045, 0.04) + 0.06 * noise(g * 6.0);
  floorC += vec3(0.9, 0.75, 0.3) * 0.5 * line(abs(ax - 0.62), 0.02, aa) * step(0.5, fract(g.y * 1.5));
  vec3 wallC = u_base * (0.45 + 0.35 * noise(vec2(g.x * 2.0, g.y * 5.0)));
  wallC *= 0.8 + 0.2 * step(0.06, fract(g.y * 1.0));
  vec3 col = mix(floorC, wallC, wall);
  float lamp = pow(max(0.0, cos(g.y * 1.5708)), 30.0);
  col += u_neonA * lamp * 0.45;
  col += u_neonA * line(abs(ax - 1.45), 0.02, aa) * (0.4 + 0.6 * lamp);
  float rock = smoothstep(0.6, 0.68, fbm(g * 1.2 + 3.0)) * (1.0 - wall);
  col = mix(col, vec3(0.13, 0.1, 0.08) * (0.5 + 0.9 * noise(g * 11.0)), rock);
  // Cave-in holes: daylight spilling through the ceiling.
  float hole = smoothstep(0.74, 0.8, fbm(g * 0.7 + 11.0));
  col += u_neonB * hole * 0.35;
  return col;
}

vec3 desert(vec2 g, float aa) {
  float dune = sin(g.x * 1.3 + fbm(g * 0.5) * 4.0 + g.y * 0.4) * 0.5 + 0.5;
  vec3 sand = mix(u_base * 0.65, u_base * 1.35, dune);
  sand *= 0.9 + 0.1 * sin(g.y * 26.0 + g.x * 7.0 + fbm(g) * 6.0);
  vec3 v = voronoi(g * 0.8);
  float isPile = step(0.55, v.z);
  float pile = smoothstep(0.36, 0.22, v.x) * isPile;
  vec2 sc = floor(g * 7.0);
  vec3 scrap = mix(vec3(0.14, 0.12, 0.1), vec3(0.5, 0.26, 0.12), hash(sc)) * (0.45 + 0.55 * step(0.4, hash(sc + 1.7)));
  vec3 col = mix(sand, scrap, pile);
  col += u_neonA * line(abs(v.x - 0.3), 0.02, aa) * isPile * 0.35;
  // Long sunset shadows behind the piles.
  col *= 1.0 - 0.35 * smoothstep(0.5, 0.3, voronoi(g * 0.8 + vec2(0.0, -0.18)).x) * isPile * (1.0 - pile);
  return col;
}

vec3 clouds(vec2 g, vec2 uv) {
  vec2 q = g * 0.45 + vec2(u_time * 0.015, 0.0);
  float n = fbm(q + fbm(q * 1.7) * 0.8);
  float top = smoothstep(0.32, 0.7, n);
  vec3 below = u_fog * 0.6;
  vec3 cl = mix(u_base, vec3(0.95), smoothstep(0.55, 0.95, n));
  float lit = fbm(q * 1.5 + vec2(0.25, 0.1)) - fbm(q * 1.5);
  cl += u_neonA * clamp(lit * 2.5 + 0.2, 0.0, 1.0) * 0.45;
  vec3 col = mix(below, cl, top);
  col += vec3(0.8, 0.85, 1.0) * u_flash * smoothstep(0.4, 0.9, n) * 1.4;
  if (u_detail > 0.7) {
    vec2 sp = uv * vec2(180.0, 240.0);
    float st = step(0.993, hash(floor(sp))) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
    col += vec3(st) * smoothstep(0.55, 1.0, uv.y) * 1.2;
  }
  return col;
}

vec3 ocean(vec2 g, vec2 uv) {
  vec2 p = g;
  float w1 = sin(p.x * 2.1 + p.y * 0.6 + u_time * 1.4 + fbm(p * 0.6) * 3.0);
  float w2 = sin(-p.x * 1.3 + p.y * 1.7 - u_time * 1.1 + fbm(p * 0.9 + 5.0) * 3.0);
  float h = (w1 + w2) * 0.25 + 0.5;
  vec3 col = mix(u_fog * 0.6, u_base, h);
  // Foam gathers on the swell tops (soft, not wire-thin crest lines).
  float foam = smoothstep(0.68, 0.9, h) * smoothstep(0.35, 0.7, fbm(p * 3.5 + vec2(u_time * 0.2, 0.0)));
  col += vec3(0.8, 0.9, 0.95) * foam * 0.5;
  col += u_neonA * pow(h, 8.0) * 0.25;
  if (u_detail > 0.8) {
    float asp = u_res.x / u_res.y;
    vec2 d = (uv - vec2(0.5, 0.62)) * vec2(asp, 1.0);
    float r = length(d), a = atan(d.y, d.x);
    float sw = sin(a * 3.0 + 6.0 / (r + 0.08) - u_time * 2.5) * 0.5 + 0.5;
    float k = smoothstep(0.55, 0.05, r);
    col = mix(col, mix(u_fog * 0.4, vec3(0.85, 0.95, 1.0) * 0.6, pow(sw, 6.0)), k * 0.85);
    col *= 1.0 - smoothstep(0.12, 0.0, r) * 0.9;
  }
  col += vec3(0.8, 0.85, 1.0) * u_flash * 0.5;
  return col;
}

vec3 underwater(vec2 g, vec2 uv) {
  vec3 col = mix(u_fog, u_base, 0.35 + uv.y * 0.4);
  vec2 q = g * 1.6;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    c += abs(sin(q.x * 1.7 + sin(q.y * 1.3 + u_time * 0.9 + fi) * 1.5 + fi * 2.1 + u_time * 0.6));
    q = q.yx * 1.3 + fi;
  }
  c = pow(1.0 - c / 3.0, 4.0);
  col += u_neonA * c * 0.6;
  float rock = smoothstep(0.52, 0.72, fbm(g * 0.8));
  col = mix(col, u_base * 0.35, rock * 0.75);
  col *= 0.55 + 0.45 * smoothstep(0.2, 1.6, abs(g.x));
  float ray = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    ray += smoothstep(0.045, 0.0, abs(uv.x - 0.14 - fi * 0.24 - sin(u_time * 0.3 + fi) * 0.04 - (1.0 - uv.y) * (fi - 1.5) * 0.08));
  }
  col += u_neonB * ray * 0.16 * uv.y;
  return col;
}

vec3 ice(vec2 g, float aa) {
  vec3 v = voronoi(g * 1.2);
  float e = v.y - v.x;
  float floe = smoothstep(0.05, 0.1 + aa, e) * step(0.22, v.z);
  vec3 water = u_fog * 0.35 + u_neonB * 0.06 * fbm(g * 2.0 + u_time * 0.1);
  vec3 icec = mix(u_base, vec3(0.95, 0.98, 1.0), 0.4 + 0.5 * fbm(g * 4.0)) * (0.8 + 0.25 * v.z);
  icec *= 0.82 + 0.18 * smoothstep(0.0, 0.35, e);
  icec += u_neonA * line(abs(e - 0.12), 0.006, aa) * 0.4;
  float crack = line(abs(fbm(g * 2.6 + v.z * 5.0) - 0.5), 0.012, aa);
  icec *= 1.0 - crack * 0.5;
  return mix(water, icec, floe);
}

vec3 rooftop(vec2 g, float aa) {
  vec2 cell = floor(g * 0.5), f = fract(g * 0.5);
  vec3 col = u_base * (0.5 + 0.25 * noise(g * 8.0));
  vec2 t = fract(g * 4.0);
  col *= 0.85 + 0.15 * step(0.06, min(t.x, t.y));
  if (hash(cell) > 0.45) {
    vec2 d = f - 0.5;
    float r = length(d);
    col = mix(col, vec3(0.12, 0.13, 0.15), step(r, 0.38));
    col += u_neonA * line(abs(r - 0.36), 0.012, aa) * 0.9;
    float bar = step(0.07, abs(d.x)) * step(abs(d.x), 0.13) * step(abs(d.y), 0.16);
    float mid = step(abs(d.x), 0.13) * step(abs(d.y), 0.025);
    col = mix(col, vec3(0.9, 0.88, 0.8), clamp(bar + mid, 0.0, 1.0));
  } else {
    vec2 sub = fract(g * 1.5);
    float box = step(0.2, sub.x) * step(sub.x, 0.8) * step(0.2, sub.y) * step(sub.y, 0.8) * step(0.55, hash(floor(g * 1.5)));
    col = mix(col, vec3(0.2, 0.21, 0.24) * (0.8 + 0.2 * step(0.5, fract(sub.x * 8.0))), box);
  }
  float pud = smoothstep(0.6, 0.66, fbm(g * 1.1 + 7.0));
  col = mix(col, u_neonB * 0.22 + vec3(0.02, 0.02, 0.03) + u_neonA * 0.1 * sin(g.y * 20.0 + u_time * 3.0), pud * 0.8);
  col += u_neonB * line(min(f.x, 1.0 - f.x), 0.012, aa) * 0.6 * step(0.5, fract(g.y * 2.0 - u_time));
  return col;
}

vec3 circuit(vec2 g, float aa) {
  vec2 p = g * 3.0;
  vec2 c = floor(p), f = fract(p);
  vec3 col = u_base * 0.25 + vec3(0.0, 0.015, 0.01);
  float h = hash(c);
  bool horiz = h > 0.5;
  float tr = line(abs((horiz ? f.y : f.x) - 0.5), 0.04, aa * 3.0) * step(0.2, hash(c + 5.0));
  float pulse = fract((horiz ? p.x : p.y) * 0.25 - u_time * 0.8 + h * 7.0);
  col += u_neonA * tr * (0.22 + smoothstep(0.85, 1.0, pulse) * 1.6);
  col += u_neonB * line(length(f - 0.5), 0.09, aa * 3.0) * step(0.75, h) * 0.9;
  vec2 cf = fract(g * 0.7);
  float chip = step(0.8, hash(floor(g * 0.7))) * step(0.15, cf.x) * step(cf.x, 0.85) * step(0.2, cf.y) * step(cf.y, 0.8);
  col = mix(col, vec3(0.03, 0.03, 0.04) + u_neonA * 0.06 * step(0.5, fract(cf.x * 20.0)), chip);
  return col;
}

vec3 hiveM(vec2 g, float aa) {
  vec3 v = voronoi(g * 1.4);
  float e = v.y - v.x;
  vec3 mem = mix(u_base * 0.6, u_base * 1.25, fbm(g * 3.0 + u_time * 0.1));
  float pulse = 0.5 + 0.5 * sin(u_time * 2.0 + v.z * 12.0);
  mem += u_neonA * smoothstep(0.35, 0.0, v.x) * 0.3 * pulse;
  vec3 col = mix(vec3(0.07, 0.035, 0.09), mem, smoothstep(0.03, 0.09 + aa, e));
  col += u_neonB * line(e, 0.03, aa) * 0.35;
  float vein = line(abs(fbm(g * 1.2) - 0.5), 0.02, aa);
  col += u_neonA * vein * 0.4 * (0.6 + 0.4 * sin(u_time * 3.0 - g.y * 2.0));
  return col;
}

vec3 crystal(vec2 g, float aa) {
  vec3 v = voronoi(g * 1.1);
  vec3 col = mix(u_base * 0.45, u_base * 1.4, v.z);
  col *= 0.55 + 0.6 * smoothstep(0.0, 0.7, v.x);
  float e = v.y - v.x;
  col += u_neonA * line(e, 0.03, aa) * (0.55 + 0.45 * sin(u_time * 2.0 + v.z * 20.0));
  col += u_neonB * pow(max(0.0, 1.0 - v.x * 1.6), 5.0) * 0.5 * step(0.7, v.z);
  return col;
}

vec3 nebula(vec2 uv) {
  float asp = u_res.x / u_res.y;
  vec2 p = uv * vec2(asp, 1.0) * 2.0 + vec2(0.0, u_scroll * 0.15);
  float n = fbm(p + fbm(p * 1.5 + u_time * 0.02) * 1.5);
  float n2 = fbm(p * 2.3 - 3.0);
  vec3 col = u_fog * 0.4 + u_base * n * 0.3;
  col += u_neonA * smoothstep(0.35, 0.9, n) * 0.7;
  col += u_neonB * smoothstep(0.45, 0.95, n2) * 0.5;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 sp = uv * vec2(asp, 1.0) * (40.0 + fi * 40.0) + vec2(0.0, u_scroll * (1.0 + fi));
    float h = hash(floor(sp) + fi * 7.0);
    col += vec3(0.9) * step(0.985, h) * smoothstep(0.12, 0.0, length(fract(sp) - 0.5)) * (0.6 + 0.4 * sin(u_time * 3.0 + h * 50.0));
  }
  if (u_detail > 0.8) {
    vec2 d = (uv - vec2(0.5, 0.7)) * vec2(asp, 1.0);
    float r = length(d), a = atan(d.y, d.x);
    float disk = smoothstep(0.03, 0.0, abs(r - 0.17 - 0.012 * sin(a * 6.0 + u_time * 3.0))) + smoothstep(0.1, 0.0, abs(r - 0.22)) * 0.4;
    col *= smoothstep(0.1, 0.3, r) * 0.7 + 0.3;
    col = mix(col, vec3(0.0), smoothstep(0.14, 0.12, r));
    col += mix(u_neonA, vec3(1.0, 0.85, 0.6), 0.5) * disk * (0.7 + 0.3 * sin(a * 3.0 - u_time * 4.0));
  }
  return col;
}

vec3 flooded(vec2 g, float aa) {
  vec2 w = g + 0.06 * vec2(sin(g.y * 6.0 + u_time * 1.5), cos(g.x * 5.0 + u_time * 1.2));
  vec2 cell = floor(w), f = fract(w);
  float h = hash(cell);
  float road = max(line(f.x, 0.16, aa), line(f.y, 0.16, aa));
  vec2 rf = (f - 0.16) / 0.84;
  float edge = min(min(rf.x, 1.0 - rf.x), min(rf.y, 1.0 - rf.y));
  vec3 bld = u_base * (0.3 + 0.5 * h);
  bld *= 1.0 - 0.6 * step(0.6, noise(w * 5.0)) * step(0.4, h);
  bld += u_neonB * line(edge, 0.03, aa) * step(0.7, h) * 0.5 * step(0.3, fract(sin(u_time * 9.0 + h * 30.0)));
  vec3 col = mix(bld, u_fog * 0.5, road);
  col = mix(col, u_neonA * 0.12 + col * 0.5, 0.45);
  float c = pow(1.0 - abs(sin(g.x * 4.0 + sin(g.y * 3.0 + u_time) * 2.0) * sin(g.y * 4.0 + sin(g.x * 3.0 - u_time) * 2.0)), 8.0);
  col += u_neonA * c * 0.12;
  return col;
}

vec3 cathedral(vec2 g, float aa) {
  float x = g.x;
  vec2 tc = floor(g * 2.0), t = fract(g * 2.0);
  vec3 floorC = mix(u_base * 0.55, u_base * 0.85, mod(tc.x + tc.y, 2.0));
  floorC *= 0.85 + 0.15 * step(0.04, min(t.x, t.y));
  floorC = mix(floorC, vec3(0.16, 0.03, 0.05), step(abs(x), 0.35));
  vec2 lp = vec2(abs(x) - 0.65, mod(g.y + 0.6, 2.4) - 1.2);
  float pool = smoothstep(0.55, 0.1, length(lp * vec2(1.0, 0.6)));
  float hue = hash(vec2(floor((g.y + 0.6) / 2.4), step(0.0, x)));
  vec3 glass = hue < 0.33 ? u_neonA : (hue < 0.66 ? u_neonB : vec3(1.0, 0.8, 0.3));
  vec3 c = floorC + glass * pool * 0.4 * (0.75 + 0.25 * sin(u_time * 0.8 + hue * 9.0));
  vec2 cp = vec2(abs(x) - 1.25, mod(g.y, 1.2) - 0.6);
  float r = length(cp);
  vec3 colC = u_base * 1.1 * (0.5 + 0.5 * smoothstep(0.24, 0.0, length(cp - vec2(-0.07, -0.07))));
  c = mix(c, colC, smoothstep(0.24 + aa, 0.2, r));
  c = mix(c, u_base * 0.3, smoothstep(1.7, 1.8, abs(x)));
  c *= 0.7 + 0.3 * fbm(g * 2.0);
  return c;
}

vec3 flesh(vec2 g, float aa) {
  float beat = pow(0.5 + 0.5 * sin(u_time * 3.2), 6.0);
  vec2 q = g * 0.9 + vec2(0.0, beat * 0.05);
  float n = fbm(q + fbm(q * 1.8 + u_time * 0.05) * 1.6);
  vec3 col = mix(u_fog * 0.8, u_base, smoothstep(0.3, 0.8, n));
  col *= 0.7 + 0.3 * smoothstep(0.2, 0.0, abs(fract(n * 4.0) - 0.5));
  float vein = line(abs(fbm(g * 1.5 + 9.0) - 0.5), 0.02, aa);
  col += u_neonA * vein * (0.35 + 0.6 * beat);
  col += vec3(1.0, 0.8, 0.8) * pow(smoothstep(0.6, 0.9, n), 3.0) * 0.25;
  col += u_neonB * beat * 0.08;
  return col;
}

vec3 crater(vec2 g, float aa) {
  float n = fbm(g * 0.7);
  vec3 col = mix(u_base * 0.35, u_base * 1.1, n);
  // Impact bowls: ridged rings around a dark centre, one per 6-block cell.
  vec2 cc = floor(g / 6.0);
  vec2 cp = (cc + 0.5 + (vec2(hash(cc), hash(cc + 3.1)) - 0.5) * 0.8) * 6.0;
  float d = length(g - cp) * (0.7 + hash(cc + 9.0) * 0.6);
  col *= 0.82 + 0.18 * sin(d * 5.0 - n * 3.0) * smoothstep(3.2, 0.6, d);
  col *= 0.45 + 0.55 * smoothstep(0.3, 1.5, d);
  // Fissures glowing with fallen-star energy.
  vec3 v = voronoi(g * 0.9 + n);
  float e = v.y - v.x;
  float pulse = 0.6 + 0.4 * sin(u_time * 1.7 + v.z * 30.0);
  col = mix(col, u_neonA * 1.15, line(e, 0.022, aa) * 0.85 * pulse);
  col += u_neonA * pow(max(0.0, 1.0 - e * 9.0), 3.0) * 0.16 * pulse;
  // Crystal clusters growing out of the rock.
  vec3 c = voronoi(g * 2.6 + 5.0);
  float shard = smoothstep(0.3, 0.1, c.x) * step(0.84, c.z);
  vec3 cry = mix(u_neonB * 0.5, u_neonB * 1.5 + 0.15, smoothstep(0.22, 0.0, c.x));
  col = mix(col, cry, shard);
  return col;
}

void main() {
  vec2 uv = v_uv + u_shake;
  float depth;
  vec2 g = ground(uv, depth);
  float aa = fwidth(g.x) * 1.5;
  vec3 col;
  bool plane = true;
  if (u_mode == 10) col = tunnel(g, aa);
  else if (u_mode == 11) { col = desert(g, aa); col += u_neonA * pow(uv.y, 4.0) * 0.6; }
  else if (u_mode == 12) col = clouds(g, uv);
  else if (u_mode == 13) col = ocean(g, uv);
  else if (u_mode == 14) col = underwater(g, uv);
  else if (u_mode == 15) col = ice(g, aa);
  else if (u_mode == 16) col = rooftop(g, aa);
  else if (u_mode == 17) col = circuit(g, aa);
  else if (u_mode == 18) col = hiveM(g, aa);
  else if (u_mode == 19) col = crystal(g, aa);
  else if (u_mode == 20) { col = nebula(uv); plane = false; }
  else if (u_mode == 21) col = flooded(g, aa);
  else if (u_mode == 22) col = cathedral(g, aa);
  else if (u_mode == 24) col = crater(g, aa);
  else col = flesh(g, aa);
  if (plane) {
    col = mix(col, u_fog, clamp((depth - 1.0) * 0.55, 0.0, 1.0));
    col += u_neonB * pow(uv.y, 6.0) * 0.2;
  }
  o = vec4(col * u_bright, 1.0);
}`;

export class ArenaBackground {
  constructor(gl) {
    this.gl = gl;
    this.program = compileProgram(gl, FULLSCREEN_VS, FS, 'arena-background');
  }

  /** Same signature as Background.render, reading state from that Background. */
  render(src, width, height, time, alpha, shakeU = 0, shakeV = 0) {
    const gl = this.gl, p = this.program, b = src.biome;
    gl.disable(gl.BLEND);
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res, width, height);
    gl.uniform1f(p.u.u_time, time);
    gl.uniform1f(p.u.u_scroll, src.scroll + src.speed * (alpha - 1));
    gl.uniform2f(p.u.u_shake, shakeU, shakeV);
    gl.uniform3fv(p.u.u_base, b.base);
    gl.uniform3fv(p.u.u_fog, b.fog);
    gl.uniform3fv(p.u.u_neonA, b.neonA);
    gl.uniform3fv(p.u.u_neonB, b.neonB);
    gl.uniform1f(p.u.u_tilt, b.tilt);
    gl.uniform1f(p.u.u_bright, b.bright);
    gl.uniform1f(p.u.u_detail, b.detail ?? 0.3);
    gl.uniform1f(p.u.u_flash, src.flash);
    gl.uniform1i(p.u.u_mode, b.mode | 0);
    drawFullscreen(gl);
  }
}

/**
 * Route a stage Background's render() to the arena shader whenever its
 * biome uses an arena mode. Idempotent per Background instance.
 */
export function installArenaBackground(bg, gl) {
  if (bg.arenaBg) return bg.arenaBg;
  const arena = new ArenaBackground(gl);
  const stageRender = bg.render.bind(bg);
  bg.render = (...args) => ((bg.biome.mode | 0) >= ARENA_MODE_BASE ? arena.render(bg, ...args) : stageRender(...args));
  bg.arenaBg = arena;
  return arena;
}
