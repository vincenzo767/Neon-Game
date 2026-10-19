import { WORLD_W } from '../core/constants.js';
import { World } from '../entities/World.js';
import { Parallax } from '../fx/Parallax.js';
import { ROSTER, getRoster, LEGENDARY_INDEX } from '../pilots/index.js';
import { unlock } from '../pilots/unlocks.js';
import { playChoir, playUiTick, playConfirm, playBack } from '../audio/sting.js';
import { music } from '../audio/music.js';
import { BIOMES } from '../stages/biomes.js';
import { drawPortrait } from '../ui/portraits.js';
import { handleDevKeys } from './devKeys.js';
import { TestRangeScene } from './TestRangeScene.js';
import { StageScene } from './StageScene.js';
import { PracticeScene } from './PracticeScene.js';
import { BOSSES } from '../bosses/index.js';
import { DifficultySelectScene } from './DifficultySelectScene.js';
import { getDifficulty } from '../core/difficulty.js';
import { pilotLore } from '../data/lore/pilots.js';
import { pilotArt } from '../core/pilotArt.js';
import { factionById } from '../data/factions/index.js';
import '../ui/pilotArt.css';

// Pilot select: 27-slot roster grid (9×3; the Legendary tile is the same size
// as the others, with its gold border), animated portrait, stat bars, and a
// live WebGL vehicle preview that cycles through all four power tiers and both
// fire modes. Bio, personnel file and abilities live in the info panel, opened
// by the "?" button under the stats (click, or the bomb key / pad button).

const COLS = 9; // pilots per row
const ROWS = Math.ceil(ROSTER.length / COLS);
const L = LEGENDARY_INDEX;
const STAT_KEYS = [['speed', 'SPEED'], ['power', 'POWER'], ['range', 'RANGE'], ['bomb', 'BOMB']];
const PREVIEW_Y = 588;
const TIER_STEPS = 150;

export const rosterIndexOf = (def) => Math.max(0, ROSTER.indexOf(def));

export class PilotSelectScene {
  constructor(opts = {}) {
    this.index = opts.index ?? 0;
    this.infoOpen = false; // info panel (bio, file, abilities)
    this.practice = opts.practice || null; // M7b: {id, mk} when launched from practice select
  }

  enter(g) {
    this.g = g;
    music.menu(); // M6: the Precinct theme under every menu
    this.world = new World(g);
    g.renderer.background.setBiome(BIOMES[0].bg);
    this.parallax = new Parallax(g, BIOMES[0]);
    this.t = 0;
    this.demoT = 0;
    this._buildDom();
    if (this.practice) {
      const b = BOSSES[this.practice.id];
      g.hud.querySelector('.select').insertAdjacentHTML('beforeend', `<div class="sel-practice">PRACTICE · ${b.name} MK.${'I'.repeat(this.practice.mk)}</div>`);
    }
    this._spawnTargets();
    this._select(this.index);
  }

  exit() {
    this.g.hud.innerHTML = '';
  }

  _buildDom() {
    const diff = getDifficulty(this.g.difficultyId);
    this.roster = getRoster();
    const tiles = this.roster.map((p, i) => (i === L
      ? `<div class="sel-tile legendary" data-i="${i}" style="--pc:${p.css}">
          <canvas width="60" height="75"></canvas><b class="leg-badge">LEGENDARY</b>${'<i class="leg-spark"></i>'.repeat(6)}
        </div>`
      : `<div class="sel-tile ${p.locked ? 'locked' : ''}" data-i="${i}" style="--pc:${p.css || '#555'}">
          <canvas width="60" height="75"></canvas>
        </div>`)).join('');
    this.g.hud.innerHTML = `
      <div class="select">
        <div class="sel-title">SELECT PILOT<span>NEON PRECINCT · RAPID RESPONSE DIVISION</span></div>
        <div class="sel-diff" style="--dc:${diff.color}">${diff.name} · SCORE ×${diff.scoreMul.toFixed(1)}</div>
        <div class="sel-grid">${tiles}</div>
        <div class="sel-main">
          <div class="sel-portrait"><canvas width="240" height="300"></canvas></div>
          <div class="sel-info">
            <div class="sel-name"></div>
            <div class="sel-vehicle"></div>
            <div class="sel-stats"></div>
            <button class="sel-info-btn" type="button" aria-label="Pilot info"><i>?</i><span>INFO <b>X</b></span></button>
          </div>
          <div class="sel-mecha"><img alt=""></div>
        </div>
        <div class="sel-panel">
          <button class="sel-panel-close" type="button" aria-label="Close">×</button>
          <div class="sel-panel-head"></div>
          <div class="sel-bio"></div>
          <div class="sel-abilities"></div>
          <div class="sel-panel-hint"><b>X</b> / <b>ESC</b> close · <b>←→↑↓</b> browse pilots</div>
        </div>
        <div class="sel-tier"></div>
        <div class="sel-hint"><b>←→↑↓</b> choose · <b>Z / ENTER</b> launch · <b>X</b> info · <b>C</b> test range · <b>ESC</b> difficulty<br>SEED <b>${this.g.seed}</b></div>
      </div>`;
    const root = this.g.hud;
    this.el = {
      tiles: [...root.querySelectorAll('.sel-tile')],
      portrait: root.querySelector('.sel-portrait canvas'),
      name: root.querySelector('.sel-name'),
      vehicle: root.querySelector('.sel-vehicle'),
      stats: root.querySelector('.sel-stats'),
      bio: root.querySelector('.sel-bio'),
      abil: root.querySelector('.sel-abilities'),
      tier: root.querySelector('.sel-tier'),
      main: root.querySelector('.sel-main'),
      mecha: root.querySelector('.sel-mecha'),
      panel: root.querySelector('.sel-panel'),
      panelHead: root.querySelector('.sel-panel-head'),
    };
    // The HUD ignores the pointer; these two buttons opt back in (ui.css).
    root.querySelector('.sel-info-btn').addEventListener('click', () => this._toggleInfo());
    root.querySelector('.sel-panel-close').addEventListener('click', () => this._toggleInfo(false));
    this.el.tiles.forEach((t, i) => drawPortrait(t.querySelector('canvas'), this.roster[i], 0.5));
  }

