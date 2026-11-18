'use strict';
/*
 * BeeboScore (developed by Beebo) — a small .zip reader and writer for layouts.
 *
 * Reading: the files a creator zipped up (stored or deflated, the two kinds every zip tool makes). Encrypted and ZIP64
 * archives are refused with a plain message. Limits on the number of files and their unpacked size keep a broken or
 * hostile zip from filling the disk; paths are only returned, never written here (the caller puts them inside the
 * layout's folder).
 * Writing: a layout folder as a .zip to share, and the starter layout.
 */
const zlib = require('zlib');

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const zipError = msg => Object.assign(new Error(msg), { status: 400 });

/** Every file in a zip: [{ path, data }] (folders left out). */
function readZip(buf, { maxFiles = 2000, maxBytes = 250 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw zipError('That isn’t a .zip file.');
  // the end-of-central-directory record: the last 22 bytes, or further back if the zip has a comment
  let eocd = -1;
  for (let i = buf.length - 22, stop = Math.max(0, buf.length - 22 - 65535); i >= stop; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw zipError('That isn’t a .zip file (or it is damaged).');
  const count = buf.readUInt16LE(eocd + 10), cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw zipError('That zip is in the ZIP64 format. Zip the layout again with Windows (Send to › Compressed folder).');
  if (count > maxFiles) throw zipError(`That zip has ${count} files; a layout can have up to ${maxFiles}.`);
  const out = []; let p = cdOffset, total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw zipError('That zip is damaged.');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const raw = buf.subarray(p + 46, p + 46 + nlen);
    const name = (flags & 0x800 ? raw.toString('utf8') : raw.toString('latin1')).replace(/\\/g, '/');
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;                                  // a folder
    if (flags & 1) throw zipError('That zip is password-protected. Zip the layout again without a password.');
    if (method !== 0 && method !== 8) throw zipError(`“${name}” in that zip is packed in a way BeeboScore can’t open. Zip the layout again with Windows (Send to › Compressed folder).`);
    total += usize; if (total > maxBytes) throw zipError(`That zip unpacks to more than ${Math.round(maxBytes / 1048576)} MB.`);
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw zipError('That zip is damaged.');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const packed = buf.subarray(start, start + csize);
    let data;
    try { data = method === 0 ? Buffer.from(packed) : zlib.inflateRawSync(packed, { maxOutputLength: Math.max(usize, 1) }); }
    catch { throw zipError(`“${name}” in that zip is damaged.`); }
    if (data.length !== usize) throw zipError(`“${name}” in that zip is damaged.`);
    out.push({ path: name, data });
  }
  return out;
}

/** A .zip of [{ path, data }] (deflated, with the time it was made). */
function writeZip(files, when = new Date()) {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals = [], centrals = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(String(f.path).replace(/\\/g, '/').replace(/^\/+/, ''), 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data || ''), 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 }), useDeflate = packed.length < data.length;
    const body = useDeflate ? packed : data, crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, body); centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

module.exports = { readZip, writeZip, crc32 };
