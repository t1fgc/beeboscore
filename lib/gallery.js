'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the online layout gallery.
 *
 * Two halves:
 *   host(dir)    the gallery itself: BeeboScore run as a website (GALLERY_HOST=1, e.g. on Render — see CLOUD-HOSTING.md)
 *                keeps the shared layouts in <dir>: GET /gallery/api/list?q=&page=, GET /gallery/api/layout/<id>,
 *                GET /gallery/api/thumb/<id>.png, POST /gallery/api/publish, POST /gallery/api/remove (with the key you
 *                got when you shared it), POST /gallery/api/report/<id>, and a page per layout at /l/<id>.
 *                Publishing is limited per address (8 an hour) and to 3 MB; a layout reported 3 times is hidden.
 *   client(url)  the app's side: browse, preview, install and share, through the app (so pages never talk to it directly).
 * The gallery's address is Settings › Layouts › Online gallery, or the one the app was built with.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ID = /^[a-z0-9]{10}$/;
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const MAX = 3 * 1024 * 1024, PER_HOUR = 8;

function checkDesign(d) {
  if (!d || typeof d !== 'object' || !d.scenes || typeof d.scenes !== 'object') throw new Error('That isn’t a Layout Designer layout.');
  const s = JSON.stringify(d); if (s.length > MAX) throw new Error('That layout is too big to share (3 MB at most — fewer or smaller pictures?).');
  if (/<script|javascript:/i.test(s)) throw new Error('Layouts with scripts can’t be shared.');
  return d;
}

