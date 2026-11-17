# Install & OBS

[← BeeboScore Lite guide](../GUIDE.md)

## Install

**Windows:** download **`BeeboScore-Lite-<version>.exe`** from the [latest release](https://github.com/t1fgc/beeboscore/releases/latest), put it in a folder of its own and run it. Nothing is installed. It keeps everything it saves in a **BeeboScore Lite Data** folder next to the exe and runs on port **3300**. To move it to another PC, move the exe and that folder together.

Windows may show **"Windows protected your PC"** the first time: click **More info**, then **Run anyway**.

**Starting up:** a portable exe unpacks itself when it opens. BeeboScore Lite keeps the unpacked copy in `%TEMP%` for each version, so only the first start of a new version takes longer.

### Coming from BeeboScore 1.4.0

Press **Settings → Check for updates** in 1.4.0, then **Restart & update**. On its first start BeeboScore Lite:

- waits for 1.4.0 to close and let go of port 3300;
- copies your players, player pictures, VS pictures, settings, the match, viewers and exports from **BeeboScore Data** into **BeeboScore Lite Data**. Backups, retired layouts and Stream Deck profile backups are not copied. The old folder is not changed, and the copy happens only once;
- opens the first-time setup, so you can pick your game's Classic layout;
- moves the old exe to the Recycle Bin.

Then **sign in to start.gg again** on the Bracket tab (sign-ins are locked to the app that saved them), and install the **BeeboScore Lite** Stream Deck plugin from **Settings › Stream Deck**. The old *BeeboScore Prototype* plugin can be removed in Stream Deck. The OBS link is the same as before.

**First launch:** a four-step setup opens — pick a look, add it to OBS (it tells you when OBS is showing it), pick start.gg if you use it. **Skip setup** if you know your way around; *Settings › Updates & about* runs it again.


**Mac / Linux:** install Node.js 18+ and either
- run the desktop app: `npm install` then `npm start`, or
- run it in your browser: `node server.js` (no install needed).

Running from source (`npm start`) keeps its data in **Documents › BeeboScore Lite** and uses port 3200. An installer build (`npm run dist:setup`) does the same, and doesn't update itself.


## Add the overlay to OBS

1. **Sources → + → Browser**
2. URL: `http://localhost:3300/overlay` (or **Copy OBS URL** under the live preview). **Refresh OBS**, next to it, reloads the overlay in OBS when you need to: every browser source showing BeeboScore swaps in a fresh, uncached copy, seamlessly. Nothing else in OBS is touched, and it doesn't need OBS's WebSocket.
3. Width `1920`, height `1080`. Leave "Refresh browser when scene becomes active" off.

That URL always shows the layout picked in the **Layout** dropdown at the top of the app. Change it (or pick a different **Game**; the layout follows automatically) and OBS switches by itself.

**Seamless refresh:** the overlay page double-buffers the layout. Switching layouts, saving an edit, or resetting the scores loads a fresh copy out of sight and swaps it in only once it's fully drawn, so OBS never shows a blank frame or a replayed intro. (If you style layouts with OBS's *Custom CSS* box, add `?direct` to the URL so the CSS reaches the layout itself.)

### Updates

**Settings › Updates & about › Check for updates.** The app only looks when you press it. If there is a newer **BeeboScore Lite**, it saves the new exe next to the one you're running (or uses one that's already in the folder), and **Restart & update** switches over to it: the window closes, the starting screen shows, and the new version opens by itself in 10 to 20 seconds. Both versions use the same **BeeboScore Lite Data** folder, and the old exe goes to the Recycle Bin. The first time a new version starts, a **What's new** card lists what changed.

### Frame rate

A browser source draws at OBS's frame rate. Leave **Use custom frame rate** off (or set it to your stream's): a source drawing 60 frames a second on a 30 fps stream does twice the work for nothing. One BeeboScore source showing `/overlay` is usually all you need — each browser source is a whole browser of its own. **Settings › Health › Refresh** checks this for you. The app's own window is held to 60 frames a second (Settings › Performance › App window frame rate).

### Instant replay

Plays the last moments again — a clutch round, a comeback — straight from OBS.

1. In OBS: **Settings › Output › Replay Buffer**, turn it on and set how many seconds it keeps (15–30 is plenty). Then **Start Replay Buffer** in the Controls dock (or have OBS start it with the stream).
2. In BeeboScore: **Settings › OBS connection** needs OBS's WebSocket address and password (the same as for *Check OBS*).
3. Press **🎬 Instant replay** under Settings › OBS connection.

OBS saves what it's kept; the clip plays in a scene of its own, **BeeboScore Replay** (made the first time, with your BeeboScore overlay on top, so the scoreboard stays on screen), with your layout's stinger covering the cut there and back. When the clip ends it goes back to the scene you were on. The clip stays in OBS's recordings folder. Only the app window on the streaming PC talks to OBS, and the password never leaves it.

---

[Install & OBS](install-and-obs.md) · [Running matches](matches.md) · [Game formats](formats.md) · [start.gg brackets](brackets.md) · [Layouts](layouts.md) · [Stream Deck](stream-deck.md) · [Going online](online.md) · [Settings](settings.md) · [Building](building.md) · [Troubleshooting](troubleshooting.md)
