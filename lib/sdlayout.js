'use strict';
/*
 * "Set up my Stream Deck", Windows: puts the BeeboScore keys on every 15-key Stream Deck and 32-key Stream Deck XL
 * by writing them straight into Stream Deck's own profile files. The plugin SDK has no way to place keys, and Stream
 * Deck only offers a plugin's ready-made profiles when the plugin is first installed, so this is the dependable way.
 *
 *   1. which profile each deck shows: Stream Deck keeps it in its Qt settings in the registry
 *      (HKCU\Software\Elgato Systems GmbH\StreamDeck, value "Devices": per device id, ESDProfilesInfo.ESDProfilesPreferred)
 *   2. the profiles: %APPDATA%\Elgato\StreamDeck\ProfilesV3\<PROFILE>.sdProfile\manifest.json (Device.UUID = the device id)
 *      and one folder per page, Profiles\<PAGE-UUID-UPPER>\manifest.json, with the keys under Controllers[Keypad].Actions
 *   3. a "BeeboScore" page is added to the profile the deck shows (or the one from last time is refreshed) and made the
 *      current page. The deck's other pages stay as they were; a backup of the profile is kept first.
 *   4. Stream Deck rewrites its profile files from memory when it closes, so it is closed first and started again after.
 *
 * Profile store layout as documented by the open Stream Deck tools that edit it (streamdeck-movemore, MIT;
 * streamdeck-mcp). Everything here is written fresh for BeeboScore.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const REG_KEY = 'HKCU\\Software\\Elgato Systems GmbH\\StreamDeck';
const PAGE_NAME = 'BeeboScore Prototype';
const OLD_PAGE = 'BeeboScore';                        // 1.3.3 named it this, with the plugin's old id: taken over, not doubled
const ONE = { 15: ['20GAA9901', '20GAA9902', '20GBA9901'], 32: ['20GAT9901', '20GAT9902'] };   // models we are sure of

const dataDir = () => process.env.BEEBO_SD_DATA_DIR
  || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Elgato', 'StreamDeck');
const profilesDir = () => path.join(dataDir(), 'ProfilesV3');
const run = (file, args, timeout = 15000) => new Promise((resolve, reject) =>
  execFile(file, args, { windowsHide: true, encoding: 'utf8', timeout }, (err, out) => (err ? reject(err) : resolve(out))));
const wait = ms => new Promise(r => setTimeout(r, ms));
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (f, v) => { const t = f + '.beebo-tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); };

// ---------------------------------------------------------------- which profile each deck shows (registry)
/** QSettings stores the value as REG_BINARY: UTF-16 "@Variant(…)" whose characters are QDataStream bytes (Qt 4, big-endian) */
function decodeQt(raw) {
  const text = raw.toString('utf16le').replace(/\0+$/, '');
  if (!text.startsWith('@Variant(') || !text.endsWith(')')) throw new Error('not a Qt setting');
  const inner = text.slice(9, -1), b = Buffer.alloc(inner.length);
  for (let i = 0; i < inner.length; i++) { const u = inner.charCodeAt(i); if (u > 255) throw new Error('not a Qt setting'); b[i] = u; }
  let p = 0;
  const take = n => { if (p + n > b.length) throw new Error('short Qt setting'); p += n; return p - n; };
  const u32 = () => b.readUInt32BE(take(4));
  const str = () => { const n = u32(); if (n === 0xffffffff) return null; const at = take(n); return Buffer.from(b.subarray(at, at + n)).swap16().toString('utf16le'); };
  const v = () => {
    const t = u32();
    switch (t) {
      case 1: return b[take(1)] !== 0;
      case 2: return b.readInt32BE(take(4));
      case 3: return u32();
      case 4: return Number(b.readBigInt64BE(take(8)));
      case 5: return Number(b.readBigUInt64BE(take(8)));
      case 6: return b.readDoubleBE(take(8));
      case 8: case 28: { const m = {}; for (let n = u32(); n > 0; n--) { const k = str() || ''; m[k] = v(); } return m; }
      case 9: { const l = []; for (let n = u32(); n > 0; n--) l.push(v()); return l; }
      case 10: return str();
      case 11: { const l = []; for (let n = u32(); n > 0; n--) l.push(str()); return l; }
      case 12: { const n = u32(); if (n === 0xffffffff) return null; const at = take(n); return b.subarray(at, at + n); }
      default: throw new Error('unsupported Qt value ' + t);
    }
  };
  return v();
}
async function readSelection() {
  let hex;
  if (process.env.BEEBO_SD_REG_HEX) hex = fs.readFileSync(process.env.BEEBO_SD_REG_HEX, 'utf8').trim();   // tests
  else {
    const out = await run('reg.exe', ['query', REG_KEY, '/v', 'Devices']);
    hex = (/^\s*Devices\s+REG_BINARY\s+([0-9A-F]*)\s*$/im.exec(out) || [])[1];
  }
  if (!hex) return [];
  const s = decodeQt(Buffer.from(hex, 'hex'));
  const list = [];
  for (const [id, d] of Object.entries(s || {})) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || Buffer.isBuffer(d)) continue;
    const pref = d.ESDProfilesInfo && d.ESDProfilesInfo.ESDProfilesPreferred;
    list.push({ id, name: typeof d.DeviceName === 'string' ? d.DeviceName : '', profile: /^[0-9a-f-]{36}$/i.test(pref || '') ? pref.toUpperCase() : '' });
  }
  return list;
}

