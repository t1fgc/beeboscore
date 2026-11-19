/* BeeboScore (developed by Beebo), 1.5.5 — your colours for the app's own layouts (Classic and Obsidian Glass).
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
    'Obsidian Glass': { plates: '#1f1d18', backdrop: '#050507', edges: '#5a4824', text: '#f4eedf', subtext: '#8f8878', accent: '#e0a93b', p1: '#e3a536', p2: '#b9c0ca', effects: '#f0b84c' },
  };
  // every colour each family's designs use, and the part it belongs to (tools/make-obsidian.js keeps Obsidian's in step)
  const KNOWN = {
    Classic: { plates: ['#1c2030', '#151822', '#10121a', '#07080c', '#05060a', '#141210', '#17181d', '#0b0c0f'], backdrop: ['#0a0b10', '#050507'], edges: ['#333a50', '#252a3a', '#3a3d48'],
      text: ['#eef1f7', '#d9dce4'], subtext: ['#8b93a7', '#5d6579', '#8d919d'], accent: ['#e9c35e', '#f6c453', '#f3d98c', '#fff3cc', '#8a6a12'], p1: ['#ff3b5c'], p2: ['#3b8eff'],
      effects: ['#ff5a1f', '#ffb36b', '#ff3b14', '#ffb020', '#ff6a1a', '#ff6a2a', '#ffd0a0', '#ffe0a0'] },
    'Obsidian Glass': { plates: ['#1f1d18', '#100f0c', '#0c0b09', '#040404', '#030303', '#0b0b0d', '#2b2112', '#100c06', '#060504', '#22190a', '#0d0b07'], backdrop: ['#050507'],
      edges: ['#5a4824', '#2a261d', '#8a6a2c', '#4a3f2a', '#6e4a0e'], text: ['#f4eedf', '#ece4d2', '#fff6de'], subtext: ['#8f8878', '#7d7462', '#a8814a'],
      accent: ['#e0a93b', '#ffe2a1', '#f8e2a6', '#f6dc96', '#c98f26', '#fff0c6'], p1: ['#e3a536'], p2: ['#b9c0ca'], effects: ['#f0b84c', '#f0c766'] },
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
  const isWB = c => (c[0] === 255 && c[1] === 255 && c[2] === 255) || (c[0] === 0 && c[1] === 0 && c[2] === 0);

  /** the colour engine for one family and your colours: { on, role(rgb), shiftAs(role, rgb, anchorRgb?), map(str), as(role, c, anchor) } */
  function make(family, user) {
    const base = BASE[family], known = {}, mine = {}, skip = new Set();
    if (!base) return { on: false, map: s => s, as: (r, c) => c, role: () => '', family };
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
    return { on, family, role, map, as, shiftAs, one, B, mine };
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
      const ctx = ctxRole(path, str);
      return str.replace(RXH, m => {
        const body = m.slice(1), alpha = body.length === 8 ? body.slice(6) : '', c = hex2rgb(body.slice(0, body.length === 8 ? 6 : body.length)); if (!c) return m;
        let r = '';
        if (ctx === 'backdrop') r = 'backdrop';
        else if (ctx === 'effects-if-white' && isWB(c)) r = c[0] ? 'effects' : '';
        else if (ctx === 'text-if-white' && isWB(c)) r = c[0] ? 'text' : '';
        if (!r) r = E.role(c);
        if (!r || !E.mine[r]) return m;
        return rgb2hex(shift(c, E.B[r], E.mine[r])) + alpha;
      });
    };
    const walk = (o, path) => {
      if (typeof o === 'string') return fix(o, path);
      if (Array.isArray(o)) return o.map((v, i) => walk(v, path.concat(String(i))));
      // 1.5.6: a piece you gave its own colours in the layout maker keeps them (ownColours: true)
      if (o && typeof o === 'object') { if (o.ownColours === true) return o; const out = {}; for (const [k, v] of Object.entries(o)) out[k] = walk(v, path.concat(k)); return out; }
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
  const api = { ROLES, LABELS, BASE, KNOWN, PRESETS, make, recolourDesign, clean, hex2rgb, rgb2hex, shift };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.SBColoursLib = api;
    const cfg = root.__SB_COLOURS;          // set by the server on a page of the app's own layouts when you've chosen colours
    root.SBColours = cfg ? make(cfg.family, cfg.colours) : { on: false, map: s => s, as: (r, c) => c };
  }
})(typeof window !== 'undefined' ? window : this);
