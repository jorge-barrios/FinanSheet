# FinanSheet - Especificaciones Backend (Supabase)

> Documento de referencia para la lógica del backend. Basado en consultas reales a la base de datos.
> Última actualización: 2026-01-07

---

## Arquitectura General

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Supabase   │────▶│  PostgreSQL │
│  (React)    │     │   (Auth +   │     │  (Database) │
│             │◀────│    API)     │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Supabase Project**: `fhvdvyvlzempvcqtpqbm`
- **Auth**: Supabase Auth (email/password)
- **RLS**: Habilitado en todas las tablas

---

## Tablas

### 1. `profiles`

Configuración del usuario.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `user_id` | UUID | NO | - | PK, FK → auth.users |
| `base_currency` | TEXT | NO | 'CLP' | Moneda base del usuario |
| `locale` | TEXT | NO | 'es-CL' | Configuración regional |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado por trigger |

---

### 2. `categories_v2`

Categorías de gastos/ingresos.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | YES | - | FK → auth.users, NULL para globales |
| `name` | TEXT | NO | - | Nombre visible |
| `normalized_name` | TEXT | YES | - | Nombre en lowercase (trigger) |
| `is_global` | BOOLEAN | NO | FALSE | Si es categoría del sistema |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraint**: `UNIQUE(user_id, normalized_name)`

**Categorías Globales**:
- Sin categoría, Vivienda, Transporte, Alimentación, Salud
- Educación, Entretenimiento, Servicios, Sueldo, Inversiones

---

### 3. `commitments`

Compromisos financieros (gastos o ingresos recurrentes).

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → auth.users |
| `category_id` | UUID | YES | - | FK → categories_v2 (SET NULL on delete) |
| `name` | TEXT | NO | - | Nombre del compromiso |
| `flow_type` | TEXT | NO | - | 'EXPENSE' o 'INCOME' |
| `is_important` | BOOLEAN | NO | FALSE | Marcado como importante |
| `notes` | TEXT | YES | - | Notas adicionales |
| `linked_commitment_id` | UUID | YES | - | FK → commitments (para linking) |
| `link_role` | TEXT | YES | - | 'PRIMARY' o 'SECONDARY' |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado por trigger |

**Check**: `flow_type IN ('EXPENSE', 'INCOME')`
**Check**: `link_role IN ('PRIMARY', 'SECONDARY')`

---

### 4. `terms`

Versiones/condiciones de un compromiso. Permite cambios históricos de monto, frecuencia, etc.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `commitment_id` | UUID | NO | - | FK → commitments (CASCADE) |
| `version` | INTEGER | NO | 1 | Número de versión |
| `effective_from` | DATE | NO | - | Fecha inicio de vigencia |
| `effective_until` | DATE | YES | - | Fecha fin (NULL = indefinido) |
| `frequency` | TEXT | NO | - | Frecuencia de pago |
| `installments_count` | INTEGER | YES | - | Número de cuotas/ocurrencias |
| `due_day_of_month` | INTEGER | YES | - | Día de vencimiento (1-31) |
| `currency_original` | TEXT | NO | - | Moneda original |
| `amount_original` | NUMERIC(15,2) | NO | - | Monto en moneda original |
| `fx_rate_to_base` | NUMERIC(15,6) | NO | 1.0 | Tasa de cambio a CLP |
| `amount_in_base` | NUMERIC(15,2) | YES | - | Monto en CLP (calculado por trigger) |
| `estimation_mode` | TEXT | YES | - | 'FIXED', 'AVERAGE', 'LAST' |
| `is_divided_amount` | BOOLEAN | YES | FALSE | TRUE = divide monto entre cuotas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado por trigger |

**Constraint**: `UNIQUE(commitment_id, version)`
**Check**: `frequency IN ('ONCE', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY')`
**Check**: `due_day_of_month BETWEEN 1 AND 31`
**Check**: `estimation_mode IN ('FIXED', 'AVERAGE', 'LAST')`

---

### 5. `payments`

