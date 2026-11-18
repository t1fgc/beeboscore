/* BeeboScore (developed by Beebo), 1.12.19 — BeeboAsk: the app's own question box.
 * The desktop app (Electron) has no prompt() at all, and its confirm() locks the whole window behind a Windows message box,
 * so every question the panel and the Layout Designer ask goes through this instead. Every call returns a Promise:
 *   BeeboAsk.text({ title, text, label, value, placeholder, max, password, minLength, multiline, list, ok, validate, allowEmpty, raw })
 *                                                                                   → the text (trimmed unless raw), or null when cancelled
 *   BeeboAsk.form({ title, text, fields: [{ id, label, type: 'number'|'text', value, min, max, step }], ok, validate })
 *                                                                                   → { id: value, … }, or null
 *   BeeboAsk.choice({ title, text, options: [{ label, value, danger, primary, hint }], list, cancel }) → the value, or null
 *   BeeboAsk.confirm({ title, text, ok, danger, cancel })                           → true or false
 * Enter accepts (Ctrl+Enter in a box with several lines), Esc cancels, Tab stays inside the box, and focus goes back to
 * whatever had it before. One box at a time: a second question waits for the first. The colours come from the page's own
 * theme tokens (the panel's --card/--accent…, or the Designer's --panel…), so it fits every theme, including "Your own".
 */
