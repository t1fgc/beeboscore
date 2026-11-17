/* BeeboScore (developed by Beebo) — each game's HUD, as no-go zones (1.12.24).
 *
 * In 1920 × 1080 pixels, measured from real 1080p captures: the health bars, the portraits (with the names and tags beside
 * them), the round counters, the timer and the meters. Nothing a layout draws over the game may cover them — the Layout
 * Designer's 🛡 HUD-safe guide, its warning, the built-in layouts and the overlay audit all read this one list.
 *   SB_HUD.of(game)   the zones for a game ('Tekken 8', 'Street Fighter 6', 'Avatar Legends', 'Fatal Fury: City of the Wolves'),
 *                     or null for a game it doesn't know ('Any game')
 *   SB_HUD.games      the games it knows, in the order the app lists them
 * A zone: { n: name, x, y, w, h, word: how the Designer says it, transient: only there during play (a combo counter: the
 * scoreboard keeps clear of it, a splash between games needn't), lamps: [[cx, cy]…] when it's a row of round lamps (tested
 * as circles, so a plate that cradles them doesn't count as covering them) }.
 */
(function (root) {
  'use strict';
  const Z = (n, x, y, w, h, word, more) => ({ n, x, y, w, h, word: word || n, ...(more || {}) });
  const GAMES = {
    // measured from a 1920×1080 Tekken 8 capture: the health bars start at y≈70, the round counters sit at x 722–824 and
    // 1096–1198 (y 37–65), the timer below the centre from y≈46, the portraits outside x≈164 / 1756, the Heat gauges at the bottom
    'Tekken 8': [Z('P1 health', 176, 70, 654, 30, 'P1 health bar'), Z('P2 health', 1090, 70, 654, 30, 'P2 health bar'),
      Z('Rounds', 722, 37, 102, 28, 'round counters', { lamps: [[737, 53.5], [770, 53.5], [804.5, 53.5]] }), Z('Rounds', 1096, 37, 102, 28, 'round counters', { lamps: [[1112.5, 53.5], [1146.6, 53.5], [1180.6, 53.5]] }),
      Z('Timer', 900, 46, 120, 62, 'timer'), Z('P1 portrait', 18, 8, 146, 118), Z('P2 portrait', 1756, 8, 146, 118),
      Z('P1 Heat / Rage', 58, 940, 576, 97, 'P1 Heat gauge'), Z('P2 Heat / Rage', 1286, 940, 576, 97, 'P2 Heat gauge')],
    // Street Fighter 6: portraits in the top corners with the control-type badge beside them and the player's tag under that
    // (a long tag runs on towards the middle, so its zone is wide), the health
    // bars and the Drive gauges under them, the timer between, the stock counters under the bars' inner ends, Super Art gauges
    // in the bottom corners
    'Street Fighter 6': [Z('P1 portrait', 0, 0, 195, 102), Z('P2 portrait', 1725, 0, 195, 102), Z('P1 badge', 198, 16, 56, 44, 'P1 control-type badge'), Z('P2 badge', 1666, 16, 56, 44, 'P2 control-type badge'), Z('P1 tag', 198, 60, 200, 40, 'P1 tag'), Z('P2 tag', 1522, 60, 200, 40, 'P2 tag'),
      Z('P1 health', 505, 56, 372, 48, 'P1 health bar'), Z('P2 health', 1043, 56, 372, 48, 'P2 health bar'), Z('P1 Drive', 512, 108, 384, 30, 'P1 Drive gauge'), Z('P2 Drive', 1024, 108, 384, 30, 'P2 Drive gauge'),
      Z('Badges', 756, 26, 92, 30, 'control-type badges'), Z('Badges', 1072, 26, 92, 30, 'control-type badges'), Z('Timer', 898, 38, 120, 94, 'timer'),
      Z('P1 stock', 468, 98, 70, 48, 'P1 counter'), Z('P2 stock', 1382, 98, 70, 48, 'P2 counter'),
      Z('P1 Super', 92, 942, 345, 100, 'P1 Super Art gauge'), Z('P2 Super', 1483, 942, 345, 100, 'P2 Super Art gauge')],
    // Avatar Legends: big portraits in the top corners, the health bars, the bending meters and the round lamps under them, a
    // tall timer between; the bending elements under the P2 portrait, and the combo counter on either side
    'Avatar Legends': [Z('P1 portrait', 0, 0, 238, 142), Z('P2 portrait', 1682, 0, 238, 142), Z('P1 health', 218, 54, 668, 52, 'P1 health bar'), Z('P2 health', 1034, 54, 668, 52, 'P2 health bar'),
      Z('P1 meter', 522, 102, 354, 30, 'P1 meter'), Z('P2 meter', 1044, 102, 354, 30, 'P2 meter'), Z('Rounds', 638, 130, 252, 34, 'round lamps'), Z('Rounds', 1030, 130, 256, 34, 'round lamps'),
      Z('Timer', 884, 28, 152, 154, 'timer'), Z('Elements', 1642, 148, 270, 68, 'bending elements'), Z('P1 combo', 40, 232, 252, 112, 'P1 combo counter', { transient: true }), Z('P2 combo', 1628, 232, 252, 112, 'P2 combo counter', { transient: true })],
    // Fatal Fury: City of the Wolves: portraits in the top corners, the PLAYER tags over the health and S.P.G. bars, the round
    // diamonds over the bars' inner ends, the Rev. bars under them, the timer between; the Rev. gauges in the bottom corners
    'Fatal Fury: City of the Wolves': [Z('P1 portrait', 0, 0, 205, 132), Z('P2 portrait', 1715, 0, 205, 132), Z('P1 tag', 180, 24, 192, 40, 'P1 tag'), Z('P2 tag', 1548, 24, 192, 40, 'P2 tag'),
      Z('P1 health', 176, 56, 702, 50, 'P1 health bar'), Z('P2 health', 1042, 56, 702, 50, 'P2 health bar'), Z('P1 Rev', 642, 104, 236, 32, 'P1 Rev. bar'), Z('P2 Rev', 1042, 104, 236, 32, 'P2 Rev. bar'),
      Z('Rounds', 812, 32, 60, 24, 'round diamonds'), Z('Rounds', 1048, 32, 60, 24, 'round diamonds'), Z('Timer', 894, 26, 132, 108, 'timer'),
      Z('P1 gauge', 88, 852, 270, 194, 'P1 Rev. gauge'), Z('P2 gauge', 1562, 852, 270, 194, 'P2 Rev. gauge')],
  };
  const ALIAS = { sf6: 'Street Fighter 6', 'street fighter 6': 'Street Fighter 6', avatar: 'Avatar Legends', 'avatar legends': 'Avatar Legends', 'avatar legends: the fighting game': 'Avatar Legends',
    'fatal fury': 'Fatal Fury: City of the Wolves', 'fatal fury: city of the wolves': 'Fatal Fury: City of the Wolves', tekken: 'Tekken 8', 'tekken 8': 'Tekken 8' };
  const name = g => { const k = String(g || '').trim(); return GAMES[k] ? k : ALIAS[k.toLowerCase()] || ''; };
  const api = { games: Object.keys(GAMES), name, of: g => { const k = name(g); return k ? GAMES[k].map(z => ({ ...z })) : null; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SB_HUD = api;
})(typeof window !== 'undefined' ? window : globalThis);
