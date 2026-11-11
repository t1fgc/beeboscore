'use strict';
/*
 * BeeboScore game formats — the engine (no I/O; server.js keeps it in the live state as state.format).
 *
 *   teams  : crew battle (winner stays), team battle Sajam Slam style (paired points + coach tiebreak), gauntlet (1 vs a line)
 *   elim   : Death Battle (lives, last one standing), King of the Hill (winner stays, streaks)
 *   league : round robin with standings
 *
 * Every single match inside a format is a normal BeeboScore set: the format says who plays (players()), the
 * Match tab scores it, and apply(fmt, winnerSide, score) records the result and works out the next match.
 * Each change bumps fmt.seq and lists what happened in fmt.events, so overlays can play the right effect.
 */

const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 9);
const S = v => String(v == null ? '' : v).trim();

const PRESETS = {
  crew: { kind: 'teams', name: 'Crew Battle', rules: { mode: 'stay', ft: 1, winLimit: 0, size: 4, coach: false, tiers: false } },
  sajam: { kind: 'teams', name: 'Team Battle', rules: { mode: 'paired', ft: 2, points: 0, tiebreak: 'coach', size: 4, coach: true, tiers: true } },
  gauntlet: { kind: 'teams', name: 'Gauntlet', rules: { mode: 'stay', ft: 1, winLimit: 0, size: 5, coach: false, tiers: false } },
  death: { kind: 'elim', name: 'Death Battle', rules: { mode: 'death', ft: 1, lives: 1, pick: 'stay' } },
  koth: { kind: 'elim', name: 'King of the Hill', rules: { mode: 'koth', ft: 1, pick: 'stay', streakGoal: 0 } },
  league: { kind: 'league', name: 'League', rules: { ft: 2, double: false } },
};
const TEAM_COLORS = ['#ff5a1f', '#7fd0ff'];

function person(p = {}) {
  return { id: S(p.id) || uid(), name: S(p.name).slice(0, 60), team: S(p.team).slice(0, 20), character: S(p.character).slice(0, 40),
    country: S(p.country).slice(0, 8), pronouns: S(p.pronouns).slice(0, 20), sggId: S(p.sggId), avatar: S(p.avatar).slice(0, 500) };
}
function teamOf(t = {}, i = 0) {
  return { id: S(t.id) || uid(), name: S(t.name).slice(0, 40) || `Team ${i + 1}`, tag: S(t.tag).slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : TEAM_COLORS[i % 2],
    coach: t.coach && S(t.coach.name) ? person(t.coach) : null, players: (t.players || []).filter(p => p && S(p.name)).map(person) };
}

/** a new format in setup (nothing played yet) */
function create(preset = 'crew', data = {}) {
  const P = PRESETS[preset] || PRESETS.crew;
  const f = { v: 1, kind: P.kind, preset: PRESETS[preset] ? preset : 'crew', name: S(data.name) || P.name, status: 'setup', seq: 1, events: [],
    rules: { ...P.rules, ...(data.rules || {}) }, log: [], match: null, winner: null };
  if (f.kind === 'teams') f.teams = [0, 1].map(i => teamOf((data.teams || [])[i], i));
  else f.fighters = (data.fighters || []).filter(p => p && S(p.name)).map(person);
  return normalize(f);
}

