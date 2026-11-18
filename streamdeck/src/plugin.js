'use strict';
/*
 * BeeboScore — Stream Deck plugin (Node.js runtime, Stream Deck 6.4+).
 * Talks to the Stream Deck app over its plugin WebSocket and to BeeboScore over HTTP on this PC
 * (BeeboScore: http://127.0.0.1:3200, or 3300 for the portable Testbuild — found automatically).
 */
const WebSocket = require('ws');
const ART = require('./art'), { art, dataUrl, grouped, FORMAT_NAMES } = ART;
Object.assign(art, { disabled: ART.disabled, blend: ART.blend, shine: ART.shine, pressed: ART.pressed, stateOf: ART.stateOf });   // 1.12.17: greyed-out keys and the key animations
const { slotFor, sectionOf, profileFor, pagesFor, sdMode, DEVICE_NAMES } = require('./slots');
const pages = new Map();       // 1.12.8: device id -> the page shown in "Everything, in pages"

// ---------------------------------------------------------------- launch arguments
const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf('-' + k); return i >= 0 ? argv[i + 1] : ''; };
const PORT = arg('port'), PLUGIN_UUID = arg('pluginUUID'), REGISTER = arg('registerEvent');
const PREFIX = 'com.t1fgc.beeboscore.lite.';
// Stream Deck passes its own version and this plugin's version in -info; BeeboScore uses them to offer updates
const INFO = (() => { try { return JSON.parse(arg('info') || '{}'); } catch { return {}; } })();
const VERSIONS = { plugin: (INFO.plugin && INFO.plugin.version) || (typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : ''), app: (INFO.application && INFO.application.version) || '' };
const CANDIDATES = ['http://127.0.0.1:3200', 'http://127.0.0.1:3300', 'http://127.0.0.1:3201', 'http://127.0.0.1:3202', 'http://127.0.0.1:3301'];   // BeeboScore's own ports (the full BeeboScore uses 3000 and 3100)

let ws = null, globals = { address: '' }, base = '', status = null, online = false;
const devices = new Map();     // Stream Deck device id -> { id, name, type, size: { columns, rows } }   (1.12: Set up Stream Deck)
for (const d of (INFO.devices || [])) if (d && d.id) devices.set(d.id, d);
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
  const first = !status; status = d;
  if (changed) { for (const c of contexts.values()) resolveSlot(c); renderAll(); for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx); }
  if (first) reportDevices();
  setupCheck(d);
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

