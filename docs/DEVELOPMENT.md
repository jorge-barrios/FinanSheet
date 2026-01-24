# FinanSheet Development Guide

> **Este documento es el master reference para cualquier IA o desarrollador trabajando en el proyecto.**
> Última actualización: 2026-01-13

## Regla de Mantenimiento

**OBLIGATORIO:** Cuando se acepten cambios significativos al proyecto, se DEBE actualizar la sección correspondiente de este documento. Esto incluye:

- Nuevas funciones centralizadas → Actualizar "Funciones Centralizadas"
- Nuevos componentes → Actualizar "Vistas Principales" o "Componentes de UI"
- Cambios en paleta de colores → Actualizar "Sistema de Diseño"
- Nueva estructura de archivos → Actualizar "Estructura de Archivos"

**El documento debe reflejar siempre el estado real del proyecto.**

---

## Estado del Proyecto

**Versión activa:** V2 (fully migrated)
**Feature flags:** V2 enabled by default

### Data Model

El proyecto usa el modelo V2 normalizado con versionamiento de términos:

```
Commitment (Netflix)
  ├── Term v1 (2024-01 → 2024-06) ── $9.990/mes
  │     ├── Payment 2024-01 ✓
  │     ├── Payment 2024-02 ✓
  │     └── ...
  └── Term v2 (2024-07 → NULL) ── $12.990/mes (subió el precio)
        ├── Payment 2024-07 ✓
        └── Payment 2024-08 (pendiente)
```

**Entidades:**

| Entidad | Descripción | Inmutabilidad |
|---------|-------------|---------------|
| **Commitment** | Obligación financiera (gasto o ingreso). Metadatos: nombre, categoría, notas. | Editable libremente. |
| **Term** | Versión de condiciones (monto, frecuencia, fechas). | **Editable**: Campos se pueden modificar. Si se pausa o cambian condiciones futuras, se crea nueva versión. |
| **Payment** | Registro de pago para un período específico. | Editable (monto, fecha de pago). |

**Reglas de Relación:**

1.  **Un Commitment tiene N Terms** (versionados, no se solapan).
2.  **Un Term pertenece a 1 Commitment** y tiene N Payments.
3.  **Un Payment pertenece a 1 Term y 1 Commitment**, identificado por `period_date`.
4.  **`period_date`** = El mes al que corresponde el pago (ej: `2024-03-01` = Marzo 2024).
5.  **Constraint DB:** `UNIQUE(commitment_id, period_date)` → Solo 1 pago por mes por commitment.

**Versionamiento de Terms (Frontend):**
Cuando cambian las condiciones (monto, frecuencia), el frontend:
1.  Cierra el term actual: `effective_until = último día del mes actual`.
2.  Crea un nuevo term: `version + 1`, `effective_from = primer día del mes siguiente`.

### Reglas de Edición de Terms

| Condición | Acción Permitida |
|-----------|------------------|
| **Term SIN pagos** | Edición libre de todos los campos |
| **Term CON pagos** + cambio en `is_divided_amount`, `amount_original`, `frequency` | ⚠️ Forzar: Cerrar term actual → Crear V+1 |
| **Term CON pagos** + solo cambio en `due_day_of_month`, `effective_until` (extender) | ✅ Edición directa |
| **Term CON pagos** + acortar `effective_until` dejando pagos PAGADOS fuera | ❌ Bloqueado |

**Justificación:** Si hay pagos registrados bajo ciertas condiciones (monto, frecuencia, tipo), esas condiciones son "historia contable". Cambiarlas retroactivamente crearía inconsistencias.

**Archivos clave:**
- `types.v2.ts` - Definiciones de tipos
- `services/dataService.v2.ts` - Capa de acceso a datos (Supabase)

### Term Data Integrity (Backend Trigger)

La tabla `terms` tiene un trigger `calculate_effective_until()` que garantiza consistencia de datos:

