/* BeeboScore (developed by Beebo), 1.12.21 — the panel's side of the moments (lib/moments.js) and the set's small extras.
 *
 *   Matches tab › The set    the set timer (start · stop · start over from zero; Hide), the head-to-head line, Replay the
 *                            moment, and the Moments switch
 *   Settings › Scoreboard    the game counter, timing every set, the moments — all of them, each one, a try-out of each on
 *                            stream — and the seed gap an upset needs
 *
 * What's on stream comes with the scoreboard's own state (the timer as the app counted it, so a phone with a wrong clock
 * still shows the right time); which moments are on comes with the settings; the last moment comes with the show's view.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const P = () => window.BeeboPanel || {};
  const api = (u, o) => P().api(u, o), toast = (m, bad) => P().toast && P().toast(m, bad);
  const act = b => api('/api/remote/action', { method: 'POST', body: b }).catch(e => { toast(e.message, true); throw e; });
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = ms => { const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  const ready = f => { if (window.BeeboPanel && $('#setRow') && $('#moKinds')) f(); else setTimeout(() => ready(f), 120); };
  // what each moment is called here (the app sends the same list; this one is there before it answers)
  const KINDS = [['game', 'moGame', 'A game is won', 'The score flips and flashes in the player’s colour, and a pip fills', false], ['matchpoint', 'moMatchPoint', 'Match point', 'One game from the set — or “Final game” when both are', true],
    ['comeback', 'moComeback', 'Comeback on', 'Two or more games down, and level again', true], ['reversesweep', 'moReverseSweep', 'Reverse sweep', 'Won from one game from going out', true], ['sweep', 'moSweep', 'Sweep', 'Won without dropping a game', true],
    ['upset', 'moUpset', 'Upset', 'The lower seed won (the bracket’s seeds)', true], ['runback', 'moRunback', 'Runback', 'The same two players met earlier today', true], ['losersrun', 'moLosersRun', 'Losers run', 'Three or more sets won in a row in losers', true],
    ['reset', 'moReset', 'Grand Final reset', 'The losers-side player won the first Grand Final set', true]];

  ready(() => {
    const S = () => (P().settings && P().settings()) || {};
    let view = null, tm = null, tmAt = 0, tick = 0;

    // ------------------------------------------------------------------ Matches › The set
    function drawSet(st) {
      st = st || (P().state && P().state()) || {};
      const t = st.timer || {}, x = (st.x && st.x.timer) || null, shown = !!t.show;
      if (x && (!tm || x.ms !== tm.ms || x.run !== tm.run || shown !== tm.shown)) { tm = { ms: Number(x.ms) || 0, run: !!x.run, shown }; tmAt = Date.now(); } else if (!x) tm = null;
      const run = !!(tm && tm.run);
      $('#tmBtn').classList.toggle('on', shown); $('#tmBtn').setAttribute('aria-pressed', String(shown));
      $('#tmBtn').title = !shown ? 'Start the set timer: it shows in the header on stream. Settings › Scoreboard can time every set by itself.' : run ? 'The set timer is running — press to stop it' : 'The set timer is stopped — press to start again from zero';
      $('#tmHide').hidden = !shown;
      clearInterval(tick); const now = () => { $('#tmNow').textContent = tm && shown ? clock(tm.ms + (tm.run ? Date.now() - tmAt : 0)) + (tm.run ? '' : ' ■') : ''; }; now();
      if (run && shown) tick = setInterval(now, 500);
      const on = !!(st.h2h && st.h2h.show), line = st.hist && st.hist.line ? (st.hist.line === 'First meeting' ? 'First meeting on stream' : st.hist.line) : '';
      $('#h2hBtn').classList.toggle('on', on); $('#h2hBtn').setAttribute('aria-pressed', String(on));
      $('#h2hBtn').title = (on ? 'On stream now' : 'Show it on stream') + (line ? `: “${line}”` : ' — it needs two players on the scoreboard') + '. It steps aside for a moment’s banner and during a game format.';
      const up = !!(view && view.now && view.last);                         // (a banner comes with the show's view; the scoreboard's own state doesn't move for it)
      $('#moLast').textContent = up ? `On stream: ${view.last.title}` : view && view.last ? `Last: ${view.last.title}` : '';
      $('#moLast').title = view && view.last ? view.last.text || '' : '';
      $('#moReplay').disabled = !(view && view.last);
      // 1.12.23: the stats strip (a setting: on for every FullVS and GlassVS) and the Bracket reset splash (on stream or not)
      const so = S().vsStrip !== false, gr = !!(st.full && st.full.show === 'greset');
      $('#stripBtn').classList.toggle('on', so); $('#stripBtn').setAttribute('aria-pressed', String(so));
      $('#gresetBtn').classList.toggle('on', gr); $('#gresetBtn').setAttribute('aria-pressed', String(gr));
      $('#moOn').checked = S().moments !== false;
    }
    $('#tmBtn').onclick = () => act({ action: 'timer', do: 'toggle' }).catch(() => {});
    $('#tmHide').onclick = () => act({ action: 'timer', do: 'hide' }).catch(() => {});
    $('#h2hBtn').onclick = () => act({ action: 'h2h' }).catch(() => {});
    $('#stripBtn').onclick = () => act({ action: 'strip', do: 'toggle' }).then(r => toast(r.strip ? 'Stats strip on: FullVS and GlassVS show it' : 'Stats strip off')).catch(() => {});
    $('#gresetBtn').onclick = () => act({ action: 'greset' }).catch(() => {});
    $('#moReplay').onclick = () => act({ action: 'moments', do: 'replay' }).then(() => toast('The moment is back on stream')).catch(() => {});
    $('#moOn').onchange = e => P().saveSettings({ moments: e.target.checked }, e.target.checked ? 'Moment banners on' : 'Moment banners off');

    // ------------------------------------------------------------------ Settings › Scoreboard
    function drawSettings() {
      const s = S(), all = s.moments !== false;
      $('#setGameNo').checked = s.sbGameNo !== false; $('#setSbTimer').checked = !!s.sbTimer; $('#setMoments').checked = all;
      $('#setUpsetGap').value = String(s.upsetGap || '4');
      $('#setVsStrip').checked = s.vsStrip !== false; $('#setResetSplash').checked = s.resetSplash !== false;
      $('#moSet').classList.toggle('off', !all);
      const box = $('#moKinds');
      if (!box.children.length) {
        box.innerHTML = KINDS.map(([k, key, label, hint, banner]) => `<div class="mo-kind" data-k="${k}"><label class="toggle" title="${esc(label)}"><input type="checkbox" data-set="${key}" aria-label="${esc(label)}"><span class="sw"></span></label>
          <span class="t"><b>${esc(label)}</b><small>${esc(hint)}</small></span>${banner ? `<button class="btn sm ghost" type="button" data-try="${k}" title="Show this banner on stream now, with the players on the scoreboard">▶ Try</button>` : ''}</div>`).join('');
        if (window.BI) BI.convert(box);
      }
      for (const i of box.querySelectorAll('input[data-set]')) { i.checked = s[i.dataset.set] !== false; i.disabled = !all; }
      for (const b of box.querySelectorAll('[data-try]')) b.disabled = !all;
      $('#setUpsetGap').disabled = !all || s.moUpset === false;
    }
    $('#setGameNo').onchange = e => P().saveSettings({ sbGameNo: e.target.checked }, e.target.checked ? 'The header counts the games' : 'No game counter in the header');
    $('#setSbTimer').onchange = e => P().saveSettings({ sbTimer: e.target.checked }, e.target.checked ? 'Every set is timed from its first moment' : 'The set timer only runs when you start it');
    $('#setMoments').onchange = e => P().saveSettings({ moments: e.target.checked }, e.target.checked ? 'Moment banners on' : 'Moment banners off');
    $('#setVsStrip').onchange = e => P().saveSettings({ vsStrip: e.target.checked }, e.target.checked ? 'Stats strip on: FullVS and GlassVS show it' : 'Stats strip off');
    $('#setResetSplash').onchange = e => P().saveSettings({ resetSplash: e.target.checked }, e.target.checked ? 'The Bracket reset splash comes up by itself' : 'The Bracket reset splash only shows when you put it up');
    $('#setUpsetGap').onchange = e => P().saveSettings({ upsetGap: e.target.value }, `An upset: a seed gap of ${e.target.value} or more`);
    $('#moKinds').addEventListener('change', e => { const i = e.target.closest('input[data-set]'); if (!i) return; const k = KINDS.find(x => x[1] === i.dataset.set); P().saveSettings({ [i.dataset.set]: i.checked }, `${k ? k[2] : 'Moment'}: ${i.checked ? 'on' : 'off'}`); });
    $('#moKinds').addEventListener('click', e => { const b = e.target.closest('[data-try]'); if (!b) return; act({ action: 'moments', do: 'test', kind: b.dataset.try }).then(() => toast('On stream now — it goes again by itself')).catch(() => {}); });

    addEventListener('beebo:state', e => drawSet(e.detail));
    addEventListener('beebo:settings', () => { drawSettings(); drawSet(); });
    addEventListener('beebo:show', e => { if (e.detail && e.detail.moments) { view = e.detail.moments; drawSet(); } });
    api('/api/show').then(v => { if (v && v.moments) view = v.moments; drawSet(); }).catch(() => {});
    drawSettings(); drawSet();
  });
})();
