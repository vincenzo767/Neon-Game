import './style.css';
import './ui/ui.css';
import './ui/stage.css';
import './ui/difficulty.css';
import './ui/boss.css';
import { Game } from './core/Game.js';
import { TitleScene } from './scenes/TitleScene.js';
import { spawnEnemy, ENEMIES } from './entities/enemies/index.js';
import { generateStage } from './stages/StageGen.js';
import { BIOMES } from './stages/biomes.js';
import { BOSSES, bossForStage, archetypeDeck } from './bosses/index.js';
import { dmgFlags } from './core/damage.js';
import { attachAudio } from './audio/engine.js';
import { loadPilotArt } from './core/pilotArt.js';
import { worldSystem } from './world/index.js';

async function boot() {
  // Hand-made pilot art must be in memory before the atlas is built (never throws).
  await loadPilotArt();
  const stage = document.getElementById('stage');
  try {
    const game = new Game({
      canvas: document.getElementById('game'),
      stage,
      hud: document.getElementById('hud'),
      debug: document.getElementById('debug'),
    });
    attachAudio(game.settings); // M6: mixer volumes + unlock on the first key press
    // Shareable runs: ?seed=ABCD1234 replays the same stage sequence.
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) game.seed = seed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || game.seed;
    // Art test (ART_PIPELINE.md): ?test=<id> opens that pilot's art test range directly.
    const testId = new URLSearchParams(location.search).get('test');
    const [{ PilotArtTestScene }, { PILOTS }] = testId ? await Promise.all([import('./scenes/PilotArtTestScene.js'), import('./pilots/index.js')]) : [{}, {}];
    const testDef = testId && PILOTS.find((d) => d.id === testId && d.art);
    // Arena rework: the world system boots now so the material library is ready long before a boss.
    worldSystem(game);
    const arenaId = new URLSearchParams(location.search).get('arena');
    if (arenaId) {
      const { ArenaPreviewScene } = await import('./scenes/ArenaPreviewScene.js');
      game.setScene(new ArenaPreviewScene(arenaId));
    } else if (testDef) game.setScene(new PilotArtTestScene(testDef));
    else game.setScene(new TitleScene()); // M7b: title → attract → difficulty → pilot select
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