// ---------------------------------------------------------------- BeeboScore keys (1.12): what a key from the bundled profiles does
// depends on where it sits and what runs in the app, so a format switch rearranges the deck by itself
function resolveSlot(c) {
  if (kind(c.real) !== 'slot') return false;
  const d = devices.get(c.device) || {}, size = d.size || {}, at = c.coords || {};
  const cols = size.columns || (d.type === 2 ? 8 : 5), rows = size.rows || (d.type === 2 ? 4 : 3);
  const k = slotFor(cols, rows, Number(at.column) || 0, Number(at.row) || 0, status, pages.get(c.device) || 0);
  const action = PREFIX + k.k, js = JSON.stringify(k.settings);
  if (action === c.action && js === JSON.stringify(c.settings)) return false;
  if (c.holdTimer) clearTimeout(c.holdTimer);
  c.action = action; c.settings = { ...k.settings }; c.flash = ''; c.image = null;
  return true;
}
const deviceList = () => [...devices.values()].map(d => { const p = profileFor(d); return { name: d.name || DEVICE_NAMES[d.type] || 'Stream Deck', type: d.type, cols: (d.size || {}).columns || 0, rows: (d.size || {}).rows || 0, profile: p ? p.label : '' }; });
function reportDevices(extra = {}) { if (base) http('/api/remote/action', { action: 'sdreport', devices: deviceList(), ...extra }).catch(() => {}); }
// "Set up Stream Deck" in the app: show the BeeboScore profile on every deck that has one (Stream Deck asks once to add it)
let setupSeen = null;
function setupCheck(d) {
  const r = d && d.sdSetup, n = r ? r.n : 0;
  if (setupSeen === null) { setupSeen = n; if (!r || Date.now() - r.at > 20000) return; }   // only a fresh request when the plugin has just started
  else if (n === setupSeen) return;
  setupSeen = n; if (!n) return;
  const sent = [];
  for (const dev of devices.values()) {
    const p = profileFor(dev); if (!p) continue;
    send('switchToProfile', { context: PLUGIN_UUID, device: dev.id, payload: { profile: p.name } });
    sent.push(dev.name || p.label);
  }
  log(`set up: ${sent.join(', ') || 'no deck with a BeeboScore profile'}`);
  reportDevices({ setup: n, sent });
}

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
    case 'page': { const d = devices.get(c.device) || {}, sz = d.size || {}, P = pagesFor(sz.columns || (d.type === 2 ? 8 : 5), sz.rows || (d.type === 2 ? 4 : 3)) || [{ name: 'PAGE' }], i = (pages.get(c.device) || 0) % P.length;
      svg = art.page({ page: i, total: P.length, name: P[i].name, next: P[(i + 1) % P.length].name, offline: off }); break; }
    case 'status': svg = art.status({ offline: off, section: sectionOf(status), format: status && status.format ? FORMAT_NAMES[status.format.preset] || 'FORMAT' : '' }); break;
    case 'blank': svg = art.blank(); break;
    case 'reset': svg = art.reset({ offline: off, hint: s.holdClear ? 'HOLD: NEXT SET' : '' }); break;
    case 'swap': svg = art.swap({ offline: off }); break;
    case 'undo': svg = art.undo({ offline: off, label: status && status.undo === 'format' ? 'UNDO RESULT' : '' }); break;
    case 'clear': svg = art.clear({ offline: off }); break;
    case 'stinger': svg = art.stinger({ offline: off }); break;
    case 'hideall': { const on = !!(status && (status.vs || status.victory || status.splash || status.screen || (status.twitch && status.twitch.splash))); svg = art.hideAll({ on, offline: off }); break; }
    case 'nextmatch': svg = art.nextmatch({ offline: off, label: c.busy ? 'LOADING…' : (status && !status.startgg ? 'NO START.GG' : '') }); break;
    case 'vs': {                         // 1.12.6: FullVS — or, with no fixed style, the VS style chosen in the app (hold the key to switch)
      const style = s.style === 'full' || s.style === 'glass' ? s.style : (status && status.vsStyle === 'glass' ? 'glass' : 'full'), pick = !s.style;
      if (style === 'glass') { const on = !!(status && status.playerVs); svg = art.playerVs({ on, hint: pick ? 'HOLD: FULLVS' : '', offline: off }); state = on ? 1 : 0; break; }
      const on = !!(status && status.vs); svg = art.vs({ on, hint: pick ? 'HOLD: GLASSVS' : '', offline: off }); state = on ? 1 : 0; break; }
    case 'playervs': { const on = !!(status && status.playerVs); svg = art.playerVs({ on, offline: off }); state = on ? 1 : 0; break; }   // GlassVS
    case 'comm': { const on = !!(status && status.splash === 'comm'); svg = art.comm({ on, live: (status && status.cams) || 0, offline: off }); state = on ? 1 : 0; break; }
    case 'vsstyle': { const g = !!(status && status.vsStyle === 'glass'); svg = art.vsStyle({ glass: g, offline: off }); state = g ? 1 : 0; break; }
    case 'flock': { const f = status && status.format, t = f && f.tdb; svg = art.formatLock({ open: !!(t && t.open), undo: !!(t && t.undo), none: !t, offline: off }); break; }
    case 'funlock': { const f = status && status.format, t = f && f.tdb; svg = art.formatUnlock({ ready: !!(t && t.undo), none: !t, offline: off }); break; }
    case 'tempo': svg = art.tempo({ bpm: (status && status.tempo) || 0, offline: off }); break;
    case 'replay': svg = art.replay({ offline: off }); break;
    case 'automation': { const L = (status && status.autos) || [], want = String(s.auto || '').toLowerCase(), a = L.find(x => x.id === s.auto || x.name.toLowerCase() === want) || (!want && L[0]);
      svg = art.automation({ name: a ? a.name : s.auto || '', running: !!(a && a.running), missing: !a, offline: off }); break; }      // 1.12.16
    case 'chapter': svg = art.chapter({ flash: c.flash || '', offline: off }); break;
    case 'stats': { const side = Number(s.side) === 2 ? 2 : 1, st = (status && status.stats) || {}; svg = art.stats({ side, name: status && status['p' + side] ? status['p' + side].name : '', on: !!(st.show && st.side === side), offline: off }); break; }
    case 'sponsor': { const sp = (status && status.spon) || {}; svg = art.sponsor({ on: !!sp.on, none: !sp.n, offline: off }); break; }
    case 'autopilot': { const a = (status && status.autopilot) || {}; svg = art.autopilot({ on: !!a.on, running: !!a.running, step: a.step || '', offline: off }); break; }
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
    case 'vtjoin': { const v = status && status.vt, on = !!(status && status.splash === 'vtjoin'); svg = art.vtJoin({ on, count: v ? v.count : 0, open: !!(v && v.open), ready: !!v, offline: off }); state = on ? 1 : 0; break; }
    case 'vtbracket': { const v = status && status.vt, on = !!(v && v.source === 'viewer' && status && ['bracket', 'top8'].includes(status.splash)); svg = art.vtBracket({ on, ready: !!(v && v.status !== 'signup'), offline: off }); state = on ? 1 : 0; break; }
    case 'vtnext': { const v = status && status.vt; svg = art.vtNext({ now: v ? v.now : '', won: !!(v && v.winner), done: !!(v && v.status === 'done'), champion: v ? v.champion : '', offline: off }); break; }
    case 'fswitch': { const f = status && status.format, t = f && f.tdb, tm = t && t.teams[side - 1]; svg = art.formatSwitch({ side, none: !t, open: !!(t && t.open), name: tm ? tm.cur : '', lives: tm ? tm.lives : 0, max: t ? t.max : 0, color: tm ? tm.color : '', offline: off }); break; }
    case 'fbar': { const f = status && status.format, on = !!(f && status.fbar !== false); svg = art.formatBar({ on, kind: f ? (f.preset === 'koth' ? 'koth' : f.kind) : '', offline: off }); state = on ? 1 : 0; break; }
    case 'fsplash': { const k = s.kind || 'fboard', on = !!(status && status.splash === k); svg = art.formatSplash({ kind: k, on, offline: off }); state = on ? 1 : 0; break; }
    case 'fxq': svg = art.fxq({ q: (status && status.fxq) || 'auto', offline: off }); break;
    case 'obsrefresh': svg = art.obsRefresh({ flash: c.flash || '', offline: off }); break;
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
    default: {
      const sk = SHOWKEYS[kind(c.action)]; if (!sk) return;
      svg = art.show({ ...sk(status && status.x ? status.x : {}, s, status || {}, c), offline: off }); break;
    }
  }
  // every key in its group's colour; the format and viewer-tournament keys also say what they're working on
  { const k = kind(c.action), f = status && status.format, v = status && status.vt;
    const tag = ['fundo', 'fsplash', 'fbar', 'flock', 'funlock'].includes(k) ? (f ? FORMAT_NAMES[f.preset] || 'GAME FORMAT' : 'NO FORMAT RUNNING') : ['vtopen', 'vtjoin', 'vtbracket', 'vtnext'].includes(k) ? (v ? v.name || 'VIEWER TOURNEY' : 'VIEWER TOURNEY') : '';
    svg = grouped(svg, k, tag);
    // 1.12.17: a key that can't do anything right now is greyed out, and says why
    const u = off ? null : usable(k, s, status); if (u) svg = art.disabled(svg, u); }
  if (state !== null && c.state !== state) { c.state = state; send('setState', { context: ctx, payload: { state } }); }
  if (status && /^#[0-9a-f]{6}$/i.test(status.accent || '')) svg = svg.split('#ffb020').join(status.accent);    // 1.12.18: the brand kit's colour for the keys
  paint(ctx, svg, kind(c.action) + '|' + JSON.stringify(c.settings || {}));
  if (c.title !== '') { c.title = ''; send('setTitle', { context: ctx, payload: { title: '', target: 0 } }); }
  if (fb) { const j = JSON.stringify(fb); if (j !== c.feedback) { c.feedback = j; send('setFeedback', { context: ctx, payload: fb }); } }
}
function renderAll() { for (const ctx of contexts.keys()) render(ctx); }

