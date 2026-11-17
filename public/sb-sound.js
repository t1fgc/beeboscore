/*
 * BeeboScore sound (developed by Beebo): the layouts come with no sounds of their own. What plays is only what you add:
 * your own sound files on a Layout Designer layout (a piece's reaction, a screen coming in or going out).
 *
 *   Overlays : loaded on every overlay page. Your sound files play when Settings › Sound is on (off by default), at the
 *              stream volume, or at full level when OBS sets the level (Settings › Sound › Let OBS set the level).
 *              OBS: tick "Control audio via OBS" on the browser source, then use its fader in the OBS mixer.
 *   Preview  : the app's live preview (?preview) is muted until you unmute it (🔊 on the preview card), then plays at the preview volume.
 *
 *   ?sound=0 on an OBS link keeps that source silent. ?screen= sources are silent (the main overlay plays).
 *
 * BeeboSound.play(name) is kept so older layouts and the format effects can still call it, but there is nothing to play:
 * the built-in sound packs were removed in 2.0.0.
 */
(function () {
  'use strict';
  if (window.BeeboSound) return;
  const Q = new URLSearchParams(location.search);
  const PANEL = !!document.querySelector('meta[name="sb-sound-panel"]');
  const PREVIEW = Q.has('preview');
  const SILENT = Q.get('sound') === '0' || Q.has('screen');
  const PKEY = 'beebo.sound.preview2';
  const prefs = () => { try { return { vol: 70, muted: true, ...(JSON.parse(localStorage.getItem(PKEY)) || {}) }; } catch (e) { return { vol: 70, muted: true }; } };   // the preview starts muted
  let stream = { on: false, vol: 60 };
  const playing = new Set();          // your files that are playing now: their level follows the volume live

  function level() {
    if (PANEL) return prefs().vol / 100;                      // a ▶ in the app always plays (at the preview level, even while the preview is muted)
    if (PREVIEW) { const p = prefs(); return p.muted ? 0 : p.vol / 100; }
    return stream.on && !SILENT ? stream.vol / 100 : 0;
  }
  // the seamless host loads a fresh copy in a hidden frame before swapping — only the visible copy plays
  function hiddenFrame() { try { return !!(window.frameElement && window.frameElement.classList.contains('next')); } catch (e) { return false; } }
  function apply() { for (const a of playing) { try { a.volume = Math.max(0, Math.min(1, level() * (a.__vol || 1))); } catch (e) {} } }

  /** a sound file you added (a designer piece's reaction, a screen in / out) */
  function file(url, vol = 1) {
    if (!url || level() <= 0 || hiddenFrame()) return;
    try {
      const a = new Audio(url); a.__vol = vol; a.volume = Math.max(0, Math.min(1, level() * vol));
      playing.add(a); const done = () => playing.delete(a); a.onended = done; a.onerror = done;
      if (window.__sbSoundLog) window.__sbSoundLog.push('file');        // tests read this
      a.play().catch(done);
    } catch (e) {}
  }
  function play() {}                  // the built-in packs are gone: nothing to play

  window.BeeboSound = { play, file, names: () => [], labels: {}, packs: [], pack: 'none', prefs, level, apply,
    setPrefs: p => { try { localStorage.setItem(PKEY, JSON.stringify({ ...prefs(), ...p })); } catch (e) {} apply(); } };
  addEventListener('storage', e => { if (e.key === PKEY) apply(); });
  if (PANEL) return;
  addEventListener('scoreboard', e => {
    const s = e.detail || {};
    if (s.snd) { const ch = s.snd.on !== stream.on || s.snd.vol !== stream.vol; stream = { on: !!s.snd.on, vol: Number(s.snd.vol) || 0 }; if (ch) apply(); }
  });
})();
