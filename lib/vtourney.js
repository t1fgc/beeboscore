'use strict';
/*
 * Viewer tournaments: Twitch chat signs up (!join / !enter), BeeboScore draws a single- or double-elimination bracket,
 * the matches are played on the normal scoreboard and the bracket splash shows it live.
 * Pure functions on a plain object (saved to vtourney.json by server.js).
 *
 *   t = { v, id, name, type: 'SE' | 'DE', status: 'signup' | 'live' | 'done', open, ft, max, seeding,
 *         checkin: null | { open, at }, entrants[], sets[], champion, seq }
 *   an entrant = { id, name, login, avatar, at, seed, here (checked in), dq }
 *   a set = { id, side: 'W' | 'L' | 'GF', round (1 = first), idx, a, b (entrant ids, '' = not known yet, 'bye'),
 *             w (winner id), sa, sb (games), ff (a forfeit / DQ: the side that didn't play), bye,
 *             from: [src, src] }  where src = '' (a seed) or { s: setId, t: 'w' | 'l' } (that set's winner / loser)
 *
 * Double elimination: the usual losers bracket (losers of each winners round drop in, alternating sides so early
 * rematches are rare), a grand final, and a reset when the player from the losers side wins the first one.
 *
 * Round robin ('RR', optionally split into pools) and Swiss ('SW'): group sets (side 'RR' / 'SW', with a pool for
 * round robin) and a table; Swiss pairs each round once the last one is done (same records meet, no rematches when
 * it can help it, a bye for the odd one out). Either can end with a top cut (t.cut = 2…16): a single-elimination
 * bracket (side 'W') seeded from the tables — pool winners first.
 * Stations (t.stations = how many setups besides the stream): ready matches get the next free one.
 *
 * toRaw() turns it into the same shape start.gg sends, so lib/bracket.js builds the splash model from it — and when
 * a single-elimination round is too big for one screen, view() says so and the splash shows pages of match cards.
 */
const uid = () => Math.random().toString(36).slice(2, 10);
const S = v => String(v == null ? '' : v).trim();
const cleanName = s => S(s).replace(/[<>]/g, '').slice(0, 25);
const cleanLogin = s => S(s).replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
const GROUP = t => t.type === 'RR' || t.type === 'SW';
const isGroup = s => s.side === 'RR' || s.side === 'SW';
const POOL = i => String.fromCharCode(65 + i);
const FIT = 16;                         // a bracket column holds 16 matches; a bigger round is shown as pages of cards

function create(o = {}) {
  return normalize({ v: 2, name: S(o.name) || 'Viewer Tournament', type: o.type, status: 'signup', open: false, ft: o.ft || 2, max: o.max || 0, seeding: o.seeding || 'random',
    pools: o.pools, swissRounds: o.swissRounds, cut: o.cut, stations: o.stations, entrants: [], sets: [], champion: '', seq: 1, events: [] });
}
function normalize(t) {
  t = { ...t };
  t.id = S(t.id) || uid();
  t.name = S(t.name).slice(0, 40) || 'Viewer Tournament';
  t.type = ['DE', 'RR', 'SW'].includes(t.type) ? t.type : 'SE';
  t.pools = t.type === 'RR' ? Math.max(1, Math.min(8, Math.floor(Number(t.pools) || 1))) : 1;
  t.swissRounds = t.type === 'SW' ? Math.max(0, Math.min(12, Math.floor(Number(t.swissRounds) || 0))) : 0;
  t.cut = GROUP(t) && [2, 4, 8, 16].includes(Number(t.cut)) ? Number(t.cut) : 0;
  t.stations = Math.max(0, Math.min(32, Math.floor(Number(t.stations) || 0)));
  t.ft = Math.max(1, Math.min(5, Math.floor(Number(t.ft) || 2)));
  t.max = Math.max(0, Math.min(512, Math.floor(Number(t.max) || 0)));
  t.seeding = ['random', 'order'].includes(t.seeding) ? t.seeding : 'random';
  t.checkin = t.checkin && typeof t.checkin === 'object' ? { open: !!t.checkin.open, at: Number(t.checkin.at) || Date.now() } : null;
  t.entrants = (t.entrants || []).filter(e => e && S(e.name)).map(e => ({ id: S(e.id) || uid(), name: cleanName(e.name), login: cleanLogin(e.login), avatar: S(e.avatar).slice(0, 500), at: Number(e.at) || Date.now(),
    ...(e.seed ? { seed: Number(e.seed) } : {}), ...(e.here ? { here: true } : {}), ...(e.dq ? { dq: true } : {}) }));
  t.sets = (t.sets || []).map(s => ({ ...s, side: s.side || 'W', from: (s.from || ['', '']).map(f => !f ? '' : typeof f === 'string' ? { s: f, t: 'w' } : f) }));
  t.events = t.events || [];
  return t;
}
// events: what the last change did; feed: the last 60 of them with their seq (several changes can happen between two saves)
const bump = (t, events) => { t.seq = (t.seq || 0) + 1; t.events = events; t.feed = [...(t.feed || []), ...events.map(e => ({ ...e, seq: t.seq }))].slice(-60); return t; };
const byId = (t, id) => t.entrants.find(e => e.id === id);

