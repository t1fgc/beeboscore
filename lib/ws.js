'use strict';
/*
 * Tiny dependency-free WebSocket server (RFC 6455) — just enough for one-way
 * broadcasts with keep-alive. Used instead of Server-Sent Events because
 * Cloudflare quick tunnels don't pass SSE through.
 */
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encode(text, opcode = 0x1) {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

class Hub {
  constructor() {
    this.clients = new Set();
    this.timer = setInterval(() => this.ping(), 20000);
    this.timer.unref && this.timer.unref();
  }

  // Call from server.on('upgrade'). onOpen(send) lets the caller push initial messages.
  handleUpgrade(req, socket, onOpen) {
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    const client = { socket, alive: true, buf: Buffer.alloc(0), meta: {} };
    this.clients.add(client);
    const drop = () => { if (this.clients.delete(client) && this.onClose) this.onClose(client); socket.destroy(); };
    socket.on('close', drop);
    socket.on('end', drop);          // the other side hung up (HTTP upgrade sockets stay half-open otherwise)
    socket.on('error', drop);
    socket.on('data', chunk => this.read(client, chunk));
    if (onOpen) onOpen(msg => this.sendTo(client, msg), client);
    return client;
  }

  // Parse incoming frames: close/ping/pong, plus small text messages (overlay latency reports).
  read(client, chunk) {
    client.buf = Buffer.concat([client.buf, chunk]);
    while (client.buf.length >= 2) {
      const b = client.buf;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 127 || (len === 126 && b.length >= 4 && b.readUInt16BE(2) > 8192)) { this.clients.delete(client); client.socket.destroy(); return; } // nothing legit is that big
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (b.length < off + len) return;
      let payload = b.subarray(off, off + len);
      if (masked) {
        const mask = b.subarray(maskOff, maskOff + 4);
        payload = Buffer.from(payload.map((x, i) => x ^ mask[i % 4]));
      }
      client.buf = b.subarray(off + len);
      client.alive = true;
      if (opcode === 0x8) { try { client.socket.end(encode('', 0x8)); } catch {} if (this.clients.delete(client) && this.onClose) this.onClose(client); return; }
      if (opcode === 0x1 && (b[0] & 0x80) && this.onText) { try { this.onText(client, payload.toString()); } catch {} }
      if (opcode === 0x9) { try { client.socket.write(encode(payload.toString(), 0xA)); } catch {} }
    }
  }

  sendTo(client, msg) {
    try { client.socket.write(encode(typeof msg === 'string' ? msg : JSON.stringify(msg))); } catch {}
  }

  broadcast(type, data, extra) {
    const frame = encode(JSON.stringify(extra ? { type, data, ...extra } : { type, data }));
    for (const c of this.clients) { try { c.socket.write(frame); } catch {} }
  }

  // Only to clients that pass the filter (e.g. signed-in control panels).
  broadcastWhere(pred, type, data) {
    let frame = null;
    for (const c of this.clients) if (pred(c)) { frame = frame || encode(JSON.stringify({ type, data })); try { c.socket.write(frame); } catch {} }
  }

  ping() {
    for (const c of this.clients) {
      if (!c.alive) { this.clients.delete(c); c.socket.destroy(); if (this.onClose) this.onClose(c); continue; }
      c.alive = false;
      try { c.socket.write(encode('', 0x9)); } catch {}
    }
  }

  get size() { return this.clients.size; }
}

module.exports = { Hub, encode };
