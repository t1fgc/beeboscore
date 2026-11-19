/* BeeboScore (developed by Beebo), 1.12.16 — two small cards for the caster and the sponsors, on every layout.
 *
 *   The stats card (state.stats: the panel's Player history card, the Stream Deck's Stats card key, the second operator's
 *   remote): one player's record, most-played characters and the head-to-head with the opponent, from Player history.
 *   Sponsor rotation (state.spon: Settings › Sponsors): logos and messages taking turns, every so often, for a few seconds.
 *
 * Both sit where the game's HUD isn't: bottom centre (560 px wide, between Tekken 8's Heat gauges), or above a bottom corner's gauge.
 * Both step aside while a full-screen splash is up, and the sponsor waits while the stats card is showing. They take the
 * layout's colours (its sb-look), move by transform and opacity only, and cost nothing while hidden.
 */
(() => {
  'use strict';
  if (window.__SB_SHOWCARDS) return; window.__SB_SHOWCARDS = true;
  const LOOK = String(((document.querySelector('meta[name="sb-look"]') || {}).content || '')).toLowerCase();
  const T = LOOK === 'porcelain' ? { bg: 'linear-gradient(180deg,#fbf8f1,#efe6d2)', fg: '#16130f', mute: '#6d6352', acc: '#c9a13b', ink: '#836312', line: 'rgba(201,161,59,.55)' }
    : LOOK === 'shattered' ? { bg: 'linear-gradient(180deg,rgba(34,26,12,.94),rgba(10,8,6,.94))', fg: '#f6ecd6', mute: '#b9a77f', acc: '#e0a93b', ink: '#e0a93b', line: 'rgba(224,169,59,.6)' }
    : { bg: 'linear-gradient(180deg,rgba(22,24,32,.94),rgba(10,11,16,.94))', fg: '#f1f3f8', mute: '#9aa3b6', acc: '#ffb020', ink: '#ffb020', line: 'rgba(255,176,32,.55)' };
  const FONT = "'Saira Condensed','Chakra Petch','Arial Narrow',sans-serif";
  const css = `
.sbc{position:absolute;z-index:9400;pointer-events:none;opacity:0;transform:translateY(24px);transition:opacity .35s ease,transform .45s cubic-bezier(.2,.9,.25,1.15),bottom .4s cubic-bezier(.2,.8,.3,1);will-change:transform,opacity;
  background:${T.bg};color:${T.fg};border:1px solid ${T.line};border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.45);font-family:${FONT};overflow:hidden}
.sbc.on{opacity:1;transform:none}
.sbc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:${T.acc}}
#sbStats{left:50%;margin-left:-280px;width:560px;bottom:calc(42px + max(var(--sb-lane-own,0px),var(--sb-lane-app,0px)));padding:14px 20px 14px 24px}   /* 1.12.21: up out of the way of a moment's banner or the head-to-head line */
#sbStats .nm{font-weight:800;font-size:40px;line-height:1;text-transform:uppercase;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbStats .tag{font-weight:700;font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:${T.ink};margin-bottom:4px}
#sbStats .row{display:flex;gap:26px;margin-top:8px;font-size:22px;font-weight:600}
#sbStats .row b{display:block;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${T.mute};font-weight:700}
#sbStats .h2h{margin-top:8px;font-size:19px;color:${T.mute};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbSpon{display:flex;align-items:center;gap:16px;padding:10px 20px 10px 22px;height:84px;max-width:560px;box-sizing:border-box}
#sbSpon.w-bottom{left:50%;bottom:calc(42px + max(var(--sb-lane-own,0px),var(--sb-lane-app,0px)));transform:translate(-50%,24px)}#sbSpon.w-bottom.on{transform:translate(-50%,0)}
#sbSpon.w-bottom-left{left:58px;bottom:170px}#sbSpon.w-bottom-right{right:58px;bottom:170px}
#sbSpon img{height:60px;max-width:220px;object-fit:contain}
#sbSpon .tx{font-size:26px;font-weight:700;line-height:1.1;max-width:360px}
#sbSpon .by{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:${T.mute};font-weight:700;display:block;margin-bottom:2px}
html.sb-potato .sbc{transition:none}`;
  let built = false, stats, spon;
  function build() {
    if (built || !document.body) return; built = true;
    const st = document.createElement('style'); st.textContent = (window.SBColours && window.SBColours.on ? window.SBColours.map(css) : css);      /* 1.5.5: your colours for the app's own layouts */ document.head.appendChild(st);
    stats = document.createElement('div'); stats.id = 'sbStats'; stats.className = 'sbc'; document.body.appendChild(stats);
    spon = document.createElement('div'); spon.id = 'sbSpon'; spon.className = 'sbc w-bottom'; document.body.appendChild(spon);
    fit(); addEventListener('resize', fit); addEventListener('sb:fit', fit);
  }
  // 1.12.18: the cards keep their place and size on any browser-source size (1440p, 4K)
  // (1.12.21: only the difference between the scale the window asks for and the one the page — the body — already has)
  function bodyK() { const b = document.body; return b && b.offsetWidth ? (b.getBoundingClientRect().width / b.offsetWidth) || 1 : 1; }
  function fit() { const k = ((Math.min(innerWidth / 1920, innerHeight / 1080) || 1) / bodyK()) || 1, z = Math.abs(k - 1) < .004 ? '' : String(k); for (const e of [stats, spon]) if (e) e.style.zoom = z; }
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let S = null, statsKey = '', statsOn = false;
  const busy = s => !!(s && ((s.vs && s.vs.show) || (s.playerVs && s.playerVs.show) || (s.victory && s.victory.show) || (s.splash && s.splash.show) || s.screen || (s.fv && s.fv.splash) || (s.full && s.full.show)));   // (1.12.18: the show's full screens)

  function drawStats() {
    const x = S && S.stats, side = x && Number(x.side) === 2 ? 2 : 1, me = S && S['p' + side], them = S && S['p' + (3 - side)];
    const want = !!(x && x.show && me && me.name) && !busy(S);
    if (want) {
      const h = S.hist || {}, mine = (side === 1 ? h.p1 : h.p2) || {}, line = h.line || '';
      const rk = S.x && S.x.rank && S.x.rank[side], rank = rk ? `#${rk.rank} of ${rk.of}${S.x.rank.name ? ' in ' + S.x.rank.name : ''}` : '';      // 1.12.18: the season
      const key = `${side}|${me.name}|${JSON.stringify(mine)}|${line}|${rank}`;
      if (key !== statsKey) {
        statsKey = key;
        const vs = !h.total ? `First meeting with ${them && them.name || 'their opponent'}` : line;
        stats.innerHTML = `<div class="tag">Player ${side}${me.team ? ' · ' + esc(me.team) : ''}</div><div class="nm">${esc(me.name)}</div>
          <div class="row"><span><b>Record</b>${esc(mine.record || 'First set here')}</span><span><b>Plays</b>${esc(mine.chars || me.character || '—')}</span><span><b>Sets</b>${esc(mine.sets || 0)}</span></div>
          <div class="h2h">${esc(vs)}</div>${rank ? `<div class="h2h" style="color:${T.ink}">${esc(rank)}</div>` : ''}`;
      }
    }
    if (want !== statsOn) { statsOn = want; stats.classList.toggle('on', want); }
  }

  // ---- sponsor rotation: a client-side timer; a cue from the app (the Sponsor key) shows the next one straight away
  let sp = null, idx = -1, cueSeen = null, nextAt = 0, hideAt = 0, tick = 0, sponShown = false;
  function showSponsor() {
    const items = sp.items; idx = (idx + 1) % items.length; const it = items[idx];
    spon.className = 'sbc w-' + sp.where;
    spon.innerHTML = `${it.src ? `<img src="${esc(it.src)}" alt="">` : ''}${it.text ? `<div class="tx"><span class="by">Thanks to our sponsor</span>${esc(it.text)}</div>` : ''}`;
    void spon.offsetWidth; spon.classList.add('on'); sponShown = true; hideAt = Date.now() + sp.show * 1000;
  }
  function hideSponsor() { if (sponShown) { spon.classList.remove('on'); sponShown = false; } }
  function loop() {
    const now = Date.now();
    if (!sp || !sp.items.length) { hideSponsor(); tick = 0; return; }
    const cardUp = !!(S && S.card && S.card.show);          // 1.12.18: a storyline, the picks or a poll is in the same spot
    if (sponShown && (now >= hideAt || busy(S) || statsOn || (cardUp && sp.where === 'bottom'))) hideSponsor();
    else if (!sponShown && sp.on && now >= nextAt && !busy(S) && !statsOn && !(cardUp && sp.where === 'bottom')) { showSponsor(); nextAt = now + (sp.every + sp.show) * 1000; }
    tick = setTimeout(loop, 500);
  }
  function onState(s) {
    S = s; build(); if (!built) return;
    drawStats();
    const n = s && s.spon;
    if (!n) { sp = null; hideSponsor(); return; }
    const first = !sp; sp = n;
    if (first) nextAt = Date.now() + Math.min(8, sp.every) * 1000;
    if (cueSeen !== null && n.cue !== cueSeen && !busy(S)) { hideSponsor(); showSponsor(); nextAt = Date.now() + (sp.every + sp.show) * 1000; }
    cueSeen = n.cue;
    if (!tick) tick = setTimeout(loop, 500);
  }
  addEventListener('scoreboard', e => { try { onState(e.detail); } catch (er) { console.warn('[showcards]', er); } });
  if (window.__SB_STATE) try { onState(window.__SB_STATE); } catch (e) {}
})();
