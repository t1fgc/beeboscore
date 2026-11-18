/* BeeboScore (developed by Beebo), 1.5.1 — the Layouts tab: import a layout someone made (a .zip, a folder or loose
 * files), see your own layouts, preview, share, put on stream or remove them, and get the starter layout.
 * The server does the real work (/api/layouts/*, server.js): this only gathers the files and asks the questions. */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P, ask = window.BeeboAsk;
  const $ = s => document.querySelector(s);
  const local = () => !!(P.info() || {}).local;
  const MAX_MB = 70;                       // what one import can carry (the server reads up to 100 MB, base64 makes it a third bigger)

  // ------------------------------------------------------------ the game a layout is for
  function fillGames() {
    const sel = $('#layGame'), games = ((P.info() || {}).games || []).filter(Boolean);
    // the first choice leaves it to the layout (its overlay.json can say which game it's for), else any game
    const html = '<option value="">Any game, or what the layout says</option>' + games.filter(g => g !== 'Any game').map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    if (sel.dataset.h !== html) { const v = sel.value; sel.innerHTML = html; sel.dataset.h = html; sel.value = v || ''; if (sel.value !== v) sel.value = ''; }
  }
  $('#layGoLive').checked = P.store('layGoLive') === '1';
  $('#layGoLive').onchange = e => P.store('layGoLive', e.target.checked ? '1' : '0');

  // ------------------------------------------------------------ your layouts
  const mine = () => (P.overlays() || []).filter(o => !o.builtIn);
  const when = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  let shown = false, lastHtml = '';
  function render() {
    fillGames();
    const list = mine(), act = P.active(), box = $('#layMine'), isLocal = local();
    let html;
    if (!list.length) html = `<div class="empty lay-empty"><b>No layouts of your own yet</b>${isLocal ? 'Drop one above, or start from the starter layout below.' : 'Layouts are imported on the PC running the app.'}</div>`;
    else html = list.map(o => {
      const live = o.name === act, sub = o.author ? `by ${esc(o.author)}` : o.imported ? `Imported ${esc(when(o.modified))}` : '';
      return `<div class="lcard lay-card${live ? ' active' : ''}" data-name="${esc(o.name)}">
        <div class="lay-thumb" data-name="${esc(o.name)}">${o.thumb ? `<img src="${esc(o.thumb)}" alt="">` : ''}<span class="g">${esc(o.game)}</span>${live ? '<span class="live">LIVE</span>' : ''}</div>
        <div class="lbody"><b>${esc(o.title)}</b>${sub ? `<small class="lay-sub">${sub}</small>` : ''}${o.description ? `<p>${esc(o.description)}</p>` : '<p></p>'}
          <div class="lacts">
            ${live ? '<button class="btn sm" disabled>On stream</button>' : '<button class="btn sm primary" data-act="live">Put on stream</button>'}
            <button class="btn sm ghost" data-act="preview">Preview</button>
            ${isLocal ? `<a class="btn sm ghost" data-act="share" href="/api/layouts/export?name=${encodeURIComponent(o.name)}" download title="Save it as a .zip to send to someone">Share</a>
            <button class="btn sm ghost" data-act="folder" title="Open its folder to change the files">Folder</button>
            <button class="btn sm ghost danger" data-act="remove">Remove</button>` : ''}
          </div></div></div>`;
    }).join('');
    if (html === lastHtml) return thumbs();
    lastHtml = html; box.innerHTML = html; thumbs();
  }
  // a live, shrunk copy of each layout as its picture (only while the tab is open, so nothing runs in the background)
  function thumbs() {
    for (const t of document.querySelectorAll('#layMine .lay-thumb')) {
      const name = t.dataset.name, f = t.querySelector('iframe');
      if (!shown || t.querySelector('img')) { if (f) f.remove(); continue; }
      if (!f) { const fr = document.createElement('iframe'); fr.title = 'Preview of ' + name; fr.tabIndex = -1; fr.setAttribute('scrolling', 'no'); fr.loading = 'lazy'; fr.src = `/overlay/${encodeURIComponent(name)}?preview`; t.prepend(fr); }
    }
    scaleThumbs();
  }
  function scaleThumbs() { for (const t of document.querySelectorAll('#layMine .lay-thumb')) { const f = t.querySelector('iframe'); if (f) f.style.transform = `scale(${t.clientWidth / 1920})`; } }
  window.addEventListener('resize', scaleThumbs);
  window.addEventListener('beebo:overlays', render);
  window.addEventListener('beebo:tab', e => { shown = e.detail && e.detail.name === 'layouts'; if (shown) { lastHtml = ''; render(); } else thumbs(); });

  $('#layMine').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const card = b.closest('[data-name]'), name = card.dataset.name, o = mine().find(x => x.name === name) || { name, title: name };
    const act = b.dataset.act;
    if (act === 'share') return toast(`Saving “${o.title}” as a .zip…`);
    e.preventDefault();
    if (act === 'live') { try { await api('/api/overlays/active', { method: 'POST', body: { name } }); toast(`Now live in OBS: ${o.title}`); } catch (err) { toast(err.message, true); } return; }
    if (act === 'preview') return preview(o);
    if (act === 'folder') { try { await api('/api/layouts/open', { method: 'POST', body: { name } }); } catch (err) { toast(err.message, true); } return; }
    if (act === 'remove') {
      const live = name === P.active();
      if (!(await ask.confirm({ title: `Remove “${o.title}”?`, text: `It comes out of the Layout menu${live ? ', and the app’s own layout for this game goes on stream instead' : ''}. A copy is kept in the app’s data folder (data › removed-layouts) in case you want it back.`, ok: 'Remove', danger: true }))) return;
      try { await api('/api/layouts/remove', { method: 'POST', body: { name } }); toast(`Removed “${o.title}”`); } catch (err) { toast(err.message, true); }
    }
  });
  $('#layOpenFolder').onclick = () => api('/api/layouts/open', { method: 'POST', body: {} }).catch(err => toast(err.message, true));

  // ------------------------------------------------------------ preview: the layout at full size, shrunk to fit, with the scoreboard as it is now
  function preview(o) {
    const wrap = document.createElement('div'); wrap.className = 'lay-pv-wrap';
    wrap.innerHTML = `<div class="lay-pv" role="dialog" aria-modal="true" aria-label="Preview of ${esc(o.title)}">
      <div class="lay-pv-top"><b>${esc(o.title)}</b><span class="seg lay-pv-bg"><button class="on" data-bg="game">Game</button><button data-bg="checker">See-through</button><button data-bg="green">Green</button></span><button class="btn sm" data-close>Close</button></div>
      <div class="preview-wrap game lay-pv-stage"><iframe title="${esc(o.title)}" src="/overlay/${encodeURIComponent(o.name)}?preview"></iframe></div>
      <p class="hint">This is the scoreboard as it is now. Change a name or a score in the Matches tab and press Update to see the layout follow.</p></div>`;
    const prevFocus = document.activeElement;
    const close = () => { wrap.remove(); window.removeEventListener('resize', fit); document.removeEventListener('keydown', key, true); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const stage = wrap.querySelector('.lay-pv-stage'), fr = stage.querySelector('iframe');
    const fit = () => { fr.style.transform = `scale(${stage.clientWidth / 1920})`; };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-close]')) return close();
      const bg = e.target.closest('[data-bg]'); if (bg) { stage.className = 'preview-wrap lay-pv-stage ' + bg.dataset.bg; wrap.querySelectorAll('[data-bg]').forEach(x => x.classList.toggle('on', x === bg)); }
    });
    document.addEventListener('keydown', key, true); window.addEventListener('resize', fit);
    document.body.appendChild(wrap); fit(); wrap.querySelector('[data-close]').focus();
  }

  // ------------------------------------------------------------ importing
  const b64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error(`Couldn’t read ${file.name}`)); r.readAsDataURL(file); });
  let busy = false;
  function setBusy(on, msg) {
    busy = on; const d = $('#layDrop'); d.classList.toggle('busy', on); d.setAttribute('aria-busy', on ? 'true' : 'false');
    $('#layDropTitle').textContent = on ? (msg || 'Importing…') : 'Drop a layout here';
  }
  // send it; a name that's taken is asked about (replace it, keep both, or another name)
  async function send(body, again = 0) {
    try { return await api('/api/layouts/import', { method: 'POST', body }); }
    catch (e) {
      const msg = e.message || '';
      if (again > 4) throw e;
      if (/already have a layout called/.test(msg)) {
        const t = (/“(.+)”/.exec(msg) || [])[1] || body.title || 'this layout';
        const pick = await ask.choice({ title: `You already have “${t}”`, text: 'Replace it with this one, or keep both?', options: [{ label: 'Replace it', value: 'replace', primary: true, hint: 'The old one is kept in data › removed-layouts' }, { label: 'Keep both', value: 'both', hint: `This one comes in as “${t} 2”` }] });
        if (!pick) return null;
        if (pick === 'replace') return send({ ...body, replace: true }, again + 1);
        const taken = new Set((P.overlays() || []).map(o => String(o.title).toLowerCase()));
        let n = 2; while (taken.has(`${t} ${n}`.toLowerCase())) n++;
        return send({ ...body, title: `${t} ${n}` }, again + 1);
      }
      if (/one of the app’s own layouts/.test(msg)) {
        const t = await ask.text({ title: 'Give it another name', text: msg, label: 'Layout name', value: (body.title || '') + ' (mine)', max: 60 });
        if (!t) return null;
        return send({ ...body, title: t }, again + 1);
      }
      throw e;
    }
  }
  async function done(r) {
    if (!r) return;
    const live = r.name === P.active();
    toast(`${r.replaced ? 'Replaced' : 'Imported'} “${r.title}”${live ? ': it’s on stream now' : ''}`);
    const notes = [];
    if (!r.reads) notes.push('It doesn’t read the scoreboard: nothing in it uses data-sb or the scoreboard events, so names and scores won’t change on it. That’s fine for a picture-only screen, like “starting soon”.');
    if (r.skippedCount) notes.push(`${r.skippedCount} file${r.skippedCount === 1 ? ' was' : 's were'} left out because ${r.skippedCount === 1 ? 'it isn’t' : 'they aren’t'} part of a web page: ${r.skipped.join(', ')}${r.skippedCount > r.skipped.length ? '…' : ''}.`);
    if (notes.length) await ask.choice({ title: `“${r.title}” is in`, text: notes.join(' '), options: [{ label: 'OK', value: 1, primary: true }], cancel: false }).catch(() => {});
  }
  async function importZip(file) {
    if (file.size > MAX_MB * 1048576) return toast(`That zip is over ${MAX_MB} MB. Leave out big videos, or link to them instead.`, true);
    setBusy(true, `Importing ${file.name}…`);
    try { await done(await send({ zip: await b64(file), fileName: file.name, game: $('#layGame').value, goLive: $('#layGoLive').checked })); }
    catch (e) { toast(e.message || 'Couldn’t import that', true); }
    finally { setBusy(false); }
  }
  // a .beebo file (a BeeboScore Layout Designer layout): becomes a layout the app draws itself
  async function importBeebo(file) {
    setBusy(true, `Importing ${file.name}…`);
    try {
      const j = JSON.parse(await file.text()), design = j && (j.design || (j.scenes ? j : null));
      if (!design || !design.scenes) throw new Error('That isn’t a BeeboScore layout file.');
      const base = String(design.title || file.name.replace(/\.beebo$/i, '')).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 44) || 'imported-layout';
      const taken = new Set((P.overlays() || []).map(o => o.name));
      let name = base, n = 1; while (taken.has(name)) name = `${base}-${++n}`;
      const r = await api('/api/designs', { method: 'POST', body: { name, design, setActive: !!$('#layGoLive').checked, overwrite: false } });
      toast(`Imported “${design.title || (r && r.name) || name}”`);
    } catch (e) { toast(e.message || 'Couldn’t import that file', true); }
    finally { setBusy(false); }
  }
  // a folder or loose files: [{ file, path }]
  async function importFiles(list) {
    if (!list.length) return;
    const zips = list.filter(f => /\.zip$/i.test(f.path)), beebo = list.filter(f => /\.beebo$/i.test(f.path));
    if (zips.length && zips.length === list.length) { for (const z of zips) await importZip(z.file); return; }
    if (beebo.length && beebo.length === list.length) { for (const b of beebo) await importBeebo(b.file); return; }
    list = list.filter(f => !/\.(zip|beebo)$/i.test(f.path));
    if (!list.some(f => /\.html?$/i.test(f.path))) return toast('There’s no web page (.html) in there. Drop the layout’s folder, its .zip, or its page with its files.', true);
    const size = list.reduce((n, f) => n + f.file.size, 0);
    if (size > MAX_MB * 1048576) return toast(`That layout is over ${MAX_MB} MB. Leave out big videos, or link to them instead.`, true);
    const tops = new Set(list.map(f => f.path.includes('/') ? f.path.split('/')[0] : ''));
    const folder = tops.size === 1 && [...tops][0] ? [...tops][0] : '';
    setBusy(true, `Importing ${folder || list.length + ' files'}…`);
    try {
      const files = [];
      for (const f of list) files.push({ path: f.path, data: await b64(f.file) });
      await done(await send({ files, fileName: folder, game: $('#layGame').value, goLive: $('#layGoLive').checked }));
    } catch (e) { toast(e.message || 'Couldn’t import that', true); }
    finally { setBusy(false); }
  }

  $('#layPickZip').onclick = e => { e.stopPropagation(); $('#layZipIn').click(); };
  $('#layPickFolder').onclick = e => { e.stopPropagation(); $('#layFolderIn').click(); };
  $('#layPickFiles').onclick = e => { e.stopPropagation(); $('#layFilesIn').click(); };
  $('#layZipIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFiles([{ file: f, path: f.name }]); };
  $('#layFolderIn').onchange = e => { const l = [...e.target.files].map(f => ({ file: f, path: f.webkitRelativePath || f.name })); e.target.value = ''; importFiles(l); };
  $('#layFilesIn').onchange = e => { const l = [...e.target.files].map(f => ({ file: f, path: f.name })); e.target.value = ''; importFiles(l); };
  const drop = $('#layDrop');
  drop.onclick = e => { if (!busy && !e.target.closest('button')) $('#layZipIn').click(); };
  drop.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); if (!busy) $('#layZipIn').click(); } };
  // the whole tab takes a drop (a layout dropped next to the box would otherwise open in Windows instead)
  const tab = document.querySelector('section.tab[data-tab="layouts"]');
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach(t => tab.addEventListener(t, e => { if (!hasFiles(e) || !local()) return; e.preventDefault(); drop.classList.add('over'); }));
  tab.addEventListener('dragleave', e => { if (!tab.contains(e.relatedTarget)) drop.classList.remove('over'); });
  tab.addEventListener('drop', async e => {
    drop.classList.remove('over');
    if (!hasFiles(e) || !local()) return;
    e.preventDefault(); if (busy) return;
    drop.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const out = [];
    const walk = (entry, prefix) => new Promise(res => {
      if (entry.isFile) entry.file(f => { out.push({ file: f, path: prefix + f.name }); res(); }, res);
      else {
        const reader = entry.createReader(), all = [];
        const next = () => reader.readEntries(async batch => { if (!batch.length) { for (const c of all) await walk(c, prefix + entry.name + '/'); res(); } else { all.push(...batch); next(); } }, res);
        next();
      }
    });
    if (entries.length) { for (const en of entries) await walk(en, ''); } else out.push(...[...e.dataTransfer.files].map(f => ({ file: f, path: f.name })));
    importFiles(out);
  });

  render();
})();
