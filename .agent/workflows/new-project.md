---
description: Set up a new project in mini-lab with Docker, Caddy, and documentation
---

# New Project Setup Workflow

## Naming Conventions

| Element | Format | Example |
|---------|--------|---------|
| Repo folder | `kebab-case` | `medfam-asistencia` |
| Docker PROD service | `<project>-app` | `medfam-app` |
| Docker DEV service | `<project>-dev` | `medfam-dev` |
| Caddy domain PROD | `<project>.lab` | `medfam.lab` |
| Caddy domain DEV | `<project>.dev.lab` | `medfam.dev.lab` |
| PROD port | `30xx` | `3002` |
| DEV port | `51xx` | `5176` |
| Tailscale DEV port | `844x` | `8445` |

---

## Step 1: Clone or Create Repo

```bash
cd /srv/repos
git clone <repo-url> <project-name>
# OR create new:
# mkdir <project-name> && cd <project-name> && npm create vite@latest . -- --template react-ts
```

## Step 2: Create Server Config Directory

```bash
mkdir -p /srv/apps/<project-name>
```

## Step 3: Create Secrets File

```bash
cat > /srv/apps/<project-name>/.env << 'EOF'
# Add your env vars here
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
EOF
```

## Step 4: Create Docker Compose Override

```bash
cat > /srv/apps/<project-name>/compose.override.yml << 'EOF'
services:
  # PROD - auto-restarts after reboot
  <project>-app:
    restart: unless-stopped
    ports:
      - "<30xx>:80"
    env_file:
      - /srv/apps/<project-name>/.env

  # DEV - auto-restarts after reboot
  <project>-dev:
    restart: unless-stopped
    ports:
      - "<51xx>:5173"
    volumes:
      - /srv/repos/<project-name>:/app
      - /srv/apps/<project-name>/.env:/app/.env:ro
      - /srv/repos/<project-name>/node_modules:/app/node_modules
    env_file:
      - /srv/apps/<project-name>/.env
    command: ./node_modules/.bin/vite --host
EOF
```

## Step 5: Create Caddy Config

```bash
cat > /srv/<project-name>.caddy << 'EOF'
# <Project> PROD (Port <30xx>)
<project>.lab {
  bind 192.168.100.224
  reverse_proxy 127.0.0.1:<30xx>
  tls internal
}

# <Project> DEV (Port <51xx>)
<project>.dev.lab {
  bind 192.168.100.224
  reverse_proxy 127.0.0.1:<51xx> {
    header_up Host 127.0.0.1
  }
  tls internal
}
EOF

# Move to Caddy conf.d
sudo mv /srv/<project-name>.caddy /etc/caddy/conf.d/<project-name>.caddy
sudo systemctl reload caddy
```

## Step 6: Update Mac Hosts

On Mac, add to `/etc/hosts`:
```
192.168.100.224  <project>.lab <project>.dev.lab
```

## Step 7: Configure Tailscale (Optional)

```bash
sudo tailscale serve --bg --https=<844x> http://127.0.0.1:<51xx>
```

## Step 8: Install Dependencies & Start

```bash
cd /srv/repos/<project-name>
npm install

# Start DEV
lab <project-name> up -d <project>-dev
```

## Step 9: Create Project Documentation

Create `/srv/repos/<project-name>/docs/<PROJECT>.md` (copy from FINANSHEET.md template)

---

## Current Port Allocation

| Project | PROD | DEV | Tailscale DEV |
|---------|------|-----|---------------|
| scanswift-pro | 3000 | 5174 | 8443 |
| finansheet | 3001 | 5175 | 8444 |
| medfam-asistencia | 3002 | 5176 | 8445 |
