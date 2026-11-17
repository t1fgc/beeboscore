'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.23 — the tale of a set, for the splashes (round 2 of the layout and splash upgrade).
 *
 * What FullVS, GlassVS and Victory say beyond the names, worked out from what the app already has:
 *   strip   the stats strip under FullVS and GlassVS: each player's seed and record today, and between them the head-to-head
 *           ("CrimsonByte leads 3–1 · last time NeonGhoul won 3–2"), or a runback ("Runback — NeonGhoul won 3–2 in Winners
 *           Semi-Final earlier today")
 *   next    where the set sends each player, from the bracket: "Advances to Winners Final", "Drops to Losers",
 *           "Eliminated · 5th place", "Champion", "Bracket reset"
 *
 * tale(s, o) is pure (the tests use it). o: { rows (Player history, oldest first), since (ms: today's event), bracket (the
 * bracket model: lib/bracket.js, or the viewer tournament's), seedOf(name), hist (history.view of the two), story }.
 */
const key = n => String(n == null ? '' : n).trim().toLowerCase();
const ord = n => { const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
const real = n => { const k = key(n); return !!k && !/^player [12]$/.test(k) && k !== 'tbd' && k !== '?'; };

/** a player's record in today's event, from Player history: "4–1" (sets won – lost), '' when they haven't played */
function today(rows, name, since) {
  const k = key(name); let w = 0, l = 0;
  for (const r of rows || []) {
    if (!(r.at >= since)) continue;
    const sd = key(r.p1 && r.p1.name) === k ? 1 : key(r.p2 && r.p2.name) === k ? 2 : 0; if (!sd) continue;
    if (r.winner === sd) w++; else l++;
  }
  return w + l ? `${w}–${l}` : '';
}

/** the set these two are playing, in the bracket: { side: 'W' | 'L' | 'GF', i (column, or which GF set), cols, card, flip } */
function findSet(m, a, b) {
  if (!m) return null;
  const ka = key(a), kb = key(b);
  const hit = c => { const x = key(c.a && c.a.name), y = key(c.b && c.b.name); return x === ka && y === kb ? 1 : x === kb && y === ka ? 2 : 0; };
  // the one being played beats one already done (a runback in losers after a winners meeting)
  let best = null;
  const look = (side, cols) => cols.forEach((col, i) => (col.sets || []).forEach(card => { const h = hit(card); if (!h) return; const score = card.done ? 1 : 2; if (!best || score > best.score || (score === best.score && side === 'L')) best = { side, i, cols, card, flip: h === 2, score }; }));
  look('W', m.winners || []); look('L', m.losers || []);
  (m.gf || []).forEach((card, i) => { const h = hit(card); if (h && (!best || (card.done ? 1 : 2) > best.score || (card.done && best.score === 1))) best = { side: 'GF', i, cols: null, card, flip: h === 2, score: card.done ? 1 : 2 }; });
  return best;
}
const roundOf = (m, id) => { for (const col of [...(m.winners || []), ...(m.losers || [])]) for (const c of col.sets || []) if (c.id === id) return c.round || col.name || ''; for (const c of m.gf || []) if (c.id === id) return c.round || 'Grand Final'; return ''; };
const nice = r => String(r || '').replace(/\s+/g, ' ').trim();

/**
 * Where the set sends each side (1 and 2 as on the scoreboard): { 1: { win, lose }, 2: { win, lose } } — what it says if that
 * player wins, and if they lose. null when the set isn't in the bracket. l1 / l2: the scoreboard's [L] marks (grand final).
 */
function nextOf(m, a, b, l1, l2) {
  const f = findSet(m, a, b); if (!f) return null;
  const out = { 1: {}, 2: {} }, DE = m.type !== 'SE';
  if (f.side === 'GF') {
    // the grand final: the player from losers (their [L] on the scoreboard, or the bottom slot) has to win twice
    const lsd = l1 && !l2 ? 1 : l2 && !l1 ? 2 : f.flip ? 1 : 2;
    if (f.i === 0 && DE && (m.gf || []).length !== 0) {
      out[lsd] = { win: 'Bracket reset', lose: '2nd place' };
      out[3 - lsd] = { win: 'Champion', lose: 'Bracket reset' };
    } else { out[1] = { win: 'Champion', lose: '2nd place' }; out[2] = { win: 'Champion', lose: '2nd place' }; }
    return out;
  }
  const up = f.card.parent ? nice(roundOf(m, f.card.parent)) : '';
  const last = f.cols.length - 1 - f.i;                     // 0: the side's final
  let win, lose;
  if (f.side === 'W') {
    win = up ? `Advances to ${up}` : DE ? 'Advances to Grand Final' : 'Champion';
    lose = DE ? 'Drops to Losers' : `Eliminated · ${ord(last === 0 ? 2 : 2 ** last + 1)} place`;
  } else {
    win = up ? `Advances to ${up}` : 'Advances to Grand Final';
    const h = Math.floor(last / 2);
    lose = `Eliminated · ${ord(2 ** (h + 1) + 1 + (last % 2 ? 2 ** h : 0))} place`;
  }
  out[1] = { win, lose }; out[2] = { win, lose };
  return out;
}

function tale(s, o = {}) {
  s = s || {}; const p1 = s.p1 || {}, p2 = s.p2 || {}, a = String(p1.name || '').trim(), b = String(p2.name || '').trim();
  if (!real(a) || !real(b) || key(a) === key(b)) return null;
  const since = Number(o.since) || 0, seed = n => { try { return Number(o.seedOf && o.seedOf(n)) || 0; } catch { return 0; } };
  const side = (p, n) => { const sd = seed(n), rec = since ? today(o.rows, n, since) : ''; return { seed: sd || '', today: rec, line: [sd ? `Seed ${sd}` : '', rec ? `${rec} today` : ''].filter(Boolean).join(' · ') }; };
  const L = side(p1, a), R = side(p2, b), story = o.story || {}, hv = o.hist || null;
  // the middle: a runback says more than the head-to-head; a first meeting says so
  const mid = story.runback && story.runback.text ? `Runback — ${story.runback.text}` : hv && hv.line ? (hv.line === 'First meeting' ? 'First meeting on stream' : hv.line) : '';
  const nx = nextOf(o.bracket, a, b, !!p1.loser, !!p2.loser);
  // who has won the set: the scoreboard's own mark, or the score against the set's length (first to n)
  const bo = String(s.bestOf == null ? '' : s.bestOf).trim(), ft = /^FT/i.test(bo) ? Number(bo.replace(/^FT\s*/i, '')) || 0 : Math.ceil((Number(bo) || 0) / 2);
  const s1 = Number(p1.score) || 0, s2 = Number(p2.score) || 0;
  const w = Number(s.winnerSide) || (ft && s1 >= ft && s1 > s2 ? 1 : ft && s2 >= ft && s2 > s1 ? 2 : 0);
  const out = { p1: L, p2: R, mid, strip: !!(L.line || R.line || mid), runback: !!(story.runback && story.runback.text) };
  if (nx) out.next = nx;
  if (w && nx) { out.win = nx[w].win || ''; out.lose = nx[3 - w].lose || ''; }
  if (story.end && story.end.kind) out.badge = { kind: story.end.kind, title: story.end.kind === 'sweep' ? `Flawless ${String(story.end.text || '').match(/\d+–0/) ? String(story.end.text).match(/\d+–0/)[0] : ''}`.trim() : story.end.title || '', text: story.end.text || '' };
  return out;
}

module.exports = { tale, today, findSet, nextOf, ord };
