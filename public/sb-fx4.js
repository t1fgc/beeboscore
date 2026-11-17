/* BeeboScore (developed by Beebo) — BeeboFX 4 (Testbuild 1.12.15): the engine the other three run on.
 *
 * Before 1.12.15 each effects engine had its own frame loop, its own slow-frame watchdog and its own graphics contexts
 * (BeeboFX 2 even opened a fresh one for every piece it moved, which is why only three pieces could do it at once).
 * BeeboFX 4 is what they share now:
 *
 *   BeeboFX4.raf(fn) / caf(id)    one master clock: every engine's frame runs in the same tick with the same time, so the
 *                                 effects engine, the materials and the transitions stay frame-locked with each other
 *   BeeboFX4.context(kind)        the shared graphics contexts — 'fx' (BeeboFX + BeeboFX 3: hits, particles, materials,
 *                                 lettering, backdrops) and 'tx' (every BeeboFX 2 transition, with edge smoothing and depth
 *                                 for the 3D ones). Two contexts in all, however many pieces are moving.
 *   BeeboFX4.claim(kind, owner)   take the context for one engine: each engine keeps its own vertex state (a vertex array
 *                                 object of its own) and the shared switches are reset when it changes hands
 *   BeeboFX4.present(kind, cv, w, h)   hand the frame just drawn to a piece's canvas (a bitmap handover where it can)
 *   BeeboFX4.gov                  the governor: what graphics card this is, a frame budget, and one quality level for all
 *                                 the engines (0 full · 1 light · 2 the plain look) — stepped down when frames run long on
 *                                 stream, back up when there's room again
 *   BeeboFX4.reseed(key) / rand() randomness that can play the same every time (a layout's "Same every time" setting, tests)
 *   BeeboFX4.audio                the audio bus: who's talking (commentary) and a tapped tempo — looks can pulse with them
 *   BeeboFX4.stats()              for Settings › Health
 */
