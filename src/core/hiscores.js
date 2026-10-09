// Local high-score tables (M7a, prompt §5: "records pilot and seed").
//
// One board per difficulty, plus a separate '<difficulty>.legendary' board
// for Vincenzo runs (UPDATE_01 §2.7). Each board keeps the top TABLE_SIZE
// entries:
//   { score, name, pilot, pilotName, seed, diff, stage, loop, cont, date }
// `stage` is the stage reached ("2-3"); `cont` the continues used.
//
// Storage is best effort (private windows, blocked storage): every access is
// guarded and a failure just means an empty table.

const KEY = 'npo.ranking.v1';
const NAME_KEY = 'npo.ranking.name';
const OLD_KEY = 'npo.hiscore.v1'; // M2–M6 single hi-score per board
export const TABLE_SIZE = 10;

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveAll(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
}

/** Entries of a board, best first. Imports the pre-M7 single hi-score once. */
export function loadBoard(board) {
  const all = loadAll();
  let list = Array.isArray(all[board]) ? all[board] : null;
  if (!list) {
    list = [];
    try {
      const old = Number(localStorage.getItem(`${OLD_KEY}.${board}`)) || 0;
      if (old > 0) list.push({ score: old, name: '---', pilot: '', pilotName: 'PRE-M7 RECORD', seed: '', diff: board, stage: '', loop: 0, cont: 0, date: '' });
    } catch { /* ignore */ }
    if (list.length) { all[board] = list; saveAll(all); }
  }
  return list;
}

/** Best score on a board (0 if empty). */
export function topScore(board) {
  const b = loadBoard(board);
  return b.length ? b[0].score : 0;
}

/** 0-based rank a score would take, or -1 if it wouldn't make the table. */
export function rankFor(board, score) {
  if (!(score > 0)) return -1;
  const b = loadBoard(board);
  let i = 0;
  while (i < b.length && b[i].score >= score) i++;
  return i < TABLE_SIZE ? i : -1;
}

/** Insert an entry; returns its 0-based rank (or -1 if it didn't place). */
export function addEntry(board, entry) {
  const rank = rankFor(board, entry.score);
  if (rank < 0) return -1;
  const all = loadAll();
  const b = loadBoard(board).slice();
  b.splice(rank, 0, { ...entry, date: entry.date || new Date().toISOString().slice(0, 10) });
  all[board] = b.slice(0, TABLE_SIZE);
  saveAll(all);
  return rank;
}

/** Initials last entered (the default for the next entry). */
export function lastName() {
  try { return (localStorage.getItem(NAME_KEY) || 'NPO').slice(0, 3); } catch { return 'NPO'; }
}
export function saveLastName(n) {
  try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
}

/** Every board that has entries (for the ranking screens). */
export function boards() { return Object.keys(loadAll()); }
