'use strict';
/*
 * BeeboScore by Beebo — desktop app.
 * Runs the scoreboard server inside the app and shows the control panel in its own window.
 * The portable exe (BeeboScore-<version>.exe, the release) keeps its data in "BeeboScore Lite Data" next to the exe (the name 1.5.0 gave it);
 * an installed copy keeps it in Documents/BeeboScore.
 */
const { app, BrowserWindow, Menu, shell, dialog, clipboard, nativeTheme, screen, safeStorage, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('../server');
const { createUpdater } = require('./updater');
const { createPortableUpdaterFor } = require('./portable-updater');
const { createUpdateLog } = require('./update-log');

// 1.5.0: the release is the portable exe (BeeboScore-<version>.exe since 1.5.2; 1.5.0 called it BeeboScore-Lite-<version>.exe): it runs without installing, keeps its data
// next to the exe, uses port 3300 (the port BeeboScore 1.4.0 and earlier used, so OBS links keep working) and checks for
// its own updates (Settings › Updates & about). The Testbuild (BeeboScore Testbuild <n>.exe) is portable too, but has
// its own name and never updates itself.
const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || '';
const TEST_BUILD = /beta|test/i.test(app.getName());
// 1.5.2: the app is called BeeboScore again, but keeps 1.5.0's place for Electron's own files (window state, and the key
// that seals start.gg sign-ins), so nobody has to sign in again. 1.4.0's folder (%APPDATA%\BeeboScore) is never used.
app.setPath('userData', path.join(app.getPath('appData'), TEST_BUILD ? 'BeeboScore Lite Testbuild' : 'BeeboScore Lite'));
const RELEASE_PORTABLE = !!PORTABLE_DIR && !TEST_BUILD;
const PORT = PORTABLE_DIR || TEST_BUILD ? 3300 : 3200;
const AFTER_UPDATE = process.argv.includes('--after-update');      // started by "Restart & update" (this build's, or 1.4.0's)
app.setAppUserModelId(TEST_BUILD ? 'com.t1fgc.beeboscore.lite.beta' : 'com.t1fgc.beeboscore.lite');
nativeTheme.themeSource = 'dark';
// keep the UI responsive: no throttling of the control panel's timers/animations while visible
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const DATA_DIR = PORTABLE_DIR ? path.join(PORTABLE_DIR, 'BeeboScore Lite Data')
  : path.join(app.getPath('documents'), TEST_BUILD ? 'BeeboScore Lite Beta' : 'BeeboScore Lite');      // folder names kept from 1.5.0 (BeeboScore Lite), so nothing has to move
// Potato mode (Settings › Behaviour): must be known before the app starts so the GPU can be switched off.
const POTATO = (() => { try { return !!JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data', 'config.json'), 'utf8')).settings.potatoMode; } catch { return false; } })();
if (POTATO) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-smooth-scrolling');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('renderer-process-limit', '3');
}
const APP_TITLE = (TEST_BUILD ? 'BeeboScore Testbuild' : 'BeeboScore') + (POTATO ? ' (Potato mode)' : '');
// Windows: the .ico, so the title bar and taskbar use the small-size badge at 16 / 24 px instead of a shrunken full logo
const ICON = process.platform === 'win32' ? path.join(__dirname, 'icon.ico') : path.join(__dirname, '..', 'public', 'icon.png');
let win = null, srv = null, updater = null, mini = null, picker = null;
const WINDOW_FILE = path.join(DATA_DIR, 'data', 'window.json');

// Earlier versions were called "FGC Scoreboard": carry their layouts and settings over once.
// The installer drops a marker on a fresh install (never on an auto-update): start with an
// empty name-autocomplete list. Layouts, settings and the start.gg token are kept.
function clearAutocompleteOnFreshInstall() {
  const marker = path.join(process.resourcesPath || '', 'fresh-install');
  if (!process.resourcesPath || !fs.existsSync(marker)) return;
  const seenFile = path.join(DATA_DIR, 'data', 'install.json');
  let stamp = '';
  try { stamp = String(fs.statSync(marker).mtimeMs); } catch {}
  let seen = '';
  try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')).freshInstall || ''; } catch {}
  if (stamp && stamp !== seen) {
    for (const f of ['players.json', 'startgg-entrants.json']) { try { fs.rmSync(path.join(DATA_DIR, 'data', f), { force: true }); } catch {} }
    try { fs.mkdirSync(path.dirname(seenFile), { recursive: true }); fs.writeFileSync(seenFile, JSON.stringify({ freshInstall: stamp })); } catch {}
  }
  try { fs.rmSync(marker, { force: true }); } catch {}
}

function migrateOldData() {
  const old = path.join(app.getPath('documents'), 'FGC Scoreboard');
  try { if (!fs.existsSync(DATA_DIR) && fs.existsSync(old)) fs.cpSync(old, DATA_DIR, { recursive: true }); } catch {}
}
function readBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(WINDOW_FILE, 'utf8'));
    const area = screen.getDisplayMatching(b).workArea;            // still on a connected screen?
    if (b.x < area.x + area.width - 100 && b.y < area.y + area.height - 100 && b.x + b.width > area.x + 100) return b;
  } catch {}
  return null;
}
let keepNormal = null;     // opened maximised: the normal size from last time, until you un-maximise
function saveBounds() {
  if (!win) return;
  try { fs.mkdirSync(path.dirname(WINDOW_FILE), { recursive: true }); fs.writeFileSync(WINDOW_FILE, JSON.stringify({ ...(keepNormal && win.isMaximized() ? keepNormal : win.getNormalBounds()), maximized: win.isMaximized() })); } catch {}
}

