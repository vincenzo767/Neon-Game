// In-game HUD (DOM overlay, scaled by --u). Values are diffed against a
// cache so the DOM is only touched when something actually changes.

const HI_KEY = 'npo.hiscore.v1';
const hiKey = (diffId) => (diffId ? `${HI_KEY}.${diffId}` : HI_KEY);

export function loadHiScore(diffId) {
  try { return Number(localStorage.getItem(hiKey(diffId))) || 0; } catch { return 0; }
}
export function saveHiScore(v, diffId) {
  try { if (v > loadHiScore(diffId)) localStorage.setItem(hiKey(diffId), String(v)); } catch { /* ignore */ }
}
/** Hi-score key: per difficulty; Legendary runs are kept separately (UPDATE_01 §2.7). */
export const hiScoreId = (diff, def) => (diff ? `${diff.id}${def && def.legendary ? '.legendary' : ''}` : null);

export class Hud {
  /** @param diff difficulty config (core/difficulty.js) — shown as a badge, keys the hi-score */
  constructor(root, world, diff = null) {
    this.world = world;
    const p = world.player, def = p.def;
    this.hi = loadHiScore(hiScoreId(diff, def));
    root.insertAdjacentHTML('beforeend', `
      <div class="hud" style="--pc:${def.css}">
        <div class="hud-top">
          <div class="hud-score"><span>SCORE</span><b data-k="score">0</b></div>
          <div class="hud-chain" data-k="chainBox"><b data-k="chain">0</b><span>CHAIN</span></div>
          <div class="hud-hi"><span>HI</span><b data-k="hi">0</b></div>
        </div>
        <div class="hud-pilot">${def.name} · ${def.vehicle}${def.legendary ? ' · <b class="hud-legendary">LEGENDARY</b>' : ''}</div>
        <div class="hud-stage" data-k="stage"></div>
        ${diff ? `<div class="hud-diff" style="--dc:${diff.color}">${diff.name}</div>` : ''}
        <div class="hud-boss" data-k="boss"><div class="hud-boss-name" data-k="bossName"></div><div class="hud-boss-bar"><i data-k="bossHp"></i><div class="segs" data-k="bossSegs"></div></div></div>
        <div class="hud-left">
          <div class="hud-row"><span>LIFE</span><i data-k="lives"></i></div>
          <div class="hud-row"><span>BOMB</span><i data-k="bombs"></i></div>
          <div class="hud-row small"><span>GRAZE</span><b data-k="graze">0</b></div>
        </div>
        <div class="hud-right">
          <div class="hud-meter"><label>PWR <b data-k="tier">T1</b></label><div class="bar"><i data-k="power"></i></div></div>
          <div class="hud-meter"><label data-k="spLabel">${def.special.name}</label><div class="bar sp"><i data-k="special"></i></div></div>
          <div class="hud-meter ult" data-k="ultBox"><label>ULT <b data-k="ultTxt"></b></label><div class="bar"><i data-k="ult"></i></div></div>
        </div>
        <div class="hud-toasts" data-k="toasts"></div>
      </div>`);
    this.el = root.lastElementChild;
    this.k = {};
    for (const n of this.el.querySelectorAll('[data-k]')) this.k[n.dataset.k] = n;
    this.cache = {};
  }

  _set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(this.k[key], value);
  }

  toast(text, cls = '') {
    const t = document.createElement('div');
    t.className = `hud-toast ${cls}`;
    t.textContent = text;
    this.k.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1600);
    while (this.k.toasts.children.length > 4) this.k.toasts.firstChild.remove();
  }

  update() {
    const w = this.world, p = w.player;
    const txt = (el, v) => { el.textContent = v; };
    this._set('score', w.score, (el, v) => { el.textContent = v.toLocaleString('en-US'); });
    const hi = Math.max(this.hi, w.score);
    this._set('hi', hi, (el, v) => { el.textContent = v.toLocaleString('en-US'); });
    this._set('chain', w.chain, txt);
    this._set('chainBox', w.chain > 1, (el, v) => el.classList.toggle('on', v));
    this._set('graze', w.graze, txt);
    this._set('lives', p.lives, (el, v) => { el.textContent = '▲'.repeat(Math.min(v, 8)); });
    this._set('bombs', p.bombs, (el, v) => { el.textContent = '◆'.repeat(Math.min(v, 8)); });
    this._set('tier', p.tier, (el, v) => { el.textContent = v >= 4 ? 'MAX' : `T${v}`; });
    this._set('power', Math.round(p.power), (el, v) => { el.style.width = `${(v / 400) * 100}%`; });
    this._set('special', Math.round(p.specialFrac * 100), (el, v) => {
      el.style.width = `${v}%`;
      el.parentElement.classList.toggle('ready', v >= 100);
    });
    const ult = Math.floor(p.ult);
    this._set('ult', ult, (el, v) => { el.style.width = `${v}%`; });
    const ready = p.ult >= 100;
    this._set('ultBox', ready, (el, v) => el.classList.toggle('ready', v));
    this._set('ultTxt', ready ? 'READY [V]' : `${ult}%`, txt);
    this._updateBoss();
  }

  setStage(text) { this.k.stage.textContent = text; }

  _updateBoss() {
    const b = this.world.boss;
    const show = !!(b && b.alive && b.entered);
    this._set('boss', show, (el, v) => el.classList.toggle('on', v));
    if (!show) return;
    this._set('bossName', b.name, (el, v) => {
      el.textContent = v;
      // Phase segment markers.
      const ph = (b.def && b.def.phases) || [];
      this.k.bossSegs.innerHTML = ph.map((f) => `<span style='left:${f * 100}%'></span>`).join('');
    });
    this._set("bossHp", Math.max(0, Math.round((b.hp / b.maxHp) * 1000)), (el, v) => { el.style.width = `${v / 10}%`; });
  }

  destroy() { this.el.remove(); }
}
