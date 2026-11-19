// 1.5.6: the layout maker — opening a layout, saving one with its whole-layout colours, and those colours going out with it
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../public/sb-colours.js');

test('a piece given its own colours in the maker keeps them under the whole-layout colours', () => {
  const d = { scenes: { board: { elements: [
    { id: 'a', kind: 'shape', fill: { type: 'solid', colors: ['#1c2030'] } },
    { id: 'b', kind: 'shape', ownColours: true, fill: { type: 'solid', colors: ['#1c2030'] } } ] } } };
  const r = C.recolourDesign(d, 'Classic', { plates: '#0c2333' });
  assert.equal(r.scenes.board.elements[0].fill.colors[0], '#0c2333');
  assert.equal(r.scenes.board.elements[1].fill.colors[0], '#1c2030');
  assert.equal(C.PRESETS.length, 6);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-maker-'));
let srv = null;
after(() => { if (srv) srv.close(); setTimeout(() => process.exit(0), 50).unref(); });
test('server: open in the maker, save with colours, the colours go out with it and its format versions, remove takes them all', async () => {
  const { start } = require('../../server.js');
  srv = await start({ dataDir: dir, port: 30000 + Math.floor(Math.random() * 20000), autoPort: true, host: '127.0.0.1', noOpen: true });
  const U = `http://127.0.0.1:${srv.port}`;
  const get = p => fetch(U + p).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  const post = (p, b) => fetch(U + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  const page = await (await fetch(U + '/designer')).text();
  assert.match(page, /\/static\/maker\.js/); assert.match(page, /Layout maker/);

  const g = await get('/api/designs/get?name=tekken8-obsidian');
  assert.equal(g.status, 200); assert.equal(g.body.builtIn, true); assert.equal(g.body.palette.look, 'Obsidian Glass'); assert.ok(g.body.design.scenes.board.elements.length > 5);
  assert.equal((await get('/api/designs/get?name=nope')).status, 404);

  const d = g.body.design; d.title = 'Night Glass'; d.game = 'Tekken 8'; d.scenes.board.elements[0].x += 40;
  const violet = C.PRESETS.find(p => p[0] === 'Violet')[1];
  const s = await post('/api/designs', { design: d, name: 'night-glass', palette: { look: 'Obsidian Glass', colours: { ...violet, junk: 'x', p1: 'nope' } } });
  assert.equal(s.status, 200); assert.equal(s.body.name, 'night-glass');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'overlays', 'night-glass', 'overlay.json'), 'utf8'));
  assert.equal(meta.maker, true); assert.equal(meta.palette.look, 'Obsidian Glass'); assert.equal(meta.palette.colours.plates, violet.plates); assert.ok(!('junk' in meta.palette.colours)); assert.ok(!('p1' in meta.palette.colours));

  const back = await get('/api/designs/get?name=night-glass');
  assert.equal(back.body.builtIn, false); assert.equal(back.body.palette.colours.accent, violet.accent); assert.equal(back.body.design.scenes.board.elements[0].x, d.scenes.board.elements[0].x);

  const live = await (await fetch(U + '/overlay/night-glass?direct')).text();
  assert.match(live, /window\.__SB_COLOURS=/); assert.ok(live.includes(violet.plates));
  const crew = await (await fetch(U + '/overlay/night-glass-crew?direct')).text();
  assert.match(crew, /window\.__SB_COLOURS=/, 'a format version takes the colours of the layout it’s made from');
  const list = (await get('/api/overlays')).body;
  assert.ok(list.find(o => o.name === 'night-glass').maker); assert.ok(list.some(o => o.name === 'night-glass-crew' && o.base === 'night-glass'));

  // 1.5.7: one of the app's own names is turned away (even when asked to save over it); saving over your own still works
  const own = await post('/api/designs', { design: d, name: 'tekken8-default', overwrite: true });
  assert.equal(own.status, 409); assert.equal(own.body.builtin, true);
  const copy = path.join(dir, 'overlays', 'tekken8-default');      // the data folder keeps a copy of each of the app's own: untouched
  assert.ok(!fs.existsSync(copy) || JSON.parse(fs.readFileSync(path.join(copy, 'design.json'), 'utf8')).title !== 'Night Glass', 'the app’s own layout wasn’t saved over');
  const again = await post('/api/designs', { design: d, name: 'night-glass', overwrite: true });
  assert.equal(again.status, 200);
  const taken = await post('/api/designs', { design: d, name: 'night-glass' });
  assert.equal(taken.status, 409); assert.equal(taken.body.designer, true, 'a name that’s taken by one of yours: the maker offers to replace it');

  const r = await post('/api/layouts/remove', { name: 'night-glass' });
  assert.equal(r.status, 200);
  const after = (await get('/api/overlays')).body;
  assert.ok(!after.some(o => o.name === 'night-glass' || o.base === 'night-glass'), 'its format versions went with it');
});
