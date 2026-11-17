'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — a backup PC that can take over.
 *
 * On the streaming PC, Settings › Backup PC makes a link (on this network only, never through the online link, like the
 * second operator's remote). On the backup PC, paste that link: it copies the scoreboard every second — the players,
 * scores, what's on screen, the layout, the rundown and the automations — and its own overlays show the same thing,
 * so OBS on the backup PC is ready. While it's copying it does nothing on its own (no automations, no history, no
 * start.gg reports, no chat). If the streaming PC crashes, press Take over (or let it take over by itself after a quiet
 * spell, if you turned that on): the backup PC carries on from the last thing it copied.
 *
 * Nothing secret is ever copied: no passwords, sign-ins, tokens or the OBS password.
 */
function createMirror({ get, apply, changed = () => {}, log = () => {} }) {
  let timer = null, last = { at: 0, ok: false, error: '', rev: '' }, misses = 0;
  const cfg = () => get() || {};
  function valid(u) { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) && /^\/mirror\/[A-Za-z0-9_-]{20,40}$/.test(x.pathname) ? x.origin + x.pathname : ''; } catch { return ''; } }
  async function pull() {
    const c = cfg(); if (!c.url || !c.standby) return;
    try {
      const r = await fetch(c.url + '/state', { signal: AbortSignal.timeout(2500), headers: { 'X-Beebo-Mirror': '1' } });
      if (!r.ok) throw new Error(r.status === 404 ? 'The streaming PC doesn’t know this link (any more).' : `The streaming PC answered ${r.status}.`);
      const d = await r.json();
      if (d && d.rev !== last.rev) { apply(d); }
      last = { at: Date.now(), ok: true, error: '', rev: d && d.rev, from: d && d.name || '' }; misses = 0;
    } catch (e) {
      misses++; last = { ...last, ok: false, error: /abort|timeout|fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(e.message) ? 'The streaming PC isn’t answering.' : e.message };
      if (c.auto && last.at && Date.now() - last.at > (Number(c.autoSecs) || 10) * 1000) { log('backup PC: the streaming PC went quiet — taking over'); takeOver('auto'); return; }
    }
    changed();
  }
  function start() { stop(); const c = cfg(); if (c.url && c.standby) { timer = setInterval(() => pull().catch(() => {}), 1000); timer.unref && timer.unref(); pull().catch(() => {}); } }
  function stop() { clearInterval(timer); timer = null; }
  let tookOver = null;
  function takeOver(why = 'button') { const c = cfg(); c.standby = false; tookOver = { at: Date.now(), why }; stop(); changed(true); }
  function view() { const c = cfg(); return { url: c.url || '', standby: !!(c.url && c.standby), auto: !!c.auto, autoSecs: Number(c.autoSecs) || 10, last: { ...last }, quiet: last.at ? Math.round((Date.now() - last.at) / 1000) : null, tookOver }; }
  return { start, stop, pull, takeOver, view, valid, get standby() { const c = cfg(); return !!(c.url && c.standby); } };
}
module.exports = { createMirror };
