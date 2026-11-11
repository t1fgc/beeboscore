'use strict';
/*
 * BeeboScore, developed by Beebo — the barebones scoreboard: Matches, start.gg, Go online, 11 layouts,
 * the Overlay maker and Stream Deck keys. Portable: keeps its data next to the exe, uses its own port (3300),
 * and only looks for an update when you ask it to (Settings › Check for updates).
 */
const { app, BrowserWindow, Menu, shell, dialog, clipboard, nativeTheme, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('../server');
const { createUpdater } = require('./updater');

// Portable build: runs without installing, keeps its data next to the exe and uses its own port.
const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || '';
const TEST_BUILD = true;                       // portable rules: own port, data next to the exe
app.setAppUserModelId('com.t1fgc.beeboscore');
nativeTheme.themeSource = 'dark';
// keep the UI responsive: no throttling of the control panel's timers/animations while visible
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const DATA_DIR = PORTABLE_DIR ? path.join(PORTABLE_DIR, 'BeeboScore Data') : path.join(app.getPath('documents'), 'BeeboScore v1 Data');
// This build keeps its own browser profile (window state, sign-in encryption key) inside its data folder, not in the
// shared per-user AppData folder. So it stays fully portable, and it can't collide with — or be blocked from starting
// by — another BeeboScore build installed on the same PC.
app.setPath('userData', path.join(DATA_DIR, 'app-profile'));
// Potato mode (Settings › Behaviour): must be known before the app starts so the GPU can be switched off.
const POTATO = (() => { try { return !!JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data', 'config.json'), 'utf8')).settings.potatoMode; } catch { return false; } })();
if (POTATO) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-smooth-scrolling');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('renderer-process-limit', '3');
}
const APP_TITLE = 'BeeboScore';
const ICON = path.join(__dirname, '..', 'public', 'icon.png');
let win = null, srv = null, updater = null, mini = null, picker = null, SD_PLUGIN = '';
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
function saveBounds() {
  if (!win) return;
  try { fs.mkdirSync(path.dirname(WINDOW_FILE), { recursive: true }); fs.writeFileSync(WINDOW_FILE, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch {}
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(boot);
}

async function boot() {
  updater = createUpdater(app, { dir: PORTABLE_DIR });
  try {
    const sdPlugin = SD_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'streamdeck', 'com.t1fgc.beeboscore.streamDeckPlugin')
      : path.join(__dirname, '..', 'streamdeck', 'dist', 'com.t1fgc.beeboscore.streamDeckPlugin');
    srv = await start({ dataDir: DATA_DIR, port: 3300, autoPort: true, desktop: true, testBuild: TEST_BUILD, lite: true, updater,
      openPath: p => shell.openPath(p), showPicker: openPicker, capture: captureShot,
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
  buildMenu();
  createWindow();
}

function createWindow() {
  const b = readBounds();
  // first launch: a normal window that fits the screen with room around it (not maximised or fullscreen)
  const wa = screen.getPrimaryDisplay().workAreaSize, first = { width: Math.min(1480, Math.round(wa.width * .85)), height: Math.min(960, Math.round(wa.height * .85)) };
  win = new BrowserWindow({
    ...first, center: !b, fullscreen: false, ...(b ? { x: b.x, y: b.y, width: b.width, height: b.height } : {}),
    minWidth: 420, minHeight: 560, autoHideMenuBar: true,
    backgroundColor: '#0a0b10', title: APP_TITLE, icon: ICON, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' },   // sound: the preview plays without a click first. Autoscore keeps watching while the window is minimised
  });
  win.loadURL(`http://localhost:${srv.port}/`);
  win.once('ready-to-show', () => { if (b && b.maximized) win.maximize(); win.show(); });   // only if you left it maximised last time
  let t = null;
  const remember = () => { clearTimeout(t); t = setTimeout(saveBounds, 500); };
  win.on('resize', remember); win.on('move', remember); win.on('close', saveBounds);
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
  win.on('closed', () => { win = null; if (mini) mini.close(); if (previewWin) previewWin.close(); if (designerWin) designerWin.close(); if (picker) { app.isQuitting = true; picker.destroy(); } });
}

// The live preview in its own resizable window (Pop out in the panel). Right-click → Keep on top.
let previewWin = null;
function openPreview() {
  if (previewWin) { previewWin.show(); previewWin.focus(); return; }
  previewWin = new BrowserWindow({ width: 960, height: 580, minWidth: 420, minHeight: 280, autoHideMenuBar: true, backgroundColor: '#0b0d12', icon: ICON,
    title: 'BeeboScore — Live preview', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' } });
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
function openDesigner(url) {
  if (designerWin) { designerWin.loadURL(url); designerWin.show(); designerWin.focus(); return; }
  const wa = screen.getDisplayMatching(win.getBounds()).workArea;
  designerWin = new BrowserWindow({
    width: Math.min(1440, Math.max(1100, wa.width - win.getBounds().width)), height: Math.min(wa.height, Math.max(760, win.getBounds().height)),
    minWidth: 1100, minHeight: 680, autoHideMenuBar: true, backgroundColor: '#0c0e15', icon: ICON, title: 'BeeboScore — Layout Designer',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  designerWin.setMenu(null);
  designerDocked = true; placeDesigner();
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
  designerWin.on('closed', () => { designerWin = null; });
}

// Small always-on-top score controller — handy while playing or commentating.
function openMini() {
  if (mini) { mini.show(); mini.focus(); return; }
  mini = new BrowserWindow({
    width: 460, height: 330, minWidth: 360, minHeight: 300, alwaysOnTop: true, autoHideMenuBar: true, maximizable: false,
    backgroundColor: '#0a0b10', title: 'BeeboScore Mini', icon: ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  mini.setMenu(null);
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
async function captureShot(url, { width = 1920, height = 1080, timeout = 9000, clip = null } = {}) {
  const w = new BrowserWindow({ show: false, width: width + 1, height: height + 1, useContentSize: true, frame: false, backgroundColor: '#000000',
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
        { label: 'Copy OBS Overlay URL', click: () => clipboard.writeText(`${base}/overlay`) },
        { label: 'Open Overlay in Browser', click: () => shell.openExternal(`${base}/overlay`) },
        { type: 'separator' },
        { label: 'Install Stream Deck Plugin', click: () => shell.openPath(SD_PLUGIN) },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    {
      label: 'Help',
      submenu: [
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
app.on('before-quit', () => { app.isQuitting = true; saveBounds(); if (srv) srv.close(); });
