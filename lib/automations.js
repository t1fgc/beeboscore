'use strict';
/*
 * BeeboScore (developed by Beebo), 1.12.16 — Automations: "when this happens, do that".
 *
 * An automation is { id, name, on, when: { ev, ...filter }, steps: [ { do, ... } ] }, kept in the settings
 * (config.automations). The app reports what happens (fire(ev, info)); every automation that's on and whose "when" matches
 * runs its steps one after another, each through the same actions the panel and the Stream Deck use. "Run of show" (the
 * autopilot after each set) is still its own ready-made automation, in the same card.
 *
 * When (ev):
 *   setWon       a set is won                         filter: round contains (text), who ('1' / '2' / '')
 *   gameWon      a game is won (not the last one)     filter: who
 *   matchPoint   someone is one game from the set
 *   round        the round changes                    filter: round contains (e.g. "Grand Final")
 *   newMatch     two new players are loaded
 *   shown        a splash or screen comes on          filter: what ('vs', 'victory', 'bracket', 'top8', 'standings', 'screen:<id>')
 *   moment       a moment's banner comes up (1.12.21)  filter: what ('matchpoint', 'comeback', 'reversesweep', 'sweep', 'upset', 'runback', 'losersrun', 'reset' or any), who
 *   formatStart  a game format starts · formatEnd   a format ends
 *   manual       only when you press Run (the panel, or the Stream Deck's Run automation key)
 * Steps (do):
 *   wait {s} · stinger · vs {show} · victory {show} · splash {kind, show} · screen {name, show} · hideAll · nextMatch
 *   replay (OBS Instant replay) · obsScene {scene} (switch OBS to that scene) · chat {text} (say it in Twitch chat)
 *   sponsor (show the next sponsor now) · chapter {label} (mark a VOD chapter) · tempoOff
 */

const EVENTS = {
  setWon: 'A set is won', gameWon: 'A game is won', matchPoint: 'Someone reaches match point', round: 'The round changes to…',
  newMatch: 'A new match is loaded', shown: 'A splash or screen comes on', formatStart: 'A game format starts', formatEnd: 'A game format ends',
  segment: 'A rundown segment starts', hype: 'The hype meter peaks', pollEnd: 'A poll ends',       // 1.12.18
  moment: 'A moment happens (match point, sweep, upset…)',                                         // 1.12.21
  manual: 'Only when I press Run',
};
const STEPS = {
  wait: 'Wait', stinger: 'Play the stinger', vs: 'VS screen', victory: 'Victory screen', splash: 'Bracket / Top 8 / standings splash',
  screen: 'A layout screen', hideAll: 'Hide all splashes', nextMatch: 'Load the next match', replay: 'Instant replay (OBS)',
  obsScene: 'Switch the OBS scene', chat: 'Say in Twitch chat', sponsor: 'Show the next sponsor', chapter: 'Mark a VOD chapter', tempoOff: 'Stop the tap tempo',
  // 1.12.18
  rundownNext: 'Next rundown segment', countdown: 'Countdown screen', walkin: 'Walk-in screen', storyline: 'Storyline card', predOpen: 'Open the picks (prediction game)', predLock: 'Lock the picks',
  pollStart: 'Start my last poll again', hype: 'Hype burst', music: 'Music on / off', ext: 'An extension’s cue',
};
const MOMENTS = ['matchpoint', 'comeback', 'reversesweep', 'sweep', 'upset', 'runback', 'losersrun', 'reset'];
const MAX = 40, MAX_STEPS = 16;
const str = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const bool = v => v === true || v === 'true' || v === 1 || v === '1';

