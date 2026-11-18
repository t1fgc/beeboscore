/* BeeboScore (Beebo) — control panel */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ------------------------------------------------------------ constants
  const ROUNDS = ['Pools', 'Winners Round 1', 'Winners Round 2', 'Winners Quarters', 'Winners Semis', 'Winners Finals',
    'Losers Round 1', 'Losers Round 2', 'Losers Top 8', 'Losers Quarters', 'Losers Semis', 'Losers Finals',
    'Grand Finals', 'Grand Finals Reset', 'Top 8', 'Exhibition', 'Casuals'];
  const QUICK_ROUNDS = ['Pools', 'Winners Semis', 'Winners Finals', 'Losers Quarters', 'Losers Semis', 'Losers Finals', 'Grand Finals', 'Grand Finals Reset'];
  const FORMATS = [[1, 'Best of 1'], [3, 'Best of 3'], [5, 'Best of 5'], [7, 'Best of 7'], ['FT3', 'First to 3'], ['FT5', 'First to 5'], ['FT10', 'First to 10']];
  const COUNTRIES = 'us United States|ca Canada|mx Mexico|br Brazil|ar Argentina|cl Chile|co Colombia|pe Peru|do Dominican Republic|pr Puerto Rico|gb United Kingdom|ie Ireland|fr France|de Germany|es Spain|pt Portugal|it Italy|nl Netherlands|be Belgium|ch Switzerland|se Sweden|no Norway|dk Denmark|fi Finland|pl Poland|ua Ukraine|tr Türkiye|jp Japan|kr South Korea|cn China|tw Taiwan|hk Hong Kong|sg Singapore|ph Philippines|th Thailand|vn Vietnam|my Malaysia|id Indonesia|in India|pk Pakistan|sa Saudi Arabia|ae United Arab Emirates|eg Egypt|ma Morocco|za South Africa|ng Nigeria|au Australia|nz New Zealand'.split('|').map(x => [x.slice(0, 2), x.slice(3)]);
  const TEXT_EXT = /\.(html?|css|js|mjs|json|txt|svg|md|xml)$/i;
  const FALLBACK_COLORS = ['#3a4256', '#20263a'];

  // ------------------------------------------------------------ state
  let server = null, draft = null, dirty = false;
  let mode = store('mode') || 'manual';
  let overlays = [], active = '', players = [], liveTimer = null;
  let info = { local: true, games: [] }, settings = { autoSwitchLayout: true };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem('sb.' + k); localStorage.setItem('sb.' + k, v); } catch { return null; } }
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  /** toast(msg, err) — or toast(msg, { action: 'Undo', run: fn, ms }) for a toast with a button */
  function toast(msg, err) {
    const box = $('#toasts');
    const t = document.createElement('div');
    const act = err && typeof err === 'object' ? err : null;
    t.className = 'toast' + (err && !act ? ' err' : '') + (act ? ' act' : '');
    t.textContent = msg;
    if (act) { const run = act.run; act.run = () => { if (act.used) return; act.used = true; run(); }; const b = document.createElement('button'); b.className = 'toast-btn'; b.textContent = act.action; b.onclick = () => { t.remove(); act.run(); }; t.appendChild(b); }
    // 1.12.19: every message also goes to the bell in the header (panel-qol.js), with its Undo while that still works
    try { window.dispatchEvent(new CustomEvent('beebo:toast', { detail: { msg: String(msg), err: !!(err && !act), act, at: Date.now() } })); } catch (e) {}
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), act ? act.ms || 6000 : err ? 4500 : 2200);
  }

  // Tolerant API helper: never throws "Unexpected token" on a non-JSON reply.
  async function api(path, opts = {}) {
    const isObj = opts.body && typeof opts.body !== 'string';
    const res = await fetch(path, { method: opts.method || 'GET', headers: isObj ? { 'Content-Type': 'application/json' } : {}, body: isObj ? JSON.stringify(opts.body) : opts.body });
    const text = await res.text();
    let data = text;
    if (/json/.test(res.headers.get('content-type') || '')) { try { data = text ? JSON.parse(text) : null; } catch { data = text; } }
    if (res.status === 401 && !path.includes('/api/login')) { location.href = '/login'; throw new Error('Please sign in'); }
    if (!res.ok) throw new Error((data && data.error) || (typeof data === 'string' && data.length < 200 && data) || res.statusText || 'Request failed');
    return data;
  }
  const flagUrl = cc => /^[a-z]{2}$/i.test(cc || '') ? `/static/flags/${cc.toLowerCase()}.svg` : '';
  function setFlag(p, cc) {
    const img = $('#' + p + 'flag'), u = flagUrl(cc);
    if (u) { if (img.getAttribute('src') !== u) img.src = u; img.style.visibility = ''; }
    else { img.removeAttribute('src'); img.style.visibility = 'hidden'; }
  }
  $$('#p1flag, #p2flag').forEach(i => { i.onerror = () => { i.style.visibility = 'hidden'; }; });

  // ------------------------------------------------------------ tabs
  const tabScroll = (() => { try { return JSON.parse(store('tabScroll') || '{}'); } catch { return {}; } })();
  let curTab = '';
  window.addEventListener('scroll', () => { if (!curTab) return; tabScroll[curTab] = Math.round(window.scrollY); clearTimeout(tabScroll.t); tabScroll.t = setTimeout(() => { const { t, ...o } = tabScroll; store('tabScroll', JSON.stringify(o)); }, 400); }, { passive: true });
  function showTab(name) {
    if (!$(`main .tab[data-tab="${name}"]`)) name = 'match';
    $$('nav.rail button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('main .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    store('tab', name);
    try { window.dispatchEvent(new CustomEvent('beebo:tab', { detail: { name } })); } catch (e) {}
    if (name === 'bracket' && sgg.tournament && !sets.length) loadSets();
    const back = curTab === '' ? tabScroll[name] || 0 : 0;             // a reload lands where you were; switching tabs starts at the top
    curTab = name;
    window.scrollTo({ top: 0 }); if (back) setTimeout(() => window.scrollTo({ top: back }), 250);
  }
  $$('nav.rail button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  document.addEventListener('click', e => { const j = e.target.closest('[data-scroll-to]'); if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.scrollTo); if (el) { const t = el.classList.contains('collapsed') && el.querySelector('.cl-tg'); if (t) t.click(); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } });
  // UI theme (Settings › Look & feel), without reloading: Classic, Ember, and the five Designer themes (public/themes/)
  const DESIGNER_THEMES = ['hive', 'dojo', 'circuit', 'street', 'glacier'];
  const needCss = href => { if (!document.querySelector(`link[href="${href}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); } };
  function applyTheme(t) {
    const potato = document.documentElement.classList.contains('potato');
    t = potato ? 'classic' : t || 'classic';
    const sh = t === 'shattered', dz = DESIGNER_THEMES.includes(t), cl = document.documentElement.classList;
    cl.toggle('theme-shattered', sh);
    for (const x of DESIGNER_THEMES) cl.toggle('theme-' + x, x === t);
    cl.toggle('ui-x', dz);
    cl.toggle('theme-custom', t === 'custom'); if (window.BeeboTheme) window.BeeboTheme.apply();     // 1.12.18: your own theme (show-tab.js)
    cl.toggle('theme-contrast', t === 'contrast');                                                    // 1.12.19: high contrast (panel.css)     // 1.12.18: your own theme (show-tab.js)
    if (sh) needCss('/static/theme-shattered.css');
    if (dz) { needCss('/static/themes/base.css'); needCss(`/static/themes/${t}.css`); }
    $$('#themePick .theme-opt').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
    window.dispatchEvent(new CustomEvent('beebo:theme', { detail: t }));
    const f = document.querySelector('#dzFrame iframe'); if (f) try { f.contentWindow.postMessage({ type: 'beebo-designer-theme', theme: sh ? 'shattered' : 'classic' }, location.origin); } catch {}
  }
  $('#themePick').onclick = e => { const b = e.target.closest('.theme-opt'); if (!b) return; applyTheme(b.dataset.theme); saveSettings({ uiTheme: b.dataset.theme }, `${b.querySelector('b').textContent} theme on`); };
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); showTab(g.dataset.goto); if (g.dataset.scroll) setTimeout(() => { const el = document.getElementById(g.dataset.scroll); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); } });

  // ------------------------------------------------------------ form <-> draft
  function render() {
    if (!draft) return;
    for (const el of $$('[data-path]')) {
      if (el === document.activeElement && el.type !== 'checkbox') continue;
      const v = get(draft, el.dataset.path);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.value !== String(v ?? '')) el.value = v ?? '';
    }
    setFlag('p1', draft.p1.country); setFlag('p2', draft.p2.country);
    $$('#roundChips .chip').forEach(c => c.classList.toggle('on', c.dataset.v === draft.round));
    $$('#boChips .chip').forEach(c => c.classList.toggle('on', c.dataset.v === String(draft.bestOf)));
    renderGamePick();
    renderCustom();
    renderVS();
    window.dispatchEvent(new CustomEvent('beebo:draft'));       // the Format tab's score strip follows the Matches tab
  }
  function markDirty() {
    if (mode === 'live') { clearTimeout(liveTimer); liveTimer = setTimeout(push, 90); }
    else { dirty = true; updateBar(); }
    window.dispatchEvent(new CustomEvent('beebo:draft'));
  }
  function updateBar() {
    const btn = $('#updateBtn');
    btn.classList.toggle('dirty', dirty && mode === 'manual');
    btn.classList.toggle('live', mode === 'live');
    btn.textContent = mode === 'live' ? '● LIVE' : 'UPDATE';
    $('#pending').hidden = !(dirty && mode === 'manual');
    $('#revertBtn').hidden = !(dirty && mode === 'manual');
    $$('.head .seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  }
  async function push() {
    clearTimeout(liveTimer);
    if (!draft) return;
    const payload = clone(draft);
    delete payload.vs;                    // FullVS is switched on its own
    delete payload.splash;                // …and so are the bracket / Top 8 splashes
    payload.p1.score = Math.max(0, Number(payload.p1.score) || 0);
    payload.p2.score = Math.max(0, Number(payload.p2.score) || 0);
    try {
      server = await api('/api/state', { method: 'POST', body: payload });
      dirty = false; updateBar(); renderWin(); stateEvent();
      if (mode === 'manual') toast('Overlay updated');
    } catch (e) { toast('Update failed: ' + e.message, true); }
  }

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-path]');
    if (!el || !draft) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = v === '' ? 0 : Number(v);
    if (/\.country$/.test(el.dataset.path)) { v = String(v).toLowerCase(); setFlag(el.dataset.path.split('.')[0], v); }
    set(draft, el.dataset.path, v);
    if (el.dataset.path === 'round') $$('#roundChips .chip').forEach(c => c.classList.toggle('on', c.dataset.v === v));
    if (el.dataset.path === 'game') renderGamePick();
    markDirty();
  });

  // ------------------------------------------------------------ match actions
  function bump(p, d) { draft[p].score = Math.max(0, (Number(draft[p].score) || 0) + d); render(); markDirty(); }
  $$('[data-score]').forEach(b => b.addEventListener('click', () => bump(b.dataset.score, Number(b.dataset.d))));
  function swapPlayers() { [draft.p1, draft.p2] = [draft.p2, draft.p1]; render(); markDirty(); }
  $('#swapBtn').onclick = swapPlayers;
  $('#resetBtn').onclick = () => { draft.p1.score = 0; draft.p2.score = 0; render(); markDirty(); };
  $('#clearBtn').onclick = () => {
    for (const k of ['p1', 'p2']) draft[k] = { name: '', team: '', pronouns: '', country: '', character: '', score: 0, loser: false, sggId: '', avatar: '', wins: '', losses: '' };
    render(); markDirty(); $('[data-path="p1.name"]').focus();
  };
  // everything else that follows the scoreboard (the Matches tab's event strip, the viewer tournament…) hears it here
  function stateEvent() { window.dispatchEvent(new CustomEvent('beebo:state', { detail: server })); }
  async function undo() {
    try {
      const r = await api('/api/state/undo', { method: 'POST' });
      server = r.state; draft = clone(server); dirty = false; render(); updateBar(); stateEvent();
      toast(r.left ? 'Undone' : 'Undone — that was the oldest change');
    } catch (e) { toast(e.message, true); }
  }
  $('#undoBtn').onclick = undo;
  $('#miniBtn').onclick = () => window.open('/mini', 'beeboMini', 'width=460,height=330');
  $('#swapCasters').onclick = () => { [draft.c1, draft.c2] = [draft.c2, draft.c1]; render(); markDirty(); };
  $('#updateBtn').onclick = () => { if (mode === 'manual') push(); };
  $('#revertBtn').onclick = () => { draft = clone(server); dirty = false; render(); updateBar(); };
  $$('.head .seg button').forEach(b => {
    b.onclick = () => {
      mode = b.dataset.mode; store('mode', mode);
      if (mode === 'live' && dirty) push();
      updateBar();
      toast(mode === 'live' ? 'Live mode: changes go out instantly' : 'Manual mode: press Update to send changes');
    };
  });

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); const tabs = ['match', 'format', 'bracket', 'stream', 'layouts', 'settings']; if (tabs[e.key - 1]) showTab(tabs[e.key - 1]); return; }
    if (capturing || !draft) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== 'checkbox';
    const action = BeeboKeys.match(e, keys(), typing);
    if (!action) return;
    e.preventDefault();
    ({
      p1Up: () => bump('p1', 1), p1Down: () => bump('p1', -1), p2Up: () => bump('p2', 1), p2Down: () => bump('p2', -1),
      update: () => { if (mode === 'manual') push(); }, swap: swapPlayers, undo, resetScores: () => $('#resetBtn').click(), vsToggle: () => toggleVS(),
      victoryToggle: () => toggleVictory(),
      bracketToggle: () => toggleSplash('bracket'), top8Toggle: () => toggleSplash('top8'), bracketRefresh: () => refreshBracket(), bracketSide: () => bracketSide('toggle'),
      soundToggle: () => viewerKey({ action: 'sound', on: 'toggle' }).then(r => { if (r && r.status) toast(r.status.sound.on ? '🔊 Stream sound on' : '🔇 Stream sound off'); }),
      ...BeeboKeys.showActions(b => viewerKey(b), toast),           // the set's own extras (set timer, head-to-head, moments, stats strip)
    }[action] || (() => {}))();
  });

  // ------------------------------------------------------------ potato mode
  const POTATO_ON = ['The app restarts in a lightweight mode for low-end PCs.', [
    'Classic Windows XP look; every animation and visual effect is switched off.',
    'Layouts are drawn as a still picture (PNG) each time something changes. No animations or effects on stream.',
    'Lightest option for OBS: add an <b>Image</b> source pointing at <code>output/overlay.png</code> in your BeeboScore Lite Data folder (or keep the usual Browser source).',
    'Graphics acceleration is turned off, and most extras run at the bare minimum.',
    'You can switch back here at any time (another restart).']];
  const POTATO_OFF = ['The app restarts with the full experience again.', [
    'Animated layouts, effects and the FullVS animations come back.',
    'The normal look and the live overlay preview return.']];
  let wantPotato = false;
  $('#setPotato').onchange = e => {
    wantPotato = e.target.checked;
    e.target.checked = !!settings.potatoMode;            // only changes once confirmed
    const [lead, items] = wantPotato ? POTATO_ON : POTATO_OFF;
    $('#potatoTitle').textContent = wantPotato ? '🥔 Turn on Potato mode?' : 'Turn off Potato mode?';
    $('#potatoLead').innerHTML = `<b>BeeboScore needs to restart.</b> ${lead}`;
    $('#potatoList').innerHTML = items.map(t => `<li>${t}</li>`).join('');
    $('#potatoGo').textContent = wantPotato ? 'Restart in Potato mode' : 'Restart normally';
    $('#potatoModal').hidden = false; $('#potatoGo').focus();
  };
  $('#potatoCancel').onclick = () => { $('#potatoModal').hidden = true; };
  $('#potatoModal').addEventListener('keydown', e => { if (e.key === 'Escape') $('#potatoModal').hidden = true; });
  $('#potatoGo').onclick = async () => {
    $('#potatoGo').disabled = true;
    try {
      await api('/api/settings', { method: 'POST', body: { potatoMode: wantPotato } });
      const r = await api('/api/app/restart', { method: 'POST', body: {} });
      $('#potatoLead').innerHTML = '<b>Restarting…</b>';
      $('#potatoList').innerHTML = '';
      if (!r.restarting) setTimeout(() => location.reload(), 400);   // browser / server mode: just reload
    } catch (e) { toast(e.message, true); $('#potatoGo').disabled = false; }
  };
  // In potato mode the live preview is the same still picture OBS gets.
  let potatoImg = null;
  function potatoPreview(ver) {
    const on = !!settings.potatoMode && document.documentElement.classList.contains('potato');
    const frame = $('#preview');
    if (!on) { if (potatoImg) { potatoImg.remove(); potatoImg = null; frame.hidden = false; } return; }
    if (!potatoImg) {
      potatoImg = document.createElement('img'); potatoImg.className = 'potato-preview'; potatoImg.alt = 'Overlay picture';
      potatoImg.onerror = () => { potatoImg.style.visibility = 'hidden'; };
      potatoImg.onload = () => { potatoImg.style.visibility = ''; };
      $('#previewWrap').appendChild(potatoImg);
      frame.hidden = true; frame.removeAttribute('src');
      api('/api/potato').then(d => potatoPreview(d.ver)).catch(() => {});
      return;
    }
    if (ver !== undefined) potatoImg.src = '/overlay.png?v=' + ver;
  }

  // Stream Deck (Settings): public/streamdeck-panel.js

  // ------------------------------------------------------------ FullVS — FullVS and GlassVS (1.12.6)
  // The button plays the VS style chosen beside it: FullVS (the full VS splash) or GlassVS (the glass lock-in VS), in any
  // format or match. The Stream Deck has a key for each, and the VS key follows the choice (hold it to switch).
  const vsStyle = () => (settings && settings.vsStyle === 'glass' ? 'glass' : 'full');
  const teamLive = () => !!(server && server.format && server.format.status === 'live' && (server.format.kind === 'teams' || (server.format.kind === 'elim' && server.format.preset !== 'koth')));
  async function toggleVS(show, style = vsStyle()) {
    try {
      const r = await api('/api/remote/action', { method: 'POST', body: { action: 'vs', style, show: show === undefined ? 'toggle' : show } });
      const st = r.status || {}; server = { ...server, vs: { show: !!st.vs }, playerVs: { show: !!st.playerVs } }; renderVS();
      const nm = style === 'glass' ? 'GlassVS' : 'FullVS', on = style === 'glass' ? !!st.playerVs : !!st.vs;
      toast(on ? `${nm} on stream` : `${nm} hidden`);
    } catch (e) { toast(e.message, true); }
  }
  function renderVS() {
    const g = vsStyle() === 'glass', on = g ? !!(server && server.playerVs && server.playerVs.show) : !!(server && server.vs && server.vs.show);
    $('#vsToggle').classList.toggle('on', on);
    $('#vsToggle').textContent = `${on ? 'Hide' : 'Show'} ${g ? 'GlassVS' : 'FullVS'}`;
    $('#vsToggle').title = g ? 'GlassVS: the glass lock-in VS — the two players face to face, pictures framed, names under them. Stays up until you hide it.' : 'FullVS: the full VS splash.';
    $$('#vsStyle [data-vs]').forEach(b => b.classList.toggle('on', b.dataset.vs === vsStyle()));
    { const own = !!(settings && settings.overlayColours === 'layout'); $('#vsCols').classList.toggle('layout-own', own); $('#vsColsOwn').hidden = !own; }      // 1.12.24
    for (const n of [1, 2]) {      // 1.12.7: the side colours
      const v = String((settings && settings['vsColor' + n]) || ''), lab = $(`#vsCols .vsc[data-n="${n}"]`), inp = $('#vsCol' + n); if (!lab || !inp) continue;
      lab.classList.toggle('unset', !v); if (v && document.activeElement !== inp) inp.value = v; lab.style.setProperty('--c', v || 'transparent');
      lab.querySelector('span').textContent = v ? `Player ${n} · ${v.toUpperCase()}` : `Player ${n} · layout’s`;
    }
    if (!draft) return;
    for (const n of [1, 2]) {
      const p = draft['p' + n] || {}, img = $('#vsAva' + n), src = String(p.avatar || '');
      $('#vsIni' + n).textContent = String(p.name || n).trim().charAt(0).toUpperCase();
      if (img.dataset.src !== src) { img.dataset.src = src; img.hidden = !src; if (src) { img.onerror = () => { img.hidden = true; }; img.src = src; } else img.removeAttribute('src'); }
    }
  }
  $('#vsToggle').onclick = () => toggleVS();
  { const vcT = {};
    const setCol = (n, v, msg) => { settings['vsColor' + n] = v; renderVS(); clearTimeout(vcT[n]); vcT[n] = setTimeout(() => saveSettings({ ['vsColor' + n]: v }, msg), 160); };
    for (const n of [1, 2]) { const inp = $('#vsCol' + n); if (!inp) continue;
      inp.oninput = () => setCol(n, inp.value.toLowerCase(), '');
      inp.onchange = () => setCol(n, inp.value.toLowerCase(), `Player ${n}’s side of the VS screens: ${inp.value.toUpperCase()}`); }
    $$('#vsCols [data-x]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); setCol(+b.dataset.x, '', `Player ${b.dataset.x}’s side: back to the layout’s colour`); }); }
  $$('#vsStyle [data-vs]').forEach(b => b.onclick = () => { if (vsStyle() === b.dataset.vs) return; settings.vsStyle = b.dataset.vs; renderVS(); saveSettings({ vsStyle: b.dataset.vs }, `The VS button plays ${b.dataset.vs === 'glass' ? 'GlassVS' : 'FullVS'}`); });
  // designer screens of the active layout (starting soon, BRB, Top 8, lower thirds…)
  let screens = { screens: [], current: '' };
  const SCR_EMOJI = { starting: '⏳', brb: '☕', ending: '👋', top8: '🏆', card: '🪪', twitch: '💬', lower: '📛', ticker: '📰', camera: '🎥', custom: '🧩' };
  async function loadScreens() { try { screens = await api('/api/screens'); } catch (e) { screens = { screens: [], current: '' }; } renderScreens(); }
  function renderScreens() {
    const list = screens.screens || [], box = $('#scrBtns'); $('#screensCard').hidden = !list.length; if (!list.length) return;
    const cur = (server && server.screen) || '';
    const sig = JSON.stringify([list, cur]); if (box.dataset.sig === sig) return; box.dataset.sig = sig;
    box.innerHTML = list.map(x => `<button class="btn${x.id === cur ? ' on' : ''}" data-id="${esc(x.id)}" title="${x.full ? 'Covers the whole screen' : 'Shows over the game, with the scoreboard'}">${SCR_EMOJI[x.kind] || '🧩'} ${esc(x.name)}${x.id === cur ? ' <small>ON</small>' : ''}</button>`).join('');
  }
  $('#scrBtns').onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    try { const r = await api('/api/remote/action', { method: 'POST', body: { action: 'screen', name: b.dataset.id, show: 'toggle' } }); if (r && r.state) server = r.state; } catch (e) { toast(e.message, true); }
  };
  loadScreens();
  $('#vsRefresh').onclick = async () => {
    try { await api('/api/vs/refresh', { method: 'POST', body: {} }); toast(sgg.tournament ? 'Fetching pictures and records from start.gg…' : 'Connect a start.gg tournament in the Bracket tab first'); }
    catch (e) { toast(e.message, true); }
  };
  // a newly typed name is a different player: drop the old start.gg link, picture and record…
  $$('[data-player]').forEach(input => {
    input.addEventListener('input', () => {
      const k = input.dataset.player;
      if (draft && draft[k] && (draft[k].sggId || draft[k].wins || draft[k].losses)) { Object.assign(draft[k], { sggId: '', avatar: '', wins: '', losses: '' }); renderVS(); }
    });
    // …and a name typed out in full that matches a start.gg entrant links up on its own
    input.addEventListener('change', () => {
      const k = input.dataset.player, nm = input.value.trim().toLowerCase();
      const hit = draft && draft[k] && !draft[k].sggId && players.find(p => p.sggId && p.name.toLowerCase() === nm);
      if (hit) { Object.assign(draft[k], { sggId: hit.sggId, avatar: hit.avatar || '', wins: '', losses: '' }); renderVS(); markDirty(); }
    });
  });

  // ------------------------------------------------------------ customizable shortcuts
  let capturing = null;
  const keys = () => BeeboKeys.merged(settings.shortcuts);
  function renderKeys() {
    const k = keys();
    $('#keyList').innerHTML = Object.keys(BeeboKeys.DEFAULTS).map(a => `<div class="keyrow"><span>${esc(BeeboKeys.LABELS[a])}</span>
      <button class="keybtn${capturing === a ? ' listening' : ''}" data-act="${a}" ${info.local === false ? 'disabled title="Only on the PC running BeeboScore"' : ''}>${capturing === a ? 'Press keys…' : BeeboKeys.html(k[a])}</button></div>`).join('');
  }
  // stop listening if the user clicks anywhere else or changes tab
  document.addEventListener('mousedown', e => { if (capturing && !e.target.closest('.keybtn')) { capturing = null; renderKeys(); } }, true);
  $('#keyList').onclick = e => {
    const b = e.target.closest('.keybtn'); if (!b || b.disabled) return;
    capturing = capturing === b.dataset.act ? null : b.dataset.act; renderKeys();
  };
  document.addEventListener('keydown', e => {
    if (!capturing) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape') { capturing = null; return renderKeys(); }
    const combo = (e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey ? '' : BeeboKeys.fromEvent(e);
    if (combo === null || (combo === '' && e.key !== 'Backspace' && e.key !== 'Delete')) return;   // lone modifier: keep listening
    if (/^Alt\+[1-7]$/.test(combo) || ['Ctrl+M', 'Ctrl+S'].includes(combo)) { toast(`${combo} is reserved`); return; }
    const k = keys(), act = capturing; capturing = null;
    const clash = combo && Object.keys(k).find(a => a !== act && k[a] === combo);
    if (clash) k[clash] = '';
    k[act] = combo;
    settings.shortcuts = k; renderKeys();
    saveSettings({ shortcuts: k }, combo ? `${BeeboKeys.LABELS[act]}: ${combo}` + (clash ? ` (removed from “${BeeboKeys.LABELS[clash]}”)` : '') : `${BeeboKeys.LABELS[act]}: cleared`);
  }, true);
  $('#keyReset').onclick = () => { capturing = null; settings.shortcuts = {}; renderKeys(); saveSettings({ shortcuts: {} }, 'Shortcuts reset to defaults'); };

  $('#roundChips').innerHTML = QUICK_ROUNDS.map(r => `<button class="chip" data-v="${esc(r)}">${esc(r)}</button>`).join('');
  $('#roundChips').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; draft.round = c.dataset.v; render(); markDirty(); };
  $('#boChips').innerHTML = FORMATS.map(([v, t]) => `<button class="chip" data-v="${v}">${t}</button>`).join('');
  $('#boChips').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; draft.bestOf = /^\d+$/.test(c.dataset.v) ? Number(c.dataset.v) : c.dataset.v; render(); markDirty(); };
  $('#roundList').innerHTML = ROUNDS.map(g => `<option value="${esc(g)}">`).join('');
  $('#countryList').innerHTML = COUNTRIES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');

  // custom fields
  function renderCustom() {
    const wrap = $('#customRows');
    const entries = Object.entries(draft.custom || {});
    if (wrap.contains(document.activeElement) && wrap.children.length === entries.length) return;
    wrap.innerHTML = entries.map(([k, v], i) => `
      <div class="custom-row" data-i="${i}">
        <input type="text" class="ck" value="${esc(k)}" placeholder="fieldName" autocomplete="off">
        <input type="text" class="cv" value="${esc(v)}" placeholder="value" autocomplete="off">
        <button class="btn sm ghost danger" title="Remove">✕</button>
      </div>`).join('');
    if (entries.length) $('#customCard').open = true;
  }
  function readCustom() {
    const obj = {};
    $$('#customRows .custom-row').forEach(r => { const k = $('.ck', r).value.trim().replace(/[^\w-]/g, '_'); if (k) obj[k] = $('.cv', r).value; });
    draft.custom = obj;
  }
  $('#customRows').addEventListener('input', e => { e.stopPropagation(); readCustom(); markDirty(); });
  $('#customRows').addEventListener('click', e => { if (!e.target.closest('button')) return; e.target.closest('.custom-row').remove(); readCustom(); markDirty(); renderCustom(); });
  $('#addCustom').onclick = () => { let n = 1; draft.custom = draft.custom || {}; while (('field' + n) in draft.custom) n++; draft.custom['field' + n] = ''; renderCustom(); $('#customRows .custom-row:last-child .ck').select(); };

  // ------------------------------------------------------------ game + layout pickers
  const swatch = o => { const c = (o && o.colors && o.colors.length ? o.colors : FALLBACK_COLORS); return `linear-gradient(135deg, ${c.join(', ')})`; };
  function gameList() {
    const s = new Set([...(info.games || [])]);
    overlays.forEach(o => { if (o.game && o.game !== 'Any game') s.add(o.game); });
    if (draft && draft.game) s.add(draft.game);
    return [...s];
  }
  function renderGamePick() {
    const sel = $('#gamePick');
    if (document.activeElement === sel) return;
    const games = gameList();
    const cur = draft ? draft.game : '';
    const withLayout = new Set(overlays.map(o => o.game));
    // only games that have a layout; with one game there's nothing to pick, so the menu hides
    const real = games.filter(g => withLayout.has(g));
    const pk = sel.closest('.picker'); if (pk) pk.hidden = real.length < 2;
    const html = real.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    if (sel.dataset.h !== html) { sel.innerHTML = html; sel.dataset.h = html; $('#gameList').innerHTML = games.map(g => `<option value="${esc(g)}">`).join(''); }
    sel.value = cur;
  }
  function renderLayoutPick() {
    const sel = $('#layoutPick');
    if (document.activeElement === sel) return;
    // one entry per look (Shattered, Oni…): its game-format versions are picked by themselves from the Format tab
    const groups = {}, fams = {};
    for (const o of overlays) { const k = o.game + '\u0000' + o.family; (fams[k] = fams[k] || []).push(o); }
    for (const [k, list] of Object.entries(fams)) { const g = k.split('\u0000')[0]; (groups[g] = groups[g] || []).push(list); }
    const cur = draft && draft.game, a = overlays.find(o => o.name === active);
    const order = Object.keys(groups).sort((x, y) => (y === cur) - (x === cur) || (x === 'Any game') - (y === 'Any game') || x.localeCompare(y));
    const opt = list => { const base = list.find(o => !o.format) || list[0], live = list.find(o => o.name === active);
      return `<option value="${esc(list.length > 1 ? 'family:' + base.name : base.name)}">${esc(list.length > 1 ? base.family : base.title)}${live && live.format ? ' · ' + esc(live.title.replace(/^.*?—\s*/, '')) : ''}</option>`; };
    sel.innerHTML = order.map(g => `<optgroup label="${esc(g === cur ? '★ ' + g : g)}">${groups[g].map(opt).join('')}</optgroup>`).join('');
    const fam = a && overlays.filter(o => o.game === a.game && o.family === a.family);
    sel.value = fam && fam.length > 1 ? 'family:' + (fam.find(o => !o.format) || fam[0]).name : active;
  }
  /** a look picked in the Matches tab → its version for the format that's set up */
  function familyMember(baseName) {
    const b = overlays.find(o => o.name === baseName); if (!b) return baseName;
    const preset = (server && server.format && server.format.preset) || '';
    const fam = overlays.filter(o => o.game === b.game && o.family === b.family);
    return (fam.find(o => o.format === preset) || fam.find(o => !o.format) || b).name;
  }
  async function setActive(name, quiet) {
    if (!name || name === active) return;
    try {
      await api('/api/overlays/active', { method: 'POST', body: { name } });
      active = name;
      const o = overlays.find(x => x.name === name);
      if (!quiet) toast(`Now live in OBS: ${o ? o.title : name}`);
      refreshActive();
    } catch (e) { toast(e.message, true); renderLayoutPick(); }
  }
  $('#layoutPick').onchange = e => { const v = e.target.value; setActive(v.startsWith('family:') ? familyMember(v.slice(7)) : v); e.target.blur(); };
  $('#gamePick').onchange = e => {
    const g = e.target.value;
    e.target.blur();
    draft.game = g;
    render(); markDirty();
    if (settings.autoSwitchLayout && info.local !== false) {
      const cur = overlays.find(o => o.name === active);
      if (!cur || cur.game !== g) {
        const pick = overlays.find(o => o.game === g);
        if (pick) setActive(pick.name);
        else toast(`No layout for ${g} yet — keeping the current one`);
      }
    }
    renderLayoutPick();
  };

  // ------------------------------------------------------------ preview
  function scaleFrames() {
    for (const [w, f] of [['#previewWrap', '#preview']]) {
      const wrap = $(w), fr = $(f);
      if (wrap && fr && wrap.clientWidth) fr.style.transform = `scale(${wrap.clientWidth / 1920})`;
    }
  }
  new ResizeObserver(scaleFrames).observe($('#previewWrap'));
  const BGS = [['checker', 'Checker'], ['game', 'Scene'], ['green', 'Green']];
  function setBg(bg) {
    store('bg', bg);
    for (const w of ['#previewWrap']) $(w).className = 'preview-wrap ' + bg;
    $$('#bgChips .chip').forEach(c => c.classList.toggle('on', c.dataset.v === bg));
  }
  $('#bgChips').innerHTML = BGS.map(([v, t]) => `<button class="chip" data-v="${v}">${t}</button>`).join('');
  $('#bgChips').onclick = e => { const c = e.target.closest('.chip'); if (c) setBg(c.dataset.v); };
  setBg(store('bg') || 'checker');
  // pop the preview out into its own window, or fold it away
  $('#pvPop').onclick = () => { const w = window.open('/preview', 'beebo-preview', 'width=960,height=580'); if (w) w.focus(); };
  function pvCollapsed(on) {
    document.body.classList.toggle('pv-collapsed', on); store('pvHidden', on ? '1' : '0');
    $('#pvHide span').textContent = on ? 'Show' : 'Hide'; $('#pvHide').title = on ? 'Show the preview' : 'Hide the preview';
    const fr = $('#preview');
    if (on) { if (fr.getAttribute('src') && fr.getAttribute('src') !== 'about:blank') { fr.dataset.src = fr.getAttribute('src'); fr.src = 'about:blank'; } }   // a hidden preview costs nothing
    else if (fr.dataset.src && !document.hidden) { fr.src = fr.dataset.src; delete fr.dataset.src; }
  }
  $('#pvHide').onclick = () => pvCollapsed(!document.body.classList.contains('pv-collapsed'));
  pvCollapsed(store('pvHidden') === '1');

  // Pausing animations in the preview keeps the control panel smooth on slower PCs.
  function applyPreviewAnim(frame) {
    try {
      const doc = frame.contentDocument; if (!doc || !doc.head) return;
      let st = doc.getElementById('__sbpause');
      const on = store('previewAnim') !== '0';
      if (!on && !st) { st = doc.createElement('style'); st.id = '__sbpause'; st.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}'; doc.head.appendChild(st); }
      if (on && st) st.remove();
      if (frame.contentWindow && frame.contentWindow.__sbSyncPause) frame.contentWindow.__sbSyncPause();
    } catch {}
  }
  $('#preview').addEventListener('load', () => applyPreviewAnim($('#preview')));
  function refreshActive() {
    const src = `/overlay/${encodeURIComponent(active)}?preview`;
    const fr = $('#preview');
    if (document.documentElement.classList.contains('potato')) { /* still-picture preview instead */ }
    else if (document.hidden || document.body.classList.contains('pv-collapsed')) fr.dataset.src = src;
    else if (fr.getAttribute('src') !== src) fr.src = src;
    const o = overlays.find(x => x.name === active);
    // (the built-in sound packs are gone: nothing for the layout to pick here any more)
    $('#nowName').textContent = o ? o.title : active;
    $('#nowGame').textContent = o ? o.game : '';
    $('#nowSwatch').style.background = swatch(o);
    renderLayoutPick();
    try { window.dispatchEvent(new CustomEvent('beebo:overlays')); } catch (e) {}      // 1.5.1: the Layouts tab follows
  }
  document.addEventListener('visibilitychange', () => {
    // stop the preview completely while the window is hidden or minimised
    const fr = $('#preview');
    if (document.documentElement.classList.contains('potato')) return;
    if (document.hidden) { fr.dataset.src = fr.getAttribute('src') || ''; fr.src = 'about:blank'; }
    else if (fr.dataset.src && !document.body.classList.contains('pv-collapsed')) { fr.src = fr.dataset.src; delete fr.dataset.src; }
  });

  // ------------------------------------------------------------ layouts (Lite: the header picker only — no Layouts tab, no Designer)
  async function loadOverlays() { overlays = await api('/api/overlays'); const a = overlays.find(o => o.active); if (a) active = a.name; refreshActive(); renderGamePick(); }
  // ------------------------------------------------------------ stream tab
  function fallbackCopy(text, done) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); }
  function copy(text, msg) {
    const done = () => toast(msg || 'Copied');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  // short links (/s/<code>, lib/shortlinks.js): only for pages anyone may see; anything else keeps its full address
  async function shortLink(pathOrUrl, base = location.origin) {
    try { const r = await api('/api/short', { method: 'POST', body: { path: pathOrUrl } }); return base + r.path; } catch (e) { return /^https?:/.test(pathOrUrl) ? pathOrUrl : base + pathOrUrl; }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy($('#' + b.dataset.copy).value, b.dataset.copy === 'obsUrl' ? 'OBS URL copied — paste it into a Browser Source' : 'Link copied'); });
  $('#obsUrl').value = location.origin + '/overlay';
  $('#openOutput').onclick = e => { e.preventDefault(); api('/api/open-output', { method: 'POST' }).catch(err => toast(err.message, true)); };
  $('#logoutBtn').onclick = async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); location.href = '/login'; };

  // ------------------------------------------------------------ autocomplete
  // the Character boxes suggest the Tekken 8 roster, plus any character your players have been on (1.12.13: the roster too)
  const T8 = ['Alisa', 'Anna', 'Armor King', 'Asuka', 'Azucena', 'Bryan', 'Claudio', 'Clive', 'Devil Jin', 'Dragunov', 'Eddy', 'Fahkumram', 'Feng', 'Heihachi', 'Hwoarang', 'Jack-8', 'Jin', 'Jun', 'Kazuya', 'King', 'Kuma', 'Lars', 'Law', 'Lee', 'Leo', 'Leroy', 'Lidia', 'Lili', 'Nina', 'Panda', 'Paul', 'Raven', 'Reina', 'Shaheen', 'Steve', 'Victor', 'Xiaoyu', 'Yoshimitsu', 'Zafina'];
  function refreshChars() { const chars = [...new Set([...T8, ...players.map(p => p.character).filter(Boolean)])].sort((a, b) => a.localeCompare(b)); $('#charList').innerHTML = chars.map(c => `<option value="${esc(c)}">`).join(''); }
  async function loadPlayers() { try { players = await api('/api/players'); refreshChars(); } catch {} }
  function rank(q) {
    const nq = norm(q);
    if (!nq) return [];
    const out = [];
    for (const p of players) {
      const n = norm(p.name), t = norm(p.team);
      let score = -1;
      if (n === nq) score = 0;
      else if (n.startsWith(nq)) score = 1;
      else if (String(p.name).toLowerCase().split(/[\s._-]+/).some(w => norm(w).startsWith(nq))) score = 2;
      else if (n.includes(nq)) score = 3;
      else if (t && (t.startsWith(nq) || norm(p.team + p.name).startsWith(nq))) score = 4;
      else if (nq.length >= 3) { let k = 0; for (const ch of n) if (ch === nq[k]) k++; if (k === nq.length) score = 5; }
      if (score >= 0) out.push([score, p.source === 'history' ? 1 : 0, p]);
    }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].name.length - b[2].name.length).map(x => x[2]).slice(0, 8);
  }
  function highlight(name, q) {
    const i = String(name).toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0 || !q) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
  }
  function fillPlayer(k, known) {
    draft[k].name = known.name;
    for (const f of ['team', 'pronouns', 'country', 'character']) draft[k][f] = known[f] || (f === 'character' ? draft[k][f] : '');
    Object.assign(draft[k], { sggId: known.sggId || '', avatar: known.avatar || '', wins: '', losses: '' });
    render(); markDirty();
  }
  function setupAutocomplete(input, onPick) {
    const k = input.dataset.player;
    const box = document.createElement('div');
    box.className = 'ac';
    document.body.appendChild(box);
    let items = [], idx = 0;
    const place = () => {
      const r = input.getBoundingClientRect(), w = Math.max(r.width, 300);
      box.style.top = (r.bottom + scrollY + 4) + 'px';
      box.style.width = w + 'px';
      box.style.left = Math.max(8, Math.min(r.left + scrollX, innerWidth - w - 8)) + 'px';
    };
    const close = () => box.classList.remove('open');
    const draw = () => {
      const q = input.value.trim();
      items = rank(q);
      if (!q || !items.length || (items.length === 1 && items[0].name === input.value && (!k || items[0].team === draft[k].team))) { close(); return; }
      idx = Math.min(idx, items.length - 1);
      box.innerHTML = items.map((p, i) => `<div class="ac-item ${i === idx ? 'on' : ''}" data-i="${i}">
          ${p.country ? `<img src="/static/flags/${esc(String(p.country).toLowerCase())}.svg" alt="" onerror="this.style.visibility='hidden'">` : ''}
          ${p.team ? `<span class="tm">${esc(p.team)}</span>` : ''}<span class="nm">${highlight(p.name, q)}</span>
          <span class="meta">${esc([p.character, p.pronouns].filter(Boolean).join(' · '))}</span>
          ${p.source !== 'history' ? '<span class="src">START.GG</span>' : ''}</div>`).join('');
      place(); box.classList.add('open');
    };
    const pick = i => { const p = items[i]; if (!p) return; close(); if (onPick) { onPick(p); return; } input.blur(); fillPlayer(k, p); };
    input.addEventListener('input', () => { idx = 0; draw(); });
    input.addEventListener('focus', () => { if (input.value) draw(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (!box.classList.contains('open') || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; draw(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(idx); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    box.addEventListener('mousedown', e => { const it = e.target.closest('.ac-item'); if (it) { e.preventDefault(); pick(Number(it.dataset.i)); } });
    addEventListener('resize', () => box.classList.contains('open') && place());
    addEventListener('scroll', () => box.classList.contains('open') && place(), { capture: true, passive: true });
  }
  $$('[data-player]').forEach(setupAutocomplete);

  // ------------------------------------------------------------ start.gg
  let sgg = { hasToken: false }, setMode = 'event', sets = [], loadedSetId = null, autoTimer = null;
  // ------------------------------------------------------------ bracket / Top 8 splash
  let brStatus = null;
  // going on air fetches the latest results first (so it opens once, with fresh data): show that on the button
  function splashBusy(id, p) {
    const b = $(id), t = setTimeout(() => { b.classList.add('busy'); $(id + ' span').textContent = 'Loading bracket…'; }, 250);
    return p.finally(() => { clearTimeout(t); b.classList.remove('busy'); renderSplash(); });
  }
  async function toggleSplash(kind) {
    try {
      const r = await splashBusy(kind === 'top8' ? '#t8Toggle' : '#brToggle', api('/api/splash', { method: 'POST', body: { kind, show: 'toggle' } }));
      if (!r.state) return;
      server = r.state; brStatus = r.bracket; renderSplash(); renderVS();
      const on = server.splash && server.splash.show;
      toast(on ? (on === 'top8' ? 'Top 8 splash on stream' : (brStatus && brStatus.top8 && brStatus.autoTop8 ? 'Bracket on stream — showing the Top 8 splash' : 'Bracket on stream')) : 'Splash hidden');
    } catch (e) { toast(e.message, true); }
  }
  function renderSplash() {
    const cur = (server && server.splash && server.splash.show) || '';
    const set = (id, on, txt) => { $(id).classList.toggle('on', on); $(id + ' span').textContent = txt; };
    set('#brToggle', cur === 'bracket', cur === 'bracket' ? 'Hide bracket' : 'Show bracket');
    set('#t8Toggle', cur === 'top8', cur === 'top8' ? 'Hide Top 8' : 'Show Top 8');
    const s = brStatus, pill = $('#brPill');
    if (!s || (!s.ready && !s.error)) { pill.textContent = 'Not loaded'; pill.className = 'pill'; $('#brInfo').textContent = 'Loads from start.gg the first time you show it (or press ↻ start.gg).'; }
    else if (!s.ready) { pill.textContent = 'Error'; pill.className = 'pill err'; $('#brInfo').textContent = s.error; }
    else {
      pill.textContent = s.top8 ? 'Top 8 reached' : `${s.entrants} players`; pill.className = 'pill' + (s.top8 ? ' on' : '');
      const how = s.type === 'DE' ? (s.paged ? 'Winners and Losers take turns on screen' : 'winners and losers on one screen') : s.type === 'SE' ? 'single elimination' : 'this bracket type is shown as best it can be';
      const where = [s.phase, s.pool ? 'pool ' + s.pool : ''].filter(Boolean).join(' · ');
      $('#brInfo').textContent = `${where ? where + ' — ' : ''}${s.entrants} players, ${how}.` + (s.dropped ? ' Early rounds are left out so it fits.' : '')
        + (s.top8 ? (s.autoTop8 ? ' Top 8 is set, so the bracket shows the Top 8 splash.' : ' Top 8 is set.') : ' Top 8 isn’t set yet.')
        + (s.error ? ` (Last refresh failed: ${s.error})` : '');
    }
    const groups = (s && s.groups) || [];
    $('#brGroupRow').hidden = groups.length < 2;
    if (groups.length >= 2) $('#brGroup').innerHTML = `<option value="auto">Automatic (latest pool in play)</option>` + groups.map(g => `<option value="${esc(g.id)}" ${g.id === s.group ? 'selected' : ''}>${esc([g.phase, g.pool].filter(Boolean).join(' — '))}</option>`).join('');
    $('#setAutoTop8').checked = !s || s.autoTop8 !== false;
    if (s && s.refreshEvery != null) $('#brEvery').value = s.refreshEvery;
    if (s && s.pageEvery != null) $('#brPage').value = s.pageEvery;
    const side = (server && server.splash && server.splash.side) || 'W', paged = !!(s && s.ready && s.paged);
    $$('#brSide button').forEach(b => b.classList.toggle('on', paged && cur === 'bracket' && b.dataset.side === side));
    $('.br-side').classList.toggle('off', !!(s && s.ready) && !paged);
    $('#brSideHint').hidden = !(s && s.ready) || paged;
  }
  // Winners / Losers: shows the bracket on that side (or turns the page if it's already on stream)
  async function bracketSide(side) {
    try {
      const r = await splashBusy('#brToggle', api('/api/bracket/side', { method: 'POST', body: { side } }));
      server = r.state; brStatus = r.bracket; renderSplash(); renderVS();
      const s2 = server.splash || {};
      toast(!brStatus.paged ? 'Bracket on stream (it fits on one screen)' : `Bracket on stream — ${s2.side === 'L' ? 'Losers' : 'Winners'} side`);
    } catch (e) { toast(e.message, true); }
  }
  $('#brSide').onclick = e => { const b = e.target.closest('button[data-side]'); if (b) bracketSide(b.dataset.side); };
  $('#brTitle').onchange = e => saveSettings({ bracketTitle: e.target.value.trim() }, `Bracket title: ${e.target.value.trim() || 'Tournament Bracket'}`);
  $('#brPage').onchange = e => saveSettings({ bracketPage: e.target.value }, e.target.value === '0' ? 'Sides switch only when you pick one (or press the Stream Deck key)' : `Winners and Losers switch every ${e.target.value} s`);
  $('#brToggle').onclick = () => toggleSplash('bracket');
  $('#t8Toggle').onclick = () => toggleSplash('top8');
  async function refreshBracket() {
    const b = $('#brRefresh'); if (b.classList.contains('busy')) return;
    b.classList.add('busy'); $('#brRefresh span').textContent = 'Refreshing…';
    try { brStatus = await api('/api/bracket/refresh', { method: 'POST', body: {} }); renderSplash(); toast(brStatus.error ? brStatus.error : 'Bracket updated from start.gg', !!brStatus.error); }
    catch (e) { toast(e.message, true); renderSplash(); }
    finally { b.classList.remove('busy'); $('#brRefresh span').textContent = 'Refresh now'; }
  }
  $('#brRefresh').onclick = refreshBracket;
  $('#brEvery').onchange = e => saveSettings({ bracketRefresh: e.target.value }, e.target.value === '0' ? 'Bracket refreshes only when you ask' : `Bracket refreshes every ${e.target.value} s while it's showing`);
  setInterval(() => {                    // "updated 12 s ago"
    if (!brStatus || !brStatus.at || document.hidden) return;
    const s = Math.round((Date.now() - brStatus.at) / 1000);
    $('#brAgo').textContent = 'Updated ' + (s < 5 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago');
  }, 1000);
  $('#brGroup').onchange = async e => { try { brStatus = await api('/api/bracket/group', { method: 'POST', body: { id: e.target.value } }); renderSplash(); } catch (err) { toast(err.message, true); } };
  $('#setAutoTop8').onchange = e => saveSettings({ autoTop8: e.target.checked }, e.target.checked ? 'Top 8 splash will take over once Top 8 is set' : 'The bracket stays the bracket');
  api('/api/bracket').then(s => { brStatus = s; renderSplash(); }).catch(() => {});

  // ---- start.gg sign-in (the tokens stay sealed in the app; the panel only sees who you are)
  let mineAt = 0;
  function renderAccount() {
    const a = sgg.account || {}, on = !!a.signedIn;
    $('#sggSignedOut').hidden = on; $('#sggSignedIn').hidden = !on;
    if (on) { $('#sggUser').textContent = (a.user && a.user.name) || 'start.gg account'; $('#sggAva').src = (a.user && a.user.avatar) || ''; $('#sggUserSub').textContent = `Signed in with start.gg · ${a.protection === 'os' ? 'protected by Windows' : 'encrypted on this PC'}`; }
    $('#sggSignin').disabled = !!a.waiting; $('#sggSignin').lastChild.textContent = a.waiting ? 'Waiting for start.gg…' : 'Sign in with start.gg';
    $('#sggSigninHint').innerHTML = a.ready ? 'Opens start.gg in your browser — if you’re already signed in there, it’s one click. Your sign-in stays encrypted on this PC and never leaves BeeboScore. Sign out any time.'
      : 'Sign-in needs a start.gg app — open <b>Advanced</b> below to add one, or use an API token.';
    if (document.activeElement !== $('#sggAppId')) $('#sggAppId').value = a.clientId || '';
    $('#sggAppSecret').placeholder = a.hasSecret ? '•••••• (saved)' : a.builtIn ? 'built in' : '';
    if (document.activeElement !== $('#sggAppRedirect')) $('#sggAppRedirect').value = a.redirect || '';
    $('#sggTokDet').open = !on && !!sgg.hasToken || (!on && !a.ready);
    $('#sggMine').hidden = !on; $('#sggGrid').classList.toggle('two', on);
    if (on && Date.now() - mineAt > 60000) loadMine();
  }
  async function loadMine() {
    mineAt = Date.now();
    try {
      const r = await api('/api/startgg/mine'), cur = sgg.tournament && String(sgg.tournament.id);
      const fmt = t => t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      $('#sggMineList').innerHTML = r.list.length ? r.list.map(t => `<div class="sgg-t${String(t.id) === cur ? ' cur' : ''}"><img src="${esc(t.image)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(t.name)}</b><small>${esc([fmt(t.startAt), t.attendees ? `${t.attendees} attendees` : '', t.online ? 'Online' : t.place].filter(Boolean).join(' · '))}</small>
        ${t.events.length > 1 ? `<select class="f" data-ev="${esc(t.slug)}">${t.events.map(e => `<option value="${esc(e.id)}">${esc(e.name)}${e.entrants ? ` (${e.entrants})` : ''}</option>`).join('')}</select>` : t.events[0] ? `<small>${esc(t.events[0].name)}${t.events[0].entrants ? ` · ${t.events[0].entrants} entrants` : ''}</small>` : ''}</div>
        <button class="btn sm${String(t.id) === cur ? '' : ' primary'}" data-pull="${esc(t.slug)}" data-ev1="${esc((t.events[0] || {}).id || '')}">${String(t.id) === cur ? '↻ Pull again' : 'Pull players'}</button></div>`).join('') : '<div class="hint">No tournaments yet — ones you organise or help run on start.gg show up here.</div>';
    } catch (e) { $('#sggMineList').innerHTML = `<div class="hint">${esc(e.message)}</div>`; }
  }
  $('#sggMineRefresh').onclick = loadMine;
  $('#sggMineList').onclick = async e => {
    const b = e.target.closest('[data-pull]'); if (!b) return;
    const sel = $(`#sggMineList select[data-ev="${CSS.escape(b.dataset.pull)}"]`), eventId = sel ? sel.value : b.dataset.ev1;
    b.disabled = true; b.textContent = 'Pulling…';
    try { sgg = await api('/api/startgg/pull', { method: 'POST', body: { slug: b.dataset.pull, eventId } }); renderSgg(); await loadPlayers(); toast(`Pulled ${sgg.tournament.name}${sgg.entrants ? ` · ${sgg.entrants} players` : ''}`); if (sgg.eventId) loadSets(); mineAt = 0; loadMine(); }
    catch (er) { toast(er.message, true); b.disabled = false; b.textContent = 'Pull players'; }
  };
  $('#sggSignin').onclick = async () => {
    try { await api('/api/startgg/signin', { method: 'POST' }); toast('Finish signing in in your browser'); sgg.account = { ...(sgg.account || {}), waiting: true }; renderAccount(); }
    catch (e) { toast(e.message, true); if (/Advanced/.test(e.message)) $('#sggAdv').open = true; }
  };
  $('#sggSignout').onclick = async () => { if (!(await BeeboAsk.confirm({ title: 'Sign out of start.gg?', text: 'The saved sign-in is deleted from this PC. You can sign in again any time.', ok: 'Sign out of start.gg', danger: true }))) return; try { sgg = await api('/api/startgg/signout', { method: 'POST' }); renderSgg(); toast('Signed out of start.gg'); } catch (e) { toast(e.message, true); } };
  $('#sggAppSave').onclick = async () => {
    const body = { clientId: $('#sggAppId').value.trim(), redirect: $('#sggAppRedirect').value.trim() }; if ($('#sggAppSecret').value) body.clientSecret = $('#sggAppSecret').value;
    try { sgg = await api('/api/startgg/app', { method: 'POST', body }); $('#sggAppSecret').value = ''; renderSgg(); toast('start.gg app saved'); } catch (e) { toast(e.message, true); }
  };
  function renderSgg() {
    renderAccount();
    $('#sggTokenRow').hidden = !!sgg.hasToken;
    $('#sggTokenSaved').hidden = !sgg.hasToken;
    $('#sggTokenHint').textContent = sgg.tokenHint || '';
    if (sgg.link && !$('#sggLink').value) $('#sggLink').value = sgg.link;
    const t = sgg.tournament;
    $('#sggEventRow').hidden = !t;
    $('#sggUnload').hidden = !t;
    $('#sggSetsCard').hidden = !t;
    $('#splashCard').hidden = !(t && sgg.eventId);
    if (t) $('#sggEvent').innerHTML = (sgg.eventId ? '' : '<option value="">Choose an event…</option>') + t.events.map(e => `<option value="${e.id}" ${String(e.id) === String(sgg.eventId) ? 'selected' : ''}>${esc(e.name)}${e.game ? ' — ' + esc(e.game) : ''}${e.numEntrants ? ` (${e.numEntrants})` : ''}</option>`).join('');
    $('#sggCount').textContent = sgg.busy ? 'Importing…' : sgg.entrants ? `${sgg.entrants} players` : '—';
    const pill = $('#sggPill');
    pill.className = 'pill' + (sgg.busy ? ' busy' : t ? ' on' : '');
    pill.textContent = sgg.busy ? 'Syncing' : t ? t.name : sgg.hasToken ? 'Ready' : 'Not connected';
  }
  async function loadSgg() { try { sgg = await api('/api/startgg'); renderSgg(); } catch {} }
  $('#sggTokenSave').onclick = async () => {
    const token = $('#sggToken').value.trim();
    if (!token) return toast('Paste your token first', true);
    try { sgg = await api('/api/startgg/token', { method: 'POST', body: { token } }); $('#sggToken').value = ''; renderSgg(); toast('start.gg token saved'); } catch (e) { toast(e.message, true); }
  };
  $('#sggTokenChange').onclick = () => { $('#sggTokenRow').hidden = false; $('#sggTokenSaved').hidden = true; $('#sggToken').focus(); };
  // 1.12.24: Unload — nothing is lost that Load can't bring back (the link stays in the box)
  $('#sggUnload').onclick = async () => {
    const name = sgg.tournament ? sgg.tournament.name : 'The tournament';
    try { sgg = await api('/api/startgg/clear', { method: 'POST' }); renderSgg(); sets = []; await loadPlayers(); toast(`${name} unloaded — Load brings it back`); } catch (e) { toast(e.message, true); }
  };
  $('#sggLoad').onclick = async () => {
    const link = $('#sggLink').value.trim();
    if (!link) return toast('Paste a tournament link', true);
    if (!sgg.hasToken && !(sgg.account && sgg.account.signedIn)) return toast('Sign in with start.gg (or save an API token) first', true);
    const b = $('#sggLoad'); b.disabled = true; b.textContent = 'Loading…';
    try {
      sgg = await api('/api/startgg/tournament', { method: 'POST', body: { link } });
      renderSgg(); await loadPlayers();
      toast(`Loaded ${sgg.tournament.name}${sgg.entrants ? ` · ${sgg.entrants} players` : ''}`);
      if (sgg.eventId) loadSets();
    } catch (e) { toast(e.message, true); }
    finally { b.disabled = false; b.textContent = 'Load'; }
  };
  $('#sggLink').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#sggLoad').click(); } };
  $('#sggEvent').onchange = async e => {
    if (!e.target.value) return;
    try { sgg = await api('/api/startgg/event', { method: 'POST', body: { eventId: e.target.value } }); renderSgg(); await loadPlayers(); toast(`${sgg.entrants} players ready for autocomplete`); sets = []; loadSets(); } catch (err) { toast(err.message, true); }
  };
  $('#sggReimport').onclick = async () => { try { sgg = await api('/api/startgg/import', { method: 'POST' }); renderSgg(); await loadPlayers(); toast(`${sgg.entrants} players imported`); } catch (e) { toast(e.message, true); } };
  async function loadSets() {
    if (!sgg.tournament) return;
    if (!sets.length) $('#sggSets').innerHTML = '<p class="hint">Loading matches…</p>';
    try { sets = await api('/api/startgg/sets?mode=' + setMode); renderSets(); }
    catch (e) { $('#sggSets').innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
  }
  const slotName = sl => sl ? `${sl.team ? `<small>${esc(sl.team)}</small> ` : ''}${esc(sl.name)}` : '<span style="color:var(--faint)">TBD</span>';
  // one-click results: ✓ beside the winner's name reports the set to start.gg; DQ disqualifies that player from it
  const sggPending = new Set();
  const oneClick = (s, k) => {
    const me = s['p' + k], them = s['p' + (3 - k)];
    if (!me || !them || s.state === 3 || !me.entrantId || !them.entrantId || !info.local) return '';
    if (sggPending.has(String(s.id))) return k === 2 ? ' <small class="sgg-pend">Reporting…</small>' : '';
    return `<button class="bv-win" data-q="${esc(s.id)}" data-k="${k}" title="${esc(me.name)} won — report to start.gg" aria-label="${esc(me.name)} won">✓</button><button class="bv-dq" data-q="${esc(s.id)}" data-k="${k}" data-dq="1" title="Disqualify ${esc(me.name)} (${esc(them.name)} goes through)">DQ</button>`;
  };
  async function quickReport({ setId, w, l, round, isDQ }) {
    if (isDQ && !(await BeeboAsk.confirm({ title: `Disqualify ${l.name}?`, text: `${w.name} goes through on start.gg.`, ok: `Disqualify ${l.name}`, danger: true }))) return;
    sggPending.add(String(setId)); renderSets(); drawSggTree();
    try {
      await api('/api/startgg/quick', { method: 'POST', body: { setId, winnerId: w.entrantId || w.id, loserId: l.entrantId || l.id, names: [w.name, l.name], round, isDQ } });
      toast(isDQ ? `${l.name} disqualified — ${w.name} goes through` : `✓ ${w.name} wins — sent to start.gg`, { action: '↶ Undo', ms: 9000, run: () => api('/api/startgg/report/undo', { method: 'POST', body: { setId } }).then(() => toast('Result taken back on start.gg')).catch(e => toast(e.message, true)) });
      setTimeout(() => { sggPending.delete(String(setId)); loadSets(); refreshSggTree(true); }, 3500);
    } catch (e) { sggPending.delete(String(setId)); renderSets(); drawSggTree(); toast(e.message, true); }
  }
  $('#sggSets').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const s = sets.find(x => String(x.id) === b.dataset.q); if (!s) return;
    const k = Number(b.dataset.k), me = s['p' + k], them = s['p' + (3 - k)], dq = !!b.dataset.dq;
    quickReport({ setId: s.id, w: dq ? them : me, l: dq ? me : them, round: s.round, isDQ: dq });
  });
  // disqualify a player: start.gg DQs happen per match, so it's their next match that isn't played yet
  function renderDqSel() {
    const names = new Map();
    for (const s of sets) for (const k of ['p1', 'p2']) if (s[k] && s[k].entrantId) names.set(String(s[k].entrantId), s[k].name);
    const opts = [...names].sort((a, b) => a[1].localeCompare(b[1]));
    const h = '<option value="">Pick a player…</option>' + opts.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('');
    if ($('#sggDqSel').dataset.h !== h) { $('#sggDqSel').dataset.h = h; $('#sggDqSel').innerHTML = h; }
  }
  $('#sggDq').onclick = () => {
    const id = $('#sggDqSel').value; if (!id) return toast('Pick a player first', true);
    const s = sets.find(x => x.state !== 3 && x.p1 && x.p2 && [String(x.p1.entrantId), String(x.p2.entrantId)].includes(id));
    if (!s) return toast('They have no match waiting to be played — start.gg disqualifies a player from a match they’re in.', true);
    const k = String(s.p1.entrantId) === id ? 1 : 2;
    quickReport({ setId: s.id, w: s['p' + (3 - k)], l: s['p' + k], round: s.round, isDQ: true });
  };
  // the bracket view: the same matches drawn as a bracket (from the bracket splash's data)
  let sggView = store('sggView') || 'list', sggModel = null;
  async function refreshSggTree(force) {
    if (sggView !== 'tree') return;
    try { if (force) await api('/api/bracket/refresh', { method: 'POST' }); sggModel = await api('/api/bracket/data'); } catch { sggModel = null; }
    drawSggTree();
  }
  function drawSggTree() {
    const host = $('#sggTree'); if (sggView !== 'tree' || !window.BeeboBracketView) return;
    if (!sggModel || sggModel.viewer) { host.innerHTML = `<p class="hint">${sggModel && sggModel.viewer ? 'The bracket isn’t from start.gg.' : 'Loading the bracket… (if it doesn’t appear, the event may not have started)'}</p>`; return; }
    const secs = BeeboBracketView.fromModel(sggModel);
    BeeboBracketView.draw(host, secs, {
      pending: sggPending,
      canWin: S => info.local && S.state !== 'done' && !!(S.a.id && S.b.id), canDQ: S => info.local && S.state !== 'done' && !!(S.a.id && S.b.id),
      canReset: S => info.local && S.state === 'done', canLoad: S => S.state !== 'done' && !!(S.a.id && S.b.id),
      onWin: (S, k) => quickReport({ setId: S.id, w: S[k], l: S[k === 'a' ? 'b' : 'a'], round: S.raw.round }),
      onDQ: (S, k) => quickReport({ setId: S.id, w: S[k === 'a' ? 'b' : 'a'], l: S[k], round: S.raw.round, isDQ: true }),
      onReset: async S => { if (await BeeboAsk.confirm({ title: `Take back ${S.a.name} vs ${S.b.name}?`, text: 'start.gg resets this result, and anything that came after it.', ok: 'Take back the result', danger: true })) api('/api/startgg/reset', { method: 'POST', body: { setId: S.id } }).then(() => { toast('Result taken back'); setTimeout(() => { loadSets(); refreshSggTree(true); }, 1500); }).catch(e => toast(e.message, true)); },
      onLoad: S => { const x = sets.find(y => String(y.id) === String(S.id)); if (x) { const b = document.createElement('button'); b.dataset.set = String(x.id); document.body.appendChild(b); b.click(); b.remove(); } else toast('Refresh the matches first', true); },
    });
  }
  function setSggView(v) {
    sggView = v; store('sggView', v);
    $$('#sggView button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('#sggSets').hidden = v === 'tree'; $('#sggTree').hidden = v !== 'tree'; $('#sggFilter').hidden = v === 'tree';
    if (v === 'tree') refreshSggTree(false);
  }
  $('#sggView').onclick = e => { const b = e.target.closest('[data-v]'); if (b) setSggView(b.dataset.v); };
  setTimeout(() => setSggView(sggView), 0);
  function renderSets() {
    renderDqSel();
    const q = norm($('#sggFilter').value);
    const list = sets.filter(s => !q || norm((s.p1 && s.p1.displayName) + ' ' + (s.p2 && s.p2.displayName) + ' ' + s.round).includes(q));
    $('#sggSets').innerHTML = list.length ? list.map(s => `
      <div class="set ${s.id === loadedSetId ? 'loaded' : ''}">
        <div class="set-meta"><b>${esc(s.round || 'Match')}</b>${s.identifier ? `<span>${esc(s.identifier)}</span>` : ''}${s.pool ? `<span>Pool ${esc(s.pool)}</span>` : ''}${s.stream ? `<span>📺 ${esc(s.stream)}</span>` : ''}${s.stateText ? `<span class="st st-${s.state}">${esc(s.stateText)}</span>` : ''}</div>
        <div class="set-vs"><span>${slotName(s.p1)}${oneClick(s, 1)}</span><i>vs</i><span>${slotName(s.p2)}${oneClick(s, 2)}</span></div>
        <button class="btn sm ${s.id === loadedSetId ? '' : 'primary'}" data-set="${esc(s.id)}">${s.id === loadedSetId ? 'Loaded' : 'Load'}</button>
      </div>`).join('')
      : `<div class="empty"><b>${setMode === 'stream' ? 'Stream queue is empty' : 'No open matches'}</b>${setMode === 'stream' ? 'Assign matches to a stream on start.gg, then refresh.' : 'Matches appear here once the bracket starts.'}</div>`;
    const next = sets.filter(s => s.state !== 3 && s.p1 && s.p2).slice(0, 3);
    const up = sets.filter(s => s.state !== 3 && String(s.id) !== String(loadedSetId || '')).slice(0, 8).map(s => ({ round: s.round || '', p1: (s.p1 && (s.p1.displayName || s.p1.name)) || 'TBD', p2: (s.p2 && (s.p2.displayName || s.p2.name)) || 'TBD' }));
    if (info.local && JSON.stringify(up) !== renderSets.lastUp) { renderSets.lastUp = JSON.stringify(up); api('/api/upcoming', { method: 'POST', body: { list: up } }).catch(() => {}); }
    $('#sideNext').innerHTML = next.length
      ? next.map(s => `<div class="set" style="margin-bottom:6px"><div class="set-meta"><b>${esc(s.round)}</b></div><div class="set-vs">${slotName(s.p1)} <i>vs</i> ${slotName(s.p2)}</div><button class="btn sm" data-set="${esc(s.id)}">Load</button></div>`).join('')
      : 'No upcoming matches yet.';
  }
  $('#sggFilter').oninput = e => { e.stopPropagation(); renderSets(); };
  $('#sggRefreshSets').onclick = () => { loadSets(); refreshSggTree(true); };
  $$('#sggSetsCard [data-smode]').forEach(t => { t.onclick = () => { setMode = t.dataset.smode; sets = []; $$('#sggSetsCard [data-smode]').forEach(x => x.classList.toggle('on', x === t)); loadSets(); }; });
  $('#sggAuto').onchange = e => { clearInterval(autoTimer); store('sggAuto', e.target.checked ? '1' : '0'); if (e.target.checked) autoTimer = setInterval(() => !document.hidden && loadSets(), 30000); };
  if (store('sggAuto') === '1') { $('#sggAuto').checked = true; autoTimer = setInterval(() => !document.hidden && loadSets(), 30000); }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    const s = sets.find(x => String(x.id) === b.dataset.set); if (!s) return;
    for (const [k, sl] of [['p1', s.p1], ['p2', s.p2]]) {
      const known = sl && players.find(p => p.name.toLowerCase() === String(sl.name).toLowerCase());
      draft[k] = { name: sl ? sl.name : '', team: (known && known.team) || (sl && sl.team) || '', pronouns: (known && known.pronouns) || '', country: (known && known.country) || '', character: (known && known.character) || '', score: 0, loser: false,
        sggId: sl && sl.entrantId ? String(sl.entrantId) : '', avatar: (known && known.avatar) || '', wins: '', losses: '' };
    }
    if (s.round) draft.round = s.round;
    draft.setId = String(s.id);
    if (sgg.tournament && (!draft.event || draft.event === 'Weekly Tournament')) draft.event = sgg.tournament.name;
    loadedSetId = s.id;
    render(); renderSets(); markDirty();
    toast(mode === 'manual' ? 'Match loaded — press Update to show it' : 'Match loaded');
  });

  // ------------------------------------------------------------ go online
  let tunnel = { state: 'off' }, auth = { hasPassword: false };
  async function loadAuth() {
    try {
      auth = await api('/api/auth');
      $('#pwHint').textContent = auth.hasPassword ? 'Password set. Save a new one to change it (signs out remote devices).' : "Needed to open the control panel over the internet. Overlay links don't need it.";
      $('#pwInput').placeholder = auth.hasPassword ? '•••••••• (saved)' : 'At least 8 characters';
      const n = auth.sessions || 0;
      $('#sessCount').textContent = n ? `${n} device${n === 1 ? '' : 's'} signed in` : 'No devices signed in';
      $('#signoutAll').disabled = !n;
      tunnel = await api('/api/tunnel'); renderTunnel();
    } catch {}
  }
  function renderTunnel() {
    const st = tunnel.state;
    const pill = $('#onlinePill');
    pill.className = 'pill' + (st === 'online' ? ' on' : st === 'downloading' || st === 'starting' ? ' busy' : st === 'error' ? ' err' : '');
    pill.textContent = { online: 'Online', downloading: 'Setting up', starting: 'Connecting', error: 'Error', off: 'Offline' }[st] || 'Offline';
    $('#goOnline').hidden = st === 'online';
    $('#goOnline').disabled = st === 'downloading' || st === 'starting';
    $('#goOnline').textContent = st === 'downloading' || st === 'starting' ? 'Connecting…' : 'Go online';
    $('#onlineInfo').hidden = st !== 'online';
    $('#onlineMsg').textContent = tunnel.message || '';
    $('#onlineMsg').style.color = st === 'error' ? 'var(--err)' : '';
    if (st === 'online' && $('#pubOverlay').dataset.base !== tunnel.url) {
      $('#pubOverlay').dataset.base = tunnel.url; $('#pubOverlay').value = tunnel.url + '/overlay'; $('#pubControl').value = tunnel.url + '/';
      $('#pubShort').disabled = false; $('#pubShort').textContent = 'Shorten';
    }
  }
  // a much shorter public overlay link from a free link shortener (is.gd): only ever the overlay, never the control link
  $('#pubShort').onclick = async () => {
    const b = $('#pubShort'); b.disabled = true; b.textContent = 'Shortening…';
    try { const r = await api('/api/short/public', { method: 'POST', body: { url: tunnel.url + '/overlay' } }); $('#pubOverlay').value = r.url; b.textContent = 'Shortened'; copy(r.url, 'Short overlay link copied'); }
    catch (e) { b.disabled = false; b.textContent = 'Shorten'; toast(e.message, true); }
  };
  $('#pubControlShow').onclick = () => { const i = $('#pubControl'); i.type = i.type === 'password' ? 'text' : 'password'; $('#pubControlShow').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
  $('#pwShow').onclick = () => { const i = $('#pwInput'); i.type = i.type === 'password' ? 'text' : 'password'; $('#pwShow').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
  $('#pwGen').onclick = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const a = new Uint32Array(16); crypto.getRandomValues(a);
    const pw = [...a].map(x => chars[x % chars.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
    $('#pwInput').value = pw; $('#pwInput').type = 'text'; $('#pwShow').textContent = 'Hide';
    copy(pw, 'Strong password generated and copied — click Save to use it');
  };
  $('#signoutAll').onclick = async () => {
    if (!(await BeeboAsk.confirm({ title: 'Sign out every remote device?', text: 'Every phone and PC signed in remotely, team members included, has to sign in again.', ok: 'Sign them all out', danger: true }))) return;
    try { await api('/api/auth/signout-all', { method: 'POST' }); toast('All remote devices signed out'); loadAuth(); } catch (e) { toast(e.message, true); }
  };
  $('#setLanNoPw').onchange = e => saveSettings({ lanNoPassword: e.target.checked }, e.target.checked ? 'Devices on your Wi-Fi can control without a password' : 'Devices on your Wi-Fi now need the password');
  $('#pwSave').onclick = async () => { try { await api('/api/auth/password', { method: 'POST', body: { password: $('#pwInput').value } }); $('#pwInput').value = ''; toast('Remote-control password saved'); loadAuth(); } catch (e) { toast(e.message, true); } };
  $('#goOnline').onclick = async () => {
    if (!auth.hasPassword) { toast('Set a remote-control password first', true); $('#pwInput').focus(); return; }
    try { tunnel = await api('/api/tunnel/start', { method: 'POST' }); renderTunnel(); } catch (e) { toast(e.message, true); }
  };
  $('#goOffline').onclick = async () => { try { tunnel = await api('/api/tunnel/stop', { method: 'POST' }); renderTunnel(); } catch (e) { toast(e.message, true); } };

  // ------------------------------------------------------------ settings + updates
  let upd = { supported: false };
  function renderSettings() {
    applyTheme(settings.uiTheme || 'classic');
    if (document.activeElement !== $('#brTitle')) $('#brTitle').value = settings.bracketTitle || '';
    $('#setAutoSwitch').checked = !!settings.autoSwitchLayout;
    $('#setFollowFormat').checked = settings.followFormat !== false;
    $('#setRefreshReset').checked = settings.refreshOnReset !== false;
    $('#setLockSplash').checked = settings.lockSplash !== false;
    $$('#setCols [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === (settings.overlayColours === 'layout' ? 'layout' : 'team')));
    $$('#setUp [data-u]').forEach(b => b.classList.toggle('on', b.dataset.u === (['auto', 'ai', 'smart', 'off'].includes(settings.upscale) ? settings.upscale : 'auto')));
    { const v = Math.round(Number(settings.formatBarOpacity ?? 80)); if (document.activeElement !== $('#setFbo')) $('#setFbo').value = v; $('#setFboV').textContent = v + '%'; }
    $('#setAutoVictory').checked = settings.autoVictory !== false;
    $('#setVictoryHold').value = String(settings.victoryHold ?? '8');
    $('#vicAuto').checked = settings.autoVictory !== false; $('#vicHold').value = String(settings.victoryHold ?? '8');
    $('#splSeg [data-pane=victory]').classList.toggle('auto', settings.autoVictory !== false);
    renderSound();
    $('#setPotato').checked = !!settings.potatoMode;
    $('#setLaptop').checked = !!settings.laptopMode;
    potatoPreview();
    renderKeys();
    $('#setLanNoPw').checked = settings.lanNoPassword !== false;
  }
  async function saveSettings(patch, msg) {
    try { settings = await api('/api/settings', { method: 'POST', body: patch }); renderSettings(); renderVS(); window.dispatchEvent(new CustomEvent('beebo:settings')); if (msg) toast(msg); } catch (e) { toast(e.message, true); }
  }
  $('#setAutoSwitch').onchange = e => saveSettings({ autoSwitchLayout: e.target.checked });
  $('#setFollowFormat').onchange = e => saveSettings({ followFormat: e.target.checked });
  $('#setAutoVictory').onchange = e => saveSettings({ autoVictory: e.target.checked }, e.target.checked ? 'The victory splash will show when a set ends' : 'The victory splash only shows when you ask');
  $('#setVictoryHold').onchange = e => saveSettings({ victoryHold: e.target.value }, e.target.value === '0' ? 'The victory splash stays up until you hide it' : `The victory splash hides after ${e.target.value} s`);
  $('#setLaptop').onchange = e => saveSettings({ laptopMode: e.target.checked }, e.target.checked ? '🔋 Laptop mode on — effects rest when nothing is happening' : 'Laptop mode off');
  $$('#setUp [data-u]').forEach(b => b.onclick = () => saveSettings({ upscale: b.dataset.u }, { auto: 'Small pictures: made bigger (AI when it can)', ai: 'Small pictures: made bigger with AI', smart: 'Small pictures: smart resize', off: 'Small pictures are shown as they are' }[b.dataset.u]));
  $$('#setCols [data-c]').forEach(b => b.onclick = () => saveSettings({ overlayColours: b.dataset.c }, b.dataset.c === 'layout' ? 'Colours on stream: the layout’s own' : 'Colours on stream: team colours'));
  { let t = 0; $('#setFbo').oninput = e => { $('#setFboV').textContent = e.target.value + '%'; clearTimeout(t); t = setTimeout(() => saveSettings({ formatBarOpacity: Number(e.target.value) }), 140); }; }
  $('#setLockSplash').onchange = e => saveSettings({ lockSplash: e.target.checked }, e.target.checked ? 'The lock-in splash plays in team formats' : 'No lock-in splash');
  $('#setRefreshReset').onchange = e => saveSettings({ refreshOnReset: e.target.checked }, e.target.checked ? 'The overlay will refresh when scores are reset' : 'The overlay will no longer refresh on reset');
  // ------------------------------------------------------------ sound (sb-sound.js): stream on/off + volume here, the preview's own level under the preview
  var BS = window.BeeboSound;          // (var: the layout list can ask for the sound test before this line runs)
  function fillRange(r) { r.style.setProperty('--p', r.value + '%'); }
  function renderSound() {
    const on = settings.soundOn === true, obs = settings.obsVolume === true, v = Math.round(Number(settings.soundVolume ?? 80));
    $('#setSoundOn').checked = on; $('#setSoundVol').value = v; $('#setSoundVolV').textContent = obs ? 'OBS' : v + '%'; fillRange($('#setSoundVol'));
    $('#setSoundVol').disabled = obs; $('#setObsVolume').checked = obs;
    $('#sndPill').className = 'pill' + (on ? ' on' : ''); $('#sndPill').textContent = on ? (obs ? 'On · OBS mixer' : `On · ${v}%`) : 'Off';
    $('#pvSndTag').textContent = on ? 'preview' : 'preview · stream off';
  }
  $('#setSoundOn').onchange = e => saveSettings({ soundOn: e.target.checked }, e.target.checked ? '🔊 Your own sounds play on stream — tick “Control audio via OBS” on the browser source' : '🔇 Silent on stream');
  $('#setSoundVol').oninput = e => { $('#setSoundVolV').textContent = e.target.value + '%'; fillRange(e.target); };
  $('#setSoundVol').onchange = e => { saveSettings({ soundVolume: e.target.value }); };
  function renderPvSound() {
    if (!BS) { $('#pvSnd').hidden = true; return; }
    const p = BS.prefs(); $('#pvVol').value = p.vol; $('#pvVolV').textContent = p.muted ? 'muted' : p.vol + '%'; fillRange($('#pvVol'));
    $('#pvMute').textContent = p.muted || !p.vol ? '🔇' : p.vol < 40 ? '🔉' : '🔊'; $('#pvMute').title = p.muted ? 'Unmute the preview' : 'Mute the preview';
    $('#pvSnd').classList.toggle('muted', !!p.muted);
  }
  // the preview's level lives in this browser only (the overlays in the preview read it straight away)
  const pvApply = () => { const f = $('#preview'); try { const w = f.contentWindow, inner = w && w.document.querySelector('iframe:not(.next)'); for (const x of [w, inner && inner.contentWindow]) if (x && x.BeeboSound) x.BeeboSound.apply(); } catch (e) {} };
  $('#pvVol').oninput = e => { BS.setPrefs({ vol: Number(e.target.value), muted: false }); renderPvSound(); pvApply(); };
  $('#pvMute').onclick = () => { BS.setPrefs({ muted: !BS.prefs().muted }); renderPvSound(); pvApply(); };
  addEventListener('storage', e => { if (e.key === 'beebo.sound.preview2') renderPvSound(); });
  $('#setObsVolume').onchange = e => saveSettings({ obsVolume: e.target.checked }, e.target.checked ? 'Set the level with the source’s fader in the OBS mixer' : 'Stream volume is set here again');
  // Refresh OBS (1.12): the app reloads every BeeboScore browser source in OBS through OBS's WebSocket
  $('#obsRefresh').onclick = async () => {
    const b = $('#obsRefresh'); b.disabled = true; b.classList.add('busy');
    try { const r = await api('/api/obs/refresh', { method: 'POST', body: {} }); if (!r.skipped) toast(r.msg || 'Refreshed', !r.ok); }
    catch (e) { toast(e.message, true); } finally { b.disabled = false; b.classList.remove('busy'); }
  };
  // OBS's WebSocket (Settings › OBS connection, 1.12.8): the address and password are kept by the app; the password never leaves this PC
  async function obsConnect() {
    if (!window.OBSWebSocket) throw new Error('The OBS connector didn’t load.');
    const cfg = await api('/api/obs'); let pw = '';
    if (cfg.hasPassword) { try { pw = (await api('/api/obs/secret')).password || ''; } catch (e) {} }
    const obs = new window.OBSWebSocket(); await obs.connect(cfg.url || 'ws://127.0.0.1:4455', pw || undefined); return obs;
  }
  window.BeeboOBS = { connect: obsConnect, toast: (m, e) => toast(m, e), get local() { return !!info.local; } };
  { const u = $('#obsWsUrl'), pw = $('#obsWsPw'), pill = $('#obsPill');
    if (u) api('/api/obs').then(c => { u.value = c.url || ''; pw.placeholder = c.hasPassword ? 'Saved — type to change it' : 'None (OBS without authentication)'; }).catch(() => {});
    if ($('#obsWsSave')) $('#obsWsSave').onclick = async () => {
      const b = $('#obsWsSave'); b.disabled = true; pill.textContent = 'Testing…'; pill.className = 'pill';
      try {
        const body = { url: u.value.trim() }; if (pw.value) body.password = pw.value;
        const c = await api('/api/obs/settings', { method: 'POST', body }); pw.value = ''; pw.placeholder = c.hasPassword ? 'Saved — type to change it' : 'None (OBS without authentication)';
        const obs = await obsConnect(); let v = ''; try { v = (await obs.call('GetVersion')).obsVersion; } catch (e) {} try { obs.disconnect(); } catch (e) {}
        pill.textContent = 'Connected'; pill.className = 'pill on'; toast(`Connected to OBS${v ? ' ' + v : ''}`);
      } catch (e) { pill.textContent = 'Can’t reach OBS'; pill.className = 'pill err'; toast(/address/.test(e.message) ? e.message : 'Couldn’t reach OBS — check it’s open, the WebSocket server is on, and the address and password match.', true); }
      finally { b.disabled = false; }
    }; }
  $('#sndDock').onclick = () => copy(`${location.origin}/dock`, 'Dock link copied — in OBS: Docks › Custom Browser Docks…');
  $('#sndObs').onclick = async () => {     // every browser source showing a BeeboScore overlay: "Control audio via OBS" on
    const txt = $('#sndObsTxt'); txt.textContent = 'Talking to OBS…';
    try {
      if (!window.OBSWebSocket) throw new Error('The OBS connector didn’t load.');
      const obs = await obsConnect();
      try {
        const { inputs } = await obs.call('GetInputList', { inputKind: 'browser_source' }); let n = 0, fixed = 0;
        for (const i of inputs) {
          const { inputSettings: st } = await obs.call('GetInputSettings', { inputName: i.inputName });
          if (!/\/overlay(\/|\?|$)/.test(String(st.url || ''))) continue; n++;
          if (!st.reroute_audio) { await obs.call('SetInputSettings', { inputName: i.inputName, inputSettings: { reroute_audio: true } }); fixed++; }
        }
        txt.textContent = !n ? '❌ No browser source in OBS shows a BeeboScore layout yet.' : fixed ? `✅ Fixed ${fixed} of ${n} source${n > 1 ? 's' : ''} — set the level in the OBS mixer.` : `✅ All ${n} source${n > 1 ? 's' : ''} can be heard in OBS.`;
      } finally { try { obs.disconnect(); } catch (e) {} }
    } catch (e) { txt.textContent = '❌ Couldn’t reach OBS — open OBS and turn on Tools → WebSocket Server Settings (Settings › OBS connection has the address and password).'; }
  };
  renderPvSound();
  $('#setPreviewAnim').checked = store('previewAnim') !== '0';
  $('#setPreviewAnim').onchange = e => { store('previewAnim', e.target.checked ? '1' : '0'); applyPreviewAnim($('#preview')); };
  $('#setQuick').checked = store('qsHidden') !== '1';
  $('#setQuick').onchange = e => { store('qsHidden', e.target.checked ? '0' : '1'); $('#quickStart').hidden = !e.target.checked; };
  $('#quickStart').hidden = store('qsHidden') === '1';
  $('#qsHide').onclick = () => { store('qsHidden', '1'); $('#quickStart').hidden = true; $('#setQuick').checked = false; };

  const UPD_TEXT = {
    unsupported: 'Updates are handled by the desktop app.', 'no-repo': '',
    idle: '', checking: 'Checking for updates…', 'up-to-date': "You're on the latest version.",
    available: 'Update found — downloading…', downloading: 'Downloading update…', ready: 'Update downloaded — restart to install.',
    error: 'Could not check for updates.', dev: 'Updates are turned off when running from source.', found: 'Update available.',
    test: 'This copy doesn’t update itself. New versions of BeeboScore come as a new exe.',
  };
  function renderUpdate() {
    const st = upd.state || 'unsupported';
    $('#updUnsupported').hidden = !!upd.supported;
    $('#updBody').hidden = !upd.supported;
    $('#updVersion').textContent = `Version ${upd.version || info.version || '—'}`;
    let text = UPD_TEXT[st] || '';
    if (st === 'ready' || st === 'available' || st === 'downloading' || st === 'found') text = text.replace('Update', `Version ${upd.newVersion || ''}`.trim());
    if (st === 'error' && upd.message) text += ' ' + upd.message;
    if (st === 'up-to-date' && upd.checkedAt) text += ` (checked ${new Date(upd.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`;
    if (st === 'downloading') text += ` ${Math.round(upd.percent || 0)}%`;
    $('#updStatusText').textContent = text;
    $('#updStatusText').hidden = !text;
    $('#updProgress').hidden = st !== 'downloading';
    $('#updProgress i').style.width = (upd.percent || 0) + '%';
    $('#updInstall').hidden = st !== 'ready';
    $('#updCheck').textContent = st === 'found' ? 'Download update' : 'Check for updates';
    $('#updCheck').disabled = st === 'checking' || st === 'downloading' || st === 'no-repo' || st === 'dev' || st === 'test';
    const dismissed = store('updDismissed') === upd.newVersion;
    $('#updBanner').hidden = !(st === 'ready' && info.local !== false && !dismissed);
    $('#updBannerText').textContent = `BeeboScore ${upd.newVersion || ''} is ready to install.`;
    $('#setBadge').hidden = st !== 'ready';
  }
  async function loadUpdate() { try { upd = await api('/api/update'); renderUpdate(); } catch {} }
  $('#updCheck').onclick = async () => { try { upd = await api('/api/update', { method: 'POST', body: { action: 'check' } }); renderUpdate(); } catch (e) { toast(e.message, true); } };
  // Restart & update: the window is about to close while the new version unpacks or installs itself (a starting screen takes over
  // after a second or so). Say so first, so a closed window is not the only sign that anything is happening.
  const installNow = async () => {
    if (dirty && !(await BeeboAsk.confirm({ title: 'Restart and update?', text: 'You have changes that aren’t on stream yet. Press Update first if you want to send them.', ok: 'Restart and update', danger: true }))) return;
    if ($('#updOver')) return;
    const v = upd.newVersion || '', o = document.createElement('div'); o.id = 'updOver'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-live', 'assertive');
    o.style.cssText = 'position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:24px;background:rgba(4,5,9,.9);text-align:center';
    o.innerHTML = `<div style="max-width:460px"><div style="font-size:22px;font-weight:800;color:var(--text)">Starting BeeboScore ${esc(v)}</div>`
      + `<p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:var(--text)">This window will close and the new version will open by itself. It can take up to 20 seconds.</p>`
      + `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--muted)">If it does not open within a minute, start BeeboScore-${esc(v)}.exe yourself: it is in the same folder as this one.</p></div>`;
    document.body.appendChild(o);
    await new Promise(r => setTimeout(r, 1800));
    try { await api('/api/update', { method: 'POST', body: { action: 'install' } }); } catch (e) { o.remove(); toast(e.message, true); }
  };
  $('#updInstall').onclick = installNow;
  $('#updBannerBtn').onclick = installNow;
  $('#updBannerLater').onclick = () => { store('updDismissed', upd.newVersion || ''); renderUpdate(); };

  // ------------------------------------------------------------ set won → what next?
  function firstToOf(st) {
    const ft = /^FT\s*(\d+)$/i.exec(String(st.bestOf || '').trim());
    if (ft) return Number(ft[1]);
    const bo = Number(st.bestOf); return bo ? Math.ceil(bo / 2) : 0;
  }
  function nextSet() {
    return sets.find(s => s.state !== 3 && s.p1 && s.p2 && s.id !== loadedSetId && !(server && [s.p1.name, s.p2.name].includes(server.p1.name) && [s.p1.name, s.p2.name].includes(server.p2.name)));
  }
  function renderWin() {
    const st = server;
    const need = st ? firstToOf(st) : 0;
    const w = !st || !need ? 0 : (st.p1.score >= need && st.p2.score < need) ? 1 : (st.p2.score >= need && st.p1.score < need) ? 2 : 0;
    $('#winCard').hidden = !w;
    { const on = !!(st && st.victory && st.victory.show); $('#vicToggle').textContent = on ? '🏆 Hide victory splash' : '🏆 Show victory splash'; $('#vicToggle').classList.toggle('on', on); }
    if (!w) return;
    const winner = st['p' + w], loserP = st['p' + (3 - w)];
    $('#winTitle').textContent = `${winner.name || 'Player ' + w} wins the set ${st['p' + w].score}–${loserP.score}!`;
    const gf = /grand\s*final/i.test(st.round || '') && !/reset/i.test(st.round || '') && winner.loser && !loserP.loser;
    $('#winGF').hidden = !gf;
    const vOn = !!(st.victory && st.victory.show);
    $('#winVictory').textContent = vOn ? '🏆 Hide victory splash' : '🏆 Victory splash'; $('#winVictory').classList.toggle('on', vOn);
    $('#winSub').textContent = gf ? 'The player from losers took Grand Finals — time for a bracket reset.' : "What's next?";
    const nx = nextSet();
    $('#winNextMatch').hidden = !nx || gf;
    if (nx) $('#winNextMatch').textContent = `Load next: ${nx.p1.name} vs ${nx.p2.name}`;
  }
  async function pushNow(mutate, msg) {
    draft = clone(server); mutate(draft); render(); await push(); if (msg) toast(msg);
  }
  $('#winClear').onclick = () => pushNow(d => { for (const k of ['p1', 'p2']) d[k] = { name: '', team: '', pronouns: '', country: '', character: '', score: 0, loser: false, sggId: '', avatar: '', wins: '', losses: '' }; }, 'Ready for the next set');
  $('#winScores').onclick = () => pushNow(d => { d.p1.score = 0; d.p2.score = 0; });
  $('#winGF').onclick = () => pushNow(d => { d.round = 'Grand Finals Reset'; d.p1.loser = true; d.p2.loser = true; d.p1.score = 0; d.p2.score = 0; }, 'Bracket reset! Both players marked [L]');
  async function toggleVictory(show) {
    try { const r = await api('/api/victory', { method: 'POST', body: { show: show === undefined ? 'toggle' : show } }); server = r.state; renderWin(); toast(server.victory && server.victory.show ? 'Victory splash on stream' : 'Victory splash hidden'); }
    catch (e) { toast(e.message, true); }
  }
  $('#winVictory').onclick = () => toggleVictory();
  // 1.12: the Splashes card — FullVS / Victory / Pictures, one at a time (remembered)
  function splPane(k) {
    if (!['vs', 'victory', 'pics'].includes(k)) k = 'vs';
    for (const b of document.querySelectorAll('#splSeg button')) { b.classList.toggle('on', b.dataset.pane === k); b.setAttribute('aria-selected', String(b.dataset.pane === k)); }
    for (const pn of document.querySelectorAll('#vsCard .spl-pane')) pn.hidden = pn.dataset.pane !== k;
    store('splPane', k);
  }
  for (const b of document.querySelectorAll('#splSeg button')) b.onclick = () => splPane(b.dataset.pane);
  splPane(store('splPane') || 'vs');
  // Event & commentary: folded away (it's set once a night) with what's in it on the summary line
  function evcSum() {
    const v = k => ((document.querySelector(`[data-path="${k}"]`) || {}).value || '').trim();
    const cs = [v('c1.name'), v('c2.name')].filter(Boolean);
    $('#evcSum').textContent = [v('event'), v('game'), cs.length ? cs.join(' & ') : ''].filter(Boolean).join(' · ') || 'not set';
  }
  $('#evcCard').open = store('evcOpen') === '1';
  $('#evcCard').addEventListener('toggle', () => store('evcOpen', $('#evcCard').open ? '1' : '0'));
  $('#evcCard').addEventListener('input', evcSum);
  window.addEventListener('beebo:state', () => setTimeout(evcSum, 0)); setTimeout(evcSum, 600);
  $('#vicToggle').onclick = () => toggleVictory();
  $('#vicAuto').onchange = e => saveSettings({ autoVictory: e.target.checked }, e.target.checked ? 'The victory splash will pop up when a set is won' : 'The victory splash only shows when you ask');
  $('#vicHold').onchange = e => saveSettings({ victoryHold: e.target.value }, e.target.value === '0' ? 'The victory splash stays up until you hide it' : `The victory splash hides after ${e.target.value} s`);
  $('#winNextMatch').onclick = () => {
    const nx = nextSet(); if (!nx) return;
    const btn = document.createElement('button'); btn.dataset.set = nx.id; document.body.appendChild(btn); btn.click(); btn.remove();
    push();
  };

  // viewer matches from a keyboard shortcut (the Twitch tab has the buttons)
  const viewerKey = b => api('/api/remote/action', { method: 'POST', body: b }).catch(e => toast(e.message, true));
  // shared with the Twitch Stuff tab (twitch-panel.js)
  // "Sure? Press again": a small in-row button asks once more by changing its own label for 3.5 s (shared by every tab)
  function confirmTwice(b, label) { if (!b) return false; if (b.dataset.sure) { delete b.dataset.sure; clearTimeout(b._sureT); if (b._sureWas != null) b.textContent = b._sureWas; return true; } b.dataset.sure = '1'; b._sureWas = b.textContent; b.textContent = label || 'Sure? Press again'; b._sureT = setTimeout(() => { delete b.dataset.sure; b.textContent = b._sureWas; }, 3500); return false; }
  window.BeeboPanel = { confirmTwice, ask: window.BeeboAsk, settings: () => settings, score: (k, d) => bump(k, d), draft: () => draft, dirty: () => dirty && mode === 'manual', push: () => push(), saveSettings: (b, m) => saveSettings(b, m), store: (k, v) => store(k, v), api, toast, esc, copy: (t, m) => copy(t, m), shortLink: (p, b) => shortLink(p, b), info: () => info, autocomplete: (i, fn) => setupAutocomplete(i, fn), state: () => server, showTab: n => showTab(n), overlays: () => overlays, active: () => active, players: () => players };

  // ------------------------------------------------------------ realtime
  function handle(msg) {
    const d = msg.data;
    switch (msg.type) {
      case 'obs-replay': if (info.local && window.BeeboReplay) window.BeeboReplay.play(); break;
      case 'obs-replay2': if (info.local && window.BeeboReplay) { if (d && 'speed' in d) window.BeeboReplay.setSpeed(d.speed); if (d && 'freeze' in d) window.BeeboReplay.freeze(d.freeze); if (d && d.end) window.BeeboReplay.end(); } window.dispatchEvent(new CustomEvent('beebo:replay2', { detail: d })); break;   // 1.12.18
      case 'show': case 'showlog': case 'rehearsal': case 'media': case 'mirror': case 'show:changed': case 'show:draw': window.dispatchEvent(new CustomEvent('beebo:' + msg.type, { detail: d })); break;   // 1.12.19: show:changed — which cards to read again; show:draw — the replay drawing (the "On stream now" bar)   // 1.12.18: show-tab.js
      case 'vertical-clip': if (info.local && window.BeeboVertical) window.BeeboVertical.clip(); break;
      case 'results-make': if (window.BeeboResults) window.BeeboResults.open(); break;
      case 'obs-scene': if (info.local && window.BeeboOBS && d && d.scene) (async () => { let o = null; try { o = await BeeboOBS.connect(); await o.call('SetCurrentProgramScene', { sceneName: d.scene }); } catch (e) { BeeboOBS.toast(`Couldn’t switch OBS to “${d.scene}”: ${e.message}`, true); } finally { try { o && o.disconnect(); } catch (e) {} } })(); break;   // 1.12.16: an automation's step
      case 'obs-highlight': if (info.local && window.BeeboHighlights) window.BeeboHighlights.save(d); break;      // 1.12.16: a highlight clip at the end of a set
      case 'automations': if (window.BeeboAutos) window.BeeboAutos.update(d); break;
      case 'chapters': if (window.BeeboChapters) window.BeeboChapters.update(d); break;     // 1.12.15: only the app window on the streaming PC talks to OBS
      case 'state':
        if (server && server.updatedAt === d.updatedAt) break;
        server = d;
        if (!dirty) { draft = clone(server); render(); }
        else if (draft) {                  // pictures/records arriving from start.gg shouldn't wait for Update
          for (const k of ['p1', 'p2']) if (String(draft[k].sggId || '') === String(server[k].sggId || '') && server[k].sggId) {
            for (const f of ['avatar', 'wins', 'losses']) draft[k][f] = server[k][f];
          }
          render();
        }
        renderWin(); renderVS(); renderSplash(); renderScreens();
        window.dispatchEvent(new CustomEvent('beebo:state', { detail: server }));
        break;
      case 'bracket-status': brStatus = d; renderSplash(); window.dispatchEvent(new CustomEvent('beebo:bracket', { detail: d })); break;
      case 'share': window.dispatchEvent(new CustomEvent('beebo:share', { detail: d })); break;
      case 'upscale': window.dispatchEvent(new CustomEvent('beebo:upscale', { detail: d })); break;
      case 'koth': window.dispatchEvent(new CustomEvent('beebo:koth', { detail: d })); break;
      case 'cams': window.dispatchEvent(new CustomEvent('beebo:cams', { detail: d })); break;   // comm-panel.js (1.12.6)
      case 'top8-ready': window.dispatchEvent(new CustomEvent('beebo:top8ready', { detail: d })); break;   // top8-maker.js (1.12.6)   // koth-panel.js (1.12.6)
      case 'vt': window.dispatchEvent(new CustomEvent('beebo:vt', { detail: d })); break;
      case 'streamdeck-notice': window.dispatchEvent(new CustomEvent('beebo:streamdeck', { detail: d })); break;   // streamdeck-panel.js
      case 'overlays': loadScreens(); overlays = d; { const a = overlays.find(o => o.active); if (a) active = a.name; } refreshActive(); renderGamePick(); break;
      case 'config': if (d.activeOverlay !== active) { active = d.activeOverlay; refreshActive(); loadScreens(); } break;
      case 'players': players = d; refreshChars(); break;
      case 'startgg': sgg = d; renderSgg(); break;
      case 'startgg-auth': if (d.ok) toast(`Signed in to start.gg${d.name ? ' as ' + d.name : ''}`); else toast(d.error || 'start.gg sign-in failed', true); mineAt = 0; loadSgg(); break;
      case 'startgg-progress': $('#sggCount').textContent = `Importing… ${d.page}/${d.total}`; break;
      case 'settings': settings = d; renderSettings(); renderVS(); window.dispatchEvent(new CustomEvent('beebo:settings')); break;   // 1.12.21: the cards drawn by other files hear it too (it used to reach only the ones in this file)
      case 'potato': potatoPreview(d.ver); break;
      case 'sgg-reports': window.dispatchEvent(new CustomEvent('beebo:sggreports', { detail: d })); break;   // report-panel.js
      case 'tunnel': { const was = tunnel.state; tunnel = d; renderTunnel(); window.dispatchEvent(new CustomEvent('beebo:tunnel', { detail: d })); if (d.state === 'online' && was !== 'online') toast("You're online — copy your links in the Stream tab"); break; }
      case 'update': { const was = upd.state; upd = d; renderUpdate(); if (d.state === 'ready' && was !== 'ready') toast(`Update ${d.newVersion} downloaded`); break; }
    }
  }
  let wsOk = false, everOk = false, pollTimer = null, pollN = 0;
  function setStatus(on, text) { $('#dot').classList.toggle('on', on); $('#statusText').textContent = text; }
  function startPolling() {
    if (pollTimer) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        handle({ type: 'state', data: await api('/api/state') });
        if (pollN++ % 4 === 0) { handle({ type: 'overlays', data: await api('/api/overlays') }); if (info.local) handle({ type: 'tunnel', data: await api('/api/tunnel') }); }
        setStatus(true, 'Connected');
      } catch { setStatus(false, 'Reconnecting…'); }
    };
    tick(); pollTimer = setInterval(tick, 1500);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
  // 1.12.16: smaller updates — the app sends only what changed ("statep"); a missed one asks for the whole state again
  let stObj = null, stRev = 0;
  function applyPatch(msg, ws) {
    const d = msg.data || {};
    if (msg.type === 'state') { stObj = d; stRev = Number(msg.rev) || 0; return msg; }
    if (!stObj || !stRev || d.base !== stRev) { try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'state-full' })); } catch (e) {} return null; }
    const s = { ...stObj }, copied = new Set();
    const own = k => { if (!copied.has(k)) { copied.add(k); s[k] = s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) ? { ...s[k] } : {}; } return s[k]; };
    for (const p of d.del || []) { if (p.length === 1) delete s[p[0]]; else if (s[p[0]] && typeof s[p[0]] === 'object') delete own(p[0])[p[1]]; }
    for (const p of d.set || []) { if (p.length === 2) { s[p[0]] = p[1]; copied.add(p[0]); } else own(p[0])[p[1]] = p[2]; }
    stObj = s; stRev = d.rev;
    return { type: 'state', data: s, seq: msg.seq, rev: d.rev };
  }
  function connect() {
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch { startPolling(); return; }
    ws.onopen = () => { try { ws.send(JSON.stringify({ type: 'patch-ok' })); } catch (e) {} };
    const fallback = setTimeout(() => { if (!wsOk) startPolling(); }, 4000);
    ws.onmessage = e => {
      if (!wsOk) { wsOk = everOk = true; clearTimeout(fallback); stopPolling(); setStatus(true, 'Connected'); }
      try { let m = JSON.parse(e.data); if (m.type === 'state' || m.type === 'statep') m = applyPatch(m, ws); if (m) handle(m); } catch (err) { console.error(err); }
    };
    ws.onclose = () => {
      clearTimeout(fallback);
      if (wsOk) { wsOk = false; setStatus(false, 'Reconnecting…'); setTimeout(connect, 1000); }
      else { startPolling(); setTimeout(connect, everOk ? 3000 : 20000); }
    };
  }

  // viewer latency (Stream tab): public/latency-panel.js

  // ------------------------------------------------------------ boot
  updateBar();
  showTab(store('tab') || 'match');
  (async () => {
    try {
      info = await api('/api/info');
      document.body.classList.toggle('remote', !info.local);
      $('#remoteBanner').hidden = !!info.local;
      if (info.lan) $('#remoteText').textContent = "You're controlling the scoreboard from a device on the streamer's network.";
      $('#verLabel').textContent = `v${info.version} · by Beebo`;
      if (info.testBuild && !$('#testPill')) { $('.brand b').insertAdjacentHTML('afterend', '<span id="testPill" title="Test build: separate data, never updates itself" style="margin-left:8px;font:700 10px/1 inherit;letter-spacing:1.5px;padding:4px 7px;border-radius:6px;background:var(--accent,#e9c35e);color:#111">TESTBUILD</span>'); document.title = 'BeeboScore Testbuild'; }
      $('#aboutText').textContent = `Version ${info.version} · Developed by Beebo`;
      const lan = info.local ? info.urls.slice(1) : [];
      if (lan.length) $('#lanInfo').innerHTML = `Control from a phone or tablet on the same Wi-Fi: ${lan.map(u => `<code>${esc(u)}</code>`).join(' ')}`;
      if (info.local) { loadAuth(); loadUpdate(); setInterval(() => !document.hidden && loadAuth(), 15000); }
      else { $('#miniBtn').hidden = true; if (info.lan) $('#logoutBtn').hidden = true; }
    } catch {}
    try { settings = await api('/api/settings'); renderSettings(); } catch {}
    try { server = await api('/api/state'); draft = clone(server); render(); renderWin(); stateEvent(); } catch {}
    await loadOverlays().catch(e => toast(e.message, true));
    // the desktop app keeps its window hidden until this is set, so the panel never shows half-built:
    // a moment for the other panel scripts (Quick start, Format, Screens) to add their cards, then two painted frames
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => { window.__panelReady = true; })), 250);
    loadPlayers();
    loadSgg().then(() => { if (sgg.tournament && sgg.eventId) loadSets(); });
    connect();
  })();
})();

