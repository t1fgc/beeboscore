'use strict';
// The pictures shared by the keys (drawn in a 144×144 box): art.js and keys.js both use them.
const ICONS = {
  speaker: (c, on = true) => `<path d="M26 56h20l28-24v80L46 88H26z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`
    + (on ? `<g fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"><path d="M90 54a24 24 0 0 1 0 36"/><path d="M102 40a44 44 0 0 1 0 64"/></g>` : `<path d="M92 56l28 32M120 56l-28 32" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`),
  reset: c => `<path d="M72 34a38 38 0 1 1-36.6 27.8" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M28 30l9 34 30-14z" fill="${c}"/>`,
  swap: c => `<path d="M30 54h72" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M90 36l24 18-24 18z" fill="${c}"/><path d="M114 90H42" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M54 72L30 90l24 18z" fill="${c}"/>`,
  undo: c => `<path d="M46 62h44a24 24 0 0 1 0 48H58" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M52 36L24 62l28 26z" fill="${c}"/>`,
  next: c => `<path d="M30 30l52 42-52 42z" fill="${c}"/><rect x="92" y="30" width="16" height="84" rx="4" fill="${c}"/>`,
  clear: c => `<path d="M38 38l68 68M106 38l-68 68" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`,
  layout: c => `<rect x="26" y="26" width="92" height="22" rx="5" fill="${c}"/><rect x="26" y="56" width="42" height="56" rx="5" fill="${c}" opacity=".8"/><rect x="76" y="56" width="42" height="56" rx="5" fill="${c}" opacity=".55"/>`,
  bracket: c => `<g fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 26H42V50H14M42 38H66"/><path d="M14 94H42V118H14M42 106H66"/><path d="M66 38V106M66 72H88"/></g>`
    + `<path d="M94 50h38v10a19 19 0 0 1-38 0z" fill="${c}"/><path d="M95 54h-8a10 10 0 0 0 10 13M131 54h8a10 10 0 0 1-10 13" fill="none" stroke="${c}" stroke-width="5"/><rect x="108" y="78" width="10" height="12" fill="${c}"/><rect x="99" y="89" width="28" height="7" rx="2" fill="${c}"/>`,
  refresh: c => `<path d="M104 40a46 46 0 1 0 12 30" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M118 18v34H84z" fill="${c}"/>`,
  // download-into-tray: "pull the latest results" (deliberately nothing like the round Reset arrow)
  pull: c => `<path d="M72 14v62" stroke="${c}" stroke-width="13" stroke-linecap="round"/><path d="M40 58l32 34 32-34z" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M22 92v24a8 8 0 0 0 8 8h84a8 8 0 0 0 8-8V92" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  eye: c => `<path d="M12 72C30 40 50 28 72 28s42 12 60 44c-18 32-38 44-60 44S30 104 12 72z" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round"/><circle cx="72" cy="72" r="19" fill="${c}"/>`,
  bolt: c => `<path d="M104 18 L86 58 L100 60 L84 98 L118 50 L103 48 L116 18z" fill="${c}"/>`,
  trophy: c => `<path d="M40 22h64v22a32 32 0 0 1-64 0z" fill="${c}"/><path d="M40 30H22v8a20 20 0 0 0 20 20M104 30h18v8a20 20 0 0 1-20 20" fill="none" stroke="${c}" stroke-width="8"/><rect x="64" y="74" width="16" height="20" fill="${c}"/><rect x="46" y="94" width="52" height="12" rx="3" fill="${c}"/>`,
  twitch: c => `<path transform="scale(6)" fill="${c}" d="M4.3 2 3 5.4v13.4h4.6V21h2.6l2.4-2.3h3.6L21 14V2zm15 11.2-2.7 2.7h-4.3l-2.4 2.3v-2.3H6.3V3.6h13zM16.6 6.8v4.7h-1.7V6.8zm-4.6 0v4.7h-1.7V6.8z"/>`,
  person: c => `<circle cx="72" cy="52" r="22" fill="${c}"/><path d="M28 112c4-28 22-42 44-42s40 14 44 42z" fill="${c}"/>`,
};

module.exports = { ICONS };
