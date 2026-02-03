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
# - LAN: https://dev-finansheet.mini-lab.lan
```

### Production
```bash
# Deploy
bash /srv/apps/finansheet/deploy.sh

# Access: https://finansheet.mini-lab.lan or port 3001
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
                  ▼
          ┌───────────────┐
          │ Supabase      │
          │ (Auth + DB)   │
          └───────────────┘
```

---

## Environment Variables

Located in: `/srv/apps/finansheet/.env`

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

> ⚠️ **Never commit `.env` to git**

---

## Container Ports

| Container | Internal | External |
|-----------|----------|----------|
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

---

## Supabase

### Tables
- `commitments` - Financial commitments (expenses/income)
- `terms` - Payment terms and conditions
- `payments` - Payment records
- `categories` - Expense categories

### Auth
- Email/password authentication
- Row Level Security (RLS) enabled

---

## Production Deploy (Vercel)

This project also deploys to Vercel automatically via GitHub webhook.

- **Vercel URL**: [production URL here]
- **Auto-deploy**: On push to `main` branch

The Docker setup is for local/mini-lab development and testing.
