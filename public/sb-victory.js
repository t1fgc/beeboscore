/*
 * BeeboScore victory splash — the set winner, full screen, after a set ends.
 * Injected into every layout. Shown/hidden by state.victory ({ show, side }): BeeboScore puts it up a
 * moment after a set is won (Settings › Scoreboard), from the app, a Stream Deck key or a shortcut.
 *
 * Pick the look with   <meta name="sb-victory" content="shattered">   (styles: shattered, oni)
 * or turn it off with  <meta name="sb-victory" content="off">  (layouts from the Layout Designer draw
 * their own victory screen). <html> gets the class sb-victory-on while it's showing.
 */
(function () {
  'use strict';
  if (window.__SB_VICTORY_LOADED) return;
  window.__SB_VICTORY_LOADED = true;

  const meta = document.querySelector('meta[name="sb-victory"]');
  let style = meta ? String(meta.content || '').trim().toLowerCase() : '';
  if (style === 'off') return;
  const NAME = String(window.__SB_OVERLAY || '').toLowerCase();
  if (!['shattered', 'oni'].includes(style)) style = /(^|-)oni($|-)/.test(NAME) ? 'oni' : 'shattered';
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;

  const CSS = `
@font-face{font-family:'Saira Condensed';font-weight:800;src:url(/static/fonts/saira-condensed-latin-800-normal.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:600;src:url(/static/fonts/chakra-petch-latin-600-normal.woff2) format('woff2')}
#sb-victory{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:56;pointer-events:none;display:none;overflow:hidden;
  --fn:'Saira Condensed','Arial Narrow',Impact,sans-serif;--fu:'Chakra Petch','Segoe UI',sans-serif}
#sb-victory.vc-show{display:block}
#sb-victory *{box-sizing:border-box}
#sb-victory .vc-bg,#sb-victory .vc-rays,#sb-victory .vc-flash,#sb-victory .vc-art,#sb-victory .vc-cv{position:absolute;left:0;top:0;width:1920px;height:1080px}
#sb-victory .vc-flash{opacity:0;background:radial-gradient(circle at 50% 46%,#fff,rgba(255,255,255,.4) 32%,transparent 64%)}
#sb-victory .vc-kanji{display:none}
#sb-victory .vc-ghost{position:absolute;left:0;right:0;top:640px;text-align:center;white-space:nowrap;font:italic 800 340px/1 var(--fn);text-transform:uppercase;opacity:.06;letter-spacing:-2px}
#sb-victory .vc-round{position:absolute;left:50%;top:118px;transform:translateX(-50%);display:flex;gap:16px;align-items:center;white-space:nowrap;font:600 24px var(--fu);letter-spacing:7px;text-transform:uppercase;padding:12px 56px 10px}
#sb-victory .vc-round:empty,#sb-victory .vc-round.vc-none{display:none}
#sb-victory .vc-title{position:absolute;left:0;right:0;top:186px;display:grid;justify-content:center;font:italic 800 250px/1 var(--fn);letter-spacing:4px;white-space:nowrap}
#sb-victory .vc-title span{display:inline-block;padding:0 48px 0 12px;margin-right:-20px}
#sb-victory .vc-title>*{grid-area:1/1}#sb-victory .vc-t1,#sb-victory .vc-t2,#sb-victory .vc-n2w{display:grid}#sb-victory .vc-t2,#sb-victory .vc-n2w{will-change:opacity}#sb-victory .vc-t1{display:none}
#sb-victory .vc-nw{display:grid;justify-items:start}#sb-victory .vc-nw>*{grid-area:1/1}
/* the real lettering always paints on top of its glow copies (a fading copy would otherwise jump above it) */
#sb-victory .vc-tm,#sb-victory .vc-name{position:relative;z-index:2}
#sb-victory .vc-card{position:absolute;left:50%;top:520px;transform:translateX(-50%);display:flex;align-items:center;gap:46px;max-width:1700px}
#sb-victory .vc-ava{position:relative;flex:none;width:250px;height:250px}
#sb-victory .vc-ava img,#sb-victory .vc-ava .vc-ini{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:cover}
#sb-victory .vc-ava img{display:none}#sb-victory .vc-ava.vc-has-img img{display:block}#sb-victory .vc-ava.vc-has-img .vc-ini{display:none}
#sb-victory .vc-ava .vc-ini{display:grid;place-items:center;font:italic 800 150px/1 var(--fn)}
#sb-victory .vc-info{min-width:0;display:flex;flex-direction:column;gap:4px}
#sb-victory .vc-team{font:800 34px var(--fn);letter-spacing:3px;text-transform:uppercase}
#sb-victory .vc-team:empty{display:none}
#sb-victory .vc-name,#sb-victory .vc-n2{font:italic 800 150px/1.02 var(--fn);text-transform:uppercase;white-space:nowrap;letter-spacing:1px;padding-right:10px}
#sb-victory .vc-line{display:flex;align-items:center;gap:26px;margin-top:6px;font:600 26px var(--fu);letter-spacing:3px;text-transform:uppercase}
#sb-victory .vc-score{display:flex;align-items:baseline;gap:14px;padding:6px 22px 4px;font:800 54px/1 var(--fn)}
#sb-victory .vc-score i{font-style:normal;opacity:.6}
#sb-victory .vc-def em{font-style:normal;font-weight:700}

/* =================================== SHATTERED: obsidian, gold light, ember cracks =================================== */
#sb-victory.vc-st-shattered .vc-bg{background:radial-gradient(ellipse 55% 50% at 50% 42%,rgba(246,196,83,.30),transparent 70%),radial-gradient(ellipse 80% 40% at 50% 112%,rgba(255,90,31,.32),transparent 70%),#040406}
#sb-victory.vc-st-shattered .vc-rays{background:repeating-conic-gradient(from 0deg at 50% 40%,rgba(255,226,150,.10) 0deg 5deg,transparent 5deg 18deg);
  -webkit-mask:radial-gradient(circle at 50% 40%,#000 0,transparent 62%);mask:radial-gradient(circle at 50% 40%,#000 0,transparent 62%)}
#sb-victory.vc-st-shattered.vc-show .vc-rays{animation:vc-spin 40s linear infinite}
@keyframes vc-spin{to{transform:rotate(360deg)}}
#sb-victory.vc-st-shattered .vc-art path{fill:none;stroke-linecap:round;stroke-linejoin:round}
#sb-victory.vc-st-shattered .vc-art .vc-c1{stroke:#ffcf6e;stroke-width:2.2;opacity:.85;filter:drop-shadow(0 0 6px #f6a53a)}
#sb-victory.vc-st-shattered .vc-art .vc-c2{stroke:#ff7a3a;stroke-width:1.2;opacity:.5}
#sb-victory.vc-st-shattered .vc-ghost{color:#f6c453}
#sb-victory.vc-st-shattered .vc-round{color:#d9dce4;background:linear-gradient(180deg,#17181d,#050507);clip-path:polygon(22px 0,100% 0,calc(100% - 22px) 100%,0 100%);box-shadow:inset 0 2px 0 #f6c453,inset 0 0 0 1px rgba(246,196,83,.3)}
#sb-victory.vc-st-shattered .vc-round .vc-event{color:#f6c453}
#sb-victory.vc-st-shattered .vc-title span{background:linear-gradient(180deg,#ffffff 0%,#fff4cf 30%,#f6c453 50%,#ffe7a3 58%,#d99a2b 78%,#8a5a12 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 2px rgba(0,0,0,.9)) drop-shadow(0 0 30px rgba(246,196,83,.7))}
#sb-victory.vc-st-shattered .vc-ava{background:linear-gradient(160deg,#fff4cf,#f6c453 40%,#8a5a12);clip-path:polygon(12% 0,100% 5%,90% 100%,0 90%)}
#sb-victory.vc-st-shattered .vc-ava img,#sb-victory.vc-st-shattered .vc-ava .vc-ini{clip-path:polygon(12% 0,100% 5%,90% 100%,0 90%);background:linear-gradient(160deg,#22232a,#07070a);color:#f6c453}
#sb-victory.vc-st-shattered .vc-team{color:#ff5a1f}
#sb-victory.vc-st-shattered .vc-name,#sb-victory.vc-st-shattered .vc-n2{background:linear-gradient(180deg,#ffffff 0%,#fff4cf 45%,#f6c453 70%,#ffe7a3 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(0,0,0,.8))}
#sb-victory.vc-st-shattered .vc-line{color:#8d919d}
#sb-victory.vc-st-shattered .vc-score{background:linear-gradient(180deg,#1c1d23,#07070a);box-shadow:inset 0 0 0 1px rgba(246,196,83,.6);clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
#sb-victory.vc-st-shattered .vc-ws{color:#ffe7a3;text-shadow:0 0 16px rgba(246,196,83,.8)}#sb-victory.vc-st-shattered .vc-ls{color:#8d919d}
#sb-victory.vc-st-shattered .vc-def em{color:#d9dce4}
/* entrance: flash → cracks race out → VICTORY slams → the winner rises → name decodes */
#sb-victory.vc-st-shattered.vc-in .vc-bg{animation:vc-fade .35s both}
#sb-victory.vc-st-shattered.vc-in .vc-rays{animation:vc-fade 1s .3s both,vc-spin 40s linear infinite}
#sb-victory.vc-st-shattered.vc-in .vc-flash{animation:vc-flash .42s .38s ease-out both}
#sb-victory.vc-st-shattered.vc-in .vc-art path{stroke-dasharray:1;animation:vc-draw .5s .42s cubic-bezier(.3,.7,.3,1) both}
#sb-victory.vc-st-shattered.vc-in .vc-art .vc-c2{animation-delay:.55s}
#sb-victory.vc-st-shattered.vc-in .vc-title{animation:vc-slam .7s .36s cubic-bezier(.2,.9,.3,1.35) both}
#sb-victory.vc-st-shattered.vc-in .vc-card{animation:vc-rise .65s .75s cubic-bezier(.2,.9,.3,1.15) both}
#sb-victory.vc-st-shattered.vc-in .vc-round{animation:vc-drop .5s .95s cubic-bezier(.2,.9,.3,1.2) both}
#sb-victory.vc-in .vc-frame{animation:vc-fade .8s .5s both}
#sb-victory.vc-st-shattered.vc-in .vc-ghost{animation:vc-fade 1.4s .7s both}
#sb-victory.vc-st-shattered.vc-in .vc-line{animation:vc-up .45s 1.15s both}
#sb-victory.vc-st-shattered.vc-out{animation:vc-sh-out .6s ease-in forwards}
@keyframes vc-sh-out{0%{filter:none}25%{filter:brightness(1.8)}100%{opacity:0;filter:brightness(.6);transform:scale(1.03)}}

/* =================================== ONI: white gi, red sun, ink, gold and blood flame =================================== */
#sb-victory.vc-st-oni .vc-bg{background:
  radial-gradient(ellipse 75% 70% at 50% 45%,transparent 55%,rgba(60,40,10,.18) 100%),
  repeating-linear-gradient(45deg,rgba(0,0,0,.022) 0 2px,transparent 2px 6px),
  repeating-linear-gradient(-45deg,rgba(0,0,0,.018) 0 2px,transparent 2px 7px),
  linear-gradient(180deg,#fbf8f1,#efe8da 60%,#e3d9c6)}
#sb-victory.vc-st-oni .vc-rays{left:0;top:150px;width:1920px;height:330px;border-radius:0;background:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 330' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='r' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%234a0004'/%3E%3Cstop offset='.5' stop-color='%23d61a20'/%3E%3Cstop offset='1' stop-color='%234a0004'/%3E%3C/linearGradient%3E%3CradialGradient id='h' cx='.5' cy='.5' r='.5'%3E%3Cstop offset='0' stop-color='%23ffb347' stop-opacity='.7'/%3E%3Cstop offset='1' stop-color='%23b3060f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpolygon points='0,107 60,94 120,97 180,97 240,83 300,86 360,79 420,62 480,49 540,48 600,50 660,35 720,34 780,29 840,13 900,4 960,-4 1020,5 1080,3 1140,14 1200,31 1260,40 1320,39 1380,45 1440,50 1500,74 1560,65 1620,70 1680,93 1740,86 1800,104 1860,94 1920,113 1920,219 1860,233 1800,230 1740,235 1680,247 1620,249 1560,257 1500,260 1440,278 1380,277 1320,285 1260,286 1200,297 1140,313 1080,327 1020,322 960,337 900,328 840,324 780,309 720,297 660,286 600,278 540,281 480,280 420,257 360,263 300,248 240,250 180,239 120,235 60,227 0,225' fill='%23141210' opacity='.92'/%3E%3Cpolygon points='0,117 60,104 120,107 180,107 240,93 300,96 360,89 420,72 480,59 540,58 600,60 660,45 720,44 780,39 840,23 900,14 960,6 1020,15 1080,13 1140,24 1200,41 1260,50 1320,49 1380,55 1440,60 1500,84 1560,75 1620,80 1680,103 1740,96 1800,114 1860,104 1920,123 1920,209 1860,223 1800,220 1740,225 1680,237 1620,239 1560,247 1500,250 1440,268 1380,267 1320,275 1260,276 1200,287 1140,303 1080,317 1020,312 960,327 900,318 840,314 780,299 720,287 660,276 600,268 540,271 480,270 420,247 360,253 300,238 240,240 180,229 120,225 60,217 0,215' fill='url%28%23r%29'/%3E%3Cellipse cx='960' cy='165' rx='520' ry='150' fill='url%28%23h%29'/%3E%3Cpolygon points='194,26 199,33 194,42 187,34' fill='%23e9c35e' opacity='0.54'/%3E%3Cpolygon points='1074,146 1076,149 1074,153 1071,150' fill='%23e9c35e' opacity='0.82'/%3E%3Cpolygon points='251,205 254,208 251,212 249,209' fill='%23e9c35e' opacity='0.66'/%3E%3Cpolygon points='409,88 415,96 409,106 401,98' fill='%23e9c35e' opacity='0.85'/%3E%3Cpolygon points='584,277 587,280 584,285 581,281' fill='%23e9c35e' opacity='0.65'/%3E%3Cpolygon points='1640,205 1642,208 1640,211 1638,208' fill='%23e9c35e' opacity='0.94'/%3E%3Cpolygon points='409,86 415,92 409,101 403,94' fill='%23e9c35e' opacity='0.61'/%3E%3Cpolygon points='569,34 571,37 569,40 566,38' fill='%23e9c35e' opacity='0.74'/%3E%3Cpolygon points='467,191 470,195 467,201 462,196' fill='%23e9c35e' opacity='0.68'/%3E%3Cpolygon points='1842,155 1846,160 1842,167 1836,161' fill='%23e9c35e' opacity='0.88'/%3E%3Cpolygon points='351,54 357,61 351,71 344,63' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='479,66 484,72 479,80 473,73' fill='%23e9c35e' opacity='0.92'/%3E%3Cpolygon points='377,293 383,300 377,310 370,301' fill='%23e9c35e' opacity='0.75'/%3E%3Cpolygon points='809,44 811,46 809,49 807,47' fill='%23e9c35e' opacity='0.93'/%3E%3Cpolygon points='458,223 461,226 458,231 454,227' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='1145,100 1148,103 1145,107 1142,104' fill='%23e9c35e' opacity='0.81'/%3E%3Cpolygon points='132,78 136,84 132,90 127,85' fill='%23e9c35e' opacity='0.88'/%3E%3Cpolygon points='1179,92 1185,99 1179,109 1172,101' fill='%23e9c35e' opacity='0.55'/%3E%3Cpolygon points='32,91 36,96 32,102 27,97' fill='%23e9c35e' opacity='0.48'/%3E%3Cpolygon points='338,120 343,126 338,133 333,127' fill='%23e9c35e' opacity='0.52'/%3E%3Cpolygon points='695,274 702,282 695,293 687,284' fill='%23e9c35e' opacity='0.78'/%3E%3Cpolygon points='1327,187 1329,190 1327,194 1324,191' fill='%23e9c35e' opacity='0.47'/%3E%3Cpolygon points='34,282 39,288 34,296 28,289' fill='%23e9c35e' opacity='0.93'/%3E%3Cpolygon points='41,201 45,206 41,212 36,207' fill='%23e9c35e' opacity='0.82'/%3E%3Cpolygon points='612,312 614,315 612,318 610,315' fill='%23e9c35e' opacity='0.72'/%3E%3Cpolygon points='1415,279 1420,285 1415,293 1409,286' fill='%23e9c35e' opacity='0.80'/%3E%3Cpolygon points='1523,285 1526,290 1523,295 1519,290' fill='%23e9c35e' opacity='0.79'/%3E%3Cpolygon points='1730,272 1733,276 1730,282 1725,277' fill='%23e9c35e' opacity='0.85'/%3E%3Cpolygon points='1658,181 1662,187 1658,194 1652,188' fill='%23e9c35e' opacity='0.64'/%3E%3Cpolygon points='1119,195 1121,198 1119,201 1116,198' fill='%23e9c35e' opacity='0.77'/%3E%3Cpolygon points='1907,273 1912,279 1907,287 1901,280' fill='%23e9c35e' opacity='0.64'/%3E%3Cpolygon points='1411,185 1415,189 1411,195 1407,190' fill='%23e9c35e' opacity='0.87'/%3E%3Cpolygon points='161,238 163,240 161,243 159,240' fill='%23e9c35e' opacity='0.75'/%3E%3Cpolygon points='923,78 928,84 923,92 917,85' fill='%23e9c35e' opacity='0.70'/%3E%3Cpolygon points='1180,288 1183,291 1180,296 1176,292' fill='%23e9c35e' opacity='0.46'/%3E%3Cpolygon points='578,215 581,218 578,223 575,219' fill='%23e9c35e' opacity='0.53'/%3E%3Cpolygon points='1739,208 1743,213 1739,219 1734,214' fill='%23e9c35e' opacity='0.90'/%3E%3Cpolygon points='628,212 630,215 628,219 625,215' fill='%23e9c35e' opacity='0.67'/%3E%3Cpolygon points='1547,282 1553,289 1547,299 1540,291' fill='%23e9c35e' opacity='0.64'/%3E%3Cpolygon points='1120,107 1122,110 1120,114 1117,111' fill='%23e9c35e' opacity='0.70'/%3E%3C/svg%3E") center/100% 100% no-repeat;opacity:1;filter:drop-shadow(0 0 30px rgba(179,6,15,.35))}
#sb-victory.vc-st-oni .vc-art .vc-ink{fill:#141210}
#sb-victory.vc-st-oni .vc-art .vc-dot{fill:#141210}
#sb-victory.vc-st-oni .vc-kanji{display:block;position:absolute;right:40px;top:650px;font:900 300px/1 'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP','MS Mincho',serif;color:#141210;opacity:.9;
  text-shadow:6px 6px 0 rgba(179,6,15,.25)}
#sb-victory.vc-st-oni .vc-ghost{color:#141210;opacity:.05}
#sb-victory.vc-st-oni .vc-round{color:#141210;background:#fbf8f1;box-shadow:inset 0 -3px 0 #141210,0 6px 18px rgba(0,0,0,.12);clip-path:polygon(18px 0,100% 0,calc(100% - 18px) 100%,0 100%)}
#sb-victory.vc-st-oni .vc-round .vc-event{color:#b3060f}
#sb-victory.vc-st-oni .vc-title span{background:linear-gradient(180deg,#fff6d6 0%,#f6dc8c 28%,#d7a93c 52%,#fbe7a8 60%,#a77a1e 82%,#6b4a0c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 1px #2a1d06) drop-shadow(0 0 1px #2a1d06) drop-shadow(0 5px 0 rgba(20,18,16,.85))}
#sb-victory.vc-st-oni .vc-ava{background:#b3060f;box-shadow:0 0 0 4px #fbf8f1,0 0 0 8px #141210,0 12px 30px rgba(0,0,0,.35)}
#sb-victory.vc-st-oni .vc-ava img,#sb-victory.vc-st-oni .vc-ava .vc-ini{background:#fbf8f1;color:#b3060f}
#sb-victory.vc-st-oni .vc-team{color:#141210}
#sb-victory.vc-st-oni .vc-name{background:linear-gradient(0deg,#4a0004 0%,#b3060f 30%,#ff3b14 55%,#ff9a3c 78%,#fff1c2 100%);background-size:100% 220%;-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 1px #2a0002) drop-shadow(0 0 10px rgba(255,59,20,.75)) drop-shadow(0 0 26px rgba(179,6,15,.55))}
#sb-victory.vc-st-oni.vc-show .vc-name{animation:vc-flame 1.1s steps(22, jump-none) infinite alternate}
@keyframes vc-flame{0%{background-position:0 0}100%{background-position:0 100%}}
#sb-victory.vc-st-oni .vc-line{color:#141210}
#sb-victory.vc-st-oni .vc-score{background:#141210;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
#sb-victory.vc-st-oni .vc-score i{color:#9b9184;opacity:1}#sb-victory.vc-st-oni .vc-ws{color:#f6dc8c}#sb-victory.vc-st-oni .vc-ls{color:#9b9184}
#sb-victory.vc-st-oni .vc-def em{color:#141210}
/* entrance: the paper wipes in with a brush stroke → the sun rises → 勝 stamps → gold title → the name ignites */
#sb-victory.vc-st-oni.vc-in .vc-bg{animation:vc-wipe .55s cubic-bezier(.6,0,.3,1) both}
#sb-victory.vc-st-oni.vc-in .vc-rays{animation:vc-sun .8s .3s cubic-bezier(.2,.9,.3,1.1) both}
#sb-victory.vc-st-oni.vc-in .vc-art{animation:vc-wipe .5s .5s cubic-bezier(.6,0,.3,1) both}
#sb-victory.vc-st-oni.vc-in .vc-kanji{animation:vc-stamp .55s .78s cubic-bezier(.2,.9,.3,1.3) both}
#sb-victory.vc-st-oni.vc-in .vc-title{animation:vc-up .6s .62s cubic-bezier(.2,.9,.3,1.2) both}
#sb-victory.vc-st-oni.vc-in .vc-card{animation:vc-rise .6s .9s cubic-bezier(.2,.9,.3,1.15) both}
#sb-victory.vc-st-oni.vc-in .vc-name{animation:vc-ignite .9s 1.05s both,vc-flame 1.1s 1.9s steps(22, jump-none) infinite alternate}
#sb-victory.vc-st-oni.vc-in .vc-round{animation:vc-drop .5s 1s cubic-bezier(.2,.9,.3,1.2) both}
#sb-victory.vc-st-oni.vc-in .vc-line{animation:vc-up .45s 1.2s both}
#sb-victory.vc-st-oni.vc-out{animation:vc-wipe-out .6s cubic-bezier(.6,0,.4,1) forwards}
@keyframes vc-wipe{from{clip-path:polygon(0 0,0 0,-8% 100%,-8% 100%)}to{clip-path:polygon(0 0,108% 0,100% 100%,-8% 100%)}}
@keyframes vc-wipe-out{from{clip-path:polygon(0 0,108% 0,100% 100%,-8% 100%)}to{clip-path:polygon(108% 0,108% 0,100% 100%,100% 100%)}}
@keyframes vc-sun{from{transform:scaleX(0);opacity:0}to{transform:none;opacity:1}}
@keyframes vc-stamp{0%{transform:scale(1.9) rotate(-8deg);opacity:0;filter:blur(8px)}60%{transform:scale(.94);opacity:.95;filter:none}100%{transform:none;opacity:.9}}
@keyframes vc-ignite{0%{opacity:0;filter:brightness(3) blur(6px)}40%{opacity:1}100%{opacity:1}}

/* the frame around the screen + the victor's lettering effects */
#sb-victory .vc-frame{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible;pointer-events:none}
#sb-victory .vc-frame path{fill:none;stroke-linejoin:round}
#sb-victory .vc-frame{will-change:opacity}#sb-victory .vc-f2w{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;display:none;will-change:opacity}
#sb-victory.vc-st-shattered .vc-frame .f1{stroke:#fff1c2;stroke-width:2.5;filter:drop-shadow(0 0 6px #f6c453) drop-shadow(0 0 18px rgba(246,196,83,.8))}
#sb-victory.vc-st-shattered .vc-frame .f2{stroke:rgba(246,196,83,.35);stroke-width:1}
#sb-victory.vc-st-shattered.vc-show .vc-frame{animation:vc-heaven 2.8s ease-in-out infinite}
@keyframes vc-heaven{50%{opacity:.7}}
#sb-victory.vc-st-shattered .vc-title .vc-tm{filter:drop-shadow(0 0 2px rgba(0,0,0,.9))}
#sb-victory.vc-st-shattered .vc-t1{display:grid}
#sb-victory.vc-st-shattered .vc-t1 span,#sb-victory.vc-st-shattered .vc-t2 span{background:none;color:#f6c453;filter:none}
#sb-victory.vc-st-shattered .vc-t1 span{text-shadow:0 0 18px rgba(246,196,83,.6),0 0 60px rgba(255,236,170,.4),0 0 140px rgba(255,236,170,.28)}
#sb-victory.vc-st-shattered .vc-t2 span{text-shadow:0 0 30px rgba(255,226,140,.7),0 0 90px rgba(255,246,214,.45),0 0 190px rgba(255,246,214,.3)}
#sb-victory.vc-st-shattered .vc-t2{opacity:0}
#sb-victory.vc-st-shattered.vc-show .vc-title .vc-t2{animation:vc-xf 2.8s ease-in-out infinite}
#sb-victory.vc-st-shattered .vc-name,#sb-victory.vc-st-shattered .vc-n2{-webkit-text-stroke:1px rgba(60,35,0,.9);paint-order:stroke fill}
#sb-victory.vc-st-shattered .vc-name{filter:drop-shadow(0 3px 0 rgba(0,0,0,.8)) drop-shadow(0 0 14px rgba(246,196,83,.7))}
#sb-victory.vc-st-shattered .vc-n2{filter:drop-shadow(0 0 28px rgba(255,236,170,.9))}#sb-victory.vc-st-shattered .vc-n2w{opacity:0}
#sb-victory.vc-st-shattered.vc-show .vc-n2w{animation:vc-xf 2.8s .4s ease-in-out infinite}
@keyframes vc-xf{0%,100%{opacity:0}50%{opacity:1}}
#sb-victory.vc-st-oni .vc-frame .f1{stroke:#ff3b14;stroke-width:3;filter:drop-shadow(0 0 6px #ff3b14) drop-shadow(0 0 16px rgba(179,6,15,.9))}
#sb-victory.vc-st-oni .vc-frame2 .f1{stroke:#ffb347}
#sb-victory.vc-st-oni .vc-f2w{display:block;opacity:0;animation:vc-blink .3s steps(2) infinite alternate}
@keyframes vc-blink{to{opacity:1}}
#sb-victory.vc-st-oni .vc-frame .f2{stroke:#141210;stroke-width:6;opacity:.85}
#sb-victory.vc-st-oni .vc-title span{-webkit-text-stroke:2px #2a1d06;paint-order:stroke fill;filter:drop-shadow(0 5px 0 rgba(20,18,16,.85)) drop-shadow(0 0 12px rgba(255,59,20,.55)) drop-shadow(0 -10px 26px rgba(179,6,15,.45))}
#sb-victory.vc-st-oni .vc-title .vc-t2 span{filter:drop-shadow(0 5px 0 rgba(20,18,16,.85)) drop-shadow(0 0 20px rgba(255,90,20,.7)) drop-shadow(0 -16px 40px rgba(179,6,15,.55))}#sb-victory.vc-st-oni .vc-t2{opacity:0}
#sb-victory.vc-st-oni.vc-show .vc-title .vc-t2{animation:vc-xf2 1.2s ease-in-out infinite alternate}
@keyframes vc-xf2{to{opacity:1}}
#sb-victory.vc-st-oni .vc-name{-webkit-text-stroke:1.5px #2a0002;paint-order:stroke fill;filter:none!important}
#sb-victory.vc-st-oni .vc-n2{color:#2a0002;-webkit-text-stroke:1.5px #2a0002;filter:drop-shadow(0 0 2px #fbf8f1) drop-shadow(0 0 2px #fbf8f1) drop-shadow(0 0 12px rgba(255,59,20,.8)) drop-shadow(0 0 26px rgba(179,6,15,.55))}
#sb-victory.vc-st-oni.vc-in .vc-n2w{animation:vc-ignite-o .9s 1.05s both}
@keyframes vc-ignite-o{0%{opacity:0}40%{opacity:1}100%{opacity:1}}
html.sb-potato #sb-victory .vc-frame path{filter:none}

/* shared */
@keyframes vc-fade{from{opacity:0}}
@keyframes vc-flash{0%{opacity:0}18%{opacity:.55}100%{opacity:0}}
@keyframes vc-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes vc-slam{0%{transform:scale(2.6);opacity:0;filter:blur(12px)}55%{transform:scale(.9);opacity:1;filter:none}100%{transform:none}}
@keyframes vc-rise{from{opacity:0;transform:translate(-50%,70px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes vc-drop{from{opacity:0;transform:translate(-50%,-40px)}}
@keyframes vc-up{from{opacity:0;transform:translateY(26px)}}
html.sb-potato #sb-victory *,html.sb-potato #sb-victory{animation:none!important;transition:none!important}
`;
  const st = document.createElement('style'); st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  // ----------------------------------------------------------------------------- DOM
  const root = document.createElement('div');
  root.id = 'sb-victory'; root.className = 'vc-st-' + style; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="vc-bg"></div><div class="vc-rays"></div><svg class="vc-art" viewBox="0 0 1920 1080"></svg><svg class="vc-frame" viewBox="0 0 1920 1080"><path class="f2" d="M70,40H1850L1880,70V1010L1850,1040H70L40,1010V70Z"/><path class="f1" d="M60,28H1860L1892,60V1020L1860,1052H60L28,1020V60Z"/></svg><div class="vc-f2w"><svg class="vc-frame vc-frame2" viewBox="0 0 1920 1080"><path class="f1" d="M60,28H1860L1892,60V1020L1860,1052H60L28,1020V60Z"/></svg></div><div class="vc-kanji">勝</div><div class="vc-ghost"></div>
    <div class="vc-round"><span class="vc-event"></span><span class="vc-rnd"></span></div>
    <div class="vc-title"><div class="vc-t1" aria-hidden="true"><span>VICTORY</span></div><div class="vc-t2" aria-hidden="true"><span>VICTORY</span></div><span class="vc-tm">VICTORY</span></div>
    <div class="vc-card"><div class="vc-ava"><img alt=""><b class="vc-ini"></b></div>
      <div class="vc-info"><div class="vc-team"></div><div class="vc-nw"><div class="vc-n2w" aria-hidden="true"><div class="vc-n2"></div></div><div class="vc-name"></div></div>
        <div class="vc-line"><span class="vc-score"><b class="vc-ws"></b><i>–</i><b class="vc-ls"></b></span><span class="vc-def">def. <em class="vc-opp"></em></span></div></div></div>
    <canvas class="vc-cv" width="1920" height="1080"></canvas><div class="vc-flash"></div>`;
  const mount = () => document.body.appendChild(root);
  document.body ? mount() : addEventListener('DOMContentLoaded', mount);
  const $ = sel => root.querySelector(sel), $$ = sel => root.querySelectorAll(sel);

  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  (function art() {
    const r = rng(style === 'oni' ? 808 : 4747), svg = $('.vc-art');
    if (style === 'shattered') {                 // ember cracks racing out from behind the title
      let d1 = '', d2 = '';
      for (let i = 0; i < 16; i++) {
        const a = (i + r() * .6) / 16 * Math.PI * 2; let x = 960, y = 300, d = 'M960,300';
        for (let j = 0; j < 5; j++) { x += Math.cos(a) * (90 + r() * 120) + (r() - .5) * 50; y += Math.sin(a) * (60 + r() * 90) + (r() - .5) * 40; d += `L${x | 0},${y | 0}`; }
        if (i % 3) d2 += `<path class="vc-c2" pathLength="1" d="${d}"/>`; else d1 += `<path class="vc-c1" pathLength="1" d="${d}"/>`;
      }
      svg.innerHTML = d2 + d1;
    } else {                                      // a rough ink brush stroke under the card, plus splatter
      let top = [], bot = [];
      for (let i = 0; i <= 40; i++) {
        const x = -40 + i * 50, w = 54 + Math.sin(i / 40 * Math.PI) * 46 + (r() - .5) * 22;
        const y = 1010 - i * 2.6 + (r() - .5) * 8;
        top.push(`${x},${(y - w / 2).toFixed(0)}`); bot.unshift(`${x + (r() - .5) * 18},${(y + w / 2 + (r() - .5) * 14).toFixed(0)}`);
      }
      let dots = '';
      for (let i = 0; i < 26; i++) { const x = 120 + r() * 1300, y = 880 + r() * 170; dots += `<circle class="vc-dot" cx="${x | 0}" cy="${y | 0}" r="${(2 + r() * r() * 16).toFixed(1)}"/>`; }
      svg.innerHTML = `<polygon class="vc-ink" points="${top.concat(bot).join(' ')}" opacity=".92"/>${dots}`;
    }
  })();

  // ----------------------------------------------------------------------------- particles
  const cv = $('.vc-cv'), ctx = cv.getContext('2d');
  let parts = [], raf = 0, last = 0, ambient = 0;
  const COL = style === 'oni' ? [[255, 70, 20], [255, 150, 50], [200, 10, 20]] : [[255, 220, 140], [255, 190, 90], [255, 120, 50]];
  function burst(x, y, n, power, spread = Math.PI * 2, dir = -Math.PI / 2) {
    if (window.SBPerf) n = window.SBPerf.n(n);
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - .5) * spread, sp = (160 + Math.random() * 520) * power;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, life: 1, decay: .6 + Math.random() * .9, size: 1.2 + Math.random() * 2.6, c: COL[i % COL.length] });
    }
    run();
  }
  const FRAME = [[60, 28], [1860, 28], [1892, 60], [1892, 1020], [1860, 1052], [60, 1052], [28, 1020], [28, 60]];
  function onFrame() {
    const L = FRAME.map((p, i) => { const q = FRAME[(i + 1) % FRAME.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    let r = Math.random() * L.reduce((a, b) => a + b, 0), i = 0; while (r > L[i]) { r -= L[i]; i++; }
    const p = FRAME[i], q = FRAME[(i + 1) % FRAME.length], k = r / L[i]; return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  }
  function rise() {                              // embers (shattered) / flame tongues (oni) drifting up
    for (let i = 0; i < (style === 'oni' ? 5 : 2); i++) {   // the frame burns (oni) or sparkles with golden light (shattered)
      const [x, y] = onFrame();
      parts.push(style === 'oni'
        ? { x, y, vx: (Math.random() - .5) * 30, vy: -(60 + Math.random() * 90), g: -20, life: 1, decay: 1.4 + Math.random(), size: 3 + Math.random() * 5, c: COL[Math.random() * COL.length | 0], wob: Math.random() * 6 }
        : { x, y, vx: (Math.random() - .5) * 20, vy: -(10 + Math.random() * 30), g: -5, life: 1, decay: .7 + Math.random() * .6, size: 1 + Math.random() * 2, c: [255, 240, 190], wob: Math.random() * 6 });
    }
    const n = style === 'oni' ? 3 : 2;
    for (let i = 0; i < n; i++) parts.push({ x: 200 + Math.random() * 1520, y: 1090, vx: (Math.random() - .5) * 40, vy: -(80 + Math.random() * 160), g: -20,
      life: 1, decay: .18 + Math.random() * .25, size: style === 'oni' ? 2 + Math.random() * 4 : 1 + Math.random() * 2, c: COL[Math.random() * COL.length | 0], wob: Math.random() * 6 });
  }
  function run() { if (!raf && !POTATO()) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  let dirty = null;                               // only clear where particles were drawn last frame
  function tick(t) {
    const P = window.SBPerf;
    if (P && P.idle) { raf = 0; P.whenAwake(run); return; }
    const dt = Math.min(.05, (t - last) / 1000); last = t; if (P) P.sample(dt * 1000);
    if (ambient && (ambient += dt) > .06) { ambient = 1e-6; if (!P || Math.random() < P.q) rise(); }
    if (dirty) ctx.clearRect(dirty[0] - 2, dirty[1] - 2, dirty[2] - dirty[0] + 4, dirty[3] - dirty[1] + 4);
    let nb = null;
    ctx.globalCompositeOperation = style === 'oni' ? 'source-over' : 'lighter';
    parts = parts.filter(p => (p.life -= p.decay * dt) > 0);
    for (const p of parts) {
      p.vy += p.g * dt; p.vx *= .99; p.x += (p.vx + (p.wob ? Math.sin(t / 300 + p.wob) * 30 : 0)) * dt; p.y += p.vy * dt;
      const [r, g, b] = p.c, s = p.size * (p.wob && style === 'oni' ? (.6 + p.life * .7) : 1);
      const R = s * 3;
      if (P) { ctx.globalAlpha = p.life; ctx.drawImage(P.glow(`vc${r},${g},${b}`, [[0, `rgb(${r},${g},${b})`], [1, `rgba(${r},${g},${b},0)`]]), p.x - R, p.y - R, R * 2, R * 2); ctx.globalAlpha = 1; }
      else { const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); gr.addColorStop(0, `rgba(${r},${g},${b},${p.life})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283); ctx.fill(); }
      if (!nb) nb = [p.x - R, p.y - R, p.x + R, p.y + R]; else { nb[0] = Math.min(nb[0], p.x - R); nb[1] = Math.min(nb[1], p.y - R); nb[2] = Math.max(nb[2], p.x + R); nb[3] = Math.max(nb[3], p.y + R); }
    }
    dirty = nb;
    if (parts.length || ambient) raf = requestAnimationFrame(tick); else { raf = 0; dirty = null; ctx.clearRect(0, 0, 1920, 1080); }
  }

  // ----------------------------------------------------------------------------- data
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$';
  function decode(el, dur) {
    const final = el.dataset.txt || el.textContent; el.dataset.txt = final;
    const t0 = performance.now();
    const step = t => {
      if (el.dataset.txt !== final) return;
      const p = Math.min(1, (t - t0) / dur), n = Math.floor(p * final.length * 1.15);
      let s = ''; for (let i = 0; i < final.length; i++) s += i < n || final[i] === ' ' ? final[i] : GLYPHS[Math.random() * GLYPHS.length | 0];
      el.textContent = s; if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }
  function fit(el, max) {
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize) || 100; let size = base;
    while (el.scrollWidth > max && size > base * .4) { size -= 3; el.style.fontSize = size + 'px'; }
  }
  let data = null;
  function fill(s, side) {
    const p = s['p' + side] || {}, o = s['p' + (3 - side)] || {};
    const name = p.name || ('Player ' + side);
    $('.vc-name').textContent = name; $('.vc-name').dataset.txt = name;
    $('.vc-ghost').textContent = name;
    $('.vc-team').textContent = p.team || '';
    $('.vc-ws').textContent = Number(p.score) || 0; $('.vc-ls').textContent = Number(o.score) || 0;
    $('.vc-opp').textContent = o.name || ('Player ' + (3 - side));
    $('.vc-event').textContent = s.event || ''; $('.vc-rnd').textContent = s.round || '';
    $('.vc-round').classList.toggle('vc-none', !s.event && !s.round);
    $('.vc-ini').textContent = name.trim().charAt(0).toUpperCase() || '?';
    const img = $('.vc-ava img'), ava = $('.vc-ava'), src = String(p.avatar || '');
    if (img.dataset.src !== src) {
      img.dataset.src = src; ava.classList.remove('vc-has-img');
      if (src) { img.onload = () => ava.classList.add('vc-has-img'); img.onerror = () => ava.classList.remove('vc-has-img'); img.src = src; } else img.removeAttribute('src');
    }
    if (root.classList.contains('vc-show')) refit();
  }
  function refit() { const n = $('.vc-name'); n.textContent = n.dataset.txt || n.textContent; fit(n, 1180); fit($('.vc-ghost'), 1840); fit($('.vc-tm'), 1800); $$('.vc-t1 span,.vc-t2 span').forEach(e => e.style.fontSize = $('.vc-tm').style.fontSize); }
  { const n = $('.vc-name'), n2 = $('.vc-n2'), sync = () => { n2.textContent = n.textContent; n2.style.fontSize = n.style.fontSize; };
    new MutationObserver(sync).observe(n, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] }); }

  // ----------------------------------------------------------------------------- show / hide
  let shown = 0, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  function show(instant) {
    clear();
    document.documentElement.classList.add('sb-victory-on');
    root.className = 'vc-st-' + style + ' vc-show';
    refit();
    if (instant || POTATO()) { if (!POTATO()) { ambient = 1e-6; run(); } return; }
    void root.offsetWidth; root.classList.add('vc-in');
    later(() => { burst(960, 300, style === 'oni' ? 50 : 110, style === 'oni' ? .8 : 1.3); ambient = 1e-6; run(); }, style === 'oni' ? 820 : 520);
    later(() => decode($('.vc-name'), 650), style === 'oni' ? 1050 : 900);
    later(() => root.classList.remove('vc-in'), 2200);
  }
  function hide(instant) {
    clear(); ambient = 0;
    document.documentElement.classList.remove('sb-victory-on');
    if (instant || POTATO() || !root.classList.contains('vc-show')) { root.className = 'vc-st-' + style; parts = []; return; }
    root.classList.remove('vc-in'); root.classList.add('vc-out');
    later(() => { if (!shown) { root.className = 'vc-st-' + style; parts = []; } }, 650);
  }
  let first = true;
  addEventListener('scoreboard', e => {
    const s = e.detail || {}, v = s.victory || {};
    const side = Number(v.side) === 2 ? 2 : Number(v.side) === 1 ? 1 : 0;
    const want = v.show && side ? side : 0;
    if (want) fill(s, want);
    if (first) { first = false; if (want) { shown = want; show(!!window.__SB_INSTANT); } return; }
    if (want && (!shown || want !== shown || v.n !== data)) { shown = want; show(false); }   // new victory (or replayed)
    else if (!want && shown) { shown = 0; hide(false); }
    data = v.n;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (shown && root.classList.contains('vc-in')) { clear(); root.classList.remove('vc-in'); const n = $('.vc-name'); n.textContent = n.dataset.txt || n.textContent; }
    if (!shown && root.className !== 'vc-st-' + style) { clear(); root.className = 'vc-st-' + style; }
  });
  window.BeeboVictory = { style };
})();
