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
  const mine = () => (P.overlays() || []).filter(o => !o.builtIn && !o.base);      // (1.5.6: not the format versions made from one of yours)
  const when = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  let shown = false, lastHtml = '';
  function render() {
    fillGames();
    const list = mine(), act = P.active(), box = $('#layMine'), isLocal = local();
    let html;
    if (!list.length) html = `<div class="empty lay-empty"><b>No layouts of your own yet</b>${isLocal ? 'Drop one above, or make one below.' : 'Layouts are imported on the PC running the app.'}</div>`;
    else html = list.map(o => {
      const live = o.name === act, sub = o.author ? `by ${esc(o.author)}` : o.maker ? `Made ${esc(when(o.modified))}` : o.imported ? `Imported ${esc(when(o.modified))}` : '';
      return `<div class="lcard lay-card${live ? ' active' : ''}" data-name="${esc(o.name)}">
        <div class="lay-thumb" data-name="${esc(o.name)}">${o.thumb ? `<img src="${esc(o.thumb)}" alt="">` : ''}<span class="g">${esc(o.game)}</span>${live ? '<span class="live">LIVE</span>' : ''}</div>
        <div class="lbody"><b>${esc(o.title)}</b>${sub ? `<small class="lay-sub">${sub}</small>` : ''}${o.description ? `<p>${esc(o.description)}</p>` : '<p></p>'}
          <div class="lacts">
            ${live ? '<button class="btn sm" disabled>On stream</button>' : '<button class="btn sm primary" data-act="live">Put on stream</button>'}
            ${isLocal && o.designer ? '<button class="btn sm" data-act="edit" title="Open it in the layout maker">Edit</button>' : ''}
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
    if (act === 'edit') return openMaker(`edit=${encodeURIComponent(name)}`);
    if (act === 'folder') { try { await api('/api/layouts/open', { method: 'POST', body: { name } }); } catch (err) { toast(err.message, true); } return; }
    if (act === 'remove') {
      const live = name === P.active();
      if (!(await ask.confirm({ title: `Remove “${o.title}”?`, text: `It comes out of the Layout menu${live ? ', and the app’s own layout for this game goes on stream instead' : ''}. A copy is kept in the app’s data folder (data › removed-layouts) in case you want it back.`, ok: 'Remove', danger: true }))) return;
      try { await api('/api/layouts/remove', { method: 'POST', body: { name } }); toast(`Removed “${o.title}”`); } catch (err) { toast(err.message, true); }
    }
  });
  // ------------------------------------------------------------ 1.5.6: make your own in the layout maker (drag and drop)
  // the desktop app opens it in its own window beside the app (desktop/main.js); in a browser it's a new tab
  function openMaker(q) { window.open(`/designer?${q}`, '_blank'); }
  function fillMakeGames() {
    const sel = $('#layMakeGame'); if (!sel) return;
    const games = [...new Set((P.overlays() || []).filter(o => o.builtIn && !o.base).map(o => o.game))];
    const html = games.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    if (sel.dataset.h !== html) { const v = sel.value || P.store('layMakeGame') || ((P.info() || {}).game) || ''; sel.innerHTML = html; sel.dataset.h = html; sel.value = games.includes(v) ? v : games[0] || ''; }
  }
  $('#layMakeGame') && ($('#layMakeGame').onchange = e => P.store('layMakeGame', e.target.value));
  $('#layMakeStarts') && $('#layMakeStarts').addEventListener('click', e => {
    const b = e.target.closest('[data-make]'); if (!b) return;
    const game = $('#layMakeGame').value, fam = b.dataset.make === 'Empty' ? 'Classic' : b.dataset.make;
    const o = (P.overlays() || []).find(x => x.builtIn && !x.base && x.game === game && x.family === fam);
    if (!o) return toast('That look isn’t there for this game.', true);
    openMaker(`from=${encodeURIComponent(o.name)}${b.dataset.make === 'Empty' ? '&empty=1' : ''}`);
  });
  window.addEventListener('beebo:overlays', fillMakeGames);
  window.addEventListener('beebo:tab', e => { if (e.detail && e.detail.name === 'layouts') fillMakeGames(); });
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

  
  // ------------------------------------------------------------ 1.5.5: your colours for the app's own layouts
  // Nine parts of the look (public/sb-colours.js); each family (Classic, Obsidian Glass) keeps its own set. A change shows
  // in OBS a moment later: the server sends the layout out again in your colours.
  const PRESETS = [
    ['Crimson', { plates: '#2a0d12', backdrop: '#0c0406', edges: '#6b1a24', text: '#fff1f1', subtext: '#c99aa0', accent: '#ff4d5e', p1: '#ff2d47', p2: '#ffd1d6', effects: '#ff6a3d' }],
    ['Ocean', { plates: '#0c2333', backdrop: '#03101a', edges: '#1f5a7a', text: '#eaf8ff', subtext: '#8fb6c9', accent: '#3fd0ff', p1: '#36e0c8', p2: '#3f8cff', effects: '#5fe3ff' }],
    ['Emerald', { plates: '#0e2419', backdrop: '#030d08', edges: '#1f6b45', text: '#effff5', subtext: '#8fbfa4', accent: '#38e58a', p1: '#2fd17a', p2: '#e6f56a', effects: '#7dffb1' }],
    ['Violet', { plates: '#1d1233', backdrop: '#08040f', edges: '#4d2f86', text: '#f5efff', subtext: '#a899c9', accent: '#b682ff', p1: '#ff5ccf', p2: '#7c6bff', effects: '#c77dff' }],
    ['Sakura', { plates: '#fff0f4', backdrop: '#ffe3ea', edges: '#e7a7b8', text: '#3a1a24', subtext: '#9b6b79', accent: '#ff6f9a', p1: '#ff4f86', p2: '#7a8cff', effects: '#ffb3c8' }],
    ['Mono', { plates: '#1a1a1a', backdrop: '#050505', edges: '#4a4a4a', text: '#ffffff', subtext: '#9a9a9a', accent: '#e6e6e6', p1: '#ffffff', p2: '#bdbdbd', effects: '#ffffff' }],
  ];
  let COL = null, fam = '', mineC = {}, saveT = 0;
  const colBox = $('#layCols');
  async function loadColours(keepFam) {
    try { COL = await api('/api/layout-colours'); } catch (e) { return; }
    const fams = Object.keys(COL.families);
    if (!keepFam || !COL.families[fam]) fam = (P.store('layColFam') && COL.families[P.store('layColFam')]) ? P.store('layColFam') : (COL.live || fams[0]);
    mineC = { ...(COL.families[fam].colours || {}) };
    $('#layColFam').innerHTML = fams.map(f => `<button type="button" data-f="${esc(f)}" class="${f === fam ? 'on' : ''}" aria-pressed="${f === fam}">${esc(f)}${f === COL.live ? ' <small class="lay-live-dot" title="On stream now">●</small>' : ''}</button>`).join('');
    drawColours();
  }
  function drawColours() {
    if (!COL) return;
    const base = COL.families[fam].base;
    colBox.innerHTML = COL.roles.map(r => {
      const v = mineC[r] || base[r], own = !!mineC[r];
      return `<div class="lay-col${own ? ' own' : ''}" data-r="${r}">
        <label><input type="color" value="${esc(v)}" data-r="${r}" aria-label="${esc(COL.labels[r])}"><span class="sw" style="background:${esc(v)}"></span>
        <span class="t"><b>${esc(COL.labels[r])}</b><small>${own ? esc(v.toUpperCase()) : 'The layout’s own'}</small></span></label>
        ${own ? `<button type="button" class="lay-col-x" data-x="${r}" title="Back to the layout’s ${esc(COL.labels[r].toLowerCase())} colour" aria-label="Back to the layout’s ${esc(COL.labels[r].toLowerCase())} colour">↺</button>` : ''}
      </div>`;
    }).join('');
    $('#layColPresets').innerHTML = PRESETS.map(([n, c]) => `<button type="button" class="lay-chip" data-p="${esc(n)}" title="${esc(n)}"><span class="dots">${['plates', 'accent', 'p1', 'p2', 'text'].map(k => `<i style="background:${c[k]}"></i>`).join('')}</span>${esc(n)}</button>`).join('');
    $('#layColReset').disabled = !Object.keys(mineC).length;
  }
  function saveColours(now) {
    clearTimeout(saveT);
    $('#layColState').textContent = 'Saving…';
    const go = async () => {
      try { const r = await api('/api/layout-colours', { method: 'POST', body: { family: fam, colours: mineC } }); mineC = { ...r.colours }; COL.families[fam].colours = mineC; $('#layColState').textContent = 'Saved. OBS shows it in a moment.'; drawColours(); }
      catch (e) { $('#layColState').textContent = ''; toast(e.message, true); }
    };
    if (now) go(); else saveT = setTimeout(go, 450);
  }
  colBox.addEventListener('input', e => {
    const i = e.target.closest('input[type=color]'); if (!i) return;
    const r = i.dataset.r; mineC[r] = i.value; const row = i.closest('.lay-col');
    row.classList.add('own'); row.querySelector('.sw').style.background = i.value; row.querySelector('small').textContent = i.value.toUpperCase();
    saveColours(false);
  });
  colBox.addEventListener('change', e => { if (e.target.closest('input[type=color]')) saveColours(true); });
  colBox.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; delete mineC[x.dataset.x]; drawColours(); saveColours(true); });
  $('#layColPresets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const pr = PRESETS.find(([n]) => n === b.dataset.p); if (!pr) return; mineC = { ...pr[1] }; drawColours(); saveColours(true); toast(`${pr[0]} colours on ${fam}`); });
  $('#layColFam').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b || b.dataset.f === fam) return; fam = b.dataset.f; P.store('layColFam', fam); mineC = { ...(COL.families[fam].colours || {}) }; $('#layColFam').querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); drawColours(); });
  $('#layColReset').onclick = async () => {
    if (!(await ask.confirm({ title: `Back to ${fam}’s own colours?`, text: 'All nine colours go back to how the layout comes.', ok: 'Reset colours' }))) return;
    mineC = {}; drawColours(); saveColours(true);
  };
  window.addEventListener('beebo:tab', e => { if (e.detail && e.detail.name === 'layouts') loadColours(true); });
  loadColours(false);

  render();
})();
