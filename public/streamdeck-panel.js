/* BeeboScore — Settings › Stream Deck: is the Stream Deck app new enough, is the plugin installed and up to date
 * (split out of panel.js). */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast } = P, store = P.store, saveSettings = P.saveSettings;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  // Stream Deck: is the app new enough, is our plugin installed, is it the latest?
  let sd = null, sdWatch = 0;
  const vShort = v => String(v || '').replace(/(\.0)+$/, '').replace(/^(\d+\.\d+\.\d+)\.\d+$/, '$1');
  async function loadSD() {
    let d; try { d = await api('/api/streamdeck'); } catch { return; }
    const was = sd; sd = d;
    $('#sdPill').className = 'pill' + (d.connected ? ' on' : '');
    $('#sdPill').textContent = d.connected ? 'Connected' : 'Not connected';
    const dot = (id, cls) => { $(id).className = 'sd-dot' + (cls ? ' ' + cls : ''); };
    // the Stream Deck app
    if (!d.supported) { dot('#sdAppDot', ''); $('#sdAppTxt').textContent = 'Can’t check on this system.'; $('#sdGetApp').hidden = true; }
    else if (!d.appFound) { dot('#sdAppDot', 'bad'); $('#sdAppTxt').textContent = 'Not installed on this PC.'; $('#sdGetApp').hidden = false; }
    else if (d.appTooOld) { dot('#sdAppDot', 'warn'); $('#sdAppTxt').textContent = `Version ${vShort(d.appVersion)} — the plugin needs ${d.minApp} or newer. Update Stream Deck first.`; $('#sdGetApp').hidden = false; }
    else { dot('#sdAppDot', 'ok'); $('#sdAppTxt').textContent = d.appVersion ? `Version ${vShort(d.appVersion)}` : 'Installed'; $('#sdGetApp').hidden = true; }
    // our plugin
    const btn = $('#sdInstall');
    if (!d.bundled) { dot('#sdPlugDot', 'bad'); $('#sdPlugTxt').textContent = 'The plugin file is missing from this build.'; btn.hidden = true; }
    else if (!d.installed) { dot('#sdPlugDot', ''); $('#sdPlugTxt').textContent = `Not installed — version ${vShort(d.bundledVersion)} is ready.`; btn.textContent = 'Install'; btn.className = 'btn sm primary local-only'; btn.hidden = !d.canInstall; }
    else if (d.outdated) { dot('#sdPlugDot', 'warn'); $('#sdPlugTxt').textContent = `Version ${vShort(d.installedVersion)} installed — ${vShort(d.bundledVersion)} is ready.`; btn.textContent = 'Update'; btn.className = 'btn sm primary local-only'; btn.hidden = !d.canInstall; }
    else { dot('#sdPlugDot', 'ok'); $('#sdPlugTxt').textContent = `Up to date (${vShort(d.installedVersion || d.bundledVersion)})${d.connected ? ' and connected' : ''}.`; btn.textContent = 'Reinstall'; btn.className = 'btn sm ghost local-only'; btn.hidden = !d.canInstall; }
    btn.disabled = !!d.appTooOld || (d.supported && !d.appFound && !d.connected);
    btn.title = d.appTooOld ? `Update the Stream Deck app to ${d.minApp} or newer first` : '';
    $('#setSdAuto').checked = d.autoUpdate !== false;
    // your deck(s), seen by the plugin, and Set up Stream Deck (1.12)
    const su = d.setup || {}, decks = su.devices || [];
    const fits = decks.filter(x => x.profile);
    dot('#sdDeckDot', !d.connected ? '' : fits.length ? 'ok' : decks.length ? 'warn' : '');
    $('#sdDeckTxt').textContent = !d.connected ? 'Open the Stream Deck app (with the plugin installed) to see your deck here.'
      : !decks.length ? 'No Stream Deck plugged in.'
      : decks.map(x => `${x.name}${x.cols ? ` (${x.cols * x.rows} keys)` : ''}`).join(', ') + (fits.length ? (su.done ? ' — set up ✓' : '') : ' — no ready-made layout for this one: drag “BeeboScore Lite key” onto any key and it picks the right job for its place.');
    $('#sdSetup').disabled = !d.connected;
    paintMap();
    // banner: something the person has to do in the Stream Deck app
    const snooze = store('sdBannerLater') || '';
    const need = d.canInstall && d.appTooOld && (d.outdated || !d.installed);
    $('#sdBanner').hidden = !(need && snooze !== d.bundledVersion && (P.info() || {}).local !== false);
    if (need) $('#sdBannerText').textContent = `Stream Deck ${vShort(d.appVersion)} is too old for the BeeboScore Lite plugin ${vShort(d.bundledVersion)}. Update the Stream Deck app (${d.minApp} or newer)${d.autoUpdate !== false ? ' and BeeboScore Lite will update the plugin for you.' : ', then click Update in Settings › Stream Deck.'}`;
    // finished updating?
    if (sdWatch && was && d.upToDate && (!was.upToDate || was.installedVersion !== d.installedVersion)) {
      toast(`Stream Deck plugin ${was.installed ? 'updated to' : 'installed:'} ${vShort(d.installedVersion)} ✓`); sdWatch = 0;
    }
  }
  async function installSD() {
    try {
      const r = await api('/api/streamdeck/install', { method: 'POST', body: {} });
      toast(r.action === 'update' ? 'Updating the plugin — click Install in the Stream Deck window that opens' : r.action === 'install' ? 'Installing — click Install in the Stream Deck window that opens' : 'Reinstalling the plugin in Stream Deck');
      watchSD();
    } catch (e) { toast(e.message, true); loadSD(); }
  }
  function watchSD() {                   // check often for a minute so the result shows up right away
    sdWatch = Date.now();
    const tick = () => { if (!sdWatch || Date.now() - sdWatch > 60000) { sdWatch = 0; return; } loadSD(); setTimeout(tick, 1500); };
    setTimeout(tick, 1500);
  }
  // Set up Stream Deck: the plugin asks Stream Deck to show the BeeboScore profile (Stream Deck asks once to add it)
  $('#sdSetup').onclick = async () => {
    const b = $('#sdSetup'); b.disabled = true;
    try {
      await api('/api/streamdeck/setup', { method: 'POST', body: {} });
      toast('Sent to your Stream Deck — if Stream Deck asks to add the BeeboScore Lite profile, click Add');
      for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 700)); await loadSD(); if (sd && sd.setup && sd.setup.done) break; }
      if (sd && sd.setup && sd.setup.done && !(sd.setup.sent || []).length) toast('Your Stream Deck has no ready-made layout — drag “BeeboScore Lite key” onto its keys instead', true);
    } catch (e) { toast(e.message, true); }
    b.disabled = false;
  };
  // the key map: what each key of an XL does right now (mirrors streamdeck/src/slots.js)
  const MATCH = '#ffb020', STREAM = '#29c6ff', BRACKET = '#4f7dff', FORMAT = '#ff6a1a';
  // (BeeboScore Lite: no viewer events, Twitch or show keys — row 4 is the set as it's told)
  const ROWS = [
    [['P1 name', MATCH], ['P1 +1', MATCH], ['Swap', MATCH], ['P2 +1', MATCH], ['P2 name', MATCH], ['Undo', MATCH], ['Reset · hold: next set', MATCH], ['Refresh OBS', STREAM]],
    [['FullVS', MATCH], ['GlassVS', MATCH], ['Victory', MATCH], ['Bracket', BRACKET], ['Top 8', BRACKET], ['Standings', BRACKET], ['VS style', MATCH], ['Hide all', STREAM]],
    null,
    [['Moments', MATCH], ['Replay moment', MATCH], ['Head-to-head', MATCH], ['Set timer', MATCH], ['Stats strip', MATCH], ['Bracket reset', MATCH], ['P1 stats', STREAM], ['P2 stats', STREAM]]];
  const SIDE = {     // row 3 follows the app
    solo: [['Next match', BRACKET], ['Report', BRACKET], ['W / L side', BRACKET], ['P1 [L]', MATCH], ['P2 [L]', MATCH], ['Next set', MATCH], ['Effects quality', STREAM], ['VS style', MATCH]],
    format: [['Confirm', FORMAT], ['Board', FORMAT], ['Team VS', FORMAT], ['Champion', FORMAT], ['Format bar', FORMAT], ['Undo result', FORMAT], ['Next match', BRACKET], ['Report', BRACKET]],
    tdb: [['Confirm', FORMAT], ['Switch in 1', FORMAT], ['Switch in 2', FORMAT], ['Lock in', FORMAT], ['Board', FORMAT], ['Team VS', FORMAT], ['Champion', FORMAT], ['Format bar', FORMAT]],
    koth: [['Confirm', FORMAT], ['Board', FORMAT], ['Leaderboard', FORMAT], ['Champion', FORMAT], ['Format bar', FORMAT], ['Undo result', FORMAT], ['Next match', BRACKET], ['Report', BRACKET]],
  };
  // "Everything, in pages" (mirrors XL_PAGES in streamdeck/src/slots.js): rows 1–2 stay, rows 3–4 turn with the ▸ key
  const PG = ['▸ Next page', STREAM];
  const PAGES = [
    { name: 'Page 1 · Match', rows: [[...SIDE.solo.slice(0, 7), PG], ROWS[3]] },
    { name: 'Page 2 · Formats', rows: [[['Confirm', FORMAT], ['Board', FORMAT], ['Team VS', FORMAT], ['Champion', FORMAT], ['Leaderboard', FORMAT], ['Format bar', FORMAT], ['Undo result', FORMAT], PG],
      [['Switch in 1', FORMAT], ['Lock in', FORMAT], ['Switch in 2', FORMAT], ['Unlock', FORMAT], ['Next match', BRACKET], ['Report', BRACKET], ['Top 8', BRACKET], ['Standings', BRACKET]]] },
  ];
  const sdModeNow = () => ((P.settings && P.settings()) || {}).sdLayout === 'all' ? 'all' : 'follow';
  let mapKey = '';
  function paintMap() {
    const f = (P.state && P.state()) ? P.state().format : null, mode = sdModeNow();
    const sec = !f ? 'solo' : f.preset === 'koth' || (f.rules && f.rules.mode === 'koth') ? 'koth' : f.preset === 'tdb' || (f.rules && f.rules.mode === 'tdb') ? 'tdb' : 'format';
    $$('#sdMode [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    if (mode + sec === mapKey) return; mapKey = mode + sec;
    const cell = ([t, k], side) => `<i class="${side ? 'side' : ''}" style="--k:${k}" title="${t}">${t}</i>`;
    if (mode === 'all') {
      $('#sdMap').innerHTML = PAGES.map(pg => `<b class="sd-pg">${pg.name}</b>` + [ROWS[0], ROWS[1], ...pg.rows].map((row, r) => row.map(c => cell(c, r > 1)).join('')).join('')).join('');
      $('#sdMapNow').textContent = '(Stream Deck XL · everything, in pages)'; fitMap(); return;
    }
    $('#sdMap').innerHTML = ROWS.map((row, r) => row ? row.map(c => cell(c)).join('') : SIDE[sec].map(c => cell(c, true)).join('')).join('');
    $('#sdMapNow').textContent = `(Stream Deck XL · ${sec === 'solo' ? '1v1' : sec === 'tdb' ? 'Team Death Battle' : sec === 'koth' ? 'King of the Hill' : 'format running'})`;
    fitMap();
  }
  // 1.12.21: every key's name fits its key, whole — a size down at a time until it does (1.12.20 set long words smaller and let them
  // break anywhere: “Commentar-y”, “Leaderboar-d”; “Countdown”, a letter short of that rule, was cut). Measured, so it holds in every
  // theme's lettering; the map is folded away until it's opened, so it's fitted then, and again when the window changes size.
  function fitMap() {
    const m = $('#sdMap'); if (!m || !m.offsetWidth) return;
    const cells = [...m.children].filter(c => c.tagName === 'I'); cells.forEach(c => { c.style.fontSize = ''; c.style.letterSpacing = ''; });
    const big = c => c.scrollWidth > c.clientWidth + .5 || c.scrollHeight > c.clientHeight + .5;
    for (const c of cells.filter(big)) { let px = 10.5; c.style.letterSpacing = '-.2px'; while (px > 7 && big(c)) { px -= .5; c.style.fontSize = px + 'px'; } }
  }
  { const box = $('#sdMapBox'), m = $('#sdMap'); if (box) box.addEventListener('toggle', () => { if (box.open) fitMap(); }); let t = 0; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fitMap, 160); }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMap);
    // …and when the map comes back into view having been redrawn out of sight (a format started while another tab was open)
    if (m && typeof ResizeObserver === 'function') { let w = 0; new ResizeObserver(() => { const now = m.offsetWidth; if (now && now !== w) fitMap(); w = now; }).observe(m); } }
  window.addEventListener('beebo:state', paintMap);
  window.addEventListener('beebo:settings', () => { mapKey = ''; paintMap(); });
  $$('#sdMode [data-m]').forEach(b => b.onclick = () => { if (sdModeNow() === b.dataset.m) return; saveSettings({ sdLayout: b.dataset.m }, b.dataset.m === 'all' ? 'Stream Deck: every key, in pages — ▸ turns the page' : 'Stream Deck: the keys change with the format'); setTimeout(() => { mapKey = ''; paintMap(); }, 400); });
  $('#sdInstall').onclick = installSD;
  $('#setSdAuto').onchange = e => saveSettings({ sdAutoUpdate: e.target.checked }, e.target.checked ? 'The Stream Deck plugin will update itself' : 'Stream Deck plugin updates are up to you');
  $('#sdBannerLater').onclick = () => { store('sdBannerLater', (sd && sd.bundledVersion) || '1'); $('#sdBanner').hidden = true; };
  setInterval(() => { if (!document.hidden) loadSD(); }, 5000);
  setTimeout(loadSD, 800);
  window.addEventListener('beebo:streamdeck', e => { const d = e.detail || {};
    if (d.kind === 'updating') { toast(`Updating the Stream Deck plugin to ${vShort(d.bundledVersion)} — click Install in the Stream Deck window`); watchSD(); }
    loadSD(); });

})();