/** a viewer signs up (from chat, or added by hand) → { ok, code } */
function join(t, { name, login, avatar } = {}, { force = false } = {}) {
  name = cleanName(name || login); login = cleanLogin(login);
  if (!name || !/[\p{L}\p{N}]/u.test(name)) return { ok: false, code: 'name' };     // only symbols / spaces
  if (t.status !== 'signup') return { ok: false, code: 'started' };
  const same = login && t.entrants.find(e => e.login === login);
  if (same) { if (same.name !== name && !t.entrants.some(e => e !== same && e.name.toLowerCase() === name.toLowerCase())) { same.name = name; bump(t, [{ type: 'rename', name }]); } return { ok: false, code: 'already' }; }
  if (!force && !t.open) return { ok: false, code: 'closed' };
  if (t.entrants.some(e => e.name.toLowerCase() === name.toLowerCase())) return { ok: false, code: 'already' };
  if (!force && t.max && t.entrants.length >= t.max) return { ok: false, code: 'full' };
  t.entrants.push({ id: uid(), name, login, avatar: S(avatar), at: Date.now(), ...(t.checkin && force ? { here: true } : {}) });
  bump(t, [{ type: 'join', name }]);
  return { ok: true, n: t.entrants.length };
}
function leave(t, key) {
  if (t.status !== 'signup') return { ok: false, code: 'started' };
  const i = t.entrants.findIndex(e => e.id === key || (key && e.login === cleanLogin(key)) || e.name.toLowerCase() === S(key).toLowerCase());
  if (i < 0) return { ok: false, code: 'missing' };
  const [e] = t.entrants.splice(i, 1); bump(t, [{ type: 'leave', name: e.name }]);
  return { ok: true };
}

// ------------------------------------------------------------ check-in and seeding (before the bracket is drawn)
/** start / stop check-in: players say they're here (!here); only they make the bracket */
function setCheckin(t, open) {
  if (t.status !== 'signup') throw new Error('The bracket has already started.');
  if (open) { t.checkin = { open: true, at: Date.now() }; t.entrants.forEach(e => { delete e.here; }); t.open = false; }
  else if (t.checkin) t.checkin.open = false;
  return bump(t, [{ type: open ? 'checkin' : 'checkin-closed' }]);
}
function checkIn(t, key, here = true) {
  if (t.status !== 'signup' || !t.checkin) return { ok: false, code: 'nocheckin' };
  const e = t.entrants.find(x => x.id === key || (key && x.login === cleanLogin(key)) || x.name.toLowerCase() === S(key).toLowerCase());
  if (!e) return { ok: false, code: 'missing' };
  if (!t.checkin.open && here) return { ok: false, code: 'closed' };
  if (!!e.here === here) return { ok: false, code: 'already', name: e.name };
  if (here) e.here = true; else delete e.here;
  bump(t, [{ type: 'here', name: e.name }]);
  return { ok: true, name: e.name, n: t.entrants.filter(x => x.here).length };
}
/** reorder the seeds by hand (ids, best first), or shuffle them */
function reseed(t, order) {
  if (t.status !== 'signup') throw new Error('The bracket has already started.');
  if (order === 'shuffle') { for (let i = t.entrants.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t.entrants[i], t.entrants[j]] = [t.entrants[j], t.entrants[i]]; } }
  else if (Array.isArray(order)) {
    const pos = new Map(order.map((id, i) => [String(id), i]));
    t.entrants.sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6) - (pos.has(b.id) ? pos.get(b.id) : 1e6));
  }
  t.seeding = 'order';
  return bump(t, [{ type: 'reseed' }]);
}

