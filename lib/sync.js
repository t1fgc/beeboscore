'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — settings, layouts and players that follow you from PC to PC.
 *
 * Pick a folder that's kept in step between your PCs (OneDrive, Dropbox, Google Drive, a network drive…). Each PC writes
 * its own copy there — "<folder>/BeeboScore sync/<this PC>.beebo-sync": a backup with every secret taken out (no
 * passwords, sign-ins or tokens, nothing PC-specific) — whenever something changes, a few minutes at most after. When
 * another PC's copy is newer than what this PC last took, the app tells you, and Get changes brings them in (the app
 * restarts to load them; it never does that by itself in the middle of a stream).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const EXT = '.beebo-sync';
function createSync({ get, set, make, parse, restore, log = () => {} }) {
  const cfg = () => get() || {};
  const pc = () => { const c = cfg(); if (!c.pc) set({ ...c, pc: crypto.randomBytes(5).toString('hex'), name: (os.hostname() || 'PC').replace(/[^\w .-]/g, '').slice(0, 30) || 'PC' }); return cfg(); };
  const folder = () => { const c = cfg(); return c.dir ? path.join(c.dir, 'BeeboScore sync') : ''; };
  const okDir = d => { try { return !!d && path.isAbsolute(d) && fs.statSync(d).isDirectory(); } catch { return false; } };
  let lastHash = '', timer = null, last = { wrote: 0, error: '' };
  function write(force) {
    const c = pc(); if (!c.on || !okDir(c.dir)) return false;
    try {
      const b = make(), h = crypto.createHash('sha1').update(b.hash || b.buf).digest('hex');
      if (!force && h === lastHash) return false;
      fs.mkdirSync(folder(), { recursive: true });
      const f = path.join(folder(), `${c.pc}${EXT}`), t = f + '.tmp';
      fs.writeFileSync(t, b.buf); fs.renameSync(t, f);
      fs.writeFileSync(path.join(folder(), `${c.pc}.json`), JSON.stringify({ pc: c.pc, name: c.name, at: Date.now() }));
      lastHash = h; last = { wrote: Date.now(), error: '' }; return true;
    } catch (e) { last = { ...last, error: e.message }; log('sync: ' + e.message); return false; }
  }
  /** other PCs' copies, newest first */
  function others() {
    const c = pc(), d = folder(); if (!c.on || !okDir(c.dir) || !fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter(f => f.endsWith(EXT) && !f.startsWith(c.pc)).map(f => {
      const id = f.slice(0, -EXT.length); let name = id; try { name = JSON.parse(fs.readFileSync(path.join(d, id + '.json'), 'utf8')).name || id; } catch {}
      return { pc: id, name, at: fs.statSync(path.join(d, f)).mtimeMs, file: path.join(d, f) };
    }).sort((a, b) => b.at - a.at);
  }
  function waiting() { const c = cfg(), o = others()[0]; return o && o.at > (Number(c.took) || 0) + 1000 ? o : null; }
  function take() {
    const o = waiting() || others()[0]; if (!o) throw new Error('No other PC has written its settings here yet.');
    const doc = parse(fs.readFileSync(o.file)); restore(doc);
    set({ ...cfg(), took: o.at, tookFrom: o.name }); return o;
  }
  function view() { const c = pc(); const w = c.on ? waiting() : null; return { on: !!c.on, dir: c.dir || '', ok: okDir(c.dir), pc: c.pc, name: c.name, wrote: last.wrote, error: last.error, others: c.on ? others().map(o => ({ name: o.name, at: o.at })) : [], waiting: w ? { name: w.name, at: w.at } : null, took: c.took || 0, tookFrom: c.tookFrom || '' }; }
  function start() { clearInterval(timer); timer = setInterval(() => { try { write(); } catch {} }, 3 * 60 * 1000); timer.unref && timer.unref(); }
  start();
  return { write, take, view, waiting, others, okDir, close() { clearInterval(timer); } };
}
module.exports = { createSync, EXT };
