/* BeeboScore (developed by Beebo), 1.5.5 (1.5.9: Obsidian Glass's new colours) — your colours for the app's own layouts (Classic and Obsidian Glass).
 *
 * Nine colours, each one a part of the look: the bars, the splash background, the edges, the lettering, the small
 * lettering, the accent, player 1, player 2 and the effects. Each layout family has its own nine (BASE below); every
 * colour the layout draws with belongs to one of them (KNOWN, or the nearest of the nine). When you change one, every
 * colour that belongs to it moves with it, keeping its shade: a darker edge of the bars stays that much darker than
 * your bar colour, a brighter spark stays that much brighter than your effect colour. Shapes, lettering and moves
 * don't change. Colours you leave alone stay as the layout has them.
 *
 * One file for both sides: server.js require()s it to recolour a layout's design before the page goes out, and the
 * overlay page loads it as /sb-colours.js so the splashes drawn by script (FullVS, the game-format bar and splashes,
 * the design engine's own sparks and glows) follow too: window.SBColours.map(css) / .as(role, colour, anchor).
 */
(function (root) {
  'use strict';
  const ROLES = ['plates', 'backdrop', 'edges', 'text', 'subtext', 'accent', 'p1', 'p2', 'effects'];
  const LABELS = { plates: 'Bars', backdrop: 'Splash background', edges: 'Edges', text: 'Lettering', subtext: 'Small lettering', accent: 'Accent', p1: 'Player 1', p2: 'Player 2', effects: 'Effects' };
  const BASE = {
    Classic: { plates: '#1c2030', backdrop: '#0a0b10', edges: '#333a50', text: '#eef1f7', subtext: '#8b93a7', accent: '#e9c35e', p1: '#ff3b5c', p2: '#3b8eff', effects: '#ff5a1f' },
    // 1.5.9: Obsidian Glass's new design. Its players share the gold, so Player 1 and Player 2 start as the
    // accent and colour that player's own pieces when you pick them (SIDED below)
    'Obsidian Glass': { plates: '#171511', backdrop: '#030304', edges: '#4a4030', text: '#ece4d2', subtext: '#8f8878', accent: '#e0a93b', p1: '#e0a93b', p2: '#e0a93b', effects: '#f0c766' },
  };
  // the families whose player colours are the accent on that player's pieces (a piece's side, or a name that starts 1P / 2P)
  const SIDED = { 'Obsidian Glass': true };
  // every colour each family's designs use (and the splash scripts draw with), and the part it belongs to
  const KNOWN = {
    Classic: { plates: ['#1c2030', '#151822', '#10121a', '#07080c', '#05060a', '#141210', '#17181d', '#0b0c0f'], backdrop: ['#0a0b10', '#050507'], edges: ['#333a50', '#252a3a', '#3a3d48'],
      text: ['#eef1f7', '#d9dce4'], subtext: ['#8b93a7', '#5d6579', '#8d919d'], accent: ['#e9c35e', '#f6c453', '#f3d98c', '#fff3cc', '#8a6a12'], p1: ['#ff3b5c'], p2: ['#3b8eff'],
      effects: ['#ff5a1f', '#ffb36b', '#ff3b14', '#ffb020', '#ff6a1a', '#ff6a2a', '#ffd0a0', '#ffe0a0'] },
    // (1.5.9: the layouts' own colours, and the ones the splash scripts still draw Obsidian with)
    'Obsidian Glass': { plates: ['#171511', '#33302a', '#0b0a08', '#030304', '#090806', '#2e2b25', '#25221d', '#211f1a', '#211c12', '#28251e', '#1d1b16', '#1f1d18', '#100f0c',
        '#0c0b09', '#0d0b07', '#0d0c0a', '#0e0d0a', '#07070a', '#2b1c04', '#1c1303', '#3a2405', '#040404', '#030303', '#0b0b0d', '#2b2112', '#100c06', '#060504', '#22190a'],
      backdrop: ['#050507', '#1d160b', '#07070b', '#22190b', '#020203', '#2e2108', '#120e07', '#18120a', '#070605'],
      edges: ['#4a4030', '#6e4a0e', '#3a3d48', '#4f4636', '#8c6416', '#5a4824', '#2a261d', '#8a6a2c', '#4a3f2a'],
      text: ['#ece4d2', '#d9dce4', '#e9ecf0', '#f3ede0', '#f8f3e6', '#f2ebdb', '#f4eedf', '#fff6de'],
      subtext: ['#8f8878', '#a39b88', '#b9ad92', '#c2b393', '#cfc2a2', '#d4c7a6', '#7d7462', '#a8814a'],
      accent: ['#e0a93b', '#ffe2a1', '#f6dc96', '#fff0c6', '#d9a33c', '#c4881f', '#ffe9b4', '#ffd65a', '#fff6d6', '#8a5a12', '#f8e2a6', '#c98f26'],
      p1: [], p2: [], effects: ['#f0c766', '#ff5a1f', '#ffc95e', '#f0b84c'] },
  };

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  function hex2rgb(h) {
    let s = String(h || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3,4}$/i.test(s)) s = s.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return null;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  function rgb2hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2rgb([h, s, l]) {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  /** c moved the way `from` moves to `to`, keeping its shade (hue, saturation and lightness offsets) */
  function shift(c, from, to) {
    const C = rgb2hsl(c), F = rgb2hsl(from), T = rgb2hsl(to);
    // a grey has no hue to keep an offset from, and a colour far round the wheel from the part's own isn't a shade of it:
    // both simply take your hue (only small offsets, like a warmer gold beside the gold, are kept)
    let dh = C[0] - F[0]; dh -= Math.round(dh);                   // −0.5…0.5 of a turn
    const h = (F[1] < .12 || C[1] < .06 || Math.abs(dh) > 30 / 360) ? T[0] : T[0] + dh;
    const s = clamp(T[1] + (C[1] - F[1]) * (T[1] < .1 ? .2 : 1));
    const l = clamp(T[2] + (C[2] - F[2]));
    return hsl2rgb([h, s, l]);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // how bright a colour looks (WCAG relative luminance), and how far apart two are (1–21)
  const relLum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const contrastOf = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const lighter = (a, b) => (relLum(a) >= relLum(b) ? a : b);
  const isWB = c => (c[0] === 255 && c[1] === 255 && c[2] === 255) || (c[0] === 0 && c[1] === 0 && c[2] === 0);

  /** the colour engine for one family and your colours: { on, role(rgb), shiftAs(role, rgb, anchorRgb?), map(str), as(role, c, anchor) } */
  function make(family, user) {
    const base = BASE[family], known = {}, mine = {}, skip = new Set();
    if (!base) return { on: false, map: s => s, as: (r, c) => c, ink: s => s, role: () => '', family };
    for (const [r, list] of Object.entries(KNOWN[family] || {})) for (const h of list) known[h.toLowerCase()] = r;
    for (const r of ROLES) { const u = hex2rgb(user && user[r]); if (u && rgb2hex(u) !== base[r].toLowerCase()) { mine[r] = u; skip.add(rgb2hex(u)); } }
    const on = Object.keys(mine).length > 0;
    const B = Object.fromEntries(ROLES.map(r => [r, hex2rgb(base[r])]));
    function role(c) {
      if (!c || isWB(c)) return '';
      const k = known[rgb2hex(c)]; if (k) return k;
      let best = '', bd = 56; for (const r of ROLES) { const d = dist(c, B[r]); if (d < bd) { bd = d; best = r; } }
      return best;
    }
    function shiftAs(r, c, anchor) { if (!mine[r]) return c; return shift(c, anchor || B[r], mine[r]); }
    // on a light look (your lettering dark), white lettering drawn by script would vanish: opaque white turns into your
    // lettering colour there. See-through whites (glints, sheens) stay white.
    const lumOf = c => (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255;
    const whiteIsText = !!mine.text && lumOf(mine.text) < .5;
    const made = new Set();                 // colours this has already produced: never moved a second time (map() can meet them again)
    // a shade that comes out pure white is kept a hair off it (#fffefe): the white in the code is the one that turns into your
    // lettering, and a white this made must never be taken for it on a second pass
    const keep = o => { let h = rgb2hex(o); if (h === '#ffffff') { o = [255, 254, 254]; h = '#fffefe'; } made.add(h); return o; };
    function one(c) {
      const hx = rgb2hex(c); if (skip.has(hx) || made.has(hx)) return c;
      const r = whiteIsText && hx === '#ffffff' ? 'text' : role(c); if (!r || !mine[r]) return c;
      return keep(shift(c, B[r], mine[r]));
    }
    const RX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+\s*)?\)/g;
    function map(str) {
      if (!on || typeof str !== 'string') return str;
      return str.replace(RX, (m, r, g, b, a) => {
        if (m[0] === '#') {
          const body = m.slice(1), alpha = body.length === 8 ? body.slice(6) : '', c = hex2rgb(body.slice(0, body.length === 8 ? 6 : body.length));
          if (!c || (alpha && alpha.toLowerCase() !== 'ff' && isWB(c))) return m; const o = one(c); return o === c ? m : rgb2hex(o) + alpha;
        }
        const c = [+r, +g, +b]; if (a && parseFloat(a.replace(/[,\s]/g, '')) < 1 && isWB(c)) return m;
        const o = one(c); if (o === c) return m;
        const n = o.map(v => Math.round(clamp(v, 0, 255)));
        return a ? `rgba(${n[0]},${n[1]},${n[2]}${a.replace(/\s+/g, '')})` : `rgb(${n[0]},${n[1]},${n[2]})`;
      });
    }
    /** a colour the script draws with, as part `r` (anchor: the colour that stands for that part in the code) */
    function as(r, c, anchor) {
      if (!on || !mine[r] || typeof c !== 'string') return c;
      const rgb = hex2rgb(c); if (!rgb) return map(c);
      const o = rgb2hex(keep(shiftAs(r, rgb, anchor ? hex2rgb(anchor) : null))); return o + (c.replace(/^#/, '').length === 8 ? c.slice(-2) : '');
    }
    // 1.5.11: lettering on a light look. A pale shade of a part (a gold highlight, a cream line, a soft effect colour) comes
    // out nearly white once your parts are light, and lettering drawn with it fades into the light plates behind it. ink()
    // deepens such lettering towards your own lettering colour until it stands out; dark looks, and lettering that already
    // reads, are left exactly as they are.
    const ground = lighter(mine.plates || B.plates, mine.backdrop || B.backdrop);
    const light = whiteIsText && relLum(ground) > .35;
    const inkTo = mine.text || [0, 0, 0];
    // c moved towards `to` in tenths until it stands out from `bg` by `need`
    function apart(c, bg, need, to) {
      if (contrastOf(c, bg) >= need) return c;
      let o = c; for (let t = .1; t <= 1.0001; t += .1) { o = c.map((v, i) => v + (to[i] - v) * t); if (contrastOf(o, bg) >= need) break; }
      return o.map(v => Math.round(v));
    }
    const deep = (c, need) => (light ? apart(c, ground, need, inkTo) : c);
    // the initial in an empty picture box stands on near-black (#111) whatever your colours: on a light look it's lifted
    // towards your light plates instead
    const lift = (c, need) => (light ? apart(c, [17, 17, 17], need, ground) : c);
    /** lettering colour(s) in a string — your colours applied, then deepened on a light look to stand out by `need` (3 = big
     * lettering, 4.5 = small). See-through colours (glows, sheens) are left alone. What it makes is never moved again by map(),
     * so a script can ink a colour inside CSS it maps as a whole */
    function ink(str, need = 3) { return typeof str === 'string' ? deepen(map(str), need) : str; }
    /** the same, for colours that aren't the layout's own (a team's colour): deepened on a light look, never recoloured */
    function deepen(s, need = 3) {
      if (typeof s !== 'string' || !light) return s;
      return s.replace(RX, (m, r, g, b, a) => {
        if (m[0] === '#') {
          const body = m.slice(1), alpha = body.length === 8 ? body.slice(6) : '', c = hex2rgb(body.slice(0, body.length === 8 ? 6 : body.length));
          if (!c || (alpha && parseInt(alpha, 16) < 200)) return m; const o = deep(c, need); if (o === c) return m; made.add(rgb2hex(o)); return rgb2hex(o) + alpha;
        }
        if (a && parseFloat(a.replace(/[,\s]/g, '')) < .8) return m;
        const c = [+r, +g, +b], o = deep(c, need); if (o === c) return m; made.add(rgb2hex(o));
        return a ? `rgba(${o[0]},${o[1]},${o[2]}${a.replace(/\s+/g, '')})` : `rgb(${o[0]},${o[1]},${o[2]})`;
      });
    }
    return { on, family, role, map, as, shiftAs, one, ink, deepen, light, deep, lift, B, mine };
  }

  /** server: a layout's design with your colours, reading each colour's part from where it is used */
  function recolourDesign(design, family, user) {
    const E = make(family, user); if (!E.on) return design;
    const ctxRole = (path, str) => {
      const p = path.join('.');
      if (/^scenes\.[^.]+\.bg\b/.test(p)) return 'backdrop';
      if (/(^|\.)(effect|particles|effectColor|fxColor|stinger)(\.|$)/.test(p)) return 'effects-if-white';
      if (/(^|\.)font\.color(\.|$)/.test(p)) return 'text-if-white';
      return '';
    };
    const RXH = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const fix = (str, path) => {
      const ctx = ctxRole(path, str), need = needOf(path);
      return str.replace(RXH, m => {
        const body = m.slice(1), alpha = body.length === 8 ? body.slice(6) : '', c = hex2rgb(body.slice(0, body.length === 8 ? 6 : body.length)); if (!c) return m;
        let r = '';
        if (ctx === 'backdrop') r = 'backdrop';
        else if (ctx === 'effects-if-white' && isWB(c)) r = c[0] ? 'effects' : '';
        else if (ctx === 'text-if-white' && isWB(c)) r = c[0] ? 'text' : '';
        if (!r) r = E.role(c);
        if (r === 'accent' && side && E.mine['p' + side]) r = 'p' + side;
        let o = r && E.mine[r] ? shift(c, E.B[r], E.mine[r]) : null;
        if (need && !(alpha && parseInt(alpha, 16) < 200)) { const at = (o || c).map(v => Math.round(clamp(v, 0, 255))), d = (cur.kind === 'avatar' ? E.lift : E.deep)(at, need); if (d !== at) o = d; }
        return o ? rgb2hex(o) + alpha : m;
      });
    };
    // 1.5.11: which colours are lettering (deepened on a light look by E.deep): the words on the screens other than the
    // scoreboard — a text piece's colour, its gradient-lettering colours, a neon tube's colour, and the names, round names
    // and labels of a bracket or a list. How far they must stand out: 3.5 for big lettering, 4.5 for small.
    // A picture box's initial (shown while there's no picture) is lifted instead: it stands on near-black.
    const LETTER = { text: 1, bracket: 1, list: 1, avatar: 1 };
    const needOf = (path) => {
      if (!E.light || !cur || !LETTER[cur.kind] || path[0] !== 'scenes' || path[1] === 'board') return 0;
      const k = path.slice(4).join('.'), f = cur.font || {};
      if (cur.kind === 'avatar') return /^font\.color(\.|$)/.test(k) ? 4.5 : 0;
      const lettering = /^font\.color(\.|$)/.test(k) || /^font\.gfxColors\./.test(k) || (k === 'font.fxColor' && f.fx === 'neon')
        || (cur.kind !== 'text' && /^(winColor|subColor|teamColor|statusColor)$/.test(k));
      if (!lettering) return 0;
      const px = cur.kind === 'text' ? (Number(cur.h) || 0) * .78 * (Number(f.size) || 1) : 0;
      return px >= 34 ? 3.5 : 4.5;
    };
    // the player a piece belongs to (only where the family colours players that way)
    const sideOf = (o, outer) => {
      if (!SIDED[family] || !o || typeof o.kind !== 'string') return outer;
      if (o.side === 1 || o.side === 2) return o.side;
      const n = String(o.name || ''); return /^(1P|P1|Player 1)\b/i.test(n) ? 1 : /^(2P|P2|Player 2)\b/i.test(n) ? 2 : outer;
    };
    let side = 0, cur = null;
    const walk = (o, path) => {
      if (typeof o === 'string') return fix(o, path);
      if (Array.isArray(o)) return o.map((v, i) => walk(v, path.concat(String(i))));
      // 1.5.6: a piece you gave its own colours in the layout maker keeps them (ownColours: true)
      if (o && typeof o === 'object') {
        if (o.ownColours === true) return o;
        const was = side, wasEl = cur; side = sideOf(o, side);
        if (path.length === 4 && path[0] === 'scenes' && path[2] === 'elements') cur = o;
        const out = {}; for (const [k, v] of Object.entries(o)) out[k] = walk(v, path.concat(k));
        side = was; cur = wasEl; return out;
      }
      return o;
    };
    return walk(design, []);
  }

  /** the colours a user entered, cleaned: only the nine parts, only #rrggbb */
  function clean(user) {
    const out = {};
    for (const r of ROLES) { const c = hex2rgb(user && user[r]); if (c) out[r] = rgb2hex(c); }
    return out;
  }

  // the ready-made sets (the Layouts tab's Colours card and the layout maker)
  const PRESETS = [
    ['Crimson', { plates: '#2a0d12', backdrop: '#0c0406', edges: '#6b1a24', text: '#fff1f1', subtext: '#c99aa0', accent: '#ff4d5e', p1: '#ff2d47', p2: '#ffd1d6', effects: '#ff6a3d' }],
    ['Ocean', { plates: '#0c2333', backdrop: '#03101a', edges: '#1f5a7a', text: '#eaf8ff', subtext: '#8fb6c9', accent: '#3fd0ff', p1: '#36e0c8', p2: '#3f8cff', effects: '#5fe3ff' }],
    ['Emerald', { plates: '#0e2419', backdrop: '#030d08', edges: '#1f6b45', text: '#effff5', subtext: '#8fbfa4', accent: '#38e58a', p1: '#2fd17a', p2: '#e6f56a', effects: '#7dffb1' }],
    ['Violet', { plates: '#1d1233', backdrop: '#08040f', edges: '#4d2f86', text: '#f5efff', subtext: '#a899c9', accent: '#b682ff', p1: '#ff5ccf', p2: '#7c6bff', effects: '#c77dff' }],
    ['Sakura', { plates: '#fff0f4', backdrop: '#ffe3ea', edges: '#e7a7b8', text: '#3a1a24', subtext: '#9b6b79', accent: '#ff6f9a', p1: '#ff4f86', p2: '#7a8cff', effects: '#ffb3c8' }],
    ['Mono', { plates: '#1a1a1a', backdrop: '#050505', edges: '#4a4a4a', text: '#ffffff', subtext: '#9a9a9a', accent: '#e6e6e6', p1: '#ffffff', p2: '#bdbdbd', effects: '#ffffff' }],
  ];
  const api = { ROLES, LABELS, BASE, KNOWN, SIDED, PRESETS, make, recolourDesign, clean, hex2rgb, rgb2hex, shift };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.SBColoursLib = api;
    const cfg = root.__SB_COLOURS;          // set by the server on a page of the app's own layouts when you've chosen colours
    root.SBColours = cfg ? make(cfg.family, cfg.colours) : { on: false, map: s => s, as: (r, c) => c, ink: s => s };
  }
})(typeof window !== 'undefined' ? window : this);
