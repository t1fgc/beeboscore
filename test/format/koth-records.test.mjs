// 1.12.6: King of the Hill records (this event + the Emperor of the World), and the same name twice in a format
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createKothRecords } = require('../../lib/koth-records.js');
const FMT = require('../../lib/format.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'koth-'));

test('fights count for this event and for the Emperor of the World, and the files are written', () => {
  const dir = tmp(), r = createKothRecords({ dir });
  r.startEvent('Friday KOTH');
  r.fight({ winner: 'CrimsonByte', loser: 'NeonGhoul', streak: 1, n: 1, crowned: true });
  r.fight({ winner: 'CrimsonByte', loser: 'RamenRush', streak: 2, n: 2 });
  r.fight({ winner: 'IronMoth', loser: 'CrimsonByte', streak: 1, n: 3, crowned: true });
  const v = r.view();
  assert.equal(v.fights, 3); assert.equal(v.players, 4);
  assert.equal(v.emperors[0].name, 'CrimsonByte'); assert.equal(v.emperors[0].wins, 2); assert.equal(v.emperors[0].best, 2);
  assert.equal(v.event.rows[0].name, 'CrimsonByte');
  r.flush();
  assert.ok(fs.existsSync(r.files.json)); assert.match(fs.readFileSync(r.files.csv, 'utf8'), /Rank,Player,Wins/);
});

test('a new event starts its table over; the all-time table keeps everyone', () => {
  const r = createKothRecords({ dir: tmp() });
  r.startEvent('One'); r.fight({ winner: 'VoidTaco', loser: 'GlassJaw99', streak: 1, n: 1 }); r.endEvent('VoidTaco');
  r.startEvent('Two'); r.fight({ winner: 'BeanCounter', loser: 'TurboMoth', streak: 1, n: 1 });
  const v = r.view();
  assert.deepEqual(v.event.rows.map(x => x.name).sort(), ['BeanCounter', 'TurboMoth']);
  assert.equal(v.players, 4); assert.equal(v.events, 2);
});

test('an undone fight is taken back; names match whatever the case', () => {
  const r = createKothRecords({ dir: tmp() });
  r.startEvent('E'); r.fight({ winner: 'ShadowKoi', loser: 'PixelPaladin', streak: 1, n: 1 }); r.fight({ winner: 'shadowkoi', loser: 'IronMoth', streak: 2, n: 2 });
  r.unfight(2);
  const v = r.view();
  assert.equal(v.emperors.find(x => x.name.toLowerCase() === 'shadowkoi').wins, 1);
  assert.equal(v.emperors.find(x => x.name.toLowerCase() === 'shadowkoi').best, 1);
});

test('a backup restores, and merges add up', () => {
  const a = createKothRecords({ dir: tmp() });
  a.startEvent('E'); a.fight({ winner: 'NeonGhoul', loser: 'CrimsonByte', streak: 1, n: 1 });
  const backup = JSON.parse(JSON.stringify(a.exportAll()));
  const b = createKothRecords({ dir: tmp() });
  b.startEvent('F'); b.fight({ winner: 'NeonGhoul', loser: 'VoidTaco', streak: 1, n: 1 });
  b.importAll(backup, { merge: true });
  assert.equal(b.view().emperors.find(x => x.name === 'NeonGhoul').wins, 2);
  b.importAll(backup);
  assert.equal(b.view().emperors.find(x => x.name === 'NeonGhoul').wins, 1);
  assert.throws(() => b.importAll({ nope: 1 }));
});

test('the same name twice is refused in every format', () => {
  assert.throws(() => FMT.create('death', { fighters: [{ name: 'IronMoth' }, { name: 'ironmoth ' }, { name: 'VoidTaco' }] }), /same name/);
  const f = FMT.create('crew', { teams: [{ name: 'A', players: [{ name: 'RamenRush' }] }, { name: 'B', players: [{ name: 'GlassJaw99' }] }] });
  f.teams[1].players[0].name = 'RAMENRUSH';
  assert.throws(() => FMT.start(f), /same name/);
  const k = FMT.start(FMT.create('koth', { fighters: [{ name: 'BeanCounter' }, { name: 'TurboMoth' }] }));
  assert.throws(() => FMT.join(k, { name: 'beancounter' }), /already in/);
  assert.doesNotThrow(() => FMT.join(k, { name: 'ShadowKoi' }));
});

test('a team keeps its logo (pictures from the app only)', () => {
  const f = FMT.create('tdb', { teams: [{ name: 'A', logo: '/assets/x.png', players: [{ name: 'P1' }] }, { name: 'B', logo: 'https://elsewhere/x.png', players: [{ name: 'P2' }] }] });
  assert.equal(f.teams[0].logo, '/assets/x.png'); assert.equal(f.teams[1].logo, '');
  assert.equal(FMT.view(FMT.start(f)).teams[0].logo, '/assets/x.png');
});
