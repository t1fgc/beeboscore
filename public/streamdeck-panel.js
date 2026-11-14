/* BeeboScore — Settings › Stream Deck: is the Stream Deck app here, is the BeeboScore plugin installed and connected,
 * install / update it, and "Set up my Stream Deck": puts the BeeboScore layout on every Stream Deck that is plugged in
 * (one for the 15-key Stream Deck, one for the 32-key Stream Deck XL). The layout's format keys change with the format. */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const $ = id => document.getElementById(id);
  const card = $('sdCard'); if (!card) return;
  const pill = $('sdPill'), appDot = $('sdAppDot'), appTxt = $('sdAppTxt'), getApp = $('sdGetApp');
  const plugDot = $('sdPlugDot'), plugTxt = $('sdPlugTxt'), install = $('sdInstall'), auto = $('setSdAuto');
  const setupBtn = $('sdSetup'), setupTxt = $('sdSetupTxt'), setupDot = $('sdSetupDot');
  let st = null, busy = false, waitN = 0, waitUntil = 0, timer = 0;

  const dot = (el, cls) => { if (el) el.className = 'sd-dot' + (cls ? ' ' + cls : ''); };
  function draw() {
    const s = st; if (!s) return;
    // the Stream Deck app
    if (s.connected || s.appFound) {
      dot(appDot, s.appTooOld ? 'warn' : 'ok');
      appTxt.textContent = s.appTooOld ? `Version ${s.appVersion} — the plugin needs ${s.minApp} or newer. Update Stream Deck first.`
        : `Found${s.appVersion ? ' · version ' + s.appVersion : ''}`;
      getApp.hidden = !s.appTooOld;
    } else if (s.supported === false) {
      dot(appDot, ''); appTxt.textContent = 'Stream Deck runs on Windows and macOS. Use the plugin file on the PC with the Stream Deck.'; getApp.hidden = true;
    } else { dot(appDot, 'bad'); appTxt.textContent = 'Not found on this PC.'; getApp.hidden = false; }
    // the plugin
    install.hidden = !s.canInstall || !s.plugin;
    if (s.connected && !s.outdated) { dot(plugDot, 'ok'); plugTxt.textContent = `Connected${s.installedVersion ? ' · version ' + s.installedVersion : ''}`; install.textContent = 'Reinstall'; install.hidden = true; }
    else if (s.outdated) { dot(plugDot, 'warn'); plugTxt.textContent = `Version ${s.installedVersion} is installed — ${s.bundledVersion} is ready.`; install.textContent = 'Update'; }
    else if (s.installed) { dot(plugDot, 'warn'); plugTxt.textContent = `Installed${s.installedVersion ? ' · version ' + s.installedVersion : ''} — waiting for Stream Deck to start it.`; install.textContent = 'Reinstall'; }
    else { dot(plugDot, 'bad'); plugTxt.textContent = s.plugin ? 'Not installed.' : 'Not in this build — download it below.'; install.textContent = 'Install'; }
    install.disabled = busy || !!s.appTooOld;
    pill.textContent = s.connected ? 'Connected' : s.installed ? 'Installed' : 'Not connected';
    pill.classList.toggle('on', !!s.connected);
    if (auto) auto.checked = s.autoUpdate !== false;
    // Set up my Stream Deck
    if (setupBtn) { setupBtn.disabled = busy || !!waitN || (!s.connected && !s.installed && !(s.canInstall && s.plugin)); setupBtn.hidden = !s.canInstall && !s.connected; }
  }
  function setupNote(text, cls) { if (setupTxt) setupTxt.textContent = text; dot(setupDot, cls); }

  async function load() {
    try { st = await P.api('/api/streamdeck'); draw(); checkSetup(); } catch {}
  }
  function checkSetup() {
    if (!waitN || !st || !st.setup) return;
    const r = st.setup.result;
    if (r && r.n === waitN && r.mode === 'direct') {               // Windows: the keys were written into Stream Deck
      if (r.waiting) return setupNote('Waiting for the plugin: confirm the install in Stream Deck. The keys go on by themselves after that.', '');
      waitN = 0; draw();
      if (r.error) { setupNote(r.error, 'bad'); P.toast(r.error, true); return; }
      const on = r.devices || [], off = r.skipped || [];
      if (!on.length && !off.length) return setupNote('No Stream Deck found. Plug it in and open Stream Deck once, then press Set up again.', 'warn');
      let t = on.length ? `Done: ${on.map(d => `${d.name} (${d.keys} keys)`).join(' and ')} ${on.length > 1 ? 'show' : 'shows'} the BeeboScore Prototype page${on[0].profile ? ` in the “${on[0].profile}” profile` : ''}. Your other pages are still there.` : '';
      if (off.length) t += (t ? ' ' : '') + `${off.map(d => d.name || d.model || 'A Stream Deck').join(', ')}: the layout is made for 15 and 32 keys — drag the keys from the BeeboScore list there.`;
      if (on.length && !r.restarted) t += ' Start Stream Deck again to see it.';
      setupNote(t, on.length ? 'ok' : 'warn');
      P.toast(on.length ? 'BeeboScore is on your Stream Deck' : 'No 15 or 32-key Stream Deck found', !on.length);
      return;
    }
    if (r && r.n === waitN) {
      waitN = 0; draw();
      const decks = (r.devices || []).filter(d => d.profile), other = (r.devices || []).filter(d => !d.profile);
      if (!r.devices || !r.devices.length) return setupNote('No Stream Deck is plugged in. Plug it in, then press Set up again.', 'warn');
      let t = decks.length ? `Done: ${decks.map(d => `${d.name || 'Stream Deck'} → “${d.profile}”`).join(', ')}.` : '';
      if (other.length) t += (t ? ' ' : '') + `${other.map(d => d.name || 'A Stream Deck').join(', ')}: the layouts are made for 15 and 32 keys — add the keys from the BeeboScore list there.`;
      t += decks.length ? ' If Stream Deck asks to add the BeeboScore Prototype profiles, say yes, then press Set up once more.' : '';
      setupNote(t, decks.length ? 'ok' : 'warn');
      P.toast(decks.length ? 'BeeboScore is on your Stream Deck' : 'No 15 or 32-key Stream Deck found');
    } else if (Date.now() > waitUntil) {
      waitN = 0; draw();
      setupNote(st.connected ? 'Stream Deck did not answer. Check that Stream Deck is open, then press Set up again.'
        : 'The plugin has not connected yet. Finish installing it in Stream Deck (say yes to the profiles too), then press Set up again.', 'warn');
    }
  }
  async function setup() {
    if (busy) return; busy = true; draw();
    try {
      const r = await P.api('/api/streamdeck/setup', { method: 'POST', body: {} });
      waitN = r.n; waitUntil = Date.now() + (r.step === 'switch' ? 20000 : r.mode === 'direct' ? 220000 : 110000);
      if (r.mode === 'direct') setupNote(r.step === 'install' ? 'Stream Deck is installing the plugin — confirm it there. Then Stream Deck closes for a moment and comes back with the keys on.'
        : r.step === 'update' ? 'Stream Deck is updating the plugin — confirm it there. Then Stream Deck closes for a moment and comes back with the keys on.'
        : 'Putting the keys on: Stream Deck closes for a moment and comes back with the BeeboScore Prototype page…', '');
      else setupNote(r.step === 'install' ? 'Stream Deck is installing the plugin — confirm there and say yes to the BeeboScore Prototype profiles. The layout goes on by itself.'
        : r.step === 'update' ? 'Stream Deck is updating the plugin — confirm there and say yes to the BeeboScore Prototype profiles. The layout goes on by itself.'
        : 'Putting the BeeboScore layout on your Stream Deck…', '');
    } catch (e) { setupNote(e.message, 'bad'); P.toast(e.message, true); }
    busy = false; draw(); poll();
  }
  async function doInstall() {
    if (busy) return; busy = true; draw();
    try { const r = await P.api('/api/streamdeck/install', { method: 'POST', body: {} });
      P.toast(r.action === 'update' ? 'Updating the plugin — confirm in Stream Deck' : 'Installing the plugin — confirm in Stream Deck'); }
    catch (e) { P.toast(e.message, true); }
    busy = false; load();
  }
  function poll() { clearTimeout(timer); timer = setTimeout(async () => { await load(); poll(); }, waitN ? 1000 : card.offsetParent ? 4000 : 15000); }

  install && install.addEventListener('click', doInstall);
  setupBtn && setupBtn.addEventListener('click', setup);
  auto && auto.addEventListener('change', e => P.saveSettings({ sdAutoUpdate: e.target.checked }, e.target.checked ? 'The Stream Deck plugin will stay up to date' : 'The Stream Deck plugin will not update by itself'));
  window.addEventListener('beebo:streamdeck', e => {
    const d = e.detail || {};
    if (d.kind === 'updating') P.toast(`A newer Stream Deck plugin is ready — confirm in Stream Deck`);
    else if (d.kind === 'app-too-old') P.toast(`Update the Stream Deck app: the BeeboScore Prototype plugin needs ${d.minApp} or newer`, true);
    load();
  });
  load(); poll();
})();
