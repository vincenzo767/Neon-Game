// Ship kit: hulls and superstructures as geometry, built facing +y (bow
// forward) around a local origin. Used for convoys, harbours, oil fields,
// carrier groups; static (moored, wrecked) or as movers (drawn with an offset).
//
// Sizes at ~6 units per metre: destroyer ≈ 150 × 20, freighter ≈ 180 × 28.

const SHIPS = {
  destroyer: { l: 150, b: 18, h: 8, hull: 'hull_grey', deck: 'deck_grey' },
  frigate: { l: 115, b: 15, h: 7, hull: 'hull_grey', deck: 'deck_grey' },
  freighter: { l: 180, b: 28, h: 10, hull: 'hull_red', deck: 'deck_rust' },
  tanker: { l: 210, b: 32, h: 9, hull: 'hull_black', deck: 'deck_red' },
  patrol: { l: 55, b: 10, h: 5, hull: 'hull_grey', deck: 'deck_grey' },
  trawler: { l: 60, b: 13, h: 5, hull: 'hull_blue', deck: 'deck_rust' },
  tug: { l: 40, b: 12, h: 5, hull: 'hull_black', deck: 'deck_red' },
};
export const SHIP_TYPES = Object.keys(SHIPS);
export const shipSize = (type) => SHIPS[type] || SHIPS.destroyer;

/** Hull outline (local, bow at +y): fine bow, full midship, transom stern. */
function hullPts(l, b, bow = 0.24) {
  const hl = l / 2, hb = b / 2, pts = [];
  pts.push(0, hl);                                      // stem
  pts.push(hb * 0.55, hl - l * bow * 0.35);
  pts.push(hb * 0.92, hl - l * bow);
  pts.push(hb, hl - l * bow * 1.6);
  pts.push(hb, -hl + l * 0.08);
  pts.push(hb * 0.86, -hl);                             // transom
  pts.push(-hb * 0.86, -hl);
  pts.push(-hb, -hl + l * 0.08);
  pts.push(-hb, hl - l * bow * 1.6);
  pts.push(-hb * 0.92, hl - l * bow);
  pts.push(-hb * 0.55, hl - l * bow * 0.35);
  return pts;
}

function xf(pts, x, y, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < pts.length; i += 2) out.push(x + pts[i] * c - pts[i + 1] * s, y + pts[i] * s + pts[i + 1] * c);
  return out;
}

/**
 * Build a ship. rot: heading (0 = +y). o: { burnt, list (heel, visual only), lowered (sinking: freeboard) }
 * Returns funnel/stack points (world) for smoke anchors.
 */