Pagos realizados para un período específico.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `commitment_id` | UUID | NO | - | FK → commitments (CASCADE) |
| `term_id` | UUID | NO | - | FK → terms (CASCADE) |
| `period_date` | DATE | NO | - | Período al que corresponde (YYYY-MM-01) |
| `payment_date` | DATE | YES | - | Fecha real de pago (NULL = no pagado) |
| `currency_original` | TEXT | NO | - | Moneda del pago |
| `amount_original` | NUMERIC(15,2) | NO | - | Monto pagado |
| `fx_rate_to_base` | NUMERIC(15,6) | NO | 1.0 | Tasa de cambio |
| `amount_in_base` | NUMERIC(15,2) | YES | - | Monto en CLP (trigger) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraint**: `UNIQUE(commitment_id, period_date)` - Un pago por período

---

### 6. `exchange_rates`

Tasas de cambio históricas.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `from_currency` | TEXT | NO | - | Moneda origen |
| `to_currency` | TEXT | NO | - | Moneda destino |
| `rate` | NUMERIC(15,6) | NO | - | Tasa de cambio |
| `effective_date` | DATE | NO | - | Fecha de vigencia |
| `source` | TEXT | YES | - | Fuente ('manual', 'api') |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraint**: `UNIQUE(from_currency, to_currency, effective_date)`

---

### 7. `goals` (Smart Buckets)

Metas de ahorro con asignación tipo 50/30/20.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → auth.users |
| `name` | TEXT | NO | - | Nombre de la meta |
| `target_amount` | NUMERIC(15,2) | YES | - | Monto objetivo (NULL = sin límite) |
| `current_amount` | NUMERIC(15,2) | NO | 0 | Monto acumulado |
| `target_date` | DATE | YES | - | Fecha límite |
| `priority` | INTEGER | NO | 0 | Prioridad (mayor = primero en recibir) |
| `icon` | TEXT | YES | - | Nombre del ícono (Lucide) |
| `color` | TEXT | YES | - | Color hex (#3b82f6) |
| `is_archived` | BOOLEAN | NO | FALSE | Si está archivada |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado por trigger |

**RLS**: Solo el dueño puede ver/modificar sus metas.

---

### 8. `payment_adjustments` (Audit Trail)

Historial de ajustes a fechas de pago cuando cambia `effective_from` de un term.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `payment_id` | UUID | NO | - | FK → payments (CASCADE) |
| `original_period_date` | DATE | NO | - | Fecha original del período |
| `new_period_date` | DATE | NO | - | Nueva fecha del período |
| `original_term_id` | UUID | NO | - | Term original |
| `new_term_id` | UUID | NO | - | Nuevo term |
| `reason` | TEXT | NO | 'term_effective_from_change' | Razón del ajuste |
| `adjusted_at` | TIMESTAMPTZ | NO | NOW() | Momento del ajuste |
| `adjusted_by` | UUID | YES | - | FK → auth.users (quien hizo el ajuste) |

**Propósito**: Cuando un usuario cambia la fecha `effective_from` de un término que ya tiene pagos registrados, los pagos se reasignan a nuevas fechas. Esta tabla preserva el historial original para auditoría.

**RLS**: Usuarios solo ven ajustes de sus propios pagos (via JOIN con commitments).

---

## Funciones

### `update_updated_at_column()`

Auto-actualiza el campo `updated_at` en UPDATE.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### `normalize_category_name()`

Normaliza el nombre de categoría a lowercase.

```sql
CREATE OR REPLACE FUNCTION normalize_category_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name = LOWER(TRIM(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### `calculate_amount_in_base()`

Calcula `amount_in_base` automáticamente.

```sql
CREATE OR REPLACE FUNCTION calculate_amount_in_base()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_in_base = NEW.amount_original * NEW.fx_rate_to_base;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### `calculate_effective_until()`

**IMPORTANTE**: Auto-calcula `effective_until` cuando hay `installments_count`.

```sql
CREATE OR REPLACE FUNCTION calculate_effective_until()
RETURNS TRIGGER AS $$
DECLARE
    months_per_period INTEGER;
BEGIN
    IF NEW.installments_count IS NOT NULL AND NEW.installments_count > 0 THEN
        months_per_period := CASE NEW.frequency
            WHEN 'MONTHLY' THEN 1
            WHEN 'BIMONTHLY' THEN 2
            WHEN 'QUARTERLY' THEN 3
            WHEN 'SEMIANNUALLY' THEN 6
            WHEN 'ANNUALLY' THEN 12
            WHEN 'ONCE' THEN 0
            ELSE 1
        END;

        IF months_per_period = 0 THEN
            NEW.effective_until := NEW.effective_from;
        ELSE
            NEW.effective_until := NEW.effective_from +
                ((NEW.installments_count - 1) * months_per_period * INTERVAL '1 month');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Comportamiento**:
| Escenario | installments_count | effective_until |
|-----------|-------------------|-----------------|
| Indefinido | NULL | No se modifica (queda NULL) |
| Definido 3 meses | 3 | effective_from + 2 meses |
| En cuotas 6 | 6 | effective_from + 5 meses |
| ONCE | 1 | effective_from (mismo día) |

**Ejemplo**: `effective_from = 2025-12-26`, `installments_count = 3`, `frequency = MONTHLY`
→ `effective_until = 2026-02-26`

---

### `get_active_term(UUID, DATE)`

Obtiene el term activo para un commitment en una fecha dada.

```sql
CREATE OR REPLACE FUNCTION get_active_term(
  p_commitment_id UUID,
  p_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_term_id UUID;
BEGIN
  SELECT id INTO v_term_id
  FROM terms
  WHERE commitment_id = p_commitment_id
    AND effective_from <= p_date
    AND (effective_until IS NULL OR effective_until >= p_date)
  ORDER BY version DESC
  LIMIT 1;

  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql;
```

**Nota**: Usa `effective_until >= p_date`, por lo que el mes de `effective_until` SÍ se incluye.

---

### `get_exchange_rate(TEXT, TEXT, DATE)`

Obtiene la tasa de cambio más reciente para una fecha.

```sql
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency TEXT,
  p_to_currency TEXT,
  p_date DATE
)
RETURNS NUMERIC(15,6) AS $$
DECLARE
  v_rate NUMERIC(15,6);
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;

  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 1.0);
