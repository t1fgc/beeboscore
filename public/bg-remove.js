/* BeeboScore (developed by Beebo) — automatic background removal, on this PC (Testbuild 1.12.5).
 *
 * A small picture-cutting model (U²-Net, "u2netp", 4.5 MB) finds the subject of a picture — the player or the character —
 * and everything else goes see-through. It runs in the panel with ONNX Runtime Web (public/vendor/bgremove), on the
 * processor, without the internet; the first use loads it (a second or two), after that it's quick.
 *
 *   BeeboBgRemove.mask(source)  → Promise<HTMLCanvasElement>   a greyscale mask the size of `source` (white = keep)
 *       source: a canvas, an image or an ImageBitmap
 *   BeeboBgRemove.ready()        → Promise (loads the model)
 */
(() => {
  'use strict';
  if (window.BeeboBgRemove) return;
  const BASE = '/static/vendor/bgremove/', N = 320;
  let session = null, loading = null;
  function loadScript(src) {
    return new Promise((ok, no) => { if (window.ort) return ok(); const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => no(new Error('The background remover couldn’t be loaded.')); document.head.appendChild(s); });
  }
  function ready() {
    if (session) return Promise.resolve(session);
    if (!loading) loading = (async () => {
      await loadScript(BASE + 'ort.wasm.min.js');
      const ort = window.ort; ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = BASE; ort.env.logLevel = 'error';
      session = await ort.InferenceSession.create(BASE + 'u2netp.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return session;
    })().catch(e => { loading = null; throw e; });
    return loading;
  }
  /** the subject of the picture, as a mask the size of the picture */
  async function mask(src) {
    const s = await ready(), ort = window.ort;
    const w = src.width, h = src.height;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.drawImage(src, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data, f = new Float32Array(3 * N * N), M = [.485, .456, .406], S = [.229, .224, .225];
    let mx = 1; for (let i = 0; i < N * N; i++) mx = Math.max(mx, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) f[k * N * N + i] = (d[i * 4 + k] / mx - M[k]) / S[k];
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', f, [1, 3, N, N]) });
    const m = out[s.outputNames[0]].data; let lo = Infinity, hi = -Infinity; for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const img = g.createImageData(N, N), span = hi - lo || 1;
    for (let i = 0; i < N * N; i++) { const v = Math.round((m[i] - lo) / span * 255); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    const big = document.createElement('canvas'); big.width = w; big.height = h;
    const bg = big.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(c, 0, 0, w, h);
    return big;
  }
  /** the mask applied to pixels: keep (0–100) moves the cut; soft (0–100) feathers it */
  function apply(data, maskData, keep = 50, soft = 30) {
    const t = 1 - keep / 100, half = Math.max(.02, soft / 200);
    const lo = (t - half) * 255, hi = (t + half) * 255, span = hi - lo;
    for (let i = 0; i < data.length; i += 4) {
      const m = maskData[i]; const a = m <= lo ? 0 : m >= hi ? 1 : (m - lo) / span;
      if (a < 1) data[i + 3] = data[i + 3] * a;
    }
  }
  window.BeeboBgRemove = { ready, mask, apply };
})();
