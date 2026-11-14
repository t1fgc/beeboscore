/* BeeboScore — Format tab: team battles (crew, Sajam Slam style, gauntlet), Death Battle, King of the Hill, leagues */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  // (this build) the desktop app has no prompt(), so text is asked for in the panel's own window: public/panel-ask.js
  const ask = (msg, o) => P.ask ? P.ask(msg, o) : Promise.resolve(o && o.choices ? (Number(window.prompt(msg, '1')) === 2 ? 1 : 0) : window.prompt(msg, (o && o.value) || ''));

  const PRESETS = [
    ['crew', '⚔️', 'Crew battle', 'Winner stays on. A team is out when every player has lost.'],
    ['sajam', '🎙️', 'Team battle (Sajam Slam style)', 'Players paired by tier, first team to 3 points. A 2–2 goes to the coaches.'],
    ['gauntlet', '🧗', 'Gauntlet', 'One player against a line of challengers. Winner stays.'],
    ['tdb', '🛡️', 'Team Death Battle', 'Two teams, every fighter has lives. After a life is lost both teams may switch fighters, Pokémon style. Benched fighters keep their lives.'],
    ['death', '💀', 'Death Battle', 'Everyone has lives. Lose a match, lose a life. Last one standing wins.'],
    ['koth', '👑', 'King of the Hill', 'Winner stays, loser joins the back of the queue. Streaks count.'],
    ['league', '📊', 'League (round robin)', 'Everyone plays everyone. Standings by wins, then head-to-head.'],
  ];
  const ME = Math.random().toString(36).slice(2, 10);
  let F = null, V = null, pending = 0, canUndo = false, saveT = 0, saved = [], S = null;

  const post = (body, msg) => api('/api/format', { method: 'POST', body }).then(r => { if (msg) toast(msg); return r; }).catch(e => { toast(e.message, true); throw e; });
  const strip = f => f ? JSON.stringify({ ...f, seq: 0, events: 0, at: 0 }) : '';
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => post({ do: 'save', format: F, editor: ME }).catch(() => {}), 350); }

  // ------------------------------------------------------------ from the app
  async function load() {
    try { const r = await api('/api/format'); F = r.format; V = r.fv; pending = r.pending; canUndo = r.canUndo; } catch (e) {}
    try { saved = (await api('/api/format/teams')).teams || []; } catch (e) {}
    renderAll();
  }
  window.addEventListener('beebo:state', e => {
    const d = e.detail || {}; S = d;
    const f = d.format || null;
    V = d.fv || null; pending = V ? V.pending : 0;
    // my own setup edits coming back: keep what's on screen (the server copy may be a keystroke behind)
    if (f && F && f.status === 'setup' && F.status === 'setup' && f.editor === ME) { renderHead(); return; }
    const same = strip(f) === strip(F); F = f;
    if (same) renderLive(); else renderAll();
  });

  // ------------------------------------------------------------ rendering
  function renderAll() { renderHead(); renderPresets(); renderRules(); renderRoster(); renderLive(); }
  function renderHead() {
    const st = F ? F.status : 'off';
    $('#fmtName').textContent = F ? F.name : 'Game formats';
    $('#fmtPill').textContent = { off: 'Off', setup: 'Setup', live: 'Live', done: 'Finished' }[st];
    $('#fmtPill').className = 'pill' + (st === 'live' ? ' on' : '');
    $('#fmtStart').hidden = !F || st !== 'setup'; $('#fmtEnd').hidden = !F || st !== 'live' || F.kind === 'teams';
    $('#fmtReset').hidden = !F || st === 'setup'; $('#fmtClear').hidden = !F;
    $('#fmtBadge').hidden = st !== 'live' || !pending;
    $('#fmtPresets').hidden = !!F && st !== 'setup';
    $('#fmtRules').hidden = !F || st !== 'setup'; $('#fmtRoster').hidden = !F || st !== 'setup';
  }
  function renderPresets() {
    $('#fmtPresetList').innerHTML = PRESETS.map(([k, em, n, d]) => `<button class="fmt-preset${F && F.preset === k ? ' on' : ''}" data-p="${k}"><span class="em">${em}</span><b>${esc(n)}</b><small>${esc(d)}</small></button>`).join('');
  }
  $('#fmtPresetList').onclick = e => { const b = e.target.closest('[data-p]'); if (b) choose(b.dataset.p); };
  async function choose(k) {
    const kindOf = x => ['death', 'koth', 'league'].includes(x) ? 'list' : 'teams';
    const data = {};
    if (F) {                                  // switching format keeps the names you typed
      if (kindOf(k) === 'teams' && F.teams) data.teams = F.teams;
      if (kindOf(k) === 'list') data.fighters = F.fighters || (F.teams ? F.teams.flatMap(t => t.players) : []);
      if (kindOf(k) === 'teams' && !F.teams && F.fighters) { const h = Math.ceil(F.fighters.length / 2); data.teams = [{ players: F.fighters.slice(0, h) }, { players: F.fighters.slice(h) }]; }
    }
    const r = await post({ do: 'create', preset: k, data }); F = (await api('/api/format')).format; renderAll();
    if (k === 'gauntlet' && F.teams[0].name === 'Team 1') { F.teams[0].name = 'The Boss'; F.teams[1].name = 'Challengers'; saveSoon(); renderRoster(); }
    return r;
  }

  // rules
  const field = (label, html, hint = '') => `<div class="field" style="margin:0"><label class="l">${label}</label>${html}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
  const sel = (key, opts, v) => `<select class="f" data-r="${key}">${opts.map(([a, b]) => `<option value="${a}" ${String(v) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const tog = (key, label, v) => `<label class="toggle"><input type="checkbox" data-r="${key}" ${v ? 'checked' : ''}><span class="sw"></span>${esc(label)}</label>`;
  function renderRules() {
    if (!F) return;
    const r = F.rules, ft = sel('ft', [1, 2, 3, 4, 5].map(n => [n, n === 1 ? 'First to 1 game' : `First to ${n} (best of ${n * 2 - 1})`]), r.ft);
    let h = field('Name on stream', `<input type="text" data-r="name" value="${esc(F.name)}" maxlength="40">`) + field('Each match', ft);
    if (F.kind === 'teams' && r.mode === 'tdb') {
      h += field('Lives per fighter', sel('lives', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, n === 1 ? '1 life' : n + ' lives']), r.lives), 'Every fighter starts with this many.');
      h += field('One life is worth', sel('setsPerLife', [1, 2, 3, 4, 5].map(n => [n, n === 1 ? '1 set — lose a set, lose a life' : `${n} sets — lose ${n} sets, lose a life`]), r.setsPerLife), r.setsPerLife > 1 ? 'Each set lost cracks the life; the last one breaks it.' : '');
      h += field('After a life is lost', sel('switching', [['both', 'Both teams may switch fighters'], ['loser', 'Only the team that lost it may switch'], ['none', 'Nobody switches — fight on']], r.switching), 'A fighter who leaves keeps the lives they had for when they come back.');
      h += field('Team bar on stream', '<span style="font-weight:600">Pictures and names together</span>', 'A fighter with a picture shows it on their card; the others show their name and a big letter, the same size. Drop a picture on a fighter below (or click 📷).');
    } else if (F.kind === 'teams') {
      h += field('Rule', sel('mode', [['stay', 'Winner stays (crew)'], ['paired', 'Paired points (Sajam Slam)']], r.mode));
      if (r.mode === 'stay') h += field('Win limit', sel('winLimit', [[0, 'None — a player can sweep'], [2, 'Retire after 2 wins in a row'], [3, 'Retire after 3 wins in a row'], [4, 'Retire after 4 wins in a row']], r.winLimit), 'Keeps every player valuable: nobody wins it alone.');
      else {
        h += field('Points to win', sel('points', [[0, 'Majority (auto)'], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], r.points));
        h += field('If it’s level', sel('tiebreak', [['coach', 'Coaches play the tiebreaker'], ['anchor', 'The last pair plays again'], ['none', 'It’s a draw']], r.tiebreak));
      }
      if (r.mode !== 'tdb') h += `<div class="field" style="margin:0">${tog('coach', 'Teams have a coach', r.coach)}${tog('tiers', 'Ordered by skill (show tiers)', r.tiers)}</div>`;
    } else if (F.kind === 'elim') {
      if (r.mode === 'death') h += field('Lives', sel('lives', [1, 2, 3, 4, 5].map(n => [n, n === 1 ? '1 — pure elimination' : n + ' lives']), r.lives));
      else h += field('Win at a streak of', sel('streakGoal', [[0, 'No target — run it'], [3, 3], [5, 5], [7, 7], [10, 10]], r.streakGoal));
      h += field('Who fights next', sel('pick', [['stay', 'Winner stays'], ['queue', 'Queue order (both go back)'], ['random', 'Random draw']], r.pick));
    } else h += `<div class="field" style="margin:0">${tog('double', 'Play everyone twice', r.double)}</div>`;
    h += `<div class="field" style="margin:0">${tog('auto', 'Advance by itself after each set', r.auto)}${tog('splash', 'Champion splash at the end', r.splash !== false)}</div>`;
    $('#fmtRulesBody').innerHTML = `<div class="fmt-rules">${h}</div>`;
  }
  $('#fmtRulesBody').addEventListener('change', e => {
    const t = e.target.closest('[data-r]'); if (!t || !F) return;
    const k = t.dataset.r, v = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' && /^\d+$/.test(t.value) ? Number(t.value) : t.value;
    if (k === 'name') F.name = v; else F.rules[k] = k === 'barPics' ? !!v : v;
    if (k === 'coach' && v && F.teams) F.teams.forEach(tm => { if (!tm.coach) tm.coach = { name: '' }; });
    saveSoon(); if (['mode', 'coach', 'barPics', 'setsPerLife'].includes(k)) { renderRules(); renderRoster(); }
    renderHead();
  });
  $('#fmtRulesBody').addEventListener('input', e => { const t = e.target.closest('[data-r=name]'); if (t && F) { F.name = t.value; saveSoon(); } });

  // rosters
  function playerRow(p, i, path, tiers) {
    return `<div class="fmt-pl" draggable="true" data-path="${path}" data-i="${i}"><span class="grip" title="Drag to reorder">⋮⋮</span><span class="num">${tiers ? 'T' + (i + 1) : '#' + (i + 1)}</span>
      <button class="fmt-pic${p.pic ? ' has' : ''}" data-pic title="${p.pic ? 'Change the picture: click, or drop a new one on this row' : 'Add a picture: click, or drop an image on this row'}">${p.pic ? `<img src="${esc(p.pic)}" alt="">` : '📷'}</button><input type="text" data-k="name" value="${esc(p.name)}" placeholder="Player name" autocomplete="off">
      ${p.pic ? '<button class="x nopic" data-nopic title="Remove the picture">⊘</button>' : '<span></span>'}<button class="x" data-del title="Remove">✕</button></div>`;
  }
  function renderRoster() {
    if (!F) return;
    $('#fmtSaved').innerHTML = '<option value="">📂 Load a saved list…</option>' + saved.map((t, i) => `<option value="${i}">${esc(t.name || 'Saved list')} (${(t.players || []).length})</option>`).join('');
    if (F.kind === 'teams') {
      $('#fmtRosterTitle').firstChild.textContent = 'Teams ';
      $('#fmtRosterBody').innerHTML = `<div class="fmt-teams">${F.teams.map((t, ti) => `<div class="fmt-team" style="--tc:${esc(t.color)}" data-team="${ti}">
        <div class="row3"><div class="field"><label class="l">${F.preset === 'gauntlet' && ti === 0 ? 'The player taking on the line' : 'Team ' + (ti + 1)}</label><input type="text" data-t="name" value="${esc(t.name)}" maxlength="40"></div>
          <div class="field"><label class="l">Tag</label><input type="text" data-t="tag" value="${esc(t.tag || '')}" maxlength="8" placeholder="EMB"></div>
          <div class="field"><label class="l">Colour</label><input type="color" data-t="color" value="${esc(t.color)}"></div></div>
        ${F.rules.coach ? `<div class="field"><label class="l">Coach (plays the tiebreaker)</label><input type="text" data-t="coach" value="${esc(t.coach ? t.coach.name : '')}" placeholder="Coach name" autocomplete="off"></div>` : ''}
        <label class="l">Players ${F.rules.mode === 'tdb' ? '— the first one leads (you can switch before the first set)' : F.rules.tiers ? '— least to most experienced' : '— in playing order'}</label>
        <div class="fmt-list">${t.players.map((p, i) => playerRow(p, i, 't' + ti, F.rules.tiers)).join('')}</div>
        <div class="fmt-add"><button class="btn sm" data-add>＋ Player</button><button class="btn sm ghost" data-paste>📋 Paste a list</button><button class="btn sm ghost" data-save>💾 Save team</button></div></div>`).join('')}</div>
        <p class="hint">Drag ⋮⋮ to reorder. Drop a picture on a player to add it (or click 📷). Names autocomplete from start.gg and past players. Paired battles need the same number of players on each side.</p>`;
    } else {
      $('#fmtRosterTitle').firstChild.textContent = F.kind === 'league' ? 'Players ' : 'Fighters ';
      $('#fmtRosterBody').innerHTML = `<div class="fmt-team" data-team="f"><div class="fmt-list">${F.fighters.map((p, i) => playerRow(p, i, 'f', false)).join('')}</div>
        <div class="fmt-add"><button class="btn sm" data-add>＋ ${F.kind === 'league' ? 'Player' : 'Fighter'}</button><button class="btn sm ghost" data-paste>📋 Paste a list</button><button class="btn sm ghost" data-sgg>⬇ From start.gg</button><button class="btn sm ghost" data-shuffle>🎲 Shuffle order</button><button class="btn sm ghost" data-save>💾 Save list</button></div></div>
        <p class="hint">Drop a picture on a player to add it (or click 📷). ${F.kind === 'elim' ? (F.rules.mode === 'koth' ? 'The first two fight first; the rest wait in this order. People can join while it runs.' : 'The first two fight first; the rest come in this order (unless it’s a random draw). Up to 32 fighters.') : 'Up to 16 players — everyone plays everyone.'}</p>`;
    }
    $$('#fmtRosterBody .fmt-pl input[data-k=name], #fmtRosterBody input[data-t=coach]').forEach(inp => P.autocomplete(inp, p => {
      inp.value = p.name; inp.dispatchEvent(new Event('input', { bubbles: true }));
      const row = inp.closest('.fmt-pl'); if (row) { const x = listOf(row)[+row.dataset.i]; if (x) { Object.assign(x, { character: p.character || x.character || '', country: p.country || '', team: p.team || '', pronouns: p.pronouns || '', sggId: p.sggId || '', avatar: p.avatar || '' }); row.querySelector('[data-k=character]').value = x.character; saveSoon(); } }
    }));
  }
  const listOf = el => { const t = el.closest('[data-team]').dataset.team; return t === 'f' ? F.fighters : F.teams[+t].players; };
  const body = $('#fmtRosterBody');
  body.addEventListener('input', e => {
    const t = e.target; if (!F) return;
    if (t.dataset.k) { const row = t.closest('.fmt-pl'), list = listOf(row); list[+row.dataset.i][t.dataset.k] = t.value; saveSoon(); }
    if (t.dataset.t) { const tm = F.teams[+t.closest('[data-team]').dataset.team];
      if (t.dataset.t === 'coach') tm.coach = { ...(tm.coach || {}), name: t.value }; else tm[t.dataset.t] = t.value;
      if (t.dataset.t === 'color') t.closest('.fmt-team').style.setProperty('--tc', t.value); saveSoon(); }
  });
  body.addEventListener('click', async e => {
    const t = e.target; if (!F) return;
    const box = t.closest('[data-team]'); if (!box) return;
    const list = listOf(box);
    if (t.closest('[data-del]')) { const row = t.closest('.fmt-pl'); list.splice(+row.dataset.i, 1); saveSoon(); renderRoster(); }
    if (t.closest('[data-pic]')) {             // a picture for this player (the team bar's square cards, splashes)
      const row = t.closest('.fmt-pl'), x = list[+row.dataset.i], inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { if (inp.files[0]) setPic(x, inp.files[0]); };
      inp.click();
    }
    if (t.closest('[data-nopic]')) { const row = t.closest('.fmt-pl'), x = list[+row.dataset.i]; delete x.pic; saveSoon(); renderRoster(); toast(`Picture removed for ${x.name || 'this player'}`); }
    if (t.closest('[data-add]')) { const key = box.dataset.team; list.push({ name: '' }); renderRoster(); const nb = $(`#fmtRosterBody [data-team="${key}"]`), ins = nb ? $$('.fmt-pl input[data-k=name]', nb) : []; if (ins.length) ins[ins.length - 1].focus(); }
    if (t.closest('[data-paste]')) {
      const txt = await ask('Paste the players’ names', { lines: true, hint: 'One name per line, or separated by commas. Ctrl+Enter adds them.', ok: 'Add players' }); if (!txt) return;
      for (const n of txt.split(/[\n,]+/).map(x => x.trim()).filter(Boolean)) { const known = (P.players() || []).find(p => p.name.toLowerCase() === n.toLowerCase()); list.push(known ? { name: known.name, character: known.character || '', country: known.country || '', team: known.team || '', sggId: known.sggId || '', avatar: known.avatar || '' } : { name: n }); }
      saveSoon(); renderRoster();
    }
    if (t.closest('[data-sgg]')) {
      const ent = (P.players() || []).filter(p => p.source && p.source !== 'history');
      if (!ent.length) return toast('Load a start.gg event in the start.gg tab first', true);
      const have = new Set(list.map(p => p.name.toLowerCase())), add = ent.filter(p => !have.has(p.name.toLowerCase())).slice(0, 32 - list.length);
      list.push(...add.map(p => ({ name: p.name, character: p.character || '', country: p.country || '', team: p.team || '', sggId: p.sggId || '', avatar: p.avatar || '' })));
      toast(`Added ${add.length} from start.gg`); saveSoon(); renderRoster();
    }
    if (t.closest('[data-shuffle]')) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } saveSoon(); renderRoster(); }
    if (t.closest('[data-save]')) {
      const tm = box.dataset.team === 'f' ? null : F.teams[+box.dataset.team];
      const name = await ask('Save this list as', { value: tm ? tm.name : F.name + ' fighters', ok: 'Save' }); if (!name || !name.trim()) return;
      const entry = { name: name.trim(), tag: tm ? tm.tag : '', color: tm ? tm.color : '', coach: tm && tm.coach ? tm.coach.name : '', players: list.filter(p => p.name).map(p => ({ name: p.name, character: p.character || '', country: p.country || '', team: p.team || '' })) };
      saved = saved.filter(x => x.name !== entry.name); saved.unshift(entry);
      try { await api('/api/format/teams', { method: 'POST', body: { teams: saved } }); toast(`💾 Saved “${entry.name}”`); renderRoster(); } catch (er) { toast(er.message, true); }
    }
  });
  $('#fmtSaved').onchange = async e => {
    const s = saved[+e.target.value]; e.target.value = ''; if (!s || !F) return;
    if (F.kind === 'teams') {
      const which = F.teams[0].players.length && !F.teams[1].players.length ? 1 : await ask(`Load “${s.name}” into which team?`, { choices: [F.teams[0].name || 'Team 1', F.teams[1].name || 'Team 2'] });
      if (which == null || !F || !F.teams) return;
      F.teams[which] = { ...F.teams[which], name: s.name, tag: s.tag || '', color: s.color || F.teams[which].color, coach: s.coach ? { name: s.coach } : F.teams[which].coach, players: clone(s.players) };
    } else F.fighters = clone(s.players);
    saveSoon(); renderRoster(); toast(`📂 Loaded “${s.name}”`);
  };
  // a picture for a player: from the 📷 button or dropped on their row
  // (1.3.6) any size of picture: it is made smaller here, on this PC, before it is saved — at most 900 px on its long side,
  // as WebP (see-through parts kept). The same picture is the player's card on the team bar and their side of the
  // VS and lock-in splashes. A picture that is already small is kept as it is.
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  async function shrink(f) {
    let bmp; try { bmp = await createImageBitmap(f); } catch { throw new Error('That picture couldn\'t be opened — save it as a PNG or JPEG and try again'); }
    const MAX = 900, W = bmp.width, H = bmp.height, k = Math.min(1, MAX / Math.max(W, H));
    if (k === 1 && f.size <= 350 * 1024 && /^image\/(png|webp|jpeg)$/.test(f.type)) { bmp.close(); return { blob: f, name: f.name, w: W, h: H }; }
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('That picture couldn\'t be made smaller');
    return { blob, name: (f.name.replace(/\.[^.]+$/, '') || 'player') + (blob.type === 'image/webp' ? '.webp' : '.png'), w: c.width, h: c.height };
  }
  async function setPic(x, f) {
    if (!/^image\//.test(f.type)) return toast('That isn\'t a picture — use a PNG, JPEG, WebP or GIF', true);
    if (f.size > 60 * 1024 * 1024) return toast('That file is over 60 MB — save it smaller first', true);
    try {
      // (1.3.7) a big picture: the crop window opens first (the same one as Splash pictures: drag the box, keep the splash
      // panel's 5:6 shape or not, remove a green screen). The crop is what the card and the splashes show, scaled to each.
      let big = f.size > 1.5 * 1024 * 1024;
      try { const b = await createImageBitmap(f); big = big || Math.max(b.width, b.height) > 900; b.close(); } catch {}
      if (big && window.BeeboPicEditor) {
        const r = await window.BeeboPicEditor.open(f, x.name || 'this player', { sourceMaxSide: 16000, maxBytes: 60 * 1024 * 1024 });
        if (!r) return;                                         // cancelled
        if (r.error) return toast(r.error, true);
        f = new File([r.blob], (f.name.replace(/\.[^.]+$/, '') || 'player') + (r.blob.type === 'image/webp' ? '.webp' : '.png'), { type: r.blob.type });
      }
      const s = await shrink(f);
      const r = await fetch('/api/assets?name=' + encodeURIComponent(s.name) + '&tag=player', { method: 'POST', body: s.blob }).then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Upload failed'); }));
      x.pic = r.url; saveSoon(); renderRoster();
      toast(`📷 Picture added for ${x.name || 'this player'}${s.blob !== f ? ` (made smaller: ${kb(f.size)} → ${kb(s.blob.size)})` : ''}`);
    } catch (er) { toast(er.message, true); }
  }
  const hasFiles = e => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files');
  body.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();                              // never let the window open the file
    const r = e.target.closest('.fmt-pl');
    $$('.fmt-pl.picover', body).forEach(x => { if (x !== r) x.classList.remove('picover'); });
    e.dataTransfer.dropEffect = r ? 'copy' : 'none'; if (r) r.classList.add('picover');
  });
  body.addEventListener('dragleave', e => { if (hasFiles(e) && !body.contains(e.relatedTarget)) $$('.fmt-pl.picover', body).forEach(x => x.classList.remove('picover')); });
  body.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); $$('.fmt-pl.picover', body).forEach(x => x.classList.remove('picover'));
    const r = e.target.closest('.fmt-pl'), f = e.dataTransfer.files[0]; if (!r || !f) return;
    const x = listOf(r)[+r.dataset.i]; if (x) setPic(x, f);
  });

  // drag to reorder
  let dragRow = null;
  body.addEventListener('dragstart', e => { const r = e.target.closest('.fmt-pl'); if (!r || e.target.tagName === 'INPUT') return; dragRow = r; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
  body.addEventListener('dragover', e => { const r = e.target.closest('.fmt-pl'); if (!dragRow || !r || r.closest('[data-team]') !== dragRow.closest('[data-team]')) return; e.preventDefault(); $$('.fmt-pl.over', body).forEach(x => x.classList.remove('over')); r.classList.add('over'); });
  body.addEventListener('drop', e => { const r = e.target.closest('.fmt-pl'); if (!dragRow || !r) return; e.preventDefault(); const list = listOf(r), from = +dragRow.dataset.i, to = +r.dataset.i; const [m] = list.splice(from, 1); list.splice(to, 0, m); dragRow = null; saveSoon(); renderRoster(); });
  body.addEventListener('dragend', () => { if (dragRow) dragRow.classList.remove('drag'); dragRow = null; $$('.fmt-pl.over', body).forEach(x => x.classList.remove('over')); });

  // ------------------------------------------------------------ live
  function renderLive() {
    renderHead();
    const live = F && F.status !== 'setup';
    $('#fmtLive').hidden = !live; $('#fmtBoardCard').hidden = !live; $('#fmtLogCard').hidden = !F || !(F.log || []).length;
    if (!F || !V) return;
    $('#fmtUndo').disabled = false;
    $('#fmtLabel').textContent = V.label;
    const sp = (S && S.splash && S.splash.show) || '';
    $$('[data-fsplash]').forEach(b => b.classList.toggle('on', b.dataset.fsplash === sp));
    const fb = $('#fsBar'); fb.classList.toggle('on', !S || S.fbar !== false);
    fb.textContent = F.kind === 'teams' ? '▁ Team bar' : F.kind === 'elim' ? (F.rules.mode === 'koth' ? '▁ Challenger bar' : '▁ Survivor bar') : '▁ Standings bar';
    $('#fsVs').hidden = F.kind !== 'teams'; $('#fsWin').hidden = F.status !== 'done';
    $('#fsBoard').textContent = F.kind === 'teams' ? '📋 Team board' : F.kind === 'elim' ? (F.rules.mode === 'koth' ? '📋 King board' : '💀 Death Battle board') : '📊 Standings';
    // the right layout for this format
    // the live look's version for this format (it switches by itself when the format is picked; this puts it back if you changed it)
    const ovs = (window.BeeboPanel && BeeboPanel.overlays()) || [], cur = ovs.find(o => o.active) || {};
    const fam = ovs.filter(o => o.family === cur.family && o.game === cur.game), want = fam.find(o => o.format === F.preset);
    const lb = $('#fmtLayoutBtn'); lb.hidden = !want || want.name === cur.name; if (want) { lb.textContent = `🎨 Use “${want.title}”`; lb.dataset.name = want.name; }
    // now playing
    const m = F.match, sd = sides();
    if (F.status === 'done') {
      const w = F.kind === 'teams' ? (F.winner >= 0 ? F.teams[F.winner].name : 'It’s a draw') : (V.champion || '—');
      $('#fmtNow').innerHTML = `<div class="fmt-side" style="grid-column:1/-1;text-align:center;border-left:0"><small>${esc(F.name)} — winner</small><b>🏆 ${esc(w)}</b>${V.mvp ? `<small>MVP ${esc(V.mvp)}</small>` : ''}</div>`;
      $('#fmtActs').innerHTML = ''; $('#fmtPending').hidden = true;
    } else if (m && sd) {
      const tc = i => F.kind === 'teams' ? `style="--tc:${esc(F.teams[i].color)}"` : '';
      const sub = (x, i) => F.kind === 'teams' && F.rules.mode === 'tdb' ? `${esc(F.teams[i].name)} · ${hearts(x.lives, F.rules.lives)}${x.lives === 1 ? ' last life' : ''}` : F.kind === 'teams' ? `${esc(F.teams[i].name)}${x.coach ? ' · coach' : ` · ${F.rules.tiers ? 'Tier' : '#'}${x.slot}`}` : F.kind === 'elim' ? (F.rules.mode === 'death' ? '❤'.repeat(Math.max(0, x.lives)) || 'last life' : `${x.wins}W · streak ${x.streak}`) : `${x.wins || 0}W`;
      $('#fmtNow').innerHTML = `<div class="fmt-side" ${tc(0)}><small>${sub(sd.a, 0)}</small><b>${esc(sd.a.name)}</b></div><span class="fmt-vs">VS</span><div class="fmt-side b" ${tc(1)}><small>${sub(sd.b, 1)}</small><b>${esc(sd.b.name)}</b></div>`;
      const pend = $('#fmtPending'); pend.hidden = !pending;
      if (pending) { const wn = pending === 1 ? sd.a.name : sd.b.name; pend.innerHTML = `<b>✔ ${esc(wn)} won the set${F.rules.auto ? ' — moving on by itself in a moment' : ''}</b><button class="btn primary" id="fmtConfirm">Confirm & next match</button>`; $('#fmtConfirm').onclick = confirmResult; }
      $('#fmtActs').innerHTML = `<button class="btn sm" data-win="1">${esc(sd.a.name)} won</button><button class="btn sm" data-win="2">${esc(sd.b.name)} won</button>`
        + `<button class="btn sm ghost" data-ff="1">${esc(sd.a.name)} forfeits</button><button class="btn sm ghost" data-ff="2">${esc(sd.b.name)} forfeits</button>`;
    } else { $('#fmtNow').innerHTML = '<p class="hint">Waiting…</p>'; $('#fmtActs').innerHTML = ''; }
    renderBoard(); renderLog();
  }
  function sides() {
    const m = F && F.match; if (!m) return null;
    if (F.kind === 'teams') { const g = r => { const t = F.teams[r.t]; const p = r.coach ? t.coach : t.players[r.i]; return p ? { ...p, coach: !!r.coach, slot: r.coach ? 0 : r.i + 1 } : null; }; return { a: g(m.a), b: g(m.b) }; }
    const g = id => F.fighters.find(x => x.id === id); return { a: g(m.a), b: g(m.b) };
  }
  function renderBoard() {
    const box = $('#fmtBoard');
    if (F.kind === 'teams' && F.rules.mode === 'tdb') {
      $('#fmtBoardTitle').textContent = V.switchOpen ? '🔄 Switch window — pick who fights next' : `Teams — ${V.teams[0].livesLeft} v ${V.teams[1].livesLeft} lives`;
      box.innerHTML = `${V.switchOpen ? '<p class="hint">A life was lost: either team can put in another fighter now (they keep the lives they have). <button class="btn sm primary" id="fmtLock">✓ Lock in</button> — it also locks by itself once the next set starts.</p>' : ''}<div class="fmt-board-teams">${V.teams.map((t, ti) => `<div class="fmt-bt"><h3 style="color:${esc(t.color)}">${esc(t.name)} <i>${t.livesLeft} lives · ${t.left} of ${t.size} left</i></h3>
        ${t.players.map((p, i) => `<div class="fmt-chip ${p.state}">${p.pic ? `<img class="fmt-chip-pic" src="${esc(p.pic)}" alt="">` : ''}${esc(p.name)}<small>${p.out ? '☠ out' : hearts(p.lives, F.rules.lives)}${p.hits ? ` · cracked ${p.hits}/${F.rules.setsPerLife}` : ''}${p.state === 'playing' ? ' · fighting' : ''}</small>
          ${F.status === 'live' && !p.out && p.state !== 'playing' && V.switchOpen ? `<button data-swap="${ti}:${i}" title="Switch this fighter in">🔄 in</button>` : ''}${F.status === 'live' ? `<button data-tlife="${ti}:${i}" data-d="1" title="Give a life back">＋❤</button>${!p.out ? `<button data-tlife="${ti}:${i}" data-d="-1" title="Take a life">−❤</button>` : ''}` : ''}</div>`).join('')}</div>`).join('')}</div>`;
      const lk = $('#fmtLock'); if (lk) lk.onclick = () => post({ do: 'lock' }, '✓ Locked in');
    } else if (F.kind === 'teams') {
      $('#fmtBoardTitle').textContent = F.rules.mode === 'paired' ? `Points — first to ${V.goal}` : 'Crews';
      box.innerHTML = `<div class="fmt-board-teams">${V.teams.map((t, ti) => `<div class="fmt-bt"><h3 style="color:${esc(t.color)}">${esc(t.name)} ${F.rules.mode === 'paired' ? `<span class="fmt-pips">${Array.from({ length: V.goal }, (_, i) => `<i class="${i < t.points ? 'on' : ''}"></i>`).join('')}</span>` : ''}<i>${F.rules.mode === 'paired' ? t.points + ' pts' : t.left + ' left'}${t.coach ? ' · coach ' + esc(t.coach) : ''}</i></h3>
        ${t.players.map((p, i) => `<div class="fmt-chip ${p.state}"><span class="k">${F.rules.tiers ? 'T' : '#'}${i + 1}</span>${esc(p.name)}${p.retired ? ' <small>retired</small>' : ''}<small>${p.wins}W ${p.losses}L${p.state === 'next' ? ' · next' : ''}</small>${F.status === 'live' && F.rules.mode === 'stay' && p.state !== 'out' && p.state !== 'playing' ? `<button data-swap="${ti}:${i}" title="Play this player now">▶ now</button>` : ''}</div>`).join('')}</div>`).join('')}</div>`;
    } else if (F.kind === 'elim') {
      $('#fmtBoardTitle').textContent = F.rules.mode === 'koth' ? `King: ${V.king || '—'} · streak ${V.streak}` : `${V.alive} of ${V.total} left`;
      const fs = V.fighters.slice().sort((a, b) => (a.out - b.out) || (a.out ? a.place - b.place : 0));
      box.innerHTML = `<div class="fmt-fighters">${fs.map(x => `<div class="fmt-chip ${x.state}">${x.king ? '👑 ' : ''}${esc(x.name)}<small>${x.out ? `☠ ${ord(x.place)}` : F.rules.mode === 'death' ? `<span class="fmt-lives">${'❤'.repeat(x.lives)}</span>` : `${x.wins}W · best ${x.best}`}</small>
        ${F.status === 'live' && !x.out && x.state !== 'playing' ? (F.rules.mode === 'death' ? `<button data-life="${x.id}" title="Give a life back">＋❤</button>` : '') + `<button data-leave="${x.id}" title="${F.rules.mode === 'koth' ? 'Leaves the queue' : 'No-show: out now'}">✕</button>` : ''}</div>`).join('')}</div>
        ${F.status === 'live' && F.rules.mode === 'koth' ? '<div class="fmt-add"><input type="text" id="fmtJoin" placeholder="Someone joins the queue…" style="max-width:260px"><button class="btn sm" id="fmtJoinBtn">＋ Join</button></div>' : ''}
        ${V.queue && V.queue.length ? `<p class="hint">Queue: ${V.queue.map(esc).join(' → ')}</p>` : ''}`;
      const j = $('#fmtJoin'); if (j) { P.autocomplete(j, p => { j.value = p.name; }); $('#fmtJoinBtn').onclick = () => { if (j.value.trim()) post({ do: 'join', player: { name: j.value.trim() } }, `${j.value.trim()} joined the queue`); }; j.onkeydown = e => { if (e.key === 'Enter') $('#fmtJoinBtn').click(); }; }
    } else {
      $('#fmtBoardTitle').textContent = `Standings — ${V.played} of ${V.total} played`;
      box.innerHTML = `<table class="fmt-st"><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>Games</th><th>+/−</th></tr>${V.standings.map(r => `<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.gf}–${r.ga}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`).join('')}</table>
        <div class="fmt-sched">${V.schedule.map(s => `<button class="${s.done ? 'done' : ''}${s.now ? ' now' : ''}" data-sid="${s.id}" ${s.done ? 'disabled' : ''}><small>R${s.round}</small> ${esc(s.a)} vs ${esc(s.b)}${s.done ? ` — ${s.score ? s.score.join('–') : s.w === 1 ? 'W–L' : 'L–W'}` : s.now ? ' — now' : ''}</button>`).join('')}</div><p class="hint">Click a match to play it next.</p>`;
    }
  }
  const hearts = (n, max) => `<span class="fmt-lives">${'❤'.repeat(Math.max(0, n || 0))}<i>${'❤'.repeat(Math.max(0, Math.max(max || 0, n || 0) - (n || 0)))}</i></span>`;
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  function renderLog() {
    const L = (F && F.log) || [];
    $('#fmtLog').innerHTML = `<div class="fmt-log">${L.slice().reverse().map(l => `<div><i>${l.tiebreak ? 'TB' : '#' + l.n}</i><span>${l.w === 1 ? `<b>${esc(l.a)}</b> beat ${esc(l.b)}` : `<b>${esc(l.b)}</b> beat ${esc(l.a)}`}${l.score ? ` <small>${(l.w === 2 ? l.score.slice().reverse() : l.score).join('–')}</small>` : ''}${l.forfeit ? ' <small>(forfeit)</small>' : ''}${l.final ? ' <small>final</small>' : ''}</span></div>`).join('')}</div>`;
  }
  $('#fmtBoard').addEventListener('click', e => {
    const s = e.target.closest('[data-swap]'), l = e.target.closest('[data-life]'), lv = e.target.closest('[data-leave]'), sid = e.target.closest('[data-sid]');
    if (s) { const [ti, i] = s.dataset.swap.split(':').map(Number); if (F.rules.mode === 'tdb') post({ do: 'swap', side: ti + 1, index: i }, `🔄 ${F.teams[ti].players[i].name} switches in`); else if (window.confirm('Put this player in the current match instead?')) post({ do: 'swap', side: ti + 1, index: i }, 'Swapped'); }
    const tl = e.target.closest('[data-tlife]');
    if (tl) { const [ti, i] = tl.dataset.tlife.split(':').map(Number), x = F.teams[ti].players[i], n = Math.max(0, Math.min(9, (x.lives || 0) + Number(tl.dataset.d))); if (n === 0 && !window.confirm(`${x.name} is out?`)) return; post({ do: 'lives', id: `t${ti}-${i}`, lives: n }, n > (x.lives || 0) ? 'Life given back' : 'Life taken'); }
    if (l) { const x = F.fighters.find(y => y.id === l.dataset.life); post({ do: 'lives', id: l.dataset.life, lives: (x.lives || 0) + 1 }, 'Life given back'); }
    if (lv) { const x = F.fighters.find(y => y.id === lv.dataset.leave); if (window.confirm(F.rules.mode === 'koth' ? `${x.name} leaves the queue?` : `${x.name} is out (no-show)?`)) post({ do: 'leave', id: lv.dataset.leave }); }
    if (sid && !sid.disabled) post({ do: 'pick', sid: sid.dataset.sid }, 'Loaded that match');
  });
  $('#fmtActs').addEventListener('click', e => {
    const w = e.target.closest('[data-win]'), ff = e.target.closest('[data-ff]');
    if (w) { const sd = sides(); const name = w.dataset.win === '1' ? sd.a.name : sd.b.name; if (window.confirm(`Record a win for ${name}? (The score in the Matches tab is used if it has one.)`)) post({ do: 'confirm', w: Number(w.dataset.win) }); }
    if (ff) { const sd = sides(); const name = ff.dataset.ff === '1' ? sd.a.name : sd.b.name; if (window.confirm(`${name} forfeits this match?`)) post({ do: 'forfeit', side: Number(ff.dataset.ff) }); }
  });
  const confirmResult = async () => {
    const sd = sides(), wn = pending === 1 ? sd.a.name : pending === 2 ? sd.b.name : '';
    await post({ do: 'confirm' });
    P.toast(`✔ ${wn ? wn + ' wins — ' : ''}next match loaded`, { action: '↶ Undo', run: () => post({ do: 'undo' }, '↶ Result undone'), ms: 7000 });
  };
  $('#fmtUndo').onclick = () => post({ do: 'undo' }, '↶ Result undone');
  async function start() {
    clearTimeout(saveT); await post({ do: 'save', format: F, editor: ME }).catch(() => {});
    const r = await post({ do: 'start' }, `▶ ${F.name} started — the first match is loaded`);
    P.showTab('match');                     // matches are run from the Matches tab
    return r;
  }
  $('#fmtStart').onclick = () => start().catch(() => {});
  $('#fmtEnd').onclick = () => { if (window.confirm('End it now? The best record so far wins.')) post({ do: 'end' }); };
  $('#fmtReset').onclick = () => { if (window.confirm('Go back to setup? The results so far are cleared (rosters stay).')) post({ do: 'reset' }).then(load); };
  $('#fmtClear').onclick = () => { if (window.confirm('Turn the format off? Rosters are cleared (save them first if you want them again).')) post({ do: 'clear' }).then(load); };
  $$('[data-fsplash]').forEach(b => b.onclick = () => post({ do: 'splash', kind: b.dataset.fsplash, show: 'toggle' }));
  $('#fsBar').onclick = () => api('/api/remote/action', { method: 'POST', body: { action: 'fbar', show: 'toggle' } }).then(r => toast(r.status && r.status.fbar ? 'Format bar on stream' : 'Format bar hidden')).catch(er => toast(er.message, true));
  $('#fmtLayoutBtn').onclick = e => api('/api/overlays/active', { method: 'POST', body: { name: e.currentTarget.dataset.name } }).then(() => toast('Layout switched')).catch(er => toast(er.message, true));
  $('#fmtCsv').onclick = () => {
    const rows = [['#', 'Player A', 'Player B', 'Winner', 'Score', 'Note']].concat((F.log || []).map(l => [l.tiebreak ? 'TB' : l.n, l.a, l.b, l.w === 1 ? l.a : l.b, l.score ? l.score.join('-') : '', l.forfeit ? 'forfeit' : l.final ? 'final' : '']));
    if (V && V.standings) rows.push([], ['Rank', 'Player', 'Wins', 'Losses', 'Games for', 'Games against'], ...V.standings.map(r => [r.rank, r.name, r.wins, r.losses, r.gf, r.ga]));
    const csv = rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = (F.name || 'format').replace(/[^\w-]+/g, '-') + '-results.csv'; a.click();
  };
  // Ctrl+Alt+Enter confirms, Ctrl+Alt+Z undoes a result (anywhere in the app)
  addEventListener('keydown', e => {
    if (!F || F.status !== 'live' || !e.ctrlKey || !e.altKey) return;
    if (e.key === 'Enter' && pending) { e.preventDefault(); confirmResult(); }
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); $('#fmtUndo').click(); }
  });
  window.BeeboFormat = { confirm: () => confirmResult(), choose, start, presets: PRESETS, get: () => ({ F, V, pending, S }), post, sides: () => sides(), flush: () => { clearTimeout(saveT); return F ? post({ do: 'save', format: F, editor: ME }).catch(() => {}) : null; } };
  load();
})();
