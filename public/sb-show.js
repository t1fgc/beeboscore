/* BeeboScore (developed by Beebo), 1.12.18 — the show layer, on every layout.
 *
 *   Full screens (state.full): the countdown (Starting soon / Back in a few, with what's coming up), Coming up (the
 *   rundown with real times), the walk-in (a player's picture, record, best results, head-to-head and walk-in music),
 *   the event in numbers and the season table. One at a time, and never with a splash.
 *   Cards (state.card), bottom centre between Tekken 8's Heat gauges: a storyline, the picks (the prediction game) and a
 *   poll. They wait while the stats card is up.
 *   The lane (1.12.21), just above the casters: a moment's banner (state.x.mo) and the head-to-head line (state.h2h), for
 *   layouts that don't draw their own pieces for them. While the lane is in use the cards step up out of its way.
 *   The hype meter, a thin bar on the right edge (clear of the health bars and the Heat gauges), and its burst.
 *   Drawing on replays (Replay 2.0): the strokes drawn in the app, over the game, fading on their own.
 *   The sound pack: small sounds made on the spot (no files) for the VS, a point, a victory, the splashes — only when
 *   Settings › Sound is on and a pack is picked.
 *   Extensions: BeeboExt for their overlay.js (lib/extensions.js).
 *   4K: window.__SB_OUT tells the effects how big to draw (the layout's own fit is in sb-design.js).
 * Everything moves by transform and opacity, takes the layout's colours (its sb-look), and costs nothing while hidden.
 */
