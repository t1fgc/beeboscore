// 1.5.5: your colours for the app's own layouts (public/sb-colours.js, and the server sending layouts out in them)
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../public/sb-colours.js');
const OV = new URL('../../overlays/', import.meta.url);

test('a part you change moves exactly to your colour, its shades keep their distance, the rest stays', () => {
  const E = C.make('Classic', { plates: '#2a0d12', accent: '#38e58a' });
  assert.equal(E.map('#1c2030'), '#2a0d12');                 // the bars' own colour → yours
  const dark = C.hex2rgb(E.map('#151822')), mine = C.hex2rgb('#2a0d12');
  assert.ok(dark.reduce((a, b) => a + b) < mine.reduce((a, b) => a + b), 'a darker shade stays darker');
  assert.equal(E.map('#e9c35e'), '#38e58a');
  assert.equal(E.map('#ff3b5c'), '#ff3b5c');                 // player 1 not chosen: unchanged
  assert.equal(E.map('rgba(255,255,255,.2) #000000'), 'rgba(255,255,255,.2) #000000');
  assert.equal(E.map(E.map('#151822')), E.map('#151822'), 'never moved twice');
  assert.equal(C.make('Classic', {}).on, false);
  assert.equal(C.make('Classic', { plates: '#1c2030' }).on, false, 'the layout’s own colour is no change');
});

test('a light look: white lettering turns into yours, see-through white stays, a white this made is never taken for it', () => {
  const E = C.make('Classic', { plates: '#fff0f4', backdrop: '#ffe3ea', text: '#3a1a24' });
  const out = E.map('#ffffff');
  assert.notEqual(out, '#ffffff'); assert.ok(C.hex2rgb(out).every(v => v < 100), 'dark lettering');
  assert.equal(E.map('rgba(255,255,255,.2)'), 'rgba(255,255,255,.2)');
  const shade = E.map('#f4f6fa');                              // a near-white that comes out lighter still
  assert.notEqual(shade, '#ffffff');
  assert.equal(E.map('#fff'), out, 'still your lettering after a shade came out white');
  assert.equal(C.make('Classic', { text: '#f0f0ff' }).map('#ffffff'), '#ffffff', 'light lettering: white stays white');
});

test('every colour in the app’s own layouts belongs to one of the nine parts', () => {
  for (const [fam, suf] of [['Classic', 'default'], ['Obsidian Glass', 'obsidian']]) {
    const known = new Set(Object.values(C.KNOWN[fam]).flat().map(x => x.toLowerCase()));
    for (const g of ['tekken8', 'sf6', 'avatar', 'fatalfury']) {
      const hexes = fs.readFileSync(new URL(`${g}-${suf}/design.json`, OV), 'utf8').match(/#[0-9a-fA-F]{6}/g).map(h => h.toLowerCase());
      for (const h of hexes) if (h !== '#ffffff' && h !== '#000000') assert.ok(known.has(h), `${fam} ${g}: ${h}`);
    }
  }
});

test('a design recoloured: every part follows, splash backgrounds and effects included', () => {
  const d = JSON.parse(fs.readFileSync(new URL('tekken8-obsidian/design.json', OV), 'utf8'));
  const mine = { plates: '#1d1233', backdrop: '#08040f', edges: '#4d2f86', text: '#f5efff', subtext: '#a899c9', accent: '#b682ff', p1: '#ff5ccf', p2: '#7c6bff', effects: '#c77dff' };
  const r = JSON.stringify(C.recolourDesign(d, 'Obsidian Glass', mine));
  for (const old of Object.values(C.BASE['Obsidian Glass'])) assert.ok(!r.toLowerCase().includes(old), `${old} left`);
  for (const c of Object.values(mine)) assert.ok(r.includes(c), `${c} used`);
  const sc = JSON.parse(r).scenes.vs;
  assert.equal(sc.particles.color, '#c77dff'); assert.equal(sc.bg.colors.at(-1), '#08040f');
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-col-'));
let srv = null;
after(() => { if (srv) srv.close(); setTimeout(() => process.exit(0), 50).unref(); });
test('server: colours saved per look, layouts go out in them, imported layouts and other looks don’t', async () => {
  const { start } = require('../../server.js');
  srv = await start({ dataDir: dir, port: 30000 + Math.floor(Math.random() * 20000), autoPort: true, host: '127.0.0.1', noOpen: true });
  const U = `http://127.0.0.1:${srv.port}`, post = (p, b) => fetch(U + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  let g = await (await fetch(U + '/api/layout-colours')).json();
  assert.deepEqual(g.roles.length, 9); assert.deepEqual(Object.keys(g.families), ['Classic', 'Obsidian Glass']);
  const r = await post('/api/layout-colours', { family: 'Classic', colours: { plates: '#2A0D12', accent: 'nope', p1: '#ff3b5c' } });
  assert.deepEqual(r.colours, { plates: '#2a0d12' });           // cleaned: bad value out, the layout's own colour out
  const page = await (await fetch(U + '/overlay/sf6-default?direct')).text();
  assert.match(page, /window\.__SB_COLOURS=/); assert.match(page, /\/sb-colours\.js/);
  assert.ok(page.includes('#2a0d12') && !page.includes('"#1c2030"'));
  const obs = await (await fetch(U + '/overlay/sf6-obsidian?direct')).text();
  assert.ok(!obs.includes('__SB_COLOURS') && obs.includes('#1f1d18'), 'Obsidian Glass keeps its own colours');
  const svg = await (await fetch(U + '/o/tekken8-default/assets/logo-496dec71129c.svg')).text();
  assert.ok(svg.includes('#e9c35e'), 'accent not chosen: the picture stays');
  await post('/api/layout-colours', { family: 'Classic', colours: { plates: '#2a0d12', accent: '#38e58a' } });
  assert.ok((await (await fetch(U + '/o/tekken8-default/assets/logo-496dec71129c.svg')).text()).includes('#38e58a'));
  await post('/api/layout-colours', { family: 'Classic', colours: {} });
  g = await (await fetch(U + '/api/layout-colours')).json();
  assert.deepEqual(g.families.Classic.colours, {});
  assert.ok(!(await (await fetch(U + '/overlay/sf6-default?direct')).text()).includes('__SB_COLOURS'));
});
