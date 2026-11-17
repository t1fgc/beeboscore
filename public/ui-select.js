/* BeeboScore (developed by Beebo) — the Designer themes' dropdowns. Every <select> in the panel gets a button in the
 * theme's own field art (a Layout Designer design) and a list that pops up in the theme's panel art, with a filter for
 * long lists and the keyboard (↑ ↓ Enter Esc, type to jump). The real <select> stays underneath, so everything that
 * reads or sets it keeps working. Only while a Designer theme is on (html.ui-x); Classic and Ember keep the native ones.
 */
(() => {
  'use strict';
  const on = () => document.documentElement.classList.contains('ui-x');
  const VDESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const IDESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const skip = s => s.multiple || s.size > 1 || s.dataset.native != null || s.closest('.ux-sel, .ux-pop, [data-native-selects], .sd-root, #dzFrame');
  const all = new Set();
  let pop = null, popFor = null;

  function label(sel) { const o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ''; }
  function refresh(sel) {
    const w = sel.__ux; if (!w) return;
    const t = label(sel);
    if (w.lab.textContent !== t) w.lab.textContent = t;
    w.btn.disabled = sel.disabled;
    w.wrap.hidden = sel.hidden || sel.style.display === 'none';
    w.btn.title = sel.title || '';
  }
  function enhance(sel) {
    if (sel.__ux || skip(sel)) return;
    const wrap = document.createElement('span'); wrap.className = 'ux-sel';
    for (const k of ['width', 'maxWidth', 'minWidth', 'flex']) if (sel.style[k]) wrap.style[k] = sel.style[k];
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ux-sel-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    const lab = document.createElement('span'); btn.appendChild(lab);
    const lbl = sel.id && document.querySelector(`label[for="${CSS.escape(sel.id)}"]`);
    if (lbl) { if (!lbl.id) lbl.id = 'uxl-' + sel.id; btn.setAttribute('aria-labelledby', lbl.id); } else if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel); wrap.appendChild(btn);
    sel.tabIndex = -1;
    const mo = new MutationObserver(() => refresh(sel)); mo.observe(sel, { childList: true, subtree: true, attributes: true, characterData: true });
    const sync = () => refresh(sel);
    sel.addEventListener('change', sync); sel.addEventListener('input', sync);
    // code that sets .value or .selectedIndex (no event): the button follows
    Object.defineProperty(sel, 'value', { configurable: true, get() { return VDESC.get.call(this); }, set(v) { VDESC.set.call(this, v); refresh(this); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return IDESC.get.call(this); }, set(v) { IDESC.set.call(this, v); refresh(this); } });
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (popFor === sel) close(); else open(sel); });
    btn.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(sel); } });
    sel.__ux = { wrap, btn, lab, mo };
    all.add(sel); refresh(sel);
  }
  function restore(sel) {
    const w = sel.__ux; if (!w) return;
    w.mo.disconnect(); delete sel.value; delete sel.selectedIndex; sel.tabIndex = 0;
    if (w.wrap.parentNode) { w.wrap.parentNode.insertBefore(sel, w.wrap); w.wrap.remove(); }
    delete sel.__ux; all.delete(sel);
  }
  // ---- the list
  function items(sel) {
    const out = [];
    for (const n of sel.children) {
      if (n.tagName === 'OPTGROUP') { out.push({ grp: n.label }); for (const o of n.children) out.push({ o }); }
      else if (n.tagName === 'OPTION') out.push({ o: n });
    }
    return out;
  }
  function open(sel) {
    close();
    const w = sel.__ux; if (!w || w.btn.disabled) return;
    const list = items(sel), many = list.filter(x => x.o).length > 9;
    pop = document.createElement('div'); pop.className = 'ux-pop'; pop.setAttribute('role', 'listbox'); popFor = sel;
    pop.innerHTML = (many ? '<input type="search" class="ux-filter" placeholder="Type to filter…" aria-label="Filter the list">' : '') + '<div class="ux-list"></div>';
    document.body.appendChild(pop);
    let act = Math.max(0, sel.selectedIndex), q = '';
    const draw = () => {
      const ql = q.toLowerCase(); let i = -1, h = '';
      for (const x of list) {
        if (x.grp != null) { h += `<div class="ux-grp">${esc(x.grp)}</div>`; continue; }
        i++; if (ql && !x.o.textContent.toLowerCase().includes(ql)) continue;
        h += `<button type="button" class="ux-opt${x.o.selected ? ' sel' : ''}${i === act ? ' act' : ''}" data-i="${i}" role="option" aria-selected="${x.o.selected}" ${x.o.disabled ? 'disabled' : ''}>${esc(x.o.textContent.trim()) || '&nbsp;'}</button>`;
      }
      pop.querySelector('.ux-list').innerHTML = h || '<div class="ux-none">Nothing matches.</div>';
      const a = pop.querySelector('.ux-opt.act'); if (a) a.scrollIntoView({ block: 'nearest' });
    };
    draw();
    const r = w.btn.getBoundingClientRect(), H = Math.min(innerHeight * .6, 420), below = innerHeight - r.bottom > Math.min(H, pop.offsetHeight) + 12 || r.top < innerHeight / 2;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 180) - 8)) + 'px'; pop.style.minWidth = Math.max(r.width, 180) + 'px';
    if (below) pop.style.top = (r.bottom + 4) + 'px'; else pop.style.bottom = (innerHeight - r.top + 4) + 'px';
    w.btn.setAttribute('aria-expanded', 'true');
    const pick = i => { const o = sel.options[i]; if (!o || o.disabled) return; VDESC.set.call(sel, o.value); IDESC.set.call(sel, i); refresh(sel); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); close(); w.btn.focus(); };
    pop.addEventListener('click', e => { const b = e.target.closest('.ux-opt'); if (b && !b.disabled) pick(+b.dataset.i); });
    pop.addEventListener('mousedown', e => e.stopPropagation());
    const f = pop.querySelector('.ux-filter'); if (f) { f.addEventListener('input', () => { q = f.value; draw(); }); setTimeout(() => f.focus(), 0); } else pop.tabIndex = -1, setTimeout(() => pop.focus(), 0);
    let typed = '', typedT = 0;
    pop.addEventListener('keydown', e => {
      const vis = [...pop.querySelectorAll('.ux-opt:not([disabled])')].map(b => +b.dataset.i); if (!vis.length && e.key !== 'Escape') return;
      const k = vis.indexOf(act);
      if (e.key === 'ArrowDown') { e.preventDefault(); act = vis[Math.min(vis.length - 1, k + 1)]; draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = vis[Math.max(0, k - 1)]; draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(vis.includes(act) ? act : vis[0]); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(); w.btn.focus(); }
      else if (!f && e.key.length === 1) { clearTimeout(typedT); typed += e.key.toLowerCase(); typedT = setTimeout(() => { typed = ''; }, 700); const hit = vis.find(i => sel.options[i].textContent.trim().toLowerCase().startsWith(typed)); if (hit != null) { act = hit; draw(); } }
    });
  }
  function close() { if (pop) { pop.remove(); pop = null; } if (popFor && popFor.__ux) popFor.__ux.btn.setAttribute('aria-expanded', 'false'); popFor = null; }
  document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target)) close(); });
  addEventListener('resize', close); document.addEventListener('scroll', e => { if (pop && !pop.contains(e.target)) close(); }, true);
  // ---- on / off with the theme, and selects added later
  let scanT = 0;
  const scan = () => { clearTimeout(scanT); scanT = setTimeout(() => { if (!on()) return; for (const s of document.querySelectorAll('select')) enhance(s); for (const s of [...all]) { if (!s.isConnected) { s.__ux && s.__ux.mo.disconnect(); all.delete(s); } else refresh(s); } }, 30); };
  new MutationObserver(muts => { if (on() && muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.tagName === 'SELECT' || n.querySelector && n.querySelector('select'))))) scan(); }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('beebo:theme', () => { if (on()) scan(); else { close(); for (const s of [...all]) restore(s); } });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', scan); else scan();
  window.BeeboSelect = { refresh: s => refresh(s), scan };
})();
