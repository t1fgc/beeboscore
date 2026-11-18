# Troubleshooting

[← BeeboScore guide](../GUIDE.md)

## Troubleshooting

- **Overlay blank in OBS:** check the app is running and the URL/port match (Help menu shows the port; it moves to 3301 and up if 3300 is busy).
- **A layout looks stuck mid-animation:** reset the scores (with **Refresh OBS on reset** on) or press Update. The overlay swaps in a clean copy.
- **Custom shortcut doesn't work:** single keys are ignored while you're typing in a box; click an empty area first, or use a combination with `Ctrl`/`Alt`.
- **Bracket out of date:** press **Refresh now** (or the Stream Deck *Get results* key). start.gg can take a few seconds to show a reported set.
- **Stream Deck says "Update Stream Deck first":** install the latest Stream Deck app from Elgato, then BeeboScore installs the plugin by itself.
- **start.gg "token rejected":** make a new token in Developer Settings. **"Tournament not found":** the tournament must be published/public.
- **Country flags** are built into BeeboScore, so they show even with no internet. Player pictures from start.gg load the first time, then BeeboScore keeps a copy, so they still show if the internet drops. A picture that can't load is simply hidden.
- Every value is also written as `.txt` files (File → Open Text Output Folder) if you prefer OBS Text sources. After a set is won, `winner.txt`, `winner_team.txt`, `loser.txt` and `final_score.txt` (like `2 - 1`) are filled in too.
- **Effects pause by themselves** while the browser source is hidden in OBS, and the scoreboard rests underneath full-screen splashes. If your PC struggles, BeeboScore uses fewer particles automatically.

- **Restart & update closed the app and it didn't come back:** start the newest `BeeboScore-x.y.z.exe` in the folder yourself. Then look at **update.log** in the `BeeboScore Lite Data` folder. A good update ends with the old version *closing so* the new one *can take over*, then the new version *started by Restart & update*, *started on port …* and *window shown*. If the last line is the old version's, the new exe never got as far as starting.
- **A layout you had is gone from the Layout menu after updating to 1.5.3:** only the app's own layouts (Classic and Obsidian Glass) and the ones you imported on the Layouts tab are listed. Old layouts from earlier builds were moved to `data\retired-layouts` in your data folder; drop one on the **Layouts** tab to bring it back.
- **Moved from 1.4.0 and start.gg says you're signed out:** that's expected. Sign in again on the Bracket tab.
- **Moved from 1.4.0 and your players aren't there:** the copy only happens if `BeeboScore Data` sits next to the exe, in the same folder. Put `BeeboScore-x.y.z.exe` beside it and start it before any newer copy has saved data there.

---

[Install & OBS](install-and-obs.md) · [Running matches](matches.md) · [Game formats](formats.md) · [start.gg brackets](brackets.md) · [Layouts](layouts.md) · [Stream Deck](stream-deck.md) · [Going online](online.md) · [Settings](settings.md) · [Building](building.md) · [Troubleshooting](troubleshooting.md)
