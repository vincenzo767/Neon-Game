import { drawPortrait } from './portraits.js';
import './legendary.css';

// Ultimate cut-in: a diagonal band slams across the screen with the pilot's
// portrait and the attack name while the scene holds a hit-stop freeze.
// Pure DOM/CSS animation (see .cutin in style.css).
//
// M5: optional { title, sub, steps } for other cinematics (Vincenzo's Void
// Mecha transformation, the God's Trumpet's 2 s reveal); the animation is
// stretched to match the freeze. Legendary pilots get the gold band.

export const CUTIN_STEPS = 48; // default simulation freeze that matches the animation
const BASE_MS = 1300;

export function showCutIn(root, def, opts = {}) {
  const steps = opts.steps || CUTIN_STEPS;
  const ms = Math.round(BASE_MS * (steps / CUTIN_STEPS));
  const el = document.createElement('div');
  el.className = `cutin${def.legendary ? ' legendary' : ''}`;
  el.style.setProperty('--pc', def.css);
  el.innerHTML = `
    <div class="cutin-band" style="animation-duration:${ms}ms">
      <canvas width="240" height="300"></canvas>
      <div class="cutin-text">
        <small>${opts.sub || `${def.name} · ${def.vehicle}`}</small>
        <b>${opts.title || def.ultimate.name}</b>
      </div>
    </div>
    <div class="cutin-flash" style="animation-duration:${ms}ms"></div>`;
  root.appendChild(el);
  const canvas = el.querySelector('canvas');
  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    drawPortrait(canvas, def, (performance.now() - t0) / 1000 + 1);
    raf = requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, ms);
}
