// 1.5.4: Obsidian Glass for every game — built from Classic (tools/make-obsidian.js), so it sits exactly where Classic does
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const OV = new URL('../../overlays/', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, OV), 'utf8'));
for (const g of ['tekken8', 'sf6', 'avatar', 'fatalfury']) {
  test(`Obsidian Glass for ${g}: same pieces in the same places as Classic, in its own look`, () => {
    const c = read(`${g}-default/design.json`), o = read(`${g}-obsidian/design.json`), meta = read(`${g}-obsidian/overlay.json`);
    assert.equal(o.look, 'shattered'); assert.equal(meta.family, 'Obsidian Glass'); assert.equal(meta.game, c.game);
    assert.deepEqual(Object.keys(o.scenes), Object.keys(c.scenes));
    for (const sn of Object.keys(c.scenes)) {
      const box = e => [e.id, e.x, e.y, e.w, e.h, e.shape];
      assert.deepEqual(o.scenes[sn].elements.map(box), c.scenes[sn].elements.map(box), sn);
    }
    assert.ok(o.scenes.board.elements.filter(e => e.kind === 'bar').every(e => e.dyn && e.dyn.shatter));
    assert.ok(!/#ff3b5c|#3b8eff|#151822/i.test(JSON.stringify(o)), 'no Classic colours left');
    const html = fs.readFileSync(new URL(`${g}-obsidian/index.html`, OV), 'utf8');
    assert.match(html, /<meta name="sb-look" content="shattered">/);
    assert.equal(JSON.parse(html.match(/<script id="sb-design" type="application\/json">([\s\S]*?)<\/script>/)[1]).title, 'Obsidian Glass');
  });
}
test('Tekken 8 Obsidian Glass has every game-format version, like Classic', () => {
  for (const f of fs.readdirSync(OV).filter(n => n.startsWith('tekken8-default-'))) {
    const v = read(`${f.replace('-default-', '-obsidian-')}/overlay.json`);
    assert.equal(v.base, 'tekken8-obsidian'); assert.equal(v.format, read(`${f}/overlay.json`).format);
  }
});
