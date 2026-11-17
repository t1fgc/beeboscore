/* BeeboScore — Format tab: team battles (crew, Sajam Slam style, gauntlet), Death Battle, King of the Hill, leagues */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const { api, toast, esc } = P;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));

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
  // 1.12.19: a result, a forfeit, a knock-out or leaving the queue happens straight away — every one of them can be undone
  const undoable = (body, msg) => post(body).then(r => { P.toast(msg, { action: '↶ Undo', run: () => post({ do: 'undo' }, '↶ Undone'), ms: 7000 }); return r; });
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
  // 1.11: each player's own picture or clip (optional) instead of the character line — shown on their team bar card and on the
  // FullVS when they're up. Drop a file on the square or click it.
  const PIC_TIP = '<p class="hint fmt-pictip"><b>Picture or clip for each player (optional)</b> — drop it on the square next to the name, or click the square. <b>Best size:</b> square, 256 × 256 px or bigger (512 × 512 is sharpest). <b>Types:</b> any picture (PNG or WebP with a see-through background is best; big ones are made smaller for you, up to 60 MB), a GIF, or a WebM / MP4 clip up to 6 seconds (under 8 MB). A clip filmed on a green screen has the green taken out on its own — click <b>KEYED</b> to keep it. It shows on the <b>PlayerCards</b> along the bottom, on <b>FullVS</b> and on <b>GlassVS</b>; <b>⤢</b> beside a picture sets its size and position for all three.</p>';
  const picKind = src => /\.(webm|mp4|mov|m4v)(\?|$)/i.test(src || '') ? 'clip' : /\.gif(\?|$)/i.test(src || '') ? 'GIF' : /\.(png|webp|apng)(\?|$)/i.test(src || '') ? 'PNG' : 'pic';
  function picCell(p) {
    const src = p.pic || '', kind = picKind(src), name = esc(p.name || 'this player');
    const thumb = !src ? '<span class="fmt-pic-plus">+</span>' : kind === 'clip' && p.picKey && window.BeeboKey ? `<span class="fmt-pic-m" data-src="${esc(src)}" data-key="${esc(p.picKey)}"></span>`
      : kind === 'clip' ? `<video src="${esc(src)}" muted loop autoplay playsinline></video>` : `<img src="${esc(src)}" alt="">`;
    const badge = !src ? '' : kind === 'clip' ? `<i class="fmt-pic-b${p.picKey ? ' keyed' : ''}" data-key title="${p.picKey ? 'The green screen is taken out on stream. Click to keep it.' : 'Shown as it is. Click to take a green screen out.'}">${p.picKey ? 'KEYED' : 'CLIP'}</i>` : `<i class="fmt-pic-b">${kind}</i>`;
    return `<button class="fmt-pic${src ? ' has' : ''}" data-pic title="${src ? `Change ${name}’s picture (drop a new one, or click). Right-click to remove it.` : `Add a picture or clip for ${name} (optional): drop it here, or click`}">${thumb}${badge}</button>`;
  }
  function playerRow(p, i, path, tiers) {
    return `<div class="fmt-pl" draggable="true" data-path="${path}" data-i="${i}"><span class="grip" title="Drag to reorder">⋮⋮</span><span class="num">${tiers ? 'T' + (i + 1) : '#' + (i + 1)}</span>
      <input type="text" data-k="name" value="${esc(p.name)}" placeholder="Player name" autocomplete="off">${picCell(p)}${p.pic && picKind(p.pic) !== 'clip' ? `<button class="x pf-btn" data-frame title="Picture size — the same on FullVS, GlassVS and the PlayerCards">⤢</button>` : '<span class="x-gap"></span>'}
      <button class="x" data-del title="Remove">✕</button></div>`;
  }
  // a picture is made smaller here, on this PC, before it is saved (1.12, from the prototype): at most 900 px on its long side,
  // as WebP (see-through parts kept), so a 20 MB photo becomes a light card. A picture that's already small is kept as it is,
  // and so is a GIF that moves (unless it's huge: then its first frame is used).
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  async function shrink(f) {
    let bmp; try { bmp = await createImageBitmap(f); } catch { throw new Error('That picture couldn’t be opened — save it as a PNG or JPEG and try again'); }
    const MAX = 900, W = bmp.width, H = bmp.height, k = Math.min(1, MAX / Math.max(W, H));
    if (k === 1 && f.size <= 350 * 1024 && /^image\/(png|webp|jpeg)$/.test(f.type)) { bmp.close(); return { blob: f, name: f.name }; }
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('That picture couldn’t be made smaller');
    return { blob, name: (f.name.replace(/\.[^.]+$/, '') || 'player') + (blob.type === 'image/webp' ? '.webp' : '.png') };
  }
  window.__fmtShrink = shrink;      // (tests)
  // a dropped or chosen file: checked, made smaller if it's a big picture, uploaded; a clip checked for a green screen
  async function setPic(x, f) {
    if (!f) return;
    const isClip = /^video\//.test(f.type) || /\.(webm|mp4|mov|m4v)$/i.test(f.name), isPic = /^image\//.test(f.type) || /\.(png|webp|jpe?g|gif|avif|bmp)$/i.test(f.name);
    if (!isClip && !isPic) return toast('That file can’t be used — use a picture (PNG, JPEG, WebP, GIF…) or a WebM / MP4 clip', true);
    if (isClip && f.size > 8 * 1024 * 1024) return toast('Keep a clip under 8 MB — 6 seconds is plenty', true);
    if (isPic && f.size > 60 * 1024 * 1024) return toast('That picture is over 60 MB — save it smaller first', true);
    let key = '', body = f, name = f.name;
    if (isClip) {
      const dur = await new Promise(r => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { r(v.duration || 0); URL.revokeObjectURL(v.src); }; v.onerror = () => r(0); v.src = URL.createObjectURL(f); });
      if (dur > 6.5) toast(`That clip is ${Math.round(dur)} seconds — it’ll loop, but under 6 seconds keeps it light`);
      key = window.BeeboKey ? await BeeboKey.detect(f) : '';
    } else if (!(/gif$/i.test(f.type) && f.size <= 8 * 1024 * 1024)) {
      // 1.12.5: the picture window first — crop it, size it, take the background out — so it fits the card and GlassVS
      let src = f, edited = false;
      if (window.BeeboPicEditor && !window.__fmtNoEditor) {
        const out = await window.BeeboPicEditor.open(f, x.name || 'this player', { title: `Picture for ${x.name || 'this player'}` });
        if (!out) return;                                            // cancelled: nothing changes
        if (out.error && !/at least/.test(out.error)) return toast(out.error, true);
        if (!out.error) { src = new File([out.blob], (f.name.replace(/\.[^.]+$/, '') || 'player') + '.png', { type: out.blob.type || 'image/png' }); edited = true; }   // (a small picture skips the window)
      }
      try { const sm = await shrink(src); body = sm.blob; name = sm.name; if (edited && body === src) body = src; } catch (err) { return toast(err.message, true); }
    }
    try {
      const r = await fetch('/api/assets?tag=player&name=' + encodeURIComponent(name), { method: 'POST', body }).then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Upload failed'); }));
      x.pic = r.url; x.picKey = key; saveSoon(); renderRoster();
      toast(`${isClip ? 'Clip' : 'Picture'} added for ${x.name || 'that player'}${key ? ' — green screen taken out' : ''}${body !== f ? ` (made smaller: ${kb(f.size)} → ${kb(body.size)})` : ''}`);
    } catch (err) { toast(err.message, true); }
  }
  // 1.12.6: every player needs a name of their own — the same name twice is marked in red and the format can't start
  const nkey = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function dupeNames() {
    if (!F) return [];
    const all = F.kind === 'teams' ? F.teams.flatMap(t => t.players.map(p => p.name)) : (F.fighters || []).map(x => x.name), seen = {}, out = new Set();
    for (const n of all) { const k = nkey(n); if (!k) continue; if (seen[k]) out.add(k); seen[k] = 1; }
    return [...out];
  }
  function markDupes() {
    const d = dupeNames();
    $$('#fmtRosterBody .fmt-pl input[data-k=name]').forEach(i => { const bad = d.includes(nkey(i.value)); i.classList.toggle('dupe', bad); i.title = bad ? 'Another player already has this name — give one of them a different name' : ''; });
    let w = $('#fmtDupe'); if (!w) { w = document.createElement('p'); w.id = 'fmtDupe'; w.className = 'hint bad'; $('#fmtRosterBody').after(w); }
    w.hidden = !d.length; w.textContent = d.length ? `⚠ Two players can’t have the same name (${d.map(n => `“${n}”`).join(', ')}). Change one of them — the format can’t start until every name is different.` : '';
    const st = $('#fmtStart'); if (st) { st.disabled = !!d.length; st.title = d.length ? 'Every player needs a different name first' : ''; }
    return d;
  }
  function renderRoster() {
    if (!F) return;
    $('#fmtSaved').innerHTML = '<option value="">📂 Load a saved list…</option>' + saved.map((t, i) => `<option value="${i}">${esc(t.name || 'Saved list')} (${(t.players || []).length})</option>`).join('');
    if (F.kind === 'teams') {
      $('#fmtRosterTitle').firstChild.textContent = 'Teams ';
      $('#fmtRosterBody').innerHTML = `<div class="fmt-teams">${F.teams.map((t, ti) => `<div class="fmt-team" style="--tc:${esc(t.color)}" data-team="${ti}">
        <div class="row3"><div class="field"><label class="l">${F.preset === 'gauntlet' && ti === 0 ? 'The player taking on the line' : 'Team ' + (ti + 1)}</label><input type="text" data-t="name" value="${esc(t.name)}" maxlength="40"></div>
          <div class="field"><label class="l">Colour</label><input type="color" data-t="color" value="${esc(t.color)}"></div>
          <div class="field"><label class="l">Logo</label><button class="fmt-logo${t.logo ? ' has' : ''}" data-logo title="${t.logo ? 'Click to change · right-click to remove' : 'Optional: a square PNG with a see-through background, 256 × 256 or bigger. It goes in the team’s box on the bar (the name moves up over it) and on the team screens.'}">${t.logo ? `<img src="${esc(t.logo)}" alt="">` : '＋'}</button></div></div>
        ${F.rules.coach ? `<div class="field"><label class="l">Coach (plays the tiebreaker)</label><input type="text" data-t="coach" value="${esc(t.coach ? t.coach.name : '')}" placeholder="Coach name" autocomplete="off"></div>` : ''}
        <label class="l">Players ${F.rules.mode === 'tdb' ? '— the first one leads (you can switch before the first set)' : F.rules.tiers ? '— least to most experienced' : '— in playing order'}</label>
        <div class="fmt-list">${t.players.map((p, i) => playerRow(p, i, 't' + ti, F.rules.tiers)).join('')}</div>
        <div class="fmt-add"><button class="btn sm" data-add>＋ Player</button><button class="btn sm ghost" data-paste>📋 Paste a list</button><button class="btn sm ghost" data-save>💾 Save team</button></div></div>`).join('')}</div>
        ${PIC_TIP}<p class="hint">Drag ⋮⋮ to reorder. Names autocomplete from start.gg and past players. Paired battles need the same number of players on each side.</p>`;
    } else {
      $('#fmtRosterTitle').firstChild.textContent = F.kind === 'league' ? 'Players ' : 'Fighters ';
      $('#fmtRosterBody').innerHTML = `<div class="fmt-team" data-team="f"><div class="fmt-list">${F.fighters.map((p, i) => playerRow(p, i, 'f', false)).join('')}</div>
        <div class="fmt-add"><button class="btn sm" data-add>＋ ${F.kind === 'league' ? 'Player' : 'Fighter'}</button><button class="btn sm ghost" data-paste>📋 Paste a list</button><button class="btn sm ghost" data-sgg>⬇ From start.gg</button><button class="btn sm ghost" data-shuffle>🎲 Shuffle order</button><button class="btn sm ghost" data-save>💾 Save list</button></div></div>
        ${PIC_TIP}<p class="hint">${F.kind === 'elim' ? (F.rules.mode === 'koth' ? 'The first two fight first; the rest wait in this order. People can join while it runs.' : 'The first two fight first; the rest come in this order (unless it’s a random draw). Up to 32 fighters.') : 'Up to 16 players — everyone plays everyone.'}</p>`;
    }
    $$('#fmtRosterBody .fmt-pic-m').forEach(m => BeeboKey.media(m, m.dataset.src, m.dataset.key));     // a keyed clip shows keyed here too
    $$('#fmtRosterBody .fmt-pl input[data-k=name], #fmtRosterBody input[data-t=coach]').forEach(inp => P.autocomplete(inp, p => {
      inp.value = p.name; inp.dispatchEvent(new Event('input', { bubbles: true }));
      const row = inp.closest('.fmt-pl'); if (row) { const x = listOf(row)[+row.dataset.i]; if (x) { Object.assign(x, { character: p.character || x.character || '', country: p.country || '', team: p.team || '', pronouns: p.pronouns || '', sggId: p.sggId || '', avatar: p.avatar || '' }); saveSoon(); } }
    }));
    markDupes();
  }
  const listOf = el => { const t = el.closest('[data-team]').dataset.team; return t === 'f' ? F.fighters : F.teams[+t].players; };
  const body = $('#fmtRosterBody');
  body.addEventListener('dragover', e => { const c = e.target.closest('[data-pic]'); if (!c || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); e.stopPropagation(); c.classList.add('over'); });
  body.addEventListener('dragleave', e => { const c = e.target.closest('[data-pic]'); if (c) c.classList.remove('over'); });
  body.addEventListener('drop', e => {
    const c = e.target.closest('[data-pic]'); if (!c || !F || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); e.stopPropagation(); c.classList.remove('over');
    const row = c.closest('.fmt-pl'); setPic(listOf(row)[+row.dataset.i], e.dataTransfer.files[0]);
  });
  // 1.12.6: a player's picture size (FullVS, GlassVS and the PlayerCards)
  body.addEventListener('click', e => {
    const fb = e.target.closest('[data-frame]'); if (!fb || !F || !window.BeeboPicFrame) return;
    const row = fb.closest('.fmt-pl'), x = listOf(row)[+row.dataset.i]; if (x && x.pic) BeeboPicFrame.open({ name: x.name, src: x.pic });
  });
  // 1.12.6: a team logo (optional) — a square PNG; it's made smaller if it's big
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-logo]'); if (!b || !F || F.kind !== 'teams') return;
    const tm = F.teams[+b.closest('[data-team]').dataset.team], inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/webp,image/svg+xml,image/jpeg';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        let body2 = f, name2 = f.name; if (!/svg/.test(f.type)) { const sm = await shrink(f); body2 = sm.blob; name2 = sm.name; }
        const r = await fetch('/api/assets?tag=team&name=' + encodeURIComponent(name2), { method: 'POST', body: body2 }).then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Upload failed'); }));
        tm.logo = r.url; saveSoon(); renderRoster(); toast(`Logo added for ${tm.name}`);
      } catch (err) { toast(err.message, true); }
    };
    inp.click();
  });
  body.addEventListener('contextmenu', e => {
    const lg = e.target.closest('[data-logo]'); if (lg && F && F.kind === 'teams') { e.preventDefault(); const tm = F.teams[+lg.closest('[data-team]').dataset.team]; if (tm.logo) { tm.logo = ''; saveSoon(); renderRoster(); toast(`Logo removed for ${tm.name}`); } return; }
    const c = e.target.closest('.fmt-pic.has'); if (!c || !F) return; e.preventDefault();
    const row = c.closest('.fmt-pl'), x = listOf(row)[+row.dataset.i]; x.pic = ''; x.picKey = ''; saveSoon(); renderRoster(); toast(`Picture removed for ${x.name || 'that player'}`);
  });
  body.addEventListener('input', e => {
    const t = e.target; if (!F) return;
    if (t.dataset.k) { const row = t.closest('.fmt-pl'), list = listOf(row); list[+row.dataset.i][t.dataset.k] = t.value; saveSoon(); if (t.dataset.k === 'name') markDupes(); }
    if (t.dataset.t) { const tm = F.teams[+t.closest('[data-team]').dataset.team];
      if (t.dataset.t === 'coach') tm.coach = { ...(tm.coach || {}), name: t.value }; else tm[t.dataset.t] = t.value;
      if (t.dataset.t === 'color') t.closest('.fmt-team').style.setProperty('--tc', t.value); saveSoon(); }
  });
  body.addEventListener('click', async e => {
    const t = e.target; if (!F) return;
    const box = t.closest('[data-team]'); if (!box) return;
    const list = listOf(box);
    if (t.closest('[data-del]')) { const row = t.closest('.fmt-pl'); list.splice(+row.dataset.i, 1); saveSoon(); renderRoster(); }
    if (t.closest('[data-key]')) {             // KEYED / CLIP: take the green screen out, or keep it
      e.preventDefault(); e.stopPropagation();
      const row = t.closest('.fmt-pl'), x = list[+row.dataset.i];
      if (x.picKey) { x.picKey = ''; toast('Shown as it is'); }
      else { const k = window.BeeboKey ? await BeeboKey.detect(x.pic) : ''; x.picKey = k || '#00b140'; toast('Green screen taken out on stream'); }
      saveSoon(); renderRoster(); return;
    }
    if (t.closest('[data-pic]')) {             // the player's picture or clip
      const row = t.closest('.fmt-pl'), x = list[+row.dataset.i], inp = document.createElement('input'); inp.type = 'file';
      inp.accept = 'image/png,image/webp,image/jpeg,image/gif,video/webm,video/mp4';
      inp.onchange = () => setPic(x, inp.files[0]);
      inp.click();
    }
    if (t.closest('[data-add]')) { const key = box.dataset.team; list.push({ name: '' }); renderRoster(); const nb = $(`#fmtRosterBody [data-team="${key}"]`), ins = nb ? $$('.fmt-pl input[data-k=name]', nb) : []; if (ins.length) ins[ins.length - 1].focus(); }
    if (t.closest('[data-paste]')) {
      const txt = await BeeboAsk.text({ title: 'Paste names', text: 'One name per line, or separated by commas. Names the app already knows bring their character, country and team with them.', multiline: true, placeholder: 'CrimsonByte\nNeonGhoul\nRamenRush', ok: 'Add names' }); if (!txt) return;
      for (const n of txt.split(/[\n,]+/).map(x => x.trim()).filter(Boolean)) { const known = (P.players() || []).find(p => p.name.toLowerCase() === n.toLowerCase()); list.push(known ? { name: known.name, character: known.character || '', country: known.country || '', team: known.team || '', sggId: known.sggId || '', avatar: known.avatar || '' } : { name: n }); }
      saveSoon(); renderRoster();
    }
    if (t.closest('[data-sgg]')) {
      const ent = (P.players() || []).filter(p => p.source && p.source !== 'history');
      if (!ent.length) return toast('Load a start.gg event in the Bracket tab first', true);
      const have = new Set(list.map(p => p.name.toLowerCase())), add = ent.filter(p => !have.has(p.name.toLowerCase())).slice(0, 32 - list.length);
      list.push(...add.map(p => ({ name: p.name, character: p.character || '', country: p.country || '', team: p.team || '', sggId: p.sggId || '', avatar: p.avatar || '' })));
      toast(`Added ${add.length} from start.gg`); saveSoon(); renderRoster();
    }
    if (t.closest('[data-shuffle]')) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } saveSoon(); renderRoster(); }
    if (t.closest('[data-save]')) {
      const tm = box.dataset.team === 'f' ? null : F.teams[+box.dataset.team];
      const name = await BeeboAsk.text({ title: 'Save this roster', label: 'Save as', value: tm ? tm.name : F.name + ' fighters', max: 60, ok: 'Save' }); if (!name) return;
      const entry = { name: name.trim(), tag: tm ? tm.tag : '', color: tm ? tm.color : '', coach: tm && tm.coach ? tm.coach.name : '', players: list.filter(p => p.name).map(p => ({ name: p.name, character: p.character || '', country: p.country || '', team: p.team || '', pic: p.pic || '', picKey: p.picKey || '' })) };
      saved = saved.filter(x => x.name !== entry.name); saved.unshift(entry);
      try { await api('/api/format/teams', { method: 'POST', body: { teams: saved } }); toast(`💾 Saved “${entry.name}”`); renderRoster(); } catch (er) { toast(er.message, true); }
    }
  });
  $('#fmtSaved').onchange = async e => {
    const s = saved[+e.target.value]; e.target.value = ''; if (!s || !F) return;
    if (F.kind === 'teams') {
      const which = F.teams[0].players.length && !F.teams[1].players.length ? 1 : await BeeboAsk.choice({ title: `Load “${s.name}”`, text: 'Which team does this roster go into? Its players replace that team’s.', options: [{ label: `Team 1${F.teams[0].name ? ' · ' + F.teams[0].name : ''}`, value: 0, primary: true }, { label: `Team 2${F.teams[1].name ? ' · ' + F.teams[1].name : ''}`, value: 1 }] });
      if (which == null) return;
      F.teams[which] = { ...F.teams[which], name: s.name, tag: s.tag || '', color: s.color || F.teams[which].color, coach: s.coach ? { name: s.coach } : F.teams[which].coach, players: clone(s.players) };
    } else F.fighters = clone(s.players);
    saveSoon(); renderRoster(); toast(`📂 Loaded “${s.name}”`);
  };
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
    $('#fsVs').hidden = F.kind !== 'teams';
    { const pv = $('#fsPvs'); if (pv) { pv.hidden = F.status !== 'live'; pv.classList.toggle('on', !!(S && S.playerVs && S.playerVs.show)); pv.textContent = S && S.playerVs && S.playerVs.show ? '⚔ Hide GlassVS' : '⚔ GlassVS'; } } $('#fsWin').hidden = F.status !== 'done';
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
  // ------------------------------------------------------------ manage players (only while a format runs)
  // Every number here is a button: lives, points, streaks, wins, the order, who's out. It's the same game as the
  // Matches tab — the score strip at the top is the Matches tab's score, and a set won there shows up here.
  const step = (op, id, val, lo, hi, label, extra = '') => `<span class="mg-step" title="${esc(label)}"><button data-adj="${op}" data-id="${esc(id)}" data-n="${val - 1}" ${val <= lo ? 'disabled' : ''} aria-label="${esc(label)} down">−</button><b>${val}</b><button data-adj="${op}" data-id="${esc(id)}" data-n="${val + 1}" ${val >= hi ? 'disabled' : ''} aria-label="${esc(label)} up">＋</button>${extra ? `<i>${extra}</i>` : ''}</span>`;
  const STATE = { playing: 'Fighting', next: 'Up next', wait: 'Waiting', out: 'Out' };
  const pill = (st, txt) => `<span class="mg-st ${st}">${txt || STATE[st] || st}</span>`;
  const act = (attrs, txt, title, cls = '') => `<button class="mg-act ${cls}" ${attrs} title="${esc(title)}">${txt}</button>`;
  function renderScore() {
    const box = $('#fmtScore'); if (!box) return;
    const sd = F && F.status === 'live' ? sides() : null;
    if (!sd || !sd.a || !sd.b) { box.hidden = true; return; }
    const D = (P.draft && P.draft()) || S || {}, sc = k => Number((D[k] || {}).score) || 0, ft = F.rules.ft || 1, dirty = P.dirty && P.dirty();
    const side = (k, x, i) => `<div class="mg-sc ${k}" ${F.kind === 'teams' ? `style="--tc:${esc(F.teams[i].color)}"` : ''}><span class="nm">${esc(x.name)}</span>
      <span class="mg-step big"><button data-sc="${k}" data-d="-1" ${sc(k) <= 0 ? 'disabled' : ''} aria-label="${esc(x.name)} minus one">−</button><b>${sc(k)}</b><button data-sc="${k}" data-d="1" aria-label="${esc(x.name)} plus one">＋</button></span></div>`;
    box.hidden = false;
    box.innerHTML = `${side('p1', sd.a, 0)}<div class="mg-mid"><small>This set</small><b>First to ${ft}</b>${pending ? `<button class="btn sm primary" data-confirm>✔ ${esc(pending === 1 ? sd.a.name : sd.b.name)} won — next</button>` : dirty ? '<button class="btn sm" data-push title="The Matches tab is in Manual mode: send the score to the overlay">Update overlay</button>' : '<span class="mg-live">same score as the Matches tab</span>'}</div>${side('p2', sd.b, 1)}`;
  }
  function renderBoard() {
    const box = $('#fmtBoard'), live = F.status === 'live', title = $('#fmtBoardTitle'), sub = $('#fmtBoardSub');
    renderScore();
    if (F.kind === 'teams') {
      if (document.activeElement && document.activeElement.classList.contains('mg-ch') && box.contains(document.activeElement)) { clearTimeout(box.__later); box.__later = setTimeout(() => renderBoard(), 800); return; }   // (typing a character: redraw after)
      const tdb = F.rules.mode === 'tdb', paired = F.rules.mode === 'paired', per = F.rules.setsPerLife || 1;
      title.textContent = tdb && V.switchOpen ? '🔄 Switch window — pick who fights next' : 'Manage players';
      sub.textContent = tdb ? `${V.teams[0].livesLeft} – ${V.teams[1].livesLeft} lives` : paired ? `first to ${V.goal} points` : `${V.teams[0].left} – ${V.teams[1].left} players left`;
      const results = name => (F.log || []).filter(l => l.a === name || l.b === name).map(l => ((l.w === 1 ? l.a : l.b) === name ? 'W' : 'L'));
      box.innerHTML = `${tdb && V.switchOpen && live ? `<div class="mg-note">${(F.log || []).length ? 'A life was lost: either team can send in someone else (they keep the lives they have).' : 'Before the first set: pick who starts for each team.'} <button class="btn sm primary" id="fmtLock">✓ Lock in</button><small>It also locks by itself once the next set has a score.</small></div>` : tdb && live && V.canUnlock ? `<div class="mg-note">🔒 Locked in. <button class="btn sm" id="fmtUnlock" title="Open the switch window again (until the next set is recorded). The Stream Deck’s Lock in key does the same when pressed again.">↩ Undo lock-in</button><small>Locked in too early? Pick again.</small></div>` : ''}
        <div class="mg-teams">${V.teams.map((t, ti) => `<div class="mg-team" style="--tc:${esc(t.color)}">
          <div class="mg-th"><b>${esc(t.name)}</b>${paired ? `<span class="mg-lbl">Points</span>${live ? step('points', ti, t.points, 0, 20, 'Points') : `<b>${t.points}</b>`}` : `<span class="mg-lbl">${tdb ? `${t.livesLeft} lives · ` : ''}${t.left} of ${t.size} left</span>`}</div>
          ${t.players.map((p, i) => {
            const id = `t${ti}-${i}`, curI = F.match && !F.match[ti ? 'b' : 'a'].coach ? F.match[ti ? 'b' : 'a'].i : -1, first = paired ? F.idx[0] : F.rules.mode === 'stay' ? curI + 1 : 0, canOrder = live && !p.out && (tdb || i !== curI) && i >= first;
            const rec = paired ? results(p.name).map(r => `<i class="mg-r ${r}">${r}</i>`).join('') || '<i class="mg-r">–</i>' : '';
            return `<div class="mg-row ${p.state}${p.retired ? ' retired' : ''}">
              <span class="mg-ord">${canOrder && i - 1 >= first ? `<button data-adj="order" data-id="${id}" data-n="${i - 1}" title="Move up">▲</button>` : '<i></i>'}${canOrder && i < t.players.length - 1 ? `<button data-adj="order" data-id="${id}" data-n="${i + 1}" title="Move down">▼</button>` : '<i></i>'}</span>
              <span class="mg-k">${F.rules.tiers ? 'T' : '#'}${i + 1}</span>
              ${p.pic ? `<img class="mg-pic" src="${esc(p.pic)}" alt="">` : ''}<span class="mg-nm">${esc(p.name)}${(!live || p.out) && p.character ? `<small>${esc(p.character)}</small>` : ''}</span>
              ${pill(p.state, p.retired ? 'Retired' : '')}
              <div class="mg-bot">${live && !p.out ? `<input class="mg-ch" list="charList" data-chn="${esc(p.name)}" value="${esc(p.character || '')}" placeholder="🥋 Character…" title="The character they're on: their card on the format bar shows that character's art (from your character art) and changes as soon as they pick another" autocomplete="off" spellcheck="false">` : ''}<span class="mg-stats">${tdb ? (live && !p.out ? step('lives', id, p.lives, 0, 9, 'Lives', p.lives === 1 ? 'life' : 'lives') : `<b class="mg-h">${hearts(p.lives, F.rules.lives)}</b>`) + (per > 1 && !p.out ? (live ? step('hits', id, p.hits, 0, per - 1, `Sets lost on this life (of ${per})`, `/${per} cracked`) : '') : '')
                : paired ? rec : (live ? step('wins', id, p.wins, 0, 99, 'Wins', 'W') + step('losses', id, p.losses, 0, 99, 'Losses', 'L') : `${p.wins}W ${p.losses}L`) + (p.streak > 1 ? `<i class="mg-streak">🔥${p.streak}</i>` : '')}</span>
              <span class="mg-acts">${live ? (
                (tdb && !p.out && p.state !== 'playing' ? (V.switchOpen ? act(`data-swap="${ti}:${i}"`, '🔄 Switch in', 'Send this fighter in now', 'go') : act(`data-swap="${ti}:${i}" data-force="1"`, '⇄ Put in', 'Put this fighter in now, outside the switch window')) : '')
                + (F.rules.mode === 'stay' && !p.out && p.state !== 'playing' ? act(`data-swap="${ti}:${i}"`, '▶ Play now', 'Put this player in the current match') : '')
                + (!paired ? (p.out ? act(`data-adj="out" data-id="${id}" data-out="0"`, '↺ Back in', 'Bring them back') : act(`data-adj="out" data-id="${id}" data-out="1"`, tdb ? '✕ K.O.' : '✕ Out', tdb ? 'Knock them out (no-show, disqualified…)' : 'Out of the battle (no-show, disqualified…)', 'bad')) : '')) : ''}</span></div>
            </div>`; }).join('')}</div>`).join('')}</div>`;
      const lk = $('#fmtLock'); if (lk) lk.onclick = () => post({ do: 'lock' }, '✓ Locked in');
      const ul = $('#fmtUnlock'); if (ul) ul.onclick = () => post({ do: 'unlock' }, '↩ Lock-in undone — pick again');
      box.querySelectorAll('.mg-ch').forEach(inp => { inp.onchange = () => post({ do: 'character', name: inp.dataset.chn, character: inp.value.trim() }, inp.value.trim() ? `🥋 ${inp.dataset.chn} → ${inp.value.trim()}` : `${inp.dataset.chn}: no character`); inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); }; });
    } else if (F.kind === 'elim') {
      const koth = F.rules.mode === 'koth';
      title.textContent = 'Manage players';
      sub.textContent = koth ? `👑 ${V.king || 'no king yet'}${V.king ? ` · streak ${V.streak}` : ''}` : `${V.alive} of ${V.total} left`;
      const q = F.queue || [], fs = V.fighters.slice().sort((a, b) => (a.out - b.out) || (a.out ? a.place - b.place : (a.state === 'playing' ? -1 : b.state === 'playing' ? 1 : q.indexOf(a.id) - q.indexOf(b.id))));
      box.innerHTML = `<div class="mg-list">${fs.map(x => {
        const qi = q.indexOf(x.id), playing = x.state === 'playing';
        return `<div class="mg-row ${x.state}">
          <span class="mg-ord">${live && qi > 0 ? `<button data-adj="queue" data-id="${x.id}" data-n="${qi - 1}" title="Earlier in the queue">▲</button>` : '<i></i>'}${live && qi >= 0 && qi < q.length - 1 ? `<button data-adj="queue" data-id="${x.id}" data-n="${qi + 1}" title="Later in the queue">▼</button>` : '<i></i>'}</span>
          <span class="mg-k">${x.out ? ord(x.place) : qi >= 0 ? 'Q' + (qi + 1) : ''}</span>
          <span class="mg-nm">${x.king ? '👑 ' : ''}${esc(x.name)}${x.character ? `<small>${esc(x.character)}</small>` : ''}</span>
          ${pill(x.state, x.out ? `Out · ${ord(x.place)}` : '')}
          <div class="mg-bot"><span class="mg-stats">${koth ? (live ? step('streak', x.id, x.streak, 0, 99, 'Streak', 'streak') : `streak ${x.streak}`) + `<i class="mg-best">best ${x.best}</i>` : (live && !x.out ? step('lives', x.id, x.lives, 0, 9, 'Lives (0 = out)', x.lives === 1 ? 'life' : 'lives') : `<b class="mg-h">${hearts(x.lives, x.maxLives)}</b>`)}${live ? step('wins', x.id, x.wins, 0, 99, 'Wins', 'W') + step('losses', x.id, x.losses, 0, 99, 'Losses', 'L') : ''}</span>
          <span class="mg-acts">${live && !x.out ? (
            (koth && !x.king ? act(`data-adj="king" data-id="${x.id}"`, '👑 Crown', 'Make them the king') : '')
            + (!playing ? act(`data-adj="queue" data-id="${x.id}" data-n="0"`, '⏭ Next', 'Fights next') + act(`data-adj="play" data-id="${x.id}" data-side="1"`, '→ P1', `Into this match instead of ${esc((sides() || {}).a ? sides().a.name : 'P1')}`) + act(`data-adj="play" data-id="${x.id}" data-side="2"`, '→ P2', `Into this match instead of ${esc((sides() || {}).b ? sides().b.name : 'P2')}`) : '')
            + (!playing ? (koth ? act(`data-leave="${x.id}"`, '✕ Leaves', 'Leaves the queue', 'bad') : act(`data-adj="out" data-id="${x.id}" data-out="1"`, '✕ Out', 'Eliminate them now (no-show, disqualified…)', 'bad')) : '')) : live && x.out && !koth ? act(`data-adj="out" data-id="${x.id}" data-out="0"`, '↺ Bring back', 'Back in with 1 life') : ''}</span></div>
        </div>`; }).join('')}</div>
        ${live && koth ? '<div class="mg-join"><input type="text" id="fmtJoin" placeholder="Someone joins the queue…" autocomplete="off"><button class="btn sm" id="fmtJoinBtn">＋ Join</button></div>' : ''}`;
      const j = $('#fmtJoin'); if (j) { P.autocomplete(j, p => { j.value = p.name; }); $('#fmtJoinBtn').onclick = () => { if (j.value.trim()) post({ do: 'join', player: { name: j.value.trim() } }, `${j.value.trim()} joined the queue`); }; j.onkeydown = e => { if (e.key === 'Enter') $('#fmtJoinBtn').click(); }; }
    } else {
      title.textContent = 'Manage players'; sub.textContent = `${V.played} of ${V.total} played`;
      const ft = F.rules.ft || 1, scoreSel = (sid, k, v) => `<select class="mg-gs" data-gs="${sid}:${k}" aria-label="Games">${['', ...Array.from({ length: ft + 1 }, (_, i) => i)].map(n => `<option value="${n}" ${String(v ?? '') === String(n) ? 'selected' : ''}>${n === '' ? '–' : n}</option>`).join('')}</select>`;
      box.innerHTML = `<table class="fmt-st mg-table"><tr><th>#</th><th>Player</th><th>Played</th><th>W</th><th>L</th><th>Games</th><th>+/−</th></tr>${V.standings.map(r => `<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.gf}–${r.ga}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`).join('')}</table>
        <div class="mg-sched">${V.schedule.map(sm => `<div class="mg-m${sm.done ? ' done' : ''}${sm.now ? ' now' : ''}" data-sid="${sm.id}"><small>R${sm.round}</small>
          <button class="mg-w ${sm.done && sm.w === 1 ? 'won' : ''}" data-lw="${sm.id}:1" title="${esc(sm.a)} won">${esc(sm.a)}</button>${scoreSel(sm.id, 0, sm.score ? sm.score[0] : '')}<span>–</span>${scoreSel(sm.id, 1, sm.score ? sm.score[1] : '')}<button class="mg-w ${sm.done && sm.w === 2 ? 'won' : ''}" data-lw="${sm.id}:2" title="${esc(sm.b)} won">${esc(sm.b)}</button>
          <span class="mg-acts">${sm.done ? act(`data-unres="${sm.id}"`, '✕ Clear', 'Clear this result') : sm.now ? pill('playing', 'Now') : act(`data-pick="${sm.id}"`, '▶ Play now', 'Load this match into the Matches tab')}</span></div>`).join('')}</div>
        <p class="hint">Click the winner's name to record (or change) a result — add the games if you like. The match that's on now is scored in the Matches tab.</p>`;
    }
  }
  const hearts = (n, max) => `<span class="fmt-lives">${'❤'.repeat(Math.max(0, n || 0))}<i>${'❤'.repeat(Math.max(0, (max || 0) - (n || 0)))}</i></span>`;
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  function renderLog() {
    const L = (F && F.log) || [];
    $('#fmtLog').innerHTML = `<div class="fmt-log">${L.slice().reverse().map(l => `<div><i>${l.tiebreak ? 'TB' : '#' + l.n}</i><span>${l.w === 1 ? `<b>${esc(l.a)}</b> beat ${esc(l.b)}` : `<b>${esc(l.b)}</b> beat ${esc(l.a)}`}${l.score ? ` <small>${(l.w === 2 ? l.score.slice().reverse() : l.score).join('–')}</small>` : ''}${l.forfeit ? ' <small>(forfeit)</small>' : ''}${l.final ? ' <small>final</small>' : ''}</span></div>`).join('')}</div>`;
  }
  $('#fmtBoard').addEventListener('click', e => {
    const t = e.target;
    const adj = t.closest('[data-adj]');
    if (adj && !adj.disabled) {
      const op = adj.dataset.adj, body = { do: 'adjust', op, id: adj.dataset.id };
      if (adj.dataset.n != null) body.n = body.to = Number(adj.dataset.n);
      if (op === 'points') { body.t = Number(adj.dataset.id); delete body.id; }
      if (adj.dataset.out != null) body.out = adj.dataset.out === '1';
      if (adj.dataset.side) body.side = Number(adj.dataset.side);
      const who = (() => { const m = /^t(\d)-(\d+)$/.exec(body.id || ''); return m ? F.teams[+m[1]].players[+m[2]] : (F.fighters || []).find(x => x.id === body.id); })();
      if ((op === 'out' && body.out) || (op === 'lives' && body.n === 0)) return undoable(body, `${who ? who.name : 'They'} ${F.kind === 'teams' && F.rules.mode === 'tdb' ? 'is knocked out' : 'is out'}`).catch(() => {});
      const msg = { out: body.out ? `${who ? who.name : ''} is out` : `${who ? who.name : ''} is back in`, king: `👑 ${who ? who.name : ''} is the king`, play: `${who ? who.name : ''} is in this match` }[op] || '';
      return post(body, msg).catch(() => {});
    }
    const s = t.closest('[data-swap]');
    if (s) { const [ti, i] = s.dataset.swap.split(':').map(Number), nm = F.teams[ti].players[i].name;
      if (F.rules.mode === 'tdb') return post({ do: 'swap', side: ti + 1, index: i, force: !!s.dataset.force }, `🔄 ${nm} switches in`).catch(() => {});
      return post({ do: 'swap', side: ti + 1, index: i }, `▶ ${nm} plays now`).catch(() => {}); }
    const lv = t.closest('[data-leave]'); if (lv) { const x = F.fighters.find(y => y.id === lv.dataset.leave); undoable({ do: 'leave', id: lv.dataset.leave }, `${x ? x.name : 'They'} left the queue`).catch(() => {}); return; }
    const lw = t.closest('[data-lw]');
    if (lw) { const [sid, w] = lw.dataset.lw.split(':'), g = k => { const el = $(`[data-gs="${sid}:${k}"]`); return el ? el.value : ''; }, sc = [g(0), g(1)];
      return post({ do: 'adjust', op: 'result', sid, w: Number(w), score: sc[0] !== '' && sc[1] !== '' ? sc.map(Number) : null }, 'Result saved').catch(() => {}); }
    const ur = t.closest('[data-unres]'); if (ur) return post({ do: 'adjust', op: 'unresult', sid: ur.dataset.unres }, 'Result cleared').catch(() => {});
    const pk = t.closest('[data-pick]'); if (pk) return post({ do: 'pick', sid: pk.dataset.pick }, 'Loaded that match').catch(() => {});
  });
  $('#fmtScore').addEventListener('click', e => {
    const b = e.target.closest('[data-sc]'); if (b && !b.disabled && P.score) { P.score(b.dataset.sc, Number(b.dataset.d)); renderScore(); }
    if (e.target.closest('[data-confirm]')) confirmResult();
    if (e.target.closest('[data-push]') && P.push) P.push();
  });
  window.addEventListener('beebo:draft', () => { if (F && F.status === 'live') renderScore(); });
  $('#fmtActs').addEventListener('click', e => {
    const w = e.target.closest('[data-win]'), ff = e.target.closest('[data-ff]');
    if (w) { const sd = sides(); const name = w.dataset.win === '1' ? sd.a.name : sd.b.name; undoable({ do: 'confirm', w: Number(w.dataset.win) }, `✔ ${name} wins — next match loaded`).catch(() => {}); }
    if (ff) { const sd = sides(); const name = ff.dataset.ff === '1' ? sd.a.name : sd.b.name; undoable({ do: 'forfeit', side: Number(ff.dataset.ff) }, `${name} forfeits — next match loaded`).catch(() => {}); }
  });
  const confirmResult = async () => {
    const sd = sides(), wn = pending === 1 ? sd.a.name : pending === 2 ? sd.b.name : '';
    await post({ do: 'confirm' });
    P.toast(`✔ ${wn ? wn + ' wins — ' : ''}next match loaded`, { action: '↶ Undo', run: () => post({ do: 'undo' }, '↶ Result undone'), ms: 7000 });
  };
  $('#fmtUndo').onclick = () => post({ do: 'undo' }, '↶ Result undone');
  async function start() {
    if (markDupes().length) { toast('Every player needs a different name first', true); throw new Error('dupes'); }
    clearTimeout(saveT); await post({ do: 'save', format: F, editor: ME }).catch(() => {});
    const r = await post({ do: 'start' }, `▶ ${F.name} started — the first match is loaded`);
    P.showTab('match');                     // matches are run from the Matches tab
    return r;
  }
  $('#fmtStart').onclick = () => start().catch(() => {});
  $('#fmtEnd').onclick = async () => { if (await BeeboAsk.confirm({ title: `End ${F ? F.name : 'it'} now?`, text: 'The best record so far wins, and the champion goes on stream.', ok: 'End it now' })) post({ do: 'end' }); };
  $('#fmtReset').onclick = async () => { if (await BeeboAsk.confirm({ title: 'Go back to setup?', text: 'The results so far are cleared. The rosters stay.', ok: 'Clear the results', danger: true })) post({ do: 'reset' }).then(load); };
  $('#fmtClear').onclick = async () => { if (await BeeboAsk.confirm({ title: 'Turn the format off?', text: 'The rosters are cleared too. Save them first if you want them again.', ok: 'Turn it off', danger: true })) post({ do: 'clear' }).then(load); };
  $$('[data-fsplash]').forEach(b => b.onclick = () => post({ do: 'splash', kind: b.dataset.fsplash, show: 'toggle' }));
  { const pv = $('#fsPvs'); if (pv) pv.onclick = async () => { try { await api('/api/remote/action', { method: 'POST', body: { action: 'playervs', show: 'toggle' } }); } catch (e) { toast(e.message, true); } }; }
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