END;
$$ LANGUAGE plpgsql;
```

---

## Triggers

### En `profiles`

| Trigger | Evento | Función |
|---------|--------|---------|
| `update_profiles_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |

### En `categories_v2`

| Trigger | Evento | Función |
|---------|--------|---------|
| `update_categories_v2_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `normalize_category_v2_name` | BEFORE INSERT OR UPDATE | `normalize_category_name()` |

### En `commitments`

| Trigger | Evento | Función |
|---------|--------|---------|
| `update_commitments_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |

### En `terms`

| Trigger | Evento | Función |
|---------|--------|---------|
| `update_terms_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `calculate_terms_amount_in_base` | BEFORE INSERT OR UPDATE | `calculate_amount_in_base()` |
| `calculate_effective_until_trigger` | BEFORE INSERT OR UPDATE | `calculate_effective_until()` |

### En `payments`

| Trigger | Evento | Función |
|---------|--------|---------|
| `update_payments_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `calculate_payments_amount_in_base` | BEFORE INSERT OR UPDATE | `calculate_amount_in_base()` |

---

## Row Level Security (RLS)

Todas las tablas tienen RLS habilitado.

### `profiles`
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`

### `categories_v2`
- SELECT: `user_id = auth.uid() OR is_global = TRUE`
- INSERT: `user_id = auth.uid() AND is_global = FALSE`
- UPDATE/DELETE: `user_id = auth.uid() AND is_global = FALSE`

### `commitments`
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`

