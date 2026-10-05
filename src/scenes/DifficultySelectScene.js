import { WORLD_W } from '../core/constants.js';
import { World } from '../entities/World.js';
import { Parallax } from '../fx/Parallax.js';
import { BIOMES } from '../stages/biomes.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from '../core/difficulty.js';
import * as P from '../patterns/index.js';
import { handleDevKeys } from './devKeys.js';
import { playHellWarning, playUiTick, playConfirm } from '../audio/sting.js';
import { PilotSelectScene } from './PilotSelectScene.js';

// Difficulty select (UPDATE_01 §3.3): five cards with a colour identity,
// one-line description, key numbers and a density meter, plus a live
// bullet preview fired through the real pattern library at the highlighted
// difficulty's density/speed. Highlighting HELL sounds a distorted warning.

const PREVIEW_X = WORLD_W / 2;
const PREVIEW_Y = 520;
const SPEC = {
  spiral: { shape: 'orb', color: 'pink', n: 10, speed: 1.7, turn: 0.17 },
  fan: { shape: 'rice', color: 'cyan', n: 7, spread: 1.4, speed: 2.4 },
  ring: { shape: 'bigorb', color: 'orange', n: 8, speed: 1.2 },
};

export class DifficultySelectScene {
  enter(g) {
    this.g = g;
    g.renderer.background.setBiome(BIOMES[0].bg);
    this.parallax = new Parallax(g, BIOMES[0]);
    // A World with no player: just a bullet-preview emitter.
    this.world = new World(g);
    this.emitter = this.world.spawnEnemy({
      kind: 'preview', x: PREVIEW_X, y: PREVIEW_Y, r: 1, hp: 1e9, untargetable: true,
      f: g.renderer.frame('emitter'), scale: 0.55, glow: [1, 0.2, 0.7], blast: 0,
      ai: (e) => { e.rot = e.t * 0.02; },
    });
    this.t = 0;
    const want = g.difficultyId || g.settings.data.difficulty || DEFAULT_DIFFICULTY;
    this.index = Math.max(0, DIFFICULTIES.findIndex((d) => d.id === want));
    this._buildDom();
    this._select(this.index, true);
  }

  exit() { this.g.hud.innerHTML = ''; }

  _buildDom() {
    const cards = DIFFICULTIES.map((d) => {
      const pips = Math.round(d.density * 5);
      return `
        <div class="diff-card ${d.id}" style="--dc:${d.color}">
          ${d.id === 'hell' ? '<div class="dc-flames"></div>' : ''}
          <div class="dc-head"><b>${d.name}</b><span>SCORE ×${d.scoreMul.toFixed(1)}</span></div>
          <div class="dc-desc">${d.desc}</div>
          <div class="dc-stats">SHIPS ${d.lives} · BOMBS ${d.bombs} · BOSS PHASES ${d.bossPhases}${d.desperation ? '+' : ''} · SPEED ×${d.bulletSpeed}${d.revenge ? ' · REVENGE' : ''}</div>
          <div class="dc-density"><label>DENSITY</label>${Array.from({ length: 10 }, (_, i) => `<i class="${i < pips ? 'on' : ''}"></i>`).join('')}</div>
        </div>`;
    }).join('');
    this.g.hud.innerHTML = `
      <div class="diff">
        <div class="diff-title">SELECT DIFFICULTY<span>RULES OF ENGAGEMENT</span></div>
        <div class="diff-list">${cards}</div>
        <div class="diff-preview">LIVE FIRE PREVIEW</div>
        <div class="diff-hint"><b>↑↓</b> choose · <b>Z / ENTER</b> confirm</div>
      </div>`;
    this.cards = [...this.g.hud.querySelectorAll('.diff-card')];
  }

  _select(i, silent = false) {
    this.index = i;
    const d = DIFFICULTIES[i];
    this.cards.forEach((c, k) => c.classList.toggle('sel', k === i));
    this.g.hud.querySelector('.diff').style.setProperty('--dc', d.color);
    // Preview fires with this difficulty's density/speed scaling.
    this.world.diff = { density: d.density, speed: d.bulletSpeed, fireRate: 1 };
    this.world.bullets.clearAll();
    this.emitter.glow = d.rgb;
    if (silent) return;
    const vol = this.g.settings.data.sfxVolume ?? 0.8;
    if (d.id === 'hell') {
      playHellWarning(vol);
      this.g.renderer.post.flash(0.6, 0, 0.05, 0.35, 0.02);
      this.g.renderer.post.aberrate(0.02);
      this.g.camera.addTrauma(0.35);
    } else playUiTick(vol);
  }

  update() {
    const g = this.g, inp = g.input, n = DIFFICULTIES.length;
    this.t++;
    if (inp.pressed('up')) this._select((this.index + n - 1) % n);
    if (inp.pressed('down')) this._select((this.index + 1) % n);
    if (inp.pressed('confirm')) {
      const d = DIFFICULTIES[this.index];
      g.difficultyId = d.id;
      g.settings.set('difficulty', d.id);
      playConfirm(g.settings.data.sfxVolume ?? 0.8);
      g.renderer.post.flash(...d.rgb, 0.4, 0.04);
      g.setScene(new PilotSelectScene());
      return;
    }
    handleDevKeys(g);

    // Live preview: spiral + aimed-down fan + slow heavy ring.
    const w = this.world, e = this.emitter;
    if (this.t % 6 === 0) P.spiral(w, e, SPEC.spiral);
    if (this.t % 45 === 0) P.fan(w, e.x, e.y, Math.PI / 2, SPEC.fan);
    if (this.t % 80 === 40) P.ring(w, e.x, e.y, SPEC.ring, this.t * 0.05);

    g.renderer.background.update();
    this.parallax.update();
    w.update();
  }

  render(r, alpha) {
    const b = r.batch;
    this.parallax.render(b, alpha, this.g.time);
    this.world.renderMid(b, alpha);
    this.world.renderTop(b, alpha);
  }
}
