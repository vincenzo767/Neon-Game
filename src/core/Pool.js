// Generic object pool for heavier entities (enemies, bosses parts, pickups).
// High-volume things (bullets, particles) use struct-of-arrays systems
// instead — see entities/BulletSystem.js and fx/Particles.js.
//
// Objects carry an `alive` flag. Iterate `pool.active`, set alive=false to
// kill, and call `sweep()` once per step to recycle the dead.

export class Pool {
  constructor(factory, prefill = 0) {
    this.factory = factory;
    this.free = [];
    this.active = [];
    for (let i = 0; i < prefill; i++) this.free.push(factory());
  }

  obtain() {
    const o = this.free.pop() || this.factory();
    o.alive = true;
    this.active.push(o);
    return o;
  }

  sweep() {
    const a = this.active;
    let w = 0;
    for (let r = 0; r < a.length; r++) {
      const o = a[r];
      if (o.alive) a[w++] = o;
      else this.free.push(o);
    }
    a.length = w;
  }

  clear() {
    for (const o of this.active) { o.alive = false; this.free.push(o); }
    this.active.length = 0;
  }

  get count() { return this.active.length; }
}
