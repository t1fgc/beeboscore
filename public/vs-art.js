/* BeeboScore (developed by Beebo) — your own pictures on the VS Splash (Matches tab, in the VS Splash card).
 *
 *   Name bar   a picture behind each player's name            shown at 920 × 250
 *   Header     a picture across the top of the VS Splash      shown at 1920 × 200
 * Either, both or neither; they show in every layout. A picture of another size is scaled and cropped to fit, here, on
 * this PC, before it is saved (the server checks it again and keeps it in <data>/vs-art).
 *
 * Lettering on a custom name bar. A layout's own lettering was made for its own bar, so on someone's picture it could
 * blend in. When a name bar is chosen this file looks at the picture where the lettering sits and works out colours that
 * read on it: light or dark names (whichever stands out more), a tint of the picture's own colour for the team tag and
 * record, and, when the picture is busy, a soft backing behind the lettering. "Pick my own" swaps those for two colour
 * pickers, with a warning when the picked colours are hard to read on the picture.
 */
(() => {
  'use strict';
  const P = window.BeeboPanel, root = document.getElementById('vaRoot');
  if (!P || !root) return;
  const { api, toast, esc } = P;
  const SIZE = { bar: { w: 920, h: 250 }, header: { w: 1920, h: 200 } }, SOURCE_MAX = 40 * 1024 * 1024;
  const $ = (s, r = root) => r.querySelector(s);
  let view = null, stats = null, busy = false, previewOn = false;

  const css = document.createElement('style');
  css.textContent = `
#vaRoot { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
#vaRoot h3 { margin: 0 0 4px; font-size: 15px; color: var(--text); letter-spacing: 0; text-transform: none; }
#vaRoot .va-lead { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 76ch; }
#vaRoot .va-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
#vaRoot .va-slot { min-width: 0; }
#vaRoot .va-slot.over .va-prev { outline: 2px dashed var(--accent); outline-offset: 3px; }
#vaRoot .va-prev { position: relative; width: 100%; border-radius: 8px; overflow: hidden; container-type: inline-size; background: repeating-conic-gradient(#3a3f4e 0 25%, #2b2f3b 0 50%) 0 0 / 16px 16px; border: 1px solid var(--line-2); }
#vaRoot .va-prev.bar { aspect-ratio: 920 / 250; } #vaRoot .va-prev.header { aspect-ratio: 1920 / 200; }
#vaRoot .va-prev img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
#vaRoot .va-prev .va-none { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 13px; background: var(--card-2); }
#vaRoot .va-sample { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6cqw; text-align: center; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; text-transform: uppercase; white-space: nowrap; }
#vaRoot .va-sample.scrim::before { content: ''; position: absolute; left: 2%; right: 2%; top: 4%; bottom: 4%; background: radial-gradient(ellipse 50% 50% at center, var(--sc) 0, var(--sc) 58%, transparent 100%); }
#vaRoot .va-sample > * { position: relative; }
#vaRoot .va-sample i { font: 700 3.3cqw/1 'Saira Condensed', sans-serif; font-style: normal; letter-spacing: .4cqw; }
#vaRoot .va-sample b { font: 800 10.4cqw/1 'Saira Condensed', sans-serif; max-width: 90cqw; overflow: hidden; text-overflow: ellipsis; }
#vaRoot .va-sample u { text-decoration: none; display: inline-flex; gap: .6cqw; align-items: baseline; font: 700 3.6cqw/1 'Chakra Petch', sans-serif; padding: .4cqw 1.6cqw .2cqw; border-radius: .6cqw; }
#vaRoot .va-sample u small { font-size: 1.7cqw; letter-spacing: .2cqw; }
#vaRoot .va-meta { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 9px 0 8px; }
#vaRoot .va-meta b { font-size: 14px; } #vaRoot .va-meta small { color: var(--muted); font-size: 12.5px; }
#vaRoot .va-btns { display: flex; gap: 8px; flex-wrap: wrap; }
#vaRoot .va-fit { margin-top: 18px; padding: 14px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--card-2); }
#vaRoot .va-fit h4 { margin: 0 0 10px; font-size: 14px; color: var(--text); }
#vaRoot .va-seg { display: inline-flex; border: 1px solid var(--line-2); border-radius: 9px; overflow: hidden; }
#vaRoot .va-seg button { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 13px; font-weight: 700; padding: 8px 13px; cursor: pointer; }
#vaRoot .va-seg button + button { border-left: 1px solid var(--line-2); }
#vaRoot .va-seg button.on { background: var(--accent); color: #fff; }
#vaRoot .va-line { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 12px; font-size: 13px; }
#vaRoot .va-sw { display: inline-flex; align-items: center; gap: 7px; }
#vaRoot .va-sw i { width: 20px; height: 20px; border-radius: 5px; border: 1px solid rgba(255, 255, 255, .35); box-shadow: 0 0 0 1px rgba(0, 0, 0, .5); }
#vaRoot .va-line input[type=color] { width: 40px; height: 30px; padding: 0; border: 1px solid var(--line-2); border-radius: 6px; background: none; cursor: pointer; }
#vaRoot .va-line label { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
#vaRoot .va-note { margin: 12px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 76ch; }
#vaRoot .va-warn { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5; background: rgba(255, 184, 77, .12); border: 1px solid rgba(255, 184, 77, .5); color: var(--text); max-width: 76ch; }
#vaRoot .va-live { margin-top: 14px; }
#vaRoot .va-frame { position: relative; margin-top: 10px; width: 100%; max-width: 720px; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2); background: #0a0b10; }
#vaRoot .va-frame iframe { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; border: 0; transform-origin: 0 0; pointer-events: none; }
`;
  document.head.appendChild(css);

  // ------------------------------------------------------------ colour helpers
  const rgbOf = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lumRGB = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const lumHex = h => lumRGB(...rgbOf(h));
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hsl = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); };
  const SCRIM = { light: 0.62, dark: 0.68 };            // how strong the backing is (the same numbers the app uses for the overlay)
  /** the picture's light and dark ends where the lettering sits, once a backing is (or is not) behind it */
  const under = (st, lightInk, scrim) => { const f = v => (!scrim ? v : lightInk ? v * (1 - SCRIM.light) : v + (1 - v) * SCRIM.dark); return { lo: f(st.p10), hi: f(st.p90) }; };
  /** the lowest contrast a colour has against the picture under the lettering */
  const worst = (hex, st, scrim) => { const L = lumHex(hex), u = under(st, L > 0.4, scrim); return Math.min(ratio(L, u.lo), ratio(L, u.hi)); };

  /** look at a name bar where the lettering sits → what the picture is like there */
  function measure(cv) {
    const w = cv.width, h = cv.height, x0 = Math.round(w * 0.08), y0 = Math.round(h * 0.12), sw = Math.round(w * 0.84), sh = Math.round(h * 0.76);
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, sw, sh).data, L = [], hue = new Float32Array(36);
    let clear = 0, n = 0, sat = 0;
    for (let y = 0; y < sh; y += 3) for (let x = 0; x < sw; x += 3) {
      const i = (y * sw + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]; n++;
      if (d[i + 3] < 128) { clear++; continue; }
      L.push(lumRGB(r, g, b));
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (c < 40) continue;
      const hh = (mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4) * 60, s = c / 255;
      hue[Math.floor(hh / 10) % 36] += s; sat += s;
    }
    L.sort((a, b) => a - b);
    const at = q => (L.length ? L[Math.min(L.length - 1, Math.floor(L.length * q))] : 0.2);
    let top = 0; for (let i = 1; i < 36; i++) if (hue[i] > hue[top]) top = i;
    return { p10: at(0.1), p90: at(0.9), clear: n ? clear / n : 0, hue: sat > (n - clear) * 0.06 ? top * 10 + 5 : null };
  }
  /** colours that read on that picture */
  function fitFor(st) {
    if (st.clear > 0.35) {                               // mostly see-through: the splash's own background shows, which can be anything
      return { ink: '#ffffff', accent: st.hue == null ? '#ffd75e' : hsl(st.hue, 92, 76), scrim: true, busy: true, contrast: 0, why: 'clear' };
    }
    const WHITE = '#ffffff', DARK = '#0b0d12';
    let light = worst(WHITE, st, false) >= worst(DARK, st, false), ink = light ? WHITE : DARK, scrim = worst(ink, st, false) < 4.5;
    if (scrim && worst(light ? DARK : WHITE, st, true) > worst(ink, st, true)) { light = !light; ink = light ? WHITE : DARK; }
    let accent;
    if (st.hue == null) accent = light ? '#ffd75e' : '#7a1238';
    else { let l = light ? 72 : 30; accent = hsl(st.hue, light ? 92 : 80, l); for (let i = 0; i < 10 && worst(accent, st, scrim) < 4.5; i++) { l += light ? 3 : -3; accent = hsl(st.hue, light ? 92 : 80, l); } }
    return { ink, accent, scrim, busy: scrim || st.p90 - st.p10 > 0.45, contrast: Math.round(worst(ink, st, scrim) * 10) / 10 };
  }

  // ------------------------------------------------------------ pictures
  /** scale and crop a chosen file to the size it is shown at → { blob, canvas } */
  async function prepare(file, kind) {
    if (!/^image\/(png|webp|jpeg)$/.test(file.type)) throw new Error('Use a PNG, WebP or JPG picture.');
    if (file.size > SOURCE_MAX) throw new Error('That file is over 40 MB. Save it smaller and try again.');
    let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error('That picture could not be opened. Save it again as a PNG or JPG and try once more.'); }
    const { w, h } = SIZE[kind], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const k = Math.max(w / bmp.width, h / bmp.height), dw = bmp.width * k, dh = bmp.height * k, ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const exact = bmp.width === w && bmp.height === h; bmp.close && bmp.close();
    const blob = exact && file.size <= 8 * 1024 * 1024 ? file : await new Promise(res => cv.toBlob(res, 'image/png'));
    if (!blob) throw new Error('That picture could not be prepared. Try a PNG or JPG.');
    return { blob, canvas: cv };
  }
  /** the saved name bar, measured again (after a restart, or when it was set from another window) */
  async function measureSaved() {
    stats = null; if (!view || !view.bar) return;
    try {
      const img = new Image(); img.src = view.bar.url; await img.decode();
      const cv = document.createElement('canvas'); cv.width = SIZE.bar.w; cv.height = SIZE.bar.h;
      const k = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight); cv.getContext('2d').drawImage(img, (cv.width - img.naturalWidth * k) / 2, (cv.height - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
      stats = measure(cv);
    } catch { stats = null; }
  }
  async function upload(file, kind) {
    if (busy || !file) return; busy = true; draw();
    try {
      const out = await prepare(file, kind);
      const res = await fetch('/api/vs-art?kind=' + kind, { method: 'POST', headers: { 'Content-Type': out.blob.type || 'image/png' }, body: out.blob });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || 'The picture could not be saved.');
      view = j;
      if (kind === 'bar') { stats = measure(out.canvas); view = await api('/api/vs-art', { method: 'PATCH', body: { auto: true, fit: fitFor(stats) } }); }
      toast(kind === 'bar' ? 'Name bar saved. The lettering was matched to it.' : 'Header saved.');
    } catch (e) { toast(e.message, true); }
    busy = false; draw(); refreshPreview();
  }
  const patch = async body => { try { view = await api('/api/vs-art', { method: 'PATCH', body }); } catch (e) { toast(e.message, true); } draw(); refreshPreview(); };

  // ------------------------------------------------------------ the card
  const describe = f => `${lumHex(f.ink) > 0.4 ? 'Light' : 'Dark'} names${f.scrim ? ' on a soft backing' : ''}, with a ${lumHex(f.accent) > 0.4 ? 'light' : 'dark'} tint of the picture's colour for the team tag and record.`;
  function slot(kind) {
    const pic = view && view[kind], sz = SIZE[kind], live = (view && view.live) || {};
    const sample = kind === 'bar' && pic ? `<div class="va-sample${live.scrim ? ' scrim' : ''}" style="--sc:${esc(live.scrimColor || 'transparent')}"><i style="color:${esc(live.accent)};text-shadow:${esc(live.edge)}">Team</i><b style="color:${esc(live.ink)};text-shadow:${esc(live.edge)}">Player name</b><u style="background:${esc(live.chip)};color:${esc(live.ink)}">3<small style="color:${esc(live.accent)}">W</small></u></div>` : '';
    return `<div class="va-slot" data-kind="${kind}">
      <div class="va-prev ${kind}">${pic ? `<img alt="" src="${esc(pic.url)}">${sample}` : `<div class="va-none">${kind === 'bar' ? 'The layout’s own name bar' : 'No header'}</div>`}</div>
      <div class="va-meta"><b>${kind === 'bar' ? 'Name bar' : 'Header'}</b><small>${kind === 'bar' ? 'Behind each player’s name.' : 'Across the top of the VS Splash.'} Best size ${sz.w} × ${sz.h} px (PNG, WebP or JPG). Other sizes are scaled and cropped to fit.</small></div>
      <div class="va-btns"><button class="btn sm" data-act="pick" ${busy ? 'disabled' : ''}>${pic ? 'Replace picture' : 'Choose picture'}</button>${pic ? '<button class="btn sm ghost" data-act="remove">Remove</button>' : ''}<input type="file" accept="image/png,image/webp,image/jpeg" hidden></div>
    </div>`;
  }
  function fitBox() {
    if (!view || !view.bar) return '';
    const f = view.fit, own = !view.auto;
    let warn = '';
    if (!own && f.busy) warn = `<p class="va-warn">${f.contrast ? 'This picture has a lot going on behind the names, so a soft backing was put behind the lettering to keep it readable.' : 'This picture is mostly see-through, so the splash’s own background shows behind the names. A soft backing was put behind the lettering to keep it readable.'} A plainer picture, or one that is clearly dark or clearly light where the names sit, reads best.</p>`;
    if (own && stats) { const c = Math.min(worst(view.ink, stats, view.scrim), worst(view.accent, stats, view.scrim)); if (c < 4.5) warn = `<p class="va-warn">These colours are hard to read on this picture (contrast ${c.toFixed(1)}:1; 4.5:1 or more reads well on stream). Try a ${lumHex(view.ink) > 0.4 ? 'lighter' : 'darker'} colour, turn on the soft backing, or go back to Match my picture.</p>`; }
    return `<div class="va-fit"><h4>Lettering on your name bar</h4>
      <div class="va-seg" role="group" aria-label="Lettering colours"><button data-auto="1" class="${own ? '' : 'on'}" aria-pressed="${!own}">Match my picture</button><button data-auto="0" class="${own ? 'on' : ''}" aria-pressed="${own}">Pick my own</button></div>
      ${own ? `<div class="va-line"><label><input type="color" data-col="ink" value="${esc(view.ink)}"> Names</label><label><input type="color" data-col="accent" value="${esc(view.accent)}"> Team tag and record</label><label><input type="checkbox" data-flag="scrim" ${view.scrim ? 'checked' : ''}> Soft backing behind the lettering</label></div>`
        : `<div class="va-line"><span class="va-sw"><i style="background:${esc(f.ink)}"></i>Names</span><span class="va-sw"><i style="background:${esc(f.accent)}"></i>Team tag and record</span>${f.contrast ? `<span>Contrast ${f.contrast.toFixed(1)}:1</span>` : ''}</div><p class="va-note">${describe(f)} A layout’s own lettering colours are made for its own bar and could blend into a picture, so they are swapped for these while your name bar is on.</p>`}
      <div class="va-line"><label><input type="checkbox" data-flag="mirror" ${view.mirror ? 'checked' : ''}> Flip the bar for Player 2</label></div>${warn}</div>`;
  }
  function draw() {
    if (!view) { root.innerHTML = ''; return; }
    const keep = previewOn;
    root.innerHTML = `<h3>Your own VS Splash pictures</h3>
      <p class="va-lead">Use a picture of your own for the bar behind each player’s name, for a header across the top, or both. They show on the VS Splash in every layout.</p>
      <div class="va-grid">${slot('bar')}${slot('header')}</div>${fitBox()}
      <div class="va-live"><button class="btn sm ghost" data-act="preview">${keep ? 'Hide the preview' : 'Preview the VS Splash'}</button>${keep ? '<div class="va-frame"><iframe title="VS Splash preview" tabindex="-1"></iframe></div>' : ''}</div>`;
    if (keep) refreshPreview(true);
  }
  let prevT = 0;
  function refreshPreview(now) {
    clearTimeout(prevT);
    prevT = setTimeout(() => {
      const box = $('.va-frame'), fr = box && box.querySelector('iframe'); if (!fr) return;
      fr.style.transform = `scale(${box.clientWidth / 1920})`;
      fr.src = `/overlay/${encodeURIComponent(P.active() || 'shattered')}?sbframe&instant&preview&demo=vs&t=${Date.now()}`;
    }, now ? 0 : 350);
  }
  addEventListener('resize', () => { const box = $('.va-frame'), fr = box && box.querySelector('iframe'); if (fr) fr.style.transform = `scale(${box.clientWidth / 1920})`; });

  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const slotEl = b.closest('.va-slot'), kind = slotEl && slotEl.dataset.kind;
    if (b.dataset.act === 'pick') slotEl.querySelector('input[type=file]').click();
    else if (b.dataset.act === 'remove') { try { view = await api('/api/vs-art?kind=' + kind, { method: 'DELETE' }); if (kind === 'bar') stats = null; toast(kind === 'bar' ? 'Name bar removed. The layout’s own bar and lettering are back.' : 'Header removed.'); } catch (err) { toast(err.message, true); } draw(); refreshPreview(); }
    else if (b.dataset.act === 'preview') { previewOn = !previewOn; draw(); }
    else if (b.dataset.auto != null) {
      const auto = b.dataset.auto === '1';
      // "Pick my own" starts from the matched colours, so nothing jumps
      patch(auto ? { auto: true, ...(stats ? { fit: fitFor(stats) } : {}) } : { auto: false, ink: view.fit.ink, accent: view.fit.accent, scrim: view.fit.scrim });
    }
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'file') { const kind = t.closest('.va-slot').dataset.kind, f = t.files[0]; t.value = ''; upload(f, kind); }
    else if (t.dataset.col) patch({ [t.dataset.col]: t.value });
    else if (t.dataset.flag) patch({ [t.dataset.flag]: t.checked });
  });
  for (const ev of ['dragover', 'dragleave', 'drop']) root.addEventListener(ev, e => {
    const s = e.target.closest && e.target.closest('.va-slot'); if (!s) return;
    e.preventDefault(); s.classList.toggle('over', ev === 'dragover');
    if (ev === 'drop' && e.dataTransfer.files[0]) upload(e.dataTransfer.files[0], s.dataset.kind);
  });

  (async () => {
    try { view = await api('/api/vs-art'); } catch { return; }
    await measureSaved();
    if (view.bar && stats && !view.fit.contrast && view.auto && !(stats.clear > 0.35)) view = await api('/api/vs-art', { method: 'PATCH', body: { fit: fitFor(stats) } }).catch(() => view);
    draw();
  })();
  window.BeeboVsArt = { measure, fitFor, worst, get view() { return view; }, get stats() { return stats; } };
})();