// 1.12.16: the app window's frame-rate cap (public/sb-fps.js; overlays in OBS follow OBS)
(() => { const s = document.getElementById('setAppFps'); if (!s || !window.BeeboFPS) return; s.value = String(BeeboFPS.cap); if (![...s.options].some(o => o.value === s.value)) s.value = '60';
  s.onchange = () => { BeeboFPS.set(Number(s.value)); (window.BeeboPanel && BeeboPanel.toast || (() => {}))(Number(s.value) ? `This window draws at most ${s.value} frames a second` : 'This window draws as fast as the screen'); }; })();


// 1.12.15: Instant replay. OBS saves its Replay Buffer; the clip goes into a "BeeboScore Replay" scene (with your BeeboScore
// overlay on top, so the scoreboard and the stinger carry over), the layout's stinger covers the cut there and back, and
// the clip stays where OBS saved it. Started from the Stream Deck's Replay key or the button in Settings › OBS connection.
window.BeeboReplay = {
  busy: false, speed: 100, frozen: false, obs: null, endNow: null,     // 1.12.18: Replay 2.0 — slow motion, freeze-frame, back early
  async setSpeed(v) { this.speed = Math.max(10, Math.min(100, Number(v) || 100)); if (this.obs && this.busy) try { await this.obs.call('SetInputSettings', { inputName: 'BeeboScore Replay clip', inputSettings: { speed_percent: this.speed } }); } catch (e) {} },
  async freeze(on) { this.frozen = on === undefined ? !this.frozen : !!on; if (this.obs && this.busy) try { await this.obs.call('TriggerMediaInputAction', { inputName: 'BeeboScore Replay clip', mediaAction: this.frozen ? 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE' : 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY' }); } catch (e) {} },
  end() { if (this.endNow) this.endNow(); },
  async play() {
    const X = window.BeeboOBS; if (!X || this.busy) return; this.busy = true;
    const sleep = ms => new Promise(r => setTimeout(r, ms)), sting = () => fetch('/api/remote/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'stinger' }) }).catch(() => {});
    const SCENE = 'BeeboScore Replay', CLIP = 'BeeboScore Replay clip'; let obs = null;
    try {
      obs = await X.connect();
      const rb = await obs.call('GetReplayBufferStatus').catch(() => null);
      if (!rb || !rb.outputActive) throw new Error('Turn on OBS’s Replay Buffer first: Settings › Output › Replay Buffer, then Start Replay Buffer in the Controls dock.');
      const saved = new Promise(res => { const h = ev => { obs.off('ReplayBufferSaved', h); res(ev && ev.savedReplayPath); }; obs.on('ReplayBufferSaved', h); setTimeout(() => res(null), 7000); });
      await obs.call('SaveReplayBuffer');
      let file = await saved; if (!file) file = (await obs.call('GetLastReplayBufferReplay').catch(() => ({}))).savedReplayPath;
      if (!file) throw new Error('OBS didn’t save a replay — try again in a moment.');
      const { scenes } = await obs.call('GetSceneList');
      if (!scenes.some(x => x.sceneName === SCENE)) await obs.call('CreateScene', { sceneName: SCENE });
      const { inputs } = await obs.call('GetInputList'), has = n => inputs.some(i => i.inputName === n);
      const clip = { local_file: file, is_local_file: true, restart_on_activate: true, close_when_inactive: true, looping: false, speed_percent: this.speed };
      this.obs = obs; this.frozen = false;
      if (has(CLIP)) await obs.call('SetInputSettings', { inputName: CLIP, inputSettings: clip });
      else { await obs.call('CreateInput', { sceneName: SCENE, inputName: CLIP, inputKind: 'ffmpeg_source', inputSettings: clip });
        // the BeeboScore overlay on top of the clip, the first time
        for (const i of inputs.filter(i => i.inputKind === 'browser_source')) { const { inputSettings: st } = await obs.call('GetInputSettings', { inputName: i.inputName }); if (/\/overlay(\/|\?|$)/.test(String(st.url || ''))) { await obs.call('CreateSceneItem', { sceneName: SCENE, sourceName: i.inputName }).catch(() => {}); break; } } }
      const cur = await obs.call('GetCurrentProgramScene'), back = cur.currentProgramSceneName || cur.sceneName;
      const ended = new Promise(res => { const h = ev => { if (ev && ev.inputName === CLIP) { obs.off('MediaInputPlaybackEnded', h); res(); } }; obs.on('MediaInputPlaybackEnded', h); this.endNow = res; const long = () => setTimeout(() => (this.frozen ? long() : res()), 60000); long(); });
      sting(); await sleep(450); await obs.call('SetCurrentProgramScene', { sceneName: SCENE });
      await ended;
      sting(); await sleep(450); if (back && back !== SCENE) await obs.call('SetCurrentProgramScene', { sceneName: back });
      X.toast('Replay played — OBS kept the clip in its recordings folder');
    } catch (e) { X.toast(/connect|reach|ECONN|WebSocket/i.test(e.message) ? 'Couldn’t reach OBS — Settings › OBS connection.' : e.message, true); }
    finally { try { obs && obs.disconnect(); } catch (e) {} this.busy = false; this.obs = null; this.endNow = null; this.frozen = false; try { fetch('/api/remote/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'drawClear' }) }); } catch (e) {} }
  },
};
(() => { const b = document.getElementById('obsReplay'); if (b) b.onclick = () => window.BeeboReplay.play(); })();

// 1.12.15: Player history (Matches tab)
(() => {
  const $i = id => document.getElementById(id), card = $i('histCard'); if (!card) return;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const when = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  async function now() {
    try { const st = await fetch('/api/state').then(r => r.json()), a = st.p1 && st.p1.name, b = st.p2 && st.p2.name; if (!a || !b) { $i('histNow').innerHTML = ''; return; }
      const m = await fetch(`/api/history/matchup?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`).then(r => r.json());
      $i('histNow').innerHTML = `<b>${esc(a)}</b> ${m.a.record ? `(${esc(m.a.record)})` : '(new)'} vs <b>${esc(b)}</b> ${m.b.record ? `(${esc(m.b.record)})` : '(new)'} — ${esc(m.view.line || 'First meeting')}`; } catch (e) {}
  }
  async function list() {
    try { const d = await fetch('/api/history?q=' + encodeURIComponent($i('histQ').value.trim())).then(r => r.json());
      $i('histN').textContent = `${d.size} set${d.size === 1 ? '' : 's'} kept`;
      $i('histList').innerHTML = d.sets.length ? d.sets.map(r => `<div class="hist-row"><span class="d">${when(r.at)}</span><span class="m"><b class="${r.winner === 1 ? 'w' : ''}">${esc(r.p1.name)}</b>${r.p1.char ? ` <i>${esc(r.p1.char)}</i>` : ''} <span class="s">${r.s1}–${r.s2}</span> <b class="${r.winner === 2 ? 'w' : ''}">${esc(r.p2.name)}</b>${r.p2.char ? ` <i>${esc(r.p2.char)}</i>` : ''}</span><span class="e">${esc([r.event, r.round].filter(Boolean).join(' · '))}</span><button class="ibtn sm" data-at="${r.at}" title="Forget this set">✕</button></div>`).join('')
        : '<p class="hint">No sets yet — they appear here as sets are won.</p>';
    } catch (e) {}
  }
  $i('histList').onclick = async e => { const b = e.target.closest('[data-at]'); if (!b) return; await fetch('/api/history/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ at: Number(b.dataset.at) }) }).catch(() => {}); list(); now(); };
  let t = 0; $i('histQ').oninput = () => { clearTimeout(t); t = setTimeout(list, 220); };
  card.addEventListener('toggle', () => { if (card.open) { list(); now(); } });
  setInterval(() => { if (card.open && card.offsetParent) { now(); list(); } }, 15000);
})();

// 1.12.15: Settings › Health — the overlays on stream (and how hard their effects engines work), OBS, the Stream Deck,
// backups, and anything the app had to restore from its last good copy
(() => {
  const box = document.getElementById('health'); if (!box) return;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  const LV = ['Full', 'Light', 'Plain look'], KIND = { pc: 'This PC', lan: 'Home network', online: 'Online' };
  let obsOk = null;
  async function draw() {
    let d; try { d = await fetch('/api/health').then(r => r.json()); } catch (e) { box.innerHTML = '<p class="hint">Couldn’t read the app’s health.</p>'; return; }
    const row = (ok, title, text) => `<div class="hl-row ${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><i></i><b>${title}</b><span>${text}</span></div>`;
    const ovs = d.overlays.filter(v => v.obs || v.kind === 'pc');
    const ovLines = ovs.length ? ovs.map(v => { const g = v.gfx; return `${esc(v.layout || 'overlay')} (${KIND[v.kind] || v.kind}${v.obs ? ', OBS' : ''})${g ? ` — ${g.fps} fps, ${g.ms} ms a frame, ${LV[g.level] || ''}${g.contexts ? `, ${g.contexts} graphics context${g.contexts === 1 ? '' : 's'}` : ''}${g.gpu ? ` · ${esc(g.gpu)}` : ''}${g.why ? ` · ${esc(g.why)}` : ''}` : ''}`; }).join('<br>') : 'No overlay is open — add BeeboScore to OBS as a Browser source.';
    box.innerHTML = [
      row(ovs.length > 0, 'Overlays', ovLines),
      row(obsOk, 'OBS', obsOk === null ? 'Not checked yet — press Refresh' : obsOk ? `Connected${obsInfo && obsInfo.fps ? ` · stream at ${obsInfo.fps} fps` : ''}${obsInfo && obsInfo.sources ? ` · ${obsInfo.sources.length} BeeboScore browser source${obsInfo.sources.length === 1 ? '' : 's'}` : ''}` : 'Can’t reach OBS’s WebSocket (Settings › OBS connection)'),
      ...tips(d, ovs).map(t => row(null, '⚠ ' + t[0], t[1])),
      row(d.streamdeck ? true : null, 'Stream Deck', d.streamdeck ? 'The BeeboScore plugin is connected' : 'Not connected (fine if you don’t use one)'),
      ...showRows(d.show),
      row(d.lastBackup && Date.now() - d.lastBackup < 3 * 864e5 ? true : null, 'Backups', `Last one ${ago(d.lastBackup)} · ${d.backups} kept`),
      d.restored && d.restored.length ? row(false, 'Recovered', d.restored.map(r => `${esc(r.file)} was damaged — the last good copy was used (${ago(r.at)})`).join('<br>')) : '',
      row(null, 'App', `Version ${esc(d.version)} · running ${Math.round(d.uptime / 3600 * 10) / 10} h · ${d.memory} MB · ${d.history} sets in Player history${d.autopilot.on ? ' · Run of show on' : ''}${d.tempo ? ` · ${d.tempo} BPM` : ''}`),
    ].join('');
  }
  // 1.12.19: the video tools, the backup PC, sync between PCs, and the show's own OBS sources (with Add to OBS)
  function showRows(x) {
    if (!x) return [];
    const row = (ok, title, text) => `<div class="hl-row ${ok === true ? 'ok' : ok === false ? 'bad' : ''}"><i></i><b>${title}</b><span>${text}</span></div>`, out = [];
    const b = x.backup || {};
    out.push(b.standby ? row(b.ok, 'Backup PC', b.ok ? `This PC is the backup and is copying the streaming PC (${b.quiet == null ? '' : b.quiet + ' s ago'})` : `This PC is the backup, but ${esc(b.error || 'the streaming PC isn’t answering')}`)
      : b.sharing ? row(b.seen && Date.now() - b.seen < 8000 ? true : null, 'Backup PC', b.seen && Date.now() - b.seen < 8000 ? 'A backup PC is copying this one' : 'The link is shared, but no backup PC is copying this one right now') : row(null, 'Backup PC', 'Not set up (fine if you don’t use one)'));
    const y = x.sync || {};
    out.push(!y.on ? row(null, 'Sync', 'Off (Settings › Sync between your PCs)') : row(y.ok && !y.error ? true : false, 'Sync', !y.ok ? 'The shared folder isn’t there' : y.error ? esc(y.error) : `Last written ${ago(y.wrote)}${y.waiting ? ` · ${esc(y.waiting)} has newer settings` : ''}`));
    const src = obsInfo && obsInfo.sources, has = p => src && src.find(s2 => { try { return new URL(s2.url).pathname.replace(/\/+$/, '') === p; } catch (e) { return false; } });
    for (const [k, p, t, need] of [['music', '/music-player', 'Music (OBS)', true], ['vertical', '/vertical', 'Vertical (OBS)', false], ['venue', '/venue', 'Venue (OBS)', false]]) {
      const hit = has(p), btn = `<button class="btn xs" type="button" data-add-obs="${k}">➕ Add to OBS</button>`;
      out.push(row(!src ? null : hit ? true : null, t, !src ? 'Press Refresh to check OBS' : hit ? `Yes (“${esc(hit.name)}”)` : `${need ? 'Not yet' : 'Not in OBS (fine if you don’t use it)'} ${btn}`));
    }
    return out;
  }
  window.addEventListener('beebo:obs-sources', async () => { await checkObs(); draw(); });
  // 1.12.16: what's worth changing — several BeeboScore sources (each one is a whole browser of its own in OBS), a source
  // drawing more frames than the stream, one at the wrong size, or one set to restart whenever its scene comes on
  let obsInfo = null;
  function tips(d, ovs) {
    const out = [], src = obsInfo && obsInfo.sources;
    const n = src ? src.length : ovs.filter(v => v.obs && v.kind === 'pc').length;
    if (n > 1) out.push(['Several overlays in OBS', `${n} BeeboScore browser sources are open in OBS${src ? ` (${src.map(s => esc(s.name)).join(', ')})` : ''}. Each one is a whole browser of its own, running all the time. One source showing <code>/overlay</code> is usually enough — add <code>?screen=…</code> sources only for a screen you need somewhere else.`]);
    if (src) for (const s of src) {
      if (s.fpsCustom && obsInfo.fps && s.fps > obsInfo.fps) out.push([`“${esc(s.name)}” draws too many frames`, `It's set to ${s.fps} fps but your stream is ${obsInfo.fps} fps: untick “Use custom frame rate” in its properties (or set it to ${obsInfo.fps}).`]);
      if (s.restart) out.push([`“${esc(s.name)}” restarts`, 'It has “Refresh browser when scene becomes active” on, so it replays its intro every time you switch to that scene. Turn it off in its properties.']);
      if (s.overlay && (s.w !== 1920 || s.h !== 1080)) out.push([`“${esc(s.name)}” is ${s.w} × ${s.h}`, 'Layouts are made for 1920 × 1080: set its width and height to that and scale the source instead.']);
    }
    for (const v of ovs) if (v.gfx && v.gfx.level >= 2) out.push(['An overlay is struggling', `${esc(v.layout || 'An overlay')} (${KIND[v.kind] || v.kind}) has stepped down to the plain look to keep up. Try Laptop mode or Light effects (Settings › Performance).`]);
    return out;
  }
  async function checkObs() {
    let o = null;
    try {
      o = await window.BeeboOBS.connect(); obsOk = true; obsInfo = { sources: [] };
      try { const v = await o.call('GetVideoSettings'); obsInfo.fps = Math.round(v.fpsNumerator / (v.fpsDenominator || 1) * 100) / 100; } catch (e) {}
      try {
        const { inputs } = await o.call('GetInputList', { inputKind: 'browser_source' });
        for (const i of inputs) {
          const st = ((await o.call('GetInputSettings', { inputName: i.inputName })) || {}).inputSettings || {}, url = String(st.url || '');
          if (!/\/(overlay|o\/)|:3[01]\d\d\//.test(url) || !/localhost|127\.0\.0\.1/.test(url)) continue;
          obsInfo.sources.push({ name: i.inputName, url, overlay: /\/overlay/.test(url), fpsCustom: !!st.fps_custom, fps: Number(st.fps) || 30, restart: !!st.restart_when_active, w: Number(st.width) || 800, h: Number(st.height) || 600 });
        }
      } catch (e) {}
    } catch (e) { obsOk = false; obsInfo = null; }
    finally { try { o && o.disconnect(); } catch (e) {} }
  }
  document.getElementById('healthGo').onclick = async () => { await checkObs(); draw(); };
  draw(); setInterval(() => { if (box.offsetParent) draw(); }, 5000);
})();
