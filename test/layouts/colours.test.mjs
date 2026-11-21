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
  const R = JSON.parse(r), sc = R.scenes.vs;
  assert.equal(sc.bg.colors.at(-1), '#08040f');
  // 1.5.9: Obsidian's players share the gold: each player's colour takes over the gold on that player's own pieces
  const b = R.scenes.board.elements, bar = s => b.find(e => e.kind === 'bar' && e.side === s);
  assert.equal(bar(1).stroke.color, '#ff5ccf'); assert.equal(bar(2).stroke.color, '#7c6bff');
  assert.equal(b.find(e => e.kind === 'header').stroke.color, '#b682ff', 'the accent everywhere else');
  const acc = C.recolourDesign(d, 'Obsidian Glass', { accent: '#b682ff' }).scenes.board.elements;
  assert.equal(acc.find(e => e.kind === 'bar' && e.side === 1).stroke.color, '#b682ff', 'no player colour picked: the player follows the accent');
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

// 1.5.10: a light colour set (Sakura) showed a black well behind Street Fighter 6's set pips, and Classic Fatal Fury's bars lost
// the hard shadow its set boxes kept. On every scoreboard: pure black is only a hard drop shadow, and every drop shadow is black.
test('scoreboards: pure black only for drop shadows, and every drop shadow is black', () => {
  for (const suf of ['default', 'obsidian']) for (const g of ['tekken8', 'sf6', 'avatar', 'fatalfury']) {
    const d = JSON.parse(fs.readFileSync(new URL(`${g}-${suf}/design.json`, OV), 'utf8'));
    for (const e of d.scenes.board.elements) {
      const f = e.fill; if (!f || f.type === 'none' || !(e.opacity > 0)) continue;
      const black = (f.colors || []).some(c => /^#000000(ff)?$/i.test(c)), drop = /\bdrop\b/i.test(e.name || '');
      if (drop) assert.ok((f.colors || []).every(c => /^#000000(ff)?$/i.test(c)), `${g}-${suf}: ${e.name} is a shadow: black`);
      else assert.ok(!black, `${g}-${suf}: ${e.name} is drawn in pure black, which your colours can't move`);
    }
  }
});

// 1.5.11: on a light colour set (Sakura), lettering drawn in a pale shade of a part (a gold highlight, a cream line, the
// effect colour) came out nearly white on the light plates of the splashes. It's deepened towards your lettering colour.
const lumOf = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; const [r, g, b] = C.hex2rgb(c); return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
test('a light look: the splashes’ lettering stands out from the light plates, and dark looks are untouched', () => {
  const sakura = C.PRESETS.find(p => p[0] === 'Sakura')[1];
  for (const suf of ['default', 'obsidian']) for (const g of ['tekken8', 'sf6', 'avatar', 'fatalfury']) {
    const d = JSON.parse(fs.readFileSync(new URL(`${g}-${suf}/design.json`, OV), 'utf8')), fam = suf === 'obsidian' ? 'Obsidian Glass' : 'Classic';
    const out = C.recolourDesign(d, fam, sakura);
    for (const [sn, s] of Object.entries(out.scenes)) {
      if (sn === 'board') continue;
      for (const e of s.elements) {
        if (e.kind !== 'text' && e.kind !== 'bracket') continue;
        const cs = [...(e.font.color.colors || []), ...(e.font.gfxColors || []), ...(e.kind === 'bracket' ? [e.winColor, e.subColor, e.teamColor] : [])].filter(c => /^#[0-9a-f]{6}$/i.test(c || ''));
        for (const c of cs) assert.ok(ratio(c, sakura.plates) >= 3.49, `${g}-${suf} ${sn}: ${e.name} lettering ${c} on ${sakura.plates} (${ratio(c, sakura.plates).toFixed(2)}:1)`);
      }
      for (const e of s.elements.filter(x => x.kind === 'avatar')) for (const c of e.font.color.colors || [])
        assert.ok(ratio(c, '#111111') >= 4.49, `${g}-${suf} ${sn}: ${e.name}'s initial reads on its dark box`);
    }
    // the scoreboard is left as it was
    const plain = C.recolourDesign({ ...d, scenes: { board: d.scenes.board } }, fam, sakura);
    assert.deepEqual(out.scenes.board, plain.scenes.board);
  }
  // a dark look of yours: nothing deepened
  for (const [n, set] of C.PRESETS.filter(p => p[0] !== 'Sakura')) {
    const E = C.make('Classic', set); assert.equal(E.light, false, n);
    assert.equal(E.ink('#e9c35e', 4.5), E.map('#e9c35e'), n); assert.equal(E.deepen('#3b8eff', 4.5), '#3b8eff', n);
  }
  // a light look: a pale gold line is deepened, a team's colour is only deepened (never recoloured), dark ink is left alone
  const L = C.make('Classic', sakura);
  assert.ok(L.light);
  assert.ok(ratio(L.ink('#f3d98c', 4.5), sakura.plates) >= 4.49);
  assert.ok(ratio(L.deepen('#ff3b5c', 4.5), sakura.plates) >= 4.49);
  assert.equal(L.ink('#3a1a24', 4.5), '#3a1a24');
  assert.equal(L.map(L.ink('#f3d98c', 4.5)), L.ink('#f3d98c', 4.5), 'what ink() made is never moved again');
});