function cleanStep(s) {
  if (!s || typeof s !== 'object' || !STEPS[s.do]) return null;
  const o = { do: s.do };
  if (s.do === 'wait') o.s = Math.max(.2, Math.min(120, Number(s.s) || 1));
  if (['vs', 'victory', 'splash', 'screen'].includes(s.do)) o.show = s.show === undefined ? true : bool(s.show);
  if (s.do === 'splash') o.kind = ['bracket', 'top8', 'standings'].includes(s.kind) ? s.kind : 'bracket';
  if (s.do === 'screen') o.name = str(s.name, 60);
  if (s.do === 'obsScene') o.scene = str(s.scene, 100);
  if (s.do === 'chat') o.text = str(s.text, 300);
  if (s.do === 'chapter') o.label = str(s.label, 80);
  if (['countdown', 'walkin', 'storyline'].includes(s.do)) o.show = s.show === undefined ? true : bool(s.show);
  if (s.do === 'countdown') { o.mins = Math.max(0, Math.min(600, Number(s.mins) || 0)); o.label = str(s.label, 60); }
  if (s.do === 'walkin') o.side = Number(s.side) === 2 ? 2 : 1;
  if (s.do === 'music') o.on = s.on === undefined ? true : bool(s.on);
  if (s.do === 'ext') { o.ext = str(s.ext, 31).toLowerCase(); o.cue = str(s.cue, 30).toLowerCase(); }
  return o;
}
function clean(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list.slice(0, MAX)) {
    if (!a || typeof a !== 'object') continue;
    const w = a.when && typeof a.when === 'object' ? a.when : {}, ev = EVENTS[w.ev] ? w.ev : 'manual';
    const when = { ev };
    if (['setWon', 'round'].includes(ev) && w.round) when.round = str(w.round, 60);
    if (['setWon', 'gameWon', 'moment'].includes(ev) && ['1', '2'].includes(String(w.who))) when.who = String(w.who);
    if (ev === 'shown') when.what = str(w.what, 60) || 'vs';
    if (ev === 'moment' && MOMENTS.includes(String(w.what))) when.what = String(w.what);
    if (ev === 'segment' && w.what) when.what = str(w.what, 60);
    const steps = (Array.isArray(a.steps) ? a.steps : []).slice(0, MAX_STEPS).map(cleanStep).filter(Boolean);
    out.push({ id: typeof a.id === 'string' && /^[a-z0-9]{6,16}$/.test(a.id) ? a.id : (Math.random().toString(36).slice(2) + '00000000').slice(0, 8), name: str(a.name, 60) || 'My automation', on: a.on !== false, when, steps });
  }
  return out;
}
/** does this automation's "when" match what just happened? */
function matches(a, ev, info = {}) {
  if (!a.on || a.when.ev !== ev || !a.steps.length) return false;
  const w = a.when, has = (t, q) => String(t || '').toLowerCase().includes(String(q || '').toLowerCase());
  if (w.round && !has(info.round, w.round)) return false;
  if (w.who && String(info.who) !== w.who) return false;
  if (ev === 'shown' && w.what !== info.what) return false;
  if (ev === 'moment' && w.what && w.what !== info.what) return false;
  if (ev === 'segment' && w.what && !has(info.what, w.what)) return false;
  return true;
}

/** the runner: run(step) does one step (returns a promise); one automation's steps run one after another, and an
 *  automation started again while it's still running starts over */
function createRunner({ doStep, log = () => {} }) {
  let list = [];
  const running = new Map();          // id → token
  async function run(a, info = {}) {
    const tok = {}; running.set(a.id, tok);
    for (const s of a.steps) {
      if (running.get(a.id) !== tok) return false;      // started again, or stopped
      try {
        if (s.do === 'wait') await new Promise(r => setTimeout(r, s.s * 1000));
        else await doStep(s, info, a);
      } catch (e) { log(`automation “${a.name}”: ${s.do} — ${e.message}`); }
    }
    if (running.get(a.id) === tok) running.delete(a.id);
    return true;
  }
  return {
    set(l) { list = clean(l); return list; },
    get list() { return list; },
    fire(ev, info) { const hit = list.filter(a => matches(a, ev, info)); for (const a of hit) run(a, info); return hit.length; },
    runNow(id) { const a = list.find(x => x.id === id || x.name.toLowerCase() === String(id || '').toLowerCase()); if (!a || !a.steps.length) return false; run(a, { manual: true }); return true; },
    stop(id) { if (id) running.delete(id); else running.clear(); },
    get running() { return [...running.keys()]; },
  };
}

module.exports = { EVENTS, STEPS, clean, matches, createRunner };
