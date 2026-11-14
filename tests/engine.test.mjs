import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const F = createRequire(import.meta.url)('../lib/format.js');
const names = (p, n) => Array.from({ length: n }, (_, i) => ({ name: `${p}${i + 1}` }));

test('crew battle: winner stays, team out when everyone lost', () => {
  let f = F.start(F.create('crew', { teams: [{ name: 'Ember', players: names('A', 3) }, { name: 'Frost', players: names('B', 3) }] }));
  assert.equal(F.sides(f).a.name, 'A1'); assert.equal(F.sides(f).b.name, 'B1');
  f = F.apply(f, 1, [1, 0]);                       // A1 beats B1
  assert.equal(F.sides(f).a.name, 'A1'); assert.equal(F.sides(f).b.name, 'B2');
  assert.ok(f.events.some(e => e.type === 'out' && e.name === 'B1'));
  f = F.apply(f, 2, [0, 1]);                       // B2 beats A1
  assert.equal(F.sides(f).a.name, 'A2'); assert.equal(F.sides(f).b.name, 'B2');
  f = F.apply(f, 2); f = F.apply(f, 2);           // B2 sweeps
  assert.equal(f.status, 'done'); assert.equal(f.winner, 1);
  assert.equal(F.view(f).mvp, 'B2');
});
test('crew battle: win limit retires a player who wins too many in a row', () => {
  let f = F.start(F.create('crew', { rules: { winLimit: 2 }, teams: [{ players: names('A', 3) }, { players: names('B', 3) }] }));
  f = F.apply(f, 1); f = F.apply(f, 1);          // A1 wins twice → retires
  assert.ok(f.events.some(e => e.type === 'retire'));
  assert.equal(F.sides(f).a.name, 'A2'); assert.equal(F.sides(f).b.name, 'B3');
  assert.ok(F.view(f).teams[1].laststand);
});
test('Sajam style: paired, first to 3, coaches break a 2-2', () => {
  let f = F.start(F.create('sajam', { teams: [{ name: 'Riddles', coach: { name: 'CoachR' }, players: names('R', 4) }, { name: 'Brian', coach: { name: 'CoachB' }, players: names('B', 4) }] }));
  assert.equal(F.view(f).goal, 3);
  f = F.apply(f, 1, [2, 0]); assert.equal(F.sides(f).a.name, 'R2');
  f = F.apply(f, 2); f = F.apply(f, 1); f = F.apply(f, 2);
  assert.deepEqual(f.points, [2, 2]); assert.ok(f.events.some(e => e.type === 'tiebreak' && e.coaches));
  assert.ok(f.match.tiebreak); assert.equal(F.sides(f).a.name, 'CoachR');
  assert.match(F.label(f), /Tiebreaker/);
  f = F.apply(f, 2); assert.equal(f.status, 'done'); assert.equal(f.winner, 1);
});
test('Sajam style: ends early at 3', () => {
  let f = F.start(F.create('sajam', { teams: [{ players: names('R', 4) }, { players: names('B', 4) }] }));
  f = F.apply(f, 1); f = F.apply(f, 1); assert.ok(F.view(f).teams[0].mp); f = F.apply(f, 1);
  assert.equal(f.status, 'done'); assert.equal(f.winner, 0);
});
test('paired needs equal teams; teams need players', () => {
  assert.throws(() => F.start(F.create('sajam', { teams: [{ players: names('R', 4) }, { players: names('B', 3) }] })), /same number/);
  assert.throws(() => F.start(F.create('crew', { teams: [{ players: [] }, { players: names('B', 3) }] })), /at least one/);
});
test('gauntlet: one vs a line', () => {
  let f = F.start(F.create('gauntlet', { teams: [{ name: 'Boss', players: [{ name: 'Beebo' }] }, { name: 'Chat', players: names('V', 3) }] }));
  f = F.apply(f, 1); f = F.apply(f, 1); f = F.apply(f, 1);
  assert.equal(f.status, 'done'); assert.equal(f.winner, 0);
});
test('Death Battle: lives, placements, final duel, champion', () => {
  let f = F.start(F.create('death', { rules: { lives: 2 }, fighters: names('F', 4) }));
  assert.equal(F.sides(f).a.name, 'F1'); assert.equal(F.sides(f).b.name, 'F2');
  f = F.apply(f, 1);                               // F2 loses a life
  assert.ok(f.events.some(e => e.type === 'life' && e.name === 'F2'));
  assert.equal(F.sides(f).a.name, 'F1'); assert.equal(F.sides(f).b.name, 'F3');
  let guard = 0;
  while (f.status === 'live' && guard++ < 50) f = F.apply(f, 1);   // the stayer keeps winning
  assert.equal(f.status, 'done');
  const v = F.view(f); assert.equal(v.champion, 'F1');
  assert.deepEqual(v.places.map(p => p.place), [1, 2, 3, 4]);
  assert.ok(f.log.some(l => l.final));
});
test('Death Battle: random draw and queue order run to the end', () => {
  for (const pick of ['random', 'queue']) {
    let f = F.start(F.create('death', { rules: { pick }, fighters: names('F', 7) })), g = 0;
    while (f.status === 'live' && g++ < 100) f = F.apply(f, Math.random() < .5 ? 1 : 2);
    assert.equal(f.status, 'done'); assert.equal(F.view(f).places.length, 7);
  }
});
test('King of the Hill: crown, streak goal, join, leave', () => {
  let f = F.start(F.create('koth', { rules: { streakGoal: 3 }, fighters: names('K', 3) }));
  f = F.apply(f, 1); assert.equal(F.view(f).king, 'K1');
  f = F.join(f, { name: 'Late' }); assert.ok(f.queue.length >= 2);
  f = F.apply(f, 2); assert.ok(f.events.some(e => e.type === 'crown' && e.from));
  const k = F.view(f).king; f = F.apply(f, 1); f = F.apply(f, 1);
  assert.equal(f.status, 'done'); assert.equal(F.view(f).champion, k);
  let g = F.start(F.create('koth', { fighters: names('K', 4) })); g = F.apply(g, 1); g = F.end(g); assert.equal(g.status, 'done');
});
test('League: schedule, standings, champion', () => {
  let f = F.start(F.create('league', { fighters: names('L', 5) }));
  assert.equal(f.schedule.length, 10);
  for (const s of f.schedule) assert.notEqual(s.a, s.b);
  let g = 0; while (f.status === 'live' && g++ < 20) f = F.apply(f, F.sides(f).a.name === 'L1' ? 1 : F.sides(f).b.name === 'L1' ? 2 : 1, [2, 1]);
  assert.equal(f.status, 'done'); assert.equal(F.view(f).champion, 'L1');
  assert.equal(F.view(f).standings[0].wins, 4);
});
test('forfeit and swap', () => {
  let f = F.start(F.create('crew', { teams: [{ players: names('A', 3) }, { players: names('B', 3) }] }));
  f = F.swap(f, 1, 2); assert.equal(F.sides(f).a.name, 'A3');
  f = F.forfeit(f, 2); assert.equal(f.log[0].forfeit, true); assert.equal(F.sides(f).b.name, 'B2');
});

