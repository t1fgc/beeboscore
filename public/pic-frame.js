/* BeeboScore (developed by Beebo) — a player's picture: its size and where it sits (Testbuild 1.12.6).
 *
 * One setting per player (kept by name, on this PC) used on every screen that shows their picture: FullVS, GlassVS and the
 * PlayerCards along the bottom. The window shows the picture in all three shapes while you move the sliders, and the
 * overlay follows live.
 *
 *   BeeboPicFrame.open({ name, src })   → Promise (resolves when the window closes)
 */
(() => {
  'use strict';
  if (window.BeeboPicFrame) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const P = () => window.BeeboPanel || {};
  const css = `
.pf-back{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:18px}
.pf{width:min(760px,100%);max-height:calc(100vh - 36px);overflow:auto;background:var(--card);border:1px solid var(--line-2,var(--line));border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.6);padding:18px 20px}
.pf h3{margin:0 0 4px;font-size:17px}.pf .hint{margin:0 0 14px}
.pf-prev{display:flex;gap:14px;align-items:flex-end;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.pf-box{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.pf-f{position:relative;overflow:hidden;border-radius:6px;background:linear-gradient(180deg,#1b1d26,#0b0c11);box-shadow:0 0 0 2px var(--accent,#e9b83c)}
.pf-f img{position:absolute;inset:0;width:100%;height:100%;transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1))}
.pf-f.full{width:150px;height:180px}.pf-f.full img{object-fit:contain;object-position:50% 100%;transform-origin:50% 100%}
.pf-f.glass{width:125px;height:150px}.pf-f.glass img{object-fit:contain;object-position:50% 100%;transform-origin:50% 60%}
.pf-f.card{width:86px;height:86px}.pf-f.card img{object-fit:cover;object-position:50% 22%;transform-origin:50% 40%}
.pf-row{display:grid;grid-template-columns:120px 1fr 56px;gap:12px;align-items:center;margin:8px 0}
.pf-row input[type=range]{width:100%;accent-color:var(--accent)}.pf-row b{text-align:right;font-variant-numeric:tabular-nums}
.pf-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}`;
  let styled = false;

  function open({ name, src }) {
    if (!styled) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    return new Promise(async done => {
      let cur = { z: 1, x: 0, y: 0 };
      try { const all = await P().api('/api/player-frames'); const f = all[String(name).trim().toLowerCase()]; if (f) cur = { z: f.z, x: f.x, y: f.y }; } catch {}
      const back = document.createElement('div'); back.className = 'pf-back';
      const box = n => `<div class="pf-box"><div class="pf-f ${n}"><img src="${esc(src)}" alt=""></div>${{ full: 'FullVS', glass: 'GlassVS', card: 'PlayerCard' }[n]}</div>`;
      back.innerHTML = `<div class="pf" role="dialog" aria-label="Picture size for ${esc(name)}">
        <h3>${esc(name)} — picture size</h3><p class="hint">Bigger, smaller, or moved — the same on FullVS, GlassVS and the PlayerCards. The overlay follows as you move the sliders.</p>
        <div class="pf-prev">${box('full')}${box('glass')}${box('card')}</div>
        <label class="pf-row"><span>Size</span><input type="range" min="50" max="250" step="1" data-k="z"><b data-v="z"></b></label>
        <label class="pf-row"><span>Left / right</span><input type="range" min="-50" max="50" step="1" data-k="x"><b data-v="x"></b></label>
        <label class="pf-row"><span>Up / down</span><input type="range" min="-50" max="50" step="1" data-k="y"><b data-v="y"></b></label>
        <div class="pf-acts"><button class="btn ghost" data-a="reset">Reset</button><button class="btn primary" data-a="done">Done</button></div></div>`;
      document.body.appendChild(back);
      const show = () => {
        back.querySelectorAll('.pf-f').forEach(f => { f.style.setProperty('--pz', cur.z); f.style.setProperty('--px', cur.x + '%'); f.style.setProperty('--py', cur.y + '%'); });
        back.querySelector('[data-k=z]').value = Math.round(cur.z * 100); back.querySelector('[data-v=z]').textContent = Math.round(cur.z * 100) + '%';
        for (const k of ['x', 'y']) { back.querySelector(`[data-k=${k}]`).value = cur[k]; back.querySelector(`[data-v=${k}]`).textContent = (cur[k] > 0 ? '+' : '') + cur[k]; }
      };
      let t = 0;
      const save = () => { clearTimeout(t); t = setTimeout(() => P().api('/api/player-frame', { method: 'POST', body: { name, ...cur } }).catch(e => P().toast && P().toast(e.message, true)), 120); };
      back.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; cur[k] = k === 'z' ? Number(e.target.value) / 100 : Number(e.target.value); show(); save(); });
      const close = () => { clearTimeout(t); P().api('/api/player-frame', { method: 'POST', body: { name, ...cur } }).catch(() => {}); back.remove(); removeEventListener('keydown', key); done(cur); };
      const key = e => { if (e.key === 'Escape') close(); };
      addEventListener('keydown', key);
      back.addEventListener('click', e => {
        if (e.target === back) return close();
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'reset') { cur = { z: 1, x: 0, y: 0 }; show(); save(); } else close();
      });
      show();
    });
  }
  window.BeeboPicFrame = { open };
})();
