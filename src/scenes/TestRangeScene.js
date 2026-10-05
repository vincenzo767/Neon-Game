import { World } from '../entities/World.js';
import { Parallax } from '../fx/Parallax.js';
import { Hud, saveHiScore } from '../ui/Hud.js';
import { showCutIn, CUTIN_STEPS } from '../ui/CutIn.js';
import { TestSpawner, DENSITY } from './testEnemies.js';
import { handleDevKeys } from './devKeys.js';
import { ROSTER } from '../pilots/index.js';
import { PilotSelectScene } from './PilotSelectScene.js';

// M2 TEST RANGE: a playable pilot against placeholder waves. This exercises
// the whole player system (power tiers, bombs, death-bomb window, specials,
// ultimates, items, continues). The real stage flow arrives in M3.

const CONTINUE_SECONDS = 10;

export class TestRangeScene {
  constructor(def) { this.def = def; }

  enter(g) {
    this.g = g;
    this.world = new World(g);
    this.world.density = 1;
    this.world.setPlayer(this.def);
    this.world.onEvent = (type, data) => this._onEvent(type, data);
    this.parallax = new Parallax(g);
    this.spawner = new TestSpawner(this.world);
    this.paused = false;
    this.menuIndex = 0;
    this.gameOver = false;
    this.continues = 0;

    g.hud.innerHTML = `
      <div class="hud-banner" id="banner"></div>
      <div class="overlay" id="overlay"></div>
      <div class="hud-hint dim"><b>Z</b> shot · <b>SHIFT</b> focus · <b>X</b> bomb · <b>C</b> special · <b>V</b> ultimate · <b>ESC</b> pause · <b>1-4</b> density</div>`;
    this.bannerEl = g.hud.querySelector('#banner');
    this.overlayEl = g.hud.querySelector('#overlay');
    this.hud = new Hud(g.hud, this.world);
    this.bannerT = 0;
    this._banner('TEST RANGE', `${this.def.name} · ${this.def.vehicle}`, 140);
  }

  exit() {
    saveHiScore(this.world.score);
    if (this.world.player) this.world.player.def.reset?.(this.world.player, this.world);
    this.g.hud.innerHTML = '';
  }

  _banner(title, sub, steps = 90) {
    this.bannerEl.innerHTML = `${title}<small>${sub}</small>`;
    this.bannerEl.classList.add('show');
    this.bannerT = steps;
  }

  _onEvent(type, data) {
    const hud = this.hud;
    switch (type) {
      case 'ultimate':
        showCutIn(this.g.hud, data);
        this.g.hitStop(CUTIN_STEPS);
        this.g.renderer.post.flash(...data.color, 0.3, 0.02);
        break;
      case 'bomb': hud?.toast(data.counter ? `COUNTER BOMB! ${data.name}` : data.name, data.counter ? 'gold' : ''); break;
      case 'special': hud?.toast(data, 'pc'); break;
      case 'tier': hud?.toast(data >= 4 ? 'POWER MAX!' : `POWER UP · TIER ${data}`, 'gold'); break;
      case 'ultReady': hud?.toast('ULTIMATE READY — PRESS V', 'pc'); break;
      case 'extend': hud?.toast('EXTEND! 1UP', 'gold'); break;
      case 'speed': hud?.toast(`SPEED TUNE ${data}/3`); break;
      case 'brace': hud?.toast('BRACE HELD!', 'gold'); break;
      case 'coreDown': this._banner('CORE DOWN', 'BREAK-APART SEQUENCE', 110); break;
      case 'death': hud?.toast('PILOT DOWN', 'red'); break;
      case 'gameover': this._showGameOver(); break;
    }
  }

  // --------------------------------------------------------------- overlays

  _showPause() {
    this.paused = true;
    this.menuIndex = 0;
    this._renderMenu('PAUSED', ['RESUME', 'RESTART', 'PILOT SELECT']);
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

  _showGameOver() {
    this.gameOver = true;
    this.continueT = CONTINUE_SECONDS * 60;
    this.menuItems = ['CONTINUE', 'PILOT SELECT'];
    this.menuIndex = 0;
    saveHiScore(this.world.score);
  }

  _menuNav() {
    const inp = this.g.input;
    const n = this.menuItems.length;
    if (inp.pressed('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
    if (inp.pressed('down')) this.menuIndex = (this.menuIndex + 1) % n;
  }

  _pilotSelect() {
    const idx = ROSTER.indexOf(this.def);
    this.g.setScene(new PilotSelectScene({ index: Math.max(0, idx) }));
  }

  // ------------------------------------------------------------------ update

  update() {
    const g = this.g, inp = g.input, w = this.world;

    if (this.gameOver) {
      this._menuNav();
      const secs = Math.ceil(this.continueT / 60);
      this._renderMenu('GAME OVER', ['CONTINUE', 'PILOT SELECT'],
        `<div class="menu-sub">CONTINUE? <b>${secs}</b><br>SCORE ${w.score.toLocaleString('en-US')}</div>`);
      if (inp.pressed('confirm')) {
        if (this.menuIndex === 0) {
          this.gameOver = false;
          this.continues++;
          w.score = this.continues; // arcade convention: score resets, last digit counts continues
          w.player.continueGame();
          this._hideOverlay();
        } else this._pilotSelect();
        return;
      }
      if (--this.continueT <= 0) { this._pilotSelect(); return; }
      this._tickWorldIdle();
      return;
    }

    if (this.paused) {
      this._menuNav();
      this._renderMenu('PAUSED', this.menuItems);
      if (inp.pressed('pause')) { this.paused = false; this._hideOverlay(); return; }
      if (inp.pressed('confirm')) {
        this.paused = false;
        this._hideOverlay();
        if (this.menuIndex === 1) { this.exit(); this.enter(g); }
        else if (this.menuIndex === 2) this._pilotSelect();
      }
      return;
    }
    if (inp.pressed('pause')) { this._showPause(); return; }

    for (let k = 0; k < 4; k++) {
      if (inp.keyPressed(`Digit${k + 1}`)) {
        w.density = k;
        this._banner(`DENSITY ${DENSITY[k].label}`, 'BULLET STRESS TEST', 70);
      }
    }
    const dev = handleDevKeys(g);
    if (dev) this._banner(dev[0], dev[1], 60);

    if (this.bannerT > 0 && --this.bannerT === 0) this.bannerEl.classList.remove('show');

    g.renderer.background.update();
    this.parallax.update();
    this.spawner.update();
    w.update();
    this.hud.update();

    const dbg = g.debug;
    dbg.set('bullets', `${w.bullets.count}  shots ${w.shots.count}`);
    dbg.set('particles', `${w.fxLow.count + w.fxHigh.count}`);
    dbg.set('enemies', `${w.enemies.count}  items ${w.items.count}`);
  }

  /** Keep the background alive behind the game-over menu. */
  _tickWorldIdle() {
    this.g.renderer.background.update();
    this.parallax.update();
    this.world.fxLow.update();
    this.world.fxHigh.update();
  }

  render(r, alpha) {
    const b = r.batch, w = this.world;
    if (this.paused) alpha = 1;
    this.parallax.render(b, alpha, this.g.time);
    w.renderMid(b, alpha);
    this.parallax.renderRain(b, alpha);
    w.renderTop(b, alpha);
  }
}