// update.log in the data folder: every start and every Restart & update hand-over (desktop/update-log.js)
const UPD = createUpdateLog(DATA_DIR, app.getVersion());

const portFree = port => new Promise(res => { const s = require('net').createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port); });

if (!app.requestSingleInstanceLock()) {
  UPD.log('another copy of BeeboScore is already running, so this one closed');
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(boot);
}

// 1.5.0: data from BeeboScore 1.4.0 and earlier. The first time the portable exe starts in a folder where 1.4.0 kept its
// "BeeboScore Data" (Check for updates in 1.4.0 puts it right there), that data is copied into "BeeboScore Lite Data":
// players, scores, saved teams and formats, pictures, history and settings. The 1.4.0 folder itself is never changed.
// Not copied: 1.4.0's own layouts (Lite has its own, one per game) and its backups. The first-run setup opens, so the game
// and its layout can be picked. A start.gg sign-in is sealed by Windows for one app, so it asks to sign in again.
function importFrom140() {
  if (!RELEASE_PORTABLE) return;
  const old = path.join(PORTABLE_DIR, 'BeeboScore Data'), oldData = path.join(old, 'data');
  try { if (fs.existsSync(path.join(DATA_DIR, 'data', 'config.json')) || !fs.existsSync(path.join(oldData, 'config.json'))) return; } catch { return; }   // (the update log may already be in the folder)
  const SKIP = new Set(['backups', 'retired-layouts', 'streamdeck-backups', 'bin', 'window.json', 'update.log', 'install.json', '.update-handover.json']);
  try {
    fs.mkdirSync(path.join(DATA_DIR, 'data'), { recursive: true });
    for (const n of fs.readdirSync(oldData)) { if (!SKIP.has(n)) fs.cpSync(path.join(oldData, n), path.join(DATA_DIR, 'data', n), { recursive: true }); }
    const cf = path.join(DATA_DIR, 'data', 'config.json'), c = JSON.parse(fs.readFileSync(cf, 'utf8'));
    delete c.activeOverlay;                                            // 1.4.0's Ember / Porcelain aren't in Lite
    c.settings = { ...(c.settings || {}), setupDone: false };          // so the first-run setup picks the game and layout
    fs.writeFileSync(cf, JSON.stringify(c, null, 2));
    UPD.log('brought over the players, settings and saved data from BeeboScore 1.4.0 ("BeeboScore Data", left as it was)');
    return true;
  } catch (e) { UPD.log(`could not bring over the data from BeeboScore 1.4.0: ${e.message}`); }
}

// 1.5.0: the release exe replaces older ones in its folder the same way: an older BeeboScore-<version>.exe or BeeboScore-Lite-<version>.exe, and
// BeeboScore-<version>.exe from 1.4.0 and earlier (and the copy of this release that 1.4.0's Check for updates saved under
// that name), go to the Recycle Bin once this one is running. Their data is kept (see importFrom140).
function retireOldReleases() {
  const me = path.basename(process.env.PORTABLE_EXECUTABLE_FILE || ''), RX = /^BeeboScore-(?:Lite-)?(\d+\.\d+\.\d+)(?: \(\d+\))?\.exe$/i;
  const ver = v => String(v).split('.').map(n => Number(n) || 0), cmp = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  if (!RELEASE_PORTABLE || !me) return;
  let files = []; try { files = fs.readdirSync(PORTABLE_DIR); } catch { return; }
  const old = files.filter(f => f !== me && RX.test(f) && cmp(f.match(RX)[1], app.getVersion()) <= 0);      // older ones, and a second copy of this version under the other name
  if (!old.length) return;
  Promise.allSettled(old.map(f => shell.trashItem(path.join(PORTABLE_DIR, f)).then(() => f))).then(rs => {
    const gone = rs.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!gone.length) return;
    UPD.log(`moved older copies to the Recycle Bin: ${gone.join(', ')}`);
    const msg = `Moved the older BeeboScore exe${gone.length > 1 ? 's' : ''} (${gone.join(', ')}) to the Recycle Bin. Your data is kept.`;
    try { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(`window.BeeboPanel && BeeboPanel.toast && BeeboPanel.toast(${JSON.stringify(msg)})`).catch(() => {}); } catch {}
  });
}

// 1.12.8: a new Testbuild replaces the old ones. When "BeeboScore Testbuild <n>.exe" starts, older Testbuild exes in the
// same folder go to the Recycle Bin (never deleted outright — they can be restored from there). The data folder next to
// them ("BeeboScore Beta Data") is shared, so nothing is lost. A copy that's still running can't be moved and is left.
function retireOldTestbuilds() {
  const me = path.basename(process.env.PORTABLE_EXECUTABLE_FILE || ''), RX = /^BeeboScore (?:Lite )?Testbuild (\d+(?:\.\d+){0,3})(?: \(\d+\))?\.exe$/i;
  const ver = v => String(v).split('.').map(n => Number(n) || 0), cmp = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  if (!PORTABLE_DIR || !TEST_BUILD || !me) return;
  let files = []; try { files = fs.readdirSync(PORTABLE_DIR); } catch { return; }
  const old = files.filter(f => f !== me && RX.test(f) && cmp(f.match(RX)[1], app.getVersion()) < 0);
  if (!old.length) return;
  Promise.allSettled(old.map(f => shell.trashItem(path.join(PORTABLE_DIR, f)).then(() => f))).then(rs => {
    const gone = rs.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!gone.length) return;
    UPD.log(`moved older Testbuilds to the Recycle Bin: ${gone.join(', ')}`);
    const msg = `Replaced the older Testbuild${gone.length > 1 ? 's' : ''} (${gone.map(f => f.match(RX)[1]).join(', ')}) — moved to the Recycle Bin. Your settings and layouts are kept.`;
    try { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(`window.BeeboPanel && BeeboPanel.toast && BeeboPanel.toast(${JSON.stringify(msg)})`).catch(() => {}); } catch {}
  });
}

