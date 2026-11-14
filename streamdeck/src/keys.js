'use strict';
/*
 * BeeboScore Prototype: the key pictures (1.4). Every key is a 144×144 SVG.
 *
 * Built to be read at a glance from a stream chair:
 *   - each kind of key has its own background colour, so the deck reads as blocks:
 *       scores = the player's colour · match keys = graphite · splashes = deep plum · OBS = teal ·
 *       next match / start.gg = forest green / slate · format keys = the format's own colour
 *   - one big picture in the top two thirds, one word or two underneath in a large, plain face (no spaced capitals)
 *   - a small second line only when the key does something else when held
 *   - on stream = the key turns bright (the splash's own colour) and says "On air"
 */
const { ICONS } = require('./icons');

const FONT = "font-family=\"'Segoe UI Variable Display','Segoe UI','Helvetica Neue',Arial,sans-serif\"";
const C = {
  p1: '#c8263f', p2: '#1f5fd1', match: '#262a35', plum: '#35204d', teal: '#0d4f5a', go: '#17603f', slate: '#2c3550',
  ink: '#0b0c10', amber: '#ffb11f', gold: '#f3bd2f', pink: '#ff4f8b', red: '#b8262c', mint: '#3ddc84', dim: 'rgba(255,255,255,.55)',
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const fit = (t, max, big, small) => { const n = String(t).length; return n <= max ? big : Math.max(small, Math.round(big * max / n)); };
const side = s => (Number(s) === 2 ? C.p2 : C.p1);
/** a colour mixed towards black: the background of a format key */
function deep(hex, k = .62) {
  const n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = v => Math.round(v * (1 - k) + 11 * k);
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function key(inner, { bg = C.match, stripe = null, offline = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
    + `<rect width="144" height="144" fill="${bg}"/>`
    + `<rect width="144" height="144" fill="url(#sh)"/><defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>`
    + (stripe ? `<rect width="144" height="9" fill="${stripe}"/>` : '')
    + inner
    + (offline ? `<rect width="144" height="144" fill="rgba(0,0,0,.66)"/><text x="72" y="80" ${FONT} font-size="20" font-weight="700" fill="#ff9a9a" text-anchor="middle">Offline</text>` : '')
    + `</svg>`;
}
// the word(s) under the picture, and the small "hold" line
const word = (t, { y = null, size = 23, fill = '#fff', hint = false } = {}) => {
  const s = fit(t, 9, size, 15);
  return `<text x="72" y="${y || (hint ? 112 : 122)}" ${FONT} font-size="${s}" font-weight="700" fill="${fill}" text-anchor="middle">${esc(t)}</text>`;
};
const hint = (t, fill = 'rgba(255,255,255,.72)') => `<text x="72" y="134" ${FONT} font-size="13.5" font-weight="600" fill="${fill}" text-anchor="middle">${esc(t)}</text>`;
const pic = (svg, { s = .5, y = 10 } = {}) => `<g transform="translate(${72 - 72 * s},${y}) scale(${s})">${svg}</g>`;

const keys = {
  // ---- scores: the player's colour all over, the name on top, the score huge
  score({ side: sd = 1, name = '', score = 0, mode = 'tapHold', offline = false } = {}) {
    const n = short(name || `Player ${sd}`, 12), sc = String(score);
    return key(`<text x="72" y="31" ${FONT} font-size="${fit(n, 9, 21, 13)}" font-weight="700" fill="#fff" text-anchor="middle">${esc(n)}</text>`
      + `<text x="72" y="${sc.length > 1 ? 104 : 108}" ${FONT} font-size="${sc.length > 1 ? 70 : 84}" font-weight="800" fill="#fff" text-anchor="middle">${esc(sc)}</text>`
      + hint(mode === 'subtract' ? 'tap −1' : mode === 'add' ? 'tap +1' : 'hold −1', 'rgba(255,255,255,.8)'),
    { bg: side(sd), offline });
  },
  // ---- match keys: graphite, white pictures
  undo({ result = false, ready = true, offline = false } = {}) {
    return key(pic(ICONS.undo(result ? C.amber : '#fff'), { s: .52, y: 8 }) + word('Undo', { hint: result }) + (result ? hint('the result', C.amber) : ''), { bg: C.match, offline });
  },
  reset({ offline = false } = {}) {
    return key(pic(ICONS.reset('#fff'), { s: .5, y: 8 }) + word('Reset', { hint: true }) + hint('hold: new set'), { bg: C.match, offline });
  },
  swap({ offline = false } = {}) { return key(pic(ICONS.swap('#fff'), { s: .55, y: 6 }) + word('Swap', { hint: true }) + hint('sides'), { bg: C.match, offline }); },
  clear({ offline = false } = {}) { return key(pic(ICONS.clear('#fff'), { s: .46, y: 12 }) + word('New set', { hint: true }) + hint('clears players'), { bg: C.match, offline }); },
  loser({ side: sd = 1, on = false, offline = false } = {}) {
    return key(`<text x="72" y="82" ${FONT} font-size="62" font-weight="800" fill="${on ? '#fff' : side(sd)}" text-anchor="middle">[L]</text>`
      + word(`Player ${sd}`, { hint: true, size: 20 }) + hint(on ? 'losers side' : 'tap: losers'), { bg: on ? side(sd) : C.match, offline });
  },
  player({ side: sd = 1, name = '', offline = false } = {}) {
    const n = short(name || 'Pick name', 12);
    return key(pic(ICONS.person('#fff'), { s: .38, y: 14 }) + word(n, { hint: true, size: 21 }) + hint(`set player ${sd}`), { bg: C.slate, stripe: side(sd), offline });
  },
  // ---- splashes: deep plum; bright with "On air" while up
  vs({ on = false, team = false, fc = '', offline = false } = {}) {
    const t = `<text x="72" y="${team ? 74 : 80}" ${FONT} font-size="${team ? 58 : 66}" font-weight="900" font-style="italic" fill="${on ? C.ink : 'none'}" stroke="${on ? 'none' : '#fff'}" stroke-width="3.2" text-anchor="middle">VS</text>`;
    return key(t + word(on ? 'On air' : team ? 'Team VS' : 'VS splash', { hint: true, size: 21, fill: on ? C.ink : '#fff' }) + hint(team ? 'both teams' : 'intro', on ? 'rgba(11,12,16,.7)' : undefined),
      { bg: on ? C.pink : team && fc ? deep(fc) : C.plum, stripe: team && fc && !on ? fc : null, offline });
  },
  victory({ on = false, ready = false, champion = false, fc = '', offline = false } = {}) {
    const lit = on ? C.ink : ready || champion ? C.gold : 'rgba(243,189,47,.4)';
    return key(pic(ICONS.trophy(lit), { s: .52, y: 4 }) + word(on ? 'On air' : champion ? 'Champion' : 'Victory', { hint: true, size: 21, fill: on ? C.ink : ready || champion ? '#fff' : C.dim })
      + hint(champion ? 'format winner' : ready ? 'set winner' : 'no winner yet', on ? 'rgba(11,12,16,.7)' : undefined),
    { bg: on ? C.gold : champion && fc ? deep(fc) : C.plum, stripe: champion && fc && !on ? fc : null, offline });
  },
  hideAll({ any = false, offline = false } = {}) {
    const panes = `<rect x="22" y="14" width="76" height="52" rx="7" fill="none" stroke="#fff" stroke-width="7" opacity="${any ? 1 : .45}"/>`
      + `<rect x="46" y="34" width="76" height="52" rx="7" fill="${any ? C.red : C.plum}" stroke="#fff" stroke-width="7" opacity="${any ? 1 : .45}"/>`
      + `<path d="M70 46l28 28M98 46L70 74" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="${any ? 1 : .45}"/>`;
    return key(`<g transform="translate(14,6) scale(.8)">${panes}</g>` + word('Hide all', { hint: true, size: 22, fill: any ? '#fff' : C.dim }) + hint(any ? 'splashes up' : 'nothing up'), { bg: any ? '#5a1622' : C.plum, offline });
  },
  // ---- OBS: teal
  overlay({ hidden = false, offline = false } = {}) {
    const eye = `<path d="M72 22C44 22 26 44 18 56c8 12 26 34 54 34s46-22 54-34C118 44 100 22 72 22z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>`
      + (hidden ? `<path d="M28 14l88 84" stroke="#fff" stroke-width="8" stroke-linecap="round"/>` : `<circle cx="72" cy="56" r="17" fill="#fff"/>`);
    return key(`<g transform="translate(18,6) scale(.75)">${eye}</g>` + word(hidden ? 'Hidden' : 'Overlay', { hint: true, size: 22 }) + hint(hidden ? 'tap to show' : 'on in OBS'), { bg: hidden ? C.red : C.teal, offline });
  },
  refresh({ busy = false, offline = false } = {}) {
    return key(pic(ICONS.refresh(busy ? C.amber : '#fff'), { s: .5, y: 8 }) + word(busy ? 'Refreshing' : 'Refresh', { hint: true, size: busy ? 19 : 22 }) + hint('OBS overlay'), { bg: C.teal, offline });
  },
  layout({ title = '', mode = 'next', offline = false } = {}) {
    const t = short(title || 'Layout', 11);
    return key(pic(ICONS.layout('#fff'), { s: .4, y: 14 }) + word(t, { hint: true, size: 21 }) + hint(mode === 'specific' ? 'layout' : 'next layout'), { bg: C.teal, offline });
  },
  // ---- next match / start.gg
  nextmatch({ offline = false, label = '' } = {}) {
    const none = /start\.gg/i.test(label) && /no/i.test(label);
    return key(pic(ICONS.next('#fff'), { s: .5, y: 10 }) + word(label === 'LOADING…' ? 'Loading' : 'Next match', { hint: true, size: 20 }) + hint(none ? 'no start.gg' : 'from start.gg'),
      { bg: none ? C.match : C.go, offline });
  },
  sggReport({ ready = false, sent = false, mode = 'ask', offline = false } = {}) {
    const on = ready || sent;
    const up = `<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? 1 : .45}"><path d="M72 70V18"/><path d="M50 40l22-22 22 22"/><path d="M34 62v20h76V62"/></g>`;
    return key(`<g transform="translate(14,8) scale(.8)">${up}</g>` + word(sent ? 'Reported' : 'Report', { hint: true, size: 22, fill: on ? '#fff' : C.dim }) + hint(ready ? 'send to start.gg' : mode === 'off' ? 'reports off' : 'no result yet'), { bg: sent ? '#1e4fa3' : C.slate, offline });
  },
  bracketRefresh({ busy = false, label = '', offline = false } = {}) {
    const done = label === 'UPDATED';
    return key(pic(ICONS.pull(busy ? C.amber : done ? C.mint : '#fff'), { s: .46, y: 10 }) + word(busy ? 'Syncing' : done ? 'Updated' : 'Get results', { hint: true, size: 20 }) + hint('start.gg'), { bg: C.slate, offline });
  },
  // ---- game formats: the format's own colour (deep), with a stripe of the bright colour on top
  formatNext({ score = '', label: l = '', pending = false, done = false, none = false, fc = '', offline = false } = {}) {
    const t = none ? '' : done ? 'Done' : short(score || '—', 7);
    const body = pending
      ? pic(ICONS.next(C.ink), { s: .44, y: 12 }) + word('Confirm', { hint: true, size: 22, fill: C.ink }) + hint('& next match', 'rgba(11,12,16,.75)')
      : `<text x="72" y="74" ${FONT} font-size="${fit(t, 5, 50, 24)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(t)}</text>` + word('Next', { hint: true, size: 20 }) + hint(none ? 'no format' : done ? 'format over' : 'confirm when won');
    return key(body, { bg: pending ? C.mint : fc ? deep(fc) : C.match, stripe: !pending && fc ? fc : null, offline });
  },
  formatUndo({ ready = false, fc = '', offline = false } = {}) {
    return key(pic(ICONS.undo(ready ? '#fff' : 'rgba(255,255,255,.4)'), { s: .5, y: 8 }) + word('Undo', { hint: true }) + hint('the result'), { bg: fc ? deep(fc) : C.match, stripe: fc || null, offline });
  },
  formatSplash({ kind = 'fboard', on = false, fc = '', offline = false } = {}) {
    const name = { fvs: 'Team VS', fboard: 'Board', fwin: 'Champion' }[kind] || 'Board';
    const g = kind === 'fwin' ? pic(ICONS.trophy(on ? C.ink : '#fff'), { s: .5, y: 6 })
      : kind === 'fvs' ? `<text x="72" y="74" ${FONT} font-size="58" font-weight="900" font-style="italic" fill="${on ? C.ink : 'none'}" stroke="${on ? 'none' : '#fff'}" stroke-width="3" text-anchor="middle">VS</text>`
        : `<g fill="${on ? C.ink : '#fff'}"><rect x="34" y="22" width="76" height="12" rx="3"/><rect x="34" y="42" width="76" height="12" rx="3" opacity=".8"/><rect x="34" y="62" width="76" height="12" rx="3" opacity=".6"/></g>`;
    return key(g + word(on ? 'On air' : name, { hint: true, size: 22, fill: on ? C.ink : '#fff' }) + hint(kind === 'fboard' ? 'teams & lives' : 'splash', on ? 'rgba(11,12,16,.7)' : undefined),
      { bg: on ? (fc || C.amber) : fc ? deep(fc) : C.plum, stripe: !on && fc ? fc : null, offline });
  },
  formatBar({ on = false, kind = '', fc = '', offline = false } = {}) {
    const g = `<g fill="${on ? C.ink : '#fff'}"><rect x="20" y="58" width="104" height="18" rx="3"/><rect x="50" y="42" width="44" height="34" rx="3" opacity=".75"/></g><path d="M58 14h28l-14 20z" fill="${on ? C.ink : '#fff'}"/>`;
    return key(g + word(on ? 'Bar on' : 'Bar off', { hint: true, size: 22, fill: on ? C.ink : '#fff' }) + hint('format bar', on ? 'rgba(11,12,16,.7)' : undefined),
      { bg: on ? (fc || C.amber) : fc ? deep(fc) : C.match, stripe: !on && fc ? fc : null, offline });
  },
  formatSwitch({ side: sd = 1, open = false, none = false, name = '', lives = 0, max = 0, color = '', fc = '', offline = false } = {}) {
    const c = /^#[0-9a-f]{6}$/i.test(color) ? color : side(sd);
    const gems = Array.from({ length: Math.min(6, max) }, (_, k) => { const x = 72 - (Math.min(6, max) - 1) * 11 + k * 22; return `<path d="M${x} 66l9 5v10l-9 5-9-5V71z" fill="${k < lives ? c : 'none'}" stroke="${c}" stroke-width="2.6" opacity="${k < lives ? 1 : .5}"/>`; }).join('');
    const arrows = `<g fill="none" stroke="${open ? '#fff' : 'rgba(255,255,255,.4)'}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M38 22h56l-12-12M106 44H50l12 12"/></g>`;
    return key((none ? '' : arrows + gems) + word(none ? 'Switch' : short(name || `Team ${sd}`, 11), { hint: true, size: 20 }) + hint(none ? 'Team Death Battle' : open ? `send in · team ${sd}` : `team ${sd} · locked`),
      { bg: open ? deep(c, .45) : fc ? deep(fc) : C.match, stripe: c, offline });
  },
  formatLock({ open = false, none = false, fc = '', offline = false } = {}) {
    const g = `<g fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round" opacity="${open ? 1 : .45}"><rect x="44" y="38" width="56" height="40" rx="6" fill="${open ? '#fff' : 'none'}"/><path d="M56 38V28a16 16 0 0 1 32 0v10"/></g>`;
    return key(`<g transform="translate(0,6)">${g}</g>` + word(open ? 'Lock in' : 'Locked', { hint: true, size: 22, fill: open ? '#fff' : C.dim }) + hint(none ? 'Team Death Battle' : 'both teams picked'), { bg: fc ? deep(fc) : C.match, stripe: fc || null, offline });
  },
  formatForfeit({ side: sd = 1, name = '', none = false, fc = '', offline = false } = {}) {
    const flag = `<path d="M46 14v66" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="${none ? .4 : 1}"/><path d="M50 18h50l-10 15 10 15H50z" fill="${side(sd)}" opacity="${none ? .4 : 1}"/>`;
    return key(flag + word(short(name || `Player ${sd}`, 11), { hint: true, size: 20, fill: none ? C.dim : '#fff' }) + hint('hold: forfeit'), { bg: fc ? deep(fc) : C.match, stripe: side(sd), offline });
  },
  formatBadge({ name = '', color = '', offline = false } = {}) {
    const words = String(name || 'Normal match').toLowerCase().split(' ').map((w, i) => (i && ['of', 'the'].includes(w) ? w : w[0].toUpperCase() + w.slice(1))), lines = [];
    for (const w of words) { if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= 9) lines[lines.length - 1] += ' ' + w; else lines.push(w); }
    const ls = lines.slice(0, 3), y0 = 70 - (ls.length - 1) * 13;
    return key(ls.map((l, i) => `<text x="72" y="${y0 + i * 27}" ${FONT} font-size="${fit(l, 8, 25, 15)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join('')
      + hint(color ? 'tap: board' : 'no format'), { bg: color ? deep(color, .5) : C.match, stripe: color || null, offline });
  },
  blank: ({ offline = false } = {}) => key('', { bg: '#08090c', offline }).replace(/<rect width="144" height="144" fill="url\(#sh\)"\/>.*?<\/defs>/, ''),
};

module.exports = { keys, C, deep };
