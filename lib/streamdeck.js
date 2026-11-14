'use strict';
/*
 * Stream Deck plugin housekeeping: which plugin version BeeboScore ships, which one the Stream Deck app
 * has installed, and whether the Stream Deck app is new enough for it.
 *
 *   installed plugin : <Stream Deck plugins folder>/com.t1fgc.beeboproto.sdPlugin/manifest.json
 *   Stream Deck app  : Windows → the app's uninstall entry (or StreamDeck.exe's file version)
 *                      macOS   → Elgato Stream Deck.app/Contents/Info.plist
 *   the running plugin also reports both versions when it talks to BeeboScore (most reliable).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');

const PLUGIN_ID = 'com.t1fgc.beeboproto';
const DOWNLOAD_URL = 'https://www.elgato.com/downloads';

function cmpVer(a, b) {                 // "6.4" vs "6.8.1.21263" → -1 / 0 / 1
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0), pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

// read manifest.json out of the .streamDeckPlugin (a zip) without extracting it
function readBundledManifest(file) { return readBundledJSON(file, 'manifest.json'); }
// read a JSON file from the top of the plugin folder inside the .streamDeckPlugin (manifest.json, layouts.json)
function readBundledJSON(file, inner) {
  try {
    const buf = fs.readFileSync(file);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return null;
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nlen).toString();
      if (/^[^/]+\.sdPlugin\/[^/]+$/.test(name) && name.split('/')[1] === inner) {
        const lnlen = buf.readUInt16LE(off + 26), lxlen = buf.readUInt16LE(off + 28), start = off + 30 + lnlen + lxlen;
        const raw = buf.slice(start, start + csize);
        return JSON.parse((method === 8 ? zlib.inflateRawSync(raw) : raw).toString());
      }
      p += 46 + nlen + xlen + clen;
    }
  } catch {}
  return null;
}

function pluginsDir() {
  if (process.env.BEEBO_SD_PLUGINS_DIR) return process.env.BEEBO_SD_PLUGINS_DIR;          // tests
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Elgato', 'StreamDeck', 'Plugins');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'com.elgato.StreamDeck', 'Plugins');
  return '';
}
function installedPlugin() {
  const dir = pluginsDir();
  if (!dir) return { dir: '', installed: false, version: '' };
  const m = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, PLUGIN_ID + '.sdPlugin', 'manifest.json'), 'utf8')); } catch { return null; } })();
  return { dir, installed: !!m, version: (m && m.Version) || '' };
}

let appCache = null, appCacheAt = 0, appPending = null;
function appVersion() {                 // { found, version } — cached for a minute (it shells out on Windows)
  if (process.env.BEEBO_SD_APP_VERSION) {                                                     // tests
    const v = process.env.BEEBO_SD_APP_VERSION; return Promise.resolve(v === 'none' ? { found: false, version: '' } : { found: true, version: v });
  }
  if (appCache && Date.now() - appCacheAt < 60000) return Promise.resolve(appCache);
  if (appPending) return appPending;
  appPending = new Promise(resolve => {
    const done = v => { appCache = v; appCacheAt = Date.now(); appPending = null; resolve(v); };
    if (process.platform === 'darwin') {
      for (const app of ['/Applications/Elgato Stream Deck.app', path.join(os.homedir(), 'Applications', 'Elgato Stream Deck.app')]) {
        try {
          const plist = fs.readFileSync(path.join(app, 'Contents', 'Info.plist'), 'utf8');
          const m = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
          return done({ found: true, version: m ? m[1] : '' });
        } catch {}
      }
      return done({ found: false, version: '' });
    }
    if (process.platform !== 'win32') return done({ found: false, version: '' });
    const ps = [
      "$k = Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Stream Deck*' -and $_.Publisher -like '*Elgato*' } | Select-Object -First 1",
      "if ($k -and $k.DisplayVersion) { 'reg:' + $k.DisplayVersion; exit }",
      "$e = Join-Path $env:ProgramFiles 'Elgato\\StreamDeck\\StreamDeck.exe'",
      "if (Test-Path $e) { 'exe:' + (Get-Item $e).VersionInfo.ProductVersion }",
    ].join('; ');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { timeout: 8000, windowsHide: true }, (err, out) => {
      const line = String(out || '').trim().split(/\r?\n/).pop() || '';
      const m = line.match(/^(reg|exe):\s*([\d.]+)/);
      done(m ? { found: true, version: m[2] } : { found: false, version: '' });
    });
  });
  return appPending;
}

/*
 * Everything the app needs to decide what to show / do.
 *   reported: { plugin, app, at } from the running plugin (if it has talked to us recently)
 */
async function status(bundledFile, reported) {
  const bundled = readBundledManifest(bundledFile) || {};
  const bundledVersion = bundled.Version || '';
  const minApp = (bundled.Software && bundled.Software.MinimumVersion) || '6.4';
  const inst = installedPlugin();
  const live = reported && Date.now() - (reported.at || 0) < 15000 ? reported : null;
  let app = await appVersion();
  if (live && live.app) app = { found: true, version: live.app };                 // the Stream Deck app told the plugin its own version
  const installedVersion = inst.version || (live && live.plugin) || '';
  const installed = inst.installed || !!(live && live.plugin);
  const appTooOld = !!(app.found && app.version && cmpVer(app.version, minApp) < 0);
  const outdated = installed && !!bundledVersion && !!installedVersion && cmpVer(installedVersion, bundledVersion) < 0;
  return {
    supported: !!pluginsDir(), bundled: !!bundledVersion, bundledVersion, minApp,
    appFound: app.found, appVersion: app.version || '', appTooOld,
    installed, installedVersion, outdated, upToDate: installed && !outdated,
    connected: !!live, downloadUrl: DOWNLOAD_URL,
  };
}

module.exports = { status, readBundledManifest, readBundledJSON, installedPlugin, cmpVer, PLUGIN_ID };
