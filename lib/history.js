'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.15 — player history.
 *
 * Every set that's won on the scoreboard is written down (data/history.jsonl, one line each): when, the event and round,
 * both players with their characters, the score and who won. From that:
 *   view(a, b)   what the overlays show for a matchup — the head-to-head ("CrimsonByte leads 3–1"), the last time they
 *                met, each player's record and their most-played characters
 *   list(q)      the History list in the app (newest first, searchable by name)
 *   player(n)    one player's sets, record and characters
 * Names match without caring about capitals or spaces at the ends. Nothing leaves this PC.
 */
const fs = require('fs');
const path = require('path');

const MAX = 20000;                 // lines kept in memory (the file keeps everything)
const key = n => String(n || '').trim().toLowerCase();

function createHistory(file) {
  let rows = [];
  try { rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-MAX); } catch {}
  let rev = rows.length;
  const memo = new Map();

  function add(r) {
    const rec = {
      at: Number(r.at) || Date.now(), start: Number(r.start) || 0, event: String(r.event || '').slice(0, 80), round: String(r.round || '').slice(0, 60),
      p1: { name: String(r.p1 && r.p1.name || '').trim().slice(0, 60), char: String(r.p1 && r.p1.char || '').slice(0, 40) },
      p2: { name: String(r.p2 && r.p2.name || '').trim().slice(0, 60), char: String(r.p2 && r.p2.char || '').slice(0, 40) },
      s1: Math.max(0, Number(r.s1) || 0), s2: Math.max(0, Number(r.s2) || 0), winner: Number(r.winner) === 2 ? 2 : 1,
    };
    if (Number(r.cb) > 0) rec.cb = Math.min(9, Math.round(Number(r.cb)));        // 1.12.18: the winner came back from this many games down
    if (!rec.p1.name || !rec.p2.name || key(rec.p1.name) === key(rec.p2.name)) return null;
    // the very same set written twice (same players, same score, within a minute): keep one — a runback is a new set
    const last = rows[rows.length - 1];
    if (last && rec.at - last.at < 60000 && key(last.p1.name) === key(rec.p1.name) && key(last.p2.name) === key(rec.p2.name) && last.s1 === rec.s1 && last.s2 === rec.s2 && last.winner === rec.winner) return last;
    rows.push(rec); if (rows.length > MAX) rows.shift(); rev++; memo.clear();
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify(rec) + '\n'); } catch {}
    return rec;
  }
  const sidesOf = (r, n) => key(r.p1.name) === n ? 1 : key(r.p2.name) === n ? 2 : 0;
  function player(name) {
    const n = key(name); if (!n) return { name: '', sets: 0, wins: 0, losses: 0, record: '', chars: [] };
    let wins = 0, losses = 0, shown = name; const ch = new Map();
    for (const r of rows) { const s = sidesOf(r, n); if (!s) continue; shown = r['p' + s].name; if (r.winner === s) wins++; else losses++; const c = r['p' + s].char; if (c) ch.set(c, (ch.get(c) || 0) + 1); }
    const chars = [...ch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, k]) => ({ char: c, sets: k }));
    return { name: shown, sets: wins + losses, wins, losses, record: wins + losses ? `${wins}–${losses}` : '', chars, main: chars[0] ? chars[0].char : '' };
  }
  function view(a, b) {
    const ka = key(a), kb = key(b), mk = `${ka}|${kb}|${rev}`; if (memo.has(mk)) return memo.get(mk);
    let wa = 0, wb = 0, last = null;
    if (ka && kb && ka !== kb) for (const r of rows) {
      const sa = sidesOf(r, ka), sb = sidesOf(r, kb); if (!sa || !sb) continue;
      if (r.winner === sa) wa++; else wb++; last = r;
    }
    const pa = player(a), pb = player(b), total = wa + wb;
    let line = '';
    if (ka && kb) {
      if (!total) line = 'First meeting';
      else {
        const lw = last.winner === sidesOf(last, ka) ? pa.name || a : pb.name || b, hi = Math.max(last.s1, last.s2), lo = Math.min(last.s1, last.s2);
        line = (wa === wb ? `Head to head ${wa}–${wb}` : `${wa > wb ? pa.name || a : pb.name || b} leads ${Math.max(wa, wb)}–${Math.min(wa, wb)}`) + ` · last time ${lw} won ${hi}–${lo}`;
      }
    }
    const v = { line, a: wa, b: wb, total, last: last ? { at: last.at, event: last.event, round: last.round, s1: last.s1, s2: last.s2, winner: last.winner === sidesOf(last, ka) ? 1 : 2 } : null,
      p1: { record: pa.record, sets: pa.sets, main: pa.main, chars: pa.chars.map(c => c.char).join(', ') }, p2: { record: pb.record, sets: pb.sets, main: pb.main, chars: pb.chars.map(c => c.char).join(', ') } };
    memo.set(mk, v); if (memo.size > 200) memo.delete(memo.keys().next().value);
    return v;
  }
  function list({ q = '', limit = 200 } = {}) {
    const k = key(q), out = [];
    for (let i = rows.length - 1; i >= 0 && out.length < limit; i--) { const r = rows[i]; if (!k || key(r.p1.name).includes(k) || key(r.p2.name).includes(k) || key(r.event).includes(k)) out.push(r); }
    return out;
  }
  function players() {
    const seen = new Map(); for (const r of rows) for (const p of [r.p1, r.p2]) seen.set(key(p.name), p.name);
    return [...seen.values()].map(player).sort((x, y) => y.sets - x.sets);
  }
  function remove(at) { const i = rows.findIndex(r => r.at === Number(at)); if (i < 0) return false; rows.splice(i, 1); rev++; memo.clear(); rewrite(); return true; }
  function rewrite() { try { const tmp = file + '.tmp'; fs.writeFileSync(tmp, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')); fs.renameSync(tmp, file); } catch {} }
  /** 1.12.18: every set, oldest first (storylines, event stats) */
  const all = () => rows;
  return { add, view, list, player, players, remove, all, get size() { return rows.length; }, get rev() { return rev; } };
}

module.exports = { createHistory };