### `terms` y `payments`
- Todas las operaciones verifican que el `commitment_id` pertenezca al usuario:
```sql
EXISTS (
  SELECT 1 FROM commitments
  WHERE commitments.id = terms.commitment_id
  AND commitments.user_id = auth.uid()
)
```

### `exchange_rates`
- SELECT: Cualquier usuario autenticado puede ver

---

## Índices

### `categories_v2`
- `idx_categories_v2_user_id` ON (user_id)
- `idx_categories_v2_normalized_name` ON (normalized_name)

### `commitments`
- `idx_commitments_user_id` ON (user_id)
- `idx_commitments_category_id` ON (category_id)
- `idx_commitments_linked_commitment_id` ON (linked_commitment_id)

### `terms`
- `idx_terms_commitment_id` ON (commitment_id)
- `idx_terms_effective_from` ON (effective_from)
- `idx_terms_effective_until` ON (effective_until)

### `payments`
- `idx_payments_commitment_id` ON (commitment_id)
- `idx_payments_term_id` ON (term_id)
- `idx_payments_period_date` ON (period_date)
- `idx_payments_payment_date` ON (payment_date)

### `exchange_rates`
- `idx_exchange_rates_currencies` ON (from_currency, to_currency, effective_date DESC)

---

## Lógica de Negocio

### Tipos de Duración

| Tipo | installments_count | is_divided_amount | effective_until | Comportamiento |
|------|-------------------|-------------------|-----------------|----------------|
| **Indefinido** | NULL | FALSE/NULL | NULL | Se repite sin fin, "Pago X/∞" |
| **Definido** | N (ej: 3) | FALSE | Calculado por trigger | Monto fijo por período, "Pago X/3" |
| **En cuotas** | N (ej: 3) | TRUE | Calculado por trigger | Monto total ÷ N, "Cuota X/3" |

### Cálculo de Monto por Período

```typescript
// Frontend (financialUtils.v2.ts)
function getPerPeriodAmount(term: Term): number {
    const totalAmount = term.amount_in_base ?? term.amount_original;

    // Solo dividir si is_divided_amount = true (En cuotas)
    if (term.is_divided_amount && term.installments_count > 1) {
        return totalAmount / term.installments_count;
    }

    return totalAmount;
}
```

### Verificación de Mes Activo

```typescript
// ¿El commitment aplica a un mes específico?
function isActiveInMonth(term: Term, monthDate: Date): boolean {
    // 1. Verificar fecha inicio
    if (startDate > monthEnd) return false;

    // 2. Verificar rango de ocurrencias (prioritario sobre effective_until)
    if (term.installments_count > 0) {
        const monthsDiff = calcularDiferenciaMeses(effective_from, monthDate);
        if (monthsDiff < 0 || monthsDiff >= term.installments_count) {
            return false;
        }
    } else if (term.effective_until) {
        // Solo usar effective_until si no hay installments_count
        if (endDate < monthStart) return false;
    }

    // 3. Verificar frecuencia
    switch (term.frequency) {
        case 'MONTHLY': return true;
        case 'BIMONTHLY': return monthsDiff % 2 === 0;
        case 'QUARTERLY': return monthsDiff % 3 === 0;
        // ...
    }
}
```

### Pausar un Commitment

Para pausar un commitment, se actualiza el `effective_until` del term activo:

```sql
UPDATE terms
SET effective_until = CURRENT_DATE - INTERVAL '1 day'
WHERE id = :term_id;
```

**Nota**: El frontend debe verificar `effective_until < today` para determinar si está pausado.

### Reactivar un Commitment

Para reactivar, se crea un NUEVO term (no se modifica el anterior):

```sql
INSERT INTO terms (commitment_id, version, effective_from, ...)
VALUES (:commitment_id, :next_version, CURRENT_DATE, ...);
```

---

## Lógica de Términos Múltiples y Traslado de Pagos

### Estructura de Términos por Versión

Cada vez que un commitment se pausa/reanuda o se edita con cambios significativos, se crea un nuevo término con `version` incrementada:

