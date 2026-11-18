'use strict';
/*
 * Sign in with start.gg (OAuth 2, authorization code).
 *
 *   1. "Sign in" opens start.gg in the person's own browser — where they're usually signed in already (single sign-on) —
 *      with a one-time random `state`.
 *   2. start.gg sends the browser back to the redirect URL with a `code`:
 *        · a loopback URL (http://127.0.0.1:<port>/startgg/callback): BeeboScore listens there, only on this PC, only while
 *          a sign-in is waiting (5 minutes at most), and only for that one path;
 *        · or an https page (docs/startgg-callback.html, e.g. on GitHub Pages) that hands the code straight to that loopback
 *          listener — for when start.gg only accepts https redirect URLs. The port travels inside `state`.
 *   3. The code is swapped for tokens over HTTPS. `state` must match (compared in constant time) and is used once.
 *
 * Tokens are never sent to the panel or any browser, and are encrypted on disk: with the operating system's own
 * protection when the desktop app provides it (Windows DPAPI / macOS Keychain via Electron safeStorage), otherwise with
 * AES-256-GCM under a random key kept in a separate file only this user can read. Access tokens refresh themselves.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');

const AUTHORIZE = process.env.STARTGG_AUTHORIZE_URL || 'https://start.gg/oauth/authorize';
const TOKEN = process.env.STARTGG_TOKEN_URL || 'https://api.start.gg/oauth/access_token';
const REFRESH = process.env.STARTGG_REFRESH_URL || 'https://api.start.gg/oauth/refresh';
const SCOPES = 'user.identity tournament.manager tournament.reporter';
const DEFAULT_PORT = 53719;
const WAIT_MS = 5 * 60 * 1000;

// ------------------------------------------------------------ encryption at rest
function createVault({ dir, secure }) {
  const keyFile = path.join(dir, '.beebo-key');
  let key = null;
  const getKey = () => {
    if (key) return key;
    try { key = fs.readFileSync(keyFile); if (key.length !== 32) key = null; } catch {}
    if (!key) { key = crypto.randomBytes(32); fs.writeFileSync(keyFile, key, { mode: 0o600 }); }
    return key;
  };
  return {
    kind: secure && secure.available() ? 'os' : 'aes',
    seal(obj) {
      const txt = JSON.stringify(obj);
      if (secure && secure.available()) return 'os:' + secure.encrypt(txt);
      const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
      const ct = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
      return 'gcm:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    },
    open(sealed) {
      if (!sealed) return null;
      try {
        if (sealed.startsWith('os:')) return secure ? JSON.parse(secure.decrypt(sealed.slice(3))) : null;
        if (sealed.startsWith('gcm:')) {
          const b = Buffer.from(sealed.slice(4), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', getKey(), b.subarray(0, 12));
          d.setAuthTag(b.subarray(12, 28));
          return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
        }
      } catch {}
      return null;                                          // tampered, or sealed on another PC: sign in again
    },
  };
}

const isLoopback = u => { try { const x = new URL(u); return x.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(x.hostname); } catch { return false; } };
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/**
 * store: { get() → { app, sealed, user }, set(patch) }      (kept in config.startgg.oauth by server.js)
 * builtIn: { clientId, clientSecret, redirect } baked into a build (optional)
 * open(url): opens the system browser
 */
