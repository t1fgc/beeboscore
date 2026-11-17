// 1.12.23 — the tale of a set (lib/tale.js): the stats strip and where the set sends each player
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { tale, today, nextOf, ord } = require('../../lib/tale.js');

const P = (name, seed) => ({ name, seed });
const card = (id, round, a, b, parent = '', done = false) => ({ id, round, a: P(...a), b: P(...b), parent, done, state: done ? 'done' : 'wait' });
// a small double-elimination bracket: winners (3 rounds), losers (4 rounds), the grand final
const DE = {
  type: 'DE',
  winners: [
    { name: 'Winners Quarter-Final', sets: [card('w1', 'Winners Quarter-Final', ['CrimsonByte', 1], ['PixelPaladin', 8], 'w5'), card('w2', 'Winners Quarter-Final', ['NeonGhoul', 4], ['VoidTaco', 5], 'w5')] },
    { name: 'Winners Semi-Final', sets: [card('w5', 'Winners Semi-Final', ['CrimsonByte', 1], ['NeonGhoul', 4], 'w7')] },
    { name: 'Winners Final', sets: [card('w7', 'Winners Final', ['CrimsonByte', 1], ['RamenRush', 2])] },
  ],
  losers: [
    { name: 'Losers Round 1', sets: [card('l1', 'Losers Round 1', ['IronMoth', 8], ['GlassJaw99', 7], 'l2')] },
    { name: 'Losers Quarter-Final', sets: [card('l2', 'Losers Quarter-Final', ['IronMoth', 8], ['TurboMoth', 6], 'l3')] },
    { name: 'Losers Semi-Final', sets: [card('l3', 'Losers Semi-Final', ['IronMoth', 8], ['ShadowKoi', 3], 'l4')] },
    { name: 'Losers Final', sets: [card('l4', 'Losers Final', ['IronMoth', 8], ['RamenRush', 2])] },
  ],
  gf: [card('g1', 'Grand Final', ['CrimsonByte', 1], ['IronMoth', 8]), card('g2', 'Grand Final Reset', ['CrimsonByte', 1], ['IronMoth', 8])],
};

test('ordinals', () => { assert.deepEqual([1, 2, 3, 4, 5, 7, 11, 12, 13, 21, 22, 33].map(ord), ['1st', '2nd', '3rd', '4th', '5th', '7th', '11th', '12th', '13th', '21st', '22nd', '33rd']); });

test('winners side: the winner advances to the round the set feeds, the loser drops to losers', () => {
  assert.deepEqual(nextOf(DE, 'CrimsonByte', 'PixelPaladin')[1], { win: 'Advances to Winners Semi-Final', lose: 'Drops to Losers' });
  assert.deepEqual(nextOf(DE, 'RamenRush', 'CrimsonByte')[2], { win: 'Advances to Grand Final', lose: 'Drops to Losers' });      // the winners final feeds the grand final (either way round)
});

test('losers side: places from the end of the bracket — 3rd, 4th, 5th, 7th', () => {
  assert.equal(nextOf(DE, 'IronMoth', 'RamenRush')[1].lose, 'Eliminated · 3rd place');
  assert.equal(nextOf(DE, 'IronMoth', 'ShadowKoi')[2].lose, 'Eliminated · 4th place');
  assert.equal(nextOf(DE, 'IronMoth', 'TurboMoth')[2].lose, 'Eliminated · 5th place');
  assert.equal(nextOf(DE, 'GlassJaw99', 'IronMoth')[1].lose, 'Eliminated · 7th place');
  assert.equal(nextOf(DE, 'IronMoth', 'GlassJaw99')[1].win, 'Advances to Losers Quarter-Final');
  assert.equal(nextOf(DE, 'RamenRush', 'IronMoth')[1].win, 'Advances to Grand Final');
});

test('grand final: the player from losers forces a reset, the one from winners is champion', () => {
  const g = nextOf(DE, 'CrimsonByte', 'IronMoth', false, true);
  assert.deepEqual(g[2], { win: 'Bracket reset', lose: '2nd place' });
  assert.deepEqual(g[1], { win: 'Champion', lose: 'Bracket reset' });
  // the reset set itself: champion either way
  const done = { ...DE, gf: [{ ...DE.gf[0], done: true, state: 'done' }, DE.gf[1]] };
  assert.deepEqual(nextOf(done, 'CrimsonByte', 'IronMoth', true, true)[1], { win: 'Champion', lose: '2nd place' });
});