```
Commitment "Netflix"
├── Término V1: 2025-01-01 → 2025-06-30 (cerrado por pausa)
│   └── Pagos: Ene, Feb, Mar, Abr, May, Jun 2025
├── Término V2: 2025-08-01 → 2025-12-31 (cerrado por pausa)
│   └── Pagos: Ago, Sep, Oct, Nov, Dic 2025
└── Término V3: 2026-01-01 → NULL (activo)
    └── Pagos: Ene 2026
```

### Término Activo

El término activo es siempre el de **mayor versión** (`ORDER BY version DESC LIMIT 1`).

```sql
-- Obtener término activo
SELECT * FROM terms
WHERE commitment_id = :id
ORDER BY version DESC
LIMIT 1;
```

### Traslado de Pagos al Editar

**Principio:** Los pagos de términos cerrados son historia - NO se modifican automáticamente.

| Escenario | Acción |
|-----------|--------|
| Editar término activo con pagos, cambiar `effective_from` | Preguntar si trasladar pagos |
| Editar término activo SIN pagos, cambiar `effective_from` | No preguntar (nada que trasladar) |
| Editar término activo con pagos, NO cambiar `effective_from` | No preguntar (fechas no cambian) |
| Términos cerrados (V1, V2) tienen pagos | NUNCA se tocan automáticamente |

**Diagrama de decisión (frontend):**
```
¿El término ACTIVO tiene pagos? ───NO───► Guardar sin preguntar
         │
        YES
         │
         ▼
¿Cambió effective_from? ───NO───► Guardar sin preguntar
         │
        YES
         │
         ▼
    Mostrar modal:
    "¿Trasladar X pagos?"
         │
    ┌────┴────┐
    │         │
   SÍ        NO
    │         │
    ▼         ▼
Reasignar   Pagos quedan
pagos con   en término
audit trail cerrado (se crea nuevo término)
```

### Reactivación (Resume)

Cuando se reactiva un commitment terminado:
1. Se crea un NUEVO término (no se modifica el anterior)
2. Los pagos del término cerrado quedan intactos
3. NO se pregunta por traslado (es una operación distinta)

**Detección de reactivación en frontend:**
```typescript
const wasTermEnded = originalEffectiveUntil && originalEffectiveUntil < today;
const isCreatingNewActiveTerm = newEffectiveFromYearMonth >= todayYearMonth;
const isReactivation = wasTermEnded && isCreatingNewActiveTerm;
```

### Audit Trail

Cuando se reasignan pagos, se registra en `payment_adjustments`:

```sql
INSERT INTO payment_adjustments (
    payment_id,
    original_period_date,
    new_period_date,
    original_term_id,
    new_term_id,
    reason,
    adjusted_by
) VALUES (
    :payment_id,
    :old_date,
    :new_date,
    :old_term_id,
    :new_term_id,
    'term_effective_from_change',
    auth.uid()
);
```

### Trigger `calculate_effective_until`

**IMPORTANTE**: El trigger calcula `effective_until` automáticamente cuando hay `installments_count`.

**Comportamiento actualizado (v2):**
- Solo recalcula en INSERT
- En UPDATE, solo recalcula si cambiaron: `installments_count`, `frequency`, o `effective_from`
- NO sobrescribe si solo cambió `effective_until` (pausa manual)

Esto permite cerrar términos manualmente sin que el trigger sobrescriba la fecha.

### Pausa como Barrera (Validación de No Superposición)

**Principio fundamental:** Los términos cerrados actúan como barreras históricas inmutables. Un término nuevo o editado **NUNCA** puede tener un `effective_from` que se superponga con un término cerrado.

**Diagrama de estructura válida:**
```
VÁLIDO:
V1: 2025-01-01 → 2025-06-30 (cerrado)
V2: 2025-07-01 → NULL (activo)
         ↑
         Empieza DESPUÉS del cierre de V1

INVÁLIDO (la validación lo bloquea):
V1: 2025-01-01 → 2025-06-30 (cerrado)
V2: 2025-05-15 → NULL ← ERROR: se superpone con V1
```

