'use strict';
/*
 * Notifications out of BeeboScore: a Discord channel webhook (the link is kept sealed on disk, never shown to the
 * panel or sent anywhere but Discord). Messages queue up and go out one every ~1.2 s, at most 20 waiting, so a busy
 * bracket can't trip Discord's rate limit. Nothing here pings anyone (@everyone / role mentions are switched off).
 */
const DISCORD = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,200}$/;
const LOCAL = /^http:\/\/127\.0\.0\.1:\d{2,5}\/api\/webhooks\/\d{1,30}\/[A-Za-z0-9_-]{4,200}$/;     // the test suites' stand-in
const EVENTS = { onstream: true, station: true, result: false, champion: true, started: true, upnext: false, segment: false, graphic: true };   // 1.12.18: up next, rundown segments, results graphics (with the picture)

function validUrl(u) { u = String(u || '').trim(); return DISCORD.test(u) || (process.env.NOTIFY_ALLOW_LOCAL === '1' && LOCAL.test(u)) ? u : ''; }

/** store: { get() → config.notify, set(v) }; vault: { seal, open } */
function createNotify({ store, vault, log = () => {}, gap = Number(process.env.NOTIFY_GAP) || 1200, muted = () => false }) {
  const q = []; let busy = false, last = { at: 0, ok: true, error: '' };
  const cfg = () => { const c = store.get() || {}; return { sealed: c.sealed || '', on: { ...EVENTS, ...(c.on || {}) } }; };
  const url = () => { const c = cfg(); if (!c.sealed) return ''; try { return (vault.open(c.sealed) || {}).u || ''; } catch { return ''; } };
  function status() { const c = cfg(); return { discord: !!c.sealed, on: c.on, last: { ...last }, waiting: q.length }; }
  function setUrl(u) {
    const c = store.get() || {};
    if (!u) { store.set({ ...c, sealed: '' }); return status(); }
    const v = validUrl(u); if (!v) throw new Error('That isn’t a Discord webhook link. In Discord: channel settings › Integrations › Webhooks › Copy Webhook URL.');
    store.set({ ...c, sealed: vault.seal({ u: v }) }); return status();
  }
  function setOn(on) { const c = store.get() || {}, cur = cfg().on; for (const k of Object.keys(EVENTS)) if (on && k in on) cur[k] = !!on[k]; store.set({ ...c, on: cur }); return status(); }
  async function post(u, content) {
    const m = typeof content === 'object' && content ? content : { text: content };
    const payload = { content: String(m.text || '').slice(0, 1900), username: 'BeeboScore', allowed_mentions: { parse: [] } };
    let body, headers = { 'Content-Type': 'application/json' };
    if (m.png) {            // 1.12.18: a picture with the message (the results graphics)
      const fd = new FormData(); fd.append('payload_json', JSON.stringify({ ...payload, attachments: [{ id: 0, filename: m.name || 'results.png' }] }));
      fd.append('files[0]', new Blob([m.png], { type: 'image/png' }), m.name || 'results.png'); body = fd; headers = {};
    } else body = JSON.stringify(payload);
    const res = await fetch(u + (u.includes('?') ? '&' : '?') + 'wait=true', { method: 'POST', headers, body, signal: AbortSignal.timeout(20000) });
    if (res.status === 429) { const b = await res.json().catch(() => ({})); return { retry: Math.min(10000, Math.ceil((Number(b.retry_after) || 2) * 1000)) }; }
    if (res.status === 401 || res.status === 404) throw new Error('Discord says that webhook no longer exists — paste a new link.');
    if (!res.ok) throw new Error(`Discord error (HTTP ${res.status}).`);
    return {};
  }
  async function pump() {
    if (busy) return; busy = true;
    try {
      while (q.length) {
        const u = url(); if (!u) { q.length = 0; break; }
        const m = q[0];
        try { const r = await post(u, m); if (r.retry) { await new Promise(x => setTimeout(x, r.retry)); continue; } last = { at: Date.now(), ok: true, error: '' }; }
        catch (e) { last = { at: Date.now(), ok: false, error: String((e && e.message) || e).slice(0, 160) }; log('notify: ' + last.error); if (/no longer exists/.test(last.error)) { q.length = 0; break; } }
        q.shift();
        if (q.length) await new Promise(x => setTimeout(x, gap));
      }
    } finally { busy = false; }
  }
  /** kind: one of EVENTS (skipped when that kind is switched off); force: send anyway (the Test button) */
  function send(kind, text, { force = false, png = null, name = '' } = {}) {
    const c = cfg();
    if (!c.sealed || (!force && !c.on[kind])) return false;
    if (!force && muted()) return false;                // 1.12.18: nothing goes out during a rehearsal
    if (q.length >= 20) q.shift();
    q.push(png ? { text: String(text), png: Buffer.isBuffer(png) ? png : Buffer.from(String(png).replace(/^data:image\/png;base64,/, ''), 'base64'), name } : String(text)); pump();
    return true;
  }
  async function test() {
    const u = url(); if (!u) throw new Error('Paste a Discord webhook link first.');
    await post(u, '👋 BeeboScore is connected — match calls and results for this channel will show up here.');
    last = { at: Date.now(), ok: true, error: '' }; return status();
  }
  return { status, setUrl, setOn, send, test, EVENTS: Object.keys(EVENTS) };
}
module.exports = { createNotify, validUrl };