/** clean up anything that came from the panel (rules in range, ids present) */
function normalize(f) {
  const r = f.rules = f.rules || {};
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  r.ft = int(r.ft, 1, 5, 1);
  if (f.kind === 'teams') {
    r.mode = r.mode === 'paired' ? 'paired' : 'stay';
    r.winLimit = int(r.winLimit, 0, 9, 0); r.points = int(r.points, 0, 9, 0);
    r.tiebreak = ['coach', 'anchor', 'none'].includes(r.tiebreak) ? r.tiebreak : 'coach';
    f.teams = (f.teams || []).slice(0, 2); while (f.teams.length < 2) f.teams.push(teamOf({}, f.teams.length));
    f.teams = f.teams.map((t, i) => ({ ...teamOf(t, i), players: (t.players || []).filter(p => p && S(p.name)).map(p => ({ ...person(p), out: !!p.out, retired: !!p.retired, wins: Number(p.wins) || 0, losses: Number(p.losses) || 0, streak: Number(p.streak) || 0 })) }));
    f.points = Array.isArray(f.points) ? f.points.map(Number) : [0, 0];
    f.idx = Array.isArray(f.idx) ? f.idx.map(Number) : [0, 0];
  } else if (f.kind === 'elim') {
    r.mode = r.mode === 'koth' ? 'koth' : 'death';
    r.lives = int(r.lives, 1, 5, 1); r.streakGoal = int(r.streakGoal, 0, 50, 0);
    r.pick = ['stay', 'queue', 'random'].includes(r.pick) ? r.pick : 'stay';
    f.fighters = (f.fighters || []).filter(p => p && S(p.name)).slice(0, 32).map(p => ({ ...person(p), lives: p.lives == null ? r.lives : int(p.lives, 0, 9, r.lives), out: !!p.out, place: Number(p.place) || 0,
      wins: Number(p.wins) || 0, losses: Number(p.losses) || 0, streak: Number(p.streak) || 0, best: Number(p.best) || 0 }));
    f.queue = Array.isArray(f.queue) ? f.queue.filter(id => f.fighters.some(x => x.id === id)) : [];
  } else {
    r.double = !!r.double;
    f.fighters = (f.fighters || []).filter(p => p && S(p.name)).slice(0, 16).map(p => ({ ...person(p) }));
    f.schedule = Array.isArray(f.schedule) ? f.schedule : [];
  }
  f.log = Array.isArray(f.log) ? f.log.slice(-200) : [];
  return f;
}

// ------------------------------------------------------------------------------------------------ teams
const alive = t => t.players.filter(p => !p.out);
function nextIdx(t, from) { for (let i = Math.max(0, from); i < t.players.length; i++) if (!t.players[i].out) return i; return -1; }
const pairCount = f => Math.min(f.teams[0].players.length, f.teams[1].players.length);
const target = f => f.rules.points || Math.floor(pairCount(f) / 2) + 1;
function teamMatch(f) {
  const [A, B] = f.teams;
  if (f.rules.mode === 'stay') {
    const a = nextIdx(A, f.idx[0]), b = nextIdx(B, f.idx[1]);
    if (a < 0 || b < 0) return null;
    f.idx = [a, b];
    return { a: { t: 0, i: a }, b: { t: 1, i: b }, n: f.log.length + 1 };
  }
  const k = f.idx[0];
  if (k < pairCount(f)) return { a: { t: 0, i: k }, b: { t: 1, i: k }, n: f.log.length + 1, pair: k };
  // every pair played and it's level: the tiebreak
  if (f.points[0] === f.points[1] && f.rules.tiebreak !== 'none') {
    const coaches = f.rules.tiebreak === 'coach' && A.coach && B.coach;
    if (coaches) return { a: { t: 0, coach: true }, b: { t: 1, coach: true }, n: f.log.length + 1, tiebreak: true };
    const last = pairCount(f) - 1;
    return { a: { t: 0, i: last }, b: { t: 1, i: last }, n: f.log.length + 1, tiebreak: true };
  }
  return null;
}
function teamResult(f, w, events) {
  const m = f.match, win = w === 1 ? m.a : m.b, lose = w === 1 ? m.b : m.a;
  const P = ref => ref.coach ? f.teams[ref.t].coach : f.teams[ref.t].players[ref.i];
  const pw = P(win), pl = P(lose);
  if (pw) { pw.wins = (pw.wins || 0) + 1; pw.streak = (pw.streak || 0) + 1; }
  if (pl) { pl.losses = (pl.losses || 0) + 1; pl.streak = 0; }
  if (f.rules.mode === 'stay') {
    pl.out = true; events.push({ type: 'out', t: lose.t, i: lose.i, name: pl.name });
    f.idx[lose.t] = lose.i + 1;
    if (pw) events.push({ type: 'streak', t: win.t, i: win.i, n: pw.streak, name: pw.name });
    const team = f.teams[win.t];
    if (f.rules.winLimit && pw.streak >= f.rules.winLimit && nextIdx(team, win.i + 1) >= 0 && alive(f.teams[lose.t]).length) {
      pw.out = true; pw.retired = true; f.idx[win.t] = win.i + 1; events.push({ type: 'retire', t: win.t, i: win.i, name: pw.name, n: pw.streak });
    }
    if (!alive(f.teams[lose.t]).length) return finish(f, win.t, events);
    const left = alive(f.teams[lose.t]).length;
    if (left === 1) { const j = nextIdx(f.teams[lose.t], 0); events.push({ type: 'laststand', t: lose.t, i: j, name: f.teams[lose.t].players[j].name }); }
    return;
  }
  // paired points
  f.points[win.t] += 1; events.push({ type: 'point', t: win.t, points: f.points[win.t], name: pw ? pw.name : '' });
  if (m.tiebreak) return finish(f, win.t, events);
  f.idx[0] += 1;
  const goal = target(f);
  if (f.points[win.t] >= goal) return finish(f, win.t, events);
  if (f.idx[0] >= pairCount(f)) {
    if (f.points[0] !== f.points[1]) return finish(f, f.points[0] > f.points[1] ? 0 : 1, events);
    if (f.rules.tiebreak === 'none') return finish(f, -1, events);
    events.push({ type: 'tiebreak', coaches: f.rules.tiebreak === 'coach' && !!(f.teams[0].coach && f.teams[1].coach) });
  } else if (f.points[win.t] === goal - 1 || f.points[1 - win.t] === goal - 1) events.push({ type: 'matchpoint', t: f.points[0] >= f.points[1] ? 0 : 1 });
}

