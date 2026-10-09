// Ranking UI (M7a): the initials entry and the high-score table markup.
// Pure HTML builders; the scenes own the input handling.

import './ranking.css';

/** Characters the initials cycle through (up / down). */
export const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-♥ ';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ORD = ['1ST', '2ND', '3RD'];
export const rankLabel = (i) => ORD[i] || `${i + 1}TH`;

/** Initials entry panel. st = {rank, letters[3], pos, score, pilotName}. */
export function nameEntryHtml(st) {
  const cells = st.letters.map((ch, i) => `<i class="${i === st.pos ? 'on' : ''}">${ch === ' ' ? '&nbsp;' : esc(ch)}</i>`).join('');
  return `<div class="menu rank-entry">
    <h2>NEW RECORD</h2>
    <div class="menu-sub"><b>${rankLabel(st.rank)}</b> PLACE · ${fmt(st.score)}</div>
    <div class="rank-name">${cells}<i class="${st.pos === 3 ? 'on ok' : 'ok'}">OK</i></div>
    <div class="rank-help">▲▼ letter · ◀▶ move · <b>Z</b> next · <b>X</b> back</div>
  </div>`;
}

/**
 * High-score table. `opts.highlight` = rank to mark; `opts.rows` = max rows.
 * Columns: rank, initials, score, pilot, stage, seed.
 */
export function rankingTableHtml(entries, opts = {}) {
  const rows = opts.rows || 10;
  const body = [];
  for (let i = 0; i < rows; i++) {
    const e = entries[i];
    if (!e) {
      body.push(`<tr class="empty"><td>${rankLabel(i)}</td><td>---</td><td class="sc">—</td><td></td><td></td><td></td></tr>`);
      continue;
    }
    body.push(`<tr class="${i === opts.highlight ? 'me' : ''}"><td>${rankLabel(i)}</td><td class="nm">${esc(e.name)}</td><td class="sc">${fmt(e.score)}</td>`
      + `<td class="pl">${esc((e.pilotName || '').split(' ')[0])}</td><td>${esc(e.stage || '')}${e.cont ? `<small>+${e.cont}C</small>` : ''}</td><td class="sd">${esc(e.seed || '')}</td></tr>`);
  }
  return `<table class="rank-table">
    <thead><tr><th></th><th>NAME</th><th>SCORE</th><th>PILOT</th><th>STAGE</th><th>SEED</th></tr></thead>
    <tbody>${body.join('')}</tbody></table>`;
}
