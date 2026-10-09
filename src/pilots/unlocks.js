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

// ------------------------------------------------------------ practice (M7b)
// Practice mode (prompt §8) unlocks a boss once it has been reached in a
// real run: the highest Mk. seen per boss id is kept.

/** {bossId: highest mk reached}. */
export const bossesSeen = () => load().seen || {};

/** Record that a boss (at mk) appeared in a ranked run. */
export function recordBossSeen(id, mk = 1) {
  const d = load();
  d.seen = d.seen || {};
  if ((d.seen[id] || 0) >= mk) return;
  d.seen[id] = mk;
  save(d);
}
