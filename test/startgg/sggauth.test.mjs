import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createVault, createAuth } = require('../../lib/sggauth.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sgg-'));

test('vault: sealed, readable back, tamper-proof, bound to its key', () => {
  const dir = tmp(), v = createVault({ dir });
  const s = v.seal({ access: 'secret-token' });
  assert.ok(s.startsWith('gcm:') && !s.includes('secret-token'));
  assert.deepEqual(v.open(s), { access: 'secret-token' });
  const b = Buffer.from(s.slice(4), 'base64'); b[b.length - 1] ^= 1;
  assert.equal(v.open('gcm:' + b.toString('base64')), null);                // changed on disk → refused
  assert.equal(createVault({ dir: tmp() }).open(s), null);                   // another PC's key → refused
  assert.equal((fs.statSync(path.join(dir, '.beebo-key')).mode & 0o777), 0o600);
});
test('vault: the OS protection is used when the app has it', () => {
  const secure = { available: () => true, encrypt: t => Buffer.from(t).toString('base64'), decrypt: b => Buffer.from(b, 'base64').toString() };
  const v = createVault({ dir: tmp(), secure }); const s = v.seal({ a: 1 });
  assert.ok(s.startsWith('os:')); assert.deepEqual(v.open(s), { a: 1 }); assert.equal(v.kind, 'os');
});
test('tokens refresh themselves near expiry, and a dead refresh signs you out', async () => {
  let saved = {}; const store = { get: () => saved, set: p => { saved = { ...saved, ...p }; } };
  const vault = createVault({ dir: tmp() });
  const auth = createAuth({ store, vault, builtIn: { clientId: '1', clientSecret: 's' } });
  store.set({ sealed: vault.seal({ access: 'old', refresh: 'r', exp: Date.now() + 60_000 }), user: { name: 'X' } });
  const calls = []; globalThis.fetch = async (url, o) => { calls.push([url, JSON.parse(o.body)]); return { ok: true, status: 200, json: async () => ({ access_token: 'new', refresh_token: 'r2', expires_in: 604800 }) }; };
  assert.equal(await auth.token(), 'new');
  assert.match(calls[0][0], /oauth\/refresh/); assert.equal(calls[0][1].grant_type, 'refresh_token'); assert.equal(calls[0][1].refresh_token, 'r');
  assert.equal(await auth.token(), 'new'); assert.equal(calls.length, 1);      // fresh now: no second refresh
  assert.ok(!JSON.stringify(saved).includes('new'));                           // still sealed
  // expired and the refresh is refused → signed out
  store.set({ sealed: vault.seal({ access: 'x', refresh: 'bad', exp: Date.now() - 1000 }) });
  const a2 = createAuth({ store, vault, builtIn: { clientId: '1', clientSecret: 's' } });
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
  await assert.rejects(a2.token(), /sign in again/);
  assert.equal(a2.signedIn(), false);
});