// ------------------------------------------------------------------------------------------------ elimination
const living = f => f.fighters.filter(x => !x.out);
const byId = (f, id) => f.fighters.find(x => x.id === id);
function elimStart(f) {
  f.fighters.forEach(x => { x.lives = f.rules.mode === 'koth' ? 0 : f.rules.lives; x.out = false; x.place = 0; x.wins = 0; x.losses = 0; x.streak = 0; x.best = 0; });
  f.queue = f.fighters.map(x => x.id); f.king = null;
  return elimNext(f, null, []);
}
function draw(f, list, avoid) {          // random pair, not the same pair as last time if there's a choice
  for (let tries = 0; tries < 12; tries++) {
    const a = list[Math.floor(Math.random() * list.length)]; let b; do b = list[Math.floor(Math.random() * list.length)]; while (b === a);
    const key = [a, b].sort().join('|'); if (key !== avoid || list.length < 3 || tries === 11) return [a, b];
  }
}
function elimNext(f, stay, events) {
  const alive2 = living(f).map(x => x.id);
  f.queue = f.queue.filter(id => alive2.includes(id));
  for (const id of alive2) if (!f.queue.includes(id) && id !== stay) f.queue.push(id);
  if (f.rules.mode === 'death' && alive2.length < 2) return null;
  if (alive2.length < 2) return null;
  let a, b;
  if (f.rules.pick === 'random') {
    const prev = f.match ? [f.match.a, f.match.b].sort().join('|') : '';
    [a, b] = draw(f, alive2, prev); f.queue = f.queue.filter(id => id !== a && id !== b); events.push({ type: 'draw', a, b });
  } else if (stay && f.rules.pick === 'stay') { a = stay; f.queue = f.queue.filter(id => id !== a); b = f.queue.shift(); }
  else { a = f.queue.shift(); b = f.queue.shift(); }
  if (!a || !b) return null;
  const final = f.rules.mode === 'death' && alive2.length === 2;
  if (final && !(f.match && f.match.final)) events.push({ type: 'final' });
  return { a, b, n: f.log.length + 1, final };
}
function elimResult(f, w, events) {
  const m = f.match, win = byId(f, w === 1 ? m.a : m.b), lose = byId(f, w === 1 ? m.b : m.a);
  win.wins += 1; win.streak += 1; win.best = Math.max(win.best, win.streak); lose.losses += 1; lose.streak = 0;
  if (f.rules.mode === 'koth') {
    const was = f.king; f.king = win.id;
    if (was && was !== win.id) events.push({ type: 'crown', from: was, to: win.id });
    else if (!was) events.push({ type: 'crown', from: null, to: win.id });
    events.push({ type: 'streak', id: win.id, n: win.streak, name: win.name });
    f.queue.push(lose.id);
    if (f.rules.streakGoal && win.streak >= f.rules.streakGoal) return finish(f, win.id, events);
  } else {
    lose.lives = Math.max(0, lose.lives - 1);
    if (lose.lives > 0) { events.push({ type: 'life', id: lose.id, lives: lose.lives, name: lose.name }); if (f.rules.pick !== 'random') f.queue.push(lose.id); }
    else {
      const n = living(f).length; lose.out = true; lose.place = n;
      events.push({ type: 'dead', id: lose.id, place: n, name: lose.name, left: n - 1 });
      if (n - 1 <= 1) { win.place = 1; return finish(f, win.id, events); }
    }
    if (f.rules.pick === 'queue') f.queue.push(win.id);
  }
  f.match = elimNext(f, f.rules.pick === 'stay' ? win.id : null, events);
  if (!f.match && f.rules.mode === 'death') { win.place = 1; return finish(f, win.id, events); }
}

