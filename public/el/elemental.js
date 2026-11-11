/* BeeboScore (developed by Beebo) — the engine behind the ten "elemental" layouts (Frostbite, Venom, Royal, Crimson,
 * Gold Rush, Sakura, Tidal, Voltage, Chrome, Pastel).
 *
 * Each of those layouts is a small page (overlays/<name>/index.html) that names its theme and loads two files:
 *   themes.js      what each layout is made of: shapes, lettering, colours, effects and animations (window.EL_THEMES)
 *   elemental.js   this file: everything the ten have in common
 * A theme supplies its own scoreboard bar, VS Splash and Victory Splash; this file builds the page, follows the
 * scoreboard, keeps names fitted, runs the particles and calls the theme at each moment of a set:
 *   intro · a game won · match point · the set won (winner / loser) · reset · VS Splash in / out · Victory Splash in
 *
 * The bar has the footprint of the Ember layout (plates 654 × 69 with the cut-out over the game's round counters, the
 * centre tag 260 × 44 above the timer), so every layout lines up with the same games.
 * The VS Splash's name bars are 920 × 250 in every layout: that is the size a custom name-bar picture is made for.
 *
 * Staying off the game's HUD. Nothing a layout shows while a game is being played reaches outside that footprint:
 *   · plate shapes end at y = 69 (icicles, drips and waves are cut into the bottom edge, not hung below it)
 *   · glows and shadows are clipped at the footprint's edge
 *   · ambient particles (whatever a theme adds from bar.tick) are removed the moment they leave it
 * The one thing that crosses it is the burst when a game or a set is won, or on the intro: at most 1.25 seconds.
 */
