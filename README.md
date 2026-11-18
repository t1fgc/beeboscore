<div align="center">

<img src="docs/images/logo-wordmark.png" width="420" alt="BeeboScore: the white VS logo on red">

**A free scoreboard app for fighting game streams. One exe, no install.**

Developed by Beebo

### [⬇ Download for Windows](https://github.com/t1fgc/beeboscore/releases/latest)

</div>

![A VS splash before a Winners Semi-Final on the Tekken 8 Classic layout](docs/images/vs-intro.jpg)

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
3. A four-step setup opens: pick the game, add the overlay to OBS and, if you use it, sign in to start.gg. **Skip setup** if you'd rather do it yourself.
4. In OBS, add a **Browser** source:
   - URL: `http://localhost:3300/overlay` (or **Copy OBS URL** under the live preview)
   - Width `1920`, height `1080`
   - Leave "Refresh browser when scene becomes active" off
5. Type the player names, press **Update**, and the overlay changes on stream.

The app keeps everything it saves in a **`BeeboScore Lite Data`** folder next to the exe (the name it got in 1.5.0, when the app was called BeeboScore Lite). To move it to another PC, move the exe and that folder together.

### Coming from BeeboScore 1.4.0?

Open **Settings → Check for updates** in 1.4.0 and it fetches the latest version for you. After **Restart & update**:

- BeeboScore copies your players, pictures, settings and exports from `BeeboScore Data` into its own `BeeboScore Lite Data` folder. The old folder is left as it was.
- The first-time setup opens once, so you can pick your game's layout.
- **Sign in to start.gg again** (Bracket tab). Sign-ins are locked to the app that made them, so the new version can't read 1.4.0's.
- The OBS link stays the same (`http://localhost:3300/overlay`), so nothing changes in OBS.
- The old exe goes to the Recycle Bin.
- Ember, Porcelain and layouts you made in the Overlay maker aren't built in any more (each game has its own **Classic** layout), but you can bring them back: drop their folder from `BeeboScore Data\overlays` into the **Layouts** tab.
- There's a new Stream Deck plugin, **BeeboScore**. Install it from **Settings → Stream Deck**, then remove the old *BeeboScore Prototype* plugin in Stream Deck.

---

## What's in it

![The Matches tab](docs/images/panel-match.jpg)

Six tabs down the side: **Matches**, **Format**, **Bracket**, **Stream**, **Layouts** and **Settings**.

### Matches

Names, scores, round and event on one screen. **+ / −** on each score, Swap, Reset, Undo, and a losers **[L]** mark. Changes go live when you press **Update**, or straight away in **Live** mode. Names complete as you type, from your players and the start.gg event.

![Names completing as you type](docs/images/panel-autocomplete.jpg)

Before a set, **FullVS** puts both players up full screen; after it, the **victory splash** shows the winner and the final score. Drop a picture on a player to use it on the splashes.

| VS splash | Victory splash |
| --- | --- |
| ![FullVS with player pictures](docs/images/vs-intro.jpg) | ![The victory splash](docs/images/victory.jpg) |

### Layouts

One **Classic** layout for each game, each kept clear of its game's HUD (health bars, portraits, round counters, timer and meters). Pick one from the **Layout** menu at the top of the app, or let it follow the game you pick. OBS switches by itself.

| Tekken 8 | Street Fighter 6 |
| --- | --- |
| ![Tekken 8 Classic](docs/images/layout-tekken8.jpg) | ![Street Fighter 6 Classic](docs/images/layout-sf6.jpg) |
| **Avatar Legends** | **Fatal Fury: City of the Wolves** |
| ![Avatar Legends Classic](docs/images/layout-avatar.jpg) | ![Fatal Fury Classic](docs/images/layout-fatalfury.jpg) |

### Your own layouts

![The Layouts tab with two imported layouts](docs/images/panel-layouts.jpg)

Got a layout from a creator, or made one yourself? Drop its `.zip`, its folder or its page on the **Layouts** tab. It goes in the **Layout** menu with the app's own and shows in OBS the same way. Each one can be previewed with the scoreboard as it is now, put on stream, shared as a `.zip`, or removed (a copy is kept).

Making one takes a web page and a few `data-sb` attributes: `<span data-sb="p1.name"></span>` shows player 1's name, and BeeboScore fills it in every time you press **Update**. **Download the starter layout** in the tab for a finished scoreboard with every part explained, and see [your own layouts](docs/guide/your-own-layouts.md) in the guide.

### Game formats

![The Format tab with a Team Death Battle set up](docs/images/panel-format.jpg)

Run an event on top of the scoreboard from the **Format** tab. The format decides who plays next; you score each set as usual and press **Confirm & next match**.

