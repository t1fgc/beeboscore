# Building from source

[← BeeboScore guide](../GUIDE.md)

## Building from source

```bash
npm install
npm start               # desktop app (port 3200, data in Documents › BeeboScore Lite)
node server.js          # browser only, http://localhost:3000
npm run dist            # the release exe     → dist/BeeboScore-<version>.exe
npm run dist:setup      # Windows installer   → dist/BeeboScore-Setup-<version>.exe (no self-update)
npm run dist:beta       # portable Testbuild  → dist/BeeboScore Testbuild <version>.exe (never updates itself)
npm test                # unit tests (node --test)
```

## Tests

- **Unit tests** (`test/*/*.test.mjs`): the format engine, brackets and standings, start.gg sign-in, the share links and temporary files, and the other pieces in `lib/`.
- **The portable exe:** `npm run dist` and `npm run dist:beta` first put BeeboScore's own launcher in place (`desktop/portable.nsi`, via `tools/portable-cache.js`): it keeps the unpacked app in `%TEMP%` per version instead of unpacking all of it on every launch.

## Code layout

- `server.js` — the app server: state, overlays, the API and the realtime hub. The bigger pieces live in `lib/`: `format.js` (game formats), `vtourney.js` (viewer tournaments: elimination, round robin, Swiss, top cut, stations), `bracket.js` (bracket / Top 8 / standings models), `startgg.js` + `sggauth.js` (start.gg), `share.js` (live links and temporary exports), `watch.js` (the viewers' live bracket page), `notify.js` (Discord notifications), `backup.js`, `selftest.js`, `tunnel.js`, `twitch.js`, `viewers.js`.
- `public/` — the control panel (`index.html`, `panel.css`, `panel.js` plus one file per area: `match-format.js`, `format-panel.js`, `koth-panel.js`, `share-panel.js`, `report-panel.js`, `streamdeck-panel.js`, `qol-panel.js`, `panel-qol.js`…) and the overlay runtime (`sb-*.js`).
- `desktop/` — the Electron app (windows, the hidden picture window, encrypted storage). `portable-updater.js` with `lib/portable-update.js` is **Check for updates** for the portable exe: it reads this repository's releases and only accepts `BeeboScore-x.y.z.exe`. `main.js` also copies a BeeboScore 1.4.0 data folder on the first start after the move.
- `streamdeck/` — the Stream Deck plugin.

Publishing a release on GitHub is in [RELEASING.md](../RELEASING.md).

Every build runs `npm run build:streamdeck` first, which builds `streamdeck/` into `streamdeck/dist/com.t1fgc.beeboscore.lite.streamDeckPlugin` and bundles it into the app.

---

[Install & OBS](install-and-obs.md) · [Running matches](matches.md) · [Game formats](formats.md) · [start.gg brackets](brackets.md) · [Layouts](layouts.md) · [Stream Deck](stream-deck.md) · [Going online](online.md) · [Settings](settings.md) · [Building](building.md) · [Troubleshooting](troubleshooting.md)
