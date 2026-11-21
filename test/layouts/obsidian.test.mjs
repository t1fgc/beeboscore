// Obsidian Glass for every game. 1.5.9: a new design (black obsidian glass and antique gold, cracks that spread and mend,
// a shattering loser), no longer built from Classic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const OV = new URL('../../overlays/', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, OV), 'utf8'));
for (const g of ['tekken8', 'sf6', 'avatar', 'fatalfury']) {
  test(`Obsidian Glass for ${g}: its own look, every screen, pictures in its own folder`, () => {
    const c = read(`${g}-default/design.json`), o = read(`${g}-obsidian/design.json`), meta = read(`${g}-obsidian/overlay.json`);
    assert.equal(o.look, 'shattered'); assert.equal(meta.family, 'Obsidian Glass'); assert.equal(meta.title, 'Obsidian Glass'); assert.equal(meta.game, c.game);
    assert.deepEqual(Object.keys(o.scenes), Object.keys(c.scenes), 'the same screens as Classic');
    assert.equal(o.gfx.preset, 'shattered', 'the glass sheen and its effects');
    assert.equal(o.sound.on, false); assert.equal(o.sound.pack, 'none', 'no sound in this build');
    const bars = o.scenes.board.elements.filter(e => e.kind === 'bar');
    assert.deepEqual(bars.map(e => e.side), [1, 2]); assert.ok(bars[1].flip, "Player 2's bar mirrors Player 1's");
    assert.ok(bars.every(e => e.dyn && e.dyn.shatter), 'plates that crack and shatter');
    if (g === 'tekken8') assert.ok(o.scenes.board.elements.filter(e => e.kind === 'pips').every(e => e.pip === 'diamond'), 'Tekken 8: diamond set pips');
    const text = JSON.stringify(o);
    assert.ok(!/-shattered\//.test(text), 'nothing points at another folder');
    for (const [, f] of text.matchAll(new RegExp(`/o/${g}-obsidian/assets/([^"\\\\)]+)`, 'g'))) assert.ok(fs.existsSync(new URL(`${g}-obsidian/assets/${f}`, OV)), f);
    const html = fs.readFileSync(new URL(`${g}-obsidian/index.html`, OV), 'utf8');
    assert.match(html, /<meta name="sb-look" content="shattered">/);
    assert.deepEqual(JSON.parse(html.match(/<script id="sb-design" type="application\/json">([\s\S]*?)<\/script>/)[1]), o, 'the page draws design.json');
  });
}
test('Tekken 8 Obsidian Glass has every game-format version, like Classic', () => {
  for (const f of fs.readdirSync(OV).filter(n => n.startsWith('tekken8-default-'))) {
    const v = read(`${f.replace('-default-', '-obsidian-')}/overlay.json`);
    assert.equal(v.base, 'tekken8-obsidian'); assert.equal(v.format, read(`${f}/overlay.json`).format);
    assert.deepEqual(v.colors, read('tekken8-obsidian/overlay.json').colors);
  }
});
// 1.5.11: the bars' cut-outs for Tekken 8's round counters sat a little high and left of the game's own counters on Player 2's
// side (a mirror image of Player 1's, though the game's aren't), so a corner of each counter was covered. Each side's are now
// where the game draws them, a hair larger than the counter's rim.
test('Tekken 8 Obsidian Glass: the round counters show through whole on both sides', () => {
  const o = read('tekken8-obsidian/design.json');
  const want = { 1: [737, 770, 804.5], 2: [1112.5, 1146.6, 1180.6] };       // the counters' centres in the game, in px
  const bars = o.scenes.board.elements.filter(e => e.kind === 'bar');
  assert.deepEqual(bars.map(b => b.side), [1, 2]);
  for (const b of bars) {
    assert.equal(b.holes.length, 3, `Player ${b.side}: three counters`);
    const xs = b.holes.map(([x]) => b.x + (b.flip ? 1 - x : x) * b.w).sort((p, q) => p - q);
    want[b.side].forEach((w, i) => assert.ok(Math.abs(xs[i] - w) <= .5, `Player ${b.side} counter ${i + 1}: ${xs[i].toFixed(1)}px, the game's is at ${w}px`));
    for (const [, y, r] of b.holes) { assert.ok(Math.abs(b.y + y * b.h - 54) <= .5, 'level with the counters (54px down)'); assert.ok(r >= 14.5, 'wider than the counter’s rim'); }
  }
});
