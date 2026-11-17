import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const VT = require('../../lib/vtourney.js');
const BR = require('../../lib/bracket.js');
const names = n => Array.from({ length: n }, (_, i) => `Viewer${i + 1}`);
const mk = (n, o = {}) => { const t = VT.create({ seeding: 'order', ...o }); t.open = true; names(n).forEach(x => VT.join(t, { name: x })); return t; };
// the better seed always wins
const better = (t, s) => ((t.entrants.find(e => e.id === s.a) || {}).seed || 99) < ((t.entrants.find(e => e.id === s.b) || {}).seed || 99) ? 'a' : 'b';
function play(t, pick = better) { let g = 0; while (t.status === 'live' && g++ < 2000) { const s = VT.ready(t)[0]; assert.ok(s, 'a match is always ready while it is live'); VT.setNow(t, s.id); VT.report(t, s.id, pick(t, s), 2, 0); } return t; }

for (const n of [2, 3, 4, 5, 8, 11, 16, 24, 33]) test(`double elimination, ${n} players, runs to a champion`, () => {
  const t = mk(n, { type: 'DE' }); VT.generate(t);
  BR.build(VT.toRaw(t), {});
  play(t);
  assert.equal(t.status, 'done');
  assert.equal(VT.view(t).champion, 'Viewer1');
  const pl = VT.placements(t);
  assert.equal(pl.get(t.entrants[0].id), 1);
  assert.equal(pl.get(t.entrants[1].id), 2);
  if (n >= 4) assert.equal(pl.get(t.entrants[2].id), 3);
  // everyone has a place at the end
  assert.equal(pl.size, n);
  const m = BR.build(VT.toRaw(t), {});
  assert.equal(m.type, 'DE'); assert.equal(m.finished, true);
  assert.deepEqual(m.standings.slice(0, Math.min(n, 4)).map(s => s.name), ['Viewer1', 'Viewer2', 'Viewer3', 'Viewer4'].slice(0, Math.min(n, 4)));
});
test('double elimination: nobody is out after one loss; the reset happens only when the losers side wins', () => {
  const t = mk(4, { type: 'DE' }); VT.generate(t);
  // seed 1 loses its first match, then wins everything
  let first = true;
  play(t, (tt, s) => { const one = tt.entrants[0].id; if (first && (s.a === one || s.b === one)) { first = false; return s.a === one ? 'b' : 'a'; } return s.a === one ? 'a' : s.b === one ? 'b' : better(tt, s); });
  assert.equal(VT.view(t).champion, 'Viewer1');
  const g2 = t.sets.find(s => s.id === 'gf2'); assert.ok(g2.w && g2.w !== 'none', 'grand final reset was played');
  const t2 = mk(4, { type: 'DE' }); VT.generate(t2); play(t2);
  assert.equal(t2.sets.find(s => s.id === 'gf2').skip, true, 'no reset when the winners-side player wins');
});
test('play order goes winners round, then the losers rounds it feeds', () => {
  const t = mk(8, { type: 'DE' }); VT.generate(t);
  const seen = []; play(t, (tt, s) => { seen.push(s.id.replace(/m\d+$/, '')); return better(tt, s); });
  const firstIdx = k => seen.indexOf(k), lastIdx = k => seen.lastIndexOf(k);
  assert.ok(lastIdx('r1') < firstIdx('l1') || firstIdx('l1') > firstIdx('r1'));
  assert.ok(lastIdx('r2') < firstIdx('l2'));
  assert.ok(lastIdx('r3') < firstIdx('l4'));
  assert.equal(seen.at(-1).startsWith('gf'), true);
});
test('DQ: their matches become forfeits, the bracket carries on', () => {
  for (const type of ['SE', 'DE']) {
    const t = mk(8, { type }); VT.generate(t);
    const out = t.entrants[3];
    VT.dq(t, out.id);
    assert.ok(t.sets.some(s => s.ff), 'a forfeit is recorded');
    assert.ok(!VT.ready(t).some(s => s.a === out.id || s.b === out.id), 'they never play again');
    play(t);
    assert.equal(t.status, 'done');
    assert.throws(() => VT.dq(t, out.id));
    BR.build(VT.toRaw(t), {});
  }
});
test('forfeit a single match', () => {
  const t = mk(4); VT.generate(t);
  const s = VT.ready(t)[0]; VT.report(t, s.id, 'b', null, null, { ff: true });
  assert.equal(s.ff, 'a'); assert.equal(s.sa, null);
  const raw = VT.toRaw(t); const rs = raw.sets.find(x => x.id === s.id); assert.equal(rs.slots[0].score, -1);
});
test('check-in: only players who checked in make the bracket', () => {
  const t = mk(6);
  VT.setCheckin(t, true);
  assert.equal(VT.checkIn(t, 'viewer1').ok, true);
  assert.equal(VT.checkIn(t, 'Viewer2').ok, true);
  assert.equal(VT.checkIn(t, 'Viewer2').code, 'already');
  assert.equal(VT.checkIn(t, 'Nobody').code, 'missing');
  assert.equal(VT.view(t).checkin.here, 2);
  assert.throws(() => { const x = mk(3); VT.setCheckin(x, true); VT.checkIn(x, 'Viewer1'); VT.generate(x); });
  VT.checkIn(t, 'Viewer5'); VT.generate(t);
  assert.deepEqual(t.entrants.map(e => e.name), ['Viewer1', 'Viewer2', 'Viewer5']);
});
test('re-seeding by hand and shuffling', () => {
  const t = mk(4, { seeding: 'random' });
  const ids = t.entrants.map(e => e.id).reverse();
  VT.reseed(t, ids);
  assert.deepEqual(t.entrants.map(e => e.name), ['Viewer4', 'Viewer3', 'Viewer2', 'Viewer1']);
  assert.equal(t.seeding, 'order');
  VT.generate(t); assert.equal(t.entrants[0].name, 'Viewer4'); assert.equal(t.entrants[0].seed, 1);
  assert.throws(() => VT.reseed(t, 'shuffle'));
});
test('signups: a renamed Twitch account stays one entrant; junk names are refused', () => {
  const t = VT.create(); t.open = true;
  VT.join(t, { name: 'OldName', login: 'pixel' });
  assert.equal(VT.join(t, { name: 'NewName', login: 'pixel' }).code, 'already');
  assert.equal(t.entrants.length, 1); assert.equal(t.entrants[0].name, 'NewName');
  assert.equal(VT.join(t, { name: '~~~' }).code, 'name');
});
test('an old saved tournament still loads', () => {
  const old = { v: 1, name: 'Old', status: 'live', entrants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], sets: [{ id: 'r1m1', round: 1, idx: 0, a: 'a', b: 'b', w: '', from: ['', ''] }], rounds: 1, seq: 3 };
  const t = VT.normalize(old);
  assert.equal(t.type, 'SE'); assert.equal(t.sets[0].side, 'W');
  VT.report(t, 'r1m1', 'a'); assert.equal(t.status, 'done');
});
