'use strict';
/*
 * Twitch for BeeboScore — kept deliberately light:
 *   • Chat:  reads a channel's chat over Twitch's IRC (TLS, port 6697). Reading needs no login at all:
 *            BeeboScore joins as an anonymous "justinfan" viewer, so typing the channel name is enough.
 *   • Login: optional. Signing in (Twitch's device code flow: open twitch.tv/activate, type a code) lets
 *            BeeboScore reply in chat and fetch profile pictures through the official API.
 *   • Avatars without a login come from decapi.me, a long-running public Twitch helper.
 * Nothing here talks to Twitch except chat, the profile-picture lookups and the sign-in itself.
 *
 * Test hooks (env): TWITCH_IRC=host:port (plain TCP), TWITCH_ID_URL, TWITCH_HELIX_URL, DECAPI_URL.
 */
const tls = require('tls');
const net = require('net');
const { EventEmitter } = require('events');

const IRC = process.env.TWITCH_IRC || '';
const ID_URL = (process.env.TWITCH_ID_URL || 'https://id.twitch.tv').replace(/\/+$/, '');
const HELIX_URL = (process.env.TWITCH_HELIX_URL || 'https://api.twitch.tv/helix').replace(/\/+$/, '');
const DECAPI_URL = (process.env.DECAPI_URL || 'https://decapi.me').replace(/\/+$/, '');
const SCOPES = 'chat:read chat:edit';

