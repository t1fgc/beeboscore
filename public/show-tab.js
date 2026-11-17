/* BeeboScore Lite (developed by Beebo) — Settings › Your own theme, Accessibility and Output size (4K).
 * (The full BeeboScore also makes its Show, Players, Twitch and Layouts cards here; the Lite build has none of those.)
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const P = () => window.BeeboPanel || {};
  const api = (u, o) => P().api(u, o), toast = (m, bad) => P().toast && P().toast(m, bad);
  const post = (u, body) => api(u, { method: 'POST', body });
  // a file as the request's body (the panel's api() sends JSON)
  async function upload(u, f, type) { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': type || f.type || 'application/octet-stream' }, body: f }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || r.statusText); return d; }
  const act = b => post('/api/remote/action', b).catch(e => { toast(e.message, true); throw e; });
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const local = () => { const i = P().info && P().info(); return !i || i.local !== false; };
  const hm = t => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const mmss = ms => { if (ms == null) return ''; const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const icons = el => { if (window.BI && el) BI.convert(el); return el; };
  function card(host, id, html, { localOnly = false, first = false } = {}) {
    const h = typeof host === 'string' ? $(host) : host; if (!h) return null;
    const c = document.createElement('div'); c.className = 'card' + (localOnly ? ' local-only' : ''); c.id = id; c.innerHTML = html;
    if (first && h.querySelector('.card')) h.insertBefore(c, h.querySelector('.card')); else h.appendChild(c);
    return icons(c);
  }
  const tabOf = n => $(`main .tab[data-tab="${n}"]`);
  const visible = el => !!(el && el.offsetParent);
  // 1.12.19: a card reads its part again when the app says it changed (show:changed), when its tab comes back into view
  // after a change it missed, and once a minute just in case — nothing asks the app every few seconds any more
  const parts = [];
  function onPart(names, el, fn) { parts.push({ names: [].concat(names), el, fn, stale: false }); }
  addEventListener('beebo:show:changed', e => { const l = (e.detail && e.detail.parts) || []; for (const x of parts) if (x.names.some(n => l.includes(n))) { if (visible(x.el)) x.fn(); else x.stale = true; } });
  addEventListener('beebo:tab', () => setTimeout(() => { for (const x of parts) if (x.stale && visible(x.el)) { x.stale = false; x.fn(); } }, 60));
  setInterval(() => { for (const x of parts) if (x.safety !== false && visible(x.el)) x.fn(); }, 60000);
  const remember = (k, v) => { try { if (v === undefined) return localStorage.getItem('sb.' + k); localStorage.setItem('sb.' + k, String(v)); } catch (e) { return null; } };
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); };

  // ===================================================================================================== Settings tab
  // ------------------------------------------------------------------ your own theme, accessibility
  const hslHex = (h, s, l) => { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
  const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  // 1.12.20: a light background of your own gets light time fields, sliders and scrollbars to match
  const lum = h => { const p = [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return p.some(Number.isNaN) ? 0 : .2126 * p[0] + .7152 * p[1] + .0722 * p[2]; };
  const DEF_T = { bg: '#0e0f13', card: '#17191f', line: '#272a33', text: '#eceef3', muted: '#8b90a0', accent: '#ff5a1f', accent2: '#f6c453', p1: '#ff4f6d', p2: '#3fa8ff', radius: '12', font: '100' };
  window.BeeboTheme = {
    hslHex,
    get() { let t = {}; try { t = JSON.parse((P().settings() || {}).customTheme || '{}') || {}; } catch (e) {} return { ...DEF_T, ...t }; },
    apply() {
      const s = (window.BeeboPanel && P().settings()) || {}, cl = document.documentElement.classList;
      let st = document.getElementById('sbCustomTheme'); if (!st) { st = document.createElement('style'); st.id = 'sbCustomTheme'; document.head.appendChild(st); }
      const t = this.get(), css = [];
      if (cl.contains('theme-custom')) css.push(`html.theme-custom{--bg:${t.bg};--bg-2:${mix(t.bg, t.card, .5)};--card:${t.card};--card-2:${mix(t.card, t.line, .45)};--line:${t.line};--line-2:${mix(t.line, t.text, .18)};--text:${t.text};--muted:${t.muted};--faint:${mix(t.muted, t.bg, .35)};--accent:${t.accent};--accent-2:${t.accent2};--p1:${t.p1};--p2:${t.p2};--radius:${Number(t.radius) || 12}px;color-scheme:${lum(t.bg) > .45 ? 'light' : 'dark'}}`);
      if (s.cvd) css.push('html{--p1:#e69f00!important;--p2:#0072b2!important;--ok:#009e73!important;--err:#d55e00!important}');
      const z = Number(s.uiScale) || 100; css.push(z !== 100 ? `html{font-size:${z}%}body{zoom:${z / 100}}` : '');
      if (s.reduceMotion) css.push('*,*::before,*::after{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important;scroll-behavior:auto!important}');
      st.textContent = css.join('\n');
      cl.toggle('ui-cvd', !!s.cvd);
    },
  };
  function themeCard() {
    const set = tabOf('settings'); if (!set) return;
    const F = [['bg', 'Background'], ['card', 'Cards'], ['line', 'Lines'], ['text', 'Text'], ['muted', 'Quiet text'], ['accent', 'Accent'], ['accent2', 'Second accent'], ['p1', 'Player 1'], ['p2', 'Player 2']];
    const c = card(set, 'thCard', `<h2>🎨 Your own theme</h2>
      <p class="hint" style="margin:-4px 0 10px">Make the panel yours: pick its colours, how round the corners are, and use it (Look &amp; feel › <b>Your own</b>). The brand kit from your logo (Layouts tab) can fill it in for you.</p>
      <div class="th-grid">${F.map(([k, l]) => `<label><input type="color" data-t="${k}" aria-label="${l}"> ${l}</label>`).join('')}<label>Corners <input type="range" data-t="radius" min="0" max="22" aria-label="Corner roundness"></label></div>
      <div class="flexrow" style="gap:8px;margin-top:10px"><button class="btn primary" id="thUse" type="button">Use my theme</button><button class="btn ghost" id="thReset" type="button">Start again</button></div>`, { localOnly: true });
    const a = card(set, 'a11yCard', `<h2>♿ Accessibility</h2>
      <div class="opts">
        <div class="opt opt-row"><span class="opt-t"><b>Text size</b><small>Bigger text and buttons all over the panel.</small></span><select class="f" id="axSize" style="width:auto"><option value="100">Normal</option><option value="115">Large</option><option value="130">Larger</option><option value="150">Largest</option></select></div>
        <label class="toggle opt"><input type="checkbox" id="axCvd"><span class="sw"></span><span class="opt-t"><b>Colour-blind-safe colours</b><small>Orange and blue for the two sides (and green and vermilion for good and bad) in the panel, and orange and blue for the VS splashes on stream unless you picked your own colours.</small></span></label>
        <label class="toggle opt"><input type="checkbox" id="axMotion"><span class="sw"></span><span class="opt-t"><b>Less movement</b><small>No sliding or fading in the app itself, and a calmer stream: the scoreboard and its banners fade instead of sliding and slamming, and there are no rings, sparks, embers or shakes.</small></span></label>
      </div>
      <p class="hint" style="margin-top:8px">Everything in the panel works from the keyboard: <kbd>Tab</kbd> moves between controls, <kbd>Enter</kbd> or <kbd>Space</kbd> presses, and your shortcuts (Settings › Keyboard shortcuts) work anywhere. Screen readers hear each button's name and every message the app shows.</p>`);
    const S = () => P().settings() || {};
    const draw = () => { const t = window.BeeboTheme.get(); for (const i of $$('[data-t]', c)) i.value = t[i.dataset.t]; $('#axSize').value = String(S().uiScale || '100'); $('#axCvd').checked = !!S().cvd; $('#axMotion').checked = !!S().reduceMotion; window.BeeboTheme.apply(); };
    const save = (o, m) => { const r = P().saveSettings(o, m); Promise.resolve(r).then(() => setTimeout(() => window.BeeboTheme.apply(), 200)); };
    c.addEventListener('input', e => { const i = e.target.closest('[data-t]'); if (!i) return; const t = window.BeeboTheme.get(); t[i.dataset.t] = i.value; const el = document.documentElement; if (el.classList.contains('theme-custom')) { el.style.setProperty('--' + ({ accent2: 'accent-2' }[i.dataset.t] || i.dataset.t), i.dataset.t === 'radius' ? i.value + 'px' : i.value); } clearTimeout(c.__t); c.__t = setTimeout(() => save({ customTheme: JSON.stringify(t) }), 500); });
    $('#thUse').onclick = () => { save({ uiTheme: 'custom' }, 'Your own theme on'); setTimeout(() => location.reload(), 600); };
    $('#thReset').onclick = () => { save({ customTheme: JSON.stringify(DEF_T) }, 'Theme back to the start'); setTimeout(draw, 300); };
    $('#axSize').onchange = e => save({ uiScale: e.target.value }, 'Text size changed');
    $('#axCvd').onchange = e => save({ cvd: e.target.checked }, e.target.checked ? 'Colour-blind-safe colours on' : 'Colour-blind-safe colours off');
    $('#axMotion').onchange = e => save({ reduceMotion: e.target.checked });
    setTimeout(draw, 700);
    // screen readers: messages are announced, and icon-only buttons get a name
    const t = document.getElementById('toast'); if (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
    const name = () => { for (const b of $$('button:not([aria-label]),a.btn:not([aria-label])')) { if ((b.textContent || '').trim() || b.getAttribute('aria-labelledby')) continue; const n = b.title || b.dataset.tip || ''; if (n) b.setAttribute('aria-label', n); } for (const i of $$('input:not([aria-label]):not([type=hidden]),select:not([aria-label]),textarea:not([aria-label])')) { if (i.id && document.querySelector(`label[for="${i.id}"]`)) continue; if (i.closest('label') && i.closest('label').textContent.trim()) continue; const lab = i.closest('label') && i.closest('label').textContent.trim(), prev = i.previousElementSibling && /^(LABEL|B|SPAN)$/.test(i.previousElementSibling.tagName) ? i.previousElementSibling.textContent.trim() : '', box = i.closest('.urlbox'), boxLab = box && box.previousElementSibling && box.previousElementSibling.textContent.trim(), head = i.closest('.card') && i.closest('.card').querySelector('h2') ? i.closest('.card').querySelector('h2').textContent.trim() : '';
        const n = i.placeholder || i.title || lab || prev || boxLab || (head ? head + (i.type === 'checkbox' ? ' — on or off' : '') : ''); if (n) i.setAttribute('aria-label', n.slice(0, 120)); } };
    name(); new MutationObserver(() => { clearTimeout(name.t); name.t = setTimeout(name, 400); }).observe(document.body, { subtree: true, childList: true });
  }

  function outputCard() {
    const set = tabOf('settings'); if (!set) return;
    const c = card(set, 'outCard', `<h2>🖥 Output size (4K)</h2>
      <p class="hint" style="margin:-4px 0 10px">Every layout scales to its Browser Source's size. Set the source to 2560 × 1440 or 3840 × 2160 and the layouts, splashes and the effects draw sharp at that size; if the PC can't keep up, the effects drop back by themselves (and the frame rate stays at 60).</p>
      <div class="flexrow" style="gap:10px;align-items:center;flex-wrap:wrap"><label>Stream size <select class="f" id="outSel" style="width:auto"><option value="auto">Whatever the OBS source is</option><option value="1080">1920 × 1080</option><option value="1440">2560 × 1440</option><option value="2160">3840 × 2160 (4K)</option></select></label><span class="hint" id="outTip"></span></div>`, { localOnly: true });
    const tip = v => { $('#outTip').textContent = v === 'auto' ? '' : `In OBS: Browser Source width ${{ 1080: 1920, 1440: 2560, 2160: 3840 }[v]}, height ${v}.`; };
    $('#outSel').onchange = e => { tip(e.target.value); P().saveSettings({ outScale: e.target.value }, 'Output size saved'); };
    setTimeout(() => { $('#outSel').value = (P().settings() || {}).outScale || 'auto'; tip($('#outSel').value); }, 700);
  }

  // ------------------------------------------------------------------ start
  const ready = f => { if (window.BeeboPanel && tabOf('settings')) f(); else setTimeout(() => ready(f), 120); };
  ready(() => {
    try { themeCard(); outputCard(); } catch (e) { console.error('settings cards', e); }
    setTimeout(() => window.BeeboTheme.apply(), 500);
  });
})();