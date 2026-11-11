/* BeeboScore (developed by Beebo) — elemental layouts, part 2: Royal, Crimson, Gold Rush, Sakura. See themes.js. */
(() => {
  'use strict';
  const TH = window.EL_THEMES, { W, H, A, B, R, lg, scoreBox, centerBox, vsPlate, over } = TH._;

  // =========================================================================================== ROYAL: velvet and gold
  const banner = `M0 0 ${R.sq} L0 ${H} L26 ${H / 2} Z`;
  const GOLD = ['#fff3c4', '#f5c84c', '#b8860b'], goldText = 'background:linear-gradient(180deg,#fff6d6,#f5c84c 55%,#c9961a);-webkit-background-clip:text;background-clip:text;color:transparent';
  const crown = (id, s = 1) => `<g transform="scale(${s})"><path d="M3 30 L0 8 L11 18 L22 2 L33 18 L44 8 L41 30 Z" fill="url(#${id})" stroke="#5a3a00" stroke-width="${1.4 / s}" stroke-linejoin="round"/><path d="M3 30 H41 V36 H3 Z" fill="url(#${id})" stroke="#5a3a00" stroke-width="${1.4 / s}"/><circle cx="22" cy="3" r="3.2" fill="#ff4d6d"/><circle cx="0.5" cy="8" r="2.4" fill="#7fd4ff"/><circle cx="43.5" cy="8" r="2.4" fill="#7fd4ff"/><circle cx="22" cy="33" r="2" fill="#ff4d6d"/></g>`;
  const leaf = { type: 'leaf', color: ['#fff3c4', '#f5c84c', '#d9a520'], spin: 5 };
  TH.royal = {
    fonts: [['Cinzel', 700, 'normal', 'cinzel-latin-700-normal.woff2'], ['Cinzel', 900, 'normal', 'cinzel-latin-900-normal.woff2']],
    bar: {
      shape: banner, pad: 84, nameSize: 34, roundSize: 20, introMs: 1500,
      skin: id => `<defs>${lg(id, ['#6a35ad', '#3f1773', '#260b47'])}${lg(id + 'g', GOLD)}<pattern id="${id}d" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 2 L26 14 L14 26 L2 14 Z" fill="none" stroke="rgba(245,200,76,.17)" stroke-width="1.2"/><circle cx="14" cy="14" r="1.6" fill="rgba(245,200,76,.26)"/></pattern></defs>
        <path d="${banner}" fill="url(#${id})"/><path d="${banner}" fill="url(#${id}d)"/><path d="${banner}" fill="none" stroke="url(#${id}g)" stroke-width="3"/>
        <path d="M12 6.5 L${W - 6} 6.5 M12 ${H - 6.5} L${B - 7} ${H - 6.5}" stroke="rgba(245,200,76,.55)" stroke-width="1.2"/>
        <path class="ry-gem" d="M58 22 L70 34.5 L58 47 L46 34.5 Z" fill="none" stroke="url(#${id}g)" stroke-width="2"/>
        <g class="ry-crown"><g transform="translate(36 15)">${crown(id + 'g')}</g></g>`,
      fx: '<i class="ry-sheen"></i>',
      score: scoreBox('hex', ['#fff3c4', '#f5c84c', '#c9961a'], '#5a3a00'), center: centerBox('tag', ['#6a35ad', '#260b47'], '#f5c84c', 2.5, '<path d="M8 5.5 H252" stroke="rgba(245,200,76,.5)" stroke-width="1.2"/>'),
      onIntro: E => { for (const s of [1, 2]) over(E, s, 14, { y: 10, ...leaf, speed: [20, 140], g: 160, decay: [0.5, 1], size: [3, 6] }); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y, win ? 34 : 16, { type: 'star', color: GOLD, speed: [100, 420], g: 300, size: [5, 12], decay: [0.9, 1.6] }); E.ps.burst(x, y, 10, { ...leaf, speed: [80, 300], g: 500, size: [3, 6] }); },
      onWin: (E, s) => { over(E, s, 44, { y: -4, ...leaf, dir: Math.PI / 2, spread: 1.2, speed: [40, 260], g: 220, decay: [0.4, 0.8], size: [3, 7] }); const [x, y] = E.at(s, 58, 34); E.after(520, () => E.ps.burst(x, y, 16, { type: 'star', color: GOLD, speed: [60, 260], g: 0, size: [5, 11] })); },
      onLose: (E, s) => over(E, s, 10, { y: H, type: 'dot', color: '#8a7bb0', dir: Math.PI / 2, spread: 1, speed: [10, 60], g: 80, size: [1, 2.4], decay: [0.6, 1.2] }),
      tick: (E, dt) => { const s = E.champ; if (s && Math.random() < dt * 7) over(E, s, 1, { y: -2, ...leaf, dir: Math.PI / 2, spread: 0.8, speed: [20, 70], g: 60, decay: [0.35, 0.6], size: [2.5, 5], sway: 24 }); },
    },
    vs: {
      inMs: 2600,
      plate: vsPlate('M0 0 H920 V214 L805 250 L690 214 L575 250 L460 214 L345 250 L230 214 L115 250 L0 214 Z', ['#6a35ad', '#3f1773', '#260b47'], '#f5c84c', 4,
        id => `<path d="M14 14 H906 V206 L805 236 L690 202 L575 236 L460 202 L345 236 L230 202 L115 236 L14 206 Z" fill="none" stroke="rgba(245,200,76,.5)" stroke-width="1.6"/><defs>${lg(id + 'r', GOLD)}</defs><rect x="-16" y="-10" width="952" height="20" rx="10" fill="url(#${id}r)" stroke="#5a3a00" stroke-width="2"/>`),
      mark: `<svg viewBox="0 0 260 300"><defs>${lg('rysh', ['#6a35ad', '#260b47'])}${lg('ryg', GOLD)}</defs><path d="M20 20 H240 V160 C240 230 180 270 130 290 C80 270 20 230 20 160 Z" fill="url(#rysh)" stroke="url(#ryg)" stroke-width="8"/><g transform="translate(86 -22)">${crown('ryg', 2)}</g></svg><span>VS</span>`,
      onShow: V => { V.later(700, () => { V.ps.burst(960, 470, 80, { type: 'star', color: GOLD, speed: [140, 800], g: 200, size: [6, 16], decay: [0.6, 1.2] }); V.flash(420); }); },
      tick: (V, dt) => { if (Math.random() < dt * 14) V.ps.add({ x: V.rand(0, 1920), y: -10, vx: V.rand(-20, 20), vy: V.rand(50, 130), vr: V.rand(-4, 4), type: 'leaf', color: V.pick(GOLD), size: V.rand(3, 8), decay: V.rand(0.1, 0.18), sway: 40 }); },
    },
    vic: {
      inMs: 2800,
      extra: `<svg class="ry-big" viewBox="0 0 44 38"><defs>${lg('rybg', GOLD)}</defs>${crown('rybg')}</svg>`,
      onShow: C => C.later(950, () => { C.flash(500); C.ps.burst(960, 210, 110, { type: 'star', color: GOLD, speed: [160, 900], g: 260, size: [6, 18], decay: [0.5, 1.1] }); }),
      tick: (C, dt) => { if (Math.random() < dt * 22) C.ps.add({ x: C.rand(0, 1920), y: -10, vx: C.rand(-20, 20), vy: C.rand(60, 160), vr: C.rand(-4, 4), type: 'leaf', color: C.pick(GOLD), size: C.rand(3, 9), decay: C.rand(0.1, 0.18), sway: 40 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}
.ry-crown{opacity:0;transform:translateY(-46px);transition:opacity .2s}.champ .ry-crown{opacity:1;transform:none;animation:ry-drop .7s cubic-bezier(.3,1.7,.5,1) both}
@keyframes ry-drop{from{transform:translateY(-46px)}to{transform:none}}.champ .ry-gem{opacity:0}.ry-gem{transition:opacity .2s}
.ry-sheen{position:absolute;top:0;left:-25%;width:18%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,243,196,.3),transparent);animation:ry-sheen 8s ease-in-out infinite}@keyframes ry-sheen{0%,70%{left:-25%}100%{left:120%}}
.el-name{font-family:'Cinzel',serif;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;${goldText};filter:drop-shadow(0 2px 0 #1a0633)}
.el-team{font:700 20px 'Cinzel',serif;letter-spacing:1px;color:#e2cfff;text-transform:uppercase}
.el-pro{color:#cdb8ee}.el-st{color:#ffe08a}.el-ltag{background:#f5c84c;color:#260b47}
.el-num{font:900 36px/1 'Cinzel',serif;color:#2a0d4d}.el-lbl{color:#f1e3ff}#el{--pip:#f5c84c}
.el-meta{color:#f1e3ff}.el-dot{color:#f5c84c}.el-round{font-family:'Cinzel',serif;font-weight:900;${goldText};letter-spacing:1px}
.champ .el-mir{filter:drop-shadow(0 0 14px rgba(245,200,76,.9)) brightness(1.14)}
.lost .el-mir{filter:saturate(.3) brightness(.62)}.lost .el-who{opacity:.74}
.el-intro .el-mir{animation:ry-in 1s cubic-bezier(.3,1.5,.5,1) both;transform-origin:50% 0}.el-intro .p2 .el-mir{animation-name:ry-in2}
@keyframes ry-in{from{transform:scaleY(0)}to{transform:none}}@keyframes ry-in2{from{transform:scaleX(-1) scaleY(0)}to{transform:scaleX(-1)}}
.el-intro .el-who,.el-intro .el-score{animation:ry-txt .5s .75s both}@keyframes ry-txt{from{opacity:0}to{opacity:1}}
/* VS: the banners are unfurled */
.vs-bg{background:radial-gradient(ellipse 60% 70% at 50% 40%,#5a2a96,transparent 70%),repeating-linear-gradient(90deg,#1c0836 0 60px,#240b45 60px 120px)}
.vs-bg2{background:radial-gradient(ellipse 50% 40% at 50% 0,rgba(255,243,196,.28),transparent 70%)}
.vs-round{font:700 30px 'Cinzel',serif;letter-spacing:8px;color:#fff3c4;border-top:2px solid #f5c84c;border-bottom:2px solid #f5c84c}
.vs-plate{filter:drop-shadow(0 10px 16px rgba(0,0,0,.6))}
.vs-info{top:746px;height:200px}
.vs-name{font:900 96px 'Cinzel',serif;letter-spacing:3px;text-transform:uppercase;${goldText};filter:drop-shadow(0 4px 0 #1a0633)}
.vs-team{font:700 32px 'Cinzel',serif;letter-spacing:6px;color:#e2cfff;text-transform:uppercase}
.vs-rec span{background:linear-gradient(180deg,#fff3c4,#f5c84c);border-radius:4px}.vs-rec b{color:#2a0d4d}.vs-rec i{color:#5a3a00}.vs-rec small{color:#e2cfff}
.vs-ava{border-radius:50%;background:linear-gradient(180deg,#fff3c4,#f5c84c 50%,#b8860b);box-shadow:0 0 0 4px #260b47,0 0 0 7px #f5c84c,0 10px 30px rgba(0,0,0,.6)}.vs-ava img,.vs-ini{border-radius:50%}
.vs-ini{background:radial-gradient(circle at 50% 30%,#6a35ad,#260b47);font-family:'Cinzel',serif;font-weight:900;color:#f5c84c}
.vs-art img{filter:drop-shadow(0 0 26px rgba(245,200,76,.4))}
.vs-mark svg{position:absolute;left:50%;top:50%;width:260px;height:300px;transform:translate(-50%,-50%);overflow:visible;filter:drop-shadow(0 10px 20px rgba(0,0,0,.6))}
.vs-mark span{position:relative;display:block;font:900 130px/1 'Cinzel',serif;${goldText};filter:drop-shadow(0 4px 0 #1a0633);padding-top:14px}
.vs-in .vs-side{animation:ry-fall .9s .2s cubic-bezier(.3,1.35,.5,1) both}.vs-in .vs-side.s2{animation-delay:.36s}@keyframes ry-fall{from{transform:translateY(-1100px)}to{transform:none}}
.vs-in .vs-mark{animation:ry-mk .6s .7s cubic-bezier(.2,1.5,.4,1) both}@keyframes ry-mk{from{opacity:0;transform:translate(-50%,-50%) scale(2.4)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:ry-txt .6s 1.2s both}
/* Victory: a coronation */
.vc-bg{background:radial-gradient(ellipse 70% 60% at 50% 30%,#6a35ad,#260b47 60%,#12041f)}
.vc-bg2{left:-240px;top:-900px;width:2400px;height:2400px;background:repeating-conic-gradient(from 0deg,rgba(245,200,76,.13) 0 6deg,transparent 6deg 18deg);animation:ry-rays 60s linear infinite;-webkit-mask:radial-gradient(circle,#000 10%,transparent 62%);mask:radial-gradient(circle,#000 10%,transparent 62%)}
@keyframes ry-rays{to{transform:rotate(360deg)}}
.ry-big{position:absolute;left:50%;top:92px;width:210px;height:182px;margin-left:-105px;overflow:visible;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6)) drop-shadow(0 0 30px rgba(245,200,76,.6))}
.vc-round{top:38px;font:700 24px 'Cinzel',serif;letter-spacing:8px;color:#fff3c4}
.vc-title{top:286px;font:900 170px/1 'Cinzel',serif;letter-spacing:22px;text-transform:uppercase}
.vc-title span{${goldText};filter:drop-shadow(0 6px 0 #1a0633) drop-shadow(0 0 30px rgba(245,200,76,.5))}
.vc-card{top:560px}
.vc-ava{border-radius:50%;background:linear-gradient(180deg,#fff3c4,#f5c84c 50%,#b8860b);box-shadow:0 0 0 4px #260b47,0 0 0 7px #f5c84c}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:radial-gradient(circle at 50% 30%,#6a35ad,#260b47);font-family:'Cinzel',serif;font-weight:900;color:#f5c84c}
.vc-team{font:700 32px 'Cinzel',serif;letter-spacing:6px;color:#e2cfff;text-transform:uppercase}
.vc-name{font:900 104px/1.1 'Cinzel',serif;letter-spacing:3px;text-transform:uppercase;color:#fff8e0;text-shadow:0 5px 0 #1a0633,0 0 30px rgba(245,200,76,.5)}
.vc-score{background:linear-gradient(180deg,#fff3c4,#f5c84c);color:#2a0d4d;border-radius:4px}.vc-def{color:#e2cfff}.vc-def em{color:#fff8e0}
#el-vic[data-pic=art] .ry-big{left:1390px;top:20px;width:150px;height:130px;margin-left:-75px}#el-vic[data-pic=art] .vc-round{top:160px!important}#el-vic[data-pic=art] .vc-title{top:230px!important;font-size:130px!important;letter-spacing:14px}
.vc-in .ry-big{animation:ry-crown 1s .15s cubic-bezier(.3,1.5,.5,1) both}@keyframes ry-crown{from{opacity:0;transform:translateY(-320px) rotate(-12deg)}to{opacity:1;transform:none}}
.vc-in .vc-title{animation:ry-ttl .9s .7s cubic-bezier(.2,.8,.2,1) both}@keyframes ry-ttl{from{opacity:0;transform:scale(1.5);letter-spacing:60px}to{opacity:1;transform:none}}
.vc-in .vc-card{animation:ry-card .7s 1.25s both}@keyframes ry-card{from{opacity:0;transform:translateX(-50%) translateY(50px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:ry-txt .6s 1.6s both}
`,
  };

  // =========================================================================================== CRIMSON: the blade
  const blade = `M96 0 ${R.bevel} L118 ${H} L0 ${H - 5} Z`;
  const hamon = (x0, x1, y, amp, step) => { let d = `M${x0} ${y} Q${x0 + step / 2} ${y - amp} ${x0 + step} ${y}`; for (let x = x0 + step * 2; x <= x1; x += step) d += ` T${x} ${y}`; return d; };
  const redSpark = { type: 'spark', color: ['#ffffff', '#ff6b7f', '#ff2a44'] };
  TH.crimson = {
    fonts: [['Kaushan Script', 400, 'normal', 'kaushan-script-latin-400-normal.woff2']],
    bar: {
      shape: blade, pad: 118, nameSize: 37, roundSize: 23, introMs: 1300,
      skin: id => `<defs>${lg(id, ['#515864', '#262a31', '#0e0f12'])}
        <clipPath id="${id}a"><path d="M-10 -10 L326 -10 L262 130 L-10 130 Z"/></clipPath><clipPath id="${id}b"><path d="M326 -10 L700 -10 L700 130 L262 130 Z"/></clipPath>
        <g id="${id}p"><path d="${blade}" fill="url(#${id})" stroke="#cfd4dc" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="${hamon(124, B - 4, 61, 6, 44)} L${B} ${H} L118 ${H} Z" fill="rgba(233,237,242,.14)"/><path d="${hamon(124, B - 4, 61, 6, 44)}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.2"/>
          <path d="M100 4 L${W - 4} 4" stroke="rgba(255,255,255,.3)" stroke-width="1.4"/><path d="M0 ${H - 5} L118 ${H} L${B} ${H}" fill="none" stroke="#ff2a44" stroke-width="3.2"/></g></defs>
        <g class="cr-a" clip-path="url(#${id}a)"><use href="#${id}p"/></g><g class="cr-b" clip-path="url(#${id}b)"><use href="#${id}p"/></g><path class="cr-cut" d="M326 -6 L262 ${H + 6}" stroke="#fff" stroke-width="2.5"/>`,
      fx: '<i class="cr-gleam"></i>',
      score: scoreBox('skew', ['#ae1127', '#72091a'], '#ffd9de'), center: centerBox('tag', ['#3c424c', '#0e0f12'], '#cfd4dc', 1.6, '<path d="M0 30 L14 44 L246 44 L260 30" fill="none" stroke="#ff2a44" stroke-width="3"/>'),
      onIntro: E => { for (const s of [1, 2]) { const [x, y] = E.at(s, 6, H - 4); E.after(520, () => E.ps.burst(x, y, 14, { ...redSpark, speed: [200, 700], g: 500, size: [2, 4], decay: [1.6, 3] })); } },
      onScore: (E, s, x, y, win) => { E.ps.bolt(x - 70, y - 34, x + 70, y + 34, { jag: 0, fork: 0, color: '#fff', glow: '#ff2a44', w: 3, decay: 4.5 }); E.ps.burst(x, y, win ? 40 : 20, { ...redSpark, speed: [220, 800], g: 600, size: [2, 4.5], decay: [1.2, 2.4] }); },
      onWin: (E, s) => { const [x1, y1] = E.at(s, 0, H - 4), [x2] = E.at(s, B, H); E.ps.bolt(x1, y1, x2, y1 + 2, { jag: 0, fork: 0, color: '#fff', glow: '#ff2a44', w: 4, decay: 2.2 }); for (let i = 0; i < 26; i++) { const [x, y] = E.at(s, Math.random() * B, H - 2); E.ps.burst(x, y, 1, { ...redSpark, dir: Math.PI / 2, spread: 1.6, speed: [80, 400], g: 500, size: [2, 4], decay: [1, 2] }); } },
      onLose: (E, s) => { const [x1, y1] = E.at(s, 326, -6), [x2, y2] = E.at(s, 262, H + 6); E.ps.bolt(x1, y1, x2, y2, { jag: 0, fork: 0, color: '#fff', glow: '#ff2a44', w: 3.5, decay: 3 }); E.ps.burst((x1 + x2) / 2, 34, 24, { ...redSpark, speed: [160, 700], g: 700, size: [2, 4.5] }); },
    },
    vs: {
      inMs: 2400,
      plate: vsPlate('M70 0 L920 0 L850 250 L0 250 Z', ['#515864', '#262a31', '#0e0f12'], '#cfd4dc', 2.5, `<path d="${hamon(40, 800, 196, 22, 110)} L850 250 L0 250 Z" fill="rgba(233,237,242,.1)"/><path d="${hamon(40, 800, 196, 22, 110)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/><path d="M0 250 L850 250" stroke="#ff2a44" stroke-width="7"/>`),
      mark: '<i></i><span>VS</span>',
      onShow: V => V.later(640, () => { V.flash(380); V.shake(); V.ps.bolt(700, 210, 1220, 730, { jag: 0, fork: 0, color: '#fff', glow: '#ff2a44', w: 6, decay: 2.4 }); V.ps.burst(960, 470, 120, { ...redSpark, speed: [300, 1500], g: 700, size: [2.5, 6], decay: [0.9, 1.9] }); }),
      tick: (V, dt) => { if (Math.random() < dt * 9) V.ps.add({ x: V.rand(0, 1920), y: 1090, vx: V.rand(-30, 30), vy: -V.rand(80, 240), type: 'dot', color: V.pick(['#ff2a44', '#ff6b7f']), size: V.rand(1.2, 3.2), decay: V.rand(0.25, 0.5), sway: 30 }); },
    },
    vic: {
      inMs: 2500,
      extra: '<i class="cr-line"></i>',
      onShow: C => { C.later(240, () => { C.flash(380); C.ps.bolt(-40, 760, 1960, 300, { jag: 0, fork: 0, color: '#fff', glow: '#ff2a44', w: 7, decay: 1.6 }); for (let i = 0; i < 70; i++) { const k = Math.random(); C.ps.burst(k * 1920, 760 - k * 460, 1, { ...redSpark, speed: [120, 900], g: 600, size: [2.5, 6], decay: [0.7, 1.6] }); } }); },
      tick: (C, dt) => { if (Math.random() < dt * 10) C.ps.add({ x: C.rand(0, 1920), y: 1090, vx: C.rand(-30, 30), vy: -C.rand(80, 240), type: 'dot', color: C.pick(['#ff2a44', '#ff6b7f', '#fff']), size: C.rand(1.2, 3.2), decay: C.rand(0.25, 0.5), sway: 30 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 3px 5px rgba(0,0,0,.65))}
.cr-a,.cr-b{transition:transform .5s cubic-bezier(.2,.9,.3,1)}.cr-cut{opacity:0}
.lost .cr-a{transform:translate(-5px,4px)}.lost .cr-b{transform:translate(3px,-1px)}.lost .cr-cut{opacity:.55;stroke:#ff2a44;stroke-width:1.6}.fell .cr-cut{animation:cr-cut .7s both}@keyframes cr-cut{0%{opacity:1;stroke:#fff;stroke-width:5}100%{opacity:.55}}
.cr-gleam{position:absolute;top:0;left:-20%;width:9%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-24deg);animation:cr-gleam 5.5s cubic-bezier(.6,0,.2,1) infinite}@keyframes cr-gleam{0%,74%{left:-20%}100%{left:112%}}
.lost .cr-gleam{display:none}
.el-name{font-family:'Kaushan Script',cursive;color:#fff;letter-spacing:.5px;text-shadow:0 2px 0 #7d0a1a,0 0 14px rgba(255,42,68,.55)}
.el-team{font:400 22px 'Kaushan Script',cursive;color:#ff8494}
.el-pro{color:#b8bec8}.el-st{color:#ff8494}.el-ltag{background:#e01e37;color:#fff}
.el-num{font:italic 800 42px/1 'Saira Condensed',sans-serif;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5)}.el-lbl{color:#e9edf2}#el{--pip:#ff4a60}
.el-meta{color:#e9edf2}.el-dot{color:#ff4a60}.el-round{font-family:'Kaushan Script',cursive;color:#fff;text-transform:none;text-shadow:0 2px 0 #7d0a1a}
.champ .el-mir{filter:drop-shadow(0 0 14px rgba(255,42,68,.95)) brightness(1.25)}
.lost .el-mir{filter:saturate(.15) brightness(.6)}.lost .el-who{opacity:.76}
.el-intro .p1 .el-mir{animation:cr-in1 .55s cubic-bezier(.1,.9,.2,1) both}.el-intro .p2 .el-mir{animation:cr-in2 .55s cubic-bezier(.1,.9,.2,1) both}
@keyframes cr-in1{from{transform:translateX(900px);opacity:0}to{transform:none;opacity:1}}@keyframes cr-in2{from{transform:scaleX(-1) translateX(900px);opacity:0}to{transform:scaleX(-1);opacity:1}}
.el-intro .el-who,.el-intro .el-score{animation:cr-txt .35s .55s both}@keyframes cr-txt{from{opacity:0;transform:skewX(-20deg) translateX(-20px)}to{opacity:1}}
/* VS: two blades meet */
.vs-bg{background:radial-gradient(circle 430px at 50% 43.5%,#e01e37 0 99%,transparent 100%),linear-gradient(180deg,#0b0c0f,#1a1c21)}
.vs-bg2{background:repeating-linear-gradient(-24deg,transparent 0 90px,rgba(255,255,255,.025) 90px 92px)}
.vs-round{font:400 38px 'Kaushan Script',cursive;letter-spacing:2px;color:#fff;text-transform:none;text-shadow:0 3px 0 #7d0a1a;top:52px}
.vs-plate{filter:drop-shadow(0 8px 14px rgba(0,0,0,.7))}
.vs-name{font:400 104px 'Kaushan Script',cursive;color:#fff;text-shadow:0 5px 0 #7d0a1a,0 0 24px rgba(255,42,68,.6)}
.vs-team{font:400 36px 'Kaushan Script',cursive;color:#ff8494}
.vs-rec span{background:#c4142c;transform:skewX(-10deg)}.vs-rec b{color:#fff}.vs-rec i{color:#ffd9de}.vs-rec small{color:#cfd4dc}
.vs-ava{background:linear-gradient(180deg,#e9edf2,#7c838f);transform:rotate(45deg) scale(.78);overflow:hidden;box-shadow:0 0 0 5px #0e0f12,0 0 0 9px #e01e37}
.vs-ini{background:linear-gradient(135deg,#262a31,#0e0f12);color:#fff;font-family:'Kaushan Script',cursive}
.vs-ava .vs-ini{font-size:150px}.vs-ava .vs-ini,.vs-ava img{transform:rotate(-45deg) scale(1.42)}
.vs-art img{filter:drop-shadow(0 0 0 #000) drop-shadow(14px 0 0 rgba(224,30,55,.5))}
.vs-mark i{position:absolute;left:50%;top:50%;width:560px;height:10px;margin:-5px 0 0 -280px;background:linear-gradient(90deg,transparent,#fff 20%,#fff 80%,transparent);transform:rotate(-58deg);box-shadow:0 0 22px #ff2a44}
.vs-mark span{position:relative;display:block;font:400 220px/1 'Kaushan Script',cursive;color:#fff;text-shadow:0 8px 0 #0b0c0f,0 0 40px rgba(0,0,0,.6);padding:0 30px}
.vs-in .vs-side.s1{animation:cr-s1 .5s .2s cubic-bezier(.1,.9,.2,1) both}.vs-in .vs-side.s2{animation:cr-s2 .5s .2s cubic-bezier(.1,.9,.2,1) both}
@keyframes cr-s1{from{transform:translateX(-1100px)}to{transform:none}}@keyframes cr-s2{from{transform:translateX(1100px)}to{transform:none}}
.vs-in .vs-bg{animation:cr-sun .8s cubic-bezier(.2,.9,.3,1) both}@keyframes cr-sun{from{background-size:100% 100%;filter:brightness(0)}to{filter:none}}
.vs-in .vs-mark{animation:cr-mk .35s .62s cubic-bezier(.2,1.5,.4,1) both}@keyframes cr-mk{from{opacity:0;transform:translate(-50%,-50%) scale(3) rotate(8deg)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:cr-txt .4s 1s both}
/* Victory: one cut */
.vc-bg{background:linear-gradient(180deg,#0b0c0f,#1a1c21)}
.vc-bg2{background:linear-gradient(180deg,#e01e37,#9c1024);clip-path:polygon(0 760px,1920px 300px,1920px 0,0 0)}
.cr-line{position:absolute;left:-40px;top:526px;width:2000px;height:8px;background:#fff;transform:rotate(-13.47deg);box-shadow:0 0 26px #fff}
.vc-round{left:auto;right:90px;top:56px;transform:none;padding:0;font:400 34px 'Kaushan Script',cursive;letter-spacing:1px;text-transform:none;color:#fff;text-shadow:0 2px 0 #7d0a1a}
.vc-title{left:80px;right:auto;top:130px;text-align:left;font:400 270px/1 'Kaushan Script',cursive;transform:rotate(-13.47deg);transform-origin:0 100%}
.vc-title span{color:#fff;text-shadow:0 10px 0 #0b0c0f;padding:0 .2em 0 .05em}
.vc-card{left:auto;right:110px;top:690px;transform:none}
.vc-ava{background:linear-gradient(180deg,#e9edf2,#7c838f);box-shadow:0 0 0 5px #0e0f12,0 0 0 9px #e01e37}
.vc-ini{background:linear-gradient(180deg,#262a31,#0e0f12);color:#fff;font-family:'Kaushan Script',cursive}
.vc-team{font:400 38px 'Kaushan Script',cursive;color:#ff8494}
.vc-name{font:400 118px/1.1 'Kaushan Script',cursive;color:#fff;text-shadow:0 5px 0 #7d0a1a,0 0 24px rgba(255,42,68,.5)}
.vc-score{background:#c4142c;color:#fff;transform:skewX(-10deg)}.vc-def{color:#cfd4dc}.vc-def em{color:#fff}
.vc-in .vc-bg2{animation:cr-split .5s .28s cubic-bezier(.2,.9,.3,1) both}@keyframes cr-split{from{transform:translateY(-1100px)}to{transform:none}}
.vc-in .cr-line{animation:cr-ln .3s .1s both}@keyframes cr-ln{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
.vc-in .vc-title{animation:cr-ttl .45s .5s cubic-bezier(.1,.9,.2,1) both}@keyframes cr-ttl{from{opacity:0;transform:rotate(-13.47deg) translateX(-700px)}to{opacity:1;transform:rotate(-13.47deg)}}
.vc-in .vc-card{animation:cr-card .5s .85s cubic-bezier(.1,.9,.2,1) both}@keyframes cr-card{from{opacity:0;transform:translateX(500px)}to{opacity:1;transform:none}}.vc-in .vc-round{animation:cr-txt .4s 1.2s both}
`,
  };

  // =========================================================================================== GOLD RUSH: bullion
  const ingot = `M26 0 L${W - 10} 0 L${W} ${A} L${B + 8} ${A} L${B} ${H} L0 ${H} Z`;
  const BULL = ['#fff3b0', '#ffd75e', '#e2a41c', '#a86f06'], coin = { type: 'coin', color: ['#ffd75e', '#ffe89a', '#f2b632'], spin: 7 };
  const goldFace = 'background:linear-gradient(180deg,#fff7c9,#ffd75e 48%,#e2a41c 52%,#fff0a3);-webkit-background-clip:text;background-clip:text;color:transparent';
  TH.goldrush = {
    fonts: [['Alfa Slab One', 400, 'normal', 'alfa-slab-one-latin-400-normal.woff2']],
    bar: {
      shape: ingot, pad: 90, nameSize: 33, roundSize: 20, introMs: 1300,
      skin: id => `<defs>${lg(id, BULL)}</defs><path d="${ingot}" fill="url(#${id})" stroke="#6b4703" stroke-width="2" stroke-linejoin="round"/>
        <path d="M30 5 L${W - 13} 5 L${W - 6} ${A - 5} L${B + 4} ${A - 5}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2"/><path d="M30 5 L8 ${H - 5}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
        <path d="M8 ${H - 5} L${B - 5} ${H - 5} L${B + 3} ${A - 4}" fill="none" stroke="rgba(107,71,3,.5)" stroke-width="2"/>
        <g class="gr-mark" fill="none" stroke="rgba(74,46,0,.55)" stroke-width="1.6"><circle cx="62" cy="34.5" r="17"/><path d="M62 24 L71 34.5 L62 45 L53 34.5 Z"/></g>`,
      fx: '<i class="gr-shine"></i>',
      score: scoreBox('box', ['#2e1d03', '#140c01'], '#fff0a3', 2.5), center: centerBox('slab', BULL, '#6b4703', 2, '<path d="M4 4.5 H256" stroke="rgba(255,255,255,.75)" stroke-width="2"/><path d="M4 40 H256" stroke="rgba(107,71,3,.5)" stroke-width="2"/>'),
      onIntro: E => { for (const s of [1, 2]) E.after(420, () => over(E, s, 18, { y: H, type: 'dot', color: ['#ffe89a', '#d9c9a0'], dir: Math.PI / 2, spread: 2.6, speed: [40, 260], g: 200, size: [1.2, 3], decay: [1.2, 2.2] })); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y, win ? 34 : 14, { ...coin, dir: -Math.PI / 2, spread: 2.2, speed: [260, 700], g: 1500, size: [6, 10], decay: [0.6, 1] }); E.ps.burst(x, y, 10, { type: 'star', color: '#fff7c9', speed: [80, 300], g: 0, size: [5, 12] }); },
      onWin: (E, s) => over(E, s, 46, { y: -10, ...coin, dir: Math.PI / 2, spread: 0.7, speed: [100, 500], g: 1300, size: [6, 11], decay: [0.45, 0.8] }),
      onLose: (E, s) => over(E, s, 12, { y: H, type: 'dot', color: '#8d8a80', dir: Math.PI / 2, spread: 1.4, speed: [20, 120], g: 300, size: [1.5, 3], decay: [0.9, 1.6] }),
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 7 : 1.3)) { const [x, y] = E.at(s, 20 + Math.random() * (B - 30), 4 + Math.random() * 10); E.ps.add({ x, y, type: 'star', color: '#fffbe0', size: E.rand(6, 13), decay: E.rand(1.6, 2.6) }); } },
    },
    vs: {
      inMs: 2700,
      plate: vsPlate('M46 0 L874 0 L920 250 L0 250 Z', BULL, '#6b4703', 4, '<path d="M54 12 L866 12 L904 236" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="4"/><path d="M54 12 L16 236 L904 236" fill="none" stroke="rgba(107,71,3,.45)" stroke-width="4"/>'),
      mark: '<i></i><span>VS</span>',
      extra: '<div class="gr-door l"><i></i></div><div class="gr-door r"><i></i></div>',
      onShow: V => { V.later(360, () => V.shake()); V.later(1250, () => { V.flash(420); V.ps.burst(960, 470, 90, { ...coin, speed: [300, 1300], g: 1500, size: [8, 16], decay: [0.45, 0.8] }); }); },
      tick: (V, dt) => { if (Math.random() < dt * 13) V.ps.add({ x: V.rand(0, 1920), y: -20, vy: V.rand(260, 520), g: 500, vr: V.rand(-7, 7), type: 'coin', color: V.pick(coin.color), size: V.rand(7, 14), decay: 0.4 }); },
    },
    vic: {
      inMs: 2600,
      onShow: C => { for (const t of [300, 700, 1100, 1600]) C.later(t, () => C.ps.burst(960, 1100, 70, { ...coin, dir: -Math.PI / 2, spread: 1.1, speed: [900, 1900], g: 1500, size: [8, 17], decay: [0.3, 0.5] })); C.later(300, () => C.flash(500)); },
      tick: (C, dt) => { if (Math.random() < dt * 16) C.ps.add({ x: C.rand(0, 1920), y: -20, vy: C.rand(260, 520), g: 500, vr: C.rand(-7, 7), type: 'coin', color: C.pick(coin.color), size: C.rand(7, 15), decay: 0.4 }); if (Math.random() < dt * 8) C.ps.add({ x: C.rand(300, 1620), y: C.rand(180, 520), type: 'star', color: '#fffbe0', size: C.rand(10, 26), decay: C.rand(1.2, 2.2) }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 4px 5px rgba(0,0,0,.6))}
.gr-shine{position:absolute;top:0;left:-30%;width:24%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.8),transparent);animation:gr-shine 6s ease-in-out infinite}@keyframes gr-shine{0%,70%{left:-30%}100%{left:120%}}
.lost .gr-shine{display:none}
.el-name{font-family:'Alfa Slab One',serif;letter-spacing:1px;text-transform:uppercase;color:#2b1b02;text-shadow:0 1.5px 0 rgba(255,247,201,.75)}
.el-team{font:400 19px 'Alfa Slab One',serif;color:#6b4300;text-transform:uppercase;text-shadow:0 1px 0 rgba(255,247,201,.6)}
.el-pro{color:#553600}.el-st{color:#5a1d00}.el-ltag{background:#2b1b02;color:#ffd75e}
.el-num{font:400 34px/1 'Alfa Slab One',serif;color:#ffe28a}.el-lbl{color:#2b1b02}#el{--pip:#2b1b02}.el-pip{transform:none;border-radius:50%}
.el-meta{color:#3d2700}.el-dot{color:#8a5a00}.el-round{font-family:'Alfa Slab One',serif;color:#2b1b02;letter-spacing:.5px;text-shadow:0 1px 0 rgba(255,247,201,.7)}
.champ .el-mir{filter:drop-shadow(0 0 16px rgba(255,215,94,.95)) brightness(1.1)}
.lost .el-mir{filter:grayscale(1) brightness(.62) contrast(.9)}.lost .el-who{opacity:.85}
.el-intro .el-mir{animation:gr-in .5s cubic-bezier(.5,0,.9,.6) both}.el-intro .p2 .el-mir{animation-name:gr-in2;animation-delay:.12s}
@keyframes gr-in{0%{transform:translateY(-140px)}80%{transform:translateY(0)}90%{transform:translateY(-7px)}100%{transform:none}}@keyframes gr-in2{0%{transform:scaleX(-1) translateY(-140px)}80%{transform:scaleX(-1) translateY(0)}90%{transform:scaleX(-1) translateY(-7px)}100%{transform:scaleX(-1)}}
.el-intro .el-who,.el-intro .el-score,.el-intro .el-arm{animation:gr-txt .3s .62s both}@keyframes gr-txt{from{opacity:0}to{opacity:1}}
/* VS: the vault opens */
.vs-bg{background:radial-gradient(ellipse 60% 55% at 50% 44%,#b47a09,#3a2603 55%,#120b01 80%)}
.vs-bg2{background:repeating-conic-gradient(from 0deg at 50% 43.5%,rgba(255,231,150,.1) 0 5deg,transparent 5deg 15deg);animation:gr-rays 80s linear infinite;transform-origin:50% 43.5%}@keyframes gr-rays{to{transform:rotate(360deg)}}
.gr-door{position:absolute;top:0;width:960px;height:1080px;background:repeating-linear-gradient(0deg,#3b3f47 0 134px,#2a2d33 134px 135px),#33363d;visibility:hidden}
.gr-door.l{left:0;border-right:10px solid #17181c}.gr-door.r{left:960px;border-left:10px solid #17181c}
.gr-door i{position:absolute;top:400px;width:280px;height:280px;border-radius:50%;border:26px solid #c9961a;background:radial-gradient(circle,#55585f 30%,#2a2d33 32%);box-shadow:0 0 0 6px #17181c,inset 0 0 0 6px #17181c}.gr-door.l i{right:-150px;clip-path:inset(0 150px 0 0)}.gr-door.r i{left:-150px;clip-path:inset(0 0 0 150px)}
.vs-in .gr-door{visibility:visible}.vs-in .gr-door.l{animation:gr-dl 1s .45s cubic-bezier(.7,0,.3,1) both}.vs-in .gr-door.r{animation:gr-dr 1s .45s cubic-bezier(.7,0,.3,1) both}
@keyframes gr-dl{to{transform:translateX(-100%)}}@keyframes gr-dr{to{transform:translateX(100%)}}
.vs-round{font:400 30px 'Alfa Slab One',serif;letter-spacing:5px;color:#2b1b02;background:linear-gradient(180deg,#fff3b0,#ffd75e 50%,#e2a41c);border:3px solid #6b4703;padding:8px 44px}
.vs-plate{filter:drop-shadow(0 10px 16px rgba(0,0,0,.65))}
.vs-name{font:400 92px 'Alfa Slab One',serif;letter-spacing:2px;text-transform:uppercase;color:#2b1b02;text-shadow:0 3px 0 rgba(255,247,201,.75)}
.vs-team{font:400 30px 'Alfa Slab One',serif;letter-spacing:3px;color:#6b4300;text-transform:uppercase}
.vs-rec span{background:#2b1b02;border-radius:4px}.vs-rec b{color:#ffe28a}.vs-rec i{color:#e2a41c}.vs-rec small{color:#3d2700}
.vs-ava{border-radius:50%;background:linear-gradient(180deg,#fff3b0,#ffd75e 45%,#a86f06);box-shadow:0 0 0 5px #2b1b02,0 0 40px rgba(255,215,94,.7)}.vs-ava img,.vs-ini{border-radius:50%}
.vs-ini{background:radial-gradient(circle at 40% 30%,#4a3206,#140c01);color:#ffd75e;font-family:'Alfa Slab One',serif;font-size:130px}
.vs-art img{filter:drop-shadow(0 0 30px rgba(255,215,94,.5))}
.vs-mark i{position:absolute;left:50%;top:50%;width:290px;height:290px;margin:-145px 0 0 -145px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#fff7c9,#ffd75e 40%,#c98f12 75%,#8a5a00);box-shadow:0 0 0 8px #6b4703,inset 0 0 0 14px rgba(255,255,255,.25),inset 0 0 0 18px rgba(107,71,3,.5),0 0 60px rgba(255,215,94,.7)}
.vs-mark span{position:relative;display:block;font:400 130px/1 'Alfa Slab One',serif;color:#2b1b02;text-shadow:0 3px 0 rgba(255,247,201,.8)}
.vs-in .vs-side,.vs-in .vs-round{animation:gr-txt .01s .45s both}
.vs-in .vs-mark{animation:gr-mk .7s 1.2s cubic-bezier(.2,1.6,.4,1) both}@keyframes gr-mk{from{opacity:0;transform:translate(-50%,-50%) scale(.1) rotateY(540deg)}to{opacity:1;transform:translate(-50%,-50%)}}
/* Victory: jackpot */
.vc-bg{background:radial-gradient(ellipse 70% 60% at 50% 36%,#c98f12,#4a3206 55%,#120b01 82%)}
.vc-bg2{left:-240px;top:-820px;width:2400px;height:2400px;background:repeating-conic-gradient(from 0deg,rgba(255,231,150,.16) 0 5deg,transparent 5deg 15deg);animation:gr-rays 50s linear infinite;transform-origin:50% 50%}
.vc-round{top:92px;font:400 26px 'Alfa Slab One',serif;letter-spacing:5px;color:#2b1b02;background:linear-gradient(180deg,#fff3b0,#ffd75e 50%,#e2a41c);border:3px solid #6b4703;padding:8px 44px}
.vc-title{top:190px;font:400 220px/1 'Alfa Slab One',serif;letter-spacing:6px;text-transform:uppercase}
.vc-title span{${goldFace};filter:drop-shadow(0 4px 0 #6b4703) drop-shadow(0 10px 0 #2b1b02) drop-shadow(0 0 40px rgba(255,215,94,.6))}
.vc-card{top:560px}
.vc-ava{border-radius:50%;background:linear-gradient(180deg,#fff3b0,#ffd75e 45%,#a86f06);box-shadow:0 0 0 5px #2b1b02,0 0 40px rgba(255,215,94,.7)}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:radial-gradient(circle at 40% 30%,#4a3206,#140c01);color:#ffd75e;font-family:'Alfa Slab One',serif}
.vc-team{font:400 32px 'Alfa Slab One',serif;letter-spacing:3px;color:#ffe89a;text-transform:uppercase}
.vc-name{font:400 104px/1.1 'Alfa Slab One',serif;letter-spacing:2px;text-transform:uppercase;color:#fff7c9;text-shadow:0 5px 0 #6b4703,0 10px 0 #2b1b02}
.vc-score{background:#2b1b02;color:#ffe28a;border:3px solid #ffd75e;border-radius:6px}.vc-def{color:#ffe89a}.vc-def em{color:#fff7c9}
.vc-in .vc-title{animation:gr-ttl .7s .25s cubic-bezier(.3,1.6,.5,1) both}@keyframes gr-ttl{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
.vc-in .vc-card{animation:gr-card .6s .9s cubic-bezier(.3,1.4,.5,1) both}@keyframes gr-card{from{opacity:0;transform:translateX(-50%) translateY(140px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:gr-txt .5s 1.3s both}
`,
  };

  // =========================================================================================== SAKURA: paper and petals
  const petalShape = `M0 ${H} C0 26 30 0 84 0 ${R.rnd} Z`;
  const PET = ['#ffffff', '#ffd3df', '#ff9dbb', '#ff7fa8'], pet = { type: 'petal', color: PET, spin: 4 };
  const blossom = (x, y, r, c = '#ff9dbb') => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.42}" ry="${r * 0.62}" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="${r * 0.2}" fill="#b0305e"/></g>`;
  TH.sakura = {
    fonts: [['Playfair Display', 800, 'italic', 'playfair-display-latin-800-italic.woff2'], ['Playfair Display', 700, 'normal', 'playfair-display-latin-700-normal.woff2']],
    bar: {
      shape: petalShape, pad: 116, nameSize: 37, roundSize: 22, introMs: 1700,
      skin: id => `<defs>${lg(id, ['#fffdfd', '#ffeef3', '#ffd9e4'])}</defs><path d="${petalShape}" fill="url(#${id})" stroke="#ff8fb1" stroke-width="2" stroke-linejoin="round"/>
        <path d="M6 ${H - 4} C30 44 60 30 108 26 M48 36 C52 26 60 18 72 12" fill="none" stroke="#5c2a3c" stroke-width="2.6" stroke-linecap="round"/>
        <g class="sk-bloom">${blossom(40, 44, 10)}${blossom(74, 12, 7, '#ffb7cc')}${blossom(98, 27, 9)}</g>
        <path d="M130 ${H - 5} H${B - 12}" stroke="rgba(255,143,177,.6)" stroke-width="1.2" stroke-dasharray="2 5" stroke-linecap="round"/>`,
      score: scoreBox('circ', ['#6a2445', '#3a1026'], '#ff9dbb', 2.5), center: centerBox('scal', ['#fffdfd', '#ffe3eb'], '#ff8fb1', 2),
      onIntro: E => { for (const s of [1, 2]) over(E, s, 22, { y: 30, ...pet, dir: 0.5, spread: 1.4, speed: [60, 300], g: 110, drag: 0.97, decay: [0.4, 0.8], size: [4, 8], sway: 40 }); },
      onScore: (E, s, x, y, win) => E.ps.burst(x, y, win ? 46 : 22, { ...pet, speed: [90, 420], g: 260, drag: 0.95, size: [4, 9], decay: [0.6, 1.1], sway: 30 }),
      onWin: (E, s) => over(E, s, 60, { y: 20, ...pet, speed: [60, 380], g: 120, drag: 0.96, decay: [0.3, 0.7], size: [4, 9], sway: 50 }),
      onLose: (E, s) => over(E, s, 16, { y: H - 6, type: 'petal', color: ['#cbbfc3', '#b3a4aa'], spin: 3, dir: Math.PI / 2, spread: 1, speed: [20, 110], g: 130, decay: [0.5, 0.9], size: [4, 7], sway: 30 }),
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 7 : 1.3)) { const [x, y] = E.at(s, 20 + Math.random() * 110, 10 + Math.random() * 30); E.ps.add({ x, y, vx: E.rand(40, 110) * (s === 1 ? 1 : -1), vy: E.rand(2, 9), vr: E.rand(-3, 3), type: 'petal', color: E.pick(PET), size: E.rand(3, 5), decay: E.rand(0.35, 0.6), sway: 10, a: 0.9 }); } },
    },
    vs: {
      inMs: 2800,
      plate: vsPlate('M0 250 C0 110 80 0 250 0 L880 0 Q920 0 920 40 L920 210 Q920 250 880 250 Z', ['#fffdfd', '#ffeef3', '#ffd9e4'], '#ff8fb1', 4, '<path d="M150 226 H860" stroke="rgba(255,143,177,.7)" stroke-width="2.5" stroke-dasharray="3 9" stroke-linecap="round"/>'),
      mark: '<i></i><span>vs</span>',
      extra: `<svg class="sk-branch" viewBox="0 0 700 420"><path d="M700 0 C560 60 470 70 380 150 C320 204 250 220 150 230 M470 96 C440 150 430 200 440 270 M380 150 C330 130 290 96 270 50" fill="none" stroke="#5c2a3c" stroke-width="13" stroke-linecap="round"/>${[[150, 230, 34], [270, 50, 30], [440, 270, 36], [330, 190, 26], [520, 80, 30], [600, 44, 24], [420, 120, 22]].map(([x, y, r], i) => blossom(x, y, r, i % 2 ? '#ffb7cc' : '#ff9dbb')).join('')}</svg>`,
      onShow: V => { V.ps.burst(-60, 300, 240, { ...pet, dir: 0.25, spread: 0.9, ry: 420, speed: [500, 1700], g: 60, drag: 0.985, decay: [0.3, 0.6], size: [6, 16], sway: 80 }); },
      tick: (V, dt) => { if (Math.random() < dt * 20) V.ps.add({ x: V.rand(-100, 1700), y: -20, vx: V.rand(40, 150), vy: V.rand(60, 160), vr: V.rand(-3, 3), type: 'petal', color: V.pick(PET), size: V.rand(5, 13), decay: V.rand(0.09, 0.16), sway: 60 }); },
    },
    vic: {
      inMs: 3000, nameMax: 1100,
      extra: `<svg class="sk-branch v" viewBox="0 0 700 420"><path d="M700 0 C560 60 470 70 380 150 C320 204 250 220 150 230 M470 96 C440 150 430 200 440 270 M380 150 C330 130 290 96 270 50" fill="none" stroke="#5c2a3c" stroke-width="13" stroke-linecap="round"/>${[[150, 230, 34], [270, 50, 30], [440, 270, 36], [330, 190, 26], [520, 80, 30], [600, 44, 24], [420, 120, 22]].map(([x, y, r], i) => blossom(x, y, r, i % 2 ? '#ffb7cc' : '#ff9dbb')).join('')}</svg>`,
      onShow: C => C.ps.burst(1500, 260, 160, { ...pet, rx: 300, ry: 200, dir: 2.6, spread: 1.6, speed: [80, 700], g: 90, drag: 0.98, decay: [0.25, 0.5], size: [6, 15], sway: 70 }),
      tick: (C, dt) => { if (Math.random() < dt * 22) C.ps.add({ x: C.rand(200, 2000), y: -20, vx: -C.rand(30, 140), vy: C.rand(60, 160), vr: C.rand(-3, 3), type: 'petal', color: C.pick(PET), size: C.rand(5, 13), decay: C.rand(0.09, 0.16), sway: 60 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 3px 5px rgba(74,24,48,.45))}
.sk-bloom>g{transform-box:fill-box;transform-origin:center}
.champ .sk-bloom>g{animation:sk-bloom 1.6s ease-in-out infinite alternate}@keyframes sk-bloom{from{scale:1}to{scale:1.25}}
.lost .sk-bloom{opacity:.25;transition:opacity .8s}
.el-name{font-family:'Playfair Display',serif;font-weight:800;font-style:italic;color:#4a1830}
.el-team{font:700 20px 'Playfair Display',serif;color:#b0305e}
.el-pro{color:#7a4a5c}.el-st{color:#b0305e}.el-ltag{background:#4a1830;color:#ffeef3}
.el-l2{font-size:12px;letter-spacing:2px}
.el-num{font:700 34px/1 'Playfair Display',serif;color:#fff;padding-bottom:3px}.el-lbl{color:#4a1830}#el{--pip:#d6336c}.el-pip{transform:none;border-radius:50% 0 50% 0}
.el-meta{color:#7a2848}.el-dot{color:#ff8fb1}.el-round{font-family:'Playfair Display',serif;font-weight:800;font-style:italic;color:#4a1830;text-transform:none}
.champ .el-mir{filter:drop-shadow(0 0 14px rgba(255,127,168,.95)) drop-shadow(0 0 3px #fff)}
.lost .el-mir{filter:saturate(.18) brightness(.82)}.lost .el-who{opacity:.72}
.el-intro .el-mir{animation:sk-in 1.3s cubic-bezier(.2,.8,.2,1) both}.el-intro .p2 .el-mir{animation-name:sk-in2}
@keyframes sk-in{from{opacity:0;clip-path:inset(0 0 0 100%)}to{opacity:1;clip-path:inset(-20px)}}@keyframes sk-in2{from{opacity:0;clip-path:inset(0 0 0 100%)}to{opacity:1;clip-path:inset(-20px)}}
.el-intro .el-who,.el-intro .el-score{animation:sk-txt .7s .8s both}@keyframes sk-txt{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
/* VS: a petal storm on a pale morning */
.vs-bg{background:radial-gradient(circle 300px at 50% 43.5%,#ff6f9c 0 99%,transparent 100%),linear-gradient(180deg,#fff7f3,#ffe3ea 55%,#ffc9d8)}
.vs-bg2{background:radial-gradient(circle 460px at 50% 43.5%,rgba(255,157,187,.35),transparent 70%)}
.sk-branch{position:absolute;right:-20px;top:-10px;width:700px;height:420px;overflow:visible}.has-hdr .sk-branch:not(.v){display:none}
.vs-round{font:italic 800 34px 'Playfair Display',serif;letter-spacing:3px;text-transform:none;color:#4a1830;border-bottom:2px solid #ff8fb1;padding:6px 30px}
.vs-plate{filter:drop-shadow(0 10px 14px rgba(74,24,48,.3))}.s2 .vs-plate svg{transform:scaleX(-1)}
.vs-name{font:italic 800 100px 'Playfair Display',serif;color:#4a1830}
.vs-team{font:700 32px 'Playfair Display',serif;letter-spacing:4px;color:#b0305e;text-transform:uppercase}
.vs-rec span{background:#4a1830;border-radius:30px}.vs-rec b{color:#fff}.vs-rec i{color:#ffb7cc}.vs-rec small{color:#7a2848}
.vs-ava{border-radius:50%;background:#fff;box-shadow:0 0 0 6px #ff8fb1,0 12px 26px rgba(74,24,48,.35)}.vs-ava img,.vs-ini{border-radius:50%}
.vs-ini{background:linear-gradient(180deg,#6a2445,#3a1026);color:#ffd3df;font:italic 800 150px/1 'Playfair Display',serif}
.vs-art img{filter:drop-shadow(0 14px 20px rgba(74,24,48,.35))}
.vs-mark i{position:absolute;left:50%;top:50%;width:230px;height:230px;margin:-115px 0 0 -115px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px #b0305e,0 10px 30px rgba(74,24,48,.4)}
.vs-mark span{position:relative;display:block;font:italic 800 150px/1 'Playfair Display',serif;color:#b0305e;padding:0 20px 22px}
.vs-in .vs-bg{animation:sk-sun 1.4s cubic-bezier(.2,.8,.2,1) both}@keyframes sk-sun{from{background-position:0 500px,0 0}to{background-position:0 0,0 0}}
.vs-in .vs-side.s1{animation:sk-s1 1s .5s cubic-bezier(.2,.8,.2,1) both}.vs-in .vs-side.s2{animation:sk-s2 1s .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes sk-s1{from{opacity:0;transform:translateX(-140px)}to{opacity:1;transform:none}}@keyframes sk-s2{from{opacity:0;transform:translateX(140px)}to{opacity:1;transform:none}}
.vs-in .vs-mark{animation:sk-mk .8s 1s cubic-bezier(.2,1.3,.4,1) both}@keyframes sk-mk{from{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-40deg)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .sk-branch{animation:sk-br 1.6s .2s cubic-bezier(.2,.8,.2,1) both}@keyframes sk-br{from{opacity:0;transform:translate(120px,-80px)}to{opacity:1;transform:none}}
.vs-in .vs-round{animation:sk-txt .7s 1.4s both}
/* Victory: first light */
.vc-bg{background:radial-gradient(circle 380px at 78% 36%,#ff6f9c 0 99%,transparent 100%),linear-gradient(180deg,#fff7f3,#ffe3ea 50%,#ffc2d4)}
.vc-bg2{background:linear-gradient(0deg,rgba(255,255,255,.75),transparent 34%)}
.sk-branch.v{right:auto;left:-30px;top:-20px;transform:scaleX(-1);width:620px;height:372px}
.vc-round{left:150px;top:300px;transform:none;padding:0 0 8px;font:700 24px 'Playfair Display',serif;letter-spacing:5px;color:#b0305e;border-bottom:2px solid #ff8fb1}
.vc-title{left:136px;right:auto;top:auto;bottom:70px;text-align:left;font:italic 800 250px/1 'Playfair Display',serif}
.vc-title span{color:#4a1830;padding-right:.16em}
.vc-card{left:150px;top:386px;transform:none}
.vc-ava{border-radius:50%;background:#fff;box-shadow:0 0 0 6px #ff8fb1,0 12px 26px rgba(74,24,48,.3)}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:linear-gradient(180deg,#6a2445,#3a1026);color:#ffd3df;font:italic 800 140px/1 'Playfair Display',serif}
.vc-team{font:700 30px 'Playfair Display',serif;letter-spacing:4px;color:#b0305e;text-transform:uppercase}
.vc-name{font:italic 800 112px/1.1 'Playfair Display',serif;color:#4a1830}
.vc-score{background:#4a1830;color:#fff;border-radius:40px;padding:6px 30px 6px}.vc-def{color:#7a2848}.vc-def em{color:#4a1830}
#el-vic[data-pic=art] .vc-bg{background:radial-gradient(circle 400px at 24% 42%,#ff6f9c 0 99%,transparent 100%),linear-gradient(180deg,#fff7f3,#ffe3ea 50%,#ffc2d4)}#el-vic[data-pic=art] .sk-branch.v{display:none}#el-vic[data-pic=art] .vc-round{padding:0 0 8px!important}
.vc-in .vc-bg{animation:sk-rise 1.8s cubic-bezier(.2,.8,.2,1) both}@keyframes sk-rise{from{background-position:0 700px,0 0}to{background-position:0 0,0 0}}
.vc-in .vc-title{animation:sk-ttl 1.2s .4s cubic-bezier(.2,.8,.2,1) both}@keyframes sk-ttl{from{opacity:0;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(-40px)}}
.vc-in .vc-card{animation:sk-txt .8s 1.1s both}.vc-in .vc-round{animation:sk-txt .7s 1.5s both}
`,
  };
})();
