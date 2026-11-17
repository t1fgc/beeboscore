import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const F = createRequire(import.meta.url)('../../lib/format.js');
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

// ---- the Format tab's player manager (adjust)
test('manager, crew: knock out the player in the match, bring them back, reorder the line', () => {
  let f = F.start(F.create('crew', { teams: [{ players: names('A', 3) }, { players: names('B', 4) }] }));
  f = F.adjust(f, { op: 'out', id: 't1-0', out: true });
  assert.equal(F.sides(f).b.name, 'B2'); assert.ok(f.events.some(e => e.type === 'out'));
  f = F.adjust(f, { op: 'order', id: 't1-3', to: 2 }); assert.deepEqual(f.teams[1].players.map(p => p.name), ['B1', 'B2', 'B4', 'B3']);
  assert.throws(() => F.adjust(f, { op: 'order', id: 't1-0', to: 3 }), /played/);
  f = F.adjust(f, { op: 'out', id: 't1-0', out: false }); assert.equal(f.teams[1].players[0].out, false);
  f = F.adjust(f, { op: 'wins', id: 't0-0', n: 4 }); assert.equal(F.view(f).teams[0].players[0].wins, 4);
  for (const i of [1, 2, 3]) f = F.adjust(f, { op: 'out', id: `t1-${i}`, out: true });
  assert.equal(f.status, 'live');               // B1 came back, so team 2 still has someone
  f = F.adjust(f, { op: 'out', id: 't1-0', out: true }); assert.equal(f.status, 'done'); assert.equal(f.winner, 0);
});
test('manager, team battle: set the points', () => {
  let f = F.start(F.create('sajam', { teams: [{ players: names('A', 4) }, { players: names('B', 4) }] }));
  f = F.adjust(f, { op: 'points', t: 1, n: 2 }); assert.equal(F.view(f).teams[1].points, 2); assert.equal(F.view(f).teams[1].mp, true);
});
test('manager, team death battle: lives, cracks and a knock-out move the next fighter in', () => {
  let f = tdb({ lives: 3, setsPerLife: 2 });
  f = F.adjust(f, { op: 'hits', id: 't1-0', n: 1 }); assert.equal(f.teams[1].players[0].hits, 1);
  f = F.adjust(f, { op: 'lives', id: 't1-0', n: 1 }); assert.equal(f.teams[1].players[0].lives, 1);
  f = F.adjust(f, { op: 'lives', id: 't1-0', n: 0 }); assert.equal(F.sides(f).b.name, 'B2'); assert.ok(f.events.some(e => e.type === 'tko'));
  f = F.adjust(f, { op: 'out', id: 't1-0', out: false }); assert.equal(f.teams[1].players[0].lives, 1);
});
test('manager, death battle: lives to 0 eliminates with a place, bring back, queue and play now', () => {
  let f = F.start(F.create('death', { rules: { lives: 2 }, fighters: names('F', 5) }));
  const id = n => f.fighters.find(x => x.name === n).id;
  assert.throws(() => F.adjust(f, { op: 'out', id: id('F1'), out: true }), /playing now/);
  f = F.adjust(f, { op: 'lives', id: id('F5'), n: 0 }); assert.equal(f.fighters[4].out, true); assert.equal(f.fighters[4].place, 5);
  f = F.adjust(f, { op: 'out', id: id('F5'), out: false }); assert.equal(f.fighters[4].out, false); assert.equal(f.fighters[4].lives, 1);
  f = F.adjust(f, { op: 'queue', id: id('F5'), to: 0 }); assert.equal(F.view(f).next, 'F5');
  f = F.adjust(f, { op: 'play', id: id('F4'), side: 2 }); assert.equal(F.sides(f).b.name, 'F4'); assert.equal(F.view(f).next, 'F2');
});
test('manager, king of the hill: crown someone and fix a streak', () => {
  let f = F.start(F.create('koth', { fighters: names('K', 4) }));
  const id = n => f.fighters.find(x => x.name === n).id;
  f = F.adjust(f, { op: 'king', id: id('K3') }); assert.equal(F.view(f).king, 'K3');
  f = F.adjust(f, { op: 'streak', id: id('K3'), n: 4 }); assert.equal(F.view(f).streak, 4);
});
test('manager, league: set, change and clear any result', () => {
  let f = F.start(F.create('league', { fighters: names('L', 3) }));
  const s = f.schedule[2];
  f = F.adjust(f, { op: 'result', sid: s.id, w: 2, score: [1, 2] }); assert.equal(F.view(f).played, 1);
  assert.throws(() => F.adjust(f, { op: 'result', sid: s.id, w: 1, score: [0, 2] }), /other player/);
  for (const x of f.schedule.filter(x => !x.done)) f = F.adjust(f, { op: 'result', sid: x.id, w: 1 });
  assert.equal(f.status, 'done');
  f = F.adjust(f, { op: 'unresult', sid: s.id }); assert.equal(f.status, 'live'); assert.equal(F.view(f).played, 2);
});
test('1.11: a player’s own picture or clip, and its green screen, ride along with the roster and the view', () => {
  const f = F.start(F.create('tdb', { teams: [{ name: 'Ember', players: [{ name: 'A1', pic: '/assets/a1.webm', picKey: '#00B242' }, { name: 'A2', pic: 'https://evil.example/x.png' }] }, { name: 'Frost', players: names('B', 2) }] }));
  const t = F.view(f).teams[0].players;
  assert.equal(t[0].pic, '/assets/a1.webm'); assert.equal(t[0].picKey, '#00b242', 'the screen colour, as a lower-case hex');
  assert.equal(t[1].pic, '', 'a picture from elsewhere on the web is dropped');
  assert.equal(F.sides(f).a.pic, '/assets/a1.webm', 'the player on the scoreboard carries it too');
  const g = F.start(F.create('death', { fighters: [{ name: 'X', pic: '/assets/x.png', picKey: 'green' }, { name: 'Y' }, { name: 'Z' }] }));
  assert.equal(F.view(g).fighters[0].pic, '/assets/x.png'); assert.equal(F.view(g).fighters[0].picKey, '', 'not a colour → shown as it is');
});
test('team death battle: a fighter given extra lives keeps them, and a switch says so (1.12)', () => {
  let f = tdb({ lives: 3, switching: 'both' });
  f = F.adjust(f, { op: 'lives', id: 't1-1', n: 5 });
  f = F.apply(f, 1);                                     // switching opens
  f = F.swap(f, 2, 1);
  const ev = f.events.find(e => e.type === 'switch');
  assert.equal(ev.to, 'B2'); assert.equal(ev.lives, 5); assert.equal(ev.max, 5);
});

test('Team Death Battle: a lock-in can be undone until the next set is recorded (1.12.13)', () => {
  let f = tdb({ lives: 2 });
  assert.equal(F.canUnlock(f), false);                      // the window is open: nothing to undo
  f = F.lockSwitch(f); assert.equal(f.switchOpen, false); assert.equal(F.canUnlock(f), true); assert.equal(F.view(f).canUnlock, true);
  f = F.unlockSwitch(f); assert.equal(f.switchOpen, true); assert.equal(f.events.at(-1).type === 'unlocked' || f.events.some(e => e.type === 'unlocked'), true);
  assert.equal(f.heldOpen, true);                           // (the server doesn't lock it again by itself straight away)
  f = F.swap(f, 1, 1); f = F.lockSwitch(f); assert.equal(f.heldOpen, undefined);
  f = F.apply(f, 1, [2, 0]);                                // a set recorded: too late to undo that lock-in
  assert.equal(F.canUnlock(f), false);
  assert.throws(() => F.unlockSwitch(f));
});
