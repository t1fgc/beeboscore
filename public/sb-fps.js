/* BeeboScore (developed by Beebo), 1.12.16 — a frame-rate cap for the app's own window.
 *
 * In OBS a browser source already draws at OBS's own frame rate (or the source's custom one), so an overlay there is left
 * alone. Everywhere else — the app window's live preview, the Layout Designer, a phone, a viewer's browser — the page's
 * frame loops (everything that asks for a frame: the effects engines, the bracket, the VS screens…) are held to 60 frames
 * a second, so a 144 or 240 Hz monitor doesn't draw two to four times the frames the stream needs on the graphics card the
 * game and OBS are using. CSS and Web Animations moves are left to the browser (they're cheap).
 *
 *   Settings › Performance › App window frame rate: 60 (default) · 30 · As fast as the screen   (kept on this PC)
 *   window.BeeboFPS.set(n)   change it (0 = no cap) · BeeboFPS.cap   what it is now
 */
(() => {
  'use strict';
  if (window.BeeboFPS) return;
  let inObs = false; try { inObs = !!(window.obsstudio || (window.parent && window.parent !== window && window.parent.obsstudio)); } catch (e) { inObs = !!window.obsstudio; }
  const read = () => { try { const v = localStorage.getItem('sb.fps'); return v === null ? 60 : Math.max(0, Number(v) || 0); } catch (e) { return 60; } };
  let cap = inObs ? 0 : read();
  const api = window.BeeboFPS = { get cap() { return cap; }, inObs, set(n) { cap = inObs ? 0 : Math.max(0, Number(n) || 0); try { localStorage.setItem('sb.fps', String(cap)); } catch (e) {} } };
  if (inObs) return;
  const nat = window.requestAnimationFrame.bind(window), natC = window.cancelAnimationFrame.bind(window);
  let q = new Map(), id = 0, pending = false, due = 0, lastT = 0, period = 16.7;
  function pump(t) {
    pending = false;
    if (lastT) period += (Math.min(50, t - lastT) - period) * .1;            // the screen's own frame time (smoothed)
    lastT = t;
    if (cap > 0) {
      const T = 1000 / cap;
      if (t < due - period / 2) { pending = true; nat(pump); return; }   // too soon: wait for the next screen frame
      due = (t - due > T) ? t + T : due + T;                             // keep the average on the cap, not drifting
    }
    const run = q; q = new Map();
    for (const f of run.values()) { try { f(t); } catch (e) { setTimeout(() => { throw e; }); } }
  }
  window.requestAnimationFrame = function (f) { const k = ++id; q.set(k, f); if (!pending) { pending = true; nat(pump); } return k; };
  window.cancelAnimationFrame = function (k) { q.delete(k); };
  // anything holding the browser's own versions (none of ours) still works; tests read how many frames ran
  api.native = { raf: nat, caf: natC };
  addEventListener('storage', e => { if (e.key === 'sb.fps') cap = read(); });     // changed in Settings: every open page follows
})();
