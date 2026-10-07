import { World } from '../entities/World.js';
import { Parallax } from '../fx/Parallax.js';
import { Hud, saveHiScore, hiScoreId } from '../ui/Hud.js';
import { showCutIn, CUTIN_STEPS } from '../ui/CutIn.js';
import { handleDevKeys } from './devKeys.js';
import { getDifficulty, startingReserve, startingBombs } from '../core/difficulty.js';
import { AudioDirector } from '../audio/director.js';
import { playUiTick } from '../audio/sting.js';

// Base class for in-game scenes: owns the World, parallax, HUD, banners,
// pause menu and game-over / continue flow, plus the common render order.
// Subclasses implement: setup(), tick(), restartScene(), and optionally
// onSceneEvent(type, data) and menuHint.

const CONTINUE_SECONDS = 10;

export class PlayScene {
  constructor(def) { this.def = def; }

  enter(g) {
    this.g = g;
    this.world = new World(g);
    // Difficulty (chosen on the difficulty select screen) sets lives, bombs and score rate.
    const cfg = (this.diffCfg = getDifficulty(g.difficultyId));
    this.world.scoreMul = cfg.scoreMul;
    this.world.setPlayer(this.def, { lives: startingReserve(cfg), bombStock: startingBombs(cfg, this.def) });
    this.world.onEvent = (type, data) => this.onEvent(type, data);
    this.audio = new AudioDirector(this); // M6: sfx + adaptive music
    this.parallax = new Parallax(g, null);
    this.paused = false;
    this.gameOver = false;
    this.continues = 0;
    this.menuIndex = 0;
    this.menuItems = [];
    g.hud.innerHTML = `
      <div class="hud-banner" id="banner"></div>
      <div id="fxlayer"></div>
      <div class="overlay" id="overlay"></div>
      <div class="hud-hint dim"><b>Z</b> shot · <b>SHIFT</b> focus · <b>X</b> bomb · <b>C</b> special · <b>V</b> ultimate · <b>ESC</b> pause</div>`;
    this.bannerEl = g.hud.querySelector('#banner');
    this.overlayEl = g.hud.querySelector('#overlay');
    this.fxLayer = g.hud.querySelector('#fxlayer');
    this.hud = new Hud(g.hud, this.world, cfg);
    this.bannerT = 0;
    this.setup();
    this.audio.start();
  }

  exit() {
    this._saveHi();
    this.audio.exit();
    const p = this.world.player;
    if (p && p.def.reset) p.def.reset(p, this.world);
    this.g.renderer.background.onLightning = null;
    this.g.hud.innerHTML = '';
  }

  /** Hi-scores are kept per difficulty; unranked scenes (test range) don't save. */
  _saveHi() { if (this.ranked !== false) saveHiScore(this.world.score, hiScoreId(this.diffCfg, this.def)); }

  // ------------------------------------------------------------- overlays

  banner(title, sub = '', steps = 90, cls = '') {
    this.bannerEl.className = `hud-banner show ${cls}`;
    this.bannerEl.innerHTML = `${title}<small>${sub}</small>`;
    this.bannerT = steps;
  }

  _renderMenu(title, items, extra = '') {
    this.menuItems = items;
    this.overlayEl.innerHTML = `<div class="menu"><h2>${title}</h2>${extra}${items
      .map((it, i) => `<div class="menu-item ${i === this.menuIndex ? 'sel' : ''}">${it}</div>`)
      .join('')}</div>`;
    this.overlayEl.classList.add('show');
  }

  _hideOverlay() {
    this.overlayEl.classList.remove('show');
    this.overlayEl.innerHTML = '';
  }

