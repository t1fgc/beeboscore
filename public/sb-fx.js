/*
 * BeeboScore effects library — the Layout Designer's big box of looks and moves. Loaded before sb-design.js.
 *
 *   LOOKS   stay on while something is true. A piece can stack several (el.looks = [{ k, c, c2, amt, when }]).
 *             surface  drawn inside the piece's shape (glass, metal, aurora, stained glass…)
 *             edge     drawn on / around the shape's outline (neon tube, barbed wire, gold frame…)
 *             outer    sits outside the shape (smoke, petals, flames, meters…)
 *             text     the lettering itself (chrome, LED, glitch split, reflection…)
 *   INS     how a piece or a screen comes in        (el.enter.type / scene.transIn)
 *   OUTS    how it leaves                            (el.exit.type / scene.transOut)
 *   REACTS  one-off moves when something happens     (el.react.score / lose / win / setlose / mp / final / change / reset)
 *   TEXTS   how words change when a live value does  (el.font.anim)
 *   ATMOS   whole-screen backdrops and moods         (scene.atmos = [{ k, c, amt }])
 *
 * Everything is CSS, SVG and the Web Animations API — no extra files, works in OBS. Potato mode and "calm motion" tone it down.
 */
(function () {
  'use strict';
  if (window.SBFX) return;
  const NS = 'http://www.w3.org/2000/svg';
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hexRgb = c => { c = String(c || '#ffffff').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c.slice(0, 6), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (c, a) => { const [r, g, b] = hexRgb(c); return `rgba(${r},${g},${b},${a})`; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const turb = (freq, oct, mat, w = 240, h = 240, type = 'fractalNoise', extra = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='${NS}' width='${w}' height='${h}'><filter id='t'><feTurbulence type='${type}' baseFrequency='${freq}' numOctaves='${oct}' seed='7'/><feColorMatrix values='${mat}'/>${extra}</filter><rect width='100%' height='100%' filter='url(#t)'/></svg>`)}")`;
  const ROMAN = n => { n = Math.max(0, Math.floor(Number(n) || 0)); if (!n) return '0'; let s = ''; for (const [v, r] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
  const KANA = { a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', k: 'ク', s: 'ス', t: 'ト', n: 'ン', h: 'ハ', m: 'ム', y: 'ヤ', r: 'ル', w: 'ワ', g: 'グ', z: 'ズ', d: 'ド', b: 'ブ', p: 'プ', c: 'ク', f: 'フ', j: 'ジ', l: 'ル', v: 'ヴ', x: 'ク', q: 'ク' };

  // ============================================================================================ WHEN
  // when a look is on (bars know their player; everything else only knows the match)
  const WHEN = { always: 'Always', lead: 'While ahead', matchpoint: 'At match point', danger: 'Opponent at match point', final: 'Final game', winner: 'When they win', loser: 'When they lose', losers: 'In losers [L]', gf: 'In grand finals' };
  function whenOk(w, b, S) {
    if (!w || w === 'always') return true;
    const gf = !!(S && (S.isGrandFinals || /grand final/i.test(String(S.round || ''))));
    const fin = !!(S && S.p1 && S.p2 && S.p1.matchPoint && S.p2.matchPoint);
    if (w === 'gf') return gf; if (w === 'final') return fin;
    if (!b) return w === 'losers' ? !!(S && ((S.p1 || {}).loser || (S.p2 || {}).loser)) : w === 'winner' ? !!(S && S.winnerSide) : true;
    return w === 'lead' ? b.lead : w === 'matchpoint' ? b.mp || b.win : w === 'danger' ? b.danger : w === 'winner' ? b.win : w === 'loser' ? b.lose : w === 'losers' ? !!b.me.loser : true;
  }

  // ============================================================================================ LOOKS
  // css: rules for .fxl-<id> (the layer) or .fxt-<id> (lettering). html(ctx): the layer's insides. paint(ctx): live updates.
  // Variables on every layer: --c, --c2 (a lighter partner), --c3 (a darker one), --a (amount, 1 = normal)
  const L = {};
  const look = (id, o) => { L[id] = { layer: 'surface', cat: 'Surface', kinds: ['shape'], ...o }; };

  // ---------------------------------------------------------------- Player Bar: surfaces
  look('cloth', { label: 'Cloth wave', cat: 'Motion', emoji: '🏳️', layer: 'filter', when: 'always', c: '#ffffff', tip: 'The piece hangs like a banner and ripples in a breeze: pinned along its top edge, moving more the further down it goes.' });   // 1.12.15
  look('heathaze', { label: 'Heat haze', cat: 'Motion', emoji: '♨️', layer: 'filter', when: 'matchpoint', c: '#ff8a3d', tip: 'A wavy shimmer rises off the piece.' });
  look('holo', { label: 'Holo scanlines', emoji: '📡', c: '#5ee7ff', tip: 'Moving scanlines with a slight colour split, like a hologram.',
    css: `{background:repeating-linear-gradient(0deg,rgba(255,255,255,.0) 0 3px,var(--cA) 3px 4px);mix-blend-mode:screen;opacity:calc(.55*var(--a));animation:fx-holo 2.4s linear infinite}
      ::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,0,90,.18),transparent 30%,transparent 70%,rgba(0,200,255,.18));animation:fx-hue 6s linear infinite}` });
  look('metal', { label: 'Brushed metal', emoji: '🔩', c: '#e8ecf4', tip: 'Fine metal grain with a light that drifts across.',
    css: `{background:repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,rgba(0,0,0,.06) 1px 2px,rgba(255,255,255,.03) 2px 4px);mix-blend-mode:overlay;opacity:var(--a)}
      ::after{content:'';position:absolute;top:0;bottom:0;width:60%;left:-60%;background:linear-gradient(100deg,transparent,var(--cB),transparent);animation:fx-drift 7s ease-in-out infinite}` });
  look('carbon', { label: 'Carbon fibre', emoji: '🕸️', c: '#9aa3b5', tip: 'A woven texture that catches the light at an angle.',
    css: `{background:repeating-linear-gradient(45deg,rgba(0,0,0,.35) 0 3px,transparent 3px 6px),repeating-linear-gradient(-45deg,rgba(255,255,255,.06) 0 3px,rgba(0,0,0,.2) 3px 6px);opacity:calc(.8*var(--a))}
      ::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,var(--cA) 50%,transparent 65%);background-size:300% 100%;animation:fx-sweep 5s ease-in-out infinite}` });
  look('frost', { label: 'Frosted glass', emoji: '🧊', c: '#ffffff', tip: 'A blurred, see-through finish with a bright rim.',
    css: `{background:linear-gradient(180deg,var(--cA),rgba(255,255,255,.03) 40%,rgba(255,255,255,.08));backdrop-filter:blur(calc(10px*var(--a)));-webkit-backdrop-filter:blur(calc(10px*var(--a)))}
      ::after{content:'';position:absolute;inset:0;box-shadow:inset 0 1px 0 var(--cB),inset 0 -1px 0 rgba(255,255,255,.2),inset 0 0 24px rgba(255,255,255,.12)}` });
  look('liquid', { label: 'Liquid surface', emoji: '💧', c: '#57c7ff', tip: 'Slow ripples move across the fill.',
    css: `{background:radial-gradient(60% 120% at 20% 50%,var(--cA),transparent 70%),radial-gradient(50% 140% at 80% 40%,var(--cB),transparent 70%);background-size:200% 100%;mix-blend-mode:screen;opacity:var(--a);animation:fx-liquid 6s ease-in-out infinite alternate}` });
  look('sand', { label: 'Sand pour edges', emoji: '⏳', layer: 'outer', front: true, c: '#e9c98b', tip: 'Fine sand trickles off the bottom edge and blows away.',
    html: x => range(18, i => `<i style="left:${(5 + i * 5.2).toFixed(1)}%;animation-delay:${(x.r() * 2.4).toFixed(2)}s;animation-duration:${(1.6 + x.r() * 1.4).toFixed(2)}s"></i>`).join(''),
    css: `{top:auto;height:60px;bottom:-60px}
      i{position:absolute;top:0;width:2px;height:2px;border-radius:50%;background:var(--c);box-shadow:3px 4px 0 var(--c),-2px 9px 0 var(--c2);animation:fx-sand 2s linear infinite;opacity:0}` });
  look('icefrost', { label: 'Ice frost edges', emoji: '❄️', c: '#bfeaff', tip: 'Frost creeps in from the corners and slowly melts.',
    css: `{background:radial-gradient(70% 90% at 0 0,var(--cA),transparent 60%),radial-gradient(60% 90% at 100% 100%,var(--cA),transparent 60%),${turb('.08', 3, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -.55')};mix-blend-mode:screen;animation:fx-melt 14s ease-in-out infinite;opacity:var(--a)}` });
  look('moire', { label: 'Moiré shimmer', emoji: '🌀', c: '#ffffff', tip: 'Two fine line patterns overlap and ripple as the light moves.',
    css: `{opacity:calc(.35*var(--a));mix-blend-mode:overlay}
      ::before,::after{content:'';position:absolute;inset:-50%;background:repeating-radial-gradient(circle at 50% 50%,var(--c) 0 1px,transparent 1px 5px)}
      ::after{animation:fx-spin 30s linear infinite;background:repeating-radial-gradient(circle at 46% 54%,var(--c) 0 1px,transparent 1px 5px)}` });
  look('neontube', { label: 'Neon tube border', emoji: '💡', layer: 'edge', c: '#ff2fd6', tip: 'An outline that hums with a soft flicker.',
    css: `{filter:drop-shadow(0 0 4px var(--c)) drop-shadow(0 0 12px var(--c));animation:fx-flick 4.5s steps(1) infinite} path{fill:none;stroke:var(--c2);stroke-width:calc(2.5px*var(--a))}` });
  // 1.12: ONE comet for the whole layout — it runs round P1's plate, hands over to the title, then P2's plate and back
  // (a relay, see relayKick), entering each piece at the point nearest the one it came from. Subtler than 1.11's three
  // comets, and only one piece animates at a time, so it costs a third as much. Drawn inside the piece (never glows over).
  look('current', { label: 'Ember current', emoji: '☄️', layer: 'edge', c: '#ff5a1f', tip: 'One comet of light in the layout’s colour runs round the pieces that have this look, one after the other (kept inside each piece).',
    // 1.12: a longer comet in the layout's own colour — a bright head and a tail of four links that each follow the outline
    // (so it bends round corners). Every link is only ever moved: the graphics card does it, the CPU redraws nothing.
    css: `{overflow:visible} svg{visibility:hidden} path{fill:none}
      i.cm{position:absolute;left:0;top:0;width:calc(40px*var(--a));height:2px;margin:-1px 0 0 calc(-40px*var(--a));transform-origin:100% 50%;opacity:0;will-change:transform,opacity;border-radius:2px}
      i.cm.h{height:2.6px;margin-top:-1.3px;background:linear-gradient(90deg,var(--cA),var(--c2));box-shadow:0 0 6px var(--c),0 0 2px var(--c2)}
      i.cm.h::after{content:'';position:absolute;right:-2px;top:-1.4px;width:5px;height:5px;border-radius:50%;background:var(--c2);box-shadow:0 0 7px 1px var(--c)}
      i.cm.t1{background:linear-gradient(90deg,var(--c),var(--cA));box-shadow:0 0 5px var(--cA)}
      i.cm.t2{background:var(--c);box-shadow:0 0 4px var(--cA)}
      i.cm.t3{background:linear-gradient(90deg,transparent,var(--c))}`,
    build: x => {
      x.layer.style.clipPath = `path('${x.api.path(x.el)}')`;
      const svg = x.layer.querySelector('svg'), d = (x.api.outline || x.api.path)(x.el); if (!svg) return;
      svg.innerHTML = `<path class="t" d="${d}"/>`;
      const cms = ['h', 't1', 't2', 't3'].map(k => { const c = document.createElement('i'); c.className = 'cm ' + k; x.layer.appendChild(c); return c; });
      RELAY.add({ svg, cms, cm: cms[0], el: x.el, per: 2 * (x.el.w + x.el.h), seg: 40 * (Number(x.lk.amt) || 1) }); relayKick();
    } });
  look('drift', { label: 'Gradient drift', emoji: '🌈', c: '#ff5a1f', tip: 'The colours slowly shift along the piece.',
    css: `{background:linear-gradient(90deg,var(--c),var(--c2),var(--c3),var(--c));background-size:300% 100%;mix-blend-mode:soft-light;opacity:var(--a);animation:fx-sweep 9s linear infinite}` });
  look('aurora', { label: 'Aurora wash', emoji: '🌌', c: '#5effa1', tip: 'Soft green, purple and blue bands drift through.',
    css: `{background:linear-gradient(100deg,transparent 10%,rgba(94,255,161,.35) 25%,transparent 40%,rgba(155,93,255,.35) 55%,transparent 70%,rgba(80,170,255,.35) 85%,transparent);background-size:250% 100%;filter:blur(6px);mix-blend-mode:screen;opacity:var(--a);animation:fx-sweep 11s ease-in-out infinite alternate}` });
  look('stars', { label: 'Starfield inside', emoji: '✨', c: '#ffffff', tip: 'Tiny stars drift past inside the shape.',
    css: `{opacity:var(--a)} ::before,::after{content:'';position:absolute;inset:0 -100% 0 0;background-image:radial-gradient(1px 1px at 10% 30%,var(--c),transparent),radial-gradient(1px 1px at 30% 70%,var(--c),transparent),radial-gradient(1.5px 1.5px at 50% 20%,var(--c),transparent),radial-gradient(1px 1px at 70% 60%,var(--c),transparent),radial-gradient(1px 1px at 90% 40%,var(--c),transparent);background-size:120px 60px;animation:fx-stars 20s linear infinite}
      ::after{background-size:70px 45px;opacity:.5;animation-duration:34s}` });
  look('smoke', { label: 'Smoke wisps', emoji: '💨', layer: 'outer', front: true, c: '#c8ccd6', tip: 'Thin smoke curls off the outer end.',
    html: x => range(5, i => `<i style="animation-delay:${(i * .9).toFixed(1)}s;${x.side === 2 ? 'left' : 'right'}:${(4 + i * 3)}%"></i>`).join(''),
    css: `i{position:absolute;bottom:40%;width:40px;height:40px;border-radius:50%;background:radial-gradient(var(--cA),transparent 70%);filter:blur(6px);animation:fx-smoke 4.5s ease-out infinite;opacity:0}` });
  look('heatmap', { label: 'Heat-map fill', emoji: '🌡️', kinds: ['bar'], c: '#ff3b14', tip: 'Runs from cool blue to hot red as that player wins games.',
    css: `{background:linear-gradient(90deg,hsla(calc(220 - 220*var(--heat,0)),95%,55%,.55),hsla(calc(200 - 200*var(--heat,0)),95%,50%,.2));mix-blend-mode:overlay;opacity:var(--a);transition:background 1s}`,
    paint: x => { const ft = Number(x.S.firstTo) || 2; x.layer.style.setProperty('--heat', String(Math.min(1, (Number(x.b.me.score) || 0) / ft))); } });
  look('stained', { label: 'Stained glass', emoji: '⛪', c: '#ff5a1f', tip: 'Coloured glass panes lit from behind.',
    html: x => { const pal = [x.c, x.c2, x.c3, mix(x.c, '#3a7bff', .6), mix(x.c, '#2fd17a', .6), mix(x.c, '#ffd23a', .6)], n = Math.max(6, Math.round(x.w / 70)); let s = '';
      for (let i = 0; i < n; i++) { const x0 = i / n * x.w, x1 = (i + 1) / n * x.w, m = x.h * (.3 + x.r() * .4), j = (x.r() - .5) * 30;
        s += `<path d="M${x0} 0L${x1 + j} 0L${x1 - j} ${m}Z" fill="${pal[i % 6]}"/><path d="M${x0} 0L${x1 - j} ${m}L${x0 + j} ${x.h}L${x0 - 20} ${x.h}Z" fill="${pal[(i + 3) % 6]}"/><path d="M${x1 - j} ${m}L${x1 + 20} ${x.h}L${x0 + j} ${x.h}Z" fill="${pal[(i + 1) % 6]}"/>`; }
      return `<svg width="100%" height="100%" viewBox="0 0 ${x.w} ${x.h}" preserveAspectRatio="none"><g stroke="#0b0806" stroke-width="3" stroke-linejoin="round" opacity=".85">${s}</g></svg>`; },
    css: `{mix-blend-mode:overlay;opacity:calc(.7*var(--a));animation:fx-backlit 5s ease-in-out infinite} svg{position:absolute;inset:0}` });
  look('circuit', { label: 'Circuit traces', emoji: '🔌', c: '#3dffb5', tip: 'Lines of light run along circuit-board paths.',
    html: x => { let d = ''; for (let i = 0; i < 9; i++) { let px = x.r() * x.w, py = x.r() * x.h; d += `M${px.toFixed(0)} ${py.toFixed(0)}`; for (let k = 0; k < 4; k++) { if (k % 2) py = Math.max(4, Math.min(x.h - 4, py + (x.r() - .5) * x.h)); else px = Math.max(4, Math.min(x.w - 4, px + (x.r() - .5) * x.w * .5)); d += `L${px.toFixed(0)} ${py.toFixed(0)}`; } }
      return `<svg width="100%" height="100%" viewBox="0 0 ${x.w} ${x.h}" preserveAspectRatio="none"><path d="${d}" class="b"/><path d="${d}" class="g" pathLength="100"/></svg>`; },
    css: `{opacity:var(--a)} svg{position:absolute;inset:0} path{fill:none;stroke-width:1.4;vector-effect:non-scaling-stroke} .b{stroke:var(--cA)} .g{stroke:var(--c2);stroke-dasharray:6 94;filter:drop-shadow(0 0 3px var(--c));animation:fx-dash 3.2s linear infinite}` });
  look('hexshield', { label: 'Hex grid shield', emoji: '🛡️', when: 'matchpoint', c: '#6fd3ff', tip: 'A faint hexagon pattern glows in.',
    css: `{background:url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='${NS}' width='24' height='42'><path d='M12 0L24 7V21L12 28L0 21V7Z M12 28V42' fill='none' stroke='white' stroke-width='1.2'/></svg>`)}");background-size:18px 31px;mix-blend-mode:screen;opacity:calc(.45*var(--a));animation:fx-pulse 2s ease-in-out infinite;-webkit-mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);filter:drop-shadow(0 0 3px var(--c))}` });
  look('paper', { label: 'Paper texture', emoji: '📜', c: '#f4ead5', tip: 'A printed, matte paper look with ink edges.',
    css: `{background:${turb('.05', 4, '0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .5 0')};mix-blend-mode:multiply;opacity:var(--a)} ::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 18px rgba(30,20,10,.55)}` });
  look('halftone', { label: 'Halftone dots', emoji: '🔴', c: '#000000', tip: 'Comic-print dots that grow toward one end.',
    css: `{background:radial-gradient(circle,var(--c) 32%,transparent 36%) 0 0/9px 9px;-webkit-mask:linear-gradient(90deg,transparent,#000);mask:linear-gradient(90deg,transparent,#000);opacity:calc(.5*var(--a))}` });
  look('chrome', { label: 'Chrome reflection', emoji: '🪞', c: '#ffffff', tip: 'A mirror-like top half with a dark horizon line.',
    css: `{background:linear-gradient(180deg,var(--cB) 0%,rgba(255,255,255,.08) 46%,rgba(0,0,0,.45) 50%,rgba(255,255,255,.05) 62%,var(--cA) 100%);mix-blend-mode:overlay;opacity:var(--a)}` });
  look('leather', { label: 'Leather and stitching', emoji: '🥊', c: '#d9b26a', tip: 'Leather grain with stitched edges, like a title belt.', inset: true,
    css: `{background:${turb('.9', 2, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .45 0')};mix-blend-mode:multiply;opacity:var(--a)} svg{position:absolute;inset:0;overflow:visible} path{fill:none;stroke:var(--c);stroke-width:1.6;stroke-dasharray:6 4}` });
  look('damage', { label: 'Battle damage', emoji: '🩹', kinds: ['bar'], c: '#ffffff', tip: 'Scratches and dents build up as the player loses games.',
    html: x => `<svg width="100%" height="100%" viewBox="0 0 ${x.w} ${x.h}" preserveAspectRatio="none">${range(8, i => { const a = x.r() * x.w, b = x.r() * x.h, l = 20 + x.r() * 60, t = (x.r() - .5) * 1.2; return `<path class="s" data-i="${i}" d="M${a.toFixed(0)} ${b.toFixed(0)}l${(Math.cos(t) * l).toFixed(0)} ${(Math.sin(t) * l * .4).toFixed(0)}m-6 2l${(Math.cos(t) * l * .6).toFixed(0)} ${(Math.sin(t) * l * .3).toFixed(0)}"/>`; }).join('')}</svg>`,
    css: `svg{position:absolute;inset:0} .s{fill:none;stroke:var(--cA);stroke-width:1.2;opacity:0;transition:opacity .4s} .s.on{opacity:1}`,
    paint: x => { const lost = Number(x.b.op.score) || 0; x.layer.querySelectorAll('.s').forEach((s, i) => s.classList.toggle('on', i < lost * 2 || (x.b.lose && i < 8))); } });
  look('rust', { label: 'Rust creep', emoji: '🟫', when: 'loser', c: '#b5531f', tip: 'Rust spreads across the loser’s piece after the set.',
    css: `{background:${turb('.07', 4, '0 0 0 0 .55  0 0 0 0 .25  0 0 0 0 .08  0 0 0 2.2 -.9')};opacity:var(--a);-webkit-mask:linear-gradient(90deg,#000 var(--rust,0%),transparent calc(var(--rust,0%) + 25%));animation:fx-rust 6s ease-out forwards}` });
  look('drip', { label: 'Bloodline drip', emoji: '🩸', layer: 'outer', front: true, c: '#b3001b', tip: 'Red drips run down from the top edge.',
    html: x => range(7, i => `<i style="left:${(6 + x.r() * 88).toFixed(1)}%;animation-delay:${(x.r() * 4).toFixed(2)}s;animation-duration:${(3 + x.r() * 3).toFixed(1)}s"></i>`).join(''),
    css: `i{position:absolute;top:0;width:5px;height:6px;border-radius:0 0 3px 3px;background:linear-gradient(var(--c3),var(--c));transform-origin:top;animation:fx-drip 4s ease-in infinite;box-shadow:0 0 4px var(--cA)}` });
  look('vines', { label: 'Vine growth', emoji: '🌿', layer: 'outer', front: true, c: '#3fae5a', tip: 'Vines and leaves curl around the ends.',
    html: x => { const v = (sx, dir) => `<path d="M${sx} ${x.h}c${dir * 30} -20 ${dir * -10} -40 ${dir * 20} -60s${dir * 40} -10 ${dir * 30} -40" pathLength="100"/><ellipse cx="${sx + dir * 22}" cy="${x.h - 40}" rx="7" ry="3.5" transform="rotate(${dir * -30} ${sx + dir * 22} ${x.h - 40})"/><ellipse cx="${sx + dir * 38}" cy="${x.h - 78}" rx="7" ry="3.5"/>`;
      return `<svg width="${x.w}" height="${x.h}" viewBox="0 0 ${x.w} ${x.h}" style="overflow:visible">${v(4, 1)}${v(x.w - 4, -1)}</svg>`; },
    css: `svg{position:absolute;inset:0} path{fill:none;stroke:var(--c);stroke-width:3;stroke-linecap:round;stroke-dasharray:100;animation:fx-grow 3s ease-out both} ellipse{fill:var(--c2);animation:fx-pop .6s 2.4s both}` });
  look('petals', { label: 'Cherry blossom petals', emoji: '🌸', layer: 'outer', front: true, c: '#ffb7d5', tip: 'Petals settle on top and slide off.',
    html: x => range(9, i => `<i style="left:${(x.r() * 96).toFixed(1)}%;animation-delay:${(x.r() * 6).toFixed(2)}s;animation-duration:${(4 + x.r() * 3).toFixed(1)}s"></i>`).join(''),
    css: `i{position:absolute;top:-30px;width:10px;height:7px;border-radius:70% 0 70% 0;background:linear-gradient(135deg,var(--c2),var(--c));animation:fx-petal 5s ease-in infinite;opacity:0}` });
  look('snowcap', { label: 'Snow buildup', emoji: '⛄', layer: 'outer', front: true, c: '#ffffff', tip: 'Snow gathers on the top edge over time.',
    css: `{bottom:auto;height:14px;top:-9px} ::before{content:'';position:absolute;left:3%;right:3%;bottom:0;height:12px;border-radius:12px 12px 4px 4px;background:linear-gradient(var(--c),${'#dde8f5'});box-shadow:0 2px 3px rgba(0,0,0,.25);transform-origin:bottom;animation:fx-snowcap 90s ease-out forwards}` });
  look('dither', { label: 'Pixel dither', emoji: '👾', c: '#000000', tip: 'A retro dithered fill with a limited palette.',
    css: `{background:conic-gradient(var(--cA) 25%,transparent 0 50%,var(--cA) 0 75%,transparent 0) 0 0/4px 4px;image-rendering:pixelated;-webkit-mask:linear-gradient(90deg,#000,transparent 80%);opacity:calc(.6*var(--a))}` });
  look('crt', { label: 'CRT curve', emoji: '📺', c: '#9dffb0', tip: 'A slight screen bulge with rounded glow.',
    css: `{background:radial-gradient(120% 140% at 50% 50%,transparent 55%,rgba(0,0,0,.55)),repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px);opacity:var(--a)} ::after{content:'';position:absolute;inset:0;background:radial-gradient(60% 80% at 50% 40%,var(--cA),transparent);mix-blend-mode:screen;animation:fx-flick 6s steps(1) infinite}` });
  look('vhs', { label: 'VHS tracking', emoji: '📼', c: '#ffffff', tip: 'A rolling distortion band passes through now and then.',
    css: `{opacity:var(--a)} ::after{content:'';position:absolute;left:0;right:0;height:22%;top:-25%;background:linear-gradient(transparent,var(--cA),rgba(255,0,80,.18),var(--cA),transparent);filter:blur(1px);animation:fx-vhs 5s linear infinite;mix-blend-mode:screen}` });
  look('oilslick', { label: 'Oil slick sheen', emoji: '🛢️', c: '#ff00aa', tip: 'A rainbow sheen that moves with the light.',
    css: `{opacity:calc(.35*var(--a));mix-blend-mode:color-dodge} ::after{content:'';position:absolute;inset:-60%;background:conic-gradient(from 0deg,#ff0080,#ffd000,#00ff9d,#00b7ff,#a200ff,#ff0080);filter:blur(14px);animation:fx-spin 12s linear infinite}` });
  look('caustic', { label: 'Caustic light', emoji: '🏊', c: '#9ff4ff', tip: 'Rippling pool-water light patterns play across.',
    css: `{background:${turb('.025 .06', 2, '0 0 0 0 .62  0 0 0 0 .95  0 0 0 0 1  0 0 0 -9 4.2', 400, 200, 'turbulence')};background-size:400px 200px;mix-blend-mode:screen;opacity:calc(.55*var(--a));animation:fx-caustic 9s linear infinite}` });
  look('inkwash', { label: 'Ink wash', emoji: '🖌️', c: '#1b2a4a', tip: 'Painted in watery ink that slowly spreads at the edges.',
    css: `{background:${turb('.012 .03', 4, '0 0 0 0 .1  0 0 0 0 .16  0 0 0 0 .3  0 0 0 2 -.6', 300, 150)};background-size:cover;mix-blend-mode:multiply;opacity:var(--a);animation:fx-inkspread 16s ease-in-out infinite alternate}` });
  look('chartint', { label: 'Character colour tint', emoji: '🎭', kinds: ['bar'], c: '#ffffff', tip: 'A tint picked from the player’s character (each character gets its own colour).',
    css: `{background:linear-gradient(90deg,var(--chr,transparent),transparent 80%);mix-blend-mode:color;opacity:calc(.6*var(--a));transition:background 1s}`,
    paint: x => { const ch = String(x.b.me.character || ''); let hsh = 0; for (const c of ch) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0; x.layer.style.setProperty('--chr', ch ? `hsl(${hsh % 360},85%,55%)` : 'transparent'); } });
  look('teamstripe', { label: 'Team colour stripe', emoji: '🎽', c: '#ff5a1f', tip: 'A thin stripe in the team colour along one edge.',
    css: `{background:linear-gradient(180deg,transparent 90.5%,var(--c) 90.5% 95%,var(--c2) 95% 97.5%,transparent 97.5%);opacity:var(--a)}` });   /* low on the edge, clear of the pronouns / status line */
  look('seedbadge', { label: 'Seed badge glow', emoji: '🥇', kinds: ['bar'], layer: 'outer', front: true, c: '#f6c453', tip: 'A small seed number that glows for the top 4 seeds.',
    html: () => '<b></b>', css: `b{position:absolute;top:-12px;font:800 13px/18px 'Chakra Petch',sans-serif;padding:0 7px;border-radius:9px;background:var(--c);color:#1a1205;box-shadow:0 0 10px var(--c);display:none}`,
    paint: x => { const s = Number(x.b.me.seed) || 0, b = x.layer.firstChild; b.textContent = s ? '#' + s : ''; b.style.display = s ? '' : 'none'; b.style.boxShadow = s && s <= 4 ? '' : 'none'; b.style[x.side === 2 ? 'right' : 'left'] = '18px'; } });
  look('losertint', { label: 'Losers side tint', emoji: '🔻', when: 'losers', c: '#8a1020', tip: 'A darker, redder shade while the player is in losers.',
    css: `{background:linear-gradient(90deg,var(--cA),var(--cB));mix-blend-mode:multiply;opacity:var(--a)}` });
  look('gfframe', { label: 'Grand finals frame', emoji: '👑', layer: 'edge', when: 'gf', c: '#f6c453', tip: 'An ornate gold border only during grand finals.',
    css: `{filter:drop-shadow(0 0 6px var(--c))} path{fill:none;stroke:var(--c);stroke-width:3} path+path{stroke:var(--c2);stroke-width:1;stroke-dasharray:2 5;animation:fx-dash 6s linear infinite}`, double: true });
  look('radar', { label: 'Radar sweep', emoji: '📡', kinds: ['bar'], c: '#39ff88', tip: 'A faint radar-style sweep turns behind the score box.',
    css: `{opacity:var(--a)} ::after{content:'';position:absolute;width:var(--rs,120px);height:var(--rs,120px);top:50%;left:var(--rx,85%);margin:calc(var(--rs,120px)/-2);border-radius:50%;background:conic-gradient(from 0deg,transparent 70%,var(--cB));animation:fx-spin 3s linear infinite}`,
    build: x => { x.layer.style.setProperty('--rs', (x.h * 1.6) + 'px'); x.layer.style.setProperty('--rx', (x.side === 2 ? 14 : 86) + '%'); } });
  look('barbed', { label: 'Barbed wire edge', emoji: '🪢', layer: 'edge', c: '#b9bec8', tip: 'A wire trim wraps the shape for gritty layouts.',
    css: `{filter:drop-shadow(0 1px 1px #000)} path{fill:none;stroke:var(--c);stroke-width:1.6} path+path{stroke-width:7;stroke-dasharray:1.5 16;stroke:var(--c2)}`, double: true });
  look('momentum', { label: 'Momentum meter', emoji: '📈', kinds: ['bar'], layer: 'outer', front: true, c: '#ffb020', tip: 'A thin bar underneath that fills with the player’s win streak in the set.',
    html: () => '<b></b>', css: `{top:auto;bottom:-9px;height:5px;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden} b{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--c3),var(--c),var(--c2));box-shadow:0 0 8px var(--c);transition:width .6s cubic-bezier(.2,.8,.2,1)}`,
    paint: x => { x.layer.firstChild.style.width = Math.min(100, (x.streak || 0) / 3 * 100) + '%'; } });
  look('streakflames', { label: 'Win streak flames', emoji: '🔥', kinds: ['bar'], layer: 'outer', front: true, c: '#ff6a1f', tip: 'Flames grow along the top after two or more games won in a row.',
    html: x => range(10, i => `<i style="left:${(i * 10 + 2)}%;animation-delay:${(x.r() * .6).toFixed(2)}s"></i>`).join(''),
    css: `{bottom:auto;height:40px;top:-34px;opacity:0;transition:opacity .5s} .on{opacity:1} i{position:absolute;bottom:0;width:9%;height:100%;background:radial-gradient(50% 70% at 50% 100%,#fff2c0,var(--c) 45%,transparent 70%);border-radius:50% 50% 20% 20%;transform-origin:bottom;animation:fx-flame .5s ease-in-out infinite alternate;filter:blur(1px)}`,
    paint: x => { x.layer.style.opacity = (x.streak || 0) >= 2 ? 1 : 0; x.layer.style.transform = `scaleY(${Math.min(1.6, .6 + (x.streak || 0) * .25)})`; x.layer.style.transformOrigin = 'bottom'; } });
  look('comeback', { label: 'Comeback spark', emoji: '⚡', kinds: ['bar'], layer: 'outer', front: true, c: '#7df9ff', tip: 'A bright spark trail when the player wins a game after being down two.',
    html: () => '<b></b>', css: `b{position:absolute;top:45%;left:-10%;width:30%;height:4px;border-radius:4px;background:linear-gradient(90deg,transparent,var(--c),#fff);box-shadow:0 0 12px var(--c);opacity:0}`,
    on: (x, ev) => { if (ev.type === 'score' && ev.downBy >= 2) x.api.anim(x.layer.firstChild, [{ left: '-30%', opacity: 1 }, { left: '110%', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.5,0,.2,1)' }); } });
  look('leadshadow', { label: 'Leader’s shadow', emoji: '🌑', kinds: ['bar'], layer: 'filter', c: '#000000', tip: 'A deep drop shadow grows under the player who’s ahead.' });
  look('zipper', { label: 'Zipper seam', emoji: '🤐', c: '#c9ced8', tip: 'A metal zip runs along the middle (pairs with the Zip open entrance).',
    css: `{opacity:var(--a)} ::before{content:'';position:absolute;left:0;right:0;top:calc(50% - 4px);height:8px;background:repeating-linear-gradient(90deg,var(--c) 0 4px,transparent 4px 8px),linear-gradient(transparent 3px,var(--c3) 3px 5px,transparent 5px);filter:drop-shadow(0 1px 1px #000)}
      ::after{content:'';position:absolute;top:calc(50% - 9px);left:8%;width:16px;height:18px;border-radius:4px;background:linear-gradient(var(--c2),var(--c3));box-shadow:0 1px 2px #000}` });
  look('tally', { label: 'Tally marks', emoji: '✍️', kinds: ['bar'], c: '#ffffff', tip: 'Chalk tally marks scratch on for each game won.',
    html: x => `<svg width="100%" height="100%" viewBox="0 0 ${x.w} ${x.h}" preserveAspectRatio="none">${range(10, i => { const g = Math.floor(i / 5), k = i % 5, bx = (x.side === 2 ? x.w * .62 : x.w * .3) + g * 40, y0 = x.h * .78, y1 = x.h * .96;
      return k < 4 ? `<path class="m" d="M${bx + k * 7} ${y0}L${bx + k * 7 + 1} ${y1}" pathLength="1"/>` : `<path class="m" d="M${bx - 4} ${y1 - 2}L${bx + 26} ${y0 + 2}" pathLength="1"/>`; }).join('')}</svg>`,
    css: `svg{position:absolute;inset:0} .m{fill:none;stroke:var(--c);stroke-width:2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;opacity:.85;transition:stroke-dashoffset .45s ease-out} .m.on{stroke-dashoffset:0}`,
    paint: x => { const n = Number(x.b.me.score) || 0; x.layer.querySelectorAll('.m').forEach((m, i) => m.classList.toggle('on', i < n)); } });
  look('lacquer', { label: 'Lacquer depth', emoji: '🎹', c: '#ffffff', tip: 'A deep glossy coat, as if the colour sits under clear varnish.',
    css: `{background:linear-gradient(180deg,var(--cB) 0,rgba(255,255,255,.18) 18%,transparent 40%),linear-gradient(0deg,rgba(0,0,0,.4),transparent 40%);opacity:var(--a)} ::after{content:'';position:absolute;left:6%;right:40%;top:8%;height:16%;border-radius:50%;background:linear-gradient(rgba(255,255,255,.55),transparent);filter:blur(1px)}` });
  look('nightvision', { label: 'Night vision', emoji: '🥽', c: '#39ff6a', tip: 'A green-tinted, grainy night-vision look.',
    css: `{background:${turb('.8', 1, '0 0 0 0 .3  0 0 0 0 1  0 0 0 0 .4  0 0 0 .35 0', 120, 120)},var(--cA);mix-blend-mode:hard-light;opacity:var(--a);animation:fx-grain .3s steps(3) infinite} ::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px)}` });
  look('lightleak', { label: 'Light leak', emoji: '🌅', c: '#ff9a3d', tip: 'Warm light blooms in from one corner now and then.',
    css: `{background:radial-gradient(60% 120% at 0 0,var(--cB),var(--cA) 40%,transparent 70%);mix-blend-mode:screen;opacity:0;animation:fx-leak 9s ease-in-out infinite}` });

  // ---------------------------------------------------------------- Player Bar Lettering
  const tlook = (id, o) => look(id, { layer: 'text', cat: 'Lettering', kinds: ['text'], ...o });
  tlook('engraved', { label: 'Engraved plate', emoji: '🏷️', c: '#c9a24a', tip: 'Letters engraved into a brass name plate.',
    css: `{background:linear-gradient(180deg,var(--c3),var(--c) 50%,var(--c3))!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;filter:drop-shadow(0 1px 0 rgba(255,255,255,.5)) drop-shadow(0 -1px 0 rgba(0,0,0,.7))}` });
  tlook('wheel', { label: 'Colour wheel letters', emoji: '🎡', split: true, c: '#ff3b3b', tip: 'Each letter is one step along a colour wheel.',
    css: ` .fxch{-webkit-text-fill-color:hsl(calc(var(--i)*36deg + var(--h0,0deg)),95%,62%)!important}`, build: x => { const [r, g, b] = hexRgb(x.c); x.node.style.setProperty('--h0', Math.round(Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI) + 'deg'); } });
  tlook('bloom', { label: 'Soft bloom', emoji: '🌫️', c: '#ffffff', tip: 'A wide, very faint light spill around the text.', css: `{filter:drop-shadow(0 0 18px var(--cA)) drop-shadow(0 0 40px var(--cA))}` });
  tlook('double', { label: 'Double outline', emoji: '⭕', c: '#000000', tip: 'Two strokes in contrasting colours around the letters.',
    css: `{filter:drop-shadow(2px 0 0 var(--c)) drop-shadow(-2px 0 0 var(--c)) drop-shadow(0 2px 0 var(--c)) drop-shadow(0 -2px 0 var(--c)) drop-shadow(2px 0 0 var(--c2)) drop-shadow(-2px 0 0 var(--c2)) drop-shadow(0 2px 0 var(--c2)) drop-shadow(0 -2px 0 var(--c2))}` });
  tlook('neonletters', { label: 'Neon tube letters', emoji: '🔆', c: '#ff2fd6', tip: 'Letters drawn as glowing neon tubes.',
    css: `{-webkit-text-fill-color:transparent!important;-webkit-text-stroke:calc(.045em*var(--a)) var(--c2);filter:drop-shadow(0 0 3px var(--c)) drop-shadow(0 0 10px var(--c));animation:fx-flick 5s steps(1) infinite}` });
  tlook('longshadow', { label: 'Long shadow', emoji: '📐', c: '#000000', tip: 'A diagonal shadow that stretches far behind.', css: `{filter:var(--lsh)}`, build: x => { x.node.style.setProperty('--lsh', range(8, i => `drop-shadow(${i < 1 ? 2 : 2}px ${2}px 0 ${rgba(x.c, .55 - i * .05)})`).join(' ')); } });
  tlook('bevel', { label: 'Inner bevel', emoji: '🔲', c: '#000000', tip: 'Letters look carved into the piece.', css: `{filter:drop-shadow(0 -1px 0 rgba(0,0,0,.8)) drop-shadow(0 1px 0 rgba(255,255,255,.35));opacity:.92}` });
  tlook('emboss', { label: 'Emboss', emoji: '⬆️', c: '#000000', tip: 'Letters look raised off the piece.', css: `{filter:drop-shadow(0 -1px 0 rgba(255,255,255,.55)) drop-shadow(0 2px 1px rgba(0,0,0,.8)) drop-shadow(0 4px 6px rgba(0,0,0,.4))}` });
  tlook('sweepfill', { label: 'Gradient sweep fill', emoji: '🎨', c: '#ff5a1f', tip: 'Colours move slowly through the letters.', fill: true,
    css: `{background:linear-gradient(90deg,var(--c),var(--c2),#ffffff,var(--c2),var(--c))!important;background-size:300% 100%!important;animation:fx-sweep 4s linear infinite}` });
  tlook('stormfill', { label: 'Storm fill', emoji: '⛈️', c: '#9ad6ff', tip: 'Small bolts flicker inside the letters.', fill: true,
    css: `{background:linear-gradient(115deg,var(--c3) 0 40%,#fff 42%,var(--c) 44% 60%,#fff 61%,var(--c3) 63%)!important;background-size:300% 100%!important;animation:fx-storm 2.6s steps(1) infinite}` });
  tlook('icefill', { label: 'Ice fill', emoji: '🧊', c: '#a8e6ff', tip: 'Frosty blue with tiny sparkles.', fill: true,
    css: `{background:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#fff,transparent),linear-gradient(180deg,#ffffff,var(--c) 55%,var(--c3))!important;background-size:16px 12px,22px 14px,100% 100%!important;-webkit-text-stroke:.5px rgba(255,255,255,.6);animation:fx-twinkle 2s steps(2) infinite}` });
  tlook('waterfill', { label: 'Water fill', emoji: '🌊', c: '#2f9bff', tip: 'A wavy liquid level inside the letters.', fill: true,
    css: `{background:linear-gradient(180deg,rgba(255,255,255,.25) 0 46%,var(--c2) 46% 50%,var(--c) 50% 100%)!important;background-size:100% 200%!important;animation:fx-level 3s ease-in-out infinite alternate}` });
  tlook('glitchsplit', { label: 'Glitch split', emoji: '📺', pseudo: true, c: '#ff0050', tip: 'Red and blue copies jitter slightly off the letters.',
    css: `{position:relative} ::before,::after{content:attr(data-txt);position:absolute;left:.04em;top:0;pointer-events:none;-webkit-text-fill-color:currentColor;background:none!important}
      ::before{color:var(--c);transform:translateX(-2px);mix-blend-mode:screen;animation:fx-glitchA 2.4s steps(1) infinite} ::after{color:#00e5ff;transform:translateX(2px);mix-blend-mode:screen;animation:fx-glitchB 2.4s steps(1) infinite}` });
  tlook('scanlinetext', { label: 'Scanline text', emoji: '〰️', c: '#ffffff', tip: 'Thin lines cut through the letters like an old screen.', fill: true,
    css: `{background:repeating-linear-gradient(180deg,var(--c) 0 2px,transparent 2px 3px)!important;animation:fx-scan 1.2s linear infinite}` });
  tlook('halftonefill', { label: 'Halftone fill', emoji: '🟠', c: '#ff5a1f', tip: 'Comic-print dots inside the letters.', fill: true,
    css: `{background:radial-gradient(circle,var(--c) 40%,var(--c3) 44%)!important;background-size:5px 5px!important}` });
  tlook('brush', { label: 'Brush stroke', emoji: '🖌️', filt: 'rough', c: '#ffffff', tip: 'Letters look painted with a rough brush edge.' });
  tlook('graffiti', { label: 'Graffiti drip', emoji: '🎨', pseudo: true, c: '#ff2f8a', tip: 'Paint drips down from the letters.',
    css: `{position:relative} ::after{content:attr(data-txt);position:absolute;left:.04em;top:.18em;-webkit-text-fill-color:var(--c);color:var(--c);background:none!important;transform-origin:top;transform:scaleY(1.5);-webkit-mask:linear-gradient(180deg,transparent 45%,#000 60%,transparent 95%);z-index:-1;animation:fx-dripText 4s ease-in infinite}` });
  tlook('stencil', { label: 'Stencil cut', emoji: '🔠', c: '#ffffff', tip: 'Gaps in the letters like spray-paint stencils.', fill: true,
    css: `{background:repeating-linear-gradient(90deg,var(--c) 0 .32em,transparent .32em .36em)!important}` });
  tlook('pixelfont', { label: 'Pixel font mode', emoji: '👾', c: '#ffffff', tip: 'The name turns blocky, like a retro pixel font.', css: `{font-family:'Courier New',monospace!important;font-weight:900!important;font-style:normal!important;-webkit-mask:linear-gradient(90deg,#000 80%,transparent 0) 0 0/4px 4px,linear-gradient(#000 80%,transparent 0) 0 0/4px 4px;-webkit-mask-composite:source-in;mask-composite:intersect;letter-spacing:.05em}` });
  tlook('holofoil', { label: 'Holographic foil', emoji: '🪩', c: '#ff7ae0', tip: 'Rainbow colours shift across the letters.', fill: true,
    css: `{background:linear-gradient(115deg,#ff7ae0,#7af7ff,#c5ff7a,#ffd27a,#ff7ae0)!important;background-size:250% 100%!important;animation:fx-sweep 3.5s linear infinite;filter:drop-shadow(0 0 2px rgba(255,255,255,.6))}` });
  tlook('glass', { label: 'Glass letters', emoji: '🥃', c: '#ffffff', tip: 'See-through letters with a bright edge.',
    css: `{-webkit-text-fill-color:${'rgba(255,255,255,.12)'}!important;-webkit-text-stroke:1px var(--cB);filter:drop-shadow(0 0 6px var(--cA))}` });
  tlook('smoketrail', { label: 'Smoke trail', emoji: '💨', pseudo: true, c: '#d0d4dc', tip: 'A faint smoke rises off the letters.',
    css: `{position:relative} ::after{content:attr(data-txt);position:absolute;left:.04em;top:0;-webkit-text-fill-color:var(--cA);color:var(--cA);background:none!important;filter:blur(4px);animation:fx-smokeText 3s ease-out infinite;pointer-events:none}` });
  tlook('wax', { label: 'Dripping wax', emoji: '🕯️', filt: 'melt', c: '#f6e7c8', tip: 'Letters look like slowly melting candle wax.', fill: true,
    css: `{background:linear-gradient(180deg,#fffaf0,var(--c) 60%,var(--c3))!important}` });
  tlook('patch', { label: 'Embroidered patch', emoji: '🧵', c: '#ffcf3d', tip: 'Letters look stitched on like a jersey patch.', fill: true,
    css: `{background:repeating-linear-gradient(60deg,var(--c) 0 1.5px,var(--c3) 1.5px 2.5px)!important;filter:drop-shadow(0 0 0 #fff) drop-shadow(1px 1px 0 #fff) drop-shadow(-1px -1px 0 #fff) drop-shadow(2px 2px 0 rgba(0,0,0,.5))}` });
  tlook('starryfill', { label: 'Starry fill', emoji: '🌠', c: '#1d1b5e', tip: 'Tiny stars twinkle inside the letters.', fill: true,
    css: `{background:radial-gradient(1.2px 1.2px at 30% 40%,#fff,transparent),radial-gradient(1px 1px at 70% 70%,#fff,transparent),linear-gradient(180deg,var(--c),var(--c3))!important;background-size:18px 14px,13px 11px,100% 100%!important;animation:fx-twinkle 1.6s steps(2) infinite;-webkit-text-stroke:.5px rgba(200,200,255,.5)}` });
  tlook('marble', { label: 'Marble fill', emoji: '🏛️', c: '#f4f1ea', tip: 'A stone marble texture in the letters.', fill: true,
    css: `{background:${turb('.012 .05', 5, '0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .55  0 0 0 -6 3', 300, 120, 'turbulence')},linear-gradient(var(--c),var(--c))!important;background-size:300px 120px,100% 100%!important}` });
  tlook('wood', { label: 'Wood grain', emoji: '🪵', c: '#a0632e', tip: 'Carved wood texture for themed layouts.', fill: true,
    css: `{background:${turb('.004 .12', 3, '0 0 0 0 .25  0 0 0 0 .13  0 0 0 0 .05  0 0 0 1.2 -.1', 300, 120)},linear-gradient(var(--c2),var(--c))!important;background-size:300px 120px,100% 100%!important}` });
  tlook('rune', { label: 'Rune glow', emoji: 'ᚱ', pseudo: true, c: '#6ef0ff', tip: 'A glowing underline that looks like ancient script.',
    css: `{position:relative} ::after{content:'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ';position:absolute;left:0;right:0;bottom:-.42em;font-size:.32em;letter-spacing:.3em;white-space:nowrap;overflow:hidden;-webkit-text-fill-color:var(--c);color:var(--c);background:none!important;text-shadow:0 0 6px var(--c);animation:fx-pulse 2.4s ease-in-out infinite}` });
  tlook('kanji', { label: 'Kanji accent', emoji: '🈷️', pseudo: true, c: '#ff3b3b', tip: 'A faint large character sits behind the name.',
    css: `{position:relative;isolation:isolate} ::before{content:'闘';position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:1.6em;line-height:1;-webkit-text-fill-color:var(--cA);color:var(--cA);background:none!important;z-index:-1;font-family:'Yu Mincho','Hiragino Mincho ProN',serif}` });
  tlook('ransom', { label: 'Ransom note', emoji: '✂️', split: true, c: '#ffffff', tip: 'Letters cut from different magazines (for fun looks).',
    css: ` .fxch{display:inline-block;padding:0 .05em;margin:0 .02em;-webkit-text-fill-color:var(--rc)!important;background:var(--rb)!important;transform:rotate(var(--rr));font-family:var(--rf)!important}`,
    letter: (s, i, x) => { const r = rng(i * 97 + 13); const F = ["'Bangers',sans-serif", "'Cinzel',serif", "'Permanent Marker',cursive", "'Chakra Petch',sans-serif", "'Courier New',monospace", "'Bungee',sans-serif"], B = ['#ffffff', '#111111', '#ffd23a', '#ff5a5a', '#5ad1ff', '#f2e6c9'];
      const bg = B[Math.floor(r() * 6)]; s.style.setProperty('--rb', bg); s.style.setProperty('--rc', bg === '#111111' || bg === '#ff5a5a' ? '#ffffff' : '#111111'); s.style.setProperty('--rr', ((r() - .5) * 14).toFixed(1) + 'deg'); s.style.setProperty('--rf', F[Math.floor(r() * 6)]); } });
  tlook('flagfade', { label: 'Country flag fade', emoji: '🏳️', kinds: ['bar'], layer: 'surface', c: '#ffffff', tip: 'The player’s flag blends softly behind the name.',
    css: `{background:var(--flag,none) var(--fx,15%) 50%/auto 140% no-repeat;opacity:calc(.35*var(--a));-webkit-mask:linear-gradient(90deg,transparent,#000 30%,#000 50%,transparent 80%);mask:linear-gradient(90deg,transparent,#000 30%,#000 50%,transparent 80%)}`,
    paint: x => { const u = String(x.b.me.flagUrl || ''); x.layer.style.setProperty('--flag', u ? `url("${u.replace(/"/g, '')}")` : 'none'); x.layer.style.setProperty('--fx', x.side === 2 ? '85%' : '15%'); } });
  tlook('sticker', { label: 'Sticker peel corner', emoji: '🏷️', pseudo: true, c: '#ffffff', tip: 'The name looks like a sticker with one corner lifting.',
    css: `{position:relative;filter:drop-shadow(3px 0 0 var(--c)) drop-shadow(-3px 0 0 var(--c)) drop-shadow(0 3px 0 var(--c)) drop-shadow(0 -3px 0 var(--c)) drop-shadow(0 3px 3px rgba(0,0,0,.5))} ::after{content:'';position:absolute;right:0;top:.05em;width:.32em;height:.32em;background:linear-gradient(225deg,transparent 50%,#e6e6e6 50%,#fff);box-shadow:-1px 1px 2px rgba(0,0,0,.4);animation:fx-peel 3s ease-in-out infinite alternate}` });
  tlook('lglow', { label: '[L] tag glow', emoji: '🔴', kinds: ['bar'], c: '#ff2a2a', tip: 'The losers tag glows red.', target: 'ltag', css: `{box-shadow:0 0 10px var(--c),0 0 22px var(--cA);animation:fx-pulse 1.4s ease-in-out infinite}` });
  tlook('sponsorcolor', { label: 'Sponsor colour', emoji: '🏢', kinds: ['bar'], c: '#ffd23a', tip: 'The team tag takes a colour you choose, with a soft glow.', target: 'team', css: `{-webkit-text-fill-color:var(--c)!important;color:var(--c)!important;text-shadow:0 0 10px var(--cA)}` });
  tlook('weight', { label: 'Weight by score', emoji: '🏋️', kinds: ['bar'], c: '#ffffff', tip: 'The lettering gets bolder with each game the player wins.',
    paint: x => { const n = Number(x.b.me.score) || 0; for (const el of x.letters) { el.style.webkitTextStroke = n ? `${(n * .022).toFixed(3)}em currentColor` : ''; el.style.paintOrder = 'stroke fill'; } } });
  tlook('lspace', { label: 'Letter spacing breathe', emoji: '🫁', c: '#ffffff', tip: 'The letters spread and close very slowly at idle.', css: `{animation:fx-spacing 6s ease-in-out infinite}` });
  tlook('underbeam', { label: 'Underline beam', emoji: '➖', pseudo: true, c: '#ff5a1f', tip: 'A bright line under the name in the player’s colour.',
    css: `{position:relative} ::after{content:'';position:absolute;left:4%;right:4%;bottom:.02em;height:.07em;border-radius:1em;background:linear-gradient(90deg,transparent,var(--c),#fff,var(--c),transparent);background-size:200% 100%;box-shadow:0 0 8px var(--c);animation:fx-sweep 3s linear infinite}` });
  tlook('marker', { label: 'Highlight marker', emoji: '🖍️', pseudo: true, c: '#fff36b', tip: 'A marker-pen highlight behind the name.',
    css: `{position:relative;isolation:isolate} ::before{content:'';position:absolute;left:0;right:0;top:48%;bottom:4%;background:var(--cB);transform:skewX(-12deg) rotate(-1deg) scaleX(.96);z-index:-1;border-radius:.1em .3em}` });
  tlook('mpred', { label: 'Match point red', emoji: '🌡️', kinds: ['bar'], when: 'matchpoint', c: '#ff2a12', tip: 'The name turns red-hot on match point.', fill: true,
    css: `{background:linear-gradient(180deg,#fff3c0,#ff8a3d 40%,var(--c) 70%,var(--c3))!important;filter:drop-shadow(0 0 8px var(--c));animation:fx-flick 1.6s steps(1) infinite}` });
  tlook('letterpress', { label: 'Letterpress ink', emoji: '🖨️', filt: 'ink', c: '#1a1a1a', tip: 'An uneven, pressed-ink print look with soft edges.' });
  tlook('led', { label: 'LED dot matrix', emoji: '🔢', c: '#ffb020', tip: 'Letters made of small lit dots like a stadium sign.', fill: true,
    css: `{background:radial-gradient(circle,var(--c2) 42%,rgba(0,0,0,.25) 50%)!important;background-size:5px 5px!important;filter:drop-shadow(0 0 3px var(--c))}` });
  tlook('strikeloser', { label: 'Strikethrough loser', emoji: '❌', pseudo: true, kinds: ['bar'], when: 'loser', c: '#ff3b3b', tip: 'A line slashes through the loser’s name.',
    css: `{position:relative} ::after{content:'';position:absolute;left:0;right:0;top:52%;height:.09em;background:var(--c);transform:rotate(-3deg);box-shadow:0 0 6px var(--c);animation:fx-slashIn .4s ease-out both}` });
  tlook('lockup', { label: 'Tag lock-up', emoji: '🔗', kinds: ['bar'], c: '#ff5a1f', tip: 'The team tag and name join into one logo-style mark.', target: 'team',
    css: `{background:var(--c)!important;-webkit-text-fill-color:#fff!important;color:#fff!important;padding:.05em .35em;margin-right:-.1em;clip-path:polygon(0 0,100% 0,calc(100% - .3em) 100%,0 100%)}` });
  tlook('streakcount', { label: 'Streak counter', emoji: '✖️', kinds: ['bar'], layer: 'outer', front: true, c: '#ffb020', tip: 'A small “x3” next to the name for win streaks.',
    html: () => '<b></b>', css: `b{position:absolute;top:-14px;font:800 16px/20px 'Chakra Petch',sans-serif;color:var(--c);text-shadow:0 0 8px var(--c);opacity:0;transition:opacity .3s}`,
    paint: x => { const b = x.layer.firstChild, s = x.streak || 0; b.textContent = 'x' + s; b.style.opacity = s >= 2 ? 1 : 0; b.style[x.side === 2 ? 'left' : 'right'] = '24%'; } });
  tlook('digitglow', { label: 'Score digit glow', emoji: '💫', kinds: ['bar'], c: '#ffd36b', tip: 'The score numbers glow brighter as they go up.', target: 'num',
    paint: x => { const n = Number(x.b.me.score) || 0; x.targets.forEach(t => { t.style.filter = `drop-shadow(0 0 ${4 + n * 5}px ${x.c})`; }); } });
  tlook('roman', { label: 'Roman numeral scores', emoji: '🏛️', kinds: ['bar'], c: '#ffffff', tip: 'Scores shown as I, II, III for classical layouts.', target: 'num',
    paint: x => { x.targets.forEach(t => { const raw = t.dataset.txt ?? t.textContent; const r = ROMAN(raw); if (t.textContent !== r) t.textContent = r; }); } });
  tlook('reflect', { label: 'Mirror reflection', emoji: '🪞', pseudo: true, c: '#ffffff', tip: 'A faded upside-down reflection under the name.',
    css: `{position:relative;overflow:visible!important} ::after{content:attr(data-txt);position:absolute;left:.04em;top:92%;transform:scaleY(-1);transform-origin:top;-webkit-mask:linear-gradient(0deg,rgba(0,0,0,.45),transparent 70%);mask:linear-gradient(0deg,rgba(0,0,0,.45),transparent 70%);pointer-events:none}` });
  tlook('ticker', { label: 'Event name ticker', emoji: '📰', kinds: ['header'], c: '#ffffff', tip: 'The event line scrolls when it’s too long to fit.', target: 'meta',
    paint: x => { for (const t of x.targets) { const over = t.scrollWidth - t.clientWidth; t.style.overflow = 'hidden'; const inner = t.firstElementChild && t.firstElementChild.classList.contains('fxtick') ? t.firstElementChild : null;
      if (over > 4 && !inner) { const s = document.createElement('span'); s.className = 'fxtick'; s.textContent = t.textContent; t.textContent = ''; t.appendChild(s); s.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-over - 20}px)` }], { duration: 3000 + over * 25, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }); } } } });
  tlook('kana', { label: 'Katakana subtitle', emoji: '🈁', kinds: ['bar'], layer: 'outer', front: true, c: '#ffffff', tip: 'A tiny line above the name in katakana. Type your own into the custom field p1kana / p2kana, or it’s made from the name.',
    html: () => '<b></b>', css: `b{position:absolute;top:-16px;font:700 13px/16px 'Yu Gothic','Meiryo',sans-serif;letter-spacing:.25em;color:var(--c);opacity:.8;white-space:nowrap}`,
    paint: x => { const own = ((x.S.custom || {})['p' + x.side + 'kana']) || ''; const auto = String(x.b.me.name || '').toLowerCase().replace(/[^a-z]/g, '').split('').map(ch => KANA[ch] || '').join('').slice(0, 10); const b = x.layer.firstChild; b.textContent = own || auto; b.style[x.side === 2 ? 'right' : 'left'] = '6%'; } });
  tlook('glitter', { label: 'Gel pen glitter', emoji: '✨', c: '#ff7ad9', tip: 'Glittery gel-pen letters with tiny sparkles.', fill: true,
    css: `{background:radial-gradient(1px 1px at 25% 35%,#fff,transparent),radial-gradient(1px 1px at 65% 65%,#fff,transparent),radial-gradient(1px 1px at 45% 15%,#fff,transparent),linear-gradient(180deg,var(--c2),var(--c),var(--c3))!important;background-size:9px 9px,11px 7px,7px 11px,100% 100%!important;animation:fx-twinkle 1s steps(2) infinite}` });


  // gallery categories
  const CAT = {
    Materials: 'metal carbon frost leather lacquer paper chrome zipper stained',
    'Light & glow': 'holo aurora lightleak caustic oilslick neontube current nightvision radar drift',
    'Nature & elements': 'heathaze cloth sand icefrost liquid smoke drip vines petals snowcap rust inkwash',
    'Retro & print': 'vhs crt dither halftone moire',
    'Patterns & edges': 'circuit hexshield stars barbed gfframe teamstripe',
    'Match moments': 'heatmap damage momentum streakflames comeback tally seedbadge losertint leadshadow chartint',
    'Letter fills': 'sweepfill stormfill icefill waterfill halftonefill holofoil starryfill marble wood led glitter wax patch scanlinetext stencil engraved wheel',
    'Outlines & depth': 'double neonletters longshadow bevel emboss glass sticker bloom reflect pixelfont letterpress brush',
    'Moving letters': 'glitchsplit smoketrail graffiti lspace underbeam rune mpred',
    'Player details': 'kanji ransom flagfade lglow sponsorcolor weight strikeloser lockup streakcount digitglow roman ticker kana marker',
  };
  for (const [c, ids] of Object.entries(CAT)) for (const id of ids.split(' ')) if (L[id]) L[id].cat = c;

  // ============================================================================================ shared CSS
  const KEYS = `
@keyframes fx-holo{to{background-position:0 8px}}
@keyframes fx-hue{to{filter:hue-rotate(360deg)}}
@keyframes fx-drift{0%,100%{left:-60%}50%{left:100%}}
@keyframes fx-sweep{0%{background-position:0 0}100%{background-position:300% 0}}
@keyframes fx-liquid{to{background-position:100% 0}}
@keyframes fx-sand{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(26px,52px);opacity:0}}
@keyframes fx-melt{0%,100%{opacity:calc(.9*var(--a))}50%{opacity:calc(.35*var(--a))}}
@keyframes fx-spin{to{transform:rotate(360deg)}}

@keyframes fx-flick{0%,46%,50%,90%,100%{opacity:1}47%,49%{opacity:.5}91%{opacity:.75}}
@keyframes fx-stars{to{transform:translateX(50%)}}
@keyframes fx-smoke{0%{transform:translate(0,0) scale(.4);opacity:0}20%{opacity:.7}100%{transform:translate(14px,-70px) scale(2.2);opacity:0}}
@keyframes fx-backlit{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}
@keyframes fx-dash{to{stroke-dashoffset:-100}}
@keyframes fx-pulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes fx-rust{from{--rust:-25%}to{--rust:100%}}
@keyframes fx-drip{0%{transform:scaleY(.2);opacity:0}10%{opacity:1}70%{transform:scaleY(5);opacity:1}100%{transform:scaleY(7) translateY(6px);opacity:0}}
@keyframes fx-grow{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes fx-pop{from{transform:scale(0)}to{transform:none}}
@keyframes fx-petal{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:1}45%{transform:translate(8px,30px) rotate(140deg)}60%{transform:translate(28px,30px) rotate(200deg)}100%{transform:translate(70px,110px) rotate(420deg);opacity:0}}
@keyframes fx-snowcap{from{transform:scaleY(.05)}to{transform:none}}
@keyframes fx-vhs{0%{top:-25%}100%{top:110%}}
@keyframes fx-caustic{to{background-position:400px 200px}}
@keyframes fx-inkspread{to{transform:scale(1.15);filter:blur(1px)}}
@keyframes fx-grain{to{background-position:30px 40px,0 0}}
@keyframes fx-leak{0%,60%,100%{opacity:0}75%{opacity:calc(.8*var(--a))}}
@keyframes fx-flame{to{transform:scaleY(1.35) skewX(4deg)}}
@keyframes fx-storm{0%,62%,66%,100%{background-position:300% 0;filter:none}63%{background-position:120% 0;filter:brightness(1.8)}65%{background-position:60% 0}}
@keyframes fx-twinkle{50%{background-position:4px 3px,-3px 2px,0 0,0 0}}
@keyframes fx-level{from{background-position:0 10%}to{background-position:0 60%}}
@keyframes fx-glitchA{0%,90%,100%{clip-path:inset(0 0 0 0);transform:translateX(-2px)}92%{clip-path:inset(10% 0 55% 0);transform:translateX(-6px)}95%{clip-path:inset(60% 0 5% 0);transform:translateX(4px)}}
@keyframes fx-glitchB{0%,88%,100%{clip-path:inset(0 0 0 0);transform:translateX(2px)}91%{clip-path:inset(50% 0 20% 0);transform:translateX(6px)}96%{clip-path:inset(5% 0 70% 0);transform:translateX(-4px)}}
@keyframes fx-scan{to{background-position:0 3px}}
@keyframes fx-dripText{0%,20%{transform:scaleY(1)}100%{transform:scaleY(1.9)}}
@keyframes fx-smokeText{0%{transform:translateY(0);opacity:.6}100%{transform:translateY(-.6em) scale(1.08);opacity:0}}
@keyframes fx-peel{to{width:.42em;height:.42em}}
@keyframes fx-spacing{50%{letter-spacing:.06em}}
@keyframes fx-slashIn{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
`;
  const CSS0 = `
.fxs,.fxo,.fxe{position:absolute;inset:0;pointer-events:none}
.fxo{overflow:visible}
.fxe svg{position:absolute;left:0;top:0;overflow:visible}
.fxch{display:inline-block;white-space:pre}
html.sb-potato .fxs,html.sb-potato .fxo,html.sb-potato .fxe{animation:none!important}html.sb-potato .fxs *,html.sb-potato .fxo *{animation:none!important}
html.sb-light .fxo i{display:none}
`;
  function lookCSS() {
    let s = '';
    for (const [id, d] of Object.entries(L)) {
      if (!d.css) continue;
      const sel = d.layer === 'text' && !d.target ? `.fxt-${id}` : d.layer === 'text' && d.target ? `.fxt-${id}` : d.layer === 'outer' ? `.fxo.fxl-${id}` : d.layer === 'edge' ? `.fxe.fxl-${id}` : `.fxs.fxl-${id}`;
      // "{…} ::after{…} i{…}" → each block gets the selector
      s += d.css.replace(/(^|\})\s*([^{}]*)\{/g, (m, close, part) => `${close}\n${part.trim() ? part.split(',').map(p => p.trim().startsWith('::') ? sel + p.trim() : (p.trim().startsWith('.fxch') ? sel + ' ' + p.trim() : sel + ' ' + p.trim())).join(',') : sel}{`);
      if (d.fill) s += `\n.fxt-${id}{-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;color:transparent}`;
    }
    return s;
  }

  // ============================================================================================ applying looks
  // filters live in one hidden <svg> per page
  function filters(root) {
    if (document.getElementById('fx-filters')) return;
    const s = document.createElementNS(NS, 'svg'); s.id = 'fx-filters'; s.setAttribute('width', 0); s.setAttribute('height', 0); s.style.position = 'absolute';
    // 1.12.15 cloth: noise, faded to nothing at the top edge (where it hangs) and full at the bottom, bends the piece
    const clothGrad = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'><linearGradient id='a' x2='0' y2='1'><stop offset='0' stop-color='black'/><stop offset='1' stop-color='white'/></linearGradient><rect width='100' height='100' fill='url(#a)'/></svg>`);
    const CLOTH = `<filter id="fxf-cloth" x="-6%" y="-4%" width="112%" height="118%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".0042 .0019" numOctaves="2" seed="5" result="n"><animate attributeName="baseFrequency" dur="5.5s" values=".0042 .0019;.0057 .0026;.0042 .0019" repeatCount="indefinite"/></feTurbulence>`
      + `<feImage href="data:image/svg+xml,${clothGrad}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="g"/><feComposite in="n" in2="g" operator="arithmetic" k1="1" k2="0" k3="-.5" k4=".5" result="m"/>`
      + `<feDisplacementMap in="SourceGraphic" in2="m" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    s.innerHTML = CLOTH + `<filter id="fxf-haze" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".012 .06" numOctaves="2" seed="3"><animate attributeName="baseFrequency" dur="6s" values=".012 .06;.016 .09;.012 .06" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
<filter id="fxf-rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter>
<filter id="fxf-melt" x="0" y="0" width="100%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".05 .005" numOctaves="1" seed="9"><animate attributeName="seed" dur="9s" values="1;9;1" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="6" yChannelSelector="R"/></filter>
<filter id="fxf-ink"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 1.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/><feMorphology operator="erode" radius=".3"/></filter>
<filter id="fxf-pixel" x="0" y="0"><feFlood x="2" y="2" height="1" width="1"/><feComposite width="5" height="5"/><feTile result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/><feMorphology operator="dilate" radius="2.5"/></filter>`;
    (document.body || document.documentElement).appendChild(s);
  }
  let cssDone = false;
  function addCSS() { if (cssDone) return; cssDone = true; const st = document.createElement('style'); st.id = 'sb-fx-css'; { const c0 = KEYS + CSS0 + lookCSS() + ATMOS_CSS() + MOVE_CSS; st.textContent = (window.SBColours && window.SBColours.on ? window.SBColours.map(c0) : c0); } (document.head || document.documentElement).appendChild(st); }

  function vars(n, c, a) { n.style.setProperty('--c', c); n.style.setProperty('--c2', mix(c, '#ffffff', .45)); n.style.setProperty('--c3', mix(c, '#000000', .5)); n.style.setProperty('--cA', rgba(c, .35)); n.style.setProperty('--cB', rgba(c, .7)); n.style.setProperty('--a', String(a)); }
  // r = { el, node, parts } from sb-design; api = helpers from the renderer
  function buildLooks(r, api) {
    addCSS(); filters();
    const { el, parts } = r; r.fx2 = [];
    for (const [i, lk] of (el.looks || []).entries()) {
      const d = L[lk.k]; if (!d) continue;
      const c = lk.c || d.c || '#ffffff', a = Number(lk.amt) || 1, side = el.side === 2 ? 2 : 1;
      const x = { el, d, lk, c, c2: mix(c, '#ffffff', .45), c3: mix(c, '#000000', .5), w: el.w, h: el.h, side, r: rng((el.id || 'x').length * 131 + i * 977 + el.w), api, parts };
      const rec = { d, lk, x, nodes: [] };
      if (d.layer === 'text') {
        const T = d.target ? [parts[d.target]].filter(Boolean) : (parts.letters || []);
        rec.targets = T; x.targets = T; x.letters = parts.letters || [];
        for (const t of T) { t.classList.add('fx-tl'); vars(t, c, a); }
        for (const t of T) { x.node = t; d.build && d.build(x); }
        if (d.split) for (const t of T) splitWatch(t, d, x);
      } else if (d.layer === 'filter') {
        rec.filter = true;
      } else {
        const n = document.createElement('div');
        n.className = (d.layer === 'outer' ? 'fxo' : d.layer === 'edge' ? 'fxe' : 'fxs') + ' fxl-' + lk.k; vars(n, c, a);
        x.layer = n;
        if (d.layer === 'edge') { const p = api.path(el), s = (dd) => `<path d="${p}"${dd ? ' transform-origin="center"' : ''}/>`; n.innerHTML = `<svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}">${s()}${d.double ? s(1) : ''}</svg>`; }
        else if (d.inset) { const p = api.path(el, el.w - 12, el.h - 12); n.innerHTML = `<svg width="${el.w}" height="${el.h}"><path d="${p}" transform="translate(6 6)"/></svg>`; }
        else if (d.html) n.innerHTML = d.html(x);
        if (d.layer === 'surface') (parts.fx || parts.inn).appendChild(n);
        else if (d.front) parts.inn.appendChild(n);
        else if (d.layer === 'edge' && parts.bg && parts.bg.parentNode === parts.inn) parts.inn.insertBefore(n, parts.bg.nextSibling);   // 1.11: over the piece's fill (an outline drawn inside was hidden under it)
        else parts.inn.insertBefore(n, parts.inn.firstChild);
        d.build && d.build(x);
        rec.nodes.push(n);
      }
      r.fx2.push(rec);
    }
  }
  // per-letter looks: the renderer writes plain text, so wrap the letters again whenever it changes
  // ---- the comet relay (1.12): one comet per scene, passed from piece to piece. Web Animations, one piece at a time; it waits
  // while the page is hidden, paused (the panel's previews) or in Ultra-light, and starts again when pieces are rebuilt.
  const RELAY = new Set(); let relayT = 0;
  function relayKick() { clearTimeout(relayT); relayT = setTimeout(relayRun, 60); }
  function relayRun() {
    const groups = new Map();
    for (const m of [...RELAY]) {
      if (!m.svg.isConnected) { RELAY.delete(m); continue; }
      const g = m.svg.closest('.sd-scene') || m.svg.ownerDocument; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(m);
    }
    for (const [g, list] of groups) {
      list.sort((a, b) => (a.el.x + a.el.w / 2) - (b.el.x + b.el.w / 2));
      const seq = list.map((_, i) => i); for (let i = list.length - 2; i > 0; i--) seq.push(i);   // there and back: 1P → title → 2P → title → …
      const run = { list, seq, step: 0, gen: (g.__relayGen = (g.__relayGen || 0) + 1) };
      if (g.__relayAnim) g.__relayAnim.forEach(a => { try { a.cancel(); } catch {} });
      relayLeg(g, run);
    }
  }
  function nearest(path, px, py) {                     // where on the outline (0..1000) is closest to a point
    let best = 0, bd = Infinity; const L = path.getTotalLength(); if (!L) return 0;
    for (let i = 0; i < 72; i++) { const p = path.getPointAtLength(L * i / 72), dd = (p.x - px) ** 2 + (p.y - py) ** 2; if (dd < bd) { bd = dd; best = i / 72; } }
    return best * 1000;
  }
  // the streak's path round one piece as transform keyframes (one every ~8 px, so straight edges are exact), entering at
  // `start` (0..1 of the way round) and going all the way round once
  function cometFrames(m, start) {
    const path = m.svg.querySelector('path'), L = path && path.getTotalLength(); if (!L) return null;
    const n = Math.max(24, Math.min(400, Math.round(L / 8))), kf = []; let prev = null, ang = 0;
    for (let i = 0; i <= n; i++) {
      const at = ((start + i / n) % 1) * L, p = path.getPointAtLength(at), q = path.getPointAtLength(Math.min(L, at + 2) === at ? Math.max(0, at - 2) : Math.min(L, at + 2));
      let a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI; if (Math.min(L, at + 2) === at) a += 180;
      if (prev !== null) { while (a - prev > 180) a -= 360; while (a - prev < -180) a += 360; }
      prev = a; ang = a;
      kf.push({ offset: i / n, transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${ang.toFixed(1)}deg)` });
    }
    return kf;
  }
  function relayLeg(g, run) {
    if (g.__relayGen !== run.gen) return;
    const live = run.list.filter(m => m.svg.isConnected); if (!live.length) return;
    const doc = run.list[0].svg.ownerDocument, root = doc.documentElement;
    if (doc.hidden || (g.classList && (g.classList.contains('sd-hidden') || g.classList.contains('sd-under'))) || doc.getElementById('__sbpause') || root.classList.contains('sb-ultra') || root.classList.contains('sb-noanim') || root.classList.contains('sb-rest')) { g.__relayWait = setTimeout(() => relayLeg(g, run), 1200); return; }
    const i = run.seq[run.step % run.seq.length], m = run.list[i], prev = run.seq.length > 1 ? run.list[run.seq[(run.step + run.seq.length - 1) % run.seq.length]] : null;
    run.step++;
    if (!m.svg.isConnected) return relayLeg(g, run);
    if (!m.kf || m.from !== prev) {
      m.from = prev;
      const path = m.svg.querySelector('path');
      const start = prev && path ? nearest(path, prev.el.x + prev.el.w / 2 - m.el.x, prev.el.y + prev.el.h / 2 - m.el.y) / 1000 : 0;
      m.kf = cometFrames(m, start);
    }
    if (!m.kf) return;
    const dur = Math.max(2600, m.per / 300 * 1000), L = m.svg.querySelector('path').getTotalLength() || m.per, lag = m.seg / L * dur;
    // each link of the tail runs the same path a link-length behind the one before it, a little fainter
    const all = [];
    (m.cms || [m.cm]).forEach((c, k) => {
      const peak = [1, .8, .55, .3][k] || .3;
      all.push(c.animate(m.kf, { duration: dur, delay: k * lag, easing: 'linear', id: 'sb-relay' }));
      all.push(c.animate([{ opacity: 0 }, { opacity: peak, offset: .05 }, { opacity: peak, offset: .92 }, { opacity: 0 }], { duration: dur, delay: k * lag, id: 'sb-relay' }));
    });
    g.__relayAnim = all;
    all[all.length - 1].onfinish = () => relayLeg(g, run);
  }
  function splitWatch(t, d, x) {
    const wrap = () => {
      if (t.querySelector(':scope > .fxch')) return;
      const txt = t.textContent; if (!txt) return;
      t.textContent = '';
      [...txt].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'fxch'; s.textContent = ch; s.style.setProperty('--i', String(i)); d.letter && d.letter(s, i, x); t.appendChild(s); });
    };
    wrap();
    if (!t.__fxObs) { t.__fxObs = new MutationObserver(() => { if (t.__fxBusy) return; t.__fxBusy = true; try { wrap(); } finally { t.__fxBusy = false; } }); t.__fxObs.observe(t, { childList: true, characterData: true, subtree: true }); }
  }
  // live: on / off by "when", and each look's own updates
  function paintLooks(r, b, S, api) {
    if (!r.fx2 || !r.fx2.length) return;
    const st = r.__fxSt = r.__fxSt || { streak: 0 };
    let filt = [];
    for (const rec of r.fx2) {
      const { d, lk, x } = rec, on = whenOk(lk.when || d.when || 'always', b, S);
      x.S = S; x.b = b || { me: {}, op: {} }; x.streak = st.streak;
      for (const n of rec.nodes) n.style.display = on ? '' : 'none';
      if (rec.targets) for (const t of rec.targets) { t.classList.toggle('fxt-' + lk.k, on); if (d.filt) t.style.filter = on ? `url(#fxf-${d.filt})` : ''; }
      if (rec.filter && on) {
        if (lk.k === 'heathaze') filt.push('url(#fxf-haze)');
        if (lk.k === 'cloth') filt.push('url(#fxf-cloth)');
        if (lk.k === 'leadshadow') filt.push(b && b.lead ? `drop-shadow(0 ${10 * (Number(lk.amt) || 1)}px ${16 * (Number(lk.amt) || 1)}px ${rgba(x.c, .85)})` : '');
      }
      if (on && d.paint) try { d.paint(x); } catch (e) {}
    }
    const f = filt.filter(Boolean).join(' '); if (r.parts.inn.style.filter !== f) r.parts.inn.style.filter = f;
  }
  function lookEvent(r, ev) {
    const st = r.__fxSt = r.__fxSt || { streak: 0 };
    if (ev.type === 'score') st.streak = (st.streak || 0) + 1;
    if (ev.type === 'lose' || ev.type === 'reset') st.streak = 0;
    if (!r.fx2) return;
    for (const rec of r.fx2) if (rec.d.on) try { rec.d.on(rec.x, ev); } catch (e) {}
  }

  // ============================================================================================ placeholders filled in part 2
  let ATMOS_CSS = () => '';
  let MOVE_CSS = '';
  const API = { LOOKS: L, WHEN, whenOk, buildLooks, paintLooks, lookEvent, mix, rgba, rng, range, esc, turb, addCSS, filters, vars, NS,
    _setAtmosCSS(f) { ATMOS_CSS = f; }, _addMoveCSS(s) { MOVE_CSS += s; }, INS: {}, OUTS: {}, REACTS: {}, TEXTS: {}, ATMOS: {} };
  window.SBFX = API;
})();
