# Publishing a release on GitHub

The app's **Settings → Check for updates** reads this repository's releases, so three things have to be right for people to be offered an update:

1. The repository is **public**.
2. The release is **published** — not a draft, and not marked as a pre-release.
3. The exe attached to it is named exactly **`BeeboScore-<version>.exe`**, for example `BeeboScore-1.1.0.exe`. The version is read from this file name, not from the tag.

Other files in a release are ignored, so release notes, checksums or other downloads can sit beside the exe.

## First time: put the code on GitHub

From the project folder:

```bash
git init
git add .
git commit -m "BeeboScore 1.0.0"
git branch -M main
git remote add origin https://github.com/t1fgc/beeboscore.git
git push -u origin main
```

If the repository already has files in it, clone it first and copy this project's files into the clone instead.

`.gitignore` already leaves out `node_modules`, build output, the app's data folders and `startgg-oauth.json`. Before the first push, run `git status` and check that no data folder or secret is listed.

## Each release

1. Set the new version: `npm version 1.1.0 --no-git-tag-version`
2. Add a section to `CHANGELOG.md`, and a `docs/release-notes/1.1.0.md` (copy the last one).
3. Commit, then tag and push:
   ```bash
   git commit -am "BeeboScore 1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```
4. Get the exe, one of two ways:
   - **GitHub builds it.** Pushing the tag starts the *Build release draft* workflow (`.github/workflows/release.yml`). When it finishes there is a **draft** release with `BeeboScore-1.1.0.exe` attached and the release notes filled in.
   - **You build it.** Run `npm run dist` and create the release yourself on the Releases page, attaching `dist/BeeboScore-1.1.0.exe`.
5. If you sign your builds: download the exe from the draft, sign it, and upload the signed file in its place under the same name.
6. Add the file's SHA-256 to the release notes (PowerShell: `Get-FileHash .\BeeboScore-1.1.0.exe`).
7. Press **Publish release**. From that moment, "Check for updates" in older copies finds it.

## Checking it worked

Open an older copy of the app, go to **Settings**, and press **Check for updates**. It should say the new version is available, download it next to the old exe, and restart into it.

If it says "No releases have been published yet", check the three points at the top of this page.

## Notes

- The update check uses GitHub's public API without signing in, which allows about 60 checks an hour from one internet address. That is far more than the button needs.
- The app never shows the repository's address. It is set in one place: `RELEASES` in `lib/portable-update.js`. Change it there if the repository ever moves.
- The download is checked against the size and SHA-256 that GitHub publishes for the file, so replace a file by deleting it from the release and uploading the new one — don't edit a published release's exe after people have started updating.
