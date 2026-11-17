/* BeeboScore (developed by Beebo) — the viewer tournament's "how to join" splash, on every layout.
 * Shown with state.splash.show = 'vtjoin' (Bracket tab › Viewer tournament › Show join splash, or the Stream Deck key).
 * What it shows comes from the app's 'vtpub' message (sb-client.js → scoreboard:vt): the name, the chat command,
 * open / closed, and everyone who has joined, numbered in the order they joined (new names pop in live).
 * Turn it off for a layout with <meta name="sb-vtjoin" content="off">.
 * It wears the live layout's look (colours, lettering, shapes): public/sb-skin.js.
 */
(() => {
  'use strict';
  if (window.__SB_VTJOIN_LOADED) return; window.__SB_VTJOIN_LOADED = true;
  if ((document.querySelector('meta[name="sb-vtjoin"]') || {}).content === 'off') return;
  const W = 1920, H = 1080, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const TYPE = { SE: 'Single elimination', DE: 'Double elimination', RR: 'Round robin', SW: 'Swiss' };

  const css = `
@font-face{font-family:'Saira Condensed';font-weight:800;font-display:swap;src:url(/static/fonts/saira-condensed-latin-800-normal.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:700;font-display:swap;src:url(/static/fonts/chakra-petch-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:600;font-display:swap;src:url(/static/fonts/chakra-petch-latin-600-normal.woff2) format('woff2')}
#sb-vtjoin{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9050;display:none;overflow:hidden;pointer-events:none;color:var(--sk-ink,#fff);font-family:'Chakra Petch',sans-serif;--ok:#2ee59d}
#sb-vtjoin.sk-light{--ok:#0f9d63}
#sb-vtjoin.on{display:block}
#sb-vtjoin .vj-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 22% 40%,color-mix(in srgb,var(--sk-acc) 38%,transparent),transparent 70%),radial-gradient(ellipse 60% 70% at 85% 70%,rgba(46,229,157,.10),transparent 70%),linear-gradient(160deg,var(--sk-bg1),var(--sk-bg2) 60%)}
#sb-vtjoin .vj-grid{position:absolute;inset:0;background:linear-gradient(color-mix(in srgb,var(--sk-hot) 8%,transparent) 1px,transparent 1px) 0 0/64px 64px,linear-gradient(90deg,color-mix(in srgb,var(--sk-hot) 8%,transparent) 1px,transparent 1px) 0 0/64px 64px;-webkit-mask:radial-gradient(ellipse 80% 80% at 30% 45%,#000,transparent 75%);mask:radial-gradient(ellipse 80% 80% at 30% 45%,#000,transparent 75%)}
#sb-vtjoin .vj-left{position:absolute;left:110px;top:150px;width:760px}
#sb-vtjoin .vj-kicker{font:700 22px/1 'Chakra Petch';letter-spacing:8px;text-transform:uppercase;color:var(--sk-acc)}
#sb-vtjoin:not(.sk-light) .vj-kicker{color:var(--sk-hot)}
#sb-vtjoin .vj-name{margin-top:18px;font:800 112px/1.02 var(--sk-fd,'Saira Condensed');font-style:var(--sk-fi,normal);text-transform:uppercase;letter-spacing:1px;
  background:var(--sk-name);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding-right:.12em}
#sb-vtjoin .vj-meta{margin-top:14px;font:600 24px/1.3 'Chakra Petch';color:var(--sk-sub);letter-spacing:1px}
#sb-vtjoin .vj-how{margin-top:64px;font:700 24px/1 'Chakra Petch';letter-spacing:6px;text-transform:uppercase;color:var(--sk-muted)}
#sb-vtjoin .vj-cmd{margin-top:20px;display:flex;align-items:center;gap:22px;font:800 64px/1 var(--sk-fd,'Saira Condensed');text-transform:uppercase}
#sb-vtjoin .vj-cmd kbd{font:inherit;display:inline-block;padding:16px 30px 12px;border-radius:16px;background:var(--sk-acc);color:var(--sk-kbd);box-shadow:0 8px 0 color-mix(in srgb,var(--sk-acc) 55%,#000),0 18px 40px color-mix(in srgb,var(--sk-acc) 50%,transparent);text-transform:none;letter-spacing:1px}
#sb-vtjoin .vj-cmd small{font:600 30px/1.2 'Chakra Petch';text-transform:none;color:var(--sk-sub)}
#sb-vtjoin .vj-status{margin-top:60px;display:inline-flex;align-items:center;gap:14px;padding:14px 26px;border-radius:999px;font:700 24px/1 'Chakra Petch';letter-spacing:4px;text-transform:uppercase;background:color-mix(in srgb,var(--ok) 12%,transparent);color:var(--ok);border:2px solid color-mix(in srgb,var(--ok) 50%,transparent)}
#sb-vtjoin .vj-status i{width:14px;height:14px;border-radius:50%;background:var(--ok);box-shadow:0 0 14px var(--ok);animation:vj-pulse 1.4s ease-in-out infinite}
#sb-vtjoin .vj-status.vj-closed{background:var(--sk-chip);color:var(--sk-sub);border-color:var(--sk-line)}#sb-vtjoin .vj-status.vj-closed i{background:#ffb020;box-shadow:0 0 14px #ffb020;animation:none}
@keyframes vj-pulse{50%{transform:scale(1.5);opacity:.5}}
#sb-vtjoin .vj-right{position:absolute;right:100px;top:120px;width:860px;height:840px;border-radius:28px;background:var(--sk-pn);border:2px solid var(--sk-line);box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden}
#sb-vtjoin .vj-rh{display:flex;align-items:flex-end;justify-content:space-between;padding:34px 40px 22px;border-bottom:2px solid var(--sk-line)}
#sb-vtjoin .vj-rh b{font:700 22px/1 'Chakra Petch';letter-spacing:6px;text-transform:uppercase;color:var(--sk-muted)}
#sb-vtjoin .vj-rh em{font:800 84px/.8 var(--sk-fd,'Saira Condensed');font-style:normal;color:var(--sk-ink)}#sb-vtjoin .vj-rh em small{font-size:40px;color:var(--sk-muted);margin-left:6px}
#sb-vtjoin .vj-list{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:46px;gap:8px 18px;padding:24px 40px;align-content:start}
#sb-vtjoin .vj-list.vj-dense{grid-template-columns:1fr 1fr 1fr;grid-auto-rows:38px;gap:6px 14px}
#sb-vtjoin .vj-p{display:flex;align-items:center;gap:12px;min-width:0;padding:0 14px;border-radius:10px;background:var(--sk-chip);font:700 24px/1 'Chakra Petch';color:var(--sk-ink)}
#sb-vtjoin .vj-dense .vj-p{font-size:19px;padding:0 10px}
#sb-vtjoin .vj-p i{font-style:normal;color:var(--sk-acc);font:800 26px/1 var(--sk-fd,'Saira Condensed');min-width:34px}
#sb-vtjoin .vj-dense .vj-p i{font-size:21px;min-width:28px}
#sb-vtjoin .vj-p span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#sb-vtjoin .vj-p.vj-new{animation:vj-new .7s cubic-bezier(.2,.9,.3,1.3)}
@keyframes vj-new{0%{transform:scale(.6);opacity:0;background:var(--sk-acc)}60%{transform:scale(1.06);opacity:1;background:var(--sk-acc)}100%{transform:none}}
#sb-vtjoin .vj-empty{grid-column:1/-1;padding:120px 0;text-align:center;font:700 30px/1.4 'Chakra Petch';color:var(--sk-muted)}
#sb-vtjoin .vj-more{position:absolute;left:0;right:0;bottom:0;padding:18px 40px;text-align:right;font:700 20px/1 'Chakra Petch';letter-spacing:3px;color:var(--sk-muted);background:linear-gradient(transparent,var(--sk-p1) 40%)}
#sb-vtjoin.in .vj-left{animation:vj-left .7s cubic-bezier(.2,.8,.3,1) both}#sb-vtjoin.in .vj-right{animation:vj-right .7s .1s cubic-bezier(.2,.8,.3,1) both}
#sb-vtjoin.in .vj-bg,#sb-vtjoin.in .vj-grid{animation:vj-fade .45s both}
#sb-vtjoin.out{animation:vj-fade .4s reverse both}
@keyframes vj-left{from{opacity:0;transform:translateX(-120px)}}@keyframes vj-right{from{opacity:0;transform:translateX(140px)}}@keyframes vj-fade{from{opacity:0}}
.sb-potato #sb-vtjoin *,.sb-potato #sb-vtjoin{animation:none!important}`;

  let root = null, shown = false, data = window.__SB_VT || null, known = new Set(), hideT = 0, skin = '';
  function mount() {
    if (root) return;
    // dressed in the live layout's look (Ember, Oni, Frostbite…): public/sb-skin.js
    const K = window.SBSkin; skin = K ? K.id(document) : '';
    const st = document.createElement('style'); st.textContent = css + (K ? K.faces(skin) + K.css(skin, '#sb-vtjoin.sk-' + skin, 'join') : ''); document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'sb-vtjoin'; root.setAttribute('aria-hidden', 'true');
    root.style.cssText = K ? K.vars(skin) : '';
    root.innerHTML = '<div class="vj-bg"></div><div class="vj-grid"></div><div class="vj-left"></div><div class="vj-right"></div>';
    document.body.appendChild(root);
  }
  function draw(fresh) {
    if (!root) return;
    const d = data || {}, list = (d.entrants || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0)), n = d.count || list.length;
    const meta = [d.ft ? `First to ${d.ft}` : '', TYPE[d.type] || '', d.max ? `Up to ${d.max} players` : ''].filter(Boolean).join('  ·  ');
    const cmds = (d.cmd || ['!enter']).map(c => `<kbd>${esc(c)}</kbd>`).join('<small>or</small>');
    const open = !!d.open && d.status === 'signup';
    root.querySelector('.vj-left').innerHTML = `<div class="vj-kicker">Viewer tournament</div><div class="vj-name">${esc(d.name || 'Viewer Tournament')}</div><div class="vj-meta">${esc(meta)}</div>
      <div class="vj-how">How to join</div><div class="vj-cmd"><small>Type</small>${cmds}<small>in chat</small></div>
      <div class="vj-status${open ? '' : ' vj-closed'}"><i></i>${open ? 'Sign-ups open' : d.status === 'signup' ? 'Sign-ups closed — starting soon' : 'The bracket has started'}</div>`;
    const cap = 30, dense = list.length > 20, shownList = list.slice(0, dense ? cap : 20);
    const rows = shownList.map((p, i) => `<div class="vj-p${fresh && !known.has(p.name) ? ' vj-new' : ''}"><i>${i + 1}</i><span>${esc(p.name)}</span></div>`).join('');
    root.querySelector('.vj-right').innerHTML = `<div class="vj-rh"><b>Players in</b><em>${n}${d.max ? `<small>/ ${d.max}</small>` : ''}</em></div>
      <div class="vj-list${dense ? ' vj-dense' : ''}">${rows || '<div class="vj-empty">Be the first — type !enter</div>'}</div>${list.length > shownList.length ? `<div class="vj-more">+ ${list.length - shownList.length} more</div>` : ''}`;
    known = new Set(list.map(p => p.name));
    fitName(); if (document.fonts) document.fonts.ready.then(fitName);        // (again once the display font is in: the fallback is wider)
  }
  function fitName() {      // a long name: smaller, on up to two lines
    const nm = root && root.querySelector('.vj-name'); if (!nm) return; let fs = 112; nm.style.fontSize = fs + 'px';
    const tooBig = () => nm.scrollHeight > parseFloat(getComputedStyle(nm).lineHeight) * 2.5 || nm.scrollWidth > nm.clientWidth + 2;     // more than two lines, or one word wider than the space
    while (fs > 54 && tooBig()) { fs -= 6; nm.style.fontSize = fs + 'px'; }
  }
  const skinCls = () => skin ? ` sk-${skin}${window.SBSkin && window.SBSkin.light(skin) ? ' sk-light' : ''}` : '';
  function want(s) { return !!(s && s.splash && s.splash.show === 'vtjoin'); }
  function show(instant) {
    mount(); clearTimeout(hideT); shown = true; draw(false);
    root.className = 'on' + (instant || POTATO() ? '' : ' in') + skinCls();
  }
  function hide() {
    if (!root || !shown) return; shown = false;
    if (POTATO()) { root.className = skinCls(); return; }
    root.className = 'on out' + skinCls(); hideT = setTimeout(() => { if (!shown) root.className = skinCls(); }, 420);
  }
  addEventListener('scoreboard', e => { const s = e.detail || {}; if (want(s) && !shown) show(!!window.__SB_INSTANT); else if (!want(s) && shown) hide(); });
  addEventListener('scoreboard:vt', e => { data = e.detail; if (shown) draw(true); });
})();