| Prioridad | Condición | Acción del Trigger |
|-----------|-----------|-------------------|
| 0 | `frequency = 'ONCE'` | Fuerza `installments_count = 1` y `effective_until = effective_from`. **Siempre definido.** |
| 1 | `effective_until = NULL` + `is_divided_amount = FALSE` | Limpia `installments_count = NULL`. **Indefinido/Recurrente.** |
| 2 | `installments_count > 0` | Calcula `effective_until` basado en conteo y frecuencia. **Definido.** |

**Reglas de Negocio:**
- **ONCE**: Siempre es un pago único. No se puede hacer indefinido.
- **Indefinido**: Si no tiene fecha de fin Y no es monto dividido → no puede tener número de cuotas.
- **Dividido (préstamos)**: Puede tener `installments_count` sin `effective_until` (crédito interrumpido).

**Ubicación:** `database/018_bidirectional_term_trigger.sql`

---

## Funciones Centralizadas (OBLIGATORIAS)

### Estado y Resumen de Commitments

**SIEMPRE usar `getCommitmentSummary()`** para obtener información de un commitment.

```typescript
import { getCommitmentSummary, getCommitmentStatus } from '../utils/commitmentStatusUtils';

// Obtener resumen completo
const summary = getCommitmentSummary(commitment, allPayments, lastPaymentsMap);

// Propiedades disponibles:
summary.estado          // 'overdue' | 'pending' | 'ok' | 'completed' | 'paused' | 'terminated' | 'no_payments'
summary.estadoDetail    // String descriptivo (ej: "2 pendientes", "Al día")
summary.perPeriodAmount // Monto por período (maneja is_divided_amount correctamente)
summary.totalPaid       // Total pagado históricamente
summary.paymentCount    // Cantidad de pagos
summary.overdueCount    // Períodos vencidos sin pagar
summary.nextPaymentDate // Próxima fecha de pago
summary.lastPayment     // Último pago registrado
```

**Ubicación:** [commitmentStatusUtils.ts](../utils/commitmentStatusUtils.ts)

### Cálculo de Montos por Período

**SIEMPRE usar `getPerPeriodAmount()`** para calcular el monto de una cuota.

```typescript
import { getPerPeriodAmount } from '../utils/financialUtils.v2';

// Para term con is_divided_amount=true: divide el total entre cuotas
// Para term con is_divided_amount=false: retorna el monto fijo
const amount = getPerPeriodAmount(term, useBaseCurrency);
```

**Ubicación:** [financialUtils.v2.ts](../utils/financialUtils.v2.ts)

### Lógica de Estado (Projection vs Reality)

El cálculo de pendientes se basa estricta y exclusivamente en la comparación entre **Periodos Esperados** y **Registros Reales**:

1.  **Proyección**: Se calculan todos los periodos teóricos desde el inicio del commitment hasta hoy.
2.  **Realidad**: Se buscan registros de pago en la base de datos para cada periodo (`commitment_id` + `YYYY-MM`).
3.  **Validación**:
    *   Si existe registro con fecha de pago → **OK**.
    *   Si existe registro con monto $0 (o cerca de 0) → **OK** (Omitido/Resuelto automáticament).
    *   Si NO existe registro → **PENDIENTE**.

**NO** se asumen pagos por continuidad. Cada periodo debe tener su evidencia en la DB.

### NO Duplicar Lógica

Estos cálculos NO deben reimplementarse en componentes:
- Estado del commitment (overdue, pending, ok, etc.)
- Monto por período (considerando is_divided_amount)
- Conteo de pagos pendientes
- Próxima fecha de pago

### Modelo de Períodos y Pagos

Cada pago se asocia a un **período mensual**, no a una fecha arbitraria:

```
Commitment (Netflix)
  └── Term (desde 2024-01)
        ├── Period 2024-01 → Payment ✓
        ├── Period 2024-02 → Payment ✓
        ├── Period 2024-03 → (sin registro = PENDIENTE)
        └── Period 2024-04 → (futuro)
```

