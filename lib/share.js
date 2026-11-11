'use strict';
/*
 * The live bracket page for viewers, and the files exported for a tournament.
 *
 *   · A secret, unguessable link (/watch/<token>) shows the bracket read-only and updates by itself. Nothing on it can
 *     change anything: it only ever answers GET with public bracket data (names, scores, placements).
 *   · "<Tournament> bracket.html": the same page as one self-contained file you can send to people. It pulls live
 *     results from that link while it's alive (through the online link when BeeboScore is online, otherwise from this
 *     PC / your network) and falls back to the last results written into it.
 *   · "<Tournament> Top 8.png / .jpg": the standings splash as an image for social media.
 *
 * Everything lives in one folder per tournament (data/exports/<tournament>/) and is temporary:
 *   - the link stops working and the .html is deleted 15 minutes after the tournament ends (so viewers can see the
 *     final results first), and straight away when the tournament is deleted, reset or replaced;
 *   - the images are kept until the tournament is deleted, reset or replaced, and at most 24 hours after it ended;
 *   - leftovers are swept when BeeboScore starts.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LINK_GRACE = 15 * 60 * 1000;
const IMAGE_KEEP = 24 * 60 * 60 * 1000;
// a name that works as a file/folder name everywhere: no reserved characters, emoji or Windows device names (CON, NUL…)
const safe = s => {
  let n = String(s || '').normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f\u007f]+/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 60).trim();
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(n)) n = '_' + n;
  return n || 'Tournament';
};
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/**
 * store: { get() → saved object, set(obj) } (kept in config.share by server.js)
 * others(): folder names other shares own (a start.gg event and a viewer tournament keep their files side by side)
 * onClosed(): the link just stopped working (live viewers are told)
 */
function createShare({ root, store, log = () => {}, now = () => Date.now(), others = () => [], onClosed = () => {} }) {
  let timer = null;
  const cur = () => store.get() || {};
  const put = patch => { const s = { ...cur(), ...patch }; store.set(s); return s; };
  const folder = (s = cur()) => s.folder ? path.join(root, s.folder) : '';
  const rm = f => { try { fs.rmSync(f, { recursive: true, force: true }); } catch {} };
  const htmlPath = (s = cur()) => s.folder ? path.join(folder(s), `${safe(s.name)} bracket.html`) : '';

  /** a tournament is running: give it a folder (a different tournament wipes the old one) */
  function begin(key, name) {
    const s = cur();
    if (s.key === key && s.folder) { if (name && name !== s.name) rename(name); return cur(); }
    purge('replaced');
    const f = safe(name), taken = new Set(others());
    let dir = f, i = 2; while (fs.existsSync(path.join(root, dir)) || taken.has(dir)) dir = `${f} (${i++})`;
    return put({ key, name: name || 'Tournament', folder: dir, on: false, token: '', endedAt: 0, startedAt: now(), files: [] });
  }
  function rename(name) {
    const s = cur(); if (!s.folder) return;
    const old = htmlPath(s); put({ name });
    if (old && fs.existsSync(old)) { try { fs.renameSync(old, htmlPath()); } catch {} }
  }
  /** turn the live link on (a new random token) or off (the old link stops working at once) */
  function setLive(on) {
    const s = cur(); if (!s.folder) throw new Error('Start or load a tournament first.');
    if (on && !s.on) return put({ on: true, token: crypto.randomBytes(24).toString('base64url'), endedAt: s.endedAt });
    if (!on && s.on) { const h = htmlPath(s); if (h) rm(h); const r = put({ on: false, token: '' }); onClosed(); return r; }
    return s;
  }
  const check = t => { const s = cur(); return !!(s.on && s.token && t && same(t, s.token)); };
  /** it's over: the link lives 15 more minutes */
  function ended() {
    const s = cur(); if (!s.folder || s.endedAt) return;
    put({ endedAt: now() }); schedule();
  }
  function reopened() { const s = cur(); if (s.endedAt) { put({ endedAt: 0 }); schedule(); } }
  function schedule() {
    clearTimeout(timer); timer = null;
    const s = cur(); if (!s.endedAt) return;
    const linkLeft = s.endedAt + LINK_GRACE - now(), imgLeft = s.endedAt + IMAGE_KEEP - now();
    if (s.on && linkLeft <= 0) { setLive(false); log('Live bracket link closed (the tournament ended)'); }
    if (imgLeft <= 0) { purge('expired'); return; }
    const next = cur().on ? linkLeft : imgLeft;
    timer = setTimeout(schedule, Math.max(1000, Math.min(next, 2 ** 31 - 1)));
    if (timer.unref) timer.unref();
  }
  /** the tournament is gone: delete its folder and close its link */
  function purge(why) {
    clearTimeout(timer); timer = null;
    const s = cur(); if (s.folder) { rm(folder(s)); log(`Deleted the exported files for ${s.name} (${why})`); }
    store.set({}); if (s.on) onClosed();
  }
  /** startup: anything not belonging to the current tournament goes; expired things go */
  function sweep() {
    try { fs.mkdirSync(root, { recursive: true }); } catch {}
    const s = cur(), keep = new Set([s.folder, ...others()].filter(Boolean));
    for (const d of fs.readdirSync(root, { withFileTypes: true })) if (!keep.has(d.name)) rm(path.join(root, d.name));
    if (s.folder && !fs.existsSync(folder(s))) fs.mkdirSync(folder(s), { recursive: true });
    schedule();
  }
  function write(file, data) {
    const s = cur(); if (!s.folder) throw new Error('No tournament.');
    fs.mkdirSync(folder(s), { recursive: true });
    const p = path.join(folder(s), file), tmp = p + '.tmp';
    fs.writeFileSync(tmp, data); fs.renameSync(tmp, p);
    return p;
  }
  const writeHtml = html => { const s = cur(); return s.on ? write(path.basename(htmlPath(s)), html) : ''; };
  const writeImage = (buf, ext, kind) => write(`${safe(cur().name)} Top 8${kind ? ' ' + kind : ''}.${ext}`, buf);
  function files() {
    const s = cur(); if (!s.folder) return [];
    try { return fs.readdirSync(folder(s)).filter(f => !f.endsWith('.tmp')).map(f => { const st = fs.statSync(path.join(folder(s), f)); return { name: f, size: st.size, at: st.mtimeMs }; }); } catch { return []; }
  }
  function status() {
    const s = cur();
    return { active: !!s.folder, name: s.name || '', on: !!s.on, folder: s.folder ? folder(s) : root, files: files(), endedAt: s.endedAt || 0,
      linkEndsAt: s.on && s.endedAt ? s.endedAt + LINK_GRACE : 0, imagesEndAt: s.endedAt ? s.endedAt + IMAGE_KEEP : 0 };
  }
  return { folderName: () => cur().folder || '', begin, rename, setLive, check, ended, reopened, purge, sweep, writeHtml, writeImage, status, token: () => cur().token || '', key: () => cur().key || '', folder: () => folder() || root, htmlName: () => path.basename(htmlPath()) };
}

module.exports = { createShare, safe, LINK_GRACE, IMAGE_KEEP };
