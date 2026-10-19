import { WorldGL } from './WorldGL.js';
import { buildService } from './BuildService.js';
import { ArenaWorld } from './ArenaWorld.js';

// Arena world system: one WorldGL (programs, material array) and one
// BuildService (worker) per game. Created at boot so the shared material
// library is painted and uploaded long before the first boss.

let SYS = null;

export function worldSystem(game) {
  if (SYS && SYS.game === game) return SYS;
  const r = game.renderer;
  const sys = {
    game,
    wgl: new WorldGL(r.gl),
    svc: buildService(),
    materialsReady: false,
    restores: r.restores,
    /** New ArenaWorld for an arena config. */
    create(cfg, opts) { return new ArenaWorld(game, cfg, sys.svc, sys.wgl, opts); },
    /** Call once per frame: handles WebGL context restores. */
    check() {
      if (r.restores !== sys.restores) {
        sys.restores = r.restores;
        sys.wgl.restore();
        sys.materialsReady = false;
        sys.loadMaterials();
      }
    },
    loadMaterials() {
      return sys.svc.materials().then(({ imgs }) => {
        sys.wgl.uploadMaterials(imgs);
        for (const im of imgs) if (im && typeof im.close === 'function') im.close();
        sys.materialsReady = true;
      }).catch((err) => console.warn('[world] material library failed:', err.message));
    },
  };
  sys.svc.warm();
  sys.loadMaterials();
  SYS = sys;
  return sys;
}

export { ArenaWorld };
