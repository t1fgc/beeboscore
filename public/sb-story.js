/* BeeboScore (developed by Beebo) — the set's story on the splashes (1.12.23, round 2 of the layout and splash upgrade).
 *
 * Three things, built once and drawn in the layout's own look (Default snaps, Obsidian Glass overshoots, Porcelain eases):
 *   • the stats strip — under FullVS and GlassVS, once the VS has landed: each player's seed and record today, and between
 *     them the head-to-head or a runback (state.x.tale, from lib/tale.js). On GlassVS it sits under the glass, above the
 *     game's Heat gauges; FullVS covers the game, so there it runs along the bottom edge
 *   • the VS hit — FullVS tells its story in three beats: the names and pictures come in, the VS lands with a hit (a jolt of
 *     the screen at Full effects, a smaller one at Light, none at Off or with Less movement), then the strip comes up
 *   • the Bracket reset splash (state.full.show === 'greset') — before the second Grand Final set
 * Nothing here sits over the game's HUD while the game can be seen: the strip only shows on the two VS screens, and the
 * reset splash covers the whole screen.
 */
(() => {
  'use strict';
  if (window.__SB_STORY_LOADED) return; window.__SB_STORY_LOADED = true;
  const LOOK = String(((document.querySelector('meta[name="sb-look"]') || {}).content || '')).toLowerCase();
  const K = LOOK === 'shattered' ? 'glass' : LOOK === 'porcelain' ? 'porc' : 'classic';
  const W = 1920, H = 1080, HTML = document.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const POTATO = () => HTML.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const CALM = () => HTML.classList.contains('sb-calm');
  // the effects tier: full · light · off (Less movement: fades only)
  const tier = () => { if (POTATO()) return 'none'; if (CALM()) return 'calm'; const q = (S && S.gfx && S.gfx.q) || 'auto'; if (q === 'off' || q === 'ultra' || HTML.classList.contains('sb-ultra')) return 'off'; if (q === 'light' || HTML.classList.contains('sb-light')) return 'light'; return 'full'; };
  // each look's timing: when the VS lands on FullVS, when the strip comes, how it moves
  const T = {
    classic: { hit: 560, strip: 1150, d: 230, ease: 'cubic-bezier(.2,.9,.3,1)', shake: 6, font: "'Beebo Classic','Segoe UI',system-ui,sans-serif", up: false },
    glass: { hit: 990, strip: 1650, d: 560, ease: 'cubic-bezier(.3,1.5,.5,1)', shake: 10, font: "'Saira Condensed','Arial Narrow',Impact,sans-serif", up: true },
    porc: { hit: 1000, strip: 1950, d: 900, ease: 'cubic-bezier(.4,0,.2,1)', shake: 3, font: "'Saira Condensed','Arial Narrow',Impact,sans-serif", up: true },
  }[K];
  // 1.5.11: a lettering colour, deepened on a light look of yours so it reads on the light strip (public/sb-colours.js)
  const INK = (v, n) => (window.SBColours && window.SBColours.on && window.SBColours.ink ? window.SBColours.ink(v, n) : v);
  const css = `
#sbStory{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9560;pointer-events:none;overflow:hidden;contain:strict}
#sbStory .strip{position:absolute;display:none;grid-template-columns:1fr 1.45fr 1fr;align-items:stretch;box-sizing:border-box;font-family:${T.font};text-transform:uppercase;white-space:nowrap}
#sbStory .strip.on{display:grid}
#sbStory .strip.full{left:40px;width:1840px;top:1010px;height:54px}
#sbStory .strip.glassvs{left:340px;width:1240px;top:882px;height:42px}
#sbStory .cell{position:relative;display:flex;flex-direction:column;justify-content:center;min-width:0;padding:0 22px;overflow:hidden}
#sbStory .cell.R{align-items:flex-end;text-align:right}
#sbStory .cell.M{align-items:center;text-align:center}
#sbStory .cell small{display:block;font-size:13px;letter-spacing:.24em;line-height:1.1;opacity:.85;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#sbStory .cell b{display:block;font-size:22px;line-height:1.15;letter-spacing:.06em;overflow:hidden;max-width:100%}
#sbStory .glassvs .cell b{font-size:19px}#sbStory .glassvs .cell small{font-size:11px}
#sbStory .cell.empty{visibility:hidden}
#sbStory .strip.solo{grid-template-columns:1fr}#sbStory .strip.solo .cell.L,#sbStory .strip.solo .cell.R{display:none}
#sbStory .strip.full.solo{left:560px;width:800px}#sbStory .strip.glassvs.solo{left:600px;width:720px}
/* Default: the panel's flat slate card, its thin border, red for 1P, blue for 2P, gold in the middle */
#sbStory.k-classic .strip{background:linear-gradient(180deg,#1c2030,#151822);border:1.5px solid #333a50;border-radius:4px;color:#eef1f7;box-shadow:0 10px 26px rgba(0,0,0,.5)}
#sbStory.k-classic .cell.L{border-left:4px solid #ff3b5c}#sbStory.k-classic .cell.R{border-right:4px solid #3b8eff}
#sbStory.k-classic .cell.M{border-left:1px solid #252a3a;border-right:1px solid #252a3a}
#sbStory.k-classic .cell small{color:#8b93a7}#sbStory.k-classic .cell.M small{color:${INK('#e9c35e', 4.5)}}
/* Obsidian Glass: a blade of black glass with a gold edge, its ends cut to points */
#sbStory.k-glass .strip{background:linear-gradient(180deg,rgba(42,38,30,.95),rgba(11,10,8,.97));color:#fff6dc;clip-path:polygon(28px 0,calc(100% - 28px) 0,100% 50%,calc(100% - 28px) 100%,28px 100%,0 50%)}
#sbStory.k-glass .strip::before{content:'';position:absolute;inset:0;clip-path:inherit;box-shadow:inset 0 0 0 1.5px #e0a93b;pointer-events:none}
#sbStory.k-glass .strip::after{content:'';position:absolute;left:28px;right:28px;top:0;height:1.5px;background:linear-gradient(90deg,transparent,#f6dc96,transparent);opacity:.9}
#sbStory.k-glass .cell{font-style:italic;font-weight:800}
#sbStory.k-glass .cell small{color:${INK('#e0a93b', 4.5)}}#sbStory.k-glass .cell.M b{color:${INK('#f6dc96', 4.5)}}
#sbStory.k-glass .cell.M::before,#sbStory.k-glass .cell.M::after{content:'';position:absolute;top:22%;bottom:22%;width:1.5px;background:#e0a93b;opacity:.55;transform:skewX(-18deg)}
#sbStory.k-glass .cell.M::before{left:0}#sbStory.k-glass .cell.M::after{right:0}
/* Porcelain: a rounded white tile with a gold hairline, dark lettering, the labels in deep gold */
#sbStory.k-porc .strip{background:linear-gradient(180deg,#ffffff,#f3ecdc);border:1.5px solid #c9a13b;border-radius:27px;color:#1d1a14;box-shadow:0 10px 24px rgba(90,66,16,.28)}
#sbStory.k-porc .glassvs{border-radius:23px}
#sbStory.k-porc .cell{font-style:italic;font-weight:800}
#sbStory.k-porc .cell small{color:#836312}#sbStory.k-porc .cell.M b{color:#2a241a}
#sbStory.k-porc .cell.M::before,#sbStory.k-porc .cell.M::after{content:'';position:absolute;top:26%;bottom:26%;width:1px;background:#c9a13b}
#sbStory.k-porc .cell.M::before{left:0}#sbStory.k-porc .cell.M::after{right:0}
/* the VS hit's ring */
#sbStory .ring{position:absolute;left:0;top:0;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:6px solid #e9c35e;opacity:0}
#sbStory.k-glass .ring{border-color:#f6dc96;box-shadow:0 0 30px #e0a93b,inset 0 0 22px #e0a93b}
#sbStory.k-porc .ring{border-width:2px;border-color:#c9a13b;box-shadow:0 0 18px rgba(201,161,59,.6)}
/* ---------------------------------------------------------------- the Bracket reset splash */
#sbReset{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9310;pointer-events:none;display:none;overflow:hidden;font-family:${T.font};text-transform:uppercase;contain:strict}
#sbReset.on{display:block}
#sbReset .bg{position:absolute;inset:0}
#sbReset .kick{position:absolute;left:0;right:0;top:250px;text-align:center;font-size:30px;letter-spacing:.34em}
#sbReset .t{position:absolute;left:0;right:0;top:300px;text-align:center;font-size:210px;line-height:1;white-space:nowrap}
#sbReset .rule{position:absolute;left:50%;top:540px;height:6px;width:1200px;margin-left:-600px}
#sbReset .who{position:absolute;top:590px;width:760px;font-size:76px;line-height:1.05;white-space:nowrap;overflow:hidden}
#sbReset .who.L{right:calc(50% + 70px);text-align:right}#sbReset .who.R{left:calc(50% + 70px);text-align:left}
#sbReset .who small{display:block;font-size:22px;letter-spacing:.28em;margin-bottom:6px}
#sbReset .vs{position:absolute;left:50%;top:610px;width:120px;margin-left:-60px;text-align:center;font-size:56px}
#sbReset .line{position:absolute;left:0;right:0;top:780px;text-align:center;font-size:30px;letter-spacing:.16em;white-space:nowrap}
#sbReset.k-classic .bg{background:linear-gradient(180deg,#10121a,#0a0b10)}
#sbReset.k-classic .halfL,#sbReset.k-classic .halfR{position:absolute;top:0;bottom:0;width:50%;opacity:.18}
#sbReset.k-classic .halfL{left:0;background:linear-gradient(90deg,#ff3b5c,transparent)}#sbReset.k-classic .halfR{right:0;background:linear-gradient(270deg,#3b8eff,transparent)}
#sbReset.k-classic .kick{color:#8b93a7}#sbReset.k-classic .t{color:#eef1f7}#sbReset.k-classic .rule{background:#e9c35e}
#sbReset.k-classic .who{color:#eef1f7}#sbReset.k-classic .who.L small{color:#ff3b5c}#sbReset.k-classic .who.R small{color:#3b8eff}#sbReset.k-classic .vs{color:#e9c35e}#sbReset.k-classic .line{color:#e9c35e}
#sbReset.k-glass .bg{background:radial-gradient(ellipse at 50% 40%,#2a2112 0%,#0b0a08 60%,#050403 100%)}
#sbReset.k-glass .kick{color:#e0a93b}#sbReset.k-glass .t{font-style:italic;font-weight:800;background:linear-gradient(180deg,#fff6dc,#f6dc96 45%,#e0a93b 70%,#8a5a12);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 0 #000)}
#sbReset.k-glass .rule{background:linear-gradient(90deg,transparent,#e0a93b 20%,#fff6dc 50%,#e0a93b 80%,transparent);height:3px}
#sbReset.k-glass .who{font-style:italic;font-weight:800;color:#fff6dc}#sbReset.k-glass .who small{color:#e0a93b;font-style:normal}#sbReset.k-glass .vs{font-style:italic;font-weight:800;color:#e0a93b}#sbReset.k-glass .line{color:#f6dc96;font-style:italic}
#sbReset.k-glass .shard{position:absolute;background:linear-gradient(135deg,rgba(246,220,150,.5),rgba(20,16,10,.85));box-shadow:inset 0 0 0 1px rgba(224,169,59,.6)}
#sbReset.k-porc .bg{background:linear-gradient(160deg,#ffffff,#f6f0e2 55%,#e6d8b4)}
#sbReset.k-porc .kick{color:#836312}#sbReset.k-porc .t{font-style:italic;font-weight:800;color:#1d1a14}#sbReset.k-porc .rule{background:none;height:40px;top:520px}
#sbReset.k-porc .who{font-style:italic;font-weight:800;color:#1d1a14}#sbReset.k-porc .who small{color:#836312;font-style:normal}#sbReset.k-porc .vs{font-style:italic;font-weight:800;color:#a07a12}#sbReset.k-porc .line{color:#5a4210;font-style:italic}
#sbReset.k-porc .seam{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#sbReset.k-porc .seam path{fill:none;stroke:#c9a13b;stroke-width:3;stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(201,161,59,.7))}
`;
  const st = document.createElement('style'); st.id = 'sb-story-css'; st.textContent = (window.SBColours && window.SBColours.on ? window.SBColours.map(css) : css);      /* 1.5.5: your colours for the app's own layouts */ document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sbStory'; root.className = 'k-' + K; root.innerHTML = '<div class="strip"></div>'; document.body.appendChild(root);
  const strip = root.querySelector('.strip');
  const rs = document.createElement('div'); rs.id = 'sbReset'; rs.className = 'k-' + K; document.body.appendChild(rs);

  let S = null, where = '', stripK = '', vsWas = false, glassWas = false, upT = 0, hitT = 0, resetN = -1;
  const fmtLive = s => !!(s && s.format && s.format.status === 'live');
  // which VS is up: 'full' (FullVS) · 'glassvs' (GlassVS put up by hand) · '' — a game format's own VS tells its own story
  const vsUp = s => (s && s.vs && s.vs.show && !fmtLive(s) ? 'full' : s && s.playerVs && s.playerVs.show && !fmtLive(s) ? 'glassvs' : '');
  function cellHTML(cls, small, big, short) { return `<div class="cell ${cls}${big ? '' : ' empty'}"><small>${esc(small)}</small><b${short && short !== big ? ` data-short="${esc(short)}"` : ''}>${esc(big)}</b></div>`; }
  function stripHTML(t) {
    const p1 = (S.p1 || {}).name || '', p2 = (S.p2 || {}).name || '';
    const mid = String(t.mid || ''), [lead, last] = mid.split(' · ');
    const mk = t.runback ? 'Runback' : /^First meeting/.test(mid) ? 'Head to head' : 'Head to head';
    const mb = t.runback ? mid.replace(/^Runback — /, '') : mid;
    // the shorter way, for a long name: the runback without its round ("… won 3–0 earlier today"), the head-to-head without its last time
    const short = t.runback ? mb.replace(/ in .*? earlier today$/, ' earlier today') : lead;
    return cellHTML('L', p1, (t.p1 && t.p1.line) || '') + cellHTML('M', mid ? mk : '', last && !t.runback ? `${lead} · ${last}` : mb, short) + cellHTML('R', p2, (t.p2 && t.p2.line) || '');
  }
  // names and lines are fitted to their cell: a size smaller at a time, down to three quarters
  function fitOne(b, min) { b.style.fontSize = ''; let px = parseFloat(getComputedStyle(b).fontSize) || 20; const lo = px * min; while (b.scrollWidth > b.clientWidth + .5 && px > lo) { px -= 1; b.style.fontSize = px + 'px'; } return b.scrollWidth <= b.clientWidth + .5; }
  function fit() { for (const b of strip.querySelectorAll('.cell b, .cell small')) if (!fitOne(b, .7) && b.dataset.short) { b.textContent = b.dataset.short; fitOne(b, .7); } }
  function stripShow(kind, instant) {
    const t = S && S.x && S.x.tale;
    if (!t || !t.strip || window.__SB_TALE_OWN && kind === 'full') return stripHide(true);
    const k = kind + stripHTML(t);
    if (strip.classList.contains('on') && stripK === k) return;
    const solo = !(t.p1 && t.p1.line) && !(t.p2 && t.p2.line);      // nothing to say for either side: just the middle, on a shorter strip
    stripK = k; strip.className = 'strip on ' + kind + (solo ? ' solo' : ''); strip.innerHTML = stripHTML(t);
    // 1.12.24: under GlassVS the game shows: the strip keeps clear of this game's HUD in its band (Fatal Fury's gauges, say)
    strip.style.left = strip.style.width = '';
    if (kind === 'glassvs' && !solo && window.SB_HUD) { const z = SB_HUD.of(window.__SB_GAME || 'Tekken 8') || [], y0 = 882, y1 = 924; let l = 340, r = 1580;
      for (const q of z) if (q.y < y1 && q.y + q.h > y0) { if (q.x + q.w <= 960) l = Math.max(l, q.x + q.w + 12); else if (q.x >= 960) r = Math.min(r, q.x - 12); }
      if (l !== 340 || r !== 1580) { strip.style.left = l + 'px'; strip.style.width = (r - l) + 'px'; } }
    fit();
    const tr = tier(); if (instant || tr === 'none') return;
    strip.getAnimations().forEach(a => a.cancel());
    if (tr === 'calm') { strip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' }); return; }
    const from = K === 'porc' ? { opacity: 0, transform: 'translateY(18px)' } : K === 'glass' ? { opacity: 0, transform: 'translateY(70px) scaleX(.6)' } : { opacity: 0, transform: 'translateY(64px)' };
    const kf = K === 'glass' ? [from, { opacity: 1, transform: 'translateY(-6px) scaleX(1.02)', offset: .7 }, { opacity: 1, transform: 'none' }] : [from, { opacity: 1, transform: 'none' }];
    strip.animate(kf, { duration: T.d, easing: K === 'glass' ? 'cubic-bezier(.2,.8,.3,1)' : T.ease });
    strip.querySelectorAll('.cell').forEach((c, i) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.d * .8, delay: T.d * .35 + i * (K === 'porc' ? 140 : 60), fill: 'backwards' }));
  }
  function stripHide(now) {
    clearTimeout(upT); stripK = '';
    if (!strip.classList.contains('on')) return;
    if (now || tier() === 'none') { strip.className = 'strip'; strip.innerHTML = ''; return; }
    const a = strip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    a.onfinish = () => { if (!stripK) { strip.className = 'strip'; strip.innerHTML = ''; } a.cancel(); };
  }
  // the VS lands: a hit — a ring where it lands and a jolt of the screen (Full), a smaller jolt (Light), nothing at Off
  function vsHit() {
    const tr = tier(); if (tr !== 'full' && tr !== 'light') return;
    const vsEl = document.querySelector('#sbv.on .vs') || [...document.querySelectorAll('.sd-sc-vs .sd-el')].find(n => n.textContent.trim() === 'VS');
    let x = W / 2, y = H * .44;
    if (vsEl) { const r = vsEl.getBoundingClientRect(), k = (document.body.getBoundingClientRect().width / W) || 1; if (r.width) { x = (r.left + r.width / 2) / k; y = (r.top + r.height / 2) / k; } }
    if (window.__SB_SHAKE) window.__SB_SHAKE(tr === 'full' ? T.shake : Math.ceil(T.shake / 2), K === 'porc' ? 520 : 360);
    if (tr !== 'full') return;
    const ring = document.createElement('div'); ring.className = 'ring'; ring.style.left = x + 'px'; ring.style.top = y + 'px'; root.appendChild(ring);
    ring.animate([{ opacity: .95, transform: 'scale(.4)' }, { opacity: 0, transform: `scale(${K === 'porc' ? 4.5 : 7})` }], { duration: K === 'porc' ? 1100 : 620, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => ring.remove();
  }
  function syncVS(first) {
    const kind = vsUp(S);
    if (kind !== where) {
      clearTimeout(upT); clearTimeout(hitT);
      const was = where; where = kind;
      if (!kind) { stripHide(); return; }
      stripHide(true);
      const instant = first && !!window.__SB_INSTANT;
      if (instant) { stripShow(kind, true); return; }
      if (kind === 'full' && !was) hitT = setTimeout(() => { if (where === 'full') vsHit(); }, T.hit);
      upT = setTimeout(() => { if (where === kind) stripShow(kind); }, kind === 'glassvs' ? T.strip + 300 : T.strip);
      return;
    }
    if (kind && strip.classList.contains('on')) stripShow(kind, true);     // a new line (the head-to-head arrives late) without playing it again
  }

  // ---------------------------------------------------------------- the Bracket reset splash
  const shardsHTML = () => { let h = ''; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 380 + (i % 3) * 120, w = 60 + (i * 37) % 90, hh = 30 + (i * 53) % 70; h += `<i class="shard" style="left:${(960 + Math.cos(a) * r).toFixed(0)}px;top:${(440 + Math.sin(a) * r * .55).toFixed(0)}px;width:${w}px;height:${hh}px;clip-path:polygon(0 0,100% 20%,70% 100%,10% 80%)"></i>`; } return h; };
  const seamPath = 'M -20 520 C 220 470, 360 600, 560 540 S 860 470, 960 545 S 1260 610, 1420 530 S 1760 480, 1940 560';
  function resetHTML() {
    const p1 = S.p1 || {}, p2 = S.p2 || {}, st2 = S.x && S.x.story && S.x.story.end && S.x.story.end.kind === 'reset' ? S.x.story.end : null;
    const ev = [S.event, 'Grand Final'].filter(Boolean).join(' · ');
    const line = st2 ? st2.text : 'One more set decides it';
    return `<div class="bg"></div>${K === 'classic' ? '<i class="halfL"></i><i class="halfR"></i>' : ''}${K === 'glass' && ['full', 'light'].includes(tier()) ? shardsHTML() : ''}
      ${K === 'porc' ? `<svg class="seam" viewBox="0 0 ${W} ${H}"><path d="${seamPath}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>` : ''}
      <div class="kick">${esc(ev)}</div><div class="t">Bracket reset</div><div class="rule"></div>
      <div class="who L"><small>${p1.loser ? '[L] ' : ''}Player 1</small>${esc(p1.name || '')}</div><div class="vs">vs</div><div class="who R"><small>${p2.loser ? '[L] ' : ''}Player 2</small>${esc(p2.name || '')}</div>
      <div class="line">${esc(line)}</div>`;
  }
  function resetShow(instant) {
    rs.innerHTML = resetHTML(); rs.classList.add('on');
    for (const w of rs.querySelectorAll('.who')) { const nm = w.lastChild; if (!nm) continue; let px = 76; while (w.scrollWidth > w.clientWidth + .5 && px > 34) { px -= 2; w.style.fontSize = px + 'px'; } w.querySelector('small').style.fontSize = '22px'; }
    { const t = rs.querySelector('.t'); let px = 210; while (t.scrollWidth > t.clientWidth + .5 && px > 120) { px -= 6; t.style.fontSize = px + 'px'; } }
    const tr = tier(); if (instant || tr === 'none') { const p = rs.querySelector('.seam path'); if (p) p.style.strokeDashoffset = '0'; return; }
    const $ = q => rs.querySelector(q), A = (q, k, o) => { const e = typeof q === 'string' ? $(q) : q; if (e) e.animate(k, { fill: 'backwards', ...o }); };
    A(rs, [{ opacity: 0 }, { opacity: 1 }], { duration: K === 'porc' ? 700 : 260 });
    if (tr === 'calm') { const p = $('.seam path'); if (p) p.style.strokeDashoffset = '0'; return; }
    if (K === 'classic') {               // snaps: the halves wipe in from the sides, the title snaps down, the gold rule runs the full width
      A('.halfL', [{ transform: 'translateX(-100%)' }, { transform: 'none' }], { duration: 230, easing: 'cubic-bezier(.2,.9,.3,1)' });
      A('.halfR', [{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 230, easing: 'cubic-bezier(.2,.9,.3,1)' });
      A('.t', [{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 160, easing: 'cubic-bezier(.2,.9,.3,1)' });
      A('.rule', [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 250, delay: 330, easing: 'cubic-bezier(.2,.9,.3,1)' });
      ['.kick', '.who.L', '.vs', '.who.R', '.line'].forEach((q, i) => A(q, [{ opacity: 0, transform: `translateX(${q === '.who.L' ? -40 : q === '.who.R' ? 40 : 0}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 420 + i * 60, easing: 'cubic-bezier(.2,.9,.3,1)' }));
    } else if (K === 'glass') {          // overshoots: shards fly in and lock together, the title slams past and settles, the screen jolts
      rs.querySelectorAll('.shard').forEach((e, i) => A(e, [{ opacity: 0, transform: `translate(${(i % 2 ? 1 : -1) * 600}px, ${(i % 3 - 1) * 300}px) rotate(${i * 47}deg)` }, { opacity: 1, transform: 'none', offset: .8 }, { opacity: .55, transform: 'none' }], { duration: tr === 'full' ? 700 : 450, delay: i * 25, easing: 'cubic-bezier(.2,.8,.3,1)' }));
      A('.t', [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.94)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      A('.rule', [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1.08)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 760 });
      ['.kick', '.who.L', '.vs', '.who.R', '.line'].forEach((q, i) => A(q, [{ opacity: 0, transform: `translateY(30px)` }, { opacity: 1, transform: 'translateY(-4px)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 860 + i * 80, easing: 'ease-out' }));
      if (tr === 'full' && window.__SB_SHAKE) setTimeout(() => { if (rs.classList.contains('on')) window.__SB_SHAKE(10, 380); }, 640);
    } else {                             // eases: the gold seam is drawn across (kintsugi), then everything settles in, slowly
      const p = $('.seam path'); if (p) p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1600, delay: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      A('.t', [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: 500, easing: 'cubic-bezier(.4,0,.2,1)' });
      ['.kick', '.who.L', '.vs', '.who.R', '.line'].forEach((q, i) => A(q, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 900 + i * 140, easing: 'cubic-bezier(.4,0,.2,1)' }));
    }
  }
  function resetHide() {
    if (!rs.classList.contains('on')) return;
    if (tier() === 'none') { rs.classList.remove('on'); rs.innerHTML = ''; return; }
    rs.animate([{ opacity: 1 }, { opacity: 0 }], { duration: K === 'porc' ? 600 : 260, fill: 'forwards' }).onfinish = () => { if (!want()) { rs.classList.remove('on'); rs.innerHTML = ''; } rs.getAnimations().forEach(a => a.cancel()); };
  }
  const busy = s => !!((s.vs && s.vs.show) || (s.playerVs && s.playerVs.show) || (s.victory && s.victory.show) || (s.splash && s.splash.show) || s.screen);
  const want = () => !!(S && S.full && S.full.show === 'greset' && !busy(S));
  function syncReset(first) {
    const on = want(), n = on ? Number(S.full.n) || 0 : -1;
    if (on && n !== resetN) { resetN = n; resetShow(first && !!window.__SB_INSTANT); }
    else if (!on && resetN !== -1) { resetN = -1; resetHide(); }
  }

  let first = true;
  function onState(s) {
    if (!s) return; S = s;
    syncVS(first); syncReset(first); first = false;
  }
  addEventListener('scoreboard', e => { try { onState(e.detail); } catch (er) { console.warn('[story]', er); } });
  if (window.__SB_STATE) try { onState(window.__SB_STATE); } catch (e) {}
  window.__SB_STORY = { strip: () => strip.classList.contains('on') ? [...strip.querySelectorAll('.cell')].map(c => [c.querySelector('small').textContent, c.querySelector('b').textContent]) : null, where: () => where, reset: () => rs.classList.contains('on') };
})();
