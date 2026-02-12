---
description: Start the dev server and test the app
---

# Dev Server (Dockerized)

The app runs dockerized. **Never use `npm run dev` directly on the host.**

## Start Dev Server

There is a `compose.override.yml` in `/srv/apps/finansheet/` that:
- Mounts the real `.env` from `/srv/apps/finansheet/.env`
- Uses the host's `node_modules` (bind mount, not anonymous volume)
- Uses `./node_modules/.bin/vite --host` as the command

**You MUST include the override file when running docker compose.**

// turbo
1. Start the dev container with the override:
```bash
cd /srv/repos/finansheet && docker compose -f docker-compose.yml -f /srv/apps/finansheet/compose.override.yml up finansheet-dev -d --force-recreate
```

// turbo
2. Verify it started correctly (should show "VITE ready"):
```bash
cd /srv/repos/finansheet && docker compose -f docker-compose.yml -f /srv/apps/finansheet/compose.override.yml logs finansheet-dev --tail 15
```

## Access URLs

| Method | URL |
|--------|-----|
| Tailscale (user's primary) | `https://mini-lab.tail4b2f89.ts.net:8444/` |
| LAN | `https://finansheet.dev.lab` |
| Direct container | `http://localhost:5175/` |

## Architecture

```
Caddy (:8444 HTTPS) → Docker finansheet-dev (:5175 host → :5173 container) → Vite HMR
```

- **Dev container**: `finansheet-dev` (node:20-alpine, hot reload via volume mount)
- **Prod container**: `finansheet-app` (Nginx, port 3001)
- Caddy handles HTTPS termination and routing
- **Secrets**: Live in `/srv/apps/finansheet/.env` (NOT in the repo `.env`)

## Troubleshooting

- **"Supabase not configured"**: You forgot the `-f /srv/apps/finansheet/compose.override.yml` flag. The repo's `.env` is empty; the real secrets are in `/srv/apps/finansheet/.env`.
- If `.vite/deps` has permission issues on the host, ignore — it works fine inside the container.
- Never modify `node_modules/.vite/` on the host.

## Type Check (runs on host, not in container)
// turbo
```bash
cd /srv/repos/finansheet && npx tsc --noEmit
```
