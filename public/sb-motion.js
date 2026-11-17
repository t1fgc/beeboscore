/* BeeboScore (developed by Beebo) — the motion kit (Testbuild 1.9).
 *
 * Real motion for the Layout Designer's pieces, built on the Web Animations API (works in OBS's browser source):
 *   • springs    a mass on a spring, solved ahead of time into keyframes: pieces overshoot, settle and feel weighty.
 *                Three feels: snappy (quick, crisp), heavy (slow and solid), floaty (soft and bouncy).
 *   • squash & stretch   a piece stretches along the way it moves and squashes when it lands.
 *   • motion blur        a real blur along the direction of travel (SVG filters), strongest at full speed.
 *   • 3D flip shading    a piece turning in 3D darkens as it turns away from the light and catches it as it faces you.
 *   • shadow lift        a piece coming toward you lifts off the screen: its shadow grows and softens (splashes only:
 *                        on the scoreboard nothing is drawn outside the layout's own pieces).
 *   • typewriter         letters type in at a human pace with a blinking caret.
 *   • count-up           numbers roll up and settle, on a spring with no overshoot.
 *   • list FLIP          when a list re-orders (standings, upcoming matches) rows glide to their new places.
 *
 *   SBMotion.keyframes(pose, feel, opts) → { frames, dur }   pose: where the piece starts, e.g. { tx: -140, opacity: 0 }
 *   SBMotion.spring(feel) → { x: [...], v: [...], dur }      sampled at 60 fps, 0 → 1
 *   SBMotion.typewriter(node, text, opts) · SBMotion.countUp(node, to, opts) · SBMotion.flip(box, keyOf, change)
 */
