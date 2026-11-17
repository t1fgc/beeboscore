import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const VT = require('../../lib/vtourney.js');
const BR = require('../../lib/bracket.js');
const NAMES = ['CrimsonByte', 'NeonGhoul', 'ShadowKoi', 'VoidTaco', 'RamenRush', 'IronMoth', 'PixelPaladin', 'GlassJaw99', 'LunarLynx', 'MochiMauler', 'TurboTofu', 'OrbitOtter', 'FrostFang', 'NovaNacho', 'BlitzBadger', 'ZenZebra'];
const make = (o, n) => { const t = VT.create({ ...o, seeding: 'order' }); NAMES.slice(0, n).forEach(name => VT.join(t, { name }, { force: true })); VT.generate(t); return t; };
const nm = (t, id) => t.entrants.find(e => e.id === id).name;
// the lower seed always wins 2–1 (deterministic), unless the set says otherwise
function playAll(t, pick = s => { const sa = t.entrants.find(e => e.id === s.a).seed, sb = t.entrants.find(e => e.id === s.b).seed; return sa < sb ? 'a' : 'b'; }) {
  for (let i = 0; i < 400 && t.status !== 'done'; i++) { const s = VT.ready(t)[0]; if (!s) break; const w = pick(s); VT.report(t, s.id, w, w === 'a' ? 2 : 1, w === 'a' ? 1 : 2); }
}

test('round robin: everyone plays everyone once, table decides the champion', () => {
  const t = make({ type: 'RR' }, 5);
  const g = t.sets.filter(s => s.side === 'RR');
  assert.equal(g.length, 10);                                   // 5 choose 2
  const pairs = new Set(g.map(s => [s.a, s.b].sort().join('|'))); assert.equal(pairs.size, 10);
  assert.equal(VT.view(t).grid.kind, 'ROUND ROBIN');
  playAll(t);
  assert.equal(t.status, 'done');
  assert.equal(nm(t, t.champion), 'CrimsonByte');
  const pl = VT.placements(t); assert.equal(pl.size, 5); assert.equal(pl.get(t.entrants[4].id), 5);
  const tb = VT.table(t); assert.deepEqual(tb.map(r => r.w), [4, 3, 2, 1, 0]);
});

test('pools → top cut: snake seeding, pool winners seeded first, cut bracket finishes it', () => {
  const t = make({ type: 'RR', pools: 2, cut: 4 }, 8);
  const v = VT.view(t);
  assert.equal(v.tables.length, 2); assert.equal(v.tables[0].pool, 'A');
  assert.match(v.kind, /2 POOLS · ROUND ROBIN → TOP 4/);
  // seeds 1,4,5,8 in pool A; 2,3,6,7 in pool B
  const poolOf = seed => t.sets.find(s => s.side === 'RR' && [s.a, s.b].includes(t.entrants[seed - 1].id)).pool;
  assert.equal(poolOf(1), poolOf(4)); assert.equal(poolOf(2), poolOf(3)); assert.notEqual(poolOf(1), poolOf(2));
  playAll(t);
  assert.ok(t.sets.some(s => s.side === 'W'), 'the cut bracket was drawn');
  assert.equal(t.cutIds.length, 4);
  assert.deepEqual(t.cutIds.slice(0, 2).map(id => nm(t, id)).sort(), ['CrimsonByte', 'NeonGhoul']);
  assert.equal(t.status, 'done'); assert.equal(nm(t, t.champion), 'CrimsonByte');
  const pl = VT.placements(t); assert.equal(pl.size, 8); assert.equal(Math.max(...pl.values()), 8);
  assert.match(VT.setName(t, t.sets.find(s => s.side === 'W' && s.round === 2)), /Top 4 · Final/);
  // the splash bracket only draws the cut
  const raw = VT.toRaw(t); assert.ok(raw.sets.every(s => /^r\d/.test(s.id)));
  const m = BR.build(raw); assert.equal(m.type, 'SE');
});

test('swiss: no rematches, byes go round, rounds pair themselves, then a top cut', () => {
  const t = make({ type: 'SW', cut: 4 }, 7);                    // 7 players → 3 rounds, a bye every round
  assert.equal(VT.view(t).swissRounds, 3);
  playAll(t, s => (s.idx + s.round) % 2 ? 'a' : 'b');
  const g = t.sets.filter(s => s.side === 'SW');
  assert.deepEqual([...new Set(g.map(s => s.round))], [1, 2, 3]);
  const real = g.filter(s => !s.bye), pairs = real.map(s => [s.a, s.b].sort().join('|'));
  assert.equal(new Set(pairs).size, pairs.length, 'no rematches');
  const byes = g.filter(s => s.bye).map(s => s.a); assert.equal(byes.length, 3); assert.equal(new Set(byes).size, 3, 'a different bye each round');
  assert.ok(t.sets.some(s => s.side === 'W')); assert.equal(t.status, 'done');
  assert.equal(VT.placements(t).size, 7);
});

test('swiss DQ: forfeits their match and leaves them out of later rounds', () => {
  const t = make({ type: 'SW', swissRounds: 3 }, 6);
  const out = t.entrants[5];
  VT.dq(t, out.id);
  playAll(t);
  const later = t.sets.filter(s => s.side === 'SW' && s.round > 1);
  assert.ok(later.every(s => s.a !== out.id && s.b !== out.id));
  assert.equal(t.status, 'done'); assert.equal(VT.table(t).pop().id, out.id);
});

test('stations: ready matches get a free station; the one on stream does not', () => {
  const t = make({ type: 'RR', stations: 2 }, 6);
  let v = VT.view(t);
  assert.deepEqual(v.stationsNow.map(x => x.station), [1, 2]);
  const first = VT.ready(t)[0]; VT.setNow(t, first.id);
  v = VT.view(t); assert.ok(!v.stationsNow.some(x => x.id === first.id)); assert.equal(v.stationsNow.length, 2);
  const s2 = v.stationsNow[0]; VT.report(t, s2.id, 'a', 2, 0);
  v = VT.view(t); assert.ok(v.stationsNow.some(x => x.station === s2.station && x.id !== s2.id), 'station 1 got the next match');
});

test('normalize keeps old tournaments working', () => {
  const t = VT.normalize({ v: 2, name: 'Old', type: 'SE', entrants: [], sets: [] });
  assert.equal(t.cut, 0); assert.equal(t.pools, 1); assert.equal(t.stations, 0);
  const x = VT.normalize({ type: 'SE', cut: 4 }); assert.equal(x.cut, 0, 'no cut for elimination');
});