**Implementación (Backend - `TermService`):**
```typescript
async validateNoOverlap(commitmentId: string, termId: string | null, effectiveFrom: string): Promise<void> {
    const terms = await this.getTerms(commitmentId);
    const closedTerms = terms.filter(t => t.id !== termId && t.effective_until);

    if (closedTerms.length > 0) {
        const mostRecentClosed = closedTerms.sort((a, b) => b.version - a.version)[0];
        if (effectiveFrom <= mostRecentClosed.effective_until) {
            throw new Error(`effective_from no puede ser ≤ ${mostRecentClosed.effective_until}`);
        }
    }
}
```

**Puntos de validación:**
| Operación | Validación |
|-----------|------------|
| `createTerm()` | Valida ANTES de insertar |
| `updateTerm()` con cambio en `effective_from` | Valida ANTES de actualizar |
| Frontend `handleV2Save()` | Valida ANTES de llamar al backend |
| `resumeCommitment()` | Ya tiene su propia validación similar |

**Modal de Reasignación con Términos Cerrados:**

Cuando el usuario edita el `effective_from` de un término activo que tiene pagos:
- **Sin términos cerrados:** Se muestran Opción A (mover pagos) y Opción B (mantener en fecha), más Cancelar
- **Con términos cerrados:** Solo se muestra Opción A (mover pagos) + Cancelar. La Opción B se oculta porque crearía un término que necesita `effective_until` antes de la pausa, lo cual crearía superposición.

---

## Queries Útiles

### Ver todos los commitments con su term activo

```sql
SELECT
    c.name,
    c.flow_type,
    t.effective_from,
    t.effective_until,
    t.frequency,
    t.installments_count,
    t.is_divided_amount,
    t.amount_original,
    t.amount_in_base
FROM commitments c
LEFT JOIN terms t ON t.commitment_id = c.id
WHERE c.user_id = auth.uid()
ORDER BY c.name, t.version DESC;
```

### Verificar estado de un term

```sql
SELECT
    c.name,
    t.effective_from,
    t.effective_until,
    t.installments_count,
    t.is_divided_amount,
    CASE
        WHEN t.effective_until IS NULL THEN 'INDEFINIDO'
        WHEN t.effective_until < CURRENT_DATE THEN 'PAUSADO/TERMINADO'
        ELSE 'ACTIVO'
    END as status
FROM terms t
JOIN commitments c ON c.id = t.commitment_id
WHERE c.name ILIKE '%prueba%';
```

### Pagos de un mes específico

```sql
SELECT
    c.name,
    p.period_date,
    p.payment_date,
    p.amount_in_base,
    CASE WHEN p.payment_date IS NOT NULL THEN 'PAGADO' ELSE 'PENDIENTE' END as status
FROM payments p
JOIN commitments c ON c.id = p.commitment_id
WHERE p.period_date BETWEEN '2025-12-01' AND '2025-12-31'
ORDER BY c.name;
```

---

## Migraciones Aplicadas

| Archivo | Descripción |
|---------|-------------|
| `001_create_functions.sql` | Funciones base |
| `002_create_tables.sql` | Tablas principales |
| `003_create_triggers.sql` | Triggers |
| `004_create_rls_policies.sql` | Políticas RLS |
| `005_seed_categories.sql` | Categorías globales |
| `009_fix_effective_until_trigger.sql` | Trigger para calcular effective_until |
| `010_add_is_divided_amount.sql` | Campo is_divided_amount en terms |
| `011_add_goals.sql` | Tabla goals para Smart Buckets |
| `012_add_payment_adjustments.sql` | Tabla payment_adjustments para audit trail |
| `013_fix_effective_until_trigger_v2.sql` | Fix: trigger no sobrescribe effective_until manual |

---

## Consideraciones para Nuevas Funcionalidades

