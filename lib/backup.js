'use strict';
/*
 * Backups of everything you set up: settings and shortcuts, players, saved teams, brand kits, your own layouts and the
 * designer's picture library. One gzip'd JSON file (.beebo-backup).
 *
 * Secrets never go into a backup: the OBS WebSocket password, start.gg and Twitch sign-ins, the remote-control password
 * and the encryption key all stay on this PC. After a restore you sign in to those again.
 *
 * Automatic backups: one a day (when something changed) into data/backups, the last 7 kept.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FORMAT = 'beebo-backup';
const VERSION = 1;
const DATA_FILES = ['players.json', 'teams.json', 'brandkits.json', 'seeded.json'];
const MAX_TREE = 80 * 1024 * 1024;                 // layouts + pictures: skip anything past 80 MB in total
const KEEP = 7;

/** a copy of config.json with every secret taken out */
function scrubConfig(c) {
  const x = JSON.parse(JSON.stringify(c || {}));
  delete x.passwordHash; delete x.share; if (x.namedTunnel) delete x.namedTunnel.sealed;
  if (x.startgg) { delete x.startgg.token; delete x.startgg.sealedToken; if (x.startgg.oauth) { delete x.startgg.oauth.sealed; if (x.startgg.oauth.app) delete x.startgg.oauth.app.sealedSecret; delete x.startgg.oauth.user; } }
  if (x.twitch) { for (const k of Object.keys(x.twitch)) if (/token|sealed|secret|oauth/i.test(k)) delete x.twitch[k]; if (x.twitch.connect && typeof x.twitch.connect === 'object') for (const k of Object.keys(x.twitch.connect)) if (/token|sealed|secret/i.test(k)) delete x.twitch.connect[k]; }
  if (x.autoscore) { delete x.autoscore.obsPassword; }
  if (x.obs) { delete x.obs.password; }
  // anything else that looks like a secret
  (function walk(o) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (/password|secret|token|sealed/i.test(k) && typeof o[k] === 'string') delete o[k]; else walk(o[k]); } })(x);
  return x;
}

function readTree(dir, budget) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) { const st = fs.statSync(p); if (budget.left < st.size) { budget.skipped++; continue; } budget.left -= st.size; out[r] = fs.readFileSync(p).toString('base64'); }
    }
  })(dir, '');
  return out;
}

/** build a backup; returns { buf, name, summary } */
function create({ dataDir, overlaysDir, config, appVersion, userLayouts }) {
  const budget = { left: MAX_TREE, skipped: 0 };
  const data = {};
  for (const f of DATA_FILES) { const p = path.join(dataDir, f); if (fs.existsSync(p)) data[f] = fs.readFileSync(p, 'utf8'); }
  const layouts = {};
  for (const name of userLayouts || []) layouts[name] = readTree(path.join(overlaysDir, name), budget);
  const assets = readTree(path.join(dataDir, 'assets'), budget);
  const doc = { format: FORMAT, v: VERSION, app: appVersion, at: new Date().toISOString(), config: scrubConfig(config), data, layouts, assets, skipped: budget.skipped };
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(doc)), { level: 6 });
  const stamp = doc.at.slice(0, 16).replace(/[:T]/g, '-');
  return { buf, name: `BeeboScore backup ${stamp}.beebo-backup`, summary: summarize(doc) };
}
const summarize = d => ({ at: d.at, app: d.app, players: (() => { try { return JSON.parse(d.data['players.json'] || '[]').length; } catch { return 0; } })(),
  teams: (() => { try { return JSON.parse(d.data['teams.json'] || '[]').length; } catch { return 0; } })(), layouts: Object.keys(d.layouts || {}).length, assets: Object.keys(d.assets || {}).length, skipped: d.skipped || 0 });

/** read and check a backup file (Buffer) */
function parse(buf) {
  let doc;
  try { doc = JSON.parse(zlib.gunzipSync(buf, { maxOutputLength: 400 * 1024 * 1024 }).toString('utf8')); } catch { throw new Error('That isn’t a BeeboScore backup file.'); }
  if (!doc || doc.format !== FORMAT || typeof doc.v !== 'number') throw new Error('That isn’t a BeeboScore backup file.');
  if (doc.v > VERSION) throw new Error('This backup comes from a newer BeeboScore — update first.');
  return doc;
}
const safeRel = r => typeof r === 'string' && r && !r.includes('..') && !path.isAbsolute(r) && !/[\\:*?"<>|\x00]/.test(r);
const safeName = n => typeof n === 'string' && /^[A-Za-z0-9 _.-]{1,80}$/.test(n) && !n.startsWith('.');

/** write a parsed backup back. `keep` is the current config: its secrets (and anything this PC-specific) stay. */
function restore(doc, { dataDir, overlaysDir, current }) {
  for (const [f, txt] of Object.entries(doc.data || {})) if (DATA_FILES.includes(f) && typeof txt === 'string') { JSON.parse(txt); fs.writeFileSync(path.join(dataDir, f), txt); }
  let layouts = 0, assets = 0;
  for (const [name, files] of Object.entries(doc.layouts || {})) {
    if (!safeName(name) || !files || typeof files !== 'object') continue;
    const dir = path.join(overlaysDir, name);
    for (const [rel, b64] of Object.entries(files)) { if (!safeRel(rel)) continue; const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(String(b64), 'base64')); }
    layouts++;
  }
  const adir = path.join(dataDir, 'assets');
  for (const [rel, b64] of Object.entries(doc.assets || {})) { if (!safeRel(rel)) continue; const p = path.join(adir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(String(b64), 'base64')); assets++; }
  // config: the backup's choices, this PC's secrets and sign-ins
  const cur = current || {}, b = scrubConfig(doc.config || {});
  const next = { ...cur, ...b, settings: { ...(cur.settings || {}), ...(b.settings || {}) } };
  next.passwordHash = cur.passwordHash; next.share = cur.share || {}; if (cur.namedTunnel) next.namedTunnel = cur.namedTunnel;
  if (cur.startgg) next.startgg = { ...(b.startgg || {}), token: cur.startgg.token, sealedToken: cur.startgg.sealedToken, oauth: cur.startgg.oauth };
  if (cur.twitch) next.twitch = { ...cur.twitch, ...(b.twitch || {}), connect: cur.twitch.connect };
  if (cur.autoscore) next.autoscore = { ...(b.autoscore || {}), obsPassword: cur.autoscore.obsPassword };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  return { config: next, layouts, assets };
}

/** the daily automatic backup: write one if the last is older than a day, keep the newest 7 */
function daily(dir, make, now = Date.now()) {
  fs.mkdirSync(dir, { recursive: true });
  const list = () => fs.readdirSync(dir).filter(f => f.endsWith('.beebo-backup')).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  let l = list();
  if (!l.length || now - l[0].t > 23.5 * 3600 * 1000) { const b = make(); fs.writeFileSync(path.join(dir, b.name.replace(/^BeeboScore backup/, 'auto')), b.buf); l = list(); }
  for (const x of l.slice(KEEP)) fs.rmSync(path.join(dir, x.f), { force: true });
  return list().map(x => ({ name: x.f, at: x.t, size: fs.statSync(path.join(dir, x.f)).size }));
}

module.exports = { create, parse, restore, daily, scrubConfig, summarize, KEEP };
