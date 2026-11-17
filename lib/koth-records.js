'use strict';
/*
 * BeeboScore (developed by Beebo) — King of the Hill records (Testbuild 1.12.6).
 *
 * Every King of the Hill fight since the first one, kept on this PC:
 *   <data>/koth-records.json   the record itself (players, events, every fight) — what the app reads, and what a backup holds
 *   <data>/koth-records.csv    the same players as a sheet (opens in Excel, Google Sheets, Numbers), rewritten after every fight
 *
 *   "King of the Hill"     — this event: who's won the most since it started (it starts over with every new event)
 *   "Emperor of the World" — everyone since the first event, by wins: the top 10
 *
 * Players are matched by name (case doesn't matter). A fight that's undone in the app is taken back here too.
 */
const fs = require('fs');
const path = require('path');

const key = n => String(n || '').trim().toLowerCase();
const blank = () => ({ v: 1, since: 0, events: [], fights: [], players: {}, current: '' });

function createKothRecords({ dir, changed = () => {} }) {
  const FILE = path.join(dir, 'koth-records.json'), CSV = path.join(dir, 'koth-records.csv');
  let D = blank();
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && d.v === 1 && d.players) D = { ...blank(), ...d }; } catch {}
  let saveT = null;
  function save(now) {
    clearTimeout(saveT);
    const go = () => {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(D)); fs.renameSync(tmp, FILE);
        const tc = CSV + '.tmp'; fs.writeFileSync(tc, csv()); fs.renameSync(tc, CSV);
      } catch (e) { console.error('koth records:', e.message); }
    };
    if (now) go(); else saveT = setTimeout(go, 250);
  }
  const player = (name, at) => {
    const k = key(name); if (!k) return null;
    let p = D.players[k];
    if (!p) p = D.players[k] = { name: String(name).trim().slice(0, 60), wins: 0, losses: 0, fights: 0, events: [], kings: 0, best: 0, firstSeen: at, lastSeen: at, viewer: false };
    p.name = String(name).trim().slice(0, 60) || p.name; p.lastSeen = Math.max(p.lastSeen || 0, at);
    return p;
  };
  const ev = id => D.events.find(e => e.id === id);

  /** a King of the Hill event starts (the format goes live) → its id */
  function startEvent(name) {
    const at = Date.now(), id = 'e' + at.toString(36) + Math.random().toString(36).slice(2, 6);   // (two events in the same millisecond stay apart)
    if (!D.since) D.since = at;
    D.events.push({ id, name: String(name || 'King of the Hill').slice(0, 80), started: at, ended: 0, champion: '', fights: 0, best: 0, bestBy: '' });
    D.current = id; save(); changed('event'); return id;
  }
  function endEvent(champion) {
    const e = ev(D.current); if (!e) return;
    if (!e.fights) { D.events = D.events.filter(x => x !== e); D.current = ''; save(); changed('end'); return; }   // an event with no fights isn't kept
    e.ended = Date.now(); e.champion = String(champion || e.champion || '');
    D.current = ''; save(); changed('end');
  }
  /** one fight: who won, who lost, the winner's streak after it; `n` is the fight's number in the event (for undo) */
  function fight({ winner, loser, streak = 0, n = 0, crowned = false, viewer = {} }) {
    if (!D.current) startEvent('King of the Hill');
    const at = Date.now(), e = ev(D.current), w = player(winner, at), l = player(loser, at); if (!w || !l) return;
    w.wins++; w.fights++; l.losses++; l.fights++;
    for (const p of [w, l]) if (!p.events.includes(D.current)) p.events.push(D.current);
    if (crowned) w.kings++;
    w.best = Math.max(w.best || 0, streak);
    if (viewer[key(winner)]) w.viewer = true; if (viewer[key(loser)]) l.viewer = true;
    if (e) { e.fights++; if (streak > (e.best || 0)) { e.best = streak; e.bestBy = w.name; } }
    D.fights.push({ e: D.current, n, w: w.name, l: l.name, s: streak, k: !!crowned, at });
    if (D.fights.length > 20000) D.fights.splice(0, D.fights.length - 20000);
    save(); changed('fight');
  }
  /** fights taken back in the app (undo): fight number n and later, in the current event */
  function unfight(fromN) {
    let any = false;
    for (let i = D.fights.length - 1; i >= 0; i--) {
      const f = D.fights[i]; if (f.e !== D.current || f.n < fromN) continue;
      const w = D.players[key(f.w)], l = D.players[key(f.l)];
      if (w) { w.wins = Math.max(0, w.wins - 1); w.fights = Math.max(0, w.fights - 1); if (f.k) w.kings = Math.max(0, w.kings - 1); }
      if (l) { l.losses = Math.max(0, l.losses - 1); l.fights = Math.max(0, l.fights - 1); }
      const e = ev(f.e); if (e) e.fights = Math.max(0, e.fights - 1);
      D.fights.splice(i, 1); any = true;
    }
    if (any) {          // the bests are recounted from what's left
      for (const p of Object.values(D.players)) p.best = 0;
      for (const f of D.fights) { const w = D.players[key(f.w)]; if (w) w.best = Math.max(w.best, f.s); }
      const e = ev(D.current); if (e) { e.best = 0; e.bestBy = ''; for (const f of D.fights) if (f.e === e.id && f.s > e.best) { e.best = f.s; e.bestBy = f.w; } }
      save(); changed('undo');
    }
  }
  const rate = p => (p.fights ? p.wins / p.fights : 0);
  const order = (a, b) => b.wins - a.wins || rate(b) - rate(a) || b.best - a.best || a.name.localeCompare(b.name);
  /** Emperor of the World: everyone since the first event, by wins */
  function emperors(n = 10) { return Object.values(D.players).filter(p => p.fights).sort(order).slice(0, n).map((p, i) => ({ rank: i + 1, name: p.name, wins: p.wins, losses: p.losses, best: p.best, kings: p.kings, events: p.events.length, viewer: !!p.viewer })); }
  /** this event (or the last one): by wins in it */
  function eventTable(n = 10) {
    const id = D.current || (D.events[D.events.length - 1] || {}).id; if (!id) return { event: null, rows: [] };
    const m = new Map();
    for (const f of D.fights) {
      if (f.e !== id) continue;
      const w = m.get(key(f.w)) || { name: f.w, wins: 0, losses: 0, best: 0 }; w.wins++; w.best = Math.max(w.best, f.s); m.set(key(f.w), w);
      const l = m.get(key(f.l)) || { name: f.l, wins: 0, losses: 0, best: 0 }; l.losses++; m.set(key(f.l), l);
    }
    const e = ev(id);
    return { event: e ? { name: e.name, started: e.started, ended: e.ended, champion: e.champion, best: e.best, bestBy: e.bestBy, fights: e.fights, live: id === D.current } : null,
      rows: [...m.values()].sort((a, b) => b.wins - a.wins || b.best - a.best || a.losses - b.losses).slice(0, n).map((r, i) => ({ rank: i + 1, ...r })) };
  }
  function view() { return { since: D.since, events: D.events.length, players: Object.values(D.players).filter(p => p.fights).length, fights: D.fights.length, emperors: emperors(10), event: eventTable(10) }; }
  function csv() {
    const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const day = t => (t ? new Date(t).toISOString().slice(0, 10) : '');
    const rows = Object.values(D.players).filter(p => p.fights).sort(order);
    const head = ['Rank', 'Player', 'Wins', 'Losses', 'Win %', 'Fights', 'Events', 'Best streak', 'Times crowned', 'Viewer', 'First seen', 'Last seen'];
    return '﻿' + [head, ...rows.map((p, i) => [i + 1, p.name, p.wins, p.losses, p.fights ? Math.round(rate(p) * 100) : 0, p.fights, p.events.length, p.best, p.kings, p.viewer ? 'yes' : '', day(p.firstSeen), day(p.lastSeen)])]
      .map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
  }
  /** the whole record (a backup) */
  const exportAll = () => ({ beebo: 1, type: 'koth-records', app: 'BeeboScore', exported: new Date().toISOString(), records: D });
  /** a backup back in: replace (default) or merge (players add up; events and fights are kept from both) */
  function importAll(obj, { merge = false } = {}) {
    const R = obj && obj.type === 'koth-records' ? obj.records : obj;
    if (!R || R.v !== 1 || typeof R.players !== 'object') throw new Error('That isn’t a BeeboScore King of the Hill records file.');
    if (!merge) D = { ...blank(), ...R, current: '' };
    else {
      const ids = new Set(D.events.map(e => e.id));
      for (const e of R.events || []) if (!ids.has(e.id)) D.events.push({ ...e });
      const fk = new Set(D.fights.map(f => f.e + '|' + f.n + '|' + f.at));
      for (const f of R.fights || []) if (!fk.has(f.e + '|' + f.n + '|' + f.at)) D.fights.push({ ...f });
      for (const [k, p] of Object.entries(R.players)) {
        const o = D.players[k];
        if (!o) D.players[k] = { ...p, events: [...(p.events || [])] };
        else { o.wins += p.wins || 0; o.losses += p.losses || 0; o.fights += p.fights || 0; o.kings += p.kings || 0; o.best = Math.max(o.best || 0, p.best || 0); o.events = [...new Set([...(o.events || []), ...(p.events || [])])]; o.firstSeen = Math.min(o.firstSeen || Infinity, p.firstSeen || Infinity); o.lastSeen = Math.max(o.lastSeen || 0, p.lastSeen || 0); o.viewer = o.viewer || p.viewer; }
      }
      D.since = Math.min(D.since || Infinity, R.since || Infinity) === Infinity ? 0 : Math.min(D.since || Infinity, R.since || Infinity);
    }
    save(true); changed('import');
  }
  function reset() { D = blank(); save(true); changed('reset'); }
  return { startEvent, endEvent, fight, unfight, emperors, eventTable, view, exportAll, importAll, reset, csv, files: { json: FILE, csv: CSV }, get current() { return D.current; }, flush: () => save(true) };
}
module.exports = { createKothRecords };
