'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — video jobs: the end-of-night recap video and vertical (9:16) clips.
 *
 * Both use FFmpeg: one already on this PC (FFMPEG_PATH, the app's own tools folder, or the system's), or a copy the app
 * downloads once into its tools folder when you ask it to (Windows: the FFmpeg-Builds release on GitHub, about 90 MB).
 *
 *   recap({ clips, cards, out })     title cards (PNG pictures the app draws: the event, the Top 8, the winner) and the
 *                                    night's highlight clips, each made 1920 × 1080 at 30 fps with stereo sound, then
 *                                    joined without encoding again
 *   vertical({ clip, top, bottom, out })   a clip reframed for Shorts / TikTok / Reels: 1080 × 1920, the game in the
 *                                    middle over a blurred copy of itself, the scoreboard strip above and the event below
 * One job at a time; progress goes to onProgress(text, fraction).
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const WIN_ZIP = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const VIDEO = /\.(mkv|mp4|mov|flv|ts|webm)$/i;

function createMedia({ binDir, log = () => {} }) {
  let busy = null, found = null;
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  function candidates() {
    const out = [];
    if (process.env.FFMPEG_PATH) out.push(process.env.FFMPEG_PATH);
    out.push(path.join(binDir, exe), path.join(binDir, 'ffmpeg', 'bin', exe));
    out.push(exe);                                    // on the PATH
    return out;
  }
  const works = p => new Promise(res => { try { execFile(p, ['-hide_banner', '-version'], { timeout: 8000, windowsHide: true }, (e, so) => res(!e && /ffmpeg version/i.test(String(so)))); } catch { res(false); } });
  let missAt = 0;          // 1.12.19: not found — looked for again after a minute (Settings › Health asks every few seconds)
  async function find(fresh) {
    if (found && (found === exe || fs.existsSync(found))) return found;
    if (!fresh && missAt && Date.now() - missAt < 60000) return '';
    for (const c of candidates()) if ((c === exe || fs.existsSync(c)) && await works(c)) { missAt = 0; return (found = c); }
    missAt = Date.now(); return '';
  }
  let ver = { f: '', v: '' };
  /** FFmpeg's version ("7.1", "N-118000-g…"), read once per copy found */
  async function version() { const f = await find(); if (!f) return ''; if (ver.f === f) return ver.v; const v = await new Promise(res => { try { execFile(f, ['-hide_banner', '-version'], { timeout: 8000, windowsHide: true }, (e, so) => { const m = /ffmpeg version (\S+)/i.exec(String(so || '')); res(m ? m[1].slice(0, 40) : ''); }); } catch { res(''); } }); ver = { f, v }; return v; }
  async function status() { const f = await find(); return { ready: !!f, where: f ? (f === exe ? 'system' : f.startsWith(binDir) ? 'app' : 'custom') : '', busy: busy ? busy.what : '', canDownload: process.platform === 'win32' }; }
  /** Windows: download FFmpeg once into the app's tools folder. 1.12.19: progress in MB (of how many), and cancel()
   *  stops it and leaves nothing half-written behind. `url` is for the tests. */
  let dl = null;
  async function download(onProgress = () => {}, { url = process.env.FFMPEG_URL || WIN_ZIP, force = false } = {}) {
    if (await find(true)) return status();
    if (process.platform !== 'win32' && !force) throw new Error('Install FFmpeg with your system’s package manager (it’s found by itself on the PATH).');
    if (busy) throw new Error('Busy with ' + busy.what + '.');
    busy = { what: 'downloading FFmpeg' };
    const zip = path.join(binDir, 'ffmpeg-download.zip'), dir = path.join(binDir, 'ffmpeg-unpack');
    const ac = new AbortController(); dl = { ac, zip, dir, cancelled: false };
    let ws = null;
    try {
      fs.mkdirSync(binDir, { recursive: true });
      const r = await fetch(url, { redirect: 'follow', signal: ac.signal });
      if (!r.ok || !r.body) throw new Error(`The download didn’t start (${r.status}).`);
      const total = Number(r.headers.get('content-length')) || 0; let got = 0, lastT = 0;
      ws = fs.createWriteStream(zip);
      const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0);
      for await (const chunk of r.body) {
        if (dl.cancelled) throw new Error('cancelled');
        got += chunk.length; if (!ws.write(chunk)) await new Promise(res => ws.once('drain', res));
        const now = Date.now(); if (now - lastT > 250) { lastT = now; onProgress(total ? `Downloading FFmpeg… ${mb(got)} of ${mb(total)} MB` : `Downloading FFmpeg… ${mb(got)} MB`, total ? got / total : 0, { got, total }); }
      }
      await new Promise((res, rej) => ws.end(e => (e ? rej(e) : res()))); ws = null;
      if (dl.cancelled) throw new Error('cancelled');
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      onProgress('Unpacking FFmpeg…', 1);
      await run('tar', ['-xf', zip, '-C', dir]);                     // Windows 10 and 11 have tar (it reads zip files)
      const hit = walk(dir).find(f => path.basename(f).toLowerCase() === 'ffmpeg.exe');
      if (!hit) throw new Error('FFmpeg wasn’t in the download.');
      fs.copyFileSync(hit, path.join(binDir, exe));
      fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
      found = null; missAt = 0; return status();
    } catch (e) {
      // whatever went wrong (or Cancel): nothing half-written stays behind
      const was = dl && dl.cancelled;
      try { if (ws) await new Promise(res => { ws.once('close', res); ws.destroy(); setTimeout(res, 1000); }); } catch {}
      try { fs.rmSync(zip, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      if (was || e.name === 'AbortError') throw new Error('Download cancelled.');
      throw e;
    } finally { busy = null; dl = null; }
  }
  /** stop a download that's going (true if there was one) */
  function cancelDownload() { if (!dl) return false; dl.cancelled = true; try { dl.ac.abort(); } catch {} return true; }
  function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f, out); else out.push(f); } return out; }
  function run(cmd, args, { onLine } = {}) {
    return new Promise((res, rej) => {
      const p = spawn(cmd, args, { windowsHide: true }); let err = '';
      p.stderr.on('data', d => { const s = String(d); err = (err + s).slice(-6000); if (onLine) onLine(s); });
      p.on('error', rej);
      p.on('close', c => (c === 0 ? res(err) : rej(new Error(lastLine(err) || `${path.basename(cmd)} stopped (${c})`))));
    });
  }
  const lastLine = s => String(s).trim().split(/\r?\n/).filter(l => !/^\s*(frame|size)=/.test(l)).pop() || '';
  async function hasAudio(ff, file) { const out = await new Promise(res => { const p = spawn(ff, ['-hide_banner', '-i', file], { windowsHide: true }); let e = ''; p.stderr.on('data', d => { e += d; }); p.on('close', () => res(e)); p.on('error', () => res('')); }); return /Stream #\d+:\d+.*Audio:/.test(out); }
  const V = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30'];
  const A = ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'];
  const tmpName = f => f.replace(/\.mp4$/, '') + '.part.mp4';      // written under a temporary name and renamed once FFmpeg finishes

  async function recap({ clips = [], cards = [], out, cardSecs = 4, onProgress = () => {} }) {
    const ff = await find(); if (!ff) throw new Error('Making videos needs FFmpeg — download it first (Settings › Video tools).');
    if (busy) throw new Error('Busy with ' + busy.what + '.');
    const items = [...cards.filter(c => c && c.png).map(c => ({ card: c })), ...clips.filter(f => VIDEO.test(f) && fs.existsSync(f)).map(f => ({ clip: f }))];
    // the opening cards first, the clips, then the closing cards (Top 8, the winner)
    const open = items.filter(x => x.card && x.card.at !== 'end'), close = items.filter(x => x.card && x.card.at === 'end'), mid = items.filter(x => x.clip);
    const seq = [...open, ...mid, ...close];
    if (!mid.length && seq.length < 2) throw new Error('There are no highlight clips for that day yet.');
    busy = { what: 'making the recap video' };
    const dir = out + '.work'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    try {
      const parts = [];
      for (let i = 0; i < seq.length; i++) {
        const x = seq[i], f = path.join(dir, `p${String(i).padStart(3, '0')}.mp4`), t = tmpName(f);
        onProgress(x.card ? `Title card ${i + 1} of ${seq.length}` : `Clip ${i + 1} of ${seq.length}`, i / seq.length);
        if (x.card) {
          const png = path.join(dir, `c${i}.png`); fs.writeFileSync(png, Buffer.from(String(x.card.png).replace(/^data:image\/png;base64,/, ''), 'base64'));
          const d = Math.max(2, Math.min(10, Number(x.card.secs) || cardSecs));
          await run(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', png, '-f', 'lavfi', '-t', String(d), '-i', 'anullsrc=r=48000:cl=stereo',
            '-vf', `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,loop=-1:1,trim=duration=${d},fade=t=in:d=0.4,fade=t=out:st=${(d - 0.4).toFixed(2)}:d=0.4`, '-t', String(d), ...V, ...A, '-shortest', t]);
        } else {
          const aud = await hasAudio(ff, x.clip);
          const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', x.clip];
          if (!aud) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
          args.push('-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p', '-map', '0:v:0', '-map', aud ? '0:a:0' : '1:a:0', ...V, ...A, '-shortest', t);
          await run(ff, args);
        }
        fs.renameSync(t, f); parts.push(f);
      }
      onProgress('Joining it all up…', .97);
      const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
      const t = tmpName(out); await run(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', t]);
      fs.renameSync(t, out);
      onProgress('Done', 1);
      return { file: out, parts: parts.length, clips: mid.length };
    } finally { busy = null; fs.rmSync(dir, { recursive: true, force: true }); }
  }

  async function vertical({ clip, top, bottom, out, onProgress = () => {} }) {
    const ff = await find(); if (!ff) throw new Error('Vertical clips need FFmpeg — download it first (Settings › Video tools).');
    if (!clip || !VIDEO.test(clip) || !fs.existsSync(clip)) throw new Error('That clip isn’t there.');
    if (busy) throw new Error('Busy with ' + busy.what + '.');
    busy = { what: 'making a vertical clip' };
    const dir = out + '.work'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    try {
      const pt = path.join(dir, 'top.png'), pb = path.join(dir, 'bottom.png');
      const put = (f, b64) => fs.writeFileSync(f, Buffer.from(String(b64 || '').replace(/^data:image\/png;base64,/, ''), 'base64'));
      put(pt, top); put(pb, bottom);
      const aud = await hasAudio(ff, clip);
      onProgress('Reframing for vertical…', .2);
      const fc = '[0:v]fps=30,split=2[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.12[bg];[b]scale=1080:-2[fg];'
        + '[bg][fg]overlay=0:(H-h)/2[m];[1:v]scale=1080:-2[t];[2:v]scale=1080:-2[u];[m][t]overlay=0:0[m2];[m2][u]overlay=0:H-h,format=yuv420p[v]';
      const t = tmpName(out);
      await run(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', clip, '-i', pt, '-i', pb, ...(aud ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
        '-filter_complex', fc, '-map', '[v]', '-map', aud ? '0:a:0' : '3:a:0', ...V, ...A, '-shortest', '-movflags', '+faststart', t]);
      fs.renameSync(t, out);
      onProgress('Done', 1);
      return { file: out };
    } finally { busy = null; fs.rmSync(dir, { recursive: true, force: true }); }
  }
  return { find, status, version, download, cancelDownload, recap, vertical, get busy() { return busy ? busy.what : ''; }, get downloading() { return !!dl; } };
}

module.exports = { createMedia, VIDEO };
