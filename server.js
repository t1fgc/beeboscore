#!/usr/bin/env node
/*
 * BeeboScore by Beebo — realtime scoreboard controller + OBS overlays for fighting game streams (the essentials:
 *   Matches, Format, start.gg, OBS and going online, with the Classic layout for each game).
 *
 *   Control panel:  http://localhost:3000/       (the desktop app uses 3200)
 *   OBS overlay:    http://localhost:3000/overlay      (Browser Source, 1920x1080)
 *
 * Runs three ways:
 *   • inside the desktop app (desktop/main.js requires this file and calls start())
 *   • from a terminal:  node server.js [--port 3000] [--no-open]
 *   • on a cloud host:  set ADMIN_PASSWORD (and DATA_DIR) — see CLOUD-HOSTING.md
 */
'use strict';

const http = require('http');
const { AsyncLocalStorage } = require('async_hooks');
const actorStore = new AsyncLocalStorage();      // 1.12.19: who made the request that's being handled (the show log names them)
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { exec } = require('child_process');
const { Hub, encode: encodeMsgRaw } = require('./lib/ws');
const encodeMsg = m => encodeMsgRaw(JSON.stringify(m));
const startgg = require('./lib/startgg');
const sggauth = require('./lib/sggauth');
const bracketModel = require('./lib/bracket');
const sdHelper = require('./lib/streamdeck');
const layoutImport = require('./lib/layout-import');      // 1.5.1: layouts people make, dropped into the Layouts tab
const zip = require('./lib/zip');
const FMT = require('./lib/format');
const VT = require('./lib/vtourney');
const { createShare } = require('./lib/share');
const { createShortLinks } = require('./lib/shortlinks');
const backup = require('./lib/backup');
const { createWatch, standingOf } = require('./lib/watch');
const { createNotify } = require('./lib/notify');
const selftest = require('./lib/selftest');
const { Tunnel } = require('./lib/tunnel');
const twitch = require('./lib/twitch');
const { createViewerMatches } = require('./lib/viewers');
const { createKothRecords } = require('./lib/koth-records');
const { createCamLink } = require('./lib/camlink');
const AUTO = require('./lib/automations');            // 1.12.16: Automations
const SHOWMOD = require('./lib/show');                // 1.12.18: the show (rundown, rehearsal, show log, players, viewers, platform)
const TEAM = require('./lib/team');
// Twitch app for chat replies + official profile pictures (a public client: no secret). Set by the official build, or in the app.
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

const BUNDLE_DIR = __dirname;
const PUBLIC_DIR = path.join(BUNDLE_DIR, 'public');
const APP_VERSION = (() => { try { return require('./package.json').version; } catch { return '0.0.0'; } })();
const V = encodeURIComponent(APP_VERSION) + '.' + Date.now().toString(36);   // overlay script stamp: new on every app start / update

// Known games for the game picker, in display order. Overlays declare their game in overlay.json.
// Only games with a layout are offered (BeeboScore ships Tekken 8 layouts). Layouts made in the Designer can still say "Any game".
const GAMES = ['Tekken 8', 'Street Fighter 6', 'Avatar Legends', 'Fatal Fury: City of the Wolves'];     // 1.12.24: each has the three built-in looks
const gameRank = g => { const i = GAMES.indexOf(g); return i < 0 ? GAMES.length : i; };
// the control panel's Designer themes (Settings › Look & feel; public/themes/, drawn in art/ui-themes.js)
const UI_THEMES = ['hive', 'dojo', 'circuit', 'street', 'glacier'];

function start(opts = {}) {
  if (!opts.streamDeckPlugin) opts.streamDeckPlugin = path.join(__dirname, 'streamdeck', 'dist', 'com.t1fgc.beeboscore.lite.streamDeckPlugin');
  // ------------------------------------------------------------ paths
  const APP_DIR = opts.dataDir || process.env.DATA_DIR || process.env.FGC_DATA_DIR
    || (process.pkg ? path.dirname(process.execPath) : __dirname);
  const OVERLAYS_DIR = opts.overlaysDir || path.join(APP_DIR, 'overlays');      // 1.12.16: a second station shares the first one's layouts
  const DATA_DIR = path.join(APP_DIR, 'data');
  const OUTPUT_DIR = path.join(APP_DIR, 'output');
  const BIN_DIR = path.join(DATA_DIR, 'bin');
  const STATE_FILE = path.join(DATA_DIR, 'state.json');
  const BAKES_DIR = path.join(DATA_DIR, 'videos'); let bakeBusy = null;
  const hist = require('./lib/history').createHistory(path.join(DATA_DIR, 'history.jsonl'));      // 1.12.15: every set won, for head-to-heads and records      // 1.12.15: baked screens (WebM with a see-through background)
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
  const STARTGG_FILE = path.join(DATA_DIR, 'startgg-entrants.json');
  const SEEDED_FILE = path.join(DATA_DIR, 'seeded.json');

  const CLOUD = !!(process.env.ADMIN_PASSWORD || process.env.CLOUD_MODE === '1');

  for (const d of [DATA_DIR, OUTPUT_DIR, OVERLAYS_DIR]) fs.mkdirSync(d, { recursive: true });

  // ------------------------------------------------------------ bundled overlays
  // New bundled overlays are copied in; bundled overlays you haven't edited are upgraded when
  // the app ships a fixed version. Overlays you've edited are never overwritten.
  const MOVED_LAYOUTS = {};          // folders an older layout gave up to a new built-in one (old name → where your copy went)
  function seedOverlays() {
    const src = path.join(BUNDLE_DIR, 'overlays');
    if (path.resolve(src) === path.resolve(OVERLAYS_DIR) || !fs.existsSync(src)) return;
    const seeded = readJSON(SEEDED_FILE, {});
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const from = path.join(src, ent.name), to = path.join(OVERLAYS_DIR, ent.name);
      const bundledMeta = readJSON(path.join(from, 'overlay.json'), {});
      const bundledHash = hashFile(path.join(from, 'index.html'));
      if (!fs.existsSync(to)) {
        copyDir(from, to);
        seeded[ent.name] = { version: bundledMeta.version || 1, hash: bundledHash };
        continue;
      }
      const rec = seeded[ent.name];
      const currentHash = hashFile(path.join(to, 'index.html'));
      // 1.9: Shattered is back under its old folder name, now a Designer layout (gen 2). An older layout in that folder
      // gives it up: replaced if you never edited it, moved to "<name>-yours" (with your changes, and your settings
      // follow it) if you did.
      if ((bundledMeta.gen || 1) > (readJSON(path.join(to, 'overlay.json'), {}).gen || 1)) {
        const edited = !(rec && rec.hash === currentHash) && currentHash !== bundledHash && fs.existsSync(path.join(to, 'index.html'));
        if (edited) {
          let dst = `${ent.name}-yours`, i = 2; while (fs.existsSync(path.join(OVERLAYS_DIR, dst))) dst = `${ent.name}-yours-${i++}`;
          try { fs.renameSync(to, path.join(OVERLAYS_DIR, dst)); const mf = path.join(OVERLAYS_DIR, dst, 'overlay.json'), m = readJSON(mf, {});
            writeJSON(mf, { ...m, title: `${m.title || ent.name} (your copy)`, family: `${m.family || m.title || ent.name} (your copy)`, base: m.base ? `${m.base}-yours` : undefined }); MOVED_LAYOUTS[ent.name] = dst; } catch {}
        } else fs.rmSync(to, { recursive: true, force: true });
        copyDir(from, to); seeded[ent.name] = { version: bundledMeta.version || 1, hash: bundledHash };
        continue;
      }
      if (rec && currentHash === rec.hash && (bundledMeta.version || 1) > (rec.version || 1)) {
        copyDir(from, to); // untouched by the user → safe to upgrade
        seeded[ent.name] = { version: bundledMeta.version || 1, hash: bundledHash };
      } else if (!rec && currentHash === bundledHash) {
        seeded[ent.name] = { version: bundledMeta.version || 1, hash: bundledHash };
      }
      // older installs had no overlay.json: add it so the layout shows under the right game
      if (!fs.existsSync(path.join(to, 'overlay.json')) && fs.existsSync(path.join(from, 'overlay.json'))) {
        fs.copyFileSync(path.join(from, 'overlay.json'), path.join(to, 'overlay.json'));
      }
    }
    // layouts the app no longer ships: remove them, but only if nobody edited them
    const shipped = new Set(fs.readdirSync(src, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name));
    for (const name of Object.keys(seeded)) {
      if (shipped.has(name)) continue;
      const dir = path.join(OVERLAYS_DIR, name);
      if (!fs.existsSync(dir)) { delete seeded[name]; continue; }
      if (hashFile(path.join(dir, 'index.html')) === seeded[name].hash) { try { fs.rmSync(dir, { recursive: true, force: true }); delete seeded[name]; } catch {} }
    }
    writeJSON(SEEDED_FILE, seeded);
  }
  if (!opts.overlaysDir) seedOverlays();

  // ------------------------------------------------------------ state
  // setId: start.gg set currently on stream (so "next match" skips it)
  const blankPlayer = () => ({ name: '', team: '', pronouns: '', country: '', character: '', score: 0, loser: false, sggId: '', avatar: '', media: '', mediaKey: '', wins: '', losses: '' });
  const DEFAULT_STATE = {
    game: 'Tekken 8', event: 'Weekly Tournament', round: 'Winners Round 1', bestOf: 3,
    p1: { ...blankPlayer(), name: 'Player 1' }, p2: { ...blankPlayer(), name: 'Player 2' },
    c1: { name: '', handle: '' }, c2: { name: '', handle: '' },
    custom: {}, vs: { show: false }, splash: { show: '', side: 'W', n: 0 }, victory: { show: false, side: 0, n: 0 }, stats: { show: false, side: 1, n: 0 }, screen: '', format: null, fbar: true, setId: '', updatedAt: Date.now(),
    full: { show: '', side: 1, n: 0 }, card: { show: '', n: 0, i: 0 }, ext: {},        // 1.12.18: the show's full screens (countdown, coming up, walk-in…) and cards (storyline, picks, poll)
    h2h: { show: false }, timer: { show: false, start: 0, end: 0 },                    // 1.12.21: the head-to-head line and the set timer
  };
  let SHOW = null;                    // 1.12.18: lib/show.js, made once everything it uses is ready
  // every update gets a stamp later than the last one: two updates in the same millisecond (a format result and the
  // next match it loads) used to share one, and the overlays skipped the second as a repeat (1.12.1)
  let lastStamp = 0;
  const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
  const DEFAULT_SETTINGS = { highlights: false, autoSwitchLayout: true, autoUpdate: true, updateRepo: '', lanNoPassword: false, refreshOnReset: true, shortcuts: {}, potatoMode: false, fxQuality: 'auto', autoTop8: true, sdAutoUpdate: true, bracketRefresh: '20', bracketPage: '14', uiTheme: 'classic', autoVictory: true, victoryHold: '8', soundOn: false, soundVolume: '80', obsVolume: false, followFormat: true, bracketTitle: '', bracketPics: 'avatar', autoStandings: true, vtHeadsUp: true, lightFx: false, laptopMode: false, lockSplash: true, formatBarOpacity: 80, kothViewers: false, vsStyle: 'full', vsColor1: '', vsColor2: '', overlayColours: 'team', sdLayout: 'follow', upscale: 'auto', setupDone: false, sggReport: 'ask',
    overlayLang: 'en', sfxPack: 'off', cvd: false, outScale: 'auto', uiScale: '100', reduceMotion: false, customTheme: '', galleryUrl: '', sdAccent: '',   // 1.12.18
    venueBracket: true, venueNext: true, venueClock: true, venueQr: false, venueQrUrl: '',   // 1.12.19: the venue screen's options
    // 1.12.21: moments (lib/moments.js) — the banners as a whole, each one, and the seed gap that makes an upset; the GAME n counter; the set timer starting by itself
    moments: true, moGame: true, moMatchPoint: true, moComeback: true, moReverseSweep: true, moSweep: true, moUpset: true, moRunback: true, moLosersRun: true, moReset: true, upsetGap: '4', sbGameNo: true, sbTimer: false, vsStrip: true, resetSplash: true };      // vsStrip, resetSplash: 1.12.23

  // What overlays are sent is the state plus things worked out fresh each time (liveState, withPics): each player's
  // splash picture, the custom VS Splash pictures, sound, the next matches… The control panel sends its whole copy back
  // on Update, so those must never be taken in as state: a picture kept that way would outlive the choice that made it
  // (switching back to the profile picture, or removing a name bar, would then change nothing on stream).
  // ('palette' is from 1.1.0 – 1.1.2, which had colour palettes: a state file from those builds may still carry one.)
  const DERIVED = ['palette', 'vsArt', 'brand', 'snd', 'upcoming', 'top8', 'twitch', 'fv', 'hist', 'spon', 'x'];
  function stripDerived(s) {
    if (!s || typeof s !== 'object') return s;
    for (const k of DERIVED) delete s[k];
    for (const k of ['p1', 'p2']) if (s[k] && typeof s[k] === 'object') { delete s[k].splashArt; delete s[k].pic; }
    return s;
  }
  let state = stripDerived(mergeDeep(structuredClone(DEFAULT_STATE), readJSON(STATE_FILE, {})));      // (also cleans a state file an earlier build wrote them into)
  if (!GAMES.includes(state.game) && state.game !== 'Any game') state.game = GAMES[0];      // a game picked in an older build that has no layout

  // ------------------------------------------------------------ splash pictures (per player)
  // Each player shows either their start.gg profile picture (the small frame) or a character image uploaded for them
  // (a large panel) on the VS Splash and the Victory Splash. Uploads live in <data>/player-art; the choice is kept by name.
  const PICS_DIR = path.join(DATA_DIR, 'player-art'), PICS_FILE = path.join(DATA_DIR, 'player-art.json'), VSART_DIR = path.join(DATA_DIR, 'vs-art');
  const PIC_RULES = { width: 900, height: 1080, minWidth: 200, minHeight: 240, maxSide: 4096, maxBytes: 8 * 1024 * 1024, types: ['PNG', 'WebP', 'JPG'] };
  let pics = readJSON(PICS_FILE, {});                    // { "<name, lower case>": { name, file, type, w, h, size, at, use: 'art' | 'profile' } }
  const picKey = n => String(n || '').trim().toLowerCase();
  const picUrl = a => (a && a.file ? '/player-art/' + a.file : '');
  const picsList = () => Object.values(pics).map(a => ({ name: a.name, use: a.use === 'art' ? 'art' : 'profile', url: picUrl(a), w: a.w || 0, h: a.h || 0, size: a.size || 0, at: a.at || 0 })).sort((a, b) => a.name.localeCompare(b.name));
  /** the state as overlays see it: a player set to "character image" gets splashArt (the picture) and pic: 'art' */
  function withPics(s) {
    let out = s;
    for (const k of ['p1', 'p2']) {
      const a = s[k] && s[k].name ? pics[picKey(s[k].name)] : null;
      if (a && a.use === 'art' && a.file) { if (out === s) out = { ...s }; out[k] = { ...s[k], splashArt: picUrl(a), pic: 'art' }; }
    }
    const va = vsArtLive();                               // custom VS Splash pictures (a name bar, a header) and the lettering colours that go with them
    if (va) { if (out === s) out = { ...s }; out.vsArt = va; }
    return out;
  }
  function picsChanged() {
    saveLater(PICS_FILE, () => pics, 0); broadcast('playerArt', picsList());
    state.updatedAt = stamp(); broadcast('state', liveState());         // a new stamp, or overlays treat it as the update they already have
  }
  // 1.12.6: how each player's picture sits — its size and where it's centred — kept by name, used on every screen that shows it
  // (FullVS, GlassVS and the PlayerCards): { "<name, lower case>": { name, z (size, 1 = as it is), x, y (% of the frame) } }
  const FRAMES_FILE = path.join(DATA_DIR, 'player-frames.json');
  let frames = readJSON(FRAMES_FILE, {});
  const frameOf = n => frames[picKey(n)] || null;
  function framesLive() {
    const names = new Set([state.p1 && state.p1.name, state.p2 && state.p2.name]);
    const f = state.format;
    if (f) for (const x of f.kind === 'teams' ? (f.teams || []).flatMap(t => t.players) : (f.fighters || [])) names.add(x.name);
    const out = {}; let any = false;
    for (const n of names) { const fr = n && frameOf(n); if (fr) { out[picKey(n)] = { z: fr.z, x: fr.x, y: fr.y }; any = true; } }
    return any ? out : null;
  }
  /** what kind of picture is this, really? (by its bytes, not its name) → { type, ext, w, h } or null */
  function imageInfo(b) {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString('latin1', 12, 16) === 'IHDR') return { type: 'image/png', ext: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
      const kind = b.toString('latin1', 12, 16);
      if (kind === 'VP8X') return { type: 'image/webp', ext: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { type: 'image/webp', ext: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { type: 'image/webp', ext: 'webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
      return null;
    }
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {                       // JPEG: walk the segments to the frame header
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'image/jpeg', ext: 'jpg', w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    return null;
  }
  const ASSET_DIR = opts.assetsDir || path.join(DATA_DIR, 'assets'), ASSET_INDEX = path.join(ASSET_DIR, 'index.json');      // (and its picture library)
  const STATION = { n: Math.max(1, Number(opts.station) || 1), name: String(opts.stationName || '').slice(0, 40) };          // 1.12.16: stations
  const assetList = () => { const l = readJSON(ASSET_INDEX, []); return Array.isArray(l) ? l : []; };
  // 1.12.13: does this character have art (a picture tagged "character", named after it)? — the format bar's player cards
  // show it, and follow the player's pick as it changes. Read again only when the library changes.
  const artSlug = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let charArtMemo = { at: -1, names: [] };
  function charArt(character) {
    const want = artSlug(character); if (!want) return '';
    let at = 0; try { at = fs.statSync(ASSET_INDEX).mtimeMs; } catch {}
    if (at !== charArtMemo.at) charArtMemo = { at, names: assetList().filter(x => x.tag === 'character').map(x => artSlug(x.name)) };
    return charArtMemo.names.some(n => n === want || n.startsWith(want + '-') || want.startsWith(n + '-')) ? '/assets/char/' + encodeURIComponent(want) : '';
  }
  function fvWithArt(fv) {
    if (!fv) return fv; const add = p => { if (p && p.character) { const u = charArt(p.character); if (u) p.charPic = u; } };
    for (const t of fv.teams || []) for (const p of t.players || []) add(p); for (const x of fv.fighters || []) add(x); return fv;
  }
  let upcoming = [];                        // next matches on start.gg (not saved; the panel keeps it fresh)
  // overlays also get: the next matches, the Top 8 (once start.gg has it) and the Twitch channel name — for designer layouts
  let top8Cache = { at: -1, v: null };
  function top8View() {
    let m; try { m = bracket.model; } catch { return null; } if (!m || !m.top8) return null;
    if (top8Cache.at === m.updatedAt) return top8Cache.v;
    const t = m.top8, slim = s => ({ round: s.round, done: s.done, a: { name: s.a.name, team: s.a.team, score: s.a.score ?? '', win: s.a.win, seed: s.a.seed }, b: { name: s.b.name, team: s.b.team, score: s.b.score ?? '', win: s.b.win, seed: s.b.seed } });
    const v = { type: t.type, reached: !!t.reached }; for (const k of ['qf', 'sf', 'f', 'wsf', 'wf', 'lt8', 'lqf', 'lsf', 'lf', 'gf']) if (Array.isArray(t[k])) v[k] = t[k].map(slim);
    if (m.gf && !v.gf) v.gf = m.gf.map(slim);
    top8Cache = { at: m.updatedAt, v }; return v;
  }
  const liveState = () => {
    const t8 = top8View(), ch = (config.twitch && config.twitch.channel) || '', fv = state.format ? fvWithArt(FMT.view(state.format)) : null;
    if (fv) fv.pending = formatPending;
    const snd = { on: config.settings.soundOn === true, vol: config.settings.obsVolume ? 100 : soundVol() };   // obsVolume: full level out, the OBS mixer sets it     // stream sound (Settings › Sound) — off by default
    // BeeboFX: the effects quality (Settings › Effects engine; Light effects means light) and the latest manual cue (hype burst)
    const fq = ['auto', 'full', 'light', 'off', 'ultra'].includes(config.settings.fxQuality) ? config.settings.fxQuality : 'auto';
    const gfx = { q: fq === 'auto' && config.settings.lightFx ? 'light' : fq, cue: fxCue, laptop: !!config.settings.laptopMode };
    const fx = { lockSplash: config.settings.lockSplash !== false, fbo: Math.max(0, Math.min(100, Number(config.settings.formatBarOpacity ?? 80))) };     // fbo (1.12.6): the format bar's background, % solid     // Settings › Scoreboard: the lock-in splash in team formats
    const koth = (state.splash && state.splash.show === 'flead') || (state.format && state.format.preset === 'koth') ? kothRec.view() : null;   // 1.12.6: the leaderboard splash
    const frames = framesLive();
    const brand = typeof brandLive === 'function' ? brandLive() : null;
    const comm = (state.splash && state.splash.show === 'comm') || (config.comm && config.comm.where === 'scene') ? commLive() : null;   // 1.12.9: its own OBS source always has it      // 1.12.6: the commentary screen
    fx.vsStyle = config.settings.vsStyle === 'glass' ? 'glass' : 'full';     // 1.12.6: which VS the VS key plays — FullVS or GlassVS
    { const hx = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : ''); fx.vsc = [hx(config.settings.vsColor1), hx(config.settings.vsColor2)]; }   // 1.12.6: each side's colour on FullVS and GlassVS ('' = the layout's own)
    fx.teamCol = config.settings.overlayColours !== 'layout';
    if (!fx.teamCol) fx.vsc = ['', ''];         // 1.12.24: "Layout's own" — FullVS and GlassVS stay in the layout's colours in every match, not only in team formats
    fx.upv = upMode() === 'off' ? 0 : (upv || 0);                         // 1.12.8: a new upscaled picture → overlays ask for pictures again     // 1.12.8: false = every colour on stream is the layout's own (no team colours)
    const shown = fx.teamCol ? withPics(state) : (x => ({ ...x, p1: { ...x.p1, teamColor: '' }, p2: { ...x.p2, teamColor: '' } }))(withPics(state));
    const hv = state.p1 && state.p2 && state.p1.name && state.p2.name ? hist.view(state.p1.name, state.p2.name) : null;     // 1.12.15: {hist.line}, {hist.p1.record}…
    const spon = sponsorsLive();          // 1.12.16: sponsor rotation
    const x = SHOW ? SHOW.live() : null;   // 1.12.18: the show layer
    if (x && x.cvd) fx.vsc = [fx.vsc[0] || '#e69f00', fx.vsc[1] || '#0072b2'];     // colour-blind-safe sides (orange and blue) unless you picked your own
    return { ...shown, snd, gfx, fx, ...(x && Object.keys(x).length ? { x } : {}), ...(spon ? { spon } : {}), ...(hv ? { hist: hv } : {}), ...(brand ? { brand } : {}), ...(frames ? { frames } : {}), ...(comm ? { comm } : {}), ...(koth ? { koth } : {}), ...(upcoming.length ? { upcoming } : {}), ...(t8 ? { top8: t8 } : {}), ...(ch ? { twitch: { channel: ch } } : {}), ...(fv ? { fv } : {}) };
  };
  let fxCue = { n: 0, kind: '' };              // BeeboFX: bumped by the Stream Deck / panel "Hype burst"
  // 1.12.16: sponsor rotation — logos and messages that take turns in a small card (bottom centre, or a corner), never
  // while a full-screen splash is up. Settings › Sponsors; the Stream Deck's Sponsor key shows the next one now.
  const SPON_WHERE = ['bottom', 'bottom-left', 'bottom-right'];     // never over the game's health bars and timer (top) or its Heat gauges (bottom corners: the corners sit above them)
  function sponsorsClean(x) {
    x = x && typeof x === 'object' ? x : {};
    const items = (Array.isArray(x.items) ? x.items : []).slice(0, 24).map(i => ({ src: /^\/assets\/[a-f0-9]{12}\.(png|jpe?g|gif|webp|svg|avif)$/i.test(String(i && i.src || '')) ? String(i.src) : '', text: String(i && i.text || '').slice(0, 90) })).filter(i => i.src || i.text);
    return { on: !!x.on, every: Math.max(10, Math.min(900, Number(x.every) || 40)), show: Math.max(3, Math.min(60, Number(x.show) || 8)), where: SPON_WHERE.includes(x.where) ? x.where : 'bottom', items };
  }
  let sponCue = 0;
  // 1.12.16: caster notes (by player, private) and the casters' page
  const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
  let notes = readJSON(NOTES_FILE, {}); if (!notes || typeof notes !== 'object' || Array.isArray(notes)) notes = {};
  function castersView() {
    const key = n => String(n || '').trim().toLowerCase(), pl = k => ({ name: state[k].name || '', team: state[k].team || '', country: state[k].country || '', character: state[k].character || '', score: Number(state[k].score) || 0, notes: notes[key(state[k].name)] || '' });
    const hv = state.p1.name && state.p2.name ? hist.view(state.p1.name, state.p2.name) : null;
    const prof = k => { const x = SHOW && state[k].name ? SHOW.profiles.get(state[k].name) : null; return x ? { pronouns: x.pronouns, main: x.main, socials: x.socials, sponsor: x.sponsor, bio: x.bio } : null; };       // 1.12.18
    const rank = k => (SHOW && state[k].name ? SHOW.seasons.rankOf(state[k].name) : null), best = k => (SHOW && state[k].name ? SHOW.seasons.results(state[k].name).slice(0, 3) : []);
    return { event: state.event || '', round: state.round || '', bestOf: state.bestOf, p1: { ...pl('p1'), profile: prof('p1'), rank: rank('p1'), best: best('p1') }, p2: { ...pl('p2'), profile: prof('p2'), rank: rank('p2'), best: best('p2') }, hist: hv, a: hv ? hist.player(state.p1.name) : null, b: hv ? hist.player(state.p2.name) : null, upcoming: upcoming.slice(0, 4), c1: state.c1, c2: state.c2,
      stories: SHOW ? SHOW.storyList() : [], rundown: SHOW ? (v => (v.running ? { name: v.current.name, next: v.next ? v.next.name : '', endsAt: v.current.endsAt } : null))(SHOW.rundown.view()) : null };
  }
  // 1.12.16: the second operator's remote — a private link for a phone or tablet on this network, limited to what you allow
  const OP_PERMS = { score: 'Scores, swap, reset and undo', splash: 'VS, victory, bracket, Top 8 and Hide all', screen: 'The layout’s screens and the stinger', match: 'Next match, and the stats card', sponsor: 'Sponsors and chapter marks', show: 'The rundown, countdowns, storylines, picks and polls' };
  function opStatus(perms, name) {        // what the operator's remote shows (the link remote and a signed-in operator)
    const sd = SHOW ? SHOW.sd() : null;
    return { name, perms, p1: { name: state.p1.name, score: Number(state.p1.score) || 0 }, p2: { name: state.p2.name, score: Number(state.p2.score) || 0 }, round: state.round || '', bestOf: state.bestOf,
      vs: !!(state.vs && state.vs.show) || !!(state.playerVs && state.playerVs.show), victory: !!(state.victory && state.victory.show), splash: (state.splash && state.splash.show) || '', screen: state.screen || '', screens: perms.includes('screen') ? layoutScreens() : [],
      stats: state.stats || {}, winner: winnerOf(state), spon: !!sponsorsLive(), show: perms.includes('show') && sd ? { rd: sd.rd, full: sd.full, card: sd.card, pred: sd.pred, poll: sd.poll, pollLast: sd.pollLast, stories: sd.stories } : null };
  }
  const OP_ACTIONS = { score: ['score', 'setScore', 'swap', 'reset', 'undo', 'undoAny', 'timer'], splash: ['vs', 'playervs', 'victory', 'splash', 'hideAll', 'hideOne', 'moments', 'h2h', 'strip', 'greset'], screen: ['screen', 'stinger'], match: ['nextMatch', 'stats'], sponsor: ['sponsor', 'chapter'] };
  function operatorView() { const o = config.operator || {}, pth = o.token ? '/op/' + o.token : ''; return { on: !!o.token, token: o.token || '', perms: o.perms || ['score', 'splash'], name: o.name || '', all: OP_PERMS, path: pth, links: pth ? lanUrls().slice(1).map(u => u + pth) : [] }; }
  const opOk = t => { const o = config.operator || {}; return !!(o.token && t && t.length === o.token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(o.token))); };
  const sponsorsLive = () => { const s = sponsorsClean(config.sponsors); return s.items.length ? { ...s, cue: sponCue } : null; };
  // 1.12.6: King of the Hill records (King of the Hill this event, Emperor of the World all time), kept in the data folder
  let kothPushT = null;
  // 1.12.6: the commentary screen — 1 to 4 commentators (2 by default), each with their own camera: the built-in camera link
  // (lib/camlink.js: a private link, WebRTC straight into OBS) or a cutout for a camera source of your own in OBS
  const commCfg = () => {
    const c = config.comm || {}, people = Array.from({ length: 4 }, (_, i) => { const p = (c.people || [])[i] || {}; return { name: String(p.name || '').slice(0, 40), handle: String(p.handle || '').slice(0, 40), mode: p.mode === 'cutout' ? 'cutout' : 'link' }; });
    return { count: Math.max(1, Math.min(4, Math.round(Number(c.count)) || 2)), title: String(c.title || '').slice(0, 60), people, match: c.match !== false,
      where: c.where === 'scene' ? 'scene' : 'overlay', scene: String(c.scene || '').slice(0, 120), talk: c.talk !== false };   // 1.12.11 talk: a name tag when someone talks   // 1.12.9: on the overlay, or its own OBS source in its own scene (the app switches OBS to it)
  };
  let camLink = null;
  const camLive = {};                       // slot → the commentator's connection
  // 1.12.8/9: the camera relay — when a direct (WebRTC) connection can't be made (strict networks, phone carriers, a tunnel
  // that won't carry the live connection), the commentator's page sends its camera as short video pieces over plain web
  // requests to this app, which passes them straight to the commentary screen. ~½ s behind instead of ~0.2 s, but it works
  // wherever the camera page itself opens.
  const camRelay = {};                         // slot → { sess, mime, init: Buffer, at, restart }
  const relayLive = k => !!(camRelay[k] && Date.now() - camRelay[k].at < 4000);
  const camOn = k => !!camLive[k] || relayLive(k);
  function commLive() {
    const c = commCfg();
    return { ...c, people: c.people.slice(0, c.count).map((p, i) => ({ ...p, live: camOn(i + 1) })) };
  }
  // 1.12.11: who's talking — each camera page listens to its own microphone and says when its commentator starts and stops
  // (repeated every few seconds while talking; a camera that goes quiet or away stops counting after 6 seconds)
  const camTalk = {};
  const talking = k => !!(camTalk[k] && camTalk[k].on && Date.now() - camTalk[k].at < 6000 && camOn(k));
  function setTalk(k, on) { const was = talking(k); camTalk[k] = { on: !!on, at: Date.now() }; if (was !== talking(k)) camsChanged(); clearTimeout(camTalk['t' + k]); if (on) camTalk['t' + k] = setTimeout(() => { if (!talking(k)) camsChanged(); }, 6100); }
  function camsChanged() {
    const st = { slots: Object.fromEntries([1, 2, 3, 4].map(k => [k, camOn(k)])), relay: Object.fromEntries([1, 2, 3, 4].map(k => [k, relayLive(k)])), talk: Object.fromEntries([1, 2, 3, 4].map(k => [k, talking(k)])) };
    hub.broadcastWhere(c => c.meta.authed || (c.meta.cam && c.meta.cam.role === 'view'), 'cams', st);
    hub.broadcast('talk', st.talk);      // 1.12.15: BeeboFX 4's audio bus on every overlay (looks that pulse when the commentary talks)
    if (state.splash && state.splash.show === 'comm') broadcast('state', liveState());
  }
  let top8Last = null, top8Armed = false;     // (a bracket that was already finished when the app started isn't offered again)
  const TOP8_DIR = path.join(DATA_DIR, 'top8-results');
  // 1.12.9: the event's logo and its sponsors — on the splash screens (VS, Victory, the bracket, Top 8, standings, the
  // commentary screen, the format splashes) and, if wanted, a sponsor badge on the scoreboard. Files in <data>/brand.
  const BRAND_DIR = path.join(DATA_DIR, 'brand');
  const STING_DIR = path.join(DATA_DIR, 'stingers');     // 1.12.10: stinger videos made in the Layout Designer, for OBS
  const brandCfg = () => { const b = config.brand || {}; const okFile = f => /^(logo|sp)-[0-9a-f]{12}\.(png|jpg|webp)$/.test(String(f || '')) && fs.existsSync(path.join(BRAND_DIR, f));
    return { logo: okFile(b.logo) ? b.logo : '', sponsors: (Array.isArray(b.sponsors) ? b.sponsors : []).filter(x => x && okFile(x.file)).slice(0, 12).map(x => ({ file: x.file, name: String(x.name || '').slice(0, 40) })),
      showLogo: b.showLogo !== false, showSponsors: b.showSponsors !== false, onBoard: !!b.onBoard }; };
  const brandLive = () => { const b = brandCfg(); if (!b.logo && !b.sponsors.length) return null;
    return { logo: b.logo && b.showLogo ? '/brand/' + b.logo : '', sponsors: b.showSponsors || b.onBoard ? b.sponsors.map(x => ({ url: '/brand/' + x.file, name: x.name })) : [], splash: b.showSponsors, board: b.onBoard }; };
  const kothRec = createKothRecords({ dir: DATA_DIR, changed: () => { clearTimeout(kothPushT); kothPushT = setTimeout(() => { broadcast('state', liveState()); broadcast('koth', kothRec.view()); }, 120); } });
  camLink = createCamLink({ dir: DATA_DIR, changed: (why, l) => { if (why === 'revoke' && camLive[l.slot]) { try { hub.sendTo(camLive[l.slot], { type: 'cam-ended', data: { why: 'The host took this link back.' } }); camLive[l.slot].socket.end(); } catch {} delete camLive[l.slot]; camsChanged(); } } });
  const soundVol = () => Math.max(0, Math.min(100, Math.round(Number(config.settings.soundVolume ?? 80)) || 0));
  // ------------------------------------------------------------ game formats (lib/format.js): team battles, Death Battle, KOTH, leagues
  let formatPending = 0, formatAutoT = null;
  const formatUndo = [];
  const formatUndoAt = [];                 // when each format snapshot was taken (for the Stream Deck's one Undo key)
  function formatSnap() { formatUndo.push(JSON.stringify({ ...state, updatedAt: 0 })); formatUndoAt.push(Date.now()); if (formatUndo.length > 40) { formatUndo.shift(); formatUndoAt.shift(); } }
  function formatPlayers(f) {          // the current match → the normal scoreboard (P1 / P2, round, best-of), scores at 0
    const sd = FMT.sides(f), pl = x => x ? { ...blankPlayer(), name: x.name, team: x.teamName || x.team || '', country: x.country || '', character: x.character || '', pronouns: x.pronouns || '', avatar: x.avatar || '', media: x.pic || '', mediaKey: x.picKey || '', sggId: x.sggId || '',   // media: their own picture / clip from the roster (`pic` on the scoreboard is the splash-picture marker)
     
      wins: f.kind === 'elim' || f.kind === 'teams' ? (x.wins || 0) : '', losses: f.kind === 'elim' || f.kind === 'teams' ? (x.losses || 0) : '', teamColor: f.kind === 'teams' && /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : '' } : { ...blankPlayer(), teamColor: '' };   // teamColor (1.12.6): the VS Splash wears the team's colour
    return { p1: pl(sd.a), p2: pl(sd.b), round: FMT.label(f), bestOf: FMT.bestOf(f), setId: '' };
  }
  function setFormat(f, { load = true, snap = true } = {}) {
    if (snap) formatSnap();
    formatPending = 0; clearTimeout(formatAutoT);
    const patch = { format: f };
    if ((!f || f.status === 'setup') && ['fvs', 'fboard', 'fwin'].includes(state.splash && state.splash.show)) patch.splash = { ...state.splash, show: '' };   // its splash goes with it (or it would block the victory splash)
    if (load && f && f.status === 'live' && f.match) Object.assign(patch, formatPlayers(f), { victory: { show: false } });
    if (f && f.status === 'done') patch.round = FMT.label(f);
    { const prev = state.format; if (prev && prev.status === 'live' && (!f || f.status !== 'live') && state.playerVs && state.playerVs.show) patch.playerVs = { show: false }; }   // GlassVS goes with the format it was up for
    const prevPreset = state.format ? state.format.preset : '';
    kothTrack(state.format, f);
    setState(patch, { keepPages: true });
    if (f && f.preset === 'koth' && f.status === 'live' && config.settings.kothViewers) kothPullViewers();
    if ((f ? f.preset : '') !== prevPreset) followFormat();
    const koLast = f && (f.events || []).some(e => ['tko', 'dead', 'out'].includes(e.type));   // the last K.O. plays out before the champion splash comes up
    if (f && f.status === 'done' && (f.events || []).some(e => e.type === 'done') && f.rules.splash !== false) setTimeout(() => { if (state.format && state.format.status === 'done') setState({ splash: { show: 'fwin', side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } }, { undo: true }); }, koLast ? 5600 : 2600);
  }
  // 1.12.6: every King of the Hill fight goes into the records (lib/koth-records.js): King of the Hill (this event) and
  // Emperor of the World (everyone, all time). An event starts when the format goes live; an undo takes its fights back
  function kothTrack(prev, f) {
    try {
      const was = prev && prev.preset === 'koth' ? prev : null, now = f && f.preset === 'koth' ? f : null;
      if (now && now.status === 'live' && (!was || was.status !== 'live') && !(was && was.status === 'done')) kothRec.startEvent(now.name);
      if (now && was) {
        const a = (was.log || []).length, b = (now.log || []).length;
        if (b < a) kothRec.unfight((now.log || []).length + 1);
        for (let i = a; i < b; i++) {
          const l = now.log[i], x = (now.fighters || []).find(y => same(y.name, l.w === 1 ? l.a : l.b));
          const crowned = (now.events || []).some(e => e.type === 'crown' && e.to === (x && x.id));
          kothRec.fight({ winner: l.w === 1 ? l.a : l.b, loser: l.w === 1 ? l.b : l.a, streak: x ? x.streak : 0, n: l.n || i + 1, crowned, viewer: kothViewers });
        }
      }
      if (was && was.status === 'live' && (!now || now.status === 'done')) { const k = now && now.king && (now.fighters || []).find(y => y.id === now.king); kothRec.endEvent(k ? k.name : ''); }
    } catch (e) { console.error('koth records:', e.message); }
  }
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const kothViewers = {};                // names that came in from the Twitch queue (marked "viewer" in the records)
  function formatWatch() {             // a set inside the format was won: ask to confirm (or confirm by itself)
    const f = state.format;
    // Team Death Battle: the switch window closes once the next set is under way
    if (f && f.status === 'live' && f.switchOpen && !f.heldOpen && (Number(state.p1.score) || Number(state.p2.score))) { setTimeout(() => { try { if (state.format && state.format.switchOpen && (Number(state.p1.score) || Number(state.p2.score))) setFormat(FMT.lockSwitch(state.format), { load: false, snap: false }); } catch {} }, 0); }
    const w = f && f.status === 'live' && f.match ? winnerOf(state) : 0;
    if (w === formatPending) return;
    formatPending = w; clearTimeout(formatAutoT); formatAutoT = null;
    state.updatedAt = stamp();                  // a new stamp, or clients skip it as a repeat
    broadcast('state', liveState());
    if (w && f.rules.auto) {
      const wait = Math.max(3, Number(f.rules.autoDelay) || (Number(config.settings.victoryHold) || 6) + 2) * 1000;
      formatAutoT = setTimeout(() => { formatAutoT = null; try { if (formatPending === w) formatAction({ do: 'confirm' }); } catch {} }, wait);
    }
  }
  // ------------------------------------------------------------ one event at a time: a game format, a viewer tournament or viewer matches
  function runningEvent() {
    const f = state.format;
    if (f && f.status !== 'done') return { kind: 'format', name: `${f.name || 'A game format'}`, label: 'game format', where: 'Format tab', tab: 'format' };
    if (typeof vt !== 'undefined' && vt && vt.status !== 'done') return { kind: 'vt', name: vt.name || 'The viewer tournament', label: 'viewer tournament', where: 'Bracket tab', tab: 'bracket' };
    if (typeof vm !== 'undefined' && vm && vm.data && (vm.data.open || vm.data.current)) return { kind: 'vm', name: 'Viewer matches', label: 'viewer matches', where: 'Twitch tab', tab: 'twitch' };
    return null;
  }
  function oneEvent(kind) {
    const r = runningEvent();
    if (r && r.kind !== kind) throw Object.assign(new Error(`${r.name} (${r.label}) is running. Only one event runs at a time — finish it or end it in the ${r.where} first.`), { event: r });
  }
  function formatAction(b = {}) {
    const f = state.format, need = () => { if (!f) throw new Error('Set up a format in the Format tab first.'); return f; };
    if (['create', 'start', 'reset'].includes(b.do)) oneEvent('format');
    switch (b.do) {
      case 'create': setFormat(FMT.create(b.preset, b.data || {}), { load: false }); break;
      case 'save': {                     // setup edits from the Format tab (names, order, rules)
        const nf = FMT.normalize({ ...need(), ...(b.format || {}), status: f.status, seq: (f.seq || 0) + 1, events: [{ type: 'edit' }], editor: String(b.editor || '').slice(0, 20) });
        if (f.status === 'live') { nf.match = f.match; nf.log = f.log; }
        setFormat(nf, { load: false, snap: false }); break;
      }
      case 'start': setFormat(FMT.start(need())); break;
      case 'confirm': {
        const w = Number(b.w) || winnerOf(state); if (!w) throw new Error('Nobody has won this set yet.');
        // the Victory Splash is still up: it goes first, then the result (its K.O. or lost life) plays on a clear screen
        if (state.victory && state.victory.show && !b.afterSplash) {
          clearTimeout(formatAutoT); formatAutoT = null;
          setState({ victory: { ...state.victory, show: false } }, { undo: true });
          setTimeout(() => { try { if (state.format && state.format.status === 'live') formatAction({ do: 'confirm', w, afterSplash: true }); } catch {} }, 800);
          return { ok: true, fv: FMT.view(state.format), after: 'victory' };
        }
        setFormat(FMT.apply(need(), w, [Number(state.p1.score) || 0, Number(state.p2.score) || 0])); break;
      }
      case 'forfeit': setFormat(FMT.forfeit(need(), Number(b.side) === 2 ? 2 : 1)); break;
      case 'swap': setFormat(FMT.swap(need(), Number(b.side) === 2 ? 2 : 1, Number(b.index), { force: !!b.force })); break;
      case 'lock': {                     // 1.12.13: { toggle: true } (the Stream Deck's Lock in key) undoes a lock-in made too early
        const g = need(); if (b.toggle && !g.switchOpen && FMT.canUnlock(g)) setFormat(FMT.unlockSwitch(g), { load: false }); else setFormat(FMT.lockSwitch(g), { load: false }); break;
      }
      case 'unlock': setFormat(FMT.unlockSwitch(need()), { load: false }); break;
      case 'character': {                // 1.12.13: a player picked another character — their card (and the scoreboard, if they're on it) follows
        const g = need(), nm = String(b.name || '').trim(); if (!nm) throw new Error('Whose character?');
        setFormat(FMT.setCharacter(g, nm, b.character), { load: false, snap: false });
        const on = ['p1', 'p2'].find(k => state[k] && String(state[k].name || '').trim().toLowerCase() === nm.toLowerCase());
        if (on && String(state[on].character || '') !== String(b.character || '').trim()) setState({ [on]: { character: String(b.character || '').trim().slice(0, 40) } });
        break;
      }
      case 'adjust': {                   // the Format tab's player manager: lives, points, order, knock-outs, results…
        const g = need(), key = x => { const sd = x.match ? FMT.sides(x) : {}; return `${x.status}|${sd.a ? sd.a.name : ''}|${sd.b ? sd.b.name : ''}`; };
        const nf = FMT.adjust(g, b); setFormat(nf, { load: key(nf) !== key(g) }); break;
      }
      case 'pick': setFormat(FMT.pickMatch(need(), String(b.sid || ''))); break;
      case 'join': setFormat(FMT.join(need(), b.player || {}), { load: need().status !== 'live' ? false : !need().match }); break;
      case 'leave': setFormat(FMT.leave(need(), String(b.id || '')), { load: false }); break;
      case 'lives': setFormat(FMT.setLives(need(), String(b.id || ''), b.lives), { load: false }); break;
      case 'end': setFormat(FMT.end(need())); break;
      case 'reset': { const g = need(); setFormat(FMT.create(g.preset, { name: g.name, rules: g.rules, teams: g.teams, fighters: g.fighters }), { load: false }); break; }
      case 'clear': {                    // back to a normal match: drop what the format put on the scoreboard (its round name, its W / L counts)
        const f = state.format, lbl = f ? FMT.label(f) : null;
        setFormat(null, { load: false });
        if (f) { const patch = { p1: { wins: '', losses: '', teamColor: '' }, p2: { wins: '', losses: '', teamColor: '' } }; if (lbl && state.round === lbl) patch.round = ''; setState(patch); }
        break;
      }
      case 'undo': {
        const prev = formatUndo.pop(); formatUndoAt.pop(); if (!prev) throw new Error('Nothing to undo in the format.');
        const r = JSON.parse(prev); r.vs = state.vs; r.splash = state.splash; r.victory = { ...(state.victory || {}), show: false };
        if (r.format) { r.format.seq = ((state.format && state.format.seq) || 0) + 1; r.format.events = [{ type: 'undo' }]; }
        try { kothTrack(state.format, r.format || null); } catch (e) { console.error('koth undo:', e.message); }   // 1.12.6: the records take the fight back too
        formatPending = 0; setState(r, { replace: true, undo: true, keepPages: true }); break;
      }
      case 'splash': {                   // fvs = team VS, fboard = the board (teams / Death Battle / standings), fwin = champion
        const kind = ['fvs', 'fboard', 'fwin', 'flead'].includes(b.kind) ? b.kind : 'fboard', cur = (state.splash && state.splash.show) || '';
        const on = b.show === undefined || b.show === 'toggle' ? cur !== kind : !!b.show;
        if (on && kind !== 'flead') need();            // flead (1.12.6): the King of the Hill leaderboard — any time, from the records
        setState({ splash: on ? { show: kind, side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } : { show: '' } }, { undo: true }); break;
      }
      default: throw new Error('Unknown format action.');
    }
    return { ok: true, fv: state.format ? FMT.view(state.format) : null };
  }
  // 1.9: a fresh start — Shattered is the only built-in layout. The twelve looks of 1.6 – 1.8 (Ember, Oni, Frostbite…) and
  // their format versions are retired: settings, OBS addresses and Stream Deck keys that still name one follow to
  // Shattered (the same format version), unless you edited that layout (then it stays, with your changes, under its
  // own name). The crew version of 1.5's Shattered was …-teams.
  const RETIRED_LOOKS = ['ember', 'oni', 'frostbite', 'venom', 'royal', 'crimson', 'goldrush', 'sakura', 'tidal', 'voltage', 'chrome', 'pastel'];
  const LAYOUT_FORMATS = ['crew', 'death', 'gauntlet', 'koth', 'league', 'tdb', 'teambattle'];
  const RENAMED_LAYOUTS = { 'tekken8-shattered-teams': 'tekken8-shattered-crew',
    ...Object.fromEntries(RETIRED_LOOKS.flatMap(l => [[`tekken8-${l}`, 'tekken8-shattered'], ...LAYOUT_FORMATS.map(v => [`tekken8-${l}-${v}`, `tekken8-shattered-${v}`])])) };
  function renameOldLayouts(c) {
    let n = 0;
    const to = v => MOVED_LAYOUTS[v] || (RENAMED_LAYOUTS[v] && !fs.existsSync(path.join(OVERLAYS_DIR, v, 'index.html')) ? RENAMED_LAYOUTS[v] : '');
    const walk = o => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && to(v)) { o[k] = to(v); n++; }
      else if (v && typeof v === 'object') walk(v);
      if (to(k) && !(to(k) in o)) { o[to(k)] = o[k]; delete o[k]; n++; }
    } };
    walk(c); return n;
  }
  let config = { activeOverlay: 'tekken8-default', startgg: {}, ...readJSON(CONFIG_FILE, {}) };
  config.bracketSource = 'startgg';      // BeeboScore: the bracket always comes from start.gg (no viewer tournaments)
  if (renameOldLayouts(config)) writeJSON(CONFIG_FILE, config);
  config.startgg = config.startgg || {};
  // ------------------------------------------------------------ custom VS Splash pictures (every layout)
  // A name bar (behind each player's name: 920 × 250) and a header (across the top: 1920 × 200). The files live in
  // <data>/vs-art. The lettering on a custom name bar takes colours that suit the picture: the control panel works them
  // out from the picture itself when it is uploaded (config.vsArt.fit), or the user picks their own (auto: false).
  const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : d);
  const lumOf = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  function cleanVsArt(a) {
    a = a && typeof a === 'object' ? a : {};
    const pic = x => (x && typeof x === 'object' && /^(bar|header)-\d+\.(png|webp|jpg)$/.test(String(x.file || '')) ? { file: x.file, w: Number(x.w) || 0, h: Number(x.h) || 0, at: Number(x.at) || 0 } : null);
    const f = a.fit && typeof a.fit === 'object' ? a.fit : {};
    return { bar: pic(a.bar), header: pic(a.header), mirror: a.mirror !== false, auto: a.auto !== false, ink: hexOr(a.ink, '#ffffff'), accent: hexOr(a.accent, '#ffd75e'), scrim: !!a.scrim,
      fit: { ink: hexOr(f.ink, '#ffffff'), accent: hexOr(f.accent, '#ffd75e'), scrim: !!f.scrim, busy: !!f.busy, contrast: Math.max(0, Math.min(21, Number(f.contrast) || 0)) } };
  }
  config.vsArt = cleanVsArt(config.vsArt);
  const VSART_RULES = { bar: { width: 920, height: 250 }, header: { width: 1920, height: 200 }, maxBytes: 8 * 1024 * 1024, maxSide: 4096, types: ['PNG', 'WebP', 'JPG'] };
  const vsArtUrl = x => (x && x.file ? '/vs-art/' + x.file : '');
  /** for the control panel */
  const vsArtView = () => { const a = config.vsArt; return { bar: a.bar ? { url: vsArtUrl(a.bar), w: a.bar.w, h: a.bar.h } : null, header: a.header ? { url: vsArtUrl(a.header), w: a.header.w, h: a.header.h } : null, mirror: a.mirror, auto: a.auto, ink: a.ink, accent: a.accent, scrim: a.scrim, fit: a.fit, rules: VSART_RULES, live: vsArtLive() }; };
  /** for overlays (state.vsArt): the pictures and the lettering colours, ready to use; null when no picture is set */
  function vsArtLive() {
    const a = config.vsArt; if (!a || (!a.bar && !a.header)) return null;
    const out = { bar: vsArtUrl(a.bar), header: vsArtUrl(a.header), mirror: a.mirror };
    if (a.bar) {
      const ink = a.auto ? a.fit.ink : a.ink, light = lumOf(ink) > 0.4;      // light lettering gets a dark edge and backing, dark lettering a light one
      Object.assign(out, { ink, accent: a.auto ? a.fit.accent : a.accent, scrim: a.auto ? a.fit.scrim : a.scrim,
        edge: light ? '0 3px 0 rgba(0,0,0,.85),0 0 16px rgba(0,0,0,.75)' : '0 2px 0 rgba(255,255,255,.85),0 0 16px rgba(255,255,255,.7)',
        scrimColor: light ? 'rgba(0,0,0,.62)' : 'rgba(255,255,255,.68)', chip: light ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.66)' });
    }
    return out;
  }
  function vsArtChanged() {
    saveConfig(); broadcast('vsArt', vsArtView());
    state.updatedAt = stamp(); broadcast('state', liveState());         // a new stamp, so overlays take it as a new update
  }
  // ------------------------------------------------------------ start.gg sign-in (lib/sggauth.js): tokens sealed on disk, never sent to a browser
  const sggVault = sggauth.createVault({ dir: DATA_DIR, secure: opts.secureStore });
  // Discord channel notifications (lib/notify.js): the webhook link is sealed like the start.gg tokens
  const notify = createNotify({ store: { get: () => config.notify, set: v => { config.notify = v; saveConfig(); } }, vault: sggVault, log: m => console.log(m), muted: () => !!(SHOW && (SHOW.rehearsing || SHOW.standby)) });
  const sggBuiltIn = (() => { const f = readJSON(path.join(BUNDLE_DIR, 'startgg-oauth.json'), {}); return process.env.STARTGG_CLIENT_ID ? { clientId: process.env.STARTGG_CLIENT_ID, clientSecret: process.env.STARTGG_CLIENT_SECRET || '', redirect: process.env.STARTGG_REDIRECT_URI || f.redirect || '' } : f; })();
  const sggAuth = sggauth.createAuth({
    store: { get: () => config.startgg.oauth || {}, set: patch => { config.startgg.oauth = { ...(config.startgg.oauth || {}), ...patch }; saveConfig(); } },
    vault: sggVault, builtIn: sggBuiltIn, gqlMe: t => startgg.loadMe(t),
    open: u => { if (opts.openExternal) opts.openExternal(u); else openInOS(u); },
  });
  const sggHas = () => !!(config.startgg.token || sggAuth.signedIn());
  /** the token start.gg calls use: your sign-in when you're signed in (refreshed as needed), else the API token */
  const sggTok = () => (sggAuth.signedIn() ? () => sggAuth.token() : config.startgg.token);
  // an install from before the first-time setup existed (it already has settings) doesn't get the setup
  if (config.settings && typeof config.settings === 'object' && !('setupDone' in config.settings) && Object.keys(config.settings).length) config.settings.setupDone = true;
  config.settings = { ...DEFAULT_SETTINGS, ...(config.settings || {}) };
  let players = readJSON(PLAYERS_FILE, []);
  let sggEntrants = readJSON(STARTGG_FILE, []);
  const revs = {};

  // Writes are batched so rapid score changes never stall the app.
  const pending = new Map();
  function saveLater(file, getData, ms = 400) {
    clearTimeout(pending.get(file));
    pending.set(file, setTimeout(() => {
      pending.delete(file);
      fsp.mkdir(path.dirname(file), { recursive: true })
        .then(() => fsp.writeFile(file + '.tmp', JSON.stringify(getData(), null, 2)))
        .then(() => KEEP_BAK(file) ? fsp.copyFile(file, file + '.bak').catch(() => {}) : null)          // 1.12.15: the last good copy
        .then(() => fsp.rename(file + '.tmp', file))
        .catch(() => {});
    }, ms));
  }
  function flushSaves() {
    for (const [file, t] of pending) { clearTimeout(t); }
    pending.clear();
    try { writeJSON(STATE_FILE, state); writeJSON(CONFIG_FILE, config); writeJSON(VIEWERS_FILE, vm.data); } catch {}
  }
  const saveConfig = () => { try { liteWatch(); } catch {} return saveLater(CONFIG_FILE, () => config, 50); };

  // ------------------------------------------------------------ realtime
  const hub = new Hub();
  // 1.12.16: smaller updates. Overlays and panels that say they can take them get only what changed since the last update
  // ("statep": the paths that changed, one or two levels deep, and what was removed) instead of the whole scoreboard every
  // time — most of all for viewers watching through the online link. Each update is numbered (rev); a page that missed one
  // asks for the whole thing again ("state-full"). Everything else still gets the whole state.
  let stRev = 0, stLast = null;
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  function diffState(prev, next) {
    const set = [], del = [], J = v => JSON.stringify(v);
    for (const k of Object.keys(prev)) if (next[k] === undefined) del.push([k]);
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue; const o = prev[k];
      if (isObj(v) && isObj(o)) {
        for (const k2 of Object.keys(o)) if (v[k2] === undefined) del.push([k, k2]);
        for (const [k2, v2] of Object.entries(v)) if (v2 !== undefined && J(v2) !== J(o[k2])) set.push([k, k2, v2]);
      } else if (J(v) !== J(o)) set.push([k, v]);
    }
    return { set, del };
  }
  function broadcastState(data) {
    const seq = latency.sent(), base = stRev, now = JSON.parse(JSON.stringify(data));       // numbered so overlays can report when it hit their screen
    const patch = stLast ? diffState(stLast, now) : null; stRev++; stLast = now;
    const fullS = JSON.stringify({ type: 'state', data: now, seq, rev: stRev }); let full = null, part = null;
    if (patch) { const s = JSON.stringify({ type: 'statep', data: { base, rev: stRev, ...patch }, seq }); if (s.length < fullS.length * .8) part = encodeMsgRaw(s); }
    for (const c of hub.clients) { if (c.meta.cam) continue; try { c.socket.write(part && c.meta.patch ? part : (full = full || encodeMsgRaw(fullS))); } catch {} }
  }
  const stateFor = () => { const ls = liveState(); return stLast && JSON.stringify(ls) === JSON.stringify(stLast) ? { data: ls, rev: stRev } : { data: ls, rev: 0 }; };
  function broadcast(type, data) {
    if (type === 'reload' && data && data.overlay) revs[data.overlay] = Date.now();
    if (type === 'state') broadcastState(data);
    else hub.broadcast(type, data);
    if (potatoRender() && (type === 'state' || type === 'active-changed' || type === 'reload')) opts.onPotatoDirty();
  }

  // ------------------------------------------------------------ viewer latency
  // Every overlay that's open (OBS, a browser tab, someone's PC across the world through the
  // online link) answers each numbered update once it's drawn on screen. Times are measured on
  // this PC's clock only, so other people's clocks being off never matters:
  //   on screen ≈ (round trip − their draw time) / 2 + their draw time
  const latency = (() => {
    const viewers = new Map();            // viewer id -> info
    const sentAt = new Map();             // seq -> time sent
    let seq = 0, pushTimer = null, lastPush = 0;
    const KEEP = 24;
    const now = () => Number(process.hrtime.bigint() / 1000000n);
    const clean = (s, n) => String(s == null ? '' : s).replace(/[^\w\/+\- .]/g, '').slice(0, n);
    function sent() {
      seq++; sentAt.set(seq, now());
      if (sentAt.size > 64) sentAt.delete(sentAt.keys().next().value);
      return seq;
    }
    function list() {
      const t = now(), out = [];
      for (const v of viewers.values()) {
        const last = v.hits[v.hits.length - 1];
        out.push({ id: v.id, kind: v.kind, country: v.country, tz: v.tz, obs: v.obs, layout: v.layout, mode: v.mode,
          ping: v.ping, last: last ? last.ms : null, lastAgo: last ? Math.round((t - last.at) / 1000) : null, lastTest: last ? !!last.test : false,
          hits: v.hits.map(h => h.ms), hidden: !!v.hidden, since: Math.round((t - v.since) / 1000), gone: !!v.gone, gfx: v.gfx && t - v.gfx.at < 15000 ? v.gfx : null });
      }
      return out.sort((a, b) => (a.kind === b.kind ? b.since - a.since : ['online', 'lan', 'pc'].indexOf(a.kind) - ['online', 'lan', 'pc'].indexOf(b.kind)));
    }
    function push() {                     // to signed-in control panels, at most ~3×/s
      if (pushTimer) return;
      const wait = Math.max(0, 300 - (Date.now() - lastPush));
      pushTimer = setTimeout(() => { pushTimer = null; lastPush = Date.now(); hub.broadcastWhere(c => c.meta.authed, 'latency', list()); }, wait);
    }
    function onText(client, text) {
      if (text.length > 600) return;
      let m; try { m = JSON.parse(text); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.type === 'patch-ok') { client.meta.patch = true; return; }                                   // 1.12.16: smaller updates
      if (m.type === 'state-full') { hub.sendTo(client, stLast ? { type: 'state', data: stLast, rev: stRev } : { type: 'state', data: liveState(), rev: 0 }); return; }
      const t = now();
      if (m.type === 'lat-hello') {
        const id = clean(m.v, 24); if (!id) return;
        if (!viewers.has(id) && viewers.size >= 60) return;
        const v = viewers.get(id) || { id, hits: [], ping: null, since: t };
        Object.assign(v, { kind: client.meta.kind, country: client.meta.country, tz: clean(m.tz, 48), obs: !!m.obs, layout: clean(m.layout, 60), mode: m.mode === 'potato' ? 'potato' : 'live', gone: 0, client });
        viewers.set(id, v); client.meta.viewer = id;
        try { client.socket.write(encodeMsg({ type: 'lat-ping', t })); } catch {}
        return push();
      }
      const v = viewers.get(client.meta.viewer); if (!v) return;
      if (m.type === 'gfx-load') {        // 1.12.11: how hard BeeboFX 3 is working on that screen (and whether its watchdog stepped it down)
        const n = (x, mx) => Math.max(0, Math.min(mx, Math.round((Number(x) || 0) * 10) / 10));
        v.gfx = { fps: n(m.fps, 240), ms: n(m.ms, 9999), level: [0, 1, 2].includes(m.level) ? m.level : 0, why: clean(m.why, 80), shown: n(m.shown, 999), on: !!m.on, q: clean(m.q, 8), at: t,
          engine: m.engine === 4 ? 4 : 3, contexts: n(m.contexts, 16), gpu: clean(m.gpu, 120), gpuClass: ['dedicated', 'integrated', 'software', 'unknown'].includes(m.gpuClass) ? m.gpuClass : '' };   // 1.12.15: BeeboFX 4 reports for every engine
        return push();
      }
      if (m.type === 'lat-pong' && Number.isFinite(m.t) && m.t <= t && t - m.t < 60000) { v.ping = t - m.t; return push(); }
      if (m.type === 'lat-ack' && sentAt.has(m.seq)) {
        const rtt = t - sentAt.get(m.seq), draw = Math.max(0, Math.min(rtt, Number(m.draw) || 0));
        if (v.lastSeq === m.seq) return; v.lastSeq = m.seq;
        v.hits.push({ ms: Math.max(1, Math.round((rtt - draw) / 2 + draw)), at: t, test: !!m.test });
        v.hidden = !!m.hidden;
        if (v.hits.length > KEEP) v.hits.shift();
        return push();
      }
    }
    function onClose(client) {
      const v = viewers.get(client.meta.viewer);
      if (v && v.client === client) { v.gone = now(); push(); }
    }
    const tick = setInterval(() => {      // ping everyone, forget viewers who left (a refresh reconnects within a second or two)
      const t = now();
      for (const [id, v] of viewers) {
        if (v.gone && t - v.gone > 8000) { viewers.delete(id); push(); continue; }
        if (!v.gone) try { v.client.socket.write(encodeMsg({ type: 'lat-ping', t })); } catch {}
      }
    }, 3000);
    tick.unref && tick.unref();
    function test() { const n = sent(); hub.broadcast('lat-probe', {}, { seq: n }); return n; }
    return { sent, list, onText, onClose, test, push };
  })();
  // the camera link's signalling: offers, answers and ICE candidates passed between a commentator and a commentary screen —
  // only between those two, nothing else (the picture itself never comes through here)
  const CAM_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  function camText(client, text) {
    if (text.length > 60000) return;
    let m; try { m = JSON.parse(text); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const me = client.meta.cam;
    if (me.role === 'view') {
      if (m.type === 'want-relay') {          // the direct connection didn't come up: ask the camera page for the relay (it starts a fresh piece, so the picture begins on a keyframe)
        const k = Number(m.slot); if (![1, 2, 3, 4].includes(k)) return;
        camRelay[k] = { ...(camRelay[k] || { at: 0 }), restart: true };
        if (camLive[k]) hub.sendTo(camLive[k], { type: 'cam-relay', data: { on: true } });
        if (camRelay[k].init) hub.sendTo(client, { type: 'cam-chunk', data: { slot: k, sess: camRelay[k].sess, mime: camRelay[k].mime, first: true, b64: camRelay[k].init.toString('base64'), stale: true } });
        return;
      }
      const cam = camLive[Number(m.slot)]; if (!cam) return;
      if (m.type === 'want' || m.type === 'bye') return hub.sendTo(cam, { type: 'cam-' + m.type, data: { from: client.meta.cid } });
      if (m.type === 'sig' && m.data && typeof m.data === 'object') return hub.sendTo(cam, { type: 'cam-sig', data: { from: client.meta.cid, sig: m.data } });
    } else if (me.role === 'cam' && camLive[me.slot] === client) {
      if (m.type === 'sig' && m.data && typeof m.data === 'object') { for (const c of hub.clients) if (c.meta.cam && c.meta.cam.role === 'view' && c.meta.cid === m.to) hub.sendTo(c, { type: 'cam-sig', data: { slot: me.slot, sig: m.data } }); }
      if (m.type === 'state') camsChanged();
      if (m.type === 'talk') setTalk(me.slot, !!m.on);
    }
  }
  hub.onText = (client, text) => (client.meta.cam ? camText(client, text) : latency.onText(client, text));
  hub.onClose = client => {
    if (client.meta.cam) {
      if (client.meta.cam.role === 'cam' && camLive[client.meta.cam.slot] === client) { delete camLive[client.meta.cam.slot]; camsChanged(); }
      if (client.meta.cam.role === 'view') for (const k of Object.keys(camLive)) hub.sendTo(camLive[k], { type: 'cam-bye', data: { from: client.meta.cid } });
      return;
    }
    latency.onClose(client);
  };

  // ------------------------------------------------------------ potato mode
  // Low-end mode: the desktop app renders the active layout to a still PNG whenever something
  // changes; overlays just show that picture (and output/overlay.png works as an OBS Image source).
  const potato = () => !!(config && config.settings && config.settings.potatoMode);
  const potatoRender = () => potato() && typeof opts.onPotatoDirty === 'function';
  let potatoFrame = { ver: 0, png: null, name: '' };
  function setPotatoFrame(name, png) {
    potatoFrame = { ver: potatoFrame.ver + 1, png, name };
    fsp.mkdir(OUTPUT_DIR, { recursive: true }).then(() => fsp.writeFile(path.join(OUTPUT_DIR, 'overlay.png'), png)).catch(() => {});
    hub.broadcast('potato', { ver: potatoFrame.ver });
  }
  const potatoPage = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BeeboScore overlay (potato)</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}img{display:block;width:100%;height:100%}</style></head>
<body><img id="i" alt="" src="/overlay.png?v=${potatoFrame.ver}"><script>
var v=${potatoFrame.ver},i=document.getElementById('i'),ws=null,wsOk=false;
function show(n2){if(n2===v)return;v=n2;var n=new Image();n.onload=function(){i.src=n.src};n.src='/overlay.png?v='+v}
function look(){fetch('/api/potato',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){show(d.ver);if(!d.potato)location.reload()}).catch(function(){})}
// 1.12.12: the app announces each new picture; this page waits to hear it instead of asking every 700 ms
function sock(){try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws')}catch(e){ws=null;return}
  ws.onopen=function(){wsOk=true;look()};
  ws.onmessage=function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}if(m.type==='potato'&&m.data)show(m.data.ver);else if(m.type==='reload'||m.type==='active-changed')look()};
  ws.onclose=function(){wsOk=false;setTimeout(sock,2000)}}
sock();
setInterval(function(){if(!wsOk)look()},1500);setInterval(look,6000);
</script></body></html>`;
  // Fresh page load for every open overlay (OBS sources, browser tabs, online links).
  let refreshTimer = null;
  // ms: how long to wait first. A reset waits until the page on screen has played its own way back (the loser's bar
  // closing up, the gold fading), so the fresh copy comes in over a page that already looks the same.
  function refreshOverlays(ms = 150, force = false) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function go() {
      // never under a full-screen splash: the fresh copy would show it without its entrance. Wait until it's gone.
      // (Refresh OBS, pressed by hand, goes straight away.)
      if (!force && ((state.vs && state.vs.show) || (state.victory && state.victory.show) || (state.splash && state.splash.show))) { refreshTimer = setTimeout(go, 1000); return; }
      const now = Date.now();
      try { for (const n of fs.readdirSync(OVERLAYS_DIR)) revs[n] = now; } catch {}  // polling clients
      hub.broadcast('reload', {});                                                     // WebSocket clients
    }, ms);
  }

  // Refresh OBS (1.12): every BeeboScore browser source in OBS reloads, as with OBS's own "Refresh cache of current page"
  // (through OBS's WebSocket, with the address and password from Settings); every other open overlay reloads too
  let obsRefreshAt = 0;
  // Refresh OBS (the panel button and the Stream Deck key): only BeeboScore's own overlay pages reload — every browser
  // source showing one fetches a fresh, uncached copy and swaps it in seamlessly. OBS itself is never contacted (1.12.1).
  async function refreshObs() {
    if (Date.now() - obsRefreshAt < 1500) return { ok: true, skipped: true };      // a double press
    obsRefreshAt = Date.now();
    refreshOverlays(0, true);
    lastObsRefresh = { at: Date.now(), ok: true, msg: 'Overlay refreshed in OBS' };
    broadcast('obsrefresh', lastObsRefresh);
    return { ok: true, ...lastObsRefresh };
  }
  let lastObsRefresh = null;
  // ------------------------------------------------------------ Set up Stream Deck (1.12): the plugin sees the request in its status and
  // asks Stream Deck to show the BeeboScore profile on each deck (Stream Deck asks the streamer once to add it)
  const sdSetup = { n: 0, at: 0, done: 0, sent: [] };
  let sdDevices = [];
  const sdSetupView = () => ({ n: sdSetup.n, at: sdSetup.at, done: sdSetup.done >= sdSetup.at && sdSetup.n > 0, sent: sdSetup.sent, devices: sdDevices,
    connected: Date.now() - (remoteSeen.streamdeck || 0) < 6000 });
  function sdSetupStart() {
    if (Date.now() - (remoteSeen.streamdeck || 0) > 6000) throw new Error('The BeeboScore Stream Deck plugin isn’t running. Open the Stream Deck app (install the plugin first if you haven’t), then try again.');
    sdSetup.n++; sdSetup.at = Date.now(); sdSetup.done = 0; sdSetup.sent = [];
    return { ok: true, ...sdSetupView() };
  }

  const history = []; // previous states, for Undo
  function setState(next, { replace = false, undo = false, keepPages = false } = {}) {
    stripDerived(next);
    if (!undo) {
      const snap = JSON.stringify({ ...state, updatedAt: 0 });
      if (!history.length || history[history.length - 1].snap !== snap) history.push({ snap, at: Date.now() });
      if (history.length > 50) history.shift();
    }
    const hadScore = Number(state.p1 && state.p1.score) > 0 || Number(state.p2 && state.p2.score) > 0;
    const vsWasOn = !!(state.vs && state.vs.show);
    const namesWere = [state.p1 && state.p1.name, state.p2 && state.p2.name].map(n => String(n || '').trim().toLowerCase());
    const picsWere = [state.p1, state.p2].map(x => x ? { media: String(x.media || ''), mediaKey: String(x.mediaKey || ''), teamColor: String(x.teamColor || '') } : null);
    // only one full-screen splash at a time: VS Splash, bracket / Top 8 or the victory splash
    if (next && next.vs && next.vs.show) { next.splash = { show: '' }; next.victory = { show: false }; }
    if (next && next.splash && next.splash.show) { next.vs = { show: false }; next.victory = { show: false }; }
    if (next && next.victory && next.victory.show) { next.vs = { show: false }; next.splash = { show: '' }; }
    // 1.12.18: the show's full screens take turns with the splashes too
    if (next && next.full && next.full.show) { next.vs = { show: false }; next.splash = { show: '' }; next.victory = { show: false }; next.playerVs = { show: false }; }
    else if (next && ((next.vs && next.vs.show) || (next.splash && next.splash.show) || (next.victory && next.victory.show) || (next.playerVs && next.playerVs.show) || next.screen) && state.full && state.full.show) next.full = { ...(next.full || {}), show: '' };
    const prevSt = SHOW ? structuredClone(state) : null;
    const winWas = winnerOf(state), victoryWas = !!(state.victory && state.victory.show);
    const autoWas = autoSnap(state);                                   // 1.12.16: Automations — what was on before
    if (next && next.splash && 'show' in next.splash && !['', 'bracket', 'top8', 'standings', 'fvs', 'fboard', 'fwin', 'flead', 'vtjoin', 'comm'].includes(next.splash.show)) next.splash.show = '';
    if (next && next.splash && 'side' in next.splash && !['W', 'L'].includes(next.splash.side)) next.splash.side = 'W';
    const splashWas = (state.splash && state.splash.show) || '';
    const pageWas = state.splash ? `${state.splash.show}|${state.splash.side}|${state.splash.n}` : '';
    state = replace ? mergeDeep(structuredClone(DEFAULT_STATE), next) : mergeDeep(state, next);
    if (next && next.custom) state.custom = next.custom;
    // 1.12.22: a new player on a side (a start.gg set, a name typed in) doesn't inherit the last one's own picture or team colour —
    // after a game format, FullVS and GlassVS showed the format's roster pictures over the bracket's players. The panel sends the
    // whole player back, old picture and all, so: a new name with the picture that side already had → the picture goes. (A swap
    // or a format brings the picture with the name, so it stays.)
    const fmtLive = next && 'format' in next ? !!(next.format && next.format.status === 'live') : !!(state.format && state.format.status === 'live');
    if (!fmtLive) for (const [i, k] of [[0, 'p1'], [1, 'p2']]) {
      const nx = next && next[k], p = state[k], was = picsWere[i]; if (!nx || !p || !('name' in nx) || !was) continue;
      if (String(nx.name || '').trim().toLowerCase() === namesWere[i]) continue;
      if (String(p.media || '') === was.media && String(p.mediaKey || '') === was.mediaKey) { p.media = ''; p.mediaKey = ''; }
      if (String(p.teamColor || '') === was.teamColor) p.teamColor = '';
    }
    if (next && 'format' in next) state.format = next.format || null;          // the format is always sent whole
    // 1.12.13: a new character in the Match tab's Character box, during a format: that player's card follows
    else if (state.format && state.format.status === 'live') for (const k of ['p1', 'p2']) if (next && next[k] && 'character' in next[k] && state[k] && state[k].name) state.format = FMT.setCharacter(state.format, state[k].name, state[k].character);
    // the victory splash belongs to the set's winner: it goes away the moment that's no longer true
    const winNow = winnerOf(state);
    if (!state.victory) state.victory = { show: false, side: 0, n: 0 };
    if (state.victory.show && winNow !== Number(state.victory.side)) state.victory.show = false;
    state.updatedAt = stamp();
    broadcast('state', liveState());           // overlays first — everything else can wait
    try { if (vt && vt.status === 'live' && vt.now) { const k = `${state.p1.name}|${state.p1.score}|${state.p2.name}|${state.p2.score}`; if (k !== vtScoreKey) { vtScoreKey = k; hub.broadcast('vtpub', vtPublic()); } } } catch {}   // the sidebar's live score (not before start-up has set it all up)
    const quiet = !!(SHOW && SHOW.standby), pretend = !!(SHOW && SHOW.rehearsing);      // 1.12.18: the backup PC only copies; a rehearsal writes nothing down and reports nothing
    if (!quiet) victoryWatch(winWas, winNow, victoryWas, undo);
    if (!quiet && !pretend) try { reportWatch(winWas, winNow, undo); } catch {}
    if (!quiet && !pretend) try { histWatch(winWas, winNow, undo); } catch {}      // 1.12.15: player history
    if (!quiet) try { autoWatch(autoWas, autoSnap(state), winWas, winNow, undo); } catch (e) { console.error('automations:', e.message); }
    try { setStartWatch(autoWas, autoSnap(state)); } catch {}                   // 1.12.16: when each set began (VOD chapters)
    if (SHOW && prevSt) try { SHOW.onState(prevSt, state, { undo, winWas, winNow }); } catch (e) { console.error('show:', e.message); }
    // Scores reset to 0–0: reload the overlay pages so every layout starts clean.
    if (hadScore && !undo && !keepPages && !Number(state.p1.score) && !Number(state.p2.score) && config.settings.refreshOnReset !== false) refreshOverlays(3200);   // (a format's next match keeps the pages: its effects are playing) — 1.12.21: 3.2 s, after the bars have slid out and back in
    // a new match at 0–0 (both players changed: Next match from start.gg, Clear…): the pages start clean too. Not while a format runs.
    else if (!hadScore && !undo && !keepPages && !state.format && config.settings.refreshOnReset !== false && !Number(state.p1.score) && !Number(state.p2.score)
      && [state.p1.name, state.p2.name].every((n, i) => String(n || '').trim().toLowerCase() !== namesWere[i])) refreshOverlays(3200);
    saveLater(STATE_FILE, () => state);
    writeTextOutputs();
    rememberPlayers();
    syncRuns(!vsWasOn && !!(state.vs && state.vs.show));   // fresh records every time the VS Splash opens
    if (!splashWas && state.splash && ['bracket', 'top8', 'standings'].includes(state.splash.show)) bracketWatch(true);
    formatWatch();
    if (state.splash && `${state.splash.show}|${state.splash.side}|${state.splash.n}` !== pageWas) pageClock();
  }

  // ------------------------------------------------------------ 1.12.15: player history
  // A won set is written down 10 s after the win (time to undo a mis-click); taking the win back before then forgets it
  let histT = null;
  function histWatch(winWas, winNow, undo) {
    if (winNow && !winWas && !undo) {
      clearTimeout(histT);
      if (config.settings.highlights) { const nm = `${state.round || 'Set'} - ${state.p1.name} vs ${state.p2.name}`; setTimeout(() => { try { hub.broadcastWhere(c => c.meta.authed, 'obs-highlight', { name: nm }); } catch {} }, 4000); }   // 1.12.16
      const snap = { at: Date.now(), start: setStartAt || 0, event: state.event || '', round: state.round || '', p1: { name: state.p1.name, char: state.p1.character || '' }, p2: { name: state.p2.name, char: state.p2.character || '' }, s1: Number(state.p1.score) || 0, s2: Number(state.p2.score) || 0, winner: winNow };
      const cb = SHOW ? SHOW.comebackOf(winNow) : 0; histT = setTimeout(() => { histT = null; if (winnerOf(state) !== winNow) return; const r = hist.add({ ...snap, cb, s1: Number(state.p1.score) || snap.s1, s2: Number(state.p2.score) || snap.s2 }); if (r) broadcast('state', liveState()); }, 10000);
    }
    if (!winNow && winWas && histT) { clearTimeout(histT); histT = null; }
  }

  // ------------------------------------------------------------ victory splash
  // Shown by itself a moment after a set ends (so the loser's plate gets to crack first), held for
  // Settings › victoryHold seconds ('0' = until you hide it), and hidden as soon as the set isn't won.
  function winnerOf(st) {
    if (!st || !st.p1 || !st.p2) return 0;
    const bo = String(st.bestOf || ''), firstTo = /^FT/i.test(bo) ? Number(bo.slice(2)) : Math.ceil((Number(bo) || 0) / 2);
    if (!firstTo) return 0;
    const a = Number(st.p1.score) >= firstTo, b = Number(st.p2.score) >= firstTo;
    return a && !b ? 1 : b && !a ? 2 : 0;
  }
  let victoryTimer = null, victoryHoldTimer = null;
  function showVictory(side) {
    setState({ victory: { show: true, side, n: ((state.victory && state.victory.n) || 0) + 1 } }, { undo: true });
  }
  function victoryWatch(winWas, winNow, wasOn, undo) {
    if (!winNow) { clearTimeout(victoryTimer); victoryTimer = null; }
    if (winNow && !winWas && !undo) apStart();       // 1.12.15: Run of show
    if (winNow && !winWas && !undo && config.settings.autoVictory !== false) {
      clearTimeout(victoryTimer);
      victoryTimer = setTimeout(() => {
        victoryTimer = null;
        const busy = (state.vs && state.vs.show) || (state.splash && state.splash.show) || (state.victory && state.victory.show);
        if (winnerOf(state) === winNow && !busy) showVictory(winNow);
      }, 2200);
    }
    const on = !!(state.victory && state.victory.show);
    if (on && !wasOn) {
      clearTimeout(victoryHoldTimer); victoryHoldTimer = null;
      const hold = Number(config.settings.victoryHold);
      if (hold > 0) victoryHoldTimer = setTimeout(() => { victoryHoldTimer = null; if (state.victory && state.victory.show) setState({ victory: { show: false } }, { undo: true }); }, hold * 1000);
    }
    if (!on && wasOn) { clearTimeout(victoryHoldTimer); victoryHoldTimer = null; }
  }

  // ------------------------------------------------------------ results back to start.gg
  // Settings › sggReport: 'off' | 'ask' (a button on the win card) | 'auto' (sent 10 s after the set is won, so a
  // mis-click can be fixed first). Sent from a small queue that retries when start.gg or the internet is down.
  config.sggReports = Array.isArray(config.sggReports) ? config.sggReports.slice(-30) : [];
  const reportMode = () => ['off', 'ask', 'auto'].includes(config.settings.sggReport) ? config.settings.sggReport : 'ask';
  function reportable(st = state) {
    const w = winnerOf(st);
    if (!w) return null;
    if (config.bracketSource === 'viewer' || !st.setId || /^preview/.test(String(st.setId)) || !sggHas()) return null;
    const W = st['p' + w], L = st['p' + (3 - w)];
    if (!W.sggId || !L.sggId) return null;
    return { setId: String(st.setId), winnerId: String(W.sggId), loserId: String(L.sggId), wScore: Number(W.score) || 0, lScore: Number(L.score) || 0,
      names: [W.name, L.name], round: st.round || '', key: `${st.setId}:${W.sggId}:${W.score}-${L.score}` };
  }
  let reportsVer = 0;
  const reportsOut = () => ({ v: ++reportsVer, mode: reportMode(), can: !!reportable(), on: config.bracketSource !== 'viewer' && sggHas(), list: config.sggReports.slice(-12).reverse().map(r => ({ setId: r.setId, names: r.names, round: r.round, score: r.isDQ ? 'DQ' : r.wScore === '' || r.wScore == null ? '' : `${r.wScore}–${r.lScore}`, status: r.status, error: r.error || '', at: r.at })) });
  function reportsChanged() { saveConfig(); try { hub.broadcastWhere(c => c.meta.authed, 'sgg-reports', reportsOut()); } catch {} }
  function enqueueReport(r, why = 'button') {
    const dup = config.sggReports.find(x => x.setId === r.setId && ['pending', 'sending', 'sent'].includes(x.status));
    if (dup && dup.key === r.key) return dup;                                  // already on its way (or done)
    if (dup && dup.status !== 'sent') dup.status = 'replaced';
    const item = { ...r, status: 'pending', tries: 0, error: '', at: Date.now(), why };
    if (dup && dup.status === 'sent') item.resetFirst = true;                  // a different result for a set already sent: reset, then report
    config.sggReports.push(item); config.sggReports = config.sggReports.slice(-30);
    reportsChanged(); setTimeout(reportWork, 10);
    return item;
  }
  let reportBusy = false, reportRetry = null;
  async function reportWork() {
    if (reportBusy) return; reportBusy = true; clearTimeout(reportRetry); reportRetry = null;
    try {
      for (const r of config.sggReports.filter(x => x.status === 'pending' || x.status === 'undoing')) {
        try {
          if (r.status === 'undoing') { await startgg.resetSet(sggTok(), r.setId); r.status = 'undone'; r.error = ''; }
          else {
            if (r.resetFirst) { await startgg.resetSet(sggTok(), r.setId); r.resetFirst = false; }
            await startgg.reportSet(sggTok(), r.setId, r); r.status = 'sent'; r.error = '';
            notify.send('result', `✅ **${r.names[0]}** beat ${r.names[1]}${r.isDQ ? ' (DQ)' : r.wScore === '' || r.wScore == null ? '' : ` ${r.wScore}–${r.lScore}`}${r.round ? ' · ' + r.round : ''}`);
          }
          r.at = Date.now(); reportsChanged();
          loadBracket(true).catch(() => {});
        } catch (e) {
          r.tries = (r.tries || 0) + 1; r.error = String((e && e.message) || e).slice(0, 200);
          const final = r.tries >= 5 || /admin|reporter|rejected|isn't a real|not have both|not in this set|already/i.test(r.error);
          if (final) r.status = r.status === 'undoing' ? 'sent' : 'failed';
          reportsChanged();
        }
      }
    } finally { reportBusy = false; }
    if (config.sggReports.some(x => x.status === 'pending' || x.status === 'undoing')) reportRetry = setTimeout(reportWork, Number(process.env.SGG_REPORT_RETRY) || 30000);
  }
  let reportTimer = null, reportCan = false;
  function reportWatch(winWas, winNow, undo) {
    if (!winNow) { clearTimeout(reportTimer); reportTimer = null; }
    const r = reportable();
    if (!!r !== reportCan) { reportCan = !!r; try { hub.broadcastWhere(c => c.meta.authed, 'sgg-reports', reportsOut()); } catch {} }
    if (!r || undo || reportMode() !== 'auto') return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => { reportTimer = null; const again = reportable(); if (again && again.key === r.key && reportMode() === 'auto') enqueueReport(again, 'auto'); }, Number(process.env.SGG_REPORT_WAIT) || 10000);
  }
  setTimeout(() => { if (config.sggReports.some(x => x.status === 'pending' || x.status === 'undoing')) reportWork(); }, 4000);

  // what one Undo key takes back: the format's last result when that was the latest change, else the last edit
  /** a team format (Crew Battle, Team Battle, Gauntlet, Team Death Battle) is live */
  function teamFmtLive() { try { const v = state.format && state.format.status === 'live' && FMT.view(state.format); return !!(v && (v.kind === 'teams' || (v.kind === 'elim' && v.preset !== 'koth'))); } catch { return false; } }   // 1.12.6: Death Battle has the Player VS too
  function undoKind() {
    const f = formatUndo.length && state.format ? formatUndoAt[formatUndoAt.length - 1] || 0 : 0, h = history.length ? history[history.length - 1].at : 0;
    return f && f >= h - 400 ? 'format' : h ? 'state' : '';
  }
  function undoOnce() {
    const cur = JSON.stringify({ ...state, updatedAt: 0 });
    while (history.length && history[history.length - 1].snap === cur) history.pop();
    const prev = history.pop();
    if (!prev) return false;
    const restored = JSON.parse(prev.snap); restored.vs = state.vs; restored.splash = state.splash; restored.victory = state.victory;   // undo never toggles a splash
    setState(restored, { replace: true, undo: true });
    return true;
  }

  // ------------------------------------------------------------ bracket / Top 8 splash
  // The whole pool from start.gg, rebuilt into columns by lib/bracket.js. Refreshed every 20 s while a
  // splash is showing (results come in), and whenever it's opened.
  const bracket = { model: null, groups: [], loading: null, error: '', at: 0, timer: null };
  async function loadBracket(force) {
    if (config.bracketSource === 'viewer') { vtModel(); publishBracket(); return bracket.model; }
    const s = config.startgg || {};
    if (!sggHas() || !s.eventId) { bracket.error = 'Load a start.gg tournament in the Bracket tab first.'; bracket.model = null; publishBracket(); return null; }
    if (bracket.loading) return bracket.loading;
    if (!force && bracket.model && Date.now() - bracket.at < 8000) return bracket.model;
    bracket.loading = (async () => {
      // the stream queue (for UP NEXT) loads alongside the bracket instead of after it
      const queue = s.tournament && s.tournament.slug ? startgg.loadStreamQueue(sggTok(), s.tournament.slug).catch(() => []) : Promise.resolve([]);
      try {
        const info = await startgg.loadBracketInfo(sggTok(), s.eventId);
        bracket.groups = info.groups;
        const want = config.bracketGroup && info.groups.find(g => g.id === config.bracketGroup);
        const byOrder = info.groups.slice().sort((a, b) => b.order - a.order);
        const g = want || byOrder.find(x => x.state === 2) || byOrder.find(x => x.state === 3) || info.groups[0];
        if (!g) throw new Error('This event has no bracket yet.');
        const raw = await startgg.loadGroupSets(sggTok(), g.id);
        const avatars = {};
        for (const p of allPlayers()) if (p.sggId && p.avatar) avatars[String(p.sggId)] = p.avatar;
        for (const k of ['p1', 'p2']) if (state[k].sggId && state[k].avatar) avatars[String(state[k].sggId)] = state[k].avatar;
        let next = '';
        { const q = await queue; const n = (q || []).find(x => x.state !== 3 && String(x.id) !== String(state.setId || '')); next = n ? String(n.id) : ''; }
        const samePhase = info.groups.filter(x => x.phase === g.phase).length;
        bracket.model = bracketModel.build(raw, { avatars, next, event: info.event, tournament: info.tournament || (s.tournament && s.tournament.name) || '',
          game: info.game, phase: g.phase, pools: samePhase });
        bracket.model.groupId = g.id;
        bracket.error = ''; bracket.at = Date.now();
      } catch (err) { bracket.error = err.message || String(err); }
      finally { bracket.loading = null; publishBracket(); }
      return bracket.model;
    })();
    return bracket.loading;
  }
  // A different event: forget the old bracket (and the pool picked for it), fetch the new one straight
  // away, then give every open overlay (OBS, browser tabs, online links) a fresh page load so nothing
  // from the old bracket can linger in a browser cache. The overlay host swaps it in seamlessly.
  function resetBracket() {
    if (shares.sgg.key() && shares.sgg.key() !== 'sgg:' + ((config.startgg || {}).eventId || '')) shares.sgg.purge('another event was loaded');
    bracket.model = null; bracket.groups = []; bracket.error = ''; bracket.at = 0; config.bracketGroup = ''; saveConfig();
    if (state.splash && state.splash.side !== 'W') state.splash.side = 'W';
    publishBracket();
    const s = config.startgg || {};
    if (!sggHas() || !s.eventId) { refreshOverlays(); return; }
    loadBracket(true).catch(() => {}).then(() => refreshOverlays());
  }
  function bracketStatus() {
    const m = bracket.model;
    return { ready: !!m, error: bracket.error, at: bracket.at, groups: bracket.groups, group: config.bracketGroup || 'auto',
      entrants: m ? m.entrants : 0, type: m ? m.type : '', paged: m ? m.paged : false, top8: !!(m && m.top8 && m.top8.reached),
      phase: m ? m.phase : '', pool: m ? m.pool : '', dropped: m ? m.dropped : 0, autoTop8: config.settings.autoTop8 !== false,
      refreshEvery: String(config.settings.bracketRefresh ?? '20'), pageEvery: String(config.settings.bracketPage ?? '14'),
      side: (state.splash && state.splash.side) || 'W', loading: !!bracket.loading, finished: !!(m && m.finished), standings: m ? (m.standings || []).length : 0 };
  }
  // the bracket title belongs to the tournament it was typed for (a new event starts with its own name again)
  const titleKey = () => { const t = shareTarget(); return t ? t.key : config.bracketSource === 'viewer' ? 'vt' : 'sgg:' + ((config.startgg || {}).eventId || ''); };
  const bracketTitle = () => { const m = config.bracketTitles || {}, k = titleKey(); return k in m ? m[k] : config.settings.bracketTitle || ''; };
  const bracketPayload = () => bracket.model ? { ...bracket.model, autoTop8: config.settings.autoTop8 !== false, pageEvery: Number(config.settings.bracketPage) || 0, title: String(bracketTitle() || bracket.model.vtName || '').slice(0, 40), pics: config.settings.bracketPics === 'character' ? 'character' : 'avatar' } : null;   // a viewer tournament's own name is its title
  // ------------------------------------------------------------ viewer tournaments (lib/vtourney.js)
  const VT_FILE = path.join(DATA_DIR, 'vtourney.json');
  let vt = (() => { const d = readJSON(VT_FILE, null); return d && d.v ? VT.normalize(d) : null; })();
  const vtUndo = [];
  function vtModel() {                  // the bracket splash draws the viewer tournament while it's the bracket source
    if (!vt || vt.status === 'signup') { bracket.model = null; bracket.error = vt ? 'Signups are still open — generate the bracket first.' : 'Set up a viewer tournament first.'; return; }
    const v = VT.view(vt);
    bracket.model = bracketModel.build(VT.toRaw(vt), { event: v.round, tournament: '', game: state.game || '', phase: '' });
    bracket.model.vtName = vt.name;
    bracket.model.grid = v.grid; bracket.model.viewer = true; bracket.model.left = v.alive; bracket.model.entrants = vt.entrants.length;
    // placements straight from the tournament (they include rounds no longer drawn on the splash)
    bracket.model.standings = [...VT.placements(vt)].map(([id, place]) => { const e = vt.entrants.find(x => x.id === id) || {}; return { id, place, name: e.name || '', team: '', seed: e.seed || '', avatar: e.avatar || '' }; }).filter(x => x.name).sort((a, b) => a.place - b.place || a.seed - b.seed);
    bracket.model.finished = vt.status === 'done';
    bracket.error = ''; bracket.at = Date.now();
  }
  // what happened since last time → Discord (and chat for station calls)
  let vtSeenSeq = vt ? vt.seq : 0, vtSeenId = vt ? vt.id : ''; const vtCalled = new Set(vt ? vt.sets.filter(x => x.station).map(x => x.id + ':' + x.station) : []);
  function vtAnnounce() {
    if (!vt) { vtSeenSeq = 0; vtSeenId = ''; vtCalled.clear(); return; }
    if (vt.id !== vtSeenId) { vtSeenId = vt.id; vtSeenSeq = 0; vtCalled.clear(); }        // a new tournament: its own events from the start
    else if (vt.seq < vtSeenSeq) vtSeenSeq = vt.seq;                                     // ↶ Undo went back: don't repeat, but catch what comes next
    const nm = id => (vt.entrants.find(e => e.id === id) || {}).name || '?', tag = id => { const e = vt.entrants.find(x => x.id === id); return e ? (e.login ? '@' + e.login : e.name) : '?'; };
    if (vt.seq !== vtSeenSeq) {
      const from = vtSeenSeq; vtSeenSeq = vt.seq;
      for (const ev of (vt.feed || []).filter(e => e.seq > from)) {
        if (ev.type === 'start') notify.send('started', `🏆 **${vt.name}** has started — ${vt.entrants.length} players${VT.view(vt).kind ? ' · ' + VT.view(vt).kind.toLowerCase() : ''}.`);
        if (ev.type === 'result' || ev.type === 'forfeit') { const st = vt.sets.find(x => x.id === ev.set) || {}; notify.send('result', `✅ **${ev.winner}** beat ${ev.loser}${ev.type === 'forfeit' ? ' (forfeit)' : st.sa != null ? ` ${Math.max(st.sa, st.sb)}–${Math.min(st.sa, st.sb)}` : ''} · ${VT.setName(vt, st)}`); }
        if (ev.type === 'done') notify.send('champion', `🏆 **${ev.champion}** wins ${vt.name}!`);
      }
    }
    // matches called to a station
    const calls = [];
    for (const x of vt.sets) if (x.station && !x.w && x.a && x.b && x.a !== 'bye' && x.b !== 'bye') { const k = x.id + ':' + x.station; if (!vtCalled.has(k)) { vtCalled.add(k); calls.push(x); } }
    for (const x of calls) {
      notify.send('station', `📍 **${nm(x.a)}** vs **${nm(x.b)}** → Station ${x.station} (${VT.setName(vt, x)})`);
      if (chatCanSay() && vm.prefs.replies && config.settings.vtHeadsUp !== false) chat.say(`📍 ${tag(x.a)} vs ${tag(x.b)} — head to Station ${x.station} (${VT.setName(vt, x)})`);
    }
  }
  function vtSave() {
    try { vtAnnounce(); } catch {}
    try { writeJSON(VT_FILE, vt || {}); } catch {}
    if (config.bracketSource === 'viewer') { vtModel(); publishBracket(); }
    hub.broadcastWhere(c => c.meta.authed, 'vt', vt ? VT.view(vt) : null);
    hub.broadcast('vtpub', vtPublic());
  }
  /** what the viewer-tournament sidebar (an OBS browser source) may show: names only, nothing private */
  function vtPublic() {
    if (!vt) return null;
    const v = VT.view(vt), rec = vt.entrants.slice().sort((a, b) => b.at - a.at);
    return { name: v.name, status: v.status, open: v.open, count: v.count, max: v.max, ft: v.ft, type: vt.type, alive: v.alive, round: v.round, champion: v.champion, seq: v.seq,
      cmd: vm.data && vm.data.open ? ['!enter'] : ['!enter', '!join'],
      entrants: rec.slice(0, 60).map(e => ({ name: e.name, at: e.at })),
      now: v.now ? { a: v.now.a, b: v.now.b, round: v.now.round, ...nowScores(v.now) } : null, next: v.next.slice(0, 4).map(n => ({ a: n.a, b: n.b, round: n.round })),
      results: (v.sets || []).filter(x => x.w && x.a && x.b && x.a !== 'BYE' && x.b !== 'BYE').sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 8).map(x => ({ a: x.a, b: x.b, w: x.w, sa: x.sa, sb: x.sb, ff: x.ff || '', round: x.round })),
      look: activeLook(), played: v.played, total: v.total };
  }
  // the score of the tournament match on the scoreboard (for the sidebar)
  function nowScores(n) {
    const p1 = state.p1 || {}, p2 = state.p2 || {};
    if (p1.name === n.a && p2.name === n.b) return { sa: Number(p1.score) || 0, sb: Number(p2.score) || 0 };
    if (p1.name === n.b && p2.name === n.a) return { sa: Number(p2.score) || 0, sb: Number(p1.score) || 0 };
    return {};
  }
  // which look the live layout has (el-theme / sb-look in its page): the join splash and the sidebar dress in it
  const lookCache = new Map();
  function activeLook() {
    try {
      const name = config.activeOverlay, vr = variantOf(name), dir = overlayDir(vr ? vr.base : name), f = path.join(dir, 'index.html');
      const st = fs.statSync(f), k = f + ':' + st.mtimeMs; if (lookCache.has(k)) return lookCache.get(k);
      const html = fs.readFileSync(f, 'utf8').slice(0, 6000);
      const m = /<meta[^>]+name=["']el-theme["'][^>]*content=["']([\w-]+)/i.exec(html) || /<meta[^>]+name=["']sb-look["'][^>]*content=["']([\w-]+)/i.exec(html);
      const raw = m ? m[1].toLowerCase() : '', id = raw === 'shattered' ? 'obsidian' : raw;   // 1.12.4: Shattered is Obsidian Glass (its own skin); Porcelain has one too
      lookCache.set(k, id); return id;
    } catch { return ''; }
  }
  let vtScoreKey = '';
  const vtSnap = () => { vtUndo.push(JSON.stringify(vt)); if (vtUndo.length > 40) vtUndo.shift(); };
  /** chat: !enter always, and !join / !leave while the viewer-match queue is closed */
  const ciBatch = [];
  const chatCanSay = () => !!(chat.auth && chat.state === 'live') && !(SHOW && (SHOW.rehearsing || SHOW.standby));     // signed in to Twitch and connected: replies work
  function vtChat(m) {
    const w = String(m.text || '').trim().toLowerCase().split(/\s+/)[0];
    if (vt && vt.status === 'signup' && vt.checkin && vt.checkin.open && (w === '!here' || w === '!checkin')) {
      const r = VT.checkIn(vt, m.login || m.display);
      if (r.ok) { vtSave(); twNote('join', `${m.display} checked in to ${vt.name} (${r.n})`); }
      if (vm.prefs.replies && r.code === 'missing') chat.say(`@${m.display} you're not signed up for ${vt.name}.`);
      if (vm.prefs.replies && r.ok) {                 // one message for everyone who checked in within a few seconds
        ciBatch.push('@' + m.display);
        if (!ciBatch.t) ciBatch.t = setTimeout(() => { const names = ciBatch.splice(0); ciBatch.t = 0; const v = vt && VT.view(vt); if (v && v.checkin) chat.say(`✅ Checked in: ${names.join(' ')} — ${v.checkin.here} of ${v.checkin.of} here`); }, 4000);
      }
      twPush(); return true;
    }
    if (!vt || vt.status !== 'signup' || !vt.open) return false;
    const qOpen = !!(vm.data && vm.data.open);
    const joinCmd = w === '!enter' || (w === '!join' && !qOpen), leaveCmd = w === '!withdraw' || (w === '!leave' && !qOpen);
    if (!joinCmd && !leaveCmd) return false;
    vtSnap();
    const r = joinCmd ? VT.join(vt, { name: m.display, login: m.login }) : VT.leave(vt, m.login);
    if (r.ok) { vtSave(); twNote('join', `${m.display} ${joinCmd ? `entered ${vt.name} (#${r.n})` : `left ${vt.name}`}`); }
    const say = joinCmd ? (r.ok ? `@${m.display} you're in ${vt.name}! (${r.n} signed up)` : r.code === 'already' ? `@${m.display} you're already in.` : r.code === 'full' ? `@${m.display} sorry, ${vt.name} is full.` : '') : (r.ok ? `@${m.display} you left ${vt.name}.` : '');
    if (say && vm.prefs.replies) chat.say(say);
    twPush();
    return true;
  }
  // ---- chat: !bracket (the live bracket link) and !next / !where (where a viewer stands)
  const chatCool = new Map(); let chatCoolAll = 0;
  const coolOk = login => { const now = Date.now(); if (now - chatCoolAll < 3000 || now - (chatCool.get(login) || 0) < 15000) return false; chatCoolAll = now; chatCool.set(login, now); if (chatCool.size > 500) chatCool.clear(); return true; };
  function bracketChat(m) {
    const words = String(m.text || '').trim().split(/\s+/), w = (words[0] || '').toLowerCase();
    if (!['!bracket', '!next', '!where'].includes(w)) return false;
    if (!bracket.model || !chatCanSay() || !vm.prefs.replies || !coolOk(m.login)) return true;
    if (w === '!bracket') {
      const st = shareStatus();
      if (st.on && st.current && st.online) chat.say(`📋 ${st.target || 'Bracket'} — live bracket: ${st.link}`);
      return true;
    }
    const who = words[1] || m.display, r = standingOf(watchCacheBy[curSlot()] || watchData(), who);
    if (!r) return true;
    chat.say(r.none ? `@${m.display} I can't find "${String(who).slice(0, 25)}" in the bracket.` : `@${m.display} ${r.text}`);
    return true;
  }
  function vtNames() { const s = vt && vt.now && vt.sets.find(x => x.id === vt.now); if (!s) return null; const n = id => (vt.entrants.find(e => e.id === id) || {}).name || ''; return { s, a: n(s.a), b: n(s.b) }; }
  function vtLoad(setId) {              // a match onto the scoreboard
    if (!setId) throw new Error('No match is ready to play.');
    VT.setNow(vt, setId);
    const c = vtNames(), v = VT.view(vt);
    setState({ p1: { ...blankPlayer(), name: c.a }, p2: { ...blankPlayer(), name: c.b }, round: `${vt.name} — ${v.now ? v.now.round : ''}`, bestOf: `FT${vt.ft}`, setId: '', victory: { show: false } });
    // chat heads-up: who's on now, and who's up next
    if (chatCanSay() && vm.prefs.replies && config.settings.vtHeadsUp !== false) {
      const tag = id => { const e = vt.entrants.find(x => x.id === id); return e ? (e.login ? '@' + e.login : e.name) : ''; };
      const nx = VT.ready(vt).find(x => x.id !== setId);
      chat.say(`🎮 On stream now: ${tag(c.s.a)} vs ${tag(c.s.b)} (${v.now ? v.now.round : vt.name})${nx ? ` · up next: ${tag(nx.a)} vs ${tag(nx.b)} — get ready!` : ''}`);
    }
    notify.send('onstream', `🎮 On stream now: **${c.a}** vs **${c.b}** (${v.now ? v.now.round : vt.name})`);
  }
  function vtAction(b = {}) {
    const need = () => { if (!vt) throw new Error('Set up a viewer tournament first.'); return vt; };
    if (['create', 'generate', 'reset', 'start'].includes(b.do) || (b.do === 'open' && b.open !== false && b.open !== 'false')) oneEvent('vt');
    switch (b.do) {
      case 'create': vtSnap(); vt = VT.create({ name: b.name, ft: b.ft, max: b.max, seeding: b.seeding, type: b.type, pools: b.pools, swissRounds: b.swissRounds, cut: b.cut, stations: b.stations }); vt.open = b.open !== false; break;
      case 'update': { need(); vtSnap(); for (const k of ['name', 'ft', 'max', 'seeding']) if (k in b) vt[k] = b[k]; if ('type' in b && vt.status === 'signup') vt.type = b.type; vt = VT.normalize(vt); break; }
      case 'checkin': {                 // check-in: players confirm they're here with !here
        need(); vtSnap(); VT.setCheckin(vt, b.open !== false && b.open !== 'false');
        if (vt.checkin && vt.checkin.open && b.announce !== false && chatCanSay()) chat.say(`✅ ${vt.name} check-in is open — signed up? Type !here to keep your spot. Anyone who hasn't checked in is left out of the bracket.`);
        break;
      }
      case 'here': { need(); vtSnap(); const r = VT.checkIn(vt, b.id, b.here !== false); if (!r.ok && r.code !== 'already') throw new Error(r.code === 'nocheckin' ? 'Check-in isn’t running.' : r.code === 'closed' ? 'Check-in is closed.' : 'Not signed up.'); break; }
      case 'reseed': need(); vtSnap(); VT.reseed(vt, b.shuffle ? 'shuffle' : b.order); break;
      case 'dq': { need(); vtSnap(); const nowSet = vt.now; VT.dq(vt, b.id); if (nowSet && !vt.now) { const r = VT.ready(vt)[0]; if (r && b.load !== false) vtLoad(r.id); else if (vt.status === 'done') setState({ round: `${vt.name} — Champion: ${VT.view(vt).champion}` }); } break; }
      case 'forfeit': {                 // the match on the scoreboard: one side didn't (or can't) play
        need(); const c = vtNames(); if (!c) throw new Error('No match is loaded.');
        const loser = b.side === 'b' || b.side === 2 ? 'b' : 'a';
        vtSnap(); VT.report(vt, c.s.id, loser === 'a' ? 'b' : 'a', null, null, { ff: true });
        const r = VT.ready(vt)[0];
        if (r && b.load !== false) vtLoad(r.id); else if (vt.status === 'done') setState({ round: `${vt.name} — Champion: ${VT.view(vt).champion}` });
        break;
      }
      case 'open': {
        need(); if (vt.status !== 'signup') throw new Error('The bracket has already started.');
        vt.open = b.open === undefined || b.open === 'toggle' ? !vt.open : !!b.open && b.open !== 'false'; vt.seq++;
        if (vt.open && b.announce !== false && chatCanSay()) chat.say(`${vt.name} signups are open — type !enter${vm.data && vm.data.open ? '' : ' or !join'} to play!`);
        break;
      }
      case 'add': { need(); vtSnap(); const r = VT.join(vt, { name: b.name, login: b.login }, { force: true }); if (!r.ok) throw new Error(r.code === 'already' ? 'Already signed up.' : r.code === 'started' ? 'The bracket has started.' : 'Give a name.'); break; }
      case 'remove': { need(); vtSnap(); const r = VT.leave(vt, b.id); if (!r.ok) throw new Error(r.code === 'started' ? 'The bracket has started.' : 'Not signed up.'); break; }
      case 'clear': need(); vtSnap(); vt.entrants = []; vt.seq++; break;
      case 'start':                     // close sign-ups and draw the bracket in the order of the list (seed 1 at the top)
        need(); if (vt.status !== 'signup') throw new Error('The bracket has already started.'); vt.open = false; vt.seq++;
        if (state.splash && state.splash.show === 'vtjoin') setState({ splash: { show: '' } });      // the join splash makes way
      // falls through
      case 'generate': {
        need(); vtSnap(); VT.generate(vt);
        if (b.source !== false) { config.bracketSource = 'viewer'; saveConfig(); }
        shares.vt.begin('vt:' + vt.id, vt.name); if (b.share !== false) try { shares.vt.setLive(true); } catch {}     // viewers get the live bracket link straight away
        const r = VT.ready(vt)[0]; if (r && b.load !== false) vtLoad(r.id);
        break;
      }
      case 'load': need(); vtLoad(b.set || (VT.ready(vt)[0] || {}).id); break;
      case 'report': {                 // the bracket dashboard: a result for any match that's ready (played off stream, or the one on stream)
        need(); const set = vt.sets.find(x => x.id === b.set); if (!set) throw new Error('No such match.');
        const noScore = b.sa == null && b.sb == null;          // one click on the winner's name: no score
        const sa = noScore ? null : Math.max(0, Math.min(99, Number(b.sa) || 0)), sb = noScore ? null : Math.max(0, Math.min(99, Number(b.sb) || 0));
        const w = b.winner === 'a' || b.winner === 'b' ? b.winner : sa > sb ? 'a' : sb > sa ? 'b' : '';
        if (!w) throw new Error('Pick a winner — the scores are level.');
        const wasNow = vt.now === set.id;
        vtSnap(); VT.report(vt, set.id, w, sa, sb);
        if (wasNow) { const r = VT.ready(vt)[0]; if (r && b.load !== false) vtLoad(r.id); else if (vt.status === 'done') setState({ round: `${vt.name} — Champion: ${VT.view(vt).champion}` }); }
        break;
      }
      case 'confirm': {                // the match on the scoreboard is over: record it and load the next one
        need(); const c = vtNames(); if (!c) throw new Error('No match is loaded — press Next match.');
        const w = b.winner || (() => { const ws = winnerOf(state); if (!ws) return ''; const nm = state['p' + ws].name; return nm === c.a ? 'a' : nm === c.b ? 'b' : ''; })();
        if (!w) throw new Error('Nobody has won this match yet.');
        const sc = k => Number(state[k].score) || 0, aIsP1 = state.p1.name === c.a;
        vtSnap(); VT.report(vt, c.s.id, w, aIsP1 ? sc('p1') : sc('p2'), aIsP1 ? sc('p2') : sc('p1'));
        const r = VT.ready(vt)[0];
        if (r && b.load !== false) vtLoad(r.id);
        else if (vt.status === 'done') setState({ round: `${vt.name} — Champion: ${VT.view(vt).champion}` });
        break;
      }
      case 'undo': if (!vtUndo.length) throw new Error('Nothing to undo.'); vt = JSON.parse(vtUndo.pop()); if (vt) vt = VT.normalize(vt); break;
      case 'reset': {
        need(); vtSnap(); if (shares.vt.key() === 'vt:' + vt.id) shares.vt.purge('tournament restarted'); const keep = vt.entrants.map(e => ({ name: e.name, login: e.login }));
        vt = VT.create({ name: vt.name, ft: vt.ft, max: vt.max, seeding: vt.seeding, type: vt.type, pools: vt.pools, swissRounds: vt.swissRounds, cut: vt.cut, stations: vt.stations }); keep.forEach(e => VT.join(vt, e, { force: true }));
        break;
      }
      case 'delete': if (vt && shares.vt.key() === 'vt:' + vt.id) shares.vt.purge('tournament deleted'); vtSnap(); vt = null; if (config.bracketSource === 'viewer') { config.bracketSource = 'startgg'; saveConfig(); } bracket.model = null; loadBracket(true).catch(() => {}); break;
      case 'source':
        config.bracketSource = b.source === 'viewer' ? 'viewer' : 'startgg'; saveConfig();
        if (config.bracketSource === 'viewer') vtModel(); else { bracket.model = null; loadBracket(true).catch(() => {}); }
        publishBracket(); break;
      default: throw new Error('Unknown action.');
    }
    vtSave();
    return vt ? VT.view(vt) : null;
  }
  if (config.bracketSource === 'viewer') vtModel();
  let lastBracketSent = '', lastShareSent = '';
  function publishBracket() {
    shareTick();
    // overlays only need the Top 8 of the standings, and nothing at all when the bracket hasn't changed
    const pl = bracketPayload(), out = pl ? { ...pl, standings: (pl.standings || []).slice(0, 8) } : null;
    const key = out ? JSON.stringify({ ...out, updatedAt: 0 }) : 'null';
    if (key !== lastBracketSent) { lastBracketSent = key; hub.broadcast('bracket', out); }
    const ss = JSON.stringify(shareStatus()); if (ss !== lastShareSent) { lastShareSent = ss; hub.broadcastWhere(c => c.meta.authed, 'share', JSON.parse(ss)); }
    hub.broadcastWhere(c => c.meta.authed, 'bracket-status', bracketStatus());
    if (potatoRender()) opts.onPotatoDirty();
    if (!pageTimer) pageClock();         // the bracket may just have grown past one screen
  }

  // ------------------------------------------------------------ pictures, standings, the live bracket page and exports
  const charSlug = x => String(x || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  /** every player on the splash gets their character (from the player list / the scoreboard) for "Character art" */
  function enrichModel(m) {
    if (!m) return;
    const byId = new Map(), byName = new Map();
    for (const p of [...allPlayers(), state.p1, state.p2]) {
      if (!p || !p.character) continue;
      if (p.sggId) byId.set(String(p.sggId), p.character);
      if (p.name) byName.set(String(p.name).toLowerCase(), p.character);
    }
    const fix = p => { if (!p || !p.name) return; const c = (p.id && byId.get(String(p.id))) || byName.get(String(p.name).toLowerCase()) || p.character || ''; p.character = c; p.charSlug = charSlug(c); };
    const sets = [...(m.winners || []).flatMap(c => c.sets), ...(m.losers || []).flatMap(c => c.sets), ...(m.gf || [])];
    if (m.top8) for (const k of Object.keys(m.top8)) if (Array.isArray(m.top8[k])) sets.push(...m.top8[k]);
    if (m.grid && m.grid.sets) { /* grid cards carry names only */ }
    for (const s of sets) { fix(s.a); fix(s.b); }
    for (const p of m.standings || []) fix(p);
  }
  // start.gg's own final standings (they cover every phase, not just the pool on screen): fetched once per event
  const sggStand = { eventId: '', list: null, busy: false };
  function sggStandings(m) {
    const ev = String((config.startgg || {}).eventId || '');
    if (!ev || !m || m.viewer || !m.finished) return;
    if (sggStand.eventId === ev && sggStand.list) {
      if (sggStand.list.length) {
        const av = new Map((m.standings || []).map(p => [String(p.id), p.avatar]));
        m.standings = sggStand.list.map(p => ({ ...p, avatar: p.avatar || av.get(p.id) || '' }));
      }
      return;
    }
    if (sggStand.busy || !sggHas()) return;
    sggStand.busy = true;
    startgg.loadStandings(sggTok(), ev).then(r => { sggStand.eventId = ev; sggStand.list = (r && r.list) || []; })
      .catch(() => { sggStand.eventId = ev; sggStand.list = []; })
      .finally(() => { sggStand.busy = false; if (bracket.model && bracket.model.finished) publishBracket(); });
  }
  // one share for the start.gg event and one for the viewer tournament, so switching between them keeps both
  if (config.share && config.share.key) config.share = { [String(config.share.key).startsWith('vt:') ? 'vt' : 'sgg']: config.share };   // older single share
  if (!config.share || typeof config.share !== 'object') config.share = {};
  const mkShare = slot => createShare({ root: path.join(DATA_DIR, 'exports'), log: m => console.log(m), onClosed: () => watchCloseAll(slot),
    store: { get: () => config.share[slot] || {}, set: v => { config.share[slot] = v; saveConfig(); } }, others: () => [shares[slot === 'vt' ? 'sgg' : 'vt'].folderName()] });
  const shares = {}; shares.vt = mkShare('vt'); shares.sgg = mkShare('sgg');
  const curSlot = () => config.bracketSource === 'viewer' ? 'vt' : 'sgg';
  const share = new Proxy({}, { get: (_, k) => shares[curSlot()][k] });         // the current bracket's share
  try { shares.vt.sweep(); shares.sgg.sweep(); } catch (e) { console.error('exports sweep:', e.message); }
  // short links (/s/<code>) for pages anyone may see: overlays, the live bracket page, the sidebars (lib/shortlinks.js)
  const shorts = createShortLinks({ store: { get: () => config.shortLinks || {}, set: m => { config.shortLinks = m; saveConfig(); } },
    alive: to => { const w = /^\/watch\/([\w-]+)$/.exec(to); return !w || ['vt', 'sgg'].some(k => shares[k].check(w[1])); } });
  let publicShort = null;                                                    // is.gd links made this session (they die with the online address)
  const shortPath = target => { const c = shorts.codeFor(target); return c ? '/s/' + c : ''; };
  /** which tournament is on the bracket right now (its files are kept apart from any other) */
  function shareTarget() {
    if (config.bracketSource === 'viewer') return vt && vt.status !== 'signup' ? { key: 'vt:' + vt.id, name: vt.name } : null;
    const s = config.startgg || {};
    if (!s.eventId || !bracket.model) return null;
    const t = (s.tournament && s.tournament.name) || bracket.model.tournament || '', e = bracket.model.event || '';
    return { key: 'sgg:' + s.eventId, name: [t, e && e !== t && (s.tournament && (s.tournament.events || []).length > 1) ? e : ''].filter(Boolean).join(' — ') || 'Tournament' };
  }
  const watchCacheBy = { vt: null, sgg: null };
  // the other pools of the same phase, for the live bracket page (loaded slowly in the background while it's shared)
  const sggPools = { key: '', at: 0, busy: false, list: [] };
  function loadOtherPools() {
    const m = bracket.model; if (!m || m.viewer || !m.groupId || sggPools.busy) return;
    const cur = (bracket.groups || []).find(g => g.id === m.groupId); if (!cur) return;
    const others = (bracket.groups || []).filter(g => g.phase === cur.phase && g.id !== cur.id).slice(0, 31);
    const key = cur.phase + ':' + (config.startgg || {}).eventId;
    if (!others.length) { sggPools.list = []; return; }
    if (sggPools.key === key && Date.now() - sggPools.at < 120000) return;
    sggPools.busy = true;
    (async () => {
      const list = [];
      for (const g of others) { try { const raw = await startgg.loadGroupSets(sggTok(), g.id); list.push({ id: g.id, pool: g.pool || raw.pool || '', model: bracketModel.build(raw, { event: m.event, tournament: m.tournament, phase: g.phase }) }); } catch {} }
      sggPools.list = list; sggPools.key = key; sggPools.at = Date.now();
    })().finally(() => { sggPools.busy = false; shareTick(); });
  }
  let shareHtmlT = null, standingsDone = '';
  function shareTick() {
    const m = bracket.model;
    if (m) { sggStandings(m); enrichModel(m); }
    // 1.12.6: a bracket that has just finished (viewer tournament or start.gg): offer the Top 8 results picture (the panel asks)
    if (m && m.finished && (m.standings || []).length) {
      const k = (m.viewer ? 'vt:' : 'sgg:') + (m.vtName || m.tournament || m.event || '');
      if (!top8Last || top8Last.key !== k) {
        const first = top8Last === null && !top8Armed; top8Last = { key: k, name: m.vtName || m.tournament || m.event || '', at: Date.now() };
        if (!first) setTimeout(() => hub.broadcastWhere(c => c.meta.authed, 'top8-ready', top8Last), m.viewer ? 11000 : 3000);
      }
    }
    top8Armed = true;
    const tg = shareTarget();
    if (!tg || tg.key !== share.key()) return;           // the share belongs to another tournament (or none yet)
    if (share.status().name !== tg.name) share.rename(tg.name);
    if (curSlot() === 'sgg' && share.status().on) loadOtherPools();
    watchCacheBy[curSlot()] = watchData(); watchPush(curSlot());
    if (m && m.finished) {
      share.ended();
      if (standingsDone !== tg.key) { standingsDone = tg.key; onFinished(tg); }
    } else if (m) share.reopened();
    clearTimeout(shareHtmlT); shareHtmlT = setTimeout(writeShareHtml, 1200);
  }
  // the tournament just finished: Top 8 standings on stream (after the victory screen) and saved as pictures
  function onFinished(tg) {
    if (config.settings.autoStandings === false) return;
    const isVt = tg.key.startsWith('vt:');
    setTimeout(() => {
      if (share.key() !== tg.key || !bracket.model || !bracket.model.finished) return;
      const sp = (state.splash && state.splash.show) || '';
      if (isVt ? !['fvs', 'fboard', 'fwin'].includes(sp) : ['bracket', 'top8'].includes(sp)) setState({ victory: { show: false }, splash: { show: 'standings', side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } }, { undo: true });
      if (opts.capture) saveStandingsImages('both').then(f => console.log('Saved', f.join(', '))).catch(e => console.error('standings picture:', e.message));
    }, isVt ? 9500 : 1500);
  }
  // a camera link works best online (https — browsers only allow the camera on a secure page); on this PC, localhost works too
  function camBase() { if (tunnel.status.state === 'online' && tunnel.status.url) return tunnel.status.url.replace(/\/$/, ''); return `http://localhost:${actualPort}`; }
  const camUrl = t => `${camBase()}/cam/${t}`;
  function liveBase() {
    if (tunnel.status.state === 'online' && tunnel.status.url) return tunnel.status.url.replace(/\/$/, '');
    const l = lanUrls(); return l[1] || l[0];
  }
  function watchData() {
    const m = bracketPayload(); if (!m) return null;
    const viewer = !!m.viewer, liveId = viewer ? (vt && vt.now) : state.setId;
    const sc = side => { for (const k of ['p1', 'p2']) { const p = state[k] || {}; if ((p.sggId && String(p.sggId) === String(side.id)) || (p.name && side.name && p.name.toLowerCase() === side.name.toLowerCase())) return Number(p.score) || 0; } return side.score; };
    let now = null;
    const conv = (s, round) => {
      const live = liveId && String(liveId) === String(s.id) && !s.done;
      if (live) now = { a: s.a.name, b: s.b.name, round };
      const pl = p => ({ n: p.name || '', s: live ? sc(p) : (s.done || s.state === 'playing') ? p.score : null, w: !!p.win, l: !!p.lose });
      return { st: live ? 'live' : (m.next && String(m.next) === String(s.id) && !s.done) ? 'next' : s.done ? 'done' : 'wait', a: pl(s.a), b: pl(s.b), ...(s.station && !live && !s.done ? { stn: s.station } : {}) };
    };
    const col = c => ({ name: c.name, sets: c.sets.map(s => conv(s, c.name)) });
    const sections = m.grid ? [] : [{ name: m.type === 'DE' ? 'Winners' : 'Bracket', cols: (m.winners || []).map(col) }, { name: 'Losers', cols: (m.losers || []).map(col) },
      { name: 'Grand Final', cols: (m.gf || []).length ? [{ name: 'Grand Final', sets: m.gf.map(s => conv(s, 'Grand Final')) }] : [] }];
    const grid = m.grid ? { round: m.grid.round, sets: m.grid.sets.map(c => { const live = c.now && !c.w; if (live) now = { a: c.a, b: c.b, round: c.round };
      return { st: live ? 'live' : c.w ? 'done' : 'wait', a: { n: c.a, s: c.w ? c.sa : null, w: c.w === 'a', l: c.w === 'b' }, b: { n: c.b, s: c.w ? c.sb : null, w: c.w === 'b', l: c.w === 'a' }, ...(c.station && !live ? { stn: c.station } : {}) }; }), ...(m.grid.table ? { table: m.grid.table, kind: m.grid.kind } : {}) } : null;
    // everyone, in or out (for "find yourself")
    const players = new Map();
    if (viewer && vt) {
      const pl = VT.placements(vt);
      for (const e of vt.entrants) players.set(e.name, { n: e.name, out: (pl.has(e.id) && pl.get(e.id) > 1) || !!e.dq, place: pl.get(e.id) || 0 });
    } else {
      for (const s of [...(m.winners || []).flatMap(c => c.sets), ...(m.losers || []).flatMap(c => c.sets), ...(m.gf || [])]) for (const p of [s.a, s.b]) if (p.name) players.set(p.name, { n: p.name, out: false, place: 0 });
      for (const p of m.standings || []) if (p.name) players.set(p.name, { n: p.name, out: p.place > 1, place: p.place });
    }
    // the other pools (start.gg events split into pools): their brackets and players too
    let pools = null;
    if (!viewer && sggPools.list.length && m.groupId) {
      const one = (pm, pool) => ({ pool, sections: [{ name: pm.type === 'DE' ? 'Winners' : 'Bracket', cols: (pm.winners || []).map(col) }, { name: 'Losers', cols: (pm.losers || []).map(col) }, { name: 'Grand Final', cols: (pm.gf || []).length ? [{ name: 'Grand Final', sets: pm.gf.map(s => conv(s, 'Grand Final')) }] : [] }] });
      pools = [{ ...one(m, m.pool || ((bracket.groups || []).find(g => g.id === m.groupId) || {}).pool || '1'), current: true }, ...sggPools.list.map(x => one(x.model, x.pool))];
      for (const x of sggPools.list) {
        for (const s of [...(x.model.winners || []).flatMap(c => c.sets), ...(x.model.losers || []).flatMap(c => c.sets), ...(x.model.gf || [])]) for (const p of [s.a, s.b]) if (p.name && !players.has(p.name)) players.set(p.name, { n: p.name, out: false, place: 0, pool: x.pool });
        for (const p of x.model.standings || []) if (p.name && p.place > 1) players.set(p.name, { n: p.name, out: true, place: 0, pool: x.pool });   // out of their pool
      }
    }
    return { pools, title: m.title || m.tournament || m.event || 'Tournament', game: m.game || state.game || '', sub: viewer ? 'Viewer tournament' : [m.event !== m.tournament ? m.event : '', m.phase, m.pool ? 'Pool ' + m.pool : ''].filter(Boolean).join(' · '),
      status: m.finished ? 'done' : 'live', left: m.left, entrants: m.entrants, type: m.type, sections, grid, now,
      standings: m.finished ? (m.standings || []).slice(0, 64).map(p => ({ place: p.place, name: p.name })) : [], players: [...players.values()].slice(0, 1024), at: m.updatedAt || Date.now() };
  }
  // the viewers' live bracket page (lib/watch.js)
  const watch = createWatch({ templateFile: path.join(PUBLIC_DIR, 'watch.html'), slotFor: t => ['vt', 'sgg'].find(k => shares[k].check(t)) || '',
    dataFor: slot => watchCacheBy[slot] || (slot === curSlot() ? watchData() : null) || {} });
  function writeShareHtml() {
    if (!share.status().on || !share.token()) return;
    const base = liveBase(), tok = share.token(), origins = [...new Set([base, ...lanUrls()].map(u => new URL(u).origin))];
    const csp = watch.fileCsp(origins);
    try { share.writeHtml(watch.page({ data: `${base}/watch/${tok}/data`, events: `${base}/watch/${tok}/events`, page: `${base}/watch/${tok}`, snapshot: watchCacheBy[curSlot()] || watchData() }, csp, share.status().name)); }
    catch (e) { console.error('bracket page export:', e.message); }
  }
  // the Top 8 standings splash, as pictures (desktop app: drawn in a hidden window)
  let shooting = null;
  const designShots = new Map();         // Designer › Export as picture: what the still page draws (kept for a minute)
  async function saveStandingsImages(format = 'both') {
    if (!opts.capture) throw new Error('Saving pictures needs the BeeboScore desktop app.');
    const m = bracket.model; if (!m || !(m.standings || []).length) throw new Error('There are no standings yet — the tournament has to have results first.');
    const tg = shareTarget(); if (!tg) throw new Error('Load a tournament first.');
    if (share.key() !== tg.key) share.begin(tg.key, tg.name);
    if (shooting) return shooting;
    shooting = (async () => {
      const base = `http://127.0.0.1:${actualPort}/overlay/${encodeURIComponent(config.activeOverlay)}?direct&shot=standings`;
      const shot = await opts.capture(base, { width: 1920, height: 1080 });
      const sq = await opts.capture(base + '&sq=1', { width: 1920, height: 1080, clip: { x: 420, y: 0, width: 1080, height: 1080 } }).catch(() => null);   // square, for Instagram
      const out = [];
      if (format !== 'jpg') { out.push(share.writeImage(shot.png, 'png')); if (sq) out.push(share.writeImage(sq.png, 'png', 'square')); }
      if (format !== 'png') { out.push(share.writeImage(shot.jpg, 'jpg')); if (sq) out.push(share.writeImage(sq.jpg, 'jpg', 'square')); }
      hub.broadcastWhere(c => c.meta.authed, 'share', shareStatus());
      return out.map(f => path.basename(f));
    })();
    try { return await shooting; } finally { shooting = null; }
  }
  function shareStatus() {
    const st = share.status(), tg = shareTarget(), mine = !!(tg && tg.key === share.key()), tok = share.token();
    const base = liveBase(), online = tunnel.status.state === 'online';
    const os = shares[curSlot() === 'vt' ? 'sgg' : 'vt'].status();
    const ordS = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
    const sd = bracket.model && bracket.model.finished ? (bracket.model.standings || []).slice(0, 8) : [];
    const postText = sd.length ? [`🏆 ${(watchCacheBy[curSlot()] || {}).title || (tg && tg.name) || 'Tournament'} — Top 8`, ...sd.map(p => `${p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : p.place === 3 ? '🥉' : ordS(p.place)} ${p.name}`), '', `Congrats to ${sd[0].name}, and thanks to everyone who played!${state.game ? ' #' + String(state.game).replace(/[^A-Za-z0-9]/g, '') : ''}`].join('\n') : '';
    return { ...st, current: mine, target: tg ? tg.name : '', other: os.active ? { name: os.name, on: os.on, files: os.files.length } : null, postText, finished: !!(bracket.model && bracket.model.finished), standings: bracket.model ? (bracket.model.standings || []).length : 0,
      capture: !!opts.capture, pics: config.settings.bracketPics === 'character' ? 'character' : 'avatar', autoStandings: config.settings.autoStandings !== false,
      link: st.on && tok ? `${base}/watch/${tok}` : '', short: st.on && tok ? base + shortPath(`/watch/${tok}`) : '', localLink: st.on && tok ? `http://localhost:${actualPort}/watch/${tok}` : '', online, html: st.on ? share.htmlName() : '' };
  }
  function shareAction(b = {}) {
    const tg = shareTarget();
    switch (b.do) {
      case 'live': {
        if (b.on !== false) { if (!tg) throw new Error('Load a start.gg event or generate a viewer tournament bracket first.'); if (share.key() !== tg.key) share.begin(tg.key, tg.name); }
        share.setLive(b.on !== false); if (b.on !== false) { watchCacheBy[curSlot()] = watchData(); writeShareHtml(); }
        break;
      }
      case 'purge': share.purge('deleted from the app'); standingsDone = ''; break;
      default: throw new Error('Unknown action.');
    }
    const s = shareStatus(); hub.broadcastWhere(c => c.meta.authed, 'share', s); return s;
  }
  function watchPush(slot) { try { watch.push(slot); } catch {} }            // (startup can close an expired link before `watch` exists)
  function watchCloseAll(slot) { try { watch.closeAll(slot); } catch {} }
  // Before a splash goes on air: get the latest results first (up to ~4 s), so the overlay opens ONCE with
  // fresh data instead of opening with the old bracket and rebuilding a second later mid-animation.
  // Returns false if a warm-up is already running (a double press): that press is ignored.
  let warming = null;
  async function warmBracket() {
    if (warming) return false;
    const s = config.startgg || {};
    if (!sggHas() || !s.eventId || (bracket.model && Date.now() - bracket.at < 6000)) return true;
    warming = Promise.race([loadBracket(true).catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
    hub.broadcastWhere(c => c.meta.authed, 'bracket-status', { ...bracketStatus(), loading: true });
    try { await warming; } finally { warming = null; }
    return true;
  }
  // refresh from start.gg every N seconds while a splash is showing (Settings: 10 / 20 / 45 s, or off)
  function bracketWatch(now) {
    if (now) loadBracket(false);                 // skipped when it was fetched in the last few seconds (warmBracket)
    if (bracket.timer) { clearTimeout(bracket.timer); bracket.timer = null; }
    const every = Number(config.settings.bracketRefresh);
    if (!every || !(state.splash && state.splash.show)) return;
    bracket.timer = setTimeout(() => { bracket.timer = null; if (state.splash && state.splash.show) { loadBracket(true); bracketWatch(false); } }, Math.max(10, every) * 1000);
    bracket.timer.unref && bracket.timer.unref();
  }

  if (state.splash && state.splash.show) setTimeout(() => bracketWatch(true), 1500);   // it was showing when the app closed

  // Winners / Losers pages (brackets too big for one screen). The app keeps the clock, so every overlay
  // (OBS, online links) shows the same side and the Stream Deck key knows which one is up.
  // Settings › bracketPage: seconds on each side, or '0' = only when you switch it yourself.
  let pageTimer = null;
  const bracketPaged = () => !!(bracket.model && bracket.model.paged);
  function pageClock() {
    clearTimeout(pageTimer); pageTimer = null;
    const every = Number(config.settings.bracketPage);
    if (!every || !bracketPaged() || !(state.splash && state.splash.show === 'bracket')) return;
    pageTimer = setTimeout(() => {
      pageTimer = null;
      if (state.splash && state.splash.show === 'bracket' && bracketPaged()) setSide(state.splash.side === 'L' ? 'W' : 'L');
    }, Math.max(5, every) * 1000);
    pageTimer.unref && pageTimer.unref();
  }
  function setSide(side) {                  // also counts as "turn the page now": restarts the clock
    setState({ splash: { side, n: ((state.splash && state.splash.n) || 0) + 1 } }, { undo: true });
  }
  // the "Losers side" button / Stream Deck key: shows the bracket on that side, or flips the side on air
  function bracketSide(want) {
    const cur = (state.splash && state.splash.show) || '';
    let side = want === 'W' || want === 'L' ? want : null;
    if (cur !== 'bracket') {                       // not on air (or Top 8 is): bring the bracket up on that side
      side = side || 'L';
      setState({ splash: { show: 'bracket', side: bracket.model && !bracket.model.paged ? 'W' : side, n: ((state.splash && state.splash.n) || 0) + 1 } }, { undo: true });
      return;
    }
    if (!bracketPaged()) return;                   // whole bracket already on one screen
    setSide(side || (state.splash.side === 'L' ? 'W' : 'L'));
  }

  // ------------------------------------------------------------ remote control (Stream Deck etc.)
  const remoteSeen = {};
  const sdReported = { plugin: '', app: '', at: 0 };
  function noteRemote(req) {
    const c = String(req.headers['x-beebo-client'] || '').toLowerCase();
    if (!/^[a-z0-9-]{1,30}$/.test(c)) return;
    remoteSeen[c] = Date.now();
    if (c === 'streamdeck') {             // the plugin says which version it is and which Stream Deck app runs it
      const v = s => (String(s || '').match(/^\d+(\.\d+){0,3}$/) || [''])[0];
      const plugin = v(req.headers['x-beebo-plugin']), app = v(req.headers['x-beebo-sd']);
      if (plugin) sdReported.plugin = plugin;
      if (app) sdReported.app = app;
      sdReported.at = Date.now();
      if (plugin && sdLastSeenPlugin !== plugin) { sdLastSeenPlugin = plugin; setTimeout(() => sdAutoUpdate('plugin-connected'), 500); }
    }
  }
  // ------------------------------------------------------------ Stream Deck plugin: install / keep up to date
  let sdLastSeenPlugin = '', sdBusy = false;
  const sdStatus = async () => ({ ...(await sdHelper.status(opts.streamDeckPlugin, sdReported)), connected: Date.now() - (remoteSeen.streamdeck || 0) < 6000,
    canInstall: typeof opts.openPath === 'function', autoUpdate: config.settings.sdAutoUpdate !== false });
  function sdOpen() { opts.openPath(opts.streamDeckPlugin); }
  // When the installed plugin is older than the one this BeeboScore ships, hand the new one to the Stream Deck app
  // (it replaces the old one). Only once per version, and never when the Stream Deck app is too old for it.
  async function sdAutoUpdate(why) {
    if (sdBusy || typeof opts.openPath !== 'function' || config.settings.sdAutoUpdate === false || STATION.n > 1) return;     // (Station 1 looks after the plugin)
    if (!opts.streamDeckPlugin || !fs.existsSync(opts.streamDeckPlugin)) return;
    sdBusy = true;
    try {
      const s = await sdStatus();
      if (!s.outdated) return;
      if (s.appTooOld) { hub.broadcastWhere(c => c.meta.authed, 'streamdeck-notice', { kind: 'app-too-old', ...s }); return; }
      if (config.sdOffered === s.bundledVersion) return;
      config.sdOffered = s.bundledVersion; saveConfig();
      sdOpen();
      hub.broadcastWhere(c => c.meta.authed, 'streamdeck-notice', { kind: 'updating', why, ...s });
    } catch {} finally { sdBusy = false; }
  }
  setTimeout(() => sdAutoUpdate('startup'), 9000);
  const sdTimer = setInterval(() => sdAutoUpdate('check'), 5 * 60 * 1000); sdTimer.unref && sdTimer.unref();   // e.g. after Stream Deck itself was updated
  function remoteStatus() {
    const pl = k => ({ name: state[k].name || '', team: state[k].team || '', score: Number(state[k].score) || 0, loser: !!state[k].loser,
      avatar: state[k].avatar || '', wins: state[k].wins ?? '', losses: state[k].losses ?? '', country: state[k].country || '' });
    const bo = String(state.bestOf || ''), firstTo = /^FT/i.test(bo) ? Number(bo.slice(2)) : Math.ceil((Number(bo) || 0) / 2);
    return { version: APP_VERSION, p1: pl('p1'), p2: pl('p2'), round: state.round || '', bestOf: state.bestOf, firstTo,
      vs: !!(state.vs && state.vs.show), splash: (state.splash && state.splash.show) || '',
      victory: !!(state.victory && state.victory.show), winner: winnerOf(state),
      bracket: bracket.model ? { ready: true, top8: !!(bracket.model.top8 && bracket.model.top8.reached), entrants: bracket.model.entrants, at: bracket.at, loading: !!bracket.loading,
        paged: !!bracket.model.paged, side: (state.splash && state.splash.side) || 'W', pageEvery: Number(config.settings.bracketPage) || 0, standings: (bracket.model.standings || []).length, finished: !!bracket.model.finished } : { ready: false, loading: !!bracket.loading, error: bracket.error },
      latency: (() => { const l = latency.list().filter(v => !v.gone), t = l.map(v => v.last).filter(v => v != null); return { viewers: l.length, online: l.filter(v => v.kind === 'online').length, worst: t.length ? Math.max(...t) : null }; })(),
      layout: config.activeOverlay,
      layouts: listOverlays().map(o => ({ name: o.name, title: o.title, game: o.game })),
      screens: layoutScreens(), screen: state.screen || '', tempo: tempo.bpm || 0, autopilot: { on: !!ap().on, running: !!apRun, step: apStep },
      autos: autos.list.map(a => ({ id: a.id, name: a.name, on: a.on, running: autos.running.includes(a.id) })), stats: { show: !!(state.stats && state.stats.show), side: Number(state.stats && state.stats.side) || 1 }, spon: (() => { const s = sponsorsClean(config.sponsors); return { on: s.on, n: s.items.length }; })(), sound: { on: config.settings.soundOn === true, vol: soundVol(), obs: config.settings.obsVolume === true }, fxq: config.settings.fxQuality || 'auto', undo: undoKind(), teamFmt: teamFmtLive(), playerVs: !!(state.playerVs && state.playerVs.show), vsStyle: config.settings.vsStyle === 'glass' ? 'glass' : 'full', cams: Object.keys(camLive).length, sdSetup: sdSetup.n ? { n: sdSetup.n, at: sdSetup.at } : null, obsRefresh: lastObsRefresh ? { ok: lastObsRefresh.ok, at: lastObsRefresh.at } : null, fbar: state.fbar !== false, sggReport: (() => { const r = reportable(), last = config.sggReports[config.sggReports.length - 1]; return { mode: reportMode(), can: !!r, sent: !!(r && last && last.key === r.key && ['sent', 'pending'].includes(last.status)) }; })(), share: (() => { const st = share.status(); return { on: !!st.on, online: tunnel.status.state === 'online', chat: chatCanSay() }; })(), vt: vt ? (() => { const v = VT.view(vt), c = vtNames(); return { status: v.status, open: v.open, count: v.count, alive: v.alive, name: v.name, source: config.bracketSource === 'viewer' ? 'viewer' : 'startgg', joinSplash: !!(state.splash && state.splash.show === 'vtjoin'), now: c ? `${c.a} vs ${c.b}` : '', winner: c ? winnerOf(state) : 0, champion: v.champion }; })() : null,
      format: state.format ? (() => { const v = FMT.view(state.format); return { kind: v.kind, preset: v.preset, status: v.status, name: v.name, label: v.label, pending: formatPending,
        score: v.kind === 'teams' ? (v.mode === 'paired' ? `${v.teams[0].points}–${v.teams[1].points}` : `${v.teams[0].left}–${v.teams[1].left}`) : v.kind === 'elim' ? (v.mode === 'koth' ? `x${v.streak}` : `${v.alive} left`) : `${v.played}/${v.total}`,
        tags: v.teams ? v.teams.map(t => t.name) : null, king: v.king || '', canUndo: formatUndo.length > 0,
        tdb: v.mode === 'tdb' ? { open: !!v.switchOpen, undo: !!v.canUnlock, max: v.lives, teams: v.teams.map(t => { const c = t.players.find(p => p.state === 'playing') || {}; return { tag: t.name, color: t.color, cur: c.name || '', lives: c.lives || 0 }; }) } : null }; })() : null,
      x: SHOW ? SHOW.sd() : null, accent: /^#[0-9a-f]{6}$/i.test(String(config.settings.sdAccent || '')) ? config.settings.sdAccent : '',     // 1.12.18: the show's keys; the brand kit's colour for the keys
      sdLayout: config.settings.sdLayout === 'all' ? 'all' : 'follow',     // 1.12.8: the Stream Deck follows the format, or shows every key in pages
      startgg: !!(sggHas() && config.startgg.eventId), updatedAt: state.updatedAt, event: (() => { const e = runningEvent(); return e ? { kind: e.kind, name: e.name, label: e.label } : null; })(),
      twitch: (() => { const v = vm.publicView(); return { chat: chat.state, open: v.open, count: v.count, current: v.current ? { name: v.current.display, s: v.current.s, v: v.current.v } : null, next: v.queue[0] ? v.queue[0].display : '', splash: v.splash.show, sidebar: v.sidebar, session: v.session }; })() };
  }
  const playerFrom = (known, extra = {}) => ({
    name: String(known.name || '').slice(0, 80), team: known.team || '', pronouns: known.pronouns || '', country: known.country || '',
    character: known.character || '', sggId: known.sggId ? String(known.sggId) : '', avatar: known.avatar || '', wins: '', losses: '', ...extra });
  async function nextMatch() {
    const s = config.startgg || {};
    if (!sggHas() || !s.eventId) throw new Error('Connect a start.gg tournament in the Bracket tab first.');
    let sets = [];
    if (s.tournament && s.tournament.slug) { try { sets = await startgg.loadStreamQueue(sggTok(), s.tournament.slug); } catch {} }
    if (!sets.length) sets = await startgg.loadSets(sggTok(), s.eventId);
    const next = sets.find(x => x.state !== 3 && x.p1 && x.p2 && String(x.id) !== String(state.setId || ''));
    if (!next) throw new Error('No upcoming match with both players yet.');
    const all = allPlayers();
    const side = sl => { const k = all.find(p => p.name.toLowerCase() === String(sl.name).toLowerCase()) || {};
      return playerFrom({ ...k, name: sl.name, team: k.team || sl.team || '', sggId: sl.entrantId }, { score: 0, loser: false }); };
    setState({ setId: String(next.id), round: next.round || state.round, p1: side(next.p1), p2: side(next.p2) });
    notify.send('onstream', `🎮 On stream now: **${next.p1.name}** vs **${next.p2.name}** (${next.round || 'next match'})`);
    { const after = sets.find(x => x !== next && x.state !== 3 && x.p1 && x.p2); if (after) notify.send('upnext', `⏭ Up next on stream: **${after.p1.name}** vs **${after.p2.name}** (${after.round || 'next'}) — get ready!`); }   // 1.12.18
    return { loaded: `${next.p1.name} vs ${next.p2.name}`, round: next.round };
  }
  // 1.12.16: VOD chapters. When each set began (two new players loaded, or the score back to 0–0 after a set), and chapter
  // marks you add (the Stream Deck's Chapter key, an automation step), turned into YouTube chapter times from the moment the
  // stream started (from OBS, or "Stream started now").
  const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');
  let chapters = { streamStart: 0, marks: [], ...readJSON(CHAPTERS_FILE, {}) }; if (!Array.isArray(chapters.marks)) chapters.marks = [];
  let setStartAt = 0;
  function setStartWatch(a, b) {
    const fresh = (b.n1 && b.n2 && (b.n1 !== a.n1 || b.n2 !== a.n2)) || (!b.s1 && !b.s2 && (a.s1 || a.s2));
    if (fresh || !setStartAt) setStartAt = Date.now();
    if (!setStartAt && (b.s1 || b.s2)) setStartAt = Date.now();
  }
  const saveChapters = () => saveLater(CHAPTERS_FILE, () => chapters, 200);
  const hms = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + String(x).padStart(2, '0'); };
  function chapterView() {
    const t0 = Number(chapters.streamStart) || 0, items = [];
    if (t0) {
      items.push({ t: 0, label: 'Start' });
      for (const r of hist.list({ limit: 500 })) { const at = Number(r.start) || (r.at - 8 * 60000); if (r.at < t0) continue; items.push({ t: Math.max(0, at - t0), label: `${r.round ? r.round + ' — ' : ''}${r.p1.name} vs ${r.p2.name}`, set: true }); }
      for (const m of chapters.marks) if (m.at >= t0) items.push({ t: m.at - t0, label: m.label || 'Highlight', mark: true, at: m.at });
      items.sort((x, y) => x.t - y.t);
    }
    const out = []; for (const it of items) { if (out.length && it.t - out[out.length - 1].t < 10000) { if (it.set && !out[out.length - 1].set && out[out.length - 1].t) out[out.length - 1] = it; continue; } out.push(it); }   // YouTube: 10 s apart at least
    return { streamStart: t0, marks: chapters.marks, items: out, text: out.length >= 3 ? out.map(x => `${hms(x.t)} ${x.label}`).join('\n') : '' };
  }
  function chapterMark(label) { chapters.marks.push({ at: Date.now(), label: String(label || '').trim().slice(0, 80) || 'Highlight' }); if (chapters.marks.length > 300) chapters.marks.shift(); saveChapters(); hub.broadcastWhere(c => c.meta.authed, 'chapters', chapterView()); }

  // 1.12.16: Automations — "when this happens, do that" (lib/automations.js). Each step goes through the same actions as the
  // panel and the Stream Deck; while one runs it doesn't count as you pressing something (Run of show keeps going).
  const autos = AUTO.createRunner({ doStep: autoStep, log: m => console.error(m) });
  autos.set(config.automations || []);
  const broadcastAutos = () => { try { hub.broadcastWhere(c => c.meta.authed, 'automations', { list: autos.list, running: autos.running }); } catch {} };
  async function autoStep(s) {
    const R = b => apDo(() => remoteAction(b));
    switch (s.do) {
      case 'stinger': return R({ action: 'stinger' });
      case 'vs': return R({ action: 'vs', show: s.show });
      case 'victory': return R({ action: 'victory', show: s.show });
      case 'splash': return R({ action: 'splash', kind: s.kind, show: s.show });
      case 'screen': return R({ action: 'screen', name: s.name, show: s.show });
      case 'hideAll': return R({ action: 'hideAll' });
      case 'nextMatch': return R({ action: 'nextMatch' });
      case 'replay': return R({ action: 'replay' });
      case 'tempoOff': return R({ action: 'tempo', do: 'off' });
      case 'obsScene': hub.broadcastWhere(c => c.meta.authed, 'obs-scene', { scene: s.scene }); return;     // the app's window talks to OBS
      case 'chat': if (chatCanSay() && s.text) chat.say(s.text.replace(/\{p1\}/g, state.p1.name).replace(/\{p2\}/g, state.p2.name).replace(/\{round\}/g, state.round || '')); return;
      case 'sponsor': return R({ action: 'sponsor', do: 'next' });
      case 'chapter': return R({ action: 'chapter', label: s.label });
      // 1.12.18
      case 'rundownNext': return R({ action: 'rundown', do: 'next' });
      case 'countdown': return R({ action: 'countdown', show: s.show, mins: s.mins, label: s.label });
      case 'walkin': return R({ action: 'walkin', side: s.side, show: s.show });
      case 'storyline': return R({ action: 'storyline', show: s.show });
      case 'predOpen': return R({ action: 'pred', do: 'predOpen' });
      case 'predLock': return R({ action: 'pred', do: 'predLock' });
      case 'pollStart': return R({ action: 'poll', do: 'pollToggle' });
      case 'hype': return R({ action: 'hype' });
      case 'music': return R({ action: 'music', do: s.on ? 'on' : 'off' });
      case 'ext': return R({ action: 'ext', ext: s.ext, cue: s.cue });
    }
  }
  function autoSnap(st) {
    return { s1: Number(st.p1 && st.p1.score) || 0, s2: Number(st.p2 && st.p2.score) || 0, round: String(st.round || ''), n1: String(st.p1 && st.p1.name || '').trim().toLowerCase(), n2: String(st.p2 && st.p2.name || '').trim().toLowerCase(),
      vs: !!(st.vs && st.vs.show) || !!(st.playerVs && st.playerVs.show), victory: !!(st.victory && st.victory.show), splash: (st.splash && st.splash.show) || '', screen: st.screen || '', fmt: !!(st.format && st.format.status === 'live') };
  }
  function autoWatch(a, b, winWas, winNow, undo) {
    if (!autos.list.length) return;
    const ev = []; const fire = (e, info) => ev.push([e, info]);
    if (!undo) {
      if (winNow && !winWas) fire('setWon', { round: b.round, who: winNow });
      else if (!winNow && (b.s1 > a.s1 || b.s2 > a.s2) && b.n1 === a.n1 && b.n2 === a.n2) {
        fire('gameWon', { who: b.s1 > a.s1 ? 1 : 2, round: b.round });
        const bo = String(state.bestOf || ''), ft = /^FT/i.test(bo) ? Number(bo.slice(2)) : Math.ceil((Number(bo) || 0) / 2);
        if (ft > 1 && ((b.s1 === ft - 1 && a.s1 < ft - 1) || (b.s2 === ft - 1 && a.s2 < ft - 1))) fire('matchPoint', { round: b.round });
      }
      if (b.n1 && b.n2 && b.n1 !== a.n1 && b.n2 !== a.n2) fire('newMatch', { round: b.round });
    }
    if (b.round.toLowerCase() !== a.round.toLowerCase() && b.round) fire('round', { round: b.round });
    if (b.vs && !a.vs) fire('shown', { what: 'vs' });
    if (b.victory && !a.victory) fire('shown', { what: 'victory' });
    if (b.splash && b.splash !== a.splash) fire('shown', { what: b.splash });
    if (b.screen && b.screen !== a.screen) fire('shown', { what: 'screen:' + b.screen });
    if (b.fmt && !a.fmt) fire('formatStart', {}); if (!b.fmt && a.fmt) fire('formatEnd', {});
    if (ev.length) setTimeout(() => { let n = 0; for (const [e, info] of ev) n += autos.fire(e, info); if (n) broadcastAutos(); }, 0);
  }

  // 1.12.15: Run of show (the autopilot). When a set is won: the victory screen → (a stinger) → the bracket splash while the
  // next match loads → back to the scoreboard. Settings › Run of show; any button you press yourself pauses it for that set.
  const AP_DEF = { on: false, victoryFor: 8, stinger: true, bracket: true, bracketFor: 14, next: true };
  const ap = () => ({ ...AP_DEF, ...(config.autopilot || {}) });
  let apRun = null, apStep = '', apInternal = 0; const apTimers = new Set();
  const broadcastStatus = () => { try { hub.broadcastWhere(c => c.meta.authed, 'autopilot', { ...ap(), running: !!apRun, step: apStep }); } catch {} };
  function apCancel(why) { for (const t of apTimers) clearTimeout(t); apTimers.clear(); if (apRun) { apRun = null; apStep = why ? 'paused' : ''; broadcastStatus(); } }
  function apTouch(b) { if (apInternal || !apRun) return; if (b && ['tempo', 'latencyTest', 'bracketRefresh', 'sdsetup', 'sdreport', 'autopilot'].includes(b.action)) return; apCancel('manual'); }
  async function apDo(fn) { apInternal++; try { return await fn(); } finally { apInternal--; } }
  function apStart() {
    const o = ap(); if (!o.on) return; apCancel(); const run = apRun = { at: Date.now() };
    const step = (ms, label, fn) => new Promise(res => { const t = setTimeout(async () => { apTimers.delete(t); if (apRun !== run) return res(false); apStep = label; broadcastStatus(); try { await apDo(fn); } catch (e) { console.error('autopilot:', e.message); } res(true); }, ms); apTimers.add(t); });
    (async () => {
      // the victory screen comes on by itself 2.2 s after the set is won (unless that's off: then the autopilot shows it)
      if (!(await step(2600, 'victory', () => { if (!(state.victory && state.victory.show) && winnerOf(state)) showVictory(winnerOf(state)); }))) return;
      if (!(await step(Math.max(2, o.victoryFor) * 1000, 'after victory', () => { if (state.victory && state.victory.show) setState({ victory: { show: false } }, { undo: true }); }))) return;
      if (o.stinger && !(await step(350, 'stinger', () => remoteAction({ action: 'stinger' })))) return;
      if (o.bracket && !(await step(o.stinger ? 650 : 0, 'bracket', () => remoteAction({ action: 'splash', kind: 'bracket', show: true })))) return;
      if (o.next && !(await step(1200, 'next match', () => nextMatch()))) return;
      if (o.bracket && !(await step(Math.max(3, o.bracketFor) * 1000 - 1200, 'back to the scoreboard', () => { if (state.splash && ['bracket', 'top8'].includes(state.splash.show)) remoteAction({ action: 'splash', kind: state.splash.show, show: false }); }))) return;
      if (apRun === run) { apRun = null; apStep = 'done'; broadcastStatus(); }
    })();
  }
  function autopilotAction(b) {
    const o = ap();
    if (b.do === 'toggle' || b.do === 'on' || b.do === 'off') { config.autopilot = { ...o, on: b.do === 'toggle' ? !o.on : b.do === 'on' }; if (!config.autopilot.on) apCancel(); saveConfig(); }
    else if (b.do === 'set' && b.set && typeof b.set === 'object') { const x = b.set, n = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : d));
      config.autopilot = { on: x.on === undefined ? o.on : !!x.on, victoryFor: n(x.victoryFor, 2, 60, o.victoryFor), stinger: x.stinger === undefined ? o.stinger : !!x.stinger, bracket: x.bracket === undefined ? o.bracket : !!x.bracket, bracketFor: n(x.bracketFor, 3, 120, o.bracketFor), next: x.next === undefined ? o.next : !!x.next }; saveConfig(); }
    else if (b.do === 'stop') apCancel();
    broadcastStatus(); return { autopilot: { ...ap(), running: !!apRun, step: apStep } };
  }

  // 1.12.15: tap tempo — looks set to pulse on the beat follow it (BeeboFX 4's audio bus on every overlay)
  const tempo = { bpm: 0, taps: [] };
  function tempoAction(b) {
    const t = Date.now();
    if (b.do === 'off') { tempo.bpm = 0; tempo.taps = []; hub.broadcast('tempo', { bpm: 0 }); return tempo; }
    if (b.do === 'set') { tempo.bpm = Math.max(0, Math.min(220, Math.round(Number(b.bpm) || 0))); if (tempo.bpm && tempo.bpm < 40) tempo.bpm = 40; hub.broadcast('tempo', { bpm: tempo.bpm }); return tempo; }
    tempo.taps = tempo.taps.filter(x => t - x < 3000); tempo.taps.push(t);
    if (tempo.taps.length >= 3) { const d = []; for (let i = 1; i < tempo.taps.length; i++) d.push(tempo.taps[i] - tempo.taps[i - 1]); tempo.bpm = Math.max(40, Math.min(220, Math.round(60000 / (d.reduce((x, y) => x + y, 0) / d.length)))); }
    hub.broadcast('tempo', { tap: true }); return tempo;
  }
  async function remoteAction(b) {
    const k = Number(b.side) === 2 ? 'p2' : 'p1';
    apTouch(b);
    switch (b.action) {
      case 'tempo': tempoAction(b); break;
      case 'autopilot': return autopilotAction(b);
      case 'chapter': chapterMark(b.label); break;      // 1.12.16: a VOD chapter mark, now
      case 'sponsor': {                                   // 1.12.16: the next sponsor now · rotation on / off
        const s = sponsorsClean(config.sponsors); if (!s.items.length) throw new Error('Add a sponsor first (Settings › Sponsors).');
        if (b.do === 'toggle' || b.do === 'on' || b.do === 'off') { config.sponsors = { ...s, on: b.do === 'toggle' ? !s.on : b.do === 'on' }; saveConfig(); }
        else sponCue++;
        broadcast('state', liveState()); break;
      }
      case 'stats': {                                     // 1.12.16: the caster stats card (record, head-to-head, main) for a player
        const side = Number(b.side) === 2 ? 2 : 1, cur = state.stats || {}, on = b.show === undefined || b.show === 'toggle' ? !(cur.show && Number(cur.side) === side) : !!b.show;
        if (on && !(state[`p${side}`] && state[`p${side}`].name)) throw new Error('No player there yet.');
        setState({ stats: { show: on, side, n: (Number(cur.n) || 0) + 1 } }, { undo: true }); break;
      }
      case 'automation': {      // 1.12.16: run one (the Stream Deck's Run automation key, the panel's ▶ Run), or switch one on / off
        if (b.do === 'stop') { autos.stop(); break; }
        const a = autos.list.find(x => x.id === b.id || x.name.toLowerCase() === String(b.id || b.name || '').toLowerCase());
        if (!a) throw new Error('No automation called that.');
        if (b.do === 'toggle') { config.automations = autos.set(autos.list.map(x => x.id === a.id ? { ...x, on: !x.on } : x)); saveConfig(); broadcastAutos(); break; }
        if (!a.steps.length) throw new Error('That automation has no steps yet.');
        autos.runNow(a.id); broadcastAutos(); break;
      }
      case 'replay': {          // 1.12.15: Instant replay — the app's window (it talks to OBS) does it
        let n = 0; try { n = hub.broadcastWhere(c => c.meta.authed, 'obs-replay', { at: Date.now() }) || 0; } catch {}
        break; }
      case 'score': { const d = Math.max(-9, Math.min(9, Number(b.delta) || 1)); setState({ [k]: { score: Math.max(0, (Number(state[k].score) || 0) + d) } }); break; }
      case 'setScore': setState({ [k]: { score: Math.max(0, Math.min(99, Number(b.value) || 0)) } }); break;
      case 'reset': setState({ p1: { score: 0 }, p2: { score: 0 } }); break;
      case 'swap': { const a = structuredClone(state.p1), c = structuredClone(state.p2); setState({ p1: c, p2: a }); break; }
      case 'undo': if (!undoOnce()) throw new Error('Nothing to undo.'); break;
      case 'undoAny': {                   // the Stream Deck's one Undo: a format result if that was the last thing that happened, else the last change
        if (undoKind() === 'format') formatAction({ do: 'undo' }); else if (!undoOnce()) throw new Error('Nothing to undo.');
        break;
      }
      case 'sound': {                     // stream sound: on / off / toggle, or a volume step (Stream Deck, shortcuts)
        if (b.step !== undefined) { config.settings.soundVolume = String(Math.max(0, Math.min(100, soundVol() + Math.round(Number(b.step) || 0)))); if (Number(b.step) > 0 && config.settings.soundOn !== true) config.settings.soundOn = true; }
        else config.settings.soundOn = b.on === undefined || b.on === 'toggle' ? config.settings.soundOn !== true : !!b.on && b.on !== 'false';
        saveConfig(); broadcast('settings', config.settings); broadcast('state', liveState()); break;
      }
      case 'obsrefresh': return refreshObs();
      case 'hideOne': {                   // 1.12.19: the panel's "On stream now" bar (and the Hide the show's screens shortcut) — one thing off, the rest stay
        const w = String(b.what || ''), off = { undo: true };
        if (w === 'vs') setState({ vs: { show: false } }, off);
        else if (w === 'playerVs') setState({ playerVs: { show: false } }, off);
        else if (w === 'victory') setState({ victory: { ...(state.victory || {}), show: false } }, off);
        else if (w === 'splash') setState({ splash: { ...(state.splash || {}), show: '' } }, off);
        else if (w === 'screen') setState({ screen: '' }, off);
        else if (w === 'full') setState({ full: { ...(state.full || {}), show: '' } }, off);
        else if (w === 'card') setState({ card: { ...(state.card || {}), show: '' } }, off);
        else if (w === 'show') setState({ full: { ...(state.full || {}), show: '' }, card: { ...(state.card || {}), show: '' } }, off);
        else if (w === 'stats') setState({ stats: { ...(state.stats || {}), show: false } }, off);
        else if (w === 'h2h') setState({ h2h: { show: false } }, off);                               // 1.12.21
        else if (w === 'moment') { if (SHOW) SHOW.moments.clear(); }
        else if (w === 'timer') setState({ timer: { show: false, start: 0, end: 0 } }, off);
        else if (w === 'draw') return remoteAction({ action: 'drawClear' });
        else if (/^ext:[a-z0-9-]{2,31}:[a-z0-9-]{1,30}$/.test(w)) { const [, id, sc] = w.split(':'); return remoteAction({ action: 'ext', ext: id, screen: sc, show: false }); }
        else throw new Error('Nothing called that is on stream.');
        break;
      }
      case 'hideAll': setState({ vs: { show: false }, victory: { show: false }, splash: { show: '' }, screen: '', playerVs: { show: false }, full: { show: '' }, card: { show: '' }, stats: { show: false }, h2h: { show: false } }, { undo: true }); try { if (SHOW) SHOW.moments.clear(); } catch {} try { viewerAction({ action: 'splash', show: false }); } catch {} break;   // every full-screen splash off (the viewer one too); the scoreboard stays   // every full-screen splash off; the scoreboard stays
      case 'sdsetup': return sdSetupStart();                                     // 1.12: Set up Stream Deck
      case 'sdreport': {                                                          // the plugin says which decks it sees, and what Set up did
        const ds = Array.isArray(b.devices) ? b.devices.slice(0, 8) : [];
        sdDevices = ds.map(d => ({ name: String(d.name || '').slice(0, 60), type: Number(d.type) || 0, cols: Math.max(0, Math.min(16, Number(d.cols) || 0)), rows: Math.max(0, Math.min(16, Number(d.rows) || 0)), profile: String(d.profile || '').slice(0, 40) }));
        if (Number(b.setup) && Number(b.setup) === sdSetup.n) { sdSetup.done = Date.now(); sdSetup.sent = Array.isArray(b.sent) ? b.sent.slice(0, 8).map(x => String(x).slice(0, 60)) : []; broadcast('sdsetup', sdSetupView()); }
        return { ok: true };
      }   // 1.12: Refresh OBS (panel button, Stream Deck key)
      case 'fxq': {                       // effects quality (Stream Deck): step Auto → Full → Light → Ultra-light, or set one
        const L = ['auto', 'full', 'light', 'ultra'], cur = config.settings.fxQuality || 'auto', q = String(b.quality || 'cycle');
        config.settings.fxQuality = q === 'cycle' ? L[(L.indexOf(cur) + 1) % L.length] : ['auto', 'full', 'light', 'off', 'ultra'].includes(q) ? q : 'auto';
        saveConfig(); broadcast('settings', config.settings); broadcast('state', liveState()); break;
      }
      case 'vt': vtAction({ do: b.do === 'next' ? 'confirm' : b.do || 'open', open: b.open }); break;
      case 'sggreport': {               // the finished start.gg set → start.gg
        const r = reportable();
        if (!r) throw new Error(!state.setId ? 'Load the match from the start.gg bracket first.' : !winnerOf(state) ? 'Nobody has won this set yet.' : "This set can't be reported (both players need to come from start.gg).");
        enqueueReport(r, 'streamdeck'); break;
      }
      case 'postlink': {                // the live bracket link into Twitch chat
        const st = shareStatus();
        if (!st.on || !st.current) throw new Error('Turn on the live bracket page first (Bracket tab › Share & export).');
        if (!st.online) throw new Error('Go online first so viewers can open the link.');
        if (!chatCanSay()) throw new Error('Sign in to Twitch so BeeboScore can post in chat.');
        chat.say(`📋 ${st.target || 'Bracket'} — live bracket: ${st.link} (type !next to see where you are)`); break;
      }   // viewer tournament: signups open / close, confirm & next match
      case 'fbar': setState({ fbar: b.show === undefined || b.show === 'toggle' ? state.fbar === false : !!b.show && b.show !== 'false' }); break;   // the format bar (teams, survivors, queue…) along the bottom
      case 'vs': {                         // 1.12.6: the VS key / button plays the VS style chosen (FullVS or GlassVS) — any format, any match
        const style = b.style === 'glass' || b.style === 'full' ? b.style : b.classic ? 'full' : config.settings.vsStyle === 'glass' ? 'glass' : 'full';
        if (style === 'glass') { const on = b.show === undefined || b.show === 'toggle' ? !(state.playerVs && state.playerVs.show) : !!b.show; setState({ playerVs: { show: on }, ...(on ? { vs: { show: false } } : {}) }, { undo: true }); break; }
        const on = b.show === undefined || b.show === 'toggle' ? !(state.vs && state.vs.show) : !!b.show;
        setState({ vs: { show: on }, ...(on ? { playerVs: { show: false } } : {}) }, { undo: true }); break;
      }
      case 'playervs': {                   // GlassVS (the lock-in VS, 1.12.5's Player VS): up until you hide it — any match since 1.12.6
        const on = b.show === undefined || b.show === 'toggle' ? !(state.playerVs && state.playerVs.show) : !!b.show;
        setState({ playerVs: { show: on }, ...(on ? { vs: { show: false } } : {}) }, { undo: true }); break;
      }
      case 'comm': {                       // 1.12.6: the commentary screen
        const cur = (state.splash && state.splash.show) || '', on = b.show === undefined || b.show === 'toggle' ? cur !== 'comm' : !!b.show && b.show !== 'false';
        setState({ splash: on ? { show: 'comm', side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } : cur === 'comm' ? { show: '' } : state.splash }, { undo: true }); break;
      }
      case 'vsstyle': {                    // 1.12.6: FullVS ⇄ GlassVS for the VS key / button
        const cur = config.settings.vsStyle === 'glass' ? 'glass' : 'full';
        config.settings.vsStyle = b.style === 'glass' || b.style === 'full' ? b.style : cur === 'glass' ? 'full' : 'glass'; saveConfig();
        broadcast('settings', config.settings); broadcast('state', liveState()); break;
      }
      case 'vtjoin': {                   // the viewer tournament's "how to join" splash
        if (!vt) throw new Error('Set up a viewer tournament first (Bracket tab).');
        const cur = (state.splash && state.splash.show) || '', on = b.show === undefined || b.show === 'toggle' ? cur !== 'vtjoin' : !!b.show && b.show !== 'false';
        setState({ splash: on ? { show: 'vtjoin', side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } : cur === 'vtjoin' ? { show: '' } : state.splash }, { undo: true }); break;
      }
      case 'vtbracket': {                // the viewer tournament's bracket on stream (switches the bracket over to it)
        if (!vt) throw new Error('Set up a viewer tournament first (Bracket tab).');
        if (vt.status === 'signup') throw new Error('The viewer tournament hasn’t started yet — start it first, then its bracket can go on stream.');
        if (config.bracketSource !== 'viewer') vtAction({ do: 'source', source: 'viewer' });
        return remoteAction({ action: 'splash', kind: 'bracket', show: b.show });
      }
      case 'splash': {
        if (b.kind === 'vtjoin') return remoteAction({ action: 'vtjoin', show: b.show });
        const kind = ['top8', 'standings'].includes(b.kind) ? b.kind : 'bracket', cur = (state.splash && state.splash.show) || '';
        const on = b.show === undefined || b.show === 'toggle' ? cur !== kind : !!b.show;
        if (on && cur !== kind) {
          if (!(await warmBracket())) return { busy: true };                 // a press while it's already loading
          if (((state.splash && state.splash.show) || '') === kind) break;  // another press beat us to it
        }
        setState({ splash: on ? { show: kind, side: 'W', n: ((state.splash && state.splash.n) || 0) + 1 } : { show: '' } }, { undo: true }); break;
      }
      case 'victory': {
        const on = !!(state.victory && state.victory.show), want = b.show === undefined || b.show === 'toggle' ? !on : !!b.show;
        if (!want) { if (on) setState({ victory: { show: false } }, { undo: true }); break; }
        const w = winnerOf(state);
        if (!w) throw new Error('Nobody has won the set yet — the victory splash shows the set winner.');
        if (!on) showVictory(w);
        break;
      }
      case 'bracketSide': {
        if (((state.splash && state.splash.show) || '') !== 'bracket' && !(await warmBracket())) return { busy: true };
        bracketSide(b.side); break;
      }
      case 'bracketRefresh': { await loadBracket(true); if (bracket.error) throw new Error(bracket.error); return { bracket: bracketStatus(), status: remoteStatus() }; }
      case 'latencyTest': latency.test(); return { ok: true };
      case 'fswitch': {                                   // Team Death Battle: that team's next fighter in (Stream Deck)
        const f = state.format; if (!f || f.rules.mode !== 'tdb' || f.status !== 'live') throw new Error('No Team Death Battle is running.');
        if (!f.switchOpen) throw new Error('Switching opens after someone loses a life.');
        const side = Number(b.side) === 2 ? 2 : 1, ti = side - 1, team = f.teams[ti], cur = ti === 0 ? f.match.a.i : f.match.b.i;
        for (let k = 1; k <= team.players.length; k++) { const j = (cur + k) % team.players.length; if (!team.players[j].out && j !== cur) { formatAction({ do: 'swap', side, index: j }); return { ok: true, name: team.players[j].name }; } }
        throw new Error('Nobody else on that team can come in.');
      }
      case 'hype': fxCue = { n: fxCue.n + 1, kind: 'hype' }; broadcast('state', liveState()); return { ok: true };
      case 'stinger': fxCue = { n: fxCue.n + 1, kind: 'stinger' }; broadcast('state', liveState()); return { ok: true };   // 1.12.10: the layout's stinger over the stream, now   // BeeboFX: the layout's hype burst
      // 1.10: one plate's hype burst, Electrocuted, or a moment's effect stack played on demand (side: 1 or 2)
      case 'hype1': case 'hype2': fxCue = { n: fxCue.n + 1, kind: 'hype', side: b.action === 'hype1' ? 1 : 2 }; broadcast('state', liveState()); return { ok: true };
      case 'moment': {                                   // Stream Deck Hype key › Play: a moment (point, win, comeback, Electrocuted) for one player, or a hype burst
        const m = /^(hype|point|win|mend|electro|slice|fissure)([12])?$/.exec(String(b.moment || '')); if (!m) throw new Error('Unknown moment.');
        fxCue = { n: fxCue.n + 1, kind: m[1], ...(m[2] ? { side: Number(m[2]) } : {}) }; broadcast('state', liveState()); return { ok: true };
      }
      case 'electro1': case 'electro2': fxCue = { n: fxCue.n + 1, kind: 'electro', side: b.action === 'electro1' ? 1 : 2 }; broadcast('state', liveState()); return { ok: true };
      case 'moment3d': setState({ m3d: { n: ((state.m3d && state.m3d.n) || 0) + 1 } }, { undo: true }); return { ok: true };   // every 3D piece plays its Stream Deck move
      case 'loser': setState({ [k]: { loser: b.value === undefined ? !state[k].loser : !!b.value } }); break;
      case 'clear': setState({ setId: '', p1: { ...blankPlayer() }, p2: { ...blankPlayer() } }); break;
      case 'format': return formatAction(b);
      case 'screen': {                       // a designer screen: show / hide / toggle (by id, name or kind)
        const id = b.name === '' || b.name === 'none' ? '' : screenId(String(b.name || ''));
        if (b.name && b.name !== 'none' && !id) throw new Error('This layout has no screen called “' + b.name + '”.');
        const on = b.show === undefined || b.show === 'toggle' ? state.screen !== id : !!b.show;
        setState({ screen: on ? id : '' }, { undo: true }); break;
      }
      case 'layout': {
        const list = listOverlays();
        let name = b.name;
        if (!name || name === 'next' || name === 'prev') {
          const game = (list.find(o => o.name === config.activeOverlay) || {}).game;
          const pool = b.sameGame !== false ? list.filter(o => o.game === game) : list;
          const i = pool.findIndex(o => o.name === config.activeOverlay);
          name = (pool[(i + (name === 'prev' ? -1 : 1) + pool.length) % pool.length] || {}).name;
        }
        if (!overlayExists(name)) throw new Error('Layout not found.');
        setActive(name); break;
      }
      case 'setPlayer': {
        const pl = b.player && typeof b.player === 'object' ? b.player : { name: b.name };
        if (!String(pl.name || '').trim()) throw new Error('No name given.');
        setState({ [k]: playerFrom(pl) }); break;
      }
      case 'pick': {
        if (opts.showPicker) { opts.showPicker(Number(b.side) === 2 ? 2 : 1); return { popup: true }; }
        return { url: `/pick?side=${Number(b.side) === 2 ? 2 : 1}` };
      }
      case 'nextMatch': return { ...(await nextMatch()), status: remoteStatus() };
      // viewer matches (Twitch Stuff): Stream Deck + shortcuts
      case 'viewerNext': viewerAction({ action: 'next' }); break;
      case 'viewerResult': viewerAction({ action: 'result', who: b.who === 'viewer' ? 'viewer' : 'streamer', delta: b.delta }); break;
      case 'viewerQueue': viewerAction({ action: 'open', open: b.open === undefined || b.open === 'toggle' ? undefined : !!b.open }); break;
      case 'viewerSidebar': viewerAction({ action: 'sidebar', show: b.show === undefined || b.show === 'toggle' ? undefined : !!b.show }); break;
      case 'viewerSplash': viewerAction({ action: 'splash', show: b.show === undefined || b.show === 'toggle' ? undefined : !!b.show }); break;
      default: {             // 1.12.18: the show's actions (rundown, countdown, walk-in, picks, polls, Replay 2.0, music, extensions…)
        if (!SHOW || !SHOW.ACTIONS.includes(b.action)) throw new Error('Unknown action.');
        const r = await SHOW.action(b); return { ...(r || {}), status: remoteStatus() };
      }
    }
    return { status: remoteStatus() };
  }

  // VS Splash: start.gg profile picture + this event's win/loss record for whoever is on stream.
  const runFetched = { 1: '', 2: '' };
  function syncRuns(force) {
    const s = config.startgg || {};
    if (!sggHas() || !s.eventId) return;
    for (const side of [1, 2]) {
      const id = String(state['p' + side].sggId || '');
      if (!id || (!force && runFetched[side] === id)) continue;
      runFetched[side] = id;
      startgg.loadRun(sggTok(), s.eventId, id).then(r => {
        if (String(state['p' + side].sggId || '') !== id) return;      // a different player was loaded meanwhile
        const cur = state['p' + side], patch = { wins: String(r.wins), losses: String(r.losses) };
        if (r.avatar) patch.avatar = r.avatar;
        if (cur.wins === patch.wins && cur.losses === patch.losses && (!r.avatar || cur.avatar === r.avatar)) return;
        setState({ ['p' + side]: patch }, { undo: true });             // not an undo step
      }).catch(() => { runFetched[side] = ''; });
    }
  }

  // One .txt per value for OBS Text sources. Only changed values are rewritten, off the hot path.
  const lastText = {};
  let textTimer = null;
  function writeTextOutputs() {
    clearTimeout(textTimer);
    textTimer = setTimeout(async () => {
      const flat = {};
      (function walk(obj, prefix) {
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}_${k}` : k;
          if (v && typeof v === 'object') walk(v, key); else flat[key] = v;
        }
      })(state, '');
      // set result, for OBS Text sources: winner.txt, loser.txt, final_score.txt (empty until the set is won)
      const w = winnerOf(state), W = w ? state['p' + w] : null, Lp = w ? state['p' + (3 - w)] : null;
      flat.winner = W ? W.name || '' : ''; flat.winner_team = W ? W.team || '' : ''; flat.loser = Lp ? Lp.name || '' : '';
      flat.final_score = W ? `${Number(W.score) || 0} - ${Number(Lp.score) || 0}` : '';
      delete flat.victory_show; delete flat.victory_side; delete flat.victory_n;
      try { await fsp.mkdir(OUTPUT_DIR, { recursive: true }); } catch {}
      await Promise.all(Object.entries(flat).map(([k, v]) => {
        if (k === 'updatedAt') return null;
        const val = String(v ?? '');
        if (lastText[k] === val) return null;
        lastText[k] = val;
        return fsp.writeFile(path.join(OUTPUT_DIR, `${k.replace(/[^\w-]/g, '_')}.txt`), val).catch(() => {});
      }));
    }, 60);
  }

  function rememberPlayers() {
    let changed = false;
    for (const p of [state.p1, state.p2]) {
      if (!p.name || /^Player [12]$/.test(p.name)) continue;
      const existing = players.find(x => x.name.toLowerCase() === p.name.toLowerCase());
      const entry = { name: p.name, team: p.team, pronouns: p.pronouns, country: p.country, character: p.character };
      if (p.avatar && !p.sggId) entry.avatar = p.avatar;   // remember hand-entered pictures too
      if (!existing) { players.push(entry); changed = true; }
      else if (JSON.stringify(existing) !== JSON.stringify(entry)) { Object.assign(existing, entry); changed = true; }
    }
    if (changed) {
      players.sort((a, b) => a.name.localeCompare(b.name));
      saveLater(PLAYERS_FILE, () => players);
      broadcast('players', allPlayers());
    }
  }

  function allPlayers() {
    const map = new Map();
    for (const e of sggEntrants) {
      if (!e.name) continue;
      map.set(e.name.toLowerCase(), { name: e.name, team: e.team || '', pronouns: e.pronouns || '', country: e.country || '', character: '', avatar: e.avatar || '', sggId: e.entrantId ? String(e.entrantId) : '', source: 'startgg' });
    }
    for (const p of players) {
      const k = p.name.toLowerCase();
      const prev = map.get(k);
      map.set(k, { ...(prev || {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)), source: prev ? 'both' : 'history' });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // ------------------------------------------------------------ overlays (cached list)
  function safeName(name) { return String(name || '').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60); }
  function overlayDir(name) { return path.join(OVERLAYS_DIR, safeName(name)); }
  function overlayExists(name) { return !!safeName(name) && fs.existsSync(path.join(overlayDir(name), 'index.html')); }

  function guessGame(name) {
    const n = name.toLowerCase();
    if (/tekken/.test(n)) return 'Tekken 8';
    return 'Any game';
  }

  let overlayCache = null;
  const FORMAT_KEYS = ['crew', 'sajam', 'gauntlet', 'tdb', 'death', 'koth', 'league'];
  // a layout that ships with the app and has been changed since (in the app or in a text editor) — checked live, it's only a hash of one file
  function isEdited(name) {
    const b = path.join(BUNDLE_DIR, 'overlays', name, 'index.html');
    if (!fs.existsSync(b) || path.resolve(BUNDLE_DIR, 'overlays') === path.resolve(OVERLAYS_DIR)) return false;
    const h = hashFile(path.join(overlayDir(name), 'index.html')), rec = readJSON(SEEDED_FILE, {})[name];
    return !!h && h !== hashFile(b) && !(rec && rec.hash === h);
  }
  // designer layouts can have extra screens (starting soon, BRB, Top 8, lower thirds…): the app, the Stream Deck and the state switch them
  const screenCache = new Map();
  function layoutScreens(name = config.activeOverlay) {
    const f = path.join(overlayDir(name), 'design.json');
    let st; try { st = fs.statSync(f); } catch { return []; }
    const c = screenCache.get(name); if (c && c.m === st.mtimeMs) return c.v;
    const d = readJSON(f, {}), full = { lower: false, ticker: false, camera: false };
    const v = Object.entries((d && d.scenes) || {}).filter(([k]) => !['board', 'vs', 'victory'].includes(k)).map(([k, sc]) => ({ id: k, name: String(sc.name || k).slice(0, 40), kind: sc.kind || 'custom', full: full[sc.kind] !== false && !(sc.kind in full) }));
    screenCache.set(name, { m: st.mtimeMs, v }); return v;
  }
  function screenId(want, name) {
    if (!want) return '';
    const sl = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), list = layoutScreens(name);
    const hit = list.find(x => x.id === want) || list.find(x => sl(x.name) === sl(want)) || list.find(x => x.kind === want);
    return hit ? hit.id : '';
  }
  // a layout file that works on any PC: every picture / video / font it uses goes inside it
  function inlineDesign(d) {
    let total = 0;
    const walk = o => { for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        let f = null; const om = v.match(/^\/o\/([^/]+)\/assets\/([\w.-]+)$/), am = v.match(/^\/assets\/([a-f0-9]{12}\.[a-z0-9]{2,5})$/);
        if (om) f = path.join(overlayDir(safeName(om[1])), 'assets', path.basename(om[2])); else if (am) f = path.join(ASSET_DIR, am[1]);
        if (f) try { const buf = fs.readFileSync(f); total += buf.length; if (total < 60 * 1024 * 1024) o[k] = `data:${MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${buf.toString('base64')}`; } catch {}
      } else if (v && typeof v === 'object') walk(v);
    } };
    const c = structuredClone(d); walk(c); return c;
  }
  const GALLERY_DIRS = () => [path.join(BUNDLE_DIR, 'gallery'), path.join(DATA_DIR, 'gallery')];
  const ART_DIR = path.join(__dirname, 'art', 'designs');      // BeeboScore's own art, as Designer designs (tools/designer-art/build.js)
  function galleryList() {           // curated layouts (Beebo's picks): .beebo files in the app's gallery folder
    const out = [];
    for (const dir of GALLERY_DIRS()) { let fl = []; try { fl = fs.readdirSync(dir).filter(f => /\.beebo$/i.test(f)); } catch {}
      for (const f of fl) { try { const j = readJSON(path.join(dir, f), null), d = j && (j.design || j); if (!d || !d.scenes) continue;
        out.push({ id: f.replace(/\.beebo$/i, ''), title: String(d.title || f).slice(0, 60), game: String(d.game || ''), blurb: String((j && j.blurb) || d.blurb || '').slice(0, 160), screens: Object.keys(d.scenes).length, size: d.size || { w: 1920, h: 1080 } }); } catch {} } }
    return out;
  }
  function listOverlays() {
    if (overlayCache) return overlayCache.map(o => ({ ...o, active: o.name === config.activeOverlay, edited: o.bundled ? isEdited(o.name) : false }));
    if (!fs.existsSync(OVERLAYS_DIR)) return [];
    overlayCache = fs.readdirSync(OVERLAYS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(OVERLAYS_DIR, d.name, 'index.html')))
      .map(d => {
        const dir = path.join(OVERLAYS_DIR, d.name);
        const meta = readJSON(path.join(dir, 'overlay.json'), {});
        // a layout that comes with the app keeps the app's name and place in the list, even when its page was edited (so an edited copy from an older build is not left with an old name)
        const own = path.resolve(BUNDLE_DIR, 'overlays') !== path.resolve(OVERLAYS_DIR) ? readJSON(path.join(BUNDLE_DIR, 'overlays', d.name, 'overlay.json'), null) : null;
        if (own && own.title) { meta.title = own.title; meta.family = own.family || own.title; meta.order = own.order; if (!isEdited(d.name)) { meta.description = own.description; meta.colors = own.colors; } }
        return {
          name: d.name, order: meta.order !== '' && meta.order != null && Number.isFinite(Number(meta.order)) ? Number(meta.order) : 999,   // 1.12.13: order 0 (Default, first) used to count as none
          title: meta.title || d.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          game: meta.game || guessGame(d.name),
          description: meta.description || '',
          colors: Array.isArray(meta.colors) ? meta.colors.slice(0, 4) : [],
          files: walkFiles(dir),
          designer: fs.existsSync(path.join(dir, 'design.json')),
          // layout families: one look (Shattered, Oni…) with a version per game format; the family shows once in the Match tab
          family: String(meta.family || meta.title || d.name).slice(0, 40), format: FORMAT_KEYS.includes(meta.format) ? meta.format : '', base: meta.base ? safeName(meta.base) : '',
          bundled: fs.existsSync(path.join(BUNDLE_DIR, 'overlays', d.name, 'index.html')) && path.resolve(BUNDLE_DIR, 'overlays') !== path.resolve(OVERLAYS_DIR),
          builtIn: fs.existsSync(path.join(BUNDLE_DIR, 'overlays', d.name, 'index.html')),      // 1.5.1: one of the app's own (the Layouts tab lists the rest as yours)
          author: String(meta.author || '').slice(0, 60), imported: !!meta.imported,
          modified: fs.statSync(path.join(dir, 'index.html')).mtimeMs,
          // a still of the player bars for the Layouts tab card (a few KB): the app's own looks ship one, any layout can carry its own thumb.webp / thumb.png
          thumb: !isEdited(d.name) && fs.existsSync(path.join(PUBLIC_DIR, 'thumbs', d.name + '.webp')) ? `/static/thumbs/${d.name}.webp?v=${APP_VERSION}`
            : ['thumb.webp', 'thumb.png', 'thumb.jpg'].map(f => fs.existsSync(path.join(dir, f)) ? `/o/${d.name}/${f}` : '').find(Boolean) || '',
        };
      })
      .sort((a, b) => gameRank(a.game) - gameRank(b.game) || a.order - b.order || a.game.localeCompare(b.game) || a.title.localeCompare(b.title));   // 1.12.24: by game first (Tekken 8, Street Fighter 6, Avatar Legends, Fatal Fury, then any other)   // 1.12.13: the app's own looks (Default first) above anything without a place
    return listOverlays();
  }
  function overlaysChanged() { overlayCache = null; broadcast('overlays', listOverlays()); }

  // ------------------------------------------------------------ 1.5.1: layouts people make (the Layouts tab)
  // A layout is a folder with an index.html; BeeboScore's overlay client goes into the page by itself, so a creator only
  // writes HTML with data-sb bindings (public/starter-layout shows how). One of the app's own layouts is never
  // replaced or removed; a layout you remove or replace goes to data/removed-layouts, never straight in the bin.
  const REMOVED_DIR = path.join(DATA_DIR, 'removed-layouts');
  const STARTER_DIR = path.join(PUBLIC_DIR, 'starter-layout');
  const isBuiltIn = name => !!safeName(name) && fs.existsSync(path.join(BUNDLE_DIR, 'overlays', safeName(name), 'index.html'));
  const layoutError = (msg, status, extra) => Object.assign(new Error(msg), { status }, extra || {});
  function retireLayout(name) {
    const src = overlayDir(name); if (!fs.existsSync(src)) return '';
    const d = new Date(), z = n => String(n).padStart(2, '0'), when = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
    fs.mkdirSync(REMOVED_DIR, { recursive: true });
    let dst = path.join(REMOVED_DIR, `${safeName(name)} ${when}`), i = 2; while (fs.existsSync(dst)) dst = path.join(REMOVED_DIR, `${safeName(name)} ${when} (${i++})`);
    try { fs.renameSync(src, dst); } catch { copyDir(src, dst); fs.rmSync(src, { recursive: true, force: true }); }
    return dst;
  }
  function fallbackLayout(not) {          // what goes live when the live layout is removed: the app's own layout for the game being played
    const all = listOverlays().filter(o => o.name !== not && o.builtIn && !o.format);
    return ((all.find(o => o.game === state.game) || all[0]) || {}).name || '';
  }
  function importLayout({ files, title, game, replace, fileName }) {
    const prep = layoutImport.prepareLayout(files);
    const t = String(title || prep.meta.title || layoutImport.titleFrom(prep.top) || layoutImport.titleFrom(fileName) || layoutImport.titleFrom(prep.entry) || 'My layout').trim().slice(0, 60);
    const name = layoutImport.slugify(t) || 'my-layout';
    if (isBuiltIn(name)) throw layoutError(`“${t}” is the name of one of the app’s own layouts. Give yours another name.`, 409, { code: 'builtin' });
    const dir = overlayDir(name), had = fs.existsSync(dir);
    if (had && !replace) throw layoutError(`You already have a layout called “${t}”.`, 409, { code: 'exists', layout: name });
    const old = had ? retireLayout(name) : '';
    const meta = { ...prep.meta };
    for (const k of ['order', 'gen', 'version', 'base', 'format', 'family', 'imported']) delete meta[k];        // it's one look of its own, never part of one of the app's families
    meta.title = t;
    meta.game = GAMES.includes(game) ? game : GAMES.includes(meta.game) ? meta.game : 'Any game';      // picked in the tab, else what the creator says it's for
    if (meta.description != null) meta.description = String(meta.description).slice(0, 240);
    if (meta.author != null) meta.author = String(meta.author).slice(0, 60);
    if (!Array.isArray(meta.colors)) delete meta.colors;
    meta.imported = new Date().toISOString();
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (const f of prep.files) {
        if (f.path.toLowerCase() === 'overlay.json') continue;
        const dest = resolveInside(dir, f.path); if (!dest) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, f.data);
      }
      writeJSON(path.join(dir, 'overlay.json'), meta);
    } catch (e) {                          // half a layout is no use: put back what was there
      try { fs.rmSync(dir, { recursive: true, force: true }); if (old) fs.renameSync(old, dir); } catch {}
      throw layoutError('Couldn’t save the layout: ' + e.message, 500);
    }
    overlaysChanged();
    broadcast('reload', { overlay: name });
    return { ok: true, name, title: t, game: meta.game, files: prep.files.length, reads: prep.reads, skipped: prep.skipped.slice(0, 12), skippedCount: prep.skipped.length, replaced: had };
  }
  function folderZip(dir, prefix = '') {
    return zip.writeZip(walkFiles(dir).filter(f => !/(^|\/)(\.DS_Store|Thumbs\.db)$/i.test(f)).map(f => ({ path: prefix + f, data: fs.readFileSync(path.join(dir, f)) })));
  }
  function sendZip(res, buf, fileName) {
    const ascii = fileName.replace(/[^\w\- .()]+/g, '').trim() || 'layout.zip';
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': buf.length, 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}` });
    res.end(buf);
  }

  // 1.5.3: only the Classic layouts are built in. Layouts left in the overlays folder by older builds (Frostbite, Venom,
  // Obsidian Glass and the rest of the full BeeboScore's looks, and their format versions) cluttered the Layout menu: once,
  // every folder that is neither one of the app's own nor one you imported on the Layouts tab moves to
  // data/retired-layouts (kept, never deleted; import it again from there if you want it back).
  if (!config.oldLayoutsSwept && !opts.overlaysDir && path.resolve(BUNDLE_DIR, 'overlays') !== path.resolve(OVERLAYS_DIR)) {
    const moved = [];
    try {
      for (const ent of fs.readdirSync(OVERLAYS_DIR, { withFileTypes: true })) {
        if (!ent.isDirectory() || isBuiltIn(ent.name)) continue;
        const dir = path.join(OVERLAYS_DIR, ent.name);
        if (readJSON(path.join(dir, 'overlay.json'), {}).imported) continue;            // yours: stays
        let to = path.join(DATA_DIR, 'retired-layouts', ent.name), i = 2;
        while (fs.existsSync(to)) to = path.join(DATA_DIR, 'retired-layouts', `${ent.name} (${i++})`);
        try { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(dir, to); moved.push(ent.name); }
        catch { try { copyDir(dir, to); fs.rmSync(dir, { recursive: true, force: true }); moved.push(ent.name); } catch {} }
      }
      const seeded = readJSON(SEEDED_FILE, {}); let ch = false;
      for (const n of moved) if (n in seeded) { delete seeded[n]; ch = true; }
      if (ch) writeJSON(SEEDED_FILE, seeded);
    } catch {}
    if (!overlayExists(config.activeOverlay)) {          // the live layout was one of them: the app's own for the game goes live
      const g = readJSON(STATE_FILE, {}).game, own = ({ 'Street Fighter 6': 'sf6-default', 'Avatar Legends': 'avatar-default', 'Fatal Fury: City of the Wolves': 'fatalfury-default' })[g] || 'tekken8-default';
      config.activeOverlay = overlayExists(own) ? own : 'tekken8-default';
    }
    config.oldLayoutsSwept = true; writeJSON(CONFIG_FILE, config);
    if (moved.length) { overlayCache = null; console.log(`  Moved ${moved.length} old layout${moved.length === 1 ? '' : 's'} to data/retired-layouts: ${moved.join(', ')}`); }
  }
  if (!overlayExists(config.activeOverlay)) {
    config.activeOverlay = ['tekken8-default', 'tekken8-shattered'].find(overlayExists) || (listOverlays()[0] || {}).name || 'tekken8-default';   // 1.12.5: the Default layout first
  }

  // ------------------------------------------------------------ layout families × game formats
  function variantOf(name) {             // a format version of a layout: drawn from its base layout's page
    const m = readJSON(path.join(overlayDir(name), 'overlay.json'), {});
    return m.base && safeName(m.base) !== name && overlayExists(m.base) ? { base: safeName(m.base), format: FORMAT_KEYS.includes(m.format) ? m.format : '' } : null;
  }
  // Layout Designer layouts get their game-format versions too (written when the layout is saved): the format pieces
  // come from sb-format.js, and its lives / crown / team info shows as a tag under each player bar
  const FORMAT_LABELS = { crew: 'Crew battle', sajam: 'Team battle', gauntlet: 'Gauntlet', tdb: 'Team Death Battle', death: 'Death Battle', koth: 'King of the Hill', league: 'League' };
  // a Designer layout made in one of the built-in looks: the format bar, the sidebars and the join splash wear that look too
  const designNonces = new Map();         // recent Designer saves, by the id the page gave them
  const EL_LOOKS = ['frostbite', 'venom', 'royal', 'crimson', 'goldrush', 'sakura', 'tidal', 'voltage', 'chrome', 'pastel'];
  function lookMeta(look) {
    const l = String(look || '').toLowerCase();
    if (EL_LOOKS.includes(l)) return `\n<meta name="el-theme" content="${l}">\n<script src="/static/el/formats.js"></script>`;
    if (l === 'oni' || l === 'shattered' || l === 'ember' || l === 'porcelain' || l === 'default') return `\n<meta name="sb-look" content="${l}">`;
    return '';
  }
  function writeVariants(name, { title, game, colors, on }) {
    const made = [];
    for (const f of FORMAT_KEYS) {
      const vn = safeName(`${name}-${f}`), dir = overlayDir(vn), meta = readJSON(path.join(dir, 'overlay.json'), null), mine = !!(meta && meta.base === name);
      if (!on) { if (mine) fs.rmSync(dir, { recursive: true, force: true }); continue; }
      if (meta && !mine) continue;                       // another layout already has that name
      fs.mkdirSync(dir, { recursive: true });
      writeJSON(path.join(dir, 'overlay.json'), { title: `${title} — ${FORMAT_LABELS[f]}`, game, family: title, format: f, base: name, auto: true, colors,
        description: `${title}, drawn for ${FORMAT_LABELS[f]}: the format bar, splashes and moments, and the format info under each player bar. Change the look in the Layout Designer.` });
      fs.writeFileSync(path.join(dir, 'index.html'), `<!-- BeeboScore: "${title} — ${FORMAT_LABELS[f]}" is the ${title} layout drawn for ${FORMAT_LABELS[f]}. It's made from that layout every time you save it in the Layout Designer — edit that one. -->\n`);
      made.push(vn);
    }
    return made;
  }
  function asVariant(html, v) {
    html = html.replace(/<meta[^>]+name=["']sb-format["'][^>]*>/ig, '');
    const tag = `<meta name="sb-format" content="${v.format || 'splash'}"><meta name="sb-variant" content="${v.format}">`;
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + tag) : tag + html;
  }
  /** the family member that fits a format ('' = the plain layout) */
  function layoutFor(name, fmt) {
    const all = listOverlays(), cur = all.find(o => o.name === name); if (!cur) return name;
    const fam = all.filter(o => o.family === cur.family && o.game === cur.game);
    return (fam.find(o => o.format === (fmt || '')) || fam.find(o => !o.format) || cur).name;
  }
  function followFormat() {             // a format was picked / cleared: the live layout switches to that format's version of the same look
    if (config.settings.followFormat === false) return;
    const f = state.format, want = layoutFor(config.activeOverlay, f ? f.preset : '');
    if (want && want !== config.activeOverlay) setActive(want);
  }
  function setActive(name) {
    config.activeOverlay = safeName(name);
    saveConfig();
    if (vt) setTimeout(() => { try { hub.broadcast('vtpub', vtPublic()); } catch {} }, 0);      // the sidebar follows the layout's look
    broadcast('config', { activeOverlay: config.activeOverlay });
    broadcast('active-changed', { overlay: config.activeOverlay });
    broadcast('overlays', listOverlays());
  }

  // 1.12.16: overlays that can't use the effects engines (effects Off, potato mode) load the lite bundle (?engines: never);
  // switching the effects back on reloads them (seamlessly) so the engines come back
  const fxNow = () => { const fq = ['auto', 'full', 'light', 'off', 'ultra'].includes(config.settings.fxQuality) ? config.settings.fxQuality : 'auto'; return fq === 'auto' && config.settings.lightFx ? 'light' : fq; };
  const liteFx = () => fxNow() === 'off';
  let liteWas = (() => { try { return liteFx(); } catch { return null; } })();
  function liteWatch() { const l = liteFx(); if (liteWas === true && !l) setTimeout(() => broadcast('reload', { ifLite: true }), 300); liteWas = l; }      // only pages that came without the engines reload
  function injectOverlay(html, name, follow, mode = {}) {
    let base = `<base href="/o/${encodeURIComponent(mode.assets || name)}/">`;
    if ((mode.potato || liteFx()) && !mode.engines) { html = html.replace(/\/sb-design\.js\?v=/g, '/sb-design.js?lite&v='); base += '<script>window.__SB_LITE_BUNDLE=true</script>'; }
    if (config.settings.lightFx && !mode.potato) base += `<script>document.documentElement.classList.add('sb-light')</script>`;
    // BeeboFX starts at the chosen quality, so a layout's backdrops are taken over from its very first frame
    { const fq = ['auto', 'full', 'light', 'off', 'ultra'].includes(config.settings.fxQuality) ? config.settings.fxQuality : 'auto'; base += `<script>window.__SB_GFXQ=${JSON.stringify(fq === 'auto' && config.settings.lightFx ? 'light' : fq)};window.__SB_LAPTOP=${!!config.settings.laptopMode}</script>`; }
    if (mode.instant && !mode.framed && !mode.potato) base += '<style>html.sb-instant body{opacity:0!important}</style>';   // a soft reload: shown once drawn, faded in
    if (mode.framed || mode.instant || mode.potato) base += `<script>${mode.framed ? 'window.__SB_FRAMED=true;' : ''}${mode.instant ? "window.__SB_INSTANT=true;document.documentElement.classList.add('sb-instant');" : ''}${mode.soft ? 'window.__SB_SOFT=true;' : ''}${mode.potato ? "window.__SB_POTATO=true;document.documentElement.classList.add('sb-potato');" : ''}</script>`;
    const script = `<script>window.__SB_OVERLAY=${JSON.stringify(name)};window.__SB_FOLLOW_ACTIVE=${!!follow};</script><script src="/sb-fps.js?v=${V}"></script><script src="/static/beebo-icons.js?v=${V}"></script><script>window.BI&&BI.style()</script><script src="/sb-perf.js?v=${V}"></script><script src="/sb-client.js?v=${V}"></script><script src="/sb-vs.js?v=${V}"></script><script src="/sb-bracket.js?v=${V}"></script><script src="/sb-skin.js?v=${V}"></script><script src="/sb-vtjoin.js?v=${V}"></script><script src="/sb-comm.js?v=${V}"></script><script src="/sb-brand.js?v=${V}"></script><script src="/sb-fullvs.js?v=${V}"></script><script src="/sb-showcards.js?v=${V}"></script><script src="/sb-i18n.js?v=${V}"></script><script src="/sb-show.js?v=${V}"></script>${SHOW ? SHOW.ext.active().filter(e => e.js).map(e => `<script src="/ext/${e.id}/overlay.js?v=${V}"></script>`).join('') : ''}<script src="/sb-victory.js?v=${V}"></script><script src="/sb-sound.js?v=${V}"></script><script src="/sb-key.js?v=${V}"></script>` + (/<meta[^>]+name=["']sb-format["']/i.test(html) ? `<script src="/sb-format.js?v=${V}"></script><script src="/sb-hud.js?v=${V}"></script><script src="/sb-story.js?v=${V}"></script>` : '');
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + base) : base + html;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, script + '</body>') : html + script;
    return html;
  }

  // Seamless host: two stacked iframes. A refresh loads a fresh copy (intro skipped) into the
  // hidden one and swaps when it reports it's drawn — OBS never sees a blank or half-built frame.
  function hostPage(name, follow) {
    const src = '/overlay' + (name ? '/' + encodeURIComponent(name) : '');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BeeboScore overlay</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
iframe{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal}
iframe{transition:opacity .45s ease}iframe.next{opacity:0;pointer-events:none}iframe.old{pointer-events:none}</style></head><body>
<script>(() => {
  const SRC = ${JSON.stringify(src)}, NAME = ${JSON.stringify(name)}, FOLLOW = ${!!follow};
  const extra = location.search.slice(1);
  window.__sbViewer = Math.random().toString(36).slice(2, 12);   // one viewer, even while two copies swap
  let cur = null, next = null, nextTimer = null, active = null;
  const url = instant => SRC + '?sbframe' + (instant ? '&instant=soft' : '') + (extra ? '&' + extra : '') + '&t=' + Date.now();   // soft: a live copy that only skips its intro (1.12.21)
  function frame(instant) {
    const f = document.createElement('iframe');
    f.setAttribute('allowtransparency', 'true'); f.setAttribute('scrolling', 'no'); f.tabIndex = -1;
    f.src = url(instant); return f;
  }
  function syncPause(f) {          // keep the control panel's "pause preview animations" working
    try {
      const mine = document.getElementById('__sbpause'), d = f.contentDocument; if (!d || !d.head) return;
      const theirs = d.getElementById('__sbpause');
      if (mine && !theirs) { const s = d.createElement('style'); s.id = '__sbpause'; s.textContent = mine.textContent; d.head.appendChild(s); }
      if (!mine && theirs) theirs.remove();
    } catch (e) {}
  }
  window.__sbSyncPause = () => { if (cur) syncPause(cur); if (next) syncPause(next); };
  function promote() {
    clearTimeout(nextTimer);
    if (!next) return;
    const old = cur; cur = next; next = null;
    cur.classList.remove('next');
    // the fresh copy fades in over the old one (both show the same thing by now), then the old one goes
    if (old) { old.classList.add('old'); setTimeout(() => old.remove(), 520); }
  }
  function refresh() {
    if (next) { clearTimeout(nextTimer); next.remove(); }
    next = frame(true); next.className = 'next';
    next.addEventListener('load', () => syncPause(next));
    document.body.appendChild(next);
    nextTimer = setTimeout(promote, 4000);        // never wait forever on a broken layout
  }
  // 1.12: swap only when the copy on air is quiet — not mid-transition (a splash coming or going, a name changing, a
  // plate mending) — so a refresh never cuts an animation short. Looping effects don't count; gives up waiting after 8 s.
  function busy(f) {
    try {
      const d = f && f.contentDocument; if (!d || !d.getAnimations) return false;
      return d.getAnimations().some(a => a.playState === 'running' && a.id !== 'sb-relay' && a.effect && a.effect.getComputedTiming().iterations !== Infinity
        && (a.effect.getComputedTiming().endTime || 0) - (a.currentTime || 0) > 60);
    } catch (e) { return false; }
  }
  let quietSince = 0;
  function promoteWhenQuiet(t0) {
    if (!next) return;
    if (busy(cur) && Date.now() - t0 < 8000) { quietSince = 0; return setTimeout(() => promoteWhenQuiet(t0), 120); }
    if (!quietSince) quietSince = Date.now();
    if (Date.now() - quietSince < 240 && Date.now() - t0 < 8000) return setTimeout(() => promoteWhenQuiet(t0), 120);
    quietSince = 0; promote();
  }
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.sb !== 'ready') return;
    if (next && e.source === next.contentWindow) { clearTimeout(nextTimer); nextTimer = setTimeout(promote, 9000); promoteWhenQuiet(Date.now()); }
  });
  cur = frame(false); cur.addEventListener('load', () => syncPause(cur)); document.body.appendChild(cur);

  const onMsg = m => {
    if (m.type === 'reload' && m.data && m.data.ifLite) { let lite = true; try { lite = !!(cur && cur.contentWindow && cur.contentWindow.__SB_LITE_BUNDLE); } catch (e) {} if (lite) refresh(); }      // 1.12.16
    else if (m.type === 'reload' && (!m.data || !m.data.overlay || m.data.overlay === (NAME || active))) refresh();
    else if (m.type === 'active-changed' && FOLLOW && m.data && m.data.overlay !== active) { active = m.data.overlay; refresh(); }
  };
  // realtime: WebSocket, falling back to polling
  let wsOk = false, poll = null, rev = null;
  function startPoll() {
    if (poll) return;
    const tick = async () => {
      try {
        const r = await fetch('/api/live?o=' + encodeURIComponent(NAME || active || ''), { cache: 'no-store' });
        const d = await r.json();
        if (active === null) active = d.active;
        if (FOLLOW && d.active && d.active !== active) { active = d.active; rev = null; return refresh(); }
        if (rev !== null && d.rev !== rev) refresh();
        rev = d.rev;
      } catch (e) {}
    };
    tick(); poll = setInterval(tick, 1000);
  }
  function connect() {
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return startPoll(); }
    const fb = setTimeout(() => { if (!wsOk) startPoll(); }, 4000);
    ws.onmessage = e => {
      if (!wsOk) { wsOk = true; clearTimeout(fb); clearInterval(poll); poll = null; rev = null; }
      try { const m = JSON.parse(e.data); if (m.type === 'config' && active === null) active = m.data.activeOverlay; onMsg(m); } catch (err) {}
    };
    ws.onclose = () => { clearTimeout(fb); if (wsOk) { wsOk = false; setTimeout(connect, 1000); } else { startPoll(); setTimeout(connect, 15000); } };
  }
  fetch('/api/live?o=', { cache: 'no-store' }).then(r => r.json()).then(d => { if (active === null) active = d.active; }).catch(() => {});
  connect();
})();</script></body></html>`;
  }

  let watchTimer = null;
  const changedOverlays = new Set();
  try {
    fs.watch(OVERLAYS_DIR, { recursive: true }, (_evt, file) => {
      if (!file) return;
      changedOverlays.add(String(file).split(/[\\/]/)[0]);
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        for (const n of changedOverlays) broadcast('reload', { overlay: n });
        changedOverlays.clear();
        overlaysChanged();
      }, 150);
    });
  } catch { /* overlays still reload when saved from the app */ }

  // ------------------------------------------------------------ backups (lib/backup.js): never any passwords or sign-ins
  const BACKUP_DIR = path.join(DATA_DIR, 'backups');
  function userLayouts() {
    const same = (a, b) => { try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch { return false; } };
    return listOverlays().filter(o => !o.bundled || !['index.html', 'overlay.json'].every(f => same(path.join(OVERLAYS_DIR, o.name, f), path.join(BUNDLE_DIR, 'overlays', o.name, f)))).map(o => o.name);
  }
  const makeBackup = () => backup.create({ dataDir: DATA_DIR, overlaysDir: OVERLAYS_DIR, config, appVersion: APP_VERSION, userLayouts: userLayouts() });
  function dailyBackup() { try { return backup.daily(BACKUP_DIR, makeBackup); } catch (e) { console.error('auto backup:', e.message); return []; } }
  setTimeout(dailyBackup, 20000).unref();
  setInterval(dailyBackup, 6 * 3600 * 1000).unref();

  // ------------------------------------------------------------ auth (remote access)
  const sessions = new Map();
  const sessionWho = new Map();          // 1.12.18: token → { role, id, name } (the TO's password: role 'to')
  const loginAttempts = new Map();
  let globalFails = [];
  if (process.env.ADMIN_PASSWORD) config.passwordHash = hashPw(process.env.ADMIN_PASSWORD);

  function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
    return `${salt}:${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
  }
  function checkPw(pw, stored) {
    if (!stored) return false;
    const [salt, h] = stored.split(':');
    const a = crypto.scryptSync(String(pw), salt, 32), b = Buffer.from(h, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  function isPrivateIp(ip) {
    ip = String(ip || '').replace(/^::ffff:/, '');
    return ip === '::1' || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^169\.254\./.test(ip) || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  }
  // Three levels of trust:
  //   host   — this PC (loopback, not through a proxy/tunnel): full control incl. admin settings
  //   lan    — a phone/tablet on your own network: controls the scoreboard (no password if allowed)
  //   remote — anything through the internet (tunnel / cloud): must sign in
  function viaProxy(req) {
    const h = req.headers;
    return !!(h['cf-connecting-ip'] || h['x-forwarded-for'] || h['x-forwarded-host'] || h['cf-ray'] || h['forwarded']);
  }
  function isHost(req) {
    if (CLOUD || viaProxy(req)) return false;
    const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    return ip === '::1' || /^127\./.test(ip);
  }
  function isLan(req) {
    if (CLOUD || viaProxy(req) || isHost(req)) return false;
    return isPrivateIp(req.socket.remoteAddress);
  }
  const isLocal = isHost;

  // DNS-rebinding guard: only answer to host names that can really point at this app.
  const EXTRA_HOSTS = String(process.env.ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  function hostAllowed(req) {
    if (CLOUD) return true;
    const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (host === 'localhost' || host === '::1' || /^127\./.test(host) || isPrivateIp(host)) return true;
    if (/\.trycloudflare\.com$/.test(host)) return true;                      // Go online
    if (config.namedTunnel && config.namedTunnel.host && host === config.namedTunnel.host) return true;   // your own permanent address
    if (!host.includes('.') || /\.(local|lan|home\.arpa|internal)$/.test(host)) return true; // PC name on your network
    return EXTRA_HOSTS.includes(host);
  }
  // Cross-site request guard: state-changing calls must come from this app's own pages.
  function sameOrigin(req) {
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') return false;
    const origin = req.headers.origin;
    if (!origin) return true; // non-browser clients (curl, scripts on this PC)
    try { return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase(); } catch { return false; }
  }
  function cookies(req) {
    return Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  }
  function isAuthed(req) {
    if (isHost(req)) return true;
    if (isLan(req) && config.settings.lanNoPassword) return true;
    const tok = cookies(req).sb_session;
    const exp = tok && sessions.get(tok);
    const who = tok && sessionWho.get(tok);
    if (exp && who && who.id && SHOW && !SHOW.team.has(who.id)) { sessions.delete(tok); sessionWho.delete(tok); return false; }   // removed from the team
    if (exp && exp > Date.now()) return true;
    if (exp) { sessions.delete(tok); sessionWho.delete(tok); }
    return false;
  }
  /** 1.12.18: what this request may do — 'to' (everything), 'operator' or 'caster' (team accounts) */
  function roleOf(req) {
    if (isHost(req) || (isLan(req) && config.settings.lanNoPassword)) return 'to';
    const w = sessionWho.get(cookies(req).sb_session || ''); return w && w.role ? w.role : 'to';
  }
  const whoOf = req => sessionWho.get(cookies(req).sb_session || '') || null;
  function dropSessions(id) { if (!id) return; for (const [t, w] of sessionWho) if (w.id === id) { sessionWho.delete(t); sessions.delete(t); } }
  function activeSessions() { const now = Date.now(); for (const [k, v] of sessions) if (v <= now) sessions.delete(k); return sessions.size; }
  function clientIp(req) { return req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress; }

  // ------------------------------------------------------------ start.gg + tunnel + updates
  const tunnel = new Tunnel(BIN_DIR, s => { broadcast('tunnel', s); if (s.state === 'online' || s.state === 'off') { clearTimeout(shareHtmlT); shareHtmlT = setTimeout(writeShareHtml, 500); hub.broadcastWhere(c => c.meta.authed, 'share', shareStatus()); } });
  let sggBusy = false;
  const updater = opts.updater || null; // provided by the desktop app
  if (updater && updater.onStatus) updater.onStatus(s => broadcast('update', s));
  if (updater && updater.configure) updater.configure(config.settings);

  const regionNames = (() => {
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      const map = {};
      const skip = new Set('AN BU CS CT DD DY EU EZ FX HV JT MI NH NQ NT PC PU PZ QO RH SU TP UK UN VD WK YD YU ZR'.split(' '));
      for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        if (skip.has(code)) continue;
        const n = dn.of(code);
        if (n && n !== code && !map[n.toLowerCase()]) map[n.toLowerCase()] = code.toLowerCase();
      }
      Object.assign(map, { 'united states of america': 'us', usa: 'us', 'korea, republic of': 'kr', 'republic of korea': 'kr', korea: 'kr', 'united kingdom of great britain and northern ireland': 'gb', england: 'gb', scotland: 'gb', wales: 'gb', russia: 'ru', 'russian federation': 'ru', taiwan: 'tw', 'viet nam': 'vn', turkey: 'tr' });
      return map;
    } catch { return {}; }
  })();
  const countryCode = name => regionNames[String(name || '').trim().toLowerCase()] || '';

  function sggStatus() {
    const s = config.startgg || {};
    return {
      hasToken: !!s.token, tokenHint: s.token ? '••••' + s.token.slice(-4) : '', account: sggAuth.status(),
      link: s.link || '', tournament: s.tournament || null, eventId: s.eventId || null,
      entrants: sggEntrants.length, importedAt: s.importedAt || null, busy: sggBusy,
    };
  }

  async function importEntrants() {
    const s = config.startgg;
    if (!s.eventId) throw new Error('Pick an event first.');
    sggBusy = true; broadcast('startgg', sggStatus());
    try {
      const list = await startgg.loadEntrants(sggTok(), s.eventId, (pg, total) => broadcast('startgg-progress', { page: pg, total }));
      sggEntrants = list.map(e => ({ name: e.name, team: e.team, pronouns: e.pronouns, country: countryCode(e.countryName), avatar: e.avatar || '', entrantId: e.entrantId, socials: e.socials || null }));
      try { if (SHOW) SHOW.fromStartgg(sggEntrants); } catch {}           // 1.12.18: player profiles
      saveLater(STARTGG_FILE, () => sggEntrants, 0);
      s.importedAt = Date.now();
      saveConfig();
    } finally {
      sggBusy = false;
      broadcast('startgg', sggStatus());
      broadcast('players', allPlayers());
    }
  }

  // ------------------------------------------------------------ http helpers
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream',
  };
  const JSON_TYPE = 'application/json; charset=utf-8';
  // JSON responses are always valid JSON (a bare string here caused the "Unexpected token" error).
  function send(res, code, body, type = JSON_TYPE, headers = {}) {
    if (type === JSON_TYPE && !Buffer.isBuffer(body)) body = JSON.stringify(body === undefined ? null : body);
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  }
  const ok = (res, data = { ok: true }) => send(res, 200, data);
  const fail = (res, code, error) => send(res, code, { error });
  function readBody(req, limit = 100 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Upload too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function readJSONBody(req) {
    const b = await readBody(req);
    if (!b.length) return {};
    try { return JSON.parse(b.toString('utf8')); } catch { throw Object.assign(new Error('Invalid request body.'), { status: 400 }); }
  }


  // ------------------------------------------------------------ Twitch Stuff: chat + viewer matches
  // config.twitch = { channel, connect (stay connected), clientId (advanced), auth { access, refresh, expiresAt, login }, prefs, art }
  const VIEWERS_FILE = path.join(DATA_DIR, 'viewers.json');
  const TW_DIR = path.join(DATA_DIR, 'twitch');
  config.twitch = { channel: '', connect: false, prefs: {}, ...(config.twitch || {}) };
  const twClientId = () => String(config.twitch.clientId || TWITCH_CLIENT_ID || '').trim();
  const chat = new twitch.TwitchChat();
  const twActivity = [];                      // recent joins / commands for the panel's feed
  let twLogin = null;                         // a sign-in in progress { userCode, url, expiresAt }
  const vm = createViewerMatches({
    data: readJSON(VIEWERS_FILE, null), prefs: config.twitch.prefs,
    save: d => saveLater(VIEWERS_FILE, () => d, 300),
    changed: why => viewersChanged(why),
    say: t => chat.say(t),
    channel: () => chat.channel || config.twitch.channel || '',
    findAvatars: async logins => { const a = await twAuth(); return twitch.avatars(logins, { clientId: twClientId(), access: a && a.access }); },
  });
  function twStatus() {
    const a = config.twitch.auth;
    return {
      chat: chat.status(), channel: config.twitch.channel || '', connect: !!config.twitch.connect,
      signedIn: !!(a && a.access), login: a && a.login || '', canSignIn: !!twClientId(), clientIdSet: !!config.twitch.clientId, builtInClientId: !!TWITCH_CLIENT_ID,
      signingIn: twLogin ? { code: twLogin.userCode, url: twLogin.url, expiresAt: twLogin.expiresAt } : null,
      art: config.twitch.art || null, activity: twActivity.slice(0, 30), viewers: vm.fullView(),
      extra: twHasExtra(),          // 1.12.18: Predictions and channel points allowed
    };
  }
  let twPushTimer = null;
  function twPush() {          // the panel gets everything, overlays get the public part
    clearTimeout(twPushTimer);
    twPushTimer = setTimeout(() => {
      hub.broadcastWhere(c => c.meta.authed, 'twitch', twStatus());
      hub.broadcast('viewers', viewersPublic());
    }, 30);
  }
  function viewersPublic() { const ca = config.twitch.channelAvatar; return { ...vm.publicView(), streamerAvatar: ca && ca.login === (chat.channel || config.twitch.channel) ? ca.url : '', art: config.twitch.art ? { v: config.twitch.art.at, type: config.twitch.art.type, chroma: !!config.twitch.art.chroma, tol: config.twitch.art.tol ?? 40 } : null }; }
  let splashTimer = null;
  // 1.12.6: King of the Hill with viewers — while it runs and "Challengers from the Twitch queue" is on (Format tab), the
  // next viewers in the queue step into the King of the Hill line so there are always two waiting
  let kothPullT = null;
  function kothPullViewers() {
    clearTimeout(kothPullT);
    kothPullT = setTimeout(() => {
      try {
        const f = state.format; if (!f || f.preset !== 'koth' || f.status !== 'live' || !config.settings.kothViewers) return;
        const d = vm.data, waiting = () => (state.format.fighters || []).filter(x => !x.out && state.format.king !== x.id && !(state.format.match && (state.format.match.a === x.id || state.format.match.b === x.id))).length;
        let g = 0;
        while (waiting() < 2 && d.queue && d.queue.length && g++ < 4) {
          const q = d.queue[0], name = String(q.display || q.login || '').trim(); vm.remove(q.login);
          if (!name || (state.format.fighters || []).some(x => same(x.name, name))) continue;
          kothViewers[name.toLowerCase()] = true;
          setFormat(FMT.join(state.format, { name, avatar: q.avatar || '' }), { load: false });
        }
      } catch (e) { console.error('koth viewers:', e.message); }
    }, 200);
  }
  function viewersChanged(why) {
    kothPullViewers();
    const d = vm.data;
    // the VS splash hides by itself after a few seconds (0 = stays until you hide it)
    if (why === 'splash' || why === 'next') {
      clearTimeout(splashTimer);
      const hold = vm.prefs.splashHold;
      if (d.splash.show && hold) splashTimer = setTimeout(() => vm.hideSplash(), (hold + 1.1) * 1000);   // + the ~1 s entrance
    }
    // optional: put the viewer match on the main scoreboard too (P1 = streamer, P2 = viewer)
    if (vm.prefs.sync && d.current && ['next', 'result', 'undo'].includes(why)) {
      const c = d.current, me = vm.prefs.streamerName || chat.channel || config.twitch.channel || 'Streamer';
      const want = { p1: { name: me, score: c.s }, p2: { name: c.display, score: c.v, avatar: c.avatar || '' } };
      if (state.p1.name !== me || state.p2.name !== c.display || Number(state.p1.score) !== c.s || Number(state.p2.score) !== c.v) {
        setState(why === 'next' ? { round: 'Viewer Battle', p1: { ...blankPlayer(), ...want.p1 }, p2: { ...blankPlayer(), ...want.p2 } } : want);
      }
    }
    writeViewerTexts();
    twPush();
  }
  // OBS Text sources: viewer_opponent.txt, viewer_queue.txt, viewer_record.txt, viewer_join.txt
  let vtTimer = null; const lastVt = {};
  function writeViewerTexts() {
    clearTimeout(vtTimer);
    vtTimer = setTimeout(async () => {
      const v = vm.publicView(), c = v.current;
      const out = {
        viewer_opponent: c ? c.display : '', viewer_match_score: c ? `${c.s} - ${c.v}` : '',
        viewer_record: c ? `${c.rec.w}W - ${c.rec.l}L` : '', viewer_session: `${v.session.s} - ${v.session.v}`,
        viewer_queue: v.queue.map((q, i) => `${i + 1}. ${q.display}`).join('\n'), viewer_queue_count: String(v.count),
        viewer_join: v.open ? `Type ${v.joinCmd} to play` : 'Queue closed',
      };
      try { await fsp.mkdir(OUTPUT_DIR, { recursive: true }); } catch {}
      for (const [k, val] of Object.entries(out)) { if (lastVt[k] === val) continue; lastVt[k] = val; fsp.writeFile(path.join(OUTPUT_DIR, k + '.txt'), val).catch(() => {}); }
    }, 120);
  }
  function twNote(kind, text) {
    twActivity.unshift({ kind, text: String(text).slice(0, 140), at: Date.now() });
    if (twActivity.length > 40) twActivity.length = 40;
  }
  chat.on('status', st => {
    if (st.state === 'live') {
      twNote('ok', `Connected to #${st.channel}'s chat${st.canSend ? ` as ${st.as}` : ' (read only)'}`);
      const ca = config.twitch.channelAvatar;            // your own Twitch picture: the VS splash uses it if you haven't uploaded one
      if (!ca || ca.login !== st.channel || Date.now() - (ca.at || 0) > 7 * 864e5) {
        twAuth().then(a => twitch.avatars([st.channel], { clientId: twClientId(), access: a && a.access })).then(got => {
          if (got[st.channel]) { config.twitch.channelAvatar = { login: st.channel, url: got[st.channel], at: Date.now() }; saveConfig(); twPush(); }
        }).catch(() => {});
      }
    }
    twPush();
  });
  chat.on('auth-failed', () => { twNote('err', 'Twitch sign-in was refused — reading chat without it. Sign in again to reply.'); config.twitch.auth = null; saveConfig(); twPush(); });
  chat.on('message', m => {
    if (SHOW && SHOW.onChat(m)) return;          // 1.12.18: !pick and !vote (and the hype meter counts every message)
    if (bracketChat(m)) return;
    if (vtChat(m)) return;
    const r = vm.onChat(m);
    if (!r) return;
    const what = { join: r.ok ? 'joined the queue' : r.code === 'closed' ? 'tried to join (queue closed)' : r.code === 'full' ? 'tried to join (queue full)' : r.code === 'subs' ? 'tried to join (subs only)' : r.code === 'played' ? 'tried to join again (already played)' : 'is already in the queue',
      leave: 'left the queue', queue: 'asked about the queue' }[r.command] || `used ${vm.prefs.commands[r.command].split(' ')[0]}`;
    twNote(r.ok ? (r.command === 'join' ? 'join' : 'cmd') : 'muted', `${m.display} ${what}`);
    twPush();
  });
  /** a fresh access token (refreshed when it's close to expiring), or null when not signed in */
  let twRefreshing = null;
  async function twAuth() {
    const a = config.twitch.auth;
    if (!a || !a.access) return null;
    if (a.expiresAt && a.expiresAt - Date.now() > 5 * 60 * 1000) return a;
    if (!a.refresh || !twClientId()) return a;
    if (!twRefreshing) twRefreshing = (async () => {
      try { const t = await twitch.refreshLogin(twClientId(), a.refresh); config.twitch.auth = { ...a, ...t }; saveConfig(); chat.setAuth(config.twitch.auth); }
      catch (e) { if (!/fetch|network|abort/i.test(e.message)) { config.twitch.auth = null; saveConfig(); chat.setAuth(null); twNote('err', 'Twitch sign-in expired — sign in again to reply in chat.'); twPush(); } }
      finally { twRefreshing = null; }
    })();
    await twRefreshing;
    return config.twitch.auth;
  }
  async function twConnect() {
    const a = await twAuth().catch(() => null);
    chat.connect(config.twitch.channel, a);
  }
  if (config.twitch.connect && config.twitch.channel) setTimeout(() => twConnect().catch(() => {}), 1500);
  const twTimer = setInterval(() => { if (config.twitch.auth) twAuth().catch(() => {}); }, 20 * 60 * 1000); twTimer.unref && twTimer.unref();
  async function twStartLogin(extra) {
    const id = twClientId();
    if (!id) throw new Error('Signing in needs a Twitch app Client ID (see Advanced).');
    const scopes = extra ? `${twitch.SCOPES} ${twitch.EXTRA_SCOPES}` : twitch.SCOPES;        // 1.12.18: Predictions and channel points only when asked for
    const d = await twitch.startDeviceLogin(id, scopes);
    const me = twLogin = { ...d, expiresAt: Date.now() + d.expiresIn * 1000 };
    twPush();
    (async () => {
      let wait = d.interval * 1000;
      while (twLogin === me && Date.now() < me.expiresAt) {
        await new Promise(res => setTimeout(res, wait));
        if (twLogin !== me) return;
        try {
          const t = await twitch.pollDeviceLogin(id, d.deviceCode, scopes);
          if (t.pending) { if (t.slower) wait += 2000; continue; }
          const who = await twitch.validate(t.access);
          config.twitch.auth = { ...t, login: who ? who.login : '', userId: who ? who.userId || '' : '', scopes: who && who.scopes && who.scopes.length ? who.scopes : scopes.split(' ') };
          if (!config.twitch.channel && who) config.twitch.channel = who.login;    // signing in also fills in your channel
          saveConfig(); twLogin = null;
          twNote('ok', `Signed in to Twitch as ${config.twitch.auth.login || 'you'} — BeeboScore can reply in chat now.`);
          if (config.twitch.connect || chat.state !== 'off') { config.twitch.connect = true; saveConfig(); await twConnect(); }
          twPush(); return;
        } catch (e) { if (twLogin === me) { twLogin = null; twNote('err', e.message); twPush(); } return; }
      }
      if (twLogin === me) { twLogin = null; twNote('err', 'The sign-in code expired. Start again.'); twPush(); }
    })();
    return { code: d.userCode, url: d.url };
  }
  /** one place for every viewer-match action: the panel, Stream Deck, shortcuts */
  function viewerAction(b) {
    let r;
    if (b.action === 'next' || (b.action === 'open' && b.open !== false && b.open !== 'false' && !(vm.data && vm.data.open))) oneEvent('vm');
    switch (b.action) {
      case 'next': r = vm.next(b.login); break;
      case 'result': r = vm.result(b.who === 'viewer' ? 'viewer' : 'streamer', Number(b.delta) < 0 ? -1 : 1); break;
      case 'open': r = vm.setOpen(b.open === undefined ? 'toggle' : b.open); break;
      case 'remove': r = vm.remove(b.login); break;
      case 'move': r = vm.move(b.login, b.to); break;
      case 'add': r = vm.join(b.login || b.name, b.name || b.login, { force: true }); break;
      case 'clear': r = vm.clear(); break;
      case 'splash': r = vm.splash(b.show === undefined ? 'toggle' : b.show); break;
      case 'sidebar': r = vm.sidebar(b.show === undefined ? 'toggle' : b.show); break;
      case 'session': r = vm.newSession(); break;
      case 'resetRecord': r = vm.resetRecord(b.login); break;
      case 'undo': r = vm.undo(); break;
      default: throw new Error('Unknown action.');
    }
    if (!r.ok) throw Object.assign(new Error(r.error || 'Couldn’t do that.'), { status: 400 });
    if (r.say && b.announce !== false && ['next', 'open', 'clear'].includes(b.action)) chat.say(r.say);
    return r;
  }
  // the streamer's picture for the viewer VS screen
  const ART_TYPES = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'video/webm': 'webm', 'video/mp4': 'mp4' };
  function artFile() { const a = config.twitch.art; return a && a.file ? path.join(TW_DIR, path.basename(a.file)) : ''; }


  // ------------------------------------------------------------ OBS's WebSocket (address and password)
  // Used by the panel and the Designer to talk to OBS (sound through OBS, cutting a camera out…). The password never
  // leaves this PC. 1.12.8: Autoscore was removed; its OBS address and password carry over.
  { const old = config.autoscore || {};
    config.obs = { url: 'ws://127.0.0.1:4455', password: '', ...(old.obsUrl ? { url: old.obsUrl } : {}), ...(old.obsPassword ? { password: old.obsPassword } : {}), ...(config.obs || {}) };
    if (config.autoscore) { delete config.autoscore; try { saveConfig(); } catch {} } }

  // ------------------------------------------------------------ picture cache
  // Player pictures (start.gg) and flags are kept on this PC the first time they're shown, so they appear
  // instantly, survive OBS refreshes and keep working if the internet drops. Only these hosts are fetched.
  const IMG_DIR = path.join(DATA_DIR, 'image-cache');
  const IMG_HOSTS = /(^|\.)start\.gg$|(^|\.)flagcdn\.com$|^static-cdn\.jtvnw\.net$/i;
  const imgFetching = new Map();
  // 1.12.8: small start.gg pictures get a bigger copy, made once by the app's own window (public/upscale.js: AI, or a smart
  // resize when the PC can't) and kept next to the original as <key>.up — overlays get that copy from then on.
  const UP_FILE = path.join(IMG_DIR, 'upscaled.json');
  const upIndex = readJSON(UP_FILE, {});               // key → { s: 'done' | 'skip' | 'fail', how, at }
  const upPending = new Map();                          // key → { key, src } waiting for the window
  var upv = Object.values(upIndex).filter(x => x.s === 'done').length;          // (var / function: liveState can run before this part of the file)
  function upMode() { return ['auto', 'ai', 'smart', 'off'].includes(config.settings.upscale) ? config.settings.upscale : 'auto'; }
  function upAsk(key, href) {
    if (upMode() === 'off' || upIndex[key] || upPending.has(key)) return;
    if (!/(^|\.)start\.gg$/i.test(new URL(href).hostname)) return;               // profile pictures, not flags
    const job = { key, src: '/img?raw=1&u=' + encodeURIComponent(href) }; upPending.set(key, job);
    hub.broadcastWhere(c => c.meta.authed && c.meta.kind === 'pc', 'upscale', { jobs: [job] });
  }
  async function cachedImage(req, res, u) {
    let target; try { target = new URL(String(u || '')); } catch { return send(res, 400, 'Bad picture link', 'text/plain'); }
    if (target.protocol !== 'https:' || !IMG_HOSTS.test(target.hostname)) return send(res, 403, 'Not allowed', 'text/plain');
    const key = crypto.createHash('sha1').update(target.href).digest('hex');
    const file = path.join(IMG_DIR, key), meta = file + '.type';
    const raw = (() => { try { return new URL(req.url, 'http://x').searchParams.get('raw') === '1'; } catch { return false; } })();
    const serve = () => {
      if (!raw && upMode() !== 'off' && upIndex[key] && upIndex[key].s === 'done' && fs.existsSync(file + '.up')) { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' }); return res.end(fs.readFileSync(file + '.up')); }
      const type = fs.readFileSync(meta, 'utf8'); res.writeHead(200, { 'Content-Type': type, 'Cache-Control': raw ? 'no-store' : 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' }); res.end(fs.readFileSync(file));
      if (!raw) try { upAsk(key, target.href); } catch {}
    };
    if (fs.existsSync(file) && fs.existsSync(meta)) return serve();
    try {
      if (!imgFetching.has(key)) imgFetching.set(key, (async () => {
        const r = await fetch(target.href, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
        const type = String(r.headers.get('content-type') || '').split(';')[0];
        if (!IMG_HOSTS.test(new URL(r.url || target.href).hostname)) throw new Error('moved off start.gg');   // redirects stay on the allowed sites
        if (!r.ok || !/^image\/(png|jpe?g|gif|webp)$/i.test(type)) throw new Error('not a picture');      // plain pictures only (no SVG)
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 4 * 1024 * 1024) throw new Error('too big');
        fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(file, buf); fs.writeFileSync(meta, type);
      })().finally(() => imgFetching.delete(key)));
      await imgFetching.get(key);
      return serve();
    } catch { return send(res, 404, 'Picture unavailable', 'text/plain'); }
  }

  // small in-memory cache for the app's own static files
  const staticCache = new Map();
  let designJs = null, designJsLite = null;
  // 1.12.12: the app's own scripts, styles and pages go out compressed (Brotli, else gzip) to anything that asks for it —
  // online links and tunnels download about a quarter as much. Each file is compressed once and kept.
  const ZIPPABLE = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg)/;
  function sendCached(req, res, c, type) {
    if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, { ETag: c.etag, Vary: 'Accept-Encoding' }); return res.end(); }
    const h = { 'Content-Type': type, ETag: c.etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
    const ae = String(req.headers['accept-encoding'] || ''), big = c.data.length > 1400 && ZIPPABLE.test(type);
    try {
      if (big && /\bbr\b/.test(ae)) { c.br = c.br || zlib.brotliCompressSync(c.data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: c.data.length } }); res.writeHead(200, { ...h, 'Content-Encoding': 'br' }); return res.end(req.method === 'HEAD' ? undefined : c.br); }
      if (big && /\bgzip\b/.test(ae)) { c.gz = c.gz || zlib.gzipSync(c.data, { level: 9 }); res.writeHead(200, { ...h, 'Content-Encoding': 'gzip' }); return res.end(req.method === 'HEAD' ? undefined : c.gz); }
    } catch {}
    res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : c.data);
  }
  function serveFile(req, res, file, transform) {
    const ext = path.extname(file).toLowerCase();
    const isApp = file.startsWith(PUBLIC_DIR) && !transform;
    if (isApp && staticCache.has(file) && !process.env.FGC_DEV) return sendCached(req, res, staticCache.get(file), MIME[ext] || 'application/octet-stream');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      if (transform && (ext === '.html' || ext === '.htm')) data = transform(data.toString('utf8'));
      if (isApp) { const c = { data, etag: '"' + crypto.createHash('md5').update(data).digest('hex') + '"' }; staticCache.set(file, c); return sendCached(req, res, c, MIME[ext] || 'application/octet-stream'); }
      send(res, 200, data, MIME[ext] || 'application/octet-stream');
    });
  }
  function openInOS(target) {
    if (opts.openPath) return opts.openPath(target);
    const cmd = process.platform === 'win32' ? `start "" "${target}"` : process.platform === 'darwin' ? `open "${target}"` : `xdg-open "${target}"`;
    exec(cmd, () => {});
  }

  // ------------------------------------------------------------ routes
  // ------------------------------------------------------------ 1.12.18: the show (lib/show.js)
  function twHasExtra() { const a = config.twitch.auth; return !!(a && a.access && Array.isArray(a.scopes) && twitch.EXTRA_SCOPES.split(' ').every(x => a.scopes.includes(x))); }
  SHOW = SHOWMOD.createShow({
    DATA_DIR, BIN_DIR, PUBLIC_DIR, APP_VERSION, builtGallery: (readJSON(path.join(BUNDLE_DIR, 'gallery-online.json'), {}) || {}).url || '',
    state: () => state, setState, remoteAction: b => remoteAction(b), liveBroadcast: () => broadcast('state', liveState()), hubAll: (t, d) => hub.broadcast(t, d), panel: (t, d) => { try { hub.broadcastWhere(c => c.meta.authed, t, d); } catch {} },
    config: () => config, saveConfig, saveLater, readJSON, strip: s => stripDerived(s), blankPlayer, log: m => console.error(m),
    hist, autos: { runNow: id => autos.runNow(id), fire: (e, i) => { const n = autos.fire(e, i); if (n) broadcastAutos(); return n; }, set: l => { config.automations = autos.set(l); broadcastAutos(); }, get list() { return autos.list; } },
    chapterMark: l => chapterMark(l), chapterStart: () => chapters.streamStart || 0, layoutScreens: () => layoutScreens(), bracket: () => bracket.model, bracketTitle: () => bracketTitle(),
    chat: { canSay: () => chatCanSay(), say: t => chat.say(t) }, winnerOf: () => winnerOf(state), talking: () => [1, 2, 3, 4].some(k => talking(k)),
    twitch: { hasScopes: twHasExtra, userId: () => (config.twitch.auth && config.twitch.auth.userId) || '',
      helix: async (method, pth, body) => {
        const a = await twAuth(); if (!a || !a.access) throw new Error('Sign in to Twitch first.');
        const r = await fetch(twitch.HELIX_URL + pth, { method, headers: { 'Client-Id': twClientId(), Authorization: 'Bearer ' + a.access, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
        if (r.status === 204) return {}; const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${d.message || 'Twitch said no'} (${r.status})`); return d;
      } },
    picUrl: n => { const a = pics[picKey(n)]; return a && a.file ? picUrl(a) : ''; }, sponsorCount: () => sponsorsClean(config.sponsors).items.length,
    serveFile, send, ok, fail, readBody, readJSONBody, isHost, isLan, clientIp, lanUrls: () => lanUrls(), openPath: f => (opts.openPath ? opts.openPath(f) : openInOS(f)),
    overlayExists, setActive, inlineDesign: n => { const d = readJSON(path.join(overlayDir(safeName(n)), 'design.json'), null); return d && d.scenes ? inlineDesign(d) : null; }, refreshOverlays: () => refreshOverlays(300, true),
    makeBackup: () => { const b = makeBackup(); return { ...b, hash: JSON.stringify(backup.scrubConfig(config)) + b.summary.players + b.summary.layouts + b.summary.assets }; }, parseBackup: buf => backup.parse(buf),
    restoreBackup: doc => { const r = backup.restore(doc, { dataDir: DATA_DIR, overlaysDir: OVERLAYS_DIR, current: config }); writeJSON(CONFIG_FILE, { ...r.config, sync: config.sync }); if (opts.restart) setTimeout(() => opts.restart(), 800); else { config = { activeOverlay: 'tekken8-default', startgg: {}, ...r.config, sync: config.sync }; players = readJSON(PLAYERS_FILE, []); } return r; },
    dropSessions, notify: (k, t, o) => notify.send(k, t, o || {}), twitchChannel: () => (config.twitch && config.twitch.channel) || '',
    // 1.12.19: the team member (or a remote TO) behind what's happening now — '' for this PC, timers and automations
    actor: () => { const s = actorStore.getStore(), req = s && s.req; if (!req) return ''; const w = req.__member || whoOf(req); if (w && w.name) return w.name; return isLocal(req) ? '' : 'Remote TO'; },
  });

  const server = http.createServer(async (req, res) => {
    actorStore.enterWith({ req });
    const url = new URL(req.url, 'http://x');
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request', 'text/plain; charset=utf-8'); }
    const method = req.method;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!hostAllowed(req)) return send(res, 421, 'Unknown host', 'text/plain; charset=utf-8');
    if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(req)) return send(res, 403, { error: 'Blocked a request from another website.' });

    try {
      if (p === '/favicon.ico') return serveFile(req, res, path.join(PUBLIC_DIR, 'favicon.ico'));   // 16 / 24 px: the small-size badge

      // ---------- public routes: overlays & live data ----------
      if (p === '/sb-client.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-client.js'));
      if (p === '/sb-vs.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-vs.js'));
      if (p === '/sb-bracket.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-bracket.js'));
      if (p === '/sb-vtjoin.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-vtjoin.js'));
      if (p === '/sb-comm.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-comm.js'));
      if (p === '/sb-fullvs.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-fullvs.js'));
      if (p === '/sb-hud.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-hud.js'));              // 1.12.24: each game's HUD
      if (p === '/sb-story.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-story.js'));          // 1.12.23: the stats strip, the VS hit, the Bracket reset splash
      if (p === '/sb-showcards.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-showcards.js'));   // 1.12.16: the stats card and sponsors
      if (SHOW && await SHOW.publicRoute(req, res, p, method, url)) return;                  // 1.12.18: the show's pages, sounds and the backup PC's link
      // 1.12.9: the camera relay — /cam/<link>/hello (who am I) and /cam/<link>/chunk (a piece of video); the link is the key
      { const cm = p.match(/^\/cam\/([A-Za-z0-9_-]{20,80})\/(hello|chunk|talk)$/);
        if (cm) {
          const l = camLink.check(cm[1], clientIp(req));
          if (!l) return send(res, 404, 'no', 'text/plain', { 'Cache-Control': 'no-store' });
          if (l.wait) return send(res, 429, 'wait', 'text/plain', { 'Retry-After': '60' });
          const slot = l.slot, r = camRelay[slot] = camRelay[slot] || { at: 0 };
          if (cm[2] === 'hello') return ok(res, { slot, name: (commCfg().people[slot - 1] || {}).name || l.name || '', ice: CAM_ICE, relay: !!r.restart });
          if (method !== 'POST') return fail(res, 405, 'POST');
          if (cm[2] === 'talk') { let b = {}; try { b = JSON.parse((await readBody(req, 1024)).toString() || '{}'); } catch {} if (relayLive(slot) || camLive[slot]) setTalk(slot, !!b.on); return ok(res, { ok: true }); }
          let buf; try { buf = await readBody(req, 3 * 1024 * 1024); } catch { return fail(res, 413, 'Too big.'); }
          const first = req.headers['x-first'] === '1', sess = String(req.headers['x-sess'] || '').slice(0, 24), mime = String(req.headers['x-mime'] || '').slice(0, 80);
          if (!/^(video\/(webm|mp4)|audio\/webm)/.test(mime) || !sess) return fail(res, 400, 'Bad piece.');
          const was = relayLive(slot);
          if (first) { r.sess = sess; r.mime = mime; r.init = buf; r.restart = false; }
          r.at = Date.now();
          if (r.sess === sess) hub.broadcastWhere(c => c.meta.cam && c.meta.cam.role === 'view', 'cam-chunk', { slot, sess, mime, first, b64: buf.toString('base64') });
          if (!was) camsChanged();
          clearTimeout(r.gone); r.gone = setTimeout(() => { if (!relayLive(slot)) camsChanged(); }, 4500);
          return ok(res, { restart: !!r.restart && !first });
        }
      }
      // 1.12.16: the second operator's remote — the link is the key, on this PC or its network only (never through the
      // online link), and it can only do what Settings › Second operator allows
      { const om = p.match(/^\/op\/([A-Za-z0-9_-]{20,40})(\/status|\/action)?$/);
        if (om) {
          const nope = () => send(res, 404, 'This remote link doesn’t work (any more). Ask for a new one.', 'text/plain; charset=utf-8', { 'Cache-Control': 'no-store' });
          if (req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || !(isHost(req) || isLan(req)) || !opOk(om[1])) return nope();
          if (!om[2]) { res.setHeader('X-Frame-Options', 'DENY'); return serveFile(req, res, path.join(PUBLIC_DIR, 'op.html')); }
          const o = config.operator, allowed = new Set((o.perms || []).flatMap(k => OP_ACTIONS[k] || []));
          if (om[2] === '/status') {
            return send(res, 200, { ...opStatus(o.perms || [], o.name || '') }, JSON_TYPE, { 'Cache-Control': 'no-store' });
          }
          if (method !== 'POST') return fail(res, 405, 'POST');
          const b = await readJSONBody(req).catch(() => null);
          if (b && (o.perms || []).includes('show') && ['rundown', 'countdown', 'schedule', 'storyline', 'pred', 'poll', 'walkin', 'evstats', 'season'].includes(b.action)) allowed.add(b.action);   // 1.12.18
          if (!b || !allowed.has(b.action)) return fail(res, 403, 'The remote isn’t allowed to do that — ask the streamer to allow it.');
          try { return ok(res, await remoteAction(b) || { ok: true }); } catch (e) { return fail(res, 400, e.message || 'That didn’t work.'); }
        }
      }
      // 1.12.6: a commentator's camera page — the link is the key (no sign-in); a wrong one shows nothing about the app
      if (p.startsWith('/cam/') && method === 'GET') {
        if (!fs.existsSync(path.join(PUBLIC_DIR, 'cam.html'))) return send(res, 404, 'Not found', 'text/plain');   // BeeboScore: no commentary screen, so no camera page
        const l = camLink.check(p.slice(5), clientIp(req));
        if (!l) return send(res, 404, 'This camera link doesn’t work (any more). Ask the host for a new one.', 'text/plain; charset=utf-8', { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        if (l.wait) return send(res, 429, 'Too many wrong links. Try again in a minute.', 'text/plain; charset=utf-8', { 'Retry-After': '60' });
        const html = fs.readFileSync(path.join(PUBLIC_DIR, 'cam.html'), 'utf8');
        return send(res, 200, html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(self), microphone=(self)',
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' wss: ws:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      }
      { const bm = p.match(/^\/brand\/((logo|sp)-[0-9a-f]{12}\.(png|jpg|webp))$/); if (bm && method === 'GET') { const f = path.join(BRAND_DIR, bm[1]); if (!fs.existsSync(f)) return send(res, 404, 'Not found', 'text/plain');
        res.writeHead(200, { 'Content-Type': { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[bm[3]], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }); return res.end(fs.readFileSync(f)); } }
      if (p === '/sb-brand.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-brand.js'));
      if (p === '/static/cam.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'cam.js'));
      if (p === '/sb-skin.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-skin.js'));
      if (p === '/img' && method === 'GET') return cachedImage(req, res, url.searchParams.get('u'));

      // ---- the live bracket page for viewers: read-only, behind an unguessable link that closes when the tournament is over
      if (watch.handle(req, res, p, method)) return;
      if (p.startsWith('/s/') && method === 'GET') {           // a short link: on to the page it stands for (only pages anyone may see)
        const ip = clientIp(req);
        if (shorts.tooMany(ip)) return send(res, 429, 'Too many wrong links. Try again in a minute.', 'text/plain; charset=utf-8', { 'Retry-After': '60' });
        const to = shorts.resolve(p.slice(3));
        if (!to) { shorts.miss(ip); return send(res, 404, 'This link doesn’t lead anywhere (any more).', 'text/plain; charset=utf-8', { 'Cache-Control': 'no-store' }); }
        return send(res, 302, '', 'text/plain', { Location: to, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      }
      // ---- the designer's asset library: pictures, videos and fonts you uploaded, reused across layouts
      const shm = p.match(/^\/share\/([^/]+)\.beebo$/);
      if (shm && method === 'GET') {              // a layout its owner chose to share by link (designer → Share)
        const name = safeName(shm[1]), d = readJSON(path.join(overlayDir(name), 'design.json'), null);
        if (!d || !d.share) return send(res, 404, 'This layout isn’t shared.', 'text/plain; charset=utf-8');
        const body = JSON.stringify({ beebo: 1, type: 'layout', app: 'BeeboScore', exported: new Date().toISOString(), design: { ...inlineDesign(d), share: false } });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.beebo"`, 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' });
        return res.end(body);
      }
      if (p.startsWith('/assets/char/') && method === 'GET') {        // character art: a picture named after the character, tagged "character"
        const want = decodeURIComponent(p.slice(13)).toLowerCase(), slugify = x => String(x || '').toLowerCase().normalize('NFKD').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const chars = assetList().filter(x => x.tag === 'character');
        // "Lynx.png" or "Lynx Ardent.png" both match a player playing Lynx (and the other way round)
        const a = chars.find(x => slugify(x.name) === want) || chars.find(x => { const n = slugify(x.name); return n.startsWith(want + '-') || want.startsWith(n + '-'); });
        if (!a) return send(res, 404, 'No art for that character', 'text/plain');
        return serveFile(req, res, path.join(ASSET_DIR, a.file));
      }
      if (p.startsWith('/assets/') && method === 'GET') {
        const f = path.basename(decodeURIComponent(p.slice(8)));
        if (!/^[a-f0-9]{12}\.[a-z0-9]{2,5}$/.test(f)) return send(res, 404, 'Not found', 'text/plain');
        if (f.endsWith('.svg')) return fs.readFile(path.join(ASSET_DIR, f), (err, data) => err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, data, MIME['.svg'], { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:", 'Cache-Control': 'max-age=86400' }));
        return serveFile(req, res, path.join(ASSET_DIR, f));
      }
      if (p === '/sb-victory.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-victory.js'));
      if (p === '/sb-format.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-format.js'));
      if (p === '/sb-key.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-key.js'));
      if (p === '/sb-fps.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-fps.js'));      // 1.12.16: 60 fps outside OBS
      if (p === '/sb-sound.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-sound.js'));
      if (p === '/sb-perf.js') return serveFile(req, res, path.join(PUBLIC_DIR, 'sb-perf.js'));
      if (p === '/sb-design.js') {          // the designer runtime + its effects library (sb-fx.js, sb-fx-moves.js), as one file
        // 1.12.16: ?lite — without the effects engines (BeeboFX and BeeboFX 3: about 140 KB) for overlays that
        // couldn't use them anyway (effects Off, potato mode); the layout falls back to its plain effects
        const lite = url.searchParams.has('lite');
        if (!designJs || process.env.FGC_DEV) {
          const ALL = ['sb-fps.js', 'sb-key.js', 'sb-lightning.js', 'sb-fx4.js', 'sb-gfx.js', 'sb-gfx2.js', 'sb-gfx3.js', 'sb-stinger.js', 'sb-fx.js', 'sb-fx-moves.js', 'sb-motion.js', 'sb-design-core.js', 'sb-design.js'];
          const ENGINES = new Set(['sb-gfx.js', 'sb-gfx3.js']);            // (BeeboFX 2 stays: it takes the still pictures a screen shatters from)
          const pack = list => { const data = Buffer.from(list.map(f => fs.readFileSync(path.join(PUBLIC_DIR, f), 'utf8')).join('\n;\n')); return { data, etag: '"' + crypto.createHash('md5').update(data).digest('hex') + '"' }; };
          designJs = pack(ALL); designJsLite = pack(ALL.filter(f => !ENGINES.has(f)));
        }
        return sendCached(req, res, lite ? designJsLite : designJs, 'text/javascript; charset=utf-8');
      }
      if (p === '/api/bracket/data' && method === 'GET') return ok(res, bracketPayload());
      // Twitch Stuff overlays (OBS Browser Sources) + what they show
      if (p === '/twitch/sidebar' || p === '/twitch/vs') return serveFile(req, res, path.join(PUBLIC_DIR, p === '/twitch/vs' ? 'twitch-vs.html' : 'twitch-sidebar.html'));
      if (p === '/api/twitch/live' && method === 'GET') return ok(res, viewersPublic());
      if (p.startsWith('/vs-art/') && method === 'GET') {
        const name = path.basename(p), m = /^(?:bar|header)-\d+\.(png|webp|jpg)$/.exec(name), f = path.join(VSART_DIR, name);
        if (!m || !fs.existsSync(f)) return send(res, 404, 'No picture', 'text/plain; charset=utf-8');
        res.writeHead(200, { 'Content-Type': { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' }[m[1]], 'Content-Length': fs.statSync(f).size, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        return fs.createReadStream(f).pipe(res);
      }
      if (p.startsWith('/player-art/') && method === 'GET') {
        const name = path.basename(p), m = /^[a-f0-9]{16}-\d+\.(png|webp|jpg)$/.exec(name), f = path.join(PICS_DIR, name);
        if (!m || !fs.existsSync(f)) return send(res, 404, 'No picture', 'text/plain; charset=utf-8');
        res.writeHead(200, { 'Content-Type': { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' }[m[1]], 'Content-Length': fs.statSync(f).size, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        return fs.createReadStream(f).pipe(res);
      }
      if (p === '/twitch/art' && method === 'GET') {
        const f = artFile(), a = config.twitch.art;
        if (!f || !fs.existsSync(f)) return send(res, 404, 'No picture', 'text/plain; charset=utf-8');
        const st = fs.statSync(f);
        res.writeHead(200, { 'Content-Type': a.type, 'Content-Length': st.size, 'Cache-Control': 'public, max-age=31536000, immutable', 'Accept-Ranges': 'none' });
        return fs.createReadStream(f).pipe(res);
      }
      if (p === '/api/potato' && method === 'GET') return ok(res, { potato: potato(), renderer: potatoRender(), ver: potatoFrame.ver, name: potatoFrame.name });
      if (p === '/overlay.png' && method === 'GET') {
        if (!potatoFrame.png) return send(res, 404, 'No picture yet', 'text/plain; charset=utf-8');
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        return res.end(potatoFrame.png);
      }
      if (p.startsWith('/static/')) {
        const f = resolveInside(PUBLIC_DIR, p.slice(8));
        return f ? serveFile(req, res, f) : send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
      }
      if (p === '/commentary') return send(res, 302, '', 'text/plain', { Location: '/overlay?only=comm' + (url.search ? '&' + url.search.slice(1) : '') });   // 1.12.9: the commentary screen as its own OBS source
      if (p === '/overlay' || p.startsWith('/overlay/')) {
        const specific = p.length > '/overlay/'.length;
        let name = specific ? safeName(p.slice(9).replace(/\/$/, '')) : config.activeOverlay;
        if (!overlayExists(name) && (MOVED_LAYOUTS[name] || RENAMED_LAYOUTS[name])) name = MOVED_LAYOUTS[name] || RENAMED_LAYOUTS[name];   // an OBS source still on a retired layout's address
        if (!overlayExists(name)) return send(res, 404, `<body style="font:20px sans-serif;color:#fff;background:#a00;padding:20px">Layout "${name}" not found.</body>`, 'text/html; charset=utf-8');
        // Default: a tiny host page that double-buffers the layout, so refreshes and layout
        // switches swap in a fully drawn copy with no blank frame. ?direct serves the layout itself.
        if (potatoRender() && !url.searchParams.has('potato') && !url.searchParams.has('direct')) return send(res, 200, potatoPage(), 'text/html; charset=utf-8');
        if (!url.searchParams.has('sbframe') && !url.searchParams.has('direct') && !potato()) {
          return send(res, 200, hostPage(specific ? name : '', !specific), 'text/html; charset=utf-8');
        }
        const mode = { framed: url.searchParams.has('sbframe'), instant: url.searchParams.has('instant'), soft: url.searchParams.get('instant') === 'soft', potato: potato() || url.searchParams.has('potato'), engines: url.searchParams.has('engines') };
        const vr = variantOf(name);
        return serveFile(req, res, path.join(overlayDir(vr ? vr.base : name), 'index.html'), html => injectOverlay(vr ? asVariant(html, vr) : html, name, !specific, { ...mode, assets: vr ? vr.base : name }));
      }
      if (p.startsWith('/o/')) {
        const [, , rawName, ...rest] = p.split('/');
        const name = safeName(rawName);
        const f = resolveInside(overlayDir(name), rest.join('/') || 'index.html');
        if (!f) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
        return serveFile(req, res, f, html => injectOverlay(html, name, false));
      }
      if (p === '/api/live') {
        const o = safeName(url.searchParams.get('o') || '');
        return ok(res, { state: withPics(state), active: config.activeOverlay, rev: revs[o] || 0 });
      }
      if (p === '/api/state' && method === 'GET') return ok(res, liveState());
      if (p === '/api/upcoming' && method === 'POST') {        // the next matches (from the panel's start.gg list), for designer "Upcoming" lists
        const b = await readJSONBody(req), list = Array.isArray(b && b.list) ? b.list.slice(0, 12).map(m => ({ round: String(m.round || '').slice(0, 60), p1: String(m.p1 || '').slice(0, 80), p2: String(m.p2 || '').slice(0, 80) })) : [];
        if (JSON.stringify(list) !== JSON.stringify(upcoming)) { upcoming = list; broadcast('state', liveState()); }
        return ok(res, { ok: true });
      }

      // ---------- login ----------
      if (p === '/login') {
        if (isAuthed(req)) return send(res, 302, '', 'text/plain', { Location: '/' });
        res.setHeader('X-Frame-Options', 'DENY');
        return serveFile(req, res, path.join(PUBLIC_DIR, 'login.html'));
      }
      if (p === '/api/login' && method === 'POST') {
        const ip = clientIp(req), now = Date.now();
        const recent = (loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
        globalFails = globalFails.filter(t => now - t < 60 * 60 * 1000);
        if (recent.length >= 8) return fail(res, 429, 'Too many attempts. Wait 15 minutes and try again.');
        if (globalFails.length >= 60) return fail(res, 429, 'Sign-in is paused for a while after too many failed attempts.');
        const { password, name } = await readJSONBody(req);
        const hasTeam = Array.isArray(config.team) && config.team.length > 0;
        if (!config.passwordHash && !hasTeam) return fail(res, 403, 'Remote access is not set up. Set a password in the app first.');
        let who = null;                  // 1.12.18: the TO's password, or a team member's
        if (typeof password === 'string' && password.length <= 200) {
          if (config.passwordHash && checkPw(password, config.passwordHash)) who = { role: 'to', id: '', name: '' };
          else if (SHOW && hasTeam) { const m = SHOW.team.login(name, password); if (m) who = { role: m.role, id: m.id, name: m.name }; }
        }
        if (!who) {
          recent.push(now); loginAttempts.set(ip, recent); globalFails.push(now);
          await new Promise(r => setTimeout(r, 600)); // slow down guessing
          return fail(res, 401, 'Wrong password.');
        }
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const tok = crypto.randomBytes(32).toString('hex');
        sessions.set(tok, now + 14 * 24 * 3600 * 1000); sessionWho.set(tok, who); if (sessionWho.size > 200) sessionWho.delete(sessionWho.keys().next().value);
        loginAttempts.delete(ip);
        const secure = req.headers['x-forwarded-proto'] === 'https' || !!req.headers['cf-ray'] ? '; Secure' : '';
        return send(res, 200, { ok: true, role: who.role, go: who.role === 'caster' ? '/casters' : who.role === 'operator' ? '/op' : '/' }, JSON_TYPE, { 'Set-Cookie': `sb_session=${tok}; HttpOnly; Path=/; SameSite=Strict; Max-Age=1209600${secure}` });
      }
      if (p === '/api/logout' && method === 'POST') {
        sessions.delete(cookies(req).sb_session); sessionWho.delete(cookies(req).sb_session);
        return send(res, 200, { ok: true }, JSON_TYPE, { 'Set-Cookie': 'sb_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict' });
      }

      // ---------- everything below needs auth when accessed remotely ----------
      if (!isAuthed(req)) {
        if (p === '/' || p === '/control') return send(res, 302, '', 'text/plain', { Location: '/login' });
        return fail(res, 401, 'Please log in.');
      }
      const local = isLocal(req);
      const localOnly = () => { if (!local) { fail(res, 403, 'Only the computer running the app can do this.'); return true; } return false; };
      // 1.12.18: team accounts — an operator gets the operator's remote, a caster the casters' page, and nothing else
      const role = roleOf(req); req.__member = whoOf(req);
      if (role !== 'to') {
        if (p === '/' || p === '/control') return send(res, 302, '', 'text/plain', { Location: role === 'caster' ? '/casters' : '/op' });
        if (!TEAM.allowed(role, p, method)) return fail(res, 403, 'Your team role can’t use that — ask the TO.');
      }
      if (p === '/op' || p === '/op/status' || p === '/op/action') {          // the operator's remote, for a signed-in operator (or the TO)
        if (role === 'caster') return fail(res, 403, 'Your team role can’t use that — ask the TO.');
        if (p === '/op') { res.setHeader('X-Frame-Options', 'DENY'); return serveFile(req, res, path.join(PUBLIC_DIR, 'op.html')); }
        if (p === '/op/status') return send(res, 200, opStatus(Object.keys(OP_PERMS), req.__member ? req.__member.name : ''), JSON_TYPE, { 'Cache-Control': 'no-store' });
        if (method !== 'POST') return fail(res, 405, 'POST');
        const b = await readJSONBody(req).catch(() => null);
        if (!b || !TEAM.OPERATOR_ACTIONS.includes(b.action)) return fail(res, 403, 'The remote can’t do that.');
        try { return ok(res, await remoteAction(b) || { ok: true }); } catch (e) { return fail(res, 400, e.message || 'That didn’t work.'); }
      }
      if (SHOW && await SHOW.route(req, res, p, method, url, { local, role, localOnly })) return;
      if (p === '/api/assets' && method === 'GET') { if (localOnly()) return; return ok(res, { assets: assetList() }); }
      if (p === '/api/assets' && method === 'POST') {
        if (localOnly()) return;
        const name = String(url.searchParams.get('name') || 'file').replace(/[^\w.\- ()]+/g, '_').slice(0, 80) || 'file';
        const ext = (path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin');
        const kind = /\.(png|jpe?g|gif|webp|svg|avif|apng)$/.test(ext) ? 'image' : /\.(webm|mp4|mov|m4v)$/.test(ext) ? 'video' : /\.(ttf|otf|woff2?)$/.test(ext) ? 'font' : /\.(mp3|ogg|wav|m4a)$/.test(ext) ? 'sound' : ext === '.glb' ? 'model' : '';
        if (!kind) return fail(res, 400, 'Pictures (PNG, JPG, GIF, WebP, SVG), videos (WebM, MP4), sounds (MP3, OGG, WAV) fonts (TTF, OTF, WOFF) or 3D models (GLB) only.');
        const buf = await readBody(req, 300 * 1024 * 1024);
        if (!buf.length) return fail(res, 400, 'That file is empty.');
        if (kind === 'model' && buf.slice(0, 4).toString('latin1') !== 'glTF') return fail(res, 400, 'That isn’t a GLB 3D model (export it from Blender as glTF Binary, .glb).');
        const id = crypto.randomBytes(6).toString('hex'), file = id + ext;
        fs.mkdirSync(ASSET_DIR, { recursive: true }); fs.writeFileSync(path.join(ASSET_DIR, file), buf);
        const list = assetList(), tag = String(url.searchParams.get('tag') || '').replace(/[^\w-]/g, '').slice(0, 20);
        const a = { id, name, file, kind, size: buf.length, tag, at: Date.now(), url: '/assets/' + file };
        list.unshift(a); writeJSON(ASSET_INDEX, list.slice(0, 2000));
        return ok(res, a);
      }
      if (p === '/api/assets/delete' && method === 'POST') {
        if (localOnly()) return;
        const { id } = await readJSONBody(req), list = assetList(), a = list.find(x => x.id === id);
        if (a) { try { fs.unlinkSync(path.join(ASSET_DIR, a.file)); } catch {} writeJSON(ASSET_INDEX, list.filter(x => x.id !== id)); }
        return ok(res, { ok: true });
      }
      if (p === '/api/assets/tag' && method === 'POST') {
        if (localOnly()) return;
        const { id, tag } = await readJSONBody(req), list = assetList(), a = list.find(x => x.id === id);
        if (a) { a.tag = String(tag || '').replace(/[^\w-]/g, '').slice(0, 20); writeJSON(ASSET_INDEX, list); }
        return ok(res, { ok: true });
      }

      if (p === '/phone' || p === '/remote') return send(res, 302, '', 'text/plain', { Location: '/control' });   // easy-to-guess names for the phone remote
      if (p === '/' || p === '/control') {
        res.setHeader('X-Frame-Options', 'DENY');
        if (potato()) return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), html => html.replace('<html', '<html class="potato"').replace('</head>', '<link rel="stylesheet" href="/static/potato.css"></head>'));
        // Shattered UI theme: themed from the first paint, no flash of the classic look
        if (config.settings.uiTheme === 'shattered') return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), html => html.replace('<html', '<html class="theme-shattered"').replace('</head>', '<link rel="stylesheet" href="/static/theme-shattered.css"></head>'));
        if (UI_THEMES.includes(config.settings.uiTheme)) { const t = config.settings.uiTheme; return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), html => html.replace('<html', `<html class="ui-x theme-${t}"`).replace('</head>', `<link rel="stylesheet" href="/static/themes/base.css"><link rel="stylesheet" href="/static/themes/${t}.css"></head>`)); }   // a Designer theme, from the first paint
        if (config.settings.uiTheme === 'contrast') return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), html => html.replace('<html', '<html class="theme-contrast"'));   // 1.12.19: high contrast, from the first paint
        return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'));
      }
      if (p === '/design-shot') return serveFile(req, res, path.join(PUBLIC_DIR, 'design-shot.html'));   // one Designer scene, still, for pictures
      if (p === '/vt-sidebar') return serveFile(req, res, path.join(PUBLIC_DIR, 'vt-sidebar.html'));   // viewer tournament sign-ups, for OBS
      if (p === '/dock') return serveFile(req, res, path.join(PUBLIC_DIR, 'dock.html'));        // the BeeboScore dock for OBS (Docks › Custom Browser Docks)
      if (p === '/mini') { res.setHeader('X-Frame-Options', 'DENY'); return serveFile(req, res, path.join(PUBLIC_DIR, 'mini.html')); }
      if (p === '/preview') { res.setHeader('X-Frame-Options', 'DENY'); return serveFile(req, res, path.join(PUBLIC_DIR, 'preview.html')); }
      if (p === '/designer') { res.setHeader('X-Frame-Options', 'SAMEORIGIN'); return serveFile(req, res, path.join(PUBLIC_DIR, 'designer.html')); }
      if (p === '/pick') { res.setHeader('X-Frame-Options', 'DENY'); return serveFile(req, res, path.join(PUBLIC_DIR, 'pick.html')); }
      if (p === '/api/latency' && method === 'GET') return ok(res, latency.list());
      if (p === '/api/latency/test' && method === 'POST') return ok(res, { seq: latency.test() });
      if (p === '/api/remote/status' && method === 'GET') { noteRemote(req); return ok(res, remoteStatus()); }
      if (p === '/api/remote/action' && method === 'POST') {
        noteRemote(req);
        try { return ok(res, await remoteAction(await readJSONBody(req))); } catch (e) { return fail(res, 400, e.message || 'Action failed.'); }
      }
      // 1.12.8: the window's upscaled copy of a small picture (public/upscale.js)
      if (p === '/api/upscale' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req), key = String(b.key || '');
        if (!/^[0-9a-f]{40}$/.test(key) || !fs.existsSync(path.join(IMG_DIR, key))) return fail(res, 400, 'Unknown picture.');
        upPending.delete(key);
        if (b.png) {
          const m = String(b.png).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/); if (!m) return fail(res, 400, 'PNG only.');
          const buf = Buffer.from(m[1], 'base64'); if (buf.length > 12 * 1024 * 1024 || buf.slice(1, 4).toString() !== 'PNG') return fail(res, 400, 'Not a PNG.');
          fs.writeFileSync(path.join(IMG_DIR, key + '.up'), buf); upIndex[key] = { s: 'done', how: b.how === 'ai' ? 'ai' : 'smart', at: Date.now() }; upv++;
          state.updatedAt = stamp(); broadcast('state', liveState());           // overlays fetch the bigger copy
        } else upIndex[key] = { s: b.skip ? 'skip' : 'fail', at: Date.now() };
        saveLater(UP_FILE, () => upIndex, 200);
        return ok(res, { ok: true });
      }
      // ---------- stingers (1.12.10): a WebM with a see-through background, for OBS's Stinger transition ----------
      if (p === '/api/stingers' && method === 'GET') {
        if (localOnly()) return;
        const list = fs.existsSync(STING_DIR) ? fs.readdirSync(STING_DIR).filter(f => /\.webm$/.test(f)).map(f => ({ name: f, path: path.join(STING_DIR, f), size: fs.statSync(path.join(STING_DIR, f)).size })) : [];
        return ok(res, { dir: STING_DIR, list });
      }
      if (p === '/api/stingers' && method === 'POST') {
        if (localOnly()) return;
        const buf = await readBody(req, 40 * 1024 * 1024);
        if (buf.length < 64 || buf.readUInt32BE(0) !== 0x1A45DFA3) return fail(res, 400, 'Not a WebM video.');
        const base = String(req.headers['x-name'] || 'stinger').replace(/[^A-Za-z0-9 _-]+/g, '').trim().slice(0, 40) || 'stinger';
        fs.mkdirSync(STING_DIR, { recursive: true });
        let f = base + '.webm', n = 2; while (fs.existsSync(path.join(STING_DIR, f))) f = `${base} (${n++}).webm`;
        fs.writeFileSync(path.join(STING_DIR, f), buf);
        return ok(res, { ok: true, name: f, path: path.join(STING_DIR, f), dir: STING_DIR });
      }
      if (p === '/api/stingers/open' && method === 'POST') { if (localOnly()) return; fs.mkdirSync(STING_DIR, { recursive: true }); openInOS(STING_DIR); return ok(res, { ok: true }); }
      // ---------- OBS connection (1.12.8: on its own card in Settings; it was on the Autoscore tab) ----------
      if (p === '/api/obs' && method === 'GET') return ok(res, { url: config.obs.url, hasPassword: !!config.obs.password });
      if (p === '/api/obs/secret' && method === 'GET') { if (localOnly()) return; return ok(res, { password: config.obs.password || '' }); }   // only the PC running the app
      if (p === '/api/obs/settings' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req);
        if (typeof b.url === 'string') { const u = b.url.trim().slice(0, 200); if (u && !/^wss?:\/\/[^\s]+$/i.test(u)) return fail(res, 400, 'The OBS address starts with ws:// — like ws://127.0.0.1:4455'); config.obs.url = u || 'ws://127.0.0.1:4455'; }
        if (typeof b.password === 'string') config.obs.password = b.password.slice(0, 200);
        saveConfig(); return ok(res, { url: config.obs.url, hasPassword: !!config.obs.password });
      }

      // ---------- Twitch Stuff ----------
      if (p === '/api/twitch' && method === 'GET') return ok(res, twStatus());
      if (p === '/api/twitch/connect' && method === 'POST') {
        const b = await readJSONBody(req);
        const ch = twitch.cleanLogin(b.channel || config.twitch.channel);
        if (!ch) return fail(res, 400, 'Type your Twitch channel name first.');
        config.twitch.channel = ch; config.twitch.connect = true; saveConfig();
        await twConnect(); twPush();
        return ok(res, twStatus());
      }
      if (p === '/api/twitch/disconnect' && method === 'POST') { config.twitch.connect = false; saveConfig(); chat.disconnect(); twNote('muted', 'Disconnected from chat'); twPush(); return ok(res, twStatus()); }
      if (p === '/api/twitch/login' && method === 'POST') { if (localOnly()) return; const lb = await readJSONBody(req).catch(() => ({})) || {}; return ok(res, await twStartLogin(!!lb.extra)); }
      if (p === '/api/twitch/login/cancel' && method === 'POST') { twLogin = null; twPush(); return ok(res, twStatus()); }
      if (p === '/api/twitch/logout' && method === 'POST') {
        if (localOnly()) return;
        const a = config.twitch.auth; config.twitch.auth = null; saveConfig();
        if (a && a.access && twClientId()) twitch.revoke(twClientId(), a.access);
        chat.setAuth(null); twNote('muted', 'Signed out of Twitch — still reading chat.'); twPush();
        return ok(res, twStatus());
      }
      if (p === '/api/twitch/client-id' && method === 'POST') {
        if (localOnly()) return;
        const { clientId } = await readJSONBody(req);
        const id = String(clientId || '').trim();
        if (id && !/^[a-z0-9]{20,40}$/i.test(id)) return fail(res, 400, 'That doesn’t look like a Twitch Client ID.');
        config.twitch.clientId = id; saveConfig(); twPush(); return ok(res, twStatus());
      }
      if (p === '/api/twitch/prefs' && method === 'POST') {
        const b = await readJSONBody(req);
        config.twitch.prefs = vm.setPrefs(b || {}); saveConfig(); writeViewerTexts(); twPush();
        return ok(res, twStatus());
      }
      if (p === '/api/twitch/action' && method === 'POST') { viewerAction(await readJSONBody(req)); return ok(res, twStatus()); }
      if (p === '/api/twitch/art' && method === 'POST') {
        if (localOnly()) return;
        const type = String(req.headers['content-type'] || '').split(';')[0].toLowerCase(), ext = ART_TYPES[type];
        if (!ext) return fail(res, 400, 'Use a PNG, WebP, GIF, JPG, WebM or MP4 file.');
        const buf = await readBody(req, 40 * 1024 * 1024).catch(() => null);
        if (!buf) return fail(res, 413, 'That file is too big (40 MB max). Try a shorter clip or a smaller size.');
        if (!buf.length) return fail(res, 400, 'The file is empty.');
        fs.mkdirSync(TW_DIR, { recursive: true });
        const old = artFile(); if (old) { try { fs.unlinkSync(old); } catch {} }
        const at = Date.now(), file = `streamer-art-${at}.${ext}`;
        fs.writeFileSync(path.join(TW_DIR, file), buf);
        const animated = /^video\//.test(type) || ext === 'gif';
        const prev = config.twitch.art || {};
        config.twitch.art = { file, type, at, size: buf.length, animated, chroma: animated ? (prev.animated ? prev.chroma !== false : true) : !!prev.chromaStill, tol: prev.tol ?? 40, w: Number(req.headers['x-art-width']) || 0, h: Number(req.headers['x-art-height']) || 0 };
        saveConfig(); twPush(); return ok(res, twStatus());
      }
      if (p === '/api/twitch/art' && method === 'PATCH') {
        const b = await readJSONBody(req), a = config.twitch.art;
        if (!a) return fail(res, 404, 'Upload a picture first.');
        if (b.chroma !== undefined) { a.chroma = !!b.chroma; if (!a.animated) a.chromaStill = !!b.chroma; }
        if (b.tol !== undefined) a.tol = Math.max(5, Math.min(90, Number(b.tol) || 40));
        saveConfig(); twPush(); return ok(res, twStatus());
      }
      if (p === '/api/twitch/art' && method === 'DELETE') {
        if (localOnly()) return;
        const f = artFile(); if (f) { try { fs.unlinkSync(f); } catch {} }
        config.twitch.art = null; saveConfig(); twPush(); return ok(res, twStatus());
      }
      if (p === '/api/app/restart' && method === 'POST') {
        if (localOnly()) return;
        flushSaves();
        if (opts.restart) { ok(res, { restarting: true }); setTimeout(() => opts.restart(), 300); return; }
        return ok(res, { restarting: false });
      }
      if (p === '/api/streamdeck' && method === 'GET') {
        const s = await sdStatus();
        if (s.outdated && !s.appTooOld && s.autoUpdate) sdAutoUpdate('check');      // Stream Deck just got new enough: carry on
        return ok(res, { ...s, plugin: !!(opts.streamDeckPlugin && fs.existsSync(opts.streamDeckPlugin)), setup: sdSetupView() });
      }
      if (p === '/api/streamdeck/setup' && method === 'GET') return ok(res, sdSetupView());
      if (p === '/api/streamdeck/setup' && method === 'POST') { if (localOnly()) return; try { return ok(res, sdSetupStart()); } catch (e) { return fail(res, 409, e.message); } }
      if (p === '/api/streamdeck/install' && method === 'POST') {
        if (localOnly()) return;
        if (!opts.streamDeckPlugin || !fs.existsSync(opts.streamDeckPlugin)) return fail(res, 404, 'The Stream Deck plugin file is missing from this build.');
        if (!opts.openPath) return fail(res, 400, 'Download the plugin and double-click it to install.');
        const s = await sdStatus();
        if (s.supported && !s.appFound && !s.connected) return fail(res, 409, "The Stream Deck app isn't installed on this PC. Install it from elgato.com/downloads first, then click Install again.");
        if (s.appTooOld) return fail(res, 409, `Update the Stream Deck app first: you have ${s.appVersion}, the BeeboScore plugin needs ${s.minApp} or newer. Get it from elgato.com/downloads, then click ${s.installed ? 'Update' : 'Install'} again.`);
        config.sdOffered = s.bundledVersion; saveConfig();
        sdOpen(); return ok(res, { ok: true, action: !s.installed ? 'install' : s.outdated ? 'update' : 'reinstall', ...s });
      }
      if (p === '/downloads/beeboscore.streamDeckPlugin' && method === 'GET') {
        if (!opts.streamDeckPlugin || !fs.existsSync(opts.streamDeckPlugin)) return fail(res, 404, 'Not in this build.');
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="com.t1fgc.beeboscore.lite.streamDeckPlugin"', 'X-Content-Type-Options': 'nosniff' });
        return fs.createReadStream(opts.streamDeckPlugin).pipe(res);
      }

      // ---- self-test: checks the things that only a real PC can tell (Settings › Updates & about › Run self-test)
      if (p === '/selftest' && method === 'GET') { if (localOnly()) return; return serveFile(req, res, path.join(PUBLIC_DIR, 'selftest.html')); }
      if (p === '/selftest/card' && method === 'GET') {
        if (localOnly()) return;
        return send(res, 200, `<!DOCTYPE html><meta charset="utf-8"><body style="margin:0;width:1920px;height:1080px;background:linear-gradient(135deg,#c3132d,#1a0408);display:grid;place-items:center;font:800 120px system-ui;color:#fff">BeeboScore ✔<script>setTimeout(()=>{window.__SB_SHOT_READY=true},150)</script>`, 'text/html; charset=utf-8');
      }
      if (p === '/api/selftest' && method === 'POST') {
        if (localOnly()) return;
        return ok(res, await selftest.run({ APP_VERSION, opts, DATA_DIR, BACKUP_DIR, sggVault, actualPort, potato, potatoRender, latency, tunnel, sggHas, sggTok, startgg, chat, config }));
      }
      if (p === '/api/whatsnew' && method === 'GET') {        // the newest changelog section, for the "What's new" card
        let md = ''; try { md = fs.readFileSync(path.join(BUNDLE_DIR, 'CHANGELOG.md'), 'utf8'); } catch {}
        const m = md.match(/\n### ([^\n]+)\n([\s\S]*?)(?=\n### |\n## |$)/);
        return ok(res, m ? { version: APP_VERSION, title: m[1].trim(), items: m[2].split('\n').reduce((out, l) => { if (/^- /.test(l)) out.push(l.slice(2).trim()); else if (/^\s+- /.test(l) && out.length) out[out.length - 1] += (/:$/.test(out[out.length - 1]) ? ' ' : '; ') + l.replace(/^\s+- /, '').trim(); return out; }, []).slice(0, 16) } : { version: APP_VERSION, title: '', items: [] });
      }
      if (p === '/api/info') {
        return ok(res, {
          version: APP_VERSION, testBuild: !!opts.testBuild, publisher: 'Beebo', port: actualPort, urls: local ? lanUrls() : [], local, lan: isLan(req), cloud: CLOUD, desktop: !!opts.desktop, station: STATION, stations: !!opts.stations,
          overlaysDir: local ? OVERLAYS_DIR : '', activeOverlay: config.activeOverlay, games: GAMES,
        });
      }
      if (p === '/api/auth') return ok(res, { local, cloud: CLOUD, hasPassword: !!config.passwordHash, envPassword: !!process.env.ADMIN_PASSWORD, sessions: local ? activeSessions() : undefined });
      if (p === '/api/auth/signout-all' && method === 'POST') {
        if (localOnly()) return;
        sessions.clear();
        return ok(res, { ok: true, sessions: 0 });
      }
      if (p === '/api/auth/password' && method === 'POST') {
        if (localOnly()) return;
        if (process.env.ADMIN_PASSWORD) return fail(res, 400, 'The password is set by ADMIN_PASSWORD on this server.');
        const { password } = await readJSONBody(req);
        if (typeof password !== 'string' || password.length < 8) return fail(res, 400, 'Use at least 8 characters.');
        if (password.length > 200) return fail(res, 400, 'That password is too long.');
        if (/^(.)\1+$/.test(password) || /^(password|12345678|qwerty)/i.test(password)) return fail(res, 400, 'Pick something harder to guess.');
        config.passwordHash = hashPw(password);
        sessions.clear();
        saveConfig();
        return ok(res);
      }

      if (p === '/api/state/undo' && method === 'POST') {
        if (!undoOnce()) return fail(res, 400, 'Nothing to undo.');
        return ok(res, { state, left: history.length });
      }
      if (p === '/api/overlays/refresh' && method === 'POST') { if (localOnly()) return; refreshOverlays(150); return ok(res, { ok: true }); }
      if (p === '/api/obs/refresh' && method === 'POST') { if (localOnly()) return; return ok(res, await refreshObs()); }
      // BeeboFX: a manual moment on the layout's effects (Stream Deck "Hype burst"), or the effects quality
      if (p === '/api/fx' && method === 'POST') {
        const b = await readJSONBody(req);
        if (b.quality !== undefined) { const q = String(b.quality); config.settings.fxQuality = ['auto', 'full', 'light', 'off', 'ultra'].includes(q) ? q : 'auto'; saveConfig(); broadcast('settings', config.settings); }
        if (b.kind) { fxCue = { n: fxCue.n + 1, kind: ['hype', 'electro', 'slice', 'fissure', 'point', 'mp', 'win', 'mend', 'crack'].includes(b.kind) ? b.kind : 'hype', ...([1, 2].includes(Number(b.side)) ? { side: Number(b.side) } : {}) }; }
        broadcast('state', liveState());
        return ok(res, { quality: config.settings.fxQuality, cue: fxCue });
      }
      if (p === '/api/vs' && method === 'POST') {
        const b = await readJSONBody(req);
        const show = b.show === 'toggle' ? !(state.vs && state.vs.show) : !!b.show;
        setState({ vs: { show } }, { undo: true });
        return ok(res, state);
      }
      if (p === '/api/victory' && method === 'POST') {
        const b = await readJSONBody(req);
        await remoteAction({ action: 'victory', show: b.show });
        return ok(res, { state });
      }
      if (p === '/api/splash' && method === 'POST') {
        const b = await readJSONBody(req);
        await remoteAction({ action: 'splash', kind: b.kind, show: b.show });
        return ok(res, { state, bracket: bracketStatus() });
      }
      if (p === '/api/bracket' && method === 'GET') return ok(res, bracketStatus());
      if (p === '/api/bracket/side' && method === 'POST') { const b = await readJSONBody(req); await remoteAction({ action: 'bracketSide', side: b.side }); return ok(res, { state, bracket: bracketStatus() }); }
      if (p === '/api/bracket/refresh' && method === 'POST') { await loadBracket(true); return ok(res, bracketStatus()); }
      if (p === '/api/bracket/group' && method === 'POST') {
        const b = await readJSONBody(req);
        config.bracketGroup = b.id && b.id !== 'auto' ? String(b.id).slice(0, 40) : '';
        saveConfig(); await loadBracket(true); return ok(res, bracketStatus());
      }
      if (p === '/api/vs/refresh' && method === 'POST') {
        runFetched[1] = runFetched[2] = ''; syncRuns(true);
        return ok(res, { ok: true });
      }
      if (p === '/api/state') {
        if (method === 'POST') { const b = await readJSONBody(req); if (b && typeof b === 'object') { delete b.vs; delete b.splash; delete b.victory; } apTouch(); setState(b); return ok(res, state); }
        if (method === 'PUT') { apTouch(); setState(await readJSONBody(req), { replace: true }); return ok(res, state); }
      }

      // ---- backup & restore (this PC only)
      if (p === '/api/backup' && method === 'GET') {
        if (localOnly()) return;
        const b = makeBackup();
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${b.name}"`, 'Cache-Control': 'no-store', 'X-Backup-Summary': JSON.stringify(b.summary) });
        return res.end(b.buf);
      }
      if (p === '/api/backups' && method === 'GET') { if (localOnly()) return; let list = []; try { list = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.beebo-backup')).map(f => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, at: st.mtimeMs, size: st.size }; }).sort((a, b) => b.at - a.at); } catch {} return ok(res, { list, keep: backup.KEEP }); }
      if (p === '/api/backups/open' && method === 'POST') { if (localOnly()) return; fs.mkdirSync(BACKUP_DIR, { recursive: true }); openInOS(BACKUP_DIR); return ok(res, { ok: true }); }
      if (p === '/api/backups/now' && method === 'POST') { if (localOnly()) return; const b = makeBackup(); fs.mkdirSync(BACKUP_DIR, { recursive: true }); fs.writeFileSync(path.join(BACKUP_DIR, b.name), b.buf); return ok(res, { saved: b.name, summary: b.summary }); }
      if (p === '/api/backup/restore' && method === 'POST') {
        if (localOnly()) return;
        let doc; try { doc = backup.parse(await readBody(req, 300 * 1024 * 1024)); } catch (e) { return fail(res, 400, e.message); }
        if (url.searchParams.get('check')) return ok(res, { summary: backup.summarize(doc) });
        try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); const before = makeBackup(); fs.writeFileSync(path.join(BACKUP_DIR, 'before-restore ' + before.name.replace(/^BeeboScore backup /, '')), before.buf); } catch {}
        const r = backup.restore(doc, { dataDir: DATA_DIR, overlaysDir: OVERLAYS_DIR, current: config });
        writeJSON(CONFIG_FILE, r.config);
        ok(res, { restored: true, layouts: r.layouts, assets: r.assets, restarting: !!opts.restart });
        if (opts.restart) setTimeout(() => opts.restart(), 600);
        else { config = { activeOverlay: 'tekken8-default', startgg: {}, ...r.config }; renameOldLayouts(config); config.vsArt = cleanVsArt(config.vsArt); players = readJSON(PLAYERS_FILE, []); }
        return;
      }
      if (p === '/api/settings') {
        if (method === 'GET') return ok(res, { ...config.settings, bracketTitle: bracketTitle() });
        if (method === 'POST') {
          if (localOnly()) return;
          const body = await readJSONBody(req);
          if ('bracketTitle' in body) {
            const m = config.bracketTitles = config.bracketTitles || {}; m[titleKey()] = String(body.bracketTitle || '').trim().slice(0, 40);
            const keys = Object.keys(m); if (keys.length > 30) delete m[keys[0]];
            body.bracketTitle = '';                       // the old one-for-everything setting is retired
          }
          for (const k of Object.keys(DEFAULT_SETTINGS)) {
            if (!(k in body)) continue;
            if (k === 'shortcuts') {           // { action: "Ctrl+Shift+X" } — short plain strings only
              const sc = {};
              if (body.shortcuts && typeof body.shortcuts === 'object') for (const [a, v] of Object.entries(body.shortcuts)) if (/^[a-zA-Z0-9]{1,20}$/.test(a) && typeof v === 'string' && v.length <= 40) sc[a] = v;
              config.settings.shortcuts = sc;
            } else config.settings[k] = typeof DEFAULT_SETTINGS[k] === 'boolean' ? !!body[k] : String(body[k] ?? '').trim();
          }
          if (!['classic', 'shattered', 'custom', 'contrast', ...UI_THEMES].includes(config.settings.uiTheme)) config.settings.uiTheme = 'classic';
          if (!['0', '10', '20', '45'].includes(String(config.settings.bracketRefresh))) config.settings.bracketRefresh = '20';
          if (!['0', '8', '14', '20', '30', '45', '60'].includes(String(config.settings.bracketPage))) config.settings.bracketPage = '14';
          if (!['0', '5', '8', '12', '20'].includes(String(config.settings.victoryHold))) config.settings.victoryHold = '8';
          if (!['avatar', 'character'].includes(config.settings.bracketPics)) config.settings.bracketPics = 'avatar';
          if (!['off', 'ask', 'auto'].includes(config.settings.sggReport)) config.settings.sggReport = 'ask';
          config.settings.soundVolume = String(soundVol());
          { const v = Math.round(Number(config.settings.formatBarOpacity)); config.settings.formatBarOpacity = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80; }
          if (!['auto', 'full', 'light', 'off', 'ultra'].includes(config.settings.fxQuality)) config.settings.fxQuality = 'auto';
          if (!['full', 'glass'].includes(config.settings.vsStyle)) config.settings.vsStyle = 'full';
          for (const k of ['vsColor1', 'vsColor2']) if (!/^#[0-9a-f]{6}$/i.test(String(config.settings[k] || ''))) config.settings[k] = ''; if (!['team', 'layout'].includes(config.settings.overlayColours)) config.settings.overlayColours = 'team'; if (!['follow', 'all'].includes(config.settings.sdLayout)) config.settings.sdLayout = 'follow'; if (!['auto', 'ai', 'smart', 'off'].includes(config.settings.upscale)) config.settings.upscale = 'auto';
          // 1.12.18: languages, the sound pack, colour-blind-safe colours, 4K, the panel's text size and theme, the gallery, the keys' colour
          if (!SHOWMOD.LANGS.includes(config.settings.overlayLang)) config.settings.overlayLang = 'en';
          if (!SHOWMOD.SFX.includes(config.settings.sfxPack)) config.settings.sfxPack = 'off';
          if (!SHOWMOD.OUT.includes(config.settings.outScale)) config.settings.outScale = 'auto';
          if (!['100', '115', '130', '150'].includes(String(config.settings.uiScale))) config.settings.uiScale = '100';
          if (!/^#[0-9a-f]{6}$/i.test(String(config.settings.sdAccent || ''))) config.settings.sdAccent = '';
          { let ok2 = ''; try { const t = JSON.parse(config.settings.customTheme || 'null'); if (t && typeof t === 'object') { const o = {}; for (const [k, v] of Object.entries(t)) if (/^[a-z0-9]{1,12}$/i.test(k) && (/^#[0-9a-f]{6}$/i.test(String(v)) || /^\d{1,3}$/.test(String(v)))) o[k] = String(v); ok2 = JSON.stringify(o); } } catch {} config.settings.customTheme = ok2; }
          { const g = String(config.settings.galleryUrl || '').replace(/\/+$/, ''); config.settings.galleryUrl = /^https:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(g) || (process.env.NOTIFY_ALLOW_LOCAL === '1' && /^http:\/\/127\.0\.0\.1:\d+$/.test(g)) ? g : ''; }
          if (!['classic', 'shattered', 'custom', 'contrast', ...UI_THEMES].includes(config.settings.uiTheme)) config.settings.uiTheme = 'classic';
          for (const k of ['venueBracket', 'venueNext', 'venueClock', 'venueQr']) config.settings[k] = !!config.settings[k];          // 1.12.19: the venue screen
          { const q = String(config.settings.venueQrUrl || '').trim().slice(0, 300); config.settings.venueQrUrl = /^https?:\/\/[^\s"<>]+$/i.test(q) ? q : ''; }
          if (!['2', '3', '4', '6', '8', '12', '16'].includes(String(config.settings.upsetGap))) config.settings.upsetGap = '4';          // 1.12.21
          if (body.moments === false && SHOW) try { SHOW.moments.clear(); } catch {}
          saveConfig();
          if (updater && updater.configure) updater.configure(config.settings);
          broadcast('settings', config.settings);
          if (['overlayLang', 'sfxPack', 'cvd', 'outScale', 'sbGameNo', 'moments', 'moGame', 'reduceMotion', 'vsStrip'].some(k => k in body)) broadcast('state', liveState());
          if ('autoTop8' in body || 'bracketTitle' in body || 'bracketPics' in body) publishBracket();
          if ('sggReport' in body) reportsChanged();
          if ('lightFx' in body) hub.broadcast('fx', { light: !!config.settings.lightFx });
          if ('fxQuality' in body || 'lightFx' in body || 'laptopMode' in body || 'lockSplash' in body || 'formatBarOpacity' in body || 'vsStyle' in body || 'vsColor1' in body || 'vsColor2' in body || 'overlayColours' in body || 'upscale' in body) broadcast('state', liveState());
          if ('soundOn' in body || 'soundVolume' in body || 'obsVolume' in body) broadcast('state', liveState());
          if ('bracketRefresh' in body) bracketWatch(false);
          if ('bracketPage' in body) { publishBracket(); pageClock(); }
          return ok(res, { ...config.settings, bracketTitle: bracketTitle() });
        }
      }

      if (p === '/api/players') {
        if (method === 'GET') return ok(res, allPlayers());
        if (method === 'DELETE') {
          if (localOnly()) return;
          const { name } = await readJSONBody(req);
          players = players.filter(x => x.name !== name);
          saveLater(PLAYERS_FILE, () => players, 0);
          return ok(res, allPlayers());
        }
      }

      // ---------- splash pictures: start.gg profile picture, or an uploaded character image, per player ----------
      if (p === '/api/player-art') {
        if (method === 'GET') return ok(res, { items: picsList(), rules: PIC_RULES });
        if (localOnly()) return;
        if (method === 'POST') {                         // the picture is the request body; ?name= says whose it is
          const who = String(url.searchParams.get('name') || '').trim().slice(0, 80), key = picKey(who);
          if (!key) return fail(res, 400, 'Pick a player first.');
          const buf = await readBody(req, PIC_RULES.maxBytes).catch(() => null);
          if (!buf) return fail(res, 413, 'That picture is over 8 MB. Save it smaller and try again.');
          const info = imageInfo(buf);
          if (!info) return fail(res, 400, 'Use a PNG, WebP or JPG picture.');
          if (info.w < PIC_RULES.minWidth || info.h < PIC_RULES.minHeight) return fail(res, 400, `That picture is ${info.w} × ${info.h}. It needs to be at least ${PIC_RULES.minWidth} × ${PIC_RULES.minHeight}; ${PIC_RULES.width} × ${PIC_RULES.height} looks best.`);
          if (info.w > PIC_RULES.maxSide || info.h > PIC_RULES.maxSide) return fail(res, 400, `That picture is ${info.w} × ${info.h}. Keep each side under ${PIC_RULES.maxSide} px; ${PIC_RULES.width} × ${PIC_RULES.height} is plenty.`);
          fs.mkdirSync(PICS_DIR, { recursive: true });
          const at = Date.now(), file = `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}-${at}.${info.ext}`, old = pics[key];
          fs.writeFileSync(path.join(PICS_DIR, file), buf);
          if (old && old.file) { try { fs.unlinkSync(path.join(PICS_DIR, path.basename(old.file))); } catch {} }
          pics[key] = { name: who, file, type: info.type, w: info.w, h: info.h, size: buf.length, at, use: 'art' };     // uploading a picture means: use it
          picsChanged(); return ok(res, { items: picsList(), item: picsList().find(x => picKey(x.name) === key) });
        }
        const b = await readJSONBody(req), key = picKey(b && b.name), cur = pics[key];
        if (method === 'PATCH') {                        // which picture this player uses
          const use = b.use === 'art' ? 'art' : 'profile';
          if (use === 'art' && !(cur && cur.file)) return fail(res, 400, 'Upload a character image for this player first.');
          if (cur) { cur.use = use; picsChanged(); }
          return ok(res, { items: picsList() });
        }
        if (method === 'DELETE') {
          if (cur) { if (cur.file) { try { fs.unlinkSync(path.join(PICS_DIR, path.basename(cur.file))); } catch {} } delete pics[key]; picsChanged(); }
          return ok(res, { items: picsList() });
        }
      }


      // ---------- updates (desktop app) ----------
      if (p === '/api/update') {
        if (!updater) return ok(res, { supported: false, state: 'unsupported', version: APP_VERSION });
        if (method === 'GET') return ok(res, updater.status());
        if (localOnly()) return;
        const { action } = await readJSONBody(req);
        if (action === 'check') return ok(res, await updater.check());
        if (action === 'install') { flushSaves(); if (updater.install() === false) return fail(res, 409, 'The update isn’t ready yet. Try Check for updates again.'); return ok(res); }
        return fail(res, 400, 'Unknown action.');
      }

      // ---------- start.gg ----------
      if (p === '/api/startgg' && method === 'GET') return ok(res, sggStatus());
      if (p === '/api/startgg/signin' && method === 'POST') {
        if (localOnly()) return;
        try {
          const r = await sggAuth.begin();
          r.done.then(me => { broadcast('startgg-auth', { ok: true, name: me && me.name }); }).catch(e => broadcast('startgg-auth', { ok: false, error: e.message }));
          return ok(res, { url: r.url });
        } catch (e) { return fail(res, 400, e.message); }
      }
      if (p === '/api/notify' && method === 'GET') return ok(res, notify.status());
      if (p === '/api/notify' && method === 'POST') {
        const b = await readJSONBody(req).catch(() => ({}));
        try {
          if ('url' in b) { if (localOnly()) return; notify.setUrl(b.url); }
          if (b.on && typeof b.on === 'object') notify.setOn(b.on);
        } catch (e) { return fail(res, 400, e.message); }
        return ok(res, notify.status());
      }
      if (p === '/api/notify/test' && method === 'POST') { try { return ok(res, await notify.test()); } catch (e) { return fail(res, 400, e.message); } }
      if (p === '/api/startgg/reports' && method === 'GET') return ok(res, reportsOut());
      if (p === '/api/startgg/report' && method === 'POST') {
        const b = await readJSONBody(req).catch(() => ({}));
        const r = reportable();
        if (!r) return fail(res, 400, config.bracketSource === 'viewer' ? 'This is a viewer tournament — its results stay in BeeboScore.' : !state.setId ? 'Load this match from the start.gg bracket ("Next match" or the Matches list) so BeeboScore knows which set it is.' : !winnerOf(state) ? 'Nobody has won this set yet.' : 'Both players need to come from start.gg to report this set.');
        if (b.setId && String(b.setId) !== r.setId) return fail(res, 409, 'The match on the scoreboard changed. Try again.');
        enqueueReport(r, 'button'); return ok(res, reportsOut());
      }
      if (p === '/api/startgg/quick' && method === 'POST') {          // one-click report from the Matches list / bracket view: the winner (or a DQ), no score needed
        if (localOnly()) return;
        const b = await readJSONBody(req).catch(() => ({}));
        if (!sggHas()) return fail(res, 400, 'Sign in with start.gg (or save an API token) first.');
        const setId = String(b.setId || ''), winnerId = String(b.winnerId || ''), loserId = String(b.loserId || '');
        if (!setId || !winnerId || !loserId || winnerId === loserId) return fail(res, 400, 'Both players have to be in the match.');
        const names = Array.isArray(b.names) ? b.names.slice(0, 2).map(x => String(x || '').slice(0, 60)) : ['', ''];
        const ws = b.wScore === '' || b.wScore == null ? '' : Math.max(0, Math.min(9, Number(b.wScore) || 0)), ls = ws === '' ? '' : Math.max(0, Math.min(9, Number(b.lScore) || 0));
        const item = enqueueReport({ setId, winnerId, loserId, wScore: ws, lScore: ls, isDQ: !!b.isDQ, names, round: String(b.round || '').slice(0, 60), key: `${setId}:${winnerId}:${b.isDQ ? 'dq' : ws + '-' + ls}` }, b.isDQ ? 'dq' : 'click');
        return ok(res, { ok: true, status: item.status, reports: reportsOut() });
      }
      if (p === '/api/startgg/reset' && method === 'POST') {          // put a reported set back (start.gg resets it, and anything after it)
        if (localOnly()) return;
        const b = await readJSONBody(req).catch(() => ({}));
        if (!sggHas()) return fail(res, 400, 'Sign in with start.gg first.');
        try { await startgg.resetSet(sggTok(), String(b.setId || '')); } catch (e) { return fail(res, 400, e.message || 'start.gg didn’t reset that set.'); }
        loadBracket(true).catch(() => {}); return ok(res, { ok: true });
      }
      if (p === '/api/startgg/report/undo' && method === 'POST') {
        const b = await readJSONBody(req).catch(() => ({}));
        const r = [...config.sggReports].reverse().find(x => x.setId === String(b.setId || ''));
        if (!r) return fail(res, 404, 'No report for that set.');
        if (r.status === 'pending') { r.status = 'undone'; reportsChanged(); return ok(res, reportsOut()); }
        if (r.status !== 'sent') return fail(res, 400, 'Only a sent result can be undone.');
        r.status = 'undoing'; r.tries = 0; reportsChanged(); setTimeout(reportWork, 10); return ok(res, reportsOut());
      }
      if (p === '/api/startgg/signout' && method === 'POST') { if (localOnly()) return; sggAuth.logout(); return ok(res, sggStatus()); }
      if (p === '/api/startgg/app' && method === 'POST') {
        if (localOnly()) return;
        try { sggAuth.setApp(await readJSONBody(req)); return ok(res, sggStatus()); } catch (e) { return fail(res, 400, e.message); }
      }
      if (p === '/api/startgg/mine' && method === 'GET') {
        if (!sggAuth.signedIn()) return fail(res, 401, 'Sign in with start.gg first.');
        try { return ok(res, await startgg.loadMyTournaments(() => sggAuth.token(), { page: Math.max(1, Number(url.searchParams.get('page')) || 1) })); } catch (e) { return fail(res, 400, e.message); }
      }
      if (p === '/api/startgg/pull' && method === 'POST') {          // one of your tournaments → the current tournament + its players
        if (localOnly()) return;
        const { slug, eventId } = await readJSONBody(req);
        try {
          const t = await startgg.loadTournament(sggTok(), String(slug || ''));
          config.startgg.link = `start.gg/${/^tournament\//.test(t.slug || '') ? t.slug : 'tournament/' + (t.slug || slug)}`;
          config.startgg.tournament = { id: t.id, name: t.name, slug: t.slug, events: t.events };
          config.startgg.eventId = (eventId && t.events.some(e => String(e.id) === String(eventId)) ? eventId : null) || t.selectedEventId || (t.events.length === 1 ? t.events[0].id : (t.events.slice().sort((a, b) => (b.numEntrants || 0) - (a.numEntrants || 0))[0] || {}).id) || null;
          saveConfig();
          if (config.startgg.eventId) await importEntrants();
          resetBracket();
          return ok(res, sggStatus());
        } catch (e) { return fail(res, 400, e.message); }
      }
      if (p === '/api/startgg/token' && method === 'POST') {
        if (localOnly()) return;
        const { token } = await readJSONBody(req);
        config.startgg.token = String(token || '').trim();
        saveConfig();
        return ok(res, sggStatus());
      }
      if (p === '/api/startgg/tournament' && method === 'POST') {
        const { link } = await readJSONBody(req);
        const t = await startgg.loadTournament(sggTok(), link);
        config.startgg.link = link;
        config.startgg.tournament = { id: t.id, name: t.name, slug: t.slug, events: t.events };
        config.startgg.eventId = t.selectedEventId || (t.events.length === 1 ? t.events[0].id : null);
        saveConfig();
        if (config.startgg.eventId) await importEntrants();
        resetBracket();
        return ok(res, sggStatus());
      }
      if (p === '/api/startgg/event' && method === 'POST') {
        const { eventId } = await readJSONBody(req);
        config.startgg.eventId = eventId;
        saveConfig();
        await importEntrants();
        resetBracket();
        return ok(res, sggStatus());
      }
      if (p === '/api/startgg/import' && method === 'POST') { await importEntrants(); return ok(res, sggStatus()); }
      if (p === '/api/startgg/sets' && method === 'GET') {
        const s = config.startgg;
        if (url.searchParams.get('mode') === 'stream') {
          if (!s.tournament) return fail(res, 400, 'Load a tournament first.');
          return ok(res, await startgg.loadStreamQueue(sggTok(), s.tournament.slug));
        }
        if (!s.eventId) return fail(res, 400, 'Pick an event first.');
        return ok(res, await startgg.loadSets(sggTok(), s.eventId));
      }
      if (p === '/api/startgg/clear' && method === 'POST') {
        // 1.12.24: Unload (Bracket tab) — the tournament, its event, its players and its bracket go; the token and the sign-in stay,
        // and so does the link, so Load brings it straight back
        const was = config.startgg.tournament ? config.startgg.tournament.name : '';
        config.startgg = { token: config.startgg.token, oauth: config.startgg.oauth, link: config.startgg.link || '' };
        sggEntrants = [];
        if (was && SHOW) try { SHOW.note('off', `start.gg tournament unloaded: ${was}`); } catch {}
        resetBracket();
        saveLater(STARTGG_FILE, () => sggEntrants, 0);
        saveConfig();
        broadcast('players', allPlayers());
        return ok(res, sggStatus());
      }

      // ---------- go online (tunnel) ----------
      if (p === '/api/tunnel' && method === 'GET') return ok(res, tunnel.status);
      if (p === '/api/short' && method === 'POST') {       // a short link (/s/<code>) for a page anyone may see
        const b = await readJSONBody(req), sp = shortPath(b && b.path);
        if (!sp) return fail(res, 400, 'That page can’t have a short link (only overlays, the live bracket page and sidebars can).');
        return ok(res, { path: sp });
      }
      if (p === '/api/short/public' && method === 'POST') {     // an even shorter link for the online address, from a free link shortener (is.gd)
        if (localOnly()) return;
        const b = await readJSONBody(req); let u; try { u = new URL(String(b && b.url || '')); } catch { return fail(res, 400, 'That isn’t a link.'); }
        const online = tunnel.status.state === 'online' && tunnel.status.url ? new URL(tunnel.status.url).host : '';
        // only this app's own online address, and only a page anyone may see (never the control panel)
        if (!online || u.host !== online || u.protocol !== 'https:' || !(/^\/s\/[A-Za-z0-9]{8}$/.test(u.pathname) ? shorts.resolve(u.pathname.slice(3)) : shorts.clean(u.pathname + u.search))) return fail(res, 400, 'Only a page of your online address that anyone may see can be shortened (an overlay or the live bracket page).');
        publicShort = publicShort || new Map();
        if (publicShort.has(u.href)) return ok(res, { url: publicShort.get(u.href) });
        const tries = [`https://is.gd/create.php?format=simple&url=${encodeURIComponent(u.href)}`, `https://v.gd/create.php?format=simple&url=${encodeURIComponent(u.href)}`];
        for (const t of tries) {
          try {
            const r = await fetch(t, { signal: AbortSignal.timeout(6000) }), txt = (await r.text()).trim();
            if (r.ok && /^https:\/\/(is|v)\.gd\/[\w-]{3,20}$/.test(txt)) { publicShort.set(u.href, txt); return ok(res, { url: txt }); }
          } catch {}
        }
        return fail(res, 502, 'The link shortener didn’t answer. Use the BeeboScore short link, or your own tunnel address (Go online › Permanent address).');
      }
      if (p === '/api/tunnel/start' && method === 'POST') {
        if (localOnly()) return;
        if (!config.passwordHash) return fail(res, 400, 'Set a remote-control password first.');
        const nt = config.namedTunnel || {}, tok = nt.on && nt.sealed ? (sggVault.open(nt.sealed) || {}).t : '';
        tunnel.start(actualPort, tok && nt.host ? { token: tok, host: nt.host } : null);
        return ok(res, tunnel.status);
      }
      // your own Cloudflare tunnel (a permanent online address); the token is stored encrypted and never sent back
      if (p === '/api/tunnel/named') {
        if (localOnly()) return;
        if (method === 'GET') { const nt = config.namedTunnel || {}; return ok(res, { on: !!nt.on, host: nt.host || '', hasToken: !!nt.sealed }); }
        if (method === 'POST') {
          const b = await readJSONBody(req), nt = config.namedTunnel || {};
          if ('host' in b) { const h = String(b.host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (h && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return fail(res, 400, 'That doesn’t look like an address (e.g. bracket.yourdomain.com).'); nt.host = h; }
          if ('token' in b) { let t = String(b.token || '').trim(); const inCmd = t.match(/(?:--token\s+|install\s+)?(eyJ[A-Za-z0-9+/=_-]{40,4000})/); if (inCmd) t = inCmd[1]; /* the whole install command Cloudflare shows works too */ if (t && !/^[A-Za-z0-9+/=_-]{40,4000}$/.test(t)) return fail(res, 400, 'That doesn’t look like a Cloudflare tunnel token.'); nt.sealed = t ? sggVault.seal({ t }) : ''; }
          if ('on' in b) nt.on = !!b.on;
          if (nt.on && (!nt.host || !nt.sealed)) nt.on = false;
          config.namedTunnel = nt; saveConfig();
          return ok(res, { on: !!nt.on, host: nt.host || '', hasToken: !!nt.sealed });
        }
      }
      if (p === '/api/tunnel/stop' && method === 'POST') {
        if (localOnly()) return;
        tunnel.stop();
        return ok(res, tunnel.status);
      }

      // ---------- custom VS Splash pictures: a name bar and a header ----------
      if (p === '/api/vs-art') {
        if (method === 'GET') return ok(res, vsArtView());
        if (localOnly()) return;
        const kind = url.searchParams.get('kind') === 'header' ? 'header' : 'bar', a = config.vsArt;
        const drop = k => { if (a[k] && a[k].file) { try { fs.unlinkSync(path.join(VSART_DIR, path.basename(a[k].file))); } catch {} } a[k] = null; };
        if (method === 'POST') {                         // the picture is the request body; ?kind=bar|header
          const buf = await readBody(req, VSART_RULES.maxBytes).catch(() => null);
          if (!buf) return fail(res, 413, 'That picture is over 8 MB. Save it smaller and try again.');
          const info = imageInfo(buf), want = VSART_RULES[kind];
          if (!info) return fail(res, 400, 'Use a PNG, WebP or JPG picture.');
          if (info.w > VSART_RULES.maxSide || info.h > VSART_RULES.maxSide) return fail(res, 400, `That picture is ${info.w} × ${info.h}. Keep each side under ${VSART_RULES.maxSide} px; ${want.width} × ${want.height} is the size it is shown at.`);
          fs.mkdirSync(VSART_DIR, { recursive: true });
          const at = Date.now(), file = `${kind}-${at}.${info.ext}`;
          fs.writeFileSync(path.join(VSART_DIR, file), buf);
          drop(kind); a[kind] = { file, w: info.w, h: info.h, at };
          if (kind === 'bar') a.auto = true;             // a new name bar starts with lettering fitted to it
          vsArtChanged(); return ok(res, vsArtView());
        }
        if (method === 'PATCH') {                        // lettering colours, mirroring, and what the panel worked out from the picture
          const b = await readJSONBody(req) || {};
          config.vsArt = cleanVsArt({ ...a, ...(typeof b.mirror === 'boolean' ? { mirror: b.mirror } : {}), ...(typeof b.auto === 'boolean' ? { auto: b.auto } : {}), ...(b.ink ? { ink: b.ink } : {}), ...(b.accent ? { accent: b.accent } : {}),
            ...(typeof b.scrim === 'boolean' ? { scrim: b.scrim } : {}), ...(b.fit && typeof b.fit === 'object' ? { fit: b.fit } : {}) });
          vsArtChanged(); return ok(res, vsArtView());
        }
        if (method === 'DELETE') { drop(kind); vsArtChanged(); return ok(res, vsArtView()); }
        return fail(res, 405, 'Use GET, POST, PATCH or DELETE.');
      }


      // ---------- overlays ----------
      if (p === '/api/overlays' && method === 'GET') return ok(res, listOverlays());
      if (p === '/api/overlays/active' && method === 'POST') {
        let { name } = await readJSONBody(req);
        if (!overlayExists(name) && (MOVED_LAYOUTS[name] || RENAMED_LAYOUTS[name])) name = MOVED_LAYOUTS[name] || RENAMED_LAYOUTS[name];   // a Stream Deck key set up with a retired layout
        if (!overlayExists(name)) return fail(res, 404, 'Layout not found.');
        setActive(name);
        return ok(res, { activeOverlay: config.activeOverlay });
      }
      if (p === '/api/overlays/upload' && method === 'POST') {       // (older clients) the same as the Layouts tab's import
        if (localOnly()) return;
        const body = await readJSONBody(req);
        const files = (Array.isArray(body.files) ? body.files : []).map(f => ({ path: f && f.path, data: Buffer.from(String(f && f.data || ''), 'base64') }));
        try { return ok(res, importLayout({ files, title: body.name, game: body.game, replace: true })); }
        catch (e) { return send(res, e.status || 500, { error: e.message, code: e.code || '' }); }
      }
      // 1.5.1: the Layouts tab — bring in a layout (a folder, loose files or a .zip), share one, remove one, the starter layout
      if (p === '/api/layouts/import' && method === 'POST') {
        if (localOnly()) return;
        const body = await readJSONBody(req);
        try {
          let files;
          if (body.zip) files = zip.readZip(Buffer.from(String(body.zip), 'base64'));
          else files = (Array.isArray(body.files) ? body.files : []).map(f => ({ path: f && f.path, data: Buffer.from(String(f && f.data || ''), 'base64') }));
          if (!files.length) return fail(res, 400, 'There’s nothing in there.');
          const r = importLayout({ files, title: body.title, game: body.game, replace: !!body.replace, fileName: body.fileName });
          if (body.goLive) setActive(r.name);
          return ok(res, r);
        } catch (e) { return send(res, e.status || 500, { error: e.message, code: e.code || '', layout: e.layout || '' }); }
      }
      if (p === '/api/layouts/remove' && method === 'POST') {
        if (localOnly()) return;
        const name = safeName((await readJSONBody(req)).name);
        if (isBuiltIn(name)) return fail(res, 400, 'The app’s own layouts can’t be removed.');
        if (!name || !fs.existsSync(overlayDir(name))) return fail(res, 404, 'Layout not found.');
        if (config.activeOverlay === name) { const f = fallbackLayout(name); if (f) setActive(f); }
        const to = retireLayout(name);
        overlaysChanged();
        return ok(res, { ok: true, kept: to ? path.relative(APP_DIR, to).split(path.sep).join('/') : '', active: config.activeOverlay });
      }
      if (p === '/api/layouts/export' && method === 'GET') {
        if (localOnly()) return;
        const name = safeName(url.searchParams.get('name'));
        if (!overlayExists(name)) return fail(res, 404, 'Layout not found.');
        const title = String(readJSON(path.join(overlayDir(name), 'overlay.json'), {}).title || name).replace(/[\\/:*?"<>|]+/g, '').trim() || name;
        return sendZip(res, folderZip(overlayDir(name), title + '/'), `${title}.zip`);
      }
      if (p === '/api/layouts/starter.zip' && method === 'GET') return sendZip(res, folderZip(STARTER_DIR, 'My layout/'), 'BeeboScore starter layout.zip');
      if (p === '/api/layouts/open' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req), name = safeName(b.name);
        const dir = b.removed ? REMOVED_DIR : name && fs.existsSync(overlayDir(name)) ? overlayDir(name) : OVERLAYS_DIR;
        fs.mkdirSync(dir, { recursive: true }); openInOS(dir);
        return ok(res, { ok: true });
      }
      if (p === '/api/overlays/new' && method === 'POST') {
        if (localOnly()) return;
        const { name, from } = await readJSONBody(req);
        const n = safeName(name);
        if (!n) return fail(res, 400, 'Give the layout a name.');
        if (fs.existsSync(overlayDir(n))) return fail(res, 409, 'A layout with that name already exists.');
        copyDir(overlayExists(from) ? overlayDir(from) : overlayDir('tekken8-shattered'), overlayDir(n));
        const metaFile = path.join(overlayDir(n), 'overlay.json');
        const meta = readJSON(metaFile, {});
        writeJSON(metaFile, { ...meta, title: n.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), version: undefined });
        const src = safeName(from);
        if (src) for (const f of ['index.html', 'design.json']) { const fp = path.join(overlayDir(n), f); if (fs.existsSync(fp)) fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8').split(`/o/${src}/assets/`).join(`/o/${n}/assets/`)); }
        overlaysChanged();
        return ok(res, { ok: true, name: n });
      }
      // ---------- Layout Designer ----------
      if (p === '/api/gallery' && method === 'GET') return ok(res, { items: galleryList() });
      const gm = p.match(/^\/api\/gallery\/([\w.-]+)$/);
      if (gm && method === 'GET') {
        for (const dir of GALLERY_DIRS()) { const f = path.join(dir, path.basename(gm[1]) + '.beebo'); if (fs.existsSync(f)) { const j = readJSON(f, null); return ok(res, { design: j && (j.design || j) }); } }
        return fail(res, 404, 'Not in the gallery.');
      }
      // BeeboScore's own art (the logo, the Stream Deck keys, the panel themes): Designer designs in art/designs, to open and change
      if (p === '/api/art' && method === 'GET') {
        let fl = []; try { fl = fs.readdirSync(ART_DIR).filter(f => /\.beebo$/i.test(f) && !/sheet/.test(f)); } catch {}
        return ok(res, { items: fl.map(f => f.replace(/\.beebo$/i, '')).sort() });
      }
      const am = p.match(/^\/api\/art\/([\w.-]+)$/);
      if (am && method === 'GET') { const j = readJSON(path.join(ART_DIR, path.basename(am[1]) + '.beebo'), null); return j ? ok(res, { design: j.design || j }) : fail(res, 404, 'Not found.'); }
      if (p === '/api/brandkits' && method === 'GET') return ok(res, { kits: readJSON(path.join(DATA_DIR, 'brandkits.json'), []) });
      if (p === '/api/brandkits' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req), kits = Array.isArray(b && b.kits) ? b.kits.slice(0, 40) : null;
        if (!kits) return fail(res, 400, 'Nothing to save.');
        const json = JSON.stringify(kits); if (json.length > 8 * 1024 * 1024) return fail(res, 413, 'Brand kits are too big (pictures?).');
        writeJSON(path.join(DATA_DIR, 'brandkits.json'), kits); return ok(res, { ok: true });
      }
      if (p === '/api/import-link' && method === 'POST') {     // open a shared .beebo link (the app fetches it, so any site works)
        if (localOnly()) return;
        const { url: u } = await readJSONBody(req); let target;
        try { target = new URL(String(u || '')); } catch { return fail(res, 400, 'That isn’t a link.'); }
        if (!/^https?:$/.test(target.protocol)) return fail(res, 400, 'Only http(s) links.');
        try {
          const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
          const r = await fetch(target, { signal: ctl.signal, redirect: 'follow' }); clearTimeout(t);
          if (!r.ok) return fail(res, 400, `The link answered ${r.status}.`);
          const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 80 * 1024 * 1024) return fail(res, 413, 'That file is too big.');
          const j = JSON.parse(buf.toString('utf8')), d = j && (j.design || (j.scenes ? j : null));
          if (!d || !d.scenes) return fail(res, 400, 'That link isn’t a BeeboScore layout.');
          return ok(res, { design: d });
        } catch (e) { return fail(res, 400, 'Couldn’t open that link: ' + (e.name === 'AbortError' ? 'it took too long.' : 'it isn’t a layout file.')); }
      }
      // 1.12.6: King of the Hill records — the leaderboard's data, a backup of it, a sheet of it, restore, reset, the folder
      // 1.12.6: the Top 8 results picture — its players (the finished bracket), saving it, and its folder
      if (p === '/api/top8/data' && method === 'GET') {
        const m = bracket.model;
        let list = m && m.finished ? (m.standings || []) : [];
        let event = m ? (m.vtName || m.tournament || m.event || '') : '', game = (m && m.game) || state.game || '', entrants = (m && m.entrants) || 0;
        if (!list.length && vt && vt.status === 'done') { list = [...VT.placements(vt)].map(([id, place]) => { const e = vt.entrants.find(x => x.id === id) || {}; return { place, name: e.name || '', avatar: e.avatar || '' }; }); event = vt.name; entrants = vt.entrants.length; }
        const players = list.filter(x => x && x.name && x.place).sort((a, b) => a.place - b.place).slice(0, 8).map(x => { const a = pics[picKey(x.name)]; return { place: x.place, name: x.name, team: x.team || '', pic: a && a.use === 'art' && a.file ? picUrl(a) : x.avatar || '' }; });
        return ok(res, { event: event || (top8Last && top8Last.name) || 'Tournament', game: String(game || '').replace(/^tekken-?8$/i, 'Tekken 8'), entrants, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), players });
      }
      if (p === '/api/top8/save' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req, 40 * 1024 * 1024), m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.png || ''));
        if (!m) return fail(res, 400, 'That isn’t a PNG picture.');
        const nm = (String(b.name || 'Top 8.png').replace(/[^\w\- .()×x]+/g, '').replace(/\.png$/i, '').trim().slice(0, 90) || 'Top 8') + '.png';
        fs.mkdirSync(TOP8_DIR, { recursive: true });
        let file = path.join(TOP8_DIR, nm), k = 2; while (fs.existsSync(file)) file = path.join(TOP8_DIR, nm.replace(/\.png$/, ` (${k++}).png`));
        fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
        return ok(res, { file, dir: TOP8_DIR });
      }
      if (p === '/api/top8/open-folder' && method === 'POST') { if (localOnly()) return; fs.mkdirSync(TOP8_DIR, { recursive: true }); openInOS(TOP8_DIR); return ok(res, { dir: TOP8_DIR }); }
      // 1.12.6: the commentary screen's settings and the camera links
      if (p === '/api/brand' && method === 'GET') return ok(res, brandCfg());
      if (p === '/api/brand' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req), c = { ...(config.brand || {}), ...brandCfg() };
        for (const k of ['showLogo', 'showSponsors', 'onBoard']) if (k in b) c[k] = !!b[k];
        if (Array.isArray(b.sponsors)) { const have = new Map(c.sponsors.map(x => [x.file, x])); c.sponsors = b.sponsors.filter(x => x && have.has(x.file)).map(x => ({ file: x.file, name: String(x.name || '').slice(0, 40) })); }
        if (b.removeLogo) { try { if (c.logo) fs.unlinkSync(path.join(BRAND_DIR, c.logo)); } catch {} c.logo = ''; }
        if (b.add && typeof b.add === 'object') {
          const m = String(b.add.data || '').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/); if (!m) return fail(res, 400, 'A PNG, JPG or WebP picture, please.');
          const buf = Buffer.from(m[2], 'base64'); if (buf.length > 4 * 1024 * 1024) return fail(res, 400, 'That picture is over 4 MB.');
          const ext = m[1] === 'jpeg' ? 'jpg' : m[1], kind = b.add.kind === 'logo' ? 'logo' : 'sp', file = `${kind}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)}.${ext}`;
          fs.mkdirSync(BRAND_DIR, { recursive: true }); fs.writeFileSync(path.join(BRAND_DIR, file), buf);
          if (kind === 'logo') { try { if (c.logo && c.logo !== file) fs.unlinkSync(path.join(BRAND_DIR, c.logo)); } catch {} c.logo = file; }
          else if (!c.sponsors.some(x => x.file === file)) { if (c.sponsors.length >= 12) return fail(res, 400, 'Up to 12 sponsors.'); c.sponsors.push({ file, name: String(b.add.name || '').slice(0, 40) }); }
        }
        for (const f of (() => { try { return fs.readdirSync(BRAND_DIR); } catch { return []; } })()) if (/^sp-/.test(f) && !c.sponsors.some(x => x.file === f)) { try { fs.unlinkSync(path.join(BRAND_DIR, f)); } catch {} }
        config.brand = c; saveConfig(); state.updatedAt = stamp(); broadcast('state', liveState());
        return ok(res, brandCfg());
      }
      if (p === '/api/comm' && method === 'GET') return ok(res, { ...commCfg(), live: Object.fromEntries([1, 2, 3, 4].map(k => [k, camOn(k)])), links: local ? camLink.list().map(l => ({ ...l, url: camUrl(l.token) })) : [], hours: camLink.HOURS, base: camBase() });
      if (p === '/api/comm' && method === 'POST') {
        const b = await readJSONBody(req), c = commCfg();
        if (b.count != null) c.count = Math.max(1, Math.min(4, Math.round(Number(b.count)) || 2));
        if (b.title != null) c.title = String(b.title).slice(0, 60);
        if (b.match != null) c.match = !!b.match;
        if (b.talk != null) c.talk = !!b.talk;
        if (b.where != null) c.where = b.where === 'scene' ? 'scene' : 'overlay';
        if (b.scene != null) c.scene = String(b.scene).slice(0, 120);
        if (Array.isArray(b.people)) b.people.slice(0, 4).forEach((p2, i) => { if (!p2 || typeof p2 !== 'object') return; const q = c.people[i]; if (p2.name != null) { q.name = String(p2.name).slice(0, 40); camLink.rename(i + 1, q.name); } if (p2.handle != null) q.handle = String(p2.handle).slice(0, 40); if (p2.mode != null) q.mode = p2.mode === 'cutout' ? 'cutout' : 'link'; });
        config.comm = c; saveConfig(); broadcast('state', liveState());
        return ok(res, { ...c, live: Object.fromEntries([1, 2, 3, 4].map(k => [k, camOn(k)])) });
      }
      if (p === '/api/comm/link' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req), slot = Math.max(1, Math.min(4, Math.round(Number(b.slot)) || 1));
        if (b.revoke) { camLink.revoke(slot); return ok(res, { ok: true }); }
        const l = camLink.create(slot, (commCfg().people[slot - 1] || {}).name, b.hours);
        return ok(res, { slot, url: camUrl(l.token), expires: l.expires, online: !!(tunnel.status.state === 'online' && tunnel.status.url) });
      }
      if (p === '/api/player-frames' && method === 'GET') return ok(res, frames);
      if (p === '/api/player-frame' && method === 'POST') {
        const b = await readJSONBody(req), key = picKey(b && b.name); if (!key) return fail(res, 400, 'Which player?');
        const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 100) / 100)) : d; };
        const z = num(b.z, .5, 2.5, 1), x = num(b.x, -50, 50, 0), y = num(b.y, -50, 50, 0);
        if (b.reset || (z === 1 && x === 0 && y === 0)) delete frames[key]; else frames[key] = { name: String(b.name).trim().slice(0, 60), z, x, y };
        saveLater(FRAMES_FILE, () => frames, 0); state.updatedAt = stamp(); broadcast('state', liveState());
        return ok(res, frames[key] || { z: 1, x: 0, y: 0 });
      }
      if (p === '/api/koth' && method === 'GET') return ok(res, { ...kothRec.view(), files: { json: kothRec.files.json, csv: kothRec.files.csv, dir: DATA_DIR } });
      if (p === '/api/koth/export' && method === 'GET') { kothRec.flush(); const d = JSON.stringify(kothRec.exportAll(), null, 1); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="BeeboScore KOTH records ${new Date().toISOString().slice(0, 10)}.beebo-koth.json"`, 'Cache-Control': 'no-store' }); return res.end(d); }
      if (p === '/api/koth/csv' && method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="BeeboScore KOTH records ${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' }); return res.end(kothRec.csv()); }
      if (p === '/api/koth/import' && method === 'POST') { if (localOnly()) return; const b = await readJSONBody(req, 40 * 1024 * 1024); try { kothRec.importAll(b.data, { merge: !!b.merge }); } catch (e) { return fail(res, 400, e.message); } return ok(res, kothRec.view()); }
      if (p === '/api/koth/reset' && method === 'POST') { if (localOnly()) return; const b = await readJSONBody(req); if (b.confirm !== 'RESET') return fail(res, 400, 'Type RESET to confirm.'); kothRec.reset(); return ok(res, kothRec.view()); }
      if (p === '/api/koth/open-folder' && method === 'POST') { if (localOnly()) return; kothRec.flush(); openInOS(DATA_DIR); return ok(res, { ok: true }); }
      if (p === '/api/format' && method === 'GET') return ok(res, { format: state.format, fv: state.format ? FMT.view(state.format) : null, pending: formatPending, canUndo: formatUndo.length > 0, presets: FMT.PRESETS });
      if (p === '/api/format' && method === 'POST') { try { return ok(res, formatAction(await readJSONBody(req))); } catch (e) { return fail(res, 400, e.message || 'That didn’t work.'); } }
      if (p === '/api/share') {
        if (method === 'GET') return ok(res, shareStatus());
        if (method === 'POST') {
          if (localOnly()) return;
          const b = await readJSONBody(req);
          if (b.do === 'open') { const d = share.status().active ? share.folder() : path.join(DATA_DIR, 'exports'); fs.mkdirSync(d, { recursive: true }); openInOS(d); return ok(res, shareStatus()); }
          if (b.do === 'image') { try { const files = await saveStandingsImages(['png', 'jpg'].includes(b.format) ? b.format : 'both'); return ok(res, { ...shareStatus(), saved: files }); } catch (e) { return fail(res, 400, e.message); } }
          try { return ok(res, shareAction(b)); } catch (e) { return fail(res, 400, e.message); }
        }
      }
      if (p === '/api/vt') {
        if (method === 'GET') return ok(res, { vt: vt ? VT.view(vt) : null, source: config.bracketSource || 'startgg', canUndo: vtUndo.length > 0, chat: chat.state === 'live' });
        if (method === 'POST') { if (localOnly()) return; try { return ok(res, { vt: vtAction(await readJSONBody(req)), source: config.bracketSource || 'startgg', canUndo: vtUndo.length > 0 }); } catch (e) { return fail(res, 400, e.message); } }
      }
      if (p === '/api/format/teams' && method === 'GET') return ok(res, { teams: readJSON(path.join(DATA_DIR, 'teams.json'), []) });
      if (p === '/api/format/teams' && method === 'POST') {          // saved teams / fighter lists, to load next time
        if (localOnly()) return;
        const b = await readJSONBody(req), list = Array.isArray(b && b.teams) ? b.teams.slice(0, 100) : null;
        if (!list) return fail(res, 400, 'Nothing to save.');
        writeJSON(path.join(DATA_DIR, 'teams.json'), list); return ok(res, { ok: true });
      }
      if (p === '/api/screens' && method === 'GET') return ok(res, { layout: config.activeOverlay, screens: layoutScreens(), current: state.screen || '' });
      const vm2 = p.match(/^\/api\/designs\/([^/]+)\/versions(?:\/(\d+))?$/);
      if (vm2 && method === 'GET') {             // the last saves of a layout: every Save keeps the one before it
        const name = safeName(vm2[1]), vdir = path.join(overlayDir(name), 'versions');
        if (vm2[2]) { const f = path.join(vdir, vm2[2] + '.json'); if (!fs.existsSync(f)) return fail(res, 404, 'That version is gone.'); return ok(res, { name, at: Number(vm2[2]), design: readJSON(f, {}) }); }
        let list = []; try { list = fs.readdirSync(vdir).filter(f => /^\d+\.json$/.test(f)).map(f => { const st = fs.statSync(path.join(vdir, f)); return { id: f.slice(0, -5), at: Number(f.slice(0, -5)), size: st.size }; }).sort((a, b) => b.at - a.at); } catch {}
        return ok(res, { name, versions: list });
      }
      // Designer › Export as picture: one scene drawn still on a transparent page, captured by the desktop app
      if (p === '/api/designs/shot-data' && method === 'GET') {
        const k = url.searchParams.get('k') || '', x = designShots.get(k);
        if (!x) return fail(res, 404, 'Nothing to draw.');
        return ok(res, x);
      }
      if (p === '/api/designs/export' && method === 'POST') {
        if (localOnly()) return;
        if (!opts.capture) return fail(res, 400, 'Saving pictures needs the BeeboScore desktop app.');
        const b = await readJSONBody(req).catch(() => null);
        const d = b && b.design;
        if (!d || typeof d !== 'object' || !d.scenes) return fail(res, 400, 'Nothing to export.');
        const w = Math.max(16, Math.min(3840, Number(d.size && d.size.w) || 1920)), h = Math.max(16, Math.min(3840, Number(d.size && d.size.h) || 1080));
        const scale = Math.max(.25, Math.min(4, Number(b.scale) || 1)), W = Math.round(w * scale), H = Math.round(h * scale);
        if (W * H > 3840 * 2160 * 1.01) return fail(res, 400, 'That picture would be too big — use a smaller size.');
        const k = crypto.randomBytes(9).toString('hex');
        designShots.set(k, { design: d, scene: String(b.scene || 'board'), scale, state: b.state && typeof b.state === 'object' ? b.state : null, wait: Math.max(0, Math.min(3000, Number(b.wait) || 350)) });
        setTimeout(() => designShots.delete(k), 60000);
        try {
          const shot = await opts.capture(`http://127.0.0.1:${actualPort}/design-shot?k=${k}`, { width: W, height: H, transparent: b.format !== 'jpg' });
          designShots.delete(k);
          res.writeHead(200, { 'Content-Type': b.format === 'jpg' ? 'image/jpeg' : 'image/png', 'Cache-Control': 'no-store' });
          return res.end(b.format === 'jpg' ? shot.jpg : shot.png);
        } catch (e) { designShots.delete(k); return fail(res, 500, e.message || 'The picture didn’t come out.'); }
      }
      // 1.12.15: Layout Designer › Bake to video — a screen playing in (or out) recorded by the desktop app with a see-through
      // background into a WebM (VP9 with alpha) for an OBS stinger transition. Frames go through data/bake-tmp/<id>.
      // 1.12.15: Settings › Health — how everything's doing at a glance
      // 1.12.16: stations — more scoreboards from this one app (the desktop app runs each with its own data and port)
      if (p === '/api/stations' && method === 'GET') { if (localOnly()) return; if (!opts.stations) return ok(res, { available: false, station: STATION, list: [] }); return ok(res, { available: true, station: STATION, list: opts.stations.list() }); }
      if (p === '/api/stations' && method === 'POST') {
        if (localOnly()) return; if (!opts.stations) return fail(res, 400, 'Stations need the BeeboScore desktop app (and are run from Station 1).');
        const b = await readJSONBody(req).catch(() => ({})) || {};
        try {
          if (b.add) await opts.stations.add(String(b.name || '').slice(0, 40));
          else if (b.remove) await opts.stations.remove(Number(b.remove));
          else if (b.open) opts.stations.open(Number(b.open));
          else if (b.rename) opts.stations.rename(Number(b.rename), String(b.name || '').slice(0, 40));
        } catch (e) { return fail(res, 400, e.message || 'That didn’t work.'); }
        return ok(res, { available: true, station: STATION, list: opts.stations.list() });
      }
      // 1.12.16: sponsors
      if (p === '/api/sponsors' && method === 'GET') return ok(res, sponsorsClean(config.sponsors));
      if (p === '/api/sponsors' && method === 'POST') { const b = await readJSONBody(req).catch(() => ({})); config.sponsors = sponsorsClean(b); saveConfig(); broadcast('state', liveState()); return ok(res, config.sponsors); }
      // 1.12.16: caster notes (private: the panel and the casters' page only) and the casters' page
      if (p === '/api/notes' && method === 'GET') { const n = String(url.searchParams.get('name') || '').trim().toLowerCase(); return ok(res, { name: n, text: notes[n] || '' }); }
      if (p === '/api/notes' && method === 'POST') {
        const b = await readJSONBody(req).catch(() => ({})) || {}, n = String(b.name || '').trim().toLowerCase().slice(0, 60); if (!n) return fail(res, 400, 'Which player?');
        const t = String(b.text || '').slice(0, 2000); if (t.trim()) notes[n] = t; else delete notes[n];
        saveLater(NOTES_FILE, () => notes, 300); hub.broadcastWhere(c => c.meta.authed, 'casters', castersView()); return ok(res, { name: n, text: notes[n] || '' });
      }
      if (p === '/api/casters' && method === 'GET') return ok(res, castersView());
      if (p === '/casters') return serveFile(req, res, path.join(PUBLIC_DIR, 'casters.html'));
      // 1.12.16: the second operator's remote (made and limited here; the page itself is at /op/<link>)
      if (p === '/api/operator' && method === 'GET') { if (localOnly()) return; return ok(res, operatorView()); }
      if (p === '/api/operator' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req).catch(() => ({})) || {}, o = config.operator || {};
        if (b.make) o.token = crypto.randomBytes(18).toString('base64url');
        if (b.revoke) o.token = '';
        if (Array.isArray(b.perms)) o.perms = b.perms.filter(x => OP_PERMS[x]);
        if (typeof b.name === 'string') o.name = b.name.slice(0, 40);
        config.operator = { token: o.token || '', perms: Array.isArray(o.perms) ? o.perms : ['score', 'splash'], name: o.name || '' }; saveConfig(); return ok(res, operatorView());
      }
      // 1.12.16: VOD chapters and highlights
      if (p === '/api/chapters' && method === 'GET') return ok(res, chapterView());
      if (p === '/api/chapters' && method === 'POST') {
        const b = await readJSONBody(req).catch(() => ({})) || {};
        if (b.streamStart === 'now') chapters.streamStart = Date.now(); else if (b.streamStart === 0 || b.streamStart === null) chapters.streamStart = 0; else if (Number(b.streamStart) > 1e12 && Number(b.streamStart) <= Date.now()) chapters.streamStart = Math.round(Number(b.streamStart));
        if (b.mark !== undefined) chapterMark(b.mark);
        if (b.remove) chapters.marks = chapters.marks.filter(m => m.at !== Number(b.remove));
        if (b.clearMarks) chapters.marks = [];
        saveChapters(); const v = chapterView(); hub.broadcastWhere(c => c.meta.authed, 'chapters', v); return ok(res, v);
      }
      if (p === '/api/highlights/keep' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req).catch(() => ({})) || {}, src = String(b.path || '');
        if (!src || !path.isAbsolute(src) || !fs.existsSync(src) || !/\.(mkv|mp4|mov|flv|ts|webm)$/i.test(src)) return fail(res, 400, 'OBS saved the clip somewhere this app can’t reach.');
        const day = new Date().toISOString().slice(0, 10), dir = path.join(DATA_DIR, 'highlights', day); fs.mkdirSync(dir, { recursive: true });
        const nice = String(b.name || 'Highlight').replace(/[^\w\- ]+/g, '').trim().slice(0, 70) || 'Highlight';
        let dst = path.join(dir, nice + path.extname(src)), i = 2; while (fs.existsSync(dst)) dst = path.join(dir, `${nice} (${i++})${path.extname(src)}`);
        try { await fsp.copyFile(src, dst); } catch (e) { return fail(res, 500, 'Copying the clip failed.'); }
        try { SHOW && SHOW.poke('media'); } catch {}
        return ok(res, { file: dst, name: path.basename(dst), folder: dir });
      }
      if (p === '/api/highlights/open' && method === 'POST') { if (localOnly()) return; const dir = path.join(DATA_DIR, 'highlights'); fs.mkdirSync(dir, { recursive: true }); if (opts.openPath) opts.openPath(dir); return ok(res, { folder: dir }); }
      // 1.12.16: Automations
      if (p === '/api/automations' && method === 'GET') return ok(res, { list: autos.list, events: AUTO.EVENTS, steps: AUTO.STEPS, running: autos.running });
      if (p === '/api/automations' && method === 'POST') { const b = await readJSONBody(req).catch(() => ({})); config.automations = autos.set(b && b.list); saveConfig(); broadcastAutos(); return ok(res, { list: autos.list }); }
      if (p === '/api/health' && method === 'GET') {
        if (localOnly()) return;
        const ov = latency.list().filter(v => !v.gone).map(v => ({ kind: v.kind, obs: v.obs, layout: v.layout, mode: v.mode, ping: v.ping, gfx: v.gfx }));
        let backups = []; try { backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.beebo-backup')).map(f => fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs).sort((a, b) => b - a); } catch {}
        const mem = process.memoryUsage();
        return ok(res, { version: APP_VERSION, uptime: Math.round(process.uptime()), memory: Math.round(mem.rss / 1048576), overlays: ov,
          streamdeck: Date.now() - (remoteSeen.streamdeck || 0) < 6000, lastBackup: backups[0] || 0, backups: backups.length, restored: restoredFromBak.slice(-5),
          history: hist.size, autopilot: { on: !!ap().on, running: !!apRun, step: apStep }, tempo: tempo.bpm || 0, show: SHOW ? await SHOW.health().catch(() => null) : null });
      }
      // 1.12.15: player history (the History panel)
      if (p === '/api/history' && method === 'GET') { if (localOnly()) return; const q = url.searchParams.get('q') || ''; return ok(res, { sets: hist.list({ q, limit: Math.min(500, Number(url.searchParams.get('limit')) || 200) }), players: hist.players().slice(0, 300), size: hist.size }); }
      if (p === '/api/history/matchup' && method === 'GET') { const a = url.searchParams.get('a') || '', b = url.searchParams.get('b') || ''; return ok(res, { view: hist.view(a, b), a: hist.player(a), b: hist.player(b) }); }
      if (p === '/api/history/remove' && method === 'POST') { if (localOnly()) return; const b = await readJSONBody(req).catch(() => ({})); const okk = hist.remove(b && b.at); if (okk) broadcast('state', liveState()); return ok(res, { removed: okk, size: hist.size }); }
      if (p === '/bake' || p === '/bake-encode') return serveFile(req, res, path.join(PUBLIC_DIR, p.slice(1) + '.html'));
      if (p === '/api/bake' && method === 'POST') {
        if (localOnly()) return;
        if (!opts.bake) return fail(res, 400, 'Baking a video needs the BeeboScore desktop app.');
        if (bakeBusy) return fail(res, 409, 'A video is already being made — give it a moment.');
        const b = await readJSONBody(req).catch(() => null), d = b && b.design, scene = String((b && b.scene) || ''), dir = b && b.dir === 'out' ? 'out' : 'in';
        if (!d || typeof d !== 'object' || !d.scenes || !d.scenes[scene] || scene === 'board') return fail(res, 400, 'Pick one of the layout’s screens (not the scoreboard) to bake.');
        const id = crypto.randomBytes(8).toString('hex'), k = crypto.randomBytes(9).toString('hex'), tmp = path.join(DATA_DIR, 'bake-tmp', id);
        const loop = !!b.loop, secs = Math.max(3, Math.min(12, Number(b.seconds) || 6));      // 1.12.16: a looping backdrop (no pieces) for slower PCs
        designShots.set(k, { design: d, scene, dir, loop, seconds: secs, state: b.state && typeof b.state === 'object' ? b.state : null });
        const nice = String((b.name || d.name || 'layout')).replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'layout', label = String((d.scenes[scene] && d.scenes[scene].name) || scene).replace(/[^\w\- ]+/g, '').trim().slice(0, 30) || scene;
        bakeBusy = { id, tmp, file: path.join(BAKES_DIR, `${nice} - ${label} ${loop ? 'backdrop loop' : dir === 'in' ? 'in' : 'out'} ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`), wait: null };
        try {
          fs.mkdirSync(tmp, { recursive: true }); fs.mkdirSync(BAKES_DIR, { recursive: true });
          const done = new Promise((resolve, reject) => { bakeBusy.wait = { resolve, reject }; setTimeout(() => reject(new Error('Making the video took too long.')), 120000); });
          await opts.bake({ renderUrl: `http://127.0.0.1:${actualPort}/bake?k=${k}`, encodeUrl: `http://127.0.0.1:${actualPort}/bake-encode?id=${id}`, dir: tmp, width: 1920, height: 1080, fps: 30 });
          await done;
          const file = bakeBusy.file;
          if (loop) {         // the backdrop loop goes into the picture library too, so the layout can use it (and a .beebo file carries it)
            const aid = crypto.randomBytes(6).toString('hex'), af = aid + '.webm'; fs.mkdirSync(ASSET_DIR, { recursive: true }); fs.copyFileSync(file, path.join(ASSET_DIR, af));
            const size = fs.statSync(file).size, list = assetList(), a = { id: aid, name: path.basename(file), file: af, kind: 'video', size, tag: 'baked', at: Date.now(), url: '/assets/' + af };
            list.unshift(a); writeJSON(ASSET_INDEX, list.slice(0, 2000));
            return ok(res, { file, name: path.basename(file), folder: BAKES_DIR, asset: a.url, seconds: secs });
          }
          return ok(res, { file, name: path.basename(file), folder: BAKES_DIR });
        } catch (e) { return fail(res, 500, e.message || 'The video didn’t come out.'); }
        finally { designShots.delete(k); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} bakeBusy = null; }
      }
      if (p === '/api/bake/list' && method === 'GET') {
        const id = url.searchParams.get('id') || ''; if (!bakeBusy || bakeBusy.id !== id) return fail(res, 404, 'No such recording.');
        return ok(res, readJSON(path.join(bakeBusy.tmp, 'frames.json'), { frames: [], w: 1920, h: 1080, fps: 30 }));
      }
      if (p === '/api/bake/frame' && method === 'GET') {
        const id = url.searchParams.get('id') || '', i = Math.max(0, Math.floor(Number(url.searchParams.get('i')) || 0)); if (!bakeBusy || bakeBusy.id !== id) return fail(res, 404, 'No such recording.');
        return serveFile(req, res, path.join(bakeBusy.tmp, String(i).padStart(4, '0') + '.png'));
      }
      if (p === '/api/bake/upload' && method === 'POST') {
        const id = url.searchParams.get('id') || ''; if (!bakeBusy || bakeBusy.id !== id) return fail(res, 404, 'No such recording.');
        try { const buf = await readBody(req, 400 * 1024 * 1024); fs.writeFileSync(bakeBusy.file, buf); bakeBusy.wait && bakeBusy.wait.resolve(); return ok(res, { saved: true }); }
        catch (e) { bakeBusy.wait && bakeBusy.wait.reject(e); return fail(res, 500, 'Saving the video failed.'); }
      }
      if (p === '/api/bakes' && method === 'GET') {
        if (localOnly()) return;
        let list = []; try { list = fs.readdirSync(BAKES_DIR).filter(f => f.endsWith('.webm')).map(f => { const st = fs.statSync(path.join(BAKES_DIR, f)); return { name: f, at: st.mtimeMs, size: st.size }; }).sort((a, b) => b.at - a.at); } catch {}
        return ok(res, { list, folder: BAKES_DIR });
      }
      if (p === '/api/bakes/open' && method === 'POST') { if (localOnly()) return; fs.mkdirSync(BAKES_DIR, { recursive: true }); if (opts.openPath) opts.openPath(BAKES_DIR); return ok(res, { folder: BAKES_DIR }); }
      const dm = p.match(/^\/api\/designs\/([^/]+)$/);
      if (dm && method === 'GET') {
        const name = safeName(dm[1]), f = path.join(overlayDir(name), 'design.json');
        if (!fs.existsSync(f)) return fail(res, 404, 'That layout wasn’t made with the Layout Designer.');
        const preset = fs.existsSync(path.join(BUNDLE_DIR, 'overlays', name, 'index.html')) && path.resolve(BUNDLE_DIR, 'overlays') !== path.resolve(OVERLAYS_DIR);   // 1.12.8: the Designer edits a copy of a preset
        return ok(res, { name, design: readJSON(f, {}), preset });
      }
      if (p === '/api/designs' && method === 'POST') {
        if (localOnly()) return;
        const b = await readJSONBody(req);
        const d = b && b.design;
        if (!d || typeof d !== 'object' || !d.scenes) return fail(res, 400, 'Nothing to save.');
        const title = String(d.title || 'My layout').slice(0, 60), game = String(d.game || 'Any game').slice(0, 60);
        const name = safeName(b.name || title.toLowerCase()) || 'my-layout';
        // the same save sent twice (a browser can resend a request when a connection drops): answer it like the first time
        const nonce = typeof b.nonce === 'string' ? b.nonce.slice(0, 40) : '';
        if (nonce && designNonces.has(nonce)) return ok(res, designNonces.get(nonce));
        const dir = overlayDir(name), exists = fs.existsSync(path.join(dir, 'index.html'));
        const isDesign = fs.existsSync(path.join(dir, 'design.json'));
        if (exists && (!b.overwrite || !isDesign)) return send(res, 409, { error: isDesign ? 'A layout with that name already exists.' : `A layout called “${name}” already exists.`, designer: isDesign });
        // logos: data pictures become files in the layout's assets folder (keeps every overlay refresh light)
        const preName = name;
        const assetDir = path.join(overlayDir(preName), 'assets');
        try {
          for (const sc of Object.values(d.scenes || {})) for (const e of (sc && sc.elements) || []) {
            if (!e || e.kind !== 'logo' || typeof e.src !== 'string') continue;
            const dm2 = e.src.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
            if (dm2) {
              const buf = Buffer.from(dm2[2], 'base64'), ext = { 'svg+xml': 'svg', jpeg: 'jpg' }[dm2[1]] || dm2[1];
              const fn = 'logo-' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) + '.' + ext;
              fs.mkdirSync(assetDir, { recursive: true }); fs.writeFileSync(path.join(assetDir, fn), buf);
              e.src = `/o/${preName}/assets/${fn}`;
            } else {
              const om = e.src.match(/^\/o\/([^/]+)\/assets\/([\w.-]+)$/);     // a logo from a layout this one was copied from
              if (om && safeName(om[1]) !== preName && fs.existsSync(path.join(overlayDir(om[1]), 'assets', om[2]))) {
                fs.mkdirSync(assetDir, { recursive: true }); fs.copyFileSync(path.join(overlayDir(om[1]), 'assets', om[2]), path.join(assetDir, om[2]));
                e.src = `/o/${preName}/assets/${om[2]}`;
              }
            }
          }
        } catch {}
        const json = JSON.stringify(d);
        if (json.length > 12 * 1024 * 1024) return fail(res, 413, 'This layout is too big to save (logos are the usual cause — try a smaller picture).');
        fs.mkdirSync(dir, { recursive: true });
        // the design is embedded in the page, so the layout works anywhere (OBS, online link, cloud)
        const safe = json.replace(/</g, '\\u003c');
        const sw = Math.max(320, Math.min(3840, Number(d.size && d.size.w) || 1920)), sh = Math.max(320, Math.min(3840, Number(d.size && d.size.h) || 1080));
        const colors = [];
        try { for (const e of d.scenes.board.elements || []) for (const c of [].concat(e.fill && e.fill.colors || [], e.stroke && e.stroke.color || [])) if (/^#[0-9a-f]{6}/i.test(c) && !colors.includes(c.slice(0, 7)) && colors.length < 3) colors.push(c.slice(0, 7)); } catch {}
        fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sb-vs" content="off">
<meta name="sb-victory" content="off">
<meta name="sb-format" content="splash">${lookMeta(d.look)}
<meta name="generator" content="BeeboScore Layout Designer">
<title>${title.replace(/[<>&]/g, '')}</title>
<!-- Made with the BeeboScore Layout Designer. Open it from the Layouts tab (Edit design) to change it;
     editing this file by hand works too, but the designer won't see those changes. -->
<style>html,body{margin:0;width:${sw}px;height:${sh}px;overflow:hidden;background:transparent}</style>
</head>
<body>
<script id="sb-design" type="application/json">${safe}</script>
<script src="/sb-design.js?v=${V}"></script>
</body>
</html>
`);
        try {                                    // keep the previous save (up to 30) — the designer's Versions list
          const prev = path.join(dir, 'design.json');
          if (fs.existsSync(prev)) {
            const vdir = path.join(dir, 'versions'); fs.mkdirSync(vdir, { recursive: true });
            const old = fs.readFileSync(prev); let same = false; try { same = JSON.stringify(JSON.parse(old)) === JSON.stringify(d); } catch {} if (!same) fs.writeFileSync(path.join(vdir, Date.now() + '.json'), old);
            const all = fs.readdirSync(vdir).filter(f => /^\d+\.json$/.test(f)).sort(); for (const f of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(vdir, f));
          }
        } catch {}
        writeJSON(path.join(dir, 'design.json'), d);
        writeJSON(path.join(dir, 'overlay.json'), { title, game, family: title, description: 'Made with the Layout Designer.', colors, imported: new Date().toISOString() });      // 1.5.3: one of yours (the Layouts tab lists it)
        let variants = [];
        try { variants = writeVariants(name, { title, game, colors, on: d.formatVersions !== false && !(d.size && (Number(d.size.w) !== 1920 || Number(d.size.h) !== 1080)) }); } catch (e) { console.error('format versions:', e.message); }
        overlaysChanged();
        for (const v of variants) broadcast('reload', { overlay: v });
        broadcast('reload', { overlay: name });
        if (b.setActive) setActive(name);
        if (nonce) { designNonces.set(nonce, { ok: true, name, active: config.activeOverlay === name }); if (designNonces.size > 50) designNonces.delete(designNonces.keys().next().value); }
        return ok(res, { ok: true, name, active: config.activeOverlay === name });
      }

      const rm = p.match(/^\/api\/overlays\/([^/]+)\/restore$/);
      if (rm && method === 'POST') {          // put back the layout as BeeboScore ships it; the edited one is kept as a copy
        if (localOnly()) return;
        const name = safeName(rm[1]), from = path.join(BUNDLE_DIR, 'overlays', name);
        if (!fs.existsSync(path.join(from, 'index.html'))) return fail(res, 404, 'This layout doesn’t come with BeeboScore.');
        let keep = name + '-my-edit', i = 2; while (fs.existsSync(overlayDir(keep))) keep = `${name}-my-edit-${i++}`;
        copyDir(overlayDir(name), overlayDir(keep));
        const km = path.join(overlayDir(keep), 'overlay.json'), kmeta = readJSON(km, {});
        writeJSON(km, { ...kmeta, title: (kmeta.title || name) + ' (my edit)', version: undefined });
        fs.rmSync(overlayDir(name), { recursive: true, force: true }); copyDir(from, overlayDir(name));
        const seeded = readJSON(SEEDED_FILE, {}); seeded[name] = { version: readJSON(path.join(from, 'overlay.json'), {}).version || 1, hash: hashFile(path.join(from, 'index.html')) }; writeJSON(SEEDED_FILE, seeded);
        overlaysChanged(); broadcast('reload', { overlay: name });
        return ok(res, { ok: true, kept: keep });
      }
      const m = p.match(/^\/api\/overlays\/([^/]+)(\/file|\/open-folder)?$/);
      if (m) {
        const name = safeName(m[1]);
        const root = overlayDir(name);
        if (!fs.existsSync(root)) return fail(res, 404, 'Layout not found.');
        if (m[2] === '/file') {
          const f = resolveInside(root, url.searchParams.get('path') || 'index.html');
          if (!f) return fail(res, 403, 'Forbidden');
          if (method === 'GET') {
            if (!fs.existsSync(f)) return fail(res, 404, 'File not found.');
            return send(res, 200, fs.readFileSync(f), 'text/plain; charset=utf-8');
          }
          if (method === 'PUT') {
            if (localOnly()) return;
            fs.mkdirSync(path.dirname(f), { recursive: true });
            fs.writeFileSync(f, await readBody(req));
            broadcast('reload', { overlay: name });
            return ok(res);
          }
        }
        if (m[2] === '/open-folder' && method === 'POST') {
          if (localOnly()) return;
          openInOS(root);
          return ok(res, { ok: true, path: root });
        }
        if (!m[2] && method === 'DELETE') {
          if (localOnly()) return;
          if (name === config.activeOverlay) return fail(res, 400, "Can't delete the layout that's live. Switch to another one first.");
          if (variantOf(config.activeOverlay) && variantOf(config.activeOverlay).base === name) return fail(res, 400, "Its game-format version is live right now. Switch to another layout first.");
          fs.rmSync(root, { recursive: true, force: true });
          for (const f of FORMAT_KEYS) { const vd = overlayDir(safeName(`${name}-${f}`)); if ((readJSON(path.join(vd, 'overlay.json'), {}) || {}).base === name) fs.rmSync(vd, { recursive: true, force: true }); }   // its format versions go with it
          overlaysChanged();
          return ok(res);
        }
      }
      if (p === '/api/open-output' && method === 'POST') {
        if (localOnly()) return;
        openInOS(OUTPUT_DIR); return ok(res);
      }

      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    } catch (err) {
      if (!/start\.gg|token|tournament|event|Download|rate|Invalid request/i.test(err.message)) console.error(err);
      if (!res.headersSent) fail(res, err.status || 500, err.message);
    }
  });
  server.keepAliveTimeout = 65000;

  server.on('upgrade', (req, socket) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws' || !hostAllowed(req)) return socket.destroy();
    const origin = req.headers.origin;
    if (origin && origin !== 'null') { try { if (new URL(origin).host.toLowerCase() !== String(req.headers.host || '').toLowerCase()) return socket.destroy(); } catch { return socket.destroy(); } }
    // 1.12.6: the commentators' cameras — a commentator's page (?cam=<link>) or a commentary screen that receives them (?camview=1)
    const uq = new URL(req.url, 'http://x').searchParams;
    let camRole = null;
    if (uq.has('cam')) { const l = camLink.check(uq.get('cam'), clientIp(req)); if (!l || l.wait) return socket.destroy(); camRole = { role: 'cam', slot: l.slot, id: l.id }; }
    else if (uq.has('camview')) { if (!(isHost(req) || isAuthed(req))) return socket.destroy(); camRole = { role: 'view' }; }
    hub.handleUpgrade(req, socket, (sendFirst, client) => {
      client.meta.authed = isAuthed(req) && roleOf(req) === 'to';
      client.meta.kind = isHost(req) ? 'pc' : isLan(req) ? 'lan' : 'online';
      if (camRole) {
        client.meta.cam = camRole; client.meta.big = true; client.meta.cid = crypto.randomBytes(6).toString('hex');
        if (camRole.role === 'cam') {
          const old = camLive[camRole.slot]; if (old && old !== client) { try { hub.sendTo(old, { type: 'cam-ended', data: { why: 'This link was opened on another device.' } }); old.socket.end(); } catch {} }
          camLive[camRole.slot] = client; const l = camLink.bySlot(camRole.slot) || {};
          sendFirst({ type: 'cam-hello', data: { slot: camRole.slot, name: (commCfg().people[camRole.slot - 1] || {}).name || l.name || '', ice: CAM_ICE } });
          camsChanged();
        } else sendFirst({ type: 'cam-hello', data: { id: client.meta.cid, ice: CAM_ICE, slots: Object.fromEntries([1, 2, 3, 4].map(k => [k, camOn(k)])), relay: Object.fromEntries([1, 2, 3, 4].map(k => [k, relayLive(k)])), talk: Object.fromEntries([1, 2, 3, 4].map(k => [k, talking(k)])) } });
        return;
      }
      const cc = String(req.headers['cf-ipcountry'] || '').toUpperCase();
      client.meta.country = /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : '';
      { const f = stateFor(); sendFirst({ type: 'state', data: f.data, rev: f.rev }); }
      if (tempo.bpm) sendFirst({ type: 'tempo', data: { bpm: tempo.bpm } });   // 1.12.15: a page opened mid-stream picks the tempo up
      sendFirst({ type: 'config', data: { activeOverlay: config.activeOverlay } });
      sendFirst({ type: 'viewers', data: viewersPublic() });
      if (bracket.model) { const pl = bracketPayload(); sendFirst({ type: 'bracket', data: { ...pl, standings: (pl.standings || []).slice(0, 8) } }); }
      if (vt) sendFirst({ type: 'vtpub', data: vtPublic() });
      if (isAuthed(req)) {
        sendFirst({ type: 'tunnel', data: tunnel.status });
        if (updater) sendFirst({ type: 'update', data: updater.status() });
        sendFirst({ type: 'latency', data: latency.list() });
        sendFirst({ type: 'bracket-status', data: bracketStatus() });
        sendFirst({ type: 'twitch', data: twStatus() });
        if (client.meta.kind === 'pc' && typeof upPending !== 'undefined' && upPending.size) sendFirst({ type: 'upscale', data: { jobs: [...upPending.values()] } });   // 1.12.8: pictures waiting to be made bigger
      }
    });
  });

  function lanUrls() {
    const urls = [`http://localhost:${actualPort}`];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const i of list || []) if (i.family === 'IPv4' && !i.internal) urls.push(`http://${i.address}:${actualPort}`);
    }
    return urls;
  }

  // ------------------------------------------------------------ listen
  let actualPort = Number(opts.port || process.env.PORT || 3000);
  const host = opts.host || process.env.HOST || '0.0.0.0';

  return new Promise((resolve, reject) => {
    let tries = 0;
    server.on('error', err => {
      if (err.code === 'EADDRINUSE' && opts.autoPort && tries < 20) { tries++; actualPort++; server.listen(actualPort, host); return; }
      if (err.code === 'EADDRINUSE') console.error(`\n  Port ${actualPort} is already in use. Is the scoreboard already running?\n  Start on another port with:  node server.js --port ${actualPort + 1}\n`);
      reject(err);
    });
    server.listen(actualPort, host, () => {
      writeTextOutputs();
      resolve({
        port: actualPort, urls: lanUrls(), overlaysDir: OVERLAYS_DIR, outputDir: OUTPUT_DIR, dataDir: APP_DIR,
        settings: () => config.settings,
        activeOverlay: () => config.activeOverlay,
        setPotatoFrame,
        close: () => { flushSaves(); tunnel.stop(); server.close(); },
      });
    });
  });
}

// ------------------------------------------------------------ shared utils
// 1.12.15: safer saving — every save goes to a .tmp first and is swapped in whole (a crash mid-save can't leave half a
// file), the one it replaces is kept as .bak, and a file that won't read (damaged by a power cut, a full disk) falls back
// to its .bak — so the scoreboard, settings and players survive a crash in the middle of an event
const restoredFromBak = [];
const KEEP_BAK = f => /^(state|config|players|teams|viewers|brandkits|seeded|koth[\w-]*|vt[\w-]*|formats?)\.json$/i.test(path.basename(f));   // the app's own data files
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    if (e && e.code === 'ENOENT' && !fs.existsSync(file + '.bak')) return fallback;
    try { const d = JSON.parse(fs.readFileSync(file + '.bak', 'utf8')); restoredFromBak.push({ file: path.basename(file), at: Date.now() }); console.error(`${path.basename(file)} couldn't be read — using its last good copy`); return d; } catch { return fallback; }
  }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  try { if (KEEP_BAK(file) && fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch {}
  fs.renameSync(tmp, file);
}
function hashFile(file) { try { return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex'); } catch { return ''; } }
function mergeDeep(target, src) {
  if (!src || typeof src !== 'object') return target;
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'custom') target[k] = mergeDeep(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
    else target[k] = v;
  }
  return target;
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  if (!fs.existsSync(src)) return;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d); else fs.writeFileSync(d, fs.readFileSync(s));
  }
}
function walkFiles(dir, base = dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walkFiles(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}
function resolveInside(root, rel) {
  const p = path.resolve(root, '.' + path.sep + String(rel || '').replace(/\\/g, '/'));
  return p === root || p.startsWith(root + path.sep) ? p : null;
}

module.exports = { start, GAMES };

// ------------------------------------------------------------ CLI
if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  start({ port: arg('--port'), host: arg('--host') }).then(info => {
    const cloud = !!(process.env.ADMIN_PASSWORD || process.env.CLOUD_MODE === '1');
    console.log(`\n  BEEBOSCORE v${APP_VERSION} by Beebo is running\n`);
    console.log(`  Control panel:   ${info.urls[0]}/`);
    console.log(`  OBS overlay:     ${info.urls[0]}/overlay   (Browser Source, 1920 x 1080)`);
    if (info.urls[1] && !cloud) console.log(`  Phone / tablet on your Wi-Fi:  ${info.urls[1]}/`);
    console.log(`\n  Layout files:    ${info.overlaysDir}`);
    if (cloud) console.log('  Cloud mode: the control panel requires the ADMIN_PASSWORD.');
    console.log('\n  Keep this window open while streaming. Press Ctrl+C to stop.\n');
    const stop = () => { info.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    if (!cloud && !process.argv.includes('--no-open') && !process.env.NO_OPEN) {
      const u = `${info.urls[0]}/`;
      exec(process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`, () => {});
    }
  }).catch(() => process.exit(1));
}
