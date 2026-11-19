/* BeeboScore (developed by Beebo): the layout maker (1.5.6).
 *
 * A drag-and-drop editor for layouts. It opens one of the app's own looks (Classic, Obsidian Glass) as a starting point,
 * or one of yours, and draws it with the same runtime OBS uses (sb-design.js), so what you see is what goes on stream.
 *   • pieces: the parts of a layout that belong together (a player's bar with its colour line and set pips) move and resize
 *     as one; double-click to change just one part
 *   • snapping to the middle and edges of the screen and to the other pieces, with guides
 *   • a side panel with only what that piece has: colours, lettering, size, the picture…
 *   • the whole layout's colours (nine parts, the same as the Layouts tab's Colours card), kept with the layout
 * Saving goes through POST /api/designs (a layout of yours, with its format versions); /api/designs/get opens one.
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SBD = window.SBDesign, COL = window.SBColoursLib;
  const W0 = 1920, H0 = 1080;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  async function api(u, body) {
    const r = await fetch(u, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Something went wrong (${r.status}).`); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  let toastT = 0;
  function toast(msg, err) { const t = $('#mkToast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 4200 : 2400); }

  // =========================================================================================================== the layout
  const doc = { name: '', design: null, palette: null };     // name: the layout this saves over (empty until the first save of a new one)
  const pics = {};                                            // pictures you added: kept out of the undo history ('mk-pic:<id>' in the design)
  let kit = null, kitFallback = null;                         // where new pieces take their look from: the layout you started from, else Classic
  let scene = 'board', sel = null, inst = null, shown = null;
  let undo = [], redo = [], savedSnap = '';

  const KINDS = { bar: 'Player bar', header: 'Round and event', comms: 'Commentators', logo: 'Picture', shape: 'Box', text: 'Text', pips: 'Set pips',
    avatar: 'Player picture', bracket: 'Bracket', list: 'List', ticker: 'Ticker', three: '3D piece' };
  const SCREEN = { board: 'Scoreboard', vs: 'VS', victory: 'Victory', top8: 'Top 8', bracket: 'Bracket', standings: 'Standings' };
  const els = () => ((doc.design.scenes[scene] || {}).elements) || [];
  const byId = id => els().find(e => e.id === id);
  const area = e => Math.max(0, +e.w || 0) * Math.max(0, +e.h || 0);
  const snap = () => JSON.stringify({ d: doc.design, p: doc.palette, t: ($('#mkName') || {}).value || '', g: ($('#mkGame') || {}).value || '' });

  // ---- pieces: what belongs together. A player's parts (named 1P… / P1…) are one piece; anything sitting inside a box,
  // bar or picture belongs to it; two parts in exactly the same place belong to the first. Worked out once, kept as `grp`.
  const HOLDS = new Set(['shape', 'bar', 'logo', 'avatar', 'header', 'comms']);
  const inside = (a, b, t = 4) => a.x >= b.x - t && a.y >= b.y - t && a.x + a.w <= b.x + b.w + t && a.y + a.h <= b.y + b.h + t;
  function groupUp(d) {
    for (const [sn, sc] of Object.entries(d.scenes || {})) {
      const list = (sc && sc.elements) || [];
      for (const e of list) {
        if (e.grp) continue;
        const n = String(e.name || '');
        if (/^(1P|P1)\b/.test(n)) e.grp = 'gp1-' + sn; else if (/^(2P|P2)\b/.test(n)) e.grp = 'gp2-' + sn;
      }
      const parent = new Map();
      for (const e of list) {
        if (e.grp) continue;
        let best = null;
        for (const c of list) {
          if (c === e || !HOLDS.has(c.kind) || area(c) > W0 * H0 * .55 || area(c) < area(e) || !inside(e, c)) continue;
          if (area(c) === area(e) && list.indexOf(c) > list.indexOf(e)) continue;
          if (!best || area(c) < area(best) || (area(c) === area(best) && list.indexOf(c) < list.indexOf(best))) best = c;
        }
        if (best) parent.set(e, best);
      }
      const root = e => { let r = e, n = 0; while (!r.grp && parent.has(r) && n++ < 60) r = parent.get(r); return r; };
      for (const e of list) if (!e.grp) { const r = root(e); if (!r.grp) r.grp = 'g' + r.id; e.grp = r.grp; }
    }
  }
  const members = (g, list = els()) => list.filter(e => e.grp === g);
  function pieceName(g, list = els()) {
    if (/^gp1/.test(g)) return 'Player 1'; if (/^gp2/.test(g)) return 'Player 2';
    const m = members(g, list); if (!m.length) return '';
    const big = m.reduce((a, b) => (area(b) > area(a) ? b : a));
    return niceName(big);
  }
  const niceName = e => String(e.name || KINDS[e.kind] || 'Piece').replace(/^(1P|P1)\b/, 'Player 1').replace(/^(2P|P2)\b/, 'Player 2');
  function boxOf(list) {
    if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const e of list) { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  const selEls = () => (sel ? sel.ids.map(byId).filter(Boolean) : []);
  function selectPiece(e) { sel = e ? { grp: e.grp, ids: members(e.grp).map(x => x.id), part: false } : null; }
  function selectPart(e) { sel = e ? { grp: e.grp, ids: [e.id], part: members(e.grp).length > 1 } : null; }

  // ============================================================================================================ drawing
  function preview() {
    let d = JSON.parse(JSON.stringify(doc.design), (k, v) => (typeof v === 'string' && v.startsWith('mk-pic:') ? pics[v.slice(7)] || '' : v));
    const p = doc.palette;
    if (p && COL && Object.keys(p.colours || {}).length) d = COL.recolourDesign(d, p.look, p.colours);
    return d;
  }
  function scriptColours() {
    const p = doc.palette, on = p && COL && Object.keys(p.colours || {}).length;
    window.SBColours = on ? COL.make(p.look, p.colours) : { on: false, map: s => s, as: (r, c) => c };
  }
  let drawT = 0;
  function draw(now) {
    if (!now) { if (!drawT) drawT = requestAnimationFrame(() => { drawT = 0; draw(true); }); return; }
    scriptColours(); shown = preview();
    if (!inst) inst = SBD.mount($('#mkHost'), shown, { edit: true }); else inst.setDesign(shown);
    inst.setScene(scene);
    drawUi(); drawLayers(); drawScreens(); drawProps(); drawState();
  }
  function drawState() {
    const dirty = snap() !== savedSnap, st = $('#mkState');
    st.textContent = !doc.name ? (dirty ? 'Not saved yet' : '') : dirty ? 'Changes not saved' : 'Saved';
    st.classList.toggle('dirty', dirty);
    $('#mkUndo').disabled = !undo.length; $('#mkRedo').disabled = !redo.length;
  }

  // ---- history
  function checkpoint() { undo.push(snap()); if (undo.length > 100) undo.shift(); redo = []; }
  function change(fn, { soft } = {}) { if (!soft) checkpoint(); fn(); draw(); }
  function restore(s) { const o = JSON.parse(s); doc.design = o.d; doc.palette = o.p; if (sel && !selEls().length) sel = null; draw(); }
  function doUndo() { if (!undo.length) return; redo.push(snap()); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); restore(redo.pop()); }

  // ---- the screen: fitted into the middle column, 1920 × 1080 underneath (everything below is in the layout's pixels)
  let K = .5;
  function fit() {
    const wrap = $('#mkWrap'), pad = 28, ww = wrap.clientWidth - pad * 2, wh = wrap.clientHeight - pad * 2;
    K = Math.max(.1, Math.min(ww / W0, wh / H0));
    const fw = Math.round(W0 * K), fh = Math.round(H0 * K), fr = $('#mkFrame');
    fr.style.width = fw + 'px'; fr.style.height = fh + 'px'; fr.style.left = Math.round((wrap.clientWidth - fw) / 2) + 'px'; fr.style.top = Math.round((wrap.clientHeight - fh) / 2) + 'px';
    const st = $('#mkStage'); st.style.transform = `scale(${K})`; st.style.setProperty('--k', K);
  }
  const toLayout = ev => { const r = $('#mkStage').getBoundingClientRect(); return { x: (ev.clientX - r.left) / K, y: (ev.clientY - r.top) / K }; };
  function hitAt(p) {
    const list = els();
    for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (e.ghost) continue; if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) return e; }
    return null;
  }
  const HANDLES = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
  function place(n, b) { n.style.left = b.x + 'px'; n.style.top = b.y + 'px'; n.style.width = Math.max(1, b.w) + 'px'; n.style.height = Math.max(1, b.h) + 'px'; }
  function drawUi(box) {
    const ui = $('#mkUi');
    $$('.mk-sel', ui).forEach(n => n.remove());
    const list = selEls(); if (sel && !list.length) sel = null;
    if (!sel) return;
    const b = box || boxOf(list), n = document.createElement('div');
    n.className = 'mk-sel' + (sel.part ? ' part' : '') + (b.y < 60 ? ' low' : '');
    const label = sel.part ? niceName(list[0]) : pieceName(sel.grp);
    n.innerHTML = `<span class="mk-tag">${esc(label)}</span>` + Object.entries(HANDLES).map(([h, [x, y]]) => `<i class="mk-h" data-h="${h}" style="left:${x}%;top:${y}%"></i>`).join('');
    place(n, b); ui.appendChild(n);
  }
  function hover(e) {
    let n = $('.mk-hover'); if (!e) { if (n) n.remove(); return; }
    if (!n) { n = document.createElement('div'); n.className = 'mk-hover'; $('#mkUi').appendChild(n); }
    const inPart = sel && sel.part && e.grp === sel.grp;
    place(n, inPart ? e : boxOf(members(e.grp)));
  }
  function guides(xs, ys) {
    const ui = $('#mkUi'); $$('.mk-guide', ui).forEach(n => n.remove());
    for (const x of xs || []) { const g = document.createElement('i'); g.className = 'mk-guide v'; g.style.left = x + 'px'; ui.appendChild(g); }
    for (const y of ys || []) { const g = document.createElement('i'); g.className = 'mk-guide h'; g.style.top = y + 'px'; ui.appendChild(g); }
  }

  // ---- snapping: the middle and edges of the screen, and the edges and middles of the other pieces
  function lines(skip) {
    const xs = [0, W0 / 2, W0], ys = [0, H0 / 2, H0], seen = new Set();
    for (const e of els()) {
      if (skip.has(e.id) || seen.has(e.grp) || e.ghost) continue; seen.add(e.grp);
      const b = boxOf(members(e.grp)); if (b.w * b.h > W0 * H0 * .55) continue;
      xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs, ys };
  }
  function nearest(vals, cands, th) { let best = null; for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; } return best; }

  // ---- move and resize
  let drag = null;
  $('#mkUi').addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const ui = $('#mkUi'), p = toLayout(ev), h = ev.target.closest('.mk-h');
    if (h && sel) { startDrag(ev, 'size', p, h.dataset.h); ui.setPointerCapture(ev.pointerId); return; }
    const e = hitAt(p);
    if (!e) { sel = null; drawUi(); drawProps(); drawLayers(); return; }
    const inSel = sel && sel.ids.includes(e.id);
    if (!inSel) { if (sel && sel.part && e.grp === sel.grp) selectPart(e); else selectPiece(e); drawUi(); drawProps(); drawLayers(); }
    startDrag(ev, 'move', p); ui.setPointerCapture(ev.pointerId);
  });
  $('#mkUi').addEventListener('dblclick', ev => {
    const e = hitAt(toLayout(ev)); if (!e) return;
    selectPart(e); drawUi(); drawProps(); drawLayers();
    const t = $('#mkProps [data-k="text"]'); if (t) { t.focus(); t.select(); }
  });
  function startDrag(ev, mode, p, handle) {
    const list = selEls(); if (!list.length) return;
    drag = { mode, handle, p0: p, b0: boxOf(list), start: list.map(e => ({ e, x: e.x, y: e.y, w: e.w, h: e.h })), moved: false, shift: ev.shiftKey };
  }
  $('#mkUi').addEventListener('pointermove', ev => {
    const p = toLayout(ev);
    if (!drag) { hover(hitAt(p)); return; }
    hover(null);
    let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (!drag.moved && Math.hypot(dx, dy) * K < 3) return;
    if (!drag.moved) { drag.moved = true; checkpoint(); }
    const th = 7 / K, skip = new Set(drag.start.map(s => s.e.id)), L = ev.altKey ? { xs: [], ys: [] } : lines(skip), b0 = drag.b0;
    if (drag.mode === 'move') {
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const sx = nearest([b0.x + dx, b0.x + dx + b0.w / 2, b0.x + dx + b0.w], L.xs, th), sy = nearest([b0.y + dy, b0.y + dy + b0.h / 2, b0.y + dy + b0.h], L.ys, th);
      if (sx) dx += sx.d; if (sy) dy += sy.d;
      dx = Math.round(dx); dy = Math.round(dy);
      for (const s of drag.start) { s.e.x = s.x + dx; s.e.y = s.y + dy; const n = inst && inst.node(s.e.id); if (n) { n.style.left = s.e.x + 'px'; n.style.top = s.e.y + 'px'; } }
      guides(sx ? [sx.at] : [], sy ? [sy.at] : []);
      drawUi({ x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h });
    } else {
      const hd = drag.handle; let x1 = b0.x, y1 = b0.y, x2 = b0.x + b0.w, y2 = b0.y + b0.h; const gx = [], gy = [];
      if (hd.includes('w')) { x1 += dx; const s = nearest([x1], L.xs, th); if (s) { x1 += s.d; gx.push(s.at); } }
      if (hd.includes('e')) { x2 += dx; const s = nearest([x2], L.xs, th); if (s) { x2 += s.d; gx.push(s.at); } }
      if (hd.includes('n')) { y1 += dy; const s = nearest([y1], L.ys, th); if (s) { y1 += s.d; gy.push(s.at); } }
      if (hd.includes('s')) { y2 += dy; const s = nearest([y2], L.ys, th); if (s) { y2 += s.d; gy.push(s.at); } }
      let w = Math.max(8, x2 - x1), h = Math.max(8, y2 - y1);
      if (ev.shiftKey && b0.w && b0.h) {                       // keep the shape: the side you pulled further decides
        const r = b0.w / b0.h; if (hd.length === 2 ? w / b0.w > h / b0.h : /[ew]/.test(hd)) h = w / r; else w = h * r;
        if (hd.includes('w')) x1 = x2 - w; if (hd.includes('n')) y1 = y2 - h;
      } else { if (hd.includes('w')) x1 = x2 - w; if (hd.includes('n')) y1 = y2 - h; }
      const sx = w / (b0.w || 1), sy = h / (b0.h || 1);
      for (const s of drag.start) { s.e.x = Math.round(x1 + (s.x - b0.x) * sx); s.e.y = Math.round(y1 + (s.y - b0.y) * sy); s.e.w = Math.max(2, Math.round(s.w * sx)); s.e.h = Math.max(2, Math.round(s.h * sy)); }
      guides(gx, gy); drawUi({ x: x1, y: y1, w, h });
      clearTimeout(drag.t); drag.t = setTimeout(() => { if (drag) { scriptColours(); shown = preview(); inst.setDesign(shown); inst.setScene(scene); } }, 50);
    }
  });
  function endDrag() { if (!drag) return; const was = drag; drag = null; clearTimeout(was.t); guides(); if (was.moved) draw(); }
  $('#mkUi').addEventListener('pointerup', endDrag);
  $('#mkUi').addEventListener('pointercancel', endDrag);
  $('#mkUi').addEventListener('pointerleave', () => { if (!drag) hover(null); });

  // ============================================================================================================ pieces
  const ICONS = {
    p1: '<svg viewBox="0 0 64 30"><path d="M4 6h46l-5 14H4z" fill="#2a3044"/><path d="M4 21h40v3H4z" fill="#ff3b5c"/><rect x="50" y="6" width="10" height="14" rx="2" fill="#3a4258"/></svg>',
    p2: '<svg viewBox="0 0 64 30"><path d="M14 6h46v14H19z" fill="#2a3044"/><path d="M20 21h40v3H20z" fill="#3b8eff"/><rect x="4" y="6" width="10" height="14" rx="2" fill="#3a4258"/></svg>',
    header: '<svg viewBox="0 0 64 30"><path d="M14 5h36v14l-4 5H18l-4-5z" fill="#2a3044"/><path d="M22 12h20" stroke="#e9c35e" stroke-width="2.4" stroke-linecap="round"/></svg>',
    comms: '<svg viewBox="0 0 64 30"><path d="M8 8h48l-6 14H14z" fill="#2a3044"/><circle cx="22" cy="15" r="3" fill="#8b93a7"/><path d="M28 15h16" stroke="#8b93a7" stroke-width="2.4" stroke-linecap="round"/></svg>',
    text: '<svg viewBox="0 0 64 30"><text x="32" y="22" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="18" fill="#eef1f7">Aa</text></svg>',
    box: '<svg viewBox="0 0 64 30"><rect x="12" y="5" width="40" height="20" rx="4" fill="#2a3044" stroke="#4a5370" stroke-width="1.5"/></svg>',
    pic: '<svg viewBox="0 0 64 30"><rect x="16" y="4" width="32" height="22" rx="3" fill="#2a3044"/><circle cx="25" cy="12" r="3" fill="#e9c35e"/><path d="M18 24l9-8 6 5 5-4 8 7z" fill="#5d6579"/></svg>',
  };
  const PIECES = [['p1', 'Player 1'], ['p2', 'Player 2'], ['header', 'Round and event'], ['comms', 'Commentators'], ['text', 'Text'], ['box', 'Box'], ['pic', 'Picture']];
  $('#mkPieces').innerHTML = PIECES.map(([k, l], i) => `<div class="mk-piece${i === PIECES.length - 1 ? ' wide' : ''}" tabindex="0" role="button" data-piece="${k}" title="Drag onto the screen, or click">${ICONS[k]}<span>${esc(l)}</span></div>`).join('');

  // a piece's look comes from the layout you started from (falling back to Classic): its player bar, its text, its box…
  function fromKit(pick) {
    for (const src of [kit, kitFallback]) {
      if (!src) continue;
      for (const sn of ['board', ...Object.keys(src.scenes || {})]) { const list = ((src.scenes || {})[sn] || {}).elements || []; const got = pick(list); if (got && got.length) return got; }
    }
    return [];
  }
  const fresh = e => { const c = structuredClone(e); c.id = rid(); delete c.rule; delete c.exit; delete c.looks; delete c.hidden; delete c.ghost; c.enter = { type: 'fade', delay: 0 }; return c; };
  function newPiece(k) {
    const g = (k === 'p1' ? 'gp1-' : k === 'p2' ? 'gp2-' : 'g') + rid();
    let out = [];
    if (k === 'p1' || k === 'p2') {
      const side = k === 'p1' ? 1 : 2;
      out = fromKit(list => { const bar = list.find(e => e.kind === 'bar' && (e.side || 1) === side); if (!bar) return null; const mates = bar.grp ? list.filter(e => e.grp === bar.grp && !e.rule) : [bar]; return mates; }).map(fresh);
      if (!out.length) out = [SBD.make('bar', { side, w: 600, h: 60, name: side === 1 ? '1P plate' : '2P plate' })];
    } else if (k === 'header' || k === 'comms') {
      out = fromKit(list => { const h = list.find(e => e.kind === k); return h ? [h] : null; }).map(fresh);
      if (!out.length) out = [SBD.make(k, {})];
    } else if (k === 'text') {
      const t = fromKit(list => { const x = list.find(e => e.kind === 'text' && !e.rule && /\{(event|round)\}/.test(e.text || '')) || list.find(e => e.kind === 'text' && !e.rule); return x ? [x] : null; })[0];
      const e = t ? fresh(t) : SBD.make('text', {}); Object.assign(e, { text: 'Your text', name: 'Text', w: 560, h: 60 }); out = [e];
    } else if (k === 'box') {
      const t = fromKit(list => { const x = list.find(e => e.kind === 'shape' && e.h > 30 && e.w > 120 && e.fill && e.fill.type !== 'none'); return x ? [x] : null; })[0];
      const e = t ? fresh(t) : SBD.make('shape', {}); Object.assign(e, { name: 'Box', w: 360, h: 120, shape: 'rect', radius: e.radius || 6 }); delete e.pts; out = [e];
    } else if (k === 'pic') {
      out = [Object.assign(SBD.make('logo', { w: 260, h: 260, src: '', enter: { type: 'fade', delay: 0 } }), { name: 'Picture' })];
    }
    for (const e of out) { e.id = e.id || rid(); e.grp = g; }
    return out;
  }
  // clicked (not dragged): a player bar, the round or the commentators go where the look has them when that spot is free;
  // anything else (or a taken spot) goes in the middle, a little lower each time so new pieces don't pile up
  const covers = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 && w * h > .25 * Math.min(area(a), area(b) || 1); };
  let stack = 0;
  function spotFor(k, out) {
    const b = boxOf(out), taken = bb => els().some(e => !e.hidden && covers(bb, e));
    if (['p1', 'p2', 'header', 'comms'].includes(k) && !taken(b)) return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    for (let i = 0; i < 12; i++) { const c = { x: W0 / 2, y: H0 / 2 + ((stack + i) % 6) * 70 - 140 }; if (!taken({ x: c.x - b.w / 2, y: c.y - b.h / 2, w: b.w, h: b.h })) { stack += i + 1; return c; } }
    stack++; return { x: W0 / 2, y: H0 / 2 };
  }
  function addPiece(k, at) {
    const out = newPiece(k); if (!out.length) return;
    change(() => {
      const b = boxOf(out), c = at || spotFor(k, out);
      const dx = Math.round(clamp(c.x - b.w / 2, 0, Math.max(0, W0 - b.w)) - b.x), dy = Math.round(clamp(c.y - b.h / 2, 0, Math.max(0, H0 - b.h)) - b.y);
      for (const e of out) { e.x += dx; e.y += dy; }
      els().push(...out);
      sel = { grp: out[0].grp, ids: out.map(e => e.id), part: false };
    });
    toast(`${PIECES.find(p => p[0] === k)[1]} added. Drag it where you want it.`);
  }
  // dragging a piece from the list: a label follows the pointer; let go over the screen to drop it there
  let pdrag = null;
  $('#mkPieces').addEventListener('pointerdown', ev => {
    const t = ev.target.closest('[data-piece]'); if (!t || ev.button !== 0) return;
    ev.preventDefault();
    pdrag = { k: t.dataset.piece, x: ev.clientX, y: ev.clientY, on: false, ghost: null };
  });
  window.addEventListener('pointermove', ev => {
    if (!pdrag) return;
    if (!pdrag.on && Math.hypot(ev.clientX - pdrag.x, ev.clientY - pdrag.y) > 5) {
      pdrag.on = true; const g = document.createElement('div'); g.className = 'mk-ghost'; g.textContent = PIECES.find(p => p[0] === pdrag.k)[1]; document.body.appendChild(g); pdrag.ghost = g;
    }
    if (pdrag.on) { pdrag.ghost.style.left = ev.clientX + 'px'; pdrag.ghost.style.top = ev.clientY + 'px'; const over = overStage(ev); $('#mkUi').classList.toggle('dropping', over); }
  });
  const overStage = ev => { const r = $('#mkFrame').getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
  window.addEventListener('pointerup', ev => {
    if (!pdrag) return; const d = pdrag; pdrag = null;
    if (d.ghost) d.ghost.remove(); $('#mkUi').classList.remove('dropping');
    if (!d.on) return addPiece(d.k);
    if (overStage(ev)) addPiece(d.k, toLayout(ev));
  });
  $('#mkPieces').addEventListener('keydown', ev => { const t = ev.target.closest('[data-piece]'); if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); addPiece(t.dataset.piece); } });

  // ---- pictures: dropped on the screen (onto a Picture piece: its picture; anywhere else: a new Picture piece)
  function readPic(file, max = 1600) {
    return new Promise((ok, no) => {
      if (!file || !/^image\//.test(file.type)) return no(new Error('That isn’t a picture.'));
      const fr = new FileReader(); fr.onerror = () => no(new Error('That picture couldn’t be read.'));
      fr.onload = () => {
        const img = new Image(); img.onerror = () => no(new Error('That picture couldn’t be read.'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          if (k === 1 && fr.result.length < 2.5e6) return ok(fr.result);
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', .9) : c.toDataURL('image/png'));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function usePic(el, url) { const id = rid(); pics[id] = url; el.src = 'mk-pic:' + id; }
  $('#mkUi').addEventListener('dragover', ev => { if ([...(ev.dataTransfer.items || [])].some(i => i.kind === 'file')) { ev.preventDefault(); $('#mkUi').classList.add('dropping'); } });
  $('#mkUi').addEventListener('dragleave', () => $('#mkUi').classList.remove('dropping'));
  $('#mkUi').addEventListener('drop', async ev => {
    ev.preventDefault(); $('#mkUi').classList.remove('dropping');
    const f = [...(ev.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (!f) return toast('Drop a picture (PNG, JPG, WebP or GIF).', true);
    const p = toLayout(ev), hit = hitAt(p);
    try {
      const url = await readPic(f);
      if (hit && hit.kind === 'logo') { change(() => usePic(hit, url)); selectPart(hit); draw(); return toast('Picture changed.'); }
      const [e] = newPiece('pic'); usePic(e, url); e.name = f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture';
      change(() => { e.x = Math.round(clamp(p.x - e.w / 2, 0, W0 - e.w)); e.y = Math.round(clamp(p.y - e.h / 2, 0, H0 - e.h)); els().push(e); sel = { grp: e.grp, ids: [e.id], part: false }; });
      toast('Picture added.');
    } catch (er) { toast(er.message, true); }
  });
  window.addEventListener('dragover', ev => ev.preventDefault());
  window.addEventListener('drop', ev => ev.preventDefault());

  // ============================================================================================================ lists
  // Obsidian Glass (and Porcelain) play their own full-screen VS (sb-fullvs.js) in place of the layout's VS screen: nothing to edit there
  const ownVs = () => ['shattered', 'porcelain'].includes(String(doc.design.look || '').toLowerCase());
  function drawScreens() {
    const keys = Object.keys(doc.design.scenes || {}).filter(k => !(k === 'vs' && ownVs()));
    if (!keys.includes(scene)) scene = keys[0] || 'board';
    $('#mkScreens').innerHTML = keys.map(k => `<button data-scene="${esc(k)}" class="${k === scene ? 'on' : ''}">${esc(SCREEN[k] || doc.design.scenes[k].name || k)}</button>`).join('');
  }
  $('#mkScreens').addEventListener('click', ev => { const b = ev.target.closest('[data-scene]'); if (!b || b.dataset.scene === scene) return; scene = b.dataset.scene; sel = null; draw(); });
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/></svg>';
  function drawLayers() {
    const seen = [], list = els();
    for (let i = list.length - 1; i >= 0; i--) if (!seen.includes(list[i].grp)) seen.push(list[i].grp);
    $('#mkLayers').innerHTML = seen.length ? seen.map(g => { const m = members(g), off = m.every(e => e.hidden); return `<li data-grp="${esc(g)}" class="${sel && sel.grp === g ? 'on' : ''}${off ? ' off' : ''}"><span>${esc(pieceName(g))}</span><button class="eye" data-eye="${esc(g)}" title="${off ? 'Show it on stream' : 'Hide it on stream (kept here)'}" aria-label="${off ? 'Show' : 'Hide'}">${off ? EYE_OFF : EYE}</button></li>`; }).join('')
      : '<li class="none"><span>Nothing here yet. Drag a piece on.</span></li>';
  }
  $('#mkLayers').addEventListener('click', ev => {
    const eye = ev.target.closest('[data-eye]');
    if (eye) { const m = members(eye.dataset.eye), off = m.every(e => e.hidden); change(() => { for (const e of m) { if (off) delete e.hidden; else e.hidden = true; } }); return; }
    const li = ev.target.closest('[data-grp]'); if (!li) return;
    const m = members(li.dataset.grp); if (m.length) { selectPiece(m[0]); draw(); }
  });

  // ============================================================================================================ side panel
  const FONT_OPTS = (() => {
    const groups = {}; for (const [k, f] of Object.entries(SBD.FONTS || {})) (groups[f.group || 'Other'] = groups[f.group || 'Other'] || []).push([k, f.label || k]);
    return Object.entries(groups).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</optgroup>`).join('');
  })();
  const SHAPE_OPTS = ['rect', 'pill', 'para', 'shard', 'hex', 'octagon', 'chevron', 'ellipse', 'diamond', 'star'].filter(k => SBD.SHAPES && SBD.SHAPES[k]).map(k => [k, SBD.SHAPES[k].label || k]);
  const PIP_OPTS = [['diamond', 'Diamond'], ['rect', 'Box'], ['ellipse', 'Circle'], ['para', 'Slant'], ['hex', 'Hexagon'], ['star', 'Star']];
  const FIELDS = [['{p1.name}', '1P name'], ['{p2.name}', '2P name'], ['{p1.score}', '1P score'], ['{p2.score}', '2P score'], ['{p1.team}', '1P team'], ['{p2.team}', '2P team'], ['{round}', 'Round'], ['{event}', 'Event'], ['{game}', 'Game'], ['{bestOfText}', 'Best of']];

  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function set(o, path, v) { const ks = path.split('.'); let t = o; for (const k of ks.slice(0, -1)) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; } t[ks.at(-1)] = v; }
  const hex6 = c => { const r = COL && COL.hex2rgb(c); return r ? COL.rgb2hex(r) : '#000000'; };
  // a paint's colour as you see it (your whole-layout colours included), for the swatches
  function shownOf(el, path) {
    const s = (shown && Object.values(shown.scenes || {}).flatMap(x => x.elements || []).find(x => x.id === el.id)) || el;
    const v = get(s, path); if (v && typeof v === 'object') return v.type === 'none' ? '' : hex6((v.colors || [])[0]);
    return v ? hex6(v) : '';
  }
  // a new colour for a paint: every stop moves by the same amount, so a gradient stays a gradient
  function paintTo(p, hex) {
    if (!p || typeof p !== 'object' || p.type === 'none' || !(p.colors || []).length) return { type: 'solid', colors: [hex], angle: 180 };
    const from = COL.hex2rgb(p.colors[0]), to = COL.hex2rgb(hex);
    if (!from || !to) return { ...p, colors: [hex] };
    return { ...p, colors: p.colors.map(c => { const rgb = COL.hex2rgb(c); if (!rgb) return c; const a = /^#[0-9a-f]{8}$/i.test(c) ? c.slice(7) : ''; return COL.rgb2hex(COL.shift(rgb, from, to)) + a; }) };
  }
  function setColour(el, path, hex) {
    const cur = get(el, path);
    if (path === 'accent' || (cur && typeof cur === 'object')) set(el, path, paintTo(cur, hex)); else set(el, path, hex);
    if (path === 'teamColor' && el.kind === 'bar' && el.accent) el.accent = paintTo(el.accent, hex);
    el.ownColours = true;
  }

  const colourRow = (label, el, path, opts = {}) => {
    const v = shownOf(el, path) || opts.none || '';
    return `<div class="mk-row"><span>${esc(label)}</span><div class="mk-col"><label class="sw" style="background:${v || 'transparent'}${v ? '' : ';background-image:linear-gradient(45deg,transparent 45%,#ff4d5e 45% 55%,transparent 55%)'}"><input type="color" value="${v || '#000000'}" data-col="${esc(path)}" aria-label="${esc(label)}"></label><code>${v ? esc(v) : 'none'}</code></div></div>`;
  };
  const range = (label, k, v, min, max, step, fmt = x => x) => `<div class="mk-row"><span>${esc(label)}</span><div class="mk-range"><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-k="${k}" data-num="1"><output>${esc(fmt(v))}</output></div></div>`;
  const select = (label, k, v, opts) => `<div class="mk-row"><span>${esc(label)}</span><select class="f" data-k="${k}">${typeof opts === 'string' ? opts : opts.map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(v) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
  const checks = items => `<div class="mk-checks">${items.map(([k, l, v]) => `<label><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>`;
  const xywh = b => `<div class="mk-xywh">${[['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].map(([k, l]) => `<label>${l}<input class="f" type="number" data-box="${k}" value="${Math.round(b[k])}"></label>`).join('')}</div>`;

  function drawProps() {
    const P = $('#mkProps'), list = selEls();
    if (!sel || !list.length) return P.innerHTML = wholeLayout();
    if (!sel.part && list.length > 1) return P.innerHTML = pieceProps(list);
    P.innerHTML = partProps(list[0]);
    const fs = P.querySelector('select[data-k="font.family"]'); if (fs) fs.value = (list[0].font && list[0].font.family) || 'saira';
  }
  function actions(isPiece, list) {
    const mirror = isPiece && list.some(e => e.side === 1 || e.side === 2 || /^(1P|P1|2P|P2)\b/.test(e.name || '')) ? '<button class="btn sm" data-act="mirror" title="Puts the other player’s piece in the same place on the other side (or makes one)">Mirror to the other side</button>' : '';
    return `<div class="mk-sec"><b>${isPiece ? 'This piece' : 'This part'}</b><div class="mk-acts">${mirror}<button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm" data-act="front">Bring to front</button><button class="btn sm" data-act="back">Send to back</button><button class="btn sm danger" data-act="del">Delete</button></div></div>`;
  }
  function pieceProps(list) {
    const b = boxOf(list), root = list.reduce((a, c) => (area(c) > area(a) ? c : a)), lettering = list.find(e => e.font && e.font.color && (e.kind === 'text' || e.kind === 'bar' || e.kind === 'header' || e.kind === 'comms'));
    const ruled = list.some(e => e.rule && e.rule.on);
    return `<h2>${esc(pieceName(sel.grp))}</h2><p class="kind">${list.length} parts, moved and sized together. Double-click a part on the screen to change just that one.</p>
      ${ruled ? '<p class="hint">Parts of this piece only show at certain moments (they’re faint here the rest of the time).</p>' : ''}
      <div class="mk-sec"><b>Place and size</b>${xywh(b)}</div>
      <div class="mk-sec"><b>Colours</b>${colourRow('Main colour', root, 'fill')}${root.kind === 'bar' || root.teamColor ? colourRow('Player colour', root, 'teamColor') : ''}${lettering ? colourRow('Lettering', lettering, 'font.color') : ''}${root.stroke && root.stroke.width ? colourRow('Edge', root, 'stroke.color') : ''}</div>
      <div class="mk-sec"><b>Parts</b><div class="mk-parts">${list.map(e => `<button data-part="${esc(e.id)}">${esc(niceName(e))} <small style="color:var(--faint)">${esc(KINDS[e.kind] || e.kind)}</small></button>`).join('')}</div></div>
      ${actions(true, list)}`;
  }
  function partProps(e) {
    const b = { x: e.x, y: e.y, w: e.w, h: e.h }, f = e.font || {};
    let h = `<h2>${esc(niceName(e))}</h2><p class="kind">${esc(KINDS[e.kind] || e.kind)}${sel.part ? ` in ${esc(pieceName(sel.grp))}` : ''}</p>`;
    if (sel.part) h += `<div class="mk-acts" style="margin:-4px 0 10px"><button class="btn sm ghost" data-act="whole">Back to the whole piece</button></div>`;
    if (e.rule && e.rule.on) h += '<p class="hint">This only shows at certain moments (it’s faint here the rest of the time).</p>';
    h += `<div class="mk-sec"><b>Place and size</b>${xywh(b)}</div>`;
    if (e.kind === 'text') {
      h += `<div class="mk-sec"><b>Text</b><input class="f" data-k="text" value="${esc(e.text || '')}" spellcheck="false"><div class="mk-chips">${FIELDS.map(([v, l]) => `<button class="mk-chip" data-ins="${esc(v)}" title="Puts in the live ${esc(l.toLowerCase())}">${esc(l)}</button>`).join('')}</div><p class="hint">Words in curly brackets fill in from the scoreboard.</p></div>`;
    }
    if (e.kind === 'logo') {
      const has = e.src && !/^$/.test(e.src);
      h += `<div class="mk-sec"><b>Picture</b><div class="mk-acts"><button class="btn sm" data-act="pic">${has ? 'Change the picture…' : 'Choose a picture…'}</button>${has ? '<button class="btn sm ghost" data-act="nopic">Remove it</button>' : ''}</div>${select('Fit', 'fit', e.fit || 'contain', [['contain', 'Whole picture'], ['cover', 'Fill the box']])}<p class="hint">Or drop a picture file onto it on the screen.</p></div>`;
    }
    if (e.kind === 'bar' || e.kind === 'pips' || e.kind === 'avatar') {
      h += `<div class="mk-sec"><b>Player</b>${select('Shows', 'side', e.side || 1, [[1, 'Player 1'], [2, 'Player 2']])}${e.kind === 'bar' ? checks([['showFlag', 'Flag', e.showFlag !== false], ['showTeam', 'Team', e.showTeam !== false], ['showScore', 'Score', e.showScore !== false], ['showSub', 'Status line', e.showSub !== false]]) : ''}</div>`;
    }
    // colours: only the ones this part has
    let c = '';
    if (e.kind === 'pips') c += colourRow('Games won', e, 'onColor') + colourRow('Still to win', e, 'offColor');
    else {
      if (e.fill && (e.fill.type !== 'none' || ['shape', 'bar', 'header', 'comms'].includes(e.kind))) c += colourRow(e.kind === 'bar' ? 'Bar' : 'Colour', e, 'fill');
      if (e.kind === 'bar' || e.kind === 'header' || e.kind === 'comms') c += colourRow(e.kind === 'bar' ? 'Player colour' : 'Accent', e, 'teamColor');
      if (e.font && ['text', 'bar', 'header', 'comms', 'list', 'ticker', 'bracket'].includes(e.kind)) c += colourRow('Lettering', e, 'font.color');
      if (e.kind === 'bar') c += colourRow('Score', e, 'scoreColor') + colourRow('Small lettering', e, 'subColor');
      if (e.stroke && ['shape', 'logo', 'bar', 'header', 'comms', 'avatar'].includes(e.kind)) c += colourRow('Edge', e, 'stroke.color') + range('Edge size', 'stroke.width', +(e.stroke.width || 0), 0, 12, .5, v => v + ' px');
    }
    if (c) h += `<div class="mk-sec"><b>Colours</b>${c}</div>`;
    if (e.font && ['text', 'bar', 'header', 'comms', 'list', 'ticker'].includes(e.kind)) {
      h += `<div class="mk-sec"><b>Lettering</b>${select('Font', 'font.family', f.family, FONT_OPTS)}${range('Size', 'font.size', +(f.size || 1), .4, 2, .05, v => Math.round(v * 100) + '%')}
        ${e.kind === 'text' ? select('Line up', 'align', e.align || 'center', [['left', 'Left'], ['center', 'Middle'], ['right', 'Right']]) : ''}${checks([['font.upper', 'Capitals', !!f.upper], ['font.italic', 'Slanted', !!f.italic]])}</div>`;
    }
    if (e.kind === 'pips') h += `<div class="mk-sec"><b>Shape</b>${select('Pip', 'pip', e.pip || 'diamond', PIP_OPTS)}</div>`;
    if (e.kind === 'shape' || e.kind === 'logo') {
      const opts = (e.shape === 'custom' ? [['custom', 'The layout’s own']] : []).concat(SHAPE_OPTS);
      h += `<div class="mk-sec"><b>Shape</b>${select('Shape', 'shape', e.shape || 'rect', opts)}${['rect', 'custom'].includes(e.shape || 'rect') ? range('Corners', 'radius', +(e.radius || 0), 0, 80, 1, v => v + ' px') : ''}</div>`;
    }
    h += `<div class="mk-sec"><b>See-through</b>${range('Opacity', 'opacity', Math.round((e.opacity ?? 1) * 100), 0, 100, 1, v => v + '%')}</div>`;
    return h + actions(!sel.part && members(e.grp).length === 1, [e]);
  }
  function wholeLayout() {
    const p = doc.palette, cols = (p && p.colours) || {}, base = p && COL.BASE[p.look];
    let h = `<h2>Whole layout</h2><p class="kind">${p ? `Started from ${esc(p.look)}` : 'Your own layout'}. Click a piece on the screen to change it.</p>`;
    if (base) {
      h += `<div class="mk-sec"><b>Colours</b><p class="hint" style="margin-top:-4px">The colours of everything this look draws: the bars, the lettering, the splashes and the effects. A piece you’ve given its own colours keeps them.</p>
        <div class="mk-cols9">${COL.ROLES.map(r => { const v = cols[r] || base[r]; return `<label class="mk-c9${cols[r] ? ' own' : ''}" title="${esc(COL.LABELS[r])}"><i style="background:${v}"></i>${esc(COL.LABELS[r])}<input type="color" value="${v}" data-pal="${r}"></label>`; }).join('')}</div>
        <div class="mk-sets">${COL.PRESETS.map(([n, c]) => `<button class="mk-set" data-set="${esc(n)}"><span class="dots">${['plates', 'accent', 'p1', 'p2', 'text'].map(k => `<i style="background:${c[k]}"></i>`).join('')}</span>${esc(n)}</button>`).join('')}</div>
        ${Object.keys(cols).length ? `<div class="mk-acts" style="margin-top:10px"><button class="btn sm ghost" data-act="palreset">Back to ${esc(p.look)}’s colours</button></div>` : ''}</div>`;
    } else h += '<div class="mk-sec"><p class="hint">Colours for the whole layout work on layouts started from Classic or Obsidian Glass. You can still change each piece’s colours.</p></div>';
    h += `<div class="mk-sec"><b>Good to know</b><p class="hint">${ownVs() ? 'The Victory and Top 8 screens are on the tabs above the screen; change them the same way. This look plays its own full-screen VS, in the colours above.' : 'The VS, Victory and Top 8 screens are on the tabs above the screen; change them the same way.'}</p><p class="hint">Use <b>Choose a game picture…</b> to line your layout up with your game’s own health bars. The picture stays here: it isn’t part of the layout.</p><p class="hint">Saving puts the layout in the Layout menu, with a version for each game format.</p></div>`;
    return h;
  }

  // ---- the side panel's controls
  let editing = false;                    // one undo step for a whole slider drag or colour pick
  function begin() { if (!editing) { checkpoint(); editing = true; } }
  const P = $('#mkProps');
  P.addEventListener('input', ev => {
    const t = ev.target, list = selEls();
    if (t.dataset.pal) { begin(); doc.palette.colours = { ...doc.palette.colours, [t.dataset.pal]: t.value }; const lab = t.closest('.mk-c9'); if (lab) { lab.classList.add('own'); lab.querySelector('i').style.background = t.value; } return draw(); }
    if (!list.length) return;
    if (t.dataset.col) {
      begin(); const tgt = sel.part || list.length === 1 ? list : colourTargets(list, t.dataset.col);
      for (const e of tgt) setColour(e, t.dataset.col === 'font.color' && !e.font ? 'fill' : t.dataset.col, t.value);
      const sw = t.closest('.sw'); if (sw) { sw.style.background = t.value; sw.nextElementSibling.textContent = t.value; }
      return draw();
    }
    if (t.dataset.k && t.type === 'range') {
      begin(); let v = +t.value; const out = t.nextElementSibling;
      if (t.dataset.k === 'opacity') { out.textContent = v + '%'; v /= 100; } else out.textContent = t.dataset.k === 'font.size' ? Math.round(v * 100) + '%' : v + ' px';
      for (const e of list) set(e, t.dataset.k, v);
      return draw();
    }
    if (t.dataset.k === 'text') { begin(); list[0].text = t.value; return draw(); }
  });
  P.addEventListener('change', ev => {
    const t = ev.target, list = selEls();
    if (editing) { editing = false; drawState(); }
    if (t.dataset.box) return setBox(t.dataset.box, +t.value);
    if (!list.length || !t.dataset.k || t.type === 'range' || t.dataset.k === 'text') return;
    const v = t.type === 'checkbox' ? t.checked : t.dataset.k === 'side' ? +t.value : t.value;
    change(() => { for (const e of list) { set(e, t.dataset.k, v); if (t.dataset.k === 'align' && e.font) e.font.align = v; } });
  });
  P.addEventListener('focusout', () => { if (editing) { editing = false; drawState(); } });
  function colourTargets(list, path) {
    const root = list.reduce((a, c) => (area(c) > area(a) ? c : a));
    if (path === 'font.color') return list.filter(e => e.font && ['text', 'bar', 'header', 'comms'].includes(e.kind));
    if (path === 'teamColor') return list.filter(e => e.kind === 'bar' || e.teamColor);
    return [root];
  }
  function setBox(k, v) {
    if (!Number.isFinite(v)) return drawProps();
    const list = selEls(), b = boxOf(list);
    change(() => {
      if (k === 'x' || k === 'y') { const d = Math.round(v - b[k]); for (const e of list) e[k] += d; return; }
      const nv = Math.max(4, v), s = nv / (b[k] || 1), o = k === 'w' ? 'x' : 'y';
      for (const e of list) { e[o] = Math.round(b[o] + (e[o] - b[o]) * s); e[k] = Math.max(2, Math.round(e[k] * s)); }
    });
  }
  P.addEventListener('click', ev => {
    const ins = ev.target.closest('[data-ins]');
    if (ins) { const inp = P.querySelector('[data-k="text"]'), e = selEls()[0]; if (!inp || !e) return; const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? s; const v = inp.value.slice(0, s) + ins.dataset.ins + inp.value.slice(en); change(() => { e.text = v; }); return; }
    const part = ev.target.closest('[data-part]'); if (part) { const e = byId(part.dataset.part); if (e) { selectPart(e); draw(); } return; }
    const setB = ev.target.closest('[data-set]');
    if (setB) { const pr = COL.PRESETS.find(([n]) => n === setB.dataset.set); if (pr) { change(() => { doc.palette.colours = { ...pr[1] }; }); toast(`${pr[0]} colours on the whole layout.`); } return; }
    const a = ev.target.closest('[data-act]'); if (!a) return;
    act(a.dataset.act);
  });
  function act(what) {
    const list = selEls();
    if (what === 'palreset') return change(() => { doc.palette.colours = {}; });
    if (what === 'whole') { if (sel) { const m = members(sel.grp); sel = { grp: sel.grp, ids: m.map(e => e.id), part: false }; draw(); } return; }
    if (!list.length) return;
    const all = els();
    if (what === 'del') { change(() => { const ids = new Set(list.map(e => e.id)); doc.design.scenes[scene].elements = all.filter(e => !ids.has(e.id)); sel = null; }); return toast('Deleted. Ctrl+Z brings it back.'); }
    if (what === 'front' || what === 'back') return change(() => { const ids = new Set(list.map(e => e.id)), rest = all.filter(e => !ids.has(e.id)), mine = all.filter(e => ids.has(e.id)); doc.design.scenes[scene].elements = what === 'front' ? rest.concat(mine) : mine.concat(rest); });
    if (what === 'dup') {
      const g = sel.part ? list[0].grp : 'g' + rid();
      const copies = list.map(e => Object.assign(structuredClone(e), { id: rid(), grp: g, x: e.x + 24, y: e.y + 24 }));
      change(() => { all.push(...copies); sel = { grp: g, ids: copies.map(e => e.id), part: !!sel.part && members(g).length > copies.length }; });
      return toast('Copied. Drag it where you want it.');
    }
    if (what === 'mirror') return mirror(list);
    if (what === 'pic') { picFor = list[0]; $('#mkPicIn').value = ''; $('#mkPicIn').click(); return; }
    if (what === 'nopic') return change(() => { list[0].src = ''; });
  }
  let picFor = null;
  $('#mkPicIn').addEventListener('change', async ev => {
    const f = ev.target.files[0], e = picFor; picFor = null; if (!f || !e) return;
    try { const url = await readPic(f); change(() => usePic(e, url)); toast('Picture changed.'); } catch (er) { toast(er.message, true); }
  });

  // ---- mirror: the other player's piece goes to the same place on the other side; if there isn't one, a copy is made for them
  const swapSide = s => String(s || '').replace(/\b1P\b/g, '§2').replace(/\b2P\b/g, '1P').replace(/§2/g, '2P').replace(/\bP1\b/g, '§3').replace(/\bP2\b/g, 'P1').replace(/§3/g, 'P2');
  const swapFields = s => String(s || '').replace(/\{p1\./g, '{§.').replace(/\{p2\./g, '{p1.').replace(/\{§\./g, '{p2.');
  function mirror(list) {
    const all = els(), mine = new Set(list.map(e => e.id));
    const twin = e => all.find(o => !mine.has(o.id) && o.kind === e.kind && ((e.name && o.name === swapSide(e.name) && o.name !== e.name) || (!e.name && (e.side === 1 || e.side === 2) && o.side === 3 - e.side)));
    const pairs = list.map(e => [e, twin(e)]);
    if (pairs.every(([, o]) => o)) {
      change(() => { for (const [e, o] of pairs) { o.x = W0 - e.x - e.w; o.y = e.y; o.w = e.w; o.h = e.h; } });
      return toast('The other side now matches.');
    }
    const g0 = list[0].grp || '', g = (/^gp1/.test(g0) ? 'gp2-' : /^gp2/.test(g0) ? 'gp1-' : 'g') + rid();
    const copies = list.map(e => {
      const c = structuredClone(e); c.id = rid(); c.grp = g; c.x = W0 - e.x - e.w; c.name = swapSide(e.name);
      if (c.side === 1 || c.side === 2) c.side = 3 - c.side;
      if (typeof c.text === 'string') c.text = swapFields(c.text);
      if (Array.isArray(c.pts)) c.pts = c.pts.map(([x, y]) => [1 - x, y]).reverse();
      return c;
    });
    change(() => { all.push(...copies); sel = { grp: g, ids: copies.map(e => e.id), part: false }; });
    toast('Made a copy for the other player, on the other side.');
  }

  // ============================================================================================================ keys
  let nudgeAt = 0;
  window.addEventListener('keydown', ev => {
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    // 1.5.7: a question on screen takes the keys (Escape = Cancel); nothing behind it moves or saves
    const modal = $('.mk-modal');
    if (modal) { if (ev.key === 'Escape' && modal.__cancel) { ev.preventDefault(); modal.__cancel(); } else if (mod && k === 's') ev.preventDefault(); return; }
    const f = document.activeElement, tag = f && f.tagName;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(tag) && f.type !== 'range' && f.type !== 'checkbox';
    if (mod && k === 's') { ev.preventDefault(); return save(); }
    if (typing) return;
    if (f && f.type === 'range' && /^(Arrow|Page|Home$|End$)/.test(ev.key)) return;     // 1.5.7: a slider keeps its own keys (they moved the piece)
    if (mod && k === 'z' && !ev.shiftKey) { ev.preventDefault(); return doUndo(); }
    if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); return doRedo(); }
    if (mod && k === 'd') { ev.preventDefault(); return act('dup'); }
    if (ev.key === 'Escape') { if (sel && sel.part && members(sel.grp).length > 1) act('whole'); else { sel = null; draw(); } return; }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); return act('del'); }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (dir && sel) {
      ev.preventDefault(); const n = ev.shiftKey ? 10 : 1, now = Date.now();
      change(() => { for (const e of selEls()) { e.x += dir[0] * n; e.y += dir[1] * n; } }, { soft: now - nudgeAt < 800 && undo.length });
      nudgeAt = now;
    }
  });
  $('#mkUndo').onclick = doUndo; $('#mkRedo').onclick = doRedo;

  // ============================================================================================================ behind the layout
  function setBehind(kind) {
    let pic = ''; try { pic = localStorage.getItem('mkBgPic') || ''; } catch {}
    if (kind === 'picture' && !pic) { $('#mkBgIn').click(); return; }
    const bg = $('#mkBg'); bg.className = 'mk-bg ' + kind; bg.style.backgroundImage = kind === 'picture' ? `url("${pic}")` : '';
    $$('#mkBehind button').forEach(b => b.classList.toggle('on', b.dataset.bg === kind));
    try { localStorage.setItem('mkBehind', kind); } catch {}
  }
  $('#mkBehind').addEventListener('click', ev => { const b = ev.target.closest('[data-bg]'); if (b) setBehind(b.dataset.bg); });
  $('#mkBgPick').onclick = () => { $('#mkBgIn').value = ''; $('#mkBgIn').click(); };
  $('#mkBgIn').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const url = await readPic(f, 1920);
      let small = url; try { const img = new Image(); await new Promise(r => { img.onload = r; img.src = url; }); const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(1280 * img.height / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); small = c.toDataURL('image/jpeg', .82); } catch {}
      try { localStorage.setItem('mkBgPic', small); } catch { toast('That picture is too big to keep for next time, but it’s behind your layout now.'); }
      $('#mkBg').style.backgroundImage = `url("${small}")`; $('#mkBg').className = 'mk-bg picture'; $$('#mkBehind button').forEach(b => b.classList.toggle('on', b.dataset.bg === 'picture'));
      try { localStorage.setItem('mkBehind', 'picture'); } catch {}
    } catch (er) { toast(er.message, true); }
  });

  // ============================================================================================================ save
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'my-layout';
  // save: over the layout you opened (or a new one named after the title); 'new' saves a copy under a free name;
  // 'replace' saves over `target` after you said yes. Resolves true once it's saved (after any question is answered), else false.
  let saving = false;
  async function save(mode, target) {
    if (!doc.design || saving) return false;               // 1.5.7: nothing open yet (Ctrl+S on the start screen), or a save already on its way
    saving = true;
    const title = $('#mkName').value.trim() || 'My layout', game = $('#mkGame').value || 'Any game';
    const d = JSON.parse(JSON.stringify(doc.design), (k, v) => (typeof v === 'string' && v.startsWith('mk-pic:') ? pics[v.slice(7)] || '' : v));
    d.title = title; d.game = game;
    let name = mode === 'replace' ? target : doc.name && mode !== 'new' ? doc.name : slug(title);
    const btn = $('#mkSave'); btn.disabled = true; btn.textContent = 'Saving…';
    let clash = null;
    try {
      if (mode === 'new') { const names = new Set((await api('/api/overlays').catch(() => [])).map(o => o.name)); let i = 2, n0 = name; while (names.has(name)) name = `${n0}-${i++}`; }
      const r = await api('/api/designs', { design: d, name, overwrite: mode === 'replace' || (!!doc.name && mode !== 'new'), nonce: rid(), palette: doc.palette });
      doc.name = r.name; doc.design.title = title; doc.design.game = game; savedSnap = snap();    // 1.5.7: only now does the maker point at the layout it saved
      history.replaceState(null, '', `/designer?edit=${encodeURIComponent(r.name)}`);
      document.title = `${title} | Layout maker`;
      liveBtn(r.active); toast(r.active ? 'Saved. OBS shows it now.' : 'Saved. It’s in the Layout menu.');
      return true;
    } catch (er) {
      if (er.status === 409) clash = er.body || {};
      else { toast(er.message, true); return false; }
    } finally { saving = false; btn.disabled = false; btn.textContent = 'Save'; drawState(); }
    // the name is taken: ask, and finish once you've answered
    if (clash.builtin) return ask(`“${title}” is the name of one of the app’s own layouts.`, 'Save this as a new layout with its own name?', [['Save as a new layout', () => save('new')]]);
    return ask(`You already have a layout called “${title}”.`, clash.designer ? 'Replace it with this one, or save this as a new layout?' : 'It wasn’t made in the layout maker, so this will be saved as a new layout.',
      [clash.designer ? ['Replace it', () => save('replace', name)] : null, ['Save as a new layout', () => save('new')]].filter(Boolean));
  }
  function liveBtn(active) { const b = $('#mkLive'); b.hidden = !doc.name; b.disabled = !!active; b.textContent = active ? 'On stream' : 'Put on stream'; }
  $('#mkSave').onclick = () => save();
  $('#mkLive').onclick = async () => {
    if (snap() !== savedSnap && !(await save())) return;
    try { await api('/api/overlays/active', { name: doc.name }); liveBtn(true); toast('It’s on stream.'); } catch (er) { toast(er.message, true); }
  };
  $('#mkName').addEventListener('input', () => drawState());
  $('#mkGame').addEventListener('change', () => drawState());
  // unsaved changes: a web browser asks "Leave site?" itself. The desktop app can't show that question, so it asks its own
  // (Save / Don't save / Keep editing) through these three (desktop/main.js, makerLeave)
  const unsaved = () => !!doc.design && snap() !== savedSnap;
  if (!/\bElectron\//.test(navigator.userAgent)) window.addEventListener('beforeunload', ev => { if (unsaved()) { ev.preventDefault(); ev.returnValue = ''; } });
  window.__mkUnsaved = unsaved;
  window.__mkTitle = () => $('#mkName').value.trim() || 'My layout';
  window.__mkSave = () => save();

  // a question over the maker; resolves with what the button you picked did (Cancel, Escape or a click outside: false)
  function ask(title, text, buttons) {
    return new Promise(done => {
      const m = document.createElement('div'); m.className = 'mk-modal';
      m.innerHTML = `<div class="mk-box" role="dialog" aria-modal="true" style="width:min(460px,100%)"><h2>${esc(title)}</h2><p class="lead">${esc(text)}</p><div class="mk-acts">${buttons.map(([l], i) => `<button class="btn${i === 0 ? ' primary' : ''}" data-i="${i}">${esc(l)}</button>`).join('')}<button class="btn ghost" data-i="x">Cancel</button></div></div>`;
      const close = async i => { m.remove(); done(i == null ? false : await buttons[i][1]()); };
      m.addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (!b && ev.target !== m) return; close(b && b.dataset.i !== 'x' ? +b.dataset.i : null); });
      m.__cancel = () => close(null);                       // Escape (the keys below)
      document.body.appendChild(m); m.querySelector('.btn').focus();
    });
  }

  // ============================================================================================================ opening
  let LAYOUTS = [];
  const builtInFor = (game, fam) => LAYOUTS.find(o => o.builtIn && !o.base && o.game === game && o.family === fam);
  async function open({ edit, from, empty }) {
    const r = await api(`/api/designs/get?name=${encodeURIComponent(edit || from)}`);
    const d = structuredClone(r.design); groupUp(d);
    kit = structuredClone(d);
    if (empty) for (const sc of Object.values(d.scenes)) if (sc === d.scenes.board) sc.elements = [];
    doc.design = d; doc.palette = r.palette ? { look: r.palette.look, colours: { ...(r.palette.colours || {}) } } : null;
    doc.name = edit && !r.builtIn ? r.name : '';
    $('#mkName').value = doc.name ? r.title : empty ? 'My layout' : `My ${r.title}`;
    $('#mkGame').value = r.game || 'Any game'; if (!$('#mkGame').value) $('#mkGame').value = 'Any game';
    document.title = `${$('#mkName').value} | Layout maker`;
    undo = []; redo = []; savedSnap = snap();      // 1.5.7: a new layout you haven't touched has nothing to lose (it counted as unsaved, and the desktop app wouldn't close it)
    scene = 'board'; sel = null; liveBtn(LAYOUTS.some(o => o.name === doc.name && o.active));
    draw();
    if (!kitFallback && (!kit || !Object.values(kit.scenes).some(s => (s.elements || []).some(e => e.kind === 'bar')))) {
      api('/api/designs/get?name=tekken8-default').then(f => { kitFallback = f.design; groupUp(kitFallback); }).catch(() => {});
    }
  }
  function startPicker() {
    const games = [...new Set(LAYOUTS.filter(o => o.builtIn && !o.base).map(o => o.game))];
    const m = document.createElement('div'); m.className = 'mk-modal';
    const cards = g => [['Classic', builtInFor(g, 'Classic'), 'Slate bars, red and blue for the players, gold for the win.'], ['Obsidian Glass', builtInFor(g, 'Obsidian Glass'), 'Black glass and antique gold that cracks as a player falls behind.'], ['Empty', builtInFor(g, 'Classic'), 'A clear screen in Classic’s style: drag on only what you want.']]
      .map(([t, o, s]) => `<button class="mk-start" data-start="${esc(t)}" ${o ? '' : 'disabled'}><span class="pic" style="${o && o.thumb && t !== 'Empty' ? `background-image:url('${esc(o.thumb)}')` : ''}">${t === 'Empty' ? 'Start with nothing on the scoreboard' : o && o.thumb ? '' : esc(t)}</span><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('');
    m.innerHTML = `<div class="mk-box" role="dialog" aria-modal="true"><h2>Make a layout</h2><p class="lead">Pick where to start. Everything can be moved, resized and recoloured after, and the VS, Victory and Top 8 screens come with it.</p>
      <label class="mk-row" style="grid-template-columns:60px 260px"><span>Game</span><select class="f" id="mkStartGame">${games.map(g => `<option>${esc(g)}</option>`).join('')}</select></label>
      <div class="mk-starts" id="mkStarts">${cards(games[0])}</div>
      <div class="mk-acts" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Close the layout maker</button></div></div>`;
    m.__cancel = () => window.close();                      // 1.5.7: Escape, or the button: a way out before anything's open
    document.body.appendChild(m);
    $('#mkStartGame').onchange = () => { $('#mkStarts').innerHTML = cards($('#mkStartGame').value); };
    m.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) return window.close();
      const b = ev.target.closest('[data-start]'); if (!b) return;
      const g = $('#mkStartGame').value, o = builtInFor(g, b.dataset.start === 'Empty' ? 'Classic' : b.dataset.start); if (!o) return;
      m.remove(); open({ from: o.name, empty: b.dataset.start === 'Empty' }).then(() => history.replaceState(null, '', `/designer?from=${encodeURIComponent(o.name)}${b.dataset.start === 'Empty' ? '&empty=1' : ''}`)).catch(er => toast(er.message, true));
    });
    m.querySelector('.mk-start').focus();
  }

  async function boot() {
    fit(); window.addEventListener('resize', fit);
    let behind = 'checker'; try { behind = localStorage.getItem('mkBehind') || 'checker'; } catch {}
    setBehind(behind === 'picture' && !(() => { try { return localStorage.getItem('mkBgPic'); } catch { return ''; } })() ? 'checker' : behind);
    try { LAYOUTS = await api('/api/overlays'); } catch { LAYOUTS = []; }
    const games = [...new Set(LAYOUTS.filter(o => !o.base).map(o => o.game).filter(Boolean))];
    if (!games.includes('Any game')) games.push('Any game');
    $('#mkGame').innerHTML = games.map(g => `<option>${esc(g)}</option>`).join('');
    const q = new URLSearchParams(location.search), edit = q.get('edit'), from = q.get('from');
    if (edit || from) { try { await open({ edit, from, empty: q.get('empty') === '1' }); return; } catch (er) { toast(er.message, true); } }
    startPicker();
  }
  boot();
})();
