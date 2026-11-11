'use strict';
/*
 * BeeboScore — Stream Deck plugin (Node.js runtime, Stream Deck 6.4+).
 * Talks to the Stream Deck app over its plugin WebSocket and to BeeboScore over HTTP on this PC
 * (http://127.0.0.1:3300 — found automatically).
 */
const WebSocket = require('ws');
const { art, dataUrl } = require('./art');

// ---------------------------------------------------------------- launch arguments
const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf('-' + k); return i >= 0 ? argv[i + 1] : ''; };
const PORT = arg('port'), PLUGIN_UUID = arg('pluginUUID'), REGISTER = arg('registerEvent');
const PREFIX = 'com.t1fgc.beeboscore.';
// Stream Deck passes its own version and this plugin's version in -info; BeeboScore uses them to offer updates
const INFO = (() => { try { return JSON.parse(arg('info') || '{}'); } catch { return {}; } })();
const VERSIONS = { plugin: (INFO.plugin && INFO.plugin.version) || (typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : ''), app: (INFO.application && INFO.application.version) || '' };
const CANDIDATES = ['http://127.0.0.1:3300', 'http://127.0.0.1:3301', 'http://127.0.0.1:3302'];

let ws = null, globals = { address: '' }, base = '', status = null, online = false;
const contexts = new Map();   // context -> { action, settings, controller, image, title, state, feedback }
const send = (event, extra) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ event, ...extra })); };
const kind = action => String(action || '').replace(PREFIX, '');

// ---------------------------------------------------------------- BeeboScore HTTP
async function http(path, body, address = base) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(address + path, {
      method: body ? 'POST' : 'GET', signal: ctrl.signal,
      headers: { 'X-Beebo-Client': 'streamdeck', 'X-Beebo-Plugin': VERSIONS.plugin, 'X-Beebo-SD': VERSIONS.app, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('BeeboScore asked for a password — use the address of this PC.');
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  } finally { clearTimeout(t); }
}
async function findApp() {
  const list = globals.address ? [globals.address.replace(/\/+$/, '')] : CANDIDATES;
  for (const a of list) { try { const d = await http('/api/remote/status', null, a); if (d && d.p1) { base = a; return d; } } catch {} }
  return null;
}
let polling = false;
async function poll() {
  if (polling) return; polling = true;
  try {
    let d = null;
    if (base) { try { d = await http('/api/remote/status'); } catch { d = null; } }
    if (!d) d = await findApp();
    const was = online; online = !!d;
    if (d) applyStatus(d); else if (was) renderAll();
    if (was !== online) for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx);
  } finally { polling = false; }
}
function applyStatus(d) {
  const changed = !status || JSON.stringify(status) !== JSON.stringify(d);
  status = d;
  if (changed) { renderAll(); for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx); }
}
async function act(body, ctx, okFlash) {
  try {
    const r = await http('/api/remote/action', body);
    if (r && r.status) applyStatus(r.status);
    if (r && r.url) send('openUrl', { payload: { url: base + r.url } });
    if (okFlash && ctx) send('showOk', { context: ctx });
    return r;
  } catch (e) {
    if (ctx) send('showAlert', { context: ctx });
    log(`action ${body.action} failed: ${e.message}`);
    poll();
  }
}
const log = msg => send('logMessage', { payload: { message: '[BeeboScore] ' + msg } });

