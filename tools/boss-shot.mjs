// Headless gameplay check + screenshots for a boss fight (no dependencies:
// Chrome DevTools Protocol over Node's built-in WebSocket).
//
//   npm run dev                       (Vite on :5173, or pass --url)
//   node tools/boss-shot.mjs --boss white_fang --diff extreme --out screenshots/white_fang
//
// Boots the real game in headless Chrome (real GPU via ANGLE), opens a
// practice fight, holds fire, keeps the pilot invulnerable (optional), and
// runs a timeline of actions: screenshots, waits, phase skips and arbitrary
// page-side evaluations. Prints console errors and a per-phase FPS summary;
// exits non-zero on page errors.
//
// Timeline (--plan): '|'-separated  wait:<sec> | shot:<name> | phase (end the
// current phase; phase:<sec> sets the pause after it, default 3.2) | until:<state>[:<phase>] | eval:<js> | fps:<sec>

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const URL0 = args.url || 'http://localhost:5173/';
const BOSS = args.boss || 'white_fang';
const DIFF = args.diff || 'standard';
const PILOT = args.pilot || 'kairo';
const OUT = args.out || join('screenshots', BOSS);
const W = +(args.w || 720), H = +(args.h || 960);
const GOD = args.god !== 'false';
const FIRE = args.fire !== 'false';
const PLANSRC = args.planfile ? (await import('node:fs')).readFileSync(args.planfile, 'utf8').trim() : null;
const PLAN = (PLANSRC || args.plan || 'wait:9|shot:p1_a|wait:3|shot:p1_b|fps:4|phase|wait:5|shot:p2|phase|wait:5|shot:p3|wait:4|shot:p3_b|phase|wait:6|shot:p4|phase|wait:6|shot:p5|fps:4').split('|');
const CHROME = args.chrome || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9300 + Math.floor(Math.random() * 500);

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, `--user-data-dir=${join(tmpdir(), `npo-cdp-${PORT}`)}`,
  '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--no-first-run', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map(), errors = [], logs = [];
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
  return r.result.value;
}

async function main() {
  let target;
  for (let k = 0; k < 60 && !target; k++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); target = list.find((t) => t.type === 'page'); } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('chrome did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (m.params.type === 'error') errors.push(text); else if (m.params.type === 'warning' || m.params.type === 'log') logs.push(text);
    }
  });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${URL0}?seed=WHITEFANG` });
  for (let k = 0; k < 120; k++) { if (await evaluate('!!(window.__npo && window.__npo.scene && window.__npoDev)').catch(() => false)) break; await sleep(250); }
  const gpu = await evaluate(`(() => { const gl = window.__npo.renderer.gl; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
  console.log(`GPU: ${gpu}`);
  await evaluate(`(async () => {
    const g = window.__npo;
    g.difficultyId = ${JSON.stringify(DIFF)};
    await window.__npoDev.practice(${JSON.stringify(PILOT)}, ${JSON.stringify(BOSS)}, 1);
    window.__fps = { frames: 0, t0: performance.now() };
    const tick = () => { window.__fps.frames++; requestAnimationFrame(tick); }; tick();
    ${GOD ? "setInterval(() => { const p = g.scene && g.scene.world && g.scene.world.player; if (p) p.invuln = Math.max(p.invuln, 240); }, 100);" : ''}
    return 'ok';
  })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  if (!FIRE) { await sleep(150); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 }); }
  const state = () => evaluate(`(() => { const w = window.__npo.scene.world, b = w && w.boss, c = b && b.ctrl; return c ? { state: c.state, phase: c.number + '/' + c.total, name: c.phase ? c.phase.name : '-', hp: Math.round(b.hp), x: Math.round(b.x), y: Math.round(b.y), bullets: w.bullets.count, parts: c.kit.parts.filter((p) => !p.dead && p.e.alive).length, rig: !!c.rig, is3D: !!(c.rig && c.rig.is3D) } : null; })()`);
  for (const step of PLAN) {
    const [cmd, ...rest] = step.split(':'), arg = rest.join(':');
    if (cmd === 'wait') await sleep(+arg * 1000);
    else if (cmd === 'until') {
      // until:<state>[:<phase number>]  e.g. until:fight, until:fight:2
      const [st, ph] = arg.split(':');
      for (let k = 0; k < 240; k++) {
        const s = await state().catch(() => null);
        if (s && s.state === st && (!ph || s.phase.startsWith(`${ph}/`))) break;
        await sleep(250);
      }
    }
    else if (cmd === 'shot') {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT, `${arg}.png`), Buffer.from(r.data, 'base64'));
      console.log(`shot ${arg}`, JSON.stringify(await state()));
    } else if (cmd === 'phase') {
      await evaluate(`(() => { const c = window.__npo.scene.world.boss && window.__npo.scene.world.boss.ctrl; if (c && c.state === 'fight') { window.__npo.scene.world.damage(c.e, c.e.hp - c.floor + 1, 0); } return 1; })()`);
      await sleep(arg ? +arg * 1000 : 3200);
    } else if (cmd === 'eval') console.log('eval', JSON.stringify(await evaluate(arg)));
    else if (cmd === 'fps') {
      await evaluate('window.__fps.frames = 0, window.__fps.t0 = performance.now()');
      await sleep(+arg * 1000);
      const f = await evaluate('window.__fps.frames / ((performance.now() - window.__fps.t0) / 1000)');
      console.log(`fps ${f.toFixed(1)}`, JSON.stringify(await state()));
    }
  }
  if (logs.length) console.log(`console (${logs.length}):\n  ${[...new Set(logs)].slice(0, 15).join('\n  ')}`);
  if (errors.length) { console.log(`ERRORS (${errors.length}):\n  ${[...new Set(errors)].slice(0, 20).join('\n  ')}`); process.exitCode = 1; } else console.log('no page errors');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { try { ws && ws.close(); } catch { /* */ } proc.kill(); });
