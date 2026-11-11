'use strict';
/*
 * Notifications out of BeeboScore: a Discord channel webhook (the link is kept sealed on disk, never shown to the
 * panel or sent anywhere but Discord). Messages queue up and go out one every ~1.2 s, at most 20 waiting, so a busy
 * bracket can't trip Discord's rate limit. Nothing here pings anyone (@everyone / role mentions are switched off).
 */
const DISCORD = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,200}$/;
const LOCAL = /^http:\/\/127\.0\.0\.1:\d{2,5}\/api\/webhooks\/\d{1,30}\/[A-Za-z0-9_-]{4,200}$/;     // the test suites' stand-in
const EVENTS = { onstream: true, station: true, result: false, champion: true, started: true };

function validUrl(u) { u = String(u || '').trim(); return DISCORD.test(u) || (process.env.NOTIFY_ALLOW_LOCAL === '1' && LOCAL.test(u)) ? u : ''; }

/** store: { get() → config.notify, set(v) }; vault: { seal, open } */
function createNotify({ store, vault, log = () => {}, gap = Number(process.env.NOTIFY_GAP) || 1200 }) {
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
    const res = await fetch(u + (u.includes('?') ? '&' : '?') + 'wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(content).slice(0, 1900), username: 'BeeboScore', allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(10000) });
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
  function send(kind, text, { force = false } = {}) {
    const c = cfg();
    if (!c.sealed || (!force && !c.on[kind])) return false;
    if (q.length >= 20) q.shift();
    q.push(String(text)); pump();
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
