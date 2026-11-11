/* BeeboScore (developed by Beebo) — "What's new".
 *
 * A window that opens once, the first time the app runs after it has been updated, listing what changed in this version.
 * Closing it tells the app (POST /api/whatsnew/seen) so it stays closed; "What's new" in Settings opens it again.
 * It only opens on the PC running the app, and never on a first-ever start.
 * When the version goes up, add its notes to NOTES below (the newest first). Someone who skipped versions is shown the
 * notes of each one they skipped; the button in Settings shows them all.
 */
(() => {
  'use strict';
  const NOTES = {
    '1.1.5': [
      ['Improved', [
        ['A starting screen', 'A small "BeeboScore: starting up" picture now shows while the exe unpacks itself, so you can see it is on its way. It also shows after Restart & update, in place of several seconds with nothing on screen.'],
        ['Restart & update says what it is doing', 'Before the window closes, the app now tells you it is installing the new version and that it will open again by itself.'],
        ['A safer hand-over', 'The new version now waits until the old one has completely finished closing before it starts.'],
      ]],
    ],
    '1.1.4': [                                           // everything since 1.0.0 (1.1.0 to 1.1.3 were test builds)
      ['New', [
        ['Ten new layouts', 'The Layout menu now has 11 layouts. Ember is the original (it was called Shattered). The ten new ones are Frostbite, Venom, Royal, Crimson, Gold Rush, Sakura, Tidal, Voltage, Chrome and Pastel. Each has its own bar shape, lettering, effects and animations, and its own VS Splash and Victory Splash. They all sit in the same place over the game as Ember.'],
        ['Scores you can read', 'In every layout the score sits in a solid box with strong contrast, and stays that way for the player who lost.'],
        ['Clear of the game', 'The new layouts never draw over the game\'s health bars, round counters, timer or portraits. Their glows stop at the edge of the bar and their effects stay inside it. Only the short burst when a game or a set is won goes past it, for about a second.'],
        ['Your own VS Splash pictures', 'In the VS Splash card on the Matches tab you can use a picture of your own for the bar behind each player\'s name (best size 920 × 250), for a header across the top (1920 × 200), or both. They show in every layout. Other sizes are scaled and cropped to fit.'],
        ['Lettering matched to your name bar', 'When you choose a name bar, the app looks at the picture and picks lettering colours that read on it: light or dark names, a tint of the picture\'s colour for the team tag, and a soft backing if the picture is busy. Pick my own lets you choose the colours, and warns you if they are hard to read.'],
        ['Splash pictures', 'On the start.gg tab, choose what each player shows on the VS Splash and the Victory Splash: their start.gg profile picture, or a character image you upload for them.'],
        ['Crop and green screen', 'After you choose a character image, a window opens where you can crop it to the panel and remove a green-screen background before it is saved.'],
        ['Find a player', 'Type a few letters and pick the name. The Splash pictures card stays short, however many players the event has.'],
        ['VS Splash button', 'On the Matches tab, with each player\'s bracket record. Ctrl + I toggles it too.'],
        ['Victory Splash', 'Shows the winner\'s character image as a large panel when they use one.'],
        ['Stream Deck', 'A VS Splash key. To get it, install the updated plugin: File → Install Stream Deck Plugin.'],
        ['What\'s new', 'This window. It opens once after an update, and again from Settings whenever you want it.'],
      ]],
      ['Changed', [
        ['Shattered is now Ember', 'The same layout under a new name. The crack lines behind "Victory" on its Victory Splash are gone.'],
      ]],
      ['Easier to read', [
        ['The loser\'s score', 'On Ember, when a set ends, the loser\'s score box stays solid and the name keeps its light, so the final score no longer disappears behind the cracks.'],
        ['The winner\'s name', 'The winner\'s name, team and "Victory" have a dark edge and a soft shadow, so they stand out from the lit plate.'],
        ['Small lettering', 'The status line, the event line, SET and 1P / 2P are a size larger and brighter. "On the edge" is no longer a dark red.'],
      ]],
      ['Fixed', [
        ['VS Splash names', 'Names sit centred under a character image, the last letter of a slanted name is no longer cut off, a short name keeps its size next to a very long one, and a team tag no longer touches the top of the name plate.'],
        ['Long names and events', 'Very long event and opponent names are shortened with "…" on the scoreboard and the Victory Splash, so they no longer run into other text.'],
        ['Overlay maker', 'The list of saved layouts refreshes before "Saved" is shown.'],
      ]],
    ],
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
.wn-back { position: fixed; inset: 0; z-index: 80; background: rgba(4, 5, 9, .78); display: grid; place-items: center; padding: 18px; }
.wn { width: min(620px, 100%); max-height: calc(100vh - 36px); display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line-2); border-radius: 14px; box-shadow: 0 30px 80px rgba(0, 0, 0, .6); }
.wn-head { padding: 20px 24px 4px; }
.wn-head h2 { margin: 0; font-size: 21px; line-height: 1.2; letter-spacing: 0; text-transform: none; color: var(--text); }
.wn-head p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.wn-body { padding: 4px 24px 8px; overflow-y: auto; min-height: 0; }
.wn-body h3 { margin: 18px 0 2px; font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: 0; text-transform: none; }
.wn-body h4.wn-ver { margin: 20px 0 -8px; padding-top: 14px; border-top: 1px solid var(--line-2); font-size: 15px; font-weight: 700; color: var(--text); }
.wn-body h4.wn-ver:first-child { margin-top: 8px; padding-top: 0; border-top: 0; }
.wn-body ul { list-style: none; margin: 0; padding: 0; }
.wn-body li { padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.wn-body li:last-child { border-bottom: 0; }
.wn-body li b { display: block; color: var(--text); font-weight: 600; font-size: 14px; }
.wn-foot { display: flex; justify-content: flex-end; padding: 12px 24px 18px; border-top: 1px solid var(--line); }
.wn :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
  document.head.appendChild(css);

  const num = v => String(v).split('.').map(n => parseInt(n, 10) || 0), newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  /** the notes to show: this version's, and those of every version after `since` that this PC skipped (newest first) */
  const versionsSince = (version, since) => Object.keys(NOTES).filter(v => !newer(v, version) && (v === version || !since || newer(v, since))).sort((a, b) => (newer(a, b) ? -1 : 1));
  const sections = v => NOTES[v].map(([title, list]) => `<h3>${esc(title)}</h3><ul>${list.map(([b, t]) => `<li><b>${esc(b)}</b>${esc(t)}</li>`).join('')}</ul>`).join('');
  let openNow = null;
  function show(version, since) {
    if (openNow || !NOTES[version]) return;
    const vs = versionsSince(version, since == null ? version : since);
    const back = document.createElement('div'); back.className = 'wn-back';
    back.innerHTML = `<div class="wn" role="dialog" aria-modal="true" aria-labelledby="wnTitle">
  <div class="wn-head"><h2 id="wnTitle">What's new in BeeboScore ${esc(version)}</h2><p>Your settings, layouts and start.gg sign-in carried over.</p></div>
  <div class="wn-body">${vs.length > 1 ? vs.map(v => `<h4 class="wn-ver">Version ${esc(v)}</h4>${sections(v)}`).join('') : sections(version)}</div>
  <div class="wn-foot"><button class="btn primary" id="wnClose">Got it</button></div>
</div>`;
    const before = document.activeElement;
    const close = () => {
      removeEventListener('keydown', onKey, true); back.remove(); openNow = null;
      fetch('/api/whatsnew/seen', { method: 'POST' }).catch(() => {});
      if (before && before.focus) before.focus();
    };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === 'Tab') { e.preventDefault(); back.querySelector('#wnClose').focus(); } };
    addEventListener('keydown', onKey, true);
    back.addEventListener('click', e => { if (e.target === back || e.target.id === 'wnClose') close(); });
    document.body.appendChild(back); openNow = back;
    back.querySelector('#wnClose').focus();
  }

  fetch('/api/info').then(r => r.json()).then(info => {
    if (!info || !info.local || !NOTES[info.version]) return;
    const btn = document.getElementById('wnOpen');         // Settings → What's new
    if (btn) { btn.hidden = false; btn.addEventListener('click', () => show(info.version, '')); }      // from Settings: every version's notes
    if (info.whatsNew) show(info.version, info.whatsNewSince || '');                                       // after an update: what this PC has not seen yet
  }).catch(() => {});
  window.BeeboWhatsNew = { show, notes: NOTES };
})();