  /** Show / hide the info panel (bio, personnel file, abilities). */
  _toggleInfo(open = !this.infoOpen) {
    if (open === this.infoOpen) return;
    this.infoOpen = open;
    this.el.panel.classList.toggle('open', open);
    if (open) playUiTick(this.g.settings.data.sfxVolume ?? 0.8);
    else playBack();
  }

  /** Grid navigation: 9×3 tiles, wrapping at the edges. */
  _move(dx, dy) {
    const i = this.index;
    const row = Math.floor(i / COLS), col = i % COLS;
    if (dy) return ((row + dy + ROWS) % ROWS) * COLS + col;
    return row * COLS + ((col + dx + COLS) % COLS);
  }

  /** Two indestructible practice targets so homing / flak can be seen. */
  _spawnTargets() {
    const f = this.g.renderer.frame('drone');
    for (const x of [120, WORLD_W - 120]) {
      this.world.spawnEnemy({
        kind: 'target', x, y: 470, r: 14, hp: 1e9, f, blast: 0, score: 0, ult: 0,
        ai: (e) => { e.x = x + Math.sin(e.t * 0.02 + x) * 30; },
      });
    }
  }

  _select(i) {
    const prev = this.index;
    this.index = i;
    const p = this.roster[i];
    const el = this.el;
    el.tiles.forEach((t, k) => t.classList.toggle('sel', k === i));
    el.main.style.setProperty('--pc', p.css || '#ff3f7a');
    const root = this.g.hud.querySelector('.select');
    root.style.setProperty('--pc', p.css || '#ff3f7a');
    root.classList.toggle('legendary', !!p.legendary);
    // Legendary sting: a synthesized choir chord (UPDATE_01 §2.7).
    if (p.legendary && prev !== i && this.t > 0) playChoir(this.g.settings.data.sfxVolume ?? 0.8);
    else if (prev !== i && this.t > 0) playUiTick(this.g.settings.data.sfxVolume ?? 0.8);
    el.name.textContent = p.locked ? 'CLASSIFIED' : p.name;
    el.vehicle.textContent = p.locked ? `${p.vehicle} · ${p.unlockHint || 'CLASSIFIED'}` : `${p.vehicle} — ${p.role}`;
    el.stats.innerHTML = STAT_KEYS.map(([k, label]) => {
      const v = p.locked ? 0 : p.stats[k];
      return `<div class="stat"><label>${label}</label><div class="pips">${[1, 2, 3, 4, 5]
        .map((n) => `<i class="${n <= v ? 'on' : ''}" style="animation-delay:${n * 40}ms"></i>`).join('')}</div></div>`;
    }).join('');
    // Hand-made art: the front view as the vehicle preview (slow bob, thruster glow).
    const art = !p.locked && pilotArt(p.id);
    el.mecha.classList.toggle('show', !!(art && art.images.front));
    if (art && art.images.front) el.mecha.querySelector('img').src = art.images.front.src;
    el.mecha.style.setProperty('--mscale', (!p.locked && p.previewScale) || 1); // opt-in: a tall, narrow front view drawn bigger
    // Info panel: bio, then the precinct personnel file from the lore data (Update 02), then abilities.
    el.panelHead.innerHTML = p.locked ? 'CLASSIFIED' : `${p.name}<small>${p.vehicle} — ${p.role}${p.legendary ? ' · LEGENDARY' : ''}</small>`;
    el.bio.textContent = p.locked ? 'Personnel file sealed by order of the Commissioner.' : p.bio;
    const lore = !p.locked && pilotLore(p.id);
    if (lore) {
      const rival = factionById(lore.rival);
      el.bio.insertAdjacentHTML('beforeend', `<span class="sel-lore">FILE · ${lore.origin.toUpperCase()}${rival ? ` · SWORN AGAINST ${rival.short}` : ''} — ${lore.file}</span>`);
    }
    el.abil.innerHTML = p.locked ? '' : `
      <div><b>SHOT</b> ${p.weapons.main}</div>
      <div><b>FOCUS</b> ${p.weapons.focus}</div>
      <div><b>SPECIAL</b> ${p.special.name} — ${p.special.desc}</div>
      <div><b>BOMB</b> ${p.bomb.name} ×${p.bombStock}</div>
      <div><b>ULTIMATE</b> ${p.ultimate.name}</div>`;

    // Restart the stat-pip fill animation.
    el.stats.classList.remove('anim'); void el.stats.offsetWidth; el.stats.classList.add('anim');

    const w = this.world;
    w.bullets.clearAll();
    w.shots.clearAll();
    if (p.locked) {
      if (w.player) w.player.def.reset?.(w.player, w);
      w.player = null;
    } else {
      const pl = w.setPlayer(p, { demo: true });
      pl.x = pl.px = WORLD_W / 2;
      pl.y = pl.py = PREVIEW_Y;
    }
    this.demoT = 0;
  }