export function meshShip(mb, type, x, y, rot = 0, o = {}) {
  const S = shipSize(type), l = S.l, b = S.b;
  const fb = o.lowered ? S.h * 0.35 : S.h;
  const hull = xf(hullPts(l, b), x, y, rot);
  // Reverse the outline to counter-clockwise for outward walls.
  const ccw = [];
  for (let i = hull.length - 2; i >= 0; i -= 2) ccw.push(hull[i], hull[i + 1]);
  mb.prism(ccw, -3, fb, { side: o.burnt ? 'scorch' : S.hull, top: o.burnt ? 'scorch' : S.deck, continuous: true });
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const box = (u, v, w, d, h, z, top, side) => { const [px, py] = at(u, v); mb.box(px, py, z, w, d, h, rot, { top, side }); };
  const stacks = [];
  const sup = o.burnt ? 'scorch' : 'superstructure';
  switch (type) {
    case 'destroyer': case 'frigate': {
      box(0, l * 0.12, b * 0.62, l * 0.2, 9, fb, 'deck_grey', sup);            // bridge block
      box(0, l * 0.16, b * 0.4, l * 0.08, 7, fb + 9, 'roof_metal', sup);       // bridge
      const [mx, my] = at(0, l * 0.1);
      mb.beam([mx, my, fb + 16], [mx, my, fb + 38], 1.6, 1.6, 'steel_painted');  // mast
      mb.beam([mx - c * 8, my - s * 8, fb + 32], [mx + c * 8, my + s * 8, fb + 32], 1, 1, 'steel_painted');
      box(0, -l * 0.05, b * 0.5, l * 0.14, 7, fb, 'deck_grey', sup);
      const [fx, fy] = at(0, -l * 0.05);
      mb.lathe(fx, fy, [[3.5, fb + 7], [3.2, fb + 15], [3.6, fb + 16]], 'superstructure', { seg: 8, top: 'scorch' });
      stacks.push([fx, fy, fb + 16]);
      for (const v of [l * 0.3, -l * 0.3]) {                                   // gun turrets
        const [tx, ty] = at(0, v);
        mb.lathe(tx, ty, [[4.5, fb], [4.2, fb + 3.5], [3, fb + 4.5], [0, fb + 4.8]], 'deck_grey', { seg: 10 });
        const dir = v > 0 ? 1 : -1;
        mb.beam([tx, ty, fb + 2.6], [tx - s * dir * 11, ty + c * dir * 11, fb + 2.8], 0.9, 0.9, 'metal_dark');
      }
      box(0, -l * 0.2, b * 0.55, l * 0.1, 4, fb, 'deck_grey', sup);            // helo hangar
      break;
    }
    case 'freighter': {
      box(0, -l * 0.38, b * 0.9, l * 0.12, 22, fb, 'roof_metal', 'facade_concrete');   // accommodation aft
      const [fx, fy] = at(0, -l * 0.42);
      mb.lathe(fx, fy, [[4, fb + 22], [3.8, fb + 30], [4.2, fb + 31]], 'hull_red', { seg: 8, top: 'scorch' });
      stacks.push([fx, fy, fb + 31]);
      for (let k = 0; k < 5; k++) {                                              // container rows
        for (let j = -1; j <= 1; j++) for (let lev = 0; lev < (o.light ? 1 : 2); lev++) {
          const mat = ['container_red', 'container_blue', 'container_green', 'container_orange', 'container_grey', 'container_teal'][(k * 3 + j + lev * 2 + 6) % 6];
          box(j * (b * 0.3), l * 0.32 - k * l * 0.13, b * 0.28, l * 0.11, 6, fb + lev * 6, mat, mat);
        }
      }
      for (const v of [l * 0.12, -l * 0.2]) { const [cx, cy] = at(b * 0.35, v); mb.beam([cx, cy, fb], [cx, cy, fb + 26], 1.4, 1.4, 'steel_yellow'); mb.beam([cx, cy, fb + 24], [cx - c * b * 0.6, cy - s * b * 0.6, fb + 20], 1, 1, 'steel_yellow'); }
      break;
    }
    case 'tanker': {
      box(0, -l * 0.4, b * 0.85, l * 0.1, 20, fb, 'roof_metal', 'facade_concrete');
      const [fx, fy] = at(0, -l * 0.44);
      mb.lathe(fx, fy, [[4.5, fb + 20], [4.2, fb + 28], [4.6, fb + 29]], 'hull_black', { seg: 8, top: 'scorch' });
      stacks.push([fx, fy, fb + 29]);
      const [p0x, p0y] = at(0, l * 0.36), [p1x, p1y] = at(0, -l * 0.32);
      mb.beam([p0x, p0y, fb + 1.5], [p1x, p1y, fb + 1.5], 2.5, 2, 'steel_painted');     // catwalk / pipe run
      for (let k = 0; k < 4; k++) { const [mx, my] = at(0, l * 0.28 - k * l * 0.18); mb.lathe(mx, my, [[2.5, fb], [2.5, fb + 3], [0, fb + 4]], 'steel_painted', { seg: 8 }); }
      break;
    }
    case 'patrol': case 'tug': case 'trawler': {
      box(0, type === 'trawler' ? l * 0.18 : l * 0.05, b * 0.6, l * 0.28, 6, fb, 'roof_metal', 'superstructure');
      const [mx, my] = at(0, l * 0.05);
      mb.beam([mx, my, fb + 6], [mx, my, fb + 18], 0.8, 0.8, 'steel_painted');
      if (type === 'trawler') { const [ax, ay] = at(0, -l * 0.3); mb.beam([ax, ay, fb], [ax - s * 10, ay - c * 2, fb + 14], 1, 1, 'steel_yellow'); }
      stacks.push([mx, my, fb + 8]);
      break;
    }
    default: break;
  }
  return stacks;
}

/** Painted wake (on a water-overlay layer): V of churned foam behind the stern. */
export function paintWake(p, x, y, rot, l, b, len = 260, o = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const [sx, sy] = at(0, -l / 2);
  for (let k = 0; k < 18; k++) {
    const t = k / 17, spread = b * 0.5 + t * len * 0.32;
    for (const side of [-1, 1]) {
      const [wx, wy] = at(side * spread, -l / 2 - t * len);
      p.radial(wx, wy, 6 + t * 14, [[0, [0.92, 0.95, 0.97], (1 - t) * 0.55 * (o.k || 1)], [1, [0.9, 0.95, 1], 0]]);
    }
    const [cx, cy] = at(0, -l / 2 - t * len * 0.8);
    p.radial(cx, cy, b * 0.6 + t * 20, [[0, [0.85, 0.92, 0.95], (1 - t) * 0.5 * (o.k || 1)], [1, [0.85, 0.92, 0.95], 0]]);
  }
  p.radial(sx, sy, b * 0.9, [[0, [1, 1, 1], 0.7], [1, [1, 1, 1], 0]]);
}