// ---------------------------------------------------------------- the profile store
function readProfiles() {
  const dir = profilesDir(), out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || !/\.sdProfile$/i.test(e.name)) continue;
    try { out.push({ dir: path.join(dir, e.name), id: e.name.replace(/\.sdProfile$/i, '').toUpperCase(), m: readJSON(path.join(dir, e.name, 'manifest.json')) }); } catch {}
  }
  return out;
}
/** 15 or 32 keys, or 0 when it is neither: the plugin's own report by name first, then the model */
function sizeOf(dev, model, pluginDecks) {
  const byName = (pluginDecks || []).find(d => d.name && d.name === dev.name);
  if (byName) return byName.cols * byName.rows === 15 ? 15 : byName.cols * byName.rows === 32 ? 32 : 0;
  if (ONE[15].includes(model)) return 15;
  if (ONE[32].includes(model)) return 32;
  const sizes = [...new Set((pluginDecks || []).map(d => d.cols * d.rows))];     // one kind of deck plugged in: that one
  return sizes.length === 1 && (sizes[0] === 15 || sizes[0] === 32) ? sizes[0] : 0;
}
function pageDirs(profileDir) {
  const p = path.join(profileDir, 'Profiles');
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(p, e.name)); } catch { return []; }
}
function keysFor(layout, plugin) {
  const actions = {};
  for (const [pos, k] of Object.entries(layout.keys)) {
    actions[pos] = { ActionID: crypto.randomUUID(), LinkedTitle: false, Name: k.Name, Plugin: plugin, Resources: null,
      Settings: k.Settings, State: 0, States: Array.from({ length: k.States || 1 }, () => ({})), UUID: k.UUID };
  }
  return actions;
}

/**
 * Works out what would change, without touching anything: for each deck, the profile it shows and whether the
 * BeeboScore page is new or refreshed. { decks: [{ id, name, keys, profile, profileName, page, fresh }], skipped: [...] }
 */
async function plan(layouts, pluginDecks) {
  if (!fs.existsSync(profilesDir())) throw Object.assign(new Error('Stream Deck’s profiles folder was not found. Open Stream Deck once, then try again.'), { code: 'NOSTORE' });
  const sel = await readSelection().catch(() => []);
  const profiles = readProfiles();
  const ids = [...new Set([...sel.map(d => d.id), ...profiles.map(p => p.m.Device && p.m.Device.UUID).filter(Boolean)])];
  const decks = [], skipped = [];
  for (const id of ids) {
    const dev = sel.find(d => d.id === id) || { id, name: '', profile: '' };
    const mine = profiles.filter(p => p.m.Device && p.m.Device.UUID === id);
    const model = (mine[0] && mine[0].m.Device.Model) || '';
    if (/^(VSD|UI |AI )/i.test(id) || /^(UI|AI) Stream Deck$/i.test(model)) continue;          // virtual decks
    const size = sizeOf(dev, model, pluginDecks);
    if (!size || !layouts[String(size)]) { skipped.push({ id, name: dev.name, model }); continue; }
    // the profile the deck shows; else its plain (not app-linked) profile; else any of its profiles
    const prof = mine.find(p => p.id === dev.profile) || mine.find(p => !p.m.AppIdentifier || p.m.AppIdentifier === '*') || mine[0];
    if (!prof) { skipped.push({ id, name: dev.name, model, why: 'no profile' }); continue; }
    if (!String(prof.m.Version || '').startsWith('3')) { skipped.push({ id, name: dev.name, model, why: 'old profile format' }); continue; }
    const page = pageDirs(prof.dir).find(d => { try { const m = readJSON(path.join(d, 'manifest.json'));
      if (m.Name === PAGE_NAME) return true;
      const acts = Object.values(((m.Controllers || [])[0] || {}).Actions || {});
      return m.Name === OLD_PAGE && acts.length && acts.every(a => /^com\.t1fgc\.beeboscore\./.test(a.UUID || '')); } catch { return false; } });
    decks.push({ id, name: dev.name || (size === 32 ? 'Stream Deck XL' : 'Stream Deck'), keys: size, profile: prof.dir, profileName: prof.m.Name || '', page: page || '', fresh: !page });
  }
  return { decks, skipped };
}

