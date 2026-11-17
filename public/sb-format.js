/*
 * BeeboScore game formats on stream — drawn in the style of the layout they're on (Shattered: obsidian glass,
 * ember, gold, cracks · Oni: white gi paper, gold lettering, blood red, ink).
 *
 *   <meta name="sb-format" content="crew | sajam | gauntlet | death | koth | league">
 *        a format version of a layout (the app serves these: Shattered — Crew Battle, Oni — Death Battle…).
 *        Each format has its own pieces:
 *          · on the player bars: lives (Death Battle), the crown and streak (King of the Hill), stock, tier, stage, record…
 *          · the format bar along the bottom (crews, tiers, the ladder, survivors, the challenger queue, standings).
 *            Show / hide it any time: state.fbar (Format tab, Stream Deck, the OBS dock).
 *          · its own VS screen for every match (instead of the normal VS Splash).
 *          · its moments: knockouts, lives lost, eliminations, the tiebreaker, the final duel, a new king…
 *   <meta name="sb-format" content="splash">   only the full-screen format splashes (board, Team VS, champion)
 *   (older pages: "teams" and "death" still work)
 *
 * Reads state.format (raw) + state.fv (the view from lib/format.js). Each change bumps format.seq and lists what
 * happened in format.events. Full-screen splashes: state.splash.show = 'fvs' | 'fboard' | 'fwin'.
 */