// ---------------------------------------------------------------- drawing
function render(ctx) {
  const c = contexts.get(ctx); if (!c) return;
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1, p = status ? status['p' + side] : null;
  const off = !online;
  let svg = '', state = null, fb = null;
  switch (kind(c.action)) {
    case 'score':
      svg = art.score({ side, name: p && p.name, score: p ? p.score : '–', mode: s.mode || 'tapHold', offline: off });
      if (c.controller === 'Encoder') {
        const ft = status && status.firstTo, sc = p ? p.score : 0;
        fb = { title: `P${side} · ${(p && p.name) || 'Player ' + side}`, value: off ? 'offline' : String(sc), indicator: { value: ft ? Math.min(100, Math.round(sc / ft * 100)) : 0 } };
      }
      break;
    case 'reset': svg = art.reset({ offline: off }); break;
    case 'swap': svg = art.swap({ offline: off }); break;
    case 'undo': svg = art.undo({ offline: off }); break;
    case 'clear': svg = art.clear({ offline: off }); break;
    case 'nextmatch': svg = art.nextmatch({ offline: off, label: c.busy ? 'LOADING…' : (status && !status.startgg ? 'NO START.GG' : '') }); break;
    case 'vs': { const on = !!(status && status.vs); svg = art.vs({ on, offline: off }); state = on ? 1 : 0; break; }
    case 'bracket': {
      const on = !!(status && status.splash === 'bracket');
      const b = status && status.bracket, hint = status && !status.startgg ? 'NO START.GG' : (b && b.top8 && !on ? 'TOP 8 SET' : '');
      svg = art.bracket({ on, offline: off, label: c.loading ? 'LOADING…' : hint }); state = on ? 1 : 0; break;
    }
    case 'bracketrefresh': svg = art.bracketRefresh({ busy: !!c.busy || !!(status && status.bracket && status.bracket.loading), offline: off, label: status && !status.startgg ? 'NO START.GG' : (c.flash || '') }); break;
    case 'victory': { const on = !!(status && status.victory); svg = art.victory({ on, ready: !!(status && status.winner), offline: off }); state = on ? 1 : 0; break; }
    case 'bracketside': {
      const on = !!(status && status.splash === 'bracket'), b = (status && status.bracket) || {};
      const want = s.bside === 'W' ? 'W' : s.bside === 'L' ? 'L' : '';
      const lab = c.loading ? 'LOADING…' : status && !status.startgg ? 'NO START.GG' : (!on && want === 'W' ? 'WINNERS' : '');
      svg = art.bracketSide({ side: b.side || 'W', on, paged: b.ready ? !!b.paged : true, offline: off, label: lab });
      break;
    }
    case 'latency': { const l = (status && status.latency) || {}; svg = art.latency({ viewers: l.viewers || 0, worst: l.worst, offline: off }); break; }
    case 'viewernext': { const t = (status && status.twitch) || {}; svg = art.viewerNext({ next: t.next, count: t.count || 0, busy: !!c.busy, offline: off }); break; }
    case 'viewerresult': { const t = (status && status.twitch) || {}, cur = t.current; svg = art.viewerResult({ who: s.who === 'viewer' ? 'viewer' : 'streamer', s: cur ? cur.s : 0, v: cur ? cur.v : 0, playing: !!cur, offline: off }); break; }
    case 'viewerqueue': { const t = (status && status.twitch) || {}; svg = art.viewerQueue({ open: !!t.open, count: t.count || 0, offline: off }); state = t.open ? 1 : 0; break; }
    case 'autoscore': { const a = (status && status.autoscore) || {}; svg = art.autoscore({ on: !!a.enabled, state: a.state, pending: a.pending, offline: off }); state = a.enabled ? 1 : 0; break; }
    case 'autoscoreundo': { const a = (status && status.autoscore) || {}; svg = art.autoscoreUndo({ ready: !!a.canUndo, offline: off }); break; }
    case 'autoscoreconfirm': { const a = (status && status.autoscore) || {}; svg = art.autoscoreConfirm({ pending: a.pending, offline: off }); break; }
    case 'autoscoreresync': svg = art.autoscoreResync({ offline: off }); break;
    case 'viewersidebar': { const t = (status && status.twitch) || {}, on = t.sidebar !== false; svg = art.viewerSidebar({ on, offline: off }); state = on ? 1 : 0; break; }
    case 'viewersplash': { const t = (status && status.twitch) || {}; svg = art.viewerSplash({ on: !!t.splash, ready: !!t.current, offline: off }); state = t.splash ? 1 : 0; break; }
    case 'sggreport': { const r = (status && status.sggReport) || {}; svg = art.sggReport({ ready: !!r.can, sent: !!r.sent, mode: r.mode, offline: off }); break; }
    case 'postlink': { const sh = (status && status.share) || {}; svg = art.postlink({ ready: !!(sh.on && sh.online && sh.chat), offline: off }); break; }
    case 'standings': { const on = !!(status && status.splash === 'standings'); svg = art.standings({ on, ready: !!(status && status.bracket && status.bracket.standings), offline: off }); state = on ? 1 : 0; break; }
    case 'top8': {
      const on = !!(status && status.splash === 'top8');
      svg = art.top8({ on, offline: off, label: c.loading ? 'LOADING…' : (status && !status.startgg ? 'NO START.GG' : '') }); state = on ? 1 : 0; break;
    }
    case 'loser': { const on = !!(p && p.loser); svg = art.loser({ side, on, offline: off }); state = on ? 1 : 0; break; }
    case 'player': svg = art.player({ side, name: p && p.name, offline: off }); break;
    case 'fnext': { const f = status && status.format; svg = art.formatNext({ none: !f, done: f && f.status === 'done', score: f ? (f.tags && f.tags.length === 2 && f.kind === 'teams' ? f.score : f.score) : '', label: f ? f.name : '', pending: !!(f && f.pending), offline: off }); break; }
    case 'fundo': { const f = status && status.format; svg = art.formatUndo({ ready: !!(f && f.canUndo), offline: off }); break; }
    case 'vtopen': { const v = status && status.vt; svg = art.vtSignup({ open: !!(v && v.open && v.status === 'signup'), count: v ? v.count : 0, started: !!(v && v.status !== 'signup'), offline: off }); state = v && v.open ? 1 : 0; break; }
    case 'vtnext': { const v = status && status.vt; svg = art.vtNext({ now: v ? v.now : '', won: !!(v && v.winner), done: !!(v && v.status === 'done'), champion: v ? v.champion : '', offline: off }); break; }
    case 'overlay': { const h = !!(status && status.hidden); svg = art.overlay({ hidden: h, offline: off }); state = h ? 1 : 0; break; }
    case 'fbar': { const f = status && status.format, on = !!(f && status.fbar !== false); svg = art.formatBar({ on, kind: f ? (f.preset === 'koth' ? 'koth' : f.kind) : '', offline: off }); state = on ? 1 : 0; break; }
    case 'fsplash': { const k = s.kind || 'fboard', on = !!(status && status.splash === k); svg = art.formatSplash({ kind: k, on, offline: off }); state = on ? 1 : 0; break; }
    case 'sound': { const so = (status && status.sound) || {}, on = !!so.on; svg = art.sound({ on, vol: so.vol ?? 60, mode: s.smode || 'toggle', offline: off }); state = on && (s.smode || 'toggle') === 'toggle' ? 1 : 0; break; }
    case 'screen': {
      const list = (status && status.screens) || [], sc = list.find(x => x.id === s.screen) || list.find(x => x.name === s.screenName);
      const on = !!(sc && status && status.screen === sc.id);
      svg = art.screen({ name: sc ? sc.name : (s.screenName || ''), on, missing: !!s.screenName && !sc && !!status, offline: off }); state = on ? 1 : 0; break;
    }
    case 'layout': {
      const list = (status && status.layouts) || [];
      const target = s.mode === 'specific' ? list.find(o => o.name === s.layout) : list.find(o => o.name === (status && status.layout));
      svg = art.layout({ title: target ? target.title : (s.mode === 'specific' ? 'Pick a layout' : 'Layout'), mode: s.mode || 'next', offline: off });
      break;
    }
    default: return;
  }
  if (state !== null && c.state !== state) { c.state = state; send('setState', { context: ctx, payload: { state } }); }
  const img = dataUrl(svg);
  if (img !== c.image) { c.image = img; send('setImage', { context: ctx, payload: { image: img, target: 0 } }); }
  if (c.title !== '') { c.title = ''; send('setTitle', { context: ctx, payload: { title: '', target: 0 } }); }
  if (fb) { const j = JSON.stringify(fb); if (j !== c.feedback) { c.feedback = j; send('setFeedback', { context: ctx, payload: fb }); } }
}
function renderAll() { for (const ctx of contexts.keys()) render(ctx); }
function pushToPI(ctx) {
  const c = contexts.get(ctx); if (!c) return;
  send('sendToPropertyInspector', { action: c.action, context: ctx, payload: {
    online, address: base, configured: globals.address || '',
    layouts: (status && status.layouts) || [], layout: status && status.layout, screens: (status && status.screens) || [], version: status && status.version,
  } });
}

