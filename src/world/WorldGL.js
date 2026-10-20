import { compileProgram, drawFullscreen, FULLSCREEN_VS } from '../core/gl/glUtil.js';
import { FLOATS } from './MeshBuilder.js';
import { TILE } from './paint/tile.js';
import { fbmTile } from './paint/noise.js';

// WebGL2 programs + resource helpers for the arena world pass. One instance
// per GL context (shared by every ArenaWorld). Draws into the HDR scene
// target before the sprite batch, with a depth buffer (PostFX attaches one).
//
//   lit     terrain planes (chunk textures) and solids (material array):
//           baked vertex light × albedo, detail texture, emissive, caustics,
//           distance fog, premultiplied alpha
//   water   animated ocean / lake surface (waves, fresnel, sun glint, foam)
//   lava    flowing molten surface (crust, glow)
//   sky     fullscreen backdrop (gradient sky, space, deep water)

const STRIDE = FLOATS * 4;

const LIT_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_uvl;
layout(location=2) in vec4 a_col;
layout(location=3) in float a_em;
uniform mat4 u_vp;
uniform vec3 u_eye;
uniform vec3 u_fwd;
uniform vec3 u_offset;
out vec3 v_uvl; out vec4 v_col; out float v_em; out vec3 v_world; out float v_depth;
void main() {
  vec3 p = a_pos + u_offset;
  gl_Position = u_vp * vec4(p, 1.0);
  v_uvl = a_uvl; v_col = a_col; v_em = a_em; v_world = p;
  v_depth = dot(p - u_eye, u_fwd);
}`;

const LIT_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_mats;
uniform sampler2D u_plane;
uniform sampler2D u_glow;
uniform sampler2D u_detail;
uniform float u_usePlane;
uniform float u_useGlow;
uniform vec2 u_detail2;      // amount, world scale
uniform vec3 u_fogCol;
uniform vec3 u_fog;          // start, end, max
uniform vec3 u_hfog;         // height fog below a top height: density (1/units), top z, max
uniform float u_cut;
uniform float u_exposure;
uniform float u_time;
uniform vec3 u_caustics;     // strength, scale, speed
uniform float u_alphaMul;
uniform vec3 u_glowTint;
in vec3 v_uvl; in vec4 v_col; in float v_em; in vec3 v_world; in float v_depth;
out vec4 o;

float caustic(vec2 p) {
  float c = 0.0;
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    c += abs(sin(q.x * 1.7 + sin(q.y * 1.3 + u_time * u_caustics.z + fi) * 1.5 + fi * 2.1 + u_time * u_caustics.z * 0.7));
    q = q.yx * 1.31 + fi * 1.7;
  }
  return pow(1.0 - c / 3.0, 5.0);
}

void main() {
  vec4 c = u_usePlane > 0.5 ? texture(u_plane, v_uvl.xy) : texture(u_mats, v_uvl);
  if (c.a < u_cut) discard;
  vec3 lit = c.rgb * v_col.rgb;
  if (u_detail2.x > 0.0) {
    float d = texture(u_detail, v_world.xy * u_detail2.y).r;
    lit *= mix(1.0, 0.55 + d * 0.9, u_detail2.x);
  }
  lit += c.rgb * v_em;
  if (u_useGlow > 0.5) lit += texture(u_glow, v_uvl.xy).rgb * u_glowTint;
  if (u_caustics.x > 0.0) lit += c.rgb * caustic(v_world.xy * u_caustics.y) * u_caustics.x;
  lit *= u_exposure;
  float f = clamp((v_depth - u_fog.x) / max(1.0, u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z;
  if (u_hfog.x > 0.0) f = max(f, (1.0 - exp(-max(0.0, u_hfog.y - v_world.z) * u_hfog.x)) * u_hfog.z);
  float a = c.a * v_col.a * u_alphaMul;
  o = vec4(mix(lit, u_fogCol * c.a, f) * v_col.a * u_alphaMul, a);
}`;