  _menuNav() {
    const inp = this.g.input, n = this.menuItems.length;
    if (!n) return;
    if (inp.pressed('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
    if (inp.pressed('down')) this.menuIndex = (this.menuIndex + 1) % n;
  }

  pilotSelect() {
    // Lazy import breaks the PilotSelect <-> PlayScene module cycle.
    import('./PilotSelectScene.js').then(({ PilotSelectScene, rosterIndexOf }) => {
      this.g.setScene(new PilotSelectScene({ index: rosterIndexOf(this.def) }));
    });
    this.leaving = true;
  }

  // --------------------------------------------------------------- events

  onEvent(type, data) {
    const hud = this.hud;
    this.audio.onEvent(type, data);
    switch (type) {
      case 'ultimate': {
        const steps = data.ultimate.cutin || CUTIN_STEPS; // M5: pilots may lengthen the cinematic
        showCutIn(this.g.hud, data, { steps });
        this.g.hitStop(steps);
        this.g.renderer.post.flash(...data.color, 0.3, 0.02);
        break;
      }
      // M5: other pilot cinematics (Vincenzo's Void Mecha transformation).
      case 'cutin':
        showCutIn(this.g.hud, data.def, data);
        this.g.hitStop(data.steps || CUTIN_STEPS);
        this.g.renderer.post.flash(...data.def.color, 0.3, 0.02);
        break;
      // M5: short pilot messages (hopper swaps, hacks, combos).
      case 'toast': hud?.toast(data.text, data.cls || ''); break;
      case 'bomb': hud?.toast(data.counter ? `COUNTER BOMB! ${data.name}` : data.name, data.counter ? 'gold' : ''); break;
      case 'special': hud?.toast(data, 'pc'); break;
      case 'tier': hud?.toast(data >= 4 ? 'POWER MAX!' : `POWER UP · TIER ${data}`, 'gold'); break;
      case 'ultReady': hud?.toast('ULTIMATE READY — PRESS V', 'pc'); break;
      case 'extend': hud?.toast('EXTEND! 1UP', 'gold'); break;
      case 'speed': hud?.toast(`SPEED TUNE ${data}/3`); break;
      case 'brace': hud?.toast('BRACE HELD!', 'gold'); break;
      case 'death': hud?.toast('PILOT DOWN', 'red'); break;
      case 'gameover':
        this.gameOver = true;
        this.continueT = CONTINUE_SECONDS * 60;
        this.menuIndex = 0;
        this.menuItems = ['CONTINUE', 'PILOT SELECT'];
        this._saveHi();
        break;
      default:
        if (this.onSceneEvent) this.onSceneEvent(type, data);
    }
  }

  // --------------------------------------------------------------- update

  update() {
    const g = this.g, inp = g.input, w = this.world;
    if (this.leaving) return;

    if (this.gameOver) {
      this._menuNav();
      const secs = Math.ceil(this.continueT / 60);
      this._renderMenu('GAME OVER', ['CONTINUE', 'PILOT SELECT'],
        `<div class="menu-sub">CONTINUE? <b>${secs}</b><br>SCORE ${w.score.toLocaleString('en-US')}</div>`);
      if (inp.pressed('confirm')) {
        if (this.menuIndex === 0) {
          this.gameOver = false;
          this.continues++;
          w.setScoreRaw(this.continues); // arcade convention: score resets, last digit counts continues
          w.player.continueGame();
          this._hideOverlay();
        } else this.pilotSelect();
        return;
      }
      if (--this.continueT <= 0) { this.pilotSelect(); return; }
      this._idle();
      return;
    }

    if (this.paused) {
      this.audio.paused(true);
      const prevIndex = this.menuIndex;
      this._menuNav();
      if (this.menuIndex !== prevIndex) playUiTick();
      // M6: MUSIC / SFX volume rows (left / right in 10 % steps).
      const vols = [['musicVolume', 'MUSIC'], ['sfxVolume', 'SFX']];
      const vrow = vols[this.menuIndex - 3];
      if (vrow) {
        const dir = (inp.pressed('right') ? 1 : 0) - (inp.pressed('left') ? 1 : 0);
        if (dir) {
          const v = Math.round(Math.max(0, Math.min(1, (g.settings.get(vrow[0]) ?? 0.7) + dir * 0.1)) * 10) / 10;
          g.settings.set(vrow[0], v);
          playUiTick();
        }
      }
      const volItems = vols.map(([k, label]) => {
        const v = g.settings.get(k) ?? 0.7, n = Math.round(v * 10);
        return `${label} <span class="vol">◀ ${'▮'.repeat(n)}${'▯'.repeat(10 - n)} ${Math.round(v * 100)}% ▶</span>`;
      });
      this._renderMenu('PAUSED', ['RESUME', 'RESTART', 'PILOT SELECT', ...volItems], this.menuHint || '');
      if (inp.pressed('pause')) { this.paused = false; this._hideOverlay(); return; }
      if (inp.pressed('confirm') && !vrow) {
        this.paused = false;
        this._hideOverlay();
        if (this.menuIndex === 1) this.restartScene();
        else if (this.menuIndex === 2) this.pilotSelect();
      }
      return;
    }
    if (inp.pressed('pause') && !this.blockPause) {
      this.paused = true;
      this.menuIndex = 0;
      return;
    }

    const dev = handleDevKeys(g);
    if (dev) this.banner(dev[0], dev[1], 60);
    if (this.bannerT > 0 && --this.bannerT === 0) this.bannerEl.classList.remove('show');

    g.renderer.background.update();
    this.parallax.update();
    this.tick();
    w.update();
    this.hud.update();
    this.audio.paused(false);
    this.audio.update();

    const dbg = g.debug;
    dbg.set('bullets', `${w.bullets.count}  shots ${w.shots.count}  lasers ${w.lasers.length}`);
    dbg.set('audio', this.audio.info());
    dbg.set('particles', `${w.fxLow.count + w.fxHigh.count}`);
    dbg.set('enemies', `${w.enemies.count}  items ${w.items.count}`);
  }

  /** Keep the background alive behind full-screen menus. */
  _idle() {
    this.g.renderer.background.update();
    this.parallax.update();
    this.world.fxLow.update();
    this.world.fxHigh.update();
  }

  render(r, alpha) {
    const b = r.batch, w = this.world, t = this.g.time;
    if (this.paused || this.gameOver) alpha = 1;
    this.parallax.renderBack(b, alpha, t);
    w.renderGround(b, alpha);
    this.parallax.renderFore(b, alpha, t);
    if (this.renderUnderlay) this.renderUnderlay(b, alpha, t); // boss arena layers (StageScene)
    w.renderMid(b, alpha);
    if (this.renderOverlay) this.renderOverlay(b, alpha, t);
    this.parallax.renderStreaks(b, alpha);
    w.renderTop(b, alpha);
  }
}
