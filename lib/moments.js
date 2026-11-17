'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.21 — moments: the set tells its own story.
 *
 * The scoreboard already knows the score, the round, who has been behind and (from Player history and the bracket) who has
 * played whom and how they were seeded. From that it spots the moments worth a banner, without anyone pressing a key:
 *
 *   game          a game is won                         (no banner: the score flips and flashes)
 *   matchpoint    a player is one game from the set     (both at once: "Final game")
 *   comeback      2+ games down, and level again
 *   reversesweep  won from one game from going out, without losing another game (first to 3 and up)
 *   sweep         won without dropping a game
 *   upset         the lower seed won, by at least the seed gap in Settings
 *   runback       the same two players met earlier today
 *   losersrun     3+ sets won in a row in losers
 *   reset         the losers-side player won the first Grand Final set
 *
 * One banner at a time, a short rest between two, never while a splash or a full screen is up (it waits, and comes back
 * if the moment still stands), each one switchable off (Settings › Scoreboard), every one written into the show log.
 *
 * moments(a, b, o) and pairMoments(b, o) are pure (the tests use them); createMoments(ctx) runs them live.
 */
const key = n => String(n == null ? '' : n).trim().toLowerCase();
const ftOf = bo => { const s = String(bo == null ? '' : bo).trim(); return /^FT/i.test(s) ? Number(s.replace(/^FT\s*/i, '')) || 0 : Math.ceil((Number(s) || 0) / 2); };
const real = n => { const k = key(n); return !!k && !/^player [12]$/.test(k) && k !== 'tbd' && k !== '?'; };

/** every moment: its words in Settings, its switch, how long its banner stays (ms), `end` = it belongs to a finished set */
const KINDS = {
  game: { label: 'A game is won', hint: 'The score flips and flashes in the player’s colour', setting: 'moGame', banner: false },
  matchpoint: { label: 'Match point', hint: 'One game from the set — or “Final game” when both are', setting: 'moMatchPoint', hold: 5200 },
  comeback: { label: 'Comeback on', hint: 'Two or more games down, and level again', setting: 'moComeback', hold: 6000 },
  reversesweep: { label: 'Reverse sweep', hint: 'Won from one game from going out', setting: 'moReverseSweep', hold: 7000, end: true },
  sweep: { label: 'Sweep', hint: 'Won without dropping a game', setting: 'moSweep', hold: 6000, end: true },
  upset: { label: 'Upset', hint: 'The lower seed won (the bracket’s seeds)', setting: 'moUpset', hold: 7000, end: true },
  runback: { label: 'Runback', hint: 'The same two players met earlier today', setting: 'moRunback', hold: 7000 },
  losersrun: { label: 'Losers run', hint: 'Three or more sets won in a row in losers', setting: 'moLosersRun', hold: 6500 },
  reset: { label: 'Grand Final reset', hint: 'The losers-side player won the first Grand Final set', setting: 'moReset', hold: 8000, end: true },
};
const ORDER = Object.keys(KINDS);

/** the scoreboard, as far as moments care */
function snap(st) {
  st = st || {}; const p1 = st.p1 || {}, p2 = st.p2 || {};
  const a = String(p1.name || '').trim(), b = String(p2.name || '').trim();
  return { a, b, n1: key(a), n2: key(b), key: `${key(a)}|${key(b)}`, s1: Number(p1.score) || 0, s2: Number(p2.score) || 0, round: String(st.round || ''), l1: !!p1.loser, l2: !!p2.loser, ft: ftOf(st.bestOf),
    ok: real(a) && real(b) && key(a) !== key(b) };
}

/**
 * What a score change means. a, b: the scoreboard before and after (snap()); o: { winWas, winNow, d1, d2 (the most each
 * side has been behind in this set, b included), said (a Set: what this set has had a banner for), seeds: [s1, s2] (0 =
 * not known), gap (the seed gap for an upset) }. The first banner in the list is the one to show; the rest are logged.
 */
