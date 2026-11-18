#!/usr/bin/env node
/* BeeboScore (developed by Beebo) — builds the Obsidian Glass layouts from the Classic ones.
 *
 *   node tools/make-obsidian.js
 *
 * For each game's Classic layout (overlays/<game>-default) this writes overlays/<game>-obsidian: the same pieces in the
 * same places (so it stays clear of that game's HUD exactly as Classic does), dressed in black glass and antique gold, with
 * the Obsidian Glass behaviour: Saira italic lettering, plates that crack as a player falls behind and shatter on the loser,
 * gold for the winner, an overshooting tempo, and gold embers on the splashes. Its own VS, Victory, Top 8, bracket and
 * standings screens are recoloured the same way, and the page says `sb-look: shattered`, so the format splashes, FullVS,
 * GlassVS and the bracket pieces wear the Obsidian skin (public/sb-skin.js). Tekken 8 also gets the game-format versions,
 * like Classic. Run it again after changing a Classic layout.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OV = path.join(ROOT, 'overlays');
const GAMES = [
  ['tekken8', 'Tekken 8', 'along the top, between the health bars and round counters and clear of the timer'],
  ['sf6', 'Street Fighter 6', 'along the top, above the health bars and between the portraits and the timer'],
  ['avatar', 'Avatar Legends', 'along the top, clear of the health bars and the timer'],
  ['fatalfury', 'Fatal Fury: City of the Wolves', 'along the top, clear of the health bars, the portraits and the timer'],
];
const FORMATS = { crew: 'Crew Battle', teambattle: 'Team Battle', gauntlet: 'Gauntlet', tdb: 'Team Death Battle', death: 'Death Battle', koth: 'King of the Hill', league: 'League' };

// Classic's slate, red and blue → black glass, antique gold and silver (1P gold, 2P silver; the winner turns bright gold)
const COLOURS = [
  ['#1c2030', '#1f1d18'], ['#151822', '#100f0c'], ['#10121a', '#0c0b09'], ['#0a0b10', '#050507'], ['#07080c', '#040404'], ['#05060a', '#030303'],
  ['#252a3a', '#2a261d'], ['#333a50', '#5a4824'], ['#3a3d48', '#4a3f2a'], ['#5d6579', '#7d7462'], ['#8b93a7', '#8f8878'],
  ['#d9dce4', '#ece4d2'], ['#eef1f7', '#f4eedf'], ['#e9c35e', '#e0a93b'], ['#ff5a1f', '#e0a93b'], ['#141210', '#0b0b0d'],
  ['#ff3b5c', '#e0a93b'], ['#3b8eff', '#b9c0ca'],
];
function recolour(json) {
  let s = json;
  for (const [a, b] of COLOURS) s = s.replace(new RegExp(a, 'gi'), b);
  return s;
}
const ember = (amount, extra = {}) => ({ type: 'embers', color: '#e0a93b', amount, speed: 0.8, size: 1, dir: 0, ...extra });

function obsidian(classic, game) {
  const d = JSON.parse(recolour(JSON.stringify(classic)));
  d.title = 'Obsidian Glass'; d.game = game; d.look = 'shattered';
  d.motion = { ...(d.motion || {}), tempo: 'overshoot', feel: 'smooth' };
  for (const [sn, sc] of Object.entries(d.scenes || {})) {
    for (const e of sc.elements || []) {
      if (e.font) {
        if (e.font.family === 'beebo') { e.font.family = 'saira'; e.font.size = Math.min(1.12, (Number(e.font.size) || 1) * 1.06); }
        if (sn === 'board' || ['bar', 'header', 'avatar'].includes(e.kind) || (e.kind === 'text' && sn !== 'board')) e.font.italic = true;
      }
      if (e.kind === 'bar') {
        e.dyn = { cracks: true, mend: true, heat: true, shatter: true };
        e.loseStyle = 'crack'; e.winColor = '#e0a93b';
        e.effect = { type: 'embers', color: '#e0a93b', when: 'matchpoint' };
        if (e.stroke) e.stroke = { ...e.stroke, color: '#8a6a2c', glow: 4 };
      }
      if (e.kind === 'header' && e.stroke) e.stroke = { ...e.stroke, color: '#8a6a2c', glow: 3 };
      if (sn === 'board' && e.enter && e.enter.type === 'fade' && ['bar', 'header'].includes(e.kind)) e.enter = { ...e.enter, type: 'ignite' };
    }
    if (sn === 'board') continue;
    sc.particles = ember(sn === 'vs' || sn === 'victory' ? 36 : 18);
    sc.effectColor = '#e0a93b';
    if (sn === 'vs' || sn === 'victory') { sc.transOut = 'shatter'; sc.breakAt = sc.breakAt || [960, 540]; }
    if (sc.post) sc.post = { ...sc.post, vignette: 0.45, grain: 0.06 };
    if (sc.stinger) sc.stinger = { ...sc.stinger, colors: ['#e0a93b', '#b9c0ca', '#050507'] };
  }
  return d;
}

const tmpl = fs.readFileSync(path.join(OV, 'tekken8-default', 'index.html'), 'utf8');
const scriptTag = (tmpl.match(/<script src="\/sb-design\.js[^"]*"><\/script>/) || ['<script src="/sb-design.js"></script>'])[0];
function page(d) {
  const safe = JSON.stringify(d).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sb-vs" content="off">
<meta name="sb-victory" content="off">
<meta name="sb-format" content="splash">
<meta name="sb-look" content="shattered">
<meta name="generator" content="BeeboScore Layout Designer">
<title>Obsidian Glass</title>
<!-- Built from the Classic layout by tools/make-obsidian.js: black glass and antique gold, in the same places as Classic. -->
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent}</style>
</head>
<body>
<script id="sb-design" type="application/json">${safe}</script>
${scriptTag}
</body>
</html>
`;
}
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const COLS = ['#100f0c', '#e0a93b', '#b9c0ca'];
for (const [key, game, where] of GAMES) {
  const from = path.join(OV, `${key}-default`), name = `${key}-obsidian`, dir = path.join(OV, name);
  const classic = JSON.parse(fs.readFileSync(path.join(from, 'design.json'), 'utf8'));
  const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'overlay.json'), 'utf8')); } catch { return {}; } })();
  const d = obsidian(classic, game);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(from, 'assets'))) fs.cpSync(path.join(from, 'assets'), path.join(dir, 'assets'), { recursive: true });
  const html = page(d).replace(new RegExp(`/o/${key}-default/`, 'g'), `/o/${name}/`);
  const changed = !fs.existsSync(path.join(dir, 'index.html')) || fs.readFileSync(path.join(dir, 'index.html'), 'utf8') !== html;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  writeJSON(path.join(dir, 'design.json'), d);
  writeJSON(path.join(dir, 'overlay.json'), {
    title: 'Obsidian Glass', game, gen: 2, version: (prev.version || 0) + (changed ? 1 : 0) || 1, family: 'Obsidian Glass', order: 1, colors: COLS,
    description: `Black glass and antique gold for ${game}, ${where}, in the same places as Classic. Italic lettering, plates that crack as a player falls behind and shatter on the loser, gold for the winner. Its own VS, Victory, Top 8, bracket and standings screens in the same glass.`,
  });
  if (key === 'tekken8') for (const [f, label] of Object.entries(FORMATS)) {
    const vd = path.join(OV, `${name}-${f}`); fs.mkdirSync(vd, { recursive: true });
    fs.writeFileSync(path.join(vd, 'index.html'), `<!-- BeeboScore: “Obsidian Glass — ${label}” is the Obsidian Glass layout drawn for ${label}: the format pieces come from /sb-format.js, in Obsidian Glass's own style. -->\n`);
    const vprev = (() => { try { return JSON.parse(fs.readFileSync(path.join(vd, 'overlay.json'), 'utf8')); } catch { return {}; } })();
    const cv = JSON.parse(fs.readFileSync(path.join(OV, `tekken8-default-${f}`, 'overlay.json'), 'utf8'));
    writeJSON(path.join(vd, 'overlay.json'), { title: `Obsidian Glass — ${label}`, game, family: 'Obsidian Glass', format: cv.format, base: name, description: cv.description, colors: COLS, version: vprev.version || 1, gen: 2 });
  }
  console.log('wrote', name, changed ? '(changed)' : '(same)');
}