(function () {
  'use strict';
  if (window.__SB_FORMAT_LOADED) return; window.__SB_FORMAT_LOADED = true;
  const meta = document.querySelector('meta[name="sb-format"]');
  if (!meta) return;
  const MODE = (meta.content || 'splash').toLowerCase(), FULL = MODE !== 'splash';
  // the ten elemental layouts (Frostbite, Venom, Royal…) draw formats in their own style: public/el/formats.js (window.EL_FMT)
  const ELID = ((document.querySelector('meta[name="el-theme"]') || {}).content || '').trim(), ELF = ELID && window.EL_FMT ? window.EL_FMT[ELID] || null : null;
  const LOOK = (document.querySelector('meta[name="sb-look"]') || document.querySelector('meta[name="sb-sound"]') || {}).content || '';   // sb-sound: layouts made before 2.0.0
  const THEME = ELF ? 'el' : LOOK.toLowerCase() === 'oni' ? 'oni' : 'shattered';
  const PORC = !ELF && LOOK.toLowerCase() === 'porcelain';  // Porcelain — white glaze; drawn the light way (1.12.4: white, gold and black)
  const OBS = !ELF && LOOK.toLowerCase() === 'shattered';
  const PLAIN = !ELF && LOOK.toLowerCase() === 'default';    // 1.12.5: the Default layout — the app's Classic colours, no particles, simple moves   // 1.12.4: Shattered is Obsidian Glass — black glass with a violet-to-teal sheen
  // 1.12.4: each look re-colours the shared drawing: Obsidian Glass turns the ember into its violet sheen, Porcelain turns
  // Oni's red into gold and its ink into black (applied to the format CSS and to the colours the script draws with)
  const TONES = {
    // 1.12.8: Obsidian Glass is black and antique gold — the ember oranges turn gold; the warm golds of the cards, the champion and the lock-in stay gold
    obs: [['#ff5a1f', '#e0a93b'], ['rgba(255,90,31,', 'rgba(224,169,59,'], ['rgba(255,140,60,', 'rgba(224,169,59,'], ['rgba(255,140,80,', 'rgba(224,169,59,'], ['#ffb36b', '#f8e2a6'], ['#ffd0a0', '#fff0c6'],
      ['#a3180a', '#6e4a0e'], ['#ff6a2a', '#e0a93b'], ['#ff3b14', '#c98f26'], ['#8a5a12', '#6e4a0e']],
    porc: [['#b3060f', '#a07a12'], ['rgba(179,6,15,', 'rgba(160,122,18,'], ['#ff5a3c', '#e4c766'], ['#5a0006', '#4a3708'], ['#141210', '#0b0b0d'], ['rgba(20,18,16,', 'rgba(11,11,13,'],
      ['#e9c35e', '#d4af37'], ['#c9a13b', '#b8901f'], ['#ff3b14', '#d4af37'], ['#fdfbf6', '#ffffff'], ['#efe9dd', '#f6f5f1'], ['#d8cfbf', '#e2ded5'], ['#5f574b', '#2a2a2e'], ['#8f8574', '#6d6a63']],
  };
  TONES.plain = [['#ff5a1f', '#e9c35e'], ['rgba(255,90,31,', 'rgba(233,195,94,'], ['rgba(255,140,60,', 'rgba(233,195,94,'], ['rgba(255,140,80,', 'rgba(233,195,94,'], ['#ffb36b', '#f3d98c'], ['#ffd0a0', '#fff3cc'],
    ['#a3180a', '#8a6a12'], ['#ff6a2a', '#e9c35e'], ['#ff3b14', '#e9c35e'], ['#17181d', '#1c2030'], ['#0b0c0f', '#151822'], ['#050507', '#10121a'], ['#8d919d', '#8b93a7']];
  const TONE = OBS ? TONES.obs : PORC ? TONES.porc : PLAIN ? TONES.plain : null;
  const tone = v => { if (!TONE || typeof v !== 'string') return v; let o = v; for (const [a, b] of TONE) o = o.split(a).join(b).split(a.toUpperCase()).join(b); return o; };
  const ONI = THEME === 'oni' || PORC || !!(ELF && ELF.light);      // light paper (Oni, Sakura, Pastel, Porcelain): dark lettering, darker team colours
  // team colours as text: on Oni's light paper a light team colour (sky blue) can't be read, so text gets a darker shade
  const darkFor = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return c; const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const L = (.2126 * r + .7152 * g + .0722 * b) / 255; if (L < .5) return '#' + m[1]; const k = .5 / L * .9; return '#' + [r, g, b].map(v => Math.round(v * k).toString(16).padStart(2, '0')).join(''); };
  // 1.12.21: …and on the dark looks a dark team colour (navy, black, deep purple) as lettering gets a lighter shade of itself
  const lightFor = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return c; const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const L = (.2126 * r + .7152 * g + .0722 * b) / 255; if (L >= .34) return '#' + m[1]; const t = (.46 - L) / (1 - L); return '#' + [r, g, b].map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join(''); };
  const tcv = c => { const e = String(c == null ? '' : c).replace(/[^#0-9a-zA-Z(),.%\s-]/g, ''); return `--tc:${e};--tct:${ONI ? darkFor(e) : lightFor(e)}${/^#[0-9a-f]{6}$/i.test(e) ? `;--tcw:${e}${ONI ? '3a' : '55'}` : ''}`; };   // --tcw (1.12.6): a wash of the colour for the cards
  const POTATO = () => document.documentElement.classList.contains('sb-potato') || !!window.__SB_POTATO;
  // 1.12.21: Less movement (Settings › Accessibility) — a format's moments fade: no sparks, embers, rings, shakes, flashes, shards or slashes
  const CALM = () => document.documentElement.classList.contains('sb-calm');
  const W = 1920, H = 1080;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$';
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'ST' : n % 10 === 2 && n % 100 !== 12 ? 'ND' : n % 10 === 3 && n % 100 !== 13 ? 'RD' : 'TH');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && !!String(a || '').trim();
  // the look: every colour comes from here
  const T = { ...(ONI
    ? { acc: '#b3060f', hot: '#e9c35e', gold: '#c9a13b', goldHi: '#fff3cc', blood: '#b3060f', spark: '#e9c35e', spark2: '#ff3b14', ink: '#141210', two: '#1d5fa8' }
    : { acc: '#ff5a1f', hot: '#ffb36b', gold: '#f6c453', goldHi: '#fff4cf', blood: '#c3132d', spark: '#ffb36b', spark2: '#ff5a1f', ink: '#ffffff', two: '#7fd0ff' }),
    ...(PORC ? { acc: '#b8901f', hot: '#e9cf7a', gold: '#c8a032', goldHi: '#fff4cc', blood: '#c3132d', spark: '#e4c766', spark2: '#b8901f', ink: '#0b0b0d', two: '#2a2a2e' } : {}),
    ...(OBS ? { acc: '#e0a93b', hot: '#f8e2a6', gold: '#ffe2a1', goldHi: '#fff6de', blood: '#c3132d', spark: '#f0c766', spark2: '#e0a93b', ink: '#ffffff', two: '#a8814a' } : {}), ...((ELF && ELF.T) || {}) };   // two (1.12.8): bronze — a second side that white lettering still reads on
  const BLOOD = T.blood;
  // the app's own icons (public/beebo-icons.js, loaded with every layout), in colour
  // 1.12.9: a long name can wrap onto two lines where it reads naturally — between words, before a capital (RamenRush·TheUnbeatable) or a number
  const wbr = n => esc(n).replace(/([a-z])([A-Z0-9])/g, '$1<wbr>$2').replace(/([_\-.])/g, '$1<wbr>');
  const ICON = n => (window.BI && window.BI.html(n, { color: true })) || esc({ crown: '♛', star: '★' }[n] || '');

  if (!document.querySelector('style[data-sb-format-fonts]')) {
    const l = document.createElement('style'); l.dataset.sbFormatFonts = '1';
    l.textContent = [['Chakra Petch', 600, 'chakra-petch-latin-600-normal'], ['Chakra Petch', 700, 'chakra-petch-latin-700-normal'], ['Saira Condensed', 700, 'saira-condensed-latin-700-normal'], ['Saira Condensed', 800, 'saira-condensed-latin-800-normal']]
      .map(([f, w, file]) => `@font-face{font-family:'${f}';font-weight:${w};font-display:swap;src:url(/static/fonts/${file}.woff2) format('woff2')}`).join('\n');
    document.head.appendChild(l);
  }

  // ===================================================================================== styles
  // names: line-height and padding leave room for accents (Å É Ñ) and the italic slant, so letters are never cut off
  const VARS = ONI
    ? `--p1:#fdfbf6;--p2:#efe9dd;--p3:#d8cfbf;--ink:#141210;--sub:#5f574b;--muted:#8f8574;--acc:#b3060f;--hot:#e9c35e;--gold:#c9a13b;--gold-hi:#fff3cc;--blood:#b3060f;--line:rgba(20,18,16,.22);--glass:rgba(253,251,246,.94);
       --name:linear-gradient(180deg,#fff3cc 0%,#e9c35e 42%,#b0841f 70%,#6b4a0c 100%);--namefx:drop-shadow(0 2px 0 rgba(20,18,16,.85));--shadow:0 6px 18px rgba(20,18,16,.28)`
    : `--p1:#17181d;--p2:#0b0c0f;--p3:#050507;--ink:#ffffff;--sub:#d9dce4;--muted:#8d919d;--acc:#ff5a1f;--hot:#ffb36b;--gold:#f6c453;--gold-hi:#fff4cf;--blood:#c3132d;--line:rgba(255,255,255,.08);--glass:rgba(5,5,7,.9);
       --name:linear-gradient(180deg,#fff 0%,#e9ebf0 40%,#8f939d 52%,#d9dce3 76%,#fff 100%);--namefx:drop-shadow(0 3px 0 rgba(0,0,0,.75));--shadow:0 6px 22px rgba(0,0,0,.55)`;
  const VARS2 = VARS + (ELF ? ';' + ELF.vars : '') + (PORC ? `;--p1:#ffffff;--p2:#f6f5f1;--p3:#e2ded5;--ink:#0b0b0d;--sub:#2a2a2e;--muted:#6d6a63;--acc:#b8901f;--hot:#e9cf7a;--gold:#c8a032;--gold-hi:#fff4cc;--blood:#c3132d;--line:rgba(11,11,13,.55);--glass:rgba(255,255,255,.95);
       --name:linear-gradient(180deg,#d9b54a 0%,#b8901f 55%,#7a5c0e 100%);--namefx:drop-shadow(0 2px 0 rgba(11,11,13,.85));--shadow:0 6px 18px rgba(11,11,13,.22)` : '')
    + (OBS ? `;--p1:#1f1d18;--p2:#100f0c;--p3:#050507;--sub:#ece4d2;--muted:#8f8878;--acc:#e0a93b;--hot:#f8e2a6;--gold:#ffe2a1;--gold-hi:#fff6de;--line:rgba(240,199,102,.14);--glass:rgba(6,5,10,.9);
       --name:linear-gradient(180deg,#fff 0%,#f4eedf 40%,#ab9f84 52%,#ebe3cf 76%,#fff 100%)` : '');
  const css = `
#sbf,#sbf-sp,#sbf-vs,.sbf-band,.sp-tb,.sbf-stamp,.sbf-count,.sbf-lv-slot,.sbf-l2,.sbf-frag,.sbf-tag{${VARS2}}
#sbf{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:60;font-family:'Chakra Petch',sans-serif;color:var(--sub)}
#sbf *,#sbf-vs *,#sbf-sp *{box-sizing:border-box;margin:0}
#sbf-fx{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:9500}
.sbf-nm{font:800 20px/1.18 'Saira Condensed',sans-serif;font-style:italic;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:.12em .18em .04em .04em;margin:-.12em -.1em -.04em -.04em}
/* ---------- on the player bars ---------- */
.sbf-tag{position:absolute;z-index:40;display:flex;align-items:center;gap:10px;padding:5px 12px;background:rgba(8,8,12,.86);border-radius:4px;opacity:0;transform:translateY(-6px);transition:opacity .3s,transform .3s;pointer-events:none}.sbf-tag.on{opacity:1;transform:none}.sbf-tag .sbf-lv{display:inline-flex}
.sbf-l2{display:inline-flex;align-items:center;gap:7px;color:var(--acc);font:700 12px/14px 'Chakra Petch',sans-serif;letter-spacing:2.4px;text-transform:uppercase;white-space:nowrap}
.sbf-l2 b{color:var(--ink);font-weight:700}.sbf-l2 i{font-style:normal;color:var(--muted)}
.sbf-l2 .tc{display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:var(--tc,var(--acc));box-shadow:0 0 0 1px rgba(128,128,128,.55),0 0 8px var(--tc,var(--acc))}   /* 1.12.21: a hairline round the team's colour chip, so a navy chip on black glass (or a cream one on porcelain) is still a chip */
.sbf-lv{display:inline-flex;gap:4px;align-items:center;flex:none;padding:0 2px}
.sbf-lv i{display:inline-block;width:15px;height:24px;flex:none;position:relative;background:linear-gradient(180deg,#ff6a7c,var(--blood) 55%,#5c0710);
  clip-path:polygon(50% 0,100% 28%,82% 100%,18% 100%,0 28%);filter:drop-shadow(0 0 6px var(--blood));transition:opacity .3s,transform .3s}
.sbf-lv i::after{content:'';position:absolute;left:30%;top:10%;width:22%;height:40%;background:rgba(255,255,255,.65);clip-path:polygon(0 30%,100% 0,60% 100%)}
.sbf-lv i.gone{background:${ONI ? '#cfc6b6' : '#2a1215'};filter:none;opacity:.55}.sbf-lv i.gone::after{display:none}
.sbf-lv.lg i{width:18px;height:28px}
.sbf-lv .crn{width:30px;height:24px;filter:drop-shadow(0 0 8px var(--gold))}
.plate.sbf-lastlife .sbf-lv i:not(.gone){animation:sbf-beat 1.1s ease-in-out infinite}
@keyframes sbf-beat{0%,100%{transform:scale(1)}12%{transform:scale(1.28)}24%{transform:scale(1)}36%{transform:scale(1.18)}}
.plate.sbf-lastlife .skin::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 2px var(--blood),inset 0 0 40px rgba(195,19,45,.45);opacity:0;animation:sbf-lastop2 1.1s ease-in-out infinite;will-change:opacity}
@keyframes sbf-lastop2{0%,50%,100%{opacity:0}12%,36%{opacity:1}24%{opacity:.4}}   /* 1.12.6: opacity only */
.plate.sbf-king .skin{box-shadow:inset 0 0 0 1.5px var(--gold),inset 0 0 26px rgba(246,196,83,.35)}
/* ---------- the format bar along the bottom ---------- */
#sbf-bar{position:absolute;left:24px;right:24px;bottom:10px;height:72px;transition:transform .55s cubic-bezier(.2,.8,.3,1),opacity .4s}
#sbf-bar.off{transform:translateY(110px);opacity:0}
#sbf-bar .bl,#sbf-bar .br{position:absolute;bottom:0;height:40px;display:flex;gap:4px;align-items:stretch}
#sbf-bar .bl{left:0;right:calc(50% + 226px)}#sbf-bar .br{right:0;left:calc(50% + 226px);flex-direction:row-reverse}
#sbf-bar .bc{position:absolute;left:50%;bottom:0;width:420px;height:72px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  background:linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb3,var(--p3)));border-top:2px solid var(--acc);box-shadow:var(--shadow);clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 100%,0 100%);overflow:hidden}
#sbf-bar.tc2 .bc small{color:${ONI ? 'var(--ink)' : '#fff'}!important;opacity:.85}#sbf-bar.tc2 .bc{background:var(--bcg),linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb3,var(--p3)));border-top-color:transparent}
#sbf-bar.tc2 .bc::after{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--bca),var(--bca) 30%,#fff 50%,var(--bcb) 70%,var(--bcb))}
#sbf-bar .bc::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 120% at 50% -30%,${ONI ? 'rgba(179,6,15,.18)' : 'rgba(255,90,31,.32)'},transparent 70%);pointer-events:none}
#sbf-bar .bc small{position:relative;font:700 11px/1 'Chakra Petch';letter-spacing:3.5px;color:var(--acc);text-transform:uppercase;white-space:nowrap}
#sbf-bar .bc b{position:relative;font:800 32px/1.1 'Saira Condensed';font-style:italic;letter-spacing:1px;color:var(--ink);text-transform:uppercase;white-space:nowrap;display:flex;align-items:center;gap:12px;padding:0 .15em}
#sbf-bar .bc b .tag{font-size:18px;color:var(--tct,var(--tc));letter-spacing:1px;max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:.15em;flex:0 1 auto;min-width:0}
#sbf-bar .bc b{max-width:calc(100% - 40px);box-sizing:border-box}   /* 1.12.21: the box's sides slant in toward the top — a wide row (Team Death Battle: crests, 12 – 12 and two long team names) ran under them, and the first letters were cut */
#sbf-bar .bc em{position:relative;font:600 10px/1 'Chakra Petch';font-style:normal;letter-spacing:2.6px;color:var(--muted);text-transform:uppercase;white-space:nowrap}
.sbf-pips{display:inline-flex;gap:5px}.sbf-pips i{width:12px;height:12px;transform:rotate(45deg);border:1.5px solid ${ONI ? '#8f8574' : '#5d616c'};background:${ONI ? '#efe9dd' : '#0b0c0f'};display:inline-block;transition:background .3s,border-color .3s,box-shadow .3s}
.sbf-pips i.on{background:var(--tc,var(--acc));border-color:${ONI ? '#141210' : '#fff'};box-shadow:0 0 10px var(--tc,var(--acc))}
.it{position:relative;flex:0 1 210px;min-width:0;height:40px;display:flex;align-items:center;gap:6px;padding:0 12px 0 16px;background:linear-gradient(90deg,var(--tcw,transparent),transparent 70%),linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb2,var(--p2)));
  clip-path:polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%);transition:transform .3s cubic-bezier(.2,.8,.3,1),opacity .3s,filter .3s,flex-basis .4s}
.br .it{clip-path:polygon(0 0,calc(100% - 9px) 0,100% 100%,9px 100%);flex-direction:row-reverse;padding:0 16px 0 12px;background:linear-gradient(270deg,var(--tcw,transparent),transparent 70%),linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb2,var(--p2)))}
.it::before{content:'';position:absolute;inset:0;border:1px solid var(--line);clip-path:inherit;pointer-events:none}
.it .ed{position:absolute;left:0;top:0;bottom:0;width:14px;background:var(--tc,var(--acc));opacity:.35;clip-path:polygon(9px 0,14px 0,5px 100%,0 100%)}
.br .it .ed{left:auto;right:0;clip-path:polygon(0 0,5px 0,14px 100%,9px 100%)}
.it .k{font:700 10px/1 'Chakra Petch';color:var(--muted);letter-spacing:1px;flex:none}
.it .sbf-nm{flex:1;min-width:0;font-size:18px;color:var(--sub);text-align:center}.br .it .sbf-nm{text-align:center}
#sbf-bar.dense .it .sbf-nm{font-size:15px}#sbf-bar.dense .td-card .sbf-nm{font-size:15px}#sbf-bar.xdense .td-card .sbf-nm{font-size:12.5px}#sbf-bar.dense .it.td.team{min-width:86px}#sbf-bar.dense .it{padding:0 8px 0 13px;gap:4px}#sbf-bar.dense .br .it{padding:0 13px 0 8px}#sbf-bar.xdense .it .sbf-nm{font-size:13px}#sbf-bar.dense .it .k{display:none}#sbf-bar.dense .bc{width:360px}#sbf-bar.dense .bc b{gap:8px;max-width:322px}#sbf-bar.dense .bc b .tag{max-width:92px;font-size:16px}#sbf-bar.dense .bl{right:calc(50% + 186px)}#sbf-bar.dense .br{left:calc(50% + 186px)}
.td-card .sbf-nm{max-width:100%}
.it .x{font:800 14px/1 'Saira Condensed';font-style:italic;color:${PORC ? '#836312' : 'var(--hot)'};flex:none;${ONI ? '' : 'text-shadow:0 0 8px var(--acc)'}}   /* (1.12.21: Porcelain — a record or a streak in deep gold; the pale gold was 1.5 : 1 on its white pieces) */
.it .sbf-lv{gap:2px;flex:none}.it .sbf-lv i{width:8px;height:13px}
.it.team{flex:0 0 auto;max-width:170px;background:linear-gradient(180deg,${ONI ? '#2a2620,#141210' : 'var(--p1),var(--p3)'});padding-right:18px}
.it.team .tlg{height:30px;width:auto;max-width:46px;object-fit:contain;flex:none}.it.team .sbf-nm{color:${ONI ? '#fdfbf6' : '#fff'};font-size:20px}.it.team .ed{opacity:1}.it.team .x{color:var(--tct,var(--tc));text-shadow:none;font-size:18px}
.it.playing{transform:translateY(-6px);background:linear-gradient(90deg,var(--tcw,transparent),transparent 75%),linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#2a2015,#120c08'})}.it.playing .ed{opacity:1}.it.playing .sbf-nm{color:var(--ink)}
/* the glint moves (a transform), it isn't repainted across the piece every frame */
.it.playing::after{content:'';position:absolute;top:0;bottom:0;left:0;width:100%;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-100%);will-change:transform;animation:sbf-glint 2.6s ease-in-out infinite;pointer-events:none}
@keyframes sbf-glint{0%,40%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.it.next .ed{animation:sbf-next 1.4s ease-in-out infinite;opacity:.9}@keyframes sbf-next{50%{opacity:.2}}
.it.next .k{color:var(--tct,var(--tc,var(--acc)))}
.it.out{opacity:.62;filter:saturate(.15) brightness(${ONI ? '.92' : '.6'});flex-basis:104px}.it.out .sbf-nm{text-decoration:line-through;text-decoration-color:var(--acc)}
.it .skull{width:16px;height:16px;flex:none}
.it.king{flex:0 0 auto;max-width:300px;background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3a2c10,#160f04'})}.it.king .sbf-nm{color:${ONI ? '#141210' : '#fff4cf'};font-size:21px}.it.king .x{color:var(--gold);font-size:20px}
/* 1.12.6: the king's card — a size up, a gold rim and a glow round it; every ten wins in a row it burns hotter (×10, ×20, ×30…).
   Everything that moves is transform / opacity, so it costs the compositor, not the page. */
#sbf-bar .kw{position:relative;flex:0 0 auto;display:flex;align-self:flex-end;height:50px;--kc:var(--gold);--kh:${ONI ? '#fff3cc' : '#fff4cf'}}
#sbf-bar .kw .it.king{flex:1 1 auto;height:auto;min-width:230px;max-width:340px;padding:0 18px 0 22px;gap:8px;z-index:1}
#sbf-bar .kw .it.king .sbf-nm{font-size:25px}#sbf-bar .kw .it.king .x{font-size:24px;color:${ONI ? '#5a3c08' : 'var(--gold)'};text-shadow:none}#sbf-bar .kw .it.king .crn{width:30px;height:24px;flex:none}
.kw .kg{position:absolute;inset:-5px -6px;border-radius:6px;box-shadow:0 0 16px 3px var(--kc);opacity:.45;animation:sbf-kg 2.6s ease-in-out infinite;will-change:opacity;pointer-events:none}
.kw .kb{position:absolute;inset:-2px -3px;clip-path:polygon(11px 0,100% 0,calc(100% - 11px) 100%,0 100%);background:linear-gradient(180deg,var(--kh),var(--kc) 45%,${ONI ? '#8a5e10' : '#8a5a12'});overflow:hidden;pointer-events:none}
.kw .kb i{position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(90deg,transparent,#fff,transparent);transform:translateX(-110%);opacity:0;will-change:transform}
.kw .kf{position:absolute;left:8px;right:8px;bottom:100%;height:30px;display:flex;justify-content:space-around;align-items:flex-end;pointer-events:none;opacity:0}
.kw .kf i{width:16%;height:100%;clip-path:polygon(50% 0,62% 30%,82% 62%,100% 100%,0 100%,18% 62%,38% 30%);background:linear-gradient(0deg,#fff 0,var(--kh) 22%,var(--kc) 55%,transparent 100%);transform-origin:50% 100%;transform:scaleY(.4);animation:sbf-flick 1.1s ease-in-out infinite alternate;will-change:transform}
.kw .kf i:nth-child(2){animation-delay:-.35s;animation-duration:.9s}.kw .kf i:nth-child(3){animation-delay:-.7s;animation-duration:1.25s}.kw .kf i:nth-child(4){animation-delay:-.2s;animation-duration:1s}.kw .kf i:nth-child(5){animation-delay:-.55s}
.kw .kp{position:absolute;inset:0;pointer-events:none;opacity:0}
.kw .kp i{position:absolute;bottom:60%;width:4px;height:4px;border-radius:50%;background:var(--kh);box-shadow:0 0 6px var(--kc);animation:sbf-rise 1.8s linear infinite;will-change:transform,opacity}
.kw .kp i:nth-child(1){left:12%}.kw .kp i:nth-child(2){left:34%;animation-delay:-.6s}.kw .kp i:nth-child(3){left:56%;animation-delay:-1.1s}.kw .kp i:nth-child(4){left:78%;animation-delay:-.3s}.kw .kp i:nth-child(5){left:90%;animation-delay:-1.4s}
@keyframes sbf-kg{50%{opacity:.85}}
@keyframes sbf-sweep{0%{transform:translateX(-110%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(260%);opacity:0}}
@keyframes sbf-flick{0%{transform:scaleY(.45) scaleX(.9)}100%{transform:scaleY(1) scaleX(1.08)}}
@keyframes sbf-rise{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-62px);opacity:0}}
/* ×10: the rim catches a running light and the glow wakes up */
.kw.s1 .kg,.kw.s2 .kg,.kw.s3 .kg{opacity:.7;animation-duration:1.6s;box-shadow:0 0 22px 5px var(--kc)}
.kw.s1 .kb i,.kw.s2 .kb i,.kw.s3 .kb i{animation:sbf-sweep 2.4s cubic-bezier(.4,0,.2,1) infinite}
/* ×20: flames lick up over the card, hotter colours */
.kw.s2,.kw.s3{--kc:${ONI ? '#ff7a1a' : '#ff9a2e'}}
.kw.s2 .kf,.kw.s3 .kf{opacity:.9}.kw.s2 .kb i,.kw.s3 .kb i{animation-duration:1.6s}
/* ×30 and on: white-hot rim, taller flames, sparks rising; it keeps growing every ten */
.kw.s3{--kc:${ONI ? '#ff4a1a' : '#ff6a2e'};--kh:#ffffff}.kw.s3 .kf{height:calc(30px + var(--kn,3) * 6px)}.kw.s3 .kp{opacity:1}.kw.s3 .kg{animation-duration:1.1s;box-shadow:0 0 30px 7px var(--kc)}
#sbf-bar .kw .it.king.playing{transform:none;animation:none;height:auto;align-self:stretch}#sbf-bar .kw.on{animation:sbf-floatp 2.8s ease-in-out infinite;will-change:transform}#sbf-bar .kw.s3 .it.king,#sbf-bar .kw.s3 .it.king.playing{transform:scale(1.04);transform-origin:0 100%}
@media (prefers-reduced-motion:reduce){.kw .kg,.kw .kb i,.kw .kf i,.kw .kp i{animation:none}}
.it .crn{width:22px;height:18px;flex:none;filter:drop-shadow(0 0 6px var(--gold))}
.it.coach{background:linear-gradient(180deg,${ONI ? '#f6ecd0,#e6d7ae' : '#221c10,#0d0a05'})}.it.coach .k{color:var(--gold)}
.it.lit{filter:${ONI ? 'drop-shadow(0 0 3px var(--gold)) drop-shadow(0 0 12px var(--gold))' : 'brightness(1.6) drop-shadow(0 0 10px var(--gold))'}}   /* the last one standing. (1.12.21: on the light looks it glows without being brightened — brightened, a white piece washed out and its gold name turned pale yellow on white) */
.it.rank1{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3a2c10,#160f04'})}.it.rank1 .k{color:var(--gold)}
/* Team Death Battle: life crests, picture cards, the switch window */
.sbf-crs{display:inline-flex;gap:3px;align-items:center;flex:none}.sbf-cr{display:block;flex:none;overflow:visible}
.sbf-cr.full{filter:drop-shadow(0 0 5px var(--tc,var(--acc)))}.sbf-cr.gone{opacity:.7}
.sbf-lv-slot .sbf-crs,.sbf-tag .sbf-crs{gap:4px;margin:0 4px}
.sd-l2 .sbf-l2{font-size:1em;letter-spacing:.2em;gap:.5em}.sd-l2 .sbf-lv-in{display:inline-flex;align-items:center;margin-right:.4em}.sd-l2 .sbf-lv-in .sbf-crs{gap:4px;margin:0}.sd-l2 .sbf-lv-in .sbf-lv i{width:12px;height:19px}
/* 1.12.6: lives you can read — the count bigger, brighter and heavier than the rest of the line */
.sd-l2 .sbf-l2 b{font-size:1.32em;font-weight:800;letter-spacing:.1em;color:var(--ink);vertical-align:-.06em}.sd-win .sd-l2 .sbf-l2,.sd-win .sd-l2 .sbf-l2 b,.sd-win .sd-l2 .sbf-l2 i{color:var(--l2ink,inherit)}.sbf-tag .sbf-l2 b{font-size:1.2em;color:var(--ink)}
.sd-l2.sbf-has .sd-pro{display:none}
.sbf-pic{position:relative;display:block;overflow:hidden;flex:none}
.sbf-pic>*{transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1));transform-origin:50% 40%}
.it .sbf-pic.chip{width:28px;height:28px;border-radius:4px;margin:0 2px 0 -4px;background:rgba(0,0,0,.25)}.br .it .sbf-pic.chip{margin:0 -4px 0 2px}#sbf-bar.xdense .it .sbf-pic.chip{display:none}
.td-card .sbf-pic.fill{position:absolute;inset:0}.it.td.out .td-card .sbf-pic{filter:grayscale(1) brightness(.38)}
#sbf-vs .side .sbf-pic.vpic{width:300px;height:300px;margin-top:18px;overflow:visible}
#sbf-vs .side .sbf-pic.vpic::before{content:'';position:absolute;inset:8% 4% -4%;background:radial-gradient(closest-side,var(--tc,var(--acc)),transparent);opacity:.35}
#sbf-vs .side .sbf-pic.vpic>*{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.plate.sbf-lastlife .sbf-cr.full,.sbf-tag.sbf-lastlife .sbf-cr.full{animation:sbf-beat 1.6s ease-in-out infinite}
/* (1.3.6) the fighter playing: a bigger card that floats a little. It is wider in the layout (not scaled), so the bar
   makes room for it and nothing runs into the middle */
.it.td{transition:width .45s cubic-bezier(.2,.8,.25,1),opacity .3s,filter .3s}
.it.td .td-card{transition:height .45s cubic-bezier(.2,.8,.25,1),box-shadow .3s,background .45s}
.it.td.playing:not(.team){width:156px}.it.td.pics.playing:not(.team){width:124px}
.it.td.playing:not(.team) .td-card{height:66px}.it.td.pics.playing:not(.team) .td-card{height:124px}
.it.td.playing:not(.team) .td-card .sbf-nm{font-size:19px}
.it.td.playing:not(.team){animation:sbf-float 2.8s ease-in-out infinite}
@keyframes sbf-float{0%,100%{transform:translateY(-8px)}50%{transform:translateY(-12px)}}
.it.playing:not(.td){height:46px;align-self:flex-end;animation:sbf-floatp 2.8s ease-in-out infinite}
@keyframes sbf-floatp{0%,100%{transform:translateY(-6px)}50%{transform:translateY(-9px)}}
@media (prefers-reduced-motion:reduce){.it.td.playing,.it.playing{animation:none}}
/* (1.3.5) names in the middle of every piece and card on the bar */
.it .sbf-nm,.br .it .sbf-nm{text-align:center}
.td-card{align-items:center}.td-card .sbf-nm{text-align:center!important;align-self:stretch}.td-card .td-ch{text-align:center;align-self:stretch}
/* (1.3.5) last life: a heartbeat line runs along the fighter's bar, and their card's edge beats red */
.sbf-ecg{position:absolute;left:0;right:0;bottom:1px;height:15px;pointer-events:none;overflow:visible;z-index:6}
.sbf-ecg path{fill:none;stroke:var(--blood);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.sbf-ecg .tr{opacity:.28}
.sbf-ecg .run{stroke:${ONI ? '#e0102a' : '#ff6b7d'};stroke-width:2.6;stroke-dasharray:26 174;animation:sbf-ecg 1.6s linear infinite;filter:drop-shadow(0 0 4px var(--blood))}
@keyframes sbf-ecg{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}
.plate .sbf-ecg{left:8%;right:8%;bottom:2px;height:13px}
.td-card .sbf-ecg{bottom:3px;height:12px;left:6px;right:6px;width:auto;z-index:1}
/* 1.12.6: the last-life heartbeat on a card is a red edge that fades in and out (opacity only — the compositor does it), inside the card */
.it.td.lastlife .td-card::before{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2.5px var(--blood),inset 0 0 18px rgba(195,19,45,.55);opacity:0;z-index:2;pointer-events:none;animation:sbf-lastop 1.6s ease-in-out infinite;will-change:opacity}
@keyframes sbf-lastop{0%,40%,100%{opacity:0}8%,24%{opacity:1}16%{opacity:.35}}
.it.td.lastlife .td-lv .sbf-cr.full{animation:sbf-beat 1.6s ease-in-out infinite}
.it.lastlife:not(.td) .ed{background:var(--blood);opacity:1;animation:sbf-edbeat 1.6s ease-in-out infinite}
@keyframes sbf-edbeat{0%,40%,100%{opacity:.55}8%,24%{opacity:1}16%{opacity:.7}}
.it.lastlife:not(.td) .sbf-lv i:not(.gone){animation:sbf-beat 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sbf-ecg .run,.it.td.lastlife .td-card::before,.it.lastlife .ed{animation:none}}
.f-tdb #sbf-bar,.f-death #sbf-bar{height:126px}.f-tdb #sbf-bar .bl,.f-tdb #sbf-bar .br,.f-death #sbf-bar .bl,.f-death #sbf-bar .br{height:126px;align-items:flex-end;gap:8px}
.it.td{flex:0 1 132px;min-width:0;width:auto;height:auto;padding:0;background:none;clip-path:none;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;overflow:visible}
.it.td::before,.it.td .ed{display:none}.br .it.td{flex-direction:column;padding:0}
.it.td.pics{flex-basis:102px}
.cfx{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden;contain:strict;border-radius:inherit}
.cfx i{position:absolute;display:block}
.sbf-tw{position:absolute;inset:0;pointer-events:none;display:block}
.cfx .fl{width:120%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#fff,var(--c) 30%,transparent 65%);mix-blend-mode:screen}
.cfx .rg{width:150%;aspect-ratio:1;border-radius:50%;box-shadow:inset 0 0 0 3px var(--c),0 0 0 1px #fff}
.cfx .sp{width:12px;height:2px;margin:-1px 0 0 0;border-radius:2px;background:linear-gradient(90deg,var(--c),#fff);transform-origin:0 50%}
.td-lv{position:relative}
.td-lv{height:20px;display:flex;align-items:center;justify-content:center;padding:2px 5px;border-radius:10px;background:rgba(0,0,0,.55)}
.td-card{position:relative;width:100%;height:56px;border-radius:6px;overflow:hidden;background:linear-gradient(180deg,var(--tcw,transparent),transparent 78%),linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb2,var(--p2)));box-shadow:inset 0 0 0 1.5px var(--line);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 8px;transition:box-shadow .3s,transform .3s}
.it.td.pics .td-card{height:102px;padding:0;justify-content:flex-end}
.td-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 22%}
.td-card .sbf-pic.fill>*{object-fit:cover}
.td-card .sbf-nm{position:relative;z-index:1;font:800 17px/1.05 'Saira Condensed';font-style:italic;letter-spacing:.5px;color:var(--ink);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center!important}
.it.td.pics .td-card .sbf-nm{flex:none;align-self:stretch;font-size:14px;text-align:center!important;padding:10px 5px 6px;background:linear-gradient(0deg,rgba(0,0,0,.86),rgba(0,0,0,.6) 65%,transparent);color:#fff;text-shadow:0 1px 2px #000}   /* 1.12.6: the name along the foot of the card: the face stays in view */
.td-card .td-ch{position:relative;z-index:1;font:600 10px/1.2 'Chakra Petch';letter-spacing:1.4px;color:var(--muted);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.td-card::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--tc,var(--acc));opacity:.45}
.it.td.playing{transform:translateY(-8px)}.it.td.playing .td-card{box-shadow:inset 0 0 0 2.5px var(--tc,var(--acc)),0 0 7px var(--tc,var(--acc))}.it.td.playing .td-card::after{opacity:1;height:4px}
.it.td.playing::after{display:none}
.it.td.out{opacity:.78;filter:none}.it.td.out .td-card{background:linear-gradient(180deg,#1b1b20,#0c0c0f);box-shadow:inset 0 0 0 1.5px rgba(255,61,85,.45)}.it.td.out .td-card img{filter:grayscale(1) brightness(.38)}.it.td.out .td-card .sbf-nm,.it.td.out .td-ch{opacity:.55}.it.td.out .td-lv{opacity:.6}.it.td.out .sbf-nm{text-decoration:none}
.td-ko{position:absolute;left:0;right:0;bottom:8px;z-index:2;display:none;align-items:center;justify-content:center;gap:2px;padding:3px 0;background:rgba(0,0,0,.72);font:900 22px/1 'Saira Condensed';font-style:italic;color:#ff3d55;letter-spacing:1px;text-shadow:0 0 12px rgba(255,40,70,.8)}
.it.td.out .td-ko{display:flex}.td-ko .skull{width:20px;height:20px}.it.td:not(.pics) .td-ko{bottom:0;top:0}
.it.td.pics .td-ko{top:34%;bottom:auto}
.it.td.team{width:auto;min-width:104px;max-width:170px}.it.td.team .td-card{background:linear-gradient(180deg,${ONI ? '#2a2620,#141210' : 'var(--p1),var(--p3)'});align-items:center;justify-content:center}
.it.td.team .td-card{height:62px;gap:3px;padding:0 10px}
.it.td.team .td-card .sbf-nm{flex:none;align-self:stretch;line-height:1;padding-top:2px}
.it.td.team .td-lv.tl{height:28px;padding:2px 9px 2px 6px;border-radius:14px}.it.td.team .td-lv.tl b{font:800 22px/1 'Saira Condensed';font-style:italic;color:#fff;margin-left:5px;text-shadow:0 1px 3px #000}
.it.td.team.logo .td-card{height:88px;justify-content:space-between;padding:6px 8px 7px;gap:2px}.it.td.team.logo .td-card .sbf-nm{font-size:17px}
.it.td.team .tlogo{display:block;flex:0 1 auto;min-height:0;max-width:100%;max-height:38px;object-fit:contain;position:static;width:auto;height:auto}
.it.td.team .td-card::after{height:2px}.it.td.team .sbf-nm{color:${ONI ? '#fdfbf6' : '#fff'};font-size:22px;text-align:center!important}.it.td.team .td-ch{color:var(--tct,var(--tc))}
/* a crowded side (five or more a side, or a long queue): narrower pieces in equal widths, names smaller (two lines if they must),
   and what still doesn't fit is folded into a "+N" piece, so nothing ever runs into the middle block */
.it[hidden]{display:none!important}
#sbf-bar .fitting .it{transition:none!important}
.it.leaving{pointer-events:none}
.td-card{transition:box-shadow .3s,transform .3s,background .45s}.sbf-cr{transition:opacity .35s}
#sbf-bar .crowd{gap:3px}
.crowd .it{flex:1 1 0;min-width:0;padding:0 7px 0 13px;gap:4px}.br.crowd .it{padding:0 13px 0 7px}
.crowd .it.out{flex:.75 1 0}.crowd .it .k{font-size:9px;letter-spacing:.5px}.crowd .it .x{font-size:13px}
.crowd .it.team{flex:0 0 auto;max-width:132px;padding-right:13px}.br.crowd .it.team{padding:0 13px}
.it .sbf-nm.two{white-space:normal;font-size:12px;line-height:1.02;padding-top:.08em;padding-bottom:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.it.more{flex:0 0 auto!important;min-width:0;padding:0 12px!important;justify-content:center;background:linear-gradient(180deg,var(--p2),var(--p3))}
.it.more .sbf-nm{flex:none;color:var(--muted);font-size:17px;text-align:center!important}
.f-gauntlet .crowd .it{padding-left:16px}.f-gauntlet .br.crowd .it{padding:0 16px 0 9px}
.f-tdb #sbf-bar .crowd,.f-death #sbf-bar .crowd{gap:5px}.crowd .it.td{flex:0 0 auto;padding:0}.crowd .it.td.team,.br.crowd .it.td.team{min-width:84px;max-width:150px;padding:0}
.it.td.more{width:auto;align-self:flex-end;height:56px;padding:0 10px!important;border-radius:6px;background:linear-gradient(180deg,var(--fb1,var(--p1)),var(--fb2,var(--p2)));box-shadow:inset 0 0 0 1.5px var(--line)}
.it.td.more.pics{height:88px}
.crowd .it.td:not(.team) .td-ch{display:none}.crowd .it.td:not(.team):not(.pics) .td-card{padding:0 7px}
.crowd .it.td:not(.team) .td-card .sbf-nm{white-space:normal;line-height:1;display:-webkit-box;align-self:stretch;width:auto;max-width:none;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:normal;font-size:15px}
.crowd .it.td.pics:not(.team) .td-card .sbf-nm{font-size:13px;padding:9px 4px 5px}
#sbf-bar .bc em.sw{color:var(--tc,${PORC ? '#836312' : 'var(--hot)'});letter-spacing:1.9px;animation:sbf-sw 1s ease-in-out infinite}@keyframes sbf-sw{50%{opacity:.35}}
#sbf-bar .bc b .sbf-cr{width:20px;height:23px}
.sbf-slash{position:fixed;z-index:9460;pointer-events:none}
/* the gauntlet: a ladder of stages */
.f-gauntlet .it{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%);padding-left:20px}
.f-gauntlet .br .it{clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 50%,100% 100%,12px 100%,0 50%);padding:0 20px 0 12px}
.f-gauntlet .it .ed{display:none}.f-gauntlet .it.out{background:linear-gradient(180deg,${ONI ? '#d8cfbf,#cfc6b6' : '#0c0a0b,#040406'})}
/* death battle: blood */
.f-death #sbf-bar .bc,.f-death .bc{border-top-color:var(--blood)}
.f-death .bc small{color:var(--blood)!important}
/* KOTH: gold */
.f-koth .bc{border-top-color:var(--gold)!important}.f-koth .bc small{color:${ONI ? '#8a5e10' : 'var(--gold)'}!important}
/* league: a ticker */
.f-league .it{flex:0 1 170px}.f-league .it .k{font-size:14px;color:${PORC ? '#836312' : 'var(--acc)'};font-family:'Saira Condensed';font-weight:800}
/* ---------- bands (next challenger, eliminated, last stand…) ---------- */
.sbf-band{position:absolute;left:-10%;width:120%;height:150px;top:440px;display:flex;align-items:center;justify-content:center;transform:skewY(-4deg);
  background:linear-gradient(90deg,transparent,var(--glass) 15%,var(--glass) 85%,transparent);border-top:2px solid var(--bc,var(--acc));border-bottom:2px solid var(--bc,var(--acc));z-index:9400}
.sbf-band::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--bca) 50%,transparent);opacity:.7}
.sbf-band .in{position:relative;display:flex;align-items:center;gap:28px;transform:skewY(4deg)}
.sbf-band .t{font:700 18px/1 'Chakra Petch';letter-spacing:6px;color:var(--bc,var(--acc));text-transform:uppercase}
.sbf-band .n{font:800 86px/1.15 'Saira Condensed';font-style:italic;color:var(--ink);text-transform:uppercase;letter-spacing:1px;padding:0 .12em;text-shadow:0 0 30px var(--bcb)}
.sbf-band .s{font:600 16px/1 'Chakra Petch';letter-spacing:3px;color:var(--muted);text-transform:uppercase}
.sbf-vig{position:absolute;inset:0;pointer-events:none;z-index:9300;box-shadow:inset 0 0 220px 40px var(--vc,${BLOOD});opacity:0}
.sbf-ring{position:absolute;border-radius:50%;border:3px solid var(--rc,#ffb36b);box-shadow:0 0 18px var(--rc,#ff5a1f);pointer-events:none;transform:translate(-50%,-50%);z-index:9450}
.sbf-frag{position:absolute;pointer-events:none;z-index:9420;will-change:transform,opacity}
.sbf-stamp{position:absolute;z-index:9460;pointer-events:none;font:800 54px/1.15 'Saira Condensed';font-style:italic;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;padding:0 .2em;
  color:${ONI ? '#b3060f' : '#fff'};text-shadow:${ONI ? '0 2px 0 #141210,0 0 18px rgba(179,6,15,.5)' : '0 0 24px #c3132d,0 0 4px #c3132d'}}
.sbf-stamp small{display:block;font:700 13px/1 'Chakra Petch';letter-spacing:5px;color:var(--muted);font-style:normal;text-shadow:none}
.sbf-count{position:absolute;z-index:9460;pointer-events:none;font:800 120px/1.1 'Saira Condensed';font-style:italic;color:${ONI ? '#b3060f' : '#fff'};text-shadow:0 0 40px ${BLOOD}}
/* ---------- tiebreaker / final duel ---------- */
.sp-tb{position:absolute;inset:0;z-index:9350;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:${ONI ? 'rgba(253,251,246,.8)' : 'rgba(4,4,6,.72)'}}
.sp-tb .w{font:800 180px/1.12 'Saira Condensed';font-style:italic;letter-spacing:4px;padding:0 .14em;background:${ONI ? 'linear-gradient(180deg,#ff5a3c,#b3060f 55%,#5a0006)' : 'linear-gradient(180deg,#fff,#ffd0a0 45%,#ff5a1f)'};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 40px ${ONI ? 'rgba(179,6,15,.4)' : 'rgba(255,90,31,.6)'})}
.sp-tb .co{display:flex;gap:120px;font:800 64px/1.15 'Saira Condensed';font-style:italic;text-transform:uppercase;color:var(--ink)}
.sp-tb .co span small{display:block;font:700 14px/1 'Chakra Petch';letter-spacing:4px;font-style:normal;margin-bottom:8px;color:var(--c)}
.sp-tb svg{position:absolute;inset:0;width:100%;height:100%}
.sp-tb svg path{fill:none;stroke:${ONI ? '#141210' : '#fff'};stroke-width:2;opacity:.6;filter:drop-shadow(0 0 4px ${ONI ? '#b3060f' : '#ffb36b'})}
/* ---------- full-screen splashes (board, team VS, champion) ---------- */
#sbf-sp{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:9000;display:none;overflow:hidden;pointer-events:none;background:var(--p3);color:var(--ink);font-family:'Chakra Petch',sans-serif}
#sbf-sp.on{display:block}
#sbf-sp .bg{position:absolute;inset:0;background:${ONI
    ? 'radial-gradient(ellipse 70% 55% at 50% 115%,rgba(179,6,15,.16),transparent 70%),repeating-linear-gradient(45deg,rgba(20,18,16,.03) 0 2px,transparent 2px 9px),linear-gradient(180deg,#fdfbf6,#e7dfcf)'
    : 'radial-gradient(ellipse 70% 55% at 50% 115%,rgba(255,90,31,.22),transparent 70%),radial-gradient(ellipse 60% 50% at 50% -10%,rgba(255,255,255,.06),transparent 70%),linear-gradient(180deg,#0b0c0f,#040406)'}}
#sbf-sp .grain{position:absolute;inset:0;opacity:.08;background:repeating-linear-gradient(115deg,transparent 0 22px,${ONI ? 'rgba(20,18,16,.5)' : 'rgba(255,255,255,.5)'} 22px 23px,transparent 23px 60px)}
#sbf-sp .ttl{position:absolute;left:0;right:0;top:66px;text-align:center;font:800 64px/1.15 'Saira Condensed';font-style:italic;letter-spacing:2px;text-transform:uppercase}
#sbf-sp .ttl small{text-transform:uppercase;display:block;font:700 16px/1 'Chakra Petch';letter-spacing:6px;color:var(--acc);margin-bottom:10px;font-style:normal}
#sbf-sp .flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#fff,${ONI ? '#fff3cc 35%,rgba(179,6,15,.4) 75%' : '#ffd0a0 35%,rgba(255,90,31,.5) 75%'});opacity:0;z-index:20}
.sp-team{position:absolute;top:220px;width:760px;display:flex;flex-direction:column;gap:12px}
.sp-team.L{left:110px}.sp-team.R{right:110px;align-items:flex-end}
.sp-team h2 .sp-logo{height:64px;width:auto;max-width:120px;object-fit:contain;vertical-align:-14px;margin-right:16px}
.sp-team h2{font:800 54px/1.15 'Saira Condensed';font-style:italic;text-transform:uppercase;color:var(--ink);letter-spacing:1px;padding:0 .12em;text-shadow:0 0 30px var(--tcb)}
.sp-team h2 small{display:block;font:700 15px/1 'Chakra Petch';letter-spacing:4px;color:var(--tct,var(--tc));font-style:normal;margin-bottom:8px}
.sp-team.R h2{text-align:right}
/* (BeeboScore prototype build) a long team list (a Gauntlet's fifteen challengers): shorter cards so it stays on screen */
.sp-team.dense{gap:6px}.sp-team.dense .sp-card{height:52px}.sp-team.dense .sp-card .sbf-nm{font-size:24px}
.sp-team.denser{gap:4px}.sp-team.denser .sp-card{height:40px}.sp-team.denser .sp-card .sbf-nm{font-size:19px}.sp-team.denser .sp-card .k,.sp-team.denser .sp-card .meta{font-size:10px}
.sp-card{position:relative;width:620px;height:76px;display:flex;align-items:center;gap:16px;padding:0 26px;background:linear-gradient(90deg,var(--tcb,transparent),transparent 48%),linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(16px 0,100% 0,calc(100% - 16px) 100%,0 100%);box-shadow:var(--shadow)}
.sp-team.R .sp-card{background:linear-gradient(270deg,var(--tcb,transparent),transparent 48%),linear-gradient(180deg,var(--p1),var(--p2))}
/* 1.12.6: each team's colour behind its side and under its name */
.sp-team::before{content:'';position:absolute;inset:-60px -90px;background:radial-gradient(ellipse 60% 55% at 35% 45%,var(--tcb,transparent),transparent 72%);opacity:.75;pointer-events:none;z-index:-1}
.sp-team.R::before{background:radial-gradient(ellipse 60% 55% at 65% 45%,var(--tcb,transparent),transparent 72%)}
.sp-team h2::after{content:'';display:block;width:260px;height:5px;margin-top:6px;background:linear-gradient(90deg,var(--tc),transparent);border-radius:2px}
.sp-team.R h2::after{margin-left:auto;background:linear-gradient(270deg,var(--tc),transparent)}
.sp-team.R .sp-card{flex-direction:row-reverse;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 100%,16px 100%)}
.sp-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:24px;background:var(--tc);clip-path:polygon(16px 0,23px 0,7px 100%,0 100%)}.sp-team.R .sp-card::before{left:auto;right:0;clip-path:polygon(0 0,7px 0,23px 100%,16px 100%)}
.sp-card .k{font:700 14px/1 'Chakra Petch';color:var(--tct,var(--tc));width:34px;letter-spacing:1px}
.sp-card .sbf-nm{font-size:40px;flex:1;color:var(--ink)}
.sp-team.R .sp-card .sbf-nm{text-align:right}
.sp-card .c{font:600 14px/1 'Chakra Petch';color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.sp-card .r{font:700 18px/1 'Chakra Petch';color:var(--muted)}
.sp-card.out{filter:saturate(.2) brightness(${ONI ? '.9' : '.55'});opacity:${ONI ? '.6' : '1'}}.sp-card.out .sbf-nm{text-decoration:line-through;text-decoration-color:var(--acc)}
.sp-card.playing{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#2c2216,#120c08'})}
.sp-card.coach{background:linear-gradient(180deg,${ONI ? '#f6ecd0,#e6d7ae' : '#2a2210,#0e0b05'})}.sp-card.coach .k{color:var(--gold)}
.sp-card.mvp{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3d2f12,#150f05'})}.sp-card.mvp .sbf-nm{color:${ONI ? '#141210' : '#fff4cf'}}
.sp-vs{position:absolute;left:50%;top:520px;transform:translate(-50%,-50%);font:800 230px/1.1 'Saira Condensed';font-style:italic;padding:0 .14em;
  background:${ONI ? 'linear-gradient(180deg,#fff3cc 10%,#e9c35e 45%,#b0841f 75%,#6b4a0c)' : 'linear-gradient(180deg,#fff 10%,#ffd0a0 40%,#ff5a1f 75%,#a3180a)'};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:${ONI ? 'drop-shadow(0 4px 0 #141210)' : 'drop-shadow(0 0 40px rgba(255,90,31,.6))'}}
.sp-mid{position:absolute;left:50%;top:230px;transform:translateX(-50%);text-align:center;font:800 54px/1.15 'Saira Condensed';font-style:italic;letter-spacing:2px;color:var(--ink)}
.sp-mid small{display:block;font:700 15px/1 'Chakra Petch';letter-spacing:5px;color:var(--muted);margin-top:8px;font-style:normal}
/* ---- 1.12.13: the Team VS splash — the screen split between the teams, line-ups as portraits, VS on the seam */
.k-fvs .tv{position:absolute;inset:0}
.tv-half{position:absolute;top:0;bottom:0;width:58%;opacity:.95}
.tv-half.L{left:0;clip-path:polygon(0 0,100% 0,82% 100%,0 100%);background:linear-gradient(100deg,var(--tcb,transparent) 0%,transparent 70%),linear-gradient(180deg,rgba(255,255,255,.04),transparent 40%)}
.tv-half.R{right:0;clip-path:polygon(18% 0,100% 0,100% 100%,0 100%);background:linear-gradient(260deg,var(--tcb,transparent) 0%,transparent 70%),linear-gradient(180deg,rgba(255,255,255,.04),transparent 40%)}
.tv-half::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-62deg,transparent 0 26px,rgba(255,255,255,.035) 26px 28px)}
.tv-seam{position:absolute;left:calc(50% - 3px);top:-40px;bottom:-40px;width:6px;transform:skewX(-12deg);background:linear-gradient(180deg,transparent,var(--hot,#fff) 20%,#fff 50%,var(--hot,#fff) 80%,transparent);box-shadow:0 0 26px 6px var(--hot,rgba(255,255,255,.5));opacity:.9}
.k-fvs .ttl{top:34px}.k-fvs .ttl{font-size:40px}
.tv-name{position:absolute;top:168px;max-width:760px}
.tv-name.L{left:90px}.tv-name.R{right:90px;text-align:right}
.tv-name b{display:block;font:800 92px/1.02 'Saira Condensed';font-style:italic;text-transform:uppercase;letter-spacing:1px;padding:0 .1em;color:var(--ink);text-shadow:0 0 40px var(--tcb),0 4px 0 rgba(0,0,0,.35);white-space:nowrap;overflow:hidden}
.tv-name small{display:block;font:700 16px/1 'Chakra Petch';letter-spacing:5px;color:var(--tct,var(--tc));margin-bottom:6px}
.tv-name .sp-logo{height:70px;width:auto;max-width:130px;object-fit:contain;float:left;margin:6px 18px 0 0}.tv-name.R .sp-logo{float:right;margin:6px 0 0 18px}
.tv-line{position:absolute;top:350px;display:flex;gap:12px;align-items:flex-start}
.tv-line.L{left:80px}.tv-line.R{right:80px;flex-direction:row-reverse}
.tv-p{position:relative;width:var(--cw);display:flex;flex-direction:column;align-items:stretch}
.tv-ph{position:relative;display:block;width:var(--cw);height:var(--ch);overflow:hidden;background:linear-gradient(180deg,var(--tcb,rgba(255,255,255,.08)),rgba(0,0,0,.55)),linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(12% 0,100% 0,88% 100%,0 100%);box-shadow:inset 0 0 0 2px var(--tc)}
.tv-line.R .tv-ph{clip-path:polygon(0 0,88% 0,100% 100%,12% 100%)}
.tv-ph .sbf-pic.fill{position:absolute;inset:0}.tv-ph .sbf-pic.fill>*{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.tv-ph.none i{position:absolute;inset:0;display:grid;place-items:center;font:800 calc(var(--cw) * .62)/1 'Saira Condensed';font-style:italic;color:var(--tct,var(--tc));opacity:.75;text-shadow:0 0 30px var(--tcb)}   /* 1.12.21: the initial in the team colour's readable shade (a navy team's initials were navy on a dark card) */
.tv-ph::after{content:'';position:absolute;left:0;right:0;bottom:0;height:5px;background:var(--tc)}
.tv-k{position:absolute;top:8px;left:14px;font:700 13px/1 'Chakra Petch';letter-spacing:1px;color:#fff;text-shadow:0 1px 2px #000;z-index:2${ONI ? ';padding:3px 6px 2px;background:rgba(20,18,16,.62);border-radius:3px;text-shadow:none;top:6px;left:10px' : ''}}.tv-line.R .tv-k{left:auto;right:${ONI ? 10 : 14}px}   /* (1.12.21: on the light looks the number stands on a small dark tab — white on a white card, it was held up by its shadow alone) */
.tv-pn{margin-top:10px;position:relative;z-index:2;padding:0 4px;text-align:center}
.tv-pn .sbf-nm{display:block;font:800 calc(min(30px, var(--cw) * .2))/1.1 'Saira Condensed';font-style:italic;text-transform:uppercase;color:var(--ink);white-space:nowrap;overflow:hidden}
.tv-pn small{display:block;margin-top:4px;font:600 calc(min(13px, var(--cw) * .1))/1 'Chakra Petch';letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-p.out{filter:grayscale(1) brightness(.5)}
.k-fvs .tv-vs{top:530px;font-size:210px;z-index:3}
/* ---- 1.12.13: the Team Board splash — a roster table: flat rows, a round picture, each player's state, the score and who's on now in the middle */
.k-fboard .sp-team{top:250px;width:690px;gap:8px}
.k-fboard .sp-team.L{left:70px}.k-fboard .sp-team.R{right:70px}
.k-fboard .sp-team::before{opacity:.35}
.k-fboard .sp-team h2{font-size:46px}
.k-fboard .sp-card{width:690px;height:62px;gap:14px;padding:0 18px;clip-path:none;border-radius:8px;background:linear-gradient(90deg,var(--tcb,transparent),transparent 30%),linear-gradient(180deg,var(--p1),var(--p2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 4px 0 0 var(--tc)}
.k-fboard .sp-team.R .sp-card{clip-path:none;background:linear-gradient(270deg,var(--tcb,transparent),transparent 30%),linear-gradient(180deg,var(--p1),var(--p2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset -4px 0 0 var(--tc)}
.k-fboard .sp-card::before{display:none}
.k-fboard .sp-card .sbf-nm{font-size:30px}
.k-fboard .sp-card .k{width:26px}
.k-fboard .av{position:relative;flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden;background:linear-gradient(180deg,var(--tcb,rgba(255,255,255,.1)),rgba(0,0,0,.5));box-shadow:0 0 0 2px var(--tc)}
.k-fboard .av .sbf-pic.fill{position:absolute;inset:0}.k-fboard .av .sbf-pic.fill>*{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.k-fboard .av.none i{position:absolute;inset:0;display:grid;place-items:center;font:800 24px/1 'Saira Condensed';font-style:italic;color:var(--ink)}
.k-fboard .st{font:800 11px/1 'Chakra Petch';letter-spacing:1.5px;color:var(--muted);min-width:0}
.k-fboard .sp-card.playing .st{color:#141006;background:var(--acc);padding:5px 8px;border-radius:4px}
.k-fboard .sp-card.out .st{color:var(--muted);border:1px solid currentColor;padding:4px 7px;border-radius:4px}
.k-fboard .sp-card.playing{box-shadow:inset 0 0 0 2px var(--tc),0 0 18px var(--tcb)}
.k-fboard .sp-mid{top:300px;padding:22px 30px 20px;min-width:300px;border-radius:12px;background:linear-gradient(180deg,var(--p1),var(--p2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 10px 30px rgba(0,0,0,.4);font-size:84px}
.k-fboard .sp-mid em{display:block;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);font:800 24px/1.15 'Saira Condensed';font-style:italic;text-transform:uppercase;color:var(--ink);letter-spacing:.5px;white-space:nowrap}
.k-fboard .sp-mid em b{display:block;font:inherit;overflow:hidden;text-overflow:ellipsis}
.k-fboard .sp-mid em span{display:block;font:700 12px/1 'Chakra Petch';letter-spacing:4px;color:var(--acc);font-style:normal;margin-bottom:6px}
.k-fboard .sp-mid em i{display:block;font-style:normal;color:var(--muted);font-size:.62em;letter-spacing:3px;margin:2px 0}

.sp-grid{position:absolute;left:110px;right:110px;top:220px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}   /* 1.12.21: four equal columns whatever the names — a long one widened its column (a column is at least as wide as its longest word), so the fourth card ran off the frame and no name was ever “too wide” to be fitted */
.sp-f{position:relative;height:150px;padding:18px 22px;background:linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%);display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow)}
.sp-f .sbf-nm{font-size:40px;color:var(--ink)}
.sp-f[style*='--tc']::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--tc)}.sp-f .sbf-crs{gap:5px}   /* 1.12.6: Death Battle — each fighter's colour, and crests like Team Death Battle */
.sp-f .sbf-lv i{width:15px;height:24px}
.sp-f .meta{font:600 13px/1 'Chakra Petch';letter-spacing:2px;color:var(--muted);text-transform:uppercase}
.sp-f.out{filter:saturate(.3);opacity:${ONI ? '.6' : '.75'}}.sp-f.out .sbf-nm{color:var(--muted)}#sbf-sp .sp-f.out .sbf-nm{margin-right:92px}#sbf-sp .sp-f.next .sbf-nm{margin-right:50px}   /* 1.12.21: a long name stops short of the placement (and of NEXT) instead of running under it */

.sp-f.out .pl{position:absolute;right:22px;top:16px;font:800 46px/1.1 'Saira Condensed';color:${BLOOD};opacity:.8}
.sp-f.next{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#2c2216,#120c08'})}.sp-f.next::after{content:'NEXT';position:absolute;right:20px;top:18px;font:700 12px/1 'Chakra Petch';letter-spacing:3px;color:var(--acc)}
.sp-f.king{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3d2f12,#150f05'})}.sp-f .skull{position:absolute;right:20px;bottom:16px;width:34px;height:34px;opacity:.6}
.sp-big{position:absolute;right:110px;top:84px;display:flex;flex-direction:column;align-items:flex-end;font:800 60px/1 'Saira Condensed';font-style:italic;color:var(--ink);text-transform:uppercase}
.sp-big small{display:block;margin-top:6px;font:700 14px/1 'Chakra Petch';letter-spacing:4px;color:var(--acc);font-style:normal}   /* 1.12.6: the label under the number, not squeezed beside it */
.sp-champ{position:absolute;left:0;right:0;top:300px;text-align:center}
.sp-champ small{text-transform:uppercase;display:block;font:700 22px/1 'Chakra Petch';letter-spacing:10px;color:var(--gold);margin-bottom:22px}
.sp-champ b{display:inline-block;max-width:1800px;font:800 190px/1.12 'Saira Condensed';font-style:italic;text-transform:uppercase;letter-spacing:2px;padding:0 .14em;white-space:nowrap;
  background:${ONI ? 'linear-gradient(180deg,#fff3cc 5%,#e9c35e 40%,#b0841f 75%,#6b4a0c)' : 'linear-gradient(180deg,#fffaf0 5%,#fff4cf 30%,#f6c453 60%,#d99a2b 85%,#8a5a12)'};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:${ONI ? 'drop-shadow(0 4px 0 #141210)' : 'drop-shadow(0 0 40px rgba(246,196,83,.55))'}}
.sp-champ .stat{margin-top:22px;font:600 22px/1 'Chakra Petch';letter-spacing:4px;color:var(--sub);text-transform:uppercase}
.sp-row{position:absolute;left:0;right:0;bottom:120px;display:flex;justify-content:center;gap:16px}
.sp-row .sp-card{width:300px;height:64px;padding:0 18px}.sp-row .sp-card .sbf-nm{font-size:30px}
.sp-rays{position:absolute;left:50%;top:-40%;width:3000px;height:3000px;margin-left:-1500px;background:repeating-conic-gradient(from 0deg,${ONI ? 'rgba(179,6,15,.07)' : 'rgba(255,240,190,.10)'} 0 4deg,transparent 4deg 14deg);
  -webkit-mask:radial-gradient(circle,#000 0,transparent 55%);mask:radial-gradient(circle,#000 0,transparent 55%);animation:sp-spin 40s linear infinite;opacity:.9}
@keyframes sp-spin{to{transform:rotate(360deg)}}
.sp-ghost{position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:10px 40px;opacity:${ONI ? '.035' : '.06'};font:800 70px/1.1 'Saira Condensed';font-style:italic;text-transform:uppercase;transform:rotate(-8deg);color:var(--ink)}
.sp-places{position:absolute;left:0;right:0;bottom:120px;display:flex;justify-content:center;gap:60px;font:700 22px/1 'Chakra Petch';letter-spacing:3px;text-transform:uppercase;color:var(--muted)}
.sp-places b{color:var(--ink);font:800 34px/1.15 'Saira Condensed';font-style:italic;margin-left:10px}
.sp-st{position:absolute;left:330px;right:330px;top:220px;font-family:'Chakra Petch'}
.sp-st .row{display:grid;grid-template-columns:70px 1fr 90px 90px 130px 90px;align-items:center;height:62px;padding:0 24px;margin-bottom:8px;background:linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);font:600 20px/1 'Chakra Petch';color:var(--muted)}
.sp-st .row.h{background:none;height:30px;font-size:13px;letter-spacing:3px;text-transform:uppercase}
.sp-st .row .sbf-nm{font-size:34px;color:var(--ink)}
.sp-st .row .rk{font:800 30px/1 'Saira Condensed';color:var(--acc)}
.sp-st .row.first{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3d2f12,#150f05'})}.sp-st .row.first .rk{color:var(--gold)}
.sp-st .row span{text-align:center}
.sp-lb{position:absolute;left:90px;right:90px;top:210px;display:grid;grid-template-columns:1fr 1fr;gap:56px;font-family:'Chakra Petch'}
.sp-lb h3{margin:0 0 14px;display:flex;flex-wrap:wrap;align-items:center;gap:0 12px;font:800 44px/1 'Saira Condensed';font-style:italic;letter-spacing:1px;color:var(--gold)}
.sp-lb h3 svg{width:38px;height:38px;fill:currentColor;flex:none}
.sp-lb h3 small{flex-basis:100%;margin-top:8px;font:600 15px/1.2 'Chakra Petch';font-style:normal;letter-spacing:3px;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-lb .row{display:grid;align-items:center;height:56px;padding:0 22px;margin-bottom:7px;background:linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);font:600 20px/1 'Chakra Petch';color:var(--muted)}
.sp-lb .koth .row{grid-template-columns:56px 1fr 64px 64px 84px}.sp-lb .emp .row{grid-template-columns:56px 1fr 110px 84px 96px}
.sp-lb .row span{text-align:center;white-space:nowrap}
.sp-lb .row .sbf-nm{display:flex;align-items:center;gap:8px;min-width:0;font:700 30px/1 'Saira Condensed';color:var(--ink);text-align:left;overflow:hidden;text-overflow:ellipsis}
.sp-lb .row .sbf-nm svg,.sp-lb .row span svg{width:22px;height:22px;fill:var(--gold);flex:none;vertical-align:-3px;margin-right:4px}
.sp-lb .row .rk{font:800 28px/1 'Saira Condensed';color:var(--acc)}
.sp-lb .row .bs{color:var(--ink)}
.sp-lb .row.h{background:none;height:26px;font-size:13px;letter-spacing:3px;color:var(--muted)}
.sp-lb .row.first{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#3d2f12,#150f05'})}.sp-lb .row.first .rk{color:var(--gold)}
.sp-lb .row.king{box-shadow:inset 0 0 0 2px var(--gold)}.sp-lb .row.king .sbf-nm{color:var(--gold)}
.sp-lb .vw{margin-left:8px;padding:3px 7px;font:700 11px/1 'Chakra Petch';font-style:normal;letter-spacing:2px;color:var(--ink);border:1px solid var(--muted);border-radius:3px;flex:none}
.sp-lb .none{padding:26px 22px;font:600 20px/1.35 'Chakra Petch';color:var(--muted);background:linear-gradient(180deg,var(--p1),var(--p2));opacity:.85}
.sp-lb .emp h3{color:var(--ink)}.sp-lb .emp h3 svg{fill:var(--gold)}
.sp-next{position:absolute;left:0;right:0;bottom:70px;text-align:center;font:700 18px/1 'Chakra Petch';letter-spacing:5px;color:var(--muted);text-transform:uppercase}
.sp-next b{color:var(--ink);font:800 34px/1.15 'Saira Condensed';font-style:italic;letter-spacing:1px;margin:0 22px}
/* ---------- the format VS (every match) ---------- */
/* ---------- (1.3.6) lock-in: two halves of glass meet in the middle, meld, and a light runs along the join ---------- */
#sbf-lock{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:8995;pointer-events:none;display:none;font-family:'Chakra Petch',sans-serif;color:#fff}
#sbf-lock.on{display:block}
#sbf-lock .win{position:absolute;left:150px;top:236px;width:1620px;height:640px}
#sbf-lock .hf{position:absolute;inset:0;overflow:hidden;will-change:transform}
#sbf-lock .hf.L{clip-path:polygon(0 0,54% 0,46% 100%,0 100%)}#sbf-lock .hf.R{clip-path:polygon(54% 0,100% 0,100% 100%,46% 100%)}
#sbf-lock .glass{position:absolute;inset:0;background:linear-gradient(var(--ga),var(--tca),rgba(10,11,16,.8) 62%,rgba(6,7,10,.9));box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),inset 0 0 80px rgba(255,255,255,.06)}
#sbf-lock .hf.L .glass{--ga:100deg}#sbf-lock .hf.R .glass{--ga:260deg}
#sbf-lock .glass::before{content:'';position:absolute;inset:0;background:linear-gradient(118deg,transparent 18%,rgba(255,255,255,.16) 24%,transparent 31%,transparent 58%,rgba(255,255,255,.09) 62%,transparent 66%)}
#sbf-lock .glass::after{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--tc);box-shadow:0 0 18px var(--tc)}
#sbf-lock .tint{position:absolute;inset:0;pointer-events:none}#sbf-lock .hf.L .tint{background:linear-gradient(90deg,var(--tca),transparent 42%)}#sbf-lock .hf.R .tint{background:linear-gradient(270deg,var(--tca),transparent 42%)}
#sbf-lock .hf.L .tint::before,#sbf-lock .hf.R .tint::before{content:'';position:absolute;top:0;bottom:0;width:12px;background:var(--tc)}#sbf-lock .hf.L .tint::before{left:0}#sbf-lock .hf.R .tint::before{right:0}
/* 1.12.6: the picture sits in a frame of its own (the picture window's 5 : 6 panel), whole and clear — nothing dark over it —
   with the name and the lives under it */
#sbf-lock .card{position:absolute;top:34px;width:640px;display:flex;flex-direction:column;align-items:center;z-index:2}
#sbf-lock .hf.L .card{left:40px}#sbf-lock .hf.R .card{right:40px}
#sbf-lock .frame{position:relative;width:350px;height:420px;border-radius:6px;overflow:hidden;background:linear-gradient(0deg,var(--tca),transparent 55%),linear-gradient(180deg,#1b1d26,#0b0c11);box-shadow:0 0 0 3px var(--tc),0 0 26px var(--tca),0 18px 40px rgba(0,0,0,.5)}
#sbf-lock .frame::after{content:'';position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.18),transparent 30%);pointer-events:none}
#sbf-lock .pic{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;transform:translate(var(--px,0%),var(--py,0%)) scale(var(--pz,1));transform-origin:50% 60%}
#sbf-lock .mono{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 300px/1 'Saira Condensed';font-style:italic;color:var(--tc);opacity:.35;text-transform:uppercase}
#sbf-lock .info{margin-top:18px;display:flex;flex-direction:column;align-items:center;gap:8px;max-width:640px;text-align:center}
#sbf-lock .info small:empty{display:none}#sbf-lock .info small{padding:5px 12px 4px;border-radius:3px;background:rgba(6,7,10,.55);box-shadow:inset 0 -2px 0 var(--tc);font:700 15px/1 'Chakra Petch';letter-spacing:4px;color:#fff;text-transform:uppercase;white-space:nowrap}
#sbf-lock .info b{display:block;max-width:640px;font:800 74px/.95 'Saira Condensed';font-style:italic;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-shadow:0 4px 24px rgba(0,0,0,.6);padding:0 .1em}
#sbf-lock .info .st{display:flex;align-items:center;gap:10px;font:700 18px/1 'Chakra Petch';letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.88)}
#sbf-lock .info .st .sbf-crs{gap:6px}
#sbf-lock .seam{position:absolute;left:54%;top:0;width:0;height:653px;transform-origin:0 0;transform:rotate(11.45deg)}
#sbf-lock .seam i{position:absolute;left:-3px;top:0;width:6px;height:100%;background:linear-gradient(180deg,var(--ca),#fff 50%,var(--cb));box-shadow:0 0 22px #fff,0 0 50px var(--ca);opacity:0}
#sbf-lock .seam em{position:absolute;left:-34px;top:0;width:68px;height:150px;background:radial-gradient(ellipse 50% 50% at 50% 50%,#fff,rgba(255,255,255,.55) 30%,transparent 70%);filter:blur(2px);opacity:0;mix-blend-mode:screen}
#sbf-lock .melt{position:absolute;left:46%;top:0;width:8%;height:100%;background:linear-gradient(90deg,transparent,var(--caa) 30%,var(--cba) 70%,transparent);clip-path:polygon(85% 0,100% 0,15% 100%,0 100%);opacity:0;filter:blur(6px)}
#sbf-lock .vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:900 150px/1 'Saira Condensed';font-style:italic;color:#fff;text-shadow:0 0 40px rgba(255,255,255,.55),0 0 90px var(--ca);opacity:0}
#sbf-lock .head{position:absolute;left:50%;top:150px;transform:translateX(-50%);text-align:center;white-space:nowrap}
#sbf-lock .head small{display:block;font:700 15px/1 'Chakra Petch';letter-spacing:5px;color:rgba(255,255,255,.75);text-transform:uppercase}
#sbf-lock .head b{display:block;margin-top:8px;font:800 44px/1 'Saira Condensed';font-style:italic;letter-spacing:6px;text-transform:uppercase;color:#fff}
#sbf-vs{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:8990;display:none;overflow:hidden;pointer-events:none;color:var(--ink);font-family:'Chakra Petch',sans-serif}
#sbf-vs.on{display:block}
#sbf-vs .bg{position:absolute;inset:0;background:${ONI
    ? 'repeating-linear-gradient(45deg,rgba(20,18,16,.03) 0 2px,transparent 2px 9px),linear-gradient(180deg,#fdfbf6,#e7dfcf)'
    : 'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(255,255,255,.05),transparent 70%),linear-gradient(180deg,#0b0c0f,#040406)'}}
#sbf-vs .half{position:absolute;top:0;bottom:0;width:62%;overflow:hidden}
#sbf-vs .half.L{left:0;clip-path:polygon(0 0,100% 0,78% 100%,0 100%)}#sbf-vs .half.R{right:0;clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
#sbf-vs .half::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at var(--hx) 55%,var(--hc),transparent 70%)}
#sbf-vs .half.L{--hx:25%}#sbf-vs .half.R{--hx:75%}
#sbf-vs .half .ghost{position:absolute;top:150px;font:800 300px/1.1 'Saira Condensed';font-style:italic;text-transform:uppercase;white-space:nowrap;opacity:.07;color:var(--ink);padding:0 .1em}
#sbf-vs .half.L .ghost{left:40px}#sbf-vs .half.R .ghost{right:40px}
#sbf-vs .half .pic{position:absolute;top:0;height:100%;width:62%;object-fit:cover;object-position:50% 22%;opacity:.42;filter:saturate(.9)}
#sbf-vs .half.L .pic{left:0;-webkit-mask:linear-gradient(90deg,#000 35%,transparent 92%);mask:linear-gradient(90deg,#000 35%,transparent 92%)}
#sbf-vs .half.R .pic{right:0;-webkit-mask:linear-gradient(270deg,#000 35%,transparent 92%);mask:linear-gradient(270deg,#000 35%,transparent 92%)}
#sbf-vs .seam{position:absolute;left:50%;top:-5%;width:6px;height:110%;margin-left:-3px;transform:rotate(11.5deg);background:${ONI ? '#141210' : 'linear-gradient(180deg,transparent,#ffb36b 20%,#fff 50%,#ffb36b 80%,transparent)'};box-shadow:${ONI ? 'none' : '0 0 24px #ff5a1f'}}
#sbf-vs .top{position:absolute;left:0;right:0;top:56px;text-align:center}
#sbf-vs .top small{display:block;font:700 18px/1 'Chakra Petch';letter-spacing:9px;color:var(--acc);text-transform:uppercase;margin-bottom:12px}
#sbf-vs .top b{display:inline-block;font:800 64px/1.15 'Saira Condensed';font-style:italic;letter-spacing:3px;text-transform:uppercase;padding:0 .15em;color:var(--ink)}
#sbf-vs .side{position:absolute;top:330px;width:760px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
#sbf-vs .side.L{left:90px}#sbf-vs .side.R{right:90px;align-items:flex-end;text-align:right}
#sbf-vs .side .lab{font:700 16px/1 'Chakra Petch';letter-spacing:5px;color:var(--tct,var(--tc,var(--acc)));text-transform:uppercase;display:flex;gap:12px;align-items:center}
#sbf-vs .side.R .lab{flex-direction:row-reverse}
#sbf-vs .side .big{max-width:760px;font:800 128px/1.14 'Saira Condensed';font-style:italic;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;padding:.06em .16em 0 .02em;margin-left:-.02em;
  background:var(--name);-webkit-background-clip:text;background-clip:text;color:transparent;filter:var(--namefx)}
#sbf-vs .side .st{font:600 20px/1.3 'Chakra Petch';letter-spacing:3px;color:var(--sub);text-transform:uppercase;display:flex;gap:18px;align-items:center}
#sbf-vs .side.R .st{flex-direction:row-reverse}
#sbf-vs .side .st b{color:var(--ink);font-weight:700}
#sbf-vs .side .tag2{display:inline-block;padding:6px 14px;font:800 22px/1.1 'Saira Condensed';font-style:italic;letter-spacing:2px;color:${ONI ? '#fdfbf6' : '#040406'};background:var(--tc,var(--acc));clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#sbf-vs .side .sbf-lv i{width:30px;height:46px}#sbf-vs .side .sbf-lv{gap:9px;margin-top:4px}
#sbf-vs .side .stock{display:flex;gap:7px}#sbf-vs .side .stock i{width:20px;height:30px;background:var(--tc,var(--acc));clip-path:polygon(30% 0,100% 0,70% 100%,0 100%);box-shadow:0 0 10px var(--tc)}
#sbf-vs .side .stock i.out{background:${ONI ? '#cfc6b6' : '#2a2b30'};box-shadow:none}#sbf-vs .side .stock i.me{outline:2px solid var(--ink);outline-offset:2px}
#sbf-vs .mid{position:absolute;left:50%;top:470px;transform:translate(-50%,-50%);text-align:center}
#sbf-vs .mid .vs{font:800 220px/1.1 'Saira Condensed';font-style:italic;padding:0 .14em;
  background:${ONI ? 'linear-gradient(180deg,#ff5a3c 10%,#b3060f 55%,#5a0006)' : 'linear-gradient(180deg,#fff 10%,#ffd0a0 40%,#ff5a1f 75%,#a3180a)'};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:${ONI ? 'drop-shadow(0 5px 0 #141210)' : 'drop-shadow(0 0 40px rgba(255,90,31,.7))'}}
#sbf-vs .mid .emb{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle,${ONI ? '#fff3cc,#e9c35e 60%,#b0841f' : '#2a2015,#120c08 65%,#050507'});border:4px solid var(--gold);box-shadow:0 0 50px ${ONI ? 'rgba(179,6,15,.35)' : 'rgba(246,196,83,.45)'}}
#sbf-vs .mid .emb small{font:700 16px/1 'Chakra Petch';letter-spacing:5px;color:${ONI ? '#5a0006' : 'var(--gold)'}}
#sbf-vs .mid .emb b{font:800 110px/1.05 'Saira Condensed';font-style:italic;color:${ONI ? '#141210' : '#fff4cf'};padding:0 .1em}
#sbf-vs .foot{position:absolute;left:90px;right:90px;bottom:70px;display:flex;justify-content:center;gap:10px;align-items:stretch}
#sbf-vs .foot .it{flex:0 1 290px;height:52px}#sbf-vs .foot .it .sbf-nm{font-size:24px}
#sbf-vs .foot .cap{position:absolute;left:0;right:0;top:-34px;text-align:center;font:700 14px/1 'Chakra Petch';letter-spacing:6px;color:var(--muted);text-transform:uppercase}
#sbf-vs .banner{position:absolute;padding:8px 26px;font:800 30px/1.1 'Saira Condensed';font-style:italic;letter-spacing:4px;text-transform:uppercase;color:#fff;background:${BLOOD};clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);box-shadow:0 0 30px ${BLOOD}}
#sbf-vs .crown-big{width:120px;height:96px;filter:drop-shadow(0 0 18px var(--gold))}
#sbf-vs.f-death .bg::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 260px 30px ${ONI ? 'rgba(179,6,15,.35)' : 'rgba(195,19,45,.45)'}}
#sbf-vs.f-koth .half.L::after{content:'';position:absolute;left:25%;top:50%;width:2400px;height:2400px;margin:-1200px 0 0 -1200px;background:repeating-conic-gradient(from 0deg,${ONI ? 'rgba(201,161,59,.12)' : 'rgba(246,196,83,.08)'} 0 4deg,transparent 4deg 13deg);animation:sp-spin 50s linear infinite;-webkit-mask:radial-gradient(circle,#000,transparent 50%);mask:radial-gradient(circle,#000,transparent 50%)}
#sbf-vs.f-league .bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,var(--line) 0 1px,transparent 1px 64px),repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 64px);opacity:.6}
#sbf-vs .table{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);width:760px}
#sbf-vs .table .row{display:grid;grid-template-columns:50px 1fr 70px 70px 90px;align-items:center;height:42px;padding:0 20px;margin-bottom:5px;background:linear-gradient(180deg,var(--p1),var(--p2));clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);font:600 17px/1 'Chakra Petch';color:var(--muted)}
#sbf-vs .table .row .sbf-nm{font-size:24px;color:var(--ink)}#sbf-vs .table .row .rk{font:800 24px/1 'Saira Condensed';color:var(--acc)}#sbf-vs .table .row span{text-align:center}
#sbf-vs .table .row.me{background:linear-gradient(180deg,${ONI ? '#fff3cc,#e9c35e' : '#2c2216,#120c08'})}
#sbf-vs .ladder{position:absolute;left:150px;right:150px;bottom:90px;display:flex;gap:6px}
#sbf-vs .ladder .it{flex:1 1 0;min-width:0;height:58px;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 50%,calc(100% - 16px) 100%,0 100%,16px 50%);padding-left:26px}
#sbf-vs .ladder .it .ed{display:none}#sbf-vs .ladder .it .sbf-nm{font-size:24px}#sbf-vs .ladder .it.more{flex:0 0 auto;padding:0 22px 0 26px}
.sb-potato #sbf *,.sb-potato #sbf-sp *,.sb-potato #sbf-vs *,.sb-potato #sbf-lock *{animation:none!important;transition:none!important}
`;
  const css2 = tone(css);
  const st = document.createElement('style'); st.textContent = css2; document.head.appendChild(st);
  // 1.12.9: one plate for everything a format draws — the PlayerCards, the team boxes, the middle header, the splashes' name
  // rows — made like the layout's own player bars (the same glass / glaze / card, the same slanted ends, the same name
  // lettering), so the bottom of the screen looks like part of the scoreboard. The team's colour stays as a stripe.
  const PLATE = OBS ? { bg: 'linear-gradient(180deg,#38342b 0%,#1b1913 44%,#0b0a08 80%,#030304)', ring: 'rgba(224,169,59,.46)', hi: 'rgba(255,240,200,.16)', name: 'var(--name)', clip: 'polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%)', r: '0', ink: '#fff' }
    : PORC ? { bg: 'linear-gradient(180deg,#ffffff,#f7f6f3 55%,#e9e7e2)', ring: '#0b0b0d', hi: 'rgba(255,255,255,.9)', name: 'var(--name)', clip: 'polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%)', r: '0', ink: '#0b0b0d' }
    : PLAIN ? { bg: 'linear-gradient(180deg,#1c2030,#151822)', ring: '#2c3446', hi: 'rgba(255,255,255,.05)', name: '', clip: 'none', r: '8px', ink: '#fff' } : null;
  if (PLATE) {
    const nameFill = PLATE.name ? `background:${PLATE.name};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;` : `color:${PLATE.ink};`;
    const ps = document.createElement('style'); ps.id = 'sbf-plate';
    ps.textContent = `
:root{--pl-bg:${PLATE.bg};--pl-ring:${PLATE.ring};--pl-hi:${PLATE.hi};--pl-clip:${PLATE.clip};--pl-r:${PLATE.r};--pl-ink:${PLATE.ink}}
#sbf-bar .td-card,#sbf-bar .it:not(.td),#sbf-sp .sp-f,#sbf-sp .sp-card{background:linear-gradient(180deg,var(--tcw,transparent),transparent 60%),var(--pl-bg);box-shadow:inset 0 0 0 1.5px var(--pl-ring),inset 0 1px 0 var(--pl-hi),0 6px 16px rgba(0,0,0,.35);border-radius:var(--pl-r);clip-path:var(--pl-clip)}
#sbf-bar .td-card{padding-left:10px;padding-right:10px;justify-content:center}
#sbf-bar .it.td.pics .td-card{padding:0;justify-content:flex-end}
#sbf-bar .td-card:not(:has(img)) .sbf-nm{flex:0 0 auto;height:auto}
#sbf-bar .it:not(.td)::before{opacity:.0}
#sbf-bar .td-card:not(:has(img)) .sbf-nm,#sbf-bar .it:not(.td) .sbf-nm,#sbf-sp .sp-f .sbf-nm,#sbf-sp .sp-card .sbf-nm,#sbf-bar .it.td.team .sbf-nm{${nameFill}}
#sbf-bar .it.td.team .td-card{background:linear-gradient(180deg,var(--tcw,transparent),transparent 70%),var(--pl-bg)}
#sbf-bar .bc{background:linear-gradient(180deg,var(--tcw,transparent),transparent 60%),var(--pl-bg);box-shadow:inset 0 0 0 1.5px var(--pl-ring),inset 0 1px 0 var(--pl-hi),0 6px 16px rgba(0,0,0,.4);border-top-width:2px}
#sbf-bar.tc2 .bc{background:var(--bcg),var(--pl-bg)}
#sbf-bar .it.td.playing .td-card{box-shadow:inset 0 0 0 2.5px var(--tc,var(--acc)),0 0 8px var(--tc,var(--acc))}
#sbf-bar .it.td.out .td-card{background:linear-gradient(180deg,#1b1b20,#0c0c0f);box-shadow:inset 0 0 0 1.5px rgba(255,61,85,.45)}
#sbf-bar .it.td.out .td-card .sbf-nm{-webkit-text-fill-color:currentColor;background:none;color:#8a8a90}
#sbf-sp .sp-f::before{width:5px}
#sbf-bar .td-card .sbf-nm:not(.two){white-space:nowrap}
.sbf-nm.two2,.tag.two2{white-space:normal!important;overflow-wrap:anywhere;line-height:1!important;text-overflow:clip!important;text-wrap:balance;max-height:2.2em}
#sbf-bar .td-card .sbf-nm.two{white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.04;text-overflow:clip;text-wrap:balance}
`;
    document.head.appendChild(ps);
  }
  // 1.12.9: the team boxes' names and the header's team names shrink to fit — never cut off with "…"
  function shrinkFit(root) {
    if (!root) return;
    for (const n of root.querySelectorAll('.it.td.team .sbf-nm, .it:not(.td) .sbf-nm, .bc b .tag, .bc b .sbf-nm, .sp-f .sbf-nm, .sp-card .sbf-nm, .tv-pn .sbf-nm')) {      // (1.12.21: the names under the Team VS splash's tall cards too — a long one ended in “…” there)
      const cw = n.clientWidth; if (!cw) continue;
      // 1.12.12: a name already fitted at this width is left alone (it used to be measured again on every change anywhere)
      const fk = n.textContent + '|' + cw + '|' + n.clientHeight; if (n.__fk === fk) continue;
      if (n.classList.contains('two2') && !n.dataset.sf) { n.classList.remove('two2'); n.textContent = n.textContent; }
      if (!n.style.fontSize || !n.dataset.sf) { n.style.fontSize = ''; } let px = parseFloat(getComputedStyle(n).fontSize) || 16; const min = Math.max(9, px * .45);
      if (!(n.scrollWidth > n.clientWidth || tooWide(n))) { n.__fk = n.textContent + '|' + n.clientWidth + '|' + n.clientHeight; continue; } n.dataset.sf = 1;
      // the biggest size that fits, found in a few steps (not half a pixel at a time)
      { const fits = v => { n.style.fontSize = v + 'px'; return !(n.scrollWidth > n.clientWidth || tooWide(n)); }; let lo = min, hi = px;
        if (fits(lo)) { while (hi - lo > .5) { const mid = Math.round((lo + hi) / 2 * 2) / 2; if (mid <= lo || mid >= hi) break; if (fits(mid)) lo = mid; else hi = mid; } px = lo; } else px = min;
        n.style.fontSize = px + 'px'; }
      // still too long at a readable size: two lines (where the name breaks naturally), as big as fits in two
      if (n.scrollWidth > n.clientWidth && !n.classList.contains('two2')) {
        n.classList.add('two2'); n.innerHTML = wbr(n.textContent); px = Math.max(px, 14);
        const lh = () => parseFloat(getComputedStyle(n).lineHeight) || px;
        n.style.fontSize = px + 'px'; while ((n.scrollHeight > lh() * 2.3 || n.scrollWidth > n.clientWidth) && px > 8) { px -= .5; n.style.fontSize = px + 'px'; }      // (2.3 lines, not 2.15: two lines and the name's own padding come to 2.16 — it never passed, and shrank on to one tiny line)
      }
      // 1.12.21: a team's name in the middle box that only fits below a readable size (Team Death Battle's box is the fullest)
      // gives way to the team's tag, at the box's own size
      if (px < 11 && n.dataset.tag && !n.dataset.tagged && n.dataset.tag.length < n.textContent.length) {
        n.dataset.tagged = 1; n.classList.remove('two2'); n.textContent = n.dataset.tag; n.style.fontSize = ''; delete n.dataset.sf; n.__fk = ''; fitKick(); continue;
      }
      n.__fk = n.textContent + '|' + n.clientWidth + '|' + n.clientHeight;
    }
  }
  // 1.12.12: watched where formats draw names (the format bar and its splashes), not the whole page, and no 1.5-second recheck
  let fitKick = () => {}, fitWatch = () => {};
  { let q = 0; fitKick = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; shrinkFit(document.getElementById('sbf-bar')); shrinkFit(document.getElementById('sbf-sp')); }); };
    const mo = new MutationObserver(() => fitKick()), ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fitKick()) : null;
    fitWatch = el => { if (!el || el.__fitW) return; el.__fitW = 1; mo.observe(el, { childList: true, subtree: true, characterData: true }); if (ro) ro.observe(el); fitKick(); };
    if (document.fonts) { document.fonts.ready.then(() => fitKick()); document.fonts.addEventListener('loadingdone', () => { for (const id of ['sbf-bar', 'sbf-sp']) { const r = document.getElementById(id); if (r) r.querySelectorAll('.sbf-nm, .tag').forEach(n => { n.__fk = ''; }); } fitKick(); }); } }
  // 1.12.6: the Default layout's own lettering (the app's) on everything a format draws too — not the other looks' italic display face
  // the Default layout: the app's own lettering, Beebo Classic (1.12.13; always in capitals), upright
  if (PLAIN) { const pl = document.createElement('style'); pl.textContent = "@font-face{font-family:'Beebo Classic';font-weight:700;font-display:swap;src:url(/static/fonts/beebo-classic-latin-700-normal.woff2) format('woff2')}@font-face{font-family:'Beebo Classic';font-weight:800;font-display:swap;src:url(/static/fonts/beebo-classic-latin-800-normal.woff2) format('woff2')}@font-face{font-family:'Beebo Classic';font-weight:600;font-display:swap;src:url(/static/fonts/beebo-classic-latin-600-normal.woff2) format('woff2')}" + ['#sbf', '#sbf-sp', '#sbf-vs', '#sbf-lock', '.sbf-band', '.sbf-stamp', '.sbf-count', '#sbf-bar'].map(r => `${r},${r} *`).join(',') + "{font-family:'Beebo Classic','Segoe UI',system-ui,-apple-system,sans-serif!important;font-style:normal!important}"; document.head.appendChild(pl); }

  const root = document.createElement('div'); root.id = 'sbf'; document.body.appendChild(root);
  const sp = document.createElement('div'); sp.id = 'sbf-sp'; document.body.appendChild(sp); fitWatch(sp);
  const vsEl = document.createElement('div'); vsEl.id = 'sbf-vs'; document.body.appendChild(vsEl);
  const lockEl = document.createElement('div'); lockEl.id = 'sbf-lock'; document.body.appendChild(lockEl);
  const cv = document.createElement('canvas'); cv.id = 'sbf-fx'; cv.width = W; cv.height = H; document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  // ===================================================================================== effects toolkit
  let sparks = [], raf = 0, last = 0;
  function spark(x, y, n, power = 1, color = T.spark, spread = Math.PI * 2, dir = -Math.PI / 2, grav = 900) {
    if (POTATO() || PLAIN || CALM()) return;
    const c = hex(color), hot = ONI ? [255, 243, 204] : [255, 230, 200];
    for (let i = 0; i < n; i++) { const a = dir + (Math.random() - .5) * spread, v = (140 + Math.random() * 420) * power;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: grav, life: 1, d: .8 + Math.random() * 1.1, s: 1 + Math.random() * 2.4, c: i % 3 ? c : hot }); }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function embers(x0, x1, y, n, color = T.spark2) {
    if (POTATO() || PLAIN || CALM()) return;
    const c = hex(color);
    for (let i = 0; i < n; i++) sparks.push({ x: x0 + Math.random() * (x1 - x0), y, vx: (Math.random() - .5) * 40, vy: -(60 + Math.random() * 200), g: -20, life: 1, d: .35 + Math.random() * .4, s: 1.2 + Math.random() * 2.2, c, wob: Math.random() * 6 });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  // 1.12.6: each spark is a stamped glow (drawn once per colour, SBPerf.glow) instead of a new gradient per spark per frame,
  // and only the part of the canvas the sparks used is cleared
  let dirty = null;
  function tick(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
    ctx.globalCompositeOperation = ONI ? 'source-over' : 'lighter';
    sparks = sparks.filter(p => (p.life -= p.d * dt) > 0);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const p of sparks) {
      p.vy += p.g * dt; p.vx *= .985; p.x += (p.vx + (p.wob ? Math.sin(t / 300 + p.wob) * 18 : 0)) * dt; p.y += p.vy * dt;
      const r = p.s * 3, [a, b, c] = p.c, spr = window.SBPerf ? SBPerf.glow(`sbf${a},${b},${c}`, [[0, `rgba(${a},${b},${c},1)`], [1, `rgba(${a},${b},${c},0)`]], 32) : null;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      if (spr) ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
      if (!p.wob) { ctx.strokeStyle = `rgb(${Math.min(255, a + 60)},${Math.min(255, b + 60)},${Math.min(255, c + 60)})`; ctx.globalAlpha = p.life * .7; ctx.lineWidth = p.s * .7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); }
      const m = r + Math.abs(p.vx) * .03 + Math.abs(p.vy) * .03 + 2; if (p.x - m < x0) x0 = p.x - m; if (p.y - m < y0) y0 = p.y - m; if (p.x + m > x1) x1 = p.x + m; if (p.y + m > y1) y1 = p.y + m;
    }
    ctx.globalAlpha = 1;
    dirty = sparks.length ? [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(W, Math.ceil(x1)), Math.min(H, Math.ceil(y1))] : null;
    if (sparks.length) raf = requestAnimationFrame(tick); else { raf = 0; ctx.clearRect(0, 0, W, H); dirty = null; }
  }
  function hex(c) { const m = /^#?([0-9a-f]{6})/i.exec(c || '') || [0, 'ffb36b']; return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); }
  function ring(x, y, size, color = T.hot, dur = 700) {
    if (POTATO() || CALM()) return;
    const r = document.createElement('div'); r.className = 'sbf-ring'; r.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--rc:${color}`;
    document.body.appendChild(r); r.animate([{ transform: 'translate(-50%,-50%) scale(.12)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => r.remove();
  }
  const scaleK = () => (document.body.getBoundingClientRect().width / W) || 1;
  const center = el => { const r = el.getBoundingClientRect(), k = scaleK(); return [(r.left + r.width / 2) / k, (r.top + r.height / 2) / k]; };
  const boxOf = el => { const r = el.getBoundingClientRect(), k = scaleK(); return { x: r.left / k, y: r.top / k, w: r.width / k, h: r.height / k }; };
  function decode(el, dur = 560) {
    if (!el || POTATO()) return;
    // the real text: what is shown, unless what is shown is this effect's own scramble. (A layout's names are written by
    // sb-client, not here: a name kept from an earlier decode could put the last player's name back on the bar.)
    const mid = el.dataset.scr != null && el.dataset.scr === el.textContent;
    const final = mid && el.dataset.txt != null ? el.dataset.txt : el.textContent; el.dataset.txt = final; const t0 = performance.now();
    const step = t => {
      if (el.dataset.txt !== final || (el.dataset.scr != null && el.textContent !== el.dataset.scr)) return;   // a newer decode, or the text was changed meanwhile
      const p = Math.min(1, (t - t0) / dur), n = Math.floor(p * final.length * 1.15); let s = ''; for (let i = 0; i < final.length; i++) s += i < n || final[i] === ' ' ? final[i] : GLYPHS[Math.random() * GLYPHS.length | 0];
      if (p >= 1) s = final;
      el.textContent = s; el.dataset.scr = s; if (p < 1) requestAnimationFrame(step);
    };
    el.dataset.scr = el.textContent;
    requestAnimationFrame(step);
  }
  const setTxt = (el, t) => { if (!el) return false; t = String(t == null ? '' : t); if (el.dataset.txt !== t) { el.dataset.txt = t; el.textContent = t; return true; } return false; };
  // breaking: the element is copied into polygon fragments that fly out and fall (glass on Shattered, torn paper on Oni)
  function shatter(el, { n = 10, dir = 1, power = 1, color = T.spark, fall = 900 } = {}) {
    if (!el || POTATO()) return;
    const b = boxOf(el); if (!b.w) return;
    if (PLAIN || CALM()) {     // the Default layout (and Less movement in any layout): no fragments, the piece just fades away (a copy of it, so the real one is left alone)
      const f = el.cloneNode(true); f.classList.add('sbf-frag'); f.removeAttribute('id');
      f.style.cssText += `;position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;margin:0;transform:none`;
      document.body.appendChild(f); f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).onfinish = () => f.remove(); return;
    }
    const pts = [], cols = Math.max(3, Math.round(n / 2));
    for (let i = 0; i <= cols; i++) pts.push([b.w * i / cols + (i && i < cols ? (Math.random() - .5) * b.w / cols * .7 : 0), b.w * i / cols + (i && i < cols ? (Math.random() - .5) * b.w / cols * .7 : 0)]);
    const mid = b.h * (.35 + Math.random() * .3);
    for (let i = 0; i < cols; i++) for (const half of [0, 1]) {
      const [t0, b0] = pts[i], [t1, b1] = pts[i + 1], m0 = (t0 + b0) / 2 + (Math.random() - .5) * 8, m1 = (t1 + b1) / 2 + (Math.random() - .5) * 8;
      const poly = half ? [[m0, mid], [m1, mid], [b1, b.h], [b0, b.h]] : [[t0, 0], [t1, 0], [m1, mid], [m0, mid]];
      const f = el.cloneNode(true); f.classList.add('sbf-frag'); f.removeAttribute('id');
      f.style.cssText += `;position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;margin:0;transform:none;will-change:transform,opacity;clip-path:polygon(${poly.map(([x, y]) => `${x}px ${y}px`).join(',')})`;
      document.body.appendChild(f);
      const cx = (poly[0][0] + poly[1][0]) / 2, vx = (cx / b.w - .3) * 320 * dir * power + (Math.random() - .5) * 120, vy = -80 - Math.random() * 160, rot = (Math.random() - .5) * 70;
      f.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${vx * .25}px,${vy * .25}px) rotate(${rot * .3}deg)`, opacity: 1, offset: .25 },
        { transform: `translate(${vx}px,${vy + 420}px) rotate(${rot}deg)`, opacity: 0 }], { duration: fall + Math.random() * 250, easing: 'cubic-bezier(.3,.1,.6,1)' }).onfinish = () => f.remove();
    }
    spark(b.x + b.w / 2, b.y + b.h / 2, 40, .9, color);
  }
  function crackSVG(w, h, seed = 1) {
    let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const ox = w * (.3 + r() * .4), oy = h * (.3 + r() * .4); let d = '';
    for (let i = 0; i < 7; i++) { let x = ox, y = oy; d += `M${x.toFixed(1)},${y.toFixed(1)}`; const a = r() * 6.283; for (let k = 0; k < 3; k++) { x += Math.cos(a + (r() - .5)) * w * .14; y += Math.sin(a + (r() - .5)) * h * .4; d += `L${x.toFixed(1)},${y.toFixed(1)}`; } }
    return d;
  }
  // cracks drawn over any box for a moment (they glow, then fade)
  function crackOver(b, { dur = 1600, color = tone(PORC ? '#0b0b0d' : ONI ? '#141210' : '#ff6a2a'), width = 2 } = {}) {
    if (POTATO()) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${b.w} ${b.h}`); svg.setAttribute('style', `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;z-index:9440;pointer-events:none;overflow:visible`);
    svg.innerHTML = `<path d="${crackSVG(b.w, b.h, Math.random() * 99 | 0)}" fill="none" stroke="${color}" stroke-width="${width}" style="filter:drop-shadow(0 0 4px ${tone(PORC ? '#d4af37' : ONI ? '#b3060f' : '#ff5a1f')})"/>`;
    document.body.appendChild(svg); const p = svg.firstChild, L = 3000; p.style.strokeDasharray = L;
    p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
    svg.animate([{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: dur, fill: 'forwards' }).onfinish = () => svg.remove();
  }
  function shake(el, px = 4, dur = 300) { if (!el || POTATO()) return; el.animate([0, -px, px, -px * .6, px * .4, 0].map(x => ({ translate: `${x}px 0` })), { duration: dur }); }
  // 1.11: a team player knocked out — their card takes a hit: a web of cracks runs out from the impact in the team's colour,
  // it holds for a beat, then bursts into glass that fans out from the impact and falls, glinting, with a shock ring
  function glassKO(src, col, dir = 1) {
    // 1.12.6: smooth and kept inside the card. Everything here only moves and fades (the graphics card's work, no repaints):
    // the pieces never leave the card's own box (it's clipped), so nothing runs into the cards next to it, and there are
    // no sparks or rings flying out over the bar.
    return new Promise(done => {
      if (!src || POTATO() || CALM()) return done();
      const b = boxOf(src); if (!b.w) return done();
      const host = document.createElement('div'); host.className = 'sbf-glass';
      host.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;z-index:9455;pointer-events:none;overflow:hidden;contain:strict;border-radius:${getComputedStyle(src).borderRadius || '0px'}`;
      const ix = b.w * (dir > 0 ? .62 : .38), iy = b.h * .42, rnd = (() => { let q = (b.x * 7 + b.y * 13) | 0; return () => (q = (q * 9301 + 49297) % 233280) / 233280; })();
      const face = src.cloneNode(true); face.removeAttribute('id'); face.style.cssText += ';position:absolute;inset:0;margin:0;width:100%;height:100%;transform:none';
      host.appendChild(face);
      // the crack web: spokes from the impact and a broken ring round it — a wide faint stroke in the team's colour under a
      // thin white one (a glow without a blur filter)
      const N = 8, R = Math.hypot(b.w, b.h), ang = Array.from({ length: N }, (_, i) => (i + .15 + rnd() * .7) / N * Math.PI * 2);
      const spoke = a => { let d = `M${ix.toFixed(1)},${iy.toFixed(1)}`; for (let k = 1; k <= 3; k++) { const r = R * k / 3, j = (rnd() - .5) * .25; d += `L${(ix + Math.cos(a + j) * r).toFixed(1)},${(iy + Math.sin(a + j) * r).toFixed(1)}`; } return d; };
      const ringD = f => ang.map((a, i) => `${i ? 'L' : 'M'}${(ix + Math.cos(a) * R * f * (.8 + rnd() * .4)).toFixed(1)},${(iy + Math.sin(a) * R * f * (.8 + rnd() * .4)).toFixed(1)}`).join('') + 'Z';
      const web = ang.map(spoke).concat(ringD(.16)).map(d => `<path d="${d}"/>`).join('');
      host.insertAdjacentHTML('beforeend', `<svg class="web" width="${b.w}" height="${b.h}" style="position:absolute;inset:0;opacity:0;will-change:opacity"><g fill="none" stroke-linejoin="round"><g stroke="${esc(col)}" stroke-width="5" stroke-opacity=".45">${web}</g><g stroke="#fff" stroke-width="1.4">${web}</g></g></svg><i class="hit" style="position:absolute;inset:0;background:#fff;opacity:0;will-change:opacity"></i>`);
      document.body.appendChild(host); src.style.visibility = 'hidden';
      const web0 = host.querySelector('.web'), hit = host.querySelector('.hit');
      web0.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90, fill: 'forwards' });
      hit.animate([{ opacity: .55 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      host.animate([0, -3, 3, -2, 1, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 240 });
      setTimeout(() => {
        // the burst: one piece per wedge, sliding out from the impact and dropping, all inside the card
        for (let i = 0; i < N; i++) {
          const a0 = ang[i], a1 = ang[(i + 1) % N] + (i === N - 1 ? Math.PI * 2 : 0), am = (a0 + a1) / 2;
          const pts = [[ix, iy], [ix + Math.cos(a0) * R, iy + Math.sin(a0) * R], [ix + Math.cos(am) * R * 1.1, iy + Math.sin(am) * R * 1.1], [ix + Math.cos(a1) * R, iy + Math.sin(a1) * R]];
          const sh = document.createElement('div'); sh.style.cssText = `position:absolute;inset:0;will-change:transform,opacity;clip-path:polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
          sh.appendChild(i ? face.cloneNode(true) : face); host.appendChild(sh);
          const v = Math.min(b.w, b.h) * (.18 + rnd() * .2), vx = Math.cos(am) * v, vy = Math.sin(am) * v * .5, rot = (rnd() - .5) * 24;
          sh.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(vx * .4).toFixed(1)}px,${(vy * .4).toFixed(1)}px) rotate(${(rot * .3).toFixed(1)}deg)`, opacity: 1, offset: .25 },
            { transform: `translate(${vx.toFixed(1)}px,${(vy + b.h * .9).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`, opacity: 0 }], { duration: 620 + rnd() * 180, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' });
        }
        web0.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
        setTimeout(() => { src.style.visibility = ''; done(); }, 240);
        setTimeout(() => host.remove(), 900);
      }, 300);
    });
  }
  // 1.12.6: a burst that stays inside a card (Team Death Battle / Death Battle): a flash, a ring and a few sparks, all in a
  // layer clipped to the card, so nothing spills onto the cards next to it. Only transform and opacity move.
  function cardBurst(card, { x = .5, y = .5, col = T.acc, n = 10, ring: rg = true, flash = true, dur = 620 } = {}) {
    if (!card || POTATO()) return;
    const L = document.createElement('div'); L.className = 'cfx'; L.style.setProperty('--c', col);
    const px = (x * 100).toFixed(1) + '%', py = (y * 100).toFixed(1) + '%';
    let h = flash ? `<i class="fl" style="left:${px};top:${py}"></i>` : '';
    if (rg) h += `<i class="rg" style="left:${px};top:${py}"></i>`;
    for (let k = 0; k < n; k++) h += `<i class="sp" style="left:${px};top:${py};--a:${Math.round(k * 360 / n + (Math.random() * 20 - 10))}deg"></i>`;
    L.innerHTML = h; card.appendChild(L);
    const fl = L.querySelector('.fl'), r = L.querySelector('.rg');
    if (fl) fl.animate([{ opacity: .9, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: dur * .7, easing: 'ease-out', fill: 'forwards' });
    if (r) r.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.15)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    L.querySelectorAll('.sp').forEach(sp => { const d = 30 + Math.random() * 40; sp.animate([{ opacity: 1, transform: `rotate(var(--a)) translateX(4px) scaleX(1)` }, { opacity: 0, transform: `rotate(var(--a)) translateX(${d}px) scaleX(.3)` }], { duration: dur * (.7 + Math.random() * .4), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }); });
    setTimeout(() => L.remove(), dur * 1.2);
  }
  function flashEl(el, dur = 260) { if (el && !POTATO() && !CALM()) el.animate([{ filter: 'brightness(3.2) saturate(0)' }, { filter: 'none' }], { duration: dur }); }
  function vignette(color = BLOOD, peak = .5, dur = 700) { if (POTATO()) return; const v = document.createElement('div'); v.className = 'sbf-vig'; v.style.setProperty('--vc', color); document.body.appendChild(v); v.animate([{ opacity: 0 }, { opacity: peak }, { opacity: 0 }], { duration: dur }).onfinish = () => v.remove(); }
  // 1.12.21: the shake keeps the page's scale — the body now carries the scale of a 720p, 1440p or 4K source in its transform, and a
  // shake written as a bare translate dropped it for as long as the shake lasted. Sized to the page, too.
  window.__SB_SHAKE = (px, dur) => screenShake(px, dur);       // 1.12.23: the VS hit and the Bracket reset splash (sb-story.js)
  function screenShake(px = 8, dur = 380) { if (POTATO() || CALM()) return; const k = scaleK(), sc = Math.abs(k - 1) < .004 ? '' : ` scale(${k})`; document.body.animate([0, -px, px, -px * .7, px * .5, -px * .3, 0].map((x, i) => ({ transform: `translate(${(x * k).toFixed(1)}px,${((i % 2 ? -x * .4 : x * .3) * k).toFixed(1)}px)${sc}` })), { duration: dur }); }
  // (1.3.5) a full-screen splash is up (the Victory Splash, or a format splash): the moments wait or step aside
  // (a Layout Designer layout's own splashes count too: any of its full-screen scenes on screen, or still leaving)
  const splashUp = () => document.documentElement.classList.contains('sb-victory-on') || !!document.querySelector('.sd-scene.sd-splash:not(.sd-hidden):not(.sd-warm)') || !!(document.getElementById('sb-victory') || {}).classList?.contains('vc-out') || (typeof spKind !== 'undefined' && !!spKind);
  // (1.3.6) a splash takes the screen: everything left over from the last moment goes (rings, stamps, counts, bands,
  // slashes, pieces), so nothing hangs over it
  function purgeFx() {
    document.querySelectorAll('.sbf-band, .sp-tb, .sbf-stamp, .sbf-count, .sbf-ring, .sbf-slash, .sbf-frag, .sbf-vig').forEach(x => x.remove());
    sparks.length = 0; ctx.clearRect(0, 0, W, H);
  }
  new MutationObserver(() => { const h = document.documentElement.classList; if (h.contains('sb-victory-on') || h.contains('sd-splash-on')) { purgeFx(); lockClose(true); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  // the heartbeat line (last life): a faint trace with a bright beat running along it
  const ECG_D = 'M0 12H30L33 10L36 12H42L46 2L50 19L54 12H60L64 9L68 12H130L133 10L136 12H142L146 2L150 19L154 12H160L164 9L168 12H200';
  const ecgHTML = () => `<svg class="sbf-ecg" viewBox="0 0 200 20" preserveAspectRatio="none"><path class="tr" d="${ECG_D}" pathLength="200"/><path class="run" d="${ECG_D}" pathLength="200"/></svg>`;
  // the moment a fighter goes down to their last life: a heartbeat is drawn across their bar, flat line first, then it kicks
  function ecgSweep(el, { color = BLOOD, dur = 1100 } = {}) {
    if (!el || POTATO()) return;
    // 1.12.6: on a card (Team Death Battle / Death Battle) the trace runs inside the card, clipped to it; elsewhere over the piece.
    // The glow is a wider soft stroke under the line (no drop-shadow filter to redraw every frame).
    const inside = el.matches('.td-card'), b = boxOf(el), w = document.createElement('div');
    const pos = inside ? 'position:absolute;left:0;top:15%;width:100%;height:70%;z-index:3' : `position:fixed;left:${b.x}px;top:${b.y + b.h * .15}px;width:${b.w}px;height:${b.h * .7}px;z-index:9452`;
    const d = 'M0 22H70L76 18L82 22H92L100 2L108 38L116 22H126L134 16L142 22H200', st = 'stroke-dasharray:1;stroke-dashoffset:1';
    w.innerHTML = `<svg viewBox="0 0 200 40" preserveAspectRatio="none" style="${pos};pointer-events:none;overflow:visible"><path d="${d}" pathLength="1" fill="none" stroke="${color}" stroke-opacity=".45" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" style="${st}"/><path d="${d}" pathLength="1" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" style="${st}"/><path d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" style="${st}"/></svg>`;
    const svg = w.firstChild; (inside ? el : document.body).appendChild(svg);
    svg.querySelectorAll('path').forEach(path => path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: dur, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' }));
    svg.animate([{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: dur + 700, fill: 'forwards' }).onfinish = () => svg.remove();
    setTimeout(() => {
      if (inside) cardBurst(el, { col: color, n: 0, flash: true });
      else { const [x, y] = [b.x + b.w * .5, b.y + b.h * .5]; ring(x, y, 180, color, 500); }
      el.animate([{ opacity: 1 }, { opacity: .7 }, { opacity: 1 }, { opacity: .82 }, { opacity: 1 }], { duration: 640 });
    }, dur * .5);
  }
  // a new name, smoothly: it wipes in from the side it is read from, out of a soft blur (no scrambled letters)
  function reveal(el, { from = 'left', dur = 420, delay = 0 } = {}) {
    if (!el || POTATO()) return;
    const hide = from === 'right' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
    el.animate([{ clipPath: hide, opacity: .2, transform: `translateX(${from === 'right' ? 8 : -8}px)`, filter: 'blur(3px)' }, { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'none', filter: 'none' }],
      { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  }
  function stamp(html, x, y, { dur = 2000, rot = -6, align = 'left' } = {}) {
    if (POTATO() || splashUp()) return null;
    const s = document.createElement('div'); s.className = 'sbf-stamp'; s.innerHTML = html; s.style.cssText = `left:${x}px;top:${y}px;transform-origin:${align} center`;
    if (align === 'right') { s.style.left = ''; s.style.right = `${W - x}px`; s.style.textAlign = 'right'; }
    document.body.appendChild(s);
    if (CALM()) { s.style.transform = `rotate(${rot}deg)`; s.animate([{ opacity: 0 }, { opacity: 1, offset: .16 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration: dur, fill: 'forwards' }).onfinish = () => s.remove(); return s; }
    s.animate([{ transform: `rotate(${rot}deg) scale(2.6)`, opacity: 0, filter: 'blur(8px)' }, { transform: `rotate(${rot}deg) scale(.94)`, opacity: 1, filter: 'none', offset: .16 }, { transform: `rotate(${rot}deg) scale(1)`, opacity: 1, offset: .22 }, { transform: `rotate(${rot}deg) scale(1)`, opacity: 1, offset: .82 }, { transform: `rotate(${rot}deg) translateY(-14px)`, opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }).onfinish = () => s.remove();
    return s;
  }
  const SKULL = `<svg class="skull" viewBox="0 0 24 24"><path fill="${BLOOD}" fill-rule="evenodd" d="M12 2.5a8 8 0 0 0-8 8c0 2.7 1.3 4.4 2.7 5.5V19.5a1 1 0 0 0 1 1h1.8v-2.2h1.6v2.2h1.8v-2.2h1.6v2.2h1.8a1 1 0 0 0 1-1v-3.5c1.4-1.1 2.7-2.8 2.7-5.5a8 8 0 0 0-8-8zM8.7 9.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6.6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 14l-1.2 2h2.4z"/><path d="M14 3l-2 4 2 2-2 3" stroke="${ONI ? '#fdfbf6' : '#040406'}" stroke-width="1.1" fill="none"/></svg>`;
  const CROWN = cls => `<svg class="${cls}" viewBox="0 0 40 32"><defs><linearGradient id="sbfg${cls}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone('#fff4cf')}"/><stop offset=".5" stop-color="${tone('#f6c453')}"/><stop offset="1" stop-color="${tone('#8a5a12')}"/></linearGradient></defs><path d="M3 26 1 7l10 8 9-13 9 13 10-8-2 19z" fill="url(#sbfg${cls})" stroke="${ONI ? '#141210' : '#3a2405'}" stroke-width="1.5" stroke-linejoin="round"/><rect x="3" y="26" width="34" height="5" rx="1" fill="url(#sbfg${cls})" stroke="${ONI ? '#141210' : '#3a2405'}" stroke-width="1.2"/><circle cx="20" cy="17" r="2.6" fill="${BLOOD}"/></svg>`;
  // Team Death Battle: a life crest — an original drawing: a cut gem in a hex socket, in the team's colour. Full, cracked
  // and partly drained (a set lost when a life is worth more than one set), or an empty socket.
  const shade = (c, k) => { const [r, g, b] = hex(c); const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  function crest(state, color, drain = 0, size = 22) {
    const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : tone(PORC ? '#b8901f' : ONI ? '#b3060f' : '#ff5a1f'), id = `sbcr${c.slice(1)}${Math.round(drain * 100)}`;
    const sock = `<path d="M14 1l12 7v16l-12 7-12-7V8z" fill="${state === 'gone' ? 'rgba(0,0,0,.42)' : 'rgba(0,0,0,.62)'}" stroke="${c}" stroke-width="${state === 'gone' ? 1.3 : 1.9}" stroke-opacity="${state === 'gone' ? .5 : 1}"/>`;
    if (state === 'gone') return `<svg class="sbf-cr gone" viewBox="0 0 28 32" style="width:${size}px;height:${(size * 32 / 28).toFixed(1)}px">${sock}<path d="M9.5 12l9 8M18.5 12l-9 8" stroke="${c}" stroke-opacity=".55" stroke-width="1.7" stroke-linecap="round"/></svg>`;
    return `<svg class="sbf-cr ${state}" viewBox="0 0 28 32" style="width:${size}px;height:${(size * 32 / 28).toFixed(1)}px"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, .75)}"/><stop offset=".38" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -.6)}"/></linearGradient><clipPath id="${id}c"><rect x="0" y="${(4 + 24 * drain).toFixed(1)}" width="28" height="32"/></clipPath></defs>${sock}
      <path d="M14 5l8.5 5v12L14 27l-8.5-5V10z" fill="url(#${id})" clip-path="url(#${id}c)"/><path d="M14 5l8.5 5L14 14.6 5.5 10z" fill="#fff" opacity=".4" clip-path="url(#${id}c)"/>
      <path d="M14 11.2l1.5 3.3 3.3 1.5-3.3 1.5L14 20.8l-1.5-3.3-3.3-1.5 3.3-1.5z" fill="#fff" opacity="${state === 'hurt' ? .55 : .95}"/>${state === 'hurt' ? '<path d="M8.6 9.6l3.8 4.6-2.2 3 3.6 6.2M19.6 11l-2.9 3.9 1.5 2.4" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".9"/>' : ''}</svg>`;
  }
  function crests(lives, max, hits, per, color, size) {
    let h = ''; for (let k = 0; k < Math.max(1, max); k++) { const st = k < lives ? (k === lives - 1 && hits ? 'hurt' : 'full') : 'gone'; h += crest(st, color, st === 'hurt' ? Math.min(.85, hits / Math.max(1, per)) : 0, size); }
    return `<span class="sbf-crs">${h}</span>`;
  }
  const gems = (n, max, big) => `<span class="sbf-lv${big ? ' lg' : ''}">${Array.from({ length: Math.max(1, max) }, (_, k) => `<i class="${k < n ? '' : 'gone'}"></i>`).join('')}</span>`;
  const S = () => {};            // (the format moments had built-in sounds here; layouts have none since 2.0.0)
  // a band slashing across the screen: NEXT CHALLENGER, ELIMINATED, LAST STAND…
  let bandQ = Promise.resolve();
  function band(top, name, sub, color = T.acc, { hold = 1800, from = 1, y = 440, snd = 'slash' } = {}) {
    const asked = Date.now();
    bandQ = bandQ.then(async () => {
      if (POTATO() || Date.now() - asked > 5000 || spKind || vsOn || splashUp()) return;          // results came in fast (skip the stale ones), or a splash is up
      const b = document.createElement('div'); b.className = 'sbf-band'; b.style.cssText = `--bc:${color};--bca:${color}4d;--bcb:${color}${ONI ? '40' : 'b3'};top:${y}px`;
      b.innerHTML = `<div class="in"><span class="t">${esc(top)}</span><span class="n">${esc(name)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}</div>`;
      document.body.appendChild(b); if (snd) S(snd);
      if (CALM()) { b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, fill: 'backwards' }); await sleep(320 + hold); b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }); await sleep(330); b.remove(); await sleep(120); return; }
      b.animate([{ clipPath: from > 0 ? 'polygon(0 0,0 0,-10% 100%,-10% 100%)' : 'polygon(110% 0,110% 0,100% 100%,100% 100%)' }, { clipPath: 'polygon(0 0,110% 0,100% 100%,-10% 100%)' }], { duration: 420, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
      decode(b.querySelector('.n'), 520);
      await sleep(420 + hold);
      shatter(b, { n: 14, dir: from, power: .8, color, fall: 650 }); b.remove(); S('vsOut');
      await sleep(250);
    });
  }

  // ===================================================================================== state
  let F = null, V = null, ST = {}, seq = -1, booted = false, vsOn = false;
  const PRESET = () => (F && F.preset) || ({ teams: 'crew', death: 'death' }[MODE] || MODE);
  const live = () => !!(F && F.status !== 'setup');
  const fighterByName = nm => V && V.fighters && V.fighters.find(x => same(x.name, nm));
  // 1.12.6: Death Battle wears Team Death Battle's look. With no teams, each fighter keeps a colour of their own
  const FCOL = ['#ff5a1f', '#3fb6ff', '#ffc93c', '#5ee08a', '#b388ff', '#ff6fae', '#4fe0d8', '#e8e1d0'];
  const fcol = x => { const i = Math.max(0, (V && V.fighters ? V.fighters.findIndex(y => y.id === x.id) : 0)); return ST.fx && ST.fx.teamCol === false ? (PORC ? ['#c9a13b', '#d8cfb8'] : [T.acc, T.two])[i % 2] : FCOL[i % FCOL.length]; };
  const isDeath = () => !!(V && V.kind === 'elim' && PRESET() !== 'koth');
  /** who's on a side, for the Player VS: a team format's player, or a Death Battle fighter */
  function vsSlot(nm) {
    const t = teamSlot(nm); if (t) return t;
    if (!isDeath()) return null;
    const x = fighterByName(nm); if (!x) return null;
    return { t: -1, i: V.fighters.indexOf(x), team: { name: '', color: fcol(x), size: V.fighters.length, left: V.alive }, p: { ...x, hits: 0 } };
  }
  // which team / slot a scoreboard side belongs to (by name, so a manual side swap still lines up)
  function teamSlot(nm) { if (!V || !V.teams) return null; for (const [t, tm] of V.teams.entries()) { const j = tm.players.findIndex(p => same(p.name, nm)); if (j >= 0) return { t, i: j, team: tm, p: tm.players[j] }; } return null; }
  const plate = k => document.getElementById('plate' + k) || document.getElementById('el-p' + k);
  const plateFor = nm => [1, 2].map(plate).find((p, i) => p && same((ST['p' + (i + 1)] || {}).name, nm)) || null;

  // ===================================================================================== on the player bars
  function renderPlates() {
    for (const k of [1, 2]) {
      const p = plate(k); if (!p) continue;
      // a Layout Designer plate with a second line (1.11): lives, standing and the rest go on that line, inside the plate —
      // under it they sat on the game's health bar
      const sdl2 = p.querySelector('.sd-l2'), inPlate = !!(sdl2 && getComputedStyle(sdl2).display !== 'none');
      const line1 = p.querySelector('.line1') || p.querySelector('.el-l1'), line2 = p.querySelector('.line2') || p.querySelector('.el-l2') || (inPlate ? sdl2 : null), nm = (ST['p' + k] || {}).name;
      let lv = p.querySelector('.sbf-lv-slot'), l2 = p.querySelector('.sbf-l2');
      if (!lv && line1) { lv = document.createElement('span'); lv.className = 'sbf-lv-slot'; lv.style.cssText = 'display:inline-flex;flex:none'; const n = line1.querySelector('.name') || line1.querySelector('.el-name'); n ? n.after(lv) : line1.appendChild(lv); }
      if (!l2 && line2) { l2 = document.createElement('span'); l2.className = 'sbf-l2'; line2.prepend(l2); }
      if (l2 && ELF && !l2.dataset.ink) {             // an elemental plate: the format line takes the colour of the plate's own second line
        const pro = p.querySelector('.el-pro'); if (pro) { const cs = getComputedStyle(pro); l2.style.color = cs.color; l2.style.textShadow = cs.textShadow; l2.dataset.ink = 1; }
      }
      let lvH = '', l2H = '', cls = { 'sbf-lastlife': false, 'sbf-king': false };
      if (FULL && live() && F.status === 'live' && nm) {
        const pre = PRESET();
        if (V.kind === 'elim') {
          const x = fighterByName(nm);
          if (x && pre === 'koth') {
            if (x.king) { lvH = `<span class="sbf-lv">${CROWN('crn')}</span>`; l2H = `<b>KING</b> <i>·</i> STREAK ×${x.streak}`; cls['sbf-king'] = true; }
            else l2H = `<b>CHALLENGER</b>${x.wins ? ` <i>·</i> ${x.wins}W` : ''}`;
          } else if (x) {
            lvH = crests(x.lives, Math.max(x.maxLives, x.lives), 0, 1, fcol(x), inPlate ? 19 : 24);
            l2H = x.lives === 1 && x.maxLives > 1 ? '<b>LAST LIFE</b>' : `${x.lives} ${x.lives === 1 ? 'LIFE' : 'LIVES'}`;
            l2H += ` <i>·</i> ${V.alive} LEFT`;
            cls['sbf-lastlife'] = x.lives === 1 && !x.out;
          }
        } else if (V.kind === 'teams') {
          const s = teamSlot(nm);
          if (s) {
            const tc = `<span class="tc" style="${tcv(s.team.color)}"></span>`;
            if (V.mode === 'tdb') {
              lvH = crests(s.p.lives, Math.max(V.lives, s.p.lives), s.p.hits, V.per, s.team.color, inPlate ? 19 : 24);   // 1.12.6: bigger, easier to read
              l2H = `${tc}<b>${s.p.lives === 1 ? 'LAST LIFE' : `${s.p.lives} LIVES`}</b>${V.per > 1 ? ` <i>·</i> SET ${s.p.hits + 1}/${V.per}` : ''} <i>·</i> <span class="tn" data-tag="${esc(s.team.tag || '')}">${esc(s.team.name)}</span> ${s.team.left} LEFT`;
              cls['sbf-lastlife'] = s.p.lives === 1 && !s.p.out;
            } else
            if (pre === 'sajam') l2H = `${tc}<b>TIER ${s.i + 1}</b> <i>·</i> ${s.team.points} PT${s.team.points === 1 ? '' : 'S'}`;
            else if (pre === 'gauntlet') l2H = `${tc}<b>STAGE ${s.i + 1}</b> <i>/</i> ${s.team.size}${s.p.streak >= 2 ? ` <i>·</i> ×${s.p.streak}` : ''}`;
            else l2H = `${tc}<b>#${s.i + 1}</b> OF ${s.team.size} <i>·</i> ${s.team.left} LEFT${s.p.streak >= 2 ? ` <i>·</i> ×${s.p.streak} STREAK` : ''}`;
          }
        } else if (V.kind === 'league') {
          const r = (V.standings || []).find(x => same(x.name, nm));
          if (r) l2H = `<b>#${r.rank}</b> <i>·</i> ${r.wins}W ${r.losses}L`;
        }
      }
      if (inPlate && !line1) { l2H = lvH ? `<span class="sbf-lv-in">${lvH}</span>${l2H}` : l2H; lvH = ''; }   // no first line to put them on: the icons lead the second line
      const who = String(nm || '').toLowerCase(), newWho = lv && lv.dataset.who !== undefined && lv.dataset.who !== who;
      if (lv && lv.dataset.h !== lvH) {
        lv.dataset.h = lvH; lv.innerHTML = lvH;
        if (newWho && !POTATO() && !window.__SB_INSTANT) [...lv.querySelectorAll('.sbf-cr, .sbf-lv i, .sbf-lv svg')].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(-7px) scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160 + i * 80, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' }));
      }
      if (lv) lv.dataset.who = who;
      if (l2 && l2.dataset.h !== l2H) { l2.dataset.h = l2H; l2.innerHTML = l2H; l2.style.fontSize = ''; l2.dataset.fit = ''; if (!POTATO() && !window.__SB_INSTANT) l2.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'ease-out' }); }
      if (inPlate) sdl2.classList.toggle('sbf-has', !!l2H);
      // 1.12.21: the line stays inside the plate. Too long for it (Team Death Battle with a long team name: “3 lives · Ember
      // Ravens of the North 4 left” ran on under the score): the team's name gives way to its tag, then the lettering gets
      // a little smaller — it used to run out of the plate at both ends.
      if (l2 && inPlate && l2H && !l2.dataset.fit && sdl2.clientWidth) {
        l2.dataset.fit = '1'; const over = () => sdl2.scrollWidth > sdl2.clientWidth + 1;
        if (over()) { const tn = l2.querySelector('.tn'); if (tn && tn.dataset.tag && tn.dataset.tag.length < tn.textContent.length) tn.textContent = tn.dataset.tag; }
        for (let k2 = .94; over() && k2 >= .7; k2 -= .06) l2.style.fontSize = k2.toFixed(2) + 'em';
      }
      // a layout without the built-in plate lines (Layout Designer layouts): the same info as a tag under the bar
      if (!line1 && !line2) {      // (no second line on the plate either)
        let tag = document.getElementById('sbf-tag' + k);
        if (!tag) { tag = document.createElement('div'); tag.id = 'sbf-tag' + k; tag.className = 'sbf-tag'; root.appendChild(tag); }
        const html = lvH || l2H ? `${lvH}<span class="sbf-l2">${l2H}</span>` : '';
        if (tag.dataset.h !== html) { tag.dataset.h = html; tag.innerHTML = html; }
        tag.classList.toggle('on', !!html);
        if (html) { const b = boxOf(p), right = k === 2; tag.style.top = Math.round(b.y + b.h + 6) + 'px'; tag.style.left = right ? '' : Math.round(b.x) + 'px'; tag.style.right = right ? Math.round(W - b.x - b.w) + 'px' : ''; tag.style.justifyContent = right ? 'flex-end' : 'flex-start'; }
        for (const [c, on] of Object.entries(cls)) tag.classList.toggle(c, on);
      }
      { const fx = nm && FULL && live() && F && F.status === 'live' ? (V.kind === 'teams' ? ((teamSlot(nm) || {}).team || {}).color : isDeath() ? (fighterByName(nm) ? fcol(fighterByName(nm)) : '') : '') : '';
        plateTint(p, /^#[0-9a-f]{6}$/i.test(fx || '') ? fx : '', k === 2); }
      for (const [c, on] of Object.entries(cls)) p.classList.toggle(c, on);
      const host = p.querySelector('.body') || p; let ecg = host.querySelector(':scope > .sbf-ecg');
      if (cls['sbf-lastlife'] && !ecg) { host.insertAdjacentHTML('beforeend', ecgHTML()); ecg = host.lastElementChild; if (!POTATO()) ecg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }); }
      else if (!cls['sbf-lastlife'] && ecg) ecg.remove();
    }
  }

  // 1.12.6: in a team format (and Death Battle) the player bars take on the colour of that player's team: a wash of it from the
  // outer edge, inside the bar's own shape, and the bar's own effects (the light flow, the sheen, the cracks) in that colour too.
  // Everything goes back to the layout's colours when the format ends.
  const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgbaHex = (h, a) => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return `rgba(${v.join(',')},${a})`; };
  const FXV = ['--c', '--c2', '--c3', '--cA', '--cB'];
  function plateTint(p, col, right) {
    if ((p.dataset.tcol || '') === col) return;
    p.dataset.tcol = col;
    const host = p.querySelector('.sd-fx') || p.querySelector('.skin');
    let w = p.querySelector('.sbf-tw');
    const layers = [...p.querySelectorAll('.fxe,.fxs,.fxo')];
    if (!col) {
      if (w) { if (POTATO()) w.remove(); else w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => w.remove(); }
      for (const n of layers) if (n.dataset.c0 != null) { const o = JSON.parse(n.dataset.c0); FXV.forEach(v => o[v] ? n.style.setProperty(v, o[v]) : n.style.removeProperty(v)); delete n.dataset.c0; }
      if (p.dataset.fxc0 != null) { p.dataset.fxc0 ? p.style.setProperty('--fxc', p.dataset.fxc0) : p.style.removeProperty('--fxc'); delete p.dataset.fxc0; }
      return;
    }
    if (host && !w) { w = document.createElement('i'); w.className = 'sbf-tw'; host.prepend(w); if (!POTATO()) w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }); }
    if (w) w.style.background = `linear-gradient(${right ? 270 : 90}deg,${rgbaHex(col, ONI ? .34 : .5)},${rgbaHex(col, ONI ? .12 : .18)} 48%,${rgbaHex(col, 0)} 86%)`;
    for (const n of layers) {
      if (n.dataset.c0 == null) n.dataset.c0 = JSON.stringify(Object.fromEntries(FXV.map(v => [v, n.style.getPropertyValue(v)])));
      n.style.setProperty('--c', col); n.style.setProperty('--c2', mixHex(col, '#ffffff', .45)); n.style.setProperty('--c3', mixHex(col, '#000000', .5)); n.style.setProperty('--cA', rgbaHex(col, .35)); n.style.setProperty('--cB', rgbaHex(col, .7));
    }
    if (p.dataset.fxc0 == null) p.dataset.fxc0 = p.style.getPropertyValue('--fxc') || '';
    p.style.setProperty('--fxc', col);
  }

  // ===================================================================================== the format bar (bottom)
  let bar = null, fitT = 0;
  // (BeeboScore prototype build) a side of the bar is updated piece by piece, not rewritten: a piece that is still there
  // keeps its element, so a change of state (playing, out, a life gone) eases over with the CSS transitions instead of
  // jumping, and running glints and glows carry on. A new piece fades in; a piece that leaves fades out.
  const tpl = document.createElement('template');
  function morph(side, html, first) {
    tpl.innerHTML = html;
    const next = [...tpl.content.children], old = new Map(), fresh = [];
    for (const el of [...side.children]) { if (el.dataset.k && !el.classList.contains('leaving')) old.set(el.dataset.k, el); else if (!el.classList.contains('leaving')) el.remove(); }
    let at = side.firstChild;
    for (const n of next) {
      let el = old.get(n.dataset.k);
      if (el) {
        old.delete(n.dataset.k);
        if (el.className !== n.className) el.className = n.className;
        if ((el.getAttribute('style') || '').replace(/\s*width:[^;]*;?/, '') !== (n.getAttribute('style') || '')) { const w = el.style.width; el.setAttribute('style', n.getAttribute('style') || ''); if (w) el.style.width = w; }
        keepFit(el, n);
        if (el.innerHTML !== n.innerHTML) patchInner(el, n);
      } else {
        el = document.importNode(n, true); fresh.push(el);     // (adopted into this page first: an animation started on the template's own copy never runs)
      }
      if (el !== at) side.insertBefore(el, at); else at = at.nextSibling;
      at = el.nextSibling;
    }
    if (!first && !POTATO()) for (const el of fresh) el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1)' });
    for (const el of old.values()) {
      if (first || POTATO()) { el.remove(); continue; }
      el.classList.add('leaving');
      el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 260, fill: 'forwards' }).onfinish = () => el.remove();
    }
  }
  // 1.12.21: a fitted name keeps its fit through a change. A piece's new HTML has its name as written, and a fitted name (on two
  // lines, a size down) no longer is — so every change to a side rewrote each piece that had one: long names sprang back to one line
  // ending in “…” until the fit ran again half a second later (after every result), and the piece's running glints started over.
  // The fit is carried into the new HTML when the name is the same; the fit that follows still measures everything afresh.
  function keepFit(el, n) {
    const a = el.querySelectorAll('.sbf-nm'), b = n.querySelectorAll('.sbf-nm'); if (!a.length || a.length !== b.length) return;
    a.forEach((x, i) => { const y = b[i];
      if (x.textContent !== y.textContent || y.attributes.length !== 1 || !(x.classList.contains('two') || x.classList.contains('two2') || x.getAttribute('style'))) return;
      for (const at of [...x.attributes]) y.setAttribute(at.name, at.value);
      if (x.innerHTML !== y.innerHTML) y.innerHTML = x.innerHTML; });
  }
  // inside a piece: only the parts that changed (the lives row, the name, the K.O. badge…), so the rest stays put
  function patchInner(el, n) {
    const a = [...el.children], b = [...n.children];
    if (a.length !== b.length || a.some((c, i) => c.tagName !== b[i].tagName || c.className !== b[i].className && !c.matches('.td-card,.sbf-nm,.td-lv,.k,.x'))) { el.innerHTML = n.innerHTML; return; }
    a.forEach((c, i) => { if (c.outerHTML !== b[i].outerHTML) { if (c.className !== b[i].className) c.className = b[i].className; if (c.innerHTML !== b[i].innerHTML) c.innerHTML = b[i].innerHTML; } });
    // text nodes between the elements (rare): fall back to a full rewrite
    if (el.innerHTML !== n.innerHTML) el.innerHTML = n.innerHTML;
  }
  function renderBar(first) {
    if (!FULL) return;
    if (!bar) { bar = document.createElement('div'); bar.id = 'sbf-bar'; bar.className = 'off'; bar.innerHTML = '<div class="bl"></div><div class="bc"><small></small><b></b><em></em></div><div class="br"></div>'; root.appendChild(bar); fitWatch(bar); }
    const show = live() && ST.fbar !== false && !!V;
    bar.classList.toggle('off', !show);
    root.className = 'f-' + PRESET();
    if (!V) return;
    const pre = PRESET(), L = [], R = []; let small = '', big = '', em = '';
    const item = (o) => `<div class="it ${o.cls || ''}${o.p && o.p.pic ? ' haspic' : ''}" data-k="${esc(o.key)}" style="${o.tc ? `${tcv(o.tc)}` : ''}"><i class="ed"></i>${o.pre || ''}${o.k != null ? `<span class="k">${o.kh || esc(o.k)}</span>` : ''}${picSpan(o.p, 'chip')}<span class="sbf-nm">${esc(o.n)}</span>${o.x ? `<span class="x">${o.x}</span>` : ''}${o.post || ''}</div>`;
    if (V.kind === 'teams' && V.mode === 'tdb') {
      // every fighter as a card: lives on top, then the picture (name across it) or the name + character line
      const lastL = p => p.lives === 1 && Math.max(V.lives, p.lives) > 1 && p.state !== 'out';
      const card = (p, ti, j, t) => `<div class="it td ${p.state}${p.pic || p.charPic ? ' pics' : ''}${lastL(p) ? ' lastlife' : ''}" data-k="t${ti}-${j}" style="${tcv(t.color)}"><div class="td-lv">${crests(p.lives, Math.max(V.lives, p.lives), p.hits, V.per, t.color, 13)}</div>
        <div class="td-card">${picSpan(p, 'fill')}<span class="sbf-nm">${esc(p.name)}</span>${lastL(p) ? ecgHTML() : ''}<span class="td-ko">${SKULL}K.O.</span></div></div>`;
      V.teams.forEach((t, ti) => {
        const out = ti ? R : L;
        // 1.12.6: the team's box — its name in the middle (or over its logo, when it has one) and its lives, bigger, on top
        out.push(`<div class="it td team${t.logo ? ' logo' : ''}" data-k="team${ti}" style="${tcv(t.color)}"><div class="td-lv tl"><span class="sbf-crs">${crest('full', t.color, 0, 18)}</span><b>${t.livesLeft}</b></div><div class="td-card"><span class="sbf-nm">${esc(t.name)}</span>${t.logo ? `<img class="tlogo" src="${esc(t.logo)}" alt="">` : ''}<span class="td-ch">${t.left} OF ${t.size} LEFT</span></div></div>`);
        t.players.forEach((p, j) => out.push(card(p, ti, j, t)));
      });
      const A = V.teams[0], B = V.teams[1];
      small = `TEAM DEATH BATTLE · BATTLE ${(F.match && F.match.n) || V.n}`;
      big = `<span class="tag" data-tag="${esc(A.tag || '')}" style="${tcv(A.color)}">${esc(A.name)}</span>${crest('full', A.color, 0, 20)}${A.livesLeft} – ${B.livesLeft}${crest('full', B.color, 0, 20)}<span class="tag" data-tag="${esc(B.tag || '')}" style="${tcv(B.color)}">${esc(B.name)}</span>`;
      em = V.switchOpen ? 'SWITCH WINDOW · BOTH TEAMS MAY SWAP' : `${V.lives} ${V.lives === 1 ? 'LIFE' : 'LIVES'} EACH · ${V.per === 1 ? '1 SET = 1 LIFE' : `${V.per} SETS = 1 LIFE`}`;
    } else if (V.kind === 'teams') {
      const tiers = F.rules.tiers || pre === 'sajam';
      V.teams.forEach((t, ti) => {
        const out = ti ? R : L;
        out.push(item({ key: 'team' + ti, cls: 'team', tc: t.color, pre: t.logo ? `<img class="tlg" src="${esc(t.logo)}" alt="">` : '', n: t.name, x: V.mode === 'paired' ? `${t.points}` : `${t.left}` }));
        t.players.forEach((p, j) => out.push(item({ key: `t${ti}-${j}`, p, cls: p.state + (t.laststand && p.state !== 'out' ? ' lit' : ''), tc: t.color, k: pre === 'gauntlet' ? `S${j + 1}` : tiers ? `T${j + 1}` : `${j + 1}`, n: p.name, x: V.mode === 'stay' && p.state === 'playing' && p.streak >= 2 ? `×${p.streak}` : '' })));
        if (t.coach && V.mode === 'paired') out.push(item({ key: `t${ti}-coach`, cls: 'coach' + (V.tiebreak ? ' playing' : ''), tc: t.color, k: '', kh: ICON('crown'), n: t.coach }));
      });
      if (pre === 'sajam') {
        const m = F.match; small = `TEAM BATTLE${m && !m.tiebreak ? ` · TIER ${m.pair + 1}` : V.tiebreak ? ' · TIEBREAKER' : ''}`;
        big = `<span class="sbf-pips" style="${tcv(V.teams[0].color)}">${Array.from({ length: V.goal }, (_, k) => `<i class="${k < V.teams[0].points ? 'on' : ''}"></i>`).join('')}</span>${V.teams[0].points} – ${V.teams[1].points}<span class="sbf-pips" style="${tcv(V.teams[1].color)}">${Array.from({ length: V.goal }, (_, k) => `<i class="${k < V.teams[1].points ? 'on' : ''}"></i>`).join('')}</span>`;
        em = `FIRST TO ${V.goal} POINTS`;
      } else if (pre === 'gauntlet') {
        small = `GAUNTLET · MATCH ${(F.match && F.match.n) || V.n}`; big = `${V.teams[0].left} – ${V.teams[1].left}`; em = 'STILL STANDING';
      } else { small = `CREW BATTLE · MATCH ${(F.match && F.match.n) || V.n}`; big = `<span class="tag" data-tag="${esc(V.teams[0].tag || '')}" style="${tcv(V.teams[0].color)}">${esc(V.teams[0].name)}</span>${V.teams[0].left} – ${V.teams[1].left}<span class="tag" data-tag="${esc(V.teams[1].tag || '')}" style="${tcv(V.teams[1].color)}">${esc(V.teams[1].name)}</span>`; em = 'PLAYERS LEFT'; }
    } else if (V.kind === 'elim') {
      if (pre === 'koth') {
        // the king on the left; the challengers queue on the right, the one fighting now nearest the middle
        const k = V.fighters.find(x => x.king);
        if (k) {                         // 1.12.6: the king's card, in a frame of its own (the rim and the glow sit outside the card's cut)
          const t = Math.floor(k.streak / 10), cl = t >= 3 ? 's3' : t === 2 ? 's2' : t === 1 ? 's1' : '';
          L.push(`<div class="kw ${cl}${k.state === 'playing' ? ' on' : ''}" data-k="${esc(k.id)}" style="--kn:${Math.min(t, 8)}"><i class="kg"></i><i class="kb"><i></i></i><i class="kf"><i></i><i></i><i></i><i></i><i></i></i><i class="kp"><i></i><i></i><i></i><i></i><i></i></i>${item({ key: k.id, cls: 'king' + (k.state === 'playing' ? ' playing' : ''), pre: CROWN('crn'), n: k.name, x: `×${k.streak}` })}</div>`);
        }
        if (k && k.best > k.streak) L.unshift(item({ key: 'best', cls: 'out', k: 'BEST', n: `×${V.bestStreak || k.best}` }));
        const others = V.fighters.filter(x => !x.king && !x.out);
        const q = (F.queue || []).map(id => others.find(x => x.id === id)).filter(Boolean);
        let order = others.filter(x => x.state === 'playing').concat(q.filter(x => x.state !== 'playing'), others.filter(x => x.state !== 'playing' && !q.includes(x)));
        if (!k) {                        // no king yet: the opening fight is for the crown — one fighter on each side, like the scoreboard
          const first = order.find(x => x.state === 'playing');
          if (first) { L.push(item({ key: first.id, cls: 'playing', k: 'VS', n: first.name, x: first.wins ? `${first.wins}W` : '' })); order = order.filter(x => x !== first); }
        }
        order.slice(0, 5).forEach((x, i) => R.unshift(item({ key: x.id, cls: x.state, k: x.state === 'playing' ? 'VS' : x.state === 'next' ? 'NEXT' : `${i}`, n: x.name, x: x.wins ? `${x.wins}W` : '' })));
        if (order.length > 5) R.unshift(item({ key: 'more', cls: 'out', n: `+${order.length - 5}` }));
        small = 'KING OF THE HILL'; big = `${CROWN('crn')}×${V.streak}`; em = V.king ? `${V.king} · WIN STREAK` : 'NO KING YET';
        if (F.rules.streakGoal) em += ` · GOAL ${F.rules.streakGoal}`;
      } else {
        // survivors from the middle outwards (the two fighting nearest the centre), the fallen at the far ends
        const alive = V.fighters.filter(x => !x.out).sort((a, b) => (b.state === 'playing') - (a.state === 'playing') || (b.state === 'next') - (a.state === 'next') || b.lives - a.lives);
        const dead = V.fighters.filter(x => x.out).sort((a, b) => b.place - a.place);
        const lastD = x => x.lives === 1 && Math.max(x.maxLives, x.lives) > 1 && !x.out;
        const chip = x => `<div class="it td ${x.out ? 'out' : x.state}${x.pic ? ' pics' : ''}${lastD(x) ? ' lastlife' : ''}" data-k="${esc(x.id)}" style="${tcv(fcol(x))}"><div class="td-lv">${crests(x.lives, Math.max(x.maxLives, x.lives), 0, 1, fcol(x), 13)}</div>
        <div class="td-card">${picSpan(x, 'fill')}<span class="sbf-nm">${esc(x.name)}</span>${lastD(x) ? ecgHTML() : ''}<span class="td-ko">${SKULL}${x.out ? esc(ord(x.place)) : 'K.O.'}</span></div></div>`;
        alive.forEach((x, i) => (i % 2 ? R : L).unshift(chip(x)));
        dead.forEach((x, i) => (i % 2 ? R : L).unshift(chip(x)));
        small = 'DEATH BATTLE'; big = `${V.alive}<span style="font-size:20px;letter-spacing:3px;color:var(--muted)">REMAIN</span>`;
        em = `${F.rules.lives} ${F.rules.lives === 1 ? 'LIFE' : 'LIVES'} EACH · ${{ stay: 'WINNER STAYS', queue: 'QUEUE', random: 'RANDOM DRAW' }[F.rules.pick] || ''}`;
      }
    } else {
      const sd = V.standings || [], half = Math.ceil(sd.length / 2);
      sd.forEach((r, i) => (i < half ? L : R).push(item({ key: 'r' + r.name, cls: (r.rank === 1 ? 'rank1' : '') + ([ST.p1, ST.p2].some(p => p && same(p.name, r.name)) ? ' playing' : ''), k: `${r.rank}`, n: r.name, x: `${r.wins}–${r.losses}` })));
      small = 'LEAGUE'; big = `${V.played}<span style="font-size:20px;color:var(--muted)">/ ${V.total}</span>`; em = 'MATCHES PLAYED';
    }
    const lh = L.join(''), rh = R.join(''), most = Math.max(L.length, R.length);
    bar.classList.toggle('dense', most > 5); bar.classList.toggle('xdense', most > 8);     // 1.11: more fighters, smaller names — the bars never run into the middle
    const bl = bar.querySelector('.bl'), br = bar.querySelector('.br');
    // 1.12 (from the prototype): piece by piece — a piece that's still there keeps its element and eases into its new state
    let moved = first;
    if (bl.dataset.h !== lh) { bl.dataset.h = lh; morph(bl, lh, first); moved = true; }
    if (br.dataset.h !== rh) { br.dataset.h = rh; morph(br, rh, first); moved = true; }
    if (moved) mountPics(bar);
    const bc = bar.querySelector('.bc');
    setTxt(bc.querySelector('small'), small);
    const b = bc.querySelector('b'); if (b.dataset.h !== big) { b.dataset.h = big; b.innerHTML = big;
      // (1.12.21: the score's pop is as big as the box has room for — with two long team names beside the score, a pop of 1.35 pushed both out of the box for its half-second)
      if (!first && !POTATO()) { const pop = Math.max(1, Math.min(1.35, (bc.clientWidth - 14) / Math.max(1, b.scrollWidth || b.offsetWidth))); b.animate([{ transform: `scale(${pop.toFixed(3)})`, filter: 'brightness(2.4)' }, { transform: 'none', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' }); } }
    setTxt(bc.querySelector('em'), em); bc.querySelector('em').classList.toggle('sw', !!(V.mode === 'tdb' && V.switchOpen));
    // 1.12.6: the middle box between the cards blends one side's colour into the other's (the two teams, or the two fighters
    // in a Death Battle) — smoothly, through a soft middle
    { let ca = '', cb = '';
      if (V.kind === 'teams') { ca = (V.teams[0] || {}).color; cb = (V.teams[1] || {}).color; }
      else if (isDeath()) { const x1 = fighterByName((ST.p1 || {}).name), x2 = fighterByName((ST.p2 || {}).name); ca = x1 ? fcol(x1) : ''; cb = x2 ? fcol(x2) : ''; }
      const ok = c => /^#[0-9a-f]{6}$/i.test(c || ''), key = ok(ca) && ok(cb) ? ca + cb : '';
      if (bc.dataset.tc !== key) {
        bc.dataset.tc = key; bar.classList.toggle('tc2', !!key);
        if (key) { const m = mixHex(ca, cb, .5), A = ONI ? [.42, .14] : [.55, .2]; bc.style.setProperty('--bcg', `linear-gradient(90deg,${rgbaHex(ca, A[0])},${rgbaHex(ca, A[1])} 34%,${rgbaHex(m, A[1] * .7)} 50%,${rgbaHex(cb, A[1])} 66%,${rgbaHex(cb, A[0])})`); bc.style.setProperty('--bca', ca); bc.style.setProperty('--bcb', cb); }
      } }
    // measured when its pieces change: at once the first time, otherwise once a piece's change of width has played
    if (show) { if (first || bar.dataset.fitted !== '1') { fitBar(); requestAnimationFrame(() => fitBar()); } else if (moved) { clearTimeout(fitT); fitT = setTimeout(fitBar, 450); } }
  }
  // 1.11: players' own pictures and clips (a green screen keyed out by BeeboKey, public/sb-key.js), mounted once per element
  // 1.12.13: a player's character art (when the art library has a picture for the character they're on) comes first on
  // the format bar's cards, so the card follows their pick; otherwise their own picture
  const picSpan = (p, cls = '') => p && (p.charPic && cls === 'fill' || p.pic) ? (p.charPic && cls === 'fill' ? `<span class="sbf-pic ${cls} char" data-src="${esc(p.charPic)}" data-key="" data-ch="${esc(p.character || '')}"></span>` : `<span class="sbf-pic ${cls}" data-src="${esc(p.pic)}" data-key="${esc(p.picKey || '')}" style="${frameVars(p.name)}"></span>`) : '';
  function mountPics(box) {
    if (!box) return;
    for (const el of box.querySelectorAll('.sbf-pic[data-src]:not([data-on])')) {
      el.dataset.on = '1';
      if (window.BeeboKey) BeeboKey.media(el, el.dataset.src, el.dataset.key, { fit: el.classList.contains('vpic') ? 'contain' : 'cover' });
      else el.innerHTML = `<img src="${esc(el.dataset.src)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    }
  }
  // (1.12, from the prototype) too wide for its box? Measured in fractions of a pixel: half a pixel too wide is still cut off with "…".
  function tooWide(n) {
    if (n.scrollWidth > n.clientWidth + 1) return true;
    const r = document.createRange(); r.selectNodeContents(n); const cs = getComputedStyle(n);
    const k = scaleK();      // (1.12.21: both in the bar's own pixels — on a 1440p or 4K source the page is scaled, and the box's padding isn't)
    return r.getBoundingClientRect().width / k > n.getBoundingClientRect().width / k - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + .05;
  }
  // names on the board, Team VS and champion splashes, and in the lists at the foot of a VS: smaller until they fit, down to 55 %
  function fitNames(box) {
    if (!box) return;
    for (const n of box.querySelectorAll('.sbf-nm')) {
      n.style.fontSize = ''; if (!n.clientWidth) continue;
      const base = parseFloat(getComputedStyle(n).fontSize) || 20; let px = base;
      while (tooWide(n) && px > base * .55) { px -= 1; n.style.fontSize = px + 'px'; }
    }
  }
  // (1.12, from the prototype) a crowded side of the format bar: with five or more a side (or a long Gauntlet queue) the pieces
  // used to keep their size and run into the middle block. Now each side fits its own width: pieces get narrower (cards too),
  // names smaller, and when even that is too narrow to read, the ones that matter least fold into a "+N" piece:
  // the knocked-out first, then the end of the line. Who is playing, who is next, the team and the leader always stay.
  // any name on the bar still too wide (a knocked-out piece is narrower): that one gets smaller on its own, down to 11 px
  function shrinkEach(items) {
    for (const e of items) {
      const n = e.querySelector(':scope > .sbf-nm'); if (!n || e.hidden || n.classList.contains('two') || !n.clientWidth) continue;
      let q = parseFloat(getComputedStyle(n).fontSize) || 18; while (q > 11 && tooWide(n)) { q -= 1; n.style.fontSize = q + 'px'; }
      if (tooWide(n) && /\s/.test(n.textContent.trim())) { n.classList.add('two'); n.style.fontSize = ''; }      // two words: two lines
    }
  }
  function fitBar() {
    if (!bar) return;
    const pre = PRESET(); let measured = true;
    for (const side of bar.querySelectorAll('.bl, .br')) {
      side.classList.add('fitting');          // measured at the final widths: the pieces' width transition would still be under way
      try { fitSide(side, pre); } finally { void side.offsetWidth; side.classList.remove('fitting'); }
    }
    bar.dataset.fitted = measured ? '1' : '';
    shrinkFit(bar);                           // the names are fitted again in the same frame (no flash of a name cut with “…”)
    function fitSide(side, pre) {
      side.classList.remove('crowd'); side.querySelectorAll('.it.more').forEach(e => e.remove());
      const its = [...side.children].filter(e => e.classList.contains('it'));
      for (const e of its) { e.hidden = false; if (e.classList.contains('td')) e.style.width = ''; }
      // (1.12.21: a name that had gone onto two lines is put back whole here as well — its size was being reset while it stayed
      // marked as fitted, so a very long name stood at full size on four lines, the last two cut off)
      side.querySelectorAll('.sbf-nm').forEach(n => { n.classList.remove('two'); if (!n.closest('.td-card')) { n.style.fontSize = ''; if (n.classList.contains('two2')) { n.classList.remove('two2'); n.textContent = n.textContent; } delete n.dataset.sf; n.__fk = ''; } });
      const W = side.clientWidth; if (!W) { measured = false; return; } if (!its.length) return;
      const td = its.some(e => e.classList.contains('td')), pics = its.some(e => e.classList.contains('pics'));
      const fixed = its.filter(e => e.classList.contains('team')), movers = its.filter(e => !e.classList.contains('team'));
      const base = td ? (pics ? 88 : 132) : (pre === 'league' ? 170 : 210), MIN = td ? (pics ? 64 : 72) : ['death', 'league', 'gauntlet'].includes(pre) ? 104 : 80;   // Death Battle and League pieces also carry lives or a record
      const gapOf = () => parseFloat(getComputedStyle(side).columnGap) || 4;
      const sk = scaleK(), used = () => fixed.reduce((t, e) => t + e.getBoundingClientRect().width / sk, 0);       // (in the bar's own pixels, whatever size the page is shown at)
      // does it fit as it is? (the plain bar: every piece at its own size)
      const PLAY = td ? (pics ? 18 : 24) : 0, playing = movers.filter(e => e.classList.contains('playing')).length;   // the card playing is wider
      const natural = used() + movers.length * (base * (td ? 1 : .55)) + playing * PLAY + gapOf() * its.length;
      if (natural <= W && movers.length < 5) { if (td) fitCards(true); else shrinkEach(its); return; }
      side.classList.add('crowd');
      const gap = gapOf(), room = W - used() - gap * fixed.length;
      let fits = Math.max(1, Math.floor((room + gap) / (MIN + gap)));
      if (fits < movers.length) {
        // fold the least important into "+N": knocked out first, then from the end of the line (Death Battle: from the far ends)
        const keep = e => e.classList.contains('playing') || e.classList.contains('next') || e.classList.contains('king') || e.classList.contains('rank1');
        const order = pre === 'death' ? movers.slice() : movers.slice().reverse();
        const cand = [...order.filter(e => e.classList.contains('out') && !keep(e)), ...order.filter(e => !e.classList.contains('out') && !keep(e))];
        const hide = cand.slice(0, movers.length - (fits - 1));
        hide.forEach(e => { e.hidden = true; });
        if (hide.length) {
          const more = document.createElement('div'); more.className = 'it more' + (td ? ' td' : '') + (pics ? ' pics' : '');
          more.innerHTML = `<span class="sbf-nm">+${hide.length}</span>`;
          if (pre === 'death') side.insertBefore(more, movers.find(e => !e.hidden) || null); else side.appendChild(more);
        }
      }
      const shown = movers.filter(e => !e.hidden);
      if (td) {
        // cards share what is left of the side, never wider than usual
        const more = side.querySelector('.it.more'), left = W - used() - (more ? more.getBoundingClientRect().width / sk + gap : 0) - gap * (fixed.length + shown.length - 1);
        const pl = shown.filter(e => e.classList.contains('playing')).length, w = Math.max(48, Math.min(base, Math.floor((left - pl * PLAY) / Math.max(1, shown.length))));
        shown.forEach(e => { e.style.width = (e.classList.contains('playing') ? w + PLAY : w) + 'px'; });
        fitCards(true);
        return;
      }
      // names: one size for the whole side, as large as lets them all fit (not under 11 px); a two-word name that still
      // doesn't fit goes on two lines
      const names = shown.map(e => e.querySelector('.sbf-nm')).filter(Boolean);
      if (!names.length || !names[0].clientWidth) return;
      let px = parseFloat(getComputedStyle(names[0]).fontSize) || 18;
      while (px > 11 && names.some(tooWide)) { px -= 1; names.forEach(n => { n.style.fontSize = px + 'px'; }); }
      names.filter(n => tooWide(n) && /\s/.test(n.textContent.trim())).forEach(n => { n.classList.add('two'); n.style.fontSize = ''; });
      shrinkEach(shown);
      // the team's own piece keeps its width: its name gets smaller instead (not under 13 px)
      for (const t of fixed) { const n = t.querySelector('.sbf-nm'); if (!n) continue; let q = parseFloat(getComputedStyle(n).fontSize) || 20; while (q > 13 && tooWide(n)) { q -= 1; n.style.fontSize = q + 'px'; } }
    }
  }
  // (1.12, from the prototype) Team Death Battle cards: a fighter's name is made smaller until it fits, instead of being
  // cut off with "…". A card with a picture is 88 px wide, so when a name would have to go under 11 px, every card on the bar is lettered in the condensed face instead.
  // All fighter cards end up at one size.
  function fitCards(again) {
    if (!bar) return;
    const all = [...bar.querySelectorAll('.it.td:not(.team) .td-card .sbf-nm')].filter(n => !n.closest('[hidden]'));   // folded into "+N": not measured
    if (!all.length || !all[0].clientWidth || (!again && all.every(n => n.dataset.fit))) return;      // not laid out yet: fitted on the next update
    const over = tooWide;
    // 1.12.9: each name fits its own card (one long name no longer shrinks everyone's); a name that still doesn't fit at a
    // readable size goes onto two lines instead of being cut
    const fit = min => { for (const n of all) { let px = parseFloat(getComputedStyle(n).fontSize) || 14; while (over(n) && px > min) { px -= .5; n.style.fontSize = px + 'px'; } } return !all.some(over); };
    for (const n of all) { n.style.fontSize = n.style.fontFamily = n.style.letterSpacing = ''; n.classList.remove('two'); if (n.querySelector('wbr')) n.textContent = n.textContent; n.dataset.fit = 1; }
    if (fit(13)) return;
    for (const n of all) if (over(n)) { n.innerHTML = wbr(n.textContent); n.style.fontFamily = "'Saira Condensed',sans-serif"; n.style.letterSpacing = '.3px'; n.style.fontSize = ''; n.classList.add('two'); let px = 16; n.style.fontSize = px + 'px'; while ((n.scrollHeight > n.clientHeight + 3 || n.getBoundingClientRect().height / scaleK() > px * 2.35 || n.scrollWidth > n.clientWidth) && px > 10) { px -= .5; n.style.fontSize = px + 'px'; } }      // (1.12.21: …and a third line counts as not fitting — the two-line box hides it behind “…”, so its own height never said so: GlassJaw99TurboMoth99 stayed at 16 px as “GLASSJAW 99TURBOMO…”)
  }
  if (document.fonts) { document.fonts.ready.then(() => { fitBar(); fitCards(true); }); document.fonts.addEventListener('loadingdone', () => { fitBar(); fitCards(true); if (sp.classList.contains('on')) fitNames(sp); if (vsEl.classList.contains('on')) fitNames(vsEl); }); }
  const barItem = key => bar && bar.querySelector(`.it[data-k="${CSS.escape(String(key))}"]`);
  function barIntro() {
    if (!bar || POTATO()) return;
    bar.querySelector('.bc').animate([{ transform: 'translateX(-50%) translateY(90px)' }, { transform: 'translateX(-50%)' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    [...bar.querySelectorAll('.bl .it')].forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateX(-40px)', filter: 'brightness(3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 320, delay: 200 + k * 55, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    [...bar.querySelectorAll('.br .it')].forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateX(40px)', filter: 'brightness(3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 320, delay: 200 + k * 55, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
  }

  // ===================================================================================== moments on the player bars (before the next match loads)
  // sb-client asks before it puts the next match on the bars: a life lost or a knockout plays on the current bars first.
  let heldSeq = -1;
  window.__SB_HOLD = (next, shown) => {
    if (!FULL || POTATO() || window.__SB_INSTANT) return 0;
    const f = next && next.format; if (!f || f.seq === seq || f.seq === heldSeq || !shown) return 0;
    const evs = f.events || [], names = [shown.p1 && shown.p1.name, shown.p2 && shown.p2.name];
    const onBar = nm => names.some(n => same(n, nm));
    const hit = evs.find(e => ['life', 'dead', 'out', 'tlife', 'tko', 'thit'].includes(e.type) && onBar(e.name));
    if (!hit) return 0;
    heldSeq = f.seq;
    const k = same(names[0], hit.name) ? 1 : 2, nv = next.fv || V;
    if (hit.type === 'life' || hit.type === 'tlife') { lifeLost(k, hit, nv); return 2500; }
    if (hit.type === 'thit') { plateHit(k, hit); return 1500; }
    if (hit.type === 'dead') { plateDeath(k, hit); return 2300; }
    plateKO(k, hit); return 1500;
  };
  // a life lost: the gem tears off the bar, swells, and bursts; cracks run through the bar; the count drops — every life is its own moment
  function lifeLost(k, e, nv) {
    const p = plate(k); if (!p) return;
    const gemsEl = p.querySelectorAll('.sbf-lv-slot .sbf-lv i, .sbf-lv-slot .sbf-cr, #sbf-tag' + k + ' .sbf-cr'), gem = gemsEl[e.lives], max = gemsEl.length || ((nv && nv.fighters && (nv.fighters.find(x => same(x.name, e.name)) || {}).maxLives) || e.lives + 1);
    const pb = boxOf(p), right = k === 2, last = e.lives === 1, variant = (max - e.lives - 1) % 3;   // 1st, 2nd, 3rd life lost each look different
    const slot = p.querySelector('.sbf-lv-slot'); if (slot) delete slot.dataset.h;   // redrawn for whoever is on this bar next
    S(last ? 'heartbeat' : 'crack', 0); S('shatter', 380);
    flashEl(p, 200); shake(p, last ? 9 : 6, 420);
    crackOver({ x: pb.x + (right ? 0 : pb.w * .1), y: pb.y, w: pb.w * .9, h: pb.h }, { dur: 2200 });
    if (gem) {
      const g = boxOf(gem), ghost = gem.cloneNode(true); ghost.style.cssText = `position:fixed;left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;z-index:9455;margin:0`;
      document.body.appendChild(ghost); gem.classList.add('gone');
      const tx = right ? -220 : 220, ty = 230;
      const path = variant === 0 ? [{ transform: 'none', filter: 'brightness(1)' }, { transform: `translate(${tx * .4}px,${ty * .55}px) scale(3.2) rotate(${right ? -20 : 20}deg)`, filter: 'brightness(2)', offset: .55 }, { transform: `translate(${tx * .5}px,${ty * .6}px) scale(4) rotate(${right ? -28 : 28}deg)`, filter: 'brightness(4)' }]
        : variant === 1 ? [{ transform: 'none' }, { transform: `translate(0,${ty * .4}px) scale(4.4)`, offset: .5, filter: 'brightness(1.6)' }, { transform: `translate(0,${ty * .45}px) scale(5) rotate(180deg)`, filter: 'brightness(4)' }]
          : [{ transform: 'none' }, { transform: `translate(${tx}px,${ty * .2}px) scale(2.8) rotate(${right ? 200 : -200}deg)`, offset: .6 }, { transform: `translate(${tx * 1.2}px,${ty * .3}px) scale(3.6) rotate(${right ? 260 : -260}deg)`, filter: 'brightness(4)' }];
      ghost.animate(path, { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      setTimeout(() => {
        const [x, y] = center(ghost); shatter(ghost, { n: 12, power: 1.2, color: BLOOD, fall: 900 }); ghost.remove();
        ring(x, y, last ? 520 : 360, BLOOD, 650); spark(x, y, last ? 90 : 55, 1.2, BLOOD); spark(x, y, 30, .8, T.spark);
        if (variant === 1 || last) screenShake(last ? 10 : 6, 380);
      }, 420);
    }
    vignette(BLOOD, last ? .7 : .45, last ? 900 : 650);
    // the count drops: 3 → 2
    const sx = right ? pb.x + pb.w * .22 : pb.x + pb.w * .78, sy = pb.y + pb.h + 40;
    setTimeout(() => {
      if (POTATO()) return;
      const c = document.createElement('div'); c.className = 'sbf-count'; c.textContent = String(e.lives + 1);
      c.style.cssText = `left:${sx}px;top:${sy}px;transform:translateX(-50%)`; document.body.appendChild(c);
      c.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.4)' }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: .25 }, { opacity: 1, transform: 'translateX(-50%) scale(1)' }], { duration: 500, fill: 'forwards', easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      setTimeout(() => { c.textContent = String(e.lives); c.animate([{ transform: 'translateX(-50%) scale(1.7)', filter: 'brightness(3)' }, { transform: 'translateX(-50%) scale(1)', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' }); spark(sx, sy + 60, 30, .9, BLOOD); }, 700);
      c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' }], { duration: 400, delay: 1900, fill: 'forwards' }).onfinish = () => c.remove();
    }, 300);
    stamp(last ? `LAST LIFE<small>${esc(e.name)}</small>` : `−1 LIFE<small>${esc(e.name)} · ${e.lives} LEFT</small>`, right ? sx - 110 : sx + 90, sy + 18, { dur: 2300, rot: right ? 5 : -5, align: right ? 'right' : 'left' });
    if (last) { setTimeout(() => ecgSweep(p.querySelector('.body') || p), 650); const pulse = () => { if (!POTATO()) p.animate([{ boxShadow: 'none' }, { boxShadow: `0 0 50px ${BLOOD}` }, { boxShadow: 'none' }], { duration: 500 }); }; setTimeout(pulse, 1300); setTimeout(pulse, 1550); }
  }
  // eliminated: the whole bar breaks apart
  function plateDeath(k, e) {
    const p = plate(k); if (!p) return;
    S('toll'); S('shatter', 140);
    const pb = boxOf(p), right = k === 2;
    flashEl(p, 120); vignette(BLOOD, .75, 900); screenShake(12, 450);
    crackOver({ x: pb.x, y: pb.y, w: pb.w, h: pb.h }, { dur: 700, width: 3 });
    setTimeout(() => { const ghost = p.cloneNode(true); ghost.removeAttribute('id'); ghost.style.cssText = `position:absolute;left:${pb.x}px;top:${pb.y}px;margin:0;opacity:1;z-index:9450`; document.body.appendChild(ghost);
      shatter(ghost, { n: 18, dir: right ? -1 : 1, power: 1.3, color: BLOOD, fall: 1100 }); ghost.remove();
      if (!POTATO()) p.animate([{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], { duration: 2300 }); }, 260);
    const sx = right ? pb.x + pb.w - 40 : pb.x + 40;
    setTimeout(() => stamp(`${SKULL.replace('class="skull"', 'style="width:46px;height:46px;vertical-align:-6px;margin-right:10px"')}ELIMINATED<small>${esc(e.name)} · ${ord(e.place)} PLACE</small>`, sx, pb.y + pb.h + 60, { dur: 2100, rot: right ? 4 : -4, align: right ? 'right' : 'left' }), 300);
  }
  // knocked out of a crew: the bar cracks and bursts, the next challenger slides in after
  function plateKO(k, e) {
    const p = plate(k); if (!p) return;
    S('crack', 60); S('shatter', 420);
    const pb = boxOf(p), right = k === 2;
    flashEl(p, 160); shake(p, 6, 380); crackOver({ x: pb.x, y: pb.y, w: pb.w, h: pb.h }, { dur: 900 });
    setTimeout(() => { const ghost = p.cloneNode(true); ghost.removeAttribute('id'); ghost.style.cssText = `position:absolute;left:${pb.x}px;top:${pb.y}px;margin:0;opacity:1;z-index:9450`; document.body.appendChild(ghost);
      shatter(ghost, { n: 14, dir: right ? -1 : 1, power: 1, fall: 950 }); ghost.remove();
      if (!POTATO()) p.animate([{ opacity: 0 }, { opacity: 0, offset: .7 }, { opacity: 1 }], { duration: 1500 }); }, 420);
    const s = teamSlot(e.name);
    stamp(`K.O.<small>${esc(e.name)}${s ? ' · ' + esc(s.team.name) : ''}</small>`, right ? pb.x + pb.w - 40 : pb.x + 40, pb.y + pb.h + 50, { dur: 1600, rot: right ? 4 : -4, align: right ? 'right' : 'left' });
  }
  // the next fighter lands on the bar
  function plateIn(k) {
    const p = plate(k), n = p && p.querySelector('.name'); if (!n || POTATO()) return;
    reveal(n, { from: k === 2 ? 'right' : 'left', dur: 460 });
    p.animate([{ filter: 'brightness(1.7)' }, { filter: 'none' }], { duration: 600, easing: 'ease-out' });
  }

  // ===================================================================================== events → effects
  async function play(events, heldDone) {
    // (1.3.5) never on top of the Victory Splash: if it is still up or leaving, the moments start once it has gone
    if (!POTATO() && events.some(e => ['life', 'dead', 'out', 'tlife', 'tko', 'thit', 'switch', 'done', 'crown'].includes(e.type))) {
      const t0 = Date.now(); while (Date.now() - t0 < 2500 && (document.documentElement.classList.contains('sb-victory-on') || (document.getElementById('sb-victory') || {}).classList?.contains('vc-out'))) await sleep(80);
    }
    for (const e of events) {
      switch (e.type) {
        case 'start': barIntro(); S('screenIn'); if (V && ((V.kind === 'teams' && !(V.mode === 'tdb' && V.switchOpen)) || isDeath())) queueLock(1300); break;   // Team Death Battle opens with a switch window: its lock-in comes when they lock in
        case 'next': nextMatch(events.some(x => x.type === 'switch')); if (V && ((V.kind === 'teams' && V.mode !== 'tdb') || isDeath()) && !events.some(x => x.type === 'done')) queueLock(events.some(x => x.type === 'out') ? 900 : 400); break;   // a switch plays its own change
        case 'out': teamOut(e, heldDone); break;
        case 'retire': band('RETIRES UNDEFEATED', e.name, `${e.n} WINS IN A ROW`, T.gold, { hold: 1300, snd: 'crown' }); break;
        case 'streak': streak(e); break;
        case 'laststand': lastStand(e); break;
        case 'point': teamPoint(e); break;
        case 'tiebreak': await tiebreak(e); break;
        case 'life': if (!heldDone) lifeOnBar(e); else barLife(e); break;
        case 'dead': await death(e, heldDone); break;
        case 'final': await finalDuel(); break;
        case 'crown': crown(e); break;
        case 'draw': await roulette(e); break;
        case 'done': finale(); break;
        case 'undo': undoFx(); S('rewind'); break;
        case 'tlife': barLifeT(e); break;
        case 'thit': barHitT(e); break;
        case 'tko': await koCard(e, heldDone); break;
        case 'switch': switchFx(e); break;
        case 'switchwin': switchWin(e); break;
        case 'locked': queueLock(300); break;
        case 'unlocked': lockClose(false); switchWin(e); break;      // 1.12.13: a lock-in undone
        case 'char': setTimeout(() => charSwap(e), 60); break;       // 1.12.13: a player picked another character
      }
    }
  }
  function nextMatch(sw) {
    if (sw) return;
    for (const k of [1, 2]) plateIn(k);
    const m = F && F.match; if (!m || POTATO()) return;
    const keys = V.kind === 'teams' ? [`t0-${m.a.coach ? 'coach' : m.a.i}`, `t1-${m.b.coach ? 'coach' : m.b.i}`] : V.kind === 'elim' ? [m.a, m.b] : [];
    for (const key of keys) { const it = barItem(key); if (it) { reveal(it.querySelector('.sbf-nm'), { from: it.closest('.br') ? 'right' : 'left' }); it.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 560, easing: 'ease-out' }); } }
  }
  function teamOut(e, heldDone) {
    const d = barItem(`t${e.t}-${e.i}`);
    if (!heldDone) S('crack', 80);
    if (d && !POTATO()) {
      if (!heldDone) S('shatter', 450);
      const ghost = d.cloneNode(true); ghost.className = 'it playing'; const b = boxOf(d);
      Object.assign(ghost.style, { position: 'fixed', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', margin: 0, zIndex: 9410, transform: 'none' }); document.body.appendChild(ghost);
      d.style.visibility = 'hidden';
      setTimeout(() => glassKO(ghost, (F.teams[e.t] || {}).color || T.acc, e.t === 0 ? 1 : -1).then(() => { ghost.remove(); d.style.visibility = '';
        if (!POTATO()) d.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); }), heldDone ? 60 : 380);
    }
    const t = F.teams[e.t], j = t.players.findIndex(p => !p.out);
    if (j >= 0 && F.status === 'live') band('NEXT CHALLENGER', t.players[j].name, `${t.name} · ${PRESET() === 'gauntlet' ? 'STAGE' : F.rules.tiers ? 'TIER' : '#'}${j + 1}`, t.color, { from: e.t === 0 ? 1 : -1 });
  }
  function streak(e) {
    if (F.kind === 'teams' && e.n >= 2) {
      S('flame', 120); const d = barItem(`t${e.t}-${e.i}`); if (d) { const [x, y] = center(d); embers(x - 60, x + 60, y, 24 + e.n * 6); }
      const p = plateFor(e.name); if (p) { const b = boxOf(p); embers(b.x + 80, b.x + b.w - 80, b.y + b.h, 20 + e.n * 8); stamp(`×${e.n}<small>WIN STREAK</small>`, /2$/.test(p.id) ? b.x + b.w - 30 : b.x + 30, b.y + b.h + 30, { dur: 1600, align: /2$/.test(p.id) ? 'right' : 'left' }); }
    }
    if (F.kind === 'elim' && e.n >= 2) kothStreak(e);
  }
  function lastStand(e) {
    S('sting');
    const d = barItem(`t${e.t}-${e.i}`); if (d) { const [x, y] = center(d); embers(x - 100, x + 100, y + 18, 40); flashEl(d, 700); }
    band('LAST STAND', e.name, F.teams[e.t].name, F.teams[e.t].color, { hold: 1300, snd: '' });
  }
  function teamPoint(e) {
    const c = bar && bar.querySelector('.bc'); if (!c) return; S('pip');
    const pips = c.querySelectorAll('.sbf-pips')[e.t], pip = pips && pips.children[e.points - 1];
    const col = F.teams[e.t].color;
    if (pip) { const [x, y] = center(pip); if (!POTATO()) pip.animate([{ background: '#fff', transform: 'rotate(45deg) scale(2.4)', boxShadow: '0 0 30px #fff' }, { transform: 'rotate(45deg) scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.3,1)' }); ring(x, y, 240, col); spark(x, y, 24, .8, col); }
    const t = barItem('team' + e.t); if (t) flashEl(t, 400);
  }
  async function tiebreak(e) {
    await bandQ;
    S('tiebreak'); if (POTATO()) return;
    const ov = document.createElement('div'); ov.className = 'sp-tb';
    const A = F.teams[0], B = F.teams[1];
    let d = ''; for (let i = 0; i < 14; i++) { let x = 960, y = 540; d += `M${x},${y}`; const a = i / 14 * 6.283 + Math.random() * .3; for (let k = 0; k < 4; k++) { x += Math.cos(a + (Math.random() - .5) * .6) * (90 + Math.random() * 120); y += Math.sin(a + (Math.random() - .5) * .6) * (60 + Math.random() * 80); d += `L${x | 0},${y | 0}`; } }
    ov.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><path d="${d}"/></svg><div class="w">TIEBREAKER</div>${e.coaches ? `<div class="co"><span style="--c:${esc(A.color)}"><small>${esc(A.name)}</small>${esc(A.coach.name)}</span><span style="--c:${esc(B.color)}"><small>${esc(B.name)}</small>${esc(B.coach.name)}</span></div>` : '<div class="co"><span style="--c:var(--muted)"><small>THE ANCHORS PLAY AGAIN</small></span></div>'}`;
    document.body.appendChild(ov);
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' });
    const p = ov.querySelector('path'); p.style.strokeDasharray = 4000; p.animate([{ strokeDashoffset: 4000 }, { strokeDashoffset: 0 }], { duration: 500, delay: 200, fill: 'backwards' });
    ov.querySelector('.w').animate([{ opacity: 0, transform: 'scale(2.4)', filter: 'blur(10px)' }, { opacity: 1, transform: 'scale(.92)', offset: .55, filter: 'none' }, { opacity: 1, transform: 'none' }], { duration: 680, delay: 450, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
    setTimeout(() => { ring(960, 540, 900, T.hot); spark(960, 540, 60, 1.2); screenShake(8, 380); }, 830);
    [...ov.querySelectorAll('.co span')].forEach((s, i) => s.animate([{ opacity: 0, transform: `translateX(${i ? 200 : -200}px)` }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 1150, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    await sleep(3600);
    shatter(ov.querySelector('.w'), { n: 12, power: 1.1 }); ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => ov.remove();
  }
  // a life lost while that fighter isn't on a bar (or the bars were already updated): the bar chip shows it
  function lifeOnBar(e) {
    if (e.lives === 1) setTimeout(() => { const it = barItem(e.id) || [...(bar ? bar.querySelectorAll('.it') : [])].find(x => same((x.querySelector('.sbf-nm') || {}).textContent, e.name)); if (it) ecgSweep(it.querySelector('.td-card') || it, { dur: 900 }); }, 450); S(e.lives === 1 ? 'heartbeat' : 'crack', e.lives === 1 ? 0 : 200); barLife(e); band(e.lives === 1 ? 'LAST LIFE' : `${e.lives} LIVES LEFT`, e.name, '', BLOOD, { hold: 900, y: 470, snd: '' }); }
  function barLife(e) {
    const t = barItem(e.id); if (!t) return;
    if (t.classList.contains('td')) { const x = (V.fighters || []).find(y => y.id === e.id); return cardLife(t, e.lives, x ? fcol(x) : T.acc); }
    const lv = [...t.querySelectorAll('.sbf-lv i')], pip = lv[e.lives];
    if (pip && !POTATO()) {
      // the gem is still lit for a moment: it swells and bursts, and the empty one fades in under it
      const b = boxOf(pip), g = document.createElement('span'); g.className = 'sbf-lv';
      g.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;z-index:9455;margin:0;padding:0`; g.innerHTML = `<i style="width:${b.w}px;height:${b.h}px"></i>`; document.body.appendChild(g);
      pip.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: .55 }], { duration: 700 });
      g.animate([{ transform: 'none', filter: 'none' }, { transform: 'scale(1.7) translateY(-3px)', filter: 'brightness(2.4)' }], { duration: 280, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      setTimeout(() => { shatter(g, { n: 6, power: .7, color: BLOOD, fall: 600 }); g.remove(); spark(b.x + b.w / 2, b.y + b.h / 2, 18, .6, BLOOD); }, 280);
    }
    shake(t, 3, 280); flashEl(t, 400);
  }
  async function death(e, heldDone) {
    if (!heldDone) { S('toll'); S('shatter', 120); vignette(BLOOD, .45, 600); }
    const t = barItem(e.id);
    if (t && t.classList.contains('td') && !POTATO()) { const x = (V.fighters || []).find(y => y.id === e.id); await cardKO(t, x ? fcol(x) : BLOOD, false); }
    else if (t && !POTATO()) {
      const ghost = t.cloneNode(true); const b = boxOf(t);
      Object.assign(ghost.style, { position: 'absolute', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', margin: 0, zIndex: 9410 }); document.body.appendChild(ghost);
      ghost.animate([{ filter: 'brightness(5) saturate(0)' }, { filter: 'brightness(1.5)' }], { duration: 80, fill: 'forwards' });
      await sleep(120); shatter(ghost, { n: 10, dir: 1, power: 1, color: BLOOD, fall: 800 }); ghost.remove(); spark(b.x + b.w / 2, b.y + b.h / 2, 30, 1, BLOOD);
    }
    if (!heldDone) band('ELIMINATED', e.name, `${ord(e.place)} PLACE · ${e.left} REMAIN`, BLOOD, { hold: 1300, from: 1, snd: 'slash' });
    await sleep(heldDone ? 200 : 900);
  }
  async function finalDuel() {
    await bandQ;
    if (!F.match) return; S('final'); if (POTATO()) return;
    const a = F.fighters.find(x => x.id === F.match.a), b = F.fighters.find(x => x.id === F.match.b);
    const ov = document.createElement('div'); ov.className = 'sp-tb';
    ov.innerHTML = `<div class="co"><span style="--c:${T.acc}"><small>FIGHTER</small>${esc(a.name)}</span><span style="--c:${T.two}"><small>FIGHTER</small>${esc(b.name)}</span></div><div class="w">FINAL DUEL</div><div class="co"><span style="--c:var(--muted)"><small>LAST ONE STANDING WINS</small></span></div>`;
    document.body.appendChild(ov);
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
    [...ov.querySelectorAll('.co')[0].children].forEach((s, i) => s.animate([{ transform: `translateX(${i ? 700 : -700}px) scale(.6)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    ov.querySelector('.w').animate([{ opacity: 0, transform: 'scale(2.4)', filter: 'blur(10px)' }, { opacity: 1, transform: 'scale(.92)', offset: .55, filter: 'none' }, { opacity: 1, transform: 'none' }], { duration: 680, delay: 700, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
    setTimeout(() => { ring(960, 540, 1000, T.hot); spark(960, 540, 70, 1.3); screenShake(10, 420); }, 1080);
    await sleep(3400);
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' }).onfinish = () => ov.remove();
  }
  function crown(e) {
    S('crown', e.from ? 600 : 0);
    const to = barItem(e.to), from = e.from && barItem(e.from);
    if (from && !POTATO()) { const b = boxOf(from), c = document.createElement('div'); c.innerHTML = CROWN('crn'); c.style.cssText = `position:absolute;left:${b.x + 14}px;top:${b.y - 10}px;width:40px;z-index:9420`; document.body.appendChild(c);
      c.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(40px,-120px) rotate(200deg)', opacity: 0 }], { duration: 700, easing: 'ease-out' }).onfinish = () => c.remove(); }
    setTimeout(() => { const el = to || plateFor((F.fighters.find(x => x.id === e.to) || {}).name); if (el) { const [x, y] = center(el); ring(x, y, 300, T.gold); spark(x, y, 36, .9, T.gold); flashEl(el, 500); } }, e.from ? 600 : 0);
    if (e.from) { const nm = (F.fighters.find(x => x.id === e.to) || {}).name; band('NEW KING', nm, '', T.gold, { hold: 1200, snd: 'slash' }); }
  }
  function kothStreak(e) {
    if (e.n >= 3) S('flame');
    // 1.12.6: every ten in a row (×10, ×20, ×30…) is a moment of its own — a band across the screen and a burst on the king's card
    if (e.n >= 10 && e.n % 10 === 0 && !POTATO()) {
      const word = e.n >= 50 ? 'LEGENDARY' : e.n >= 40 ? 'GODLIKE' : e.n >= 30 ? 'UNTOUCHABLE' : e.n >= 20 ? 'UNSTOPPABLE' : 'ON FIRE';
      band(`×${e.n} ${word}`, e.name, `${e.n} WINS IN A ROW · KING OF THE HILL`, e.n >= 20 ? '#ff8a2e' : T.gold, { hold: 1600, y: 420, snd: '' });
      const kw = bar && bar.querySelector('.kw'); if (kw) { const b = boxOf(kw); ring(b.x + b.w / 2, b.y + b.h / 2, 220 + Math.min(4, e.n / 10) * 40, T.gold, 620); spark(b.x + b.w / 2, b.y + b.h / 2, Math.min(40, 14 + e.n / 2), .8, T.gold); kw.animate([{ transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.9,.3,1.3)' }); }
    }
    const t = barItem(e.id); if (t && !POTATO()) { const w = t.querySelector('.x'); if (w) w.animate([{ transform: 'scale(1.8)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.3)' }); }
    const p = plateFor(e.name); if (p && e.n >= 2) { const b = boxOf(p); embers(b.x + 60, b.x + b.w - 60, b.y + b.h, Math.min(60, 24 + e.n * 4), T.gold); stamp(`×${e.n}<small>WIN STREAK</small>`, /2$/.test(p.id) ? b.x + b.w - 30 : b.x + 30, b.y + b.h + 30, { dur: 1600, align: /2$/.test(p.id) ? 'right' : 'left' }); }
  }
  async function roulette(e) {
    if (POTATO() || !bar) return;
    const tiles = [...bar.querySelectorAll('.bl .it:not(.out)')]; if (tiles.length < 3) return;
    let i = 0, delay = 60; const start = performance.now();
    while (performance.now() - start < 1700) { tiles.forEach(t => t.classList.remove('lit')); const t = tiles[i++ % tiles.length]; t.classList.add('lit'); S('tick', 0, { gap: 0, light: true }); await sleep(delay); delay *= 1.12; }
    tiles.forEach(t => t.classList.remove('lit')); S('pip');
    for (const id of [e.a, e.b]) { const t = barItem(id); if (t) { const [x, y] = center(t); spark(x, y, 16, .6); } }
  }
  function finale() {
    if (!bar) return;
    if (F.kind === 'teams' && F.winner >= 0) {
      S('shatter');
      const side = bar.querySelector(F.winner === 0 ? '.br' : '.bl'), win = bar.querySelector(F.winner === 0 ? '.bl' : '.br');
      if (side && !POTATO()) [...side.children].forEach((el, k) => setTimeout(() => shatter(el, { n: 6, dir: F.winner === 0 ? -1 : 1, power: .6 }), k * 50));
      if (win) { const b = boxOf(win); embers(b.x, b.x + b.w, b.y + 10, 80, T.gold); }
    } else { const b = boxOf(bar); embers(b.x + b.w * .3, b.x + b.w * .7, b.y, 60, T.gold); }
  }
  function undoFx() { if (POTATO()) return; for (const el of document.querySelectorAll('#sbf .it, .plate')) el.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 500 }); }

  // ===================================================================================== the format VS (every match)
  window.__SB_FORMAT_FX = { glassKO };      // the Designer's moment previews (and tests) play the knock-out on any card
  window.__SB_FORMAT_VS = s => FULL && !!(s.format && s.format.status === 'live' && s.fv);   // sb-vs.js steps aside for it
  function vsHTML() {
    const pre = PRESET(), p1 = ST.p1 || {}, p2 = ST.p2 || {}, m = F.match || {};
    const side = (k, p, extra) => `<div class="side ${k}" style="${extra.tc ? `${tcv(extra.tc)}` : ''}"><div class="lab">${extra.lab || ''}</div><div class="big">${esc(p.name || 'Player')}</div>${extra.below || ''}<div class="st">${extra.st || ''}</div>${picSpan({ pic: p.media, picKey: p.mediaKey }, 'vpic')}</div>`;
    const pic1 = picOf(p1.name) || p1.avatar || '', pic2 = picOf(p2.name) || p2.avatar || '', img = u => u ? `<img class="pic" src="${esc(u)}" alt="">` : '';
    const halves = (c1, c2) => `<div class="half L" style="--hc:${c1}">${img(pic1)}<div class="ghost">${esc(p1.name || '')}</div></div><div class="half R" style="--hc:${c2}">${img(pic2)}<div class="ghost">${esc(p2.name || '')}</div></div><div class="seam"></div>`;
    const A = '33', glow = c => c + (ONI ? '30' : '55');
    let top = '', L = '', R = '', mid = '<div class="vs">VS</div>', foot = '', bgc = [glow(T.acc), glow(T.two)], extra = '';
    if (V.kind === 'teams') {
      const s1 = teamSlot(p1.name), s2 = teamSlot(p2.name);
      const stock = s => s ? `<div class="stock">${s.team.players.map((x, j) => `<i class="${x.out ? 'out' : ''}${j === s.i ? ' me' : ''}"></i>`).join('')}</div>` : '';
      bgc = [glow((s1 && s1.team.color) || T.acc), glow((s2 && s2.team.color) || T.two)];
      if (pre === 'sajam') {
        const tier = m.tiebreak ? ICON('star') : (m.pair || 0) + 1;
        top = `<small>${esc(F.name)} · ${m.tiebreak ? 'TIEBREAKER' : 'TIER MATCH'}</small><b>${esc(V.teams[0].name)} ${V.teams[0].points} – ${V.teams[1].points} ${esc(V.teams[1].name)}</b>`;
        mid = `<div class="emb"><small>${m.tiebreak ? 'COACHES' : 'TIER'}</small><b>${tier}</b></div>`;
        const pts = (t) => `<span class="sbf-pips" style="${tcv(t.color)}">${Array.from({ length: V.goal }, (_, k) => `<i class="${k < t.points ? 'on' : ''}"></i>`).join('')}</span>`;
        L = side('L', p1, { tc: s1 && s1.team.color, lab: s1 ? `<span class="tag2">${esc(s1.team.name)}</span>${esc(s1.team.name)}` : '', st: s1 ? `${pts(s1.team)}<span><b>${s1.team.points}</b> / ${V.goal} PTS</span>` : '' });
        R = side('R', p2, { tc: s2 && s2.team.color, lab: s2 ? `<span class="tag2">${esc(s2.team.name)}</span>${esc(s2.team.name)}` : '', st: s2 ? `${pts(s2.team)}<span><b>${s2.team.points}</b> / ${V.goal} PTS</span>` : '' });
        foot = `<div class="foot"><div class="cap">TIER MATCHUPS</div>${V.teams[0].players.map((x, j) => { const y = V.teams[1].players[j] || {}; const done = (F.log || []).some(l => l.pair === j); return `<div class="it ${j === m.pair && !m.tiebreak ? 'playing' : done ? 'out' : ''}"><i class="ed"></i><span class="k">T${j + 1}</span><span class="sbf-nm">${esc(x.name)} · ${esc(y.name || '?')}</span></div>`; }).join('')}</div>`;
      } else if (pre === 'gauntlet') {
        top = `<small>${esc(F.name)} · MATCH ${m.n || V.n}</small><b>GAUNTLET</b>`;
        L = side('L', p1, { tc: s1 && s1.team.color, lab: s1 ? `<span class="tag2">STAGE ${s1.i + 1}</span>${esc(s1.team.name)}` : '', below: stock(s1), st: s1 ? `<span><b>${s1.p.wins}</b> CLEARED</span>${s1.p.streak >= 2 ? `<span>×${s1.p.streak} STREAK</span>` : ''}` : '' });
        R = side('R', p2, { tc: s2 && s2.team.color, lab: s2 ? `<span class="tag2">STAGE ${s2.i + 1}</span>${esc(s2.team.name)}` : '', below: stock(s2), st: s2 ? `<span><b>${s2.p.wins}</b> CLEARED</span>${s2.p.streak >= 2 ? `<span>×${s2.p.streak} STREAK</span>` : ''}` : '' });
        // (1.12, from the prototype) a long line of challengers: the stages round the one being played, the rest as "+N",
        // and each ladder as wide as its share of stages, so a 15-stage ladder fits the screen with names that can be read
        const lad = t => {
          const all = t.players.map((x, j) => ({ x, j })), cur = Math.max(0, t.players.findIndex(x => x.state === 'playing'));
          const from = all.length > 8 ? Math.max(0, Math.min(cur - 1, all.length - 7)) : 0, to = all.length > 8 ? from + 7 : all.length;
          const chip = n => n > 0 ? `<div class="it more"><span class="sbf-nm">+${n}</span></div>` : '';
          return `<div class="ladder" style="position:relative;left:0;right:0;bottom:0;flex:${Math.min(8, all.length) + (all.length > 8 ? 1 : 0)} 1 0;min-width:0">${chip(from)}${all.slice(from, to).map(({ x, j }) => `<div class="it ${x.state}" style="${tcv(t.color)}"><span class="k">S${j + 1}</span><span class="sbf-nm">${esc(x.name)}</span></div>`).join('')}${chip(all.length - to)}</div>`;
        };
        foot = `<div class="foot" style="gap:40px"><div class="cap">THE LADDER</div>${lad(V.teams[0])}${lad(V.teams[1])}</div>`;
      } else {
        top = pre === 'tdb' ? `<small>${esc(F.name)} · BATTLE ${m.n || V.n}</small><b>TEAM DEATH BATTLE</b>` : `<small>${esc(F.name)} · MATCH ${m.n || V.n}</small><b>CREW BATTLE</b>`;
        L = side('L', p1, { tc: s1 && s1.team.color, lab: s1 ? `<span class="tag2">${esc(s1.team.name)}</span>#${s1.i + 1} OF ${s1.team.size}` : '', below: stock(s1), st: s1 ? `<span><b>${s1.team.left}</b> LEFT IN ${esc(s1.team.name)}</span>${s1.p.streak >= 2 ? `<span>🔥 ×${s1.p.streak}</span>` : ''}` : '' });
        R = side('R', p2, { tc: s2 && s2.team.color, lab: s2 ? `<span class="tag2">${esc(s2.team.name)}</span>#${s2.i + 1} OF ${s2.team.size}` : '', below: stock(s2), st: s2 ? `<span><b>${s2.team.left}</b> LEFT IN ${esc(s2.team.name)}</span>${s2.p.streak >= 2 ? `<span>🔥 ×${s2.p.streak}</span>` : ''}` : '' });
        mid = `<div class="vs">VS</div><div style="margin-top:-10px;font:800 46px/1.1 'Saira Condensed';font-style:italic;color:var(--ink)">${V.teams[0].left} – ${V.teams[1].left}</div>`;
      }
    } else if (V.kind === 'elim') {
      const x1 = fighterByName(p1.name), x2 = fighterByName(p2.name);
      if (pre === 'koth') {
        const k1 = x1 && x1.king, k2 = x2 && x2.king, king = k1 ? x1 : k2 ? x2 : null;
        top = `<small>${esc(F.name)} · FIGHT ${m.n || V.n}</small><b>KING OF THE HILL</b>`;
        const kside = (k, p, x) => x && x.king ? side(k, p, { tc: T.gold, lab: `${CROWN('crown-big')}`, st: `<span>DEFENDING THE HILL</span><span><b>×${x.streak}</b> STREAK</span>` })
          : side(k, p, { tc: T.acc, lab: `<span class="tag2">CHALLENGER</span>`, st: x ? `<span><b>${x.wins}</b>W <b>${x.losses}</b>L</span>` : '' });
        L = kside('L', p1, x1); R = kside('R', p2, x2);
        bgc = [glow(k1 ? T.gold : T.acc), glow(k2 ? T.gold : T.two)];
        const q = (V.queue || []).slice(0, 5);
        foot = q.length ? `<div class="foot"><div class="cap">NEXT IN LINE</div>${q.map((n, i) => `<div class="it ${i === 0 ? 'next' : ''}"><i class="ed"></i><span class="k">${i + 1}</span><span class="sbf-nm">${esc(n)}</span></div>`).join('')}</div>` : '';
        if (king && F.rules.streakGoal) extra = `<div class="banner" style="left:50%;top:640px;transform:translateX(-50%);background:${T.gold};color:#141210;box-shadow:0 0 30px ${T.gold}">${F.rules.streakGoal - king.streak} MORE TO RULE</div>`;
      } else {
        top = `<small>${esc(F.name)} · ${m.final ? 'FINAL DUEL' : 'FIGHT ' + (m.n || V.n)}</small><b>${m.final ? 'LAST ONE STANDING' : 'DEATH BATTLE'}</b>`;
        // 1.12.6: like Team Death Battle — each fighter in their own colour, their lives as crests under the name
        const dside = (k, p, x) => side(k, p, { tc: x ? fcol(x) : BLOOD, lab: x ? `<span class="tag2">${x.lives === 1 && x.maxLives > 1 ? 'LAST LIFE' : `${x.lives} ${x.lives === 1 ? 'LIFE' : 'LIVES'}`}</span>${V.alive} REMAIN` : '', below: x ? crests(x.lives, Math.max(x.maxLives, x.lives), 0, 1, fcol(x), 30) : '', st: x ? `<span><b>${x.wins}</b> KILLS</span>` : '' });
        L = dside('L', p1, x1); R = dside('R', p2, x2);
        bgc = [glow(x1 ? fcol(x1) : BLOOD), glow(x2 ? fcol(x2) : BLOOD)];
        const stake = V.alive;   // the place on the line if the loser is out
        const out1 = x1 && x1.lives === 1, out2 = x2 && x2.lives === 1;
        if ((out1 || out2) && !m.final) extra = `<div class="banner" style="left:50%;top:640px;transform:translateX(-50%)">${ord(stake)} PLACE ON THE LINE</div>`;
        foot = `<div class="foot"><div class="cap">${V.alive} SURVIVORS</div>${V.fighters.filter(x => !x.out).slice(0, 8).map(x => `<div class="it ${x.state}"><i class="ed"></i><span class="sbf-nm">${esc(x.name)}</span>${gems(x.lives, x.maxLives)}</div>`).join('')}</div>`;
      }
    } else {
      const r1 = (V.standings || []).find(x => same(x.name, p1.name)), r2 = (V.standings || []).find(x => same(x.name, p2.name));
      const nx = (V.schedule || []).findIndex(s => s.now);
      top = `<small>${esc(F.name)} · MATCH ${nx >= 0 ? nx + 1 : V.played + 1} OF ${V.total}</small><b>LEAGUE NIGHT</b>`;
      const lside = (k, p, r) => side(k, p, { lab: r ? `<span class="tag2">#${r.rank}</span>IN THE TABLE` : '', st: r ? `<span><b>${r.wins}</b>W <b>${r.losses}</b>L</span><span>${r.gf}–${r.ga} GAMES</span>` : '' });
      L = lside('L', p1, r1); R = lside('R', p2, r2);
      const rows = (V.standings || []).slice(0, 5);
      foot = `<div class="table">${rows.map(r => `<div class="row${[p1, p2].some(p => same(p.name, r.name)) ? ' me' : ''}"><span class="rk">${r.rank}</span><span class="sbf-nm">${esc(r.name)}</span><span>${r.wins}W</span><span>${r.losses}L</span><span>${r.diff > 0 ? '+' : ''}${r.diff}</span></div>`).join('')}</div>`;
      mid = '<div class="vs" style="font-size:180px">VS</div>';
    }
    return `<div class="bg"></div>${halves(bgc[0], bgc[1])}<div class="top">${top}</div>${L}${R}<div class="mid">${mid}</div>${foot}${extra}`;
  }
  function fitVS() { for (const el of vsEl.querySelectorAll('.side .big')) { el.style.fontSize = ''; const cs = getComputedStyle(el), mw = parseFloat(cs.maxWidth) || 760; let s = parseFloat(cs.fontSize) || 128; while (Math.max(el.scrollWidth, el.getBoundingClientRect().width / scaleK()) > mw && s > 56) { s -= 4; el.style.fontSize = s + 'px'; } } for (const el of vsEl.querySelectorAll('.ghost')) { let s = 300; el.style.fontSize = s + 'px'; while (el.scrollWidth > 1000 && s > 90) { s -= 10; el.style.fontSize = s + 'px'; } } }
  function vsShow(instant) {
    vsOn = true; purgeFx(); lockClose(true);
    vsEl.className = 'on f-' + PRESET(); vsEl.innerHTML = vsHTML(); mountPics(vsEl); fitVS(); if (document.fonts) document.fonts.ready.then(() => { if (vsEl.classList.contains('on')) fitVS(); });   // a layout's own display font can arrive after the first fit
    if (POTATO() || instant) return;
    const L = vsEl.querySelector('.half.L'), R = vsEl.querySelector('.half.R');
    vsEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    L.animate([{ transform: 'translateX(-70%) skewX(-12deg)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.7,0,.2,1)' });
    R.animate([{ transform: 'translateX(70%) skewX(-12deg)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.7,0,.2,1)' });
    const seam = vsEl.querySelector('.seam'); seam.animate([{ opacity: 0, transform: 'rotate(11.5deg) scaleY(0)' }, { opacity: 1, transform: 'rotate(11.5deg) scaleY(1)' }], { duration: 300, delay: 520, fill: 'backwards' });
    vsEl.querySelectorAll('.side').forEach((s, i) => [...s.children].forEach((c, k) => c.animate([{ opacity: 0, transform: `translateX(${i ? 260 : -260}px)`, filter: 'brightness(3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 480, delay: 560 + k * 80, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' })));
    vsEl.querySelectorAll('.side .big').forEach((b, i) => reveal(b, { from: i ? 'right' : 'left', dur: 520, delay: 520 }));
    const top = vsEl.querySelector('.top'); top.animate([{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    const mid = vsEl.querySelector('.mid'); mid.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.8)', filter: 'blur(12px)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.9)', offset: .55, filter: 'none' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 640, delay: 620, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
    setTimeout(() => { if (!vsOn) return; ring(960, 470, 1100, PRESET() === 'koth' ? T.gold : PRESET() === 'death' ? BLOOD : T.hot); spark(960, 470, 90, 1.4, PRESET() === 'death' ? BLOOD : T.spark); screenShake(8, 360); }, 1000);
    vsEl.querySelectorAll('.foot > *, .table .row, .ladder .it, .banner').forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1100 + k * 60, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    const keep = () => { if (vsOn && vsEl.classList.contains('f-' + PRESET())) { embers(0, W, H, ONI ? 10 : 16, PRESET() === 'death' ? BLOOD : PRESET() === 'koth' ? T.gold : T.spark2); setTimeout(keep, 800); } }; setTimeout(keep, 1300);
  }
  function vsHide() {
    vsOn = false;
    if (POTATO()) { vsEl.className = ''; vsEl.innerHTML = ''; return; }
    shatter(vsEl.querySelector('.mid'), { n: 12, power: 1.1 });
    vsEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' }).onfinish = () => { if (!vsOn) { vsEl.className = ''; vsEl.innerHTML = ''; } vsEl.getAnimations().forEach(a => a.cancel()); };
  }
  function vsSync(s, first) {
    const want = !!(s.vs && s.vs.show) && window.__SB_FORMAT_VS(s);
    if (want && !vsOn) vsShow(first && !!window.__SB_INSTANT);
    else if (!want && vsOn) vsHide();
    else if (want && vsOn) { const h = vsHTML(); if (vsEl.dataset.h !== h) { vsEl.dataset.h = h; } }
  }

  // ===================================================================================== (1.3.6) lock-in splash
  // Both players are in (Team Death Battle: both teams locked in; Crew Battle, Team Battle, Gauntlet: the next match is
  // on): two halves of glass slide in from opposite sides, each with its player (their picture if they have one, their
  // team, their lives or points), meet in the middle and meld, and a light runs along the join. About 4 seconds.
  let lockT = 0, lockOn = false, lockRetryT = 0;
  const hexA = (c, a) => /^#[0-9a-f]{6}$/i.test(c || '') ? c + a : tone(`rgba(255,140,60,.5)`);   // a colour with see-through (no color-mix: OBS's browser is older)
  // 1.12.6: how a player's picture sits (its size and centre, set in the app) — the same on FullVS, GlassVS and the PlayerCards
  function frameVars(name) {
    const f = ST.frames && ST.frames[String(name || '').trim().toLowerCase()]; if (!f) return '';
    return `--pz:${Number(f.z) || 1};--px:${Number(f.x) || 0}%;--py:${Number(f.y) || 0}%`;
  }
  function picOf(name) {
    const s = teamSlot(name); if (s && s.p.pic) return s.p.pic;
    const x = V && V.fighters && V.fighters.find(y => same(y.name, name)); return (x && x.pic) || '';
  }
  // after whatever is already queued (a NEXT CHALLENGER band…), then a beat
  function queueLock(wait) { bandQ = bandQ.then(() => sleep(wait)).then(() => { try { lockSplash(); } catch {} }); }
  function lockClose(now) {
    clearTimeout(lockT); if (!lockOn && !lockEl.classList.contains('on')) return;
    lockOn = false;
    if (now || POTATO()) { lockEl.getAnimations({ subtree: true }).forEach(a => a.cancel()); lockEl.className = ''; lockEl.innerHTML = ''; return; }
    const win = lockEl.querySelector('.win'); if (!win) { lockEl.className = ''; return; }
    lockEl.querySelectorAll('.hf').forEach((h, i) => h.animate([{ transform: 'none' }, { transform: `translateX(${i ? 60 : -60}px)` }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }));
    lockEl.animate([{ opacity: 1, filter: 'none' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 520, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { if (!lockOn) { lockEl.getAnimations({ subtree: true }).forEach(a => a.cancel()); lockEl.className = ''; lockEl.innerHTML = ''; } };
  }
  function lockHTML() {
    const fmt = !!(F && F.status === 'live' && V), pre = fmt ? PRESET() : '', p1 = ST.p1 || {}, p2 = ST.p2 || {}, m = (fmt && F.match) || {};
    // 1.12.6: GlassVS for any match — outside a team format the two sides take the players' own colours (or the layout's)
    // 1.12.24: …or the layout's own colours (its player bars: red and blue on Default, or whatever a layout of yours has) when they
    // tell the two sides apart; the look's own pair when they don't (both gold on Obsidian Glass and Porcelain)
    const own = window.__SB_SIDES || [], ownOk = !!(own[0] && own[1] && own[0] !== own[1]);
    const plain = (p, n) => ({ t: -2, i: n - 1, team: { name: p.team || '', color: /^#[0-9a-f]{6}$/i.test(p.teamColor || '') ? p.teamColor : ownOk ? own[n - 1] : PORC ? (n === 1 ? '#c9a13b' : '#d8cfb8') : n === 1 ? T.acc : T.two }, p });
    let s1 = fmt ? vsSlot(p1.name) : null, s2 = fmt ? vsSlot(p2.name) : null;
    if (!s1 || !s2) { s1 = plain(p1, 1); s2 = plain(p2, 2); }
    // 1.12.7: the colours picked for the VS screens (left = Player 1, right = Player 2) — not in team formats, where the sides are the teams
    { const vc = (ST.fx && ST.fx.vsc) || [], pick = (x, n) => (vc[n] && x.t < 0 ? { ...x, team: { ...x.team, color: vc[n] } } : x); s1 = pick(s1, 0); s2 = pick(s2, 1); }
    const stat = s => {
      if (s.t === -2) { const p = s.p, rec = p.wins !== '' && p.wins != null && p.losses !== '' && p.losses != null ? `${p.wins}W – ${p.losses}L` : ''; return `<span>${esc([p.character, rec].filter(Boolean).join(' · ') || (s.i ? 'PLAYER 2' : 'PLAYER 1'))}</span>`; }
      if (s.t < 0) return `${crests(s.p.lives, Math.max(s.p.maxLives, s.p.lives), 0, 1, s.team.color, 26)}<span>${s.p.lives === 1 ? 'LAST LIFE' : `${s.p.lives} LIVES`} · ${s.team.left} REMAIN</span>`;   // Death Battle
      if (V.mode === 'tdb') return `${crests(s.p.lives, Math.max(V.lives, s.p.lives), s.p.hits, V.per, s.team.color, 26)}<span>${s.p.lives === 1 ? 'LAST LIFE' : `${s.p.lives} LIVES`}</span>`;
      if (pre === 'sajam') return `<span>TIER ${s.i + 1} · ${s.team.points} PT${s.team.points === 1 ? '' : 'S'}</span>`;
      if (pre === 'gauntlet') return `<span>STAGE ${s.i + 1} OF ${s.team.size}</span>`;
      return `<span>#${s.i + 1} OF ${s.team.size} · ${s.team.left} LEFT</span>`;
    };
    const half = (k, p, s) => { const pic = (fmt && picOf(p.name)) || p.media || (p.pic === 'art' && p.splashArt) || p.avatar || '';
      return `<div class="hf ${k}${pic ? '' : ' nopic'}" style="${tcv(s.team.color)};--tca:${esc(hexA(s.team.color, '9e'))}"><div class="glass"></div><i class="tint"></i>
        <div class="card"><div class="frame" style="${frameVars(p.name)}">${pic ? `<img class="pic" src="${esc(pic)}" alt="">` : `<div class="mono">${esc(String(p.name || '?').trim().charAt(0))}</div>`}</div>
        <div class="info"><small>${esc(s.team.name || s.team.tag || '')}</small><b class="sbf-nm">${esc(p.name || '')}</b><div class="st">${stat(s)}</div></div></div></div>`; };
    const title = !fmt ? '' : { tdb: 'TEAM DEATH BATTLE', crew: 'CREW BATTLE', sajam: 'TEAM BATTLE', gauntlet: 'GAUNTLET', death: 'DEATH BATTLE', koth: 'KING OF THE HILL', league: 'LEAGUE' }[pre] || (isDeath() ? 'DEATH BATTLE' : 'TEAM BATTLE');
    const n = fmt ? m.n || V.n || '' : '';
    const ca = s1.team.color || T.acc, cb = s2.team.color || T.two;
    return `<div class="win" style="--ca:${esc(ca)};--cb:${esc(cb)};--caa:${esc(hexA(ca, '70'))};--cba:${esc(hexA(cb, '70'))}">${half('L', p1, s1)}${half('R', p2, s2)}<div class="melt"></div><div class="seam"><i></i><em></em></div><div class="vs">VS</div></div>
      <div class="head">${fmt ? `<small>${esc(title)}${n ? ` · ${pre === 'tdb' ? 'BATTLE' : isDeath() || pre === 'koth' ? 'FIGHT' : 'MATCH'} ${n}` : ''}</small><b>LOCKED IN</b>` : `<small>${esc(ST.title || ST.event || '')}</small><b>${esc(ST.round || 'VERSUS')}</b>`}</div>`;
  }
  // 1.12.5: the Player VS can also be put up by hand (its own button and Stream Deck key): then it stays until it's hidden
  const playerVsOn = () => !!(ST.playerVs && ST.playerVs.show);
  function lockSplash() {
    const manual = playerVsOn();         // 1.12.6: GlassVS by hand works in any match and any layout; on its own it plays in team formats and Death Battle
    if (!manual && (!FULL || !F || F.status !== 'live' || !(V.kind === 'teams' || isDeath()) || V.mode === 'paired' && !F.match)) return;
    if (POTATO() && !manual) return;
    if (manual && !ST.hidden && !spKind && splashUp()) { clearTimeout(lockRetryT); lockRetryT = setTimeout(() => { if (playerVsOn() && !lockOn) lockSplash(); }, 250); return; }   // 1.12.7: another splash still leaving (the Layout Designer's VS fading out) — try again in a moment
    if ((!manual && ST.fx && ST.fx.lockSplash === false) || ST.hidden || vsOn || spKind || splashUp()) return;
    const html = lockHTML(); if (!html) return;
    lockClose(true); lockOn = true;
    lockEl.innerHTML = html; lockEl.className = 'on'; fitNames(lockEl);
    // 1.12.24: the title keeps clear of the game's timer — Avatar Legends' reaches down to y 182: there it sits lower and smaller,
    // still above the glass (Tekken 8, Street Fighter 6 and Fatal Fury keep it as it was)
    { const hd = lockEl.querySelector('.head'), z = (window.SB_HUD && SB_HUD.of(window.__SB_GAME || 'Tekken 8')) || []; let t = 150;
      for (const q of z) if (q.x < 1160 && q.x + q.w > 760 && q.y < 220) t = Math.max(t, q.y + q.h + 4);
      if (hd && t > 150) { hd.style.top = t + 'px'; const sm = hd.querySelector('small'), b = hd.querySelector('b'); if (sm) sm.style.fontSize = '12px'; if (b) { b.style.fontSize = '32px'; b.style.marginTop = '4px'; } } }
    // …and the glass keeps clear of the game's gauges at the bottom (Fatal Fury's Rev. gauges start at y 852): it ends above them
    { const w = lockEl.querySelector('.win'), z = (window.SB_HUD && SB_HUD.of(window.__SB_GAME || 'Tekken 8')) || []; let b = 876;
      for (const q of z) if (!q.transient && q.y > 600 && q.y < b && q.x < 1770 && q.x + q.w > 150) b = Math.min(b, q.y - 4);
      if (w && b < 876) w.style.height = (b - 236) + 'px'; }
    const L = lockEl.querySelector('.hf.L'), R = lockEl.querySelector('.hf.R'), seam = lockEl.querySelector('.seam'), line = seam.querySelector('i'), flow = seam.querySelector('em'), melt = lockEl.querySelector('.melt'), vs = lockEl.querySelector('.vs'), head = lockEl.querySelector('.head');
    const ease = 'cubic-bezier(.16,.84,.24,1)', MEET = 560;
    // the two halves: from off the screen, out of a blur, a little apart then together
    L.animate([{ transform: 'translateX(-1200px)', opacity: .4 }, { transform: 'translateX(8px)', opacity: 1, offset: .86 }, { transform: 'none' }], { duration: MEET + 120, easing: ease });
    R.animate([{ transform: 'translateX(1200px)', opacity: .4 }, { transform: 'translateX(-8px)', opacity: 1, offset: .86 }, { transform: 'none' }], { duration: MEET + 120, easing: ease });
    lockEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    head.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(-24px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 460, delay: 260, easing: ease, fill: 'backwards' });
    // they meet: a white line where the glass touches, then it melds (the line softens into both colours)
    line.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(3.2)', offset: .25 }, { opacity: .9, transform: 'scaleX(1)', offset: .55 }, { opacity: .35, transform: 'scaleX(.6)' }], { duration: 1100, delay: MEET - 40, easing: 'ease-out', fill: 'forwards' });
    melt.animate([{ opacity: 0 }, { opacity: 1, offset: .4 }, { opacity: .55 }], { duration: 1400, delay: MEET + 40, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => {
      if (!lockOn) return;
      const b = boxOf(lockEl.querySelector('.win')), sx = b.x + b.w * .54, ex = b.x + b.w * .46;
      for (let k = 0; k <= 6; k++) { const t = k / 6; spark(sx + (ex - sx) * t, b.y + b.h * t, 6, .55, k % 2 ? '#ffffff' : T.spark); }
      screenShake(5, 260);
    }, MEET);
    // a light runs down the join, twice (the second softer)
    const run = (delay, o) => flow.animate([{ opacity: 0, transform: 'translateY(-150px)' }, { opacity: o, offset: .2 }, { opacity: o, offset: .8 }, { opacity: 0, transform: 'translateY(653px)' }], { duration: 900, delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
    run(MEET + 260, 1); run(MEET + 1500, .6);
    vs.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.92)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,-50%)' }], { duration: 520, delay: MEET + 120, easing: ease, fill: 'both' });
    lockEl.querySelectorAll('.info').forEach((x, i) => [...x.children].forEach((c, k) => c.animate([{ opacity: 0, transform: `translateX(${i ? 30 : -30}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: MEET + 200 + k * 90, easing: ease, fill: 'backwards' })));
    lockEl.querySelectorAll('.frame').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(26px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: MEET + 60 + i * 60, easing: ease, fill: 'backwards' }));
    // 1.12.23: parallax — each picture sits deeper than its glass: it travels a little less on the way in and drifts the
    // rest of the way as the panels settle (added to its own size and place, so the framing set in the app is kept)
    if (!CALM()) lockEl.querySelectorAll('.frame .pic, .frame .mono').forEach((x, i) => x.animate([{ transform: `translateX(${i ? -90 : 90}px)` }, { transform: 'translateX(0px)' }], { duration: MEET + 1900, easing: 'cubic-bezier(.16,.84,.24,1)', composite: 'add' }));
    if (!manual) lockT = setTimeout(() => lockClose(false), 4300);
  }

  // ===================================================================================== Team Death Battle moments
  const crestsOf = el => el ? [...el.querySelectorAll('.sbf-cr')] : [];
  // a set lost but the life holds (a life worth 2+ sets): the crest cracks and drains a little
  function plateHit(k, e) {
    const p = plate(k); if (!p || POTATO()) return;
    const cr = crestsOf(p.querySelector('.sbf-lv-slot') || document.getElementById('sbf-tag' + k))[Math.max(0, e.lives - 1)], pb = boxOf(p), right = k === 2;
    shake(p, 4, 300); flashEl(p, 160);
    if (cr) { const [x, y] = center(cr); spark(x, y, 26, .8); ring(x, y, 160); cr.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.9) rotate(-8deg)', filter: 'brightness(3)', offset: .35 }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }); }
    stamp(`CRACKED<small>${esc(e.name)} · SET ${e.hits} OF ${e.per}</small>`, right ? pb.x + pb.w - 40 : pb.x + 40, pb.y + pb.h + 40, { dur: 1400, rot: right ? 4 : -4, align: right ? 'right' : 'left' });
  }
  function barHitT(e) { const t = barItem(`t${e.t}-${e.i}`); if (!t || POTATO()) return; const cr = crestsOf(t)[Math.max(0, e.lives - 1)]; if (cr) cr.animate([{ transform: 'scale(1.8)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 500 }); cardBurst(t.querySelector('.td-card'), { x: .5, y: .1, col: (F.teams[e.t] || {}).color || T.acc, n: 8, ring: false }); shake(t, 3, 260); }
  // a life lost: on the team bar the crest on top of that fighter's card bursts in the team's colour
  function barLifeT(e) {
    const t = barItem(`t${e.t}-${e.i}`); if (!t) return;
    cardLife(t, e.lives, (F.teams[e.t] || {}).color || T.acc);
    const tm = barItem('team' + e.t); if (tm) flashEl(tm, 400);
  }
  function cardLife(t, lives, col) {
    const cr = crestsOf(t)[lives], e = { lives }, lv = t.querySelector('.td-lv');
    if (cr && lv && !POTATO()) {
      // the full crest is still there for a moment: it swells, glows and bursts — all inside the lives row — and the empty
      // socket fades in under it; the burst itself goes off inside the card
      const b = boxOf(cr), lb = boxOf(lv), w = document.createElement('div');
      w.innerHTML = crest('full', col, 0, b.w); const g = w.firstChild;
      g.style.cssText += `;position:absolute;left:${b.x - lb.x}px;top:${b.y - lb.y}px;z-index:3;margin:0;pointer-events:none`; lv.appendChild(g);
      cr.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], { duration: 700 });
      g.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.45)', opacity: 1, offset: .45 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).onfinish = () => g.remove();
      setTimeout(() => cardBurst(t.querySelector('.td-card'), { x: .5, y: .12, col, n: 12 }), 220);
    }
    shake(t, 3, 300); flashEl(t, 380);
    if (e.lives === 1) setTimeout(() => ecgSweep(t.querySelector('.td-card') || t, { dur: 900 }), 450);   // down to the last life
  }
  // knocked out: the card is slashed in two, the halves fall away in the team's colour, and it comes back as a dark K.O. card
  async function koCard(e, heldDone) {
    const t = barItem(`t${e.t}-${e.i}`); if (!t) return;
    await cardKO(t, (F.teams[e.t] || {}).color || T.acc, e.t === 1);
    const tm = barItem('team' + e.t); if (tm) flashEl(tm, 500);
    if (!heldDone) band('KNOCKED OUT', e.name, `${esc(e.team || '')} · ${e.left} LEFT`, (F.teams[e.t] || {}).color || T.acc, { hold: 1200, from: e.t === 1 ? -1 : 1, snd: '' });
    await sleep(300);
  }
  // the card breaks inside its own box and comes back as a dark K.O. card (Team Death Battle and, 1.12.6, Death Battle)
  async function cardKO(t, col, right) {
    const card = t.querySelector('.td-card');
    if (POTATO() || !card) return;
    shake(t, 3, 300);
    await glassKO(card, col, right ? -1 : 1);
    card.style.opacity = '';
    card.animate([{ opacity: 0, transform: 'translateY(26px) scale(.86)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.04)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
    const ko = t.querySelector('.td-ko'); if (ko) ko.animate([{ opacity: 0, transform: 'scale(2.6) rotate(-14deg)' }, { opacity: 1, transform: 'scale(.92) rotate(-4deg)', offset: .6 }, { opacity: 1, transform: 'rotate(-4deg)' }], { duration: 480, delay: 120, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
  }

  // (1.3.5) a switch. Only up and down: no card ever grows sideways, so the cards next to the middle never run into each
  // other or into it. The fighter going out steps down and dims; a streak of the team's colour runs along the foot of
  // the cards from them to the one coming in, who rises into place; the name wipes in on the player bar.
  function switchFx(e) {
    const tm = F.teams[e.t] || {}, col = tm.color || T.acc, idx = nm => (tm.players ? tm.players.findIndex(p => same(p.name, nm)) : -1);
    const j = idx(e.to), inn = j >= 0 && barItem(`t${e.t}-${j}`), k = e.from ? idx(e.from) : -1, out = k >= 0 && barItem(`t${e.t}-${k}`);
    if (!POTATO()) {
      const ease = 'cubic-bezier(.22,.8,.3,1)';
      if (out) out.animate([{ transform: 'translateY(-8px)', opacity: 1, filter: 'brightness(1.3)' }, { transform: 'translateY(7px)', opacity: .55, filter: 'brightness(.7) saturate(.6)', offset: .45 }, { transform: 'none', opacity: 1, filter: 'none' }], { duration: 640, easing: ease });
      if (out && inn) {
        const a = boxOf(out.querySelector('.td-card') || out), b = boxOf(inn.querySelector('.td-card') || inn);
        const ax = a.x + a.w / 2, bx = b.x + b.w / 2, y = Math.max(a.y + a.h, b.y + b.h) + 4, l = Math.min(ax, bx), w = Math.abs(bx - ax);
        const st = document.createElement('div');
        st.style.cssText = `position:fixed;left:${l}px;top:${y}px;width:${Math.max(2, w)}px;height:3px;border-radius:2px;z-index:9452;pointer-events:none;background:linear-gradient(90deg,transparent,${col},#fff,${col},transparent);background-size:60% 100%;background-repeat:no-repeat;box-shadow:0 0 10px ${col}`;
        document.body.appendChild(st);
        const fromL = bx > ax;
        st.animate([{ backgroundPosition: fromL ? '-60% 0' : '160% 0', opacity: 0 }, { opacity: 1, offset: .2 }, { backgroundPosition: fromL ? '160% 0' : '-60% 0', opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 560, delay: 120, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }).onfinish = () => st.remove();
      }
      if (inn) {
        inn.style.zIndex = '3';
        inn.animate([{ transform: 'translateY(16px)', opacity: .6, filter: 'brightness(1.8)' }, { transform: 'translateY(16px)', opacity: .6, filter: 'brightness(1.8)', offset: .3 }, { transform: 'translateY(-11px)', opacity: 1, filter: 'brightness(1.4)', offset: .78 }, { transform: 'translateY(-8px)', opacity: 1, filter: 'none' }],
          { duration: 760, easing: ease }).onfinish = () => { inn.style.zIndex = ''; };
        setTimeout(() => cardBurst(inn.querySelector('.td-card') || inn, { col, n: 10 }), 520);
        reveal(inn.querySelector('.sbf-nm'), { from: e.t === 1 ? 'right' : 'left', dur: 380, delay: 300 });
      }
    }
    for (const kk of [1, 2]) if (same((ST['p' + kk] || {}).name, e.to)) plateIn(kk);
    band('SWITCH IN', e.to, `${tm.name || ''} · ${e.lives} ${e.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, col, { hold: 1000, from: e.t === 1 ? -1 : 1, y: 470, snd: '' });
  }
  // the card of a player who picked another character: the new art comes in with a quick flash (character select style)
  function charSwap(e) {
    if (POTATO() || !V || !bar) return; const nm = String(e.name || '').toLowerCase();
    for (const it of bar.querySelectorAll('.it.td:not(.team)')) {
      if ((it.querySelector('.sbf-nm') || {}).textContent.trim().toLowerCase() !== nm) continue;
      const c = it.querySelector('.td-card'); if (!c) continue;
      c.animate([{ filter: 'brightness(2.6) saturate(.4)', transform: 'scale(1.06)' }, { filter: 'none', transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      const pic = c.querySelector('.sbf-pic'); if (pic) pic.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' });
    }
  }
  function switchWin() {
    const em = bar && bar.querySelector('.bc em'); if (!em || POTATO()) return;
    const [x, y] = center(em); ring(x, y, 260, T.hot, 600);
    em.animate([{ transform: 'scale(1.5)', filter: 'brightness(2.4)' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  }

  // ===================================================================================== splashes (board, team VS, champion)
  let spKind = '', spN = -1, KO = null;
  function splash(s) {
    const want = (s.splash && s.splash.show) || '', n = s.splash && s.splash.n;
    const own = window.__SB_FORMAT_OWN || [];   // a designer layout with its own screen for it
    KO = s.koth || KO;
    const mine = (['fvs', 'fboard', 'fwin'].includes(want) && F && V && !own.includes(want)) || (want === 'flead' && !!KO && !own.includes('flead'));
    if (!mine) { if (spKind) closeSplash(); return; }
    if (spKind === want && spN === n) { refreshSplash(); return; }
    spKind = want; spN = n; openSplash();
  }
  function closeSplash() {
    spKind = '';
    if (POTATO()) { sp.classList.remove('on'); sp.innerHTML = ''; return; }
    const st = sp.querySelector('.stage');
    if (st) shatter(st.querySelector('.ttl') || st, { n: 12, power: 1 });
    sp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).onfinish = () => { sp.classList.remove('on'); sp.innerHTML = ''; sp.getAnimations().forEach(a => a.cancel()); };
  }
  // 1.12.13: a player's picture for the team splashes — their own picture first, then their character's art, else their
  // initial on the team's colour
  const avHTML = (p, cls) => { const src = (p && (p.pic || p.charPic)) || ''; return `<span class="${cls}${src ? '' : ' none'}">${src ? `<span class="sbf-pic fill" data-src="${esc(src)}" data-key="${esc(p.pic ? p.picKey || '' : '')}"></span>` : `<i>${esc(String(p.name || '?').trim().charAt(0) || '?')}</i>`}</span>`; };
  // 1.12.13: the Team VS splash, its own look — the screen split between the two teams, each team's line-up standing as
  // tall portraits (pictures when they have them) facing the other, a big VS on the seam. (The board is a roster table.)
  function teamVsHTML() {
    const n = Math.max(V.teams[0].players.length, V.teams[1].players.length), cw = Math.max(60, Math.min(150, Math.floor((730 - (n - 1) * 12) / Math.max(1, n)))), chh = Math.round(Math.min(cw * 2.05, 330));
    const sub = t => `${t.size} PLAYERS${V.mode === 'tdb' ? ` · ${V.lives} ${V.lives === 1 ? 'LIFE' : 'LIVES'} EACH` : ''}${t.coach ? ` · COACH ${esc(t.coach)}` : ''}`;
    const side = (t, i) => `<div class="tv-half ${i ? 'R' : 'L'}" style="${tcv(t.color)}"></div>
      <div class="tv-name ${i ? 'R' : 'L'}" style="${tcv(t.color)}"><small>${sub(t)}</small>${t.logo ? `<img class="sp-logo" src="${esc(t.logo)}" alt="">` : ''}<b class="sbf-nm">${esc(t.name)}</b></div>
      <div class="tv-line ${i ? 'R' : 'L'}" style="${tcv(t.color)};--cw:${cw}px;--ch:${chh}px">${t.players.map((p, j) => `<div class="tv-p${p.out ? ' out' : ''}">${avHTML(p, 'tv-ph')}<span class="tv-k">${F.rules.tiers ? 'T' : PRESET() === 'gauntlet' ? 'S' : '#'}${j + 1}</span><div class="tv-pn"><span class="sbf-nm">${esc(p.name)}</span>${p.character ? `<small>${esc(p.character)}</small>` : ''}</div></div>`).join('')}</div>`;
    return `<div class="tv">${side(V.teams[0], 0)}${side(V.teams[1], 1)}<div class="tv-seam"></div>
      <div class="ttl"><small>${esc(F.name)}</small>${({ sajam: 'TEAM BATTLE', gauntlet: 'THE GAUNTLET', tdb: 'TEAM DEATH BATTLE' }[PRESET()] || 'CREW VS CREW')}</div><div class="sp-vs tv-vs">VS</div></div>`;
  }
  function splashHTML() {
    const k = spKind;
    if (k === 'flead') return leadHTML();
    if (F.kind === 'teams' && k === 'fvs') return teamVsHTML();
    if (F.kind === 'teams') {
      const team = (t, i) => `<div class="sp-team ${i ? 'R' : 'L'}" style="${tcv(t.color)};--tcb:${esc(t.color)}${ONI ? '40' : '99'}"><h2><small>${esc(k === 'fvs' ? `${t.size} PLAYERS${V.mode === 'tdb' ? ` · ${V.lives} ${V.lives === 1 ? 'LIFE' : 'LIVES'} EACH` : ''}` : V.mode === 'paired' ? `${t.points} PTS` : V.mode === 'tdb' ? `${t.livesLeft} LIVES · ${t.left} OF ${t.size} LEFT` : `${t.left} OF ${t.size} LEFT`)}${t.coach ? ` · COACH ${esc(t.coach)}` : ''}</small>${t.logo ? `<img class="sp-logo" src="${esc(t.logo)}" alt="">` : ''}${esc(t.name)}</h2>
        ${t.players.map((p, j) => `<div class="sp-card ${k === 'fvs' ? '' : p.state}${k === 'fwin' && V.mvp === p.name && V.winnerTeam === i ? ' mvp' : ''}"><span class="k">${F.rules.tiers ? 'T' : PRESET() === 'gauntlet' ? 'S' : '#'}${j + 1}</span>${k === 'fboard' ? avHTML(p, 'av') : ''}<span class="sbf-nm">${esc(p.name)}</span>${k === 'fboard' ? `<span class="st">${p.out ? 'OUT' : p.state === 'playing' ? 'ON NOW' : ''}</span>` : ''}${p.character ? `<span class="c">${esc(p.character)}</span>` : ''}${V.mode === 'tdb' ? `<span class="r">${crests(p.lives, Math.max(V.lives, p.lives), p.hits, V.per, t.color, 16)}</span>` : k !== 'fvs' ? `<span class="r">${p.wins}–${p.losses}</span>` : ''}</div>`).join('')}
        ${t.coach && V.mode === 'paired' ? `<div class="sp-card coach"><span class="k">${ICON('crown')}</span><span class="sbf-nm">${esc(t.coach)}</span><span class="c">COACH</span></div>` : ''}</div>`;
      if (k === 'fwin') {
        const w = F.winner, wt = w >= 0 ? V.teams[w] : null;
        const stat = wt ? (V.mode === 'paired' ? `${V.teams[w].points}–${V.teams[1 - w].points}` : V.mode === 'tdb' ? `${wt.left} STANDING · ${wt.livesLeft} ${wt.livesLeft === 1 ? 'LIFE' : 'LIVES'} TO SPARE` : `${wt.left} STANDING`) + (V.mvp ? ` · MVP ${V.mvp}` : '') : 'IT’S A DRAW';
        return `<div class="sp-rays"></div><div class="sp-champ" style="top:240px"><small>${esc(F.name)} CHAMPIONS</small><b>${esc(wt ? wt.name : 'DRAW')}</b><div class="stat">${esc(stat)}</div></div>
          ${wt ? `<div class="sp-row" style="${tcv(wt.color)}">${wt.players.map(p => `<div class="sp-card${p.name === V.mvp ? ' mvp' : ''}"><span class="sbf-nm">${esc(p.name)}</span><span class="r">${p.wins}–${p.losses}</span></div>`).join('')}</div>` : ''}
          ${w >= 0 ? `<div class="sp-next" style="bottom:46px;opacity:.6">${esc(V.teams[1 - w].name)}</div>` : ''}`;
      }
      return `<div class="ttl"><small>${esc(F.name)}${k === 'fboard' ? ' · ' + esc(V.label.replace(F.name + ' — ', '')) : ''}</small>${k === 'fvs' ? ({ sajam: 'TEAM BATTLE', gauntlet: 'THE GAUNTLET', tdb: 'TEAM DEATH BATTLE' }[PRESET()] || 'CREW VS CREW') : esc(V.teams[0].name + ' vs ' + V.teams[1].name)}</div>${team(V.teams[0], 0)}${k === 'fvs' ? '<div class="sp-vs">VS</div>' : `<div class="sp-mid">${V.mode === 'paired' ? `${V.teams[0].points}–${V.teams[1].points}` : `${V.teams[0].left}–${V.teams[1].left}`}<small>${V.mode === 'paired' ? 'FIRST TO ' + V.goal : 'PLAYERS LEFT'}</small>${(() => { const a = V.teams[0].players.find(p => p.state === 'playing'), b = V.teams[1].players.find(p => p.state === 'playing'); return a && b ? `<em><span>ON NOW</span><b>${esc(a.name)}</b><i>VS</i><b>${esc(b.name)}</b></em>` : ''; })()}</div>`}${team(V.teams[1], 1)}`;
    }
    if (F.kind === 'elim') {
      if (k === 'fwin') {
        // (BeeboScore prototype build) shown before it is over (the operator can put it up any time): the king, or whoever
        // leads, instead of an empty name and "BEST STREAK undefined"
        const done = !!V.champion, lead = V.mode === 'koth' ? V.king : (V.fighters.filter(x => !x.out).sort((a, b) => b.lives - a.lives || b.wins - a.wins)[0] || {}).name;
        const who = V.champion || lead || '', best = V.bestStreak != null ? V.bestStreak : Math.max(0, ...V.fighters.map(x => x.best || 0));
        const ghosts = V.fighters.filter(x => x.name !== who).slice(0, 12).map(x => `<span>${esc(x.name)}</span>`).join('');
        const pl = (V.places || []).filter(p => p.place > 1 && p.place <= 3);
        return `<div class="sp-ghost">${ghosts}${ghosts}</div><div class="sp-rays"></div><div class="sp-champ"><small>${V.mode === 'koth' ? 'KING OF THE HILL' : done ? 'LAST ONE STANDING' : 'IN THE LEAD'}</small><b>${esc(who)}</b><div class="stat">${V.mode === 'koth' ? `BEST STREAK ${best}` : done ? `${esc(F.name)} CHAMPION` : `${V.alive} REMAIN`}</div></div>
          ${pl.length ? `<div class="sp-places">${pl.map(p => `<span>${ord(p.place)}<b>${esc(p.name)}</b></span>`).join('')}</div>` : ''}`;
      }
      const fs = V.fighters.slice().sort((a, b) => (a.out - b.out) || (a.out ? a.place - b.place : 0));
      const nxt = F.match ? [F.match.a, F.match.b] : [];
      return `<div class="ttl" style="text-align:left;left:110px"><small>${V.total} FIGHTERS${V.mode === 'death' ? ` · ${F.rules.lives} ${F.rules.lives === 1 ? 'LIFE' : 'LIVES'}` : ''}</small>${esc(F.name)}</div><div class="sp-big">${V.mode === 'koth' ? `<span>👑 ${esc(V.king || '—')}</span><small>STREAK ${V.streak}</small>` : `<span>${V.alive}</span><small>REMAIN</small>`}</div>
        <div class="sp-grid">${fs.map(x => `<div class="sp-f ${x.out ? 'out' : ''}${nxt.includes(x.id) ? ' next' : ''}${x.king ? ' king' : ''}" data-id="${x.id}"${V.mode === 'death' ? ` style="${tcv(fcol(x))}"` : ''}><span class="sbf-nm">${x.king ? '👑 ' : ''}${esc(x.name)}</span>
          ${x.out ? `<span class="pl">${ord(x.place)}</span>${SKULL}` : V.mode === 'death' ? crests(x.lives, Math.max(x.maxLives, x.lives), 0, 1, fcol(x), 24) : ''}
          <span class="meta">${x.wins}W ${x.losses}L${x.character ? ' · ' + esc(x.character) : ''}</span></div>`).join('')}</div>
        ${nxt.length ? `<div class="sp-next">NEXT<b>${esc((V.fighters.find(x => x.id === nxt[0]) || {}).name)}</b>VS<b>${esc((V.fighters.find(x => x.id === nxt[1]) || {}).name)}</b></div>` : ''}`;
    }
    if (k === 'fwin') {
      const top = V.standings.slice(1, 3);
      return `<div class="sp-rays"></div><div class="sp-champ"><small>${esc(F.name)} CHAMPION</small><b>${esc(V.champion || V.leader)}</b><div class="stat">${V.standings[0] ? `${V.standings[0].wins}–${V.standings[0].losses} · ${V.standings[0].gf}–${V.standings[0].ga} GAMES` : ''}</div></div>
        ${top.length ? `<div class="sp-places">${top.map(r => `<span>${ord(r.rank)}<b>${esc(r.name)}</b></span>`).join('')}</div>` : ''}`;
    }
    const nx = V.schedule.find(s => s.now);
    return `<div class="ttl"><small>${esc(F.name)} · ${V.played} OF ${V.total} PLAYED</small>STANDINGS</div><div class="sp-st"><div class="row h"><span>#</span><span style="text-align:left">PLAYER</span><span>W</span><span>L</span><span>GAMES</span><span>+/−</span></div>
      ${V.standings.slice(0, 10).map((r, i) => `<div class="row${i === 0 ? ' first' : ''}"><span class="rk">${r.rank}</span><span class="sbf-nm">${esc(r.name)}</span><span>${r.wins}</span><span>${r.losses}</span><span>${r.gf}–${r.ga}</span><span>${r.diff > 0 ? '+' : ''}${r.diff}</span></div>`).join('')}</div>
      ${nx ? `<div class="sp-next">NEXT<b>${esc(nx.a)}</b>VS<b>${esc(nx.b)}</b></div>` : ''}`;
  }
  // 1.12.6: the King of the Hill leaderboard — this event (starts over every event) beside the Emperor of the World (everyone
  // since the first event, top 10). Kept on this PC by the app; it updates as each fight is recorded.
  function leadHTML() {
    const K = KO || {}, ev = (K.event && K.event.event) || null, rows = (K.event && K.event.rows) || [], em = K.emperors || [];
    const king = (V && V.mode === 'koth' && V.king) || (ev && !ev.live ? ev.champion : '') || '';
    const crown = ICON('crown');
    const kRow = r => `<div class="row${same(r.name, king) ? ' king' : ''}${r.rank === 1 ? ' first' : ''}"><span class="rk">${r.rank}</span><span class="sbf-nm">${same(r.name, king) ? crown : ''}${esc(r.name)}</span><span>${r.wins}</span><span>${r.losses}</span><span class="bs">${r.best ? '×' + r.best : '–'}</span></div>`;
    const eRow = r => `<div class="row${r.rank === 1 ? ' first' : ''}"><span class="rk">${r.rank}</span><span class="sbf-nm">${esc(r.name)}${r.viewer ? '<i class="vw">VIEWER</i>' : ''}</span><span>${r.wins}–${r.losses}</span><span class="bs">${r.best ? '×' + r.best : '–'}</span><span>${r.kings ? crown + r.kings : '–'}</span></div>`;
    const empty = t => `<div class="none">${t}</div>`;
    const sub = ev ? `${esc(ev.name)} · ${ev.fights} ${ev.fights === 1 ? 'FIGHT' : 'FIGHTS'}${ev.best ? ` · BEST STREAK ×${ev.best} ${esc(ev.bestBy)}` : ''}${ev.live ? '' : ' · FINISHED'}` : 'NO EVENT YET';
    return `<div class="ttl"><small>${K.players || 0} PLAYERS · ${K.fights || 0} FIGHTS · ${K.events || 0} ${K.events === 1 ? 'EVENT' : 'EVENTS'}</small>LEADERBOARD</div>
      <div class="sp-lb">
        <div class="col koth"><h3>${crown}KING OF THE HILL<small>${sub}</small></h3><div class="row h"><span>#</span><span style="text-align:left">PLAYER</span><span>W</span><span>L</span><span>BEST</span></div>${rows.length ? rows.map(kRow).join('') : empty('The first fight of this event puts its first name here.')}</div>
        <div class="col emp"><h3>${crown}EMPEROR OF THE WORLD<small>MOST WINS SINCE THE FIRST EVENT · TOP 10</small></h3><div class="row h"><span>#</span><span style="text-align:left">PLAYER</span><span>W–L</span><span>BEST</span><span>CROWNS</span></div>${em.length ? em.map(eRow).join('') : empty('Nobody yet — every King of the Hill fight counts.')}</div>
      </div>`;
  }
  function fitChamp() { const b = sp.querySelector('.sp-champ b'); if (!b) return; b.style.fontSize = ''; let s = parseFloat(getComputedStyle(b).fontSize) || 190; b.style.fontSize = s + 'px'; while (b.scrollWidth > 1760 && s > 70) { s -= 6; b.style.fontSize = s + 'px'; } }
  function fitTeams() {
    for (const t of sp.querySelectorAll('.sp-team')) {
      t.classList.remove('dense', 'denser');
      const low = () => { const c = t.lastElementChild; return c ? c.getBoundingClientRect().bottom / scaleK() : 0; };
      if (low() > H - 70) t.classList.add('dense');
      if (low() > H - 70) { t.classList.remove('dense'); t.classList.add('denser'); }
    }
  }
  function openSplash() {
    sp.getAnimations().forEach(a => a.cancel()); purgeFx(); lockClose(true);
    document.querySelectorAll('.sbf-band, .sp-tb').forEach(x => x.remove());
    document.querySelectorAll('.sbf-stamp, .sbf-count').forEach(x => { if (!POTATO()) x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => x.remove(); else x.remove(); });   // a stamp left over from the last moment would sit on the splash
    sp.innerHTML = `<div class="bg"></div><div class="grain"></div><div class="stage k-${spKind}">${splashHTML()}</div><div class="flash"></div>`;
    sp.classList.add('on'); fitTeams(); fitChamp(); fitNames(sp); mountPics(sp); if (document.fonts) document.fonts.ready.then(() => { if (sp.classList.contains('on')) fitNames(sp); });
    if (POTATO()) return;
    sp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    if (CALM()) return;                    // Less movement: the splash fades in whole — no flash, nothing slides, slams or shakes
    sp.querySelector('.flash').animate([{ opacity: .9 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
    const ttl = sp.querySelector('.ttl'); if (ttl) ttl.animate([{ opacity: 0, transform: 'translateY(-30px)', filter: 'brightness(3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 600, delay: 150, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    if (spKind === 'fvs' && sp.querySelector('.tv')) {
      const E = 'cubic-bezier(.2,.8,.3,1)';
      sp.querySelectorAll('.tv-half').forEach((h, i) => h.animate([{ transform: `translateX(${i ? 110 : -110}%)` }, { transform: 'none' }], { duration: 560, delay: 60, easing: E, fill: 'backwards' }));
      sp.querySelectorAll('.tv-name').forEach((h, i) => h.animate([{ opacity: 0, transform: `translateX(${i ? 160 : -160}px)` }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 360, easing: E, fill: 'backwards' }));
      sp.querySelectorAll('.tv-line').forEach((l, i) => [...l.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(70px) scale(.92)', filter: 'brightness(2.2)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 460, delay: 520 + (i ? l.children.length - 1 - k : k) * 80, easing: E, fill: 'backwards' })));
      const sm = sp.querySelector('.tv-seam'); if (sm) sm.animate([{ opacity: 0, transform: 'skewX(-12deg) scaleY(0)' }, { opacity: 1, transform: 'skewX(-12deg)' }], { duration: 420, delay: 380, easing: E, fill: 'backwards' });
      const vs = sp.querySelector('.sp-vs'); if (vs) vs.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.92)', offset: .55 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 680, delay: 1000, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
      setTimeout(() => { if (spKind !== 'fvs') return; ring(960, 530, 1000, T.hot); spark(960, 470, 70, 1.3); screenShake(7, 320); }, 1340);
    } else if (spKind === 'fvs') {
      sp.querySelectorAll('.sp-team').forEach((t, i) => [...t.children].forEach((c, k) => c.animate([{ opacity: 0, transform: `translateX(${i ? 500 : -500}px) skewX(${i ? 12 : -12}deg)` }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 250 + k * 90, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' })));
      const vs = sp.querySelector('.sp-vs'); if (vs) vs.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.92)', offset: .55 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 680, delay: 900, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
      setTimeout(() => { ring(960, 520, 1100, T.hot); spark(960, 520, 80, 1.4); screenShake(8, 360); }, 1270);
      setTimeout(() => { if (spKind === 'fvs') embers(0, W, H, 60); }, 1400);
    } else if (spKind === 'fwin') {
      const b = sp.querySelector('.sp-champ b'); b.animate([{ opacity: 0, transform: 'scale(2.2)', filter: 'blur(14px) brightness(3)' }, { opacity: 1, transform: 'scale(.95)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 300, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards' });
      setTimeout(() => { ring(960, 420, 1300, T.gold, 900); spark(960, 420, 120, 1.5, T.gold); screenShake(10, 420); }, 760);
      sp.querySelectorAll('.sp-row .sp-card, .sp-places span').forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(60px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 1000 + k * 90, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
      const em = () => { if (spKind === 'fwin') { embers(0, W, H, 18, T.gold); setTimeout(em, 700); } }; setTimeout(em, 1100);
    } else if (spKind === 'flead') {
      sp.querySelectorAll('.sp-lb .col').forEach((c, i) => c.animate([{ opacity: 0, transform: `translateX(${i ? 80 : -80}px)` }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 160 + i * 90, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
      sp.querySelectorAll('.sp-lb .row:not(.h)').forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 300 + (k % 10) * 45, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    } else if (spKind === 'fboard' && F && F.kind === 'teams') {
      sp.querySelectorAll('.sp-team').forEach((t, i) => [...t.querySelectorAll('h2, .sp-card')].forEach((c, k) => c.animate([{ opacity: 0, clipPath: i ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 420, delay: 220 + k * 55, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'backwards' })));
      const mid = sp.querySelector('.sp-mid'); if (mid) mid.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.8)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 480, delay: 300, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' });
    } else {
      sp.querySelectorAll('.sp-card, .sp-f, .sp-st .row').forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(-24px)', filter: 'brightness(3)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 380, delay: 250 + k * 40, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
      setTimeout(() => { if (spKind === 'fboard') embers(0, W, H, 40); }, 900);
    }
  }
  function refreshSplash() { const st = sp.querySelector('.stage'); if (st) { const html = splashHTML(); if (st.dataset.h !== html) { st.dataset.h = html; st.innerHTML = html; fitTeams(); fitChamp(); fitNames(sp); mountPics(sp); } } }

  // ===================================================================================== state
  window.addEventListener('scoreboard', e => {
    let s = e.detail || {};
    // 1.12.8: Settings › Colours on stream: the layout's own — the two sides take the layout's colours, not the teams'
    if (s.fx && s.fx.teamCol === false) {
      const LT = PORC ? ['#c9a13b', '#d8cfb8'] : [T.acc, T.two], re = t => (t || []).map((x, i) => ({ ...x, color: LT[i % 2] }));
      s = { ...s, ...(s.fv ? { fv: { ...s.fv, ...(s.fv.teams ? { teams: re(s.fv.teams) } : {}) } } : {}), ...(s.format && s.format.teams ? { format: { ...s.format, teams: re(s.format.teams) } } : {}) };
    }
    F = s.format || null; V = s.fv || null; ST = s;
    const first = !booted; booted = true;
    if (FULL) { renderPlates(); renderBar(first); }
    if (F && F.seq !== seq) {
      const held = F.seq === heldSeq;
      const evs = seq < 0 || window.__SB_INSTANT ? [] : (F.events || []);
      seq = F.seq;
      if (first && F.status === 'live') barIntro();
      if (FULL && evs.length) play(evs, held);
    }
    if (!F) { seq = -1; }
    if (FULL) vsSync(s, first);
    splash(s);
    if (FULL) barAlpha((s.fx && s.fx.fbo != null) ? Number(s.fx.fbo) : 100);
    { const pv = playerVsOn(), key = pv ? `${(ST.p1 || {}).name}|${(ST.p2 || {}).name}|${JSON.stringify(ST.frames || {})}|${((ST.fx && ST.fx.vsc) || []).join(',')}|${ST.fx && ST.fx.teamCol === false ? 'L' : 'T'}` : ''; if (pv !== lastPv || (pv && key !== lastPvKey)) { const was = lastPv; lastPv = pv; lastPvKey = key; if (pv) { if (was && lockEl.classList.contains('on')) { const h = lockHTML(); if (h) { lockEl.innerHTML = h; fitNames(lockEl); lockEl.querySelectorAll('.seam i, .melt, .vs').forEach(x => x.style.opacity = x.classList.contains('melt') ? '.55' : x.tagName === 'I' ? '.35' : '1'); } } else { lockClose(true); lockSplash(); } } else lockClose(false); } }
  });
  let lastPv = false, lastPvKey = '';
  // 1.12.6: the format bar's background in the layout's own colours, see-through as much as Settings says (100 = solid), so
  // the players' cards and pictures stand out over the game
  const PV = (() => { const v = {}, src = tone(VARS2); for (const k of ['p1', 'p2', 'p3']) { const m = [...src.matchAll(new RegExp('--' + k + ':(#[0-9a-fA-F]{6})', 'g'))].pop(); if (m) v[k] = m[1]; } return v; })();
  let fboNow = 100;
  function barAlpha(pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct))); if (pct === fboNow) return; fboNow = pct;
    const host = document.getElementById('sbf'); if (!host) return;
    const a = Math.round(pct / 100 * 255).toString(16).padStart(2, '0');
    for (const [k, n] of [['p1', 'fb1'], ['p2', 'fb2'], ['p3', 'fb3']]) { if (pct >= 100 || !PV[k]) host.style.removeProperty('--' + n); else host.style.setProperty('--' + n, PV[k] + a); }
  }
})();