// ------------------------------------------------------------------------------------------------ league
function schedule(ids, double) {          // circle method: everybody plays once a round, nobody twice in a row where possible
  const list = ids.slice(); if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) { const a = list[i], b = list[n - 1 - i]; if (a && b) rounds.push({ id: uid(), a: r % 2 ? b : a, b: r % 2 ? a : b, round: r + 1, done: false, w: 0, score: null }); }
    list.splice(1, 0, list.pop());
  }
  if (double) rounds.push(...rounds.map(m => ({ ...m, id: uid(), a: m.b, b: m.a, round: m.round + n - 1 })));
  return rounds;
}
function standings(f) {
  const rows = f.fighters.map(x => ({ id: x.id, name: x.name, played: 0, wins: 0, losses: 0, gf: 0, ga: 0 }));
  const R = id => rows.find(r => r.id === id);
  for (const m of f.schedule || []) if (m.done) {
    const a = R(m.a), b = R(m.b); if (!a || !b) continue;
    a.played++; b.played++;
    const [sa, sb] = m.score || [m.w === 1 ? 1 : 0, m.w === 2 ? 1 : 0];
    a.gf += sa; a.ga += sb; b.gf += sb; b.ga += sa;
    if (m.w === 1) { a.wins++; b.losses++; } else { b.wins++; a.losses++; }
  }
  const h2h = (x, y) => { const m = (f.schedule || []).filter(s => s.done && ((s.a === x.id && s.b === y.id) || (s.a === y.id && s.b === x.id))); let d = 0; for (const s of m) d += (s.w === 1 ? s.a : s.b) === x.id ? 1 : -1; return d; };
  rows.sort((x, y) => y.wins - x.wins || h2h(y, x) || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name));
  rows.forEach((r, i) => { r.rank = i + 1; r.diff = r.gf - r.ga; });
  return rows;
}
function leagueNext(f) {
  const m = (f.schedule || []).find(s => !s.done);
  return m ? { a: m.a, b: m.b, n: f.log.length + 1, sid: m.id, round: m.round } : null;
}
function leagueResult(f, w, score, events) {
  const s = f.schedule.find(x => x.id === f.match.sid); if (!s) return;
  s.done = true; s.w = w; s.score = score && score.length === 2 ? score.map(Number) : null;
  events.push({ type: 'result', sid: s.id });
  f.match = leagueNext(f);
  if (!f.match) { const st = standings(f); return finish(f, st[0] ? st[0].id : null, events); }
}

