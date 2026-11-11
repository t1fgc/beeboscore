'use strict';
/*
 * Viewer matches: chat joins a queue, the streamer plays them one at a time.
 * Pure bookkeeping — chat, saving and the overlays are wired up in server.js through the hooks.
 *
 *   data  = { open, queue[], current, played[], records{}, session{}, splash{} }   (saved to viewers.json)
 *   prefs = { commands{}, who, max, rejoin, replies, splashOnNext, splashHold, sync, streamerName, joinText }
 *
 * A "game" is one round of a match: Streamer won (+1 to the streamer) or Viewer won (+1 to the viewer).
 * records[login] = that viewer's all-time games against the streamer; session = the streamer's games today.
 */
const DEFAULT_COMMANDS = {
  join: '!join', leave: '!leave', queue: '!queue',
  open: '!open', close: '!close', next: '!next', remove: '!remove', add: '!add', clear: '!clearqueue', win: '!win', lose: '!lose',
};
const VIEWER_CMDS = ['join', 'leave', 'queue'];
const MOD_CMDS = ['open', 'close', 'next', 'remove', 'add', 'clear', 'win', 'lose'];
const DEFAULT_PREFS = {
  commands: { ...DEFAULT_COMMANDS }, who: 'everyone', max: 0, rejoin: 'yes', replies: true,
  splashOnNext: true, splashHold: 3, sync: false, streamerName: '', joinText: '',
};
const blankData = () => ({ open: false, queue: [], current: null, played: [], records: {}, session: { s: 0, v: 0, since: Date.now() }, splash: { show: false, n: 0 } });
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N}_ .\-]/gu, '').trim().slice(0, 25);
const cleanLogin = s => String(s || '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
const cmdList = v => String(v || '').toLowerCase().split(/[\s,]+/).map(x => x.trim()).filter(Boolean).map(x => (x[0] === '!' ? x : '!' + x)).slice(0, 4);

function normalizePrefs(p = {}) {
  const out = { ...DEFAULT_PREFS, ...p, commands: { ...DEFAULT_COMMANDS } };
  for (const k of Object.keys(DEFAULT_COMMANDS)) {
    const v = p.commands && p.commands[k];
    if (typeof v === 'string') { const l = cmdList(v); out.commands[k] = l.length ? l.join(' ') : DEFAULT_COMMANDS[k]; }
  }
  out.who = ['everyone', 'subs'].includes(out.who) ? out.who : 'everyone';
  out.max = Math.max(0, Math.min(500, Math.floor(Number(out.max) || 0)));
  out.rejoin = ['yes', 'no'].includes(out.rejoin) ? out.rejoin : 'yes';
  // seconds the VS splash stays fully up after its entrance (slider in the panel: 1–5 s)
  { const h = Number(out.splashHold); out.splashHold = Number.isFinite(h) && h > 0 ? Math.round(Math.max(1, Math.min(5, h)) * 2) / 2 : 3; }
  for (const k of ['replies', 'splashOnNext', 'sync']) out[k] = !!out[k];
  out.streamerName = cleanName(out.streamerName);
  out.joinText = String(out.joinText || '').replace(/[<>]/g, '').slice(0, 80);
  return out;
}

function createViewerMatches({ data, prefs, save = () => {}, changed = () => {}, say = () => {}, findAvatars = async () => ({}), channel = () => '' }) {
  let D = { ...blankData(), ...(data || {}) };
  if (!D.session) D.session = { s: 0, v: 0, since: Date.now() };
  if (!D.splash) D.splash = { show: false, n: 0 };
  let P = normalizePrefs(prefs);
  const undoStack = [];
  const snapshot = () => { undoStack.push(JSON.stringify(D)); if (undoStack.length > 30) undoStack.shift(); };
  const commit = (why) => { save(D); changed(why); };
  const streamer = () => P.streamerName || channel() || 'the streamer';
  const pos = login => D.queue.findIndex(q => q.login === login);
  const rec = login => D.records[login] || { w: 0, l: 0, matches: 0 };
  const reply = text => { if (P.replies && text) say(text); };

  // pictures arrive a moment after someone joins: fill them in when they do
  async function fillAvatars(logins) {
    const need = [...new Set(logins)].filter(l => l && !(D.records[l] && D.records[l].avatar));
    if (!need.length) return;
    let got = {};
    try { got = await findAvatars(need); } catch {}
    let any = false;
    for (const [l, url] of Object.entries(got)) {
      if (!url) continue;
      D.records[l] = { ...rec(l), ...(D.records[l] || {}), avatar: url }; any = true;
      for (const q of D.queue) if (q.login === l) q.avatar = url;
      if (D.current && D.current.login === l) D.current.avatar = url;
    }
    if (any) commit('avatar');
  }
  const entry = (login, display) => {
    const r = D.records[login];
    return { login, display: cleanName(display) || login, avatar: (r && r.avatar) || '', joinedAt: Date.now() };
  };
  const remember = (login, display) => {
    const r = rec(login);
    D.records[login] = { ...r, display: cleanName(display) || r.display || login };
  };

  // ------------------------------------------------------------ actions (panel, Stream Deck, chat)
  function join(login, display, { by = 'chat', sub = true, force = false } = {}) {
    login = cleanLogin(login);
    if (!login) return { ok: false, error: 'No name.' };
    const name = cleanName(display) || login;
    if (!force) {
      if (!D.open) return { ok: false, code: 'closed', error: 'The queue is closed.', say: `@${name} the queue is closed right now.` };
      if (P.who === 'subs' && !sub) return { ok: false, code: 'subs', error: 'Subscribers only.', say: `@${name} viewer matches are for subs right now.` };
      if (P.rejoin === 'no' && D.played.some(p => p.login === login && p.at >= D.session.since)) return { ok: false, code: 'played', error: 'Already played today.', say: `@${name} you've already played this stream. Thanks for battling!` };
      if (P.max && D.queue.length >= P.max) return { ok: false, code: 'full', error: 'The queue is full.', say: `@${name} the queue is full (${P.max}). Try again soon!` };
    }
    if (D.current && D.current.login === login) return { ok: false, code: 'playing', error: 'Already playing.', say: `@${name} you're playing right now!` };
    const i = pos(login);
    if (i >= 0) return { ok: false, code: 'already', error: 'Already in the queue.', say: `@${name} you're already #${i + 1} in line.` };
    snapshot();
    remember(login, name);
    D.queue.push(entry(login, name));
    commit('join');
    fillAvatars([login]);
    const n = D.queue.length;
    return { ok: true, position: n, say: n === 1 && !D.current ? `@${name} you're in — first up!` : `@${name} you're in! You're #${n} in line.` };
  }
  function leave(login) {
    login = cleanLogin(login);
    const i = pos(login);
    if (i < 0) return { ok: false, error: 'Not in the queue.' };
    snapshot();
    const [q] = D.queue.splice(i, 1);
    commit('leave');
    return { ok: true, say: `@${q.display} you've left the queue.` };
  }
  function remove(login) { const r = leave(login); if (r.ok) r.say = ''; return r; }
  function move(login, to) {
    login = cleanLogin(login);
    const i = pos(login); if (i < 0) return { ok: false, error: 'Not in the queue.' };
    const j = Math.max(0, Math.min(D.queue.length - 1, Math.floor(Number(to))));
    if (i === j) return { ok: true };
    snapshot();
    const [q] = D.queue.splice(i, 1); D.queue.splice(j, 0, q);
    commit('move'); return { ok: true };
  }
  function finishCurrent() {
    if (!D.current) return;
    const c = D.current;
    D.played.unshift({ login: c.login, display: c.display, avatar: c.avatar, s: c.s, v: c.v, at: Date.now() });
    D.played = D.played.slice(0, 60);
    if (c.s || c.v) { const r = rec(c.login); D.records[c.login] = { ...r, matches: (r.matches || 0) + 1 }; }
    D.current = null;
  }
  /** next viewer: whoever is first (or a specific login), the current match goes to "played" */
  function next(login) {
    let i = 0;
    if (login) { i = pos(cleanLogin(login)); if (i < 0) return { ok: false, error: 'Not in the queue.' }; }
    if (!D.queue.length) {
      if (!D.current) return { ok: false, code: 'empty', error: 'Nobody is in the queue.' };
      snapshot(); finishCurrent(); D.splash = { show: false, n: D.splash.n }; commit('next'); return { ok: true, empty: true };
    }
    snapshot();
    finishCurrent();
    const [q] = D.queue.splice(i, 1);
    D.current = { login: q.login, display: q.display, avatar: q.avatar || (D.records[q.login] && D.records[q.login].avatar) || '', startedAt: Date.now(), s: 0, v: 0 };
    if (P.splashOnNext) D.splash = { show: true, n: (D.splash.n || 0) + 1, at: Date.now() };
    commit('next');
    if (!D.current.avatar) fillAvatars([q.login]);
    const up = D.queue[0];
    return { ok: true, current: D.current, say: `@${q.display} you're up! Get ready to battle ${streamer()}.` + (up ? ` (@${up.display} you're next)` : '') };
  }
  /** who: 'streamer' | 'viewer' (a game was won); delta −1 takes one back */
  function result(who, delta = 1) {
    if (!D.current) return { ok: false, error: 'Nobody is playing right now.' };
    const d = delta < 0 ? -1 : 1, c = D.current, k = who === 'viewer' ? 'v' : 's';
    if (d < 0 && !c[k]) return { ok: false, error: 'Nothing to take back.' };
    snapshot();
    c[k] += d;
    D.session[k] = Math.max(0, (D.session[k] || 0) + d);
    const r = rec(c.login);
    D.records[c.login] = { ...r, display: c.display, w: Math.max(0, (r.w || 0) + (k === 'v' ? d : 0)), l: Math.max(0, (r.l || 0) + (k === 's' ? d : 0)) };
    commit('result');
    return { ok: true, current: c };
  }
  function setOpen(v) {
    const on = v === 'toggle' ? !D.open : !!v;
    if (on === D.open) return { ok: true, open: on };
    snapshot(); D.open = on; commit('open');
    const c = P.commands.join.split(' ')[0];
    return { ok: true, open: on, say: on ? `Viewer matches are OPEN! Type ${c} to battle ${streamer()}.` : 'Viewer matches are closed for now. Thanks everyone!' };
  }
  function clear() { if (!D.queue.length) return { ok: true }; snapshot(); D.queue = []; commit('clear'); return { ok: true, say: 'The queue has been cleared.' }; }
  /** the "how to join" sidebar overlay: on screen or tucked away */
  function sidebar(v) {
    const on = v === 'toggle' ? D.sidebar === false : !!v;
    D.sidebar = on; commit('sidebar'); return { ok: true, show: on };
  }
  function splash(v) {
    const on = v === 'toggle' ? !D.splash.show : !!v;
    if (on && !D.current) return { ok: false, error: 'Nobody is playing yet — press Next viewer first.' };
    D.splash = { show: on, n: (D.splash.n || 0) + (on ? 1 : 0), at: Date.now() };
    commit('splash'); return { ok: true, show: on };
  }
  function newSession() { snapshot(); D.session = { s: 0, v: 0, since: Date.now() }; commit('session'); return { ok: true }; }
  function resetRecord(login) { login = cleanLogin(login); if (!D.records[login]) return { ok: true }; snapshot(); D.records[login] = { ...D.records[login], w: 0, l: 0, matches: 0 }; commit('record'); return { ok: true }; }
  function undo() { const s = undoStack.pop(); if (!s) return { ok: false, error: 'Nothing to undo.' }; const keepSplash = D.splash; D = JSON.parse(s); D.splash = { ...keepSplash, show: false }; commit('undo'); return { ok: true }; }
  function queueLine() {
    if (!D.queue.length) return D.open ? `The queue is empty — type ${P.commands.join.split(' ')[0]} to battle ${streamer()}!` : 'The queue is closed.';
    const names = D.queue.slice(0, 5).map((q, i) => `${i + 1}. ${q.display}`).join(' · ');
    return `Up next: ${names}${D.queue.length > 5 ? ` (+${D.queue.length - 5} more)` : ''}`;
  }

  // ------------------------------------------------------------ chat commands
  function commandOf(text) {
    const first = String(text || '').trim().split(/\s+/)[0].toLowerCase();
    if (!first.startsWith('!')) return null;
    for (const [k, v] of Object.entries(P.commands)) if (v.split(' ').includes(first)) return k;
    return null;
  }
  /** returns what happened (for the panel's activity feed), or null if it wasn't one of ours */
  function onChat(m) {
    const k = commandOf(m.text);
    if (!k) return null;
    if (MOD_CMDS.includes(k) && !m.isMod) return null;          // viewers can't run streamer commands: ignore quietly
    const arg = cleanLogin(String(m.text).trim().split(/\s+/)[1] || '');
    let r;
    switch (k) {
      case 'join': r = join(m.login, m.display, { sub: m.isSub || m.isVip || m.isMod }); break;
      case 'leave': r = leave(m.login); if (!r.ok) r.say = ''; break;
      case 'queue': {
        const i = pos(m.login);
        r = { ok: true, say: i >= 0 ? `@${m.display} you're #${i + 1} of ${D.queue.length}. ${queueLine()}` : queueLine() };
        break;
      }
      case 'open': r = setOpen(true); break;
      case 'close': r = setOpen(false); break;
      case 'next': r = next(); if (!r.ok) r.say = 'The queue is empty.'; break;
      case 'remove': r = arg ? remove(arg) : { ok: false }; if (r.ok) r.say = `Removed ${arg} from the queue.`; break;
      case 'add': r = arg ? join(arg, arg, { force: true }) : { ok: false }; if (r.ok) r.say = `Added ${arg} to the queue (#${r.position}).`; break;
      case 'clear': r = clear(); break;
      case 'win': r = result('streamer'); if (r.ok) r.say = ''; break;
      case 'lose': r = result('viewer'); if (r.ok) r.say = ''; break;
    }
    if (r && r.say) reply(r.say);
    return { command: k, user: m.display, ok: !!(r && r.ok), code: r && r.code };
  }

  // ------------------------------------------------------------ views
  /** everything the overlays may show (no settings, nothing private) */
  function publicView() {
    const withRec = q => q && ({ login: q.login, display: q.display, avatar: q.avatar || '', rec: { w: rec(q.login).w || 0, l: rec(q.login).l || 0 } });
    return {
      open: D.open, count: D.queue.length, sidebar: D.sidebar !== false,
      queue: D.queue.slice(0, 12).map(withRec),
      current: D.current ? { ...withRec(D.current), s: D.current.s, v: D.current.v } : null,
      session: { s: D.session.s || 0, v: D.session.v || 0 },
      splash: { show: !!D.splash.show, n: D.splash.n || 0, hold: P.splashHold },
      streamer: streamer(), joinCmd: P.commands.join.split(' ')[0], leaveCmd: P.commands.leave.split(' ')[0], joinText: P.joinText, who: P.who,
    };
  }
  function fullView() {
    return {
      ...publicView(),
      queue: D.queue.map(q => ({ ...q, rec: { w: rec(q.login).w || 0, l: rec(q.login).l || 0, matches: rec(q.login).matches || 0 } })),
      played: D.played.slice(0, 20), canUndo: undoStack.length > 0, prefs: P,
    };
  }

  return {
    join, leave, remove, move, next, result, setOpen, clear, splash, sidebar, newSession, resetRecord, undo, onChat, queueLine,
    publicView, fullView,
    get data() { return D; },
    get prefs() { return P; },
    setPrefs(p) { P = normalizePrefs({ ...P, ...p, commands: { ...P.commands, ...((p && p.commands) || {}) } }); changed('prefs'); return P; },
    hideSplash() { if (D.splash.show) { D.splash = { ...D.splash, show: false }; commit('splash'); } },
  };
}

module.exports = { createViewerMatches, normalizePrefs, DEFAULT_PREFS, DEFAULT_COMMANDS, VIEWER_CMDS, MOD_CMDS };