**Reglas:**
- Un `period_date` representa **el mes** al que corresponde el pago (ej: `2024-03-01` = Marzo 2024).
- Solo puede existir **un pago por período** por commitment (`UNIQUE(commitment_id, period_date)`).
- El `payment_date` es **cuándo se pagó realmente** (puede ser antes o después del período).

**Ejemplo:** Netflix de Marzo pagado el 28 de Febrero:
```sql
period_date = '2024-03-01'   -- Es para Marzo
payment_date = '2024-02-28'  -- Pero se pagó en Febrero
```

### Formato de Fechas de Período (periodDate)

**SIEMPRE usar strings `periodDate` en formato `YYYY-MM-DD`** (primer día del mes) para identificar períodos de pago.

```typescript
// Formato: "2024-05-01" (primer día del mes)
const periodDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

// Ejemplo: Abrir PaymentRecorder
handleOpenPaymentRecorder(commitmentId, "2024-05-01");

// Para convertir desde Date:
const periodDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
```

**¿Por qué?**
- Evita errores de conversión entre meses 0-indexed (JS) y 1-indexed (DB)
- La base de datos almacena `period_date` exactamente en este formato
- Elimina lógica duplicada de parsing/reconstrucción

**Componentes afectados:**
- `PaymentRecorder.v2.tsx` - Recibe `periodDate: string` directamente
- `handleOpenPaymentRecorder` en `App.tsx` - Usa `periodDate` string
- `onRecordPayment` en `ExpenseGridVirtual.v2.tsx` - Usa `periodDate` string
- `onOpenPaymentRecorder` en `DashboardFull.v2.tsx` - Usa `periodDate` string

---

## Vistas Principales

| Vista | Archivo | Descripción |
|-------|---------|-------------|
| Dashboard | `DashboardFull.v2.tsx` | KPIs, gráficos, resumen mensual |
| Grid | `ExpenseGridVirtual.v2.tsx` | Vista de calendario virtualizada (3 densidades) |
| Inventario | `InventoryView.tsx` | Lista de todos los commitments |

### Sistema de Densidades (Grid)

| Densidad | Meses | Celda | Contenido Visible |
|----------|-------|-------|-------------------|
| **Mínima** | 9 | 40px | Solo monto + icono estado (✓/⏱/⚠), tooltip con detalles |
| **Compacta** | 12 | 48px | Monto en pill badge, tooltip con detalles completos |
| **Detallada** | 6 | 100px | Monto grande + fecha + estado + cuota, todo visible |

El selector de densidad está disponible solo en desktop (`hidden lg:flex`).
Estado persistido en localStorage con key `gridDensity`.

### Componentes de UI

| Componente | Descripción |
|------------|-------------|
| `BentoGrid.tsx` | Sistema de grid modular responsivo |
| `BentoCard.tsx` | Card con glassmorphism para BentoGrid (prop `compact` para mobile) |
| `CommitmentCard.tsx` | Card de commitment con dropdown menu, modo compacto para mobile (88px vs 140px) |
| `CommitmentForm.v2.tsx` | Formulario de commitment (sheet lateral) |
| `CommitmentDetailModal.tsx` | Modal de detalle con términos/pagos |
| `PaymentRecorder.v2.tsx` | Registro de pagos |
| `TermsListView.tsx` | Vista de historial de términos |
| `PullToRefresh.tsx` | Gesto pull-to-refresh para móvil (Dashboard) |
| `AppLoadingSkeleton.tsx` | Skeleton loader que reemplaza "Loading..." |
| `PWAUpdateNotifier.tsx` | Toast de notificación cuando hay nueva versión |
| `FilterBar.tsx` | Barra de controles (búsqueda, densidad, vistas) [NUEVO] |
| `MobileKPICarousel.tsx` | Carrusel interactivo de KPIs para móvil [NUEVO] |
| `KPISelectorModal.tsx` | Selector tipo bottom-sheet para KPIs móvil [NUEVO] |

### PWA (Progressive Web App)

Configuración en `vite.config.ts` usando `vite-plugin-pwa`:

