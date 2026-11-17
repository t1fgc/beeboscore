// BeeboScore Lite (developed by Beebo): Check for updates on the portable exe only takes BeeboScore Lite's own files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPortableUpdater, newer } = require('../../lib/portable-update.js');

const REL = (tag, names, extra = {}) => ({ tag_name: tag, draft: false, prerelease: false, assets: names.map(n => ({ name: n, state: 'uploaded', size: 4, browser_download_url: `https://github.com/t1fgc/beeboscore/releases/download/${tag}/${n}` })), ...extra });
const fakeFetch = list => async url => {
  if (/\/releases\?/.test(url)) return { ok: true, status: 200, json: async () => list };
  throw new Error('not here');
};

test('newer() compares versions', () => {
  assert.equal(newer('1.5.0', '1.4.0'), true);
  assert.equal(newer('1.4.1', '1.5.0'), false);
  assert.equal(newer('1.5.0', '1.5.0'), false);
});

test('finds the newest BeeboScore-Lite exe and ignores every other file', async () => {
  const list = [
    REL('v1.6.0', ['BeeboScore-Setup-1.6.0.exe', 'latest.yml', 'BeeboScore-1.6.0.exe']),          // not Lite's: never taken
    REL('v1.5.2', ['BeeboScore-Lite-1.5.2.exe'], { draft: true }),                               // a draft: not yet
    REL('v1.5.1', ['BeeboScore-Lite-1.5.1.exe']),
    REL('v1.5.0', ['BeeboScore-Lite-1.5.0.exe', 'BeeboScore-1.5.0.exe']),
  ];
  const u = createPortableUpdater({ version: '1.5.0', dir: '', fetchImpl: fakeFetch(list) });
  const st = await u.check();
  assert.equal(st.state, 'found');
  assert.equal(st.newVersion, '1.5.1');
});

test('says it is up to date when the newest Lite exe is this version', async () => {
  const u = createPortableUpdater({ version: '1.5.0', dir: '', fetchImpl: fakeFetch([REL('v1.5.0', ['BeeboScore-Lite-1.5.0.exe', 'BeeboScore-1.5.0.exe'])]) });
  assert.equal((await u.check()).state, 'up-to-date');
});

test('a newer Lite exe already in the folder is used without downloading', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lite-upd-'));
  const f = path.join(dir, 'BeeboScore-Lite-1.5.3.exe'); const buf = Buffer.alloc(1100000); buf.write('MZ', 0, 'latin1'); fs.writeFileSync(f, buf);
  fs.writeFileSync(path.join(dir, 'BeeboScore-9.9.9.exe'), buf);                                     // not Lite's: ignored
  const u = createPortableUpdater({ version: '1.5.0', dir, fetchImpl: fakeFetch([REL('v1.5.1', ['BeeboScore-Lite-1.5.1.exe'])]) });
  const st = await u.check();
  assert.equal(st.state, 'ready'); assert.equal(st.newVersion, '1.5.3');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the 1.5.0 release is what BeeboScore 1.4.0 finds (its file pattern)', () => {
  const OLD = /^BeeboScore-(\d+)\.(\d+)\.(\d+)\.exe$/i;                 // lib/portable-update.js in 1.4.0
  const names = ['BeeboScore-Lite-1.5.0.exe', 'BeeboScore-1.5.0.exe'];
  assert.deepEqual(names.filter(n => OLD.test(n)), ['BeeboScore-1.5.0.exe']);
});

test('the workflow attaches both names to the 1.5.0 release', () => {
  const y = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(y, /OLD_NAME_FOR: '1\.5\.0'/);
  assert.match(y, /BeeboScore-Lite-\$VERSION\.exe/);
  assert.match(y, /cp "dist\/BeeboScore-Lite-\$VERSION\.exe" "dist\/BeeboScore-\$VERSION\.exe"/);
});
