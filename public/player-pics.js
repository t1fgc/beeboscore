/* BeeboScore (developed by Beebo) — Splash pictures (start.gg tab).
 *
 * For each player: what the VS Splash and the Victory Splash show for them.
 *   Profile picture  — their start.gg profile picture, in the small frame (the default)
 *   Character image  — a picture uploaded here, shown as a large panel; the small frame is hidden for that player
 * A chosen picture opens in the picture window first (public/pic-editor.js: crop, remove a green-screen background);
 * what comes out of it is checked by the server, which keeps it in <data>/player-art.
 * Players are matched by name, so an upload follows a player from event to event.
 *
 * The card stays short however big the event is: the two players on the scoreboard, a "Find a player" box that
 * completes names as you type, and a list of the players who already have a character image (it scrolls inside the card).
 */
(() => {
  'use strict';
  const P = window.BeeboPanel, root = document.getElementById('picRoot');
  if (!P || !root) return;
  const { api, toast, esc } = P;
  const RULES = { width: 900, height: 1080, minWidth: 200, minHeight: 240, maxSide: 4096, maxBytes: 8 * 1024 * 1024 };
  const SOURCE = { maxBytes: 40 * 1024 * 1024, maxSide: 10000 };       // the file you choose can be bigger: the picture window makes it fit
  const key = n => String(n || '').trim().toLowerCase();
  const $ = (s, r = root) => r.querySelector(s);

  const css = document.createElement('style');
  css.textContent = `
#picCard .pic-spec { margin: 8px 0 4px; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 78ch; }
#picCard .pic-spec b { color: var(--text); font-weight: 600; }
#picCard .pic-sub { margin: 14px 0 6px; font-size: 13px; font-weight: 700; color: var(--muted); }
#picCard .pic-find { display: flex; align-items: center; gap: 10px; margin: 14px 0 6px; }
#picCard .pic-find input { flex: 1; max-width: 340px; }
#picCard .pic-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); flex-wrap: wrap; }
#picCard .pic-row.over { outline: 2px dashed var(--accent); outline-offset: 2px; }
#picCard .pic-th { flex: none; width: 44px; height: 52px; border-radius: 6px; background: var(--card-2); display: grid; place-items: center; overflow: hidden; font-weight: 800; color: var(--muted); }
#picCard .pic-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
#picCard .pic-th.art img { object-fit: contain; object-position: bottom; }
#picCard .pic-nm { flex: 1; min-width: 130px; }
#picCard .pic-nm b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#picCard .pic-nm small { color: var(--muted); font-size: 12px; }
#picCard .pic-seg { display: inline-flex; border: 1px solid var(--line-2); border-radius: 9px; overflow: hidden; }
#picCard .pic-seg button { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 700; padding: 7px 11px; cursor: pointer; }
#picCard .pic-seg button + button { border-left: 1px solid var(--line-2); }
#picCard .pic-seg button.on { background: var(--accent); color: #1a1205; }
#picCard .pic-seg button:focus-visible, #picCard .pic-row .btn:focus-visible, #picCard summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#picCard .pic-none { color: var(--muted); font-size: 13px; padding: 8px 0; border-top: 1px solid var(--line); margin: 0; }
#picCard details { margin-top: 12px; border-top: 1px solid var(--line); }
#picCard summary { cursor: pointer; padding: 10px 0 8px; font-size: 13px; font-weight: 700; color: var(--muted); user-select: none; }
#picCard summary:hover { color: var(--text); }
#picCard .pic-scroll { max-height: 276px; overflow-y: auto; padding-right: 6px; }
#picCard .pic-scroll .pic-row:first-child { border-top: 0; }
`;
  document.head.appendChild(css);

  root.innerHTML = `
<h2>Splash pictures</h2>
<p class="hint" style="margin:-4px 0 0">Choose what each player shows on the VS Splash and the Victory Splash: their start.gg profile picture, or a character image you upload for them.</p>
<p class="pic-spec"><b>Character image:</b> a tall picture, ${RULES.width} × ${RULES.height} px is the best size. PNG, WebP or JPG. After you choose one, a window opens where you can crop it and remove a green-screen background.</p>
<div class="pic-sub">On the scoreboard now</div>
<div id="picNow"></div>
<div class="pic-find"><input class="f" id="picFind" type="search" placeholder="Find a player" autocomplete="off" aria-label="Find a player"><button class="btn sm ghost" id="picClear" hidden>Clear</button></div>
<div id="picFound"></div>
<details id="picHave"><summary id="picCount">Players with a character image</summary><div class="pic-scroll" id="picAll"></div></details>
<input type="file" id="picFile" accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" hidden>`;

  let items = {}, target = '', lastSig = '', found = null;
  const art = name => items[key(name)] || null;
  const known = name => (P.players() || []).find(p => p && key(p.name) === key(name)) || null;

  function row(p) {
    const a = art(p.name), useArt = !!(a && a.use === 'art' && a.url), ava = p.avatar || '';
    const thumb = useArt ? `<img alt="" src="${esc(a.url)}">` : ava ? `<img alt="" src="${esc(ava)}" onerror="this.remove()">` : esc(String(p.name).trim().charAt(0).toUpperCase() || '?');
    const note = useArt ? `Character image, ${a.w} × ${a.h}` : ava ? 'start.gg profile picture' : a && a.url ? 'Profile picture (none on start.gg: shows their initial)' : 'No profile picture: shows their initial';
    return `<div class="pic-row" data-name="${esc(p.name)}">
      <span class="pic-th${useArt ? ' art' : ''}">${thumb}</span>
      <span class="pic-nm"><b>${esc(p.name)}</b><small>${note}</small></span>
      <span class="pic-seg" role="group" aria-label="Picture for ${esc(p.name)}"><button data-use="profile" class="${useArt ? '' : 'on'}" aria-pressed="${!useArt}">Profile picture</button><button data-use="art" class="${useArt ? 'on' : ''}" aria-pressed="${useArt}">Character image</button></span>
      <button class="btn sm" data-act="upload">${a && a.url ? 'Replace image' : 'Upload image'}</button>
      ${a && a.url ? '<button class="btn sm ghost" data-act="remove" title="Delete this player\'s uploaded image">Remove</button>' : ''}
    </div>`;
  }

  function draw() {
    const st = P.state() || {};
    const now = ['p1', 'p2'].map(k => st[k]).filter(p => p && p.name && !/^Player [12]$/.test(p.name));
    const onNow = new Set(now.map(p => key(p.name)));
    $('#picNow').innerHTML = now.length ? now.map(row).join('') : '<p class="pic-none">Nobody yet. Put two players on the Matches tab and they show up here.</p>';
    // the player picked in "Find a player" (if they've since gone on the scoreboard, their row is already above)
    if (found && onNow.has(key(found.name))) found = null;
    $('#picFound').innerHTML = found ? row(known(found.name) || found) : '';
    $('#picClear').hidden = !found;
    // everyone else who already has a character image: one short list that scrolls inside the card
    const have = Object.values(items).filter(a => a.url && !onNow.has(key(a.name)) && !(found && key(found.name) === key(a.name)))
      .map(a => known(a.name) || { name: a.name }).sort((a, b) => a.name.localeCompare(b.name));
    $('#picHave').hidden = !have.length;
    $('#picCount').textContent = `Other players with a character image (${have.length})`;
    $('#picAll').innerHTML = have.map(row).join('');
  }
  const signature = () => { const st = P.state() || {}; return [st.p1 && st.p1.name, st.p2 && st.p2.name, st.p1 && st.p1.avatar, st.p2 && st.p2.avatar, (P.players() || []).length].join('|'); };

  async function load() { try { const r = await api('/api/player-art'); items = {}; for (const a of r.items || []) items[key(a.name)] = a; if (r.rules) Object.assign(RULES, r.rules); } catch {} lastSig = signature(); draw(); }
  const took = r => { items = {}; for (const a of r.items || []) items[key(a.name)] = a; draw(); };

  /** is this a file the picture window can open? throws an Error that says how to fix it */
  function check(file) {
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1] || '';
    if (!/^(png|webp|jpe?g)$/i.test(ext) || (file.type && !/^image\/(png|webp|jpeg)$/.test(file.type))) throw new Error(`That's ${ext ? 'a .' + ext.toLowerCase() + ' file' : 'not a picture'}. Use a PNG, WebP or JPG.`);
    if (file.size > SOURCE.maxBytes) throw new Error(`That picture is ${(file.size / 1048576).toFixed(0)} MB. Use one under ${SOURCE.maxBytes / 1048576} MB.`);
  }

  let busy = false;
  async function upload(name, file) {
    if (!name || !file || busy) return;
    busy = true;
    try {
      check(file);
      const out = await window.BeeboPicEditor.open(file, name, { ...RULES, sourceMaxSide: SOURCE.maxSide });      // crop / green screen → a PNG that fits the panel
      if (!out) return;                                    // cancelled: nothing changes
      if (out.error) throw new Error(out.error);
      const res = await fetch('/api/player-art?name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': out.blob.type || 'image/png' }, body: out.blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The picture could not be saved.');
      took(data);
      const tip = out.w > out.h ? 'it is wider than it is tall, so it will look small in the panel' : out.h < 700 ? 'it is small, so it may look soft on stream' : '';
      toast(`${name} now uses the character image` + (tip ? ` (${tip}; ${RULES.width} × ${RULES.height} is the best size)` : ''));
    } catch (err) { toast(err.message, true); }
    finally { busy = false; }
  }

  root.addEventListener('click', async e => {
    if (e.target.closest('#picClear')) { found = null; draw(); $('#picFind').focus(); return; }
    const r = e.target.closest('.pic-row'); if (!r) return;
    const name = r.dataset.name, a = art(name), use = e.target.closest('[data-use]'), act = e.target.closest('[data-act]');
    try {
      if (use) {
        if (use.dataset.use === 'art' && !(a && a.url)) { target = name; $('#picFile').click(); return; }      // nothing uploaded yet: ask for the picture
        if ((a && a.use === 'art' ? 'art' : 'profile') === use.dataset.use) return;
        took(await api('/api/player-art', { method: 'PATCH', body: { name, use: use.dataset.use } }));
        toast(use.dataset.use === 'art' ? `${name} now uses the character image` : `${name} now uses the profile picture`);
      } else if (act && act.dataset.act === 'upload') { target = name; $('#picFile').click(); }
      else if (act && act.dataset.act === 'remove') { took(await api('/api/player-art', { method: 'DELETE', body: { name } })); toast(`Removed ${name}'s character image`); }
    } catch (err) { toast(err.message, true); }
  });
  $('#picFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; upload(target, f); });

  // "Find a player": names complete as you type (the same list the Matches tab uses); the picked player's row shows below.
  // A name that isn't in the list can be typed in full and entered: pictures go by name.
  const find = $('#picFind');
  const show = p => { found = p && p.name ? p : null; find.value = ''; draw(); const b = $('#picFound .pic-row [data-act="upload"]'); if (b) b.focus(); };
  P.autocomplete(find, show);
  find.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.defaultPrevented) return; const q = find.value.trim().slice(0, 80); if (!q) return; e.preventDefault(); show(known(q) || { name: q }); });

  // a picture can also be dropped straight onto a player's row
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  root.addEventListener('dragover', e => { const r = e.target.closest('.pic-row'); if (!r || !hasFiles(e)) return; e.preventDefault(); r.classList.add('over'); });
  root.addEventListener('dragleave', e => { const r = e.target.closest('.pic-row'); if (r) r.classList.remove('over'); });
  root.addEventListener('drop', e => { const r = e.target.closest('.pic-row'); if (!r || !hasFiles(e)) return; e.preventDefault(); r.classList.remove('over'); upload(r.dataset.name, e.dataTransfer.files[0]); });

  // fresh whenever the tab is opened, and while it's open if the players on the scoreboard (or the event's list) change
  const section = root.closest('section') || root, shown = () => section.classList.contains('on');
  new MutationObserver(() => { if (shown()) load(); }).observe(section, { attributes: true, attributeFilter: ['class'] });
  setInterval(() => { if (shown() && document.activeElement !== find && signature() !== lastSig) { lastSig = signature(); draw(); } }, 1500);
  if (shown()) load();
})();
