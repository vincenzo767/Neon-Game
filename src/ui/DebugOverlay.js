// Performance / engine stats overlay (toggle with ` or F3).

export class DebugOverlay {
  constructor(el, game) {
    this.el = el;
    this.game = game;
    this.visible = false;
    el.style.display = 'none';
    this.frames = 0;
    this.accum = 0;
    this.fps = 0;
    this.worst = 0;
    this.cpuAvg = 0;
    this.stats = {}; // scene-provided key/values
  }

  toggle() {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
  }

  set(key, value) { this.stats[key] = value; }

  frame(dt) {
    this.frames++;
    this.accum += dt;
    this.worst = Math.max(this.worst, dt);
    this.cpuAvg += (this.game.cpuMs - this.cpuAvg) * 0.1;
    if (this.accum < 0.25) return;
    this.fps = this.frames / this.accum;
    const worstMs = this.worst * 1000;
    this.frames = 0;
    this.accum = 0;
    this.worst = 0;
    if (!this.visible) return;

    const g = this.game, r = g.renderer, b = r.batch;
    const lines = [
      `FPS ${this.fps.toFixed(0)}  worst ${worstMs.toFixed(1)}ms  cpu ${this.cpuAvg.toFixed(2)}ms`,
      `res ${r.width}x${r.height}  ${g.settings.data.quality}  ${r.post.hdr ? 'HDR' : 'LDR'}  CRT ${g.settings.data.crt ? 'on' : 'off'}  shake ${g.settings.data.shake.toFixed(2)}`,
      `sprites ${b.instances}  draws ${b.drawCalls}`,
      `seed ${g.seed}  step ${g.frameCount}`,
    ];
    for (const [k, v] of Object.entries(this.stats)) lines.push(`${k} ${v}`);
    this.el.textContent = lines.join('\n');
  }
}
