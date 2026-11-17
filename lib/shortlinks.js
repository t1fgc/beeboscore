'use strict';
/*
 * BeeboScore (developed by Beebo): short links. /s/<code> sends the browser on to a longer page of this app, so a link
 * you copy is short:  http://localhost:3000/s/k3Xa9QpL  instead of  http://localhost:3000/overlay/tekken8-shattered-league?screen=brb
 *
 * Safe to show the public:
 *   · only pages anyone may already see can have a short link: overlays (and their screens), the live bracket page,
 *     the OBS sidebars and a shared layout file. Never the control panel, the dock, the API or anything that changes something.
 *   · a code is 8 random letters and digits (about 47 bits): it cannot be guessed, and guessing is slowed down (see tooMany).
 *   · a code only ever points inside this app (a path, never another site), and a live-bracket code dies with its link.
 *   · the same page always gets the same code, so a link already in OBS keeps working after a restart.
 */
const crypto = require('crypto');

const ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // no 0/O, 1/l/I: easy to read out and type
const LEN = 8, KEEP = 400;
// the pages a short link may lead to (with only these query parameters)
const PAGES = [/^\/overlay(\/[\w-]{1,80})?$/, /^\/watch\/[\w-]{16,64}$/, /^\/vt-sidebar$/, /^\/twitch\/(sidebar|vs)$/, /^\/share\/[\w-]{1,80}\.beebo$/];
const QUERY = new Set(['screen', 'sound', 'demo']);

function clean(target) {
  let u; try { u = new URL(String(target || ''), 'http://x'); } catch { return ''; }
  if (!/^https?:$/.test(u.protocol)) return '';                 // (a full link of this app is fine: only its path is kept)
  const path = u.pathname;
  if (!PAGES.some(rx => rx.test(path))) return '';
  const q = [];
  for (const [k, v] of u.searchParams) { if (!QUERY.has(k) || !/^[\w-]{0,40}$/.test(v)) return ''; q.push(v ? `${k}=${v}` : k); }
  return path + (q.length ? '?' + q.join('&') : '');
}

/**
 * store: { get(): {code: {to, at}}, set(map) }   alive(path): false when the page is gone (a closed live-bracket link)
 */
function createShortLinks({ store, alive = () => true }) {
  let map = { ...(store.get() || {}) };
  const byPath = () => { const m = new Map(); for (const [c, v] of Object.entries(map)) if (v && v.to) m.set(v.to, c); return m; };
  const fresh = () => { let c = ''; do { c = ''; const b = crypto.randomBytes(LEN * 2); for (let i = 0; c.length < LEN; i++) { if (b[i] < 248) c += ABC[b[i] % ABC.length]; } } while (map[c]); return c; };
  function save() {
    const all = Object.entries(map).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    map = Object.fromEntries(all.slice(0, KEEP)); store.set(map);
  }
  /** the code for a page (made once, then always the same); '' when that page can't have a short link */
  function codeFor(target) {
    const to = clean(target); if (!to) return '';
    const have = byPath().get(to);
    if (have) { map[have].at = Date.now(); return have; }
    const c = fresh(); map[c] = { to, at: Date.now() }; save(); return c;
  }
  /** where a code leads ('' = nowhere) */
  function resolve(code) {
    if (!/^[A-Za-z0-9]{8}$/.test(String(code || ''))) return '';
    const v = map[code]; if (!v || !clean(v.to)) return '';
    if (!alive(v.to)) { delete map[code]; save(); return ''; }
    return v.to;
  }
  // a wrong code costs: after 20 misses in a minute from one address, every /s/ answer from it waits a minute
  const misses = new Map();
  function tooMany(ip) { const now = Date.now(), m = (misses.get(ip) || []).filter(t => now - t < 60000); misses.set(ip, m); return m.length >= 20; }
  function miss(ip) { const m = misses.get(ip) || []; m.push(Date.now()); misses.set(ip, m); if (misses.size > 5000) misses.clear(); }
  return { codeFor, resolve, tooMany, miss, clean };
}

module.exports = { createShortLinks, clean };
