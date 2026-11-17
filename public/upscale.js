/* BeeboScore (developed by Beebo) — the picture upscaler (Testbuild 1.12.8).
 * start.gg profile pictures are small (often 100–200 px) and look soft blown up on FullVS, GlassVS and the PlayerCards.
 * The app asks this panel (the PC running BeeboScore) to make a bigger copy once; overlays then get that copy.
 *   • AI: ESRGAN (UpscalerJS "esrgan-medium" ×4, MIT) running on the graphics card through TensorFlow.js — offline, a few
 *     seconds per picture. Done in tiles, so a picture never needs much memory.
 *   • Smart resize: enlarged in steps with high-quality smoothing, then sharpened — instant, used when the PC has no
 *     graphics acceleration, in potato mode, or when Settings › Pictures says so.
 * Settings › Pictures › Upscale small pictures: auto (AI, smart resize when the PC can't), ai, smart, off.
 */
(() => {
  'use strict';
  const P = () => window.BeeboPanel || {};
  const TARGET = 800, AI_MAX = 320, SKIP = 560, TILE = 48, PAD = 6, SCALE = 4;
  let tf = null, model = null, loading = null, aiBroken = false, busy = false;
  const queue = [], seen = new Set();
  const mode = () => { const s = P().settings ? P().settings() : {}; return ['auto', 'ai', 'smart', 'off'].includes(s.upscale) ? s.upscale : 'auto'; };
  const potato = () => document.documentElement.classList.contains('potato') || !!(P().settings && P().settings().potatoMode);
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('couldn’t load ' + src)); document.head.appendChild(s); });

  async function loadAI() {
    if (model) return model;
    if (aiBroken) throw new Error('AI upscaler unavailable');
    if (!loading) loading = (async () => {
      if (!window.tf) await loadScript('/static/vendor/tfjs/tf.min.js');
      tf = window.tf;
      try { await tf.setBackend('webgl'); } catch (e) {}
      await tf.ready();
      if (tf.getBackend() !== 'webgl') throw new Error('no graphics acceleration');
      model = await tf.loadLayersModel('/static/vendor/esrgan/x4/model.json');
      tf.tidy(() => { model.predict(tf.zeros([1, 16, 16, 3])); });      // warm up (compiles the shaders once)
      return model;
    })().catch(e => { aiBroken = true; loading = null; throw e; });
    return loading;
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('picture didn’t load')); i.src = src; });
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---- AI: ×4 in overlapping tiles (the overlap is cut away, so no seams)
  async function aiUpscale(img) {
    await loadAI();
    const w = img.naturalWidth, h = img.naturalHeight, src = canvas(w, h), g = src.getContext('2d'); g.drawImage(img, 0, 0);
    const out = canvas(w * SCALE, h * SCALE), og = out.getContext('2d');
    for (let y = 0; y < h; y += TILE) for (let x = 0; x < w; x += TILE) {
      const x0 = Math.max(0, x - PAD), y0 = Math.max(0, y - PAD), x1 = Math.min(w, x + TILE + PAD), y1 = Math.min(h, y + TILE + PAD);
      const data = g.getImageData(x0, y0, x1 - x0, y1 - y0);
      const t = tf.tidy(() => model.predict(tf.browser.fromPixels(data).toFloat().expandDims(0)).squeeze().clipByValue(0, 255).round().toInt());
      const px = await tf.browser.toPixels(t); t.dispose();
      const tw = (x1 - x0) * SCALE, th = (y1 - y0) * SCALE, tile = new ImageData(new Uint8ClampedArray(px.buffer), tw, th);
      const cx = (x - x0) * SCALE, cy = (y - y0) * SCALE, cw = Math.min(TILE, w - x) * SCALE, ch = Math.min(TILE, h - y) * SCALE;
      og.putImageData(tile, x * SCALE - cx, y * SCALE - cy, cx, cy, cw, ch);
      await new Promise(r => setTimeout(r, 0));                                // keep the panel responsive between tiles
    }
    return out;
  }
  // ---- smart resize: doubled in steps with high-quality smoothing, then an unsharp mask
  function smartUpscale(img, target) {
    let c = canvas(img.naturalWidth, img.naturalHeight); c.getContext('2d').drawImage(img, 0, 0);
    const k = target / Math.max(c.width, c.height), fw = Math.round(img.naturalWidth * k), fh = Math.round(img.naturalHeight * k);
    while (c.width * 2 <= fw) { const n = canvas(c.width * 2, c.height * 2), g = n.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); c = n; }
    if (c.width !== fw) { const n = canvas(fw, fh), g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, fw, fh); c = n; }
    return sharpen(c, .55);
  }
  function sharpen(c, amt) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), s = d.data, o = new Uint8ClampedArray(s), W = c.width, H = c.height;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) { const v = s[i + ch], blur = (s[i - 4 + ch] + s[i + 4 + ch] + s[i - W * 4 + ch] + s[i + W * 4 + ch]) / 4; o[i + ch] = v + (v - blur) * amt; } }
    g.putImageData(new ImageData(o, W, H), 0, 0); return c;
  }
  function fitTo(c, target) {               // the size the screens need: a ×4 of a 300 px picture is cut down; a ×4 of a 96 px one is smoothed up the rest of the way
    const k = target / Math.max(c.width, c.height); if (Math.abs(k - 1) < .02) return c;
    const n = canvas(Math.round(c.width * k), Math.round(c.height * k)), g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); return n;
  }

  /** upscale a picture (an <img>, or a URL) → { canvas, how: 'ai' | 'smart' | 'none' } */
  async function upscale(src, opts = {}) {
    const img = typeof src === 'string' ? await loadImg(src) : src, m = opts.mode || mode(), long = Math.max(img.naturalWidth, img.naturalHeight), target = opts.target || TARGET;
    if (m === 'off' || long >= Math.min(SKIP, target)) return { canvas: null, how: 'none', w: img.naturalWidth, h: img.naturalHeight };
    const wantAI = (m === 'ai' || m === 'auto') && !potato() && Math.min(img.naturalWidth, img.naturalHeight) <= AI_MAX;
    if (wantAI) { try { return { canvas: fitTo(await aiUpscale(img), target), how: 'ai' }; } catch (e) { if (m === 'ai') console.warn('AI upscaler:', e.message); } }
    return { canvas: smartUpscale(img, target), how: 'smart' };
  }

  // ---- jobs from the app: { key, src } — one at a time, each picture once
  async function work() {
    if (busy) return; busy = true;
    try {
      while (queue.length) {
        const j = queue.shift();
        let body;
        try {
          const r = await upscale(j.src);
          body = r.canvas ? { key: j.key, how: r.how, png: r.canvas.toDataURL('image/png') } : { key: j.key, skip: true };
        } catch (e) { body = { key: j.key, fail: String(e.message || e).slice(0, 120) }; }
        try { await P().api('/api/upscale', { method: 'POST', body }); } catch (e) {}
      }
    } finally { busy = false; }
  }
  function add(jobs) { for (const j of jobs || []) { if (!j || !j.key || seen.has(j.key)) continue; seen.add(j.key); queue.push(j); } work(); }
  window.addEventListener('beebo:upscale', e => add((e.detail && e.detail.jobs) || []));
  window.BeeboUpscale = { upscale, loadAI, get mode() { return mode(); } };
})();
