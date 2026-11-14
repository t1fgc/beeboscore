/*
 * BeeboScore icons (developed by Beebo) — the app's own icon set. Every icon is an original drawing on a 24 × 24 grid,
 * so nothing depends on a computer's emoji set or on a font: the same icon looks the same in the app, in OBS, on a Mac
 * and on a phone.
 *
 *   BI.html('trophy')                      → <i class="bi" …><svg…></svg></i>   line icon in the text's colour
 *   BI.html('trophy', { color: true })      → the full-colour version (on stream: trophy, crown, flame, mic…)
 *   BI.svg(name, opts)                       → just the <svg>
 *   BI.names                                 → every icon name (see docs/images/icons.png for the sheet)
 *   BI.convert(root)                         → swaps the emojis the app used to use for icons inside `root`
 *   BI.strip(text)                           → the text without them (for tooltips, menus, dialogs: places that can't hold a picture)
 *
 * In the panel and the Designer, BI.watch() keeps doing this as the page changes, so a label written with an old emoji
 * still shows the icon. New code should use BI.html(name).
 */
(function (root) {
  'use strict';
  if (root.BI) return;
  // ---------------------------------------------------------------------------------- drawing helpers (24 × 24)
  const P = (d, b) => `<path${b ? ' class="b"' : ''} d="${d}"/>`;
  const C = (x, y, r, b) => `<circle${b ? ' class="b"' : ''} cx="${x}" cy="${y}" r="${r}"/>`;
  const R = (x, y, w, h, rx = 0, b) => `<rect${b ? ' class="b"' : ''} x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
  const L = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
  const F = d => `<path class="f" d="${d}"/>`;               // solid (filled with the icon colour)
  const FC = (x, y, r) => `<circle class="f" cx="${x}" cy="${y}" r="${r}"/>`;
  const star5 = (cx, cy, ro, ri) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1); } return d + 'Z'; };
  const spark = (cx, cy, r) => `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
  const arrowTip = (x, y, dir) => ({ r: `M${x - 5} ${y - 5}L${x} ${y}L${x - 5} ${y + 5}`, l: `M${x + 5} ${y - 5}L${x} ${y}L${x + 5} ${y + 5}`, u: `M${x - 5} ${y + 5}L${x} ${y}L${x + 5} ${y + 5}`, d: `M${x - 5} ${y - 5}L${x} ${y}L${x + 5} ${y - 5}` }[dir]);
  const face = extra => C(12, 12, 9, 1) + extra;
  const cloud = (dy = 0) => P(`M7 ${17 + dy}h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 ${17 + dy}z`, 1);

  // ---------------------------------------------------------------------------------- the icons
  const I = {
    // arrows & media
    'arrow-right': L(4, 12, 20, 12) + P(arrowTip(20, 12, 'r')), 'arrow-left': L(4, 12, 20, 12) + P(arrowTip(4, 12, 'l')),
    'arrow-up': L(12, 4, 12, 20) + P(arrowTip(12, 4, 'u')), 'arrow-down': L(12, 4, 12, 20) + P(arrowTip(12, 20, 'd')),
    'arrow-right-bar': L(3, 12, 17, 12) + P(arrowTip(17, 12, 'r')) + L(21, 5, 21, 19), 'arrow-left-bar': L(7, 12, 21, 12) + P(arrowTip(7, 12, 'l')) + L(3, 5, 3, 19),
    'arrows-h': L(3, 12, 21, 12) + P(arrowTip(21, 12, 'r')) + P(arrowTip(3, 12, 'l')), 'arrows-v': L(12, 3, 12, 21) + P(arrowTip(12, 3, 'u')) + P(arrowTip(12, 21, 'd')),
    'arrows-h-bar': L(5, 12, 19, 12) + P('M9 8l-4 4 4 4M15 8l4 4-4 4') + L(12, 6, 12, 18),
    'double-up': P('M6 12l6-6 6 6M6 19l6-6 6 6'), 'double-down': P('M6 5l6 6 6-6M6 12l6 6 6-6'),
    'swap': P('M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4'), 'shuffle': P('M3 7h4c5 0 5 10 10 10h4M18 14l3 3-3 3M3 17h4c2 0 3-1.5 4-3.5M14 9.5c1-1.5 2-2.5 3-2.5h4M18 4l3 3-3 3'),
    'hook-left': P('M20 6v5a4 4 0 0 1-4 4H5M9 11l-4 4 4 4'), 'hook-right': P('M4 6v5a4 4 0 0 0 4 4h11M15 11l4 4-4 4'),
    'undo': P('M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3'), 'redo': P('M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3'),
    'refresh': P('M20 11a8 8 0 0 0-14.3-4.9L4 8M4 3v5h5M4 13a8 8 0 0 0 14.3 4.9L20 16M20 21v-5h-5'),
    'repeat': P('M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3'),
    'play': F('M7 4.5v15l12.5-7.5z'), 'pause': F('M6 5h4v14H6zM14 5h4v14h-4z'), 'stop': F('M6 6h12v12H6z'), 'record': FC(12, 12, 6),
    'rewind': F('M11 6v12L3 12zM21 6v12l-8-6z'), 'skip': F('M4 6v12l9-6zM13 6v12l7-6z') + P('M21 6v12'),
    'caret-down': F('M5 8h14l-7 9z'), 'caret-up': F('M5 16h14l-7-9z'), 'caret-right': F('M8 5v14l9-7z'),
    // shapes & colour swatches
    'dot': FC(12, 12, 5), 'ring': C(12, 12, 7), 'ring-dotted': `<circle cx="12" cy="12" r="7" stroke-dasharray="2 2.6"/>`, 'square': F('M5 5h14v14H5z'), 'square-o': R(5, 5, 14, 14, 1.5),
    'square-small': R(8, 8, 8, 8, 1), 'diamond': F('M12 3l8 9-8 9-8-9z'), 'half-square': R(4, 4, 16, 16, 1.5) + F('M4 4h16L4 20z'), 'hexagon': P('M7.5 4h9l4.5 8-4.5 8h-9L3 12z'),
    'swatch-red': '', 'swatch-blue': '', 'swatch-orange': '', 'swatch-yellow': '', 'swatch-green': '', 'swatch-brown': '', 'swatch-white': '', 'swatch-black': '',
    'star': P(star5(12, 12.5, 9.5, 4), 1), 'star-glow': P(star5(12, 12.5, 7.5, 3.2), 1) + P('M12 1v1.5M2.5 8l1.3.8M21.5 8l-1.3.8M5 20.5l1-1.2M19 20.5l-1-1.2'),
    'sparkles': P(spark(10, 13, 7), 1) + P(spark(18.5, 5.5, 3.2), 1) + P(spark(19, 18, 2.2)), 'dizzy': P('M4 15a8 8 0 1 0 6-11') + P(spark(6, 6, 3), 1) + P(spark(18, 17, 2)),
    'shooting-star': P(star5(16, 8, 5.5, 2.4), 1) + P('M11 13L3 21M8 11l-5 5M13 16l-5 5'), 'comet': C(16, 8, 4, 1) + P('M13 11L3 21M12 8L5 15M16 12l-7 7'),
    'star6': P('M12 2l3 5.2h6l-3 5 3 5h-6L12 22l-3-4.8H3l3-5-3-5h6z') + FC(12, 12.2, 1.5),
    // controls & UI
    'check': P('M4 12.5l5 5L20 6.5'), 'check-box': R(3, 3, 18, 18, 4, 1) + P('M7.5 12.5l3 3 6-7'), 'close': P('M6 6l12 12M18 6L6 18'), 'close-box': R(3, 3, 18, 18, 4, 1) + P('M8 8l8 8M16 8l-8 8'),
    'plus': P('M12 5v14M5 12h14'), 'minus': P('M5 12h14'), 'help': C(12, 12, 9, 1) + P('M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 2-2.7 2.3-2.7 4') + FC(12, 17.5, 1.1),
    'warning': P('M12 3.5l9.5 16.5h-19z', 1) + P('M12 10v4.5') + FC(12, 17.3, 1.1), 'no-entry': C(12, 12, 9, 1) + P('M7 12h10'), 'forbid': C(12, 12, 9, 1) + P('M5.6 5.6l12.8 12.8'),
    'menu': P('M4 6h16M4 12h16M4 18h16'), 'gear': C(12, 12, 3) + P('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1') + C(12, 12, 6.5, 1),
    'search': C(10.5, 10.5, 6.5, 1) + P('M15.5 15.5L21 21'), 'eye': P('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 1) + C(12, 12, 3), 'eye-off': P('M2 12s3.6-7 10-7c2 0 3.7.7 5.1 1.6M22 12s-3.6 7-10 7c-2 0-3.7-.7-5.1-1.6') + P('M3 3l18 18') + P('M9.5 9.6a3 3 0 0 0 4.2 4.2'),
    'lock': R(5, 10.5, 14, 10.5, 2.5, 1) + P('M8 10.5V7.5a4 4 0 0 1 8 0v3') + FC(12, 15.8, 1.3), 'unlock': R(5, 10.5, 14, 10.5, 2.5, 1) + P('M8 10.5V7.5a4 4 0 0 1 7.7-1.5') + FC(12, 15.8, 1.3),
    'link': P('M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1'),
    'bell': P('M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z', 1) + P('M10 20.5a2.2 2.2 0 0 0 4 0'), 'chat': P('M4 5h16v11H11l-5 4v-4H4z', 1), 'chat-bubble': P('M4 4h16v12H13l-4 4v-4H4z', 1) + P('M9 8.5v3.5M14 8.5v3.5'),
    'pin': P('M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z', 1) + C(12, 10, 2.3), 'pushpin': P('M9 3h6l-1 5 3 4H7l3-4zM12 12v9'),
    'clipboard': R(5, 4.5, 14, 17, 2, 1) + R(9, 2.5, 6, 4, 1.2) + P('M8.5 12h7M8.5 16h5'), 'trash': P('M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14', 1) + P('M10 10.5v6M14 10.5v6'),
    'save': P('M5 3.5h11l3.5 3.5v13.5H5z', 1) + R(8, 3.5, 7, 5) + R(8, 13, 8, 7.5), 'folder': P('M3 6.5A1.5 1.5 0 0 1 4.5 5h4.5l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z', 1),
    'folder-open': P('M3 18.5V6.5A1.5 1.5 0 0 1 4.5 5h4.5l2 2.5h7a1.5 1.5 0 0 1 1.5 1.5V11') + P('M3 18.5L6 11h16l-3 9H4.5', 1),
    'page': P('M6 3h8l5 5v13H6z', 1) + P('M14 3v5h5M9 13h7M9 17h5'), 'page-curl': P('M6 3h12v14l-4 4H6z', 1) + P('M18 17h-4v4M9 8h6M9 12h6'),
    'notebook': R(5, 3, 14, 18, 2, 1) + P('M9 3v18M12 8h4M12 12h4'), 'book': P('M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14', 1),
    'scroll': P('M7 4h11a2 2 0 0 1 0 4h-1v10a3 3 0 0 1-3 3H6a2 2 0 0 1 0-4h1z', 1) + P('M10 10h4M10 14h4'), 'news': R(3, 5, 15, 15, 1.5, 1) + P('M18 9h3v9.5a1.5 1.5 0 0 1-3 0M6 9h9M6 13h4M6 16.5h4M12 13h3v3.5h-3z'),
    'chart-up': P('M3 20h18M5 16l5-5 3 3 6-7M15 7h4v4'), 'chart-bars': P('M3 20.5h18') + R(5, 12, 3, 8.5, .8, 1) + R(10.5, 6, 3, 14.5, .8, 1) + R(16, 9.5, 3, 11, .8, 1),
    'ruler': P('M3 16.5L16.5 3l4.5 4.5L7.5 21z', 1) + P('M7.5 12l2 2M10.5 9l2 2M13.5 6l2 2'), 'set-square': P('M4 20V4l16 16z', 1) + P('M8 16v-5l5 5zM4 8h2M4 12h2'),
    'badge': R(3, 6, 18, 13, 2.5, 1) + P('M3 10h18') + C(8.5, 14.5, 1.8) + P('M12.5 14h5M12.5 16.5h3'), 'tag': P('M3 12V4h8l10 10-8 8z', 1) + FC(7.5, 8, 1.4),
    'label': P('M4 7h12l4 5-4 5H4z', 1) + FC(8, 12, 1.3), 'id-card': R(2.5, 5, 19, 14, 2.5, 1) + C(8.5, 11, 2.3) + P('M5.5 16.5a3.3 3.3 0 0 1 6 0M14 10h5M14 13.5h4'),
    'receipt': P('M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z', 1) + P('M9 8h6M9 12h6M9 16h3'), 'tray-out': P('M3 14v5.5h18V14M3 14h5l1.5 2.5h5L16 14h5', 1) + P('M12 11V3M8.5 6.5L12 3l3.5 3.5'),
    'tray-in': P('M3 14v5.5h18V14M3 14h5l1.5 2.5h5L16 14h5', 1) + P('M12 3v8M8.5 7.5L12 11l3.5-3.5'), 'box': P('M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z', 1) + P('M3 7.5L12 12l9-4.5M12 12v9'),
    'tabs': R(3, 7, 18, 13, 2, 1) + P('M6 7V4h5l1.5 3M12.5 7V4.5h4l1.5 2.5'), 'image': R(3, 4.5, 18, 15, 2, 1) + C(8.5, 9.5, 1.8) + P('M3 17l5-5 4 4 3-3 6 6'),
    'phone': R(7, 2.5, 10, 19, 2.5, 1) + P('M10.5 18.5h3'), 'phone-buzz': R(8, 3, 8, 18, 2, 1) + P('M4.5 8v8M2 10v4M19.5 8v8M22 10v4'),
    'signal': P('M4 20v-3M9 20v-7M14 20V9M19 20V4'), 'dish': P('M5 9a7.5 7.5 0 0 0 10 10z', 1) + P('M10 14l5-5M15 9a2 2 0 1 0 0 .01M16.5 3.5a6 6 0 0 1 4 4M15.5 6.5a3 3 0 0 1 2 2M8 18l-2 3h7'),
    'camera': P('M3 8.5A1.5 1.5 0 0 1 4.5 7h3L9 4.5h6L16.5 7h3A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z', 1) + C(12, 13.5, 3.8),
    'camera-flash': P('M3 8.5A1.5 1.5 0 0 1 4.5 7h3L9 4.5h6L16.5 7h3A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z', 1) + C(12, 13.5, 3.8) + P('M18 2l-1.5 3h2.5L17.5 8'),
    'tv': R(2.5, 5, 19, 13, 2, 1) + P('M8 21h8M8.5 2l3.5 3 3.5-3'), 'monitor': R(2.5, 3.5, 19, 13, 2, 1) + P('M12 16.5V21M7.5 21h9'),
    'film': R(3, 3, 18, 18, 2, 1) + P('M7.5 3v18M16.5 3v18M3 8h4.5M3 12h4.5M3 16h4.5M16.5 8H21M16.5 12H21M16.5 16H21'), 'cassette': R(2.5, 5, 19, 14, 2, 1) + C(8, 11, 2) + C(16, 11, 2) + P('M8 9h8M6 19l2-3.5h8l2 3.5'),
    'movie-camera': R(2.5, 7, 13, 11, 2, 1) + P('M15.5 11l6-3.5v10l-6-3.5') + C(6, 4.5, 2) + C(11.5, 4.5, 2), 'clapper': P('M3 10h18v10H3z', 1) + P('M3 10l1-5 16.5-2 .5 4L3 10M8 4.2l2.5 4.6M13.5 3.6l2.5 4.6'),
    'speaker': P('M4 9h4l5-4.5v15L8 15H4z', 1) + P('M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11'), 'speaker-low': P('M4 9h4l5-4.5v15L8 15H4z', 1) + P('M16.5 9a4 4 0 0 1 0 6'),
    'speaker-off': P('M4 9h4l5-4.5v15L8 15H4z', 1) + P('M16.5 9.5l5 5M21.5 9.5l-5 5'), 'mic': R(9, 2.5, 6, 11, 3, 1) + P('M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7'),
    'slider': P('M4 6h16M4 12h16M4 18h16') + R(7, 4, 3, 4, 1, 1) + R(14, 10, 3, 4, 1, 1) + R(9, 16, 3, 4, 1, 1), 'knobs': C(7, 8, 3.5, 1) + C(17, 8, 3.5, 1) + C(12, 17, 3.5, 1) + P('M7 8l1.5-2M17 8l-2-1M12 17v-2.5'),
    'plug': P('M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0z', 1) + P('M12 16.5V21'), 'torch': P('M8 3h8v5l-2 3v10h-4V11L8 8z', 1) + P('M8 8h8M12 14v2'),
    'printer': P('M7 9V3h10v6', 1) + R(3, 9, 18, 8, 2, 1) + R(7, 14, 10, 7, 1) + FC(17.5, 12, 1),
    // tools
    'scissors': C(6, 18, 3) + C(18, 18, 3) + P('M8 16L18 3M16 16L6 3'), 'pencil': P('M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z', 1) + P('M14 6.5l3 3M4 20l4.5-1.5'),
    'pen': P('M5 19l2-6 8-8 4 4-8 8z', 1) + P('M5 19l4.5-4.5M13 7l4 4') + FC(10, 14, 1.2), 'brush': P('M14.5 3.5l6 6-7.5 7.5-6-6z', 1) + P('M7 11c-3 0-4 2.5-4 5.5V21h3.5c3 0 5.5-1 5.5-4'),
    'crayon': P('M5 19l-1.5 1.5M6 18l10-10 3 3-10 10-4 1z', 1) + P('M16 8l2-2 3 3-2 2'), 'hand-write': P('M3 20h9') + P('M14 4l5 5-8 8H6v-5z', 1),
    'wrench': P('M14.5 6.5a4.5 4.5 0 0 1 5.8-1.2L17 8.6l.4 2.9 2.9.4 3.3-3.3', 1) + P('M18.3 11.7a4.5 4.5 0 0 1-5.5.8L5.5 19.8a2 2 0 0 1-2.8-2.8l7.3-7.3a4.5 4.5 0 0 1 .8-5.5'),
    'hammer': P('M14 4l6 6-2.5 2.5-6-6z', 1) + P('M12.7 9.3L4 18a1.4 1.4 0 0 0 2 2l8.7-8.7M14 4c-1.5-1.5-4-2-6-1'),
    'tools': P('M5 21l9-9M14.5 3.5a4 4 0 0 0 5.6 5.6l-2.6-.5-.5-2.6zM4 4l6 6M3 7l4-4 4 4-4 4z'), 'pick-hammer': P('M5 20l8.5-8.5M13 5l6 6M14.5 3.5c3 0 5.5 2.5 6 6-1.5-1-3.5-1.5-5-1.5') + P('M4 12l4-4 3 3-4 4z', 1),
    'nut-bolt': P('M8.5 3.5h7l3.5 6-3.5 6h-7L5 9.5z', 1) + C(12, 9.5, 2.5) + P('M10 15.5V21h4v-5.5'), 'magnet': P('M5 3v9a7 7 0 0 0 14 0V3h-4.5v9a2.5 2.5 0 0 1-5 0V3z', 1) + P('M5 7.5h4.5M14.5 7.5H19'),
    'clamp': P('M5 4h14M5 20h14M12 4v5M9 9h6l-1 3h-4zM12 20v-5'), 'broom': P('M20 3l-8 8') + P('M12 11l-6 2-3 8 8-3 2-6z', 1) + P('M6 16l2-2M8.5 18.5l2-2'),
    'sponge': R(3, 7, 18, 11, 3, 1) + FC(8, 11, 1) + FC(13, 13.5, 1) + FC(16.5, 10.5, .9) + FC(9.5, 15, .8), 'bandage': P('M5 13.5l8.5-8.5a3.5 3.5 0 0 1 5 5L10 18.5a3.5 3.5 0 0 1-5-5z', 1) + FC(10.5, 11, .7) + FC(13, 13.5, .7) + FC(13, 11, .7) + FC(10.5, 13.5, .7),
    'wand': P('M4 20L15 9') + P(spark(17.5, 6.5, 4), 1) + P('M8 4v2.5M6.8 5.2h2.5M20 13v2M19 14h2'),
    'statue': P('M8 21V9a4 4 0 0 1 8 0v12', 1) + P('M6 21h12M10 10.5h1M13 10.5h1M10 15h4M12 11v3'),
    'mirror': P('M12 3c3.6 0 6 3.4 6 7.5S15.6 18 12 18s-6-3.4-6-7.5S8.4 3 12 3z', 1) + P('M12 18v3M9 21h6M9.5 7.5l-1.5 3M12 7l-3 6'),
    'window': R(4, 3, 16, 18, 1.5, 1) + P('M12 3v18M4 12h16'), 'door': P('M6 21V3h12v18', 1) + P('M3 21h18') + FC(15, 12, 1.1),
    'ladder': P('M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10'), 'bricks': R(3, 4, 18, 16, 1, 1) + P('M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20M15 4v5.3M15 14.7V20'),
    'knot': P('M4 7c4 0 6 4 8 5s4 5 8 5M4 17c4 0 6-4 8-5s4-5 8-5') + C(12, 12, 2.4, 1), 'thread': R(7, 4, 10, 16, 1.5, 1) + P('M5 4h14M5 20h14M7 8l10 3M7 12l10 3') + P('M17 15.5c2 0 3 1 3 3'),
    'yarn': C(12, 12, 8, 1) + P('M5 9c5-1 9 1 14 6M6 15c3-4 6-7 12-8M9 4.5c-1 4 0 10 4 15'), 'abacus': R(3, 3, 18, 18, 2, 1) + P('M3 8h18M3 16h18') + FC(7, 8, 1.4) + FC(10, 8, 1.4) + FC(16, 8, 1.4) + FC(8, 16, 1.4) + FC(14, 16, 1.4) + FC(17, 16, 1.4),
    'compass': C(12, 12, 9, 1) + P('M15.5 8.5l-2 5-5 2 2-5z'), 'dna': P('M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8.5 6.5h7M8.5 17.5h7M10 12h4'),
    'flask': P('M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3', 1) + P('M7 15h10'),
    'stethoscope': P('M6 3v6a5 5 0 0 0 10 0V3M11 14v1a5 5 0 0 0 10 0v-1') + C(21, 12, 2, 1), 'brain': P('M12 5a3.5 3.5 0 0 0-6.5 1.5A3.5 3.5 0 0 0 4 12a3.5 3.5 0 0 0 2 5.5A3.5 3.5 0 0 0 12 19a3.5 3.5 0 0 0 6-1.5 3.5 3.5 0 0 0 2-5.5 3.5 3.5 0 0 0-1.5-5.5A3.5 3.5 0 0 0 12 5z', 1) + P('M12 5v14M8 9.5c1.5 0 2.5 1 2.5 2.5M16 14c-1.5 0-2.5-1-2.5-2.5'),
    'puzzle': P('M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4z', 1), 'keyboard': R(2, 6, 20, 12, 2, 1) + P('M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6'),
    'abc': P('M3 17l3-9 3 9M4.2 14h3.6M11 8v9h3a2.2 2.2 0 0 0 0-4.5H11h2.6a2.2 2.2 0 0 0 0-4.5zM21 9a3.5 3.5 0 1 0 0 7'), 'numbers': P('M4 9l2-1.5V17M10 9a2 2 0 0 1 4 0c0 2.5-4 4-4 8h4.5M17.5 8h3l-2 3a2.8 2.8 0 1 1-1.5 5'),
    'symbols': P('M4 8h6M4 12h6M7 5v10M14 19l6-14') + C(14.5, 7, 1.6) + C(19.5, 17, 1.6), 'letter-a': R(3, 3, 18, 18, 3, 1) + P('M8 17l4-10 4 10M9.4 13.5h5.2'),
    'vs': P('M3 6l3.5 12L10 6M20 7.5c-.8-1-2-1.5-3.3-1.5-1.8 0-3.2 1.2-3.2 2.8 0 3.7 7 2.3 7 6 0 1.8-1.6 3.2-3.6 3.2-1.5 0-2.8-.6-3.6-1.6'), 'stamp-jp': R(3, 3, 18, 18, 3, 1) + P('M8 8h8M12 8v9M8.5 12.5h7M8 17h8'),
    'card': R(5, 3, 14, 18, 2, 1) + P(star5(12, 12, 4, 1.8)), 'domino': R(7, 2.5, 10, 19, 2, 1) + P('M7 12h10') + FC(12, 7, 1.2) + FC(10, 15.5, 1.1) + FC(14, 18.5, 1.1),
    'dice': R(3.5, 3.5, 17, 17, 3.5, 1) + FC(8, 8, 1.4) + FC(16, 8, 1.4) + FC(12, 12, 1.4) + FC(8, 16, 1.4) + FC(16, 16, 1.4), 'slots': R(3, 5, 15, 15, 2, 1) + P('M7 9v7M10.5 9v7M14 9v7M18 9h2.5V5') + C(20.5, 4, 1.3),
    'piano': R(3, 5, 18, 14, 1.5, 1) + P('M7.5 5v14M12 5v14M16.5 5v14') + F('M6 5h3v8H6zM10.5 5h3v8h-3zM15 5h3v8h-3z'), 'drum': P('M4 9v7c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V9', 1) + P('M4 9c0-2 3.6-3.5 8-3.5S20 7 20 9s-3.6 3.5-8 3.5S4 11 4 9zM7 3l4 6M17 3l-4 6'),
    'accordion': R(2.5, 6, 4, 12, 1, 1) + R(17.5, 6, 4, 12, 1, 1) + P('M6.5 7l2.5 5-2.5 5M9 12l2.5-5 2.5 5-2.5 5zM17.5 7L15 12l2.5 5'), 'target': C(12, 12, 9, 1) + C(12, 12, 5) + FC(12, 12, 1.6),
    'gamepad': P('M7 8h10a5 5 0 0 1 4.8 6.3l-.6 2.3a2.5 2.5 0 0 1-4.2 1.1L15 16H9l-2 1.7a2.5 2.5 0 0 1-4.2-1.1l-.6-2.3A5 5 0 0 1 7 8z', 1) + P('M7.5 10.5v3M6 12h3') + FC(15.5, 11, 1) + FC(17.5, 13, 1),
    'joystick': R(4, 16, 16, 5, 2, 1) + P('M12 16V8') + C(12, 6, 3, 1) + FC(16.5, 18.5, 1), 'invader': P('M8 4l1.5 2.5h5L16 4M5 9V7.5h14V9h1.5v5H19v2h-2.5v-2h-9v2H5v-2H3.5V9z', 1) + F('M8 10h2v2H8zM14 10h2v2h-2zM6.5 17.5L8 16M17.5 17.5L16 16'),
    'palette': P('M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 2.5-.5 4-.5A3 3 0 0 0 21 12a9 9 0 0 0-9-9z', 1) + FC(7.5, 11, 1.3) + FC(10, 7, 1.3) + FC(15, 7, 1.3) + FC(17.5, 11, 1.2),
    'masks': P('M3 4.5c3 1 6 1 9 0v7a4.5 4.5 0 0 1-9 0z', 1) + P('M12 8.5c3 1 6 1 9 0v7a4.5 4.5 0 0 1-9 0') + P('M5.5 9h1.5M8.5 9H10M5.5 13a2 2 0 0 0 3.5 0M14.5 13h1.5M17.5 13H19M14.5 18a2 2 0 0 1 3.5 0'),
    'shirt': P('M8 3l-4.5 3 2 4.5L7 9.5V21h10V9.5l1.5 1 2-4.5L16 3c-1 1.5-2.4 2-4 2s-3-.5-4-2z', 1) + P('M9 3.5l3 6 3-6'), 'ball': C(12, 12, 9, 1) + P('M3 12h18M12 3v18M5.5 5.5c3.5 3.5 3.5 9.5 0 13M18.5 5.5c-3.5 3.5-3.5 9.5 0 13'),
    'checkered-flag': P('M5 21V3.5') + P('M5 4h14v10H5', 1) + F('M5 4h3.5v3.3H5zM12 4h3.5v3.3H12zM8.5 7.3H12v3.4H8.5zM15.5 7.3H19v3.4h-3.5zM5 10.7h3.5V14H5zM12 10.7h3.5V14H12z'),
    'flag': P('M5 21V3.5') + P('M5 4.5c4-2 6 2 10 0s4 0 4 0v9s-1-2-4 0-6-2-10 0', 1), 'flags-crossed': P('M4 21L13 4M20 21L11 4') + P('M13 4l6 2.5-4 3', 1) + P('M11 4L5 6.5l4 3', 1),
    'windsock': P('M4 21V3') + P('M4 4l15 2.5v6L4 15z', 1) + P('M9 4.8v9.4M14 5.6v7.8'),
    'medal': P('M7 3h3.5l1.5 4 1.5-4H17l-3 7') + C(12, 15, 5.5, 1) + P(star5(12, 15.3, 3, 1.3)), 'trophy': P('M7 3.5h10v6a5 5 0 0 1-10 0z', 1) + P('M7 5.5H4.5a3.5 3.5 0 0 0 3.2 4.5M17 5.5h2.5a3.5 3.5 0 0 1-3.2 4.5M12 14.5V18M8 21h8l-1-3H9z'),
    'crown': P('M3.5 8l4.5 4 4-7 4 7 4.5-4-2 11h-13z', 1) + P('M5.5 21h13'), 'pawn': C(12, 6.5, 3.2, 1) + P('M9.5 10.5h5l1 6h-7z', 1) + P('M6.5 20.5h11l-1-4h-9z', 1),
    // two fighters facing each other with a spark between them (the VS screens), and a screen with its bottom bar lit (the format bar)
    'team-vs': C(5.8, 7.4, 2.6, 1) + P('M1.5 19.5c0-3.7 1.9-6.3 4.3-6.3s4.3 2.6 4.3 6.3', 1) + C(18.2, 7.4, 2.6, 1) + P('M13.9 19.5c0-3.7 1.9-6.3 4.3-6.3s4.3 2.6 4.3 6.3', 1) + F('M12.9 3.2l-2.6 5.2h2.3l-1.5 4.8 3.6-6h-2.4l1.6-4z'),
    'lower-bar': R(2.5, 4, 19, 15, 2.5, 1) + F('M5 13.5h14v3H5z') + L(8, 21, 16, 21) + L(12, 19, 12, 21),
    'swords': P('M4 4l10.5 10.5M11.5 17l5.5-5.5M15.5 15.5l4.5 4.5M20 4L9.5 14.5M7 11.5l5.5 5.5M8.5 15.5L4 20'), 'dagger': P('M18.5 3.5l2 2L10 16l-2-2z', 1) + P('M6 12l6 6M4 20l3.5-3.5'),
    'axe': P('M14 10L4 20') + P('M11.5 7.5L16 3c3 1.5 5 3.5 5 6l-4.5 4.5z', 1), 'blaster': P('M3 8h14v5H9l-1 6H4l1-6H3z', 1) + P('M17 9.5h4M11 13v2.5'), 'shield': P('M12 3l8 3v5.5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6z', 1),
    'scales': P('M12 3v18M7 21h10M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z'), 'boxing-glove': P('M6 11V8a5 5 0 0 1 10 0v1.5a3 3 0 0 1 3 3V15a5 5 0 0 1-5 5H9a3 3 0 0 1-3-3z', 1) + P('M6 15h7M16 9.5V13'),
    'gi': P('M8 3l4 5 4-5 4.5 3-2 4-2-1V21h-9V9l-2 1-2-4z', 1) + P('M8 3l4 9 4-9M7.5 14h9'), 'fist-l': R(4, 7, 15, 11, 4, 1) + P('M8.5 7v4M12.5 7v4M16.5 7.5v3.5M4 13h6'), 'fist-r': R(5, 7, 15, 11, 4, 1) + P('M15.5 7v4M11.5 7v4M7.5 7.5v3.5M20 13h-6'),
    'handshake': P('M3 9l4-3 5 2 5-2 4 3v5l-5 4-4-3-4 3-5-4z', 1) + P('M8 13l3 2.5M10.5 11l3 2.5M12 8l-3 3'), 'wave-hand': P('M7.5 12V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7c-2.5 0-4-1-5.5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.8z', 1) + P('M18.5 3.5c1 .6 1.7 1.5 2 2.5'),
    'hand': P('M7.5 12V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7c-2.5 0-4-1-5.5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.8z', 1),
    'person': C(12, 8, 4, 1) + P('M4 21a8 8 0 0 1 16 0'), 'people': C(9, 8, 3.5, 1) + P('M2.5 20a6.5 6.5 0 0 1 13 0') + C(17, 9, 2.8) + P('M17.5 14.5a5 5 0 0 1 4.5 5'), 'climber': C(15, 4.5, 2) + P('M14 7l-2 5 3 3v6M12 12l-4 2-3-2M14 8l4 3M8 21l3-5'),
    'swimmer': C(17, 6, 2) + P('M3 14c2 0 2-1.5 4.5-1.5S10 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19M6 11l4-4 4 2 2 3'),
    'lifter': C(12, 5, 2.2) + P('M3 9h18M4 7v4M20 7v4M8 9l2 4h4l2-4M10 13l-2 8M14 13l2 8'),
    'ghost': P('M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.3 2-2.2-2-2.3 2L7.5 19z', 1) + FC(9.5, 11, 1.2) + FC(14.5, 11, 1.2), 'skull': P('M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.2 2.5 5.2V19h10v-3.3c1.2-1 2.5-2.6 2.5-5.2A7.5 7.5 0 0 0 12 3z', 1) + C(9, 11, 1.8) + C(15, 11, 1.8) + P('M10 19v2M14 19v2M12 14l-.8 1.5h1.6z'),
    'face-smile': face(FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M8.5 14a4 4 0 0 0 7 0')), 'face-wince': face(P('M7.5 9l2 1.5-2 1.5M16.5 9l-2 1.5 2 1.5M8 16l2-1.5 2 1.5 2-1.5 2 1.5')),
    'face-zip': face(FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M7.5 15h9M9.5 14v2M12 14v2M14.5 14v2')), 'face-hat': C(12, 14, 7, 1) + P('M3 9h18M7 9l1.5-5h7L17 9') + FC(9.5, 13, 1) + FC(14.5, 13, 1) + P('M9.5 17a3 3 0 0 0 5 0'),
    'face-cold': face(FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M8 15.5h8')) + P('M3 3l2 2M21 3l-2 2'), 'face-melt': P('M21 13a9 9 0 1 0-15 6.7c1 .8 2-.7 3.5-.7S12 21 14 21s2.5-2 4-2 3 0 3-6z', 1) + FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M8.5 14a4 4 0 0 0 7 0'),
    'face-dotted': `<circle class="b" cx="12" cy="12" r="9" stroke-dasharray="2.2 2.6"/>` + FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M9.5 15h5'), 'face-shake': face(FC(9, 10, 1.1) + FC(15, 10, 1.1) + P('M9 15.5h6')) + P('M1.5 9v6M22.5 9v6'),
    'monkey-eyes': C(12, 12, 8.5, 1) + P('M4 11h7v3H4zM13 11h7v3h-7z') + P('M9 17.5a4 4 0 0 0 6 0'),
    // nature & weather
    'sun': C(12, 12, 4.5, 1) + P('M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'), 'brightness': C(12, 12, 4, 1) + P('M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1'),
    'sunrise': P('M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0', 1) + P('M12 6v3M4.5 10.5l2 1.5M19.5 10.5l-2 1.5M8 21h8'), 'sunrise-mountain': P('M2 20l6-8 4 5 3-3 7 6z', 1) + C(15, 7, 3) + P('M15 1.5V2.5'),
    'moon': P('M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z', 1), 'moon-new': C(12, 12, 8, 1) + F('M12 4a8 8 0 0 1 0 16 8 8 0 0 1 0-16z'), 'moon-wane': C(12, 12, 8, 1) + F('M12 4a8 8 0 0 0 0 16 5 8 0 0 1 0-16z'),
    'night': P('M2 20h20M5 20v-6h4v6M11 20V9h5v11M18 20v-8h3') + P('M17 3.5a2.5 2.5 0 1 0 2.5 3 2 2 0 0 1-2.5-3z'), 'galaxy': P('M3 15c3 3 13 3 18-3-4 2-11 4-15-1 5-3 11-4 14-2-3-4-12-3-17 6z', 1) + FC(18, 5, .9) + FC(5, 5, .7) + FC(20, 18, .7),
    'globe': C(12, 12, 9, 1) + P('M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18'), 'planet': C(12, 12, 6, 1) + P('M4.5 15.5C1 18 1.5 20 6 18.5c4-1.5 9-5 12.5-8.5 3.5-3.5 3-5.5-1.5-3.5'),
    'thermometer': P('M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z', 1) + P('M12 9v8'), 'rainbow': P('M2 18a10 10 0 0 1 20 0M5.5 18a6.5 6.5 0 0 1 13 0M9 18a3 3 0 0 1 6 0'),
    'wave': P('M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 12c3-5 7-7 11-6-3 1-3 4-1 5s4-1 6-1') , 'volcano': P('M2 21l6-10h8l6 10z', 1) + P('M10 11l1-2h2l1 2M12 7V3M9 5l1.5 2M15 5l-1.5 2'),
    'cloud': cloud(), 'rain': cloud(-2) + P('M8 19l-1 2.5M12 19l-1 2.5M16 19l-1 2.5'), 'sun-rain': C(16.5, 6.5, 3) + cloud(-2) + P('M8 19l-1 2.5M12 19l-1 2.5'),
    'storm': cloud(-2) + P('M12.5 15.5L10 19.5h3.5L11 23'), 'tornado': P('M3 5h18M5 9h14M8 13h9M10 17h5M12 21h2'), 'fog': P('M4 8h12M7 12h13M3 16h14M8 20h10'), 'wind': P('M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6'),
    'snowflake': P('M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 2.5L15 4M9 20l3-2.5 3 2.5M4 10.5l3.7.5-1.3 3.5M20 13.5l-3.7-.5 1.3-3.5'), 'ice-cube': P('M4 8l8-4 8 4v9l-8 4-8-4z', 1) + P('M4 8l8 4 8-4M12 12v9M8 14l1.5 1M15 9.5l2-1'),
    'snowman': C(12, 7, 3.5, 1) + C(12, 16, 5.5, 1) + FC(11, 6.5, .7) + FC(13, 6.5, .7) + FC(12, 14, .7) + FC(12, 17, .7), 'blossom': C(12, 6.5, 3.2, 1) + C(17.2, 10.3, 3.2, 1) + C(15.2, 16.5, 3.2, 1) + C(8.8, 16.5, 3.2, 1) + C(6.8, 10.3, 3.2, 1) + FC(12, 12, 1.8),
    'leaf': P('M5 19C5 9 11 4 20 4c0 9-5 15-15 15z', 1) + P('M5 19L14 10'), 'drop': P('M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z', 1), 'bubbles': C(9, 14, 5, 1) + C(17, 7, 3) + C(18, 16, 2),
    'flame': P('M12 21c-4 0-7-2.8-7-6.5 0-4.5 4-6.5 4-11 3 1.5 5 4 5 7 1-.5 1.8-1.7 2-3 2 2 3 4.3 3 7 0 3.7-3 6.5-7 6.5z', 1) + P('M12 21c-2 0-3.3-1.4-3.3-3.2 0-2.3 2.3-3.3 2.3-5.8 1.8 1 3.3 2.8 3.3 5 .7-.3 1-.8 1-1.6 0 0 0 5.6-3.3 5.6z'),
    'bolt': P('M13.5 2.5L4.5 14h6.5l-1.5 7.5 9-11.5H12z', 1), 'burst': P('M12 2l2 5.5 5.5-2.5-2.5 5.5L22 12l-5 2 2.5 5.5L14 17l-2 5-2-5-5.5 2.5L7 14l-5-2 5-1.5-2.5-5.5L10 7.5z', 1),
    'anger': P('M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4'), 'spiral': P('M12 12a1.5 1.5 0 1 1 1.5 1.5 3 3 0 0 1-3-3 4.5 4.5 0 0 1 4.5-4.5 6 6 0 0 1 6 6 7.5 7.5 0 0 1-7.5 7.5A9 9 0 0 1 4.5 10.5'),
    'steam': P('M4 15a8 3 0 0 0 16 0', 1) + P('M8 11c-1.5-2 1.5-3 0-5M12 11c-1.5-2 1.5-3 0-5M16 11c-1.5-2 1.5-3 0-5'), 'rock': P('M3 18l3-8 5-4 6 2 4 6-2 4z', 1) + P('M6 10l4 3 2 5M12 13l5-5'),
    'wood': R(3, 7, 14, 10, 1, 1) + P('M17 7a3 5 0 0 1 0 10M17 7c1.7 0 3 2.2 3 5s-1.3 5-3 5') + C(17.2, 12, 1) + P('M6 11h6M8 14h5'), 'hole': P('M3 14c0 2.5 4 4.5 9 4.5s9-2 9-4.5-4-4.5-9-4.5-9 2-9 4.5z', 1) + F('M7 14c0-1.3 2.2-2.5 5-2.5s5 1.2 5 2.5-2.2 2.5-5 2.5S7 15.3 7 14z'),
    'web': P('M12 3v18M3.5 7.5l17 9M3.5 16.5l17-9M12 6.5l4.8 2.7v5.6L12 17.5l-4.8-2.7V9.2zM12 9.5l2.2 1.2v2.6L12 14.5l-2.2-1.2v-2.6z'),
    // things
    'heart': P('M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z', 1), 'heart-beat': P('M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z', 1) + P('M3 12h4l1.5-2.5 2 5 1.5-2.5h9'),
    'heart-grow': P('M12 18s-6-3.5-6-8a3.5 3.5 0 0 1 6-2 3.5 3.5 0 0 1 6 2c0 4.5-6 8-6 8z', 1) + P('M3 9a9 9 0 0 1 3-5M21 9a9 9 0 0 0-3-5'), 'heart-broken': P('M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z', 1) + P('M12 7l-1.5 4 3 2.5-1.5 6.5'),
    'bulb': P('M9 17v-2.3A6.5 6.5 0 1 1 15 14.7V17z', 1) + P('M9.5 20.5h5M10 17l-1-6h6l-1 6'), 'candle': R(9, 9, 6, 12, 1, 1) + P('M12 9V7M12 2.5s2 2 2 3.3a2 2 0 0 1-4 0c0-1.3 2-3.3 2-3.3z'),
    'cup': P('M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 1) + P('M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3c-1 1 1 2 0 3.5M12 3c-1 1 1 2 0 3.5'), 'glass': P('M5 5h14l-1.5 15h-11z', 1) + P('M5.8 12h12.4'),
    'pour': P('M4 4.5l6.5 6.5-3 3L1 7.5z', 1) + P('M10.5 12c1.5 2 2 3.5 2 5.5') + P('M8 16h9l-1.2 5.5H9.2z', 1), 'jelly': P('M5 19h14l-2-8H7z', 1) + P('M7 11c1-4 3-6 5-6s4 2 5 6M9 8h6'), 'potato': P('M6 6c3-3 9-3 12 1s2 10-2 12-11 2-13-2-.5-8.5 3-11z', 1) + FC(9, 10, .8) + FC(14, 8.5, .8) + FC(15.5, 14, .8) + FC(9.5, 15.5, .8),
    'gift': R(3, 9, 18, 5, 1, 1) + R(5, 14, 14, 7, 1, 1) + P('M12 9v12M12 9C10 5 6 5 7 7.5S12 9 12 9zm0 0c2-4 6-4 5-1.5S12 9 12 9z'), 'ribbon': P('M12 9C8 4 3 5 4 9s8 0 8 0zm0 0c4-5 9-4 8 0s-8 0-8 0z', 1) + P('M12 9l-4 12M12 9l4 12') + FC(12, 9, 1.6),
    'balloon': P('M12 2.5a6 6 0 0 1 6 6.5c0 4-3 7-6 7.5-3-.5-6-3.5-6-7.5A6 6 0 0 1 12 2.5z', 1) + P('M11 16.5h2l-1 1.5M12 18c-1 2 1 2.5 0 4'), 'party': P('M3 21l4.5-13L16 16.5z', 1) + P('M12 4l1 2M18 3l-1 3.5M20 9l-3 1M14 9c1-1.5 3-1.5 4-.5') + FC(17, 13, .9) + FC(10, 3, .9),
    'confetti': C(12, 8, 5, 1) + P('M12 13v8M9 12.5L6 18M15 12.5l3 5.5') + FC(4, 5, .9) + FC(20, 5, .9) + FC(5, 12, .8) + FC(19.5, 12, .8),
    'fireworks': P('M12 12L12 3M12 12l6.4-6.4M12 12h9M12 12l6.4 6.4M12 12v9M12 12l-6.4 6.4M12 12H3M12 12L5.6 5.6') + FC(12, 12, 1.6),
    'ferris': C(12, 10, 7, 1) + P('M12 3v14M5 10h14M7 5l10 10M17 5L7 15M8 21l4-11 4 11') + FC(12, 10, 1.4), 'disco': C(12, 13, 7.5, 1) + P('M4.5 13h15M12 5.5v15M6.5 8h11M6.5 18h11M8.5 6.5c-1.5 4-1.5 9 0 13M15.5 6.5c1.5 4 1.5 9 0 13M12 2v3.5'),
    'yoyo': C(10, 14, 6.5, 1) + C(10, 14, 2.5) + P('M10 7.5V3c4 0 9 1 10 5'), 'teddy': C(12, 13, 6.5, 1) + C(6.5, 6, 2.3) + C(17.5, 6, 2.3) + FC(10, 12, .9) + FC(14, 12, .9) + P('M10.5 15.5a2 2 0 0 0 3 0'),
    'coin': C(12, 12, 9, 1) + C(12, 12, 6) + P('M12 9v6'), 'suitcase': R(3, 7, 18, 13, 2, 1) + P('M9 7V4.5h6V7M3 12h18M9 12v2M15 12v2'), 'barrel': P('M6 4h12a14 14 0 0 1 0 16H6A14 14 0 0 1 6 4z', 1) + P('M4.5 9h15M4.5 15h15'),
    'buoy': C(12, 12, 9, 1) + C(12, 12, 4) + P('M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6'), 'siren': P('M6 18v-6a6 6 0 0 1 12 0v6', 1) + P('M4 18h16v3H4zM12 2v2M3.5 6l1.5 1.5M20.5 6L19 7.5M10 12a2 2 0 0 1 2-2'),
    'rocket': P('M12 2.5c3.5 2 5.5 6 5 11l-2.5 2.5h-5L7 13.5c-.5-5 1.5-9 5-11z', 1) + C(12, 9.5, 1.8) + P('M9.5 16l-2 4.5 4.5-2 4.5 2-2-4.5M7 13.5l-3 2 1 3M17 13.5l3 2-1 3'),
    'plane': P('M21 3L3 10.5l7 2.5 2.5 7z', 1) + P('M10 13l11-10'), 'train': R(5, 3, 14, 15, 4, 1) + P('M5 11h14M8.5 21l2-3M15.5 21l-2-3') + FC(8.5, 14.5, 1) + FC(15.5, 14.5, 1), 'metro': R(5, 3, 14, 15, 2, 1) + P('M5 12h14M12 3v9M8 21l2-3M16 21l-2-3') + FC(8.5, 15, 1) + FC(15.5, 15, 1),
    'elevator': R(4, 3, 16, 18, 1.5, 1) + P('M12 3v18M7 9l2-2 2 2M13 15l2 2 2-2'), 'tap': P('M4 9h9a3 3 0 0 1 3 3v2h3v-2a6 6 0 0 0-6-6H4z', 1) + P('M7 6V3h4M17.5 17.5v.01M17.5 21v.01'),
    'church': P('M12 2v4M10 4h4M6 21V11l6-5 6 5v10', 1) + P('M3 21h18M10 21v-5h4v5'), 'torii': P('M3 5c6 1.5 12 1.5 18 0M5 9h14M7 5.6V21M17 5.6V21M12 6v3'), 'castle': P('M4 21V10l2-1V6h2v3l4-3 4 3V6h2v3l2 1v11z', 1) + P('M10 21v-4h4v4M3 21h18'),
    'columns': P('M3 9l9-5 9 5z', 1) + P('M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M4 18h16'), 'building': R(5, 3, 14, 18, 1, 1) + P('M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-3h3v3'),
    'factory': P('M3 21V10l5 3V10l5 3V10l5 3V4h3v17z', 1) + P('M7 17h2M12 17h2M17 17h1'), 'stadium': P('M2 9c0-2 4.5-3.5 10-3.5S22 7 22 9v8c0 2-4.5 3.5-10 3.5S2 19 2 17z', 1) + P('M2 9c0 2 4.5 3.5 10 3.5S22 11 22 9M6 12v7M12 12.5v8M18 12v7'),
    'rabbit': P('M8 21c-2 0-4-2-4-4.5S6 11 10 11c1 0 1.5-1 1-3L10 3c2 0 3.5 3 3.5 5l1-5c2 1 2 4 1 6.5 3 1 4.5 3.5 4.5 6.5 0 3-2 5-5 5z', 1) + FC(15.5, 13, .9),
    'bee': P('M7 13a5 4 0 0 1 10 0v1a5 4 0 0 1-10 0z', 1) + P('M9.5 9.5v8.5M14.5 9.5v8.5M12 9.5V6M10 4l2 2 2-2') + P('M8 9C5 9 3 7 4 5s4 0 5 3M16 9c3 0 5-2 4-4s-4 0-5 3'),
    'squid': P('M12 2.5c3 2 4.5 5 4.5 8.5H7.5c0-3.5 1.5-6.5 4.5-8.5z', 1) + P('M8 11v4c0 2-1.5 3-2 6M10.5 11v9M13.5 11v9M16 11v4c0 2 1.5 3 2 6') + FC(10, 8, .8) + FC(14, 8, .8),
    'lungs': P('M12 3v8M12 9c0 2-2 1.5-3 0M12 9c0 2 2 1.5 3 0') + P('M9 7C6 6.5 3.5 10 3.5 15c0 3 1.5 4.5 3.5 4.5S10 18 10 15V9z', 1) + P('M15 7c3-.5 5.5 3 5.5 8 0 3-1.5 4.5-3.5 4.5S14 18 14 15V9z', 1),
    'goggles': P('M2 12c0-3 2-4 5-4h10c3 0 5 1 5 4s-2 4-4 4c-2.5 0-3-2-6-2s-3.5 2-6 2-4-1-4-4z', 1) + P('M10.5 12h3'), 'shades': P('M2 9h20M3 9l1 5a3 3 0 0 0 6 0l1-5M13 9l1 5a3 3 0 0 0 6 0l1-5', 1),
    'telescope': P('M4 12l13-6 2 4-13 6z', 1) + P('M9 14l-2 7M11 13l3 8M17 6l3-1 1.5 3-3 1.5'), 'orb': C(12, 10.5, 7, 1) + P('M6 20.5h12l-1.5-3h-9zM9 8a3.5 3.5 0 0 1 3-2'),
    'hourglass': P('M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9') + F('M9.5 19.5h5l-2.5-3z'), 'stopwatch': C(12, 13.5, 7.5, 1) + P('M12 13.5V9.5M10 2.5h4M12 2.5v3.5M18 6.5l1.5-1.5'),
    'clock': C(12, 12, 9, 1) + P('M12 7v5h-4'), 'alarm': C(12, 13, 7.5, 1) + P('M12 9v4l2.5 2M3 5.5L6 3M21 5.5L18 3M6.5 20l-1.5 2M17.5 20l1.5 2'),
    'mantel-clock': P('M6 21V11a6 6 0 0 1 12 0v10z', 1) + C(12, 11.5, 3.5) + P('M12 9.5v2h1.5M4 21h16'),
    'vs-badge': R(2, 5, 20, 14, 3, 1) + P('M5.5 8.5l2.3 7 2.3-7M18.5 9.3a2.4 2.4 0 0 0-2-.8c-1.2 0-2 .7-2 1.6 0 2.3 4.2 1.4 4.2 3.7 0 1-.9 1.8-2.2 1.8a2.7 2.7 0 0 1-2.3-1'),
    'access': C(12, 4.5, 1.8) + P('M7 8l5 1 5-1M12 9v5l-3 7M12 14l3 7'), 'recycle': P('M8 7l2-3.5a2 2 0 0 1 3.5 0L16 8M14 8h2.5V5.5M7 13l-2.5 4a2 2 0 0 0 1.8 3H10M7.5 20.5L10 20l-.5-2.5M17 13l2.5 4.5a2 2 0 0 1-1.8 2.8H14M17 16.5l-.2 2.5 2.5.2'),
    'chain': P('M9 15l6-6') + P('M10.5 6.5l1.5-1.5a4 4 0 0 1 6 6l-1.5 1.5M13.5 17.5L12 19a4 4 0 0 1-6-6l1.5-1.5'), 'eye-cross': P('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 1) + C(12, 12, 3),
    'shrine': P('M3 6c6 1.5 12 1.5 18 0M5 10h14M7 6.6V21M17 6.6V21'),
    // brand-neutral replacements
    'stream-chat': P('M4 4h16v11.5h-6.5L9 19.5v-4H4z', 1) + FC(9, 9.8, 1.2) + FC(12.5, 9.8, 1.2) + FC(16, 9.8, 1.2),
    'bracket': P('M3 4.5h5v5H3zM3 14.5h5v5H3z', 1) + P('M8 7h3v10H8M11 12h3') + P('M14 9.5h7v5h-7z', 1),
  };
  // colour swatches: the old coloured circles and squares meant a colour, so they keep it
  const SW = { 'swatch-red': '#e5484d', 'swatch-blue': '#3b82f6', 'swatch-orange': '#f97316', 'swatch-yellow': '#facc15', 'swatch-green': '#22c55e', 'swatch-brown': '#a16207', 'swatch-white': '#f5f5f5', 'swatch-black': '#18181b' };
  for (const [k, c] of Object.entries(SW)) I[k] = `<circle cx="12" cy="12" r="7" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
  I['square-red'] = `<rect x="5" y="5" width="14" height="14" rx="2" fill="#e5484d" stroke="none"/>`; I['square-blue'] = I['square-red'].replace('#e5484d', '#3b82f6');
  I['square-orange'] = I['square-red'].replace('#e5484d', '#f97316'); I['square-brown'] = I['square-red'].replace('#e5484d', '#a16207');
  I['diamond-blue'] = `<path d="M12 3l8 9-8 9-8-9z" fill="#3b82f6" stroke="none"/>`; I['triangle-red'] = `<path d="M5 8h14l-7 10z" fill="#e5484d" stroke="none"/>`;
  I['triangle-red-up'] = `<path d="M5 16h14l-7-10z" fill="#e5484d" stroke="none"/>`;
  I['medal-gold'] = I.medal; I['medal-silver'] = I.medal; I['medal-bronze'] = I.medal;

  // the full-colour versions (on stream): a colour, and a soft fill for the body
  const COLOR = { trophy: '#f6c453', crown: '#f6c453', star: '#ffd84a', 'star-glow': '#ffd84a', sparkles: '#ffe27a', flame: '#ff6a1f', bolt: '#ffd84a', heart: '#ff4d6d', 'heart-beat': '#ff4d6d',
    mic: '#e8ecf3', swords: '#dfe3ea', dagger: '#dfe3ea', skull: '#f2f2f2', medal: '#f6c453', 'medal-gold': '#f6c453', 'medal-silver': '#cfd6e0', 'medal-bronze': '#d08a4e', burst: '#ffb020',
    snowflake: '#bfe9ff', 'ice-cube': '#bfe9ff', drop: '#4fd1ff', chat: '#c3a2ff', 'stream-chat': '#c3a2ff', tv: '#7fd0ff', speaker: '#e8ecf3', bell: '#ffd84a', wave: '#4fd1ff', leaf: '#5ee08a',
    blossom: '#ff9ec7', gamepad: '#c3a2ff', diamond: '#ffd84a', vs: '#ffffff', 'vs-badge': '#ffffff', confetti: '#ff7ab8', party: '#ff7ab8', balloon: '#ff5f7a', 'wave-hand': '#ffd08a', sun: '#ffd84a' };

  // ---------------------------------------------------------------------------------- the old emojis → icons
  const E = {
    '←': 'arrow-left', '⬅': 'arrow-left', '⇠': 'arrow-left', '⇤': 'arrow-left-bar', '→': 'arrow-right', '➡': 'arrow-right', '⇢': 'arrow-right', '⇥': 'arrow-right-bar',
    '↑': 'arrow-up', '⬆': 'arrow-up', '⇡': 'arrow-up', '↓': 'arrow-down', '⬇': 'arrow-down', '⇣': 'arrow-down', '↔': 'arrows-h', '⇹': 'arrows-h-bar', '↕': 'arrows-v', '⇕': 'arrows-v',
    '⏫': 'double-up', '⏬': 'double-down', '⇄': 'swap', '🔀': 'shuffle', '↩': 'hook-left', '↪': 'hook-right', '↶': 'undo', '↺': 'undo', '🔙': 'undo', '↷': 'redo', '↻': 'refresh', '🔄': 'refresh', '🔁': 'repeat',
    '▶': 'play', '▸': 'caret-right', '⏪': 'rewind', '⏭': 'skip', '⏸': 'pause', '⏹': 'stop', '■': 'stop', '⏺': 'record', '▲': 'caret-up', '🔼': 'triangle-red-up', '▼': 'caret-down', '▾': 'caret-down', '🔻': 'triangle-red', '🔽': 'triangle-red',
    '●': 'dot', '⚫': 'swatch-black', '⚪': 'swatch-white', '○': 'ring', '⭕': 'ring', '◌': 'ring-dotted', '🔴': 'swatch-red', '🔵': 'swatch-blue', '🟠': 'swatch-orange', '🟡': 'swatch-yellow', '🟢': 'swatch-green',
    '⬛': 'square', '🔲': 'square-o', '⬜': 'square-o', '▫': 'square-small', '🟥': 'square-red', '🟦': 'square-blue', '🟧': 'square-orange', '🟫': 'square-brown', '◆': 'diamond', '🔷': 'diamond-blue', '◩': 'half-square', '⬡': 'hexagon',
    '★': 'star', '⭐': 'star', '🌟': 'star-glow', '✨': 'sparkles', '💫': 'dizzy', '🌠': 'shooting-star', '☄': 'comet', '🔯': 'star6',
    '✓': 'check', '✔': 'check', '✅': 'check-box', '✕': 'close', '✖': 'close', '❌': 'close-box', '➕': 'plus', '➖': 'minus', '❓': 'help', '⚠': 'warning', '⛔': 'no-entry', '🚫': 'forbid',
    '☰': 'menu', '⚙': 'gear', '🔍': 'search', '🔎': 'search', '👁': 'eye', '🙈': 'eye-off', '🔒': 'lock', '🔓': 'unlock', '🔗': 'link', '🔔': 'bell', '💬': 'chat', '📍': 'pin', '📌': 'pushpin',
    '📋': 'clipboard', '🗑': 'trash', '💾': 'save', '📁': 'folder', '📂': 'folder-open', '📄': 'page', '📃': 'page-curl', '📓': 'notebook', '📖': 'book', '📜': 'scroll', '📰': 'news',
    '📈': 'chart-up', '📊': 'chart-bars', '📏': 'ruler', '📐': 'set-square', '📛': 'badge', '🏷': 'label', '🪪': 'id-card', '🧾': 'receipt', '📤': 'tray-out', '📥': 'tray-in', '📦': 'box', '🗂': 'tabs',
    '🖼': 'image', '📱': 'phone', '📳': 'phone-buzz', '📶': 'signal', '📡': 'dish', '📷': 'camera', '📸': 'camera-flash', '📺': 'tv', '🖥': 'monitor', '🎞': 'film', '📼': 'cassette', '🎥': 'movie-camera', '🎬': 'clapper',
    '🔊': 'speaker', '🔉': 'speaker-low', '🔇': 'speaker-off', '🎙': 'mic', '🎚': 'slider', '🎛': 'knobs', '🔌': 'plug', '🔦': 'torch', '🖨': 'printer',
    '✂': 'scissors', '✏': 'pencil', '✎': 'pencil', '🖊': 'pen', '🖋': 'pen', '🖌': 'brush', '🖍': 'crayon', '✍': 'hand-write', '🔧': 'wrench', '🔨': 'hammer', '🛠': 'tools', '⚒': 'pick-hammer', '🔩': 'nut-bolt', '🧲': 'magnet',
    '🗜': 'clamp', '🧹': 'broom', '🧽': 'sponge', '🩹': 'bandage', '🪄': 'wand', '🗿': 'statue', '🪞': 'mirror', '🪟': 'window', '🚪': 'door', '🪜': 'ladder', '🧱': 'bricks', '🪢': 'knot', '🧵': 'thread', '🧶': 'yarn',
    '🧮': 'abacus', '🧭': 'compass', '🧬': 'dna', '🧪': 'flask', '🩺': 'stethoscope', '🧠': 'brain', '🧩': 'puzzle', '⌨': 'keyboard', '🔤': 'abc', '🔠': 'abc', '🔢': 'numbers', '🔣': 'symbols', '🅰': 'letter-a',
    '🆚': 'vs-badge', '🤼': 'team-vs', '▁': 'lower-bar', '🈁': 'stamp-jp', '🈷': 'stamp-jp', '🀄': 'card', '🎴': 'card', '🃏': 'card', '🁢': 'domino', '🎲': 'dice', '🎰': 'slots', '🎹': 'piano', '🥁': 'drum', '🪗': 'accordion', '🎯': 'target',
    '🎮': 'gamepad', '🕹': 'joystick', '👾': 'invader', '🎨': 'palette', '🎭': 'masks', '🎽': 'shirt', '🏀': 'ball', '🏁': 'checkered-flag', '🏳': 'flag', '🎌': 'flags-crossed', '🎏': 'windsock',
    '🏅': 'medal', '🥇': 'medal-gold', '🥈': 'medal-silver', '🥉': 'medal-bronze', '🏆': 'trophy', '👑': 'crown', '♛': 'crown', '♟': 'pawn', '⚔': 'swords', '🗡': 'dagger', '🪓': 'axe', '🔫': 'blaster', '🛡': 'shield', '⚖': 'scales',
    '🥊': 'boxing-glove', '🥋': 'gi', '🤛': 'fist-l', '🤜': 'fist-r', '🤝': 'handshake', '👋': 'wave-hand', '🖐': 'hand', '👤': 'person', '🧑': 'person', '👥': 'people', '🧗': 'climber', '🏊': 'swimmer', '🏋': 'lifter',
    '👻': 'ghost', '💀': 'skull', '☠': 'skull', '🙂': 'face-smile', '😖': 'face-wince', '🤐': 'face-zip', '🤠': 'face-hat', '🥶': 'face-cold', '🫠': 'face-melt', '🫥': 'face-dotted', '🫨': 'face-shake',
    '☀': 'sun', '🔆': 'brightness', '🌅': 'sunrise', '🌄': 'sunrise-mountain', '🌙': 'moon', '🌑': 'moon-new', '🌘': 'moon-wane', '🌃': 'night', '🌌': 'galaxy', '🌍': 'globe', '🌐': 'globe', '🪐': 'planet',
    '🌡': 'thermometer', '🌈': 'rainbow', '🌊': 'wave', '🌋': 'volcano', '🌧': 'rain', '🌦': 'sun-rain', '⛈': 'storm', '🌩': 'storm', '🌪': 'tornado', '🌫': 'fog', '🌬': 'wind', '💨': 'wind', '❄': 'snowflake',
    '🧊': 'ice-cube', '⛄': 'snowman', '🌸': 'blossom', '🌿': 'leaf', '💧': 'drop', '🩸': 'drop', '🫧': 'bubbles', '🔥': 'flame', '⚡': 'bolt', '💥': 'burst', '💢': 'anger', '🌀': 'spiral', '♨': 'steam', '🪨': 'rock', '🪵': 'wood',
    '🕳': 'hole', '🕸': 'web', '❤': 'heart', '💓': 'heart-beat', '💗': 'heart-grow', '💔': 'heart-broken', '💡': 'bulb', '🕯': 'candle', '☕': 'cup', '🥃': 'glass', '🫗': 'pour', '🍮': 'jelly', '🥔': 'potato',
    '🎁': 'gift', '🎀': 'ribbon', '🎈': 'balloon', '🎉': 'party', '🎊': 'confetti', '🎆': 'fireworks', '🎡': 'ferris', '🪩': 'disco', '🪀': 'yoyo', '🧸': 'teddy', '🪙': 'coin', '🧳': 'suitcase', '🛢': 'barrel', '🛟': 'buoy',
    '🚨': 'siren', '🚀': 'rocket', '✈': 'plane', '🚄': 'train', '🚇': 'metro', '🛗': 'elevator', '🚰': 'tap', '⛪': 'church', '⛩': 'torii', '🏯': 'castle', '🏛': 'columns', '🏢': 'building', '🏭': 'factory', '🏟': 'stadium',
    '🐇': 'rabbit', '🐝': 'bee', '🦑': 'squid', '🫁': 'lungs', '🥽': 'goggles', '🕶': 'shades', '🔭': 'telescope', '🔮': 'orb', '⏳': 'hourglass', '⏱': 'stopwatch', '🕘': 'clock', '⏰': 'alarm', '🕰': 'mantel-clock',
    '♿': 'access', '♻': 'recycle', '⛓': 'chain',
  };
  const chars = Object.keys(E).sort((a, b) => b.length - a.length).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RX = new RegExp(`(?:${chars.join('|')})\\uFE0F?`, 'gu'), RX1 = new RegExp(RX.source, 'u');
  const nameOf = ch => E[ch.replace(/️/g, '')];

  function svg(name, o = {}) {
    const body = I[name]; if (body == null) return '';
    const col = o.color && (COLOR[name] || o.color === true ? (COLOR[name] || 'currentColor') : o.color);
    const medal = { 'medal-gold': '#f6c453', 'medal-silver': '#cfd6e0', 'medal-bronze': '#d08a4e' }[name];
    const c = typeof o.color === 'string' ? o.color : medal || col || 'currentColor';
    return `<svg class="bi-s${o.color ? ' bi-c' : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="${c}" stroke-width="${o.weight || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="--bc:${c}">${body}</svg>`;
  }
  const html = (name, o = {}) => I[name] == null ? '' : `<i class="bi bi-${name}${o.color ? ' bi-col' : ''}" aria-hidden="true">${svg(name, o)}</i>`;
  const strip = t => String(t == null ? '' : t).replace(new RegExp(`${RX.source}\\s?`, 'gu'), '').replace(/^\s+/, '');

  // ---------------------------------------------------------------------------------- styles
  const CSS = `.bi{display:inline-flex;align-items:center;justify-content:center;width:1.15em;height:1.15em;vertical-align:-.2em;flex:none;line-height:1}
.bi svg{width:100%;height:100%;overflow:visible}svg.bi-s{fill:none!important;stroke:var(--bc,currentColor)}svg.bi-s .f{fill:var(--bc,currentColor)!important;stroke:none}svg.bi-c .b{fill:var(--bc)!important;fill-opacity:.28}
.bi+.bi{margin-left:.15em}`;
  function style(doc = document) { if (doc.getElementById('bi-css')) return; const s = doc.createElement('style'); s.id = 'bi-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

  // ---------------------------------------------------------------------------------- swap emojis for icons in a page
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'CODE', 'PRE', 'svg', 'SVG', 'TITLE', 'NOSCRIPT']);
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];
  function skip(el, stop) {
    for (let n = el; n && n !== stop; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      if (SKIP.has(n.tagName) || n.isContentEditable || n.classList.contains('bi') || n.hasAttribute('data-noicon')) return true;
    }
    return false;
  }
  function convert(rootEl, opts = {}) {
    if (!rootEl) return;
    const doc = rootEl.ownerDocument || rootEl;
    if (rootEl.nodeType === 3) { if (rootEl.parentNode) convert(rootEl.parentNode, opts); return; }
    const w = doc.createTreeWalker(rootEl, 4), hits = [];
    for (let t = w.nextNode(); t; t = w.nextNode()) if (RX1.test(t.data)) hits.push(t);
    for (const t of hits) {
      if (!t.parentNode || skip(t.parentNode, null)) continue;
      const frag = doc.createDocumentFragment(); let last = 0; const s = t.data; RX.lastIndex = 0; let m;
      while ((m = RX.exec(s))) {
        if (m.index > last) frag.appendChild(doc.createTextNode(s.slice(last, m.index)));
        const name = nameOf(m[0]), i = doc.createElement('i'); i.className = 'bi bi-' + name + (opts.color ? ' bi-col' : ''); i.setAttribute('aria-hidden', 'true'); i.innerHTML = svg(name, opts);
        frag.appendChild(i); last = m.index + m[0].length;
      }
      if (last < s.length) frag.appendChild(doc.createTextNode(s.slice(last)));
      t.parentNode.replaceChild(frag, t);
    }
    // places that can't hold a picture: tooltips, placeholders, menu entries, the window title
    const els = rootEl.querySelectorAll ? rootEl.querySelectorAll(ATTRS.map(a => `[${a}]`).join(',') + ',option,optgroup[label]') : [];
    for (const el of [rootEl, ...els]) {
      if (el.nodeType !== 1) continue;
      for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && RX1.test(v)) el.setAttribute(a, strip(v)); }
      if (el.tagName === 'OPTION' && RX1.test(el.textContent)) el.textContent = strip(el.textContent);
      if (el.tagName === 'OPTGROUP' && RX1.test(el.label)) el.label = strip(el.label);
    }
    if (doc.title && RX1.test(doc.title)) doc.title = strip(doc.title);
  }
  // keep doing it as the page changes (the panel and the Designer build most of their text on the fly)
  function watch(doc = document, opts = {}) {
    style(doc);
    const go = () => convert(doc.body || doc.documentElement, opts);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    let queued = new Set(), raf = 0;
    const flush = () => { raf = 0; const list = [...queued]; queued = new Set(); for (const n of list) if (n.isConnected) convert(n, opts); };
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v && RX1.test(v)) m.target.setAttribute(m.attributeName, strip(v)); continue; }
        if (m.type === 'characterData') { if (RX1.test(m.target.data)) queued.add(m.target); continue; }
        for (const n of m.addedNodes) if ((n.nodeType === 3 && RX1.test(n.data)) || (n.nodeType === 1 && RX1.test(n.textContent + ATTRS.map(a => n.getAttribute(a) || '').join('')) ) || (n.nodeType === 1 && n.querySelector && n.querySelector(ATTRS.map(a => `[${a}]`).join(',')))) queued.add(n);
      }
      if (queued.size && !raf) raf = requestAnimationFrame(flush);
    }).observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // the browser's own dialogs are plain text
    const W = doc.defaultView;
    if (W && !W.__biDialogs) { W.__biDialogs = true; for (const k of ['alert', 'confirm', 'prompt']) { const f = W[k]; if (typeof f === 'function') W[k] = function (msg, ...rest) { return f.call(W, strip(msg), ...rest); }; } }
  }

  // ---------------------------------------------------------------------------------- brush marks (drawn, not typed)
  // The Oni and ink splashes stamp a big brush mark. These are drawn strokes on a 100 × 100 grid, so they need no
  // Japanese font on the PC and look the same everywhere.
  const MARKS = {
    win: 'M14 18v52q-1 14-8 22M14 18h20v68q0 6-6 4M15 40h18M15 60h18M50 12l5 10M78 10l-6 12M44 30h46M48 44h38M66 28q-6 22-24 34M66 30q10 22 28 32M52 66h28q0 22-10 28M64 66q-4 18-20 28',
    versus: 'M24 10l2 10M8 28h34M14 36q12 24 28 38M38 36q-12 28-30 46M50 36h44M80 14v72q0 8-10 4M60 54l6 10',
  };
  function mark(name, o = {}) {
    const d = MARKS[name]; if (!d) return '';
    return `<svg class="bi-mark" viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true"><path d="${d}" fill="none" stroke="${o.color || 'currentColor'}" stroke-width="${o.weight || 9}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  root.BI = { svg, html, strip, convert, watch, style, mark, names: Object.keys(I), map: E, has: n => I[n] != null, test: s => RX1.test(String(s || '')) };
})(typeof window !== 'undefined' ? window : globalThis);
