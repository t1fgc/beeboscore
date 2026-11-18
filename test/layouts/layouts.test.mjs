// 1.5.1: the Layouts tab — reading and writing zips, tidying up a dropped layout, and the server routes end to end
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readZip, writeZip } = require('../../lib/zip.js');
const { prepareLayout, slugify, titleFrom } = require('../../lib/layout-import.js');

const page = (body = '<span data-sb="p1.name"></span>') => Buffer.from(`<!DOCTYPE html><html><head></head><body>${body}</body></html>`);

test('zip: what is written reads back the same (deflated and stored)', () => {
  const files = [{ path: 'Neon/index.html', data: page() }, { path: 'Neon/img/a.png', data: Buffer.from([137, 80, 78, 71, 1, 2, 3]) }, { path: 'Neon/ünïcode.css', data: Buffer.from('a{}'.repeat(500)) }];
  const back = readZip(writeZip(files));
  assert.deepEqual(back.map(f => f.path), files.map(f => f.path));
  back.forEach((f, i) => assert.ok(f.data.equals(files[i].data)));
});

test('zip: not a zip, or a damaged one, is refused with a plain message', () => {
  assert.throws(() => readZip(Buffer.from('hello there, this is not a zip file at all')), /isn’t a \.zip/);
  const z = writeZip([{ path: 'index.html', data: page() }]); z.writeUInt32LE(0, 0);
  assert.throws(() => readZip(z), /damaged/);
});

test('prepare: a zipped folder loses its folder, junk and programs are left out', () => {
  const r = prepareLayout([
    { path: 'Neon Bars/index.html', data: page() }, { path: 'Neon Bars/style.css', data: Buffer.from('') },
    { path: 'Neon Bars/run-me.exe', data: Buffer.from('MZ') }, { path: '__MACOSX/Neon Bars/._index.html', data: Buffer.from('') },
    { path: 'Neon Bars/.DS_Store', data: Buffer.from('') }, { path: 'Neon Bars/../evil.html', data: page() },
  ]);
  assert.deepEqual(r.files.map(f => f.path).sort(), ['index.html', 'style.css']);
  assert.equal(r.top, 'Neon Bars'); assert.equal(r.reads, true);
  assert.deepEqual(r.skipped.sort(), ['Neon Bars/../evil.html', 'Neon Bars/run-me.exe']);
});

test('prepare: the only page becomes index.html (and keeps its own name); several pages need an index.html', () => {
  const r = prepareLayout([{ path: 'scoreboard.html', data: page() }, { path: 'extra/other.html', data: page() }]);
  assert.deepEqual(r.files.map(f => f.path).sort(), ['extra/other.html', 'index.html', 'scoreboard.html']);
  assert.equal(r.entry, 'scoreboard.html');
  assert.throws(() => prepareLayout([{ path: 'a.html', data: page() }, { path: 'b.html', data: page() }]), /Name the one OBS should show index\.html/);
  assert.throws(() => prepareLayout([{ path: 'logo.png', data: Buffer.from('x') }]), /no web page/);
  assert.throws(() => prepareLayout([{ path: 'x/index.html', data: page() }, { path: 'y/index.html', data: page() }]), /at the top of the folder/);
});

test('prepare: a page that never reads the scoreboard is noticed, and the creator’s overlay.json is read', () => {
  const r = prepareLayout([{ path: 'index.html', data: page('<h1>Hello</h1>') }, { path: 'overlay.json', data: Buffer.from('{"title":"Hello","author":"Ana"}') }]);
  assert.equal(r.reads, false); assert.equal(r.meta.title, 'Hello'); assert.equal(r.meta.author, 'Ana');
  assert.equal(prepareLayout([{ path: 'index.html', data: page('<script>addEventListener("scoreboard", e => 0)</script>') }]).reads, true);
});

test('names: titles and folder names', () => {
  assert.equal(slugify('Neon Bars v2!'), 'neon-bars-v2');
  assert.equal(slugify('Café  Crème'), 'cafe-creme');
  assert.equal(titleFrom('neon_bars-v2.zip'), 'Neon Bars V2');
});

