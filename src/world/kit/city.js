// City kit shared by urban environments (highway, city, plaza, megacity...):
// building layout records → geometry (MeshBuilder), baked shadows (Painter)
// and FX anchors. Pure data + functions; runs in the build Worker.
//
// Building record:
//   { x, y, w, d, h, rot, style, roof, burnt, collapse (0..1), tiers, items, night }
//   style: office | brick | glass | concrete | industrial
//   roof:  gravel | gravel_dark | tar | metal | concrete

const FACADE = {
  office: 'facade_office', brick: 'facade_brick', glass: 'facade_glass', concrete: 'facade_concrete', industrial: 'facade_industrial', drowned: 'facade_drowned',
};
const NIGHT = { office: 'facade_office_night', glass: 'facade_glass_night' };
const ROOF = { gravel: 'roof_gravel', gravel_dark: 'roof_gravel_dark', tar: 'roof_tar', metal: 'roof_metal', concrete: 'roof_concrete', algae: 'stone_algae' };

/** Plan a building inside a lot (centre, size) with seeded variety. */
export function planBuilding(R, x, y, w, d, o = {}) {
  const hMin = o.hMin ?? 30, hMax = o.hMax ?? 140;
  const style = o.style || R.pick(o.styles || ['office', 'office', 'brick', 'concrete', 'glass']);
  const h = Math.round(R.range(hMin, hMax) / 4) * 4;
  const b = {
    x, y, w, d, h, rot: o.rot || 0, style,
    roof: o.roof || R.pick(style === 'industrial' ? ['metal', 'metal', 'tar'] : ['gravel', 'gravel_dark', 'tar', 'concrete']),
    burnt: R.chance(o.burnt ?? 0), collapse: R.chance(o.collapse ?? 0) ? R.range(0.35, 0.75) : 0,
    night: !!o.night, tiers: [], items: [],
  };
  // Setback tiers on tall towers.
  if (h > 110 && style !== 'industrial' && R.chance(0.55)) {
    const k = R.range(0.55, 0.8);
    b.tiers.push({ w: w * k, d: d * k, h: Math.round(h * R.range(0.15, 0.35)), dx: R.range(-0.1, 0.1) * w, dy: R.range(-0.1, 0.1) * d });
  }
  // Rooftop plant: AC units, vents, a water tank, the stair/lift hut.
  const top = b.tiers.length ? b.tiers[b.tiers.length - 1] : { w, d, dx: 0, dy: 0 };
  const n = Math.round((top.w * top.d) / 900) + R.int(1, 3);
  for (let i = 0; i < n; i++) {
    const iw = R.range(5, 12), id = R.range(5, 14);
    b.items.push({ kind: 'box', dx: top.dx + R.range(-0.5, 0.5) * (top.w - iw - 6), dy: top.dy + R.range(-0.5, 0.5) * (top.d - id - 6), w: iw, d: id, h: R.range(3, 7) });
  }
  if (R.chance(0.6)) b.items.push({ kind: 'hut', dx: top.dx + R.range(-0.25, 0.25) * top.w, dy: top.dy + R.range(-0.25, 0.25) * top.d, w: R.range(10, 16), d: R.range(10, 16), h: R.range(8, 12) });
  if (R.chance(0.35) && style !== 'glass') b.items.push({ kind: 'tank', dx: top.dx + R.range(-0.3, 0.3) * top.w, dy: top.dy + R.range(-0.3, 0.3) * top.d, r: R.range(4, 6), h: R.range(10, 14) });
  return b;
}

const rot2 = (b, dx, dy) => {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [b.x + dx * c - dy * s, b.y + dx * s + dy * c];
};

/** Collapsed building: the standing part is split into broken stubs of uneven height. */
function stubs(b) {
  const out = [];
  const nx = 2, ny = 2;
  let seed = Math.abs(Math.round(b.x * 13 + b.y * 7));
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const w = b.w / nx, d = b.d / ny;
    const keep = rnd();
    const h = keep < 0.25 ? b.h * (1 - b.collapse) * 0.25 : b.h * (1 - b.collapse * rnd());
    out.push({ dx: (i - 0.5) * w, dy: (j - 0.5) * d, w: w * (0.92 + rnd() * 0.08), d: d * (0.92 + rnd() * 0.08), h: Math.max(8, h) });
  }
  return out;
}

