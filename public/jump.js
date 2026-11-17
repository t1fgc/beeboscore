/* BeeboScore (developed by Beebo) — Jump to… (Ctrl+K, or the search bar in the header): one search box for the whole app.
 * Type a few letters of anything — a tab, a panel ("bracket view", "manage players", "sound"), an action ("show VS",
 * "swap", "undo", "theme glacier") — and press Enter to go there or do it.
 */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tabName = t => { const b = $(`nav.rail button[data-tab="${t}"]`); return b ? b.textContent.trim() : t; };
  const click = sel => () => { const el = $(sel); if (el && !el.disabled) { el.click(); return true; } P.toast('That isn’t available right now', true); };
  const THEMES = [['classic', 'Classic'], ['shattered', 'Ember'], ['hive', 'Hive'], ['dojo', 'Ink Dojo'], ['circuit', 'Circuit'], ['street', 'Street'], ['glacier', 'Glacier'], ['contrast', 'High contrast'], ['custom', 'Your own']];
  function index() {
    const out = [];
    for (const b of $$('nav.rail button[data-tab]')) if (!b.hidden && (b.offsetParent !== null || b.classList.contains('q-hide'))) out.push({ ic: '➜', t: b.textContent.trim(), sub: 'Tab', go: () => P.showTab(b.dataset.tab) });
    for (const sec of $$('section.tab[data-tab]')) {
      const tab = sec.dataset.tab; if ($(`nav.rail button[data-tab="${tab}"]`) && $(`nav.rail button[data-tab="${tab}"]`).hidden) continue;
      for (const h of $$('.card > h2', sec)) {
        const card = h.parentNode, txt = [...h.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.matches('button, select, input, .pill, .spacer, .seg, small'))).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 60) continue;
        out.push({ ic: '▤', t: txt, sub: tabName(tab), hidden: card.hidden, go: () => { P.showTab(tab); setTimeout(() => { if (card.hidden) return P.toast(`“${txt}” shows up once it’s needed`); card.scrollIntoView({ block: 'start', behavior: 'smooth' }); card.classList.add('jump-flash'); setTimeout(() => card.classList.remove('jump-flash'), 1300); }, 60); } });
      }
    }
    const A = (t, sub, fn, words = '') => out.push({ ic: '⚡', t, sub, go: fn, words });
    A('Update the overlay', 'Matches', click('#updateBtn'), 'send push');
    A('Swap players', 'Matches', click('#swapBtn'), 'switch sides'); A('Reset scores', 'Matches', click('#resetBtn'), '0 zero');
    A('Undo the last change', 'Matches', click('#undoBtn')); A('Show / hide the VS (FullVS or GlassVS)', 'Matches', click('#vsBtn, #vsToggle'), 'versus splash');
    A('Open the mini window', 'Matches', click('#miniBtn'), 'small controller always on top');
    A('Bracket view (start.gg)', 'Bracket', () => { P.showTab('bracket'); const b = $('#sggView [data-v=tree]'); if (b && $('#sggSetsCard') && !$('#sggSetsCard').hidden) { b.click(); $('#sggSetsCard').scrollIntoView({ block: 'start' }); } else P.toast('Load a start.gg event first'); }, 'tree');
    A('Manage players (game format)', 'Format', () => { P.showTab('format'); const c = $('#fmtBoardCard'); if (c && !c.hidden) c.scrollIntoView({ block: 'start' }); else P.toast('Start a format first — the player manager shows up then'); }, 'lives points');
    for (const [k, n] of THEMES) A(`Theme: ${n}`, 'Settings', () => { const b = $(`#themePick [data-theme="${k}"]`); if (b) b.click(); }, 'look colours colors');
    // 1.12.19: actions straight from here, the same as the Stream Deck keys
    const act = (body, ok) => () => P.api('/api/remote/action', { method: 'POST', body }).then(() => { if (ok) P.toast(ok); }).catch(e => P.toast(e.message, true));
    // 1.12.21: the set as it's told
    A('Set timer: start / stop', 'Matches', click('#tmBtn'), 'clock time how long set length');
    A('Set timer: hide', 'Matches', act({ action: 'timer', do: 'hide' }, 'Set timer hidden'), 'clock off');
    A('Head-to-head line: show / hide', 'Matches', click('#h2hBtn'), 'history record versus h2h lead');
    A('Stats strip on FullVS and GlassVS: on / off', 'Matches', click('#stripBtn'), 'seed record head to head runback vs splash');
    A('Bracket reset splash: show / hide', 'Matches', click('#gresetBtn'), 'grand final reset gf splash');
    A('Moments: replay the last one', 'Matches', act({ action: 'moments', do: 'replay' }, 'The moment is back on stream'), 'banner again match point comeback sweep upset');
    A('Moments: banners on / off', 'Matches', click('#moOn'), 'banner match point comeback sweep upset runback switch');
    A('Moments and the game counter (Settings)', 'Settings', () => { P.showTab('settings'); if (P.settingsSection) P.settingsSection('setBehave'); setTimeout(() => { const c = document.getElementById('setMomentsOpt'); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('jump-flash'); setTimeout(() => c.classList.remove('jump-flash'), 1400); } }, 60); }, 'match point comeback sweep upset runback losers run reset seed gap game counter time every set');
    return out;
  }
  function score(it, q) {
    const t = norm(it.t), all = t + ' ' + norm(it.sub) + ' ' + norm(it.words);
    if (!q) return 1;
    if (t.startsWith(q)) return 100 - t.length / 100;
    if (t.includes(q)) return 80 - t.indexOf(q);
    const ws = q.split(' ');
    if (ws.every(w => all.includes(w))) return 60;
    let k = 0; for (const ch of t) if (ch === q[k]) k++;
    return k === q.replace(/ /g, '').length ? 20 : -1;
  }
  // the palette
  const box = document.createElement('div'); box.className = 'jump'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Jump to');
  box.innerHTML = '<div class="jump-box"><input type="search" class="jump-in" placeholder="Jump to a tab, a panel or an action…" aria-label="Jump to" autocomplete="off"><div class="jump-list" role="listbox"></div><div class="jump-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> pick</span><span><kbd>Enter</kbd> go</span><span><kbd>Esc</kbd> close</span></div></div>';
  document.body.appendChild(box);
  const inp = $('.jump-in', box), list = $('.jump-list', box);
  let items = [], shown = [], act = 0;
  const draw = () => {
    const q = norm(inp.value);
    shown = items.map(it => [score(it, q), it]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map(x => x[1]);
    act = Math.min(act, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((it, i) => `<button class="jump-it${i === act ? ' act' : ''}" data-i="${i}" role="option"><span>${esc(it.ic)}</span><span>${esc(it.t)}${it.hidden ? ' <small>(not showing yet)</small>' : ''}</span><i>${esc(it.sub)}</i></button>`).join('') || '<p class="hint" style="padding:8px 10px">Nothing matches — try another word.</p>';
    const a = $('.jump-it.act', list); if (a) a.scrollIntoView({ block: 'nearest' });
  };
  const openJump = () => { items = index(); inp.value = ''; act = 0; box.hidden = false; draw(); setTimeout(() => inp.focus(), 0); };
  const closeJump = () => { box.hidden = true; };
  const go = i => { const it = shown[i]; if (!it) return; closeJump(); it.go(); };
  inp.addEventListener('input', () => { act = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(shown.length - 1, act + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(act); }
    else if (e.key === 'Escape') { e.preventDefault(); closeJump(); }
  });
  list.addEventListener('click', e => { const b = e.target.closest('.jump-it'); if (b) go(+b.dataset.i); });
  box.addEventListener('mousedown', e => { if (e.target === box) closeJump(); });
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); box.hidden ? openJump() : closeJump(); } });
  // the search bar in the header
  const hb = document.createElement('button'); hb.className = 'jump-btn'; hb.type = 'button'; hb.id = 'jumpBtn'; hb.title = 'Jump to any tab, panel or action (Ctrl+K)';
  hb.innerHTML = '<span>Jump to…</span><kbd>Ctrl K</kbd>'; hb.onclick = openJump;
  const st = $('.head .status'); if (st) st.parentNode.insertBefore(hb, st);
  window.BeeboJump = { open: openJump, close: closeJump };
})();
