import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { gameDataFor, reportSet } = require('../../lib/startgg.js');
const { validUrl, createNotify } = require('../../lib/notify.js');

test('game data: one entry per game, the winner takes the last one', () => {
  const g = gameDataFor('W', 'L', 3, 2);
  assert.equal(g.length, 5);
  assert.deepEqual(g.map(x => x.gameNum), [1, 2, 3, 4, 5]);
  assert.equal(g[4].winnerId, 'W');
  assert.equal(g.filter(x => x.winnerId === 'W').length, 3);
  assert.deepEqual(gameDataFor('W', 'L', 2, 0).map(x => x.winnerId), ['W', 'W']);
  assert.deepEqual(gameDataFor('W', 'L', 0, 0), []);
});
test('preview sets are never reported', async () => {
  await assert.rejects(reportSet('tok', 'preview_123_1', { winnerId: '1' }), /real start.gg set/);
});
test('Discord webhook links only', () => {
  assert.ok(validUrl('https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123'));
  assert.ok(validUrl('https://ptb.discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123'));
  assert.equal(validUrl('https://discord.com.evil.io/api/webhooks/1234567/abcdefghijklmnopqrstuvwxyz'), '');
  assert.equal(validUrl('http://discord.com/api/webhooks/123456789012/abcdefghijklmnopqrstuvwxyz'), '');
  assert.equal(validUrl('http://127.0.0.1:6680/api/webhooks/1/abcd'), '', 'local only in the test suites');
});
test('notify: sealed link, switched-off kinds skipped, the link never in the status', () => {
  let saved = {};
  const vault = { seal: o => 'sealed:' + Buffer.from(JSON.stringify(o)).toString('base64'), open: s => JSON.parse(Buffer.from(s.slice(7), 'base64').toString()) };
  const n = createNotify({ store: { get: () => saved, set: v => { saved = v; } }, vault });
  assert.throws(() => n.setUrl('https://example.com/x'), /Discord webhook/);
  const url = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123';
  const st = n.setUrl(url);
  assert.ok(st.discord); assert.ok(!JSON.stringify(st).includes('abcdefghij')); assert.ok(!JSON.stringify(saved).includes('abcdefghij'));
  assert.equal(n.status().on.result, false);
  n.setOn({ result: true, nonsense: true });
  assert.equal(n.status().on.result, true); assert.ok(!('nonsense' in n.status().on));
  n.setUrl('');
  assert.equal(n.send('result', 'x'), false, 'nothing to send to');
});
