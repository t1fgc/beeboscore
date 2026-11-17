/* BeeboScore (developed by Beebo) — FullVS for Obsidian Glass and Porcelain (Testbuild 1.12.6).
 *
 * Two slabs of glass glide together along a diagonal seam (1.12.17: the GlassVS way — out of a haze, a little past each other
 * and back); where they meet a line of light flares along the seam and melds into it, and a light runs down the join. Each player's picture fills their slab (sized and placed as set in the app — FullVS, GlassVS and the
 * PlayerCards share it) with the name on a plate UNDER the picture, never over it. The round sits at the top.
 * Smooth on purpose: everything that moves moves by transform and opacity only, on layers the graphics card already has —
 * no blurs, no filters or shadows changing while it plays, no particles.
 *
 * Shown for state.vs.show in the layouts whose <meta name="sb-look"> is "shattered" (Obsidian Glass) or "porcelain"; a
 * running game format draws its own VS (sb-format.js) and this one steps aside, like the classic one.
 */
(() => {
  'use strict';
  if (window.__SB_FULLVS_LOADED) return; window.__SB_FULLVS_LOADED = true;
  const LOOK = String(((document.querySelector('meta[name="sb-look"]') || {}).content || '')).toLowerCase();
  if (!['shattered', 'porcelain'].includes(LOOK)) return;
  window.__SB_FULLVS = true;                 // the Layout Designer's own VS screen steps aside (sb-design.js)
  const PORC = LOOK === 'porcelain';
  const W = 1920, H = 1080, SX0 = 760, SX1 = 1160;            // the seam: (760,1080) → (1160,0)
  const ANG = Math.atan2(H, SX1 - SX0) * 180 / Math.PI, SEAM = Math.hypot(SX1 - SX0, H);
  const C = PORC
    ? { a: '#c9a13b', b: '#141210', faceL: 'linear-gradient(160deg,#ffffff,#f6f0e2 55%,#e6d8b4)', faceR: 'linear-gradient(200deg,#fbf8f1,#efe6d2 55%,#dccaa0)', plate: 'linear-gradient(180deg,#1b1916,#0c0b0a)', plateEdge: '#c9a13b', name: 'linear-gradient(180deg,#fff6d8,#e9c35e 55%,#a8801c)', small: '#e9c35e', vs: 'linear-gradient(180deg,#2a2522,#0b0909 55%,#3a2806)', vsGlow: 'rgba(201,161,59,.55)', weld: ['#c9a13b', '#fff6d8', '#c9a13b'], ghost: 'rgba(20,18,16,.08)', round: 'rgba(20,18,16,.92)', roundInk: '#f6e7b8', chip: 'linear-gradient(135deg,#ffffff,#f3ecdc 45%,#c9a13b)' }
    : { a: '#e0a93b', b: '#f6dc96', faceL: 'linear-gradient(160deg,#2b2112,#100c06 55%,#060504)', faceR: 'linear-gradient(200deg,#22190a,#0d0b07 55%,#040408)', plate: 'linear-gradient(180deg,rgba(42,38,30,.94),rgba(11,10,8,.97))', plateEdge: '#e0a93b', name: 'linear-gradient(180deg,#fff,#f3ede0 45%,#b9ad92)', small: '#f0c766', vs: 'linear-gradient(180deg,#fff,#f2ebdb 40%,#d4c7a6 55%,#e0a93b 80%,#f6dc96)', vsGlow: 'rgba(224,169,59,.6)', weld: ['#e0a93b', '#ffffff', '#f6dc96'], ghost: 'rgba(255,255,255,.05)', round: 'rgba(8,8,12,.92)', roundInk: '#f8f3e6', chip: 'linear-gradient(135deg,rgba(255,255,255,.85),rgba(240,199,102,.55) 45%,rgba(40,30,10,.7))' };
  const css = `
#sbv{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9500;pointer-events:none;display:none;overflow:hidden;contain:strict}
#sbv.on{display:block}
#sbv .half{position:absolute;inset:0;will-change:transform}
#sbv .face{position:absolute;inset:0}
#sbv #vL .face{clip-path:polygon(0 0,${SX1}px 0,${SX0}px ${H}px,0 ${H}px);background:${C.faceL}}
#sbv #vR .face{clip-path:polygon(${SX1}px 0,${W}px 0,${W}px ${H}px,${SX0}px ${H}px);background:${C.faceR}}
#sbv .ghost{position:absolute;top:120px;font:800 520px/1 'Saira Condensed',sans-serif;font-style:italic;color:${C.ghost};text-transform:uppercase;white-space:nowrap}
#sbv #vL .ghost{left:60px}#sbv #vR .ghost{right:60px}
#sbv .pic{position:absolute;top:0;width:1160px;height:830px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,#000 78%,transparent);mask-image:linear-gradient(180deg,#000 78%,transparent)}
#sbv #vL .pic{left:0}#sbv #vR .pic{right:0}
#sbv .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%;transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1));transform-origin:50% 30%}
/* a profile picture (not a character image): a framed square in the slab, not stretched across it */
#sbv .avf{position:absolute;top:210px;width:440px;height:440px;overflow:hidden;border-radius:6px;box-shadow:0 0 0 4px ${C.a},0 30px 60px rgba(0,0,0,.5);background:#000}
#sbv #vL .avf{left:170px}#sbv #vR .avf{right:170px;box-shadow:0 0 0 4px ${PORC ? C.a : C.b},0 30px 60px rgba(0,0,0,.5)}
#sbv .avf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1))}
#sbv .sheen{position:absolute;inset:0;background:linear-gradient(115deg,transparent 18%,rgba(255,255,255,${PORC ? .35 : .07}) 24%,rgba(255,255,255,${PORC ? .08 : .015}) 31%,transparent 36%,transparent 62%,rgba(255,255,255,${PORC ? .25 : .05}) 66%,transparent 71%)}
#sbv .run{position:absolute;top:0;bottom:0;left:0;width:22%;background:linear-gradient(105deg,transparent,rgba(255,255,255,${PORC ? .35 : .1}) 50%,transparent);transform:translateX(-120%);will-change:transform}
#sbv.idle .run{animation:sbv-run 7s ease-in-out infinite}
#sbv.idle #vR .run{animation-delay:-3.5s}
@keyframes sbv-run{0%,50%{transform:translateX(-120%)}100%{transform:translateX(560%)}}
#sbv .plate{position:absolute;top:850px;height:150px;width:700px;display:flex;flex-direction:column;justify-content:center;padding:0 46px;box-sizing:border-box;background:${C.plate};border-top:3px solid ${C.plateEdge};box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12)}
#sbv #vL .plate{left:40px;clip-path:polygon(0 0,100% 0,calc(100% - 46px) 100%,0 100%)}
#sbv #vR .plate{right:40px;text-align:right;align-items:flex-end;clip-path:polygon(46px 0,100% 0,100% 100%,0 100%);border-top-color:${PORC ? C.plateEdge : C.b}}
#sbv .plate small{font:700 24px/1.1 'Chakra Petch',sans-serif;letter-spacing:.22em;color:${C.small};text-transform:uppercase;white-space:nowrap}
#sbv #vR .plate small{color:${PORC ? C.small : C.b}}
#sbv .plate b{display:block;max-width:610px;font:800 92px/1.02 'Saira Condensed',sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;overflow:hidden;
  background:${C.name};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding-right:.08em}
#sbv .weld{position:absolute;left:${(SX0 + SX1) / 2 - SEAM / 2}px;top:${H / 2}px;width:${SEAM}px;height:90px;margin-top:-45px;transform-origin:50% 50%;transform:rotate(-${ANG}deg) scaleX(0);opacity:0;will-change:transform,opacity;
  background:linear-gradient(180deg,transparent 0%,${C.weld[0]}22 30%,${C.weld[0]}aa 45%,${C.weld[1]} 50%,${C.weld[2]}aa 55%,${C.weld[2]}22 70%,transparent 100%)}
#sbv .glint{position:absolute;left:${(SX0 + SX1) / 2 - SEAM / 2}px;top:${H / 2 - 3}px;width:${SEAM}px;height:6px;transform:rotate(-${ANG}deg);overflow:visible;pointer-events:none}
#sbv .glint i{position:absolute;left:50%;top:-14px;width:260px;height:34px;margin-left:-130px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(255,255,255,.95),${C.a}88 40%,transparent 72%);opacity:0;will-change:transform,opacity}
#sbv .h2h{position:absolute;left:50%;top:112px;transform:translateX(-50%);padding:6px 22px;font:600 19px/1.2 'Chakra Petch',sans-serif;letter-spacing:.12em;color:${C.roundInk};text-transform:uppercase;white-space:nowrap;background:${PORC ? 'rgba(20,18,16,.86)' : 'rgba(0,0,0,.35)'};border-radius:3px;opacity:.92}   /* 1.12.21: on Porcelain the line was cream lettering on a nearly clear strip over white — it now sits on the round's own dark plate */
#sbv .round{position:absolute;left:50%;top:40px;transform:translateX(-50%);padding:12px 46px;background:${C.round};border:1.5px solid ${C.a};font:700 26px/1.2 'Chakra Petch',sans-serif;letter-spacing:.34em;color:${C.roundInk};text-transform:uppercase;white-space:nowrap;clip-path:polygon(18px 0,100% 0,calc(100% - 18px) 100%,0 100%)}
#sbv .round:empty{display:none}
#sbv .vs{position:absolute;left:${SX0}px;top:330px;width:${SX1 - SX0}px;height:420px;display:grid;place-items:center;will-change:transform,opacity;
  font:800 300px/1 'Saira Condensed',sans-serif;font-style:italic;background:${C.vs};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 26px ${C.vsGlow}) drop-shadow(0 8px 0 rgba(0,0,0,.6))}
.sb-potato #sbv *{animation:none!important}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sbv'; document.body.appendChild(root);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const potato = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const EASE = 'cubic-bezier(.16,.84,.24,1)';
  let shown = false, timers = [], S = {};
  const later = (f, ms) => timers.push(setTimeout(f, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function picOf(p) { return String((p.pic === 'art' && p.splashArt) || p.media || p.avatar || ''); }
  function frame(s, p) { const f = s.frames && s.frames[String(p.name || '').trim().toLowerCase()]; return f ? `--pz:${Number(f.z) || 1};--px:${Number(f.x) || 0}%;--py:${Number(f.y) || 0}%` : ''; }
  function half(k, p, n, s) {
    const src = picOf(p), art = p.pic === 'art' && p.splashArt;
    const tag = [n === 1 ? (p.team || '') : '', n === 1 ? '1P' : '2P', n === 2 ? (p.team || '') : ''].filter(Boolean).join(' · ');
    const rec = p.wins !== '' && p.wins != null && p.losses !== '' && p.losses != null ? `${p.wins}–${p.losses}` : '';
    return `<div class="half" id="v${k}"><div class="face">
      <div class="ghost">${esc(String(p.name || '').slice(0, 6))}</div>
      ${src ? (art || p.media ? `<div class="pic"><img src="${esc(src)}" alt="" style="${frame(s, p)}"></div>` : `<div class="avf"><img src="${esc(src)}" alt="" style="${frame(s, p)}"></div>`) : ''}
      <div class="sheen"></div><i class="run"></i>
      <div class="plate"><small>${esc([tag, p.character, rec].filter(Boolean).join(' · '))}</small><b class="nm">${esc(p.name || (n === 1 ? 'Player 1' : 'Player 2'))}</b></div>
    </div></div>`;
  }
  function fit() { root.querySelectorAll('.plate b').forEach(b => { b.style.fontSize = ''; let f = 92; while (b.scrollWidth > b.clientWidth && f > 30) { f -= 2; b.style.fontSize = f + 'px'; } }); }
  function build(s) {
    const p1 = s.p1 || {}, p2 = s.p2 || {};
    root.innerHTML = `${half('L', p1, 1, s)}${half('R', p2, 2, s)}<i class="weld"></i><div class="glint"><i></i></div><div class="vs">VS</div><div class="round">${esc(s.round || '')}</div>${s.hist && s.hist.total && !(s.x && s.x.tale && s.x.tale.strip) ? `<div class="h2h">${esc(s.hist.line)}</div>` : ''}`;   // 1.12.15: the head-to-head, once they've met
    fit(); if (document.fonts) document.fonts.ready.then(() => { if (shown) fit(); });
  }
  function show(instant) {
    clear(); shown = true; build(S); root.className = 'on';
    document.documentElement.classList.add('sb-vs-on');           // (SBPerf: the scoreboard underneath rests while this covers it)
    const L = root.querySelector('#vL'), R = root.querySelector('#vR'), vs = root.querySelector('.vs'), weld = root.querySelector('.weld'), rd = root.querySelector('.round'), pl = root.querySelectorAll('.plate');
    if (instant || potato()) { root.classList.add('idle'); weld.style.transform = `rotate(-${ANG}deg)`; weld.style.opacity = '.55'; return; }
    // 1.12.17: the GlassVS way in — the two slabs glide in from off the screen out of a haze, a little past each other and
    // back, and meet; a line of light flares along the seam and melds into it, then a light runs down the join (twice,
    // the second softer). No flash, no flying chips, no shudder.
    const MEET = 560, run = root.querySelector('.glint i');
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    L.animate([{ transform: 'translateX(-1320px)', opacity: .4 }, { transform: 'translateX(8px)', opacity: 1, offset: .86 }, { transform: 'none' }], { duration: MEET + 120, easing: EASE });
    R.animate([{ transform: 'translateX(1320px)', opacity: .4 }, { transform: 'translateX(-8px)', opacity: 1, offset: .86 }, { transform: 'none' }], { duration: MEET + 120, easing: EASE });
    weld.animate([{ transform: `rotate(-${ANG}deg) scale(.2,1)`, opacity: 0 }, { transform: `rotate(-${ANG}deg) scale(1,2.4)`, opacity: 1, offset: .25 }, { transform: `rotate(-${ANG}deg) scale(1,1)`, opacity: .9, offset: .55 }, { transform: `rotate(-${ANG}deg) scale(1,1)`, opacity: .55 }],
      { duration: 1100, delay: MEET - 40, easing: 'ease-out', fill: 'both' });
    const glide = (delay, o) => run.animate([{ opacity: 0, transform: `translateX(${SEAM / 2}px)` }, { opacity: o, offset: .2 }, { opacity: o, offset: .8 }, { opacity: 0, transform: `translateX(${-SEAM / 2}px)` }], { duration: 900, delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
    glide(MEET + 260, 1); glide(MEET + 1500, .6);
    vs.animate([{ opacity: 0, transform: 'scale(2.6)' }, { opacity: 1, transform: 'scale(.92)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 520, delay: MEET + 120, easing: EASE, fill: 'backwards' });
    pl.forEach((p, i) => p.animate([{ opacity: 0, transform: `translateX(${i ? 30 : -30}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: MEET + 200 + i * 90, easing: EASE, fill: 'backwards' }));
    rd.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(-24px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 460, delay: 260, easing: EASE, fill: 'backwards' });
    root.querySelectorAll('.pic img, .avf').forEach((im, i) => im.animate([{ opacity: 0, transform: 'translateY(26px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: MEET + 60 + i * 60, easing: EASE, fill: 'backwards', composite: 'add' }));
    { const h2 = root.querySelector('.h2h'); if (h2) h2.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: MEET + 420, fill: 'backwards' }); }
    later(() => { if (shown) root.classList.add('idle'); }, MEET + 900);
  }
  function hide(instant) {
    clear(); shown = false; root.classList.remove('idle');
    document.documentElement.classList.remove('sb-vs-on');
    if (instant || potato()) { root.className = ''; root.innerHTML = ''; return; }
    const L = root.querySelector('#vL'), R = root.querySelector('#vR');
    root.querySelectorAll('.vs,.round,.weld,.glint,.h2h').forEach(x => x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }));
    if (L) L.animate([{ transform: 'none' }, { transform: 'translateX(-1320px)' }], { duration: 460, delay: 80, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    if (R) R.animate([{ transform: 'none' }, { transform: 'translateX(1320px)' }], { duration: 460, delay: 80, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    later(() => { if (!shown) { root.getAnimations({ subtree: true }).forEach(a => a.cancel()); root.className = ''; root.innerHTML = ''; } }, 600);
  }
  // 1.12.7: the colours picked in the app for each side (left = Player 1, right = Player 2); unset keeps the layout's own
  const vcSt = document.createElement('style'); document.head.appendChild(vcSt); let vcKey = '';
  const mix = (h, t, k) => { const a = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(t.slice(i, i + 2), 16)); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  function vsColours(vc) {
    const l = /^#[0-9a-f]{6}$/i.test(vc[0] || '') ? vc[0] : '', r = /^#[0-9a-f]{6}$/i.test(vc[1] || '') ? vc[1] : '', k = l + '|' + r;
    if (k === vcKey) return; vcKey = k;
    const face = (c, deg) => PORC ? `linear-gradient(${deg}deg,#ffffff,${mix(c, '#ffffff', .8)} 55%,${mix(c, '#ffffff', .55)})` : `linear-gradient(${deg}deg,${mix(c, '#000000', .55)},${mix(c, '#06050a', .82)} 55%,#050408)`;
    const ink = c => PORC ? mix(c, '#ffffff', .25) : c;
    let css = '';
    for (const [id, c, deg] of [['vL', l, 160], ['vR', r, 200]]) if (c) css += `#sbv #${id} .face{background:${face(c, deg)}}#sbv #${id} .avf{box-shadow:0 0 0 4px ${c},0 30px 60px rgba(0,0,0,.5)}#sbv #${id} .plate{border-top-color:${c}}#sbv #${id} .plate small{color:${ink(c)}}`;
    if (l || r) { const a = l || C.weld[0], b = r || C.weld[2]; css += `#sbv .weld{background:linear-gradient(180deg,transparent 0%,${a}22 30%,${a}aa 45%,${C.weld[1]} 50%,${b}aa 55%,${b}22 70%,transparent 100%)}`; }
    vcSt.textContent = css;
  }
  let first = true, key = '';
  addEventListener('scoreboard', e => {
    S = e.detail || {};
    vsColours((S.fx && S.fx.vsc) || []);
    const want = !!(S.vs && S.vs.show) && !S.hidden && !(typeof window.__SB_FORMAT_VS === 'function' && window.__SB_FORMAT_VS(S));
    const k = JSON.stringify([S.p1 && [S.p1.name, S.p1.team, S.p1.avatar, S.p1.splashArt, S.p1.pic, S.p1.media, S.p1.wins, S.p1.losses, S.p1.character], S.p2 && [S.p2.name, S.p2.team, S.p2.avatar, S.p2.splashArt, S.p2.pic, S.p2.media, S.p2.wins, S.p2.losses, S.p2.character], S.round, S.frames, S.hist && S.hist.line]);
    if (first) { first = false; key = k; if (want) show(!!window.__SB_INSTANT); return; }
    if (want && !shown) { key = k; show(false); }
    else if (!want && shown) hide(false);
    else if (want && shown && k !== key) { key = k; build(S); root.classList.add('idle'); const w = root.querySelector('.weld'); if (w) { w.style.transform = `rotate(-${ANG}deg)`; w.style.opacity = '.55'; } }   // a name fixed while it's up: no replay
  });
})();