const cleanLogin = s => String(s || '').trim().replace(/^[@#]/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').split(/[/?#\s]/)[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);

function parseTags(raw) {
  const tags = {};
  for (const kv of raw.split(';')) {
    const i = kv.indexOf('=');
    const k = i < 0 ? kv : kv.slice(0, i);
    const v = i < 0 ? '' : kv.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\n/g, '');
    tags[k] = v;
  }
  return tags;
}
// ":nick!nick@nick.tmi.twitch.tv PRIVMSG #chan :hello" (with optional "@tags " in front)
function parseLine(line) {
  let rest = line, tags = {}, prefix = '';
  if (rest[0] === '@') { const i = rest.indexOf(' '); tags = parseTags(rest.slice(1, i)); rest = rest.slice(i + 1); }
  if (rest[0] === ':') { const i = rest.indexOf(' '); prefix = rest.slice(1, i); rest = rest.slice(i + 1); }
  const t = rest.indexOf(' :');
  const trailing = t >= 0 ? rest.slice(t + 2) : null;
  const parts = (t >= 0 ? rest.slice(0, t) : rest).split(' ').filter(Boolean);
  return { tags, prefix, command: parts[0] || '', params: parts.slice(1), trailing };
}
function badgesOf(tags) {
  const b = {};
  for (const x of String(tags.badges || '').split(',')) { const [k, v] = x.split('/'); if (k) b[k] = v || '1'; }
  return b;
}

class TwitchChat extends EventEmitter {
  constructor() {
    super();
    this.channel = ''; this.auth = null;
    this.sock = null; this.buf = '';
    this.state = 'off';            // off | connecting | live | error
    this.error = '';
    this.retry = 0; this.retryTimer = null; this.pingTimer = null; this.lastData = 0;
    this.outbox = []; this.sendTimer = null; this.lastSend = 0;
    this.wanted = false;
  }
  status() { return { state: this.state, channel: this.channel, error: this.error, canSend: !!(this.auth && this.auth.login && this.auth.access), as: this.auth && this.auth.login || '' }; }
  setState(s, err = '') { if (this.state === s && this.error === err) return; this.state = s; this.error = err; this.emit('status', this.status()); }

  /** auth: { login, access } — optional; without it chat is read-only */
  connect(channel, auth) {
    const ch = cleanLogin(channel);
    if (!ch) throw new Error('Type your Twitch channel name first.');
    this.channel = ch; this.auth = auth && auth.access && auth.login ? { login: auth.login, access: auth.access } : null;
    this.wanted = true; this.retry = 0;
    this.open();
  }
  disconnect() {
    this.wanted = false; clearTimeout(this.retryTimer); clearInterval(this.pingTimer);
    if (this.sock) { try { this.sock.destroy(); } catch {} this.sock = null; }
    this.outbox = []; this.setState('off');
  }
  /** swap the login (e.g. after signing in) without dropping out of chat for long */
  setAuth(auth) {
    const next = auth && auth.access && auth.login ? { login: auth.login, access: auth.access } : null;
    const same = JSON.stringify(next) === JSON.stringify(this.auth);
    this.auth = next;
    if (!same && this.wanted) this.open();
  }
  open() {
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer);
    if (this.sock) { try { this.sock.removeAllListeners(); this.sock.destroy(); } catch {} this.sock = null; }
    this.setState('connecting');
    let sock;
    try {
      if (IRC) { const [h, p] = IRC.split(':'); sock = net.connect(Number(p) || 6667, h || '127.0.0.1'); }
      else sock = tls.connect({ host: 'irc.chat.twitch.tv', port: 6697, servername: 'irc.chat.twitch.tv' });
    } catch (e) { return this.fail(e.message); }
    this.sock = sock; this.buf = ''; this.lastData = Date.now();
    sock.setEncoding('utf8');
    sock.setTimeout(0);
    const hello = () => {
      const nick = this.auth ? this.auth.login : 'justinfan' + (10000 + Math.floor(Math.random() * 80000));
      this.raw('CAP REQ :twitch.tv/tags twitch.tv/commands');
      if (this.auth) this.raw('PASS oauth:' + this.auth.access);
      this.raw('NICK ' + nick);
      this.raw('JOIN #' + this.channel);
    };
    sock.once(IRC ? 'connect' : 'secureConnect', hello);
    sock.on('data', d => { this.lastData = Date.now(); this.buf += d; let i; while ((i = this.buf.indexOf('\r\n')) >= 0) { const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2); if (l) this.onLine(l); } });
    sock.on('error', e => this.fail(e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? 'No internet connection' : e.message));
    sock.on('close', () => { if (this.sock === sock) this.fail(this.error || 'Disconnected'); });
    // Twitch pings every ~5 minutes; if we hear nothing for 6, the connection is dead
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastData > 6 * 60 * 1000) { try { sock.destroy(); } catch {} return; }
      if (Date.now() - this.lastData > 4 * 60 * 1000) this.raw('PING :tmi.twitch.tv');
    }, 30 * 1000);
    this.pingTimer.unref && this.pingTimer.unref();
  }
  fail(msg) {
    clearInterval(this.pingTimer);
    if (this.sock) { try { this.sock.removeAllListeners(); this.sock.destroy(); } catch {} this.sock = null; }
    if (!this.wanted) return this.setState('off');
    this.setState('error', msg || 'Disconnected');
    const wait = Math.min(30000, 1000 * Math.pow(2, this.retry++));   // 1s, 2s, 4s … 30s
    this.retryTimer = setTimeout(() => { if (this.wanted) this.open(); }, wait);
  }
  raw(line) { if (this.sock && !this.sock.destroyed) this.sock.write(line + '\r\n'); }
  onLine(line) {
    const m = parseLine(line);
    switch (m.command) {
      case 'PING': this.raw('PONG :' + (m.trailing || 'tmi.twitch.tv')); break;
      case 'RECONNECT': this.open(); break;
      case 'NOTICE':
        if (/Login authentication failed|Improperly formatted auth/i.test(m.trailing || '')) { this.emit('auth-failed'); this.auth = null; this.open(); }
        break;
      case 'ROOMSTATE': case '366': this.retry = 0; this.setState('live'); break;
      case 'JOIN': if (!this.auth || cleanLogin(m.prefix.split('!')[0]) === this.auth.login) { this.retry = 0; this.setState('live'); } break;
      case 'PRIVMSG': {
        const t = m.tags, login = cleanLogin(m.prefix.split('!')[0]), badges = badgesOf(t);
        const text = String(m.trailing || '').replace(/^\u0001ACTION /, '').replace(/\u0001$/, '').trim();
        const isBroadcaster = !!badges.broadcaster || login === this.channel;
        this.emit('message', {
          login, display: (t['display-name'] || login).replace(/\s+/g, '').slice(0, 25) || login, userId: t['user-id'] || '', text,
          color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '',
          isBroadcaster, isMod: isBroadcaster || t.mod === '1' || !!badges.moderator, isVip: !!badges.vip || t.vip === '1',
          isSub: t.subscriber === '1' || !!badges.subscriber || !!badges.founder,
        });
        break;
      }
    }
  }
  /** say something in chat (only when signed in); spaced out so Twitch never rate-limits us */
  say(text) {
    if (!this.auth || this.state !== 'live') return false;
    const msg = String(text || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 450);
    if (!msg) return false;
    if (this.outbox.length > 8) this.outbox.shift();   // never build up a backlog of stale replies
    this.outbox.push(msg); this.pump();
    return true;
  }
  pump() {
    if (this.sendTimer || !this.outbox.length) return;
    const wait = Math.max(0, this.lastSend + 1600 - Date.now());
    this.sendTimer = setTimeout(() => {
      this.sendTimer = null;
      const m = this.outbox.shift();
      if (m) { this.raw(`PRIVMSG #${this.channel} :${m}`); this.lastSend = Date.now(); }
      this.pump();
    }, wait);
  }
}

