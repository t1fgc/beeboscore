'use strict';
/*
 * BeeboScore (developed by Beebo) — updates for the portable exe (Settings › Check for updates).
 * The checking and downloading is in lib/portable-update.js; this file is the desktop side: it gives that code
 * Electron's network stack (so the PC's proxy settings are respected) and does the "Restart & update" hand-over.
 * Nothing is checked or downloaded unless the person asks.
 */
const { spawn } = require('child_process');
const path = require('path');
const { createPortableUpdater } = require('../lib/portable-update');

function createUpdater(app, opts = {}) {
  if (!app.isPackaged) {   // running from source: nothing to update
    const st = { supported: true, state: 'dev', version: app.getVersion(), newVersion: '', percent: 0, message: '', checkedAt: 0 };
    return { status: () => st, onStatus() {}, configure() {}, check: async () => st, install() {} };
  }
  const { net, shell } = require('electron');

  /** close this copy, then start the new exe (it has to wait: both use the same port and the same data folder).
   *  The portable exe is a small launcher that unpacks the app into a temp folder, runs it, and deletes that folder when the
   *  app closes. The new exe unpacks into the same folder, so it must not start until the old launcher has finished deleting:
   *  the script waits for this app AND for its launcher (this process's parent), each for up to 30 seconds. */
  function launch(file) {
    const log = typeof opts.log === 'function' ? opts.log : () => {};
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^PORTABLE_EXECUTABLE_/i.test(k)) delete env[k];   // the new exe works out its own folder
    const fallback = () => { try { shell.showItemInFolder(file); } catch {} };               // couldn't hand over: show the new exe instead
    if (process.platform !== 'win32') return fallback();
    try {
      const q = s => "'" + String(s).replace(/'/g, "''") + "'";
      const stub = process.env.PORTABLE_EXECUTABLE_FILE && process.ppid > 4 ? `Wait-Process -Id ${process.ppid} -Timeout 30 -ErrorAction SilentlyContinue; ` : '';      // only when a launcher started this copy
      const script = `Wait-Process -Id ${process.pid} -Timeout 30 -ErrorAction SilentlyContinue; ${stub}Start-Sleep -Milliseconds 1500; Start-Process -FilePath ${q(file)} -WorkingDirectory ${q(path.dirname(file))}`;      // 1.5 s: time for this copy's helper processes to let go of the unpacked files
      log(`Restart & update: handing over to ${path.basename(file)} (this app is process ${process.pid}, its launcher ${process.env.PORTABLE_EXECUTABLE_FILE ? process.ppid : 'none'})`);
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { detached: true, stdio: 'ignore', windowsHide: true, env });
      child.once('error', e => { log(`the hand-over could not start: ${e && e.message}`); fallback(); });
      child.once('spawn', () => { child.unref(); setTimeout(() => app.quit(), 250); });      // (the control panel has already been showing "Installing…" for a moment: see installNow in public/panel.js)
    } catch (e) { log(`the hand-over failed: ${e && e.message}`); fallback(); }
  }

  return createPortableUpdater({
    version: app.getVersion(), dir: opts.dir || '', launch,
    fetchImpl: (url, init) => net.fetch(url, init),
    api: process.env.BEEBO_UPDATE_API || '',   // for testing only
  });
}

module.exports = { createUpdater };
