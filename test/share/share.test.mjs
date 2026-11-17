import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createShare, LINK_GRACE, IMAGE_KEEP } = require('../../lib/share.js');
const VT = require('../../lib/vtourney.js');
const BR = require('../../lib/bracket.js');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beebo-share-'));
  let saved = {}, clock = 1_000_000;
  const store = { get: () => saved, set: v => { saved = v; } };
  const sh = createShare({ root, store, now: () => clock });
  return { root, sh, tick: ms => { clock += ms; }, store: () => saved };
}

test('a tournament gets its own folder; the link token is random and checked exactly', () => {
  const { root, sh } = setup();
  sh.begin('vt:1', 'Friday Cup');
  assert.ok(fs.existsSync(root));
  assert.equal(sh.check('anything'), false);
  sh.setLive(true);
  const t = sh.token();
  assert.ok(t.length >= 30);
  assert.equal(sh.check(t), true);
  assert.equal(sh.check(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A')), false);
  assert.equal(sh.check(''), false);
  const f = sh.writeHtml('<html>');
  assert.equal(path.basename(f), 'Friday Cup bracket.html');
  sh.setLive(false);
  assert.equal(sh.check(t), false, 'the old link stops working at once');
  assert.ok(!fs.existsSync(f), 'and its page file is deleted');
  sh.setLive(true);
  assert.notEqual(sh.token(), t, 'turning it on again makes a new link');
});

test('file names are safe', () => {
  const { sh } = setup();
  sh.begin('x', '../../evil<name>:*?');
  sh.setLive(true);
  const f = sh.writeHtml('x');
  assert.ok(!path.basename(f).includes('/') && !/[<>:*?]/.test(path.basename(f)));
  assert.ok(f.startsWith(sh.folder()));
});

test('a new tournament replaces the old files', () => {
  const { sh } = setup();
  sh.begin('vt:1', 'One'); sh.setLive(true); sh.writeHtml('a'); const old = sh.folder();
  sh.writeImage(Buffer.from('png'), 'png');
  sh.begin('vt:2', 'Two');
  assert.ok(!fs.existsSync(old));
  assert.equal(sh.token(), '');
});

test('after the end: link closes after 15 min, pictures after 24 h', () => {
  const { sh, tick } = setup();
  sh.begin('sgg:9', 'Weekly'); sh.setLive(true); sh.writeHtml('a'); const img = sh.writeImage(Buffer.from('jpg'), 'jpg');
  sh.ended();
  tick(LINK_GRACE - 1000); sh.sweep();
  assert.equal(sh.status().on, true);
  tick(2000); sh.sweep();
  assert.equal(sh.status().on, false);
  assert.ok(fs.existsSync(img), 'pictures stay a while');
  assert.deepEqual(sh.status().files.map(f => f.name), ['Weekly Top 8.jpg']);
  tick(IMAGE_KEEP); sh.sweep();
  assert.ok(!fs.existsSync(img));
  assert.equal(sh.status().active, false);
});

test('startup sweep removes leftovers from other tournaments', () => {
  const { root, sh } = setup();
  fs.mkdirSync(path.join(root, 'Old Cup')); fs.writeFileSync(path.join(root, 'Old Cup', 'x.png'), 'x');
  sh.begin('vt:3', 'Now'); sh.sweep();
  assert.deepEqual(fs.readdirSync(root), ['Now']);
});

test('purge deletes everything', () => {
  const { sh } = setup();
  sh.begin('vt:1', 'Gone'); sh.setLive(true); sh.writeHtml('a'); const d = sh.folder();
  sh.purge('test');
  assert.ok(!fs.existsSync(d)); assert.equal(sh.key(), ''); assert.equal(sh.check('x'), false);
});

test('standings: single elimination placements', () => {
  const t = VT.create({ name: 'S' }); t.open = true;
  for (let i = 0; i < 12; i++) VT.join(t, { name: 'P' + i });
  VT.generate(t, () => 0.4);
  let g = 0; while (t.status === 'live' && g++ < 100) { const s = VT.ready(t)[0]; VT.report(t, s.id, 'a', 2, 0); }
  const m = BR.build(VT.toRaw(t), {});
  assert.equal(m.finished, true);
  assert.deepEqual(m.standings.slice(0, 8).map(s => s.place), [1, 2, 3, 3, 5, 5, 5, 5]);
  assert.equal(m.standings[0].name, VT.view(t).champion);
});

test('standings: double elimination placements from the losers bracket', () => {
  // 8-player double elimination, start.gg shaped: everyone loses to the higher seed
  const E = Array.from({ length: 8 }, (_, i) => ({ id: 'e' + (i + 1), seed: i + 1 }));
  let sid = 0; const sets = [];
  const mk = (round, text, a, b) => { const w = a.seed < b.seed ? a : b, l = w === a ? b : a; const s = { id: 's' + (++sid), identifier: 'A' + sid, round, roundText: text, state: 3, winnerId: w.id, slots: [{ entrantId: a.id, name: 'N' + a.seed, seed: a.seed, prereqType: 'seed' }, { entrantId: b.id, name: 'N' + b.seed, seed: b.seed, prereqType: 'seed' }] }; sets.push(s); return [w, l]; };
  const [w1, l1] = mk(1, 'W1', E[0], E[7]), [w2, l2] = mk(1, 'W1', E[3], E[4]), [w3, l3] = mk(1, 'W1', E[1], E[6]), [w4, l4] = mk(1, 'W1', E[2], E[5]);
  const [ws1, wsl1] = mk(2, 'WSF', w1, w2), [ws2, wsl2] = mk(2, 'WSF', w3, w4);
  const [wf, wfl] = mk(3, 'WF', ws1, ws2);
  const [lr1a] = mk(-1, 'L1', l1, l2), [lr1b] = mk(-1, 'L1', l3, l4);
  const [lr2a] = mk(-2, 'L2', lr1a, wsl1), [lr2b] = mk(-2, 'L2', lr1b, wsl2);
  const [lsf] = mk(-3, 'LSF', lr2a, lr2b);
  const [lf] = mk(-4, 'LF', lsf, wfl);
  mk(4, 'Grand Final', wf, lf);
  const m = BR.build({ type: 'DOUBLE_ELIMINATION', sets }, {});
  assert.equal(m.finished, true);
  assert.deepEqual(m.standings.map(s => s.place), [1, 2, 3, 4, 5, 5, 7, 7]);
  assert.deepEqual(m.standings.slice(0, 4).map(s => s.id), ['e1', 'e2', 'e3', 'e4']);
});
