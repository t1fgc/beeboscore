'use strict';
/*
 * Key artwork for the BeeboScore Stream Deck plugin. Every key is drawn as a 144×144 SVG so it
 * can show live data (names, scores, on/off). Also used by build.js to write the static images.
 */
const VT = '#7c3aed', VT2 = '#c3a2ff';
const P1 = '#e63950', P2 = '#2f8bff', BEE = '#ffb020', INK = '#0e1017', SYNC = '#29c6ff', TW = '#9146ff', TW2 = '#c3a2ff', OKG = '#35dc84';
const FONT = "font-family=\"'Segoe UI', 'Helvetica Neue', Arial, sans-serif\"";

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fit = (text, max, big, small) => { const n = String(text).length; return n <= max ? big : Math.max(small, Math.round(big * max / n)); };
const short = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const sideColor = side => (Number(side) === 2 ? P2 : P1);

function frame(inner, { bg = INK, accent = null, dim = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
    + `<rect width="144" height="144" fill="${bg}"/>`
    + (accent ? `<rect width="144" height="10" fill="${accent}"/>` : '')
    + inner
    + (dim ? `<rect width="144" height="144" fill="rgba(0,0,0,.6)"/><text x="72" y="134" ${FONT} font-size="15" font-weight="800" fill="#ff8a8a" text-anchor="middle" letter-spacing="1">APP OFFLINE</text>` : '')
    + `</svg>`;
}
const label = (t, y = 128, size = 17, fill = '#fff', ls = 1.5) => `<text x="72" y="${y}" ${FONT} font-size="${size}" font-weight="800" fill="${fill}" text-anchor="middle" letter-spacing="${ls}">${esc(t)}</text>`;

// The glyphs are Layout Designer designs (art/streamdeck.js → src/designer-art.json, built by tools/designer-art/build.js).
// Each is drawn in two tones; '#fff' (the key's idle white) keeps the placeholder so the key's group colour fills it in.
const DA = require('./designer-art.json');
const MAIN = '#fffffe', SOFT = '#fffffd';
function glyph(name, c = '#fff', soft) {
  const g = DA['g.' + name] || '';
  if (c === '#fff' && !soft) return g;                                  // idle: painted in the group's colours by grouped()
  return g.split(MAIN).join(c).split(SOFT).join(soft || c);
}
const ICONS = {
  cube3d: (c, s2) => glyph('cube3d', c, s2),
  speaker: (c, on = true) => glyph(on ? 'speaker' : 'speakerOff', c),
  reset: (c, s2) => glyph('reset', c, s2), swap: (c, s2) => glyph('swap', c, s2), undo: (c, s2) => glyph('undo', c, s2), next: (c, s2) => glyph('next', c, s2), clear: (c, s2) => glyph('clear', c, s2),
  layout: (c, s2) => glyph('layout', c, s2), screen: (c, s2) => glyph('screen', c, s2), bracket: (c, s2) => glyph('bracket', c, s2), refresh: (c, s2) => glyph('resync', c, s2), pull: (c, s2) => glyph('pull', c, s2),
  upload: (c, s2) => glyph('upload', c, s2), eye: (c, s2) => glyph('eye', c, s2), bolt: (c, s2) => glyph('bolt', c, s2), trophy: (c, s2) => glyph('trophy', c, s2), twitch: (c, s2) => glyph('chat', c, s2),
  mic: (c, s2) => glyph('mic', c, s2), leader: (c, s2) => glyph('leader', c, s2),
  swords: (c, s2) => glyph('swords', c, s2), board: (c, s2) => glyph('board', c, s2), crown: (c, s2) => glyph('crown', c, s2), pencil: (c, s2) => glyph('pencil', c, s2), person: (c, s2) => glyph('person', c, s2),
  personPlus: (c, s2) => glyph('personPlus', c, s2), vs: (c, s2) => glyph('vs', c, s2), plus1: (c, s2) => glyph('plus1', c, s2), podium: (c, s2) => glyph('podium', c, s2), top8: (c, s2) => glyph('top8', c, s2),
  loser: (c, s2) => glyph('loser', c, s2), chatLink: (c, s2) => glyph('chatLink', c, s2), chatNext: (c, s2) => glyph('chatNext', c, s2), queue: (c, s2) => glyph('queue', c, s2), sidebar: (c, s2) => glyph('sidebar', c, s2),
  scan: (c, s2) => glyph('scan', c, s2), switchArrows: (c, s2) => glyph('switchArrows', c, s2), lock: (c, s2) => glyph('lock', c, s2), unlock: (c, s2) => glyph('unlock', c, s2), tempo: (c, s2) => glyph('tempo', c, s2), pilot: (c, s2) => glyph('pilot', c, s2), replay: (c, s2) => glyph('replay', c, s2), ticket: (c, s2) => glyph('ticket', c, s2), formatBar: (c, s2) => glyph('formatBar', c, s2),
  flow: (c, s2) => glyph('flow', c, s2), chapter: (c, s2) => glyph('chapter', c, s2), statsCard: (c, s2) => glyph('statsCard', c, s2), sponsor: (c, s2) => glyph('sponsor', c, s2),   // 1.12.16
  // 1.12.18: the show
  ...Object.fromEntries(['rundown', 'countdown', 'schedule', 'walkin', 'storyline', 'evstats', 'season', 'rehearsal', 'slowmo', 'freeze', 'drawClear', 'clip', 'results', 'picks', 'poll', 'twpred', 'music', 'duck', 'ext', 'cdPlus',
    'moments', 'momentReplay', 'h2h', 'setTimer', 'statsStrip', 'gresetSplash'].map(n => [n, (c, s2) => glyph(n, c, s2)])),      // 1.12.21: the set as it's told
  confirm: (c, s2) => glyph('confirm', c, s2), controller: (c, s2) => glyph('controller', c, s2), sides: (c, s2) => glyph('sides', c, s2), hexLife: (c, s2) => glyph('hexLife', c, s2),
};

// ---------------------------------------------------------------- keys
const art = {
  score({ side = 1, name = '', score = 0, mode = 'tapHold', offline = false } = {}) {
    const c = sideColor(side), n = short(name || `Player ${side}`, 12);
    const hint = mode === 'subtract' ? '−1' : mode === 'add' ? '+1' : 'TAP +1 · HOLD −1';
    return frame(`<rect width="144" height="144" fill="${c}" opacity=".22"/>`
      + `<text x="72" y="30" ${FONT} font-size="${fit(n, 9, 19, 12)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text>`
      + `<text x="72" y="104" ${FONT} font-size="${String(score).length > 1 ? 68 : 82}" font-weight="900" fill="#fff" text-anchor="middle">${esc(score)}</text>`
      + label(hint, 132, mode === 'tapHold' ? 11 : 18, 'rgba(255,255,255,.75)', mode === 'tapHold' ? 0 : 1),
      { accent: c, dim: offline });
  },
  reset: ({ offline, hint } = {}) => frame(`<g transform="translate(18,${hint ? 2 : 8}) scale(.75)">${ICONS.reset('#fff')}</g>` + (hint ? label('RESET', 114, 16) + label(hint, 134, 11, 'rgba(255,255,255,.6)', 1) : label('RESET')), { accent: BEE, dim: offline }),
  swap: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.swap('#fff')}</g>` + label('SWAP'), { accent: BEE, dim: offline }),
  // Electrocute 1P / 2P: a bolt in the player's colour, crackling
  undo: ({ offline, label: l } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.undo('#fff')}</g>` + label(l || 'UNDO', 128, l ? 14 : 17), { accent: BEE, dim: offline }),
  // 1.12.3: Hide all — every splash off at once (lit while anything full-screen is up)
  hideAll: ({ on = false, offline = false } = {}) => frame(`<g transform="translate(24,4) scale(.66)">${glyph('hideAll', on ? '#29c6ff' : '#fff')}</g>` + label('HIDE ALL', 116, 16, '#fff', 2) + label(on ? 'SPLASH UP' : 'NOTHING UP', 135, 11, on ? '#7fe0ff' : 'rgba(255,255,255,.5)', 1.5), { dim: offline }),
  nextmatch: ({ offline, label: l } = {}) => frame(`<g transform="translate(6,-12) scale(.92)">${ICONS.next(BEE)}</g>` + label(l || 'NEXT MATCH', 130, 15), { dim: offline }),
  clear: ({ offline } = {}) => frame(`<g transform="translate(14,2) scale(.8)">${ICONS.clear('#fff')}</g>` + label('NEXT SET', 130, 16), { accent: BEE, dim: offline }),
  // FullVS (1.12.6's name for the VS Splash)
  vs({ on = false, hint = '', offline = false } = {}) {
    const g = hint ? `<g transform="translate(30,6) scale(.6)">` : `<g transform="translate(22,10) scale(.7)">`;
    return on
      ? frame(`${g}${ICONS.vs(INK)}</g>` + label('ON AIR', hint ? 112 : 128, 16, INK, 3) + (hint ? label(hint, 132, 10, 'rgba(14,16,23,.7)', 1) : ''), { bg: BEE, dim: offline })
      : frame(`${g}${ICONS.vs('#fff')}</g>` + label('FULLVS', hint ? 112 : 128, 16, '#fff', 2) + (hint ? label(hint, 132, 10, 'rgba(255,255,255,.5)', 1) : ''), { dim: offline });
  },
  // 1.12.10: the layout's stinger over the stream, now (between two OBS scenes, on a big moment)
  stinger({ offline = false } = {}) {
    return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.bolt('#fff')}</g>` + label('STINGER', 104, 16, '#fff', 2) + label('PLAY IT NOW', 128, 10, 'rgba(255,255,255,.5)', 1.2), { dim: offline });
  },
  // the commentary screen (1.12.6): lit while on stream; shows how many cameras are live
  comm({ on = false, live = 0, offline = false } = {}) {
    return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.mic(on ? INK : '#fff')}</g>` + label(on ? 'ON AIR' : 'COMMENTARY', 104, on ? 16 : 13, on ? INK : '#fff', 1.5) + label(live ? `${live} ${live === 1 ? 'CAMERA' : 'CAMERAS'} LIVE` : 'NO CAMERAS', 128, 10, on ? 'rgba(14,16,23,.7)' : 'rgba(255,255,255,.5)', 1.2), { bg: on ? BEE : undefined, dim: offline });
  },
  // which VS the VS button plays: FullVS or GlassVS (a tap switches)
  vsStyle({ glass = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.switchArrows('#fff', glass ? '#9fd8ff' : BEE)}</g>` + label('VS STYLE', 96, 12, 'rgba(255,255,255,.6)', 2) + label(glass ? 'GLASSVS' : 'FULLVS', 122, 18, glass ? '#9fd8ff' : BEE, 1.5), { dim: offline });
  },
  player({ side = 1, name = '', offline = false } = {}) {
    const c = sideColor(side), n = short(name || 'Set name', 12);
    return frame(`<g transform="translate(36,14) scale(.5)">${ICONS.person('#fff')}</g>`
      + `<text x="72" y="104" ${FONT} font-size="${fit(n, 8, 22, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text>`
      + label(`PLAYER ${side}`, 132, 13, 'rgba(255,255,255,.7)', 1.5) + `<g transform="translate(${side === 1 ? 104 : 108},121) scale(.11)">${ICONS.pencil('rgba(255,255,255,.7)')}</g>`, { accent: c, dim: offline });
  },
  bracket({ on = false, offline = false, label: l } = {}) {
    return on
      ? frame(`<g transform="translate(16,6) scale(.76)">${ICONS.bracket(INK)}</g>` + label('ON AIR', 130, 16, INK, 3), { bg: BEE, dim: offline })
      : frame(`<g transform="translate(16,6) scale(.76)">${ICONS.bracket('#fff')}</g>` + label(l || 'BRACKET', 130, l ? 13 : 16, 'rgba(255,255,255,.75)', l ? 1 : 2), { accent: BEE, dim: offline });
  },
  // Refresh bracket: cyan "pull from start.gg" key: a small bracket with a download arrow dropping into a tray
  bracketRefresh({ busy = false, label: l, offline = false } = {}) {
    const done = l === 'UPDATED', col = busy ? BEE : done ? '#3ddc84' : SYNC;
    return frame(`<rect y="10" width="144" height="134" fill="${SYNC}" opacity=".1"/>`
      + `<g transform="translate(10,20) scale(.42)">${ICONS.bracket('rgba(255,255,255,.55)')}</g>`
      + `<g transform="translate(58,16) scale(.6)">${ICONS.pull(col)}</g>`
      + label(busy ? 'SYNCING…' : (l || 'GET RESULTS'), 130, 14, busy ? BEE : done ? '#3ddc84' : '#fff', 1.2), { accent: col, dim: offline });
  },
  // Victory splash: a gold trophy; lit gold while it's on stream, dim until someone has won the set
  victory({ on = false, ready = false, offline = false } = {}) {
    const GOLD = '#f6c453';
    return on
      ? frame(`<g transform="translate(22,6) scale(.7)">${ICONS.trophy(INK)}</g>` + label('ON AIR', 130, 16, INK, 3), { bg: GOLD, dim: offline })
      : frame(`<g transform="translate(22,6) scale(.7)" opacity="${ready ? 1 : .45}">${ICONS.trophy(GOLD)}</g>` + label(ready ? 'VICTORY' : 'NO WINNER', 130, ready ? 16 : 13, ready ? '#fff' : 'rgba(255,255,255,.55)', 2), { accent: GOLD, dim: offline });
  },
  // Bracket side: W / L tabs; the side on stream lights up. Press flips it (or shows the bracket on Losers)
  bracketSide({ side = 'W', on = false, paged = true, offline = false, label: l } = {}) {
    const tab = (x, t, lit) => `<rect x="${x}" y="20" width="52" height="40" rx="6" fill="${lit ? BEE : 'none'}" stroke="${lit ? BEE : 'rgba(255,255,255,.4)'}" stroke-width="3"/>`
      + `<text x="${x + 26}" y="51" ${FONT} font-size="28" font-weight="900" font-style="italic" fill="${lit ? INK : 'rgba(255,255,255,.6)'}" text-anchor="middle">${t}</text>`;
    const live = on && paged, big = l ? l : !on ? 'LOSERS' : !paged ? 'ONE PAGE' : side === 'L' ? 'LOSERS' : 'WINNERS';
    return frame(tab(14, 'W', live && side === 'W') + tab(78, 'L', live && side === 'L')
      + `<text x="72" y="98" ${FONT} font-size="${fit(big, 7, 25, 15)}" font-weight="900" fill="${live ? '#fff' : 'rgba(255,255,255,.85)'}" text-anchor="middle" letter-spacing="1">${esc(big)}</text>`
      + label(!on ? 'SHOW SIDE' : !paged ? 'NO SIDES' : 'TAP TO FLIP', 130, 13, live ? BEE : 'rgba(255,255,255,.6)', 2), { accent: BEE, dim: offline });
  },
  latency({ viewers = 0, worst = null, offline = false } = {}) {
    const col = worst == null ? 'rgba(255,255,255,.55)' : worst < 100 ? '#3ddc84' : worst < 250 ? '#9ee34b' : worst < 600 ? BEE : '#ff5d6c';
    const ms = worst == null ? '—' : worst >= 1000 ? (worst / 1000).toFixed(1) + 's' : String(worst);
    return frame(`<g transform="translate(14,4) scale(.36)">${ICONS.eye('#fff')}</g><text x="84" y="44" ${FONT} font-size="30" font-weight="900" fill="#fff" text-anchor="start">${viewers}</text>`
      + `<text x="72" y="104" ${FONT} font-size="${ms.length > 4 ? 40 : 50}" font-weight="900" fill="${col}" text-anchor="middle">${esc(ms)}</text>`
      + label(worst == null ? 'LATENCY' : 'MS · SLOWEST', 132, 12, 'rgba(255,255,255,.65)', 1.2), { accent: col === 'rgba(255,255,255,.55)' ? '#555a66' : col, dim: offline });
  },
  postlink({ ready = false, offline = false, flash = false } = {}) {
    const C = '#9147ff';
    return frame(`<g transform="translate(18,6) scale(.75)" opacity="${ready || flash ? 1 : .45}">${ICONS.chatLink(flash ? '#fff' : ready ? '#fff' : '#8d919d', flash ? '#fff' : ready ? C : '#3a3d48')}</g>`
      + label(flash ? 'POSTED' : ready ? 'POST LINK' : 'NOT SHARED', 132, ready ? 15 : 12, ready || flash ? '#fff' : 'rgba(255,255,255,.45)', 1.5), { bg: flash ? C : '#0a0a0e', dim: offline });
  },
  sggReport({ ready = false, sent = false, mode = 'ask', offline = false, flash = false } = {}) {
    const C = '#4f7dff', on = ready || sent;
    return frame(`<g transform="translate(20,4) scale(.72)">${ICONS.upload(flash || sent ? '#fff' : on ? '#fff' : 'rgba(255,255,255,.4)', flash || sent ? '#fff' : on ? C : 'rgba(255,255,255,.25)')}</g>`
      + label(flash ? 'SENT!' : sent ? 'REPORTED' : ready ? 'REPORT' : mode === 'off' ? 'REPORTS OFF' : 'NO RESULT', 132, on ? 15 : 12, on ? '#fff' : 'rgba(255,255,255,.45)', 1.5), { bg: sent ? '#1c3fa8' : '#0a0a0e', dim: offline });
  },
  standings({ on = false, ready = false, offline = false } = {}) {
    const GOLD = '#f2c14e';
    return frame(`<g transform="translate(20,2) scale(.72)" opacity="${on || ready ? 1 : .5}">${ICONS.podium(on ? '#fff' : GOLD, on ? 'rgba(255,255,255,.75)' : '#6b6f7c')}</g>`
      + label(on ? 'ON AIR' : ready ? 'STANDINGS' : 'NO RESULTS', 132, ready || on ? 15 : 12, on ? '#fff' : ready ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.45)', 1.5),
      { bg: on ? '#c3132d' : '#0a0a0e', dim: offline });
  },
  top8({ on = false, offline = false, label: l } = {}) {
    const CR = '#e0263f';
    const body = `<g transform="translate(34,14) scale(.66)">${ICONS.top8(on ? '#fff' : '#fff', on ? 'rgba(255,255,255,.5)' : CR)}</g>`
      + `<text x="30" y="40" ${FONT} font-size="20" font-weight="900" font-style="italic" fill="${on ? '#fff' : '#e8eaf0'}" text-anchor="middle" letter-spacing="2">TOP</text>`
      + label(on ? 'ON AIR' : (l || 'SPLASH'), 132, l && !on ? 13 : 16, on ? '#fff' : 'rgba(255,255,255,.7)', on ? 3 : (l ? 1 : 2));
    const bg = on ? '' : `<defs><radialGradient id="t8g" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#5a0812"/><stop offset="1" stop-color="#0a0a0e"/></radialGradient></defs><rect width="144" height="144" fill="url(#t8g)"/>`;
    return frame(bg + body, { bg: on ? CR : '#0a0a0e', dim: offline });
  },
  loser({ side = 1, on = false, offline = false } = {}) {
    const c = sideColor(side);
    return frame(`<g transform="translate(26,8) scale(.64)">${ICONS.loser(on ? INK : '#fff', on ? INK : c)}</g>`
      + label(`PLAYER ${side}`, 128, 15, on ? INK : 'rgba(255,255,255,.7)', 2), { bg: on ? c : INK, accent: on ? null : c, dim: offline });
  },
  // ---- viewer matches (Twitch Stuff)
  viewerNext({ next = '', count = 0, busy = false, offline = false } = {}) {
    const n = short(next || '', 12);
    return frame(`<g transform="translate(16,10) scale(.5)">${ICONS.chatNext('#fff')}</g><text x="132" y="50" ${FONT} font-size="28" font-weight="900" fill="#fff" text-anchor="end">${count}</text>`
      + `<text x="72" y="104" ${FONT} font-size="${n ? fit(n, 9, 19, 12) : 14}" font-weight="800" fill="${n ? '#fff' : 'rgba(255,255,255,.55)'}" text-anchor="middle">${esc(n || 'QUEUE EMPTY')}</text>`
      + label(busy ? 'LOADING…' : 'NEXT VIEWER', 132, 13, TW2, 1.5), { dim: offline });
  },
  viewerResult({ who = 'streamer', s = 0, v = 0, playing = true, offline = false } = {}) {
    const me = who !== 'viewer', col = me ? OKG : TW2;
    return frame(`<rect y="10" width="144" height="134" fill="${me ? OKG : TW}" opacity=".12"/>`
      + `<text x="72" y="44" ${FONT} font-size="17" font-weight="800" fill="${col}" text-anchor="middle" letter-spacing="1.5">${me ? 'I WON' : 'THEY WON'}</text>`
      + `<text x="72" y="100" ${FONT} font-size="${playing ? 48 : 26}" font-weight="900" fill="#fff" text-anchor="middle">${playing ? `${s}–${v}` : 'NO MATCH'}</text>`
      + label('TAP +1 · HOLD −1', 132, 11, 'rgba(255,255,255,.7)', 0), { accent: col, dim: offline });
  },
  viewerQueue({ open = false, count = 0, offline = false } = {}) {
    return open
      ? frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="${INK}" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="44" font-weight="900" fill="${INK}" text-anchor="middle">OPEN</text>` + label(`${count} WAITING`, 130, 14, INK, 1.5), { bg: OKG, dim: offline })
      : frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="rgba(255,255,255,.7)" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="31" font-weight="900" fill="#fff" text-anchor="middle">CLOSED</text>` + label(count ? `${count} WAITING` : 'TAP TO OPEN', 130, 13, 'rgba(255,255,255,.6)', 1.5), { accent: TW, dim: offline });
  },
  viewerSidebar({ on = true, offline = false } = {}) {
    return on
      ? frame(`<g transform="translate(26,6) scale(.64)">${ICONS.sidebar('#fff')}</g>` + label('ON SCREEN', 128, 15, '#fff', 2), { bg: TW, dim: offline })
      : frame(`<g transform="translate(26,6) scale(.64)" opacity=".55">${ICONS.sidebar('#fff')}</g>` + label('SIDEBAR OFF', 128, 13, 'rgba(255,255,255,.7)', 1.5), { dim: offline });
  },
  viewerSplash({ on = false, ready = true, offline = false } = {}) {
    return on
      ? frame(`<g transform="translate(22,10) scale(.7)">${ICONS.vs('#fff')}</g>` + label('ON AIR', 128, 16, '#fff', 3), { bg: TW, dim: offline })
      : frame(`<g transform="translate(22,10) scale(.7)" opacity="${ready ? 1 : .4}">${ICONS.vs('#fff')}</g>` + label(ready ? 'VIEWER VS' : 'NO MATCH', 128, 14, ready ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.45)', 1.5), { dim: offline });
  },
  // game formats: the confirm key shows the score of the battle and lights up green when a result is waiting
  formatNext({ score = '', label: l = '', pending = false, done = false, none = false, offline = false } = {}) {
    const t = none ? 'NO FORMAT' : done ? 'FINISHED' : short(score || '—', 9);
    return frame(`<text x="72" y="${none || done ? 74 : 80}" ${FONT} font-size="${none || done ? 20 : fit(t, 5, 44, 22)}" font-weight="900" fill="${pending ? INK : '#fff'}" text-anchor="middle">${esc(t)}</text>`
      + (l ? `<text x="72" y="30" ${FONT} font-size="13" font-weight="700" fill="${pending ? INK : 'rgba(255,255,255,.6)'}" text-anchor="middle">${esc(short(l, 18))}</text>` : '')
      + label(pending ? 'CONFIRM ›' : 'NEXT MATCH', 128, 15, pending ? INK : 'rgba(255,255,255,.7)', 1.5), { bg: pending ? OKG : undefined, dim: offline });
  },
  // 1.12.5: the team formats' Player VS (the lock-in splash): lit while it's up
  // GlassVS (the lock-in VS; 1.12.5's Player VS) — any match since 1.12.6
  playerVs({ on = false, hint = '', offline = false } = {}) {
    return on
      ? frame(`<g transform="translate(30,8) scale(.6)">${ICONS.swords(INK)}</g>` + label('GLASSVS', 112, 16, INK, 1.5) + label(hint || 'ON AIR', 132, hint ? 10 : 12, INK, hint ? 1 : 2), { bg: BEE, dim: offline })
      : frame(`<g transform="translate(30,8) scale(.6)">${ICONS.swords('#fff')}</g>` + label('GLASSVS', 112, 16, '#fff', 1.5) + label(hint || 'SHOW', 132, hint ? 10 : 11, 'rgba(255,255,255,.55)', 1.5), { dim: offline });
  },
  // 1.12.5: Team Death Battle — lock in the fighters picked for this battle (closes the switch window)
  // 1.12.13: once locked (until the next set is recorded) the same key undoes it — PRESS TO UNDO
  formatLock({ open = false, none = false, undo = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,6) scale(.5)">${ICONS.lock(open ? '#fff' : undo ? BEE : '#5d616c')}</g>` + label(undo ? 'LOCKED' : 'LOCK IN', 112, 18, open || undo ? '#fff' : '#8d919d', 2)
      + label(none ? 'NO TEAM DEATH BATTLE' : open ? 'PICKS READY?' : undo ? 'PRESS TO UNDO' : 'LOCKED', 132, none ? 9 : 11, open || undo ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)', 1.2), { dim: offline });
  },
  // 1.12.16: run an automation (picked in the key's settings) — lit while it runs
  automation({ name = '', running = false, missing = false, offline = false } = {}) {
    const n = String(name || 'AUTOMATION').toUpperCase(), short = n.length > 13 ? n.slice(0, 12) + '…' : n;
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.flow(running ? INK : missing ? '#5d616c' : BEE)}</g>` + label(running ? 'RUNNING' : 'RUN', 112, 16, running ? INK : '#fff', 2)
      + label(missing ? 'PICK ONE' : short, 132, short.length > 10 ? 9 : 11, running ? 'rgba(14,16,23,.75)' : 'rgba(255,255,255,.65)', 1.2), { bg: running ? BEE : undefined, dim: offline });
  },
  // 1.12.16: mark a VOD chapter now — says MARKED for a moment
  chapter({ flash = '', offline = false } = {}) {
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.chapter(flash ? '#fff' : BEE)}</g>` + label(flash || 'CHAPTER', 112, flash ? 18 : 15, '#fff', 2) + label(flash ? 'IN THE VOD' : 'MARK NOW', 132, 10, 'rgba(255,255,255,.6)', 1.6), { dim: offline });
  },
  // 1.12.16: the caster stats card for one player — lit while it's on stream
  stats({ side = 1, name = '', on = false, offline = false } = {}) {
    const n = String(name || `PLAYER ${side}`).toUpperCase(), short = n.length > 12 ? n.slice(0, 11) + '…' : n;
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.statsCard(on ? INK : '#fff')}</g>` + label(on ? 'ON AIR' : 'STATS', 112, 16, on ? INK : '#fff', 2)
      + label(short, 132, short.length > 9 ? 10 : 12, on ? 'rgba(14,16,23,.75)' : 'rgba(255,255,255,.65)', 1.2), { bg: on ? BEE : undefined, dim: offline });
  },
  // 1.12.16: sponsors — tap: the next one now · hold: the rotation on / off
  sponsor({ on = false, none = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.sponsor(none ? '#5d616c' : on ? BEE : '#8d919d')}</g>` + label(none ? 'SPONSORS' : 'SPONSOR', 112, 15, none ? '#8d919d' : '#fff', 1.6)
      + label(none ? 'NONE ADDED' : on ? 'NEXT · HOLD: OFF' : 'OFF · HOLD: ON', 132, 9, 'rgba(255,255,255,.6)', 1.2), { dim: offline });
  },
  // 1.12.15: instant replay
  replay({ offline = false } = {}) {
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.replay(BEE)}</g>` + label('REPLAY', 112, 17, '#fff', 2) + label('FROM OBS', 132, 10, 'rgba(255,255,255,.6)', 1.6), { dim: offline });
  },
  // 1.12.15: Run of show — on/off, and what it's doing
  autopilot({ on = false, running = false, step = '', offline = false } = {}) {
    const S = { victory: 'VICTORY', 'after victory': 'VICTORY', stinger: 'STINGER', bracket: 'BRACKET', 'next match': 'NEXT MATCH', 'back to the scoreboard': 'SCOREBOARD', paused: 'PAUSED', done: 'WAITING' };
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.pilot(on ? BEE : '#5d616c')}</g>` + label(on ? 'AUTO ON' : 'AUTO OFF', 112, 15, on ? '#fff' : '#8d919d', 1.5)
      + label(on ? (running ? (S[step] || 'RUNNING') : (S[step] || 'WAITING')) : 'RUN OF SHOW', 132, 10, on ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)', 1.4), { dim: offline });
  },
  // 1.12.15: tap tempo — looks set to "On the beat" pulse with it; shows the tempo once it has one
  tempo({ bpm = 0, offline = false } = {}) {
    return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.tempo(bpm ? BEE : '#8d919d')}</g>` + label(bpm ? String(bpm) : 'TAP', 112, bpm ? 22 : 18, '#fff', bpm ? 1 : 2)
      + label(bpm ? 'BPM · TAP' : 'TEMPO', 132, 11, 'rgba(255,255,255,.6)', 1.6), { dim: offline });
  },
  // 1.12.14: its own key for taking a lock-in back (the Lock in key does it too, pressed again) — lit while there's one to undo
  formatUnlock({ ready = false, none = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,6) scale(.5)">${ICONS.unlock(ready ? BEE : '#5d616c')}</g>` + label('UNDO', 112, 18, ready ? '#fff' : '#8d919d', 2)
      + label(none ? 'NO TEAM DEATH BATTLE' : 'LOCK-IN', 132, none ? 9 : 12, ready ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)', 1.4), { dim: offline });
  },
  formatUndo({ ready = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,26) scale(.5)">${ICONS.undo(ready ? BEE : '#5d616c')}</g>` + label('UNDO', 110, 18, ready ? '#fff' : '#8d919d') + label('RESULT', 130, 13, 'rgba(255,255,255,.6)'), { dim: offline });
  },
  formatSplash({ kind = 'fboard', on = false, offline = false } = {}) {
    const t = { fvs: 'TEAM VS', fboard: 'BOARD', fwin: 'CHAMPION', flead: 'LEADERBOARD' }[kind] || 'BOARD', ic = { fvs: ICONS.swords, fboard: ICONS.board, fwin: ICONS.crown, flead: ICONS.leader }[kind] || ICONS.board;
    return frame(`<g transform="translate(32,10) scale(.56)">${ic(on ? INK : '#fff')}</g>` + label(on ? 'ON AIR' : t, 128, on ? 16 : t.length > 9 ? 12 : 15, on ? INK : '#fff', 2), { bg: on ? BEE : undefined, dim: offline });
  },
  // the format bar along the bottom of the layout (teams, survivors, challengers, standings): lit while on stream
  // Team Death Battle: put in the next fighter of one team (while the switch window is open)
  formatSwitch({ side = 1, open = false, none = false, name = '', lives = 0, max = 0, color = '', offline = false } = {}) {
    const c = /^#[0-9a-f]{6}$/i.test(color) ? color : side === 2 ? '#3fb6ff' : '#ff5a1f';
    const hexes = Array.from({ length: Math.min(6, max) }, (_, k) => { const x = 72 - (Math.min(6, max) - 1) * 10 + k * 20; return `<path d="M${x} 82l8 4.6v9.2l-8 4.6-8-4.6v-9.2z" fill="${k < lives ? c : 'none'}" stroke="${c}" stroke-width="2.4" opacity="${k < lives ? 1 : .45}"/>`; }).join('');
    const arrows = `<g transform="translate(40,14) scale(.44)">${ICONS.switchArrows(open ? '#fff' : '#7a7f8c', open ? c : '#5d616c')}</g>`;
    const lock = `<g transform="translate(44,14) scale(.4)">${ICONS.lock('#7a7f8c')}</g>`;
    return frame((none ? lock : open ? arrows : lock) + (none ? '' : hexes) + label(none ? 'NO TEAM DEATH BATTLE' : open ? (name || `P${side} SWITCH`) : `P${side} · ${name || 'LOCKED'}`, 128, none ? 11 : (name || '').length > 10 ? 13 : 16, '#fff', 1) + `<text x="56" y="22" ${FONT} font-size="12" font-weight="800" fill="${c}" text-anchor="middle" letter-spacing="1.5">${open ? `P${side} · SWITCH` : 'SWITCH'}</text>`, { accent: c, dim: offline });
  },
  formatBar({ on = false, kind = '', offline = false } = {}) {
    const t = { teams: 'TEAM BAR', elim: 'SURVIVORS', koth: 'CHALLENGERS', league: 'STANDINGS' }[kind] || 'FORMAT BAR';
    return frame(`<g transform="translate(26,4) scale(.64)">${ICONS.formatBar(on ? INK : '#fff')}</g>` + label(on ? 'ON AIR' : t, 126, on ? 16 : 14, on ? INK : '#fff', 2), { bg: on ? BEE : undefined, dim: offline });
  },
  // viewer tournament: signups (lit while open, with the count) and confirm & next match (green when a match is won)
  vtSignup({ open = false, count = 0, started = false, offline = false } = {}) {
    return frame((started ? `<g transform="translate(40,18) scale(.44)">${ICONS.trophy(open ? '#fff' : VT2)}</g>` : `<text x="72" y="70" ${FONT} font-size="44" font-weight="900" fill="${open ? '#fff' : VT2}" text-anchor="middle">${count}</text>`)
      + label(started ? 'STARTED' : open ? 'SIGN-UPS OPEN' : 'SIGN-UPS', 106, 13, '#fff', 1.5) + label(started ? 'BRACKET IS ON' : '!enter', 128, 13, 'rgba(255,255,255,.7)'), { bg: open ? VT : undefined, dim: offline });
  },
  vtNext({ now = '', won = false, done = false, champion = '', offline = false } = {}) {
    const bg = won ? '#1f9d55' : undefined;
    return frame((done ? `<g transform="translate(40,16) scale(.44)">${ICONS.trophy(BEE)}</g>` + label(champion || 'CHAMPION', 112, 15, '#fff')
      : `<g transform="translate(36,26) scale(.5)">${ICONS.next(won ? '#fff' : VT2)}</g>` + label(won ? 'CONFIRM ›' : 'NEXT MATCH', 106, 15, '#fff', 1.5) + label(short(now || 'NO MATCH YET', 20), 128, 11, 'rgba(255,255,255,.75)', 0)), { bg, dim: offline });
  },
  // viewer tournament: the "how to join" splash, and its bracket on stream
  vtJoin({ on = false, count = 0, open = false, ready = true, offline = false } = {}) {
    return on
      ? frame(`<g transform="translate(28,4) scale(.6)">${ICONS.ticket('#fff', '#fff')}</g>` + label('ON AIR', 104, 15, '#fff', 3) + label(`${count} IN`, 128, 13, 'rgba(255,255,255,.85)', 1), { bg: VT, dim: offline })
      : frame(`<g transform="translate(28,4) scale(.6)" opacity="${ready ? 1 : .45}">${ICONS.ticket('#fff')}</g>`
        + label('JOIN SPLASH', 110, 13, '#fff', 1.5) + label(ready ? (open ? `${count} IN · OPEN` : `${count} IN`) : 'NOT SET UP', 130, 11, 'rgba(255,255,255,.6)', 1), { dim: offline });
  },
  vtBracket({ on = false, ready = true, offline = false } = {}) {
    return on
      ? frame(`<g transform="translate(16,8) scale(.72)">${ICONS.bracket('#fff')}</g>` + label('ON AIR', 128, 16, '#fff', 3), { bg: VT, dim: offline })
      : frame(`<g transform="translate(16,8) scale(.72)">${ICONS.bracket(ready ? VT2 : '#5d616c')}</g>` + label(ready ? 'TOURNEY BRACKET' : 'NOT STARTED', 128, 12, ready ? '#fff' : '#8d919d', 1), { dim: offline });
  },
  // effects quality (1.11): the gauge and the level; pressing steps Auto → Full → Light → Ultra-light (or sets one)
  fxq({ q = 'auto', offline = false } = {}) {
    const name = { auto: 'AUTO', full: 'FULL', light: 'LIGHT', off: 'NO ENGINE', ultra: 'ULTRA-LIGHT' }[q] || 'AUTO', lit = q === 'ultra' ? '#35dc84' : q === 'full' ? '#ffb020' : '#29c6ff';
    return frame(`<g transform="translate(28,4) scale(.62)">${glyph('gauge', lit)}</g>` + label('EFFECTS', 112, 13, 'rgba(255,255,255,.65)', 2) + label(name, 134, name.length > 8 ? 14 : 17, '#fff'), { dim: offline });
  },
  // Refresh OBS (1.12): reloads every BeeboScore browser source in OBS; flashes DONE (or what went wrong) after a press
  obsRefresh({ flash = '', offline = false } = {}) {
    const ok = flash === 'DONE', bad = flash && !ok;
    return frame(`<g transform="translate(26,6) scale(.64)">${glyph('obsRefresh', bad ? '#ff5a5a' : ok ? '#35dc84' : '#29c6ff')}</g>` + label('REFRESH', 112, 15, '#fff', 2) + label(flash || 'OBS', 134, flash ? 13 : 15, bad ? '#ff8a8a' : ok ? '#7df0b0' : 'rgba(255,255,255,.65)', 2), { dim: offline });
  },
  // the BeeboScore key (1.12, bottom-right of the match section): connected or not, and whether the deck shows 1v1 or a format
  status({ offline = false, section = 'solo', format = '' } = {}) {
    const c = offline ? '#8d919d' : '#ffb020';
    return frame(`<text x="72" y="58" ${FONT} font-size="30" font-weight="900" fill="${c}" text-anchor="middle" letter-spacing="1">BEEBO</text>`
      + `<text x="72" y="84" ${FONT} font-size="17" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="4">SCORE</text>`
      + label(offline ? 'APP CLOSED' : section === 'solo' ? '1V1 KEYS' : short(format || 'FORMAT', 16), 124, 12, offline ? '#ff8a8a' : 'rgba(255,255,255,.7)', 1.5), { dim: offline });
  },
  // 1.12.8: "Everything, in pages" — turns the deck's page; shows where you are and what's next
  page({ page = 0, total = 2, name = '', next = '', offline = false } = {}) {
    const dots = Array.from({ length: total }, (_, i) => `<circle cx="${72 + (i - (total - 1) / 2) * 16}" cy="104" r="${i === page ? 5 : 3.5}" fill="${i === page ? '#ffb020' : 'rgba(255,255,255,.35)'}"/>`).join('');
    return frame(`<path d="M58 30 L86 54 L58 78" fill="none" stroke="#ffb020" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` + dots
      + label(short(name || 'PAGE', 12), 126, 12, '#fff', 1.5) + label(next ? '▸ ' + short(next, 10) : '', 20, 10, 'rgba(255,255,255,.6)', 1.5), { dim: offline });
  },
  blank() { return frame(''); },
  // stream sound: on/off (lit while on), or a louder / quieter key showing the level
  sound({ on = false, vol = 60, mode = 'toggle', offline = false } = {}) {
    if (mode === 'up' || mode === 'down') return frame(`<g transform="translate(26,14) scale(.64)">${ICONS.speaker(on ? BEE : '#8d919d', true)}</g>`
      + `<text x="118" y="64" ${FONT} font-size="40" font-weight="900" fill="${on ? '#fff' : '#8d919d'}" text-anchor="middle">${mode === 'up' ? '+' : '−'}</text>`
      + label(on ? vol + '%' : 'SOUND OFF', 126, on ? 22 : 15, on ? '#fff' : '#8d919d'), { dim: offline });
    return frame(`<g transform="translate(30,12) scale(.6)">${ICONS.speaker(on ? INK : '#8d919d', on)}</g>` + label(on ? 'SOUND ON' : 'SOUND OFF', 112, 16, on ? INK : '#fff') + label(on ? vol + '%' : 'STREAM', 134, 13, on ? INK : 'rgba(255,255,255,.6)'), { bg: on ? BEE : undefined, dim: offline });
  },
  screen({ name = '', on = false, missing = false, offline = false } = {}) {
    const t = short(name || 'Pick a screen', 22), words = t.split(' '), lines = [];
    for (const w of words) { if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 11) lines[lines.length - 1] += ' ' + w; else lines.push(w); }
    const ls = lines.slice(0, 2), ink = on ? INK : '#fff';
    return frame(`<g transform="translate(44,14) scale(.39)">${ICONS.screen(on ? INK : '#fff')}</g>`
      + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 100 : 90 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(l)}</text>`).join('')
      + label(missing ? 'NOT IN LAYOUT' : on ? 'ON AIR' : 'SCREEN', 134, 12, on ? INK : 'rgba(255,255,255,.65)', 1.5), { bg: on ? BEE : undefined, dim: offline || missing });
  },
  layout({ title = '', mode = 'next', offline = false } = {}) {
    const t = short(title || 'Layout', 22), words = t.split(' '), lines = [];
    for (const w of words) { if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 11) lines[lines.length - 1] += ' ' + w; else lines.push(w); }
    const ls = lines.slice(0, 2);
    return frame(`<g transform="translate(40,18) scale(.45)">${ICONS.layout(BEE)}</g>`
      + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 102 : 92 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join('')
      + label(mode === 'specific' ? 'LAYOUT' : 'NEXT LAYOUT ›', 134, 12, 'rgba(255,255,255,.65)', 1.5), { dim: offline });
  },
};

// 1.12.18: the show's keys — one shape: the glyph, a name, a line under it; lit (the group's colour) while it's on stream
art.show = ({ g, name, sub = '', on = false, offline = false, flash = '' } = {}) => {
  const big = flash || name, top = sub ? 4 : 10;
  return on
    ? frame(`<g transform="translate(30,${top}) scale(.58)">${ICONS[g](INK)}</g>` + label(big, sub ? 108 : 124, fit(big, 10, 16, 11), INK, 1.5) + (sub ? label(sub, 130, fit(sub, 14, 12, 9), 'rgba(14,16,23,.72)', .8) : ''), { bg: BEE, dim: offline })
    : frame(`<g transform="translate(30,${top}) scale(.58)">${ICONS[g]('#fff')}</g>` + label(big, sub ? 108 : 124, fit(big, 10, 16, 11), '#fff', 1.5) + (sub ? label(sub, 130, fit(sub, 14, 12, 9), 'rgba(255,255,255,.55)', .8) : ''), { dim: offline });
};
// White-on-transparent glyphs for the Stream Deck action list (20×20 / 40×40).
const listIcon = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">${inner}</svg>`;
const LIST = Object.fromEntries(Object.entries({
  score: 'plus1', reset: 'reset', swap: 'swap', undo: 'undo', nextmatch: 'next', clear: 'clear', layout: 'layout', screen: 'screen',
  fswitch: 'switchArrows', fnext: 'confirm', fundo: 'undo', fsplash: 'swords', fbar: 'formatBar', playervs: 'swords', vsstyle: 'switchArrows', comm: 'mic', flock: 'lock', funlock: 'unlock', tempo: 'tempo', autopilot: 'pilot', replay: 'replay', automation: 'flow', chapter: 'chapter', stats: 'statsCard', sponsor: 'sponsor', player: 'person', vtopen: 'personPlus', vtnext: 'next', sound: 'speaker', fxq: 'gauge', obsrefresh: 'obsRefresh', hideall: 'hideAll', slot: 'layout', stinger: 'bolt',
  bracket: 'bracket', bracketrefresh: 'pull', victory: 'trophy', bracketside: 'sides', latency: 'eye', viewernext: 'chatNext', viewerresult: 'plus1',
  viewerqueue: 'queue', viewersidebar: 'sidebar', viewersplash: 'vs',
  sggreport: 'upload', postlink: 'chatLink', standings: 'podium', top8: 'top8', vs: 'vs', loser: 'loser', vtjoin: 'ticket', vtbracket: 'bracket',
  rundown: 'rundown', countdown: 'countdown', schedule: 'schedule', walkin: 'walkin', storyline: 'storyline', evstats: 'evstats', season: 'season', rehearsal: 'rehearsal', replayslow: 'slowmo', replayfreeze: 'freeze', drawclear: 'drawClear',
  clip: 'clip', results: 'results', picks: 'picks', poll: 'poll', twpred: 'twpred', music: 'music', duck: 'duck', ext: 'ext',      // 1.12.18
  cdplus: 'cdPlus',                                                                                                   // 1.12.19
  moments: 'moments', momentreplay: 'momentReplay', h2h: 'h2h', settimer: 'setTimer',                                   // 1.12.21
  statsstrip: 'statsStrip', greset: 'gresetSplash',                                                                    // 1.12.23
}).map(([k, g]) => [k, listIcon(glyph(g))]));

