/* BeeboScore (developed by Beebo) — the look of the viewer-tournament screens (the join splash and the OBS sidebar),
 * matched to the layout that's live: Obsidian Glass, Porcelain, Ember, Oni and the ten elemental looks each dress them in their own colours,
 * lettering and shapes. Other layouts (your own Designer ones) get the tournament's own purple.
 *
 *   SBSkin.id(document)            → 'obsidian' | 'porcelain' | 'ember' | 'oni' | 'frostbite' | … | ''   (from the page's el-theme / sb-look meta)
 *   SBSkin.vars(id)                → CSS custom properties for that look (--sk-*)
 *   SBSkin.faces(id)               → @font-face rules its lettering needs
 *   SBSkin.css(id, scope, part)    → that look's shapes for a part ('join' or 'side'), scoped to `scope`
 * The colours of the ten elemental looks come from el/formats.js (window.EL_FMT) when the page has it; the copy here
 * is only for pages without it (the sidebar loads it too).
 */
(() => {
  'use strict';
  if (window.SBSkin) return;
  const BASE = {        // the tournament's own look (any layout without a look of its own)
    bg1: '#150a2c', bg2: '#030207', p1: '#1c1236', acc: '#9146ff', hot: '#c3a2ff', gold: '#ffd84a', ink: '#ffffff', sub: '#cfc4ea', muted: '#8e80ad', line: 'rgba(195,162,255,.22)',
    name: 'linear-gradient(180deg,#fff 20%,#e6dbff 60%,#b28cff)', fd: "'Saira Condensed'", fu: "'Chakra Petch'", fi: 'normal', light: false };
  const OWN = {
    ember: { p1: '#17181d', p2: '#0b0c0f', p3: '#050507', ink: '#ffffff', sub: '#d9dce4', muted: '#8d919d', acc: '#ff5a1f', hot: '#ffb36b', gold: '#f6c453', line: 'rgba(255,90,31,.35)',
      name: 'linear-gradient(180deg,#fff 0%,#e9ebf0 40%,#8f939d 52%,#d9dce3 76%,#fff 100%)', fd: "'Saira Condensed'", fi: 'italic' },
    // 1.12.4: Obsidian Glass (1.12.8: black glass and antique gold) and Porcelain (white, gold lettering, black edges)
    obsidian: { p1: '#1f1d18', p2: '#100f0c', p3: '#050507', ink: '#ffffff', sub: '#ece4d2', muted: '#8f8878', acc: '#e0a93b', hot: '#f8e2a6', gold: '#ffe2a1', line: 'rgba(224,169,59,.35)',
      name: 'linear-gradient(180deg,#fff 0%,#f4eedf 40%,#ab9f84 52%,#ebe3cf 76%,#fff 100%)', fd: "'Saira Condensed'", fi: 'italic' },
    porcelain: { p1: '#ffffff', p2: '#f6f5f1', p3: '#e2ded5', ink: '#0b0b0d', sub: '#2a2a2e', muted: '#6d6a63', acc: '#b8901f', hot: '#e4c766', gold: '#c8a032', line: 'rgba(11,11,13,.3)',
      name: 'linear-gradient(180deg,#d9b54a 0%,#b8901f 55%,#7a5c0e 100%)', fd: "'Saira Condensed'", fi: 'italic', light: true },
    // 1.12.5: the Default layout — the app's Classic panel look
    default: { p1: '#1c2030', p2: '#151822', p3: '#0a0b10', ink: '#eef1f7', sub: '#c7cdda', muted: '#8b93a7', acc: '#e9c35e', hot: '#f3d98c', gold: '#e9c35e', line: 'rgba(255,255,255,.1)',
      name: 'linear-gradient(180deg,#ffffff,#eef1f7)', fd: "'Beebo Classic','Segoe UI'", fi: 'normal' },      // 1.12.13: Beebo Classic
    oni: { p1: '#fdfbf6', p2: '#efe9dd', p3: '#d8cfbf', ink: '#141210', sub: '#5f574b', muted: '#8f8574', acc: '#b3060f', hot: '#e9c35e', gold: '#c9a13b', line: 'rgba(20,18,16,.22)',
      name: 'linear-gradient(180deg,#2a2622 0%,#141210 100%)', fd: "'Saira Condensed'", fi: 'normal', light: true },
  };
  function id(doc = document) {
    const m = n => ((doc.querySelector(`meta[name="${n}"]`) || {}).content || '').trim().toLowerCase();
    const el = m('el-theme'); if (el) return el;
    const look = m('sb-look') || m('sb-sound');
    return look === 'oni' ? 'oni' : look === 'shattered' ? 'obsidian' : look === 'porcelain' ? 'porcelain' : look === 'default' ? 'default' : look === 'ember' ? 'ember' : '';
  }
  function parse(str) { const o = {}; String(str || '').split(';').forEach(kv => { const i = kv.indexOf(':'); if (i > 0) o[kv.slice(0, i).trim().replace(/^--/, '')] = kv.slice(i + 1).trim(); }); return o; }
  function look(k) {
    const E = window.EL_FMT && window.EL_FMT[k];
    if (E) { const v = parse(E.vars); return { ...v, light: !!E.light, fd: v.fd || "'Saira Condensed'", fi: v.fi || 'normal' }; }
    return OWN[k] || null;
  }
  function vars(k) {
    const L = look(k), b = BASE;
    if (!L) return Object.entries({ bg1: b.bg1, bg2: b.bg2, pn: 'rgba(14,8,30,.78)', p1: b.p1, acc: b.acc, hot: b.hot, gold: b.gold, ink: b.ink, sub: b.sub, muted: b.muted, line: b.line, name: b.name, fd: b.fd, fi: b.fi, kbd: '#ffffff', chip: 'rgba(255,255,255,.05)' })
      .map(([x, v]) => `--sk-${x}:${v}`).join(';');
    const p1 = L.p1 || '#17181d', p2 = L.p2 || p1, p3 = L.p3 || p2;
    return Object.entries({ bg1: L.light ? p1 : p2, bg2: L.light ? p3 : p3, pn: L.light ? `color-mix(in srgb,${p1} 88%,transparent)` : `color-mix(in srgb,${p2} 80%,transparent)`, p1, acc: L.acc, hot: L.hot, gold: L.gold || L.hot,
      ink: L.ink, sub: L.sub || L.ink, muted: L.muted || L.sub, line: L.line || 'rgba(255,255,255,.15)', name: L.name || `linear-gradient(180deg,${L.ink},${L.ink})`, fd: L.fd, fi: L.fi,
      kbd: L.light ? '#ffffff' : (lum(L.acc) > .62 ? '#111318' : '#ffffff'), chip: L.light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)' })
      .map(([x, v]) => `--sk-${x}:${v}`).join(';');
  }
  function lum(c) { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return .5; const n = parseInt(m[1], 16); return (.299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255)) / 255; }
  function faces(k) { const E = window.EL_FMT && window.EL_FMT[k]; return (E && E.faces) || ''; }
  const light = k => !!(look(k) || {}).light;

  // each look's own shapes: the panel's outline and edge, the key caps, the rows, a pattern behind
  // `S` = the scope; join parts: .vj-bg .vj-right .vj-p kbd .vj-status · side parts: #side .e .match .nx
  const SHAPES = {
    ember: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:0;clip-path:polygon(0 0,calc(100% - 46px) 0,100% 46px,100% 100%,46px 100%,0 calc(100% - 46px));border:2px solid var(--sk-acc);box-shadow:inset 0 0 60px rgba(255,90,31,.12)}
${S} .vj-bg{background:radial-gradient(ellipse 60% 50% at 25% 85%,rgba(255,90,31,.35),transparent 70%),radial-gradient(ellipse 50% 60% at 90% 10%,rgba(255,179,107,.12),transparent 70%),linear-gradient(170deg,#141418,#050507 70%)}
${S} .vj-grid{background:repeating-linear-gradient(115deg,rgba(255,90,31,.08) 0 2px,transparent 2px 46px)}
${S} kbd{border-radius:2px;clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%);box-shadow:none}${S} .vj-p{border-radius:0;border-left:3px solid var(--sk-acc)}`
      : `${S} #side{border-color:var(--sk-acc);background:linear-gradient(180deg,#17181d,#050507)}${S} .e,${S} .nx,${S} .rs{border-radius:0;border-left:3px solid var(--sk-acc)}${S} .match{border-radius:0;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}`,
    oni: (S, p) => p === 'join' ? `${S} .vj-bg{background:radial-gradient(ellipse 50% 40% at 20% 30%,rgba(179,6,15,.10),transparent 70%),linear-gradient(180deg,#fdfbf6,#efe9dd)}
${S} .vj-grid{background:repeating-linear-gradient(0deg,rgba(20,18,16,.035) 0 1px,transparent 1px 7px)}${S} .vj-right{border-radius:4px;border:3px double #141210;background:rgba(253,251,246,.92);box-shadow:8px 8px 0 rgba(179,6,15,.85)}
${S} .vj-name{text-decoration:underline 10px var(--sk-acc);text-underline-offset:14px}${S} kbd{border-radius:4px;box-shadow:5px 5px 0 #141210}${S} .vj-p{border-radius:2px;background:rgba(20,18,16,.05);border-bottom:2px solid rgba(179,6,15,.4)}`
      : `${S} #side{background:linear-gradient(180deg,#fdfbf6,#efe9dd);border-color:#b3060f}${S} .e,${S} .nx,${S} .rs{border-radius:2px;border-bottom:2px solid rgba(179,6,15,.35)}${S} .match{border:2px solid #141210;border-radius:3px;box-shadow:5px 5px 0 rgba(179,6,15,.8)}`,
    frostbite: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:26px;backdrop-filter:blur(6px);border:2px solid rgba(223,243,255,.55);box-shadow:0 0 50px rgba(105,176,222,.35),inset 0 0 40px rgba(223,243,255,.1)}
${S} .vj-grid{background:radial-gradient(circle,rgba(223,243,255,.18) 1.5px,transparent 2px) 0 0/34px 34px}${S} kbd{border-radius:14px;background:linear-gradient(180deg,#bfe9ff,#69b0de);box-shadow:0 6px 0 #2f6f9b,0 0 30px rgba(191,233,255,.6)}${S} .vj-p{border-radius:12px;border:1px solid rgba(223,243,255,.25)}`
      : `${S} #side{border-radius:0 22px 22px 0;border-color:#bfe9ff;box-shadow:0 0 40px rgba(105,176,222,.35)}${S} .e,${S} .nx,${S} .rs{border-radius:12px;border:1px solid rgba(223,243,255,.2)}${S} .match{border-radius:16px;border:1px solid rgba(223,243,255,.4)}`,
    venom: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:60px 24px 70px 30px;border:3px solid var(--sk-acc);box-shadow:0 0 60px color-mix(in srgb,var(--sk-acc) 45%,transparent)}
${S} .vj-bg{background:radial-gradient(circle at 15% 100%,color-mix(in srgb,var(--sk-acc) 40%,transparent),transparent 40%),radial-gradient(circle at 70% 0%,color-mix(in srgb,var(--sk-acc) 25%,transparent),transparent 35%),linear-gradient(180deg,var(--sk-bg1),var(--sk-bg2))}
${S} .vj-grid{background:radial-gradient(circle,color-mix(in srgb,var(--sk-acc) 30%,transparent) 3px,transparent 4px) 0 0/58px 72px}${S} kbd{border-radius:30px 30px 34px 18px;box-shadow:0 10px 0 color-mix(in srgb,var(--sk-acc) 55%,#000),0 0 40px var(--sk-acc)}${S} .vj-p{border-radius:18px 18px 22px 10px}`
      : `${S} #side{border-radius:0 40px 60px 0;border-color:var(--sk-acc);box-shadow:0 0 40px color-mix(in srgb,var(--sk-acc) 40%,transparent)}${S} .e,${S} .nx,${S} .rs{border-radius:16px 16px 20px 8px}${S} .match{border-radius:24px 24px 30px 12px;border:2px solid var(--sk-acc)}`,
    royal: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:6px;border:3px solid var(--sk-gold);outline:2px solid color-mix(in srgb,var(--sk-gold) 50%,transparent);outline-offset:8px;box-shadow:0 0 60px rgba(0,0,0,.6)}
${S} .vj-grid{background:linear-gradient(45deg,transparent 46%,color-mix(in srgb,var(--sk-gold) 18%,transparent) 47% 53%,transparent 54%) 0 0/60px 60px,linear-gradient(-45deg,transparent 46%,color-mix(in srgb,var(--sk-gold) 18%,transparent) 47% 53%,transparent 54%) 0 0/60px 60px}
${S} kbd{border-radius:4px;background:linear-gradient(180deg,#fff1b8,var(--sk-gold));color:#2a1446;box-shadow:0 6px 0 #8a6a1c}${S} .vj-p{border-radius:3px;border:1px solid color-mix(in srgb,var(--sk-gold) 35%,transparent)}${S} .vj-p i{color:var(--sk-gold)}`
      : `${S} #side{border-color:var(--sk-gold);outline:2px solid color-mix(in srgb,var(--sk-gold) 40%,transparent);outline-offset:-10px}${S} .e,${S} .nx,${S} .rs{border-radius:3px;border:1px solid color-mix(in srgb,var(--sk-gold) 30%,transparent)}${S} .match{border:2px solid var(--sk-gold);border-radius:4px}`,
    crimson: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:0;clip-path:polygon(60px 0,100% 0,calc(100% - 60px) 100%,0 100%);border-top:4px solid var(--sk-acc);border-bottom:4px solid var(--sk-acc)}
${S} .vj-list{padding-left:80px;padding-right:80px}${S} .vj-rh{padding-left:90px}${S} .vj-grid{background:linear-gradient(105deg,transparent 48%,color-mix(in srgb,var(--sk-acc) 35%,transparent) 49.5% 50.5%,transparent 52%) 0 0/100% 100%}
${S} kbd{border-radius:0;clip-path:polygon(16px 0,100% 0,calc(100% - 16px) 100%,0 100%);box-shadow:none}${S} .vj-p{border-radius:0;transform:skewX(-8deg)}${S} .vj-p>*{transform:skewX(8deg)}`
      : `${S} #side{border-color:var(--sk-acc)}${S} .e,${S} .nx,${S} .rs{border-radius:0;transform:skewX(-6deg)}${S} .e>*,${S} .nx>*,${S} .rs>*{transform:skewX(6deg)}${S} .match{border-radius:0;clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%);border-top:3px solid var(--sk-acc)}`,
    goldrush: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:10px;border:4px solid var(--sk-gold);box-shadow:inset 0 2px 0 rgba(255,255,255,.5),inset 0 -6px 0 rgba(0,0,0,.25),0 18px 50px rgba(0,0,0,.5)}
${S} .vj-grid{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--sk-gold) 10%,transparent) 0 2px,transparent 2px 80px)}${S} kbd{border-radius:8px;background:linear-gradient(180deg,#fff2b0,var(--sk-gold) 55%,#a5740f);color:#2a1a02;box-shadow:inset 0 2px 0 #fff8d6,0 7px 0 #6b4a0c}${S} .vj-p{border-radius:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}`
      : `${S} #side{border-color:var(--sk-gold);box-shadow:inset 0 2px 0 rgba(255,255,255,.3)}${S} .e,${S} .nx,${S} .rs{border-radius:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}${S} .match{border:3px solid var(--sk-gold);border-radius:8px}`,
    sakura: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:34px;border:2px solid color-mix(in srgb,var(--sk-acc) 35%,transparent);box-shadow:0 20px 60px rgba(180,60,110,.18)}
${S} .vj-grid{background:radial-gradient(ellipse 8px 5px,color-mix(in srgb,var(--sk-hot) 40%,transparent) 60%,transparent 70%) 0 0/90px 70px,radial-gradient(ellipse 6px 4px,color-mix(in srgb,var(--sk-acc) 30%,transparent) 60%,transparent 70%) 45px 35px/90px 70px}
${S} kbd{border-radius:999px;box-shadow:0 6px 0 color-mix(in srgb,var(--sk-acc) 60%,#000)}${S} .vj-p{border-radius:999px}`
      : `${S} #side{border-radius:0 30px 30px 0;border-color:var(--sk-acc)}${S} .e,${S} .nx,${S} .rs{border-radius:999px}${S} .match{border-radius:24px;border:2px solid color-mix(in srgb,var(--sk-acc) 40%,transparent)}`,
    tidal: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:30px 30px 0 0;-webkit-mask:radial-gradient(36px 22px at 50% 100%,transparent 98%,#000) 0 0/72px 100% repeat-x;mask:radial-gradient(36px 22px at 50% 100%,transparent 98%,#000) -36px 0/72px 100% repeat-x;padding-bottom:20px;border:2px solid color-mix(in srgb,var(--sk-acc) 60%,transparent)}
${S} .vj-grid{background:repeating-radial-gradient(ellipse at 50% 120%,transparent 0 30px,color-mix(in srgb,var(--sk-acc) 10%,transparent) 30px 32px)}${S} kbd{border-radius:22px 22px 8px 8px}${S} .vj-p{border-radius:16px 16px 6px 6px}`
      : `${S} #side{border-color:var(--sk-acc);border-radius:0 26px 26px 0}${S} .e,${S} .nx,${S} .rs{border-radius:14px 14px 4px 4px}${S} .match{border-radius:20px 20px 6px 6px;border:2px solid color-mix(in srgb,var(--sk-acc) 50%,transparent)}`,
    voltage: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:0;clip-path:polygon(0 18px,4% 0,8% 18px,12% 0,16% 18px,20% 0,100% 0,100% calc(100% - 18px),96% 100%,92% calc(100% - 18px),88% 100%,84% calc(100% - 18px),80% 100%,0 100%);border:none;box-shadow:inset 0 0 0 3px var(--sk-gold)}
${S} .vj-grid{background:repeating-linear-gradient(-45deg,color-mix(in srgb,var(--sk-gold) 12%,transparent) 0 14px,transparent 14px 28px);-webkit-mask:linear-gradient(transparent 70%,#000);mask:linear-gradient(transparent 70%,#000)}
${S} kbd{border-radius:0;background:var(--sk-gold);color:#0b1030;box-shadow:6px 6px 0 #0b1030,6px 6px 0 2px var(--sk-gold)}${S} .vj-p{border-radius:0;border-left:4px solid var(--sk-gold)}`
      : `${S} #side{border-color:var(--sk-gold);background:repeating-linear-gradient(-45deg,rgba(255,216,74,.06) 0 10px,transparent 10px 20px),linear-gradient(180deg,var(--sk-p1),var(--sk-bg2))}${S} .e,${S} .nx,${S} .rs{border-radius:0;border-left:4px solid var(--sk-gold)}${S} .match{border-radius:0;box-shadow:4px 4px 0 var(--sk-gold)}`,
    chrome: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:999px 999px 60px 60px / 120px 120px 60px 60px;border:3px solid transparent;background:linear-gradient(var(--sk-pn),var(--sk-pn)) padding-box,linear-gradient(180deg,#ffffff,#8b93a1 45%,#f2f4f7 55%,#5c6370) border-box}
${S} .vj-grid{background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.08) 50%,transparent 60%)}${S} kbd{border-radius:999px;background:linear-gradient(180deg,#fff,#c7ccd6 48%,#8b93a1 52%,#e9ecf1);color:#0b0d12;box-shadow:0 6px 0 #3c414c}${S} .vj-p{border-radius:999px}`
      : `${S} #side{border-image:linear-gradient(180deg,#fff,#8b93a1,#f2f4f7) 1}${S} .e,${S} .nx,${S} .rs{border-radius:999px}${S} .match{border-radius:28px;border:2px solid #c7ccd6}`,
    pastel: (S, p) => p === 'join' ? `${S} .vj-right{border-radius:44px;border:4px solid #fff;box-shadow:0 0 0 4px color-mix(in srgb,var(--sk-acc) 35%,transparent),0 24px 60px rgba(122,92,255,.2)}
${S} .vj-bg{background:radial-gradient(circle at 20% 20%,#ffe1f0,transparent 40%),radial-gradient(circle at 80% 80%,#dff1ff,transparent 45%),linear-gradient(160deg,#f6f0ff,#ebe2ff)}
${S} .vj-grid{background:radial-gradient(circle,color-mix(in srgb,var(--sk-acc) 22%,transparent) 2px,transparent 3px) 0 0/30px 30px}${S} kbd{border-radius:20px;box-shadow:0 6px 0 #4b2fd0}${S} .vj-p{border-radius:16px;background:#fff;box-shadow:0 2px 0 color-mix(in srgb,var(--sk-acc) 25%,transparent)}`
      : `${S} #side{border-radius:0 34px 34px 0;border-color:var(--sk-acc)}${S} .e,${S} .nx,${S} .rs{border-radius:16px;background:#fff}${S} .match{border-radius:22px;border:3px solid #fff;box-shadow:0 0 0 3px color-mix(in srgb,var(--sk-acc) 30%,transparent)}`,
  };
  // 1.12.4: Obsidian Glass wears Ember's cut-glass shapes in its violet sheen; Porcelain wears Oni's framed paper in gold and black
  const swap = (str, map) => map.reduce((o, [a, b]) => o.split(a).join(b), str);
  const OBS_MAP = [['rgba(255,90,31,', 'rgba(224,169,59,'], ['rgba(255,179,107,', 'rgba(246,220,150,'], ['#17181d', '#1f1d18'], ['#141418', '#17130c']];   // 1.12.8: black and gold
  const PORC_MAP = [['rgba(179,6,15,', 'rgba(184,144,31,'], ['#b3060f', '#b8901f'], ['#141210', '#0b0b0d'], ['rgba(20,18,16,', 'rgba(11,11,13,'], ['#fdfbf6', '#ffffff'], ['#efe9dd', '#f6f5f1']];
  SHAPES.obsidian = (S, p) => swap(SHAPES.ember(S, p), OBS_MAP);
  SHAPES.porcelain = (S, p) => swap(SHAPES.oni(S, p), PORC_MAP);
  SHAPES.default = (S, p) => p === 'join' ? `${S} .vj-right{border-radius:16px;border:1px solid #333a50;background:#151822}${S} .vj-bg{background:linear-gradient(180deg,#10121a,#0a0b10)}${S} .vj-grid{display:none}${S} kbd{border-radius:10px;box-shadow:none}${S} .vj-p{border-radius:10px;background:#1c2030}`
    : `${S} #side{background:linear-gradient(180deg,#151822,#0a0b10);border-color:#333a50}${S} .e,${S} .nx,${S} .rs{border-radius:10px;background:#1c2030}${S} .match{border-radius:12px;border:1px solid #333a50}`;
  function css(k, scope, part) { const f = SHAPES[k]; return f ? f(scope, part) : ''; }
  window.SBSkin = { id, vars, faces, css, light, look };
})();
