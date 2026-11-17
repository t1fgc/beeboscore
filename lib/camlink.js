'use strict';
/*
 * BeeboScore (developed by Beebo) — the commentators' camera link (Testbuild 1.12.6).
 *
 * Each commentator gets a private link (/cam/<token>). They open it on the PC or phone with their webcam, allow the camera,
 * and press Go live. The picture travels straight to the commentary screen in OBS over WebRTC — encrypted end to end
 * (DTLS-SRTP), peer to peer, so nothing goes through anyone else's server and the delay stays as small as the network
 * allows. BeeboScore only passes the few messages that connect the two (the "signalling").
 *
 *   • a link is 256 bits of randomness; only its SHA-256 is used to look it up
 *   • links run out (1 hour to 7 days), can be taken back at any time (the camera drops at once), and work on one device at
 *     a time
 *   • only BeeboScore on this PC, a PC on the same network, or someone signed in to the app can receive the cameras —
 *     never a stranger who opens the overlay online
 *   • a few wrong links in a row from one address and that address waits a minute
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const HOURS = [1, 4, 12, 24, 72, 168];

function createCamLink({ dir, changed = () => {} }) {
  const FILE = path.join(dir, 'cam-links.json');
  let D = { links: [] };            // { id, slot, name, token, hash, created, expires }
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && Array.isArray(d.links)) D = d; } catch {}
  const save = () => { try { fs.mkdirSync(dir, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(D), { mode: 0o600 }); fs.renameSync(tmp, FILE); } catch (e) { console.error('cam links:', e.message); } };
  const live = l => l && l.expires > Date.now();
  const tidy = () => { const n = D.links.length; D.links = D.links.filter(live); if (D.links.length !== n) save(); };
  tidy();

  /** a new link for a commentator's slot (an old link for that slot stops working) */
  function create(slot, name, hours = 24) {
    slot = Math.max(1, Math.min(4, Math.round(Number(slot)) || 1));
    const h = HOURS.includes(Number(hours)) ? Number(hours) : 24, token = crypto.randomBytes(32).toString('base64url');
    D.links = D.links.filter(l => l.slot !== slot);
    const l = { id: crypto.randomBytes(8).toString('hex'), slot, name: String(name || `Commentator ${slot}`).slice(0, 40), token, hash: sha(token), created: Date.now(), expires: Date.now() + h * 3600e3 };
    D.links.push(l); save(); changed('create', l); return l;
  }
  function revoke(slot) { const l = D.links.find(x => x.slot === Number(slot)); D.links = D.links.filter(x => x.slot !== Number(slot)); save(); if (l) changed('revoke', l); return !!l; }
  function rename(slot, name) { const l = D.links.find(x => x.slot === Number(slot)); if (l) { l.name = String(name || l.name).slice(0, 40); save(); } }
  // wrong links: a few, then a minute's wait for that address
  const misses = new Map();
  function check(token, ip = '') {
    const m = misses.get(ip); if (m && m.n >= 8 && Date.now() - m.at < 60e3) return { wait: true };
    const l = typeof token === 'string' && token.length >= 40 && token.length <= 60 ? D.links.find(x => x.hash === sha(token)) : null;
    if (!l || !live(l)) { const x = misses.get(ip) || { n: 0, at: 0 }; if (Date.now() - x.at > 60e3) x.n = 0; x.n++; x.at = Date.now(); misses.set(ip, x); if (misses.size > 500) misses.clear(); return null; }
    misses.delete(ip); return l;
  }
  const bySlot = slot => D.links.find(x => x.slot === Number(slot) && live(x)) || null;
  const list = () => { tidy(); return D.links.map(l => ({ id: l.id, slot: l.slot, name: l.name, expires: l.expires, token: l.token })); };
  return { create, revoke, rename, check, bySlot, list, HOURS };
}
module.exports = { createCamLink };