(function () {
  'use strict';
  if (window.BeeboAsk) return;
  const CSS = `
.bask-wrap{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,5,9,.62);backdrop-filter:blur(2px)}
.bask{--bk-bg:var(--card,var(--panel,#151822));--bk-in:var(--bg-2,var(--panel-2,#10121a));--bk-tx:var(--text,#eef1f7);--bk-mu:var(--muted,#8b93a7);--bk-ln:var(--line-2,var(--line,#333a50));--bk-ac:var(--accent,#e9c35e);--bk-er:var(--err,#ff4d5e);--bk-ok:var(--ok,#2fd17a);
  width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--bk-bg);color:var(--bk-tx);border:1px solid var(--bk-ln);border-radius:14px;padding:18px 20px 16px;box-shadow:0 24px 60px rgba(0,0,0,.5);font:14px/1.45 var(--font,"Segoe UI",system-ui,sans-serif);animation:bkIn .14s ease-out;text-align:left;user-select:text}
@keyframes bkIn{from{opacity:0;transform:translateY(6px) scale(.985)}}
@media (prefers-reduced-motion:reduce){.bask{animation:none}}
.bask-t{margin:0 0 8px;font-size:16px;font-weight:700;line-height:1.3}
.bask-x{margin:0 0 12px;color:var(--bk-mu);white-space:normal;overflow-wrap:anywhere}
.bask-f{display:flex;flex-direction:column;gap:5px;margin:0 0 10px}
.bask-row{display:flex;gap:10px}.bask-row>.bask-f{flex:1;min-width:0}.bask-row>.bask-f:has(input[type=number]){flex:0 1 118px}.bask[data-kind=form]:has(.bask-row){width:min(520px,100%)}
.bask-l{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--bk-mu)}
.bask-pw{display:flex;gap:6px}.bask-pw .bask-in{flex:1;min-width:0}
.bask-in{width:100%;box-sizing:border-box;background:var(--bk-in);color:var(--bk-tx);border:1px solid var(--bk-ln);border-radius:9px;padding:8px 10px;font:inherit;outline:none}
textarea.bask-in{min-height:120px;resize:vertical;font-family:var(--mono,Consolas,monospace);font-size:13px}
.bask-in:focus{border-color:var(--bk-ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--bk-ac) 22%,transparent)}
.bask-chk{font-size:12px;color:var(--bk-mu)}.bask-chk.ok{color:var(--bk-ok)}
.bask-err{margin:0 0 10px;color:var(--bk-er);font-size:13px;font-weight:600}
.bask-b{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px}
.bask-b.list{flex-direction:column;align-items:stretch}
.bask-b.list .bask-btn{flex-direction:column;align-items:flex-start;gap:1px;text-align:left}
.bask-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--bk-ln);background:transparent;color:var(--bk-tx);border-radius:9px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer;white-space:normal}
.bask-btn small{display:block;font-weight:400;color:var(--bk-mu);font-size:12px}
.bask-btn:hover{border-color:var(--bk-ac)}
.bask-btn:focus-visible{outline:2px solid var(--bk-ac);outline-offset:2px}
.bask-btn.pri{background:var(--bk-ac);border-color:var(--bk-ac);color:#141006}
.bask-btn.dgr{background:var(--bk-er);border-color:var(--bk-er);color:#fff}
.bask-btn.sm{padding:6px 10px;font-size:12px}
.bask-btn.pri small,.bask-btn.dgr small{color:inherit;opacity:.85}
`;
  let chain = Promise.resolve();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = String(txt); return e; };
  function style() {
    if (document.getElementById('baskCss')) return;
    const s = el('style'); s.id = 'baskCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

  // spec: { title, text, list, body(dlg) → { focus, value() }, validate(v) → '' | 'what is wrong', buttons: [{ label, hint, kind, role: 'ok'|'cancel'|'pick', value }], cancelValue }
  function show(spec) {
    const run = () => new Promise(resolve => {
      style();
      const back = document.activeElement, uid = 'bask' + Math.random().toString(36).slice(2, 8);
      const wrap = el('div', 'bask-wrap'), dlg = el('div', 'bask');
      dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); if (spec.kind) dlg.dataset.kind = spec.kind;
      const h = el('h3', 'bask-t', spec.title || 'BeeboScore'); h.id = uid + 't'; dlg.setAttribute('aria-labelledby', h.id); dlg.appendChild(h);
      if (spec.text) {
        const p = el('p', 'bask-x'); p.id = uid + 'x';
        String(spec.text).split('\n').forEach((line, i) => { if (i) p.appendChild(el('br')); p.appendChild(document.createTextNode(line)); });
        dlg.setAttribute('aria-describedby', p.id); dlg.appendChild(p);
      }
      const part = spec.body ? spec.body(dlg) : null;
      const err = el('p', 'bask-err'); err.setAttribute('role', 'alert'); err.hidden = true; dlg.appendChild(err);
      let closed = false;
      const finish = v => {
        if (closed) return; closed = true;
        window.removeEventListener('keydown', key, true); wrap.remove();
        try { if (back && typeof back.focus === 'function' && document.contains(back)) back.focus(); } catch (e) {}
        resolve(v);
      };
      const accept = () => {
        const v = part && part.value ? part.value() : true;
        const bad = spec.validate ? spec.validate(v) : '';
        if (bad) { err.textContent = bad; err.hidden = false; if (part && part.focus) part.focus.focus(); return; }
        finish(v);
      };
      const row = el('div', 'bask-b' + (spec.list ? ' list' : ''));
      let okBtn = null, first = null;
      for (const b of spec.buttons) {
        const btn = el('button', 'bask-btn' + (b.kind === 'primary' ? ' pri' : b.kind === 'danger' ? ' dgr' : '')); btn.type = 'button';
        btn.appendChild(document.createTextNode(b.label)); if (b.hint) btn.appendChild(el('small', '', b.hint));
        btn.dataset.bask = b.role; if (b.role === 'pick') btn.dataset.baskV = String(b.value);
        btn.onclick = () => b.role === 'ok' ? accept() : finish(b.role === 'cancel' ? spec.cancelValue : b.value);
        if (b.role === 'ok') okBtn = btn; if (!first && b.role !== 'cancel') first = btn;
        row.appendChild(btn);
      }
      dlg.appendChild(row);
      function key(e) {
        if (closed) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(spec.cancelValue); return; }
        if (e.key === 'Tab') {
          const f = [...dlg.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement); if (!f.length) return;
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
          e.stopPropagation(); return;
        }
        if (e.key === 'Enter' && !e.isComposing) {
          const t = e.target;
          if (t && t.tagName === 'BUTTON' && dlg.contains(t)) { e.stopPropagation(); return; }     // the button clicks itself
          if (t && t.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) { e.stopPropagation(); return; }
          e.preventDefault(); e.stopPropagation();
          if (okBtn) accept(); else if (first) first.click();
          return;
        }
        e.stopPropagation();                              // the panel's own shortcuts (Q, A, P, L…) wait while the box is open
      }
      window.addEventListener('keydown', key, true);
      wrap.appendChild(dlg); (document.body || document.documentElement).appendChild(wrap);
      const f = (part && part.focus) || okBtn || first || dlg.querySelector('button');
      setTimeout(() => { try { f.focus(); if (part && part.select && f.select) f.select(); } catch (e) {} }, 20);
    });
    const p = chain.then(run, run); chain = p.then(() => {}, () => {}); return p;
  }

  function field(label, input) {
    const f = el('div', 'bask-f');
    if (label) { const l = el('label', 'bask-l', label); input.id = input.id || 'bk' + Math.random().toString(36).slice(2, 8); l.htmlFor = input.id; f.appendChild(l); }
    f.appendChild(input); return f;
  }
  const okCancel = (o, kind) => [{ label: o.cancel || 'Cancel', role: 'cancel' }, { label: o.ok || 'OK', role: 'ok', kind: kind || (o.danger ? 'danger' : 'primary') }];

  function text(o = {}) {
    const min = o.minLength || 0;
    return show({
      title: o.title, text: o.text, kind: 'text', cancelValue: null, buttons: okCancel(o),
      body(dlg) {
        const i = el(o.multiline ? 'textarea' : 'input', 'bask-in');
        if (!o.multiline) i.type = o.password ? 'password' : 'text';
        i.value = o.value == null ? '' : String(o.value); if (o.placeholder) i.placeholder = o.placeholder; if (o.max) i.maxLength = o.max;
        i.autocomplete = o.password ? 'new-password' : 'off'; i.spellcheck = false; if (o.list) i.setAttribute('list', o.list);
        if (o.password) {
          const box = el('div', 'bask-pw'), tg = el('button', 'bask-btn sm', 'Show'); tg.type = 'button'; tg.dataset.baskShow = '';
          tg.onclick = () => { const on = i.type === 'password'; i.type = on ? 'text' : 'password'; tg.textContent = on ? 'Hide' : 'Show'; i.focus(); };
          const f = field(o.label, i); f.replaceChild(box, i); box.append(i, tg); dlg.appendChild(f);
          if (min) {
            const chk = el('div', 'bask-chk'); const upd = () => { const n = i.value.length; chk.textContent = n >= min ? `${min}+ characters — long enough` : `${min}+ characters (${n} so far)`; chk.classList.toggle('ok', n >= min); };
            i.addEventListener('input', upd); upd(); f.appendChild(chk);
          }
        } else dlg.appendChild(field(o.label, i));
        return { focus: i, select: !o.password, value: () => o.multiline || o.password || o.raw ? i.value : i.value.trim() };
      },
      validate(v) {
        if (!v && !o.allowEmpty) return o.empty || 'Type something first — or press Cancel.';
        if (min && v.length < min) return `That needs at least ${min} characters.`;
        return o.validate ? o.validate(v) || '' : '';
      },
    });
  }

  function form(o = {}) {
    return show({
      title: o.title, text: o.text, kind: 'form', cancelValue: null, buttons: okCancel(o),
      body(dlg) {
        const ins = [], row = el('div', o.fields.length <= 3 && !o.stack ? 'bask-row' : '');
        for (const fd of o.fields) {
          const i = el('input', 'bask-in'); i.type = fd.type === 'number' ? 'number' : 'text'; i.dataset.k = fd.id;
          i.value = fd.value == null ? '' : String(fd.value); if (fd.min != null) i.min = fd.min; if (fd.max != null) i.max = fd.max; if (fd.step != null) i.step = fd.step;
          if (fd.placeholder) i.placeholder = fd.placeholder; i.autocomplete = 'off'; ins.push([fd, i]); row.appendChild(field(fd.label, i));
        }
        dlg.appendChild(row);
        return { focus: ins[0] && ins[0][1], select: true, value: () => Object.fromEntries(ins.map(([fd, i]) => [fd.id, fd.type === 'number' ? (i.value === '' ? NaN : Number(i.value)) : i.value.trim()])) };
      },
      validate(v) {
        for (const fd of o.fields) {
          const x = v[fd.id];
          if (fd.type === 'number') { if (!Number.isFinite(x)) return `${fd.label || fd.id}: type a number.`; if (fd.min != null && x < fd.min) return `${fd.label || fd.id}: at least ${fd.min}.`; if (fd.max != null && x > fd.max) return `${fd.label || fd.id}: at most ${fd.max}.`; }
          else if (!x && fd.required !== false) return `${fd.label || fd.id}: type something first.`;
        }
        return o.validate ? o.validate(v) || '' : '';
      },
    });
  }

  function choice(o = {}) {
    const opts = (o.options || []).map(x => ({ label: x.label, hint: x.hint, role: 'pick', value: x.value, kind: x.danger ? 'danger' : x.primary ? 'primary' : '' }));
    const list = o.list || opts.length > 3;      // 1.12.20: a list of choices ends with Cancel (it was at the top when there were four or more)
    const buttons = o.cancel === false ? opts : list ? [...opts, { label: o.cancel || 'Cancel', role: 'cancel' }] : [{ label: o.cancel || 'Cancel', role: 'cancel' }, ...opts];
    return show({ title: o.title, text: o.text, kind: 'choice', list, cancelValue: o.cancelValue === undefined ? null : o.cancelValue, buttons });
  }

  function confirm(o = {}) {
    if (typeof o === 'string') o = { text: o };
    return show({ title: o.title || 'Are you sure?', text: o.text, kind: 'confirm', cancelValue: false, buttons: okCancel(o) });
  }

  window.BeeboAsk = { text, form, choice, confirm, open: () => !!document.querySelector('.bask') };
})();
