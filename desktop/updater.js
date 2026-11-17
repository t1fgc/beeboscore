'use strict';
/*
 * Automatic updates via GitHub Releases (electron-updater).
 * Every copy of BeeboScore updates from the official releases page:
 *   https://github.com/t1fgc/beeboscore/releases
 * Updates download in the background and install when the app closes (or on "Restart & update").
 * opts.handOver(newVersion) is called just before Restart & update closes the app (update.log, desktop/update-log.js).
 * opts.autoUpdater: a stand-in for electron-updater (tests only).
 */
const CHECK_EVERY = 3 * 60 * 60 * 1000; // 3 hours
const RELEASES = { owner: 't1fgc', repo: 'beeboscore' };

function createUpdater(app, opts = {}) {
  const listeners = new Set();
  let st = { supported: true, state: 'idle', version: app.getVersion(), newVersion: '', percent: 0, message: '', checkedAt: 0 };     // (never the repository: the app does not show where updates come from)
  let timer = null, au = null, userInitiated = false, configured = false;
  const set = patch => { st = { ...st, ...patch }; for (const fn of listeners) fn(st); };

  if ((!app.isPackaged && !opts.autoUpdater) || opts.disabled) {
    set({ state: opts.disabled ? 'test' : 'dev' });
    return { status: () => st, onStatus: fn => listeners.add(fn), configure() {}, check: async () => st, install() {} };
  }

  try { au = opts.autoUpdater || require('electron-updater').autoUpdater; } catch (e) { set({ state: 'error', message: 'Updater not available.' }); }
  if (au) {
    au.logger = null;
    au.allowPrerelease = false;
    au.on('checking-for-update', () => set({ state: 'checking', message: '' }));
    au.on('update-not-available', () => set({ state: 'up-to-date', checkedAt: Date.now() }));
    au.on('update-available', info => set({ state: au.autoDownload ? 'available' : 'found', newVersion: info.version, checkedAt: Date.now() }));
    au.on('download-progress', p => set({ state: 'downloading', percent: p.percent || 0 }));
    au.on('update-downloaded', info => set({ state: 'ready', newVersion: info.version, percent: 100 }));
    au.on('error', err => {
      let msg = String(err && err.message || err).split('\n')[0];
      if (/404|Unable to find latest version|No published versions|latest\.yml/i.test(msg)) msg = 'No releases have been published yet.';
      else if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::/i.test(msg)) msg = 'No internet connection.';
      set({ state: 'error', message: msg.slice(0, 160) });
    });
  }

  // Settings no longer choose the source or turn updates off: every copy follows the official releases.
  function configure() {
    if (!au || configured) return;
    // FGC_UPDATE_URL points at a plain web folder instead of GitHub (for testing only)
    if (process.env.FGC_UPDATE_URL) au.setFeedURL({ provider: 'generic', url: process.env.FGC_UPDATE_URL });
    else au.setFeedURL({ provider: 'github', owner: RELEASES.owner, repo: RELEASES.repo });
    au.autoDownload = true;
    au.autoInstallOnAppQuit = true;
    configured = true; set({ state: 'idle' });
    clearInterval(timer);
    timer = setInterval(() => check(false), CHECK_EVERY);
    setTimeout(() => check(false), 4000); // check shortly after start
  }

  async function check(user = true) {
    if (!au || !configured) return st;
    if (['checking', 'downloading', 'ready'].includes(st.state)) return st;
    userInitiated = user;
    au.autoDownload = true;
    try { await au.checkForUpdates(); } catch { /* reported through the 'error' event */ }
    return st;
  }

  function install() {
    if (!au || st.state !== 'ready') return false;
    try { if (opts.handOver) opts.handOver(st.newVersion); } catch {}
    setImmediate(() => au.quitAndInstall(true, true));      // silent install, then the installer opens the new version
    return true;
  }

  return { status: () => st, onStatus: fn => listeners.add(fn), configure, check, install };
}

module.exports = { createUpdater };
