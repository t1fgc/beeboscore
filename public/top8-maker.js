/* BeeboScore (developed by Beebo) — the Top 8 results picture for socials (Testbuild 1.12.6).
 *
 * When a viewer tournament or a start.gg bracket finishes, the app asks whether to make one. Drop a character picture on each
 * player (best: 600 × 720 px, PNG with a see-through background — the panel above the name is 5 : 6), pick the shape
 * (landscape, portrait, square, story or your own size), and save it: to BeeboScore's own folder, or anywhere with Save as….
 * It's drawn in the colours of the layout you're using, with a background made to stand out in a feed.
 *
 *   BeeboTop8.open()   the maker, filled with the last finished bracket
 *   BeeboTop8.ask(d)   the "it's done — make the picture?" prompt (d from the server's top8-ready message)
 */
(() => {
  'use strict';
  if (window.BeeboTop8) return;
  const P = () => window.BeeboPanel || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (m, bad) => P().toast && P().toast(m, bad);
  const SHAPES = { landscape: [1920, 1080, 'Landscape 1920 × 1080 (X, YouTube, Discord)'], portrait: [1080, 1350, 'Portrait 1080 × 1350 (Instagram feed)'], square: [1080, 1080, 'Square 1080 × 1080'], story: [1080, 1920, 'Story 1080 × 1920 (TikTok, Reels, Stories)'], custom: [1600, 900, 'Your own size…'] };
  const PANEL = { w: 600, h: 720 };          // the recommended character picture (5 : 6)
  // each layout's colours (Obsidian Glass, Porcelain, Default)
  const THEMES = {
    obsidian: { eight: '#ffc93a', halo: '#ffe9a8', bg: ['#070605', '#17120a', '#2c2010'], glow: ['#c98f26', '#f6dc96'], card: ['#1d1810', '#0e0c08'], edge: '#e0a93b', ink: '#ffffff', sub: '#f2d79a', gold: '#ffe2a1', first: ['#5a3c08', '#1c1303'], title: ['#ffffff', '#ffe2a1', '#c98f26'] },
    porcelain: { eight: '#ffffff', halo: '#fff6dc', bg: ['#fbf8f1', '#efe6d2', '#d9c79a'], glow: ['#e9c35e', '#ffffff'], card: ['#ffffff', '#f3ecdc'], edge: '#141210', ink: '#141210', sub: '#7a5a12', gold: '#b0841f', first: ['#fff3cc', '#e9c35e'], title: ['#141210', '#3a2806', '#b0841f'] },
    default: { eight: '#ff3b5c', halo: '#ffe3e8', bg: ['#0b0e14', '#141a26', '#1d2433'], glow: ['#ff5a1f', '#3fb6ff'], card: ['#1b2130', '#0f131c'], edge: '#ff7a3a', ink: '#ffffff', sub: '#9fb2cc', gold: '#ffb36b', first: ['#4a2412', '#140a05'], title: ['#ffffff', '#ffd0b0', '#ff5a1f'] },
  };
  const css = `
.t8m-back{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px}
.t8m{width:min(1180px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--card);border:1px solid var(--line-2,var(--line));border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.6);padding:18px 20px}
.t8m h3{margin:0 0 2px;font-size:18px}.t8m .hint{margin:0 0 12px}
.t8m-body{display:grid;grid-template-columns:320px 1fr;gap:18px}@media(max-width:900px){.t8m-body{grid-template-columns:1fr}}
.t8m-side{display:flex;flex-direction:column;gap:8px;min-width:0}
.t8m-slot{display:grid;grid-template-columns:30px 54px 1fr;gap:10px;align-items:center;padding:6px 8px;border-radius:8px;background:rgba(127,127,127,.08);border:1px dashed transparent}
.t8m-slot.over{border-color:var(--accent);background:rgba(127,127,127,.18)}
.t8m-slot b{font-variant-numeric:tabular-nums;color:var(--muted);text-align:center}
.t8m-th{width:54px;height:65px;border-radius:6px;background:rgba(127,127,127,.18) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:20px;cursor:pointer;border:1px solid var(--line)}
.t8m-slot span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.t8m-slot small{display:block;color:var(--muted);font-size:11px}
.t8m-prev{position:relative;background:#111;border-radius:10px;display:flex;align-items:center;justify-content:center;min-height:340px;padding:10px}
.t8m-prev canvas{max-width:100%;max-height:62vh;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.t8m-opts{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 10px}.t8m-opts select,.t8m-opts input{max-width:100%}
.t8m-opts input[type=number]{width:84px}
.t8m-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
.t8m-ask{position:fixed;right:18px;bottom:18px;z-index:8999;width:min(380px,calc(100% - 36px));background:var(--card);border:1px solid var(--line-2,var(--line));border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.5);padding:14px 16px}
.t8m-ask h4{margin:0 0 4px;font-size:15px}.t8m-ask p{margin:0 0 10px;color:var(--muted);font-size:13px}.t8m-ask div{display:flex;gap:8px;justify-content:flex-end}`;
  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const st = document.createElement('style');
    st.textContent = css + `@font-face{font-family:'T8 Rocker';src:url(/static/fonts/new-rocker-latin-400-normal.woff2) format('woff2')}@font-face{font-family:'T8 Saira';font-weight:800;src:url(/static/fonts/saira-condensed-latin-800-normal.woff2) format('woff2')}@font-face{font-family:'T8 Chakra';font-weight:700;src:url(/static/fonts/chakra-petch-latin-700-normal.woff2) format('woff2')}`;
    document.head.appendChild(st);
  }
  const themeId = () => { const a = String((P().active && P().active()) || ''); return /porcelain/.test(a) ? 'porcelain' : /default/.test(a) ? 'default' : 'obsidian'; };
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  // ------------------------------------------------------------------------------------------- drawing
  const loadImg = src => new Promise(ok => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  function fitText(g, text, maxW, size, weight, family) {
    let s = size; g.font = `${weight} ${s}px ${family}`;
    while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = `${weight} ${s}px ${family}`; }
    return s;
  }
  function slant(g, x, y, w, h, k) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + w, y); g.lineTo(x + w - k, y + h); g.lineTo(x, y + h); g.closePath(); }
  function background(g, W, H, T, seed) {
    const L = g.createLinearGradient(0, 0, W * .3, H); T.bg.forEach((c, i) => L.addColorStop(i / (T.bg.length - 1), c)); g.fillStyle = L; g.fillRect(0, 0, W, H);
    // two big glows in the layout's colours
    for (const [c, x, y, r] of [[T.glow[0], W * .18, H * .2, Math.max(W, H) * .75], [T.glow[1], W * .9, H * .95, Math.max(W, H) * .65]]) {
      const R = g.createRadialGradient(x, y, 0, x, y, r); R.addColorStop(0, c + '88'); R.addColorStop(.45, c + '22'); R.addColorStop(1, c + '00'); g.fillStyle = R; g.fillRect(0, 0, W, H);
    }
    // glass shards: long diagonal panes with a bright edge
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W * 1.2 - W * .1, w = (60 + rnd() * 220) * (W / 1920 + .4), a = .03 + rnd() * .07;
      g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.moveTo(x, -10); g.lineTo(x + w, -10); g.lineTo(x + w - H * .45, H + 10); g.lineTo(x - H * .45, H + 10); g.closePath(); g.fill();
      g.strokeStyle = `rgba(255,255,255,${a * 2.2})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w, -10); g.lineTo(x + w - H * .45, H + 10); g.stroke();
    }
    g.restore();
    // a ghost TOP 8 across the back
    g.save(); g.globalAlpha = T === THEMES.porcelain ? .07 : .06; g.fillStyle = T.ink; g.font = `800 ${Math.round(Math.min(W, H) * .62)}px 'T8 Saira', 'Saira Condensed', sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(W / 2, H * .55); g.rotate(-.12); g.fillText('TOP 8', 0, 0); g.restore();
    // a soft vignette
    const V = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .8); V.addColorStop(0, 'rgba(0,0,0,0)'); V.addColorStop(1, T === THEMES.porcelain ? 'rgba(90,60,8,.18)' : 'rgba(0,0,0,.55)'); g.fillStyle = V; g.fillRect(0, 0, W, H);
  }
  function card(g, T, p, x, y, w, h, img, first) {
    const k = Math.round(w * .06), nameH = Math.max(34, Math.round(h * .17)), pz = { x: x + 4, y: y + 4, w: w - 8, h: h - nameH - 8 };
    g.save();
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = Math.round(w * .08); g.shadowOffsetY = Math.round(w * .03);
    slant(g, x, y, w, h, k); const C = g.createLinearGradient(0, y, 0, y + h); (first ? T.first : T.card).forEach((c, i) => C.addColorStop(i, c)); g.fillStyle = C; g.fill();
    g.restore();
    // the picture, whole, standing on the name band
    g.save(); slant(g, x, y, w, h, k); g.clip();
    const glow = g.createRadialGradient(x + w / 2, pz.y + pz.h * .75, 0, x + w / 2, pz.y + pz.h * .75, w * .7); glow.addColorStop(0, T.glow[0] + '66'); glow.addColorStop(1, T.glow[0] + '00'); g.fillStyle = glow; g.fillRect(x, y, w, h);
    if (img) { const r = Math.min(pz.w / img.width, pz.h / img.height), iw = img.width * r, ih = img.height * r; g.drawImage(img, x + (w - iw) / 2, pz.y + pz.h - ih, iw, ih); }
    else { g.fillStyle = T.ink; g.globalAlpha = .12; g.font = `800 ${Math.round(pz.h * .62)}px 'T8 Saira', 'Saira Condensed', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(p.name || '?').trim().charAt(0).toUpperCase(), x + w / 2, pz.y + pz.h * .55); g.globalAlpha = 1; }
    // the name band
    const ny = y + h - nameH; const NB = g.createLinearGradient(0, ny, 0, y + h); NB.addColorStop(0, 'rgba(0,0,0,.0)'); NB.addColorStop(.25, T === THEMES.porcelain ? 'rgba(20,18,16,.88)' : 'rgba(0,0,0,.72)'); NB.addColorStop(1, T === THEMES.porcelain ? 'rgba(20,18,16,.95)' : 'rgba(0,0,0,.85)');
    g.fillStyle = NB; g.fillRect(x, ny - nameH * .3, w, nameH * 1.3);
    g.restore();
    g.save(); slant(g, x, y, w, h, k); g.lineWidth = Math.max(2, Math.round(w * .012)); g.strokeStyle = first ? T.gold : T.edge; g.stroke(); g.restore();
    // place + name
    const name = String(p.name || '').toUpperCase(), fam = "'T8 Saira', 'Saira Condensed', sans-serif";
    const s = fitText(g, name, w - k * 2 - 12, Math.round(nameH * .62), 800, fam);
    g.fillStyle = T === THEMES.porcelain ? '#fdfbf6' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `italic 800 ${s}px ${fam}`; g.fillText(name, x + w / 2 - k / 2, ny + nameH * .55);
    const ps = Math.round(Math.min(w * .22, h * .16)); g.font = `italic 800 ${ps}px ${fam}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.lineWidth = Math.max(3, ps * .1); g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(ord(p.place), x + k + 8, y + 8);
    const PG = g.createLinearGradient(0, y + 8, 0, y + 8 + ps); PG.addColorStop(0, '#ffffff'); PG.addColorStop(1, first ? T.gold : T.edge); g.fillStyle = PG; g.fillText(ord(p.place), x + k + 8, y + 8);
  }
  async function draw(cv, S) {
    const [W, H] = S.size, g = cv.getContext('2d'); cv.width = W; cv.height = H;
    try { await Promise.all([document.fonts.load("40px 'T8 Rocker'"), document.fonts.load("800 40px 'T8 Saira'"), document.fonts.load("700 20px 'T8 Chakra'")]); } catch {}
    const T = THEMES[S.theme] || THEMES.obsidian; background(g, W, H, T, 7 + W + H);
    const imgs = await Promise.all(S.players.map(p => loadImg(S.pics[p.place + '|' + p.name] || p.pic || '')));
    const land = W / H >= 1.2, m = Math.round(Math.min(W, H) * .045), fam = "'T8 Saira', 'Saira Condensed', sans-serif";
    // the title
    const th = Math.round(Math.min(W, H) * (land ? .13 : .1));
    // 1.12.9: like the Top 8 splash — TOP in a harsh blackletter, the 8 in the look's harshest colour with a heavenly glow
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = `${th}px 'T8 Rocker', ${fam}`;
    const TG = g.createLinearGradient(0, m, 0, m + th); T.title.forEach((c, i) => TG.addColorStop(i / (T.title.length - 1), c)); g.fillStyle = TG; g.fillText('TOP', m, m + th * .86);
    const tTop = g.measureText('TOP ').width, eight = T.eight || T.gold;
    g.save(); g.font = `${Math.round(th * 1.12)}px 'T8 Rocker', ${fam}`; g.shadowColor = T.halo || '#fff4cc'; g.shadowBlur = th * .35; g.fillStyle = eight; g.fillText('8', m + tTop, m + th * .9); g.shadowBlur = th * .12; g.fillText('8', m + tTop, m + th * .9); const t8w = g.measureText('8').width; g.restore();
    const tw = tTop + t8w;
    const ev = String(S.event || 'Tournament').toUpperCase(), es = fitText(g, ev, W - m * 3 - tw, Math.round(th * .42), 800, fam);
    g.font = `italic 800 ${es}px ${fam}`; g.fillStyle = T.ink; g.fillText(ev, m * 2 + tw, m + th * .5);
    g.font = `700 ${Math.round(th * .17)}px 'T8 Chakra', 'Chakra Petch', sans-serif`; g.fillStyle = T.sub;
    const sub = [S.game, S.entrants ? `${S.entrants} PLAYERS` : '', S.date].filter(Boolean).join('  ·  ').toUpperCase();
    try { g.letterSpacing = '3px'; } catch {}
    g.fillText(sub, m * 2 + tw, m + th * .82);
    try { g.letterSpacing = '0px'; } catch {}
    const top = m * 1.6 + th, list = S.players.slice(0, 8), at = i => list[i], img = i => imgs[i];
    const R = 5 / 6;   // the picture panel is 5 : 6; the card adds the name band
    if (land) {
      const heroW = Math.round((W - m * 2) * .3), heroH = H - top - m, gx = m * 2 + heroW, gw = W - gx - m;
      if (at(0)) card(g, T, at(0), m, top, heroW, heroH, img(0), true);
      const rowH = (heroH - m * .6) / 2, w3 = (gw - m * .6 * 2) / 3, w4 = (gw - m * .6 * 3) / 4;
      for (let i = 1; i < 4; i++) if (at(i)) card(g, T, at(i), gx + (i - 1) * (w3 + m * .6), top, w3, rowH, img(i));
      for (let i = 4; i < 8; i++) if (at(i)) card(g, T, at(i), gx + (i - 4) * (w4 + m * .6), top + rowH + m * .6, w4, rowH, img(i));
    } else {
      const avail = H - top - m, heroH = avail * .44, heroW = Math.min(W - m * 2, heroH * R * 1.05), gap = m * .5;
      if (at(0)) card(g, T, at(0), (W - heroW) / 2, top, heroW, heroH, img(0), true);
      const rest = avail - heroH - gap * 2, h3 = rest * .54, h4 = rest - h3, w3 = (W - m * 2 - gap * 2) / 3, w4 = (W - m * 2 - gap * 3) / 4;
      for (let i = 1; i < 4; i++) if (at(i)) card(g, T, at(i), m + (i - 1) * (w3 + gap), top + heroH + gap, w3, h3, img(i));
      for (let i = 4; i < 8; i++) if (at(i)) card(g, T, at(i), m + (i - 4) * (w4 + gap), top + heroH + gap * 2 + h3, w4, h4, img(i));
    }
    // credit, small, bottom right
    g.font = `700 ${Math.max(11, Math.round(Math.min(W, H) * .014))}px 'T8 Chakra', 'Chakra Petch', sans-serif`; g.fillStyle = T.sub; g.globalAlpha = .7; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText('BEEBOSCORE', W - m * .6, H - m * .3); g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------------------------------- the window
  async function open() {
    style();
    let d; try { d = await P().api('/api/top8/data'); } catch (e) { return toast(e.message, true); }
    if (!d || !(d.players || []).length) return toast('No finished bracket yet — the Top 8 picture is made from one.', true);
    const S = { theme: themeId(), shape: 'landscape', size: SHAPES.landscape.slice(0, 2), event: d.event, game: d.game, entrants: d.entrants, date: d.date, players: d.players.slice(0, 8), pics: {} };
    const back = document.createElement('div'); back.className = 't8m-back';
    back.innerHTML = `<div class="t8m" role="dialog" aria-label="Top 8 results picture">
      <h3>🏆 Top 8 results picture</h3>
      <p class="hint">Drop a character picture on each player — <b>best size ${PANEL.w} × ${PANEL.h} px</b> (5 : 6), a PNG with a see-through background. It stands on the name, above it. Drawn in your layout’s colours; save it to BeeboScore Lite’s folder or anywhere you like.</p>
      <div class="t8m-opts"><label>Shape <select class="f" data-o="shape">${Object.entries(SHAPES).map(([k, v]) => `<option value="${k}">${v[2]}</option>`).join('')}</select></label>
        <span data-o="custom" hidden><input class="f" type="number" min="600" max="4096" step="10" data-o="w" value="1600"> × <input class="f" type="number" min="600" max="4096" step="10" data-o="h" value="900"> px</span>
        <label>Colours <select class="f" data-o="theme"><option value="obsidian">Obsidian Glass</option><option value="porcelain">Porcelain</option><option value="default">Default</option></select></label>
        <label>Title <input class="f" type="text" data-o="event" maxlength="60" value="${esc(S.event)}"></label></div>
      <div class="t8m-body"><div class="t8m-side">${S.players.map((p, i) => `<div class="t8m-slot" data-i="${i}"><b>${ord(p.place)}</b><span class="t8m-th" data-pick title="Click or drop a picture">${p.pic ? '' : '＋'}</span><span><b style="color:var(--text)">${esc(p.name)}</b><small>${p.pic ? 'Their saved character image — drop another to change it' : 'Drop a picture here'}</small></span></div>`).join('')}</div>
        <div class="t8m-prev"><canvas></canvas></div></div>
      <div class="t8m-acts"><button class="btn ghost" data-a="folder">📂 Open the folder</button><span style="flex:1"></span><button class="btn ghost" data-a="close">Close</button><button class="btn" data-a="saveas">⬇ Save as…</button><button class="btn primary" data-a="save">💾 Save to BeeboScore Lite’s folder</button></div></div>`;
    document.body.appendChild(back);
    const cv = back.querySelector('canvas'), $ = s => back.querySelector(s);
    $('[data-o=theme]').value = S.theme;
    back.querySelectorAll('.t8m-slot').forEach(sl => { const p = S.players[+sl.dataset.i]; if (p.pic) sl.querySelector('.t8m-th').style.backgroundImage = `url("${p.pic}")`; });
    let t = 0; const redraw = () => { clearTimeout(t); t = setTimeout(() => draw(cv, S), 60); };
    const setPic = (i, file) => {
      if (!file || !/^image\//.test(file.type)) return toast('That isn’t a picture.', true);
      const url = URL.createObjectURL(file), p = S.players[i]; S.pics[p.place + '|' + p.name] = url;
      const sl = back.querySelector(`.t8m-slot[data-i="${i}"]`); sl.querySelector('.t8m-th').style.backgroundImage = `url("${url}")`; sl.querySelector('.t8m-th').textContent = '';
      const im = new Image(); im.onload = () => { sl.querySelector('small').textContent = `${im.width} × ${im.height}${im.width < PANEL.w * .6 || im.height < PANEL.h * .6 ? ' — small, it may look soft' : ''}`; }; im.src = url;
      redraw();
    };
    back.addEventListener('dragover', e => { const sl = e.target.closest('.t8m-slot'); if (!sl) return; e.preventDefault(); sl.classList.add('over'); });
    back.addEventListener('dragleave', e => { const sl = e.target.closest('.t8m-slot'); if (sl) sl.classList.remove('over'); });
    back.addEventListener('drop', e => { const sl = e.target.closest('.t8m-slot'); if (!sl) return; e.preventDefault(); sl.classList.remove('over'); setPic(+sl.dataset.i, e.dataTransfer.files[0]); });
    // dropped on the preview: the card under the pointer gets it (nearest by order of the list)
    cv.addEventListener('dragover', e => e.preventDefault());
    back.addEventListener('click', async e => {
      if (e.target === back) return close();
      const pk = e.target.closest('[data-pick]'); if (pk) { const i = +pk.closest('.t8m-slot').dataset.i, inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => setPic(i, inp.files[0]); inp.click(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') return close();
      if (a.dataset.a === 'folder') return P().api('/api/top8/open-folder', { method: 'POST' }).catch(er => toast(er.message, true));
      await draw(cv, S);
      const fname = `${(S.event || 'Top 8').replace(/[^\w\- ]+/g, '').trim() || 'Top 8'} - Top 8 ${S.size[0]}x${S.size[1]}.png`;
      if (a.dataset.a === 'saveas') {
        cv.toBlob(b => { const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = fname; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png');
      } else {
        try { const r = await P().api('/api/top8/save', { method: 'POST', body: { name: fname, png: cv.toDataURL('image/png') } }); toast(`Saved — ${r.file}`); } catch (er) { toast(er.message, true); }
      }
    });
    back.addEventListener('change', e => {
      const o = e.target.dataset.o; if (!o) return;
      if (o === 'shape') { S.shape = e.target.value; $('[data-o=custom]').hidden = S.shape !== 'custom'; S.size = S.shape === 'custom' ? [+$('[data-o=w]').value || 1600, +$('[data-o=h]').value || 900] : SHAPES[S.shape].slice(0, 2); }
      if (o === 'w' || o === 'h') S.size = [Math.max(600, Math.min(4096, +$('[data-o=w]').value || 1600)), Math.max(600, Math.min(4096, +$('[data-o=h]').value || 900))];
      if (o === 'theme') S.theme = e.target.value;
      redraw();
    });
    back.addEventListener('input', e => { if (e.target.dataset.o === 'event') { S.event = e.target.value; redraw(); } });
    const key = e => { if (e.key === 'Escape') close(); }; addEventListener('keydown', key);
    function close() { removeEventListener('keydown', key); back.remove(); for (const u of Object.values(S.pics)) URL.revokeObjectURL(u); }
    draw(cv, S);
  }
  function ask(d) {
    style();
    document.querySelectorAll('.t8m-ask').forEach(x => x.remove());
    const box = document.createElement('div'); box.className = 't8m-ask';
    box.innerHTML = `<h4>🏆 ${esc((d && d.name) || 'The bracket')} is done</h4><p>Make a Top 8 results picture for socials? Add a character picture for each player, pick the shape, and save it.</p><div><button class="btn ghost" data-a="later">Later</button><button class="btn primary" data-a="go">Customise it</button></div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; box.remove(); if (a.dataset.a === 'go') open(); });
  }
  window.addEventListener('beebo:top8ready', e => ask(e.detail));
  window.BeeboTop8 = { open, ask, draw, THEMES, SHAPES };
})();
