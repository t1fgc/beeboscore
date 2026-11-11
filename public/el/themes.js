/* BeeboScore (developed by Beebo) — the ten elemental layouts: what each one is made of.
 *
 * Every theme below is a whole layout of its own: the shape of its player bars, its lettering, colours, effects and
 * animations, its VS Splash and its Victory Splash. public/el/elemental.js is the part they share.
 *
 *   bar   shape (the plate outline, player-1 side; player 2 is mirrored), skin / score / center (SVG), pad (room kept
 *         clear at the outer end), nameSize, and the moments: onIntro, onScore, onWin, onLose, tick (every frame)
 *   vs    plate (the 920 × 250 name bar), mark (the "VS"), extra, and onShow / onHide / tick
 *   vic   title, extra, and onShow / tick
 *   css   everything else. Only the chosen theme's CSS is put in the page, so selectors need no prefix.
 *
 * Scores: every score sits in a solid box with at least 7:1 contrast, 30 px or larger, and stays that way for the loser.
 */
(() => {
  'use strict';
  const W = 654, H = 69, A = 31, B = 540;
  const R = { bevel: `L${W} 0 L${W} ${A} L${B + 12} ${A} L${B} ${A + 12} L${B} ${H}`, sq: `L${W} 0 L${W} ${A} L${B} ${A} L${B} ${H}`, rnd: `L${W - 14} 0 Q${W} 0 ${W} 14 L${W} ${A - 8} Q${W} ${A} ${W - 8} ${A} L${B + 14} ${A} Q${B} ${A} ${B} ${A + 14} L${B} ${H}` };
  const lg = (id, stops, dir) => `<linearGradient id="${id}" x1="0" y1="0" x2="${dir === 'h' ? 1 : 0}" y2="${dir === 'h' ? 0 : 1}">${stops.map((c, i) => Array.isArray(c) ? `<stop offset="${c[0]}" stop-color="${c[1]}"/>` : `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const SCORE = { skew: 'M8 0 L66 0 L58 50 L0 50 Z', box: 'M0 0 L66 0 L66 50 L0 50 Z', round: 'M12 0 L54 0 Q66 0 66 12 L66 38 Q66 50 54 50 L12 50 Q0 50 0 38 L0 12 Q0 0 12 0 Z', hex: 'M13 0 L53 0 L66 25 L53 50 L13 50 L0 25 Z', circ: 'M33 -1 A26 26 0 1 1 32.9 -1 Z' };
  const CENTER = { tag: 'M0 0 L260 0 L260 30 L246 44 L14 44 L0 30 Z', slab: 'M0 0 L260 0 L260 44 L0 44 Z', pill: 'M0 0 L260 0 L260 22 Q260 44 238 44 L22 44 Q0 44 0 22 Z', point: 'M0 0 L260 0 L260 35 L130 44 L0 35 Z', scal: 'M0 0 L260 0 L260 36 a26 8 0 0 1 -52 0 a26 8 0 0 1 -52 0 a26 8 0 0 1 -52 0 a26 8 0 0 1 -52 0 a26 8 0 0 1 -52 0 Z' };
  const scoreBox = (shape, stops, stroke, sw = 2) => id => `<defs>${lg(id, stops)}</defs><path d="${SCORE[shape]}" fill="url(#${id})" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const centerBox = (shape, stops, stroke, sw = 2, extra = '') => id => `<defs>${lg(id, stops)}</defs><path d="${CENTER[shape]}" fill="url(#${id})" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>${extra}`;
  const vsPlate = (d, stops, stroke, sw, extra = '', dir) => id => `<defs>${lg(id, stops, dir)}</defs><path d="${d}" fill="url(#${id})" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>${typeof extra === 'function' ? extra(id) : extra}`;
  const over = (E, side, n, o) => { const x = E.x0(side); for (let i = 0; i < n; i++) E.ps.burst(x + Math.random() * B, o.y ?? -6, 1, o); };      // n particles somewhere over a plate
  const TH = window.EL_THEMES = {};

  // =========================================================================================== FROSTBITE: ice
  // the plate's solid part is 60 high; icicles are cut into the 9 px under it, so nothing hangs below the bar (the game's health bars start there)
  const IH = 60, iceBody = `M0 26 L26 0 ${R.bevel} L${B - 12} ${IH} L30 ${IH} L0 42 Z`;
  const icicles = [[84, 96, 91, 5], [170, 188, 180, 9], [286, 300, 294, 6], [384, 402, 395, 9], [468, 486, 478, 7]];      // [from, to, tip x, length]
  TH.frostbite = {
    fonts: [['Michroma', 400, 'normal', 'michroma-latin-400-normal.woff2']],
    bar: {
      shape: iceBody, h: IH, pad: 30, nameSize: 26, roundSize: 14, introMs: 1500,
      skin: id => `<defs>${lg(id, ['#f4fbff', '#b4def7', '#69b0de'])}<pattern id="${id}h" width="20" height="34" patternUnits="userSpaceOnUse"><path d="M10 0 L20 6 L20 17 L10 23 L0 17 L0 6 Z M10 23 V34" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1"/></pattern></defs>
        <g class="fb-ici">${icicles.map(([a, b, x, l]) => `<path d="M${a} ${IH - 1} L${b} ${IH - 1} L${x} ${IH + l} Z" fill="url(#${id})" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`).join('')}</g>
        <path d="${iceBody}" fill="url(#${id})" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/><path d="${iceBody}" fill="url(#${id}h)"/>
        <path d="M30 5 L${W - 6} 5" stroke="rgba(255,255,255,.9)" stroke-width="2"/>`,
      fx: '<i class="fb-glow"></i><i class="fb-glint"></i>',
      score: scoreBox('hex', ['#14405f', '#07182a'], '#e6f6ff'), center: centerBox('point', ['#f4fbff', '#b4def7'], '#ffffff'),
      onIntro: E => { for (const s of [1, 2]) over(E, s, 26, { y: 40, type: 'flake', color: ['#fff', '#dff3ff'], speed: [20, 160], g: 60, decay: [0.5, 1.1], size: [1.5, 3.5], sway: 30 }); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y, win ? 46 : 22, { type: 'shard', color: ['#ffffff', '#cfeeff', '#8fd3ff'], speed: [140, 520], g: 1100, size: [4, 9], spin: 9, decay: [0.9, 1.6] }); E.ps.add({ x, y, type: 'ring', size: 12, color: '#dff3ff', decay: 1.8 }); },
      onWin: (E, s) => over(E, s, 50, { y: 30, type: 'flake', color: ['#fff', '#cfeeff'], speed: [30, 220], g: 90, decay: [0.4, 0.9], size: [2, 4], sway: 40 }),
      onLose: (E, s) => { for (const [, , x, l] of icicles) { const [px, py] = E.at(s, x, IH + l / 2); E.ps.burst(px, py, 5, { type: 'shard', color: ['#dff3ff', '#9fd4f5'], dir: Math.PI / 2, spread: 1.2, speed: [40, 240], g: 1400, size: [4, 8], spin: 8, decay: [0.8, 1.3] }); } },
      tick: (E, dt) => { for (const s of [1, 2]) if (E.lost !== s && Math.random() < dt * (E.champ === s ? 9 : 1.6)) { const [x, y] = E.at(s, 20 + Math.random() * (B - 40), 6 + Math.random() * 46); E.ps.add({ x, y, vx: E.rand(-8, 8), vy: E.rand(4, 12), type: 'flake', color: '#ffffff', size: E.rand(1, 2.2), decay: E.rand(0.8, 1.4), sway: 8, a: 0.85 }); } },
    },
    vs: {
      inMs: 2600,
      plate: vsPlate('M0 44 L44 0 L876 0 L920 44 L920 250 L800 250 L788 290 L772 250 L600 250 L589 306 L574 250 L380 250 L372 278 L360 250 L180 250 L168 296 L154 250 L0 250 Z', ['#f4fbff', '#b4def7', '#69b0de'], '#ffffff', 3, '<path d="M50 9 L870 9" stroke="rgba(255,255,255,.9)" stroke-width="3"/>'),
      mark: '<i></i><span>VS</span>',
      onShow: V => { V.ps.burst(960, 540, 260, { type: 'flake', color: ['#fff', '#dff3ff'], rx: 960, ry: 540, dir: 0.3, spread: 0.7, speed: [500, 1500], g: 40, decay: [0.5, 1], size: [2, 6], sway: 60 }); V.later(900, () => { V.flash(500); V.ps.burst(960, 470, 70, { type: 'shard', color: ['#fff', '#cfeeff', '#8fd3ff'], speed: [200, 900], g: 700, size: [5, 13], spin: 8 }); }); },
      tick: (V, dt) => { if (Math.random() < dt * 34) V.ps.add({ x: V.rand(-60, 1920), y: -10, vx: V.rand(20, 90), vy: V.rand(60, 190), type: 'flake', color: '#fff', size: V.rand(1.5, 4.5), decay: V.rand(0.12, 0.22), sway: 40, a: 0.85 }); },
    },
    vic: {
      inMs: 2800,
      onShow: C => { C.flash(700); C.ps.burst(960, 300, 120, { type: 'flake', color: ['#fff', '#cfeeff'], rx: 700, speed: [60, 420], g: 60, decay: [0.3, 0.7], size: [2, 6], sway: 50 }); },
      tick: (C, dt) => { if (Math.random() < dt * 30) C.ps.add({ x: C.rand(0, 1920), y: -10, vx: C.rand(-30, 30), vy: C.rand(50, 160), type: 'flake', color: '#fff', size: C.rand(1.5, 4.5), decay: C.rand(0.1, 0.2), sway: 45, a: 0.85 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 0 9px rgba(143,211,255,.75))}
.fb-ici{transition:opacity .5s}.lost .fb-ici{opacity:0}
.fb-glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 120% at 45% 50%,rgba(255,255,255,.95),transparent 70%);opacity:0;transition:opacity .8s}
.champ .fb-glow{opacity:.75;animation:fb-breathe 2.4s ease-in-out infinite}@keyframes fb-breathe{50%{opacity:.4}}
.fb-glint{position:absolute;top:0;left:-30%;width:22%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.85),transparent);animation:fb-glint 7s ease-in-out infinite}@keyframes fb-glint{0%,72%{left:-30%}100%{left:120%}}
.el-name{font-family:'Michroma',sans-serif;letter-spacing:2px;text-transform:uppercase;color:#0b2e4a;text-shadow:0 1px 0 rgba(255,255,255,.8)}
.el-team{font:400 15px 'Michroma',sans-serif;letter-spacing:1px;color:#0f5f96;text-transform:uppercase}
.el-pro{color:#2b5b7e}.el-st{color:#0c5488}.el-ltag{background:#0b2e4a;color:#eaf7ff}
.el-num{font:400 30px/1 'Michroma',sans-serif;color:#f2faff}.el-lbl{color:#0b2e4a}#el{--pip:#0f5f96}
.el-meta{color:#0c5488}.el-dot{color:#5a8fb5}.el-round{font-family:'Michroma',sans-serif;color:#0b2e4a;letter-spacing:1px}
.champ .el-mir{filter:drop-shadow(0 0 18px #bfe8ff) drop-shadow(0 0 4px #fff)}
.lost .el-mir{filter:saturate(.22) brightness(.84)}.lost .el-who{opacity:.72}
.el-intro .el-mir{animation:fb-in 1.2s cubic-bezier(.2,.8,.2,1) both;transform-origin:100% 50%}.el-intro .el-who,.el-intro .el-score{animation:fb-txt .6s .7s both}
@keyframes fb-in{0%{opacity:0;scale:.5 1;filter:brightness(3) blur(6px)}60%{opacity:1;filter:brightness(1.6) blur(0)}100%{scale:1}}@keyframes fb-txt{from{opacity:0;letter-spacing:8px}to{opacity:1}}
/* VS: a blizzard parts */
.vs-bg{background:radial-gradient(ellipse 90% 70% at 50% 110%,#2b7fb8,transparent 70%),linear-gradient(180deg,#041320,#0b3554 60%,#0f4d78)}
.vs-bg2{background:repeating-linear-gradient(100deg,transparent 0 26px,rgba(255,255,255,.05) 26px 30px);animation:fb-wind 1.6s linear infinite}@keyframes fb-wind{to{background-position:300px 0}}
.vs-in .vs-bg2{animation:fb-wind .5s linear infinite,fb-white 1.2s both}@keyframes fb-white{0%{background-color:#fff}100%{background-color:transparent}}
.vs-round{font-family:'Michroma',sans-serif;font-size:21px;color:#eaf7ff;border-top:2px solid #fff;border-bottom:2px solid #fff;background:rgba(6,30,50,.65)}
.vs-plate{filter:drop-shadow(0 0 18px rgba(143,211,255,.7))}
.vs-name{font:400 74px 'Michroma',sans-serif;text-transform:uppercase;letter-spacing:3px;color:#0b2e4a;text-shadow:0 2px 0 rgba(255,255,255,.8)}
.vs-team{font:400 26px 'Michroma',sans-serif;letter-spacing:3px;color:#0f5f96;text-transform:uppercase}
.vs-rec span{background:#0b2e4a;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%)}.vs-rec b{color:#f2faff}.vs-rec i{color:#8fd3ff}.vs-rec small{color:#0b2e4a}
.vs-ava{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:linear-gradient(180deg,#fff,#8fd3ff)}.vs-ava img,.vs-ini{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}
.vs-ini{background:linear-gradient(180deg,#12395a,#07182a);color:#eaf7ff;font-family:'Michroma',sans-serif;font-size:120px}
.vs-art img{filter:drop-shadow(0 0 30px rgba(143,211,255,.55))}
.vs-mark span{display:block;font:400 150px/1 'Michroma',sans-serif;color:#fff;text-shadow:0 0 30px #2fa8ff,0 0 6px #fff,0 6px 0 #0b2e4a}
.vs-mark i{position:absolute;left:50%;top:50%;width:330px;height:286px;transform:translate(-50%,-50%);clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:rgba(207,238,255,.16);border:0}
.vs-in .vs-side.s1{animation:fb-s1 .9s .5s cubic-bezier(.2,.9,.2,1) both}.vs-in .vs-side.s2{animation:fb-s2 .9s .5s cubic-bezier(.2,.9,.2,1) both}
@keyframes fb-s1{from{opacity:0;transform:translateX(-260px);filter:blur(14px)}to{opacity:1;transform:none}}@keyframes fb-s2{from{opacity:0;transform:translateX(260px);filter:blur(14px)}to{opacity:1;transform:none}}
.vs-in .vs-mark{animation:fb-mk .7s .9s cubic-bezier(.2,1.3,.4,1) both}@keyframes fb-mk{from{opacity:0;transform:translate(-50%,-50%) scale(2.6);filter:blur(10px)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:fb-txt .6s 1.3s both}
/* Victory: aurora and snowfall */
.vc-bg{background:linear-gradient(180deg,#020b16,#07263f 55%,#0d456d)}
.vc-bg2{height:620px;background:linear-gradient(90deg,transparent,rgba(120,255,214,.34) 18%,rgba(90,180,255,.3) 40%,rgba(170,120,255,.3) 62%,rgba(120,255,214,.3) 82%,transparent);filter:blur(46px);transform-origin:50% 0;animation:fb-aur 9s ease-in-out infinite alternate;-webkit-mask:linear-gradient(180deg,#000,transparent);mask:linear-gradient(180deg,#000,transparent)}
@keyframes fb-aur{0%{transform:skewX(-14deg) scaleY(.8);opacity:.6}100%{transform:skewX(12deg) scaleY(1.1);opacity:1}}
.vc-round{font-family:'Michroma',sans-serif;font-size:20px;color:#cfeeff;border-top:2px solid rgba(255,255,255,.8);border-bottom:2px solid rgba(255,255,255,.8)}
.vc-title{top:200px;font:400 150px/1 'Michroma',sans-serif;letter-spacing:26px;text-transform:uppercase}
.vc-title span{background:linear-gradient(180deg,#fff,#cfeeff 55%,#6fbcec);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 26px rgba(143,211,255,.9)) drop-shadow(0 4px 0 #0b2e4a)}
.vc-card{top:520px}
.vc-ava{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:linear-gradient(180deg,#fff,#8fd3ff)}.vc-ava img,.vc-ini{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}
.vc-ini{background:linear-gradient(180deg,#12395a,#07182a);color:#eaf7ff;font-family:'Michroma',sans-serif}
.vc-team{font:400 26px 'Michroma',sans-serif;letter-spacing:4px;color:#8fd3ff;text-transform:uppercase}
.vc-name{font:400 84px/1.1 'Michroma',sans-serif;text-transform:uppercase;letter-spacing:3px;color:#fff;text-shadow:0 0 24px rgba(47,168,255,.9),0 4px 0 #0b2e4a}
.vc-score{background:linear-gradient(180deg,#f4fbff,#9fd4f5);color:#0b2e4a;clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,14px 100%,0 50%);padding:8px 34px 6px}.vc-def{color:#cfeeff}.vc-def em{color:#fff}
.vc-pic img{filter:drop-shadow(0 0 34px rgba(143,211,255,.5))}
.vc-in .vc-title{animation:fb-ttl 1.1s .2s cubic-bezier(.2,.8,.2,1) both}@keyframes fb-ttl{from{opacity:0;letter-spacing:120px;filter:blur(16px)}to{opacity:1}}
.vc-in .vc-card{animation:fb-card .8s .9s both}@keyframes fb-card{from{opacity:0;transform:translateX(-50%) translateY(40px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:fb-txt .6s 1.4s both}
`,
  };

  // =========================================================================================== VENOM: toxic slime
  // the plate's solid part is 59 high; the drips are in the 10 px under it, so nothing hangs below the bar
  const VH = 59, drips = [[463, 9, 9], [345, 5, 7], [213, 10, 11], [112, 6, 8]];              // [middle, length, half width]
  const dripShape = `M10 0 ${R.rnd} Q${B - 3} ${VH + 2} ${B - 18} ${VH} ${drips.map(([x, l, w]) => `L${x + w} ${VH} C${x + w} ${VH + l * 1.3} ${x - w} ${VH + l * 1.3} ${x - w} ${VH}`).join(' ')} L10 ${VH} Q0 ${VH} 0 ${VH - 10} L0 10 Q0 0 10 0 Z`;
  const slime = { type: 'drop', color: ['#7dff3a', '#b6ff7a', '#2fae12'] };
  TH.venom = {
    fonts: [['Creepster', 400, 'normal', 'creepster-latin-400-normal.woff2']],
    bar: {
      shape: dripShape, h: VH, pad: 20, nameSize: 37, roundSize: 24, introMs: 1300,
      skin: id => `<defs>${lg(id, ['#27401c', '#101c0b', '#070d05'])}</defs><path d="${dripShape}" fill="url(#${id})" stroke="#7dff3a" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M14 6 Q${B / 2} 0 ${W - 12} 6" fill="none" stroke="rgba(212,255,138,.5)" stroke-width="3" stroke-linecap="round"/>`,
      fx: '<i class="vn-ooze"></i>',
      score: scoreBox('circ', ['#b4ff72', '#39c416'], '#06210a', 2.5), center: centerBox('pill', ['#27401c', '#070d05'], '#7dff3a', 2.5),
      onIntro: E => { for (const s of [1, 2]) over(E, s, 16, { y: VH, ...slime, dir: Math.PI / 2, spread: 0.6, speed: [60, 300], g: 900, size: [3, 7], decay: [0.9, 1.5] }); },
      onScore: (E, s, x, y, win) => { E.ps.burst(x, y, win ? 40 : 20, { ...slime, speed: [120, 460], g: 1100, size: [3, 8], decay: [0.9, 1.5] }); E.ps.burst(x, y, 8, { type: 'bubble', color: '#b6ff7a', speed: [40, 160], g: -120, size: [4, 10], decay: [1, 1.8] }); },
      onWin: (E, s) => over(E, s, 34, { y: H + 4, type: 'bubble', color: ['#7dff3a', '#d4ff8a'], dir: Math.PI / 2, spread: 1.6, speed: [30, 160], g: -60, size: [3, 11], decay: [0.8, 1.5] }),
      onLose: (E, s) => { for (const [x, l] of drips) { const [px, py] = E.at(s, x, VH + l); E.ps.burst(px, py, 7, { ...slime, dir: Math.PI / 2, spread: 0.5, speed: [30, 200], g: 1200, size: [4, 8], decay: [0.7, 1.2] }); } },
      tick: (E, dt) => {
        for (const s of [1, 2]) {
          if (Math.random() < dt * (E.champ === s ? 16 : 3.5) && E.lost !== s) { const [x, y] = E.at(s, 20 + Math.random() * (B - 110), VH - 6); E.ps.add({ x, y, vy: -E.rand(8, 18), type: 'bubble', color: '#7dff3a', size: E.rand(2, 4.5), decay: E.rand(1.5, 2.4), sway: 6, a: 0.6 }); }
          // (the drips themselves stay put: nothing falls off the bar while a game is on)
        }
      },
    },
    vs: {
      inMs: 2500,
      plate: vsPlate('M24 0 L896 0 Q920 0 920 24 L920 250 L800 250 C800 318 754 318 754 250 L560 250 C560 286 532 286 532 250 L330 250 C330 334 280 334 280 250 L150 250 C150 290 118 290 118 250 L0 250 L0 24 Q0 0 24 0 Z', ['#27401c', '#101c0b', '#070d05'], '#7dff3a', 4, '<path d="M30 12 Q460 0 890 12" fill="none" stroke="rgba(212,255,138,.45)" stroke-width="5" stroke-linecap="round"/>'),
      extra: '<svg class="vn-top" viewBox="0 0 1920 300" preserveAspectRatio="none"><path d="M0 0 H1920 V70 C1860 70 1850 200 1800 200 C1750 200 1740 90 1680 90 C1600 90 1600 150 1540 150 C1480 150 1470 60 1400 60 C1330 60 1320 260 1260 260 C1200 260 1190 80 1120 80 C1050 80 1040 130 980 130 C920 130 900 50 840 50 C770 50 760 220 700 220 C640 220 630 100 560 100 C490 100 480 170 420 170 C360 170 340 70 280 70 C210 70 200 240 140 240 C80 240 70 60 0 60 Z" fill="#17300f" stroke="#7dff3a" stroke-width="4"/></svg>',
      onShow: V => V.later(820, () => { V.shake(); V.ps.burst(960, 470, 110, { ...slime, speed: [200, 1100], g: 1200, size: [5, 14], decay: [0.6, 1.2] }); V.ps.burst(960, 470, 30, { type: 'bubble', color: '#b6ff7a', speed: [60, 300], g: -100, size: [6, 18], decay: [0.6, 1.2] }); }),
      tick: (V, dt) => { if (Math.random() < dt * 16) V.ps.add({ x: V.rand(0, 1920), y: 1090, vy: -V.rand(60, 200), type: 'bubble', color: V.pick(['#7dff3a', '#b6ff7a', '#2fae12']), size: V.rand(4, 20), decay: V.rand(0.14, 0.3), sway: 30, a: 0.7 }); },
    },
    vic: {
      inMs: 2600,
      onShow: C => C.later(500, () => C.ps.burst(960, 300, 120, { ...slime, rx: 420, speed: [100, 800], g: 1000, size: [5, 13], decay: [0.6, 1.2] })),
      tick: (C, dt) => { if (Math.random() < dt * 22) C.ps.add({ x: C.rand(0, 1920), y: 1090, vy: -C.rand(70, 240), type: 'bubble', color: C.pick(['#7dff3a', '#b6ff7a', '#2fae12']), size: C.rand(4, 24), decay: C.rand(0.12, 0.28), sway: 34, a: 0.7 }); },
    },
    css: `
.el-mir{filter:drop-shadow(0 0 10px rgba(91,255,42,.7))}
.vn-ooze{position:absolute;left:0;right:0;top:0;height:${VH + 10}px;background:linear-gradient(0deg,rgba(125,255,58,.28),transparent)}
.el-name{font-family:'Creepster',cursive;letter-spacing:2px;text-transform:uppercase;background:linear-gradient(180deg,#f1ffc4,#8dff4a 55%,#3fc21c);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 #041a07)}
.el-team{font:400 21px 'Creepster',cursive;letter-spacing:1.5px;color:#d4ff8a;text-transform:uppercase}
.el-pro{color:#b9d6aa}.el-st{color:#b6ff7a}.el-ltag{background:#7dff3a;color:#06210a}
.el-num{color:#041a07}.el-lbl{color:rgba(240,255,225,.8)}#el{--pip:#7dff3a}.el-pip{border-radius:50%;transform:none}
.el-meta{color:#d4ff8a}.el-dot{color:#5f8a4a}.el-round{font-family:'Creepster',cursive;color:#8dff4a;letter-spacing:1.5px}
.champ .el-mir{animation:vn-pulse 1.3s ease-in-out infinite}@keyframes vn-pulse{0%,100%{filter:drop-shadow(0 0 10px rgba(91,255,42,.8))}50%{filter:drop-shadow(0 0 26px #7dff3a) brightness(1.25)}}
.lost .el-mir{filter:saturate(.25) brightness(.5);transform:scaleX(-1) scaleY(.93) skewX(2deg);transform-origin:50% 0;transition:transform 1s cubic-bezier(.3,0,.2,1),filter .8s}
.p1.lost .el-mir{transform:scaleY(.93) skewX(-2deg)}.lost .el-who{opacity:.75}
.el-intro .el-mir{animation:vn-in 1s cubic-bezier(.3,1.3,.5,1) both}
@keyframes vn-in{0%{opacity:0;clip-path:inset(0 0 100% 0)}100%{opacity:1;clip-path:inset(0 0 -60px 0)}}
.el-intro .el-who,.el-intro .el-score{animation:vn-txt .5s .7s both}@keyframes vn-txt{from{opacity:0;transform:translateY(-14px)}to{opacity:1}}
/* VS: acid splash */
.vs-bg{background:radial-gradient(ellipse 70% 60% at 50% 100%,#2d6a16,transparent 70%),radial-gradient(circle at 50% 44%,#18300f,#050a04 70%)}
.vn-top{position:absolute;left:0;top:0;width:1920px;height:300px;filter:drop-shadow(0 0 14px rgba(91,255,42,.6))}
.has-hdr .vn-top{display:none}
.vs-round{top:26px;font:400 34px 'Creepster',cursive;letter-spacing:5px;color:#d4ff8a;text-shadow:0 2px 0 #041a07;z-index:2}.has-hdr .vs-round{top:214px}
.vs-plate{filter:drop-shadow(0 0 18px rgba(91,255,42,.65))}
.vs-name{font:400 112px 'Creepster',cursive;letter-spacing:4px;text-transform:uppercase;background:linear-gradient(180deg,#f1ffc4,#8dff4a 55%,#3fc21c);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 0 #041a07)}
.vs-team{font:400 34px 'Creepster',cursive;letter-spacing:3px;color:#d4ff8a;text-transform:uppercase}
.vs-rec span{background:#7dff3a;border-radius:26px}.vs-rec b{color:#041a07}.vs-rec i{color:#0f4a08}.vs-rec small{color:#b9d6aa}
.vs-ava{border-radius:50%;background:linear-gradient(180deg,#d4ff8a,#2fae12);box-shadow:0 0 30px rgba(91,255,42,.7)}.vs-ava img,.vs-ini{border-radius:50%}
.vs-ini{background:radial-gradient(circle at 40% 30%,#27401c,#070d05);color:#8dff4a;font-family:'Creepster',cursive}
.vs-art img{filter:drop-shadow(0 0 28px rgba(91,255,42,.6))}
.vs-mark span{display:block;font:400 230px/1 'Creepster',cursive;letter-spacing:6px;background:linear-gradient(180deg,#f1ffc4,#8dff4a 50%,#2fae12);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 #041a07) drop-shadow(0 0 30px rgba(91,255,42,.8))}
.vs-in .vn-top{animation:vn-top 1s cubic-bezier(.3,1.2,.5,1) both}@keyframes vn-top{from{transform:translateY(-110%)}to{transform:none}}
.vs-in .vs-side{animation:vn-side .8s .35s cubic-bezier(.3,1.4,.5,1) both}@keyframes vn-side{from{opacity:0;transform:translateY(240px) scaleY(1.2)}to{opacity:1;transform:none}}
.vs-in .vs-mark{animation:vn-mk .5s .78s cubic-bezier(.2,1.6,.4,1) both}@keyframes vn-mk{from{opacity:0;transform:translate(-50%,-50%) scale(.1) rotate(-20deg)}to{opacity:1;transform:translate(-50%,-50%)}}
.vs-in .vs-round{animation:vn-txt .5s 1.2s both}
/* Victory: a bubbling vat */
.vc-bg{background:radial-gradient(ellipse 80% 50% at 50% 104%,#3a8a1c,transparent 70%),radial-gradient(circle at 50% 40%,#1b3812,#040803 72%)}
.vc-bg2{top:auto;bottom:0;height:150px;background:linear-gradient(0deg,rgba(125,255,58,.5),transparent)}
.vc-round{font:400 30px 'Creepster',cursive;letter-spacing:5px;color:#d4ff8a;top:84px}
.vc-title{top:150px;font:400 280px/1 'Creepster',cursive;letter-spacing:10px;text-transform:uppercase;transform:rotate(-3deg)}
.vc-title span{background:linear-gradient(180deg,#f1ffc4,#8dff4a 50%,#2fae12);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 0 #041a07) drop-shadow(0 0 40px rgba(91,255,42,.7))}
.vc-card{top:570px}
.vc-ava{border-radius:50%;background:linear-gradient(180deg,#d4ff8a,#2fae12);box-shadow:0 0 30px rgba(91,255,42,.7)}.vc-ava img,.vc-ini{border-radius:50%}
.vc-ini{background:radial-gradient(circle at 40% 30%,#27401c,#070d05);color:#8dff4a;font-family:'Creepster',cursive}
.vc-team{font:400 36px 'Creepster',cursive;letter-spacing:3px;color:#d4ff8a;text-transform:uppercase}
.vc-name{font:400 124px/1.05 'Creepster',cursive;letter-spacing:4px;text-transform:uppercase;color:#f1ffc4;text-shadow:0 5px 0 #041a07,0 0 30px rgba(91,255,42,.7)}
.vc-score{background:#7dff3a;color:#041a07;border-radius:40px;padding:6px 30px 4px}.vc-def{color:#b9d6aa}.vc-def em{color:#f1ffc4}
.vc-pic img{filter:drop-shadow(0 0 34px rgba(91,255,42,.5))}
.vc-in .vc-title{animation:vn-ttl 1s .15s cubic-bezier(.3,1.5,.5,1) both}@keyframes vn-ttl{from{opacity:0;transform:rotate(-3deg) translateY(-300px) scaleY(1.7)}to{opacity:1;transform:rotate(-3deg)}}
.vc-in .vc-card{animation:vn-card .7s .8s cubic-bezier(.3,1.4,.5,1) both}@keyframes vn-card{from{opacity:0;transform:translateX(-50%) translateY(120px)}to{opacity:1;transform:translateX(-50%)}}.vc-in .vc-round{animation:vn-txt .5s 1.3s both}
`,
  };

  TH._ = { W, H, A, B, R, lg, scoreBox, centerBox, vsPlate, over };         // shared with the rest of the themes (themes-2.js)
})();