// ---------------------------------------------------------------- groups: every key shows which part of the app it belongs to
// (Stream Deck lists a plugin's actions under one heading, so the groups are told apart by name, order and colour)
const GROUPS = {
  match: { color: '#ffb020', name: 'Match' }, stream: { color: '#29c6ff', name: 'Stream' }, bracket: { color: '#4f7dff', name: 'Bracket' },
  format: { color: '#ff6a1a', name: 'Format' }, vt: { color: '#9d5cff', name: 'Viewer tournament' }, vm: { color: '#ff5fa2', name: 'Viewer matches' },
  show: { color: '#b6f03a', name: 'The show' },          // 1.12.18: rundown, screens, replays, viewers
};
const GROUP_OF = {
  score: 'match', player: 'match', loser: 'match', swap: 'match', reset: 'match', undo: 'match', clear: 'match', vs: 'match', playervs: 'match', vsstyle: 'match', victory: 'match',
  moments: 'match', momentreplay: 'match', h2h: 'match', settimer: 'match',      // 1.12.21: the set as it's told
  statsstrip: 'match', greset: 'match',                                           // 1.12.23: the splashes tell the story
  layout: 'stream', screen: 'stream', comm: 'stream', sound: 'stream', latency: 'stream', fxq: 'stream', obsrefresh: 'stream', hideall: 'stream', stinger: 'stream', tempo: 'stream', autopilot: 'stream', replay: 'stream', automation: 'stream', chapter: 'stream', stats: 'stream', sponsor: 'stream',
  nextmatch: 'bracket', bracket: 'bracket', top8: 'bracket', standings: 'bracket', bracketside: 'bracket', bracketrefresh: 'bracket', sggreport: 'bracket', postlink: 'bracket',
  fnext: 'format', fundo: 'format', fsplash: 'format', fbar: 'format', fswitch: 'format', flock: 'format', funlock: 'format',
  vtopen: 'vt', vtjoin: 'vt', vtbracket: 'vt', vtnext: 'vt',
  viewernext: 'vm', viewerresult: 'vm', viewerqueue: 'vm', viewersplash: 'vm', viewersidebar: 'vm',
  rundown: 'show', countdown: 'show', schedule: 'show', walkin: 'show', storyline: 'show', evstats: 'show', season: 'show', rehearsal: 'show', replayslow: 'show', replayfreeze: 'show', drawclear: 'show',
  clip: 'show', results: 'show', picks: 'show', poll: 'show', twpred: 'show', music: 'show', duck: 'show', ext: 'show', cdplus: 'show',
};
const FORMAT_NAMES = { crew: 'CREW BATTLE', sajam: 'TEAM BATTLE', gauntlet: 'GAUNTLET', death: 'DEATH BATTLE', koth: 'KING OF THE HILL', league: 'LEAGUE', tdb: 'TEAM DEATH BATTLE' };
/** 1.12.17 — the keys, redrawn. Every key is a tile of dark glass with its group's colour round the edge, a soft light of that
 * colour rising from below, the group's badge (Designer-made: a star, a screen, bracket lines, a hexagon, a controller, a chat
 * bubble) in a disc at the top right, and — for the format and viewer-tournament keys — a pill naming what it works on.
 * A key that's on air turns into a lit tile of its group's colour (and gets a slow shine, see shine()); one that can't be used
 * right now is greyed out with the reason (disabled()). start.gg keys (blue, bracket lines) never look like viewer-tournament
 * keys (violet, controller). */
const hexRgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, k) => '#' + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
function grouped(svg, action, tag = '') {
  if (!svg) return svg;
  const gk = GROUP_OF[action], g = GROUPS[gk];
  if (!g) return svg.split(MAIN).join('#fff').split(SOFT).join('#fff');
  // lit = the key's own background is a colour (on air), not the dark one: BEE means "the group's colour", green (a result
  // to confirm) stays green, and a key with a colour of its own (a losers mark in red, a posted link) keeps it
  const bgM = svg.match(/<rect width="144" height="144" fill="(#[0-9a-fA-F]{6})"\/>/), bg = bgM ? bgM[1].toLowerCase() : '';
  const lum = bg ? hexRgb(bg).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0) / 255 : 0;
  const lit = lum > .16, hot = bg === OKG, litC = !lit ? '' : bg === BEE ? (gk === 'match' ? BEE : null) : bg;
  svg = svg.split(MAIN).join(mixHex(g.color, '#ffffff', .3)).split(SOFT).join(g.color);
  const c = g.color, top = mixHex(c, '#ffffff', .28), deep = mixHex(c, '#000000', .38), id = `k${gk}${hot ? 'h' : lit ? 'l' + (litC || '').slice(1) : 'd'}`;   // ids unique per look (pictures drawn side by side share one page)
  // the tile: dark glass (or, on air, lit in the group's colour — green stays green: a result waiting to be confirmed)
  const face = lit
    ? (hot ? `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5df0a0"/><stop offset="1" stop-color="#1fa862"/></linearGradient></defs>`
           : `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${litC ? mixHex(litC, '#ffffff', .22) : top}"/><stop offset="1" stop-color="${litC ? mixHex(litC, '#000000', .3) : deep}"/></linearGradient></defs>`)
      + `<rect width="144" height="144" fill="#07080c"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}f)"/><rect x="3" y="3" width="138" height="66" rx="22" fill="#ffffff" fill-opacity=".14"/>`
    : `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f2b"/><stop offset="1" stop-color="#0a0b11"/></linearGradient>`
      + `<radialGradient id="${id}g" cx=".5" cy="1.1" r=".85"><stop offset="0" stop-color="${c}" stop-opacity=".42"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>`
      + `<rect width="144" height="144" fill="#07080c"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}f)"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}g)"/>`
      + `<rect x="5" y="5" width="134" height="40" rx="20" fill="#ffffff" fill-opacity=".045"/>`;
  svg = svg.replace(/<rect width="144" height="144" fill="[^"]*"\/>/, face);
  const edge = `<rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="${lit ? '#ffffff' : c}" stroke-opacity="${lit ? .5 : .62}" stroke-width="2.5"/>`;
  const badge = `<circle cx="124" cy="20" r="13" fill="${lit ? '#0e1017' : c}" fill-opacity="${lit ? .55 : 1}"/>` + `<g transform="translate(-4,8)">${(DA['b.' + gk] || '').replace(/^<g transform="translate\(110 0\)">.*?<\/g>/, '').split('#0e1017').join(lit ? c : '#0e1017')}</g>`;
  const t = short(tag, 18);
  const pill = tag ? `<rect x="7" y="8" width="${Math.min(100, 12 + t.length * 6.2).toFixed(0)}" height="18" rx="9" fill="${lit ? '#0e1017' : c}" fill-opacity="${lit ? .55 : .95}"/><text x="${(7 + Math.min(100, 12 + t.length * 6.2) / 2).toFixed(0)}" y="21" ${FONT} font-size="${fit(t, 13, 10.5, 7.5)}" font-weight="900" fill="${lit ? c : '#0e1017'}" text-anchor="middle" letter-spacing=".4">${esc(t)}</text>` : '';
  return svg.replace(/<rect width="144" height="10" fill="[^"]*"\/>/, '').replace(/<\/svg>$/, edge + pill + badge + `<!--sb:${hot ? 'hot' : lit ? 'lit' : 'idle'}-->` + '</svg>');
}
const inner = svg => String(svg).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const reid = (x, p) => x.replace(/id="([\w-]+)"/g, `id="${p}$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${p}$1)`).replace(/href="#([\w-]+)"/g, `href="#${p}$1"`);
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`;
/** a key that can't be used right now (no format running, no tournament, nobody has won yet…): greyed out, and why */
function disabled(svg, reason = '') {
  const r = short(String(reason || 'NOT NOW').toUpperCase(), 18);
  return wrap(`<g opacity=".3">${inner(svg)}</g><rect x="3" y="3" width="138" height="138" rx="22" fill="#0b0c11" fill-opacity=".45"/><rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="#5d616c" stroke-opacity=".7" stroke-width="2" stroke-dasharray="7 6"/>`
    + `<rect x="10" y="${116 - 4}" width="124" height="24" rx="12" fill="#1c1f28" stroke="#3b3f4b" stroke-width="1.5"/><text x="72" y="${116 + 12}" ${FONT} font-size="${fit(r, 13, 12, 8)}" font-weight="900" fill="#9aa0ad" text-anchor="middle" letter-spacing=".6">${esc(r)}</text><!--sb:off-->`);
}
/** the change from one key picture to another, e (0 → 1): the old one lifts away and fades, the new one rises in */
function blend(a, b, e) {
  const k = e * e * (3 - 2 * e), up = (1 - k) * 12, s = .92 + .08 * k;
  return wrap(`<g opacity="${(1 - k).toFixed(3)}" transform="translate(0,${(-k * 12).toFixed(1)})">${reid(inner(a), 'o')}</g>`
    + `<g opacity="${k.toFixed(3)}" transform="translate(${(72 * (1 - s)).toFixed(2)},${(72 * (1 - s) + up).toFixed(2)}) scale(${s.toFixed(3)})">${inner(b)}</g>`);
}
/** a lit key's shine: a soft diagonal band of light that sweeps across it (phase 0 → 1), and a breathing edge */
function shine(svg, phase, hot = false) {
  const x = -90 + phase * 330, glow = .35 + .35 * Math.sin(phase * Math.PI * 2);
  return wrap(inner(svg) + `<defs><linearGradient id="ksh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${hot ? .5 : .32}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`
    + `<g transform="translate(${x.toFixed(1)},0) skewX(-18)"><rect x="0" y="3" width="44" height="138" fill="url(#ksh)"/></g>`
    + `<rect x="3" y="3" width="138" height="138" rx="22" fill="none" stroke="#ffffff" stroke-opacity="${glow.toFixed(2)}" stroke-width="3"/>`);
}
/** pressed: the key gives a little under your finger */
const pressed = svg => wrap(`<rect width="144" height="144" fill="#07080c"/><g transform="translate(5.04,5.04) scale(.93)">${inner(svg)}</g>`);
const stateOf = svg => { const m = /<!--sb:(\w+)-->/.exec(svg || ''); return m ? m[1] : 'idle'; };
/** the action-list icon in its group's colour */
const tinted = (svg, action) => { const g = GROUPS[GROUP_OF[action]], c = g ? g.color : '#fff'; return svg.split(MAIN).join(c).split(SOFT).join(c).replace(/#fff\b/g, c); };

const dataUrl = svg => 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg);
module.exports = { art, LIST, dataUrl, P1, P2, BEE, GROUPS, GROUP_OF, FORMAT_NAMES, grouped, tinted, disabled, blend, shine, pressed, stateOf };
