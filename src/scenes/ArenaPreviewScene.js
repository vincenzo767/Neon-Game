import { installArenaBackground } from '../bosses/ArenaBackground.js';
import { worldSystem } from '../world/index.js';
import { arenaConfig, ARENA_IDS } from '../bosses/arenas.js';

// Dev: look at arena configurations without a fight (`?arena=<id>`).
// ←/→ cycle arenas, ↑/↓ scroll speed ×, Q cycles quality, H toggles the
// stats line. Used by the headless screenshot checks as well.

export class ArenaPreviewScene {
  constructor(id) {
    this.ids = ARENA_IDS;
    this.i = Math.max(0, this.ids.indexOf(id));
    this.speedMul = 1;
    this.showStats = true;
  }

  enter(g) {
    this.g = g;
    this.sys = worldSystem(g);
    this.bg = g.renderer.background;
    installArenaBackground(this.bg, g.renderer.gl);
    this.world = null;
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:absolute;left:4px;top:4px;font:11px monospace;color:#cfe;text-shadow:0 0 2px #000;pointer-events:none;white-space:pre';
    g.hud.appendChild(this.el);
  }

  get cfg() { return arenaConfig(this.ids[this.i]); }

  _open() {
    if (this.world) this.world.dispose();
    this.world = this.sys.create(this.cfg, { quality: this.quality });
    this.bg.world = this.world;
  }

  update() {
    const g = this.g, inp = g.input;
    this.sys.check();
    if (!this.world && this.sys.materialsReady) this._open();
    if (inp.keyPressed('ArrowRight')) { this.i = (this.i + 1) % this.ids.length; this._open(); }
    if (inp.keyPressed('ArrowLeft')) { this.i = (this.i + this.ids.length - 1) % this.ids.length; this._open(); }
    if (inp.keyPressed('ArrowUp')) this.speedMul *= 1.5;
    if (inp.keyPressed('ArrowDown')) this.speedMul /= 1.5;
    if (inp.keyPressed('KeyQ')) { this.quality = { high: 'medium', medium: 'low', low: 'high' }[this.quality || 'high']; this._open(); }
    if (inp.keyPressed('KeyH')) this.showStats = !this.showStats;
    const w = this.world;
    if (w) {
      w.speed = (this.cfg.scroll ?? 1) * 1.15 * this.speedMul;
      w.update();
      if (this.showStats && w.time % 15 === 0) {
        const s = this.sys.svc.stats;
        this.el.textContent = `${this.cfg.id} · ${this.cfg.name}\nenv ${this.cfg.env} · ${w.qname} · ready ${w.ready ? 'yes' : 'no'} (${Math.round(w.progress * 100)}%)\nchunks ${w.chunks.size} · gpu ${w.memoryMB} MB · fx ${w.fx.p.count} · built ${s.built} avg ${s.built ? Math.round(s.ms / s.built) : 0} ms (${this.sys.svc.mode})`;
      }
      if (!this.showStats) this.el.textContent = '';
    }
  }

  render(r, alpha) {
    if (this.world) this.world.renderFx(r.batch, alpha);
  }

  exit() {
    if (this.world) this.world.dispose();
    this.bg.world = null;
    this.el.remove();
  }
}