// ---------------------------------------------------------------- 1.12.17: which keys can be used right now
// null = usable; otherwise the reason it isn't (shown on the greyed-out key). Keys that always work return null.
function usable(k, s, st) {
  if (!st) return null;
  const f = st.format, live = !!(f && f.status !== 'done'), tdb = f && f.tdb, br = st.bracket || {}, tw = st.twitch || {};
  switch (k) {
    case 'fnext': case 'fbar': case 'fsplash': return f ? (k === 'fsplash' && s.kind === 'flead' && f.preset !== 'koth' ? 'KING OF THE HILL' : null) : 'NO FORMAT';
    case 'fundo': return !f ? 'NO FORMAT' : f.canUndo ? null : 'NOTHING TO UNDO';
    case 'fswitch': case 'flock': return !tdb ? 'TEAM DEATH BATTLE' : null;
    case 'funlock': return !tdb ? 'TEAM DEATH BATTLE' : tdb.undo ? null : 'NOTHING LOCKED';
    case 'vtopen': case 'vtjoin': case 'vtbracket': case 'vtnext': return st.vt ? null : 'NO TOURNAMENT';
    case 'viewernext': case 'viewerresult': case 'viewerqueue': case 'viewersplash': case 'viewersidebar': return tw.chat === 'off' || !tw.chat ? 'TWITCH CHAT OFF' : null;
    case 'nextmatch': case 'bracket': case 'top8': case 'standings': case 'bracketside': case 'bracketrefresh': return st.startgg || br.ready ? null : 'NO BRACKET';
    case 'sggreport': return !st.startgg ? 'NO START.GG' : null;
    case 'victory': return st.winner || st.victory ? null : 'NO WINNER YET';
    case 'stats': { const p = st['p' + (Number(s.side) === 2 ? 2 : 1)]; return p && p.name ? null : 'NO PLAYER'; }
    case 'sponsor': return st.spon && st.spon.n ? null : 'NO SPONSORS';
    case 'automation': return (st.autos || []).length ? null : 'NONE MADE';
    case 'undo': return st.undo ? null : 'NOTHING TO UNDO';
    // 1.12.21: the set as it's told
    case 'momentreplay': return st.x && st.x.mo && !st.x.mo.on ? 'MOMENTS OFF' : st.x && st.x.mo && st.x.mo.last ? null : 'NO MOMENT YET';
    case 'h2h': case 'greset': { const ok = n => !!n && !/^Player [12]$/.test(n); return ok((st.p1 || {}).name) && ok((st.p2 || {}).name) ? null : 'NO PLAYERS'; }
    // 1.12.18: the show
    case 'rundown': return st.x && st.x.rd && st.x.rd.empty ? 'NO RUNDOWN' : null;
    case 'cdplus': return st.x && st.x.full === 'countdown' ? null : 'COUNTDOWN OFF';
    case 'walkin': { const p = st['p' + (Number(s.side) === 2 ? 2 : 1)]; return p && p.name && !/^Player [12]$/.test(p.name) ? null : 'NO PLAYER'; }
    case 'storyline': return st.x && st.x.stories ? null : st.x && st.x.card === 'storyline' ? null : 'NO STORIES YET';
    case 'picks': return tw.chat === 'off' || !tw.chat ? 'TWITCH CHAT OFF' : null;
    case 'poll': return tw.chat === 'off' || !tw.chat ? 'TWITCH CHAT OFF' : st.x && (st.x.pollLast || st.x.poll) ? null : 'NO POLL YET';
    case 'twpred': return st.x && st.x.tw ? null : 'NOT ALLOWED';
    case 'music': case 'duck': return st.x && st.x.music ? null : 'NO MUSIC';
    case 'ext': { const L = (st.x && st.x.ext) || []; return L.some(e => e.id === s.ext) || (!s.ext && L.length) ? null : 'NO EXTENSION'; }
    default: return null;
  }
}

