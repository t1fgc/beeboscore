/* BeeboScore (developed by Beebo) — the Layout Designer runtime's core (split out of sb-design.js in 1.12.11, unchanged):
 * the catalogues (fonts, shapes, transitions, text effects…), the design defaults and normalising, the geometry, the paints,
 * the data (live values, filters, the sample match), the runtime's CSS, the cracks, the text helpers and the bracket piece's
 * drawing. sb-design.js (the instance: mount, toSVG, the live boot) takes them from window.__SBDCore.
 * Served as part of /sb-design.js, before sb-design.js. */
(function () {
  'use strict';
  if (window.__SBDCore) return;
  const W = 1920, H = 1080, NS = 'http://www.w3.org/2000/svg';
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;

  // =============================================================================================== catalogue
  // f: bundled font file (public/fonts) — loaded on demand, so unused fonts cost nothing
  const FONTS = {
    saira: { css: "'Saira Condensed','Arial Narrow',Impact,sans-serif", weight: 800, label: 'Saira (Ember)', group: 'Classic' },
    chakra: { css: "'Chakra Petch','Segoe UI',sans-serif", weight: 700, label: 'Chakra Petch', group: 'Classic' },
    impact: { css: "Impact,'Arial Black',sans-serif", weight: 400, label: 'Impact', group: 'Classic' },
    arial: { css: "'Arial Black',Arial,sans-serif", weight: 900, label: 'Arial Black', group: 'Classic' },
    georgia: { css: "Georgia,'Times New Roman',serif", weight: 700, label: 'Georgia', group: 'Classic' },
    segoe: { css: "'Segoe UI',system-ui,sans-serif", weight: 700, label: 'Segoe UI', group: 'Classic' },
    // 1.12.13: the Default layout's own lettering — always in capitals (even where nothing asks for it), digits all one width
    beebo: { css: "'Beebo Classic','Segoe UI',system-ui,sans-serif", weight: 700, label: 'Beebo Classic', group: 'Classic', f: 'beebo-classic-latin-700-normal' },
    marker: { css: "'Permanent Marker',cursive", weight: 400, label: 'Permanent Marker', group: 'Graffiti', f: 'permanent-marker-latin-400-normal' },
    sedgwick: { css: "'Sedgwick Ave Display',cursive", weight: 400, label: 'Sedgwick Ave Display', group: 'Graffiti', f: 'sedgwick-ave-display-latin-400-normal' },
    wetpaint: { css: "'Rubik Wet Paint',cursive", weight: 400, label: 'Rubik Wet Paint', group: 'Graffiti', f: 'rubik-wet-paint-latin-400-normal' },
    blackops: { css: "'Black Ops One',Impact,sans-serif", weight: 400, label: 'Black Ops One', group: 'Harsh', f: 'black-ops-one-latin-400-normal' },
    metal: { css: "'Metal Mania',serif", weight: 400, label: 'Metal Mania', group: 'Harsh', f: 'metal-mania-latin-400-normal' },
    russo: { css: "'Russo One',sans-serif", weight: 400, label: 'Russo One', group: 'Harsh', f: 'russo-one-latin-400-normal' },
    rocker: { css: "'New Rocker',serif", weight: 400, label: 'New Rocker', group: 'Harsh', f: 'new-rocker-latin-400-normal' },   // 1.12.9: the Top 8 title
    bungee: { css: "'Bungee',sans-serif", weight: 400, label: 'Bungee', group: 'Bubbly', f: 'bungee-latin-400-normal' },
    fredoka: { css: "'Fredoka',sans-serif", weight: 700, label: 'Fredoka', group: 'Bubbly', f: 'fredoka-latin-700-normal' },
    bubbles: { css: "'Rubik Bubbles',sans-serif", weight: 400, label: 'Rubik Bubbles', group: 'Bubbly', f: 'rubik-bubbles-latin-400-normal' },
    patrick: { css: "'Patrick Hand',cursive", weight: 400, label: 'Patrick Hand', group: 'Cozy', f: 'patrick-hand-latin-400-normal' },
    comfortaa: { css: "'Comfortaa',sans-serif", weight: 700, label: 'Comfortaa', group: 'Cozy', f: 'comfortaa-latin-700-normal' },
    chewy: { css: "'Chewy',cursive", weight: 400, label: 'Chewy', group: 'Cute', f: 'chewy-latin-400-normal' },
    sniglet: { css: "'Sniglet',sans-serif", weight: 800, label: 'Sniglet', group: 'Cute', f: 'sniglet-latin-800-normal' },
    bangers: { css: "'Bangers',Impact,sans-serif", weight: 400, label: 'Bangers', group: 'Dynamic', f: 'bangers-latin-400-normal' },
    racing: { css: "'Racing Sans One',sans-serif", weight: 400, label: 'Racing Sans One', group: 'Dynamic', f: 'racing-sans-one-latin-400-normal' },
    teko: { css: "'Teko',sans-serif", weight: 700, label: 'Teko', group: 'Dynamic', f: 'teko-latin-700-normal' },
    audiowide: { css: "'Audiowide',sans-serif", weight: 400, label: 'Audiowide', group: 'Dynamic', f: 'audiowide-latin-400-normal' },
    shojumaru: { css: "'Shojumaru',serif", weight: 400, label: 'Shojumaru', group: 'Martial', f: 'shojumaru-latin-400-normal' },
    cinzel: { css: "'Cinzel',serif", weight: 900, label: 'Cinzel', group: 'Martial', f: 'cinzel-latin-900-normal' },
    kaushan: { css: "'Kaushan Script',cursive", weight: 400, label: 'Kaushan Script', group: 'Martial', f: 'kaushan-script-latin-400-normal' },
    yuji: { css: "'Yuji Syuku',serif", weight: 400, label: 'Yuji Syuku', group: 'Martial', f: 'yuji-syuku-latin-400-normal' },
    mincho: { css: "'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP','MS Mincho',serif", weight: 900, label: 'Mincho (brush)', group: 'Martial' },
    // the fonts of the built-in looks (Frostbite, Venom, Gold Rush, Sakura, Tidal, Voltage, Chrome)
    michroma: { css: "'Michroma',sans-serif", weight: 400, label: 'Michroma', group: 'Tech', f: 'michroma-latin-400-normal' },
    orbitron: { css: "'Orbitron',sans-serif", weight: 900, label: 'Orbitron', group: 'Tech', f: 'orbitron-latin-900-normal' },
    exo2: { css: "'Exo 2',sans-serif", weight: 900, label: 'Exo 2 (italic)', group: 'Tech', f: 'exo-2-latin-900-italic', style: 'italic' },
    righteous: { css: "'Righteous',sans-serif", weight: 400, label: 'Righteous', group: 'Dynamic', f: 'righteous-latin-400-normal' },
    creepster: { css: "'Creepster',cursive", weight: 400, label: 'Creepster', group: 'Harsh', f: 'creepster-latin-400-normal' },
    alfaslab: { css: "'Alfa Slab One',serif", weight: 400, label: 'Alfa Slab One', group: 'Classic', f: 'alfa-slab-one-latin-400-normal' },
    playfair: { css: "'Playfair Display',serif", weight: 800, label: 'Playfair Display (italic)', group: 'Classic', f: 'playfair-display-latin-800-italic', style: 'italic' },
  };
  const FONT_FACES = Object.values(FONTS).filter(f => f.f).map(f => `@font-face{font-family:${f.css.split(',')[0]};font-weight:${f.weight};${f.style ? `font-style:${f.style};` : ''}font-display:swap;src:url(/static/fonts/${f.f}.woff2) format('woff2')}`).join('\n');
  const EFFECTS = {
    none: { label: 'None', emoji: '·' },
    embers: { label: 'Embers', emoji: '🔥', tip: 'Sparks drift up off the edge; a fountain of sparks on every point.' },
    lightning: { label: 'Lightning', emoji: '⚡', tip: 'Electric arcs crackle along the edges; bolts burst out on a point.' },
    pulse: { label: 'Glow pulse', emoji: '💡', tip: 'The outline breathes with light; a bright flash and shockwave on a point.' },
    shine: { label: 'Shine', emoji: '✨', tip: 'A glint of light sweeps across; a double flash on a point.' },
    cracks: { label: 'Cracks', emoji: '💥', tip: 'Glowing glass cracks pulse inside; they race outward on a point.' },
  };
  const TRANSITIONS = {
    none: { label: 'None', emoji: '·' },
    shatter: { label: 'Shatter', emoji: '🪟', tip: 'Flares white-hot out of broken glass. Splash screens leave by breaking apart.' },
    slash: { label: 'Slash', emoji: '🗡️', tip: 'A blade of light cuts across and reveals it.' },
    ignite: { label: 'Ignite', emoji: '🔥', tip: 'Burns in from white heat, text decodes, embers fly.' },
    glitch: { label: 'Glitch', emoji: '📺', tip: 'Jitters in through scanline slices and colour splits.' },
    slam: { label: 'Slam', emoji: '💢', tip: 'Drops in huge and slams down with a shockwave.' },
    fade: { label: 'Fade', emoji: '🌫️', tip: 'Simply fades in. Calm and clean.', simple: true },
    slide: { label: 'Slide', emoji: '➡️', tip: 'Slides in from a side you choose.', simple: true },
    pop: { label: 'Pop', emoji: '🎈', tip: 'Pops up from small with a little bounce.', simple: true },
    wipe: { label: 'Wipe', emoji: '🧽', tip: 'Wiped on from one side.', simple: true },
    drop: { label: 'Drop', emoji: '⬇️', tip: 'Falls in from above and settles.', simple: true },
    blurin: { label: 'Focus', emoji: '🔍', tip: 'Comes into focus from a blur.', simple: true },
    spin: { label: 'Spin', emoji: '🌀', tip: 'Spins in while growing.', simple: true },
    type: { label: 'Typewriter', emoji: '⌨️', tip: 'Text types itself out letter by letter (other pieces fade).', simple: true },
    flip: { label: '3D flip', emoji: '🃏', tip: 'Turns in like a card, catching the light as it faces you.', simple: true },
    custom: { label: 'Your own', emoji: '🎛️', tip: 'Set where it starts — offset, size, turn and see-through — and it moves into place.', simple: true },
  };
  // idle: a gentle loop while the piece is on screen · react: a one-off when something happens
  const IDLE = { none: { label: 'None', emoji: '·' }, float: { label: 'Float', emoji: '🎈' }, pulse: { label: 'Pulse', emoji: '💓' }, breathe: { label: 'Breathe', emoji: '🫁' }, sway: { label: 'Sway', emoji: '🌿' }, bob: { label: 'Bob', emoji: '🛟' }, spin: { label: 'Spin', emoji: '🌀' }, shine: { label: 'Shine', emoji: '✨' }, flicker: { label: 'Flicker', emoji: '💡' },
    letterwave: { label: 'Letter wave', emoji: '🌊' }, voice: { label: 'Talks with the commentary', emoji: '🎙️' }, beat: { label: 'On the beat', emoji: '🥁' } };   // 1.12.15
  const REACT = { none: { label: 'Nothing', emoji: '·' }, pulse: { label: 'Pulse', emoji: '💓' }, shake: { label: 'Shake', emoji: '🫨' }, flash: { label: 'Flash', emoji: '⚡' }, bounce: { label: 'Bounce', emoji: '🏀' }, pop: { label: 'Pop', emoji: '🎈' }, spin: { label: 'Spin', emoji: '🌀' }, glow: { label: 'Glow', emoji: '🌟' } };
  const TEXTANIM = { none: { label: 'Just change', emoji: '·' }, decode: { label: 'Decode', emoji: '🔣' }, type: { label: 'Type', emoji: '⌨️' }, fade: { label: 'Fade', emoji: '🌫️' }, flip: { label: 'Flip', emoji: '🔄' }, slide: { label: 'Slide up', emoji: '⬆️' }, pop: { label: 'Pop', emoji: '🎈' } };
  const PARTICLES = { none: { label: 'None', emoji: '·' }, smoke: { label: 'Smoke', emoji: '💨' }, shards: { label: 'Shards', emoji: '🪟' }, embers: { label: 'Embers', emoji: '🔥' }, snow: { label: 'Snow', emoji: '❄️' }, sparks: { label: 'Sparks', emoji: '✨' }, bubbles: { label: 'Bubbles', emoji: '🫧' }, confetti: { label: 'Confetti', emoji: '🎊' }, dust: { label: 'Dust', emoji: '🌫️' }, stars: { label: 'Twinkles', emoji: '⭐' }, rain: { label: 'Rain', emoji: '🌧️' } };
  // extra screens: full-screen ones cover the game; the others sit on top of it
  const SCREENS = {
    starting: { label: 'Starting soon', emoji: '⏳', full: true }, brb: { label: 'Be right back', emoji: '☕', full: true }, ending: { label: 'Thanks for watching', emoji: '👋', full: true },
    top8: { label: 'Top 8', emoji: '🏆', full: true, brk: true }, bracket: { label: 'Bracket splash', emoji: '🗂️', full: true, brk: true }, standings: { label: 'Top 8 standings', emoji: '🏅', full: true, brk: true }, card: { label: 'Player card', emoji: '🪪', full: true }, twitch: { label: 'Socials', emoji: '💬', full: true },
    lower: { label: 'Lower third', emoji: '📛', full: false }, ticker: { label: 'Ticker', emoji: '📰', full: false }, camera: { label: 'Camera frames', emoji: '🎥', full: false },
    custom: { label: 'Custom screen', emoji: '🧩', full: true },
    fvs: { label: 'Format: Team VS', emoji: '⚔️', full: true, fmt: true }, fboard: { label: 'Format: board', emoji: '📋', full: true, fmt: true }, fwin: { label: 'Format: champion', emoji: '🏆', full: true, fmt: true },
  };
  // rules: show a piece only when something is true
  const RULE_OPS = { truthy: 'is on / not empty', falsy: 'is off / empty', eq: 'is', ne: 'is not', contains: 'contains', gt: 'is more than', lt: 'is less than' };
  function condOk(c, V) {
    if (!c || !c.field) return true;
    const raw = pick(V, c.field), v = raw == null || raw === false ? '' : String(raw), t = String(c.value ?? '');
    switch (c.op) {
      case 'falsy': return !v || v === '0';
      case 'eq': return v.toLowerCase() === t.toLowerCase();
      case 'ne': return v.toLowerCase() !== t.toLowerCase();
      case 'contains': return v.toLowerCase().includes(t.toLowerCase());
      case 'gt': return Number(v) > Number(t);
      case 'lt': return Number(v) < Number(t);
      default: return !!v && v !== '0';
    }
  }
  // a rule: one condition (older layouts) or several, all of them or any of them. `any` on a condition is a second field
  // that also counts (e.g. "P1 at match point" or "P2 at match point").
  function ruleOk(rule, V) {
    if (!rule || !rule.on) return true;
    const conds = Array.isArray(rule.conds) && rule.conds.length ? rule.conds : rule.field ? [{ field: rule.field, op: rule.op, value: rule.value, any: rule.any }] : [];
    if (!conds.length) return true;
    const res = conds.map(c => condOk(c, V) || (c.any ? condOk({ ...c, field: c.any }, V) : false));
    return rule.mode === 'any' ? res.some(Boolean) : res.every(Boolean);
  }
  const TEXTFX = {
    none: { label: 'None', emoji: '·' },
    flame: { label: 'Flame', emoji: '🔥', tip: 'The letters burn with flickering flames.' },
    glow: { label: 'Heavenly glow', emoji: '🌟', tip: 'A soft, breathing halo of light.' },
    outline: { label: 'Outline', emoji: '🖊️', tip: 'A crisp line around every letter — great for readability.' },
    shadow: { label: 'Drop shadow', emoji: '🕶️', tip: 'A solid offset shadow that pops off busy backgrounds.' },
    extrude: { label: '3D extrude', emoji: '🧊', tip: 'The letters stand out in 3D: a solid side in the effect colour runs down and to the right. Size sets how deep.' },   // 1.12.15
    neon: { label: 'Neon tube', emoji: '🔆', tip: 'The letters drawn as a lit tube: hollow, with a glow round the line, inside and out, that slowly breathes. Size sets how thick the tube is.' },   // 1.12.14
  };
  const WHEN = { always: 'Always', lead: 'While ahead', matchpoint: 'At match point', winner: 'When they win' };
  const FXL = window.SBFX || null;            // sb-fx.js + sb-fx-moves.js: the big box of looks and moves
  const OUTS = {};
  // BeeboFX 2 (1.11): screens drawn into a picture and moved on the graphics card — in both galleries, as 'gx-<id>'
  const FX2 = window.BeeboFX2 || null;
  if (FX2) for (const t of Object.values(FX2.TRANSITIONS)) {
    const v = { label: t.label, emoji: t.emoji, cat: 'BeeboFX 2 · graphics card', gx: t.id, dur: 1100, tip: `Drawn on the graphics card (BeeboFX 2) with lighting, motion blur and a time ramp you can change. Without the effects engine it plays as “${t.fb}”.` };
    TRANSITIONS['gx-' + t.id] = v; OUTS['gx-' + t.id] = v;
  }
  if (FXL) {
    for (const [k, v] of Object.entries(FXL.INS)) if (!TRANSITIONS[k]) TRANSITIONS[k] = v;
    for (const [k, v] of Object.entries(FXL.OUTS)) OUTS[k] = v;
    for (const [k, v] of Object.entries(FXL.REACTS)) if (!REACT[k]) REACT[k] = v;
    for (const [k, v] of Object.entries(FXL.TEXTS)) if (!TEXTANIM[k]) TEXTANIM[k] = v;
  }
  // 1.10: sixteen reactions drawn by the effects engine (sparks, a shockwave, Electrocuted…). Without the engine they fall
  // back to a flash of the piece (Electrocuted: its jolt and the plain lightning).
  // 1.12.15: GPU reactions — the piece itself bends on the graphics card (BeeboFX 2's shaders, there and back)
  for (const [k, label, emoji, gxp, peak, dur, tip] of [
    ['gxp-ripple', 'Ripple through', '🌊', 'ripple', .32, .9, 'A ripple runs through the piece and it settles again.'],
    ['gxp-shock', 'Shockwave', '💫', 'shockwave', .3, .8, 'A ring of force bends the piece outward from its middle.'],
    ['gxp-split', 'Colour split', '🌈', 'chroma', .35, .55, 'The piece splits into red, green and blue for a moment.'],
    ['gxp-heat', 'Heat haze', '♨️', 'heat', .4, 1.1, 'The piece wavers like air over fire.'],
    ['gxp-glitch', 'Glitch hit', '📺', 'glitch2', .3, .5, 'A burst of digital glitch tears through the piece.'],
    ['gxp-twist', 'Twist', '🌀', 'swirl', .22, .8, 'The piece twists round its middle and unwinds.'],
  ]) REACT[k] = { label, emoji, gxp, peak, dur, group: 'Graphics card', tip: tip + ' Drawn on the graphics card (a flash without it).' };
  if (window.BeeboFX && window.BeeboFX.EFFECTS) for (const [k, v] of Object.entries(window.BeeboFX.EFFECTS)) REACT['gfx-' + k] = { label: v.label, emoji: v.emoji, gfx: k, group: 'Effects engine', tip: `${v.label}, drawn by the effects engine (a flash without it).` };

  // shapes: polygons in a 0..1 box (the element scales them)
  const star = (n, inner) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? inner : .5; return [.5 + Math.cos(a) * r, .5 + Math.sin(a) * r]; });
  const ellipse = Array.from({ length: 56 }, (_, i) => { const a = i / 56 * Math.PI * 2; return [.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5]; });
  const SHAPES = {
    rect: { label: 'Box', pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    pill: { label: 'Pill', pts: [[0, 0], [1, 0], [1, 1], [0, 1]], pill: true },
    ellipse: { label: 'Circle', pts: ellipse },
    triangle: { label: 'Triangle', pts: [[.5, 0], [1, 1], [0, 1]] },
    para: { label: 'Slant', pts: [[.16, 0], [1, 0], [.84, 1], [0, 1]] },
    hex: { label: 'Hexagon', pts: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]] },
    diamond: { label: 'Diamond', pts: [[.5, 0], [1, .5], [.5, 1], [0, .5]] },
    chevron: { label: 'Chevron', pts: [[0, 0], [.78, 0], [1, .5], [.78, 1], [0, 1], [.22, .5]] },
    star: { label: 'Star', pts: star(5, .21) },
    shard: { label: 'Shard', pts: [[.08, 0], [1, .12], [.86, 1], [0, .82]] },
    octagon: { label: 'Octagon', pts: [[.3, 0], [.7, 0], [1, .3], [1, .7], [.7, 1], [.3, 1], [0, .7], [0, .3]] },
    cross: { label: 'Cross', pts: [[.35, 0], [.65, 0], [.65, .35], [1, .35], [1, .65], [.65, .65], [.65, 1], [.35, 1], [.35, .65], [0, .65], [0, .35], [.35, .35]] },
    arrow: { label: 'Arrow', pts: [[0, .3], [.6, .3], [.6, 0], [1, .5], [.6, 1], [.6, .7], [0, .7]] },
    bolt: { label: 'Bolt', pts: [[.55, 0], [.12, .58], [.45, .58], [.3, 1], [.9, .4], [.56, .4], [.78, 0]] },
    ribbon: { label: 'Ribbon', pts: [[0, 0], [1, 0], [.9, .5], [1, 1], [0, 1], [.1, .5]] },
    custom: { label: 'Your shape', pts: [[0, 0], [1, 0], [1, 1], [0, 1]], hidden: true },
    dome: { label: 'Half circle', pts: Array.from({ length: 29 }, (_, i) => { const a = Math.PI + i / 28 * Math.PI; return [.5 + Math.cos(a) * .5, 1 + Math.sin(a)]; }) },
    // Shattered's own outlines
    shattered: { label: 'Ember plate', pts: [[0, 0], [1, 0], [1, .45], [.844, .45], [.826, .62], [.826, 1], [.028, 1], [0, .74]], inset: [.04, .2] },
    blade: { label: 'Blade', pts: [[0, 0], [1, 0], [.955, 1], [.03, 1], [0, .72]], inset: [.04, .06] },
    tab: { label: 'Tab', pts: [[0, 0], [1, 0], [1, .68], [.946, 1], [.054, 1], [0, .68]] },
    trap: { label: 'Trapezoid', pts: [[.04, 0], [.96, 0], [1, 1], [0, 1]] },
    banner: { label: 'Banner', pts: [[0, 0], [1, 0], [.94, 1], [.06, 1]] },
  };

  // =============================================================================================== defaults
  const F = (...colors) => ({ type: colors.length > 1 ? 'linear' : 'solid', colors, angle: 180 });
  const BASE = { x: 100, y: 100, w: 300, h: 120, rot: 0, opacity: 1, shape: 'rect', flip: false, radius: 0, cuts: [],
    fill: F('#17181d', '#0b0c0f', '#050507'), stroke: { color: '#ff5a1f', width: 1.5, glow: 6 },
    font: { family: 'saira', color: F('#ffffff', '#d9dce4'), size: 1, italic: true, upper: true },
    effect: { type: 'none', color: '#ff5a1f', when: 'always' }, enter: { type: 'ignite', delay: 0 } };
  // the score box on a player bar (100 × 72 box)
  const SCORE_SHAPES = { skew: 'M12,0H100L88,72H0Z', box: 'M0,0H100V72H0Z', round: 'M18,0H82Q100,0 100,18V54Q100,72 82,72H18Q0,72 0,54V18Q0,0 18,0Z', hex: 'M18,0H82L100,36L82,72H18L0,36Z',
    circle: 'M50,0A50,36 0 1 1 49.9,0Z', shield: 'M0,0H100V44Q100,62 50,72Q0,62 0,44Z', diamond: 'M50,0L100,36L50,72L0,36Z', notch: 'M14,0H100V58L86,72H0V14Z', star: 'M50,0L63,22L96,22L70,42L80,72L50,56L20,72L30,42L4,22L37,22Z' };
  const KIND = {
    bar: { w: 650, h: 70, shape: 'shattered', side: 1, accent: F('#1c1d23', '#07070a'), teamColor: '#ff5a1f', scoreColor: '#ffffff', subColor: '#8d919d',
      showTeam: true, showFlag: true, showSub: true, showScore: true, winColor: '#f6c453', loseStyle: 'crack',
      effect: { type: 'embers', color: '#ff5a1f', when: 'matchpoint' } },
    header: { w: 300, h: 50, shape: 'tab', teamColor: '#ff5a1f', enter: { type: 'ignite', delay: .15 } },
    comms: { w: 420, h: 42, shape: 'trap', teamColor: '#ff5a1f', font: { family: 'saira', color: F('#ffffff'), size: 1, italic: false, upper: false }, enter: { type: 'slash', delay: .4 } },
    logo: { w: 220, h: 220, shape: 'rect', radius: 18, fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#ffffff', width: 0, glow: 0 }, src: '', imgOpacity: 1, pad: 10, fit: 'contain', enter: { type: 'slam', delay: .3 } },
    shape: { w: 240, h: 160, shape: 'rect', fill: F('#ff5a1f', '#a3180a'), stroke: { color: '#ffb36b', width: 0, glow: 0 }, enter: { type: 'none', delay: 0 } },
    text: { w: 700, h: 120, shape: 'rect', fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#ffffff', width: 0, glow: 0 }, text: 'VICTORY', align: 'center',
      font: { family: 'saira', color: F('#ffffff', '#ffd0a0', '#ff5a1f'), size: 1, italic: true, upper: true }, enter: { type: 'slam', delay: .2 } },
    ticker: { w: 1920, h: 56, shape: 'rect', fill: { type: 'linear', colors: ['#14161d', '#0b0c0f'], angle: 180 }, stroke: { color: '#ffb020', width: 0, glow: 0 }, source: 'text', text: 'Welcome to the stream!  ·  Follow for more  ·  {event}', key: 'list', sep: '   ◆   ', speed: 90, font: { family: 'chakra', size: .5, color: { type: 'solid', colors: ['#ffffff'], angle: 180 }, italic: false, upper: true } },
    list: { w: 520, h: 200, shape: 'rect', fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#ffffff', width: 0, glow: 0 }, source: 'comms', dir: 'down', gap: 6, max: 4, rowH: 44, tpl: '{item.display}',
      font: { family: 'chakra', color: F('#ffffff'), size: 1, italic: false, upper: true }, enter: { type: 'slash', delay: .2 } },
    three: { w: 360, h: 360, shape: 'rect', fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#ffffff', width: 0, glow: 0 }, t3: {}, enter: { type: 'slam', delay: .2 } },
    // the live bracket (start.gg or the viewer tournament): every match in columns with lines to the next one
    bracket: { w: 1760, h: 800, shape: 'rect', fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#3a3d48', width: 0, glow: 0 }, show: 'auto',
      card: { fill: F('#1a1b22', '#0d0e12'), stroke: '#3a3d48', radius: 6, lines: '#5d6170' }, teamColor: '#ff5a1f', winColor: '#f6c453', subColor: '#8d919d', scoreColor: '#ffffff',
      font: { family: 'chakra', color: F('#ffffff'), size: 1, italic: false, upper: true }, enter: { type: 'fade', delay: .2 } },
    avatar: { w: 260, h: 260, shape: 'shard', side: 1, fill: F('#ffd0a0', '#ff5a1f', '#a3180a'), stroke: { color: '#ffb36b', width: 0, glow: 0 }, frame: 6, enter: { type: 'slam', delay: .3 } },
    // 1.12.21: score pips — one for every game it takes to win the set, filling as games are won. A set longer than `max` hides
    // them (the number in the score box says it). pip: a shape; ratio: its width to its height; the deciding pip pulses at match point
    pips: { w: 96, h: 22, shape: 'rect', fill: { type: 'none', colors: ['#000000'], angle: 180 }, stroke: { color: '#ffffff', width: 0, glow: 0 }, side: 1, pip: 'diamond', gap: 6, max: 5, ratio: 1,
      onColor: '#f6c453', offColor: '#8d919d', offFill: '', winColor: '', pulse: true, enter: { type: 'fade', delay: .4 } },
  };
  function make(kind, over = {}) {
    const k = KIND[kind] || {};
    const el = { ...structuredClone(BASE), ...structuredClone(k), kind, id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    deepAssign(el, structuredClone(over));
    return el;
  }
  function deepAssign(t, s) { for (const [k, v] of Object.entries(s || {})) { if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deepAssign(t[k], v); else t[k] = v; } return t; }
  function normEl(e) { const base = make(e.kind || 'shape'); return deepAssign(base, e); }
  function normalize(d) {
    d = d && typeof d === 'object' ? structuredClone(d) : {};
    d.v = 1; d.title = d.title || 'My layout'; d.game = d.game || 'Any game';
    d.scenes = d.scenes || {};
    // transitions made in the transition editor (1.11): a BeeboFX 2 transition with its own settings, used as 'tr-<key>'
    d.transitions = (Array.isArray(d.transitions) ? d.transitions : []).filter(t => t && /^[\w-]{1,24}$/.test(String(t.key || '')) && t.base).slice(0, 60).map(t => ({
      key: String(t.key), name: String(t.name || 'My transition').slice(0, 40), base: String(t.base).slice(0, 24), dur: Math.max(.2, Math.min(4, Number(t.dur) || 1.1)),
      ramp: Array.isArray(t.ramp) ? t.ramp.slice(0, 12).map(p => [Math.max(0, Math.min(1, +p[0] || 0)), Math.max(0, Math.min(1, +p[1] || 0))]) : String(t.ramp || 'smooth').slice(0, 20),
      color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#ff5a1f', angle: Math.round(Number(t.angle) || 0) % 360, origin: Array.isArray(t.origin) ? [Math.max(0, Math.min(1, +t.origin[0] || .5)), Math.max(0, Math.min(1, +t.origin[1] || .5))] : [.5, .5],
      intensity: Math.max(0, Math.min(2, Number(t.intensity ?? 1))), blur: t.blur !== false, seed: Math.round(Number(t.seed) || 7) }));
    for (const k of ['board', 'vs', 'victory', ...Object.keys(d.scenes).filter(k => !['board', 'vs', 'victory'].includes(k))]) {
      const sc = d.scenes[k] = d.scenes[k] || {};
      sc.elements = (sc.elements || []).map(normEl);
      if (k !== 'board') {
        const extra = !['vs', 'victory'].includes(k), full = !extra || (SCREENS[sc.kind] || SCREENS.custom).full !== false;
        if (extra) { sc.kind = SCREENS[sc.kind] ? sc.kind : 'custom'; sc.name = sc.name || SCREENS[sc.kind].label; }
        sc.bg = sc.bg || (full ? F('#07080c', '#141824') : { type: 'none', colors: ['#000000'], angle: 180 });
        sc.transIn = sc.transIn || (extra ? (full ? 'fade' : 'slide') : 'shatter'); sc.transOut = sc.transOut || (sc.transIn === 'none' ? 'none' : sc.transIn === 'slide' ? 'slide' : sc.transIn);
        sc.effect = sc.effect || (extra ? 'none' : 'embers'); sc.effectColor = sc.effectColor || '#ff5a1f';
      }
      sc.particles = sc.particles || { type: 'none', color: '#ffb020', amount: 40, speed: 1, size: 1, dir: 0 };
      if (!Array.isArray(sc.atmos)) sc.atmos = [];
      for (const el of sc.elements) if (!Array.isArray(el.looks)) el.looks = [];
    }
    // feel: '' = the plain curves, or a spring from the motion kit (sb-motion.js) for every simple entrance that has no feel of its own
    d.motion = { speed: 1, reduced: false, feel: '', blur: true, squash: true, ...(d.motion || {}) };
    d.gfx = { preset: '', intensity: 1, ...(d.gfx || {}) };       // BeeboFX: the look's effects preset ('' = backdrops only)
    const lo = d.art ? 16 : 320;            // art (icons, Stream Deck keys, the panel's theme pieces) can be tiny
    const cl = (v, dflt) => Math.max(lo, Math.min(3840, Math.round(Number(v) || dflt)));
    d.size = { w: cl(d.size && d.size.w, 1920), h: cl(d.size && d.size.h, 1080) };
    d.sound = { on: false, volume: .6, pack: 'shattered', ...(d.sound || {}) };
    if (!['shattered', 'oni', 'none'].includes(d.sound.pack)) d.sound.pack = 'shattered';
    return d;
  }

  // =============================================================================================== geometry
  function clipHalf(poly, a, b, keep) {
    const side = p => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * keep;
    const hit = (p, q) => { const sp = side(p), sq = side(q), t = sp / (sp - sq); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length], sc = side(cur), sp = side(prev);
      if (sc >= 0) { if (sp < 0) out.push(hit(prev, cur)); out.push(cur); } else if (sp >= 0) out.push(hit(prev, cur));
    }
    return out;
  }
  const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  function polyOf(el) {
    let p = (el.shape === 'custom' && Array.isArray(el.pts) && el.pts.length >= 3 ? el.pts : (SHAPES[el.shape] || SHAPES.rect).pts).map(q => q.slice());
    if (el.flip) p = p.map(([x, y]) => [1 - x, y]).reverse();
    for (const c of el.cuts || []) { const n = clipHalf(p, c.a, c.b, c.keep); if (n.length >= 3) p = n; }
    return p;
  }
  // a scissor cut: keep the bigger piece (returns the cut, or null if the line misses the shape)
  function cutFor(el, a, b) {
    const p = polyOf(el), A = clipHalf(p, a, b, 1), B = clipHalf(p, a, b, -1);
    if (A.length < 3 || B.length < 3) return null;
    const aa = area(A), bb = area(B), tot = area(p);
    if (Math.min(aa, bb) < tot * .004) return null;
    return { a, b, keep: aa >= bb ? 1 : -1, piece: aa >= bb ? B : A };
  }
  function roundedPath(pts, r) {
    const n = pts.length; if (n < 3) return '';
    if (!r) return 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const a = [p1[0] + (p0[0] - p1[0]) / l1 * rr, p1[1] + (p0[1] - p1[1]) / l1 * rr], b = [p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr];
      d += (i ? 'L' : 'M') + `${a[0].toFixed(1)},${a[1].toFixed(1)}Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    }
    return d + 'Z';
  }
  // holes (1.11): round windows cut out of a piece, so whatever is under it shows through — Shattered's plates fill in
  // around the game's round counters and leave the counters themselves clear. [x, y] are fractions of the piece (mirrored
  // with it), r is in pixels. Each hole runs the other way round from the outline, so it cuts out under either fill rule.
  function holesPath(el, w, h, pts) {
    const hs = Array.isArray(el.holes) ? el.holes.filter(q => Array.isArray(q) && q.length >= 3) : [];
    if (!hs.length) return '';
    let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    const sweep = a > 0 ? 0 : 1;
    return hs.map(([x, y, r]) => { const cx = (el.flip ? 1 - x : x) * w, cy = y * h, R = Math.max(1, Number(r) || 1);
      return `M${(cx + R).toFixed(1)},${cy.toFixed(1)}A${R},${R} 0 1 ${sweep} ${(cx - R).toFixed(1)},${cy.toFixed(1)}A${R},${R} 0 1 ${sweep} ${(cx + R).toFixed(1)},${cy.toFixed(1)}Z`; }).join('');
  }
  function pathFor(el, w = el.w, h = el.h, grow = 0, noHoles) {
    const pts = polyOf(el).map(([x, y]) => [x * w, y * h]);
    const r = (SHAPES[el.shape] || {}).pill ? Math.min(w, h) / 2 : Number(el.radius) || 0;
    return roundedPath(pts, r + grow) + (noHoles ? '' : holesPath(el, w, h, pts));
  }

  // =============================================================================================== paint
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cols = f => (f && Array.isArray(f.colors) && f.colors.length ? f.colors.slice(0, 6) : ['#ffffff']);
  const TEXTURES = {
    carbon: { label: 'Carbon', css: (a, b, k) => `repeating-linear-gradient(45deg, ${b} 0 ${2 * k}px, transparent ${2 * k}px ${4 * k}px), repeating-linear-gradient(-45deg, ${b} 0 ${2 * k}px, ${a} ${2 * k}px ${4 * k}px)`,
      svg: (a, b, k) => `<rect width="${8 * k}" height="${8 * k}" fill="${a}"/><path d="M0 0L${8 * k} ${8 * k}M${8 * k} 0L0 ${8 * k}" stroke="${b}" stroke-width="${2 * k}"/>`, size: 8 },
    hex: { label: 'Hexagons', css: (a, b, k) => `radial-gradient(circle at 50% 50%, transparent ${5 * k}px, ${b} ${5 * k}px ${6 * k}px, transparent ${6 * k}px) 0 0/${12 * k}px ${10 * k}px, ${a}`,
      svg: (a, b, k) => `<rect width="${24 * k}" height="${42 * k}" fill="${a}"/><path d="M${12 * k} 0L${24 * k} ${7 * k}V${21 * k}L${12 * k} ${28 * k}L0 ${21 * k}V${7 * k}Z M${12 * k} ${28 * k}V${42 * k}" fill="none" stroke="${b}" stroke-width="${1.2 * k}"/>`, size: [24, 42] },
    stripes: { label: 'Stripes', css: (a, b, k) => `repeating-linear-gradient(135deg, ${a} 0 ${6 * k}px, ${b} ${6 * k}px ${9 * k}px)`,
      svg: (a, b, k) => `<rect width="${10 * k}" height="${10 * k}" fill="${a}"/><path d="M-1 ${11 * k}L${11 * k} -1" stroke="${b}" stroke-width="${3 * k}"/>`, size: 10 },
    dots: { label: 'Dots', css: (a, b, k) => `radial-gradient(${b} ${1.5 * k}px, transparent ${1.8 * k}px) 0 0/${8 * k}px ${8 * k}px, ${a}`,
      svg: (a, b, k) => `<rect width="${8 * k}" height="${8 * k}" fill="${a}"/><circle cx="${4 * k}" cy="${4 * k}" r="${1.6 * k}" fill="${b}"/>`, size: 8 },
    grid: { label: 'Grid', css: (a, b, k) => `linear-gradient(${b} 1px, transparent 1px) 0 0/${16 * k}px ${16 * k}px, linear-gradient(90deg, ${b} 1px, ${a} 1px) 0 0/${16 * k}px ${16 * k}px`,
      svg: (a, b, k) => `<rect width="${16 * k}" height="${16 * k}" fill="${a}"/><path d="M0 0H${16 * k}M0 0V${16 * k}" stroke="${b}" stroke-width="1"/>`, size: 16 },
    noise: { label: 'Grain', css: (a, b) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .18 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E"), ${a}`,
      svg: (a, b, k) => `<rect width="120" height="120" fill="${a}"/><filter id="nzF"><feTurbulence baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .18 0"/></filter><rect width="120" height="120" filter="url(#nzF)"/>`, size: 120 },
    paper: { label: 'Paper', css: (a, b) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.04' numOctaves='4'/%3E%3CfeColorMatrix values='0 0 0 0 .4 0 0 0 0 .35 0 0 0 0 .3 0 0 0 .12 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23p)'/%3E%3C/svg%3E"), ${a}`,
      svg: (a, b, k) => `<rect width="200" height="200" fill="${a}"/><filter id="ppF"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="4"/><feColorMatrix values="0 0 0 0 .4 0 0 0 0 .35 0 0 0 0 .3 0 0 0 .12 0"/></filter><rect width="200" height="200" filter="url(#ppF)"/>`, size: 200 },
  };
  function cssPaint(f) {
    if (!f || f.type === 'none') return 'transparent';
    const c = cols(f);
    if (f.type === 'radial' && c.length > 1) return `radial-gradient(circle at ${f.cx ?? 50}% ${f.cy ?? 50}%, ${c.join(', ')})`;
    if (f.type === 'texture') { const t = TEXTURES[f.tex] || TEXTURES.carbon; return t.css(c[0], c[1] || mix(c[0], '#ffffff', .25), Number(f.scale) || 1); }
    if (f.type === 'image' && f.src) return `url("${String(f.src).replace(/"/g, '%22')}") center/${f.fit === 'tile' ? 'auto' : 'cover'} ${f.fit === 'tile' ? 'repeat' : 'no-repeat'}, ${c[0]}`;
    return f.type === 'linear' && c.length > 1 ? `linear-gradient(${Number(f.angle) || 0}deg, ${c.join(', ')})` : c[0];
  }
  function svgGrad(f, id) {
    const c = cols(f), a = (Number(f.angle) || 0) * Math.PI / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
    return `<linearGradient id="${id}" x1="${(.5 - dx).toFixed(3)}" y1="${(.5 - dy).toFixed(3)}" x2="${(.5 + dx).toFixed(3)}" y2="${(.5 + dy).toFixed(3)}">`
      + c.map((x, i) => `<stop offset="${c.length === 1 ? 0 : i / (c.length - 1)}" stop-color="${esc(x)}"/>`).join('') + '</linearGradient>';
  }
  function svgPaint(f, id, defs) {
    if (!f || f.type === 'none') return 'none';
    const c = cols(f);
    if (f.type === 'linear' && c.length > 1) { defs.push(svgGrad(f, id)); return `url(#${id})`; }
    if (f.type === 'radial' && c.length > 1) { defs.push(`<radialGradient id="${id}" cx="${(f.cx ?? 50) / 100}" cy="${(f.cy ?? 50) / 100}" r="${(f.r ?? 70) / 100}">` + c.map((x, i) => `<stop offset="${i / (c.length - 1)}" stop-color="${esc(x)}"/>`).join('') + '</radialGradient>'); return `url(#${id})`; }
    if (f.type === 'texture') {
      const t = TEXTURES[f.tex] || TEXTURES.carbon, k = Number(f.scale) || 1, sz = Array.isArray(t.size) ? t.size : [t.size, t.size];
      defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${sz[0] * (f.tex === 'noise' || f.tex === 'paper' ? 1 : k)}" height="${sz[1] * (f.tex === 'noise' || f.tex === 'paper' ? 1 : k)}">${t.svg(esc(c[0]), esc(c[1] || mix(c[0], '#ffffff', .25)), k).replace(/id="(nzF|ppF)"/g, `id="$1${id}"`).replace(/url\(#(nzF|ppF)\)/g, `url(#$1${id})`)}</pattern>`);
      return `url(#${id})`;
    }
    if (f.type === 'image' && f.src) {
      defs.push(`<pattern id="${id}" patternContentUnits="objectBoundingBox" width="1" height="1"><rect width="1" height="1" fill="${esc(c[0])}"/><image href="${esc(f.src)}" width="1" height="1" preserveAspectRatio="${f.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}"/></pattern>`);
      return `url(#${id})`;
    }
    return c[0];
  }
  function hexRgb(c) {
    const m = String(c || '').trim().match(/^#([0-9a-f]{3,8})$/i); if (!m) return [255, 255, 255];
    let h = m[1]; if (h.length <= 4) h = h.split('').map(x => x + x).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const lum = c => { const [r, g, b] = hexRgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };
  const mix = (c, t, k) => { const a = hexRgb(c), b = hexRgb(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  // Readable small text on a plate: the colour as chosen when it already reads at `min`:1 against the plate behind it,
  // else nudged toward black or white just far enough. `seen` turns a colour into how it really shows (a faded loser line).
  const relL = c => { const [r, g, b] = hexRgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const contrast = (a, b) => { const x = relL(a), y = relL(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  // 1.12.21: the ink for lettering that sits ON a colour (a score chip, a tag): near-black or white, whichever reads better
  const inkOn = c => (/^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) && contrast('#111111', c) < contrast('#ffffff', c) ? '#ffffff' : '#111111');
  function readable(c, bg, min = 4.5, seen = x => x) {
    if (contrast(seen(c), bg) >= min) return c;
    const to = contrast('#000000', bg) > contrast('#ffffff', bg) ? '#000000' : '#ffffff';
    for (let k = .1; k < 1; k += .1) { const t = mix(c, to, k); if (contrast(seen(t), bg) >= min) return t; }
    return to;
  }
  // the colour of a bar's plate around its second line (three quarters of the way down), in each state
  function plateTone(el, state) {
    if (el.tones && el.tones[state]) return el.tones[state];       // measured by the layout's maker (textures and sheen the fill alone doesn't tell)
    const cs = cols(el.fill).filter(x => /^#[0-9a-f]{3,8}$/i.test(x)); let base = cs.length ? cs[0] : '#101010';
    for (let i = 1; i < cs.length; i++) base = mix(base, cs[i], 1 / (i + 1));
    if (cs.length > 1) base = mix(base, cs[cs.length - 1], .35);
    if (state === 'win') return mix(el.winColor || '#f6c453', '#000000', .22);
    if (state === 'lose') return mix(base, '#000000', .45);
    return base;
  }
  function textPaint(node, f) {
    const p = cssPaint(f);
    if (p.startsWith('linear')) { node.style.background = p; node.style.webkitBackgroundClip = 'text'; node.style.backgroundClip = 'text'; node.style.color = 'transparent'; }
    else { node.style.background = 'none'; node.style.color = p; }
  }

  // =============================================================================================== data
  function view(s) {
    s = s || {};
    const p1 = s.p1 || {}, p2 = s.p2 || {}, w = s.winnerSide || (s.victory && s.victory.side) || 0;
    const lead = w || (Number(p1.score) >= Number(p2.score) ? 1 : 2);
    return { ...s, p1, p2, winner: lead === 2 ? p2 : p1, loser: lead === 2 ? p1 : p2, c1: s.c1 || {}, c2: s.c2 || {}, ...moreValues(s, p1, p2, w), ...formatValues(s.fv) };
  }
  // 1.12.21: {gameNo} / {gameText} (the game being played), {setTimer} (how long the set has run), {h2h.line} (the head-to-head
  // line, while it's switched on: {h2h.on}), and the moment banner that's up — {moment.title}, {moment.text}, {moment.kind},
  // {moment.name}; {moment.on} / {lane} to show a piece only then
  const clockText = ms => { const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), q = t % 60, z = n => String(n).padStart(2, '0'); return h ? `${h}:${z(m)}:${z(q)}` : `${z(m)}:${z(q)}`; };
  function moreValues(s, p1, p2, w) {
    const x = s.x || {}, sbo = x.sb || {}, s1 = Number(p1.score) || 0, s2 = Number(p2.score) || 0;
    const gameNo = sbo.nogame || !(Number(s.firstTo) > 1) ? '' : s1 + s2 + (w ? 0 : 1);
    const tm = x.timer || null, setTimer = tm ? clockText((Number(tm.ms) || 0) + (tm.run ? Date.now() - (tm.__at || Date.now()) : 0)) : '';
    const hist = s.hist || {}, line = hist.line === 'First meeting' ? 'First meeting on stream' : String(hist.line || ''), mo = x.mo || null;
    // the Designer's sample (state.__sample): something for a piece to say while it's being styled — a banner that isn't up is still off
    const smp = s.__sample ? { a: p1.name || 'CrimsonByte', b: p2.name || 'NeonGhoul' } : null;
    const h2hOn = !!(s.h2h && s.h2h.show) && !!line && !(s.format && s.format.status === 'live');      // (the Designer's sample has a format's values in fv, but no format running)
    return { gameNo, gameText: gameNo ? `Game ${gameNo}` : '', setTimer: setTimer || (smp ? '12:34' : ''),
      h2h: { show: s.h2h && s.h2h.show ? 'yes' : '', on: h2hOn && !mo ? 'yes' : '', line, lead: line.split(' · ')[0], last: (t => (t ? t[0].toUpperCase() + t.slice(1) : ''))(line.split(' · ')[1] || ''), score: hist.total ? `${hist.a}–${hist.b}` : '', a: hist.total ? hist.a : '', b: hist.total ? hist.b : '' },
      moment: mo ? { on: 'yes', kind: String(mo.kind || ''), title: String(mo.title || ''), text: String(mo.text || ''), name: String(mo.name || ''), side: mo.side || '', p1: mo.side === 1 ? 'yes' : '', p2: mo.side === 2 ? 'yes' : '', n: mo.n || 0 }
        : smp ? { on: '', kind: '', title: 'Match point', text: `${smp.a} is one game from the set`, name: smp.a, side: '' } : { on: '', kind: '', title: '', text: '', name: '', side: '' },
      // what this set has been (kept after the banner, for the screens that follow): {story.title} is "Sweep", "Reverse sweep", "Upset" or "Bracket reset"
      story: (st => ({ end: st.end ? String(st.end.kind || '') : '', title: st.end ? String(st.end.title || '') : '', text: st.end ? String(st.end.text || '') : '', runback: st.runback ? String(st.runback.text || '') : '', run: st.run ? String(st.run.text || '') : '' }))(x.story || (smp ? { end: { kind: 'sweep', title: 'Sweep', text: `${smp.a} wins 3–0 without dropping a game` }, runback: { text: `${smp.a} won 2–1 in Winners Semi-Final earlier today` }, run: { text: `${smp.b} has won 4 sets in a row in losers` } } : {})),
      lane: mo || h2hOn ? 'yes' : '',
      // 1.12.23: the tale of the set (lib/tale.js) — {tale.win} where the winner goes ("Advances to Winners Final"), {tale.lose}
      // where the loser goes ("Eliminated · 5th place"), {tale.badge} Victory's banner ("Flawless 3–0", "Reverse sweep", "Upset",
      // "Bracket reset"), {tale.mid} the stats strip's middle (head-to-head or runback), {tale.p1.line} / {tale.p2.line} each
      // side's seed and record today, {tale.strip} when the strip has something to say
      tale: (t => ({ win: String(t.win || ''), lose: String(t.lose || ''), badge: t.badge ? String(t.badge.title || '') : '', badgeKind: t.badge ? String(t.badge.kind || '') : '', mid: String(t.mid || ''),
        strip: t.strip ? 'yes' : '', runback: t.runback ? 'yes' : '', p1: { line: String((t.p1 && t.p1.line) || ''), seed: (t.p1 && t.p1.seed) || '', today: String((t.p1 && t.p1.today) || '') }, p2: { line: String((t.p2 && t.p2.line) || ''), seed: (t.p2 && t.p2.seed) || '', today: String((t.p2 && t.p2.today) || '') } }))(
        x.tale || (smp ? { win: 'Advances to Winners Final', lose: 'Drops to Losers', badge: { kind: 'sweep', title: 'Flawless 3–0' }, mid: `${smp.a} leads 3–1 · last time ${smp.b} won 3–2`, strip: true, p1: { line: 'Seed 3 · 4–1 today', seed: 3, today: '4–1' }, p2: { line: 'Seed 6 · 3–0 today', seed: 6, today: '3–0' } } : {})) };
  }
  // game formats (the Format tab): {format.name}, {team1.name}, {team1.points}, {elim.alive}, {league.leader}…
  function formatValues(fv) {
    if (!fv) return { format: {}, team1: {}, team2: {}, elim: {}, league: {} };
    const out = { format: { name: fv.name, match: fv.label, status: fv.status, kind: fv.kind, mode: fv.mode || '', preset: fv.preset, live: fv.status === 'live' ? 'live' : '', done: fv.status === 'done' ? 'done' : '' } };
    const T = (t, i) => t ? { name: t.name, tag: t.tag, color: t.color, coach: t.coach, points: t.points, left: t.left, size: t.size, mp: t.mp ? 'yes' : '', laststand: t.laststand ? 'yes' : '',
      won: fv.status === 'done' && fv.winnerTeam === i ? 'yes' : '', p: t.players.map(x => ({ ...x, record: `${x.wins}–${x.losses}` })),
      now: (t.players.find(x => x.state === 'playing') || {}).name || '', next: (t.players.find(x => x.state === 'next') || {}).name || '' } : {};
    out.team1 = T(fv.teams && fv.teams[0], 0); out.team2 = T(fv.teams && fv.teams[1], 1);
    out.elim = fv.kind === 'elim' ? { alive: fv.alive, total: fv.total, king: fv.king, streak: fv.streak, next: fv.next, champion: fv.champion || '', final: fv.final ? 'yes' : '' } : {};
    out.league = fv.kind === 'league' ? { leader: fv.leader, played: fv.played, total: fv.total, champion: fv.champion || '' } : {};
    if (fv.mvp) out.format.mvp = fv.mvp;
    out.format.champion = fv.kind === 'teams' ? (fv.status === 'done' && fv.winnerTeam >= 0 ? fv.teams[fv.winnerTeam].name : '') : (fv.champion || '');
    return out;
  }
  const pick = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  // live values: {p1.name}, with optional formatting — {p1.name|upper|max:12}, {p1.wins|plural:win}, {p1.team|or:FREE AGENT}
  const two = n => String(n).padStart(2, '0');
  function timeValue(k, now = new Date()) {
    const h = now.getHours(), m = now.getMinutes();
    if (k === 'time') return `${two(h)}:${two(m)}`;
    if (k === 'time12') return `${h % 12 || 12}:${two(m)} ${h < 12 ? 'AM' : 'PM'}`;
    if (k === 'date') return now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (k === 'weekday') return now.toLocaleDateString(undefined, { weekday: 'long' });
    if (k === 'year') return String(now.getFullYear());
    return null;
  }
  function countdown(arg, now = new Date()) {          // {countdown:20:30} → time left until 20:30 today (or tomorrow)
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(arg || '').trim()); if (!m) return '';
    const t = new Date(now); t.setHours(+m[1], +m[2], 0, 0); if (t < now) t.setDate(t.getDate() + 1);
    let d = Math.round((t - now) / 1000); const hh = Math.floor(d / 3600), mm = Math.floor(d % 3600 / 60), ss = d % 60;
    return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
  }
  const FILTERS = {
    upper: v => v.toUpperCase(), lower: v => v.toLowerCase(), title: v => v.replace(/\b\w/g, c => c.toUpperCase()),
    max: (v, n) => { n = Number(n) || 0; return n && v.length > n ? v.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : v; },
    pad: (v, n) => v.padStart(Number(n) || 2, '0'),
    or: (v, alt) => v === '' ? (alt || '') : v,
    plural: (v, word) => (word ? `${v} ${word}${Number(v) === 1 ? '' : 's'}` : v),
    prefix: (v, t) => v === '' ? '' : (t || '') + v, suffix: (v, t) => v === '' ? '' : v + (t || ''),
    trim: v => v.trim(),
  };
  function value(v, expr) {
    const [path, ...fl] = expr.split('|');
    let x;
    if (path.startsWith('countdown:')) x = countdown(path.slice(10));
    else { const tv = timeValue(path); x = tv != null ? tv : pick(v, path); }
    x = x == null || x === false ? '' : String(x);
    for (const f of fl) { const i = f.indexOf(':'), name = (i < 0 ? f : f.slice(0, i)).trim(), arg = i < 0 ? '' : f.slice(i + 1);
      if (name === 'pips') { const [st, rv] = String(arg || '').split('-'), [on, off] = PIPS[st] || PIPS.diamond, n = Math.max(1, Math.min(9, Number(pick(v, 'firstTo')) || 2)), k = Math.max(0, Math.min(n, Number(x) || 0)); x = rv === 'r' ? off.repeat(n - k) + on.repeat(k) : on.repeat(k) + off.repeat(n - k); continue; }   // {p1.score|pips} → ◆◆◇ · {p2.score|pips:diamond-r} → ◇◆◆
      if (FILTERS[name]) x = FILTERS[name](x, arg); }
    return x;
  }
  const PIPS = { diamond: ['◆', '◇'], dot: ['●', '○'], bar: ['▮', '▯'], star: ['★', '☆'], square: ['■', '□'] };
  const TOKEN = /\{([^{}]+)\}/g;
  const fillText = (tpl, v) => String(tpl || '').replace(TOKEN, (_, k) => value(v, k.trim()));
  const hasTime = tpl => /\{\s*(time|time12|date|weekday|countdown:|setTimer)/.test(String(tpl || ''));
  // every live value in the text came out empty (an empty commentator slot…): the piece can hide or show a fallback
  const allEmpty = (tpl, v) => { const ks = [...String(tpl || '').matchAll(TOKEN)]; return ks.length > 0 && ks.every(m => value(v, m[1].trim()).trim() === '') && String(tpl).replace(TOKEN, '').trim() === ''; };

  // theme colours: a colour written "@primary" follows the layout's theme
  function themed(d) {
    const T = {}; for (const c of (d.theme && d.theme.colors) || []) if (c && c.id) T[c.id] = c.value;
    if (!Object.keys(T).length) return d;
    const walk = v => typeof v === 'string' ? (v[0] === '@' && T[v.slice(1)] != null ? T[v.slice(1)] : v)
      : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'theme' ? x : walk(x)])) : v;
    return walk(d);
  }
  // fonts you added (uploaded files; older layouts may still name a web font, which loads only if it's reachable)
  const fontOf = (D, key) => FONTS[key] || ((D.fonts || []).find(f => f.key === key) ? { css: `'${(D.fonts.find(f => f.key === key)).family}', sans-serif`, weight: (D.fonts.find(f => f.key === key)).weight || 400 } : FONTS.saira);
  function loadFonts(D) {
    for (const f of D.fonts || []) {
      const id = 'sdfont-' + f.key; if (document.getElementById(id)) continue;
      if (f.css) { const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = f.css; document.head.appendChild(l); }
      else if (f.url) { const st = document.createElement('style'); st.id = id; st.textContent = `@font-face{font-family:'${f.family}';font-weight:${f.weight || 400};font-display:swap;src:url("${f.url}")}`; document.head.appendChild(st); }
    }
  }
  const SAMPLE = {
    event: 'Weekly #42', round: 'Winners Final', bestOf: 3, bestOfText: 'Best of 3', firstTo: 2, game: 'Tekken 8',
    hist: { line: 'CrimsonByte leads 3–1 · last time NeonGhoul won 2–1', a: 3, b: 1, total: 4, p1: { record: '12–4', main: 'Lynx', chars: 'Lynx' }, p2: { record: '9–6', main: 'Reina', chars: 'Reina' } },   // 1.12.15
    p1: { name: 'CrimsonByte', team: 'BEE', score: 1, pronouns: 'he/him', country: 'us', character: 'Lynx', flagUrl: '', avatar: '', wins: 4, losses: 1 },
    p2: { name: 'NeonGhoul', team: 'VOID', score: 1, pronouns: '', country: 'jp', character: 'Reina', flagUrl: '', avatar: '', wins: 3, losses: 1 },
    c1: { name: 'Commentator 1', handle: '@caster1' }, c2: { name: 'Commentator 2', handle: '' }, winnerSide: 0, h2h: { show: false }, __sample: true,
    custom: { list: 'Thanks to our sponsors|Next stream: Friday 8 PM', sponsor: 'Beebo Energy' },
    upcoming: [{ round: 'Losers Semis', p1: 'ShadowKoi', p2: 'PixelPaladin' }, { round: 'Losers Final', p1: 'TBD', p2: 'VoidTaco' }],
    top8: { type: 'DE', reached: true, wsf: [{ round: 'Winners Semis', a: { name: 'CrimsonByte', score: 2, win: true }, b: { name: 'ShadowKoi', score: 1, win: false } }, { round: 'Winners Semis', a: { name: 'NeonGhoul', score: 2, win: true }, b: { name: 'PixelPaladin', score: 0, win: false } }], wf: [{ round: 'Winners Final', a: { name: 'CrimsonByte', score: 1, win: false }, b: { name: 'NeonGhoul', score: 1, win: false } }], lt8: [{ round: 'Losers Top 8', a: { name: 'VoidTaco', score: 2, win: true }, b: { name: 'IronMoth', score: 1, win: false } }, { round: 'Losers Top 8', a: { name: 'GlassJaw99', score: 0, win: false }, b: { name: 'RamenRush', score: 2, win: true } }], lqf: [{ round: 'Losers Quarters', a: { name: 'ShadowKoi', score: 2, win: true }, b: { name: 'VoidTaco', score: 1, win: false } }, { round: 'Losers Quarters', a: { name: 'PixelPaladin', score: 1, win: false }, b: { name: 'RamenRush', score: 2, win: true } }], lsf: [{ round: 'Losers Semis', a: { name: 'ShadowKoi', score: 0, win: false }, b: { name: 'RamenRush', score: 0, win: false } }], lf: [{ round: 'Losers Final', a: { name: 'TBD', score: 0, win: false }, b: { name: 'TBD', score: 0, win: false } }], gf: [{ round: 'Grand Final', a: { name: 'TBD', score: 0, win: false }, b: { name: 'TBD', score: 0, win: false } }] },
    twitch: { channel: 'beebo' },
    fv: {"kind": "teams", "preset": "crew", "mode": "stay", "status": "live", "name": "Crew Battle", "label": "Crew Battle — Match 3", "seq": 1, "n": 3, "goal": 0, "teams": [{"name": "Ember Crew", "tag": "EMB", "color": "#ff5a1f", "coach": "", "points": 0, "left": 4, "size": 4, "mp": false, "laststand": false, "players": [{"name": "CrimsonByte", "character": "", "country": "", "out": false, "retired": false, "wins": 2, "losses": 0, "streak": 2, "state": "playing"}, {"name": "ShadowKoi", "character": "", "country": "", "out": false, "retired": false, "wins": 0, "losses": 0, "streak": 0, "state": "next"}, {"name": "RamenRush", "character": "", "country": "", "out": false, "retired": false, "wins": 0, "losses": 0, "streak": 0, "state": "wait"}, {"name": "PixelPaladin", "character": "", "country": "", "out": false, "retired": false, "wins": 0, "losses": 0, "streak": 0, "state": "wait"}]}, {"name": "Frost Crew", "tag": "FRS", "color": "#7fd0ff", "coach": "", "points": 0, "left": 2, "size": 4, "mp": false, "laststand": false, "players": [{"name": "NeonGhoul", "character": "", "country": "", "out": true, "retired": false, "wins": 0, "losses": 1, "streak": 0, "state": "out"}, {"name": "VoidTaco", "character": "", "country": "", "out": true, "retired": false, "wins": 0, "losses": 1, "streak": 0, "state": "out"}, {"name": "IronMoth", "character": "", "country": "", "out": false, "retired": false, "wins": 0, "losses": 0, "streak": 0, "state": "playing"}, {"name": "GlassJaw99", "character": "", "country": "", "out": false, "retired": false, "wins": 0, "losses": 0, "streak": 0, "state": "next"}]}], "tiebreak": false},
  };
  function derive(s) {      // sb-client already does this live; the designer's sample state needs it too
    s = structuredClone(s);
    const ft = Number(s.firstTo) || Math.ceil((Number(s.bestOf) || 3) / 2);
    for (const k of ['p1', 'p2']) { const p = s[k] = s[k] || {}; p.score = Number(p.score) || 0; p.winner = p.score >= ft; p.matchPoint = !p.winner && p.score === ft - 1; }
    s.winnerSide = s.p1.winner && !s.p2.winner ? 1 : s.p2.winner && !s.p1.winner ? 2 : 0;
    s.firstTo = ft; s.bestOfText = s.bestOfText || `Best of ${s.bestOf || 3}`; s.bestOfShort = s.bestOfShort || `BO${s.bestOf || 3}`; s.firstToText = s.firstToText || `First to ${ft}`;
    for (const k of ['p1', 'p2']) { const p = s[k]; p.displayName = p.displayName || (p.name || '') + (p.loser ? ' [L]' : ''); p.fullName = p.fullName || (p.team ? `${p.team} | ${p.name || ''}` : (p.name || ''));
      p.loserTag = p.loser ? '[L]' : ''; p.characterSlug = p.characterSlug || String(p.character || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!p.flagUrl && /^[a-z]{2}$/i.test(p.country || '')) p.flagUrl = `/static/flags/${String(p.country).toLowerCase()}.svg`; }
    for (const k of ['c1', 'c2']) { const c = s[k] = s[k] || {}; c.display = c.display || (c.handle ? `${c.name} ${c.handle}` : (c.name || '')); }
    s.commentators = s.commentators || [s.c1.name, s.c2.name].filter(Boolean).join(' & ');
    return s;
  }

  // =============================================================================================== CSS
  const CSS = `
@font-face{font-family:'Saira Condensed';font-weight:800;src:url(/static/fonts/saira-condensed-latin-800-normal.woff2) format('woff2')}
@font-face{font-family:'Saira Condensed';font-weight:700;src:url(/static/fonts/saira-condensed-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:600;src:url(/static/fonts/chakra-petch-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:700;src:url(/static/fonts/chakra-petch-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Beebo Classic';font-weight:600;font-display:swap;src:url(/static/fonts/beebo-classic-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Beebo Classic';font-weight:800;font-display:swap;src:url(/static/fonts/beebo-classic-latin-800-normal.woff2) format('woff2')}
${FONT_FACES}
.sd-root{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none}
.sd-root *{box-sizing:border-box}
.sd-scene{position:absolute;inset:0}
.sd-scene.sd-splash{z-index:50}
.sd-scene.sd-hidden{display:none}
.sd-scene.sd-gxwait{opacity:0!important}
.sd-scene.sd-under{visibility:hidden}.sd-scene.sd-hidden.sd-warm{display:block;visibility:hidden}.sd-scene.sd-under *,.sd-scene.sd-under *::before,.sd-scene.sd-under *::after{animation-play-state:paused!important}
.sd-sbg{position:absolute;inset:0;width:100%;height:100%}
.sd-el{position:absolute;transform-origin:50% 50%}
.sd-in{position:absolute;inset:0}
.sd-bg{position:absolute;left:0;top:0;overflow:visible}
.sd-stroke{fill:none;stroke-linejoin:round;transition:stroke .5s}
.sd-wint{opacity:0;transition:opacity .7s}
.sd-fx{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.sd-shine{position:absolute;top:-10%;bottom:-10%;left:0;width:40%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-130%);opacity:0}
.sd-fx-shine .sd-shine{opacity:1;animation:sd-shine 4.5s ease-in-out infinite}
.sd-scene:not(.sd-sc-board) .sd-fx-shine .sd-shine{width:26%;background:linear-gradient(105deg,transparent,var(--fxc,#fff) 50%,transparent);animation-name:sd-sheen;animation-duration:6.5s}
@keyframes sd-sheen{0%,40%{transform:translateX(-130%);opacity:0}45%{opacity:.3}95%{opacity:.3}100%{transform:translateX(330%);opacity:0}}   /* 1.12.5: on the splashes, a gentle glass sheen */
.sd-shine-burst .sd-shine{opacity:1;animation:sd-shine .55s ease-out 2}
@keyframes sd-shine{0%,40%{transform:translateX(-130%)}100%{transform:translateX(330%)}}
.sd-cracks{position:absolute;left:0;top:0;overflow:visible;opacity:0;transition:opacity .4s;will-change:opacity}   /* 1.12: its own layer, so the pulse is the graphics card's job, not a redraw */
.sd-shine,.sd-idle-pulse{will-change:transform}.sd-winglow .sd-fx::after{will-change:opacity}
.sd-cracks path{fill:none;stroke:var(--fxc,#ff5a1f);stroke-width:1.3;stroke-linecap:round;filter:drop-shadow(0 0 3px var(--fxc,#ff5a1f))}
.sd-fx-cracks .sd-cracks{opacity:.85;animation:sd-crackpulse 1.6s ease-in-out infinite}
.sd-lose.sd-lose-crack .sd-cracks{opacity:.9;animation:sd-crackpulse 2.6s ease-in-out 3}   /* 1.12: the set's over — it breathes three times, then rests */
.sd-crack-burst .sd-cracks{opacity:1;animation:none}
.sd-crack-burst .sd-cracks path{stroke-dasharray:1;animation:sd-draw .45s ease-out both}
@keyframes sd-crackpulse{50%{opacity:.35}}
.sd-still,.sd-still *{animation-play-state:paused!important;transition:none!important;filter:none!important;box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;mix-blend-mode:normal!important}
.sd-dyn .sd-cracks{opacity:1;animation:none}
.sd-dyn .sd-cracks path{opacity:0;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.3,1),opacity .5s,stroke .5s}
.sd-dyn.sd-crk-1 .sd-cracks path[data-r="0"],.sd-dyn.sd-crk-2 .sd-cracks path:is([data-r="0"],[data-r="1"]),.sd-dyn.sd-crk-3 .sd-cracks path:is([data-r="0"],[data-r="1"],[data-r="2"]),
.sd-dyn.sd-crk-4 .sd-cracks path:not([data-r="4"]),.sd-dyn.sd-crk-5 .sd-cracks path{opacity:.92;stroke-dashoffset:0}
.sd-dyn.sd-dgr .sd-cracks{animation:sd-crackpulse 1.4s ease-in-out infinite}
.sd-dyn.sd-mend .sd-cracks path{stroke:#ffe7a3;filter:drop-shadow(0 0 4px #f6c453);transition-duration:1.1s}
.sd-dyn.sd-lava .sd-cracks path{stroke:#ff7a2a;stroke-width:1.5;filter:drop-shadow(0 0 2px #ff3b14)}
.sd-dyn.sd-lava.sd-crk-3 .sd-cracks,.sd-dyn.sd-lava.sd-crk-4 .sd-cracks,.sd-dyn.sd-lava.sd-dgr .sd-cracks{animation:sd-lava 1.8s ease-in-out infinite}
@keyframes sd-lava{0%,100%{opacity:.72}50%{opacity:1}}
.sd-dyn.sd-lava.sd-mend .sd-cracks path{stroke:#ffe7a3;filter:drop-shadow(0 0 4px #f6c453)}
.sd-fissure-x path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.sd-dyn.sd-broken .sd-bg{filter:brightness(.62) saturate(.55);transition:filter .5s}
.sd-dyn.sd-broken .sd-cracks{animation:sd-crackpulse 2.6s ease-in-out 3}
.sd-shard{position:absolute;inset:0;pointer-events:none;will-change:transform}
.sd-dyn.sd-reform>.sd-in{animation:sd-reform .6s ease-out}
@keyframes sd-reform{0%{filter:brightness(2.4) saturate(.3)}100%{filter:none}}
@keyframes sd-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.sd-fx-pulse .sd-stroke{animation:sd-pulse 1.6s steps(12, jump-none) infinite}
@keyframes sd-pulse{50%{filter:drop-shadow(0 0 calc(var(--glow,6px) + 14px) var(--fxc,#ff5a1f)) brightness(1.5)}}
.sd-flash{animation:sd-flash .42s ease-out}
@keyframes sd-flash{0%{filter:brightness(1.9) saturate(.6)}100%{filter:none}}
.sd-lose .sd-bg,.sd-lose .sd-fx{filter:brightness(.55) saturate(.5);transition:filter .5s}
.sd-lose.sd-dimlose .sd-bg,.sd-lose.sd-dimlose .sd-fx{filter:brightness(.36) saturate(.3)}
.sd-lose.sd-dimlose .sd-score{filter:brightness(.55) saturate(.4);transition:filter .5s}.sd-lose.sd-dimlose .sd-fxe,.sd-lose.sd-dimlose .fxe{opacity:.25;transition:opacity .5s}
[style*="--wg"] .sd-fx::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 0 transparent;transition:box-shadow .8s ease-out}
.sd-bg,.sd-fx,.sd-score{transition:filter .6s}.fxe,.sd-fxe{transition:opacity .6s}
.sd-winglow .sd-fx::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 calc(22px*var(--wg,1)) calc(5px*var(--wg,1)) var(--win),inset 0 0 calc(5px*var(--wg,1)) calc(1.5px*var(--wg,1)) #fff8e0;animation:sd-wglow 2.4s ease-in-out 4}
.sd-winglow .sd-name{filter:drop-shadow(0 0 calc(5px*var(--wg,1)) var(--win))}
.sd-winglow .sd-num{filter:drop-shadow(0 0 calc(6px*var(--wg,1)) var(--win)) brightness(1.15)}
@keyframes sd-wglow{50%{opacity:.6}}
.sd-crt>.sd-in{animation:sd-crt .7s steps(14,jump-none)}
@keyframes sd-crt{0%{filter:brightness(3.4) contrast(1.4);transform:none}12%{filter:brightness(2) hue-rotate(-30deg);transform:translateX(-3px) skewX(-4deg)}24%{filter:brightness(.4);transform:translateX(4px)}36%{filter:brightness(1.8) saturate(0);transform:translateX(-2px) scaleY(.92)}52%{filter:brightness(.6);transform:translateX(2px)}70%{filter:brightness(1.3);transform:none}100%{filter:none;transform:none}}
.sd-crt .sd-fx::before{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.22) 0 1px,transparent 1px 3px);animation:sd-scan .9s ease-out forwards}
@keyframes sd-scan{0%{opacity:1;background-position:0 0}100%{opacity:0;background-position:0 30px}}
.sd-lose .sd-l1{opacity:.6;transition:opacity .5s}.sd-lose .sd-l2{opacity:.85;transition:opacity .5s}
.sd-body{position:absolute;top:0;bottom:0;display:flex;align-items:center;min-width:0}
.sd-who{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.sd-l1,.sd-l2{display:flex;align-items:center;min-width:0;max-width:100%;white-space:nowrap}
.sd-name{min-width:0;overflow:hidden;white-space:nowrap;line-height:1.08;padding:0 .26em 0 .04em}
.sd-team{flex:none;max-width:42%;overflow:hidden;text-overflow:ellipsis;font-weight:800;letter-spacing:.06em;padding:.1em .14em .1em .04em;margin:-.1em -.14em -.1em -.04em}   /* 1.12.21: a long team name (a game format shows the whole name here) takes four tenths of the line at most — it used to push the player's name out of its box */
.sd-flag{flex:none;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.2)}
.sd-flag.sd-off{display:none}
.sd-ltag{flex:none;font:700 .55em/1.4 'Chakra Petch',sans-serif;padding:0 .4em;background:#d9dce4;color:#08080a;margin-left:.3em;display:none}
.sd-ltag.sd-on{display:inline-block}
.sd-l2{font-family:'Chakra Petch',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.18em}
.sd-score{flex:none;position:relative;display:grid;place-items:center}
.sd-score svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sd-tfx-glow{filter:drop-shadow(0 0 2px var(--tfx)) drop-shadow(0 0 12px var(--tfx));animation:sd-tglow 2.6s steps(20, jump-none) infinite}
@keyframes sd-tglow{50%{filter:drop-shadow(0 0 4px var(--tfx)) drop-shadow(0 0 26px var(--tfx)) brightness(1.15)}}
.sd-tfx-flame{filter:drop-shadow(0 0 3px var(--tfx)) drop-shadow(0 -4px 10px var(--tfx));animation:sd-tflame .45s steps(8, jump-none) infinite alternate}
@keyframes sd-tflame{to{filter:drop-shadow(0 0 5px var(--tfx)) drop-shadow(0 -9px 18px var(--tfx))}}
.sd-tight.sd-tfx-flame,.sd-tight .sd-tfx-flame{filter:drop-shadow(0 0 2px var(--tfx));animation:none}
.sd-tfx-outline{-webkit-text-stroke:var(--tfw,1.5px) var(--tfx);paint-order:stroke fill}
.sd-tfx-shadow{filter:drop-shadow(.06em .08em 0 var(--tfx))}
.sd-tfx-extrude{text-shadow:calc(var(--tfw,6px)*.17) calc(var(--tfw,6px)*.17) 0 var(--tfx),calc(var(--tfw,6px)*.33) calc(var(--tfw,6px)*.33) 0 var(--tfx),calc(var(--tfw,6px)*.5) calc(var(--tfw,6px)*.5) 0 var(--tfx),calc(var(--tfw,6px)*.67) calc(var(--tfw,6px)*.67) 0 var(--tfx),calc(var(--tfw,6px)*.83) calc(var(--tfw,6px)*.83) 0 var(--tfx),var(--tfw,6px) var(--tfw,6px) 0 var(--tfx),calc(var(--tfw,6px) + 4px) calc(var(--tfw,6px) + 6px) 10px rgba(0,0,0,.45)}
.sd-tfx-neon{-webkit-text-fill-color:transparent;background:none!important;-webkit-text-stroke:var(--tfw,3px) var(--tfx2,var(--tfx));filter:drop-shadow(0 0 1.5px var(--tfx)) drop-shadow(0 0 8px var(--tfx)) drop-shadow(0 0 20px var(--tfx));animation:sd-tneon 3.2s steps(24, jump-none) infinite}
@keyframes sd-tneon{50%{filter:drop-shadow(0 0 2.5px var(--tfx)) drop-shadow(0 0 13px var(--tfx)) drop-shadow(0 0 32px var(--tfx)) brightness(1.12)}}
.sb-potato .sd-tfx-neon,.sb-ultra .sd-tfx-neon{animation:none}
.sd-num{position:relative;font-family:'Chakra Petch',sans-serif;font-weight:700;line-height:1}
.sd-num.sd-slam{animation:sd-slam .6s cubic-bezier(.2,.9,.3,1.4)}
@keyframes sd-slam{0%{transform:scale(2.6) translateY(-6%);opacity:0;filter:blur(4px)}55%{transform:scale(.88);opacity:1;filter:none}100%{transform:none}}
.sd-meta{font-family:'Chakra Petch',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.14em;white-space:nowrap;max-width:94%;overflow:hidden}
.sd-round,.sd-text{white-space:nowrap;max-width:100%;overflow:hidden;padding:0 .3em 0 .14em;line-height:1.08}
.sd-comms{gap:.45em;justify-content:center;white-space:nowrap;overflow:hidden}
.sd-comms svg{width:.8em;height:.8em;flex:none}
.sd-logo{position:absolute;inset:0}
.sd-logo img{width:100%;height:100%;display:block}
.sd-logo .sd-ph{position:absolute;inset:0;display:grid;place-items:center;font:700 16px 'Chakra Petch',sans-serif;color:rgba(255,255,255,.6);text-align:center;border:2px dashed rgba(255,255,255,.35);border-radius:inherit}
.sd-ava{position:absolute;overflow:hidden}
.sd-ava img{width:100%;height:100%;object-fit:cover;display:block}.sd-ava>img,.sd-ava>video,.sd-ava>canvas{transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1))}
.sd-ava b{position:absolute;inset:0;display:grid;place-items:center;font-family:'Saira Condensed',Impact,sans-serif;font-weight:800;font-style:italic;color:#fff}
.sd-br{color:var(--brt)}.sd-br-sec{position:absolute;left:0}.sd-br-l{position:absolute;left:0;top:-30px;font-size:15px;letter-spacing:.2em;color:var(--bra);font-weight:800}
.sd-br-h{position:absolute;top:0;height:22px;font-size:12px;letter-spacing:.12em;color:var(--brsub);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-br-c{position:absolute;background:var(--brc);border:2px solid var(--brs);border-radius:var(--brr);display:flex;flex-direction:column;justify-content:center;overflow:hidden;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.sd-br-c.live{border-color:var(--bra);box-shadow:0 0 0 1px var(--bra),0 0 22px color-mix(in srgb,var(--bra) 60%,transparent)}
.sd-br-p{display:flex;align-items:center;gap:6px;height:29px;padding:0 10px 0 6px;font-size:18px;min-width:0}.sd-br-pv{position:relative;flex:none;width:30px;height:25px;margin-left:-2px;overflow:hidden;clip-path:polygon(12% 0,100% 0,88% 100%,0 100%);background:rgba(0,0,0,.35)}
.sd-br-pv svg,.sd-br-pv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sd-br-pv img.ch{object-fit:contain;object-position:50% 100%}
.sd-br-p.l .sd-br-pv{filter:grayscale(1)}
.sd-li-pv{position:relative;flex:none;margin-right:.45em;border-radius:50%;overflow:hidden;background:rgba(0,0,0,.35)}
.sd-li-pv svg,.sd-li-pv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sd-li-pv img.ch{object-fit:contain;object-position:50% 100%}
.sd-br-p+.sd-br-p{border-top:1px solid color-mix(in srgb,var(--brs) 70%,transparent)}
.sd-br-p i{font-style:normal;font-size:11px;width:18px;text-align:right;color:var(--brsi,var(--brsub))}.sd-br-p b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:inherit}
.sd-br-p em{font-style:normal;min-width:22px;height:23px;display:grid;place-items:center;font-weight:800;color:var(--brsc);background:rgba(0,0,0,.35);border-radius:3px}
.sd-br-p.w b{color:var(--brw)}.sd-br-p.w em{background:var(--brw);color:var(--brwi,#111)}.sd-br-p.l{opacity:.55}.sd-br-p .tbd{opacity:.45}
.sd-br-c.live .sd-br-p em{background:var(--bra);color:var(--brai,#fff)}.sd-br-none{position:absolute;left:0;top:0;width:900px;font-size:22px;color:var(--brsub)}
.sd-ava.sd-img b{display:none}
.sd-ava.sd-pic>img:not(.bk-media){display:none}
.sd-ring{position:absolute;border-radius:50%;border:3px solid var(--fxc,#ffb36b);box-shadow:0 0 18px var(--fxc,#ff5a1f);pointer-events:none;animation:sd-ring .7s ease-out forwards}
@keyframes sd-ring{from{transform:scale(.15);opacity:1}to{transform:scale(1);opacity:0}}
.sd-blade{position:absolute;top:-20%;bottom:-20%;width:14%;background:linear-gradient(90deg,transparent,#fff,transparent);transform:skewX(-22deg);pointer-events:none;mix-blend-mode:screen}
.sd-cv{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:80}
.sd-amb{position:absolute;inset:0;pointer-events:none}
.sd-amb-pulse{background:radial-gradient(ellipse 70% 60% at 50% 50%,transparent 40%,var(--fxc) 140%);animation:sd-amb 2.4s ease-in-out infinite;opacity:.5}
@keyframes sd-amb{50%{opacity:.15}}
.sd-amb-shine{overflow:hidden}.sd-amb-shine::before{content:'';position:absolute;top:-20%;bottom:-20%;width:30%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.18),transparent);animation:sd-shine 6s ease-in-out infinite}
.sd-shards{position:absolute;inset:0;perspective:1400px;pointer-events:none;z-index:60}
.sd-el.sd-hid{opacity:.22!important;filter:grayscale(1)}
.sd-text.sd-wrap{white-space:normal;overflow:hidden;max-height:100%;word-break:break-word}
.sd-list{display:flex;overflow:hidden}
.sd-item{display:flex;align-items:center;white-space:nowrap;line-height:1.1;flex:none}
.sd-item.sd-st-out{opacity:.4;text-decoration:line-through}.sd-item.sd-st-playing{filter:drop-shadow(0 0 6px rgba(255,170,90,.85))}.sd-item.sd-st-next{opacity:.85}
.sd-curve text{font:inherit;letter-spacing:inherit}
.sd-shard{position:absolute;inset:0;will-change:transform,opacity}
html.sb-potato .sd-root *{animation:none!important;transition:none!important}
`;
  const CSS3 = `
.sd-in.sd-idle-float{animation:sdFloat calc(3.2s/var(--isp,1)) ease-in-out infinite}
.sd-in.sd-idle-bob{animation:sdBob calc(1.4s/var(--isp,1)) ease-in-out infinite}
.sd-in.sd-idle-pulse{animation:sdPulse calc(1.6s/var(--isp,1)) ease-in-out infinite}
.sd-in.sd-idle-breathe{animation:sdBreathe calc(4s/var(--isp,1)) ease-in-out infinite}
.sd-idle-letterwave .sd-lw{display:inline-block;white-space:pre;animation:sdLw calc(2.2s/var(--isp,1)) ease-in-out infinite;animation-delay:calc(var(--i) * -.11s)}
@keyframes sdLw{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(-.14em*var(--iamt,1)))}}
.sd-in.sd-idle-voice{transform:scale(calc(1 + .05*var(--sb-aud,0)*var(--iamt,1)));filter:brightness(calc(1 + .45*var(--sb-aud,0)))}
.sd-in.sd-idle-beat{transform:scale(calc(1 + .06*var(--sb-beat,0)*var(--iamt,1)));filter:brightness(calc(1 + .3*var(--sb-beat,0)))}
.sd-in.sd-idle-sway{animation:sdSway calc(3s/var(--isp,1)) ease-in-out infinite;transform-origin:50% 0}
.sd-in.sd-idle-spin{animation:sdSpin calc(8s/var(--isp,1)) linear infinite}
.sd-in.sd-idle-flicker{animation:sdFlick calc(2.6s/var(--isp,1)) steps(1,end) infinite}
.sd-in.sd-idle-shine::after{content:'';position:absolute;inset:0;clip-path:var(--clip);background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%) -200% 0/250% 100% no-repeat;animation:sdShine calc(3.5s/var(--isp,1)) ease-in-out infinite;pointer-events:none;mix-blend-mode:screen}
@keyframes sdFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(-8px*var(--iamt,1)))}}
@keyframes sdBob{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(-4px*var(--iamt,1)))}}
@keyframes sdPulse{0%,100%{transform:scale(1)}50%{transform:scale(calc(1 + .04*var(--iamt,1)))}}
@keyframes sdBreathe{0%,100%{opacity:1}50%{opacity:calc(1 - .35*var(--iamt,1))}}
@keyframes sdSway{0%,100%{transform:rotate(calc(-2deg*var(--iamt,1)))}50%{transform:rotate(calc(2deg*var(--iamt,1)))}}
@keyframes sdSpin{to{transform:rotate(360deg)}}
@keyframes sdFlick{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.4}50%{opacity:1}52%{opacity:.6}53%{opacity:1}}
@keyframes sdShine{0%{background-position:-200% 0}60%,100%{background-position:200% 0}}
.sd-el.sd-rule-off{opacity:0!important;transition:opacity .35s;pointer-events:none}
.sd-edit .sd-el.sd-rule-off{opacity:.18!important;filter:grayscale(1)}
.sd-el.sd-rule-on{transition:opacity .35s}
.sd-el.sd-rule-own,.sd-el.sd-rule-own.sd-rule-off{transition:none}
.sd-tick{position:absolute;inset:0;overflow:hidden;display:flex;align-items:center}
.sd-tick-run{display:flex;white-space:nowrap;will-change:transform}
.sd-tick-run span{padding-right:0;white-space:pre}
.sd-shared{position:absolute;inset:0;pointer-events:none}
/* 1.12.21: score pips */
.sd-pips{position:absolute;inset:0;display:flex;align-items:center;pointer-events:none}
.sd-pips svg{display:block;overflow:visible;flex:none}
.sd-pip{transform-box:fill-box;transform-origin:50% 50%;transition:fill .25s,stroke .25s,opacity .25s}
.sd-pip-next{animation:sd-pipnext var(--pipd,1.15s) ease-in-out infinite}
@keyframes sd-pipnext{50%{opacity:.3}}
.sd-pip-mark{opacity:1}
html.sb-potato .sd-pip,.sd-calm .sd-pip{transition:none}html.sb-potato .sd-pip-next,.sd-calm .sd-pip-next{animation:none}
/* the header's small line, in parts (so each can be left out when it's crowded, and the fixed words can be translated) */
.sd-meta{display:flex;justify-content:center;align-items:baseline;gap:.5em}
.sd-meta span{flex:none;white-space:nowrap}.sd-meta .sd-m-ev{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.sd-meta .sd-m-sep{opacity:.75}.sd-meta .sd-m-t{font-variant-numeric:tabular-nums}
/* a score that has just changed: a flash in the scorer's colour (off with the "A game is won" moment) */
.sd-score.sd-pt>svg{animation:sd-pt var(--ptd,.5s) ease-out}
@keyframes sd-pt{0%{filter:brightness(2.6) saturate(1.25)}100%{filter:none}}
html.sb-potato .sd-score.sd-pt>svg,.sd-calm .sd-score.sd-pt>svg{animation:none}
/* swapping sides: what's on each bar slides inside the bar's own box (never over the game's HUD) */
.sd-xclip{clip-path:inset(0)}
`;
  function addCSS() { if (document.getElementById('sd-css')) return; const st = document.createElement('style'); st.id = 'sd-css'; st.textContent = CSS + CSS3; (document.head || document.documentElement).appendChild(st); }

  // =============================================================================================== cracks
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function crackPaths(w, h, ox, oy, seed) {
    const r = rng(seed), RAYS = 11, RINGS = [.12, .3, .55, .9, 1.4].map(k => k * Math.max(w, h));
    const ang = Array.from({ length: RAYS }, (_, i) => (i + .15 + r() * .7) / RAYS * Math.PI * 2);
    const V = RINGS.map(rad => ang.map(a => { const k = rad * (.78 + r() * .44); return [ox + Math.cos(a) * k, oy + Math.sin(a) * k * Math.min(1, h / w * 2)]; }));
    let d = '';
    for (let a = 0; a < RAYS; a++) {
      const b = (a + 1) % RAYS;
      d += `<path pathLength="1" data-r="0" d="M${ox.toFixed(0)},${oy.toFixed(0)}L${V[0][a][0].toFixed(0)},${V[0][a][1].toFixed(0)}"/>`;
      for (let i = 1; i < RINGS.length; i++) d += `<path pathLength="1" data-r="${i}" d="M${V[i - 1][a][0].toFixed(0)},${V[i - 1][a][1].toFixed(0)}L${V[i][a][0].toFixed(0)},${V[i][a][1].toFixed(0)}"/>`;
      for (let i = 0; i < 3; i++) if (r() > .35) d += `<path pathLength="1" data-r="${i + 1}" d="M${V[i][a][0].toFixed(0)},${V[i][a][1].toFixed(0)}L${V[i][b][0].toFixed(0)},${V[i][b][1].toFixed(0)}"/>`;
    }
    return d;
  }

  // =============================================================================================== text helpers
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$';
  function decode(el, dur = 560) {
    const final = el.dataset.txt != null ? el.dataset.txt : el.textContent;
    el.dataset.txt = final; const t0 = performance.now();
    const step = t => {
      if (el.dataset.txt !== final) return;
      const p = Math.min(1, (t - t0) / dur), n = Math.floor(p * final.length * 1.15);
      let s = ''; for (let i = 0; i < final.length; i++) s += i < n || final[i] === ' ' ? final[i] : GLYPHS[Math.random() * GLYPHS.length | 0];
      el.textContent = s; if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }
  function fitText(el, base, min, wrap) {
    if (!el.isConnected) return;
    // 1.12.21: measured on the words it will end up showing — a name still decoding (scrambled letters, of other widths) or
    // still being typed out used to be fitted as it stood at that instant, and could end up a few pixels past its box
    const fin = el.dataset ? el.dataset.txt : null, cur = el.textContent, mid = fin != null && cur !== fin && !el.children.length;
    if (mid) el.textContent = fin;
    let size = base; el.style.fontSize = size + 'px';
    let guard = 60;
    const over = () => wrap ? el.scrollHeight > (el.parentNode ? el.parentNode.clientHeight : el.clientHeight) + 1 || el.scrollWidth > el.clientWidth + 1 : el.scrollWidth > el.clientWidth + 1;
    while (over() && size > min && guard--) { size = Math.max(min, size * .93); el.style.fontSize = size.toFixed(1) + 'px'; }
    el.classList.toggle('sd-tight', size < base * .78);     // shrunk a lot: a lighter flame so small letters stay readable
    if (mid) el.textContent = cur;
  }
  // what a list piece lists
  function listItems(el, S) {
    const src = el.source || 'comms';
    if (src === 'comms') return ['c1', 'c2', 'c3', 'c4'].map(k => S[k]).filter(c => c && c.name).map(c => ({ ...c, text: c.name, display: c.handle ? `${c.name} ${c.handle}` : c.name }));
    if (src === 'players') return ['p1', 'p2'].map(k => ({ ...(S[k] || {}), text: (S[k] || {}).name || '' }));
    if (src === 'custom') { const raw = String(((S.custom || {})[el.key || 'list']) || ''); return raw.split(/\n|\|/).map(x => x.trim()).filter(Boolean).map(t => ({ text: t, name: t, display: t })); }
    if (src === 'upcoming') return (S.upcoming || []).map(m => ({ ...m, text: `${m.p1 || 'TBD'} vs ${m.p2 || 'TBD'}`, display: `${m.round ? m.round + ' · ' : ''}${m.p1 || 'TBD'} vs ${m.p2 || 'TBD'}` }));
    // format rosters: each row knows its state (playing / next / wait / out) for styling
    const fv = S.fv;
    const row = (x, extra = {}) => ({ ...x, text: x.name, display: x.name, record: `${x.wins || 0}–${x.losses || 0}`, ...extra });
    if (src === 'team1' || src === 'team2') { const t = fv && fv.teams && fv.teams[src === 'team1' ? 0 : 1]; return t ? t.players.map((x, i) => row(x, { n: i + 1 })) : []; }
    if (src === 'alive' || src === 'eliminated') { const f = (fv && fv.fighters) || []; return f.filter(x => src === 'alive' ? !x.out : x.out).sort((a, b) => src === 'alive' ? 0 : a.place - b.place).map(x => row(x, { placeText: x.place ? ord(x.place) : '' })); }
    if (src === 'queue') return ((fv && fv.queue) || []).map(n => ({ name: n, text: n, display: n, state: 'wait' }));
    if (src === 'bracketStandings') return ((brModel && brModel.standings) || (opts0 && opts0.edit ? SAMPLE_STANDINGS : [])).slice(0, 8).map(x => ({ ...x, text: x.name, display: `${ord(x.place)} ${x.name}`, placeText: ord(x.place), state: x.place === 1 ? 'playing' : 'wait' }));
    if (src === 'standings') return ((fv && fv.standings) || []).map(r => ({ ...r, text: r.name, display: `${r.rank}. ${r.name} ${r.wins}–${r.losses}`, state: r.rank === 1 ? 'playing' : 'wait' }));
    return [];
  }
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  function setText(node, txt) { txt = String(txt == null ? '' : txt); if (node.dataset.txt !== txt) { node.dataset.txt = txt; node.textContent = txt; if (node.closest && node.closest('.sd-idle-letterwave')) waveLetters(node, txt); return true; } return false; }
  // 1.12.15: the Letter wave idle — the letters as their own little boxes, each a beat behind the one before
  function waveLetters(node, txt) { node.innerHTML = [...txt].map((ch, i) => `<span class="sd-lw" style="--i:${i}">${esc(ch)}</span>`).join(''); }

  // =============================================================================================== instance
  const JUST = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const alignOf = (el, def) => (el.font && el.font.align) || (el.kind === 'text' && el.align) || def;
  // the 3D engine: one script, fetched the first time a layout has a 3D piece
  const wait3d = [];
  function need3d(fn) {
    if (window.Beebo3D) return fn();
    wait3d.push(fn); if (wait3d.length > 1) return;
    const sc = document.createElement('script'); sc.src = '/static/sb-3d.js'; sc.async = true;
    sc.onload = () => { for (const f of wait3d.splice(0)) try { f(); } catch (e) { console.warn('3D', e); } };
    sc.onerror = () => console.warn('BeeboScore: the 3D engine didn’t load');
    (document.head || document.documentElement).appendChild(sc);
  }
  // ---------------------------------------------------------------------------------------------- the bracket piece
  // The model comes with the page (sb-client.js: window.__SB_BRACKET and the scoreboard:bracket event) or from
  // /api/bracket/data. Big double-elimination brackets show Winners or Losers (the Bracket tab's side switch).
  let brModel = window.__SB_BRACKET || null, brAsked = false;
  const brWatch = new Set();
  addEventListener('scoreboard:bracket', e => { brModel = e.detail; for (const f of brWatch) try { f(); } catch (er) {} });
  function bracketModel() {
    if (!brModel && !brAsked && /^https?:/.test(location.protocol)) { brAsked = true; fetch('/api/bracket/data', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(d => { if (d && !brModel) { brModel = d; for (const f of brWatch) try { f(); } catch (er) {} } }); }
    return brModel || SAMPLE_BRACKET;
  }
  const bp = (n, w, s, win, lose) => ({ id: n, name: n, seed: s, score: s ? (win ? 2 : lose ? 1 : null) : null, win: !!win, lose: !!lose });
  const SAMPLE_BRACKET = { type: 'DE', event: 'Sample bracket', winners: [
    { name: 'Winners Quarter-Final', sets: [['CrimsonByte', 'PixelPaladin', 1, 8], ['VoidTaco', 'RamenRush', 4, 5], ['NeonGhoul', 'ShadowKoi', 2, 7], ['IronMoth', 'GlassJaw99', 3, 6]].map(([a, b, sa, sb], i) => ({ id: 'w1' + i, state: 'done', done: true, a: bp(a, 0, sa, 1), b: bp(b, 0, sb, 0, 1), parent: 'w2' + (i >> 1) })) },
    { name: 'Winners Semi-Final', sets: [['CrimsonByte', 'VoidTaco'], ['NeonGhoul', 'IronMoth']].map(([a, b], i) => ({ id: 'w2' + i, state: i ? 'playing' : 'wait', a: bp(a), b: bp(b), parent: 'w30' })) },
    { name: 'Winners Final', sets: [{ id: 'w30', state: 'wait', a: bp(''), b: bp('') }] }], losers: [], gf: [] };
  // the Designer's sample Top 8 (double elimination): the Top 8 piece shows it until a real bracket is loaded
  { const S8 = (id, parent, a, b, done) => ({ id, parent, state: done ? 'done' : 'wait', done: !!done, a: a ? bp(a[0], 0, a[1], done && a[2], done && !a[2]) : bp(''), b: b ? bp(b[0], 0, b[1], done && b[2], done && !b[2]) : bp('') });
    SAMPLE_BRACKET.top8 = { type: 'DE', reached: true,
      wsf: [S8('t1', 't3', ['CrimsonByte', 1, 1], ['IronMoth', 4, 0], 1), S8('t2', 't3', ['NeonGhoul', 2, 1], ['VoidTaco', 3, 0], 1)],
      wf: [{ ...S8('t3', 't9', ['CrimsonByte', 1], ['NeonGhoul', 2]), state: 'playing' }],
      lt8: [S8('t4', 't6', ['ShadowKoi', 5, 1], ['RamenRush', 8, 0], 1), S8('t5', 't7', ['GlassJaw99', 6, 0], ['PixelPaladin', 7, 1], 1)],
      lqf: [S8('t6', 't8', ['IronMoth', 4], ['ShadowKoi', 5]), S8('t7', 't8', ['VoidTaco', 3], ['PixelPaladin', 7])],
      lsf: [S8('t8', 't10')], lf: [S8('t10', 't9')], gf: [S8('t9', '')] }; }
  function drawBracket(r, S) {
    const { el, parts } = r; if (!parts.br) return;
    if (!parts.brW) { parts.brW = () => drawBracket(r, r.lastS || S); brWatch.add(parts.brW); }
    r.lastS = S;
    const m = bracketModel(), side = el.show === 'auto' ? ((S.splash && S.splash.side) === 'L' && m.paged ? 'L' : m.paged ? 'W' : 'all') : el.show;
    const live = n => S.p1 && S.p2 && n && (n === S.p1.name || n === S.p2.name);
    const secs = [], t8 = m.top8;
    if (el.show === 'top8' && t8) {           // the Top 8: the last eight players' stretch of the bracket, bigger
      const C = (name, sets) => sets && sets.length ? { name, sets } : null;
      if (t8.type === 'SE') secs.push({ label: '', cols: [C('Quarter-Finals', t8.qf), C('Semi-Finals', t8.sf), C('Final', t8.f)].filter(Boolean) });
      else {
        secs.push({ label: 'Winners', cols: [C('Winners Semis', t8.wsf), C('Winners Final', t8.wf)].filter(Boolean) });
        secs.push({ label: 'Losers', cols: [C('Losers Top 8', t8.lt8), C('Losers Quarters', t8.lqf), C('Losers Semis', t8.lsf), C('Losers Final', t8.lf)].filter(Boolean) });
        if ((t8.gf || []).length) secs.push({ label: 'Grand final', cols: t8.gf.map((x, i) => ({ name: i ? 'Reset' : 'Grand Final', sets: [x] })) });
      }
    } else {
      if (side !== 'L' && (m.winners || []).length) secs.push({ label: m.type === 'SE' ? '' : 'Winners', cols: m.winners });
      if (side !== 'W' && (m.losers || []).length) secs.push({ label: 'Losers', cols: m.losers });
      if (side !== 'L' && (m.gf || []).length) secs.push({ label: 'Grand final', cols: m.gf.map((x, i) => ({ name: i ? 'Reset' : 'Grand Final', sets: [x] })) });
    }
    const key = JSON.stringify([secs, m.pics, S.p1 && S.p1.name, S.p2 && S.p2.name, S.p1 && S.p1.score, S.p2 && S.p2.score, el.w, el.h]);
    if (parts.br.dataset.k === key) return; parts.br.dataset.k = key;
    const c = el.card || {}, CW = 230, CH = 64, GX = 54, GY = 14, HEAD = 26, fam = el.font.family;
    let html = '', yOff = 0, maxW = 0, wlH = 0, gfW = 0;
    for (const sec of secs) {
      const isGF = sec.label === 'Grand final' && secs.length > 1;
      const pos = new Map();
      sec.cols.forEach((col, ci) => { let bottom = -Infinity; col.sets.forEach(x => {
        const feeds = sec.cols[ci - 1] ? sec.cols[ci - 1].sets.filter(y => y.parent === x.id).map(y => pos.get(y.id)).filter(Boolean) : [];
        let y = feeds.length ? feeds.reduce((a, b) => a + b.y, 0) / feeds.length : bottom === -Infinity ? 0 : bottom + GY; if (bottom !== -Infinity && y < bottom + GY) y = bottom + GY;
        pos.set(x.id, { x: ci * (CW + GX), y }); bottom = y + CH; }); });
      const h = Math.max(CH, ...[...pos.values()].map(p => p.y + CH)), w = sec.cols.length * (CW + GX) - GX;
      let lines = '';
      sec.cols.forEach((col, ci) => { if (!ci) return; for (const x of col.sets) for (const y of sec.cols[ci - 1].sets.filter(z => z.parent === x.id)) {
        const a = pos.get(y.id), b = pos.get(x.id); if (!a || !b) continue; const x1 = a.x + CW, y1 = a.y + CH / 2, x2 = b.x, y2 = b.y + CH / 2, mx = x1 + GX / 2;
        lines += `<path d="M${x1} ${y1}H${mx}V${y2}H${x2}" stroke="${esc(y.done ? (el.teamColor || '#ff5a1f') : (c.lines || '#5d6170'))}" stroke-opacity="${y.done ? .85 : .55}"/>`; } });
      const row = (p, x, on) => { const cls = p.win ? 'w' : p.lose ? 'l' : ''; const sc = on ? (p.name === S.p1.name ? S.p1.score : S.p2.score) : p.score;
        return `<div class="sd-br-p ${cls}">${el.pics !== false && p.name ? `<span class="sd-br-pv">${brPic(p, m)}</span>` : ''}<i>${esc(p.seed || '')}</i><b>${p.name ? esc(p.name) : '<span class="tbd">TBD</span>'}</b><em>${sc == null || sc === '' ? '' : sc < 0 ? 'DQ' : esc(sc)}</em></div>`; };
      const cards = sec.cols.map((col, ci) => `<div class="sd-br-h" style="left:${ci * (CW + GX)}px;width:${CW}px">${esc(col.name || '')}</div>` + col.sets.map(x => { const p = pos.get(x.id), on = !x.done && live(x.a.name) && live(x.b.name);
        return `<div class="sd-br-c${x.done ? ' done' : ''}${on ? ' live' : ''}" data-id="${esc(x.id)}" data-parent="${esc(x.parent || '')}" style="left:${p.x}px;top:${p.y + HEAD}px;width:${CW}px;height:${CH}px">${row(x.a, x, on)}${row(x.b, x, on)}</div>`; }).join('')).join('');
      // the grand final sits to the right of the winners and losers brackets, halfway down
      const left = isGF ? maxW + GX + 20 : 0, top = isGF ? Math.max(0, (wlH - h) / 2 - HEAD) : yOff;
      if (!isGF) maxW = Math.max(maxW, w);
      html += `<div class="sd-br-sec" style="left:${left}px;top:${top}px;width:${w}px;height:${h + HEAD}px">${sec.label ? `<div class="sd-br-l">${esc(sec.label)}</div>` : ''}<svg width="${w}" height="${h + HEAD}" style="position:absolute;left:0;top:${HEAD}px;overflow:visible" fill="none" stroke-width="2.5">${lines}</svg>${cards}</div>`;
      if (isGF) { gfW = left + w; continue; }
      yOff += h + HEAD + 56; wlH = yOff - 56;
    }
    const natW = Math.max(1, maxW, gfW), natH = Math.max(1, wlH || yOff - 56), k = Math.min(el.w / natW, el.h / natH, 1.7);
    const fill = cssPaint(c.fill || F('#1a1b22')), font = fontOf(D0, fam);
    // 1.12.21: the seeds are the smallest lettering on a match card, in the same quiet colour as the round names outside the
    // cards — on Porcelain's white cards that was light grey on white (1.7:1). Inside a card they're held to the card's colour.
    const cardTone = (cs => (cs.length ? cs.reduce((a, x) => mix(a, x, .5)) : ''))(cols(c.fill || F('#1a1b22')).filter(x => /^#[0-9a-f]{6}/i.test(x)).map(x => x.slice(0, 7)));
    const sub0 = el.subColor || '#8d919d', seedInk = cardTone && /^#[0-9a-f]{6}$/i.test(sub0) && contrast(sub0, cardTone) < 3 ? readable(sub0, cardTone, 4.5) : sub0;
    parts.br.style.cssText = `position:absolute;left:${(el.w - natW * k) / 2}px;top:${Math.max(0, (el.h - natH * k) / 2)}px;width:${natW}px;height:${natH}px;transform:scale(${k});transform-origin:0 0;`
      + `--brc:${fill};--brs:${c.stroke || '#3a3d48'};--brr:${Number(c.radius) || 0}px;--bra:${el.teamColor || '#ff5a1f'};--brai:${inkOn(el.teamColor || '#ff5a1f')};--brw:${el.winColor || '#f6c453'};--brwi:${inkOn(el.winColor || '#f6c453')};--brsub:${el.subColor || '#8d919d'};--brsi:${seedInk};--brt:${cols(el.font.color)[0]};--brsc:${el.scoreColor || '#fff'};`
      + `font-family:${font.css};font-weight:${font.weight};font-style:${el.font.italic ? 'italic' : 'normal'};text-transform:${el.font.upper ? 'uppercase' : 'none'}`;
    parts.br.innerHTML = html || '<div class="sd-br-none">The bracket shows here once a tournament is loaded</div>';
    // 1.12.9: every name whole — a long one gets smaller (down to about half) instead of being cut off with "…"
    const fitBr = () => { for (const b of parts.br.querySelectorAll('.sd-br-p b')) { b.style.fontSize = ''; if (!b.clientWidth) continue; let f = parseFloat(getComputedStyle(b).fontSize) || 18; const min = f * .5; while (b.scrollWidth > b.clientWidth && f > min) { f -= .5; b.style.fontSize = f + 'px'; } } };
    fitBr(); if (document.fonts) document.fonts.ready.then(fitBr);
    // a bracket on a screen that isn't showing yet has no size: fitted as soon as it shows
    clearInterval(parts.brFitT); parts.brFitT = setInterval(() => { if (!parts.br.isConnected) return clearInterval(parts.brFitT); const b0 = parts.br.querySelector('.sd-br-p b'); if (b0 && b0.clientWidth) { fitBr(); clearInterval(parts.brFitT); } }, 400);
    // a match just finished: lightning jumps from it to the match the winner goes to
    const done = new Set(secs.flatMap(x => x.cols.flatMap(c => c.sets.filter(y => y.done).map(y => String(y.id)))));
    if (parts.brDone && el.bolts !== false && window.BeeboLightning && !opts0.edit && !POTATO()) for (const id of done) if (!parts.brDone.has(id)) {
      const a = parts.br.querySelector(`.sd-br-c[data-id="${window.CSS.escape(id)}"]`), b = a && a.dataset.parent && parts.br.querySelector(`.sd-br-c[data-id="${window.CSS.escape(a.dataset.parent)}"]`);
      if (a && b) { const r0 = r.node.getBoundingClientRect(), A = a.getBoundingClientRect(), Bb = b.getBoundingClientRect(), z = r0.width / el.w || 1;
        window.BeeboLightning.bolt(r.node, (A.right - r0.left) / z, (A.top + A.height / 2 - r0.top) / z, (Bb.left - r0.left) / z, (Bb.top + Bb.height / 2 - r0.top) / z, { color: el.teamColor || '#b9c8ff', width: 2.6, branches: 1, flicker: 2 }); }
    }
    parts.brDone = done;
  }
  // a player's small picture in the bracket and the standings: their start.gg picture, or their character (Settings › bracket pictures)
  const SILH = '<svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7.5" fill="rgba(255,255,255,.5)"/><path d="M6 40c1.5-10 7-15 14-15s12.5 5 14 15z" fill="rgba(255,255,255,.5)"/></svg>';
  function brPic(p, m) {
    const ch = m && m.pics === 'character' && p.charSlug ? `/assets/char/${encodeURIComponent(p.charSlug)}` : '';
    const src = ch || p.avatar || '';
    return SILH + (src ? `<img alt="" src="${esc(src)}" class="${ch ? 'ch' : ''}" onerror="this.remove()">` : '');
  }
  let D0 = null;            // the design being drawn (for its uploaded fonts)
  let opts0 = null;
  const SAMPLE_STANDINGS = ['CrimsonByte', 'NeonGhoul', 'IronMoth', 'VoidTaco', 'RamenRush', 'GlassJaw99', 'ShadowKoi', 'PixelPaladin'].map((name, i) => ({ name, place: [1, 2, 3, 4, 5, 5, 7, 7][i] }));

  // what sb-design.js uses (brModel is read live — the bracket arrives later; setCtx is the design being drawn)
  // 1.12.15: how long a move takes (s), and when a piece starts — its own delay, or "after" another piece finishes coming in
  function moveDur(m) {
    if (!m || !m.type || m.type === 'none') return 0;
    if ((m.type === 'keys' || m.type === 'path') && FXL && FXL.moveDurOf) return FXL.moveDurOf(m);
    const T = TRANSITIONS[m.type]; const d = Number(m.dur) || (T && Number(T.dur)) || .6; return d > 20 ? d / 1000 : d;
  }
  function startOf(el, els, seen) {
    const e = (el && el.enter) || {}; let d = Number(e.delay) || 0;
    if (e.after && els) { seen = seen || new Set(); if (!seen.has(el.id)) { seen.add(el.id); const p = els.find(x => x.id === e.after); if (p) d += startOf(p, els, seen) + moveDur(p.enter); } }
    return d;
  }
  window.__SBDCore = { contrast, clockText, moveDur, startOf, EFFECTS, FONTS, FX2, FXL, H, IDLE, JUST, KIND, OUTS, PARTICLES, POTATO, REACT, RULE_OPS, SAMPLE, SCORE_SHAPES, SCREENS, SHAPES, TEXTANIM, TEXTFX, TEXTURES, TRANSITIONS, W, WHEN, addCSS, alignOf, allEmpty, brPic, cols, crackPaths, cssPaint, cutFor, decode, derive, drawBracket, esc, fillText, fitText, fontOf, hasTime, hexRgb, listItems, loadFonts, lum, make, mix, need3d, normalize, pathFor, pick, plateTone, polyOf, readable, rng, ruleOk, setText, svgGrad, svgPaint, textPaint, themed, two, view, SAMPLE_STANDINGS,
    get brModel() { return brModel; }, get opts0() { return opts0; }, setCtx(D, o) { D0 = D; opts0 = o; } };
})();
