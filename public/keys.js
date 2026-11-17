/* BeeboScore keyboard shortcuts — shared by the control panel and the mini controller.
 * A shortcut is a string like "Q", "Ctrl+Enter" or "Ctrl+Shift+X" (empty = not set).
 * Keys are matched by their physical position (e.code), so Shift never changes the key name. */
(function () {
  'use strict';
  const DEFAULTS = {
    p1Up: 'Q', p1Down: 'A', p2Up: 'P', p2Down: 'L',
    update: 'Ctrl+Enter', swap: 'Ctrl+Shift+X', undo: 'Ctrl+Z', resetScores: '', vsToggle: 'Ctrl+I', bracketToggle: '', top8Toggle: '', bracketRefresh: '', bracketSide: '', victoryToggle: '',
    soundToggle: '',
    setTimer: '', h2hLine: '', momentReplay: '', momentsToggle: '', statsStrip: '', gresetSplash: '',                                                          // 1.12.21: the set as it's told
  };
  const LABELS = {
    p1Up: 'Player 1 score +', p1Down: 'Player 1 score −', p2Up: 'Player 2 score +', p2Down: 'Player 2 score −',
    update: 'Update (send to stream)', swap: 'Swap sides', undo: 'Undo', resetScores: 'Reset scores to 0–0', vsToggle: 'Show / hide the VS (FullVS or GlassVS)',
    bracketToggle: 'Show / hide bracket splash', top8Toggle: 'Show / hide Top 8 splash', bracketRefresh: 'Refresh the bracket from start.gg', bracketSide: 'Bracket: switch Winners / Losers side', victoryToggle: 'Show / hide the victory splash',
    soundToggle: 'Stream sound: on / off',
    setTimer: 'Set timer: start / stop', h2hLine: 'Head-to-head line: show / hide', momentReplay: 'Moments: replay the last one', momentsToggle: 'Moments: banners on / off', statsStrip: 'Stats strip on FullVS and GlassVS: on / off', gresetSplash: 'Bracket reset splash: show / hide',
  };
  const MODS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS'];

  function keyName(code) {
    if (!code) return '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return 'Num' + code.slice(6);
    return { Space: 'Space', Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
      Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', ArrowUp: '↑', ArrowDown: '↓',
      ArrowLeft: '←', ArrowRight: '→' }[code] || code;
  }
  // "Ctrl+Shift+X" from a keydown event (Cmd counts as Ctrl). Returns '' for a lone modifier.
  function fromEvent(e) {
    if (MODS.includes(e.key)) return '';
    const k = keyName(e.code || '');
    if (!k) return '';
    return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', k].filter(Boolean).join('+');
  }
  const hasModifier = combo => /(^|\+)(Ctrl|Alt)\+/.test(combo);
  function merged(saved) {
    const out = { ...DEFAULTS };
    if (saved && typeof saved === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'string') out[k] = saved[k];
    return out;
  }
  // Which action does this event trigger? Bare keys (no Ctrl/Alt) never fire while typing in a box.
  function match(e, map, typing) {
    const c = fromEvent(e);
    if (!c) return null;
    for (const [action, combo] of Object.entries(map)) {
      if (!combo || combo !== c) continue;
      if (typing && (!hasModifier(combo) || action === 'undo')) return null;
      return action;
    }
    return null;
  }
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const html = combo => combo ? combo.split('+').map(p => `<span class="kbd">${esc(p)}</span>`).join('+') : '<span class="kbd off">not set</span>';
  /** 1.12.19: what the show's shortcuts do — `send(body)` posts a remote action (the panel's and the mini controller's own helper) */
  function showActions(send, toast = () => {}) {
    return {
      // 1.12.21 (Lite: the set's own extras only)
      setTimer: () => Promise.resolve(send({ action: 'timer', do: 'toggle' })).then(r => { if (r && r.timer) toast(r.timer.show && r.timer.start && !r.timer.end ? 'Set timer started' : 'Set timer stopped'); }),
      h2hLine: () => Promise.resolve(send({ action: 'h2h' })).then(r => { if (r && 'h2h' in r) toast(r.h2h ? 'Head-to-head line on' : 'Head-to-head line off'); }),
      momentReplay: () => Promise.resolve(send({ action: 'moments', do: 'replay' })).then(r => { if (r && r.moments) toast('The moment is back on stream'); }),
      statsStrip: () => Promise.resolve(send({ action: 'strip', do: 'toggle' })).then(r => { if (r && 'strip' in r) toast(r.strip ? 'Stats strip on' : 'Stats strip off'); }),
      gresetSplash: () => Promise.resolve(send({ action: 'greset' })).then(r => { if (r && 'greset' in r) toast(r.greset ? 'Bracket reset splash on stream' : 'Bracket reset splash off'); }),
      momentsToggle: () => Promise.resolve(send({ action: 'moments', do: 'toggle' })).then(r => { if (r && r.moments) toast(r.moments.on ? 'Moment banners on' : 'Moment banners off'); }),
    };
  }
  window.BeeboKeys = { DEFAULTS, LABELS, fromEvent, match, merged, html, hasModifier, showActions };
})();
