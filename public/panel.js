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
  let gameFilter = 'all';

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
    if (act) { const b = document.createElement('button'); b.className = 'toast-btn'; b.textContent = act.action; b.onclick = () => { t.remove(); act.run(); }; t.appendChild(b); }
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
  const flagUrl = cc => /^[a-z]{2}$/i.test(cc || '') ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : '';
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
    if (name === 'designer' && !info.local) name = 'layouts';
    if (name === 'autoscore' && !(settings && settings.showAutoscore)) name = 'match';
    document.body.classList.toggle('dz-open', name === 'designer');
    if (name === 'designer') designerFrame();
    $$('nav.rail button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('main .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    store('tab', name);
    if (name === 'bracket' && sgg.tournament && !sets.length) loadSets();
    const back = curTab === '' ? tabScroll[name] || 0 : 0;             // a reload lands where you were; switching tabs starts at the top
    curTab = name;
    window.scrollTo({ top: 0 }); if (back) setTimeout(() => window.scrollTo({ top: back }), 250);
  }
  $$('nav.rail button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
  document.addEventListener('click', e => { const j = e.target.closest('[data-scroll-to]'); if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.scrollTo); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
  // UI theme (Settings › Look & feel): Classic or Shattered, without reloading
  function applyTheme(t) {
    const sh = t === 'shattered' && !document.documentElement.classList.contains('potato');
    document.documentElement.classList.toggle('theme-shattered', sh);
    if (sh && !document.querySelector('link[href="/static/theme-shattered.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/static/theme-shattered.css'; document.head.appendChild(l); }
    $$('#themePick .theme-opt').forEach(b => b.classList.toggle('on', b.dataset.theme === (t || 'classic')));
    const f = document.querySelector('#dzFrame iframe'); if (f) try { f.contentWindow.postMessage({ type: 'beebo-designer-theme', theme: sh ? 'shattered' : 'classic' }, location.origin); } catch {}
  }
  $('#themePick').onclick = e => { const b = e.target.closest('.theme-opt'); if (!b) return; applyTheme(b.dataset.theme); saveSettings({ uiTheme: b.dataset.theme }, b.dataset.theme === 'shattered' ? 'Shattered theme on' : 'Classic theme on'); };
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
  }
  function markDirty() {
    if (mode === 'live') { clearTimeout(liveTimer); liveTimer = setTimeout(push, 90); }
    else { dirty = true; updateBar(); }
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
    delete payload.vs;                    // the VS intro is switched on its own
    delete payload.splash;                // …and so are the bracket / Top 8 splashes
    delete payload.hidden;                // …and hiding the whole overlay (the header button / Stream Deck)
    payload.p1.score = Math.max(0, Number(payload.p1.score) || 0);
    payload.p2.score = Math.max(0, Number(payload.p2.score) || 0);
    try {
      server = await api('/api/state', { method: 'POST', body: payload });
      dirty = false; updateBar(); renderWin();
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
  async function undo() {
    try {
      const r = await api('/api/state/undo', { method: 'POST' });
      server = r.state; draft = clone(server); dirty = false; render(); updateBar();
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
    if ($('#editorModal').classList.contains('open') || e.defaultPrevented) return;
    if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); const tabs = ['match', 'format', 'bracket', 'layouts', 'designer', 'stream', 'twitch', ...(settings.showAutoscore ? ['autoscore'] : []), 'settings']; if (tabs[e.key - 1]) showTab(tabs[e.key - 1]); return; }
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
      viewerNext: () => viewerKey({ action: 'viewerNext' }), viewerWin: () => viewerKey({ action: 'viewerResult', who: 'streamer' }), viewerLose: () => viewerKey({ action: 'viewerResult', who: 'viewer' }),
      viewerQueue: () => viewerKey({ action: 'viewerQueue', open: 'toggle' }), viewerSplash: () => viewerKey({ action: 'viewerSplash', show: 'toggle' }), viewerSidebar: () => viewerKey({ action: 'viewerSidebar', show: 'toggle' }),
      autoscoreToggle: () => viewerKey({ action: 'autoscoreToggle' }), autoscoreUndo: () => viewerKey({ action: 'autoscoreUndo' }), autoscoreConfirm: () => viewerKey({ action: 'autoscoreConfirm' }),
      soundToggle: () => viewerKey({ action: 'sound', on: 'toggle' }).then(r => { if (r && r.status) toast(r.status.sound.on ? '🔊 Stream sound on' : '🔇 Stream sound off'); }),
    }[action] || (() => {}))();
  });

  // ------------------------------------------------------------ potato mode
  const POTATO_ON = ['The app restarts in a lightweight mode for low-end PCs.', [
    'Classic Windows XP look; every animation and visual effect is switched off.',
    'Layouts are drawn as a still picture (PNG) each time something changes. No animations or effects on stream.',
    'Lightest option for OBS: add an <b>Image</b> source pointing at <code>output/overlay.png</code> in your BeeboScore folder (or keep the usual Browser source).',
    'Graphics acceleration is turned off, and most extras run at the bare minimum.',
    'You can switch back here at any time (another restart).']];
  const POTATO_OFF = ['The app restarts with the full experience again.', [
    'Animated layouts, effects and the VS intro animations come back.',
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

  // ------------------------------------------------------------ VS intro
  async function toggleVS(show) {
    try { server = await api('/api/vs', { method: 'POST', body: { show: show === undefined ? 'toggle' : show } }); renderVS(); toast(server.vs && server.vs.show ? 'VS Splash on stream' : 'VS Splash hidden'); }
    catch (e) { toast(e.message, true); }
  }
  function renderVS() {
    const on = !!(server && server.vs && server.vs.show);
    $('#vsToggle').classList.toggle('on', on);
    $('#vsToggle').textContent = on ? 'Hide VS Splash' : 'Show VS Splash';
    if (!draft) return;
    for (const n of [1, 2]) {
      const p = draft['p' + n] || {}, img = $('#vsAva' + n), src = String(p.avatar || '');
      $('#vsIni' + n).textContent = String(p.name || n).trim().charAt(0).toUpperCase();
      if (img.dataset.src !== src) { img.dataset.src = src; img.hidden = !src; if (src) { img.onerror = () => { img.hidden = true; }; img.src = src; } else img.removeAttribute('src'); }
    }
  }
  $('#vsToggle').onclick = () => toggleVS();
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
  $('#scrDesign').onclick = () => openDesigner && openDesigner(active);
  loadScreens();
  $('#vsRefresh').onclick = async () => {
    try { await api('/api/vs/refresh', { method: 'POST', body: {} }); toast(sgg.tournament ? 'Fetching pictures and records from start.gg…' : 'Connect a start.gg tournament in the start.gg tab first'); }
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
    const html = games.map(g => `<option value="${esc(g)}">${esc(g)}${withLayout.has(g) ? '' : ' (no layout yet)'}</option>`).join('');
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
    // one group (this build: every layout is for any game) needs no heading
    sel.innerHTML = order.length === 1 ? groups[order[0]].map(opt).join('') : order.map(g => `<optgroup label="${esc(g === cur ? '★ ' + g : g)}">${groups[g].map(opt).join('')}</optgroup>`).join('');
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
    for (const [w, f] of [['#previewWrap', '#preview'], ['#edPreviewWrap', '#edPreview']]) {
      const wrap = $(w), fr = $(f);
      if (wrap.clientWidth) fr.style.transform = `scale(${wrap.clientWidth / 1920})`;
    }
  }
  new ResizeObserver(scaleFrames).observe($('#previewWrap'));
  new ResizeObserver(scaleFrames).observe($('#edPreviewWrap'));
  const BGS = [['checker', 'Checker'], ['game', 'Scene'], ['green', 'Green']];
  function setBg(bg) {
    store('bg', bg);
    for (const w of ['#previewWrap', '#edPreviewWrap']) $(w).className = 'preview-wrap ' + bg;
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
    if (o && ['shattered', 'oni'].includes(o.sound) && $('#sndPack').value !== o.sound) { $('#sndPack').value = o.sound; renderSoundTest(); }   // Sound test: the live layout's pack
    $('#nowName').textContent = o ? o.title : active;
    $('#nowGame').textContent = o ? o.game : '';
    $('#nowSwatch').style.background = swatch(o);
    renderLayoutPick(); renderOverlays();
  }
  document.addEventListener('visibilitychange', () => {
    // stop the preview completely while the window is hidden or minimised
    const fr = $('#preview');
    if (document.documentElement.classList.contains('potato')) return;
    if (document.hidden) { fr.dataset.src = fr.getAttribute('src') || ''; fr.src = 'about:blank'; }
    else if (fr.dataset.src && !document.body.classList.contains('pv-collapsed')) { fr.src = fr.dataset.src; delete fr.dataset.src; }
  });

  // ------------------------------------------------------------ layouts tab
  function renderOverlays() {
    const games = [...new Set(overlays.map(o => o.game))];
    if (gameFilter !== 'all' && !games.includes(gameFilter)) gameFilter = 'all';
    $('#gameFilter').innerHTML = ['all', ...games].map(g => `<button class="chip ${g === gameFilter ? 'on' : ''}" data-g="${esc(g)}">${g === 'all' ? 'All games' : esc(g)}</button>`).join('');
    // a format version shows on its look's card (Shattered → Crew Battle, Death Battle…), not as a card of its own
    const isVer = o => o.base && overlays.some(b => b.name === o.base);
    const list = overlays.filter(o => (gameFilter === 'all' || o.game === gameFilter) && !isVer(o));
    $('#overlayList').innerHTML = list.map(o => {
      const FO = ['crew', 'sajam', 'gauntlet', 'death', 'koth', 'league'], vers = overlays.filter(v => v.base === o.name).sort((x, y) => FO.indexOf(x.format) - FO.indexOf(y.format)), liveVer = vers.find(v => v.name === active);
      const live = o.name === active || !!liveVer;
      return `<div class="lcard ${live ? 'active' : ''}">
        <div class="swatch" style="background:${swatch(o)}"><span class="g">${esc(o.game)}</span>${live ? '<span class="live">LIVE</span>' : ''}</div>
        <div class="lbody"><b>${esc(o.title)}${liveVer ? ` <small class="lver">· ${esc(liveVer.title.replace(/^.*?—\s*/, ''))}</small>` : ''}</b><p>${esc(o.description || `${o.files.length} file${o.files.length === 1 ? '' : 's'}`)}</p>
          ${vers.length ? `<div class="lvers" title="Each game format has its own version of this look. It switches by itself when you set up a format; click one to put it live now.">${vers.map(v => `<span class="lver-p"><button class="chip ${v.name === active ? 'on' : ''}" data-act="use" data-n="${esc(v.name)}">${esc(v.title.replace(/^.*?—\s*/, ''))}</button><button class="chip ghost lnk" data-act="url" data-n="${esc(v.name)}" title="Copy the OBS link that always shows ${esc(v.title)}">🔗</button></span>`).join('')}</div>` : ''}
          <div class="lacts">
            ${o.name === active ? '' : `<button class="btn sm primary" data-act="use" data-n="${esc(o.name)}">${liveVer ? 'Use without a format' : 'Use'}</button>`}
            ${info.local && o.designer ? `<button class="btn sm" data-act="design" data-n="${esc(o.name)}" title="Open it in the Layout Designer">🎨 Edit design</button>` : ''}
            ${info.local && !o.designer ? `<button class="btn sm" data-act="edit" data-n="${esc(o.name)}">Edit</button>` : ''}
            ${info.local && o.bundled && o.edited ? `<button class="btn sm ghost" data-act="restore" data-n="${esc(o.name)}" title="Put this layout back the way BeeboScore ships it — your edited version is kept as a copy">↺ Restore original</button>` : ''}
            ${info.local ? `
            <button class="btn sm ghost" data-act="dup" data-n="${esc(o.name)}">Duplicate</button>` : ''}
            <button class="btn sm ghost" data-act="url" data-n="${esc(o.name)}" title="Copy a link that always shows this layout">Link</button>
            ${live || !info.local || vers.length ? '' : `<button class="btn sm ghost danger" data-act="del" data-n="${esc(o.name)}" title="Delete">✕</button>`}
          </div></div></div>`;
    }).join('') || '<div class="empty"><b>No layouts for this game yet</b>Duplicate one or upload your own below.</div>';
  }
  $('#gameFilter').onclick = e => { const c = e.target.closest('.chip'); if (c) { gameFilter = c.dataset.g; renderOverlays(); } };
  async function loadOverlays() { overlays = await api('/api/overlays'); const a = overlays.find(o => o.active); if (a) active = a.name; refreshActive(); renderGamePick(); }
  $('#overlayList').onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const n = b.dataset.n;
    try {
      if (b.dataset.act === 'use') await setActive(n);
      if (b.dataset.act === 'edit') openEditor(n);
      if (b.dataset.act === 'design') openDesigner(n);
      if (b.dataset.act === 'restore' && confirm(`Put "${n}" back the way it came with BeeboScore?\n\nYour edited version won’t be lost — it’s kept as a separate layout.`)) { const r = await api(`/api/overlays/${encodeURIComponent(n)}/restore`, { method: 'POST' }); toast(`Original restored — your version is kept as “${r.kept}”`); }
      if (b.dataset.act === 'dup') askName('Duplicate layout', n + '-copy', n);
      if (b.dataset.act === 'url') copy(`${location.origin}/overlay/${encodeURIComponent(n)}`, 'Link to this layout copied');
      if (b.dataset.act === 'del' && confirm(`Delete layout "${n}" and all its files? This can't be undone.`)) { await api(`/api/overlays/${encodeURIComponent(n)}`, { method: 'DELETE' }); toast('Layout deleted'); }
    } catch (err) { toast(err.message, true); }
  };

  // the Layout Designer opens in its own window (docked beside this one in the desktop app)
  // the Layout Designer is built into the app: its own tab, the app's colours, the whole window
  let dzWin = null, dzWant = null;
  function designerFrame(edit) {
    const box = $('#dzFrame'); if (!box) return;
    let f = box.querySelector('iframe');
    const theme = document.documentElement.classList.contains('theme-shattered') ? 'shattered' : 'classic';
    if (!f) {
      f = document.createElement('iframe'); f.title = 'Layout Designer'; f.allow = 'clipboard-read; clipboard-write';
      f.src = '/designer?embed=1&theme=' + theme + (edit ? '&edit=' + encodeURIComponent(edit) : '');
      box.appendChild(f); dzWin = f.contentWindow; return;
    }
    if (edit) { try { f.contentWindow.postMessage({ type: 'beebo-designer-edit', name: edit }, location.origin); } catch {} }
  }
  function openDesigner(name) { showTab('designer'); if (name) designerFrame(name); }
  window.addEventListener('message', ev => {
    if (ev.origin !== location.origin || !ev.data) return;
    if (ev.data.type === 'beebo-designer-saved') { loadOverlays && loadOverlays(); loadScreens(); }
    if (ev.data.type === 'beebo-designer-theme?') { const f = $('#dzFrame iframe'); if (f) f.contentWindow.postMessage({ type: 'beebo-designer-theme', theme: document.documentElement.classList.contains('theme-shattered') ? 'shattered' : 'classic' }, location.origin); }
  });
  $('#openDesigner').onclick = () => openDesigner();

  let nameResolve = null;
  function askName(title, suggestion, from, uploadMode) {
    $('#nmTitle').textContent = title;
    $('#nmName').value = suggestion || '';
    $('#nmFromWrap').hidden = !!uploadMode;
    $('#nmGameWrap').hidden = !uploadMode;
    $('#nmFrom').innerHTML = overlays.map(o => `<option value="${esc(o.name)}" ${o.name === (from || 'shattered') ? 'selected' : ''}>${esc(o.title)} — ${esc(o.game)}</option>`).join('');
    $('#nmGame').innerHTML = ['Any game', ...gameList()].map(g => `<option ${draft && g === draft.game ? 'selected' : ''}>${esc(g)}</option>`).join('');
    $('#nmOk').textContent = uploadMode ? 'Upload' : 'Create';
    $('#nmHint').textContent = uploadMode ? 'Uploading into an existing layout name adds or replaces its files.' : 'Starts as a copy of the layout you pick. Edit it freely — the original stays as it is.';
    $('#nameModal').classList.add('open');
    setTimeout(() => $('#nmName').select(), 30);
    return new Promise(r => {
      nameResolve = uploadMode ? r : async v => {
        if (!v) return;
        try { const res = await api('/api/overlays/new', { method: 'POST', body: { name: v, from: $('#nmFrom').value } }); toast(`Created "${res.name}"`); await loadOverlays(); openEditor(res.name); }
        catch (e) { toast(e.message, true); }
      };
    });
  }
  function closeName(v) { $('#nameModal').classList.remove('open'); const r = nameResolve; nameResolve = null; if (r) r(v); }
  $('#nmCancel').onclick = () => closeName(null);
  $('#nmOk').onclick = () => closeName($('#nmName').value.trim());
  $('#nmName').onkeydown = e => { if (e.key === 'Enter') closeName($('#nmName').value.trim()); if (e.key === 'Escape') closeName(null); };
  $('#newOverlayBtn').onclick = () => askName('New layout', 'my-layout', 'shattered');

  const readB64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file); });
  // a .beebo file (exported from the Layout Designer): becomes a designer layout, ready to use and edit
  async function importBeebo(file) {
    try {
      const d = JSON.parse(await file.text()), design = d && (d.design || (d.scenes ? d : null));
      if (!design || !design.scenes) throw new Error('That isn’t a BeeboScore layout file');
      const base = String(design.title || file.name.replace(/\.beebo$/i, '')).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 44) || 'imported-layout';
      let name = base, n = 1, r = null;
      for (;;) { try { r = await api('/api/designs', { method: 'POST', body: { name, design, setActive: false, overwrite: false } }); break; } catch (e) { if (!/exists/i.test(e.message) || n > 20) throw e; name = `${base}-${++n}`; } }
      await loadOverlays(); toast(`Imported “${design.title || name}” — 🎨 Edit design to change it`);
    } catch (e) { toast(e.message || 'Couldn’t import that file', true); }
  }
  async function upload(list) {
    if (!list.length) return;
    const beebo = list.filter(f => /\.beebo$/i.test(f.path)); if (beebo.length) { for (const f of beebo) await importBeebo(f.file); list = list.filter(f => !/\.beebo$/i.test(f.path)); if (!list.length) return; }
    if (!list.some(f => /\.html?$/i.test(f.path))) return toast('Include at least one .html file', true);
    const tops = new Set(list.map(f => f.path.includes('/') ? f.path.split('/')[0] : ''));
    let folderName = '';
    if (tops.size === 1 && [...tops][0]) { folderName = [...tops][0]; list.forEach(f => { f.path = f.path.split('/').slice(1).join('/'); }); }
    const html = list.find(f => /\.html?$/i.test(f.path));
    const suggestion = (folderName || html.path.split('/').pop().replace(/\.html?$/i, '')).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');
    const name = await askName('Upload layout', suggestion, null, true);
    if (!name) return;
    try {
      toast('Uploading…');
      const files = await Promise.all(list.map(async f => ({ path: f.path, data: await readB64(f.file) })));
      const game = $('#nmGame').value;
      const res = await api('/api/overlays/upload', { method: 'POST', body: { name, files, game: game === 'Any game' ? '' : game } });
      toast(`Uploaded "${res.name}"`);
      await loadOverlays();
      if (confirm(`Show "${res.name}" in OBS now?`)) await setActive(res.name);
    } catch (e) { toast('Upload failed: ' + e.message, true); }
  }
  $('#pickFiles').onclick = e => { e.stopPropagation(); $('#fileInput').click(); };
  $('#pickFolder').onclick = e => { e.stopPropagation(); $('#folderInput').click(); };
  $('#drop').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = e => { upload([...e.target.files].map(f => ({ file: f, path: f.name }))); e.target.value = ''; };
  $('#folderInput').onchange = e => { upload([...e.target.files].map(f => ({ file: f, path: f.webkitRelativePath || f.name }))); e.target.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    const entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const out = [];
    const walk = (entry, prefix) => new Promise(res => {
      if (entry.isFile) entry.file(f => { out.push({ file: f, path: prefix + f.name }); res(); }, res);
      else {
        const reader = entry.createReader(); const all = [];
        const next = () => reader.readEntries(async batch => { if (!batch.length) { for (const c of all) await walk(c, prefix + entry.name + '/'); res(); } else { all.push(...batch); next(); } }, res);
        next();
      }
    });
    if (entries.length) { for (const en of entries) await walk(en, ''); } else out.push(...[...e.dataTransfer.files].map(f => ({ file: f, path: f.name })));
    upload(out);
  });

  // ------------------------------------------------------------ editor
  let editing = null, edPath = 'index.html', edTimer = null, edLoaded = '';
  function refreshEditorFiles() {
    const o = overlays.find(x => x.name === editing);
    const files = (o ? o.files : ['index.html']).filter(f => TEXT_EXT.test(f));
    $('#edFile').innerHTML = files.map(f => `<option ${f === edPath ? 'selected' : ''}>${esc(f)}</option>`).join('');
  }
  async function openEditor(name, file = 'index.html') {
    editing = name; edPath = file;
    const o = overlays.find(x => x.name === name);
    $('#edTitle').textContent = o ? o.title : name;
    refreshEditorFiles();
    await loadFile();
    $('#edPreview').src = `/overlay/${encodeURIComponent(name)}?preview`;
    $('#editorModal').classList.add('open');
    requestAnimationFrame(scaleFrames);
    $('#edText').focus();
  }
  async function loadFile() {
    try { edLoaded = await api(`/api/overlays/${encodeURIComponent(editing)}/file?path=${encodeURIComponent(edPath)}`); $('#edText').value = edLoaded; edStatus(''); }
    catch (e) { toast(e.message, true); }
  }
  async function saveFile() {
    clearTimeout(edTimer);
    const text = $('#edText').value;
    if (text === edLoaded || !editing) return;
    edStatus('Saving…');
    try { await api(`/api/overlays/${encodeURIComponent(editing)}/file?path=${encodeURIComponent(edPath)}`, { method: 'PUT', body: text }); edLoaded = text; edStatus('Saved · OBS updated', 'ok'); }
    catch (e) { edStatus('Save failed: ' + e.message, 'err'); }
  }
  function edStatus(t, cls) { const el = $('#edSave'); el.textContent = t; el.className = 'ed-save ' + (cls || ''); }
  $('#edText').addEventListener('input', e => { e.stopPropagation(); edStatus('Unsaved'); if ($('#edAuto').checked) { clearTimeout(edTimer); edTimer = setTimeout(saveFile, 700); } });
  $('#edText').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); }
    if (e.key === 'Tab') { e.preventDefault(); insertAtCursor('  '); }
  });
  function insertAtCursor(txt) { const ta = $('#edText'); ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
  $('#edAuto').checked = store('autosave') !== '0';
  $('#edAuto').onchange = e => store('autosave', e.target.checked ? '1' : '0');
  $('#edFile').onchange = async e => { await saveFile(); edPath = e.target.value; loadFile(); };
  $('#edSaveBtn').onclick = saveFile;
  $('#edFolder').onclick = () => api(`/api/overlays/${encodeURIComponent(editing)}/open-folder`, { method: 'POST' }).then(r => toast('Opened ' + r.path)).catch(e => toast(e.message, true));
  $('#edClose').onclick = async () => { await saveFile(); $('#editorModal').classList.remove('open'); editing = null; $('#edPreview').src = 'about:blank'; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#editorModal').classList.contains('open')) { e.preventDefault(); $('#edClose').click(); } });   // closing saves first
  const REFS = [
    ['P1 name', '<span data-sb="p1.name" data-sb-fit="40,20"></span>'], ['P1 score', '<span data-sb="p1.score" data-sb-scored="p1"></span>'],
    ['P1 team', '<span data-sb="p1.team"></span>'], ['P1 flag', '<img data-sb-src="p1.flagUrl">'], ['P1 pips', '<div data-sb-pips="p1"></div>'],
    ['P1 [L]', '<span data-sb-show="p1.loser">[L]</span>'], ['P1 char art', '<img data-sb-src="chars/{p1.characterSlug}.png">'],
    ['P2 name', '<span data-sb="p2.name" data-sb-fit="40,20"></span>'], ['P2 score', '<span data-sb="p2.score" data-sb-scored="p2"></span>'],
    ['P2 team', '<span data-sb="p2.team"></span>'], ['P2 flag', '<img data-sb-src="p2.flagUrl">'], ['P2 pips', '<div data-sb-pips="p2"></div>'],
    ['P2 [L]', '<span data-sb-show="p2.loser">[L]</span>'], ['Round', '<span data-sb="round"></span>'], ['Best of', '<span data-sb="bestOfText"></span>'],
    ['Game', '<span data-sb="game"></span>'], ['Event', '<span data-sb="event"></span>'], ['Casters', '<span data-sb="commentators"></span>'],
    ['Custom', '<span data-sb="custom.field1"></span>'],
  ];
  $('#refButtons').innerHTML = REFS.map(([t, c], i) => `<button data-i="${i}" title="${esc(c)}">${esc(t)}</button>`).join('');
  $('#refButtons').onclick = e => { const b = e.target.closest('button'); if (b) insertAtCursor(REFS[b.dataset.i][1]); };

  // ------------------------------------------------------------ stream tab
  function fallbackCopy(text, done) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); }
  function copy(text, msg) {
    const done = () => toast(msg || 'Copied');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy($('#' + b.dataset.copy).value, b.dataset.copy === 'obsUrl' ? 'OBS URL copied — paste it into a Browser Source' : 'Link copied'); });
  $('#obsUrl').value = location.origin + '/overlay';
  $('#openOutput').onclick = e => { e.preventDefault(); api('/api/open-output', { method: 'POST' }).catch(err => toast(err.message, true)); };
  $('#logoutBtn').onclick = async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); location.href = '/login'; };

  // ------------------------------------------------------------ autocomplete
  function refreshChars() { const chars = [...new Set(players.map(p => p.character).filter(Boolean))].sort(); $('#charList').innerHTML = chars.map(c => `<option value="${esc(c)}">`).join(''); }
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
          ${p.country ? `<img src="https://flagcdn.com/w40/${esc(p.country)}.png" alt="" onerror="this.style.visibility='hidden'">` : ''}
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
  $('#sggSignout').onclick = async () => { if (!confirm('Sign out of start.gg in BeeboScore? The saved sign-in is deleted from this PC.')) return; try { sgg = await api('/api/startgg/signout', { method: 'POST' }); renderSgg(); toast('Signed out of start.gg'); } catch (e) { toast(e.message, true); } };
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
  function renderSets() {
    const q = norm($('#sggFilter').value);
    const list = sets.filter(s => !q || norm((s.p1 && s.p1.displayName) + ' ' + (s.p2 && s.p2.displayName) + ' ' + s.round).includes(q));
    $('#sggSets').innerHTML = list.length ? list.map(s => `
      <div class="set ${s.id === loadedSetId ? 'loaded' : ''}">
        <div class="set-meta"><b>${esc(s.round || 'Match')}</b>${s.identifier ? `<span>${esc(s.identifier)}</span>` : ''}${s.pool ? `<span>Pool ${esc(s.pool)}</span>` : ''}${s.stream ? `<span>📺 ${esc(s.stream)}</span>` : ''}${s.stateText ? `<span class="st st-${s.state}">${esc(s.stateText)}</span>` : ''}</div>
        <div class="set-vs"><span>${slotName(s.p1)}</span><i>vs</i><span>${slotName(s.p2)}</span></div>
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
  $('#sggRefreshSets').onclick = loadSets;
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
    if (st === 'online') { $('#pubOverlay').value = tunnel.url + '/overlay'; $('#pubControl').value = tunnel.url + '/'; }
  }
  $('#pwShow').onclick = () => { const i = $('#pwInput'); i.type = i.type === 'password' ? 'text' : 'password'; $('#pwShow').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
  $('#pwGen').onclick = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const a = new Uint32Array(16); crypto.getRandomValues(a);
    const pw = [...a].map(x => chars[x % chars.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
    $('#pwInput').value = pw; $('#pwInput').type = 'text'; $('#pwShow').textContent = 'Hide';
    copy(pw, 'Strong password generated and copied — click Save to use it');
  };
  $('#signoutAll').onclick = async () => {
    if (!confirm('Sign out every phone and PC that is signed in remotely?')) return;
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
    $('#setShowAutoscore').checked = !!settings.showAutoscore; showAutoscoreTab(!!settings.showAutoscore);
    $('#setRefreshReset').checked = settings.refreshOnReset !== false;
    $('#setAutoVictory').checked = settings.autoVictory !== false;
    $('#setVictoryHold').value = String(settings.victoryHold ?? '8');
    renderSound();
    $('#setPotato').checked = !!settings.potatoMode;
    potatoPreview();
    renderKeys();
    $('#setLanNoPw').checked = settings.lanNoPassword !== false;
  }
  async function saveSettings(patch, msg) {
    try { settings = await api('/api/settings', { method: 'POST', body: patch }); renderSettings(); if (msg) toast(msg); } catch (e) { toast(e.message, true); }
  }
  $('#setAutoSwitch').onchange = e => saveSettings({ autoSwitchLayout: e.target.checked });
  $('#setFollowFormat').onchange = e => saveSettings({ followFormat: e.target.checked });
  $('#setShowAutoscore').onchange = e => saveSettings({ showAutoscore: e.target.checked }, e.target.checked ? '🧪 Autoscore tab shown' : 'Autoscore tab hidden');
  function showAutoscoreTab(on) {            // Autoscore is still experimental: hidden unless Settings › Look & feel turns it on
    const b = $('nav.rail button[data-tab="autoscore"]'); if (b) b.hidden = !on;
    if (!on && $('main .tab[data-tab="autoscore"].on')) showTab('match');
  }
  $('#setAutoVictory').onchange = e => saveSettings({ autoVictory: e.target.checked }, e.target.checked ? 'The victory splash will show when a set ends' : 'The victory splash only shows when you ask');
  $('#setVictoryHold').onchange = e => saveSettings({ victoryHold: e.target.value }, e.target.value === '0' ? 'The victory splash stays up until you hide it' : `The victory splash hides after ${e.target.value} s`);
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
  $('#setSoundOn').onchange = e => saveSettings({ soundOn: e.target.checked }, e.target.checked ? '🔊 Layouts play sound on stream — tick “Control audio via OBS” on the browser source' : '🔇 Layouts are silent on stream');
  $('#setSoundVol').oninput = e => { $('#setSoundVolV').textContent = e.target.value + '%'; fillRange(e.target); };
  $('#setSoundVol').onchange = e => { saveSettings({ soundVolume: e.target.value }); if (BS) BS.play('point', { pack: $('#sndPack').value, force: true }); };
  function renderPvSound() {
    if (!BS) { $('#pvSnd').hidden = true; return; }
    const p = BS.prefs(); $('#pvVol').value = p.vol; $('#pvVolV').textContent = p.muted ? 'muted' : p.vol + '%'; fillRange($('#pvVol'));
    $('#pvMute').textContent = p.muted || !p.vol ? '🔇' : p.vol < 40 ? '🔉' : '🔊'; $('#pvMute').title = p.muted ? 'Unmute the preview' : 'Mute the preview';
    $('#pvSnd').classList.toggle('muted', !!p.muted);
  }
  // the preview's level lives in this browser only (the overlays in the preview read it straight away)
  const pvApply = () => { const f = $('#preview'); try { const w = f.contentWindow, inner = w && w.document.querySelector('iframe:not(.next)'); for (const x of [w, inner && inner.contentWindow]) if (x && x.BeeboSound) x.BeeboSound.apply(); } catch (e) {} };
  $('#pvVol').oninput = e => { BS.setPrefs({ vol: Number(e.target.value), muted: false }); renderPvSound(); pvApply(); };
  $('#pvVol').onchange = () => BS.play('point', { pack: (overlays.find(x => x.name === active) || {}).sound || 'shattered', force: true });
  $('#pvMute').onclick = () => { BS.setPrefs({ muted: !BS.prefs().muted }); renderPvSound(); pvApply(); };
  addEventListener('storage', e => { if (e.key === 'beebo.sound.preview2') renderPvSound(); });
  function renderSoundTest() {
    if (!BS) return;
    const pack = $('#sndPack').value, g = $('#sndGrid'); g.innerHTML = '';
    for (const n of BS.names(pack)) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = '▶ ' + (BS.labels[n] || n); b.onclick = () => BS.play(n, { pack, force: true }); g.appendChild(b); }
  }
  $('#sndPack').onchange = renderSoundTest;
  $('#setObsVolume').onchange = e => saveSettings({ obsVolume: e.target.checked }, e.target.checked ? 'Set the level with the source’s fader in the OBS mixer' : 'Stream volume is set here again');
  $('#sndDock').onclick = () => copy(`${location.origin}/dock`, 'Dock link copied — in OBS: Docks › Custom Browser Docks…');
  $('#sndObs').onclick = async () => {     // every browser source showing a BeeboScore overlay: "Control audio via OBS" on
    const txt = $('#sndObsTxt'); txt.textContent = 'Talking to OBS…';
    try {
      if (!window.OBSWebSocket) throw new Error('The OBS connector didn’t load.');
      const cfg = await api('/api/autoscore'); let pw = '';
      if (cfg.hasPassword) { try { pw = (await api('/api/autoscore/secret')).obsPassword || ''; } catch (e) {} }
      const obs = new window.OBSWebSocket(); await obs.connect(cfg.obsUrl || 'ws://127.0.0.1:4455', pw || undefined);
      try {
        const { inputs } = await obs.call('GetInputList', { inputKind: 'browser_source' }); let n = 0, fixed = 0;
        for (const i of inputs) {
          const { inputSettings: st } = await obs.call('GetInputSettings', { inputName: i.inputName });
          if (!/\/overlay(\/|\?|$)/.test(String(st.url || ''))) continue; n++;
          if (!st.reroute_audio) { await obs.call('SetInputSettings', { inputName: i.inputName, inputSettings: { reroute_audio: true } }); fixed++; }
        }
        txt.textContent = !n ? '❌ No browser source in OBS shows a BeeboScore layout yet.' : fixed ? `✅ Fixed ${fixed} of ${n} source${n > 1 ? 's' : ''} — set the level in the OBS mixer.` : `✅ All ${n} source${n > 1 ? 's' : ''} can be heard in OBS.`;
      } finally { try { obs.disconnect(); } catch (e) {} }
    } catch (e) { txt.textContent = '❌ Couldn’t reach OBS — open OBS and turn on Tools → WebSocket Server Settings (the Autoscore tab has the address and password).'; }
  };
  renderPvSound(); renderSoundTest();
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
  // Restart & update: the window is about to close and stay closed while the new exe unpacks itself (its own starting screen takes over
  // after a second or so). Say so first, so a closed window is not the only sign that anything is happening.
  const installNow = async () => {
    if (dirty && !confirm('You have unsent changes. Restart and update anyway?')) return;
    if ($('#updOver')) return;
    const v = upd.newVersion || '', o = document.createElement('div'); o.id = 'updOver'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-live', 'assertive');
    o.style.cssText = 'position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:24px;background:rgba(4,5,9,.9);text-align:center';
    o.innerHTML = `<div style="max-width:460px"><div style="font-size:22px;font-weight:800;color:var(--text)">Installing BeeboScore ${esc(v)}</div>`
      + `<p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:var(--text)">This window will close and BeeboScore will open again by itself. It can take up to 20 seconds.</p>`
      + `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--muted)">If it does not open again, start BeeboScore-${esc(v)}.exe from the folder your current exe is in.</p></div>`;
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
  $('#winNextMatch').onclick = () => {
    const nx = nextSet(); if (!nx) return;
    const btn = document.createElement('button'); btn.dataset.set = nx.id; document.body.appendChild(btn); btn.click(); btn.remove();
    push();
  };

  // viewer matches from a keyboard shortcut (the Twitch tab has the buttons)
  const viewerKey = b => api('/api/remote/action', { method: 'POST', body: b }).catch(e => toast(e.message, true));
  // shared with the Twitch Stuff tab (twitch-panel.js)
  window.BeeboPanel = { saveSettings: (b, m) => saveSettings(b, m), store: (k, v) => store(k, v), api, toast, esc, copy: (t, m) => copy(t, m), info: () => info, autocomplete: (i, fn) => setupAutocomplete(i, fn), state: () => server, showTab: n => showTab(n), overlays: () => overlays, players: () => players, active: () => active };

  // ------------------------------------------------------------ realtime
  function handle(msg) {
    const d = msg.data;
    switch (msg.type) {
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
      case 'vt': window.dispatchEvent(new CustomEvent('beebo:vt', { detail: d })); break;
      case 'streamdeck-notice': window.dispatchEvent(new CustomEvent('beebo:streamdeck', { detail: d })); break;   // streamdeck-panel.js
      case 'overlays': loadScreens(); overlays = d; { const a = overlays.find(o => o.active); if (a) active = a.name; } refreshActive(); renderGamePick(); if (editing) refreshEditorFiles(); break;
      case 'config': if (d.activeOverlay !== active) { active = d.activeOverlay; refreshActive(); loadScreens(); } break;
      case 'players': players = d; refreshChars(); break;
      case 'startgg': sgg = d; renderSgg(); break;
      case 'startgg-auth': if (d.ok) toast(`Signed in to start.gg${d.name ? ' as ' + d.name : ''}`); else toast(d.error || 'start.gg sign-in failed', true); mineAt = 0; loadSgg(); break;
      case 'startgg-progress': $('#sggCount').textContent = `Importing… ${d.page}/${d.total}`; break;
      case 'settings': settings = d; renderSettings(); break;
      case 'potato': potatoPreview(d.ver); break;
      case 'sgg-reports': window.dispatchEvent(new CustomEvent('beebo:sggreports', { detail: d })); break;   // report-panel.js
      case 'latency': window.dispatchEvent(new CustomEvent('beebo:latency', { detail: d })); break;   // drawn by latency-panel.js
      case 'twitch': window.dispatchEvent(new CustomEvent('beebo:twitch', { detail: d })); break;
      case 'autoscore': case 'autoscore-cmd': window.dispatchEvent(new CustomEvent('beebo:' + msg.type, { detail: d })); break;
      case 'tunnel': { const was = tunnel.state; tunnel = d; renderTunnel(); window.dispatchEvent(new CustomEvent('beebo:tunnel', { detail: d })); if (d.state === 'online' && was !== 'online') toast("You're online — copy your links in the Stream tab"); break; }
      case 'update': { const was = upd.state; upd = d; renderUpdate(); if (d.state === 'ready' && was !== 'ready') toast(`Update ${d.newVersion} downloaded`); break; }
      case 'reload':
        if (editing && d.overlay === editing && $('#edText').value === edLoaded) {
          api(`/api/overlays/${encodeURIComponent(editing)}/file?path=${encodeURIComponent(edPath)}`).then(t => {
            if ($('#edText').value === edLoaded && t !== edLoaded) { const pos = $('#edText').selectionStart; edLoaded = t; $('#edText').value = t; $('#edText').selectionStart = $('#edText').selectionEnd = pos; }
          }).catch(() => {});
        }
        break;
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
  function connect() {
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch { startPolling(); return; }
    const fallback = setTimeout(() => { if (!wsOk) startPolling(); }, 4000);
    ws.onmessage = e => {
      if (!wsOk) { wsOk = everOk = true; clearTimeout(fallback); stopPolling(); setStatus(true, 'Connected'); }
      try { handle(JSON.parse(e.data)); } catch (err) { console.error(err); }
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
      if (false && info.testBuild && !$('#testPill')) { $('.brand b').insertAdjacentHTML('afterend', '<span id="testPill" title="Portable beta build: separate data, never auto-updates" style="margin-left:8px;font:700 10px/1 inherit;letter-spacing:1.5px;padding:4px 7px;border-radius:6px;background:#ffb020;color:#111">BETA</span>'); document.title = 'BeeboScore Beta'; }
      $('#aboutText').textContent = `Version ${info.version} · Developed by Beebo`;
      const lan = info.local ? info.urls.slice(1) : [];
      if (lan.length) $('#lanInfo').innerHTML = `Control from a phone or tablet on the same Wi-Fi: ${lan.map(u => `<code>${esc(u)}</code>`).join(' ')}`;
      if (info.local) { loadAuth(); loadUpdate(); setInterval(() => !document.hidden && loadAuth(), 15000); }
      else { $('#miniBtn').hidden = true; if (info.lan) $('#logoutBtn').hidden = true; }
    } catch {}
    try { settings = await api('/api/settings'); renderSettings(); } catch {}
    try { server = await api('/api/state'); draft = clone(server); render(); renderWin(); } catch {}
    await loadOverlays().catch(e => toast(e.message, true));
    loadPlayers();
    loadSgg().then(() => { if (sgg.tournament && sgg.eventId) loadSets(); });
    connect();
  })();
})();
