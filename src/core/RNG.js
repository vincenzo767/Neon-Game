// Seeded PRNG (mulberry32). Gameplay must ONLY use a seeded RNG so a run can
// be replayed/shared by seed. Cosmetic effects use a separate instance so
// that particle randomness never perturbs the gameplay sequence.

export function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randomSeedString() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

export class RNG {
  constructor(seed = 1) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this.seed = seed;
    this.state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  }

  /** float in [0, 1) */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) { return a + (b - a) * this.next(); }
  /** integer in [a, b] inclusive */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  angle() { return this.next() * Math.PI * 2; }
}
