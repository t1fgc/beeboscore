# Building BeeboScore

## What you need

- [Node.js 22](https://nodejs.org) or newer (it comes with npm)
- Windows 10/11 to build and test the exe. Building also works on Linux, but the exe only runs on Windows.
- Python 3 with `beautifulsoup4` — only if you want to rebuild the control panel page (see below)

## Run from source

```bash
npm install
npm start            # the desktop app
npm run server       # only the server; then open http://localhost:3300
```

Run from source, the app writes its data into the project folder (`data/`, `output/`, and new layouts under `overlays/`). Those are in `.gitignore`.

## Build the exe

```bash
npm run dist
```

This builds the Stream Deck plugin first, then writes **`dist/BeeboScore-<version>.exe`** (portable, 64-bit). The version comes from `package.json`.

The exe is not code-signed by the build. If you sign your releases, sign this file before uploading it and keep its name.

## Where things are

| Path | What it is |
| --- | --- |
| `desktop/main.js` | The desktop shell (window, menu, data folder next to the exe) |
| `desktop/updater.js`, `lib/portable-update.js` | Settings → Check for updates |
| `server.js`, `lib/` | The local server: state, layouts, start.gg, Go online, Stream Deck |
| `public/` | The control panel and the scripts overlays load |
| `public/maker-panel.js`, `public/maker-overlay.html` | The Overlay maker and the animated template its layouts use |
| `public/player-pics.js` | Splash pictures: profile picture or uploaded character image, per player |
| `public/pic-editor.js` | The window that opens on a chosen character image: crop, and remove a green-screen background |
| `public/whats-new.js` | The "What's new" window shown once after an update, and its notes for each version |
| `public/sb-vs.js`, `public/sb-victory.js` | The VS Splash and Victory Splash that every layout loads |
| `public/vs-art.js` | Your own VS Splash pictures (name bar, header) and the lettering colours matched to a name bar |
| `public/el/elemental.js` | What the ten elemental layouts share: the page, name fitting, particles, VS Splash and Victory Splash |
| `public/el/themes.js`, `themes-2.js`, `themes-3.js` | What each of the ten is made of: shapes, lettering, colours, effects, animations |
| `overlays/shattered/` | Ember, the original layout (the folder keeps its first name) |
| `overlays/frostbite/` … `overlays/pastel/` | The ten elemental layouts: each page only names its theme |
| `tools/make-elemental-layouts.js` | Writes those ten folders |
| `streamdeck/` | The Stream Deck plugin (built by `npm run build:streamdeck`) |
| `tools/make-lite-panel.py` | Builds `public/index.html` |
| `tools/logo/vs-logo.html` | The logo's source |

## Rebuilding the control panel page

`public/index.html` is generated. Its tabs, the prototype notice and the Settings card are added by `tools/make-lite-panel.py`:

```bash
pip install beautifulsoup4
python tools/make-lite-panel.py public/index.html public/index.html
```

Running it on the page it already built is safe: it only adds what is missing. To change the prototype notice's text, edit `PROTO_HTML` in that script, delete the `<details id="protoNote">` block from `public/index.html`, and run it again.

## Changing the logo

Open `tools/logo/vs-logo.html` in a browser, export the red square at 1024 × 1024 with a transparent background, and replace:

- `desktop/icon-1024.png` and `desktop/icon.ico` (16, 24, 32, 48, 64, 128 and 256 px)
- `public/icon.png` (256 px — shown in the app and as its favicon)
- `streamdeck/assets/plugin.png` (256), `plugin@2x.png` (512), and the white `category.png` (28) / `category@2x.png` (56)

If the Stream Deck icons change, raise `Version` in `streamdeck/manifest.template.json` so installed plugins pick them up.

## Version numbers

- App: `version` in `package.json` (and `package-lock.json` — `npm version 1.1.0 --no-git-tag-version` sets both).
- Stream Deck plugin: `Version` in `streamdeck/manifest.template.json`. Raise it whenever the plugin changes.
- Built-in layouts: `version` in each `overlays/<name>/overlay.json` (for the ten elemental layouts, `VERSION` in `tools/make-elemental-layouts.js`). Raise it whenever the layout's `index.html` changes, so copies people haven't edited are upgraded. Changes to `public/el/*.js` need no version: those files are served by the app.
