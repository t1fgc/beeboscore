/* BeeboScore keyboard shortcuts — shared by the control panel and the mini controller.
 * A shortcut is a string like "Q", "Ctrl+Enter" or "Ctrl+Shift+X" (empty = not set).
 * Keys are matched by their physical position (e.code), so Shift never changes the key name. */
(function () {
  'use strict';
  const DEFAULTS = {
    p1Up: 'Q', p1Down: 'A', p2Up: 'P', p2Down: 'L',
    update: 'Ctrl+Enter', swap: 'Ctrl+Shift+X', undo: 'Ctrl+Z', resetScores: '', vsToggle: 'Ctrl+I', bracketToggle: '', top8Toggle: '', bracketRefresh: '', bracketSide: '', victoryToggle: '',
    viewerNext: '', viewerWin: '', viewerLose: '', viewerQueue: '', viewerSplash: '', viewerSidebar: '', autoscoreToggle: '', autoscoreUndo: '', autoscoreConfirm: '', soundToggle: '',
  };
  const LABELS = {
    p1Up: 'Player 1 score +', p1Down: 'Player 1 score −', p2Up: 'Player 2 score +', p2Down: 'Player 2 score −',
    update: 'Update (send to stream)', swap: 'Swap sides', undo: 'Undo', resetScores: 'Reset scores to 0–0', vsToggle: 'Show / hide VS intro',
    bracketToggle: 'Show / hide bracket splash', top8Toggle: 'Show / hide Top 8 splash', bracketRefresh: 'Refresh the bracket from start.gg', bracketSide: 'Bracket: switch Winners / Losers side', victoryToggle: 'Show / hide the victory splash',
    viewerNext: 'Viewer matches: next viewer', viewerWin: 'Viewer matches: I won a game', viewerLose: 'Viewer matches: the viewer won a game',
    viewerQueue: 'Viewer matches: open / close the queue', viewerSplash: 'Viewer matches: show / hide the VS splash', viewerSidebar: 'Viewer matches: show / hide the sidebar',
    autoscoreToggle: 'Autoscore: on / off', autoscoreUndo: 'Autoscore: undo the last auto point', autoscoreConfirm: 'Autoscore: confirm the point it found', soundToggle: 'Stream sound: on / off',
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
  window.BeeboKeys = { DEFAULTS, LABELS, fromEvent, match, merged, html, hasModifier };
})();
