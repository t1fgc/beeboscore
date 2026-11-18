/* BeeboScore — small helpers around the panel: "What's new" after an update, the OBS-not-connected warning, the Wi-Fi
 * password note, Backups (Settings), Settings search and the Light effects switch. */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem('sb.' + k); localStorage.setItem('sb.' + k, v); } catch (e) { return null; } };
  const local = () => { const i = P.info && P.info(); return !i || i.local !== false; };

  // ------------------------------------------------------------ What's new (once per version, not on a first run)
  async function whatsNew() {
    let w; try { w = await api('/api/whatsnew'); } catch (e) { return; }
    const seen = store('seenVersion');
    if (!w || !w.version) return;
    if (!seen) { store('seenVersion', w.version); return; }          // first run: the setup guide covers it
    if (seen === w.version || !w.items.length) return;
    const card = $('#wnCard');
    card.innerHTML = `<h2>✨ What's new in ${esc(w.version)} <span class="spacer"></span><button class="btn sm" id="wnOk">Got it</button></h2>
      <p class="hint" style="margin:0 0 4px">${esc(w.title)}</p><ul>${w.items.map(i => `<li>${esc(i).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul>`;
    card.hidden = false;
    $('#wnOk').onclick = () => { store('seenVersion', w.version); card.hidden = true; };
  }

  // ------------------------------------------------------------ OBS isn't showing the overlay
  let obsSeen = false, warnT = null;
  const dismissedToday = () => store('obsWarnX') === new Date().toDateString();
  function latency(list) {
    const live = (list || []).filter(v => !v.gone && (v.obs || v.kind === 'overlay' || v.kind === 'obs'));
    obsSeen = live.length > 0;
    if (obsSeen) { $('#obsWarn').hidden = true; clearTimeout(warnT); warnT = null; }
    else if (!warnT && !dismissedToday() && local()) warnT = setTimeout(() => { warnT = null; if (!obsSeen && !dismissedToday()) $('#obsWarn').hidden = false; }, 25000);
  }
  window.addEventListener('beebo:latency', e => latency(e.detail));
  setTimeout(() => latency([]), 1500);
  $('#obsWarnX').onclick = () => { store('obsWarnX', new Date().toDateString()); $('#obsWarn').hidden = true; };

  // ------------------------------------------------------------ Wi-Fi without a password
  async function lanNote() {
    try {
      const [a, s] = await Promise.all([api('/api/auth'), api('/api/settings')]);
      $('#lanWarn').hidden = !!(s.lanNoPassword || a.hasPassword);
      $('#setLightFx').checked = !!s.lightFx;
      if ($('#setFxQ')) $('#setFxQ').value = s.fxQuality || 'auto';
    } catch (e) {}
  }
  $('#setLanNoPw').addEventListener('change', () => setTimeout(lanNote, 400));
  if ($('#setFxQ')) $('#setFxQ').onchange = e => api('/api/fx', { method: 'POST', body: { quality: e.target.value } }).then(() => toast('Effects engine: ' + e.target.selectedOptions[0].textContent)).catch(er => toast(er.message, true));
  $('#setLightFx').onchange = e => api('/api/settings', { method: 'POST', body: { lightFx: e.target.checked } })
    .then(() => toast(e.target.checked ? '⚡ Light effects on — the heaviest extras are off in OBS' : 'Full effects back on')).catch(er => toast(er.message, true));

  // ------------------------------------------------------------ Backups
  const size = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  async function backups() {
    if (!local()) return;
    try {
      const r = await api('/api/backups');
      $('#bkPill').textContent = r.list.length ? `Last: ${new Date(r.list[0].at).toLocaleDateString()}` : 'None yet';
      $('#bkList').innerHTML = r.list.slice(0, 8).map(b => `<div><span>${esc(b.name.replace(/\.beebo-backup$/, ''))}</span><small>${size(b.size)}</small></div>`).join('');
    } catch (e) {}
  }
  $('#bkOpen').onclick = () => api('/api/backups/open', { method: 'POST', body: {} }).catch(e => toast(e.message, true));
  $('#bkRestoreBtn').onclick = () => $('#bkFile').click();
  $('#bkFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const chk = await fetch('/api/backup/restore?check=1', { method: 'POST', body: buf, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.json());
      if (chk.error) throw new Error(chk.error);
      const s = chk.summary;
      if (!(await BeeboAsk.confirm({ title: `Restore the backup from ${new Date(s.at).toLocaleString()}?`, text: `${s.players} players · ${s.teams} saved teams · ${s.layouts} of your layouts · ${s.assets} pictures\n\nYour current setup is backed up first, and BeeboScore restarts afterwards. Passwords and sign-ins stay as they are now.`, ok: 'Restore and restart', danger: true }))) return;
      const r = await fetch('/api/backup/restore', { method: 'POST', body: buf, headers: { 'Content-Type': 'application/octet-stream' } }).then(x => x.json());
      if (r.error) throw new Error(r.error);
      toast(r.restarting ? 'Backup restored — restarting…' : 'Backup restored — restart BeeboScore to finish');
      if (!r.restarting) setTimeout(() => location.reload(), 1500);
    } catch (er) { toast(er.message || 'That backup couldn’t be restored.', true); }
  };
  $('#bkDownload').addEventListener('click', () => setTimeout(backups, 1500));

  // ------------------------------------------------------------ Settings search
  const sec = $('section.tab[data-tab="settings"]');
  function search(q) {
    q = q.trim().toLowerCase();
    sec.classList.toggle('searching', !!q);
    let hits = 0;
    for (const card of sec.querySelectorAll('.card')) {
      const items = [...card.querySelectorAll('.opt, .opt-row')];
      const cardHit = !q || card.textContent.toLowerCase().includes(q);
      let any = false;
      if (items.length && q) {
        const head = (card.querySelector('h2') || {}).textContent || '';
        const headHit = head.toLowerCase().includes(q);
        for (const it of items) { const h = headHit || it.textContent.toLowerCase().includes(q); it.classList.toggle('no-hit', !h); any = any || h; }
      } else { items.forEach(it => it.classList.remove('no-hit')); any = cardHit; }
      card.classList.toggle('no-hit', !!q && !(any || cardHit));
      if (!q || any || cardHit) hits++;
    }
    $('#setSearchNone').hidden = !q || hits > 0;
  }
  // 1.12: one section at a time (the chips switch it, remembered); searching looks through all of them
  function showSection(id) {
    const cards = [...sec.querySelectorAll(':scope > .card')];
    if (id !== 'all' && !cards.some(c => c.id === id)) id = 'setLook';
    sec.classList.toggle('set-one', id !== 'all');
    for (const c of cards) c.classList.toggle('set-on', id === 'all' || c.id === id);
    for (const a of sec.querySelectorAll('[data-set-show]')) a.classList.toggle('on', a.dataset.setShow === id);
    try { localStorage.setItem('sb.setSection', id); } catch {}
  }
  sec.addEventListener('click', e => { const a = e.target.closest('[data-set-show]'); if (a) { e.preventDefault(); showSection(a.dataset.setShow); } });
  // a link elsewhere that jumps to a settings card opens its section first
  document.addEventListener('click', e => { const g = e.target.closest('[data-scroll], [data-scroll-to]'); if (!g) return; const id = g.dataset.scroll || g.dataset.scrollTo, c = document.getElementById(id), card = c && c.closest('section.tab[data-tab="settings"] > .card'); if (card && card.id) showSection(card.id); }, true);
  window.BeeboPanel.settingsSection = showSection;
  showSection((() => { try { return localStorage.getItem('sb.setSection'); } catch { return null; } })() || 'setLook');
  $('#setSearch').addEventListener('input', e => search(e.target.value));
  $('#setSearch').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; search(''); } });

  // ------------------------------------------------------------ your own Cloudflare tunnel
  async function named() { if (!local()) return; try { const r = await api('/api/tunnel/named'); $('#ntHost').value = r.host; $('#ntOn').checked = r.on; $('#ntToken').placeholder = r.hasToken ? '•••••• saved — paste to replace' : 'eyJh…'; } catch (e) {} }
  const ntSave = body => api('/api/tunnel/named', { method: 'POST', body }).then(r => { $('#ntOn').checked = r.on; $('#ntToken').value = ''; $('#ntToken').placeholder = r.hasToken ? '•••••• saved — paste to replace' : 'eyJh…'; toast(r.on ? `Going online will use ${r.host}` : 'Saved — going online uses a quick tunnel'); }).catch(e => { toast(e.message, true); named(); });
  $('#ntSave').onclick = () => { const b = { host: $('#ntHost').value.trim(), on: $('#ntOn').checked }; if ($('#ntToken').value.trim()) b.token = $('#ntToken').value.trim(); ntSave(b); };
  $('#ntOn').onchange = e => ntSave({ on: e.target.checked });

  // ------------------------------------------------------------ collapsible cards (Bracket, Stream, Twitch): click the title
  // the long, set-once cards start folded (chat commands, viewer-match settings); the app remembers what you open or close
  const clKey = 'collapsed';
  let closed = (() => { try { const v = store(clKey); return v == null ? ['twCmdCard', 'twSetCard'] : JSON.parse(v || '[]'); } catch (e) { return []; } })();
  for (const card of $$('section.tab[data-tab="bracket"] .card[id], section.tab[data-tab="stream"] .card[id], section.tab[data-tab="twitch"] .card[id]')) {
    const h = card.querySelector(':scope > h2'); if (!h) continue;
    card.classList.add('cl');
    const b = document.createElement('button'); b.className = 'cl-tg'; b.type = 'button'; b.textContent = '▾'; b.setAttribute('aria-label', 'Show or hide this section');
    h.insertBefore(b, h.firstChild);                                     // 1.12.20: always first, like every other ▸ in the app
    const set = c => { card.classList.toggle('collapsed', c); b.setAttribute('aria-expanded', String(!c)); };
    set(closed.includes(card.id));
    h.addEventListener('click', e => { if (e.target.closest('button:not(.cl-tg), a, input, select, label')) return; const c = !card.classList.contains('collapsed'); set(c); closed = c ? [...new Set([...closed, card.id])] : closed.filter(x => x !== card.id); store(clKey, JSON.stringify(closed)); });
  }

  // ------------------------------------------------------------ accessibility: names for icon-only buttons, the open tab
  function a11y() {
    for (const el of $$('button, a.btn')) {
      if (el.hasAttribute('aria-label')) continue;
      const txt = el.textContent.replace(/[\p{Extended_Pictographic}\uFE0F\u200D✕✓▲▾↶↺⬇⬆＋−]/gu, '').trim();
      if (!txt && el.title) el.setAttribute('aria-label', el.title);
    }
    for (const b of $$('nav.rail button')) b.setAttribute('aria-current', b.classList.contains('on') ? 'page' : 'false');
  }
  new MutationObserver(() => { clearTimeout(a11y.t); a11y.t = setTimeout(a11y, 300); }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

  // ------------------------------------------------------------ first-time setup
  const W = { step: 0, layout: '', obs: false, src: '' };
  const STEPS = [
    () => `<h2 id="wizTitle">Welcome to BeeboScore</h2><p>Four quick steps to get your scoreboard on stream. You can change everything later.</p>
      <p>BeeboScore runs the scoreboard, VS and victory screens, start.gg brackets and game formats. You control it here (or from your phone or Stream Deck), and OBS shows it.</p>`,
    () => { const ov = (P.overlays && P.overlays() || []).filter(o => !o.format && !o.base);   // every look (Lite: Classic for each game, and any you add)
      return `<h2 id="wizTitle">Pick a look</h2><p>The layout your viewers see: Classic, for the game you're playing.</p>
        <div class="wiz-opts wiz-looks">${ov.map(o => `<button data-ov="${esc(o.name)}" class="${o.name === (W.layout || o.active && o.name) ? 'on' : ''}"><b>${esc(o.title || o.name)}</b><small>${esc(o.game || '')}</small></button>`).join('') || '<p>Layouts are loading…</p>'}</div>`; },
    () => `<h2 id="wizTitle">Add it to OBS</h2><p>In OBS: <b>Sources › + › Browser</b>, paste this link, width <b>1920</b>, height <b>1080</b>.</p>
      <div class="urlbox"><input type="text" readonly id="wizUrl" value="${esc(($('#obsUrl') && $('#obsUrl').value) || location.origin + '/overlay')}"><button class="btn" id="wizCopy">Copy</button></div>
      <p style="margin-top:14px"><span class="wiz-ok ${W.obs ? 'yes' : 'no'}" id="wizObs">${W.obs ? '✔ OBS is showing your scoreboard' : '⏳ Waiting for OBS… (you can carry on)'}</span></p>`,
    () => `<h2 id="wizTitle">start.gg (optional)</h2><p>Show a live bracket, Top 8 and final standings on stream.</p>
      <div class="wiz-opts"><button data-src="startgg" class="${W.src === 'startgg' ? 'on' : ''}"><b>🏆 start.gg event</b><small>Sign in and pick your tournament in the Bracket tab.</small></button>
      <button data-src="none" class="${W.src === 'none' ? 'on' : ''}"><b>Not now</b><small>Just the scoreboard.</small></button></div>`,
    () => `<h2 id="wizTitle">You're set 🎉</h2><p>Type the players' names in the <b>Matches</b> tab and press + to score. A few things worth knowing:</p>
      <ul style="color:var(--muted);margin:0 0 10px;padding-left:20px;line-height:1.6"><li><b>Format</b> menu on the Players card — crew battles, Death Battle, King of the Hill…</li><li><b>Stream</b> tab — control from your phone, or go online.</li><li><b>Settings › Backups</b> — BeeboScore keeps a daily backup by itself.</li></ul>`,
  ];
  function wizDraw() {
    $('#wizSteps').innerHTML = STEPS.map((_, i) => `<i class="${i <= W.step ? 'on' : ''}"></i>`).join('');
    $('#wizBody').innerHTML = STEPS[W.step]();
    $('#wizBack').hidden = W.step === 0; $('#wizNext').textContent = W.step === STEPS.length - 1 ? 'Start' : 'Next';
    const cp = $('#wizCopy'); if (cp) cp.onclick = () => P.copy($('#wizUrl').value, 'Overlay link copied — paste it into an OBS Browser Source');
    const f = $('#wizBody').querySelector('button, input'); if (f) setTimeout(() => f.focus(), 30);
  }
  $('#wizBody').addEventListener('click', e => {
    const o = e.target.closest('[data-ov]'); if (o) { W.layout = o.dataset.ov; api('/api/overlays/active', { method: 'POST', body: { name: W.layout } }).catch(() => {}); wizDraw(); }
    const s = e.target.closest('[data-src]'); if (s) { W.src = s.dataset.src; wizDraw(); }
  });
  window.addEventListener('beebo:latency', e => { const live = (e.detail || []).some(v => !v.gone && v.obs); if (live && !W.obs) { W.obs = true; if (!$('#wiz').hidden && W.step === 2) wizDraw(); } });
  const wizEnd = () => { $('#wiz').hidden = true; api('/api/settings', { method: 'POST', body: { setupDone: true } }).catch(() => {}); };
  $('#wizSkip').onclick = wizEnd;
  $('#wizBack').onclick = () => { if (W.step > 0) { W.step--; wizDraw(); } };
  $('#wizNext').onclick = async () => {
    if (W.step < STEPS.length - 1) { W.step++; wizDraw(); return; }
    wizEnd();
    if (W.src === 'startgg') { await api('/api/vt', { method: 'POST', body: { do: 'source', source: W.src } }).catch(() => {}); P.showTab('bracket'); }
    else P.showTab('match');
  };
  $('#wiz').addEventListener('keydown', e => { if (e.key === 'Escape') wizEnd(); });
  function wizStart() { W.step = 0; $('#wiz').hidden = false; wizDraw(); }
  $('#wizAgain').onclick = wizStart;
  async function wizMaybe() {
    if (!local()) return;
    try { const s = await api('/api/settings'); if (!s.setupDone) wizStart(); } catch (e) {}
  }

  // ---- 1.12.5: sub-tabs you can find. Every main tab gets a bar of its sections under its title, kept in view while you
  // scroll; clicking one takes you to it (Settings keeps its own bar, which shows one section at a time).
  function subnav() {
    const label = h => { const c = h.cloneNode(true); c.querySelectorAll('a, button, input, select, small, label, kbd, details, [class], [hidden]').forEach(n => n.remove());
      return c.textContent.replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+/u, '').trim(); };
    function build(sec) {
      if (!sec || sec.dataset.tab === 'settings' || sec.dataset.tab === 'designer') return;
      const cards = [...sec.querySelectorAll('.card')].filter(c => !c.parentElement.closest('.card') && !c.hidden && c.offsetParent !== null && c.querySelector(':scope > h2'));
      const items = cards.map((c, i) => { if (!c.id) c.id = `sub-${sec.dataset.tab}-${i}`; return { id: c.id, t: label(c.querySelector(':scope > h2')) }; }).filter(x => x.t);
      let bar = sec.querySelector(':scope > .subnav');
      const key = items.map(x => x.id + x.t).join('|');
      if (items.length < 3) { if (bar) bar.remove(); return; }
      if (bar && bar.dataset.key === key) return;
      if (!bar) { bar = document.createElement('nav'); bar.className = 'subnav'; bar.setAttribute('aria-label', 'Sections of this tab'); const t = sec.querySelector(':scope > .pagetitle'); const after = t && t.nextElementSibling && t.nextElementSibling.tagName === 'P' ? t.nextElementSibling : t; if (after) after.after(bar); else sec.prepend(bar); }
      bar.dataset.key = key;
      bar.innerHTML = items.map(x => `<a href="#${x.id}" data-sub="${x.id}">${x.t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</a>`).join('');
    }
    const current = () => document.querySelector('main .tab.on');
    document.addEventListener('click', e => {
      const a = e.target.closest('.subnav [data-sub]'); if (!a) return; e.preventDefault();
      const c = document.getElementById(a.dataset.sub); if (!c) return;
      const top = c.getBoundingClientRect().top + window.scrollY - 60 - ((a.closest('.subnav') || {}).offsetHeight || 0) - 10;
      window.scrollTo({ top, behavior: 'smooth' });
      c.classList.remove('sub-flash'); void c.offsetWidth; c.classList.add('sub-flash');
    });
    // which section you're looking at
    let raf = 0;
    window.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const sec = current(), bar = sec && sec.querySelector(':scope > .subnav'); if (!bar) return;
      let on = null; for (const a of bar.querySelectorAll('[data-sub]')) { const c = document.getElementById(a.dataset.sub); if (c && c.getBoundingClientRect().top < 200) on = a; }
      bar.querySelectorAll('[data-sub]').forEach(a => a.classList.toggle('on', a === (on || bar.querySelector('[data-sub]')))); }); }, { passive: true });
    const refresh = () => { const sec = current(); if (sec) build(sec); };
    document.querySelector('nav.rail').addEventListener('click', () => setTimeout(refresh, 60));
    setInterval(() => { if (!document.hidden) refresh(); }, 2000);      // cards that come and go (a format starting, start.gg connecting)
    refresh();
  }

  setTimeout(() => { wizMaybe(); a11y(); whatsNew(); lanNote(); backups(); named(); subnav(); }, 600);
})();
