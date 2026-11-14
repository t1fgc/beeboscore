/*
 * BeeboScore VS intro — a player-vs-player splash that covers the scoreboard.
 * Injected into every layout automatically. Shown/hidden from the control panel (state.vs.show).
 *
 * The animation style follows the layout. A layout can choose one explicitly with
 *   <meta name="sb-vs" content="shattered">     (or content="off" to never show the splash)
 * Styles: classic shattered porcelain oni iron devil dojo drive smash aether scroll comic slash stone
 *         street glitch sky ki night broadcast arcade chrome
 * The splash always covers the whole 1920×1080 screen. Each side has an art area (.vs-art) for
 * full character splash art; until a picture is set it shows the player's name as a huge ghost.
 */
(function () {
  'use strict';
  if (window.__SB_VS_LOADED) return;
  window.__SB_VS_LOADED = true;

  const metaStyle = document.querySelector('meta[name="sb-vs"]');
  let style = metaStyle ? String(metaStyle.content || '').trim().toLowerCase() : '';
  if (style === 'off') return;
  const NAME = String(window.__SB_OVERLAY || '').toLowerCase();
  const MAP = [['shattered', 'shattered'], ['iron-plate', 'iron'], ['devil', 'devil'], ['dojo', 'dojo'], ['sf6', 'drive'],
    ['smash', 'smash'], ['rivals', 'aether'], ['avatar', 'scroll'], ['marvel-tokon', 'comic'], ['ggst', 'slash'], ['mk1', 'stone'],
    ['fatal-fury', 'street'], ['2xko', 'glitch'], ['gbvsr', 'sky'], ['dbfz', 'ki'], ['uni2', 'night'], ['vf5', 'broadcast'],
    ['kofxv', 'arcade'], ['mvc2', 'chrome']];
  if (!style) { const m = MAP.find(([k]) => NAME.includes(k)); style = m ? m[1] : 'classic'; }
  // Porcelain is Ember's splash in white: the same moves (style "shattered"), with .vs-pc on top for the colours
  const PC = style === 'porcelain';
  if (PC) style = 'shattered';
  const BASE = 'vs-st-' + style + (PC ? ' vs-pc' : '');
  const HEIGHT = 1080;
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;

  // --------------------------------------------------------------------------- styles
  const CSS = `
#sb-vs{position:absolute;left:0;top:0;width:1920px;height:${HEIGHT}px;z-index:55;pointer-events:none;display:none;overflow:hidden;
  --c1:#e63950;--c2:#2f8bff;--ac:#ffc23d;--ink:#fff;--sub:rgba(255,255,255,.72);--fn:'Oswald',Impact,sans-serif;--fu:'Barlow Condensed','Oswald',sans-serif;--fv:'Oswald',Impact,sans-serif}
#sb-vs.vs-show{display:block}
#sb-vs *{box-sizing:border-box}
#sb-vs .vs-bg{position:absolute;inset:0;background:linear-gradient(180deg,#0b0d14,#141824);}
#sb-vs .vs-stage{position:absolute;inset:0}
#sb-vs .vs-side{position:absolute;top:0;bottom:0;width:calc(50% + 130px);display:flex;align-items:flex-end;padding-bottom:130px}
#sb-vs .vs-s1{left:0;padding-left:80px;padding-right:300px;clip-path:polygon(0 0,100% 0,calc(100% - 260px) 100%,0 100%)}
#sb-vs .vs-s2{right:0;padding-right:80px;padding-left:300px;flex-direction:row-reverse;clip-path:polygon(260px 0,100% 0,100% 100%,0 100%)}
#sb-vs .vs-face{position:absolute;inset:0;z-index:-2}
/* character art area: a full splash picture later; the player's name as a giant ghost until then */
#sb-vs .vs-art{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
#sb-vs .vs-art img{position:absolute;bottom:0;height:100%;width:auto;max-width:none;display:none}
#sb-vs .vs-s1 .vs-art img{left:0}#sb-vs .vs-s2 .vs-art img{right:0}
#sb-vs .vs-art.vs-has-art img{display:block}#sb-vs .vs-art.vs-has-art .vs-ghost{display:none}
/* a player set to "character image": the picture is centred in the player's half, and the small profile frame steps aside for it */
#sb-vs .vs-side[data-pic="art"] .vs-art img{left:50%;right:auto;transform:translateX(-50%)}
#sb-vs .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-ava{display:none}
/* …and with the frame gone, that player's team, name and record sit in the middle of their name plate */
#sb-vs .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-info{align-items:center;text-align:center}
#sb-vs.vs-st-shattered .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-info{grid-template-columns:1fr;grid-template-areas:"team" "name" "sub" "rec";justify-items:center;padding:0 0 10px 0}
#sb-vs.vs-st-shattered .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-info .vs-name,#sb-vs.vs-st-shattered .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-info .vs-rec,#sb-vs.vs-st-shattered .vs-side[data-pic="art"] .vs-art.vs-has-art~.vs-info .vs-sub{justify-self:center}
#sb-vs.vs-st-shattered .vs-s1[data-pic="art"] .vs-art.vs-has-art~.vs-info{padding-left:20px}#sb-vs.vs-st-shattered .vs-s2[data-pic="art"] .vs-art.vs-has-art~.vs-info{padding-right:20px}
#sb-vs .vs-ghost{position:absolute;top:70px;white-space:nowrap;font:700 300px/1 var(--fn);text-transform:uppercase;color:var(--ink);opacity:.07;letter-spacing:-4px}
#sb-vs .vs-s1 .vs-ghost{left:50px}#sb-vs .vs-s2 .vs-ghost{right:50px}
#sb-vs .vs-s1 .vs-face{background:linear-gradient(90deg,color-mix(in srgb,var(--c1) 85%,#000),color-mix(in srgb,var(--c1) 45%,#000))}
#sb-vs .vs-s2 .vs-face{background:linear-gradient(270deg,color-mix(in srgb,var(--c2) 85%,#000),color-mix(in srgb,var(--c2) 45%,#000))}
#sb-vs .vs-ava{position:relative;flex:none;width:220px;height:220px;border-radius:14px;overflow:hidden;
  background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(0,0,0,.35));box-shadow:0 0 0 4px rgba(255,255,255,.9),0 10px 30px rgba(0,0,0,.5)}
#sb-vs .vs-ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#sb-vs .vs-plate{display:none}
#sb-vs .vs-ava .vs-ini{position:absolute;inset:0;display:grid;place-items:center;font:700 100px var(--fn);color:rgba(255,255,255,.9)}
#sb-vs .vs-ava.vs-has-img .vs-ini{display:none}
#sb-vs .vs-info{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px;padding:0 30px}
#sb-vs .vs-s2 .vs-info{align-items:flex-end;text-align:right}
#sb-vs .vs-team{font:700 30px var(--fu);letter-spacing:3px;text-transform:uppercase;color:var(--ac);min-height:0}
#sb-vs .vs-name{font:700 88px/1 var(--fn);color:var(--ink);white-space:nowrap;max-width:100%;text-shadow:0 4px 0 rgba(0,0,0,.35)}
#sb-vs .vs-sub{display:flex;gap:10px;align-items:center;font:600 26px var(--fu);color:var(--sub);letter-spacing:1px;text-transform:uppercase}
#sb-vs .vs-s2 .vs-sub{flex-direction:row-reverse}
#sb-vs .vs-flag{width:36px;height:24px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
#sb-vs .vs-rec{display:flex;gap:10px;align-items:baseline;margin-top:6px;font:700 30px var(--fu);color:var(--ink);letter-spacing:1px}
#sb-vs .vs-rec .vs-n{font-size:40px;line-height:1}
#sb-vs .vs-rec .vs-w .vs-n{color:#4ff0a0}#sb-vs .vs-rec .vs-l .vs-n{color:#ff7a8a}
#sb-vs .vs-rec i{font-style:normal;opacity:.8;font-size:24px}
#sb-vs .vs-rec small{font:600 18px var(--fu);color:var(--sub);letter-spacing:2px;text-transform:uppercase}
#sb-vs .vs-rec.vs-none{display:none}
#sb-vs .vs-mid{position:absolute;left:50%;top:50%;width:0;height:0;z-index:3;transform:scale(1.45)}
#sb-vs .vs-mark{position:absolute;left:0;top:0;transform:translate(-50%,-56%);display:grid;place-items:center}
#sb-vs .vs-mark span{font:700 128px/1 var(--fv);color:var(--ink);letter-spacing:-2px}
#sb-vs .vs-mark i{display:none;font-style:normal}
#sb-vs.vs-st-oni .vs-mark span,#sb-vs.vs-st-shattered .vs-mark span{position:relative;z-index:2}
#sb-vs.vs-st-oni .vs-mark>*,#sb-vs.vs-st-shattered .vs-mark>*{padding-right:44px!important;margin-right:-20px}
/* glow copies get a roomy box (same position) so the wide halo is never cut off at the box edge */
#sb-vs.vs-st-oni .vs-mark>i,#sb-vs.vs-st-shattered .vs-mark>i{padding:150px 194px 150px 160px!important;margin:-150px -170px -150px -150px}
#sb-vs .vs-round{position:absolute;left:0;top:100px;transform:translateX(-50%);white-space:nowrap;font:700 22px var(--fu);letter-spacing:4px;text-transform:uppercase;
  color:var(--ink);background:rgba(0,0,0,.55);padding:4px 16px;border-radius:4px}
#sb-vs .vs-fx{position:absolute;inset:0;z-index:4;overflow:visible}
#sb-vs .vs-p{position:absolute;left:0;top:0;width:var(--s);height:var(--s);background:var(--c);border-radius:50%;opacity:0;
  animation:vs-p var(--t) cubic-bezier(.15,.7,.3,1) forwards;box-shadow:0 0 calc(var(--s) * 2) var(--c)}
#sb-vs .vs-p.vs-spark{height:2px;width:calc(var(--s) * 7);border-radius:2px;transform-origin:0 50%}
#sb-vs .vs-p.vs-square{border-radius:1px;box-shadow:none}
#sb-vs .vs-p.vs-feather{width:calc(var(--s) * 3.2);border-radius:50%;box-shadow:none}
#sb-vs .vs-p.vs-star{clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);border-radius:0;width:calc(var(--s) * 2.4);height:calc(var(--s) * 2.4);box-shadow:none}
@keyframes vs-p{0%{opacity:1;transform:translate(0,0) rotate(var(--r))}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r))}}
#sb-vs .vs-flash{position:absolute;inset:0;z-index:5;background:radial-gradient(circle at 50% 50%,#fff,rgba(255,255,255,.55) 30%,transparent 68%);opacity:0}
#sb-vs.vs-clash .vs-flash{animation:vs-flash .32s ease-out}
@keyframes vs-flash{0%{opacity:.5}100%{opacity:0}}
#sb-vs.vs-clash.vs-shake{animation:vs-shake .4s linear}
@keyframes vs-shake{0%,100%{transform:none}20%{transform:translate(-9px,4px)}40%{transform:translate(8px,-5px)}60%{transform:translate(-6px,2px)}80%{transform:translate(4px,-2px)}}
/* generic entrance / exit (styles override) */
#sb-vs.vs-in .vs-s1{animation:vs-l .55s cubic-bezier(.2,.9,.25,1) both}
#sb-vs.vs-in .vs-s2{animation:vs-r .55s cubic-bezier(.2,.9,.25,1) both}
#sb-vs.vs-in .vs-bg{animation:vs-fade .3s both}
#sb-vs.vs-in .vs-mark{animation:vs-mark .5s .45s cubic-bezier(.2,.9,.3,1.4) both}
#sb-vs.vs-in .vs-round{animation:vs-fade .4s .75s both}
#sb-vs.vs-in .vs-info>*{animation:vs-up .45s both}
#sb-vs.vs-in .vs-team{animation-delay:.45s!important}#sb-vs.vs-in .vs-name{animation-delay:.52s!important}#sb-vs.vs-in .vs-sub{animation-delay:.6s!important}#sb-vs.vs-in .vs-rec{animation-delay:.7s!important}
#sb-vs.vs-out{animation:vs-out .45s ease-in forwards}
@keyframes vs-l{from{transform:translateX(-105%)}}
@keyframes vs-r{from{transform:translateX(105%)}}
@keyframes vs-fade{from{opacity:0}}
@keyframes vs-up{from{opacity:0;transform:translateY(16px)}}
@keyframes vs-mark{from{opacity:0;transform:translate(-50%,-56%) scale(3)}}
@keyframes vs-out{to{opacity:0;transform:translateY(-30px)}}
#sb-vs.vs-static,#sb-vs.vs-static *{animation:none!important}

/* ---------------------------------------------------------------- per-layout styles */
/* Classic */
#sb-vs.vs-st-classic .vs-mark span{color:#fff;text-shadow:0 0 30px var(--ac),0 6px 0 rgba(0,0,0,.4)}

/* Oni: white gi on rice paper, a blood-red sun, an ink brush stroke, gold names and a
   blood-flame VS. Panels wipe in like a brush, the sun rises, the VS stamps down like a seal. */
#sb-vs.vs-st-oni{--c1:#b3060f;--c2:#141210;--ac:#b3060f;--ink:#141210;--sub:#5f574b;--fn:'Saira Condensed','Arial Narrow',Impact,sans-serif;--fv:'Saira Condensed',Impact,sans-serif;--fu:'Chakra Petch','Segoe UI',sans-serif}
#sb-vs.vs-st-oni .vs-bg{background:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 55%,rgba(60,40,10,.2) 100%),
  repeating-linear-gradient(45deg,rgba(60,40,10,.03) 0 2px,transparent 2px 6px),repeating-linear-gradient(-45deg,rgba(60,40,10,.025) 0 2px,transparent 2px 7px),
  linear-gradient(180deg,#fbf8f1,#efe8da 60%,#e1d6c2)}
#sb-vs.vs-st-oni .vs-bg::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='r' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%235a0006'/%3E%3Cstop offset='.5' stop-color='%23d61a20'/%3E%3Cstop offset='1' stop-color='%234a0004'/%3E%3C/linearGradient%3E%3CradialGradient id='h' cx='.5' cy='.5' r='.5'%3E%3Cstop offset='0' stop-color='%23ffb347' stop-opacity='.85'/%3E%3Cstop offset='.5' stop-color='%23ff3b14' stop-opacity='.35'/%3E%3Cstop offset='1' stop-color='%23b3060f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cg transform='translate(960 540) rotate(24) scale(1.1 1.42) translate(-960 -540)'%3E%3Cpolygon points='867,0 844,45 838,90 852,135 823,180 813,225 819,270 781,315 791,360 798,405 776,450 754,495 750,540 760,585 772,630 782,675 805,720 794,765 804,810 823,855 850,900 844,945 850,990 875,1035 855,1080 1070,1080 1072,1035 1078,990 1078,945 1102,900 1102,855 1083,810 1112,765 1147,720 1152,675 1154,630 1162,585 1178,540 1143,495 1157,450 1151,405 1112,360 1097,315 1120,270 1099,225 1074,180 1064,135 1043,90 1045,45 1056,0' fill='%23141210' opacity='.92'/%3E%3Cpolygon points='881,0 858,45 852,90 866,135 837,180 827,225 833,270 795,315 805,360 812,405 790,450 768,495 764,540 774,585 786,630 796,675 819,720 808,765 818,810 837,855 864,900 858,945 864,990 889,1035 869,1080 1056,1080 1058,1035 1064,990 1064,945 1088,900 1088,855 1069,810 1098,765 1133,720 1138,675 1140,630 1148,585 1164,540 1129,495 1143,450 1137,405 1098,360 1083,315 1106,270 1085,225 1060,180 1050,135 1029,90 1031,45 1042,0' fill='url%28%23r%29'/%3E%3C/g%3E%3Cellipse cx='960' cy='520' rx='300' ry='330' fill='url%28%23h%29'/%3E%3Cpolygon points='805,410 810,417 805,425 798,418' fill='%23e9c35e' opacity='0.46'/%3E%3Cpolygon points='932,179 935,181 932,185 930,182' fill='%23e9c35e' opacity='0.48'/%3E%3Cpolygon points='1153,136 1156,140 1153,145 1149,140' fill='%23e9c35e' opacity='0.65'/%3E%3Cpolygon points='1227,82 1232,87 1227,94 1222,88' fill='%23e9c35e' opacity='0.72'/%3E%3Cpolygon points='1236,877 1242,885 1236,895 1228,886' fill='%23e9c35e' opacity='0.59'/%3E%3Cpolygon points='899,379 906,387 899,398 891,389' fill='%23e9c35e' opacity='0.93'/%3E%3Cpolygon points='709,187 712,190 709,195 705,191' fill='%23e9c35e' opacity='0.57'/%3E%3Cpolygon points='949,632 952,636 949,641 945,637' fill='%23e9c35e' opacity='0.45'/%3E%3Cpolygon points='902,393 906,399 902,407 896,400' fill='%23e9c35e' opacity='0.93'/%3E%3Cpolygon points='1097,550 1102,557 1097,565 1091,558' fill='%23e9c35e' opacity='0.79'/%3E%3Cpolygon points='639,964 645,971 639,981 631,973' fill='%23e9c35e' opacity='0.89'/%3E%3Cpolygon points='1174,419 1178,424 1174,430 1170,425' fill='%23e9c35e' opacity='0.50'/%3E%3Cpolygon points='1057,65 1059,67 1057,70 1054,68' fill='%23e9c35e' opacity='0.55'/%3E%3Cpolygon points='717,365 719,367 717,370 714,368' fill='%23e9c35e' opacity='0.45'/%3E%3Cpolygon points='709,105 713,110 709,115 704,110' fill='%23e9c35e' opacity='0.46'/%3E%3Cpolygon points='1230,660 1232,663 1230,667 1226,664' fill='%23e9c35e' opacity='0.58'/%3E%3Cpolygon points='850,390 852,393 850,397 847,394' fill='%23e9c35e' opacity='0.87'/%3E%3Cpolygon points='1315,498 1319,503 1315,510 1310,504' fill='%23e9c35e' opacity='0.49'/%3E%3Cpolygon points='674,366 677,370 674,375 670,371' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='716,16 723,25 716,36 708,27' fill='%23e9c35e' opacity='0.71'/%3E%3Cpolygon points='706,584 707,587 706,589 703,587' fill='%23e9c35e' opacity='0.71'/%3E%3Cpolygon points='1305,926 1310,932 1305,941 1298,934' fill='%23e9c35e' opacity='0.58'/%3E%3Cpolygon points='864,173 870,180 864,190 857,182' fill='%23e9c35e' opacity='0.72'/%3E%3Cpolygon points='1161,352 1164,356 1161,361 1157,357' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='1309,913 1315,921 1309,931 1302,922' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='1133,239 1137,245 1133,252 1127,246' fill='%23e9c35e' opacity='0.63'/%3E%3Cpolygon points='621,26 624,30 621,35 617,31' fill='%23e9c35e' opacity='0.58'/%3E%3Cpolygon points='1099,1028 1103,1033 1099,1040 1093,1034' fill='%23e9c35e' opacity='0.92'/%3E%3Cpolygon points='1311,1027 1315,1031 1311,1037 1307,1032' fill='%23e9c35e' opacity='0.56'/%3E%3Cpolygon points='763,209 766,212 763,217 760,213' fill='%23e9c35e' opacity='0.76'/%3E%3Cpolygon points='1248,902 1253,908 1248,915 1243,909' fill='%23e9c35e' opacity='0.78'/%3E%3Cpolygon points='1176,85 1181,92 1176,100 1169,93' fill='%23e9c35e' opacity='0.90'/%3E%3Cpolygon points='1163,805 1168,810 1163,817 1158,811' fill='%23e9c35e' opacity='0.54'/%3E%3Cpolygon points='1168,352 1174,359 1168,369 1161,361' fill='%23e9c35e' opacity='0.94'/%3E%3Cpolygon points='885,425 892,433 885,445 876,435' fill='%23e9c35e' opacity='0.81'/%3E%3Cpolygon points='722,134 725,137 722,141 719,138' fill='%23e9c35e' opacity='0.90'/%3E%3Cpolygon points='1181,150 1187,158 1181,168 1173,159' fill='%23e9c35e' opacity='0.94'/%3E%3Cpolygon points='1073,373 1078,378 1073,386 1067,380' fill='%23e9c35e' opacity='0.52'/%3E%3Cpolygon points='610,1042 615,1049 610,1057 604,1050' fill='%23e9c35e' opacity='0.71'/%3E%3Cpolygon points='1272,460 1279,469 1272,479 1264,470' fill='%23e9c35e' opacity='0.86'/%3E%3Cpolygon points='752,268 755,272 752,277 748,273' fill='%23e9c35e' opacity='0.57'/%3E%3Cpolygon points='1022,275 1026,280 1022,287 1017,281' fill='%23e9c35e' opacity='0.52'/%3E%3Cpolygon points='1255,377 1259,382 1255,389 1250,383' fill='%23e9c35e' opacity='0.74'/%3E%3Cpolygon points='1251,446 1258,454 1251,465 1243,456' fill='%23e9c35e' opacity='0.70'/%3E%3Cpolygon points='983,563 985,565 983,568 981,566' fill='%23e9c35e' opacity='0.67'/%3E%3Cpolygon points='732,-3 738,4 732,14 724,6' fill='%23e9c35e' opacity='0.54'/%3E%3C/svg%3E") center/100% 100% no-repeat;filter:drop-shadow(0 0 40px rgba(179,6,15,.35))}
#sb-vs.vs-st-oni .vs-bg::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'><path fill='%23141210' d='M-40 820 C 300 760 520 700 820 640 C 1100 590 1400 520 1960 380 L1960 470 C 1500 560 1200 640 900 700 C 620 760 380 820 -40 900 Z' opacity='.9'/><g fill='%23141210'><circle cx='1510' cy='420' r='14'/><circle cx='1588' cy='392' r='6'/><circle cx='430' cy='902' r='10'/><circle cx='360' cy='930' r='4'/><circle cx='1700' cy='520' r='5'/></g></svg>") center/100% 100% no-repeat}
#sb-vs.vs-st-oni .vs-side{left:0;right:0;width:auto;padding:0 0 118px 0;clip-path:none}
#sb-vs.vs-st-oni .vs-s1{padding-left:96px;padding-right:1040px}
#sb-vs.vs-st-oni .vs-s2{padding-right:96px;padding-left:1040px}
#sb-vs.vs-st-oni .vs-face{display:none}
#sb-vs.vs-st-oni .vs-ghost{top:110px;font:italic 800 340px/1 var(--fn);color:#141210;opacity:.06}
#sb-vs.vs-st-oni .vs-s1 .vs-art{right:960px}#sb-vs.vs-st-oni .vs-s2 .vs-art{left:960px}
#sb-vs.vs-st-oni .vs-plate{display:block;position:absolute;bottom:92px;width:920px;height:250px;z-index:-1;
  background:repeating-linear-gradient(45deg,rgba(60,40,10,.035) 0 2px,transparent 2px 5px),linear-gradient(180deg,#fdfbf6,#efe9dd 60%,#d8cfbf);
  box-shadow:inset 0 -6px 0 #141210,inset 0 3px 0 #e9c35e,0 18px 40px rgba(0,0,0,.25)}
#sb-vs.vs-st-oni .vs-s1 .vs-plate{left:56px;clip-path:polygon(0 0,100% 0,calc(100% - 46px) 100%,0 100%)}
#sb-vs.vs-st-oni .vs-s2 .vs-plate{right:56px;clip-path:polygon(0 0,100% 0,100% 100%,46px 100%)}
#sb-vs.vs-st-oni .vs-plate i{position:absolute;top:14px;font:700 15px var(--fu);letter-spacing:3px;color:#b3060f}
#sb-vs.vs-st-oni .vs-s1 .vs-plate i{right:70px}#sb-vs.vs-st-oni .vs-s2 .vs-plate i{left:70px}
#sb-vs.vs-st-oni .vs-ava{width:260px;height:260px;border-radius:0;background:#b3060f;box-shadow:0 0 0 5px #fbf8f1,0 0 0 9px #141210,0 14px 30px rgba(0,0,0,.3)}
#sb-vs.vs-st-oni .vs-ava img,#sb-vs.vs-st-oni .vs-ava .vs-ini{left:8px;top:8px;width:calc(100% - 16px);height:calc(100% - 16px);background:#fbf8f1}
#sb-vs.vs-st-oni .vs-ava .vs-ini{font:italic 800 150px/1 var(--fn);color:#b3060f}
#sb-vs.vs-st-oni .vs-info{padding:0 0 22px 34px}
#sb-vs.vs-st-oni .vs-s2 .vs-info{padding:0 34px 22px 0}
#sb-vs.vs-st-oni .vs-team{font:800 32px var(--fn);letter-spacing:2px;color:#b3060f}
#sb-vs.vs-st-oni .vs-name{font:italic 800 112px/1.02 var(--fn);text-transform:uppercase;padding-right:8px;text-shadow:none;
  background:linear-gradient(180deg,#fff3cc 0%,#e9c35e 38%,#b0841f 62%,#f2d27e 80%,#6b4a0c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 1px #2a1d06) drop-shadow(0 0 1px #2a1d06) drop-shadow(0 4px 0 rgba(20,18,16,.55))}
#sb-vs.vs-st-oni .vs-s1 .vs-name{align-self:flex-start}
#sb-vs.vs-st-oni .vs-bg::after{display:none}
#sb-vs.vs-st-oni .vs-sub{font:600 20px var(--fu);letter-spacing:4px;color:#5f574b}
#sb-vs.vs-st-oni .vs-rec{font:700 22px var(--fu);color:#141210}
#sb-vs.vs-st-oni .vs-rec .vs-w,#sb-vs.vs-st-oni .vs-rec .vs-l{display:flex;align-items:baseline;gap:6px;padding:4px 16px 2px;background:#141210;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#sb-vs.vs-st-oni .vs-rec .vs-n{font:700 40px/1 var(--fu)}
#sb-vs.vs-st-oni .vs-rec .vs-w .vs-n{color:#f6dc8c}#sb-vs.vs-st-oni .vs-rec .vs-l .vs-n{color:#ff6a4a}
#sb-vs.vs-st-oni .vs-rec i{color:#e9c35e;font-size:15px;letter-spacing:2px}
#sb-vs.vs-st-oni .vs-rec .vs-sep{display:none}
#sb-vs.vs-st-oni .vs-rec small{color:#5f574b;font:600 13px var(--fu);letter-spacing:3px;max-width:90px;line-height:1.1}
#sb-vs.vs-st-oni .vs-mid{transform:none}
#sb-vs.vs-st-oni .vs-mark{transform:translate(-50%,-56%)}
#sb-vs.vs-st-oni .vs-mark::before{display:none;content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:900 470px/1 'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP','MS Mincho',serif;color:rgba(255,236,200,.18);z-index:-1}
#sb-vs.vs-st-oni .vs-mark span{font:italic 800 280px/1 var(--fv);letter-spacing:-6px;padding:0 24px 0 10px;
  background:linear-gradient(180deg,#fffaf0 0%,#fbf1d8 48%,#f2d58e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-stroke:6px #141210;paint-order:stroke fill;filter:none}
#sb-vs.vs-st-oni .vs-mark>*{grid-area:1/1}
#sb-vs.vs-st-oni .vs-mark i{display:block;font:italic 800 280px/1 var(--fv);letter-spacing:-6px;padding:0 24px 0 10px}
#sb-vs.vs-st-oni .vs-g1{color:#ff5a14;-webkit-text-stroke:18px #ff5a14;paint-order:stroke fill;text-shadow:0 0 10px rgba(255,190,80,.55)}
#sb-vs.vs-st-oni .vs-g2{color:#ffd35c;-webkit-text-stroke:12px #ffd35c;paint-order:stroke fill;opacity:.35;will-change:opacity}
#sb-vs.vs-st-oni.vs-show .vs-g2{animation:vs-xf .5s ease-in-out infinite alternate}
@keyframes vs-xf{from{opacity:.35}to{opacity:1}}
#sb-vs.vs-st-oni .vs-sh-cv{display:block;position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:2;pointer-events:none}
#sb-vs.vs-st-oni .vs-round{top:-452px;font:700 26px var(--fu);letter-spacing:9px;color:#141210;background:#fbf8f1;padding:12px 56px 10px 62px;border-radius:0;
  clip-path:polygon(20px 0,100% 0,calc(100% - 20px) 100%,0 100%);box-shadow:inset 0 -4px 0 #141210,inset 0 3px 0 #e9c35e}
#sb-vs.vs-st-oni .vs-flash{background:radial-gradient(circle at 50% 50%,#fff,rgba(255,241,194,.7) 26%,rgba(179,6,15,.25) 52%,transparent 70%)}
#sb-vs.vs-st-oni.vs-in .vs-bg{animation:vs-oni-wipe .5s cubic-bezier(.6,0,.3,1) both}
#sb-vs.vs-st-oni.vs-in .vs-bg::before{animation:vs-oni-sun .8s .25s cubic-bezier(.2,.9,.3,1.1) both}
#sb-vs.vs-st-oni.vs-in .vs-bg::after{animation:vs-oni-wipe .45s .4s cubic-bezier(.6,0,.3,1) both}
#sb-vs.vs-st-oni.vs-in .vs-s1{animation:vs-oni-l .6s .3s cubic-bezier(.2,.9,.25,1) both}
#sb-vs.vs-st-oni.vs-in .vs-s2{animation:vs-oni-r .6s .36s cubic-bezier(.2,.9,.25,1) both}
#sb-vs.vs-st-oni.vs-in .vs-mark{animation:vs-oni-stamp .6s .52s cubic-bezier(.2,.9,.3,1.35) both}
#sb-vs.vs-st-oni.vs-in .vs-round{animation:vs-sh-drop .5s .9s cubic-bezier(.2,.9,.3,1.2) both}
#sb-vs.vs-st-oni.vs-in .vs-ghost{animation:vs-fade 1.2s .5s both}
#sb-vs.vs-st-oni.vs-in .vs-team{animation-delay:.72s!important}#sb-vs.vs-st-oni.vs-in .vs-name{animation-delay:.78s!important}
#sb-vs.vs-st-oni.vs-in .vs-sub{animation-delay:.9s!important}#sb-vs.vs-st-oni.vs-in .vs-rec{animation-delay:.98s!important}
#sb-vs.vs-st-oni.vs-out{animation:vs-oni-out .55s cubic-bezier(.6,0,.4,1) forwards}
@keyframes vs-oni-wipe{from{clip-path:polygon(0 0,0 0,-8% 100%,-8% 100%)}to{clip-path:polygon(0 0,108% 0,100% 100%,-8% 100%)}}
@keyframes vs-oni-out{from{clip-path:polygon(0 0,108% 0,100% 100%,-8% 100%)}to{clip-path:polygon(108% 0,108% 0,100% 100%,100% 100%)}}
@keyframes vs-oni-sun{from{transform:scale(.15) translateY(200px);opacity:0}to{transform:none;opacity:1}}
@keyframes vs-oni-l{from{opacity:0;transform:translateX(-160px)}}
@keyframes vs-oni-r{from{opacity:0;transform:translateX(160px)}}
@keyframes vs-oni-stamp{0%{transform:translate(-50%,-56%) scale(2.2) rotate(-10deg);opacity:0;filter:blur(8px)}60%{transform:translate(-50%,-56%) scale(.92);opacity:1;filter:none}100%{transform:translate(-50%,-56%)}}

/* Shattered: two slabs of obsidian glass slam together along a molten fault line.
   Same materials as the layout: obsidian plates with a moving glint, chrome italic names that decode
   in, ember orange, glowing hairline cracks, shockwaves and sparks — and it leaves by shattering. */
#sb-vs.vs-st-shattered{--c1:#c3132d;--c2:#d48a1d;--ac:#ff5a1f;--hot:#ffb36b;--deep:#a3180a;--steel:#d9dce4;--sub:#8d919d;
  --fn:'Saira Condensed','Arial Narrow',Impact,sans-serif;--fu:'Chakra Petch',sans-serif;--fv:'Saira Condensed',Impact,sans-serif}
#sb-vs.vs-st-shattered .vs-bg{background:radial-gradient(ellipse 70% 55% at 50% 108%,rgba(255,90,31,.38),transparent 70%),radial-gradient(ellipse 40% 60% at 50% 50%,rgba(163,24,10,.25),transparent 70%),#040406}
#sb-vs.vs-st-shattered .vs-side{left:0;right:0;width:auto;padding:0 0 118px 0}
#sb-vs.vs-st-shattered.vs-show>.vs-stage{will-change:transform}
#sb-vs.vs-st-shattered .vs-s1{padding-left:96px;padding-right:1040px}
#sb-vs.vs-st-shattered .vs-s2{padding-right:96px;padding-left:1040px}
/* obsidian slabs */
#sb-vs.vs-st-shattered .vs-face{overflow:hidden;background:
  radial-gradient(ellipse 30% 60% at 50% 50%,rgba(255,90,31,.16),transparent 70%),
  linear-gradient(158deg,transparent 0 31%,rgba(255,255,255,.03) 31% 31.2%,transparent 31.2% 64%,rgba(255,255,255,.025) 64% 64.15%,transparent 64.15%),
  linear-gradient(24deg,transparent 0 47%,rgba(255,255,255,.025) 47% 47.15%,transparent 47.15%),
  linear-gradient(180deg,#17181d 0%,#0b0c0f 46%,#050507 100%);
}
#sb-vs.vs-st-shattered .vs-s1 .vs-face{box-shadow:inset -1px 0 0 rgba(255,140,80,.2)}
#sb-vs.vs-st-shattered .vs-face::after{content:'';position:absolute;inset:auto 0 0 0;height:380px;background:linear-gradient(0deg,rgba(255,90,31,.2),transparent)}
#sb-vs.vs-st-shattered .vs-face::before{content:'';position:absolute;top:0;bottom:0;left:0;width:900px;transform:translateX(-1000px);will-change:transform;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.055) 50%,transparent 70%)}
/* the ghost name (character art goes here later) */
#sb-vs.vs-st-shattered .vs-ghost{top:96px;font:italic 800 360px/1 var(--fn);letter-spacing:0;opacity:1;color:transparent;
  -webkit-text-stroke:2px rgba(255,140,80,.16);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,0) 75%);-webkit-background-clip:text;background-clip:text}
#sb-vs.vs-st-shattered .vs-s1 .vs-ghost{left:60px}#sb-vs.vs-st-shattered .vs-s2 .vs-ghost{right:60px}
#sb-vs.vs-st-shattered .vs-art img{-webkit-mask:linear-gradient(0deg,transparent 0,#000 30%);mask:linear-gradient(0deg,transparent 0,#000 30%)}
#sb-vs.vs-st-shattered .vs-s1 .vs-art{right:960px}#sb-vs.vs-st-shattered .vs-s2 .vs-art{left:960px}
/* name plate (like the layout's, scaled up) */
#sb-vs.vs-st-shattered .vs-plate{display:block;position:absolute;bottom:92px;width:920px;height:250px;z-index:-1;overflow:hidden;
  background:linear-gradient(0deg,rgba(255,90,31,.22),transparent 60px),linear-gradient(180deg,#1b1c22 0%,#0b0c0f 50%,#050507 100%);box-shadow:inset 0 0 0 1px rgba(255,90,31,.35)}
#sb-vs.vs-st-shattered .vs-s1 .vs-plate{left:56px;clip-path:polygon(0 0,100% 0,calc(100% - 46px) 100%,0 100%)}
#sb-vs.vs-st-shattered .vs-s2 .vs-plate{right:56px;clip-path:polygon(0 0,100% 0,100% 100%,46px 100%)}
#sb-vs.vs-st-shattered .vs-plate::before{content:'';position:absolute;top:0;bottom:0;left:0;width:420px;transform:translateX(-440px);will-change:transform;
  background:linear-gradient(105deg,transparent 25%,rgba(255,255,255,.08) 50%,transparent 75%)}
#sb-vs.vs-st-shattered .vs-plate::after{content:'';position:absolute;left:0;top:0;width:220px;height:3px;background:linear-gradient(90deg,transparent,#ffb36b,#fff3e2,#ffb36b,transparent);box-shadow:0 0 14px #ff5a1f;transform:translateX(-240px);will-change:transform}
#sb-vs.vs-st-shattered .vs-plate i{position:absolute;top:13px;font:700 17px var(--fu);letter-spacing:3px;color:var(--ac)}
#sb-vs.vs-st-shattered .vs-s1 .vs-plate i{right:70px}#sb-vs.vs-st-shattered .vs-s2 .vs-plate i{left:70px}
/* avatar: a shard of glass with a molten rim */
#sb-vs.vs-st-shattered .vs-ava{width:272px;height:272px;border-radius:0;box-shadow:none;background:linear-gradient(160deg,#ffd0a0,#ff5a1f 45%,#a3180a);
  clip-path:polygon(14% 0,100% 6%,90% 100%,0 88%);margin-bottom:-14px}
#sb-vs.vs-st-shattered .vs-ava img,#sb-vs.vs-st-shattered .vs-ava .vs-ini{left:4px;top:4px;width:calc(100% - 8px);height:calc(100% - 8px);clip-path:polygon(14% 0,100% 6%,90% 100%,0 88%);background:linear-gradient(160deg,#22232a,#07070a)}
#sb-vs.vs-st-shattered .vs-ava .vs-ini{width:auto;height:auto;font:italic 800 150px/1 var(--fn);color:#d9dce4}
#sb-vs.vs-st-shattered .vs-s2 .vs-ava{clip-path:polygon(0 6%,86% 0,100% 88%,10% 100%)}
#sb-vs.vs-st-shattered .vs-s2 .vs-ava img,#sb-vs.vs-st-shattered .vs-s2 .vs-ava .vs-ini{clip-path:polygon(0 6%,86% 0,100% 88%,10% 100%)}
/* text */
#sb-vs.vs-st-shattered .vs-info{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"team team" "name name" "sub rec";gap:2px 22px;padding:0 0 18px 30px;align-items:center;
  min-height:180px;align-content:center}   /* as tall as the name plate, so a name on its own sits in the middle of the plate, not on its floor */
#sb-vs.vs-st-shattered .vs-s2 .vs-info{grid-template-columns:1fr auto;grid-template-areas:"team team" "name name" "rec sub";padding:0 30px 18px 0;justify-items:end}
#sb-vs.vs-st-shattered .vs-s2 .vs-name{justify-self:end}
#sb-vs.vs-st-shattered .vs-team{grid-area:team;font:800 32px/1 var(--fn);letter-spacing:2px;color:var(--ac)}   /* line-height 1: with a team, a name and a record the stack still starts inside the plate */
#sb-vs.vs-st-shattered .vs-name{grid-area:name;justify-self:start;font:italic 800 112px/1.02 var(--fn);letter-spacing:1px;text-transform:uppercase;padding-right:.17em;margin-right:-.17em;text-shadow:none;max-width:calc(100% + .17em);overflow:visible;
  background:linear-gradient(180deg,#fff 0%,#e9ebf0 40%,#8f939d 52%,#d9dce3 76%,#fff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 0 rgba(0,0,0,.75))}
#sb-vs.vs-st-shattered .vs-sub{grid-area:sub;font:600 20px var(--fu);letter-spacing:4px;color:var(--sub)}
#sb-vs.vs-st-shattered .vs-flag{width:44px;height:29px;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.2)}
#sb-vs.vs-st-shattered .vs-rec{grid-area:rec;margin:0;gap:8px;align-items:center;font:700 22px var(--fu)}
#sb-vs.vs-st-shattered .vs-s1 .vs-rec{justify-self:end}
#sb-vs.vs-st-shattered .vs-s2 .vs-rec{justify-self:start}
#sb-vs.vs-st-shattered .vs-rec .vs-w,#sb-vs.vs-st-shattered .vs-rec .vs-l{display:flex;align-items:baseline;gap:6px;padding:4px 16px 2px;background:linear-gradient(180deg,#1c1d23,#07070a);
  box-shadow:inset 0 0 0 1px rgba(255,90,31,.55),inset 0 0 18px rgba(255,90,31,.18);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#sb-vs.vs-st-shattered .vs-rec .vs-n{font:700 40px/1 var(--fu);color:#fff;text-shadow:0 0 14px rgba(255,90,31,.6)}
#sb-vs.vs-st-shattered .vs-rec .vs-w .vs-n{color:#fff}#sb-vs.vs-st-shattered .vs-rec .vs-l .vs-n{color:#ffb36b}
#sb-vs.vs-st-shattered .vs-rec i{font-size:15px;letter-spacing:2px;color:var(--ac);opacity:1}
#sb-vs.vs-st-shattered .vs-rec .vs-sep{display:none}
#sb-vs.vs-st-shattered .vs-rec small{font:600 15px var(--fu);letter-spacing:2.5px;color:#b9bdc8;max-width:104px;line-height:1.1}
/* the fault line + cracks around the VS */
#sb-vs .vs-sh-svg{display:none}
#sb-vs.vs-st-shattered .vs-sh-svg{display:block;position:absolute;inset:0;width:1920px;height:1080px;z-index:2;overflow:visible;pointer-events:none}
#sb-vs .vs-sh-hot,#sb-vs .vs-sh-ball,#sb-vs .vs-sh-embers{display:none}
#sb-vs.vs-st-shattered .vs-sh-hot{display:block;position:absolute;left:560px;top:290px;width:800px;height:500px;z-index:2;will-change:opacity}
#sb-vs.vs-st-shattered .vs-sh-hot svg{left:0;top:0;width:800px;height:500px}
#sb-vs.vs-st-shattered .vs-sh-ball{display:block;position:absolute;left:-230px;top:-250px;width:460px;height:460px;border-radius:50%;will-change:opacity;
  background:radial-gradient(circle,rgba(255,120,40,.5),rgba(255,90,31,.12) 40%,transparent 68%)}
#sb-vs.vs-st-shattered .vs-sh-embers{display:block;position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}
#sb-vs .vs-sh-embers i{position:absolute;bottom:-12px;width:var(--s);height:var(--s);border-radius:50%;opacity:0;will-change:transform,opacity;
  background:radial-gradient(circle,#fff3dc 0,#ffb36b 30%,rgba(255,90,31,.5) 55%,transparent 72%);animation:vs-sh-rise var(--t) var(--d) linear infinite}
@keyframes vs-sh-rise{0%{transform:translate(0,0);opacity:0}10%{opacity:var(--o)}50%{transform:translate(var(--x),-560px);opacity:var(--o)}100%{transform:translate(calc(var(--x) * -.4),-1120px);opacity:0}}
#sb-vs.vs-st-shattered .vs-sh-svg path{fill:none;stroke-linejoin:round;stroke-linecap:round}
#sb-vs.vs-st-shattered .vs-sh-glow{stroke:#ff5a1f;stroke-width:30;opacity:.12}
#sb-vs.vs-st-shattered .vs-sh-glow2{stroke:#ff6a2a;stroke-width:13;opacity:.3}
#sb-vs.vs-st-shattered .vs-sh-line{stroke:#ffb36b;stroke-width:3.5}
#sb-vs.vs-st-shattered .vs-sh-core{stroke:#fff6ea;stroke-width:1.4}
#sb-vs.vs-st-shattered .vs-sh-crack{stroke:#ff7a3a;stroke-width:1.6;opacity:.8}
#sb-vs.vs-st-shattered .vs-sh-crack.vs-far{stroke-width:1;opacity:.45}
/* centre */
#sb-vs.vs-st-shattered .vs-mid{transform:none}
#sb-vs.vs-st-shattered .vs-mark{transform:translate(-50%,-54%)}
#sb-vs.vs-st-shattered .vs-mark span{position:relative;font:italic 800 300px/1 var(--fv);letter-spacing:-6px;padding:0 24px 0 10px;
  background:linear-gradient(180deg,#fff 0%,#eceef2 34%,#8f939d 47%,#ffd0a0 58%,#ff5a1f 78%,#a3180a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 2px rgba(0,0,0,.9))}
#sb-vs.vs-st-shattered .vs-mark>*{grid-area:1/1}
#sb-vs.vs-st-shattered .vs-mark i{display:block;font:italic 800 300px/1 var(--fv);letter-spacing:-6px;padding:0 24px 0 10px}
#sb-vs.vs-st-shattered .vs-g1{color:#ff5a1f;text-shadow:0 0 26px rgba(255,90,31,.9),0 0 64px rgba(255,140,60,.6);background:radial-gradient(closest-side,rgba(255,120,45,.3),rgba(255,120,45,.13) 40%,rgba(255,120,45,.04) 72%,rgba(255,120,45,0))}
#sb-vs.vs-st-shattered .vs-g2{color:transparent;text-shadow:0 0 40px rgba(255,120,50,.75),0 0 90px rgba(255,170,90,.5);background:radial-gradient(closest-side,rgba(255,150,70,.28),rgba(255,150,70,.12) 40%,rgba(255,150,70,.03) 72%,rgba(255,150,70,0));opacity:0;will-change:opacity}
#sb-vs.vs-st-shattered.vs-show .vs-g2{animation:vs-sh-xf 2.2s ease-in-out infinite}
@keyframes vs-sh-xf{50%{opacity:1}}
#sb-vs.vs-st-shattered .vs-round{top:-462px;font:700 26px var(--fu);letter-spacing:9px;color:var(--steel);background:linear-gradient(180deg,#17181d,#050507);padding:12px 54px 10px 63px;border-radius:0;
  clip-path:polygon(22px 0,100% 0,calc(100% - 22px) 100%,0 100%);box-shadow:inset 0 2px 0 #ff5a1f,inset 0 0 0 1px rgba(255,90,31,.3)}
#sb-vs.vs-st-shattered .vs-round::before,#sb-vs.vs-st-shattered .vs-round::after{content:'';position:absolute;top:50%;width:26px;height:2px;background:#ff5a1f}
#sb-vs.vs-st-shattered .vs-round::before{left:24px}#sb-vs.vs-st-shattered .vs-round::after{right:22px}
#sb-vs .vs-sh-cv{display:none}
#sb-vs.vs-st-shattered .vs-sh-cv{display:block;position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:4;pointer-events:none}
#sb-vs .vs-sh-wave{position:absolute;width:var(--d);height:var(--d);margin:calc(var(--d) / -2) 0 0 calc(var(--d) / -2);border-radius:50%;border:3px solid #ffb36b;
  box-shadow:0 0 22px #ff5a1f,inset 0 0 16px rgba(255,90,31,.8);will-change:transform,opacity;animation:vs-sh-wave .9s cubic-bezier(.1,.6,.3,1) forwards}
@keyframes vs-sh-wave{from{transform:scale(.03);opacity:1}60%{opacity:.7}to{transform:scale(1);opacity:0}}
#sb-vs.vs-st-shattered .vs-flash{background:radial-gradient(circle at 50% 50%,#fff,rgba(255,208,160,.75) 24%,rgba(255,90,31,.3) 48%,transparent 68%)}

/* --- always running while shown: glints, comets, molten pulse, heat, drifting ghost names --- */
#sb-vs.vs-st-shattered.vs-show .vs-face::before{animation:vs-sh-glint 9s ease-in-out infinite}
#sb-vs.vs-st-shattered.vs-show .vs-s2 .vs-face::before{animation-delay:4.5s}
#sb-vs.vs-st-shattered.vs-show .vs-plate::before{animation:vs-sh-pglint 7s 1.2s ease-in-out infinite}
#sb-vs.vs-st-shattered.vs-show .vs-plate::after{animation:vs-sh-comet 3.8s 1.4s linear infinite}
#sb-vs.vs-st-shattered.vs-show .vs-s2 .vs-plate::after{animation-delay:3.3s}
#sb-vs.vs-st-shattered.vs-show .vs-sh-hot{animation:vs-sh-cpulse 2.2s ease-in-out infinite}
#sb-vs.vs-st-shattered.vs-show .vs-sh-ball{animation:vs-sh-throb 2.2s ease-in-out infinite}
#sb-vs.vs-st-shattered.vs-in .vs-sh-ball{animation:vs-fade .4s .4s both,vs-sh-throb 2.2s 1s ease-in-out infinite}
#sb-vs.vs-st-shattered.vs-in .vs-sh-embers{animation:vs-fade 1s .4s both}
@keyframes vs-sh-glint{0%,60%{transform:translateX(-1000px)}100%{transform:translateX(2000px)}}
@keyframes vs-sh-pglint{0%,60%{transform:translateX(-440px)}100%{transform:translateX(940px)}}
@keyframes vs-sh-comet{0%{transform:translateX(-240px)}55%,100%{transform:translateX(960px)}}
@keyframes vs-sh-cpulse{50%{opacity:.45}}
@keyframes vs-sh-throb{50%{opacity:.55}}

/* --- entrance: slam → impact → fault line burns in → VS slams → plates ignite → names decode --- */
#sb-vs.vs-st-shattered.vs-in .vs-bg{animation:vs-fade .3s both}
#sb-vs.vs-st-shattered.vs-in .vs-s1{animation:vs-sh-in1 .9s both}
#sb-vs.vs-st-shattered.vs-in .vs-s2{animation:vs-sh-in2 .9s both}
@keyframes vs-sh-in1{0%{transform:translateX(-70%);filter:brightness(3.2) saturate(0);animation-timing-function:cubic-bezier(.6,0,1,.6)}
  42%{transform:translateX(0);filter:brightness(2.4) saturate(.2);animation-timing-function:ease-out}48%{transform:translateX(-14px)}100%{transform:none;filter:none}}
@keyframes vs-sh-in2{0%{transform:translateX(70%);filter:brightness(3.2) saturate(0);animation-timing-function:cubic-bezier(.6,0,1,.6)}
  42%{transform:translateX(0);filter:brightness(2.4) saturate(.2);animation-timing-function:ease-out}48%{transform:translateX(14px)}100%{transform:none;filter:none}}
#sb-vs.vs-st-shattered.vs-in .vs-sh-svg path{stroke-dasharray:1;animation:vs-sh-draw .55s .38s cubic-bezier(.3,.7,.3,1) both}
#sb-vs.vs-st-shattered.vs-in .vs-sh-crack{animation:vs-sh-draw .45s .44s ease-out both}
#sb-vs.vs-st-shattered.vs-in .vs-sh-crack.vs-far{animation-delay:.56s}
@keyframes vs-sh-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
#sb-vs.vs-st-shattered.vs-in .vs-mark{animation:vs-sh-slam .65s .42s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes vs-sh-slam{0%{transform:translate(-50%,-54%) scale(2.8);opacity:0;filter:blur(10px)}55%{transform:translate(-50%,-54%) scale(.86);opacity:1;filter:none}100%{transform:translate(-50%,-54%)}}
#sb-vs.vs-st-shattered.vs-in .vs-plate{animation:vs-sh-ignite .7s .62s both}
#sb-vs.vs-st-shattered.vs-in .vs-s2 .vs-plate{animation-delay:.7s}
@keyframes vs-sh-ignite{from{opacity:0;transform:translateY(70px);filter:brightness(3) saturate(0)}50%{opacity:1;transform:none;filter:brightness(2) saturate(.4)}to{filter:none}}
#sb-vs.vs-st-shattered.vs-in .vs-ava{animation:vs-sh-ava .55s .72s cubic-bezier(.2,.9,.3,1.3) both}
#sb-vs.vs-st-shattered.vs-in .vs-s2 .vs-ava{animation-delay:.8s}
@keyframes vs-sh-ava{from{opacity:0;transform:translateY(40px) rotate(-6deg) scale(1.2);filter:brightness(3)}}
#sb-vs.vs-st-shattered.vs-in .vs-info>*{animation:vs-up .45s both}
#sb-vs.vs-st-shattered.vs-in .vs-team{animation-delay:.78s!important}#sb-vs.vs-st-shattered.vs-in .vs-name{animation-delay:.82s!important}
#sb-vs.vs-st-shattered.vs-in .vs-sub{animation-delay:.95s!important}#sb-vs.vs-st-shattered.vs-in .vs-rec{animation-delay:1.02s!important}
#sb-vs.vs-st-shattered.vs-in .vs-round{animation:vs-sh-drop .5s .95s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes vs-sh-drop{from{opacity:0;transform:translate(-50%,-40px)}}
#sb-vs.vs-st-shattered.vs-in .vs-ghost{animation:vs-fade 1.2s .5s both}
#sb-vs.vs-st-shattered.vs-clash .vs-flash{animation:vs-flash .34s ease-out}
#sb-vs.vs-st-shattered.vs-broken.vs-clash .vs-flash{animation:vs-sh-flash .32s ease-out}
@keyframes vs-sh-flash{0%{opacity:.38}100%{opacity:0}}
/* exit: the glass breaks (shards are built in script) */
#sb-vs.vs-st-shattered.vs-break>.vs-stage{animation:vs-sh-strain .16s linear both}
@keyframes vs-sh-strain{50%{transform:translate(5px,-3px);filter:brightness(1.6)}100%{transform:translate(-3px,2px);filter:brightness(2.2)}}
#sb-vs.vs-st-shattered.vs-break .vs-sh-crack{opacity:1;stroke:#fff1dd;stroke-width:3}
#sb-vs.vs-st-shattered.vs-broken>.vs-stage{visibility:hidden}
#sb-vs .vs-sh-debris{position:absolute;inset:0;z-index:3;pointer-events:none;perspective:1400px;animation:vs-sh-gone 2.4s forwards}
@keyframes vs-sh-gone{0%,70%{opacity:1}100%{opacity:0}}
#sb-vs .vs-sh-shard{position:absolute;will-change:transform,opacity}
#sb-vs .vs-sh-shard>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#sb-vs .vs-sh-shard .vs-g{fill:url(#vs-sh-glass)}
#sb-vs .vs-sh-in{position:absolute;inset:0;overflow:hidden}
#sb-vs .vs-sh-in>.vs-stage{position:absolute;width:1920px;height:1080px;inset:auto}
#sb-vs .vs-sh-in .vs-bg{display:none}
#sb-vs .vs-sh-shard .vs-e{fill:none;stroke:#ffb36b;stroke-width:2.5;stroke-linejoin:round}
#sb-vs .vs-sh-break{position:absolute;inset:0;width:1920px;height:1080px;z-index:6;pointer-events:none;display:none}
#sb-vs .vs-sh-break path{fill:none;stroke:#fff1dd;stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1}
#sb-vs.vs-break .vs-sh-break{display:block}
#sb-vs.vs-break .vs-sh-break path{animation:vs-sh-draw .15s ease-out forwards;filter:drop-shadow(0 0 6px #ff5a1f)}
#sb-vs.vs-st-shattered.vs-out{animation:none}

/* Porcelain: Ember's splash glazed white. Same slabs, fault line and break; dark lettering, ember-orange fire */
#sb-vs.vs-st-shattered.vs-pc{--ac:#e2430c;--hot:#ff8a3d;--steel:#15171d;--sub:#6c7180}
#sb-vs.vs-st-shattered.vs-pc .vs-bg{background:radial-gradient(ellipse 70% 55% at 50% 108%,rgba(255,90,31,.24),transparent 70%),radial-gradient(ellipse 40% 60% at 50% 50%,rgba(255,140,60,.12),transparent 70%),#dfe1e7}
#sb-vs.vs-st-shattered.vs-pc .vs-face{background:
  radial-gradient(ellipse 30% 60% at 50% 50%,rgba(255,110,40,.1),transparent 70%),
  linear-gradient(158deg,transparent 0 31%,rgba(21,23,29,.05) 31% 31.2%,transparent 31.2% 64%,rgba(21,23,29,.04) 64% 64.15%,transparent 64.15%),
  linear-gradient(24deg,transparent 0 47%,rgba(21,23,29,.04) 47% 47.15%,transparent 47.15%),
  linear-gradient(180deg,#ffffff 0%,#f2f3f6 46%,#d6d9e0 100%)}
#sb-vs.vs-st-shattered.vs-pc .vs-s1 .vs-face{box-shadow:inset -1px 0 0 rgba(226,67,12,.3)}
#sb-vs.vs-st-shattered.vs-pc .vs-face::after{background:linear-gradient(0deg,rgba(255,90,31,.16),transparent)}
#sb-vs.vs-st-shattered.vs-pc .vs-face::before{background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.85) 50%,transparent 70%)}
#sb-vs.vs-st-shattered.vs-pc .vs-ghost{-webkit-text-stroke:2px rgba(21,23,29,.09);background:linear-gradient(180deg,rgba(21,23,29,.06),rgba(21,23,29,0) 75%);-webkit-background-clip:text;background-clip:text}
#sb-vs.vs-st-shattered.vs-pc .vs-plate{background:linear-gradient(0deg,rgba(255,90,31,.18),transparent 60px),linear-gradient(180deg,#ffffff 0%,#f5f6f8 50%,#e2e4ea 100%);box-shadow:inset 0 0 0 1px rgba(226,67,12,.45),inset 0 -3px 0 rgba(21,23,29,.06)}
#sb-vs.vs-st-shattered.vs-pc .vs-plate::before{background:linear-gradient(105deg,transparent 25%,rgba(255,170,110,.16) 50%,transparent 75%)}
#sb-vs.vs-st-shattered.vs-pc .vs-plate::after{background:linear-gradient(90deg,transparent,#ff8a3d,#e2430c,#ff8a3d,transparent);box-shadow:0 0 10px rgba(255,90,31,.6)}
#sb-vs.vs-st-shattered.vs-pc .vs-ava img,#sb-vs.vs-st-shattered.vs-pc .vs-ava .vs-ini{background:linear-gradient(160deg,#ffffff,#e1e3e9)}
#sb-vs.vs-st-shattered.vs-pc .vs-ava .vs-ini{color:#15171d}
#sb-vs.vs-st-shattered.vs-pc .vs-name{background:linear-gradient(180deg,#3a3e4a 0%,#15171d 45%,#000 55%,#2c2f39 100%);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 4px 0 rgba(226,67,12,.2))}
#sb-vs.vs-st-shattered.vs-pc .vs-flag{box-shadow:0 0 0 1px rgba(21,23,29,.25)}
#sb-vs.vs-st-shattered.vs-pc .vs-rec .vs-w,#sb-vs.vs-st-shattered.vs-pc .vs-rec .vs-l{background:linear-gradient(180deg,#24262e,#0b0c10)}
#sb-vs.vs-st-shattered.vs-pc .vs-rec small{color:#4a4e5a}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-ball{background:radial-gradient(circle,rgba(255,120,40,.32),rgba(255,90,31,.08) 40%,transparent 68%)}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-embers i{background:radial-gradient(circle,#ffb36b 0,#ff5a1f 32%,rgba(226,67,12,.45) 55%,transparent 72%)}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-glow{stroke:#ff5a1f;opacity:.14}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-glow2{stroke:#ff6a2a;opacity:.32}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-line{stroke:#e2430c}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-core{stroke:#ffd2a8}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-crack{stroke:#e2430c;opacity:.75}
#sb-vs.vs-st-shattered.vs-pc .vs-sh-crack.vs-far{opacity:.4}
#sb-vs.vs-st-shattered.vs-pc .vs-mark span{background:linear-gradient(180deg,#3a3e4a 0%,#15171d 38%,#000 47%,#ff8a3d 58%,#e2430c 78%,#a3180a 100%);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 2px rgba(255,255,255,.9))}
#sb-vs.vs-st-shattered.vs-pc .vs-g1{text-shadow:0 0 26px rgba(255,90,31,.7),0 0 64px rgba(255,140,60,.45);background:radial-gradient(closest-side,rgba(255,120,45,.22),rgba(255,120,45,.09) 40%,rgba(255,120,45,.03) 72%,rgba(255,120,45,0))}
#sb-vs.vs-st-shattered.vs-pc .vs-round{color:#15171d;background:linear-gradient(180deg,#ffffff,#e3e5ea);box-shadow:inset 0 2px 0 #ff5a1f,inset 0 0 0 1px rgba(226,67,12,.35)}
#sb-vs.vs-st-shattered.vs-pc .vs-flash{background:radial-gradient(circle at 50% 50%,#fff,rgba(255,190,140,.8) 24%,rgba(255,90,31,.35) 48%,transparent 68%)}
#sb-vs.vs-pc .vs-sh-wave{border-color:#ff7a2a;box-shadow:0 0 18px rgba(255,90,31,.55),inset 0 0 14px rgba(255,90,31,.45)}
#sb-vs.vs-st-shattered.vs-pc.vs-break .vs-sh-crack{stroke:#e2430c}
#sb-vs.vs-pc .vs-sh-break path{stroke:#e2430c}
#sb-vs.vs-pc .vs-sh-shard .vs-e{stroke:#ff7a2a}
@keyframes vs-pc-in1{0%{transform:translateX(-70%);filter:brightness(.6) saturate(0);animation-timing-function:cubic-bezier(.6,0,1,.6)}
  42%{transform:translateX(0);filter:brightness(1.15) saturate(.4);animation-timing-function:ease-out}48%{transform:translateX(-14px)}100%{transform:none;filter:none}}
@keyframes vs-pc-in2{0%{transform:translateX(70%);filter:brightness(.6) saturate(0);animation-timing-function:cubic-bezier(.6,0,1,.6)}
  42%{transform:translateX(0);filter:brightness(1.15) saturate(.4);animation-timing-function:ease-out}48%{transform:translateX(14px)}100%{transform:none;filter:none}}
#sb-vs.vs-st-shattered.vs-pc.vs-in .vs-s1{animation-name:vs-pc-in1}
#sb-vs.vs-st-shattered.vs-pc.vs-in .vs-s2{animation-name:vs-pc-in2}
@keyframes vs-pc-ignite{from{opacity:0;transform:translateY(70px)}50%{opacity:1;transform:none;filter:saturate(1.6)}to{filter:none}}
#sb-vs.vs-st-shattered.vs-pc.vs-in .vs-plate{animation-name:vs-pc-ignite}

/* Iron: steel & gold plates drop and slam */
#sb-vs.vs-st-iron{--c1:#b8142c;--c2:#1f4fbf;--ac:#ffcf6b;--fn:'Saira Condensed',sans-serif;--fu:'Chakra Petch',sans-serif;--fv:'Saira Condensed',sans-serif}
#sb-vs.vs-st-iron .vs-bg{background:linear-gradient(180deg,#2a2d33,#0e0f12)}
#sb-vs.vs-st-iron .vs-face::after{content:'';position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,#8a6a2a,#ffcf6b,#8a6a2a)}
#sb-vs.vs-st-iron .vs-name{font-style:italic;font-weight:800;text-transform:uppercase}
#sb-vs.vs-st-iron .vs-ava{border-radius:4px;box-shadow:0 0 0 4px #ffcf6b,0 0 0 7px #111}
#sb-vs.vs-st-iron .vs-mark span{font-style:italic;font-weight:800;font-size:150px;background:linear-gradient(180deg,#fff,#ffcf6b 55%,#8a6a2a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 0 #000)}
#sb-vs.vs-st-iron.vs-in .vs-s1{animation:vs-drop .5s cubic-bezier(.5,0,.5,1.6) both}
#sb-vs.vs-st-iron.vs-in .vs-s2{animation:vs-drop .5s .12s cubic-bezier(.5,0,.5,1.6) both}
@keyframes vs-drop{from{transform:translateY(-110%)}}

/* Devil: out of the dark with violet lightning */
#sb-vs.vs-st-devil{--c1:#5a1aa8;--c2:#3a0d6e;--ac:#d6b8ff;--fn:'Saira Condensed',sans-serif;--fu:'Chakra Petch',sans-serif;--fv:'Noto Serif JP',serif}
#sb-vs.vs-st-devil .vs-bg{background:radial-gradient(ellipse at 50% 50%,#2a0d52,#07040d 70%)}
#sb-vs.vs-st-devil .vs-s1 .vs-face,#sb-vs.vs-st-devil .vs-s2 .vs-face{background:linear-gradient(180deg,rgba(40,12,80,.9),rgba(8,4,16,.95))}
#sb-vs.vs-st-devil .vs-name{text-transform:uppercase;font-weight:800;text-shadow:0 0 18px #8a3cff}
#sb-vs.vs-st-devil .vs-ava{border-radius:50%;box-shadow:0 0 0 3px #d6b8ff,0 0 30px #8a3cff}
#sb-vs.vs-st-devil .vs-mark span{font-weight:900;font-size:120px;color:#f2e8ff;text-shadow:0 0 20px #8a3cff,0 0 50px #6d26e6}
#sb-vs.vs-st-devil.vs-in .vs-s1,#sb-vs.vs-st-devil.vs-in .vs-s2{animation:vs-flicker .8s steps(1) both}
@keyframes vs-flicker{0%{opacity:0}10%{opacity:1;filter:brightness(2.5)}18%{opacity:0}30%{opacity:1}38%{opacity:.3}50%,100%{opacity:1;filter:none}}

/* Dojo: ink brush reveal on paper, 対 seal */
#sb-vs.vs-st-dojo{--c1:#141414;--c2:#141414;--ac:#c30a24;--ink:#141414;--sub:#4a4a4a;--fn:'Saira Condensed',sans-serif;--fu:'Chakra Petch',sans-serif;--fv:'Noto Serif JP',serif}
#sb-vs.vs-st-dojo .vs-bg{background:linear-gradient(180deg,#efe9dd,#e2dac9)}
#sb-vs.vs-st-dojo .vs-s1 .vs-face,#sb-vs.vs-st-dojo .vs-s2 .vs-face{background:linear-gradient(180deg,#f4efe4,#e6dfcf)}
#sb-vs.vs-st-dojo .vs-name{text-transform:uppercase;font-weight:800;text-shadow:none}
#sb-vs.vs-st-dojo .vs-team{color:#c30a24}
#sb-vs.vs-st-dojo .vs-rec{color:#141414}#sb-vs.vs-st-dojo .vs-rec .vs-w .vs-n{color:#1a7a3a}#sb-vs.vs-st-dojo .vs-rec .vs-l .vs-n{color:#c30a24}
#sb-vs.vs-st-dojo .vs-ava{border-radius:2px;box-shadow:0 0 0 3px #141414,6px 6px 0 #c30a24}
#sb-vs.vs-st-dojo .vs-mark{width:190px;height:190px;border-radius:50%;background:#c30a24;box-shadow:0 0 0 6px #efe9dd,0 0 0 9px #141414}
#sb-vs.vs-st-dojo .vs-mark span{font-weight:900;font-size:120px;color:#fff;text-shadow:none}
#sb-vs.vs-st-dojo .vs-round{background:#141414;color:#efe9dd;top:120px}
#sb-vs.vs-st-dojo.vs-in .vs-s1{animation:vs-brush-l .7s cubic-bezier(.6,0,.2,1) both}#sb-vs.vs-st-dojo.vs-in .vs-s2{animation:vs-brush-r .7s .1s cubic-bezier(.6,0,.2,1) both}
@keyframes vs-brush-l{from{clip-path:polygon(0 0,0 0,0 100%,0 100%)}}
@keyframes vs-brush-r{from{clip-path:polygon(100% 0,100% 0,100% 100%,100% 100%)}}

/* Street Fighter 6 — Drive: graffiti paint, skewed slams */
#sb-vs.vs-st-drive{--c1:#ff2d95;--c2:#18c8ff;--ac:#ffe600;--fn:'Anton',Impact,sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Anton',Impact,sans-serif}
#sb-vs.vs-st-drive .vs-bg{background:linear-gradient(180deg,#14121c,#0a0910)}
#sb-vs.vs-st-drive .vs-face::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(255,230,0,.35) 0 40px,transparent 41px),radial-gradient(circle at 70% 75%,rgba(255,255,255,.18) 0 26px,transparent 27px),radial-gradient(circle at 45% 15%,rgba(0,0,0,.25) 0 60px,transparent 61px)}
#sb-vs.vs-st-drive .vs-name{text-transform:uppercase;letter-spacing:1px;transform:skewX(-8deg)}
#sb-vs.vs-st-drive .vs-ava{transform:rotate(-3deg);border-radius:6px;box-shadow:0 0 0 5px #ffe600,8px 8px 0 #000}
#sb-vs.vs-st-drive .vs-s2 .vs-ava{transform:rotate(3deg)}
#sb-vs.vs-st-drive .vs-mark span{font-size:160px;color:#ffe600;transform:skewX(-10deg) rotate(-6deg);text-shadow:8px 8px 0 #ff2d95,-5px -5px 0 #18c8ff}
#sb-vs.vs-st-drive.vs-in .vs-s1{animation:vs-skew-l .45s cubic-bezier(.2,.9,.3,1.2) both}#sb-vs.vs-st-drive.vs-in .vs-s2{animation:vs-skew-r .45s .08s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes vs-skew-l{from{transform:translateX(-105%) skewX(-20deg)}}
@keyframes vs-skew-r{from{transform:translateX(105%) skewX(-20deg)}}

/* Smash Ultimate — diagonal split, zoom-in, rainbow ring */
#sb-vs.vs-st-smash{--c1:#e2142d;--c2:#1f6fe0;--ac:#ffde3b;--fn:'Rubik',sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Rubik',sans-serif}
#sb-vs.vs-st-smash .vs-bg{background:radial-gradient(ellipse at 50% 50%,#2a2a35,#0a0a0f 70%)}
#sb-vs.vs-st-smash .vs-name{font-style:italic;font-weight:900;text-transform:uppercase}
#sb-vs.vs-st-smash .vs-ava{border-radius:50%;box-shadow:0 0 0 5px #fff,0 0 0 9px rgba(0,0,0,.35)}
#sb-vs.vs-st-smash .vs-mark{width:200px;height:200px;border-radius:50%;background:conic-gradient(#ff3b3b,#ffb000,#ffe600,#36e070,#3bb0ff,#a45bff,#ff3b3b);padding:10px}
#sb-vs.vs-st-smash .vs-mark::after{content:'';position:absolute;inset:10px;border-radius:50%;background:#111}
#sb-vs.vs-st-smash .vs-mark span{position:relative;z-index:1;font-style:italic;font-weight:900;font-size:110px;color:#fff;text-shadow:0 0 18px #ffde3b}
#sb-vs.vs-st-smash.vs-in .vs-mark{animation:vs-spin .7s .4s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes vs-spin{from{opacity:0;transform:translate(-50%,-56%) scale(.2) rotate(-200deg)}}
#sb-vs.vs-st-smash.vs-in .vs-s1,#sb-vs.vs-st-smash.vs-in .vs-s2{animation:vs-zoom .5s cubic-bezier(.2,.9,.3,1) both}
@keyframes vs-zoom{from{transform:scale(1.5);opacity:0;filter:blur(10px)}}

/* Rivals of Aether II — rising elemental shimmer, crystal mark */
#sb-vs.vs-st-aether{--c1:#ff6b3d;--c2:#3fb6ff;--ac:#b98bff;--fn:'Exo 2',sans-serif;--fu:'Exo 2',sans-serif;--fv:'Exo 2',sans-serif}
#sb-vs.vs-st-aether .vs-bg{background:linear-gradient(180deg,#1a1430,#0b0a18)}
#sb-vs.vs-st-aether .vs-name{font-style:italic;font-weight:800}
#sb-vs.vs-st-aether .vs-ava{border-radius:24px;box-shadow:0 0 0 3px #fff,0 0 24px var(--ac)}
#sb-vs.vs-st-aether .vs-mark{width:170px;height:170px;background:linear-gradient(135deg,#e3d1ff,#b98bff 45%,#3fb6ff);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
#sb-vs.vs-st-aether .vs-mark span{font-style:italic;font-weight:800;font-size:80px;color:#1a1430}
#sb-vs.vs-st-aether.vs-in .vs-s1,#sb-vs.vs-st-aether.vs-in .vs-s2{animation:vs-rise .6s cubic-bezier(.2,.9,.3,1) both}
@keyframes vs-rise{from{transform:translateY(100%);opacity:0}}

/* Avatar Legends — parchment unrolls from the centre, red seal stamp */
#sb-vs.vs-st-scroll{--c1:#7a2a12;--c2:#1d4a6e;--ac:#8a5a1a;--ink:#1d1712;--sub:#5a4a38;--fn:'Cinzel',serif;--fu:'Cormorant Garamond',serif;--fv:'Cinzel',serif}
#sb-vs.vs-st-scroll .vs-bg{background:linear-gradient(180deg,#efe2c2,#e2cfa3);box-shadow:inset 0 0 60px rgba(120,80,30,.45)}
#sb-vs.vs-st-scroll .vs-s1 .vs-face,#sb-vs.vs-st-scroll .vs-s2 .vs-face{background:none}
#sb-vs.vs-st-scroll .vs-name{font-weight:900;text-shadow:none}
#sb-vs.vs-st-scroll .vs-team{font-style:italic;letter-spacing:1px;text-transform:none;font-size:28px}
#sb-vs.vs-st-scroll .vs-sub{font-style:italic;text-transform:none}
#sb-vs.vs-st-scroll .vs-rec{color:#1d1712}#sb-vs.vs-st-scroll .vs-rec .vs-w .vs-n{color:#2f6b2a}#sb-vs.vs-st-scroll .vs-rec .vs-l .vs-n{color:#9a1f12}
#sb-vs.vs-st-scroll .vs-ava{border-radius:50%;box-shadow:0 0 0 3px #8a5a1a,0 0 0 8px #efe2c2,0 0 0 10px #8a5a1a}
#sb-vs.vs-st-scroll .vs-mark{width:170px;height:170px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#d4372a,#9a1f12);box-shadow:0 0 0 4px rgba(154,31,18,.5)}
#sb-vs.vs-st-scroll .vs-mark span{font-weight:900;font-size:80px;color:#efe2c2}
#sb-vs.vs-st-scroll .vs-round{background:#1d1712;color:#efe2c2}
#sb-vs.vs-st-scroll.vs-in{animation:vs-unroll .8s cubic-bezier(.6,0,.2,1) both}
@keyframes vs-unroll{from{clip-path:inset(0 50% 0 50%)}to{clip-path:inset(0 0 0 0)}}
#sb-vs.vs-st-scroll.vs-in .vs-s1,#sb-vs.vs-st-scroll.vs-in .vs-s2{animation:vs-fade .5s .5s both}
#sb-vs.vs-st-scroll.vs-in .vs-mark{animation:vs-stamp .35s .85s cubic-bezier(.5,0,.5,1.5) both}
@keyframes vs-stamp{from{opacity:0;transform:translate(-50%,-56%) scale(2.4) rotate(-20deg)}}
#sb-vs.vs-st-scroll.vs-out{animation:vs-roll .55s ease-in forwards}
@keyframes vs-roll{to{clip-path:inset(0 50% 0 50%)}}

/* MARVEL Tōkon — comic panels slam in, starburst VS! */
#sb-vs.vs-st-comic{--c1:#e8202a;--c2:#1f6fe0;--ac:#ffd400;--fn:'Bangers',Impact,sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Bangers',Impact,sans-serif}
#sb-vs.vs-st-comic .vs-bg{background:radial-gradient(circle,#0a0a0a 1.5px,transparent 2px) 0 0/12px 12px,#f2ead8}
#sb-vs.vs-st-comic .vs-face{border:6px solid #0a0a0a}
#sb-vs.vs-st-comic .vs-s1 .vs-face{background:radial-gradient(circle,rgba(0,0,0,.25) 1.5px,transparent 2px) 0 0/10px 10px,#e8202a}
#sb-vs.vs-st-comic .vs-s2 .vs-face{background:radial-gradient(circle,rgba(0,0,0,.25) 1.5px,transparent 2px) 0 0/10px 10px,#1f6fe0}
#sb-vs.vs-st-comic .vs-name{letter-spacing:2px;-webkit-text-stroke:3px #0a0a0a;paint-order:stroke fill;text-shadow:5px 5px 0 #0a0a0a;font-size:80px}
#sb-vs.vs-st-comic .vs-ava{border-radius:0;box-shadow:0 0 0 6px #0a0a0a,10px 10px 0 #0a0a0a}
#sb-vs.vs-st-comic .vs-mark{width:260px;height:230px;background:#ffd400;clip-path:polygon(50% 0,61% 22%,85% 8%,78% 34%,100% 42%,80% 58%,94% 82%,68% 76%,58% 100%,45% 80%,22% 95%,25% 70%,0 62%,20% 47%,5% 22%,32% 26%);filter:drop-shadow(0 0 0 #000)}
#sb-vs.vs-st-comic .vs-mark span{font-size:120px;color:#e8202a;-webkit-text-stroke:4px #0a0a0a;paint-order:stroke fill;transform:rotate(-8deg)}
#sb-vs.vs-st-comic.vs-in .vs-s1{animation:vs-slam-l .4s cubic-bezier(.2,.9,.3,1.3) both}#sb-vs.vs-st-comic.vs-in .vs-s2{animation:vs-slam-r .4s .1s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes vs-slam-l{from{transform:translateX(-80%) rotate(-6deg)}}
@keyframes vs-slam-r{from{transform:translateX(80%) rotate(6deg)}}
#sb-vs.vs-st-comic.vs-in .vs-mark{animation:vs-pow .4s .45s cubic-bezier(.2,.9,.3,1.6) both}
@keyframes vs-pow{from{opacity:0;transform:translate(-50%,-56%) scale(.1) rotate(40deg)}}

/* Guilty Gear -Strive- — a red slash cuts the screen open */
#sb-vs.vs-st-slash{--c1:#e0102a;--c2:#e0102a;--ac:#e0102a;--fn:'Bebas Neue',Impact,sans-serif;--fu:'Oswald',sans-serif;--fv:'Bebas Neue',Impact,sans-serif}
#sb-vs.vs-st-slash .vs-bg{background:repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 2px,transparent 2px 9px),#0a0a0a}
#sb-vs.vs-st-slash .vs-s1 .vs-face,#sb-vs.vs-st-slash .vs-s2 .vs-face{background:linear-gradient(180deg,#2b2b30,#0a0a0a)}
#sb-vs.vs-st-slash .vs-face::after{content:'';position:absolute;left:0;right:0;bottom:0;height:5px;background:#e0102a;box-shadow:0 0 14px #e0102a}
#sb-vs.vs-st-slash .vs-name{font-size:90px;letter-spacing:3px;transform:skewX(-8deg)}
#sb-vs.vs-st-slash .vs-ava{border-radius:0;clip-path:polygon(12% 0,100% 0,88% 100%,0 100%);box-shadow:none}
#sb-vs.vs-st-slash .vs-mark span{font-size:170px;color:#f2f2f2;text-shadow:6px 6px 0 #e0102a}
#sb-vs.vs-st-slash .vs-cut{position:absolute;left:-10%;top:50%;width:120%;height:10px;background:linear-gradient(90deg,transparent,#e0102a 15%,#fff 50%,#e0102a 85%,transparent);box-shadow:0 0 24px #e0102a;transform:rotate(-8deg);opacity:0;z-index:6}
#sb-vs.vs-st-slash.vs-in .vs-cut{animation:vs-cut .35s cubic-bezier(.6,0,.3,1) forwards}
@keyframes vs-cut{0%{opacity:1;clip-path:inset(0 100% 0 0)}60%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:0;clip-path:inset(0 0 0 100%)}}
#sb-vs.vs-st-slash.vs-in .vs-s1{animation:vs-open-t .45s .25s cubic-bezier(.2,.9,.3,1) both}#sb-vs.vs-st-slash.vs-in .vs-s2{animation:vs-open-b .45s .25s cubic-bezier(.2,.9,.3,1) both}
@keyframes vs-open-t{from{transform:translateY(50%);opacity:0}}
@keyframes vs-open-b{from{transform:translateY(-50%);opacity:0}}

/* Mortal Kombat 1 — stone slabs drop with dust, gold medallion */
#sb-vs.vs-st-stone{--c1:#a3121b;--c2:#b0812f;--ac:#f2c14e;--fn:'Cinzel',serif;--fu:'Barlow Condensed',sans-serif;--fv:'Cinzel',serif}
#sb-vs.vs-st-stone .vs-bg{background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.07),transparent 60%),linear-gradient(180deg,#2c2a25,#121110)}
#sb-vs.vs-st-stone .vs-s1 .vs-face,#sb-vs.vs-st-stone .vs-s2 .vs-face{background:linear-gradient(180deg,#2c2a25,#1b1a17);box-shadow:inset 0 0 0 2px rgba(242,193,78,.5)}
#sb-vs.vs-st-stone .vs-name{font-weight:900;background:linear-gradient(180deg,#fff3cf,#f2c14e 55%,#b0812f);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 3px 0 #000)}
#sb-vs.vs-st-stone .vs-ava{border-radius:50%;box-shadow:0 0 0 3px #f2c14e,0 0 0 8px #0d0c0a,0 0 0 10px #b0812f}
#sb-vs.vs-st-stone .vs-mark{width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a362e,#0d0c0a 70%);box-shadow:0 0 0 4px #f2c14e,0 0 0 10px #0d0c0a,0 0 0 12px #b0812f,0 0 40px rgba(255,106,26,.6)}
#sb-vs.vs-st-stone .vs-mark span{font-weight:900;font-size:76px;color:#f2c14e}
#sb-vs.vs-st-stone.vs-in .vs-s1,#sb-vs.vs-st-stone.vs-in .vs-s2{animation:vs-slab .55s cubic-bezier(.6,0,.4,1.4) both}#sb-vs.vs-st-stone.vs-in .vs-s2{animation-delay:.1s}
@keyframes vs-slab{from{transform:translateY(-100%)}}

/* Fatal Fury: City of the Wolves — neon sign flickers on */
#sb-vs.vs-st-street{--c1:#ffcc33;--c2:#2aa8ff;--ac:#ffcc33;--fn:'Russo One',sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Russo One',sans-serif}
#sb-vs.vs-st-street .vs-bg{background:linear-gradient(180deg,#141416,#050505)}
#sb-vs.vs-st-street .vs-s1 .vs-face,#sb-vs.vs-st-street .vs-s2 .vs-face{background:linear-gradient(180deg,#1d1d1f,#0b0b0b);box-shadow:inset 0 -3px 0 #ffcc33}
#sb-vs.vs-st-street .vs-ava{border-radius:4px;box-shadow:0 0 0 3px #ffcc33,0 0 22px rgba(255,204,51,.6)}
#sb-vs.vs-st-street .vs-mark span{font-size:130px;color:#fff;text-shadow:0 0 10px #2aa8ff,0 0 30px #2aa8ff,0 0 60px #2aa8ff;font-style:italic}
#sb-vs.vs-st-street.vs-in .vs-s1,#sb-vs.vs-st-street.vs-in .vs-s2{animation:vs-neon .9s steps(1) both}#sb-vs.vs-st-street.vs-in .vs-s2{animation-delay:.15s}
@keyframes vs-neon{0%{opacity:0}12%{opacity:1}20%{opacity:.1}28%{opacity:1}36%{opacity:.3}44%,100%{opacity:1}}

/* 2XKO — glitch in, chromatic VS */
#sb-vs.vs-st-glitch{--c1:#19f0ff;--c2:#ff2bd6;--ac:#19f0ff;--fn:'Chakra Petch',sans-serif;--fu:'Rajdhani',sans-serif;--fv:'Chakra Petch',sans-serif}
#sb-vs.vs-st-glitch .vs-bg{background:linear-gradient(0deg,rgba(25,240,255,.05) 1px,transparent 1px) 0 0/100% 6px,#0d0f1a}
#sb-vs.vs-st-glitch .vs-s1 .vs-face,#sb-vs.vs-st-glitch .vs-s2 .vs-face{background:linear-gradient(180deg,#171a2b,#0d0f1a)}
#sb-vs.vs-st-glitch .vs-s1 .vs-face{box-shadow:inset 0 -4px 0 #19f0ff}#sb-vs.vs-st-glitch .vs-s2 .vs-face{box-shadow:inset 0 -4px 0 #ff2bd6}
#sb-vs.vs-st-glitch .vs-name{text-transform:uppercase;text-shadow:-3px 0 #ff2bd6,3px 0 #19f0ff}
#sb-vs.vs-st-glitch .vs-ava{border-radius:0;clip-path:polygon(14% 0,100% 0,100% 86%,86% 100%,0 100%,0 14%);box-shadow:none}
#sb-vs.vs-st-glitch .vs-mark span{font-size:140px;color:#fff;text-shadow:-6px 0 #ff2bd6,6px 0 #19f0ff}
#sb-vs.vs-st-glitch.vs-in .vs-s1,#sb-vs.vs-st-glitch.vs-in .vs-s2{animation:vs-glitch .6s steps(1) both}
@keyframes vs-glitch{0%{opacity:1;clip-path:inset(40% 0 45% 0);transform:translateX(-30px)}15%{clip-path:inset(10% 0 70% 0);transform:translateX(24px)}30%{clip-path:inset(60% 0 8% 0);transform:translateX(-12px)}45%{clip-path:inset(0);transform:none;filter:hue-rotate(90deg)}60%,100%{filter:none}}

/* Granblue Fantasy Versus: Rising — bright sky, floating in, gold crest */
#sb-vs.vs-st-sky{--c1:#4fb6ff;--c2:#e8c66a;--ac:#3a74a8;--ink:#10223f;--sub:#4f6a88;--fn:'Marcellus',serif;--fu:'Barlow Condensed',sans-serif;--fv:'Marcellus',serif}
#sb-vs.vs-st-sky .vs-bg{background:linear-gradient(180deg,#bfe3ff,#fdfbf3)}
#sb-vs.vs-st-sky .vs-s1 .vs-face,#sb-vs.vs-st-sky .vs-s2 .vs-face{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(217,236,251,.9));box-shadow:inset 0 -3px 0 #e8c66a}
#sb-vs.vs-st-sky .vs-name{text-shadow:none}
#sb-vs.vs-st-sky .vs-rec{color:#10223f}#sb-vs.vs-st-sky .vs-rec .vs-w .vs-n{color:#2b8a4a}#sb-vs.vs-st-sky .vs-rec .vs-l .vs-n{color:#b3322a}
#sb-vs.vs-st-sky .vs-ava{border-radius:50%;box-shadow:0 0 0 4px #e8c66a,0 0 0 8px #fff,0 6px 20px rgba(16,34,63,.35)}
#sb-vs.vs-st-sky .vs-mark{width:170px;height:190px;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%);background:linear-gradient(180deg,#1c3a66,#10223f);box-shadow:inset 0 0 0 4px #e8c66a}
#sb-vs.vs-st-sky .vs-mark span{font-size:84px;color:#e8c66a;margin-top:-20px}
#sb-vs.vs-st-sky .vs-round{background:#10223f;color:#fdfbf3}
#sb-vs.vs-st-sky.vs-in .vs-s1,#sb-vs.vs-st-sky.vs-in .vs-s2{animation:vs-float .9s cubic-bezier(.2,.8,.2,1) both}#sb-vs.vs-st-sky.vs-in .vs-s2{animation-delay:.12s}
@keyframes vs-float{from{transform:translateY(-40px);opacity:0}}

/* Dragon Ball FighterZ — impact zoom, speed lines, power orb */
#sb-vs.vs-st-ki{--c1:#ff8a00;--c2:#1e6bff;--ac:#ffd400;--fn:'Bangers',Impact,sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Bangers',Impact,sans-serif}
#sb-vs.vs-st-ki .vs-bg{background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.12) 0 2deg,transparent 2deg 9deg),radial-gradient(circle at 50% 50%,#ffd400,#ff8a00 30%,#3a1200 75%)}
#sb-vs.vs-st-ki .vs-name{font-size:84px;letter-spacing:2px;-webkit-text-stroke:3px #101010;paint-order:stroke fill}
#sb-vs.vs-st-ki .vs-ava{border-radius:50%;box-shadow:0 0 0 5px #101010,0 0 0 9px #fff}
#sb-vs.vs-st-ki .vs-mark{width:190px;height:190px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff1b0,#ff8a00 50%,#b84200);box-shadow:0 0 0 5px #101010,0 0 50px #ffd400}
#sb-vs.vs-st-ki .vs-mark span{font-size:110px;color:#fff;-webkit-text-stroke:4px #101010;paint-order:stroke fill}
#sb-vs.vs-st-ki.vs-in .vs-s1,#sb-vs.vs-st-ki.vs-in .vs-s2{animation:vs-punch .45s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes vs-punch{from{transform:scale(1.8);opacity:0}}
#sb-vs.vs-st-ki.vs-in .vs-bg{animation:vs-spin-bg 1.2s ease-out both}
@keyframes vs-spin-bg{from{filter:brightness(3);transform:scale(1.5)}}

/* Under Night In-Birth II — emerges from the night, crescent moon */
#sb-vs.vs-st-night{--c1:#8a5cff;--c2:#ff3d6e;--ac:#c9b6ff;--ink:#d8dcef;--fn:'Oxanium',sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Oxanium',sans-serif}
#sb-vs.vs-st-night .vs-bg{background:radial-gradient(1px 1px at 12% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 32% 70%,#cfd3ff,transparent),radial-gradient(1px 1px at 64% 22%,#fff,transparent),radial-gradient(1.5px 1.5px at 84% 64%,#cfd3ff,transparent),radial-gradient(1px 1px at 48% 88%,#fff,transparent),linear-gradient(180deg,#1a1640,#0b0a1e)}
#sb-vs.vs-st-night .vs-s1 .vs-face,#sb-vs.vs-st-night .vs-s2 .vs-face{background:linear-gradient(180deg,rgba(26,22,64,.6),rgba(11,10,30,.85));box-shadow:inset 0 -1px 0 #d8dcef}
#sb-vs.vs-st-night .vs-ava{border-radius:50%;box-shadow:0 0 0 2px #d8dcef,0 0 28px rgba(138,92,255,.7)}
#sb-vs.vs-st-night .vs-mark{width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#fffdf0,#fff6d6 60%,#d9cf9e);box-shadow:inset -40px -18px 0 rgba(11,10,30,.75),0 0 40px rgba(255,246,214,.45)}
#sb-vs.vs-st-night .vs-mark span{font-size:80px;color:#0b0a1e;font-weight:800;margin-left:-30px}
#sb-vs.vs-st-night.vs-in .vs-s1,#sb-vs.vs-st-night.vs-in .vs-s2{animation:vs-blur 1s ease-out both}
@keyframes vs-blur{from{filter:blur(16px);opacity:0}}

/* Virtua Fighter 5 R.E.V.O. — broadcast wipe */
#sb-vs.vs-st-broadcast{--c1:#0f1e3d;--c2:#0f1e3d;--ac:#e3122d;--ink:#0f1e3d;--sub:#6b7891;--fn:'Rajdhani',sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Rajdhani',sans-serif}
#sb-vs.vs-st-broadcast .vs-bg{background:linear-gradient(180deg,#ffffff,#e9edf3)}
#sb-vs.vs-st-broadcast .vs-s1 .vs-face,#sb-vs.vs-st-broadcast .vs-s2 .vs-face{background:linear-gradient(180deg,#ffffff,#e9edf3)}
#sb-vs.vs-st-broadcast .vs-s1 .vs-face{box-shadow:inset -10px 0 0 #e3122d}#sb-vs.vs-st-broadcast .vs-s2 .vs-face{box-shadow:inset 10px 0 0 #e3122d}
#sb-vs.vs-st-broadcast .vs-name{text-transform:uppercase;text-shadow:none}
#sb-vs.vs-st-broadcast .vs-rec{color:#0f1e3d}#sb-vs.vs-st-broadcast .vs-rec .vs-w .vs-n{color:#1a7a3a}#sb-vs.vs-st-broadcast .vs-rec .vs-l .vs-n{color:#e3122d}
#sb-vs.vs-st-broadcast .vs-ava{border-radius:0;box-shadow:0 0 0 3px #0f1e3d}
#sb-vs.vs-st-broadcast .vs-mark{width:150px;height:110px;background:#0f1e3d}
#sb-vs.vs-st-broadcast .vs-mark span{font-size:84px;color:#fff;font-style:italic}
#sb-vs.vs-st-broadcast .vs-round{background:#e3122d;color:#fff}
#sb-vs.vs-st-broadcast.vs-in{animation:vs-wipe .55s cubic-bezier(.7,0,.2,1) both}
@keyframes vs-wipe{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0)}}
#sb-vs.vs-st-broadcast.vs-in .vs-s1,#sb-vs.vs-st-broadcast.vs-in .vs-s2{animation:none}
#sb-vs.vs-st-broadcast.vs-out{animation:vs-wipe-out .45s cubic-bezier(.7,0,.2,1) forwards}
@keyframes vs-wipe-out{to{clip-path:inset(0 100% 0 0)}}

/* King of Fighters XV — arcade boot blink, pixel VS */
#sb-vs.vs-st-arcade{--c1:#e8102d;--c2:#1d4fff;--ac:#ffd200;--fn:'Bebas Neue',Impact,sans-serif;--fu:'Bebas Neue',Impact,sans-serif;--fv:'Press Start 2P',monospace}
#sb-vs.vs-st-arcade .vs-bg{background:repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 3px),#050505}
#sb-vs.vs-st-arcade .vs-s1 .vs-face{background:#050505;box-shadow:inset 0 0 0 6px #e8102d}#sb-vs.vs-st-arcade .vs-s2 .vs-face{background:#050505;box-shadow:inset 0 0 0 6px #1d4fff}
#sb-vs.vs-st-arcade .vs-name{font-size:84px;letter-spacing:3px;text-shadow:5px 5px 0 var(--c1)}
#sb-vs.vs-st-arcade .vs-s2 .vs-name{text-shadow:5px 5px 0 var(--c2)}
#sb-vs.vs-st-arcade .vs-ava{border-radius:0;image-rendering:pixelated;box-shadow:0 0 0 4px #ffd200,6px 6px 0 4px #000}
#sb-vs.vs-st-arcade .vs-mark span{font-size:72px;color:#ffd200;text-shadow:6px 6px 0 #e8102d,12px 12px 0 #000;letter-spacing:0}
#sb-vs.vs-st-arcade.vs-in .vs-s1,#sb-vs.vs-st-arcade.vs-in .vs-s2,#sb-vs.vs-st-arcade.vs-in .vs-mark{animation:vs-boot .7s steps(1) both}
@keyframes vs-boot{0%{opacity:0}15%{opacity:1}30%{opacity:0}45%{opacity:1}60%{opacity:0}75%,100%{opacity:1}}
#sb-vs.vs-st-arcade.vs-in .vs-mark{animation-delay:.3s}

/* Marvel vs. Capcom 2 — chrome flips in, lightning VS */
#sb-vs.vs-st-chrome{--c1:#5b2bd6;--c2:#1fa0ff;--ac:#ffe14d;--ink:#120a2e;--sub:#4a4566;--fn:'Bungee',Impact,sans-serif;--fu:'Barlow Condensed',sans-serif;--fv:'Bungee',Impact,sans-serif}
#sb-vs.vs-st-chrome .vs-bg{background:linear-gradient(135deg,#2a1268,#120a2e 60%,#0a4a8a)}
#sb-vs.vs-st-chrome .vs-s1 .vs-face,#sb-vs.vs-st-chrome .vs-s2 .vs-face{background:linear-gradient(180deg,#ffffff 0%,#d9dde8 30%,#8d93a8 50%,#e9ecf4 52%,#b8bdcc 100%)}
#sb-vs.vs-st-chrome .vs-s1 .vs-face{box-shadow:inset 0 0 0 5px #5b2bd6}#sb-vs.vs-st-chrome .vs-s2 .vs-face{box-shadow:inset 0 0 0 5px #1fa0ff}
#sb-vs.vs-st-chrome .vs-team{color:#5b2bd6}
#sb-vs.vs-st-chrome .vs-name{font-size:62px;text-shadow:3px 3px 0 rgba(91,43,214,.4)}
#sb-vs.vs-st-chrome .vs-rec{color:#120a2e}#sb-vs.vs-st-chrome .vs-rec .vs-w .vs-n{color:#1a7a3a}#sb-vs.vs-st-chrome .vs-rec .vs-l .vs-n{color:#c0152a}
#sb-vs.vs-st-chrome .vs-ava{border-radius:50%;box-shadow:0 0 0 4px #120a2e,0 0 0 8px #ffe14d}
#sb-vs.vs-st-chrome .vs-mark span{font-size:130px;background:linear-gradient(180deg,#ffffff 0%,#dfe3ee 42%,#7c80a0 50%,#f4f6fb 54%,#a9aec2);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 2px #120a2e) drop-shadow(0 0 16px #ffe14d)}
#sb-vs.vs-st-chrome.vs-in .vs-s1,#sb-vs.vs-st-chrome.vs-in .vs-s2{animation:vs-flip .7s cubic-bezier(.2,.9,.3,1.3) both}#sb-vs.vs-st-chrome.vs-in .vs-s2{animation-delay:.1s}
@keyframes vs-flip{from{transform:perspective(800px) rotateX(90deg);transform-origin:top}}
`;
  const st = document.createElement('style'); st.id = 'sb-vs-style'; st.textContent = CSS;
  document.head.appendChild(st);

  // Each style: what flies out at the moment the sides collide.
  const CLASH = {
    classic:   { at: 620, colors: ['#fff', '#ffc23d', '#e63950', '#2f8bff'], shape: 'spark', n: 34, shake: true },
    shattered: PC ? { at: 420, colors: ['#ff5a1f', '#e2430c', '#f6a13a', '#15171d'], shape: 'spark', n: 54, shake: true }
                  : { at: 420, colors: ['#ff9a3d', '#ffcf6b', '#fff1c1', '#c3132d'], shape: 'spark', n: 54, shake: true },
    iron:      { at: 560, colors: ['#ffb347', '#ff6a00', '#fff1c1'], shape: 'spark', n: 48, shake: true },
    devil:     { at: 620, colors: ['#b26bff', '#e2c9ff', '#6d26e6'], shape: 'spark', n: 40, shake: false },
    dojo:   { at: 760, colors: ['#5fd0ff', '#c9f1ff', '#2a8cff'], shape: 'spark', n: 40, shake: false },
    drive:     { at: 500, colors: ['#ff2d95', '#ffe600', '#18c8ff', '#fff'], shape: 'dot', n: 50, shake: true },
    smash:     { at: 700, colors: ['#ffde3b', '#fff', '#ff7a00'], shape: 'star', n: 26, shake: true },
    aether:    { at: 640, colors: ['#ff6b3d', '#3fb6ff', '#7bd65a', '#b98bff'], shape: 'dot', n: 40, shake: false },
    scroll:    { at: 900, colors: ['#ff5a1f', '#2f7fd8', '#3f9a4a', '#f4f1e8'], shape: 'dot', n: 36, shake: false },
    comic:     { at: 520, colors: ['#0a0a0a', '#ffd400', '#e8202a'], shape: 'square', n: 40, shake: true },
    slash:     { at: 300, colors: ['#e0102a', '#fff', '#ff5468'], shape: 'spark', n: 46, shake: true },
    stone:     { at: 600, colors: ['#8a8070', '#5a5448', '#ff6a1a', '#f2c14e'], shape: 'square', n: 44, shake: true },
    street:    { at: 700, colors: ['#2aa8ff', '#9bdcff', '#ffcc33'], shape: 'spark', n: 36, shake: false },
    glitch:    { at: 560, colors: ['#19f0ff', '#ff2bd6', '#fff'], shape: 'square', n: 44, shake: false },
    sky:       { at: 820, colors: ['#ffffff', '#e8c66a', '#bfe3ff'], shape: 'feather', n: 26, shake: false },
    ki:        { at: 420, colors: ['#ffd400', '#fff6c9', '#ff8a00'], shape: 'spark', n: 56, shake: true },
    night:     { at: 860, colors: ['#8a5cff', '#c9b6ff', '#ffffff'], shape: 'star', n: 24, shake: false },
    broadcast: { at: 520, colors: ['#ffffff', '#e3122d'], shape: 'spark', n: 20, shake: false },
    arcade:    { at: 720, colors: ['#ffd200', '#e8102d', '#1d4fff', '#fff'], shape: 'square', n: 40, shake: true },
    chrome:    { at: 680, colors: ['#ffe14d', '#1fa0ff', '#5b2bd6', '#fff'], shape: 'star', n: 30, shake: true },
    oni:       { at: 620, colors: ['#b3060f', '#ff3b14', '#e9c35e', '#141210'], shape: 'spark', n: 46, shake: true },
  }[style] || { at: 620, colors: ['#fff'], shape: 'spark', n: 30 };

  // --------------------------------------------------------------------------- DOM
  const root = document.createElement('div');
  root.id = 'sb-vs'; root.className = BASE; root.setAttribute('aria-hidden', 'true');
  const side = n => `<div class="vs-side vs-s${n}"><div class="vs-face"></div>
      <div class="vs-art"><img alt=""><div class="vs-ghost"></div></div><div class="vs-plate"><i>${n}P</i></div>
      <div class="vs-ava"><img alt=""><b class="vs-ini"></b></div>
      <div class="vs-info"><div class="vs-team"></div><div class="vs-name"></div>
        <div class="vs-sub"><img class="vs-flag" alt=""><span class="vs-char"></span></div>
        <div class="vs-rec"><span class="vs-w"><b class="vs-n"></b> <i>W</i></span><span class="vs-sep">–</span><span class="vs-l"><b class="vs-n"></b> <i>L</i></span><small>this bracket</small></div>
      </div></div>`;
  root.innerHTML = `<div class="vs-stage"><div class="vs-bg"></div>${side(1)}${side(2)}<svg class="vs-sh-svg" viewBox="0 0 1920 1080"></svg><div class="vs-sh-hot"><svg class="vs-sh-svg" viewBox="560 290 800 500"></svg></div>`
    + `<div class="vs-mid"><div class="vs-sh-ball"></div><div class="vs-mark"><i class="vs-g1" aria-hidden="true">VS</i><i class="vs-g2" aria-hidden="true">VS</i><span>VS</span></div><div class="vs-round"></div></div><div class="vs-cut"></div></div>`
    + `<div class="vs-sh-embers"></div><canvas class="vs-sh-cv" width="1920" height="1080"></canvas><div class="vs-fx"></div><div class="vs-flash"></div>`;
  // ---- custom VS Splash pictures (Matches tab → VS Splash): a picture as the name bar (920 × 250) and a header across
  // the top (1920 × 200), with lettering colours that suit the name bar (state.vsArt). They are kept in data attributes:
  // the root's class list is rewritten every time the splash shows or hides.
  const hdr = document.createElement('img'); hdr.className = 'vs-hdr'; hdr.alt = ''; root.appendChild(hdr);
  const artCss = document.createElement('style');
  artCss.textContent = `
#sb-vs .vs-hdr{position:absolute;left:0;top:0;width:1920px;height:200px;object-fit:cover;display:none;z-index:2}
#sb-vs[data-hdr] .vs-hdr{display:block}
#sb-vs[data-hdr].vs-st-shattered .vs-round{top:-322px}#sb-vs[data-hdr].vs-st-oni .vs-round{top:-316px}
#sb-vs[data-bar] .vs-plate{display:block!important;position:absolute;bottom:92px;width:920px;height:250px;z-index:-1;overflow:hidden;clip-path:none!important;box-shadow:none!important;background:var(--vs-bar) center/cover no-repeat!important}
#sb-vs[data-bar] .vs-s1 .vs-plate{left:30px!important}#sb-vs[data-bar] .vs-s2 .vs-plate{right:30px!important}
#sb-vs[data-bar][data-mirror] .vs-s2 .vs-plate{scale:-1 1}
#sb-vs[data-bar] .vs-plate::before,#sb-vs[data-bar] .vs-plate::after,#sb-vs[data-bar] .vs-plate i{display:none!important}
#sb-vs[data-bar][data-scrim] .vs-plate::before{display:block!important;content:'';position:absolute;left:1%;top:3%;width:98%;height:94%;transform:none!important;animation:none!important;background:radial-gradient(ellipse 50% 50% at center,var(--vs-scrim) 0,var(--vs-scrim) 62%,transparent 100%)!important;box-shadow:none!important}
#sb-vs[data-bar] .vs-name{background:none!important;-webkit-text-fill-color:var(--vs-ink)!important;color:var(--vs-ink)!important;filter:none!important;text-shadow:var(--vs-edge)!important}
#sb-vs[data-bar] .vs-team,#sb-vs[data-bar] .vs-sub,#sb-vs[data-bar] .vs-rec i{color:var(--vs-accent)!important;text-shadow:var(--vs-edge)!important}
#sb-vs[data-bar] .vs-rec .vs-n,#sb-vs[data-bar] .vs-rec small{color:var(--vs-ink)!important;text-shadow:none!important}
#sb-vs[data-bar] .vs-rec .vs-w,#sb-vs[data-bar] .vs-rec .vs-l{background:var(--vs-chip)!important;clip-path:none!important;box-shadow:none!important;border-radius:6px}`;
  document.head.appendChild(artCss);
  function customArt(a) {
    a = a || {};
    const flag = (k, on) => { if (on) root.dataset[k] = '1'; else delete root.dataset[k]; };
    flag('bar', a.bar); flag('mirror', a.bar && a.mirror !== false); flag('scrim', a.bar && a.scrim); flag('hdr', a.header);
    for (const [k, v] of [['--vs-bar', a.bar ? `url("${String(a.bar).replace(/["\\]/g, '')}")` : ''], ['--vs-ink', a.ink], ['--vs-accent', a.accent], ['--vs-edge', a.edge], ['--vs-scrim', a.scrimColor], ['--vs-chip', a.chip]]) { if (a.bar && v) root.style.setProperty(k, v); else root.style.removeProperty(k); }
    if (a.header) { if (hdr.getAttribute('src') !== a.header) hdr.src = a.header; } else hdr.removeAttribute('src');
  }
  const mount = () => document.body.appendChild(root);
  document.body ? mount() : addEventListener('DOMContentLoaded', mount);
  const $ = (sel, el = root) => el.querySelector(sel);


  const HOOK = {};
  // --------------------------------------------------------------------------- Shattered
  // Its own effects: the fault line the two slabs meet on, cracks around the VS, embers and
  // sparks on a canvas, decoding text, and an exit where the whole splash breaks into glass.
  if (style === 'shattered') (function () {
    const W = 1920, H = 1080, CX = 960, CY = 540;
    const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    // the fault line: jagged, top to bottom, straight through the centre
    const r = rng(4242), seam = [];
    for (let i = 0; i <= 12; i++) {
      const y = i * H / 12, base = 1018 - (y / H) * 116;
      seam.push({ x: i === 6 ? CX : i === 0 || i === 12 ? base : base + (r() - .5) * 92, y });
    }
    const pts = a => a.map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',');
    const seamD = 'M' + seam.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L');
    // fracture around the VS (also the pattern the glass breaks along when it leaves)
    function fracture(seed, rays, rings) {
      const q = rng(seed), O = { x: CX, y: CY };
      const ang = Array.from({ length: rays }, (_, i) => (i + .15 + q() * .7) / rays * Math.PI * 2);
      const V = rings.map(rad => ang.map(a => { const k = rad * (.8 + q() * .4); return { x: O.x + Math.cos(a) * k, y: O.y + Math.sin(a) * k * .66 }; }));
      return { O, ang, V, q };
    }
    const F = fracture(907, 13, [70, 150, 260]);
    let cracks = '';
    for (let a = 0; a < 13; a++) {
      const b = (a + 1) % 13;
      cracks += `<path class="vs-sh-crack" pathLength="1" d="M${CX},${CY}L${F.V[0][a].x.toFixed(1)},${F.V[0][a].y.toFixed(1)}L${F.V[1][a].x.toFixed(1)},${F.V[1][a].y.toFixed(1)}"/>`;
      if (a % 2 === 0) cracks += `<path class="vs-sh-crack vs-far" pathLength="1" d="M${F.V[1][a].x.toFixed(1)},${F.V[1][a].y.toFixed(1)}L${F.V[2][a].x.toFixed(1)},${F.V[2][a].y.toFixed(1)}"/>`;
      if (a % 3 === 1) cracks += `<path class="vs-sh-crack vs-far" pathLength="1" d="M${F.V[1][a].x.toFixed(1)},${F.V[1][a].y.toFixed(1)}L${F.V[1][b].x.toFixed(1)},${F.V[1][b].y.toFixed(1)}"/>`;
    }
    const svgs = [$('.vs-sh-hot svg'), $('.vs-stage > .vs-sh-svg')];
    svgs[0].innerHTML = cracks;
    svgs[1].innerHTML = ['glow', 'glow2', 'line', 'core'].map(k => `<path class="vs-sh-${k}" pathLength="1" d="${seamD}"/>`).join('');
    $('.vs-s1').style.clipPath = `polygon(0 0,${pts(seam)},0 ${H}px)`;
    $('.vs-s2').style.clipPath = `polygon(${W}px 0,${pts(seam)},${W}px ${H}px)`;

    // ---- canvas: rising embers (always, while shown) + sparks (on impact / break)
    const cv = $('.vs-sh-cv'), ctx = cv.getContext('2d');
    let sparks = [], raf = 0, last = 0, on = false;
    // embers: CSS-only, moved by the graphics card (no per-frame script or repaint)
    $('.vs-sh-embers').innerHTML = Array.from({ length: 34 }, () => {
      const s = 3 + Math.random() * 6;
      return `<i style="left:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--t:${(6 + Math.random() * 7).toFixed(1)}s;--d:${(-Math.random() * 12).toFixed(1)}s;--x:${((Math.random() - .5) * 120).toFixed(0)}px;--o:${(.45 + Math.random() * .5).toFixed(2)}"></i>`;
    }).join('');
    function tick(t) {                     // sparks only: runs for a second or two after an impact
      const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = PC ? 'source-over' : 'lighter';   // added light vanishes on white
      sparks = sparks.filter(p => (p.life -= p.decay * dt) > 0);
      for (const p of sparks) {
        p.vy += 1100 * dt; p.vx *= .985; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.strokeStyle = PC ? `rgba(${200 + 55 * p.life | 0},${60 + 90 * p.life | 0},${12 + 30 * p.life | 0},${p.life})` : `rgba(255,${190 + 60 * p.life | 0},${150 * p.life | 0},${p.life})`; ctx.lineWidth = p.s;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke();
      }
      if (sparks.length) raf = requestAnimationFrame(tick);
      else { raf = 0; ctx.clearRect(0, 0, W, H); }
    }
    const run = () => { if (!raf && !POTATO()) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    function spray(x, y, n, power, dir, spread) {
      if (POTATO()) return;
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - .5) * spread, v = (200 + Math.random() * 700) * power;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: .6 + Math.random() * 1.1, s: 1 + Math.random() * 2.2 });
      }
      if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
      run();
    }
    function waves(n, delay) {
      const fx = $('.vs-fx');
      for (let i = 0; i < n; i++) setTimeout(() => {
        const w = document.createElement('i'); w.className = 'vs-sh-wave';
        w.style.cssText = `left:${CX}px;top:${CY}px;--d:${1100 + i * 320}px;animation-duration:${.8 + i * .2}s`;
        fx.appendChild(w); setTimeout(() => w.remove(), 1300);
      }, i * delay);
    }
    // ---- names decode in, like the layout's
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@';
    function decode(el, ms, delay) {
      const t0 = performance.now() + delay;
      const step = () => {
        const final = el.dataset.txt != null ? el.dataset.txt : el.textContent, k = (performance.now() - t0) / ms;
        if (!root.classList.contains('vs-show')) return;
        if (k >= 1) { el.textContent = final; return; }
        if (k > 0) el.textContent = [...final].map((c, i) => c === ' ' || i < k * final.length ? c : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    HOOK.live = true;                                  // after a seamless refresh: no entrance, but keep the glints/embers moving
    HOOK.show = (instant, later) => {
      // once the entrance is over, drop it: finished-but-filling animations cost a lot every frame
      if (!instant) later(() => root.classList.remove('vs-in'), 1750);
      clearDebris(); root.classList.remove('vs-break', 'vs-broken');
      on = true;
      if (!instant && !POTATO()) {
        root.querySelectorAll('.vs-name').forEach((el, i) => decode(el, 520, 820 + i * 80));
        decode($('.vs-round'), 450, 980);
      }
    };
    HOOK.clash = () => {
      waves(3, 110);
      for (const f of [.15, .5, .85]) { const i = Math.round(f * 12), p = seam[i]; spray(p.x, p.y, 40, 1, Math.PI, Math.PI * 2); }
      spray(CX, CY, 70, 1.25, -Math.PI / 2, Math.PI * 2);
    };
    HOOK.settle = () => root.querySelectorAll('.vs-name, .vs-round').forEach(el => { if (el.dataset.txt != null) el.textContent = el.dataset.txt; });
    let debris = null;
    function clearDebris() { if (debris) { debris.remove(); debris = null; } }
    HOOK.hide = instant => { if (instant) { on = false; clearDebris(); sparks = []; root.classList.remove('vs-break', 'vs-broken'); } };
    // Leave by shattering: the splash cracks from the centre and flies apart, revealing the scoreboard.
    const G = fracture(77, 12, [150, 400, 780, 1500]);
    const shardPolys = [];
    for (let a = 0; a < 12; a++) {
      const b = (a + 1) % 12;
      for (let i = 0; i < 4; i++) shardPolys.push(i === 0 ? [G.O, G.V[0][a], G.V[0][b]] : [G.V[i - 1][a], G.V[i - 1][b], G.V[i][b], G.V[i][a]]);
    }
    let breakLines = '';
    for (let a = 0; a < 12; a++) {
      const b = (a + 1) % 12, f = p => `${p.x.toFixed(0)},${p.y.toFixed(0)}`;
      breakLines += `<path pathLength="1" d="M${f(G.O)}L${G.V.map(r => f(r[a])).join('L')}"/>`;
      for (let i = 0; i < 3; i++) breakLines += `<path pathLength="1" d="M${f(G.V[i][a])}L${f(G.V[i][b])}"/>`;
    }
    HOOK.exit = (later, done) => {
      on = false;
      let bl = $('.vs-sh-break'); if (!bl) { root.insertAdjacentHTML('beforeend', `<svg class="vs-sh-break" viewBox="0 0 1920 1080">${breakLines}</svg>`); bl = $('.vs-sh-break'); }
      root.classList.add('vs-break');
      later(() => {
        HOOK.settle();
        // Shards near the centre carry a light copy of the splash, so the VS visibly breaks apart.
        // The big outer ones are plain glass polygons (cheap); the white-hot flash hides the swap.
        const lite = $('.vs-stage').cloneNode(true);
        lite.querySelectorAll('.vs-sh-hot, .vs-sh-ball, .vs-art, .vs-side').forEach(el => el.remove());
        lite.querySelectorAll('*').forEach(el => { el.style.animation = 'none'; });
        const box = document.createElement('div'); box.className = 'vs-sh-debris';
        for (const poly of shardPolys) {
            const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
            const x0 = Math.max(-40, Math.floor(Math.min(...xs))), y0 = Math.max(-40, Math.floor(Math.min(...ys)));
            const x1 = Math.min(W + 40, Math.ceil(Math.max(...xs))), y1 = Math.min(H + 40, Math.ceil(Math.max(...ys)));
            if (x1 - x0 < 2 || y1 - y0 < 2) continue;
            const w = document.createElement('div'); w.className = 'vs-sh-shard';
            w.style.cssText = `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
            const pts = poly.map(p => `${(p.x - x0).toFixed(1)},${(p.y - y0).toFixed(1)}`).join(' ');
            w.innerHTML = `<svg viewBox="0 0 ${x1 - x0} ${y1 - y0}"><polygon class="vs-g" points="${pts}"/></svg>`;
            if ((x1 - x0) * (y1 - y0) < 160000) {          // centre: the real VS / fault line, clipped to the shard
              const inner = document.createElement('div'); inner.className = 'vs-sh-in';
              inner.style.clipPath = `polygon(${poly.map(p => `${(p.x - x0).toFixed(1)}px ${(p.y - y0).toFixed(1)}px`).join(',')})`;
              const c = lite.cloneNode(true); c.style.left = -x0 + 'px'; c.style.top = -y0 + 'px';
              inner.appendChild(c); w.appendChild(inner);
            }
            w.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${x1 - x0} ${y1 - y0}"><polygon class="vs-e" points="${pts}"/></svg>`);
            box.appendChild(w);
            const cx = xs.reduce((s, v) => s + v, 0) / xs.length, cy = ys.reduce((s, v) => s + v, 0) / ys.length;
            w.style.transformOrigin = `${cx - x0}px ${cy - y0}px`;
            const dx = cx - CX, dy = cy - CY, dist = Math.hypot(dx, dy) || 1, q = G.q;
            const sp = 380 + q() * 520 - dist * .12, vx = dx / dist * sp, vy = dy / dist * sp * .7 - (80 + q() * 260), g = 1900, T = 1.15 + q() * .5;
            const rz = (q() - .5) * 700, rx = (q() - .5) * 420, ry = (q() - .5) * 420;
            w.animate([0, .1, .25, .45, .7, 1].map(f => { const t = f * T; return { offset: f,
              transform: `translate3d(${(vx * t).toFixed(1)}px,${(vy * t + .5 * g * t * t).toFixed(1)}px,${(q() * 60 * f).toFixed(1)}px) rotateX(${(rx * f) | 0}deg) rotateY(${(ry * f) | 0}deg) rotateZ(${(rz * f) | 0}deg)`,
              opacity: f < .6 ? 1 : 1 - (f - .6) / .4 }; }),
              { duration: T * 1000, delay: Math.min(200, dist * .2), fill: 'forwards' });
        }
        box.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="vs-sh-glass" x1="0" y1="0" x2="1" y2="1">' + (PC ? '<stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e9ebf0"/><stop offset=".55" stop-color="#ffe2cc"/><stop offset="1" stop-color="#c9cdd6"/>' : '<stop offset="0" stop-color="#2a2b33"/><stop offset=".45" stop-color="#0d0e12"/><stop offset=".55" stop-color="#3a2a24"/><stop offset="1" stop-color="#050507"/>') + '</linearGradient></defs></svg>');
        clearDebris(); debris = box; root.appendChild(box);
        root.classList.remove('vs-break'); root.classList.add('vs-broken', 'vs-clash');
        waves(2, 90);
        spray(CX, CY, 120, 1.4, -Math.PI / 2, Math.PI * 2);
        later(() => root.classList.remove('vs-clash'), 500);
        later(() => { clearDebris(); root.classList.remove('vs-broken'); done(); }, 2300);
      }, 160);
    };
  })();

  // --------------------------------------------------------------------------- Oni: the VS burns
  if (style === 'oni') (function () {
    const cv = $('.vs-sh-cv'), ctx = cv.getContext('2d');
    let ps = [], raf = 0, last = 0, on = false;
    let dirty = null;
    const tick = t => {
      const P = window.SBPerf;
      if (P && P.idle) { raf = 0; P.whenAwake(() => { if (!raf && (on || ps.length)) { last = performance.now(); raf = requestAnimationFrame(tick); } }); return; }
      const dt = Math.min(.05, (t - last) / 1000); last = t; if (P) P.sample(dt * 1000);
      if (on && edge.length) for (let i = 0, k = P ? P.n(12) : 12; i < k; i++) {   // small tongues of flame along the letters' outline
        const e = edge[Math.random() * edge.length | 0];
        ps.push({ x: e[0] + (Math.random() - .5) * 4, y: e[1] + (Math.random() - .5) * 4, vx: (Math.random() - .5) * 16, vy: -(45 + Math.random() * 75), life: 1, decay: 1.7 + Math.random() * 1.3, s: 5 + Math.random() * 6, ph: Math.random() * 6 });
      }
      if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]); else ctx.clearRect(0, 0, 1920, 1080);
      dirty = [600, 0, 1320, 760];                    // the flames only ever live around the VS
      ps = ps.filter(p => (p.life -= p.decay * dt) > 0);
      ctx.globalCompositeOperation = 'lighter';       // flames brighten the red rift instead of vanishing into it
      for (const p of ps) {
        p.x += (p.vx + Math.sin(t / 110 + p.ph) * 10) * dt; p.y += p.vy * dt;
        const s = p.s * (.35 + p.life * .65), L = Math.round(p.life * 6) / 6;
        if (P) { ctx.globalAlpha = .8 * p.life; ctx.drawImage(P.glow('vse' + L, [[0, `rgb(255,${190 + 60 * L | 0},${90 + 90 * L | 0})`], [.4, 'rgba(255,140,30,.75)'], [1, 'rgba(255,80,10,0)']]), p.x - s * 1.2, p.y - s * 2.4, s * 2.4, s * 4.8); ctx.globalAlpha = 1; }
        else { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 2.4); g.addColorStop(0, `rgba(255,${190 + 60 * p.life | 0},${90 + 90 * p.life | 0},${.8 * p.life})`); g.addColorStop(.4, `rgba(255,140,30,${.6 * p.life})`); g.addColorStop(1, 'rgba(255,80,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 1.2, s * 2.4, 0, 0, 6.283); ctx.fill(); }
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = on || ps.length ? requestAnimationFrame(tick) : 0;
    };
    // trace the outline of the VS as it's drawn on screen, so the flames hug the letters
    let edge = [];
    function trace() {
      edge = [];
      const sp = $('.vs-mark span'); if (!sp) return;
      const cs = getComputedStyle(sp), cr = cv.getBoundingClientRect(), r = sp.getBoundingClientRect();
      if (!cr.width || !r.width) return;
      const k = 1920 / cr.width, w = Math.ceil(r.width * k) + 40, h = Math.ceil(r.height * k) + 40;
      const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
      const o = oc.getContext('2d', { willReadFrequently: true });
      o.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      try { o.letterSpacing = cs.letterSpacing; } catch (e) {}
      const m = o.measureText(sp.textContent), fs = parseFloat(cs.fontSize);
      const asc = m.fontBoundingBoxAscent || fs * .8, desc = m.fontBoundingBoxDescent || fs * .2;
      const bx = 20 + parseFloat(cs.paddingLeft), by = 20 + (fs - (asc + desc)) / 2 + asc;     // line-height 1: half-leading above the ascent
      o.lineWidth = 6; o.lineJoin = 'round'; o.strokeText(sp.textContent, bx, by); o.fillText(sp.textContent, bx, by);
      const d = o.getImageData(0, 0, w, h).data, A = (x, y) => d[(y * w + x) * 4 + 3];
      const ox = (r.left - cr.left) * k - 20, oy = (r.top - cr.top) * k - 20;
      for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) {
        if (A(x, y) < 128) continue;
        if (A(x - 2, y) < 128 || A(x + 2, y) < 128 || A(x, y - 2) < 128 || A(x, y + 2) < 128) edge.push([ox + x, oy + y]);
      }
    }
    const start = delay => setTimeout(() => { if (POTATO()) return; trace(); on = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }, delay);
    HOOK.show = instant => { start(instant ? 60 : 1180); };          // after the VS has stamped down
    HOOK.hide = () => { on = false; };
    HOOK.live = true;
  })();

  // --------------------------------------------------------------------------- data
  const MARK = { dojo: '対', night: 'VS', arcade: 'VS', comic: 'VS!' };
  root.querySelectorAll('.vs-mark span,.vs-mark i').forEach(e => e.textContent = MARK[style] || 'VS');
  const GHOST_MAX = style === 'shattered' ? 820 : 740;  // keep each ghost name in its own half
  function refit() {                                      // only measurable while the splash is on screen
    if (!root.classList.contains('vs-show')) return;
    for (const n of [1, 2]) {
      const el = $('.vs-s' + n), nm = $('.vs-name', el), gh = $('.vs-ghost', el);
      if (nm.dataset.txt != null) nm.textContent = nm.dataset.txt;   // measure the real name, not a decoding scramble
      fit(nm, $('.vs-info', el).clientWidth - 60, .3);          // a very long name gets smaller rather than cut off
      if (gh.dataset.fitFor !== gh.textContent) { gh.dataset.fitFor = gh.textContent; fit(gh, GHOST_MAX, .15); }
    }
    if (style === 'oni' || style === 'shattered') {        // matching name sizes, like a title card
      // …but only as far as it still looks right: next to a very long name, a short one stays big (at least 72% of its own size)
      const a = $('.vs-s1 .vs-name'), b = $('.vs-s2 .vs-name'), fa = parseFloat(getComputedStyle(a).fontSize), fb = parseFloat(getComputedStyle(b).fontSize), m = Math.min(fa, fb);
      a.style.fontSize = Math.max(m, fa * .72) + 'px'; b.style.fontSize = Math.max(m, fb * .72) + 'px';
    }
  }
  function fit(el, max, min = .45) {
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize) || 72;
    let size = base;
    while (el.scrollWidth > max && size > base * min) { size -= 2; el.style.fontSize = size + 'px'; }
  }
  function fill(s) {
    for (const n of [1, 2]) {
      const p = s['p' + n] || {}, el = $('.vs-s' + n);
      $('.vs-team', el).textContent = p.team || '';
      $('.vs-team', el).style.display = p.team ? '' : 'none';
      $('.vs-name', el).textContent = p.name || ('Player ' + n);
      $('.vs-name', el).dataset.txt = $('.vs-name', el).textContent;
      $('.vs-ghost', el).textContent = p.name || ('Player ' + n);
      const art = $('.vs-art', el), artImg = $('.vs-art img', el), artSrc = String(p.splashArt || p.characterArt || '');
      el.dataset.pic = p.pic === 'art' && artSrc ? 'art' : '';                 // 'art': an uploaded character image instead of the profile picture
      if (artImg.dataset.src !== artSrc) {            // full character splash art
        artImg.dataset.src = artSrc; art.classList.remove('vs-has-art');
        if (artSrc) { artImg.onload = () => art.classList.add('vs-has-art'); artImg.onerror = () => art.classList.remove('vs-has-art'); artImg.src = artSrc; }
        else artImg.removeAttribute('src');
      }
      const img = $('.vs-ava img', el), ava = $('.vs-ava', el);
      $('.vs-ini', el).textContent = String(p.name || ('P' + n)).trim().charAt(0).toUpperCase() || '?';
      const src = String(p.avatar || '');
      if (img.dataset.src !== src) {
        img.dataset.src = src; ava.classList.remove('vs-has-img');
        if (src) { img.onload = () => ava.classList.add('vs-has-img'); img.onerror = () => ava.classList.remove('vs-has-img'); img.src = src; }
        else img.removeAttribute('src');
      }
      const flag = $('.vs-flag', el);
      flag.onerror = () => { flag.dataset.bad = flag.getAttribute('src'); flag.style.display = 'none'; };   // offline: no broken-image icon
      if (p.flagUrl && flag.dataset.bad !== p.flagUrl) { if (flag.getAttribute('src') !== p.flagUrl) flag.src = p.flagUrl; flag.style.display = ''; } else flag.style.display = 'none';
      $('.vs-char', el).textContent = p.character || '';
      $('.vs-sub', el).style.display = (p.flagUrl || p.character) ? '' : 'none';
      const w = String(p.wins ?? '').trim(), l = String(p.losses ?? '').trim();
      $('.vs-rec', el).classList.toggle('vs-none', w === '' && l === '');
      $('.vs-w .vs-n', el).textContent = w || '0'; $('.vs-l .vs-n', el).textContent = l || '0';
      requestAnimationFrame(refit);
    }
    $('.vs-round').textContent = s.round || '';
    $('.vs-round').dataset.txt = s.round || '';
    $('.vs-round').style.display = s.round ? '' : 'none';
  }

  // --------------------------------------------------------------------------- show / hide
  let shown = false, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function burst() {
    const fx = $('.vs-fx'), cx = 960, cy = HEIGHT / 2;
    fx.innerHTML = '';
    for (let i = 0; i < CLASH.n; i++) {
      const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 560;
      const p = document.createElement('i');
      p.className = 'vs-p vs-' + CLASH.shape;
      const s = CLASH.shape === 'spark' ? 2 + Math.random() * 3 : 4 + Math.random() * 7;
      p.style.cssText = `left:${cx}px;top:${cy}px;--s:${s}px;--c:${CLASH.colors[i % CLASH.colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d * .7}px;--r:${CLASH.shape === 'spark' ? a : Math.random() * 6.28}rad;--t:${600 + Math.random() * 700}ms`;
      fx.appendChild(p);
    }
    later(() => { fx.innerHTML = ''; }, 1500);
  }
  function show(instant) {
    clearTimers();
    shown = true;
    document.documentElement.classList.add('sb-vs-on');
    root.classList.remove('vs-out', 'vs-clash', 'vs-shake', 'vs-static', 'vs-in');
    root.classList.add('vs-show');
    refit();
    if (HOOK.show) HOOK.show(instant, later);
    if (instant) { if (!HOOK.live) root.classList.add('vs-static'); return; }
    void root.offsetWidth;                       // restart the entrance animations
    root.classList.add('vs-in');
    later(() => {
      root.classList.add('vs-clash'); if (CLASH.shake) root.classList.add('vs-shake');
      if (HOOK.clash) { HOOK.clash(); return; }
      burst();
      if (window.FX && window.FX.particles) try { window.FX.particles(960, HEIGHT / 2, { n: 30, colors: CLASH.colors, shape: CLASH.shape === 'feather' ? 'feather' : 'spark', speed: [250, 700], gravity: 300, life: [.4, .9] }); } catch (e) {}
    }, CLASH.at);
    later(() => root.classList.remove('vs-clash', 'vs-shake'), CLASH.at + 600);
  }
  function hide(instant) {
    clearTimers();
    shown = false;
    document.documentElement.classList.remove('sb-vs-on');
    if (HOOK.hide) HOOK.hide(instant || !root.classList.contains('vs-show') || POTATO());
    if (instant || !root.classList.contains('vs-show') || POTATO()) { root.className = BASE; return; }
    if (HOOK.exit) { root.classList.remove('vs-in', 'vs-clash', 'vs-shake', 'vs-static'); HOOK.exit(later, () => { if (!shown) root.className = BASE; }); return; }
    root.classList.remove('vs-in', 'vs-clash', 'vs-shake', 'vs-static');
    root.classList.add('vs-out');
    later(() => { if (!shown) root.className = BASE; }, 650);
  }
  let first = true;
  addEventListener('scoreboard', e => {
    const s = e.detail || {};
    customArt(s.vsArt);
    fill(s);
    // a game format draws its own VS for every match (sb-format.js) — this one steps aside
    const want = !!(s.vs && s.vs.show) && !(typeof window.__SB_FORMAT_VS === 'function' && window.__SB_FORMAT_VS(s));
    if (first) { first = false; if (want) show(!!window.__SB_INSTANT); return; }
    if (want && !shown) show(false);
    else if (!want && shown) hide(false);
  });
  // a hidden page shouldn't replay a stale entrance when it comes back
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (shown && root.classList.contains('vs-in')) { clearTimers(); root.classList.remove('vs-in', 'vs-clash', 'vs-shake'); if (!HOOK.live) root.classList.add('vs-static'); if (HOOK.settle) HOOK.settle(); }
    if (!shown && root.className !== BASE) { clearTimers(); if (HOOK.hide) HOOK.hide(true); root.className = BASE; }
  });
  window.BeeboVS = { style, show: () => show(false), hide: () => hide(false) };
})();
