# CLAUDE.md

> Guía para IAs y desarrolladores trabajando en FinanSheet.
> Última actualización: 2026-01-12

---

## Sistema de Documentación (OBLIGATORIO)

El proyecto mantiene **3 documentos maestros** que DEBEN estar sincronizados con el código:

```
docs/
├── DEVELOPMENT.md      ← Desarrollo: funciones, componentes, reglas de código
├── BACKEND_SPECS.md    ← Backend: tablas, triggers, RLS, migraciones
└── Identidad.md        ← Diseño: colores, tipografía, componentes UI
```

### Regla de Sincronización

**ANTES de hacer commit**, actualizar el documento correspondiente según el tipo de cambio:

| Tipo de Cambio              | Documento a Actualizar | Sección                                    |
| --------------------------- | ---------------------- | ------------------------------------------ |
| Nueva función centralizada  | `DEVELOPMENT.md`       | "Funciones Centralizadas"                  |
| Nuevo componente UI         | `DEVELOPMENT.md`       | "Vistas Principales" o "Componentes de UI" |
| Cambio de colores/tema      | `Identidad.md`         | "12.1. Paleta de Colores"                  |
| Nuevo trigger/función SQL   | `BACKEND_SPECS.md`     | "Funciones y Triggers"                     |
| Nueva migración DB          | `BACKEND_SPECS.md`     | "Guía de Migraciones"                      |
| Cambio de tipografía        | `Identidad.md`         | "12.3. Tipografía"                         |
| Nueva tabla/columna         | `BACKEND_SPECS.md`     | "Schema de Tablas"                         |
| Cambio en reglas de negocio | `DEVELOPMENT.md`       | Sección relevante                          |

### Al Crear Commits

1. Verificar si el cambio afecta algún documento
2. Actualizar la sección correspondiente
3. Actualizar `Última actualización: YYYY-MM-DD` en el header del doc
4. Incluir el doc actualizado en el mismo commit

### Antes de Modificar Código (OBLIGATORIO)

**Antes de editar componentes UI o lógica de negocio, LEER:**

1. **`docs/DEVELOPMENT.md`** - Funciones centralizadas y reglas de negocio
   - Verificar si ya existe una función que hace lo que necesitas
   - Usar `getCommitmentSummary()`, `getPerPeriodAmount()`, etc.
   - Seguir el patrón de "Filosofía de Cards Neutrales"

2. **`docs/Identidad.md` (Sección 12)** - Estado actual del diseño
   - Paleta de colores implementada
   - Tipografía (Geist para UI, Space Grotesk para marca)
   - Estilos de componentes existentes

3. **`docs/BACKEND_SPECS.md`** - Si el cambio involucra datos
   - Schema de tablas y relaciones
   - Triggers activos (ej: `calculate_effective_until`)
   - Funciones SQL disponibles

**NO duplicar lógica. NO inventar estilos nuevos. Usar lo existente.**

---

## Development (Dockerized)

**El proyecto corre dockerizado. No usar `npm run dev` en el host.**

### Recomendado: Usar script `dc`

```bash
# Iniciar / Reiniciar
/srv/scripts/dc finansheet up -d finansheet-dev

# Ver logs
/srv/scripts/dc finansheet logs -f finansheet-dev

# Ejecutar comandos (ej: install package)
/srv/scripts/dc finansheet exec finansheet-dev npm install <package>
```

### Manual (Docker Compose nativo)

```bash
# Levantar dev server (hot reload) — DEBE incluir el override con secrets
cd /srv/repos/finansheet && docker compose -f docker-compose.yml -f /srv/apps/finansheet/compose.override.yml up finansheet-dev -d --force-recreate

# Ver logs
docker compose -f docker-compose.yml -f /srv/apps/finansheet/compose.override.yml logs finansheet-dev --tail 20

# Type check
npx tsc --noEmit
```

> [!IMPORTANT]
> Los secrets (`.env`) viven en `/srv/apps/finansheet/.env`, NO en el repo. El `compose.override.yml` los monta al container.

**URLs de acceso:**

