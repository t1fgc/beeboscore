<div align="center">

<img src="docs/images/logo.png" width="112" alt="BeeboScore logo: VS on red">

# BeeboScore

**A free scoreboard overlay for fighting game streams. One exe, no install.**

Developed by Beebo

### [⬇ Download for Windows](https://github.com/t1fgc/beeboscore/releases/latest)

</div>

![The Shattered overlay showing a match](docs/images/overlay-shattered.png)

> **This is a prototype build.** A new build is on the way later in 2026 — see [What's coming](#whats-coming).

---

## Windows SmartScreen warning

> [!WARNING]
> The first time you run the exe, Windows may show a blue box that says **"Windows protected your PC"**.
> Click **More info**, then **Run anyway**.

Windows shows this for new apps that not many people have downloaded yet. It does not mean anything was found in the file.

Only click **Run anyway** on a copy you downloaded from this repository's [Releases page](https://github.com/t1fgc/beeboscore/releases). If you got the file anywhere else, delete it and download it here.

---

## Get started

1. Download **`BeeboScore-x.y.z.exe`** from the [latest release](https://github.com/t1fgc/beeboscore/releases/latest) and put it in a folder of its own.
2. Run it. If Windows warns you, see the [SmartScreen warning](#windows-smartscreen-warning) above.
3. In OBS, add a **Browser** source:
   - URL: `http://localhost:3300/overlay`
   - Width `1920`, height `1080`
   - Leave "Refresh browser when scene becomes active" off
4. Type the player names, press **Update**, and the overlay changes on stream.

The app keeps everything it saves in a **`BeeboScore Data`** folder next to the exe. To move it to another PC, move the exe and that folder together.

---

## What's in this build

![The control panel](docs/images/control-panel.png)

### Matches
Names, scores, round, format and event on one screen. **+ / −** on each score, Swap, Reset, Undo, and a losers **[L]** mark. Changes go live when you press **Update**, or straight away in **Live** mode.

### Shattered, the built-in layout
One animated layout for every fighting game: dark obsidian with ember light along the top of the screen. It sparks when a game is taken, glows at match point, turns the winner gold and plays a victory splash when the set ends.

### Overlay maker
Drop in a finished **PNG** overlay and get an animated layout back.

![The Overlay maker](docs/images/overlay-maker.png)

- Recommended picture: **1920 × 1080 with a transparent background**, or just the scoreboard bar at its real size. PNG only, up to 20 MB.
- The picture is cut into its shapes. Each one gets its own intro, glow, shine and edge light, in one of five looks picked from the picture's colours: Ember, Steel, Neon, Pop or Clean.
- Name, score, round and event text is placed for you. Drag or resize any spot over the live preview.
- Text that's already drawn in the picture can be painted over, so only the live text shows.
- Save it, and it appears in the **Layout** menu at the top of the app. The picture never leaves your PC.

### start.gg
Sign in, load your event, and pull its players and matches onto the scoreboard. Names autocomplete as you type, and results can be sent back to start.gg when a set ends.

### Stream
Copy the OBS link, or press **Go online** for a public overlay link and a password-protected remote control you can open on a phone. It uses a free Cloudflare tunnel; you can also use your own tunnel for an address that stays the same.

### Stream Deck
The plugin comes inside the app: **File → Install Stream Deck Plugin**. Eleven keys: player score (tap +1, hold −1), reset, swap, undo, losers [L], show / hide overlay, switch layout, set player, next match, report result to start.gg and refresh start.gg matches. Needs Stream Deck 6.4 or newer.

### Settings → Check for updates
The app only looks for a new version when you press **Check for updates**. If there is one, **Download update** saves the new exe next to the one you're running, and **Restart & update** switches over to it. Your `BeeboScore Data` folder is used by both, so nothing is lost. Delete the old exe whenever you like.

---

## What's coming

The next build is planned for later in 2026 and will include:

- **Multiple supported game formats:** Team Battle, KOTH, Death Battle and more
- **Twitch integration** for Viewer Battles and Tournaments
- **Bracket Generator** with custom overlays
- **Layout Designer** with so many features creators will love to start creating their own overlays!
- And more!

---

## Your data stays on your PC

- start.gg sign-ins, API tokens, the remote-control password and tunnel tokens are stored encrypted on your PC and are never sent anywhere except to the service they belong to.
- Pictures you drop into the Overlay maker are processed on your PC.
- The app has no analytics or tracking.

---

## Good to know

- **Windows 10 or 11, 64-bit.**
- The app uses port **3300**. If something else is using it, the app picks the next free port and shows it under **Help**; use that number in the OBS link.
- Keep the app open while you stream. OBS shows the overlay from it.
- The overlay looks blank in OBS? Check the app is running and the Browser source URL matches the one on the **Stream** tab.

---

## Build it yourself

You need [Node.js 22](https://nodejs.org) or newer.

```bash
npm install
npm start          # run the desktop app from source
npm run server     # or just the server: open http://localhost:3300
npm run dist       # build dist/BeeboScore-<version>.exe
```

More in [docs/BUILDING.md](docs/BUILDING.md). Publishing a release is in [docs/RELEASING.md](docs/RELEASING.md), and changes are listed in [CHANGELOG.md](CHANGELOG.md).

---

## Licence

[MIT](LICENSE) © 2026 Beebo. The bundled fonts are under the SIL Open Font License; see [`public/fonts/FONTS-LICENSES.txt`](public/fonts/FONTS-LICENSES.txt).

Found a bug? [Open an issue](https://github.com/t1fgc/beeboscore/issues).
