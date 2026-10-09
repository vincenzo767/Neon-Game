// Audio director (M6): the one place gameplay meets audio.
//
// It listens to the world events the game already emits (kills, items,
// bombs, boss phases…) and, once per simulation step, reads a few counters
// (player shots fired, graze total, bullet count, telegraphed lasers) instead
// of asking gameplay code to call audio. Pilots, enemies and bosses stay
// audio-agnostic; the only additive hooks are World.shotsFired and an 'sfx'
// event for one-off pilot moments (Vincenzo's Trumpet).
//
// It also derives the music intensity (0-4) from bullet density and enemy
// count, held for a few seconds so the arrangement doesn't flap.

import { WORLD_W } from '../core/constants.js';
import { sfx } from './sfx.js';
import { music } from './music.js';
import { muffle, duck, audioReady, stats } from './engine.js';
import { STYLES, LAYER_STYLE, FACTION_STYLE } from './themes.js';
import { CUTIN_STEPS } from '../ui/CutIn.js';
import { factionForArchetype } from '../data/factions/index.js';

const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x / WORLD_W - 0.5) * 1.6));
const BEAT = 28; // Cass's beat clock (pilots/cass.js)

export class AudioDirector {
  constructor(scene) {
    this.scene = scene;
    this.w = scene.world;
    this.shots = 0;
    this.graze = 0;
    this.grazeHeat = 0;
    this.bullets = 0;
    this.lasers = 0;
    this.heat = 0;           // smoothed intensity 0..1
    this.level = 0;
    this.isPaused = false;
  }

  /** After the scene's setup: the stage scene picks its faction track itself. */
  start() {
    this.shots = this.w.shotsFired || 0;
    this.graze = this.w.graze;
    if (music.mode !== 'stage') music.setStage(null);
  }

  exit() {
    sfx.beam(false);
    if (this.isPaused) muffle(false);
  }

  paused(on) {
    if (on === this.isPaused) return;
    this.isPaused = on;
    muffle(on);
    if (on) sfx.beam(false);
  }

  // ------------------------------------------------------------- per step

  update() {
    if (!audioReady()) return;
    const w = this.w, p = w.player;

    // Player weapon: one voice per volley, at the pilot's cadence.
    const fired = w.shotsFired || 0;
    if (fired > this.shots && p && p.state === 'alive') {
      sfx.shot(p.def, { focus: p.focus, tier: p.tier, pan: panOf(p.x) * 0.5, p });
    }
    this.shots = fired;
    if (p && p.def.id === 'cass' && p.firing && p.state === 'alive' && p.t % BEAT === 0) sfx.play('bassDrop', { pan: panOf(p.x) });

    // Beams (focus lances, Zuri's growing beam…): a sustained hum.
    let beam = 0;
    if (p && p.firing && p.state === 'alive' && !p.bombT && !p.ultT) for (const b of w.beams) beam = Math.max(beam, b.w);
    sfx.beam(beam > 0, 70 + Math.min(60, beam) * 2.5);

    // Graze: a tick per new graze; pitch climbs with the streak.
    const gz = w.graze;
    if (gz > this.graze) {
      this.grazeHeat = Math.min(1, this.grazeHeat + 0.06 * (gz - this.graze));
      sfx.play('graze', { streak: this.grazeHeat, pan: p ? panOf(p.x) : 0 });
    }
    this.graze = gz;
    this.grazeHeat *= 0.985;

    // Enemy volleys: a soft tick when many bullets appear at once.
    const B = w.bullets.count;
    if (B - this.bullets >= 4) sfx.play('enemyShot', { pan: 0 });
    this.bullets = B;

    // Laser telegraphs: a charge whine for each new one.
    const L = w.lasers.length;
    if (L > this.lasers) { const l = w.lasers[L - 1]; sfx.play('laser', { pan: l && l.x !== undefined ? panOf(l.x) : 0 }); }
    this.lasers = L;

    // Hitting the boss: a dry tick so damage is felt.
    const boss = w.boss;
    if (boss && boss.alive && boss.flash === 2) sfx.play('bossTick', { pan: panOf(boss.x) });

    // Music intensity from danger on screen (rise fast, fall slow).
    const raw = Math.min(1, B / 420) * 0.7 + Math.min(1, w.enemies.count / 14) * 0.3;
    this.heat = raw > this.heat ? this.heat + (raw - this.heat) * 0.08 : Math.max(raw, this.heat - 0.0012);
    const lv = this.heat < 0.06 ? 0 : this.heat < 0.2 ? 1 : this.heat < 0.38 ? 2 : this.heat < 0.62 ? 3 : 4;
    if (lv !== this.level) { this.level = lv; music.setIntensity(lv); }
    stats.intensity = this.heat;
  }

