/* BeeboScore (developed by Beebo) — the picture window that opens when a character image is uploaded (Splash pictures).
 *
 *   Crop        — drag the box or its corners. A wide picture starts with a selection in the shape of the splash panel
 *                 (5:6); a tall one starts whole. Tick or untick "Keep the splash panel's shape" to crop either way.
 *   Background  — remove a green-screen (or any single-colour) background with a chroma key: pick the colour, set how
 *                 much to remove and how soft the edge is. A picture that looks like a green screen has this on already.
 * What's saved is a PNG of the selected area, no taller than the splash panel, with the background made see-through.
 * Everything happens in this window, on this PC; the original file is not changed.
 *
 *   BeeboPicEditor.open(file, playerName) → Promise<{ blob, w, h } | null>      (null = cancelled)
 */
(() => {
  'use strict';
  const PANEL = { w: 900, h: 1080 }, RATIO = PANEL.w / PANEL.h, MIN = { w: 200, h: 240 }, OUT_MAX = { w: 1400, h: 1080 }, PREV_MAX = 900;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
.pe-back { position: fixed; inset: 0; z-index: 90; background: rgba(4, 5, 9, .78); display: grid; place-items: center; padding: 18px; }
.pe { width: min(1040px, 100%); max-height: calc(100vh - 36px); overflow: auto; background: var(--card); border: 1px solid var(--line-2); border-radius: 14px; box-shadow: 0 30px 80px rgba(0, 0, 0, .6); }
.pe-head { display: flex; align-items: baseline; gap: 12px; padding: 14px 18px 0; }
.pe-head h2 { margin: 0; font-size: 17px; letter-spacing: 0; text-transform: none; color: var(--text); }
.pe-head span { color: var(--muted); font-size: 13px; }
.pe-body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; padding: 14px 18px; }
@media (max-width: 860px) { .pe-body { grid-template-columns: 1fr; } }
.pe-stage { position: relative; display: grid; place-items: center; min-height: 270px; background: #0a0b10; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; padding: 12px; }
.pe-pic { position: relative; line-height: 0; background: repeating-conic-gradient(#3a3f4e 0 25%, #2b2f3b 0 50%) 0 0 / 20px 20px; }
.pe-pic canvas { display: block; }
.pe-pic.pick canvas { cursor: crosshair; }
.pe-mask { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.pe-shade { position: absolute; box-shadow: 0 0 0 4000px rgba(5, 6, 10, .62); }
.pe-crop { position: absolute; border: 1px solid #fff; cursor: move; touch-action: none; }
.pe-pic.pick .pe-crop { pointer-events: none; }
.pe-crop::before { content: ''; position: absolute; inset: 0; border: 1px dashed rgba(0, 0, 0, .55); }
.pe-crop i { position: absolute; width: 14px; height: 14px; background: #fff; border: 1px solid #111; border-radius: 2px; }
.pe-crop i[data-h=nw] { left: -8px; top: -8px; cursor: nwse-resize; } .pe-crop i[data-h=ne] { right: -8px; top: -8px; cursor: nesw-resize; }
.pe-crop i[data-h=sw] { left: -8px; bottom: -8px; cursor: nesw-resize; } .pe-crop i[data-h=se] { right: -8px; bottom: -8px; cursor: nwse-resize; }
.pe-crop i[data-h=n] { top: -8px; left: calc(50% - 7px); cursor: ns-resize; } .pe-crop i[data-h=s] { bottom: -8px; left: calc(50% - 7px); cursor: ns-resize; }
.pe-crop i[data-h=w] { left: -8px; top: calc(50% - 7px); cursor: ew-resize; } .pe-crop i[data-h=e] { right: -8px; top: calc(50% - 7px); cursor: ew-resize; }
.pe-crop.locked i[data-h=n], .pe-crop.locked i[data-h=s], .pe-crop.locked i[data-h=w], .pe-crop.locked i[data-h=e] { display: none; }
.pe-side h3 { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pe-side section { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--line); }
.pe-check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; margin: 6px 0; }
.pe-check input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
.pe-row { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: center; font-size: 13px; margin: 8px 0; }
.pe-row input[type=range] { width: 100%; accent-color: var(--accent); }
.pe-row input[type=color] { width: 44px; height: 28px; padding: 0; border: 1px solid var(--line-2); border-radius: 6px; background: none; cursor: pointer; }
.pe-key { display: flex; align-items: center; gap: 8px; }
.pe-note { font-size: 12.5px; color: var(--muted); line-height: 1.45; margin: 6px 0 0; }
.pe-note.warn { color: #ffb86b; }
.pe-off { opacity: .45; pointer-events: none; }
.pe-result { display: flex; gap: 12px; align-items: flex-end; }
.pe-result canvas { width: 120px; height: 144px; border-radius: 6px; background: linear-gradient(#171a26, #2a2f42 70%, #1d1c22); flex: none; }
.pe-foot { display: flex; align-items: center; gap: 10px; padding: 12px 18px 16px; border-top: 1px solid var(--line); }
.pe-foot .sp { flex: 1; }
.pe :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
  document.head.appendChild(css);

  /** the chroma key: pixels close to the key colour (in colour, not brightness) go see-through; a soft band fades the edge */
  function keyOut(d, key, tol, soft, spill) {
    const kcb = 128 - 0.168736 * key[0] - 0.331264 * key[1] + 0.5 * key[2], kcr = 128 + 0.5 * key[0] - 0.418688 * key[1] - 0.081312 * key[2];
    const kd = key[1] >= key[0] && key[1] >= key[2] ? 1 : key[2] >= key[0] ? 2 : 0, o1 = (kd + 1) % 3, o2 = (kd + 2) % 3, reach = soft * 2 + 50;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const dist = Math.hypot(128 - 0.168736 * r - 0.331264 * g + 0.5 * b - kcb, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b - kcr);
      const a = dist <= tol ? 0 : dist >= tol + soft ? 1 : (dist - tol) / soft;
      if (a < 1) d[i + 3] = d[i + 3] * a;
      if (spill && a > 0 && dist < tol + reach) {          // what's left near the edge loses its tint of the background colour
        const lim = Math.max(d[i + o1], d[i + o2]);
        if (d[i + kd] > lim) d[i + kd] -= (d[i + kd] - lim) * (1 - (dist - tol) / reach);
      }
    }
  }

  /** does the picture's border look like one flat, saturated colour (a green or blue screen)? → that colour, or null */
  function guessScreen(img) {
    const { width: w, height: h, data: d } = img, bins = new Map(); let n = 0;
    const take = (x, y) => {
      const i = (y * w + x) * 4; if (d[i + 3] < 250) return; n++;
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx < 60 || (mx - mn) / mx < 0.45) return;                              // dark or washed-out: not a screen colour
      let hue = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; hue = (hue * 60 + 360) % 360;
      const k = Math.floor(hue / 15) % 24, e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
    };
    const step = Math.max(1, Math.floor(Math.max(w, h) / 240));
    for (let x = 0; x < w; x += step) for (const y of [0, 1, 2, h - 3, h - 2, h - 1]) if (y >= 0 && y < h) take(x, y);
    for (let y = 0; y < h; y += step) for (const x of [0, 1, 2, w - 3, w - 2, w - 1]) if (x >= 0 && x < w) take(x, y);
    let best = null;
    for (let i = 0; i < 24; i++) {
      const t = { n: 0, r: 0, g: 0, b: 0 };
      for (const j of [i + 23, i, i + 1]) { const e = bins.get(j % 24); if (e) { t.n += e.n; t.r += e.r; t.g += e.g; t.b += e.b; } }
      if (!best || t.n > best.n) best = t;
    }
    if (!best || !n || best.n / n < 0.6) return null;
    const c = [best.r / best.n, best.g / best.n, best.b / best.n];
    return (c[1] > c[0] * 1.25 && c[1] > c[2] * 1.15) || (c[2] > c[0] * 1.4 && c[2] > c[1] * 1.15) ? c : null;      // greens and blues only
  }

  function open(file, name, rules = {}) {
    return new Promise(async resolve => {
      let bmp;
      try { bmp = await createImageBitmap(file); } catch { return resolve({ error: "That picture couldn't be opened. It may be damaged; save it again as a PNG." }); }
      const W = bmp.width, H = bmp.height, tooBig = rules.sourceMaxSide || 10000, maxBytes = rules.maxBytes || 8 * 1024 * 1024;
      if (W < MIN.w || H < MIN.h) { bmp.close(); return resolve({ error: `That picture is ${W} × ${H}. It needs to be at least ${MIN.w} × ${MIN.h}; ${PANEL.w} × ${PANEL.h} looks best.` }); }
      if (W > tooBig || H > tooBig) { bmp.close(); return resolve({ error: `That picture is ${W} × ${H}. Keep each side under ${tooBig} px; ${PANEL.w} × ${PANEL.h} is plenty.` }); }
      // a working copy no bigger than PREV_MAX on its long side: the sliders stay smooth whatever the picture's size
      const ps = Math.min(1, PREV_MAX / Math.max(W, H)), pw = Math.max(1, Math.round(W * ps)), ph = Math.max(1, Math.round(H * ps));
      const pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
      const pcx = pc.getContext('2d', { willReadFrequently: true }); pcx.imageSmoothingQuality = 'high'; pcx.drawImage(bmp, 0, 0, pw, ph);
      const src = pcx.getImageData(0, 0, pw, ph), screen = guessScreen(src);
      const st = { lock: true, crop: null, key: { on: !!screen, color: screen || [0, 177, 64], tol: 48, soft: 18, spill: true }, pick: false };
      const fitCrop = () => { const w = Math.min(W, H * RATIO), h = w / RATIO; st.crop = { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
      // to start with: a picture wider than the panel gets the biggest panel-shaped selection; a tall or narrow one is
      // kept whole (cutting its top and bottom off to make the shape would only lose some of the character)
      if (W / H > RATIO * 1.01) fitCrop(); else { st.crop = { x: 0, y: 0, w: W, h: H }; st.lock = W / H > RATIO * 0.99; }

      const back = document.createElement('div'); back.className = 'pe-back';
      back.innerHTML = `<div class="pe" role="dialog" aria-modal="true" aria-label="Edit the character image">
  <div class="pe-head"><h2>Character image for ${esc(name)}</h2><span>${W} × ${H}</span></div>
  <div class="pe-body">
    <div class="pe-stage"><div class="pe-pic"><canvas></canvas><div class="pe-mask"><div class="pe-shade"></div></div><div class="pe-crop locked">${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<i data-h="${h}"></i>`).join('')}</div></div></div>
    <div class="pe-side">
      <section><h3>Crop</h3>
        <label class="pe-check"><input type="checkbox" data-k="lock" checked> Keep the splash panel's shape</label>
        <div class="inline" style="gap:8px;margin-top:8px"><button class="btn sm" data-k="whole">Whole picture</button><button class="btn sm" data-k="fit">Biggest panel shape</button></div>
        <p class="pe-note" data-k="cropNote"></p></section>
      <section><h3>Background</h3>
        <label class="pe-check"><input type="checkbox" data-k="keyOn"> Remove a green-screen background</label>
        <div data-k="keyBox">
          <div class="pe-row"><span>Colour</span><span class="pe-key"><input type="color" data-k="keyColor" aria-label="Colour to remove"><button class="btn sm" data-k="pick">Pick from the picture</button></span></div>
          <div class="pe-row"><span>How much</span><input type="range" data-k="tol" min="5" max="130" step="1" aria-label="How much to remove"></div>
          <div class="pe-row"><span>Edge softness</span><input type="range" data-k="soft" min="0" max="70" step="1" aria-label="Edge softness"></div>
          <label class="pe-check"><input type="checkbox" data-k="spill"> Clean the colour off the edges</label>
        </div>
        <p class="pe-note" data-k="keyNote"></p></section>
      <h3>How it will look</h3>
      <div class="pe-result"><canvas width="240" height="288"></canvas><p class="pe-note" data-k="outNote" style="margin:0"></p></div>
    </div>
  </div>
  <div class="pe-foot"><span class="pe-note" data-k="err" style="margin:0"></span><span class="sp"></span><button class="btn ghost" data-k="cancel">Cancel</button><button class="btn primary" data-k="save">Save picture</button></div>
</div>`;
      document.body.appendChild(back);
      const $ = k => back.querySelector(`[data-k="${k}"]`), pic = back.querySelector('.pe-pic'), cv = pic.querySelector('canvas'), cropEl = back.querySelector('.pe-crop'), shade = back.querySelector('.pe-shade'), res = back.querySelector('.pe-result canvas');
      const prevFocus = document.activeElement;

      // the picture is shown as large as the stage allows
      const stage = back.querySelector('.pe-stage'), roomH = Math.max(240, Math.min(520, innerHeight - 270)), k = Math.min((Math.min(680, stage.clientWidth - 26)) / W, roomH / H, 4);      // …and as the app window's height allows
      const dw = Math.max(40, Math.round(W * k)), dh = Math.max(40, Math.round(H * k));
      cv.width = pw; cv.height = ph; cv.style.width = dw + 'px'; cv.style.height = dh + 'px'; pic.style.width = dw + 'px';
      const cx = cv.getContext('2d');
      let work = null;
      function paint() {                                 // the working copy with the key applied → the stage, the crop box, the small result
        work = new ImageData(new Uint8ClampedArray(src.data), pw, ph);
        if (st.key.on) keyOut(work.data, st.key.color, st.key.tol, st.key.soft, st.key.spill);
        cx.putImageData(work, 0, 0);
        place();
      }
      const outSize = () => { const s = Math.min(1, OUT_MAX.h / st.crop.h, OUT_MAX.w / st.crop.w); return { w: Math.max(1, Math.round(st.crop.w * s)), h: Math.max(1, Math.round(st.crop.h * s)) }; };
      function place() {
        const c = st.crop;
        for (const el of [cropEl, shade]) Object.assign(el.style, { left: c.x * k + 'px', top: c.y * k + 'px', width: c.w * k + 'px', height: c.h * k + 'px' });
        cropEl.classList.toggle('locked', st.lock);
        const o = outSize(), small = c.w < MIN.w || c.h < MIN.h;
        $('cropNote').textContent = `Selected ${Math.round(c.w)} × ${Math.round(c.h)}` + (Math.round(c.w) === W && Math.round(c.h) === H ? ' (the whole picture).' : '.');
        $('outNote').innerHTML = `Saved as a PNG, <b>${o.w} × ${o.h}</b>.` + (o.h < c.h - 1 ? ' Made smaller to fit the panel.' : '') + (c.w > c.h ? '<br>It is wider than it is tall, so it will look small in the panel.' : '');
        $('err').textContent = small ? `Too small: the selection has to be at least ${MIN.w} × ${MIN.h}.` : ''; $('err').classList.toggle('warn', small);
        $('save').disabled = small;
        // the small result: the selection, as it will sit in the panel (bottom, centred)
        const r = res.getContext('2d'); r.clearRect(0, 0, res.width, res.height);
        const s = Math.min(res.width / c.w, res.height / c.h), w = c.w * s, h = c.h * s;
        r.imageSmoothingQuality = 'high'; r.drawImage(cv, c.x * ps, c.y * ps, c.w * ps, c.h * ps, (res.width - w) / 2, res.height - h, w, h);
      }
      function controls() {
        $('lock').checked = st.lock; $('keyOn').checked = st.key.on; $('keyColor').value = hex(st.key.color); $('tol').value = st.key.tol; $('soft').value = st.key.soft; $('spill').checked = st.key.spill;
        $('keyBox').classList.toggle('pe-off', !st.key.on);
        $('pick').textContent = st.pick ? 'Click the background…' : 'Pick from the picture'; pic.classList.toggle('pick', st.pick);
        $('keyNote').textContent = st.key.on ? (screen && hex(st.key.color) === hex(screen) ? `This looks like a ${screen[2] > screen[1] ? 'blue' : 'green'}-screen picture, so its background is already removed. Untick to keep it.` : 'The checked squares show what will be see-through.') : 'For a picture taken in front of a green (or blue) screen.';
      }

      // ---- crop: move, resize (corners keep the panel's shape when it's locked)
      cropEl.addEventListener('pointerdown', e => {
        if (e.button || st.pick) return;
        const h = e.target.dataset.h || '', s0 = { x: e.clientX, y: e.clientY, c: { ...st.crop } }; cropEl.setPointerCapture(e.pointerId); e.preventDefault();
        const move = ev => {
          const dx = (ev.clientX - s0.x) / k, dy = (ev.clientY - s0.y) / k, o = s0.c; let { x, y, w, h: hh } = o;
          if (!h) { x = clamp(o.x + dx, 0, W - w); y = clamp(o.y + dy, 0, H - hh); }
          else if (st.lock) {                              // one corner stays put; the size follows the pointer, in the panel's shape
            const ax = h.includes('w') ? o.x + o.w : o.x, ay = h.includes('n') ? o.y + o.h : o.y, sx = h.includes('w') ? -1 : 1, sy = h.includes('n') ? -1 : 1;
            const maxW = Math.min(sx > 0 ? W - ax : ax, (sy > 0 ? H - ay : ay) * RATIO);
            w = clamp(Math.max(sx * (o.x + (sx > 0 ? o.w : 0) + dx - ax), sy * (o.y + (sy > 0 ? o.h : 0) + dy - ay) * RATIO), 40, maxW); hh = w / RATIO;
            x = sx > 0 ? ax : ax - w; y = sy > 0 ? ay : ay - hh;
          } else {
            let x1 = o.x + o.w, y1 = o.y + o.h; x = o.x; y = o.y;
            if (h.includes('w')) x = clamp(o.x + dx, 0, x1 - 40); if (h.includes('e')) x1 = clamp(x1 + dx, x + 40, W);
            if (h.includes('n')) y = clamp(o.y + dy, 0, y1 - 40); if (h.includes('s')) y1 = clamp(y1 + dy, y + 40, H);
            w = x1 - x; hh = y1 - y;
          }
          st.crop = { x, y, w, h: hh }; place();
        };
        const up = () => { cropEl.removeEventListener('pointermove', move); cropEl.removeEventListener('pointerup', up); cropEl.removeEventListener('pointercancel', up); };
        cropEl.addEventListener('pointermove', move); cropEl.addEventListener('pointerup', up); cropEl.addEventListener('pointercancel', up);
      });
      // ---- pick the background colour straight from the picture
      cv.addEventListener('click', e => {
        if (!st.pick) return;
        const r = cv.getBoundingClientRect(), x = clamp(Math.floor((e.clientX - r.left) / r.width * pw), 1, pw - 2), y = clamp(Math.floor((e.clientY - r.top) / r.height * ph), 1, ph - 2);
        let s = [0, 0, 0], n = 0;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { const i = (yy * pw + xx) * 4; s[0] += src.data[i]; s[1] += src.data[i + 1]; s[2] += src.data[i + 2]; n++; }
        st.key.color = s.map(v => v / n); st.key.on = true; st.pick = false; controls(); paint();
      });

      const close = out => { removeEventListener('keydown', onKey, true); back.remove(); try { bmp.close(); } catch {} if (prevFocus && prevFocus.focus) prevFocus.focus(); resolve(out); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (st.pick) { st.pick = false; controls(); } else close(null); }
        else if (e.key === 'Tab') {                        // Tab stays inside the window
          const f = [...back.querySelectorAll('button, input')].filter(el => !el.disabled && el.offsetParent && !el.closest('.pe-off')), i = f.indexOf(document.activeElement);
          if (!f.length) return;
          if (i < 0 || (e.shiftKey && i === 0) || (!e.shiftKey && i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
        }
      };
      addEventListener('keydown', onKey, true);
      back.addEventListener('mousedown', e => { if (e.target === back) e.preventDefault(); });      // a stray click outside doesn't throw the work away
      back.addEventListener('input', e => {
        const t = e.target.dataset.k;
        if (t === 'tol') st.key.tol = Number(e.target.value); else if (t === 'soft') st.key.soft = Number(e.target.value); else if (t === 'keyColor') st.key.color = rgb(e.target.value); else return;
        controls(); paint();
      });
      back.addEventListener('change', e => {
        const t = e.target.dataset.k;
        if (t === 'lock') { st.lock = e.target.checked; if (st.lock) { const c = st.crop, w = Math.min(c.w, c.h * RATIO), h = w / RATIO; st.crop = { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h }; } place(); }
        else if (t === 'keyOn') { st.key.on = e.target.checked; st.pick = false; controls(); paint(); }
        else if (t === 'spill') { st.key.spill = e.target.checked; paint(); }
      });
      back.addEventListener('click', async e => {
        const t = e.target.closest('[data-k]'); if (!t || t.tagName !== 'BUTTON') return;
        const kk = t.dataset.k;
        if (kk === 'cancel') return close(null);
        if (kk === 'whole') { st.lock = false; st.crop = { x: 0, y: 0, w: W, h: H }; controls(); place(); }
        else if (kk === 'fit') { st.lock = true; fitCrop(); controls(); place(); }
        else if (kk === 'pick') { st.pick = !st.pick; controls(); }
        else if (kk === 'save') {
          t.disabled = true; t.textContent = 'Saving…';
          try {                                          // the real thing, from the original picture: crop, scale to the panel, key, PNG
            const c = st.crop, o = outSize(), out = document.createElement('canvas'); out.width = o.w; out.height = o.h;
            const ox = out.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingQuality = 'high';
            ox.drawImage(bmp, Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h), 0, 0, o.w, o.h);
            if (st.key.on) { const id = ox.getImageData(0, 0, o.w, o.h); keyOut(id.data, st.key.color, st.key.tol, st.key.soft, st.key.spill); ox.putImageData(id, 0, 0); }
            const as = (type, q) => new Promise((ok, no) => out.toBlob(b => (b ? ok(b) : no(new Error('x'))), type, q));
            let blob = await as('image/png');
            if (blob.size > maxBytes) blob = await as('image/webp', 0.92);          // a very detailed picture: WebP keeps the see-through background and is far smaller
            close({ blob, w: o.w, h: o.h, keyed: st.key.on });
          } catch { t.disabled = false; t.textContent = 'Save picture'; $('err').textContent = "The picture couldn't be saved. Try a smaller selection."; $('err').classList.add('warn'); }
        }
      });
      controls(); paint(); $('save').focus();
    });
  }

  window.BeeboPicEditor = { open, keyOut, guessScreen };
})();
