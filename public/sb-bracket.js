/*
 * BeeboScore bracket splash — loaded on every overlay page after sb-client.js.
 *
 *   Bracket : the loaded start.gg pool in the Shattered style, sized to the number of players
 *             (one screen up to ~16 players, Winners / Losers pages that alternate up to 48).
 *   Top 8   : its own darker storm design with big player cards and lightning; used automatically
 *             once the event reaches Top 8 (Settings › "Switch to Top 8 automatically").
 *
 *   Standings: the final Top 8 placements (1st big, 2nd–4th, 5th–8th) — at the end, on stream and saved as a picture.
 *   Pictures: start.gg profile pictures or character art (Bracket tab › Pictures), from the model's `pics`.
 *
 * Shown with state.splash.show = 'bracket' | 'top8' | 'standings'. Turn it off for a layout with
 * <meta name="sb-bracket" content="off">.
 */
(function () {
  'use strict';
  if (window.__SB_BRACKET_LOADED) return; window.__SB_BRACKET_LOADED = true;
  const meta = document.querySelector('meta[name="sb-bracket"]');
  if (meta && /^off$/i.test(meta.content)) return;
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const W = 1920, H = 1080;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@';

  // fonts ship with the app — no internet needed (Saira Condensed has no true italic anywhere, so slanted text looks the same)
  if (!document.querySelector('style[data-sb-bracket-fonts]')) {
    const l = document.createElement('style'); l.dataset.sbBracketFonts = '1';
    l.textContent = [['Chakra Petch', 500, 'chakra-petch-latin-500-normal'], ['Chakra Petch', 600, 'chakra-petch-latin-600-normal'], ['Chakra Petch', 700, 'chakra-petch-latin-700-normal'],
      ['Saira Condensed', 700, 'saira-condensed-latin-700-normal'], ['Saira Condensed', 800, 'saira-condensed-latin-800-normal']]
      .map(([f, w, file]) => `@font-face{font-family:'${f}';font-weight:${w};font-display:swap;src:url(/static/fonts/${file}.woff2) format('woff2')}`).join('\n');
    document.head.appendChild(l);
  }

  // ======================================================================================= styles
  const css = `
#sb-bracket{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9000;display:none;overflow:hidden;pointer-events:none;color:#fff;
  font-family:'Chakra Petch',sans-serif;--ac:#ff5a1f;--hot:#ffb36b;--deep:#a3180a;--steel:#d9dce4;--sub:#8d919d}
#sb-bracket.br-show{display:block;background:#040406}
#sb-bracket.br-show.t8m{background:#020203}
#sb-bracket.br-out{background:transparent!important}
#sb-bracket *{box-sizing:border-box;margin:0}
#sb-bracket .br-stage{position:absolute;inset:0}
#sb-bracket .br-flash{position:absolute;inset:0;z-index:20;background:radial-gradient(circle at 50% 50%,#fff,#ffd0a0 35%,rgba(255,90,31,.5) 75%);opacity:0;will-change:opacity}

/* ---------------------------------------------------------------- bracket (Shattered) */
#sb-bracket .sh-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 112%,rgba(255,90,31,.32),transparent 70%),radial-gradient(ellipse 50% 60% at 85% 50%,rgba(163,24,10,.22),transparent 70%),
  linear-gradient(158deg,transparent 0 31%,rgba(255,255,255,.025) 31% 31.15%,transparent 31.15% 64%,rgba(255,255,255,.02) 64% 64.12%,transparent 64.12%),linear-gradient(180deg,#121317,#060608 60%,#040406)}
#sb-bracket .sh-ghost{position:absolute;right:30px;top:96px;font:italic 800 300px/1 'Saira Condensed',Impact,sans-serif;color:transparent;-webkit-text-stroke:2px rgba(255,140,80,.09);letter-spacing:-4px;white-space:nowrap}
#sb-bracket svg.sh-seam{position:absolute;inset:0;width:${W}px;height:${H}px;opacity:.16}
#sb-bracket svg.sh-seam path{fill:none;stroke:#ff5a1f;stroke-width:2}
#sb-bracket .sh-head{position:absolute;left:0;right:0;top:0;height:132px;display:flex;align-items:center;padding:0 64px;gap:28px}
#sb-bracket .sh-head::after{content:'';position:absolute;left:64px;right:64px;bottom:8px;height:2px;background:linear-gradient(90deg,#ff5a1f,rgba(255,90,31,.15) 60%,transparent)}
#sb-bracket .sh-t1{font:italic 800 92px/1 'Saira Condensed',Impact,sans-serif;letter-spacing:1px;white-space:nowrap;padding-right:8px;
  background:linear-gradient(180deg,#fff 0%,#e9ebf0 40%,#8f939d 52%,#d9dce3 76%,#fff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 0 rgba(0,0,0,.75))}
#sb-bracket .sh-t1{display:flex;align-items:center;gap:16px}
#sb-bracket .sh-t1 .sh-nm{font-style:italic;font-size:62px;line-height:1.15;max-width:760px;overflow:hidden;text-overflow:ellipsis;padding:0 .14em .02em 0;text-transform:uppercase}
#sb-bracket .sh-t1 .sh-cnt{font-size:92px;line-height:1.1;padding:0 .1em}
#sb-bracket .sh-t1 .sh-left{font:700 15px/1.25 'Chakra Petch',sans-serif;letter-spacing:4px;color:var(--muted,#8d919d);-webkit-text-fill-color:currentColor;background:none}
#sb-bracket .sh-t1 span{background:linear-gradient(180deg,#ffd0a0,#ff5a1f 60%,#a3180a);-webkit-background-clip:text;background-clip:text}
#sb-bracket .sh-ev{display:flex;flex-direction:column;gap:6px;padding-left:28px;border-left:2px solid rgba(255,90,31,.6);min-width:0}
#sb-bracket .sh-ev b{font:700 26px 'Chakra Petch',sans-serif;letter-spacing:6px;color:var(--steel);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:900px}
#sb-bracket .sh-ev small{font:600 16px 'Chakra Petch',sans-serif;letter-spacing:5px;color:var(--ac);text-transform:uppercase;white-space:nowrap}
#sb-bracket .sh-live{margin-left:auto;display:flex;align-items:center;gap:12px;font:700 18px 'Chakra Petch',sans-serif;letter-spacing:5px;color:var(--steel);padding:10px 26px;
  background:linear-gradient(180deg,#17181d,#050507);clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%);box-shadow:inset 0 2px 0 #ff5a1f}
#sb-bracket .sh-live i{width:12px;height:12px;border-radius:50%;background:#ff5a1f;box-shadow:0 0 12px #ff5a1f}
#sb-bracket .sh-pages{position:absolute;right:64px;top:104px;display:flex;gap:6px;align-items:center;font:700 16px 'Chakra Petch',sans-serif;letter-spacing:4px}
#sb-bracket .sh-pages b{padding:7px 18px;color:#6f737e;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);background:#0d0e12}
#sb-bracket .sh-pages b.on{color:#fff;background:linear-gradient(180deg,#ff7a3a,#a3180a)}
#sb-bracket .sh-pages span{width:120px;height:3px;background:#22232a;margin-left:10px;overflow:hidden}
#sb-bracket .sh-pages span i{display:block;width:100%;height:100%;background:#ff5a1f;box-shadow:0 0 8px #ff5a1f;transform-origin:0 50%;transform:scaleX(0);will-change:transform}
#sb-bracket .sh-sec{position:absolute;left:64px;font:800 italic 30px 'Saira Condensed',Impact,sans-serif;letter-spacing:3px;color:var(--ac)}
#sb-bracket .sh-div{position:absolute;left:64px;right:340px;height:1px;background:linear-gradient(90deg,rgba(255,90,31,.5),transparent)}
#sb-bracket .sh-rh{position:absolute;font:700 14px 'Chakra Petch',sans-serif;letter-spacing:3.5px;color:var(--sub);padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
#sb-bracket svg.br-links{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:visible}
#sb-bracket .sh svg.br-links path{fill:none;stroke:rgba(217,220,228,.16);stroke-width:2}
#sb-bracket .sh svg.br-links path.hot{stroke:#ff6a2a;stroke-width:2.5}
#sb-bracket .sh svg.br-links path.hotglow{stroke:#ff5a1f;stroke-width:8;opacity:.18}
#sb-bracket .bm{position:absolute}
#sb-bracket .sh .bm-in{position:relative;width:100%;height:100%;background:linear-gradient(180deg,#1b1c22,#0b0c0f 55%,#050507);clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);box-shadow:inset 0 0 0 1px rgba(255,90,31,.28);overflow:hidden}
#sb-bracket .sh .bm-in::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#3a3b42;z-index:1}
#sb-bracket .sh .bm.st-done .bm-in::before{background:#ff5a1f}
#sb-bracket .sh .bm.st-wait .bm-in{opacity:.55}
#sb-bracket .sh .bm.st-live .bm-in{box-shadow:inset 0 0 0 2px #ff7a3a;background:linear-gradient(180deg,#3a1d12,#140a07 55%,#070505)}
#sb-bracket .sh .bm.st-live::before{content:'';position:absolute;inset:-14px;background:radial-gradient(ellipse at 50% 50%,rgba(255,90,31,.42),transparent 70%);will-change:opacity}
#sb-bracket .sh .bm.st-live .bm-in::after{content:'';position:absolute;top:0;bottom:0;left:0;width:60%;background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,.13) 50%,transparent 80%);transform:translateX(-120%);will-change:transform}
#sb-bracket .sh .bm.st-next .bm-in{box-shadow:inset 0 0 0 1px rgba(255,179,107,.7)}
#sb-bracket .sh .bm.st-playing .bm-in{box-shadow:inset 0 0 0 1px rgba(255,140,80,.6)}
#sb-bracket .sh .r{height:50%;display:flex;align-items:center;gap:8px;padding:0 0 0 12px;font:700 var(--fs,19px) 'Saira Condensed',sans-serif;letter-spacing:.5px;color:#d0d3db;position:relative}
#sb-bracket .sh .r+.r{border-top:1px solid rgba(255,255,255,.06)}
#sb-bracket .sh .r i{width:20px;flex:none;font:600 calc(var(--fs,19px) * .6) 'Chakra Petch',sans-serif;font-style:normal;color:#6c707b;text-align:right}
#sb-bracket .sh .r b{flex:1;min-width:0;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
#sb-bracket .sh .r em{width:calc(var(--fs,19px) * 2);flex:none;height:100%;display:grid;place-items:center;font:700 var(--fs,19px) 'Chakra Petch',sans-serif;font-style:normal;color:#9a9ea9;background:rgba(0,0,0,.35)}
#sb-bracket .sh .r.win b{color:#fff;font-style:italic}
#sb-bracket .sh .r.win em{color:#fff;background:linear-gradient(180deg,#ff7a3a,#a3180a);text-shadow:0 0 10px rgba(255,200,150,.8)}
#sb-bracket .sh .r.lose b{color:#6f737e;text-decoration:line-through rgba(255,90,31,.55) 2px}
#sb-bracket .sh .r.tbd b{color:#4c4f58;letter-spacing:3px}
#sb-bracket .sh .st-live .r em{color:#fff}
#sb-bracket .br-tag{position:absolute;z-index:2;right:14px;top:-19px;font:700 10px 'Chakra Petch',sans-serif;letter-spacing:2px;padding:2px 8px 1px;background:#ff5a1f;color:#120502;clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%);white-space:nowrap}
#sb-bracket .br-tag.t2{background:#2a2b31;color:#ffb36b;box-shadow:inset 0 0 0 1px #ffb36b}
#sb-bracket .sh .gfb{position:absolute;width:250px;background:linear-gradient(180deg,#22232a,#0b0c0f 60%,#050507);box-shadow:inset 0 0 0 2px rgba(255,90,31,.6);clip-path:polygon(0 0,100% 0,calc(100% - 16px) 100%,0 100%)}
#sb-bracket .sh .gfb .gfh{height:36px;display:grid;place-items:center;font:800 italic 24px 'Saira Condensed',sans-serif;letter-spacing:3px;background:linear-gradient(180deg,#ff7a3a,#a3180a);color:#fff;white-space:nowrap}
#sb-bracket .sh .gfb .bm{position:relative;width:100%}
#sb-bracket .sh .gfb .bm-in{clip-path:none;box-shadow:none;background:none}
#sb-bracket .sh .gfwrap{position:absolute;filter:drop-shadow(0 0 40px rgba(255,90,31,.25))}
#sb-bracket .br-spark{position:absolute;left:0;top:0;width:14px;height:4px;margin:-2px 0 0 -7px;border-radius:2px;background:linear-gradient(90deg,transparent,#ffb36b,#fff);box-shadow:0 0 10px #ff5a1f,0 0 3px #fff;
  offset-rotate:auto;offset-distance:0%;opacity:0;animation:br-spark var(--t,.9s) var(--dl,0s) cubic-bezier(.4,0,.6,1) forwards;will-change:offset-distance}
@keyframes br-spark{0%{offset-distance:0%;opacity:0}8%{opacity:1}92%{opacity:1}100%{offset-distance:100%;opacity:0}}
#sb-bracket .br-embers{position:absolute;inset:0;overflow:hidden}
#sb-bracket .br-embers i{position:absolute;bottom:-12px;width:var(--s);height:var(--s);border-radius:50%;opacity:0;will-change:transform,opacity;
  background:radial-gradient(circle,#fff3dc 0,#ffb36b 30%,rgba(255,90,31,.5) 55%,transparent 72%);animation:br-rise var(--t) var(--d) linear infinite}
@keyframes br-rise{0%{transform:translate(0,0);opacity:0}10%{opacity:var(--o)}50%{transform:translate(var(--x),-560px);opacity:var(--o)}100%{transform:translate(calc(var(--x) * -.4),-1120px);opacity:0}}
#sb-bracket .br-msg{position:absolute;left:0;right:0;top:520px;text-align:center;font:700 26px 'Chakra Petch',sans-serif;letter-spacing:6px;color:var(--sub);text-transform:uppercase}

/* idle */
#sb-bracket.br-show .sh .bm.st-live::before{animation:br-throb 1.6s ease-in-out infinite}
#sb-bracket.br-show .sh .bm.st-live .bm-in::after{animation:br-glint 3.2s ease-in-out infinite}
@keyframes br-throb{50%{opacity:.35}}
@keyframes br-glint{0%,55%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
#sb-bracket .bm.br-flare .bm-in{animation:br-flare .9s ease-out}
@keyframes br-flare{0%{filter:brightness(3) saturate(0)}100%{filter:none}}

/* entrance */
#sb-bracket.br-in .sh-bg,#sb-bracket.br-in .sh-seam,#sb-bracket.br-in .sh-ghost{animation:br-fade .5s both}
#sb-bracket.br-in .sh-head{animation:br-slam .6s .1s cubic-bezier(.2,.9,.3,1.25) both}
#sb-bracket.br-in .sh-pages,#sb-bracket.br-in .sh-sec,#sb-bracket.br-in .sh-rh{animation:br-fade .4s var(--d,.3s) both}
#sb-bracket.br-in .sh .bm,#sb-bracket.br-pg .sh .bm{animation:br-ignite .55s var(--d,.3s) both}
#sb-bracket.br-in .sh .gfwrap,#sb-bracket.br-pg .sh .gfwrap{animation:br-ignite .7s var(--d,.9s) both}
#sb-bracket.br-in svg.br-links path,#sb-bracket.br-pg svg.br-links path{stroke-dasharray:1;animation:br-draw .45s var(--d,.4s) ease-out both}
#sb-bracket.br-in .br-embers{animation:br-fade 1.2s .5s both}
@keyframes br-fade{from{opacity:0}}
@keyframes br-slam{from{opacity:0;transform:translateY(-30px) scale(1.15)}}
@keyframes br-ignite{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}
#sb-bracket.br-in .sh .bm::after,#sb-bracket.br-pg .sh .bm::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#ffd0a0,#ff5a1f);mix-blend-mode:screen;opacity:0;animation:br-heat .6s var(--d,.3s) ease-out both;pointer-events:none}
@keyframes br-heat{0%{opacity:.85}100%{opacity:0}}
@keyframes br-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
#sb-bracket.br-flashing .br-flash{animation:br-flashk .55s ease-out}
@keyframes br-flashk{0%{opacity:.75}100%{opacity:0}}
/* page change + exit: the stage cracks and drops away */
#sb-bracket .br-page.br-pg-out{animation:br-pgout .42s cubic-bezier(.5,0,.9,.4) forwards}
@keyframes br-pgout{0%{clip-path:polygon(0 0,100% 0,100% 100%,0 100%);filter:none}35%{filter:brightness(2.2)}100%{clip-path:polygon(0 0,0 0,0 100%,0 100%);filter:brightness(2.5);transform:translateX(-40px)}}
#sb-bracket.br-out .br-stage{animation:br-out .6s .12s cubic-bezier(.5,0,.9,.4) forwards}
@keyframes br-out{0%{opacity:1;transform:none;filter:none}30%{filter:brightness(2)}100%{opacity:0;transform:scale(1.04);filter:brightness(3)}}
#sb-bracket svg.br-break{position:absolute;inset:0;width:${W}px;height:${H}px;z-index:19;display:none}
#sb-bracket svg.br-break path{fill:none;stroke:#fff1dd;stroke-width:3;stroke-dasharray:1;stroke-dashoffset:1}
#sb-bracket.br-out svg.br-break{display:block}
#sb-bracket.br-out svg.br-break path{animation:br-draw .16s ease-out forwards,br-fadeout .4s .3s forwards}
@keyframes br-fadeout{to{opacity:0}}

/* ---------------------------------------------------------------- Top 8 (storm) */
#sb-bracket .t8{--cr:#c3132d;--cr2:#e0263f}
#sb-bracket .t8-sky{position:absolute;inset:0;background:
  radial-gradient(ellipse 40% 30% at 70% 8%,rgba(120,130,170,.16),transparent 70%),radial-gradient(ellipse 50% 35% at 20% 95%,rgba(110,10,25,.35),transparent 70%),
  radial-gradient(ellipse 35% 25% at 85% 90%,rgba(80,90,130,.12),transparent 70%),radial-gradient(ellipse 60% 40% at 50% 50%,rgba(30,20,40,.6),transparent 80%),
  radial-gradient(ellipse 50% 18% at 62% 4%,rgba(70,72,95,.28),transparent 70%),radial-gradient(ellipse 45% 16% at 15% 98%,rgba(90,15,30,.3),transparent 70%),
  linear-gradient(180deg,#07070b,#030304 60%,#020203)}
#sb-bracket .t8-glow{position:absolute;inset:0;background:radial-gradient(ellipse 45% 40% at var(--gx,70%) 0%,rgba(170,185,255,.22),transparent 70%);opacity:0;will-change:opacity}
#sb-bracket svg.t8-bolts{position:absolute;inset:0;width:${W}px;height:${H}px}
#sb-bracket svg.t8-bolts g{opacity:.16;will-change:opacity}
#sb-bracket svg.t8-bolts path{fill:none;stroke-linejoin:round;stroke-linecap:round}
#sb-bracket svg.t8-bolts .o{stroke:#5d6bd6;stroke-width:9;opacity:.35}
#sb-bracket svg.t8-bolts .m{stroke:#a9b6ff;stroke-width:3.5;opacity:.7}
#sb-bracket svg.t8-bolts .c{stroke:#eef2ff;stroke-width:1.4}
#sb-bracket svg.t8-bolts g.flick{animation:t8-flick .75s linear}
@keyframes t8-flick{0%{opacity:.16}8%{opacity:.95}16%{opacity:.25}26%{opacity:.85}40%{opacity:.3}100%{opacity:.16}}
#sb-bracket .t8-glow.flick{animation:t8-sky .75s linear}
@keyframes t8-sky{0%{opacity:0}8%{opacity:1}16%{opacity:.2}26%{opacity:.8}100%{opacity:0}}
#sb-bracket .t8-ghost{position:absolute;right:20px;top:60px;font:italic 800 470px/1 'Saira Condensed',Impact,sans-serif;color:transparent;-webkit-text-stroke:2px rgba(195,19,45,.13);letter-spacing:-10px;white-space:nowrap}
#sb-bracket .t8-head{position:absolute;left:64px;top:44px;display:flex;align-items:flex-end;gap:30px}
#sb-bracket .t8-t1{position:relative;font:italic 800 150px/.82 'Saira Condensed',Impact,sans-serif;letter-spacing:-2px;padding-right:10px;white-space:nowrap;
  background:linear-gradient(180deg,#fff 0%,#dfe2e8 38%,#7d818c 50%,#c9ccd4 70%,#8a1424 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 5px 0 #000) drop-shadow(0 0 30px rgba(195,19,45,.45))}
#sb-bracket .t8-t1 svg{position:absolute;left:-10px;top:-14px;width:330px;height:150px;overflow:visible}
#sb-bracket .t8-t1 svg path{fill:none;stroke:#fff;stroke-width:2;opacity:0;stroke-dasharray:1;stroke-dashoffset:1}
#sb-bracket .t8-ev{padding:0 0 10px 28px;border-left:3px solid var(--cr);display:flex;flex-direction:column;gap:8px}
#sb-bracket .t8-ev b{font:700 30px 'Chakra Petch',sans-serif;letter-spacing:8px;color:#e4e6ec;text-transform:uppercase;white-space:nowrap;max-width:1000px;overflow:hidden;text-overflow:ellipsis}
#sb-bracket .t8-ev small{font:600 17px 'Chakra Petch',sans-serif;letter-spacing:6px;color:var(--cr);text-transform:uppercase}
#sb-bracket .t8-lbl{position:absolute;font:800 italic 34px 'Saira Condensed',sans-serif;letter-spacing:4px;color:var(--cr);display:flex;align-items:center;gap:14px}
#sb-bracket .t8-lbl::after{content:'';width:260px;height:2px;background:linear-gradient(90deg,var(--cr),transparent)}
#sb-bracket .t8 svg.br-links path{fill:none;stroke:rgba(200,205,220,.14);stroke-width:2.5}
#sb-bracket .t8 svg.br-links path.hot{stroke:#e0263f;stroke-width:3}
#sb-bracket .t8 svg.br-links path.hotglow{stroke:#c3132d;stroke-width:10;opacity:.2}
#sb-bracket .t8 svg.br-links path.arc{stroke:#eef2ff;stroke-width:2;opacity:0}
#sb-bracket .t8 .ct{height:26px;font:700 13px 'Chakra Petch',sans-serif;letter-spacing:4px;color:#7d818c;white-space:nowrap;text-transform:uppercase}
#sb-bracket .t8 .bm-in{position:relative;background:linear-gradient(180deg,#121218,#060609 55%,#020203);clip-path:polygon(0 0,100% 0,calc(100% - 16px) 100%,0 100%);box-shadow:inset 0 0 0 1px rgba(195,19,45,.35);overflow:hidden}
#sb-bracket .t8 .bm-in::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:#2a2b31;z-index:1}
#sb-bracket .t8 .bm.st-done .bm-in::before{background:var(--cr)}
#sb-bracket .t8 .bm.st-wait .bm-in{opacity:.6}
#sb-bracket .t8 .bm.st-live .bm-in{box-shadow:inset 0 0 0 2px var(--cr2);background:linear-gradient(180deg,#2a0b12,#0d0407 60%,#050203)}
#sb-bracket .t8 .bm.st-live::before{content:'';position:absolute;left:-18px;right:-18px;top:10px;bottom:-18px;background:radial-gradient(ellipse at 50% 55%,rgba(224,38,63,.4),transparent 70%);will-change:opacity}
#sb-bracket .t8 .bm.st-next .bm-in{box-shadow:inset 0 0 0 1px rgba(201,212,255,.6)}
#sb-bracket .t8 .r{height:58px;display:flex;align-items:center;gap:12px;padding-left:12px;position:relative}
#sb-bracket .t8 .r+.r{border-top:1px solid rgba(255,255,255,.05)}
#sb-bracket .t8 .av{width:42px;height:42px;flex:none;position:relative;background:linear-gradient(160deg,#2a1218,#050506);clip-path:polygon(12% 0,100% 5%,90% 100%,0 90%);overflow:hidden}
#sb-bracket .t8 .av::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 2px rgba(195,19,45,.65)}
#sb-bracket .t8 .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#sb-bracket .t8 .av svg{position:absolute;left:3px;bottom:0;width:36px}
#sb-bracket .t8 .r.tbd .av{background:#0b0b0f}#sb-bracket .t8 .r.tbd .av::after{box-shadow:inset 0 0 0 1px #24252c}#sb-bracket .t8 .r.tbd .av svg{display:none}
#sb-bracket .t8 .r i{width:18px;flex:none;font:600 13px 'Chakra Petch',sans-serif;font-style:normal;color:#5d616c;text-align:right}
#sb-bracket .t8 .r b{flex:1;min-width:0;font:italic 800 30px/1.1 'Saira Condensed',sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#c2c5cd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:4px}
#sb-bracket .t8 .r em{width:58px;flex:none;height:100%;display:grid;place-items:center;font:700 30px 'Chakra Petch',sans-serif;font-style:normal;color:#8a8e99;background:rgba(0,0,0,.45)}
#sb-bracket .t8 .r.win b{background:linear-gradient(180deg,#fff,#d9dce3 50%,#9a9ea9);-webkit-background-clip:text;background-clip:text;color:transparent}
#sb-bracket .t8 .r.win em{color:#fff;background:linear-gradient(180deg,#e0263f,#5a0812);text-shadow:0 0 12px rgba(255,150,160,.8)}
#sb-bracket .t8 .r.lose b{color:#55585f;text-decoration:line-through rgba(195,19,45,.7) 2px}
#sb-bracket .t8 .r.lose .av{filter:grayscale(1) brightness(.5)}
#sb-bracket .t8 .r.tbd b{color:#3c3e46;letter-spacing:4px;font-style:normal}
#sb-bracket .t8 .st-live .r em{color:#fff}
#sb-bracket .t8 .br-tag{right:20px;top:2px;font-size:12px;letter-spacing:3px;padding:3px 10px 2px;background:var(--cr2);color:#fff}
#sb-bracket .t8 .br-tag.t2{background:#0b0c12;color:#c9d4ff;box-shadow:inset 0 0 0 1px #c9d4ff}
#sb-bracket .t8 svg.crackle{position:absolute;left:-6px;top:26px;width:calc(100% + 12px);height:calc(100% - 26px);overflow:visible;z-index:3}
#sb-bracket .t8 svg.crackle path{fill:none;stroke:#ffd0d6;stroke-width:1.6;filter:drop-shadow(0 0 4px #e0263f)}
#sb-bracket .t8 .gf8{position:absolute;filter:drop-shadow(0 0 40px rgba(195,19,45,.35))}
#sb-bracket .t8 .gf8 .gft{font:800 italic 46px 'Saira Condensed',sans-serif;letter-spacing:3px;text-align:center;white-space:nowrap;
  background:linear-gradient(180deg,#fff,#e0263f 70%,#5a0812);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:6px}
#sb-bracket .t8 .gf8 .cup{position:absolute;left:50%;margin-left:-60px;top:-150px;width:120px;filter:drop-shadow(0 0 22px rgba(224,38,63,.45))}
#sb-bracket .t8 .gf8 .bm{position:relative;margin-top:10px}
#sb-bracket .t8 .gf8 .bm-in{box-shadow:inset 0 0 0 2px rgba(224,38,63,.7)}
#sb-bracket .t8 .gf8 .r{height:72px}
#sb-bracket .t8 .t8-vign{position:absolute;inset:0;box-shadow:inset 0 0 220px 60px #000}
#sb-bracket .t8 .br-embers i{background:radial-gradient(circle,#ffd9de 0,#e0263f 35%,rgba(195,19,45,.4) 60%,transparent 72%)}
#sb-bracket .t8-strike{position:absolute;inset:0;width:${W}px;height:${H}px;z-index:18;opacity:0;will-change:opacity}
#sb-bracket .t8-strike .o{stroke:#7d8cff;stroke-width:26;opacity:.35}#sb-bracket .t8-strike .m{stroke:#c9d4ff;stroke-width:9}#sb-bracket .t8-strike .c{stroke:#fff;stroke-width:3.5}
#sb-bracket .t8-strike path{fill:none;stroke-linejoin:round;stroke-linecap:round}
#sb-bracket .t8-white{position:absolute;inset:0;z-index:17;background:radial-gradient(ellipse 60% 70% at 50% 25%,rgba(235,240,255,.95),rgba(150,165,255,.45) 45%,rgba(40,40,80,.2) 85%);opacity:0;will-change:opacity}

/* Top 8 idle */
#sb-bracket.br-show .t8 .bm.st-live::before{animation:br-throb 1.2s ease-in-out infinite}
/* Top 8 entrance: strike → title slams and cracks → cards drop in with a jolt */
#sb-bracket.br-in .t8 .t8-strike{animation:t8-strike 1s .05s linear both}
#sb-bracket.br-in .t8 .t8-white{animation:t8-white 1s .05s ease-out both}
@keyframes t8-strike{0%{opacity:0}4%{opacity:1}10%{opacity:.2}18%{opacity:1}34%{opacity:.8}60%{opacity:.25}100%{opacity:0}}
@keyframes t8-white{0%{opacity:0}4%{opacity:.7}10%{opacity:.08}18%{opacity:.5}26%{opacity:.04}100%{opacity:0}}
#sb-bracket.br-in .t8 .t8-sky,#sb-bracket.br-in .t8 .t8-ghost,#sb-bracket.br-in .t8 svg.t8-bolts{animation:br-fade .5s .15s both}
#sb-bracket.br-in .t8 .t8-head{animation:t8-slam .6s .32s cubic-bezier(.2,.9,.3,1.3) both}
#sb-bracket.br-in .t8 .t8-t1 svg path{animation:br-draw .25s .7s ease-out forwards,t8-crack 1.6s .7s ease-out forwards}
@keyframes t8-crack{0%{opacity:1}100%{opacity:.35}}
@keyframes t8-slam{from{opacity:0;transform:scale(2.6);filter:blur(8px) brightness(3)}60%{opacity:1;transform:scale(.94);filter:none}to{transform:none}}
#sb-bracket.br-in .t8 .t8-lbl{animation:br-fade .4s .75s both}
#sb-bracket.br-in .t8 .bm,#sb-bracket.br-in .t8 .gf8{animation:t8-drop .6s var(--d,.8s) both}
@keyframes t8-drop{0%{opacity:0;transform:translateY(-70px);filter:brightness(4) saturate(0)}40%{opacity:1;transform:translateY(10px);filter:brightness(2.4)}52%{transform:translate(-5px,-4px);filter:brightness(.6)}64%{transform:translate(4px,2px);filter:brightness(1.8)}78%{transform:translate(-2px,0);filter:brightness(1)}100%{transform:none;filter:none}}
#sb-bracket.br-in .t8 svg.br-links path{stroke-dasharray:1;animation:br-draw .4s var(--d,1.2s) ease-out both}
#sb-bracket.br-in .t8 .av{animation:t8-av .5s var(--d,1s) steps(1) both}
@keyframes t8-av{0%{opacity:0}20%{opacity:1}35%{opacity:.2}50%{opacity:1}65%{opacity:.4}80%{opacity:1}}
#sb-bracket.br-in .t8 .br-embers{animation:br-fade 1.4s .8s both}
#sb-bracket.br-in .t8 .t8-vign{animation:none}
#sb-bracket.t8-shake .br-stage{animation:t8-shake .4s linear}
@keyframes t8-shake{20%{transform:translate(8px,-5px)}40%{transform:translate(-7px,4px)}60%{transform:translate(5px,3px)}80%{transform:translate(-3px,-2px)}}
#sb-bracket.br-out .t8 .bm,#sb-bracket.br-out .t8 .gf8{animation:t8-fall .7s var(--fd,.1s) cubic-bezier(.5,0,.9,.5) forwards}
@keyframes t8-fall{to{transform:translateY(420px) rotate(var(--rot,8deg));opacity:0}}
#sb-bracket.br-out .t8 .t8-white{animation:t8-white .7s ease-out both}
#sb-bracket.br-out .t8 .t8-strike{animation:t8-strike .6s linear both}
#sb-bracket.br-out.t8m .br-stage{animation:br-fadeout .5s .45s forwards}

/* ---------------------------------------------------------------- pictures (profile or character art) */
#sb-bracket .pic{position:absolute;inset:0;overflow:hidden;background:linear-gradient(160deg,#2a1218,#050506)}
#sb-bracket .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
#sb-bracket .pic.char img{object-fit:contain;object-position:50% 100%}
#sb-bracket .pic svg{position:absolute;left:8%;bottom:0;width:84%}
#sb-bracket .pic .ch{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:4%;font:italic 800 var(--chs,16px)/.9 'Saira Condensed',sans-serif;text-transform:uppercase;color:rgba(255,255,255,.75);
  background:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 6px,transparent 6px 12px),linear-gradient(160deg,#3a1520,#0a0507);word-break:break-word}
#sb-bracket .sh .r .pv{position:relative;flex:none;width:calc(var(--fs,19px) * 1.9);height:calc(100% - 8px);clip-path:polygon(10% 0,100% 0,90% 100%,0 100%);margin-left:-4px}
#sb-bracket .sh .r.lose .pv{filter:grayscale(1) brightness(.55)}
#sb-bracket .sh .r.tbd .pv{display:none}

/* ---------------------------------------------------------------- Top 8 standings */
#sb-bracket .stn .sn{position:absolute;--pc:#c3132d}
#sb-bracket .stn .sn.p1{--pc:#f2c14e}#sb-bracket .stn .sn.p2{--pc:#d7dce6}#sb-bracket .stn .sn.p3{--pc:#d58b54}#sb-bracket .stn .sn.p4{--pc:#d58b54}
#sb-bracket .stn .sn-in{position:absolute;inset:0;background:linear-gradient(180deg,#141419,#060609 60%,#030304);clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,0 100%);box-shadow:inset 0 0 0 1px rgba(195,19,45,.35)}
#sb-bracket .stn .sn-in::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--pc);z-index:3}
#sb-bracket .stn .ph{position:absolute;left:0;top:0;bottom:0;clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}
#sb-bracket .stn .ph::after{content:'';position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,transparent 60%,rgba(3,3,4,.9))}
#sb-bracket .stn .pl{position:absolute;padding:.08em .1em 0 0;font:italic 800 var(--plf,64px)/1 'Saira Condensed',Impact,sans-serif;letter-spacing:-1px;white-space:nowrap;z-index:3;
  background:linear-gradient(180deg,#fff 0%,var(--pc) 55%,color-mix(in srgb,var(--pc) 40%,#000) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #000)}
#sb-bracket .stn .pl small{font-size:.46em;letter-spacing:0;vertical-align:.95em;margin-left:3px}
#sb-bracket .stn .nm{position:absolute;z-index:3;font:italic 800 var(--nmf,44px)/1.05 'Saira Condensed',sans-serif;text-transform:uppercase;color:#f2f3f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:.12em}
#sb-bracket .stn .tm{position:absolute;z-index:3;font:600 var(--tmf,16px) 'Chakra Petch',sans-serif;letter-spacing:4px;color:#8a8e99;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sb-bracket .stn .sn.hero .sn-in{box-shadow:inset 0 0 0 2px rgba(242,193,78,.75),0 0 60px rgba(242,193,78,.2)}
#sb-bracket .stn .sn.hero .ph{right:0;bottom:auto;height:560px;clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}
#sb-bracket .stn .sn.hero .ph::after{background:linear-gradient(180deg,transparent 55%,rgba(3,3,4,.95))}
#sb-bracket .stn .sn.tile .ph{right:0;bottom:auto;height:var(--phh,150px);clip-path:polygon(0 0,100% 0,100% 85%,0 100%)}
#sb-bracket .stn .sn.tile .ph::after{background:linear-gradient(180deg,transparent 55%,rgba(3,3,4,.95))}
#sb-bracket.br-sq .t8-ghost{display:none}
#sb-bracket .stn .crown{position:absolute;z-index:4;left:26px;top:-58px;width:96px;filter:drop-shadow(0 0 18px rgba(242,193,78,.6))}
#sb-bracket .stn .sn.empty{opacity:.3}
#sb-bracket .stn .glory{position:absolute;left:-200px;top:-200px;width:1000px;height:1000px;background:radial-gradient(circle,rgba(242,193,78,.18),transparent 60%);pointer-events:none}
#sb-bracket.br-in .stn .sn{animation:t8-drop .6s var(--d,.8s) both}
#sb-bracket.br-in .stn .sn.hero{animation:t8-slam .7s var(--d,.5s) cubic-bezier(.2,.9,.3,1.3) both}
#sb-bracket.br-out .stn .sn{animation:t8-fall .7s var(--fd,.1s) cubic-bezier(.5,0,.9,.5) forwards}
#sb-bracket.br-shot{z-index:2147483646}
#sb-bracket.br-shot .br-embers{display:none}

/* potato: everything still */
html.sb-potato #sb-bracket *,html.sb-potato #sb-bracket *::before,html.sb-potato #sb-bracket *::after{animation:none!important}
html.sb-potato #sb-bracket .br-embers,html.sb-potato #sb-bracket .br-spark{display:none}
`;
  // a round too big for one screen (a big viewer tournament): its matches as pages of cards
  const gridCss = `
#sb-bracket .gd{position:absolute;left:64px;right:64px;top:176px;bottom:70px;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:118px;gap:16px 22px;align-content:start}
#sb-bracket .gd-card{position:relative;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:10px 18px 10px 22px;background:linear-gradient(180deg,#1b1c22,#0a0b0e);clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)}
#sb-bracket .gd-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:16px;background:#ff5a1f;opacity:.35;clip-path:polygon(12px 0,16px 0,4px 100%,0 100%)}
#sb-bracket .gd-card.now{background:linear-gradient(180deg,#2c2216,#120c08)}#sb-bracket .gd-card.now::before{opacity:1}
#sb-bracket .gd-card.now::after{content:'ON STREAM';position:absolute;right:16px;top:8px;font:700 11px/1 'Chakra Petch',sans-serif;letter-spacing:3px;color:#ff5a1f}
#sb-bracket .gd-row{display:flex;align-items:center;gap:12px;font:italic 800 30px/1.15 'Saira Condensed',sans-serif;text-transform:uppercase;color:#d9dce4;white-space:nowrap}
#sb-bracket .gd-row b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:800;padding:0 .12em 0 0}
#sb-bracket .gd-row i{font-style:normal;font:700 26px/1 'Chakra Petch',sans-serif;color:#8d919d;min-width:22px;text-align:right}
#sb-bracket .gd-row.w b{color:#fff}#sb-bracket .gd-row.w i{color:#ff5a1f}#sb-bracket .gd-row.l{opacity:.45}#sb-bracket .gd-row.l b{text-decoration:line-through;text-decoration-color:#ff5a1f}
#sb-bracket .gd-row.bye{opacity:.35}
#sb-bracket .gd-pg{position:absolute;right:64px;bottom:30px;font:700 14px/1 'Chakra Petch',sans-serif;letter-spacing:4px;color:#8d919d;display:flex;gap:10px;align-items:center}
#sb-bracket .gd-pg b{color:#fff}#sb-bracket .gd-pg span{display:inline-block;width:120px;height:3px;background:rgba(255,255,255,.12);position:relative;overflow:hidden}
#sb-bracket .gd-pg span i{position:absolute;inset:0;background:#ff5a1f;transform-origin:left;animation:gd-bar var(--gd-ms,10s) linear infinite}
@keyframes gd-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
#sb-bracket .gd.has-tbl{right:600px;grid-template-columns:repeat(3,1fr)}
#sb-bracket .gd-stn{position:absolute;right:16px;top:8px;font:700 11px/1 'Chakra Petch',sans-serif;letter-spacing:3px;color:#4fd1ff}
#sb-bracket .gd-tbl{position:absolute;right:64px;top:176px;bottom:70px;width:500px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
#sb-bracket .gd-tbl table{width:100%;border-collapse:collapse;background:linear-gradient(180deg,#1b1c22,#0a0b0e)}
#sb-bracket .gd-tbl th{font:700 13px/1 'Chakra Petch',sans-serif;letter-spacing:3px;color:#8d919d;text-align:left;padding:10px 12px 6px}
#sb-bracket .gd-tbl td{font:italic 800 26px/1.2 'Saira Condensed',sans-serif;text-transform:uppercase;color:#d9dce4;padding:3px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}
#sb-bracket .gd-tbl td.n{font:700 22px/1 'Chakra Petch',sans-serif;color:#8d919d;text-align:right;width:56px}#sb-bracket .gd-tbl td.r{color:#ff5a1f;width:34px;text-align:left}#sb-bracket .gd-tbl td{vertical-align:middle}
#sb-bracket .gd-tbl tr.cut td.r{color:#2fd17a}#sb-bracket .gd-tbl.small td{font-size:21px}#sb-bracket .gd-tbl.small td.n{font-size:18px}
#sb-bracket .gd.turn{animation:gd-turn .5s cubic-bezier(.2,.8,.3,1)}@keyframes gd-turn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
`;
  const style = document.createElement('style'); style.textContent = css + gridCss; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'sb-bracket';
  const mount = () => document.body.appendChild(root);
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount, { once: true });

  // ======================================================================================= helpers
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const embersHtml = n => '<div class="br-embers">' + Array.from({ length: n }, () => {
    const s = 3 + Math.random() * 6;
    return `<i style="left:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--t:${(6 + Math.random() * 7).toFixed(1)}s;--d:${(-Math.random() * 12).toFixed(1)}s;--x:${((Math.random() - .5) * 120).toFixed(0)}px;--o:${(.4 + Math.random() * .5).toFixed(2)}"></i>`;
  }).join('') + '</div>';
  const SEAM = 'M1000,0 L1022,90 L978,180 L1012,270 L962,360 L1004,450 L960,540 L996,630 L952,720 L990,810 L946,900 L972,990 L940,1080';
  function bolt(x0, y0, x1, y1, seed, rough = 46, branches = 2) {
    const r = rng(seed), pts = [[x0, y0]], n = 9;
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + (r() - .5) * rough * 2, y0 + (y1 - y0) * k + (r() - .5) * rough * .5]); }
    pts.push([x1, y1]);
    const ds = ['M' + pts.map(p => p.map(v => v.toFixed(0)).join(',')).join('L')];
    for (let b = 0; b < branches; b++) {
      const i = 2 + Math.floor(r() * (n - 4)), p = pts[i], dir = r() < .5 ? -1 : 1;
      let x = p[0], y = p[1]; const seg = ['M' + x.toFixed(0) + ',' + y.toFixed(0)];
      for (let j = 0; j < 4; j++) { x += dir * (20 + r() * 40); y += 25 + r() * 40; seg.push('L' + x.toFixed(0) + ',' + y.toFixed(0)); }
      ds.push(seg.join(''));
    }
    return ds;
  }
  const boltG = (ds, cls = '') => `<g class="${cls}">${ds.map(d => `<path class="o" d="${d}"/><path class="m" d="${d}"/><path class="c" d="${d}"/>`).join('')}</g>`;
  const ordinal = n => { n = Number(n) || 0; const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return `${n}<small>${s.toUpperCase()}</small>`; };
  /** a player's picture: their start.gg profile picture, or their character's art (a picture tagged "character" in the
   *  designer's library) — falling back to the character's name, then to a silhouette */
  function pic(p, chs) {
    p = p || {};
    if (model && model.pics === 'character') {
      if (!p.character) return `<span class="pic">${silhouette}${p.avatar ? `<img alt="" src="${esc(p.avatar)}" onerror="this.remove()">` : ''}</span>`;   // no character known: their profile picture
      return `<span class="pic char" style="--chs:${chs || 16}px"><span class="ch">${esc(p.character)}</span>${p.charSlug ? `<img alt="" src="/assets/char/${encodeURIComponent(p.charSlug)}" onerror="this.remove()">` : ''}</span>`;
    }
    return `<span class="pic">${silhouette}${p.avatar ? `<img alt="" src="${esc(p.avatar)}" onerror="this.remove()">` : ''}</span>`;
  }
  const silhouette = '<svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7.5" fill="rgba(255,255,255,.55)"/><path d="M6 40c1.5-10 7-15 14-15s12.5 5 14 15z" fill="rgba(255,255,255,.55)"/></svg>';

  // ======================================================================================= data
  let model = window.__SB_BRACKET || null, sb = window.scoreboard || null;
  const SHOT = /[?&]shot=standings\b/.test(location.search);
  const SQUARE = SHOT && /[?&]sq=1\b/.test(location.search);   // the 1080 × 1080 picture (drawn in the middle of the stage)   // BeeboScore saving the standings as a picture
  let modelTried = !!model, pageStart = 0;
  // what the bracket looks like, minus the fetch time: a refresh that brings nothing new changes nothing on screen
  const sigModel = m => { if (!m) return ''; try { return JSON.stringify({ ...m, updatedAt: 0 }); } catch (e) { return String(Math.random()); } };
  let modelSig = sigModel(model);
  let mode = '', page = 'W', pageTimer = null, idleTimers = [], timers = [], lastKey = '', sigs = new Map(), crackleTimer = null;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const stopIdle = () => { idleTimers.forEach(t => { clearTimeout(t); clearInterval(t); }); idleTimers = []; if (crackleTimer) { clearInterval(crackleTimer); crackleTimer = null; } };

  // the set on stream right now gets the live scoreboard's scores
  function live(set) {
    if (!set || !sb || !sb.setId || String(sb.setId) !== String(set.id)) return set;
    const out = JSON.parse(JSON.stringify(set));
    const pick = side => {
      for (const k of ['p1', 'p2']) {
        const p = sb[k] || {};
        if ((p.sggId && String(p.sggId) === String(side.id)) || (!p.sggId && p.name && side.name && p.name.toLowerCase() === side.name.toLowerCase())) return Number(p.score) || 0;
      }
      return side.score;
    };
    out.a.score = pick(out.a); out.b.score = pick(out.b); out.live = true;
    return out;
  }
  function wanted() {
    const k = sb && sb.splash && sb.splash.show;
    if (SHOT) return 'standings';
    if (!k || !['bracket', 'top8', 'standings'].includes(k)) return '';   // the format splashes (fvs / fboard / fwin) are sb-format.js's
    if (k === 'top8' || k === 'standings') return k;
    if (model && model.autoTop8 !== false && model.top8 && model.top8.reached) return 'top8';
    return 'bracket';
  }
  const stateOf = s => s.live ? 'live' : (model && model.next && String(model.next) === String(s.id) && !s.done) ? 'next' : s.done ? 'done' : s.state === 'playing' ? 'playing' : 'wait';
  const scoreText = (p, s) => (p.score == null || (!s.done && !s.live && s.state !== 'playing')) ? '' : (p.score < 0 ? 'DQ' : p.score);

  // ======================================================================================= bracket (Shattered)
  function rowSh(p, s, pics) {
    const cls = 'r' + (p.win ? ' win' : '') + (p.lose ? ' lose' : '') + (!p.name ? ' tbd' : '');
    return `<div class="${cls}">${pics ? `<span class="pv">${pic(p, 9)}</span>` : ''}<i>${esc(p.seed || '')}</i><b data-t="${esc(p.name || 'TBD')}">${esc(p.name || 'TBD')}</b><em>${esc(scoreText(p, s))}</em></div>`;
  }
  function cardSh(s, x, y, w, h, fs, d) {
    const st = stateOf(s);
    const tag = st === 'live' ? '<span class="br-tag">ON STREAM</span>' : st === 'next' ? '<span class="br-tag t2">UP NEXT</span>' : '';
    return `<div class="bm st-${st}" data-id="${esc(s.id)}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;--fs:${fs.toFixed(1)}px;--d:${d.toFixed(2)}s">${tag}<div class="bm-in">${rowSh(s.a, s, h >= 58 && w >= 200)}${rowSh(s.b, s, h >= 58 && w >= 200)}</div></div>`;
  }
  const shortRound = n => String(n || '').replace(/Quarter-?Final/i, 'Quarters').replace(/Semi-?Final/i, 'Semis');
  // lay out one side (or both on one page); returns html + card boxes for the connectors
  function layoutSide(cols, x0, x1, y0, y1, delay0, boxes, out) {
    const C = cols.length; if (!C) return;
    const gapMin = 26, colW = Math.min(232, (x1 - x0 - gapMin * (C - 1)) / C);
    const gap = C > 1 ? Math.min(140, (x1 - x0 - colW * C) / (C - 1)) : 0;
    const maxN = Math.max(...cols.map(c => c.sets.length));
    const slot = (y1 - y0) / maxN, h = Math.max(38, Math.min(66, slot - 10)), fs = Math.max(13.5, Math.min(19, h * .29 + (colW < 200 ? -1 : 0)));
    cols.forEach((c, ci) => {
      const x = x0 + ci * (colW + gap), band = (y1 - y0) / c.sets.length;
      out.push(`<div class="sh-rh" style="left:${x.toFixed(0)}px;top:${(y0 - 34).toFixed(0)}px;width:${colW.toFixed(0)}px;--d:${(delay0 + ci * .08).toFixed(2)}s;${colW < 215 ? 'letter-spacing:1.6px;font-size:13px' : ''}">${esc(shortRound(c.name))}</div>`);
      c.sets.forEach((raw, i) => {
        const s = live(raw), y = y0 + band * i + band / 2 - h / 2;
        boxes.set(s.id, { x, y, w: colW, h, s });
        out.push(cardSh(s, x, y, colW, h, fs, delay0 + ci * .09 + i * .02));
      });
    });
    return colW;
  }
  function linksFor(boxes, extra) {
    const paths = [], hot = [];
    for (const [, b] of boxes) {
      const p = b.s.parent && (boxes.get(b.s.parent) || (extra && extra.get(b.s.parent)));
      if (!p) continue;
      const sx = b.x + b.w, sy = b.y + b.h / 2, ex = p.x, ey = p.y + (p.gfRow != null ? p.gfRow : p.h / 2), mx = Math.min(ex - 10, sx + Math.max(14, (ex - sx) / 2));
      const d = `M${sx.toFixed(0)},${sy.toFixed(0)}H${mx.toFixed(0)}V${ey.toFixed(0)}H${ex.toFixed(0)}`;
      const isHot = b.s.done;
      const dl = ((b.x - 64) / 1792 * 1.1 + .35).toFixed(2);
      paths.push({ d, hot: isHot, dl, from: b.s.id });
      if (isHot) hot.push(d);
    }
    return { paths, hot };
  }
  const GRID_PAGE = 24; let gridPage = 0, gridTimer = null;
  function renderGrid() {
    const m = model, g = m.grid, pages = Math.max(1, Math.ceil(g.sets.length / (g.table ? 15 : GRID_PAGE)));
    if (gridPage >= pages) gridPage = 0;
    const left = m.left != null ? m.left : m.entrants, nm = String(m.title || '').trim() || 'Tournament Bracket';
    const now = g.sets.findIndex(x => x.now); if (now >= 0 && !renderGrid.seen) { gridPage = Math.floor(now / (g.table ? 15 : GRID_PAGE)); renderGrid.seen = true; }
    const row = (x, k) => { const n = x[k], w = x.w === k, l = x.w && !w; return `<div class="gd-row${w ? ' w' : ''}${l ? ' l' : ''}${n === 'BYE' ? ' bye' : ''}"><b>${esc(n || 'TBD')}</b><i>${x.w ? esc(k === 'a' ? x.sa ?? (w ? 'W' : '') : x.sb ?? (w ? 'W' : '')) : ''}</i></div>`; };
    const per = g.table ? 15 : GRID_PAGE;
    const cards = g.sets.slice(gridPage * per, gridPage * per + per).map(x => `<div class="gd-card${x.now ? ' now' : ''}">${x.station && !x.now && !x.w ? `<span class="gd-stn">STATION ${esc(x.station)}</span>` : ''}${row(x, 'a')}${row(x, 'b')}</div>`).join('');
    const tblRows = rows => rows.map(r => `<tr class="${r.cut ? 'cut' : ''}"><td class="n r">${r.rank}</td><td>${esc(r.name)}</td><td class="n">${r.w}-${r.l}</td><td class="n">${r.gd > 0 ? '+' : ''}${r.gd}</td></tr>`).join('');
    const multi = g.table && g.table.length && g.table[0].rows;
    const tbl = !g.table ? '' : multi ? `<div class="gd-tbl small">${g.table.slice(0, 4).map(x => `<table><tr><th colspan="4">POOL ${esc(x.pool)}</th></tr>${tblRows(x.rows)}</table>`).join('')}</div>` : `<div class="gd-tbl"><table><tr><th colspan="2">STANDINGS</th><th style="text-align:right">W-L</th><th style="text-align:right">+/-</th></tr>${tblRows(g.table.slice(0, 12))}</table></div>`;
    const ms = Math.max(6, Number(m.pageEvery) || 10) * 1000;
    root.querySelector('.br-stage').innerHTML = `<div class="sh"><div class="sh-bg"></div><div class="sh-ghost">${esc(g.round)}</div>${embersHtml(20)}
      <div class="sh-head"><div class="sh-t1"><em class="sh-nm">${esc(nm)}</em><span class="sh-cnt">${left}</span><small class="sh-left">LEFT<br>OF ${m.entrants}</small></div><div class="sh-ev"><b>${esc(g.round)}</b><small>${g.sets.length} MATCHES · ${esc(g.kind || 'SINGLE ELIMINATION')}</small></div><div class="sh-live"><i></i>LIVE BRACKET</div></div>
      <div class="gd${g.table ? ' has-tbl' : ''}">${cards}</div>${tbl}${pages > 1 ? `<div class="gd-pg" style="--gd-ms:${ms}ms">PAGE <b>${gridPage + 1}</b> / ${pages}<span><i></i></span></div>` : ''}</div>`;
    clearTimeout(gridTimer);
    if (pages > 1) gridTimer = setTimeout(() => { if (!shown || !(model && model.grid)) return; gridPage = (gridPage + 1) % pages; renderGrid(); const gd = root.querySelector('.gd'); if (gd && !POTATO()) gd.classList.add('turn'); }, ms);
    return { boxes: new Map(), hot: [] };
  }
  function renderBracket() {
    const m = model, out = [], boxes = new Map(), gfBoxes = new Map();
    const de = m.type === 'DE', paged = !!m.paged && de;
    // "Top" only belongs to the Top 8 splash: the full bracket is the Tournament Bracket (or your own name), with how many are still in
    const left = m.left != null ? m.left : m.entrants, nm = String(m.title || '').trim() || 'Tournament Bracket';
    const title = `<em class="sh-nm">${esc(m.pool ? `${nm} · Pool ${m.pool}` : nm)}</em><span class="sh-cnt">${left}</span><small class="sh-left">${left === 1 ? 'CHAMPION<br>CROWNED' : `LEFT<br>OF ${m.entrants}`}</small>`;
    const typeTxt = de ? 'DOUBLE ELIMINATION' : m.type === 'SE' ? 'SINGLE ELIMINATION' : 'BRACKET';
    const evTitle = m.tournament || m.event || 'BRACKET';
    const sub = [m.game, m.phase && !/^bracket$/i.test(m.phase) ? m.phase : '', typeTxt].filter(Boolean).join(' · ');
    out.push(`<div class="sh-bg"></div><div class="sh-ghost">${paged ? (page === 'W' ? 'WINNERS' : 'LOSERS') : 'BRACKET'}</div><svg class="sh-seam" viewBox="0 0 ${W} ${H}"><path d="${SEAM}"/></svg>`);
    out.push(embersHtml(26));
    out.push(`<div class="sh-head"><div class="sh-t1">${title}</div><div class="sh-ev"><b>${esc(evTitle)}</b><small>${esc(sub)}</small></div>${paged ? '' : '<div class="sh-live"><i></i>LIVE BRACKET</div>'}</div>`);
    if (paged) out.push(`<div class="sh-pages"><b class="${page === 'W' ? 'on' : ''}">WINNERS</b><b class="${page === 'L' ? 'on' : ''}">LOSERS</b><span><i></i></span></div>`);
    const page$ = [];
    const gfSets = (m.gf || []).map(live);
    const gfShow = gfSets.length ? (gfSets[1] && (gfSets[1].a.name || gfSets[1].b.name) ? gfSets[1] : gfSets[0]) : null;
    const gfTitle = gfShow && gfSets[1] === gfShow ? 'GRAND FINAL RESET' : 'GRAND FINAL';
    const placeGF = (x, y) => {
      if (!gfShow) return;
      const rowH = 44, w = 250;
      gfBoxes.set(gfShow.id, { x, y, w, h: 36 + rowH * 2, gfRow: 36 + rowH, s: gfShow });
      for (const g of gfSets) gfBoxes.set(g.id, gfBoxes.get(gfShow.id));
      const st = stateOf(gfShow);
      page$.push(`<div class="gfwrap" style="left:${x}px;top:${y}px;--d:${paged ? .7 : 1.1}s"><div class="gfb"><div class="gfh">${gfTitle}</div><div class="bm st-${st}" data-id="${esc(gfShow.id)}" style="height:${rowH * 2}px;--fs:24px">${st === 'live' ? '<span class="br-tag" style="top:-56px">ON STREAM</span>' : ''}<div class="bm-in">${rowSh(gfShow.a, gfShow, true)}${rowSh(gfShow.b, gfShow, true)}</div></div></div></div>`);
    };
    if (!de) {
      layoutSide(m.winners, 64, 1856, 232, 1040, .35, boxes, page$);
    } else if (!paged) {
      const gfX = 1606, xr = gfShow ? gfX - 60 : 1856;
      page$.push(`<div class="sh-sec" style="top:150px">WINNERS</div><div class="sh-div" style="top:610px"></div><div class="sh-sec" style="top:622px">LOSERS</div>`);
      layoutSide(m.winners, 64, xr, 232, 560, .3, boxes, page$);
      layoutSide(m.losers, 64, xr, 710, 1040, .45, boxes, page$);
      placeGF(gfX, 520);
    } else if (page === 'W') {
      const gfX = 1606, xr = gfShow ? gfX - 60 : 1856;
      layoutSide(m.winners, 48, xr, 196, 1052, .3, boxes, page$);
      const wf = m.winners.length ? boxes.get(m.winners[m.winners.length - 1].sets[0].id) : null;
      placeGF(gfX, wf ? Math.round(wf.y + wf.h / 2 - 80) : 480);
    } else {
      layoutSide(m.losers, 48, 1872, 196, 1052, .3, boxes, page$);
    }
    if (!m.winners.length && !m.losers.length) page$.push('<div class="br-msg">The bracket hasn’t started yet</div>');
    const { paths, hot } = linksFor(boxes, gfBoxes);
    const svg = `<svg class="br-links" viewBox="0 0 ${W} ${H}">${paths.filter(p => p.hot).map(p => `<path class="hotglow" pathLength="1" d="${p.d}" style="--d:${p.dl}s"/>`).join('')}${paths.map(p => `<path class="${p.hot ? 'hot' : ''}" pathLength="1" d="${p.d}" style="--d:${p.dl}s" data-from="${esc(p.from)}"/>`).join('')}</svg>`;
    out.push(`<div class="br-page">${svg}${page$.join('')}<div class="br-sparks"></div></div>`);
    root.querySelector('.br-stage').innerHTML = `<div class="sh">${out.join('')}</div>`;
    return { boxes: new Map([...boxes, ...gfBoxes]), hot, paths };
  }

  // ======================================================================================= Top 8 (storm)
  function rowT8(p, s) {
    const cls = 'r' + (p.win ? ' win' : '') + (p.lose ? ' lose' : '') + (!p.name ? ' tbd' : '');
    return `<div class="${cls}"><span class="av" style="--d:inherit">${p.name ? pic(p, 11) : ''}</span><i>${esc(p.seed || '')}</i><b data-t="${esc(p.name || 'TBD')}">${esc(p.name || 'TBD')}</b><em>${esc(scoreText(p, s))}</em></div>`;
  }
  function cardT8(raw, x, y, title, d, boxes, w = 340) {
    const s = raw ? live(raw) : { id: 'x' + x + y, a: {}, b: {}, done: false, state: 'wait' };
    const st = raw ? stateOf(s) : 'wait';
    const tag = st === 'live' ? '<span class="br-tag">ON STREAM</span>' : st === 'next' ? '<span class="br-tag t2">UP NEXT</span>' : '';
    if (raw) boxes.set(s.id, { x, y, w, h: 142, s });
    const rot = ((Math.random() - .5) * 30).toFixed(0);
    return `<div class="bm st-${st}" data-id="${esc(s.id)}" style="left:${x}px;top:${y}px;width:${w}px;--d:${d.toFixed(2)}s;--fd:${(Math.random() * .25).toFixed(2)}s;--rot:${rot}deg"><div class="ct">${esc(title)}</div>${tag}<div class="bm-in">${rowT8(s.a || {}, s)}${rowT8(s.b || {}, s)}</div></div>`;
  }
  const CUP = `<svg class="cup" viewBox="0 0 120 120"><defs><linearGradient id="br-cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#9aa0ad"/><stop offset=".55" stop-color="#e1e4ea"/><stop offset="1" stop-color="#6d1220"/></linearGradient></defs>
<path d="M30 14h60v20a30 30 0 0 1-60 0z" fill="url(#br-cg)"/><path d="M30 22H14a16 16 0 0 0 18 22M90 22h16a16 16 0 0 1-18 22" fill="none" stroke="url(#br-cg)" stroke-width="6"/><rect x="52" y="62" width="16" height="22" fill="url(#br-cg)"/><rect x="36" y="84" width="48" height="12" rx="2" fill="url(#br-cg)"/><rect x="28" y="96" width="64" height="10" rx="2" fill="#5a0e19"/></svg>`;
  function renderTop8() {
    const m = model, t = (m && m.top8) || { type: 'DE', wsf: [], wf: [], lt8: [], lqf: [], lsf: [], lf: [], gf: [] };
    const boxes = new Map(), out = [], cards = [];
    const evTitle = (m && (m.tournament || m.event)) || 'TOP 8';
    const sub = [(m && m.game) || '', 'FINALS'].filter(Boolean).join(' · ');
    const bgBolts = [bolt(1320, -10, 1250, 470, 11, 40, 2), bolt(150, 280, 120, 560, 23, 30, 1), bolt(1330, 1090, 1290, 880, 37, 30, 1), bolt(520, -10, 600, 180, 41, 26, 1), bolt(1880, 520, 1800, 760, 53, 24, 1)];
    out.push(`<div class="t8-sky"></div><div class="t8-glow"></div><svg class="t8-bolts" viewBox="0 0 ${W} ${H}">${bgBolts.map(b => boltG(b)).join('')}</svg>`);
    out.push(`<div class="t8-ghost">TOP 8</div>${embersHtml(22)}`);
    const crack = 'M120,30 L150,62 L138,90 L170,118 M150,62 L188,56 M138,90 L108,112';
    out.push(`<div class="t8-head"><div class="t8-t1">TOP 8<svg viewBox="0 0 330 150"><path pathLength="1" d="${crack}"/></svg></div><div class="t8-ev"><b>${esc(evTitle)}</b><small>${esc(sub)}</small></div></div>`);
    const L = [];
    const ln = (d, hot, dl) => L.push({ d, hot, dl });
    const done = arr => arr && arr[0] && arr[0].done;
    if (t.type === 'SE') {
      out.push(`<div class="t8-lbl" style="left:120px;top:196px">QUARTER-FINALS</div>`);
      const qy = [250, 420, 640, 810];
      (t.qf || []).slice(0, 4).forEach((s, i) => cards.push(cardT8(s, 120, qy[i], 'QUARTER-FINAL', .8 + i * .08, boxes)));
      (t.sf || []).slice(0, 2).forEach((s, i) => cards.push(cardT8(s, 640, [335, 725][i], 'SEMI-FINAL', 1.15 + i * .1, boxes)));
      for (let i = 0; i < 4; i++) ln(`M460,${qy[i] + 84}H550V${[419, 809][i >> 1]}H640`, done([(t.qf || [])[i]]), 1.3);
      for (let i = 0; i < 2; i++) ln(`M980,${[419, 809][i]}H1080V614H1170`, done([(t.sf || [])[i]]), 1.5);
      const f = (t.f || [])[0];
      out.push(gf8(f, 1170, 420, 'FINAL', boxes));
    } else {
      out.push(`<div class="t8-lbl" style="left:470px;top:196px">WINNERS</div><div class="t8-lbl" style="left:40px;top:596px">LOSERS</div>`);
      const g = (a, i) => (a || [])[i] || null;
      cards.push(cardT8(g(t.wsf, 0), 470, 250, 'WINNERS SEMIS', .8, boxes), cardT8(g(t.wsf, 1), 470, 420, 'WINNERS SEMIS', .88, boxes));
      cards.push(cardT8(g(t.wf, 0), 930, 335, 'WINNERS FINAL', 1.05, boxes));
      cards.push(cardT8(g(t.lt8, 0), 40, 650, 'LOSERS ROUND 1', .95, boxes), cardT8(g(t.lt8, 1), 40, 820, 'LOSERS ROUND 1', 1.02, boxes));
      cards.push(cardT8(g(t.lqf, 0), 470, 650, 'LOSERS QUARTERS', 1.1, boxes), cardT8(g(t.lqf, 1), 470, 820, 'LOSERS QUARTERS', 1.17, boxes));
      cards.push(cardT8(g(t.lsf, 0), 930, 735, 'LOSERS SEMIS', 1.25, boxes), cardT8(g(t.lf, 0), 1390, 735, 'LOSERS FINAL', 1.35, boxes));
      ln('M810,334H870V419H930', done([g(t.wsf, 0)]), 1.2); ln('M810,504H870V419H930', done([g(t.wsf, 1)]), 1.2);
      ln('M380,734H470', done([g(t.lt8, 0)]), 1.2); ln('M380,904H470', done([g(t.lt8, 1)]), 1.25);
      ln('M810,734H870V819H930', done([g(t.lqf, 0)]), 1.35); ln('M810,904H870V819H930', done([g(t.lqf, 1)]), 1.35);
      ln('M1270,819H1390', done([g(t.lsf, 0)]), 1.45);
      ln('M1270,419H1400V342H1470', done([g(t.wf, 0)]), 1.5); ln('M1730,819H1898V414H1856', done([g(t.lf, 0)]), 1.55);
      const gfs = (t.gf || []);
      const showReset = gfs[1] && (gfs[1].a.name || gfs[1].b.name);
      out.push(gf8(showReset ? gfs[1] : gfs[0], 1470, 240, showReset ? 'GRAND FINAL RESET' : 'GRAND FINAL', boxes));
    }
    out.push(`<svg class="br-links" viewBox="0 0 ${W} ${H}">${L.filter(l => l.hot).map(l => `<path class="hotglow" pathLength="1" d="${l.d}" style="--d:${l.dl}s"/>`).join('')}${L.map(l => `<path class="${l.hot ? 'hot' : ''}" pathLength="1" d="${l.d}" style="--d:${l.dl}s"/>`).join('')}<path class="arc" d=""/></svg>`);
    out.push(cards.join(''));
    out.push(`<div class="t8-vign"></div><div class="t8-white"></div><svg class="t8-strike" viewBox="0 0 ${W} ${H}">${boltG(bolt(980, -20, 900, 1100, Math.floor(Math.random() * 1e6), 90, 4)).replace('<g class="">', '<g>')}</svg>`);
    root.querySelector('.br-stage').innerHTML = `<div class="t8">${out.join('')}</div>`;
    fitNames('.t8 .r b', 20);
    return { boxes, hot: L.filter(l => l.hot).map(l => l.d) };
  }
  function gf8(raw, x, y, title, boxes) {
    const s = raw ? live(raw) : null, st = s ? stateOf(s) : 'wait';
    if (s) boxes.set(s.id, { x, y: y + 76, w: 400, h: 144, s });
    const tag = st === 'live' ? '<span class="br-tag" style="top:-30px">ON STREAM</span>' : st === 'next' ? '<span class="br-tag t2" style="top:-30px">UP NEXT</span>' : '';
    const S = s || { a: {}, b: {} };
    return `<div class="gf8" style="left:${x}px;top:${y}px;width:400px;--d:1.5s">${CUP}<div class="gft">${title}</div><div class="bm st-${st}" data-id="${esc(s ? s.id : '')}" style="width:400px">${tag}<div class="bm-in">${rowT8(S.a || {}, S)}${rowT8(S.b || {}, S)}</div></div></div>`;
  }

  // ======================================================================================= Top 8 standings
  function renderStandings() {
    const m = model || {}, list = (m.standings || []).slice(0, 8);
    const evTitle = String(m.title || m.tournament || m.event || '').trim() || 'TOURNAMENT';
    const sub = [m.game || '', 'FINAL STANDINGS', m.entrants ? `${m.entrants} PLAYERS` : ''].filter(Boolean).join(' · ');
    const out = [];
    const bgBolts = [bolt(1320, -10, 1250, 470, 11, 40, 2), bolt(150, 280, 120, 560, 23, 30, 1), bolt(1330, 1090, 1290, 880, 37, 30, 1), bolt(1880, 520, 1800, 760, 53, 24, 1)];
    out.push(`<div class="t8-sky"></div><div class="t8-glow"></div><svg class="t8-bolts" viewBox="0 0 ${W} ${H}">${bgBolts.map(b => boltG(b)).join('')}</svg><div class="t8-ghost">TOP 8</div>${embersHtml(18)}`);
    const ox = SQUARE ? 420 : 0;
    out.push(`<div class="t8-head" style="${SQUARE ? `left:${ox + 48}px;top:40px` : ''}"><div class="t8-t1">TOP 8</div><div class="t8-ev"><b>${esc(evTitle)}</b><small>${esc(sub)}</small></div></div>`);
    const card = (p, cls, x, y, w, h, d, ph, f) => {
      if (!p) return `<div class="sn empty ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--d:${d}s"><div class="sn-in"></div></div>`;
      const place = Number(p.place) || 0, pc = place === 1 ? 'p1' : place === 2 ? 'p2' : place === 3 ? 'p3' : place === 4 ? 'p4' : '';
      return `<div class="sn ${cls} ${pc}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--d:${d}s;--fd:${(Math.random() * .25).toFixed(2)}s;--plf:${f.pl}px;--nmf:${f.nm}px;--tmf:${f.tm}px">
        ${cls === 'hero' ? '<div class="glory"></div>' + CROWN : ''}<div class="sn-in"><span class="ph" style="${ph}">${pic(p, f.ch)}</span>
        <span class="pl" style="${f.plPos}">${ordinal(place)}</span><span class="nm" data-t="${esc(p.name)}" style="${f.nmPos}">${esc(p.name)}</span>${p.team ? `<span class="tm" style="${f.tmPos}">${esc(p.team)}</span>` : ''}</div></div>`;
    };
    const parts = [];
    if (SQUARE) {
      root.classList.add('br-sq');
      parts.push(card(list[0], 'hero', ox + 48, 226, 500, 548, .55, 'height:360px', { pl: 110, nm: 50, tm: 15, ch: 48, plPos: 'left:22px;top:300px', nmPos: 'left:28px;right:36px;top:420px', tmPos: 'left:30px;right:36px;top:486px' }));
      for (let i = 1; i < 4; i++) parts.push(card(list[i], 'mid', ox + 572, 226 + (i - 1) * 186, 460, 172, .8 + i * .1, 'width:172px', { pl: 64, nm: 36, tm: 13, ch: 22, plPos: 'left:186px;top:10px', nmPos: 'left:188px;right:30px;top:86px', tmPos: 'left:190px;right:30px;top:134px' }));
      for (let i = 4; i < 8; i++) parts.push(card(list[i], 'low tile', ox + 48 + (i - 4) * 248, 800, 232, 236, 1.15 + (i - 4) * .08, '--phh:140px', { pl: 46, nm: 28, tm: 12, ch: 18, plPos: 'left:14px;top:112px', nmPos: 'left:16px;right:26px;top:164px', tmPos: 'left:16px;right:26px;top:202px' }));
    } else {
    // 1st: the hero
    parts.push(card(list[0], 'hero', 64, 236, 600, 790, .55, '', { pl: 150, nm: 64, tm: 18, ch: 64, plPos: 'left:26px;top:470px', nmPos: 'left:34px;right:44px;top:650px', tmPos: 'left:36px;right:44px;top:732px' }));
    // 2nd–4th
    for (let i = 1; i < 4; i++) parts.push(card(list[i], 'mid', 704, 236 + (i - 1) * 270, 560, 250, .8 + i * .1, 'width:250px', { pl: 88, nm: 46, tm: 15, ch: 30, plPos: 'left:266px;top:16px', nmPos: 'left:268px;right:34px;top:122px', tmPos: 'left:270px;right:34px;top:178px' }));
    // 5th–8th
    for (let i = 4; i < 8; i++) parts.push(card(list[i], 'low', 1304, 236 + (i - 4) * 199, 552, 179, 1.15 + (i - 4) * .08, 'width:179px', { pl: 62, nm: 38, tm: 14, ch: 22, plPos: 'left:196px;top:12px', nmPos: 'left:198px;right:34px;top:88px', tmPos: 'left:200px;right:34px;top:136px' }));
    }
    out.push(`<div class="stn">${parts.join('')}</div>`);
    if (!list.length) out.push('<div class="br-msg">No standings yet</div>');
    out.push(`<div class="t8-vign"></div><div class="t8-white"></div><svg class="t8-strike" viewBox="0 0 ${W} ${H}">${boltG(bolt(980, -20, 900, 1100, Math.floor(Math.random() * 1e6), 90, 4)).replace('<g class="">', '<g>')}</svg>`);
    root.querySelector('.br-stage').innerHTML = `<div class="t8">${out.join('')}</div>`;
    fitNames('.stn .nm', 22);
    return { boxes: new Map(), hot: [] };
  }
  const CROWN = `<svg class="crown" viewBox="0 0 100 64"><defs><linearGradient id="br-crg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#7a5310"/></linearGradient></defs><path d="M6 58 2 14l24 20L50 4l24 30 24-20-4 44z" fill="url(#br-crg)" stroke="#2a1a04" stroke-width="2"/><circle cx="50" cy="40" r="6" fill="#c3132d"/></svg>`;
  // a still picture of the standings: say when it's ready (fonts and pictures in)
  function shotReady() {
    root.classList.add('br-shot');
    window.__SB_SHOT_READY = false;
    const imgs = [...root.querySelectorAll('img')];
    Promise.all([document.fonts ? document.fonts.ready : null, ...imgs.map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 4000); }))])
      .then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => { fitNames('.stn .nm', 22); window.__SB_SHOT_READY = true; });
  }

  // shrink a long name until it fits its card (measured with the real name, not a decoding scramble)
  function fitNames(sel, min) {
    for (const el of root.querySelectorAll(sel)) {
      if (!el.dataset.t || el.dataset.t === 'TBD') continue;
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize) || 30;
      while (el.scrollWidth > el.clientWidth + 1 && size > min) { size -= 1; el.style.fontSize = size + 'px'; }
    }
  }
  // ======================================================================================= effects
  function decodeAll(delayBase) {
    if (POTATO()) return;
    const els = [...root.querySelectorAll('.r b[data-t]')].filter(el => el.dataset.t !== 'TBD');
    const t0 = performance.now();
    const items = els.map(el => {
      const card = el.closest('[style*="--d"]'), d = card ? parseFloat(getComputedStyle(card).getPropertyValue('--d')) || 0 : 0;
      return { el, start: t0 + (delayBase + d) * 1000, final: el.dataset.t };
    });
    const step = () => {
      if (!root.classList.contains('br-show')) return;
      const now = performance.now(); let busy = false;
      for (const it of items) {
        const k = (now - it.start) / 420;
        if (k >= 1) { if (it.el.textContent !== it.final) it.el.textContent = it.final; continue; }
        busy = true;
        if (k > 0) it.el.textContent = [...it.final].map((c, i) => c === ' ' || i < k * it.final.length ? c : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
      }
      if (busy) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function settleText() { root.querySelectorAll('.r b[data-t]').forEach(el => { el.textContent = el.dataset.t; }); }
  function spark(d, delay, dur) {
    if (POTATO() || !d) return;
    const host = root.querySelector('.br-sparks') || root.querySelector('.br-stage > div');
    if (!host) return;
    const s = document.createElement('i'); s.className = 'br-spark';
    s.style.offsetPath = `path('${d}')`; s.style.setProperty('--dl', (delay || 0) + 's'); s.style.setProperty('--t', (dur || .9) + 's');
    host.appendChild(s);
    setTimeout(() => s.remove(), ((delay || 0) + (dur || .9)) * 1000 + 100);
  }
  function arc(fromBox, toBox) {          // Top 8: a bolt jumps from a finished match to the next one
    if (POTATO() || !fromBox || !toBox) return;
    const p = root.querySelector('.t8 svg.br-links path.arc'); if (!p) return;
    const ds = bolt(fromBox.x + fromBox.w, fromBox.y + 84, toBox.x, toBox.y + 84, Math.random() * 1e6 | 0, 22, 0);
    p.setAttribute('d', ds[0]);
    p.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: .2 }, { opacity: .9 }, { opacity: 0 }], { duration: 520 });
  }
  function flare(id) { const el = root.querySelector(`.bm[data-id="${CSS.escape(String(id))}"]`); if (!el) return; el.classList.remove('br-flare'); void el.offsetWidth; el.classList.add('br-flare'); }
  function crackle() {                    // Top 8: red electricity around the match on stream
    if (crackleTimer) { clearInterval(crackleTimer); crackleTimer = null; }
    const card = root.querySelector('.t8 .bm.st-live'); if (!card || POTATO()) return;
    const w = card.offsetWidth, h = card.offsetHeight - 26;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'crackle'); svg.setAttribute('viewBox', `-6 0 ${w + 12} ${h}`);
    card.appendChild(svg);
    const jag = () => {
      const pts = [], per = 2 * (w + h), n = 5 + (Math.random() * 3 | 0);
      let html = '';
      for (let k = 0; k < n; k++) {
        let t = Math.random() * per; const len = 30 + Math.random() * 60, seg = [];
        for (let j = 0; j <= 5; j++) {
          const u = (t + len * j / 5) % per, off = (Math.random() - .5) * 8;
          let x, y;
          if (u < w) { x = u; y = off; } else if (u < w + h) { x = w + off; y = u - w; } else if (u < 2 * w + h) { x = w - (u - w - h); y = h + off; } else { x = off; y = h - (u - 2 * w - h); }
          seg.push(x.toFixed(0) + ',' + y.toFixed(0));
        }
        html += `<path d="M${seg.join('L')}"/>`;
      }
      svg.innerHTML = html;
      svg.style.opacity = Math.random() < .25 ? 0 : (.5 + Math.random() * .5);
    };
    jag(); crackleTimer = setInterval(jag, 110);
  }

  // ======================================================================================= show / hide
  let shown = '', info = null;
  function draw() {
    stopIdle();
    if (!root.querySelector('.br-stage')) root.innerHTML = '<div class="br-stage"></div><svg class="br-break" viewBox="0 0 1920 1080"></svg><div class="br-flash"></div>';
    if (mode === 'top8') info = renderTop8();
    else if (mode === 'standings') info = renderStandings();
    else if (model && model.grid) info = renderGrid();
    else if (model) info = renderBracket();
    else { root.querySelector('.br-stage').innerHTML = `<div class="sh"><div class="sh-bg"></div><div class="br-msg">${modelTried ? 'Load a start.gg bracket or start a viewer tournament in BeeboScore' : ''}</div></div>`; info = { boxes: new Map(), hot: [] }; }
    root.classList.toggle('t8m', mode === 'top8' || mode === 'standings');
    lastKey = keyNow();
    rememberSigs();
    if (SHOT) { shotReady(); return; }
    if (POTATO()) return;
    // idle life
    if (mode === 'top8' || mode === 'standings') {
      crackle();
      const flickNext = () => {
        const gs = root.querySelectorAll('.t8 svg.t8-bolts g'), glow = root.querySelector('.t8-glow');
        if (gs.length) {
          const i = Math.random() * gs.length | 0, g = gs[i];
          g.classList.remove('flick'); g.getBoundingClientRect(); g.classList.add('flick');
          if (glow) { glow.style.setProperty('--gx', ['68%', '8%', '70%', '28%', '96%'][i] || '60%'); glow.classList.remove('flick'); void glow.offsetWidth; glow.classList.add('flick'); }
          idleTimers.push(setTimeout(() => { g.classList.remove('flick'); glow && glow.classList.remove('flick'); }, 800));
        }
        idleTimers.push(setTimeout(flickNext, 2600 + Math.random() * 4200));
      };
      idleTimers.push(setTimeout(flickNext, 2200));
    } else {
      const sparkNext = () => {
        const hot = (info && info.hot) || [];
        if (hot.length) spark(hot[Math.random() * hot.length | 0], 0, .8);
        idleTimers.push(setTimeout(sparkNext, 1600 + Math.random() * 1800));
      };
      idleTimers.push(setTimeout(sparkNext, 2600));
      if (model && model.paged && mode === 'bracket') schedulePage(); else stopPages();
    }
  }
  // Winners / Losers pages: BeeboScore keeps the clock (Settings: seconds per side, or manual only) and
  // sends the side in the scoreboard state, so every overlay turns together. This only animates the turn
  // and the little progress bar.
  const wantSide = () => (sb && sb.splash && sb.splash.side === 'L' ? 'L' : 'W');
  const sideKey = () => (sb && sb.splash ? `${sb.splash.side}|${sb.splash.n}` : '');
  let shownSideKey = '', turning = false, pending = false;
  function settled() { if (pending) { pending = false; update(); } }
  function stopPages() { if (pageTimer) { clearTimeout(pageTimer); pageTimer = null; } }
  function schedulePage() {                // redraws don't restart the bar
    const bar = root.querySelector('.sh-pages span'), ms = (Number(model && model.pageEvery) || 0) * 1000;
    if (!bar) return;
    bar.style.display = ms ? '' : 'none';
    if (!ms) return;
    const left = Math.max(0, ms - (performance.now() - pageStart));
    const i = bar.querySelector('i');
    if (i) i.animate([{ transform: `scaleX(${(1 - left / ms).toFixed(3)})` }, { transform: 'scaleX(1)' }], { duration: left, easing: 'linear', fill: 'forwards' });
  }
  function turnPage() {                    // the side changed (clock, button or Stream Deck): crack out, slam in
    if (turning) return;
    shownSideKey = sideKey(); pageStart = performance.now();
    const to = wantSide();
    if (to === page) { draw(); return; }   // same side again: just restart the bar
    if (POTATO()) { page = to; draw(); return; }
    turning = true;
    const pg = root.querySelector('.br-page'); if (pg) pg.classList.add('br-pg-out');
    later(() => {
      turning = false;
      if (!shown || mode !== 'bracket') return;
      page = wantSide();
      root.classList.add('br-pg');
      draw();
      decodeAll(0);
      flash();
      later(() => { root.classList.remove('br-pg'); settled(); }, 2600);
      if (sideKey() !== shownSideKey) turnPage();
    }, 420);
  }
  function flash(op) { root.classList.remove('br-flashing'); void root.offsetWidth; root.classList.add('br-flashing'); later(() => root.classList.remove('br-flashing'), 600); }
  function show(kind, instant) {
    clearTimers(); stopPages(); turning = false; pending = false;
    mode = kind; shown = kind;
    page = kind === 'bracket' && model && model.paged ? wantSide() : 'W'; shownSideKey = sideKey(); pageStart = performance.now();
    document.documentElement.classList.add('sb-bracket-on');
    root.classList.remove('br-out', 'br-in', 'br-pg', 't8-shake');
    root.classList.add('br-show');
    draw();
    if (instant || POTATO()) return;
    void root.offsetWidth;
    root.classList.add('br-in');
    if (kind === 'top8' || kind === 'standings') { later(() => { root.classList.add('t8-shake'); }, 60); later(() => root.classList.remove('t8-shake'), 520); decodeAll(.15); }
    else { flash(); decodeAll(.1); later(() => { (info.hot || []).slice(0, 40).forEach((d, i) => spark(d, .2 + i * .03, .8)); }, 900); }
    later(() => { root.classList.remove('br-in'); settled(); }, kind === 'top8' || kind === 'standings' ? 2600 : 2400);
  }
  function hide(instant) {
    clearTimers(); stopIdle(); stopPages(); turning = false; pending = false;
    shown = '';
    document.documentElement.classList.remove('sb-bracket-on');
    if (instant || POTATO() || !root.classList.contains('br-show')) { root.className = ''; root.innerHTML = ''; return; }
    settleText();
    root.classList.remove('br-in', 'br-pg');
    const br = root.querySelector('svg.br-break');
    if (br && mode !== 'top8' && mode !== 'standings') {
      const r = rng(Math.random() * 1e6 | 0); let d = '';
      for (let a = 0; a < 12; a++) { const ang = a / 12 * 6.283 + r() * .4; let x = 960, y = 540, s = 'M960,540'; for (let j = 0; j < 5; j++) { x += Math.cos(ang) * (140 + r() * 120) + (r() - .5) * 60; y += Math.sin(ang) * (90 + r() * 80) + (r() - .5) * 40; s += `L${x.toFixed(0)},${y.toFixed(0)}`; } d += `<path pathLength="1" d="${s}"/>`; }
      br.innerHTML = d;
    }
    root.classList.add('br-out');
    if (mode !== 'top8' && mode !== 'standings') flash();
    later(() => { if (!shown) { root.className = ''; root.innerHTML = ''; } }, mode === 'top8' || mode === 'standings' ? 1000 : 800);
  }
  // re-draw only when something it shows changed; flare matches whose result changed
  const keyNow = () => {
    const live = sb && sb.setId ? [sb.setId, sb.p1 && sb.p1.score, sb.p2 && sb.p2.score, sb.p1 && sb.p1.sggId, sb.p2 && sb.p2.sggId].join('|') : '';
    return [mode, page, modelSig, live].join('#');
  };
  function sigOf(s) { return [s.a.id, s.a.score, s.b.id, s.b.score, s.done].join('|'); }
  function currentSets() {
    if (!model) return [];
    const list = [...model.winners.flatMap(c => c.sets), ...model.losers.flatMap(c => c.sets), ...(model.gf || [])];
    return list.map(live);
  }
  function rememberSigs() { sigs = new Map(currentSets().map(s => [s.id, sigOf(s)])); }
  function update() {
    const want = wanted();
    if (!want) { if (shown) hide(false); return; }
    if (!shown && !model && !modelTried) return;   // wait for the bracket first, so it opens in the right design
    if (!shown) { show(want, false); return; }
    if (want !== mode) {                       // e.g. Top 8 just reached: break out the bracket, storm in the Top 8
      hide(false);
      later(() => show(want, false), 650);
      return;
    }
    if (mode === 'bracket' && model && model.paged && sideKey() !== shownSideKey) { turnPage(); return; }
    if (keyNow() === lastKey) return;
    // never rebuild in the middle of the entrance or a page turn (that replays the whole animation):
    // hold the new results and apply them the moment it settles, flaring only what changed
    if (turning || root.classList.contains('br-in') || root.classList.contains('br-pg')) { pending = true; return; }
    const before = sigs;
    draw();
    for (const s of currentSets()) {
      const old = before.get(s.id);
      if (old === undefined || old === sigOf(s)) continue;
      flare(s.id);
      const b = info.boxes.get(s.id), p = b && s.parent && info.boxes.get(s.parent);
      if (s.done && b && p) {
        if (mode === 'top8') arc(b, p);
        else { const path = root.querySelector(`svg.br-links path[data-from="${CSS.escape(String(s.id))}"]`); if (path) spark(path.getAttribute('d'), 0, .9); }
      }
    }
  }

  let booted = false;
  addEventListener('scoreboard', e => {
    sb = e.detail || sb;
    if (!booted) {                          // page opened with a splash already up (OBS refresh, seamless swap)
      booted = true;
      if (!model) fetchModel();
      const want = wanted();
      if (want && (model || modelTried)) show(want, !!window.__SB_INSTANT || SHOT);
      else if (want) bootInstant = !!window.__SB_INSTANT;
      return;
    }
    if (wanted() && !model && !modelTried) fetchModel();
    update();
  });
  let bootInstant = false;
  addEventListener('scoreboard:bracket', e => { model = e.detail; modelSig = sigModel(model); modelTried = true; arrived(); });
  function arrived() {
    if (!shown && booted && wanted() && (bootInstant || SHOT)) { bootInstant = false; show(wanted(), true); return; }
    update();
  }
  let fetching = false;
  function fetchModel() {
    if (fetching) return; fetching = true;
    fetch('/api/bracket/data', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
      .then(d => { fetching = false; if (d) { model = d; modelSig = sigModel(d); } modelTried = true; arrived(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (shown && (root.classList.contains('br-in') || turning)) { clearTimers(); turning = false; root.classList.remove('br-in', 'br-pg'); settleText(); if (mode === 'bracket') { page = model && model.paged ? wantSide() : 'W'; draw(); } pending = false; }
    if (!shown && root.className) { clearTimers(); root.className = ''; root.innerHTML = ''; }
  });
  window.BeeboBracket = { show: k => show(k || 'bracket', false), hide: () => hide(false), get model() { return model; } };
})();