/** Add a building's geometry. */
export function meshBuilding(mb, b, z0 = 0) {
  const night = b.night && NIGHT[b.style];
  const side = b.burnt ? 'facade_burnt' : (night ? NIGHT[b.style] : FACADE[b.style] || 'facade_concrete');
  const roof = b.burnt ? 'roof_burnt' : ROOF[b.roof] || 'roof_gravel';
  const parts = b.collapse ? stubs(b) : [{ dx: 0, dy: 0, w: b.w, d: b.d, h: b.h }];
  for (const p of parts) {
    const [x, y] = rot2(b, p.dx, p.dy);
    mb.box(x, y, z0, p.w, p.d, p.h, b.rot, { top: b.collapse ? 'concrete_scorched' : roof, side });
    if (!b.collapse) {
      // Parapet ring.
      const t = 1.4, ph = 2.6, hw = p.w / 2, hd = p.d / 2;
      for (const [ex, ey, ew, ed] of [[0, hd - t / 2, p.w, t], [0, -hd + t / 2, p.w, t], [hw - t / 2, 0, t, p.d], [-hw + t / 2, 0, t, p.d]]) {
        const [px, py] = rot2(b, p.dx + ex, p.dy + ey);
        mb.box(px, py, z0 + p.h, ew, ed, ph, b.rot, { top: 'concrete', side: 'concrete' });
      }
    }
  }
  if (b.collapse) return;
  let zTop = z0 + b.h;
  for (const t of b.tiers) {
    const [x, y] = rot2(b, t.dx, t.dy);
    mb.box(x, y, zTop, t.w, t.d, t.h, b.rot, { top: roof, side });
    zTop += t.h;
  }
  for (const it of b.items) {
    const [x, y] = rot2(b, it.dx, it.dy);
    if (it.kind === 'tank') {
      mb.lathe(x, y, [[it.r, zTop], [it.r, zTop + it.h], [it.r * 0.6, zTop + it.h + 2], [0, zTop + it.h + 2.6]], 'rust', { seg: 10, top: false });
    } else {
      mb.box(x, y, zTop, it.w, it.d, it.h, b.rot, { top: it.kind === 'hut' ? 'roof_tar' : 'metal_dark', side: it.kind === 'hut' ? 'concrete' : 'steel_painted' });
    }
  }
}

/** Queue a building's shadow on a ground painter. */
export function shadowBuilding(p, b, z0 = 0) {
  const parts = b.collapse ? stubs(b) : [{ dx: 0, dy: 0, w: b.w, d: b.d, h: b.h }];
  for (const q of parts) {
    const [x, y] = rot2(b, q.dx, q.dy);
    p.shadowBox(x, y, q.w, q.d, z0 + q.h + 2.6, b.rot, z0);
  }
  let zTop = b.h;
  for (const t of b.tiers) {
    const [x, y] = rot2(b, t.dx, t.dy);
    p.shadowBox(x, y, t.w, t.d, z0 + zTop + t.h, b.rot, z0 + zTop);
    zTop += t.h;
  }
}

/** FX anchors for a building (roof fires + smoke on burnt ones). */
export function buildingAnchors(R, b, out, o = {}) {
  if (!b.burnt && !b.collapse) {
    if (b.night && R.chance(0.5)) out.push({ type: 'beacon', x: b.x, y: b.y, z: b.h + 4, c: [1, 0.1, 0.05], period: 90 });
    return;
  }
  const n = b.collapse ? 1 : R.int(1, 2);
  for (let i = 0; i < n; i++) {
    const [x, y] = rot2(b, R.range(-0.3, 0.3) * b.w, R.range(-0.3, 0.3) * b.d);
    const z = b.collapse ? b.h * (1 - b.collapse) * 0.6 : b.h + 2;
    out.push({ type: 'fire', x, y, z, s: R.range(1.4, 2.4) * (o.fireScale || 1) });
  }
  if (R.chance(o.smoke ?? 0.8)) {
    const [x, y] = rot2(b, 0, 0);
    out.push({ type: 'smoke', x, y, z: b.h, s: R.range(1.6, 2.6), dark: 0.85 });
  }
}

// --------------------------------------------------------------- landmarks

/** Tower crane: lattice mast, jib with trolley, counter-jib with weights, cab. */
export function meshCrane(mb, x, y, h, jibRot = 0, o = {}) {
  const m = 3.5, jl = o.jib || 150, cl = o.counter || 46, z0 = o.z || 0;
  mb.prism([x - m, y - m, x + m, y - m, x + m, y + m, x - m, y + m], z0, z0 + h, { side: 'lattice' });
  mb.box(x, y, z0, m * 4, m * 4, 3, 0, { top: 'concrete', side: 'concrete' });           // foundation
  const c = Math.cos(jibRot), s = Math.sin(jibRot), zj = z0 + h;
  const at = (d) => [x + c * d, y + s * d];
  const [jx, jy] = at(jl), [cx, cy] = at(-cl);
  mb.beam([x, y, zj + 2], [jx, jy, zj + 2], 4, 4, 'lattice');
  mb.beam([x, y, zj + 2], [cx, cy, zj + 2], 5, 3, 'steel_yellow');
  const [wx, wy] = at(-cl + 8);
  mb.box(wx, wy, zj - 2, 10, 12, 8, jibRot, { top: 'concrete_dark', side: 'concrete_dark' });  // counterweights
  mb.box(x + c * 6, y + s * 6, zj - 6, 6, 6, 6, jibRot, { top: 'steel_yellow', side: 'steel_yellow' }); // cab
  mb.beam([x, y, zj + 2], [x, y, zj + 16], 3, 3, 'lattice');                                    // apex
  const [tx, ty] = at(jl * (o.trolley ?? 0.6));
  mb.box(tx, ty, zj - 1, 5, 5, 3, jibRot, { top: 'metal_dark', side: 'metal_dark' });
  mb.beam([tx, ty, zj - 1], [tx, ty, zj - (o.hook ?? 50)], 0.5, 0.5, 'metal_dark');              // hoist cable
}