// standard seed order for a bracket of n (1 v n, 2 v n-1 … placed so 1 and 2 can only meet in the final)
function seedOrder(n) { let o = [1]; while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap(s => [s, m - s]); } return o; }
const roundName = (r, R) => r === R ? 'Final' : r === R - 1 ? 'Semi-Final' : r === R - 2 ? 'Quarter-Final' : `Round of ${2 ** (R - r + 1)}`;
function setName(t, s) {
  const R = t.rounds || 0;
  if (s.side === 'RR') return `${t.pools > 1 ? `Pool ${POOL(s.pool)} · ` : ''}Round ${s.round}`;
  if (s.side === 'SW') return `Swiss Round ${s.round}${t.swissRounds ? ` of ${t.swissRounds}` : ''}`;
  if (GROUP(t)) return `Top ${2 ** R} · ${roundName(s.round, R)}`;
  if (t.type !== 'DE') return roundName(s.round, R);
  if (s.side === 'GF') return s.round === 2 ? 'Grand Final Reset' : 'Grand Final';
  if (s.side === 'L') { const L = 2 * (R - 1); return s.round === L ? 'Losers Final' : s.round === L - 1 ? 'Losers Semi-Final' : s.round === L - 2 ? 'Losers Quarter-Final' : `Losers Round ${s.round}`; }
  return s.round === R ? 'Winners Final' : s.round === R - 1 ? 'Winners Semi-Final' : s.round === R - 2 ? 'Winners Quarter-Final' : `Winners Round ${s.round}`;
}
// the order matches are played in: W1, L1, W2, L2, L3, W3, L4, L5, W4 … then the grand final
function playOrder(s) {
  if (isGroup(s)) return -1000 + s.round;
  if (s.side === 'GF') return 1000 + s.round;
  if (s.side === 'W') return s.round === 1 ? 0 : 3 * s.round - 4;            // W1 0, W2 2, W3 5, W4 8 …
  return s.round === 1 ? 1 : s.round % 2 === 0 ? 3 * (s.round / 2) : 3 * ((s.round - 1) / 2) + 1;   // L1 1, L2 3, L3 4, L4 6, L5 7 …
}

/** close signups and draw the bracket */
function generate(t, rand = Math.random) {
  let list = t.entrants.slice();
  if (t.checkin) { list = list.filter(e => e.here); if (list.length < 2) throw new Error('At least 2 players have to check in first.'); t.entrants = list; }
  if (list.length < 2) throw new Error('At least 2 players have to sign up first.');
  if (t.seeding === 'random') for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  list.forEach((e, i) => { e.seed = i + 1; delete e.dq; });
  t.entrants = list;
  if (GROUP(t)) {
    t.sets = t.type === 'RR' ? roundRobin(t, list) : swissRound(t, 1);
    t.status = 'live'; t.open = false; t.champion = ''; t.rounds = 0; t.now = '';
    if (t.checkin) t.checkin.open = false;
    settle(t);
    return bump(t, [{ type: 'start' }]);
  }
  const size = 2 ** Math.ceil(Math.log2(list.length)), R = Math.log2(size), order = seedOrder(size), sets = [];
  const W = (r, i) => `r${r}m${i + 1}`, L = (k, i) => `l${k}m${i + 1}`;
  for (let r = 1; r <= R; r++) for (let i = 0; i < size / 2 ** r; i++)
    sets.push({ id: W(r, i), side: 'W', round: r, idx: i, a: '', b: '', w: '', sa: null, sb: null, from: r === 1 ? ['', ''] : [{ s: W(r - 1, i * 2), t: 'w' }, { s: W(r - 1, i * 2 + 1), t: 'w' }] });
  if (t.type === 'DE') {
    for (let k = 1; k <= R - 1; k++) {
      // odd round 2k-1: L1 pairs the winners-round-1 losers; later odd rounds pair the previous losers round's winners
      const n1 = size / 2 ** (k + 1);
      for (let i = 0; i < n1; i++) sets.push({ id: L(2 * k - 1, i), side: 'L', round: 2 * k - 1, idx: i, a: '', b: '', w: '', sa: null, sb: null,
        from: k === 1 ? [{ s: W(1, i * 2), t: 'l' }, { s: W(1, i * 2 + 1), t: 'l' }] : [{ s: L(2 * k - 2, i * 2), t: 'w' }, { s: L(2 * k - 2, i * 2 + 1), t: 'w' }] });
      // even round 2k: those winners meet the players dropping from winners round k+1 (reversed every other round)
      for (let i = 0; i < n1; i++) { const d = k % 2 ? n1 - 1 - i : i;
        sets.push({ id: L(2 * k, i), side: 'L', round: 2 * k, idx: i, a: '', b: '', w: '', sa: null, sb: null, from: [{ s: L(2 * k - 1, i), t: 'w' }, { s: W(k + 1, d), t: 'l' }] }); }
    }
    const lf = R > 1 ? { s: L(2 * (R - 1), 0), t: 'w' } : { s: W(1, 0), t: 'l' };
    sets.push({ id: 'gf1', side: 'GF', round: 1, idx: 0, a: '', b: '', w: '', sa: null, sb: null, from: [{ s: W(R, 0), t: 'w' }, lf] });
    sets.push({ id: 'gf2', side: 'GF', round: 2, idx: 0, a: '', b: '', w: '', sa: null, sb: null, from: [{ s: 'gf1', t: 'w' }, { s: 'gf1', t: 'l' }], reset: true });
  }
  const seat = s => (s <= list.length ? list[s - 1].id : 'bye');
  for (let i = 0; i < size / 2; i++) { const s = sets[i]; s.a = seat(order[i * 2]); s.b = seat(order[i * 2 + 1]); }
  t.sets = sets; t.status = 'live'; t.open = false; t.champion = ''; t.rounds = R; t.now = '';
  if (t.checkin) t.checkin.open = false;
  settle(t);
  return bump(t, [{ type: 'start' }]);
}
const loserOf = s => s.w === s.a ? s.b : s.a;

