import { WORLD_W, WORLD_H } from '../core/constants.js';
import { TestRangeScene } from './TestRangeScene.js';
import { RNG } from '../core/RNG.js';
import { COLOR_NAMES } from '../fx/sprites.js';
import { pilotArt } from '../core/pilotArt.js';
import '../ui/pilotArtTest.css';

// Pilot art test range (ART_PIPELINE.md, Step 6). Open with ?test=<id> for any
// pilot whose definition has an `art` instance (art/mechaArt.js): kairo, mira, bruno.
//
//   1-4  power tier          E  spawn dummy enemies     B  bullet storm (1,500)
//   Y    invincibility       R  size 68 / 80 / 90       O  outline sprite on/off
//   Q    clear the field     F9 debug overlay: anchors, hitbox, layer outlines;
//                               drag anchors, then COPY JSON for <id>.anchors.json
// Sliders: shot width and glow strength (visual only).

const STORM = 1500;
const C = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i]));

export class PilotArtTestScene extends TestRangeScene {
  setup() {
    this.art = this.def.art;
    this.ranked = false;
    this.world.density = 0;
    this.spawner = null;          // quiet range: enemies only on demand (E)
    this.invincible = true;
    this.storm = false;
    this.stormRng = new RNG('STORM');
    this.drag = null;
    this.menuHint = `<div class="menu-sub">${this.def.name} · ART TEST</div>`;
    this.banner(`${this.def.name.split(' ')[0]} ART TEST`, `${this.def.vehicle} · TEST RANGE`, 120);
    this.hud.setStage('ART TEST');
    this._applyInvincible();
    this._buildPanel();
  }

  restartScene() { this.g.setScene(new PilotArtTestScene(this.def)); }

  exit() {
    super.exit();
    this.art.LOOK.debug = false;
    window.removeEventListener('keydown', this._f9);
  }

  // ------------------------------------------------------------------ UI

  _buildPanel() {
    const root = this.g.hud;
    root.insertAdjacentHTML('beforeend', `
      <div class="kt-panel">
        <div class="kt-row kt-stats"><b class="kt-fps">-- FPS</b><span class="kt-count"></span></div>
        <label class="kt-row">WIDTH <input type="range" class="kt-width" min="0.5" max="2" step="0.05" value="${this.art.LOOK.widthMul}"><span class="kt-wv"></span></label>
        <label class="kt-row">GLOW <input type="range" class="kt-glow" min="0" max="2" step="0.05" value="${this.art.LOOK.glowMul}"><span class="kt-gv"></span></label>
        <div class="kt-row kt-state"></div>
        <div class="kt-keys">1-4 tier · E enemies · B storm · Y invincible · R size · O outline · Q clear · F9 debug</div>
      </div>
      <div class="kt-debug"><div class="kt-labels"></div>
        <div class="kt-debug-bar"><button class="kt-copy">COPY JSON</button><span class="kt-msg">drag the green points</span></div>
        <textarea class="kt-json" readonly></textarea>
      </div>`);
    const q = (s) => root.querySelector(s);
    this.ui = {
      fps: q('.kt-fps'), count: q('.kt-count'), state: q('.kt-state'), wv: q('.kt-wv'), gv: q('.kt-gv'),
      width: q('.kt-width'), glow: q('.kt-glow'), debug: q('.kt-debug'), labels: q('.kt-labels'),
      msg: q('.kt-msg'), json: q('.kt-json'),
    };
    const slider = (el, key) => {
      el.addEventListener('input', () => { LOOK[key] = +el.value; this._refreshPanel(); });
      el.addEventListener('change', () => el.blur()); // give the arrow keys back to the ship
    };
    slider(this.ui.width, 'widthMul');
    slider(this.ui.glow, 'glowMul');
    q('.kt-copy').addEventListener('click', () => this._copyJson());
    const dbg = this.ui.debug;
    dbg.addEventListener('pointerdown', (e) => this._pointer(e, 'down'));
    dbg.addEventListener('pointermove', (e) => this._pointer(e, 'move'));
    dbg.addEventListener('pointerup', () => { this.drag = null; });
    // F9 is not a game action: listen for it directly (and keep the browser from using it).
    this._f9 = (e) => { if (e.code === 'F9') { e.preventDefault(); this._toggleDebug(); } };
    window.addEventListener('keydown', this._f9);
    this._refreshPanel();
  }

  _refreshPanel() {
    const u = this.ui;
    u.wv.textContent = `×${this.art.LOOK.widthMul.toFixed(2)}`;
    u.gv.textContent = `×${this.art.LOOK.glowMul.toFixed(2)}`;
    const art = this.art.hasArt() ? 'ART' : 'FALLBACK (procedural)';
    u.state.textContent = `T${this.world.player.tier} · ${this.art.LOOK.size}u tall · outline ${this.art.LOOK.outline ? 'on' : 'off'} · ${this.invincible ? 'INVINCIBLE' : 'mortal'} · storm ${this.storm ? 'ON' : 'off'} · ${art}`;
  }

