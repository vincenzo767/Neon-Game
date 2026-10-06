import './faction.css';
import { emblemURL } from './emblems.js';
import { loopLine } from '../data/lore/world.js';

// Stage intro card (UPDATE_02 §2.8): faction emblem, faction name, territory
// and a one-line Precinct dispatch briefing. At the start of loop 2+ the card
// also carries the loop story line (§1.5). Pure DOM in the scene's fx layer;
// it never blocks input or the simulation.

const SHOW_MS = 3600;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param layer  scene fx layer element
 * @param plan   generated stage plan
 * @param fac    stageFactions(plan) result
 */
export function showFactionCard(layer, plan, fac) {
  const f = fac.main, p = f.palette;
  const el = document.createElement('div');
  el.className = 'faction-card';
  el.style.setProperty('--fc', p.glow);
  el.style.setProperty('--fa', p.accent);
  const loop = plan.stageInLoop === 0
    ? `<div class="fc-loop"><b>LOOP ${plan.loop}</b><span>“${esc(loopLine(plan.loop))}”</span>${plan.loop > 1 ? '<i>DENSITY UP · ELITES DEPLOYED</i>' : ''}</div>`
    : '';
  const second = fac.second && fac.second !== f
    ? `<div class="fc-second"><img src="${emblemURL(fac.second.id, 22)}" alt="">${esc(fac.second.name.toUpperCase())} ${fac.own.air ? 'HOLDS THE SKIES' : 'HOLDS THE UPPER LEVELS'}</div>`
    : '';
  el.innerHTML = `
    ${loop}
    <div class="fc-main">
      <img class="fc-emblem" src="${emblemURL(f.id, 72)}" alt="">
      <div class="fc-text">
        <small>STAGE ${plan.loop}-${plan.stageInLoop + 1} · ${esc(plan.biome.name)}</small>
        <b>${esc(f.name.toUpperCase())}</b>
        <em>LEADER: ${esc(f.leader.toUpperCase())}</em>
      </div>
    </div>
    ${second}
    <div class="fc-dispatch"><span>${esc(fac.line)}</span></div>`;
  layer.appendChild(el);
  el.timer = setTimeout(() => el.remove(), SHOW_MS);
  return el;
}