function host(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const idx = path.join(dir, 'index.json');
  let list = []; try { list = JSON.parse(fs.readFileSync(idx, 'utf8')); } catch {}
  const save = () => { const t = idx + '.tmp'; fs.writeFileSync(t, JSON.stringify(list)); fs.renameSync(t, idx); };
  const hits = new Map();
  const send = (res, code, body, type = 'application/json; charset=utf-8', h = {}) => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...h }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const pub = x => ({ id: x.id, title: x.title, author: x.author, game: x.game, blurb: x.blurb, screens: x.screens, at: x.at, downloads: x.downloads || 0, thumb: `/gallery/api/thumb/${x.id}.png` });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function publish(b, ip) {
    const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 3600e3);
    if (h.length >= PER_HOUR) throw Object.assign(new Error('That’s a lot of layouts in an hour — try again later.'), { status: 429 });
    const d = checkDesign(b && b.design);
    const id = crypto.randomBytes(8).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(10, '0').slice(0, 10), key = crypto.randomBytes(18).toString('base64url');
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ beebo: 1, type: 'layout', design: d }));
    const png = String(b.thumb || '').replace(/^data:image\/png;base64,/, ''); if (png && png.length < 2.8e6) fs.writeFileSync(path.join(dir, id + '.png'), Buffer.from(png, 'base64'));
    list.unshift({ id, key: crypto.createHash('sha256').update(key).digest('hex'), title: str(b.title || d.title, 60) || 'Untitled layout', author: str(b.author, 40), game: str(d.game, 30), blurb: str(b.blurb || d.blurb, 200), screens: Object.keys(d.scenes).length, at: now, downloads: 0, reports: 0 });
    if (list.length > 5000) list.length = 5000; save(); h.push(now); hits.set(ip, h);
    return { id, key, link: `/l/${id}` };
  }
  async function handle(req, res, p, method, url, readBody, ip) {
    if (!p.startsWith('/gallery/api/') && !p.startsWith('/l/')) return false;
    if (method === 'OPTIONS') { send(res, 204, '', 'text/plain', { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return true; }
    try {
      if (p === '/gallery/api/list') {
        const q = str(url.searchParams.get('q'), 60).toLowerCase(), page = Math.max(0, Number(url.searchParams.get('page')) || 0);
        const hit = list.filter(x => (x.reports || 0) < 3 && (!q || `${x.title} ${x.author} ${x.blurb}`.toLowerCase().includes(q)));
        send(res, 200, { total: hit.length, page, items: hit.slice(page * 24, page * 24 + 24).map(pub) }); return true;
      }
      let m = p.match(/^\/gallery\/api\/layout\/([a-z0-9]{10})$/);
      if (m) { const x = list.find(y => y.id === m[1] && (y.reports || 0) < 3); if (!x) { send(res, 404, { error: 'That layout isn’t in the gallery (any more).' }); return true; } x.downloads = (x.downloads || 0) + 1; save(); send(res, 200, { ...pub(x), file: JSON.parse(fs.readFileSync(path.join(dir, x.id + '.json'), 'utf8')) }); return true; }
      m = p.match(/^\/gallery\/api\/thumb\/([a-z0-9]{10})\.png$/);
      if (m) { const f = path.join(dir, m[1] + '.png'); if (!fs.existsSync(f)) { send(res, 404, 'none', 'text/plain'); return true; } send(res, 200, fs.readFileSync(f), 'image/png', { 'Cache-Control': 'public, max-age=86400' }); return true; }
      if (p === '/gallery/api/publish' && method === 'POST') { const b = JSON.parse((await readBody(req, MAX + 3e6)).toString() || '{}'); send(res, 200, publish(b, ip)); return true; }
      if (p === '/gallery/api/remove' && method === 'POST') {
        const b = JSON.parse((await readBody(req, 4096)).toString() || '{}'), k = crypto.createHash('sha256').update(String(b.key || '')).digest('hex'), i = list.findIndex(x => x.id === b.id && x.key === k);
        if (i < 0) { send(res, 403, { error: 'That key doesn’t match.' }); return true; }
        list.splice(i, 1); save(); for (const e of ['.json', '.png']) fs.rmSync(path.join(dir, b.id + e), { force: true }); send(res, 200, { removed: true }); return true;
      }
      m = p.match(/^\/gallery\/api\/report\/([a-z0-9]{10})$/);
      if (m && method === 'POST') { const x = list.find(y => y.id === m[1]); if (x) { x.reports = (x.reports || 0) + 1; save(); } send(res, 200, { ok: true }); return true; }
      m = p.match(/^\/l\/([a-z0-9]{10})$/);
      if (m) {
        const x = list.find(y => y.id === m[1] && (y.reports || 0) < 3);
        if (!x) { send(res, 404, 'That layout isn’t in the gallery (any more).', 'text/plain; charset=utf-8'); return true; }
        send(res, 200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(x.title)} · BeeboScore layout</title>
<style>body{margin:0;background:#0e0f13;color:#eceef3;font:16px/1.5 system-ui,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}main{max-width:900px;margin:auto}img{width:100%;border-radius:12px;border:1px solid #272a33;background:#000}code{background:#17191f;padding:4px 8px;border-radius:6px;user-select:all}small{color:#8b90a0}</style>
<main><h1>${esc(x.title)}</h1><p>${x.author ? 'By ' + esc(x.author) + ' · ' : ''}${esc(x.screens)} screens · ${esc(x.game || 'Tekken 8')}</p><img alt="" src="/gallery/api/thumb/${x.id}.png"><p>${esc(x.blurb || '')}</p>
<p>To use it: in BeeboScore open <b>Layouts › Online gallery</b>, choose <b>Install from a link</b> and paste this page's address, or the code <code>${x.id}</code>.</p><small>A layout for BeeboScore, developed by Beebo.</small></main>`, 'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
        return true;
      }
    } catch (e) { send(res, e.status || 400, { error: e.message || 'That didn’t work.' }); return true; }
    send(res, 404, { error: 'Not found' }); return true;
  }
  return { handle, publish, get size() { return list.length; } };
}

/** the app's side */
function client(baseOf) {
  const base = () => String(baseOf() || '').replace(/\/+$/, '');
  async function call(p, opts = {}) {
    const b = base(); if (!b) throw new Error('The online gallery isn’t set up yet — add its address in Settings › Layouts › Online gallery.');
    let r; try { r = await fetch(b + p, { ...opts, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }); } catch { throw new Error('Couldn’t reach the online gallery.'); }
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `The gallery answered ${r.status}.`); return d;
  }
  const codeOf = s => { s = String(s || '').trim(); const m = s.match(/\/l\/([a-z0-9]{10})\b/) || s.match(/^([a-z0-9]{10})$/); return m ? m[1] : ''; };
  return {
    list: (q = '', page = 0) => call(`/gallery/api/list?q=${encodeURIComponent(q)}&page=${Number(page) || 0}`),
    get: id => { const c = codeOf(id); if (!c) throw new Error('That isn’t a gallery link or code.'); return call('/gallery/api/layout/' + c); },
    publish: b => call('/gallery/api/publish', { method: 'POST', body: JSON.stringify(b) }),
    remove: (id, key) => call('/gallery/api/remove', { method: 'POST', body: JSON.stringify({ id, key }) }),
    thumb: async id => { const b = base(); if (!b || !ID.test(id)) return null; try { const r = await fetch(`${b}/gallery/api/thumb/${id}.png`, { signal: AbortSignal.timeout(10000) }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; } catch { return null; } },
    base, codeOf,
  };
}

module.exports = { host, client, checkDesign };
