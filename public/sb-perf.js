/*
 * BeeboScore effects helper — shared by every layout, the splash screens and the Layout Designer.
 *   SBPerf.glow(key, stops)  a soft glow drawn ONCE into a small picture, then stamped for every particle
 *                            (building a fresh gradient per particle per frame was the biggest cost)
 *   SBPerf.n(count)          particle count scaled down automatically if this PC can't keep up, back up when it can
 *   SBPerf.sample(ms)        particle loops report their frame time here
 *   SBPerf.idle              true while OBS has this source hidden (or the page is in the background):
 *                            effect loops pause, SBPerf.whenAwake(fn) restarts them
 *   SBPerf.covered           true while a full-screen splash (VS / victory / bracket) completely covers the
 *                            scoreboard: the scoreboard's own effects pause underneath it and resume as it leaves
 */
(function () {
  'use strict';
  if (window.SBPerf) return;
  const sprites = new Map();
  function glow(key, stops, size = 64) {
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), r = size / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
    for (const [o, col] of stops) g.addColorStop(o, col);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    if (sprites.size > 600) sprites.clear();
    sprites.set(key, c);
    return c;
  }
  // quality: drops when frames run long (below ~42 fps), recovers slowly once they're quick again
  let q = 1, ema = 16.7;
  function sample(ms) {
    if (!(ms > 0) || ms > 250) return;
    ema = ema * .94 + ms * .06;
    const top = H.classList.contains('sb-ultra') ? .25 : 1;
    if (ema > 24 && q > .2) q = Math.max(top < 1 ? .1 : .35, q - .03);
    else if (ema < 18.5 && q < top) q = Math.min(top, q + .01);
  }
  function n(count) { const v = count * q, f = Math.floor(v); return f + (Math.random() < v - f ? 1 : 0); }
  // paused while hidden: OBS tells the page when a source is shown/hidden (the event reaches the host page)
  let idle = false, obsHidden = false, covered = false;
  const wake = [];
  const fire = () => wake.splice(0).forEach(f => { try { f(); } catch (e) {} });
  function setIdle(v) {
    if (idle === v) return;
    idle = v;
    if (!v) fire();
  }
  // a splash is up → once its entrance has filled the screen, stop drawing what's hidden behind it
  const H = document.documentElement, SPLASH = /\bsb-(vs|victory|bracket|comm)-on\b/;
  let coverT = 0;
  function setCovered(v) {
    if (covered === v) return;
    covered = v; H.classList.toggle('sb-covered', v);
    if (!v) fire();
  }
  new MutationObserver(() => {
    const up = SPLASH.test(H.className) && !H.classList.contains('sb-potato');
    if (up && !covered && !coverT) coverT = setTimeout(() => { coverT = 0; if (SPLASH.test(H.className)) setCovered(true); }, 900);
    if (!up) { clearTimeout(coverT); coverT = 0; setCovered(false); }
  }).observe(H, { attributes: true, attributeFilter: ['class'] });
  const st = document.createElement('style');
  st.textContent = 'html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket):not(#el-vs):not(#el-vic):not(#sbv):not(#sbc):not(#sbStory){visibility:hidden!important}'
    + 'html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket):not(#el-vs):not(#el-vic):not(#sbv):not(#sbc):not(#sbStory),html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket):not(#el-vs):not(#el-vic):not(#sbv):not(#sbc):not(#sbStory) *{animation-play-state:paused!important}';
  (document.head || H).appendChild(st);
  const check = () => setIdle(document.hidden || obsHidden);
  const onObs = e => { obsHidden = !(e && e.detail && e.detail.visible); check(); };
  const wins = [window];
  try { if (window.parent && window.parent !== window && window.parent.document) wins.push(window.parent); } catch (e) {}
  wins.forEach(w => { try { w.addEventListener('obsSourceVisibleChanged', onObs); } catch (e) {} });
  document.addEventListener('visibilitychange', check);
  function whenAwake(fn) { if (!wake.includes(fn)) wake.push(fn); }

  // Ultra-light (1.11), for very weak PCs: no glows, blurs or shadows; nothing loops (spins, flickers, currents, shines); no particles on the splash screens;
  // entrances and transitions still play, but only by sliding, scaling and fading; particles cut to a quarter; the
  // effects engine (WebGL) off. Chosen in Settings › Effects (or a Stream Deck key), or by Auto: on a PC without a
  // graphics card, or when this page can't hold ~30 fps for a few seconds while it's on screen.
  const ULTRA_CSS = ['.sd-root', '#sbf', '#sbf-vs', '#sbf-sp', '.sbf-band', '#sbf-bar', '#sb-vs', '#sb-victory', '#sb-bracket', '.sd-shards']
    .map(r => `html.sb-ultra ${r},html.sb-ultra ${r} *,html.sb-ultra ${r} *::before,html.sb-ultra ${r} *::after`).join(',')
    + '{filter:none!important;text-shadow:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;mix-blend-mode:normal!important;animation:none!important}'
    + 'html.sb-ultra .fxe,html.sb-ultra .sd-cv-back,html.sb-ultra .sd-parts{display:none!important}';
  const us = document.createElement('style'); us.textContent = ULTRA_CSS; (document.head || H).appendChild(us);
  // only on stream (an overlay page): the Designer and the panel's previews always show everything
  const ONSTREAM = !!window.__SB_OVERLAY;
  let want = ONSTREAM ? String(window.__SB_GFXQ || 'auto') : 'full', autoUltra = false;
  const ultra = () => want === 'ultra' || (want === 'auto' && autoUltra);
  function applyUltra() { const on = ultra(); if (H.classList.contains('sb-ultra') !== on) { H.classList.toggle('sb-ultra', on); if (on) q = Math.min(q, .25); } }
  function setQuality(v) { v = String(v || 'auto'); if (v === want) return; want = v; applyUltra(); }
  // Auto: a PC whose graphics run in software, or one that can't keep up
  if (ONSTREAM) try { const gl = document.createElement('canvas').getContext('webgl'), dbg = gl && gl.getExtension('WEBGL_debug_renderer_info'), rn = gl ? String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none';
    if (!gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rn)) autoUltra = true; const e = gl && gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) {}
  // 1.12: Auto watches the frame rate in short samples (3 s every 15 s) instead of drawing a frame every 60th of a second
  // forever — a page with nothing moving now lets the PC rest. Two slow samples in a row → Ultra-light.
  { let slowRuns = 0;
    const sampleRun = () => {
      if (autoUltra || want !== 'auto') return;
      if (idle || document.hidden || resting) return setTimeout(sampleRun, 15000);
      let last = 0, n = 0, sum = 0; const t0 = performance.now();
      const tick = t => { if (last) { const dt = t - last; if (dt < 400) { sum += dt; n++; } } last = t;
        if (t - t0 < 3000) return requestAnimationFrame(tick);
        const avg = n ? sum / n : 16.7; slowRuns = avg > 40 ? slowRuns + 1 : 0;
        if (slowRuns >= 2) { autoUltra = true; applyUltra(); return; }
        setTimeout(sampleRun, slowRuns ? 2000 : 15000); };
      requestAnimationFrame(tick);
    };
    setTimeout(sampleRun, 2500); }      // after the page's own start-up
  // 1.12 Laptop mode (Settings › Performance): the effects engine draws at 30 frames a second, and when nothing has changed
  // on the scoreboard for 20 s the looping effects rest (they pick up again, from where they were, at the next change)
  let laptop = ONSTREAM && !!window.__SB_LAPTOP, resting = false, restT = 0;
  const rs = document.createElement('style');
  rs.textContent = 'html.sb-rest .sd-root *,html.sb-rest .sd-root *::before,html.sb-rest .sd-root *::after{animation-play-state:paused!important}';
  (document.head || H).appendChild(rs);
  function setRest(v) { if (resting === v) return; resting = v; H.classList.toggle('sb-rest', v); if (!v) fire(); }
  function activity() { clearTimeout(restT); setRest(false); if (laptop) restT = setTimeout(() => { if (!finiteBusy()) setRest(true); else activity(); }, 20000); }
  const finiteBusy = () => document.getAnimations().some(a => a.playState === 'running' && a.id !== 'sb-relay' && a.effect && a.effect.getComputedTiming().iterations !== Infinity);
  if (ONSTREAM) window.addEventListener('scoreboard', e => { const g = e.detail && e.detail.gfx; const was = laptop; if (g && 'laptop' in g) laptop = !!g.laptop; const u = e.detail && e.detail.updatedAt; if (u !== lastU || was !== laptop || (g && g.cue && g.cue.n !== lastCue)) { lastU = u; lastCue = g && g.cue && g.cue.n; activity(); } });
  let lastU = null, lastCue = null;
  if (ONSTREAM && laptop) activity();
  applyUltra();
  if (ONSTREAM) window.addEventListener('scoreboard', e => { const g = e.detail && e.detail.gfx; if (g && g.q) setQuality(g.q); });
  // 1.12.6 — lighter by default, everywhere. Animating a filter (brightness flashes, blurs, glows) or a shadow makes the
  // browser repaint that element on every frame, on the processor; transform and opacity are done by the graphics card
  // for free. So moving pictures here move by transform and opacity only:
  //   • an animation started from script (element.animate) leaves out filter / box-shadow / text-shadow;
  //   • the stylesheets' @keyframes lose those too (still glows and shadows stay as they are — only their animation goes).
  // Entrances, flashes and moments keep their motion, their timing and their ends (finish handlers still run).
  const HEAVY = ['filter', 'webkitFilter', 'boxShadow', 'textShadow', 'backdropFilter', 'webkitBackdropFilter'];
  const HEAVY_CSS = ['filter', '-webkit-filter', 'box-shadow', 'text-shadow', 'backdrop-filter', '-webkit-backdrop-filter'];
  // 1.12.8: only when the stream asks for lighter effects (Light / Ultra-light / no engine, laptop mode or potato mode). At full
  // quality — and always in the Layout Designer — every glow, flash and shadow animates as designed (1.12.6 took them out
  // everywhere, and many effects lost what made them visible).
  const KEEP_FX = !!window.__SB_KEEP_FILTERS || !ONSTREAM;
  const lightNow = () => ['light', 'ultra', 'off'].includes(want) || laptop || ultra() || H.classList.contains('sb-light') || H.classList.contains('sb-potato') || !!window.__SB_POTATO;
  if (!KEEP_FX && Element.prototype.animate && !Element.prototype.animate.__light) {
    const orig = Element.prototype.animate;
    const strip = f => { if (!f || typeof f !== 'object') return f; let c = null; for (const k of HEAVY) if (k in f) { c = c || { ...f }; delete c[k]; } return c || f; };
    const light = function (kf, o) { if (lightNow()) try { kf = Array.isArray(kf) ? kf.map(strip) : strip(kf); } catch (e) {} return orig.call(this, kf, o); };
    light.__light = true; Element.prototype.animate = light;
  }
  const done = new WeakSet();
  function lightenSheets() {
    if (KEEP_FX || !lightNow()) return;
    for (const sh of document.styleSheets) {
      if (done.has(sh)) continue;
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }       // (another site's stylesheet: not readable, not ours)
      done.add(sh);
      const walk = list => { for (const r of list) {
        if (r.type === 7) for (const k of r.cssRules) for (const p of HEAVY_CSS) if (k.style.getPropertyValue(p)) k.style.removeProperty(p);   // @keyframes
        else if (r.cssRules) walk(r.cssRules);                                 // inside @media
      } };
      try { walk(rules); } catch (e) {}
    }
  }
  let lt = 0; const lighten = () => { if (!lt) lt = requestAnimationFrame(() => { lt = 0; lightenSheets(); }); };
  lighten(); document.addEventListener('DOMContentLoaded', lighten);
  // a new style element, or one whose text is replaced (that makes a new stylesheet): lightened before the next frame
  new MutationObserver(ms => { for (const m of ms) { if (m.target && m.target.nodeName === 'STYLE') return lighten(); for (const n of m.addedNodes) if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') return lighten(); } }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', lighten);
  window.SBPerf = { glow, sample, n, whenAwake, setQuality, get ultra() { return ultra(); }, get q() { return q; }, get idle() { return idle; }, get covered() { return covered; },
    get paused() { return idle || covered || resting; }, get resting() { return resting; }, get laptop() { return laptop; }, get lighter() { return !KEEP_FX && lightNow(); } };
})();