// ---------------------------------------------------------------- 1.12.17: the keys move
// Kept light on purpose — frames are only sent while something is moving, never faster than 20 a second for one key, and
// the whole deck has a budget: when a page turns, keys change in a quick wave (column by column); a lit key (on air) gets a
// slow shine every few seconds; a key pressed gives a little. Nothing animates on a key that's resting.
const ANIM = { step: 50, trans: 300, wave: 28, cycle: 3200, sweep: 900, restFps: 2, sweepFps: 10, budget: 70 };
let animT = null, sentTimes = [];
const nowMs = () => Date.now();
function push(c, ctx, svg) {
  const img = dataUrl(svg); c.shown = svg;
  if (img === c.image) return; c.image = img; sentTimes.push(nowMs());
  send('setImage', { context: ctx, payload: { image: img, target: 0 } });
}
function paint(ctx, svg, sig) {
  const c = contexts.get(ctx); if (!c) return;
  if (c.final === svg && c.image) return;
  const was = c.final, wasState = art.stateOf(was), st = art.stateOf(svg);
  const swap = !!was && (c.sig !== sig || (wasState !== st && (wasState === 'off' || st === 'off' || (wasState === 'idle') !== (st === 'idle'))));
  c.final = svg; c.sig = sig; c.live = st === 'lit' || st === 'hot' ? st : '';
  if (c.phase === undefined) c.phase = Math.random() * ANIM.cycle;
  if (swap && online) { const col = (c.coords && Number(c.coords.column)) || 0; c.trans = { from: c.shown || was, t0: nowMs() + col * ANIM.wave }; c.lastF = 0; }
  else if (!c.trans) push(c, ctx, c.live ? art.shine(svg, -1, c.live === 'hot') : svg);     // (mid-change: the change carries on to the new picture)
  if (c.trans || c.live) tickSoon();
}
function pressFx(ctx) { const c = contexts.get(ctx); if (!c || !c.final) return; c.press = nowMs() + 120; tickSoon(); }
function tickSoon() { if (!animT) animT = setTimeout(tick, ANIM.step); }
function frameOf(c, t) {
  let s = c.final;
  if (c.live) { const p = ((t + c.phase) % ANIM.cycle) / ANIM.cycle, sw = ANIM.sweep / ANIM.cycle; s = art.shine(s, p < sw ? p / sw : -1, c.live === 'hot'); }
  if (c.trans) { const e = (t - c.trans.t0) / ANIM.trans; if (e >= 1) c.trans = null; else if (e > 0) s = art.blend(c.trans.from, s, e); else s = c.trans.from; }
  if (c.press && t < c.press) s = art.pressed(s); else c.press = 0;
  return s;
}
function tick() {
  animT = null; const t = nowMs();
  sentTimes = sentTimes.filter(x => t - x < 1000); let busy = sentTimes.length > ANIM.budget, more = false;
  for (const [ctx, c] of contexts) {
    if (!c.final) continue;
    const moving = !!(c.trans || c.press);
    if (!moving && !c.live) continue;
    more = true;
    if (busy && !moving) continue;                                           // over budget: shines wait, changes go first
    if (busy && c.trans) { c.trans = null; push(c, ctx, c.final); continue; }   // (and a change jumps straight to the end)
    let every = ANIM.step;
    if (!moving && c.live) { const p = ((t + c.phase) % ANIM.cycle) / ANIM.cycle; every = p < ANIM.sweep / ANIM.cycle ? 1000 / ANIM.sweepFps : 1000 / ANIM.restFps; }
    if (t - (c.lastF || 0) < every - 5) continue;
    c.lastF = t; push(c, ctx, frameOf(c, t));
  }
  if (more) animT = setTimeout(tick, ANIM.step);
}
function pushToPI(ctx) {
  const c = contexts.get(ctx); if (!c) return;
  send('sendToPropertyInspector', { action: c.real || c.action, context: ctx, payload: {
    online, address: base, configured: globals.address || '',
    layouts: (status && status.layouts) || [], layout: status && status.layout, screens: (status && status.screens) || [], version: status && status.version,
  } });
}

