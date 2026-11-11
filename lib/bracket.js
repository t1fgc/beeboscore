'use strict';
/*
 * Turns one start.gg pool (phase group) into the model the bracket / Top 8 splash draws:
 *   columns for the winners side, the losers side and the grand final, each set ordered so it sits
 *   next to the match it feeds, plus which sets make up the Top 8 and whether Top 8 has been reached.
 * Byes are left out. Live scores and "on stream" are applied by the overlay from the scoreboard state.
 */
const MAX_COLUMN = 16;          // never more than 16 matches in a column (48 players double elim)

const idCmp = (a, b) => (a.identifier.length - b.identifier.length) || (a.identifier < b.identifier ? -1 : a.identifier > b.identifier ? 1 : 0);
const isGF = s => /grand final/i.test(s.roundText);
const isBye = s => s.slots.some(sl => /bye/i.test(sl.prereqType));
const filled = s => s.slots.length >= 2 && s.slots.every(sl => sl.entrantId);

function build(raw, opts = {}) {
  const avatars = opts.avatars || {};
  const type = /DOUBLE/i.test(raw.type) ? 'DE' : /SINGLE/i.test(raw.type) ? 'SE' : (raw.type ? 'other' : 'DE');
  const all = (raw.sets || []).filter(s => !isBye(s));
  const byId = new Map(all.map(s => [s.id, s]));

  // grand final (+ the reset, only once it's needed)
  const gfs = all.filter(isGF).sort((a, b) => a.round - b.round || idCmp(a, b));
  const gf = gfs.filter((s, i) => i === 0 || s.slots.some(sl => sl.entrantId));
  const gfIds = new Set(gfs.map(s => s.id));
  const rest = all.filter(s => !gfIds.has(s.id));

  const side = s => (s.round < 0 ? 'L' : 'W');
  const rounds = (sd) => {
    const m = new Map();
    for (const s of rest) if (side(s) === sd) { const k = Math.abs(s.round); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return [...m.keys()].sort((a, b) => a - b).map(k => m.get(k));
  };
  let W = rounds('W'), L = type === 'SE' ? [] : rounds('L');

  // parent links inside a side (winner advances), and the finals into the grand final
  const parent = new Map();
  for (const s of all) s.slots.forEach((sl, idx) => {
    const c = byId.get(sl.prereqId);
    if (!c || /bye/i.test(sl.prereqType)) return;
    const sameSide = (gfIds.has(s.id) && !gfIds.has(c.id)) || (!gfIds.has(s.id) && side(c) === side(s) && !gfIds.has(c.id));
    const winnerFeeds = !sl.prereqPlacement || Number(sl.prereqPlacement) === 1;
    if (sameSide && winnerFeeds && !parent.has(c.id)) parent.set(c.id, { id: s.id, slot: idx });
  });
  // order each column so a set sits beside the one it feeds
  const order = cols => {
    for (let c = cols.length - 1; c >= 0; c--) {
      const next = c + 1 < cols.length ? cols[c + 1] : null;
      const pos = next ? new Map(next.map((s, i) => [s.id, i])) : null;
      cols[c].sort((a, b) => {
        if (pos) {
          const pa = parent.get(a.id), pb = parent.get(b.id);
          const ka = pa && pos.has(pa.id) ? pos.get(pa.id) * 2 + pa.slot : 1e6, kb = pb && pos.has(pb.id) ? pos.get(pb.id) * 2 + pb.slot : 1e6;
          if (ka !== kb) return ka - kb;
        }
        return idCmp(a, b);
      });
    }
    return cols;
  };
  order(W); order(L);
  // too big for one screen: start from the first round with at most 16 matches
  let dropped = 0;
  while (W.length > 1 && W[0].length > MAX_COLUMN) { W.shift(); dropped++; }
  while (L.length > 1 && L[0].length > MAX_COLUMN) { L.shift(); dropped++; }

  const card = s => {
    const done = s.state === 3 && !!s.winnerId;
    const p = sl => sl ? {
      id: sl.entrantId, name: sl.name || '', team: sl.team || '', seed: sl.seed || '', avatar: (sl.entrantId && avatars[sl.entrantId]) || '',
      score: sl.score, win: done && sl.entrantId && sl.entrantId === s.winnerId, lose: done && !!sl.entrantId && sl.entrantId !== s.winnerId,
    } : { id: '', name: '', team: '', seed: '', avatar: '', score: null, win: false, lose: false };
    return { id: s.id, round: s.roundText, done, state: s.state === 3 ? 'done' : s.state === 2 ? 'playing' : s.state === 6 ? 'called' : 'wait',
      a: p(s.slots[0]), b: p(s.slots[1]), parent: (parent.get(s.id) || {}).id || '', ...(s.station && !done ? { station: s.station } : {}) };
  };
  const col = list => ({ name: (list[0] && list[0].roundText) || '', sets: list.map(card) });

  // Top 8: the last 8-player stretch of the bracket
  let top8 = null;
  const W2 = W.slice(), L2 = L.slice();
  if (type === 'SE' && W2.length >= 3) {
    const [qf, sf, f] = W2.slice(-3);
    top8 = { type: 'SE', qf: qf.map(card), sf: sf.map(card), f: f.map(card), reached: qf.length >= 1 && qf.every(filled) };
  } else if (type === 'DE' && W2.length >= 2) {
    const wf = W2[W2.length - 1], wsf = W2[W2.length - 2];
    const lc = L2.slice(-4);
    const [lt8, lqf, lsf, lf] = lc.length === 4 ? lc : [[], ...[[], [], []].slice(0, 3 - lc.length), ...lc].slice(-4);
    const players = new Set(all.flatMap(s => s.slots.map(sl => sl.entrantId).filter(Boolean)));
    top8 = { type: 'DE', wsf: wsf.map(card), wf: wf.map(card), lt8: lt8.map(card), lqf: lqf.map(card), lsf: lsf.map(card), lf: lf.map(card), gf: gf.map(card),
      reached: players.size <= 8 ? all.length > 0 : (wsf.length > 0 && wsf.every(filled) && lt8.length > 0 && lt8.every(filled)) };
  }

  const entrants = new Set(all.flatMap(s => s.slots.map(sl => sl.entrantId).filter(Boolean))).size;
  // still in: a player is out after one loss (single elim) or two (double elim; the grand final reset counts too)
  const losses = new Map();
  for (const s of all) if (s.state === 3 && s.winnerId) for (const sl of s.slots) if (sl.entrantId && sl.entrantId !== s.winnerId) losses.set(sl.entrantId, (losses.get(sl.entrantId) || 0) + 1);
  const outAt = type === 'SE' ? 1 : 2, out = [...losses.values()].filter(n => n >= outAt).length;
  const topR = type === 'SE' && !gf.length ? all.filter(s => s.round === Math.max(...all.map(x => x.round))) : [];
  const finished = topR.length ? topR.length === 1 && topR[0].state === 3 && !!topR[0].winnerId
    : gf.some(s => s.state === 3 && s.winnerId) && (type === 'SE' || !gf[1] || gf[1].state === 3 || !gf[1].slots.some(sl => sl.entrantId));
  const left = Math.max(finished ? 1 : 0, entrants - out);
  // placements so far (complete once it's finished): the round a player went out in sets their place
  const standings = [];
  {
    const names = new Map(), seen = new Set();
    for (const s of all) for (const sl of s.slots) if (sl.entrantId) names.set(sl.entrantId, { name: sl.name || '', team: sl.team || '', seed: sl.seed || '' });
    const add = (id, place) => { if (!id || seen.has(id)) return; seen.add(id); const n = names.get(id) || {}; standings.push({ id, place, name: n.name || '', team: n.team || '', seed: n.seed || '', avatar: avatars[id] || '' }); };
    const loserOf = s => (s.slots.find(sl => sl.entrantId && sl.entrantId !== s.winnerId) || {}).entrantId;
    const doneSets = all.filter(s => s.state === 3 && s.winnerId);
    if (finished) {
      const last = topR.length ? topR[0] : gf.filter(s => s.state === 3 && s.winnerId).pop();
      add(last.winnerId, 1); add(loserOf(last), 2);
    }
    if (type === 'SE') {
      const R = Math.max(0, ...all.filter(s => !isGF(s)).map(s => s.round), 0) || Math.max(0, ...all.map(s => s.round));
      const finalR = Math.max(R, ...gf.map(s => s.round));
      for (const s of doneSets.filter(x => !gfIds.has(x.id)).sort((a, b) => b.round - a.round)) add(loserOf(s), 2 ** (finalR - s.round) + 1);
    } else {
      const maxL = Math.max(0, ...all.filter(s => s.round < 0).map(s => -s.round));
      for (const s of doneSets.filter(x => x.round < 0).sort((a, b) => a.round - b.round)) {
        const d = maxL + s.round, h = Math.floor(d / 2);
        add(loserOf(s), 2 ** (h + 1) + 1 + (d % 2 ? 2 ** h : 0));
      }
    }
    standings.sort((a, b) => a.place - b.place);
  }
  const maxCol = Math.max(0, ...W.map(c => c.length), ...L.map(c => c.length));
  return {
    event: opts.event || '', tournament: opts.tournament || '', game: opts.game || '', phase: opts.phase || '', pool: raw.pool && opts.pools > 1 ? raw.pool : '',
    type, entrants, left, dropped,
    paged: type === 'DE' && maxCol > 4,                 // more than ~16 players: Winners and Losers get a page each
    winners: W.map(col), losers: L.map(col), gf: gf.map(card),
    top8, finished, standings, next: opts.next || '', updatedAt: Date.now(),
  };
}

module.exports = { build, MAX_COLUMN };