// ------------------------------------------------------------------------------------------------ common
function finish(f, winner, events) {
  f.status = 'done'; f.match = null; f.winner = winner;
  events.push({ type: 'done', winner });
}
/** check the format can start; returns an error message or '' */
function problem(f) {
  if (f.kind === 'teams') {
    const [A, B] = f.teams;
    if (!A.players.length || !B.players.length) return 'Each team needs at least one player.';
    if (f.rules.mode === 'paired' && A.players.length !== B.players.length) return `Paired battles need the same number of players on each team (now ${A.players.length} and ${B.players.length}).`;
    return '';
  }
  if (f.kind === 'elim') return f.fighters.length < (f.rules.mode === 'koth' ? 2 : 3) ? `Add at least ${f.rules.mode === 'koth' ? 2 : 3} fighters.` : '';
  return f.fighters.length < 3 ? 'A league needs at least 3 players.' : '';
}
function start(f) {
  f = normalize(clone(f));
  const err = problem(f); if (err) throw new Error(err);
  const events = [{ type: 'start' }];
  f.status = 'live'; f.log = []; f.winner = null;
  if (f.kind === 'teams') { f.points = [0, 0]; f.idx = [0, 0]; f.teams.forEach(t => t.players.forEach(p => { p.out = false; p.retired = false; p.wins = 0; p.losses = 0; p.streak = 0; })); f.match = teamMatch(f); }
  else if (f.kind === 'elim') f.match = elimStart(f);
  else { f.schedule = schedule(f.fighters.map(x => x.id), f.rules.double); f.match = leagueNext(f); }
  return bump(f, events);
}
function bump(f, events) {
  if (f.status === 'live' && f.match) events.push({ type: 'next', match: f.match });
  f.seq = (f.seq || 0) + 1; f.events = events; f.at = Date.now();
  return f;
}
/** record a result: w = 1 (P1 / the left player) or 2; score = [p1, p2] games */
function apply(f, w, score, opts = {}) {
  f = clone(f);
  if (f.status !== 'live' || !f.match) throw new Error('No match is running in this format.');
  if (w !== 1 && w !== 2) throw new Error('Pick who won.');
  const events = [{ type: 'win', side: w, forfeit: !!opts.forfeit }];
  const names = sides(f);
  f.log.push({ n: f.match.n, a: names.a.name, b: names.b.name, w, score: score || null, forfeit: !!opts.forfeit, tiebreak: !!f.match.tiebreak, final: !!f.match.final, at: Date.now() });
  if (f.kind === 'teams') { teamResult(f, w, events); if (f.status === 'live') { f.match = teamMatch(f); if (!f.match) finish(f, f.points[0] === f.points[1] ? -1 : f.points[0] > f.points[1] ? 0 : 1, events); } }
  else if (f.kind === 'elim') elimResult(f, w, events);
  else leagueResult(f, w, score, events);
  return bump(f, events);
}
/** who is in the current match (full player objects + their side info) */
function sides(f) {
  const m = f.match; if (!m) return { a: null, b: null };
  if (f.kind === 'teams') {
    const P = ref => { const t = f.teams[ref.t]; const p = ref.coach ? t.coach : t.players[ref.i]; return p ? { ...p, teamName: t.name, teamTag: t.tag, color: t.color, coach: !!ref.coach, slot: ref.coach ? 0 : ref.i + 1 } : null; };
    return { a: P(m.a), b: P(m.b) };
  }
  return { a: byId(f, m.a), b: byId(f, m.b) };
}
/** the label for the round field, and the best-of for the scoreboard */
function label(f) {
  const m = f.match; if (!m) return f.status === 'done' ? `${f.name} — Final result` : f.name;
  if (f.kind === 'teams') return m.tiebreak ? `${f.name} — Tiebreaker` : f.rules.mode === 'paired' ? `${f.name} — ${f.rules.tiers ? 'Tier' : 'Match'} ${m.pair + 1}` : `${f.name} — Match ${m.n}`;
  if (f.kind === 'elim') return m.final ? `${f.name} — Final Duel` : `${f.name} — Fight ${m.n}`;
  return `${f.name} — Round ${m.round}`;
}
const bestOf = f => f.rules.ft * 2 - 1;

