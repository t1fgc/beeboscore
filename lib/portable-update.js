'use strict';
/*
 * BeeboScore (developed by Beebo) — "Check for updates" for the portable exe.
 *
 * A portable exe can't be patched in place, so an update is simply the next exe:
 *   1. Check    — ask the releases list for the newest published BeeboScore-<version>.exe
 *   2. Download — only when you press "Download update": saved next to the exe you're running, so it
 *                 keeps using the same "BeeboScore Data" folder (settings, layouts, sign-ins)
 *   3. Restart  — "Restart & update" closes this copy and starts the new one
 * Nothing is checked or downloaded unless you ask. The old exe is left where it is; delete it when you like.
 *
 * Where releases come from is set here and nowhere else. It is never sent to the control panel:
 * the status below carries versions and progress only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RELEASES = { owner: 't1fgc', repo: 'beeboscore' };
const API = 'https://api.github.com';
const ASSET = /^BeeboScore-(\d+)\.(\d+)\.(\d+)\.exe$/i;   // only this build's exe counts, whatever else a release holds

const parts = v => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
/** is version a newer than version b? */
function newer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
class Told extends Error {}   // an error whose message is written for the person using the app

/**
 * version: the running app's version      dir: the folder the running exe is in ('' = not the portable app)
 * launch(file): close this copy and start that exe      fetchImpl: fetch to use (Electron passes its own, which follows the PC's proxy)
 * api: test hook — another address for the releases list (BEEBO_UPDATE_API), never used by a normal copy
 */
