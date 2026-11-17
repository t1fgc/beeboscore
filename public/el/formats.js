/* BeeboScore (developed by Beebo) — how each of the ten elemental layouts draws the game formats (Crew Battle, Team Battle,
 * Gauntlet, Death Battle, King of the Hill, League). sb-format.js draws the pieces; this file gives them each layout's own
 * look: colours, lettering, the shape of the format bar's items, the life gems, the splash backgrounds and the format VS.
 *
 *   window.EL_FMT[theme] = { light, T (particle and moment colours), vars (CSS custom properties), faces (fonts), css (shapes) }
 *   light: true → light paper (dark lettering), like Oni.
 */
(() => {
  'use strict';
  const F = '/static/fonts/';
  // a display font at every weight and slant the format pieces ask for (no faked bold or slant)
  const face = (fam, file, style = 'normal') => `@font-face{font-family:'${fam}';font-weight:100 900;font-style:${style};src:url(${F}${file}) format('woff2')}`;
  const v = o => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(';');
  const gem = (shape, fill, glow, gone) => `.sbf-lv i{${shape};background:${fill};filter:drop-shadow(0 0 6px ${glow})}.sbf-lv i::after{display:none}.sbf-lv i.gone{background:${gone};filter:none}`;
  // what every elemental layout shares: the bits sb-format.js draws in Ember's or Oni's own colours, redrawn from this layout's
  const common = light => `
#sbf-bar .bc::before{background:radial-gradient(ellipse 70% 120% at 50% -30%,color-mix(in srgb,var(--acc) 30%,transparent),transparent 70%)}
.sbf-ring{--rc:var(--hot)}
#sbf-vs .side .big{max-width:640px}
.it.playing{background:linear-gradient(180deg,${light ? 'var(--gold-hi),color-mix(in srgb,var(--hot) 45%,#fff)' : 'color-mix(in srgb,var(--acc) 26%,var(--p2)),var(--p3)'})}
.it.king,.it.rank1{background:linear-gradient(180deg,${light ? 'var(--gold-hi),color-mix(in srgb,var(--gold) 55%,#fff)' : 'color-mix(in srgb,var(--gold) 30%,var(--p2)),var(--p3)'})}
.it.king .sbf-nm{color:var(--ink)}
.it.coach,.sp-card.coach{background:linear-gradient(180deg,var(--p1),var(--p3))}
.f-gauntlet .it.out{background:linear-gradient(180deg,var(--p2),var(--p3))}
.f-koth .bc small{color:var(--gold)!important}
.sp-tb{background:${light ? 'rgba(255,255,255,.8)' : 'color-mix(in srgb,var(--p3) 78%,transparent)'}}
.sp-tb .w{background:var(--name);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 30px color-mix(in srgb,var(--acc) 55%,transparent))}
.sp-tb svg path{stroke:var(--ink);filter:drop-shadow(0 0 4px var(--acc))}
#sbf-sp .flash{background:radial-gradient(circle at 50% 50%,#fff,var(--gold-hi) 35%,color-mix(in srgb,var(--acc) 45%,transparent) 75%)}
.sp-rays{background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--gold) ${light ? 14 : 12}%,transparent) 0 4deg,transparent 4deg 14deg)}
.sp-card.playing,.sp-f.next{background:linear-gradient(180deg,${light ? 'var(--gold-hi),color-mix(in srgb,var(--hot) 45%,#fff)' : 'color-mix(in srgb,var(--acc) 26%,var(--p2)),var(--p3)'})}
.sp-card.mvp,.sp-f.king,.sp-st .row.first{background:linear-gradient(180deg,${light ? 'var(--gold-hi),color-mix(in srgb,var(--gold) 55%,#fff)' : 'color-mix(in srgb,var(--gold) 30%,var(--p2)),var(--p3)'})}
.sp-card.mvp .sbf-nm{color:var(--ink)}
#sbf-vs .side .stock i.out{background:${light ? 'color-mix(in srgb,var(--muted) 40%,#fff)' : 'color-mix(in srgb,var(--p1) 70%,#000)'}}
.sbf-stamp,.sbf-count{color:${light ? 'var(--acc)' : '#fff'};text-shadow:0 0 24px var(--blood),0 0 4px var(--blood)}
`;
  const M = {};

  // ------------------------------------------------------------------ Frostbite: carved ice
  M.frostbite = {
    T: { acc: '#69b0de', hot: '#dff3ff', gold: '#bfe9ff', goldHi: '#ffffff', blood: '#4fa3ff', spark: '#dff3ff', spark2: '#69b0de', ink: '#ffffff', two: '#9fd6ff' },
    vars: v({ p1: '#163a5a', p2: '#0b2440', p3: '#06162a', ink: '#f4fbff', sub: '#cfe9fa', muted: '#7fa7c4', acc: '#69b0de', hot: '#dff3ff', gold: '#bfe9ff', 'gold-hi': '#ffffff', blood: '#4fa3ff',
      line: 'rgba(223,243,255,.28)', glass: 'rgba(8,30,52,.82)', name: 'linear-gradient(180deg,#ffffff 0%,#dff3ff 45%,#8ccbf0 70%,#ffffff 100%)', namefx: 'drop-shadow(0 2px 0 rgba(4,20,40,.8))',
      shadow: '0 6px 22px rgba(0,20,40,.55)', fd: "'Michroma'", fi: 'normal' }),
    faces: face('Michroma', 'michroma-latin-400-normal.woff2'),
    css: `
.it{border-radius:4px 4px 10px 10px;clip-path:none;background:linear-gradient(180deg,rgba(40,90,130,.92),rgba(8,30,52,.95));box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 0 0 1px rgba(191,233,255,.35)}
.br .it{clip-path:none}.it .ed{clip-path:none;width:4px;border-radius:2px;opacity:.9}.br .it .ed{clip-path:none}
.it .sbf-nm{letter-spacing:0;font-size:12.5px}.sp-card .sbf-nm,.sp-f .sbf-nm,.sp-st .row .sbf-nm{letter-spacing:0}
#sbf-bar .bc{clip-path:polygon(0 0,100% 0,96% 100%,88% 86%,80% 100%,70% 88%,60% 100%,50% 84%,40% 100%,30% 88%,20% 100%,12% 86%,4% 100%);border-top:2px solid #dff3ff;background:linear-gradient(180deg,#1d4a70,#06162a)}
#sbf-bar .bc b{font-size:24px;letter-spacing:2px}
${gem('clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);width:15px;height:22px', 'linear-gradient(180deg,#ffffff,#9fd6ff 55%,#2f78b3)', '#69b0de', '#20384f')}
.sbf-band{background:linear-gradient(90deg,transparent,rgba(10,40,70,.88) 15%,rgba(10,40,70,.88) 85%,transparent);backdrop-filter:blur(6px);border-color:#dff3ff}
#sbf-sp .bg,#sbf-vs .bg{background:radial-gradient(ellipse 80% 40% at 50% 0%,rgba(105,255,200,.18),transparent 70%),radial-gradient(ellipse 60% 50% at 30% 10%,rgba(155,120,255,.16),transparent 70%),linear-gradient(180deg,#0d2a47,#04101d)}
#sbf-sp .grain{background:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 60%,#fff,transparent),radial-gradient(2px 2px at 45% 85%,#fff,transparent);background-size:220px 180px;opacity:.35}
.sp-card,.sp-f,.sp-st .row{clip-path:none!important;border-radius:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 0 0 1px rgba(191,233,255,.3)}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#dff3ff 20%,#fff 50%,#9fd6ff 80%,transparent);box-shadow:0 0 30px #69b0de}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ffffff 10%,#dff3ff 40%,#69b0de 80%,#2f78b3);-webkit-background-clip:text;background-clip:text;letter-spacing:8px}
.sp-champ b{background:linear-gradient(180deg,#ffffff,#dff3ff 40%,#8ccbf0 75%,#2f78b3);-webkit-background-clip:text;background-clip:text}
.sbf-stamp{text-shadow:0 0 24px #4fa3ff,0 0 4px #4fa3ff}`,
  };

  // ------------------------------------------------------------------ Venom: toxic slime
  M.venom = {
    T: { acc: '#7dff3a', hot: '#d4ff8a', gold: '#c8ff4a', goldHi: '#f2ffd0', blood: '#4dff1f', spark: '#b6ff5c', spark2: '#3dbf10', ink: '#f2ffe6', two: '#c46bff' },
    vars: v({ p1: '#1c2e12', p2: '#0f1a09', p3: '#070c04', ink: '#f2ffe6', sub: '#cfe8bc', muted: '#7d9a68', acc: '#7dff3a', hot: '#d4ff8a', gold: '#c8ff4a', 'gold-hi': '#f2ffd0', blood: '#4dff1f',
      line: 'rgba(125,255,58,.18)', glass: 'rgba(8,16,4,.88)', name: 'linear-gradient(180deg,#f2ffd0 0%,#b6ff5c 45%,#4dbb18 75%,#d4ff8a 100%)', namefx: 'drop-shadow(0 2px 0 #050a02) drop-shadow(0 0 10px rgba(125,255,58,.45))',
      shadow: '0 6px 22px rgba(0,0,0,.6)', fd: "'Creepster'", fi: 'normal' }),
    faces: face('Creepster', 'creepster-latin-400-normal.woff2'),
    css: `
.it{clip-path:polygon(0 0,100% 0,100% 82%,92% 82%,88% 100%,84% 82%,58% 82%,54% 96%,50% 82%,22% 82%,18% 100%,14% 82%,0 82%);height:46px;background:linear-gradient(180deg,#24391a,#0b1406)}
.br .it{clip-path:polygon(0 0,100% 0,100% 82%,86% 82%,82% 100%,78% 82%,50% 82%,46% 96%,42% 82%,16% 82%,12% 100%,8% 82%,0 82%)}
.it .ed{clip-path:none;width:5px;background:linear-gradient(180deg,#d4ff8a,#3dbf10)}.it .sbf-nm{font-size:22px;letter-spacing:1px}
#sbf-bar .bc{clip-path:none;border-radius:0 0 18px 18px;border-top:3px solid #7dff3a;background:linear-gradient(180deg,#26401a,#070c04);box-shadow:0 0 24px rgba(125,255,58,.35)}
#sbf-bar .bc b{font-size:36px;letter-spacing:2px;color:#d4ff8a;text-shadow:0 0 12px rgba(125,255,58,.6)}
#sbf-bar .bc::after{content:'';position:absolute;left:0;right:0;top:0;height:16px;pointer-events:none;background:radial-gradient(5px 9px at 12% 0,#7dff3a 98%,transparent),radial-gradient(4px 13px at 31% 0,#7dff3a 98%,transparent),radial-gradient(6px 8px at 57% 0,#7dff3a 98%,transparent),radial-gradient(4px 12px at 78% 0,#7dff3a 98%,transparent),radial-gradient(5px 7px at 93% 0,#7dff3a 98%,transparent)}
${gem('border-radius:50% 50% 50% 50%/60% 60% 40% 40%;clip-path:none;width:14px;height:20px', 'radial-gradient(circle at 35% 30%,#f2ffd0,#7dff3a 40%,#236b08)', '#7dff3a', '#1b2a12')}
.sbf-band{border-color:#7dff3a;background:linear-gradient(90deg,transparent,rgba(10,20,5,.9) 15%,rgba(10,20,5,.9) 85%,transparent)}.sbf-band .n{text-shadow:0 0 30px rgba(125,255,58,.7)}
#sbf-sp .bg,#sbf-vs .bg{background:radial-gradient(ellipse 70% 40% at 50% 110%,rgba(125,255,58,.35),transparent 70%),radial-gradient(circle at 20% 70%,rgba(125,255,58,.08) 0 40px,transparent 41px),radial-gradient(circle at 80% 30%,rgba(125,255,58,.06) 0 60px,transparent 61px),linear-gradient(180deg,#0d1708,#030502)}
#sbf-sp .grain{inset:0 0 -360px 0;background:radial-gradient(circle,rgba(180,255,120,.5) 0 3px,transparent 4px) 0 0/90px 120px,radial-gradient(circle,rgba(180,255,120,.35) 0 2px,transparent 3px) 40px 60px/90px 120px;opacity:.25;animation:sbf-ooze 9s linear infinite;will-change:transform}
@keyframes sbf-ooze{to{transform:translateY(-360px)}}
.sp-card,.sp-f,.sp-st .row{clip-path:polygon(0 0,100% 0,100% 88%,80% 88%,77% 100%,74% 88%,30% 88%,27% 100%,24% 88%,0 88%)!important;background:linear-gradient(180deg,#24391a,#0b1406)}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#7dff3a 20%,#f2ffd0 50%,#7dff3a 80%,transparent);box-shadow:0 0 40px #7dff3a;width:10px}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#f2ffd0 10%,#b6ff5c 40%,#4dbb18 75%,#1a4a06);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 20px rgba(125,255,58,.6))}
.sp-champ b{background:linear-gradient(180deg,#f2ffd0,#b6ff5c 40%,#4dbb18 80%);-webkit-background-clip:text;background-clip:text}
.sbf-stamp,.sbf-count{color:#d4ff8a;text-shadow:0 0 24px #4dff1f,0 0 4px #4dff1f}`,
  };

  // ------------------------------------------------------------------ Royal: velvet and gold
  M.royal = {
    T: { acc: '#f5c84c', hot: '#fff3c4', gold: '#f5c84c', goldHi: '#fff3c4', blood: '#ff5c95', spark: '#ffe08a', spark2: '#f5c84c', ink: '#fff3c4', two: '#b98cff' },
    vars: v({ p1: '#4a1a80', p2: '#2c0d52', p3: '#17052e', ink: '#fff3c4', sub: '#e8d8ff', muted: '#a991cc', acc: '#f5c84c', hot: '#fff3c4', gold: '#f5c84c', 'gold-hi': '#fff3c4', blood: '#ff5c95',
      line: 'rgba(245,200,76,.45)', glass: 'rgba(30,8,56,.9)', name: 'linear-gradient(180deg,#fffaf0 0%,#fff3c4 30%,#f5c84c 60%,#b07d12 85%,#fff3c4 100%)', namefx: 'drop-shadow(0 2px 0 rgba(20,4,40,.85))',
      shadow: '0 6px 22px rgba(10,0,30,.6)', fd: "'Cinzel'", fi: 'normal' }),
    faces: face('Cinzel', 'cinzel-latin-900-normal.woff2'),
    css: `
.it{clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);background:linear-gradient(180deg,#5a2296,#2c0d52)}
.br .it{clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)}
.it::before{border:1.5px solid rgba(245,200,76,.7)}.it .ed{display:none}.it .sbf-nm{font-size:15px;letter-spacing:.5px}
#sbf-bar .bc{clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%);height:84px;border-top:3px solid #f5c84c;background:linear-gradient(180deg,#5a2296,#17052e);box-shadow:inset 0 0 0 2px rgba(245,200,76,.6)}
#sbf-bar .bc b{font-size:24px;letter-spacing:3px;color:#fff3c4}#sbf-bar .bc small{color:#f5c84c}
${gem('clip-path:polygon(0 0,100% 0,100% 55%,50% 100%,0 55%);width:14px;height:20px', 'linear-gradient(180deg,#fff3c4,#f5c84c 50%,#9a6a0c)', '#f5c84c', '#3a2160')}
.sbf-band{border-color:#f5c84c;border-width:3px;background:linear-gradient(90deg,transparent,rgba(44,13,82,.94) 15%,rgba(44,13,82,.94) 85%,transparent)}
#sbf-sp .bg,#sbf-vs .bg{background:radial-gradient(ellipse 60% 50% at 50% 30%,rgba(245,200,76,.18),transparent 70%),repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 40px,rgba(255,255,255,.03) 40px 80px),linear-gradient(180deg,#3a1466,#12042a)}
#sbf-sp .grain{background:radial-gradient(circle,rgba(245,200,76,.35) 0 2px,transparent 3px) 0 0/60px 60px;opacity:.25}
.sp-card,.sp-f,.sp-st .row{clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)!important;background:linear-gradient(180deg,#5a2296,#2c0d52);box-shadow:inset 0 0 0 2px rgba(245,200,76,.55)}
.sp-card::before{display:none}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#f5c84c 20%,#fff3c4 50%,#f5c84c 80%,transparent);transform:none;width:4px}
#sbf-vs .half.L{clip-path:polygon(0 0,80.6% 0,80.6% 100%,0 100%)}#sbf-vs .half.R{clip-path:polygon(19.4% 0,100% 0,100% 100%,19.4% 100%)}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#fffaf0 10%,#fff3c4 35%,#f5c84c 65%,#9a6a0c);-webkit-background-clip:text;background-clip:text;letter-spacing:6px}
.sp-champ b{background:linear-gradient(180deg,#fffaf0,#fff3c4 30%,#f5c84c 65%,#9a6a0c);-webkit-background-clip:text;background-clip:text;letter-spacing:6px}
.sbf-stamp,.sbf-count{color:#fff3c4;text-shadow:0 0 24px #f5c84c,0 2px 0 #2c0d52}`,
  };

  // ------------------------------------------------------------------ Crimson: forged steel and a red edge
  M.crimson = {
    T: { acc: '#e01e37', hot: '#ff6b7d', gold: '#e9edf2', goldHi: '#ffffff', blood: '#e01e37', spark: '#ffffff', spark2: '#e01e37', ink: '#ffffff', two: '#9aa6b8' },
    vars: v({ p1: '#2a2e36', p2: '#16181d', p3: '#08090b', ink: '#f4f6f9', sub: '#d2d7df', muted: '#8a909b', acc: '#e01e37', hot: '#ff6b7d', gold: '#e9edf2', 'gold-hi': '#ffffff', blood: '#e01e37',
      line: 'rgba(233,237,242,.14)', glass: 'rgba(10,11,14,.9)', name: 'linear-gradient(180deg,#ffffff 0%,#e9edf2 40%,#8f97a4 55%,#e9edf2 80%,#ffffff 100%)', namefx: 'drop-shadow(0 3px 0 rgba(0,0,0,.8))',
      shadow: '0 6px 22px rgba(0,0,0,.6)', fd: "'Kaushan Script'", fi: 'normal' }),
    faces: face('Kaushan Script', 'kaushan-script-latin-400-normal.woff2'),
    css: `
.it{clip-path:polygon(22px 0,100% 0,calc(100% - 22px) 100%,0 100%);background:linear-gradient(180deg,#30353e,#121418);border-bottom:2px solid #e01e37}
.br .it{clip-path:polygon(0 0,calc(100% - 22px) 0,100% 100%,22px 100%)}.it .ed{background:#e01e37;opacity:1}
.it .sbf-nm{font-size:21px;text-transform:none}
#sbf-bar .bc{clip-path:polygon(40px 0,calc(100% - 40px) 0,100% 100%,0 100%);border-top:3px solid #e01e37;background:linear-gradient(180deg,#30353e,#08090b)}
#sbf-bar .bc b{font-size:34px;text-transform:none}
${gem('clip-path:polygon(50% 0,80% 62%,50% 100%,20% 62%);width:14px;height:24px', 'linear-gradient(180deg,#ffffff,#e9edf2 40%,#e01e37 70%,#6a0010)', '#e01e37', '#2a1418')}
.sbf-band{transform:skewY(-6deg);border-color:#e01e37;border-width:3px}.sbf-band .in{transform:skewY(6deg)}.sbf-band .n{text-transform:none}
#sbf-sp .bg,#sbf-vs .bg{background:linear-gradient(160deg,transparent 47%,rgba(224,30,55,.55) 49%,rgba(224,30,55,.85) 50%,rgba(224,30,55,.55) 51%,transparent 53%),radial-gradient(ellipse 70% 50% at 50% 100%,rgba(224,30,55,.2),transparent 70%),linear-gradient(180deg,#1d2026,#060709)}
#sbf-sp .grain{background:repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 3px);opacity:1}
.sp-card,.sp-f,.sp-st .row{clip-path:polygon(24px 0,100% 0,calc(100% - 24px) 100%,0 100%)!important;border-bottom:2px solid #e01e37}
.sp-card .sbf-nm,.sp-f .sbf-nm,.sp-st .row .sbf-nm,#sbf-vs .side .big,.sp-champ b,.sp-team h2{text-transform:none}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#e01e37 15%,#ffffff 50%,#e01e37 85%,transparent);box-shadow:0 0 30px #e01e37;transform:rotate(24deg)}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ffffff 15%,#e9edf2 45%,#e01e37 70%,#6a0010);-webkit-background-clip:text;background-clip:text}
.sp-champ b{background:linear-gradient(180deg,#ffffff,#e9edf2 40%,#e01e37 75%,#6a0010);-webkit-background-clip:text;background-clip:text}`,
  };

  // ------------------------------------------------------------------ Gold Rush: bullion, stamped slabs, coins
  M.goldrush = {
    T: { acc: '#ffd75e', hot: '#fff1b0', gold: '#ffd75e', goldHi: '#fff8d6', blood: '#d9480f', spark: '#ffd75e', spark2: '#b47a09', ink: '#fff8d6', two: '#7ad1ff' },
    vars: v({ p1: '#3a2808', p2: '#221603', p3: '#110a01', ink: '#fff8d6', sub: '#f1dfa8', muted: '#a88a4a', acc: '#ffd75e', hot: '#fff1b0', gold: '#ffd75e', 'gold-hi': '#fff8d6', blood: '#d9480f',
      line: 'rgba(255,215,94,.35)', glass: 'rgba(28,18,3,.9)', name: 'linear-gradient(180deg,#fff8d6 0%,#ffd75e 40%,#b47a09 65%,#ffd75e 85%,#fff8d6 100%)', namefx: 'drop-shadow(0 3px 0 #1c1203)',
      shadow: '0 6px 22px rgba(0,0,0,.6)', fd: "'Alfa Slab One'", fi: 'normal' }),
    faces: face('Alfa Slab One', 'alfa-slab-one-latin-400-normal.woff2'),
    css: `
.it{clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 100%,0 100%);background:linear-gradient(180deg,#ffe58a,#d9a521 45%,#9a6406);box-shadow:inset 0 2px 0 rgba(255,255,255,.6)}
.br .it{clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 100%,0 100%)}.it .sbf-nm{color:#1c1203!important;font-size:17px}.it:not(.team) .k,.it:not(.team) .x{color:#3a2808!important;text-shadow:none}.it .ed{display:none}
.it.out{filter:saturate(.3) brightness(.55)}
.it.playing,.it.king,.it.rank1,.it.coach{background:linear-gradient(180deg,#fffbe6,#ffe58a 40%,#e6b02a)}.it.king .sbf-nm{color:#1c1203}
.it.team{background:linear-gradient(180deg,#3a2808,#110a01);box-shadow:inset 0 0 0 2px #ffd75e}.it.team .sbf-nm{color:#fff8d6!important}
.sp-card.playing,.sp-card.mvp,.sp-card.coach,.sp-f.next,.sp-f.king,.sp-st .row.first{background:linear-gradient(180deg,#fffbe6,#ffe58a 40%,#e6b02a)}
#sbf-bar .bc{clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 100%,0 100%);border-top:0;background:linear-gradient(180deg,#fff1b0,#ffd75e 30%,#b47a09 75%,#7a4e02);box-shadow:inset 0 3px 0 rgba(255,255,255,.7)}
#sbf-bar .bc{--muted:#6b4a0c}#sbf-bar .bc b{color:#1c1203;font-size:28px}#sbf-bar .bc b span{text-shadow:0 1px 0 rgba(28,18,3,.85)}#sbf-bar .bc small{color:#3a2808}#sbf-bar .bc em{color:#5a3c06}
${gem('border-radius:50%;clip-path:none;width:17px;height:17px', 'radial-gradient(circle at 35% 30%,#fff8d6,#ffd75e 45%,#b47a09)', '#ffd75e', '#3a2808')}
.sbf-lv i{filter:drop-shadow(0 1.5px 0 #5a3c06) drop-shadow(0 0 4px rgba(255,215,94,.6))}
.sbf-band{border-color:#ffd75e;border-width:4px;background:linear-gradient(90deg,transparent,rgba(28,18,3,.93) 15%,rgba(28,18,3,.93) 85%,transparent)}
#sbf-sp .bg,#sbf-vs .bg{background:repeating-conic-gradient(from 0deg at 50% 45%,rgba(255,215,94,.12) 0 6deg,transparent 6deg 18deg),radial-gradient(circle at 50% 45%,rgba(255,215,94,.3),transparent 60%),linear-gradient(180deg,#2a1c04,#080500)}
#sbf-sp .grain{opacity:0}
.sp-card,.sp-f,.sp-st .row{clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 100%,0 100%)!important;background:linear-gradient(180deg,#ffe58a,#d9a521 45%,#9a6406)}
.sp-card .sbf-nm,.sp-f .sbf-nm,.sp-st .row .sbf-nm{color:#1c1203}.sp-card .k,.sp-card .c,.sp-card .r,.sp-f .meta,.sp-st .row{color:#3a2808}.sp-card::before{display:none}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#ffd75e 20%,#fff8d6 50%,#ffd75e 80%,transparent);width:12px;box-shadow:0 0 40px #ffd75e;transform:none}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#fff8d6 10%,#ffd75e 40%,#b47a09 75%,#5a3c06);-webkit-background-clip:text;background-clip:text}
.sp-champ b{background:linear-gradient(180deg,#fff8d6,#ffd75e 40%,#b47a09 75%,#5a3c06);-webkit-background-clip:text;background-clip:text}
.sbf-stamp,.sbf-count{color:#ffd75e;text-shadow:0 3px 0 #1c1203,0 0 24px #b47a09}`,
  };

  // ------------------------------------------------------------------ Sakura: washi paper and petals (light)
  M.sakura = {
    light: true,
    T: { acc: '#e0507f', hot: '#ff8fb1', gold: '#d4a24c', goldHi: '#fff3f6', blood: '#c2185b', spark: '#ffb7d0', spark2: '#ff8fb1', ink: '#4a1830', two: '#7a6cd6' },
    vars: v({ p1: '#fffafb', p2: '#fff0f4', p3: '#fde3ea', ink: '#4a1830', sub: '#6e3a52', muted: '#a87d90', acc: '#e0507f', hot: '#ff8fb1', gold: '#d4a24c', 'gold-hi': '#fff3f6', blood: '#c2185b',
      line: 'rgba(74,24,48,.18)', glass: 'rgba(255,246,249,.94)', name: 'linear-gradient(180deg,#7a2a4c 0%,#4a1830 60%,#2a0c1a 100%)', namefx: 'drop-shadow(0 2px 0 rgba(255,255,255,.8))',
      shadow: '0 6px 18px rgba(120,40,70,.2)', fd: "'Playfair Display'", fi: 'italic' }),
    faces: face('Playfair Display', 'playfair-display-latin-800-italic.woff2', 'italic'),
    css: `
.it{clip-path:none;border-radius:20px;background:linear-gradient(180deg,#fffafb,#fde3ea);box-shadow:0 2px 8px rgba(120,40,70,.18),inset 0 0 0 1px rgba(224,80,127,.25)}
.br .it{clip-path:none}.it .ed{clip-path:none;width:8px;height:8px;top:16px;left:8px;border-radius:70% 0 70% 0;opacity:1;background:#ff8fb1}.br .it .ed{left:auto;right:8px}
.it .sbf-nm{text-transform:none;font-size:19px}.it.team,.it.king,.it.playing,.it.rank1{background:linear-gradient(180deg,#ffe3ec,#ffc4d6)}.it.team .sbf-nm,.it.king .sbf-nm{color:#4a1830}
#sbf-bar .bc{clip-path:none;border-radius:36px 36px 0 0;border-top:3px solid #ff8fb1;background:linear-gradient(180deg,#fffafb,#fde3ea)}
#sbf-bar .bc b{text-transform:none}
${gem('border-radius:70% 0 70% 0;clip-path:none;width:15px;height:15px;transform:rotate(-20deg)', 'linear-gradient(135deg,#fff0f5,#ff8fb1 50%,#e0507f)', '#ff8fb1', '#ead7de')}
.sbf-band{border-color:#ff8fb1;background:linear-gradient(90deg,transparent,rgba(255,246,249,.95) 15%,rgba(255,246,249,.95) 85%,transparent)}.sbf-band .n{text-transform:none}
#sbf-sp,#sbf-vs{color:#4a1830}
#sbf-sp .bg,#sbf-vs .bg{background:radial-gradient(circle at 90% 6%,rgba(255,143,177,.4) 0 110px,transparent 111px),radial-gradient(ellipse 70% 50% at 50% 110%,rgba(255,143,177,.3),transparent 70%),linear-gradient(180deg,#fff7fa,#fde6ee)}
#sbf-sp .grain{background:radial-gradient(7px 4px at 20% 20%,#ffb7d0,transparent),radial-gradient(6px 4px at 70% 40%,#ff8fb1,transparent),radial-gradient(7px 5px at 40% 80%,#ffc4d6,transparent);background-size:300px 260px;inset:-520px 0 0 -300px;opacity:.9;animation:sbf-petals 14s linear infinite;will-change:transform}
@keyframes sbf-petals{to{transform:translate(300px,520px)}}
.sp-card,.sp-f,.sp-st .row{clip-path:none!important;border-radius:16px;background:linear-gradient(180deg,#fffafb,#fde3ea);box-shadow:0 3px 12px rgba(120,40,70,.15)}
.sp-card::before{display:none}.sp-card .sbf-nm,.sp-f .sbf-nm,#sbf-vs .side .big,.sp-champ b,.sp-team h2,.sp-st .row .sbf-nm{text-transform:none}
.sp-card.playing,.sp-card.mvp,.sp-f.next,.sp-f.king,.sp-st .row.first{background:linear-gradient(180deg,#ffe3ec,#ffc4d6)}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#ff8fb1 20%,#e0507f 50%,#ff8fb1 80%,transparent);width:4px;transform:none}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ff8fb1 10%,#e0507f 55%,#7a2a4c);-webkit-background-clip:text;background-clip:text}
.sp-champ b{background:linear-gradient(180deg,#e0507f,#7a2a4c 70%,#4a1830);-webkit-background-clip:text;background-clip:text}
.sbf-stamp,.sbf-count{color:#e0507f;text-shadow:0 2px 0 #fff,0 0 18px rgba(255,143,177,.6)}`,
  };

  // ------------------------------------------------------------------ Tidal: deep water glass
  M.tidal = {
    T: { acc: '#19d3da', hot: '#c9fbff', gold: '#ffd166', goldHi: '#fff6d6', blood: '#ff5d73', spark: '#c9fbff', spark2: '#19d3da', ink: '#ffffff', two: '#ffd166' },
    vars: v({ p1: '#0c5770', p2: '#073b4c', p3: '#031e28', ink: '#f0feff', sub: '#c9fbff', muted: '#6fb3c2', acc: '#19d3da', hot: '#c9fbff', gold: '#ffd166', 'gold-hi': '#fff6d6', blood: '#ff5d73',
      line: 'rgba(201,251,255,.25)', glass: 'rgba(3,40,54,.86)', name: 'linear-gradient(180deg,#ffffff 0%,#c9fbff 45%,#19d3da 75%,#c9fbff 100%)', namefx: 'drop-shadow(0 2px 0 rgba(2,24,32,.85))',
      shadow: '0 6px 22px rgba(0,20,28,.6)', fd: "'Righteous'", fi: 'normal' }),
    faces: face('Righteous', 'righteous-latin-400-normal.woff2'),
    css: `
.it{clip-path:none;border-radius:12px;background:linear-gradient(180deg,rgba(25,211,218,.35) 0 20%,#0c5770 21%,#031e28);background-size:100% 200%;box-shadow:inset 0 0 0 1px rgba(201,251,255,.35)}
#sbf-bar .it.playing{animation:sbf-tide 4s ease-in-out infinite alternate}@keyframes sbf-tide{from{background-position:0 0}to{background-position:0 18%}}
.br .it{clip-path:none}.it .ed{clip-path:none;width:5px;border-radius:3px}.it .sbf-nm{font-size:19px}
#sbf-bar .bc{clip-path:none;border-radius:40px 40px 0 0;border-top:3px solid #19d3da;background:linear-gradient(180deg,#0c5770,#031e28)}
${gem('border-radius:50%;clip-path:none;width:16px;height:16px', 'radial-gradient(circle at 35% 30%,#ffffff,rgba(201,251,255,.6) 30%,rgba(25,211,218,.35) 70%)', '#19d3da', 'rgba(255,255,255,.12)')}
.sbf-lv i{box-shadow:inset 0 0 0 1.5px #c9fbff}
.sbf-band{border-color:#19d3da;border-radius:40px;background:linear-gradient(90deg,transparent,rgba(3,40,54,.9) 15%,rgba(3,40,54,.9) 85%,transparent)}
#sbf-sp .bg,#sbf-vs .bg{background:repeating-linear-gradient(100deg,rgba(201,251,255,.05) 0 30px,transparent 30px 90px),radial-gradient(ellipse 70% 40% at 50% 0%,rgba(201,251,255,.25),transparent 70%),linear-gradient(180deg,#0a4c63,#020f15)}
#sbf-sp .grain{background:radial-gradient(circle,rgba(255,255,255,.5) 0 2px,transparent 3px) 0 0/80px 110px,radial-gradient(circle,transparent 0 5px,rgba(201,251,255,.35) 5px 6px,transparent 7px) 30px 40px/80px 110px;inset:0 0 -440px 0;opacity:.5;animation:sbf-bubble 10s linear infinite;will-change:transform}
@keyframes sbf-bubble{to{transform:translateY(-440px)}}
.sp-card,.sp-f,.sp-st .row{clip-path:none!important;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(201,251,255,.3)}.sp-card::before{display:none}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#c9fbff 20%,#fff 50%,#19d3da 80%,transparent);border-radius:50%;width:14px;filter:blur(1px)}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ffffff 10%,#c9fbff 40%,#19d3da 75%,#07606b);-webkit-background-clip:text;background-clip:text}
.sp-champ b{background:linear-gradient(180deg,#ffffff,#c9fbff 40%,#19d3da 80%);-webkit-background-clip:text;background-clip:text}`,
  };

  // ------------------------------------------------------------------ Voltage: live current
  M.voltage = {
    T: { acc: '#ffe600', hot: '#fff6a0', gold: '#ffe600', goldHi: '#fffbd6', blood: '#ff3b6b', spark: '#ffe600', spark2: '#5b84ff', ink: '#ffffff', two: '#5b84ff' },
    vars: v({ p1: '#18204f', p2: '#0e1438', p3: '#060920', ink: '#ffffff', sub: '#d6dcff', muted: '#7f8ac2', acc: '#ffe600', hot: '#fff6a0', gold: '#ffe600', 'gold-hi': '#fffbd6', blood: '#ff3b6b',
      line: 'rgba(91,132,255,.4)', glass: 'rgba(8,12,40,.9)', name: 'linear-gradient(180deg,#ffffff 0%,#fffbd6 40%,#ffe600 70%,#fff6a0 100%)', namefx: 'drop-shadow(0 0 8px rgba(255,230,0,.45)) drop-shadow(0 2px 0 #060920)',
      shadow: '0 0 22px rgba(91,132,255,.35)', fd: "'Orbitron'", fi: 'normal' }),
    faces: face('Orbitron', 'orbitron-latin-900-normal.woff2'),
    css: `
.it{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));background:linear-gradient(180deg,#18204f,#060920);box-shadow:inset 0 0 0 1.5px rgba(91,132,255,.7)}
.br .it{clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}.it .ed{background:#ffe600;clip-path:none;width:3px;opacity:1;box-shadow:0 0 8px #ffe600}
.it .sbf-nm{font-size:14px;letter-spacing:1.5px}.it.playing{box-shadow:inset 0 0 0 2px #ffe600,0 0 16px rgba(255,230,0,.5)}
#sbf-bar .bc{clip-path:polygon(0 18px,18px 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%);border-top:2px solid #ffe600;background:linear-gradient(180deg,#1b2560,#060920);box-shadow:0 0 30px rgba(255,230,0,.25)}
#sbf-bar .bc b{font-size:22px;letter-spacing:3px;color:#ffe600;text-shadow:0 0 12px rgba(255,230,0,.6)}
${gem('clip-path:polygon(60% 0,15% 55%,48% 55%,35% 100%,85% 40%,52% 40%);width:14px;height:24px', 'linear-gradient(180deg,#fffbd6,#ffe600 50%,#c9a800)', '#ffe600', '#1d2550')}
.sbf-band{border-color:#ffe600;box-shadow:0 0 30px rgba(255,230,0,.3);background:linear-gradient(90deg,transparent,rgba(8,12,40,.92) 15%,rgba(8,12,40,.92) 85%,transparent)}
#sbf-sp .bg,#sbf-vs .bg{background:linear-gradient(rgba(91,132,255,.12) 1px,transparent 1px) 0 0/60px 60px,linear-gradient(90deg,rgba(91,132,255,.12) 1px,transparent 1px) 0 0/60px 60px,radial-gradient(ellipse 60% 50% at 50% 50%,rgba(91,132,255,.25),transparent 70%),linear-gradient(180deg,#0a1030,#02030c)}
#sbf-sp .grain{background:linear-gradient(90deg,transparent 49.5%,rgba(255,230,0,.5) 50%,transparent 50.5%) 0 0/240px 100%;opacity:.25;animation:sbf-zap 2.2s steps(6) infinite}
@keyframes sbf-zap{to{background-position:240px 0}}
.sp-card,.sp-f,.sp-st .row{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))!important;box-shadow:inset 0 0 0 1.5px rgba(91,132,255,.6)}
.sp-card .sbf-nm,.sp-f .sbf-nm,.sp-st .row .sbf-nm{font-size:30px;letter-spacing:2px}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#ffe600 20%,#fff 50%,#5b84ff 80%,transparent);box-shadow:0 0 30px #ffe600,0 0 60px #5b84ff}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ffffff 10%,#ffe600 45%,#c9a800 70%,#5b84ff);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 22px rgba(255,230,0,.5))}
#sbf-vs .side .big{font-size:96px;letter-spacing:3px}
.sp-champ b{background:linear-gradient(180deg,#ffffff,#fff6a0 30%,#ffe600 65%,#c9a800);-webkit-background-clip:text;background-clip:text;font-size:150px}
.sbf-stamp,.sbf-count{color:#ffe600;text-shadow:0 0 24px #ffe600,0 0 50px #5b84ff}`,
  };

  // ------------------------------------------------------------------ Chrome: liquid metal
  M.chrome = {
    T: { acc: '#c7ced9', hot: '#ffffff', gold: '#e6c46b', goldHi: '#fff6d8', blood: '#ff4d5e', spark: '#ffffff', spark2: '#8b93a1', ink: '#ffffff', two: '#7aa7ff' },
    vars: v({ p1: '#2b2f37', p2: '#15171c', p3: '#0b0d12', ink: '#f2f4f7', sub: '#c7ced9', muted: '#8b93a1', acc: '#c7ced9', hot: '#ffffff', gold: '#e6c46b', 'gold-hi': '#fff6d8', blood: '#ff4d5e',
      line: 'rgba(242,244,247,.22)', glass: 'rgba(11,13,18,.9)', name: 'linear-gradient(180deg,#ffffff 0%,#e3e7ee 38%,#6d7584 50%,#cfd5de 70%,#ffffff 100%)', namefx: 'drop-shadow(0 3px 0 rgba(0,0,0,.8))',
      shadow: '0 6px 22px rgba(0,0,0,.6)', fd: "'Exo 2'", fi: 'italic' }),
    faces: face('Exo 2', 'exo-2-latin-900-italic.woff2', 'italic'),
    css: `
.it{clip-path:none;border-radius:22px;background:linear-gradient(180deg,#5b626e,#1d2027 48%,#0b0d12 52%,#2b2f37);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px rgba(255,255,255,.18)}
.it.playing::after,.it.king::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%) -150% 0/250% 100% no-repeat;animation:sbf-glint 4s ease-in-out infinite}
.br .it{clip-path:none}.it .ed{display:none}.it .sbf-nm{font-size:20px;color:#f2f4f7}
#sbf-bar .bc{clip-path:none;border-radius:36px;height:64px;bottom:4px;border:0;background:linear-gradient(180deg,#eef1f5,#9aa2af 46%,#2b2f37 52%,#6d7584);box-shadow:inset 0 2px 0 #fff}
#sbf-bar .bc{--muted:#3b414c;background:linear-gradient(180deg,#f4f6f9,#d3d8df 40%,#a9b0bb 60%,#dde1e6)!important}#sbf-bar .bc b{color:#0b0d12;text-shadow:0 1px 0 rgba(255,255,255,.6)}#sbf-bar .bc small,#sbf-bar .bc em{color:#2b2f37}
${gem('border-radius:7px;clip-path:none;width:11px;height:22px', 'linear-gradient(90deg,#6d7584,#ffffff 45%,#9aa2af 60%,#3b414c)', '#ffffff', '#26292f')}
.sbf-band{border-color:#c7ced9;border-radius:80px}
#sbf-sp .bg,#sbf-vs .bg{background:linear-gradient(180deg,rgba(255,255,255,.07) 0 50%,transparent 50%) 0 0/100% 40%,radial-gradient(ellipse 60% 50% at 50% 60%,rgba(199,206,217,.16),transparent 70%),linear-gradient(180deg,#0d0f14,#000)}
#sbf-sp .grain{inset:0 -100%;background:linear-gradient(105deg,transparent 45%,rgba(255,255,255,.08) 50%,transparent 55%);opacity:1;animation:sbf-sheen 6s ease-in-out infinite;will-change:transform}
@keyframes sbf-sheen{from{transform:translateX(-33%)}to{transform:translateX(33%)}}
.sp-card,.sp-f,.sp-st .row{clip-path:none!important;border-radius:26px;background:linear-gradient(180deg,#5b626e,#1d2027 48%,#0b0d12 52%,#2b2f37);box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}.sp-card::before{display:none}
#sbf-vs .seam{background:linear-gradient(180deg,transparent,#ffffff 30%,#6d7584 50%,#ffffff 70%,transparent);width:8px}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ffffff 0%,#e3e7ee 38%,#4a515e 50%,#cfd5de 68%,#ffffff 100%);-webkit-background-clip:text;background-clip:text}
.sp-champ b{background:linear-gradient(180deg,#ffffff 0%,#e3e7ee 38%,#4a515e 50%,#cfd5de 68%,#ffffff 100%);-webkit-background-clip:text;background-clip:text}`,
  };

  // ------------------------------------------------------------------ Pastel: candy clouds (light)
  M.pastel = {
    light: true,
    T: { acc: '#7a5cff', hot: '#ff7ab8', gold: '#ffb84d', goldHi: '#fff4d9', blood: '#ff5c8a', spark: '#ffd1e8', spark2: '#bfe3ff', ink: '#3b2a7a', two: '#36b5ff' },
    vars: v({ p1: '#ffffff', p2: '#f6f0ff', p3: '#ebe2ff', ink: '#3b2a7a', sub: '#5a4a9c', muted: '#9a8fc4', acc: '#7a5cff', hot: '#ff7ab8', gold: '#ffb84d', 'gold-hi': '#fff4d9', blood: '#ff5c8a',
      line: 'rgba(122,92,255,.2)', glass: 'rgba(255,255,255,.94)', name: 'linear-gradient(180deg,#8a6cff 0%,#7a5cff 50%,#4b2fd0 100%)', namefx: 'drop-shadow(0 2px 0 #ffffff)',
      shadow: '0 6px 18px rgba(90,60,200,.2)', fd: "'Fredoka'", fi: 'normal' }),
    faces: face('Fredoka', 'fredoka-latin-700-normal.woff2'),
    css: `
.it{clip-path:none;border-radius:999px;background:linear-gradient(180deg,#ffffff,#f1eaff);box-shadow:0 3px 0 #d9ccff,inset 0 0 0 2px #ffd1e8}
.br .it{clip-path:none}.it .ed{display:none}.it .sbf-nm{text-transform:none;font-size:19px;color:#3b2a7a}
.it.team,.it.king,.it.playing,.it.rank1{background:linear-gradient(180deg,#ffe3f2,#ffd1e8)}.it.team .sbf-nm,.it.king .sbf-nm{color:#3b2a7a}
#sbf-bar .bc{clip-path:none;border-radius:40px 40px 18px 18px;border-top:0;background:linear-gradient(180deg,#ffffff,#ffe3f2);box-shadow:0 4px 0 #ffd1e8,inset 0 0 0 2px #bfe3ff}
#sbf-bar .bc b{text-transform:none;color:#7a5cff}
${gem('clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);width:20px;height:20px', 'linear-gradient(180deg,#ffd27a,#f59e0b 60%,#d97706)', '#e08a00', '#d9d0ee')}
.sbf-band{border-color:#ff7ab8;border-radius:80px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.96) 15%,rgba(255,255,255,.96) 85%,transparent)}.sbf-band .n{text-transform:none}
#sbf-sp,#sbf-vs{color:#3b2a7a}
#sbf-sp .bg,#sbf-vs .bg{background:radial-gradient(ellipse 30% 18% at 15% 20%,#ffffff,transparent 70%),radial-gradient(ellipse 34% 20% at 85% 30%,#ffffff,transparent 70%),radial-gradient(ellipse 40% 24% at 50% 100%,#ffffff,transparent 70%),linear-gradient(180deg,#e7dcff,#ffd1e8 55%,#bfe3ff)}
#sbf-sp .grain{background:radial-gradient(3px 3px at 20% 30%,#fff,transparent),radial-gradient(4px 4px at 60% 70%,#ffd1e8,transparent),radial-gradient(3px 3px at 80% 20%,#bfe3ff,transparent);background-size:260px 220px;opacity:.9;animation:sbf-twinkle 3s ease-in-out infinite alternate}
@keyframes sbf-twinkle{to{opacity:.4}}
.sp-card,.sp-f,.sp-st .row{clip-path:none!important;border-radius:40px;background:linear-gradient(180deg,#ffffff,#f1eaff);box-shadow:0 4px 0 #d9ccff}.sp-card::before{display:none}
.sp-card .sbf-nm,.sp-f .sbf-nm,#sbf-vs .side .big,.sp-champ b,.sp-team h2,.sp-st .row .sbf-nm{text-transform:none}
.sp-card.playing,.sp-card.mvp,.sp-f.next,.sp-f.king,.sp-st .row.first{background:linear-gradient(180deg,#ffe3f2,#ffd1e8)}
#sbf-vs .seam{background:repeating-linear-gradient(180deg,#ff7ab8 0 20px,#bfe3ff 20px 40px);width:10px;border-radius:5px;transform:none}
#sbf-vs .mid .vs,.sp-vs{background:linear-gradient(180deg,#ff7ab8 10%,#7a5cff 70%,#4b2fd0);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 6px 0 #fff)}
.sp-champ b{background:linear-gradient(180deg,#ff7ab8,#7a5cff 60%,#4b2fd0);-webkit-background-clip:text;background-clip:text}
.sbf-stamp,.sbf-count{color:#7a5cff;text-shadow:0 3px 0 #fff,0 0 18px rgba(255,122,184,.6)}`,
  };

  for (const k in M) M[k].css = common(!!M[k].light) + M[k].css;
  window.EL_FMT = M;
})();
