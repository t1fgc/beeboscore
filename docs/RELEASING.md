# Publishing a release on GitHub

**Settings → Check for updates** in BeeboScore reads this repository's releases, so three things have to be right for people to be offered an update:

1. The repository is **public**.
2. The release is **published**: not a draft, and not marked as a pre-release.
3. The exe attached to it is named exactly **`BeeboScore-<version>.exe`** (with a copy named `BeeboScore-Lite-<version>.exe`; the workflow adds it), for example `BeeboScore-1.5.1.exe`. The version is read from this file name, not from the tag.

Other files in a release are ignored, so release notes, checksums or other downloads can sit beside the exe.

### Older copies (1.4.0 and BeeboScore Lite 1.5.0)

Those copies look for **`BeeboScore-<version>.exe`**, the release exe's own name since 1.5.2, so they find every new release by themselves. Copies of 1.5.0 (then called BeeboScore Lite) only look for **`BeeboScore-Lite-<version>.exe`**, so the workflow attaches the same exe under that name too. Keep both files in every release.

## Each release

1. Set the new version: `npm version 1.5.1 --no-git-tag-version`
2. Add a `## 1.5.1` section to the top of `CHANGELOG.md`. Its first `###` heading and the `- ` lines under it are the **What's new** card people see the first time the new version starts, so keep that part short. Add `docs/release-notes/1.5.1.md` too (copy the last one): it becomes the text of the release.
3. Commit, then tag and push:

   ```bash
   git add -A
   git commit -m "BeeboScore 1.5.1"
   git tag v1.5.1
   git push origin main --tags
   ```

4. Pushing the tag starts the **Build release draft** workflow (the **Actions** tab). It runs the tests, builds the exe and makes a **draft** release with `BeeboScore-1.5.1.exe` attached and the release notes filled in. It stops if the tag doesn't match the version in `package.json`.

   You can also build it yourself with `npm run dist` and attach `dist/BeeboScore-1.5.1.exe` to a release you make on the Releases page.
5. If you sign your builds: download the exe from the draft, sign it, and upload the signed file in its place under the same name.
6. Open **Releases**, open the draft, and press **Publish release**. From that moment, Check for updates in older copies finds it.

## Checking it worked

Open an older copy of the app, go to **Settings → Updates & about**, and press **Check for updates**. It should say the new version is available, download it next to the old exe, and restart into it.

After **Restart & update** the window closes, the starting screen shows, and the new version opens with **What's new**. The whole thing takes 10 to 20 seconds. The old exe goes to the Recycle Bin.

### Trying Restart & update without publishing anything

Put a newer exe in the same folder as the one you are running (for example `BeeboScore-1.5.1.exe` next to `BeeboScore-1.5.0.exe`), open the older one, and press **Check for updates**. It offers **Restart & update** into the newer exe straight away.

If the new version does not come up, look at `BeeboScore Lite Data\update.log`. A good update ends with the old version *closing so* the new one *can take over*, then the new version *started by Restart & update*, *started on port 3300* and *window shown*. If the last line is the old version's, the new exe never got as far as starting.

If it says no releases have been published yet, check the three points at the top of this page.
