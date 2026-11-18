/* BeeboScore — Bracket tab › Share & export: the live bracket page for viewers, the Top 8 standings splash and pictures,
 * profile pictures vs character art, and the folder the (temporary) files are kept in. Works for start.gg events and
 * viewer tournaments alike. */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P;
  const $ = s => document.querySelector(s);
  let S = null, br = null;
  const local = () => { const i = P.info && P.info(); return !i || i.local !== false; };

  const ago = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'in under a minute' : m < 60 ? `in ${m} min` : `in ${Math.round(m / 60)} h`; };
  const size = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  function render() {
    const card = $('#shareCard');
    const ready = !!(br && br.ready);
    card.hidden = !ready && !(S && S.active);
    if (!S) return;
    const on = S.on && S.current;
    $('#shPill').textContent = on ? (S.endedAt ? 'Closing soon' : 'Live link on') : 'Not shared';
    $('#shPill').className = 'pill' + (on ? ' on' : '');
    $('#shLive').checked = on;
    $('#shLinkBox').hidden = !on;
    if (on) {
      $('#shLink').value = S.short || S.link; $('#shVisit').href = S.localLink || S.link;
      $('#shWhere').innerHTML = (S.online ? 'Anyone with the link can watch — it goes through your online link.' : 'Works for people on your network. <a href="#" data-goto="stream">Go online</a> (Stream tab) so anyone can open it.')
        + (S.html ? ` The same page is saved as <b>${esc(S.html)}</b> in the folder, to send as a file.` : '') + (S.linkEndsAt ? ` <b>The link closes ${ago(S.linkEndsAt - Date.now())}.</b>` : '');
    }
    const cur = (P.state() && P.state().splash && P.state().splash.show) || '';
    const sb = $('#shStand'); sb.classList.toggle('on', cur === 'standings'); sb.textContent = cur === 'standings' ? 'Hide from stream' : 'Show on stream';
    const n = (br && br.standings) || S.standings || 0, fin = !!((br && br.finished) || S.finished);
    sb.disabled = !n; $('#shPng').disabled = $('#shJpg').disabled = !n || !S.capture;
    $('#shStandHint').textContent = !n ? 'Appears once players start getting knocked out — complete at the end of the tournament.'
      : !fin ? `${n} placement${n === 1 ? '' : 's'} so far — the full Top 8 is ready when the tournament ends.` : 'Final — ready to post.';
    if (!S.capture && n) $('#shStandHint').textContent += ' Saving pictures needs the BeeboScore desktop app.';
    $('#shAuto').checked = S.autoStandings !== false;
    $('#shPostRow').hidden = !S.postText;
    const oth = $('#shOther'); oth.hidden = !S.other;
    if (S.other) oth.innerHTML = `Also kept: <b>${esc(S.other.name)}</b> (${S.other.on ? 'live link on, ' : ''}${S.other.files} file${S.other.files === 1 ? '' : 's'}) — switch the bracket source to see it.`;
    if (S.active && !S.current) $('#shPill').textContent = `Files: ${S.name}`;
    document.querySelectorAll('#shPics [data-pics]').forEach(b => b.classList.toggle('on', b.dataset.pics === S.pics));
    $('#shFiles').innerHTML = (S.files || []).map(f => `<div><span>${/\.html$/.test(f.name) ? '🌐' : '🖼'} ${esc(f.name)}</span><small>${size(f.size)}</small></div>`).join('')
      + (S.files && S.files.length ? '<button class="btn sm ghost danger local-only" id="shPurge" style="align-self:flex-start;margin-top:4px">🗑 Delete these files now</button>' : '');
    $('#shOpen').hidden = !local();
    $('#shTemp').innerHTML = `These files are temporary: the live link stops working and the page file is deleted <b>15 minutes after the tournament ends</b>; the pictures are kept until you delete or replace the tournament (at most 24 hours after it ends). Save the pictures somewhere else if you want to keep them.`;
  }
  async function load() { try { S = await api('/api/share'); br = await api('/api/bracket'); } catch (e) {} render(); }
  const post = async (body, msg) => { try { const r = await api('/api/share', { method: 'POST', body }); S = r; render(); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); return r; } catch (e) { toast(e.message, true); load(); } };

  $('#shLive').onchange = e => post({ do: 'live', on: e.target.checked }, r => r.on ? 'Live bracket page is on — copy the link for your viewers' : 'Live bracket page turned off — the old link no longer works');
  $('#shCopy').onclick = () => P.copy($('#shLink').value, 'Bracket link copied — paste it in chat or your socials');
  $('#shPost').onclick = () => P.copy(S.postText, 'Post text copied — paste it with the standings picture');
  $('#shOpen').onclick = () => post({ do: 'open' });
  $('#shStand').onclick = async () => { try { await api('/api/splash', { method: 'POST', body: { kind: 'standings', show: 'toggle' } }); } catch (e) { toast(e.message, true); } };
  const shoot = fmt => async e => {
    const b = e.currentTarget, t = b.textContent; b.disabled = true; b.textContent = 'Saving…';
    await post({ do: 'image', format: fmt }, r => `Saved ${(r.saved || []).join(' and ')} — 📂 Open folder to find it`);
    b.textContent = t; b.disabled = false;
  };
  $('#shPng').onclick = shoot('png'); $('#shJpg').onclick = shoot('jpg');
  $('#shAuto').onchange = e => api('/api/settings', { method: 'POST', body: { autoStandings: e.target.checked } }).then(load).catch(er => toast(er.message, true));
  $('#shPics').onclick = e => { const b = e.target.closest('[data-pics]'); if (!b) return; api('/api/settings', { method: 'POST', body: { bracketPics: b.dataset.pics } }).then(() => { toast(b.dataset.pics === 'character' ? 'Showing character art (pictures tagged “character” in the designer library)' : 'Showing start.gg profile pictures'); load(); }).catch(er => toast(er.message, true)); };
  $('#shFiles').addEventListener('click', async e => { if (e.target.closest('#shPurge') && await BeeboAsk.confirm({ title: 'Delete this tournament’s exported files?', text: 'The live link stops working too.', ok: 'Delete files', danger: true })) post({ do: 'purge' }, 'Exported files deleted'); });

  // ---- character art: a folder of pictures named after the characters, tagged "character" in the designer's library
  const cslug = x => String(x || '').toLowerCase().normalize('NFKD').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  async function charCount() { try { const r = await api('/api/assets'); const n = r.assets.filter(a => a.tag === 'character').length; $('#shCharN').textContent = n ? `${n} character picture${n === 1 ? '' : 's'}` : 'No character art yet'; return r.assets; } catch (e) { return []; } }
  $('#shCharImp').onclick = () => $('#shCharDir').click();
  $('#shCharImp2').onclick = () => $('#shCharFiles').click();
  async function importChars(files) {
    files = [...files].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f.name)); if (!files.length) return;
    const have = await charCount(); let n = 0;
    for (const f of files) {
      const base = f.name.split(/[\\/]/).pop(), name = base.replace(/[_]+/g, ' ').replace(/\s+\d+(?=\.)/, '');
      for (const old of have.filter(a => a.tag === 'character' && cslug(a.name) === cslug(name))) await api('/api/assets/delete', { method: 'POST', body: { id: old.id } }).catch(() => {});   // replace an older picture
      const r = await fetch(`/api/assets?name=${encodeURIComponent(name)}&tag=character`, { method: 'POST', body: f }).then(x => x.json()).catch(() => null);
      if (r && r.id) n++;
    }
    toast(`Imported ${n} character picture${n === 1 ? '' : 's'} — players show their character's art when “Character art” is on`); charCount();
  }
  $('#shCharFiles').onchange = e => { importChars(e.target.files); e.target.value = ''; };
  $('#shCharDir').onchange = e => { importChars(e.target.files); e.target.value = ''; };
  setTimeout(() => { if (local()) charCount(); }, 1200);
  window.addEventListener('beebo:share', e => { S = e.detail; render(); });
  window.addEventListener('beebo:bracket', e => { const was = br; br = e.detail; render(); if (!was || was.ready !== br.ready || was.finished !== br.finished || was.standings !== br.standings) { clearTimeout(load.t); load.t = setTimeout(load, 400); } });   // the share status itself arrives pushed
  window.addEventListener('beebo:tunnel', () => { clearTimeout(load.t); load.t = setTimeout(load, 800); });
  window.addEventListener('beebo:state', () => render());
  load();
})();
