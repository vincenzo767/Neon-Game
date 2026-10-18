// Hand-made pilot art (KAIRO_ART_TEST.md). Images are loaded before the
// renderer builds its atlas, so a pilot's `sprites(atlas)` can rasterise them
// next to the procedural sprites. A pilot whose art is missing or fails to
// load keeps its procedural look: `pilotArt(id)` is null for it.
//
// Files live in public/assets/pilots/<id>/ (see tools/process-<id>.mjs).

const ART = new Map(); // id -> { images: {name: HTMLImageElement}, anchors, layers }

/** Which pilots have hand-made art, and their files. */
export const ART_MANIFEST = {
  kairo: {
    images: {
      back2x: 'kairo_back@2x.png',
      back1x: 'kairo_back@1x.png',
      outline2x: 'kairo_back_outline@2x.png',
      outline1x: 'kairo_back_outline@1x.png',
      front: 'kairo_front@2x.png',
      portrait: 'kairo_portrait.jpg',
    },
    json: { anchors: 'kairo.anchors.json', layers: 'kairo.layers.json' },
  },
  mira: {
    images: {
      back2x: 'mira_back@2x.png',
      outline2x: 'mira_back_outline@2x.png',
      front: 'mira_front@2x.png',
      portrait: 'mira_portrait.jpg',
    },
    json: { anchors: 'mira.anchors.json', layers: 'mira.layers.json' },
  },
  bruno: {
    images: {
      back2x: 'bruno_back@2x.png',
      outline2x: 'bruno_back_outline@2x.png',
      front: 'bruno_front@2x.png',
      portrait: 'bruno_portrait.jpg',
    },
    json: { anchors: 'bruno.anchors.json', layers: 'bruno.layers.json' },
  },
  tess: {
    images: {
      back2x: 'tess_back@2x.png',
      outline2x: 'tess_back_outline@2x.png',
      front: 'tess_front@2x.png',
      portrait: 'tess_portrait.jpg',
    },
    json: { anchors: 'tess.anchors.json', layers: 'tess.layers.json' },
  },
  oduya: {
    images: {
      back2x: 'oduya_back@2x.png',
      outline2x: 'oduya_back_outline@2x.png',
      front: 'oduya_front@2x.png',
      portrait: 'oduya_portrait.jpg',
    },
    json: { anchors: 'oduya.anchors.json', layers: 'oduya.layers.json' },
  },
  lin: {
    images: {
      back2x: 'lin_back@2x.png',
      outline2x: 'lin_back_outline@2x.png',
      wings2x: 'lin_wings@2x.png',            // wing pixels under the spear / whip filled in
      wingsOutline2x: 'lin_wings_outline@2x.png',
      turret: 'lin_turret.png',               // swarm turret drone
      fxArrow: 'lin_fx_arrow.png',            // owner's FX picks (tools/art-ref/lin/): main arrows,
      fxSpear: 'lin_fx_spear.png',            // focus / split / falling spears,
      fxStar: 'lin_fx_star.png',              // Spear Rain hits,
      fxCosmic: 'lin_fx_cosmic.png',          // the Cosmic Spear
      front: 'lin_front@2x.png',
      portrait: 'lin_portrait.jpg',
    },
    json: { anchors: 'lin.anchors.json', layers: 'lin.layers.json' },
  },
  miguerre: {
    images: {
      back2x: 'miguerre_back@2x.png',
      outline2x: 'miguerre_back_outline@2x.png',
      wings2x: 'miguerre_wings@2x.png',
      wingsOutline2x: 'miguerre_wings_outline@2x.png',
      front: 'miguerre_front@2x.png',
      portrait: 'miguerre_portrait.jpg',
    },
    json: { anchors: 'miguerre.anchors.json', layers: 'miguerre.layers.json' },
  },
  sera: {
    images: {
      back2x: 'sera_back@2x.png',
      outline2x: 'sera_back_outline@2x.png',
      wings2x: 'sera_wings@2x.png',            // the drawing arm's footprint filled in
      wingsOutline2x: 'sera_wings_outline@2x.png',
      front: 'sera_front@2x.png',
      portrait: 'sera_portrait.jpg',
    },
    json: { anchors: 'sera.anchors.json', layers: 'sera.layers.json' },
  },
};

const base = () => {
  const b = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return b.endsWith('/') ? b : `${b}/`;
};
export const artUrl = (id, file) => `${base()}assets/pilots/${id}/${file}`;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

async function loadJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`failed to load ${url} (${r.status})`);
  return r.json();
}

/**
 * Load every pilot's art. Never throws: a pilot whose files fail to load is
 * simply left out (its procedural sprites are used). `?noart` skips loading
 * entirely (tests the fallback).
 */
export async function loadPilotArt() {
  if (typeof window === 'undefined' || new URLSearchParams(location.search).has('noart')) return;
  await Promise.all(Object.entries(ART_MANIFEST).map(async ([id, m]) => {
    try {
      const imgs = await Promise.all(Object.entries(m.images).map(async ([k, f]) => [k, await loadImage(artUrl(id, f))]));
      const json = await Promise.all(Object.entries(m.json).map(async ([k, f]) => [k, await loadJson(artUrl(id, f))]));
      ART.set(id, { images: Object.fromEntries(imgs), ...Object.fromEntries(json) });
    } catch (err) {
      console.warn(`[art] ${id}: ${err.message}; using procedural sprites`);
    }
  }));
}

/** The loaded art for a pilot, or null (procedural fallback). */
export const pilotArt = (id) => ART.get(id) || null;
