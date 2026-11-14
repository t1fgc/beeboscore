'use strict';
/*
 * BeeboScore Stream Deck layouts: what goes on a 15-key Stream Deck and on a 32-key Stream Deck XL.
 *
 * Fixed keys never move: the scores, Reset, the overlay, the VS and Victory Splashes and "Hide all". The rest are
 * format keys (the "slot" action): each one knows its place, and turns into what that place is for in the format
 * that is running (Confirm & next match, Switch fighter, Board…), drawn in that format's colour. With no format they
 * are everyday keys ([L], Next match, Report…).
 *
 * build.js writes the two Stream Deck profiles from FIXED + SLOTS; plugin.js reads ROLES to draw and press the keys.
 */

// the format colours, the same as the Matches tab in the app
const FORMAT = {
  crew: { color: '#ff7a1a', name: 'CREW BATTLE', group: 'teams' },
  sajam: { color: '#b77bff', name: 'TEAM BATTLE', group: 'teams' },
  gauntlet: { color: '#27d3c3', name: 'GAUNTLET', group: 'teams' },
  tdb: { color: '#ff6b9a', name: 'TEAM DEATH BATTLE', group: 'tdb' },
  death: { color: '#ff3b5c', name: 'DEATH BATTLE', group: 'elim' },
  koth: { color: '#ffc531', name: 'KING OF THE HILL', group: 'elim' },
  league: { color: '#4c9bff', name: 'LEAGUE', group: 'elim' },
};
const groupOf = preset => (FORMAT[preset] && FORMAT[preset].group) || 'none';

// ---------------------------------------------------------------- the two decks
// A fixed key: [col, row, action, settings]. A slot: [col, row] (slot 1 = the first in the list).
// Sorted by what you reach for: the match on top, what changes with the format in the middle, what is on stream
// at the bottom. Player keys sit on their player's side. Things that are one idea are one key:
//   Undo takes back a format result when that came last · Reset: tap 0–0, hold for a new set (players cleared) ·
//   VS is Team VS in a team format · Victory is the Champion splash once a format is won · no −1 keys (hold a score).
const DECKS = {
  '15': {
    name: 'BeeboScore Prototype', file: 'BeeboProto-15', deviceType: 0, model: '20GAA9902', cols: 5, rows: 3,
    //  P1      UNDO   RESET   SWAP     P2          the match
    //  S1      S2     S3      S4       S5          side keys at the edges, Next in the middle
    //  OVERLAY VS     VICTORY HIDE ALL REFRESH     what is on stream
    fixed: [
      [0, 0, 'score', { side: 1, mode: 'tapHold' }], [1, 0, 'undo', {}], [2, 0, 'reset', {}], [3, 0, 'swap', {}], [4, 0, 'score', { side: 2, mode: 'tapHold' }],
      [0, 2, 'overlay', {}], [1, 2, 'vs', {}], [2, 2, 'victory', {}], [3, 2, 'hideall', {}], [4, 2, 'refresh', {}],
    ],
    slots: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
    roles: {
      none: ['loser:1', 'nextmatch', 'sggreport', 'layout', 'loser:2'],
      teams: ['fforfeit:1', 'fnext', 'fsplash:fboard', 'fbar', 'fforfeit:2'],
      tdb: ['fswitch:1', 'fnext', 'fsplash:fboard', 'flock', 'fswitch:2'],
      elim: ['fforfeit:1', 'fnext', 'fsplash:fboard', 'fbar', 'fforfeit:2'],
    },
  },
  '32': {
    name: 'BeeboScore Prototype XL', file: 'BeeboProto-XL', deviceType: 2, model: '20GAT9902', cols: 8, rows: 4,
    //  P1      S1     UNDO    RESET    SWAP    S2(next)  S3      P2        the match
    //  SET P1  S4     S5      FORMAT   LAYOUT  S6        S7      SET P2    players and start.gg / the format
    //  OVERLAY VS     VICTORY S8(board) S9(bar) HIDE ALL REFRESH S10       what is on stream
    //  ·       ·      ·       ·        ·       ·         ·       ·         left free for your own keys
    fixed: [
      [0, 0, 'score', { side: 1, mode: 'tapHold' }], [2, 0, 'undo', {}], [3, 0, 'reset', {}], [4, 0, 'swap', {}], [7, 0, 'score', { side: 2, mode: 'tapHold' }],
      [0, 1, 'player', { side: 1 }], [3, 1, 'slot', { deck: '32', slot: 0, role: 'badge' }], [4, 1, 'layout', { mode: 'next' }], [7, 1, 'player', { side: 2 }],
      [0, 2, 'overlay', {}], [1, 2, 'vs', {}], [2, 2, 'victory', {}], [5, 2, 'hideall', {}], [6, 2, 'refresh', {}],
    ],
    slots: [[1, 0], [5, 0], [6, 0], [1, 1], [2, 1], [5, 1], [6, 1], [3, 2], [4, 2], [7, 2]],
    roles: {
      none: ['loser:1', 'nextmatch', 'loser:2', 'blank', 'sggreport', 'bracketrefresh', 'blank', 'blank', 'blank', 'blank'],
      teams: ['fforfeit:1', 'fnext', 'fforfeit:2', 'blank', 'blank', 'blank', 'blank', 'fsplash:fboard', 'fbar', 'blank'],
      tdb: ['fswitch:1', 'fnext', 'fswitch:2', 'fforfeit:1', 'blank', 'blank', 'fforfeit:2', 'fsplash:fboard', 'flock', 'fbar'],
      elim: ['fforfeit:1', 'fnext', 'fforfeit:2', 'blank', 'blank', 'blank', 'blank', 'fsplash:fboard', 'fbar', 'blank'],
    },
  },
};