// manual fixes (all return a new format)
function forfeit(f, side) { return apply(f, side === 1 ? 2 : 1, null, { forfeit: true }); }
function swap(f, side, index) {              // teams, stay rule: someone else from that team plays this match
  f = clone(f); const m = f.match; if (!m || f.kind !== 'teams') throw new Error('Nothing to swap.');
  const ref = side === 1 ? m.a : m.b, t = f.teams[ref.t], p = t.players[index];
  if (!p || p.out) throw new Error('That player is out.');
  if (f.rules.mode === 'stay') { const [moved] = t.players.splice(index, 1); t.players.splice(ref.i, 0, moved); }
  else { [t.players[ref.i], t.players[index]] = [t.players[index], t.players[ref.i]]; }
  return bump(f, [{ type: 'swap', side }]);
}
function pickMatch(f, sid) {               // league: play this one now
  f = clone(f); const s = (f.schedule || []).find(x => x.id === sid && !x.done); if (!s) throw new Error('That match is already played.');
  f.match = { a: s.a, b: s.b, n: f.log.length + 1, sid: s.id, round: s.round }; return bump(f, []);
}
function join(f, p) {                      // KOTH / setup: add a fighter
  f = clone(f); if (f.kind === 'teams') throw new Error('Add players to a team in setup.');
  if (f.status === 'live' && f.rules.mode !== 'koth') throw new Error('Players can only join a King of the Hill while it runs.');
  const x = { ...person(p), lives: f.rules.lives || 0, out: false, place: 0, wins: 0, losses: 0, streak: 0, best: 0 };
  f.fighters.push(x); if (f.status === 'live') f.queue.push(x.id);
  return bump(f, [{ type: 'join', id: x.id }]);
}
function leave(f, id) {
  f = clone(f); if (f.status !== 'live' || f.kind !== 'elim') throw new Error('Nothing to leave.');
  if (f.match && (f.match.a === id || f.match.b === id)) throw new Error('They are playing now — use Forfeit instead.');
  f.queue = f.queue.filter(x => x !== id);
  const x = byId(f, id); if (x && f.rules.mode === 'koth') { f.fighters = f.fighters.filter(y => y.id !== id); }
  else if (x) { const n = living(f).length; x.out = true; x.lives = 0; x.place = n; }
  return bump(f, [{ type: 'left', id }]);
}
function end(f) {                          // stop now (KOTH with no target, a league cut short): best record wins
  f = clone(f); if (f.status !== 'live') throw new Error('Nothing is running.');
  const events = [];
  if (f.kind === 'elim') { const best = f.fighters.slice().sort((a, b) => (f.rules.mode === 'koth' ? b.best - a.best || b.wins - a.wins : (b.out ? -1 : 0) - (a.out ? -1 : 0) || b.wins - a.wins))[0]; finish(f, best ? best.id : null, events); }
  else if (f.kind === 'league') { const st = standings(f); finish(f, st[0] ? st[0].id : null, events); }
  else finish(f, f.points[0] === f.points[1] ? -1 : f.points[0] > f.points[1] ? 0 : 1, events);
  return bump(f, events);
}
function setLives(f, id, lives) {
  f = clone(f); const x = byId(f, id); if (!x || f.kind !== 'elim') throw new Error('Not found.');
  x.lives = Math.max(1, Math.min(9, Number(lives) || 1)); return bump(f, [{ type: 'lives', id }]);
}