export function shadowCrane(p, x, y, h, jibRot = 0, o = {}) {
  const jl = o.jib || 150, cl = o.counter || 46, z0 = o.z || 0;
  const c = Math.cos(jibRot), s = Math.sin(jibRot);
  p.shadowBox(x, y, 7, 7, z0 + h, 0, z0);
  const nx = -s * 2, ny = c * 2;
  p.shadow([x - c * cl + nx, y - s * cl + ny, x + c * jl + nx, y + s * jl + ny, x + c * jl - nx, y + s * jl - ny, x - c * cl - nx, y - s * cl - ny], z0 + h + 4, z0 + h);
}

/** Unfinished concrete frame: floor slabs on columns, a few walls, rebar on top. */
export function meshSkeleton(mb, b) {
  const floors = Math.max(2, Math.round(b.h / 16)), fh = b.h / floors;
  const nx = Math.max(2, Math.round(b.w / 26)), ny = Math.max(2, Math.round(b.d / 26));
  const built = Math.max(1, Math.round(floors * (b.done ?? 0.7)));
  for (let f = 0; f < built; f++) {
    const z = f * fh;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const [x, y] = rot2(b, (i / nx - 0.5) * (b.w - 4), (j / ny - 0.5) * (b.d - 4));
      mb.box(x, y, z, 2.4, 2.4, fh - 1.6, b.rot, { top: 'concrete', side: 'concrete' });
    }
    mb.box(b.x, b.y, z + fh - 1.6, b.w, b.d, 1.6, b.rot, { top: f === built - 1 ? 'concrete_dark' : 'concrete', side: 'concrete_dark' });
  }
  // Rebar starters on the top slab.
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    const [x, y] = rot2(b, (i / nx - 0.5) * (b.w - 4), (j / ny - 0.5) * (b.d - 4));
    mb.box(x, y, built * fh, 1.2, 1.2, 5, b.rot, { top: 'rust', side: 'rust' });
  }
  return built * fh;
}

/** Rooftop / roadside billboard facing the road (normal along -x or +x). */
export function meshBillboard(mb, x, y, z, w, h, face, mat) {
  const t = 1.2;
  for (const d of [-w * 0.35, w * 0.35]) mb.box(x, y + d, z, 1.6, 1.6, 10 + h * 0.3, 0, { top: 'steel_painted', side: 'steel_painted' });
  mb.box(x, y, z + 10, t, w, h, 0, { top: 'steel_painted', side: 'steel_painted', sides: [null, face > 0 ? mat : 'steel_painted', null, face < 0 ? mat : 'steel_painted'] });
}

/** Ridge tent (military / relief). */
export function meshTent(mb, x, y, w, l, h, rot = 0, mat = 'tarp_canvas') {
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (u, v, z) => [x + u * c - v * s, y + u * s + v * c, z];
  const hw = w / 2, hl = l / 2, eave = h * 0.35;
  const m = mb.mat(mat);
  const k = l / m.size[1], kw = w / m.size[0];
  mb.quad([P(-hw, -hl, eave), P(-hw, hl, eave), P(0, hl, h), P(0, -hl, h)], [[0, 0], [k, 0], [k, kw * 0.6], [0, kw * 0.6]], m.layer, [-c * 0.7, -s * 0.7, 0.7]);
  mb.quad([P(hw, hl, eave), P(hw, -hl, eave), P(0, -hl, h), P(0, hl, h)], [[0, 0], [k, 0], [k, kw * 0.6], [0, kw * 0.6]], m.layer, [c * 0.7, s * 0.7, 0.7]);
  for (const sv of [-1, 1]) {
    mb.quad([P(-hw, sv * hl, 0), P(hw, sv * hl, 0), P(hw, sv * hl, eave), P(-hw, sv * hl, eave)], [[0, 0], [kw, 0], [kw, 0.3], [0, 0.3]], m.layer, [s * -sv, c * sv, 0]);
    mb.quad([P(-hw, sv * hl, eave), P(hw, sv * hl, eave), P(0, sv * hl, h), P(0, sv * hl, h)], [[0, 0], [kw, 0], [kw / 2, 0.4], [kw / 2, 0.4]], m.layer, [s * -sv, c * sv, 0]);
  }
  for (const sw of [-1, 1]) mb.quad([P(sw * hw, -hl, 0), P(sw * hw, hl, 0), P(sw * hw, hl, eave), P(sw * hw, -hl, eave)], [[0, 0], [k, 0], [k, 0.3], [0, 0.3]], m.layer, [c * sw, s * sw, 0]);
}

/** Petrol station canopy on four columns. */
export function meshCanopy(mb, x, y, w, d, h, rot = 0) {
  for (const [u, v] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) {
    const [px, py] = rot2({ x, y, rot }, u * w, v * d);
    mb.box(px, py, 0, 2.2, 2.2, h, rot, { top: 'steel_painted', side: 'steel_painted' });
  }
  mb.box(x, y, h, w, d, 3, rot, { top: 'roof_metal', side: 'canopy_edge' });
}