function createPortableUpdater({ version, dir, launch, fetchImpl, api } = {}) {
  const doFetch = fetchImpl || fetch, base = String(api || API).replace(/\/+$/, '');
  const listeners = new Set();
  let st = { supported: true, state: 'idle', version: String(version || ''), newVersion: '', percent: 0, message: '', checkedAt: 0 };
  let found = null, file = '', busy = false;
  const set = patch => { st = { ...st, ...patch }; for (const fn of listeners) { try { fn(st); } catch {} } return st; };
  const headers = { 'User-Agent': `BeeboScore/${version || '0'}`, Accept: 'application/vnd.github+json' };
  const plain = err => {
    if (err instanceof Told) return err.message;
    const m = String((err && (err.cause && err.cause.code || err.code || err.name || err.message)) || err);
    if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ERR_INTERNET|ERR_NAME|ERR_CONNECTION|ERR_NETWORK|TimeoutError|AbortError|fetch failed/i.test(m + ' ' + String(err && err.message))) return 'No internet connection.';
    if (/EACCES|EPERM|EROFS/i.test(m)) return "The update couldn't be saved next to the app — that folder is read-only. Move the app to a folder you can write to and try again.";
    if (/ENOSPC/i.test(m)) return 'There is not enough free disk space for the update.';
    return 'Something went wrong. Try again in a moment.';
  };

  /** the newest published release that carries this build's exe → { version, name, url, size, digest } or null */
  async function latest() {
    const r = await doFetch(`${base}/repos/${RELEASES.owner}/${RELEASES.repo}/releases?per_page=30`, { headers, signal: AbortSignal.timeout(20000) });
    if (r.status === 404) throw new Told('No releases have been published yet.');
    if (r.status === 403 || r.status === 429) throw new Told('The update service is busy right now. Try again in a few minutes.');
    if (!r.ok) throw new Told(`The update service answered with an error (${r.status}). Try again later.`);
    const list = await r.json();
    let best = null;
    for (const rel of Array.isArray(list) ? list : []) {
      if (!rel || rel.draft || rel.prerelease) continue;
      for (const a of rel.assets || []) {
        const m = ASSET.exec(String(a && a.name || ''));
        if (!m || (a.state && a.state !== 'uploaded') || !a.browser_download_url) continue;
        const v = `${+m[1]}.${+m[2]}.${+m[3]}`;
        if (!best || newer(v, best.version)) best = { version: v, name: `BeeboScore-${v}.exe`, url: String(a.browser_download_url), size: Number(a.size) || 0, digest: String(a.digest || '') };
      }
    }
    return best;
  }

  async function check() {
    if (busy || st.state === 'ready') return st;
    if (st.state === 'found' && found) return download();           // the button reads "Download update" by now
    busy = true; set({ state: 'checking', message: '' });
    try {
      const best = await latest();
      if (!best) throw new Told('No releases have been published yet.');
      if (newer(best.version, st.version)) { found = best; set({ state: 'found', newVersion: best.version, checkedAt: Date.now() }); }
      else { found = null; set({ state: 'up-to-date', newVersion: '', checkedAt: Date.now() }); }
    } catch (err) { set({ state: 'error', message: plain(err) }); }
    busy = false;
    return st;
  }

  async function download() {
    if (busy || !found) return st;
    busy = true; set({ state: 'downloading', percent: 0, message: '' });
    const target = dir ? path.join(dir, found.name) : '', part = target + '.part';
    try {
      if (!dir) throw new Told("This copy isn't running as the portable app, so there's nowhere to put the update.");
      // only ever from this app's own releases, over https
      const u = new URL(found.url), home = new URL(api ? base : 'https://github.com');
      if (u.protocol !== home.protocol || u.host !== home.host || (!api && !u.pathname.startsWith(`/${RELEASES.owner}/${RELEASES.repo}/releases/download/`))) throw new Told("The update's address didn't look right, so it wasn't downloaded.");
      const done = () => { file = target; set({ state: 'ready', percent: 100 }); };
      if (found.size && fs.existsSync(target) && fs.statSync(target).size === found.size) { done(); busy = false; return st; }   // already here from last time
      const r = await doFetch(found.url, { headers: { 'User-Agent': headers['User-Agent'], Accept: 'application/octet-stream' }, redirect: 'follow' });
      if (!r.ok || !r.body) throw new Told(`The update couldn't be downloaded (${r.status}). Try again later.`);
      const total = found.size || Number(r.headers.get('content-length')) || 0;
      const out = fs.createWriteStream(part), hash = crypto.createHash('sha256'), reader = r.body.getReader();
      const failed = new Promise((_, rej) => out.once('error', rej));
      let got = 0, shown = 0, head = null;
      for (;;) {
        const { done: end, value } = await Promise.race([reader.read(), failed]);
        if (end) break;
        const buf = Buffer.from(value);
        if (!head) head = buf.subarray(0, 2);
        hash.update(buf); got += buf.length;
        if (!out.write(buf)) await Promise.race([new Promise(res => out.once('drain', res)), failed]);
        const pct = total ? Math.min(99, Math.floor(got / total * 100)) : 0;
        if (pct > shown) { shown = pct; set({ percent: pct }); }
      }
      await Promise.race([new Promise(res => out.end(res)), failed]);
      if (found.size && got !== found.size) throw new Told('The download was cut short. Try again.');
      if (!head || head.toString('latin1') !== 'MZ') throw new Told("The downloaded file isn't a Windows app, so it was thrown away.");
      if (/^sha256:[0-9a-f]{64}$/i.test(found.digest) && found.digest.slice(7).toLowerCase() !== hash.digest('hex')) throw new Told("The download didn't match the published file, so it was thrown away. Try again.");
      fs.renameSync(part, target);
      done();
    } catch (err) {
      try { fs.unlinkSync(part); } catch {}
      set({ state: 'error', percent: 0, message: plain(err) });
    }
    busy = false;
    return st;
  }

  /** "Restart & update": hand the new exe to the desktop shell, which closes this copy and starts it */
  function install() { if (st.state === 'ready' && file && launch) launch(file); }

  return { status: () => st, onStatus: fn => { listeners.add(fn); }, configure() {}, check, install };
}

module.exports = { createPortableUpdater, newer };
