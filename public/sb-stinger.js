/* BeeboScore (developed by Beebo) — stingers (Testbuild 1.12.10).
 *
 *   BeeboStinger.play(host, o)     plays a stinger over a screen as it comes in (o = { k, colors, dur, text, logo })
 *   BeeboStinger.record(o)         the same stinger as a WebM video with see-through background, for OBS's own
 *                                  "Stinger" transition → Promise<{ blob, mime, point }> (point: the moment, in
 *                                  milliseconds, when the screen is fully covered — OBS calls it the transition point)
 *   BeeboStinger.KINDS             the catalogue (for the Layout Designer)
 *
 * Every stinger is drawn on a plain 2D canvas from a time between 0 and 1, so what you see on stream and the video you
 * export are frame-for-frame the same. The screen is fully covered at the half-way point.
 */
(() => {
  'use strict';
  if (window.BeeboStinger) return;
  const W = 1920, H = 1080;
  const KINDS = {
    shards: { label: 'Glass shards', emoji: '🔷', cat: 'Break', c: ['#0b0a08', '#e0a93b', '#f6dc96'], tip: 'Shards of glass fly in and lock together, then burst apart.' },
    slash: { label: 'Blade slash', emoji: '🗡️', cat: 'Strike', c: ['#0d0d12', '#ff2a3d', '#ffffff'], tip: 'Three blade strokes cut across and fill the screen, then cut away.' },
    ink: { label: 'Ink bloom', emoji: '🖋️', cat: 'Paint', c: ['#0b0b0d', '#7a1515', '#f2efe8'], tip: 'Blots of ink spread and swallow the screen, then pull back.' },
    iris: { label: 'Iris', emoji: '🎯', cat: 'Classic', c: ['#07070a', '#ffd27a', '#ffffff'], tip: 'A ring closes in to black, then opens on the new screen.' },
    panels: { label: 'Logo doors', emoji: '🚪', cat: 'Classic', c: ['#0b0a08', '#e0a93b', '#f6dc96'], tip: 'Two doors slam shut with your logo or name in the middle, then open.' },
    bars: { label: 'Speed bars', emoji: '🏁', cat: 'Strike', c: ['#05d9e8', '#ff2a6d', '#0b0016'], tip: 'Staggered bars race across in your colours.' },
    burst: { label: 'Star burst', emoji: '💥', cat: 'Break', c: ['#ffcf4a', '#ff5a1f', '#1a0b05'], tip: 'Rays explode out from the middle and flood the screen.' },
    hex: { label: 'Hex grid', emoji: '⬡', cat: 'Tech', c: ['#020812', '#39d5ff', '#ffffff'], tip: 'Hexagons flip in across the screen in a wave, then out.' },
  };
  // a small seeded random, so a stinger is the same every time
  const rnd = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, eo = t => 1 - Math.pow(1 - t, 3), ei = t => t * t * t;
  const clamp = v => Math.max(0, Math.min(1, v));
  // cover: 0 → 1 over the first half, 1 → 0 over the second (each kind shapes it its own way)
  const phase = t => t < .5 ? { c: t * 2, out: false } : { c: (1 - t) * 2, out: true };
  function shardsOf(seed) {
    const r = rnd(seed), pts = [], cols = 7, rows = 5;
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) pts.push([x / cols * W + (x && x < cols ? (r() - .5) * 180 : 0), y / rows * H + (y && y < rows ? (r() - .5) * 150 : 0)]);
    const tris = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const a = pts[y * (cols + 1) + x], b = pts[y * (cols + 1) + x + 1], c = pts[(y + 1) * (cols + 1) + x], d = pts[(y + 1) * (cols + 1) + x + 1];
      const flip = r() > .5;
      for (const t of flip ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]]) { const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3, ang = Math.atan2(cy - H / 2, cx - W / 2);
        tris.push({ t, cx, cy, dx: Math.cos(ang) * (900 + r() * 700), dy: Math.sin(ang) * (700 + r() * 500), rot: (r() - .5) * 3, delay: r() * .35, shade: r() }); }
    }
    return tris;
  }
  const memo = {};
  function frame(g, k, t, o) {
    const [c0, c1, c2] = o.colors; g.clearRect(0, 0, W, H);
    const { c, out } = phase(t);
    if (k === 'shards') {
      const tris = memo.sh || (memo.sh = shardsOf(7));
      for (const s of tris) {
        const p = clamp((c - s.delay * (1 - c)) / (1 - s.delay * .5)), e = out ? eo(p) : eo(p); if (p <= 0) continue;
        const m = 1 - e; g.save(); g.translate(s.cx + s.dx * m, s.cy + s.dy * m); g.rotate(s.rot * m); g.translate(-s.cx, -s.cy);
        g.beginPath(); g.moveTo(...s.t[0]); g.lineTo(...s.t[1]); g.lineTo(...s.t[2]); g.closePath();
        const gr = g.createLinearGradient(s.t[0][0], s.t[0][1], s.t[2][0], s.t[2][1]); gr.addColorStop(0, c0); gr.addColorStop(1, s.shade > .8 ? c1 : c0); g.fillStyle = gr; g.globalAlpha = Math.min(1, p * 1.6); g.fill();
        g.strokeStyle = c2; g.globalAlpha = .55 * p; g.lineWidth = 2; g.stroke(); g.restore();
      }
      g.globalAlpha = 1;
      if (c > .9) { const fl = (c - .9) * 10; g.fillStyle = c1; g.globalAlpha = fl * .25; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    } else if (k === 'slash') {
      const ang = -.42;
      for (let i = 0; i < 3; i++) {
        const p = clamp(c * 1.4 - i * .18); if (p <= 0) continue; const e = eo(p), wd = 660;
        g.save(); g.translate(W / 2, H / 2); g.rotate(ang); g.translate(0, (i - 1) * 600);
        const len = W * 2.6, x0 = out ? len / 2 - len * e : -len / 2;
        g.fillStyle = i === 1 ? c1 : c0; g.fillRect(x0, -wd / 2, len * e, wd);
        g.fillStyle = c2; g.fillRect(out ? x0 : x0 + len * e - 14, -wd / 2, 14, wd); g.restore();
      }
    } else if (k === 'ink') {
      const r = rnd(11); g.fillStyle = c0;
      for (let i = 0; i < 9; i++) {
        const x = r() * W, y = r() * H, d = r() * .3, p = clamp((c - d) / (1 - d)), R = ease(p) * (700 + r() * 500); if (R < 1) continue;
        g.beginPath(); for (let a = 0; a <= 64; a++) { const th = a / 64 * Math.PI * 2, wob = 1 + .12 * Math.sin(th * 5 + i) + .07 * Math.sin(th * 11 + i * 3); g.lineTo(x + Math.cos(th) * R * wob, y + Math.sin(th) * R * wob); } g.fill();
        if (p < 1) { g.fillStyle = c1; g.globalAlpha = .5 * (1 - p); g.beginPath(); g.arc(x, y, R * .55, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.fillStyle = c0; }
      }
      if (c > .85) { g.fillStyle = c0; g.globalAlpha = (c - .85) / .15; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    } else if (k === 'iris') {
      const R = Math.hypot(W, H) / 2 * (1 - ease(c)) * 1.02;
      g.fillStyle = c0; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, Math.max(0, R), 0, Math.PI * 2, true); g.fill('evenodd');
      if (R > 2) { g.strokeStyle = c1; g.lineWidth = 18 * (1 - c * .5); g.shadowColor = c1; g.shadowBlur = 40; g.beginPath(); g.arc(W / 2, H / 2, R, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0; g.strokeStyle = c2; g.lineWidth = 3; g.stroke(); }
    } else if (k === 'panels') {
      const e = out ? ease(c) : eo(c), x = W / 2 * e;
      const door = (x0, w, dir) => { const gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(dir > 0 ? 0 : 1, c0); gr.addColorStop(dir > 0 ? 1 : 0, '#000'); g.fillStyle = gr; g.fillRect(x0, 0, w, H); g.fillStyle = c1; g.fillRect(dir > 0 ? x0 + w - 8 : x0, 0, 8, H); };
      door(0, x, 1); door(W - x, x, -1);
      if (c > .75) {
        const a = (c - .75) / .25; g.globalAlpha = a; g.save(); g.translate(W / 2, H / 2); g.scale(.9 + a * .1, .9 + a * .1);
        if (o.logoImg && o.logoImg.complete && o.logoImg.naturalWidth) { const im = o.logoImg, s = Math.min(560 / im.naturalWidth, 300 / im.naturalHeight); g.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); }
        else { g.font = `900 150px 'Saira Condensed','Chakra Petch',sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c2; g.shadowColor = c1; g.shadowBlur = 30; g.fillText(String(o.text || 'VERSUS').toUpperCase().slice(0, 18), 0, 0); }
        g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
      }
    } else if (k === 'bars') {
      const n = 9, bh = H / n, r = rnd(5);
      for (let i = 0; i < n; i++) { const d = r() * .35, p = ease(clamp((c - d) / (1 - .35))); const w = W * 1.15 * p; g.fillStyle = [c0, c1, c2][i % 3];
        if (out) g.fillRect(W - w, i * bh - 1, w, bh + 2); else g.fillRect(0, i * bh - 1, w, bh + 2); }
    } else if (k === 'burst') {
      const e = ease(c), n = 22; g.save(); g.translate(W / 2, H / 2); g.rotate(t * 1.2);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, wd = Math.PI / n * (.3 + e * .75); g.fillStyle = i % 2 ? c0 : c1; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1400 * Math.min(1, e * 1.3), a - wd, a + wd); g.fill(); }
      g.restore(); g.fillStyle = c2; g.globalAlpha = Math.max(0, (e - .7) / .3); g.beginPath(); g.arc(W / 2, H / 2, 1300 * e, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      if (c > .9) { g.fillStyle = c2; g.fillRect(0, 0, W, H); }
    } else if (k === 'hex') {
      const R = 70, hw = R * Math.sqrt(3);
      for (let row = -1, y = 0; y < H + R * 2; row++, y = row * R * 1.5) for (let col = -1, x0 = 0; x0 < W + hw; col++, x0 = col * hw + (row % 2 ? hw / 2 : 0)) {
        const d = (Math.hypot(x0 - W / 2, y - H / 2) / Math.hypot(W / 2, H / 2)) * .55, p = ease(clamp((c - d) / .45)); if (p <= 0) continue;
        g.save(); g.translate(x0, y); g.scale(p, p); g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02); } g.closePath();
        g.fillStyle = c0; g.fill(); g.strokeStyle = p < 1 ? c2 : c1; g.lineWidth = 3; g.stroke(); g.restore();
      }
    }
  }
  const prep = o => { const d = KINDS[o.k] || KINDS.shards, c = o.colors && o.colors.length ? o.colors : d.c; const r = { ...o, k: KINDS[o.k] ? o.k : 'shards', colors: [c[0] || d.c[0], c[1] || d.c[1], c[2] || d.c[2]], dur: Math.max(.5, Math.min(4, Number(o.dur) || 1.2)) };
    if (r.logo) { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = r.logo; r.logoImg = im; } return r; };
  /** play it over `host` (a 1920 × 1080 stage) */
  function play(host, o0 = {}) {
    if (document.documentElement.classList.contains('sb-potato')) return null;
    const o = prep(o0), cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'bfx3-sting';
    cv.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;z-index:99990'; host.appendChild(cv);
    const g = cv.getContext('2d'), t0 = performance.now(), ms = o.dur * 1000;
    return new Promise(res => { const step = now => { const t = (now - t0) / ms; if (t >= 1 || !cv.isConnected) { cv.remove(); return res(); } frame(g, o.k, t, o); requestAnimationFrame(step); }; requestAnimationFrame(step); });
  }
  // ---------------------------------------------------------------- 1.12.11: the stinger's sound (made here, nothing downloaded)
  const SOUNDS = { shards: 'glass', slash: 'swish', ink: 'swell', iris: 'whoosh', panels: 'slam', bars: 'swish', burst: 'boom', hex: 'blips' };
  async function synth(k, dur, vol = .8) {
    const SR = 48000, len = Math.ceil((dur + .25) * SR), ac = new OfflineAudioContext(2, len, SR), mid = dur / 2;
    const out = ac.createGain(); out.gain.value = vol; out.connect(ac.destination);
    const noise = (t0, t1) => { const b = ac.createBuffer(1, Math.ceil((t1 - t0) * SR), SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = ac.createBufferSource(); n.buffer = b; n.start(t0); return n; };
    const env = (node, pts) => { const g = ac.createGain(); g.gain.setValueAtTime(0, 0); for (const [t, v] of pts) g.gain.linearRampToValueAtTime(v, Math.max(0, t)); node.connect(g); return g; };
    const whoosh = (t0, t1, f0, f1, q = 1.2, peak = .9) => { const n = noise(t0, t1), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t1); n.connect(bp); env(bp, [[t0, 0], [(t0 + t1) / 2, peak], [t1, 0]]).connect(out); };
    const thump = (t, f = 90, len = .35, peak = 1) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f * .5, t + len); o.start(t); o.stop(t + len + .05); env(o, [[t, 0], [t + .005, peak], [t + len, 0]]).connect(out); };
    const ring = (t, f, len, peak = .25) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.start(t); o.stop(t + len); env(o, [[t, 0], [t + .004, peak], [t + len, 0]]).connect(out); };
    const kind = SOUNDS[k] || 'whoosh';
    if (kind === 'glass') { whoosh(0, mid, 600, 4000, 1.5, .6); for (let i = 0; i < 9; i++) ring(mid + Math.random() * .05, 2500 + Math.random() * 4000, .25 + Math.random() * .4, .12); const h = noise(mid, mid + .4), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; h.connect(hp); env(hp, [[mid, 0], [mid + .01, .7], [mid + .4, 0]]).connect(out); whoosh(mid, dur, 3000, 500, 1.2, .5); }
    else if (kind === 'swish') { for (let i = 0; i < 3; i++) { const a = i * mid * .25; whoosh(a, a + mid * .6, 400, 6000, 2.5, .8); } thump(mid, 70, .3, .7); whoosh(mid, dur, 5000, 400, 2, .5); }
    else if (kind === 'swell') { whoosh(0, mid * 1.05, 120, 900, .7, 1); thump(mid, 50, .6, .8); whoosh(mid, dur, 900, 120, .7, .7); }
    else if (kind === 'whoosh') { whoosh(0, mid, 300, 2500, 1, .9); thump(mid, 60, .45, 1); whoosh(mid, dur, 2500, 300, 1, .7); }
    else if (kind === 'slam') { whoosh(0, mid * .9, 200, 1500, 1, .7); thump(mid * .97, 75, .5, 1); ring(mid * .97, 180, .7, .25); ring(mid * .97, 271, .6, .15); whoosh(mid * 1.1, dur, 1500, 200, 1, .6); }
    else if (kind === 'boom') { whoosh(0, mid, 200, 3000, .8, .8); thump(mid, 45, 1, 1.2); const n = noise(mid, mid + .9), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; n.connect(lp); env(lp, [[mid, 0], [mid + .02, .9], [mid + .9, 0]]).connect(out); }
    else if (kind === 'blips') { for (let i = 0; i < 12; i++) ring(i * mid / 12, 900 + i * 120, .06, .2); thump(mid, 80, .25, .6); for (let i = 0; i < 8; i++) ring(mid + i * (dur - mid) / 8, 2000 - i * 140, .05, .15); }
    return ac.startRendering();
  }
  // ---------------------------------------------------------------- 1.12.11: a WebM written here (VP9 + its alpha plane, the way OBS reads it)
  const vint = n => { for (let len = 1; len <= 8; len++) if (n < Math.pow(2, 7 * len) - 1) { const b = new Uint8Array(len); let v = n; for (let i = len - 1; i >= 0; i--) { b[i] = v & 255; v = Math.floor(v / 256); } b[0] |= 1 << (8 - len); return b; } throw new Error('too big'); };
  const idB = id => { const b = []; let v = id; while (v > 0) { b.unshift(v & 255); v = Math.floor(v / 256); } return Uint8Array.from(b); };
  const cat = parts => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
  const uintB = v => { const b = []; do { b.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0); return Uint8Array.from(b); };
  const el = (id, data) => { const d = data instanceof Uint8Array ? data : Array.isArray(data) ? cat(data) : typeof data === 'string' ? new TextEncoder().encode(data) : uintB(data); return cat([idB(id), vint(d.length), d]); };
  const f64 = v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
  const i16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v); return b; };
  function webm({ w, h, frames, audio, durMs }) {
    // frames: [{ ms, key, data, alpha }]; audio: { head, chunks: [{ ms, data }] } or null
    const tracks = [el(0xAE, [el(0xD7, 1), el(0x73C5, 1), el(0x83, 1), el(0x86, 'V_VP9'), el(0x9C, 0), el(0x55EE, 1), el(0xE0, [el(0xB0, w), el(0xBA, h), el(0x53C0, 1)])])];
    if (audio) tracks.push(el(0xAE, [el(0xD7, 2), el(0x73C5, 2), el(0x83, 2), el(0x86, 'A_OPUS'), el(0x9C, 0), el(0x63A2, audio.head), el(0x56AA, 6500000), el(0x56BB, 80000000), el(0xE1, [el(0xB5, f64(48000)), el(0x9F, 2)])]));
    const items = frames.map((f, i) => ({ ms: f.ms, v: true, f, i })).concat(audio ? audio.chunks.map(c => ({ ms: c.ms, v: false, c })) : []).sort((a, b) => a.ms - b.ms || (a.v ? -1 : 1));
    const blocks = [el(0xE7, 0)]; let prev = 0;
    for (const it of items) {
      const rel = Math.round(it.ms);
      if (it.v) { const f = it.f, parts = [el(0xA1, cat([Uint8Array.of(0x81), i16(rel), Uint8Array.of(0)  , f.data]))];
        if (f.alpha) parts.push(el(0x75A1, [el(0xA6, [el(0xEE, 1), el(0xA5, f.alpha)])]));
        if (!f.key) parts.push(cat([idB(0xFB), vint(2), i16(prev - rel)]));
        blocks.push(el(0xA0, parts)); prev = rel; }
      else blocks.push(el(0xA3, cat([Uint8Array.of(0x82), i16(rel), Uint8Array.of(0x80), it.c.data])));
    }
    const head = el(0x1A45DFA3, [el(0x4286, 1), el(0x42F7, 1), el(0x42F2, 4), el(0x42F3, 8), el(0x4282, 'webm'), el(0x4287, 4), el(0x4285, 2)]);
    const info = el(0x1549A966, [el(0x2AD7B1, 1000000), el(0x4D80, 'BeeboScore'), el(0x5741, 'BeeboScore stinger maker'), el(0x4489, f64(durMs))]);
    return new Blob([head, el(0x18538067, [info, el(0x1654AE6B, tracks), el(0x1F43B675, blocks)])], { type: 'video/webm' });
  }
  /** frame by frame (as fast as the computer can, the length and the transition point exact) — WebCodecs VP9, the alpha
   *  plane encoded as its own picture, the way Chrome and OBS keep transparency in a WebM */
  async function recordExact(o, fps) {
    const codec = 'vp09.00.10.08', base = { codec, width: W, height: H, bitrate: 10e6, framerate: fps, latencyMode: 'quality' };
    if (!window.VideoEncoder || !(await VideoEncoder.isConfigSupported(base)).supported) return null;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    const col = [], alp = []; let err = null;
    const mk = arr => new VideoEncoder({ output: c => { const d = new Uint8Array(c.byteLength); c.copyTo(d); arr.push({ key: c.type === 'key', data: d, ts: c.timestamp }); }, error: e => { err = e; } });
    const ec = mk(col), ea = mk(alp); ec.configure(base); ea.configure({ ...base, bitrate: 3e6 });
    const n = Math.round(o.dur * fps) + 1, ySize = W * H, I = new Uint8Array(ySize * 3 / 2); I.fill(128, ySize);
    for (let i = 0; i < n; i++) {
      if (err) throw err;
      const ts = Math.round(i * 1e6 / fps); frame(g, o.k, Math.min(1, i / (n - 1)), o);
      const vf = new VideoFrame(cv, { timestamp: ts, alpha: 'discard' }); ec.encode(vf, { keyFrame: i === 0 }); vf.close();
      const px = g.getImageData(0, 0, W, H).data; for (let p = 0, q = 3; p < ySize; p++, q += 4) I[p] = px[q];      // the alpha plane, full range
      const af = new VideoFrame(I, { format: 'I420', codedWidth: W, codedHeight: H, timestamp: ts }); ea.encode(af, { keyFrame: i === 0 }); af.close();
      if (ec.encodeQueueSize > 6 || ea.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
    }
    await ec.flush(); await ea.flush(); ec.close(); ea.close(); if (err) throw err;
    if (col.length !== alp.length) return null;
    const frames = col.map((c, i) => ({ ms: c.ts / 1000, key: c.key, data: c.data, alpha: alp[i].data }));
    let audio = null;
    if (o.sound && o.sound !== 'none' && window.AudioEncoder) {
      try {
        const buf = await synth(o.k, o.dur, o.vol ?? .8), chunks = []; let head = null;
        const ae = new AudioEncoder({ output: (c, m) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: c.timestamp / 1000, data: d }); if (m && m.decoderConfig && m.decoderConfig.description && !head) head = new Uint8Array(m.decoderConfig.description); }, error: e => { err = e; } });
        ae.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 });
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        for (let at = 0; at < buf.length; at += 960) { const m = Math.min(960, buf.length - at), d = new Float32Array(m * 2); d.set(L.subarray(at, at + m), 0); d.set(R.subarray(at, at + m), m);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(at / 48), data: d }); ae.encode(ad); ad.close(); }
        await ae.flush(); ae.close();
        if (!head) { head = new Uint8Array(19); head.set(new TextEncoder().encode('OpusHead')); const dv = new DataView(head.buffer); head[8] = 1; head[9] = 2; dv.setUint16(10, 312, true); dv.setUint32(12, 48000, true); }
        audio = { head, chunks: chunks.filter(c => c.ms <= o.dur * 1000 + 50) };
      } catch (e) { audio = null; }
    }
    const durMs = Math.round((n - 1) * 1000 / fps + 1000 / fps);
    return { blob: webm({ w: W, h: H, frames, audio, durMs }), mime: 'video/webm;codecs=vp9', point: Math.round((Math.floor((n - 1) / 2)) * 1000 / fps), dur: durMs, exact: true, sound: !!audio };
  }
  /** the stinger as a video with a see-through background, for OBS's own Stinger transition */
  async function record(o0 = {}) {
    const o = prep(o0); if (o.logoImg) await o.logoImg.decode().catch(() => {});
    if (o0.exact !== false) { try { const r = await recordExact(o, 60); if (r) return r; } catch (e) { console.warn('stinger: frame-by-frame recording failed, recording live instead', e); } }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('This computer can’t record video here');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.style.cssText = 'position:fixed;left:-4000px;top:0;width:192px;height:108px;pointer-events:none'; document.body.appendChild(cv);
    const g = cv.getContext('2d'), fps = 60, stream = cv.captureStream(0), track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 }), chunks = [];
    rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    rec.start();
    const n = Math.round(o.dur * fps) + 1, t0 = performance.now();
    let mid = 0; const half = Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      frame(g, o.k, Math.min(1, i / (n - 1)), o); if (track.requestFrame) track.requestFrame(); if (i === half) mid = performance.now() - t0;   // the covered moment, as recorded
      const due = t0 + (i + 1) * 1000 / fps, wait = due - performance.now(); await new Promise(r => setTimeout(r, Math.max(0, wait)));
    }
    g.clearRect(0, 0, W, H); if (track.requestFrame) track.requestFrame(); await new Promise(r => setTimeout(r, 120));
    rec.stop(); await done; cv.remove(); track.stop();
    return { blob: new Blob(chunks, { type: 'video/webm' }), mime, point: Math.round(mid || o.dur * 500), dur: Math.round(performance.now() - t0), exact: false, sound: false };
  }
  window.BeeboStinger = { play, record, synth, SOUNDS, frame: (g, k, t, o) => frame(g, k, t, prep(o || { k })), KINDS };
})();
