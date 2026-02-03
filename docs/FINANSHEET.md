# FinanSheet - Project Documentation

## Quick Start

### Development
```bash
# Start dev server (hot reload)
/srv/scripts/dc finansheet up -d finansheet-dev

# View logs
/srv/scripts/dc finansheet logs -f finansheet-dev

# Access
# - Tailscale: https://mini-lab.tail4b2f89.ts.net:8444/
# - LAN: https://dev.mini-lab.lan (uses port 5175 mapped via Caddy)
```

### Production
```bash
# Deploy
bash /srv/apps/finansheet/deploy.sh

# Access: https://mini-lab.tail4b2f89.ts.net/ (mapped via Tailscale Serve)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
│  (Mac/iPhone via Tailscale or LAN)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│ Tailscale     │           │ Caddy         │
│ :443 / :8444  │           │ :443 (LAN)    │
└───────┬───────┘           └───────┬───────┘
        │                           │
        └───────────┬───────────────┘
                    ▼
        ┌───────────────────┐
        │ Docker Containers │
        ├───────────────────┤
        │ finansheet-app    │──► :3001 (PROD)
        │ finansheet-dev    │──► :5175 (DEV)
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ Supabase      │   │ Cloudflare    │
│ (Auth + DB)   │   │ (Worker AI)   │
└───────────────┘   └───────────────┘
```

---

## Environment Variables

Located in: `/srv/apps/finansheet/.env`

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_GEMINI_API_KEY` | Google Gemini API Key |

> ⚠️ **Never commit `.env` to git**

---

## Container Ports

| Container | Internal | External (Host) |
|-----------|----------|-----------------|
| finansheet-app (PROD) | 80 | 3001 |
| finansheet-dev (DEV) | 5173 | 5175 |

---

## File Locations

| Purpose | Path |
|---------|------|
| Source code | `/srv/repos/finansheet/` |
| Secrets | `/srv/apps/finansheet/.env` |
| Server overrides | `/srv/apps/finansheet/compose.override.yml` |
| Deploy script | `/srv/apps/finansheet/deploy.sh` |

---

## Useful Commands

```bash
# Container status
/srv/scripts/dc finansheet ps

# Restart dev
/srv/scripts/dc finansheet restart finansheet-dev

# Rebuild prod (after code changes)
bash /srv/apps/finansheet/deploy.sh

# View prod logs
/srv/scripts/dc finansheet logs --tail 50 finansheet-app

# Enter container
docker exec -it finansheet-dev sh
```