(() => {
  'use strict';
  if (window.BeeboFX4 || window.__SB_NOFX4) return;      // __SB_NOFX4: run the engines on their own, as before 1.12.15 (tests, a fallback)
  const H = document.documentElement;
  const nowMs = () => performance.now();

  // ===================================================================================== the master clock
  let Q = [], ticking = false, nextId = 1e9, frameNo = 0, lastTick = 0, tickCost = 0;
  const subs = new Set();
  const nativeRAF = window.requestAnimationFrame.bind(window);
  function tick(now) {
    const batch = Q; Q = []; frameNo++;
    const gap = lastTick ? now - lastTick : 0; lastTick = now;
    const t0 = nowMs();
    for (const it of batch) if (it[1]) { try { it[1](now); } catch (e) { console.warn('[BeeboFX 4] frame', e); } }
    for (const s of subs) { try { s(now); } catch (e) { console.warn('[BeeboFX 4] tick', e); } }
    tickCost = nowMs() - t0;
    gov.frame(now, gap, tickCost, batch.length + subs.size);
    if (Q.length || subs.size) nativeRAF(tick); else { ticking = false; lastTick = 0; }
  }
  const start = () => { if (!ticking) { ticking = true; nativeRAF(tick); } };
  function raf(fn) { const id = nextId++; Q.push([id, fn]); start(); return id; }
  function caf(id) { for (const it of Q) if (it[0] === id) it[1] = null; }
  function every(fn) { subs.add(fn); start(); return () => subs.delete(fn); }

  // ===================================================================================== the graphics card
  // what it is, once — so the governor (and Settings › Health) knows whether this PC draws on a real graphics card
  const GPU = (() => {
    const g = { name: '', soft: false, cls: 'unknown', webgl2: false, offscreen: typeof OffscreenCanvas === 'function' };
    try {
      const c = document.createElement('canvas'), x = c.getContext('webgl2');
      if (x) {
        g.webgl2 = true;
        const dbg = x.getExtension('WEBGL_debug_renderer_info');
        g.name = String(dbg ? x.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : x.getParameter(x.RENDERER)).replace(/^ANGLE \((.*)\)$/, '$1');
        g.soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(g.name);
        g.cls = g.soft ? 'software' : /nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|\brx \d{3,4}|arc\(tm\) a\d|arc a\d/i.test(g.name) ? 'dedicated'
          : /intel|uhd|iris|radeon\(tm\) graphics|vega \d+ graphics|apple|mali|adreno|powervr/i.test(g.name) ? 'integrated' : 'unknown';
        const lose = x.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch (e) {}
    return g;
  })();

  // ===================================================================================== the shared contexts
  const KINDS = {
    fx: { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' },
    tx: { premultipliedAlpha: true, alpha: true, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' },
  };
  const CTX = {}, lostFns = new Set();
  function context(kind) {
    if (CTX[kind] && !CTX[kind].lost) return CTX[kind];
    const opts = KINDS[kind]; if (!opts) return null;
    let canvas = null, gl = null, bm = false;
    if (typeof OffscreenCanvas === 'function' && !window.__BFX3_COPY && !window.__BFX4_COPY) {
      try { canvas = new OffscreenCanvas(64, 64); gl = canvas.getContext('webgl2', opts); bm = !!gl && typeof canvas.transferToImageBitmap === 'function'; } catch (e) { gl = null; }
      if (gl && !bm) gl = null;
    }
    if (!gl) { try { canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; gl = canvas.getContext('webgl2', opts); } catch (e) { gl = null; } }
    if (!gl) return null;
    const c = { kind, gl, canvas, bm, owner: null, vaos: new Map(), gen: (CTX[kind] ? CTX[kind].gen : 0) + 1, lost: false };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); c.lost = true; for (const f of lostFns) try { f(kind); } catch (er) {} });
    CTX[kind] = c; return c;
  }
  function claim(kind, owner) {
    const c = CTX[kind]; if (!c || c.lost) return null;
    if (c.owner === owner) return c.gl;
    const gl = c.gl; c.owner = owner;
    let v = c.vaos.get(owner); if (!v) { v = gl.createVertexArray(); c.vaos.set(owner, v); }
    gl.bindVertexArray(v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true); gl.activeTexture(gl.TEXTURE0); gl.useProgram(null);
    return gl;
  }
  // size the shared canvas for a frame of w × h (bitmap handover needs it exact; a copy only needs it big enough)
  function fit(kind, w, h) {
    const c = CTX[kind]; if (!c) return;
    if (c.bm) { if (c.canvas.width !== w) c.canvas.width = w; if (c.canvas.height !== h) c.canvas.height = h; }
    else if (c.canvas.width < w || c.canvas.height < h) { c.canvas.width = Math.max(c.canvas.width, w); c.canvas.height = Math.max(c.canvas.height, h); }
  }
  function present(kind, cv, w, h) {
    const c = CTX[kind]; if (!c) return;
    if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
    if (c.bm) { const b = c.canvas.transferToImageBitmap(); (cv.__br || (cv.__br = cv.getContext('bitmaprenderer'))).transferFromImageBitmap(b); return; }
    const g = cv.__2d || (cv.__2d = cv.getContext('2d')); g.clearRect(0, 0, w, h); g.drawImage(c.canvas, 0, c.canvas.height - h, w, h, 0, 0, w, h);
  }
  function blank(cv) { try { if (cv.__br) cv.__br.transferFromImageBitmap(null); else if (cv.width) { const g = cv.__2d || cv.getContext('2d'); if (g) g.clearRect(0, 0, cv.width, cv.height); } } catch (e) {} }

  // ===================================================================================== the governor
  // On stream with Effects quality on Auto: watch how long frames take (all engines together) and how often they come;
  // step everything down a level when they run long for a while, and try going back up once there's room again.
  const autoQ = () => String(window.__SB_GFXQ || 'auto') === 'auto' && /^\/(overlay|commentary)/.test(location.pathname) && !/[?&](preview|edit)\b/.test(location.search);
  const gov = {
    level: GPU.soft ? 2 : 0, why: GPU.soft ? 'this PC draws graphics without a graphics card' : '', floor: 0, changedAt: 0, goodSince: 0,
    cost: [], gaps: [], evalAt: 0, reportAt: 0, fns: new Set(), budget: 1000 / 60,
    on(fn) { this.fns.add(fn); return () => this.fns.delete(fn); },
    set(level, why) { level = Math.max(0, Math.min(2, level | 0)); if (level === this.level) return; this.level = level; this.why = why || ''; this.changedAt = nowMs(); this.cost = []; this.gaps = []; for (const f of this.fns) try { f(level); } catch (e) {} },
    frame(now, gap, cost, n) {
      if (!n) return;
      this.cost.push(cost); if (gap && gap < 1000) this.gaps.push(gap);
      if (this.cost.length > 90) this.cost.shift(); if (this.gaps.length > 90) this.gaps.shift();
      if (now - this.evalAt < 2000) return; this.evalAt = now;
      const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
      const c = pct(this.cost, .5), g = pct(this.gaps, .9);
      this.fps = g ? Math.round(1000 / pct(this.gaps, .5)) : 0; this.ms = Math.round(c * 10) / 10; this.p90 = Math.round(g * 10) / 10;
      if (autoQ() && !GPU.soft) {
        const t = now;
        if (this.level < 2 && this.cost.length >= 30 && (c > 14 || g > 70) && t - this.changedAt > 6000) {
          this.set(this.level + 1, c > 14 ? `drawing took ${Math.round(c)} ms a frame` : `only ${Math.round(1000 / g)} frames a second`); this.goodSince = 0;
        } else if (this.level === 1 && this.cost.length >= 30 && c < 5 && g < 40) {
          this.goodSince = this.goodSince || t; if (t - this.goodSince > 30000 && t - this.changedAt > 60000) this.set(0, '');
        } else if (this.level === 2 && t - this.changedAt > 90000) this.set(1, 'trying again, smaller');
        else if (c >= 5 || g >= 40) this.goodSince = 0;
      }
      if (now - this.reportAt > 4000) { this.reportAt = now; report(); }
    },
  };
  function report() {
    const S = stats();
    try { window.dispatchEvent(new CustomEvent('beebo:gfx-load', { detail: { fps: S.fps, ms: S.ms, level: S.level, why: S.why, shown: S.ticking, on: S.level < 2 && GPU.webgl2, q: String(window.__SB_GFXQ || 'auto'), engine: 4, contexts: S.contexts, gpu: GPU.name, gpuClass: GPU.cls } })); } catch (e) {}
  }

  // ===================================================================================== randomness that can repeat
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hashStr = k => { let h = 2166136261; for (const ch of String(k)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const realRandom = Math.random;
  let seeded = null;
  // tests (window.__SB_SEED) and layouts set to "Same every time" (sb-design.js, on every screen shown) reseed the page's
  // randomness, so a shatter, a burst of sparks or a glitch plays out exactly the same each time
  function reseed(key) { seeded = mulberry(hashStr(key)); Math.random = seeded; }
  function unseed() { if (window.__SB_SEED != null) return; seeded = null; Math.random = realRandom; }
  if (window.__SB_SEED != null) reseed('test:' + window.__SB_SEED);
  const rand = () => Math.random();
  const seedNow = () => (seeded ? Math.floor(seeded() * 1e6) : Date.now());

  // ===================================================================================== the audio bus
  // who's talking (the commentary cams report it) and a tapped tempo (the Stream Deck's Tap tempo key, or the panel):
  // looks and idles read an envelope that rises fast and falls slowly, and a beat phase, from here
  const audio = {
    talk: {}, env: 0, bpm: 0, beat0: 0, taps: [],
    setTalk(map) { this.talk = map || {}; },
    get talking() { return Object.values(this.talk).some(Boolean); },
    level() { return this.env; },
    tap(at = nowMs()) { this.taps = this.taps.filter(x => at - x < 3000); this.taps.push(at); if (this.taps.length >= 3) { const d = []; for (let i = 1; i < this.taps.length; i++) d.push(this.taps[i] - this.taps[i - 1]); const avg = d.reduce((a, b) => a + b, 0) / d.length; this.setBpm(60000 / avg, at); } },
    setBpm(bpm, at = nowMs()) { bpm = Number(bpm) || 0; this.bpm = bpm > 0 ? Math.max(40, Math.min(220, Math.round(bpm))) : 0; this.beat0 = at; try { window.dispatchEvent(new CustomEvent('beebo:bpm', { detail: { bpm: this.bpm } })); } catch (e) {} },
    phase(at = nowMs()) { if (!this.bpm) return 0; const p = ((at - this.beat0) / (60000 / this.bpm)) % 1; return p < 0 ? p + 1 : p; },
    pulse(at = nowMs()) { if (!this.bpm) return 0; const p = this.phase(at); return Math.exp(-p * 7); },     // 1 on the beat, fading before the next
  };
  // the envelope and the beat run on the master clock only while someone talks, it's fading, or a tempo is set; they're
  // published as two page variables (--sb-aud, --sb-beat, 0–1) that the "Talks with the commentary" and "On the beat"
  // idles read
  let envAt = 0, envOff = null, lastAud = '', lastBeat = '';
  const setVar = (k, v, was) => { if (v !== was) H.style.setProperty(k, v); return v; };
  function envTick(now) {
    const dt = envAt ? Math.min(.1, (now - envAt) / 1000) : 0; envAt = now; const tgt = audio.talking ? 1 : 0;
    audio.env += (tgt - audio.env) * (1 - Math.exp(-dt * (tgt > audio.env ? 14 : 2.5))); if (!audio.talking && audio.env < .004) audio.env = 0;
    lastAud = setVar('--sb-aud', audio.env.toFixed(2), lastAud); lastBeat = setVar('--sb-beat', audio.pulse().toFixed(2), lastBeat);
    if (!audio.talking && !audio.env && !audio.bpm && envOff) { envOff(); envOff = null; envAt = 0; }
  }
  const envOn = () => { if (!envOff) envOff = every(envTick); };
  addEventListener('beebo:talk', e => { audio.setTalk(e.detail); envOn(); });
  addEventListener('beebo:tempo', e => { const d = e.detail || {}; if (d.tap) audio.tap(); else if ('bpm' in d) audio.setBpm(d.bpm); envOn(); });

  // ===================================================================================== physics
  // A small rigid-body solver for things that fall: gravity, air drag, spin, and a floor they bounce on (losing energy and
  // spin each time, sliding with friction). Worked out ahead of time into keyframes, so it plays smoothly with the Web
  // Animations API and costs nothing per frame. Bodies: { vx, vy (px/s), spin (deg/s), r (contact radius), floor (px below
  // the start the floor is) } → [{ t (0–1), x, y, rot }].
  const physics = {
    fall(b, o = {}) {
      const g = o.g ?? 2300, e = o.bounce ?? .34, fr = o.friction ?? .72, drag = o.drag ?? .35, T = o.T || 1.5, n = o.frames || 30, sub = 6, dt = T / (n * sub);
      let x = 0, y = 0, vx = b.vx || 0, vy = b.vy || 0, rot = 0, w = b.spin || 0; const out = [{ t: 0, x: 0, y: 0, rot: 0, hit: false }]; let hits = 0;
      for (let i = 1; i <= n; i++) {
        let hit = false;
        for (let k = 0; k < sub; k++) {
          vy += g * dt; const kd = Math.exp(-drag * dt); vx *= kd; vy *= kd; x += vx * dt; y += vy * dt; rot += w * dt;
          if (b.floor != null && y + (b.r || 0) > b.floor && vy > 0) {         // the floor: bounce, lose spin, slide
            y = b.floor - (b.r || 0); vy = -vy * e; vx *= fr; w = -w * .55 + vx * .4; hit = true; hits++;
            if (Math.abs(vy) < 60) vy = 0;
          }
        }
        out.push({ t: i / n, x, y, rot, hit });
      }
      out.hits = hits; return out;
    },
  };

  function stats() {
    return { engine: 'BeeboFX 4', level: gov.level, why: gov.why, fps: gov.fps || 0, ms: gov.ms || 0, p90: gov.p90 || 0, frame: frameNo, ticking: ticking ? 1 : 0,
      contexts: Object.values(CTX).filter(c => !c.lost).length, gpu: GPU.name, gpuClass: GPU.cls, soft: GPU.soft, webgl2: GPU.webgl2, offscreen: GPU.offscreen, bitmap: Object.values(CTX).some(c => c.bm),
      seeded: !!seeded, bpm: audio.bpm, talking: audio.talking };
  }

  window.BeeboFX4 = { version: '1.12.15', raf, caf, every, context, claim, fit, present, blank, onLost: f => lostFns.add(f), gov, GPU, reseed, unseed, rand, seedNow, audio, physics, stats,
    get now() { return lastTick || nowMs(); } };
})();
