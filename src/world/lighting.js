// Arena lighting. One definition drives everything that must agree: baked
// vertex light on solids, the shadow direction painted into terrain, fog,
// the water/sky colours and the exposure.
//
// light: {
//   preset: 'noon' | 'afternoon' | 'dusk' | 'dawn' | 'night' | 'overcast' | 'storm'
//         | 'smoke' | 'interior' | 'underwater' | 'deep' | 'space' | 'arctic' | 'desert',
//   az, elev        sun azimuth (deg, direction the light COMES FROM; 0 = ahead/+y,
//                   90 = right/+x) and elevation (deg)
//   sun, ambient    [r, g, b] (multiplied by intensity)
//   fog: [r, g, b], fogStart, fogEnd, fogMax, exposure, sky: {...}
// }

const P = {
  noon: { az: 320, elev: 62, sun: [1.0, 0.96, 0.9], sunI: 1.0, ambient: [0.36, 0.4, 0.48], fog: [0.62, 0.68, 0.76], fogStart: 700, fogEnd: 2600, fogMax: 0.5, exposure: 1.0 },
  afternoon: { az: 305, elev: 42, sun: [1.0, 0.9, 0.76], sunI: 1.05, ambient: [0.34, 0.37, 0.45], fog: [0.6, 0.62, 0.66], fogStart: 700, fogEnd: 2400, fogMax: 0.55, exposure: 1.0 },
  dusk: { az: 290, elev: 18, sun: [1.0, 0.62, 0.32], sunI: 1.25, ambient: [0.3, 0.27, 0.32], fog: [0.5, 0.36, 0.3], fogStart: 600, fogEnd: 2000, fogMax: 0.65, exposure: 1.05 },
  dawn: { az: 70, elev: 14, sun: [1.0, 0.72, 0.5], sunI: 1.15, ambient: [0.32, 0.33, 0.42], fog: [0.62, 0.55, 0.58], fogStart: 600, fogEnd: 2200, fogMax: 0.6, exposure: 1.05 },
  night: { az: 320, elev: 55, sun: [0.45, 0.55, 0.8], sunI: 0.35, ambient: [0.1, 0.12, 0.18], fog: [0.05, 0.06, 0.09], fogStart: 500, fogEnd: 1900, fogMax: 0.7, exposure: 1.0 },
  overcast: { az: 315, elev: 60, sun: [0.85, 0.86, 0.88], sunI: 0.55, ambient: [0.45, 0.47, 0.5], fog: [0.55, 0.57, 0.6], fogStart: 500, fogEnd: 2000, fogMax: 0.65, exposure: 1.0 },
  storm: { az: 315, elev: 55, sun: [0.6, 0.66, 0.76], sunI: 0.35, ambient: [0.22, 0.25, 0.3], fog: [0.18, 0.2, 0.24], fogStart: 350, fogEnd: 1500, fogMax: 0.75, exposure: 1.0 },
  smoke: { az: 292, elev: 24, sun: [1.0, 0.55, 0.28], sunI: 0.95, ambient: [0.26, 0.23, 0.24], fog: [0.36, 0.26, 0.22], fogStart: 450, fogEnd: 1700, fogMax: 0.7, exposure: 1.05 },
  interior: { az: 330, elev: 80, sun: [1.0, 0.85, 0.65], sunI: 0.45, ambient: [0.22, 0.21, 0.2], fog: [0.06, 0.055, 0.05], fogStart: 300, fogEnd: 1400, fogMax: 0.8, exposure: 1.0 },
  underwater: { az: 330, elev: 70, sun: [0.6, 0.85, 0.95], sunI: 0.55, ambient: [0.12, 0.26, 0.32], fog: [0.04, 0.16, 0.22], fogStart: 700, fogEnd: 2600, fogMax: 0.85, exposure: 1.0 },
  deep: { az: 330, elev: 70, sun: [0.3, 0.5, 0.6], sunI: 0.25, ambient: [0.04, 0.09, 0.12], fog: [0.0, 0.025, 0.04], fogStart: 600, fogEnd: 2000, fogMax: 0.95, exposure: 1.0 },
  space: { az: 300, elev: 30, sun: [1.0, 0.97, 0.92], sunI: 1.3, ambient: [0.05, 0.06, 0.09], fog: [0.0, 0.0, 0.01], fogStart: 4000, fogEnd: 9000, fogMax: 0.2, exposure: 1.0 },
  arctic: { az: 300, elev: 22, sun: [1.0, 0.92, 0.84], sunI: 1.0, ambient: [0.42, 0.48, 0.6], fog: [0.72, 0.78, 0.86], fogStart: 500, fogEnd: 2200, fogMax: 0.6, exposure: 0.84 },
  desert: { az: 310, elev: 48, sun: [1.0, 0.9, 0.74], sunI: 1.15, ambient: [0.4, 0.38, 0.38], fog: [0.82, 0.7, 0.56], fogStart: 700, fogEnd: 2600, fogMax: 0.55, exposure: 0.95 },
};

const deg = Math.PI / 180;

export function lighting(cfg = {}) {
  const l = cfg.light || {};
  const base = P[l.preset || 'afternoon'] || P.afternoon;
  const L = { ...base, ...l };
  const az = L.az * deg, el = L.elev * deg;
  // Direction TOWARD the sun (where light comes from).
  const sunDir = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  const sunCol = L.sun.map((v) => v * L.sunI);
  return {
    preset: l.preset || 'afternoon',
    sunDir,
    sunCol,
    ambient: L.ambient,
    mesh: { sunDir, sun: sunCol, ambient: L.ambient },
    // Shadows fall away from the sun.
    paintSun: { dx: -Math.sin(az), dy: -Math.cos(az), elev: Math.max(8 * deg, el) },
    shadow: Math.min(0.78, 0.25 + 0.6 * (L.sunI * Math.sin(el + 0.15)) / (L.sunI * Math.sin(el + 0.15) + (L.ambient[0] + L.ambient[1] + L.ambient[2]) / 3 + 0.05)),
    groundLight: L.ambient.map((a, i) => a * 0.55 + a * 0.45 + sunCol[i] * Math.max(0, Math.sin(el))),
    fogCol: L.fog,
    fog: [L.fogStart, L.fogEnd, L.fogMax],
    exposure: L.exposure,
  };
}

export const LIGHT_PRESETS = Object.keys(P);
