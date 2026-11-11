#!/usr/bin/env node
/* BeeboScore (developed by Beebo) — writes the layout folders of the ten elemental layouts (overlays/<name>/).
 * Each one is a tiny page that names its theme; the look itself lives in public/el/ (themes*.js + elemental.js).
 *   node tools/make-elemental-layouts.js          (raise VERSION when the pages themselves change)
 */
const fs = require('fs'), path = require('path');
const VERSION = 1;
const LAYOUTS = [
  ['frostbite', 'Frostbite', 'Carved from ice: frosted plates with icicles, snow drifting off the bar, a blizzard VS Splash and a Victory Splash under the northern lights.', ['#dff3ff', '#69b0de', '#07182a']],
  ['venom', 'Venom', 'Toxic slime: dripping black-green plates, bubbling ooze, horror lettering, an acid-splash VS Splash and a bubbling-vat Victory Splash.', ['#101c0b', '#7dff3a', '#d4ff8a']],
  ['royal', 'Royal', 'A royal court: velvet banners with gold trim and a crown for the winner, banners that unfurl for the VS Splash and a coronation for the Victory Splash.', ['#3a1466', '#f5c84c', '#fff3c4']],
  ['crimson', 'Crimson', 'Forged steel: katana-blade plates with a red edge and brush lettering, blades that clash for the VS Splash and a single cut for the Victory Splash.', ['#16181d', '#e01e37', '#e9edf2']],
  ['goldrush', 'Gold Rush', 'Solid gold: ingot plates with stamped slab lettering and showers of coins, vault doors for the VS Splash and a jackpot Victory Splash.', ['#ffd75e', '#b47a09', '#1c1203']],
  ['sakura', 'Sakura', 'Cherry blossom: washi-paper plates, brushed italic lettering and drifting petals, a petal storm VS Splash and a dawn Victory Splash.', ['#fff3f6', '#ff8fb1', '#4a1830']],
  ['tidal', 'Tidal', 'Deep water: glass plates with a moving waterline, bubbles and splashes, two waves that collide for the VS Splash and a Victory Splash that rises from the deep.', ['#073b4c', '#19d3da', '#c9fbff']],
  ['voltage', 'Voltage', 'Live current: circuit plates with a lightning-bolt edge, arcs and sparks, bolts that meet for the VS Splash and a power-surge Victory Splash.', ['#0a1030', '#ffe600', '#5b84ff']],
  ['chrome', 'Chrome', 'Liquid metal: mirror-polished capsule plates with moving reflections, heavy italic lettering, a chrome-on-black VS Splash and a mirrored Victory Splash.', ['#f2f4f7', '#8b93a1', '#0b0d12']],
  ['pastel', 'Pastel', 'Soft and playful: cloud-shaped candy plates, rounded lettering, stars and confetti, bouncing clouds for the VS Splash and balloons for the Victory Splash.', ['#ffd1e8', '#bfe3ff', '#7a5cff']],
];
const root = path.join(__dirname, '..', 'overlays');
LAYOUTS.forEach(([id, title, description, colors], i) => {
  const dir = path.join(root, id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'overlay.json'), JSON.stringify({ title, game: 'Any game', description, colors, version: VERSION, family: title, order: i + 2 }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="el-theme" content="${id}">
<meta name="sb-vs" content="off">
<meta name="sb-victory" content="off">
<title>${title}</title>
<!--
  ${title.toUpperCase()}.  1920 x 1080, transparent. One layout for every fighting game.
  ${description}

  The bar sits where the Ember layout's does: two plates along the top that leave the game's round counters, timer
  and portraits clear. This layout brings its own VS Splash and Victory Splash.

  WHERE THE LOOK LIVES
    This page only names the layout. Its shapes, lettering, colours, effects and animations are in the app
    (el/themes.js, themes-2.js and themes-3.js: look for "${id}"), and the part all ten elemental layouts share is
    el/elemental.js. To build a layout of your own, use the Overlay maker.
-->
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent}</style>
</head>
<body>
<script src="/static/el/themes.js"></script>
<script src="/static/el/themes-2.js"></script>
<script src="/static/el/themes-3.js"></script>
<script src="/static/el/elemental.js"></script>
</body>
</html>
`);
});
console.log('wrote', LAYOUTS.length, 'layouts');
