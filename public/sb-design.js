/*
 * BeeboScore Layout Designer — runtime.
 *
 * Draws a layout from a design (JSON) and brings it to life: player bars, header, commentators,
 * logos, shapes and text, with gradients, outlines, rounded corners and scissor cuts; five effects
 * (embers, lightning, glow pulse, shine, cracks); five transitions (shatter, slash, ignite, glitch,
 * slam); and its own VS Splash and victory screens.
 *
 * Used twice, so what you build is exactly what goes on stream:
 *   • the designer's preview:  SBDesign.mount(el, design, { edit: true })
 *   • a saved layout:          <script id="sb-design" type="application/json">{…}</script> + this file
 */
(function () {
  'use strict';
  // 1.5.5: the colours this draws with when a layout doesn't say, moved with your colours for the app's own layouts (public/sb-colours.js)
  const UC = (r, c, anchor) => (window.SBColours && window.SBColours.on ? window.SBColours.as(r, c, anchor) : c);
  const SEEDNOW = () => (window.BeeboFX4 ? window.BeeboFX4.seedNow() : Date.now());   // 1.12.15: seeds follow "Same every time" (and tests)
  if (window.SBDesign) return;
  const CORE = window.__SBDCore;     // 1.12.11: the core lives in sb-design-core.js (served first, in the same /sb-design.js)
  const { contrast, clockText, EFFECTS, FONTS, FX2, FXL, H, IDLE, JUST, KIND, OUTS, PARTICLES, POTATO, REACT, RULE_OPS, SAMPLE, SCORE_SHAPES, SCREENS, SHAPES, TEXTANIM, TEXTFX, TEXTURES, TRANSITIONS, W, WHEN, addCSS, alignOf, allEmpty, brPic, cols, crackPaths, cssPaint, cutFor, decode, derive, drawBracket, esc, fillText, fitText, fontOf, hasTime, hexRgb, listItems, loadFonts, lum, make, mix, need3d, normalize, pathFor, pick, plateTone, polyOf, readable, rng, ruleOk, setText, svgGrad, svgPaint, textPaint, themed, two, view } = CORE;
  let UID = 0;

  function mount(host, design, opts = {}) {
    addCSS(); if (FXL) { FXL.addCSS(); FXL.filters(); }
    const uid = ++UID;
    const root = document.createElement('div');
    root.className = 'sd-root' + (opts.edit ? ' sd-edit' : '');
    host.appendChild(root);
    const urlScreen = opts.live ? new URLSearchParams(location.search).get('screen') || '' : '';
    const cv = document.createElement('canvas'); cv.className = 'sd-cv';
    const ctx = cv.getContext('2d');
    let D = themed(normalize(design)), S = derive(opts.state || SAMPLE), V = view(S);
    CORE.setCtx(D, opts);
    let W = 1920, H = 1080;               // this layout's canvas (1920×1080, vertical 1080×1920, square…)
    // 1.12.18: 4K — on a browser source bigger than the layout, the particle canvas draws at that size (up to twice), so
    // sparks and bolts stay sharp; it drops back to the layout's size if the PC can't keep up (SBPerf's quality)
    const outK = () => { if (!opts.live || opts.thumb) return 1; const k = Math.min(innerWidth / W, innerHeight / H) || 1, q = window.SBPerf ? window.SBPerf.q : 1; return q < .8 ? 1 : Math.max(1, Math.min(2, Math.round(k * 4) / 4)); };
    function sizeCanvas() { const o = outK(); window.__SB_OUT = o; if (cv.width !== W * o || cv.height !== H * o) { cv.width = W * o; cv.height = H * o; ctx.setTransform(o, 0, 0, o, 0, 0); } }
    function sizeUp() {
      W = D.size.w; H = D.size.h;
      root.style.width = W + 'px'; root.style.height = H + 'px';
      sizeCanvas();
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      if (opts.live) fitWindow();
    }
    // OBS at 1280×720, 2560×1440 or 3840×2160: everything scales to fit, so any browser-source size works.
    // 1.12.21: the PAGE is the stage — the body is laid out at the layout's own size and scaled as a whole. It used to be
    // this layout's root alone that scaled, so everything else the app draws at 1920 × 1080 beside it (FullVS, GlassVS, a
    // game format's bar and splashes, the commentary screen, the event logo) stayed 1920 × 1080 in the top-left corner of
    // a 4K source, and ran off the bottom of a 720p one. The layers that had learnt to scale themselves (the show layer,
    // the stats card) measure the body's own scale and only make up the difference — none, here.
    function fitWindow() {
      const vw = innerWidth, vh = innerHeight; if (!vw || !vh) return;
      const k = Math.min(vw / W, vh / H), b = document.body, de = document.documentElement;
      root.style.transform = '';
      if (b) { b.style.width = W + 'px'; b.style.height = H + 'px'; b.style.transformOrigin = '0 0'; b.style.transform = Math.abs(k - 1) < .004 ? '' : `scale(${k})`;
        de.style.width = vw + 'px'; de.style.height = vh + 'px'; de.style.overflow = 'hidden'; }
      else { root.style.transformOrigin = '0 0'; root.style.transform = Math.abs(k - 1) < .004 ? '' : `scale(${k})`; }
      window.__SB_PAGE_K = k;
      sizeCanvas();
      try { dispatchEvent(new Event('sb:fit')); } catch (e) {}
    }
    if (opts.live) addEventListener('resize', fitWindow);
    sizeUp();
    loadFonts(D);
    // BeeboFX (sb-gfx.js): the GPU effects engine — hits, flames, real lightning, embers. Off in potato mode and in
    // still renders (stills, thumbnails, tests that freeze a frame), where the CSS effects draw as before.
    let GFX = null;
    // 1.12.21: a soft reload (the seamless refresh after a reset, or effects switched back on) is a live copy that only skips
    // its intro — it used to count as a still, so the engine never came back until the page was reloaded by hand.
    const stillRender = /[?&](potato|shot)(&|=|$)/.test(location.search) || (!window.__SB_SOFT && (!!window.__SB_INSTANT || /[?&]instant(&|=|$)/.test(location.search)));
    if (window.BeeboFX && !POTATO() && !stillRender && !opts.thumb) {
      GFX = window.BeeboFX.attach(root, { W: () => W, H: () => H, preset: () => (D.gfx && D.gfx.preset) || '', intensity: () => Number(D.gfx && D.gfx.intensity) || 1,
        fullScene: () => Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k)), sceneEl: n => scenes[n] || null, pieces: gfxPieces,
        stack: type => { const m = D.gfx && D.gfx.moments && D.gfx.moments[type]; return m && ((m.items && m.items.length) || m.replace) ? m : null; }, jolt: sd => jolt(barOf(sd)), plateFx: (sd, k) => (k === 'slice' ? slicePlate : fissure)(barOf(sd), null, true), mask: gfxMask, rect: gfxRect, punch: gfxPunch });
      if (GFX) root.__gfx = GFX;
    }
    // on the scoreboard the engine may only draw inside the layout's own pieces (never over the game's HUD)
    function gfxPieces() {
      const out = [];
      for (const r of doms.values()) {
        if (r.scene !== 'board' || !r.node || r.node.style.visibility === 'hidden' || r.node.classList.contains('sd-rule-off') || r.node.style.display === 'none') continue;
        const e = r.el; if (e.w > 0 && e.h > 0) out.push({ x: e.x, y: e.y, w: e.w, h: e.h });
      }
      return out;
    }
    // …as an exact silhouette (the stepped plates, slanted ends): a mask the engine clips to, rebuilt when the pieces change
    let maskCv = null, maskKey = '', maskVer = 0;
    function gfxMask() {
      const list = []; for (const r of doms.values()) {
        if (r.scene !== 'board' || !r.node || r.node.style.visibility === 'hidden' || r.node.classList.contains('sd-rule-off') || r.node.style.display === 'none') continue;
        const e = r.el; if (e.w > 0 && e.h > 0) list.push(e);
      }
      const key = W + 'x' + H + '|' + list.map(e => [e.id, e.x, e.y, e.w, e.h, e.shape, e.radius, e.rot || 0].join(',')).join(';');
      if (key !== maskKey || !maskCv) {
        maskKey = key; maskVer++;
        if (!maskCv) maskCv = document.createElement('canvas');
        maskCv.width = W; maskCv.height = H; const x = maskCv.getContext('2d'); x.clearRect(0, 0, W, H); x.fillStyle = '#fff';
        for (const e of list) { x.save(); x.translate(e.x, e.y); if (e.rot) { x.translate(e.w / 2, e.h / 2); x.rotate(e.rot * Math.PI / 180); x.translate(-e.w / 2, -e.h / 2); }
          try { if (['bar', 'header', 'shape', 'panel', 'comms'].includes(e.kind)) x.fill(new Path2D(pathFor(e, e.w, e.h))); else x.fillRect(0, 0, e.w, e.h); } catch (er) { x.fillRect(0, 0, e.w, e.h); } x.restore(); }
      }
      return { canvas: maskCv, ver: maskVer };
    }
    function gfxRect(sd, what) {
      for (const r of doms.values()) {
        if (r.el.kind !== 'bar' || r.el.side !== sd || r.scene !== 'board') continue;
        const e = r.el;
        if (what === 'score' && r.parts.scoreBox && r.parts.scoreBox.offsetWidth) {
          const a = root.getBoundingClientRect(), b = r.parts.scoreBox.getBoundingClientRect(), k = a.width / W || 1;
          return { x: (b.left - a.left) / k, y: (b.top - a.top) / k, w: b.width / k, h: b.height / k };
        }
        return { x: e.x, y: e.y, w: e.w, h: e.h };
      }
      return null;
    }
    // a hit: the plate kicks out sideways and settles (sideways only, so it never reaches into the HUD below)
    function gfxPunch(sd, k) {
      for (const r of doms.values()) if (r.el.kind === 'bar' && r.el.side === sd && r.scene === 'board' && r.parts.inn) {
        try { r.parts.inn.animate([{ transform: `scaleX(${Math.min(1.035, k)})` }, { transform: 'scaleX(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.2)', composite: 'add' }); } catch (e) {}
      }
    }
    const doms = new Map();            // element id → { el, node, parts }
    const rc0 = c => { if (typeof c !== 'string' || c[0] !== '@') return c || UC('effects', '#ff5a1f', '#ff5a1f'); const t = ((D.theme && D.theme.colors) || []).find(x => '@' + x.id === c); return t ? t.value : UC('effects', '#ff5a1f', '#ff5a1f'); };
    const fxApi = { get root() { return root; }, get W() { return W; }, get H() { return H; }, path: (el, w, h) => pathFor(el, w, h), outline: (el, w, h) => pathFor(el, w, h, 0, true), anim: (n, k, o) => anim(n, k, o), later: (fn, ms) => later(fn, ms), spark: (...a) => spark(...a), ring: (...a) => ring(...a) };
    // 3D pieces (sb-3d.js + three.js, loaded only when a layout has one)
    const ctx3 = { uid, color: c => rc0(c), font: k => fontOf(D, k), text: tpl => fillText(tpl, V), url: tpl => fillText(tpl, V) };
    function hook3d(parts, el) {
      if (window.Beebo3D) { parts.p3 = window.Beebo3D.attach(parts.three, el, ctx3); return; }
      need3d(() => { if (parts.three && parts.three.isConnected && !parts.p3) { parts.p3 = window.Beebo3D.attach(parts.three, el, ctx3); window.Beebo3D.configure({ quality: (D.perf3d && D.perf3d.quality) || 'auto', weak: !!(D.perf3d && D.perf3d.weak) }); } });
    }
    let elecSeen = null, m3dSeen = null;
    const scenes = {};                 // board / vs / victory → scene node
    let only = opts.scene || '';       // edit mode: show just this scene
    const show = { vs: false, victory: false };
    const g3all = [], g3fluid = {};       // 1.12.10: BeeboFX 3 pieces (materials, lettering, backdrops, fluids, the film look)
    const G3 = () => (window.BeeboFX3 && !POTATO() ? window.BeeboFX3 : null);
    let prevScores = null, booted = false, prevWin = 0, prevMP = [false, false], prevNames = [null, null], prevL = [false, false]; const lostRow = [0, 0];

    // ------------------------------------------------------------------ build
    function buildEl(el, sceneName) {
      const node = document.createElement('div');
      node.className = `sd-el sd-k-${el.kind}`; node.dataset.id = el.id;
      // the scoreboard's player bars are where game formats show lives, the king's crown, team and stock (sb-format.js)
      if (sceneName === 'board' && el.kind === 'bar' && (el.side === 1 || el.side === 2) && !document.getElementById('plate' + el.side)) { node.id = 'plate' + el.side; node.dataset.sbPlate = el.side; }
      node.style.cssText = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;transform:rotate(${Number(el.rot) || 0}deg);opacity:${el.opacity ?? 1};--fxc:${el.effect.color};--win:${el.winColor || UC('accent', '#f6c453')}`;
      const look = el.look || {}, filt = [];
      if (look.shadow && look.shadow.on) filt.push(`drop-shadow(${Number(look.shadow.x) || 0}px ${Number(look.shadow.y) || 0}px ${Number(look.shadow.blur) || 0}px ${look.shadow.color || '#000000'})`);
      if (Number(look.blur) > 0) filt.push(`blur(${Number(look.blur)}px)`);
      if (Number(look.gray) > 0) filt.push(`grayscale(${Math.min(1, Number(look.gray))}) brightness(${(1 - Math.min(1, Number(look.gray)) * .25).toFixed(2)})`);     // 1.12.23: Victory's loser, faded to grey
      if (filt.length) node.style.filter = filt.join(' ');
      if (look.blend && look.blend !== 'normal') node.style.mixBlendMode = look.blend;
      if (look.fade && look.fade !== 'none') {
        const a = Math.max(5, Math.min(95, Number(look.fadeAmt) || 40)), m = look.fade === 'edges' ? `radial-gradient(ellipse at center, #000 ${100 - a}%, transparent 100%)`
          : `linear-gradient(${{ left: 'to left', right: 'to right', top: 'to top', bottom: 'to bottom' }[look.fade] || 'to bottom'}, #000 ${100 - a}%, transparent 100%)`;
        node.style.webkitMaskImage = m; node.style.maskImage = m;
      }
      const inn = document.createElement('div'); inn.className = 'sd-in'; node.appendChild(inn);
      const parts = { inn };
      const idle = el.idle || {};
      if (idle.type && idle.type !== 'none' && !POTATO() && !(D.motion && D.motion.reduced && idle.type !== 'shine')) {
        inn.classList.add('sd-idle-' + idle.type); inn.style.setProperty('--isp', String((Number(idle.speed) || 1) * ((D.motion && D.motion.speed) || 1))); inn.style.setProperty('--iamt', String(Number(idle.amt) || 1));
        if (idle.type === 'shine') inn.style.setProperty('--clip', `path('${pathFor(el)}')`);
        if (idle.type === 'spin') inn.style.transformOrigin = '50% 50%';
      }
      if (el.rule && el.rule.on) node.classList.add('sd-rule-on');
      if (el.rule && el.rule.on && el.exit && el.exit.type && el.exit.type !== 'none') node.classList.add('sd-rule-own');   // 1.12.21: it comes and goes by its own entrance and exit, not the plain fade
      if (Number(look.backdrop) > 0) { const bd = document.createElement('div'); bd.className = 'sd-backdrop'; bd.style.cssText = `position:absolute;inset:0;backdrop-filter:blur(${Number(look.backdrop)}px);-webkit-backdrop-filter:blur(${Number(look.backdrop)}px);clip-path:path('${pathFor(el)}')`; inn.appendChild(bd); }
      const d = pathFor(el), defs = [], gid = `sd${uid}-${el.id}`;
      const showBg = el.kind !== 'three' && el.kind !== 'text' || (el.fill && el.fill.type !== 'none') || (el.stroke && el.stroke.width > 0);
      if (showBg) {
        const fill = svgPaint(el.fill, gid + 'f', defs);
        const sw = Number(el.stroke && el.stroke.width) || 0, glow = Number(el.stroke && el.stroke.glow) || 0;
        const winF = el.kind === 'bar' ? svgPaint({ type: 'linear', angle: 180, colors: [mix(el.winColor, '#ffffff', .75), el.winColor, mix(el.winColor, '#000000', .45)] }, gid + 'w', defs) : '';
        const st = el.stroke || {}, align = st.align || 'center', style = st.style || 'solid';
        const sPaint = st.paint && st.paint.type && st.paint.type !== 'solid' && st.paint.type !== 'none' ? svgPaint(st.paint, gid + 's', defs) : esc(sw ? st.color : 'transparent');
        const realW = align === 'center' ? sw : sw * 2, k = style === 'double' ? 3 : 1;
        const dash = style === 'dashed' ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : style === 'dotted' ? `stroke-dasharray="0.1 ${sw * 2}" stroke-linecap="round"` : '';
        let clip = '';
        if (sw && align === 'inside') { defs.push(`<clipPath id="${gid}ci"><path d="${d}"/></clipPath>`); clip = `clip-path="url(#${gid}ci)"`; }
        if (sw && align === 'outside') { defs.push(`<mask id="${gid}mo" maskUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%"><rect x="-50%" y="-50%" width="200%" height="200%" fill="#fff"/><path d="${d}" fill="#000"/></mask>`); clip = `mask="url(#${gid}mo)"`; }
        if (sw && style === 'double') defs.push(`<mask id="${gid}md" maskUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%"><path d="${d}" fill="none" stroke="#fff" stroke-width="${realW * 3}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#000" stroke-width="${realW}" stroke-linejoin="round"/></mask>`);
        const strokeEl = `<path class="sd-stroke" d="${d}" stroke="${sPaint}" stroke-width="${realW * k}" ${dash} style="--glow:${glow}px;${glow && sw ? `filter:drop-shadow(0 0 ${glow}px ${esc(st.color)})` : ''}"/>`;
        inn.insertAdjacentHTML('beforeend', `<svg class="sd-bg" width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}"><defs>${defs.join('')}</defs>`
          + `<path class="sd-fill" d="${d}" fill="${fill}"/>` + (winF ? `<path class="sd-wint" d="${d}" fill="${winF}"/>` : '')
          + (clip || style === 'double' ? `<g ${clip}${style === 'double' ? ` mask="url(#${gid}md)"` : ''}>${strokeEl}</g>` : strokeEl) + `</svg>`);
        parts.bg = inn.lastChild; parts.stroke = parts.bg.querySelector('.sd-stroke');
      }
      // effect layer, clipped to the shape: shine sweep + cracks
      const fx = document.createElement('div'); fx.className = 'sd-fx'; fx.style.clipPath = `path('${d}')`;
      const ins0 = (Array.isArray(el.inset) && el.inset.length === 2 ? el.inset : null) || (SHAPES[el.shape] || {}).inset || [.04, .04], inL = el.flip ? ins0[1] : ins0[0], inR = el.flip ? ins0[0] : ins0[1];
      const ox = el.kind === 'bar' ? (el.dyn ? (el.side === 2 ? inL * el.w + el.h * .49 : (1 - inR) * el.w - el.h * .49) : el.side === 2 ? el.w * .16 : el.w * .84) : el.w / 2, oy = el.h * .5;
      parts.crackO = [ox, oy]; parts.d = d;
      // 1.12.21: the web of cracks (some eighty paths) only where it can show — a player bar (falling behind, losing the set), a piece
      // whose effect is Cracks, one that comes in by shattering, and any piece while it's being designed. Every piece carried one:
      // with the new pieces of the set, the page on stream went from 1,100 elements to 2,000.
      const cracky = opts.edit || el.kind === 'bar' || (el.effect && el.effect.type === 'cracks') || (el.enter && el.enter.type === 'shatter');
      fx.innerHTML = `<div class="sd-shine"></div>` + (cracky ? `<svg class="sd-cracks" width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}">${crackPaths(el.w, el.h, ox, oy, el.id.length * 977 + el.w)}</svg>` : '');
      inn.appendChild(fx); parts.fx = fx;
      // 1.12.10: a living material on the graphics card (under the lettering; the outline is drawn again on top of it)
      const mat = el.mat, g3 = G3();
      if (g3 && mat && mat.k && mat.k !== 'none' && g3.MATERIALS[mat.k]) {
        const mh = g3.material(inn, { k: mat.k, colors: mat.colors, speed: mat.speed, amt: mat.amt, clip: `path('${d}')` }); g3all.push(mh);
        inn.insertBefore(mh.cv, fx); mh.cv.style.opacity = String(mat.opacity ?? 1); if (mat.blend && mat.blend !== 'normal') mh.cv.style.mixBlendMode = mat.blend;
        if (parts.bg && (Number(el.stroke && el.stroke.width) || 0) > 0) { const top = parts.bg.cloneNode(true); top.querySelectorAll('.sd-fill').forEach(n => n.remove()); top.classList.add('sd-bg-top'); inn.insertBefore(top, fx); }
      }
      const body = document.createElement('div'); body.className = 'sd-body';
      const fam = fontOf(D, el.font.family), fs = Number(el.font.size) || 1;
      body.style.fontFamily = fam.css; body.style.fontWeight = fam.weight;
      body.style.fontStyle = el.font.italic ? 'italic' : 'normal'; body.style.textTransform = el.font.upper ? 'uppercase' : 'none';
      if (el.font.spacing) body.style.letterSpacing = (Number(el.font.spacing) / 100) + 'em';
      const ins = (Array.isArray(el.inset) && el.inset.length === 2 ? el.inset : null) || (SHAPES[el.shape] || {}).inset || [.04, .04];
      const L = el.flip ? ins[1] : ins[0], R = el.flip ? ins[0] : ins[1];
      if (el.kind === 'bar') {
        const h = el.h, two = el.side === 2;
        body.style.left = (L * el.w) + 'px'; body.style.right = (R * el.w) + 'px'; body.style.gap = (h * .16) + 'px';
        if (two) body.style.flexDirection = 'row-reverse';
        body.innerHTML = `<div class="sd-who" style="${two ? 'align-items:flex-end' : ''}"><div class="sd-l1" style="gap:${h * .12}px;${two ? 'flex-direction:row-reverse' : ''}">`
          + `<img class="sd-flag" alt="" style="width:${h * .48}px;height:${h * .32}px"><span class="sd-team"></span><span class="sd-name"></span><span class="sd-ltag">L</span></div>`
          + `<div class="sd-l2" style="font-size:${Math.max(9, h * .17)}px;gap:${h * .12}px;${two ? 'flex-direction:row-reverse' : ''}"><span class="sd-pro"></span><span class="sd-status"></span></div></div>`
          + `<div class="sd-score" style="width:${h * .98}px;height:${h * .72}px"><svg viewBox="0 0 100 72" preserveAspectRatio="none"${el.flip ? ' style="transform:scaleX(-1)"' : ''}><defs>${svgGrad(el.accent.type === 'linear' ? el.accent : { ...el.accent, colors: [cols(el.accent)[0], cols(el.accent)[0]] }, gid + 'a')}</defs>`
          + `<path d="${SCORE_SHAPES[el.scoreShape] || SCORE_SHAPES.skew}" fill="url(#${gid}a)" stroke="${esc(el.teamColor)}" stroke-opacity=".6" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><b class="sd-num" style="font-size:${h * .55}px;color:${esc(el.scoreColor)};text-shadow:0 0 ${h * .2}px ${esc(el.teamColor)}"></b></div>`;
        parts.name = body.querySelector('.sd-name'); parts.team = body.querySelector('.sd-team'); parts.flag = body.querySelector('.sd-flag');
        parts.ltag = body.querySelector('.sd-ltag'); parts.pro = body.querySelector('.sd-pro'); parts.status = body.querySelector('.sd-status'); parts.num = body.querySelector('.sd-num');
        parts.l2 = body.querySelector('.sd-l2'); parts.scoreBox = body.querySelector('.sd-score');
        if (el.font.italic) parts.num.style.translate = '-.07em .03em';
        else parts.name.style.padding = '0 .04em';          // 1.5.8: upright, it needs no room for a lean: even on both sides, so 2P's name sits as far from its box as 1P's     // 1.11: a slanted digit sits right of the middle of its box; nudge it back so it reads centred
        // 1.12.21: readable on any colour — the team tag on the plate and the number on its score box keep the colour you gave
        // them when it reads there, and are nudged toward black or white when it doesn't (a white 3 on a yellow box)
        const boxTone = (ac => (ac.length ? ac.reduce((a, c) => mix(a, c, .5)) : ''))(cols(el.accent).filter(c => /^#[0-9a-f]{6}/i.test(c)).map(c => c.slice(0, 7)));   // the score box's own colour (the middle of its gradient)
        { const tone0 = plateTone(el, 'normal'), mid = boxTone;
          parts.teamInk = /^#[0-9a-f]{6}$/i.test(el.teamColor || '') && contrast(el.teamColor, tone0) < 2.2 ? readable(el.teamColor, tone0, 4.5) : el.teamColor;
          if (mid && /^#[0-9a-f]{6}$/i.test(el.scoreColor || '') && contrast(el.scoreColor, mid) < 2.2) parts.num.style.color = readable(el.scoreColor, mid, 4.5); }
        parts.team.style.color = parts.teamInk; parts.teamSize = h * .3 * fs; parts.team.style.fontSize = parts.teamSize + 'px';
        parts.l2.style.color = el.subColor;
        textPaint(parts.name, el.font.color);
        parts.nameSize = h * .52 * fs;
        parts.flag.style.display = el.showFlag ? '' : 'none'; parts.team.style.display = el.showTeam ? '' : 'none';
        parts.l2.style.display = el.showSub && h >= 46 ? '' : 'none'; parts.scoreBox.style.display = el.showScore ? '' : 'none';
        parts.flag.onerror = () => parts.flag.classList.add('sd-off');
        if (el.sideTag) {          // 1P / 2P in the corner of the score box
          const t = document.createElement('i'); t.className = 'sd-sidetag'; t.textContent = el.side === 2 ? '2P' : '1P';
          // 1.12.21: it sits on the score box, so it's held to the box's colour: small lettering that doesn't reach 3:1 there is
          // nudged toward black or white (the Default look's grey 1P on its red box, 2P on its blue one, could hardly be seen)
          const tagC = el.statusColor || el.teamColor, tagInk = boxTone && /^#[0-9a-f]{6}$/i.test(tagC || '') && contrast(tagC, boxTone) < 3 ? readable(tagC, boxTone, 4.5) : tagC;
          // (the loser's score box is dimmed, tag and all: there the ink that still shows is kept — white on a dimmed colour box)
          { const dimTone = boxTone ? mix(boxTone, '#000000', .5) : '', seen = x => mix(x, '#000000', .45);
            parts.sideTag = t; parts.tagInk = tagInk; parts.tagInkLose = dimTone && /^#[0-9a-f]{6}$/i.test(tagC || '') && contrast(seen(tagInk), dimTone) < 3 ? readable(tagC, dimTone, 3, seen) : tagInk; }
          t.style.cssText = `position:absolute;top:${(h * .015).toFixed(1)}px;${two ? 'right' : 'left'}:${(h * .17).toFixed(1)}px;font:700 ${(h * .15).toFixed(1)}px/1 'Chakra Petch',sans-serif;font-style:normal;letter-spacing:.06em;color:${esc(tagInk)};z-index:1`;
          parts.scoreBox.appendChild(t);
        }
      } else if (el.kind === 'header') {
        body.style.left = (L * el.w) + 'px'; body.style.right = (R * el.w) + 'px'; body.style.flexDirection = 'column'; body.style.justifyContent = 'center';
        // (1.12.24: el.meta === false — no small line; the round has the whole plate)
        body.innerHTML = (el.meta === false ? '' : `<div class="sd-meta" style="font-size:${el.h * .22}px"></div>`) + '<div class="sd-round"></div>';
        parts.meta = el.meta === false ? null : body.firstChild; parts.round = body.lastChild;
        // 1.12.21: the small line is the smallest lettering on the scoreboard, so on a plate of its own it's held to 3:1 at
        // least (Porcelain's gold on white was 2.8:1) — nudged toward black or white just far enough to read at 4.5:1
        if (parts.meta) { const own = el.fill && el.fill.type && el.fill.type !== 'none' ? String(plateTone(el, 'normal') || '').slice(0, 7) : '';
          parts.meta.style.color = /^#[0-9a-f]{6}$/i.test(own) && /^#[0-9a-f]{6}$/i.test(el.teamColor || '') && contrast(el.teamColor, own) < 3 ? readable(el.teamColor, own, 4.5) : el.teamColor; }
        textPaint(parts.round, el.font.color); parts.roundSize = el.h * (el.meta === false ? .66 : .46) * fs;
      } else if (el.kind === 'comms') {
        body.style.left = (L * el.w) + 'px'; body.style.right = (R * el.w) + 'px'; body.classList.add('sd-comms'); body.style.justifyContent = 'center'; body.style.fontSize = (el.h * .56 * fs) + 'px';
        body.innerHTML = `<svg viewBox="0 0 24 24" style="fill:${esc(el.teamColor)}"><rect x="9" y="2" width="6" height="12.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke="${esc(el.teamColor)}" stroke-width="2.2" stroke-linecap="round"/><rect x="11" y="17.5" width="2" height="3.5"/><rect x="8" y="20.5" width="8" height="2" rx="1"/></svg>`
          + `<span class="sd-c1"></span><span class="sd-sep" style="color:${esc(el.teamColor)}">/</span><span class="sd-c2"></span>`;
        parts.c1 = body.querySelector('.sd-c1'); parts.c2 = body.querySelector('.sd-c2'); parts.sep = body.querySelector('.sd-sep');
        textPaint(parts.c1, el.font.color); textPaint(parts.c2, el.font.color);
      } else if (el.kind === 'text') {
        body.style.left = '0'; body.style.right = '0'; body.style.justifyContent = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center';
        const curve = Number(el.font.curve) || 0;
        if (curve) {          // text on a curve
          const hgt = el.h, mid = el.w / 2, bend = curve / 100 * el.h * .9, y0 = curve > 0 ? hgt * .78 : hgt * .5;
          const tdefs = [], tp = svgPaint(el.font.color && el.font.color.type === 'texture' ? { type: 'solid', colors: [cols(el.font.color)[0]] } : el.font.color, gid + 't', tdefs);
          body.innerHTML = `<svg class="sd-curve" width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}" style="overflow:visible"><defs>${tdefs.join('')}<path id="${gid}cp" d="M${el.w * .02},${y0} Q${mid},${y0 - bend * 2} ${el.w * .98},${y0}"/></defs><text fill="${tp}" text-anchor="middle" font-size="${el.h * .5 * fs}"><textPath href="#${gid}cp" startOffset="50%"></textPath></text></svg>`;
          parts.curve = body.querySelector('textPath'); body.style.left = '0'; body.style.right = '0';
        } else {
          body.innerHTML = '<div class="sd-text"></div>'; parts.text = body.firstChild; textPaint(parts.text, el.font.color);
          if (el.font.glow && !(el.font.fx && el.font.fx !== 'none')) parts.text.style.filter = `drop-shadow(0 0 ${el.font.glow}px ${el.effect.color})`;
          if (el.font.wrap) { parts.text.classList.add('sd-wrap'); parts.text.style.textAlign = alignOf(el, 'center'); parts.text.style.lineHeight = String(Number(el.font.line) || 1.05); parts.wrap = true; }
          parts.textSize = el.h * (el.font.wrap ? .4 : .82) * fs; parts.minSize = Number(el.font.min) || 10;
        }
      } else if (el.kind === 'pips') {          // 1.12.21: score pips (drawn in paint: how many depends on the set)
        const box = document.createElement('div'); box.className = 'sd-pips'; inn.insertBefore(box, fx); parts.pips = box;
      } else if (el.kind === 'logo') {
        body.remove();
        const box = document.createElement('div'); box.className = 'sd-logo'; const pad = Number(el.pad) || 0;
        box.style.cssText = `inset:${pad}px;clip-path:path('${pathFor(el, el.w - pad * 2, el.h - pad * 2, 0)}')`;
        const z = Math.max(1, Number(el.zoom) || 1), fcx = el.focusX ?? 50, fcy = el.focusY ?? 50;
        const flipT = `${el.flipX ? 'scaleX(-1) ' : ''}${el.flipY ? 'scaleY(-1) ' : ''}${z > 1 ? `scale(${z})` : ''}`.trim();
        const fitC = el.fit === 'cover' ? 'cover' : el.fit === 'stretch' ? 'fill' : 'contain';
        const mstyle = `object-fit:${fitC};object-position:${fcx}% ${fcy}%;opacity:${el.imgOpacity ?? 1};transform-origin:${fcx}% ${fcy}%;${flipT ? `transform:${flipT}` : ''}`;
        const isVid = /^data:video\/|\.(webm|mp4|mov|m4v)(\?|$)/i.test(String(el.src || ''));
        if (el.sprite && el.src && Number(el.sprite.cols) > 0) {
          const c = Math.max(1, Number(el.sprite.cols) || 1), r = Math.max(1, Number(el.sprite.rows) || 1), n = Math.max(1, Math.min(c * r, Number(el.sprite.frames) || c * r)), fps = Math.max(1, Number(el.sprite.fps) || 12);
          box.innerHTML = `<div class="sd-sprite" style="width:100%;height:100%;background:url('${esc(el.src)}') 0 0/${c * 100}% ${r * 100}% no-repeat;opacity:${el.imgOpacity ?? 1};${flipT ? `transform:${flipT}` : ''}"></div>`;
          const sp = box.firstChild, kf = Array.from({ length: n }, (_, i) => ({ offset: i / n, backgroundPosition: `${c > 1 ? (i % c) / (c - 1) * 100 : 0}% ${r > 1 ? Math.floor(i / c) / (r - 1) * 100 : 0}%` }));
          kf.push({ offset: 1, backgroundPosition: kf[kf.length - 1].backgroundPosition });
          if (!POTATO()) sp.animate(kf, { duration: n / fps * 1000, iterations: el.loop === false ? 1 : Infinity, easing: `steps(${n}, jump-none)`, fill: 'forwards' });
        } else if (isVid) box.innerHTML = `<video src="${esc(el.src)}" muted playsinline autoplay ${el.loop === false ? '' : 'loop'} style="width:100%;height:100%;display:block;${mstyle}"></video>`;
        else if (el.src || el.srcTpl) box.innerHTML = `<img alt="" ${el.src ? `src="${esc(el.src)}"` : ''} style="${mstyle}">`;
        else box.innerHTML = opts.edit ? '<div class="sd-ph">Drop a picture<br>here</div>' : '';
        if (el.srcTpl) { parts.limg = box.querySelector('img'); if (parts.limg) parts.limg.onerror = () => { parts.limg.style.visibility = 'hidden'; }; }
        inn.insertBefore(box, fx);
      } else if (el.kind === 'three') {
        body.remove();
        const box = document.createElement('div'); box.className = 'sd-3d'; inn.insertBefore(box, fx); parts.three = box; hook3d(parts, el);
      } else if (el.kind === 'avatar') {
        body.remove();
        const fr = Number(el.frame) || 0, a = document.createElement('div'); a.className = 'sd-ava';
        a.style.cssText = `left:${fr}px;top:${fr}px;width:${el.w - fr * 2}px;height:${el.h - fr * 2}px;clip-path:path('${pathFor(el, el.w - fr * 2, el.h - fr * 2)}');background:#111`;
        a.innerHTML = `<img alt=""><b style="font-size:${el.h * .55}px"></b>`;
        inn.insertBefore(a, fx); parts.ava = a; parts.avaImg = a.querySelector('img'); parts.avaIni = a.querySelector('b');
        parts.avaImg.onload = () => a.classList.add('sd-img'); parts.avaImg.onerror = () => a.classList.remove('sd-img');
        textPaint(parts.avaIni, el.font.color);
      } else if (el.kind === 'list') {
        body.style.left = '0'; body.style.right = '0'; body.style.top = '0'; body.style.bottom = '0';
        body.classList.add('sd-list'); body.style.flexDirection = el.dir === 'across' ? 'row' : 'column';
        body.style.gap = (Number(el.gap) || 0) + 'px'; body.style.alignItems = el.dir === 'across' ? 'center' : JUST[alignOf(el, 'left')];
        body.style.justifyContent = el.dir === 'across' ? JUST[alignOf(el, 'left')] : 'flex-start';
        parts.list = body; parts.itemSize = (Number(el.rowH) || 40) * .8 * fs;
      } else if (el.kind === 'bracket') {
        body.style.cssText += ';left:0;right:0;top:0;bottom:0;display:block';
        body.innerHTML = '<div class="sd-br"></div>'; parts.br = body.firstChild;
      } else if (el.kind === 'ticker') {
        body.style.left = '0'; body.style.right = '0'; body.style.top = '0'; body.style.bottom = '0';
        body.innerHTML = '<div class="sd-tick"><div class="sd-tick-run"></div></div>'; parts.tick = body.querySelector('.sd-tick-run');
        parts.tick.style.fontSize = (el.h * .6 * fs) + 'px';
      }
      // lettering effect + alignment
      const fxT = el.font.fx || 'none', letters = [parts.name, parts.round, parts.text, parts.c1, parts.c2, parts.avaIni].filter(Boolean);
      parts.letters = letters;
      // 1.12.10: a lettering effect drawn on the graphics card from the letters themselves, or a picture / material inside them
      const g3l = G3(), lt = ['text', 'header', 'bar'].includes(el.kind) ? (parts.text || parts.round || parts.name) : null;
      if (g3l && lt) {
        let clipBox = null;          // the scoreboard: flames, glow and smoke stay inside the piece's own outline (HUD-safe)
        if (sceneName === 'board') { clipBox = document.createElement('div'); clipBox.className = 'bfx3-clip'; clipBox.style.cssText = `position:absolute;inset:0;pointer-events:none;clip-path:path('${parts.d}')`; inn.appendChild(clipBox); }
        if (el.font.gfx && el.font.gfx !== 'none' && g3l.LETTERS[el.font.gfx]) g3all.push(g3l.text(lt, { k: el.font.gfx, colors: el.font.gfxColors, speed: el.font.gfxSpeed, amt: el.font.gfxAmt, ...(clipBox ? { host: clipBox, origin: inn } : {}) }));
        else if (el.font.mask && (el.font.mask.src || el.font.mask.mat)) g3all.push(g3l.mask(lt, { ...el.font.mask }));
      }
      if (fxT !== 'none') for (const n of letters) { n.style.setProperty('--tfx', el.font.fxColor || UC('effects', '#ff3b14', '#ff5a1f')); n.style.setProperty('--tfw', (el.font.fxSize || (fxT === 'neon' ? 3 : fxT === 'extrude' ? 6 : 1.5)) + 'px'); if (fxT === 'neon') n.style.setProperty('--tfx2', window.SBColours && window.SBColours.light ? (el.font.fxColor || '#ff3b14') : mix(el.font.fxColor || '#ff3b14', '#ffffff', .55)); }   // 1.12.14: the neon tube's core is lighter than its glow (1.5.11: not on a light look of yours, where a whitened core fades into the light plates)
      if (el.kind === 'bar') {
        const a = alignOf(el, el.side === 2 ? 'right' : 'left'), two = el.side === 2;
        body.querySelector('.sd-who').style.alignItems = JUST[a];
        // 2P rows run right-to-left (row-reverse), so their start is on the right
        const rowJ = two ? { left: 'flex-end', center: 'center', right: 'flex-start' }[a] : JUST[a];
        body.querySelectorAll('.sd-l1,.sd-l2').forEach(r => { r.style.justifyContent = rowJ; });
        const outer = el.scorePos === 'outer';
        body.style.flexDirection = two ? (outer ? 'row' : 'row-reverse') : (outer ? 'row-reverse' : 'row');
      } else if (el.kind === 'header') body.style.alignItems = JUST[alignOf(el, 'center')];
      else if (el.kind === 'comms') body.style.justifyContent = JUST[alignOf(el, 'center')];
      else if (el.kind === 'text') body.style.justifyContent = JUST[alignOf(el, 'center')];
      if (body.isConnected || body.parentNode) {} else if (['bar', 'header', 'comms', 'text', 'list', 'ticker', 'bracket'].includes(el.kind)) inn.appendChild(body);
      parts.body = body;
      return { el, node, parts, scene: sceneName };
    }
    // 1.12.12: splash screens are built once, then parked — taken off the page while hidden, so the page holds only what's
    // on screen (Obsidian Glass: ~1,000 elements instead of ~7,900) — and put back in their place the moment one is shown
    const parked = new Set(), parkT = {}; let sharedNode = null;
    const parkObs = opts.live && !opts.edit && !window.__SB_NOPARK && typeof MutationObserver === 'function' ? new MutationObserver(ms => { for (const m of ms) { const n = m.target, name = n.__sdName; if (name && n.classList.contains('sd-hidden') && !n.classList.contains('sd-warm')) parkLater(name); } }) : null;
    function park(name) {
      const n = scenes[name];
      if (!parkObs || name === 'board' || !n || n.parentNode !== root || show[name] || only === name || !n.classList.contains('sd-hidden') || n.classList.contains('sd-warm')) return;
      n.remove(); parked.add(name);
    }
    function parkLater(name, ms = 2000) { clearTimeout(parkT[name]); parkT[name] = setTimeout(() => park(name), ms); }
    function unpark(name) {
      clearTimeout(parkT[name]); if (!parked.has(name)) return; parked.delete(name);
      const n = scenes[name], order = sceneNames(); if (!n) return;
      let before = null; for (let i = order.indexOf(name) + 1; i < order.length && !before; i++) { const x = scenes[order[i]]; if (x && x.parentNode === root) before = x; }
      if (!before && sharedNode && sharedNode.parentNode === root) before = sharedNode;
      root.insertBefore(n, before);
      for (const r of doms.values()) if (r.scene === name && r.parts.three && !r.parts.p3 && window.Beebo3D) hook3d(r.parts, r.el);
    }
    // 1.12.16: a screen with a baked backdrop loop (Layout Designer › Bake to video) plays it instead of drawing the backdrop
    // live when the PC is slower: Ultra-light or Light effects, Laptop mode, a struggling PC, or no graphics card. "Always"
    // plays it on every PC. Never while it's being baked, and in the Designer only when you ask to see it.
    function bakedOn(sc) {
      const b = sc && sc.bakedBg; if (!b || !b.src || window.__SB_BAKE_LIVE || POTATO()) return false;
      if (opts.edit) return !!window.__SB_SHOW_BAKED;
      if (b.always) return true;
      const X4 = window.BeeboFX4, q = String(window.__SB_GFXQ || '');
      return document.documentElement.classList.contains('sb-ultra') || q === 'light' || q === 'off' || !!(window.SBPerf && (SBPerf.laptop || SBPerf.q < .6))
        || !!(X4 && (X4.gov.level >= 1 || X4.GPU.soft || !X4.GPU.webgl2));
    }
    function build() {
      if (window.Beebo3D) { window.Beebo3D.release(uid); if (opts.live || opts.edit) window.Beebo3D.configure({ quality: (D.perf3d && D.perf3d.quality) || 'auto', weak: !!(D.perf3d && D.perf3d.weak) }); }
      for (const g of g3all.splice(0)) { try { g.destroy(); } catch (e) {} } for (const k of Object.keys(g3fluid)) delete g3fluid[k];
      root.innerHTML = ''; doms.clear(); for (const k of Object.keys(scenes)) delete scenes[k];
      parked.clear(); for (const k of Object.keys(parkT)) clearTimeout(parkT[k]); if (parkObs) parkObs.disconnect();
      if (GFX) queueMicrotask(() => { if (GFX) root.appendChild(GFX.layer.cv); });    // the engine's front layer goes back on top once the screens are rebuilt
      const shared = document.createElement('div'); shared.className = 'sd-shared'; sharedNode = shared;
      for (const name of sceneNames()) {
        const sc = D.scenes[name], node = document.createElement('div');
        node.className = 'sd-scene sd-sc-' + name + (name !== 'board' ? ' sd-splash' : '');
        const baked = name !== 'board' && bakedOn(sc);      // 1.12.16: a slower PC plays the baked loop of the backdrop instead
        if (name !== 'board') {
          const defs = [], paint = svgPaint(sc.bg, `sd${uid}-${name}bg`, defs);
          node.insertAdjacentHTML('beforeend', `<svg class="sd-sbg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs.join('')}</defs><rect width="${W}" height="${H}" fill="${paint}"/></svg>`);
          if (baked) { const v = document.createElement('video'); v.className = 'sd-baked'; v.src = sc.bakedBg.src; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('muted', '');
            v.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover;pointer-events:none`; node.appendChild(v); node.__baked = true; node.classList.add('sd-baked-on'); v.play().catch(() => {}); }
          const amb = document.createElement('div'); amb.className = 'sd-amb sd-amb-' + (baked ? 'none' : sc.effect); amb.style.setProperty('--fxc', sc.effectColor);
          if (sc.effect === 'cracks' && !baked) amb.innerHTML = `<svg class="sd-cracks" style="opacity:.5" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${crackPaths(W, H, W / 2, H / 2, 99)}</svg>`;
          node.appendChild(amb);
          // 1.12.10: a backdrop and a live fluid on the graphics card, under the screen's pieces
          const g3 = G3();
          if (!baked && g3 && sc.backdrop && sc.backdrop.k && sc.backdrop.k !== 'none' && g3.BACKDROPS[sc.backdrop.k]) { const bh = g3.backdrop(node, sc.backdrop); node.insertBefore(bh.cv, amb); g3all.push(bh); }
          if (!baked && g3 && sc.fluid && sc.fluid.k && sc.fluid.k !== 'none' && g3.FLUIDS[sc.fluid.k]) { const fh = g3.fluid(node, sc.fluid); g3all.push(fh); g3fluid[name] = fh; }
        }
        for (const el of sc.elements) {
          if (el.hidden && !opts.edit) continue;                       // hidden: kept in the layout, never on stream
          const r = buildEl(el, name); doms.set(el.id, r);
          if (FXL && el.looks && el.looks.length) try { FXL.buildLooks(r, fxApi); } catch (e) { console.warn('look', e); }
          if (el.everywhere && !(opts.edit && only === name)) { r.shared = true; shared.appendChild(r.node); } else node.appendChild(r.node);
          if (opts.edit && el.hidden) r.node.classList.add('sd-hid');
          if (opts.edit && el.ghost) r.node.style.display = 'none';   // hidden while editing only
        }
        if (FXL && sc.atmos && sc.atmos.length && !baked) try { FXL.buildAtmos(node, sc, S, { edit: !!opts.edit }); } catch (e) { console.warn('atmos', e); }
        if (name !== 'board' && sc.post && G3() && Object.keys(sc.post).some(k => k === 'grade' ? sc.post.grade && sc.post.grade !== 'none' : Number(sc.post[k]) > 0)) g3all.push(G3().post(node, sc.post));   // 1.12.10: the film look
        if (name !== 'board') camera(node, sc);        // 1.12.15: the 2.5D camera (splashes only — the scoreboard never moves)
        scenes[name] = node; root.appendChild(node);
        if (parkObs && name !== 'board') { node.__sdName = name; parkObs.observe(node, { attributes: true, attributeFilter: ['class'] }); }
      }
      root.appendChild(shared);
      root.appendChild(cv);
      if (window.Beebo3D) window.Beebo3D.sweep(uid);
      applyVisibility(true);
      paint(true);
      if (parkObs) for (const name of Object.keys(scenes)) if (name !== 'board') parkLater(name, 9000);      // (after the splashes are warmed up)
      if (!opts.edit && !opts.thumb) { clearTimeout(warmT); warmT = setTimeout(warmUp, 1200); }
    }
    // 1.12.16: warm-up. Once an overlay is up, while nothing is happening: every picture of every screen is decoded (so a
    // splash doesn't appear with its pictures popping in), and the graphics-card transitions the layout uses have their
    // programs built — so the first VS screen or transition of the night plays as smoothly as the tenth.
    let warmT = 0;
    function warmUp() {
      const idle = window.requestIdleCallback || (f => setTimeout(f, 30));
      idle(() => {
        let pics = 0; for (const img of root.querySelectorAll('img')) { if (img.decode) { img.decode().catch(() => {}); pics++; } }
        const ids = [];
        const add = t => { if (!t) return; t = String(t); if (/^gx-/.test(t)) ids.push(t.slice(3)); else if (/^tr-/.test(t)) { const c = (D.transitions || []).find(x => 'tr-' + x.key === t); if (c) ids.push(c.base); } };
        for (const sc of Object.values(D.scenes)) { add(sc.transIn); add(sc.transOut); for (const e of sc.elements) { add(e.enter && e.enter.type); add(e.exit && e.exit.type); } }
        let progs = 0; try { if (ids.length && gxOn() && FX2.warm) progs = FX2.warm(ids); } catch (e) {}
        window.__SB_WARM = { pics, progs, at: Date.now() };
      });
    }
    // 1.12.15: the 2.5D camera. A splash's pieces can sit nearer or further (el.depth, px toward you); each is pushed back or
    // forward in 3D and scaled and shifted so that, at rest, it looks exactly where you put it. The screen's camera (sc.camera:
    // { move, amt, bg }) then drifts, orbits, pushes in or tilts, and the pieces slide past each other with real parallax.
    const CAM_P = 1600;
    // the camera is the screen's point of view (its perspective origin): moving it makes nearer pieces slide further than
    // farther ones — real parallax, with no 3D nesting (which a screen's clipping would flatten)
    const PO = (x, y) => ({ perspectiveOrigin: `${(50 + x).toFixed(2)}% ${(50 + y).toFixed(2)}%` });
    const CAM_MOVES = {
      drift: a => ({ k: [PO(-6 * a, -3 * a), PO(6 * a, 3 * a)], o: { duration: 14000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' } }),
      orbit: a => ({ k: [PO(-12 * a, 0), PO(12 * a, 0)], o: { duration: 18000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' } }),
      push: a => ({ k: [{ ...PO(0, 6 * a), transform: `scale(${(1 - .05 * a).toFixed(3)})` }, { ...PO(0, 0), transform: 'none' }], o: { duration: 2600, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }, once: true }),
      tilt: a => ({ k: [{ ...PO(0, -18 * a), transform: `scale(${(1 - .025 * a).toFixed(3)})` }, { ...PO(0, 0), transform: 'none' }], o: { duration: 2200, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }, once: true }),
      handheld: a => ({ k: [[0, 0], [1.6, -1], [-.8, 1.3], [1.1, .6], [-1.3, -.8], [0, 0]].map(([x, y]) => PO(x * a, y * a)), o: { duration: 6500, iterations: Infinity, easing: 'ease-in-out' } }),
    };
    function camera(node, sc) {
      const cam = sc.camera || {}, move = CAM_MOVES[cam.move], deep = sc.elements.some(e => Number(e.depth));
      if ((!move && !deep) || POTATO() || document.documentElement.classList.contains('sb-ultra') || (D.motion && D.motion.reduced)) return;
      node.style.perspective = CAM_P + 'px'; node.style.perspectiveOrigin = '50% 50%'; node.classList.add('sd-cam');
      // each piece pushed back or forward, then scaled and shifted so that, seen from the middle, it's exactly where you put it
      const place = (n, z, cx, cy, rot) => { const k = (CAM_P - z) / CAM_P, dx = (W / 2 - cx) * z / CAM_P, dy = (H / 2 - cy) * z / CAM_P;
        n.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,${z}px) scale(${k.toFixed(4)})${rot ? ` rotate(${rot}deg)` : ''}`; };
      for (const el of sc.elements) { const z = Math.max(-600, Math.min(600, Number(el.depth) || 0)); const r = doms.get(el.id); if (z && r && r.node.parentNode === node) place(r.node, z, el.x + el.w / 2, el.y + el.h / 2, Number(el.rot) || 0); }
      const bz = cam.bg == null ? (move ? -260 : 0) : Math.max(-800, Math.min(0, Number(cam.bg) || 0));
      if (bz) for (const n of node.querySelectorAll(':scope > .sd-sbg, :scope > .sd-amb')) { n.style.transformOrigin = '50% 50%'; place(n, bz, W / 2, H / 2, 0); }
      if (!move) return;
      const m = move(Math.max(.2, Math.min(3, Number(cam.amt) || 1)));
      const run = () => { if (node.__cam) node.__cam.cancel(); node.__cam = node.animate(m.k, m.o); };
      node.__camRun = run; if (!m.once) run();
    }
    function sceneNames() { return ['board', 'vs', 'victory', ...Object.keys(D.scenes).filter(k => !['board', 'vs', 'victory'].includes(k))]; }
    function applyVisibility() {
      for (const name of sceneNames()) {
        if (!scenes[name]) continue;
        const vis = only ? name === only : name === 'board' || show[name];
        if (vis) unpark(name);
        scenes[name].classList.toggle('sd-hidden', !vis);
      }
      refit();                     // text can only be measured while its scene is on screen
    }

    // ------------------------------------------------------------------ state → screen
    function barState(el) {
      const me = S['p' + el.side] || {}, op = S['p' + (3 - el.side)] || {}, w = S.winnerSide;
      return { me, op, win: w === el.side, lose: !!w && w !== el.side, lead: w ? w === el.side : me.score > op.score, mp: !w && !!me.matchPoint, danger: !w && !!op.matchPoint };
    }
    // 1.12.21: the plate a piece with none of its own sits on — the bar under its middle — and the tone that bar has right
    // now: gold when its player has won the set, dimmed when they've lost it. Lettering and pips placed on a bar are held
    // to it in those two states (as designed, they read on the plate as it normally is; it's the change they can't know).
    function groundOf(r) {
      const { el, parts } = r;
      if (parts.gbar === undefined || opts.edit) { const cx = el.x + el.w / 2, cy = el.y + el.h / 2; parts.gbar = null;
        for (const q of doms.values()) { const e = q.el; if (q !== r && q.scene === r.scene && e.kind === 'bar' && !e.hidden && cx >= e.x && cx <= e.x + e.w && cy >= e.y && cy <= e.y + e.h) parts.gbar = q; } }
      const bar = parts.gbar; if (!bar) return null;
      const b = barState(bar.el), st = b.win ? 'win' : b.lose ? 'lose' : 'normal'; if (st === 'normal') return null;
      // the winner's plate runs from a light top through the win colour to a darker foot: its tone at this piece's own height
      const e = bar.el, fy = Math.max(0, Math.min(1, (el.y + el.h / 2 - e.y) / Math.max(1, e.h))), wc = /^#[0-9a-f]{6}$/i.test(e.winColor || '') ? e.winColor : UC('accent', '#f6c453');
      const tone = e.tones && e.tones[st] ? String(e.tones[st]).slice(0, 7)
        : st === 'win' ? (fy < .5 ? mix(mix(wc, '#ffffff', .75), wc, fy * 2) : mix(wc, mix(wc, '#000000', .45), fy * 2 - 1))
        : mix(String(plateTone(e, 'normal')).slice(0, 7), '#000000', e.loseDim !== false ? .64 : .45);
      return /^#[0-9a-f]{6}$/i.test(tone) ? { st, tone } : null;
    }
    // ------------------------------------------------------------------ the dynamic plate (Shattered, and any bar with el.dyn)
    // cracks spread from the score as a player falls behind · a comeback mends them in gold · heat builds on a streak ·
    // at the end of the set the loser's plate shatters (inside its own outline: never over the game HUD) and stays fractured
    function dynPlate(r, b, first) {
      const { el, node, parts } = r, dy = el.dyn || {}, me = Number(b.me.score) || 0, op = Number(b.op.score) || 0;
      const need = Math.max(1, Math.ceil((Number(S.bestOf) || 3) / 2)), deficit = Math.max(0, op - me);
      const lvl = b.lose ? 5 : b.win || dy.cracks === false ? 0 : Math.min(4, Math.ceil(deficit / need * 4));
      const was = parts.crk ?? 0, live = !first && booted && !POTATO();
      const G = GFX && !Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k)) ? GFX : null;     // the engine plays only while the scoreboard shows
      node.classList.add('sd-dyn'); if (dy.lava) node.classList.add('sd-lava');      // 1.11: Fissure — the cracks run molten
      if (lvl !== was) { node.classList.remove('sd-crk-' + was); node.classList.add('sd-crk-' + lvl); parts.crk = lvl; }
      else if (!node.classList.contains('sd-crk-' + lvl)) node.classList.add('sd-crk-' + lvl);
      node.classList.toggle('sd-dgr', !!b.danger && dy.cracks !== false);
      const reset = me === 0 && op === 0;
      if (live && lvl > was && lvl < 5 && G) G.event('crack', { side: el.side, level: lvl, at: crackAt(r) });
      if (live && lvl < was && !reset && was < 5 && dy.mend !== false) {           // a comeback: the cracks seal up, in gold
        node.classList.remove('sd-mend'); void node.offsetWidth; node.classList.add('sd-mend'); later(() => node.classList.remove('sd-mend'), 1300);
        if (G) G.event('mend', { side: el.side, level: lvl });
      }
      // heat: the points in a row this player has just taken
      const pm = parts.prevMe ?? me, po = parts.prevOp ?? op;
      parts.streak = reset || op > po ? 0 : (parts.streak || 0) + Math.max(0, me - pm); parts.prevMe = me; parts.prevOp = op;
      const streak = b.win || b.lose ? 0 : parts.streak;
      node.style.setProperty('--heat', String(Math.min(1, streak / 4)));
      if (dy.heat !== false && GFX && parts.heat !== streak) { GFX.event('heat', { side: el.side, level: streak }); }      // (heat draws only while the scoreboard shows)
      parts.heat = streak;
      const broken = b.lose && dy.shatter !== false;
      if (broken && !parts.broken) { parts.broken = true; if (live) shatterPlate(r); else node.classList.add('sd-broken'); }
      if (!broken && parts.broken) { parts.broken = false; node.classList.remove('sd-broken'); if (live) { node.classList.remove('sd-reform'); void node.offsetWidth; node.classList.add('sd-reform'); later(() => node.classList.remove('sd-reform'), 700); } }
    }
    // Electrocuted (1.10): the plate jolts sideways and flickers cold while arcs crawl over it (the engine), or plain bolts
    // along it (without the engine). Sideways only, so on the scoreboard it never moves over the game HUD.
    function jolt(r, ms = 1300) {
      if (!r || calm()) return;
      const k = []; for (let i = 0; i <= 14; i++) k.push({ offset: i / 14, transform: i === 0 || i === 14 ? 'none' : `translateX(${((Math.random() - .5) * 5).toFixed(1)}px)`, filter: i === 14 ? 'none' : i % 3 === 1 ? `brightness(${(1.6 + Math.random()).toFixed(2)}) saturate(.35) hue-rotate(170deg)` : i % 3 === 2 ? 'brightness(.8)' : 'none' });
      // on the piece's outer box, added to whatever it's doing (its point reaction can't cancel it)
      try { anim(r.node, k, { duration: ms, easing: 'linear', composite: 'add' }); } catch (e) { anim(r.parts.inn, k, { duration: ms, easing: 'linear' }); }
    }
    function electrocute(r, color) {
      if (!r || POTATO()) return;
      const el = r.el, box = { x: el.x, y: el.y, w: el.w, h: el.h };
      jolt(r);
      if (GFX && GFX.fxAt('electro', box, { color })) { GFX.event('electro', { side: el.side }); return; }     // (+ the Electrocuted moment's own stack)
      const c = color || '#9fd8ff';
      for (let i = 0; i < 7; i++) later(() => { const x = box.x + Math.random() * box.w * .8, y = box.y + box.h * (.2 + Math.random() * .6); bolt(x, y, x + box.w * (.1 + Math.random() * .25), box.y + box.h * (.2 + Math.random() * .6), c, .2, 1.6); }, i * 170);
    }
    const barOf = sd => [...doms.values()].find(r => r.el.kind === 'bar' && r.el.side === sd && r.scene === 'board');
    // ------------------------------------------------------------------ Slicing and Fissure (1.11)
    // sparks inside a plate (a canvas cut to its outline — HUD-safe): from points along lines, or rising from cracks
    function plateSparks(r, seeds, o = {}) {
      const { el, parts } = r, cv = document.createElement('canvas'), dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = el.w * dpr; cv.height = el.h * dpr; cv.className = 'sd-crtsparks';
      cv.style.cssText = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;pointer-events:none;z-index:60;clip-path:path('${parts.d || pathFor(el)}')`;
      root.appendChild(cv); const g = cv.getContext('2d'); g.scale(dpr, dpr);
      const ps = seeds.map(([x, y, vx, vy, life, hot]) => ({ x, y, vx, vy, life, t: 0, s: 1 + Math.random() * 1.4, hot }));
      let last = performance.now(), dead = false; const grav = o.gravity ?? 700, col = o.col || ((k, hot) => hot ? `rgba(255,255,255,${k})` : `rgba(255,${(140 + 100 * k) | 0},${(50 * k) | 0},${k})`);
      const step = now => {
        if (dead) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now; g.clearRect(0, 0, el.w, el.h); g.globalCompositeOperation = 'lighter'; let alive = 0;
        for (const p of ps) {
          if (p.t >= p.life) continue; alive++; p.t += dt; const px = p.x, py = p.y; p.vy += grav * dt; p.vx *= 1 - 1.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > el.h - 2 && p.vy > 0) { p.y = el.h - 2; p.vy *= -.4; }
          const k = 1 - p.t / p.life; g.strokeStyle = col(k, p.hot); g.lineWidth = p.s; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - p.vx * .02, py - p.vy * .02); g.lineTo(p.x, p.y); g.stroke();
        }
        if (alive) requestAnimationFrame(step); else { dead = true; cv.remove(); }
      };
      requestAnimationFrame(step); later(() => { dead = true; cv.remove(); }, 4000);
    }
    // Slicing: blades of light cut the plate (two or three cuts); it comes apart along them, holds, and slams back together
    function slicePlate(r, color, fromEngine) {
      if (!r || POTATO() || calm()) return; const { el, node, parts } = r, inn = parts.inn; if (parts.slicing) return; parts.slicing = true;
      const n = 2 + (Math.random() < .5 ? 1 : 0), cuts = [], c0 = color || '#e8f6ff';
      for (let i = 0; i < n; i++) { const x = el.w * (.18 + (i + .5) / n * .64 + (Math.random() - .5) * .08), lean = (Math.random() - .5) * el.h * 1.1; cuts.push([[x - lean, -4], [x + lean, el.h + 4]]); }
      // the pieces: the plate's box cut along every line (left to right), each a clone of the plate clipped to its strip
      const strips = []; let prev = [[-20, -20], [-20, el.h + 20]];
      for (const c of [...cuts, [[el.w + 20, -20], [el.w + 20, el.h + 20]]]) { strips.push([prev[0], c[0], c[1], prev[1]]); prev = c; }
      const box = document.createElement('div'); box.className = 'sd-shards'; box.style.cssText = `position:absolute;inset:0;pointer-events:none;clip-path:path('${parts.d}')`;
      const pieces = strips.map((pts, i) => { const cl = inn.cloneNode(true); cl.classList.add('sd-shard'); cl.style.clipPath = `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`; cl.getAnimations && cl.getAnimations().forEach(a => a.cancel()); box.appendChild(cl); return cl; });
      // the blades: a white-hot line along each cut, one after another
      const bl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); bl.setAttribute('width', el.w); bl.setAttribute('height', el.h); bl.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3';
      bl.innerHTML = cuts.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c0}" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#ffffff" stroke-width="1.2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`).join('');
      box.appendChild(bl); inn.style.visibility = 'hidden'; node.appendChild(box);
      [...bl.querySelectorAll('line')].forEach((ln, i) => anim(ln, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .5 }, { strokeDashoffset: 0, opacity: 0 }], { duration: 520, delay: Math.floor(i / 2) * 110, fill: 'both' }));
      const dir = el.side === 2 ? -1 : 1;
      pieces.forEach((pc, i) => { const sx = (i - (pieces.length - 1) / 2) * 9 * dir, sy = (i % 2 ? -1 : 1) * 4, rot = (i % 2 ? 1 : -1) * 2.2;
        anim(pc, [{ transform: 'none', filter: 'none' }, { transform: 'none', offset: .16 }, { transform: `translate(${sx}px,${sy}px) rotate(${rot}deg)`, filter: 'brightness(1.25)', offset: .3 },
          { transform: `translate(${sx * 1.1}px,${sy * 1.1}px) rotate(${rot * 1.1}deg)`, offset: .72 }, { transform: 'none', filter: 'brightness(2.4) saturate(.4)', offset: .86 }, { transform: 'none', filter: 'none' }], { duration: 1250, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }); });
      // sparks off each cut as the blade passes
      const seeds = []; cuts.forEach(([a, b], ci) => { for (let k = 0; k < 18; k++) { const t = Math.random(), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, s = (Math.random() < .5 ? -1 : 1); seeds.push([x, y, s * (80 + Math.random() * 260), -60 - Math.random() * 160, .35 + Math.random() * .5, Math.random() < .35]); } });
      later(() => plateSparks(r, seeds), 80);
      if (!fromEngine && GFX) GFX.fxAt('slice', { x: el.x, y: el.y, w: el.w, h: el.h }, { color: c0 });
      later(() => { box.remove(); inn.style.visibility = ''; parts.slicing = false; }, 1300);
    }
    // Fissure: molten cracks tear open from a point, glow white-hot, boil embers, then cool through red to dark and close
    function fissure(r, color, fromEngine) {
      if (!r || POTATO()) return; const { el, node, parts } = r; if (parts.fissuring) return; parts.fissuring = true;
      const o = parts.crackO || [el.w / 2, el.h / 2], ox = o[0] + (Math.random() - .5) * el.w * .3, oy = el.h * (.4 + Math.random() * .2);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'sd-fissure-x'); svg.setAttribute('width', el.w); svg.setAttribute('height', el.h);
      svg.style.cssText = `position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2;clip-path:path('${parts.d}')`;
      const paths = crackPaths(el.w, el.h, ox, oy, Math.floor(Math.random() * 99999));
      // the inner rings only (the cracks stay round the impact), each segment bent in two so it reads as a tear, not a ruled line
      const ds = [...paths.matchAll(/data-r="(\d)" d="M([\d.-]+),([\d.-]+)L([\d.-]+),([\d.-]+)"/g)].filter(m => +m[1] <= 2).map(m => { const [x0, y0, x1, y1] = m.slice(2).map(Number), mx = (x0 + x1) / 2 + (Math.random() - .5) * 14, my = (y0 + y1) / 2 + (Math.random() - .5) * 8; return `M${x0},${y0}L${mx.toFixed(0)},${my.toFixed(0)}L${x1},${y1}`; });
      svg.innerHTML = `<g class="lava">${ds.map(d => `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" stroke="${UC('effects', '#7a1404', '#ff5a1f')}" stroke-width="7"/><path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" stroke="#ff4a12" stroke-width="3.6"/><path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" stroke="#fff1a8" stroke-width="1.4"/>`).join('')}</g>`;
      node.appendChild(svg);
      const all = [...svg.querySelectorAll('path')];
      all.forEach((pth, i) => anim(pth, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 650, delay: (i % 3) * 40 + Math.floor(i / 3) * 25, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
      // the heat: white-hot, then cooling down to dark red (the colour of each layer runs down), and gone
      anim(svg, [{ opacity: 1, filter: 'brightness(1.6)' }, { opacity: 1, filter: 'brightness(1)', offset: .35 }, { opacity: .9, filter: 'brightness(.75) saturate(1.2)', offset: .75 }, { opacity: 0, filter: 'brightness(.4)' }], { duration: 3000, delay: 200, fill: 'forwards' });
      anim(parts.inn, [{ filter: 'none' }, { filter: 'brightness(1.25) sepia(.35) saturate(1.6)', offset: .2 }, { filter: 'none' }], { duration: 1800 });
      // embers boiling out of the cracks (inside the plate)
      const seeds = []; for (let k = 0; k < (ULTRA() ? 24 : 60); k++) { const t = Math.random(), x = ox + (Math.random() - .5) * el.w * .8, y = oy + (Math.random() - .5) * el.h * .6; seeds.push([x, y, (Math.random() - .5) * 40, -30 - Math.random() * 90, .6 + Math.random() * 1.2, Math.random() < .2]); }
      later(() => plateSparks(r, seeds, { gravity: -40, col: (k, hot) => hot ? `rgba(255,240,200,${k})` : `rgba(255,${(90 + 120 * k) | 0},${(20 * k) | 0},${k * .9})` }), 250);
      if (!fromEngine && GFX) GFX.fxAt('fissure', { x: el.x, y: el.y, w: el.w, h: el.h }, { color: color || UC('effects', '#ff6a1a', '#ff5a1f') });
      later(() => { svg.remove(); parts.fissuring = false; }, 3300);
    }
    const ULTRA = () => document.documentElement.classList.contains('sb-ultra');
    function crackAt(r) { const o = r.parts.crackO || [r.el.w / 2, r.el.h / 2]; return { x: r.el.x + o[0], y: r.el.y + o[1] }; }
    // the plate breaks into pieces along its cracks: each piece is a copy of the plate cut to one wedge; they jolt apart
    // (sideways, inside the plate's own outline), flash white-hot and settle back into a fractured plate
    function shatterPlate(r) {
      const { el, node, parts } = r, inn = parts.inn, [ox, oy] = parts.crackO || [el.w / 2, el.h / 2];
      if (calm()) { node.classList.add('sd-broken'); return; }
      const box = document.createElement('div'); box.className = 'sd-shards'; box.style.cssText = `position:absolute;inset:0;pointer-events:none;clip-path:path('${parts.d}')`;
      const N = 9, R = Math.max(el.w, el.h) * 2, rnd = rng(el.w * 7 + el.side), list = [];
      const ang = Array.from({ length: N }, (_, i) => (i + .2 + rnd() * .6) / N * Math.PI * 2);
      for (let i = 0; i < N; i++) {
        const a0 = ang[i], a1 = ang[(i + 1) % N] + (i === N - 1 ? Math.PI * 2 : 0), am = (a0 + a1) / 2;
        const pts = [[ox, oy], [ox + Math.cos(a0) * R, oy + Math.sin(a0) * R], [ox + Math.cos(am) * R, oy + Math.sin(am) * R], [ox + Math.cos(a1) * R, oy + Math.sin(a1) * R]];
        const c = inn.cloneNode(true); c.classList.add('sd-shard'); c.style.clipPath = `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
        c.getAnimations && c.getAnimations().forEach(a => a.cancel());
        box.appendChild(c); list.push([c, Math.cos(am), Math.sin(am)]);
      }
      inn.style.visibility = 'hidden'; node.appendChild(box);
      for (const [c, cx, cy] of list) {
        const dx = cx * (8 + rnd() * 10), dy = cy * (1.5 + rnd() * 2), rot = (rnd() - .5) * 5;
        anim(c, [{ transform: 'none', filter: 'brightness(1)' }, { transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`, filter: 'brightness(3.2) saturate(.2)', offset: .18 },
          { transform: `translate(${(dx * .55).toFixed(1)}px,${(dy * .4).toFixed(1)}px) rotate(${(rot * .5).toFixed(1)}deg)`, filter: 'brightness(1.6)', offset: .5 }, { transform: 'none', filter: 'brightness(.62) saturate(.55)' }],
          { duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      }
      if (GFX && !Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k))) GFX.event('shatter', { side: el.side, at: crackAt(r) });
      if (el.dyn && el.dyn.crt) { crtSparks(r); node.classList.remove('sd-crt'); void node.offsetWidth; node.classList.add('sd-crt'); later(() => node.classList.remove('sd-crt'), 950); }
      node.classList.add('sd-broken');
      later(() => { box.remove(); inn.style.visibility = ''; }, 1150);
    }
    // a smashed CRT (1.11, asked for by name): the screen flickers and tears, and a spray of sparks bursts out of the crack,
    // ricochets round inside the plate and dies out (~1.2 s). Drawn on a small 2D canvas cut to the plate's own outline, so
    // nothing leaves the plate (HUD-safe) and it plays the same with the effects engine on, light or off.
    function crtSparks(r) {
      const { el, parts } = r, o0 = crackAt(r), bx = el.x, by = el.y, bw = el.w, bh = el.h;
      const cv = document.createElement('canvas'), dpr = Math.min(1.5, window.devicePixelRatio || 1); cv.width = bw * dpr; cv.height = bh * dpr;
      cv.className = 'sd-crtsparks'; cv.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;pointer-events:none;z-index:60;clip-path:path('${parts.d || pathFor(el)}')`;
      root.appendChild(cv); const g = cv.getContext('2d'); g.scale(dpr, dpr);
      const rnd = rng(el.w * 13 + el.side * 7 + SEEDNOW() % 997), N = POTATO() ? 36 : 90, ps = [], o = { x: o0.x, y: o0.y };
      for (let i = 0; i < N; i++) {
        const a = rnd() * Math.PI * 2, v = 160 + rnd() * 560;
        ps.push({ x: o.x - bx + (rnd() - .5) * 20, y: o.y - by + (rnd() - .5) * 10, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * .55 - 60, life: .45 + rnd() * .8, t: 0, s: 1 + rnd() * 1.6, hot: rnd() < .3, b: 0 });
      }
      const floorY = bh - 2, ceilY = 2; let last = performance.now(), dead = false;
      const step = now => {
        if (dead) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now; g.clearRect(0, 0, bw, bh); g.globalCompositeOperation = 'lighter'; let alive = 0;
        for (const p of ps) {
          if (p.t >= p.life) continue; alive++; p.t += dt; const px = p.x, py = p.y;
          p.vy += 900 * dt; p.vx *= (1 - 1.4 * dt); p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > floorY && p.vy > 0) { p.y = floorY; p.vy *= -.45; p.vx *= .7; p.b++; }          // they skip along the bottom of the plate…
          if (p.y < ceilY && p.vy < 0) { p.y = ceilY; p.vy *= -.4; }                                  // …and off its top edge
          if (p.x < 2 || p.x > bw - 2) { p.vx *= -.5; p.x = Math.max(2, Math.min(bw - 2, p.x)); }
          const k = 1 - p.t / p.life, c = p.hot ? `rgba(255,255,255,${k})` : `rgba(255,${(150 + 90 * k) | 0},${(60 * k) | 0},${k})`;
          const tx = p.x - p.vx * .03, ty = p.y - p.vy * .03;
          g.lineCap = 'round'; g.strokeStyle = p.hot ? `rgba(160,200,255,${.25 * k})` : `rgba(255,120,40,${.3 * k})`; g.lineWidth = p.s * 3.2; g.beginPath(); g.moveTo(tx, ty); g.lineTo(p.x, p.y); g.stroke();   // the glow
          g.strokeStyle = c; g.lineWidth = p.s * (0.7 + k * .7); g.beginPath(); g.moveTo(tx, ty); g.lineTo(p.x, p.y); g.stroke();
        }
        if (ps[0].t < .16) { const f = 1 - ps[0].t / .16, gr = g.createRadialGradient(o.x - bx, o.y - by, 0, o.x - bx, o.y - by, 90); gr.addColorStop(0, `rgba(255,250,235,${.9 * f})`); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(o.x - bx - 90, o.y - by - 90, 180, 180); }
        if (alive) requestAnimationFrame(step); else { dead = true; cv.remove(); }
      };
      requestAnimationFrame(step); later(() => { dead = true; cv.remove(); }, 3200);
    }
    function textActive(el) {
      if (el.kind !== 'bar' || !el.font.fxWhen || el.font.fxWhen === 'always') return true;
      const b = barState(el), w = el.font.fxWhen;
      return w === 'lead' ? b.lead : w === 'matchpoint' ? b.mp || b.win : w === 'winner' ? b.win : true;
    }
    function isActive(el) {
      const t = el.effect && el.effect.type; if (!t || t === 'none') return false;
      if (el.kind !== 'bar' || el.effect.when === 'always') return true;
      const b = barState(el);
      return el.effect.when === 'lead' ? b.lead : el.effect.when === 'matchpoint' ? b.mp || b.win : el.effect.when === 'winner' ? b.win : true;
    }
    // ------------------------------------------------------------------ 1.12.21: tempo, readable lettering, the header's small line, pips
    // a layout's tempo: how its scoreboard moves when the app moves it (a point, a swap, a new set). Classic is snappy, Obsidian
    // Glass overshoots, Porcelain is soft; a layout that doesn't say is snappy.
    const TEMPO = { snappy: { d: 210, e: 'cubic-bezier(.2,.8,.2,1)', num: 240 }, overshoot: { d: 420, e: 'cubic-bezier(.3,1.45,.5,1)', num: 440 }, soft: { d: 720, e: 'cubic-bezier(.4,0,.2,1)', num: 700 } };
    const tempoName = () => (D.motion && TEMPO[D.motion.tempo] ? D.motion.tempo : 'snappy'), tempoOf = () => TEMPO[tempoName()];
    // a lettering colour that reads on `bg`: the design's own when any of it does (2.2 : 1 is where big letters stop reading)
    function autoInk(paintObj, bg) {
      if (!paintObj || !/^#[0-9a-f]{6}$/i.test(bg || '') || !['solid', 'linear', 'radial'].includes(paintObj.type || 'solid')) return paintObj;
      const cs = cols(paintObj).filter(c => /^#[0-9a-f]{6}/i.test(c)).map(c => c.slice(0, 7)); if (!cs.length) return paintObj;
      if (Math.max(...cs.map(c => contrast(c, bg))) >= 2.2) return paintObj;
      return { type: 'solid', colors: [readable(cs[0], bg, 4.5)], angle: 180 };
    }
    // the header's small line: the event · the set's length · the game being played · the set timer. When they don't all fit,
    // "Best of 5" becomes "BO5", then the event's name goes (it's on every splash), then the lettering gets a little smaller.
    function paintMeta(r) {
      const { el, parts } = r, m = parts.meta; if (!m) return;
      const game = el.metaGame !== false && V.gameText ? V.gameText : '', time = el.metaTimer !== false && S.x && S.x.timer && V.setTimer ? V.setTimer : '';
      const key = [S.event || '', S.bestOfText || '', S.bestOfShort || '', game, time ? time.length : 0].join('\u0001');   // (the clock's length too: at one hour it grows by two characters, and the line is laid out again)
      if (parts.metaK === key) { if (time && parts.metaT && parts.metaT.dataset.t !== time) { parts.metaT.dataset.t = time; parts.metaT.textContent = time; } return; }
      parts.metaK = key;
      const base = el.h * .22, mk = (cls, t) => `<span class="sd-m-${cls}" data-t="${esc(t)}">${esc(t)}</span>`, sep = '<span class="sd-m-sep">◆</span>';
      const draw = (ev, bo) => { m.innerHTML = [ev ? mk('ev', ev) : '', bo ? mk('bo', bo) : '', game ? mk('g', game) : '', time ? mk('t', time) : ''].filter(Boolean).join(sep); parts.metaT = m.querySelector('.sd-m-t'); };
      const over = () => { const ev = m.querySelector('.sd-m-ev'); return m.scrollWidth > m.clientWidth + 1 || (ev && ev.scrollWidth > ev.clientWidth + 1); };
      m.style.fontSize = base + 'px'; draw(S.event, S.bestOfText);
      if (!m.isConnected || !over()) return;
      const short = S.bestOfShort || S.bestOfText;
      draw(S.event, short); if (!over()) return;
      if (game || time) { draw('', short); if (!over()) return; }
      let fs2 = base; for (let i = 0; i < 6 && over(); i++) { fs2 *= .94; m.style.fontSize = fs2.toFixed(2) + 'px'; }
    }
    // score pips: one for every game it takes, filled as games are won; the one that would win the set stands out at match point
    function pipPath(el, w, h, mirror) {
      const sh = SHAPES[el.pip] || SHAPES.diamond;
      if (sh.pill) { const rd = Math.min(w, h) / 2; return `M${rd},0H${w - rd}A${rd},${rd} 0 0 1 ${w - rd},${h}H${rd}A${rd},${rd} 0 0 1 ${rd},0Z`; }
      return 'M' + sh.pts.map(([x, y]) => `${((mirror ? 1 - x : x) * w).toFixed(2)},${(y * h).toFixed(2)}`).join('L') + 'Z';
    }
    function drawPips(r, n, score, st) {
      const { el, parts } = r, box = parts.pips, gap = Number(el.gap) || 0, ratio = Math.max(.2, Number(el.ratio) || 1), sw = Math.max(1, Math.min(2.5, el.h * .09));
      let pw = n ? (el.w - gap * (n - 1)) / n : 0, ph = pw / ratio; if (ph > el.h) { ph = el.h; pw = ph * ratio; }
      pw = Math.max(2, pw - sw); ph = Math.max(2, ph - sw);                                   // room for the outline
      const rtl = el.dir ? el.dir === 'rtl' : el.side === 2;
      // 1.5.8: and a slanted pip (Street Fighter 6's) leans the other way on 2P's side, like the frame around it
      // 1.5.8: 2P's row runs right to left, so "right" is where the row starts (flex-start), not where it ends: they were at the
      // wrong end of their slot, 32 px off 1P's mirror image on Tekken 8
      const at = alignOf(el, rtl ? 'right' : 'left');
      box.style.justifyContent = (rtl ? { left: 'flex-end', right: 'flex-start' }[at] : null) || JUST[at] || 'flex-start'; box.style.gap = gap + 'px'; box.style.flexDirection = rtl ? 'row-reverse' : 'row';
      // (on a bar whose plate has turned gold or dimmed, the pips keep reading: a colour that's lost there is nudged, and the
      // glaze a not-yet pip is filled with dims along with the loser's plate)
      const g = st.win || st.lose ? groundOf(r) : null, hold = c => (g && /^#[0-9a-f]{6}$/i.test(c || '') && contrast(c, g.tone) < 2 ? readable(c, g.tone, 3) : c);
      // 1.5.10: the win colour is for pips on the winner's plate, which lights up (dark pips read there). Pips in a box of their
      // own (Street Fighter 6, Avatar, Fatal Fury) keep the player's colour: dark on a dark box, the sets won looked unlit
      const onWin = st.win && el.winColor && g && g.st === 'win';
      const d = pipPath(el, pw, ph, rtl), onC = hold(onWin ? el.winColor : el.onColor), offC = el.offColor, quiet = el.pulse === false || calm() || POTATO();
      const offF = !el.offFill ? 'none' : g && st.lose && /^#[0-9a-f]{6}$/i.test(el.offFill) ? mix(el.offFill, g.tone, .6) : el.offFill;
      // 1.5.8: el.gem — a won pip lit like a gem (the old Ember layout's set diamonds): a glint from light to deep across it,
      // a pale edge and a soft glow in its own colour. Not on the winner's gold plate, where the pips go dark to read.
      const gem = el.gem && !st.win && /^#[0-9a-f]{6}/i.test(onC || ''), gc = gem ? onC.slice(0, 7) : '';
      const gemDefs = gem ? `<defs><linearGradient id="${esc(el.id)}-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(gc, '#ffffff', .62)}"/><stop offset=".55" stop-color="${gc}"/><stop offset="1" stop-color="${mix(gc, '#000000', .42)}"/></linearGradient></defs>` : '';
      let html = '';
      for (let i = 0; i < n; i++) {
        const on = i < score, next = !on && st.mp && i === score, lit = gem && on;
        html += `<svg${next ? ` class="${quiet ? 'sd-pip-mark' : 'sd-pip-next'}"` : ''} width="${(pw + sw).toFixed(1)}" height="${(ph + sw).toFixed(1)}" viewBox="${(-sw / 2).toFixed(2)} ${(-sw / 2).toFixed(2)} ${(pw + sw).toFixed(2)} ${(ph + sw).toFixed(2)}"${lit ? ` style="filter:drop-shadow(0 0 ${Math.max(2, ph * .42).toFixed(1)}px ${gc})"` : ''}>${i === 0 ? gemDefs : ''}<path class="sd-pip${on ? ' sd-pip-on' : ''}" d="${d}" fill="${lit ? `url(#${esc(el.id)}-gem)` : esc(on ? onC : next ? onC : offF)}"${next ? ' fill-opacity=".5"' : ''} stroke="${lit ? mix(gc, '#ffffff', .7) : esc(on || next ? onC : offC)}" stroke-width="${sw.toFixed(2)}" stroke-linejoin="round"/></svg>`;
      }
      box.innerHTML = html; box.style.setProperty('--pipd', { snappy: '.9s', overshoot: '1.15s', soft: '2.4s' }[tempoName()]);
      const pip = st.grew && !POTATO() && box.children[score - 1] ? box.children[score - 1].firstChild : null;
      if (pip) {                                                                              // the pip just won comes in at the layout's tempo
        if (calm()) anim(pip, [{ opacity: .2 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
        else if (tempoName() === 'overshoot') anim(pip, [{ transform: 'scale(.2)', filter: 'brightness(3)' }, { transform: 'scale(1.6)', filter: 'brightness(2)', offset: .5 }, { transform: 'scale(.88)', filter: 'none', offset: .78 }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'ease-out' });
        else if (tempoName() === 'soft') anim(pip, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 800, easing: 'cubic-bezier(.4,0,.2,1)' });
        else anim(pip, [{ transform: 'scale(.4)' }, { transform: 'scale(1.18)', offset: .6 }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
    const ticking = new Set(); let tickT = 0;
    let paintN = 0, laneWas = 0; let footTop;      // (1.12.24: the top of a bottom-centre scoreboard, worked out once)
    function paint(first) {
      paintN++; if (!first && opts.live) stillsAfterPaint();
      V = view(S); ticking.clear();
      // 1.12.21: a swap is not a point. The two sides change places, so what each side "was" changes places with them — the
      // score's flash, the pips, the plates' reactions and the effects engine then see nothing new (it used to play P2's
      // "point scored" whenever the higher score landed on that side).
      let swapNow = false;
      if (!first && prevScores && prevNames[0] && prevNames[1] && prevNames[0].toLowerCase() !== prevNames[1].toLowerCase()
        && String((S.p1 || {}).name || '').toLowerCase() === prevNames[1].toLowerCase() && String((S.p2 || {}).name || '').toLowerCase() === prevNames[0].toLowerCase()) {
        swapNow = true; prevScores = [prevScores[1], prevScores[0]]; prevNames = [prevNames[1], prevNames[0]]; prevMP = [prevMP[1], prevMP[0]]; prevL = [prevL[1], prevL[0]]; prevWin = prevWin ? 3 - prevWin : 0; lostRow.reverse();
        for (const r of doms.values()) { r.parts.numWas = undefined; r.parts.pipScore = undefined; }
      }
      for (const r of doms.values()) {
        const { el, node, parts } = r;
        if (el.tintTpl) {      // 1.12.7: a live colour wash over the piece — e.g. {fx.vsc.0}, the colour picked for Player 1's side of the VS screen
          const c = String(el.tintTpl).split('||').map(t => fillText(t, V).trim()).find(x => /^#[0-9a-f]{6}$/i.test(x)) || '';
          if (parts.tintK !== c) { parts.tintK = c;
            if (c && !parts.tint) { parts.tint = document.createElement('i'); parts.tint.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:block'; parts.tint.style.borderRadius = (Number(el.radius) || 0) + 'px'; node.appendChild(parts.tint); }
            if (parts.tint) { parts.tint.style.background = c ? String(el.tintCss || '$c').replace(/\$c/g, c) : ''; parts.tint.hidden = !c; } }
        }
        if (el.kind === 'bar') {
          const b = barState(el), p = b.me;
          // 1.12.21: what shares the name's row is set first — the team tag, the loser's L, the flag, the pronouns — and the
          // name is fitted again whenever one of them changes. It used to be fitted the moment the name changed, before the
          // new team tag was in: a longer tag then pushed the name a few pixels past its box, and the last letter was cut.
          const nameNew = setText(parts.name, p.name || `Player ${el.side}`), flag = String(p.flagUrl || '');
          setText(parts.team, p.team || ''); parts.team.style.display = el.showTeam && p.team ? '' : 'none';
          parts.ltag.classList.toggle('sd-on', !!p.loser); parts.ltag.style.background = el.teamColor || '#d9dce4'; parts.ltag.style.color = lum(el.teamColor || '#d9dce4') > .55 ? '#08080a' : '#fff';
          if (el.showFlag && flag) { if (parts.flag.getAttribute('src') !== flag) { parts.flag.classList.remove('sd-off'); parts.flag.src = flag; } parts.flag.style.display = ''; } else parts.flag.style.display = 'none';
          setText(parts.pro, p.pronouns || '');
          { const rowK = [el.showTeam && p.team ? p.team : '', p.loser ? 1 : 0, el.showFlag && flag ? 1 : 0, p.pronouns || ''].join('\u0001');
            if (nameNew || first || parts.rowK !== rowK) { parts.rowK = rowK;
              // a long team name (a game format shows the whole name here) may take what the player's name doesn't need — all of
              // the line beside a short name, four tenths of it at least beside a long one — and gets a little smaller before
              // it's cut with “…”. It used to take all it wanted, and the name was squeezed out of its box.
              const l1 = parts.name.parentNode, rowW = l1 ? l1.clientWidth : 0;
              if (rowW && el.showTeam && p.team) {
                parts.team.style.maxWidth = 'none'; parts.name.style.fontSize = parts.nameSize + 'px';
                const gap = parseFloat(getComputedStyle(l1).columnGap) || 0, rest = [...l1.children].filter(c => c !== parts.team && c !== parts.name && c.offsetWidth).reduce((t, c) => t + c.offsetWidth + gap, 0);
                parts.team.style.maxWidth = Math.max(rowW * .42, rowW - parts.name.scrollWidth - rest - gap - 1).toFixed(1) + 'px';
                fitText(parts.team, parts.teamSize, parts.teamSize * .72);
              }
              fitText(parts.name, parts.nameSize, Math.max(10, parts.nameSize * .45)); }
            if (nameNew && !first && booted && !swapNow) textAnim(parts.name, el.font.anim); }
          { const was = parts.numWas, now = Number(p.score) || 0, flip = !(S.x && S.x.sb && S.x.sb.noflip); parts.numWas = now;
            if (setText(parts.num, p.score ?? 0) && !first && booted && flip && !swapNow) {
              textAnim(parts.num, el.font.numAnim, tempoOf().num);
              if (was != null && now > was && !POTATO() && !calm()) { const sb2 = parts.scoreBox; sb2.style.setProperty('--ptd', (tempoOf().d * 2.2 / 1000).toFixed(2) + 's'); sb2.classList.remove('sd-pt'); void sb2.offsetWidth; sb2.classList.add('sd-pt'); later(() => sb2.classList.remove('sd-pt'), 2000); }   // 1.12.21: a flash in the scorer's own colour
            } }
          const st8 = b.win ? 'win' : b.lose ? 'lose' : 'normal', tone = plateTone(el, st8), faded = st8 === 'lose' ? x => mix(x, tone, .15) : x => x, need = st8 === 'lose' ? 4 : 6;   // aimed above the 3 / 4.5 the test asks for: textures and sheen on the plate vary
          parts.pro.style.color = readable(st8 === 'win' && lum(el.winColor) > .55 ? UC('accent', '#3a2405', '#f6c453') : el.subColor, tone, need, faded);
          // 1.12.21: the team tag reads on the plate in every state — gold on the winner's gold plate (1.7:1 on Obsidian
          // Glass) is nudged toward black or white until it reaches 3:1; the side tag keeps reading on a dimmed score box
          { const tk = st8 + '|' + parts.teamInk; if (parts.teamK !== tk) { parts.teamK = tk; const ti = parts.teamInk;
              parts.team.style.color = st8 !== 'normal' && /^#[0-9a-f]{6}$/i.test(ti || '') && /^#[0-9a-f]{6}$/i.test(tone || '') && contrast(faded(ti), tone) < 2.2 ? readable(ti, tone, 3, faded) : ti; }
            if (parts.sideTag) { const dk = b.lose && el.loseDim !== false ? 'l' : 'n'; if (parts.tagK !== dk) { parts.tagK = dk; parts.sideTag.style.color = dk === 'l' ? parts.tagInkLose : parts.tagInk; } } }
          setText(parts.status, b.win ? 'Victory' : b.mp && b.danger ? 'Final game' : b.mp ? 'Match point' : b.danger ? 'On the edge' : '');
          parts.status.style.color = readable(b.win ? (lum(el.winColor) > .55 ? UC('accent', '#3a2405', '#f6c453') : el.winColor) : (el.statusColor || el.teamColor), tone, need, faded);
          // (what a game format adds to this line — “#1 of 4 · 4 left” — takes the same ink on the winner's plate: its own gold on gold couldn't be read)
          if (b.win) node.style.setProperty('--l2ink', parts.status.style.color); else node.style.removeProperty('--l2ink');
          const wasWin = node.classList.contains('sd-win');
          node.classList.toggle('sd-win', b.win); node.classList.toggle('sd-lose', b.lose);
          node.classList.toggle('sd-winglow', b.win && Number(el.winGlow) > 0); if (Number(el.winGlow) > 0) node.style.setProperty('--wg', String(Number(el.winGlow)));
          node.classList.toggle('sd-dimlose', b.lose && el.loseDim !== false); node.classList.toggle('sd-lose-crack', b.lose && el.loseStyle === 'crack');
          node.classList.toggle('sd-lead', b.lead); node.classList.toggle('sd-mp', b.mp);
          const wt = node.querySelector('.sd-wint'); if (wt) wt.style.opacity = b.win ? 1 : 0;
          if (parts.stroke) parts.stroke.setAttribute('stroke', b.win ? el.winColor : (el.stroke.width ? el.stroke.color : 'transparent'));
          if (parts.stroke && b.win && !el.stroke.width) parts.stroke.setAttribute('stroke-width', 2);
          if (parts.stroke && !b.win) parts.stroke.setAttribute('stroke-width', Number(el.stroke.width) || 0);
          const darkName = b.win && lum(el.winColor) > .55;           // gold plate: dark lettering stays readable
          textPaint(parts.name, darkName ? { type: 'linear', angle: 180, colors: [UC('accent', '#3a2405', '#f6c453'), UC('accent', '#120a01', '#f6c453')] } : st8 === 'normal' ? autoInk(el.font.color, tone) : el.font.color);
          parts.name.style.filter = darkName && !(el.font.fx && el.font.fx !== 'none') ? 'drop-shadow(0 1px 0 rgba(255,246,214,.7))' : '';
          if (!first && b.win && !wasWin && !POTATO()) { node.classList.remove('sd-flash'); void node.offsetWidth; node.classList.add('sd-flash'); later(() => node.classList.remove('sd-flash'), 700); }
          if (el.dyn) dynPlate(r, b, first);
        } else if (el.kind === 'header') {
          paintMeta(r); if (el.metaTimer !== false && S.x && S.x.timer && V.setTimer) ticking.add(r);
          if (setText(parts.round, S.round || '') || first) { fitText(parts.round, parts.roundSize, 10); if (!first && booted) textAnim(parts.round, el.font.anim); }
        } else if (el.kind === 'comms') {
          setText(parts.c1, (S.c1 && S.c1.name) || ''); setText(parts.c2, (S.c2 && S.c2.name) || '');
          parts.sep.style.display = S.c2 && S.c2.name ? '' : 'none';
          node.style.visibility = (S.c1 && S.c1.name) || opts.edit ? '' : 'hidden';
        } else if (el.kind === 'text' && el.rule && el.rule.on && !first && parts.text && parts.text.textContent && el.exit && el.exit.type && el.exit.type !== 'none' && !ruleOk(el.rule, V)) {
          // 1.12.21: a piece whose rule has turned off keeps what it said while it leaves (a moment banner's words don't blank as it slides away)
        } else if (el.kind === 'text') {
          const fb = el.fallback || {}, empty = fb.mode && fb.mode !== 'none' && allEmpty(el.text, V);
          node.style.visibility = empty && fb.mode === 'hide' && !opts.edit ? 'hidden' : '';
          const txt = empty && fb.mode === 'text' ? fillText(fb.text || '', V) : fillText(el.text, V);
          if (parts.curve) { if (parts.curve.textContent !== txt) parts.curve.textContent = el.font.upper ? txt.toUpperCase() : txt; }
          else if (setText(parts.text, txt) || first) { fitText(parts.text, parts.textSize, parts.minSize || 10, parts.wrap); if (!first && booted && !hasTime(el.text) && !node.classList.contains('sd-rule-off')) textAnim(parts.text, el.font.anim); }
          if (hasTime(el.text) || hasTime(fb.text)) ticking.add(r);
          // 1.12.21: lettering laid on a bar (the SET label by the pips) keeps reading when that bar's plate changes
          if (!el.font.inkTpl && parts.text && !(el.fill && el.fill.type && el.fill.type !== 'none')) {
            const g = groundOf(r), gk = g ? g.st + g.tone : '';
            if ((parts.gK || '') !== gk) { parts.gK = gk; const c0 = cols(el.font.color).filter(c => /^#[0-9a-f]{6}/i.test(c)).map(c => c.slice(0, 7))[0], small = (parts.textSize || 0) < 19;
              textPaint(parts.text, g && c0 && contrast(c0, g.tone) < (small ? 4 : 2.6) ? { type: 'solid', colors: [readable(c0, g.tone, small ? 4.5 : 3)] } : el.font.color); }
          }
          if (el.font.inkTpl && parts.text) {      // a live colour (e.g. {vsArt.ink}: lettering that suits the VS name bar picture the user uploaded)
            const ink = el.font.inkTpl.split('||').map(t => fillText(t, V).trim()).find(x => /^#[0-9a-f]{6}$/i.test(x)) || '', k = ink;   // 1.12.6: 'a||b' — the first that's a colour
            if (parts.inkK !== k) { parts.inkK = k;
              // 1.12.21: on the piece's own plate, a live colour that can't be read there is nudged until it can (a navy team colour on a black plate)
              const own = k && el.fill && el.fill.type && el.fill.type !== 'none' ? plateTone(el, 'normal') : '', ink2 = own && /^#[0-9a-f]{6}$/i.test(own) && contrast(k, own) < 2.2 ? readable(k, own, 4.5) : k;
              textPaint(parts.text, ink2 ? { type: 'solid', colors: [ink2] } : el.font.color); parts.text.style.textShadow = k && V.vsArt && V.vsArt.edge ? V.vsArt.edge : ''; }
          }
        } else if (el.kind === 'pips') {
          const sd = el.side === 2 ? 2 : 1, me = S['p' + sd] || {}, ft = Number(S.firstTo) || 0, max = Math.max(1, Number(el.max) || 5), n = ft >= 2 && ft <= max ? ft : 0;
          const score = Math.max(0, Math.min(n, Number(me.score) || 0)), w = S.winnerSide || 0, mp = !w && !!me.matchPoint, k = `${n}|${score}|${w === sd ? 'w' : w ? 'l' : ''}|${mp ? 'm' : ''}|${calm() ? 'c' : ''}`;
          node.style.visibility = n || opts.edit ? '' : 'hidden';                 // a long set (or no set length): the number says it
          if (parts.pipK !== k) { const was = parts.pipScore; parts.pipK = k; parts.pipScore = score;
            drawPips(r, n || (opts.edit ? 3 : 0), n ? score : 1, { win: w === sd, lose: !!w && w !== sd, mp, grew: !first && booted && was != null && score > was && !(S.x && S.x.sb && S.x.sb.noflip) }); }
        } else if (el.kind === 'three') {
          if (parts.p3 && window.Beebo3D) window.Beebo3D.set(parts.p3, el);
        } else if (el.kind === 'logo' && el.srcTpl && parts.limg) {
          let u = fillText(el.srcTpl, V);
          if (/\{[^}]+\}/.test(el.srcTpl) && u === el.srcTpl.replace(/\{[^}]+\}/g, '')) u = '';   // every live field empty (no character yet): no picture, no request
          if (parts.limg.dataset.u !== u) { parts.limg.dataset.u = u; parts.limg.style.visibility = u ? '' : 'hidden'; if (u) parts.limg.src = u; else parts.limg.removeAttribute('src'); }
        } else if (el.kind === 'list') {
          const items = listItems(el, S), max = Math.max(1, Number(el.max) || 4), shown = items.slice(0, max);
          const key = JSON.stringify(shown);
          if (parts.list.dataset.k !== key) {
            const glide = !first && booted && parts.list.children.length && window.SBMotion && !POTATO() && !calm();      // re-ordered: rows glide to their new places (FLIP)
            const redraw = () => {
            parts.list.dataset.k = key; parts.list.innerHTML = '';
            const tpl = el.tpl || '{item.text}';
            const rows = shown.length ? shown : (opts.edit ? [{ text: '(empty list)', name: '(empty list)', display: '(empty list)' }] : []);
            const rh = Number(el.rowH) || 40, plate = el.rowFill && el.rowFill.type && el.rowFill.type !== 'none';
            for (const [i, it] of rows.entries()) { const d = document.createElement('div'); d.className = 'sd-item' + (it.state ? ' sd-st-' + it.state : ''); d.style.fontSize = parts.itemSize + 'px'; d.style.height = rh + 'px';
              if (plate) {          // each row on its own plate (Row plate in the inspector): the first one can stand out
                const top = i === 0 && el.rowTop && el.rowTop.type && el.rowTop.type !== 'none';
                d.style.background = cssPaint(top ? el.rowTop : el.rowFill); d.style.alignSelf = 'stretch'; d.style.padding = `0 ${rh * .35}px`; d.style.borderRadius = (Number(el.rowRadius) || 0) + 'px';
                if (el.rowEdge) d.style.boxShadow = `inset ${alignOf(el, 'left') === 'right' ? -rh * .09 : rh * .09}px 0 0 ${el.rowEdge}`;
                if (el.dir !== 'across') d.style.justifyContent = JUST[alignOf(el, 'left')];
              }
              if (el.pics && el.source === 'bracketStandings' && it.name) { const pv = document.createElement('span'); pv.className = 'sd-li-pv'; pv.style.cssText = `width:${rh * .72}px;height:${rh * .72}px`; pv.innerHTML = brPic(it, CORE.brModel); d.appendChild(pv); }
              const t = plate || el.pics ? d.appendChild(document.createElement('span')) : d;          // gradient letters clip their own box, so the plate gets its own
              t.textContent = fillText(tpl, { ...V, item: it }); textPaint(t, plate && i === 0 && el.rowTopInk ? { type: 'solid', colors: [el.rowTopInk] } : el.font.color); d.dataset.k = String(it.name || it.text || i); parts.list.appendChild(d); }
            };
            if (glide) window.SBMotion.flip(parts.list, redraw, { across: el.dir === 'across', feel: (D.motion && D.motion.feel) || 'snappy' }); else redraw();
          }
          node.style.visibility = !shown.length && !opts.edit && el.hideEmpty !== false ? 'hidden' : '';
        } else if (el.kind === 'bracket') {
          drawBracket(r, S);
        } else if (el.kind === 'ticker') {
          const items = el.source === 'custom' ? String((S.custom || {})[el.key || 'list'] || '').split(/\s*(?:\||\n)\s*/).filter(Boolean)
            : el.source === 'upcoming' ? (S.upcoming || []).map(u => `${u.round ? u.round + ': ' : ''}${u.p1} vs ${u.p2}`) : [fillText(el.text, V)];
          const txt = items.join(el.sep ?? '   ◆   ') || (opts.edit ? '(nothing to show yet)' : '');
          if (parts.tickK !== txt) { parts.tickK = txt; startTicker(r, txt); }
          node.style.visibility = !txt && !opts.edit ? 'hidden' : '';
          if (hasTime(el.text)) ticking.add(r);
        } else if (el.kind === 'avatar') {
          const p = el.side === 'winner' ? V.winner : el.side === 'loser' ? V.loser : (S['p' + el.side] || {});
          // 1.11: the player's own picture or clip (set in a format's roster; a green screen keyed out) comes before the avatar
          const pic = String(p.media || ''), pkey = String(p.mediaKey || ''), src = pic ? '' : String(p.avatar || ''), pid = pic + '|' + pkey;
          if ((parts.avaPic || '') !== pid) {
            parts.avaPic = pid;
            if (pic && window.BeeboKey) { BeeboKey.media(parts.ava, pic, pkey, { fit: 'cover' }); parts.ava.classList.add('sd-img', 'sd-pic'); }
            else { if (window.BeeboKey) BeeboKey.media(parts.ava, '', ''); parts.ava.classList.remove('sd-pic'); }
          }
          if (!pic && parts.avaImg.dataset.src !== src) { parts.avaImg.dataset.src = src; parts.ava.classList.remove('sd-img'); if (src) parts.avaImg.src = src; else parts.avaImg.removeAttribute('src'); }
          setText(parts.avaIni, String(p.name || '?').trim().charAt(0).toUpperCase());
          { const fr = S.frames && S.frames[String(p.name || '').trim().toLowerCase()], fk = fr ? `${fr.z}|${fr.x}|${fr.y}` : '';     // 1.12.6: the picture's size and centre (set in the app)
            if ((parts.avaFr || '') !== fk) { parts.avaFr = fk; parts.ava.style.setProperty('--pz', fr ? Number(fr.z) || 1 : 1); parts.ava.style.setProperty('--px', (fr ? Number(fr.x) || 0 : 0) + '%'); parts.ava.style.setProperty('--py', (fr ? Number(fr.y) || 0 : 0) + '%'); } }
        }
        // lettering effect (bars: only while ahead / at match point / when they win, if chosen)
        const tfx = el.font.fx || 'none', tOn = tfx !== 'none' && textActive(el);
        for (const n of parts.letters || []) for (const k of Object.keys(TEXTFX)) n.classList.toggle('sd-tfx-' + k, tOn && k === tfx);
        if (r.fx2 && r.fx2.length) FXL.paintLooks(r, el.kind === 'bar' ? barState(el) : null, S, fxApi);
        // ongoing effect
        const on = isActive(el), t = el.effect.type;
        node.classList.toggle('sd-fx-pulse', on && t === 'pulse');
        node.classList.toggle('sd-fx-shine', on && t === 'shine');
        node.classList.toggle('sd-fx-cracks', on && t === 'cracks');
        if (el.rule && el.rule.on) {
          const okNow = ruleOk(el.rule, V), wasOff = node.classList.contains('sd-rule-off') || !!parts.ruleOut;
          // 1.12.21: a piece that has its own exit plays it when its rule turns off (it used to just fade), then it's hidden
          const hasExit = el.exit && el.exit.type && el.exit.type !== 'none' && booted && !first && !POTATO();
          if (!okNow && !wasOff && hasExit) { const tok = parts.ruleOut = {}; exitEl(r, () => { if (parts.ruleOut !== tok) return; parts.ruleOut = null; node.classList.add('sd-rule-off'); later(() => parts.inn.getAnimations().forEach(a2 => a2.cancel()), 400); }); }
          else if (!okNow && parts.ruleOut) { /* on its way out */ }
          else { if (okNow && parts.ruleOut) { parts.ruleOut = null; parts.inn.getAnimations().forEach(a2 => a2.cancel()); }
            node.classList.toggle('sd-rule-off', !okNow); }
          // …and a moment's pieces again when one banner takes over from another (Replay, or a try-out from Settings)
          if (parts.usesMo === undefined) parts.usesMo = /moment\./.test(JSON.stringify(el.rule));
          const moN = el.rule.replay && parts.usesMo ? V.moment.n || 0 : 0, moNew = okNow && !wasOff && moN && parts.moN && moN !== parts.moN; if (parts.usesMo) parts.moN = moN;
          if (okNow && (wasOff || moNew) && el.rule.replay && booted && !first) enterEl(r);      // play its entrance each time it shows
        } else node.classList.remove('sd-rule-off');
      }
      // 1.12.21: the lane above the casters (the moment banner, the head-to-head line) — how far up it reaches, so the show's
      // own cards (storyline, picks, poll, stats, sponsor) step up out of its way while it's on
      if (opts.live) {
        let top = H;
        if (V.lane) for (const r of doms.values()) { const e = r.el; if (r.scene !== 'board' || !e.rule || !e.rule.on || r.node.classList.contains('sd-rule-off') || r.parts.ruleOut) continue;
          if (r.parts.usesLane === undefined) r.parts.usesLane = /moment\.|h2h\./.test(JSON.stringify(e.rule));
          if (r.parts.usesLane && e.y > H * .7 && e.x < W * .67 && e.x + e.w > W * .33) top = Math.min(top, e.y); }
        // 1.12.24: …and a scoreboard that lives at the bottom centre (games whose HUD fills the top): the cards sit above it always
        if (footTop === undefined) { footTop = H; for (const e of ((D.scenes.board && D.scenes.board.elements) || [])) if (!e.hidden && !(e.rule && e.rule.on) && e.kind !== 'comms' && e.y > H * .8 && e.x < W * .67 && e.x + e.w > W * .33 && ['bar', 'header'].includes(e.kind)) footTop = Math.min(footTop, e.y); if (footTop < H) { for (const e of D.scenes.board.elements) if (e.kind === 'comms' && !e.hidden && e.y > H * .8) footTop = Math.min(footTop, e.y); } }
        top = Math.min(top, footTop);
        const px = top < H ? Math.max(0, Math.round(H - 42 - top + 8)) : 0;
        if (px !== laneWas) { laneWas = px; document.documentElement.style.setProperty('--sb-lane-own', px + 'px'); }
      }
      // reactions: a point scored, a set won, match point
      if (!first && booted && prevScores) {
        const sc2 = [Number(S.p1 && S.p1.score) || 0, Number(S.p2 && S.p2.score) || 0];
        const up = [1, 2].filter(sd => sc2[sd - 1] > Number(prevScores[sd - 1]));
        const down = [1, 2].filter(sd => sc2[sd - 1] < Number(prevScores[sd - 1]));
        const wonNow = S.winnerSide && !prevWin, mpNow = [1, 2].filter(sd => (S['p' + sd] || {}).matchPoint && !prevMP[sd - 1]);
        const finalNow = !!(S.p1 && S.p2 && S.p1.matchPoint && S.p2.matchPoint) && !(prevMP[0] && prevMP[1]);
        const resetNow = sc2[0] === 0 && sc2[1] === 0 && (Number(prevScores[0]) > 0 || Number(prevScores[1]) > 0);
        const changed = [1, 2].filter(sd => prevNames[sd - 1] != null && String((S['p' + sd] || {}).name || '') !== prevNames[sd - 1]);
        const lNow = [1, 2].filter(sd => (S['p' + sd] || {}).loser && !prevL[sd - 1]);
        for (const sd of up) { lostRow[sd - 1] = 0; lostRow[2 - sd] += 1; }
        for (const r of doms.values()) {
          if (r.el.kind === 'bar' && r.fx2 && r.fx2.length && FXL) {        // looks that react (streak meter, comeback spark…)
            const me = r.el.side, op = 3 - me;
            if (up.includes(me)) FXL.lookEvent(r, { type: 'score', downBy: Number(prevScores[op - 1]) - Number(prevScores[me - 1]) });
            if (up.includes(op)) FXL.lookEvent(r, { type: 'lose' });
            if (resetNow) FXL.lookEvent(r, { type: 'reset' });
          }
          const re = r.el.react; if (!re || !visible(r)) continue;
          const mine = sd => { const w = re.who || 'any'; return w === 'any' || (w === 'own' ? r.el.side === sd : Number(w) === sd); };
          const info = sd => ({ toward: sd === 1 ? -1 : 1, side: sd });
          if (re.score && re.score !== 'none' && up.some(mine)) react(r, re.score, re.sound, info(up.find(mine)));
          if (re.lose && re.lose !== 'none') { const hit = up.map(sd => 3 - sd).find(mine); if (hit) react(r, re.lose, null, { ...info(3 - hit), lostRow: lostRow[hit - 1] }); }
          if (re.win && re.win !== 'none' && wonNow && mine(S.winnerSide)) react(r, re.win, re.winSound, info(S.winnerSide));
          if (re.setlose && re.setlose !== 'none' && wonNow && mine(3 - S.winnerSide)) react(r, re.setlose, null, info(S.winnerSide));
          if (re.mp && re.mp !== 'none' && mpNow.some(mine)) react(r, re.mp);
          if (re.final && re.final !== 'none' && finalNow) react(r, re.final);
          if (re.reset && re.reset !== 'none' && resetNow) react(r, re.reset);
          if (re.change && re.change !== 'none' && changed.some(mine)) react(r, re.change);
          if (re.losers && re.losers !== 'none' && lNow.some(mine)) react(r, re.losers);
          if (re.undo && re.undo !== 'none' && down.some(mine) && !resetNow) react(r, re.undo);
        }
      }
      // BeeboFX: the look's preset plays on the same moments (only while the scoreboard is on screen)
      if (GFX && !first && booted && prevScores && !Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k))) {
        const sc3 = [Number(S.p1 && S.p1.score) || 0, Number(S.p2 && S.p2.score) || 0];
        const reset3 = sc3[0] === 0 && sc3[1] === 0 && (Number(prevScores[0]) > 0 || Number(prevScores[1]) > 0);
        if (reset3) GFX.event('reset');
        for (const sd of [1, 2]) if (sc3[sd - 1] > Number(prevScores[sd - 1])) GFX.event('point', { side: sd });
        for (const sd of [1, 2]) { const on = !!(S['p' + sd] || {}).matchPoint; if (on && !prevMP[sd - 1]) GFX.event('mp', { side: sd }); if (!on && prevMP[sd - 1]) GFX.event('mpOff', { side: sd }); }
        if (S.winnerSide && !prevWin) GFX.event('win', { side: S.winnerSide });
      }
      if (GFX) GFX.state(S);
      { const cu = (S.gfx && S.gfx.cue) || {}; if (elecSeen !== null && cu.n && cu.n !== elecSeen) { const b0 = barOf(Number(cu.side) === 2 ? 2 : 1); if (cu.kind === 'electro') electrocute(b0); else if (cu.kind === 'slice') slicePlate(b0); else if (cu.kind === 'fissure') fissure(b0); else if (cu.kind === 'stinger') playStinger(); } elecSeen = cu.n || 0; }   // Stream Deck: Electrocute 1P / 2P
      const m3 = S.m3d && S.m3d.n; if (m3dSeen !== null && m3 && m3 !== m3dSeen && window.Beebo3D) window.Beebo3D.moment(); m3dSeen = m3 || 0;
      prevNames = [String((S.p1 || {}).name || ''), String((S.p2 || {}).name || '')]; prevL = [!!(S.p1 || {}).loser, !!(S.p2 || {}).loser];
      for (const name of Object.keys(scenes)) if (FXL && scenes[name].__fxAt) FXL.paintAtmos(scenes[name], S);
      prevWin = S.winnerSide || 0; prevMP = [!!(S.p1 || {}).matchPoint, !!(S.p2 || {}).matchPoint];
      // a point was scored: burst on that bar
      const sc = [S.p1 && S.p1.score, S.p2 && S.p2.score];
      if (prevScores && !first) for (const side of [1, 2]) if (Number(sc[side - 1]) > Number(prevScores[side - 1])) {
        for (const r of doms.values()) if (r.el.kind === 'bar' && r.el.side === side && r.scene === 'board') scored(r);
      }
      prevScores = sc;
      emitters(); clipCv();
      // clocks and countdowns: update once a second
      clearInterval(tickT);
      if (ticking.size) tickT = setInterval(() => { V = view(S); for (const r of ticking) { if (r.el.kind === 'header') { paintMeta(r); continue; } const fb = r.el.fallback || {}; const txt = fillText(r.el.text, V); if (r.parts.tick) { if (r.el.source === 'text' && r.parts.tickK !== txt) { r.parts.tickK = txt; startTicker(r, txt); } continue; } if (r.parts.curve) r.parts.curve.textContent = txt; else if (setText(r.parts.text, txt)) fitText(r.parts.text, r.parts.textSize, r.parts.minSize || 10, r.parts.wrap); } }, 1000);
    }

    function startTicker(r, txt) {
      const run = r.parts.tick; run.getAnimations().forEach(a => a.cancel());
      run.innerHTML = ''; if (!txt) return;
      const sep = r.el.sep ?? '   ◆   ';
      for (let i = 0; i < 2; i++) { const sp = document.createElement('span'); sp.textContent = txt + sep; textPaint(sp, r.el.font.color); run.appendChild(sp); }
      const w = run.firstChild.offsetWidth; r.parts.tickW = w;
      if (!w || POTATO()) return;
      // short text: repeat it so the band is always full
      while (run.children.length * w < r.el.w * 2 + w && run.children.length < 12) run.appendChild(run.firstChild.cloneNode(true));
      const sp = Math.max(10, Number(r.el.speed) || 90) * ((D.motion && D.motion.speed) || 1);
      run.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }], { duration: w / sp * 1000, iterations: Infinity });
    }
    function textAnim(n, type, dur) {
      if (!type || type === 'none' || POTATO()) return;
      // 1.12 (from the prototype): during a game format, names change with a wipe out of a soft blur, never scrambled letters
      if (S && S.format && S.format.status === 'live' && /decode|glitch|scramble|type/.test(type)) {
        return anim(n, [{ clipPath: 'inset(0 100% 0 0)', opacity: .2, transform: 'translateX(-8px)', filter: 'blur(3px)' }, { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'none', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.25,1)' });
      }
      if (FXL && FXL.TEXTS[type]) { try { FXL.TEXTS[type].play(n, fxApi); } catch (e) {} return; }
      if (type === 'decode') return decode(n, 520);
      if (type === 'type') { const fin = n.dataset.txt ?? n.textContent; if (window.SBMotion) return window.SBMotion.typewriter(n, fin); let i = 0; const st = setInterval(() => { if (n.dataset.txt !== fin) return clearInterval(st); i++; n.textContent = fin.slice(0, i); if (i >= fin.length) clearInterval(st); }, Math.max(18, 420 / Math.max(1, fin.length))); n.textContent = ''; return; }
      const k = { fade: [{ opacity: 0 }, { opacity: 1 }], flip: [{ transform: 'perspective(400px) rotateX(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], slide: [{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], pop: [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: .7 }, { transform: 'none' }] }[type];
      if (k) anim(n, k, { duration: dur || 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    function react(r, type, sound, more = {}) {
      if (POTATO()) return; play(sound);
      if (r.el.kind === 'three' && window.Beebo3D && window.Beebo3D.REACTS[type]) { if (r.parts.p3) window.Beebo3D.react(r.parts.p3, type, more); return; }
      if (REACT[type] && REACT[type].gxp) {          // 1.12.15: a GPU reaction (BeeboFX 2 on the graphics card, there and back); a flash without it
        const el = r.el, R0 = REACT[type];
        const ok = gxPiece(r.parts.inn, 'gx-' + R0.gxp, 0, { edge: { x: el.x, y: el.y, w: el.w, h: el.h }, m: { dur: R0.dur, intensity: 1 }, color: rc0(el.effect.color), peak: R0.peak }, 'pulse');
        if (ok === false) anim(r.parts.inn, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9) saturate(.6)', offset: .25 }, { filter: 'brightness(1)' }], { duration: 480 });
        return;
      }
      if (REACT[type] && REACT[type].gfx) {          // an engine reaction: at the piece (on the scoreboard it stays inside the pieces)
        const el = r.el, fx = REACT[type].gfx;
        if (fx === 'electro') return electrocute(r);
        if (fx === 'slice') return slicePlate(r);
        if (fx === 'fissure') return fissure(r);
        if (!(GFX && GFX.fxAt(fx, { x: el.x, y: el.y, w: el.w, h: el.h }))) anim(r.parts.inn, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) saturate(.5)', offset: .2 }, { filter: 'brightness(1)' }], { duration: 520 });
        return;
      }
      if (FXL && FXL.REACTS[type]) { const el = r.el; try { FXL.REACTS[type].play({ ...fxApi, ...more, t: r.parts.inn, el, rect: { x: el.x, y: el.y, w: el.w, h: el.h }, color: rc0(el.effect.color), dir: el.side === 2 ? -1 : 1, score: (S['p' + (el.side === 2 ? 2 : 1)] || {}).score }); } catch (e) { console.warn('react', e); } return; }
      const n = r.parts.inn, K = {
        pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .35 }, { transform: 'scale(1)' }],
        shake: [0, -12, 10, -8, 6, -3, 0].map(x => ({ transform: `translateX(${x}px)` })),
        flash: [{ filter: 'brightness(1)' }, { filter: 'brightness(2.6) saturate(.4)', offset: .2 }, { filter: 'brightness(1)' }],
        bounce: [{ transform: 'translateY(0)' }, { transform: 'translateY(-22px)', offset: .3 }, { transform: 'translateY(0)', offset: .6 }, { transform: 'translateY(-8px)', offset: .8 }, { transform: 'translateY(0)' }],
        pop: [{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: .3 }, { transform: 'scale(.95)', offset: .7 }, { transform: 'scale(1)' }],
        spin: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }],
        glow: [{ filter: 'drop-shadow(0 0 0 transparent)' }, { filter: `drop-shadow(0 0 22px ${r.el.effect.color || UC('effects', '#ffb020', '#ff5a1f')})`, offset: .3 }, { filter: 'drop-shadow(0 0 0 transparent)' }],
      }[type];
      if (K) anim(n, K, { duration: type === 'spin' ? 700 : 620, easing: 'ease-out' });
    }
    // sound goes through sb-sound.js: Settings › Sound turns it on for the stream (off by default), the 🔊 on the preview sets the preview's level.
    // Only your own sound files play (a piece's point / win sound, a screen in / out): layouts have no sounds of their own.
    function play(url) { if (url && opts.live && window.BeeboSound) window.BeeboSound.file(url, Number(D.sound.volume) || .6); }
    function screenSound(name, dir) { const sc = D.scenes[name], own = sc.sound && sc.sound[dir]; if (own) play(own); }
    // every animation goes through here: the layout's global speed and "calm motion" apply to all of it
    function anim(node, k, o = {}) {
      const sp = (D.motion && Number(D.motion.speed)) || 1;
      // 1.12.17: a stepped move (flicker, strobe, glitch, rewind…) steps from keyframe to keyframe. Given as the whole
      // animation's easing, steps(1) held the FIRST keyframe for the whole move and then jumped to the last — so a neon
      // "flicker on" showed nothing for a second and then popped up. Each keyframe gets the steps instead.
      if (Array.isArray(k) && k.length > 2 && /^steps\(1\s*[,)]/.test(String(o.easing || ''))) { k = k.map(f => ({ easing: o.easing, ...f })); o = { ...o, easing: 'linear' }; }
      return node.animate(k, { ...o, duration: (o.duration || 500) / sp, delay: (o.delay || 0) / sp });
    }
    const calm = () => !!(D.motion && D.motion.reduced) || !!(S && S.x && S.x.sb && S.x.sb.calm);      // 1.12.21: Settings › Accessibility › Reduce motion calms the stream too

    // ------------------------------------------------------------------ particles & bolts (one canvas)
    let parts = [], bolts = [], raf = 0, last = 0, emit = [];
    function emitters() {
      emit = [];
      for (const r of doms.values()) {
        if (!isActive(r.el) || !visible(r)) continue;
        if (r.el.effect.type === 'embers' || r.el.effect.type === 'lightning') emit.push({ r, type: r.el.effect.type, color: r.el.effect.color, acc: 0 });
      }
      for (const r of doms.values()) {
        if (r.el.font && r.el.font.fx === 'flame' && visible(r) && textActive(r.el) && !['logo', 'shape'].includes(r.el.kind)) emit.push({ r, type: 'tflame', color: r.el.font.fxColor || UC('effects', '#ff3b14', '#ff5a1f'), acc: 0 });
      }
      for (const name of ['vs', 'victory']) {
        const sc = D.scenes[name];
        if (scenes[name] && !scenes[name].__baked && !scenes[name].classList.contains('sd-hidden') && (sc.effect === 'embers' || sc.effect === 'lightning') && !document.documentElement.classList.contains('sb-ultra'))
          emit.push({ scene: true, type: sc.effect, color: sc.effectColor, acc: 0, sc: name });
      }
      for (const name of sceneNames()) {               // each screen's own particles (the Particles panel)
        const pc = D.scenes[name] && D.scenes[name].particles;
        const live = pc && pc.type && pc.type !== 'none' && !calm() && scenes[name] && !scenes[name].__baked && !scenes[name].classList.contains('sd-hidden'), full = name !== 'board' && isFull(name);
        // a full screen's particles run on the GPU when the engine is on (behind its pieces, with the emitter editor's settings)
        if (full && GFX && GFX.particles(scenes[name], live ? pc : null)) continue;
        if (live && full && document.documentElement.classList.contains('sb-ultra')) continue;   // Ultra-light: a splash's particles are the one thing left that costs every frame
        if (live) emit.push({ type: 'ptc', pc, acc: 0, sc: full ? name : '' });
      }
      if (emit.length) run();
    }
    const visible = r => r.shared || (scenes[r.scene] && !scenes[r.scene].classList.contains('sd-hidden'));
    function rgbOf(c) { return hexRgb(c); }
    function spark(x, y, n, power, color, spread = Math.PI * 2, dir = -Math.PI / 2, grav = 900) {
      if (window.SBPerf) n = window.SBPerf.n(n);
      const [r, g, b] = rgbOf(color), hot = rgbOf(mix(color, '#ffffff', .6));
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - .5) * spread, sp = (120 + Math.random() * 420) * power;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: grav, life: 1, decay: .7 + Math.random() * 1.1, size: 1 + Math.random() * 2.4, c: i % 3 ? [r, g, b] : hot, trail: 1 });
      }
      run();
    }
    function bolt(x1, y1, x2, y2, color, life = .22, width = 2) {
      const pts = [[x1, y1]], n = 9;
      for (let i = 1; i < n; i++) { const t = i / n, nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, off = (Math.random() - .5) * Math.hypot(x2 - x1, y2 - y1) * .22; pts.push([x1 + (x2 - x1) * t + nx / l * off, y1 + (y2 - y1) * t + ny / l * off]); }
      pts.push([x2, y2]);
      bolts.push({ pts, life: 1, decay: 1 / life, color, width }); run();
    }
    function run() { if (!raf && !POTATO()) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    // a full screen's particles are drawn on its own canvas, above its background and backdrops, below its pieces
    // (embers never cross the cards, names or plates)
    const backs = new Map();
    function backOf(name) {
      const sc = scenes[name]; if (!sc || sc.classList.contains('sd-hidden')) return null;
      let B = backs.get(name);
      if (!B || !B.cv.isConnected) {
        const cv2 = document.createElement('canvas'); cv2.className = 'sd-cv-back'; cv2.width = W; cv2.height = H;
        cv2.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none`;
        B = { cv: cv2, x: cv2.getContext('2d'), used: false }; backs.set(name, B);
      }
      const first = sc.querySelector(':scope > .sd-el');
      if (first && first.previousElementSibling !== B.cv) sc.insertBefore(B.cv, first); else if (!first && B.cv.parentNode !== sc) sc.appendChild(B.cv);
      B.used = true; return B.x;
    }
    function boxOf(r) { const e = r.el; return { x: e.x, y: e.y, w: e.w, h: e.h }; }
    let dirty = null;
    function tick(t) {
      const P = window.SBPerf;
      if (P && P.paused) { raf = 0; P.whenAwake(run); return; }
      const dt = Math.min(.05, (t - last) / 1000); last = t; if (P) P.sample(dt * 1000);
      const keep = () => !P || Math.random() < P.q;      // fewer ambient particles if this PC is struggling
      for (const em of emit) {
        em.acc += dt;
        if (em.type === 'embers' && em.acc > (em.scene ? .03 : .07)) {
          em.acc = 0; if (!keep()) continue;
          const b = em.scene ? { x: 0, y: H - 10, w: W, h: 10 } : boxOf(em.r);
          const [r, g, bl] = rgbOf(em.color);
          parts.push({ x: b.x + Math.random() * b.w, y: b.y + b.h * (em.scene ? 1 : .85), vx: (Math.random() - .5) * 30, vy: -(50 + Math.random() * (em.scene ? 160 : 80)), g: -10, life: 1,
            decay: em.scene ? .25 + Math.random() * .25 : .9 + Math.random() * .8, size: 1 + Math.random() * (em.scene ? 2.6 : 1.8), c: [r, g, bl], wob: Math.random() * 6, bk: em.sc });
        }
        if (em.type === 'tflame' && em.acc > .04) {
          em.acc = 0; if (!keep()) continue;
          const n = em.r.parts.name || em.r.parts.text || em.r.parts.round || em.r.parts.c1, e = em.r.el;
          // the letters' own box, in layout coordinates (offsetLeft/Width ignore the editor's zoom)
          let x = e.x, w = e.w, y = e.y + e.h * .55;
          if (n && n.offsetWidth) { let o = n, ox = 0, oy = 0; while (o && o !== em.r.node) { ox += o.offsetLeft; oy += o.offsetTop; o = o.offsetParent; } x = e.x + ox; w = Math.min(n.offsetWidth, n.scrollWidth); y = e.y + oy + n.offsetHeight * .6; }
          if (GFX && GFX.textFlame && /^#[0-9a-f]{6}$/i.test(em.color || '') && GFX.textFlame(em.r.el.id, { x, y: y - (n ? n.offsetHeight * .6 : e.h * .55), w, h: n ? n.offsetHeight : e.h * .6 }, em.color)) continue;   // 1.12.5: a real flame with the engine on
          const [r, g, bl] = rgbOf(em.color), hot = rgbOf(mix(em.color, UC('effects', '#ffe0a0', '#ff5a1f'), .6));
          for (let i = 0; i < 2; i++) parts.push({ x: x + Math.random() * w, y: y + (Math.random() - .5) * 8, vx: (Math.random() - .5) * 16, vy: -(40 + Math.random() * 60), g: -10, life: 1, decay: 1.8 + Math.random() * 1.2, size: 1.6 + Math.random() * 2.6, c: Math.random() < .4 ? hot : [r, g, bl], wob: Math.random() * 6 });
        }
        if (em.type === 'ptc') {
          const pc = em.pc, amt = Math.max(1, Math.min(100, Number(pc.amount) || 40)), sp = Math.max(.1, Number(pc.speed) || 1), sz = Math.max(.2, Number(pc.size) || 1), wind = (Number(pc.dir) || 0) / 45 * 60 * sp;
          const every = 1 / ({ embers: .5, snow: .35, sparks: .6, bubbles: .15, confetti: .8, dust: .25, stars: .2, rain: 2.4, smoke: .06, shards: .2 }[pc.type] * amt);
          while (em.acc > every && parts.length < 1100) {
            em.acc -= every; if (!keep()) continue;
            const c = rgbOf(pc.color || UC('effects', '#ffb020', '#ff5a1f')), rnd = Math.random;
            const P2 = { embers: () => ({ x: rnd() * W, y: H + 5, vx: wind + (rnd() - .5) * 30, vy: -(60 + rnd() * 140) * sp, g: -10, decay: .2 + rnd() * .2, size: (1 + rnd() * 2.4) * sz, wob: rnd() * 6 }),
              snow: () => ({ x: rnd() * (W + 200) - 100, y: -10, vx: wind, vy: (40 + rnd() * 50) * sp, g: 0, decay: .05 * sp, size: (1.5 + rnd() * 2.5) * sz, wob: rnd() * 6, soft: 1 }),
              sparks: () => { const a = rnd() * 6.283, v = (120 + rnd() * 260) * sp; return { x: rnd() * W, y: rnd() * H, vx: Math.cos(a) * v + wind, vy: Math.sin(a) * v, g: 200, decay: 1.4 + rnd(), size: (1 + rnd() * 1.6) * sz, trail: 1 }; },
              bubbles: () => ({ x: rnd() * W, y: H + 20, vx: wind, vy: -(50 + rnd() * 70) * sp, g: 0, decay: .09 * sp, size: (4 + rnd() * 8) * sz, wob: rnd() * 6, kind: 'ring' }),
              confetti: () => ({ x: rnd() * W, y: -20, vx: wind + (rnd() - .5) * 80, vy: (120 + rnd() * 120) * sp, g: 30, decay: .12 * sp, size: (6 + rnd() * 6) * sz, rot: rnd() * 6, vr: (rnd() - .5) * 12, kind: 'flat', c2: [c, rgbOf(mix(pc.color || '#ffb020', '#ffffff', .5)), [255, 90, 120], [80, 200, 255], [255, 220, 80]][rnd() * 5 | 0] }),
              dust: () => ({ x: rnd() * W, y: rnd() * H, vx: wind + (rnd() - .5) * 14 * sp, vy: (rnd() - .5) * 14 * sp, g: 0, decay: .12 + rnd() * .1, size: (1 + rnd() * 2) * sz, kind: 'tw', soft: 1 }),
              stars: () => ({ x: rnd() * W, y: rnd() * H, vx: wind * .1, vy: 0, g: 0, decay: .5 + rnd() * .5, size: (1.5 + rnd() * 2.5) * sz, kind: 'tw' }),
              rain: () => ({ x: rnd() * (W + 400) - 200, y: -30, vx: wind * 3 - 60, vy: (900 + rnd() * 400) * sp, g: 0, decay: .7 * sp, size: (1 + rnd()) * sz, kind: 'streak' }),
              smoke: () => ({ x: rnd() * W, y: H + 40, vx: wind + (rnd() - .5) * 10, vy: -(10 + rnd() * 30) * sp, g: 0, decay: .08 + rnd() * .05, size: (14 + rnd() * 18) * sz, soft: 1, c2: rgbOf(mix(pc.color || '#5a5560', '#000000', .3)) }),
              shards: () => ({ x: rnd() * W, y: -20, vx: wind + (rnd() - .5) * 40, vy: (60 + rnd() * 80) * sp, g: 60, decay: .14 * sp, size: (4 + rnd() * 5) * sz, rot: rnd() * 6, vr: (rnd() - .5) * 6, kind: 'flat' }),
            }[pc.type];
            if (P2) { const q = P2(); parts.push({ life: 1, nd: 1, ...q, c: q.c2 || c, bk: em.sc }); }
          }
        }
        if (em.type === 'lightning' && em.acc > .55 + Math.random() * .9) {
          em.acc = 0;
          if (em.scene) { const x = Math.random() * W; bolt(x, 0, x + (Math.random() - .5) * 500, H * (.4 + Math.random() * .5), em.color, .25, 2.5); }
          else { const b = boxOf(em.r), top = Math.random() < .5, y = top ? b.y : b.y + b.h, x = b.x + Math.random() * b.w * .6; bolt(x, y, x + b.w * (.15 + Math.random() * .3), y + (Math.random() - .5) * 14, em.color, .18, 1.6); }
        }
      }
      if (dirty) ctx.clearRect(dirty[0] - 4, dirty[1] - 4, dirty[2] - dirty[0] + 8, dirty[3] - dirty[1] + 8); else ctx.clearRect(0, 0, W, H);
      let nb = null; const grow = (x0, y0, x1, y1) => { if (!nb) nb = [x0, y0, x1, y1]; else { nb[0] = Math.min(nb[0], x0); nb[1] = Math.min(nb[1], y0); nb[2] = Math.max(nb[2], x1); nb[3] = Math.max(nb[3], y1); } };
      ctx.globalCompositeOperation = 'lighter';
      parts = parts.filter(p => (p.life -= p.decay * dt) > 0);
      for (const B of backs.values()) if (B.used) { B.x.clearRect(0, 0, B.cv.width, B.cv.height); B.used = false; }
      for (const p of parts) {
        const g0 = p.bk ? backOf(p.bk) : null, x = g0 || ctx;      // a splash's own particles: behind its pieces
        if (p.bk && !g0) { p.life = 0; continue; }                // its screen has gone
        p.vy += p.g * dt; if (!p.nd) p.vx *= .985; p.x += (p.vx + (p.wob ? Math.sin(t / 300 + p.wob) * 20 : 0)) * dt; p.y += p.vy * dt;
        const [r, g, b] = p.c, s = p.size * 3; x.globalCompositeOperation = 'lighter';
        if (p.kind) {                        // particles with their own look (confetti, bubbles, rain, twinkles)
          const al = p.kind === 'tw' ? Math.sin(Math.PI * p.life) : Math.min(1, p.life * 3);
          x.save();
          if (p.kind === 'flat') { x.globalCompositeOperation = 'source-over'; p.rot += p.vr * dt; x.translate(p.x, p.y); x.rotate(p.rot); x.scale(1, Math.abs(Math.cos(p.rot * 1.7)) + .15); x.fillStyle = `rgba(${r},${g},${b},${al})`; x.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
          else if (p.kind === 'ring') { x.globalCompositeOperation = 'source-over'; x.strokeStyle = `rgba(${r},${g},${b},${al * .7})`; x.lineWidth = 1.5; x.beginPath(); x.arc(p.x, p.y, p.size, 0, 6.283); x.stroke(); x.fillStyle = `rgba(255,255,255,${al * .5})`; x.beginPath(); x.arc(p.x - p.size * .35, p.y - p.size * .35, p.size * .22, 0, 6.283); x.fill(); }
          else if (p.kind === 'streak') { x.globalCompositeOperation = 'source-over'; x.strokeStyle = `rgba(${r},${g},${b},${al * .55})`; x.lineWidth = p.size; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); x.stroke(); }
          else if (P) { x.globalAlpha = Math.max(0, Math.min(1, al * (p.soft ? .6 : 1))); x.drawImage(P.glow(`sd${r},${g},${b}`, [[0, `rgb(${r},${g},${b})`], [1, `rgba(${r},${g},${b},0)`]]), p.x - s, p.y - s, s * 2, s * 2); }   // 1.12.6: a stamped glow, not a new gradient each frame
          else { const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); gr.addColorStop(0, `rgba(${r},${g},${b},${al * (p.soft ? .6 : 1)})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, s, 0, 6.283); x.fill(); }
          x.restore();
          if (g0) continue;
          const m = Math.max(s, p.size * 2) + Math.abs(p.vx * .04) + Math.abs(p.vy * .04); grow(p.x - m, p.y - m, p.x + m, p.y + m);
          if (p.y > H + 60 || p.y < -80 || p.x < -260 || p.x > W + 260) p.life = 0;
          continue;
        }
        if (p.soft) { if (P) { x.globalAlpha = Math.min(1, p.life * 3) * .8; x.drawImage(P.glow(`sd${r},${g},${b}`, [[0, `rgb(${r},${g},${b})`], [1, `rgba(${r},${g},${b},0)`]]), p.x - s, p.y - s, s * 2, s * 2); x.globalAlpha = 1; } else { const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); gr.addColorStop(0, `rgba(${r},${g},${b},${Math.min(1, p.life * 3) * .8})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, s, 0, 6.283); x.fill(); } if (!g0) grow(p.x - s, p.y - s, p.x + s, p.y + s); if (p.y > H + 40) p.life = 0; continue; }
        if (P) { x.globalAlpha = p.life; x.drawImage(P.glow(`sd${r},${g},${b}`, [[0, `rgb(${r},${g},${b})`], [1, `rgba(${r},${g},${b},0)`]]), p.x - s, p.y - s, s * 2, s * 2); x.globalAlpha = 1; }
        else { const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); gr.addColorStop(0, `rgba(${r},${g},${b},${p.life})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.beginPath(); x.arc(p.x, p.y, s, 0, 6.283); x.fill(); }
        if (!g0) grow(p.x - s - Math.abs(p.vx * .03), p.y - s - Math.abs(p.vy * .03), p.x + s + Math.abs(p.vx * .03), p.y + s + Math.abs(p.vy * .03));
        if (p.trail) { x.strokeStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},${p.life * .8})`; x.lineWidth = p.size * .7; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); x.stroke(); }
      }
      bolts = bolts.filter(b => (b.life -= b.decay * dt) > 0);
      for (const b of bolts) {
        const [r, g, bl] = rgbOf(b.color);
        for (const [w, a] of [[b.width * 5, .18], [b.width * 2.2, .45], [b.width * .8, 1]]) {
          ctx.strokeStyle = a === 1 ? `rgba(255,255,255,${b.life})` : `rgba(${r},${g},${bl},${a * b.life})`; ctx.lineWidth = w; ctx.lineJoin = 'round';
          ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        }
      }
      dirty = bolts.length ? [0, 0, W, H] : nb;     // bolts can reach anywhere: clear everything after them
      if (parts.length || bolts.length || emit.length) raf = requestAnimationFrame(tick); else { raf = 0; dirty = null; ctx.clearRect(0, 0, W, H); for (const B of backs.values()) B.x.clearRect(0, 0, B.cv.width, B.cv.height); }
    }

    // ------------------------------------------------------------------ bursts (a point scored / previews)
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    function scoreCenter(r) {
      const e = r.el;
      if (e.kind !== 'bar') return [e.x + e.w / 2, e.y + e.h / 2];
      const ins = (SHAPES[e.shape] || {}).inset || [.04, .04], R = e.flip ? ins[0] : ins[1], L = e.flip ? ins[1] : ins[0];
      const right = (e.side === 2) === (e.scorePos === 'outer');      // where the score box ended up
      return right ? [e.x + e.w - R * e.w - e.h * .5, e.y + e.h / 2] : [e.x + L * e.w + e.h * .5, e.y + e.h / 2];
    }
    function ring(x, y, d, color) {
      const g = document.createElement('div'); g.className = 'sd-ring';
      g.style.cssText = `left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px;--fxc:${color}`;
      root.appendChild(g); setTimeout(() => g.remove(), 800);
    }
    function burst(r, type) {
      if (POTATO()) return;
      // 1.12.21: with Reduce motion the point is a short fade of the number — no slam, no ring, no sparks, no sweep of light
      // (the effects engine rests then, so its stand-in below would have played in its place)
      if (calm()) { if (r.parts.num) anim(r.parts.num, [{ opacity: .25 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }); return; }
      const { node, parts: P, el } = r, [cx, cy] = scoreCenter(r), col = el.effect.color;
      if (P.num) { P.num.classList.remove('sd-slam'); void P.num.offsetWidth; P.num.classList.add('sd-slam'); }
      if (GFX && GFX.on && D.gfx && D.gfx.preset && (!type || type === 'default' || type === 'none')) return;   // BeeboFX plays this look's hit instead — unless the piece has its own effect (1.12.8: a chosen effect always plays)
      switch (type) {
        case 'embers': spark(cx, cy, 70, 1, col); ring(cx, cy, el.h * 3, col); break;
        case 'lightning': for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, d = el.h * (1.4 + Math.random() * 1.6); bolt(cx, cy, cx + Math.cos(a) * d, cy + Math.sin(a) * d * .6, col, .3, 2); } spark(cx, cy, 24, .6, col); break;
        case 'pulse': node.classList.remove('sd-flash'); void node.offsetWidth; node.classList.add('sd-flash'); later(() => node.classList.remove('sd-flash'), 600); ring(cx, cy, el.h * 4, col); break;
        case 'shine': node.classList.remove('sd-shine-burst'); void node.offsetWidth; node.classList.add('sd-shine-burst'); later(() => node.classList.remove('sd-shine-burst'), 1200); spark(cx, cy, 20, .5, '#ffffff'); break;
        case 'cracks': node.classList.remove('sd-crack-burst'); void node.offsetWidth; node.classList.add('sd-crack-burst'); later(() => node.classList.remove('sd-crack-burst'), 1400); spark(cx, cy, 40, .8, col); break;
        default: ring(cx, cy, el.h * 2.5, el.teamColor || '#ffffff'); spark(cx, cy, 24, .6, el.teamColor || '#ffffff');
      }
    }
    // the 2D effects canvas (sparks, rings, bolts) on the scoreboard: only inside the layout's own pieces, never over the HUD
    function clipCv() {
      if (opts.edit) { cv.style.clipPath = ''; return; }
      const full = Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k));
      if (full) { cv.style.clipPath = ''; return; }
      const d = gfxPieces().map(r => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`).join('');
      cv.style.clipPath = d ? `path('${d}')` : 'inset(50%)';
    }
    function scored(r) { burst(r, r.el.effect.type === 'none' ? 'default' : r.el.effect.type); }

    // ------------------------------------------------------------------ transitions
    // a screen leaves by shattering. 1.9.1: one still copy of the screen (frozen, without its effect canvases) cut into 16
    // pieces, each piece a box only as big as itself — before, 27 full-screen live copies stalled the overlay for ~2 s.
    // a copy of SVG with its own ids: url(#…) and href="#…" follow the new names
    let shardSeq = 0;
    function uniqueIds(rootEl, tag) {
      const map = new Map();
      rootEl.querySelectorAll('[id]').forEach(n => { const nw = n.id + '-' + tag; map.set(n.id, nw); n.id = nw; });
      if (!map.size) return;
      const fix = v => v.replace(/url\((['"]?)#([^'")]+)\1\)/g, (m, q, id) => map.has(id) ? `url(${q}#${map.get(id)}${q})` : m);
      rootEl.querySelectorAll('*').forEach(n => {
        for (const a of [...n.attributes]) {
          if (a.value.includes('url(')) n.setAttribute(a.name, fix(a.value));
          else if ((a.name === 'href' || a.name === 'xlink:href') && a.value[0] === '#' && map.has(a.value.slice(1))) n.setAttribute(a.name, '#' + map.get(a.value.slice(1)));
        }
      });
    }
    // 1.12: a still picture of each screen that leaves by breaking, taken (off the beat) once it's settled on screen. The
    // break then only moves pieces of that one picture — the graphics card's work — instead of laying out and drawing the
    // whole screen sixteen times as it starts, which is what made the frame rate drop.
    const stills = {}, stillT = {};
    const sigOf = node => node.textContent + '|' + [...node.querySelectorAll('img')].map(i => i.getAttribute('src') || '').join(',');
    function rememberStill(name) {
      const node = scenes[name], sc = D.scenes[name]; if (!node || !show[name] || sc.transOut !== 'shatter' || !FX2 || !FX2.capture || POTATO()) return;
      const sig = sigOf(node); if (stills[name] && stills[name].sig === sig) return;
      const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
      idle(() => {
        if (!show[name] || sigOf(node) !== sig) return;
        FX2.capture(node, { w: W, h: H }).then(cv => new Promise(res => cv.toBlob(res, 'image/webp', .92))).then(async blob => {
          if (!blob || !show[name] || sigOf(node) !== sig) return;
          const url = URL.createObjectURL(blob), im = new Image(); im.src = url; try { await im.decode(); } catch (e) { URL.revokeObjectURL(url); return; }
          if (stills[name]) URL.revokeObjectURL(stills[name].url);
          stills[name] = { url, im, sig };
        }).catch(() => {});
      }, { timeout: 3000 });
    }
    // what's on a screen changed while it's up (a name, a picture): its still is taken again once it has settled
    function stillsAfterPaint() { for (const name of Object.keys(stills).concat(Object.keys(show))) if (show[name] && D.scenes[name] && D.scenes[name].transOut === 'shatter') { clearTimeout(stillT[name]); stillT[name] = setTimeout(() => rememberStill(name), 1500); } }
    function shardsOut(node, done) {
      const nm = (/\bsd-sc-(\S+)/.exec(node.className) || [])[1], st = nm && stills[nm] && stills[nm].sig === sigOf(node) ? stills[nm] : null;
      // 1.12.14: a screen can say where it breaks from (the Top 8: where its glass was struck); otherwise the middle
      const ba = nm && D.scenes[nm] && Array.isArray(D.scenes[nm].breakAt) ? D.scenes[nm].breakAt.map(Number) : null, at = ba && ba.every(Number.isFinite) ? ba : null;
      if (st) return shardsPicture(node, st, done, at);
      // no still yet (hidden within a moment of coming on): no copies of the screen either — it cracks, then falls back and fades
      if (!window.__SB_OLDSHARDS) {
        const crack = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), r = rng(99 + (SEEDNOW() % 997)), O = at || [W / 2, H * .46];
        crack.setAttribute('viewBox', `0 0 ${W} ${H}`); crack.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:61`;
        crack.innerHTML = Array.from({ length: 9 }, (_, i) => { const a = (i + r() * .7) / 9 * Math.PI * 2, L = 500 + r() * 900; return `<path d="M${O[0]} ${O[1]}L${(O[0] + Math.cos(a) * L * .45).toFixed(0)} ${(O[1] + Math.sin(a) * L * .32 + (r() - .5) * 40).toFixed(0)}L${(O[0] + Math.cos(a) * L).toFixed(0)} ${(O[1] + Math.sin(a) * L * .7).toFixed(0)}" fill="none" stroke="#fff" stroke-width="2.2" opacity=".9"/>`; }).join('');
        crack.style.zIndex = '61'; root.appendChild(crack); crack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
        const a = node.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.015)', opacity: 1, offset: .25 }, { transform: 'translateY(60px) scale(.96)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
        a.onfinish = () => { node.classList.add('sd-hidden'); a.cancel(); crack.remove(); done && done(); };
        return;
      }
      const box = document.createElement('div'); box.className = 'sd-shards';
      const lite = document.documentElement.classList.contains('sb-ultra') || (window.SBPerf && (SBPerf.laptop || SBPerf.q < .6));      // Ultra-light, Laptop mode or a PC that's struggling: six big pieces, not sixteen
      const r = rng(1234 + (SEEDNOW() % 1000)), RAYS = lite ? 6 : 8, RINGS = lite ? [2400] : [300, 1500], O = [W / 2, H / 2];
      const ang = Array.from({ length: RAYS }, (_, i) => (i + .2 + r() * .6) / RAYS * Math.PI * 2);
      const Vx = RINGS.map(rad => ang.map(a => [O[0] + Math.cos(a) * rad * (.8 + r() * .4), O[1] + Math.sin(a) * rad * .7 * (.8 + r() * .4)]));
      const shards = [];
      for (let a = 0; a < RAYS; a++) { const b = (a + 1) % RAYS; shards.push([O, Vx[0][a], Vx[0][b]]); for (let i = 1; i < RINGS.length; i++) shards.push([Vx[i - 1][a], Vx[i - 1][b], Vx[i][b], Vx[i][a]]); }
      // the still copy: no canvases (engine, particles, backdrops), nothing animating
      const still = node.cloneNode(true); still.classList.remove('sd-hidden'); still.classList.add('sd-still');
      still.querySelectorAll('canvas, video, .sd-gfx-atm, .sd-cv-back, .sd-parts, iframe').forEach(n => n.remove());
      uniqueIds(still, 'x' + (++shardSeq));   // 1.11: its gradients get their own names — the copy pointed at the scene's, which hide with it, so the background and plates vanished and only the lettering broke
      still.style.position = 'absolute'; still.style.left = '0'; still.style.top = '0'; still.style.width = W + 'px'; still.style.height = H + 'px'; still.style.inset = 'auto';
      for (const pts of shards) {
        const xs = pts.map(p => Math.max(0, Math.min(W, p[0]))), ys = pts.map(p => Math.max(0, Math.min(H, p[1])));
        const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys)), bw = Math.ceil(Math.max(...xs)) - bx, bh = Math.ceil(Math.max(...ys)) - by;
        if (bw < 2 || bh < 2) continue;
        const w = document.createElement('div'); w.className = 'sd-shard';
        w.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;overflow:hidden;contain:strict;will-change:transform,opacity;clip-path:polygon(${pts.map(p => `${(p[0] - bx).toFixed(0)}px ${(p[1] - by).toFixed(0)}px`).join(',')})`;
        const cx = pts.reduce((s2, p) => s2 + p[0], 0) / pts.length, cy = pts.reduce((s2, p) => s2 + p[1], 0) / pts.length;
        w.style.transformOrigin = `${(cx - bx).toFixed(0)}px ${(cy - by).toFixed(0)}px`;
        const c = still.cloneNode(true); c.style.left = -bx + 'px'; c.style.top = -by + 'px'; w.appendChild(c); box.appendChild(w);
        const dx = cx - O[0], dy = cy - O[1], dist = Math.hypot(dx, dy) || 1, sp = 380 + r() * 520 - dist * .12, vx = dx / dist * sp, vy = dy / dist * sp * .7 - (80 + r() * 260), T = 1.05 + r() * .4;
        const rz = (r() - .5) * 600, rx = (r() - .5) * 300, ry = (r() - .5) * 300;
        w.animate([0, .25, .5, .75, 1].map(f => { const t = f * T; return { offset: f, transform: `translate3d(${(vx * t).toFixed(0)}px,${(vy * t + 950 * t * t).toFixed(0)}px,0) perspective(1400px) rotateX(${rx * f | 0}deg) rotateY(${ry * f | 0}deg) rotateZ(${rz * f | 0}deg)`, opacity: f < .6 ? 1 : 1 - (f - .6) / .4 }; }),
          { duration: T * 1000, delay: Math.min(140, dist * .12), fill: 'forwards' });
      }
      root.appendChild(box);
      node.classList.add('sd-hidden');
      setTimeout(() => { box.remove(); done && done(); }, 1700);
    }
    // the same break, from the still picture: each piece is one layer showing its part of the picture, moved and turned
    function shardsPicture(node, st, done, at) {
      const box = document.createElement('div'); box.className = 'sd-shards'; box.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none;z-index:60';
      const lite = document.documentElement.classList.contains('sb-ultra') || (window.SBPerf && (SBPerf.laptop || SBPerf.q < .6));
      const r = rng(1234 + (SEEDNOW() % 1000)), RAYS = lite ? 7 : at ? 10 : 8, RINGS = lite ? [700, 2300] : at ? [180, 560, 1250, 2600] : [320, 1000, 2300], O = at || [W / 2, H * .46];
      const ang = Array.from({ length: RAYS }, (_, i) => (i + .2 + r() * .6) / RAYS * Math.PI * 2);
      const Vx = RINGS.map(rad => ang.map(a => [O[0] + Math.cos(a) * rad * (.8 + r() * .4), O[1] + Math.sin(a) * rad * .7 * (.8 + r() * .4)]));
      const shards = [];
      for (let a = 0; a < RAYS; a++) { const b = (a + 1) % RAYS; shards.push([O, Vx[0][a], Vx[0][b]]); for (let i = 1; i < RINGS.length; i++) shards.push([Vx[i - 1][a], Vx[i - 1][b], Vx[i][b], Vx[i][a]]); }
      // 1.12.14: a screen that breaks from its own point (the Top 8) breaks along kinked edges, like real glass, not straight
      // lines: every edge gets two bends, worked out from its two ends so the pieces either side still fit together
      if (at) for (let k = 0; k < shards.length; k++) {
        const P = shards[k], out = [];
        for (let i = 0; i < P.length; i++) {
          const p = P[i], q = P[(i + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); out.push(p);
          if (L < 60) continue;
          const [a0, b0] = p[0] + p[1] * 7 < q[0] + q[1] * 7 ? [p, q] : [q, p], hs = Math.sin(a0[0] * 12.9898 + a0[1] * 78.233 + b0[0] * 37.719 + b0[1] * 4.581) * 43758.5453, h1 = hs - Math.floor(hs), h2 = (h1 * 7.31) % 1;
          const nx = -(b0[1] - a0[1]) / L, ny = (b0[0] - a0[0]) / L, amp = Math.min(46, L * .09);
          const m1 = [a0[0] + (b0[0] - a0[0]) * .36 + nx * (h1 - .5) * 2 * amp, a0[1] + (b0[1] - a0[1]) * .36 + ny * (h1 - .5) * 2 * amp];
          const m2 = [a0[0] + (b0[0] - a0[0]) * .7 + nx * (h2 - .5) * 2 * amp, a0[1] + (b0[1] - a0[1]) * .7 + ny * (h2 - .5) * 2 * amp];
          out.push(...(a0 === p ? [m1, m2] : [m2, m1]));
        }
        shards[k] = out;
      }
      const pieces = [];
      for (const pts of shards) {
        const xs = pts.map(p => Math.max(0, Math.min(W, p[0]))), ys = pts.map(p => Math.max(0, Math.min(H, p[1])));
        const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys)), bw = Math.ceil(Math.max(...xs)) - bx, bh = Math.ceil(Math.max(...ys)) - by;
        if (bw < 2 || bh < 2) continue;
        const w = document.createElement('div'), cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
        w.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;will-change:transform,opacity;backface-visibility:hidden;`
          + `background:url("${st.url}") ${-bx}px ${-by}px/${W}px ${H}px no-repeat;clip-path:polygon(${pts.map(p => `${(p[0] - bx).toFixed(0)}px ${(p[1] - by).toFixed(0)}px`).join(',')});transform-origin:${(cx - bx).toFixed(0)}px ${(cy - by).toFixed(0)}px`;
        box.appendChild(w); pieces.push({ w, cx, cy });
      }
      root.appendChild(box);
      node.classList.add('sd-hidden');
      // a white crack flashes where the pieces split, then they fall away under gravity, turning, and fade
      const crack = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      crack.setAttribute('viewBox', `0 0 ${W} ${H}`); crack.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:61;will-change:opacity`;
      crack.innerHTML = shards.map(pts => `<path d="M${pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}Z" fill="none" stroke="#fff" stroke-width="${at ? 1.4 : 2.2}" stroke-linejoin="round" opacity="${at ? .7 : .85}"/>`).join('');
      box.appendChild(crack);
      crack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
      let last = 0;
      const PH = window.BeeboFX4 && window.BeeboFX4.physics;
      for (const { w, cx, cy } of pieces) {
        const dx = cx - O[0], dy = cy - O[1], dist = Math.hypot(dx, dy) || 1, sp = 340 + r() * 480 - dist * .1, vx = dx / dist * sp, vy = dy / dist * sp * .7 - (60 + r() * 220), T = .95 + r() * .35;
        if (PH && !lite) {        // 1.12.15: real falling — the pieces spin, drop, bounce off the bottom of the screen and slide, then fade
          const rz0 = (r() - .5) * 520, rx = (r() - .5) * 240, ry = (r() - .5) * 240, delay = 90 + Math.min(120, dist * .1), TT = T + .4, rad = Math.min(60, Math.sqrt(w.offsetWidth * w.offsetHeight || 400) * .35);
          const tr = PH.fall({ vx, vy, spin: rz0 / T, r: rad, floor: H - cy }, { T: TT, frames: 30 });
          w.animate(tr.map(k => ({ offset: k.t, transform: `translate3d(${k.x.toFixed(0)}px,${k.y.toFixed(0)}px,0) perspective(1400px) rotateX(${(rx * Math.min(1, k.t * 1.6)) | 0}deg) rotateY(${(ry * Math.min(1, k.t * 1.6)) | 0}deg) rotateZ(${k.rot | 0}deg) scale(${(1 - .1 * k.t).toFixed(3)})`, opacity: k.t < .72 ? 1 : Math.max(0, 1 - (k.t - .72) / .28) })),
            { duration: TT * 1000, delay, easing: 'linear', fill: 'forwards' });
          last = Math.max(last, TT * 1000 + delay); continue;
        }
        const rz = (r() - .5) * 420, rx = (r() - .5) * 220, ry = (r() - .5) * 220, delay = 90 + Math.min(120, dist * .1);
        w.animate([0, .25, .5, .75, 1].map(f => { const t = f * T; return { offset: f, transform: `translate3d(${(vx * t).toFixed(0)}px,${(vy * t + 900 * t * t).toFixed(0)}px,0) perspective(1400px) rotateX(${rx * f | 0}deg) rotateY(${ry * f | 0}deg) rotateZ(${rz * f | 0}deg) scale(${(1 - .12 * f).toFixed(3)})`, opacity: f < .55 ? 1 : 1 - (f - .55) / .45 }; }),
          { duration: T * 1000, delay, easing: 'cubic-bezier(.3,0,.75,1)', fill: 'forwards' });
        last = Math.max(last, T * 1000 + delay);
      }
      setTimeout(() => { box.remove(); done && done(); }, last + 60);
    }
    function blade(node, dir = 1) {
      const b = document.createElement('div'); b.className = 'sd-blade'; node.appendChild(b);
      b.animate([{ left: dir > 0 ? '-20%' : '110%' }, { left: dir > 0 ? '110%' : '-20%' }], { duration: 480, easing: 'cubic-bezier(.6,0,.3,1)' }).onfinish = () => b.remove();
    }
    const OFF = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
    function simpleKF(type, m = {}, out) {      // the plain motions, as "from" keyframes (reversed to leave)
      const f = OFF[m.from || (type === 'drop' ? 'top' : 'left')] || OFF.left, dist = Number(m.dist) || 140, c = m.custom || {};
      const from = {
        fade: { opacity: 0 }, slide: { opacity: 0, transform: `translate(${f[0] * dist}px,${f[1] * dist}px)` }, pop: { opacity: 0, transform: 'scale(.3)' },
        wipe: { clipPath: { left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', top: 'inset(0 0 100% 0)', bottom: 'inset(100% 0 0 0)' }[m.from || 'left'] },
        drop: { opacity: 0, transform: `translateY(${-dist * 1.6}px)` }, blurin: { opacity: 0, filter: 'blur(18px)' }, spin: { opacity: 0, transform: 'rotate(-180deg) scale(.2)' },
        type: { opacity: 0 }, flip: { opacity: 0, transform: 'perspective(900px) rotateY(-90deg)', filter: 'brightness(.45)' }, custom: { opacity: c.opacity ?? 0, transform: `translate(${Number(c.dx) || 0}px,${Number(c.dy) || 0}px) scale(${c.scale ?? 1}) rotate(${Number(c.rot) || 0}deg)` },
      }[type];
      if (!from) return null;
      const to = { opacity: 1, transform: 'none', filter: 'none', clipPath: type === 'wipe' ? 'inset(0 0 0 0)' : undefined };
      if (type === 'flip' && !out) return [from, { opacity: 1, transform: 'perspective(900px) rotateY(-12deg)', filter: 'brightness(1.25)', offset: .75 }, to];
      for (const k of Object.keys(to)) if (to[k] === undefined || !(k in from)) delete to[k];
      const mid = type === 'pop' && !out ? [{ ...to, transform: 'scale(1.08)', offset: .7 }] : type === 'drop' && !out ? [{ ...to, transform: 'translateY(10px)', offset: .75 }] : [];
      return out ? [to, from] : [from, ...mid, to];
    }
    const SBM = window.SBMotion || null;
    function springPose(type, m = {}) {        // where a simple entrance starts, as numbers the spring can move
      const f = OFF[m.from || (type === 'drop' ? 'top' : 'left')] || OFF.left, dist = Number(m.dist) || 140, c = m.custom || {};
      return { fade: { opacity: 0 }, slide: { tx: f[0] * dist, ty: f[1] * dist, opacity: 0 }, pop: { s: .3, opacity: 0 }, drop: { ty: -dist * 1.6, opacity: 0 }, blurin: { opacity: 0, blur: 18, s: 1.06 },
        spin: { r: -180, s: .2, opacity: 0 }, type: { opacity: 0 }, flip: { ry: -90, opacity: 0 },
        custom: { tx: Number(c.dx) || 0, ty: Number(c.dy) || 0, s: c.scale ?? 1, r: Number(c.rot) || 0, opacity: c.opacity ?? 0 } }[type] || null;
    }
    const EASE = { 'spring-snappy': 'cubic-bezier(.5,0,.1,1)', 'spring-heavy': 'cubic-bezier(.7,0,.2,1)', 'spring-floaty': 'cubic-bezier(.5,-.3,.5,1)', smooth: 'cubic-bezier(.2,.8,.3,1)', snappy: 'cubic-bezier(.5,0,.1,1)', bouncy: 'cubic-bezier(.3,1.5,.5,1)', linear: 'linear', soft: 'ease-in-out' };
    function transIn(target, type, delay = 0, info = {}) {
      if (!type || type === 'none' || POTATO()) return;
      const m = info.m || {};
      if (calm() && type !== 'fade') type = TRANSITIONS[type] && TRANSITIONS[type].simple ? 'fade' : 'fade';
      if (ULTRA() && type !== 'fade' && !simpleKF(type, m)) type = 'fade';        // 1.12 Ultra-light: a screen only slides, scales or fades in
      // 1.12.13: the graphics-card transitions (gx-…, and ones made in the transition editor) on a single piece — they used to
      // do nothing at all on pieces; a screen's own runs in showScene / playScene
      if (/^(gx|tr)-/.test(type)) { if (info.edge) return gxPiece(target, type, delay, info, 'in'); return transIn(target, gxFallback(type), delay, info); }
      if (FXL && FXL.INS[type] && !simpleKF(type, m)) {
        const e = info.edge && info.size !== 700 ? info.edge : { x: 0, y: 0, w: W, h: H };
        try { FXL.INS[type].play({ ...fxApi, t: target, rect: e, color: rc0(info.color || UC('effects', '#ff5a1f', '#ff5a1f')), delay: delay * 1000, dur: (Number(m.dur) || FXL.INS[type].dur / 1000) * 1000, dir: info.dir || 1, el: info.el }); } catch (e2) { console.warn('in', e2); }
        if (info.decode !== false && /^(bolt|strike|forge|fireburst|stamp)$/.test(type)) later(() => target.querySelectorAll('.sd-name,.sd-round,.sd-text').forEach(n => decode(n, 500)), delay * 1000 + 250);
        return;
      }
      // the motion kit: a spring (snappy / heavy / floaty) with squash and stretch, motion blur, 3D shading and shadow lift
      const own = String(m.ease || '').replace(/^spring-/, ''), feel = SBM && /^spring-/.test(m.ease || '') && SBM.PRESETS[own] ? own : !m.ease && D.motion && SBM && SBM.PRESETS[D.motion.feel] ? D.motion.feel : '';
      const pose = feel && springPose(type, m);
      if (pose) {
        const r = SBM.keyframes(pose, feel, { squash: D.motion.squash !== false, mblur: D.motion.blur !== false, lift: !info.board && type !== 'wipe', shade: true });
        anim(target, r.frames, { delay: delay * 1000, duration: r.dur * (Number(m.dur) ? Number(m.dur) / .6 : 1), easing: 'linear', fill: 'backwards' });
        if (type === 'type') { const sp = (D.motion && Number(D.motion.speed)) || 1; later(() => target.querySelectorAll('.sd-text,.sd-name,.sd-round').forEach(n => textAnim(n, 'type')), delay * 1000 / sp); }
        return;
      }
      const kf = simpleKF(type, m);
      if (kf) {
        anim(target, kf, { delay: delay * 1000, duration: (Number(m.dur) || (type === 'fade' ? .5 : .6)) * 1000, easing: EASE[m.ease] || (type === 'pop' || type === 'drop' ? EASE.bouncy : EASE.smooth), fill: 'backwards' });
        if (type === 'type') { const sp = (D.motion && Number(D.motion.speed)) || 1; later(() => target.querySelectorAll('.sd-text,.sd-name,.sd-round').forEach(n => textAnim(n, 'type')), delay * 1000 / sp); }
        return;
      }
      const sp0 = (D.motion && Number(D.motion.speed)) || 1, d = delay * 1000 / sp0, o = { delay: d, fill: 'backwards' };
      const A = (k, x) => target.animate(k, { ...x, duration: x.duration / sp0 });
      switch (type) {
        case 'shatter':
          A([{ opacity: 0, transform: 'scale(1.08)', filter: 'brightness(3) saturate(0)' }, { opacity: 1, offset: .35, transform: 'scale(.985)', filter: 'brightness(2.2) saturate(.3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { ...o, duration: 750, easing: 'ease-out' });
          if (info.cracks) { later(() => { info.cracks.classList.add('sd-crack-burst'); later(() => info.cracks.classList.remove('sd-crack-burst'), 900); }, d); }
          if (info.at) later(() => spark(info.at[0], info.at[1], 30, .6, info.color || UC('effects', '#ffb36b', '#ff5a1f')), d + 200);
          break;
        case 'slash':
          A([{ clipPath: 'polygon(0 0,0 0,-30% 100%,-30% 100%)' }, { clipPath: 'polygon(0 0,130% 0,100% 100%,-30% 100%)' }], { ...o, duration: 520, easing: 'cubic-bezier(.6,0,.3,1)' });
          later(() => blade(target), d);
          break;
        case 'ignite':
          A([{ opacity: 0, filter: 'brightness(4) saturate(0) blur(3px)' }, { opacity: 1, offset: .3, filter: 'brightness(2.4) saturate(.2)' }, { opacity: 1, filter: 'none' }], { ...o, duration: 950, easing: 'ease-out' });
          later(() => { target.querySelectorAll('.sd-name,.sd-round,.sd-text').forEach(n => decode(n, 600)); if (info.edge) { const e = info.edge; for (let i = 0; i < 4; i++) spark(e.x + Math.random() * e.w, e.y + e.h, 8, .5, info.color || '#ff5a1f', 1.2, -Math.PI / 2, 400); } }, d + 250);
          break;
        case 'glitch': {
          const k = [];
          for (let i = 0; i <= 10; i++) { const a = Math.random() * 70, b = a + 8 + Math.random() * 30; k.push({ offset: i / 10, opacity: i === 10 ? 1 : (i % 3 ? 1 : .3), transform: i === 10 ? 'none' : `translateX(${((Math.random() - .5) * 40).toFixed(0)}px)`, clipPath: i === 10 ? 'inset(0 0 0 0)' : `inset(${a.toFixed(0)}% 0 ${Math.max(0, 100 - b).toFixed(0)}% 0)`, filter: i === 10 ? 'none' : `hue-rotate(${(Math.random() * 180) | 0}deg) saturate(2)` }); }
          k[0].opacity = 0;
          A(k, { ...o, duration: 620, easing: 'steps(1,end)' });
          break;
        }
        case 'slam':
          A([{ opacity: 0, transform: 'scale(2.4)', filter: 'blur(10px)' }, { opacity: 1, offset: .55, transform: 'scale(.92)', filter: 'none' }, { opacity: 1, transform: 'none' }], { ...o, duration: 680, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
          if (info.at) later(() => ring(info.at[0], info.at[1], Math.max(200, info.size || 300) * 2.2, info.color || UC('effects', '#ffb36b', '#ff5a1f')), d + 370);
          break;
      }
    }
    function transOut(node, type, done, m = {}) {
      if (!type || type === 'none' || POTATO()) { node.classList.add('sd-hidden'); done && done(); return; }
      if (calm()) type = 'fade';
      if (ULTRA() && type !== 'fade' && !simpleKF(type, m, true)) type = 'fade';  // …and out (no shattering copies of the screen)
      if (FXL && FXL.OUTS[type]) { let ended = false; const end = () => { if (ended) return; ended = true; node.classList.add('sd-hidden'); node.getAnimations().forEach(a => a.cancel()); node.style.visibility = ''; done && done(); };
        try { FXL.OUTS[type].play({ ...fxApi, t: node, rect: { x: 0, y: 0, w: W, h: H }, color: UC('effects', '#ff5a1f', '#ff5a1f'), delay: (Number(m.delay) || 0) * 1000, dur: (Number(m.dur) || FXL.OUTS[type].dur / 1000) * 1000, done: end }); } catch (e) { end(); }
        setTimeout(end, 4000); return; }
      const skf = simpleKF(type, m, true);
      if (skf) { const a = anim(node, skf, { duration: (Number(m.dur) || .45) * 1000, delay: (Number(m.delay) || 0) * 1000, easing: EASE[m.ease] || 'ease-in', fill: 'forwards' }); a.onfinish = () => { node.classList.add('sd-hidden'); a.cancel(); done && done(); }; return; }
      if (type === 'shatter') return shardsOut(node, done);
      const k = {
        slash: [{ clipPath: 'polygon(0 0,130% 0,100% 100%,-30% 100%)' }, { clipPath: 'polygon(130% 0,130% 0,100% 100%,100% 100%)' }],
        ignite: [{ opacity: 1, filter: 'none' }, { opacity: 1, offset: .35, filter: 'brightness(2.6) saturate(.3)' }, { opacity: 0, filter: 'brightness(4) saturate(0) blur(4px)' }],
        glitch: Array.from({ length: 9 }, (_, i) => ({ offset: i / 8, opacity: i === 8 ? 0 : i % 2 ? .4 : 1, transform: `translateX(${((Math.random() - .5) * 60) | 0}px)`, clipPath: `inset(${(Math.random() * 60) | 0}% 0 ${(Math.random() * 30) | 0}% 0)` })),
        slam: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)', filter: 'blur(6px)' }],
      }[type];
      if (type === 'slash') blade(node, 1);
      const a = anim(node, k, { duration: type === 'glitch' ? 480 : 520, easing: type === 'glitch' ? 'steps(1,end)' : 'ease-in' });
      a.onfinish = () => { node.classList.add('sd-hidden'); done && done(); };
    }
    // ------------------------------------------------------------------ 1.12.13: a BeeboFX 2 transition on one piece
    // The piece is pictured at its own size, drawn into a stage a little bigger than it (so what flies out isn't cut off),
    // played there, then handed back. A few at once at most; past that (or on a weak PC) the transition's own plain version.
    const gxLive = new Set();
    // 1.12.15: with BeeboFX 4 every transition shares one graphics context, so many pieces can move at once (12 at full
    // quality, 4 on Light); without it each piece opened its own context and three was the safe limit
    const gxCap = () => { const X = window.BeeboFX4; if (!X) return 3; return X.gov.level >= 1 || String(window.__SB_GFXQ || '') === 'light' || (window.SBPerf && window.SBPerf.laptop) ? 4 : 12; };
    function gxPiece(target, type, delay, info, dir, done) {
      const e = info.edge, node = target.parentNode, spec = gxSpec(type, info.m || {}, { effectColor: info.color }), sp = (D.motion && Number(D.motion.speed)) || 1;
      const plain = () => dir === 'in' ? transIn(target, gxFallback(type), delay, { ...info, edge: info.edge }) : null;
      if (!spec || !FX2 || !FX2.available || POTATO() || calm() || ULTRA() || gxLive.size >= gxCap() || !node || !e || e.w < 4 || e.h < 4 || e.w * e.h > 1500000) { if (dir === 'in') return plain(); return false; }
      const tok = {}; gxLive.add(tok);
      const hold = dir === 'in' ? target.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 60000 }) : null;    // hidden until it's drawn in
      const pad = Math.round(Math.max(40, Math.min(260, Math.max(e.w, e.h) * .35))), W2 = Math.round(e.w + pad * 2), H2 = Math.round(e.h + pad * 2);
      const host = document.createElement('div'); host.className = 'sd-gxel';
      host.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${W2}px;height:${H2}px;pointer-events:none;z-index:6`;
      let ended = false; const end = ok => { if (ended) return; ended = true; gxLive.delete(tok); if (hold) hold.cancel(); try { FX2.release(host); } catch (x) {} host.remove(); if (done) done(ok); };
      later(() => end(false), delay * 1000 / sp + 7000);
      later(async () => {
        try {
          const shot = await FX2.capture(target, { w: Math.round(e.w), h: Math.round(e.h) }); if (ended) return;
          const tex = document.createElement('canvas'); tex.width = W2; tex.height = H2; tex.getContext('2d').drawImage(shot, pad, pad);
          node.appendChild(host);
          // 1.12.15 'pulse': a GPU reaction — the piece bends (ripples, splits, twists) and springs back, then shows again
          const pulse = dir === 'pulse';
          const ok = await FX2.play(host, { ...spec, dur: spec.dur / sp, dir: pulse ? 'out' : dir, ramp: pulse ? 'pulse' : spec.ramp, peak: info.peak, tex, w: W2, h: H2, hold: dir === 'out', onStart: dir !== 'in' ? () => { target.style.visibility = 'hidden'; } : null });
          if (pulse) target.style.visibility = '';
          end(ok);
        } catch (err) { console.warn('[BeeboFX 2] piece', err); end(false); }
      }, delay * 1000 / sp);
      return true;
    }
    function enterEl(r, extra = 0) {
      const { el, parts } = r, e = el.enter || {};
      const scEls = (D.scenes[r.scene] && D.scenes[r.scene].elements) || [];     // 1.12.15: "start after" another piece
      transIn(parts.inn, e.type, CORE.startOf(el, scEls) + extra, { m: e, board: r.scene === 'board', cracks: parts.fx && parts.fx.querySelector('.sd-cracks'), at: [el.x + el.w / 2, el.y + el.h / 2], size: Math.max(el.w, el.h), color: el.effect.color, edge: { x: el.x, y: el.y, w: el.w, h: el.h }, dir: el.side === 2 ? -1 : 1, el });
    }
    function playBoard() { for (const r of doms.values()) if (r.scene === 'board' || (r.shared && !booted)) enterEl(r); }
    function exitEl(r, done) {             // a piece leaves: its own exit (or nothing), then it's hidden until the screen comes back
      const x = r.el.exit || {}; if (!x.type || x.type === 'none' || POTATO()) { done && done(); return 0; }
      const inn = r.parts.inn;
      if (/^(gx|tr)-/.test(x.type)) {          // 1.12.13: they used to just fade
        const el = r.el, spec = gxSpec(x.type, x, {}), d = ((Number(x.delay) || 0) + ((spec && spec.dur) || 1.1)) / ((D.motion && Number(D.motion.speed)) || 1);
        const kept = () => { inn.style.visibility = 'hidden'; later(() => { inn.style.visibility = ''; }, 300); done && done(); };
        if (gxPiece(inn, x.type, Number(x.delay) || 0, { m: x, edge: { x: el.x, y: el.y, w: el.w, h: el.h }, color: el.effect.color }, 'out', kept)) return d;
        const back = r.el.exit; r.el.exit = { ...x, type: gxFallback(x.type) || 'fade' }; try { return exitEl(r, done); } finally { r.el.exit = back; }
      }
      if (FXL && FXL.OUTS[x.type]) { const el = r.el, d = OUTS[x.type].dur; try { FXL.OUTS[x.type].play({ ...fxApi, t: inn, el, rect: { x: el.x, y: el.y, w: el.w, h: el.h }, color: rc0(el.effect.color), delay: (Number(x.delay) || 0) * 1000, dur: (Number(x.dur) || d / 1000) * 1000, dir: el.side === 2 ? -1 : 1, done: () => { inn.style.opacity = '0'; done && done(); later(() => { inn.style.opacity = ''; inn.getAnimations().forEach(a => a.cancel()); }, 60); } }); } catch (e) { done && done(); }
        return ((Number(x.delay) || 0) + (Number(x.dur) || d / 1000)) / ((D.motion && Number(D.motion.speed)) || 1); }
      const kf = simpleKF(x.type, x, true) || simpleKF('fade', x, true);
      const a = anim(inn, kf, { duration: (Number(x.dur) || .45) * 1000, delay: (Number(x.delay) || 0) * 1000, easing: EASE[x.ease] || 'ease-in', fill: 'forwards' });
      a.onfinish = () => { done && done(); later(() => a.cancel(), 50); };
      return ((Number(x.delay) || 0) + (Number(x.dur) || .45)) / ((D.motion && Number(D.motion.speed)) || 1);
    }
    // ------------------------------------------------------------------ BeeboFX 2: screens in and out on the graphics card
    const gxOn = () => !!(FX2 && FX2.available && !POTATO() && !calm() && !document.documentElement.classList.contains('sb-ultra') && (!GFX || GFX.on) && !CORE.opts0.edit);
    // 'gx-burn' (a transition as it comes) or 'tr-<key>' (one made in the transition editor) → what to play
    function gxSpec(type, m = {}, sc = {}) {
      if (!FX2 || !type) return null;
      let base = null;
      if (/^tr-/.test(type)) { const c = (D.transitions || []).find(x => 'tr-' + x.key === type); if (c && FX2.TRANSITIONS[c.base]) base = { ...c, id: c.base }; }
      else if (/^gx-/.test(type) && FX2.TRANSITIONS[type.slice(3)]) base = { id: type.slice(3) };
      if (!base) return null;
      return { id: base.id, dur: Number(m.dur) || Number(base.dur) || FX2.TRANSITIONS[base.id].dur || 1.1, ramp: base.ramp || m.ramp || 'smooth', color: base.color || rc0(sc.effectColor || UC('effects', '#ff5a1f', '#ff5a1f')), origin: base.origin || [.5, .5],
        angle: Number(base.angle ?? m.angle) || 0, intensity: Number(base.intensity ?? 1), blur: base.blur ?? (D.motion ? D.motion.blur !== false : true), seed: Number(base.seed) || 7 };
    }
    const gxFallback = type => { const id = /^tr-/.test(type) ? ((D.transitions || []).find(x => 'tr-' + x.key === type) || {}).base : type.slice(3); return (FX2 && FX2.TRANSITIONS[id] && FX2.TRANSITIONS[id].fb) || 'fade'; };
    const gxCache = {};         // the screen as it was last drawn, ready for its exit (kept while nothing on it changes)
    function gxRemember(name) {
      const node = scenes[name], sc = D.scenes[name]; if (!node || !gxOn() || !gxSpec(sc.transOut, sc.outM || {}, sc)) return;
      const n0 = paintN; FX2.capture(node, { w: W, h: H }).then(tex => { if (show[name] && paintN === n0) gxCache[name] = { tex, n: n0 }; }).catch(() => {});
    }
    function gxIn(name, node, sc) {
      const spec = gxSpec(sc.transIn, sc.inM || {}, sc);
      node.classList.add('sd-gxwait');
      const fallback = () => { node.classList.remove('sd-gxwait'); transIn(node, gxFallback(sc.transIn), 0, { m: sc.inM || {}, at: [W / 2, H / 2], size: 700, color: sc.effectColor }); for (const r of doms.values()) if (r.scene === name) enterEl(r, .25); };
      FX2.capture(node, { w: W, h: H }).then(tex => {
        if (!show[name]) { node.classList.remove('sd-gxwait'); return; }
        return FX2.play(root, { ...spec, dir: 'in', tex }).then(ok => { node.classList.remove('sd-gxwait'); if (!ok) fallback(); else later(() => gxRemember(name), 400); });
      }).catch(fallback);
    }
    function gxOut(name, node, sc, done) {
      const spec = gxSpec(sc.transOut, sc.outM || {}, sc), c = gxCache[name];
      const go = tex => FX2.play(root, { ...spec, dir: 'out', tex, onStart: () => node.classList.add('sd-hidden') }).then(ok => { if (!ok) node.classList.add('sd-hidden'); done && done(); });
      if (c && c.n === paintN) { delete gxCache[name]; go(c.tex); return; }
      FX2.capture(node, { w: W, h: H }).then(go).catch(() => { transOut(node, gxFallback(sc.transOut), done, sc.outM || {}); });
    }
    let underT = 0;
    const solidBg = bg => !!bg && bg.type !== 'none' && Array.isArray(bg.colors) && bg.colors.length > 0 && bg.colors.every(c => /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(c)) && (String(c).length === 7 || /ff$/i.test(String(c))));
    // 1.12.10: the Stream Deck's Stinger key — the stinger of the screen on show, else the layout's first, else glass shards in its colours
    function playStinger() {
      if (!window.BeeboStinger || POTATO()) return;
      const has = k => D.scenes[k] && D.scenes[k].stinger && D.scenes[k].stinger.k && D.scenes[k].stinger.k !== 'none';
      const k = Object.keys(show).find(x => show[x] && has(x)) || Object.keys(D.scenes).find(has);
      const st = k ? D.scenes[k].stinger : { k: 'shards', colors: ['#0b0a08', (D.scenes.vs && D.scenes.vs.effectColor) || '#e0a93b', '#ffffff'] };
      window.BeeboStinger.play(root, { ...st, logo: st.useLogo && S.brand && S.brand.logo || '' });
    }
    function showScene(name, on, instant) {
      if (!scenes[name]) return;
      if (show[name] === on && !instant) return;
      show[name] = on;
      // 1.12.15: "Same every time" — every showing of a screen plays its random parts (shards, sparks, glitches) the same way
      if (D.seeded && window.BeeboFX4) window.BeeboFX4.reseed(`${D.name || 'layout'}:${name}:${on ? 'in' : 'out'}`);
      if (on && scenes[name] && scenes[name].__camRun) scenes[name].__camRun();      // 1.12.15: the camera move plays as the screen comes in
      const node = scenes[name], sc = D.scenes[name];
      if (on) {
        unpark(name);
        for (const other of Object.keys(show)) if (other !== name && show[other] && isFull(other) && isFull(name)) showScene(other, false, instant);
        node.getAnimations().forEach(a => a.cancel());
        node.classList.remove('sd-hidden');
        if (opts.live && name !== 'board' && isFull(name)) document.documentElement.classList.add('sd-splash-on');   // the format overlay clears its leftovers and holds its moments
        // 1.12: once a full-screen splash with a solid background has covered the board, stop drawing the board under it
        clearTimeout(underT);
        if (name !== 'board' && isFull(name) && solidBg(sc.bg) && scenes.board) underT = setTimeout(() => { if (show[name] && scenes.board && scenes.board.isConnected) scenes.board.classList.add('sd-under'); }, instant ? 0 : 1600);
        if (GFX) GFX.scene(name, true, instant);
        paint(false); refit(); for (const r of doms.values()) if (r.scene === name && r.parts.tick) { r.parts.tickK = ''; } paint(false);
        if (!instant && g3fluid[name]) later(() => g3fluid[name] && g3fluid[name].burst(.5, .3, 1), 350);
        if (!instant && sc.stinger && sc.stinger.k && sc.stinger.k !== 'none' && window.BeeboStinger && !POTATO()) window.BeeboStinger.play(root, { ...sc.stinger, logo: sc.stinger.useLogo && S.brand && S.brand.logo || '' });
        if (!instant && /^(gx|tr)-/.test(sc.transIn || '') && gxSpec(sc.transIn, sc.inM || {}, sc) && gxOn()) { gxIn(name, node, sc); screenSound(name, 'in'); }
        else if (!instant) {
          const tin = /^(gx|tr)-/.test(sc.transIn || '') ? gxFallback(sc.transIn) : sc.transIn;
          transIn(node, tin, 0, { m: sc.inM || {}, at: [W / 2, H / 2], size: 700, color: sc.effectColor, edge: { x: 0, y: H - 40, w: W, h: 40 } });
          for (const r of doms.values()) if (r.scene === name) enterEl(r, .25);
          screenSound(name, 'in');
          later(() => gxRemember(name), 2200); later(() => rememberStill(name), 2400);
        }
      } else if (!node.classList.contains('sd-hidden')) {
        if (name !== 'board' && scenes.board) { clearTimeout(underT); scenes.board.classList.remove('sd-under'); }
        if (opts.live && name !== 'board') setTimeout(() => { if (!Object.keys(show).some(k => k !== 'board' && show[k] && isFull(k))) document.documentElement.classList.remove('sd-splash-on'); }, 0);
        if (instant) node.classList.add('sd-hidden');
        else {
          const after = () => { for (const r of doms.values()) if (r.scene === name) r.parts.inn.getAnimations().forEach(a => a.cancel()); emitters(); };
          if (/^(gx|tr)-/.test(sc.transOut || '') && gxSpec(sc.transOut, sc.outM || {}, sc) && gxOn()) { screenSound(name, 'out'); gxOut(name, node, sc, after); }
          else {
            let wait = 0; for (const r of doms.values()) if (r.scene === name) wait = Math.max(wait, exitEl(r));
            screenSound(name, 'out');
            const tout = /^(gx|tr)-/.test(sc.transOut || '') ? gxFallback(sc.transOut) : sc.transOut;
            later(() => { if (!show[name]) transOut(node, tout, after, sc.outM || {}); }, wait * 1000);
          }
        }
      }
      emitters(); clipCv();
    }
    const isFull = name => name === 'vs' || name === 'victory' || (name !== 'board' && (SCREENS[D.scenes[name] && D.scenes[name].kind] || SCREENS.custom).full !== false);
    function screenFor(id) { if (!id) return ''; if (D.scenes[id]) return id; const sl = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return Object.keys(D.scenes).find(k => sl(D.scenes[k].name) === sl(id) || D.scenes[k].kind === id) || ''; }

    // fonts arrive after the first paint: measure every name again so nothing stays clipped
    // 1.12: lay out each splash once, unseen, a few seconds after the page opens (its lettering measured, its pictures
    // decoded), so the first time it comes on the PC isn't doing all of that in the middle of the entrance
    function prewarm() {
      const todo = Object.keys(scenes).filter(n => n !== 'board' && scenes[n].classList.contains('sd-hidden') && scenes[n].isConnected);
      const one = () => {
        const n = todo.shift(); if (!n) return;
        const node = scenes[n]; if (!show[n]) unpark(n);
        if (!show[n] && node.classList.contains('sd-hidden') && node.isConnected) {
          node.classList.add('sd-warm');            // still sd-hidden to everything else: only laid out, never shown
          for (const r of doms.values()) if (r.scene === n) { const P = r.parts; if (P.name) fitText(P.name, P.nameSize, Math.max(10, P.nameSize * .45)); if (P.round) fitText(P.round, P.roundSize, 10); if (P.text) fitText(P.text, P.textSize, P.minSize || 10, P.wrap); }
          void node.offsetHeight;
          node.querySelectorAll('img').forEach(i => { try { i.decode().catch(() => {}); } catch (e) {} });
          requestAnimationFrame(() => node.classList.remove('sd-warm'));
        }
        (window.requestIdleCallback || (f => setTimeout(f, 300)))(one, { timeout: 2000 });
      };
      one();
    }
    function refit() {
      for (const r of doms.values()) {
        if (!r.shared && scenes[r.scene] && scenes[r.scene].classList.contains('sd-hidden')) continue;
        const P = r.parts;
        if (P.tick && P.tickW === 0) P.tickK = '';
        if (P.name) fitText(P.name, P.nameSize, Math.max(10, P.nameSize * .45));
        if (P.round) fitText(P.round, P.roundSize, 10);
        if (P.meta) { P.metaK = ''; paintMeta(r); }
        if (P.text) fitText(P.text, P.textSize, P.minSize || 10, P.wrap);
      }
    }
    if (document.fonts) { document.fonts.ready.then(refit); document.fonts.addEventListener('loadingdone', refit); }

    // ------------------------------------------------------------------ public
    function ownFormat() {
      if (!opts.live) return;
      // 1.12.21: does this layout draw the moment banner and the head-to-head line itself? (if not, the show layer draws its own)
      { const uses = re => ((D.scenes.board && D.scenes.board.elements) || []).some(e => !e.hidden && re.test(JSON.stringify([e.text || '', e.rule || '', e.tpl || ''])));
        window.__SB_MOMENT_OWN = uses(/moment\./); window.__SB_H2H_OWN = uses(/h2h\.|hist\.line/);
        window.__SB_TALE_OWN = ['vs'].some(k => ((D.scenes[k] && D.scenes[k].elements) || []).some(e => !e.hidden && /tale\.(mid|strip|p[12]\.)/.test(JSON.stringify([e.text || '', e.rule || ''])))); }      // 1.12.23: a FullVS with its own stats strip: the app's steps aside
      // 1.12.24: the layout's own colour for each side (its player bars' team colour) — GlassVS wears them in any match
      { const hx = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : ''), first = f => hx(f && f.colors && f.colors[0]);
        const bars = ((D.scenes.board && D.scenes.board.elements) || []).filter(e => e.kind === 'bar' && !e.hidden), of = sd => { const b = bars.find(e => (Number(e.side) || 1) === sd); return b ? hx(b.teamColor) || first(b.accent) : ''; };
        window.__SB_SIDES = [of(1), of(2)]; }
      window.__SB_GAME = D.game || '';        // 1.12.24: whose HUD the app's own pieces keep clear of (public/sb-hud.js)
      window.__SB_FORMAT_OWN = Object.values(D.scenes).map(sc => sc.kind).filter(k => ['fvs', 'fboard', 'fwin'].includes(k));
      window.__SB_BRACKET_OWN = Object.values(D.scenes).map(sc => sc.kind).filter(k => ['bracket', 'top8', 'standings'].includes(k));
    }
    // ------------------------------------------------------------------ 1.12.21: the scoreboard's own transitions
    // Swap: what's on each bar slides toward the middle and the other side's comes in from there — inside each bar's own box,
    // so nothing crosses the game's HUD. A new set (two new players, or the score back to 0–0): the pieces along the top slide up
    // off the screen with the old names and come back down with the new ones — up and down only, never over the health bars.
    // At the layout's tempo; a plain fade with reduced motion; nothing at all in potato mode or while a splash covers the board.
    let trBusy = null;
    const nm2 = st => [String((st.p1 || {}).name || '').trim().toLowerCase(), String((st.p2 || {}).name || '').trim().toLowerCase()];
    const sum2 = st => (Number((st.p1 || {}).score) || 0) + (Number((st.p2 || {}).score) || 0);
    function transitionFor(a, b) {
      if (opts.thumb || POTATO() || stillRender || (window.__SB_INSTANT && !inst._seen) || D.motion.transitions === false) return '';
      if ((only && only !== 'board') || Object.keys(show).some(k => show[k] && k !== 'board' && isFull(k))) return '';
      if (b.format && b.format.status === 'live') return '';                              // a game format moves its own players
      const [a1, a2] = nm2(a), [b1, b2] = nm2(b);
      if (a1 && a2 && a1 !== a2 && a1 === b2 && a2 === b1) return 'swap';
      // two new players, or the score back to 0–0 (with or without a new name) — but not the first point of a set being taken back
      if ((a1 !== b1 && a2 !== b2 && (b1 || b2)) || (sum2(b) === 0 && (sum2(a) >= 2 || (sum2(a) > 0 && !!a.winnerSide)))) return 'newset';
      return '';
    }
    function runTransition(kind, s, o) {
      const t = tempoOf(), fade = calm(), sp = (D.motion && Number(D.motion.speed)) || 1, tn = tempoName();
      trBusy = { s, o, kind };
      const land = () => { const w = trBusy; trBusy = null; inst._apply(w.s, w.o); };
      const A = (node, k, x) => node.animate(k, { fill: 'both', ...x, duration: x.duration / sp, delay: (x.delay || 0) / sp });
      if (kind === 'swap') {
        const bars = [...doms.values()].filter(r => r.scene === 'board' && r.el.kind === 'bar' && r.parts.body), outD = t.d * .75, list = [];
        for (const r of bars) { const body = r.parts.body, dir = (r.el.side === 2 ? -1 : 1) * (r.el.flip && r.el.side !== 2 ? -1 : 1), to = fade ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dir * 42}%)` };
          body.classList.add('sd-xclip'); for (const c of body.children) list.push([c, dir, A(c, [{ opacity: 1, transform: 'none' }, to], { duration: outD, easing: 'cubic-bezier(.5,0,.9,.5)' })]); }
        // the pips are pieces of their own: they fade out and back with the bars, so they don't jump to the other side's count
        const pips = [...doms.values()].filter(r => r.scene === 'board' && r.el.kind === 'pips').map(r => [r, A(r.parts.inn, [{ opacity: 1 }, { opacity: 0 }], { duration: outD, easing: 'ease-in' })]);
        later(() => {
          land();
          for (const [r, o2] of pips) { o2.cancel(); if (r.node.isConnected) A(r.parts.inn, [{ opacity: 0 }, { opacity: 1 }], { duration: t.d * 1.15, easing: 'ease-out', fill: 'backwards' }); }
          for (const [c, dir, out] of list) { out.cancel();
            const from = fade ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dir * 42}%)` }, k = !fade && tn === 'overshoot' ? [from, { opacity: 1, transform: `translateX(${-dir * 5}%)`, offset: .6 }, { opacity: 1, transform: 'none' }] : [from, { opacity: 1, transform: 'none' }];
            A(c, k, { duration: t.d * 1.15, easing: tn === 'overshoot' ? 'ease-out' : t.e, fill: 'backwards' }); }
          later(() => { for (const r of bars) r.parts.body.classList.remove('sd-xclip'); }, t.d * 1.15 / sp + 80);
        }, outD / sp + 10);
        return;
      }
      // a new set: the top of the scoreboard leaves upward and returns
      const top = [...doms.values()].filter(r => r.scene === 'board' && r.el.y + r.el.h / 2 < H * .3 && !r.node.classList.contains('sd-rule-off')).sort((x, y) => x.el.x - y.el.x);
      const outD = t.d * 1.1, gone = r => `translateY(${-(r.el.y + r.el.h + 14)}px)`, outs = [];
      for (const r of top) outs.push(A(r.parts.inn, [{ opacity: 1, transform: 'none' }, fade ? { opacity: 0 } : { opacity: .2, transform: gone(r) }], { duration: outD, easing: 'cubic-bezier(.55,0,.9,.45)' }));
      later(() => {
        land();
        const inD = t.d * 1.5;
        for (const [i, r] of top.entries()) {
          if (outs[i]) outs[i].cancel(); if (!r.node.isConnected) continue;
          const from = fade ? { opacity: 0 } : { opacity: .2, transform: gone(r) };
          const k = fade ? [from, { opacity: 1 }] : tn === 'overshoot' ? [from, { opacity: 1, transform: 'none', offset: .58 }, { opacity: 1, transform: `translateY(${-Math.min(7, r.el.h * .12)}px)`, offset: .78 }, { opacity: 1, transform: 'none' }] : [from, { opacity: 1, transform: 'none' }];
          A(r.parts.inn, k, { duration: inD, delay: tn === 'soft' ? 0 : Math.min(i, 6) * t.d * .09, easing: tn === 'overshoot' ? 'ease-out' : t.e, fill: 'backwards' });
        }
      }, outD / sp + 20);
    }
    build(); ownFormat();
    const inst = {
      root, get design() { return D; },
      setDesign(d) { D = themed(normalize(d)); loadFonts(D); sizeUp(); build(); ownFormat(); },
      // 1.12.21: a swap or a new set plays its transition first (the state lands in the middle of it); everything else lands at once
      setState(s, o = {}) {
        if (s && s.x && s.x.timer && !s.x.timer.__at) s.x.timer.__at = Date.now();          // the set timer counts on from when this arrived
        if (trBusy) { trBusy.s = s; trBusy.o = o; return; }                                  // mid-transition: the newest state is the one that lands
        const kind = booted && S && s ? transitionFor(S, s) : '';
        if (kind) return runTransition(kind, s, o);
        inst._apply(s, o);
      },
      _apply(s, { live } = {}) {
        S = live ? s : derive(s); paint(!booted);
        if (!booted) { booted = true; [400, 1500, 3500].forEach(ms => setTimeout(refit, ms)); if (opts.live) setTimeout(prewarm, 4500);      // a page opened mid-event (OBS refresh) with long names already set: measure again once it's on screen
          if (opts.live) { if (urlScreen) { const sn = screenFor(urlScreen); only = sn || 'board'; applyVisibility(); if (sn && sn !== 'board') { show[sn] = true; transIn(scenes[sn], D.scenes[sn].transIn, 0, { m: D.scenes[sn].inM || {} }); for (const r of doms.values()) if (r.scene === sn) enterEl(r, .25); emitters(); } else playBoard(); } else if (!window.__SB_INSTANT) playBoard(); } }
        if (opts.live && !urlScreen) {
          // the Format tab's splashes (board, Team VS, champion) use this layout's own screen when it has one
          let fk = s.splash && s.splash.show;
          if (fk === 'bracket') { const bm = CORE.brModel; if (bm && bm.autoTop8 !== false && bm.top8 && bm.top8.reached && Object.values(D.scenes).some(x => x.kind === 'top8')) fk = 'top8'; }   // the event reached Top 8
          // 1.12.14: a viewer tournament's group stage (pools, round robin, Swiss: tables and match cards) isn't a bracket this
          // layout's bracket piece can draw — the built-in splash draws it instead, so the pools aren't left as an empty screen
          if (fk === 'bracket' && CORE.brModel && CORE.brModel.grid) fk = '';
          const own = ['fvs', 'fboard', 'fwin', 'bracket', 'top8', 'standings'].includes(fk) ? (Object.keys(D.scenes).find(k => D.scenes[k].kind === fk) || '') : '';
          const want = own || screenFor(s.screen);
          for (const k of Object.keys(D.scenes)) if (!['board', 'vs', 'victory'].includes(k) && (k === want) !== !!show[k]) showScene(k, k === want, !!window.__SB_INSTANT && !inst._seen);
        }
        if (opts.live && !urlScreen) {
          const vs = !!(s.vs && s.vs.show), vic = !!(s.victory && s.victory.show);
          if (vs !== show.vs && !window.__SB_FULLVS) showScene('vs', vs, !!window.__SB_INSTANT && !inst._seen);   // 1.12.6: Obsidian Glass and Porcelain play FullVS (sb-fullvs.js)
          if (vic !== show.victory) showScene('victory', vic, !!window.__SB_INSTANT && !inst._seen);
          inst._seen = true;
        }
      },
      get state() { return S; },
      setScene(name) { const ch = only !== name; only = name; if (ch && [...doms.values()].some(r => r.el.everywhere)) build(); else applyVisibility(); emitters(); },
      showScreen(name, on = true) { showScene(name, on); },
      playExit(id) { const r = doms.get(id); if (r) exitEl(r, () => later(() => r.parts.inn.getAnimations().forEach(a => a.cancel()), 400)); },
      react(id, type) { const r = doms.get(id); if (r) react(r, type, undefined, { test: true }); },      // (the Designer's Try it: a reaction that waits for its moment — three games lost in a row… — plays anyway)
      gfx(type, info) { if (GFX) GFX.event(type, info || {}); return !!GFX; },
      electrocute(side) { electrocute(barOf(side === 2 ? 2 : 1)); },
      slice(side) { slicePlate(barOf(side === 2 ? 2 : 1)); },
      fissure(side) { fissure(barOf(side === 2 ? 2 : 1)); },
      playBoard,
      playScene(name) { if (!scenes[name]) return; only = name; scenes[name].getAnimations().forEach(a => a.cancel()); if (scenes[name].__camRun) scenes[name].__camRun(); scenes[name].classList.remove('sd-hidden'); applyVisibility(); const sc = D.scenes[name]; if (name === 'board') return playBoard();
        if (g3fluid[name]) later(() => g3fluid[name] && g3fluid[name].burst(.5, .3, 1), 350);
        if (sc.stinger && sc.stinger.k && sc.stinger.k !== 'none' && window.BeeboStinger && !POTATO()) window.BeeboStinger.play(root, { ...sc.stinger, logo: sc.stinger.useLogo && S.brand && S.brand.logo || '' });
        if (/^(gx|tr)-/.test(sc.transIn || '') && FX2 && FX2.available && gxSpec(sc.transIn, sc.inM || {}, sc)) { const node = scenes[name], spec = gxSpec(sc.transIn, sc.inM || {}, sc); node.classList.add('sd-gxwait'); refit(); FX2.capture(node, { w: W, h: H }).then(tex => FX2.play(root, { ...spec, dir: 'in', tex })).finally(() => node.classList.remove('sd-gxwait')); return; }
        transIn(scenes[name], sc.transIn, 0, { m: sc.inM || {}, at: [W / 2, H / 2], size: 700, color: sc.effectColor }); for (const r of doms.values()) if (r.scene === name) enterEl(r, .25); },
      exitScene(name, done) { const sc = D.scenes[name];
        if (/^(gx|tr)-/.test(sc.transOut || '') && FX2 && FX2.available && gxSpec(sc.transOut, sc.outM || {}, sc)) { const node = scenes[name]; FX2.capture(node, { w: W, h: H }).then(tex => FX2.play(root, { ...gxSpec(sc.transOut, sc.outM || {}, sc), dir: 'out', tex, onStart: () => node.classList.add('sd-hidden') })).finally(() => done && done()); return; }
        let wait = 0; for (const r of doms.values()) if (r.scene === name) wait = Math.max(wait, exitEl(r)); later(() => transOut(scenes[name], sc.transOut, () => { for (const r of doms.values()) if (r.scene === name) r.parts.inn.getAnimations().forEach(a => a.cancel()); done && done(); }, sc.outM || {}), wait * 1000); },
      playEnter(id, type) { const r = doms.get(id); if (!r) return; const keep = r.el.enter; if (type) r.el.enter = { ...keep, type, delay: 0 }; enterEl(r); r.el.enter = keep; },
      playEffect(id, type) { const r = doms.get(id); if (r) burst(r, type || r.el.effect.type); },
      node(id) { const r = doms.get(id); return r && r.node; },
      fluidBurst(name, x, y, p) { const f = g3fluid[name || 'vs'] || Object.values(g3fluid)[0]; if (f) f.burst(x ?? .5, y ?? .3, p ?? 1); return !!f; },
      destroy() { for (const g of g3all.splice(0)) { try { g.destroy(); } catch (e) {} } if (GFX) { GFX.destroy(); GFX = null; } if (window.Beebo3D) { window.Beebo3D.release(uid); window.Beebo3D.sweep(uid); } cancelAnimationFrame(raf); raf = 0; clearInterval(tickT); timers.forEach(clearTimeout); root.remove(); },
    };
    return inst;
  }

  // =============================================================================================== a scene as one SVG
  // Designer › Export as SVG, and how BeeboScore's own art (Stream Deck keys, the logo, the panel's themes) is made:
  // every shape exactly as the Designer draws it (the same outlines, rounded corners, cuts, fills and outlines).
  // opts.filters: false leaves out glows and shadows (for places that can't draw SVG filters, like Stream Deck keys).
  function toSVG(design, sceneName = 'board', opts = {}) {
    const D = normalize(design), sc = D.scenes[sceneName] || D.scenes.board, w = (D.size && D.size.w) || 1920, h = (D.size && D.size.h) || 1080;
    const pre = opts.id || 'x', defs = [], body = [], useF = opts.filters !== false;
    const rc = c => { if (typeof c !== 'string' || c[0] !== '@') return c; const t = ((D.theme && D.theme.colors) || []).find(x => '@' + x.id === c); return t ? t.value : '#ff5a1f'; };
    const recol = f => f && f.colors ? { ...f, colors: f.colors.map(rc) } : f;
    if (sc.bg && sc.bg.type && sc.bg.type !== 'none' && opts.bg !== false) body.push(`<rect width="${w}" height="${h}" fill="${svgPaint(recol(sc.bg), pre + 'bg', defs)}"/>`);
    (sc.elements || []).forEach((el, i) => {
      if (el.hidden) return;
      const id = `${pre}${i}`, d = pathFor(el), op = Number(el.opacity ?? 1), rot = Number(el.rot) || 0;
      const tr = `translate(${+el.x.toFixed(2)} ${+el.y.toFixed(2)})${rot ? ` rotate(${rot} ${el.w / 2} ${el.h / 2})` : ''}`;
      const look = el.look || {}, sh = look.shadow && look.shadow.on && useF;
      if (sh) defs.push(`<filter id="${id}sh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${Number(look.shadow.x) || 0}" dy="${Number(look.shadow.y) || 0}" stdDeviation="${(Number(look.shadow.blur) || 0) / 2}" flood-color="${esc(look.shadow.color || '#000000')}"/></filter>`);
      let g = `<g transform="${tr}"${op < 1 ? ` opacity="${op}"` : ''}${sh ? ` filter="url(#${id}sh)"` : ''}${look.blend && look.blend !== 'normal' ? ` style="mix-blend-mode:${look.blend}"` : ''}>`;
      const showBg = el.kind !== 'text' || (el.fill && el.fill.type !== 'none') || (el.stroke && el.stroke.width > 0);
      if (showBg && el.kind !== 'three') {
        const fill = svgPaint(recol(el.fill), id + 'f', defs), st = el.stroke || {}, sw = Number(st.width) || 0, glow = Number(st.glow) || 0;
        if (fill !== 'none') g += `<path d="${d}" fill="${fill}"/>`;
        if (sw) {
          const align = st.align || 'center', realW = align === 'center' ? sw : sw * 2;
          if (align === 'inside') defs.push(`<clipPath id="${id}ci"><path d="${d}"/></clipPath>`);
          if (glow && useF) defs.push(`<filter id="${id}gl" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="${glow / 2}" flood-color="${esc(rc(st.color))}"/></filter>`);
          const dash = st.style === 'dashed' ? ` stroke-dasharray="${sw * 3} ${sw * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0.1 ${sw * 2}" stroke-linecap="round"` : '';
          g += `<path d="${d}" fill="none" stroke="${esc(rc(st.color))}" stroke-width="${realW}" stroke-linejoin="round"${dash}${align === 'inside' ? ` clip-path="url(#${id}ci)"` : ''}${glow && useF ? ` filter="url(#${id}gl)"` : ''}/>`;
        }
      }
      if (el.kind === 'text' || el.kind === 'header') {
        const fam = fontOf(D, el.font.family), fsz = Math.max(4, el.h * .78 * (Number(el.font.size) || 1));
        let txt = String(el.text || ''); if (el.font.upper) txt = txt.toUpperCase();
        const al = alignOf(el, 'center'), x = al === 'left' ? 0 : al === 'right' ? el.w : el.w / 2, anchor = al === 'left' ? 'start' : al === 'right' ? 'end' : 'middle';
        const est = txt.length * fsz * .56, squeeze = est > el.w ? ` textLength="${el.w}" lengthAdjust="spacingAndGlyphs"` : '';
        const tf = svgPaint(recol({ ...el.font.color, angle: 180 }), id + 't', defs);
        const ol = el.font.fx === 'outline' ? ` stroke="${esc(el.font.fxColor || '#000000')}" stroke-width="${Math.max(1, fsz * .07)}" paint-order="stroke"` : el.font.fx === 'neon' ? ` stroke="${esc(mix(el.font.fxColor || '#ff3b14', '#ffffff', .55))}" stroke-width="${el.font.fxSize || 3}" fill-opacity="0"` : '';
        g += `<text x="${x}" y="${el.h / 2}" dominant-baseline="central" text-anchor="${anchor}" font-family="${esc(fam.css).replace(/&#39;/g, "'")}" font-weight="${fam.weight}" font-size="${+fsz.toFixed(1)}"${el.font.italic ? ' font-style="italic"' : ''}${el.font.spacing ? ` letter-spacing="${(Number(el.font.spacing) / 100) * fsz}"` : ''} fill="${tf}"${squeeze}${ol}>${esc(txt)}</text>`;
      }
      if (el.kind === 'pips') {          // 1.12.21: as a still — three pips, the first one won
        const n = 3, gap = Number(el.gap) || 0, ratio = Math.max(.2, Number(el.ratio) || 1), shp = SHAPES[el.pip] || SHAPES.diamond; let pw = (el.w - gap * (n - 1)) / n, ph = pw / ratio; if (ph > el.h) { ph = el.h; pw = ph * ratio; }
        const pd = shp.pill ? `M${ph / 2},0H${pw - ph / 2}A${ph / 2},${ph / 2} 0 0 1 ${pw - ph / 2},${ph}H${ph / 2}A${ph / 2},${ph / 2} 0 0 1 ${ph / 2},0Z` : 'M' + shp.pts.map(([x, y]) => `${+((el.side === 2 ? 1 - x : x) * pw).toFixed(2)},${+(y * ph).toFixed(2)}`).join('L') + 'Z';   // (1.5.8: 2P's lean the other way, as on stream)
        for (let k = 0; k < n; k++) g += `<path transform="translate(${+(el.side === 2 ? el.w - pw - k * (pw + gap) : k * (pw + gap)).toFixed(2)} ${+((el.h - ph) / 2).toFixed(2)})" d="${pd}" fill="${k ? esc(rc(el.offFill) || 'none') : esc(rc(el.onColor))}" stroke="${esc(rc(k ? el.offColor : el.onColor))}" stroke-width="1.5" stroke-linejoin="round"/>`;
      }
      if (el.kind === 'logo' && el.src) { const p = Number(el.pad) || 0; g += `<image href="${esc(el.src)}" x="${p}" y="${p}" width="${el.w - p * 2}" height="${el.h - p * 2}" preserveAspectRatio="xMidYMid ${el.fit === 'cover' ? 'slice' : 'meet'}"/>`; }
      body.push(g + '</g>');
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body.join('')}</svg>`;
  }

  // =============================================================================================== exports + live boot
  window.SBDesign = { mount, moveDur: CORE.moveDur, startOf: CORE.startOf, normalize, make, toSVG, KIND, SHAPES, FONTS, EFFECTS, TRANSITIONS, OUTS, FX: FXL, TEXTFX, WHEN, TEXTURES, IDLE, REACT, TEXTANIM, PARTICLES, SCREENS, RULE_OPS, ruleOk, pick, polyOf, pathFor, cutFor, cssPaint, SAMPLE, derive, lum, mix, hexRgb, fillText, themed, view, fontOf, listItems, plateTone, readable, contrast };

  const tag = document.getElementById('sb-design');
  if (tag) {
    let design = null;
    try { design = JSON.parse(tag.textContent); } catch (e) { console.error('BeeboScore: this layout\'s design data is damaged', e); }
    if (design) {
      const boot = () => {
        // On stream: built with an empty match (not the Designer's sample players, whose pictures don't exist) and kept
        // hidden until your real match has been drawn, so OBS never shows a half-built frame when the source loads
        const host = document.createElement('div'); host.id = 'sd-host'; host.style.visibility = 'hidden'; document.body.appendChild(host);
        const blank = { p1: { name: '' }, p2: { name: '' }, c1: {}, c2: {}, custom: {}, bracket: null, standings: [] };
        const inst = mount(host, design, { live: true, state: blank });
        let shown = false;
        const reveal = () => { if (shown) return; shown = true; requestAnimationFrame(() => requestAnimationFrame(() => { host.style.visibility = ''; })); };
        setTimeout(reveal, 4000);                 // no scoreboard connection (a layout file opened on its own): show it anyway
        addEventListener('scoreboard', e => { inst.setState(e.detail || {}, { live: true }); reveal(); });
        window.BeeboDesign = inst;
      };
      document.body ? boot() : addEventListener('DOMContentLoaded', boot);
    }
  }
})();