(() => {
  const FPS = 60;
  // stiffness k, damping c, mass m. Critically damped is c = 2·sqrt(k·m): below that it bounces.
  const PRESETS = {
    snappy: { label: 'Snappy', emoji: '⚡', k: 560, c: 30, m: 1, tip: 'Quick and crisp, a small overshoot.' },
    heavy: { label: 'Heavy', emoji: '🪨', k: 210, c: 27, m: 2.4, tip: 'Slow to start, lands with weight.' },
    floaty: { label: 'Floaty', emoji: '🪶', k: 80, c: 7.5, m: 1, tip: 'Soft and bouncy, takes its time.' },
  };
  const cache = new Map();
  function spring(feel) {
    const P = typeof feel === 'object' ? feel : PRESETS[feel] || PRESETS.snappy, key = [P.k, P.c, P.m].join();
    if (cache.has(key)) return cache.get(key);
    let x = 0, v = 0; const xs = [0], vs = [0], sub = 4, dt = 1 / FPS / sub;
    for (let f = 1; f < FPS * 3; f++) {
      for (let s = 0; s < sub; s++) { const a = (-P.k * (x - 1) - P.c * v) / P.m; v += a * dt; x += v * dt; }
      xs.push(x); vs.push(v);
      if (f > 6 && Math.abs(x - 1) < .0015 && Math.abs(v) < .02) break;
    }
    xs[xs.length - 1] = 1; vs[vs.length - 1] = 0;
    const r = { x: xs, v: vs, dur: (xs.length - 1) / FPS * 1000 };
    cache.set(key, r); return r;
  }
  // a critically damped curve (no overshoot) for numbers and lists
  const smooth = { k: 260, c: 2 * Math.sqrt(260), m: 1 };

  // motion blur: SVG filters that blur along one axis only, a few strengths
  const MB = [1.5, 3, 5, 8, 12, 17];
  let mbDone = false;
  function mbFilters() {
    if (mbDone || typeof document === 'undefined' || !document.body) return mbDone;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    svg.id = 'sb-motion-defs';
    svg.innerHTML = MB.map((s, i) => `<filter id="sbmb-x${i}" x="-25%" y="0" width="150%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${s} 0"/></filter>`
      + `<filter id="sbmb-y${i}" x="0" y="-25%" width="100%" height="150%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 ${s}"/></filter>`).join('');
    document.body.appendChild(svg); mbDone = true; return true;
  }
  const mbLevel = speed => { let i = -1; for (let j = 0; j < MB.length; j++) if (speed > (j + 1) * 260) i = j; return i; };     // px per second → strength

  /** keyframes that move a piece from `pose` to where it belongs, on a spring.
   *  pose: { tx, ty, s (scale), r (turn°), ry (3D turn°), opacity, blur (px) }
   *  opts: { squash, mblur, lift, shade, origin } */
  function keyframes(pose = {}, feel = 'snappy', opts = {}) {
    const sp = spring(feel), n = sp.x.length, frames = [];
    const p = { tx: 0, ty: 0, s: 1, r: 0, ry: 0, opacity: 1, blur: 0, ...pose };
    const dist = Math.hypot(p.tx, p.ty), axis = Math.abs(p.tx) >= Math.abs(p.ty) ? 'x' : 'y';
    const blurOk = opts.mblur !== false && dist > 30 && mbFilters();
    for (let i = 0; i < n; i++) {
      const k = sp.x[i], u = 1 - k, vel = sp.v[i];          // u: how far from home (negative = overshot)
      const tx = p.tx * u, ty = p.ty * u, s = 1 + (p.s - 1) * u, r = p.r * u, ry = p.ry * u;
      const speed = Math.abs(vel) * dist;                  // px per second along the path
      let sx = s, sy = s;
      if (opts.squash !== false && dist > 20) {            // stretch along the travel, squash on the overshoot
        const st = Math.min(.16, speed / 9000), sq = k > 1 ? Math.min(.1, (k - 1) * .9) : 0;
        if (axis === 'x') { sx *= 1 + st - sq; sy *= 1 / (1 + st) + sq; } else { sy *= 1 + st - sq; sx *= 1 / (1 + st) + sq; }
      } else if (opts.squash !== false && p.s !== 1 && k > 1) { const sq = Math.min(.07, (k - 1) * .6); sx *= 1 + sq; sy *= 1 - sq; }
      const op = p.opacity >= 1 ? 1 : Math.min(1, p.opacity + (1 - p.opacity) * Math.min(1, k * 1.6));
      const tf = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)${r ? ` rotate(${r.toFixed(2)}deg)` : ''}${ry ? ` perspective(900px) rotateY(${ry.toFixed(2)}deg)` : ''} scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      const fl = [];
      if (blurOk) { const lv = mbLevel(speed); if (lv >= 0) fl.push(`url(#sbmb-${axis}${lv})`); }
      if (p.blur) fl.push(`blur(${(p.blur * Math.max(0, u)).toFixed(1)}px)`);
      if (ry && opts.shade !== false) { const c = Math.abs(Math.cos(ry * Math.PI / 180)); fl.push(`brightness(${(.45 + .55 * c + (c > .92 ? (c - .92) * 3 : 0)).toFixed(3)})`); }   // catches the light as it faces you
      if (opts.lift) { const L = Math.max(0, (s - 1) * 60 + Math.abs(ty) * .04 + (k > 1 ? 0 : u * 6)); if (L > .4) fl.push(`drop-shadow(0 ${(L * .8).toFixed(1)}px ${(L * 1.6).toFixed(1)}px rgba(0,0,0,${Math.min(.5, .15 + L * .02).toFixed(2)}))`); }
      const f = { offset: i / (n - 1), transform: tf, opacity: op, filter: fl.length ? fl.join(' ') : 'none' };
      frames.push(f);
    }
    frames[n - 1] = { offset: 1, transform: 'none', opacity: 1, filter: 'none' };
    return { frames, dur: sp.dur };
  }

  // ------------------------------------------------------------------ text
  /** letters type in at a human pace: quicker inside words, a beat after spaces, a caret that blinks then goes */
  function typewriter(node, text, o = {}) {
    if (!node) return;
    const fin = String(text ?? node.textContent), base = Math.max(14, (o.dur || Math.min(900, 40 * fin.length)) / Math.max(1, fin.length));
    const tok = (node.__tw = (node.__tw || 0) + 1);
    node.textContent = '';
    const caret = document.createElement('span'); caret.className = 'sbm-caret'; caret.textContent = o.caret || '▌';
    caret.style.cssText = 'display:inline-block;margin-left:.04em;opacity:.9;font-weight:400;transform:scaleX(.7);color:currentColor;-webkit-text-fill-color:currentColor';
    let i = 0;
    const step = () => {
      if (node.__tw !== tok || (node.dataset.txt != null && node.dataset.txt !== fin)) return;
      i++; node.textContent = fin.slice(0, i); node.appendChild(caret);
      if (i < fin.length) { const ch = fin[i - 1], wait = ch === ' ' ? base * 2.4 : /[,.:;!?]/.test(ch) ? base * 3 : base * (.55 + Math.random() * .9); setTimeout(step, wait); }
      else { try { caret.animate([{ opacity: .9 }, { opacity: 0 }, { opacity: .9 }], { duration: 700, iterations: 2 }).onfinish = () => { if (node.__tw === tok) caret.remove(); }; } catch (e) { caret.remove(); } }
    };
    node.appendChild(caret); setTimeout(step, base);
  }
  /** a number rolls up to its value and settles (no overshoot: a score never shows a number it doesn't have) */
  function countUp(node, to, o = {}) {
    if (!node) return;
    const fin = o.text != null ? String(o.text) : String(node.dataset.txt ?? node.textContent), m = fin.match(/\d+/); if (!m) return;
    const target = to != null ? Number(to) : Number(m[0]), from = Number(o.from) || 0, sp = spring(smooth), t0 = performance.now(), dur = Math.max(300, o.dur || sp.dur);
    const tok = (node.__cu = (node.__cu || 0) + 1);
    const tick = () => {
      if (node.__cu !== tok || (node.dataset.txt != null && node.dataset.txt !== fin)) return;
      const t = Math.min(1, (performance.now() - t0) / dur), k = sp.x[Math.min(sp.x.length - 1, Math.round(t * (sp.x.length - 1)))];
      node.textContent = fin.replace(/\d+/, String(Math.round(from + (target - from) * k)));
      if (t < 1) requestAnimationFrame(tick); else node.textContent = fin;
    };
    requestAnimationFrame(tick);
  }
  /** FLIP: call `change()` to re-draw a list; rows (children with data-k) that were already there glide from where
   *  they were, new rows come in one after another. Returns nothing; safe to call when nothing moved. */
  function flip(box, change, o = {}) {
    if (!box) { change(); return; }
    const before = new Map();
    for (const c of box.children) if (c.dataset && c.dataset.k) before.set(c.dataset.k, c.getBoundingClientRect());
    change();
    const sp = keyframes({}, o.feel || 'snappy'), k = (box.getBoundingClientRect().width / (box.offsetWidth || 1)) || 1;
    let fresh = 0;
    for (const c of box.children) {
      const was = c.dataset && before.get(c.dataset.k);
      if (was) {
        const now = c.getBoundingClientRect(), dx = (was.left - now.left) / k, dy = (was.top - now.top) / k;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) continue;
        const r = keyframes({ tx: dx, ty: dy }, o.feel || 'snappy', { mblur: false, squash: false });
        try { c.animate(r.frames, { duration: r.dur, easing: 'linear' }); } catch (e) {}
      } else if (before.size) {
        const r = keyframes({ tx: o.across ? 0 : -40, ty: o.across ? 20 : 0, opacity: 0 }, o.feel || 'snappy', { mblur: false });
        try { c.animate(r.frames, { duration: r.dur, delay: fresh++ * 60, easing: 'linear', fill: 'backwards' }); } catch (e) {}
      }
    }
    return sp;
  }

  window.SBMotion = { PRESETS, spring, keyframes, typewriter, countUp, flip, mbFilters };
})();