// 1.12.16: the portable Testbuild keeps its unpacked copy between launches (desktop/portable.nsi), one folder per version
// in TEMP. Once this one is running, the other versions' folders go: the "ready" mark first (so a folder that can't be
// emptied completely — still running — is unpacked afresh next time), then the folder.
function clearOldUnpacked() {
  const mine = path.dirname(process.execPath), parent = path.dirname(mine), base = path.basename(mine);
  const m = base.match(/^(BeeboScore(?:Lite)?(?:Testbuild|Beta)?)-[\d.]+$/); if (!m) return;
  let dirs = []; try { dirs = fs.readdirSync(parent); } catch { return; }
  for (const d of dirs) {
    if (d === base || !new RegExp(`^${m[1]}-[\\d.]+$`).test(d)) continue;
    const full = path.join(parent, d);
    try { for (const f of fs.readdirSync(full)) if (f.startsWith('.beebo-ready')) fs.rmSync(path.join(full, f), { force: true }); } catch { continue; }
    fs.promises.rm(full, { recursive: true, force: true, maxRetries: 2 }).then(() => UPD.log(`removed the unpacked copy of an older Testbuild (${d})`)).catch(() => {});
  }
}

// 1.12.16: stations — more scoreboards from this one app, for locals that stream more than one setup. Station 1 is the app
// as it always was; each extra station is its own scoreboard (its own data folder, port, OBS link and control panel window),
// sharing Station 1's layouts and picture library. The list is kept in the data folder; the extra stations start with the app.
const STATIONS = (() => {
  const FILE = path.join(DATA_DIR, 'stations.json'), run = new Map(), wins = new Map();
  const read = () => { try { const l = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(l) ? l.filter(x => Number(x.n) >= 2).slice(0, 7) : []; } catch { return []; } };
  const write = l => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(l, null, 2)); } catch {} };
  async function launch(st) {
    if (run.has(st.n)) return run.get(st.n);
    const base = srv ? srv.port : PORT;
    const s = await start({ dataDir: path.join(DATA_DIR, 'stations', `station-${st.n}`), port: base + (st.n - 1) * 10, autoPort: true, desktop: true, testBuild: TEST_BUILD,
      station: st.n, stationName: st.name, overlaysDir: srv && srv.overlaysDir, assetsDir: path.join(DATA_DIR, 'data', 'assets'),
      openPath: p => shell.openPath(p), capture: captureShot, bake: bakeVideo, openExternal: u => { if (/^https:\/\//i.test(u)) shell.openExternal(u); },
      secureStore: { available: () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } }, encrypt: t => safeStorage.encryptString(t).toString('base64'), decrypt: b => safeStorage.decryptString(Buffer.from(b, 'base64')) } });
    run.set(st.n, s); UPD.log(`station ${st.n} on port ${s.port}`); return s;
  }
  const api = {
    list: () => read().map(x => ({ n: x.n, name: x.name || `Station ${x.n}`, port: run.has(x.n) ? run.get(x.n).port : 0, running: run.has(x.n) })),
    async boot() { for (const st of read()) await launch(st); },
    async add(name) { const l = read(); if (l.length >= 7) throw new Error('Eight stations at most.'); let n = 2; while (l.some(x => x.n === n)) n++; const st = { n, name: name || `Station ${n}` }; l.push(st); write(l); await launch(st); },
    async remove(n) { const l = read(); if (!l.some(x => x.n === n)) throw new Error('No such station.'); write(l.filter(x => x.n !== n)); const w = wins.get(n); if (w && !w.isDestroyed()) w.close(); const s = run.get(n); run.delete(n); if (s) s.close(); },
    rename(n, name) { const l = read(); const st = l.find(x => x.n === n); if (!st) throw new Error('No such station.'); st.name = name || `Station ${n}`; write(l); },
    open(n) {
      const s = run.get(n); if (!s) throw new Error('That station isn’t running.');
      let w = wins.get(n); if (w && !w.isDestroyed()) { w.show(); w.focus(); return; }
      const st = read().find(x => x.n === n) || { name: `Station ${n}` };
      w = new BrowserWindow({ width: 1280, height: 860, minWidth: 420, minHeight: 560, autoHideMenuBar: true, backgroundColor: '#0a0b10', title: `${APP_TITLE} — ${st.name}`, icon: ICON,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
      w.on('page-title-updated', e => e.preventDefault());
      w.loadURL(`http://localhost:${s.port}/`); wins.set(n, w); w.on('closed', () => wins.delete(n));
      const mine = u => u.startsWith(`http://localhost:${s.port}`);
      w.webContents.setWindowOpenHandler(({ url }) => { if (mine(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 760, backgroundColor: '#000', icon: ICON, autoHideMenuBar: true } }; shell.openExternal(url); return { action: 'deny' }; });
      w.webContents.on('will-navigate', (e, url) => { if (!mine(url)) { e.preventDefault(); shell.openExternal(url); } });
    },
    closeAll() { for (const s of run.values()) try { s.close(); } catch {} run.clear(); },
  };
  return api;
})();

