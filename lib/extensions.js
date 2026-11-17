'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — extensions: small add-ons that bring new screens, Stream Deck keys and
 * automation steps without touching the app itself.
 *
 * An extension is a .beeboext file — JSON: { beeboext: 1, manifest, files: { 'overlay.js': '…', 'icon.svg': '…' } }.
 *   manifest  { id, name, version, author, description,
 *               screens: [{ id, label }],            screens it draws on the overlay (shown and hidden like any other)
 *               cues:    [{ id, label }] }           moments it reacts to: a Stream Deck key, an automation step, a button
 *   overlay.js  runs on the overlay pages only (OBS's browser sources), never in the app or on the server:
 *               BeeboExt.screen('<screen>', { show(el, state), hide(el) })   BeeboExt.on('<cue>', (data, state) => …)
 *               BeeboExt.state(fn)  — called with the scoreboard every time it changes
 *   icon.svg    the Stream Deck key's picture (no scripts; anything active is stripped)
 * Kept in data/extensions/<id>/. Only the PC running the app can install one, and each can be switched off.
 */
const fs = require('fs');
const path = require('path');

const ID = /^[a-z0-9][a-z0-9-]{1,30}$/;
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const MAX_JS = 400 * 1024, MAX_SVG = 64 * 1024;
function cleanSvg(s) {
  s = String(s || '').slice(0, MAX_SVG);
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(s)) return '';
  return s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript|data:text\/html)[^"']*\2/gi, '').replace(/<(iframe|embed|object)[\s\S]*?>/gi, '');
}
function cleanManifest(m) {
  m = m && typeof m === 'object' ? m : {};
  const id = String(m.id || '').toLowerCase(); if (!ID.test(id)) throw new Error('The extension needs an id (lower-case letters, numbers and dashes).');
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n).map(x => ({ id: String(x && x.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30), label: str(x && x.label, 40) })).filter(x => x.id && x.label);
  return { id, name: str(m.name, 50) || id, version: str(m.version, 20) || '1.0', author: str(m.author, 50), description: str(m.description, 300), screens: list(m.screens, 12), cues: list(m.cues, 24) };
}
function parse(buf) {
  let j; try { j = JSON.parse(Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)); } catch { throw new Error('That isn’t a BeeboScore extension (.beeboext).'); }
  if (!j || j.beeboext !== 1) throw new Error('That isn’t a BeeboScore extension (.beeboext).');
  const manifest = cleanManifest(j.manifest), files = j.files && typeof j.files === 'object' ? j.files : {};
  const js = typeof files['overlay.js'] === 'string' ? files['overlay.js'] : '';
  if (js.length > MAX_JS) throw new Error('The extension’s overlay.js is too big (400 KB at most).');
  return { manifest, js, svg: cleanSvg(files['icon.svg']) };
}

function createExtensions({ dir, get, set, log = () => {} }) {
  const folder = id => path.join(dir, id);
  let cache = null;                     // read once, again only after an install, a removal or a switch
  function installed() {
    if (cache) return cache;
    let out = []; try { out = fs.readdirSync(dir).filter(n => ID.test(n) && fs.existsSync(path.join(dir, n, 'extension.json'))); } catch {}
    const on = get() || {};
    return (cache = out.map(id => { try { const m = cleanManifest(JSON.parse(fs.readFileSync(path.join(dir, id, 'extension.json'), 'utf8'))); return { ...m, on: on[id] !== false, js: fs.existsSync(path.join(dir, id, 'overlay.js')), icon: fs.existsSync(path.join(dir, id, 'icon.svg')) }; } catch { return null; } }).filter(Boolean));
  }
  function install(buf) {
    cache = null;
    const { manifest, js, svg } = parse(buf), d = folder(manifest.id);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'extension.json'), JSON.stringify(manifest, null, 1));
    if (js) fs.writeFileSync(path.join(d, 'overlay.js'), js); else fs.rmSync(path.join(d, 'overlay.js'), { force: true });
    if (svg) fs.writeFileSync(path.join(d, 'icon.svg'), svg); else fs.rmSync(path.join(d, 'icon.svg'), { force: true });
    const on = { ...(get() || {}) }; on[manifest.id] = true; set(on);
    return manifest;
  }
  function remove(id) { cache = null; if (!ID.test(String(id))) return false; fs.rmSync(folder(id), { recursive: true, force: true }); const on = { ...(get() || {}) }; delete on[id]; set(on); return true; }
  function toggle(id, v) { cache = null; const on = { ...(get() || {}) }; on[id] = v === undefined ? on[id] === false : !!v; set(on); return on[id] !== false; }
  const active = () => installed().filter(e => e.on);
  const file = (id, f) => (ID.test(String(id)) && ['overlay.js', 'icon.svg'].includes(f) ? path.join(folder(id), f) : '');
  function cue(id, c) { const e = active().find(x => x.id === id); if (!e) throw new Error('No extension called that (or it’s off).'); if (!e.cues.some(x => x.id === c) && !e.screens.some(x => x.id === c)) throw new Error(`“${e.name}” has nothing called “${c}”.`); return e; }
  return { installed, install, remove, toggle, active, file, cue, parse };
}

module.exports = { createExtensions, parse, cleanSvg, cleanManifest };
