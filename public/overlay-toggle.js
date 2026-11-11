/* BeeboScore — the header's "Overlay on / Overlay hidden" button: hides the whole overlay in OBS during
 * downtime and brings it back. Goes live straight away (not on Update). Ctrl+Shift+H does the same. */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P) return;
  const btn = document.getElementById('ovBtn'); if (!btn) return;
  let hidden = false;
  const draw = () => {
    btn.classList.toggle('off', hidden);
    btn.querySelector('span').textContent = hidden ? 'Overlay hidden' : 'Overlay on';
    btn.setAttribute('aria-pressed', String(hidden));
  };
  async function toggle() {
    try { const r = await P.api('/api/remote/action', { method: 'POST', body: { action: 'overlay', show: hidden } });
      hidden = !!(r.status && r.status.hidden); draw(); P.toast(hidden ? 'Overlay hidden in OBS' : 'Overlay back on'); }
    catch (e) { P.toast(e.message, true); }
  }
  btn.addEventListener('click', toggle);
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) { e.preventDefault(); toggle(); } });
  window.addEventListener('beebo:state', e => { const s = e.detail || (P.state && P.state()); if (s && 'hidden' in s) { hidden = !!s.hidden; draw(); } });
  P.api('/api/state').then(s => { hidden = !!s.hidden; draw(); }).catch(() => {});
})();
