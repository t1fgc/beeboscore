/* BeeboScore (developed by Beebo) — the caster tools in Matches › Player history (stats card, notes).
 * (The full BeeboScore also has VOD chapters & highlights, Sponsors, the Second operator's remote and Stations here.) */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const P = () => window.BeeboPanel || {};
  const api = (u, o) => P().api(u, o), toast = (m, bad) => P().toast && P().toast(m, bad);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const post = (u, body) => api(u, { method: 'POST', body });
  const copy = (t, m) => (P().copy ? P().copy(t, m) : navigator.clipboard.writeText(t).then(() => toast(m || 'Copied')));
  const ready = f => { if (window.BeeboPanel) f(); else setTimeout(() => ready(f), 100); };

  // ------------------------------------------------------------------ caster tools (Matches › Player history)
  function casters() {
    if (!$('#stats1')) return;
    const act = b => post('/api/remote/action', b).catch(e => toast(e.message, true));
    $('#stats1').onclick = () => act({ action: 'stats', side: 1, show: true });
    $('#stats2').onclick = () => act({ action: 'stats', side: 2, show: true });
    $('#statsOff').onclick = () => act({ action: 'stats', side: 1, show: false });
    let names = ['', ''], t = [0, 0];
    const fill = async () => {
      const s = (P().state && P().state()) || {}, n = [s.p1 && s.p1.name || '', s.p2 && s.p2.name || ''];
      for (const i of [0, 1]) {
        if (n[i] === names[i]) continue; names[i] = n[i];
        const ta = $('#note' + (i + 1)); if (document.activeElement === ta) continue;
        $(`#note${i + 1}L`).textContent = n[i] ? `Notes on ${n[i]}${i ? '' : ' (only you and the casters see these)'}` : `Notes on Player ${i + 1}`;
        ta.disabled = !n[i]; ta.value = n[i] ? (await api('/api/notes?name=' + encodeURIComponent(n[i])).catch(() => ({ text: '' }))).text : '';
      }
      const st = s.stats || {}; for (const k of [1, 2]) $('#stats' + k).classList.toggle('on', !!(st.show && Number(st.side) === k));
    };
    for (const i of [0, 1]) $('#note' + (i + 1)).addEventListener('input', e => { clearTimeout(t[i]); const nm = names[i], v = e.target.value; t[i] = setTimeout(() => nm && post('/api/notes', { name: nm, text: v }), 600); });
    setInterval(fill, 1000); fill();
  }

  ready(() => { try { casters(); } catch (e) { console.error(e); } });      // (Lite: the caster tools only)
})();
