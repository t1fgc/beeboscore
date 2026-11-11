/* BeeboScore — sending set results back to start.gg: the Bracket-tab card (Off / Ask / Automatic + what was sent,
 * with Undo) and the "📤 Report" button on the Matches tab's win card. The app does the sending (lib/startgg.js). */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P;
  const $ = s => document.querySelector(s);
  let R = { v: 0, mode: 'ask', can: false, list: [] };
  const take = x => { if (x && (x.v || 0) >= (R.v || 0)) R = x; render(); };   // answers can arrive after a newer push
  const HINT = {
    off: 'Results stay in BeeboScore — report them on start.gg yourself.',
    ask: 'When a set is won, the win card on the Match tab gets a "📤 Report" button.',
    auto: 'Sent by itself 10 seconds after a set is won (fix a mis-click before then). Needs an account that can report for this tournament.',
  };
  const STATUS = { pending: '⏳ Waiting to send', sending: '⏳ Sending', sent: '✅ Sent', failed: '⚠️ Not sent', undone: '↩️ Undone', undoing: '⏳ Undoing', replaced: '↪️ Replaced' };
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  function render() {
    const card = $('#sggReportCard'); if (!card) return;
    const st = P.state && P.state();
    card.hidden = !R.on;
    for (const b of card.querySelectorAll('[data-rm]')) b.classList.toggle('on', b.dataset.rm === R.mode);
    $('#sggReportHint').textContent = HINT[R.mode] || '';
    $('#sggReportList').innerHTML = R.list.length ? R.list.map(r => `<div class="rep-row ${esc(r.status)}"><span class="rep-st">${STATUS[r.status] || esc(r.status)}</span><b>${esc((r.names || [])[0] || '?')}</b> beat ${esc((r.names || [])[1] || '?')} <span class="rep-sc">${esc(r.score)}</span><span class="rep-rd">${esc(r.round || '')}</span><span class="spacer"></span><span class="rep-at">${ago(r.at)}</span>${r.status === 'sent' || r.status === 'pending' ? `<button class="btn sm ghost" data-undo="${esc(r.setId)}">Undo</button>` : ''}${r.error && r.status === 'failed' ? `<div class="rep-err">${esc(r.error)}</div>` : ''}</div>`).join('') : '<p class="hint" style="margin:0">Nothing sent yet.</p>';
    const btn = $('#winReport');
    if (btn) {
      const last = R.list[0], cur = st && st.setId && last && last.setId === String(st.setId) && ['sent', 'pending', 'sending'].includes(last.status) ? last : null;
      btn.hidden = !(R.can && R.mode !== 'off') || (R.mode === 'auto' && !cur);
      const w = st ? (Number(st.p1.score) > Number(st.p2.score) ? st.p1 : st.p2) : null, l = st ? (w === st.p1 ? st.p2 : st.p1) : null;
      btn.textContent = cur ? (cur.status === 'sent' ? '✅ Sent to start.gg' : '⏳ Sending to start.gg…') : `📤 Report ${w ? w.score : ''}–${l ? l.score : ''} to start.gg`;
      btn.disabled = !!cur && cur.status !== 'failed';
    }
  }
  async function load() { try { take(await api('/api/startgg/reports')); } catch {} }
  document.addEventListener('click', async e => {
    const m = e.target.closest('[data-rm]');
    if (m && m.closest('#sggReportMode')) { R = { ...R, mode: m.dataset.rm }; render(); P.saveSettings({ sggReport: m.dataset.rm }, m.dataset.rm === 'auto' ? 'Results will go to start.gg by themselves' : ''); return; }
    const u = e.target.closest('[data-undo]');
    if (u) { try { take(await api('/api/startgg/report/undo', { method: 'POST', body: { setId: u.dataset.undo } })); toast('Undoing on start.gg…'); } catch (err) { toast(err.message, true); } return; }
    if (e.target.closest('#winReport')) {
      const st = P.state();
      try { take(await api('/api/startgg/report', { method: 'POST', body: { setId: st && st.setId } })); toast('Sending the result to start.gg…'); } catch (err) { toast(err.message, true); }
    }
  });
  window.addEventListener('beebo:sggreports', e => take(e.detail));
  window.addEventListener('beebo:state', () => render());
  let lt = 0; window.addEventListener('beebo:bracket', () => { if (Date.now() - lt > 5000) { lt = Date.now(); load(); } });
  setInterval(() => { if (R.list.length && !document.hidden) render(); }, 30000);
  load();
})();