// ------------------------------------------------------------ the server, end to end
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsl-layouts-'));
let srv = null;
after(() => { if (srv) srv.close(); setTimeout(() => process.exit(0), 50).unref(); });
async function server() {
  if (srv) return srv;
  const { start } = require('../../server.js');
  srv = await start({ dataDir: dir, port: 30000 + Math.floor(Math.random() * 20000), autoPort: true, host: '127.0.0.1', noOpen: true });
  if (!srv.port) throw new Error('no port');
  return srv;
}
async function call(method, p, body) {
  const s = await server();
  const r = await fetch(`http://127.0.0.1:${s.port}${p}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const type = r.headers.get('content-type') || '';
  return { status: r.status, type, body: /json/.test(type) ? await r.json() : Buffer.from(await r.arrayBuffer()) };
}

test('server: import a zip, see it listed, share it, replace it, remove it', async () => {
  const z = writeZip([{ path: 'Neon Bars/index.html', data: page() }, { path: 'Neon Bars/img/bg.png', data: Buffer.from('png') }]).toString('base64');
  let r = await call('POST', '/api/layouts/import', { zip: z, game: 'Street Fighter 6', fileName: 'Neon Bars.zip' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.name, 'neon-bars'); assert.equal(r.body.title, 'Neon Bars'); assert.equal(r.body.reads, true);
  const list = (await call('GET', '/api/overlays')).body, mine = list.find(o => o.name === 'neon-bars');
  assert.ok(mine && !mine.builtIn && mine.imported && mine.game === 'Street Fighter 6');
  assert.ok(list.some(o => o.builtIn));

  // the same name again: asked first, then replaced (the old copy is kept)
  r = await call('POST', '/api/layouts/import', { zip: z, fileName: 'Neon Bars.zip' });
  assert.equal(r.status, 409); assert.equal(r.body.code, 'exists');
  r = await call('POST', '/api/layouts/import', { zip: z, fileName: 'Neon Bars.zip', replace: true, goLive: true });
  assert.equal(r.status, 200); assert.equal(r.body.replaced, true);

  // shared as a zip with its own folder inside
  r = await call('GET', '/api/layouts/export?name=neon-bars');
  assert.equal(r.status, 200); assert.match(r.type, /zip/);
  assert.deepEqual(readZip(r.body).map(f => f.path).sort(), ['Neon Bars/img/bg.png', 'Neon Bars/index.html', 'Neon Bars/overlay.json']);

  // removed while live: one of the app's own layouts goes live, the folder is kept under removed-layouts
  r = await call('POST', '/api/layouts/remove', { name: 'neon-bars' });
  assert.equal(r.status, 200); assert.ok(r.body.active && r.body.active !== 'neon-bars');
  assert.match(r.body.kept, /^data\/removed-layouts\/neon-bars /);
  assert.ok(fs.existsSync(path.join(dir, r.body.kept, 'index.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'overlays', 'neon-bars')));
  const rem = fs.readdirSync(path.join(dir, 'data', 'removed-layouts'));
  assert.equal(rem.length, 2);                                       // the replaced copy and the removed one
});

test('server: the app’s own layouts can’t be replaced or removed', async () => {
  const z = writeZip([{ path: 'index.html', data: page() }]).toString('base64');
  let r = await call('POST', '/api/layouts/import', { zip: z, title: 'tekken8-default' });
  assert.equal(r.status, 409); assert.equal(r.body.code, 'builtin');
  r = await call('POST', '/api/overlays/upload', { name: 'tekken8-default', files: [{ path: 'index.html', data: page().toString('base64') }] });
  assert.equal(r.status, 409);
  r = await call('POST', '/api/layouts/remove', { name: 'tekken8-default' });
  assert.equal(r.status, 400);
  assert.ok(fs.readFileSync(path.join(dir, 'overlays', 'tekken8-default', 'index.html'), 'utf8').length > 1000);
});

test('server: loose files and the starter layout', async () => {
  let r = await call('POST', '/api/layouts/import', { title: 'Plain Page', files: [{ path: 'board.html', data: page('<h1>hi</h1>').toString('base64') }] });
  assert.equal(r.status, 200); assert.equal(r.body.reads, false);
  assert.ok(fs.existsSync(path.join(dir, 'overlays', 'plain-page', 'index.html')));
  r = await call('GET', '/api/layouts/starter.zip');
  assert.equal(r.status, 200);
  const files = readZip(r.body).map(f => f.path).sort();
  assert.deepEqual(files, ['My layout/index.html', 'My layout/overlay.json']);
  // and the starter imports as it is
  r = await call('POST', '/api/layouts/import', { zip: (await call('GET', '/api/layouts/starter.zip')).body.toString('base64') });
  assert.equal(r.status, 200); assert.equal(r.body.name, 'my-layout'); assert.equal(r.body.reads, true);
  // the overlay page serves it with the overlay client in it
  const s = await server(), html = await (await fetch(`http://127.0.0.1:${s.port}/overlay/my-layout?direct`)).text();
  assert.match(html, /sb-client\.js/); assert.match(html, /data-sb="p1\.name"/);
});

test('server: old layouts left by earlier builds move out once; imported ones stay', async () => {
  const { start } = require('../../server.js');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-sweep-'));
  for (const [n, meta] of [['tekken8-frostbite', { title: 'Frostbite', game: 'Tekken 8' }], ['tekken8-venom-crew', { title: 'Venom — Crew Battle' }], ['neon-bars', { title: 'Neon Bars', imported: '2026-11-17T00:00:00Z' }]]) {
    fs.mkdirSync(path.join(d, 'overlays', n), { recursive: true });
    fs.writeFileSync(path.join(d, 'overlays', n, 'index.html'), '<html><body data-sb="p1.name"></body></html>');
    fs.writeFileSync(path.join(d, 'overlays', n, 'overlay.json'), JSON.stringify(meta));
  }
  fs.mkdirSync(path.join(d, 'data'), { recursive: true });
  fs.writeFileSync(path.join(d, 'data', 'config.json'), JSON.stringify({ activeOverlay: 'tekken8-frostbite' }));
  const s = await start({ dataDir: d, port: 30000 + Math.floor(Math.random() * 20000), autoPort: true, host: '127.0.0.1', noOpen: true });
  try {
    const list = await (await fetch(`http://127.0.0.1:${s.port}/api/overlays`)).json();
    const names = list.map(o => o.name);
    assert.ok(!names.includes('tekken8-frostbite') && !names.includes('tekken8-venom-crew'));
    assert.ok(names.includes('neon-bars') && names.includes('tekken8-default'));
    assert.ok(list.filter(o => !o.builtIn).every(o => o.imported));
    assert.ok(fs.existsSync(path.join(d, 'data', 'retired-layouts', 'tekken8-frostbite', 'index.html')));
    const cfg = JSON.parse(fs.readFileSync(path.join(d, 'data', 'config.json'), 'utf8'));
    assert.equal(cfg.oldLayoutsSwept, true); assert.notEqual(cfg.activeOverlay, 'tekken8-frostbite');
  } finally { s.close(); }
});