const SURF_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_vp;
uniform vec3 u_eye;
uniform vec3 u_fwd;
out vec3 v_world; out float v_depth;
void main() {
  gl_Position = u_vp * vec4(a_pos, 1.0);
  v_world = a_pos;
  v_depth = dot(a_pos - u_eye, u_fwd);
}`;

// Noise for the surface shaders, backed by a tileable noise texture (unit 4):
// one or two fetches instead of five hashed octaves per call — the procedural
// version cost a third of the frame on low-end GPUs.
const NOISE = `
uniform sampler2D u_noise;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { return texture(u_noise, p * 0.0625).b; }
float fbm(vec2 p) { return texture(u_noise, p * 0.25).r * 0.72 + texture(u_noise, p * 1.13 + 0.37).g * 0.28; }
`;

const WATER_FS = `#version 300 es
precision highp float;
uniform vec3 u_eye;
uniform float u_time;
uniform vec3 u_deep;
uniform vec3 u_shallow;
uniform vec3 u_sky;
uniform vec3 u_sunDir;
uniform vec3 u_sunCol;
uniform vec4 u_wave;        // amplitude (steepness), scale (1 = ~140-unit swell), speed, choppiness
uniform vec4 u_foam;        // whitecaps, crest threshold, wind streaks, -
uniform vec4 u_swirl;       // centre x, centre y (world), radius, strength (maelstrom)
uniform vec3 u_fogCol;
uniform vec3 u_fog;
uniform float u_exposure;
uniform vec2 u_wind;
in vec3 v_world; in float v_depth;
out vec4 o;
${NOISE}
// Sum of directional swell trains (Gerstner-style slopes) + chop.
// Returns height in .x and the slope (dh/dx, dh/dy) in .yz.
vec3 waves(vec2 p, float t) {
  vec3 acc = vec3(0.0);
  vec2 wd = normalize(u_wind + vec2(0.001));
  float amp = 1.0, freq = 0.042 * u_wave.y;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float a = (fi * 1.7 + 0.3) * (fi < 3.0 ? 0.35 : 0.9);
    vec2 d = normalize(vec2(wd.x * cos(a) - wd.y * sin(a), wd.x * sin(a) + wd.y * cos(a)));
    float ph = dot(d, p) * freq + t * sqrt(9.8 * freq * 40.0) * 0.12 * u_wave.z + fi * 1.31;
    float s = sin(ph), c = cos(ph);
    // Sharpened crests: lift the peaks, flatten the troughs.
    float hgt = (pow(s * 0.5 + 0.5, 1.6) - 0.5) * amp;
    acc.x += hgt;
    acc.yz += d * c * amp * freq * 1.6 * pow(s * 0.5 + 0.5, 0.6);
    amp *= 0.62; freq *= 1.47;
  }
  // Wind chop.
  vec2 q = p * 0.11 + wd * t * 0.25;
  float n = fbm(q), nx = fbm(q + vec2(0.35, 0.0)), ny = fbm(q + vec2(0.0, 0.35));
  acc.x += (n - 0.5) * u_wave.w * 0.6;
  acc.yz += vec2(nx - n, ny - n) / 0.35 * 0.11 * u_wave.w * 0.6;
  return acc;
}
void main() {
  vec2 p = v_world.xy;
  float swirlK = 0.0;
  if (u_swirl.w > 0.0) {
    vec2 d = p - u_swirl.xy;
    float r = length(d);
    swirlK = smoothstep(u_swirl.z, 0.0, r);
    float ang = u_swirl.w * swirlK * swirlK * 2.6 + u_time * 0.5 * swirlK * swirlK;
    float cs = cos(ang), sn = sin(ang);
    p = u_swirl.xy + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  }
  float t = u_time;
  vec3 w = waves(p, t);
  vec3 n = normalize(vec3(-w.yz * u_wave.x * 1.4, 1.0));
  vec3 v = normalize(u_eye - v_world);
  float ndv = max(0.0, dot(n, v));
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  // Water body: deeper in the troughs, a little lighter (subsurface) on the crests.
  vec3 body = mix(u_deep, u_shallow, clamp(w.x * 0.45 + 0.45, 0.0, 1.0));
  body += u_shallow * 0.35 * pow(max(0.0, dot(n, normalize(u_sunDir + vec3(0.0, 0.0, 0.4)))), 6.0);
  vec3 col = mix(body, u_sky, clamp(fres * 1.8, 0.0, 0.85));
  vec3 r = reflect(-v, n);
  vec3 sd = normalize(u_sunDir);
  col += u_sunCol * pow(max(0.0, dot(r, sd)), 220.0) * 3.0;          // glitter
  col += u_sunCol * pow(max(0.0, dot(r, sd)), 18.0) * 0.06;          // sheen
  // Whitecaps where the surface is steep and high; streaks along the wind.
  float steep = length(w.yz) * u_wave.x;
  float cap = smoothstep(u_foam.y, u_foam.y + 0.25, w.x * 0.6 + steep * 0.9 + (fbm(p * 0.07 + t * 0.15) - 0.5) * 0.6);
  cap *= smoothstep(0.45, 0.75, fbm(p * 0.22 + vec2(t * 0.4, 0.0)));
  vec2 wd = normalize(u_wind + vec2(0.001));
  vec2 ws = vec2(dot(p, vec2(wd.y, -wd.x)), dot(p, wd));
  float streak = smoothstep(0.6, 0.78, fbm(vec2(ws.x * 0.06, ws.y * 0.008) + vec2(0.0, -t * 0.05))) * u_foam.z;
  streak *= 0.5 + 0.5 * fbm(p * 0.05);
  float foam = clamp(cap * u_foam.x * 1.4 + streak * 0.45, 0.0, 1.0);
  foam = max(foam, swirlK * smoothstep(0.5, 0.8, fbm(p * 0.04 + vec2(t * 0.3))) * 0.85);
  col = mix(col, vec3(0.88, 0.92, 0.94) * (0.7 + 0.3 * ndv), foam);
  if (u_swirl.w > 0.0) col *= 1.0 - smoothstep(u_swirl.z * 0.22, 0.0, length(v_world.xy - u_swirl.xy)) * 0.95;
  col *= u_exposure;
  float f = clamp((v_depth - u_fog.x) / max(1.0, u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z;
  o = vec4(mix(col, u_fogCol, f), 1.0);
}`;

const LAVA_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec3 u_hot;
uniform vec3 u_crust;
uniform vec4 u_flow;   // dir x, dir y, speed, crust amount
uniform vec3 u_fogCol;
uniform vec3 u_fog;
uniform float u_exposure;
in vec3 v_world; in float v_depth;
out vec4 o;
${NOISE}
void main() {
  vec2 p = v_world.xy * 0.03;
  vec2 fl = u_flow.xy * u_time * u_flow.z * 0.03;
  float n = fbm(p + fl + fbm(p * 1.7 - fl * 0.5) * 0.9);
  float n2 = fbm(p * 2.6 + fl * 1.6);
  // Molten metal: orange-red body with brighter yellow currents; dark cooling
  // crust plates drift on top, cracked with glowing seams.
  float crust = smoothstep(0.5 - u_flow.w * 0.18, 0.62 - u_flow.w * 0.1, n);
  float cracks = smoothstep(0.06, 0.0, abs(n2 - 0.5)) * crust;
  float current = smoothstep(0.35, 0.85, n2);
  vec3 molten = mix(u_hot * 0.75, mix(u_hot, vec3(1.0, 0.85, 0.45), 0.55) * 1.35, current) * (0.9 + 0.1 * sin(u_time * 2.0 + n * 10.0));
  vec3 plate = u_crust * (0.5 + 0.7 * fbm(p * 6.0 + fl * 0.5));
  vec3 col = mix(molten, plate, crust) + u_hot * cracks * 1.4;
  col *= u_exposure;
  float f = clamp((v_depth - u_fog.x) / max(1.0, u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z * 0.5;
  o = vec4(mix(col, u_fogCol, f), 1.0);
}`;

const CLOUD_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec4 u_cloud;       // coverage 0..1, feature scale, softness, thickness (self-shadow reach)
uniform vec3 u_lit;         // sunlit tops
uniform vec3 u_shade;       // shaded flanks
uniform vec3 u_base;        // shadowed hollows / undersides
uniform vec2 u_drift;       // drift (world units / s)
uniform float u_seed;
uniform vec3 u_sunDir;
uniform vec3 u_fogCol;
uniform vec3 u_fog;
uniform float u_exposure;
uniform float u_alpha;
uniform vec4 u_flash;       // world x, y, radius, strength (lightning inside the deck)
in vec3 v_world; in float v_depth;
out vec4 o;
${NOISE}
float fbm4(vec2 p) { return texture(u_noise, p * 0.25).g * 0.8 + texture(u_noise, p * 0.5 + 0.21).r * 0.2; }
// Raw cloud field (unsaturated): read as the height of the cloud tops.
float field(vec2 q, vec2 w) {
  float big = fbm4(q * 0.35 + w * 0.55);
  float detail = fbm4(q * 1.6 + w * 1.1 + u_time * 0.02);
  return big * 0.78 + detail * 0.34 - 0.06;
}
void main() {
  vec2 p = v_world.xy - u_drift * u_time;
  float k = 0.0052 / u_cloud.y;
  vec2 q = p * k + u_seed;
  vec2 w = vec2(fbm4(q * 0.5 + u_time * 0.01), fbm4(q * 0.5 + 7.3 - u_time * 0.008));
  float F = field(q, w);
  float th = 0.66 - u_cloud.x * 0.32;
  float a = smoothstep(th - u_cloud.z * 0.5, th + u_cloud.z, F);
  if (a < 0.004) discard;
  // Lumpy tops: shade the field as a height map (normal from its gradient).
  float e = 14.0 * k;
  float Fx = field(q + vec2(e, 0.0), w), Fy = field(q + vec2(0.0, e), w);
  vec3 sd = normalize(u_sunDir);
  vec3 n = normalize(vec3(-(Fx - F) / e * k * u_cloud.w * 11.0, -(Fy - F) / e * k * u_cloud.w * 11.0, 1.0));
  float lam = clamp(dot(n, sd) * 0.9 + 0.15, 0.0, 1.0);
  // Cast shadows: towers between this point and the sun.
  vec2 so = normalize(sd.xy + vec2(1e-4)) * u_cloud.w * k * 1.8;
  float Fs = field(q + so, w);
  float shadow = smoothstep(0.0, 0.2, Fs - F - 0.03);
  vec3 col = mix(u_shade, u_lit, lam * (1.0 - shadow * 0.75));
  // Thin edges and low hollows read darker and bluer.
  col = mix(u_base, col, smoothstep(th - 0.02, th + 0.28, F));
  col += u_lit * (1.0 - a) * lam * 0.3;                       // silver lining on the sunny rim
  if (u_flash.w > 0.0) col += vec3(0.75, 0.8, 1.0) * u_flash.w * smoothstep(u_flash.z, 0.0, length(v_world.xy - u_flash.xy)) * (0.4 + a);
  col *= u_exposure;
  float f = clamp((v_depth - u_fog.x) / max(1.0, u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z;
  col = mix(col, u_fogCol, f);
  float al = a * u_alpha;
  o = vec4(col * al, al);
}`;

const PLANET_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec3 u_ocean;
uniform vec3 u_land;
uniform vec3 u_land2;
uniform vec3 u_ice;
uniform vec3 u_cloudCol;
uniform vec4 u_planet;      // land amount, cloud amount, feature scale, night (terminator x position, world)
uniform vec3 u_atmo;        // atmosphere / haze colour
uniform float u_gas;        // 1 = gas giant: turbulent latitude bands instead of land/sea
uniform vec3 u_sunDir;
uniform vec3 u_lights;      // city light colour (night side)
uniform float u_exposure;
in vec3 v_world; in float v_depth;
out vec4 o;
${NOISE}
void main() {
  vec2 p = v_world.xy * (0.00022 / u_planet.z);
  float c1 = texture(u_noise, p * 0.25).r, c2 = texture(u_noise, p * 1.1 + 0.3).g, c3 = texture(u_noise, p * 4.0 + 0.7).b;
  float h = c1 * 0.65 + c2 * 0.25 + c3 * 0.1;
  float land = smoothstep(0.6 - u_planet.x * 0.25, 0.66 - u_planet.x * 0.25, h);
  float lat = abs(fract(v_world.y * 0.00002) - 0.5);
  vec3 ground = mix(u_land, u_land2, smoothstep(0.4, 0.7, texture(u_noise, p * 2.0 + 1.3).r));
  ground = mix(ground, u_ice, smoothstep(0.75, 0.9, h));
  vec3 sea = u_ocean * (0.75 + 0.5 * (h - 0.3));
  vec3 col = mix(sea, ground, land);
  // Sun glint on the ocean.
  col += vec3(1.0, 0.95, 0.85) * (1.0 - land) * 0.08 * (1.0 - u_gas);
  if (u_gas > 0.5) {
    // Gas giant: broad zonal belts bent by large eddies, lighter swirls and
    // storm ovals; deliberately smooth (no fine streaks).
    vec2 q = p * 0.5 + vec2(u_time * 0.0005, 0.0);
    float w1 = texture(u_noise, q * vec2(0.35, 1.2)).g - 0.5;
    float w2 = texture(u_noise, q * vec2(1.1, 3.0) + 0.37).r - 0.5;
    float b = v_world.y * (0.00035 / u_planet.z) + w1 * 0.5 + w2 * 0.12;
    float s1 = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(b * 6.2831 * 2.0)), s2 = 0.5 + 0.5 * sin(b * 6.2831 * 4.7 + 1.3);
    vec3 band = mix(mix(u_ocean, u_land, s1), mix(u_land2, u_ice, s2), 0.35);
    float ed = texture(u_noise, q * 1.6 + w1).r;
    band = mix(band, u_ice, smoothstep(0.66, 0.86, ed) * 0.3);
    float oval = smoothstep(0.82, 0.92, texture(u_noise, p * vec2(0.6, 1.2) + 0.21).r);
    band = mix(band, u_cloudCol, oval * 0.8);
    col = band * (0.68 + 0.16 * c3);
  }
  // Clouds (with their shadows on the surface).
  vec2 cp = p * 1.6 + vec2(u_time * 0.0015, 0.0);
  vec2 cw = vec2(texture(u_noise, cp * 0.3).g, texture(u_noise, cp * 0.3 + 0.5).g) - 0.5;
  vec2 cq = cp + cw * 0.9;
  float cf = texture(u_noise, cq * 0.5).r * 0.5 + texture(u_noise, cq * 1.7 + 0.5).r * 0.3 + texture(u_noise, vec2(cq.x * 4.0, cq.y * 9.0) + 0.2).b * 0.2;
  float cl = smoothstep(0.58 - u_planet.y * 0.2, 0.7 - u_planet.y * 0.2, cf);
  vec2 sq = cq + vec2(0.012, -0.01);
  float sf = texture(u_noise, sq * 0.5).r * 0.5 + texture(u_noise, sq * 1.7 + 0.5).r * 0.3 + texture(u_noise, vec2(sq.x * 4.0, sq.y * 9.0) + 0.2).b * 0.2;
  float shadowC = smoothstep(0.58 - u_planet.y * 0.2, 0.7 - u_planet.y * 0.2, sf);
  col *= 1.0 - shadowC * 0.35;
  cl *= 1.0 - u_gas;
  col = mix(col, u_cloudCol, cl * 0.92);
  // Day / night terminator across x; city lights on the night side.
  float day = smoothstep(u_planet.w - 900.0, u_planet.w + 900.0, v_world.x);
  // City lights: point-like, clustered by a low-frequency field, on land under clear sky.
  vec2 cg = v_world.xy * 0.045;
  vec2 cell = floor(cg), fr = fract(cg) - 0.5;
  float hh = hash(cell);
  vec2 jit = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float dotm = smoothstep(0.22, 0.0, length(fr - jit * 0.6));
  float cluster = smoothstep(0.5, 0.68, texture(u_noise, p * 3.0 + 2.1).r);
  float city = step(0.55, hh) * dotm * cluster * land * (1.0 - cl) * (0.5 + hh) * (1.0 - u_gas);
  col = col * mix(0.035, 1.0, day) + u_lights * city * (1.0 - day) * 2.2;
  col *= u_exposure;
  // Atmospheric haze thickens with distance.
  float f = clamp((v_depth - 14000.0) / 14000.0, 0.0, 0.5);
  col = mix(col, u_atmo * mix(0.12, 0.9, day), 0.07 + f * 0.6);
  o = vec4(col, 1.0);
}`;

const BH_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec4 u_bh;          // centre x, y (world), horizon radius, disc tilt
uniform vec3 u_disc;        // accretion disc colour
uniform float u_exposure;
in vec3 v_world; in float v_depth;
out vec4 o;
${NOISE}
void main() {
  vec2 d = v_world.xy - u_bh.xy;
  float R0 = u_bh.z, r = length(d);
  // Lensed starfield: rays bend around the hole.
  vec2 q = d + d / max(r * r, 1.0) * R0 * R0 * 1.6;
  vec2 sp = q * 0.03;
  float h = hash(floor(sp));
  vec3 col = vec3(0.85, 0.9, 1.0) * step(0.985, h) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5)) * (0.6 + 0.4 * h);
  col += vec3(0.25, 0.15, 0.45) * texture(u_noise, q * 0.0004).r * 0.4;
  // Accretion disc: a tilted annulus with spiralling bands, Doppler-bright on one side.
  vec2 dd = vec2(d.x, d.y / u_bh.w);
  float rd = length(dd), ang = atan(dd.y, dd.x);
  float band = texture(u_noise, vec2(ang * 0.6 - u_time * 0.12 + 3.0 / max(rd / R0, 0.5), rd * 0.01)).r;
  float disc = smoothstep(1.4 * R0, 1.9 * R0, rd) * smoothstep(4.6 * R0, 2.6 * R0, rd);
  float dop = 0.55 + 0.75 * (0.5 - 0.5 * sin(ang));
  vec3 dcol = mix(u_disc, vec3(1.0, 0.95, 0.85), smoothstep(3.0 * R0, 1.6 * R0, rd)) * (0.6 + band * 1.2) * dop * 2.2;
  bool front = d.y < 0.0;
  // The far half of the disc is lensed up over the hole as an arc.
  float arc = smoothstep(0.25 * R0, 0.0, abs(r - 1.55 * R0)) * step(0.0, d.y) * 0.8;
  col = mix(col, dcol, disc * (front ? 1.0 : 0.85));
  col += u_disc * 2.0 * arc * (0.7 + 0.3 * band);
  // Photon ring and the horizon.
  col += vec3(1.0, 0.85, 0.6) * smoothstep(0.08 * R0, 0.0, abs(r - 1.08 * R0)) * 2.5;
  float hole = smoothstep(R0 * 1.0, R0 * 0.94, r) * (front && disc > 0.2 ? 0.0 : 1.0);
  col *= 1.0 - hole;
  float a = clamp(max(max(disc, arc * 2.0), max(hole, smoothstep(6.0 * R0, 2.0 * R0, r))), 0.0, 1.0);
  o = vec4(col * u_exposure * a, a);
}`;

const SKY_FS = `#version 300 es
precision highp float;
uniform int u_mode;          // 0 gradient sky, 1 space, 2 deep water, 3 flat
uniform vec3 u_top;
uniform vec3 u_bottom;
uniform vec3 u_accent;
uniform vec2 u_sun;          // screen uv of the sun glow (or < 0)
uniform float u_time;
uniform float u_scroll;
uniform vec2 u_res;
uniform float u_exposure;
in vec2 v_uv; out vec4 o;
${NOISE}
void main() {
  vec2 uv = v_uv;
  vec3 col = mix(u_bottom, u_top, smoothstep(0.0, 1.0, uv.y));
  float asp = u_res.x / u_res.y;
  if (u_sun.x >= 0.0) {
    float d = length((uv - u_sun) * vec2(asp, 1.0));
    col += u_accent * (exp(-d * 6.0) * 0.6 + exp(-d * 40.0) * 1.5);
  }
  if (u_mode == 1) {
    vec2 p = uv * vec2(asp, 1.0) * 2.2 + vec2(0.0, u_scroll * 0.00004);
    float n = fbm(p + fbm(p * 1.4 + u_time * 0.004) * 1.4);
    col += u_accent * smoothstep(0.45, 0.95, n) * 0.35;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 sp = uv * vec2(asp, 1.0) * (90.0 + fi * 70.0) + vec2(0.0, u_scroll * (0.0004 + fi * 0.0003));
      float h = hash(floor(sp) + fi * 9.1);
      col += vec3(0.85, 0.9, 1.0) * step(0.986, h) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5)) * (0.5 + 0.5 * h);
    }
  } else if (u_mode == 2) {
    col *= 0.85 + 0.15 * fbm(uv * 4.0 + vec2(u_time * 0.02, u_scroll * 0.0003));
  }
  o = vec4(col * u_exposure, 1.0);
}`;

export class WorldGL {
  constructor(gl) {
    this.gl = gl;
    this.restores = 0;
    this.initGL();
  }

  initGL() {
    const gl = this.gl;
    this.lit = compileProgram(gl, LIT_VS, LIT_FS, 'world-lit');
    this.water = compileProgram(gl, SURF_VS, WATER_FS, 'world-water');
    this.lava = compileProgram(gl, SURF_VS, LAVA_FS, 'world-lava');
    this.sky = compileProgram(gl, FULLSCREEN_VS, SKY_FS, 'world-sky');
    this.cloud = compileProgram(gl, SURF_VS, CLOUD_FS, 'world-cloud');
    this.planet = compileProgram(gl, SURF_VS, PLANET_FS, 'world-planet');
    this.bh = compileProgram(gl, SURF_VS, BH_FS, 'world-blackhole');
    this.matTex = null;     // TEXTURE_2D_ARRAY (uploaded by uploadMaterials)
    this.matCount = 0;
    this.detailTex = this._detail();
    this.noiseTex = this._noise();
    this.blank = this._blank();
    this.surfVao = gl.createVertexArray();
    this.surfBuf = gl.createBuffer();
    gl.bindVertexArray(this.surfVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.surfBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 3 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
  }

  /** After a WebGL context loss: programs and shared textures are rebuilt; meshes re-upload lazily. */
  restore() { this.initGL(); this.restores++; }

  _blank() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return t;
  }

  /** Tileable noise for the surface shaders: R/G fBm (two seeds), B fine, A ridged. */
  _noise() {
    const gl = this.gl, N = 256, d = new Uint8Array(N * N * 4);
    const ch = [fbmTile(N, 4, 6, 101), fbmTile(N, 4, 3, 202), fbmTile(N, 16, 4, 303), fbmTile(N, 8, 5, 404, 0.55, true)];
    for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) d[i * 4 + c] = Math.round(Math.max(0, Math.min(1, 0.5 + (ch[c][i] - 0.5) * 0.62)) * 255);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  _bindNoise(p) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(p.u.u_noise, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Tiling detail grain (adds crisp micro-variation close to the camera). */
  _detail() {
    const gl = this.gl, N = 256, d = new Uint8Array(N * N * 4);
    let s = 1234567;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const base = new Float32Array(N * N);
    for (let i = 0; i < base.length; i++) base[i] = rnd();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      // Blur a little so it reads as grit, not pixel noise.
      let v = 0;
      for (const [dx, dy, w] of [[0, 0, 0.4], [1, 0, 0.15], [-1, 0, 0.15], [0, 1, 0.15], [0, -1, 0.15]]) v += base[((y + dy + N) % N) * N + ((x + dx + N) % N)] * w;
      const o = (y * N + x) * 4, k = Math.round(v * 255);
      d[o] = d[o + 1] = d[o + 2] = k; d[o + 3] = 255;
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  /** Upload the material library (array of canvases / ImageBitmaps, all TILE²). */
  uploadMaterials(images) {
    const gl = this.gl;
    if (this.matTex) gl.deleteTexture(this.matTex);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    const levels = Math.log2(TILE) + 1;
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, TILE, TILE, images.length);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    images.forEach((img, k) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, TILE, TILE, 1, gl.RGBA, gl.UNSIGNED_BYTE, img));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    this.matTex = t;
    this.matCount = images.length;
  }

  /** Terrain chunk texture (canvas / ImageBitmap). */
  texture(img, mips = true) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }

  /** Upload mesh data {v, i} → {vao, buf, ibuf, count}. */
  mesh(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray(), buf = gl.createBuffer(), ibuf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE, 40);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.i, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, buf, ibuf, count: data.count, bytes: data.v.byteLength + data.i.byteLength };
  }

  freeMesh(m) {
    if (!m) return;
    const gl = this.gl;
    gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.buf); gl.deleteBuffer(m.ibuf);
  }

  freeTexture(t) { if (t) this.gl.deleteTexture(t); }

  // ------------------------------------------------------------- frame

  /** Common per-frame uniforms for the lit program. */
  beginLit(cam, A) {
    const gl = this.gl, p = this.lit, u = p.u;
    gl.useProgram(p.prog);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform3f(u.u_offset, 0, 0, 0);
    gl.uniform3fv(u.u_fogCol, A.fogCol);
    gl.uniform3fv(u.u_fog, A.fog);
    gl.uniform3fv(u.u_hfog, A.hfog || [0, 0, 0]);
    gl.uniform1f(u.u_exposure, A.exposure);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform3fv(u.u_caustics, A.caustics || [0, 0, 0]);
    gl.uniform1f(u.u_alphaMul, 1);
    gl.uniform3fv(u.u_glowTint, A.glowTint || [1, 1, 1]);
    gl.uniform1i(u.u_mats, 0);
    gl.uniform1i(u.u_plane, 1);
    gl.uniform1i(u.u_detail, 2);
    gl.uniform1i(u.u_glow, 3);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.matTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.detailTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.blank);
  }

  /**
   * Draw a mesh with the lit program.
   * o: { plane (texture), glow (texture), cut, detail [amt, scale], alpha, offset [x,y,z] }
   */
  drawLit(m, o = {}) {
    if (!m || !m.count) return;
    const gl = this.gl, u = this.lit.u;
    gl.uniform1f(u.u_usePlane, o.plane ? 1 : 0);
    if (o.plane) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o.plane); }
    gl.uniform1f(u.u_useGlow, o.glow ? 1 : 0);
    if (o.glow) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, o.glow); }
    gl.uniform1f(u.u_cut, o.cut ?? 0.02);
    gl.uniform2fv(u.u_detail2, o.detail || [0, 0]);
    gl.uniform1f(u.u_alphaMul, o.alpha ?? 1);
    if (o.offset) gl.uniform3fv(u.u_offset, o.offset); else gl.uniform3f(u.u_offset, 0, 0, 0);
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  /** Large quad on the plane z (water / lava surfaces), covering rect. */
  _surfQuad(r, z) {
    const gl = this.gl;
    gl.bindVertexArray(this.surfVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.surfBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([r.x0, r.y0, z, r.x1, r.y0, z, r.x0, r.y1, z, r.x1, r.y1, z]));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  drawWater(cam, A, s, rect) {
    const gl = this.gl, p = this.water, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform3fv(u.u_deep, s.deep); gl.uniform3fv(u.u_shallow, s.shallow); gl.uniform3fv(u.u_sky, s.sky);
    gl.uniform3fv(u.u_sunDir, A.sunDir); gl.uniform3fv(u.u_sunCol, s.sunCol || A.sunCol);
    gl.uniform4fv(u.u_wave, s.wave || [1, 1, 1, 0.6]);
    gl.uniform4fv(u.u_foam, s.foam || [0.3, 0.55, 0.5, 0]);
    gl.uniform4fv(u.u_swirl, s.swirl || [0, 0, 0, 0]);
    gl.uniform2fv(u.u_wind, s.wind || [1, 0.3]);
    gl.uniform3fv(u.u_fogCol, A.fogCol); gl.uniform3fv(u.u_fog, A.fog);
    gl.uniform1f(u.u_exposure, A.exposure);
    this._surfQuad(rect, s.z || 0);
  }

  drawLava(cam, A, s, rect) {
    const gl = this.gl, p = this.lava, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform3fv(u.u_hot, s.hot || [1, 0.32, 0.04]);
    gl.uniform3fv(u.u_crust, s.crust || [0.12, 0.05, 0.03]);
    gl.uniform4fv(u.u_flow, s.flow || [0, -1, 1, 0.6]);
    gl.uniform3fv(u.u_fogCol, A.fogCol); gl.uniform3fv(u.u_fog, A.fog);
    gl.uniform1f(u.u_exposure, A.exposure);
    this._surfQuad(rect, s.z || 0);
  }

  /** Cloud deck (alpha-blended; caller sets blending and depth state). */
  drawCloud(cam, A, s, rect) {
    const gl = this.gl, p = this.cloud, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform4fv(u.u_cloud, s.cloud || [0.5, 1, 0.25, 40]);
    gl.uniform3fv(u.u_lit, s.lit); gl.uniform3fv(u.u_shade, s.shade); gl.uniform3fv(u.u_base, s.base);
    gl.uniform2fv(u.u_drift, s.drift || [4, 1]);
    gl.uniform1f(u.u_seed, s.seed || 0);
    gl.uniform3fv(u.u_sunDir, A.sunDir);
    gl.uniform3fv(u.u_fogCol, A.fogCol); gl.uniform3fv(u.u_fog, A.fog);
    gl.uniform1f(u.u_exposure, A.exposure);
    gl.uniform1f(u.u_alpha, s.alpha ?? 1);
    gl.uniform4fv(u.u_flash, s.flash || [0, 0, 0, 0]);
    this._surfQuad(rect, s.z || 0);
  }

  /** Planet surface far below (orbit arenas). */
  drawPlanet(cam, A, s, rect) {
    const gl = this.gl, p = this.planet, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform3fv(u.u_ocean, s.ocean); gl.uniform3fv(u.u_land, s.land); gl.uniform3fv(u.u_land2, s.land2); gl.uniform3fv(u.u_ice, s.ice);
    gl.uniform3fv(u.u_cloudCol, s.cloudCol); gl.uniform4fv(u.u_planet, s.planet); gl.uniform3fv(u.u_atmo, s.atmo); gl.uniform1f(u.u_gas, s.gas || 0);
    gl.uniform3fv(u.u_sunDir, A.sunDir); gl.uniform3fv(u.u_lights, s.lights || [1, 0.75, 0.4]);
    gl.uniform1f(u.u_exposure, A.exposure);
    this._surfQuad(rect, s.z);
  }

  /** Black hole with accretion disc and lensing (blended; caller sets state). */
  drawBlackHole(cam, A, s, rect) {
    const gl = this.gl, p = this.bh, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniformMatrix4fv(u.u_vp, false, cam.vp);
    gl.uniform3f(u.u_eye, cam.ex, cam.ey, cam.ez);
    gl.uniform3fv(u.u_fwd, cam.f);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform4fv(u.u_bh, s.bh);
    gl.uniform3fv(u.u_disc, s.disc || [1, 0.5, 0.2]);
    gl.uniform1f(u.u_exposure, A.exposure);
    this._surfQuad(rect, s.z);
  }

  drawSky(A, s, w, h, scroll) {
    const gl = this.gl, p = this.sky, u = p.u;
    gl.useProgram(p.prog);
    this._bindNoise(p);
    gl.uniform1i(u.u_mode, s.mode ?? 0);
    gl.uniform3fv(u.u_top, s.top); gl.uniform3fv(u.u_bottom, s.bottom); gl.uniform3fv(u.u_accent, s.accent || [0, 0, 0]);
    gl.uniform2fv(u.u_sun, s.sun || [-1, -1]);
    gl.uniform1f(u.u_time, A.time);
    gl.uniform1f(u.u_scroll, scroll);
    gl.uniform2f(u.u_res, w, h);
    gl.uniform1f(u.u_exposure, A.exposure);
    drawFullscreen(gl);
  }
}