async function boot() {
  // Restart & update starts this copy while the old one is still closing: wait (up to 8 s) for it to let go of the port,
  // so this copy gets 3300 again and the OBS link stays the same.
  if (AFTER_UPDATE) { let waited = 0; while (waited < 8000 && !(await portFree(PORT))) { await new Promise(r => setTimeout(r, 250)); waited += 250; } UPD.log(`started by Restart & update${waited ? ` (waited ${waited} ms for the old copy to close)` : ''}`); }
  if (PORTABLE_DIR) { setTimeout(retireOldTestbuilds, 6000); setTimeout(retireOldReleases, 6000); setTimeout(clearOldUnpacked, 9000); }
  if (!PORTABLE_DIR && !TEST_BUILD) { migrateOldData(); clearAutocompleteOnFreshInstall(); }
  importFrom140();
  UPD.afterUpdate();                                  // "started by Restart & update" when the old copy left a note
  // The release exe checks for its own updates (only BeeboScore's own exe on the releases page). The Testbuild and an
  // installed copy don't update themselves.
  updater = RELEASE_PORTABLE ? createPortableUpdaterFor(app, { dir: PORTABLE_DIR, log: m => UPD.log(m), handOver: v => UPD.handOver(v) })
    : createUpdater(app, { disabled: true, handOver: v => UPD.handOver(v) });
  try {
    const sdPlugin = app.isPackaged ? path.join(process.resourcesPath, 'streamdeck', 'com.t1fgc.beeboscore.lite.streamDeckPlugin')
      : path.join(__dirname, '..', 'streamdeck', 'dist', 'com.t1fgc.beeboscore.lite.streamDeckPlugin');
    srv = await start({ dataDir: DATA_DIR, port: PORT, autoPort: true, desktop: true, testBuild: TEST_BUILD, updater,
      openPath: p => shell.openPath(p), showPicker: openPicker, capture: captureShot, bake: bakeVideo, stations: STATIONS,
      openExternal: u => { if (/^https:\/\//i.test(u)) shell.openExternal(u); },        // start.gg sign-in opens in the person's own browser
      // start.gg tokens are sealed by the operating system (Windows DPAPI / macOS Keychain)
      secureStore: { available: () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } }, encrypt: t => safeStorage.encryptString(t).toString('base64'), decrypt: b => safeStorage.decryptString(Buffer.from(b, 'base64')) }, streamDeckPlugin: sdPlugin, restart: restartApp,
      ...(POTATO ? { onPotatoDirty: () => potatoRenderer.schedule() } : {}) });
    if (POTATO) potatoRenderer.schedule();
  } catch (err) {
    dialog.showErrorBox('BeeboScore could not start', String((err && err.message) || err));
    app.quit();
    return;
  }
  // `BeeboScore.exe --self-test=results.json`: run the self-test without opening a window, write the results, exit
  // (0 = everything works, 1 = something failed). Used by the Windows check on GitHub, and handy for support.
  const st = process.argv.find(a => a.startsWith('--self-test'));
  if (st) {
    const out = st.includes('=') ? st.slice(st.indexOf('=') + 1) : path.join(DATA_DIR, 'selftest.json');
    let code = 1;
    try {
      const r = await fetch(`http://127.0.0.1:${srv.port}/api/selftest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(x => x.json());
      fs.writeFileSync(out, JSON.stringify(r, null, 2));
      code = r.results && r.results.every(t => t.ok) ? 0 : 1;
    } catch (e) { try { fs.writeFileSync(out, JSON.stringify({ error: String(e && e.message || e) })); } catch {} }
    app.isQuitting = true; if (srv) srv.close(); app.exit(code); return;
  }
  UPD.log(`started on port ${srv.port}`);
  buildMenu();
  createWindow();
  STATIONS.boot().catch(e => UPD.log(`stations: ${e.message}`));
}

function createWindow() {
  const b = readBounds();
  // first launch: a normal window that fits the screen with room around it (not maximised or fullscreen)
  const wa = screen.getPrimaryDisplay().workAreaSize, first = { width: Math.min(1480, Math.round(wa.width * .85)), height: Math.min(960, Math.round(wa.height * .85)) };
  // left maximised last time: lay the panel out at full size from the start, so it doesn't reflow when it maximises
  const maxArea = b && b.maximized ? screen.getDisplayMatching(b).workArea : null;
  win = new BrowserWindow({
    ...first, center: !b, fullscreen: false, ...(b ? { x: b.x, y: b.y, width: b.width, height: b.height } : {}), ...(maxArea || {}),
    minWidth: 420, minHeight: 560, autoHideMenuBar: true,
    backgroundColor: '#0a0b10', title: APP_TITLE, icon: ICON, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' },   // sound: the preview plays without a click first; the panel keeps running while the window is minimised
  });
  win.loadURL(`http://localhost:${srv.port}/`);
  win.once('ready-to-show', async () => {
    // wait for the panel to say it's built (all cards in, state loaded) so it never appears half-drawn; 3 s at most
    const t0 = Date.now();
    while (win && Date.now() - t0 < 3000 && !(await win.webContents.executeJavaScript('window.__panelReady === true').catch(() => true))) await new Promise(r => setTimeout(r, 40));
    if (!win) return;
    if (maxArea) {                                          // already full size and laid out: just flip it to maximised
      keepNormal = { x: b.x, y: b.y, width: b.width, height: b.height };
      win.maximize();
      win.once('unmaximize', () => { const n = keepNormal; keepNormal = null; if (win && n) win.setBounds(n); });   // back to the size you had
    }
    win.show();
    // Started by the installer after "Restart & update" (or by anything else that is not a click), Windows opens the window
    // BEHIND whatever is in front and only flashes its taskbar button, which looks as if the app never came back.
    // Holding it on top for a moment puts it in view; if Windows still won't give it the keyboard, the taskbar button flashes.
    if (process.platform === 'win32') {
      try {
        win.setAlwaysOnTop(true); win.moveTop(); win.focus();
        setTimeout(() => { if (!win) return; win.setAlwaysOnTop(false); if (!win.isFocused()) { win.flashFrame(true); win.once('focus', () => { if (win) win.flashFrame(false); }); } }, 600);
      } catch {}
    }
    UPD.log('window shown');
  });
  let t = null;
  const remember = () => { clearTimeout(t); t = setTimeout(saveBounds, 500); };
  win.on('resize', remember); win.on('move', remember);
  let closeOk = false;
  win.on('close', async e => {
    if (closeOk) return;
    saveBounds();
    // 1.5.7: unsaved work in the layout maker: ask first (Save / Don't save / Keep editing). Not while an update closes the app.
    if (designerWin && !designerWin.isDestroyed() && !designerWin.__ok && !app.isQuitting) {
      e.preventDefault();
      if (!(await makerLeave())) return;                       // Keep editing (or the save didn't go through): the maker is in front
      if (designerWin && !designerWin.isDestroyed()) designerWin.__ok = true;
      closeOk = true; hideAll(); if (win) win.close(); return;
    }
    closeOk = true; hideAll();
  });
  win.on('page-title-updated', e => e.preventDefault());

  const isApp = url => url.startsWith(`http://localhost:${srv.port}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isApp(url) && /\/mini$/.test(url)) { openMini(); return { action: 'deny' }; }
    if (isApp(url) && /\/preview$/.test(url)) { openPreview(); return { action: 'deny' }; }
    if (isApp(url) && /\/designer(\?|$)/.test(url)) { openDesigner(url); return { action: 'deny' }; }
    if (isApp(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 760, backgroundColor: '#000', icon: ICON, autoHideMenuBar: true } };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!isApp(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.on('move', followDesigner); win.on('resize', followDesigner);
  // 1.5.7: the maker goes with it (you've been asked by now). close() could be turned down and leave the app running unseen.
  win.on('closed', () => { win = null; if (mini) mini.close(); if (previewWin) previewWin.close(); if (designerWin && !designerWin.isDestroyed()) designerWin.destroy(); if (picker) { app.isQuitting = true; picker.destroy(); } });
}

// Closing: every window disappears in the same moment, instead of one by one leaving blank holes behind
function hideAll() { for (const w of [designerWin, previewWin, mini, win]) { try { if (w && !w.isDestroyed()) w.hide(); } catch {} } }

// Child windows stay hidden until they've painted, so they never open as a blank white box
function showWhenPainted(w, then) { w.once('ready-to-show', () => { if (!w.isDestroyed()) { w.show(); if (then) then(); } }); }

// The live preview in its own resizable window (Pop out in the panel). Right-click → Keep on top.
let previewWin = null;
function openPreview() {
  if (previewWin) { previewWin.show(); previewWin.focus(); return; }
  previewWin = new BrowserWindow({ show: false, width: 960, height: 580, minWidth: 420, minHeight: 280, autoHideMenuBar: true, backgroundColor: '#0b0d12', icon: ICON,
    title: 'BeeboScore — Live preview', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' } });
  showWhenPainted(previewWin);
  previewWin.loadURL(`http://localhost:${srv.port}/preview`);
  previewWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  previewWin.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([{ label: 'Keep on top', type: 'checkbox', checked: previewWin.isAlwaysOnTop(), click: m => previewWin.setAlwaysOnTop(m.checked) }]).popup({ window: previewWin });
  });
  previewWin.on('closed', () => { previewWin = null; });
}

// The Layout Designer: its own window that sits docked beside the main window and moves with it.
// Drag it away to undock; drag it back next to the main window and it snaps on again.
let designerWin = null, designerDocked = true, placingDesigner = 0;
function placeDesigner() {
  if (!designerWin || !win || win.isMinimized()) return;
  const mb = win.getBounds(), db = designerWin.getBounds(), wa = screen.getDisplayMatching(mb).workArea;
  let x = mb.x + mb.width;                                           // right of the app if it fits…
  if (x + db.width > wa.x + wa.width) x = mb.x - db.width;           // …else on its left…
  if (x < wa.x) x = Math.max(wa.x, wa.x + wa.width - db.width);      // …else over it, against the screen edge
  const h = win.isMaximized() ? db.height : Math.max(680, mb.height);
  placingDesigner = Date.now();
  designerWin.setBounds({ x: Math.round(x), y: win.isMaximized() ? db.y : mb.y, width: db.width, height: h });
}
function followDesigner() { if (designerWin && designerDocked) placeDesigner(); }
// 1.5.7: the layout maker's unsaved changes. A page's own "Leave site?" never shows in this app (it only stopped the window
// closing, without a word), so the app asks: Save / Don't save / Keep editing. Resolves true when it's fine to go on
// (nothing unsaved, saved, or Don't save); false to keep the maker open. One question at a time.
let makerAsking = null;
function makerLeave() {
  const w = designerWin;
  if (!w || w.isDestroyed() || w.__ok) return Promise.resolve(true);
  if (makerAsking) return makerAsking;
  const js = s => w.webContents.executeJavaScript(s).catch(() => null);
  makerAsking = (async () => {
    if (!(await js('typeof window.__mkUnsaved === "function" && window.__mkUnsaved()'))) return true;
    const title = (await js('typeof window.__mkTitle === "function" && window.__mkTitle()')) || 'your layout';
    if (w.isDestroyed()) return true;
    w.show(); w.focus();
    const r = await dialog.showMessageBox(w, { type: 'question', buttons: ['Save', 'Don’t save', 'Keep editing'], defaultId: 0, cancelId: 2, noLink: true,
      title: 'BeeboScore', message: `Save your changes to “${title}”?`, detail: 'The layout maker has changes you haven’t saved yet.' });
    if (r.response === 1) return true;
    if (r.response !== 0 || w.isDestroyed()) return false;
    return !!(await js('typeof window.__mkSave === "function" ? window.__mkSave() : false'));   // waits for any question the save asks (a name that's taken)
  })().finally(() => { makerAsking = null; });
  return makerAsking;
}
const makerPath = u => String(u || '').replace(/^https?:\/\/[^/]+/, '');
function openDesigner(url) {
  if (designerWin) {
    designerWin.show(); designerWin.focus();
    // 1.5.7: another layout (Edit, or Make your own): ask about unsaved changes first (it used to swap without a word). The same one: just in front.
    if (makerPath(designerWin.webContents.getURL()) !== makerPath(url)) makerLeave().then(ok => { if (ok && designerWin && !designerWin.isDestroyed()) designerWin.loadURL(url); });
    return;
  }
  // A maximised app leaves no room beside it: use a second screen when there is one (the Designer opens there, undocked),
  // else un-maximise the app and give it the space the Designer doesn't need, so the two sit side by side
  let other = null;
  if (win.isMaximized()) {
    const here = screen.getDisplayMatching(win.getBounds());
    other = screen.getAllDisplays().find(d => d.id !== here.id) || null;
    if (!other) {
      const wa0 = here.workArea, dw = Math.min(1440, Math.max(1100, Math.round(wa0.width * .58)));
      keepNormal = null;                                            // this time the size is ours to set, not last session's
      win.unmaximize(); win.setBounds({ x: wa0.x, y: wa0.y, width: Math.max(420, wa0.width - dw), height: wa0.height });
    }
  }
  const wa = (other || screen.getDisplayMatching(win.getBounds())).workArea;
  designerWin = new BrowserWindow({
    show: false, ...(other ? { x: wa.x + 20, y: wa.y + 20 } : {}),
    width: other ? Math.min(1600, wa.width - 40) : Math.min(1440, Math.max(1100, wa.width - win.getBounds().width)), height: other ? Math.min(1000, wa.height - 40) : Math.min(wa.height, Math.max(760, win.getBounds().height)),
    minWidth: 1100, minHeight: 680, autoHideMenuBar: true, backgroundColor: '#0c0e15', icon: ICON, title: 'BeeboScore — Layout maker',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  designerWin.setMenu(null);
  designerDocked = !other; if (designerDocked) placeDesigner();
  showWhenPainted(designerWin);
  // the always-on-top Mini steps behind while you work in the Designer
  designerWin.on('focus', () => { if (mini && !mini.isDestroyed()) mini.setAlwaysOnTop(false); });
  designerWin.on('blur', () => { if (mini && !mini.isDestroyed()) mini.setAlwaysOnTop(true); });
  designerWin.loadURL(url);
  designerWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  designerWin.on('page-title-updated', e => e.preventDefault());
  // a move the user made (not ours): snap back on when it's dropped next to the main window
  const snapCheck = () => {
    if (!designerWin || !win || Date.now() - placingDesigner < 400) return;
    const mb = win.getBounds(), db = designerWin.getBounds(), near = 48;
    const touching = Math.abs(db.x - (mb.x + mb.width)) < near || Math.abs(db.x + db.width - mb.x) < near;
    const overlapY = db.y < mb.y + mb.height && db.y + db.height > mb.y;
    designerDocked = touching && overlapY;
    if (designerDocked) placeDesigner();
  };
  designerWin.on('moved', snapCheck);
  designerWin.on('resized', () => { if (designerDocked) placeDesigner(); });
  // 1.5.7: closing the maker: the app asks about unsaved changes (makerLeave); the page's own question is set aside, as it can't show here
  const dw = designerWin;
  dw.webContents.on('will-prevent-unload', e => e.preventDefault());
  dw.on('close', e => {
    if (dw.__ok || app.isQuitting) return;
    e.preventDefault();
    makerLeave().then(ok => { if (ok && !dw.isDestroyed()) { dw.__ok = true; dw.close(); } });
  });
  designerWin.on('closed', () => { if (designerWin === dw) designerWin = null; if (mini && !mini.isDestroyed()) mini.setAlwaysOnTop(true); });
}

// Small always-on-top score controller — handy while playing or commentating.
function openMini() {
  if (mini) { mini.show(); mini.focus(); return; }
  mini = new BrowserWindow({
    show: false, width: 460, height: 330, minWidth: 360, minHeight: 300, alwaysOnTop: true, autoHideMenuBar: true, maximizable: false,
    backgroundColor: '#0a0b10', title: 'BeeboScore Mini', icon: ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  mini.setMenu(null);
  showWhenPainted(mini);
  mini.loadURL(`http://localhost:${srv.port}/mini`);
  mini.on('closed', () => { mini = null; });
}

// Restart (used when potato mode is switched). A portable exe must relaunch the exe itself,
// not the temporary folder it unpacked into.
function restartApp() {
  app.isQuitting = true;
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  app.relaunch(exe ? { execPath: exe, args: [] } : undefined);
  saveBounds();
  if (srv) srv.close();
  app.exit(0);
}

// Potato mode renderer: draws the active layout's finished state (no intro, no effects) into a
// PNG in a hidden window — only when something changes — so overlays and OBS just show a picture.
const potatoRenderer = (() => {
  let rw = null, busy = false, again = false, timer = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function ensure() {
    if (rw && !rw.isDestroyed()) return;
    // a pixel larger than 1080p so the capture can be cropped to exactly 1920×1080
    rw = new BrowserWindow({
      show: false, width: 1921, height: 1081, useContentSize: true, frame: false, transparent: true, backgroundColor: '#00000000',
      webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false },
    });
    rw.webContents.setFrameRate(2);          // nothing animates here: barely any painting needed
    rw.webContents.setAudioMuted(true);
  }
  async function render() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      ensure();
      const name = srv.activeOverlay();
      await rw.loadURL(`http://localhost:${srv.port}/overlay/${encodeURIComponent(name)}?sbframe&instant&potato`);
      const t0 = Date.now();
      while (Date.now() - t0 < 5000) {     // wait until the layout reports it's drawn (fonts in, state applied)
        const ready = await rw.webContents.executeJavaScript("document.documentElement.classList.contains('sb-ready') && !document.documentElement.classList.contains('sb-instant')").catch(() => false);
        if (ready) break;
        await sleep(50);
      }
      await sleep(150);
      // capturePage reads back the whole finished frame (the paint stream only carries changed areas)
      let img = await rw.webContents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 });
      const size = img.getSize();
      if (size.width && (size.width !== 1920 || size.height !== 1080)) img = img.resize({ width: 1920, height: 1080, quality: 'good' });
      if (!img.isEmpty()) srv.setPotatoFrame(name, img.toPNG());
    } catch (e) { console.error('potato render failed:', e && e.message); }
    finally { busy = false; if (again) { again = false; schedule(); } }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 120); }
  return { schedule };
})();

