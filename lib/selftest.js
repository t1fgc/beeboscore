'use strict';
/*
 * Self-test (Settings › Updates & about › Run self-test): the checks only a real PC can answer — saving files,
 * encrypted sign-ins, the hidden picture window (standings pictures, potato mode), OBS, going online, start.gg, Twitch.
 * Read-only: nothing is changed, and nothing leaves the PC except a sign-in check with start.gg when signed in.
 */
const fs = require('fs');
const path = require('path');

async function run(ctx) {
  const { APP_VERSION, opts, DATA_DIR, BACKUP_DIR, sggVault, actualPort, potato, potatoRender, latency, tunnel, sggHas, sggTok, startgg, chat, config } = ctx;
  const t0 = Date.now(), out = [];
  const test = async (id, label, fn) => { const s = Date.now(); try { const r = await fn(); out.push({ id, label, ok: r.ok !== false, warn: !!r.warn, detail: r.detail || '', ms: Date.now() - s, img: r.img || '' }); } catch (e) { out.push({ id, label, ok: false, detail: e.message, ms: Date.now() - s }); } };
  await test('version', 'BeeboScore', async () => ({ detail: `${APP_VERSION}${opts.desktop ? ' · desktop app' : ' · server only'}${opts.testBuild ? ' · Beta' : ''} · ${process.platform} ${process.arch} · Node ${process.versions.node}${process.versions.electron ? ' · Electron ' + process.versions.electron : ''}` }));
  await test('write', 'Saving files (data, backups, exported files)', async () => {
    for (const d of [DATA_DIR, BACKUP_DIR, path.join(DATA_DIR, 'exports')]) { fs.mkdirSync(d, { recursive: true }); const f = path.join(d, '.selftest'); fs.writeFileSync(f, 'ok'); fs.rmSync(f); }
    return { detail: DATA_DIR };
  });
  await test('paths', 'Unusual folder and file names', async () => {
    // accented letters, spaces and long names (a Windows user called José, a tournament with emoji…)
    const d = path.join(DATA_DIR, 'exports', '.selftest Ñandú — 東京'), f = path.join(d, 'Weekly #42 Top 8 ✓.txt');
    fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(f, 'ok');
    const back = fs.readFileSync(f, 'utf8'); fs.rmSync(d, { recursive: true, force: true });
    if (back !== 'ok') throw new Error('Reading back a file with accented letters failed.');
    const od = /onedrive/i.test(DATA_DIR);
    return { warn: od, detail: od ? 'Your data folder is inside OneDrive. That works, but if OneDrive keeps files “online-only” or syncs while you stream, saving can be slow. In OneDrive, choose “Always keep on this device” for the BeeboScore folder.' : 'OK' };
  });
  await test('network', 'Phones and other PCs on your network', async () => {
    const os = require('os'), lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    if (!lan.length) return { ok: true, warn: true, detail: 'This PC has no network address right now (no Wi-Fi / cable?). OBS on this PC still works.' };
    // can this PC reach its own network address? (a firewall that blocks it usually blocks phones too)
    const url = `http://${lan[0]}:${actualPort}/api/info`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) }).then(x => x.ok).catch(() => false);
    return { ok: true, warn: !r, detail: r ? `Reachable at http://${lan[0]}:${actualPort} — phones on the same Wi-Fi can open the panel` : `Couldn’t reach http://${lan[0]}:${actualPort} from this PC. If Windows asked about the firewall when BeeboScore first opened, allow it on Private networks (Windows Security › Firewall › Allow an app). Venue Wi-Fi often blocks devices from seeing each other — use Go online instead.` };
  });
  await test('secure', 'Encrypted sign-ins (start.gg, tunnel token)', async () => {
    const sealed = sggVault.seal({ t: 'selftest' }), back = sggVault.open(sealed);
    if (!back || back.t !== 'selftest') throw new Error('Encrypting and reading back failed.');
    return { warn: sggVault.kind !== 'os', detail: sggVault.kind === 'os' ? 'Protected by Windows (DPAPI) / macOS Keychain' : 'Protected with AES-256-GCM and a key file on this PC (the operating system’s protection isn’t available here)' };
  });
  await test('capture', 'Saving pictures (Top 8 standings)', async () => {
    if (!opts.capture) return { ok: false, detail: 'Needs the BeeboScore desktop app.' };
    const shot = await opts.capture(`http://127.0.0.1:${actualPort}/selftest/card`, { width: 1920, height: 1080 });
    if (!shot || !shot.png || shot.png.length < 2000) throw new Error('The picture came out empty.');
    const sq = await opts.capture(`http://127.0.0.1:${actualPort}/selftest/card`, { width: 1920, height: 1080, clip: { x: 420, y: 0, width: 1080, height: 1080 } });
    return { detail: `PNG ${Math.round(shot.png.length / 1024)} KB · JPG ${Math.round(shot.jpg.length / 1024)} KB · square ${sq && sq.png ? 'OK' : 'failed'}`, img: 'data:image/jpeg;base64,' + shot.jpg.toString('base64') };
  });
  await test('potato', 'Potato mode renderer', async () => ({ ok: !potato() || potatoRender(), warn: !potato(), detail: potato() ? (potatoRender() ? 'On — layouts are drawn as still pictures' : 'On, but the picture renderer isn’t running (restart the app)') : 'Off (only needed on very slow PCs). It uses the same hidden window as the picture test above.' }));
  await test('obs', 'OBS showing the overlay', async () => { const n = latency.list().filter(v => !v.gone && v.obs).length; return { ok: true, warn: !n, detail: n ? `${n} OBS browser source${n === 1 ? '' : 's'} connected` : 'No OBS browser source connected right now' }; });
  await test('tunnel', 'Going online (Cloudflare)', async () => { const b = tunnel.binPath(); const has = fs.existsSync(b); return { ok: true, warn: !has, detail: tunnel.status.state === 'online' ? `Online at ${tunnel.status.url}` : has ? 'Ready (cloudflared downloaded)' : 'cloudflared downloads the first time you go online' }; });
  await test('startgg', 'start.gg', async () => {
    if (!sggHas()) return { ok: true, warn: true, detail: 'Not signed in (optional)' };
    const me = await startgg.loadMe(sggTok()).catch(e => { throw new Error(e.message); });
    return { detail: me && me.name ? `Signed in as ${me.name}` : 'Connected' };
  });
  await test('twitch', 'Twitch chat', async () => { const live = chat.state === 'live'; return { ok: true, warn: !live, detail: live ? `Connected to #${config.twitch.channel}${chat.auth ? ' (can reply)' : ' (read-only)'}` : 'Not connected (optional)' }; });
  return { at: Date.now(), ms: Date.now() - t0, results: out };
}

module.exports = { run };
