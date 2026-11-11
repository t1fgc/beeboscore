/* BeeboScore (developed by Beebo) — the Overlay maker tab.
 *
 * Drop a finished, static PNG overlay and get an animated layout back. Everything to do with the
 * picture happens here, on a canvas:
 *   1. the PNG is checked (really a PNG, 20 MB at most, 16:9 or a smaller scoreboard bar, not a solid picture)
 *   2. its shapes are found (4 px cells, grown by 2 cells so a shape keeps its shadow and trim), and a bar that
 *      runs across the middle of the screen is cut into left / centre / right so each player's side moves alone
 *   3. its colours are read (k-means) to pick one of the five looks and the text colours
 *   4. every shape becomes three sprites: the cut-out, a blurred white glow (half size, 24 px padding), an outline
 *   5. the name / score / round / event spots are placed, and can be dragged and resized over a live preview
 * The server (/api/maker/*) checks every PNG again and writes the layout folder. Nothing leaves this PC.
 */
(() => {
  'use strict';
  const P = window.BeeboPanel, root = document.getElementById('mkRoot');
  if (!P || !root) return;
  const { api, toast, esc } = P;

  // ------------------------------------------------------------ constants
  const W = 1920, H = 1080, CELL = 4, GW = W / CELL, GH = H / CELL, PAD = 24, MAX_BYTES = 20 * 1024 * 1024, MAX_PIECES = 40;
  const FONTS = { 'Saira Condensed': 'saira-condensed-latin-800-normal.woff2', 'Chakra Petch': 'chakra-petch-latin-700-normal.woff2', 'Teko': 'teko-latin-700-normal.woff2',
    'Russo One': 'russo-one-latin-400-normal.woff2', 'Audiowide': 'audiowide-latin-400-normal.woff2', 'Bungee': 'bungee-latin-400-normal.woff2', 'Black Ops One': 'black-ops-one-latin-400-normal.woff2',
    'Racing Sans One': 'racing-sans-one-latin-400-normal.woff2', 'Bangers': 'bangers-latin-400-normal.woff2', 'Chewy': 'chewy-latin-400-normal.woff2', 'Comfortaa': 'comfortaa-latin-700-normal.woff2',
    'Rubik Bubbles': 'rubik-bubbles-latin-400-normal.woff2', 'Permanent Marker': 'permanent-marker-latin-400-normal.woff2', 'Cinzel': 'cinzel-latin-900-normal.woff2',
    'Shojumaru': 'shojumaru-latin-400-normal.woff2', 'Kaushan Script': 'kaushan-script-latin-400-normal.woff2', 'Metal Mania': 'metal-mania-latin-400-normal.woff2' };
  const MOODS = {
    ember: { name: 'Ember', says: 'Sparks, heat shimmer, a flash-in intro', font: { name: 'Saira Condensed', italic: true, upper: true, ls: 0.01 } },
    steel: { name: 'Steel', says: 'Hard slides, speed streaks, a cold shine', font: { name: 'Teko', italic: false, upper: true, ls: 0.03 } },
    neon: { name: 'Neon', says: 'Tube flicker, pixel dust, bright glow', font: { name: 'Audiowide', italic: false, upper: true, ls: 0.04 } },
    pop: { name: 'Pop', says: 'Bouncy pieces, stars and confetti', font: { name: 'Bangers', italic: false, upper: true, ls: 0.04 } },
    clean: { name: 'Clean', says: 'Soft wipes, a quiet glow, almost no extras', font: { name: 'Chakra Petch', italic: false, upper: true, ls: 0.02 } },
  };
  const SLOTS = { p1name: 'P1 name', p1score: 'P1 score', p2name: 'P2 name', p2score: 'P2 score', round: 'Round', event: 'Event' };
  const FX = { glow: 'Glow', shine: 'Shine sweep', edge: 'Edge light', idle: 'Idle motion', particles: 'Particles', mptag: 'Match point tags' };
  const SIDE = ['Centre', 'P1', 'P2'];
  // Made-up players for the demo buttons — never real people.
  const DEMO = { p1: { name: 'Rivetfox', team: 'BBO' }, p2: { name: 'Lumen Kai', team: '' }, long1: 'Quillfist the Unbroken', long2: 'Marrowind Saltcastle', round: 'Winners Finals', event: 'Ironside Weekly 12', firstTo: 3 };

  // ------------------------------------------------------------ small helpers
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const nextPaint = () => new Promise(r => setTimeout(r, 30));
  const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsv = c => { const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); let h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; };
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const toBlob = c => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not write a PNG.'))), 'image/png'));
  const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read a sprite.')); r.readAsDataURL(blob); });
  const mb = n => (n / 1048576).toFixed(1) + ' MB';

  // ------------------------------------------------------------ 1. checking the file
  /** → { bitmap, w, h, kind: 'full' | 'bar', scaled } or throws an Error whose message says how to fix it */
  async function checkFile(file) {
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1] || '';
    if (!/^png$/i.test(ext) || (file.type && file.type !== 'image/png')) {
      throw new Error(`That's ${ext ? 'a .' + ext.toLowerCase() + ' file' : 'not a PNG'}. The Overlay maker only takes PNGs — export the overlay as a PNG with a transparent background.`);
    }
    if (file.size > MAX_BYTES) throw new Error(`This PNG is ${mb(file.size)}. The limit is 20 MB — export it at 1920 × 1080.`);
    const head = new Uint8Array(await file.slice(0, 33).arrayBuffer());
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (head.length < 33 || sig.some((b, i) => head[i] !== b) || String.fromCharCode(...head.slice(12, 16)) !== 'IHDR') {
      throw new Error("This file is named .png but isn't a real PNG inside. Export it again as a PNG.");
    }
    const dv = new DataView(head.buffer), w = dv.getUint32(16), h = dv.getUint32(20);
    const says = `This PNG is ${w} × ${h}.`;
    if (!w || !h || w > 8192 || h > 8192) throw new Error(`${says} Use 1920 × 1080 with a transparent background, or just the scoreboard bar at its real size.`);
    const wide = Math.abs(w / h - 16 / 9) < 0.012;
    let kind;
    if (wide && w >= 1280) kind = 'full';
    else if (wide) throw new Error(`${says} That's too small to stay sharp on stream — export it at 1920 × 1080.`);
    else if (w <= W && h <= H / 2 && w >= 160 && h >= 24) kind = 'bar';
    else throw new Error(`${says} Use a 16:9 picture (1920 × 1080) with a transparent background, or just the scoreboard bar at its real size — up to 1920 wide and 540 tall.`);
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { throw new Error("This PNG couldn't be opened — it may be damaged. Export it again."); }
    return { bitmap, w, h, kind, scaled: kind === 'full' && (w !== W || h !== H) };
  }

  /** the picture on a 1920 × 1080 canvas: a full frame as it is, a bar centred at the top or the bottom */
  function compose(img, kind, place) {
    const c = canvas(W, H), cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingQuality = 'high';
    if (kind === 'full') cx.drawImage(img, 0, 0, W, H);
    else cx.drawImage(img, place.x, place.y);
    return c;
  }
  const barPlace = (w, h, pos, off) => ({ pos, off, w, h, x: Math.round((W - w) / 2), y: pos === 'bottom' ? H - h - off : off });

  /** how much of the picture is solid / visible */
  function coverage(px) {
    let solid = 0, seen = 0;
    for (let i = 3; i < px.length; i += 16) { const a = px[i]; if (a >= 250) solid++; if (a >= 10) seen++; }
    const n = px.length / 16;
    return { solid: solid / n, seen: seen / n };
  }

  // ------------------------------------------------------------ 2. finding the shapes
  function analyse(px, split) {
    const N = GW * GH, on = new Uint8Array(N), solid = new Uint8Array(N), tone = new Uint8Array(N * 4);   // tone: each solid cell's mean colour
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      let any = 0, sol = 0, r = 0, g = 0, b = 0, al = 0;
      for (let y = cy * CELL; y < cy * CELL + CELL; y++) { let o = (y * W + cx * CELL) * 4; for (let x = 0; x < CELL; x++, o += 4) { const a = px[o + 3]; if (a >= 10) any = 1; if (a >= 60) { sol++; r += px[o]; g += px[o + 1]; b += px[o + 2]; al += a; } } }
      const i = cy * GW + cx; on[i] = any;
      if (sol >= 12) { solid[i] = 1; tone[i * 4] = r / sol; tone[i * 4 + 1] = g / sol; tone[i * 4 + 2] = b / sol; tone[i * 4 + 3] = al / sol; }
    }
    // grow every shape by 2 cells, so a shape and its own shadow / trim / inner detail count as one
    const tmp = new Uint8Array(N), dil = new Uint8Array(N);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let v = 0; for (let d = -2; d <= 2 && !v; d++) { const xx = x + d; if (xx >= 0 && xx < GW && on[y * GW + xx]) v = 1; } tmp[y * GW + x] = v; }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let v = 0; for (let d = -2; d <= 2 && !v; d++) { const yy = y + d; if (yy >= 0 && yy < GH && tmp[yy * GW + x]) v = 1; } dil[y * GW + x] = v; }
    // label what's connected
    const lab = new Int32Array(N).fill(-1), comps = [], stack = [];
    for (let i = 0; i < N; i++) {
      if (!dil[i] || lab[i] >= 0) continue;
      const id = comps.length, c = { id, cells: 0, x0: GW, y0: GH, x1: -1, y1: -1 }; comps.push(c);
      lab[i] = id; stack.push(i);
      while (stack.length) {
        const j = stack.pop(), x = j % GW, y = (j - x) / GW;
        if (on[j]) { c.cells++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
          const k = yy * GW + xx; if (dil[k] && lab[k] < 0) { lab[k] = id; stack.push(k); }
        }
      }
    }
    // specks join the nearest real shape; too many shapes → the smallest join their neighbours
    const group = comps.map(c => c.id), alive = () => comps.filter(c => group[c.id] === c.id);
    const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
    const join = (a, b) => { for (let i = 0; i < group.length; i++) if (group[i] === a.id) group[i] = b.id; b.cells += a.cells; b.x0 = Math.min(a.x0, b.x0); b.y0 = Math.min(a.y0, b.y0); b.x1 = Math.max(a.x1, b.x1); b.y1 = Math.max(a.y1, b.y1); };
    const nearest = c => alive().filter(o => o !== c).map(o => [gap(c, o), o]).sort((a, b) => a[0] - b[0])[0];
    for (const c of comps.slice().sort((a, b) => a.cells - b.cells)) {
      if (c.cells >= 6 || alive().length < 2) continue;
      const n = nearest(c); if (n && n[0] <= 40) join(c, n[1]);
    }
    for (let list = alive(); list.length > MAX_PIECES - 6; list = alive()) { const c = list.sort((a, b) => a.cells - b.cells)[0], n = nearest(c); if (!n) break; join(c, n[1]); }

    // a shape that runs across the middle of the screen → left / centre / right
    const MID = GW / 2, parts = [], partOf = new Map();
    const isWide = c => split && c.x0 <= MID - 80 && c.x1 >= MID + 80;
    const cuttable = new Set(alive().filter(isWide).sort((a, b) => b.cells - a.cells).slice(0, 8));      // the 8 biggest at most, so the shape count stays in bounds
    for (const c of alive()) {
      const wide = cuttable.has(c);
      if (!wide) { partOf.set(c.id, { one: parts.length }); parts.push({ side: -1 }); continue; }
      const prof = new Int32Array(GW), sum = new Float64Array(GW * 3), cnt = new Int32Array(GW);
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
        const i = y * GW + x; if (!on[i] || group[lab[i]] !== c.id) continue;
        prof[x]++;
        if (solid[i]) { const o = ((y * CELL + 1) * W + x * CELL + 1) * 4; sum[x * 3] += px[o]; sum[x * 3 + 1] += px[o + 1]; sum[x * 3 + 2] += px[o + 2]; cnt[x]++; }
      }
      const col = x => (cnt[x] ? [sum[x * 3] / cnt[x], sum[x * 3 + 1] / cnt[x], sum[x * 3 + 2] / cnt[x]] : null);
      // Walking out from the middle of the screen, the cut goes at the first of: a gap in the shape, the place where the
      // middle part (a taller hub, a thinner neck) settles into the height of the side bars, or a change of colour.
      const cutFor = side => {
        const at = d => (side < 0 ? MID - 1 - d : MID + d), ext = side < 0 ? MID - c.x0 : c.x1 - MID + 1, lim = Math.min(110, ext - 20);
        const outer = []; for (let t = 0.4; t <= 0.9; t += 0.02) outer.push(prof[at(Math.round(ext * t))]);
        outer.sort((p, q) => p - q);
        const sideH = outer[outer.length >> 1], tol = Math.max(1, sideH * 0.12);
        const low = d => prof[at(d)] <= sideH * 0.6, like = d => Math.abs(prof[at(d)] - sideH) <= tol;
        if (low(0) && low(1)) return { d: 0, how: 'gap' };                      // two bars that nearly touch: no centre piece
        const hub = !(like(0) && like(1) && like(2) && like(3));
        for (let d = 4; d <= lim; d++) {
          if (low(d)) { let e = d; while (e < lim && low(e + 1)) e++; return { d: Math.round((d + e + 1) / 2), how: 'notch' }; }
          if (hub && like(d) && like(d + 1) && like(d + 2) && like(d + 3)) { for (let n = 0; n < 8 && d < lim && prof[at(d)] !== prof[at(d + 2)]; n++) d++; return { d, how: 'shape' }; }   // …and a step past the last sliver of the hub
        }
        if (!hub) for (let d = 8; d <= lim; d++) {
          const dc = k => { const p = col(at(k - 2)), q = col(at(k + 1)); return p && q ? dist(p, q) : 0; };
          if (dc(d) >= 45 && dc(d) >= dc(d + 1)) return { d, how: 'colour' };
        }
        return { d: 30, how: 'set' };
      };
      let L = cutFor(-1), R = cutFor(1);
      if (L.how !== 'set' && R.how === 'set') R = { ...L }; else if (R.how !== 'set' && L.how === 'set') L = { ...R };
      L = { x: MID - L.d }; R = { x: MID + R.d };
      partOf.set(c.id, { l: parts.length, c: parts.length + 1, r: parts.length + 2, cutL: L.x, cutR: R.x });
      parts.push({ side: 1 }, { side: 0 }, { side: 2 });
    }
    const cell = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if (lab[i] < 0) continue;
      const p = partOf.get(group[lab[i]]); if (!p) continue;
      if (p.one !== undefined) cell[i] = p.one;
      else { const x = i % GW; cell[i] = x < p.cutL ? p.l : x >= p.cutR ? p.r : p.c; }
    }
    // exact boxes, to the pixel
    for (const p of parts) Object.assign(p, { x0: W, y0: H, x1: -1, y1: -1, n: 0 });
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      const k = cell[cy * GW + cx]; if (k < 0) continue; const p = parts[k];
      for (let y = cy * CELL; y < cy * CELL + CELL; y++) { let o = (y * W + cx * CELL) * 4 + 3; for (let x = cx * CELL; x < cx * CELL + CELL; x++, o += 4) {
        if (!px[o]) continue; p.n++; if (x < p.x0) p.x0 = x; if (x > p.x1) p.x1 = x; if (y < p.y0) p.y0 = y; if (y > p.y1) p.y1 = y; } }
    }
    const keep = parts.map((p, i) => ({ ...p, i })).filter(p => p.n > 0).map(p => {
      const x = p.x0, y = p.y0, w = p.x1 - p.x0 + 1, h = p.y1 - p.y0 + 1, mid = x + w / 2;
      const side = p.side >= 0 ? p.side : (x < W / 2 && x + w > W / 2 && Math.abs(mid - W / 2) < Math.max(60, w * 0.2)) ? 0 : mid < W / 2 ? 1 : 2;
      return { was: p.i, x, y, w, h, side, area: p.n };
    }).sort((a, b) => a.x - b.x || a.y - b.y);
    const re = new Int16Array(parts.length).fill(-1); keep.forEach((p, i) => { re[p.was] = i; });
    for (let i = 0; i < N; i++) if (cell[i] >= 0) cell[i] = re[cell[i]];
    return { cell, solid, tone, pieces: keep.map(({ was, ...p }) => p) };
  }

  // ------------------------------------------------------------ 3. colours → palette, look
  function kmeans(pts, n, k) {
    let seed = 0x9e3779b9; const rnd = () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const at = i => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
    const cen = [at(n >> 1)], d2 = new Float64Array(n).fill(Infinity);
    while (cen.length < Math.min(k, n)) {                // k-means++: new centres start far from the ones we have
      const c = cen[cen.length - 1]; let tot = 0;
      for (let i = 0; i < n; i++) { const d = (pts[i * 3] - c[0]) ** 2 + (pts[i * 3 + 1] - c[1]) ** 2 + (pts[i * 3 + 2] - c[2]) ** 2; if (d < d2[i]) d2[i] = d; tot += d2[i]; }
      if (!tot) break;
      let r = rnd() * tot, pick = 0; for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { pick = i; break; } }
      cen.push(at(pick));
    }
    const own = new Uint8Array(n); let sums, cnt;
    for (let it = 0; it < 12; it++) {
      sums = cen.map(() => [0, 0, 0]); cnt = cen.map(() => 0);
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let c = 0; c < cen.length; c++) { const d = (pts[i * 3] - cen[c][0]) ** 2 + (pts[i * 3 + 1] - cen[c][1]) ** 2 + (pts[i * 3 + 2] - cen[c][2]) ** 2; if (d < bd) { bd = d; best = c; } }
        own[i] = best; cnt[best]++; sums[best][0] += pts[i * 3]; sums[best][1] += pts[i * 3 + 1]; sums[best][2] += pts[i * 3 + 2];
      }
      for (let c = 0; c < cen.length; c++) if (cnt[c]) cen[c] = sums[c].map(v => v / cnt[c]);
    }
    return { cen, cnt, own };
  }

  function readColours(px) {
    const max = Math.ceil(W / 4) * Math.ceil(H / 4), pts = new Float32Array(max * 3), xs = new Uint16Array(max);
    let n = 0, seen = 0, soft = 0, sat = 0, dark = 0, light = 0, grey = 0, lumSum = 0;
    // "solid" is measured against the picture's own most solid parts, so see-through glass panels still count as shapes, not as glow
    const hist = new Uint32Array(256); let vis = 0;
    for (let y = 1; y < H; y += 4) for (let x = 1; x < W; x += 4) { const a = px[(y * W + x) * 4 + 3]; if (a >= 10) { hist[a]++; vis++; } }
    let peak = 255; for (let acc = 0; peak > 10; peak--) { acc += hist[peak]; if (acc >= vis * 0.05) break; }
    const solidA = Math.max(40, Math.min(200, peak * 0.8));
    for (let y = 1; y < H; y += 4) for (let x = 1; x < W; x += 4) {
      const o = (y * W + x) * 4, a = px[o + 3]; if (a < 10) continue;
      seen++; if (a < solidA) { soft++; continue; }
      const c = [px[o], px[o + 1], px[o + 2]], v = hsv(c), l = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
      pts[n * 3] = c[0]; pts[n * 3 + 1] = c[1]; pts[n * 3 + 2] = c[2]; xs[n++] = x;
      sat += v[1] * v[2]; lumSum += l; if (l < 0.2) dark++; if (l > 0.72) light++; if (v[1] < 0.16 || v[2] < 0.12) grey++;
    }
    if (n < 24) {                                        // nearly all soft / see-through: read the soft pixels instead
      n = 0;
      for (let y = 1; y < H; y += 4) for (let x = 1; x < W; x += 4) { const o = (y * W + x) * 4; if (px[o + 3] < 10) continue; pts[n * 3] = px[o]; pts[n * 3 + 1] = px[o + 1]; pts[n * 3 + 2] = px[o + 2]; xs[n++] = x; }
      sat = 0; lumSum = 0; dark = light = grey = 0;
      for (let i = 0; i < n; i++) { const c = [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]], v = hsv(c), l = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; sat += v[1] * v[2]; lumSum += l; if (l < 0.2) dark++; if (l > 0.72) light++; if (v[1] < 0.16) grey++; }
    }
    if (!n) return null;
    const { cen, cnt, own } = kmeans(pts, n, 6);
    // per-side counts, then fold near-identical clusters together
    const left = cen.map(() => 0), right = cen.map(() => 0);
    for (let i = 0; i < n; i++) (xs[i] < W / 2 ? left : right)[own[i]]++;
    let cl = cen.map((c, i) => ({ c, n: cnt[i], l: left[i], r: right[i] })).filter(c => c.n > 0).sort((a, b) => b.n - a.n);
    const out = [];
    for (const c of cl) { const m = out.find(o => dist(o.c, c.c) < 22); if (m) { m.c = mix(m.c, c.c, c.n / (m.n + c.n)); m.n += c.n; m.l += c.l; m.r += c.r; } else out.push({ ...c }); }
    cl = out.map(c => ({ ...c, share: c.n / n, hsv: hsv(c.c), hex: hex(c.c) }));
    const vivid = c => c.hsv[1] * c.hsv[2] * (0.35 + Math.min(1, c.share * 6));
    const base = cl[0];
    const col = cl.filter(c => c.hsv[1] >= 0.28 && c.hsv[2] >= 0.35).sort((a, b) => vivid(b) - vivid(a));
    const lightest = cl.slice().sort((a, b) => lum(b.c) - lum(a.c))[0], darkest = cl.slice().sort((a, b) => lum(a.c) - lum(b.c))[0];
    const top = col.find(c => c !== base) || col[0];     // the main colour: the most vivid one that isn't simply the biggest area
    const baseC = top && top === base ? mix(base.c, [0, 0, 0], 0.72) : base.c;       // one-colour art: the banner goes darker than the art
    let accent = top ? top.c : (contrast(lightest.c, base.c) >= 2 ? lightest.c : lum(base.c) > 0.4 ? [24, 26, 34] : [226, 232, 242]);
    if (contrast(accent, baseC) < 1.35) accent = lum(baseC) > 0.4 ? mix(accent, [0, 0, 0], 0.45) : mix(accent, [255, 255, 255], 0.45);
    const aH = hsv(accent)[0], second = col.find(c => c !== top && hueGap(c.hsv[0], aH) >= 25);
    const accent2 = second ? second.c : mix(accent, [255, 255, 255], 0.45);
    const sideCol = k => col.filter(c => c[k] / Math.max(1, c.n) > 0.62 && c.share > 0.015).sort((a, b) => b[k] - a[k])[0];
    const c1 = sideCol('l'), c2 = sideCol('r'), sided = c1 && c2 && c1 !== c2 && hueGap(c1.hsv[0], c2.hsv[0]) >= 30;
    const hues = []; for (const c of col) if (c.share >= 0.04 && !hues.some(h => hueGap(h, c.hsv[0]) < 30)) hues.push(c.hsv[0]);
    const onAccent = contrast(accent, [17, 17, 17]) >= contrast(accent, [255, 255, 255]) ? '#111111' : '#ffffff';
    const stats = { sat: sat / n, lum: lumSum / n, dark: dark / n, light: light / n, grey: grey / n, soft: seen ? soft / seen : 0, hues: hues.length, accent: hsv(accent), base: hsv(base.c), baseLum: lum(base.c) };
    return {
      stats,
      palette: [...col.map(c => c.hex), ...cl.filter(c => !col.includes(c)).sort((a, b) => lum(b.c) - lum(a.c)).map(c => c.hex)].slice(0, 6),
      colors: { accent: hex(accent), accent2: hex(accent2), base: hex(baseC), p1: sided ? c1.hex : hex(accent), p2: sided ? c2.hex : hex(accent),
        stroke: hex(mix(darkest.c, [0, 0, 0], lum(darkest.c) > 0.12 ? 0.55 : 0)), onAccent, vtext: contrast(baseC, [255, 255, 255]) >= 3 ? '#ffffff' : '#111111' },
    };
  }

  /** which of the five looks suits these colours → { mood, why } */
  function pickMood(s) {
    const [h, as, av] = s.accent, vividAccent = as >= 0.45 && av >= 0.5;
    const warm = vividAccent && (h <= 58 || h >= 335), cool = vividAccent && h >= 150 && h < 335, acid = vividAccent && h > 58 && h < 150;
    const score = {
      ember: (warm ? 1.25 : 0) + s.dark * 0.7 + s.soft * 0.3 - s.light * 0.8 - (s.hues >= 3 ? 0.5 : 0),
      neon: ((cool || acid) && as >= 0.6 ? 0.95 : 0) + s.dark * 0.7 + s.soft * 1.3 + (av > 0.85 ? 0.2 : 0) - s.light * 1.2 - s.grey * 0.35 - (s.hues >= 3 ? 0.4 : 0),
      steel: s.grey * 1.5 + (1 - s.sat) * 0.5 + (vividAccent ? -0.5 : 0.35) - s.light * 0.6 - s.soft * 0.5,
      pop: (s.hues >= 3 ? 1.2 : s.hues === 2 ? 0.45 : 0) + s.sat * 1.3 + s.lum * 0.5 - s.dark * 0.9 - s.grey * 0.5,
      clean: s.light * 1.7 + (s.hues <= 1 ? 0.3 : 0) + s.grey * 0.25 - s.sat * 0.6 - s.dark * 0.9 - s.soft * 0.4,
    };
    const mood = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
    const why = {
      ember: 'warm colours on a dark base', neon: s.soft > 0.25 ? 'bright colours with soft, glowing edges' : 'bright cool colours on a dark base',
      steel: 'mostly greys and metal tones', pop: s.hues >= 3 ? 'several bright colours side by side' : 'bright, saturated colours', clean: 'light, flat colours',
    }[mood];
    return { mood, why, score };
  }

  // ------------------------------------------------------------ 5. where the text goes
  /** flat areas text could sit on: each run of one colour (a gradient counts as one) → its biggest inner rectangle, in px */
  function plates(a) {
    const N = GW * GH, id = new Int32Array(N).fill(-1), T = a.tone, out = [], st = [], has = new Set();
    const near = (i, j) => Math.abs(T[i * 4] - T[j * 4]) + Math.abs(T[i * 4 + 1] - T[j * 4 + 1]) + Math.abs(T[i * 4 + 2] - T[j * 4 + 2]) <= 72 && Math.abs(T[i * 4 + 3] - T[j * 4 + 3]) <= 56;
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (!a.solid[i] || a.cell[i] < 0 || id[i] >= 0) continue;
      const me = n++, piece = a.cell[i]; let cells = 0, x0 = GW, y0 = GH, x1 = -1, y1 = -1;
      id[i] = me; st.push(i);
      while (st.length) {
        const j = st.pop(), x = j % GW, y = (j - x) / GW; cells++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const k of [x > 0 ? j - 1 : -1, x < GW - 1 ? j + 1 : -1, j - GW, j + GW]) if (k >= 0 && k < N && a.solid[k] && a.cell[k] === piece && id[k] < 0 && near(j, k)) { id[k] = me; st.push(k); }
      }
      if (cells < 24) continue;
      // holes count as inside (text that's drawn on a plate, a score cell in another colour): between the area's first and last cell on the row and on the column
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, r0 = new Int32Array(bh).fill(GW), r1 = new Int32Array(bh).fill(-1), c0 = new Int32Array(bw).fill(GH), c1 = new Int32Array(bw).fill(-1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (id[y * GW + x] === me) { if (x < r0[y - y0]) r0[y - y0] = x; if (x > r1[y - y0]) r1[y - y0] = x; if (y < c0[x - x0]) c0[x - x0] = y; if (y > c1[x - x0]) c1[x - x0] = y; }
      const ht = new Int32Array(bw); let best = null;
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < bw; x++) ht[x] = x + x0 >= r0[y - y0] && x + x0 <= r1[y - y0] && y >= c0[x] && y <= c1[x] ? ht[x] + 1 : 0;
        const stack = [];
        for (let x = 0; x <= bw; x++) {
          const cur = x < bw ? ht[x] : 0; let start = x;
          while (stack.length && stack[stack.length - 1][1] > cur) { const [sx, sh] = stack.pop(), area = sh * (x - sx); if (!best || area > best.area) best = { area, x: x0 + sx, y: y - sh + 1, w: x - sx, h: sh }; start = sx; }
          if (cur && (!stack.length || stack[stack.length - 1][1] < cur)) stack.push([start, cur]);
        }
      }
      if (!best) continue;
      let own = 0; for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) if (id[y * GW + x] === me) own++;
      if (own / best.area < 0.6) continue;               // a ring or a glow around other shapes, not a plate
      out.push({ piece, side: a.pieces[piece].side, in: { x: best.x * CELL, y: best.y * CELL, w: best.w * CELL, h: best.h * CELL } }); has.add(piece);
    }
    a.pieces.forEach((p, i) => {                         // outlines and frames have nothing flat: use the shape's box, a little inset
      if (has.has(i) || p.w < 60 || p.h < 14) return;
      const ix = Math.round(p.w * 0.06), iy = Math.round(p.h * 0.14);
      out.push({ piece: i, side: p.side, in: { x: p.x + ix, y: p.y + iy, w: p.w - ix * 2, h: p.h - iy * 2 } });
    });
    return out;
  }

  function avgUnder(px, r) {
    let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
    const x0 = clamp(Math.round(r.x), 0, W - 1), x1 = clamp(Math.round(r.x + r.w), 1, W), y0 = clamp(Math.round(r.y), 0, H - 1), y1 = clamp(Math.round(r.y + r.h), 1, H);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const o = (y * W + x) * 4, a = px[o + 3]; sr += px[o] * a; sg += px[o + 1] * a; sb += px[o + 2] * a; sa += a; n++; }
    return n && sa ? { c: [sr / sa, sg / sa, sb / sa], cover: sa / n / 255 } : { c: [0, 0, 0], cover: 0 };
  }
  /** white or near-black, whichever reads better on what's under the spot (white over the game itself) */
  function textColour(px, r) {
    const u = avgUnder(px, r); if (u.cover < 0.35) return '#ffffff';
    const w = contrast(u.c, [255, 255, 255]), d = contrast(u.c, [16, 16, 20]);
    return d > w * 1.25 ? '#101014' : '#ffffff';
  }

  function autoSlots(px, a) {
    const cand = plates(a);
    const R = v => Math.round(v), slot = (r, align) => ({ x: R(r.x), y: R(r.y), w: Math.max(16, R(r.w)), h: Math.max(12, R(r.h)), align, on: true, cover: false, scale: 1 });
    const vmid = (r, h) => ({ ...r, y: r.y + (r.h - h) / 2, h });
    const apart = (p, q) => { const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y); return ox <= 0 || oy <= 0 || ox * oy < Math.min(p.w * p.h, q.w * q.h) * 0.3; };
    const out = {};
    const side = s => {
      const list = cand.filter(c => c.side === s), inner = s === 1 ? 1 : -1;       // inner: which way the middle of the screen is
      const plate = list.filter(c => c.in.w >= 120 && c.in.h >= 16).sort((x, y) => y.in.w * Math.min(y.in.h, 96) - x.in.w * Math.min(x.in.h, 96))[0];
      if (!plate) return null;
      const N = plate.in;
      const box = list.filter(c => c !== plate && apart(c.in, N) && c.in.h >= 18 && c.in.w >= 18 && c.in.w / c.in.h <= 2.6 && c.in.y + c.in.h / 2 > N.y - N.h && c.in.y + c.in.h / 2 < N.y + N.h * 2)
        .sort((x, y) => Math.abs(x.in.x + x.in.w / 2 - W / 2) - Math.abs(y.in.x + y.in.w / 2 - W / 2))[0];
      let nameR = N, scoreR;
      if (box) scoreR = box.in;
      else {
        // one plate for both: the score sits at the end nearest the middle — in a cell that's already drawn there in
        // another colour (found by walking along the plate from that end), else in a square-ish slice of the plate
        const span = Math.round(N.w * 0.5), m = [], edges = [0];
        for (let k = 0; k * 4 <= span; k++) { const x = inner > 0 ? N.x + N.w - 4 - k * 4 : N.x + k * 4; m.push(avgUnder(px, { x, y: N.y + N.h * 0.25, w: 4, h: N.h * 0.5 }).c); }
        const dc = k => (k >= 2 && k + 1 < m.length ? dist(m[k - 2], m[k + 1]) : 0);
        for (let k = 2; k < m.length - 1; k++) if (dc(k) >= 40 && dc(k) >= dc(k - 1) && dc(k) > dc(k + 1)) edges.push(k * 4 - 2);
        let from = 0, sw = clamp(N.h * 1.15, 44, N.w * 0.28);
        for (let e = 0; e + 1 < edges.length; e++) { const w = edges[e + 1] - edges[e]; if (w >= N.h * 0.6 && w <= N.h * 3.2) { from = edges[e]; sw = w; break; } }
        scoreR = { x: inner > 0 ? N.x + N.w - from - sw : N.x + from, y: N.y, w: sw, h: N.h };
        nameR = { x: inner > 0 ? N.x : N.x + from + sw, y: N.y, w: N.w - from - sw, h: N.h };
      }
      // a spot stays 6 px inside its plate, so "cover the text" has clean colour to copy from all round
      const pad = clamp(nameR.h * 0.3, 8, 18), nh = clamp(Math.min(nameR.h * 0.8, nameR.h - 12), 18, 84), sh = clamp(Math.min(scoreR.h * 0.86, scoreR.h - 12), 18, 120), sp = Math.max(6, scoreR.w * 0.08);
      return { name: vmid({ x: nameR.x + pad, y: nameR.y, w: nameR.w - pad * 2, h: nameR.h }, nh), score: vmid({ x: scoreR.x + sp, y: scoreR.y, w: scoreR.w - sp * 2, h: scoreR.h }, sh) };
    };
    const flip = r => ({ ...r, x: W - r.x - r.w });
    let s1 = side(1), s2 = side(2);
    if (s1 && !s2) s2 = { name: flip(s1.name), score: flip(s1.score) };
    if (s2 && !s1) s1 = { name: flip(s2.name), score: flip(s2.score) };
    if (!s1) {                                           // nothing to hang the text on: a classic top bar, next to the art
      const b = a.pieces.length ? { y: Math.min(...a.pieces.map(p => p.y)), y2: Math.max(...a.pieces.map(p => p.y + p.h)) } : { y: 20, y2: 80 };
      const y = clamp((b.y + b.y2) / 2 - 22, 8, H - 60);
      s1 = { name: { x: 250, y, w: 450, h: 44 }, score: { x: 716, y, w: 84, h: 44 } }; s2 = { name: flip(s1.name), score: flip(s1.score) };
    }
    out.p1name = slot(s1.name, 'left'); out.p1score = slot(s1.score, 'center'); out.p2name = slot(s2.name, 'right'); out.p2score = slot(s2.score, 'center');
    // the round goes on the centre shape; the event under it (or on a second centre shape)
    const mids = cand.filter(c => c.side === 0 && c.in.w >= 60 && c.in.h >= 14).sort((x, y) => y.in.w * y.in.h - x.in.w * x.in.h);
    const narrow = (r, max) => (r.w > max ? { ...r, x: r.x + (r.w - max) / 2, w: max } : r);
    if (mids[0]) {
      const C = mids[0].in, other = mids.find(c => c !== mids[0] && c.in.w >= 100 && apart(c.in, C));
      if (C.h >= 64 && !other) {
        out.round = slot(narrow({ x: C.x + 8, y: C.y + C.h * 0.1, w: C.w - 16, h: C.h * 0.46 }, 560), 'center');
        out.event = slot(narrow({ x: C.x + 8, y: C.y + C.h * 0.6, w: C.w - 16, h: C.h * 0.3 }, 560), 'center');
      } else {
        out.round = slot(narrow(vmid({ x: C.x + 8, y: C.y, w: C.w - 16, h: C.h }, clamp(Math.min(C.h * 0.84, C.h - 10), 14, 56)), 560), 'center');
        if (other) out.event = slot(narrow(vmid({ x: other.in.x + 8, y: other.in.y, w: other.in.w - 16, h: other.in.h }, clamp(other.in.h * 0.8, 14, 40)), 560), 'center');
      }
    } else {
      const l = out.p1score.x + out.p1score.w, r = out.p2score.x, y = out.p1name.y, h = Math.min(out.p1name.h, 34);
      if (l < r && r - l >= 140) out.round = slot({ x: l + 10, y: y + (out.p1name.h - h) / 2, w: r - l - 20, h }, 'center');
      else { const below = y < H / 2; out.round = slot({ x: W / 2 - 180, y: below ? out.p1name.y + out.p1name.h + 18 : out.p1name.y - 52, w: 360, h: 34 }, 'center'); }
    }
    if (!out.event) { const r = out.round, below = r.y < H / 2; out.event = { ...slot({ x: W / 2 - 180, y: below ? r.y + r.h + 8 : r.y - 30, w: 360, h: 22 }, 'center'), on: false }; }
    for (const k of Object.keys(out)) {
      const d = out[k]; d.x = clamp(d.x, 0, W - d.w); d.y = clamp(d.y, 0, H - d.h); d.color = textColour(px, d); d.auto = true;
      d.cover = d.on && inked(px, d);                    // text that's already drawn in the picture here gets painted over
    }
    return out;
  }

  // ------------------------------------------------------------ cover the text under a spot
  /** what "cover" paints at each pixel under a spot: the colours just outside it, blended across (the shape's own edge stays) */
  function coverFill(src, d, each) {
    const sample = (x, y, dx, dy) => {                   // the mean of 3 solid pixels walking outwards from (x, y)
      let r = 0, g = 0, b = 0, n = 0;
      for (let k = 1; k <= 3; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= W || yy >= H) break; const o = (yy * W + xx) * 4; if (src[o + 3] < 200) continue; r += src[o]; g += src[o + 1]; b += src[o + 2]; n++; }
      return n ? [r / n, g / n, b / n] : null;
    };
    const smooth = arr => arr.map((_, i) => { let s = [0, 0, 0], n = 0; for (let k = -3; k <= 3; k++) { const v = arr[i + k]; if (v) { s = s.map((q, j) => q + v[j]); n++; } } return n ? s.map(q => q / n) : null; });
    const x0 = clamp(d.x - 2, 0, W - 1), x1 = clamp(d.x + d.w + 2, 1, W), y0 = clamp(d.y - 2, 0, H - 1), y1 = clamp(d.y + d.h + 2, 1, H);
    let L = [], Rr = [], T = [], B = [];
    for (let y = y0; y < y1; y++) { L.push(sample(x0, y, -1, 0)); Rr.push(sample(x1 - 1, y, 1, 0)); }
    for (let x = x0; x < x1; x++) { T.push(sample(x, y0, 0, -1)); B.push(sample(x, y1 - 1, 0, 1)); }
    L = smooth(L); Rr = smooth(Rr); T = smooth(T); B = smooth(B);
    const all = [...L, ...Rr, ...T, ...B].filter(Boolean);
    if (!all.length) return;
    const mean = all.reduce((s, v) => s.map((q, j) => q + v[j]), [0, 0, 0]).map(q => q / all.length);
    const pair = (p, q) => (p && q ? mix(p, q, 0.5) : p || q), last = arr => arr[arr.length - 1];
    const cs = [pair(L[0], T[0]), pair(Rr[0], last(T)), pair(last(L), B[0]), pair(last(Rr), last(B))], corner = cs.every(Boolean) ? cs : null;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4; if (!src[o + 3]) continue;
      const tx = (x - x0) / Math.max(1, x1 - x0 - 1), ty = (y - y0) / Math.max(1, y1 - y0 - 1);
      const l = L[y - y0], r = Rr[y - y0], t = T[x - x0], b = B[x - x0];
      if (l && r && t && b && corner) {                  // all four sides known: a Coons patch, so gradients carry straight through
        const bl = mix(mix(corner[0], corner[1], tx), mix(corner[2], corner[3], tx), ty);
        each(o, [0, 1, 2].map(j => clamp(l[j] + (r[j] - l[j]) * tx + t[j] + (b[j] - t[j]) * ty - bl[j], 0, 255)));
        continue;
      }
      const hz = l && r ? mix(l, r, tx) : l || r, vt = t && b ? mix(t, b, ty) : t || b;
      each(o, hz && vt ? mix(hz, vt, 0.5) : hz || vt || mean);
    }
  }
  function applyCover(src, slots) {
    const list = Object.values(slots).filter(d => d && d.on !== false && d.cover);
    if (!list.length) return src;
    const px = new Uint8ClampedArray(src);
    for (const d of list) coverFill(src, d, (o, c) => { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; });
    return px;
  }
  /** is something (most likely text) already drawn under this spot? → a part of it, not all of it, stands out from its surroundings */
  function inked(src, d) {
    let n = 0, hit = 0;
    coverFill(src, d, (o, c) => { if (src[o + 3] < 200) return; n++; if (Math.abs(src[o] - c[0]) + Math.abs(src[o + 1] - c[1]) + Math.abs(src[o + 2] - c[2]) > 110) hit++; });
    return n > 200 && hit / n >= 0.03 && hit / n <= 0.6;
  }

  // ------------------------------------------------------------ 4. sprites
  /** the outline of everything that's solid, 3 px thick, worked out on the whole picture so cuts leave no seam */
  function edgeMap(px) {
    const b = new Uint8Array(W * H), t = new Uint8Array(W * H), e = new Uint8Array(W * H), r = 3;
    for (let i = 0, o = 3; i < b.length; i++, o += 4) b[i] = px[o] >= 110 ? 1 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!b[i]) continue; let v = x >= r && x < W - r ? 1 : 0; for (let d = -r; d <= r && v; d++) if (!b[i + d]) v = 0; t[i] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!b[i]) continue; let v = y >= r && y < H - r ? 1 : 0; for (let d = -r; d <= r && v; d++) if (!t[i + d * W]) v = 0; e[i] = v ? 0 : 255; }
    return e;
  }

  async function buildSprites(job, only) {
    const a = job.an, px = applyCover(job.px, job.S.slots);
    if (!job.edges) job.edges = edgeMap(job.px);
    const coverKey = p => Object.values(job.S.slots).filter(d => d.on !== false && d.cover && d.x < p.x + p.w && d.x + d.w > p.x && d.y < p.y + p.h && d.y + d.h > p.y).map(d => [d.x, d.y, d.w, d.h].join(',')).join('|');
    for (const [i, p] of a.pieces.entries()) {
      const key = coverKey(p);
      if (p.src && (only === 'art' ? p.key === key : false)) continue;
      const art = canvas(p.w, p.h), id = new ImageData(p.w, p.h), ed = p.edge ? null : new ImageData(p.w, p.h);
      for (let y = 0; y < p.h; y++) {
        const gy = (p.y + y) >> 2; let o = ((p.y + y) * W + p.x) * 4, q = y * p.w * 4;
        for (let x = 0; x < p.w; x++, o += 4, q += 4) {
          if (a.cell[gy * GW + ((p.x + x) >> 2)] !== i || !px[o + 3]) continue;
          id.data[q] = px[o]; id.data[q + 1] = px[o + 1]; id.data[q + 2] = px[o + 2]; id.data[q + 3] = px[o + 3];
          if (ed) { const e = job.edges[(p.y + y) * W + p.x + x]; if (e) { ed.data[q] = ed.data[q + 1] = ed.data[q + 2] = 255; ed.data[q + 3] = e; } }
        }
      }
      art.getContext('2d').putImageData(id, 0, 0);
      const blobs = { a: await toBlob(art) };
      if (ed) {
        const ec = canvas(p.w, p.h); ec.getContext('2d').putImageData(ed, 0, 0); blobs.e = await toBlob(ec);
        const gw = Math.ceil((p.w + PAD * 2) / 2), gh = Math.ceil((p.h + PAD * 2) / 2), gc = canvas(gw, gh), g = gc.getContext('2d');
        g.filter = 'blur(6px)';                          // half size: 6 px here is a 12 px glow on screen
        g.drawImage(art, PAD / 2, PAD / 2, p.w / 2, p.h / 2); g.drawImage(art, PAD / 2, PAD / 2, p.w / 2, p.h / 2);
        g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, gw, gh);
        blobs.g = await toBlob(gc);
      }
      const old = p.src;
      p.blobs = { ...(p.blobs || {}), ...blobs }; p.key = key;
      p.src = URL.createObjectURL(blobs.a);
      if (blobs.e) { p.edge = URL.createObjectURL(blobs.e); p.glow = URL.createObjectURL(blobs.g); }
      if (old) setTimeout(() => URL.revokeObjectURL(old), 4000);
    }
  }
  function dropSprites(job) { if (job && job.an) for (const p of job.an.pieces) for (const u of [p.src, p.glow, p.edge]) if (u) URL.revokeObjectURL(u); }

  // ------------------------------------------------------------ the tab
  const css = document.createElement('style');
  css.textContent = `
@font-face { font-family: 'MkHead'; src: url(/static/fonts/teko-latin-700-normal.woff2) format('woff2'); font-display: swap; }
@font-face { font-family: 'MkText'; font-weight: 500; src: url(/static/fonts/chakra-petch-latin-500-normal.woff2) format('woff2'); font-display: swap; }
@font-face { font-family: 'MkText'; font-weight: 700; src: url(/static/fonts/chakra-petch-latin-700-normal.woff2) format('woff2'); font-display: swap; }
body.mk-open .app { grid-template-columns: var(--nav-w) minmax(0, 1fr); }
body.mk-open aside.side { display: none; }
body.mk-open main { padding: 0; }
section.tab[data-tab="maker"] { max-width: none; gap: 0; }
.mk { --mat: #0e3d37; --mat-2: #0a2e2a; --mat-3: #14504a; --rule: rgba(190, 255, 226, .16); --rule-2: rgba(190, 255, 226, .07); --ink: #e8f6ee; --dim: #9ec7b9; --faint: #6c9a8c;
  --knife: #ff4f9f; --pencil: #58dcee; --blade: #f3e14a; --bad: #ff8d7a;
  font: 500 14px/1.45 'MkText', 'Segoe UI', system-ui, sans-serif; color: var(--ink); min-height: calc(100vh - var(--head-h)); padding: 22px 26px 40px;
  background-color: var(--mat);
  background-image: linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px), linear-gradient(var(--rule-2) 1px, transparent 1px), linear-gradient(90deg, var(--rule-2) 1px, transparent 1px);
  background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; background-position: -1px -1px; }
.mk * { box-sizing: border-box; }
.mk h1 { font: 700 46px/.9 'MkHead', 'Arial Narrow', sans-serif; letter-spacing: .01em; margin: 0; text-transform: uppercase; }
.mk h2 { font: 700 24px/1 'MkHead', 'Arial Narrow', sans-serif; letter-spacing: .03em; margin: 0 0 10px; text-transform: uppercase; color: var(--ink); display: flex; align-items: baseline; gap: 10px; }
.mk h2 small { font: 500 12px/1.2 'MkText', sans-serif; text-transform: none; letter-spacing: 0; color: var(--dim); }
.mk p { margin: 0; }
.mk-lead { color: var(--dim); max-width: 62ch; margin-top: 6px !important; }
.mk-top { display: flex; align-items: flex-end; gap: 18px; flex-wrap: wrap; margin-bottom: 18px; }
.mk-top .sp { flex: 1; }
.mk button, .mk select, .mk input { font: inherit; color: inherit; }
.mk-btn { border: 1px solid var(--rule); background: var(--mat-2); padding: 8px 14px; cursor: pointer; font-weight: 700; border-radius: 2px; white-space: nowrap; }
.mk-btn:hover { border-color: var(--ink); }
.mk-btn:focus-visible, .mk-chip:focus-visible, .mk-drop:focus-visible, .mk-spot:focus-visible, .mk input:focus-visible, .mk select:focus-visible { outline: 2px solid var(--blade); outline-offset: 2px; }
.mk-btn.go { background: var(--blade); border-color: var(--blade); color: #1c1a05; }
.mk-btn.go:hover { background: #fff27a; }
.mk-btn.sm { padding: 5px 10px; font-size: 12.5px; }
.mk-btn.warn { border-color: var(--bad); color: var(--bad); }
.mk-btn:disabled { opacity: .45; cursor: default; }

/* the drop zone: a sheet on the mat with crop marks at its corners */
.mk-drop { position: relative; display: grid; place-items: center; text-align: center; min-height: 340px; padding: 40px 24px; cursor: pointer; background: rgba(6, 30, 27, .55); border: 2px dashed var(--pencil); border-radius: 2px; width: 100%; }
.mk-drop::before, .mk-drop::after, .mk-stagewrap::before, .mk-stagewrap::after { content: ''; position: absolute; width: 22px; height: 22px; pointer-events: none; border: 0 solid var(--ink); opacity: .75; }
.mk-drop::before, .mk-stagewrap::before { left: -12px; top: -12px; border-width: 1px 0 0 1px; box-shadow: inset 8px 8px 0 -7px transparent; }
.mk-drop::after, .mk-stagewrap::after { right: -12px; bottom: -12px; border-width: 0 1px 1px 0; }
.mk-drop.over { border-style: solid; border-color: var(--blade); background: rgba(243, 225, 74, .08); }
.mk-drop b { display: block; font: 700 40px/1 'MkHead', sans-serif; text-transform: uppercase; letter-spacing: .02em; }
.mk-drop .size { margin-top: 14px; font-size: 15px; color: var(--ink); }
.mk-drop .size strong { color: var(--blade); font-weight: 700; font-variant-numeric: tabular-nums; }
.mk-drop .fine { margin-top: 6px; color: var(--dim); font-size: 13px; }
.mk-drop .pick { margin-top: 18px; display: inline-block; }
.mk-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.mk-err { margin-top: 16px; padding: 10px 14px; border-left: 3px solid var(--bad); background: rgba(255, 141, 122, .1); color: #ffd9d1; text-align: left; max-width: 70ch; }

/* the bench */
.mk-bench { display: grid; grid-template-columns: minmax(0, 1fr) 348px; gap: 26px; align-items: start; }
@media (max-width: 1060px) { .mk-bench { grid-template-columns: minmax(0, 1fr); } }
.mk-title { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.mk-title input[type=text] { flex: 1; min-width: 200px; background: var(--mat-2); border: 1px solid var(--rule); border-radius: 2px; padding: 9px 12px; font-weight: 700; font-size: 16px; }
.mk-meta { color: var(--dim); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.mk-stagewrap { position: relative; margin: 20px 0 0 30px; }
.mk-ruler { position: absolute; color: var(--dim); font-size: 10px; font-variant-numeric: tabular-nums; pointer-events: none; }
.mk-ruler.x { left: 0; right: 0; top: -20px; height: 14px; border-bottom: 1px solid var(--rule); background: repeating-linear-gradient(90deg, var(--dim) 0 1px, transparent 1px 6.25%) bottom / 100% 5px no-repeat; }
.mk-ruler.y { top: 0; bottom: 0; left: -30px; width: 24px; border-right: 1px solid var(--rule); background: repeating-linear-gradient(0deg, transparent 0 calc(11.1111% - 1px), var(--dim) calc(11.1111% - 1px) 11.1111%) right / 5px 100% no-repeat; }
.mk-ruler i { position: absolute; font-style: normal; }
.mk-ruler.x i { top: -3px; transform: translateX(3px); }
.mk-ruler.y i { right: 8px; transform: translateY(2px); }
.mk-ruler .mark { position: absolute; background: var(--knife); opacity: .9; }
.mk-ruler.x .mark { bottom: -1px; height: 3px; } .mk-ruler.y .mark { right: -1px; width: 3px; }
.mk-view { aspect-ratio: 16 / 9; overflow: hidden; outline: 1px solid var(--rule); }
.mk-view.zoom { overflow: auto; }
.mk-view.zoom .mk-stage { width: 200%; }
.mk-stagewrap.zoomed .mk-ruler { visibility: hidden; }
.mk-stage { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #101216; }
.mk-stage.bg-check { background: repeating-conic-gradient(#d9dde2 0 25%, #f4f5f7 0 50%) 0 0 / 24px 24px; }
.mk-stage.bg-arena { background: radial-gradient(ellipse 60% 34% at 50% 78%, #4a4f63 0, transparent 70%), linear-gradient(#171a26 0, #2a2f42 58%, #3b3a41 58.2%, #1d1c22 100%); }
.mk-stage.bg-bright { background: linear-gradient(#cfe4f2, #f3ead2 60%, #b9b29a 60.2%, #8f8a78); }
.mk-stage iframe { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; border: 0; transform-origin: 0 0; background: transparent; pointer-events: none; }
.mk-stage iframe.back { visibility: hidden; }
.mk-spots { position: absolute; inset: 0; }
.mk-spots.off { display: none; }
.mk-spot { position: absolute; border: 1px dashed var(--pencil); background: rgba(88, 220, 238, .07); cursor: move; touch-action: none; }
.mk-spot:hover { background: rgba(88, 220, 238, .14); }
.mk-spot.sel { border: 1px solid var(--knife); background: rgba(255, 79, 159, .1); z-index: 2; }
.mk-spot > span { position: absolute; left: -1px; bottom: 100%; font-size: 10px; font-weight: 700; line-height: 14px; padding: 0 5px; background: var(--pencil); color: #062a30; white-space: nowrap; pointer-events: none; }
.mk-spot.low > span { bottom: auto; top: 100%; }
.mk-spot.sel > span { background: var(--knife); color: #2a0416; }
.mk-spot i { position: absolute; width: 11px; height: 11px; background: #fff; border: 1px solid var(--knife); display: none; }
.mk-spot.sel i { display: block; }
.mk-spot i[data-h=nw] { left: -6px; top: -6px; cursor: nwse-resize; } .mk-spot i[data-h=ne] { right: -6px; top: -6px; cursor: nesw-resize; }
.mk-spot i[data-h=sw] { left: -6px; bottom: -6px; cursor: nesw-resize; } .mk-spot i[data-h=se] { right: -6px; bottom: -6px; cursor: nwse-resize; }
.mk-spot i[data-h=w] { left: -6px; top: calc(50% - 6px); cursor: ew-resize; } .mk-spot i[data-h=e] { right: -6px; top: calc(50% - 6px); cursor: ew-resize; }
.mk-spot i[data-h=n] { top: -6px; left: calc(50% - 6px); cursor: ns-resize; } .mk-spot i[data-h=s] { bottom: -6px; left: calc(50% - 6px); cursor: ns-resize; }
.mk-busy { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(8, 36, 32, .82); font: 700 30px/1 'MkHead', sans-serif; text-transform: uppercase; letter-spacing: .04em; z-index: 5; }
.mk .mk-read { margin: 8px 0 0 30px; min-height: 18px; color: var(--dim); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.mk-read b { color: var(--knife); }
.mk-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.mk-demo { margin: 12px 0 0 30px; }
.mk-demo .gap { width: 10px; }
.mk-chip { border: 1px solid var(--rule); background: var(--mat-2); padding: 5px 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; border-radius: 2px; }
.mk-chip:hover { border-color: var(--ink); }
.mk-chip.on { background: var(--ink); color: var(--mat-2); border-color: var(--ink); }
.mk-shapes { margin: 22px 0 0 30px; }
.mk-shapelist { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
.mk-shape { flex: none; width: 150px; background: var(--mat-2); border: 1px solid var(--rule); padding: 8px; }
.mk-shape .th { height: 56px; background: repeating-conic-gradient(#20544c 0 25%, #1a4a43 0 50%) 0 0 / 12px 12px; display: grid; place-items: center; overflow: hidden; }
.mk-shape img { max-width: 100%; max-height: 56px; display: block; }
.mk-shape .dim { font-size: 11px; color: var(--dim); margin: 6px 0; font-variant-numeric: tabular-nums; }
.mk-seg { display: flex; border: 1px solid var(--rule); border-radius: 2px; overflow: hidden; }
.mk-seg button { flex: 1; border: 0; background: transparent; padding: 4px 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; color: var(--dim); }
.mk-seg button + button { border-left: 1px solid var(--rule); }
.mk-seg button.on { background: var(--ink); color: var(--mat-2); }
.mk-tray { background: rgba(8, 40, 36, .78); border-top: 2px solid var(--ink); padding: 14px 14px 16px; margin-bottom: 14px; }
.mk-moods { display: grid; gap: 6px; }
.mk-mood { display: grid; grid-template-columns: 74px 1fr; gap: 10px; align-items: baseline; text-align: left; border: 1px solid var(--rule); background: transparent; padding: 7px 10px; cursor: pointer; border-radius: 2px; }
.mk-mood b { font: 700 22px/1 'MkHead', sans-serif; text-transform: uppercase; letter-spacing: .03em; }
.mk-mood span { font-size: 12px; color: var(--dim); }
.mk-mood:hover { border-color: var(--ink); }
.mk-mood.on { background: var(--ink); border-color: var(--ink); color: var(--mat-2); } .mk-mood.on span { color: #2f5a50; }
.mk-why { font-size: 12.5px; color: var(--dim); margin-top: 8px !important; }
.mk-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.mk-col { display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; padding: 3px; border: 1px solid transparent; }
.mk-col.armed { border-color: var(--knife); }
.mk-col input[type=color] { width: 30px; height: 24px; padding: 0; border: 1px solid var(--rule); background: none; cursor: pointer; flex: none; }
.mk-pal { display: flex; gap: 5px; margin-top: 10px; align-items: center; font-size: 12px; color: var(--dim); flex-wrap: wrap; }
.mk-pal button { width: 24px; height: 24px; border: 1px solid var(--rule); cursor: pointer; padding: 0; }
.mk-pal button:hover { border-color: #fff; }
.mk-field { display: grid; grid-template-columns: 96px 1fr; gap: 8px; align-items: center; margin-top: 8px; font-size: 12.5px; }
.mk-field select, .mk-field input[type=number] { background: var(--mat-2); border: 1px solid var(--rule); padding: 6px 8px; border-radius: 2px; width: 100%; }
.mk-field input[type=range], .mk-slot input[type=range] { accent-color: var(--blade); width: 100%; }
.mk-check { display: flex; align-items: center; gap: 7px; font-size: 12.5px; cursor: pointer; }
.mk-check input { accent-color: var(--blade); width: 15px; height: 15px; margin: 0; }
.mk-fx { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 10px; }
.mk-slot { border: 1px solid var(--rule); padding: 8px 9px; margin-top: 6px; cursor: pointer; }
.mk-slot.sel { border-color: var(--knife); }
.mk-slot .hd { display: flex; align-items: center; gap: 8px; }
.mk-slot .hd b { flex: 1; font-size: 13px; }
.mk-slot .hd input[type=color] { width: 26px; height: 22px; padding: 0; border: 1px solid var(--rule); background: none; }
.mk-slot .more { display: none; margin-top: 8px; gap: 8px; align-items: center; grid-template-columns: 34px 1fr auto; font-size: 12px; color: var(--dim); }
.mk-slot.sel .more { display: grid; }
.mk-slot.offed b { color: var(--faint); text-decoration: line-through; }
.mk-save { position: sticky; bottom: 0; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 0; margin-top: 4px; background: linear-gradient(transparent, var(--mat) 30%); }
.mk-save .note { color: var(--dim); font-size: 12.5px; }
.mk-made { margin-top: 34px; max-width: 900px; }
.mk-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--rule); flex-wrap: wrap; }
.mk-item .sw { width: 54px; height: 30px; flex: none; border: 1px solid var(--rule); }
.mk-item .nm { flex: 1; min-width: 160px; }
.mk-item .nm b { display: block; font-size: 15px; }
.mk-item .nm small { color: var(--dim); }
.mk-live { font-size: 11px; font-weight: 700; padding: 2px 8px; background: var(--blade); color: #1c1a05; }
.mk-empty { color: var(--dim); padding: 12px 0; border-top: 1px solid var(--rule); }
@media (prefers-reduced-motion: reduce) { .mk * { transition: none !important; } }
`;
  document.head.appendChild(css);

  root.innerHTML = `
<div class="mk">
  <div class="mk-top"><div><h1>Overlay maker</h1><p class="mk-lead">Drop a finished PNG overlay. It gets cut into its shapes, and comes back as an animated layout that moves the way the picture looks.</p></div><span class="sp"></span><button class="mk-btn sm" id="mkAgain" hidden>Use another PNG</button></div>
  <div id="mkDropWrap">
    <label class="mk-drop" id="mkDrop" tabindex="0">
      <input type="file" id="mkFile" accept="image/png,.png">
      <div><b>Drop a PNG overlay here</b>
        <p class="size">Recommended: <strong>1920 × 1080</strong> with a transparent background, or just the scoreboard bar at its real size.</p>
        <p class="fine">PNG only, 20 MB at most. The picture stays on this PC.</p>
        <span class="mk-btn go pick">Choose a PNG</span>
        <div class="mk-err" id="mkErr" role="alert" hidden></div></div>
    </label>
  </div>
  <div id="mkBench" hidden>
    <div class="mk-bench">
      <div>
        <div class="mk-title"><input type="text" id="mkName" maxlength="40" placeholder="Name this layout" aria-label="Layout name"><span class="mk-meta" id="mkMeta"></span></div>
        <div class="mk-row" id="mkPlace" hidden><span class="mk-meta">Where the bar sits</span><div class="mk-seg" style="width:150px"><button data-pos="top">Top</button><button data-pos="bottom">Bottom</button></div>
          <label class="mk-meta" style="display:flex;gap:6px;align-items:center">from the edge <input type="number" id="mkOff" min="0" max="500" step="2" style="width:74px;background:var(--mat-2);border:1px solid var(--rule);padding:4px 6px"> px</label></div>
        <div class="mk-stagewrap">
          <div class="mk-ruler x" id="mkRx"></div><div class="mk-ruler y" id="mkRy"></div>
          <div class="mk-view" id="mkView"><div class="mk-stage bg-arena" id="mkStage"><iframe title="Layout preview" tabindex="-1"></iframe><iframe class="back" title="" tabindex="-1" aria-hidden="true"></iframe><div class="mk-spots" id="mkSpots"></div><div class="mk-busy" id="mkBusy" hidden>Cutting out the shapes</div></div></div>
        </div>
        <p class="mk-read" id="mkRead"></p>
        <div class="mk-row mk-demo" id="mkDemo">
          <button class="mk-chip" data-demo="intro">Replay intro</button><button class="mk-chip" data-demo="p1">P1 scores</button><button class="mk-chip" data-demo="p2">P2 scores</button>
          <button class="mk-chip" data-demo="mp">Match point</button><button class="mk-chip" data-demo="final">Final game</button><button class="mk-chip" data-demo="win1">P1 wins</button><button class="mk-chip" data-demo="win2">P2 wins</button>
          <button class="mk-chip" data-demo="long">Long names</button><button class="mk-chip" data-demo="reset">Reset</button>
          <span class="gap"></span><button class="mk-chip on" id="mkShowSpots" aria-pressed="true">Text spots</button><button class="mk-chip" id="mkZoom" aria-pressed="false" title="Twice as big, to place text exactly">Zoom in</button>
          <div class="mk-seg" id="mkBg" title="What's behind the preview"><button data-bg="arena" class="on">Dark</button><button data-bg="bright">Bright</button><button data-bg="check">Checker</button></div>
        </div>
        <div class="mk-shapes"><h2>Shapes <small id="mkShapeNote"></small></h2><div class="mk-shapelist" id="mkShapes"></div>
          <label class="mk-check" style="margin-top:8px"><input type="checkbox" id="mkSplit"> Cut a bar that crosses the middle into left, centre and right</label></div>
      </div>
      <div>
        <div class="mk-tray"><h2>Look</h2><div class="mk-moods" id="mkMoods"></div><p class="mk-why" id="mkWhy"></p></div>
        <div class="mk-tray"><h2>Colours <small>read from the picture</small></h2><div class="mk-cols" id="mkCols"></div><div class="mk-pal" id="mkPal"></div></div>
        <div class="mk-tray"><h2>Text</h2>
          <div class="mk-field" style="margin-top:0"><span>Font</span><select id="mkFont"></select></div>
          <div class="mk-field"><span>Spacing</span><input type="range" id="mkLs" min="-0.05" max="0.3" step="0.01"></div>
          <div class="mk-row" style="margin-top:10px;gap:16px"><label class="mk-check"><input type="checkbox" id="mkItalic"> Slanted</label><label class="mk-check"><input type="checkbox" id="mkUpper"> All capitals</label></div>
          <div id="mkSlots" style="margin-top:12px"></div><p class="mk-why" id="mkCoverNote"></p>
          <div class="mk-row" style="margin-top:10px"><button class="mk-btn sm" id="mkMirror" title="Copy P1's spots to P2, flipped">Mirror P1 to P2</button><button class="mk-btn sm" id="mkReplace" title="Put every spot back where the maker first placed it">Place them again</button></div>
        </div>
        <div class="mk-tray"><h2>Effects</h2><div class="mk-fx" id="mkFx"></div>
          <div class="mk-field"><span>Set winner</span><select id="mkVic"><option value="own">This layout's own banner</option><option value="shattered">Ember splash</option><option value="off">Nothing</option></select></div></div>
      </div>
    </div>
    <div class="mk-save"><button class="mk-btn go" id="mkSaveLive">Save and go live</button><button class="mk-btn" id="mkSave">Save layout</button><span class="note" id="mkNote"></span></div>
  </div>
  <div class="mk-made"><h2>Layouts you've made</h2><div id="mkList"></div></div>
</div>`;

  // ------------------------------------------------------------ state
  let job = null, tplText = '', busy = false, sel = '', armed = 'accent', showSpots = true, demo, vicTimer = 0, front = 0, renderTimer = 0, renderSeq = 0;
  const frames = $$('#mkStage iframe'), stage = $('#mkStage'), spotsEl = $('#mkSpots');
  const S = () => job.S;
  // Cutting, sprite-making and saving take a moment and must not overlap (type a new distance, then click Save straight
  // away: the save has to wait for the re-cut, not be dropped or run on half-made sprites). They run one after another.
  let chain = Promise.resolve();
  const inTurn = fn => (...args) => { const run = chain.then(() => fn(...args)); chain = run.catch(() => {}); return run; };

  function demoReset() { demo = { n1: DEMO.p1.name, n2: DEMO.p2.name, s1: 0, s2: 0, win: 0, vic: false, vn: 0, long: false }; clearTimeout(vicTimer); }
  demoReset();
  const demoState = () => ({
    p1: { name: demo.long ? DEMO.long1 : demo.n1, team: DEMO.p1.team, score: demo.s1, loser: false, winner: demo.win === 1 },
    p2: { name: demo.long ? DEMO.long2 : demo.n2, team: DEMO.p2.team, score: demo.s2, loser: true, winner: demo.win === 2 },
    round: DEMO.round, event: DEMO.event, bestOf: 'FT' + DEMO.firstTo, bestOfText: 'First to ' + DEMO.firstTo, firstTo: DEMO.firstTo, isGrandFinals: false, game: 'Any game',
    victory: { show: demo.vic, side: demo.win, n: demo.vn }, custom: {},
  });
  const post = msg => { try { frames[front].contentWindow.postMessage({ makerDemo: true, ...msg }, location.origin); } catch {} };

  // ------------------------------------------------------------ preview
  async function template() { if (!tplText) tplText = await (await fetch('/static/maker-overlay.html', { cache: 'no-store' })).text(); return tplText; }
  function settingsOut() {
    const s = S(), slots = {};
    for (const [k, d] of Object.entries(s.slots)) slots[k] = { x: d.x, y: d.y, w: d.w, h: d.h, align: d.align, color: d.color, on: d.on !== false, cover: !!d.cover, scale: d.scale || 1 };
    return { title: (s.title || '').trim(), mood: s.mood, font: { ...s.font }, colors: { ...s.colors }, palette: s.palette.slice(0, 6), slots, fx: { ...s.fx }, victory: s.victory, glowPad: PAD,
      place: job.place ? { ...job.place } : null, split: s.split !== false, sides: job.an.pieces.map(p => p.side) };
  }
  function previewDoc(instant) {
    const cfg = { ...settingsOut(), title: 'Preview', pieces: job.an.pieces.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, side: p.side, src: p.src, glow: p.glow, edge: p.edge })) };
    const json = JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
    const shattered = cfg.victory === 'shattered';
    return tplText.replace('/*MAKER*/null/*MAKER*/', () => json).replace('__TITLE__', 'Preview').replace('__FONTFILE__', FONTS[cfg.font.name] || FONTS['Saira Condensed'])
      .replace('__VICTORY__', shattered ? 'shattered' : 'off')
      .replace('<body>', `<body><script>window.__MAKER_DEMO=true;${instant ? 'window.__SB_INSTANT=true;' : ''}<\/script>`)
      .replace('</body>', (shattered ? '<script src="/sb-perf.js"><\/script><script src="/sb-victory.js"><\/script>' : '') + '</body>');
  }
  /** redraws the preview in the hidden frame, then swaps it in (no flash) */
  function render(instant = true, wait = 140) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      if (!job || !job.an) return;
      const seq = ++renderSeq; await template();
      const back = 1 - front, f = frames[back];
      f.onload = () => {
        if (seq !== renderSeq) return;
        try { f.contentWindow.postMessage({ makerDemo: true, state: demoState() }, location.origin); } catch {}
        setTimeout(() => { if (seq !== renderSeq) return; frames[front].classList.add('back'); f.classList.remove('back'); frames[front].srcdoc = ''; front = back; }, instant ? 90 : 20);
      };
      f.srcdoc = previewDoc(instant);
    }, wait);
  }
  const scale = () => stage.clientWidth / W;
  function fitStage() { const k = scale(); for (const f of frames) f.style.transform = `scale(${k})`; }
  new ResizeObserver(fitStage).observe(stage);
  (() => {                                               // rulers: real pixel positions on the 1920 × 1080 frame
    $('#mkRx').innerHTML = [0, 240, 480, 720, 960, 1200, 1440, 1680].map(v => `<i style="left:${v / W * 100}%">${v}</i>`).join('') + '<span class="mark" hidden></span>';
    $('#mkRy').innerHTML = [0, 240, 480, 720, 960].map(v => `<i style="top:${v / H * 100}%">${v}</i>`).join('') + '<span class="mark" hidden></span>';
  })();

  // ------------------------------------------------------------ text spots: drag, resize, nudge
  /** zoomed in: bring the picked spot (or the art) to the middle of the view */
  function focusView() {
    const v = $('#mkView'); if (!v.classList.contains('zoom') || !job) return;
    const pcs = job.an.pieces, d = sel && S().slots[sel], k = scale();
    const b = d || { x: Math.min(...pcs.map(p => p.x)), y: Math.min(...pcs.map(p => p.y)), w: 0, h: Math.max(...pcs.map(p => p.y + p.h)) - Math.min(...pcs.map(p => p.y)) };
    v.scrollLeft = (d ? b.x + b.w / 2 : W / 2) * k - v.clientWidth / 2; v.scrollTop = (b.y + b.h / 2) * k - v.clientHeight / 2;
  }
  function coverNote() {
    const names = Object.entries(S().slots).filter(([, d]) => d.cover && d.on !== false).map(([k]) => SLOTS[k]);
    $('#mkCoverNote').textContent = names.length ? `Painted over what's already drawn in the picture under: ${names.join(', ')}. Pick a spot and untick "Cover the text under it" to keep it.` : '';
  }
  function drawSpots() {
    spotsEl.classList.toggle('off', !showSpots);
    spotsEl.innerHTML = Object.entries(S().slots).filter(([, d]) => d.on !== false).map(([k, d]) =>
      `<div class="mk-spot${k === sel ? ' sel' : ''}${d.y < 40 ? ' low' : ''}" data-k="${k}" tabindex="0" role="group" aria-label="${SLOTS[k]} spot" style="left:${d.x / W * 100}%;top:${d.y / H * 100}%;width:${d.w / W * 100}%;height:${d.h / H * 100}%"><span>${SLOTS[k]}</span>${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<i data-h="${h}"></i>`).join('')}</div>`).join('');
    readout();
  }
  function placeSpot(k) {
    const el = $(`.mk-spot[data-k="${k}"]`, spotsEl), d = S().slots[k]; if (!el) return;
    Object.assign(el.style, { left: d.x / W * 100 + '%', top: d.y / H * 100 + '%', width: d.w / W * 100 + '%', height: d.h / H * 100 + '%' });
    el.classList.toggle('low', d.y < 40);
    post({ slots: { [k]: { x: d.x, y: d.y, w: d.w, h: d.h } } });
    readout();
  }
  function readout() {
    const d = sel && S().slots[sel], mx = $('#mkRx .mark'), my = $('#mkRy .mark');
    mx.hidden = my.hidden = !d || d.on === false;
    if (!d || d.on === false) { $('#mkRead').textContent = showSpots ? 'Drag a spot to move it, pull a corner to resize it. Arrow keys nudge by 1 px (Shift: 10).' : ''; return; }
    Object.assign(mx.style, { left: d.x / W * 100 + '%', width: d.w / W * 100 + '%' }); Object.assign(my.style, { top: d.y / H * 100 + '%', height: d.h / H * 100 + '%' });
    $('#mkRead').innerHTML = `<b>${SLOTS[sel]}</b> — x ${d.x}, y ${d.y}, ${d.w} × ${d.h} px`;
  }
  function select(k) { sel = k; $$('.mk-spot', spotsEl).forEach(e => e.classList.toggle('sel', e.dataset.k === k)); $$('.mk-slot').forEach(e => e.classList.toggle('sel', e.dataset.k === k)); readout(); }
  /** a spot was moved / resized / toggled: recolour it if its colour was picked for it, redo covered art, redraw */
  const spotChanged = inTurn(async k => {
    if (!job) return;
    const d = S().slots[k];
    if (d.auto) { d.color = textColour(job.px, d); const inp = $(`.mk-slot[data-k="${k}"] input[type=color]`); if (inp) inp.value = d.color; }
    if (Object.values(S().slots).some(x => x.cover) || job.covered) { job.covered = Object.values(S().slots).some(x => x.cover && x.on !== false); await buildSprites(job, 'art'); }
    render(true, 60);
  });
  spotsEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.mk-spot'); if (!el || e.button) return;
    const k = el.dataset.k, d = S().slots[k], h = e.target.dataset.h || '', k0 = scale(), start = { x: e.clientX, y: e.clientY, d: { ...d } };
    select(k); el.setPointerCapture(e.pointerId); e.preventDefault();
    let moved = false;
    const move = ev => {
      const dx = Math.round((ev.clientX - start.x) / k0), dy = Math.round((ev.clientY - start.y) / k0), o = start.d;
      if (!dx && !dy && !moved) return; moved = true;
      let x = o.x, y = o.y, w = o.w, hh = o.h;
      if (!h) { x = o.x + dx; y = o.y + dy; if (Math.abs(x + w / 2 - W / 2) <= 6) x = Math.round(W / 2 - w / 2); }      // the middle of the screen is sticky
      else {
        if (h.includes('e')) w = o.w + dx; if (h.includes('s')) hh = o.h + dy;
        if (h.includes('w')) { w = o.w - dx; x = o.x + dx; } if (h.includes('n')) { hh = o.h - dy; y = o.y + dy; }
        if (w < 16) { if (h.includes('w')) x -= 16 - w; w = 16; } if (hh < 12) { if (h.includes('n')) y -= 12 - hh; hh = 12; }
      }
      d.x = clamp(x, -200, W - 8); d.y = clamp(y, -200, H - 8); d.w = clamp(w, 16, W); d.h = clamp(hh, 12, H);
      placeSpot(k);
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (moved) spotChanged(k); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  let nudgeT = 0;
  spotsEl.addEventListener('keydown', e => {
    const el = e.target.closest('.mk-spot'); if (!el) return;
    const k = el.dataset.k, d = S().slots[k], step = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return; e.preventDefault(); select(k);
    if (e.altKey) { d.w = clamp(d.w + mv[0], 16, W); d.h = clamp(d.h + mv[1], 12, H); } else { d.x = clamp(d.x + mv[0], -200, W - 8); d.y = clamp(d.y + mv[1], -200, H - 8); }
    placeSpot(k); clearTimeout(nudgeT); nudgeT = setTimeout(() => spotChanged(k), 350);
  });
  spotsEl.addEventListener('focusin', e => { const el = e.target.closest('.mk-spot'); if (el && el.dataset.k !== sel) select(el.dataset.k); });

  // ------------------------------------------------------------ the trays
  function drawTrays() {
    const s = S();
    $('#mkMoods').innerHTML = Object.entries(MOODS).map(([k, m]) => `<button class="mk-mood${s.mood === k ? ' on' : ''}" data-mood="${k}" aria-pressed="${s.mood === k}"><b>${m.name}</b><span>${m.says}</span></button>`).join('');
    $('#mkWhy').textContent = job.auto ? `Picked ${MOODS[job.auto.mood].name} for you: ${job.auto.why}.` : '';
    const names = { accent: 'Main', accent2: 'Second', base: 'Winner banner', p1: 'P1 glow', p2: 'P2 glow' };
    $('#mkCols').innerHTML = Object.entries(names).map(([k, n]) => `<label class="mk-col${armed === k ? ' armed' : ''}" data-col="${k}"><input type="color" value="${esc(s.colors[k])}" aria-label="${n} colour">${n}</label>`).join('');
    $('#mkPal').innerHTML = (s.palette.length ? '<span>From the picture</span>' : '') + s.palette.map(c => `<button data-pal="${esc(c)}" style="background:${esc(c)}" title="Use ${esc(c)} for the outlined colour" aria-label="Use ${esc(c)}"></button>`).join('');
    $('#mkFont').innerHTML = Object.keys(FONTS).map(f => `<option${f === s.font.name ? ' selected' : ''}>${f}</option>`).join('');
    $('#mkLs').value = s.font.ls; $('#mkItalic').checked = !!s.font.italic; $('#mkUpper').checked = s.font.upper !== false;
    $('#mkFx').innerHTML = Object.entries(FX).map(([k, n]) => `<label class="mk-check"><input type="checkbox" data-fx="${k}"${s.fx[k] !== false ? ' checked' : ''}> ${n}</label>`).join('');
    $('#mkVic').value = s.victory;
    $('#mkSlots').innerHTML = Object.entries(SLOTS).map(([k, n]) => { const d = s.slots[k]; return `<div class="mk-slot${k === sel ? ' sel' : ''}${d.on === false ? ' offed' : ''}" data-k="${k}">
      <div class="hd"><label class="mk-check" title="Show this text"><input type="checkbox" data-on${d.on !== false ? ' checked' : ''} aria-label="Show ${n}"></label><b>${n}</b>
        <div class="mk-seg" role="group" aria-label="${n} alignment">${['left', 'center', 'right'].map(a => `<button data-al="${a}" class="${d.align === a ? 'on' : ''}" title="Align ${a}">${a[0].toUpperCase()}</button>`).join('')}</div>
        <input type="color" value="${esc(d.color)}" aria-label="${n} colour"></div>
      <div class="more"><span>Size</span><input type="range" data-scale min="0.5" max="1.5" step="0.05" value="${d.scale || 1}" aria-label="${n} size"><label class="mk-check" title="Paint over text that's already drawn in the picture under this spot"><input type="checkbox" data-cover${d.cover ? ' checked' : ''}> Cover the text under it</label></div></div>`; }).join('');
    $('#mkSplit').checked = s.split !== false;
    coverNote();
  }
  function drawShapes() {
    const n = job.an.pieces.length;
    $('#mkShapeNote').textContent = `${n} cut out. Each one moves, glows and lights up on its own; a player's shapes turn gold when they win.`;
    $('#mkShapes').innerHTML = job.an.pieces.map((p, i) => `<div class="mk-shape" data-i="${i}"><div class="th"><img alt="Shape ${i + 1}" src="${p.src}"></div><div class="dim">${p.w} × ${p.h}</div>
      <div class="mk-seg" role="group" aria-label="Shape ${i + 1} belongs to">${[1, 0, 2].map(sd => `<button data-side="${sd}" class="${p.side === sd ? 'on' : ''}">${SIDE[sd]}</button>`).join('')}</div></div>`).join('');
  }
  function drawMeta() {
    $('#mkMeta').textContent = `${job.file} — ${job.kind === 'bar' ? `bar, ${job.raw.w} × ${job.raw.h}` : job.scaled ? `resized from ${job.raw.w} × ${job.raw.h}` : '1920 × 1080'}${job.name ? ' — editing a saved layout' : ''}`;
    $('#mkPlace').hidden = job.kind !== 'bar';
    if (job.kind === 'bar') { $$('#mkPlace [data-pos]').forEach(b => b.classList.toggle('on', b.dataset.pos === job.place.pos)); $('#mkOff').value = job.place.off; $('#mkOff').max = H - job.raw.h; }
  }
  const noteSave = t => { $('#mkNote').textContent = t || ''; };

  root.addEventListener('click', async e => {
    if (!job) return;
    const t = e.target, s = S();
    const mood = t.closest('[data-mood]');
    if (mood) { const was = MOODS[s.mood].font, cur = s.font; s.mood = mood.dataset.mood;
      if (cur.name === was.name) s.font = { ...MOODS[s.mood].font };                      // the look's own font follows, unless you picked another
      drawTrays(); demoReset(); render(false); return; }
    const col = t.closest('[data-col]'); if (col) { armed = col.dataset.col; $$('.mk-col').forEach(c => c.classList.toggle('armed', c === col)); }
    const pal = t.closest('[data-pal]'); if (pal) { setColour(armed, pal.dataset.pal); drawTrays(); render(); return; }
    const slotEl = t.closest('.mk-slot');
    if (slotEl) {
      const k = slotEl.dataset.k, d = s.slots[k], al = t.closest('[data-al]');
      if (al) { d.align = al.dataset.al; drawTrays(); render(); }
      if (k !== sel) select(k);
      return;
    }
    const side = t.closest('[data-side]');
    if (side) { const i = Number(side.closest('.mk-shape').dataset.i); job.an.pieces[i].side = Number(side.dataset.side); drawShapes(); render(); return; }
    const d = t.closest('[data-demo]'); if (d) return runDemo(d.dataset.demo);
    const bg = t.closest('[data-bg]'); if (bg) { stage.className = 'mk-stage bg-' + bg.dataset.bg; $$('#mkBg button').forEach(b => b.classList.toggle('on', b === bg)); return; }
    const pos = t.closest('[data-pos]'); if (pos && job.kind === 'bar' && pos.dataset.pos !== job.place.pos) return rePlace(pos.dataset.pos, job.place.off);
    if (t.id === 'mkZoom') { const on = $('#mkView').classList.toggle('zoom'); $('.mk-stagewrap').classList.toggle('zoomed', on); t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); t.textContent = on ? 'Zoom out' : 'Zoom in'; fitStage(); focusView(); return; }
    if (t.id === 'mkShowSpots') { showSpots = !showSpots; t.classList.toggle('on', showSpots); t.setAttribute('aria-pressed', showSpots); drawSpots(); return; }
    if (t.id === 'mkMirror') { for (const k of ['name', 'score']) { const a = s.slots['p1' + k], b = s.slots['p2' + k]; Object.assign(b, { x: W - a.x - a.w, y: a.y, w: a.w, h: a.h, scale: a.scale, on: a.on, align: a.align === 'left' ? 'right' : a.align === 'right' ? 'left' : 'center' }); if (b.auto) b.color = textColour(job.px, b); }
      drawTrays(); drawSpots(); await spotChanged('p2name'); return; }
    if (t.id === 'mkReplace') { s.slots = autoSlots(job.px, job.an); drawTrays(); drawSpots(); await spotChanged('p1name'); toast('Spots placed again'); return; }
    if (t.id === 'mkSave' || t.id === 'mkSaveLive') return save(t.id === 'mkSaveLive');
  });
  function setColour(k, v) {
    const c = S().colors; c[k] = v;
    if (k === 'accent') c.onAccent = contrast(rgb(v), [17, 17, 17]) >= contrast(rgb(v), [255, 255, 255]) ? '#111111' : '#ffffff';
    if (k === 'base') c.vtext = contrast(rgb(v), [255, 255, 255]) >= 3 ? '#ffffff' : '#111111';
  }
  root.addEventListener('input', e => {
    if (!job) return;
    const t = e.target, s = S();
    if (t.id === 'mkName') { s.title = t.value; return; }
    const col = t.closest('[data-col]'); if (col && t.type === 'color') { setColour(col.dataset.col, t.value); render(true, 200); return; }
    if (t.id === 'mkLs') { s.font.ls = Number(t.value); render(true, 200); return; }
    const slotEl = t.closest('.mk-slot');
    if (slotEl) {
      const d = s.slots[slotEl.dataset.k];
      if (t.type === 'color') { d.color = t.value; d.auto = false; render(true, 200); }
      if (t.dataset.scale !== undefined) { d.scale = Number(t.value); render(true, 200); }
    }
  });
  root.addEventListener('change', async e => {
    if (!job) return;
    const t = e.target, s = S();
    if (t.id === 'mkFont') { s.font.name = t.value; render(); return; }
    if (t.id === 'mkItalic') { s.font.italic = t.checked; render(); return; }
    if (t.id === 'mkUpper') { s.font.upper = t.checked; render(); return; }
    if (t.id === 'mkVic') { s.victory = t.value; demoReset(); render(); return; }
    if (t.dataset.fx) { s.fx[t.dataset.fx] = t.checked; render(); return; }
    if (t.id === 'mkOff' && job.kind === 'bar') return rePlace(job.place.pos, clamp(Math.round(Number(t.value) || 0), 0, H - job.raw.h));
    if (t.id === 'mkSplit') { s.split = t.checked; return reAnalyse(); }
    const slotEl = t.closest('.mk-slot');
    if (slotEl) {
      const k = slotEl.dataset.k, d = s.slots[k];
      if (t.dataset.on !== undefined) { d.on = t.checked; slotEl.classList.toggle('offed', !d.on); drawSpots(); coverNote(); await spotChanged(k); }
      if (t.dataset.cover !== undefined) { d.cover = t.checked; coverNote(); await spotChanged(k); drawShapes(); }
    }
  });

  // ------------------------------------------------------------ demo buttons
  function runDemo(what) {
    const ft = DEMO.firstTo, give = side => {
      if (demo.win) { demo.s1 = demo.s2 = 0; demo.win = 0; demo.vic = false; }
      const k = 's' + side; demo[k] = Math.min(ft, demo[k] + 1);
      if (demo[k] >= ft) { demo.win = side; if (S().victory !== 'off') { demo.vic = true; demo.vn++; clearTimeout(vicTimer); vicTimer = setTimeout(() => { demo.vic = false; post({ state: demoState() }); }, 4500); } }
    };
    clearTimeout(vicTimer);
    if (what === 'intro') { demo.vic = false; post({ replay: true }); post({ state: demoState() }); return; }
    if (what === 'p1') give(1); else if (what === 'p2') give(2);
    else if (what === 'mp') { demo.win = 0; demo.vic = false; demo.s1 = ft - 1; demo.s2 = Math.min(demo.s2, ft - 2); }
    else if (what === 'final') { demo.win = 0; demo.vic = false; demo.s1 = demo.s2 = ft - 1; }
    else if (what === 'win1' || what === 'win2') { const side = what === 'win1' ? 1 : 2; if (demo.win) { demo.s1 = demo.s2 = 0; demo.win = 0; demo.vic = false; post({ state: demoState() }); } demo['s' + side] = ft - 1; give(side); }
    else if (what === 'long') demo.long = !demo.long;
    else if (what === 'reset') demoReset();
    post({ state: demoState() });
  }

  // ------------------------------------------------------------ loading a picture
  const showErr = msg => { const el = $('#mkErr'); el.hidden = !msg; el.textContent = msg || ''; if (msg) toast(msg, true); };
  function setBusy(on, text) { busy = on; const b = $('#mkBusy'); b.hidden = !on; if (text) b.textContent = text; }
  function openBench(on) { $('#mkDropWrap').hidden = on; $('#mkBench').hidden = !on; $('#mkAgain').hidden = !on; if (on) fitStage(); }

  const takeFile = inTurn(async file => {
    if (!file) return;
    showErr('');
    let got;
    try { got = await checkFile(file); } catch (err) { return showErr(err.message); }
    try {
      const raw = { w: got.w, h: got.h };
      const place = got.kind === 'bar' ? barPlace(got.w, got.h, 'top', 0) : null;
      const src = compose(got.bitmap, got.kind, place);
      const px = src.getContext('2d').getImageData(0, 0, W, H).data, cov = coverage(px);
      if (cov.seen < 0.0004) throw new Error("This PNG is completely see-through — there's nothing in it to animate.");
      if (got.kind === 'full' && cov.solid > 0.9) throw new Error(`This picture is solid almost everywhere (${Math.round(cov.solid * 100)}% of it has no transparency), so it would cover the game. Export it with a transparent background, or drop just the scoreboard bar.`);
      await start({ file: file.name, kind: got.kind, scaled: got.scaled, raw, bitmap: got.bitmap, place, src, px, name: '' }, null);
    } catch (err) { setBusy(false); openBench(false); job = null; showErr(err.message || 'That picture could not be read.'); }
  });

  /** a fresh picture (saved = null) or a saved layout being edited (saved = its settings) */
  async function start(j, saved) {
    dropSprites(job); job = j; sel = ''; demoReset();
    openBench(true); setBusy(true, 'Cutting out the shapes'); await nextPaint();
    const split = saved ? saved.split !== false : true;
    j.an = analyse(j.px, split);
    if (!j.an.pieces.length) throw new Error("There's nothing solid enough in this picture to cut out.");
    const col = readColours(j.px);
    if (!col) throw new Error("This picture's colours couldn't be read.");
    j.auto = pickMood(col.stats); j.stats = col.stats;
    const title = (j.file || 'My overlay').replace(/\.png$/i, '').replace(/[-_]+/g, ' ').replace(/[<>"&]/g, '').trim().slice(0, 40) || 'My overlay';
    j.S = { title, mood: j.auto.mood, font: { ...MOODS[j.auto.mood].font }, colors: col.colors, palette: col.palette, slots: autoSlots(j.px, j.an),
      fx: { glow: true, shine: true, edge: true, idle: true, particles: true, mptag: true }, victory: 'own', split };
    if (saved) {                                         // what was saved wins over what the maker would pick
      const s = j.S; j.auto = null;
      Object.assign(s, { title: saved.title || title, mood: MOODS[saved.mood] ? saved.mood : s.mood, victory: saved.victory || 'own' });
      if (saved.font && FONTS[saved.font.name]) s.font = { name: saved.font.name, italic: !!saved.font.italic, upper: saved.font.upper !== false, ls: Number(saved.font.ls) || 0 };
      if (saved.colors) Object.assign(s.colors, saved.colors);
      if (Array.isArray(saved.palette) && saved.palette.length) s.palette = saved.palette;
      if (saved.fx) Object.assign(s.fx, saved.fx);
      for (const k of Object.keys(SLOTS)) if (saved.slots && saved.slots[k]) s.slots[k] = { ...s.slots[k], ...saved.slots[k], auto: false };
      if (Array.isArray(saved.sides) && saved.sides.length === j.an.pieces.length) j.an.pieces.forEach((p, i) => { if ([0, 1, 2].includes(saved.sides[i])) p.side = saved.sides[i]; });
    }
    j.covered = Object.values(j.S.slots).some(d => d.cover && d.on !== false);
    await nextPaint();
    await buildSprites(j);
    $('#mkName').value = j.S.title;
    drawMeta(); drawTrays(); drawShapes(); drawSpots(); noteSave('');
    setBusy(false); render(false, 0); focusView();
  }

  /** the shapes changed (the cut was switched on / off): cut again, keep the look and the spots */
  async function cutAgain() {
    setBusy(true, 'Cutting out the shapes'); await nextPaint();
    dropSprites(job); job.edges = null;
    job.an = analyse(job.px, S().split !== false);
    await buildSprites(job); drawShapes(); setBusy(false); render(false, 0);
  }
  const reAnalyse = inTurn(async () => { if (job) await cutAgain(); });
  /** a bar moved to the top / bottom (or closer to / further from the edge): the spots travel with it */
  const rePlace = inTurn(async (pos, off) => {
    if (!job || job.kind !== 'bar' || (pos === job.place.pos && off === job.place.off)) return;
    const was = job.place.y; job.place = barPlace(job.raw.w, job.raw.h, pos, off);
    job.src = compose(job.bitmap, 'bar', job.place); job.px = job.src.getContext('2d').getImageData(0, 0, W, H).data; job.srcBlob = null;
    for (const d of Object.values(S().slots)) d.y = clamp(d.y + job.place.y - was, -200, H - 8);
    drawMeta(); drawSpots(); await cutAgain();
  });

  // drop zone
  const drop = $('#mkDrop');
  $('#mkFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; takeFile(f); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#mkFile').click(); } });
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const section = root.closest('section') || root, shown = () => section.classList.contains('on');
  window.addEventListener('dragover', e => { if (!hasFiles(e) || !shown()) return; e.preventDefault(); drop.classList.add('over'); });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) drop.classList.remove('over'); });
  window.addEventListener('drop', e => {                 // anywhere on the tab counts — and the window never navigates to the file
    if (!hasFiles(e) || !shown()) return; e.preventDefault(); drop.classList.remove('over');
    const files = [...e.dataTransfer.files];
    if (files.length > 1) return showErr('Drop one PNG at a time.');
    if (job && !$('#mkBench').hidden) { closeJob(); }
    takeFile(files[0]);
  });
  function closeJob() { dropSprites(job); job = null; for (const f of frames) f.srcdoc = ''; openBench(false); showErr(''); }
  $('#mkAgain').addEventListener('click', closeJob);

  // ------------------------------------------------------------ save, go live, the list
  let saving = false;
  const save = goLive => { if (saving || !job) return; saving = true; return saveNow(goLive).finally(() => { saving = false; }); };
  const saveNow = inTurn(async goLive => {
    if (!job) return;
    const out = settingsOut();
    if (!out.title) { $('#mkName').focus(); return toast('Give the layout a name first.', true); }
    setBusy(true, 'Saving'); noteSave('');
    try {
      if (!job.srcBlob) job.srcBlob = await toBlob(job.src);
      const pieces = [];
      for (const p of job.an.pieces) pieces.push({ x: p.x, y: p.y, w: p.w, h: p.h, side: p.side, src: await toDataUrl(p.blobs.a), glow: await toDataUrl(p.blobs.g), edge: await toDataUrl(p.blobs.e) });
      const r = await api('/api/maker/save', { method: 'POST', body: { name: job.name || '', source: await toDataUrl(job.srcBlob), pieces, settings: out } });
      job.name = r.name; drawMeta();
      if (goLive) await api('/api/overlays/active', { method: 'POST', body: { name: r.name } });
      await loadList();                                  // the list below shows it (and "Live in OBS") before the note says so
      if (goLive) { toast(`Saved. Now live in OBS: ${r.title}`); noteSave(`Saved and live in OBS as "${r.title}".`); }
      else { toast(`Saved: ${r.title}`); noteSave(`Saved as "${r.title}". Pick it in the Layout menu at the top to put it live.`); }
    } catch (err) { toast(err.message, true); noteSave(''); }
    setBusy(false);
  });

  async function loadList() {
    let items = [];
    try { items = (await api('/api/maker/list')).items || []; } catch { return; }
    $('#mkList').innerHTML = items.length ? items.sort((a, b) => b.modified - a.modified).map(o => `<div class="mk-item" data-name="${esc(o.name)}">
      <span class="sw" style="background:linear-gradient(90deg, ${(o.colors && o.colors.length ? o.colors : ['#123', '#345']).map(esc).join(', ')})"></span>
      <span class="nm"><b>${esc(o.title)}</b><small>Changed ${new Date(o.modified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></span>
      ${o.active ? '<span class="mk-live">Live in OBS</span>' : '<button class="mk-btn sm" data-act="live">Go live</button>'}
      <button class="mk-btn sm" data-act="edit">Edit</button><button class="mk-btn sm" data-act="del">Delete</button></div>`).join('')
      : '<p class="mk-empty">Nothing yet. Drop a PNG above and save it — it shows up here and in the Layout menu at the top.</p>';
  }
  $('#mkList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || busy) return;
    const row = b.closest('.mk-item'), name = row.dataset.name, title = $('.nm b', row).textContent;
    try {
      if (b.dataset.act === 'live') { await api('/api/overlays/active', { method: 'POST', body: { name } }); toast(`Now live in OBS: ${title}`); loadList(); }
      else if (b.dataset.act === 'del') {
        if (!b.classList.contains('warn')) { b.classList.add('warn'); b.textContent = 'Delete for good?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('warn'); b.textContent = 'Delete'; } }, 4000); return; }
        await api('/api/maker/delete', { method: 'POST', body: { name } }); toast(`Deleted: ${title}`);
        if (job && job.name === name) { job.name = ''; drawMeta(); noteSave('This layout was deleted. Saving makes a new one.'); }
        loadList();
      } else if (b.dataset.act === 'edit') await edit(name);
    } catch (err) { toast(err.message, true); }
  });
  const edit = inTurn(async name => {
    showErr('');
    try {
      const r = await api('/api/maker/get?name=' + encodeURIComponent(name)), saved = r.settings || {};
      const blob = await (await fetch(r.source, { cache: 'no-store' })).blob(), full = await createImageBitmap(blob);
      if (full.width !== W || full.height !== H) throw new Error("This layout's picture is missing or the wrong size.");
      const pl = saved.place, isBar = pl && pl.w > 0 && pl.h > 0 && pl.w <= W && pl.h <= H / 2 && (pl.w !== W || pl.h !== H);
      let j;
      if (isBar) {                                       // get the bar itself back, so it can still be moved top / bottom
        const bitmap = await createImageBitmap(full, pl.x, pl.y, pl.w, pl.h), place = barPlace(pl.w, pl.h, pl.pos === 'bottom' ? 'bottom' : 'top', clamp(Number(pl.off) || 0, 0, H - pl.h));
        const src = compose(bitmap, 'bar', place);
        j = { kind: 'bar', raw: { w: pl.w, h: pl.h }, bitmap, place, src };
      } else j = { kind: 'full', raw: { w: W, h: H }, bitmap: full, place: null, src: compose(full, 'full') };
      Object.assign(j, { file: (saved.title || name) + '.png', scaled: false, name, px: j.src.getContext('2d').getImageData(0, 0, W, H).data });
      await start(j, saved);
      root.scrollIntoView({ block: 'start' });
    } catch (err) { setBusy(false); openBench(false); job = null; showErr(err.message); }
  });

  // the tab opening / closing: the bench gets the whole window (the OBS preview column steps aside)
  const sync = () => { const on = shown(); document.body.classList.toggle('mk-open', on); if (on) { fitStage(); loadList(); } };
  new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['class'] });
  sync();

  // for the tests (and for anyone poking at it in DevTools)
  window.BeeboMaker = { analyse, readColours, pickMood, autoSlots, checkFile, job: () => job, takeFile };
})();