| Método             | URL                                        |
| ------------------ | ------------------------------------------ |
| Tailscale (remoto) | `https://mini-lab.tail4b2f89.ts.net:8444/` |
| LAN                | `https://finansheet.dev.lab`               |
| Directo            | `http://localhost:5175/`                   |

**Arquitectura de red:** Caddy (:8444 HTTPS) → Docker (:5175 host → :5173 container) → Vite HMR

### Testing

```bash
npm test                 # Run tests in watch mode
npm run test:ui          # Open Vitest UI for interactive testing
npm run test:run         # Run all tests once
npm run test:coverage    # Generate coverage report
```

---

## Architecture

### Data Model (V2 - Active)

El proyecto usa el modelo normalizado V2:

```
Commitment (Netflix)
  ├── Term v1 (2024-01 → 2024-06) ── $9.990/mes
  │     └── Payments...
  └── Term v2 (2024-07 → NULL) ── $12.990/mes
        └── Payments...
```

**Archivos clave:**

- `types.v2.ts` - Definiciones de tipos
- `services/dataService.v2.ts` - Capa de acceso a datos (Supabase)

### Key Architectural Patterns

**Three-Tier Separation**:

- Components render UI and handle user interaction
- Services (`services/`) provide data access layer (Supabase queries)
- Utils (`utils/`) contain pure calculation logic

**Critical Functions** (ver `docs/DEVELOPMENT.md` para detalles):

- `getCommitmentSummary()` - Estado y resumen de un commitment
- `getPerPeriodAmount()` - Monto por período (maneja cuotas divididas)
- `getInstallmentNumber()` - Número de cuota contextual

### Component Organization

**Core Components**:

- `DashboardFull.v2.tsx` - Dashboard principal
- `ExpenseGridVirtual.v2.tsx` - Grid virtualizado
- `CommitmentForm.v2.tsx` - Formulario de commitments
- `PaymentRecorder.v2.tsx` - Registro de pagos
- `TermsListView.tsx` - Vista de historial de términos

**Authentication**:

- `context/AuthContext.tsx` - Supabase auth integration
- `components/Auth/` - Login, signup, protected routes
- Row-level security (RLS) enabled on all tables

### Database Schema

**Core Entities** (ver `docs/BACKEND_SPECS.md` para detalles):

- `commitments` - Obligación financiera (gasto o ingreso)
- `terms` - Versión de condiciones (monto, frecuencia, fechas)
- `payments` - Registro de pago para un período específico
- `categories_v2` - Categorías del usuario o globales
- `profiles` - Preferencias del usuario

**Critical Constraint**: `UNIQUE(commitment_id, period_date)` - Un pago por período.

**Migrations**: Ver `database/` - archivos numerados 001→018.

### Environment Variables

Required in `.env`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Common Gotchas

1. **`period_date` format**: Siempre `YYYY-MM-01` (primer día del mes)
2. **Terms son EDITABLES**: Puedes modificar campos, los pagos corresponden al `period_date`
3. **`installments_count` en indefinidos**: Si `effective_until = NULL`, el trigger limpia `installments_count`
4. **Frecuencia ONCE**: Siempre fuerza `installments_count = 1` y `effective_until = effective_from`
5. **Montos**: Siempre almacenar `amount_original` + `amount_in_base` (CLP)

---

## Code Style

- TypeScript strict mode enabled
- React 19 with functional components only
- Tailwind CSS v4 for styling (PostCSS-based)
- Geist font for UI, Space Grotesk for branding
- Prefer explicit return types on exported functions

---

## Deployment

- **Prod container**: `finansheet-app` (Nginx, puerto 3001)
- **Dev container**: `finansheet-dev` (Node 20 Alpine, puerto 5175→5173)
- Build command: `npm run build`
- Deploy script: `bash /srv/apps/finansheet/deploy.sh`

---

## Quick Reference: Documentación

| Necesito...                               | Ver documento                             |
| ----------------------------------------- | ----------------------------------------- |
| Funciones centralizadas, reglas de código | [DEVELOPMENT.md](docs/DEVELOPMENT.md)     |
| Tablas, triggers, SQL, migraciones        | [BACKEND_SPECS.md](docs/BACKEND_SPECS.md) |
| Colores, tipografía, componentes UI       | [Identidad.md](docs/Identidad.md)         |
