// BeeboScore (developed by Beebo): Check for updates on the portable exe only takes BeeboScore's own exe (either name).
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

test('finds the newest BeeboScore exe under either name and ignores every other file', async () => {
  const list = [
    REL('v1.6.0', ['BeeboScore-Setup-1.6.0.exe', 'latest.yml', 'BeeboScore Testbuild 1.6.0.exe']),   // not the release exe: never taken
    REL('v1.5.4', ['BeeboScore-1.5.4.exe'], { draft: true }),                                         // a draft: not yet
    REL('v1.5.3', ['BeeboScore-1.5.3.exe', 'BeeboScore-Lite-1.5.3.exe']),
    REL('v1.5.0', ['BeeboScore-Lite-1.5.0.exe', 'BeeboScore-1.5.0.exe']),
  ];
  const st = await createPortableUpdater({ version: '1.5.0', dir: '', fetchImpl: fakeFetch(list) }).check();
  assert.equal(st.state, 'found');
  assert.equal(st.newVersion, '1.5.3');
  assert.equal(st.newFile || 'BeeboScore-1.5.3.exe', 'BeeboScore-1.5.3.exe');
});

test('says it is up to date when the newest exe is this version', async () => {
  const u = createPortableUpdater({ version: '1.5.2', dir: '', fetchImpl: fakeFetch([REL('v1.5.2', ['BeeboScore-1.5.2.exe', 'BeeboScore-Lite-1.5.2.exe'])]) });
  assert.equal((await u.check()).state, 'up-to-date');
});

test('a newer exe already in the folder is used without downloading (either name)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-upd-'));
  const buf = Buffer.alloc(1100000); buf.write('MZ', 0, 'latin1');
  fs.writeFileSync(path.join(dir, 'BeeboScore-Lite-1.5.3.exe'), buf);
  fs.writeFileSync(path.join(dir, 'BeeboScore-1.5.4.exe'), buf);
  fs.writeFileSync(path.join(dir, 'BeeboScore Testbuild 9.9.9.exe'), buf);                        // a Testbuild: ignored
  const st = await createPortableUpdater({ version: '1.5.2', dir, fetchImpl: fakeFetch([REL('v1.5.1', ['BeeboScore-Lite-1.5.1.exe'])]) }).check();
  assert.equal(st.state, 'ready'); assert.equal(st.newVersion, '1.5.4');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('1.4.0 (BeeboScore-x.y.z.exe) finds a new release by its one exe', () => {
  const OLD140 = /^BeeboScore-(\d+)\.(\d+)\.(\d+)\.exe$/i;
  assert.deepEqual(['BeeboScore-1.5.12.exe'].filter(n => OLD140.test(n)), ['BeeboScore-1.5.12.exe']);
});

test('the workflow attaches the one exe, BeeboScore-<version>.exe, to every release', () => {
  const y = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(y, /FILES=\("dist\/BeeboScore-\$VERSION\.exe"\)/);
  assert.doesNotMatch(y, /BeeboScore-Lite-/, 'no second copy under the old name');
  assert.match(y, /path: dist\/BeeboScore-\$\{\{ steps\.v\.outputs\.version \}\}\.exe/);
});
