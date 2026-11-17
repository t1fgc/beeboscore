# Cloud hosting — a permanent online scoreboard

Hosting the scoreboard on a server gives you a fixed address (for example `https://my-scoreboard.onrender.com`) that works 24/7 without your PC:

- **Overlay for OBS:** `https://YOUR-ADDRESS/overlay` — public, no password, works in any OBS anywhere.
- **Control panel:** `https://YOUR-ADDRESS/` — asks for your `ADMIN_PASSWORD`, works on any phone or PC.

Everything else (overlay editor, uploads, start.gg, autocomplete) works the same as the desktop app.

## What the server needs

- **Node.js 18+** (or Docker — a `Dockerfile` is included). No `npm install` needed.
- Environment variables:
  - `ADMIN_PASSWORD` — **required**. Password for the control panel.
  - `DATA_DIR` — where overlays and settings are saved (the Dockerfile uses `/data`). Point it at a **persistent disk**, otherwise uploads and settings reset when the server restarts.
  - `PORT` — set automatically by most hosts.
- An **always-on** plan. Free plans usually go to sleep when idle, which would make your overlay disappear mid-stream.

## Option A — Render (easiest)

1. Put this folder in a GitHub repository (GitHub → New repository → upload the files).
2. On render.com: **New → Blueprint** → pick the repository. Render reads `render.yaml`.
3. Enter an `ADMIN_PASSWORD` when asked and create the service. The blueprint adds a 1 GB disk at `/data`.
4. When it's live, open `https://<your-service>.onrender.com/` and sign in.

## Option B — any Docker host (Railway, Fly.io, a VPS…)

```bash
docker build -t beeboscore .
docker run -d -p 3000:3000 -e ADMIN_PASSWORD='choose-a-strong-one' -v beeboscore-data:/data --restart unless-stopped beeboscore
```

Put it behind HTTPS (most hosts do this for you). On a plain VPS, a reverse proxy like Caddy or nginx handles that.

## Option C — plain Node

```bash
ADMIN_PASSWORD='choose-a-strong-one' DATA_DIR=/var/lib/beeboscore PORT=3000 node server.js
```

## Notes

- With `ADMIN_PASSWORD` set, **every** visitor must sign in to the control panel. Overlays (`/overlay`, `/o/...`) stay public so OBS can load them.
- Change the password by changing `ADMIN_PASSWORD` and restarting; that signs everyone out.
- Realtime updates use WebSockets and fall back to polling automatically if a proxy blocks them.
- Your start.gg token is saved on the server's disk in `DATA_DIR/data/config.json`. Use a token you can revoke from start.gg's Developer Settings if needed.