(() => {
  'use strict';
  const meta = document.querySelector('meta[name="el-theme"]'), ID = meta ? String(meta.content || '').trim() : '', T = (window.EL_THEMES || {})[ID];
  if (!T || window.__EL) return;
  window.__EL = ID;
  const html = document.documentElement;
  const POTATO = () => html.classList.contains('sb-potato') || !!window.__SB_POTATO, LIGHT = () => html.classList.contains('sb-light');
  const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0], clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 654, H = 69, B = 540, P1X = 176, P2X = 1090;

  // ================================================================== particles
  const GLOW = new Set(['dot', 'spark', 'star', 'ring', 'flake']);
  /** opts.guard(x, y): where ambient particles (the ones a theme adds from its tick) may be; opts.maxLife: the longest a burst particle lives, in seconds */
  function PS(cv, opts = {}) {
    const ctx = cv.getContext('2d'); let parts = [], bolts = [], run = false, last = 0, tick = null, ambient = false;
    const minDecay = opts.maxLife ? 1 / opts.maxLife : 0;
    const perf = () => window.SBPerf;
    function add(p) { p = Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, life: 1, decay: 1, size: 4, rot: 0, vr: 0, type: 'dot', color: '#fff', sway: 0, ph: Math.random() * 6.28, a: 1 }, p); if (ambient) p.amb = true; else if (p.decay < minDecay) p.decay = minDecay; parts.push(p); go(); }
    function burst(x, y, n, o = {}) {
      if (POTATO()) return;
      const P = perf(); n = Math.max(1, Math.round((P ? P.n(n) : n) * (LIGHT() ? 0.4 : 1)));
      for (let i = 0; i < n; i++) {
        const ang = (o.dir ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), sp = rand(o.speed ? o.speed[0] : 120, o.speed ? o.speed[1] : 480);
        add({ x: x + rand(-(o.rx || 0), o.rx || 0), y: y + rand(-(o.ry || 0), o.ry || 0), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: o.g ?? 900, drag: o.drag ?? 0.985,
          decay: rand(o.decay ? o.decay[0] : 0.8, o.decay ? o.decay[1] : 1.6), size: rand(o.size ? o.size[0] : 2, o.size ? o.size[1] : 5), rot: rand(0, 6.28), vr: rand(-(o.spin || 0), o.spin || 0),
          type: o.type || 'dot', color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'), sway: o.sway || 0, a: o.a ?? 1 });
      }
    }
    function bolt(x1, y1, x2, y2, o = {}) { if (POTATO()) return; bolts.push({ x1, y1, x2, y2, life: 1, decay: o.decay || 4, color: o.color || '#fff', glow: o.glow || '#5b84ff', w: o.w || 2.5, jag: o.jag ?? 26, fork: o.fork ?? 1 }); go(); }
    function go() { if (!run) { run = true; last = performance.now(); requestAnimationFrame(frame); } }
    function shape(p, t) {
      const a = Math.min(1, p.life * 3) * p.a, s = p.size;
      ctx.globalCompositeOperation = GLOW.has(p.type) ? 'lighter' : 'source-over';
      ctx.globalAlpha = a; ctx.fillStyle = ctx.strokeStyle = p.color;
      switch (p.type) {
        case 'spark': ctx.lineWidth = s * 0.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
        case 'ring': ctx.lineWidth = Math.max(0.6, 3 * p.life); ctx.beginPath(); ctx.arc(p.x, p.y, s * (1 + (1 - p.life) * (p.grow || 6)), 0, 6.283); ctx.stroke(); break;
        case 'bubble': { const r = p.life < 0.12 ? s * (1 + (0.12 - p.life) * 9) : s; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.18, 0, 6.283); ctx.fill(); break; }
        case 'star': { const r = s * (0.5 + p.life * 0.7); ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r); ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r); ctx.fill(); break; }
        case 'dot': case 'flake': ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.283); ctx.fill(); break;
        default: {                                         // shapes that turn as they fly
          ctx.save(); ctx.translate(p.x, p.y);
          if (p.type === 'drop') ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2); else ctx.rotate(p.rot);
          if (p.type === 'coin' || p.type === 'confetti' || p.type === 'leaf') ctx.scale(1, Math.max(0.12, Math.abs(Math.cos(p.rot * 2.3 + p.ph))));
          ctx.beginPath();
          if (p.type === 'shard') { ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.8); ctx.lineTo(-s * 0.6, s * 0.5); ctx.closePath(); }
          else if (p.type === 'petal') ctx.ellipse(0, 0, s, s * 0.5, 0, 0, 6.283);
          else if (p.type === 'drop') { ctx.moveTo(0, -s * 1.6); ctx.quadraticCurveTo(s, s * 0.4, 0, s); ctx.quadraticCurveTo(-s, s * 0.4, 0, -s * 1.6); }
          else if (p.type === 'coin') ctx.arc(0, 0, s, 0, 6.283);
          else if (p.type === 'leaf') { ctx.moveTo(-s, -s * 0.4); ctx.lineTo(s * 0.8, -s * 0.6); ctx.lineTo(s, s * 0.5); ctx.lineTo(-s * 0.7, s * 0.6); ctx.closePath(); }
          else ctx.rect(-s, -s * 0.5, s * 2, s);         // confetti
          ctx.fill();
          if (p.type === 'coin') { ctx.globalAlpha = a * 0.55; ctx.strokeStyle = '#7a5200'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.3, s * 0.28, 0, 6.283); ctx.fill(); }
          ctx.restore();
        }
      }
    }
    function lightning(b) {
      const pts = [[b.x1, b.y1]], n = Math.max(4, Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 34));
      for (let i = 1; i < n; i++) { const k = i / n; pts.push([b.x1 + (b.x2 - b.x1) * k + rand(-b.jag, b.jag), b.y1 + (b.y2 - b.y1) * k + rand(-b.jag, b.jag) * 0.6]); }
      pts.push([b.x2, b.y2]);
      const line = (p, w, c, al) => { ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'bevel'; ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      ctx.globalCompositeOperation = 'lighter';
      line(pts, b.w * 4, b.glow, b.life * 0.45); line(pts, b.w, b.color, b.life);
      if (b.fork) { const m = pts[(pts.length * rand(0.3, 0.7)) | 0]; line([m, [m[0] + rand(-90, 90), m[1] + rand(30, 110)]], b.w * 0.6, b.color, b.life * 0.8); }
    }
    function frame(t) {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (tick && !POTATO()) { ambient = true; try { tick(dt, t); } finally { ambient = false; } }
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(p => (p.life -= p.decay * dt) > 0);
      for (const p of parts) { p.vy += p.g * dt; if (p.drag < 1) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; if (p.g <= 0) p.vy *= d; } p.x += (p.vx + (p.sway ? Math.sin(t / 500 + p.ph) * p.sway : 0)) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.amb && opts.guard && !opts.guard(p.x, p.y, p.size + 1)) { p.life = 0; continue; }      // an ambient particle is gone before it is drawn outside its area
        shape(p, t); }
      bolts = bolts.filter(b => (b.life -= b.decay * dt) > 0); for (const b of bolts) lightning(b);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (parts.length || bolts.length || tick) requestAnimationFrame(frame); else run = false;
    }
    return { add, burst, bolt, setTick(fn) { tick = fn; if (fn) go(); }, clear() { parts = []; bolts = []; }, get count() { return parts.length; } };
  }

  // ================================================================== page
  const F = '/static/fonts/';
  const faces = (T.fonts || []).map(([fam, w, st, file]) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:${st};src:url(${F}${file}) format('woff2')}`).join('') +
    `@font-face{font-family:'Chakra Petch';font-weight:600;src:url(${F}chakra-petch-latin-600-normal.woff2) format('woff2')}@font-face{font-family:'Chakra Petch';font-weight:700;src:url(${F}chakra-petch-latin-700-normal.woff2) format('woff2')}` +
    `@font-face{font-family:'Saira Condensed';font-weight:800;src:url(${F}saira-condensed-latin-800-normal.woff2) format('woff2')}@font-face{font-family:'Saira Condensed';font-weight:700;src:url(${F}saira-condensed-latin-700-normal.woff2) format('woff2')}`;
  const bar = T.bar, padO = bar.pad || 20, bodyH = bar.h || H;      // bar.h: how tall the plate's solid part is, when its bottom edge is cut into icicles, drips or waves (still inside the 69)
  const BASE = `
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
#el{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;font-family:'Saira Condensed','Arial Narrow',sans-serif}
#el-cv{position:absolute;left:0;top:0;width:1920px;height:520px;z-index:6}
.el-plate,.el-center{position:absolute;top:0;opacity:0}
.el-on .el-plate,.el-on .el-center{opacity:1}
.el-plate{width:${W}px;height:${H}px}.el-plate.p1{left:${P1X}px}.el-plate.p2{left:${P2X}px}
/* a plate never draws outside its footprint: its glows and shadows stop at its bottom edge (the game's health bars start right under it) and under the arm (the round counters).
   The clip is on the skin, not the plate, so the lettering and the score stay in the page's own stacking order: above the particle canvas, which is above the skins. */
