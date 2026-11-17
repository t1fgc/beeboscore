'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.18 — the stream rundown: the whole night planned as segments.
 *
 * A segment is { id, name, mins, screen, label, obsScene, auto, chapter, advance }:
 *   mins      how long it's planned for (0 = as long as it takes)
 *   screen    what comes on when it starts: '' (leave the screen as it is) · 'none' (hide everything) · 'countdown'
 *             (the countdown, to the end of the segment) · 'schedule' (the coming-up list) · 'bracket' · 'top8' ·
 *             'standings' · 'evstats' (the event in numbers) · 'season' (the season table) · 'screen:<id>' (a layout screen)
 *   label     the countdown's words ("Starting soon", "Back in a few") — the segment's name if empty
 *   obsScene  the OBS scene to switch to ('' = leave OBS alone)
 *   auto      an automation to run (its id)
 *   chapter   mark a VOD chapter with the segment's name
 *   advance   move on to the next segment by itself when the time's up
 * The rundown itself is { list, startAt } (startAt: 'HH:MM' — when the show is planned to start, for the schedule's times
 * before it runs). What's running is { idx, segStart, showStart }, kept on disk so a restart mid-show carries on.
 */
const MAX = 40;
const SCREENS = ['', 'none', 'countdown', 'schedule', 'bracket', 'top8', 'standings', 'evstats', 'season'];
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => (Math.random().toString(36).slice(2) + '00000000').slice(0, 8);

function cleanSeg(s) {
  if (!s || typeof s !== 'object') return null;
  const screen = SCREENS.includes(s.screen) || /^screen:[\w-]{1,60}$/.test(String(s.screen || '')) ? String(s.screen || '') : '';
  return {
    id: typeof s.id === 'string' && /^[a-z0-9]{6,16}$/.test(s.id) ? s.id : rid(),
    name: str(s.name, 60) || 'Segment', mins: Math.max(0, Math.min(600, Math.round(Number(s.mins) || 0))), screen,
    label: str(s.label, 60), obsScene: str(s.obsScene, 100), auto: str(s.auto, 16), chapter: s.chapter !== false, advance: s.advance === true || s.advance === 'true',
  };
}
function clean(r) {
  const o = r && typeof r === 'object' ? r : {};
  const list = (Array.isArray(o.list) ? o.list : []).slice(0, MAX).map(cleanSeg).filter(Boolean);
  const startAt = /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(o.startAt || '')) ? String(o.startAt) : '';
  return { list, startAt };
}
/** the ready-made plan a new rundown starts from */
function starter() {
  return clean({ startAt: '', list: [
    { name: 'Starting soon', mins: 10, screen: 'countdown', label: 'Starting soon', advance: true },
    { name: 'Pools', mins: 90, screen: 'none' },
    { name: 'Break', mins: 10, screen: 'countdown', label: 'Back in a few', advance: true },
    { name: 'Top 8', mins: 120, screen: 'top8' },
    { name: 'Grand Final', mins: 30, screen: 'none' },
    { name: 'Thanks for watching', mins: 0, screen: 'schedule' },
  ] });
}

/** planned start times: from the running segment, or from startAt today (else now) */
function times(rd, run, now = Date.now(), extra = 0) {
  const out = []; let t;
  if (run && run.idx >= 0) {
    t = run.segStart;
    for (let i = 0; i < rd.list.length; i++) {
      if (i < run.idx) { out.push(null); continue; }              // already done
      out.push(t); const m = rd.list[i].mins;
      t = m ? t + m * 60000 + (i === run.idx ? extra : 0) : Math.max(t, now);   // an open-ended segment: the rest follow from now
    }
    return out;
  }
  if (rd.startAt) { const [h, m] = rd.startAt.split(':').map(Number), d = new Date(now); d.setHours(h, m, 0, 0); t = d.getTime(); } else t = now;
  for (const s of rd.list) { out.push(t); t += (s.mins || 0) * 60000; }
  return out;
}

/**
 * The runner. hooks: { get() → rundown, getRun() / setRun(r), apply(seg, i) (do what the segment says), changed() }
 */
function createRundown(hooks) {
  let timer = null;
  const run = () => hooks.getRun() || { idx: -1, segStart: 0, showStart: 0 };
  function go(i, why = 'go') {
    const rd = hooks.get(); if (!rd.list.length) throw new Error('The rundown is empty — add a segment first.');
    if (i < 0 || i >= rd.list.length) { if (i >= rd.list.length && why === 'next') return stop(); throw new Error('There’s no segment there.'); }
    const r = run(), now = Date.now();
    hooks.setRun({ idx: i, segStart: now, showStart: r.idx >= 0 && r.showStart ? r.showStart : now });
    try { hooks.apply(rd.list[i], i); } finally { hooks.changed(); }
    return view();
  }
  function stop() { hooks.setRun({ idx: -1, segStart: 0, showStart: 0 }); hooks.changed(); return view(); }
  function action(b = {}) {
    const r = run(), rd = hooks.get();
    switch (b.do) {
      case 'start': return go(0, 'start');
      case 'next': return r.idx < 0 ? go(0, 'start') : go(r.idx + 1, 'next');
      case 'prev': return go(Math.max(0, r.idx - 1), 'prev');
      case 'go': { const i = typeof b.id === 'string' ? rd.list.findIndex(s => s.id === b.id) : Number(b.n); return go(i, 'go'); }
      case 'stop': return stop();
      case 'more': { if (r.idx < 0) throw new Error('The rundown isn’t running.'); const seg = rd.list[r.idx]; hooks.extend && hooks.extend(seg, Math.max(-30, Math.min(60, Number(b.mins) || 5))); hooks.changed(); return view(); }
      default: throw new Error('Unknown rundown step.');
    }
  }
  /** the current segment, how long it has left, and the schedule */
  function view(now = Date.now()) {
    const rd = hooks.get(), r = run();
    const cur = r.idx >= 0 ? rd.list[r.idx] : null, ext = cur && hooks.extra ? hooks.extra(cur) : 0, t = times(rd, r, now, ext);
    const ends = cur && cur.mins ? r.segStart + cur.mins * 60000 + ext : 0;
    return { running: !!cur, idx: r.idx, segStart: r.segStart, showStart: r.showStart, startAt: rd.startAt, now,
      current: cur ? { id: cur.id, name: cur.name, mins: cur.mins, endsAt: ends, left: ends ? Math.max(0, ends - now) : null, over: ends ? Math.max(0, now - ends) : 0 } : null,
      next: rd.list[r.idx + 1] ? { id: rd.list[r.idx + 1].id, name: rd.list[r.idx + 1].name } : null,
      list: rd.list.map((s, i) => ({ ...s, at: t[i] || 0, done: r.idx >= 0 && i < r.idx, live: i === r.idx })) };
  }
  /** every second while it runs: a segment that moves on by itself does so when its time's up */
  function tick() {
    const r = run(); if (r.idx < 0) return;
    const v = view(); if (!v.current) return;
    const seg = hooks.get().list[r.idx];
    if (seg && seg.advance && v.current.endsAt && Date.now() >= v.current.endsAt) { try { go(r.idx + 1, 'next'); } catch {} }
  }
  function startTimer() { if (!timer) { timer = setInterval(tick, 1000); timer.unref && timer.unref(); } }
  startTimer();
  return { action, view, go, stop, tick, close() { clearInterval(timer); timer = null; } };
}

module.exports = { clean, cleanSeg, starter, times, createRundown, SCREENS };