// ---------------------------------------------------------------- key handling
const HOLD_MS = 450;
function keyDown(ctx) {
  const c = contexts.get(ctx); if (!c) return;
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1;
  switch (kind(c.action)) {
    case 'score': {
      const mode = s.mode || 'tapHold';
      if (mode === 'add') return act({ action: 'score', side, delta: 1 });
      if (mode === 'subtract') return act({ action: 'score', side, delta: -1 });
      c.held = false;
      c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'score', side, delta: -1 }); }, HOLD_MS);
      return;
    }
    case 'reset':
      if (s.hold) { c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'reset' }, ctx, true); }, 700); return; }
      return act({ action: 'reset' });
    case 'swap': return act({ action: 'swap' });
    case 'undo': return act({ action: 'undo' }, ctx);
    case 'clear': return act({ action: 'clear' }, ctx, true);
    case 'vs': return act({ action: 'vs', show: 'toggle' }, ctx);
    case 'bracket': return loading(ctx, act({ action: 'splash', kind: 'bracket', show: 'toggle' }, ctx));
    case 'top8': return loading(ctx, act({ action: 'splash', kind: 'top8', show: 'toggle' }, ctx));
    case 'standings': return loading(ctx, act({ action: 'splash', kind: 'standings', show: 'toggle' }, ctx));
    case 'postlink': return act({ action: 'postlink' }, ctx, true);
    case 'sggreport': return act({ action: 'sggreport' }, ctx, true);
    case 'loser': return act({ action: 'loser', side }, ctx);
    case 'player': return act({ action: 'pick', side }, ctx);
    case 'fnext': { const f = status && status.format; if (!f) return; if (f.pending) return act({ action: 'format', do: 'confirm' }, ctx); return; }
    case 'fundo': return act({ action: 'format', do: 'undo' }, ctx);
    case 'sound': return act(s.smode === 'up' || s.smode === 'down' ? { action: 'sound', step: s.smode === 'up' ? 10 : -10 } : { action: 'sound', on: 'toggle' }, ctx);
    case 'vtopen': return act({ action: 'vt', do: 'open', open: 'toggle' }, ctx);
    case 'vtnext': return act({ action: 'vt', do: 'next' }, ctx);
    case 'fbar': return act({ action: 'fbar', show: 'toggle' }, ctx);
    case 'overlay': return act({ action: 'overlay', show: 'toggle' }, ctx);
    case 'fsplash': return act({ action: 'format', do: 'splash', kind: s.kind || 'fboard', show: 'toggle' }, ctx);
    case 'screen': { const list = (status && status.screens) || [], sc = list.find(x => x.id === s.screen) || list.find(x => x.name === s.screenName); return act({ action: 'screen', name: sc ? sc.id : (s.screenName || s.screen || ''), show: 'toggle' }, ctx); }
    case 'layout': return act(s.mode === 'specific' ? { action: 'layout', name: s.layout } : { action: 'layout', name: 'next', sameGame: s.mode !== 'any' }, ctx);
    case 'bracketrefresh': {
      c.busy = true; render(ctx);
      return act({ action: 'bracketRefresh' }, ctx, true).finally(() => { c.busy = false; c.flash = 'UPDATED'; render(ctx); setTimeout(() => { c.flash = ''; render(ctx); }, 1500); });
    }
    case 'latency': return act({ action: 'latencyTest' }, ctx, true);
    case 'viewernext': { c.busy = true; render(ctx); return act({ action: 'viewerNext' }, ctx).finally(() => { c.busy = false; render(ctx); }); }
    case 'viewerresult': { c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'viewerResult', who: s.who === 'viewer' ? 'viewer' : 'streamer', delta: -1 }, ctx); }, HOLD_MS); return; }
    case 'viewerqueue': return act({ action: 'viewerQueue', open: 'toggle' }, ctx);
    case 'viewersplash': return act({ action: 'viewerSplash', show: 'toggle' }, ctx);
    case 'autoscore': { const a = (status && status.autoscore) || {}; return act(a.pending ? { action: 'autoscoreConfirm' } : { action: 'autoscoreToggle' }, ctx); }
    case 'autoscoreundo': return act({ action: 'autoscoreUndo' }, ctx, true);
    case 'autoscoreconfirm': return act({ action: 'autoscoreConfirm' }, ctx, true);
    case 'autoscoreresync': return act({ action: 'autoscoreResync' }, ctx, true);
    case 'viewersidebar': return act({ action: 'viewerSidebar', show: 'toggle' }, ctx);
    case 'victory': return act({ action: 'victory', show: 'toggle' }, ctx);
    case 'bracketside': return loading(ctx, act({ action: 'bracketSide', side: s.bside === 'W' || s.bside === 'L' ? s.bside : 'toggle' }, ctx));
    case 'nextmatch': {
      c.busy = true; render(ctx);
      return act({ action: 'nextMatch' }, ctx, true).finally(() => { c.busy = false; render(ctx); });
    }
  }
}
// BeeboScore fetches the latest results before a splash goes on air: say LOADING… if that takes a moment
function loading(ctx, p) {
  const c = contexts.get(ctx); if (!c) return p;
  const t = setTimeout(() => { c.loading = true; render(ctx); }, 250);
  return Promise.resolve(p).finally(() => { clearTimeout(t); if (c.loading) { c.loading = false; render(ctx); } });
}
function keyUp(ctx) {
  const c = contexts.get(ctx); if (!c || !c.holdTimer) return;
  clearTimeout(c.holdTimer); c.holdTimer = null;
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1;
  if (!c.held && kind(c.action) === 'score') act({ action: 'score', side, delta: 1 });
  if (!c.held && kind(c.action) === 'viewerresult') act({ action: 'viewerResult', who: s.who === 'viewer' ? 'viewer' : 'streamer', delta: 1 }, ctx);
  if (!c.held && kind(c.action) === 'reset' && s.hold) send('showAlert', { context: ctx });   // released too early
}