.el-mir{clip-path:polygon(-16px -16px,${W + 16}px -16px,${W + 16}px 31px,${B + 12}px 31px,${B + 6}px 43px,${B}px ${H}px,-16px ${H}px)}
.el-center svg{clip-path:inset(-16px -16px 20px -16px)}
.el-body,.el-score,.el-arm,.el-cin{z-index:7}
.el-mir{position:absolute;inset:0}.p2 .el-mir{transform:scaleX(-1)}
.el-skin{position:absolute;left:0;top:0;width:${W}px;height:120px;overflow:visible}
.el-fx{position:absolute;left:0;top:0;width:${W}px;height:120px;overflow:hidden;clip-path:path('${bar.shape}')}
.el-body{position:absolute;top:0;height:${bodyH}px;left:${padO}px;width:${B - 76 - padO}px;display:flex;align-items:center;justify-content:center}
.p2 .el-body{left:190px}
.el-who{min-width:0;max-width:100%;display:flex;flex-direction:column;align-items:center;gap:2px}
.el-l1{display:flex;align-items:center;gap:10px;min-width:0;max-width:100%;white-space:nowrap}.p2 .el-l1{flex-direction:row-reverse}
.el-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:.14em 8px .08em 3px;margin:-.14em -3px -.08em -2px;line-height:1}
.el-team{flex:none;line-height:1}.el-team:empty{display:none}
.el-flag{flex:none;width:32px;height:21px;object-fit:cover;border-radius:2px}.el-flag.none{display:none}
.el-ltag{flex:none;font:700 13px/18px 'Chakra Petch',sans-serif;padding:0 6px;border-radius:2px}
.el-l2{height:15px;font:700 13px/15px 'Chakra Petch',sans-serif;letter-spacing:2.2px;text-transform:uppercase;display:flex;gap:10px;white-space:nowrap}
.p2 .el-l2{flex-direction:row-reverse}
.el-pro:empty{display:none}
.el-st{display:none}.mp .el-st.mp,.dg .el-st.dg{display:inline}.mp.dg .el-st.mp,.mp.dg .el-st.dg{display:none}.mp.dg .el-st.fin{display:inline}
.champ .el-st{display:none!important}.champ .el-st.win{display:inline!important}
.mp .el-st.mp,.mp.dg .el-st.fin{animation:el-blink 1s steps(2) infinite}@keyframes el-blink{50%{opacity:.72}}
.el-score{position:absolute;top:${Math.max(3, Math.round((bodyH - 50) / 2))}px;left:${B - 76}px;width:66px;height:50px;display:grid;place-items:center}.p2 .el-score{left:124px}
.el-score svg{position:absolute;left:0;top:0;width:66px;height:50px;overflow:visible}
.el-num{position:relative;display:inline-block;font:700 38px/1 'Chakra Petch',sans-serif}
.el-num.hit{animation:el-hit .55s cubic-bezier(.2,.9,.3,1.4)}@keyframes el-hit{0%{transform:scale(1.7);opacity:0}55%{transform:scale(.9);opacity:1}100%{transform:none}}
.el-arm{position:absolute;top:0;left:${B}px;width:${W - B}px;height:31px;display:flex;align-items:center;justify-content:center;gap:8px}
.p2 .el-arm{left:0;flex-direction:row-reverse}
.el-lbl{font:700 10px 'Chakra Petch',sans-serif;letter-spacing:2.2px}
.el-arm.none .el-lbl{display:none}
.el-pips{display:flex;gap:7px}.p2 .el-pips{flex-direction:row-reverse}
.el-pip{width:11px;height:11px;transform:rotate(45deg);border:1.5px solid var(--pip,#fff);transition:background .3s,box-shadow .3s}.el-pip.on{background:var(--pip,#fff)}
.el-center{left:830px;width:260px;height:44px}
.el-center svg{position:absolute;left:0;top:0;width:260px;height:64px;overflow:visible}
.el-cin{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:2px}
.el-meta{font:700 12px/15px 'Chakra Petch',sans-serif;letter-spacing:1.7px;text-transform:uppercase;white-space:nowrap;max-width:92%;overflow:hidden;display:flex;gap:7px}
.el-meta>span{flex:none}.el-meta.long>span:first-child{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.el-round{margin-top:1px;line-height:25px;font-size:22px;white-space:nowrap;max-width:88%;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;padding:0 3px}
/* ---- VS Splash: the same places in every layout (a custom name bar is 920 × 250, a custom header 1920 × 200) */
#el-vs,#el-vic{position:absolute;left:0;top:0;width:1920px;height:1080px;display:none;overflow:hidden;pointer-events:none;font-family:'Saira Condensed','Arial Narrow',sans-serif}
#el-vs{z-index:55}#el-vic{z-index:56}#el-vs.vs-show,#el-vic.vc-show{display:block}
.vs-bg,.vs-bg2,.vs-cv,.vs-flash,.vc-bg,.vc-bg2,.vc-cv,.vc-flash{position:absolute;left:0;top:0;width:1920px;height:1080px}
.vs-flash,.vc-flash{opacity:0;background:#fff}
.vs-hdr{position:absolute;left:0;top:0;width:1920px;height:200px;object-fit:cover;display:none}.has-hdr .vs-hdr{display:block}
.vs-round{position:absolute;left:50%;top:66px;transform:translateX(-50%);white-space:nowrap;padding:10px 46px;font-size:27px;line-height:1.2;letter-spacing:6px;text-transform:uppercase}
.has-hdr .vs-round{top:214px}.vs-round:empty{display:none}
.vs-side{position:absolute;top:0;width:920px;height:1080px}.vs-side.s1{left:30px}.vs-side.s2{left:970px}
.vs-plate{position:absolute;left:0;top:738px;width:920px;height:250px}
.vs-plate svg{position:absolute;left:0;top:0;width:920px;height:250px;overflow:visible}.s2 .vs-plate svg{transform:scaleX(-1)}
.vs-plate img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:none}
.custom-bar .vs-plate svg{display:none}.custom-bar .vs-plate img{display:block}.custom-bar.mirror .s2 .vs-plate img{transform:scaleX(-1)}
.vs-info{position:absolute;left:40px;right:40px;top:738px;height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}
.vs-team{line-height:1}.vs-team:empty{display:none}
.vs-name{white-space:nowrap;line-height:1.06;padding:0 .12em}
.vs-rec{display:none;align-items:center;gap:10px;font-family:'Chakra Petch',sans-serif}.vs-rec.on{display:flex}
.vs-rec span{display:flex;align-items:baseline;gap:6px;padding:4px 16px 2px}.vs-rec b{font:700 40px/1 'Chakra Petch',sans-serif}.vs-rec i{font:700 16px 'Chakra Petch',sans-serif;font-style:normal;letter-spacing:2px}
.vs-rec small{font:600 15px/1.1 'Chakra Petch',sans-serif;letter-spacing:2.5px;text-transform:uppercase;max-width:104px;text-align:left}
.vs-ava{position:absolute;left:330px;top:446px;width:260px;height:260px}
.vs-ava img,.vs-ava .vs-ini{position:absolute;left:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:cover}
.vs-ava img{display:none}.vs-ava.has-img img{display:block}.vs-ava.has-img .vs-ini{display:none}
.vs-ini{display:grid;place-items:center;font-size:150px;line-height:1}
.vs-art{position:absolute;left:0;top:0;width:920px;height:790px;display:none}
.vs-art img{position:absolute;left:50%;bottom:0;height:770px;width:auto;max-width:none;transform:translateX(-50%)}
.vs-side[data-pic=art] .vs-art{display:block}.vs-side[data-pic=art] .vs-ava{display:none}
.vs-mark{position:absolute;left:960px;top:470px;transform:translate(-50%,-50%);white-space:nowrap}
/* a custom name bar: the lettering takes the colours that were worked out from (or picked for) the picture, with an edge and a soft backing so it reads on any picture */
#el-vs.custom-bar .vs-name,#el-vs.custom-bar .vs-rec b,#el-vs.custom-bar .vs-rec small{background:none!important;-webkit-text-fill-color:var(--vs-ink)!important;color:var(--vs-ink)!important;filter:none!important;text-shadow:var(--vs-edge)!important;-webkit-text-stroke:0!important}
#el-vs.custom-bar .vs-team,#el-vs.custom-bar .vs-rec i{background:none!important;-webkit-text-fill-color:var(--vs-accent)!important;color:var(--vs-accent)!important;text-shadow:var(--vs-edge)!important}
#el-vs.custom-bar .vs-rec span{background:var(--vs-chip)!important;box-shadow:none!important;border:0!important;clip-path:none!important;border-radius:6px}
#el-vs.custom-bar .vs-info{isolation:isolate}
#el-vs.custom-bar.scrim .vs-info::before{content:'';position:absolute;left:2%;right:2%;top:4%;bottom:4%;background:radial-gradient(ellipse 50% 50% at center,var(--vs-scrim) 0,var(--vs-scrim) 58%,transparent 100%);z-index:-1}
/* ---- Victory Splash */
.vc-round{position:absolute;left:50%;top:112px;transform:translateX(-50%);display:flex;gap:16px;white-space:nowrap;max-width:1560px;font-size:25px;letter-spacing:6px;text-transform:uppercase;padding:10px 50px}
.vc-round .vc-event{min-width:0;overflow:hidden;text-overflow:ellipsis}.vc-round .vc-rnd{flex:none}.vc-round.vc-none{display:none}
.vc-title{position:absolute;left:0;right:0;top:180px;text-align:center;font-size:230px;line-height:1;white-space:nowrap}
.vc-title span{display:inline-block;padding:0 .08em}
.vc-card{position:absolute;left:50%;top:548px;transform:translateX(-50%);display:flex;align-items:center;gap:46px;max-width:1700px}
.vc-ava{position:relative;flex:none;width:240px;height:240px}
.vc-ava img,.vc-ava .vc-ini{position:absolute;left:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:cover}
.vc-ava img{display:none}.vc-ava.has-img img{display:block}.vc-ava.has-img .vc-ini{display:none}
.vc-ini{display:grid;place-items:center;font-size:140px;line-height:1}
.vc-info{min-width:0;display:flex;flex-direction:column;gap:8px}
.vc-team{line-height:1}.vc-team:empty{display:none}
.vc-name{white-space:nowrap;font-size:122px;line-height:1.06;padding:0 .1em 0 0}
.vc-line{display:flex;align-items:center;gap:22px;white-space:nowrap}
.vc-score{display:flex;align-items:baseline;gap:14px;padding:6px 22px 4px;font:700 54px/1 'Chakra Petch',sans-serif}.vc-score i{font-style:normal;opacity:.6}
.vc-def{font:600 26px 'Chakra Petch',sans-serif;letter-spacing:3px;text-transform:uppercase}.vc-def em{font-style:normal;font-weight:700;display:inline-block;max-width:640px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}
.vc-pic{position:absolute;left:40px;bottom:0;width:860px;height:1010px;display:none}
.vc-pic img{position:absolute;left:50%;bottom:0;height:100%;width:auto;max-width:none;transform:translateX(-50%);-webkit-mask:linear-gradient(0deg,transparent 0,#000 22%);mask:linear-gradient(0deg,transparent 0,#000 22%)}
#el-vic[data-pic=art] .vc-pic{display:block}#el-vic[data-pic=art] .vc-ava{display:none}
/* with a character image, every layout uses one arrangement: the picture on the left, the lettering in the right-hand part */
#el-vic[data-pic=art] .vc-title{left:880px!important;right:20px!important;top:170px!important;bottom:auto!important;font-size:168px!important;text-align:center!important;transform:none!important;writing-mode:horizontal-tb!important}
#el-vic[data-pic=art] .vc-card{left:1390px!important;top:520px!important;bottom:auto!important;right:auto!important;transform:translateX(-50%)!important;max-width:940px!important;flex-direction:row!important}
#el-vic[data-pic=art] .vc-round{left:1390px!important;right:auto!important;top:100px!important;max-width:960px!important;transform:translateX(-50%)!important}
#el-vic[data-pic=art] .vc-def em{max-width:440px}
#el-vic.vc-in .vc-pic{animation:vc-pic .7s .4s cubic-bezier(.2,.9,.3,1) both}@keyframes vc-pic{from{opacity:0;transform:translateX(-90px)}to{opacity:1;transform:none}}
#el-vs.vs-out,#el-vic.vc-out{animation:el-out .55s ease-in both}@keyframes el-out{to{opacity:0}}
html.sb-light .vs-cv,html.sb-light .vc-cv{display:none}
.vs-flash.go,.vc-flash.go{animation:el-flash .55s ease-out}@keyframes el-flash{0%{opacity:.85}100%{opacity:0}}
.vs-shake{animation:el-shake .4s linear}@keyframes el-shake{0%,100%{transform:none}20%{transform:translate(-7px,3px)}40%{transform:translate(7px,-3px)}60%{transform:translate(-4px,2px)}80%{transform:translate(4px,0)}}
html.sb-light .vs-shake{animation:none}
`;
  const st = document.createElement('style'); st.textContent = faces + BASE + (T.css || ''); document.head.appendChild(st);

  // ---- the scoreboard bar
  const skin = (side, pre) => `<div class="el-mir"><svg class="el-skin" viewBox="0 0 ${W} 120">${bar.skin(pre, side)}</svg><div class="el-fx">${bar.fx || ''}</div></div>`;
  const plate = n => `<div class="el-plate p${n}" id="el-p${n}">${skin(n, 'p' + n)}
  <div class="el-body"><div class="el-who"><div class="el-l1"><img class="el-flag" data-sb-src="p${n}.flagUrl" data-sb-class="none:!p${n}.flagUrl" alt=""><span class="el-team" data-sb="p${n}.team"></span><span class="el-name" data-sb="p${n}.name"></span><span class="el-ltag" data-sb-show="p${n}.loser">L</span></div>
    <div class="el-l2"><span class="el-pro" data-sb="p${n}.pronouns"></span><span class="el-st mp">Match point</span><span class="el-st dg">On the edge</span><span class="el-st fin">Final game</span><span class="el-st win">${esc(bar.winWord || 'Victory')}</span></div></div></div>
  <div class="el-score"><svg viewBox="0 0 66 50">${bar.score('s' + n)}</svg><span class="el-num" data-sb="p${n}.score"></span></div>
  <div class="el-arm"><span class="el-lbl">SET</span><div class="el-pips" id="el-pips${n}"></div></div></div>`;
  const root = document.createElement('div'); root.id = 'el'; root.className = 't-' + ID;
  root.innerHTML = `${plate(1)}<div class="el-center" id="el-c"><svg viewBox="0 0 260 64">${bar.center('c')}</svg><div class="el-cin"><div class="el-meta"><span data-sb="event"></span><span class="el-dot" data-sb-show="event">◆</span><span data-sb="bestOfText"></span></div><div class="el-round" data-sb="round"></div></div></div>${plate(2)}<canvas id="el-cv" width="1920" height="520"></canvas>`;
  document.body.appendChild(root);
  const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
  // where the bar is: the two plates (their arms are 31 high) and the centre tag. Ambient effects stay in here.
  const inBar = (x, y, r = 0) => { const top = y - r >= -40, lx = x - P1X, rx = P2X + W - x, px = lx >= 0 && lx <= W ? lx : rx >= 0 && rx <= W ? rx : -1; if (px >= 0) return top && y + r <= (px > B ? 31 : H); return x >= 830 && x <= 1090 && top && y + r <= 44; };
  const plates = { 1: $('#el-p1'), 2: $('#el-p2') }, ps = PS($('#el-cv'), { guard: inBar, maxLife: 1.25 });
  const timers = new Set(), after = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const pulse = (el, cls, ms) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_t' + cls]); el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms); };
  /** what a theme gets to work with */
  const E = {
    id: ID, root, plates, ps, rand, pick, after, pulse, W, H, B,
    x0: side => (side === 1 ? P1X : P2X),
    /** a point on a plate given in player-1 coordinates (0 = the outer end, 654 = the inner end): mirrored for player 2 */
    at: (side, x, y) => [side === 1 ? P1X + x : P2X + W - x, y],
    scoreXY: side => (side === 1 ? [P1X + B - 43, Math.round(bodyH / 2)] : [P2X + 157, Math.round(bodyH / 2)]),
    champ: 0, lost: 0, state: null,
  };

  function fit(el, max, min) { let s = max; el.style.fontSize = s + 'px'; while (el.scrollWidth > el.clientWidth + 1 && s > min) el.style.fontSize = (--s) + 'px'; }
  function fitAll() {
    $$('.el-name').forEach(el => fit(el, bar.nameSize || 36, Math.round((bar.nameSize || 36) * 0.5)));
    const r = $('.el-round'); fit(r, bar.roundSize || 22, 13);
    const m = $('.el-meta'); m.classList.remove('long'); m.style.letterSpacing = '1.7px'; fit(m, 12, 9); if (m.scrollWidth > m.clientWidth + 1) m.style.letterSpacing = '.5px'; m.classList.toggle('long', m.scrollWidth > m.clientWidth + 1);
  }
  if (document.fonts) { document.fonts.ready.then(fitAll); document.fonts.addEventListener('loadingdone', fitAll); }

  let first = true; const prev = {};
  addEventListener('scoreboard', e => {
    const s = e.detail || {}; E.state = s;
    const need = Number(s.firstTo) || 0, winner = s.p1.winner && !s.p2.winner ? 1 : s.p2.winner && !s.p1.winner ? 2 : 0;
    fitAll();
    for (const side of [1, 2]) {
      const p = s['p' + side], o = s['p' + (3 - side)], pl = plates[side];
      const pips = need > 0 && need <= 7;                   // a longer set has no room for a pip per game: the arm is left empty
      $('#el-pips' + side).innerHTML = pips ? Array.from({ length: need }, (_, i) => `<i class="el-pip${i < p.score ? ' on' : ''}"></i>`).join('') : ''; $('.el-arm', pl).classList.toggle('none', !pips);
      // a score of two digits (or a wide numeral) is brought down to fit its box
      const num = $('.el-num', pl); num.style.scale = ''; const nw = num.offsetWidth; if (nw > 52) num.style.scale = (52 / nw).toFixed(3);
      pl.classList.toggle('mp', !winner && need > 1 && p.score === need - 1);
      pl.classList.toggle('dg', !winner && need > 1 && o.score === need - 1);
      const wasChamp = pl.classList.contains('champ'), wasLost = pl.classList.contains('lost'), champ = winner === side, lost = !!winner && winner !== side;
      pl.classList.toggle('champ', champ); pl.classList.toggle('lost', lost);
      if (!first && p.score > (prev['s' + side] ?? p.score)) {
        pulse($('.el-num', pl), 'hit', 600); pulse(pl, 'scored', 900);
        const [x, y] = E.scoreXY(side); if (bar.onScore) bar.onScore(E, side, x, y, champ);
      }
      if (!first && prev['n' + side] !== p.name) pulse($('.el-name', pl), 'swap', 600);
      if (!first) {
        if (champ && !wasChamp) { pulse(pl, 'won', 1400); if (bar.onWin) bar.onWin(E, side); }
        if (lost && !wasLost) { pulse(pl, 'fell', 1400); if (bar.onLose) bar.onLose(E, side); }
        if ((wasChamp && !champ) || (wasLost && !lost)) pulse(pl, 'back', 700);
      }
      prev['s' + side] = p.score; prev['n' + side] = p.name;
    }
    E.champ = winner; E.lost = winner ? 3 - winner : 0;
    if (first) {
      first = false; root.classList.add('el-on');
      if (!window.__SB_INSTANT && !POTATO()) { root.classList.add('el-intro'); after(bar.introMs || 1600, () => root.classList.remove('el-intro')); if (bar.onIntro) bar.onIntro(E); }
    }
  });
  if (bar.tick) ps.setTick((dt, t) => bar.tick(E, dt, t));

  // ================================================================== VS Splash
  const vsT = T.vs, vs = document.createElement('div'); vs.id = 'el-vs'; vs.className = 't-' + ID;
  const vsSide = n => `<div class="vs-side s${n}"><div class="vs-art"><img alt=""></div><div class="vs-ava"><img alt=""><span class="vs-ini"></span></div><div class="vs-plate"><svg viewBox="0 0 920 250">${vsT.plate('v' + n)}</svg><img alt=""></div>
    <div class="vs-info"><div class="vs-team"></div><div class="vs-name"></div><div class="vs-rec"><span class="vs-w"><b></b><i>W</i></span><span class="vs-l"><b></b><i>L</i></span><small>This bracket</small></div></div></div>`;
  vs.innerHTML = `<div class="vs-bg"></div><div class="vs-bg2"></div><canvas class="vs-cv" width="1920" height="1080"></canvas><img class="vs-hdr" alt=""><div class="vs-round"></div>${vsSide(1)}${vsSide(2)}<div class="vs-mark">${vsT.mark || '<span>VS</span>'}</div>${vsT.extra || ''}<div class="vs-flash"></div>`;
  document.body.appendChild(vs);
  const vps = PS($('.vs-cv', vs)); let vsShown = false, vsTimers = [];
  const V = { root: vs, ps: vps, rand, pick, later: (ms, fn) => vsTimers.push(setTimeout(fn, ms)), flash: (ms = 500) => pulse($('.vs-flash', vs), 'go', ms), shake: () => pulse(vs, 'vs-shake', 420) };
  const picture = (img, src, holder, cls) => { if (src) { if (img.getAttribute('src') !== src) { holder.classList.remove(cls); img.onload = () => holder.classList.add(cls); img.onerror = () => holder.classList.remove(cls); img.src = src; } } else { holder.classList.remove(cls); img.removeAttribute('src'); } };
  function vsFit() {
    if (!vs.classList.contains('vs-show')) return;
    for (const n of [1, 2]) { const el = $(`.s${n} .vs-name`, vs); el.style.fontSize = ''; const base = parseFloat(getComputedStyle(el).fontSize) || 100; let sz = base; while (el.scrollWidth > 830 && sz > base * 0.3) { sz -= 2; el.style.fontSize = sz + 'px'; } }
  }
  function vsFill(s) {
    for (const n of [1, 2]) {
      const p = s['p' + n] || {}, el = $('.s' + n, vs), art = String(p.splashArt || '');
      $('.vs-team', el).textContent = p.team || ''; $('.vs-name', el).textContent = p.name || 'Player ' + n;
      $('.vs-ini', el).textContent = String(p.name || '?').trim().charAt(0).toUpperCase() || '?';
      picture($('.vs-ava img', el), p.pic === 'art' ? '' : (p.avatar || ''), $('.vs-ava', el), 'has-img');
      el.dataset.pic = p.pic === 'art' && art ? 'art' : ''; if (art) { const im = $('.vs-art img', el); if (im.getAttribute('src') !== art) im.src = art; }
      const w = p.wins, l = p.losses, has = w !== '' && w != null && l !== '' && l != null;
      $('.vs-rec', el).classList.toggle('on', !!has); if (has) { $('.vs-w b', el).textContent = w; $('.vs-l b', el).textContent = l; }
    }
    $('.vs-round', vs).textContent = s.round || '';
    // custom pictures (Matches tab → VS Splash): a name bar behind each player's name, and a header across the top
    const a = s.vsArt || {};
    vs.classList.toggle('custom-bar', !!a.bar); vs.classList.toggle('mirror', !!a.bar && a.mirror !== false); vs.classList.toggle('has-hdr', !!a.header); vs.classList.toggle('scrim', !!a.bar && !!a.scrim);
    if (a.bar) $$('.vs-plate img', vs).forEach(im => { if (im.getAttribute('src') !== a.bar) im.src = a.bar; });
    if (a.header) { const h = $('.vs-hdr', vs); if (h.getAttribute('src') !== a.header) h.src = a.header; }
    for (const [k, v] of [['--vs-ink', a.ink], ['--vs-accent', a.accent], ['--vs-edge', a.edge], ['--vs-scrim', a.scrimColor], ['--vs-chip', a.chip]]) { if (a.bar && v) vs.style.setProperty(k, v); else vs.style.removeProperty(k); }
    vsFit();
  }
  function vsShow(instant) {
    vsTimers.forEach(clearTimeout); vsTimers = []; vsShown = true; html.classList.add('sb-vs-on');
    vs.className = 't-' + ID + ' vs-show' + [...vs.classList].filter(c => /^(custom-bar|mirror|has-hdr|scrim)$/.test(c)).map(c => ' ' + c).join('');
    vsFit();
    if (vsT.tick) vps.setTick((dt, t) => vsT.tick(V, dt, t));
    if (instant || POTATO()) return;
    void vs.offsetWidth; vs.classList.add('vs-in');
    if (vsT.onShow) vsT.onShow(V);
    V.later(vsT.inMs || 2400, () => vs.classList.remove('vs-in'));
  }
  function vsHide(instant) {
    vsTimers.forEach(clearTimeout); vsTimers = []; vsShown = false; html.classList.remove('sb-vs-on');
    const done = () => { if (!vsShown) { vs.classList.remove('vs-show', 'vs-in', 'vs-out'); vps.setTick(null); vps.clear(); } };
    if (instant || POTATO() || !vs.classList.contains('vs-show')) return done();
    vs.classList.remove('vs-in'); vs.classList.add('vs-out'); if (vsT.onHide) vsT.onHide(V); setTimeout(done, 560);
  }

  // ================================================================== Victory Splash
  const vcT = T.vic, vc = document.createElement('div'); vc.id = 'el-vic'; vc.className = 't-' + ID;
  vc.innerHTML = `<div class="vc-bg"></div><div class="vc-bg2"></div><canvas class="vc-cv" width="1920" height="1080"></canvas><div class="vc-round"><span class="vc-event"></span><span class="vc-rnd"></span></div>
    <div class="vc-title">${vcT.title || '<span>Victory</span>'}</div><div class="vc-pic"><img alt=""></div>
    <div class="vc-card"><div class="vc-ava"><img alt=""><span class="vc-ini"></span></div><div class="vc-info"><div class="vc-team"></div><div class="vc-name"></div><div class="vc-line"><span class="vc-score"><b></b><i>–</i><b></b></span><span class="vc-def">def. <em></em></span></div></div></div>${vcT.extra || ''}<div class="vc-flash"></div>`;
  document.body.appendChild(vc);
  const cps = PS($('.vc-cv', vc)); let vcShown = 0, vcN = null, vcTimers = [];
  const C = { root: vc, ps: cps, rand, pick, later: (ms, fn) => vcTimers.push(setTimeout(fn, ms)), flash: (ms = 600) => pulse($('.vc-flash', vc), 'go', ms) };
  function vcFit() {
    if (!vc.classList.contains('vc-show')) return;
    const art = vc.dataset.pic === 'art', el = $('.vc-name', vc); el.style.fontSize = ''; const base = parseFloat(getComputedStyle(el).fontSize) || 120; let sz = base; const max = art ? 900 : (vcT.nameMax || 1180);
    while (el.scrollWidth > max && sz > base * 0.3) { sz -= 2; el.style.fontSize = sz + 'px'; }
    // with a character image the title has the right-hand part of the screen: a wide title (big letter-spacing) is brought down to fit it
    const t = $('.vc-title', vc), box = $('.vc-title span', vc); t.style.removeProperty('font-size');
    if (art && box) { let ts = parseFloat(getComputedStyle(t).fontSize) || 168; while (box.offsetWidth > 990 && ts > 70) { ts -= 4; t.style.setProperty('font-size', ts + 'px', 'important'); } }
  }
  function vcFill(s, side) {
    const p = s['p' + side] || {}, o = s['p' + (3 - side)] || {}, art = String(p.splashArt || '');
    $('.vc-team', vc).textContent = p.team || ''; $('.vc-name', vc).textContent = p.name || 'Player ' + side;
    $('.vc-ini', vc).textContent = String(p.name || '?').trim().charAt(0).toUpperCase() || '?';
    picture($('.vc-ava img', vc), p.pic === 'art' ? '' : (p.avatar || ''), $('.vc-ava', vc), 'has-img');
    vc.dataset.pic = p.pic === 'art' && art ? 'art' : ''; if (art) { const im = $('.vc-pic img', vc); if (im.getAttribute('src') !== art) im.src = art; }
    const b = $$('.vc-score b', vc); b[0].textContent = p.score; b[1].textContent = o.score; $('.vc-def em', vc).textContent = o.name || '';
    $('.vc-def', vc).style.display = o.name ? '' : 'none';
    $('.vc-event', vc).textContent = s.event || ''; $('.vc-rnd', vc).textContent = s.round || ''; $('.vc-round', vc).classList.toggle('vc-none', !s.event && !s.round);
    vcFit();
  }
  function vcShow(instant) {
    vcTimers.forEach(clearTimeout); vcTimers = []; html.classList.add('sb-victory-on');
    vc.classList.remove('vc-in', 'vc-out'); vc.classList.add('vc-show'); vcFit();
    if (vcT.tick) cps.setTick((dt, t) => vcT.tick(C, dt, t));
    if (instant || POTATO()) return;
    void vc.offsetWidth; vc.classList.add('vc-in');
    if (vcT.onShow) vcT.onShow(C);
    C.later(vcT.inMs || 2600, () => vc.classList.remove('vc-in'));
  }
  function vcHide(instant) {
    vcTimers.forEach(clearTimeout); vcTimers = []; html.classList.remove('sb-victory-on');
    const done = () => { if (!vcShown) { vc.classList.remove('vc-show', 'vc-in', 'vc-out'); cps.setTick(null); cps.clear(); } };
    if (instant || POTATO() || !vc.classList.contains('vc-show')) return done();
    vc.classList.remove('vc-in'); vc.classList.add('vc-out'); setTimeout(done, 560);
  }

  let firstSplash = true;
  addEventListener('scoreboard', e => {
    const s = e.detail || {}, v = s.victory || {}, wantVs = !!(s.vs && s.vs.show);
    vsFill(s);
    const side = Number(v.side) === 2 ? 2 : Number(v.side) === 1 ? 1 : 0, wantVc = v.show && side ? side : 0;
    if (wantVc) vcFill(s, wantVc);
    if (firstSplash) { firstSplash = false; if (wantVs) vsShow(!!window.__SB_INSTANT); if (wantVc) { vcShown = wantVc; vcShow(!!window.__SB_INSTANT); } vcN = v.n; return; }
    if (wantVs && !vsShown) vsShow(false); else if (!wantVs && vsShown) vsHide(false);
    if (wantVc && (!vcShown || wantVc !== vcShown || v.n !== vcN)) { vcShown = wantVc; vcShow(false); } else if (!wantVc && vcShown) { vcShown = 0; vcHide(false); }
    vcN = v.n;
  });
  // lettering is fitted again whenever a font arrives: a splash is often filled in before its font has loaded
  if (document.fonts) { const refit = () => { vsFit(); vcFit(); }; document.fonts.ready.then(refit); document.fonts.addEventListener('loadingdone', refit); }
  window.BeeboElemental = { id: ID, E, V, C };
})();
