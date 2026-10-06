import './style.css';
import './ui/ui.css';
import './ui/stage.css';
import './ui/difficulty.css';
import './ui/boss.css';
import { Game } from './core/Game.js';
import { DifficultySelectScene } from './scenes/DifficultySelectScene.js';
import { spawnEnemy, ENEMIES } from './entities/enemies/index.js';
import { generateStage } from './stages/StageGen.js';
import { BIOMES } from './stages/biomes.js';
import { BOSSES, bossForStage, archetypeDeck } from './bosses/index.js';
import { dmgFlags } from './core/damage.js';

function boot() {
  const stage = document.getElementById('stage');
  try {
    const game = new Game({
      canvas: document.getElementById('game'),
      stage,
      hud: document.getElementById('hud'),
      debug: document.getElementById('debug'),
    });
    // Shareable runs: ?seed=ABCD1234 replays the same stage sequence.
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) game.seed = seed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || game.seed;
    game.setScene(new DifficultySelectScene());
    game.start();
    // Exposed for console debugging only.
    window.__npo = game;
    window.__npoDev = { spawnEnemy, ENEMIES, generateStage, BIOMES, BOSSES, bossForStage, archetypeDeck, dmgFlags };
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<div class="fatal"><b>NEON PRECINCT failed to start.</b><br>${String(err.message || err)}</div>`;
  }
}

boot();