// A still picture of a page (the Top 8 standings splash for social media): drawn in a hidden window at 1920×1080,
// once the page says it's ready (fonts and pictures in). Returns PNG and JPEG bytes.
async function captureShot(url, { width = 1920, height = 1080, timeout = 9000, clip = null, transparent = false } = {}) {
  // transparent: a Designer picture (Designer › Export as picture) keeps its see-through background
  const w = new BrowserWindow({ show: false, width: width + 1, height: height + 1, useContentSize: true, frame: false, transparent, backgroundColor: transparent ? '#00000000' : '#000000',
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false } });
  try {
    w.webContents.setAudioMuted(true);
    await w.loadURL(url);
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await w.webContents.executeJavaScript('window.__SB_SHOT_READY === true').catch(() => false)) break;
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 200));
    let img = await w.webContents.capturePage({ x: 0, y: 0, width, height });
    const sz = img.getSize();
    if (sz.width && (sz.width !== width || sz.height !== height)) img = img.resize({ width, height, quality: 'best' });
    if (clip) img = img.crop(clip);
    if (img.isEmpty()) throw new Error('The picture came out empty — try again.');
    return { png: img.toPNG(), jpg: img.toJPEG(92) };
  } finally { if (!w.isDestroyed()) w.destroy(); }
}

