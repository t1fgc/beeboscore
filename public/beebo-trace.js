/*
 * BeeboScore (developed by Beebo): turns a picture of an overlay into layout pieces.
 *
 *   const r = BeeboTrace.analyze(imageData)          // finds every separate piece, its exact outline and colours,
 *                                                     // and guesses which ones are the player bars, the header and the
 *                                                     // commentator plate, and where the names and scores go
 *   BeeboTrace.cleanSlots(imageData, r)              // wipes placeholder text ("PLAYER 1", "0") out of those spots
 *   BeeboTrace.crop(imageData, r, region)            // that piece alone, on a see-through background (ImageData)
 *   BeeboTrace.design(r, { mode, srcs, whole })      // a Layout Designer layout (plain JSON, the .beebo format)
 *   BeeboTrace.flood(imageData, x, y, tolerance)     // the magic wand: the area of one colour around a point
 *
 * Used by the Layouts tab (drop a PNG) and the Layout Designer (auto-build, the trace wand, templates).
 * No network, no libraries: everything happens on this PC, in the page.
 */
(function (root) {
  'use strict';
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];       // E S W N
  const cd = (r1, g1, b1, r2, g2, b2) => Math.sqrt((r1 - r2) * (r1 - r2) * .3 + (g1 - g2) * (g1 - g2) * .59 + (b1 - b2) * (b1 - b2) * .11);
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lum = (r, g, b) => (.299 * r + .587 * g + .114 * b) / 255;

  // ------------------------------------------------------------------------------------- what is "the picture"
  // A PNG with a see-through background: anything not see-through. An opaque picture: anything that isn't the
  // commonest colour around its border.
  function foreground(img) {
    const { data, width: W, height: H } = img, n = W * H, m = new Uint8Array(n);
    let clear = 0; for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 24) clear++;
    if (clear > n * .06) { for (let i = 0; i < n; i++) m[i] = data[i * 4 + 3] > 40 ? 1 : 0; return { m, bg: null, seeThrough: true }; }
    const hist = new Map(), add = i => { const k = ((data[i * 4] >> 4) << 8) | ((data[i * 4 + 1] >> 4) << 4) | (data[i * 4 + 2] >> 4); const v = hist.get(k) || [0, 0, 0, 0]; v[0]++; v[1] += data[i * 4]; v[2] += data[i * 4 + 1]; v[3] += data[i * 4 + 2]; hist.set(k, v); };
    for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); } for (let y = 0; y < H; y++) { add(y * W); add(y * W + W - 1); }
    let best = null; for (const v of hist.values()) if (!best || v[0] > best[0]) best = v;
    const bg = [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
    for (let i = 0; i < n; i++) m[i] = cd(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], bg[0], bg[1], bg[2]) > 34 ? 1 : 0;
    return { m, bg, seeThrough: false };
  }

  // ------------------------------------------------------------------------------------- separate pieces
  function components(m, W, H) {
    const lab = new Int32Array(W * H), st = new Int32Array(W * H), regs = []; let id = 0;
    for (let i = 0; i < W * H; i++) {
      if (!m[i] || lab[i]) continue;
      id++; let sp = 0; st[sp++] = i; lab[i] = id; let area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, sx = 0, sy = 0;
      while (sp) {
        const j = st[--sp], x = j % W, y = (j / W) | 0; area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && m[j - 1] && !lab[j - 1]) { lab[j - 1] = id; st[sp++] = j - 1; }
        if (x < W - 1 && m[j + 1] && !lab[j + 1]) { lab[j + 1] = id; st[sp++] = j + 1; }
        if (y > 0 && m[j - W] && !lab[j - W]) { lab[j - W] = id; st[sp++] = j - W; }
        if (y < H - 1 && m[j + W] && !lab[j + W]) { lab[j + W] = id; st[sp++] = j + W; }
      }
      regs.push({ id, area, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: sx / area + .5, cy: sy / area + .5 });
    }
    return { lab, regs };
  }

  // ------------------------------------------------------------------------------------- exact outline
  // Walks the outside edge of a piece along pixel borders (the piece always on the right), then drops the points
  // that sit on a straight line. tol 0.6 px: the outline stays within a pixel of the picture.
  function outline(lab, W, H, reg) {
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === reg.id;
    let sx = -1; const sy = reg.y;
    for (let x = reg.x; x < reg.x + reg.w; x++) if (inside(x, sy)) { sx = x; break; }
    if (sx < 0) return [];
    const AL = [[0, -1], [0, 0], [-1, 0], [-1, -1]], AR = [[0, 0], [-1, 0], [-1, -1], [0, -1]];
    const pts = [[sx, sy]]; let x = sx + 1, y = sy, d = 0, guard = 0;
    while (!(x === sx && y === sy) && guard++ < 4e6) {
      let nd;
      if (inside(x + AL[d][0], y + AL[d][1])) nd = (d + 3) % 4;
      else if (inside(x + AR[d][0], y + AR[d][1])) nd = d;
      else nd = (d + 1) % 4;
      if (nd !== d) pts.push([x, y]);
      d = nd; x += DIRS[d][0]; y += DIRS[d][1];
    }
    return pts;
  }
  function dp(pts, tol) {               // Douglas–Peucker on an open run
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) { const dd = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (dd > md) { md = dd; mi = i; } }
      if (md > tol && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplify(poly, tol = .6) {   // a closed polygon: split at the point farthest from the first
    if (poly.length < 5) return poly;
    let far = 0, fd = 0; for (let i = 1; i < poly.length; i++) { const dd = Math.hypot(poly[i][0] - poly[0][0], poly[i][1] - poly[0][1]); if (dd > fd) { fd = dd; far = i; } }
    const a = dp(poly.slice(0, far + 1), tol), b = dp(poly.slice(far).concat([poly[0]]), tol);
    return a.slice(0, -1).concat(b.slice(0, -1));
  }

  // ------------------------------------------------------------------------------------- colours of a piece
  function colours(img, lab, reg) {
    const { data, width: W } = img; const q = new Map();
    let n = 0, r = 0, g = 0, b = 0, tn = 0, tr = 0, tg = 0, tb = 0, bn = 0, br = 0, bg = 0, bb = 0, en = 0, er = 0, eg = 0, eb = 0, inn = 0, ir = 0, ig = 0, ib = 0;
    const top = reg.y + reg.h * .22, bot = reg.y + reg.h * .78, step = reg.area > 400000 ? 2 : 1;
    for (let y = reg.y; y < reg.y + reg.h; y += step) for (let x = reg.x; x < reg.x + reg.w; x += step) {
      const i = y * W + x; if (lab[i] !== reg.id) continue;
      const R = data[i * 4], G = data[i * 4 + 1], B = data[i * 4 + 2];
      n++; r += R; g += G; b += B;
      if (y < top) { tn++; tr += R; tg += G; tb += B; } else if (y > bot) { bn++; br += R; bg += G; bb += B; }
      const edge = lab[i - 1] !== reg.id || lab[i + 1] !== reg.id || lab[i - W] !== reg.id || lab[i + W] !== reg.id;
      if (edge) { en++; er += R; eg += G; eb += B; }
      else if (lab[i - 4] === reg.id && lab[i + 4] === reg.id && lab[i - 4 * W] === reg.id && lab[i + 4 * W] === reg.id) { inn++; ir += R; ig += G; ib += B; }
      const k = ((R >> 4) << 8) | ((G >> 4) << 4) | (B >> 4), v = q.get(k) || [0, 0, 0, 0]; v[0]++; v[1] += R; v[2] += G; v[3] += B; q.set(k, v);
    }
    const av = (k, a, b2, c) => k ? [a / k, b2 / k, c / k] : null;
    let dom = null; for (const v of q.values()) if (!dom || v[0] > dom[0]) dom = v;
    const all = av(n, r, g, b), t = av(tn, tr, tg, tb) || all, bo = av(bn, br, bg, bb) || all, e = av(en, er, eg, eb) || all, i2 = av(inn, ir, ig, ib) || all;
    return { avg: all, top: t, bottom: bo, edge: e, inner: i2, dom: dom ? [dom[1] / dom[0], dom[2] / dom[0], dom[3] / dom[0]] : all };
  }

  // boxes of another colour inside a piece (a score box, a tag): solid, boxy, a good part of the bar's height
  function innerBoxes(img, lab, reg, col, diff = 52) {
    const { data, width: W } = img, x0 = reg.x, y0 = reg.y, w = reg.w, h = reg.h, m = new Uint8Array(w * h), [dr, dg, db] = col.dom;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x; if (lab[i] === reg.id && cd(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], dr, dg, db) > diff) m[y * w + x] = 1; }
    const { regs } = components(m, w, h);
    const out = regs.filter(b => b.area > reg.area * .012 && b.h > h * .34 && b.area / (b.w * b.h) > .55 && b.w < w * .6)
      .map(b => ({ x: b.x + x0, y: b.y + y0, w: b.w, h: b.h, fill: b.area / (b.w * b.h) }));
    return out.length || diff < 40 ? out : innerBoxes(img, lab, reg, col, 30);       // dark on dark: look again, more closely
  }
  // how tall the piece is in each column (finds where a bar ends and the header begins)
  function columns(lab, W, reg) {
    const c = new Float32Array(reg.w);
    for (let x = 0; x < reg.w; x++) { let n = 0; for (let y = reg.y; y < reg.y + reg.h; y++) if (lab[y * W + reg.x + x] === reg.id) n++; c[x] = n; }
    return c;
  }

  // ------------------------------------------------------------------------------------- the whole picture
  function analyze(img, opts = {}) {
    const W = img.width, H = img.height, fg = foreground(img), { lab, regs } = components(fg.m, W, H);
    const big = Math.max(120, W * H * .00012);
    const pieces = [], small = [];
    for (const r of regs) (r.area >= big && r.w > 6 && r.h > 6 ? pieces : small).push(r);
    for (const r of pieces) {
      r.poly = simplify(outline(lab, W, H, r), opts.tol || .6);
      r.col = colours(img, lab, r);
      r.boxes = innerBoxes(img, lab, r, r.col);
    }
    const res = { W, H, seeThrough: fg.seeThrough, bg: fg.bg ? hex(...fg.bg) : '', lab, pieces, small, roles: {}, slots: {} };
    classify(res);
    return res;
  }

  // which piece is which, and where the live text goes
  function classify(res) {
    const { W, H, pieces } = res, R = res.roles, S = res.slots;
    const band = (r, lo, hi) => r.cy >= H * lo && r.cy <= H * hi;
    const wide = pieces.filter(r => r.w > W * .12 && r.h < H * .2).sort((a, b) => b.area - a.area);
    const findBars = (lo, hi) => {
      const c = wide.filter(r => band(r, lo, hi));
      for (const a of c) for (const b of c) {
        if (a === b || a.cx >= W / 2 || b.cx <= W / 2) continue;
        if (Math.abs(a.cx - (W - b.cx)) < W * .09 && Math.abs(a.cy - b.cy) < H * .05 && Math.min(a.area, b.area) / Math.max(a.area, b.area) > .55) return [a, b];
      }
      return null;
    };
    let pair = findBars(0, .3) || findBars(.7, 1);
    if (pair) { R.p1 = pair[0]; R.p2 = pair[1]; }
    else {          // one long plate holding both players
      const one = pieces.filter(r => r.w > W * .55 && r.h < H * .2 && (band(r, 0, .3) || band(r, .7, 1))).sort((a, b) => b.area - a.area)[0];
      if (one) R.plate = one;
    }
    const barsY = R.p1 ? R.p1.cy : R.plate ? R.plate.cy : H * .05;
    const hdr = pieces.filter(r => r !== R.p1 && r !== R.p2 && r !== R.plate && Math.abs(r.cx - W / 2) < W * .07 && Math.abs(r.cy - barsY) < H * .12 && r.w < W * .4).sort((a, b) => b.area - a.area)[0];
    if (hdr) R.header = hdr;
    const comms = pieces.filter(r => !Object.values(R).includes(r) && Math.abs(r.cx - W / 2) < W * .1 && r.w > W * .1 && r.h < H * .12 && Math.abs(r.cy - barsY) > H * .5).sort((a, b) => b.area - a.area)[0];
    if (comms) R.comms = comms;
    for (const r of pieces) r.role = Object.keys(R).find(k => R[k] === r) || 'shape';

    // names and scores
    const inset = (b, kx, ky) => ({ x: b.x + b.w * kx, y: b.y + b.h * ky, w: b.w * (1 - 2 * kx), h: b.h * (1 - 2 * ky) });
    const barSlots = (bar, side) => {
      const inner = side === 1 ? (b => -(b.x + b.w)) : (b => b.x);          // the box closest to the middle of the screen
      const half = b => side === 1 ? b.x + b.w / 2 > bar.x + bar.w * .45 : b.x + b.w / 2 < bar.x + bar.w * .55;
      const sq = bar.boxes.filter(b => b.w / b.h > .55 && b.w / b.h < 2.1 && b.h > bar.h * .45 && half(b)).sort((a, b) => inner(a) - inner(b))[0];
      let score, guessed = false;
      if (sq) score = inset(sq, .08, .1);
      else { guessed = true; const s = bar.h * .9; score = { x: side === 1 ? bar.x + bar.w - s * 1.15 : bar.x + s * .15, y: bar.y + (bar.h - s) / 2, w: s, h: s }; }
      const pad = bar.w * .05, from = side === 1 ? bar.x + pad : score.x + score.w + bar.w * .03, to = side === 1 ? score.x - bar.w * .03 : bar.x + bar.w - pad;
      const name = { x: from, y: bar.y + bar.h * .2, w: Math.max(40, to - from), h: bar.h * .6 };
      return { name, score, guessed };
    };
    if (R.p1) { const a = barSlots(R.p1, 1), b = barSlots(R.p2, 2); S.p1name = a.name; S.p1score = a.score; S.p2name = b.name; S.p2score = b.score; res.guessedScores = a.guessed || b.guessed; }
    else if (R.plate) {
      const p = R.plate, mid = p.x + p.w / 2;
      // where each player's part of the plate ends: the first column (from the outside in) that is clearly shorter
      const col = columns(res.lab, W, p), top = Math.max(...col);
      let e1 = Math.round(p.w * .3); while (e1 < p.w / 2 && col[e1] > top * .75) e1++;
      let e2 = Math.round(p.w * .7); while (e2 > p.w / 2 && col[e2] > top * .75) e2--;
      // a score box sits in the inner half of its player's part, and is most of the plate's height
      const sq = p.boxes.filter(b => b.w / b.h > .55 && b.w / b.h < 2.1 && b.h > p.h * .45), cx = b => b.x + b.w / 2;
      const l = sq.filter(b => cx(b) < mid && cx(b) > p.x + e1 * .55).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0], r = sq.filter(b => cx(b) > mid && cx(b) < p.x + e2 + (p.w - e2) * .45).sort((a, b) => a.x - b.x)[0];
      const s = p.h * .8, y = p.y + p.h * .1;
      S.p1score = l ? inset(l, .08, .1) : { x: p.x + e1 - s * 1.3, y, w: s, h: s };
      S.p2score = r ? inset(r, .08, .1) : { x: p.x + e2 + s * .3, y, w: s, h: s };
      // the header: the part in the middle, as tall as the plate reaches there
      const cm = Math.round(p.w / 2), hh = col[cm]; let a = cm, z = cm;
      while (a > e1 && col[a - 1] >= hh * .85) a--; while (z < e2 && col[z + 1] >= hh * .85) z++;
      if (hh > p.h * .35 && z - a > p.w * .05) S.round = { x: p.x + a + (z - a) * .08, y: p.y + hh * .16, w: (z - a) * .84, h: hh * .64 };
      S.p1name = { x: p.x + p.w * .05, y: p.y + p.h * .2, w: S.p1score.x - p.x - p.w * .08, h: p.h * .6 };
      S.p2name = { x: S.p2score.x + S.p2score.w + p.w * .03, y: p.y + p.h * .2, w: p.x + p.w * .95 - (S.p2score.x + S.p2score.w + p.w * .03), h: p.h * .6 };
      res.guessedScores = !(l && r);
    }
    if (R.header) S.round = inset(R.header, .08, .18);
    if (R.comms) S.comms = inset(R.comms, .06, .18);
    for (const k of Object.keys(S)) { const b = S[k]; S[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(8, Math.round(b.w)), h: Math.max(8, Math.round(b.h)) }; }
    res.found = !!(R.p1 || R.plate);
  }

  // ------------------------------------------------------------------------------------- wipe placeholder text
  // Row by row across each name / score spot: the colour is blended from the spot's left edge to its right edge,
  // and any pixel that stands out from that blend (lettering) takes the blend. Plain, gradient and soft-textured
  // plates come out clean; see-through parts stay see-through.
  function cleanSlots(img, res, keys) {
    const { data, width: W } = img;
    for (const k of keys || ['p1name', 'p1score', 'p2name', 'p2score', 'round', 'comms']) {
      const b = res.slots[k]; if (!b) continue;
      const x0 = Math.max(1, b.x - 2), x1 = Math.min(W - 2, b.x + b.w + 1);
      for (let y = b.y; y < b.y + b.h; y++) {
        const at = x => { let r = 0, g = 0, bl = 0, a = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const i = ((y + dy) * W + x) * 4; r += data[i]; g += data[i + 1]; bl += data[i + 2]; a += data[i + 3]; n++; } return [r / n, g / n, bl / n, a / n]; };
        const L = at(x0), Rr = at(x1);
        for (let x = x0 + 1; x < x1; x++) {
          const t = (x - x0) / (x1 - x0), i = (y * W + x) * 4, want = [0, 1, 2, 3].map(c => L[c] + (Rr[c] - L[c]) * t);
          if (data[i + 3] < 30 && want[3] < 30) continue;
          if (cd(data[i], data[i + 1], data[i + 2], want[0], want[1], want[2]) > 26 || Math.abs(data[i + 3] - want[3]) > 60) { data[i] = want[0]; data[i + 1] = want[1]; data[i + 2] = want[2]; data[i + 3] = want[3]; }
        }
      }
    }
    return img;
  }

  // ------------------------------------------------------------------------------------- one piece alone
  function crop(img, res, reg) {
    const { data, width: W } = img, out = new ImageData(reg.w, reg.h);
    for (let y = 0; y < reg.h; y++) for (let x = 0; x < reg.w; x++) {
      const i = (reg.y + y) * W + reg.x + x, o = (y * reg.w + x) * 4;
      if (res.lab[i] !== reg.id) continue;
      out.data[o] = data[i * 4]; out.data[o + 1] = data[i * 4 + 1]; out.data[o + 2] = data[i * 4 + 2]; out.data[o + 3] = data[i * 4 + 3];
    }
    return out;
  }
  // everything too small to be its own piece (lettering, pips, sparks), on one see-through layer
  function details(img, res) {
    if (!res.small.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0; const ids = new Set();
    for (const r of res.small) { ids.add(r.id); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    const w = x1 - x0, h = y1 - y0, out = new ImageData(w, h), { data, width: W } = img;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * W + x0 + x; if (!ids.has(res.lab[i])) continue; const o = (y * w + x) * 4; for (let c = 0; c < 4; c++) out.data[o + c] = data[i * 4 + c]; }
    return { x: x0, y: y0, w, h, data: out };
  }

  // ------------------------------------------------------------------------------------- the magic wand
  function flood(img, px, py, tol = 30) {
    const { data, width: W, height: H } = img, si = (py * W + px) * 4;
    const R = data[si], G = data[si + 1], B = data[si + 2], A = data[si + 3];
    const m = new Uint8Array(W * H), st = [py * W + px]; m[py * W + px] = 1;
    let x0 = px, y0 = py, x1 = px, y1 = py, n = 0, r = 0, g = 0, b = 0;
    const ok = j => { const k = j * 4; return Math.abs(data[k + 3] - A) < 60 && (A < 30 || cd(data[k], data[k + 1], data[k + 2], R, G, B) <= tol); };
    while (st.length) {
      const j = st.pop(), x = j % W, y = (j / W) | 0; n++; r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && !m[k] && ok(k)) { m[k] = 1; st.push(k); }
    }
    const lab = new Int32Array(W * H); for (let i = 0; i < W * H; i++) if (m[i]) lab[i] = 1;
    const reg = { id: 1, area: n, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    return { ...reg, poly: simplify(outline(lab, W, H, reg), .8), color: hex(r / n, g / n, b / n), seeThrough: A < 30 };
  }

  // ------------------------------------------------------------------------------------- a layout from it all
  const norm = (poly, r) => poly.map(([x, y]) => [+((x - r.x) / r.w).toFixed(5), +((y - r.y) / r.h).toFixed(5)]);
  const solid = c => ({ type: 'solid', colors: [c], angle: 180 });
  function vecFill(c) {
    const t = hex(...c.top), b = hex(...c.bottom);
    return cd(...c.top, ...c.bottom) > 14 ? { type: 'linear', colors: [t, b], angle: 180 } : solid(hex(...c.inner));
  }
  function vecStroke(c, r) {
    const d = cd(...c.edge, ...c.inner);
    return d > 46 ? { color: hex(...c.edge), width: Math.max(1, Math.min(4, Math.round(Math.min(r.w, r.h) * .03))), glow: 0 } : { color: '#ffffff', width: 0, glow: 0 };
  }
  // the colour under a text spot decides black or white lettering
  function inkFor(img, b) {
    if (!img || !b) return '#ffffff';
    const { data, width: W } = img; let s = 0, n = 0;
    for (let y = b.y; y < b.y + b.h; y += 3) for (let x = b.x; x < b.x + b.w; x += 3) { const i = (y * W + x) * 4; if (data[i + 3] < 60) continue; s += lum(data[i], data[i + 1], data[i + 2]); n++; }
    return n && s / n > .58 ? '#14161d' : '#ffffff';
  }
  // the most colourful piece colour: the layout's accent (VS & Victory screens use it)
  function accent(res) {
    let best = '#ff5a1f', bs = -1;
    for (const r of res.pieces) { const [R, G, B] = r.col.dom, mx = Math.max(R, G, B), mn = Math.min(R, G, B), s = mx ? (mx - mn) / mx : 0, sc = s * Math.sqrt(r.area) * (mx / 255); if (sc > bs) { bs = sc; best = hex(R, G, B); } }
    return best;
  }

  /**
   * mode 'exact' : every piece keeps the picture's own pixels (srcs[id] = its cut-out), with its exact outline
   * mode 'redraw': every piece is redrawn with colours you can change (a blend from top to bottom, an edge line)
   * mode 'whole' : the picture stays one piece (opts.whole = its address); only the live text is added on top
   */
  function design(res, opts = {}) {
    const { mode = 'exact', srcs = {}, img = null, title = 'My layout', game = 'Any game' } = opts, els = [];
    const kx = 1920 / res.W, ky = kx, box = b => ({ x: Math.round(b.x * kx), y: Math.round(b.y * ky), w: Math.round(b.w * kx), h: Math.round(b.h * ky) });
    const still = { type: 'none', delay: 0 }, noStroke = { color: '#ffffff', width: 0, glow: 0 }, none = { type: 'none', colors: ['#000000'], angle: 180 };
    const NAMES = { p1: 'Player 1 bar', p2: 'Player 2 bar', plate: 'Scoreboard plate', header: 'Header', comms: 'Commentators', shape: 'Shape' };
    if (mode === 'whole') els.push({ kind: 'logo', name: 'Your picture', x: 0, y: 0, w: 1920, h: 1080, src: opts.whole, fit: 'stretch', pad: 0, radius: 0, fill: none, stroke: noStroke, enter: still });
    else {
      for (const r of res.pieces) {
        const b = box(r), pts = norm(r.poly, r), name = NAMES[r.role] || 'Shape', enter = r.role === 'p1' || r.role === 'p2' ? { type: 'slash', delay: r.role === 'p2' ? .08 : 0 } : still;
        if (mode === 'exact' && srcs[r.id]) els.push({ kind: 'logo', name, ...b, shape: 'custom', pts, src: srcs[r.id], fit: 'stretch', pad: 0, radius: 0, fill: none, stroke: noStroke, enter, traced: true });
        else {
          els.push({ kind: 'shape', name, ...b, shape: 'custom', pts, fill: vecFill(r.col), stroke: vecStroke(r.col, r), enter, traced: true });
          for (const ib of r.boxes) els.push({ kind: 'shape', name: name + ' · box', ...box(ib), shape: 'rect', radius: 0, fill: solid(hex(...(cutColour(img, ib) || r.col.edge))), stroke: noStroke, enter, traced: true });
        }
      }
      if (opts.details && opts.details.src) els.push({ kind: 'logo', name: 'Small details', ...box(opts.details), src: opts.details.src, fit: 'stretch', pad: 0, radius: 0, fill: none, stroke: noStroke, enter: still });
    }
    const font = (ink, scale = 1) => ({ family: opts.font || 'saira', color: solid(ink), size: scale, italic: false, upper: true });
    const T = (k, text, name, align = 'center', scale = 1) => { const b = res.slots[k]; if (!b) return; els.push({ kind: 'text', name, text, ...box(b), align, fill: none, stroke: noStroke, font: font(inkFor(img, b), scale), enter: { type: 'fade', delay: .2 } }); };
    T('p1name', '{p1.name}', 'P1 name'); T('p1score', '{p1.score}', 'P1 score', 'center', 1.05);
    T('p2name', '{p2.name}', 'P2 name'); T('p2score', '{p2.score}', 'P2 score', 'center', 1.05);
    T('round', '{round}', 'Round', 'center', .8); T('comms', '{c1.name}   /   {c2.name}', 'Commentators', 'center', .7);
    const acc = accent(res);
    return { v: 1, title, game, scenes: { board: { elements: els } }, traced: { accent: acc, guessedScores: !!res.guessedScores, found: !!res.found } };
  }
  function cutColour(img, b) {
    if (!img) return null; const { data, width: W } = img; let r = 0, g = 0, bl = 0, n = 0;
    for (let y = b.y + 2; y < b.y + b.h - 2; y += 2) for (let x = b.x + 2; x < b.x + b.w - 2; x += 2) { const i = (y * W + x) * 4; r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++; }
    return n ? [r / n, g / n, bl / n] : null;
  }

  // a kit's VS & victory screens recoloured to the picture's accent (kit = a whole design using the Ember colours)
  function screens(kit, acc) {
    const rgb = c => { let m = String(c || '').replace('#', ''); if (m.length === 3) m = m.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) || 0); };
    const mix = (c, t, k) => { const a = rgb(c), b = rgb(t); return hex(...a.map((v, i) => v + (b[i] - v) * k)); };
    const map = { '#ff5a1f': acc, '#ffb36b': mix(acc, '#ffffff', .45), '#a3180a': mix(acc, '#000000', .55), '#ffd0a0': mix(acc, '#ffffff', .7) };
    let j = JSON.stringify({ vs: kit.scenes.vs, victory: kit.scenes.victory });
    for (const [a, b] of Object.entries(map)) j = j.replace(new RegExp(a, 'gi'), b);
    return JSON.parse(j);
  }

  // ------------------------------------------------------------------------------------- helpers for pages
  async function loadImageData(src) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture couldn’t be read — try a PNG')); i.src = src; });
    const k = Math.min(1, 3840 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  }
  function toBlob(imgData, type = 'image/png') {
    const c = document.createElement('canvas'); c.width = imgData.width; c.height = imgData.height; c.getContext('2d').putImageData(imgData, 0, 0);
    return new Promise(res => c.toBlob(res, type));
  }

  root.BeeboTrace = { analyze, cleanSlots, crop, details, flood, design, screens, outline, simplify, loadImageData, toBlob, inkFor, accent };
})(typeof window !== 'undefined' ? window : globalThis);