/** writes the BeeboScore page into each deck's profile (Stream Deck must be closed) */
function write(p, layouts, plugin, backupDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const d of p.decks) {
    if (backupDir) {                                     // a copy of the profile as it was, the last 10 kept
      const to = path.join(backupDir, stamp, path.basename(d.profile));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.cpSync(d.profile, to, { recursive: true });
    }
    const pm = readJSON(path.join(d.profile, 'manifest.json'));
    pm.Pages = pm.Pages || {}; pm.Pages.Pages = Array.isArray(pm.Pages.Pages) ? pm.Pages.Pages : [];
    let pageId, pageDir = d.page;
    if (pageDir) pageId = path.basename(pageDir).toLowerCase();
    else { pageId = crypto.randomUUID(); pageDir = path.join(d.profile, 'Profiles', pageId.toUpperCase()); fs.mkdirSync(pageDir, { recursive: true }); }
    const layout = layouts[String(d.keys)], actions = keysFor(layout, plugin);
    if (d.page) {                                        // keys of your own on the free places (the XL's bottom row) stay
      try {
        const old = ((readJSON(path.join(pageDir, 'manifest.json')).Controllers || []).find(c => c.Type === 'Keypad') || {}).Actions || {};
        for (const [pos, a] of Object.entries(old)) if (!actions[pos] && a && !/^com\.t1fgc\.(beeboproto|beeboscore)\./.test(a.UUID || '')) actions[pos] = a;
      } catch {}
    }
    writeJSON(path.join(pageDir, 'manifest.json'), { Controllers: [{ Actions: actions, Type: 'Keypad' }], Icon: '', Name: PAGE_NAME });
    if (!pm.Pages.Pages.some(x => String(x).toLowerCase() === pageId)) pm.Pages.Pages.push(pageId);
    pm.Pages.Current = pageId;
    if (!pm.Pages.Default) pm.Pages.Default = pm.Pages.Pages[0];
    writeJSON(path.join(d.profile, 'manifest.json'), pm);
  }
  if (backupDir) try {
    const old = fs.readdirSync(backupDir).sort(); while (old.length > 10) fs.rmSync(path.join(backupDir, old.shift()), { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------- closing and starting Stream Deck (Windows)
const EXE = 'StreamDeck.exe';
async function running() {
  if (process.env.BEEBO_SD_FAKE_PROC) return fs.existsSync(process.env.BEEBO_SD_FAKE_PROC);       // tests
  try { return (await run('tasklist', ['/FI', `IMAGENAME eq ${EXE}`, '/FO', 'CSV', '/NH'])).toLowerCase().includes(`"${EXE.toLowerCase()}"`); } catch { return false; }
}
async function exePath() {
  const std = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Elgato', 'StreamDeck', EXE);
  if (fs.existsSync(std)) return std;
  try { const p = (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process StreamDeck -ErrorAction SilentlyContinue | Select-Object -First 1).Path`])).trim(); if (p && fs.existsSync(p)) return p; } catch {}
  return '';
}
async function closeApp() {
  if (process.env.BEEBO_SD_FAKE_PROC) { try { fs.unlinkSync(process.env.BEEBO_SD_FAKE_PROC); } catch {} return true; }
  // Asked politely, Stream Deck only hides in the tray, so it is ended. Its profile files on disk stay as they were.
  await run('taskkill', ['/F', '/IM', EXE]).catch(() => {});
  for (let i = 0; i < 40; i++) { if (!(await running())) return true; await wait(250); }
  return false;
}
async function startApp(exe) {
  if (process.env.BEEBO_SD_FAKE_PROC) { fs.writeFileSync(process.env.BEEBO_SD_FAKE_PROC, 'up'); return true; }
  if (!exe) return false;
  await new Promise((resolve, reject) => { const c = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false }); c.once('error', reject); c.once('spawn', () => { c.unref(); resolve(); }); });
  return true;
}

/**
 * The whole job. Returns { decks, skipped, restarted } or throws with a message for the person.
 * layouts / plugin come from layouts.json in the bundled plugin.
 */
async function install({ layouts, plugin, pluginDecks, backupDir }) {
  const p = await plan(layouts, pluginDecks);
  if (!p.decks.length) return { ...p, restarted: false };
  const wasUp = await running(), exe = await exePath();
  if (wasUp && !(await closeApp())) throw new Error('Stream Deck could not be closed to add the keys. Close it from the tray, then try again.');
  await wait(process.env.BEEBO_SD_FAKE_PROC ? 0 : 600);
  let err = null;
  try { write(await plan(layouts, pluginDecks), layouts, plugin, backupDir); } catch (e) { err = e; }    // planned again: files may have changed as it closed
  const started = await startApp(exe).catch(() => false);
  if (err) throw new Error('The keys could not be written: ' + err.message + (started ? '' : ' Start Stream Deck again from the Start menu.'));
  return { ...p, restarted: started, exeMissing: !exe };
}

const supported = () => (process.platform === 'win32' || !!process.env.BEEBO_SD_DATA_DIR) && fs.existsSync(profilesDir());

module.exports = { install, plan, write, readSelection, decodeQt, supported, profilesDir, PAGE_NAME };
