/* BeeboScore (developed by Beebo), 1.12.19 — quality of life around the whole panel.
 *
 *   links        every "Settings › …" in the panel's words (and in its messages) opens that card
 *   messages     the bell in the header keeps the last 50 messages, errors in red; an Undo still works while it can
 *   on stream    a row of chips for every graphic that's up now, each with × to take just that one down
 *   folding      the Show and Players cards fold like the others; the set-once cards (team, sync, extensions, the
 *                online gallery) start folded; what you open or close is remembered on this PC
 *   OBS          BeeboAddToObs('music' | 'venue' | 'vertical'): the source in OBS's current scene — never twice
 *   the rail     hide tabs you don't use or put them in your own order (this PC; Settings always stays)
 *   a tour       a short look round the Show and Players tabs, once, after the update
 *   windows      keyboard focus stays inside any open window, and goes back where it was when it closes
 *   help         a "?" on each Show and Players card: what it's for, and where it is in the guide
 */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = P.esc, toast = (m, b) => P.toast(m, b);
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem('sb.' + k); if (v === null) localStorage.removeItem('sb.' + k); else localStorage.setItem('sb.' + k, v); } catch (e) { return null; } };
  const lsJSON = (k, d) => { try { const v = JSON.parse(ls(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const local = () => { const i = P.info && P.info(); return !i || i.local !== false; };

  // ======================================================================================== Settings › … as links
  const norm = s => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9&]+/g, ' ').trim();
  const titleOf = c => { const h = c.querySelector(':scope > h2'); if (!h) return ''; return norm([...h.childNodes].filter(x => x.nodeType === 3 || (x.nodeType === 1 && !x.matches('button, select, input, .pill, .spacer, label, small, .cl-tg, .help-q'))).map(x => x.textContent).join(' ')); };
  function cardFor(name, strict) {
    const n = norm(name); if (n.length < 2) return null;
    const set = $$('section.tab[data-tab="settings"] > .card'), all = $$('main section.tab .card[id]');
    for (const pool of [set, all]) {
      const t = pool.map(c => [c, titleOf(c)]).filter(x => x[1]);
      const hit = t.find(x => x[1] === n) || t.find(x => x[1].startsWith(n + ' ') || x[1].startsWith(n)) || (!strict && t.find(x => x[1].length > 3 && n.startsWith(x[1])));
      if (hit) return hit[0];
    }
    return null;
  }
  function gotoCard(c) {
    const sec = c.closest('section.tab'); if (!sec) return;
    P.showTab(sec.dataset.tab);
    if (sec.dataset.tab === 'settings' && P.settingsSection) { const top = c.closest('section.tab[data-tab="settings"] > .card'); if (top && top.id) P.settingsSection(top.id); }
    if (c.classList.contains('collapsed')) { const t = c.querySelector('.cl-tg'); if (t) t.click(); }
    setTimeout(() => { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); c.classList.remove('q-flash'); void c.offsetWidth; c.classList.add('q-flash'); setTimeout(() => c.classList.remove('q-flash'), 1700); }, 60);
  }
  function gotoSetting(name) {
    const c = cardFor(name); if (c) { gotoCard(c); return true; }
    P.showTab('settings'); const s = $('#setSearch'); if (s) { s.value = String(name).split(/[›>]/)[0].trim(); s.dispatchEvent(new Event('input')); s.focus(); }
    return false;
  }
  P.gotoSetting = gotoSetting; P.gotoCard = gotoCard;
  // "Settings › Sound is on" → the longest run of words that names a card ("Sound") becomes the link
  const RX = /Settings\s*(?:›|→)\s*([A-Z0-9][^.,;:()!?\n›→—–"“”]*)/g;
  const SKIP = 'SCRIPT,STYLE,TEXTAREA,INPUT,SELECT,OPTION,BUTTON,A,CODE,KBD,LABEL';
  function resolve(words) { const w = words.trim().split(/\s+/); for (let n = Math.min(w.length, 6); n >= 1; n--) { const t = w.slice(0, n).join(' ').replace(/[’']s$/, ''); if (cardFor(t, true)) return t; } return ''; }   // 1.12.20: strict — “Settings › Sound is on” links “Sound”, not the whole phrase
  function linkify(root) {
    if (!root || !(root.nodeType === 1 || root.nodeType === 3)) return;
    if (root.nodeType === 1 && (root.closest(SKIP.split(',').map(x => x.toLowerCase()).join(',')) || root.closest('.bask, .jump, [data-no-link], #dzFrame'))) return;
    if (!/Settings\s*[›→]/.test(root.textContent || '')) return;
    const walk = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT), list = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/Settings\s*[›→]/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest(SKIP.split(',').map(x => x.toLowerCase()).join(',') + ',.bask,.jump,[data-no-link],.set-link'))) list.push(n);
    for (const n of list) {
      const txt = n.nodeValue, frag = document.createDocumentFragment(); let last = 0, any = false; RX.lastIndex = 0;
      for (let m = RX.exec(txt); m; m = RX.exec(txt)) {
        const name = resolve(m[1]); if (!name) continue;
        const end = m.index + m[0].indexOf(m[1]) + name.length;
        frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const a = document.createElement('a'); a.href = '#'; a.className = 'set-link'; a.dataset.gotoSetting = name; a.textContent = txt.slice(m.index, end); a.title = 'Open ' + name; frag.appendChild(a);
        last = end; any = true;
      }
      if (!any) continue;
      frag.appendChild(document.createTextNode(txt.slice(last))); n.parentNode.replaceChild(frag, n);
    }
  }
  document.addEventListener('click', e => { const a = e.target.closest('[data-goto-setting]'); if (!a) return; e.preventDefault(); const t = a.closest('.toast'); if (t) t.remove(); gotoSetting(a.dataset.gotoSetting); });
  let pend = new Set(), lt = 0;
  new MutationObserver(recs => { for (const r of recs) for (const n of r.addedNodes) if ((n.nodeType === 1 || n.nodeType === 3) && /Settings\s*[›→]/.test(n.textContent || '')) pend.add(n); if (pend.size && !lt) lt = setTimeout(() => { lt = 0; const l = [...pend]; pend = new Set(); l.forEach(x => { if (x.isConnected) linkify(x); }); }, 60); }).observe(document.body, { childList: true, subtree: true });
  setTimeout(() => linkify(document.querySelector('main') || document.body), 1500);
  setTimeout(() => linkify(document.querySelector('main') || document.body), 4000);     // the cards made a little later (show-tab.js)

  // ======================================================================================== the message history (the bell)
  const LOG = [];
  const bell = document.createElement('button'); bell.type = 'button'; bell.className = 'q-bell'; bell.id = 'msgBell'; bell.title = 'Messages: the last 50'; bell.setAttribute('aria-label', 'Messages'); bell.setAttribute('aria-haspopup', 'true');
  bell.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><b class="q-n" hidden></b>';
  const pop = document.createElement('div'); pop.className = 'q-msgs'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Messages');
  const st0 = $('.head .status'); if (st0) st0.parentNode.insertBefore(bell, st0); else document.body.appendChild(bell);
  document.body.appendChild(pop);
  let unseen = 0, unseenErr = false;
  const hm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const live = x => x.act && !x.act.used && Date.now() < x.at + (x.act.ms || 6000) * 4;      // an Undo stays usable a while longer here
  function drawMsgs() {
    pop.innerHTML = `<div class="q-mh"><b>Messages</b><span class="spacer"></span><button class="btn xs ghost" type="button" data-q="clear">Clear</button></div>` + (LOG.length ? LOG.map((x, i) => `<div class="q-m${x.err ? ' err' : ''}"><time>${hm(x.at)}</time><span>${esc(x.msg)}</span>${live(x) ? `<button class="btn xs" type="button" data-undo="${i}">${esc(x.act.action)}</button>` : ''}</div>`).join('') : '<p class="hint" style="margin:10px">No messages yet.</p>');
    linkify(pop);
  }
  function badge() { const b = $('.q-n', bell); b.hidden = !unseen; b.textContent = unseen > 9 ? '9+' : String(unseen); bell.classList.toggle('err', unseenErr); }
  addEventListener('beebo:toast', e => { const d = e.detail || {}; if (!d.msg) return; LOG.unshift(d); if (LOG.length > 50) LOG.length = 50; if (pop.hidden) { unseen++; unseenErr = unseenErr || d.err; badge(); } else drawMsgs(); });
  const place = () => { const r = bell.getBoundingClientRect(); pop.style.top = (r.bottom + 6) + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px'; };
  bell.onclick = () => { pop.hidden = !pop.hidden; bell.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) { unseen = 0; unseenErr = false; badge(); drawMsgs(); place(); } };
  pop.addEventListener('click', e => { const u = e.target.closest('[data-undo]'); if (u) { const x = LOG[Number(u.dataset.undo)]; if (x && live(x)) x.act.run(); drawMsgs(); } if (e.target.closest('[data-q=clear]')) { LOG.length = 0; drawMsgs(); } });
  document.addEventListener('mousedown', e => { if (!pop.hidden && !pop.contains(e.target) && !bell.contains(e.target)) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true; bell.focus(); } });
  P.messages = () => LOG.slice();

  // ======================================================================================== On stream now
  const SPL = { bracket: 'Bracket splash', top8: 'Top 8 splash', standings: 'Standings', fvs: 'Team VS', fboard: 'Format board', fwin: 'Champion', flead: 'Leaders', vtjoin: 'How to join', comm: 'Commentary screen' };
  const FULLN = { countdown: 'Countdown', schedule: 'Coming up', walkin: 'Walk-in', evstats: 'Event in numbers', season: 'Season table', greset: 'Bracket reset splash' };
  const CARDN = { storyline: 'Storyline', pred: 'Picks bar', poll: 'Poll' };
  const bar = document.createElement('div'); bar.className = 'q-onair'; bar.id = 'onAir'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'On stream now');
  const head = $('.head'); if (head) head.after(bar); else document.body.prepend(bar);
  let S = null, drawUntil = 0, drawT = 0;
  function chips(s) {
    const out = []; if (!s) return out;
    if (s.vs && s.vs.show) out.push(['vs', 'FullVS']);
    if (s.playerVs && s.playerVs.show) out.push(['playerVs', 'GlassVS']);
    if (s.victory && s.victory.show) out.push(['victory', 'Victory splash']);
    const sp = s.splash && s.splash.show; if (sp) out.push(['splash', SPL[sp] || 'Splash']);
    if (s.screen) out.push(['screen', 'Screen: ' + s.screen]);
    const f = s.full && s.full.show; if (f) out.push(['full', FULLN[f] ? (f === 'walkin' ? `Walk-in: ${(s['p' + (Number(s.full.side) === 2 ? 2 : 1)] || {}).name || 'player'}` : FULLN[f]) : f]);
    const c = s.card && s.card.show; if (c) out.push(['card', CARDN[c] || c]);
    if (s.stats && s.stats.show) out.push(['stats', 'Stats card']);
    if (MOV && MOV.now && MOV.last) out.push(['moment', 'Moment: ' + MOV.last.title]);              // 1.12.21 (the banner comes with the show's view, not the scoreboard's)
    if (s.h2h && s.h2h.show) out.push(['h2h', 'Head-to-head line']);
    if (s.timer && s.timer.show) out.push(['timer', 'Set timer']);
    for (const k of Object.keys(s.ext || {})) if (s.ext[k]) out.push(['ext:' + k, 'Extension: ' + k.split(':').pop()]);
    if (Date.now() < drawUntil) out.push(['draw', 'Replay drawing']);
    return out;
  }
  function drawBar() {
    const l = chips(S);
    bar.hidden = !l.length; document.body.classList.toggle('q-air', !!l.length);
    if (!l.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = `<span class="q-ol">On stream now</span>` + l.map(([w, t]) => `<span class="q-chip"><span>${esc(t)}</span><button type="button" data-hide="${esc(w)}" aria-label="Take ${esc(t)} off the stream" title="Take it off the stream">×</button></span>`).join('') + (l.length > 1 ? `<button class="btn xs ghost" type="button" data-hide="*">Hide all</button>` : '');
    document.body.style.setProperty('--air', bar.offsetHeight + 'px');
  }
  addEventListener('beebo:state', e => { S = e.detail; drawBar(); });
  let MOV = null; addEventListener('beebo:show', e => { if (e.detail && e.detail.moments) { MOV = e.detail.moments; drawBar(); } });
  addEventListener('beebo:show:draw', e => { const d = e.detail || {}; if (d.clear) drawUntil = 0; else drawUntil = Date.now() + 12000; clearTimeout(drawT); drawT = setTimeout(drawBar, 12100); drawBar(); });
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-hide]'); if (!b) return;
    const w = b.dataset.hide, body = w === '*' ? { action: 'hideAll' } : { action: 'hideOne', what: w };
    if (w === 'draw') drawUntil = 0;
    P.api('/api/remote/action', { method: 'POST', body }).then(() => drawBar()).catch(er => toast(er.message, true));
  });
  setTimeout(() => { S = P.state && P.state(); drawBar(); }, 900);

  // ======================================================================================== folding (Show and Players, and the set-once cards)
  const FOLD_KEY = 'collapsed2', FOLDED_FIRST = ['tmCard', 'syCard', 'exCard', 'ogCard'];
  let closed = lsJSON(FOLD_KEY, null);
  if (!Array.isArray(closed)) { closed = FOLDED_FIRST.slice(); ls(FOLD_KEY, JSON.stringify(closed)); }
  function foldable(card) {
    if (!card || !card.id || card.classList.contains('cl')) return;
    const h = card.querySelector(':scope > h2'); if (!h) return;
    card.classList.add('cl');
    const b = document.createElement('button'); b.className = 'cl-tg'; b.type = 'button'; b.textContent = '▾'; b.setAttribute('aria-label', 'Show or hide this section');
    h.insertBefore(b, h.firstChild);                                     // 1.12.20: always first (it sat after the icon on some cards, after the title on others)
    const set = c => { card.classList.toggle('collapsed', c); b.setAttribute('aria-expanded', String(!c)); };
    set(closed.includes(card.id));
    h.addEventListener('click', e => { if (e.target.closest('button:not(.cl-tg), a, input, select, label')) return; const c = !card.classList.contains('collapsed'); set(c); closed = lsJSON(FOLD_KEY, []); closed = c ? [...new Set([...closed, card.id])] : closed.filter(x => x !== card.id); ls(FOLD_KEY, JSON.stringify(closed)); });
  }
  const foldAll = () => { for (const c of $$('#showCards > .card[id], #playerCards > .card[id]')) foldable(c); for (const id of FOLDED_FIRST) foldable(document.getElementById(id)); };
  let tries = 0; (function wait() { if (document.getElementById('rdCard') || tries++ > 60) { foldAll(); setTimeout(foldAll, 1500); setTimeout(helpAll, 0); setTimeout(helpAll, 1600); } else setTimeout(wait, 150); })();

  // ======================================================================================== Add to OBS
  const SRC = {
    music: { path: '/music-player', name: 'BeeboScore Music', w: 320, h: 120, audio: true, what: 'the music player' },
    venue: { path: '/venue', name: 'BeeboScore Venue screen', w: 1920, h: 1080, what: 'the venue screen' },
    vertical: { path: '/vertical', name: 'BeeboScore Vertical scoreboard', w: 1080, h: 1920, what: 'the vertical scoreboard' },
  };
  const pathOf = u => { try { return new URL(u).pathname.replace(/\/+$/, ''); } catch (e) { return ''; } };
  async function inObs(o) {
    const { inputs } = await o.call('GetInputList', { inputKind: 'browser_source' }), out = {};
    for (const i of inputs) { const st = ((await o.call('GetInputSettings', { inputName: i.inputName })) || {}).inputSettings || {}, p = pathOf(st.url); for (const [k, s] of Object.entries(SRC)) if (p === s.path) out[k] = i.inputName; }
    return { found: out, names: new Set(inputs.map(i => i.inputName)) };
  }
  window.BeeboAddToObs = async function (kind) {
    const s = SRC[kind]; if (!s) return '';
    if (!window.BeeboOBS) { toast('Adding sources needs OBS — Settings › OBS connection', true); return ''; }
    let o = null;
    try {
      o = await window.BeeboOBS.connect();
      const have = await inObs(o);
      if (have.found[kind]) { toast(`${s.what[0].toUpperCase() + s.what.slice(1)} is in OBS already (“${have.found[kind]}”)`); return 'there'; }
      const sc = (await o.call('GetCurrentProgramScene')) || {}, scene = sc.currentProgramSceneName || sc.sceneName;
      let name = s.name, n = 2; while (have.names.has(name)) name = `${s.name} ${n++}`;
      await o.call('CreateInput', { sceneName: scene, inputName: name, inputKind: 'browser_source', inputSettings: { url: location.origin.replace(/\/\/[^/:]+/, '//127.0.0.1') + s.path, width: s.w, height: s.h, reroute_audio: !!s.audio, shutdown: false } });
      toast(`Added “${name}” to the “${scene}” scene in OBS`); return 'added';
    } catch (e) { toast('Couldn’t add it to OBS — check Settings › OBS connection (' + (e.message || e) + ')', true); return ''; }
    finally { try { o && o.disconnect(); } catch (e) {} }
  };
  window.BeeboObsSources = async function () { let o = null; try { o = await window.BeeboOBS.connect(); return (await inObs(o)).found; } catch (e) { return null; } finally { try { o && o.disconnect(); } catch (e) {} } };
  document.addEventListener('click', e => { const b = e.target.closest('[data-add-obs]'); if (!b) return; e.preventDefault(); b.disabled = true; window.BeeboAddToObs(b.dataset.addObs).then(r => { b.disabled = false; if (r) window.dispatchEvent(new CustomEvent('beebo:obs-sources')); }); });

  // ======================================================================================== the rail: hide or reorder tabs (this PC)
  const RAIL_KEY = 'rail';
  const railBtns = () => $$('nav.rail button[data-tab]');
  function applyRail() {
    const r = lsJSON(RAIL_KEY, { hide: [], order: [] }), nav = $('nav.rail'), grow = nav && $('.grow', nav); if (!nav) return;
    const btns = railBtns().filter(b => b.dataset.tab !== 'settings');
    const ord = (r.order || []).filter(t => btns.some(b => b.dataset.tab === t)), rest = btns.map(b => b.dataset.tab).filter(t => !ord.includes(t));
    for (const t of [...ord, ...rest]) { const b = btns.find(x => x.dataset.tab === t); if (b) nav.insertBefore(b, grow || null); }
    for (const b of btns) b.classList.toggle('q-hide', (r.hide || []).includes(b.dataset.tab) && !b.classList.contains('on'));
  }
  P.rail = { get: () => lsJSON(RAIL_KEY, { hide: [], order: [] }), set: r => { ls(RAIL_KEY, JSON.stringify(r)); applyRail(); }, apply: applyRail };
  applyRail(); addEventListener('beebo:tab', () => applyRail());
  function railCard() {
    const set = $('main section.tab[data-tab="settings"]'); if (!set || document.getElementById('railCard')) return;
    const c = document.createElement('div'); c.className = 'card'; c.id = 'railCard';
    c.innerHTML = `<h2>🧭 Tabs on the left</h2><p class="hint" style="margin:-4px 0 10px">Hide the tabs you don't use and put the rest in your own order. This PC only; Settings always stays at the bottom, and a hidden tab still opens from Jump to (Ctrl+K).</p><div class="q-rail" id="railList"></div><div class="flexrow" style="margin-top:8px"><button class="btn sm ghost" type="button" id="railReset">Back to how it was</button></div>`;
    set.appendChild(c);
    const draw = () => { const r = P.rail.get(), btns = railBtns().filter(b => b.dataset.tab !== 'settings');
      $('#railList').innerHTML = btns.map((b, i) => `<div class="q-rr" data-t="${b.dataset.tab}"><label class="toggle"><input type="checkbox" data-show${(r.hide || []).includes(b.dataset.tab) ? '' : ' checked'} aria-label="Show the ${esc(b.textContent.trim())} tab"><span class="sw"></span></label><span>${esc(b.textContent.trim())}</span><button class="btn xs ghost" type="button" data-mv="-1" aria-label="Move ${esc(b.textContent.trim())} up"${i ? '' : ' disabled'}>↑</button><button class="btn xs ghost" type="button" data-mv="1" aria-label="Move ${esc(b.textContent.trim())} down"${i < btns.length - 1 ? '' : ' disabled'}>↓</button></div>`).join(''); };
    $('#railList').addEventListener('change', e => { const row = e.target.closest('[data-t]'); if (!row) return; const r = P.rail.get(), t = row.dataset.t; r.hide = (r.hide || []).filter(x => x !== t); if (!e.target.checked) r.hide.push(t); P.rail.set(r); });
    $('#railList').addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (!b) return; const r = P.rail.get(), tabs = railBtns().filter(x => x.dataset.tab !== 'settings').map(x => x.dataset.tab), t = b.closest('[data-t]').dataset.t, i = tabs.indexOf(t), j = i + Number(b.dataset.mv); if (j < 0 || j >= tabs.length) return; [tabs[i], tabs[j]] = [tabs[j], tabs[i]]; r.order = tabs; P.rail.set(r); draw(); const nb = $(`#railList [data-t="${t}"] [data-mv="${b.dataset.mv}"]`); if (nb && !nb.disabled) nb.focus(); });
    $('#railReset').onclick = () => { ls(RAIL_KEY, null); location.reload(); };
    draw();
  }
  setTimeout(railCard, 900);

  // ======================================================================================== a short tour of the new tabs (once, after the update)
  const TOUR = [
    [null, 'Find anything', 'Press Ctrl+K and type what you want — “swap” swaps the players, “bracket” opens the bracket view. The bell next to it keeps the last 50 messages.'],
  ];
  function tour() {
    const box = document.createElement('div'); box.className = 'q-tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'false'); box.setAttribute('aria-labelledby', 'qTourT');
    document.body.appendChild(box); let i = 0;
    const end = () => { box.remove(); $$('.q-tour-on').forEach(x => x.classList.remove('q-tour-on')); ls('tour1219', '1'); };
    const step = () => {
      $$('.q-tour-on').forEach(x => x.classList.remove('q-tour-on'));
      const [tab, t, x] = TOUR[i], b = tab ? $(`nav.rail button[data-tab="${tab}"]`) : $('#jumpBtn');
      box.innerHTML = `<b id="qTourT">${esc(t)}</b><p>${esc(x)}</p><div class="flexrow" style="gap:8px"><span class="hint">${i + 1} of ${TOUR.length}</span><span class="spacer"></span><button class="btn sm ghost" type="button" data-t="skip">Skip</button><button class="btn sm primary" type="button" data-t="next">${i === TOUR.length - 1 ? 'Done' : 'Next'}</button></div>`;
      const r = b && b.offsetParent ? b.getBoundingClientRect() : null;
      if (b) b.classList.add('q-tour-on');
      if (r && tab) { box.style.left = (r.right + 12) + 'px'; box.style.top = Math.max(70, Math.min(innerHeight - 200, r.top - 10)) + 'px'; box.style.right = 'auto'; }
      else if (r) { box.style.left = 'auto'; box.style.right = Math.max(8, innerWidth - r.right) + 'px'; box.style.top = (r.bottom + 10) + 'px'; }
      setTimeout(() => { const n = $('[data-t=next]', box); if (n) n.focus(); }, 30);
    };
    box.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'skip' || i === TOUR.length - 1) return end(); i++; step(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') end(); });
    step();
  }
  // after an update only (a first run has its own setup guide — and "What's new" marks this version seen a moment after
  // the panel opens, so whether this PC had a version before is read now), and not on the remote pages
  const hadVersion = ls('seenVersion');
  setTimeout(() => { if (ls('tour1219') || !hadVersion || !local() || document.querySelector('.wiz:not([hidden]), .modal.open')) return; ls('tour1219', '1'); tour(); }, 2600);
  P.tour = tour;

  // ======================================================================================== windows: focus stays inside, and comes back
  const OPEN = '.modal.open, .wiz:not([hidden]), .pm:not([hidden]), .jump:not([hidden]), [role="dialog"][aria-modal="true"]:not(.bask)';
  const openWin = () => $$(OPEN).filter(x => x.offsetParent !== null || getComputedStyle(x).position === 'fixed').filter(x => !x.hidden && x.getClientRects().length).pop();
  let lastWin = null, back = null;
  setInterval(() => { const w = openWin() || null; if (w !== lastWin) { if (w && !lastWin) back = document.activeElement; if (!w && lastWin && back && document.contains(back) && !document.querySelector('.bask')) { try { back.focus(); } catch (e) {} back = null; } lastWin = w; } }, 250);
  addEventListener('keydown', e => {
    if (e.key !== 'Tab' || document.querySelector('.bask')) return;
    const w = openWin(); if (!w) return;
    const f = $$('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', w).filter(x => x.offsetParent !== null);
    if (!f.length) return; const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });

  // ======================================================================================== help: a "?" on each Show and Players card
  const HELP = {
    rdCard: ['The rundown', 'The night as segments: each can bring up a screen, switch OBS scenes, run an automation and mark a VOD chapter. Next (here, the Stream Deck or Ctrl+K) moves on.', 'the-rundown'],
    osCard: ['On screen', 'Full screens for between sets: countdowns, Coming up, walk-ins, the event in numbers, the season table and storylines. One at a time, never over a splash.', 'on-screen'],
    rehCard: ['Rehearsal', 'Plays a made-up set through every screen so you can check OBS and your keys. Nothing is saved, reported or posted, and everything goes back at the end.', 'rehearsal'],
    slCard: ['The show log', 'Everything that went on stream, newest first, with who did it. Filter it, search it, save it, or undo back to any moment.', 'the-show-log'],
    rpCard: ['Replay 2.0', 'Slow motion, freeze and drawing over the instant replay. Ctrl+Z on the pad takes the last stroke away.', 'replay-20'],
    vidCard: ['Recap video and vertical clips', 'Both use FFmpeg. The recap joins the night’s highlight clips; Clip this saves the last moments as a 1080 × 1920 video.', 'recap-video-and-vertical-clips'],
    venCard: ['Venue screen', 'A full-screen page for a TV at the event: what’s on now, up next, the bracket, the time and a QR code.', 'venue-screen'],
    prCard: ['Player profiles', 'One profile per player. start.gg fills in what it knows, never over what you typed. Import a spreadsheet, merge duplicates and add other names they go by.', 'player-profiles'],
    stCard: ['Storylines', 'Talking points for the set that’s on, from Player history and the bracket.', 'storylines'],
    evCard: ['The event in numbers', 'Sets, games, comebacks and characters so far today.', 'the-event-in-numbers'],
    seCard: ['Seasons', 'Points across your weeklies. Add a finished bracket, show the table on stream, or save it as a spreadsheet.', 'seasons'],
  };
  function helpAll() {
    for (const [id, [t, x]] of Object.entries(HELP)) {
      const c = document.getElementById(id), h = c && c.querySelector(':scope > h2'); if (!h || h.querySelector('.help-q')) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'help-q'; b.textContent = '?'; b.setAttribute('aria-label', `What is ${t}?`); b.setAttribute('aria-expanded', 'false');
      b.onclick = e => { e.stopPropagation(); const open = $('.help-pop'); if (open) { open.remove(); $$('.help-q[aria-expanded=true]').forEach(q => q.setAttribute('aria-expanded', 'false')); if (open.dataset.for === id) return; }
        const pp = document.createElement('div'); pp.className = 'help-pop'; pp.dataset.for = id; pp.setAttribute('role', 'note');
        pp.innerHTML = `<b>${esc(t)}</b><p>${esc(x)}</p><p class="hint">More in the online guide: <i>The show</i> › ${esc(t)}.</p>`;
        document.body.appendChild(pp); const r = b.getBoundingClientRect(); pp.style.top = (r.bottom + scrollY + 6) + 'px'; pp.style.left = Math.max(8, Math.min(innerWidth - 340, r.left + scrollX - 150)) + 'px'; b.setAttribute('aria-expanded', 'true'); };
      const sp = h.querySelector('.spacer'); h.insertBefore(b, sp || null);
    }
  }
  document.addEventListener('mousedown', e => { const p2 = $('.help-pop'); if (p2 && !p2.contains(e.target) && !e.target.closest('.help-q')) { p2.remove(); $$('.help-q[aria-expanded=true]').forEach(q => q.setAttribute('aria-expanded', 'false')); } });
  addEventListener('keydown', e => { if (e.key === 'Escape') { const p2 = $('.help-pop'); if (p2) p2.remove(); } });
})();