/** derived numbers for overlays and the panel (left, points, match point…) */
function view(f) {
  if (!f || !f.kind) return null;
  const out = { kind: f.kind, preset: f.preset, mode: f.rules.mode, status: f.status, name: f.name, label: label(f), seq: f.seq, n: f.match ? f.match.n : f.log.length };
  if (f.kind === 'teams') {
    const goal = target(f);
    out.goal = f.rules.mode === 'paired' ? goal : 0;
    out.teams = f.teams.map((t, i) => {
      const left = alive(t).length, next = f.match && f.rules.mode === 'stay' ? nextIdx(t, (i === 0 ? f.match.a.i : f.match.b.i) + 1) : -1;
      return { name: t.name, tag: t.tag, color: t.color, coach: t.coach ? t.coach.name : '', points: f.points[i], left, size: t.players.length,
        mp: f.status === 'live' && (f.rules.mode === 'paired' ? f.points[i] === goal - 1 : left === 1 && alive(f.teams[1 - i]).length > 1),
        laststand: f.status === 'live' && f.rules.mode === 'stay' && left === 1,
        players: t.players.map((p, j) => ({ name: p.name, character: p.character, country: p.country, out: !!p.out, retired: !!p.retired, wins: p.wins || 0, losses: p.losses || 0, streak: p.streak || 0,
          state: p.out ? 'out' : f.match && ((i === 0 && f.match.a.i === j && !f.match.a.coach) || (i === 1 && f.match.b.i === j && !f.match.b.coach)) ? 'playing' : j === next ? 'next' : 'wait' })) };
    });
    if (f.status === 'done' && f.winner >= 0) {
      const all = f.teams[f.winner].players.concat(f.teams[f.winner].coach ? [] : []);
      const mvp = all.slice().sort((a, b) => (b.wins || 0) - (a.wins || 0) || (a.losses || 0) - (b.losses || 0))[0];
      out.mvp = mvp ? mvp.name : ''; out.winnerTeam = f.winner;
    }
    out.tiebreak = !!(f.match && f.match.tiebreak);
  } else if (f.kind === 'elim') {
    out.alive = living(f).length; out.total = f.fighters.length; out.final = !!(f.match && f.match.final);
    const k = f.king && byId(f, f.king); out.king = k ? k.name : ''; out.streak = k ? k.streak : 0;
    out.fighters = f.fighters.map(x => ({ id: x.id, name: x.name, character: x.character, country: x.country, lives: x.lives, maxLives: f.rules.lives, out: x.out, place: x.place, wins: x.wins, losses: x.losses, streak: x.streak, best: x.best,
      king: f.king === x.id, state: x.out ? 'out' : f.match && (f.match.a === x.id || f.match.b === x.id) ? 'playing' : f.queue && f.queue[0] === x.id ? 'next' : 'wait' }));
    out.queue = (f.queue || []).map(id => (byId(f, id) || {}).name).filter(Boolean);
    out.next = out.queue[0] || '';
    if (f.status === 'done') { const w = byId(f, f.winner); out.champion = w ? w.name : ''; const pl = f.fighters.filter(x => x.place).sort((a, b) => a.place - b.place); out.places = pl.map(x => ({ name: x.name, place: x.place })); out.bestStreak = Math.max(0, ...f.fighters.map(x => x.best)); }
  } else {
    out.standings = standings(f); out.leader = out.standings[0] ? out.standings[0].name : '';
    const nm = id => (byId(f, id) || {}).name || '';
    out.schedule = (f.schedule || []).map(s => ({ id: s.id, a: nm(s.a), b: nm(s.b), round: s.round, done: s.done, w: s.w, score: s.score, now: !!(f.match && f.match.sid === s.id) }));
    out.played = (f.schedule || []).filter(s => s.done).length; out.total = (f.schedule || []).length;
    if (f.status === 'done') out.champion = out.leader;
  }
  return out;
}

module.exports = { PRESETS, create, normalize, start, apply, forfeit, swap, pickMatch, join, leave, setLives, end, sides, label, bestOf, view, standings, problem, schedule };
