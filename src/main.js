import './style.css';
import { Game } from './core/Game.js';
import { SandboxScene } from './scenes/SandboxScene.js';

function boot() {
  const stage = document.getElementById('stage');
  try {
    const game = new Game({
      canvas: document.getElementById('game'),
      stage,
      hud: document.getElementById('hud'),
      debug: document.getElementById('debug'),
    });
    game.setScene(new SandboxScene());
    game.start();
    // Exposed for console debugging only.
    window.__npo = game;
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<div class="fatal"><b>NEON PRECINCT failed to start.</b><br>${String(err.message || err)}</div>`;
  }
}

boot();
