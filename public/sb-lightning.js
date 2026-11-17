/* BeeboScore (developed by Beebo) — realistic lightning, drawn live on a canvas.
 *
 * A bolt is grown like the real thing: a stepped leader feels its way down in short jagged steps (with forks that die
 * out), then the return stroke lights the whole channel white-hot. It flickers — a real strike re-fires two or three
 * times in a few hundred milliseconds along the same channel — lights up the sky and the clouds around it, and leaves
 * a fading afterglow. Distant strikes are thinner and dimmer, and some are only a flash inside the clouds.
 *
 *   BeeboLightning.storm(host, { color, amount, every: [min, max] s, from: 'top' | 'any', area: [x0, x1] (0..1), sky: true })
 *        → { stop(), strike(opts) }      a storm that keeps striking (a Designer atmosphere: "Lightning storm")
 *   BeeboLightning.bolt(host, x0, y0, x1, y1, { color, width, branches, flicker })   one strike between two points
 *
 * Nothing is drawn between strikes, so a storm costs nothing while the sky is dark. Light effects / potato mode: thinner
 * glow and fewer strikes.
 */
(function () {
  'use strict';
  if (window.BeeboLightning) return;
  const lite = () => document.documentElement.classList.contains('sb-light') || document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const rgb = c => { const m = /^#?([0-9a-f]{6})/i.exec(String(c || '')); const n = m ? parseInt(m[1], 16) : 0xb9c8ff; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------------------------------------------------------------------------------------- the shape of a bolt
  // a stepped leader: short steps that wander around the way to the target, with forks that peter out
  function channel(x0, y0, x1, y1, o = {}) {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = [], step = Math.max(6, len / (o.detail || 70));
    let x = x0, y = y0, guard = 0;
    steps.push([x, y]);
    while (Math.hypot(x1 - x, y1 - y) > step * 1.5 && guard++ < 900) {
      const toward = Math.atan2(y1 - y, x1 - x), wander = (o.rough ?? .62) * (Math.random() - .5) * 2;
      const a = toward + wander + (Math.random() < .08 ? rnd(-.9, .9) : 0);
      const s = step * rnd(.55, 1.45);
      x += Math.cos(a) * s; y += Math.sin(a) * s; steps.push([x, y]);
    }
    steps.push([x1, y1]);
    return steps;
  }
  function grow(x0, y0, x1, y1, o = {}) {
    const main = channel(x0, y0, x1, y1, o), out = [{ pts: main, w: o.width || 3, k: 1, depth: 0 }];
    const forks = (parent, depth) => {
      if (depth > (o.depth ?? 2)) return;
      for (let i = 2; i < parent.pts.length - 3; i++) {
        if (Math.random() > (o.fork ?? .07) / (depth + 1)) continue;
        const [px, py] = parent.pts[i], [qx, qy] = parent.pts[i + 1], dir = Math.atan2(qy - py, qx - px) + rnd(.35, 1.05) * (Math.random() < .5 ? -1 : 1);
        const remain = (parent.pts.length - i) / parent.pts.length, L = Math.hypot(x1 - x0, y1 - y0) * remain * rnd(.18, .45) / (depth + 1);
        if (L < 18) continue;
        const b = { pts: channel(px, py, px + Math.cos(dir) * L, py + Math.sin(dir) * L, { ...o, detail: 26, rough: .8 }), w: parent.w * rnd(.38, .58), k: parent.k * rnd(.4, .7), depth: depth + 1 };
        out.push(b); forks(b, depth + 1);
      }
    };
    if ((o.branches ?? 2) > 0) forks(out[0], 0);
    return out;
  }
  // how bright a strike is over time: the leader, the return stroke, then two or three re-strikes along the same channel
  function timeline(flicker = 3) {
    const t = [[0, .35], [55, .12], [70, 1], [140, .45], [210, .1]];          // the channel glows on for a moment after each stroke
    let at = 210;
    for (let i = 0; i < flicker; i++) { at += rnd(40, 130); t.push([at, rnd(.6, .95)], [at + 55, rnd(.25, .4)], [at + 120, .06]); at += 120; }
    t.push([at + 40, 0]);
    return t;
  }
  const level = (tl, ms) => { for (let i = 1; i < tl.length; i++) if (ms <= tl[i][0]) { const [a, va] = tl[i - 1], [b, vb] = tl[i]; return va + (vb - va) * (ms - a) / Math.max(1, b - a); } return 0; };

  // ---------------------------------------------------------------------------------------- drawing
  function path(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
  function paint(cv, strikes, now) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, L = lite();
    ctx.clearRect(0, 0, W, H);
    let any = false;
    for (const s of strikes) {
      const ms = now - s.t0, I = level(s.tl, ms) * s.power, after = Math.max(0, 1 - (ms - s.end) / 600);
      if (ms > s.end + 600) continue;
      any = true;
      const [r, g, b] = s.rgb;
      // the sky and the clouds light up around the strike
      if (s.sky && I > .02) {
        const sky = ctx.createRadialGradient(s.x0, s.y0 + H * .05, 0, s.x0, s.y0 + H * .05, Math.max(W, H) * .75);
        sky.addColorStop(0, `rgba(${r},${g},${b},${.32 * I})`); sky.addColorStop(.35, `rgba(${r},${g},${b},${.12 * I})`); sky.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = `rgba(255,255,255,${.05 * I})`; ctx.fillRect(0, 0, W, H);
      }
      if (s.cloud) continue;                                // a flash inside the clouds: no bolt to see
      const vis = Math.max(I, after * .16);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      for (const br of s.bolt) {
        const k = br.depth ? vis * br.k * (ms < 160 ? 1 : .45) : vis;       // forks show on the first strokes, then fade
        if (k < .01) continue;
        if (!L) {
          ctx.save(); ctx.filter = `blur(${Math.round(br.w * 4)}px)`; ctx.strokeStyle = `rgba(${r},${g},${b},${.55 * k})`; ctx.lineWidth = br.w * 9; path(ctx, br.pts); ctx.stroke(); ctx.restore();
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${.7 * k})`; ctx.lineWidth = br.w * 2.6; path(ctx, br.pts); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, 1.15 * k)})`; ctx.lineWidth = Math.max(1, br.w * .9); path(ctx, br.pts); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    return any;
  }
  function canvasFor(host) {
    let cv = host.querySelector(':scope > canvas.bl-cv');
    if (!cv) {
      cv = document.createElement('canvas'); cv.className = 'bl-cv';
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen';
      host.appendChild(cv);
    }
    const w = host.clientWidth || host.offsetWidth || 1920, h = host.clientHeight || host.offsetHeight || 1080;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv;
  }
  // one animation loop per canvas, only while something is lit
  const runs = new WeakMap();
  function run(cv) {
    const st = runs.get(cv); if (!st || st.raf) return;
    const tick = now => { st.raf = 0; if (!cv.isConnected) { st.strikes.length = 0; return; } st.strikes = st.strikes.filter(s => now - s.t0 < s.end + 700); const lit = paint(cv, st.strikes, now); if (lit || st.strikes.length) st.raf = requestAnimationFrame(tick); else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); };
    st.raf = requestAnimationFrame(tick);
  }
  function add(cv, strike) {
    let st = runs.get(cv); if (!st) { st = { strikes: [], raf: 0 }; runs.set(cv, st); }
    strike.t0 = performance.now(); strike.end = strike.tl[strike.tl.length - 1][0];
    st.strikes.push(strike); run(cv);
  }

  // ---------------------------------------------------------------------------------------- the public parts
  function bolt(host, x0, y0, x1, y1, o = {}) {
    const cv = canvasFor(host), L = lite();
    add(cv, { x0, y0, rgb: rgb(o.color || '#b9c8ff'), power: o.power ?? 1, sky: o.sky ?? false, tl: timeline(o.flicker ?? 2),
      bolt: grow(x0, y0, x1, y1, { width: o.width || 3, branches: L ? 0 : (o.branches ?? 2), depth: L ? 0 : 2, fork: o.fork ?? .09, rough: o.rough, detail: o.detail }) });
  }
  function storm(host, o = {}) {
    const cv = canvasFor(host);
    let timer = 0, stopped = false;
    const amount = Math.max(.2, Math.min(3, Number(o.amount) || 1)), [lo, hi] = o.every || [2.2, 6.5];
    const strike = (s = {}) => {
      const W = cv.width, H = cv.height, L = lite(), area = o.area || [.05, .95];
      const far = Math.random() < .35, cloud = Math.random() < (far ? .45 : .15);
      const x0 = W * rnd(area[0], area[1]), y0 = -20, ground = H * rnd(far ? .45 : .7, far ? .75 : 1.08), x1 = x0 + rnd(-.18, .18) * W;
      add(cv, { x0, y0, rgb: rgb(s.color || o.color || '#c3cdff'), power: (far ? rnd(.35, .6) : rnd(.8, 1)) * (s.power ?? 1), sky: o.sky !== false, cloud: s.cloud ?? cloud, tl: timeline(L ? 1 : Math.round(rnd(1, 3.4))),
        bolt: grow(x0, y0, x1, ground, { width: far ? rnd(1.2, 2) : rnd(2.4, 3.6), branches: L ? 0 : 2, depth: L ? 1 : 2, fork: far ? .05 : .085 }) });
    };
    const next = () => { if (stopped) return; if (!cv.isConnected) { stopped = true; return; } if (!document.hidden && cv.offsetParent !== null) strike(); timer = setTimeout(next, rnd(lo, hi) * 1000 / amount * (lite() ? 2 : 1)); };
    timer = setTimeout(next, (o.delay ?? rnd(.3, 1.4)) * 1000);
    return { stop() { stopped = true; clearTimeout(timer); }, strike };
  }
  window.BeeboLightning = { storm, bolt, grow };
})();
