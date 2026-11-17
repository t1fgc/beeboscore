'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the players' side of the show: profiles, storylines for the casters,
 * event stats, season rankings and the walk-in.
 *
 *   Profiles   data/profiles.json, one per player (by name, without caring about capitals): country, team, pronouns,
 *              main, socials, sponsor, a line about them and their walk-in music. Filled from start.gg (never over what
 *              you typed yourself) and by hand. Every overlay and the casters' page use them.
 *   Storylines talking points worked out from Player history, the bracket and the set that's on: rematches, revenge
 *              sets, losers runs, reverse sweeps, first Top 8s, streaks.
 *   Event      the event in numbers: sets, games, the longest set, comebacks, the most-played characters.
 *   Seasons    data/seasons.json: points across your weeklies, a table, the best predictors of the prediction game.
 * Nothing here leaves this PC.
 */
const fs = require('fs');
const path = require('path');

const key = n => String(n || '').trim().toLowerCase();
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const handle = v => str(v, 60).replace(/^https?:\/\/(www\.)?(twitter|x|twitch|youtube|instagram|tiktok)\.(com|tv)\/(@)?/i, '').replace(/^@/, '').replace(/[^\w.\-]/g, '').slice(0, 40);
const SOCIALS = ['twitter', 'twitch', 'youtube', 'instagram', 'tiktok'];
const POINTS = [[1, 100], [2, 80], [3, 65], [4, 55], [5, 45], [7, 35], [9, 25], [13, 18], [17, 12], [25, 8], [33, 5]];
const ATTEND = 3;
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const ftOf = bo => { bo = String(bo || ''); return /^FT/i.test(bo) ? Number(bo.slice(2)) || 0 : Math.ceil((Number(bo) || 0) / 2); };

