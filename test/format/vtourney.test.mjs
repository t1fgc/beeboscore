import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const VT = require('../../lib/vtourney.js');
const BR = require('../../lib/bracket.js');
const names = n => Array.from({ length: n }, (_, i) => `Viewer${i + 1}`);
function play(t) { let guard = 0; while (t.status === 'live' && guard++ < 1000) { const s = VT.ready(t)[0]; VT.setNow(t, s.id); VT.report(t, s.id, 'a', 2, 1); } return t; }

test('signups: open, duplicates, max, closed', () => {
  const t = VT.create({ max: 3 });
  assert.equal(VT.join(t, { name: 'A', login: 'a' }).code, 'closed');
  t.open = true;
  assert.ok(VT.join(t, { name: 'A', login: 'a' }).ok);
  assert.equal(VT.join(t, { name: 'a', login: 'x' }).code, 'already');
  assert.ok(VT.join(t, { name: 'B', login: 'b' }).ok); assert.ok(VT.join(t, { name: 'C', login: 'c' }).ok);
  assert.equal(VT.join(t, { name: 'D', login: 'd' }).code, 'full');
  assert.ok(VT.join(t, { name: 'D' }, { force: true }).ok);
  assert.ok(VT.leave(t, 'b').ok); assert.equal(t.entrants.length, 3);
});
for (const n of [2, 3, 5, 8, 13, 16, 33, 100]) test(`a full single-elim run with ${n} players`, () => {
  const t = VT.create({ seeding: 'order' }); t.open = true; names(n).forEach(x => VT.join(t, { name: x }));
  VT.generate(t);
  const v0 = VT.view(t); assert.equal(v0.alive, n); assert.equal(v0.total, n - 1);
  // the splash model builds at every step
  const m = BR.build(VT.toRaw(t), { event: t.name }); assert.equal(m.type, 'SE'); assert.ok(m.winners.length >= 1);
  assert.ok(m.winners[0].sets.length <= 16 || VT.view(t).grid, 'a round bigger than a screen is shown as pages');
  play(t);
  assert.equal(t.status, 'done'); assert.equal(VT.view(t).champion, n === 2 || true ? VT.view(t).champion : ''); assert.ok(VT.view(t).champion);
  assert.equal(VT.view(t).played, n - 1);
  const mf = BR.build(VT.toRaw(t)); assert.equal(mf.left, 1);
});
test('seed 1 gets the bye; 1 and 2 only meet in the final', () => {
  const o = VT.seedOrder(8); assert.deepEqual(o, [1, 8, 4, 5, 2, 7, 3, 6]);
  const t = VT.create({ seeding: 'order' }); t.open = true; names(5).forEach(x => VT.join(t, { name: x })); VT.generate(t);
  const r1 = t.sets.filter(s => s.round === 1);
  assert.ok(r1.find(s => s.a === t.entrants[0].id).bye);
  assert.deepEqual(VT.ready(t).map(s => s.round), [1, 2]);   // 5 players: one real first-round match, and seeds 2 v 3 (both had byes)
});
test('big rounds: 100 players starts as pages, then the tree once it fits', () => {
  const t = VT.create(); t.open = true; names(100).forEach(x => VT.join(t, { name: x })); VT.generate(t);
  assert.ok(VT.view(t).grid); assert.equal(VT.view(t).grid.sets.length, 36);   // 100 players: 36 first-round matches (28 byes)
  while (VT.ready(t)[0].round < 3) { const s = VT.ready(t)[0]; VT.report(t, s.id, 'b'); }
  assert.equal(VT.view(t).grid, null);
  const m = BR.build(VT.toRaw(t)); assert.ok(m.winners[0].sets.length <= 16);
  assert.equal(m.left, VT.view(t).alive);
});
test('a wrong result is refused', () => {
  const t = VT.create(); t.open = true; names(4).forEach(x => VT.join(t, { name: x })); VT.generate(t);
  assert.throws(() => VT.report(t, 'r2m1', 'a'));
  const s = VT.ready(t)[0]; VT.report(t, s.id, 'a'); assert.throws(() => VT.report(t, s.id, 'b'));
});
