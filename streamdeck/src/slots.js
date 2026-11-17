'use strict';
/*
 * BeeboScore Lite (developed by Beebo) — the "Set up Stream Deck" layouts.
 *
 * The bundled profiles fill every key with one action, "BeeboScore key" (…slot). The plugin decides what each of those keys
 * does from where it sits and what is running in the app, so starting a format rearranges the deck at once — no profile
 * switching, nothing for the streamer to drag or set.
 *
 *  Stream Deck XL (8 × 4) — one row per job:
 *    row 1  the match      players, scores, swap, one Undo (takes back a format result too), Reset (hold: next set), Refresh OBS
 *    row 2  on stream      FullVS, GlassVS, Victory, Bracket, Top 8, Standings, VS style, Hide all
 *    row 3  what's running 1v1: start.gg (next match, report, W/L side), losers marks, next set, effects · a format: its keys
 *                          (Team Death Battle: both switch-in keys and Lock In; King of the Hill: the leaderboard)
 *    row 4  the set        moments, replay the moment, head-to-head, set timer, stats strip, bracket reset, the stats cards
 *  (BeeboScore Lite: no viewer events, Twitch or show keys.)
 *  Stream Deck / MK.2 (5 × 3): row 1 the match, row 2 the splashes (the VS key plays the VS style chosen in the app — hold it
 *  to switch FullVS ⇄ GlassVS), row 3 changes with the format.
 *  Any other size: keys are filled in reading order, the match first.
 */
const K = (k, settings = {}) => ({ k, settings });
const UNDO = K('undo', { any: true }), RESET = K('reset', { holdClear: true });

// ---- rows that never move (BeeboScore Lite: the match, the splashes, start.gg and the formats — no viewer events, no show)
const XL_MATCH = [K('player', { side: 1 }), K('score', { side: 1 }), K('swap'), K('score', { side: 2 }), K('player', { side: 2 }), UNDO, RESET, K('obsrefresh')];
const XL_SHOW = [K('vs', { style: 'full' }), K('playervs'), K('victory'), K('bracket'), K('top8'), K('standings'), K('vsstyle'), K('hideall')];   // FullVS and GlassVS side by side
const XL_STORY = [K('moments'), K('momentreplay'), K('h2h'), K('settimer'), K('statsstrip'), K('greset'), K('stats', { side: 1 }), K('stats', { side: 2 })];   // row 4: the set as it's told
// ---- the row that follows the app
const XL_SIDE = {
  solo: [K('nextmatch'), K('sggreport'), K('bracketside'), K('loser', { side: 1 }), K('loser', { side: 2 }), K('clear'), K('fxq'), K('vsstyle')],
  format: [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'fvs' }), K('fsplash', { kind: 'fwin' }), K('fbar'), K('fundo'), K('nextmatch'), K('sggreport')],
  tdb: [K('fnext'), K('fswitch', { side: 1 }), K('fswitch', { side: 2 }), K('flock'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'fvs' }), K('fsplash', { kind: 'fwin' }), K('fbar')],
  // King of the Hill — the leaderboard (this event + the Emperor of the World) instead of a team VS it doesn't have
  koth: [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'flead' }), K('fsplash', { kind: 'fwin' }), K('fbar'), K('fundo'), K('nextmatch'), K('sggreport')],
};
const XL_CORE = [XL_MATCH, XL_SHOW, null, XL_STORY];      // row 3 (index 2) is XL_SIDE[section]
const STD_CORE = [
  [K('score', { side: 1 }), K('swap'), UNDO, RESET, K('score', { side: 2 })],
  [K('vs'), K('victory'), K('bracket'), K('hideall'), K('obsrefresh')],
];
const STD_SIDE = {
  solo: [K('nextmatch'), K('top8'), K('standings'), K('sggreport'), K('bracketside')],
  format: [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'fvs' }), K('fsplash', { kind: 'fwin' }), K('fbar')],
  tdb: [K('fswitch', { side: 1 }), K('flock'), K('fswitch', { side: 2 }), K('fnext'), K('fsplash', { kind: 'fboard' })],
  koth: [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'flead' }), K('fsplash', { kind: 'fwin' }), K('fbar')],
};

