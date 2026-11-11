'use strict';
/*
 * "Go online" — exposes the local app on a public https URL with a Cloudflare
 * Quick Tunnel (no account needed). Downloads cloudflared on first use.
 * Quick tunnels get a new random *.trycloudflare.com address every time and have
 * no uptime guarantee — for a permanent address, host the app (see CLOUD-HOSTING.md).
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';
const ASSETS = {
  'win32-x64': 'cloudflared-windows-amd64.exe',
  'win32-arm64': 'cloudflared-windows-amd64.exe',
  'win32-ia32': 'cloudflared-windows-386.exe',
  'darwin-x64': 'cloudflared-darwin-amd64.tgz',
  'darwin-arm64': 'cloudflared-darwin-arm64.tgz',
  'linux-x64': 'cloudflared-linux-amd64',
  'linux-arm64': 'cloudflared-linux-arm64',
  'linux-arm': 'cloudflared-linux-arm',
};

class Tunnel {
  constructor(binDir, onChange) {
    this.binDir = binDir;
    this.onChange = onChange || (() => {});
    this.proc = null;
    this.status = { state: 'off', url: '', message: '' };
    process.on('exit', () => this.stop());
  }

  set(patch) { this.status = { ...this.status, ...patch }; this.onChange(this.status); }

  binPath() {
    return path.join(this.binDir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  }

  async ensureBinary() {
    // use one already installed on the system if available
    try {
      execFileSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { stdio: 'ignore' });
      return 'cloudflared';
    } catch {}
    const bin = this.binPath();
    if (fs.existsSync(bin)) return bin;
    const asset = ASSETS[`${process.platform}-${process.arch}`];
    if (!asset) throw new Error(`Going online isn't supported on ${process.platform}-${process.arch}.`);
    this.set({ state: 'downloading', message: 'Downloading the Cloudflare tunnel tool (one time, ~40 MB)…' });
    fs.mkdirSync(this.binDir, { recursive: true });
    const res = await fetch(BASE + asset);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (asset.endsWith('.tgz')) {
      const tgz = path.join(this.binDir, asset);
      fs.writeFileSync(tgz, buf);
      execFileSync('tar', ['-xzf', tgz, '-C', this.binDir]);
      fs.unlinkSync(tgz);
    } else {
      fs.writeFileSync(bin, buf);
    }
    if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
    return bin;
  }

  /**
   * named: { token, host } — your own Cloudflare tunnel with a permanent address (set its public hostname to
   * http://localhost:<port> in the Cloudflare dashboard). Without it: a quick tunnel with a new random address.
   */
  async start(port, named = null) {
    if (this.proc) return this.status;
    try {
      const bin = await this.ensureBinary();
      this.set({ state: 'starting', url: '', message: 'Connecting to Cloudflare…', named: !!named });
      const args = named && named.token ? ['tunnel', '--no-autoupdate', 'run', '--token', named.token] : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`];
      const proc = spawn(bin, args, { windowsHide: true });
      this.proc = proc;
      const timer = setTimeout(() => {
        if (this.status.state === 'starting') { this.set({ state: 'error', message: 'Timed out waiting for Cloudflare. Check your internet connection and try again.' }); this.stop(true); }
      }, 45000);
      const onData = d => {
        const txt = String(d);
        if (named && named.token) {
          if (/Registered tunnel connection|Connection [a-f0-9-]+ registered/i.test(txt) && this.status.state !== 'online') { clearTimeout(timer); this.set({ state: 'online', url: `https://${named.host}`, message: '', named: true }); }
          if (/Unauthorized|invalid token|failed to unmarshal/i.test(txt)) { clearTimeout(timer); this.set({ state: 'error', url: '', message: 'Cloudflare refused the tunnel token — copy it again from the Cloudflare dashboard.' }); this.stop(true); }
          return;
        }
        const m = txt.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (m && this.status.state !== 'online') { clearTimeout(timer); this.set({ state: 'online', url: m[0], message: '' }); }
      };
      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);
      proc.on('error', err => { clearTimeout(timer); this.proc = null; this.set({ state: 'error', url: '', message: err.message }); });
      proc.on('exit', code => {
        clearTimeout(timer);
        const wasStopping = this.stopping;
        this.proc = null; this.stopping = false;
        if (!wasStopping && this.status.state !== 'error') this.set({ state: 'error', url: '', message: `The tunnel closed unexpectedly (code ${code}). Try going online again.` });
        else if (wasStopping) this.set({ state: 'off', url: '', message: '' });
      });
    } catch (err) {
      this.proc = null;
      this.set({ state: 'error', url: '', message: err.message });
    }
    return this.status;
  }

  stop(keepError) {
    if (this.proc) { this.stopping = !keepError; try { this.proc.kill(); } catch {} }
    else if (!keepError) this.set({ state: 'off', url: '', message: '' });
  }
}

module.exports = { Tunnel };