// ---------------------------------------------------------------- Stream Deck events
function onMessage(raw) {
  let m; try { m = JSON.parse(raw); } catch { return; }
  const { event, context: ctx, action, payload = {} } = m;
  switch (event) {
    case 'willAppear':
      contexts.set(ctx, { action, settings: payload.settings || {}, controller: payload.controller || 'Keypad', image: null, title: null, state: payload.state, feedback: null });
      render(ctx); if (!status) poll();
      break;
    case 'willDisappear': { const c = contexts.get(ctx); if (c && c.holdTimer) clearTimeout(c.holdTimer); contexts.delete(ctx); break; }
    case 'didReceiveSettings': { const c = contexts.get(ctx); if (c) { c.settings = payload.settings || {}; c.image = null; render(ctx); } break; }
    case 'didReceiveGlobalSettings': {
      const g = payload.settings || {};
      if ((g.address || '') !== (globals.address || '')) { base = ''; status = null; }
      globals = { address: '', ...g };
      poll();
      break;
    }
    case 'keyDown': keyDown(ctx); break;
    case 'keyUp': keyUp(ctx); break;
    case 'dialRotate': {      // Stream Deck +: turn to change that player's score
      const c = contexts.get(ctx); if (!c || kind(c.action) !== 'score') break;
      const side = Number((c.settings || {}).side) === 2 ? 2 : 1, ticks = Math.max(-5, Math.min(5, Number(payload.ticks) || 0));
      if (ticks) act({ action: 'score', side, delta: ticks });
      break;
    }
    case 'dialDown': case 'touchTap': {   // press / tap the dial = +1 (long touch = −1)
      const c = contexts.get(ctx); if (!c || kind(c.action) !== 'score') break;
      const side = Number((c.settings || {}).side) === 2 ? 2 : 1;
      act({ action: 'score', side, delta: event === 'touchTap' && payload.hold ? -1 : 1 });
      break;
    }
    case 'propertyInspectorDidAppear': { const c = contexts.get(ctx); if (c) { c.pi = true; pushToPI(ctx); poll(); } break; }
    case 'propertyInspectorDidDisappear': { const c = contexts.get(ctx); if (c) c.pi = false; break; }
    case 'sendToPlugin':
      if (payload.refresh) { base = ''; poll().then(() => pushToPI(ctx)); }
      if (payload.openApp) send('openUrl', { payload: { url: (base || CANDIDATES[0]) + '/' } });
      break;
    case 'systemDidWakeUp': base = ''; poll(); break;
  }
}

// ---------------------------------------------------------------- start
function connect() {
  if (!PORT) { console.error('Start this from Stream Deck.'); process.exit(1); }
  ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.on('open', () => { send(REGISTER, { uuid: PLUGIN_UUID }); send('getGlobalSettings', { context: PLUGIN_UUID }); log('connected'); });
  ws.on('message', d => onMessage(String(d)));
  ws.on('close', () => process.exit(0));        // Stream Deck closed: it restarts the plugin when needed
  ws.on('error', () => {});
}
connect();
setInterval(poll, 700);
module.exports = { onMessage, contexts, _state: () => ({ base, online, status }) };
