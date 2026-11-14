# Changelog

## 1.4.0

Everything since 1.1.8, the last release on GitHub. 1.2.0 to 1.3.9 were test builds; their changes are all listed here.

### New

- **Game formats.** A new **Formats** tab runs seven kinds of event on top of the scoreboard: **Crew Battle** (winner stays on), **Team Battle** (Sajam Slam style, players paired by tier), **Gauntlet** (one player against a line of challengers), **Team Death Battle**, **Death Battle** (everyone has lives, last one standing wins), **King of the Hill** (winner stays, loser to the back of the queue) and **League** (everyone plays everyone). The format decides who plays next; each set is scored as usual and confirmed with **Confirm & next match** (Ctrl+Alt+Enter; Ctrl+Alt+Z undoes). Rosters can be typed, pasted as a list, taken from the start.gg event, saved and loaded, and results export as CSV. See [docs/FORMATS.md](docs/FORMATS.md).
- **Team Death Battle.** Two teams; every fighter has 1 to 9 lives, and one life can be worth 1 to 5 lost sets (the first lost set cracks the crest, the last breaks it). After a life is lost a switch window opens (both teams, only the team that lost it, or nobody); **Lock in** closes it, and it also closes by itself on the first point of the next set (not when that point already wins a first-to-1 set: confirming closes it then, so the lock-in never lands on the K.O.). A fighter who is switched out keeps their lives and any crack for when they come back. A fighter can be given extra lives from the Formats tab.
- **Formats on stream, on both layouts.** Life crests, crowns, tiers and table position on the player bars; a format bar along the bottom with a piece or card per player; Board, Team VS and Champion splashes; the format's own VS Splash; and moments that play by themselves when a result is confirmed (a cracked life, −1 LIFE, SWITCH IN, the K.O. slash and K.O. card, eliminations with their placement, NEXT CHALLENGER, LAST STAND, TIEBREAKER, FINAL DUEL, NEW KING). The overlay picks the format up by itself: nothing changes in OBS.
- **Matches tab console.** A **Format** menu at the top of Players, and a console above it with the matchup, Confirm & next match, Forfeit, Undo, the On stream buttons and, for Team Death Battle, the switch window with each fighter's lives and **Lock in**. The tab takes the format's colour.
- **Lock-in splash** (Crew Battle, Team Battle, Gauntlet, Team Death Battle). When both players are locked in, two halves of glass slide in from opposite sides, one per player: their picture (or a big letter of their name), team, name, and their lives, tier and points, or place in the line. They meet in the middle, a white line flashes where they touch and softens into both teams' colours as they meld, and a light runs down the join. About 4 seconds. It waits for moments already playing and never comes up over another splash.
- **Porcelain**, a new built-in layout: Ember glazed white, with dark lettering and ember-orange fire. When a set ends the loser's bar shatters round the score and is knocked out of shape, with nothing reaching down onto the health bars. Its own white VS Splash, Victory Splash and format pieces. The Overlay maker's **Set winner** menu offers its splash.
- **Player pictures in formats.** Drop a picture on a player in the Formats tab (or click 📷); **⊘** removes it. Any picture the browser can open, up to 60 MB. A picture bigger than 1.5 MB or 900 px opens a crop window first (the cards' upright 5:6 shape); what you keep is made smaller on the PC (at most 900 px, WebP, see-through parts kept). The same picture is the player's card on the team bar, their side of the format's VS Splash and their side of the lock-in splash, scaled to the full height there so a face is never cut off.
- **Pictures and names together** on Team Death Battle's team bar: a fighter with a picture shows it with the name across the top; a fighter without one shows their name over a big letter of it in the team's colour, on a card the same size, so both sit side by side.
- **Set up my Stream Deck** (Settings › Stream Deck). One press fills the whole deck: one layout for the 15-key Stream Deck, one for the 32-key Stream Deck XL. On Windows it adds a **BeeboScore Prototype** page to the profile each deck is showing: Stream Deck closes for a few seconds, the page is written, and Stream Deck comes back with it (the deck's other pages stay; a backup of each profile goes in `BeeboScore Data/data/streamdeck-backups`, the last 10). Decks of other sizes are listed so their keys can be dragged in by hand. On macOS, Stream Deck offers the plugin's ready-made profiles. If the plugin is missing or out of date, it is installed first.
- **Format keys** on the Stream Deck: each one knows its place on the deck and becomes what that place is for in the running format (Confirm & next match, Board, Format bar, Lock in, Switch fighter, hold to forfeit), drawn in the format's colour, the same as the Matches tab. With no format they are everyday keys.
- **Refresh OBS**, in the header and on the Stream Deck: reloads the overlay in OBS, cache and all. Through the OBS link the new page fades in over the old one, so there is no visible reload. The overlay also refreshes by itself at the start of a new match at 0–0 (not while a format is running).
- **Settings › Scoreboard**: Refresh OBS on reset; **Victory Splash when a set ends** (off: it only shows when you ask for it) and how long it stays up; **Lock-in splash in team formats**.
- **Glass on the team bar.** The middle block of the format bar is the same plate glass as the player bars, with an ember glow, a slow sheen, and lights running along its top and bottom edges. No cracks.

### Changed

- **No more prototype notice.** The *Prototype build* box at the top of the app is gone, with the README's "What's coming" section.
- **Two layouts: Ember and Porcelain.** The ten elemental layouts (Frostbite, Venom, Royal, Crimson, Gold Rush, Sakura, Tidal, Voltage, Chrome, Pastel) are out of this build, to be reworked and brought back later. An unedited copy in `BeeboScore Data` is removed; an edited copy can no longer draw, so it is moved to `BeeboScore Data/data/retired-layouts`. If one was the live layout, the app switches to Ember.
- **Ember's top area** (and Porcelain's): the middle tag is shorter, so it clears the game's timer, and each player bar covers everything round the three round-win circles, with a hole and a lit rim for each circle. The bars' bottom corners are bevelled: 18 px on the outside, a small 7 px cut by the circles so the last circle keeps its full rim.
- **The Stream Deck plugin is now called "BeeboScore Prototype"** (`com.t1fgc.beeboproto`), so it sits next to the BeeboScore plugin of the other build without replacing it. Install it from **Settings › Stream Deck**; the old *BeeboScore* plugin from 1.1.8 can then be removed in Stream Deck. Its keys have new pictures, made to be read at a glance: each kind of key has its own background colour, one large picture, and one or two words in a big plain face; a splash that is on stream turns its key bright and says *On air*.
- **Sorted Stream Deck layouts.** The match on top (both scores at the ends, Undo, Reset, Swap), the keys that change with the format in the middle, and what is on stream at the bottom (Overlay, VS, Victory, Hide all, Refresh). On the XL the bottom row is left free for your own keys. Fewer keys, each doing more: *Undo* takes back a format result when that was the last thing that happened; *Reset* is 0–0 on a tap and a new set on a hold; *VS* is the Team VS splash in a team format and *Victory* the Champion splash once a format is won; hold a score key to take a point back (the −1 keys are gone).
- **Seamless Reset and Clear.** The overlay still refreshes on a reset to 0–0, but the page on screen first plays its own way back (the loser's bar closes up, the winner's gold fades), then the fresh copy fades in over it.
- **The fighter playing stands out.** Their card on the team bar is bigger and lifted a little above the others; in the other team formats their piece is taller. The bar makes room for it, so nothing runs into the middle block.
- **A new switch** (Team Death Battle): the fighter going out steps down and dims, a streak of the team's colour runs along the foot of the cards to the one coming in, who rises into place, and the new name wipes in. A different fighter's crests come in one by one.
- **Last life has its own look.** A heartbeat line is drawn across the fighter's player bar and card the moment they go down to their last life; from then on a faint heartbeat runs along the foot, and the card's edge and the last crest beat with it. Team Death Battle and Death Battle.
- **Smoother name changes in a format.** Names wipe in out of a soft blur instead of scrambling. Names sit in the middle of every piece and card on the format bar.
- **The format bar is updated piece by piece**, so a piece that changes eases over and running glints carry on. A lost crest swells and bursts before the empty one fades in.
- **Crowded format bars** fit: with five or more a side (or a long Gauntlet line) each side shares its width in equal, narrower pieces with one name size per side, and what still doesn't fit folds into a "+N" piece (who is playing, who is next, the team, the king and the leader always stay).
- **No character box** in the Formats tab's player lists; a character saved on a player's profile is still used on the cards.
- Layout names, round names and events are fitted to the fraction of a pixel.

### Fixed

- **Fighters vanishing from the format bar** in Death Battle and King of the Hill after a piece changed sides.
- **Lives after a switch:** a fighter with extra lives showed only the format's number of crests; every fighter now shows their own.
- **Moments and splashes no longer overlap.** Confirming a set while the Victory Splash is up takes it down first and plays the result once it has gone; every splash clears what is left of the last moment before it opens; the Champion splash waits for the last K.O. to play out; a stamp never sits on a splash that opens straight after it.
- **The format's VS Splash:** the big faded names fit on their own side instead of running into each other, and the light line breaks around the title, the score and the row along the foot.
- **Lost moments after a refresh.** After the first Reset the overlay stopped playing format moments (a lost life, a K.O.); they play every time now.
- **Board splash with a long team** ran off the bottom of the screen, and **the Gauntlet ladder** off the side; both fit now.
- After a knock-out the player bar could keep the knocked-out fighter's name; the **Champion splash** before the end of King of the Hill or Death Battle showed an empty name; names on knocked-out pieces were cut to a letter or two. All fixed.
- Names that had to be made smaller could still end in "…" by half a pixel; they are measured exactly now.

### Faster

- The layouts' glint, the comet line round the frame, the format bar's glints, the playing card's lift, the last-life glow and the heartbeat now move with transforms and fades instead of being repainted every frame: about half the work per second in OBS, even with the new team bar glass. Porcelain's broken bar draws its shadows as plain shapes (60 fps where it used to drop to about 20 in a software-rendered test).

### For developers

- `lib/format.js` is the format engine (no I/O, no dependencies); `npm test` runs its unit tests (`tests/engine.test.mjs`).
- One layout page serves every format: while a format is set up the app adds `<meta name="sb-format">` to the page it serves and loads `el/formats.js`, `beebo-icons.js` and `sb-format.js`.
- `lib/sdlayout.js` writes the Stream Deck page into `%APPDATA%\Elgato\StreamDeck\ProfilesV3` (it reads which profile each deck shows from the registry). `streamdeck/src/keys.js` draws the key pictures; `streamdeck/src/decks.js` holds both deck layouts.
- `public/el/`, `tools/make-elemental-layouts.js` and the fonts only the elemental layouts used are removed. `public/prototype-note.js` is removed; `tools/make-lite-panel.py` takes the old notice out of a panel that still has it.

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
