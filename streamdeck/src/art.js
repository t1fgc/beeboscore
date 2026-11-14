'use strict';
/*
 * Key artwork for the BeeboScore Stream Deck plugin. Every key is drawn as a 144×144 SVG so it
 * can show live data (names, scores, on/off). Also used by build.js to write the static images.
 */
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

const { ICONS } = require('./icons');

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
  reset: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.reset('#fff')}</g>` + label('RESET'), { accent: BEE, dim: offline }),
  swap: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.swap('#fff')}</g>` + label('SWAP'), { accent: BEE, dim: offline }),
  undo: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.undo('#fff')}</g>` + label('UNDO'), { accent: BEE, dim: offline }),
  nextmatch: ({ offline, label: l } = {}) => frame(`<g transform="translate(6,-12) scale(.92)">${ICONS.next(BEE)}</g>` + label(l || 'NEXT MATCH', 130, 15), { dim: offline }),
  clear: ({ offline } = {}) => frame(`<g transform="translate(14,2) scale(.8)">${ICONS.clear('#fff')}</g>` + label('NEXT SET', 130, 16), { accent: BEE, dim: offline }),
  vs({ on = false, offline = false } = {}) {
    return on
      ? frame(`<text x="72" y="92" ${FONT} font-size="74" font-weight="900" font-style="italic" fill="${INK}" text-anchor="middle">VS</text>` + label('ON AIR', 128, 16, INK, 3), { bg: BEE, dim: offline })
      : frame(`<text x="72" y="92" ${FONT} font-size="74" font-weight="900" font-style="italic" fill="none" stroke="#fff" stroke-width="3" text-anchor="middle">VS</text>` + label('VS SPLASH', 128, 15, 'rgba(255,255,255,.7)', 2), { dim: offline });
  },
  player({ side = 1, name = '', offline = false } = {}) {
    const c = sideColor(side), n = short(name || 'Set name', 12);
    return frame(`<g transform="translate(36,14) scale(.5)">${ICONS.person('#fff')}</g>`
      + `<text x="72" y="104" ${FONT} font-size="${fit(n, 8, 22, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text>`
      + label(`PLAYER ${side} ✎`, 132, 13, 'rgba(255,255,255,.7)', 1.5), { accent: c, dim: offline });
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
    const bubble = `<path d="M24 30h96a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H62l-22 18v-18H24a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" fill="${flash ? '#fff' : ready ? C : '#2b2d36'}"/>`;
    const link = `<g fill="none" stroke="${flash ? C : '#fff'}" stroke-width="7" stroke-linecap="round"><path d="M60 70l24-24"/><path d="M52 62l-6 6a10 10 0 0 0 14 14l6-6"/><path d="M92 54l6-6a10 10 0 0 0-14-14l-6 6"/></g>`;
    return frame(bubble + link + label(flash ? 'POSTED' : ready ? 'POST LINK' : 'NOT SHARED', 132, ready ? 15 : 12, ready || flash ? '#fff' : 'rgba(255,255,255,.45)', 1.5), { bg: '#0a0a0e', accent: ready ? C : null, dim: offline });
  },
  sggReport({ ready = false, sent = false, mode = 'ask', offline = false, flash = false } = {}) {
    const C = '#3f8cff', on = ready || sent;
    const arrow = `<g fill="none" stroke="${flash || sent ? '#fff' : on ? C : 'rgba(255,255,255,.4)'}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M72 84V30"/><path d="M50 52l22-22 22 22"/><path d="M34 76v20h76V76"/></g>`;
    return frame(arrow + label(flash ? 'SENT!' : sent ? 'REPORTED' : ready ? 'REPORT' : mode === 'off' ? 'REPORTS OFF' : 'NO RESULT', 132, on ? 15 : 12, on ? '#fff' : 'rgba(255,255,255,.45)', 1.5), { bg: sent ? '#1c4fa8' : '#0a0a0e', accent: ready && !sent ? C : null, dim: offline });
  },
  standings({ on = false, ready = false, offline = false } = {}) {
    const GOLD = '#f2c14e';
    const bars = [[52, 40, 1], [16, 62, 2], [88, 74, 3]].map(([x, y, n]) => `<rect x="${x}" y="${y}" width="36" height="${108 - y}" fill="${on ? '#fff' : n === 1 ? GOLD : '#3a3d48'}" opacity="${on ? (n === 1 ? 1 : .7) : 1}"/><text x="${x + 18}" y="${y + 26}" ${FONT} font-size="22" font-weight="900" fill="${on ? '#5a0812' : n === 1 ? '#2a1a04' : '#fff'}" text-anchor="middle">${n}</text>`).join('');
    return frame(bars + label(on ? 'ON AIR' : ready ? 'STANDINGS' : 'NO RESULTS', 132, ready || on ? 15 : 12, on ? '#fff' : ready ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.45)', 1.5),
      { bg: on ? '#c3132d' : '#0a0a0e', accent: on ? null : GOLD, dim: offline });
  },
  top8({ on = false, offline = false, label: l } = {}) {
    const CR = '#e0263f';
    const body = `<g transform="translate(30,34) scale(.8)" opacity="${on ? .4 : .95}">${ICONS.bolt(on ? '#fff' : '#c9d4ff')}</g>`
      + `<text x="58" y="44" ${FONT} font-size="26" font-weight="900" font-style="italic" fill="${on ? '#fff' : '#e8eaf0'}" text-anchor="middle" letter-spacing="3">TOP</text>`
      + `<text x="58" y="108" ${FONT} font-size="76" font-weight="900" font-style="italic" fill="${on ? '#fff' : CR}" text-anchor="middle">8</text>`
      + label(on ? 'ON AIR' : (l || 'SPLASH'), 132, l && !on ? 13 : 16, on ? '#fff' : 'rgba(255,255,255,.7)', on ? 3 : (l ? 1 : 2));
    const bg = on ? '' : `<defs><radialGradient id="t8g" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#5a0812"/><stop offset="1" stop-color="#0a0a0e"/></radialGradient></defs><rect width="144" height="144" fill="url(#t8g)"/>`;
    return frame(bg + body, { bg: on ? CR : '#0a0a0e', accent: on ? null : CR, dim: offline });
  },
  loser({ side = 1, on = false, offline = false } = {}) {
    const c = sideColor(side);
    return frame(`<text x="72" y="90" ${FONT} font-size="66" font-weight="900" fill="${on ? INK : '#fff'}" text-anchor="middle">[L]</text>`
      + label(`PLAYER ${side}`, 128, 15, on ? INK : 'rgba(255,255,255,.7)', 2), { bg: on ? c : INK, accent: on ? null : c, dim: offline });
  },
  // ---- viewer matches (Twitch Stuff)
  viewerNext({ next = '', count = 0, busy = false, offline = false } = {}) {
    const n = short(next || '', 12);
    return frame(`<g transform="translate(10,22) scale(.22)">${ICONS.twitch(TW2)}</g><text x="132" y="44" ${FONT} font-size="26" font-weight="900" fill="#fff" text-anchor="end">${count}</text>`
      + `<g transform="translate(46,40) scale(.36)">${ICONS.next('#fff')}</g>`
      + `<text x="72" y="110" ${FONT} font-size="${n ? fit(n, 9, 19, 12) : 14}" font-weight="800" fill="${n ? '#fff' : 'rgba(255,255,255,.55)'}" text-anchor="middle">${esc(n || 'QUEUE EMPTY')}</text>`
      + label(busy ? 'LOADING…' : 'NEXT VIEWER', 132, 13, TW2, 1.5), { accent: TW, dim: offline });
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
      : frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="rgba(255,255,255,.7)" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="38" font-weight="900" fill="#fff" text-anchor="middle">CLOSED</text>` + label(count ? `${count} WAITING` : 'TAP TO OPEN', 130, 13, 'rgba(255,255,255,.6)', 1.5), { accent: TW, dim: offline });
  },
  // ---- Autoscore (experimental)
  autoscore({ on = false, state = 'off', pending = null, offline = false } = {}) {
    const eye = c => `<circle cx="72" cy="56" r="30" fill="none" stroke="${c}" stroke-width="7"/><circle cx="72" cy="56" r="11" fill="${c}"/>`;
    if (!on) return frame(eye('rgba(255,160,160,.75)') + label('AUTO OFF', 116, 16, '#ffb3b3', 2) + label('EXPERIMENTAL', 134, 10, 'rgba(255,200,200,.6)', 1.5), { bg: '#4a0d14', dim: offline });
    if (pending) return frame(eye(INK) + label('CONFIRM?', 116, 17, INK, 2) + label(short(pending.name, 12).toUpperCase(), 134, 11, INK, 1), { bg: BEE, dim: offline });
    const armed = state === 'armed';
    return frame(eye(armed ? INK : '#fff') + label(armed ? 'WATCHING' : state === 'waiting' ? 'WAIT 0–0' : 'STARTING', 116, 15, armed ? INK : '#fff', 1.5) + label('AUTO ON', 134, 11, armed ? INK : OKG, 2), { bg: armed ? OKG : '#0f3b24', dim: offline });
  },
  autoscoreUndo({ ready = false, offline = false } = {}) {
    return frame(`<g transform="translate(18,6) scale(.75)" opacity="${ready ? 1 : .4}">${ICONS.undo('#fff')}</g>` + label('UNDO AUTO', 126, 14, ready ? '#fff' : 'rgba(255,255,255,.5)', 1.5), { accent: OKG, dim: offline });
  },
  autoscoreConfirm({ pending = null, offline = false } = {}) {
    return pending
      ? frame(`<text x="72" y="74" ${FONT} font-size="54" font-weight="900" fill="${INK}" text-anchor="middle">+1</text>` + label(short(pending.name, 11).toUpperCase(), 108, 15, INK, 1) + label('TAP TO ADD', 132, 12, INK, 1.5), { bg: BEE, dim: offline })
      : frame(`<text x="72" y="80" ${FONT} font-size="54" font-weight="900" fill="rgba(255,255,255,.35)" text-anchor="middle">+1</text>` + label('NOTHING TO OK', 126, 12, 'rgba(255,255,255,.55)', 1), { accent: BEE, dim: offline });
  },
  autoscoreResync({ offline = false } = {}) {
    return frame(`<g transform="translate(22,4) scale(.7)">${ICONS.refresh('#fff')}</g>` + label('RESYNC', 126, 15, '#fff', 2), { accent: OKG, dim: offline });
  },
  viewerSidebar({ on = true, offline = false } = {}) {
    const bar = c => `<rect x="30" y="22" width="26" height="76" rx="3" fill="${c}"/><rect x="62" y="30" width="54" height="10" rx="3" fill="${c}" opacity=".5"/><rect x="62" y="48" width="54" height="10" rx="3" fill="${c}" opacity=".5"/><rect x="62" y="66" width="54" height="10" rx="3" fill="${c}" opacity=".5"/>`;
    return on
      ? frame(bar('#fff') + label('ON SCREEN', 128, 15, '#fff', 2), { bg: TW, dim: offline })
      : frame(`<g opacity=".45">${bar('#fff')}</g>` + label('SIDEBAR OFF', 128, 13, 'rgba(255,255,255,.7)', 1.5), { accent: TW, dim: offline });
  },
  viewerSplash({ on = false, ready = true, offline = false } = {}) {
    return on
      ? frame(`<text x="72" y="92" ${FONT} font-size="70" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>` + label('ON AIR', 128, 16, '#fff', 3), { bg: TW, dim: offline })
      : frame(`<text x="72" y="92" ${FONT} font-size="70" font-weight="900" font-style="italic" fill="none" stroke="${ready ? TW2 : 'rgba(255,255,255,.35)'}" stroke-width="3" text-anchor="middle">VS</text>` + label(ready ? 'VIEWER VS' : 'NO MATCH', 128, 14, 'rgba(255,255,255,.7)', 2), { accent: TW, dim: offline });
  },
  // game formats: the confirm key shows the score of the battle and lights up green when a result is waiting
  formatNext({ score = '', label: l = '', pending = false, done = false, none = false, offline = false } = {}) {
    const t = none ? 'NO FORMAT' : done ? 'FINISHED' : short(score || '—', 9);
    return frame(`<text x="72" y="${none || done ? 74 : 80}" ${FONT} font-size="${none || done ? 20 : fit(t, 5, 44, 22)}" font-weight="900" fill="${pending ? INK : '#fff'}" text-anchor="middle">${esc(t)}</text>`
      + (l ? `<text x="72" y="30" ${FONT} font-size="13" font-weight="700" fill="${pending ? INK : 'rgba(255,255,255,.6)'}" text-anchor="middle">${esc(short(l, 18))}</text>` : '')
      + label(pending ? 'CONFIRM ›' : 'NEXT MATCH', 128, 15, pending ? INK : 'rgba(255,255,255,.7)', 1.5), { bg: pending ? OKG : undefined, dim: offline });
  },
  formatUndo({ ready = false, offline = false } = {}) {
    return frame(`<g transform="translate(36,26) scale(.5)">${ICONS.undo(ready ? BEE : '#5d616c')}</g>` + label('UNDO', 110, 18, ready ? '#fff' : '#8d919d') + label('RESULT', 130, 13, 'rgba(255,255,255,.6)'), { dim: offline });
  },
  formatSplash({ kind = 'fboard', on = false, offline = false } = {}) {
    const t = { fvs: 'TEAM VS', fboard: 'BOARD', fwin: 'CHAMPION' }[kind] || 'BOARD', ic = { fvs: '⚔', fboard: '☰', fwin: '🏆' }[kind] || '☰';
    return frame(`<text x="72" y="82" ${FONT} font-size="54" font-weight="900" fill="${on ? INK : BEE}" text-anchor="middle">${ic}</text>` + label(on ? 'ON AIR' : t, 128, on ? 16 : 15, on ? INK : '#fff', 2), { bg: on ? BEE : undefined, dim: offline });
  },
  // the format bar along the bottom of the layout (teams, survivors, challengers, standings): lit while on stream
  overlay({ hidden = false, offline = false } = {}) {     // the whole overlay on / hidden (downtime)
    const eye = `<path d="M72 34C46 34 28 54 22 64c6 10 24 30 50 30s44-20 50-30C116 54 98 34 72 34z" fill="none" stroke="${hidden ? '#fff' : BEE}" stroke-width="7" stroke-linejoin="round"/>`
      + (hidden ? `<path d="M30 26l84 76" stroke="#fff" stroke-width="8" stroke-linecap="round"/>` : `<circle cx="72" cy="64" r="16" fill="${BEE}"/>`);
    return frame(eye + label(hidden ? 'HIDDEN' : 'OVERLAY ON', 128, hidden ? 18 : 14, '#fff', 2), { bg: hidden ? '#c2302b' : undefined, dim: offline });
  },
  // Team Death Battle: put in the next fighter of one team (while the switch window is open)
  formatSwitch({ side = 1, open = false, none = false, name = '', lives = 0, max = 0, color = '', offline = false } = {}) {
    const c = /^#[0-9a-f]{6}$/i.test(color) ? color : side === 2 ? '#3fb6ff' : '#ff5a1f';
    const hexes = Array.from({ length: Math.min(6, max) }, (_, k) => { const x = 72 - (Math.min(6, max) - 1) * 10 + k * 20; return `<path d="M${x} 82l8 4.6v9.2l-8 4.6-8-4.6v-9.2z" fill="${k < lives ? c : 'none'}" stroke="${c}" stroke-width="2.4" opacity="${k < lives ? 1 : .45}"/>`; }).join('');
    const arrows = `<g fill="none" stroke="${open ? '#fff' : '#7a7f8c'}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M40 40h52l-12-12M104 60H52l12 12"/></g>`;
    const lock = `<g fill="none" stroke="#7a7f8c" stroke-width="6"><rect x="52" y="38" width="40" height="30" rx="5"/><path d="M60 38v-8a12 12 0 0 1 24 0v8"/></g>`;
    return frame((none ? lock : open ? arrows : lock) + (none ? '' : hexes) + label(none ? 'NO TEAM DEATH BATTLE' : open ? (name || `P${side} SWITCH`) : `P${side} · ${name || 'LOCKED'}`, 128, none ? 11 : (name || '').length > 10 ? 13 : 16, '#fff', 1) + `<text x="72" y="24" ${FONT} font-size="13" font-weight="800" fill="${c}" text-anchor="middle" letter-spacing="2">${open ? `P${side} · SWITCH` : 'SWITCH'}</text>`, { accent: c, dim: offline });
  },
  formatBar({ on = false, kind = '', offline = false } = {}) {
    const t = { teams: 'TEAM BAR', elim: 'SURVIVORS', koth: 'CHALLENGERS', league: 'STANDINGS' }[kind] || 'FORMAT BAR';
    const c = on ? INK : BEE;
    const bars = `<rect x="22" y="78" width="100" height="18" rx="2" fill="${c}"/><rect x="50" y="64" width="44" height="32" rx="2" fill="${c}"/>`
      + `<rect x="26" y="81" width="18" height="12" fill="${on ? BEE : '#111'}"/><rect x="100" y="81" width="18" height="12" fill="${on ? BEE : '#111'}"/>`
      + `<path d="M58 28h28l-14 22z" fill="${on ? INK : '#fff'}" transform="${on ? 'rotate(180 72 39)' : ''}"/>`;
    return frame(bars + label(on ? 'ON AIR' : t, 126, on ? 16 : 14, on ? INK : '#fff', 2), { bg: on ? BEE : undefined, dim: offline });
  },
  // viewer tournament: signups (lit while open, with the count) and confirm & next match (green when a match is won)
  vtSignup({ open = false, count = 0, started = false, offline = false } = {}) {
    return frame(`<text x="72" y="66" ${FONT} font-size="44" font-weight="900" fill="${open ? INK : BEE}" text-anchor="middle">${started ? '🏆' : count}</text>`
      + label(started ? 'BRACKET ON' : open ? 'SIGNUPS OPEN' : 'SIGNUPS', 104, 13, open ? INK : '#fff', 1.5) + label('!enter', 128, 13, open ? INK : 'rgba(255,255,255,.55)'), { bg: open ? BEE : undefined, dim: offline });
  },
  vtNext({ now = '', won = false, done = false, champion = '', offline = false } = {}) {
    const bg = won ? '#1f9d55' : undefined;
    return frame((done ? `<text x="72" y="70" ${FONT} font-size="46" font-weight="900" fill="${BEE}" text-anchor="middle">🏆</text>` + label(champion || 'CHAMPION', 112, 15, '#fff')
      : ICONS.next(won ? '#fff' : BEE) + label(won ? 'CONFIRM' : 'NEXT', 112, 15, '#fff') + label(now || 'VIEWER MATCH', 132, 11, 'rgba(255,255,255,.7)')), { bg, dim: offline });
  },
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
    return frame(`<g transform="translate(44,14) scale(.39)">${ICONS.layout(on ? INK : BEE)}</g>`
      + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 100 : 90 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(l)}</text>`).join('')
      + label(missing ? 'NOT IN LAYOUT' : on ? 'ON AIR' : 'SCREEN', 134, 12, on ? INK : 'rgba(255,255,255,.65)', 1.5), { bg: on ? BEE : undefined, dim: offline || missing });
  },
  // Hide all splashes: everything full-screen goes (VS, Victory, the format's Board / Team VS / Champion); the scoreboard stays
  hideAll({ any = false, offline = false } = {}) {
    const panes = `<rect x="30" y="24" width="72" height="50" rx="5" fill="none" stroke="${any ? '#fff' : 'rgba(255,255,255,.45)'}" stroke-width="6"/><rect x="44" y="38" width="72" height="50" rx="5" fill="${any ? '#c2302b' : INK}" stroke="${any ? '#fff' : 'rgba(255,255,255,.45)'}" stroke-width="6"/>`
      + `<path d="M66 50l28 26M94 50L66 76" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="${any ? 1 : .5}"/>`;
    return frame(panes + label(any ? 'HIDE ALL' : 'NOTHING UP', 124, any ? 16 : 13, any ? '#fff' : 'rgba(255,255,255,.55)', 2) + label('SPLASHES', 140, 10, 'rgba(255,255,255,.55)', 2), { accent: any ? '#c2302b' : '#555a66', dim: offline });
  },
  // Team Death Battle: close the switch window (both teams have picked)
  formatLock({ open = false, none = false, offline = false } = {}) {
    const c = open ? '#fff' : '#7a7f8c';
    const lock = `<g fill="none" stroke="${c}" stroke-width="8" stroke-linejoin="round"><rect x="44" y="56" width="56" height="42" rx="6" fill="${open ? c : 'none'}"/><path d="M56 56V44a16 16 0 0 1 32 0v12"/></g>`;
    return frame(lock + label(none ? 'NO TEAM DEATH BATTLE' : open ? 'LOCK IN' : 'LOCKED', 128, none ? 11 : 17, open ? '#fff' : 'rgba(255,255,255,.6)', 1.5), { dim: offline });
  },
  // a forfeit for one side (hold the key: it can't be pressed by accident)
  formatForfeit({ side = 1, name = '', none = false, offline = false } = {}) {
    const c = sideColor(side);
    const flag = `<path d="M44 26v92" stroke="${none ? '#5d616c' : '#fff'}" stroke-width="7" stroke-linecap="round"/><path d="M48 30h52l-10 16 10 16H48z" fill="${none ? '#5d616c' : '#fff'}"/>`;
    return frame(flag + `<text x="72" y="102" ${FONT} font-size="${fit(short(name || `PLAYER ${side}`, 12), 9, 17, 11)}" font-weight="800" fill="${none ? '#8d919d' : c}" text-anchor="middle">${esc(short(name || `PLAYER ${side}`, 12).toUpperCase())}</text>`
      + label(none ? 'FORFEIT' : 'HOLD · FORFEIT', 128, 12, 'rgba(255,255,255,.7)', 1), { accent: c, dim: offline });
  },
  // the running format, in its colour (or "Normal match")
  formatBadge({ name = '', color = '', offline = false } = {}) {
    const words = String(name || 'NORMAL MATCH').split(' '), lines = [];
    for (const w of words) { if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 9) lines[lines.length - 1] += ' ' + w; else lines.push(w); }
    const c = color || '#8d919d', ls = lines.slice(0, 3), y0 = 78 - (ls.length - 1) * 13;
    return frame(`<rect y="10" width="144" height="134" fill="${c}" opacity=".16"/>` + ls.map((l, i) => `<text x="72" y="${y0 + i * 26}" ${FONT} font-size="${fit(l, 8, 24, 14)}" font-weight="900" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join('')
      + label(color ? 'FORMAT' : 'NO FORMAT', 134, 11, color || 'rgba(255,255,255,.55)', 2.5), { accent: c, dim: offline });
  },
  blank: ({ offline = false } = {}) => frame('', { bg: '#0a0b10', dim: offline }),
  // reload the overlay in OBS (the browser source starts clean; through the OBS link the fresh copy fades in)
  refresh({ busy = false, offline = false } = {}) {
    return frame(`<g transform="translate(22,4) scale(.7)">${ICONS.refresh(busy ? BEE : '#fff')}</g>` + label(busy ? 'REFRESHING' : 'REFRESH', 118, busy ? 14 : 17, '#fff', 2) + label('OBS', 138, 11, 'rgba(255,255,255,.6)', 3), { accent: SYNC, dim: offline });
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

// White-on-transparent glyphs for the Stream Deck action list (20×20 / 40×40).
const listIcon = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">${inner}</svg>`;
const LIST = {
  score: listIcon(`<text x="72" y="104" ${FONT} font-size="88" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
  reset: listIcon(ICONS.reset('#fff')), swap: listIcon(ICONS.swap('#fff')), undo: listIcon(ICONS.undo('#fff')),
  nextmatch: listIcon(ICONS.next('#fff')), clear: listIcon(ICONS.clear('#fff')), layout: listIcon(ICONS.layout('#fff')), screen: listIcon(ICONS.layout('#fff') + `<circle cx="112" cy="112" r="18" fill="#fff"/>`),
  fswitch: listIcon('<g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M26 54h86l-20-20M118 92H32l20 20"/></g>'),
  fnext: listIcon(ICONS.next('#fff')), fundo: listIcon(ICONS.undo('#fff')), fsplash: listIcon(`<text x="72" y="104" ${FONT} font-size="84" font-weight="900" fill="#fff" text-anchor="middle">⚔</text>`),
  player: listIcon(ICONS.person('#fff')), vtopen: listIcon(ICONS.person('#fff') + `<text x="112" y="130" ${FONT} font-size="44" font-weight="900" fill="#fff" text-anchor="middle">+</text>`), vtnext: listIcon(ICONS.next('#fff')), sound: listIcon(ICONS.speaker('#fff')), fbar: listIcon('<rect x="18" y="84" width="108" height="26" rx="3" fill="#fff"/><rect x="48" y="64" width="48" height="46" rx="3" fill="#fff"/>'),
  bracket: listIcon(ICONS.bracket('#fff')),
  bracketrefresh: listIcon(ICONS.pull('#fff')),
  victory: listIcon(ICONS.trophy('#fff')),
  bracketside: listIcon(`<rect x="10" y="34" width="56" height="76" rx="8" fill="#fff"/><text x="38" y="88" ${FONT} font-size="46" font-weight="900" font-style="italic" fill="#000" text-anchor="middle">W</text><rect x="78" y="34" width="56" height="76" rx="8" fill="none" stroke="#fff" stroke-width="8"/><text x="106" y="88" ${FONT} font-size="46" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">L</text>`),
  latency: listIcon(ICONS.eye('#fff')),
  viewernext: listIcon(`<g transform="translate(0,0) scale(.55)">${ICONS.twitch('#fff')}</g><g transform="translate(52,40) scale(.62)">${ICONS.next('#fff')}</g>`),
  viewerresult: listIcon(`<text x="72" y="104" ${FONT} font-size="76" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
  viewerqueue: listIcon(`<rect x="24" y="30" width="96" height="18" rx="5" fill="#fff"/><rect x="24" y="63" width="96" height="18" rx="5" fill="#fff" opacity=".75"/><rect x="24" y="96" width="96" height="18" rx="5" fill="#fff" opacity=".5"/>`),
  autoscore: listIcon(`<circle cx="72" cy="72" r="40" fill="none" stroke="#fff" stroke-width="10"/><circle cx="72" cy="72" r="15" fill="#fff"/>`),
  autoscoreundo: listIcon(ICONS.undo('#fff')),
  autoscoreconfirm: listIcon(`<text x="72" y="100" ${FONT} font-size="76" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
  autoscoreresync: listIcon(ICONS.refresh('#fff')),
  viewersidebar: listIcon(`<rect x="26" y="24" width="34" height="96" rx="5" fill="#fff"/><rect x="70" y="34" width="50" height="14" rx="4" fill="#fff" opacity=".6"/><rect x="70" y="60" width="50" height="14" rx="4" fill="#fff" opacity=".6"/><rect x="70" y="86" width="50" height="14" rx="4" fill="#fff" opacity=".6"/>`),
  viewersplash: listIcon(`<text x="72" y="100" ${FONT} font-size="76" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>`),
  sggreport: listIcon('<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M72 88V28"/><path d="M48 52l24-24 24 24"/><path d="M30 80v24h84V80"/></g>'),
  overlay: listIcon('<path d="M72 34C46 34 28 54 22 64c6 10 24 30 50 30s44-20 50-30C116 54 98 34 72 34z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="72" cy="64" r="15" fill="#fff"/>'),
  postlink: listIcon('<path d="M24 30h96a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H62l-22 18v-18H24a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" fill="#fff"/>'),
  standings: listIcon('<rect x="54" y="34" width="36" height="76" fill="#fff"/><rect x="14" y="58" width="36" height="52" fill="#fff" opacity=".7"/><rect x="94" y="72" width="36" height="38" fill="#fff" opacity=".5"/>'),
  top8: listIcon(ICONS.bolt('#fff') + `<text x="66" y="100" ${FONT} font-size="62" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">8</text>`),
  vs: listIcon(`<text x="72" y="100" ${FONT} font-size="80" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>`),
  refresh: listIcon(ICONS.refresh('#fff')),
  hideall: listIcon('<rect x="18" y="20" width="84" height="60" rx="6" fill="none" stroke="#fff" stroke-width="9"/><rect x="42" y="44" width="84" height="60" rx="6" fill="#000" stroke="#fff" stroke-width="9"/><path d="M70 60l28 28M98 60L70 88" stroke="#fff" stroke-width="9" stroke-linecap="round"/>'),
  slot: listIcon('<rect x="14" y="14" width="50" height="50" rx="8" fill="#fff"/><rect x="80" y="14" width="50" height="50" rx="8" fill="#fff" opacity=".6"/><rect x="14" y="80" width="50" height="50" rx="8" fill="#fff" opacity=".6"/><rect x="80" y="80" width="50" height="50" rx="8" fill="none" stroke="#fff" stroke-width="9"/>'),
  loser: listIcon(`<text x="72" y="100" ${FONT} font-size="72" font-weight="900" fill="#fff" text-anchor="middle">[L]</text>`),
};

// A format key wears the running format's colour: a frame round the key and a corner flag, so a glance at the deck
// tells you which format it is set up for (the same colours as the Matches tab in the app)
function tint(svg, color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return svg;
  const t = `<g data-fmt="${color}"><rect x="3.5" y="3.5" width="137" height="137" rx="8" fill="none" stroke="${color}" stroke-width="7"/><path d="M144 0v34L110 0z" fill="${color}"/></g>`;
  return svg.replace(/<\/svg>$/, t + '</svg>');
}
const dataUrl = svg => 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg);
// 1.4: the keys BeeboScore Prototype puts on the deck have new pictures (keys.js)
Object.assign(art, require('./keys').keys);
module.exports = { art, LIST, dataUrl, tint, P1, P2, BEE, ICONS };