| Característica | Implementación |
|----------------|----------------|
| **Manifest** | Auto-generado con iconos, theme_color, orientación |
| **Service Worker** | Workbox con runtime caching |
| **Offline** | `public/offline.html` - página branded con retry |
| **Caching** | Google Fonts: CacheFirst (1 año), Supabase: NetworkOnly |
| **Updates** | `registerType: 'prompt'` → muestra PWAUpdateNotifier |

**Archivos clave:**
- `vite.config.ts` - Configuración de VitePWA
- `public/offline.html` - Página offline branded
- `public/sw.js` - SW básico (fallback, reemplazado por Workbox en prod)
- `pwa.d.ts` - Tipos para `virtual:pwa-register/react`

---

## Sistema de Diseño

### Paleta de Colores (Claridad Celestial)

| Uso | Color | Hex |
|-----|-------|-----|
| **Accent** | Sky Blue | `#0ea5e9` |
| **Background** | Slate 900 | `#0f172a` |
| **Surface** | Slate 800 | `#1e293b` |
| **Positivo** | Emerald 500 | `#10b981` |
| **Warning** | Amber 500 | `#f59e0b` |
| **Error** | Rose 500 | `#f43f5e` |

### Layout: Sheet Lateral

Patrón para modales principales (fullscreen mobile, columna desktop):

```tsx
// Contenedor
<div className="fixed inset-0 z-50 flex justify-end">
    // Backdrop con blur
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    
    // Contenido que desliza desde la derecha
    <div className="relative w-full sm:max-w-xl h-full bg-slate-50 dark:bg-slate-950/95 
                    animate-in slide-in-from-right duration-300 flex flex-col">
        // Header con safe-area para notch
        <div className="sticky top-0 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 ...">
        // Scrollable content
        <div className="flex-1 overflow-y-auto">
```

**Usado en:** `CommitmentForm.v2.tsx`, `CommitmentDetailModal.tsx`

### Estilos de Formulario Unificados

```typescript
// Inputs compactos (36px)
const formInputClasses = "h-[36px] bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-sky-500";

// Labels (11px uppercase)
const formLabelClasses = "text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5";
```

**Usado en:** `CommitmentForm.v2.tsx`, `TermsListView.tsx`

### Flujo de Interacción

| Acción | Resultado | Componente |
|--------|-----------|------------|
| Click en card | Detail Modal | `CommitmentDetailModal` |
| Menú → Editar | Form básico | `CommitmentForm.v2` |
| Menú → Detalle | Detail Modal | `CommitmentDetailModal` |

### Glassmorphism

### Filosofía de Cards Neutrales (Enfoque Híbrido)

> **Principio:** Las tarjetas tienen **fondo neutral**. El estado se comunica mediante:
> 1. **Barra lateral izquierda** (3px) coloreada según estado
> 2. **Tinte de fondo ultra-sutil** (30% opacidad) solo para ítems vencidos

**Justificación:**
- Evita el efecto "árbol de navidad" con múltiples tarjetas de colores brillantes.
- La barra lateral permite escaneo visual rápido sin saturar.
- El tinte rojo para vencidos crea urgencia sin ser agresivo.
- Los badges de texto refuerzan el mensaje.

**Colores de Barra Lateral:**

| Estado | Color de Barra |
|--------|----------------|
| Pagado/OK | `bg-emerald-500` |
| Pendiente | `bg-amber-400` |
| Vencido | `bg-red-500` |
| Completado | `bg-sky-500` |
| Inactivo | `bg-slate-300` |

**Implementación:**
```tsx
// CommitmentCard.tsx
<div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getAccentColor()}`} />
```

### Bento Grid

Sistema de grid modular para layouts responsivos:

```tsx
import { BentoGrid, BentoItem } from './BentoGrid';
import { BentoCard } from './BentoCard';

const items: BentoItem[] = [
  { id: '1', content: <BentoCard>...</BentoCard> },
  { id: '2', span: { cols: 2 }, content: <BentoCard>...</BentoCard> },
];

