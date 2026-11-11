/* BeeboScore (developed by Beebo) — elemental layouts, part 3: Tidal, Voltage, Chrome, Pastel. See themes.js. */
(() => {
  'use strict';
  const TH = window.EL_THEMES, { W, H, A, B, R, lg, scoreBox, centerBox, vsPlate, over } = TH._;

  // =========================================================================================== TIDAL: deep water
  // the wavy bottom edge runs between y 61 and 67: inside the bar, so nothing sits over the game's health bars
  const TDH = 62, waveShape = `M12 0 ${R.rnd} Q518 58 495 64 T450 64 T405 64 T360 64 T315 64 T270 64 T225 64 T180 64 T135 64 T90 64 T45 64 Q20 70 6 60 Q0 56 0 48 L0 12 Q0 0 12 0 Z`;
  const waveBg = (fill, op, line, lo) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Cpath d='M0 8 Q30 0 60 8 T120 8 V90 H0 Z' fill='%23${fill}' fill-opacity='${op}'/%3E%3Cpath d='M0 8 Q30 0 60 8 T120 8' fill='none' stroke='%23${line}' stroke-width='1.6' stroke-opacity='${lo || '.8'}'/%3E%3C/svg%3E")`;
  const AQUA = ['#ffffff', '#c9fbff', '#35dbe2'], drop = { type: 'drop', color: AQUA };
  const bubble = (ps, x, y, r, sp) => ps.add({ x, y, vy: -sp, type: 'bubble', color: '#c9fbff', size: r, decay: sp < 30 ? 1.5 : 60 / (sp * 4 + 60), sway: sp < 30 ? 5 : 14, a: sp < 30 ? 0.5 : 0.7 });
  TH.tidal = {
    fonts: [['Righteous', 400, 'normal', 'righteous-latin-400-normal.woff2']],
    bar: {
      shape: waveShape, h: TDH, pad: 24, nameSize: 34, roundSize: 21, introMs: 1400,
      skin: id => `<defs>${lg(id, ['#12798f', '#07485c', '#04303f'])}</defs><path d="${waveShape}" fill="url(#${id})" stroke="#7df3f8" stroke-width="2" stroke-linejoin="round"/>
        <path d="M16 5 H${W - 16}" stroke="rgba(201,251,255,.6)" stroke-width="2" stroke-linecap="round"/>`,
      fx: '<i class="td-w a"></i><i class="td-w b"></i>',
      score: scoreBox('round', ['#e6feff', '#35dbe2'], '#04303f'), center: centerBox('pill', ['#12798f', '#04303f'], '#7df3f8'),
      onIntro: E => { for (const s of [1, 2]) E.after(380, () => over(E, s, 26, { y: TDH, ...drop, dir: Math.PI / 2, spread: 2.4, speed: [80, 420], g: 1200, size: [2.5, 6], decay: [0.9, 1.6] })); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y + 10, win ? 44 : 22, { ...drop, dir: -Math.PI / 2, spread: 1.9, speed: [200, 620], g: 1500, size: [3, 7], decay: [0.8, 1.3] }); E.ps.add({ x, y, type: 'ring', size: 14, color: '#c9fbff', decay: 1.7 }); },
      onWin: (E, s) => { over(E, s, 50, { y: H - 6, ...drop, dir: -Math.PI / 2, spread: 1.2, speed: [140, 520], g: 1400, size: [3, 7], decay: [0.7, 1.2] }); },
      onLose: (E, s) => over(E, s, 22, { y: H, ...drop, color: ['#6fa4ad', '#9cc4cb'], dir: Math.PI / 2, spread: 0.6, speed: [20, 160], g: 900, size: [2.5, 5], decay: [0.8, 1.4] }),
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 9 : 1.8)) { const [x, y] = E.at(s, 12 + Math.random() * (B - 100), TDH - 6); bubble(E.ps, x, y, E.rand(1.4, 3), E.rand(8, 16)); } },
    },
    vs: {
      inMs: 2600,
      plate: vsPlate('M0 30 Q57 0 115 30 T230 30 T345 30 T460 30 T575 30 T690 30 T805 30 T920 30 V226 Q920 250 896 250 H24 Q0 250 0 226 Z', ['#12798f', '#07485c', '#04303f'], '#7df3f8', 4, '<path d="M0 58 Q57 28 115 58 T230 58 T345 58 T460 58 T575 58 T690 58 T805 58 T920 58" fill="none" stroke="rgba(201,251,255,.35)" stroke-width="3"/>'),
      mark: '<i></i><span>VS</span>',
      extra: '<svg class="td-crash l" viewBox="0 0 1200 1080" preserveAspectRatio="none"><path d="M0 0 H900 C1060 160 1180 300 1120 520 C1090 650 1180 760 1200 900 V1080 H0 Z" fill="#35dbe2"/><path d="M0 0 H820 C980 180 1090 320 1040 540 C1010 660 1100 780 1120 1080 H0 Z" fill="#0d6b80"/></svg><svg class="td-crash r" viewBox="0 0 1200 1080" preserveAspectRatio="none"><path d="M0 0 H900 C1060 160 1180 300 1120 520 C1090 650 1180 760 1200 900 V1080 H0 Z" fill="#35dbe2"/><path d="M0 0 H820 C980 180 1090 320 1040 540 C1010 660 1100 780 1120 1080 H0 Z" fill="#0d6b80"/></svg>',
      onShow: V => V.later(560, () => { V.flash(420); V.shake(); V.ps.burst(960, 520, 200, { ...drop, ry: 420, speed: [200, 1300], g: 1100, size: [4, 13], decay: [0.5, 1.1] }); }),
      tick: (V, dt) => { if (Math.random() < dt * 20) bubble(V.ps, V.rand(0, 1920), 1100, V.rand(3, 16), V.rand(70, 220)); },
    },
    vic: {
      inMs: 2800,
      extra: '<i class="td-sea a"></i><i class="td-sea b"></i>',
      onShow: C => C.later(500, () => { C.ps.burst(960, 900, 170, { ...drop, rx: 620, dir: -Math.PI / 2, spread: 1, speed: [300, 1300], g: 1300, size: [4, 12], decay: [0.5, 1] }); }),
      tick: (C, dt) => { if (Math.random() < dt * 24) bubble(C.ps, C.rand(0, 1920), 1100, C.rand(3, 18), C.rand(70, 240)); },
    },
    css: `
.el-mir{filter:drop-shadow(0 0 8px rgba(53,219,226,.55))}
.td-w{position:absolute;left:0;width:200%;height:90px;transition:top 1.1s cubic-bezier(.3,0,.2,1),opacity .8s}
.td-w.a{top:43px;background:${waveBg('35dbe2', '.22', 'c9fbff', '.2')} repeat-x;animation:td-flow 4.2s linear infinite}
.td-w.b{top:50px;background:${waveBg('7df3f8', '.16', '7df3f8', '.16')} repeat-x;animation:td-flow 6.8s linear infinite reverse}
@keyframes td-flow{to{transform:translateX(-120px)}}
.mp .td-w.a{top:33px}.mp .td-w.b{top:41px}.champ .td-w.a{top:6px}.champ .td-w.b{top:14px}.lost .td-w{top:96px;opacity:0}
.el-name{font-family:'Righteous',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#f1ffff;text-shadow:0 2px 0 #02222d,0 0 12px rgba(53,219,226,.6)}
.el-team{font:400 20px 'Righteous',sans-serif;color:#7df3f8;text-transform:uppercase;text-shadow:0 1px 0 #02222d}
.el-pro{color:#c4eef2}.el-st{color:#e6feff}.el-pro,.el-st{text-shadow:0 1px 0 #02222d}.el-ltag{background:#7df3f8;color:#04303f}
.el-num{font:400 37px/1 'Righteous',sans-serif;color:#03293a}.el-lbl{color:#e6feff}#el{--pip:#7df3f8}.el-pip{transform:none;border-radius:50%}
.el-meta{color:#e6feff}.el-dot{color:#35dbe2}.el-round{font-family:'Righteous',sans-serif;color:#7df3f8;letter-spacing:1px}
.champ .el-mir{filter:drop-shadow(0 0 16px rgba(125,243,248,.95)) brightness(1.12)}
.lost .el-mir{filter:saturate(.25) brightness(.6)}.lost .el-who{opacity:.74}
.el-intro .el-mir{animation:td-in .8s cubic-bezier(.3,1.3,.5,1) both}.el-intro .p2 .el-mir{animation-name:td-in2}
@keyframes td-in{from{transform:translateY(-110px) scaleY(1.5)}to{transform:none}}@keyframes td-in2{from{transform:scaleX(-1) translateY(-110px) scaleY(1.5)}to{transform:scaleX(-1)}}
.el-intro .el-who,.el-intro .el-score{animation:td-txt .5s .55s both}@keyframes td-txt{from{opacity:0;transform:translateY(12px)}to{opacity:1}}
/* VS: two waves collide */
.vs-bg{background:radial-gradient(ellipse 60% 50% at 50% 0,#35dbe2,transparent 70%),linear-gradient(180deg,#0f7f96,#07485c 45%,#02222d)}
.vs-bg2{background:repeating-linear-gradient(105deg,transparent 0 120px,rgba(201,251,255,.07) 120px 190px,transparent 190px 300px);-webkit-mask:linear-gradient(180deg,#000,transparent 75%);mask:linear-gradient(180deg,#000,transparent 75%);animation:td-rays 9s ease-in-out infinite alternate}@keyframes td-rays{from{transform:translateX(-90px)}to{transform:translateX(90px)}}
.td-crash{position:absolute;top:0;width:1200px;height:1080px;visibility:hidden}.td-crash.l{left:-240px}.td-crash.r{left:960px;transform:scaleX(-1)}
.vs-in .td-crash{visibility:visible}.vs-in .td-crash.l{animation:td-cl 1.15s cubic-bezier(.5,0,.3,1) both}.vs-in .td-crash.r{animation:td-cr 1.15s cubic-bezier(.5,0,.3,1) both}
@keyframes td-cl{0%{transform:translateX(-1300px)}48%{transform:none}100%{transform:translateX(-1300px)}}@keyframes td-cr{0%{transform:scaleX(-1) translateX(-1300px)}48%{transform:scaleX(-1)}100%{transform:scaleX(-1) translateX(-1300px)}}
.vs-round{font:400 30px 'Righteous',sans-serif;letter-spacing:6px;color:#e6feff;background:rgba(2,34,45,.6);border:2px solid #7df3f8;border-radius:40px}
.vs-plate{filter:drop-shadow(0 0 18px rgba(53,219,226,.6))}
.vs-info{top:760px;height:228px}
.vs-name{font:400 100px 'Righteous',sans-serif;letter-spacing:2px;text-transform:uppercase;color:#f1ffff;text-shadow:0 4px 0 #02222d,0 0 22px rgba(53,219,226,.7)}
.vs-team{font:400 32px 'Righteous',sans-serif;letter-spacing:4px;color:#7df3f8;text-transform:uppercase}
.vs-rec span{background:linear-gradient(180deg,#e6feff,#35dbe2);border-radius:30px}.vs-rec b{color:#03293a}.vs-rec i{color:#07485c}.vs-rec small{color:#c4eef2}
.vs-ava{border-radius:50%;background:linear-gradient(180deg,#e6feff,#35dbe2);box-shadow:0 0 0 5px rgba(201,251,255,.25),0 0 40px rgba(53,219,226,.7)}.vs-ava img,.vs-ini{border-radius:50%}
.vs-ini{background:radial-gradient(circle at 40% 30%,#12798f,#02222d);color:#c9fbff;font-family:'Righteous',sans-serif;font-size:130px}
.vs-art img{filter:drop-shadow(0 0 30px rgba(53,219,226,.55))}
.vs-mark i{position:absolute;left:50%;top:50%;width:280px;height:280px;margin:-140px 0 0 -140px;border-radius:50%;border:5px solid #c9fbff;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.6) 0 7%,transparent 8%),radial-gradient(circle,rgba(53,219,226,.15) 50%,rgba(201,251,255,.5));box-shadow:0 0 50px rgba(53,219,226,.6)}
.vs-mark span{position:relative;display:block;font:400 150px/1 'Righteous',sans-serif;color:#fff;text-shadow:0 5px 0 #02222d,0 0 30px rgba(53,219,226,.9)}
.vs-in .vs-side,.vs-in .vs-round{animation:td-rev .01s .56s both}@keyframes td-rev{from{opacity:0}to{opacity:1}}
.vs-in .vs-mark{animation:td-mk .7s .6s cubic-bezier(.2,1.6,.4,1) both}@keyframes td-mk{from{opacity:0;transform:translate(-50%,-50%) scale(.1)}to{opacity:1;transform:translate(-50%,-50%)}}
/* Victory: rising from the deep */
.vc-bg{background:radial-gradient(ellipse 70% 50% at 50% 0,#35dbe2,transparent 70%),linear-gradient(180deg,#0f7f96,#07485c 50%,#02222d)}
.vc-bg2{background:repeating-linear-gradient(105deg,transparent 0 120px,rgba(201,251,255,.08) 120px 190px,transparent 190px 300px);-webkit-mask:linear-gradient(180deg,#000,transparent 70%);mask:linear-gradient(180deg,#000,transparent 70%);animation:td-rays 9s ease-in-out infinite alternate}
.td-sea{position:absolute;left:0;bottom:0;width:2160px;height:190px}
.td-sea.a{background:${waveBg('35dbe2', '.45', 'c9fbff')} repeat-x;background-size:240px 190px;animation:td-sea 5s linear infinite}.td-sea.b{height:150px;background:${waveBg('0d6b80', '.8', '7df3f8')} repeat-x;background-size:240px 150px;animation:td-sea 8s linear infinite reverse}
@keyframes td-sea{to{transform:translateX(-240px)}}
.vc-round{top:70px;font:400 26px 'Righteous',sans-serif;letter-spacing:6px;color:#e6feff;background:rgba(2,34,45,.6);border:2px solid #7df3f8;border-radius:40px}
.vc-card{top:170px}
.vc-title{top:auto;bottom:96px;font:400 300px/1 'Righteous',sans-serif;letter-spacing:10px;text-transform:uppercase}
.vc-title span{background:linear-gradient(180deg,#fff,#c9fbff 50%,#35dbe2);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 0 #02222d) drop-shadow(0 0 40px rgba(53,219,226,.7))}
.vc-ava{border-radius:50%;background:linear-gradient(180deg,#e6feff,#35dbe2);box-shadow:0 0 0 5px rgba(201,251,255,.25),0 0 40px rgba(53,219,226,.7)}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:radial-gradient(circle at 40% 30%,#12798f,#02222d);color:#c9fbff;font-family:'Righteous',sans-serif}
.vc-team{font:400 32px 'Righteous',sans-serif;letter-spacing:4px;color:#7df3f8;text-transform:uppercase}
.vc-name{font:400 112px/1.1 'Righteous',sans-serif;letter-spacing:2px;text-transform:uppercase;color:#f1ffff;text-shadow:0 5px 0 #02222d,0 0 26px rgba(53,219,226,.7)}
.vc-score{background:linear-gradient(180deg,#e6feff,#35dbe2);color:#03293a;border-radius:40px;padding:6px 30px 4px}.vc-def{color:#c4eef2}.vc-def em{color:#fff}
.vc-in .vc-title{animation:td-ttl 1.3s .3s cubic-bezier(.2,1.2,.3,1) both}@keyframes td-ttl{from{transform:translateY(520px)}to{transform:none}}
.vc-in .vc-card{animation:td-card .8s 1.1s both}@keyframes td-card{from{opacity:0;transform:translateX(-50%) translateY(-40px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:td-rev .6s 1.5s both}
`,
  };

  // =========================================================================================== VOLTAGE: live current
  const zig = `M26 0 ${R.bevel} L14 ${H} L30 44 L0 40 L20 20 L6 16 Z`;
  const VOLT = { color: '#fffbd0', glow: '#ffe600' }, zap = { type: 'spark', color: ['#ffffff', '#fff27a', '#ffe600', '#7fa2ff'] };
  TH.voltage = {
    fonts: [['Orbitron', 700, 'normal', 'orbitron-latin-700-normal.woff2'], ['Orbitron', 900, 'normal', 'orbitron-latin-900-normal.woff2']],
    bar: {
      shape: zig, pad: 44, nameSize: 28, roundSize: 17, introMs: 1300,
      skin: id => `<defs>${lg(id, ['#18225c', '#0a1030', '#05081c'])}<pattern id="${id}g" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0 H0 V22" fill="none" stroke="rgba(91,132,255,.22)" stroke-width="1"/></pattern></defs>
        <path d="${zig}" fill="url(#${id})"/><path d="${zig}" fill="url(#${id}g)"/><path d="${zig}" fill="none" stroke="#ffe600" stroke-width="2.4" stroke-linejoin="miter"/>
        <path class="vt-wire" d="M40 ${H - 6} H${B - 8}" stroke="#5b84ff" stroke-width="2" stroke-dasharray="14 8"/>`,
      fx: '<i class="vt-pulse"></i>',
      score: scoreBox('hex', ['#fff79a', '#ffe600', '#e0b800'], '#0a1030'), center: centerBox('tag', ['#18225c', '#05081c'], '#ffe600', 2.4),
      onIntro: E => { for (const s of [1, 2]) { const [x1, y1] = E.at(s, 0, 40), [x2, y2] = E.at(s, B, H - 4); E.after(120, () => E.ps.bolt(x1, y1, x2, y2, { ...VOLT, jag: 14, w: 2.4, decay: 3 })); } },
      onScore: (E, s, x, y, win) => { for (let i = 0; i < (win ? 6 : 3); i++) { const a = Math.random() * 6.28, r = 60 + Math.random() * 90; E.ps.bolt(x, y, x + Math.cos(a) * r, y + Math.abs(Math.sin(a)) * r * 0.7, { ...VOLT, jag: 12, w: 2, decay: 5 }); } E.ps.burst(x, y, win ? 40 : 20, { ...zap, speed: [200, 800], g: 500, size: [2, 4.5], decay: [1.4, 2.6] }); },
      onWin: (E, s) => { for (let i = 0; i < 5; i++) E.after(i * 110, () => { const [x1, y1] = E.at(s, Math.random() * 200, H), [x2, y2] = E.at(s, 300 + Math.random() * 240, H); E.ps.bolt(x1, y1 + 4, x2, y2 + 4, { ...VOLT, jag: 12, w: 2.4, decay: 4 }); }); over(E, s, 30, { y: H, ...zap, dir: Math.PI / 2, spread: 2, speed: [100, 500], g: 500, size: [2, 4], decay: [1.2, 2.2] }); },
      onLose: (E, s) => { const [x, y] = E.at(s, 20, 30); E.ps.burst(x, y, 16, { ...zap, color: ['#fff', '#7fa2ff'], speed: [80, 420], g: 700, size: [2, 4], decay: [1.2, 2.2] }); },
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 5 : 0.8)) { const a = 40 + Math.random() * (B - 150), [x1, y1] = E.at(s, a, H - 7), [x2, y2] = E.at(s, a + 30 + Math.random() * 70, H - 7); E.ps.bolt(x1, y1, x2, y2, { ...VOLT, jag: 6, fork: 0, w: 1.5, decay: 7 }); } },
    },
    vs: {
      inMs: 2400,
      plate: vsPlate('M34 0 H920 V216 L886 250 H0 V34 Z', ['#18225c', '#0a1030', '#05081c'], '#ffe600', 4, id => `<defs><pattern id="${id}g" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M46 0 H0 V46" fill="none" stroke="rgba(91,132,255,.22)" stroke-width="1.5"/></pattern></defs><path d="M34 0 H920 V216 L886 250 H0 V34 Z" fill="url(#${id}g)"/><path d="M30 232 H860" stroke="#5b84ff" stroke-width="4" stroke-dasharray="26 14"/>`),
      mark: '<i></i><span>VS</span>',
      onShow: V => { V.later(380, () => { V.flash(360); V.shake(); for (let i = 0; i < 4; i++) { V.ps.bolt(-20, 200 + i * 180, 960, 470, { ...VOLT, w: 5, jag: 46, decay: 2.2 }); V.ps.bolt(1940, 200 + i * 180, 960, 470, { ...VOLT, w: 5, jag: 46, decay: 2.2 }); } V.ps.burst(960, 470, 120, { ...zap, speed: [300, 1500], g: 400, size: [2.5, 6], decay: [1, 2] }); }); },
      tick: (V, dt) => { if (Math.random() < dt * 2.6) { const left = Math.random() < 0.5; V.ps.bolt(left ? 490 : 1430, 576, 960 + V.rand(-60, 60), 470 + V.rand(-60, 60), { ...VOLT, w: 3, jag: 30, decay: 3.4 }); } if (Math.random() < dt * 14) V.ps.add({ x: V.rand(0, 1920), y: V.rand(0, 1080), vx: V.rand(-60, 60), vy: V.rand(-60, 60), type: 'spark', color: V.pick(zap.color), size: V.rand(1.5, 3), decay: V.rand(1.2, 2.4) }); },
    },
    vic: {
      inMs: 2400,
      onShow: C => { C.later(300, () => { C.flash(420); for (const x of [420, 760, 1160, 1500]) C.ps.bolt(x + C.rand(-80, 80), -20, x, 400, { ...VOLT, w: 6, jag: 50, decay: 1.8 }); C.ps.burst(960, 380, 130, { ...zap, rx: 600, speed: [200, 1200], g: 500, size: [2.5, 6], decay: [0.9, 1.9] }); }); },
      tick: (C, dt) => { if (Math.random() < dt * 1.5) { const x = C.rand(200, 1720); C.ps.bolt(x + C.rand(-120, 120), -20, x, C.rand(180, 420), { ...VOLT, w: 3.5, jag: 44, decay: 3 }); } if (Math.random() < dt * 14) C.ps.add({ x: C.rand(0, 1920), y: C.rand(0, 1080), vx: C.rand(-60, 60), vy: C.rand(-60, 60), type: 'spark', color: C.pick(zap.color), size: C.rand(1.5, 3), decay: C.rand(1.2, 2.4) }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 0 7px rgba(255,230,0,.6))}
.vt-wire{animation:vt-wire .7s linear infinite}@keyframes vt-wire{to{stroke-dashoffset:-22}}.lost .vt-wire{animation:none;stroke:#3a4060}
.vt-pulse{position:absolute;top:0;left:-20%;width:14%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,240,90,.4),transparent);animation:vt-pulse 3.4s linear infinite}@keyframes vt-pulse{0%,55%{left:-20%}100%{left:112%}}.lost .vt-pulse{display:none}
.el-name{font-family:'Orbitron',sans-serif;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#fff;text-shadow:0 0 10px rgba(91,132,255,.95),0 2px 0 #05081c}
.el-team{font:700 16px 'Orbitron',sans-serif;letter-spacing:1px;color:#ffe600;text-transform:uppercase}
.el-pro{color:#b9c6f5}.el-st{color:#ffe600}.el-ltag{background:#ffe600;color:#0a1030}
.el-num{font:900 31px/1 'Orbitron',sans-serif;color:#0a1030}.el-lbl{color:#e3e9ff}#el{--pip:#ffe600}.el-pip{transform:skewX(-18deg);border-radius:0;width:9px;height:13px}.el-pip.on{box-shadow:0 0 8px #ffe600}
.el-meta{color:#e3e9ff}.el-dot{color:#ffe600}.el-round{font-family:'Orbitron',sans-serif;font-weight:900;color:#ffe600;letter-spacing:1px}
.champ .el-mir{animation:vt-over 1.1s steps(1) infinite}@keyframes vt-over{0%{filter:drop-shadow(0 0 16px #ffe600) brightness(1.35)}50%{filter:drop-shadow(0 0 9px #ffe600) brightness(1.1)}62%{filter:drop-shadow(0 0 20px #fff27a) brightness(1.5)}70%{filter:drop-shadow(0 0 9px #ffe600) brightness(1.15)}}
.lost .el-mir{filter:saturate(0) brightness(.42)}.fell .el-mir{animation:vt-die .9s steps(1) both}@keyframes vt-die{0%{filter:brightness(1.6)}12%{filter:saturate(0) brightness(.3)}22%{filter:brightness(1.3)}34%{filter:saturate(0) brightness(.3)}52%{filter:brightness(1)}60%{filter:saturate(0) brightness(.42)}}
.lost .el-who{opacity:.76}
.el-intro .el-mir{animation:vt-on 1s steps(1) both}@keyframes vt-on{0%{opacity:0}10%{opacity:1}16%{opacity:.1}30%{opacity:1}36%{opacity:.3}44%{opacity:1}}
.el-intro .el-who,.el-intro .el-score{animation:vt-txt .4s .5s steps(3) both}@keyframes vt-txt{from{opacity:0}to{opacity:1}}
/* VS: the circuit closes */
.vs-bg{background:radial-gradient(ellipse 50% 46% at 50% 43.5%,#2a3ea8,transparent 72%),#05081c}
.vs-bg2{background:linear-gradient(rgba(91,132,255,.16) 2px,transparent 2px) 0 0/100% 60px,linear-gradient(90deg,rgba(91,132,255,.16) 2px,transparent 2px) 0 0/60px 100%;-webkit-mask:radial-gradient(ellipse 80% 80% at 50% 45%,#000,transparent 85%);mask:radial-gradient(ellipse 80% 80% at 50% 45%,#000,transparent 85%)}
.vs-round{font:700 24px 'Orbitron',sans-serif;letter-spacing:8px;color:#0a1030;background:#ffe600;clip-path:polygon(18px 0,100% 0,calc(100% - 18px) 100%,0 100%);padding:10px 54px}
.vs-plate{filter:drop-shadow(0 0 16px rgba(255,230,0,.5))}
.vs-name{font:900 76px 'Orbitron',sans-serif;letter-spacing:3px;text-transform:uppercase;color:#fff;text-shadow:0 0 22px rgba(91,132,255,.95),0 4px 0 #05081c}
.vs-team{font:700 26px 'Orbitron',sans-serif;letter-spacing:6px;color:#ffe600;text-transform:uppercase}
.vs-rec span{background:#ffe600;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}.vs-rec b{font-family:'Orbitron',sans-serif;font-weight:900;font-size:34px;color:#0a1030}.vs-rec i{color:#0a1030}.vs-rec small{color:#b9c6f5}
.vs-ava{clip-path:polygon(16% 0,100% 0,100% 84%,84% 100%,0 100%,0 16%);background:#ffe600}.vs-ava img,.vs-ini{clip-path:polygon(16% 0,100% 0,100% 84%,84% 100%,0 100%,0 16%)}
.vs-ini{background:linear-gradient(180deg,#18225c,#05081c);color:#ffe600;font:900 120px/1 'Orbitron',sans-serif}
.vs-art img{filter:drop-shadow(0 0 26px rgba(91,132,255,.7))}
.vs-mark i{position:absolute;left:50%;top:50%;width:320px;height:278px;margin:-139px 0 0 -160px;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:linear-gradient(180deg,#fff79a,#ffe600 50%,#e0b800)}
.vs-mark span{position:relative;display:block;font:900 130px/1 'Orbitron',sans-serif;color:#0a1030;letter-spacing:2px}
.vs-in .vs-side.s1{animation:vt-s1 .35s .05s cubic-bezier(.1,.9,.2,1) both}.vs-in .vs-side.s2{animation:vt-s2 .35s .05s cubic-bezier(.1,.9,.2,1) both}
@keyframes vt-s1{from{opacity:0;transform:translateX(-300px) skewX(14deg)}to{opacity:1;transform:none}}@keyframes vt-s2{from{opacity:0;transform:translateX(300px) skewX(-14deg)}to{opacity:1;transform:none}}
.vs-in .vs-mark{animation:vt-mk .9s .36s steps(1) both}@keyframes vt-mk{0%{opacity:0}10%{opacity:1;transform:translate(-50%,-50%) scale(1.5)}20%{opacity:.2}30%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}40%{opacity:.5}50%{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:vt-txt .4s 1s steps(3) both}
/* Victory: power surge */
.vc-bg{background:radial-gradient(ellipse 60% 50% at 50% 36%,#2a3ea8,transparent 72%),#05081c}
.vc-bg2{background:linear-gradient(rgba(91,132,255,.16) 2px,transparent 2px) 0 0/100% 60px,linear-gradient(90deg,rgba(91,132,255,.16) 2px,transparent 2px) 0 0/60px 100%;transform:perspective(700px) rotateX(58deg) scale(2.2);transform-origin:50% 100%;top:400px;height:680px;animation:vt-grid 1.2s linear infinite}@keyframes vt-grid{to{background-position:0 60px,0 0}}
.vc-round{top:96px;font:700 22px 'Orbitron',sans-serif;letter-spacing:8px;color:#0a1030;background:#ffe600;clip-path:polygon(18px 0,100% 0,calc(100% - 18px) 100%,0 100%);padding:10px 54px}
.vc-title{top:200px;font:900 200px/1 'Orbitron',sans-serif;letter-spacing:8px;text-transform:uppercase;transform:skewX(-12deg) rotate(-4deg)}
.vc-title span{color:#ffe600;text-shadow:0 0 40px rgba(255,230,0,.8),6px 6px 0 #5b84ff,12px 12px 0 #0a1030}
.vc-card{top:580px}
.vc-ava{clip-path:polygon(16% 0,100% 0,100% 84%,84% 100%,0 100%,0 16%);background:#ffe600}.vc-ava img,.vc-ini{clip-path:polygon(16% 0,100% 0,100% 84%,84% 100%,0 100%,0 16%)}
.vc-ini{background:linear-gradient(180deg,#18225c,#05081c);color:#ffe600;font:900 120px/1 'Orbitron',sans-serif}
.vc-team{font:700 28px 'Orbitron',sans-serif;letter-spacing:6px;color:#ffe600;text-transform:uppercase}
.vc-name{font:900 88px/1.1 'Orbitron',sans-serif;letter-spacing:3px;text-transform:uppercase;color:#fff;text-shadow:0 0 24px rgba(91,132,255,.95),0 5px 0 #05081c}
.vc-score{background:#ffe600;color:#0a1030;font-family:'Orbitron',sans-serif;font-weight:900;font-size:46px;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);padding:8px 30px}.vc-def{color:#b9c6f5}.vc-def em{color:#fff}
#el-vic[data-pic=art] .vc-title{font-size:124px!important}
.vc-in .vc-title{animation:vt-ttl .9s .25s steps(1) both}@keyframes vt-ttl{0%{opacity:0}8%{opacity:1;filter:brightness(3)}16%{opacity:.15}28%{opacity:1;filter:brightness(2)}36%{opacity:.4}46%{opacity:1;filter:none}}
.vc-in .vc-card{animation:vt-card .4s .9s cubic-bezier(.1,.9,.2,1) both}@keyframes vt-card{from{opacity:0;transform:translateX(-50%) skewX(-20deg) translateX(-200px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:vt-txt .4s 1.2s steps(3) both}
`,
  };

  // =========================================================================================== CHROME: liquid metal
  const pill = `M34.5 0 ${R.rnd} L34.5 ${H} A34.5 34.5 0 0 1 34.5 0 Z`;
  const MIRROR = [[0, '#ffffff'], [0.4, '#d3d8de'], [0.56, '#aeb5bf'], [0.6, '#c9ced6'], [1, '#f1f3f5']], SILVER = ['#ffffff', '#dfe3e8', '#9aa1ad'];
  const chromeText = 'background:linear-gradient(180deg,#fff 0,#e3e6ea 36%,#7b838f 50%,#b9bfc8 55%,#f7f8f9 100%);-webkit-background-clip:text;background-clip:text;color:transparent';
  TH.chrome = {
    fonts: [['Exo 2', 900, 'italic', 'exo-2-latin-900-italic.woff2'], ['Exo 2', 800, 'normal', 'exo-2-latin-800-normal.woff2']],
    bar: {
      shape: pill, pad: 40, nameSize: 36, roundSize: 22, introMs: 1300,
      skin: id => `<defs>${lg(id, MIRROR)}</defs><path d="${pill}" fill="url(#${id})" stroke="#15171c" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M36 4.5 H${W - 16}" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M36 ${H - 4.5} H${B - 6}" stroke="rgba(21,23,28,.3)" stroke-width="1.6" stroke-linecap="round"/>`,
      fx: '<i class="ch-iris"></i><i class="ch-ref a"></i><i class="ch-ref b"></i>',
      score: scoreBox('round', ['#2b3038', '#0b0d12'], '#ffffff', 2.4), center: centerBox('pill', MIRROR, '#15171c', 2.4, '<path d="M8 4.5 H252" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
      onIntro: E => { for (const s of [1, 2]) E.after(500, () => { const [x, y] = E.at(s, 34, 34); E.ps.add({ x, y, type: 'star', color: '#fff', size: 26, decay: 1.6 }); }); },
      onScore: (E, s, x, y, win) => { E.ps.add({ x, y, type: 'ring', size: 16, color: '#fff', decay: 1.6 }); E.ps.burst(x, y, win ? 34 : 16, { type: 'dot', color: SILVER, speed: [140, 520], g: 900, size: [2.5, 6], decay: [0.9, 1.5] }); E.ps.burst(x, y, 6, { type: 'star', color: '#fff', speed: [60, 220], g: 0, size: [8, 16] }); },
      onWin: (E, s) => { for (let i = 0; i < 9; i++) E.after(i * 90, () => { const [x, y] = E.at(s, 30 + Math.random() * (B - 60), 6 + Math.random() * 56); E.ps.add({ x, y, type: 'star', color: '#fff', size: E.rand(12, 26), decay: 1.8 }); }); },
      onLose: (E, s) => over(E, s, 14, { y: H, type: 'dot', color: ['#6b7280', '#9aa1ad'], dir: Math.PI / 2, spread: 0.8, speed: [30, 200], g: 1000, size: [2, 4.5], decay: [0.9, 1.5] }),
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 5 : 1)) { const [x, y] = E.at(s, 20 + Math.random() * (B - 30), 3 + Math.random() * 6); E.ps.add({ x, y, type: 'star', color: '#fff', size: E.rand(7, 15), decay: E.rand(1.8, 2.8) }); } },
    },
    vs: {
      inMs: 2400,
      plate: vsPlate('M125 0 H795 A125 125 0 0 1 795 250 H125 A125 125 0 0 1 125 0 Z', MIRROR, '#15171c', 5, '<path d="M130 12 H790" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M130 238 H790" stroke="rgba(21,23,28,.3)" stroke-width="4" stroke-linecap="round"/>'),
      mark: '<i></i><span>VS</span>',
      extra: '<i class="ch-ball l"></i><i class="ch-ball r"></i><i class="ch-floor"></i>',
      onShow: V => V.later(720, () => { V.flash(460); V.shake(); V.ps.add({ x: 960, y: 470, type: 'ring', size: 60, grow: 12, color: '#fff', decay: 1.3 }); V.ps.burst(960, 470, 90, { type: 'dot', color: SILVER, speed: [300, 1400], g: 900, size: [3, 11], decay: [0.6, 1.2] }); V.ps.burst(960, 470, 16, { type: 'star', color: '#fff', speed: [100, 500], g: 0, size: [14, 34] }); }),
      tick: (V, dt) => { if (Math.random() < dt * 5) V.ps.add({ x: V.rand(100, 1820), y: V.rand(80, 1000), type: 'star', color: '#fff', size: V.rand(8, 26), decay: V.rand(1, 2) }); },
    },
    vic: {
      inMs: 2600,
      title: '<span>Victory</span><span class="ch-mirror" aria-hidden="true">Victory</span>',
      extra: '<i class="ch-floor v"></i>',
      onShow: C => C.later(520, () => { C.flash(520); C.ps.burst(960, 300, 26, { type: 'star', color: '#fff', rx: 520, ry: 60, speed: [40, 300], g: 0, size: [14, 40], decay: [0.7, 1.4] }); }),
      tick: (C, dt) => { if (Math.random() < dt * 6) C.ps.add({ x: C.rand(300, 1620), y: C.rand(160, 420), type: 'star', color: '#fff', size: C.rand(8, 28), decay: C.rand(1, 2) }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))}
.ch-ref{position:absolute;top:0;height:100%;transform:skewX(-28deg)}
.ch-ref.a{left:-30%;width:16%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);animation:ch-ref 5s cubic-bezier(.5,0,.3,1) infinite}
.ch-ref.b{left:-30%;width:5%;background:rgba(255,255,255,.8);animation:ch-ref 5s .16s cubic-bezier(.5,0,.3,1) infinite}@keyframes ch-ref{0%,62%{left:-30%}100%{left:125%}}
.lost .ch-ref{display:none}
.ch-iris{position:absolute;inset:0;background:linear-gradient(100deg,rgba(255,80,200,.5),rgba(80,200,255,.5),rgba(120,255,180,.5),rgba(255,220,80,.5),rgba(255,80,200,.5));background-size:300% 100%;mix-blend-mode:color;opacity:0;transition:opacity .8s}
.champ .ch-iris{opacity:.85;animation:ch-iris 3.5s linear infinite}@keyframes ch-iris{to{background-position:-300% 0}}
.el-name{font-family:'Exo 2',sans-serif;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.5px;color:#0b0d12;text-shadow:0 1.5px 0 rgba(255,255,255,.85)}
.el-team{font:800 20px 'Exo 2',sans-serif;color:#39404b;text-transform:uppercase;text-shadow:0 1px 0 rgba(255,255,255,.7)}
.el-pro{color:#2f353f}.el-st{color:#0b0d12}.el-ltag{background:#0b0d12;color:#fff}
.el-num{font:italic 900 38px/1 'Exo 2',sans-serif;color:#fff;padding-right:3px}.el-lbl{color:#15171c}#el{--pip:#15171c}.el-pip{transform:none;border-radius:50%}
.el-meta{color:#23272e}.el-dot{color:#6b7280}.el-round{font-family:'Exo 2',sans-serif;font-weight:900;font-style:italic;color:#0b0d12;text-shadow:0 1px 0 rgba(255,255,255,.85)}
.champ .el-mir{filter:drop-shadow(0 0 14px rgba(255,255,255,.95)) drop-shadow(0 0 26px rgba(120,200,255,.6))}
.lost .el-mir{filter:brightness(.5) contrast(.8)}.lost .el-name,.lost .el-team,.lost .el-pro,.lost .el-st{color:#f1f3f5;text-shadow:0 1.5px 0 rgba(0,0,0,.6)}
.el-intro .p1 .el-mir{animation:ch-in1 .7s cubic-bezier(.2,1.2,.3,1) both}.el-intro .p2 .el-mir{animation:ch-in2 .7s cubic-bezier(.2,1.2,.3,1) both}
@keyframes ch-in1{from{clip-path:inset(0 100% 0 0 round 34px);filter:brightness(2.2)}to{clip-path:inset(-20px -20px -20px -20px);filter:none}}@keyframes ch-in2{from{clip-path:inset(0 100% 0 0 round 34px);filter:brightness(2.2)}to{clip-path:inset(-20px -20px -20px -20px);filter:none}}
.el-intro .el-who,.el-intro .el-score{animation:ch-txt .4s .5s both}@keyframes ch-txt{from{opacity:0;transform:translateX(-16px)}to{opacity:1}}
/* VS: two spheres collide */
.vs-bg{background:radial-gradient(ellipse 55% 40% at 50% 43.5%,#3a3f49,transparent 72%),linear-gradient(180deg,#050608,#15171c 62%,#0b0d12 62.2%,#23272e)}
.vs-bg2{background:linear-gradient(90deg,transparent,rgba(255,255,255,.55) 50%,transparent);height:2px;top:670px}
.ch-floor{position:absolute;left:0;top:672px;width:1920px;height:408px;background:linear-gradient(180deg,rgba(255,255,255,.12),transparent 60%)}
.ch-ball{position:absolute;top:320px;left:810px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle at 34% 26%,#fff 0,#eceef1 10%,#a2a9b4 36%,#3c414a 60%,#0d0f13 76%,#8d95a1 96%);box-shadow:0 30px 50px rgba(0,0,0,.6);visibility:hidden}
.vs-in .ch-ball{visibility:visible}.vs-in .ch-ball.l{animation:ch-bl .72s cubic-bezier(.5,0,.9,.6) both,ch-gone .12s .72s both}.vs-in .ch-ball.r{animation:ch-br .72s cubic-bezier(.5,0,.9,.6) both,ch-gone .12s .72s both}
@keyframes ch-bl{from{transform:translateX(-1300px)}to{transform:translateX(-150px)}}@keyframes ch-br{from{transform:translateX(1300px)}to{transform:translateX(150px)}}@keyframes ch-gone{to{opacity:0;scale:1.6}}
.vs-round{font:italic 900 30px 'Exo 2',sans-serif;letter-spacing:8px;${chromeText};border-top:2px solid #c9ced6;border-bottom:2px solid #c9ced6}
.vs-plate{filter:drop-shadow(0 14px 20px rgba(0,0,0,.7))}
.vs-info{left:100px;right:100px}
.vs-name{font:italic 900 98px 'Exo 2',sans-serif;text-transform:uppercase;color:#0b0d12;text-shadow:0 3px 0 rgba(255,255,255,.85)}
.vs-team{font:800 30px 'Exo 2',sans-serif;letter-spacing:6px;color:#39404b;text-transform:uppercase}
.vs-rec span{background:#0b0d12;border-radius:30px}.vs-rec b{color:#fff}.vs-rec i{color:#aeb5bf}.vs-rec small{color:#23272e}
.vs-ava{border-radius:50%;background:linear-gradient(160deg,#fff,#9aa1ad 45%,#3c414a 55%,#e3e6ea);box-shadow:0 0 0 4px #15171c,0 20px 30px rgba(0,0,0,.6)}.vs-ava img,.vs-ini{border-radius:50%;left:10px;top:10px;width:calc(100% - 20px);height:calc(100% - 20px)}
.vs-ini{background:radial-gradient(circle at 40% 30%,#3a3f49,#0b0d12);font:italic 900 130px/1 'Exo 2',sans-serif;color:#f1f3f5}
.vs-art img{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 20px 30px rgba(0,0,0,.7))}
.vs-mark i{position:absolute;left:50%;top:50%;width:320px;height:320px;margin:-160px 0 0 -160px;border-radius:50%;background:radial-gradient(circle,#0b0d12 0 58%,transparent 59%),conic-gradient(#fff,#6b7280,#f1f3f5,#3c414a,#fff,#8d95a1,#fff);box-shadow:0 0 0 4px #15171c,0 20px 40px rgba(0,0,0,.7)}
.vs-mark span{position:relative;display:block;font:italic 900 150px/1 'Exo 2',sans-serif;${chromeText};padding:0 26px 0 10px}
.vs-in .vs-side.s1{animation:ch-s1 .6s .72s cubic-bezier(.1,.9,.2,1) both}.vs-in .vs-side.s2{animation:ch-s2 .6s .72s cubic-bezier(.1,.9,.2,1) both}
@keyframes ch-s1{from{opacity:0;transform:translateX(420px) scale(.4)}to{opacity:1;transform:none}}@keyframes ch-s2{from{opacity:0;transform:translateX(-420px) scale(.4)}to{opacity:1;transform:none}}
.vs-in .vs-mark{animation:ch-mk .6s .72s cubic-bezier(.2,1.5,.4,1) both}@keyframes ch-mk{from{opacity:0;transform:translate(-50%,-50%) scale(.2)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:ch-txt .4s 1.3s both}
/* Victory: on a mirror */
.vc-bg{background:radial-gradient(ellipse 60% 36% at 50% 36%,#3a3f49,transparent 74%),linear-gradient(180deg,#050608,#15171c 42%,#0b0d12 42.2%,#1b1e24)}
.vc-bg2{background:linear-gradient(90deg,transparent,rgba(255,255,255,.6) 50%,transparent);height:2px;top:453px}
.ch-floor.v{top:455px;height:300px}
.vc-round{top:80px;font:italic 900 24px 'Exo 2',sans-serif;letter-spacing:8px;color:#dfe3e8;border-top:2px solid #6b7280;border-bottom:2px solid #6b7280}
.vc-title{top:196px;height:520px;font:italic 900 250px/1 'Exo 2',sans-serif;text-transform:uppercase;letter-spacing:2px}
.vc-title span{${chromeText};padding:0 .14em 0 .06em;filter:drop-shadow(0 0 30px rgba(255,255,255,.25))}
.vc-title .ch-mirror{position:absolute;left:0;right:0;top:206px;display:block;transform:scaleY(-1);opacity:.34;-webkit-mask:linear-gradient(0deg,#000 10%,transparent 70%);mask:linear-gradient(0deg,#000 10%,transparent 70%);filter:blur(1.5px);text-align:center;width:max-content;margin:0 auto}
.vc-card{top:640px}
.vc-ava{border-radius:50%;background:linear-gradient(160deg,#fff,#9aa1ad 45%,#3c414a 55%,#e3e6ea);box-shadow:0 0 0 4px #15171c}.vc-ava img,.vc-ini{border-radius:50%;left:10px;top:10px;width:calc(100% - 20px);height:calc(100% - 20px)}
.vc-ini{background:radial-gradient(circle at 40% 30%,#3a3f49,#0b0d12);font:italic 900 130px/1 'Exo 2',sans-serif;color:#f1f3f5}
.vc-team{font:800 30px 'Exo 2',sans-serif;letter-spacing:6px;color:#aeb5bf;text-transform:uppercase}
.vc-name{font:italic 900 116px/1.1 'Exo 2',sans-serif;text-transform:uppercase;color:#fff;text-shadow:0 4px 0 #3c414a,0 8px 20px rgba(0,0,0,.7)}
.vc-score{background:linear-gradient(180deg,#fff,#c9ced6 50%,#9aa1ad 52%,#e3e6ea);color:#0b0d12;font-family:'Exo 2',sans-serif;font-weight:900;font-style:italic;border-radius:40px;padding:6px 30px}.vc-def{color:#aeb5bf}.vc-def em{color:#fff}
#el-vic[data-pic=art] .ch-mirror{display:none}#el-vic[data-pic=art] .vc-title{height:auto}
.vc-in .vc-title{animation:ch-ttl .9s .25s cubic-bezier(.1,.9,.2,1) both}@keyframes ch-ttl{from{opacity:0;transform:translateX(-500px) skewX(-30deg);filter:brightness(3)}to{opacity:1;transform:none}}
.vc-in .vc-card{animation:ch-card .6s .95s cubic-bezier(.1,.9,.2,1) both}@keyframes ch-card{from{opacity:0;transform:translateX(-50%) translateX(300px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:ch-txt .4s 1.3s both}
`,
  };

  // =========================================================================================== PASTEL: soft candy
  // the scallops reach y 64 and the clay shadow under them takes the last 5 px: all inside the bar
  const PH = 57; let cloud = `M28 0 L${W - 14} 0 Q${W} 0 ${W} 14 L${W} ${A - 8} Q${W} ${A} ${W - 8} ${A} L${B + 14} ${A} Q${B} ${A} ${B} ${A + 14} L${B} ${PH}`; for (let i = 0; i < 8; i++) cloud += ' a30 7 0 0 1 -60 0'; cloud += ` Q42 ${PH + 9} 26 ${PH + 6} A28 31.5 0 0 1 28 0 Z`;
  const CANDY = ['#ff8fc4', '#ffb86b', '#ffe066', '#7ee0b0', '#7cc8ff', '#a48bff'], conf = { type: 'confetti', color: CANDY, spin: 8 };
  let cloudPlate = 'M0 70'; for (let i = 0; i < 8; i++) cloudPlate += ' a57.5 50 0 0 1 115 0'; cloudPlate += ' V206 Q920 250 876 250 H44 Q0 250 0 206 Z';
  const balloons = [[130, '#ff8fc4', 9, 0], [330, '#7cc8ff', 11, -4], [560, '#ffe066', 8, -2], [1250, '#a48bff', 10, -6], [1480, '#7ee0b0', 9, -1], [1700, '#ffb86b', 12, -7], [900, '#ff8fc4', 13, -9]];
  TH.pastel = {
    fonts: [['Fredoka', 700, 'normal', 'fredoka-latin-700-normal.woff2'], ['Fredoka', 600, 'normal', 'fredoka-latin-600-normal.woff2']],
    bar: {
      shape: cloud, h: PH + 2, pad: 30, nameSize: 35, roundSize: 22, introMs: 1300,
      skin: id => `<defs>${lg(id, ['#ffd3ea', '#e7d6ff', '#c4e6ff'], 'h')}</defs><path d="${cloud}" fill="url(#${id})" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
        <path d="M30 8 H${W - 18}" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="20" r="5" fill="rgba(255,255,255,.8)"/>`,
      fx: '<i class="pa-dots"></i>',
      score: scoreBox('round', ['#ffffff', '#f3ecff'], '#8f73ff', 3), center: centerBox('scal', ['#ffffff', '#f1e9ff'], '#d6c7ff', 3),
      onIntro: E => { for (const s of [1, 2]) E.after(420, () => over(E, s, 16, { y: 34, ...conf, speed: [100, 420], g: 700, size: [3, 6], decay: [0.8, 1.4] })); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y, win ? 46 : 22, { ...conf, speed: [160, 560], g: 900, size: [3.5, 7], decay: [0.7, 1.2] }); E.ps.burst(x, y, 8, { type: 'star', color: ['#fff', '#ffe066'], speed: [60, 240], g: 0, size: [7, 15] }); },
      onWin: (E, s) => over(E, s, 60, { y: -6, ...conf, dir: Math.PI / 2, spread: 1.2, speed: [60, 420], g: 520, size: [3.5, 7], decay: [0.4, 0.8], sway: 30 }),
      onLose: (E, s) => { const [x, y] = E.at(s, 270, 30); E.ps.burst(x, y, 10, { type: 'dot', color: '#d9d2e8', rx: 220, speed: [20, 90], g: 60, size: [2, 5], decay: [0.8, 1.4] }); },
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 7 : 1.1)) { const [x, y] = E.at(s, 20 + Math.random() * (B - 30), 2 + Math.random() * 8); E.ps.add({ x, y, type: 'star', color: E.pick(['#ffffff', '#ffe066', '#ff8fc4']), size: E.rand(6, 12), decay: E.rand(1.6, 2.6) }); } },
    },
    vs: {
      inMs: 2500,
      plate: vsPlate(cloudPlate, ['#ffd3ea', '#e7d6ff', '#c4e6ff'], '#ffffff', 7, '', 'h'),
      mark: `<svg viewBox="-170 -170 340 340"><path d="${Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? 118 : 160; return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`; }).join(' ')} Z" fill="#ffe066" stroke="#fff" stroke-width="12" stroke-linejoin="round"/></svg><span>VS</span>`,
      onShow: V => V.later(760, () => { V.ps.burst(960, 470, 150, { ...conf, speed: [300, 1300], g: 900, size: [6, 14], decay: [0.5, 1] }); V.ps.burst(960, 470, 20, { type: 'star', color: ['#fff', '#ffe066'], speed: [100, 500], g: 0, size: [12, 30] }); }),
      tick: (V, dt) => { if (Math.random() < dt * 14) V.ps.add({ x: V.rand(0, 1920), y: -20, vx: V.rand(-30, 30), vy: V.rand(90, 220), vr: V.rand(-6, 6), type: 'confetti', color: V.pick(CANDY), size: V.rand(5, 10), decay: V.rand(0.14, 0.22), sway: 50 }); },
    },
    vic: {
      inMs: 2800,
      title: `<span>${[...'VICTORY'].map((c, i) => `<b style="--i:${i};--c:${[...CANDY, '#ff8fc4'][i]}">${c}</b>`).join('')}</span>`,
      extra: balloons.map(([x, c, d, dl]) => `<i class="pa-bal" style="left:${x}px;--c:${c};animation-duration:${d}s;animation-delay:${dl}s"></i>`).join(''),
      onShow: C => { for (const t of [250, 650, 1100]) C.later(t, () => C.ps.burst(C.rand(500, 1420), C.rand(200, 420), 90, { ...conf, speed: [200, 1000], g: 800, size: [6, 13], decay: [0.45, 0.9] })); },
      tick: (C, dt) => { if (Math.random() < dt * 20) C.ps.add({ x: C.rand(0, 1920), y: -20, vx: C.rand(-30, 30), vy: C.rand(90, 220), vr: C.rand(-6, 6), type: 'confetti', color: C.pick(CANDY), size: C.rand(5, 11), decay: C.rand(0.14, 0.22), sway: 50 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 5px 0 rgba(122,92,255,.4))}
.pa-dots{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.6) 2.4px,transparent 3px) 0 0/26px 26px;animation:pa-dots 5s linear infinite}@keyframes pa-dots{to{background-position:52px 26px}}
.el-name{font-family:'Fredoka',sans-serif;font-weight:700;color:#3b2a9c;text-shadow:0 2px 0 rgba(255,255,255,.9)}
.el-team{font:600 22px 'Fredoka',sans-serif;color:#a3246f}
.el-pro{color:#4b3aa0}.el-st{color:#a3246f}.el-l2{font-family:'Fredoka',sans-serif;font-weight:600;letter-spacing:1.6px}.el-ltag{background:#3b2a9c;color:#fff;border-radius:9px}
.el-num{font:700 40px/1 'Fredoka',sans-serif;color:#4a2fc4}.el-lbl{color:#3b2a9c;font-family:'Fredoka',sans-serif;font-size:11px}#el{--pip:#7a5cff}.el-pip{transform:none;border-radius:50%;border-width:2px;background:#fff}.el-pip.on{background:#7a5cff}
.el-meta{color:#3b2a9c}.el-dot{color:#ff8fc4}.el-round{font-family:'Fredoka',sans-serif;font-weight:700;color:#3b2a9c;text-transform:none}
.champ .el-mir{filter:drop-shadow(0 5px 0 rgba(122,92,255,.5)) drop-shadow(0 0 14px #fff)}.champ .el-who{animation:pa-bob 1.1s ease-in-out infinite}@keyframes pa-bob{50%{transform:translateY(-3px)}}
.el-plate{transform-origin:50% 0}.won.el-plate{animation:pa-jump .8s cubic-bezier(.3,1.8,.5,1)}@keyframes pa-jump{0%{transform:scale(1)}30%{transform:scale(1.07,.86)}60%{transform:scale(.96,1.08)}100%{transform:none}}
.scored .el-score{animation:pa-pop .6s cubic-bezier(.3,2,.5,1)}@keyframes pa-pop{0%{transform:scale(.6)}100%{transform:none}}
.lost .el-mir{filter:saturate(.25) brightness(.9);transform:scaleY(.94);transform-origin:50% 0;transition:transform .8s cubic-bezier(.3,1.5,.5,1)}.p2.lost .el-mir{transform:scaleX(-1) scaleY(.94)}.lost .el-who{opacity:.72}
.el-intro .el-plate,.el-intro .el-center{animation:pa-in .8s cubic-bezier(.3,1.7,.5,1) both}.el-intro .el-plate.p2{animation-delay:.14s}.el-intro .el-center{animation-delay:.28s}
@keyframes pa-in{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
/* VS: two clouds bump */
.vs-bg{background:radial-gradient(ellipse 30% 10% at 20% 22%,#fff,transparent 70%),radial-gradient(ellipse 26% 9% at 78% 30%,#fff,transparent 70%),radial-gradient(ellipse 34% 10% at 50% 62%,rgba(255,255,255,.8),transparent 70%),linear-gradient(180deg,#c4e6ff,#e7d6ff 50%,#ffd3ea)}
.vs-bg2{background:radial-gradient(circle,rgba(255,255,255,.7) 4px,transparent 5px) 0 0/90px 90px;animation:pa-dots 14s linear infinite;opacity:.6}
.vs-round{font:700 32px 'Fredoka',sans-serif;letter-spacing:4px;color:#3b2a9c;background:#fff;border-radius:40px;box-shadow:0 6px 0 rgba(122,92,255,.4);padding:8px 44px}
.vs-plate{filter:drop-shadow(0 9px 0 rgba(122,92,255,.4))}
.vs-info{top:770px;height:218px}
.vs-name{font:700 104px 'Fredoka',sans-serif;color:#3b2a9c;text-shadow:0 4px 0 rgba(255,255,255,.9)}
.vs-team{font:600 34px 'Fredoka',sans-serif;letter-spacing:3px;color:#a3246f}
.vs-rec span{background:#fff;border-radius:30px;box-shadow:0 3px 0 rgba(122,92,255,.4)}.vs-rec b{font-family:'Fredoka',sans-serif;color:#4a2fc4}.vs-rec i{color:#7a5cff}.vs-rec small{color:#3b2a9c;font-family:'Fredoka',sans-serif}
.vs-ava{border-radius:50%;background:#fff;box-shadow:0 9px 0 rgba(122,92,255,.4)}.vs-ava img,.vs-ini{border-radius:50%;left:10px;top:10px;width:calc(100% - 20px);height:calc(100% - 20px)}
.vs-ini{background:linear-gradient(160deg,#ff8fc4,#a48bff);color:#fff;font:700 140px/1 'Fredoka',sans-serif}
.vs-art img{filter:drop-shadow(0 0 0 #fff) drop-shadow(0 10px 0 rgba(122,92,255,.35))}
.vs-mark svg{position:absolute;left:50%;top:50%;width:360px;height:360px;margin:-180px 0 0 -180px;filter:drop-shadow(0 9px 0 rgba(122,92,255,.4));animation:pa-spin 16s linear infinite}@keyframes pa-spin{to{transform:rotate(360deg)}}
.vs-mark span{position:relative;display:block;font:700 150px/1 'Fredoka',sans-serif;color:#ff5fa8;-webkit-text-stroke:12px #fff;paint-order:stroke fill;filter:drop-shadow(0 6px 0 rgba(122,92,255,.5))}
.vs-in .vs-side.s1{animation:pa-s1 1s cubic-bezier(.3,1,.4,1) both}.vs-in .vs-side.s2{animation:pa-s2 1s cubic-bezier(.3,1,.4,1) both}
@keyframes pa-s1{0%{transform:translateX(-1100px)}55%{transform:translateX(40px) scaleX(.9)}75%{transform:translateX(-26px) scaleX(1.04)}100%{transform:none}}@keyframes pa-s2{0%{transform:translateX(1100px)}55%{transform:translateX(-40px) scaleX(.9)}75%{transform:translateX(26px) scaleX(1.04)}100%{transform:none}}
.vs-in .vs-mark{animation:pa-mk .7s .7s cubic-bezier(.3,1.9,.5,1) both}@keyframes pa-mk{from{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(-90deg)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:pa-fade .5s 1.1s both}@keyframes pa-fade{from{opacity:0}to{opacity:1}}
/* Victory: a party */
.vc-bg{background:radial-gradient(ellipse 30% 10% at 18% 78%,#fff,transparent 70%),radial-gradient(ellipse 26% 9% at 82% 70%,#fff,transparent 70%),linear-gradient(180deg,#c4e6ff,#e7d6ff 50%,#ffd3ea)}
.vc-bg2{background:radial-gradient(circle,rgba(255,255,255,.7) 4px,transparent 5px) 0 0/90px 90px;animation:pa-dots 14s linear infinite;opacity:.6}
.pa-bal{position:absolute;bottom:-300px;width:120px;height:146px;border-radius:50%/46% 46% 54% 54%;background:radial-gradient(ellipse 18% 24% at 30% 26%,rgba(255,255,255,.85) 0 98%,transparent 100%),var(--c);animation:pa-float 10s linear infinite}
.pa-bal::after{content:'';position:absolute;left:50%;top:100%;width:3px;height:150px;margin-left:-1px;background:rgba(122,92,255,.45)}
@keyframes pa-float{from{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-800px) rotate(6deg)}to{transform:translateY(-1600px) rotate(-5deg)}}
.vc-round{top:90px;font:700 28px 'Fredoka',sans-serif;letter-spacing:4px;color:#3b2a9c;background:#fff;border-radius:40px;box-shadow:0 6px 0 rgba(122,92,255,.4);padding:8px 44px}
.vc-title{top:190px;font:700 250px/1 'Fredoka',sans-serif;letter-spacing:6px}.vc-title,.vc-card,.vc-round{z-index:2}
.vc-title b{display:inline-block;color:var(--c);-webkit-text-stroke:16px #fff;paint-order:stroke fill;filter:drop-shadow(0 9px 0 rgba(122,92,255,.5));animation:pa-letter 1.5s calc(var(--i) * .1s) ease-in-out infinite}@keyframes pa-letter{0%,100%{transform:none}50%{transform:translateY(-22px) rotate(calc((var(--i) - 3) * 1.5deg))}}
.vc-card{top:580px;background:#fff;border-radius:150px;padding:18px 70px 18px 18px;box-shadow:0 10px 0 rgba(122,92,255,.4)}
.vc-ava{border-radius:50%;background:linear-gradient(160deg,#ff8fc4,#a48bff);width:220px;height:220px}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:linear-gradient(160deg,#ff8fc4,#a48bff);color:#fff;font:700 130px/1 'Fredoka',sans-serif}
.vc-team{font:600 32px 'Fredoka',sans-serif;letter-spacing:3px;color:#a3246f}
.vc-name{font:700 108px/1.1 'Fredoka',sans-serif;color:#3b2a9c}
.vc-score{background:#7a5cff;color:#fff;font-family:'Fredoka',sans-serif;border-radius:40px;padding:6px 30px}.vc-def{color:#4b3aa0;font-family:'Fredoka',sans-serif}.vc-def em{color:#3b2a9c}
#el-vic[data-pic=art] .vc-card{padding:18px 50px}#el-vic[data-pic=art] .vc-title{font-size:150px!important}
.vc-in .vc-title b{animation:pa-drop .7s calc(.15s + var(--i) * .08s) cubic-bezier(.3,1.8,.5,1) both}@keyframes pa-drop{from{opacity:0;transform:translateY(-500px) rotate(-30deg)}to{opacity:1;transform:none}}
.vc-in .vc-card{animation:pa-card .7s 1s cubic-bezier(.3,1.7,.5,1) both}@keyframes pa-card{from{opacity:0;transform:translateX(-50%) scale(.3)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:pa-fade .5s 1.4s both}
`,
  };
  delete TH._;
})();