// ---- "Everything, in pages" (the app's Settings › Stream Deck): nothing moves when a format starts — every key has a fixed
// place, and the ▸ key (row 3, last on the XL; bottom right on the Stream Deck) turns the page.
const PAGE = K('page');
const XL_PAGES = [
  { name: 'MATCH', rows: [XL_MATCH, XL_SHOW, [...XL_SIDE.solo.slice(0, 7), PAGE], XL_STORY] },
  { name: 'FORMATS', rows: [XL_MATCH, XL_SHOW, [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'fvs' }), K('fsplash', { kind: 'fwin' }), K('fsplash', { kind: 'flead' }), K('fbar'), K('fundo'), PAGE],
    [K('fswitch', { side: 1 }), K('flock'), K('fswitch', { side: 2 }), K('funlock'), K('nextmatch'), K('sggreport'), K('top8'), K('standings')]] },
];
const STD_PAGES = [
  { name: 'MATCH', row: [K('nextmatch'), K('top8'), K('standings'), K('sggreport'), PAGE] },
  { name: 'FORMAT', row: [K('fnext'), K('fsplash', { kind: 'fboard' }), K('fsplash', { kind: 'fvs' }), K('fsplash', { kind: 'fwin' }), PAGE] },
  { name: 'TEAMS', row: [K('fswitch', { side: 1 }), K('flock'), K('fswitch', { side: 2 }), K('fbar'), PAGE] },
  { name: 'MORE', row: [K('fundo'), K('fsplash', { kind: 'flead' }), K('vsstyle'), K('playervs'), PAGE] },
  { name: 'STORY', row: [K('moments'), K('momentreplay'), K('h2h'), K('settimer'), PAGE] },
  { name: 'SPLASH', row: [K('statsstrip'), K('greset'), K('bracketside'), K('fxq'), PAGE] },
];
const ALL_KEYS = [...STD_CORE.flat(), ...STD_PAGES.flatMap(p => p.row.filter(k => k.k !== 'page'))];
/** "follow" (default): the format row changes with the app · "all": every key, in pages */
const sdMode = status => (status && status.sdLayout === 'all' ? 'all' : 'follow');
function pagesFor(cols, rows) { return cols >= 8 && rows >= 4 ? XL_PAGES : cols === 5 && rows === 3 ? STD_PAGES : null; }

/** which keys the app needs in the row that follows it */
function sectionOf(status) {
  const f = status && status.format;
  if (!f) return 'solo';
  if (f.preset === 'koth' || (f.rules && f.rules.mode === 'koth')) return 'koth';
  return f.preset === 'tdb' || (f.rules && f.rules.mode === 'tdb') ? 'tdb' : 'format';
}
/** the key at (column, row) on a deck of cols × rows, for this app status → { k, settings } (k 'status' = the BeeboScore key) */
function slotFor(cols, rows, column, row, status, page = 0) {
  if (sdMode(status) === 'all') {
    const P = pagesFor(cols, rows), pg = P ? P[((Number(page) || 0) % P.length + P.length) % P.length] : null;
    if (cols >= 8 && rows >= 4) return row > 3 || column > 7 ? K('blank') : pg.rows[row][column];
    if (cols === 5 && rows === 3) return row < 2 ? STD_CORE[row][column] : pg.row[column];
    return ALL_KEYS[row * cols + column] || K('blank');
  }
  const sec = sectionOf(status);
  if (cols >= 8 && rows >= 4) {
    if (row > 3 || column > 7) return K('blank');
    return (row === 2 ? XL_SIDE[sec] : XL_CORE[row])[column];
  }
  if (cols === 5 && rows === 3) return row < 2 ? STD_CORE[row][column] : STD_SIDE[sec][column];
  // any other deck: reading order, the match first, then what the app needs
  const list = [...STD_CORE.flat(), ...STD_SIDE[sec]], i = row * cols + column;
  return list[i] || K('blank');
}
/** the profile the plugin bundles for a deck, by its size (Stream Deck's DeviceType: 0 Stream Deck, 2 XL) */
function profileFor(device) {
  const s = (device && device.size) || {}, t = device && device.type;
  if (t === 2 || (s.columns >= 8 && s.rows >= 4)) return { name: 'profiles/BeeboScore Lite XL', cols: 8, rows: 4, label: 'Stream Deck XL' };
  if (t === 0 || (s.columns === 5 && s.rows === 3)) return { name: 'profiles/BeeboScore Lite', cols: 5, rows: 3, label: 'Stream Deck' };
  return null;
}
const DEVICE_NAMES = { 0: 'Stream Deck', 1: 'Stream Deck Mini', 2: 'Stream Deck XL', 3: 'Stream Deck Mobile', 4: 'Corsair G-Keys', 5: 'Stream Deck Pedal', 6: 'Corsair Voyager', 7: 'Stream Deck +', 8: 'SCUF controller', 9: 'Stream Deck Neo' };

module.exports = { slotFor, sectionOf, profileFor, pagesFor, sdMode, DEVICE_NAMES, XL_PAGES, STD_PAGES, XL_CORE, XL_SIDE, STD_CORE, STD_SIDE, XL_MATCH, XL_SHOW, XL_STORY };