// 1.12.15: Layout Designer › Bake to video. A screen playing in (or out) is drawn in a hidden window with a see-through
// background and every frame it paints is kept (squeezed in the background while it plays, so memory stays small); then
// another hidden page plays those frames back at their own timing into a canvas that records a WebM with alpha (VP9).
async function bakeVideo({ renderUrl, encodeUrl, dir, width = 1920, height = 1080, fps = 30 }) {
  const zlib = require('zlib'), fsp = require('fs').promises, path = require('path');
  const deflate = b => new Promise((res, rej) => zlib.deflateRaw(b, { level: 1 }, (e, out) => e ? rej(e) : res(out)));
  const inflate = b => new Promise((res, rej) => zlib.inflateRaw(b, (e, out) => e ? rej(e) : res(out)));
  const win = o => new BrowserWindow({ show: false, width, height, useContentSize: true, frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false, ...o } });
  const w = win(); const frames = []; let rec = false, t0 = 0, pending = [];
  try {
    w.webContents.setAudioMuted(true); w.webContents.setFrameRate(fps);
    w.webContents.on('paint', (_e, _dirty, image) => {
      if (!rec) return;
      const t = Date.now() - t0, sz = image.getSize();
      // exactly width × height (a window can paint a pixel short or over on some displays)
      const im = (sz.width === width && sz.height === height) ? image : (sz.width >= width && sz.height >= height) ? image.crop({ x: 0, y: 0, width, height }) : image.resize({ width, height, quality: 'best' });
      const raw = im.toBitmap(), size = im.getSize(), f = { t, w: size.width, h: size.height, z: null };
      frames.push(f); pending.push(deflate(raw).then(z => { f.z = z; }));
    });
    await w.loadURL(renderUrl);
    const tw = Date.now();
    while (Date.now() - tw < 12000) { if (await w.webContents.executeJavaScript('!!(window.__bake && window.__bake.ready)').catch(() => false)) break; await new Promise(r => setTimeout(r, 80)); }
    const err = await w.webContents.executeJavaScript('window.__bake && window.__bake.error || ""').catch(() => '');
    if (err) throw new Error(err);
    w.webContents.invalidate(); t0 = Date.now(); rec = true;
    const dur = Number(await w.webContents.executeJavaScript('window.__bake.start()')) || 2500;
    while (Date.now() - t0 < dur) { w.webContents.invalidate(); await new Promise(r => setTimeout(r, 1000 / fps)); }
    rec = false; await Promise.all(pending);
  } finally { if (!w.isDestroyed()) w.destroy(); }
  if (!frames.length) throw new Error('Nothing was drawn — try again.');
  // the frames as PNGs (see-through), and the list the encoder plays them back from
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], raw = await inflate(f.z); f.z = null;
    const png = nativeImage.createFromBitmap(raw, { width: f.w, height: f.h }).toPNG();
    await fsp.writeFile(path.join(dir, String(i).padStart(4, '0') + '.png'), png); list.push({ t: f.t });
    if (i % 8 === 7) await new Promise(r => setImmediate(r));
  }
  await fsp.writeFile(path.join(dir, 'frames.json'), JSON.stringify({ frames: list, w: frames[0].w, h: frames[0].h, fps }));
  const e = win(); 
  try {
    e.webContents.setAudioMuted(true); e.webContents.setFrameRate(60);
    await e.loadURL(encodeUrl);
    const te = Date.now();
    while (Date.now() - te < 90000) { const d = await e.webContents.executeJavaScript('window.__bakeDone || null').catch(() => null); if (d) { if (!d.ok) throw new Error(d.msg || 'The video didn’t come out.'); return true; } await new Promise(r => setTimeout(r, 120)); }
    throw new Error('Making the video took too long.');
  } finally { if (!e.isDestroyed()) e.destroy(); }
}

