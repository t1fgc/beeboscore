'use strict';
/*
 * Builds the Stream Deck plugin:  cd streamdeck && npm install && npm run build
 *   1. writes the key / action-list images from src/art.js
 *   2. bundles src/plugin.js (+ the ws library) into bin/plugin.js with esbuild
 *   3. packs com.t1fgc.beeboproto.sdPlugin into dist/com.t1fgc.beeboproto.streamDeckPlugin
 *      (double-click that file to install it into Stream Deck)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { art, LIST, tint } = require('./src/art');
const { DECKS } = require('./src/decks');
const os = require('os'), crypto = require('crypto');

const ROOT = __dirname, SD = path.join(ROOT, 'com.t1fgc.beeboproto.sdPlugin'), DIST = path.join(ROOT, 'dist');
const write = (rel, data) => { const f = path.join(SD, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };

// 1. images (SVG scales cleanly to 72 / 144 px keys)
const keys = {
  score: art.score({ side: 1, name: 'Player 1', score: 0 }), reset: art.reset(), swap: art.swap(), undo: art.undo(),
  nextmatch: art.nextmatch(), clear: art.clear(), 'vs-off': art.vs({ on: false }), 'vs-on': art.vs({ on: true }),
  player: art.player({ side: 1, name: '' }), 'bracket-off': art.bracket({ on: false }), 'bracket-on': art.bracket({ on: true }),
  'top8-off': art.top8({ on: false }), 'top8-on': art.top8({ on: true }), 'standings-off': art.standings({ ready: true }), 'standings-on': art.standings({ on: true }), postlink: art.postlink({ ready: true }), sggreport: art.sggReport({ ready: true }), 'overlay-on': art.overlay({}), 'overlay-off': art.overlay({ hidden: true }),
  bracketrefresh: art.bracketRefresh(), bracketside: art.bracketSide({ on: false }), 'victory-off': art.victory({ ready: true }), 'victory-on': art.victory({ on: true }), latency: art.latency({ viewers: 0 }), 'loser-off': art.loser({ side: 1, on: false }), 'loser-on': art.loser({ side: 1, on: true }),
  layout: art.layout({ title: 'Layout' }), fnext: art.formatNext({ score: '2–1', label: 'Crew Battle' }), fundo: art.formatUndo({ ready: true }), fswitch: art.formatSwitch({ side: 1, open: true, name: 'IronMoth', lives: 2, max: 3 }), 'fsplash-off': art.formatSplash({ kind: 'fboard' }), 'fsplash-on': art.formatSplash({ kind: 'fboard', on: true }), 'vtopen-off': art.vtSignup({ count: 12 }), 'vtopen-on': art.vtSignup({ open: true, count: 12 }), vtnext: art.vtNext({ now: 'CrimsonByte vs NeonGhoul' }), 'fbar-off': art.formatBar({ kind: 'teams' }), 'fbar-on': art.formatBar({ kind: 'teams', on: true }), 'sound-off': art.sound({ on: false }), 'sound-on': art.sound({ on: true, vol: 60 }), 'screen-off': art.screen({ name: 'Be right back' }), 'screen-on': art.screen({ name: 'Be right back', on: true }),
  hideall: art.hideAll({ any: true }), refresh: art.refresh(), slot: tint(art.formatBadge({}), '#ff7a1a'),
  viewernext: art.viewerNext({ next: 'NeonGhoul', count: 3 }), 'viewerresult-me': art.viewerResult({ who: 'streamer', s: 1, v: 0 }), 'viewerresult-them': art.viewerResult({ who: 'viewer', s: 1, v: 0 }),
  'viewerqueue-off': art.viewerQueue({ open: false }), 'viewerqueue-on': art.viewerQueue({ open: true, count: 3 }), 'autoscore-off': art.autoscore({ on: false }), 'autoscore-on': art.autoscore({ on: true, state: 'armed' }), autoscoreundo: art.autoscoreUndo({ ready: true }), autoscoreconfirm: art.autoscoreConfirm({}), autoscoreresync: art.autoscoreResync(),
  'viewersidebar-off': art.viewerSidebar({ on: false }), 'viewersidebar-on': art.viewerSidebar({ on: true }), 'viewersplash-off': art.viewerSplash({ on: false }), 'viewersplash-on': art.viewerSplash({ on: true }),
};
for (const [k, svg] of Object.entries(keys)) write(`imgs/keys/${k}.svg`, svg);
for (const [k, svg] of Object.entries(LIST)) write(`imgs/actions/${k}.svg`, svg);
write('imgs/actions/score-dial.svg', art.score({ side: 1, name: 'Player 1', score: 0 }));
// plugin + category icons: the VS mark on red (colour), and a plain white VS for the action list
for (const f of ['plugin.png', 'plugin@2x.png', 'category.png', 'category@2x.png']) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(SD, 'imgs', f));
try { fs.unlinkSync(path.join(SD, 'imgs', 'category.svg')); } catch {}

// 1b. the ready-made layouts: a Stream Deck profile for the 15-key Stream Deck and one for the Stream Deck XL
//     (profiles/*.streamDeckProfile, listed under "Profiles" in the manifest; Stream Deck adds them with the plugin).
//     A profile is a zip: <PROFILE>.sdProfile/manifest.json and Profiles/<PAGE>/manifest.json with the keys by "col,row".
//     Fresh ids on every build: Stream Deck refuses a profile whose ids it has seen before.
const MANIFEST = require('./manifest.template.json');
const ACTIONS = Object.fromEntries(MANIFEST.Actions.map(a => [a.UUID.replace('com.t1fgc.beeboproto.', ''), a]));
function profileZip(deck) {
  const id = crypto.randomUUID(), page = crypto.randomUUID();
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'beebo-profile-')), dir = path.join(stage, id.toUpperCase() + '.sdProfile');
  const key = (k, settings) => {
    const a = ACTIONS[k]; if (!a) throw new Error('No such action: ' + k);
    return { ActionID: crypto.randomUUID(), LinkedTitle: false, Name: a.Name, Plugin: { Name: MANIFEST.Name, UUID: 'com.t1fgc.beeboproto', Version: MANIFEST.Version },
      Resources: null, Settings: settings, State: 0, States: a.States.map(() => ({})), UUID: a.UUID };
  };
  const keys = {};
  for (const [c, r, k, settings] of deck.fixed) keys[`${c},${r}`] = key(k, settings);
  deck.slots.forEach(([c, r], i) => { keys[`${c},${r}`] = key('slot', { deck: deck === DECKS['32'] ? '32' : '15', slot: i }); });
  fs.mkdirSync(path.join(dir, 'Profiles', page.toUpperCase()), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ AppIdentifier: '*', Device: { Model: deck.model, UUID: '' }, Name: deck.name, Pages: { Current: page, Default: page, Pages: [page] }, Version: '3.0' }));
  fs.writeFileSync(path.join(dir, 'Profiles', page.toUpperCase(), 'manifest.json'), JSON.stringify({ Controllers: [{ Actions: keys, Type: 'Keypad' }], Icon: '', Name: '' }));
  const zip = zipDir(dir, path.basename(dir));
  fs.rmSync(stage, { recursive: true, force: true });
  return zip;
}

// 2. manifest + bundle
fs.copyFileSync(path.join(ROOT, 'manifest.template.json'), path.join(SD, 'manifest.json'));
fs.mkdirSync(path.join(SD, 'bin'), { recursive: true });
require('esbuild').buildSync({
  entryPoints: [path.join(ROOT, 'src', 'plugin.js')], bundle: true, platform: 'node', target: 'node20', format: 'cjs',
  define: { __PLUGIN_VERSION__: JSON.stringify(require('./manifest.template.json').Version || '') },
  external: ['bufferutil', 'utf-8-validate'], outfile: path.join(SD, 'bin', 'plugin.js'), logLevel: 'warning', legalComments: 'none',
});

// 3. .streamDeckPlugin = a zip whose top folder is the .sdPlugin folder
function crc32(buf) { let c, crc = 0 ^ -1; for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function zipDir(dir, prefix) {
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'logs') walk(f); } else files.push(f);
  } })(dir);
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from((prefix + '/' + path.relative(dir, f)).split(path.sep).join('/'));
    const raw = fs.readFileSync(f), data = zlib.deflateRawSync(raw, { level: 9 }), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
for (const deck of Object.values(DECKS)) write(`profiles/${deck.file}.streamDeckProfile`, profileZip(deck));
// layouts.json: the same two layouts as plain data, for BeeboScore itself. On Windows "Set up my Stream Deck" writes them
// straight into Stream Deck's own profile files (lib/sdlayout.js), which works even when Stream Deck never imported the
// profiles above (it only offers them when a plugin is first installed, not on an update).
const layouts = {};
for (const [size, deck] of Object.entries(DECKS)) {
  const keys = {};
  for (const [c, r, k, settings] of deck.fixed) keys[`${c},${r}`] = { k, settings };
  deck.slots.forEach(([c, r], i) => { keys[`${c},${r}`] = { k: 'slot', settings: { deck: size, slot: i } }; });
  layouts[size] = { name: deck.name, cols: deck.cols, rows: deck.rows, keys: Object.fromEntries(Object.entries(keys).map(([pos, { k, settings }]) => {
    const a = ACTIONS[k]; if (!a) throw new Error('No such action: ' + k);
    return [pos, { UUID: a.UUID, Name: a.Name, Settings: settings, States: a.States.length }];
  })) };
}
write('layouts.json', JSON.stringify({ plugin: { Name: MANIFEST.Name, UUID: 'com.t1fgc.beeboproto', Version: MANIFEST.Version }, layouts }, null, 1));
fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'com.t1fgc.beeboproto.streamDeckPlugin');
fs.writeFileSync(out, zipDir(SD, 'com.t1fgc.beeboproto.sdPlugin'));
console.log('Stream Deck plugin →', path.relative(process.cwd(), out), `(${Math.round(fs.statSync(out).size / 1024)} KB)`);
