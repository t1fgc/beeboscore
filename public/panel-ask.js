/* BeeboScore — a small "type something" window for the panel (developed by Beebo).
 *
 * The desktop app has no prompt(): the browser's own text box does not exist there, so anything that asked with it
 * did nothing. This gives the panel its own:
 *
 *   BeeboPanel.ask('Save as:', { value: 'Crimson Crew' })                  → Promise<string | null>
 *   BeeboPanel.ask('Paste names…', { lines: true, hint: 'One per line' })  → Promise<string | null>   (a box for many lines)
 *   BeeboPanel.ask('Load it into which team?', { choices: ['Team 1', 'Team 2'] })  → Promise<number | null>   (which button)
 *
 * null means it was closed without an answer (Cancel, Esc, or a click outside).
 */
(() => {
  'use strict';
  const P = window.BeeboPanel; if (!P || P.ask) return;
  const esc = P.esc;
  const st = document.createElement('style');
  st.textContent = `
.pk-ask{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(4,6,12,.66);padding:20px}
.pk-ask-box{width:min(460px,100%);background:var(--card);border:1px solid var(--line-2,var(--line));border-radius:14px;padding:18px 18px 16px;box-shadow:0 24px 70px rgba(0,0,0,.55)}
.pk-ask-box label{display:block;font-weight:700;font-size:14px;line-height:1.4;color:var(--text);margin-bottom:10px}
.pk-ask-box small{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin:-4px 0 10px}
.pk-ask-box input,.pk-ask-box textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;color:var(--text);background:var(--bg-2);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.pk-ask-box textarea{min-height:170px;resize:vertical;line-height:1.45}
.pk-ask-box input:focus-visible,.pk-ask-box textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.pk-ask-btns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
.pk-ask-btns .btn{min-width:84px;justify-content:center}`;
  document.head.appendChild(st);

  P.ask = (message, o = {}) => new Promise(resolve => {
    const back = document.activeElement, id = 'pkAsk' + Date.now();
    const w = document.createElement('div'); w.className = 'pk-ask'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', id + 'l');
    const field = o.choices ? '' : o.lines ? `<textarea id="${id}" spellcheck="false"></textarea>` : `<input id="${id}" type="text" maxlength="${Number(o.max) || 80}" autocomplete="off" spellcheck="false">`;
    const btns = o.choices ? o.choices.map((c, i) => `<button class="btn${i ? '' : ' primary'}" data-i="${i}">${esc(c)}</button>`).join('') + '<button class="btn ghost" data-x>Cancel</button>'
      : `<button class="btn ghost" data-x>Cancel</button><button class="btn primary" data-ok>${esc(o.ok || 'OK')}</button>`;
    w.innerHTML = `<div class="pk-ask-box"><label id="${id}l" for="${id}">${esc(message)}</label>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}${field}<div class="pk-ask-btns">${btns}</div></div>`;
    document.body.appendChild(w);
    const inp = w.querySelector('input,textarea');
    const done = v => { w.remove(); document.removeEventListener('keydown', key, true); if (back && back.focus) try { back.focus(); } catch {} resolve(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && inp && (!o.lines || e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); done(inp.value); }
      else if (e.key === 'Tab') {                                   // keep Tab inside the window
        const f = [...w.querySelectorAll('input,textarea,button')], i = f.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        e.preventDefault(); f[n].focus();
      }
    };
    document.addEventListener('keydown', key, true);
    w.addEventListener('mousedown', e => { if (e.target === w) done(null); });
    w.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if ('x' in b.dataset) done(null); else if ('ok' in b.dataset) done(inp.value); else if ('i' in b.dataset) done(Number(b.dataset.i));
    });
    if (inp) { inp.value = o.value || ''; inp.focus(); if (!o.lines) inp.select(); } else w.querySelector('button').focus();
  });
})();
