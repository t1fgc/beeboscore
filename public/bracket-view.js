/* BeeboScore (developed by Beebo) — the Bracket tab's bracket view: the matches drawn as a real bracket (columns per round,
 * lines from each match to the one its winner goes to), for start.gg events and viewer tournaments alike.
 *
 *   BeeboBracketView.draw(host, sections, opts)
 *     sections: [{ label, cls, cols: [{ name, sets: [S] }] }]
 *     S: { id, tag, state: 'done' | 'playing' | 'ready' | 'wait', a: P, b: P, feeds: [setId…] }, P: { name, score, win, seed }
 *     opts: { canWin(S), canDQ(S), canReset(S), canLoad(S), pending: Set, onWin(S, k), onDQ(S, k), onReset(S), onLoad(S) }
 * One click on ✓ beside a name reports them as the winner.
 */
(() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CW = 214, CH = 60, GX = 46, GY = 14, HEAD = 30;
  function layout(sec) {
    const pos = new Map();
    sec.cols.forEach((col, c) => {
      let bottom = -Infinity;
      col.sets.forEach(S => {
        const fy = (S.feeds || []).map(id => pos.get(id)).filter(p => p && p.c === c - 1).map(p => p.y);
        let y = fy.length ? fy.reduce((a, b) => a + b, 0) / fy.length : bottom === -Infinity ? 0 : bottom + GY;
        if (y < bottom + GY && bottom !== -Infinity) y = bottom + GY;
        pos.set(S.id, { c, y, x: c * (CW + GX) }); bottom = y + CH;
      });
    });
    const h = Math.max(CH, ...[...pos.values()].map(p => p.y + CH));
    return { pos, w: sec.cols.length * (CW + GX) - GX, h };
  }
  function card(S, p, o) {
    const pend = o.pending && o.pending.has(String(S.id));
    const row = k => {
      const x = S[k] || {}, other = S[k === 'a' ? 'b' : 'a'] || {}, named = !!x.name, cls = x.win ? 'w' : x.lose ? 'l' : '';
      const win = !pend && named && other.name && o.canWin && o.canWin(S) ? `<button class="bv-win" data-bv="win" data-k="${k}" title="${esc(x.name)} won — report it" aria-label="${esc(x.name)} won">✓</button>` : '';
      const dq = !pend && named && other.name && o.canDQ && o.canDQ(S) ? `<button class="bv-dq" data-bv="dq" data-k="${k}" title="Disqualify ${esc(x.name)} (${esc(other.name)} goes through)">DQ</button>` : '';
      return `<div class="bv-p ${cls}"><i>${esc(x.seed || '')}</i><b class="${named ? '' : 'tbd'}">${named ? esc(x.name) : 'waiting…'}</b><em>${x.score == null || x.score === '' ? (x.win ? '✓' : '') : x.score < 0 ? 'DQ' : esc(x.score)}</em>${dq}${win}</div>`;
    };
    const tools = (o.canLoad && o.canLoad(S) ? '<button data-bv="load" title="Put this match on the scoreboard">📺</button>' : '') + (o.canReset && o.canReset(S) ? '<button data-bv="reset" title="Take this result back">↺</button>' : '');
    return `<div class="bv-set st-${S.state}${pend ? ' pend' : ''}" data-id="${esc(S.id)}" style="left:${p.x}px;top:${p.y + HEAD}px;width:${CW}px;height:${CH}px">
      ${S.tag ? `<span class="bv-tag">${esc(S.tag)}</span>` : ''}${tools ? `<span class="bv-tools">${tools}</span>` : ''}${row('a')}${row('b')}${pend ? '<span class="bv-pend">Reporting…</span>' : ''}</div>`;
  }
  function draw(host, sections, o = {}) {
    const sx = host.scrollLeft, sy = host.scrollTop;
    let html = '';
    for (const sec of sections) {
      if (!sec.cols.length) continue;
      const L = layout(sec);
      let lines = '';
      for (const col of sec.cols) for (const S of col.sets) for (const id of S.feeds || []) {
        const a = L.pos.get(id), b = L.pos.get(S.id); if (!a || !b || a.c !== b.c - 1) continue;
        const x1 = a.x + CW, y1 = a.y + CH / 2 + HEAD, x2 = b.x, y2 = b.y + CH / 2 + HEAD, mx = x1 + GX / 2;
        const done = (sec.cols[a.c].sets.find(s => s.id === id) || {}).state === 'done';
        lines += `<path d="M${x1} ${y1}H${mx}V${y2}H${x2}" class="${done ? 'done' : ''}"/>`;
      }
      const heads = sec.cols.map((c, i) => `<div class="bv-col" style="left:${i * (CW + GX)}px;width:${CW}px">${esc(c.name)}</div>`).join('');
      html += `<section class="bv-sec ${sec.cls || ''}"><h4>${esc(sec.label)}</h4><div class="bv-canvas" style="width:${L.w}px;height:${L.h + HEAD}px">
        <svg class="bv-lines" width="${L.w}" height="${L.h + HEAD}" aria-hidden="true">${lines}</svg>${heads}${sec.cols.map(c => c.sets.map(S => card(S, L.pos.get(S.id), o)).join('')).join('')}</div></section>`;
    }
    host.innerHTML = html || '<p class="hint">No bracket to draw yet.</p>';
    host.scrollLeft = sx; host.scrollTop = sy;
    if (!host.dataset.bvWired) {
      host.dataset.bvWired = '1';
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-bv]'); if (!b) return;
        const id = b.closest('.bv-set').dataset.id, S = (host.__bvSets || new Map()).get(id), O = host.__bvOpts || {}; if (!S) return;
        const k = b.dataset.k, fn = { win: O.onWin, dq: O.onDQ, reset: O.onReset, load: O.onLoad }[b.dataset.bv];
        if (fn) fn(S, k);
      });
    }
    host.__bvOpts = o; host.__bvSets = new Map(sections.flatMap(s => s.cols.flatMap(c => c.sets)).map(S => [String(S.id), S]));
  }
  // the bracket splash's model (start.gg, lib/bracket.js) → sections
  function fromModel(m) {
    if (!m) return [];
    const feeds = new Map();
    const all = [...(m.winners || []).flatMap(c => c.sets), ...(m.losers || []).flatMap(c => c.sets), ...(m.gf || [])];
    for (const s of all) if (s.parent) { if (!feeds.has(s.parent)) feeds.set(s.parent, []); feeds.get(s.parent).push(s.id); }
    // reported with just a winner (one click): no games to show, the ✓ says who won
    const sc = (s, k) => !s.done || (!Number(s.a.score) && !Number(s.b.score) && s.a.score !== -1 && s.b.score !== -1) ? null : s[k].score;
    const S = s => ({ id: String(s.id), tag: '', state: s.state === 'done' ? 'done' : s.state === 'playing' ? 'playing' : s.a.id && s.b.id ? 'ready' : 'wait',
      a: { ...s.a, score: sc(s, 'a') }, b: { ...s.b, score: sc(s, 'b') }, feeds: (feeds.get(s.id) || []).map(String), raw: s });
    const out = [];
    if ((m.winners || []).length) out.push({ label: m.type === 'SE' ? 'Bracket' : 'Winners bracket', cls: 'W', cols: m.winners.map(c => ({ name: c.name, sets: c.sets.map(S) })) });
    if ((m.losers || []).length) out.push({ label: 'Losers bracket', cls: 'L', cols: m.losers.map(c => ({ name: c.name, sets: c.sets.map(S) })) });
    if ((m.gf || []).length) out.push({ label: 'Grand final', cls: 'GF', cols: m.gf.map((s, i) => ({ name: i ? 'Reset' : 'Grand Final', sets: [S(s)] })) });
    return out;
  }
  // a viewer tournament's matches (lib/vtourney.js view().sets) → sections
  function fromVT(sets) {
    const out = [];
    for (const [side, label] of [['W', 'Winners bracket'], ['L', 'Losers bracket'], ['GF', 'Grand final']]) {
      const list = (sets || []).filter(x => x.side === side); if (!list.length) continue;
      const rounds = [...new Set(list.map(x => x.r))].sort((a, b) => a - b);
      const S = x => ({ id: String(x.id), tag: x.station ? `Station ${x.station}` : '', state: x.now ? 'playing' : x.w ? 'done' : x.ready ? 'ready' : 'wait',
        a: { name: x.a, seed: x.seedA || '', score: x.w ? (x.ff ? (x.ff === 'a' ? -1 : null) : x.sa) : null, win: x.w === 'a', lose: x.w === 'b' },
        b: { name: x.b, seed: x.seedB || '', score: x.w ? (x.ff ? (x.ff === 'b' ? -1 : null) : x.sb) : null, win: x.w === 'b', lose: x.w === 'a' }, feeds: (x.feeds || []).map(String), raw: x });
      out.push({ label: side === 'W' && !sets.some(x => x.side === 'L') ? 'Bracket' : label, cls: side, cols: rounds.map(r => { const c = list.filter(x => x.r === r).sort((a, b) => a.idx - b.idx); return { name: c[0].round, sets: c.map(S) }; }) });
    }
    return out;
  }
  window.BeeboBracketView = { draw, fromModel, fromVT };
})();