/** what a format key is right now: { role, k, s } — k/s are the action kind and settings it behaves as */
function roleFor(settings, preset) {
  const s = settings || {}, deck = DECKS[String(s.deck)] || DECKS['15'];
  const role = s.role || (deck.roles[groupOf(preset)] || deck.roles.none)[Number(s.slot) || 0] || 'blank';
  return { role, ...asAction(role) };
}
function asAction(role) {
  const [k, arg] = String(role).split(':');
  switch (k) {
    case 'fsplash': return { k, s: { kind: arg } };
    case 'fswitch': case 'fforfeit': case 'loser': case 'player': return { k, s: { side: Number(arg) === 2 ? 2 : 1 } };
    case 'layout': return { k, s: { mode: 'next' } };
    default: return { k, s: {} };
  }
}
// keys that belong to the game formats: they wear the running format's colour wherever they are on the deck
// ("refresh" reloads the overlay in OBS: the browser source starts clean, without a visible reload)
const FORMAT_KEYS = new Set(['fnext', 'fundo', 'fbar', 'fsplash', 'fswitch', 'flock', 'fforfeit', 'badge', 'blank']);


// what each job is called, for the key's settings in Stream Deck
const ROLE_LABEL = {
  undo: 'Undo', nextmatch: 'Next match (start.gg)', swap: 'Swap sides', 'loser:1': 'Player 1 [L]', 'loser:2': 'Player 2 [L]', clear: 'Clear players',
  layout: 'Next layout', 'player:1': 'Set Player 1', 'player:2': 'Set Player 2', sggreport: 'Report to start.gg', bracketrefresh: 'Refresh start.gg',
  fundo: 'Undo result', fnext: 'Confirm & next match', fbar: 'Format bar', 'fsplash:fboard': 'Board', 'fsplash:fvs': 'Team VS', 'fsplash:fwin': 'Champion',
  flock: 'Lock teams', 'fswitch:1': 'Switch fighter (team 1)', 'fswitch:2': 'Switch fighter (team 2)', 'fforfeit:1': 'Forfeit (team 1, hold)',
  'fforfeit:2': 'Forfeit (team 2, hold)', badge: 'Format name · Board', blank: '(empty)',
};
const GROUP_LABEL = { none: 'No format', teams: 'Crew · Team Battle · Gauntlet', tdb: 'Team Death Battle', elim: 'Death Battle · KOTH · League' };
/** for a format key's settings: what it does in each kind of format */
function planFor(settings) {
  const s = settings || {}, deck = DECKS[String(s.deck)] || DECKS['15'], i = Number(s.slot) || 0;
  return Object.keys(GROUP_LABEL).map(g => [GROUP_LABEL[g], ROLE_LABEL[s.role || deck.roles[g][i] || 'blank'] || '']);
}

module.exports = { FORMAT, DECKS, groupOf, roleFor, asAction, FORMAT_KEYS, planFor, ROLE_LABEL };
