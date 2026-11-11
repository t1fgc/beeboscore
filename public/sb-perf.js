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
    if (ema > 24 && q > .35) q = Math.max(.35, q - .03);
    else if (ema < 18.5 && q < 1) q = Math.min(1, q + .01);
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
  const H = document.documentElement, SPLASH = /\bsb-(vs|victory|bracket)-on\b/;
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
  st.textContent = 'html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket){visibility:hidden!important}'
    + 'html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket),html.sb-covered body>:not(#sb-vs):not(#sb-victory):not(#sb-bracket) *{animation-play-state:paused!important}';
  (document.head || H).appendChild(st);
  const check = () => setIdle(document.hidden || obsHidden);
  const onObs = e => { obsHidden = !(e && e.detail && e.detail.visible); check(); };
  const wins = [window];
  try { if (window.parent && window.parent !== window && window.parent.document) wins.push(window.parent); } catch (e) {}
  wins.forEach(w => { try { w.addEventListener('obsSourceVisibleChanged', onObs); } catch (e) {} });
  document.addEventListener('visibilitychange', check);
  function whenAwake(fn) { if (!wake.includes(fn)) wake.push(fn); }
  window.SBPerf = { glow, sample, n, whenAwake, get q() { return q; }, get idle() { return idle; }, get covered() { return covered; },
    get paused() { return idle || covered; } };
})();
