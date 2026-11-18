/* BeeboScore (developed by Beebo) — King of the Hill records in the Format tab (Testbuild 1.12.6).
 * This event's table and the Emperor of the World (top 10), live; backup, sheet,
 * restore, open the folder, reset. The records themselves are kept by the app (lib/koth-records.js). */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const P = () => window.BeeboPanel || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (m, bad) => (P().toast || (() => {}))(m, bad);
  const api = (p, o) => P().api(p, o);
  let K = null;

  function shown() {
    const S = P().state ? P().state() : null, f = S && S.format;
    return !!(f && f.preset === 'koth') || !!(K && K.players);
  }
  function render() {
    const card = $('#kothCard'); if (!card) return;
    card.hidden = !shown(); if (card.hidden || !K) return;
    const S = P().state ? P().state() : null, f = S && S.format;
    const king = f && f.preset === 'koth' && f.status === 'live' && window.BeeboFormat ? ((BeeboFormat.get().V || {}).king || '') : '';
    const ev = (K.event && K.event.event) || null, rows = (K.event && K.event.rows) || [];
    $('#kothSub').textContent = `${K.players} players · ${K.fights} fights · ${K.events} ${K.events === 1 ? 'event' : 'events'}${K.since ? ' since ' + new Date(K.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`;
    const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    $('#kothEvent').innerHTML = (ev ? `<div class="none">${esc(ev.name)}${ev.live ? ' · running now' : ' · finished' + (ev.champion ? ' · 👑 ' + esc(ev.champion) : '')}${ev.best ? ` · best streak ×${ev.best} (${esc(ev.bestBy)})` : ''}</div>` : '')
      + (rows.length ? rows.map(r => `<div class="r${same(r.name, king) ? ' king' : ''}"><span class="n">${r.rank}</span><b>${same(r.name, king) ? '👑 ' : ''}${esc(r.name)}</b><span class="n">${r.wins}–${r.losses}</span><span class="n">${r.best ? '×' + r.best : ''}</span></div>`).join('') : '<div class="none">No fights in this event yet.</div>');
    $('#kothEmp').innerHTML = (K.emperors || []).length ? K.emperors.map(r => `<div class="r"><span class="n">${r.rank}</span><b>${esc(r.name)}${r.viewer ? '<i class="vw">viewer</i>' : ''}</b><span class="n">${r.wins}–${r.losses}</span><span class="n">${r.kings ? '👑' + r.kings : ''}</span></div>`).join('') : '<div class="none">Nobody yet — every King of the Hill fight counts.</div>';
    const sp = (S && S.splash && S.splash.show) || ''; $('#kothLead').classList.toggle('on', sp === 'flead');
    if (K.files) $('#kothFiles').textContent = `Kept in ${K.files.json} — and as a sheet, rewritten after every fight, in ${K.files.csv}`;
  }
  async function load() { try { K = await api('/api/koth'); render(); } catch {} }

  window.addEventListener('beebo:koth', e => { K = { ...(K || {}), ...e.detail }; render(); });
  window.addEventListener('beebo:state', () => {
    const lead = $('#fsLead'), S = P().state ? P().state() : null, f = S && S.format;
    if (lead) lead.hidden = !(f && f.preset === 'koth');
    render();
  });
  $('#kothLead').onclick = () => api('/api/remote/action', { method: 'POST', body: { action: 'format', do: 'splash', kind: 'flead', show: 'toggle' } }).catch(e => toast(e.message, true));
  $('#kothFolder').onclick = () => api('/api/koth/open-folder', { method: 'POST' }).catch(e => toast(e.message, true));
  $('#kothImport').onclick = () => $('#kothFile').click();
  $('#kothFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch { return toast('That file isn’t a backup BeeboScore can read.', true); }
    const how = await BeeboAsk.choice({ title: 'Restore King of the Hill records', text: 'Merge adds the backup to the records you have now. Replace swaps them for the backup, and what’s here now is lost (download a backup first if you want to keep it).', list: true,
      options: [{ label: 'Merge', hint: 'Wins and losses add up', value: 'merge', primary: true }, { label: 'Replace', hint: 'The records here are lost', value: 'replace', danger: true }] });
    if (!how) return; const merge = how === 'merge';
    try { K = await api('/api/koth/import', { method: 'POST', body: { data, merge } }); render(); toast(merge ? 'Backup merged into the records' : 'Records restored from the backup'); load(); } catch (er) { toast(er.message, true); }
  };
  $('#kothReset').onclick = async () => {
    const ok = await BeeboAsk.text({ title: 'Reset the King of the Hill records?', text: 'Every player, event and fight since the first one is cleared, and the Emperor of the World starts over. This can’t be undone: download a backup first if you might want them back.', label: 'Type RESET to confirm', placeholder: 'RESET', max: 10, ok: 'Reset the records', danger: true, validate: v => v === 'RESET' ? '' : 'Type RESET in capitals to confirm.' });
    if (ok !== 'RESET') return;
    try { K = await api('/api/koth/reset', { method: 'POST', body: { confirm: 'RESET' } }); render(); toast('King of the Hill records reset'); load(); } catch (er) { toast(er.message, true); }
  };
  load();
  // 1.12.6: the Top 8 results pictures (Twitch tab › Viewer Matches)
  { const mk = $('#t8Make'), fo = $('#t8Folder');
    if (mk) mk.onclick = () => window.BeeboTop8 && BeeboTop8.open();
    if (fo) fo.onclick = () => api('/api/top8/open-folder', { method: 'POST' }).then(r => { const w = $('#t8Where'); if (w && r && r.dir) w.textContent = 'Folder: ' + r.dir; }).catch(e => toast(e.message, true)); }
})();
