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
