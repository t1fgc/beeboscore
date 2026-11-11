'use strict';
/*
 * The viewers' live bracket page (/watch/<token>): read-only, behind an unguessable link (lib/share.js makes the
 * links), with live updates pushed over one open connection per viewer (server-sent events) and plain JSON for
 * anything that can't hold one open. Also: the page template (public/watch.html) filled in with the tournament, a
 * strict Content-Security-Policy, rate limits, and the "where am I?" answer chat commands use.
 *
 * Nothing here can change anything: it only ever answers GET and HEAD.
 */
const crypto = require('crypto');
const fs = require('fs');

const htmlEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonInHtml = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

/**
 * templateFile: public/watch.html
 * slotFor(token) → the share slot ('vt' | 'sgg') that token opens, or '' when it's closed / wrong
 * dataFor(slot) → the watch data for that slot ({} when there's none)
 */
function createWatch({ templateFile, slotFor, dataFor, limits = {} }) {
  const L = { perIp: 300, all: 12000, streams: 600, streamsPerIp: 25, ...limits };
  let tpl = null;
  function template() {
    if (tpl) return tpl;
    const html = fs.readFileSync(templateFile, 'utf8');
    const code = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
    tpl = { html, hash: crypto.createHash('sha256').update(code, 'utf8').digest('base64') };
    return tpl;
  }
  /** the page, filled in: boot = { data, events, page, snapshot }; csp → a <meta> (for the exported file) */
  function page(boot, csp, fallbackTitle = 'Live bracket') {
    const t = template(), title = (boot.snapshot && boot.snapshot.title) || fallbackTitle;
    return t.html.replace('<!--CSP-->', csp ? `<meta http-equiv="Content-Security-Policy" content="${htmlEsc(csp)}">` : '').split('__TITLE__').join(htmlEsc(title)).replace('__BOOT__', () => jsonInHtml(boot));
  }
  const fileCsp = origins => `default-src 'none'; script-src 'sha256-${template().hash}'; style-src 'unsafe-inline'; connect-src ${origins.join(' ')}; img-src data:; base-uri 'none'; form-action 'none'`;

  // ---- limits: per viewer address (a venue's Wi-Fi shares one, so it's generous) and for the whole page, per minute
  const hits = new Map(); let all = { n: 0, t: Date.now() };
  const ipOf = req => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
  function limited(req) {
    const ip = ipOf(req), now = Date.now();
    if (now - all.t > 60000) all = { n: 0, t: now };
    if (++all.n > L.all) return true;
    const h = hits.get(ip) || { n: 0, t: now };
    if (now - h.t > 60000) { h.n = 0; h.t = now; }
    h.n++; hits.set(ip, h);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k);
    return h.n > L.perIp;
  }

  // ---- live updates: one open connection per viewer instead of asking every few seconds
  const streams = new Set(), last = {};
  function push(slot) {
    const body = JSON.stringify(dataFor(slot) || {});
    if (body === last[slot]) return; last[slot] = body;
    for (const c of streams) if (c.slot === slot) { try { c.res.write(`data: ${body}\n\n`); } catch {} }
  }
  function closeAll(slot) { for (const c of [...streams]) if (c.slot === slot) { try { c.res.write('event: closed\ndata: {}\n\n'); c.res.end(); } catch {} streams.delete(c); } }
  const ping = setInterval(() => { for (const c of streams) { try { c.res.write(': ping\n\n'); } catch {} } }, 25000); if (ping.unref) ping.unref();

  /** handles /watch/… — returns true when it answered */
  function handle(req, res, p, method) {
    if (!p.startsWith('/watch/')) return false;
    const wm = p.match(/^\/watch\/([A-Za-z0-9_-]{20,64})(\/data|\/events)?$/);
    const head = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
    if (method !== 'GET' && method !== 'HEAD') { res.writeHead(405, { ...head, Allow: 'GET' }); res.end(); return true; }
    if (limited(req)) { res.writeHead(429, { ...head, 'Retry-After': '30', 'Access-Control-Allow-Origin': '*' }); res.end(); return true; }
    const slot = wm ? slotFor(wm[1]) : '';
    if (!slot) {
      if (wm && wm[2]) { res.writeHead(410, { ...head, 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }); res.end('{"error":"closed"}'); return true; }
      res.writeHead(404, { ...head, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      res.end('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bracket link closed</title><body style="font:16px system-ui;background:#0b0c12;color:#eee;display:grid;place-items:center;height:90vh;text-align:center"><div><h2>This bracket link has closed</h2><p style="color:#8e94aa">The tournament is over, or the organiser stopped sharing it.</p></div>');
      return true;
    }
    const data = () => dataFor(slot) || {};
    if (wm[2] === '/events') {
      const ip = ipOf(req);
      if (streams.size >= L.streams || [...streams].filter(c => c.ip === ip).length >= L.streamsPerIp) { res.writeHead(503, { ...head, 'Retry-After': '20', 'Access-Control-Allow-Origin': '*' }); res.end(); return true; }
      res.writeHead(200, { ...head, 'Content-Type': 'text/event-stream; charset=utf-8', 'Access-Control-Allow-Origin': '*', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 5000\n\n'); res.write(`data: ${JSON.stringify(data())}\n\n`);
      const c = { res, ip, slot }; streams.add(c);
      req.on('close', () => streams.delete(c));
      return true;
    }
    if (wm[2]) {
      const body = JSON.stringify(data()), tag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 20) + '"';
      const h = { ...head, 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag', ETag: tag };
      if (req.headers['if-none-match'] === tag) { res.writeHead(304, h); res.end(); return true; }
      res.writeHead(200, { ...h, 'Content-Type': 'application/json; charset=utf-8' }); res.end(method === 'HEAD' ? undefined : body); return true;
    }
    const html = page({ data: `/watch/${wm[1]}/data`, events: `/watch/${wm[1]}/events`, snapshot: data() }, '');
    res.writeHead(200, { ...head, 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${template().hash}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` });
    res.end(method === 'HEAD' ? undefined : html);
    return true;
  }
  return { handle, page, fileCsp, push, closeAll, template, streams };
}

/** "where am I?" for chat (!next / !where): a player's status in watch data → { text } | { none } | null */
function standingOf(d, name) {
  if (!d) return null;
  const q = String(name || '').trim().toLowerCase().replace(/^@/, ''); if (!q) return null;
  const pl = (d.players || []).find(p => p.n.toLowerCase() === q) || (d.players || []).filter(p => p.n.toLowerCase().includes(q)).sort((a, b) => a.n.length - b.n.length)[0];
  if (!pl) return { none: true };
  if (pl.place === 1) return { text: `${pl.n} won ${d.title}! 🏆` };
  if (pl.out) return { text: `${pl.n} finished ${pl.place ? ord(pl.place) : 'out'} in ${d.title}.` };
  const secs = d.pools ? d.pools.flatMap(p => (p.sections || []).map(x => ({ ...x, pool: p.pool }))) : (d.sections || []);
  const all = [...secs.flatMap(x => x.cols.flatMap(c => c.sets.map(s => ({ ...s, round: (x.pool && d.pools.length > 1 ? `Pool ${x.pool} · ` : '') + c.name })))), ...((d.grid && d.grid.sets) || []).map(s => ({ ...s, round: d.grid.round }))];
  const s = all.find(x => x.st !== 'done' && [x.a.n, x.b.n].includes(pl.n));
  if (!s) return { text: `${pl.n} is still in — waiting for the next round.` };
  const vs = s.a.n === pl.n ? s.b.n : s.a.n;
  return { text: s.st === 'live' ? `${pl.n} is on stream right now${vs ? ` vs ${vs}` : ''} (${s.round})!` : vs ? `${pl.n} plays ${vs} next (${s.round})${s.stn ? ` — Station ${s.stn}` : s.st === 'next' ? ' — up next on stream' : ''}.` : `${pl.n} is in ${s.round} — waiting for an opponent.` };
}

module.exports = { createWatch, standingOf, htmlEsc, jsonInHtml };
