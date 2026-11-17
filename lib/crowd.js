'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the viewers' side: the prediction game, chat polls, the hype meter, and
 * (when you allow it) Twitch's own Predictions and channel points.
 *
 *   Prediction game  before each set viewers type !pick 1 / !pick 2 (or a name) in chat. Picks close when the first game
 *                    is won (or when you lock them); when the set is won, everyone who called it gets points in the
 *                    season's predictor table (more for calling an upset).
 *   Polls            !vote 1 … !vote 6 (or the option's letter or words), for as long as you set.
 *   Hype meter       how busy chat is, smoothed; at the top it fires a hype burst (and the "Hype peaks" automation),
 *                    then cools down for a minute.
 *   Twitch           Predictions (start, lock, pay out, cancel — by itself with each set if you like) and channel
 *                    points rewards that run an automation or a burst. These need the extra Twitch permissions, which
 *                    you give by signing in again with them (Twitch tab).
 * Nothing here posts anything unless you've turned it on; chat replies need the Twitch sign-in.
 */
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const key = n => String(n || '').trim().toLowerCase();
const LETTERS = 'ABCDEF';

function createCrowd(h) {
  // ---------------------------------------------------------------- the prediction game
  let pred = null;            // { a, b, picks: Map(login → { side, name }), open, locked, at, result }
  function predOpen(a, b, { quiet = false } = {}) {
    if (!a || !b || /^player [12]$/i.test(String(a).trim()) || /^player [12]$/i.test(String(b).trim())) throw new Error('Load both players first.');
    pred = { a, b, picks: new Map(), open: true, locked: false, at: Date.now(), result: null };
    if (!quiet && h.prefs().predChat && h.canSay()) h.say(`🎯 Picks are open! !pick 1 for ${a} or !pick 2 for ${b}`);
    h.changed(); return predView();
  }
  function predLock(why = 'manual') {
    if (!pred || !pred.open) return predView();
    pred.open = false; pred.locked = true;
    if (why !== 'quiet' && h.prefs().predChat && h.canSay() && pred.picks.size) { const v = predView(); h.say(`🔒 Picks are locked: ${v.pct1}% ${pred.a} · ${v.pct2}% ${pred.b}`); }
    h.changed(); return predView();
  }
  function predResult(winner) {               // 1 or 2; the set's winner
    if (!pred || pred.result) return null;
    pred.open = false; pred.locked = true; pred.result = winner;
    const v = predView(), w = {}, l = {}, under = (winner === 1 ? v.pct1 : v.pct2) < 35;
    for (const [login, x] of pred.picks) (x.side === winner ? w : l)[login] = { name: x.name, pts: under ? 15 : 10 };
    try { h.predicted(w, l); } catch {}
    const n = Object.keys(w).length;
    if (h.prefs().predChat && h.canSay() && pred.picks.size) h.say(`🏆 ${winner === 1 ? pred.a : pred.b} wins! ${n} of ${pred.picks.size} called it${under && n ? ' — an upset, so that’s 15 points each' : ''}.`);
    h.changed(); return { right: n, of: pred.picks.size };
  }
  function predClose() { pred = null; h.changed(); }
  function predView() {
    if (!pred) return null;
    let n1 = 0, n2 = 0; for (const x of pred.picks.values()) x.side === 1 ? n1++ : n2++;
    const t = n1 + n2, pct1 = t ? Math.round(n1 / t * 100) : 50;
    return { a: pred.a, b: pred.b, open: pred.open, locked: pred.locked, n1, n2, total: t, pct1, pct2: t ? 100 - pct1 : 50, result: pred.result, at: pred.at };
  }
  function predChat(m, text) {
    const r = /^!(pick|predict)\s+(.+)$/i.exec(text); if (!r) return false;
    if (!pred || !pred.open) return true;
    const w = r[2].trim().toLowerCase(); let side = 0;
    if (w === '1' || w === 'p1' || w === 'left') side = 1; else if (w === '2' || w === 'p2' || w === 'right') side = 2;
    else if (key(pred.a).startsWith(w) && !key(pred.b).startsWith(w)) side = 1; else if (key(pred.b).startsWith(w) && !key(pred.a).startsWith(w)) side = 2;
    if (!side) return true;
    pred.picks.set(m.login, { side, name: m.display || m.login }); if (pred.picks.size > 20000) pred.picks.delete(pred.picks.keys().next().value);
    h.changed(true); return true;
  }

  // ---------------------------------------------------------------- polls
  let poll = null;            // { q, opts, votes: Map(login → i), open, endsAt, at }
  function pollStart(b) {
    const opts = (Array.isArray(b.options) ? b.options : String(b.options || '').split(/\n|\|/)).map(x => str(x, 40)).filter(Boolean).slice(0, 6);
    if (opts.length < 2) throw new Error('A poll needs at least two answers.');
    const secs = Math.max(15, Math.min(1800, Number(b.secs) || 90));
    poll = { q: str(b.question, 90) || 'Vote now', opts, votes: new Map(), open: true, at: Date.now(), endsAt: Date.now() + secs * 1000 };
    if (h.prefs().pollChat !== false && h.canSay()) h.say(`📊 ${poll.q} — ${opts.map((o, i) => `!vote ${i + 1} ${o}`).join(' · ')}`);
    h.changed(); return pollView();
  }
  function pollEnd() {
    if (!poll || !poll.open) return pollView();
    poll.open = false; poll.endsAt = Date.now();
    const v = pollView(), top = v.opts.slice().sort((x, y) => y.n - x.n)[0];
    if (h.prefs().pollChat !== false && h.canSay() && v.total) h.say(`📊 Poll closed: “${top.text}” wins with ${top.pct}%.`);
    try { h.fire && h.fire('pollEnd', { what: top ? top.text : '' }); } catch {}
    h.changed(); return v;
  }
  function pollClear() { poll = null; h.changed(); }
  function pollView() {
    if (!poll) return null;
    const n = poll.opts.map(() => 0); for (const i of poll.votes.values()) n[i]++;
    const t = n.reduce((a, b) => a + b, 0);
    return { q: poll.q, open: poll.open, endsAt: poll.endsAt, total: t, opts: poll.opts.map((o, i) => ({ text: o, letter: LETTERS[i], n: n[i], pct: t ? Math.round(n[i] / t * 100) : 0 })) };
  }
  function pollChat(m, text) {
    const r = /^!vote\s+(.+)$/i.exec(text); if (!r) return false;
    if (!poll || !poll.open) return true;
    const w = r[1].trim(), wl = w.toLowerCase(); let i = -1;
    if (/^[1-6]$/.test(w)) i = Number(w) - 1; else if (/^[a-f]$/i.test(w)) i = LETTERS.indexOf(w.toUpperCase());
    else i = poll.opts.findIndex(o => o.toLowerCase().startsWith(wl));
    if (i < 0 || i >= poll.opts.length) return true;
    poll.votes.set(m.login, i); h.changed(true); return true;
  }

  // ---------------------------------------------------------------- the hype meter
  const times = []; let level = 0, fired = 0, lastSent = -1;
  function hypeNote(m) { const now = Date.now(); times.push(now); while (times.length && now - times[0] > 15000) times.shift(); if (times.length > 3000) times.shift(); }
  function hypeTick() {
    const p = h.prefs(); if (!p.hype) { if (level) { level = 0; h.changed(true); } return; }
    const now = Date.now(); while (times.length && now - times[0] > 15000) times.shift();
    const target = Math.max(5, Math.min(1000, Number(p.hypeFull) || 40));
    const want = Math.min(1, times.length / target);
    level += (want - level) * (want > level ? .6 : .12);
    if (level < .005) level = 0;
    if (level >= .985 && now - fired > 60000) { fired = now; try { h.onHype(); } catch {} }
    const q = Math.round(level * 50) / 50; if (q !== lastSent) { lastSent = q; h.changed(true); }
  }
  const hypeT = setInterval(hypeTick, 1000); hypeT.unref && hypeT.unref();
  function hypeView() { const p = h.prefs(); return p.hype ? { level: Math.round(level * 50) / 50, peak: Date.now() - fired < 4000, show: p.hypeShow !== false } : null; }

  // ---------------------------------------------------------------- chat in
  function onChat(m) {
    const text = String(m.text || '').trim();
    hypeNote(m);
    if (predChat(m, text)) return true;
    if (pollChat(m, text)) return true;
    return false;
  }
  const pollT = setInterval(() => { if (poll && poll.open && Date.now() >= poll.endsAt) pollEnd(); }, 1000); pollT.unref && pollT.unref();

  // ---------------------------------------------------------------- the set on the scoreboard
  /** a: before, b: after ({ n1, n2, s1, s2 }), winWas/winNow, names */
  function onState(a, b, winWas, winNow, names, undo) {
    const p = h.prefs();
    if (!undo && b.n1 && b.n2 && (b.n1 !== a.n1 || b.n2 !== a.n2)) {
      if (p.predAuto) try { predOpen(names[0], names[1]); } catch {}
      if (p.twAuto && h.hasScopes()) twStart(names[0], names[1]).catch(e => h.log('Twitch prediction: ' + e.message));
    }
    const started = (b.s1 + b.s2) > 0 && (a.s1 + a.s2) === 0 && b.n1 === a.n1 && b.n2 === a.n2;
    if (started && !undo) { if (pred && pred.open) predLock(); if (tw.pred && tw.pred.status === 'ACTIVE' && p.twAuto) twLock().catch(() => {}); }
    if (winNow && !winWas && !undo) { if (pred) predResult(winNow); if (tw.pred && p.twAuto && ['ACTIVE', 'LOCKED'].includes(tw.pred.status)) twResolve(winNow).catch(e => h.log('Twitch prediction: ' + e.message)); }
  }

  // ---------------------------------------------------------------- Twitch Predictions and channel points (Helix)
  const tw = { pred: null, error: '', rewards: [], polled: 0 };
  const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  async function twStart(a, b, secs) {
    if (!h.hasScopes()) throw new Error('Allow Predictions first (Twitch tab › Predictions & channel points).');
    if (tw.pred && ['ACTIVE', 'LOCKED'].includes(tw.pred.status)) throw new Error('A prediction is already running — pay it out or cancel it first.');
    const win = Math.max(30, Math.min(1800, Number(secs) || Number(h.prefs().twWindow) || 120));
    const d = await h.helix('POST', '/predictions', { broadcaster_id: h.me(), title: cut(`Who wins? ${a} vs ${b}`, 45), outcomes: [{ title: cut(a, 25) }, { title: cut(b, 25) }], prediction_window: win });
    const x = d && d.data && d.data[0]; if (!x) throw new Error('Twitch didn’t start the prediction.');
    tw.pred = { id: x.id, status: x.status || 'ACTIVE', outcomes: (x.outcomes || []).map(o => ({ id: o.id, title: o.title })), title: x.title, at: Date.now() }; tw.error = ''; h.changed(); return twView();
  }
  async function twEnd(status, winner) {
    if (!tw.pred) throw new Error('No Twitch prediction is running.');
    const body = { broadcaster_id: h.me(), id: tw.pred.id, status };
    if (status === 'RESOLVED') { const o = tw.pred.outcomes[winner === 2 ? 1 : 0]; if (!o) throw new Error('No outcome to pay out.'); body.winning_outcome_id = o.id; }
    const d = await h.helix('PATCH', '/predictions', body), x = d && d.data && d.data[0];
    tw.pred.status = x && x.status ? x.status : status; if (status !== 'LOCKED') tw.pred.done = Date.now(); h.changed(); return twView();
  }
  const twLock = () => twEnd('LOCKED'), twResolve = w => twEnd('RESOLVED', w), twCancel = () => twEnd('CANCELED');
  const cleanReward = r => ({ id: String(r.id || '').slice(0, 64), title: str(r.title, 45), cost: Math.max(1, Math.min(1e7, Math.round(Number(r.cost) || 500))), do: /^(hype|replay|sponsor|stinger|auto:[a-z0-9]{6,16})$/.test(String(r.do || '')) ? r.do : 'hype' });
  async function rewardAdd(b) {
    if (!h.hasScopes()) throw new Error('Allow channel points first (Twitch tab).');
    const r = cleanReward(b); if (!r.title) throw new Error('Give the reward a name.');
    const d = await h.helix('POST', '/channel_points/custom_rewards?broadcaster_id=' + encodeURIComponent(h.me()), { title: r.title, cost: r.cost, is_enabled: true, should_redemptions_skip_request_queue: false });
    const x = d && d.data && d.data[0]; if (!x) throw new Error('Twitch didn’t make the reward.');
    r.id = x.id; const list = h.rewards().filter(y => y.id !== r.id); list.push(r); h.setRewards(list); h.changed(); return list;
  }
  async function rewardRemove(id) {
    const list = h.rewards(); const r = list.find(x => x.id === id); if (!r) return list;
    try { await h.helix('DELETE', `/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(h.me())}&id=${encodeURIComponent(id)}`); } catch (e) { if (!/404/.test(e.message)) throw e; }
    const nl = list.filter(x => x.id !== id); h.setRewards(nl); h.changed(); return nl;
  }
  let busyPoll = false;
  async function rewardPoll() {
    const list = h.rewards(); if (!list.length || !h.hasScopes() || busyPoll) return;
    busyPoll = true;
    try {
      for (const r of list) {
        const d = await h.helix('GET', `/channel_points/custom_rewards/redemptions?broadcaster_id=${encodeURIComponent(h.me())}&reward_id=${encodeURIComponent(r.id)}&status=UNFULFILLED&first=20`);
        for (const x of (d && d.data) || []) {
          let ok = true; try { await h.redeem(r, x.user_name || x.user_login || ''); } catch (e) { ok = false; h.log('channel points: ' + e.message); }
          try { await h.helix('PATCH', `/channel_points/custom_rewards/redemptions?broadcaster_id=${encodeURIComponent(h.me())}&reward_id=${encodeURIComponent(r.id)}&id=${encodeURIComponent(x.id)}`, { status: ok ? 'FULFILLED' : 'CANCELED' }); } catch {}
          tw.last = { title: r.title, who: x.user_name || '', at: Date.now(), ok };
        }
      }
      tw.error = ''; tw.polled = Date.now();
    } catch (e) { tw.error = e.message; } finally { busyPoll = false; }
  }
  const rwT = setInterval(() => rewardPoll().catch(() => {}), 5000); rwT.unref && rwT.unref();
  function twView() { return { allowed: h.hasScopes(), pred: tw.pred ? { ...tw.pred } : null, error: tw.error, rewards: h.rewards(), last: tw.last || null }; }

  function action(b = {}) {
    switch (b.do) {
      case 'predOpen': return predOpen(b.a || h.names()[0], b.b || h.names()[1]);
      case 'predLock': return predLock();
      case 'predToggle': return pred && pred.open ? predLock() : predOpen(h.names()[0], h.names()[1]);
      case 'predClose': predClose(); return null;
      case 'predResult': return predResult(Number(b.who) === 2 ? 2 : 1);
      case 'pollStart': return pollStart(b);
      case 'pollEnd': return pollEnd();
      case 'pollToggle': if (poll && poll.open) return pollEnd(); if (!h.prefs().pollLast) throw new Error('Start a poll in the app first (Twitch tab › Polls).'); return pollStart(h.prefs().pollLast);
      case 'pollClear': pollClear(); return null;
      case 'hypeReset': times.length = 0; level = 0; h.changed(true); return null;
      default: throw new Error('Unknown step.');
    }
  }
  async function twAction(b = {}) {
    switch (b.do) {
      case 'start': return twStart(b.a || h.names()[0], b.b || h.names()[1], b.secs);
      case 'lock': return twLock();
      case 'resolve': return twResolve(Number(b.who) === 2 ? 2 : 1);
      case 'cancel': return twCancel();
      case 'clear': tw.pred = null; h.changed(); return twView();
      case 'rewardAdd': await rewardAdd({ ...b, do: b.reward }); return twView();
      case 'rewardRemove': await rewardRemove(String(b.id || '')); return twView();
      case 'toggle': { if (tw.pred && tw.pred.status === 'ACTIVE') return twLock(); if (tw.pred && tw.pred.status === 'LOCKED') { const w = h.winner(); if (!w) throw new Error('Pay out once the set is won (or cancel it).'); return twResolve(w); } return twStart(h.names()[0], h.names()[1]); }
      default: throw new Error('Unknown Twitch step.');
    }
  }
  function close() { clearInterval(hypeT); clearInterval(pollT); clearInterval(rwT); }
  return { onChat, onState, action, twAction, predView, pollView, hypeView, twView, close, rewardPoll, get pred() { return pred; }, get poll() { return poll; } };
}

module.exports = { createCrowd };