// ---------------------------------------------------------------- sign in (device code flow, no secret needed)
async function post(url, form) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}
async function startDeviceLogin(clientId) {
  const { ok, d } = await post(ID_URL + '/oauth2/device', { client_id: clientId, scopes: SCOPES });
  if (!ok || !d.device_code) throw new Error(d.message || 'Twitch didn’t accept the sign-in request.');
  return { deviceCode: d.device_code, userCode: d.user_code, url: d.verification_uri || 'https://www.twitch.tv/activate', interval: Math.max(2, Number(d.interval) || 5), expiresIn: Number(d.expires_in) || 1800 };
}
/** one poll: { pending } while waiting, the tokens once the streamer has approved */
async function pollDeviceLogin(clientId, deviceCode) {
  const { ok, d } = await post(ID_URL + '/oauth2/token', { client_id: clientId, scopes: SCOPES, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
  if (ok && d.access_token) return { access: d.access_token, refresh: d.refresh_token || '', expiresAt: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
  const why = String(d.message || '');
  if (/authorization_pending/i.test(why)) return { pending: true };
  if (/slow_down/i.test(why)) return { pending: true, slower: true };
  if (/expired|invalid device code/i.test(why)) throw new Error('The sign-in code expired. Start again.');
  throw new Error(why || 'Sign-in failed.');
}
async function refreshLogin(clientId, refresh) {
  const { ok, d } = await post(ID_URL + '/oauth2/token', { client_id: clientId, grant_type: 'refresh_token', refresh_token: refresh });
  if (!ok || !d.access_token) throw new Error('Twitch sign-in expired. Sign in again.');
  return { access: d.access_token, refresh: d.refresh_token || refresh, expiresAt: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
}
async function validate(access) {
  const r = await fetch(ID_URL + '/oauth2/validate', { headers: { Authorization: 'OAuth ' + access }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return d && d.login ? { login: d.login, userId: d.user_id, expiresIn: d.expires_in } : null;
}
async function revoke(clientId, access) {
  try { await post(ID_URL + '/oauth2/revoke', { client_id: clientId, token: access }); } catch {}
}

// ---------------------------------------------------------------- profile pictures
const AVATAR_OK = /^https:\/\/static-cdn\.jtvnw\.net\/[\w\-./%]+\.(png|jpe?g|gif|webp)$/i;
/** logins → { login: url } — the official API when signed in, otherwise decapi.me one by one */
async function avatars(logins, { clientId, access } = {}) {
  const out = {}, list = [...new Set(logins.map(cleanLogin).filter(Boolean))];
  if (!list.length) return out;
  if (clientId && access) {
    try {
      for (let i = 0; i < list.length; i += 100) {
        const q = list.slice(i, i + 100).map(l => 'login=' + encodeURIComponent(l)).join('&');
        const r = await fetch(`${HELIX_URL}/users?${q}`, { headers: { 'Client-Id': clientId, Authorization: 'Bearer ' + access }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('helix ' + r.status);
        const d = await r.json();
        for (const u of d.data || []) if (AVATAR_OK.test(u.profile_image_url || '')) out[cleanLogin(u.login)] = u.profile_image_url;
      }
      return out;
    } catch { /* fall back to decapi below */ }
  }
  await Promise.all(list.map(async l => {
    try {
      const r = await fetch(`${DECAPI_URL}/twitch/avatar/${encodeURIComponent(l)}`, { signal: AbortSignal.timeout(6000) });
      const t = (await r.text()).trim();
      if (r.ok && AVATAR_OK.test(t)) out[l] = t;
    } catch {}
  }));
  return out;
}

module.exports = { TwitchChat, cleanLogin, parseLine, startDeviceLogin, pollDeviceLogin, refreshLogin, validate, revoke, avatars, AVATAR_OK };