// ---------------------------------------------------------------- key handling
const HOLD_MS = 450;
function keyDown(ctx) {
  const c = contexts.get(ctx); if (!c) return;
  pressFx(ctx);                                 // 1.12.17: the key gives a little under your finger
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
      if (s.holdClear) { c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'clear' }, ctx, true); }, 650); return; }   // tap 0–0, hold: the next set (names cleared)
      if (s.hold) { c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'reset' }, ctx, true); }, 700); return; }
      return act({ action: 'reset' });
    case 'page': {          // 1.12.8: the next page of keys, on this deck only
      const d = devices.get(c.device) || {}, sz = d.size || {}, P = pagesFor(sz.columns || (d.type === 2 ? 8 : 5), sz.rows || (d.type === 2 ? 4 : 3)); if (!P) return;
      pages.set(c.device, ((pages.get(c.device) || 0) + 1) % P.length);
      for (const x of contexts.values()) if (x.device === c.device) resolveSlot(x);
      renderAll(); return;
    }
    case 'swap': return act({ action: 'swap' });
    case 'undo': return act({ action: 'undoAny' }, ctx);   // one Undo: takes back a format result too, when that was the last thing
    case 'hideall': return act({ action: 'hideAll' }, ctx, true);
    case 'stinger': return act({ action: 'stinger' }, ctx);
    case 'clear': return act({ action: 'clear' }, ctx, true);
    case 'vs': {                         // a tap shows / hides it; with no fixed style, holding it switches FullVS ⇄ GlassVS
      if (s.style === 'full' || s.style === 'glass') return act({ action: 'vs', style: s.style, show: 'toggle' }, ctx);
      c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'vsstyle', style: 'toggle' }, ctx); }, 650); return;
    }
    case 'comm': return act({ action: 'comm', show: 'toggle' }, ctx);
    case 'vsstyle': return act({ action: 'vsstyle', style: 'toggle' }, ctx);
    case 'playervs': return act({ action: 'playervs', show: 'toggle' }, ctx);
    case 'flock': return act({ action: 'format', do: 'lock', toggle: true }, ctx, true);
    case 'funlock': return act({ action: 'format', do: 'unlock' }, ctx, true);
    case 'tempo': {          // the tap goes on the press (in time with the music); holding it stops the beat
      act({ action: 'tempo', do: 'tap' }, ctx, true);
      c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'tempo', do: 'off' }, ctx, true); }, 700); return;
    }
    case 'autopilot': return act({ action: 'autopilot', do: 'toggle' }, ctx, true);
    case 'replay': return act({ action: 'replay' }, ctx, true);
    case 'automation': { const L = (status && status.autos) || [], a = L.find(x => x.id === s.auto || x.name.toLowerCase() === String(s.auto || '').toLowerCase()) || (!s.auto && L[0]);   // 1.12.16
      if (!a) return send('showAlert', { context: ctx }); return act({ action: 'automation', id: a.id }, ctx, true); }
    case 'chapter': return act({ action: 'chapter', label: s.label || 'Highlight' }, ctx, true).then(() => { c.flash = 'MARKED'; render(ctx); setTimeout(() => { c.flash = ''; render(ctx); }, 1500); });
    case 'stats': return act({ action: 'stats', side: Number(s.side) === 2 ? 2 : 1, show: 'toggle' }, ctx, true);
    case 'sponsor': {          // tap: the next sponsor now · hold: the rotation on / off
      c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'sponsor', do: 'toggle' }, ctx, true); }, 650); return;
    }
    case 'bracket': return loading(ctx, act({ action: 'splash', kind: 'bracket', show: 'toggle' }, ctx));
    case 'top8': return loading(ctx, act({ action: 'splash', kind: 'top8', show: 'toggle' }, ctx));
    case 'standings': return loading(ctx, act({ action: 'splash', kind: 'standings', show: 'toggle' }, ctx));
    case 'postlink': return act({ action: 'postlink' }, ctx, true);
    case 'sggreport': return act({ action: 'sggreport' }, ctx, true);
    case 'loser': return act({ action: 'loser', side }, ctx);
    case 'player': return act({ action: 'pick', side }, ctx);
    case 'fnext': { const f = status && status.format; if (!f) return; if (f.pending) return act({ action: 'format', do: 'confirm' }, ctx); return; }
    case 'fundo': return act({ action: 'format', do: 'undo' }, ctx);
    case 'fxq': return act({ action: 'fxq', quality: s.fxq || 'cycle' }, ctx);
    case 'obsrefresh': c.flash = '…'; render(ctx); return act({ action: 'obsrefresh' }, ctx, true).then(r => { c.flash = r && r.ok ? 'DONE' : 'FAILED'; }, () => { c.flash = 'FAILED'; })
      .finally(() => { render(ctx); setTimeout(() => { c.flash = ''; render(ctx); }, 1600); });
    case 'sound': return act(s.smode === 'up' || s.smode === 'down' ? { action: 'sound', step: s.smode === 'up' ? 10 : -10 } : { action: 'sound', on: 'toggle' }, ctx);
    case 'vtopen': return act({ action: 'vt', do: 'open', open: 'toggle' }, ctx);
    case 'vtnext': return act({ action: 'vt', do: 'next' }, ctx);
    case 'vtjoin': return act({ action: 'vtjoin', show: 'toggle' }, ctx);
    case 'vtbracket': return act({ action: 'vtbracket', show: 'toggle' }, ctx);
    case 'fbar': return act({ action: 'fbar', show: 'toggle' }, ctx);
    case 'fswitch': return act({ action: 'fswitch', side }, ctx);
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
    case 'viewersidebar': return act({ action: 'viewerSidebar', show: 'toggle' }, ctx);
    case 'victory': return act({ action: 'victory', show: 'toggle' }, ctx);
    case 'bracketside': return loading(ctx, act({ action: 'bracketSide', side: s.bside === 'W' || s.bside === 'L' ? s.bside : 'toggle' }, ctx));
    case 'nextmatch': {
      c.busy = true; render(ctx);
      return act({ action: 'nextMatch' }, ctx, true).finally(() => { c.busy = false; render(ctx); });
    }
    // 1.12.18: the show — tap does it; the rundown (back a segment) and the storyline (the next one) also have a hold
    case 'rundown': case 'storyline': c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act(kind(c.action) === 'rundown' ? { action: 'rundown', do: 'prev' } : { action: 'storyline', do: 'next' }, ctx, true); }, 650); return;
    // 1.12.21: the set as it's told — the set timer: tap starts and stops it, hold takes it off the stream
    case 'settimer': c.held = false; c.holdTimer = setTimeout(() => { c.held = true; act({ action: 'timer', do: 'hide' }, ctx, true); }, 650); return;
    case 'moments': return act({ action: 'moments', do: 'toggle' }, ctx, true);
    case 'momentreplay': return flashing(ctx, act({ action: 'moments', do: 'replay' }, ctx, true), 'ON STREAM');
    case 'h2h': return act({ action: 'h2h' }, ctx);
    case 'statsstrip': return act({ action: 'strip', do: 'toggle' }, ctx, true);       // 1.12.23
    case 'greset': return act({ action: 'greset' }, ctx);
    case 'countdown': return act({ action: 'countdown' }, ctx);
    case 'cdplus': return flashing(ctx, act({ action: 'countdown', do: 'plus', mins: Math.max(1, Math.min(10, Number(s.mins) || 1)) }, ctx), `+${Math.max(1, Math.min(10, Number(s.mins) || 1))} MIN`);   // 1.12.19
    case 'schedule': return act({ action: 'schedule' }, ctx);
    case 'walkin': return act({ action: 'walkin', side }, ctx);
    case 'evstats': return act({ action: 'evstats' }, ctx);
    case 'season': return act({ action: 'season' }, ctx);
    case 'rehearsal': return act({ action: 'rehearsal' }, ctx, true);
    case 'replayslow': return act({ action: 'replaySlow', speed: Number(s.speed) || 50 }, ctx);
    case 'replayfreeze': return act({ action: 'replayFreeze' }, ctx);
    case 'drawclear': return act({ action: 'drawClear' }, ctx, true);
    case 'clip': return flashing(ctx, act({ action: 'clip' }, ctx, true), 'CLIPPING…');
    case 'results': return flashing(ctx, act({ action: 'results' }, ctx, true), 'IN THE APP');
    case 'picks': return act({ action: 'pred', do: 'predToggle' }, ctx);
    case 'poll': return act({ action: 'poll', do: 'pollToggle' }, ctx);
    case 'twpred': return act({ action: 'twpred', do: 'toggle' }, ctx);
    case 'music': return act({ action: 'music', do: 'toggle' }, ctx);
    case 'duck': return act({ action: 'music', do: 'duck' }, ctx);
    case 'ext': { const L = (status && status.x && status.x.ext) || [], e = L.find(x => x.id === s.ext) || (!s.ext && L[0]); if (!e) return send('showAlert', { context: ctx });
      const cue = s.cue || (e.screens[0] && e.screens[0].id) || (e.cues[0] && e.cues[0].id); return act({ action: 'ext', ext: e.id, cue, screen: e.screens.some(x => x.id === cue) ? cue : undefined }, ctx); }
  }
}
// 1.12.18: a word on the key for a moment after it's pressed
function flashing(ctx, p, word) {
  const c = contexts.get(ctx); if (!c) return p; c.flash = word; render(ctx);
  return Promise.resolve(p).finally(() => setTimeout(() => { c.flash = ''; render(ctx); }, 1600));
}
// 1.12.18: the show's keys — what each shows (x: the app's status for them, s: the key's settings, st: the whole status, c: the key)
const mmss = ms => { const t = Math.max(0, Math.round((Number(ms) || 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, q = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(q).padStart(2, '0'); };
// 1.12.21: the set timer as the scoreboard's header shows it (whole seconds gone, two digits of minutes), so the key and the stream read the same
const setClock = ms => { const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), z = n => String(n).padStart(2, '0'); return h ? `${h}:${z(m)}:${z(t % 60)}` : `${z(m)}:${z(t % 60)}`; };
const cut = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const SHOWKEYS = {
  rundown: x => { const r = x.rd || {}; return { g: 'rundown', name: r.name ? 'NEXT' : 'START', sub: r.name ? (r.left != null ? `${mmss(r.left)} · ${cut(r.name, 9)}` : cut(r.name, 16)) : cut(r.next || 'THE RUNDOWN', 16), on: !!r.name }; },
  countdown: x => ({ g: 'countdown', name: 'COUNTDOWN', on: x.full === 'countdown' }),
  cdplus: (x, s) => ({ g: 'cdPlus', name: `+${Math.max(1, Math.min(10, Number(s.mins) || 1))} MIN`, sub: 'COUNTDOWN' }),        // 1.12.19
  schedule: x => ({ g: 'schedule', name: 'COMING UP', on: x.full === 'schedule' }),
  walkin: (x, s, st) => { const side = Number(s.side) === 2 ? 2 : 1, p = st['p' + side] || {}; return { g: 'walkin', name: 'WALK-IN', sub: cut(p.name || `PLAYER ${side}`, 14), on: x.full === 'walkin' && Number(x.fullSide) === side }; },
  storyline: x => ({ g: 'storyline', name: 'STORYLINE', sub: x.stories ? `${x.stories} · HOLD: NEXT` : '', on: x.card === 'storyline' }),
  evstats: x => ({ g: 'evstats', name: 'NUMBERS', sub: 'THE EVENT', on: x.full === 'evstats' }),
  season: x => ({ g: 'season', name: 'SEASON', sub: 'THE TABLE', on: x.full === 'season' }),
  rehearsal: x => ({ g: 'rehearsal', name: x.reh ? 'STOP' : 'REHEARSE', sub: x.reh ? 'REHEARSING' : '', on: !!x.reh }),
  replayslow: (x, s) => ({ g: 'slowmo', name: 'SLOW-MO', sub: x.replay && x.replay.speed < 100 ? `${x.replay.speed}%` : `${Number(s.speed) || 50}%`, on: !!(x.replay && x.replay.speed < 100) }),
  replayfreeze: x => ({ g: 'freeze', name: x.replay && x.replay.frozen ? 'FROZEN' : 'FREEZE', on: !!(x.replay && x.replay.frozen) }),
  drawclear: () => ({ g: 'drawClear', name: 'CLEAR', sub: 'THE DRAWING' }),
  clip: (x, s, st, c) => ({ g: 'clip', name: 'CLIP THIS', sub: c.flash || 'VERTICAL' }),
  results: (x, s, st, c) => ({ g: 'results', name: 'RESULTS', sub: c.flash || 'GRAPHICS' }),
  picks: x => ({ g: 'picks', name: 'PICKS', sub: x.pred ? (x.pred.open ? `OPEN · ${x.pred.total}` : `${x.pred.pct1}% · ${100 - x.pred.pct1}%`) : 'OPEN THEM', on: !!(x.pred && x.pred.open) }),
  poll: x => ({ g: 'poll', name: 'POLL', sub: x.poll ? (x.poll.open ? 'OPEN · TAP: END' : 'CLOSED') : 'START AGAIN', on: !!(x.poll && x.poll.open) }),
  twpred: x => { const t = (x.tw && x.tw.status) || ''; return { g: 'twpred', name: 'PREDICTION', sub: t === 'ACTIVE' ? 'OPEN · TAP: LOCK' : t === 'LOCKED' ? 'LOCKED · TAP: PAY' : t ? t : 'START ONE', on: t === 'ACTIVE' || t === 'LOCKED' }; },
  music: x => ({ g: 'music', name: 'MUSIC', sub: x.music && x.music.on ? 'PLAYING' : 'OFF', on: !!(x.music && x.music.on) }),
  duck: x => ({ g: 'duck', name: 'DUCK', sub: x.music && x.music.duck ? 'TURNED DOWN' : '', on: !!(x.music && x.music.duck) }),
  // 1.12.21: the set as it's told
  moments: x => { const mo = x.mo || {}; return { g: 'moments', name: 'MOMENTS', sub: mo.on === false ? 'OFF' : mo.now ? cut(String(mo.last || 'ON STREAM').toUpperCase(), 16) : 'ON', on: mo.on !== false }; },
  momentreplay: (x, s, st, c) => { const mo = x.mo || {}; return { g: 'momentReplay', name: 'REPLAY', sub: c.flash || (mo.last ? cut(String(mo.last).toUpperCase(), 16) : 'THE MOMENT'), on: !!mo.now }; },
  h2h: x => ({ g: 'h2h', name: 'HEAD TO HEAD', sub: x.h2h ? 'ON STREAM' : 'THE LINE', on: !!x.h2h }),
  statsstrip: x => ({ g: 'statsStrip', name: 'STATS STRIP', sub: x.strip === false ? 'OFF' : 'ON FULLVS', on: x.strip !== false }),        // 1.12.23
  greset: x => ({ g: 'gresetSplash', name: 'BRACKET RESET', sub: x.full === 'greset' ? 'ON STREAM' : 'SPLASH', on: x.full === 'greset' }),
  settimer: x => { const t = x.timer || {}; return { g: 'setTimer', name: t.show ? setClock(t.ms) : 'SET TIMER', sub: !t.show ? 'TAP: START' : t.run ? 'TAP: STOP · HOLD: HIDE' : 'STOPPED · HOLD: HIDE', on: !!(t.show && t.run) }; },
  ext: (x, s) => { const L = x.ext || [], e = L.find(y => y.id === s.ext) || (!s.ext && L[0]); const cue = e && (s.cue || (e.screens[0] && e.screens[0].id) || (e.cues[0] && e.cues[0].id)), it = e && [...e.screens, ...e.cues].find(y => y.id === cue);
    return { g: 'ext', name: cut(it ? it.label.toUpperCase() : 'EXTENSION', 12), sub: e ? cut(e.name.toUpperCase(), 16) : '' }; },
};
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
  if (!c.held && kind(c.action) === 'vs') act({ action: 'vs', show: 'toggle' }, ctx);
  if (!c.held && kind(c.action) === 'sponsor') act({ action: 'sponsor', do: 'next' }, ctx, true);
  if (!c.held && kind(c.action) === 'rundown') act({ action: 'rundown', do: 'next' }, ctx, true);       // 1.12.18
  if (!c.held && kind(c.action) === 'storyline') act({ action: 'storyline' }, ctx);
  if (!c.held && kind(c.action) === 'settimer') act({ action: 'timer', do: 'toggle' }, ctx, true);        // 1.12.21
  if (!c.held && kind(c.action) === 'reset' && s.holdClear) act({ action: 'reset' }, ctx);
  else if (!c.held && kind(c.action) === 'reset' && s.hold) send('showAlert', { context: ctx });   // released too early
}

// ---------------------------------------------------------------- Stream Deck events
function onMessage(raw) {
  let m; try { m = JSON.parse(raw); } catch { return; }
  const { event, context: ctx, action, payload = {} } = m;
  switch (event) {
    case 'willAppear':
      { const c = { action, real: action, device: m.device, coords: payload.coordinates || null, settings: payload.settings || {}, controller: payload.controller || 'Keypad', image: null, title: null, state: payload.state, feedback: null };
        contexts.set(ctx, c); resolveSlot(c); }
      render(ctx); if (!status) poll();
      break;
    case 'willDisappear': { const c = contexts.get(ctx); if (c && c.holdTimer) clearTimeout(c.holdTimer); contexts.delete(ctx); break; }
    case 'didReceiveSettings': { const c = contexts.get(ctx); if (c && kind(c.real) !== 'slot') { c.settings = payload.settings || {}; c.image = null; render(ctx); } break; }
    case 'deviceDidConnect': if (m.device) { devices.set(m.device, { id: m.device, ...(m.deviceInfo || {}) }); for (const c of contexts.values()) if (c.device === m.device && resolveSlot(c)) {} renderAll(); reportDevices(); } break;
    case 'deviceDidDisconnect': if (m.device) { devices.delete(m.device); reportDevices(); } break;
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
module.exports = { onMessage, contexts, devices, _state: () => ({ base, online, status }) };