(() => {
  'use strict';
  if (window.__SB_SHOWLAYER) return; window.__SB_SHOWLAYER = true;
  const Q = new URLSearchParams(location.search);
  const LOOK = String(((document.querySelector('meta[name="sb-look"]') || {}).content || '')).toLowerCase();
  const T = LOOK === 'porcelain' ? { bg: 'linear-gradient(160deg,#fbf8f1 0%,#efe6d2 60%,#e2d5b8 100%)', card: 'linear-gradient(180deg,#fbf8f1,#efe6d2)', fg: '#16130f', mute: '#6d6352', acc: '#c9a13b', ink: '#836312', acc2: '#16130f', line: 'rgba(201,161,59,.55)', glow: 'rgba(201,161,59,.35)', dim: 'rgba(22,19,15,.06)' }
    : LOOK === 'shattered' ? { bg: 'radial-gradient(120% 90% at 20% 10%,#2a1f0c 0%,#0d0a06 55%,#050403 100%)', card: 'linear-gradient(180deg,rgba(34,26,12,.95),rgba(10,8,6,.95))', fg: '#f6ecd6', mute: '#b9a77f', acc: '#e0a93b', ink: '#e0a93b', acc2: '#ff5a1f', line: 'rgba(224,169,59,.6)', glow: 'rgba(224,169,59,.35)', dim: 'rgba(246,236,214,.06)' }
    : { bg: 'radial-gradient(120% 90% at 20% 10%,#1c2030 0%,#0b0c12 55%,#06070a 100%)', card: 'linear-gradient(180deg,rgba(22,24,32,.95),rgba(10,11,16,.95))', fg: '#f1f3f8', mute: '#9aa3b6', acc: '#ffb020', ink: '#ffb020', acc2: '#ff5a1f', line: 'rgba(255,176,32,.55)', glow: 'rgba(255,176,32,.3)', dim: 'rgba(241,243,248,.06)' };
  const FONT = "'Saira Condensed','Chakra Petch','Arial Narrow',sans-serif";
  const css = `
@font-face{font-family:'Saira Condensed';font-weight:800;font-display:swap;src:url(/static/fonts/saira-condensed-latin-800-normal.woff2) format('woff2')}
@font-face{font-family:'Saira Condensed';font-weight:700;font-display:swap;src:url(/static/fonts/saira-condensed-latin-700-normal.woff2) format('woff2')}
#sbFull{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:9300;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .45s ease,visibility 0s linear .45s;font-family:${FONT};color:${T.fg};overflow:hidden;contain:strict}
#sbFull.on{opacity:1;visibility:visible;transition:opacity .45s ease}
#sbFull .bg{position:absolute;inset:0;background:${T.bg}}
#sbFull .sheen{position:absolute;left:-50%;top:-50%;width:200%;height:200%;background:repeating-linear-gradient(115deg,transparent 0 140px,${T.dim} 140px 142px)}
#sbFull.on .sheen{animation:sbsSheen 40s linear infinite}

@keyframes sbsSheen{to{transform:translateX(284px)}}
#sbFull .in{position:absolute;inset:0;transform:translateY(30px) scale(.985);opacity:0;transition:transform .7s cubic-bezier(.2,.9,.25,1.05),opacity .5s ease}
#sbFull.on .in{transform:none;opacity:1;transition-delay:.12s}
#sbFull .kick{font-weight:700;font-size:30px;letter-spacing:.32em;text-transform:uppercase;color:${T.ink}}
#sbFull .rule{height:4px;width:160px;background:${T.acc};box-shadow:0 0 24px ${T.glow};margin:18px 0 26px}
#sbFull .logo{position:absolute;right:96px;top:84px;max-height:120px;max-width:340px;object-fit:contain}
/* countdown */
.sbs-cd{position:absolute;left:150px;top:200px;right:150px}
.sbs-cd .big{font-weight:800;font-size:330px;line-height:.86;letter-spacing:-.01em;font-variant-numeric:tabular-nums;text-shadow:0 0 60px ${T.glow}}
.sbs-cd .lab{font-weight:800;font-size:96px;line-height:1;text-transform:uppercase;letter-spacing:.02em}
.sbs-cd .ev{margin-top:10px;font-size:34px;color:${T.mute};font-weight:700;text-transform:uppercase;letter-spacing:.1em}
.sbs-up{position:absolute;left:150px;right:150px;bottom:110px;display:flex;gap:22px}
.sbs-up .it{flex:1;min-width:0;border-top:3px solid ${T.line};padding-top:14px}
.sbs-up .it b{display:block;font-size:24px;letter-spacing:.2em;color:${T.mute};font-weight:700}
.sbs-up .it span{display:block;font-size:42px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* coming up */
.sbs-sc{position:absolute;left:150px;top:150px;right:150px}
.sbs-sc h1{margin:0;font-size:120px;line-height:1;font-weight:800;text-transform:uppercase}
.sbs-sc .row{display:flex;align-items:baseline;gap:40px;padding:16px 0;border-bottom:1px solid ${T.line};opacity:.82}
.sbs-sc .row.live{opacity:1}
.sbs-sc .row .t{width:190px;font-size:46px;font-weight:700;color:${T.mute};font-variant-numeric:tabular-nums}
.sbs-sc .row .n{flex:1;font-size:58px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbs-sc .row.live .t{color:${T.ink}}.sbs-sc .row.live .n::after{content:'  ●  ON NOW';font-size:26px;letter-spacing:.2em;color:${T.ink};vertical-align:middle}
/* walk-in */
.sbs-wi{position:absolute;inset:0}
.sbs-wi .pic{position:absolute;bottom:0;width:860px;height:1000px;object-fit:contain;object-position:bottom;filter:drop-shadow(0 30px 60px rgba(0,0,0,.5));transform:translateX(-60px);opacity:0;transition:transform 1s cubic-bezier(.2,.9,.25,1),opacity .6s ease .1s}
#sbFull.on .sbs-wi .pic{transform:none;opacity:1}
.sbs-wi.s1 .pic{left:40px}.sbs-wi.s2 .pic{right:40px;transform:translateX(60px)}
.sbs-wi .sil{position:absolute;bottom:0;width:640px;height:820px;border-radius:320px 320px 0 0;background:linear-gradient(180deg,${T.dim},transparent)}
.sbs-wi.s1 .sil{left:140px}.sbs-wi.s2 .sil{right:140px}
.sbs-wi .txt{position:absolute;top:150px;width:900px}
.sbs-wi.s1 .txt{right:130px}.sbs-wi.s2 .txt{left:130px}
.sbs-wi .nm{font-weight:800;font-size:150px;line-height:.9;text-transform:uppercase;letter-spacing:-.01em;word-break:break-word}
.sbs-wi .tm{font-weight:700;font-size:40px;color:${T.ink};letter-spacing:.14em;text-transform:uppercase;display:flex;align-items:center;gap:16px;margin-bottom:10px}
.sbs-wi .tm img{height:34px;border-radius:4px}
.sbs-wi .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 40px;margin-top:40px}
.sbs-wi .grid b{display:block;font-size:22px;letter-spacing:.2em;color:${T.mute};font-weight:700;text-transform:uppercase}
.sbs-wi .grid span{display:block;font-size:40px;font-weight:700;line-height:1.15}
.sbs-wi .best span{font-size:32px}
.sbs-wi .soc{margin-top:34px;font-size:28px;color:${T.mute};font-weight:700;letter-spacing:.06em}
/* event in numbers */
.sbs-ev{position:absolute;left:130px;top:130px;right:130px}
.sbs-ev h1{margin:0 0 30px;font-size:110px;line-height:1;font-weight:800;text-transform:uppercase}
.sbs-ev .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.sbs-ev .tile{background:${T.dim};border:1px solid ${T.line};border-radius:14px;padding:22px 26px;min-width:0}
.sbs-ev .tile b{display:block;font-size:22px;letter-spacing:.18em;color:${T.mute};font-weight:700;text-transform:uppercase}
.sbs-ev .tile span{display:block;font-size:84px;font-weight:800;line-height:1;margin-top:8px;font-variant-numeric:tabular-nums}
.sbs-ev .tile i{display:block;font-style:normal;font-size:27px;font-weight:700;line-height:1.2;margin-top:8px;color:${T.fg};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbs-ev .tile.w2{grid-column:span 2}.sbs-ev .tile.w2 span{font-size:44px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* season table */
.sbs-se{position:absolute;left:130px;top:120px;right:130px;display:flex;gap:60px}
.sbs-se .main{flex:1;min-width:0}.sbs-se aside{width:440px}
.sbs-se h1{margin:0 0 24px;font-size:96px;line-height:1;font-weight:800;text-transform:uppercase}
.sbs-se .r{display:flex;align-items:center;gap:26px;padding:9px 0;border-bottom:1px solid ${T.line};font-size:40px;font-weight:700}
.sbs-se .r .k{width:74px;font-weight:800;color:${T.ink};font-variant-numeric:tabular-nums}
.sbs-se .r .n{flex:1;min-width:0;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbs-se .r .p{width:150px;text-align:right;font-variant-numeric:tabular-nums}
.sbs-se .r .e{width:120px;text-align:right;color:${T.mute};font-size:30px}
.sbs-se .r.top .n{color:${T.ink}}
.sbs-se aside h2{margin:6px 0 14px;font-size:30px;letter-spacing:.2em;color:${T.mute}}
.sbs-se aside .r{font-size:32px}
/* cards: bottom centre, between the Heat gauges */
#sbCard{position:absolute;left:50%;bottom:calc(42px + max(var(--sb-lane-own,0px),var(--sb-lane-app,0px)));width:620px;margin-left:-310px;z-index:9390;pointer-events:none;opacity:0;transform:translateY(24px);transition:opacity .35s ease,transform .45s cubic-bezier(.2,.9,.25,1.15),bottom .4s cubic-bezier(.2,.8,.3,1);
  background:${T.card};color:${T.fg};border:1px solid ${T.line};border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.45);font-family:${FONT};overflow:hidden;padding:14px 22px 16px 26px;box-sizing:border-box}
#sbCard.on{opacity:1;transform:none}
#sbCard::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:${T.acc}}
#sbCard .tag{font-weight:700;font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:${T.ink};margin-bottom:6px;display:flex;gap:10px}
#sbCard .tag em{font-style:normal;color:${T.mute};margin-left:auto;font-variant-numeric:tabular-nums}
#sbCard .tx{font-size:27px;font-weight:700;line-height:1.18}
#sbCard .bar{position:relative;height:40px;border-radius:7px;overflow:hidden;background:${T.dim};display:flex;margin-top:6px}
#sbCard .bar i{display:block;height:100%;transition:width .6s cubic-bezier(.2,.9,.25,1)}
#sbCard .bar .a{background:${T.acc}}#sbCard .bar .b{background:${T.acc2};opacity:.9}
#sbCard .names{display:flex;justify-content:space-between;font-size:24px;font-weight:800;text-transform:uppercase;margin-top:6px;gap:14px}
#sbCard .names span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48%}
#sbCard .names b{color:${T.ink}}
#sbCard .q{font-size:28px;font-weight:800;line-height:1.1;margin-bottom:6px}
#sbCard .op{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;margin-top:5px}
#sbCard .op .l{width:30px;font-weight:800;color:${T.ink}}#sbCard .op .t{width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbCard .op .m{flex:1;height:14px;border-radius:7px;background:${T.dim};overflow:hidden}#sbCard .op .m i{display:block;height:100%;background:${T.acc};transition:width .6s ease}
#sbCard .op .p{width:56px;text-align:right;font-variant-numeric:tabular-nums}
#sbCard .op.win .t{color:${T.ink}}
/* the lane: a moment's banner or the head-to-head line, just above the casters (x 660–1260: between the Heat gauges) */
#sbLane{position:absolute;left:50%;bottom:46px;width:600px;margin-left:-300px;height:62px;z-index:9395;pointer-events:none;opacity:0;transform:translateY(18px);transition:opacity .28s ease,transform .32s cubic-bezier(.2,.8,.3,1);
  background:${T.card};color:${T.fg};border:1px solid ${T.line};border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,.4);font-family:${FONT};overflow:hidden;padding:0 22px 0 26px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}
#sbLane.on{opacity:1;transform:none}
#sbLane::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:${T.acc}}
#sbLane .tag{font-weight:800;font-size:16px;line-height:1;letter-spacing:.22em;text-transform:uppercase;color:${T.ink};margin-bottom:5px;white-space:nowrap}
#sbLane .tx{font-weight:700;font-size:26px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbLane.h2h{height:38px;flex-direction:row;align-items:center;justify-content:flex-start;gap:14px}
#sbLane.h2h .tag{margin:0;font-size:14px}#sbLane.h2h .tx{flex:1;min-width:0;font-size:22px}
html.sb-calm #sbLane{transform:none!important}
/* the hype meter: the right edge, clear of the HUD */
#sbHype{position:absolute;right:26px;top:330px;width:22px;height:420px;z-index:9380;pointer-events:none;opacity:0;transition:opacity .5s ease;border-radius:11px;background:rgba(0,0,0,.35);border:1px solid ${T.line};overflow:hidden}
#sbHype.on{opacity:1}
#sbHype i{position:absolute;left:0;right:0;bottom:0;height:100%;transform-origin:bottom;transform:scaleY(0);background:linear-gradient(0deg,${T.acc},${T.acc2});transition:transform .9s cubic-bezier(.2,.9,.25,1)}
#sbHype.peak{box-shadow:0 0 30px ${T.acc},0 0 80px ${T.acc2};animation:sbsPeak .5s ease 3}
#sbHype b{position:absolute;left:-58px;top:-36px;width:140px;text-align:center;font:800 18px ${FONT};letter-spacing:.2em;color:${T.fg};text-shadow:0 2px 8px #000}
@keyframes sbsPeak{50%{transform:scale(1.15)}}
/* drawing on replays */
#sbDraw{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:9200;pointer-events:none}
#sbDraw path,#sbDraw ellipse,#sbDraw line{fill:none;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 6px rgba(0,0,0,.6));transition:opacity .8s ease}
#sbDraw .gone{opacity:0}
#sbReh{position:absolute;left:24px;top:24px;z-index:9600;pointer-events:none;font:800 18px ${FONT};letter-spacing:.24em;color:#111;background:#ffd23f;padding:6px 12px;border-radius:6px;opacity:0;transition:opacity .3s}
#sbReh.on{opacity:.95}
#sbExt{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:9350;pointer-events:none}
#sbExt>div{position:absolute;inset:0;display:none}#sbExt>div.on{display:block}
html.sb-potato #sbFull,html.sb-potato #sbFull .in,html.sb-potato #sbCard,html.sb-potato #sbLane,html.sb-potato #sbFull .pic{transition:none!important}html.sb-potato #sbFull .sheen{animation:none}`;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tr = (t) => (window.BeeboI18n ? window.BeeboI18n.t(t) : t);
  const hm = t => { const d = new Date(t); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  let built = false, full, fullIn, card, lane, hype, draw, rehTag, extHost;
  function build() {
    if (built || !document.body) return; built = true;
    const st = document.createElement('style'); st.textContent = (window.SBColours && window.SBColours.on ? window.SBColours.map(css) : css);      /* 1.5.5: your colours for the app's own layouts */ document.head.appendChild(st);
    const mk = (id, html) => { const e = document.createElement('div'); e.id = id; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
    full = mk('sbFull', '<div class="bg"></div><div class="sheen"></div><div class="in"></div>'); fullIn = full.querySelector('.in');
    card = mk('sbCard'); lane = mk('sbLane'); hype = mk('sbHype', '<i></i>'); rehTag = mk('sbReh', 'REHEARSAL'); extHost = mk('sbExt');
    draw = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); draw.id = 'sbDraw'; draw.setAttribute('viewBox', '0 0 1920 1080'); document.body.appendChild(draw);
    fit();
  }
  // the layer is drawn at 1920 × 1080 and scaled like the layout (any browser-source size, 4K included)
  // 1.12.21: a layout made in the Layout Designer scales the whole page (the body) itself; this layer then only makes up the
  // difference between the scale the window asks for and the one the body already has — none, in those layouts.
  function bodyK() { const b = document.body; return b && b.offsetWidth ? (b.getBoundingClientRect().width / b.offsetWidth) || 1 : 1; }
  function fit() {
    const k = ((Math.min(innerWidth / 1920, innerHeight / 1080) || 1) / bodyK()) || 1;
    for (const e of [full, card, lane, hype, draw, rehTag, extHost]) if (e) { e.style.transformOrigin = '0 0'; }
    for (const e of [full, draw, extHost]) if (e) e.style.transform = Math.abs(k - 1) < .004 ? '' : `scale(${k})`;
    // cards and the meter keep their own transitions: they sit in a scaled wrapper-free way by zoom
    for (const e of [card, lane, hype, rehTag]) if (e) e.style.zoom = Math.abs(k - 1) < .004 ? '' : String(k);
  }
  addEventListener('resize', fit); addEventListener('sb:fit', fit);

  let S = null, fullKey = '', cardKey = '', cdT = 0, walkAudio = null;
  const busy = s => !!(s && ((s.vs && s.vs.show) || (s.playerVs && s.playerVs.show) || (s.victory && s.victory.show) || (s.splash && s.splash.show) || s.screen));
  const logoOf = s => (s && s.brand && s.brand.logo ? s.brand.logo : '');

  // ------------------------------------------------------------------ full screens
  function drawFull() {
    const f = (S && S.full) || {}, x = (S && S.x) || {}, want = f.show && f.show !== 'greset' && !busy(S) ? f.show : '';   // (greset: the Bracket reset splash is sb-story.js's, in the layout's look)
    const k = want ? JSON.stringify([want, f.n, f.label, f.until, want === 'walkin' ? x.walk : want === 'evstats' ? x.ev : want === 'season' ? x.season : x.sched, logoOf(S), S.event]) : '';
    if (k !== fullKey) {
      fullKey = k; clearTimeout(cdT); stopWalk();
      if (want) {
        const logo = logoOf(S) ? `<img class="logo" alt="" src="${esc(logoOf(S))}">` : '';
        if (want === 'countdown') {
          const list = ((x.sched && x.sched.list) || []).filter(i => !i.live).slice(0, 3);
          fullIn.innerHTML = `${logo}<div class="sbs-cd"><div class="kick">${esc(tr(S.event || ''))}</div><div class="rule"></div><div class="lab">${esc(tr(f.label || 'Starting soon'))}</div><div class="big" data-cd>${f.until ? mmss(f.until - Date.now()) : ''}</div></div>`
            + (list.length ? `<div class="sbs-up">${list.map(i => `<div class="it"><b>${esc(hm(i.at))}</b><span>${esc(i.name)}</span></div>`).join('')}</div>` : '');
          if (f.until) tickCd();
        } else if (want === 'schedule') {
          const list = (x.sched && x.sched.list) || [];
          fullIn.innerHTML = `${logo}<div class="sbs-sc"><div class="kick">${esc(S.event || '')}</div><h1>${esc(tr('Coming up'))}</h1><div class="rule"></div>${list.map(i => `<div class="row${i.live ? ' live' : ''}"><span class="t">${esc(hm(i.at))}</span><span class="n">${esc(i.name)}</span></div>`).join('') || `<div class="row"><span class="n">${esc(tr('More soon'))}</span></div>`}</div>`;
        } else if (want === 'walkin' && x.walk) {
          const w = x.walk, so = Object.entries(w.socials || {}).map(([k2, v]) => `${k2 === 'twitter' ? 'X' : k2[0].toUpperCase() + k2.slice(1)} @${esc(v)}`).join('   ·   ');
          fullIn.innerHTML = `<div class="sbs-wi s${w.side}">${w.pic ? `<img class="pic" alt="" src="${esc(w.pic)}">` : '<div class="sil"></div>'}<div class="txt">
            <div class="tm">${w.country ? `<img alt="" src="/static/flags/${esc(String(w.country).toLowerCase())}.svg">` : ''}${esc(w.team || '')}${w.team && w.main ? ' · ' : ''}${esc(w.main || '')}</div>
            <div class="nm">${esc(w.name)}</div>
            <div class="grid"><div><b>${esc(tr('Record'))}</b><span>${esc(w.record || tr('First set on stream'))}</span></div><div><b>${esc(tr('Season'))}</b><span>${esc(w.rank || '—')}</span></div>
            <div class="best" style="grid-column:span 2"><b>${esc(tr('Best results'))}</b><span>${w.best.length ? w.best.map(esc).join('<br>') : '—'}</span></div>
            ${w.h2h ? `<div style="grid-column:span 2"><b>${esc(tr('Head to head'))}</b><span>${esc(w.h2h)}</span></div>` : ''}${w.bio ? `<div style="grid-column:span 2"><b>${esc(tr('About'))}</b><span style="font-size:30px">${esc(w.bio)}</span></div>` : ''}</div>
            ${so || w.sponsor ? `<div class="soc">${so}${so && w.sponsor ? '   ·   ' : ''}${w.sponsor ? esc(w.sponsor) : ''}</div>` : ''}</div></div>`;
          if (w.music) playWalk(w.music);
        } else if (want === 'evstats' && x.ev) {
          const e = x.ev, ch = (e.chars || []).slice(0, 3).map(c => `${esc(c.char)} (${c.sets})`).join(' · ') || '—';
          fullIn.innerHTML = `${logo}<div class="sbs-ev"><div class="kick">${esc(e.event || '')}</div><h1>${esc(tr('The event in numbers'))}</h1><div class="tiles">
            <div class="tile"><b>${esc(tr('Sets'))}</b><span>${e.sets}</span></div><div class="tile"><b>${esc(tr('Games'))}</b><span>${e.games}</span></div>
            <div class="tile"><b>${esc(tr('Players'))}</b><span>${e.players}</span></div><div class="tile"><b>${esc(tr('Comebacks'))}</b><span>${e.comebacks}</span></div>
            <div class="tile w2"><b>${esc(tr('Longest set'))}</b><span>${esc(e.longest ? e.longest.text : '—')}</span><i>${e.longestTime ? esc(e.longestTime.time) : ''}</i></div>
            <div class="tile w2"><b>${esc(tr('Most played'))}</b><span>${ch}</span></div>
            <div class="tile w2"><b>${esc(tr('Most sets won'))}</b><span>${e.mostWins ? esc(e.mostWins.name) + ' · ' + e.mostWins.n : '—'}</span></div>
            <div class="tile w2"><b>${esc(tr('Biggest comeback'))}</b><span>${e.biggest ? esc(e.biggest.text) : '—'}</span><i>${e.biggest ? `${esc(tr('from'))} ${e.biggest.from} ${esc(tr('games down'))}` : ''}</i></div></div></div>`;
        } else if (want === 'season' && x.season) {
          const se = x.season;
          fullIn.innerHTML = `${logo}<div class="sbs-se"><div class="main"><div class="kick">${esc(se.events)} ${esc(tr(se.events === 1 ? 'event' : 'events'))}</div><h1>${esc(se.name || tr('Season'))}</h1>
            ${se.table.map((r, i) => `<div class="r${i < 3 ? ' top' : ''}"><span class="k">${r.rank}</span><span class="n">${esc(r.name)}</span><span class="e">${r.events}×</span><span class="p">${r.pts} ${esc(tr('pts'))}</span></div>`).join('') || `<div class="r"><span class="n">${esc(tr('No results yet'))}</span></div>`}</div>
            ${se.predictors && se.predictors.length ? `<aside><h2>${esc(tr('Best predictors'))}</h2>${se.predictors.map((r, i) => `<div class="r"><span class="k">${i + 1}</span><span class="n">${esc(r.name)}</span><span class="p">${r.pts}</span></div>`).join('')}</aside>` : ''}</div>`;
        } else fullIn.innerHTML = '';
        if (window.BeeboI18n) window.BeeboI18n.scan(fullIn);
      }
      full.classList.toggle('on', !!want && !!fullIn.innerHTML);
    }
  }
  function tickCd() {
    const f = (S && S.full) || {}, el = fullIn.querySelector('[data-cd]'); if (!el || f.show !== 'countdown' || !f.until) return;
    const left = f.until - Date.now(); el.textContent = left > 0 ? mmss(left) : tr('Any second now');
    if (left > 0) cdT = setTimeout(tickCd, 1000 - (Date.now() % 1000) + 5);
  }
  // the walk-in music: only when the stream sound is on (Settings › Sound), at the player's level
  function playWalk(m) {
    const snd = (S && S.snd) || {}; if (!snd.on || Q.get('sound') === '0' || Q.has('screen')) return;
    try { walkAudio = new Audio(m.src); walkAudio.volume = Math.max(0, Math.min(1, (snd.vol / 100) * ((m.vol || 80) / 100))); walkAudio.play().catch(() => {}); } catch (e) {}
  }
  function stopWalk() { if (!walkAudio) return; const a = walkAudio; walkAudio = null; let v = a.volume; const t = setInterval(() => { v -= .08; if (v <= 0) { clearInterval(t); a.pause(); } else a.volume = v; }, 60); }

  // ------------------------------------------------------------------ cards
  function drawCard() {
    const c = (S && S.card) || {}, x = (S && S.x) || {}, statsUp = !!(S && S.stats && S.stats.show);
    const want = c.show && !busy(S) && !(S.full && S.full.show) && !statsUp ? c.show : '';
    const data = want === 'storyline' ? x.story : want === 'pred' ? x.pred : want === 'poll' ? x.poll : null;
    const on = !!(want && data);
    const k = on ? JSON.stringify([want, data]) : '';
    if (k !== cardKey) {
      cardKey = k;
      if (on && want === 'storyline') card.innerHTML = `<div class="tag">${esc(tr('Storyline'))} · ${esc(tr(data.title))}</div><div class="tx">${esc(data.text)}</div>`;
      else if (on && want === 'pred') {
        const p = data, res = p.result, st = p.result ? `${esc(res === 1 ? p.a : p.b)} ${esc(tr('wins'))}` : p.open ? esc(tr('Type !pick 1 or !pick 2')) : esc(tr('Picks locked'));
        card.innerHTML = `<div class="tag">${esc(tr('Who wins?'))}<em>${p.total} ${esc(tr(p.total === 1 ? 'pick' : 'picks'))} · ${st}</em></div><div class="bar"><i class="a" style="width:${p.pct1}%"></i><i class="b" style="width:${p.pct2}%"></i></div>
          <div class="names"><span>${res === 1 ? '<b>' : ''}${esc(p.a)} ${p.pct1}%${res === 1 ? '</b>' : ''}</span><span>${res === 2 ? '<b>' : ''}${p.pct2}% ${esc(p.b)}${res === 2 ? '</b>' : ''}</span></div>`;
      } else if (on && want === 'poll') {
        const p = data, top = Math.max(0, ...p.opts.map(o => o.n));
        card.innerHTML = `<div class="tag">${esc(tr('Poll'))}<em>${p.open ? esc(tr('Type !vote and a number')) : esc(tr('Closed'))} · ${p.total}</em></div><div class="q">${esc(p.q)}</div>${p.opts.map((o, i) => `<div class="op${!p.open && o.n === top && top ? ' win' : ''}"><span class="l">${i + 1}</span><span class="t">${esc(o.text)}</span><span class="m"><i style="width:${o.pct}%"></i></span><span class="p">${o.pct}%</span></div>`).join('')}`;
      }
      if (on && window.BeeboI18n) window.BeeboI18n.scan(card);
      card.classList.toggle('on', on);
    }
  }
  // ------------------------------------------------------------------ 1.12.21: the lane above the casters
  // A moment's banner and the head-to-head line, for layouts that don't draw their own pieces for them (the built-in looks
  // do, each in its own style and timing). One thing at a time: a banner hides the line while it's up, and neither shows
  // over a splash, a full screen or a game format's bar. Reduced motion: it fades, it doesn't slide.
  let laneKey = '';
  const fitLine = (n, text, max, w) => { n.style.fontSize = Math.max(15, Math.min(max, w / (Math.max(1, String(text).length) * .47))).toFixed(1) + 'px'; };
  function drawLane() {
    const x = (S && S.x) || {}, mo = x.mo || null, quiet = busy(S) || !!(S.full && S.full.show) || !!(S.fv && S.fv.status === 'live');
    const h = (S && S.hist) || {}, line = h.line === 'First meeting' ? 'First meeting on stream' : String(h.line || '');
    const wantMo = !!mo && !quiet && !window.__SB_MOMENT_OWN, wantH = !mo && !!(S.h2h && S.h2h.show) && !!line && !quiet && !window.__SB_H2H_OWN;
    const k = wantMo ? `m|${mo.n}|${mo.title}|${mo.text}` : wantH ? `h|${line}` : '';
    document.documentElement.classList.toggle('sb-calm', !!(x.sb && x.sb.calm));
    if (k === laneKey) return;
    const was = laneKey; laneKey = k;
    document.documentElement.style.setProperty('--sb-lane-app', wantMo ? '78px' : wantH ? '54px' : '0px');
    if (!k) { lane.classList.remove('on'); return; }
    const fill = () => {
      lane.classList.toggle('h2h', !wantMo);
      lane.innerHTML = wantMo ? `<div class="tag">${esc(tr(mo.title))}</div><div class="tx">${esc(mo.text)}</div>` : `<div class="tag">${esc(tr('Head-to-head'))}</div><div class="tx">${esc(tr(line))}</div>`;
      fitLine(lane.querySelector('.tx'), wantMo ? mo.text : line, wantMo ? 26 : 22, wantMo ? 548 : 400);
      if (window.BeeboI18n) window.BeeboI18n.scan(lane);
      lane.classList.add('on');
    };
    if (was && lane.classList.contains('on')) { lane.classList.remove('on'); setTimeout(() => { if (laneKey === k) fill(); }, 300); }      // one thing leaves, the next comes in
    else fill();
  }
  // ------------------------------------------------------------------ the hype meter
  let hypeKey = '';
  function drawHype() {
    const h = S && S.x && S.x.hype, on = !!(h && h.show !== false && (h.level > .05 || h.peak)) && !busy(S) && !(S.full && S.full.show);
    const k = on ? `${h.level}|${h.peak}` : '';
    if (k === hypeKey) return; hypeKey = k;
    hype.classList.toggle('on', on);
    if (on) { hype.querySelector('i').style.transform = `scaleY(${h.level})`; hype.classList.toggle('peak', !!h.peak); if (h.peak && !hype.querySelector('b')) { const b = document.createElement('b'); b.textContent = tr('HYPE'); hype.appendChild(b); } if (!h.peak) { const b = hype.querySelector('b'); if (b) b.remove(); } }
  }
  // ------------------------------------------------------------------ drawing on replays
  const strokes = new Map(); let fadeT = 0;
  function onDraw(d) {
    if (!built) return;
    if (d.clear) { for (const el of strokes.values()) el.remove(); strokes.clear(); return; }
    if (d.undo) { const el = strokes.get(d.undo); if (el) { el.remove(); strokes.delete(d.undo); } return; }     // 1.12.19: Ctrl+Z on the replay pad
    const pts = (d.pts || []).map(p => [p[0] * 1920, p[1] * 1080]); if (!pts.length) return;
    let el = strokes.get(d.id);
    const NS = 'http://www.w3.org/2000/svg';
    if (!el) { el = document.createElementNS(NS, d.tool === 'circle' ? 'ellipse' : 'path'); el.setAttribute('stroke', d.color); el.setAttribute('stroke-width', d.w); draw.appendChild(el); strokes.set(d.id, el); }
    if (d.tool === 'circle') { const a = pts[0], b = pts[pts.length - 1]; el.setAttribute('cx', (a[0] + b[0]) / 2); el.setAttribute('cy', (a[1] + b[1]) / 2); el.setAttribute('rx', Math.abs(b[0] - a[0]) / 2); el.setAttribute('ry', Math.abs(b[1] - a[1]) / 2); }
    else if (d.tool === 'arrow') {
      const a = pts[0], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.max(22, d.w * 3.2);
      const h1 = [b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)], h2 = [b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)];
      el.setAttribute('d', `M${a[0]},${a[1]}L${b[0]},${b[1]}M${h1[0]},${h1[1]}L${b[0]},${b[1]}L${h2[0]},${h2[1]}`);
    } else el.setAttribute('d', 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L'));
    clearTimeout(fadeT); fadeT = setTimeout(() => { for (const e of strokes.values()) { e.classList.add('gone'); setTimeout(() => e.remove(), 900); } strokes.clear(); }, 12000);
  }
  addEventListener('beebo:show:draw', e => { try { onDraw(e.detail || {}); } catch (er) {} });

  // ------------------------------------------------------------------ the sound pack (made on the spot with WebAudio — no files)
  let ac = null;
  const PACKS = { glass: 'glass', chime: 'chime', punch: 'punch' };
  const packOf = x => { const p = x && x.sfx; if (!p || p === 'off') return ''; if (p === 'auto') return LOOK === 'porcelain' ? 'chime' : LOOK === 'shattered' ? 'glass' : 'punch'; return PACKS[p] || ''; };
  function sfx(kind) {
    const pack = packOf(S && S.x), snd = (S && S.snd) || {};
    if (!pack || !snd.on || Q.get('sound') === '0' || Q.has('screen') || Q.has('preview')) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, out = ac.createGain(); out.gain.value = Math.max(0, Math.min(1, (snd.vol || 0) / 100)) * .6; out.connect(ac.destination);
      const tone = (f, d, type, at = 0, g0 = .5, f2) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(g0, t + at + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + d); o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + d + .05); };
      const noise = (d, at = 0, g0 = .4, hp = 1200) => { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * d), ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 2); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = g0; s.buffer = b; s.connect(f); f.connect(g); g.connect(out); s.start(t + at); };
      const P = {
        glass: { vs: () => { noise(.5, 0, .5, 2500); tone(1760, .6, 'sine', 0, .25); tone(2637, .5, 'sine', .04, .15); }, point: () => { tone(1318, .25, 'triangle', 0, .3); tone(1976, .3, 'sine', .05, .18); }, win: () => { noise(.9, 0, .5, 1800); [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, .9, 'sine', i * .08, .22)); }, splash: () => { noise(.35, 0, .35, 3000); tone(2093, .35, 'sine', 0, .15); }, hype: () => { noise(.6, 0, .55, 900); tone(220, .5, 'sawtooth', 0, .2, 880); } },
        chime: { vs: () => { [523, 659, 784].forEach((f, i) => tone(f, 1.1, 'sine', i * .09, .25)); }, point: () => { tone(880, .5, 'sine', 0, .3); tone(1320, .5, 'sine', .02, .12); }, win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 1.4, 'sine', i * .11, .22)); }, splash: () => { tone(784, .7, 'sine', 0, .2); tone(1175, .7, 'sine', .06, .14); }, hype: () => { [659, 784, 988, 1318].forEach((f, i) => tone(f, .6, 'triangle', i * .05, .2)); } },
        punch: { vs: () => { tone(90, .45, 'sine', 0, .9, 40); noise(.25, 0, .4, 600); }, point: () => { tone(150, .2, 'square', 0, .25, 70); noise(.1, 0, .25, 2000); }, win: () => { tone(80, .7, 'sine', 0, .9, 35); [392, 523, 659].forEach((f, i) => tone(f, .5, 'sawtooth', .1 + i * .07, .12)); }, splash: () => { noise(.3, 0, .35, 800); tone(120, .3, 'sine', 0, .4, 60); }, hype: () => { tone(60, .8, 'sine', 0, .9, 30); noise(.7, 0, .5, 400); } },
      }[pack];
      if (P && P[kind]) P[kind]();
    } catch (e) {}
  }
  let prevS = null;
  function sfxWatch(s) {
    const p = prevS; prevS = { vs: !!(s.vs && s.vs.show) || !!(s.playerVs && s.playerVs.show), v: !!(s.victory && s.victory.show), sp: (s.splash && s.splash.show) || '', s1: Number(s.p1 && s.p1.score) || 0, s2: Number(s.p2 && s.p2.score) || 0, f: (s.full && s.full.show) || '', cue: s.gfx && s.gfx.cue ? s.gfx.cue.n : 0, ck: s.gfx && s.gfx.cue ? s.gfx.cue.kind : '' };
    if (!p) return;
    const c = prevS;
    if (c.vs && !p.vs) sfx('vs'); else if (c.v && !p.v) sfx('win'); else if ((c.sp && c.sp !== p.sp) || (c.f && c.f !== p.f)) sfx('splash');
    else if (c.s1 > p.s1 || c.s2 > p.s2) sfx('point');
    if (c.cue !== p.cue && c.ck === 'hype') sfx('hype');
  }

  // ------------------------------------------------------------------ extensions (lib/extensions.js): BeeboExt for their overlay.js
  const extScreens = new Map(), extCues = new Map(), extStateFns = [];
  window.BeeboExt = {
    screen(id, h) { const k = (document.currentScript && document.currentScript.src.match(/\/ext\/([a-z0-9-]+)\//) || [])[1] || 'ext'; extScreens.set(`${k}:${id}`, { ...h, el: null }); drawExt(); },
    on(cue, fn) { const k = (document.currentScript && document.currentScript.src.match(/\/ext\/([a-z0-9-]+)\//) || [])[1] || 'ext'; extCues.set(`${k}:${cue}`, fn); },
    state(fn) { if (typeof fn === 'function') extStateFns.push(fn); },
  };
  function drawExt() {
    if (!built) return; const on = (S && S.x && S.x.extOn) || {};
    for (const [k, sc] of extScreens) {
      const want = !!on[k] && !busy(S);
      if (!sc.el) { sc.el = document.createElement('div'); extHost.appendChild(sc.el); }
      if (want !== !!sc.on) { sc.on = want; sc.el.classList.toggle('on', want); try { want ? sc.show && sc.show(sc.el, S) : sc.hide && sc.hide(sc.el); } catch (e) { console.warn('[extension]', e); } }
    }
  }
  addEventListener('beebo:ext', e => { const d = e.detail || {}, fn = extCues.get(`${d.ext}:${d.cue}`); if (fn) try { fn(d.data || {}, S); } catch (er) { console.warn('[extension]', er); } });

  // ------------------------------------------------------------------ the state
  function onState(s) {
    S = s; build(); if (!built) return;
    const x = s.x || {};
    rehTag.classList.toggle('on', !!x.reh);
    drawFull(); drawCard(); drawLane(); drawHype(); drawExt(); sfxWatch(s); fit();
    for (const fn of extStateFns) try { fn(s); } catch (e) {}
  }
  addEventListener('scoreboard', e => { try { onState(e.detail); } catch (er) { console.warn('[show]', er); } });
  if (window.__SB_STATE) try { onState(window.__SB_STATE); } catch (e) {}
})();