  _toggleDebug() {
    this.art.LOOK.debug = !this.art.LOOK.debug;
    this.ui.debug.classList.toggle('show', this.art.LOOK.debug);
    if (this.art.LOOK.debug) this._updateJson();
  }

  _applyInvincible() {
    const p = this.world.player;
    if (this.invincible) p.hit = () => {};   // instance override: no blink, no deaths
    else delete p.hit;
  }

  // ------------------------------------------------------- anchor editing

  /** Screen → world. */
  _world(e) {
    const r = this.g.hud.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * WORLD_W, (e.clientY - r.top) / r.height * WORLD_H];
  }

  _pointer(e, type) {
    const p = this.world.player, A = this.art.anchorData(), k = this.art.unitsPerPx(), hb = A.anchors.hitbox;
    const [wx, wy] = this._world(e);
    if (type === 'down') {
      let best = null, bd = 10 * 10;
      for (const [name, an] of Object.entries(A.anchors)) {
        const ax = p.x + (an[0] - hb[0]) * k, ay = p.y + (an[1] - hb[1]) * k;
        const d = (ax - wx) ** 2 + (ay - wy) ** 2;
        if (d < bd) { bd = d; best = name; }
      }
      this.drag = best;
      this.dragFrom = best && { wx, wy, an: [...A.anchors[best]] };
      if (best) this.ui.debug.setPointerCapture(e.pointerId);
      return;
    }
    if (!this.drag) return;
    const an = A.anchors[this.drag];
    if (this.drag === 'hitbox') {
      // The hitbox stays on player.x/y, so moving its anchor slides the art
      // underneath it (measured from where the drag started).
      const f = this.dragFrom;
      an[0] = +(f.an[0] + (wx - f.wx) / k).toFixed(1);
      an[1] = +(f.an[1] + (wy - f.wy) / k).toFixed(1);
    } else {
      an[0] = +(hb[0] + (wx - p.x) / k).toFixed(1);
      an[1] = +(hb[1] + (wy - p.y) / k).toFixed(1);
    }
    this.ui.msg.textContent = `${this.drag} → [${an[0]}, ${an[1]}]`;
    this._updateJson();
  }

  _jsonText() {
    const A = this.art.anchorData();
    const id = this.def.id;
    const json = { version: 1, pilot: id, space: `${id}_back@2x.png pixels, origin top-left (1x = half)`, image: A.image, anchors: A.anchors };
    return `${JSON.stringify(json, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')}\n`;
  }

  _updateJson() { this.ui.json.value = this._jsonText(); }

  async _copyJson() {
    const txt = this._jsonText();
    this.ui.json.value = txt;
    try {
      await navigator.clipboard.writeText(txt);
      this.ui.msg.textContent = `copied — paste into public/assets/pilots/${this.def.id}/${this.def.id}.anchors.json`;
    } catch {
      this.ui.json.select();
      this.ui.msg.textContent = 'clipboard blocked — copy from the box below';
    }
  }

  // ------------------------------------------------------------ tick

  tick() {
    const inp = this.g.input, w = this.world, p = w.player;
    let changed = false;
    for (let k = 0; k < 4; k++) {
      if (inp.keyPressed(`Digit${k + 1}`)) { p.power = k === 3 ? 400 : k * 100; this.banner(`TIER ${k + 1}`, 'POWER', 50); changed = true; }
    }
    if (inp.keyPressed('KeyE')) { this._spawnDummies(); this.banner('DUMMIES', 'TARGETS SPAWNED', 50); }
    if (inp.keyPressed('KeyB')) { this.storm = !this.storm; this.banner(this.storm ? 'BULLET STORM' : 'STORM OFF', `${STORM} BULLETS`, 60); changed = true; }
    if (inp.keyPressed('KeyY')) { this.invincible = !this.invincible; this._applyInvincible(); this.banner(this.invincible ? 'INVINCIBLE' : 'MORTAL', '', 50); changed = true; }
    if (inp.keyPressed('KeyR')) {
      this.art.LOOK.size = this.art.SIZES[(this.art.SIZES.indexOf(this.art.LOOK.size) + 1) % this.art.SIZES.length];
      this.banner(`SIZE ${this.art.LOOK.size}`, 'UNITS TALL · HITBOX UNCHANGED', 60); changed = true;
    }
    if (inp.keyPressed('KeyO')) { this.art.LOOK.outline = !this.art.LOOK.outline; changed = true; }
    if (inp.keyPressed('KeyQ')) {
      for (const e of w.enemies.active) e.alive = false;
      w.bullets.clearAll();
      this.storm = false; changed = true;
    }
    if (this.storm) this._stormStep();
    if (changed || (this.g.frameCount & 15) === 0) this._refreshPanel();
    const fps = this.g.debug.fps;
    this.ui.fps.textContent = `${fps ? fps.toFixed(0) : '--'} FPS`;
    this.ui.count.textContent = ` · bullets ${w.bullets.count} · shots ${w.shots.count} · fx ${w.fxLow.count + w.fxHigh.count}`;
  }

  _spawnDummies() {
    const w = this.world, r = this.g.renderer;
    const fd = r.frame('drone'), fc = r.frame('emitter');
    for (let k = 0; k < 6; k++) {
      const x = 90 + k * 60;
      w.spawnEnemy({ kind: 'dummy', x, y: 230 + (k % 2) * 30, r: 14, hp: 60, f: fd, score: 100, ult: 1, blast: 0.6, ai: (e) => { e.x = x + Math.sin(e.t * 0.02 + k) * 14; } });
    }
    w.spawnEnemy({ kind: 'dummy', x: WORLD_W / 2, y: 110, r: 40, hp: 4000, f: fc, scale: 1.4, score: 1000, ult: 5, blast: 1.2, glow: [1, 0.2, 0.7], ai: (e) => { e.rot = e.t * 0.01; } });
  }

  /** Keep ~1,500 enemy bullets on screen: slow rings from four emitters plus rain. */
  _stormStep() {
    const w = this.world, B = w.bullets, BF = w.BF, R = this.stormRng, t = this.g.frameCount;
    let budget = Math.min(60, STORM - B.count);
    const em = [[80, 60], [400, 60], [160, 170], [320, 170]];
    if (t % 4 === 0) {
      for (const [ex, ey] of em) {
        const n = 18;
        for (let k = 0; k < n && budget > 0; k++, budget--) {
          const a = (k / n) * Math.PI * 2 + t * 0.013;
          const col = k % 2 ? C.pink : C.violet;
          B.spawn(ex, ey, a, 1.1, BF.orb[COLOR_NAMES[col]], col, 3);
        }
      }
    }
    while (budget-- > 0) {
      B.spawn(R.range(0, WORLD_W), -8, Math.PI / 2 + R.range(-0.25, 0.25), R.range(1, 1.8), BF.rice.cyan, C.cyan, 2.5);
    }
  }

  // ------------------------------------------------------------ render

  render(r, alpha) {
    super.render(r, alpha);
    if (this.art.LOOK.debug) this._renderDebug(r.batch);
  }

  _renderDebug(b) {
    const p = this.world.player, F = this.world.F, A = this.art.anchorData(), k = this.art.unitsPerPx(), hb = A.anchors.hitbox;
    const x = p.renderX ?? p.x, y = p.renderY ?? p.y;
    const at = (ix, iy) => [x + (ix - hb[0]) * k, y + (iy - hb[1]) * k];
    const line = (x0, y0, x1, y1, c, wd = 1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      b.draw(F.white, (x0 + x1) / 2, (y0 + y1) / 2, len, wd, Math.atan2(y1 - y0, x1 - x0), c[0], c[1], c[2], 0.9, 0);
    };
    // Image bounds.
    const [ix0, iy0] = at(0, 0), [ix1, iy1] = at(A.image.w, A.image.h);
    line(ix0, iy0, ix1, iy0, [0.6, 0.6, 0.6]); line(ix1, iy0, ix1, iy1, [0.6, 0.6, 0.6]);
    line(ix1, iy1, ix0, iy1, [0.6, 0.6, 0.6]); line(ix0, iy1, ix0, iy0, [0.6, 0.6, 0.6]);
    // Layer mask outlines (rest pose) + pivots.
    const layers = pilotArt(this.def.id)?.layers?.layers || {};
    const cols = { wingL: [0.3, 0.6, 1], wingR: [1, 0.3, 0.7] };
    for (const [name, L] of Object.entries(layers)) {
      const c = cols[name] || [1, 1, 0];
      for (let i = 0; i < L.poly.length; i++) {
        const [a0, a1] = at(...L.poly[i]), [b0, b1] = at(...L.poly[(i + 1) % L.poly.length]);
        line(a0, a1, b0, b1, c);
      }
      const [px, py] = at(...L.pivot);
      b.draw(F.ring, px, py, 7, 7, 0, 1, 1, 1, 1, 0);
    }
    // Hitbox (true size) + anchors.
    b.draw(F.ring, x, y, p.hitR * 2 / 0.86, p.hitR * 2 / 0.86, 0, 1, 0.2, 0.2, 1, 0);
    const labels = [];
    for (const [name, an] of Object.entries(A.anchors)) {
      const [ax, ay] = at(...an);
      const c = name === 'hitbox' ? [1, 0.3, 0.3] : this.drag === name ? [1, 1, 0.3] : [0.3, 1, 0.4];
      b.draw(F.white, ax, ay, 3, 3, Math.PI / 4, c[0], c[1], c[2], 1, 0);
      b.draw(F.ring, ax, ay, 6, 6, 0, c[0], c[1], c[2], 1, 0);
      labels.push(`<i style="left:${(ax / WORLD_W) * 100}%;top:${(ay / WORLD_H) * 100}%">${name}</i>`);
    }
    // Shot hit circles (the bright core must match these).
    const S = this.world.shots;
    for (let i = 0; i < S.count; i++) b.draw(F.ring, S.x[i], S.y[i], S.radius[i] * 2 / 0.86, S.radius[i] * 2 / 0.86, 0, 1, 1, 0.3, 0.8, 0);
    const html = labels.join('');
    if (html !== this._lastLabels) { this.ui.labels.innerHTML = html; this._lastLabels = html; }
  }
}
