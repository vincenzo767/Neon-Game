// Music-layer stub (M4b). Bosses request a music layer per phase; the real
// adaptive music engine arrives in M6 and replaces this module's body while
// keeping setLayer() as its entry point.

export const music = {
  layer: null,
  setLayer(name) { this.layer = name || null; },
};