// ---- Team Death Battle
const tdb = (rules = {}, n = 3) => F.start(F.create('tdb', { rules, teams: [{ name: 'Ember', players: names('A', n) }, { name: 'Frost', players: names('B', n) }] }));
test('team death battle: lives per fighter, leads can switch before the first set', () => {
  let f = tdb({ lives: 2 });
  assert.equal(f.rules.mode, 'tdb'); assert.equal(f.switchOpen, true);
  assert.deepEqual(f.teams[0].players.map(p => p.lives), [2, 2, 2]);
  f = F.swap(f, 2, 2); assert.equal(F.sides(f).b.name, 'B3');
  assert.ok(f.events.some(e => e.type === 'switch' && e.to === 'B3' && e.from === 'B1'));
  assert.match(F.label(f), /Battle 1/);
});
test('team death battle: a lost set costs a life and opens the switch window for both teams', () => {
  let f = tdb({ lives: 2 });
  f = F.apply(f, 1, [2, 0]);
  assert.equal(f.teams[1].players[0].lives, 1); assert.equal(f.switchOpen, true);
  assert.ok(f.events.some(e => e.type === 'tlife' && e.name === 'B1' && e.lives === 1));
  assert.ok(f.events.some(e => e.type === 'switchwin' && e.teams.length === 2));
  f = F.swap(f, 1, 1); assert.equal(F.sides(f).a.name, 'A2');          // the winner may switch too
  f = F.swap(f, 2, 1); assert.equal(F.sides(f).b.name, 'B2');
});
test('team death battle: a benched fighter keeps their lives for when they come back', () => {
  let f = tdb({ lives: 3 });
  f = F.apply(f, 1); f = F.apply(f, 1);                 // B1: 3 → 1
  f = F.swap(f, 2, 1);                                  // B2 in
  f = F.apply(f, 2);                                    // A1 loses a life (window opens again)
  f = F.swap(f, 2, 0);                                  // B1 comes back
  assert.equal(F.sides(f).b.name, 'B1'); assert.equal(f.teams[1].players[0].lives, 1);
  assert.equal(F.view(f).teams[1].players[0].lives, 1);
});
test('team death battle: switching is closed between lives, and Lock in closes it', () => {
  let f = tdb({ lives: 3 });
  f = F.lockSwitch(f); assert.equal(f.switchOpen, false);
  assert.throws(() => F.swap(f, 1, 1), /after someone loses a life/);
  f = F.apply(f, 1); assert.equal(f.switchOpen, true);
});
test('team death battle: a life worth 2 sets cracks first, then breaks', () => {
  let f = tdb({ lives: 2, setsPerLife: 2 });
  f = F.apply(f, 1);
  assert.equal(f.teams[1].players[0].lives, 2); assert.equal(f.teams[1].players[0].hits, 1); assert.equal(f.switchOpen, false);
  assert.ok(f.events.some(e => e.type === 'thit' && e.hits === 1 && e.per === 2));
  f = F.apply(f, 1);
  assert.equal(f.teams[1].players[0].lives, 1); assert.equal(f.teams[1].players[0].hits, 0);
  assert.ok(f.events.some(e => e.type === 'tlife'));
});
test('team death battle: knocked out fighters are replaced, the last team standing wins', () => {
  let f = tdb({ lives: 1 }, 2);
  f = F.apply(f, 1);
  assert.ok(f.events.some(e => e.type === 'tko' && e.name === 'B1' && e.left === 1));
  assert.equal(F.sides(f).b.name, 'B2');
  assert.throws(() => F.swap(f, 2, 0), /out/);
  assert.ok(f.events.some(e => e.type === 'laststand'));
  f = F.apply(f, 1);
  assert.equal(f.status, 'done'); assert.equal(f.winner, 0);
  const v = F.view(f); assert.equal(v.teams[0].livesLeft, 2); assert.equal(v.teams[1].livesLeft, 0);
});
test('team death battle: only the team that lost the life may switch (rule)', () => {
  let f = tdb({ lives: 3, switching: 'loser' });
  f = F.apply(f, 1);                                     // team 2 lost a life
  assert.throws(() => F.swap(f, 1, 1), /Only the team that lost/);
  f = F.swap(f, 2, 1); assert.equal(F.sides(f).b.name, 'B2');
});
test('team death battle: lives can be corrected by hand', () => {
  let f = tdb({ lives: 2 });
  f = F.setLives(f, 't1-2', 5); assert.equal(f.teams[1].players[2].lives, 5);
  f = F.setLives(f, 't1-2', 0); assert.equal(f.teams[1].players[2].out, true);
});