### Al agregar nuevos campos a `terms`:
1. Agregar columna con `ALTER TABLE terms ADD COLUMN ...`
2. Actualizar `types.v2.ts` (interfaces `Term` y `TermFormData`)
3. Actualizar `CommitmentForm.v2.tsx` (guardar el campo)
4. Actualizar lógica de inicialización al editar

### Al agregar nuevas funciones/triggers:
1. Crear archivo `0XX_nombre.sql` en `/database/`
2. Documentar en este archivo
3. Ejecutar manualmente en Supabase Dashboard → SQL Editor

### Para funcionalidad de "Pausar":
- NO eliminar el term, solo setear `effective_until = fecha_pausa`
- Para reactivar, crear nuevo term con `version = anterior + 1`
- El frontend detecta pausa con: `effective_until && effective_until < today`

---

## Servicios del Frontend (dataService.v2.ts)

### GoalService (Smart Buckets)

Gestión de metas de ahorro.

| Método | Descripción |
|--------|-------------|
| `getGoals(userId, includeArchived?)` | Obtiene todas las metas del usuario |
| `getGoal(id)` | Obtiene una meta por ID |
| `createGoal(userId, goalData)` | Crea una nueva meta |
| `updateGoal(id, updates)` | Actualiza una meta |
| `addFunds(id, amount)` | Agrega fondos a una meta |
| `withdrawFunds(id, amount)` | Retira fondos de una meta |
| `archiveGoal(id)` | Archiva una meta |
| `unarchiveGoal(id)` | Reactiva una meta archivada |
| `deleteGoal(id)` | Elimina una meta |
| `getTotalSavings(userId)` | Total de ahorro en todas las metas activas |

**Uso típico** (Asistente 50/30/20):
```typescript
// Distribuir ingreso entre metas
const allocations = { goalId1: 50000, goalId2: 30000 };
for (const [goalId, amount] of Object.entries(allocations)) {
    await GoalService.addFunds(goalId, amount);
}
```

---

### PaymentService - Audit Trail

Funciones relacionadas con la reasignación de pagos.

| Método | Descripción |
|--------|-------------|
| `getPaymentsForTerm(termId)` | Obtiene todos los pagos de un term |
| `hasPaymentsForTerm(termId)` | Verifica si un term tiene pagos registrados |
| `reassignPaymentsToNewTerm(oldTermId, newTermId, oldEffectiveFrom, newEffectiveFrom, userId?)` | Reasigna pagos a nuevo term con fechas ajustadas. Registra audit trail. |
| `getPaymentAdjustments(paymentId)` | Obtiene historial de ajustes de un pago |

**Flujo de reasignación**:
1. Usuario edita un commitment y cambia `effective_from`
2. Si hay pagos, se muestra modal de confirmación
3. Si confirma, se registra en `payment_adjustments` y se actualizan los pagos
4. Si rechaza, los pagos quedan con el term viejo (cerrado)

**Ejemplo de audit trail**:
```sql
-- Ver historial de ajustes de un pago
SELECT
    pa.original_period_date,
    pa.new_period_date,
    pa.reason,
    pa.adjusted_at
FROM payment_adjustments pa
WHERE pa.payment_id = '...'
ORDER BY pa.adjusted_at DESC;
```

---

## Queries Adicionales

### Ver metas con progreso

```sql
SELECT
    name,
    current_amount,
    target_amount,
    CASE
        WHEN target_amount IS NULL THEN NULL
        ELSE ROUND((current_amount / target_amount * 100)::numeric, 1)
    END as progress_pct,
    target_date,
    priority
FROM goals
WHERE user_id = auth.uid()
  AND is_archived = FALSE
ORDER BY priority DESC;
```

### Ver ajustes de pagos recientes

```sql
SELECT
    c.name as commitment_name,
    pa.original_period_date,
    pa.new_period_date,
    pa.reason,
    pa.adjusted_at
FROM payment_adjustments pa
JOIN payments p ON p.id = pa.payment_id
JOIN commitments c ON c.id = p.commitment_id
WHERE c.user_id = auth.uid()
ORDER BY pa.adjusted_at DESC
LIMIT 20;
```
