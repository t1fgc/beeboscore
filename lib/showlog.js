'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the show log: a timeline of everything that went on stream.
 *
 * Every entry is { id, at, kind, text, by } (by: who did it — a team member's name, '' for this PC; 1.12.19) plus, for the last few hundred, the scoreboard as it was just before (`before`),
 * so "Undo to here" can put everything back the way it was before that moment. The text of each day's log is also written
 * to data/showlog/<day>.jsonl (no snapshots on disk). Export: plain text or CSV, with the stream time of each entry when
 * the stream start is known (VOD chapters).
 *
 * diff(prev, next) works out what changed on screen between two scoreboards — the part of the log that needs no help.
 */
const fs = require('fs');
const path = require('path');

const KEEP = 600, SNAPS = 250;
const nm = p => String((p && p.name) || '').trim();
const SPLASH = { bracket: 'Bracket splash', top8: 'Top 8 splash', standings: 'Standings splash', fvs: 'Format VS', fboard: 'Format board', fwin: 'Format winner', flead: 'King of the Hill leaders', vtjoin: 'Viewer tournament join screen', comm: 'Commentary screen' };
const FULL = { countdown: 'Countdown', schedule: 'Coming up', walkin: 'Walk-in', evstats: 'Event in numbers', season: 'Season table', greset: 'Bracket reset splash' };
const CARD = { storyline: 'Storyline card', pred: 'Prediction bar', poll: 'Poll' };

function diff(a, b) {
  const out = [], on = (x, y, t) => { if (!x && y) out.push(['on', t + ' on']); else if (x && !y) out.push(['off', t + ' off']); };
  if (!a || !b) return out;
  const n1 = nm(b.p1), n2 = nm(b.p2);
  if (n1 && n2 && (n1.toLowerCase() !== nm(a.p1).toLowerCase() || n2.toLowerCase() !== nm(a.p2).toLowerCase())) out.push(['match', `New match: ${n1} vs ${n2}${b.round ? ' · ' + b.round : ''}`]);
  else {
    const s1 = Number(b.p1 && b.p1.score) || 0, s2 = Number(b.p2 && b.p2.score) || 0, o1 = Number(a.p1 && a.p1.score) || 0, o2 = Number(a.p2 && a.p2.score) || 0;
    if (s1 !== o1 || s2 !== o2) out.push(['score', `Score ${n1 || 'P1'} ${s1}–${s2} ${n2 || 'P2'}`]);
  }
  if (String(b.round || '') !== String(a.round || '') && b.round && !out.some(x => x[0] === 'match')) out.push(['round', `Round: ${b.round}`]);
  on(a.vs && a.vs.show, b.vs && b.vs.show, 'VS splash');
  on(a.playerVs && a.playerVs.show, b.playerVs && b.playerVs.show, 'GlassVS');
  on(a.victory && a.victory.show, b.victory && b.victory.show, 'Victory splash');
  const sa = (a.splash && a.splash.show) || '', sb = (b.splash && b.splash.show) || '';
  if (sa !== sb) { if (sb) out.push(['on', (SPLASH[sb] || sb) + ' on']); else out.push(['off', (SPLASH[sa] || sa) + ' off']); }
  if ((a.screen || '') !== (b.screen || '')) out.push(b.screen ? ['on', `Screen “${b.screen}” on`] : ['off', `Screen “${a.screen}” off`]);
  on(a.stats && a.stats.show, b.stats && b.stats.show, 'Stats card');
  on(a.h2h && a.h2h.show, b.h2h && b.h2h.show, 'Head-to-head line');                               // 1.12.21
  if (a.timer && a.timer.show && !(b.timer && b.timer.show)) out.push(['off', 'Set timer off']);
  const fa = (a.full && a.full.show) || '', fb = (b.full && b.full.show) || '';
  if (fa !== fb) out.push(fb ? ['on', (FULL[fb] || fb) + ' on'] : ['off', (FULL[fa] || fa) + ' off']);
  const ca = (a.card && a.card.show) || '', cb = (b.card && b.card.show) || '';
  if (ca !== cb) out.push(cb ? ['on', (CARD[cb] || cb) + ' on'] : ['off', (CARD[ca] || ca) + ' off']);
  return out;
}

function createShowLog({ dir, startOf = () => 0, log = () => {} }) {
  let rows = [], seq = 0;
  const day = t => new Date(t).toISOString().slice(0, 10);
  function file(t) { return path.join(dir, day(t) + '.jsonl'); }
  // today's entries come back after a restart (without their snapshots)
  try { const f = file(Date.now()); if (fs.existsSync(f)) rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-KEEP); seq = rows.reduce((m, r) => Math.max(m, r.id || 0), 0); } catch {}
  function add(kind, text, before, by) {
    const r = { id: ++seq, at: Date.now(), kind: String(kind).slice(0, 20), text: String(text || '').slice(0, 200) };
    const who = String(by || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40); if (who) r.by = who;
    if (!r.text) return null;
    const last = rows[rows.length - 1];
    if (last && last.text === r.text && r.at - last.at < 1500) return last;                   // a double press
    try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(file(r.at), JSON.stringify(r) + '\n'); } catch (e) { log('show log: ' + e.message); }
    if (before) r.before = before;
    rows.push(r); if (rows.length > KEEP) rows.shift();
    for (let i = 0, n = rows.length - SNAPS; i < n; i++) delete rows[i].before;
    return r;
  }
  const stamp = t => { const s = startOf(); if (!s || t < s) return ''; const x = Math.round((t - s) / 1000), h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, q = x % 60; return `${h}:${String(m).padStart(2, '0')}:${String(q).padStart(2, '0')}`; };
  const clock = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
  function view(limit = 200) { return { list: rows.slice(-limit).reverse().map(r => ({ id: r.id, at: r.at, kind: r.kind, text: r.text, by: r.by || '', undo: !!r.before, stream: stamp(r.at) })), total: rows.length, streamStart: startOf() }; }
  function get(id) { return rows.find(r => r.id === Number(id)) || null; }
  function exportText(fmt = 'txt') {
    if (fmt === 'csv') { const q = s => `"${String(s).replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""')}"`; return ['Time,Stream time,What,Kind,Who', ...rows.map(r => [clock(r.at), stamp(r.at), q(r.text), r.kind, q(r.by || '')].join(','))].join('\r\n') + '\r\n'; }
    return rows.map(r => `${stamp(r.at) || clock(r.at)}  ${r.text}${r.by ? `  (${r.by})` : ''}`).join('\n') + '\n';
  }
  function clear() { rows = []; }
  return { add, view, get, exportText, clear, get size() { return rows.length; } };
}

module.exports = { createShowLog, diff };
