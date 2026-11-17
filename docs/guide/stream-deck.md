# Stream Deck

[← BeeboScore Lite guide](../GUIDE.md)

## The plugin

The Stream Deck plugin is **bundled inside BeeboScore Lite**. You don't download it separately.

- **Settings › Stream Deck** shows your Stream Deck app version and the plugin's status: **Install**, **Update** or **Up to date**.
- It's its own plugin, **BeeboScore Lite** (`com.t1fgc.beeboscore.lite`), so it can sit beside the full BeeboScore's plugin without either replacing the other.
- The plugin finds BeeboScore Lite on this PC by itself (port 3300 for the exe, 3200 when it runs from source or is installed). A different address can be set in each key's settings.
- Coming from BeeboScore 1.4.0: install this plugin, press **Set up Stream Deck**, then remove the old *BeeboScore Prototype* plugin in Stream Deck.
- If your Stream Deck app is older than the plugin needs (**6.4**), the app tells you to update Stream Deck first.

## Set up Stream Deck

**Settings › Stream Deck › Set up Stream Deck** puts every key on your deck for you. The first time, Stream Deck asks to add the *BeeboScore Lite* profile: click **Add**. After that the deck looks after itself:

- **Stream Deck XL (32 keys)** — one row per job:
  - **Row 1, the match:** both player names, both scores (tap +1, hold −1), Swap, **Undo**, **Reset** (tap: 0–0; hold: the next set) and Refresh OBS.
  - **Row 2, on stream:** **FullVS**, **GlassVS**, Victory, Bracket, Top 8, Standings, VS style and **Hide all**.
  - **Row 3 follows the app.** In 1v1: next match, report to start.gg, Winners / Losers side, [L] for each player, next set and effects quality. When a format starts it becomes that format's keys.
  - **Row 4, the set:** moment banners, replay the moment, the head-to-head line, the set timer, the stats strip, the bracket reset splash and both stats cards.
- **Stream Deck (15 keys):** row 1 the match (scores, Swap, Undo, Reset), row 2 VS, Victory, Bracket, Hide all and Refresh OBS, row 3 the format's keys (or next match, Top 8, standings, report and W/L side in 1v1).
- **Any other deck:** drag **BeeboScore Lite key (follows the app)** onto the keys you want. Each one picks its job from where it sits.
- **Everything, in pages** (Settings › Stream Deck): nothing moves when a format starts; the **▸** key turns the page.

## The keys

| Group | Keys |
|---|---|
| **Match** | Player names · scores · Swap · Undo · Reset · Next set · Loser [L] marks · FullVS · GlassVS · VS style · Victory · moments · replay the moment · head-to-head · set timer · stats strip · bracket reset splash |
| **Stream** | Refresh OBS · Effects quality · Hide all splashes · Stats card |
| **start.gg** | Next match · Bracket · Top 8 · Standings · Winners / Losers side · Report to start.gg |
| **Formats** | Next fight · Undo a result · Format splashes · Format bar · Switch in · Lock in · Unlock |

---

[Install & OBS](install-and-obs.md) · [Running matches](matches.md) · [Game formats](formats.md) · [start.gg brackets](brackets.md) · [Layouts](layouts.md) · [Stream Deck](stream-deck.md) · [Going online](online.md) · [Settings](settings.md) · [Building](building.md) · [Troubleshooting](troubleshooting.md)