// ------------------------------------------------------------------------------------------------ CSV (1.12.19)
/** rows of cells from CSV text (quotes, doubled quotes, commas and new lines inside quotes; a ; or tab file too) */
function csvParse(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '', sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // a cell a spreadsheet would have run as a formula was saved with a ' in front (csvCell): take it off again
  return rows.filter(r => r.some(x => String(x).trim())).map(r => r.map(x => String(x).replace(/^'([=+\-@\t])/, '$1').trim()));
}
/** one CSV cell: quoted when it needs to be, and never something a spreadsheet would run as a formula */
function csvCell(v) {
  let x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x;
  return /[",;\r\n]/.test(x) || x !== x.trim() ? `"${x.replace(/"/g, '""')}"` : x;
}
const csvLine = cells => cells.map(csvCell).join(',');
const csvCols = head => head.map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));

// ------------------------------------------------------------------------------------------------ profiles
function cleanProfile(p, name) {
  p = p && typeof p === 'object' ? p : {};
  const socials = {}; for (const k of SOCIALS) { const h = handle(p.socials && p.socials[k]); if (h) socials[k] = h; }
  const o = { name: str(p.name || name, 60), country: str(p.country, 4).toUpperCase().replace(/[^A-Z]/g, ''), team: str(p.team, 30), pronouns: str(p.pronouns, 20), main: str(p.main, 40),
    socials, sponsor: str(p.sponsor, 60), bio: str(p.bio, 160), avatar: /^https:\/\//.test(String(p.avatar || '')) ? String(p.avatar).slice(0, 400) : '', sgg: !!p.sgg };
  // 1.12.19: other names they go by ("Crimson" finds CrimsonByte) — up to 8, never their own name
  const al = (Array.isArray(p.aliases) ? p.aliases : typeof p.aliases === 'string' ? p.aliases.split(/[;|,\n]/) : []).map(x => str(x, 60)).filter(x => x && key(x) !== key(o.name));
  o.aliases = [...new Map(al.map(x => [key(x), x])).values()].slice(0, 8);
  if (p.sample) o.sample = true;                  // 1.12.19: made by "Try with sample data" (a rehearsal) — cleared with it
  if (p.walkin && /^[a-f0-9]{16}\.(mp3|ogg|m4a|wav|webm)$/.test(String(p.walkin.file || ''))) o.walkin = { file: p.walkin.file, title: str(p.walkin.title, 60), vol: Math.max(5, Math.min(100, Number(p.walkin.vol) || 80)) };
  if (p.mine && typeof p.mine === 'object') o.mine = Object.fromEntries(Object.keys(p.mine).filter(k => ['country', 'team', 'pronouns', 'main', 'avatar', 'socials'].includes(k)).map(k => [k, true]));
  return o;
}
function createProfiles(file) {
  let map = {};
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object') for (const [k, v] of Object.entries(j)) map[key(k)] = cleanProfile(v, k); } catch {}
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(() => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(map, null, 1)); fs.renameSync(tmp, file); } catch {} }, 300); };
  const get = n => { const k = key(n); if (!k) return null; return map[k] || Object.values(map).find(p => (p.aliases || []).some(a => key(a) === k)) || null; };
  function set(name, p) {
    const k = key(name); if (!k) throw new Error('Which player?');
    const old = map[k] || {}, mine = { ...(old.mine || {}) };
    for (const f of ['country', 'team', 'pronouns', 'main', 'avatar']) if (p[f] !== undefined && p[f] !== old[f]) mine[f] = true;
    if (p.socials) mine.socials = true;
    map[k] = cleanProfile({ ...old, ...p, socials: p.socials ? p.socials : old.socials, walkin: p.walkin === null ? null : p.walkin || old.walkin, mine, name: p.name || old.name || name }, name);
    save(); return map[k];
  }
  function remove(name) { const k = key(name); if (!map[k]) return false; delete map[k]; save(); return true; }
  /** 1.12.19: two profiles of one player → one. `keep` keeps its name; for each field the one you typed yourself wins
   *  (either profile's), then keep's, then the other's; start.gg's link stays; the other name becomes an alias */
  function merge(keepName, dropName) {
    const a = map[key(keepName)], b = map[key(dropName)];
    if (!a || !b) throw new Error('Pick two players who both have a profile.'); if (a === b) throw new Error('That’s the same profile.');
    const ma = a.mine || {}, mb = b.mine || {}, o = { ...a }, mine = { ...mb, ...ma };
    for (const f of ['country', 'team', 'pronouns', 'main', 'avatar', 'sponsor', 'bio']) o[f] = ma[f] && a[f] ? a[f] : mb[f] && b[f] ? b[f] : a[f] || b[f] || '';
    o.socials = ma.socials ? { ...b.socials, ...a.socials } : mb.socials ? { ...a.socials, ...b.socials } : { ...b.socials, ...a.socials };
    o.walkin = a.walkin || b.walkin; o.sgg = !!(a.sgg || b.sgg); o.mine = mine;
    o.aliases = [...(a.aliases || []), b.name, ...(b.aliases || [])];
    delete map[key(dropName)]; map[key(keepName)] = cleanProfile(o, a.name); save();
    return map[key(keepName)];
  }
  const PCOLS = ['name', 'team', 'country', 'pronouns', 'main', ...SOCIALS, 'sponsor', 'bio', 'aliases'];
  /** 1.12.19: profiles from a spreadsheet (CSV with a header row: Name, Team, Country, Pronouns, Main, Twitter, Twitch,
   *  YouTube, Instagram, TikTok, Sponsor, Bio, Aliases — any order, any of them but Name left out). What's typed counts
   *  as yours, so start.gg never writes over it. */
  function importCsv(text) {
    const rows = csvParse(text); if (rows.length < 2) throw new Error('That file has no players in it (the first row is the column names).');
    const cols = csvCols(rows[0]), at = c => cols.indexOf(c === 'twitter' ? (cols.includes('twitter') ? 'twitter' : 'x') : c);
    if (at('name') < 0) throw new Error('The first row needs a “Name” column.');
    let added = 0, updated = 0;
    for (const r of rows.slice(1, 2001)) {
      const name = str(r[at('name')], 60); if (!name) continue;
      const p = {}, so = {};
      for (const f of ['team', 'country', 'pronouns', 'main', 'sponsor', 'bio']) { const i = at(f); if (i >= 0 && r[i]) p[f] = r[i]; }
      for (const k of SOCIALS) { const i = at(k); if (i >= 0 && r[i]) so[k] = r[i]; }
      if (Object.keys(so).length) p.socials = { ...((map[key(name)] || {}).socials || {}), ...so };
      const ai = at('aliases'); if (ai >= 0 && r[ai]) p.aliases = [...((map[key(name)] || {}).aliases || []), ...r[ai].split(/[;|]/)];
      if (map[key(name)]) updated++; else added++;
      set(name, p); const mine = map[key(name)].mine || {}; for (const f of Object.keys(p)) if (['sponsor', 'bio', 'aliases'].includes(f)) continue; else mine[f] = true; map[key(name)].mine = mine;
    }
    save(); return { added, updated };
  }
  function exportCsv() {
    const head = ['Name', 'Team', 'Country', 'Pronouns', 'Main', 'Twitter', 'Twitch', 'YouTube', 'Instagram', 'TikTok', 'Sponsor', 'Bio', 'Aliases'];
    return [head.join(','), ...Object.values(map).sort((a, b) => a.name.localeCompare(b.name)).map(p => csvLine([p.name, p.team, p.country, p.pronouns, p.main, ...SOCIALS.map(k => (p.socials || {})[k] || ''), p.sponsor, p.bio, (p.aliases || []).join('; ')]))].join('\r\n') + '\r\n';
  }
  /** start.gg's entrants: fills what you haven't typed yourself */
  function fromStartgg(list) {
    let n = 0;
    for (const e of list || []) {
      const k = key(e.name); if (!k) continue;
      const old = map[k] || { name: e.name }, mine = old.mine || {}, nx = { ...old, sgg: true };
      if (!mine.team && e.team) nx.team = e.team;
      if (!mine.country && e.country) nx.country = e.country;
      if (!mine.pronouns && e.pronouns) nx.pronouns = e.pronouns;
      if (!mine.avatar && e.avatar) nx.avatar = e.avatar;
      if (!mine.socials && e.socials) nx.socials = { ...(old.socials || {}), ...e.socials };
      const c = cleanProfile(nx, e.name);
      if (JSON.stringify(c) !== JSON.stringify(map[k])) { map[k] = c; n++; }
    }
    if (n) save();
    return n;
  }
  function clearSample() { let n = 0; for (const [k, v] of Object.entries(map)) if (v.sample) { delete map[k]; n++; } if (n) save(); return n; }
  return { get, set, remove, merge, importCsv, exportCsv, clearSample, fromStartgg, list: () => Object.values(map).sort((a, b) => a.name.localeCompare(b.name)), get size() { return Object.keys(map).length; } };
}

// ------------------------------------------------------------------------------------------------ seasons
const sid = () => (Math.random().toString(36).slice(2) + '00000000').slice(0, 8);
function pointsFor(place, table = POINTS) { for (const [p, pts] of table) if (place <= p) return pts; return ATTEND; }
function cleanSeason(s) {
  s = s && typeof s === 'object' ? s : {};
  const events = (Array.isArray(s.events) ? s.events : []).slice(-200).map(e => ({ id: typeof e.id === 'string' ? e.id.slice(0, 16) : sid(), name: str(e.name, 80) || 'Event', date: str(e.date, 10),
    standings: (Array.isArray(e.standings) ? e.standings : []).slice(0, 512).map(x => ({ name: str(x.name, 60), place: Math.max(1, Math.round(Number(x.place) || 0)) })).filter(x => x.name && x.place) }));
  const predictors = {}; if (s.predictors && typeof s.predictors === 'object') for (const [k, v] of Object.entries(s.predictors).slice(0, 5000)) if (v && typeof v === 'object') predictors[key(k).slice(0, 25)] = { name: str(v.name, 25) || k, pts: Math.max(0, Number(v.pts) || 0), right: Math.max(0, Number(v.right) || 0), total: Math.max(0, Number(v.total) || 0) };
  return { id: typeof s.id === 'string' && /^[a-z0-9]{6,16}$/.test(s.id) ? s.id : sid(), name: str(s.name, 60) || 'Season 1', events, predictors, ...(s.sample ? { sample: true } : {}) };
}
function createSeasons(file) {
  let D = { active: '', list: [] };
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); D = { active: String(j.active || ''), list: (j.list || []).slice(0, 30).map(cleanSeason) }; } catch {}
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(() => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(D)); fs.renameSync(tmp, file); } catch {} }, 300); };
  const active = () => D.list.find(s => s.id === D.active) || null;
  function table(s = active()) {
    if (!s) return [];
    const m = new Map();
    for (const e of s.events) for (const x of e.standings) {
      const k = key(x.name), r = m.get(k) || { name: x.name, pts: 0, events: 0, best: 999, wins: 0 };
      r.pts += pointsFor(x.place); r.events++; r.best = Math.min(r.best, x.place); if (x.place === 1) r.wins++; r.name = x.name; m.set(k, r);
    }
    const out = [...m.values()].sort((a, b) => b.pts - a.pts || a.best - b.best || b.events - a.events || a.name.localeCompare(b.name));
    let rank = 0, prev = null; out.forEach((r, i) => { if (!prev || prev.pts !== r.pts || prev.best !== r.best) rank = i + 1; r.rank = rank; prev = r; });
    return out;
  }
  function rankOf(name) { const k = key(name); if (!k) return null; const t = table(); const r = t.find(x => key(x.name) === k); return r ? { rank: r.rank, of: t.length, pts: r.pts } : null; }
  /** a player's best results across every season (for the walk-in) */
  function results(name) {
    const k = key(name), out = [];
    const seen = new Set();      // 1.12.20: the same event in two seasons (a copy of a season) counts once on the casters' page and the walk-in
    for (const s of D.list) for (const e of s.events) { const x = e.standings.find(y => key(y.name) === k); const id = `${e.name}|${e.date}|${x && x.place}`; if (x && !seen.has(id)) { seen.add(id); out.push({ event: e.name, date: e.date, place: x.place, season: s.name }); } }
    return out.sort((a, b) => a.place - b.place || String(b.date).localeCompare(String(a.date)));
  }
  function predictors(s = active(), n = 10) { if (!s) return []; return Object.values(s.predictors).sort((a, b) => b.pts - a.pts || b.right - a.right).slice(0, n); }
  function action(b = {}) {
    switch (b.do) {
      case 'create': { const s = cleanSeason({ name: b.name }); D.list.push(s); D.active = s.id; break; }
      case 'activate': if (!D.list.some(s => s.id === b.id)) throw new Error('No such season.'); D.active = b.id; break;
      case 'rename': { const s = D.list.find(x => x.id === b.id) || active(); if (!s) throw new Error('No season yet.'); s.name = str(b.name, 60) || s.name; break; }
      case 'delete': D.list = D.list.filter(s => s.id !== b.id); if (D.active === b.id) D.active = D.list[0] ? D.list[0].id : ''; break;
      case 'addEvent': {
        let s = active(); if (!s) { s = cleanSeason({ name: 'Season 1' }); D.list.push(s); D.active = s.id; }
        const st = (Array.isArray(b.standings) ? b.standings : []).map(x => ({ name: str(x.name, 60), place: Math.max(1, Math.round(Number(x.place) || 0)) })).filter(x => x.name && x.place);
        if (!st.length) throw new Error('That event has no results yet.');
        const name = str(b.name, 80) || 'Event', date = str(b.date, 10) || new Date().toISOString().slice(0, 10);
        if (s.events.some(e => e.name === name && e.date === date)) throw new Error('That event is already in this season.');
        s.events.push({ id: sid(), name, date, standings: st }); break;
      }
      case 'removeEvent': { const s = active(); if (s) s.events = s.events.filter(e => e.id !== b.id); break; }
      case 'resetPredictors': { const s = active(); if (s) s.predictors = {}; break; }
      default: throw new Error('Unknown season step.');
    }
    save(); return view();
  }
  function predicted(winners, losers) {           // the prediction game's points: { login: {name, right} }
    const s = active(); if (!s) return;
    for (const [k, v] of Object.entries(winners)) { const r = s.predictors[k] || (s.predictors[k] = { name: v.name, pts: 0, right: 0, total: 0 }); r.name = v.name; r.pts += v.pts || 10; r.right++; r.total++; }
    for (const [k, v] of Object.entries(losers)) { const r = s.predictors[k] || (s.predictors[k] = { name: v.name, pts: 0, right: 0, total: 0 }); r.name = v.name; r.total++; }
    save();
  }
  /** 1.12.19: a player's results move to another name (two profiles merged) — where both names are in one event, the better place stays */
  function renamePlayer(from, to) {
    const kf = key(from), kt = key(to); if (!kf || !kt || kf === kt) return 0; let n = 0;
    for (const s of D.list) for (const e of s.events) {
      const f = e.standings.find(x => key(x.name) === kf); if (!f) continue; n++;
      const t = e.standings.find(x => key(x.name) === kt);
      if (t) { t.place = Math.min(t.place, f.place); e.standings = e.standings.filter(x => x !== f); } else f.name = str(to, 60);
    }
    if (n) save(); return n;
  }
  /** 1.12.19: a season as CSV — one row per player per event: Event, Date, Place, Player, Points (Points is worked out
   *  again on the way back in, so the file can be sorted or edited in a spreadsheet) */
  function exportCsv(id) {
    const s = id ? D.list.find(x => x.id === id) : active(); if (!s) throw new Error('No season yet.');
    const out = ['Event,Date,Place,Player,Points'];
    for (const e of s.events) for (const x of e.standings) out.push(csvLine([e.name, e.date, x.place, x.name, pointsFor(x.place)]));
    return { name: s.name, csv: out.join('\r\n') + '\r\n' };
  }
  /** a season back from CSV: a new season (named `name`), its events in the order they first appear in the file */
  function importCsv(text, name) {
    const rows = csvParse(text); if (rows.length < 2) throw new Error('That file has no results in it (the first row is the column names).');
    const cols = csvCols(rows[0]), at = c => cols.indexOf(c), need = ['event', 'place', 'player'];
    for (const c of need) if (at(c) < 0) throw new Error('The first row needs Event, Date, Place and Player columns.');
    const evs = new Map();
    for (const r of rows.slice(1, 20001)) {
      const ev = str(r[at('event')], 80), date = at('date') >= 0 ? str(r[at('date')], 10) : '', who = str(r[at('player')], 60), place = Math.round(Number(r[at('place')]));
      if (!ev || !who || !(place >= 1)) continue;
      const k = ev + '\u0000' + date; if (!evs.has(k)) evs.set(k, { id: sid(), name: ev, date, standings: [] });
      const e = evs.get(k); if (!e.standings.some(x => key(x.name) === key(who))) e.standings.push({ name: who, place });
    }
    if (!evs.size) throw new Error('No results found in that file.');
    if (D.list.length >= 30) throw new Error('That’s 30 seasons already — delete an old one first.');
    const s = cleanSeason({ name: str(name, 60) || 'Imported season', events: [...evs.values()] }); D.list.push(s); D.active = s.id; save();
    return view();
  }
  function view() { const s = active(); return { active: D.active, sample: D.list.some(x => x.sample), list: D.list.map(x => ({ id: x.id, name: x.name, events: x.events.length, sample: !!x.sample })), season: s ? { id: s.id, name: s.name, events: s.events.map(e => ({ id: e.id, name: e.name, date: e.date, entrants: e.standings.length })) } : null, table: table().slice(0, 64), predictors: predictors(), points: POINTS, attend: ATTEND }; }
  /** 1.12.19: "Try with sample data" — a made-up season (and back out again) */
  function addSample(events) { D.list = D.list.filter(x => !x.sample); const s = cleanSeason({ name: 'Sample season', events, sample: true }); D.list.push(s); D.active = s.id; save(); return view(); }
  function clearSample() { const had = D.list.some(x => x.sample); if (!had) return 0; const wasActive = (active() || {}).sample; D.list = D.list.filter(x => !x.sample); if (wasActive || !D.list.some(x => x.id === D.active)) D.active = D.list.length ? D.list[D.list.length - 1].id : ''; save(); return 1; }
  return { view, action, table, rankOf, results, predictors, predicted, active, renamePlayer, exportCsv, importCsv, addSample, clearSample, firstTop8: name => !results(name).some(r => r.place <= 8) };
}

// ------------------------------------------------------------------------------------------------ storylines
/**
 * rows: every set in Player history (oldest first); st: the scoreboard; opts: { today (ms: the event started), live: the set
 * being played ({ deficit1, deficit2 } — the most each side has been behind), top8 (bracket top 8 reached), firstTop8(n) }
 */
function storylines(rows, st, opts = {}) {
  const out = [], a = String(st.p1 && st.p1.name || '').trim(), b = String(st.p2 && st.p2.name || '').trim(), ka = key(a), kb = key(b);
  if (!ka || !kb || ka === kb || /^player [12]$/.test(ka) || /^player [12]$/.test(kb)) return out;
  const since = opts.today || (Date.now() - 16 * 3600 * 1000), round = String(st.round || ''), side = (r, k) => key(r.p1.name) === k ? 1 : key(r.p2.name) === k ? 2 : 0;
  const met = rows.filter(r => side(r, ka) && side(r, kb));
  const today = met.filter(r => r.at >= since);
  // a rematch at this event — a revenge set when the loser went to losers and is back for more
  if (today.length) {
    const last = today[today.length - 1], wName = last.winner === side(last, ka) ? a : b, lName = wName === a ? b : a, hi = Math.max(last.s1, last.s2), lo = Math.min(last.s1, last.s2);
    const revenge = /loser|grand/i.test(round) && /winner/i.test(last.round || '');
    out.push({ kind: revenge ? 'revenge' : 'rematch', title: revenge ? 'Revenge set' : 'Rematch', text: `${wName} beat ${lName} ${hi}–${lo}${last.round ? ' in ' + last.round : ''} earlier today${revenge ? ` — ${lName} came back through losers for this` : ''}.`, who: wName === a ? 2 : 1 });
  }
  // a rivalry: they've met a lot
  if (met.length >= 3) {
    let wa = 0; for (const r of met) if (r.winner === side(r, ka)) wa++;
    const wb = met.length - wa;
    out.push({ kind: 'rivalry', title: 'Rivalry', text: wa === wb ? `${met.length} sets between them and it's dead even, ${wa}–${wb}.` : `${met.length} sets between them — ${wa > wb ? a : b} leads ${Math.max(wa, wb)}–${Math.min(wa, wb)}.` });
  } else if (!met.length) out.push({ kind: 'first', title: 'First meeting', text: `${a} and ${b} have never played each other on stream.` });
  for (const [n, k, s] of [[a, ka, 1], [b, kb, 2]]) {
    const mine = rows.filter(r => side(r, k));
    // a losers run: sets won in a row today, in losers
    let run = 0; for (let i = mine.length - 1; i >= 0; i--) { const r = mine[i]; if (r.at < since || !/loser/i.test(r.round || '')) break; if (r.winner !== side(r, k)) break; run++; }
    if (run >= 2 && /loser|grand/i.test(round)) out.push({ kind: 'losersRun', title: 'Losers run', who: s, text: `${n} has won ${run} sets in a row in losers.` });
    // a winning streak (all time)
    let streak = 0; for (let i = mine.length - 1; i >= 0; i--) { if (mine[i].winner !== side(mine[i], k)) break; streak++; }
    if (streak >= 3 && run < 2) out.push({ kind: 'streak', title: 'On a streak', who: s, text: `${n} has won ${streak} sets in a row.` });
    // came back from a set down before
    const comebacks = mine.filter(r => r.cb && r.winner === side(r, k)).length;
    if (comebacks >= 2) out.push({ kind: 'comebacks', title: 'Comeback player', who: s, text: `${n} has come back from behind to win ${comebacks} sets.` });
    // their first Top 8 / first set on stream
    if (opts.top8 && opts.firstTop8 && opts.firstTop8(n) && /top ?8|winners (semi|final)|losers (top 8|quarter|semi|final)|grand/i.test(round + ' ' + (opts.phase || ''))) out.push({ kind: 'firstTop8', title: 'First Top 8', who: s, text: `It's ${n}'s first Top 8 in the season results.` });
    if (!mine.length) out.push({ kind: 'debut', title: 'Stream debut', who: s, text: `${n}'s first set on stream.` });
  }
  // the set itself: a reverse sweep on, or done
  const ft = ftOf(st.bestOf), s1 = Number(st.p1.score) || 0, s2 = Number(st.p2.score) || 0, L = opts.live || {};
  if (ft >= 2) for (const [n, mine, theirs, def, s] of [[a, s1, s2, L.deficit1 || 0, 1], [b, s2, s1, L.deficit2 || 0, 2]]) {
    if (def >= ft - 1 && mine === ft) out.unshift({ kind: 'reverseSweep', title: 'Reverse sweep', who: s, text: `${n} was one game from going out — and won it ${mine}–${theirs}!` });
    else if (def >= 2 && mine === theirs && mine < ft) out.unshift({ kind: 'comeback', title: 'Comeback on', who: s, text: `${n} was ${def} games down and it's ${mine}–${theirs} now.` });
    else if (theirs === ft - 1 && mine === 0 && ft >= 2) out.push({ kind: 'brink', title: 'On the brink', who: s, text: `${n} is one game from going out.` });
  }
  return out.slice(0, 8);
}

// ------------------------------------------------------------------------------------------------ event stats
function eventStats(rows, since) {
  const ev = rows.filter(r => r.at >= since);
  const games = ev.reduce((n, r) => n + r.s1 + r.s2, 0);
  const longest = ev.slice().sort((x, y) => (y.s1 + y.s2) - (x.s1 + x.s2) || ((y.at - (y.start || y.at)) - (x.at - (x.start || x.at))))[0] || null;
  const dur = r => (r.start && r.at > r.start ? r.at - r.start : 0);
  const longestTime = ev.filter(dur).sort((x, y) => dur(y) - dur(x))[0] || null;
  const ch = new Map(); for (const r of ev) for (const p of [r.p1, r.p2]) if (p.char) ch.set(p.char, (ch.get(p.char) || 0) + 1);
  const chars = [...ch.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => ({ char: c, sets: n }));
  const cbs = ev.filter(r => r.cb), cbBy = new Map(); for (const r of cbs) { const w = r['p' + r.winner].name; cbBy.set(w, (cbBy.get(w) || 0) + 1); }
  const most = [...cbBy.entries()].sort((x, y) => y[1] - x[1])[0] || null, biggest = cbs.slice().sort((x, y) => y.cb - x.cb)[0] || null;
  const wins = new Map(); for (const r of ev) { const w = r['p' + r.winner].name; wins.set(w, (wins.get(w) || 0) + 1); }
  const topWins = [...wins.entries()].sort((x, y) => y[1] - x[1])[0] || null;
  const sweeps = ev.filter(r => Math.min(r.s1, r.s2) === 0 && Math.max(r.s1, r.s2) >= 2).length;
  const fmt = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const line = r => r ? `${r.p1.name} vs ${r.p2.name} (${r.s1}–${r.s2}${r.round ? ', ' + r.round : ''})` : '';
  return { sets: ev.length, games, players: new Set(ev.flatMap(r => [key(r.p1.name), key(r.p2.name)])).size, sweeps, chars,
    longest: longest ? { text: line(longest), games: longest.s1 + longest.s2 } : null, longestTime: longestTime ? { text: line(longestTime), time: fmt(dur(longestTime)) } : null,
    comebacks: cbs.length, mostComebacks: most && most[1] >= 1 ? { name: most[0], n: most[1] } : null, biggest: biggest ? { text: line(biggest), from: biggest.cb } : null,
    mostWins: topWins ? { name: topWins[0], n: topWins[1] } : null, since, span: ev.length ? fmt(ev[ev.length - 1].at - (ev[0].start || ev[0].at)) : '' };
}

module.exports = { createProfiles, createSeasons, storylines, eventStats, pointsFor, cleanProfile, ordinal, POINTS, SOCIALS, ftOf, csvParse, csvCell };