  /** Debug overlay line. */
  info() {
    if (!audioReady()) return 'locked (press a key)';
    return `${music.info()} · int ${this.heat.toFixed(2)} · voices ${stats.voices} · dropped ${stats.dropped}`;
  }

  // --------------------------------------------------------------- events

  onEvent(type, data) {
    switch (type) {
      case 'kill': {
        const e = data;
        if (e.boss || e.ctrl || e.kind === 'bosspart') break;
        const hp = e.maxHp || 1;
        const size = e.big ? 3 : hp <= 8 ? 0 : hp <= 40 ? 1 : hp <= 160 ? 2 : 3;
        sfx.play(`explode${size}`, { pan: panOf(e.x) });
        break;
      }
      case 'item':
        if (data === 'P') sfx.play('power');
        else if (data === 'B') sfx.play('bombItem');
        else if (data === 'S') sfx.play('speedItem');
        break;
      case 'medal': sfx.play('medal', { level: Math.min(1, Math.log10(Math.max(100, data) / 100) / 2) }); break;
      case 'extend': sfx.play('extend'); break;
      case 'medalBreak': sfx.play('medalBreak'); break;
      case 'bossNoBomb': sfx.play('bonus'); break;
      case 'tier': sfx.play('tier', { level: data }); break;
      case 'ultReady': sfx.play('ultReady'); break;
      case 'notReady': sfx.play('notReady'); break;
      case 'special': sfx.special(this.w.player.def); break;
      case 'brace': sfx.play('partDown', { pan: 0 }); break;
      case 'bomb': {
        const def = this.w.player.def;
        sfx.bomb(def, (def.bomb.duration || 60) / 60);
        break;
      }
      case 'ultimate': {
        const def = data;
        sfx.ultimate(def, (def.ultimate.cutin || CUTIN_STEPS) / 60, (def.ultimate.duration || 300) / 60);
        break;
      }
      case 'cutin': {
        const d = (data.steps || CUTIN_STEPS) / 60;
        sfx.play('cutin', { delay: d });
        duck(d + 0.8, { music: 0.2, underwater: true, attack: 0.15 });
        break;
      }
      case 'hit': sfx.play('playerHit'); break;
      case 'death': sfx.play('playerDeath'); break;
      case 'gameover':
        sfx.play('playerDeath');
        music.stinger('gameover');
        break;
      case 'sfx': sfx.play(data.id || data, data); break;

      // ---- stage flow
      case 'stageIntro': sfx.play('stageIntro'); break;
      case 'warning':
        if (data.boss) { sfx.play('warningBoss'); music.breakdown(2); } else sfx.play('warningMid');
        break;
      case 'bossIntro': {
        const e = data, c = e.ctrl;
        const style = c ? STYLES[LAYER_STYLE_OF(c)] : STYLES[music.deck ? music.deck.styleId : 'precinct'];
        sfx.play('bossIntro', { root: (style ? style.root : 40) + 12 });
        if (!c) music.setFloor(3); // mid-boss: keep the full groove in
        break;
      }
      case 'bossDown':
        if (!data.e.ctrl) { sfx.play('explode3', { pan: panOf(data.e.x) }); music.setFloor(0); }
        break;
      case 'bossEscape': music.setFloor(0); break;
      case 'bossArena': sfx.play('arenaShift', { dur: (data.dur || 96) / 60 }); break;
      case 'bossPhaseClear': sfx.play('phaseClear'); break;
      case 'bossDefeated': sfx.play('bossDeath'); music.breakdown(4); break;
      case 'bossPartDown': sfx.play('partDown', { pan: 0 }); break;
      case 'tally': music.stinger('clear'); break;
    }
  }
}

/** Style of an arena boss's faction (falls back through the layer prefixes). */
function LAYER_STYLE_OF(ctrl) {
  const fac = factionForArchetype(ctrl.archetype);
  return (fac && FACTION_STYLE[fac.id]) || LAYER_STYLE[ctrl.archetype] || 'precinct';
}