test('single elimination: losing is going out, the final is champion or 2nd', () => {
  const SE = { type: 'SE', winners: [{ name: 'Quarter-Final', sets: [card('a', 'Quarter-Final', ['CrimsonByte', 1], ['IronMoth', 8], 'c')] }, { name: 'Semi-Final', sets: [card('c', 'Semi-Final', ['CrimsonByte', 1], ['NeonGhoul', 4], 'e')] }, { name: 'Final', sets: [card('e', 'Final', ['CrimsonByte', 1], ['RamenRush', 2])] }], losers: [], gf: [] };
  assert.deepEqual(nextOf(SE, 'CrimsonByte', 'IronMoth')[1], { win: 'Advances to Semi-Final', lose: 'Eliminated · 5th place' });
  assert.deepEqual(nextOf(SE, 'CrimsonByte', 'NeonGhoul')[1], { win: 'Advances to Final', lose: 'Eliminated · 3rd place' });
  assert.deepEqual(nextOf(SE, 'CrimsonByte', 'RamenRush')[1], { win: 'Champion', lose: 'Eliminated · 2nd place' });
});

test('a set not in the bracket: nothing to say', () => { assert.equal(nextOf(DE, 'PixelPaladin', 'BeanCounter'), null); assert.equal(nextOf(null, 'CrimsonByte', 'IronMoth'), null); });

test('the record today, from Player history', () => {
  const now = Date.now(), r = (a, b, w, at = now) => ({ at, p1: { name: a }, p2: { name: b }, winner: w });
  const rows = [r('CrimsonByte', 'IronMoth', 1, now - 30 * 3600e3), r('CrimsonByte', 'NeonGhoul', 1), r('VoidTaco', 'CrimsonByte', 1), r('crimsonbyte ', 'RamenRush', 1)];
  assert.equal(today(rows, 'CrimsonByte', now - 3600e3), '2–1');       // yesterday's set doesn't count; names match without caring about capitals
  assert.equal(today(rows, 'BeanCounter', now - 3600e3), '');
});

test('the tale: seeds, today, the head-to-head or a runback, where the set sends them, Victory’s banner', () => {
  const s = { p1: { name: 'CrimsonByte', loser: false }, p2: { name: 'PixelPaladin' }, winnerSide: 1 };
  const seeds = { crimsonbyte: 1, pixelpaladin: 8 };
  const t = tale(s, { rows: [], since: Date.now() - 1000, bracket: DE, seedOf: n => seeds[n.toLowerCase()], hist: { line: 'CrimsonByte leads 2–0 · last time CrimsonByte won 3–1' }, story: { end: { kind: 'sweep', title: 'Sweep', text: 'CrimsonByte wins 3–0 without dropping a game' } } });
  assert.equal(t.p1.line, 'Seed 1'); assert.equal(t.p2.line, 'Seed 8'); assert.equal(t.strip, true);
  assert.equal(t.mid, 'CrimsonByte leads 2–0 · last time CrimsonByte won 3–1');
  assert.equal(t.win, 'Advances to Winners Semi-Final'); assert.equal(t.lose, 'Drops to Losers');
  assert.deepEqual(t.badge, { kind: 'sweep', title: 'Flawless 3–0', text: 'CrimsonByte wins 3–0 without dropping a game' });
  const rb = tale({ p1: { name: 'CrimsonByte' }, p2: { name: 'NeonGhoul' } }, { hist: { line: 'First meeting' }, story: { runback: { text: 'NeonGhoul won 3–2 in Winners Semi-Final earlier today' } } });
  assert.equal(rb.mid, 'Runback — NeonGhoul won 3–2 in Winners Semi-Final earlier today'); assert.equal(rb.runback, true);
  assert.equal(tale({ p1: { name: 'CrimsonByte' }, p2: { name: 'NeonGhoul' } }, { hist: { line: 'First meeting' } }).mid, 'First meeting on stream');
  // the winner from the score and the set's length when the scoreboard has no mark of its own (the app's raw state)
  const w2 = tale({ p1: { name: 'CrimsonByte', score: 1 }, p2: { name: 'PixelPaladin', score: 3 }, bestOf: 5 }, { bracket: DE });
  assert.equal(w2.win, 'Advances to Winners Semi-Final'); assert.equal(w2.lose, 'Drops to Losers');
  assert.equal(tale({ p1: { name: 'CrimsonByte', score: 2 }, p2: { name: 'PixelPaladin', score: 1 }, bestOf: 5 }, { bracket: DE }).win, undefined);
  for (const [a, b] of [['Player 1', 'Player 2'], ['CrimsonByte', ''], ['CrimsonByte', 'crimsonbyte']]) assert.equal(tale({ p1: { name: a }, p2: { name: b } }), null);
});