// ------------------------------------------------------------ round robin, Swiss, top cut
function roundRobin(t, list) {
  const P = Math.max(1, Math.min(t.pools, Math.floor(list.length / 2))), pools = Array.from({ length: P }, () => []);
  list.forEach((e, i) => { const row = Math.floor(i / P), col = i % P; pools[row % 2 ? P - 1 - col : col].push(e.id); });   // snake: every pool gets a fair mix of seeds
  if (pools.some(p => p.length > 16)) throw new Error(`That's ${Math.ceil(list.length / P)} players a pool — use more pools (16 at most each).`);
  t.pools = P;
  const sets = [];
  pools.forEach((ids, pi) => {
    const arr = ids.length % 2 ? [...ids, 'bye'] : ids.slice(), n = arr.length;
    for (let r = 0; r < n - 1; r++) {
      let m = 0;
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a === 'bye' || b === 'bye') continue;
        sets.push({ id: `p${pi + 1}r${r + 1}m${++m}`, side: 'RR', pool: pi, round: r + 1, idx: m - 1, a: r % 2 ? b : a, b: r % 2 ? a : b, w: '', sa: null, sb: null, from: ['', ''] });
      }
      arr.splice(1, 0, arr.pop());              // the circle method: everyone but the first moves round one place
    }
  });
  return sets;
}
/** the table: wins, then game difference, then opponents' wins (Buchholz), then seed; DQs at the bottom */
function table(t, pool = null) {
  const sets = t.sets.filter(s => isGroup(s) && (pool == null || s.pool === pool));
  const ids = new Set(); for (const s of sets) for (const k of ['a', 'b']) if (s[k] && s[k] !== 'bye') ids.add(s[k]);
  if (t.type === 'SW' && pool == null) for (const e of t.entrants) ids.add(e.id);
  const rows = new Map([...ids].map(id => { const e = byId(t, id) || {}; return [id, { id, name: e.name || '', seed: e.seed || 0, dq: !!e.dq, w: 0, l: 0, gw: 0, gl: 0, bye: 0, opp: [], pool: null }]; }));
  for (const s of sets) {
    for (const k of ['a', 'b']) if (rows.has(s[k]) && s.pool != null) rows.get(s[k]).pool = s.pool;
    if (!s.w || s.w === 'none') continue;
    if (s.bye) { const r = rows.get(s.w); if (r) { r.w++; r.bye++; } continue; }
    const W = rows.get(s.w), L = rows.get(loserOf(s)); if (!W || !L) continue;
    W.w++; L.l++; W.opp.push(L.id); L.opp.push(W.id);
    if (!s.ff) { const ga = Number(s.sa) || 0, gb = Number(s.sb) || 0, wa = s.w === s.a; W.gw += wa ? ga : gb; W.gl += wa ? gb : ga; L.gw += wa ? gb : ga; L.gl += wa ? ga : gb; }
  }
  const list = [...rows.values()];
  for (const r of list) r.bh = r.opp.reduce((n, id) => n + ((rows.get(id) || {}).w || 0), 0);
  list.sort((a, b) => (a.dq - b.dq) || (b.w - a.w) || ((b.gw - b.gl) - (a.gw - a.gl)) || (b.bh - a.bh) || (a.seed - b.seed));
  list.forEach((r, i) => { r.rank = i + 1; });
  return list;
}
const groupSets = t => t.sets.filter(isGroup);
const groupDone = t => { const g = groupSets(t); if (!g.length || g.some(s => !s.w)) return false; return t.type !== 'SW' || Math.max(...g.map(s => s.round)) >= swissTotal(t); };
const swissTotal = t => t.swissRounds || Math.max(1, Math.ceil(Math.log2(Math.max(2, t.entrants.length))));
/** pair a Swiss round: round 1 by seed (top half v bottom half), later rounds by record without rematches when possible */
function swissRound(t, r) {
  const live = t.entrants.filter(e => !e.dq);
  let order;
  if (r === 1) order = live.slice().sort((a, b) => a.seed - b.seed).map(e => e.id);
  else { const tb = table(t).filter(x => !x.dq); order = tb.map(x => x.id); }
  const played = new Set(); for (const s of groupSets(t)) if (s.a && s.b) { played.add(s.a + '|' + s.b); played.add(s.b + '|' + s.a); }
  const sets = [];
  let bye = '';
  if (order.length % 2) {                                   // the odd one out: the lowest player who hasn't had a bye
    const had = new Set(groupSets(t).filter(s => s.bye).map(s => s.a));
    bye = [...order].reverse().find(id => !had.has(id)) || order[order.length - 1];
    order = order.filter(id => id !== bye);
  }
  if (r === 1) { const h = order.length / 2; for (let i = 0; i < h; i++) sets.push([order[i], order[i + h]]); }
  else {
    const left = order.slice();
    while (left.length) {
      const a = left.shift(); let j = left.findIndex(b => !played.has(a + '|' + b)); if (j < 0) j = 0;
      sets.push([a, left.splice(j, 1)[0]]);
    }
  }
  const out = sets.map(([a, b], i) => ({ id: `s${r}m${i + 1}`, side: 'SW', round: r, idx: i, a, b, w: '', sa: null, sb: null, from: ['', ''] }));
  if (bye) out.push({ id: `s${r}bye`, side: 'SW', round: r, idx: out.length, a: bye, b: 'bye', w: '', sa: null, sb: null, from: ['', ''] });
  return out;
}
/** who makes the top cut, best first: by place in their pool, then record */
function qualifiers(t) {
  const K = t.cut, P = t.type === 'RR' ? t.pools : 1;
  const tables = t.type === 'RR' ? Array.from({ length: P }, (_, i) => table(t, i).filter(x => !x.dq)) : [table(t).filter(x => !x.dq)];
  const per = Math.floor(K / P), out = [];
  if (per >= 1) for (let j = 0; j < per; j++) out.push(...tables.map(tb => tb[j]).filter(Boolean).sort((a, b) => (b.w - a.w) || ((b.gw - b.gl) - (a.gw - a.gl)) || (a.seed - b.seed)));
  const rest = tables.flatMap(tb => tb).filter(x => !out.includes(x)).sort((a, b) => (a.rank - b.rank) || (b.w - a.w) || ((b.gw - b.gl) - (a.gw - a.gl)) || (a.seed - b.seed));
  while (out.length < K && rest.length) out.push(rest.shift());
  return out.slice(0, K).map(x => x.id);
}
function makeCut(t) {
  const ids = qualifiers(t); if (ids.length < 2) return false;
  const size = 2 ** Math.ceil(Math.log2(ids.length)), R = Math.log2(size), order = seedOrder(size);
  const W = (r, i) => `r${r}m${i + 1}`;
  const sets = [];
  for (let r = 1; r <= R; r++) for (let i = 0; i < size / 2 ** r; i++)
    sets.push({ id: W(r, i), side: 'W', round: r, idx: i, a: '', b: '', w: '', sa: null, sb: null, from: r === 1 ? ['', ''] : [{ s: W(r - 1, i * 2), t: 'w' }, { s: W(r - 1, i * 2 + 1), t: 'w' }] });
  for (let i = 0; i < size / 2; i++) { sets[i].a = order[i * 2] <= ids.length ? ids[order[i * 2] - 1] : 'bye'; sets[i].b = order[i * 2 + 1] <= ids.length ? ids[order[i * 2 + 1] - 1] : 'bye'; }
  t.cutIds = ids; t.rounds = R; t.sets.push(...sets);
  return true;
}
function stations(t) {
  if (!t.stations) return;
  const busy = new Set(t.sets.filter(s => !s.w && s.station).map(s => s.station));
  for (const s of t.sets) if (!s.w && real(s) && s.station && t.now === s.id) { busy.delete(s.station); delete s.station; }   // on stream instead
  const ord = t.sets.filter(s => !s.w && real(s) && !s.station && t.now !== s.id).sort((x, y) => playOrder(x) - playOrder(y) || x.idx - y.idx || (x.pool || 0) - (y.pool || 0));
  for (const s of ord) { let n = 1; while (busy.has(n) && n <= t.stations) n++; if (n > t.stations) break; s.station = n; busy.add(n); }
}
/** move results along: winners and losers into their next sets, byes and DQs resolve themselves */
function settle(t) {
  for (let pass = 0; pass < 64; pass++) {
    let moved = false;
    for (const s of t.sets) {
      // fill the slots from the sets that feed this one
      s.from.forEach((f, j) => {
        if (!f) return; const k = j ? 'b' : 'a'; if (s[k]) return;
        const src = t.sets.find(x => x.id === f.s); if (!src || !src.w) return;
        const v = f.t === 'w' ? src.w : loserOf(src);
        if (v) { s[k] = v; moved = true; }
      });
      if (s.w || !s.a || !s.b) continue;
      if (s.reset) {                                  // the reset only happens when the losers-side player won the grand final
        const g1 = t.sets.find(x => x.id === 'gf1');
        if (g1 && g1.w && g1.w === g1.a) { s.skip = true; s.w = 'none'; moved = true; continue; }
      }
      const dqA = s.a === 'bye' || (byId(t, s.a) || {}).dq, dqB = s.b === 'bye' || (byId(t, s.b) || {}).dq;
      if (dqA || dqB) {
        if (s.a === 'bye' && s.b === 'bye') s.w = 'bye';
        else if (dqA && dqB) s.w = s.a === 'bye' ? s.b : s.a;     // both gone: either goes through (and loses straight away)
        else s.w = dqA ? s.b : s.a;
        if (s.a === 'bye' || s.b === 'bye') s.bye = true; else s.ff = dqA ? 'a' : 'b';
        moved = true;
      }
    }
    if (!moved) break;
  }
  if (t.type === 'SW' && t.status !== 'signup') {          // the next Swiss round, once this one is done
    const g = groupSets(t), r = Math.max(0, ...g.map(s => s.round));
    if (r && r < swissTotal(t) && g.filter(s => s.round === r).every(s => s.w)) { t.sets.push(...swissRound(t, r + 1)); return settle(t); }
  }
  if (GROUP(t) && t.cut && groupDone(t) && !t.sets.some(s => s.side === 'W') && makeCut(t)) return settle(t);
  stations(t);
  // finished?
  const fin = GROUP(t) && !t.sets.some(s => s.side === 'W') ? (groupDone(t) ? (table(t)[0] || {}).id || '' : '')
    : t.type === 'DE' ? (() => { const g1 = t.sets.find(x => x.id === 'gf1'), g2 = t.sets.find(x => x.id === 'gf2'); return g1 && g1.w ? (g2.skip ? g1.w : g2.w && g2.w !== 'none' ? g2.w : '') : ''; })()
    : (() => { const f = t.sets.find(x => x.side === 'W' && x.round === t.rounds); return f && f.w ? f.w : ''; })();
  if (fin && fin !== 'bye') { t.status = 'done'; t.champion = fin; }
  else if (t.status === 'done') { t.status = 'live'; t.champion = ''; }
}
const real = s => s.a && s.b && s.a !== 'bye' && s.b !== 'bye' && !s.skip;
/** the matches ready to play, in order */
const ready = t => t.sets.filter(s => !s.w && real(s)).sort((x, y) => playOrder(x) - playOrder(y) || x.idx - y.idx || (x.pool || 0) - (y.pool || 0));
/** a result: winner is 'a' | 'b' | an entrant id; ff = a forfeit (the loser didn't play) */
function report(t, setId, winner, sa = null, sb = null, { ff = false } = {}) {
  const s = t.sets.find(x => x.id === setId);
  if (!s || !real(s)) throw new Error('That match isn’t ready yet.');
  if (s.w) throw new Error('That match already has a result.');
  const w = winner === 'a' ? s.a : winner === 'b' ? s.b : winner;
  if (w !== s.a && w !== s.b) throw new Error('The winner has to be one of the two players.');
  s.w = w; s.sa = ff ? null : sa; s.sb = ff ? null : sb; if (ff) s.ff = w === s.a ? 'b' : 'a';
  if (t.now === s.id) t.now = '';
  settle(t);
  const ev = [{ type: ff ? 'forfeit' : 'result', set: s.id, winner: byId(t, w).name, loser: byId(t, w === s.a ? s.b : s.a).name }];
  if (t.status === 'done') ev.push({ type: 'done', champion: byId(t, t.champion).name });
  return bump(t, ev);
}
/** take a player out of the tournament: every match they have left is a forfeit */
function dq(t, key) {
  if (t.status === 'signup') throw new Error('Remove them from the list instead — the bracket hasn’t started.');
  const e = t.entrants.find(x => x.id === key || x.name.toLowerCase() === S(key).toLowerCase());
  if (!e) throw new Error('No such player.');
  if (e.dq) throw new Error(`${e.name} is already out.`);
  e.dq = true;
  for (const s of t.sets) if (!s.w && real(s) && (s.a === e.id || s.b === e.id)) { s.w = s.a === e.id ? s.b : s.a; s.ff = s.a === e.id ? 'a' : 'b'; if (t.now === s.id) t.now = ''; }
  settle(t);
  return bump(t, [{ type: 'dq', name: e.name }]);
}
function setNow(t, setId) { t.now = setId; stations(t); return bump(t, [{ type: 'next', set: setId }]); }

