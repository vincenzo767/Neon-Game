import { worldSystem } from '../world/index.js';
import { installArenaBackground } from '../bosses/ArenaBackground.js';
import { arenaConfig } from '../bosses/arenas.js';
import { WORLD_W, WORLD_H } from '../core/constants.js';

// Menu backdrop (level rework): the title, menus and pilot select show one
// of the game's real arenas flying by, instead of the old neon city shader.
// One world is kept for the whole menu session (title → difficulty → pilot
// select) and released when play starts. Until its first view is built the
// screen stays dark, then the world fades in.

const MENU_ARENAS = ['sw_dawn_patrol', 'cs_lagoon_anchorage', 'fl_fjord_run', 'sb_dune_convoy', 'wf_frozen_frontline', 'tc_gathering_clouds', 'hs_invasion_day', 'sd_shatterbelt'];
const FADE = 50;

let view = null, fade = 0;

/** Show (or keep showing) the menu world behind the current screen. */
export function menuBackdrop(g) {
  const bg = g.renderer.background;
  installArenaBackground(bg, g.renderer.gl);
  if (!view || view.disposed) {
    const id = MENU_ARENAS[Math.floor(Math.random() * MENU_ARENAS.length)]; // cosmetic only
    const cfg = arenaConfig(id);
    if (!cfg) return;
    view = worldSystem(g).create(cfg);
    fade = 0;
  }
  bg.world = view;
}

/** Per menu step: fly the world forward, stream its chunks in. */
export function updateMenuBackdrop(g) {
  if (!view || view.disposed) return;
  worldSystem(g).check(); // WebGL context restores
  view.update();
  if (view.ready && fade < FADE) fade++;
}

/** Darkness over the world while its first view is still building / fading in. */
export function renderMenuCover(b, white) {
  const a = 1 - fade / FADE;
  if (a > 0) b.draw(white, WORLD_W / 2, WORLD_H / 2, WORLD_W + 40, WORLD_H + 40, 0, 0, 0, 0, a * a * (3 - 2 * a), 0);
}

/** Play is starting: free the menu world (GPU textures, buffers). */
export function releaseMenuBackdrop(g) {
  if (!view) return;
  const bg = g.renderer.background;
  if (bg.world === view) bg.world = null;
  view.dispose();
  view = null;
  fade = 0;
}
