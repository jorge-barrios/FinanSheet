# FinanSheet Development Guide

> **Este documento es el master reference para cualquier IA o desarrollador trabajando en el proyecto.**
> Última actualización: 2026-01-10

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

> ⚠️ **TODO:** Esta lógica está en frontend (`TermsListView.tsx`). Idealmente debería tener validación en backend también.

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
| Grid | `ExpenseGridVirtual.v2.tsx` | Vista de calendario virtualizada |
| Inventario | `InventoryView.tsx` | Lista de todos los commitments |

### Componentes de UI

| Componente | Descripción |
|------------|-------------|
| `BentoGrid.tsx` | Sistema de grid modular responsivo |
| `BentoCard.tsx` | Card con glassmorphism para BentoGrid |
| `CommitmentForm.v2.tsx` | Formulario de commitment/term |
| `PaymentRecorder.v2.tsx` | Registro de pagos |

---

## Sistema de Diseño

### Paleta de Colores (Deep Teal Identidad)

| Uso | Light Mode | Dark Mode |
|-----|------------|-----------|
| **Accent** | #00555A (Deep Teal) | #A8E6CF (Neo-Mint) |
| **Positivo** | #059669 | #9CAF88 (Eucalyptus) |
| **Warning** | #FF6F61 (Coral) | #FF6F61 |
| **Fondo** | #FAFAF8 (Alabaster) | #0f1219 |

**Activación:** La clase `theme-identidad` está en `<html>` por defecto.

### CSS Variables

```css
var(--dashboard-accent)      /* Color primario */
var(--dashboard-positive)    /* Verde/positivo */
var(--dashboard-negative)    /* Rojo/negativo */
var(--dashboard-warning)     /* Amarillo/alerta */
var(--dashboard-surface)     /* Fondo de cards */
var(--dashboard-text-primary) /* Texto principal */
```

**Ubicación:** [dashboard-theme.css](../styles/dashboard-theme.css)

### Glassmorphism

El proyecto usa glassmorphism consistentemente:

```css
backdrop-blur-xl
bg-[var(--dashboard-surface)]/80
border border-[var(--dashboard-border)]
```

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
  ├── ExpenseGridVirtual.v2.tsx  # Grid virtualizado
  └── DashboardFull.v2.tsx  # Dashboard principal

/utils/
  ├── commitmentStatusUtils.ts  # getCommitmentSummary() [CENTRALIZADO]
  └── financialUtils.v2.ts      # getPerPeriodAmount() [CENTRALIZADO]

/styles/
  └── dashboard-theme.css   # Variables CSS y temas

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
