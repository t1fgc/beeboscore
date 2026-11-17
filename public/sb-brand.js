/* BeeboScore (developed by Beebo) — the event's logo and its sponsors on stream (Testbuild 1.12.9).
 * state.brand = { logo, sponsors: [{ url, name }], splash (sponsors on the splashes), board (a sponsor badge on the scoreboard) }
 *   • on every full-screen splash (FullVS, GlassVS, Victory, the bracket, Top 8, standings, the commentary screen, a format's
 *     splashes): the logo in the top-right corner and the sponsors in a strip along the bottom;
 *   • on the scoreboard (if asked): one sponsor at a time in a small plate at the bottom centre, turning every 6 seconds —
 *     never while a format's bar is along the bottom.
 * Plates follow the layout's own (the --pl-* colours sb-format sets for Obsidian Glass, Porcelain and Default). */
(() => {
  'use strict';
  if (window.__SB_BRAND) return; window.__SB_BRAND = true;
  const H = document.documentElement, W = 1920;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = `
#sbbr{position:absolute;left:0;top:0;width:${W}px;height:1080px;pointer-events:none;z-index:9650}
#sbbr .lg{position:absolute;right:44px;top:34px;max-width:230px;max-height:110px;opacity:0;transform:translateY(-10px);transition:opacity .45s,transform .45s cubic-bezier(.2,.8,.3,1);filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
#sbbr .sp{position:absolute;left:50%;bottom:16px;transform:translate(-50%,14px);display:flex;align-items:center;gap:34px;height:56px;padding:0 34px;opacity:0;transition:opacity .45s,transform .45s cubic-bezier(.2,.8,.3,1);
  background:var(--pl-bg,linear-gradient(180deg,rgba(20,20,26,.92),rgba(6,6,10,.95)));box-shadow:inset 0 0 0 1.5px var(--pl-ring,rgba(255,255,255,.2)),0 8px 22px rgba(0,0,0,.4);clip-path:var(--pl-clip,none);border-radius:var(--pl-r,8px)}
#sbbr .sp small{font:700 11px/1 'Chakra Petch',sans-serif;letter-spacing:3px;color:var(--pl-ink,#fff);opacity:.6;text-transform:uppercase;white-space:nowrap}
#sbbr .sp img{max-height:38px;max-width:150px;object-fit:contain}
#sbbr .bd{position:absolute;left:50%;bottom:calc(48px + max(var(--sb-lane-own,0px),var(--sb-lane-app,0px)));width:250px;height:46px;transform:translateX(-50%);display:grid;place-items:center;opacity:0;transition:opacity .5s,bottom .4s cubic-bezier(.2,.8,.3,1);
  background:var(--pl-bg,linear-gradient(180deg,rgba(20,20,26,.92),rgba(6,6,10,.95)));box-shadow:inset 0 0 0 1.5px var(--pl-ring,rgba(255,255,255,.2)),0 6px 16px rgba(0,0,0,.35);clip-path:var(--pl-clip,none);border-radius:var(--pl-r,8px)}
#sbbr .bd img{grid-area:1/1;max-height:32px;max-width:200px;object-fit:contain;opacity:0;transition:opacity .6s}
#sbbr .bd img.on{opacity:1}
#sbbr.up .lg{opacity:1;transform:none}#sbbr.up .sp{opacity:1;transform:translate(-50%,0)}#sbbr.board .bd{opacity:1}
html.sb-brand-sp #sbc .mt{bottom:92px}
.sb-potato #sbbr *{transition:none!important}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sbbr'; document.body.appendChild(root);
  let B = null, key = '', rot = 0, rotT = 0;
  const splashUp = () => /\bsb-(vs|victory|bracket|comm)-on\b/.test(H.className) || H.classList.contains('sd-splash-on') || H.classList.contains('sb-comm-only')
    || !!document.querySelector('#sbf-sp.on, #sbf-lock.on, #sbv.on, .sd-scene.sd-splash:not(.sd-hidden):not(.sd-warm)');
  const formatBar = () => { const b = document.getElementById('sbf-bar'); return !!(b && !b.classList.contains('off') && b.offsetParent); };
  function build() {
    const sp = (B && B.sponsors) || [];
    const k = JSON.stringify(B); if (k === key) return; key = k;
    root.innerHTML = !B ? '' : `${B.logo ? `<img class="lg" alt="" src="${esc(B.logo)}">` : ''}${B.splash && sp.length ? `<div class="sp"><small>Sponsored by</small>${sp.map(x => `<img alt="${esc(x.name)}" src="${esc(x.url)}">`).join('')}</div>` : ''}${B.board && sp.length ? `<div class="bd">${sp.map((x, i) => `<img alt="${esc(x.name)}" src="${esc(x.url)}"${i ? '' : ' class="on"'}>`).join('')}</div>` : ''}`;
    H.classList.toggle('sb-brand-sp', !!(B && B.splash && sp.length));
    clearInterval(rotT); rot = 0;
    if (B && B.board && sp.length > 1) rotT = setInterval(() => { const im = root.querySelectorAll('.bd img'); if (!im.length || document.hidden) return; im[rot % im.length].classList.remove('on'); rot++; im[rot % im.length].classList.add('on'); }, 6000);
  }
  function tick() { const up = !!B && splashUp(); root.classList.toggle('up', up); root.classList.toggle('board', !!B && !!B.board && !up && !formatBar()); }
  window.addEventListener('scoreboard', e => { const s = e.detail || {}; B = s.brand || null; build(); tick(); });
  // 1.12.12: it looks again when something on the page changes (a splash or the format bar coming or going), at most once
  // a frame — not every 400 ms all stream long (a slow look every few seconds stays, just in case)
  let tq = 0; const soon = () => { if (!tq) tq = requestAnimationFrame(() => { tq = 0; tick(); }); };
  new MutationObserver(soon).observe(H, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  setInterval(() => { if (!document.hidden) tick(); }, 4000);
})();