function moments(a, b, o = {}) {
  const out = [];
  if (!b.ok || a.key !== b.key) return out;
  const up1 = b.s1 > a.s1, up2 = b.s2 > a.s2;
  if (up1 === up2) return out;                                       // nothing won (or both typed at once): no moment
  const side = up1 ? 1 : 2, ft = b.ft, name = side === 1 ? b.a : b.b, said = o.said || new Set();
  const winNow = Number(o.winNow) || 0, winWas = Number(o.winWas) || 0;
  if (winNow && !winWas) {
    const w = winNow, ws = w === 1 ? b.s1 : b.s2, ls = w === 1 ? b.s2 : b.s1, wn = w === 1 ? b.a : b.b, ln = w === 1 ? b.b : b.a, dW = (w === 1 ? o.d1 : o.d2) || 0;
    if (/grand/i.test(b.round) && !/reset/i.test(b.round) && (w === 1 ? b.l1 && !b.l2 : b.l2 && !b.l1))
      out.push({ kind: 'reset', side: w, title: 'Bracket reset', text: `${wn} takes the first set ${ws}–${ls} — one more set decides it` });
    if (ft >= 3 && ls === ft - 1 && dW >= ft - 1) out.push({ kind: 'reversesweep', side: w, title: 'Reverse sweep', text: `${wn} was ${ls}–0 down and won it ${ws}–${ls}` });
    const sw = Number(o.seeds && o.seeds[w - 1]) || 0, sl = Number(o.seeds && o.seeds[2 - w]) || 0, gap = Math.max(1, Number(o.gap) || 4);
    if (sw > 0 && sl > 0 && sw - sl >= gap) out.push({ kind: 'upset', side: w, title: 'Upset', text: `Seed ${sw} ${wn} beats seed ${sl} ${ln} ${ws}–${ls}` });
    if (ft >= 2 && ls === 0) out.push({ kind: 'sweep', side: w, title: 'Sweep', text: `${wn} wins ${ws}–0 without dropping a game` });
    return out;
  }
  if (winNow) return out;
  out.push({ kind: 'game', side, quiet: true });
  if (ft >= 2) {
    const me = side === 1 ? b.s1 : b.s2, was = side === 1 ? a.s1 : a.s2, dS = (side === 1 ? o.d1 : o.d2) || 0, both = b.s1 === ft - 1 && b.s2 === ft - 1;
    if (b.s1 === b.s2 && dS >= 2 && !said.has('comeback' + side)) out.push({ kind: 'comeback', side, title: 'Comeback on', text: `${name} was ${dS} down — it's ${b.s1}–${b.s2}${both ? ', and the next game wins it' : ''}` });
    else if (both && !said.has('final')) out.push({ kind: 'matchpoint', side: 0, final: true, title: 'Final game', text: `${b.s1}–${b.s2} — the next game wins the set` });
    else if (me === ft - 1 && was < ft - 1 && !both && !said.has('matchpoint' + side)) out.push({ kind: 'matchpoint', side, title: 'Match point', text: `${name} is one game from the set` });
  }
  return out;
}

/** how many sets in a row this player has won in losers since `since` (newest first, stopping at a loss or a winners set) */
function losersRun(rows, name, since) {
  const k = key(name); let run = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i], sd = key(r.p1 && r.p1.name) === k ? 1 : key(r.p2 && r.p2.name) === k ? 2 : 0; if (!sd) continue;
    if (r.at < since || !/loser/i.test(r.round || '') || r.winner !== sd) break;
    run++;
  }
  return run;
}

/** What two players sitting down means. b: snap(); o: { rows (Player history, oldest first), since (ms: today's event) } */
function pairMoments(b, o = {}) {
  const out = []; if (!b.ok) return out;
  const rows = o.rows || [], since = Number(o.since) || (Date.now() - 16 * 3600e3);
  const sideOf = (r, k) => (key(r.p1 && r.p1.name) === k ? 1 : key(r.p2 && r.p2.name) === k ? 2 : 0);
  const today = rows.filter(r => r.at >= since && sideOf(r, b.n1) && sideOf(r, b.n2));
  if (today.length) {
    const last = today[today.length - 1], w1 = last.winner === sideOf(last, b.n1), wn = w1 ? b.a : b.b, hi = Math.max(last.s1, last.s2), lo = Math.min(last.s1, last.s2);
    out.push({ kind: 'runback', side: w1 ? 1 : 2, title: 'Runback', text: `${wn} won ${hi}–${lo}${last.round ? ' in ' + last.round : ''} earlier today` });
  }
  if (/loser|grand/i.test(b.round)) for (const [n, s] of [[b.a, 1], [b.b, 2]]) {
    const run = losersRun(rows, n, since);
    if (run >= 3) out.push({ kind: 'losersrun', side: s, title: 'Losers run', text: `${n} has won ${run} sets in a row in losers` });
  }
  return out;
}