  update() {
    const g = this.g, inp = g.input;
    this.t++;
    let i = this.index;
    if (inp.pressed('left')) i = this._move(-1, 0);
    if (inp.pressed('right')) i = this._move(1, 0);
    if (inp.pressed('up')) i = this._move(0, -1);
    if (inp.pressed('down')) i = this._move(0, 1);
    if (i !== this.index) this._select(i);

    if (inp.pressed('bomb')) this._toggleInfo();
    if (inp.pressed('back') && this.infoOpen) { this._toggleInfo(false); return; }
    if (inp.pressed('back')) {
      playBack();
      if (this.practice) import('./PracticeSelectScene.js').then(({ PracticeSelectScene }) => g.setScene(new PracticeSelectScene({ id: this.practice.id })));
      else g.setScene(new DifficultySelectScene());
      return;
    }
    // Dev only: U unseals Warden without beating a boss.
    if (import.meta.env.DEV && inp.keyPressed('KeyU')) { unlock('warden'); g.setScene(new PilotSelectScene({ index: this.index })); return; }
    const launch = inp.pressed('confirm'), test = inp.pressed('special');
    if (launch || test) {
      const p = this.roster[this.index];
      if (p.locked) {
        playBack();
        this.el.name.classList.remove('deny'); void this.el.name.offsetWidth; this.el.name.classList.add('deny');
      } else {
        g.renderer.post.flash(...p.color, 0.5, 0.04);
        playConfirm();
        if (!launch) g.setScene(new TestRangeScene(p));
        else g.setScene(this.practice ? new PracticeScene(p, this.practice) : new StageScene(p));
        return;
      }
    }
    handleDevKeys(g);

    // Demo preview: cycle tiers and fire modes.
    const pl = this.world.player;
    if (pl) {
      this.demoT++;
      const tier = Math.floor(this.demoT / TIER_STEPS) % 4;
      pl.power = tier * 100;
      pl.demoFocus = Math.floor(this.demoT / (TIER_STEPS * 4)) % 2 === 1;
      pl.y = PREVIEW_Y;
      const label = `${pl.demoFocus ? 'FOCUS' : 'SHOT'} · TIER ${tier + 1}`;
      if (this.el.tier.textContent !== label) this.el.tier.textContent = label;
    } else if (this.el.tier.textContent) this.el.tier.textContent = '';

    if (this.t % 2 === 0) drawPortrait(this.el.portrait, this.roster[this.index], g.time);
    if (this.t % 3 === 0) drawPortrait(this.el.tiles[L].querySelector('canvas'), this.roster[L], g.time);

    g.renderer.background.update();
    this.parallax.update();
    this.world.update();
  }

  render(r, alpha) {
    const b = r.batch;
    this.parallax.render(b, alpha, this.g.time);
    this.world.renderMid(b, alpha);
    this.world.renderTop(b, alpha);
  }
}
