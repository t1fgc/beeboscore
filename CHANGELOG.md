# Changelog

## 1.1.8

### Fixed

- **Restart & update opens the new version.** On some PCs the app closed and the new version never opened. The hand-over used a hidden PowerShell window to wait for the old copy and then start the new exe, and that step did not run everywhere. The new exe is now started directly, the way a double-click starts it, and the old copy closes once it has started. This takes effect when updating *from* 1.1.8: the update *to* 1.1.8 is still carried out by the older version.
- Each version now unpacks into a temp folder of its own (`BeeboScore-<version>`), so the new copy can start while the old one is still closing without the two touching each other's files. `tools/set-unpack-dir.js` sets the name before every build.

### New

- **A newer version already in the folder.** If a newer `BeeboScore-x.y.z.exe` is sitting next to the one you are running, **Check for updates** offers **Restart & update** into it without downloading anything. It is also used when the releases cannot be reached.

## 1.1.7

### Fixed

- **The window comes back after an update.** A window opened by Restart & update is not opened by a click, so Windows could put it behind whatever was in front and only flash its taskbar button. The app now brings its window to the front when it starts.
- The hand-over waits a little longer (1.5 seconds) after the old copy closes before starting the new exe.

### Changed

- **Stream Deck: the VS Splash key is now named "Show / hide VS Splash"** (plugin 1.1.1), so it sits next to "Show / hide overlay" in the Stream Deck app's list and is easier to find. It works as before: one press shows the splash, the next hides it, and the key lights up while the splash is on stream.

### New

- **`update.log`** in the `BeeboScore Data` folder: one line each time the app starts, shows its window, or hands over to a new version (the last 40 lines are kept). Nothing in it leaves your PC.

## 1.1.6

### Fixed

- **Wording.** Typos, punctuation and a few unclear sentences in the app, the README and the guides. "Victory Splash" is written the same way everywhere.

## 1.1.5

### Improved

- **A starting screen.** A small "BeeboScore: starting up" picture shows while the portable exe unpacks itself, from the moment it is started until the app's window opens. After **Restart & update** it takes the place of several seconds with nothing on screen.
- **Restart & update says what it is doing.** Before the window closes, the app shows "Installing BeeboScore x.y.z", says it will open again by itself, and says what to do if it does not.
- **A safer hand-over.** The new exe is not started until the old copy and its launcher have both finished closing, so the old copy's clean-up can no longer overlap with the new copy unpacking.
- **What's new** lists the notes of every version you skipped, not only the newest. The button in Settings shows them all.

## 1.1.4

### New

- **Ten new layouts**, 11 in all: Ember, Frostbite, Venom, Royal, Crimson, Gold Rush, Sakura, Tidal, Voltage, Chrome and Pastel. Each has its own bar shape, lettering, effects and animations (intro, a game taken, match point, winner, loser), its own VS Splash and its own Victory Splash. All of them sit where Ember does, so they fit the same games. Pick one from the Layout menu.
- **Readable scores in every layout.** The score is in a solid box with at least 7:1 contrast, 30 px or larger, and stays that way for the player who lost.
- **Clear of the game's HUD.** The ten new layouts never draw over the health bars, round counters, timer or portraits: shapes end at the bar's bottom edge, glows are clipped there, and ambient effects stay inside the bar. The burst when a game or a set is won is the only thing that goes past it, for at most 1.25 seconds. A score of two digits is fitted to its box, and the SET label is hidden when a set is too long for pips.
- **Your own VS Splash pictures** (Matches tab, VS Splash card): a name bar behind each player's name (best size 920 × 250) and a header across the top (1920 × 200). They show in every layout. PNG, WebP or JPG; other sizes are scaled and cropped to fit.
- **Lettering matched to a custom name bar.** The app looks at the picture where the names sit and picks light or dark names, a tint of the picture's colour for the team tag and record, and a soft backing when the picture is busy. Pick my own swaps these for two colour pickers and warns when the colours are hard to read. Preview the VS Splash plays the result in the card.
- **Splash pictures** (start.gg tab). For each player, choose what the VS Splash and Victory Splash show: their start.gg profile picture in the small frame, or a character image you upload, shown as a large panel. Best size 900 × 1080; PNG, WebP or JPG.
- **Crop and green screen.** After you choose a character image, a window opens where you can crop it to the panel and remove a green-screen (or blue-screen) background before it is saved. The result is a PNG with a see-through background, sized to fit the panel.
- **Find a player** in Splash pictures completes names as you type. The card now shows only the two players on the scoreboard, the player you looked up, and a short, collapsed list of players who already have a character image, so it stays short for an event of any size.
- **VS Splash button** on the Matches tab, with each player's bracket record. Ctrl + I also toggles it.
- **Victory Splash** shows the winner's character image as a large panel when they use one.
- **Stream Deck: VS Splash key** (plugin 1.1.0).
- **What's new window.** Opens once the first time a new version starts and lists what changed. Settings has a button to open it again.

### Changed

- **Shattered is now called Ember.** It is the same layout, first in the Layout menu.
- Ember's Victory Splash no longer has crack lines behind "Victory".

### Easier to read (Ember)

- When a set ends, the loser's score box stays solid and the name keeps most of its light, so the final score no longer disappears behind the cracks.
- The winner's name, team and "Victory" have a dark edge and a soft shadow, and the lit plate has a little less glare.
- The status line, the event line, SET and 1P / 2P are a size larger and brighter. "On the edge" is no longer a dark red.
- The light that runs round each plate turns gold on the winner's and dims on the loser's.
- VS Splash: the 1P / 2P marks and "This bracket" are larger.

### Fixed

- VS Splash: names are centred under a character image, the last letter of a slanted name is no longer cut off, a short name keeps its size next to a very long one, and a team tag no longer touches the top of the name plate.
- Very long event and opponent names are shortened with "…" on the scoreboard and the Victory Splash, so they no longer run into other text.
- The saved-layout list in the Overlay maker now refreshes before "Saved" is shown.

## 1.0.0

The first public build of BeeboScore. It is a prototype: a fuller build is planned for later in 2026.

### What's in it

- **Matches:** names, scores, round, format and event, with Swap, Reset, Undo and a losers [L] mark.
- **Shattered:** the one built-in layout, for every fighting game.
- **Overlay maker:** drop in a static PNG overlay and get an animated layout. The picture is cut into shapes with their own intro, glow, shine and edge light, in one of five looks (Ember, Steel, Neon, Pop, Clean) picked from its colours. Text spots are placed for you and can be dragged and resized over a live preview. Made layouts can be edited and deleted.
- **Layout menu** in the header, for switching between Shattered and layouts you've made.
- **start.gg:** sign in, load an event, pull players and matches, send results back.
- **Stream:** the OBS link, and Go online for a public overlay link and a remote control.
- **Stream Deck plugin** (1.0.0), built in: eleven keys, including Switch layout.
- **Settings → Check for updates:** looks for a newer version only when you ask, downloads the new exe next to the current one and restarts into it.
- **Prototype notice** at the top of the app, listing what the next build will bring. It can be collapsed and stays collapsed.

### If you used an earlier test build named "Beeboscoreboard"

This build has a new name, a new settings folder (`BeeboScore Data`, next to the exe) and a new Stream Deck plugin, so it starts fresh:

- Settings and start.gg sign-ins are not carried over.
- To keep layouts you made, copy their folders from `Beeboscoreboard Data\overlays` into `BeeboScore Data\overlays`.
- In the Stream Deck app, remove the old Beeboscoreboard plugin, install the new one from **File → Install Stream Deck Plugin**, and add your keys again.