// Player picker pop-up (opened from the Stream Deck "Set player" key): always on top, takes focus
// so you can type straight away. One window is reused and just switches sides.
function openPicker(side) {
  if (!srv) return;
  const focusIt = () => {
    picker.setAlwaysOnTop(true, 'pop-up-menu');
    picker.show(); picker.moveTop(); picker.focus();
    if (process.platform === 'win32' && !picker.isFocused()) { picker.minimize(); picker.restore(); picker.focus(); }
    picker.webContents.focus();
  };
  if (picker) { picker.webContents.executeJavaScript(`window.beeboPick && window.beeboPick(${side === 2 ? 2 : 1})`).catch(() => {}); focusIt(); return; }
  const { width, height, x, y } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  picker = new BrowserWindow({
    width: 460, height: 560, x: Math.round(x + (width - 460) / 2), y: Math.round(y + (height - 560) / 2),
    alwaysOnTop: true, autoHideMenuBar: true, maximizable: false, minimizable: true, skipTaskbar: false, show: false,
    backgroundColor: '#0a0b10', title: 'Set player — BeeboScore', icon: ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  picker.setMenu(null);
  picker.loadURL(`http://localhost:${srv.port}/pick?side=${side === 2 ? 2 : 1}`);
  picker.once('ready-to-show', focusIt);
  picker.on('blur', () => { if (picker && !picker.webContents.isDevToolsOpened()) picker.hide(); });   // click away = dismiss
  picker.on('closed', () => { picker = null; });
  // window.close() from the page just hides it, so the next press opens instantly
  picker.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  picker.on('close', e => { if (!app.isQuitting && win) { e.preventDefault(); picker.hide(); } });
}

function buildMenu() {
  const base = `http://localhost:${srv.port}`;
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Layouts Folder', click: () => shell.openPath(srv.overlaysDir) },
        { label: 'Open Text Output Folder', click: () => shell.openPath(srv.outputDir) },
        { type: 'separator' },
        { label: 'Mini Controller', accelerator: 'CmdOrCtrl+M', click: openMini },
        { type: 'separator' },
        { label: 'Copy OBS Overlay URL', click: () => clipboard.writeText(`${base}/overlay`) },
        { label: 'Open Overlay in Browser', click: () => shell.openExternal(`${base}/overlay`) },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    {
      label: 'Help',
      submenu: [
        { label: 'Get a start.gg API Token', click: () => shell.openExternal('https://start.gg/admin/profile/developer') },
        { type: 'separator' },
        { label: `BeeboScore ${app.getVersion()} — developed by Beebo`, enabled: false },
        { label: `Running on port ${srv.port}`, enabled: false },
      ],
    },
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win && srv) createWindow(); });
app.on('before-quit', e => {
  // 1.5.7: File › Exit with unsaved work in the layout maker: ask first. An update closing the app has set isQuitting already: no question then.
  if (!app.isQuitting && designerWin && !designerWin.isDestroyed() && !designerWin.__ok) {
    e.preventDefault();
    makerLeave().then(ok => { if (!ok) return; if (designerWin && !designerWin.isDestroyed()) designerWin.__ok = true; app.quit(); });
    return;
  }
  app.isQuitting = true; saveBounds(); if (srv) srv.close(); STATIONS.closeAll();
});
