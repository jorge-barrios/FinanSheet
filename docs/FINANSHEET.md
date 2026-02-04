# FinanSheet - Project Documentation

## Quick Start

### Development
```bash
# Start dev server (hot reload)
/srv/scripts/dc finansheet up -d finansheet-dev

# View logs
/srv/scripts/dc finansheet logs -f finansheet-dev

# Access
# - Tailscale (Remote): https://mini-lab.tail4b2f89.ts.net:8444/
# - LAN: https://finansheet.dev.lab (requires Caddy + Hosts)
```

### Production
```bash
# Deploy
bash /srv/apps/finansheet/deploy.sh

# Access:
# - Remote: https://mini-lab.tail4b2f89.ts.net/ (PROD)
# - LAN: https://finansheet.lab (requires Caddy + Hosts)
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
| **Caddy config** | `/etc/caddy/conf.d/finansheet.caddy` |

---

## Caddy Integration

FinanSheet uses a **dedicated Caddy config file** to avoid conflicts with other projects.

**Location**: `/etc/caddy/conf.d/finansheet.caddy`

```caddy
# FinanSheet PROD (Port 3001)
finansheet.lab {
  bind 192.168.100.224
  reverse_proxy 127.0.0.1:3001
  tls internal
}

# FinanSheet DEV (Port 5175)
finansheet.dev.lab {
  bind 192.168.100.224
  reverse_proxy 127.0.0.1:5175 {
    header_up Host 127.0.0.1  # Bypasses Vite "allowedHosts" check
  }
  tls internal
}
```

### To modify:
```bash
# Edit the file
sudo nano /etc/caddy/conf.d/finansheet.caddy

# Reload Caddy
sudo systemctl reload caddy
```

> ⚠️ **Only edit YOUR project's `.caddy` file**. Do not modify other projects' configs.

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
