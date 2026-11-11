# Changelog

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
