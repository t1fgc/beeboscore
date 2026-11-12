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

  /**
   * "Restart & update": start the new exe, then close this copy.
   *
   * The new exe is started directly, the way a double-click starts it. (Until 1.1.7 a hidden PowerShell window waited for
   * this copy to close and then started it; on some PCs that step never ran, and the app closed without coming back.)
   * Starting it while this copy is still open is safe because:
   *   · every version unpacks into a temp folder of its own (build.portable.unpackDirName is set per version by
   *     tools/set-unpack-dir.js), so the new copy never unpacks over this one's files or has them deleted under it
   *   · unpacking takes several seconds, and this copy closes 0.3 s after the new exe has started; the new copy also
   *     waits for port 3300 and for the single-instance lock before it goes on (desktop/main.js, --after-update)
   * If the exe cannot be started, Windows is asked to open it; if that fails too, its folder is shown.
   */
  function launch(file) {
    const log = typeof opts.log === 'function' ? opts.log : () => {};
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^PORTABLE_EXECUTABLE_/i.test(k)) delete env[k];   // the new exe works out its own folder
    const name = path.basename(file);
    let done = false;
    const close = how => { if (done) return; done = true; log(`Restart & update: ${name} was started ${how}; this copy is closing`); setTimeout(() => app.quit(), 300); };
    const viaWindows = why => {
      log(`Restart & update: could not start ${name} directly (${why}); asking Windows to open it`);
      Promise.resolve(shell.openPath(file)).then(err => { if (err) { log(`Restart & update: Windows could not open it either (${err}); showing its folder`); try { shell.showItemInFolder(file); } catch {} } else close('by Windows'); });
    };
    if (process.platform !== 'win32') { try { shell.showItemInFolder(file); } catch {} return; }
    try {
      const child = spawn(file, ['--after-update'], { cwd: path.dirname(file), detached: true, stdio: 'ignore', env });
      child.once('error', e => viaWindows(e && e.message));
      child.once('spawn', () => { child.unref(); close('directly'); });
    } catch (e) { viaWindows(e && e.message); }
  }

  return createPortableUpdater({
    version: app.getVersion(), dir: opts.dir || '', launch,
    fetchImpl: (url, init) => net.fetch(url, init),
    api: process.env.BEEBO_UPDATE_API || '',   // for testing only
  });
}

module.exports = { createUpdater };
