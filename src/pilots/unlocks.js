// Persistent pilot unlocks and run memory (localStorage, best effort).
//
//   warden    "Warden" is unlockable: defeating any Undercrown main boss
//             unseals the Commissioner's personnel file.
//   lastBoss  archetype of the last main boss defeated; Warden's adaptive
//             Verdict weapon copies it.

const KEY = 'npo.unlocks.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
}

export const isUnlocked = (id) => id !== 'warden' || !!load().warden;

export function unlock(id) {
  const d = load();
  d[id] = true;
  save(d);
}

export const lastBossArchetype = () => load().lastBoss || null;

/** Record a main-boss defeat. Returns true if this defeat unlocked Warden. */
export function recordBossDefeat(archetype) {
  const d = load();
  const fresh = !d.warden;
  d.warden = true;
  d.lastBoss = archetype;
  d.bosses = (d.bosses || 0) + 1;
  save(d);
  return fresh;
}