<BentoGrid items={items} columns={2} gap="md" />
```

### Íconos de Categoría

Los íconos de categoría se mapean automáticamente basándose en el nombre de la categoría. Soporta tanto los keys en inglés de la DB como nombres en español.

**Archivo:** `utils/categoryIcons.tsx`

| Categoría DB | Keywords (EN/ES) | Ícono |
|--------------|------------------|-------|
| housing, home | vivienda, hogar, casa, arriendo | 🏠 HomeIcon |
| utilities | servicios, luz, agua, gas | ⚡ ServicesIcon |
| transport | transporte, auto, bencina, uber | 🚚 TransportIcon |
| food | alimentación, supermercado, comida | ✨ MiscIcon |
| health | salud, isapre, farmacia, médico | ❤️ HealthIcon |
| subscriptions | suscripciones, netflix, spotify | 📺 SubscriptionIcon |
| debt | deuda, crédito, préstamo, visa | 💳 DebtIcon |
| savings | ahorro, inversión, fondo, apv | 💰 CurrencyDollarIcon |
| education | educación, colegio, universidad | 🎓 EducationIcon |
| entertainment | entretenimiento, ocio, cine | 🎬 EntertainmentIcon |
| business | negocios, empresa, emprendimiento | 💼 SalaryIcon |
| insurance | seguro, póliza | ❤️ HealthIcon |
| travel | viaje, vacaciones, turismo | 🚗 TransportIcon |
| taxes | impuesto, contribuciones | 💳 DebtIcon |
| personal | ropa, vestimenta | 🏷️ TagIcon |
| other | (default) | 🏷️ TagIcon |

**Uso:**
```tsx
import { getCategoryIcon } from '../utils/categoryIcons';
const Icon = getCategoryIcon(commitment.category?.name || '');
<Icon className="w-5 h-5" />
```

---

## Comandos de Desarrollo

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de producción
npm run preview          # Preview del build
npm test                 # Tests en watch mode
npm run test:run         # Tests una vez
```

---

## Reglas de Código

### TypeScript

- Strict mode habilitado
- Usar tipos explícitos en funciones exportadas
- Preferir interfaces sobre types para objetos

### Componentes

- Solo functional components (React 19)
- Usar hooks personalizados para lógica reutilizable
- Separar UI de lógica de negocio

### Estilos

- Tailwind CSS v4 (PostCSS)
- Usar CSS variables para colores del tema
- Mobile-first responsive design

### Imports

```typescript
// V2 siempre
import { CommitmentWithTerm } from '../types.v2';
import { getCommitmentSummary } from '../utils/commitmentStatusUtils';
import { getPerPeriodAmount } from '../utils/financialUtils.v2';
```

---

## Estructura de Archivos

```
/components/
  ├── BentoGrid.tsx         # Grid modular
  ├── BentoCard.tsx         # Card con glassmorphism
  ├── InventoryView.tsx     # Lista de commitments
  ├── ExpenseGrid/          # Grid virtualizado y componentes relacionados
  │     ├── index.tsx       # Componente principal
  │     ├── FilterBar.tsx   # Controles de filtro
  │     └── MobileKPICarousel.tsx # Carrusel móvil
  └── DashboardFull.v2.tsx  # Dashboard principal

/utils/
  ├── commitmentStatusUtils.ts  # getCommitmentSummary() [CENTRALIZADO]
  └── financialUtils.v2.ts      # getPerPeriodAmount() [CENTRALIZADO]

/styles/
  └── dashboard-theme.css   # Variables CSS y temas

/hooks/
  └── useExpenseGridLogic.ts # Lógica de negocio Grid (filtros, sort) [NUEVO]

/types.v2.ts               # Definiciones de tipos V2
```

---

## Checklist para Nuevas Features

- [ ] Usar funciones centralizadas (no duplicar lógica)
- [ ] Importar desde `types.v2.ts`
- [ ] Usar CSS variables para colores
- [ ] Implementar dark mode
- [ ] Probar en mobile (responsive)
- [ ] Build sin errores antes de commit
- [ ] Actualizar este documento despues de commit
