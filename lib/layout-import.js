'use strict';
/*
 * BeeboScore (developed by Beebo) — getting a layout someone made ready to go in the overlays folder.
 *
 * In: the files of a dropped folder, a few loose files or an unpacked .zip ([{ path, data }]).
 * Out: the same files, tidied up: junk and anything that isn't part of a web page left out, a single top folder taken
 * off, and the page OBS shows named index.html. Nothing is written here; server.js puts the files in the layout's own
 * folder (and every path goes through resolveInside there).
 */
const path = require('path');

// what a layout can be made of: pages, styles, scripts, data, pictures, fonts, video, sound and 3D models
const ALLOWED = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'map', 'txt', 'md', 'csv', 'xml', 'webmanifest',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'apng',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'webm', 'mov', 'm4v', 'mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac',
  'glb', 'gltf', 'bin', 'ktx2', 'hdr', 'riv', 'lottie', 'wasm']);
const JUNK = /(^|\/)(__MACOSX|\.git|\.svn|node_modules)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;
const fail = msg => Object.assign(new Error(msg), { status: 400 });

/** a folder name for a layout title: "Neon Bars v2" → "neon-bars-v2" */
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '');
}
/** a title for a layout from a file or folder name: "neon_bars-v2.zip" → "Neon Bars V2" */
function titleFrom(s) {
  const t = String(s || '').replace(/\.(zip|html?|beebo)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return t ? t.replace(/\b\p{Ll}/gu, c => c.toUpperCase()) : '';
}

function prepareLayout(input, { maxFiles = 2000, maxBytes = 250 * 1024 * 1024 } = {}) {
  let files = [], skipped = [], total = 0;
  for (const f of input || []) {
    let rel = String(f && f.path || '').replace(/\\/g, '/').replace(/^\.?\/+/, '');
    if (!rel || rel.endsWith('/') || JUNK.test(rel)) continue;
    if (rel.split('/').some(seg => seg === '..' || seg === '.' || seg === '')) { skipped.push(rel); continue; }
    const base = rel.split('/').pop();
    if (base.startsWith('.')) continue;                                  // hidden files (.gitignore, ._picture.png…)
    const ext = path.extname(base).slice(1).toLowerCase();
    if (!ALLOWED.has(ext)) { skipped.push(rel); continue; }
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data || '');
    total += data.length;
    files.push({ path: rel, data });
  }
  if (files.length > maxFiles) throw fail(`That layout has ${files.length} files; a layout can have up to ${maxFiles}.`);
  if (total > maxBytes) throw fail(`That layout is more than ${Math.round(maxBytes / 1048576)} MB.`);
  if (!files.some(f => /\.html?$/i.test(f.path))) throw fail('There’s no web page (.html) in there, so there’s nothing for OBS to show.');

  // a zip of a folder ("Neon Bars/index.html", "Neon Bars/img/…"): the folder comes off, as many times as it is nested
  let top = '';
  for (;;) {
    const firsts = new Set(files.map(f => f.path.includes('/') ? f.path.split('/')[0] : ''));
    if (firsts.size !== 1 || firsts.has('')) break;
    const [dir] = firsts; top = dir;
    files = files.map(f => ({ ...f, path: f.path.slice(dir.length + 1) }));
  }

  // the page OBS shows: index.html, or the only page at the top of the layout
  const pages = files.filter(f => !f.path.includes('/') && /\.html?$/i.test(f.path));
  let entry = pages.find(f => /^index\.html?$/i.test(f.path));
  if (!entry) {
    const named = pages.filter(f => /^(overlay|scoreboard|layout|main)\.html?$/i.test(f.path));
    if (pages.length === 1) entry = pages[0];
    else if (named.length === 1) entry = named[0];
    else if (pages.length) throw fail(`There are ${pages.length} pages at the top of that layout (${pages.slice(0, 4).map(f => f.path).join(', ')}). Name the one OBS should show index.html.`);
    else throw fail('Put the layout’s page (index.html) at the top of the folder or zip, not inside another folder.');
  }
  const from = entry.path;
  if (entry.path !== 'index.html') {        // a copy under the name the app opens; the page keeps its own name too, so links to it still work
    files = files.filter(f => f.path.toLowerCase() !== entry.path.toLowerCase() || f === entry);
    if (entry.path.toLowerCase() === 'index.html') entry.path = 'index.html';
    else files.push({ path: 'index.html', data: entry.data });
  }

  // the layout's own details, if the creator gave some
  let meta = {};
  const mf = files.find(f => f.path.toLowerCase() === 'overlay.json');
  if (mf) { try { const j = JSON.parse(mf.data.toString('utf8')); if (j && typeof j === 'object' && !Array.isArray(j)) meta = j; } catch {} }

  // does it read the scoreboard? (bindings, the scoreboard events, or the live state)
  const reads = files.some(f => /\.(html?|m?js)$/i.test(f.path) && /data-sb(-[a-z]+)?=|['"]scoreboard(:[a-z-]+)?['"]|\/api\/live|sb-client/.test(f.data.toString('utf8')));

  return { files, entry: from, top, meta, reads, skipped };
}

module.exports = { prepareLayout, slugify, titleFrom, ALLOWED };