/** where everyone finished (or went out so far): id → place */
function placements(t) {
  const out = new Map(), R = t.rounds || 0;
  if (t.status === 'signup') return out;
  if (GROUP(t)) {
    const cutSets = t.sets.filter(x => x.side === 'W');
    if (!cutSets.length) { if (t.status === 'done') table(t).forEach((r, i) => out.set(r.id, i + 1)); return out; }
    const inCut = new Set(t.cutIds || []);
    const rest = (t.type === 'RR' ? Array.from({ length: t.pools }, (_, i) => table(t, i)).flat() : table(t)).filter(x => !inCut.has(x.id))
      .sort((a, b) => (a.dq - b.dq) || (a.rank - b.rank) || (b.w - a.w) || ((b.gw - b.gl) - (a.gw - a.gl)) || (a.seed - b.seed));
    rest.forEach((r, i) => out.set(r.id, inCut.size + 1 + i));
    for (const s of cutSets.filter(x => x.w && real(x))) out.set(loserOf(s), 2 ** (R - s.round) + 1);
    if (t.status === 'done') out.set(t.champion, 1);
    return out;
  }
  if (t.type === 'DE') {
    const maxL = 2 * (R - 1);
    for (const s of t.sets.filter(x => x.side === 'L' && x.w && real(x))) {
      const d = maxL - s.round, h = Math.floor(d / 2);
      out.set(loserOf(s), 2 ** (h + 1) + 1 + (d % 2 ? 2 ** h : 0));
    }
    const g1 = t.sets.find(x => x.id === 'gf1'), g2 = t.sets.find(x => x.id === 'gf2');
    const last = g2 && g2.w && g2.w !== 'none' ? g2 : g1;
    if (t.status === 'done' && last && last.w) { out.set(loserOf(last), 2); out.set(last.w, 1); }
    if (R === 1 && g1 && g1.w && !out.has(loserOf(g1)) && t.status === 'done') out.set(loserOf(g1), 2);
  } else {
    for (const s of t.sets.filter(x => x.w && real(x))) out.set(loserOf(s), 2 ** (R - s.round) + 1);
    if (t.status === 'done') out.set(t.champion, 1);
  }
  return out;
}

