/* BeeboScore (developed by Beebo), 1.12.18 — the phone app's service worker. It only makes the panel installable and
 * shows a friendly page when the app can't be reached; it never keeps a copy of anything live (scores, settings,
 * anything under /api, the overlays): those always come straight from BeeboScore. */
const SHELL = 'beebo-shell-1';
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BeeboScore Lite</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0f13;color:#eceef3;font:17px/1.5 system-ui,sans-serif;text-align:center;padding:24px}b{color:#ffb020}</style><div><p><b>BeeboScore Lite isn’t reachable.</b></p><p>Is the app open on the streaming PC, and is this phone on the same network (or the online link on)?</p><p><a style="color:#ffb020" href="">Try again</a></p></div>';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/static/brand/app-192.png', '/static/brand/app-512.png']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== SHELL).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))); return; }
  if (u.pathname.startsWith('/static/brand/app-')) e.respondWith(caches.match(r).then(x => x || fetch(r)));
});
