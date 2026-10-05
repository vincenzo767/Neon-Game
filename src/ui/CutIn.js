import { drawPortrait } from './portraits.js';

// Ultimate cut-in: a diagonal band slams across the screen with the pilot's
// portrait and the attack name while the scene holds a hit-stop freeze.
// Pure DOM/CSS animation (see .cutin in style.css).

export const CUTIN_STEPS = 48; // simulation freeze length that matches the animation

export function showCutIn(root, def) {
  const el = document.createElement('div');
  el.className = 'cutin';
  el.style.setProperty('--pc', def.css);
  el.innerHTML = `
    <div class="cutin-band">
      <canvas width="240" height="300"></canvas>
      <div class="cutin-text">
        <small>${def.name} · ${def.vehicle}</small>
        <b>${def.ultimate.name}</b>
      </div>
    </div>
    <div class="cutin-flash"></div>`;
  root.appendChild(el);
  const canvas = el.querySelector('canvas');
  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    drawPortrait(canvas, def, (performance.now() - t0) / 1000 + 1);
    raf = requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, 1300);
}