const current = t => { const R = t.rounds || Math.max(0, ...t.sets.filter(s => !isGroup(s)).map(s => s.round)); return Math.min(R, ...(ready(t).filter(s => s.side === 'W').map(s => s.round)), ...(t.status === 'done' ? [R] : [])); };
// the tree from round r fits the screen when no round from r on has more than 16 real matches
const fits = (t, r) => { const R = t.rounds || 0; for (let k = r; k <= R; k++) if (t.sets.filter(s => s.side === 'W' && s.round === k && !s.bye).length > FIT) return false; return true; };
/** start.gg-shaped data for lib/bracket.js — single elimination from the round being played on, so the live round is
 *  always on screen; double elimination as winners (rounds 1…), losers (rounds -1…) and the grand final */
function toRaw(t) {
  const R = t.rounds || Math.max(0, ...t.sets.filter(s => !isGroup(s)).map(s => s.round));
  const nm = id => (byId(t, id) || {}).name || '';
  const DE = t.type === 'DE';
  let first = 1;
  if (!DE) { const cur = current(t), from = Math.max(1, Math.min(cur, R - 3)); first = from; while (first < cur && !fits(t, first)) first++; }
  const keep = s => isGroup(s) ? false : DE ? !s.bye && !s.skip && !(s.w === 'bye') : s.round >= first && !(s.round === 1 && s.bye);
  const kept = new Set(t.sets.filter(keep).map(s => s.id));
  const rnd = s => s.side === 'L' ? -s.round : s.side === 'GF' ? R + s.round : s.round;
  const sets = t.sets.filter(keep).map(s => ({
    id: s.id, identifier: s.id, round: rnd(s), station: !s.w && s.station ? s.station : 0, roundText: DE ? setName(t, s) : roundName(s.round, R), state: s.w ? 3 : t.now === s.id ? 2 : 1, winnerId: s.w && s.w !== 'none' ? s.w : null,
    slots: [['a', 0], ['b', 1]].map(([k, j]) => { const f = s.from[j]; const linked = f && kept.has(f.s);
      return { entrantId: s[k] && s[k] !== 'bye' ? s[k] : null, name: nm(s[k]), seed: (byId(t, s[k]) || {}).seed || '', score: s.w ? (s.ff ? (s.ff === k ? -1 : null) : j ? s.sb : s.sa) : null,
        prereqId: linked ? f.s : null, prereqType: linked ? 'set' : (s[k] === 'bye' ? 'bye' : 'seed'), prereqPlacement: f && f.t === 'l' ? 2 : 1 }; }),
  }));
  return { type: DE ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION', sets, pool: '' };
}
/** what the panel and the splash need */
function view(t) {
  const R = t.rounds || 0, nm = id => (byId(t, id) || {}).name || '';
  const pl = placements(t);
  const alive = t.status === 'signup' ? t.entrants.length : t.status === 'done' ? 1 : t.entrants.filter(e => !pl.has(e.id) && !e.dq).length;
  const rd = ready(t), cur = rd.length ? rd[0] : null;
  const big = t.status === 'live' && t.type !== 'DE' && cur && !isGroup(cur) && !fits(t, cur.round);
  const card = s => ({ id: s.id, round: setName(t, s), a: nm(s.a) || (s.a === 'bye' ? 'BYE' : ''), b: nm(s.b) || (s.b === 'bye' ? 'BYE' : ''), w: s.w && s.w !== 'none' ? (s.w === s.a ? 'a' : 'b') : '', sa: s.sa, sb: s.sb, ff: s.ff || '', now: t.now === s.id, ...(s.station && !s.w ? { station: s.station } : {}) });
  // round robin / Swiss: the tables, and the round being played as pages of match cards
  const inGroups = GROUP(t) && t.status !== 'signup' && !t.sets.some(s => s.side === 'W');
  const row = r => ({ name: r.name, w: r.w, l: r.l, gd: r.gw - r.gl, bh: r.bh, rank: r.rank, dq: r.dq, cut: !!(t.cutIds || []).includes(r.id) });
  const tables = GROUP(t) && t.status !== 'signup' ? (t.type === 'RR' ? Array.from({ length: t.pools }, (_, i) => ({ pool: t.pools > 1 ? POOL(i) : '', rows: table(t, i).map(row) })) : [{ pool: '', rows: table(t).map(row) }]) : null;
  const gCur = inGroups ? (() => { const g = groupSets(t), open = g.filter(s => !s.w && real(s)); return open.length ? Math.min(...open.map(s => s.round)) : Math.max(0, ...g.map(s => s.round)); })() : 0;
  const here = t.entrants.filter(e => e.here).length;
  const kind = { SE: 'SINGLE ELIMINATION', DE: 'DOUBLE ELIMINATION', RR: t.pools > 1 ? `${t.pools} POOLS · ROUND ROBIN` : 'ROUND ROBIN', SW: 'SWISS' }[t.type] + (t.cut ? ` → TOP ${t.cut}` : '');
  const groupGrid = inGroups && gCur ? { round: t.type === 'SW' ? `Swiss Round ${gCur}${` of ${swissTotal(t)}`}` : `Round ${gCur}`, kind, sets: groupSets(t).filter(s => s.round === gCur && !s.bye).map(card),
    table: tables.length === 1 ? tables[0].rows.slice(0, 12) : tables.map(x => ({ pool: x.pool, rows: x.rows.slice(0, 4) })) } : null;
  return { name: t.name, type: t.type, pools: t.pools, swissRounds: GROUP(t) && t.type === 'SW' ? swissTotal(t) : 0, cut: t.cut, stations: t.stations, kind, tables, stage: inGroups ? 'groups' : GROUP(t) && t.status !== 'signup' ? 'cut' : '', status: t.status, open: t.open, ft: t.ft, max: t.max, seeding: t.seeding, count: t.entrants.length, alive, seq: t.seq,
    checkin: t.checkin ? { open: t.checkin.open, here, of: t.entrants.length } : null,
    entrants: t.entrants.map(e => ({ id: e.id, name: e.name, login: e.login, seed: e.seed || 0, here: !!e.here, dq: !!e.dq, out: pl.has(e.id) && pl.get(e.id) > 1, place: pl.get(e.id) || 0 })), champion: nm(t.champion),
    now: t.now ? card(t.sets.find(s => s.id === t.now)) : null, next: rd.filter(s => s.id !== t.now).slice(0, 6).map(card), ready: rd.length,
    round: cur ? setName(t, cur) : R ? (t.type === 'DE' ? 'Grand Final' : roundName(R, R)) : '', rounds: R,
    played: t.sets.filter(s => s.w && real(s)).length,
    total: t.sets.filter(s => !s.bye && !(s.reset && (s.skip || !s.a))).length + (t.type === 'SW' && inGroups ? Math.floor(t.entrants.filter(e => !e.dq).length / 2) * (swissTotal(t) - Math.max(0, ...groupSets(t).map(s => s.round))) : 0) + (inGroups && t.cut ? t.cut - 1 : 0),
    stationsNow: t.stations ? t.sets.filter(s => !s.w && real(s) && s.station).map(card).sort((a, b) => a.station - b.station) : [],
    // a round too big for one screen: the splash pages through its matches instead of drawing the tree
    grid: groupGrid || big ? groupGrid || { round: setName(t, cur), kind, sets: t.sets.filter(s => s.side === 'W' && s.round === cur.round && !s.bye).map(card) } : null };
}

module.exports = { create, normalize, join, leave, setCheckin, checkIn, reseed, generate, report, dq, setNow, ready, placements, toRaw, view, seedOrder, setName, table, FIT };