| Format | How it is won |
| --- | --- |
| **Crew Battle** | Winner stays on. A crew is out when every player has lost. |
| **Team Battle** (Sajam Slam style) | Players are paired by tier. First team to the target points wins. |
| **Gauntlet** | One player against a line of challengers. |
| **Team Death Battle** | Two teams, and every fighter has lives. After a life is lost, a team can switch fighters. Locked in too early? **Undo lock-in** opens the switch window again until the next set is recorded. |
| **Death Battle** | Everyone has lives. Lose a set, lose a life. The last one standing wins. |
| **King of the Hill** | Winner stays, loser goes to the back of the queue. |
| **League** | Everyone plays everyone. Standings by wins, then head-to-head. |

On Tekken 8's Classic a format bar runs along the bottom, and Team VS, Board and Champion splashes are one press away. The other three games run formats on their own layout with the same splashes.

![Team VS (top) and the Board (bottom) in a Team Death Battle](docs/images/team-splashes.jpg)

### start.gg brackets

![The Bracket tab](docs/images/panel-bracket.jpg)

Sign in on the **Bracket** tab, pick your event, and pull its players and matches onto the scoreboard. Put the bracket, **Top 8** or the standings on stream, share a live bracket page with viewers, and send results back to start.gg when a set ends.

| Winners side | Losers side | Top 8 |
| --- | --- | --- |
| ![Bracket splash, winners side](docs/images/bracket-winners.jpg) | ![Bracket splash, losers side](docs/images/bracket-losers.jpg) | ![Top 8 splash](docs/images/top8.jpg) |

### Stream

![The Stream tab](docs/images/panel-stream.jpg)

Copy the OBS link, or press **Go online** for a public overlay link and a password-protected remote control you can open on a phone. It uses a free Cloudflare tunnel; you can also use your own Cloudflare address that stays the same. **Remote control & security** lists the signed-in devices and has **Sign out all devices**.

<img src="docs/images/panel-mobile.jpg" width="300" alt="The control panel on a phone">

**Pop out** under the live preview opens it in a window of its own.

![The popped-out live preview](docs/images/preview-popout.jpg)

### Stream Deck

The plugin comes inside the app: **Settings → Stream Deck → Install**. Then press **Set up Stream Deck** and the whole deck is filled for you: the match along the top, what's on stream next, and a row that follows the app (next match and Winners / Losers side in 1v1, the format's keys when a format starts). It works on the 15-key Stream Deck and the Stream Deck XL; any other deck can use **BeeboScore key (follows the app)**. Needs Stream Deck 6.4 or newer.

### Settings

![Settings](docs/images/panel-settings.jpg)

Look & feel, performance, scoreboard options, the OBS connection, Stream Deck, keyboard shortcuts, backups, the health check and self-test, your own theme, accessibility and output size (up to 4K). The control panel comes in nine looks, including High contrast and your own theme. Six of them:

![The six control panel looks: Classic, Hive, Circuit, Glacier, Ink Dojo and Street](docs/images/panel-themes.jpg)

### Check for updates

**Settings → Updates & about → Check for updates.** The app only looks when you press it. If there is a new version, it saves the new exe next to the one you're running, and **Restart & update** switches over to it; the app opens again by itself in 10 to 20 seconds. Your `BeeboScore Lite Data` folder is used by both versions, so nothing is lost, and the old exe goes to the Recycle Bin.

The first time a new version starts, a **What's new** card lists what changed.

---

## Your data stays on your PC

- start.gg sign-ins and tokens are stored encrypted on your PC and are only ever sent to start.gg.
- The OBS WebSocket password is only used by the app on the PC running it. It is never shown to phones or other PCs, and it is left out of backups.
- Player pictures are processed on your PC.
- The app has no analytics or tracking.

---

## Good to know

- **Windows 10 or 11, 64-bit.**
- The app uses port **3300**. If something else is using it, the app picks the next free port and shows it under **Help**; use that number in the OBS link.
- Keep the app open while you stream. OBS shows the overlay from it.
- The layouts make no sound of their own.
- The overlay looks blank in OBS? Check that the app is running and that the Browser source URL matches the one on the **Stream** tab.

The full guide is in **[docs/GUIDE.md](docs/GUIDE.md)**.

---

## Build it yourself

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start          # run the desktop app from source
npm run server     # or just the server: open http://localhost:3000
npm run dist       # build dist/BeeboScore-<version>.exe
npm test           # unit tests
```

More in [docs/guide/building.md](docs/guide/building.md). Publishing a release is in [docs/RELEASING.md](docs/RELEASING.md), and changes are listed in [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE) © 2026 Beebo. The bundled fonts are under the SIL Open Font License or the Apache License 2.0; see [`public/fonts/FONTS-LICENSES.txt`](public/fonts/FONTS-LICENSES.txt).

Found a bug? [Open an issue](https://github.com/t1fgc/beeboscore/issues).
