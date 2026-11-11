/* BeeboScore (developed by Beebo) — the "prototype build" notice at the top of the app.
 * It's a native <details>: open the first time the app is opened, and once you close it, it stays closed
 * (as a slim bar you can open again) on this device. */
(() => {
  const el = document.getElementById('protoNote');
  if (!el) return;
  const KEY = 'beeboscore.protoNote';
  try { if (localStorage.getItem(KEY) === 'closed') el.open = false; } catch {}
  el.addEventListener('toggle', () => { try { localStorage.setItem(KEY, el.open ? 'open' : 'closed'); } catch {} });
})();