/**
 * ctx: { state(), settings(), busy() (a splash or full screen is up), rows() (Player history), since(), seedOf(name),
 *        note(kind, text), changed(), fire(event, info)?, standby()?, scale? }
 */
function createMoments(ctx) {
  const K = Math.max(.02, Number(ctx.scale) || Number(process.env.MOMENT_SCALE) || 1);     // (tests run it faster)
  const GAP = 2500 * K, BEAT = 450 * K, SETTLE = 1600 * K, STALE = 45000, later = (fn, ms) => { const t = setTimeout(fn, Math.max(0, ms)); if (t.unref) t.unref(); return t; };
  let n = 0, cur = null, queue = [], last = null, coolUntil = 0, endT = null, pumpT = null, pairT = null, inited = false;
  const set = { key: '', d1: 0, d2: 0, said: new Set(), at: {} };       // at: how far behind each side had been when the score was last "s1-s2" (a point taken back goes back to it)
  // what this set has been, kept while the two players stay on the scoreboard (the banner comes and goes; the Victory and
  // VS screens can still say "Sweep" or "Runback" afterwards): { end: {kind, side, title, text}, runback, run }
  let story = { end: null, runback: null, run: null };
  const remember = m => { const v = { kind: m.kind, side: m.side || 0, title: m.title, text: m.text || '' }; if (KINDS[m.kind].end && !story.end) story.end = v; else if (m.kind === 'runback') story.runback = v; else if (m.kind === 'losersrun' && !story.run) story.run = v; };
  const S = () => ctx.settings() || {};
  const on = kind => S().moments !== false && S()[KINDS[kind].setting] !== false;
  const standby = () => !!(ctx.standby && ctx.standby());
  // does a waiting (or covered) banner still stand? the same two players, and for a score moment the same score
  const fits = it => { if (it.free) return true; const b = snap(ctx.state()); return b.key === it.key && (KINDS[it.kind].end || it.pair || (b.s1 === it.s1 && b.s2 === it.s2)) && Date.now() - it.at < STALE; };
  const drop = () => { clearTimeout(endT); const had = !!cur; cur = null; return had; };

  function show(it) {
    clearTimeout(endT); clearTimeout(pumpT);
    cur = { it, n: ++n, endsAt: Date.now() + it.hold, paused: false, left: 0 }; last = { ...it, shown: Date.now() };
    if (!it.again) { try { ctx.note('moment', `${it.title}${it.text ? ' — ' + it.text : ''}`); } catch {} try { ctx.fire && ctx.fire('moment', { what: it.kind, who: it.side }); } catch {} }
    endT = later(end, it.hold); ctx.changed();
  }
  function end() { if (!drop()) return; coolUntil = Date.now() + GAP; ctx.changed(); pumpSoon(GAP + 20); }
  function pumpSoon(ms = 0) { clearTimeout(pumpT); pumpT = later(pump, ms); }
  function pump() {
    if (cur && !cur.paused) return;
    if (ctx.busy()) return;                                              // a splash is up: wait for it (onState calls again)
    if (cur && cur.paused) {                                             // back from under a splash: the rest of its time, if it still stands
      if (fits(cur.it) && cur.left > 1200 * K) { cur.paused = false; cur.endsAt = Date.now() + Math.max(cur.left, 2500 * K); endT = later(end, cur.endsAt - Date.now()); ctx.changed(); return; }
      drop();
    }
    queue = queue.filter(fits);
    if (!queue.length) return;
    const it = queue[0], wait = Math.max(it.urgent ? 0 : coolUntil, it.notBefore || 0) - Date.now();
    if (wait > 0) return pumpSoon(wait + 10);
    queue.shift(); show(it);
  }
  function push(list, b, extra = {}) {
    const shown = list.filter(m => !m.quiet && on(m.kind));
    for (const [i, m] of shown.entries()) {
      remember(m);
      const it = { ...m, hold: (KINDS[m.kind].hold || 5000) * K, key: b.key, s1: b.s1, s2: b.s2, at: Date.now(), notBefore: Date.now() + BEAT, name: m.side === 1 ? b.a : m.side === 2 ? b.b : '', ...extra };
      if (i === 0 || extra.pair) queue.push(it);                         // one banner for a finished set; what else it was is written down
      else try { ctx.note('moment', `${it.title} — ${it.text}`); } catch {}
    }
    queue = queue.slice(-3);
    if (queue.some(q => q.urgent) && cur && !KINDS[cur.it.kind].end) { drop(); ctx.changed(); }   // the set is won: its moment doesn't wait for another banner to finish
    pump();
  }

  /** server.js calls this after every change (prev and next: the scoreboard before and after) */
  function onState(prev, next, { undo = false, winWas = 0, winNow = 0 } = {}) {
    if (standby()) return;
    const a = snap(prev), b = snap(next), fmt = !!(next && next.format && next.format.status === 'live');
    if (!inited) { inited = true; set.key = a.key; set.d1 = Math.max(0, a.s2 - a.s1); set.d2 = Math.max(0, a.s1 - a.s2); }      // (the app was started mid-set)
    const fresh = b.key !== set.key, zeroed = b.s1 === 0 && b.s2 === 0 && (a.s1 > 0 || a.s2 > 0);
    if (fresh || zeroed) {                                               // two new players, or the score back to 0–0: a new set
      set.key = b.key; set.d1 = 0; set.d2 = 0; set.said = new Set(); set.at = {};
      story = fresh ? { end: null, runback: null, run: null } : { ...story, end: null };
      if (cur && !cur.it.free && (fresh || !cur.it.pair)) { drop(); ctx.changed(); }
      queue = queue.filter(q => q.free || (q.pair && q.key === b.key));
      if (fresh) {
        clearTimeout(pairT);
        if (b.ok && !undo && !fmt) pairT = later(() => { const c = snap(ctx.state()); if (c.key !== b.key || !c.ok || standby()) return; push(pairMoments(c, { rows: ctx.rows(), since: ctx.since() }), c, { pair: true }); }, SETTLE);
      }
    }
    const scored = a.key === b.key && (a.s1 !== b.s1 || a.s2 !== b.s2);
    // a point taken back (an undo, the minus button): the moments it brought are un-said — they're said again when they really
    // happen — and "how far behind" goes back to what it was at that score
    if (scored && !fresh && !zeroed && (b.s1 < a.s1 || b.s2 < a.s2)) { set.said = new Set(); const was = set.at[`${b.s1}-${b.s2}`]; if (was) { set.d1 = was[0]; set.d2 = was[1]; } }
    set.d1 = Math.max(set.d1, b.s2 - b.s1); set.d2 = Math.max(set.d2, b.s1 - b.s2); set.at[`${b.s1}-${b.s2}`] = [set.d1, set.d2];
    if (scored && !winNow && story.end) story.end = null;                // the winning point was taken back: the set isn't over
    if (scored && cur && !cur.it.free && !cur.it.pair && !KINDS[cur.it.kind].end) { drop(); ctx.changed(); }      // the score moved on: "Match point" is old news
    if (scored && !undo && !fmt && S().moments !== false) {
      const list = moments(a, b, { winWas, winNow, d1: set.d1, d2: set.d2, said: set.said, seeds: [seed(b.a), seed(b.b)], gap: S().upsetGap });
      for (const m of list) if (!m.quiet) set.said.add(m.final ? 'final' : m.kind + m.side);
      if (list.length) push(list, b, winNow && !winWas ? { urgent: true } : {});
    }
    // a splash came up over the banner, or went away
    if (cur && !cur.paused && ctx.busy()) { cur.paused = true; cur.left = Math.max(0, cur.endsAt - Date.now()); clearTimeout(endT); ctx.changed(); }
    else if (!ctx.busy() && ((cur && cur.paused) || queue.length)) pumpSoon(350 * K);
  }
  const seed = name => { try { return Number(ctx.seedOf(name)) || 0; } catch { return 0; } };

  /** the banner on stream now (state.x.mo), or null */
  const live = () => (cur && !cur.paused ? { n: cur.n, kind: cur.it.kind, side: cur.it.side || 0, title: cur.it.title, text: cur.it.text || '', name: cur.it.name || '', ...(cur.it.final ? { final: true } : {}) } : null);
  /** what this set has been so far (state.x.story), or null: for the screens that come after the banner */
  const told = () => (story.end || story.runback || story.run ? { ...(story.end ? { end: story.end } : {}), ...(story.runback ? { runback: story.runback } : {}), ...(story.run ? { run: story.run } : {}) } : null);
  /** for the panel and the Stream Deck */
  const view = () => ({ on: S().moments !== false, now: cur && !cur.paused ? cur.it.kind : '', waiting: queue.length + (cur && cur.paused ? 1 : 0), last: last ? { kind: last.kind, title: last.title, text: last.text, at: last.shown } : null,
    kinds: ORDER.map(k => ({ kind: k, label: KINDS[k].label, hint: KINDS[k].hint, setting: KINDS[k].setting, banner: KINDS[k].banner !== false, on: S()[KINDS[k].setting] !== false })) });
  /** Hide all: the banner goes, and nothing that was waiting shows */
  function clear() { queue = []; clearTimeout(pairT); if (drop()) { coolUntil = Date.now() + 400 * K; ctx.changed(); return true; } return false; }
  /** Replay the last moment, or try one out with the players on the scoreboard (Settings › Scoreboard) */
  function action(b = {}) {
    if (b.do === 'clear') return { cleared: clear() };
    if (ctx.busy()) throw new Error('A splash is up — hide it first, then the moment can show.');
    if (ctx.format && ctx.format()) throw new Error('A game format is running — its own bar tells the story. Moments are back when it’s over.');
    let it;
    if (b.do === 'test') {
      const kind = ORDER.includes(b.kind) && KINDS[b.kind].banner !== false ? b.kind : 'matchpoint', s = snap(ctx.state()), A = real(s.a) ? s.a : 'CrimsonByte', B = real(s.b) ? s.b : 'NeonGhoul';
      const T = { matchpoint: ['Match point', `${A} is one game from the set`], comeback: ['Comeback on', `${B} was 2 down — it's 2–2, and the next game wins it`], reversesweep: ['Reverse sweep', `${B} was 2–0 down and won it 3–2`],
        sweep: ['Sweep', `${A} wins 3–0 without dropping a game`], upset: ['Upset', `Seed 12 ${B} beats seed 3 ${A} 3–1`], runback: ['Runback', `${A} won 2–1 in Winners Semi-Final earlier today`],
        losersrun: ['Losers run', `${B} has won 4 sets in a row in losers`], reset: ['Bracket reset', `${B} takes the first set 3–1 — one more set decides it`] }[kind];
      const side = ['matchpoint', 'sweep', 'runback'].includes(kind) ? 1 : 2;
      it = { kind, side, title: T[0], text: T[1], name: side === 1 ? A : B, hold: (KINDS[kind].hold || 5000) * K, free: true, again: true, at: Date.now() };
    } else {
      if (!last) throw new Error('No moment yet — the first one of the night will be here to replay.');
      it = { ...last, free: true, again: true, at: Date.now(), hold: (KINDS[last.kind].hold || 5000) * K };
    }
    queue = []; drop(); show(it); return { moment: live() };
  }
  return { onState, live, story: told, view, action, clear, stop() { clearTimeout(endT); clearTimeout(pumpT); clearTimeout(pairT); } };
}

module.exports = { KINDS, ORDER, snap, moments, pairMoments, losersRun, createMoments, ftOf };
