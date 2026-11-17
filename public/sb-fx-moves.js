/*
 * BeeboScore effects library, part 2 — moves: entrances (INS), exits (OUTS), reactions (REACTS),
 * text changes (TEXTS) and whole-screen backdrops (ATMOS). Needs sb-fx.js first.
 *
 * Every move gets x = { t (the node that moves), el?, rect {x,y,w,h} on the screen, root (the layout), color,
 *   delay (ms), dur (ms), anim(node, keyframes, options), later(fn, ms), spark(...), ring(...), dir (+1 / -1: toward the middle), done? }
 */
(function () {
  'use strict';
  const F = window.SBFX; if (!F || F.INS.fly) return;
  const { mix, rgba, rng, range, esc, NS } = F;
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  const E = { out: 'cubic-bezier(.2,.8,.3,1)', snap: 'cubic-bezier(.5,0,.1,1)', bounce: 'cubic-bezier(.3,1.6,.5,1)', in: 'cubic-bezier(.6,0,.8,.3)', soft: 'ease-in-out' };

  // ---------------------------------------------------------------- helpers
  // a temporary layer on top of everything, placed on the screen where the piece is
  // 1.12.13: BeeboScore's own little pictures for the moves that put an object on screen (they were stock emojis)
  const ART = {
    fist: '<svg viewBox="0 0 100 80" width="1.25em" height="1em" aria-hidden="true"><defs><linearGradient id="bfF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a6"/><stop offset="1" stop-color="#d9965a"/></linearGradient></defs><path d="M6 30 Q6 18 18 18 L34 18 L34 62 L18 62 Q6 62 6 50Z" fill="#2b2f3a"/><rect x="30" y="10" width="62" height="60" rx="16" fill="url(#bfF)" stroke="#5a3415" stroke-width="3"/><path d="M58 12v22M74 12v22M44 12v22" stroke="#5a3415" stroke-width="3" stroke-linecap="round"/><path d="M34 52 Q52 40 70 50" fill="none" stroke="#5a3415" stroke-width="4" stroke-linecap="round"/></svg>',
    plane: '<svg viewBox="0 0 100 60" width="1.6em" height="1em" aria-hidden="true"><path d="M4 30 L96 4 L60 56 L48 36Z" fill="#eef1f7" stroke="#8b93a7" stroke-width="2" stroke-linejoin="round"/><path d="M96 4 L48 36 L44 54 L60 56" fill="#c7cdda" stroke="#8b93a7" stroke-width="2" stroke-linejoin="round"/></svg>',
    bee: '<svg viewBox="0 0 100 80" width="1.25em" height="1em" aria-hidden="true"><ellipse cx="38" cy="18" rx="18" ry="13" fill="rgba(220,240,255,.85)" stroke="#5d6579" stroke-width="2"/><ellipse cx="62" cy="16" rx="16" ry="12" fill="rgba(220,240,255,.85)" stroke="#5d6579" stroke-width="2"/><ellipse cx="50" cy="48" rx="34" ry="24" fill="#f6c453" stroke="#141006" stroke-width="3"/><path d="M38 26 Q32 48 38 70M54 24 Q48 48 54 72M70 30 Q66 48 70 66" stroke="#141006" stroke-width="7" fill="none"/><circle cx="82" cy="42" r="4" fill="#141006"/><path d="M14 50 L2 54" stroke="#141006" stroke-width="4" stroke-linecap="round"/></svg>',
    medal: '<svg viewBox="0 0 80 100" width=".8em" height="1em" aria-hidden="true"><path d="M18 0 L40 40 L62 0 L48 0 L40 18 L32 0Z" fill="#e8202e"/><path d="M32 0 L40 18 L48 0Z" fill="#3b8eff"/><circle cx="40" cy="64" r="30" fill="#f6c453" stroke="#9a6510" stroke-width="4"/><circle cx="40" cy="64" r="20" fill="none" stroke="#fff3cc" stroke-width="3" opacity=".8"/><path d="M40 50 L44 60 L54 61 L46 67 L49 77 L40 71 L31 77 L34 67 L26 61 L36 60Z" fill="#fff3cc"/></svg>',
    crown: '<svg viewBox="0 0 100 70" width="1.4em" height="1em" aria-hidden="true"><path d="M8 60 L4 18 L28 38 L50 6 L72 38 L96 18 L92 60Z" fill="#f6c453" stroke="#9a6510" stroke-width="4" stroke-linejoin="round"/><rect x="8" y="56" width="84" height="10" rx="3" fill="#e0a93b" stroke="#9a6510" stroke-width="3"/><circle cx="50" cy="40" r="6" fill="#e8202e"/><circle cx="28" cy="46" r="4" fill="#3b8eff"/><circle cx="72" cy="46" r="4" fill="#3b8eff"/></svg>',
  };
  function ov(x, html, css = '', life = 1600, cls = '') {
    const d = document.createElement('div'); d.className = 'fxov ' + cls; const R = x.rect;
    d.style.cssText = `left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px;--h:${R.h}px;--c:${x.color};--c2:${mix(x.color, '#ffffff', .5)};--c3:${mix(x.color, '#000000', .5)};${css}`;
    d.innerHTML = html || ''; x.root.appendChild(d);
    setTimeout(() => d.remove(), life + (x.delay || 0)); return d;
  }
  const A = (x, node, k, o = {}) => x.anim(node, k, { duration: x.dur || 600, delay: x.delay || 0, easing: E.out, fill: 'backwards', ...o });
  // the piece cut into strips (copies), each moving on its own; the real one shows again at the end
  function slices(x, n, axis, frames, o = {}) {
    const t = x.t, host = t.parentNode; if (!host) return;
    const wrap = document.createElement('div'); wrap.className = 'fxslices'; wrap.style.cssText = `position:absolute;left:${t.offsetLeft}px;top:${t.offsetTop}px;width:${t.offsetWidth || x.rect.w}px;height:${t.offsetHeight || x.rect.h}px;pointer-events:none;perspective:900px`;
    const order = o.order || range(n, i => i), dur = x.dur || 600, step = o.step ?? dur * .5 / n;
    for (let i = 0; i < n; i++) {
      const a = (i / n * 100).toFixed(3), b = (100 - (i + 1) / n * 100).toFixed(3);
      const s = document.createElement('div'); s.style.cssText = `position:absolute;inset:0;clip-path:${axis === 'x' ? `inset(0 ${b}% 0 ${a}%)` : `inset(${a}% 0 ${b}% 0)`};transform-origin:${o.origin ? o.origin(i, n) : axis === 'x' ? `${((i + .5) / n * 100).toFixed(1)}% 50%` : `50% ${((i + .5) / n * 100).toFixed(1)}%`}`;
      const c = t.cloneNode(true); c.style.position = 'absolute'; c.style.inset = '0'; c.style.left = '0'; c.style.top = '0'; c.classList.remove('sd-hidden'); c.getAnimations && 0; s.appendChild(c); wrap.appendChild(s);
      x.anim(s, frames(i, n), { duration: dur, delay: (x.delay || 0) + order.indexOf(i) * step, easing: o.ease || E.out, fill: 'both' });
    }
    host.insertBefore(wrap, t.nextSibling);
    const total = (x.delay || 0) + dur + n * step;
    if (o.out) { t.style.visibility = 'hidden'; setTimeout(() => { wrap.remove(); x.done && x.done(); t.style.visibility = ''; }, total + 30); }
    else { x.anim(t, [{ opacity: 0 }, { opacity: 0 }], { duration: total, fill: 'backwards' }); setTimeout(() => wrap.remove(), total + 30); }
  }
  const later = (x, fn, ms) => x.later(fn, (x.delay || 0) + ms);
  const mid = x => [x.rect.x + x.rect.w / 2, x.rect.y + x.rect.h / 2];

  // ================================================================== 1.12.15: your own motion
  // Keyframed moves (el.enter / el.exit = { type: 'keys', keys: [{ t, x, y, s, r, o, e }] }) and moves along a path
  // ({ type: 'path', path: 'arcleft' | … | 'custom', d, turn }). Keys are seconds from the start; x / y in px from where the
  // piece rests, s scale, r degrees, o opacity, e how it eases into that key. An entrance always ends at rest, an exit
  // always starts there.
  const KEASE = { ease: 'ease', in: 'cubic-bezier(.55,0,1,.45)', out: 'cubic-bezier(0,.55,.45,1)', inout: 'cubic-bezier(.65,0,.35,1)', linear: 'linear', back: 'cubic-bezier(.34,1.56,.64,1)', step: 'steps(1, jump-end)' };
  const LIN_OK = (() => { try { return CSS.supports('animation-timing-function', 'linear(0, 0.5 50%, 1)'); } catch (e) { return false; } })();
  const springCss = feel => { const M = window.SBMotion; if (!M || !LIN_OK) return KEASE.back; const S = M.spring(feel), n = S.x.length, step = Math.max(1, Math.floor(n / 48)), pts = [];
    for (let i = 0; i < n; i += step) pts.push(`${S.x[i].toFixed(4)} ${(i / (n - 1) * 100).toFixed(2)}%`); pts.push('1 100%'); return `linear(${pts.join(', ')})`; };
  const easeOf = e => e === 'spring' ? springCss('snappy') : e === 'springsoft' ? springCss('floaty') : e === 'heavy' ? springCss('heavy') : KEASE[e] || KEASE.ease;
  const REST = { x: 0, y: 0, s: 1, r: 0, o: 1 };
  const pose = k => ({ x: Number(k.x) || 0, y: Number(k.y) || 0, s: k.s == null ? 1 : Number(k.s), r: Number(k.r) || 0, o: k.o == null ? 1 : Math.max(0, Math.min(1, Number(k.o))) });
  const isRest = k => { const p = pose(k); return !p.x && !p.y && p.s === 1 && !p.r && p.o === 1; };
  function keysOf(m, dir) {
    let ks = (Array.isArray(m && m.keys) ? m.keys : []).filter(k => k && Number.isFinite(Number(k.t))).map(k => ({ ...k, t: Math.max(0, Number(k.t)) })).sort((a, b) => a.t - b.t);
    if (!ks.length) ks = dir === 'out' ? [{ t: 0 }, { t: .5, y: 40, o: 0, e: 'in' }] : [{ t: 0, y: 40, o: 0 }, { t: .6, e: 'spring' }];
    if (dir === 'out') { if (!isRest(ks[0]) || ks[0].t > 0) ks.unshift({ ...REST, t: 0 }); }
    else { if (ks[0].t > 0) ks.unshift({ ...pose(ks[0]), t: 0 }); if (!isRest(ks[ks.length - 1])) ks.push({ ...REST, t: ks[ks.length - 1].t + .4, e: 'spring' }); }
    const dur = Math.max(.05, ks[ks.length - 1].t);
    // WAAPI eases the stretch after a keyframe, so each key's ease goes on the keyframe before it
    const frames = ks.map((k, i) => { const p = pose(k), f = { offset: Math.min(1, k.t / dur), transform: `translate(${p.x}px,${p.y}px) rotate(${p.r}deg) scale(${p.s})`, opacity: p.o }; const nx = ks[i + 1]; if (nx) f.easing = easeOf(nx.e); return f; });
    return { frames, dur };
  }
  // paths end where the piece rests (0, 0); px from there
  const PATHS = {
    arcleft: { label: 'Arc in from the left', d: 'M-620,-220 Q-320,-440 0,0' },
    arcright: { label: 'Arc in from the right', d: 'M620,-220 Q320,-440 0,0' },
    swoop: { label: 'Swoop up from below', d: 'M-520,320 C-320,-220 -110,220 0,0' },
    loop: { label: 'Loop the loop', d: 'M-420,40 C-180,-260 120,-250 20,-120 C-80,10 -60,50 0,0' },
    zigzag: { label: 'Zigzag', d: 'M-480,0 L-360,-70 L-240,50 L-120,-40 L0,0' },
    drop: { label: 'Drop and swing', d: 'M0,-520 C0,-200 60,-40 0,0' },
    spiral: { label: 'Spiral in', d: 'M260,0 C260,-180 -180,-200 -190,0 C-200,140 120,130 110,0 C100,-70 -40,-60 -30,0 C-25,25 -5,10 0,0' },
  };
  function pathFrames(m, dir, n = 48) {
    const d = m && m.path === 'custom' && m.d ? String(m.d) : (PATHS[m && m.path] || PATHS.arcleft).d;
    const svg = document.createElementNS(NS, 'svg'), pe = document.createElementNS(NS, 'path'); pe.setAttribute('d', d); svg.appendChild(pe); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; document.body.appendChild(svg);
    let L = 0; try { L = pe.getTotalLength(); } catch (e) {}
    const pts = []; for (let i = 0; i <= n; i++) { let q = { x: 0, y: 0 }; try { q = pe.getPointAtLength(L * i / n); } catch (e) {} pts.push([q.x, q.y]); }
    svg.remove();
    const end = pts[pts.length - 1]; for (const p of pts) { p[0] -= end[0]; p[1] -= end[1]; }       // whatever the path, it ends at rest
    const turn = !!(m && m.turn), frames = pts.map((p, i) => { const nx = pts[Math.min(n, i + 1)], pv = pts[Math.max(0, i - 1)], a = Math.atan2(nx[1] - pv[1], nx[0] - pv[0]) * 180 / Math.PI;
      const ang = turn && i < n ? a : 0; return { offset: i / n, transform: `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`, opacity: Math.min(1, .15 + i / n * 2.5) }; });
    frames[frames.length - 1].transform = 'none'; frames[frames.length - 1].opacity = 1;
    return dir === 'out' ? frames.slice().reverse().map((f, i, a) => ({ ...f, offset: i / (a.length - 1) })) : frames;
  }
  F.keysOf = keysOf; F.PATHS = PATHS; F.KEASE = KEASE;
  F.moveDurOf = m => m && m.type === 'keys' ? keysOf(m, 'in').dur : m && m.type === 'path' ? (Number(m.dur) || 1.1) : 0;

  // ================================================================== ENTRANCES
  const IN = F.INS;
  const inn = (id, label, emoji, cat, play, tip, dur = 650) => { IN[id] = { label, emoji, cat, play, tip, dur, fx: true }; };
  // ----- player bar
  inn('press', 'Hydraulic press', '🗜️', 'Player bar', x => {
    A(x, x.t, [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1.08)', offset: .7 }, { transform: 'scaleY(1)' }], { easing: E.snap });
    ov(x, '<i class="pl t"></i><i class="pl b"></i>', '', x.dur + 500, 'fx-press');
  }, 'Top and bottom plates press the piece into shape.');
  inn('rope', 'Rope pull', '🪢', 'Player bar', x => {
    const d = x.dir || 1; A(x, x.t, [{ transform: `translateX(${-d * (x.rect.w + 260)}px)` }, { transform: `translateX(${d * 18}px)`, offset: .8 }, { transform: 'none' }], { easing: E.snap, duration: x.dur * 1.1 });
    ov(x, '<i></i>', `--d:${d}`, x.dur + 900, 'fx-rope');
  }, 'A rope drags the piece on-screen, then snaps away.', 800);
  inn('tiles', 'Tile flip', '🀄', 'Player bar', x => slices(x, 8, 'x', () => [{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'rotateY(0)', opacity: 1 }], { order: [3, 5, 1, 7, 0, 4, 2, 6] }), 'The piece is made of tiles that flip over one by one.', 520);
  inn('fold', 'Fold out', '📄', 'Player bar', x => A(x, x.t, [{ transform: `perspective(900px) rotateY(${(x.dir || 1) * 95}deg)`, transformOrigin: x.dir < 0 ? '0 50%' : '100% 50%', opacity: 0 }, { transform: 'perspective(900px) rotateY(0)', transformOrigin: x.dir < 0 ? '0 50%' : '100% 50%', opacity: 1 }]), 'Unfolds like paper from its inner edge.');
  inn('zip', 'Zip open', '🤐', 'Player bar', x => {
    A(x, x.t, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], { easing: E.soft });
    ov(x, '<i></i><i></i>', '', x.dur + 300, 'fx-zip');
  }, 'Opens from the centre like a zipper.');
  inn('weld', 'Weld seam', '🧑‍🏭', 'Player bar', x => {
    A(x, x.t, [{ clipPath: 'inset(0 100% 0 0)', filter: 'brightness(2.4)' }, { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1.6)', offset: .85 }, { clipPath: 'inset(0 0 0 0)', filter: 'none' }], { easing: 'linear', duration: x.dur * 1.4 });
    for (let i = 0; i <= 8; i++) later(x, () => x.spark(x.rect.x + x.rect.w * i / 8, x.rect.y + x.rect.h * .5, 6, .45, '#ffd28a'), x.dur * 1.4 * i / 8);
  }, 'A welding spark runs along the edge and it glows into place.', 700);
  inn('blueprint', 'Blueprint to real', '📐', 'Player bar', x => {
    A(x, x.t, [{ filter: 'grayscale(1) sepia(1) hue-rotate(170deg) saturate(5) brightness(.9) contrast(1.6)', opacity: .7 }, { filter: 'grayscale(1) sepia(1) hue-rotate(170deg) saturate(5) brightness(.9) contrast(1.6)', opacity: .8, offset: .5 }, { filter: 'none', opacity: 1 }], { duration: x.dur * 2 });
    ov(x, '', '', x.dur * 1.4, 'fx-blueprint');
  }, 'A blue wireframe fills in with the real look.', 650);
  inn('blinds', 'Venetian blinds', '🪟', 'Player bar', x => slices(x, 7, 'y', () => [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { step: 0 }), 'Horizontal slats rotate open.', 520);
  inn('flicker', 'Flicker on', '💡', 'Player bar', x => A(x, x.t, [0, 1, 0, 1, .2, 1, .5, 1].map((o, i, a) => ({ opacity: o, offset: i / (a.length - 1), filter: o === 1 ? 'brightness(1.4)' : 'none' })), { easing: 'steps(1,end)', duration: x.dur * 1.3 }), 'Blinks on like a neon sign.');
  inn('mosaic', 'Mosaic resolve', '🧩', 'Player bar', x => A(x, x.t, [{ filter: 'blur(14px) contrast(4) saturate(1.6)', opacity: .3 }, { filter: 'blur(0) contrast(1)', opacity: 1 }], { easing: 'steps(6,end)' }), 'A blocky low-res version sharpens into full detail.');
  inn('rise', 'Rise from water', '🌊', 'Player bar', x => {
    A(x, x.t, [{ transform: 'translateY(100%)', clipPath: 'inset(0 0 100% 0)' }, { transform: 'translateY(-4%)', clipPath: 'inset(0 0 -4% 0)', offset: .8 }, { transform: 'none', clipPath: 'inset(0 0 0 0)' }], { easing: E.out, duration: x.dur * 1.3 });
    ov(x, '<i></i><i></i>', '', x.dur * 2, 'fx-ripple');
  }, 'Lifts out of a rippling surface with drips.', 650);
  inn('spinflip', 'Spin flip', '🔄', 'Player bar', x => A(x, x.t, [{ transform: 'perspective(800px) rotateX(-90deg)', opacity: 0 }, { transform: 'perspective(800px) rotateX(12deg)', opacity: 1, offset: .7 }, { transform: 'none' }]), 'Flips in on its horizontal axis.');
  inn('deal', 'Card deal', '🃏', 'Player bar', x => A(x, x.t, [{ transform: `translate(${-(x.dir || 1) * 520}px, 260px) rotate(${-(x.dir || 1) * 28}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { easing: E.snap }), 'Slides in like a card being dealt.');
  inn('curtaindrop', 'Curtain drop', '🎌', 'Player bar', x => A(x, x.t, [{ clipPath: 'inset(0 0 100% 0)', transform: 'scaleY(.9)', transformOrigin: '50% 0' }, { clipPath: 'inset(0 0 0 0)', transform: 'scaleY(1.04)', transformOrigin: '50% 0', offset: .75 }, { clipPath: 'inset(0 0 0 0)', transform: 'none', transformOrigin: '50% 0' }]), 'Unrolls downward like a banner.');
  inn('portal', 'Portal open', '🌀', 'Player bar', x => {
    A(x, x.t, [{ clipPath: 'circle(0% at 50% 50%)', transform: 'scale(.6) rotate(-20deg)' }, { clipPath: 'circle(75% at 50% 50%)', transform: 'none' }], { delay: (x.delay || 0) + 180 });
    ov(x, '<i></i>', '', x.dur + 500, 'fx-portal');
  }, 'A glowing ring opens and the piece comes out of it.');
  inn('smoke', 'Smoke burst in', '💨', 'Player bar', x => {
    A(x, x.t, [{ opacity: 0, filter: 'blur(14px)', transform: 'scale(1.05)' }, { opacity: 1, filter: 'none', transform: 'none' }], { duration: x.dur * 1.2 });
    ov(x, range(8, i => `<i style="left:${(i * 13) % 100}%;animation-delay:${i * 40}ms"></i>`).join(''), '', x.dur * 2.2, 'fx-smokeburst');
  }, 'A puff of smoke clears to show it.');
  inn('bolt', 'Lightning strike in', '⚡', 'Player bar', x => {
    A(x, x.t, [{ opacity: 0 }, { opacity: 1, filter: 'brightness(4) saturate(0)', offset: .08 }, { opacity: .2, offset: .16 }, { opacity: 1, filter: 'brightness(2)', offset: .24 }, { opacity: 1, filter: 'none' }], { easing: 'linear' });
    ov(x, `<svg viewBox="0 0 100 300" preserveAspectRatio="none"><path d="M60 0L38 120L58 124L30 300"/></svg>`, '', x.dur, 'fx-boltov');
  }, 'A bolt hits and it appears in the flash.');
  inn('pour', 'Liquid pour', '🫗', 'Player bar', x => A(x, x.t, [{ clipPath: 'polygon(0 100%,0 100%,0 100%,0 100%)' }, { clipPath: 'polygon(0 30%,60% 0,100% 60%,0 100%)', offset: .5 }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }], { duration: x.dur * 1.4, easing: E.soft }), 'Fills up like liquid poured from one end.');
  inn('pixels', 'Pixel build', '👾', 'Player bar', x => slices(x, 10, 'x', i => [{ transform: `translateY(${(i % 2 ? 1 : -1) * 40}px) scale(.2)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { order: [4, 9, 1, 6, 3, 8, 0, 5, 2, 7], ease: 'steps(4,end)' }), 'Assembles from blocky pixels.', 420);
  inn('ink', 'Ink spread', '🖋️', 'Player bar', x => A(x, x.t, [{ clipPath: 'circle(0% at 30% 60%)', filter: 'url(#fxf-rough) contrast(1.4)' }, { clipPath: 'circle(90% at 50% 50%)', filter: 'url(#fxf-rough)', offset: .85 }, { clipPath: 'circle(90% at 50% 50%)', filter: 'none' }], { duration: x.dur * 1.4 }), 'Ink bleeds out to form the shape.');
  inn('pendulum', 'Pendulum swing', '🕰️', 'Player bar', x => A(x, x.t, [{ transform: 'rotate(-75deg)', transformOrigin: '0 0', opacity: 0 }, { transform: 'rotate(14deg)', transformOrigin: '0 0', opacity: 1, offset: .45 }, { transform: 'rotate(-6deg)', transformOrigin: '0 0', offset: .7 }, { transform: 'rotate(2deg)', transformOrigin: '0 0', offset: .87 }, { transform: 'none', transformOrigin: '0 0' }], { duration: x.dur * 1.8, easing: 'ease-out' }), 'Swings in from a top corner and settles.');
  inn('domino', 'Domino tiles', '🁢', 'Player bar', x => slices(x, 9, 'x', () => [{ transform: 'rotateX(-95deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { origin: () => '50% 100%' }), 'The segments tip over in a row to reveal it.', 420);
  inn('dust', 'Dust off', '🧹', 'Player bar', x => { A(x, x.t, [{ opacity: 0, filter: 'sepia(1) brightness(.6)' }, { opacity: 1, filter: 'none' }]); ov(x, range(10, i => `<i style="left:${i * 10}%;animation-delay:${i * 30}ms"></i>`).join(''), '', x.dur * 2, 'fx-dust'); }, 'Dust blows off as it appears.');
  inn('ribbon', 'Ribbon wrap', '🎀', 'Player bar', x => { A(x, x.t, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }]); ov(x, '<i></i>', '', x.dur + 700, 'fx-ribbon'); }, 'A ribbon wraps around and pulls tight.', 700);
  // ----- VS splash & screens
  inn('elevator', 'Elevator rise', '🛗', 'VS & screens', x => { A(x, x.t, [{ transform: 'translateY(110%)' }, { transform: 'translateY(-2%)', offset: .85 }, { transform: 'none' }], { easing: E.soft, duration: x.dur * 1.4 }); ov(x, '<i></i>', '', x.dur * 1.6, 'fx-platform'); }, 'Rises up on a platform from below.', 700);
  inn('train', 'Train pass', '🚄', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { easing: 'linear' }); ov(x, '<i></i>', '', x.dur + 200, 'fx-train'); }, 'A blur rushes past and leaves it behind.');
  inn('forge', 'Forge', '⚒️', 'VS & screens', x => { A(x, x.t, [{ transform: 'scale(1.4)', filter: 'brightness(3) sepia(1) saturate(4) hue-rotate(-20deg)', opacity: 0 }, { transform: 'scale(.96)', opacity: 1, offset: .3 }, { transform: 'scale(1.02)', offset: .5 }, { transform: 'scale(.99)', offset: .7 }, { transform: 'none', filter: 'none' }], { duration: x.dur * 1.6 }); for (let i = 0; i < 3; i++) later(x, () => { const [cx, cy] = mid(x); x.spark(cx, cy, 22, .9, '#ffb36b'); }, i * x.dur * .45 + 180); }, 'Hammered on an anvil with sparks.', 700);
  inn('chisel', 'Chisel', '🪨', 'VS & screens', x => { A(x, x.t, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { easing: 'steps(10,end)', duration: x.dur * 1.6 }); for (let i = 0; i < 10; i++) later(x, () => x.spark(x.rect.x + x.rect.w * i / 10, x.rect.y + x.rect.h * .6, 5, .4, '#c9c4b8'), x.dur * 1.6 * i / 10); }, 'Chipped into stone, bit by bit.', 650);
  inn('dolly', 'Dolly zoom', '🎥', 'VS & screens', x => A(x, x.t, [{ transform: 'scale(1.35)', filter: 'blur(3px)', opacity: 0 }, { transform: 'scale(1.06)', filter: 'none', opacity: 1, offset: .5 }, { transform: 'none' }], { duration: x.dur * 1.8, easing: E.soft }), 'The background stretches while the players hold still.', 800);
  inn('strobe', 'Strobe cut', '📸', 'VS & screens', x => A(x, x.t, range(9, i => ({ offset: i / 8, opacity: i === 8 ? 1 : i % 2, filter: i % 2 && i < 8 ? 'brightness(2.4) contrast(1.5)' : 'none', transform: i < 8 ? `translateX(${(i % 4 - 1.5) * 8}px)` : 'none' })), { easing: 'steps(1,end)', duration: x.dur * 1.2 }), 'Quick strobe cuts before it settles.');
  inn('sketch', 'Storyboard sketch', '✏️', 'VS & screens', x => { A(x, x.t, [{ filter: 'grayscale(1) contrast(2.4) brightness(1.5) url(#fxf-rough)', opacity: .9 }, { filter: 'grayscale(1) contrast(2.4) brightness(1.5) url(#fxf-rough)', offset: .55 }, { filter: 'none', opacity: 1 }], { duration: x.dur * 2.2 }); ov(x, '', '', x.dur * 1.3, 'fx-sketch'); }, 'Pencil sketches turn into the final look.', 650);
  inn('chess', 'Chess move', '♟️', 'VS & screens', x => A(x, x.t, [{ transform: 'translateY(-60px) scale(1.12)', opacity: 0, filter: 'drop-shadow(0 50px 18px rgba(0,0,0,.6))' }, { transform: 'translateY(-60px) scale(1.12)', opacity: 1, offset: .35 }, { transform: 'none', filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' }], { easing: E.snap, duration: x.dur * 1.3 }), 'Lifted and placed like a chess piece.');
  inn('kaleido', 'Kaleidoscope in', '🔮', 'VS & screens', x => A(x, x.t, [{ transform: 'rotate(200deg) scale(.15)', filter: 'hue-rotate(180deg) saturate(3)', clipPath: 'circle(10% at 50% 50%)', opacity: 0 }, { transform: 'none', filter: 'none', clipPath: 'circle(100% at 50% 50%)', opacity: 1 }], { duration: x.dur * 1.4 }), 'Spins together out of a kaleidoscope pattern.');
  // 1.12.14: a pane of glass takes a hit — a white flash and a ring where it's struck, the screen jolts, and the cracks run
  // out from that point to the edges. Where it's struck: the piece's enter.at, in % of the piece ([50, 50] if not set).
  inn('crackspread', 'Glass impact', '🪟', 'VS & screens', x => {
    const at = (x.el && x.el.enter && Array.isArray(x.el.enter.at) && x.el.enter.at) || [50, 50], R = x.rect;
    const px = R.w * at[0] / 100, py = R.h * at[1] / 100, far = Math.hypot(Math.max(px, R.w - px), Math.max(py, R.h - py)), at$ = `at ${px.toFixed(0)}px ${py.toFixed(0)}px`;
    A(x, x.t, [{ clipPath: `circle(0px ${at$})`, filter: 'brightness(2.6)' }, { clipPath: `circle(${(far * .42).toFixed(0)}px ${at$})`, filter: 'brightness(1.8)', offset: .22 }, { clipPath: `circle(${(far * 1.02).toFixed(0)}px ${at$})`, filter: 'none' }], { easing: 'cubic-bezier(.1,.75,.3,1)' });
    if (POTATO()) return;
    ov(x, '<b></b><i></i><i></i><u></u>', `--px:${px.toFixed(0)}px;--py:${py.toFixed(0)}px`, x.dur + 900, 'fx-impact');
    const sc = x.t.closest && x.t.closest('.sd-scene');
    if (sc && !(x.el && x.el.enter && x.el.enter.shake === false)) x.anim(sc, [{ transform: 'none' }, { transform: 'translate(7px,-5px)', offset: .12 }, { transform: 'translate(-6px,4px)', offset: .28 }, { transform: 'translate(4px,2px)', offset: .46 }, { transform: 'translate(-2px,-1px)', offset: .66 }, { transform: 'none' }], { duration: 300, delay: x.delay || 0, easing: 'ease-out' });
  }, 'The glass takes a hit: a flash where it’s struck, the screen jolts and cracks run out from that point. Set where in the piece it’s struck.', 560);
  inn('keys', 'Keyframed (your own)', '🎞️', 'Your own', x => { const K = keysOf(x.el && x.el.enter, 'in'); A(x, x.t, K.frames, { duration: K.dur * 1000 / (x.speed || 1), easing: 'linear' }); },
    'Your own move: set where the piece is at each moment on the timeline (position, size, turn, see-through) and how it eases between them.', 1000);
  inn('path', 'Along a path', '〰️', 'Your own', x => { const m = (x.el && x.el.enter) || {}; A(x, x.t, pathFrames(m, 'in'), { duration: (Number(m.dur) || 1.1) * 1000, easing: easeOf(m.ease || 'inout') }); },
    'The piece travels to its place along a curve: an arc, a swoop, a loop, a zigzag, a spiral, or a path of your own.', 1100);
  inn('iris', 'Iris open', '⭕', 'VS & screens', x => A(x, x.t, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)' }], { easing: E.soft }), 'A circle opens from the centre.');
  inn('curtains', 'Curtain open', '🎭', 'VS & screens', x => { A(x, x.t, [{ opacity: 1 }, { opacity: 1 }], { duration: 10 }); ov(x, '<i class="l"></i><i class="r"></i>', '', x.dur * 1.5, 'fx-curtains'); }, 'Stage curtains part to show it.', 900);
  inn('doors', 'Door slam open', '🚪', 'VS & screens', x => { ov(x, '<i class="l"></i><i class="r"></i>', '', x.dur * 1.4, 'fx-doors'); }, 'Metal doors slide apart.', 800);
  inn('pageturn', 'Page turn', '📖', 'VS & screens', x => A(x, x.t, [{ transform: 'perspective(1600px) rotateY(-110deg)', transformOrigin: '0 50%', filter: 'brightness(.4)' }, { transform: 'perspective(1600px) rotateY(0)', transformOrigin: '0 50%', filter: 'none' }], { easing: E.soft, duration: x.dur * 1.3 }), 'Turns in like a comic page.');
  inn('paint', 'Paint stroke reveal', '🖌️', 'VS & screens', x => A(x, x.t, [{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)', filter: 'url(#fxf-rough)' }, { clipPath: 'polygon(0 0,115% 0,100% 100%,-15% 100%)', filter: 'url(#fxf-rough)', offset: .9 }, { clipPath: 'polygon(0 0,115% 0,100% 100%,-15% 100%)', filter: 'none' }], { duration: x.dur * 1.3, easing: E.soft }), 'A brush stroke paints it in.');
  inn('rewind', 'Rewind in', '⏪', 'VS & screens', x => A(x, x.t, range(8, i => ({ offset: i / 7, transform: i === 7 ? 'none' : `translateX(${(7 - i) * 22}px) skewX(${i % 2 ? 6 : -6}deg)`, filter: i === 7 ? 'none' : 'saturate(.4) contrast(1.4) hue-rotate(20deg)', opacity: i === 0 ? 0 : 1 })), { easing: 'steps(1,end)', duration: x.dur * 1.1 }), 'Plays like a tape rewinding into place.');
  inn('cube', 'Rotating cube', '🧊', 'VS & screens', x => A(x, x.t, [{ transform: 'perspective(1400px) translateZ(-300px) rotateY(90deg)', transformOrigin: '100% 50%' }, { transform: 'perspective(1400px) rotateY(0)', transformOrigin: '100% 50%' }], { easing: E.soft }), 'Rotates in like the side of a cube.');
  inn('cardflip', 'Card flip', '🎴', 'VS & screens', x => A(x, x.t, [{ transform: 'perspective(1400px) rotateY(180deg)', opacity: 0 }, { transform: 'perspective(1400px) rotateY(90deg)', opacity: 0, offset: .5 }, { transform: 'perspective(1400px) rotateY(90deg)', opacity: 1, offset: .51 }, { transform: 'none', opacity: 1 }], { easing: 'linear' }), 'Flips over like a card.');
  inn('countdown', 'Countdown 3-2-1', '3️⃣', 'VS & screens', x => { const d0 = x.delay || 0; x.delay = d0 + 2100; A(x, x.t, [{ opacity: 0, transform: 'scale(1.2)' }, { opacity: 1, transform: 'none' }]); x.delay = d0; ov(x, '<b>3</b><b>2</b><b>1</b>', '', 2400, 'fx-count'); }, 'Numbers slam in before it shows.', 600);
  inn('fight', 'Fight! stamp', '🥊', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); ov(x, '<b>FIGHT!</b>', '', 1900, 'fx-stamp'); }, 'A big FIGHT! stamp at the end.', 300);
  inn('ignite2', 'Aura ignite', '🔥', 'VS & screens', x => A(x, x.t, [{ opacity: 0, filter: `drop-shadow(0 0 0 ${x.color})` }, { opacity: 1, filter: `drop-shadow(0 0 40px ${x.color}) brightness(1.6)`, offset: .4 }, { filter: `drop-shadow(0 0 0 ${x.color})` }], { duration: x.dur * 1.5 }), 'An aura lights up around it on cue.');
  inn('clash', 'Energy clash', '💥', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1, filter: 'brightness(2.5)', offset: .62 }, { opacity: 1, filter: 'none' }], { duration: x.dur * 1.6, easing: 'linear' }); ov(x, '<i class="l"></i><i class="r"></i><b></b>', '', x.dur * 1.8, 'fx-clash'); }, 'Two beams meet in the middle and push against each other.', 700);
  inn('silhouette', 'Silhouette fill', '👤', 'VS & screens', x => A(x, x.t, [{ filter: 'brightness(0)', opacity: 0 }, { filter: 'brightness(0)', opacity: 1, offset: .4 }, { filter: 'brightness(3) saturate(0)', offset: .55 }, { filter: 'none' }], { duration: x.dur * 1.6 }), 'A dark silhouette flashes into full colour.');
  inn('push', 'Portrait push in', '🔎', 'VS & screens', x => A(x, x.t, [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: x.dur * 2.4, easing: 'cubic-bezier(.1,.6,.2,1)' }), 'Zooms in from close up.', 700);
  inn('panup', 'Portrait pan', '🎞️', 'VS & screens', x => A(x, x.t, [{ transform: 'translateY(9%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: x.dur * 3, easing: E.soft }), 'Slowly pans upward like a film shot.', 700);
  inn('freeze', 'Freeze frame', '⏸️', 'VS & screens', x => A(x, x.t, [{ transform: 'translateX(-80px)', opacity: 0 }, { transform: 'translateX(-10px)', opacity: 1, filter: 'contrast(1.5) brightness(1.4) saturate(0)', offset: .3 }, { transform: 'translateX(-10px)', filter: 'contrast(1.5) brightness(1.4) saturate(0)', offset: .7 }, { transform: 'none', filter: 'none' }], { duration: x.dur * 2 }), 'Freezes for a beat, then plays on.');
  inn('stamp', 'VS stamp', '🔨', 'VS & screens', x => { A(x, x.t, [{ transform: 'scale(3) rotate(-10deg)', opacity: 0 }, { transform: 'scale(.94) rotate(0)', opacity: 1, offset: .5 }, { transform: 'none' }], { easing: E.snap }); later(x, () => { const [cx, cy] = mid(x); x.ring(cx, cy, Math.max(x.rect.w, x.rect.h) * 1.6, x.color); }, x.dur * .45); }, 'Stamps down with a shockwave.');
  inn('strike', 'Lightning strike', '🌩️', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1, filter: 'brightness(5) saturate(0)', offset: .34 }, { opacity: 1, filter: 'none' }], { easing: 'linear', duration: x.dur * 1.3 }); later(x, () => ov(x, `<svg viewBox="0 0 100 300" preserveAspectRatio="none"><path d="M54 -20L40 100L62 104L36 320"/></svg>`, '', 500, 'fx-boltov'), x.dur * .35); }, 'A bolt hits the centre and it appears.');
  inn('spinin', 'Spin in', '🌪️', 'VS & screens', x => A(x, x.t, [{ transform: 'scale(0) rotate(-720deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { easing: E.snap, duration: x.dur * 1.3 }), 'Spins in from far away.');
  inn('fireburst', 'Fire burst', '☄️', 'VS & screens', x => { A(x, x.t, [{ transform: 'scale(.4)', filter: 'brightness(4) sepia(1) saturate(6) hue-rotate(-25deg) blur(6px)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .5 }, { transform: 'none', filter: 'none' }]); later(x, () => { const [cx, cy] = mid(x); x.spark(cx, cy, 50, 1.2, '#ff7a1f'); }, 120); }, 'Bursts out of a fireball.');
  inn('bannerdrop', 'Banner drop', '🎏', 'VS & screens', x => A(x, x.t, [{ transform: 'translateY(-130%) rotate(0)', transformOrigin: '50% 0' }, { transform: 'translateY(0) rotate(5deg)', transformOrigin: '50% 0', offset: .45 }, { transform: 'rotate(-3deg)', transformOrigin: '50% 0', offset: .7 }, { transform: 'rotate(1deg)', transformOrigin: '50% 0', offset: .87 }, { transform: 'none', transformOrigin: '50% 0' }], { duration: x.dur * 2 }), 'Falls from above and swings.');
  inn('flashes', 'Crowd roar burst', '📷', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); ov(x, range(14, i => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;animation-delay:${i * 60}ms"></i>`).join(''), '', 1600, 'fx-flashes'); }, 'Camera flashes burst all at once.', 300);
  inn('spotsearch', 'Spotlight search', '🔦', 'VS & screens', x => { A(x, x.t, [{ filter: 'brightness(.05)' }, { filter: 'brightness(.05)', offset: .7 }, { filter: 'brightness(1.3)', offset: .8 }, { filter: 'none' }], { duration: x.dur * 2.2, easing: 'linear' }); ov(x, '<i class="a"></i><i class="b"></i>', '', x.dur * 2.4, 'fx-search'); }, 'Spotlights search the dark and find it.', 800);
  inn('fistbump', 'Fist bump', '🤜', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], { duration: x.dur * 1.6 }); ov(x, `<b class="l">${ART.fist}</b><b class="r"><span style="display:inline-block;transform:scaleX(-1)">${ART.fist}</span></b>`, '', x.dur * 1.8, 'fx-bump'); later(x, () => { const [cx, cy] = mid(x); x.ring(cx, cy, 500, '#ffffff'); }, x.dur * .8); }, 'Two fists bump in the centre first.', 700);
  inn('coin', 'Coin toss', '🪙', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], { duration: x.dur * 2 }); ov(x, '<b></b>', '', x.dur * 2.1, 'fx-coin'); }, 'A coin flips in the middle first.', 700);
  inn('sweepin', 'Shine sweep in', '🌟', 'VS & screens', x => { A(x, x.t, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 }); ov(x, '<i></i>', '', x.dur + 400, 'fx-sweepov'); }, 'Fades in with a shine sweeping across.');

  // ================================================================== EXITS
  const OUT = F.OUTS;
  const out = (id, label, emoji, cat, play, tip, dur = 520) => { OUT[id] = { label, emoji, cat, play, tip, dur, fx: true }; };
  const fin = (x, a) => { if (a) a.onfinish = () => { x.done && x.done(); }; else x.done && x.done(); };
  out('implode', 'Implode', '🕳️', 'Player bar', x => { fin(x, A(x, x.t, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.06)', offset: .2 }, { transform: 'scale(0)', opacity: 1, filter: 'brightness(3)' }], { easing: E.in, fill: 'forwards' })); later(x, () => { const [cx, cy] = mid(x); x.ring(cx, cy, 160, x.color); }, x.dur * .9); }, 'Shrinks to a point and vanishes with a flash.');
  out('keys', 'Keyframed (your own)', '🎞️', 'Your own', x => { const K = keysOf(x.el && x.el.exit, 'out'); fin(x, A(x, x.t, K.frames, { duration: K.dur * 1000, easing: 'linear', fill: 'forwards' })); },
    'Your own way out: where the piece is at each moment on its way off.', 1000);
  out('path', 'Along a path', '〰️', 'Your own', x => { const m = (x.el && x.el.exit) || {}; fin(x, A(x, x.t, pathFrames(m, 'out'), { duration: (Number(m.dur) || 1.1) * 1000, easing: easeOf(m.ease || 'inout'), fill: 'forwards' })); },
    'The piece leaves along a curve (the path played backwards).', 1100);
  out('sinkout', 'Sink down', '⬇️', 'Player bar', x => fin(x, A(x, x.t, [{ transform: 'none', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(100%)', clipPath: 'inset(0 0 100% 0)' }], { easing: E.in, fill: 'forwards' })), 'Sinks below a waterline.');
  out('peelout', 'Peel away', '🩹', 'Player bar', x => fin(x, A(x, x.t, [{ transform: 'none', opacity: 1 }, { transform: 'perspective(600px) rotateY(40deg) rotateZ(-8deg) translate(40px,-20px)', opacity: 1, offset: .4 }, { transform: 'perspective(600px) rotateY(80deg) rotateZ(-20deg) translate(200px,120px)', opacity: 0 }], { easing: E.in, fill: 'forwards', transformOrigin: '0 0' })), 'Peels off like a sticker.');
  out('splitout', 'Split apart', '↔️', 'VS & screens', x => slices({ ...x, delay: x.delay || 0 }, 2, 'x', i => [{ transform: 'none' }, { transform: `translateX(${i ? 110 : -110}%)` }], { out: true, step: 0, ease: E.in }), 'Splits down the middle and slides away.');
  out('tunnel', 'Tunnel', '🚇', 'VS & screens', x => fin(x, A(x, x.t, [{ transform: 'none', filter: 'none', opacity: 1 }, { transform: 'scale(3.5)', filter: 'blur(14px) brightness(1.5)', opacity: 0 }], { easing: E.in, fill: 'forwards', duration: x.dur * 1.3 })), 'Rushes down a tunnel into the match.');
  out('zoomthrough', 'Zoom through', '🔭', 'VS & screens', x => fin(x, A(x, x.t, [{ transform: 'none', opacity: 1 }, { transform: 'scale(6)', opacity: 0 }], { easing: 'cubic-bezier(.7,0,1,.6)', fill: 'forwards' })), 'Flies through into the game.');
  out('toblack', 'Fade to black', '⬛', 'VS & screens', x => { const o = ov(x, '', 'background:#000;opacity:0', x.dur * 2.2, 'fx-black'); x.anim(o, [{ opacity: 0 }, { opacity: 1, offset: .45 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: x.dur * 2, delay: x.delay || 0 }); later(x, () => { x.t.style.opacity = '0'; x.done && x.done(); setTimeout(() => { x.t.style.opacity = ''; }, 60); }, x.dur * .95); }, 'A quick fade to black and back.');
  out('burstout', 'Burst', '💥', 'VS & screens', x => { fin(x, A(x, x.t, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'scale(1.25)', opacity: 0, filter: 'brightness(3) blur(6px)' }], { easing: E.out, fill: 'forwards' })); const [cx, cy] = mid(x); later(x, () => x.spark(cx, cy, 60, 1.4, x.color), 30); }, 'Everything blows outward in a flash.');
  out('diag', 'Diagonal wipe', '◩', 'VS & screens', x => fin(x, A(x, x.t, [{ clipPath: 'polygon(0 0,130% 0,100% 100%,-30% 100%)' }, { clipPath: 'polygon(130% 0,130% 0,100% 100%,100% 100%)' }], { easing: E.in, fill: 'forwards' })), 'A fast diagonal wipe clears it.');
  out('drain', 'Drain', '🚰', 'VS & screens', x => fin(x, A(x, x.t, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(30%) skewY(6deg) scaleY(.4)', opacity: 0 }], { easing: E.in, fill: 'forwards' })), 'Slides down and away like water down a drain.');
  out('scatter', 'Pixel scatter', '🌬️', 'VS & screens', x => slices(x, 10, 'x', i => [{ transform: 'none', opacity: 1 }, { transform: `translate(${(i - 5) * 40}px, ${((i * 37) % 9 - 4) * 30}px) rotate(${(i % 3 - 1) * 40}deg) scale(.3)`, opacity: 0 }], { out: true, ease: E.in, order: [4, 9, 1, 6, 3, 8, 0, 5, 2, 7] }), 'Bursts into pieces that blow away.', 480);
  out('foldout', 'Fold up', '🗂️', 'VS & screens', x => fin(x, A(x, x.t, [{ transform: 'perspective(1200px) rotateX(0)', transformOrigin: '50% 0' }, { transform: 'perspective(1200px) rotateX(90deg)', transformOrigin: '50% 0' }], { easing: E.in, fill: 'forwards' })), 'Folds up like paper.');
  out('rollup', 'Roll up', '📜', 'VS & screens', x => fin(x, A(x, x.t, [{ transform: 'none', transformOrigin: '50% 0', filter: 'none' }, { transform: 'scaleY(0)', transformOrigin: '50% 0', filter: 'brightness(.5)' }], { easing: E.in, fill: 'forwards' })), 'Rolls up like a poster.');
  out('lightsdown', 'Lights down', '🌘', 'VS & screens', x => fin(x, A(x, x.t, [{ filter: 'none', opacity: 1 }, { filter: 'brightness(.6)', offset: .33 }, { filter: 'brightness(.3)', offset: .66 }, { filter: 'brightness(0)', opacity: 0 }], { easing: 'steps(1,end)', fill: 'forwards', duration: x.dur * 1.6 })), 'The lights dim one by one.');
  out('irisout', 'Iris close', '⭕', 'VS & screens', x => fin(x, A(x, x.t, [{ clipPath: 'circle(80% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }], { easing: E.in, fill: 'forwards' })), 'A circle closes on it.');
  out('curtainclose', 'Curtain close', '🎭', 'VS & screens', x => { ov(x, '<i class="l"></i><i class="r"></i>', '', x.dur * 2.4, 'fx-curtains out'); later(x, () => { x.done && x.done(); }, x.dur); }, 'Curtains fall closed over it.', 700);
  out('pagecurl', 'Page curl', '📃', 'Transitions', x => fin(x, A(x, x.t, [{ transform: 'none', transformOrigin: '100% 100%', clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }, { transform: 'perspective(1400px) rotateY(-60deg) rotateZ(-6deg) translate(-40%,-10%)', transformOrigin: '100% 100%', clipPath: 'polygon(0 0,40% 0,0 40%,0 40%)', opacity: 0 }], { easing: E.in, fill: 'forwards', duration: x.dur * 1.2 })), 'The scene curls away like a page.');
  out('pixelsort', 'Pixel sort', '🧮', 'Transitions', x => slices(x, 16, 'y', i => [{ transform: 'none', filter: 'none' }, { transform: `translateX(${(i % 2 ? 1 : -1) * (40 + (i * 53) % 60)}%) scaleX(2)`, filter: 'blur(6px) saturate(2)', opacity: 0 }], { out: true, ease: E.in, step: 12 }), 'The screen smears into pixel streaks.', 520);
  out('shutter', 'Shutter', '🔲', 'Transitions', x => { ov(x, '<i class="t"></i><i class="b"></i>', '', x.dur * 2.6, 'fx-shutter'); later(x, () => { x.done && x.done(); }, x.dur); }, 'Metal shutters close and open.', 600);
  out('zoomblur', 'Zoom blur', '💫', 'Transitions', x => fin(x, A(x, x.t, [{ transform: 'none', filter: 'none', opacity: 1 }, { transform: 'scale(1.6)', filter: 'blur(18px)', opacity: 0 }], { easing: E.in, fill: 'forwards' })), 'A fast zoom blur into the next scene.');
  out('plane', 'Paper plane', '✈️', 'Transitions', x => { ov(x, `<b>${ART.plane}</b>`, '', x.dur * 2, 'fx-plane'); fin(x, A(x, x.t, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], { easing: E.soft, fill: 'forwards', duration: x.dur * 1.3, delay: (x.delay || 0) + 150 })); }, 'A paper plane flies across and pulls the scene away.', 650);
  out('inkcover', 'Ink cover', '🦑', 'Transitions', x => { const o = ov(x, '', `background:${x.color};clip-path:circle(0% at 30% 60%);filter:url(#fxf-rough)`, x.dur * 2.4, 'fx-inkc'); x.anim(o, [{ clipPath: 'circle(0% at 30% 60%)' }, { clipPath: 'circle(150% at 30% 60%)', offset: .45 }, { clipPath: 'circle(150% at 30% 60%)', opacity: 1, offset: .55 }, { clipPath: 'circle(150% at 30% 60%)', opacity: 0 }], { duration: x.dur * 2.2, delay: x.delay || 0 }); later(x, () => { x.done && x.done(); }, x.dur); }, 'An ink splash covers the cut.', 650);
  out('stinger', 'Logo stinger', '🐝', 'Transitions', x => { ov(x, `<i></i><b>${ART.bee}</b>`, '', x.dur * 2.6, 'fx-stinger'); later(x, () => { x.done && x.done(); }, x.dur); }, 'A branded wipe flies across to cover the cut.', 650);
  out('packaway', 'Pack away', '📦', 'Transitions', x => slices(x, 4, 'x', i => [{ transform: 'none', opacity: 1 }, { transform: `translate(${i < 2 ? -60 : 60}%, ${i % 2 ? 60 : -60}%) scale(.2)`, opacity: 0 }], { out: true, step: 40, ease: E.in }), 'Pieces fold into the corners.', 520);

  // ================================================================== REACTIONS
  const RE = F.REACTS;
  const re = (id, label, emoji, play, tip, on = 'any') => { RE[id] = { label, emoji, play, tip, on, fx: true }; };
  const R1 = (x, k, o = {}) => x.anim(x.t, k, { duration: 620, easing: E.out, ...o });
  re('recoil', 'Recoil', '🔙', x => R1(x, [{ transform: 'none' }, { transform: `translateX(${-(x.dir || 1) * 16}px) rotate(${-(x.dir || 1) * 1.5}deg)`, offset: .2 }, { transform: 'none' }]), 'Jolts back when hit.', 'lose');
  re('tug', 'Tug of war', '🪢', x => R1(x, [{ transform: 'none' }, { transform: `translateX(${(x.toward || 1) * 22}px) skewX(${-(x.toward || 1) * 6}deg)`, offset: .35 }, { transform: 'none' }], { duration: 800 }), 'Leans toward the player who just scored.');
  re('piston', 'Piston punch', '🔩', x => { R1(x, [{ transform: 'none' }, { transform: `translateX(${(x.dir || 1) * 10}px)`, offset: .15 }, { transform: 'none' }], { duration: 400 }); ov(x, '<i></i>', `--d:${x.dir || 1}`, 700, 'fx-piston'); }, 'A piston fires out of the score box.', 'score');
  re('chain', 'Chain snap', '⛓️', x => ov(x, '<i class="l"></i><i class="r"></i>', '', 1200, 'fx-chain'), 'A chain across it breaks.', 'score');
  re('tape', 'Ticker tape', '🧾', x => ov(x, `<b>${esc(x.score ?? '')}</b>`, `--d:${x.dir || 1}`, 1800, 'fx-tape'), 'A paper strip prints out with the new score.', 'score');
  re('wince', 'Wince squash', '😖', x => R1(x, [{ transform: 'none' }, { transform: 'scale(1.06,.78)', offset: .2 }, { transform: 'scale(.98,1.04)', offset: .5 }, { transform: 'none' }], { duration: 560 }), 'Squashes flat for a moment.', 'lose');
  re('peel', 'Peel away', '🩹', x => R1(x, [{ transform: 'none', opacity: 1 }, { transform: 'perspective(700px) rotateY(50deg) rotate(-6deg) translate(30px,-10px)', opacity: .9, offset: .35 }, { transform: 'perspective(700px) rotateY(85deg) translate(120px,60px)', opacity: 0, offset: .6 }, { transform: 'none', opacity: 0, offset: .75 }, { transform: 'none', opacity: .55 }], { duration: 2200, transformOrigin: '0 0' }), 'Peels off like a sticker, then comes back dimmed.', 'setlose');
  re('sink', 'Sink down', '⬇️', x => R1(x, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(120%)', opacity: 0, offset: .4 }, { transform: 'translateY(30%)', opacity: 0, offset: .6 }, { transform: 'none', opacity: .6 }], { duration: 2000 }), 'Sinks below the edge, then rises back dimmed.', 'setlose');
  re('medal', 'Medal pin', '🏅', x => ov(x, `<b>${ART.medal}</b>`, '', 2600, 'fx-medal'), 'A medal swings on and settles.', 'win');
  re('crown', 'Crown drop', '👑', x => ov(x, `<b>${ART.crown}</b>`, '', 2600, 'fx-crown'), 'A small crown falls on top.', 'win');
  re('flipname', 'Flip over', '🔁', x => R1(x, [{ transform: 'perspective(800px) rotateX(0)' }, { transform: 'perspective(800px) rotateX(360deg)' }], { duration: 700 }), 'The whole piece flips over.', 'change');
  re('lstamp', '[L] stamp', '🔻', x => ov(x, '<b>L</b>', '', 1500, 'fx-lstamp'), 'An [L] stamps on with a thud.', 'losers');
  re('alarm', 'Match point alarm', '🚨', x => ov(x, '<i></i>', '', 1300, 'fx-alarm'), 'A red light sweeps across once.', 'mp');
  re('finalpulse', 'Final game pulse', '💓', x => R1(x, [{ transform: 'none' }, { transform: 'scale(1.05)', offset: .2 }, { transform: 'none', offset: .4 }, { transform: 'scale(1.05)', offset: .6 }, { transform: 'none', offset: .8 }, { transform: 'scale(1.03)', offset: .9 }, { transform: 'none' }], { duration: 1600 }), 'Pulses together when the set goes to the last game.', 'final');
  re('rewindreset', 'Reset rewind', '⏪', x => R1(x, range(7, i => ({ offset: i / 6, transform: i === 6 ? 'none' : `translateX(${(i % 2 ? 1 : -1) * (12 - i * 2)}px)`, filter: i === 6 ? 'none' : 'saturate(.3) hue-rotate(30deg)' })), { duration: 600, easing: 'steps(1,end)' }), 'Rewinds back to its clean state.', 'reset');
  re('stretch', 'Stretch', '↔️', x => R1(x, [{ transform: 'none' }, { transform: 'scaleX(1.12)', offset: .4 }, { transform: 'none' }], { duration: 700, easing: E.bounce }), 'Stretches for a moment.', 'change');
  re('ribbonwrap', 'Ribbon wrap', '🎀', x => ov(x, '<i></i>', '', 1400, 'fx-ribbon'), 'A ribbon wraps around and pulls tight.', 'win');
  re('wave', 'Wave ripple', '〰️', x => R1(x, [0, 1, 2, 3, 4].map(i => ({ offset: i / 4, transform: i === 4 ? 'none' : `skewY(${(i % 2 ? 1 : -1) * 3}deg) translateY(${i % 2 ? -4 : 4}px)` })), { duration: 700 }), 'A wave rolls through it.');
  re('tracer', 'Tracer shot', '🔫', x => ov(x, '<i></i>', `--d:${x.dir || 1}`, 700, 'fx-tracer'), 'A fast streak shoots toward the other side.', 'score');
  re('beat', 'Beat bounce', '🥁', x => R1(x, [0, 1, 2, 3, 4, 5, 6].map(i => ({ offset: i / 6, transform: i % 2 ? 'translateY(-10px) scale(1.03)' : 'none' })), { duration: 1050, easing: 'ease-in-out' }), 'Bounces three times on the beat.');
  re('heatflare', 'Heat flare', '♨️', x => R1(x, [{ filter: 'none' }, { filter: 'brightness(3) saturate(.2)', offset: .15 }, { filter: 'brightness(1.6) sepia(.6)', offset: .5 }, { filter: 'none' }], { duration: 900 }), 'Flares white-hot for a moment.', 'score');
  re('freezeover', 'Freeze over', '🥶', x => { if (!(x.lostRow >= 3) && !x.test) return; ov(x, '<i></i>', '', 2600, 'fx-freezeov'); }, 'Frost sweeps across after three games lost in a row.', 'lose');
  re('dustoff', 'Dust off', '🧹', x => ov(x, range(10, i => `<i style="left:${i * 10}%;animation-delay:${i * 30}ms"></i>`).join(''), '', 1400, 'fx-dust'), 'Dust blows off it.', 'reset');
  re('push', 'Camera push', '🎥', x => R1(x, [{ transform: 'none' }, { transform: 'scale(1.14)', offset: .3 }, { transform: 'scale(1.14)', offset: .6 }, { transform: 'none' }], { duration: 1400, easing: E.soft }), 'Zooms toward the camera for a moment.', 'mp');
  re('splitjoin', 'Split and rejoin', '🧬', x => { const c = x.t.cloneNode(true); c.style.cssText += ';position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.7'; x.t.parentNode.appendChild(c); x.anim(c, [{ transform: 'none' }, { transform: 'translate(10px,-6px)', offset: .3 }, { transform: 'none' }], { duration: 700 }).onfinish = () => c.remove(); }, 'Splits into two layers that slide apart and back.');
  re('screenflash', 'Screen flash', '⚪', x => { const o = ov({ ...x, rect: { x: 0, y: 0, w: x.W, h: x.H } }, '', 'background:#fff;opacity:0', 600, 'fx-black'); x.anim(o, [{ opacity: 0 }, { opacity: .85, offset: .1 }, { opacity: 0 }], { duration: 500 }); }, 'A quick white flash over the whole screen.', 'win');
  re('screenshake', 'Screen shake', '📳', x => x.anim(x.root, [0, -14, 12, -9, 7, -4, 2, 0].map((v, i) => ({ offset: i / 7, transform: `translate(${v}px, ${-v / 2}px)` })), { duration: 520 }), 'A short shake of the whole screen.', 'win');
  re('confetti', 'Confetti cannons', '🎊', x => ov({ ...x, rect: { x: 0, y: 0, w: x.W, h: x.H } }, range(60, i => `<i style="--x:${(i % 2 ? -1 : 1) * (20 + (i * 37) % 60)}vw;--y:${-(30 + (i * 53) % 60)}vh;--r:${(i * 97) % 720}deg;background:${['#ff5a5a', '#ffd23a', '#5ad1ff', '#7dff8a', '#ff7ad9'][i % 5]};left:${i % 2 ? 100 : 0}%;animation-delay:${(i % 10) * 20}ms"></i>`).join(''), '', 3200, 'fx-confetti'), 'Confetti bursts from both corners.', 'win');
  re('gg', 'GG stamp', '🤝', x => ov(x, '<b>GG</b>', '', 1600, 'fx-stamp gg'), 'A big “GG” stamp lands on it.', 'win');
  re('jelly', 'Jelly wobble', '🍮', x => R1(x, [{ transform: 'none' }, { transform: 'scale(1.15,.85)', offset: .2 }, { transform: 'scale(.9,1.1)', offset: .4 }, { transform: 'scale(1.05,.95)', offset: .6 }, { transform: 'scale(.98,1.02)', offset: .8 }, { transform: 'none' }], { duration: 800 }), 'Wobbles like jelly.');

  // ================================================================== TEXT CHANGES
  const TX = F.TEXTS;
  const tx = (id, label, emoji, play, tip) => { TX[id] = { label, emoji, play, tip, fx: true }; };
  // wrap each letter while the move plays, then put the plain text back
  function letters(n, ms) {
    const txt = n.dataset.txt ?? n.textContent; if (!txt) return [];
    if (n.__fxObs) return [...n.querySelectorAll('.fxch')];
    n.textContent = ''; const out = [...txt].map((ch, i) => { const s = document.createElement('span'); s.className = 'fxch'; s.textContent = ch; n.appendChild(s); return s; });
    clearTimeout(n.__fxT); n.__fxT = setTimeout(() => { if (n.dataset.txt === txt || n.textContent === txt) n.textContent = txt; }, ms + 60);
    return out;
  }
  const per = (n, x, kf, o = {}) => { const ls = letters(n, (o.step || 40) * 30 + (o.dur || 450)); ls.forEach((s, i) => x.anim(s, typeof kf === 'function' ? kf(i, ls.length) : kf, { duration: o.dur || 450, delay: i * (o.step || 40), easing: o.ease || E.out, fill: 'backwards' })); return ls; };
  const whole = (n, x, kf, o = {}) => x.anim(n, kf, { duration: 520, easing: E.out, ...o });
  tx('morse', 'Morse blink', '📶', (n, x) => per(n, x, i => range(6, k => ({ offset: k / 5, opacity: k === 5 ? 1 : (i + k) % 2 })), { step: 50, dur: 500, ease: 'steps(1,end)' }), 'Letters blink on in a Morse-code rhythm.');
  tx('magnet', 'Magnet snap', '🧲', (n, x) => per(n, x, i => [{ transform: `translate(${((i * 73) % 200) - 100}px, ${((i * 41) % 120) - 60}px) rotate(${(i * 57) % 180 - 90}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { step: 25, dur: 520, ease: E.snap }), 'Letters fly in from random spots and snap into line.');
  tx('domino', 'Domino fall', '🁢', (n, x) => per(n, x, [{ transform: 'rotateX(-90deg)', transformOrigin: '50% 100%', opacity: 0 }, { transform: 'none', transformOrigin: '50% 100%', opacity: 1 }], { step: 45 }), 'Letters tip over in a row and land upright.');
  tx('brush', 'Brush write', '🖌️', (n, x) => whole(n, x, [{ clipPath: 'inset(0 100% 0 0)', filter: 'url(#fxf-rough)' }, { clipPath: 'inset(0 0 0 0)', filter: 'url(#fxf-rough)', offset: .9 }, { clipPath: 'inset(0 0 0 0)', filter: 'none' }], { duration: 700, easing: E.soft }), 'The name is painted in, stroke by stroke.');
  tx('drop', 'Letter drop', '⬇️', (n, x) => per(n, x, [{ transform: 'translateY(-1.2em)', opacity: 0 }, { transform: 'translateY(.08em)', opacity: 1, offset: .7 }, { transform: 'none' }], { step: 35 }), 'Each letter falls in with a bounce.');
  tx('rise', 'Letter rise', '⬆️', (n, x) => per(n, x, [{ transform: 'translateY(1em)', opacity: 0 }, { transform: 'none', opacity: 1 }], { step: 30 }), 'Each letter rises up from below.');
  tx('wave', 'Wave ripple', '🌊', (n, x) => per(n, x, [{ transform: 'none' }, { transform: 'translateY(-.3em)', offset: .4 }, { transform: 'none' }], { step: 40, dur: 500, ease: 'ease-in-out' }), 'A wave rolls through the letters.');
  tx('hop', 'Hop in', '🐇', (n, x) => per(n, x, [{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'translateY(-.15em) scale(1.1)', opacity: 1, offset: .6 }, { transform: 'none' }], { step: 35, ease: E.bounce }), 'Letters hop in one by one.');
  tx('splitrev', 'Split reveal', '✂️', (n, x) => per(n, x, i => [{ transform: `translateY(${i % 2 ? 1 : -1}em)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { step: 20 }), 'Letters slide in from above and below.');
  tx('credits', 'Credits scroll', '🎬', (n, x) => whole(n, x, [{ transform: 'translateY(120%)', clipPath: 'inset(-120% 0 100% 0)' }, { transform: 'none', clipPath: 'inset(0 0 0 0)' }], { duration: 600 }), 'Scrolls up like movie credits and stops.');
  tx('outline', 'Outline draw', '✏️', (n, x) => whole(n, x, [{ webkitTextFillColor: 'transparent', webkitTextStroke: '1px #fff', opacity: .9 }, { webkitTextFillColor: 'transparent', webkitTextStroke: '1px #fff', offset: .6 }, { webkitTextStroke: '0px #fff' }], { duration: 900 }), 'The outline draws first, then the fill fades in.');
  tx('rubber', 'Rubber band', '🪀', (n, x) => whole(n, x, [{ transform: 'scaleX(0)', transformOrigin: '0 50%' }, { transform: 'scaleX(1.25)', transformOrigin: '0 50%', offset: .6 }, { transform: 'scaleX(.95)', transformOrigin: '0 50%', offset: .8 }, { transform: 'none', transformOrigin: '0 50%' }], { duration: 650 }), 'Stretches out from one end and snaps into place.');
  tx('freezein', 'Freeze-in', '🧊', (n, x) => whole(n, x, [{ filter: 'brightness(2.2) saturate(0) hue-rotate(180deg) blur(2px)' }, { filter: 'brightness(2.2) saturate(0) hue-rotate(180deg)', offset: .5 }, { filter: 'none' }], { duration: 900 }), 'Frosts over, then the ice cracks away.');
  tx('inkbleed', 'Ink bleed', '🖋️', (n, x) => whole(n, x, [{ filter: 'blur(8px) contrast(3)', opacity: 0 }, { filter: 'blur(0) contrast(1)', opacity: 1 }], { duration: 800 }), 'Bleeds in like ink on paper.');
  tx('smokeform', 'Smoke form', '💨', (n, x) => whole(n, x, [{ filter: 'blur(10px)', letterSpacing: '.5em', opacity: 0 }, { filter: 'none', letterSpacing: 'normal', opacity: 1 }], { duration: 800 }), 'Smoke swirls together into the letters.');
  tx('pixelbuild', 'Pixel build', '👾', (n, x) => whole(n, x, [{ filter: 'blur(6px) contrast(5)', opacity: .2 }, { filter: 'none', opacity: 1 }], { duration: 500, easing: 'steps(5,end)' }), 'Letters form from scattered pixels.');
  tx('accordion', 'Accordion', '🪗', (n, x) => whole(n, x, [{ letterSpacing: '-.5em', opacity: 0 }, { letterSpacing: '.25em', opacity: 1, offset: .6 }, { letterSpacing: 'normal' }], { duration: 650 }), 'Letters squeeze together, then spring open.');
  tx('spinletters', 'Spin in', '🌀', (n, x) => per(n, x, [{ transform: 'rotateY(360deg) scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { step: 35, dur: 550 }), 'Each letter spins in on its own axis.');
  tx('laser', 'Laser etch', '🔦', (n, x) => { whole(n, x, [{ clipPath: 'inset(0 100% 0 0)', filter: 'brightness(2.5)' }, { clipPath: 'inset(0 0 0 0)', filter: 'brightness(2.5)', offset: .85 }, { clipPath: 'inset(0 0 0 0)', filter: 'none' }], { duration: 800, easing: 'linear' }); }, 'A laser burns each letter in.');
  tx('slot', 'Slot machine roll', '🎰', (n, x) => { const fin = n.dataset.txt ?? n.textContent, G = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; let k = 0; const ls = letters(n, 1000); const st = setInterval(() => { k++; ls.forEach((s, i) => { s.textContent = k > 4 + i * 2 ? [...fin][i] : G[(Math.random() * G.length) | 0]; }); if (k > 6 + ls.length * 2) clearInterval(st); }, 40); }, 'Letters roll through the alphabet and stop.');
  tx('odometer', 'Odometer', '🔢', (n, x) => whole(n, x, [{ transform: 'translateY(100%)', clipPath: 'inset(-100% 0 100% 0)' }, { transform: 'translateY(-8%)', clipPath: 'inset(8% 0 -8% 0)', offset: .75 }, { transform: 'none', clipPath: 'inset(0 0 0 0)' }], { duration: 480 }), 'Digits roll up like an odometer.');
  tx('scoredrop', 'Drop-in', '🔽', (n, x) => whole(n, x, [{ transform: 'translateY(-90%)', opacity: 0 }, { transform: 'translateY(6%)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 460, easing: E.bounce }), 'The new value falls in from above.');
  tx('scoresplit', 'Split', '🪓', (n, x) => whole(n, x, [{ clipPath: 'inset(50% 0 50% 0)', transform: 'scale(1.4)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 420 }), 'The old value splits and the new one rises through.');
  tx('tally', 'Tally', '✍️', (n, x) => { const fin = n.dataset.txt ?? n.textContent, v = Math.min(9, Math.max(0, parseInt(fin, 10) || 0)); n.textContent = '|'.repeat(v || 1); setTimeout(() => { if (n.dataset.txt === fin) n.textContent = fin; whole(n, x, [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300 }); }, 380); }, 'Tally marks scratch in, then turn into the number.');
  tx('countup', 'Count up', '🔼', (n, x) => { if (window.SBMotion) return window.SBMotion.countUp(n); const fin = n.dataset.txt ?? n.textContent, m = fin.match(/\d+/); if (!m) return; const to = +m[0], t0 = performance.now(); const st = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 700); n.textContent = fin.replace(/\d+/, String(Math.round(to * k))); if (k >= 1 || n.dataset.txt !== fin) { clearInterval(st); if (n.dataset.txt === fin) n.textContent = fin; } }, 33); }, 'Numbers count up from zero.');
  tx('nametrade', 'Name trade', '🔀', (n, x) => whole(n, x, [{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500 }), 'The new name rises from below.');
  tx('elastic', 'Elastic stretch', '🧶', (n, x) => whole(n, x, [{ transform: 'scaleX(1.6)' }, { transform: 'scaleX(.85)', offset: .4 }, { transform: 'scaleX(1.06)', offset: .7 }, { transform: 'none' }], { duration: 700 }), 'Stretches wide and snaps back.');
  tx('jelly', 'Jelly wobble', '🍮', (n, x) => whole(n, x, [{ transform: 'skewX(0)' }, { transform: 'skewX(-14deg) scaleY(.9)', offset: .25 }, { transform: 'skewX(9deg)', offset: .5 }, { transform: 'skewX(-4deg)', offset: .75 }, { transform: 'none' }], { duration: 700 }), 'Letters wobble like jelly.');
  tx('heartbeat', 'Heartbeat', '💗', (n, x) => whole(n, x, [{ transform: 'none' }, { transform: 'scale(1.18)', offset: .15 }, { transform: 'none', offset: .3 }, { transform: 'scale(1.12)', offset: .45 }, { transform: 'none' }], { duration: 900 }), 'Thumps twice like a heartbeat.');
  tx('glint', 'Underside glint', '✨', (n, x) => whole(n, x, [{ filter: 'drop-shadow(0 2px 0 rgba(255,255,255,0))' }, { filter: 'drop-shadow(0 3px 2px rgba(255,255,255,.95))', offset: .4 }, { filter: 'drop-shadow(0 2px 0 rgba(255,255,255,0))' }], { duration: 800 }), 'A glint runs along the bottom edge.');
  tx('etch', 'Champion etch', '🏆', (n, x) => whole(n, x, [{ filter: 'brightness(2.4) drop-shadow(0 0 10px #ffd36b)', letterSpacing: '.12em' }, { filter: 'none', letterSpacing: 'normal' }], { duration: 1100 }), 'Carved deeper, with tiny metal flakes.');
  tx('meltdown', 'Melt down', '🫠', (n, x) => whole(n, x, [{ filter: 'url(#fxf-melt)', transform: 'scaleY(1.2) translateY(6%)' }, { filter: 'none', transform: 'none' }], { duration: 1400 }), 'Letters droop and drip slightly.');
  tx('eraser', 'Eraser rub', '🧽', (n, x) => whole(n, x, [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 100%)', opacity: 1, offset: .45 }, { clipPath: 'inset(0 0 0 0)', opacity: 0, offset: .46 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 1100 }), 'Rubbed out, then written back.');
  tx('signature', 'Signature scrawl', '🖊️', (n, x) => { const f = n.style.fontFamily; n.style.fontFamily = "'Kaushan Script',cursive"; whole(n, x, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 700, easing: E.soft }); setTimeout(() => { n.style.fontFamily = f; whole(n, x, [{ opacity: .3 }, { opacity: 1 }], { duration: 300 }); }, 1100); }, 'Signed in handwriting, then turns into the layout font.');
  tx('chromatic', 'Chromatic shake', '🌈', (n, x) => whole(n, x, range(8, i => ({ offset: i / 7, textShadow: i === 7 ? 'none' : `${(i % 2 ? 4 : -4)}px 0 rgba(255,0,80,.8), ${(i % 2 ? -4 : 4)}px 0 rgba(0,220,255,.8)`, transform: i === 7 ? 'none' : `translateX(${i % 2 ? 2 : -2}px)` })), { duration: 500, easing: 'steps(1,end)' }), 'Red and blue copies shake apart and together.');
  tx('typo', 'Typing correction', '⌨️', (n, x) => { const fin = n.dataset.txt ?? n.textContent; if (fin.length < 3) return; const wrong = fin.slice(0, -1) + 'X'; let i = 0; n.textContent = ''; const st = setInterval(() => { i++; if (n.dataset.txt !== fin) return clearInterval(st); if (i <= wrong.length) n.textContent = wrong.slice(0, i); else if (i === wrong.length + 4) n.textContent = wrong.slice(0, -1); else if (i === wrong.length + 6) { n.textContent = fin; clearInterval(st); } }, 45); }, 'A wrong letter types, backspaces, then the right one.');
  tx('tumble', 'Bounce tumble', '🎲', (n, x) => per(n, x, i => [{ transform: `translateY(-1.4em) rotate(${(i % 2 ? 1 : -1) * 180}deg)`, opacity: 0 }, { transform: 'translateY(.1em) rotate(0)', opacity: 1, offset: .7 }, { transform: 'none' }], { step: 40, dur: 600 }), 'Letters tumble in and land in place.');
  tx('lightning', 'Lightning reveal', '⚡', (n, x) => whole(n, x, [{ opacity: 0 }, { opacity: 1, filter: 'brightness(4)', offset: .1 }, { opacity: .2, offset: .2 }, { opacity: 1, filter: 'brightness(2)', offset: .3 }, { opacity: 1, filter: 'none' }], { duration: 600, easing: 'linear' }), 'A bolt flashes and the name appears.');
  tx('firetrail', 'Fire trail', '🔥', (n, x) => per(n, x, [{ filter: 'brightness(2.5) sepia(1) saturate(6) hue-rotate(-20deg) drop-shadow(0 0 6px #ff6a1f)', opacity: 0 }, { filter: 'brightness(2) sepia(1) saturate(5) hue-rotate(-20deg)', opacity: 1, offset: .3 }, { filter: 'none', opacity: 1 }], { step: 45, dur: 700 }), 'A flame runs along the letters as they appear.');
  tx('sparkle', 'Sparkle in', '🌟', (n, x) => per(n, x, [{ transform: 'scale(0) rotate(-90deg)', filter: 'brightness(3)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: .5 }, { transform: 'none', filter: 'none' }], { step: 40 }), 'Stars twinkle where each letter appears.');
  tx('bubble', 'Bubble pop', '🫧', (n, x) => per(n, x, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: .5 }, { transform: 'scale(.9)', offset: .75 }, { transform: 'none' }], { step: 35, ease: E.bounce }), 'Letters pop out of bubbles.');
  tx('tear', 'Paper tear', '📜', (n, x) => whole(n, x, [{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }, { clipPath: 'polygon(0 0,100% 0,96% 18%,100% 36%,95% 55%,100% 72%,96% 88%,100% 100%,0 100%)' }], { duration: 600 }), 'A strip tears away to show the words.');
  tx('shadowslide', 'Shadow slide', '🕶️', (n, x) => whole(n, x, [{ textShadow: '40px 0 0 rgba(0,0,0,.6)', opacity: 0 }, { textShadow: '0 0 0 rgba(0,0,0,.6)', opacity: 0, offset: .4 }, { textShadow: '4px 4px 0 rgba(0,0,0,.6)', opacity: 1, offset: .7 }, { textShadow: 'none', opacity: 1 }], { duration: 700 }), 'The shadow slides in first, then the letters land.');
  tx('centersweep', 'Centre sweep', '↔️', (n, x) => whole(n, x, [{ clipPath: 'inset(0 50% 0 50%)', letterSpacing: '.3em' }, { clipPath: 'inset(0 0 0 0)', letterSpacing: 'normal' }], { duration: 550 }), 'Sweeps out from the centre.');
  tx('unfold', 'Banner unfold', '🎏', (n, x) => whole(n, x, [{ transform: 'perspective(500px) rotateX(-90deg)', transformOrigin: '50% 0', opacity: 0 }, { transform: 'perspective(500px) rotateX(15deg)', transformOrigin: '50% 0', opacity: 1, offset: .7 }, { transform: 'none', transformOrigin: '50% 0' }], { duration: 650 }), 'Unfolds like a paper banner.');
  tx('scatterin', 'Scatter swap', '🌬️', (n, x) => per(n, x, i => [{ transform: `translate(${(i % 2 ? 1 : -1) * 30}px,${(i % 3 - 1) * 20}px) scale(.5)`, opacity: 0, filter: 'blur(4px)' }, { transform: 'none', opacity: 1, filter: 'none' }], { step: 20, dur: 450 }), 'The old letters scatter and the new ones gather in.');
  tx('neonbuzz', 'Neon buzz', '🔆', (n, x) => whole(n, x, [0, 1, 0, 1, .3, 1].map((o, i, a) => ({ offset: i / (a.length - 1), opacity: o, filter: o === 1 ? 'brightness(1.5) drop-shadow(0 0 8px currentColor)' : 'none' })), { duration: 700, easing: 'steps(1,end)' }), 'Buzzes on like a neon sign.');

  // ================================================================== ATMOS (whole-screen backdrops)
  const AT = F.ATMOS, acss = [];
  const atm = (id, label, emoji, o) => { AT[id] = { label, emoji, cat: o.cat || 'Backdrop', tip: o.tip || '', c: o.c || '#ff5a1f', html: o.html || (() => ''), paint: o.paint, front: !!o.front, fx: true }; if (o.css) acss.push([id, o.css]); };
  const W0 = 1920, H0 = 1080;
  atm('hexcage', 'Hexagon cage', '⬡', { c: '#39d5ff', tip: 'A glowing hex cage surrounds the arena.', css: `{background:url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='${NS}' width='56' height='97'><path d='M28 0L56 16V48L28 64L0 48V16Z M28 64V97' fill='none' stroke='white' stroke-width='1.5'/></svg>`)}");background-size:56px 97px;opacity:calc(.25*var(--a));-webkit-mask:radial-gradient(ellipse at center,transparent 35%,#000 75%);mask:radial-gradient(ellipse at center,transparent 35%,#000 75%);filter:drop-shadow(0 0 4px var(--c)) drop-shadow(0 0 2px var(--c));animation:fx-pulse 3s ease-in-out infinite}` });
  atm('weathersplit', 'Weather split', '🌦️', { c: '#ffb347', tip: 'Sunny on one side, stormy on the other.', html: () => `<i class="sun"></i><i class="storm"></i>${range(40, i => `<b style="left:${52 + (i * 47) % 48}%;animation-delay:${(i * 37 % 100) / 100}s"></b>`).join('')}`,
    css: `.sun{position:absolute;left:0;top:0;bottom:0;width:50%;background:radial-gradient(60% 60% at 20% 20%,var(--cB),transparent 70%),repeating-conic-gradient(from 0deg at 15% 15%,var(--cA) 0 4deg,transparent 4deg 14deg);animation:fx-pulse 6s ease-in-out infinite}
      .storm{position:absolute;right:0;top:0;bottom:0;width:50%;background:linear-gradient(180deg,rgba(20,26,44,.75),rgba(40,50,80,.35));animation:fx-thunder 7s steps(1) infinite}
      b{position:absolute;top:-10%;width:1.5px;height:90px;background:linear-gradient(transparent,rgba(190,210,255,.7));animation:fx-rain .7s linear infinite;transform:rotate(12deg)}` });
  atm('magnet', 'Magnetic field lines', '🧲', { c: '#8a7dff', tip: 'Curved lines bend between the two players.', html: () => `<svg width="${W0}" height="${H0}" viewBox="0 0 ${W0} ${H0}">${range(9, i => { const k = (i - 4) * 110; return `<path d="M480 540 C 800 ${540 + k * 2.2} 1120 ${540 + k * 2.2} 1440 540" pathLength="100"/>`; }).join('')}<circle cx="480" cy="540" r="16"/><circle cx="1440" cy="540" r="16"/></svg>`,
    css: `svg{position:absolute;inset:0;opacity:var(--a)} path{fill:none;stroke:var(--c);stroke-width:1.5;stroke-dasharray:3 4;opacity:.6;animation:fx-dash 4s linear infinite;filter:drop-shadow(0 0 3px var(--c))} circle{fill:var(--c2);filter:drop-shadow(0 0 12px var(--c))}` });
  atm('fireice', 'Fire vs ice', '🔥', { c: '#ff5a1f', tip: 'One side burns, the other frosts over.', html: () => '<i class="f"></i><i class="i"></i>',
    css: `.f{position:absolute;left:0;top:0;bottom:0;width:50%;background:radial-gradient(80% 60% at 0 100%,rgba(255,110,20,.75),transparent 70%),radial-gradient(40% 40% at 20% 90%,rgba(255,220,120,.5),transparent);animation:fx-burn 1.6s ease-in-out infinite alternate}
      .i{position:absolute;right:0;top:0;bottom:0;width:50%;background:radial-gradient(80% 60% at 100% 0,rgba(120,210,255,.6),transparent 70%),linear-gradient(200deg,rgba(150,215,255,.35),transparent 60%)} .i::after{content:'';position:absolute;inset:0;background:${F.turb('.012', 3, '0 0 0 0 .85  0 0 0 0 .95  0 0 0 0 1  0 0 0 1.2 -.55', 500, 500)};opacity:.45}` });
  const flakes = (n, cls, extra = () => '') => range(n, i => `<i class="${cls}" style="left:${(i * 61) % 100}%;animation-delay:${-((i * 37) % 100) / 10}s;animation-duration:${6 + (i * 13) % 7}s;${extra(i)}"></i>`).join('');
  atm('ash', 'Ash fall', '🌋', { c: '#9a9a9a', tip: 'Grey ash drifts slowly down.', html: () => flakes(60, 'a', i => `width:${2 + i % 4}px;height:${2 + i % 4}px`), css: `.a{position:absolute;top:-2%;border-radius:40%;background:var(--c);opacity:.6;animation:fx-fall 8s linear infinite}` , paint: n => { if (n.classList.contains('fx-gfx')) return; if (!n.isConnected) { setTimeout(() => { if (n.isConnected && !n.classList.contains('fx-gfx')) gfx(n, 'ash'); }, 0); return; } gfx(n, 'ash'); } });
  atm('sakura', 'Sakura storm', '🌸', { c: '#ffb7d5', tip: 'Cherry blossom petals drift across.', html: () => flakes(46, 'p'), css: `.p{position:absolute;top:-3%;width:14px;height:10px;border-radius:70% 0 70% 0;background:linear-gradient(135deg,#fff0f6,var(--c));animation:fx-sakura 9s linear infinite}` });
  // real lightning (sb-lightning.js): bolts grow down in jagged steps, fork, re-strike two or three times and light up the sky
  // BeeboFX (sb-gfx.js) takes a backdrop over when the layout runs it: real GPU lightning / embers instead of the CSS ones,
  // which come back by themselves if the engine steps down to off
  const gfx = (n, kind, fb) => { const root = n.closest && n.closest('.sd-root'), g = root && root.__gfx; if (!g || !g.on || !n.parentElement) return false;
    const c = (n.style.getPropertyValue('--c') || '#ffffff').trim(), a = Math.max(.2, Number(n.style.getPropertyValue('--a')) || 1);
    if (!g.atmos(n, kind, c, a, () => { n.classList.remove('fx-gfx'); fb && fb(); })) return false; n.classList.add('fx-gfx'); return true; };
  F.gfxAtmos = gfx;
  const storm = (n, every, extra = {}) => { if (n.__storm || n.classList.contains('fx-gfx') || !window.BeeboLightning) return; if (!n.isConnected) { if (!n.__wait) n.__wait = setTimeout(() => { n.__wait = 0; storm(n, every, extra); }, 0); return; } if (gfx(n, 'storm', () => storm(n, every, extra))) return; const c = n.style.getPropertyValue('--c') || '#c6d6ff', a = Number(n.style.getPropertyValue('--a')) || 1; n.__storm = window.BeeboLightning.storm(n, { color: c.trim(), amount: a, every, ...extra }); };
  atm('thunder', 'Rain and thunder', '⛈️', { c: '#c6d6ff', tip: 'Rain falls; real lightning strikes in the distance and lights up the sky.', html: () => `${range(90, i => `<b style="left:${(i * 29) % 100}%;animation-delay:${-((i * 17) % 100) / 100}s"></b>`).join('')}`,
    css: `b{position:absolute;top:-10%;width:1.5px;height:110px;background:linear-gradient(transparent,var(--cB));animation:fx-rain .6s linear infinite;transform:rotate(10deg)}`, paint: n => storm(n, [4, 10]) });
  atm('storm', 'Lightning storm', '🌩️', { c: '#b9c8ff', tip: 'Real lightning: bolts that fork and flicker, light up the clouds, and leave an afterglow. Strength sets how often it strikes.',
    html: () => '<i class="cl"></i>', css: `.cl{position:absolute;inset:0;background:radial-gradient(120% 45% at 50% -8%,rgba(40,48,80,.55),transparent 70%)}`, paint: n => storm(n, [1.6, 5]) });
  // one bolt that splits the screen down the middle and strikes again and again along a new channel (VS Splashes)
  const split = n => { if (n.__split || n.classList.contains('fx-gfx') || !window.BeeboLightning) return; if (!n.isConnected) { if (!n.__wait) n.__wait = setTimeout(() => { n.__wait = 0; split(n); }, 0); return; } if (gfx(n, 'splitbolt', () => split(n))) return; const c = (n.style.getPropertyValue('--c') || '#ffb36b').trim(), a = Math.max(.3, Number(n.style.getPropertyValue('--a')) || 1);
    const go = () => { if (!n.isConnected) { n.__split = 0; return; } if (!document.hidden && n.offsetParent !== null) { const W = n.clientWidth || W0, H = n.clientHeight || H0; window.BeeboLightning.bolt(n, W * .5 + (Math.random() - .5) * 60, -20, W * .5 + (Math.random() - .5) * 90, H + 20, { color: c, width: 4.2, flicker: 3, sky: true, branches: 2, fork: .06 }); }
      n.__split = setTimeout(go, (1.4 + Math.random() * 2.4) * 1000 / a); };
    n.__split = setTimeout(go, 250); };
  atm('splitbolt', 'Lightning split', '⚡', { c: '#ffb36b', tip: 'A real bolt tears down the middle of the screen and strikes again every few seconds (great behind a VS).',
    html: () => '<i class="gl"></i>', css: `.gl{position:absolute;left:50%;top:0;bottom:0;width:360px;margin-left:-180px;background:radial-gradient(38% 62% at 50% 50%,color-mix(in srgb,var(--c) 20%,transparent),transparent 72%)}`, paint: n => split(n) });
  atm('fog', 'Smoke fog', '🌫️', { c: '#c8ccd6', tip: 'Thick fog rolls along the floor.', html: () => range(6, i => `<i style="left:${i * 18 - 10}%;animation-delay:${-i * 3}s"></i>`).join(''), css: `i{position:absolute;bottom:-12%;width:42%;height:45%;border-radius:50%;background:radial-gradient(var(--cA),transparent 70%);filter:blur(30px);animation:fx-fog 18s ease-in-out infinite alternate;opacity:var(--a)}` });
  atm('speedlines', 'Speed lines', '💨', { c: '#ffffff', tip: 'Anime action lines rush toward the centre.', css: `{background:repeating-conic-gradient(from 0deg at 50% 50%,var(--cA) 0 1deg,transparent 1deg 5deg);-webkit-mask:radial-gradient(circle at 50% 50%,transparent 26%,#000 60%);mask:radial-gradient(circle at 50% 50%,transparent 26%,#000 60%);animation:fx-speed .25s steps(2) infinite;opacity:var(--a)}` });
  atm('halftone', 'Halftone panels', '🔴', { c: '#000000', tip: 'Comic-book dot shading on each side.', css: `{background:radial-gradient(circle,var(--cB) 30%,transparent 34%) 0 0/14px 14px;-webkit-mask:linear-gradient(90deg,#000,transparent 35%,transparent 65%,#000);mask:linear-gradient(90deg,#000,transparent 35%,transparent 65%,#000);opacity:var(--a)}` });
  atm('screentone', 'Manga screentone', '📓', { c: '#111111', tip: 'Grey patterned tones with bold ink panel lines.', html: () => `<svg width="${W0}" height="${H0}"><path d="M0 330L1920 220M0 860L1920 760M700 0L620 1080M1300 0L1380 1080"/></svg>`,
    css: `{background:radial-gradient(circle,var(--cA) 25%,transparent 28%) 0 0/7px 7px;opacity:var(--a)} svg{position:absolute;inset:0} path{stroke:var(--c);stroke-width:10;fill:none}` });
  atm('torn', 'Torn paper split', '📃', { c: '#f4ead5', tip: 'The split down the middle looks like ripped paper.', html: () => { let d = 'M940 0'; for (let y = 0; y <= 1080; y += 30) d += `L${940 + ((y * 7919) % 60) - 30} ${y}`; return `<svg width="${W0}" height="${H0}"><path d="${d}"/></svg>`; }, css: `svg{position:absolute;inset:0} path{fill:none;stroke:var(--c);stroke-width:22;filter:drop-shadow(0 0 6px rgba(0,0,0,.6))}` });
  atm('mirrors', 'Mirror maze', '🪞', { c: '#bfe3ff', tip: 'Angled mirror panels with moving reflections.', html: () => range(7, i => `<i style="left:${i * 15 - 2}%;transform:skewX(${i % 2 ? 14 : -14}deg);animation-delay:${-i}s"></i>`).join(''), css: `i{position:absolute;top:0;bottom:0;width:13%;background:linear-gradient(100deg,transparent 30%,var(--cA) 48%,rgba(255,255,255,.45) 50%,transparent 70%);background-size:300% 100%;border-left:1px solid var(--cA);animation:fx-sweep 7s linear infinite;opacity:var(--a)}` });
  atm('temple', 'Temple steps', '⛩️', { c: '#ff9a3d', tip: 'A stone stairway lit by torches.', html: () => `<svg width="${W0}" height="${H0}" viewBox="0 0 ${W0} ${H0}">${range(9, i => `<rect x="${200 + i * 70}" y="${700 + i * 42}" width="${1520 - i * 140}" height="42" fill="hsl(30,10%,${18 - i}%)"/>`).join('')}</svg><i class="t l"></i><i class="t r"></i>`,
    css: `svg{position:absolute;inset:0} .t{position:absolute;top:520px;width:220px;height:300px;border-radius:50%;background:radial-gradient(var(--cB),transparent 65%);animation:fx-torch .3s ease-in-out infinite alternate;filter:blur(4px)} .l{left:120px} .r{right:120px}` });
  atm('neoncity', 'Neon city', '🌃', { c: '#ff2fd6', tip: 'A blurred neon skyline behind the players.', html: () => { const r = rng(5); let s = ''; for (let x = 0; x < W0; x += 60 + r() * 60) { const h = 200 + r() * 450; s += `<rect x="${x.toFixed(0)}" y="${H0 - h}" width="${(50 + r() * 50).toFixed(0)}" height="${h}" fill="#0a0716"/>`; for (let k = 0; k < 6; k++) s += `<rect x="${(x + 8 + r() * 30).toFixed(0)}" y="${(H0 - h + 20 + r() * (h - 40)).toFixed(0)}" width="6" height="10" fill="${r() < .5 ? 'var(--c)' : '#36e6ff'}" class="w"/>`; } return `<svg width="${W0}" height="${H0}">${s}</svg>`; },
    css: `svg{position:absolute;inset:0;filter:blur(1.5px);opacity:var(--a)} .w{animation:fx-flick 5s steps(1) infinite}` });
  atm('dojo', 'Dojo', '🏯', { c: '#d4473b', tip: 'Wooden beams and paper lanterns.', html: () => `<i class="beams"></i>${[18, 42, 58, 82].map((p, i) => `<b style="left:${p}%;animation-delay:${-i * .7}s"></b>`).join('')}`,
    css: `.beams{position:absolute;inset:0;background:linear-gradient(180deg,#2a1a10 0 7%,transparent 7%),repeating-linear-gradient(90deg,#2a1a10 0 26px,transparent 26px 380px);opacity:calc(.85*var(--a))} b{position:absolute;top:7%;width:70px;height:100px;margin-left:-35px;border-radius:40%;background:radial-gradient(#ffe2a8,var(--c) 60%,#5a120c);box-shadow:0 0 60px var(--c);transform-origin:50% -40px;animation:fx-sway 3s ease-in-out infinite alternate}` });
  atm('volcano', 'Volcano', '🌋', { c: '#ff4d0d', tip: 'Lava glow from below with rising embers.', html: () => `<i class="glow"></i>${flakes(40, 'e', i => `width:${3 + i % 3}px;height:${3 + i % 3}px`)}`,
    css: `.glow{position:absolute;left:-10%;right:-10%;bottom:-20%;height:60%;background:radial-gradient(ellipse at 50% 100%,var(--c),rgba(120,20,0,.6) 40%,transparent 70%);animation:fx-burn 2.4s ease-in-out infinite alternate} .e{position:absolute;bottom:-2%;border-radius:50%;background:#ffd27a;box-shadow:0 0 8px var(--c);animation:fx-rise 6s linear infinite}` });
  atm('space', 'Space', '🪐', { c: '#7ab8ff', tip: 'Stars and a glowing planet rim.', html: () => '<i class="st"></i><i class="pl"></i>',
    css: `.st{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 30%,#fff,transparent),radial-gradient(1px 1px at 85% 75%,#fff,transparent),radial-gradient(1px 1px at 55% 85%,#fff,transparent);background-size:300px 220px;animation:fx-twinkle 3s steps(2) infinite}
      .pl{position:absolute;left:-10%;right:-10%;bottom:-140%;height:180%;border-radius:50%;box-shadow:0 -6px 40px var(--c),inset 0 10px 60px var(--cA);background:#05070f}` });
  atm('ropes', 'Boxing ring ropes', '🥊', { c: '#e21b2d', tip: 'Ring ropes and corner posts frame the screen.', html: () => `<i class="post l"></i><i class="post r"></i>${['var(--c)', '#ffffff', '#1d4cff'].map((c, i) => `<b style="top:${70 + i * 7}%;background:${c}"></b>`).join('')}`,
    css: `.post{position:absolute;bottom:0;width:46px;height:42%;background:linear-gradient(90deg,#666,#ddd,#666);border-radius:6px} .l{left:30px} .r{right:30px} b{position:absolute;left:50px;right:50px;height:9px;border-radius:5px;box-shadow:0 4px 6px rgba(0,0,0,.5);animation:fx-ropes 4s ease-in-out infinite alternate}` });
  atm('arcade', 'Underground arcade', '🕹️', { c: '#36e6ff', tip: 'Arcade cabinets glow in the dark.', html: () => range(9, i => `<i style="left:${i * 11.5}%;animation-delay:${-i * .37}s"><b style="background:${i % 3 ? 'var(--c)' : '#ff2fd6'}"></b></i>`).join(''),
    css: `i{position:absolute;bottom:0;width:8%;height:46%;background:linear-gradient(#141020,#07050c);border-radius:8px 8px 0 0;opacity:var(--a)} b{position:absolute;left:12%;right:12%;top:12%;height:30%;border-radius:4px;box-shadow:0 0 40px 4px currentColor;opacity:.35;filter:blur(1px);animation:fx-flick 3s steps(1) infinite}` });
  atm('posters', 'Wanted posters', '🤠', { c: '#d9b886', tip: 'Each player shown on an old wanted poster.', html: () => ['l', 'r'].map(s => `<div class="po ${s}"><small>WANTED</small><b class="n"></b><small>FOR WINNING</small></div>`).join(''),
    css: `.po{position:absolute;top:16%;width:420px;height:600px;background:${F.turb('.04', 4, '0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .5 0')},var(--c);box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:40px 20px;color:#3a2410;font:900 54px/1 'Cinzel',serif} .l{left:8%;transform:rotate(-4deg)} .r{right:8%;transform:rotate(3deg)} small{font-size:30px;letter-spacing:.2em} .n{font-size:46px;text-align:center}`,
    paint: (n, S) => n.querySelectorAll('.n').forEach((b, i) => { b.textContent = ((S['p' + (i + 1)] || {}).name) || ''; }) });
  atm('cards', 'Trading card frames', '🎴', { c: '#c1a2ff', tip: 'Each player in a holographic trading card.', html: () => ['l', 'r'].map(s => `<div class="cd ${s}"><b class="n"></b></div>`).join(''),
    css: `.cd{position:absolute;top:12%;width:440px;height:640px;border-radius:22px;border:10px solid var(--c);background:linear-gradient(115deg,rgba(255,122,224,.25),rgba(122,247,255,.25),rgba(197,255,122,.25));background-size:250% 100%;animation:fx-sweep 5s linear infinite;box-shadow:0 0 30px var(--cA);display:flex;align-items:flex-end;justify-content:center;padding:24px} .l{left:8%} .r{right:8%} .n{font:800 40px 'Chakra Petch',sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:4px 18px;border-radius:8px}`,
    paint: (n, S) => n.querySelectorAll('.n').forEach((b, i) => { b.textContent = ((S['p' + (i + 1)] || {}).name) || ''; }) });
  atm('chartag', 'Main character tags', '🎮', { c: '#ffffff', tip: 'The character each player is on, under each side.', html: () => '<b class="l"></b><b class="r"></b>',
    css: `b{position:absolute;bottom:14%;font:700 30px 'Chakra Petch',sans-serif;letter-spacing:.2em;color:var(--c);padding:6px 22px;background:rgba(0,0,0,.5);clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)} .l{left:14%} .r{right:14%}`,
    paint: (n, S) => n.querySelectorAll('b').forEach((b, i) => { const c = (S['p' + (i + 1)] || {}).character || ''; b.textContent = c; b.style.display = c ? '' : 'none'; }) });
  atm('roundbanner', 'Round name banner', '🎏', { c: '#ff5a1f', tip: 'A big banner with the round (Winners Final…).', html: () => '<b></b>', front: true,
    css: `b{position:absolute;left:50%;top:6%;transform:translateX(-50%);font:900 italic 56px 'Saira Condensed',sans-serif;letter-spacing:.08em;color:#fff;padding:8px 60px;background:linear-gradient(90deg,transparent,var(--c) 15%,var(--c) 85%,transparent);text-transform:uppercase;white-space:nowrap}`,
    paint: (n, S) => { n.querySelector('b').textContent = S.round || ''; } });
  atm('belt', 'Title belt', '🥇', { c: '#f6c453', tip: 'A championship belt between the players in grand finals.', html: () => `<svg width="560" height="200" viewBox="0 0 560 200"><rect x="0" y="70" width="560" height="60" rx="10" fill="#2a1a0a"/><ellipse cx="280" cy="100" rx="120" ry="90" fill="url(#bg)" stroke="#fff3c0" stroke-width="4"/><circle cx="280" cy="100" r="44" fill="none" stroke="#7a4e0a" stroke-width="6"/><rect x="120" y="82" width="30" height="36" rx="4" fill="url(#bg)"/><rect x="410" y="82" width="30" height="36" rx="4" fill="url(#bg)"/><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset=".5" stop-color="#f6c453"/><stop offset="1" stop-color="#9a6510"/></linearGradient></defs></svg>`,
    css: `svg{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);filter:drop-shadow(0 0 20px var(--cA));animation:fx-backlit 3s ease-in-out infinite;display:none} .on svg{display:block}`,
    paint: (n, S) => n.classList.toggle('on', !!(S.isGrandFinals || /grand final/i.test(String(S.round || '')))) });
  atm('losersred', 'Losers side red mode', '🔻', { c: '#9a0f1f', tip: 'Darker and redder when someone is in losers.', css: `{background:radial-gradient(ellipse at center,transparent 40%,var(--cB));mix-blend-mode:multiply;opacity:0;transition:opacity .6s} .on{opacity:var(--a)}`,
    paint: (n, S) => n.classList.toggle('on', !!((S.p1 || {}).loser || (S.p2 || {}).loser)) });
  atm('spotlights', 'Spotlights', '🔦', { c: '#fff6d8', tip: 'Two spotlights shine on the players.', html: () => '<i class="l"></i><i class="r"></i>',
    css: `i{position:absolute;top:-10%;width:700px;height:120%;background:linear-gradient(180deg,var(--cB),transparent 85%);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);filter:blur(8px);mix-blend-mode:screen;animation:fx-spot 6s ease-in-out infinite alternate;opacity:calc(.55*var(--a))} .l{left:8%;transform-origin:50% 0} .r{right:8%;transform-origin:50% 0;animation-delay:-3s}` });
  atm('flare', 'Lens flare', '☀️', { c: '#9fd8ff', tip: 'A bright flare sits in the centre.', html: () => '<i class="core"></i><i class="streak"></i><i class="g1"></i><i class="g2"></i>', front: true,
    css: `i{position:absolute;border-radius:50%;mix-blend-mode:screen} .core{left:860px;top:440px;width:200px;height:200px;background:radial-gradient(#fff,var(--cB) 30%,transparent 70%);animation:fx-pulse 3s ease-in-out infinite} .streak{left:200px;top:536px;width:1520px;height:8px;border-radius:8px;background:linear-gradient(90deg,transparent,var(--c),#fff,var(--c),transparent);filter:blur(1px)} .g1{left:1200px;top:300px;width:80px;height:80px;background:radial-gradient(transparent 50%,var(--cA))} .g2{left:600px;top:700px;width:140px;height:140px;background:radial-gradient(var(--cA),transparent)}` });
  // 1.12.15: lens dirt — smudges and specks on the "camera lens" that only show where light falls across them: a slow
  // light drifts over the glass, now and then catching it all at once
  atm('lensdirt', 'Lens dirt', '🫧', { c: '#fff1d6', tip: 'Smudges and specks on the lens that catch the light: a slow light drifts across them and now and then catches them all.', front: true,
    html: () => `<div class="g"><div class="d">${range(26, i => { const w = 40 + (i * 53) % 240, x = (i * 37 + 7) % 100, y = (i * 61 + 13) % 100, r = (i * 29) % 180; return `<i style="left:${x}%;top:${y}%;width:${w}px;height:${Math.round(w * (.35 + (i % 5) * .15))}px;transform:rotate(${r}deg);opacity:${(.25 + (i % 4) * .18).toFixed(2)}"></i>`; }).join('')}${range(40, i => `<b style="left:${(i * 47 + 3) % 100}%;top:${(i * 71 + 11) % 100}%;width:${3 + i % 7}px;height:${3 + i % 7}px"></b>`).join('')}</div></div>`,
    css: `{mix-blend-mode:screen;opacity:var(--a)} .d{position:absolute;inset:0;-webkit-mask:radial-gradient(closest-side,#000,transparent) 30% 40%/76% 92% no-repeat;mask:radial-gradient(closest-side,#000,transparent) 30% 40%/76% 92% no-repeat;animation:fx-lensdrift 18s ease-in-out infinite alternate}
      .d i{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.22),rgba(255,255,255,.06) 60%,transparent);filter:blur(6px)}
      .d b{position:absolute;border-radius:50%;background:radial-gradient(closest-side,var(--c),transparent);opacity:.55}
      .g{position:absolute;inset:0;animation:fx-lensglint 11s ease-in-out infinite}` });
  atm('bokeh', 'Bokeh lights', '🔵', { c: '#ffd27a', tip: 'Soft out-of-focus lights float in the background.', html: () => range(22, i => `<i style="left:${(i * 47) % 100}%;top:${(i * 31) % 100}%;width:${40 + (i * 23) % 90}px;height:${40 + (i * 23) % 90}px;animation-delay:${-i * .8}s;background:radial-gradient(${['var(--cA)', 'rgba(120,200,255,.3)', 'rgba(255,140,200,.3)'][i % 3]},transparent 70%)"></i>`).join(''),
    css: `i{position:absolute;border-radius:50%;filter:blur(2px);animation:fx-bokeh 14s ease-in-out infinite alternate;opacity:var(--a)}` });
  atm('thermal', 'Thermal camera', '🌡️', { c: '#ff4d00', tip: 'A heat-vision colour look.', front: true, css: `{background:linear-gradient(180deg,#1b0059,#ff006a 40%,#ffbf00 70%,#ffffff);mix-blend-mode:color;opacity:calc(.6*var(--a))}` });
  atm('crt', 'CRT screen', '📺', { c: '#000000', tip: 'Scanlines and a curved-screen glow.', front: true, css: `{background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.7)),repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px);opacity:var(--a)}` });
  atm('vhs', 'VHS tape', '📼', { c: '#ffffff', tip: 'Tape noise, tracking lines and a PLAY tag.', front: true, html: () => '<i></i><b>PLAY ▶</b>', css: `{background:${F.turb('.9', 1, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .12 0', 160, 160)};animation:fx-grain .25s steps(3) infinite;opacity:var(--a)} i{position:absolute;left:0;right:0;height:60px;background:linear-gradient(transparent,rgba(255,255,255,.18),transparent);animation:fx-vhs 4s linear infinite} b{position:absolute;left:60px;top:50px;font:700 40px monospace;color:#fff;text-shadow:2px 0 #f0f,-2px 0 #0ff}` });
  atm('grain', 'Film grain', '🎞️', { c: '#ffffff', tip: 'Subtle grain for a movie look.', front: true, css: `{background:${F.turb('.85', 2, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .14 0', 180, 180)};animation:fx-grain .2s steps(4) infinite;opacity:var(--a)}` });
  atm('vignette', 'Vignette', '⚫', { c: '#000000', tip: 'Dark corners that pull the eye to the centre.', front: true, css: `{background:radial-gradient(ellipse at center,transparent 50%,var(--cB) 100%);opacity:var(--a)}` });
  atm('bigvs', 'Pulsing VS', '🆚', { c: '#ff5a1f', tip: 'A huge VS throbs behind everything.', html: () => '<b>VS</b>', css: `b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:900 italic 520px/1 'Saira Condensed',Impact,sans-serif;color:var(--cA);animation:fx-throb 1.4s ease-in-out infinite}` });
  atm('runes', 'Rotating rune rings', '🔯', { c: '#b47dff', tip: 'Circles of runes spin behind the centre.', html: () => `<svg width="900" height="900" viewBox="-450 -450 900 900"><g class="a"><circle r="400"/><circle r="360"/><text><textPath href="#rp" startOffset="0">ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ</textPath></text></g><g class="b"><circle r="250"/><path d="M0 -250L216 125L-216 125Z M0 250L-216 -125L216 -125Z"/></g><defs><path id="rp" d="M-380 0a380 380 0 1 0 760 0a380 380 0 1 0 -760 0"/></defs></svg>`,
    css: `svg{position:absolute;left:50%;top:50%;margin:-450px;opacity:calc(.5*var(--a));filter:drop-shadow(0 0 8px var(--c))} circle,path{fill:none;stroke:var(--c);stroke-width:2} text{fill:var(--c2);font-size:30px} .a{animation:fx-spin 40s linear infinite} .b{animation:fx-spin 26s linear infinite reverse}` });
  atm('orbs', 'Energy orbs', '🔮', { c: '#5ee7ff', tip: 'Glowing orbs float near each player.', html: () => range(8, i => `<i style="left:${i < 4 ? 10 + i * 7 : 62 + (i - 4) * 7}%;top:${30 + (i * 17) % 40}%;animation-delay:${-i * .9}s"></i>`).join(''),
    css: `i{position:absolute;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,var(--c) 40%,transparent 70%);box-shadow:0 0 40px var(--c);animation:fx-orb 5s ease-in-out infinite alternate}` });
  atm('auraflames', 'Aura flames', '🔥', { c: '#ff5a1f', tip: 'Columns of coloured flame on both sides.', html: () => range(18, i => `<i style="left:${i < 9 ? 4 + i * 3 : 69 + (i - 9) * 3}%;animation-delay:${-(i * .13)}s;height:${30 + (i * 7) % 25}%"></i>`).join(''),
    css: `i{position:absolute;bottom:0;width:5%;border-radius:50% 50% 30% 30%;background:radial-gradient(50% 80% at 50% 100%,#fff6c8,var(--c) 40%,transparent 70%);filter:blur(4px);transform-origin:bottom;animation:fx-flame .45s ease-in-out infinite alternate;mix-blend-mode:screen;opacity:var(--a)}` });
  atm('reflect', 'Floor reflection', '🪞', { c: '#ffffff', tip: 'Pictures and logos reflect on a glossy floor.', html: () => '<i></i>', css: `i{position:absolute;left:0;right:0;bottom:0;height:22%;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.4))}`, scene: 'sd-reflect' });
  atm('crowd', 'Crowd silhouettes', '👥', { c: '#05060a', tip: 'A dark crowd along the bottom edge.', front: true, html: () => { const r = rng(11); let s = ''; for (let x = -20; x < W0 + 40; x += 34 + r() * 20) { const h = 70 + r() * 60; s += `<g class="h" style="animation-delay:${(-r() * 2).toFixed(2)}s"><circle cx="${x.toFixed(0)}" cy="${(H0 - h).toFixed(0)}" r="${(16 + r() * 6).toFixed(0)}"/><rect x="${(x - 26).toFixed(0)}" y="${(H0 - h + 14).toFixed(0)}" width="52" height="${h}" rx="18"/>${r() < .15 ? `<rect x="${(x + 10).toFixed(0)}" y="${(H0 - h - 70).toFixed(0)}" width="10" height="70" rx="5"/>` : ''}</g>`; } return `<svg width="${W0}" height="${H0}">${s}</svg>`; },
    css: `svg{position:absolute;inset:0} .h{fill:var(--c);animation:fx-cheer 1.6s ease-in-out infinite}` });
  atm('flashes', 'Camera flashes', '📷', { c: '#ffffff', tip: 'Random flashes like a crowd taking photos.', front: true, html: () => range(16, i => `<i style="left:${(i * 37) % 100}%;top:${60 + (i * 53) % 38}%;animation-delay:${-(i * 1.3) % 7}s;animation-duration:${5 + i % 4}s"></i>`).join(''),
    css: `i{position:absolute;width:30px;height:30px;border-radius:50%;background:radial-gradient(#fff,var(--cA) 40%,transparent 70%);opacity:0;animation:fx-camflash 6s steps(1) infinite}` });
  atm('tickerstrip', 'Ticker strip', '📰', { c: '#ff5a1f', tip: 'A scrolling strip with the event name.', front: true, html: () => '<div class="tk"><span></span><span></span></div>',
    css: `.tk{position:absolute;left:0;right:0;bottom:0;height:46px;background:rgba(0,0,0,.7);border-top:3px solid var(--c);overflow:hidden;white-space:nowrap;display:flex} span{flex:none;font:700 24px/46px 'Chakra Petch',sans-serif;letter-spacing:.15em;color:#fff;padding-right:80px;animation:fx-tick 20s linear infinite;text-transform:uppercase}`,
    paint: (n, S) => n.querySelectorAll('span').forEach(s => { s.textContent = `${S.event || ''}  ◆  ${S.round || ''}  ◆  ${S.bestOfText || ''}  ◆  `.repeat(3); }) });
  atm('poll', 'Prediction bar', '📊', { c: '#ff5a1f', tip: 'A chat vote for who will win. Type the numbers into the custom fields poll1 and poll2.', front: true, html: () => '<div class="pb"><b class="a"></b><b class="b"></b><small class="x"></small><small class="y"></small></div>',
    css: `.pb{position:absolute;left:30%;right:30%;bottom:9%;height:24px;border-radius:12px;overflow:hidden;background:#222;display:flex} .a{background:var(--c);transition:width .8s} .b{flex:1;background:#36a3ff} small{position:absolute;top:28px;font:700 18px 'Chakra Petch',sans-serif;color:#fff} .x{left:0} .y{right:0}`,
    paint: (n, S) => { const c = S.custom || {}, a = Number(c.poll1) || 0, b = Number(c.poll2) || 0, t = a + b, p = t ? a / t * 100 : 50; n.querySelector('.a').style.width = p + '%'; n.querySelector('.x').textContent = t ? Math.round(p) + '%' : ''; n.querySelector('.y').textContent = t ? Math.round(100 - p) + '%' : ''; n.querySelector('.pb').style.display = t ? '' : 'none'; } });
  atm('drift', 'Slow camera drift', '🎥', { c: '#ffffff', tip: 'The whole screen drifts gently while it stays up.', scene: 'sd-drift' });
  // used by Top 8 and other screens too
  atm('lasers', 'Laser beams', '🟥', { c: '#ff2a6d', tip: 'Crossing laser lines sweep behind everything.', html: () => range(8, i => `<i style="left:${10 + i * 11}%;animation-delay:${-i * .6}s"></i>`).join(''), css: `i{position:absolute;bottom:-5%;width:3px;height:120%;background:linear-gradient(transparent,var(--c),#fff);transform-origin:bottom;box-shadow:0 0 10px var(--c);animation:fx-laser 4s ease-in-out infinite alternate;opacity:calc(.6*var(--a))}` });
  atm('ledfloor', 'LED floor', '🟦', { c: '#2fd1ff', tip: 'A glowing tiled floor.', html: () => '<i></i>', css: `i{position:absolute;left:-20%;right:-20%;bottom:-8%;height:40%;background:linear-gradient(var(--cB) 3px,transparent 3px) 0 0/80px 40px,linear-gradient(90deg,var(--cB) 3px,transparent 3px) 0 0/80px 40px;filter:drop-shadow(0 0 6px var(--c));transform:perspective(600px) rotateX(60deg);transform-origin:bottom;animation:fx-floor 2s linear infinite;-webkit-mask:linear-gradient(transparent,#000);mask:linear-gradient(transparent,#000)}` });
  atm('truss', 'Lighting truss', '🎛️', { c: '#ffd27a', tip: 'A stage lighting rig along the top with coloured lamps.', html: () => `<i class="bar"></i>${range(10, i => `<b style="left:${6 + i * 9.6}%;background:${['var(--c)', '#ff2fd6', '#36e6ff'][i % 3]};animation-delay:${-i * .4}s"></b>`).join('')}`,
    css: `.bar{position:absolute;left:0;right:0;top:0;height:22px;background:repeating-linear-gradient(45deg,#666 0 3px,#222 3px 14px)} b{position:absolute;top:22px;width:26px;height:26px;border-radius:0 0 50% 50%;box-shadow:0 30px 80px 20px currentColor;animation:fx-flick 4s steps(1) infinite}` });
  atm('rainglass', 'Rain on glass', '🌧️', { c: '#cfe6ff', tip: 'Rain runs down the screen as if through a window.', front: true, html: () => range(40, i => `<i style="left:${(i * 41) % 100}%;animation-delay:${-(i * .7) % 9}s;animation-duration:${5 + i % 6}s"></i>`).join(''),
    css: `i{position:absolute;top:-5%;width:6px;height:9px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff,var(--cA));box-shadow:0 0 2px rgba(255,255,255,.5);animation:fx-glassrain 7s ease-in infinite}` });
  atm('golddust', 'Gold dust', '✨', { c: '#f6c453', tip: 'Gold particles drift across the screen.', html: () => flakes(50, 'g', i => `width:${2 + i % 3}px;height:${2 + i % 3}px`), css: `.g{position:absolute;top:-2%;border-radius:50%;background:var(--c);box-shadow:0 0 6px var(--c);animation:fx-fall 11s linear infinite}` , paint: n => { if (n.classList.contains('fx-gfx')) return; if (!n.isConnected) { setTimeout(() => { if (n.isConnected && !n.classList.contains('fx-gfx')) gfx(n, 'golddust'); }, 0); return; } gfx(n, 'golddust'); } });
  // ---- 1.12: Victory Splash backgrounds. Everything moves by transform and opacity only (no blur or filter is animated),
  // so the graphics card composites them and they cost next to nothing, even on a weak laptop.
  atm('vspot', 'Arena spotlights', '🔦', { c: '#ffe7a3', cat: 'Victory', tip: 'Four arena spotlights sweep over a hazy stage and come to rest on the winner.',
    html: () => '<u class="haze"></u><u class="pool"></u>' + range(4, i => `<i style="left:${[6, 30, 58, 82][i]}%;animation-delay:${-i * 2.3}s;animation-duration:${7 + i}s"></i>`).join(''),
    css: `u{position:absolute;pointer-events:none} .haze{inset:0;background:radial-gradient(70% 45% at 50% 62%,var(--cA),transparent 70%),linear-gradient(180deg,transparent 40%,rgba(0,0,0,.35))}
      .pool{left:22%;right:22%;bottom:4%;height:30%;border-radius:50%;background:radial-gradient(closest-side,var(--cB),transparent);animation:fx-vpool 4s ease-in-out infinite alternate;opacity:calc(.7*var(--a))}
      i{position:absolute;top:-12%;width:520px;height:135%;margin-left:-260px;transform-origin:50% 0;background:linear-gradient(180deg,var(--cB),var(--cA) 45%,transparent 92%);clip-path:polygon(47% 0,53% 0,100% 100%,0 100%);-webkit-mask:linear-gradient(90deg,transparent,#000 35%,#000 65%,transparent);mask:linear-gradient(90deg,transparent,#000 35%,#000 65%,transparent);animation:fx-vsweep 8s ease-in-out infinite alternate;opacity:calc(.5*var(--a));will-change:transform}` });
  atm('vticker', 'Ticker-tape', '🎊', { c: '#f6c453', cat: 'Victory', tip: 'Gold and white ticker-tape flutters down from the rafters.',
    html: () => range(90, i => `<i style="left:${(i * 37) % 100}%;width:${8 + i % 3 * 3}px;height:${18 + i % 4 * 5}px;background:${['var(--c)', '#fff6e0', 'var(--c)', '#ffb36b'][i % 4]};animation-delay:${-((i * 53) % 90) / 10}s;animation-duration:${6 + (i * 7) % 5}s"><b style="animation-duration:${.7 + (i % 5) * .18}s"></b></i>`).join(''),
    css: `i{position:absolute;top:-4%;animation:fx-vfall 8s linear infinite;will-change:transform} i b{position:absolute;inset:0;background:inherit;animation:fx-vflip .9s ease-in-out infinite alternate;opacity:calc(.9*var(--a))}` });
  atm('vshards', 'Glass shards', '💠', { c: '#f6c453', cat: 'Victory', tip: 'Shards of glass in the colour you pick (gold to start) drift up slowly, turning, catching the light.',
    html: () => range(18, i => { const s = 40 + (i * 29) % 90, pts = ['50% 0,100% 40%,70% 100%,0 70%', '0 0,100% 20%,60% 100%', '20% 0,100% 0,80% 100%,0 60%', '50% 0,100% 100%,0 80%'][i % 4];
      return `<i style="left:${(i * 53) % 96}%;width:${s}px;height:${s * 1.3}px;clip-path:polygon(${pts});animation-delay:${-((i * 31) % 140) / 10}s;animation-duration:${12 + (i * 5) % 8}s"><b style="animation-delay:${-(i % 6) * .7}s"></b></i>`; }).join(''),
    css: `i{position:absolute;bottom:-20%;background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(255,255,255,0) 40%,rgba(0,0,0,.45) 75%,rgba(0,0,0,0)),var(--c);opacity:calc(.55*var(--a));animation:fx-vrise 14s linear infinite;will-change:transform}
      i b{position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.95) 50%,transparent 65%);animation:fx-vglint 4.2s ease-in-out infinite;opacity:0}` });
  atm('vfireworks', 'Fireworks', '🎆', { c: '#ffd27a', cat: 'Victory', tip: 'Gold fireworks burst high behind the winner, one after another.',
    html: () => range(5, k => `<s style="left:${[18, 74, 40, 86, 8][k]}%;top:${[22, 18, 10, 46, 52][k]}%;animation-delay:${k * .75}s;--fc:${['var(--c)', '#fff6e0', '#ffb36b', 'var(--c)', '#ff8a3d'][k]}"><u></u>${range(30, i => `<i style="transform:rotate(${i * 360 / 22}deg)"><b style="animation-delay:${k * .75}s"></b></i>`).join('')}</s>`).join(''),
    css: `s{position:absolute;width:0;height:0} s i{position:absolute;left:0;top:0;width:0;height:0} s b{position:absolute;left:0;top:-2.5px;width:46px;height:5px;border-radius:5px;background:linear-gradient(90deg,transparent,var(--fc) 70%,#fff);opacity:0;animation:fx-vspark 3.75s cubic-bezier(.15,.7,.3,1) infinite;will-change:transform,opacity}
      s u{position:absolute;left:-120px;top:-120px;width:240px;height:240px;border-radius:50%;background:radial-gradient(closest-side,var(--fc),transparent);opacity:0;animation:fx-vflash 3.75s ease-out infinite;animation-delay:inherit}` });
  atm('vaurora', 'Ember aurora', '🌌', { c: '#f6c453', cat: 'Victory', tip: 'Curtains of gold and ember light ripple slowly across the top of the sky.',
    html: () => range(4, i => `<i style="left:${-10 + i * 26}%;animation-delay:${-i * 3.5}s;animation-duration:${14 + i * 3}s;--ac:${['var(--c)', '#ff8a3d', '#fff0c8', 'var(--c)'][i]}"></i>`).join(''),
    css: `i{position:absolute;top:-6%;width:48%;height:62%;background:repeating-linear-gradient(90deg,transparent 0 14px,var(--ac) 14px 18px,transparent 18px 34px),linear-gradient(180deg,transparent,var(--ac) 35%,transparent 90%);
      -webkit-mask:radial-gradient(60% 50% at 50% 45%,#000 20%,transparent 70%);mask:radial-gradient(60% 50% at 50% 45%,#000 20%,transparent 70%);opacity:calc(.32*var(--a));transform-origin:50% 0;animation:fx-vwave 16s ease-in-out infinite alternate;will-change:transform}` });
  atm('streamers', 'Streamers', '🎏', { c: '#ff5a5a', tip: 'Long ribbon streamers hang and sway from the top.', html: () => range(14, i => `<i style="left:${i * 7.3}%;background:${['var(--c)', '#ffd23a', '#5ad1ff', '#7dff8a'][i % 4]};animation-delay:${-i * .3}s;height:${20 + (i * 13) % 30}%"></i>`).join(''), css: `i{position:absolute;top:0;width:10px;border-radius:0 0 6px 6px;transform-origin:top;animation:fx-sway 2.6s ease-in-out infinite alternate}` });
  atm('replayframe', 'Replay frame', '⏺️', { c: '#ff2a2a', tip: 'A REPLAY border with a blinking red dot.', front: true, html: () => '<b>● REPLAY</b>', css: `{box-shadow:inset 0 0 0 10px var(--cB)} b{position:absolute;right:50px;top:40px;font:800 34px 'Chakra Petch',sans-serif;color:#fff;letter-spacing:.15em;animation:fx-flick 1s steps(1) infinite}` });
  atm('safearea', 'Phone safe-area guides', '📱', { c: '#39ff88', tip: 'Shows where phone viewers’ screens cut off (only in the designer preview).', front: true, editOnly: true, html: () => '<i></i>', css: `i{position:absolute;left:656px;width:608px;top:0;bottom:0;border-left:2px dashed var(--c);border-right:2px dashed var(--c)}` });

  F._setAtmosCSS(() => acss.map(([id, css]) => { const sel = `.fxat.fxa-${id}`; return css.replace(/(^|\})\s*([^{}]*)\{/g, (m, close, part) => `${close}\n${part.trim() ? part.split(',').map(p => p.trim().startsWith('.on') ? `${sel}${p.trim()}` : `${sel} ${p.trim()}`).join(',') : sel}{`); }).join('\n')
    + `\n.fxat.fx-gfx.fxa-ash>*,.fxat.fx-gfx.fxa-golddust>*{display:none!important}\n.fxat{position:absolute;inset:0;pointer-events:none;overflow:hidden}.sd-drift{animation:fx-camdrift 18s ease-in-out infinite alternate}.sd-reflect .sd-k-logo,.sd-reflect .sd-k-avatar{-webkit-box-reflect:below 6px linear-gradient(transparent 55%,rgba(255,255,255,.3))}`);
  function buildAtmos(node, sc, S, opts = {}) {
    F.addCSS();
    node.querySelectorAll(':scope > .fxat').forEach(n => n.remove());
    node.classList.remove('sd-drift', 'sd-reflect');
    const list = [];
    for (const a of (sc.atmos || [])) {
      const d = AT[a.k]; if (!d || (d.editOnly && !opts.edit)) continue;
      if (d.scene) node.classList.add(d.scene);
      const n = document.createElement('div'); n.className = 'fxat fxa-' + a.k; F.vars(n, a.c || d.c, Number(a.amt) || 1);
      n.innerHTML = d.html(); if (d.front) n.style.zIndex = '40';
      const bg = node.querySelector(':scope > .sd-amb') || node.querySelector(':scope > .sd-sbg');
      if (d.front) node.appendChild(n); else if (bg) bg.after(n); else node.insertBefore(n, node.firstChild);
      list.push({ n, d });
    }
    node.__fxAt = list; paintAtmos(node, S);
  }
  function paintAtmos(node, S) { for (const { n, d } of node.__fxAt || []) if (d.paint) try { d.paint(n, S || {}); } catch (e) {} }

  // ================================================================== CSS for moves
  F._addMoveCSS(`
.fxov{position:absolute;pointer-events:none;z-index:60;overflow:visible}
.fx-press .pl{position:absolute;left:-4%;right:-4%;height:40%;background:linear-gradient(#5b606b,#2a2d33);box-shadow:0 0 0 2px #15171b}
.fx-press .t{top:0;animation:fx-plateT .9s ease forwards}.fx-press .b{bottom:0;animation:fx-plateB .9s ease forwards}
@keyframes fx-plateT{0%{transform:translateY(-140%)}40%{transform:translateY(-100%)}70%{transform:translateY(-100%)}100%{transform:translateY(-300%);opacity:0}}
@keyframes fx-plateB{0%{transform:translateY(140%)}40%{transform:translateY(100%)}70%{transform:translateY(100%)}100%{transform:translateY(300%);opacity:0}}
.fx-rope i{position:absolute;top:50%;height:4px;width:60%;background:repeating-linear-gradient(60deg,#c9a46a 0 4px,#8a6a3a 4px 8px);right:calc(100% - 4px);transform-origin:right;animation:fx-ropeSnap .9s ease-in forwards}
@keyframes fx-ropeSnap{0%,70%{transform:scaleX(1)}100%{transform:scaleX(0) translateY(-30px) rotate(-20deg);opacity:0}}
.fx-zip i{position:absolute;top:40%;width:16px;height:20%;border-radius:4px;background:linear-gradient(#eee,#888);left:50%;box-shadow:0 0 8px #fff}
.fx-zip i:first-child{animation:fx-zipL .65s ease-in-out forwards}.fx-zip i:last-child{animation:fx-zipR .65s ease-in-out forwards}
@keyframes fx-zipL{to{left:-2%;opacity:0}}@keyframes fx-zipR{to{left:100%;opacity:0}}
.fx-blueprint{background:linear-gradient(rgba(80,170,255,.35) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(80,170,255,.35) 1px,transparent 1px) 0 0/16px 16px;animation:fx-fadeOut 1s .3s ease forwards}
@keyframes fx-fadeOut{to{opacity:0}}
.fx-impact b,.fx-impact i,.fx-impact u{position:absolute;left:var(--px);top:var(--py);border-radius:50%;pointer-events:none}
.fx-impact b{width:220px;height:220px;margin:-110px;background:radial-gradient(circle,#fff 0,rgba(255,255,255,.85) 8%,rgba(255,244,214,.35) 30%,rgba(255,240,200,0) 62%);animation:fx-impFlash .55s ease-out forwards}
.fx-impact i{width:40px;height:40px;margin:-20px;border:2px solid rgba(255,250,235,.85);box-shadow:0 0 14px rgba(255,240,200,.7);animation:fx-impRing .7s cubic-bezier(.15,.8,.3,1) forwards}
.fx-impact i+i{border-width:1px;animation-duration:1s;animation-delay:.06s;opacity:0}
.fx-impact u{width:6px;height:6px;margin:-3px;background:#fff;box-shadow:0 0 18px 6px rgba(255,248,225,.9);animation:fx-impDot .9s ease-out forwards}
@keyframes fx-impFlash{0%{transform:scale(.2);opacity:1}35%{opacity:1}100%{transform:scale(1.6);opacity:0}}
@keyframes fx-impRing{0%{transform:scale(.3);opacity:1}100%{transform:scale(9);opacity:0}}
@keyframes fx-impDot{0%{opacity:1}100%{opacity:0;transform:scale(.4)}}
.fx-ripple i{position:absolute;left:10%;right:10%;bottom:-10px;height:20px;border-radius:50%;border:2px solid rgba(160,220,255,.7);animation:fx-ripple 1.2s ease-out forwards}.fx-ripple i+i{animation-delay:.3s}
@keyframes fx-ripple{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}
.fx-portal i{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;border:4px solid var(--c);box-shadow:0 0 20px var(--c),inset 0 0 20px var(--c);animation:fx-portal 1s ease-out forwards}
@keyframes fx-portal{0%{transform:scale(0)}50%{transform:scale(22) rotate(180deg);opacity:1}100%{transform:scale(30);opacity:0}}
.fx-smokeburst i{position:absolute;top:20%;width:30%;height:80%;border-radius:50%;background:radial-gradient(rgba(220,220,230,.8),transparent 70%);filter:blur(8px);animation:fx-smokeB 1.1s ease-out forwards}
@keyframes fx-smokeB{from{transform:scale(.3);opacity:.9}to{transform:scale(2) translateY(-30%);opacity:0}}
.fx-boltov svg{position:absolute;left:30%;width:40%;top:-200%;height:300%;overflow:visible}.fx-boltov path{fill:none;stroke:#fff;stroke-width:3;filter:drop-shadow(0 0 6px var(--c)) drop-shadow(0 0 16px var(--c));animation:fx-fadeOut .5s .15s forwards}
.fx-dust i{position:absolute;bottom:0;width:12%;height:60%;border-radius:50%;background:radial-gradient(rgba(200,180,150,.7),transparent 70%);filter:blur(5px);animation:fx-dustP 1.2s ease-out forwards}
@keyframes fx-dustP{from{transform:translateY(0) scale(.4);opacity:.9}to{transform:translate(30px,-80%) scale(1.8);opacity:0}}
.fx-ribbon i{position:absolute;left:-6%;right:-6%;top:40%;height:20%;background:linear-gradient(90deg,var(--c3),var(--c),var(--c2),var(--c));box-shadow:0 2px 6px rgba(0,0,0,.5);transform-origin:left;animation:fx-ribbon 1.3s ease-out forwards}
@keyframes fx-ribbon{0%{transform:scaleX(0) skewY(-8deg)}50%{transform:scaleX(1) skewY(4deg)}75%{transform:scaleX(1) skewY(0)}100%{transform:scaleX(1);opacity:0}}
.fx-platform i{position:absolute;left:-5%;right:-5%;bottom:-8px;height:8px;border-radius:4px;background:linear-gradient(90deg,transparent,var(--c),transparent);box-shadow:0 0 20px var(--c);animation:fx-fadeOut 1.2s .6s forwards}
.fx-train i{position:absolute;top:10%;bottom:10%;left:-60%;width:60%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),var(--c),transparent);filter:blur(12px);animation:fx-train .6s linear forwards}
@keyframes fx-train{to{left:110%}}
.fx-sketch{background:repeating-linear-gradient(45deg,rgba(255,255,255,.15) 0 1px,transparent 1px 6px);animation:fx-fadeOut 1s .5s forwards}
.fx-curtains i{position:absolute;top:0;bottom:0;width:51%;background:repeating-linear-gradient(90deg,#7a0d17 0 30px,#a8162a 30px 60px);box-shadow:0 0 30px #000}
.fx-curtains .l{left:0;animation:fx-curL 1.2s ease-in-out forwards}.fx-curtains .r{right:0;animation:fx-curR 1.2s ease-in-out forwards}
.fx-curtains.out .l{animation:fx-curLc 1.4s ease-in-out forwards}.fx-curtains.out .r{animation:fx-curRc 1.4s ease-in-out forwards}
@keyframes fx-curL{to{transform:translateX(-100%)}}@keyframes fx-curR{to{transform:translateX(100%)}}
@keyframes fx-curLc{0%{transform:translateX(-100%)}50%,70%{transform:none}100%{transform:translateX(-100%)}}@keyframes fx-curRc{0%{transform:translateX(100%)}50%,70%{transform:none}100%{transform:translateX(100%)}}
.fx-doors i{position:absolute;top:0;bottom:0;width:51%;background:linear-gradient(90deg,#3a3f48,#5c626e,#2a2e35);box-shadow:inset 0 0 0 3px #1c1f24}
.fx-doors .l{left:0;animation:fx-curL .8s .2s cubic-bezier(.6,0,.2,1) forwards}.fx-doors .r{right:0;animation:fx-curR .8s .2s cubic-bezier(.6,0,.2,1) forwards}
.fx-count b{position:absolute;left:50%;top:50%;font:900 italic min(260px,calc(var(--h)*1.6))/1 'Saira Condensed',Impact,sans-serif;color:#fff;text-shadow:0 0 30px var(--c);transform:translate(-50%,-50%) scale(0);opacity:0;animation:fx-countN .7s ease-out forwards}
.fx-count b:nth-child(2){animation-delay:.7s}.fx-count b:nth-child(3){animation-delay:1.4s}
@keyframes fx-countN{0%{transform:translate(-50%,-50%) scale(2.2);opacity:0}20%{transform:translate(-50%,-50%) scale(1);opacity:1}80%{opacity:1}100%{transform:translate(-50%,-50%) scale(.8);opacity:0}}
.fx-stamp b{position:absolute;left:50%;top:50%;white-space:nowrap;font:900 italic min(200px,calc(var(--h)*1.2))/1 'Saira Condensed',Impact,sans-serif;color:#fff;-webkit-text-stroke:6px var(--c3);paint-order:stroke fill;transform:translate(-50%,-50%) rotate(-8deg);animation:fx-stampIn 1.6s cubic-bezier(.2,.9,.3,1.3) forwards}
.fx-stamp.gg b{font-size:min(140px,calc(var(--h)*1.1));color:var(--c2)}
@keyframes fx-stampIn{0%{transform:translate(-50%,-50%) rotate(-8deg) scale(3);opacity:0}25%{transform:translate(-50%,-50%) rotate(-8deg) scale(1);opacity:1}80%{opacity:1}100%{opacity:0}}
.fx-clash i{position:absolute;top:46%;height:8%;width:0;background:linear-gradient(90deg,transparent,var(--c),#fff);box-shadow:0 0 30px var(--c);animation:fx-beam .7s ease-in forwards}.fx-clash .l{left:0}.fx-clash .r{right:0;transform:scaleX(-1);transform-origin:center}
.fx-clash b{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;background:#fff;box-shadow:0 0 60px 30px var(--c);opacity:0;animation:fx-clashB .9s .6s ease-out forwards}
@keyframes fx-beam{to{width:50%}}@keyframes fx-clashB{0%{opacity:1;transform:scale(.5)}100%{opacity:0;transform:scale(8)}}
.fx-flashes i{position:absolute;width:60px;height:60px;border-radius:50%;background:radial-gradient(#fff,transparent 70%);opacity:0;animation:fx-pop1 .3s ease-out forwards}
@keyframes fx-pop1{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(2)}}
.fx-search i{position:absolute;top:-40%;width:40%;height:180%;background:linear-gradient(180deg,rgba(255,250,220,.55),transparent 80%);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);mix-blend-mode:screen;filter:blur(6px);transform-origin:50% 0}
.fx-search .a{left:5%;animation:fx-searchA 1.6s ease-in-out forwards}.fx-search .b{right:5%;animation:fx-searchB 1.6s ease-in-out forwards}
@keyframes fx-searchA{0%{transform:rotate(-40deg)}50%{transform:rotate(30deg)}100%{transform:rotate(-8deg);opacity:0}}@keyframes fx-searchB{0%{transform:rotate(40deg)}50%{transform:rotate(-30deg)}100%{transform:rotate(8deg);opacity:0}}
.fx-bump b{position:absolute;top:50%;font-size:min(160px,calc(var(--h)*1));line-height:1;transform:translateY(-50%)}.fx-bump .l{right:50%;animation:fx-bumpL 1s ease-in forwards}.fx-bump .r{left:50%;animation:fx-bumpR 1s ease-in forwards}
@keyframes fx-bumpL{0%{transform:translate(-120%,-50%)}50%{transform:translate(0,-50%)}100%{transform:translate(-30%,-50%);opacity:0}}@keyframes fx-bumpR{0%{transform:translate(120%,-50%)}50%{transform:translate(0,-50%)}100%{transform:translate(30%,-50%);opacity:0}}
.fx-coin b{position:absolute;left:50%;top:50%;width:min(150px,calc(var(--h)*.9));height:min(150px,calc(var(--h)*.9));margin:calc(min(150px,calc(var(--h)*.9))/-2);border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6d0,#f6c453 50%,#9a6510);box-shadow:0 0 30px rgba(246,196,83,.7);animation:fx-coin 1.3s ease-out forwards}
@keyframes fx-coin{0%{transform:translateY(200px) rotateX(0)}50%{transform:translateY(-200px) rotateX(1080deg)}90%{transform:translateY(0) rotateX(1800deg);opacity:1}100%{transform:rotateX(1800deg);opacity:0}}
.fx-sweepov{overflow:hidden}.fx-sweepov i{position:absolute;top:-10%;bottom:-10%;width:30%;left:-40%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.7),transparent);animation:fx-sweepI .8s .1s ease-out forwards}
@keyframes fx-sweepI{to{left:120%}}
.fx-black{z-index:70}
.fx-shutter i{position:absolute;left:0;right:0;height:51%;background:repeating-linear-gradient(0deg,#4a4f58 0 16px,#30343b 16px 20px)}
.fx-shutter .t{top:0;animation:fx-shutT 1.6s ease-in-out forwards}.fx-shutter .b{bottom:0;animation:fx-shutB 1.6s ease-in-out forwards}
@keyframes fx-shutT{0%{transform:translateY(-100%)}40%,60%{transform:none}100%{transform:translateY(-100%)}}@keyframes fx-shutB{0%{transform:translateY(100%)}40%,60%{transform:none}100%{transform:translateY(100%)}}
.fx-plane b{position:absolute;top:40%;left:-10%;font-size:120px;animation:fx-plane 1.2s ease-in-out forwards}
@keyframes fx-plane{0%{transform:translate(0,0) rotate(10deg)}100%{transform:translate(2200px,-200px) rotate(-10deg)}}
.fx-stinger i{position:absolute;inset:0;background:linear-gradient(100deg,transparent 40%,var(--c) 40% 60%,transparent 60%);background-size:300% 100%;animation:fx-sting 1.5s ease-in-out forwards}
.fx-stinger b{position:absolute;top:50%;left:50%;font-size:220px;transform:translate(-50%,-50%) scale(0);animation:fx-stingB 1.5s ease-in-out forwards}
@keyframes fx-sting{0%{background-position:100% 0}100%{background-position:-50% 0}}@keyframes fx-stingB{0%{transform:translate(-50%,-50%) scale(0) rotate(-90deg)}40%,60%{transform:translate(-50%,-50%) scale(1) rotate(0)}100%{transform:translate(-50%,-50%) scale(0) rotate(90deg)}}
.fx-inkc{z-index:70}
.fx-piston i{position:absolute;top:30%;height:40%;width:30%;background:linear-gradient(#ddd,#777);border-radius:4px;box-shadow:0 0 0 2px #333;left:calc(50% + var(--d)*45%);animation:fx-piston .6s ease-out forwards}
@keyframes fx-piston{0%{transform:scaleX(0);transform-origin:left}25%{transform:translateX(calc(var(--d)*40px))}100%{transform:none;opacity:0}}
.fx-chain i{position:absolute;top:46%;height:8%;width:50%;background:repeating-linear-gradient(90deg,#c9ced8 0 10px,transparent 10px 12px,#8a8f99 12px 22px,transparent 22px 24px)}
.fx-chain .l{left:0;animation:fx-chainL 1.1s ease-in forwards}.fx-chain .r{right:0;animation:fx-chainR 1.1s ease-in forwards}
@keyframes fx-chainL{0%,15%{transform:none}100%{transform:translate(-20px,90px) rotate(-30deg);opacity:0}}@keyframes fx-chainR{0%,15%{transform:none}100%{transform:translate(20px,90px) rotate(30deg);opacity:0}}
.fx-tape b{position:absolute;top:100%;left:calc(50% - var(--h)*.25);width:calc(var(--h)*.5);padding:calc(var(--h)*.05) 0 calc(var(--h)*.3);background:#f8f4e8;color:#222;font:700 calc(var(--h)*.3) 'Chakra Petch',monospace;text-align:center;transform-origin:top;animation:fx-tape 1.8s ease-out forwards;box-shadow:0 2px 6px rgba(0,0,0,.4)}
@keyframes fx-tape{0%{transform:scaleY(0)}30%{transform:scaleY(1)}70%{transform:scaleY(1) rotate(calc(var(--d)*6deg))}100%{transform:scaleY(1) translateY(60px) rotate(calc(var(--d)*20deg));opacity:0}}
.fx-medal b,.fx-crown b{position:absolute;left:50%;top:-45%;font-size:max(30px,calc(var(--h)*.7));line-height:1;transform:translateX(-50%)}
.fx-medal b{transform-origin:50% -40px;animation:fx-medal 2.6s ease-out forwards}.fx-crown b{animation:fx-crownD 2.6s ease-out forwards}
@keyframes fx-medal{0%{transform:translateX(-50%) translateY(-120px) rotate(30deg)}25%{transform:translateX(-50%) rotate(-16deg)}45%{transform:translateX(-50%) rotate(8deg)}65%{transform:translateX(-50%) rotate(-3deg)}85%{opacity:1}100%{transform:translateX(-50%);opacity:0}}
@keyframes fx-crownD{0%{transform:translateX(-50%) translateY(-200px)}30%{transform:translateX(-50%) translateY(10px)}40%{transform:translateX(-50%)}85%{opacity:1}100%{opacity:0}}
.fx-lstamp b{position:absolute;left:50%;top:50%;font:900 max(30px,calc(var(--h)*.62))/1 'Saira Condensed',sans-serif;color:#ff2a2a;border:max(3px,calc(var(--h)*.05)) solid #ff2a2a;background:rgba(0,0,0,.35);padding:0 16px;transform:translate(-50%,-50%) rotate(-12deg);animation:fx-stampIn 1.5s cubic-bezier(.2,.9,.3,1.3) forwards}
.fx-alarm{overflow:hidden}.fx-alarm i{position:absolute;top:0;bottom:0;width:35%;left:-40%;background:linear-gradient(90deg,transparent,rgba(255,30,30,.7),transparent);animation:fx-sweepI 1.1s ease-in-out forwards}
.fx-tracer i{position:absolute;top:48%;height:4%;width:30%;left:calc(50% + var(--d)*10%);background:linear-gradient(90deg,transparent,var(--c),#fff);box-shadow:0 0 12px var(--c);transform:scaleX(var(--d));animation:fx-tracer .5s ease-in forwards}
@keyframes fx-tracer{to{left:calc(50% + var(--d)*160%);opacity:0}}
.fx-freezeov{overflow:hidden}.fx-freezeov i{position:absolute;inset:0;background:${F.turb('.06', 3, '0 0 0 0 .85  0 0 0 0 .95  0 0 0 0 1  0 0 0 1.6 -.5')};clip-path:inset(0 100% 0 0);animation:fx-freezeS 2.6s ease-out forwards}
@keyframes fx-freezeS{0%{clip-path:inset(0 100% 0 0)}40%{clip-path:inset(0 0 0 0);opacity:1}100%{opacity:0}}
.fx-confetti i{position:absolute;top:100%;width:12px;height:7px;animation:fx-conf 3s cubic-bezier(.2,.6,.4,1) forwards}
@keyframes fx-conf{0%{transform:translate(0,0) rotate(0)}40%{transform:translate(var(--x),var(--y)) rotate(var(--r))}100%{transform:translate(calc(var(--x)*1.2),20vh) rotate(calc(var(--r)*2));opacity:0}}
@keyframes fx-thunder{0%,88%,92%,100%{filter:none}89%,91%{filter:brightness(2.6)}}
@keyframes fx-thunder2{0%,90%,93%,100%{opacity:0}91%{opacity:.35}92%{opacity:.08}}
@keyframes fx-rain{from{transform:translateY(0) rotate(12deg)}to{transform:translateY(1250px) rotate(12deg)}}
@keyframes fx-burn{to{filter:brightness(1.25);transform:scaleY(1.04)}}
@keyframes fx-fall{0%{transform:translate(0,0)}100%{transform:translate(60px,1120px) rotate(360deg)}}
@keyframes fx-vsweep{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes fx-vpool{from{transform:scale(.92);opacity:calc(.45*var(--a))}to{transform:scale(1.04);opacity:calc(.8*var(--a))}}
@keyframes fx-vfall{0%{transform:translate3d(0,0,0) rotate(0)}100%{transform:translate3d(90px,1150px,0) rotate(540deg)}}
@keyframes fx-vflip{from{transform:scaleX(1)}to{transform:scaleX(.1)}}
@keyframes fx-vrise{0%{transform:translate3d(0,0,0) rotate(-20deg)}100%{transform:translate3d(-60px,-1400px,0) rotate(200deg)}}
@keyframes fx-vglint{0%,70%{opacity:0;transform:translateX(-60%)}85%{opacity:.9}100%{opacity:0;transform:translateX(60%)}}
@keyframes fx-vspark{0%{transform:translateX(0) scaleX(.2);opacity:0}6%{opacity:1}55%{transform:translateX(150px) scaleX(1);opacity:.9}80%,100%{transform:translateX(175px) translateY(30px) scaleX(.3);opacity:0}}
@keyframes fx-vflash{0%{opacity:0;transform:scale(.3)}5%{opacity:.55}40%,100%{opacity:0;transform:scale(1.4)}}
@keyframes fx-vwave{0%{transform:translate3d(-8%,0,0) skewX(-14deg) scaleY(.85)}100%{transform:translate3d(8%,3%,0) skewX(12deg) scaleY(1.12)}}
@keyframes fx-sakura{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-320px,1120px) rotate(720deg)}}
@keyframes fx-fog{to{transform:translateX(18%)}}
@keyframes fx-speed{to{transform:rotate(1.5deg)}}
@keyframes fx-torch{to{transform:scale(1.08);opacity:.8}}
@keyframes fx-sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
@keyframes fx-rise{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(-40px,-1100px);opacity:0}}
@keyframes fx-ropes{to{transform:translateY(6px)}}
@keyframes fx-spot{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}
@keyframes fx-bokeh{to{transform:translate(40px,-30px) scale(1.2)}}
@keyframes fx-lensdrift{0%{-webkit-mask-position:10% 20%;mask-position:10% 20%}50%{-webkit-mask-position:60% 70%;mask-position:60% 70%}100%{-webkit-mask-position:95% 15%;mask-position:95% 15%}}
@keyframes fx-lensglint{0%,86%,100%{filter:none}91%{filter:brightness(2.4)}}
@keyframes fx-throb{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.06)}}
@keyframes fx-orb{to{transform:translate(20px,-40px) scale(1.15)}}
@keyframes fx-cheer{0%,100%{transform:none}50%{transform:translateY(-6px)}}
@keyframes fx-camflash{0%,96%,100%{opacity:0}97%{opacity:1}}
@keyframes fx-tick{to{transform:translateX(-100%)}}
@keyframes fx-camdrift{from{transform:scale(1)}to{transform:scale(1.04) translate(-12px,-6px)}}
@keyframes fx-laser{from{transform:rotate(-30deg)}to{transform:rotate(30deg)}}
@keyframes fx-floor{to{background-position:0 40px,0 0}}
@keyframes fx-glassrain{0%{transform:translateY(0)}60%{transform:translateY(500px)}100%{transform:translateY(1150px)}}
html.sb-potato .fxov,html.sb-potato .fxat *{animation:none!important}
html.sb-light .fxat i,html.sb-light .fxat b{animation-duration:0s!important}
`);

  // gallery categories
  const setCat = (map, groups) => { for (const [c, ids] of Object.entries(groups)) for (const id of ids.split(' ')) if (map[id]) map[id].cat = c; };
  setCat(RE, { 'Hits & points': 'recoil tug piston chain tape wince tracer heatflare jelly wave beat stretch splitjoin', 'Winning & losing': 'peel sink medal crown ribbonwrap gg confetti screenflash screenshake', 'Match moments': 'lstamp alarm finalpulse push freezeover rewindreset dustoff flipname' });
  setCat(TX, { 'Letter by letter': 'morse magnet domino drop rise wave hop splitrev spinletters tumble firetrail sparkle bubble scatterin slot', 'Whole word': 'brush credits outline rubber freezein inkbleed smokeform pixelbuild accordion laser nametrade elastic jelly heartbeat glint etch meltdown eraser signature chromatic typo lightning tear shadowslide centersweep unfold neonbuzz', 'Numbers': 'odometer scoredrop scoresplit tally countup' });
  setCat(AT, { Scenery: 'temple neoncity dojo volcano space ropes arcade mirrors hexcage ledfloor truss', 'Weather & particles': 'storm splitbolt ash sakura thunder fog rainglass golddust weathersplit fireice streamers', Victory: 'vspot vticker vshards vfireworks vaurora', Light: 'spotlights flare bokeh lasers orbs auraflames magnet runes speedlines', 'Film & screen': 'crt vhs grain vignette thermal halftone screentone torn replayframe safearea drift reflect', 'Frames & info': 'posters cards chartag roundbanner belt losersred bigvs crowd flashes tickerstrip poll' });
  F.buildAtmos = buildAtmos; F.paintAtmos = paintAtmos;
})();
