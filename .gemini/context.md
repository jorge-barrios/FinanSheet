# Gemini Context

Para contexto del proyecto, leer: [CLAUDE.md](../CLAUDE.md)

---

# 🚨 AGENT INSTRUCTIONS: MINI-LAB DEVELOPMENT

## 🛑 CRITICAL RULE: NO HOST INSTALLS

This project runs **EXCLUSIVELY** in Docker.

- **NEVER** run `npm install`, `npm ci`, or `npm run dev` directly on the host machine.
- **NEVER** suggest commands that modify `node_modules` on the host.

## ✅ CORRECT WORKFLOW

Always use `docker compose` (via the `/srv/scripts/dc` wrapper) to interact with the project.

### 1. Install Dependencies

Dependencies are managed automatically by the container restart (via `npm ci` in the base compose file).
If you need to add a package:

```bash
# Good
/srv/scripts/dc finansheet exec finansheet-dev npm install <package>
```

### 2. Start/Restart Development Server

```bash
# Good
/srv/scripts/dc finansheet up -d finansheet-dev
/srv/scripts/dc finansheet restart finansheet-dev
```

### 3. Run Tests / Type Check

```bash
# Good - Run inside container
/srv/scripts/dc finansheet exec finansheet-dev npm run typecheck
/srv/scripts/dc finansheet exec finansheet-dev npm run test
```

## 📂 FILE STRUCTURE

- **Edit code**: `/srv/repos/finansheet/src/...` (Mapped to `/app/src` in container)
- **Config**: `/srv/repos/finansheet/docker-compose.yml` (Base logic)
- **Secrets**: `/srv/apps/finansheet/.env` (Mounted read-only)

---

**Shared Agents**: `/srv/infra/agents/` (Developer, Architect, Debugger personas)
**Shared Skills**: `/srv/infra/skills/`

Este archivo actúa como el punto de entrada para Gemini/Antigravity.
Ver CLAUDE.md para:

- Sistema de documentación (3 docs maestros)
- Arquitectura del proyecto
- Reglas de código
- Common gotchas