function createAuth({ store, vault, builtIn = {}, open = () => {}, gqlMe = async () => null, log = () => {} }) {
  let pending = null;                                         // { state, server, timer, resolve }
  let cache = null;                                            // decrypted tokens, in memory only
  const app = () => {
    const a = (store.get() || {}).app || {};
    const secret = a.sealedSecret ? (vault.open(a.sealedSecret) || {}).s : '';
    const clientId = String(a.clientId || builtIn.clientId || '').trim(), clientSecret = String(secret || builtIn.clientSecret || '').trim();
    return { clientId, clientSecret, redirect: String(a.redirect || builtIn.redirect || `http://127.0.0.1:${DEFAULT_PORT}/startgg/callback`).trim(), builtIn: !a.clientId && !!builtIn.clientId };
  };
  const tokens = () => { if (cache) return cache; const s = store.get() || {}; cache = vault.open(s.sealed); return cache; };
  const keep = t => { cache = t; store.set({ sealed: t ? vault.seal(t) : '' }); };

  async function post(url, body) {
    let res;
    try { res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error('Couldn’t reach start.gg. Check your internet connection.'); }
    let j = null; try { j = await res.json(); } catch {}
    if (!res.ok || !j || !j.access_token) throw new Error((j && (j.error_description || j.message || j.error)) || `start.gg sign-in failed (HTTP ${res.status}).`);
    return { access: j.access_token, refresh: j.refresh_token || '', exp: Date.now() + (Number(j.expires_in) || 604800) * 1000, scope: j.scope || SCOPES };
  }
  function stopWaiting() { if (!pending) return; clearTimeout(pending.timer); try { pending.server.close(); } catch {} pending = null; }
  const page = (title, msg, ok) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BeeboScore</title><style>body{font:16px system-ui,sans-serif;background:#0e0f13;color:#eceef3;display:grid;place-items:center;height:100vh;margin:0}div{text-align:center;max-width:460px}b{display:block;font-size:24px;margin-bottom:10px;color:${ok ? '#2fd17a' : '#ff8a8a'}}</style></head><body><div><b>${title}</b>${msg}</div></body></html>`;

  /** start a sign-in: returns the URL to open (also opened in the browser) */
  async function begin() {
    const a = app();
    if (!a.clientId || !a.clientSecret) throw new Error('start.gg sign-in isn’t set up in this copy of BeeboScore yet — add the start.gg app’s Client ID and Secret under “Advanced”, or use an API token.');
    stopWaiting();
    const loop = isLoopback(a.redirect), port = loop ? Number(new URL(a.redirect).port) || 80 : DEFAULT_PORT;
    const state = `p${port}.${crypto.randomBytes(32).toString('hex')}`;
    const done = new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/startgg/callback') { res.writeHead(404); return res.end(); }
        const st = u.searchParams.get('state') || '', code = u.searchParams.get('code') || '', err = u.searchParams.get('error');
        if (!pending || !same(st, pending.state)) { res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page('Sign-in link expired', 'Start the sign-in again from BeeboScore.', false)); }
        const p = pending; stopWaiting();
        if (err || !code) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page('Sign-in cancelled', 'Nothing was changed. You can close this tab.', false)); return reject(new Error('start.gg sign-in was cancelled.')); }
        try {
          const t = await post(TOKEN, { grant_type: 'authorization_code', code, client_id: Number(a.clientId) || a.clientId, client_secret: a.clientSecret, redirect_uri: a.redirect, scope: SCOPES });
          keep(t);
          let me = null; try { me = await gqlMe(t.access); } catch {}
          store.set({ user: me || { name: 'start.gg account' }, at: Date.now() });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page('Signed in to BeeboScore', `${me && me.name ? `Hi ${String(me.name).replace(/[<>&]/g, '')}! ` : ''}You can close this tab and go back to BeeboScore.`, true));
          p.resolve(me);
        } catch (e) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page('Sign-in failed', String(e.message).replace(/[<>&]/g, ''), false)); reject(e); }
      });
      server.on('error', e => { stopWaiting(); reject(new Error(e.code === 'EADDRINUSE' ? `Port ${port} is busy — close what's using it, or change the redirect URL under Advanced.` : e.message)); });
      server.listen(port, '127.0.0.1');
      pending = { state, server, resolve, timer: setTimeout(() => { stopWaiting(); reject(new Error('start.gg sign-in timed out.')); }, WAIT_MS) };
    });
    done.catch(e => log(e.message));
    const url = `${AUTHORIZE}?${new URLSearchParams({ response_type: 'code', client_id: a.clientId, scope: SCOPES, redirect_uri: a.redirect, state })}`;
    open(url);
    return { url, done };
  }
  /** a valid access token (refreshed when it's close to expiring), or '' when signed out */
  async function token() {
    const t = tokens(); if (!t || !t.access) return '';
    if (t.exp - Date.now() > 10 * 60 * 1000 || !t.refresh) return t.access;
    const a = app();
    try { const n = await post(REFRESH, { grant_type: 'refresh_token', refresh_token: t.refresh, client_id: Number(a.clientId) || a.clientId, client_secret: a.clientSecret, redirect_uri: a.redirect, scope: t.scope || SCOPES }); keep({ ...n, refresh: n.refresh || t.refresh }); return n.access; }
    catch (e) { if (Date.now() < t.exp) return t.access; keep(null); store.set({ user: null }); throw new Error('Your start.gg sign-in expired — sign in again.'); }
  }
  function logout() { stopWaiting(); keep(null); store.set({ user: null, at: 0 }); }
  function setApp({ clientId, clientSecret, redirect } = {}) {
    const cur = (store.get() || {}).app || {};
    const next = { clientId: clientId !== undefined ? String(clientId).trim().slice(0, 40) : cur.clientId || '', redirect: redirect !== undefined ? String(redirect).trim().slice(0, 300) : cur.redirect || '' };
    if (next.redirect && !isLoopback(next.redirect) && !/^https:\/\//i.test(next.redirect)) throw new Error('The redirect URL has to be http://127.0.0.1:… or an https:// page.');
    next.sealedSecret = clientSecret !== undefined ? (clientSecret ? vault.seal({ s: String(clientSecret).trim() }) : '') : cur.sealedSecret || '';
    store.set({ app: next });
  }
  function status() {
    const s = store.get() || {}, a = app(), t = tokens();
    return { signedIn: !!(t && t.access), user: t && t.access ? s.user || null : null, ready: !!(a.clientId && a.clientSecret), builtIn: a.builtIn, clientId: (s.app && s.app.clientId) || '', hasSecret: !!(s.app && s.app.sealedSecret),
      redirect: a.redirect, waiting: !!pending, protection: vault.kind };
  }
  return { begin, token, logout, setApp, status, signedIn: () => { const t = tokens(); return !!(t && t.access); }, stopWaiting };
}

module.exports = { createVault, createAuth, SCOPES, DEFAULT_PORT };
