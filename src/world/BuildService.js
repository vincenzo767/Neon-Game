import { buildChunk } from './chunkBuilder.js';
import { MATERIAL_NAMES, paintMaterial } from './materials.js';

// Main-thread side of arena building. Jobs go to a module Worker
// (OffscreenCanvas painting, results transferred back as ImageBitmaps +
// typed arrays). Our own priority queue keeps at most MAX_IN_FLIGHT jobs in
// the worker, so the nearest chunk is always built first and jobs for an
// arena that was dropped can be cancelled before they start.
//
// Fallback (no Worker / OffscreenCanvas 2D, or a worker error): jobs run on
// the main thread, one per pump() call (one per frame), so a slow device
// degrades to occasional hitches instead of a freeze.

const MAX_IN_FLIGHT = 2;

export class BuildService {
  constructor() {
    this.queue = [];        // { id, msg, resolve, reject, pri, owner }
    this.inflight = new Map();
    this.nextId = 1;
    this.mode = 'worker';
    this.stats = { built: 0, ms: 0, fallback: 0 };
    this._startWorker();
  }

  _startWorker() {
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || (params && params.has('noworker'))) { this.mode = 'main'; return; }
    try {
      this.worker = new Worker(new URL('./build.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev) => this._done(ev.data);
      this.worker.onerror = (e) => { console.warn('[world] build worker failed, using main thread', e.message || e); this._toMain(); };
    } catch (err) {
      console.warn('[world] no build worker:', err.message);
      this.mode = 'main';
    }
  }

  _toMain() {
    this.mode = 'main';
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    // Re-queue whatever was in flight.
    for (const job of this.inflight.values()) this.queue.push(job);
    this.inflight.clear();
  }

  _done(d) {
    const job = this.inflight.get(d.id);
    if (!job) return;
    this.inflight.delete(d.id);
    if (d.ok) {
      if (d.chunk) { this.stats.built++; this.stats.ms += d.chunk.ms; }
      job.resolve(d);
    } else if (/OffscreenCanvas|getContext|not a function|null/.test(d.error)) {
      console.warn('[world] worker cannot paint, switching to main thread:', d.error.split('\n')[0]);
      this.queue.push(job);
      this._toMain();
    } else job.reject(new Error(d.error));
    this.pump();
  }

  _enqueue(msg, pri = 0, owner = null) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, msg, resolve, reject, pri, owner });
      if (this.mode === 'worker') this.pump(); // main mode: one job per frame via pump()
    });
  }

  /** Material tiles: { names, imgs } (ImageBitmaps from the worker, canvases on the main thread). */
  materials() {
    if (this.mode === 'main') return Promise.resolve({ names: MATERIAL_NAMES, imgs: MATERIAL_NAMES.map(paintMaterial) });
    return this._enqueue({ type: 'materials' }, -1e9).then((d) => d);
  }

  /** Build a chunk. Lower pri runs first. Resolves to the chunk payload. */
  chunk(cfg, layer, k, quality, pri = 0, owner = null) {
    return this._enqueue({ type: 'chunk', cfg, layer, k, quality }, pri, owner).then((d) => d.chunk);
  }

  /** Drop queued (not started) jobs of an owner; their promises reject with 'cancelled'. */
  cancel(owner) {
    this.queue = this.queue.filter((j) => {
      if (j.owner !== owner) return true;
      j.reject(new Error('cancelled'));
      return false;
    });
  }

  /** Re-prioritise queued jobs of an owner with fn(msg) → pri. */
  reprioritise(owner, fn) { for (const j of this.queue) if (j.owner === owner) j.pri = fn(j.msg); }

  get busy() { return this.queue.length + this.inflight.size; }

  /** Dispatch work. Worker mode: keep the worker fed. Main mode: run one job now. */
  pump() {
    if (!this.queue.length) return;
    this.queue.sort((a, b) => a.pri - b.pri);
    if (this.mode === 'worker' && this.worker) {
      while (this.queue.length && this.inflight.size < MAX_IN_FLIGHT) {
        const job = this.queue.shift();
        this.inflight.set(job.id, job);
        this.worker.postMessage({ id: job.id, ...job.msg });
      }
      return;
    }
    const job = this.queue.shift();
    try {
      if (job.msg.type === 'materials') job.resolve({ names: MATERIAL_NAMES, imgs: MATERIAL_NAMES.map(paintMaterial) });
      else {
        const m = job.msg;
        const r = buildChunk(m.cfg, m.layer, m.k, m.quality);
        this.stats.built++; this.stats.ms += r.ms; this.stats.fallback++;
        job.resolve({ chunk: r });
      }
    } catch (err) { job.reject(err); }
  }

  /** Warm the worker's noise set early (start-up). */
  warm() { if (this.mode === 'worker') this._enqueue({ type: 'warm' }, -1e9).catch(() => {}); }
}

let SERVICE = null;
export function buildService() { return SERVICE || (SERVICE = new BuildService()); }
