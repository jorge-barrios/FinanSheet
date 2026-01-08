# FinanSheet - Estado Actual de la Base de Datos

> **Fuente de verdad** para la configuración de Supabase.
> Generado: 2026-01-07 desde consultas directas a Supabase.
> Última actualización: 2026-01-07 - Nueva lógica de edición de términos y reasignación de pagos

---

## Resumen

| Tipo | Cantidad |
|------|----------|
| Tablas | 8 |
| Funciones | 11 |
| Triggers | 19+ |
| Políticas RLS | ~24 |

---

## 0. Reglas de Negocio Fundamentales

### Invariantes del Sistema

| Regla | Descripción | Implementación |
|-------|-------------|----------------|
| `period_date` es **INMUTABLE** | Un pago siempre pertenece a su período original | Frontend nunca permite cambiar `period_date` |
| `term_id` es **DERIVADO** | Se calcula según qué término cubre el `period_date` | Trigger `validate_payment_term` + frontend |
| Términos **NO se superponen** | Cada mes solo puede pertenecer a un término | Validación frontend antes de guardar |
| Gaps **PERMITIDOS** | Puede haber meses sin término (pausas) | Sin restricción |

### Flujo de Edición de Términos

```
Usuario edita términos (fechas, montos, etc.)
    │
    ├── 1. Validar que no haya superposición entre términos
    │
    ├── 2. Guardar cambios en términos (UPDATE/INSERT/DELETE)
    │
    └── 3. Reasignar pagos al término correcto:
          Para cada pago:
            correctTerm = get_active_term(commitment_id, period_date)
            IF correctTerm IS NULL → pago queda "huérfano" (período pausado)
            ELSE IF payment.term_id != correctTerm.id → UPDATE payment.term_id
```

### Comportamiento del Trigger `validate_payment_term`

El trigger **valida** que `term_id` sea correcto al hacer INSERT/UPDATE en `payments`:
- Si `get_active_term()` devuelve NULL → Error "período pausado"
- Si `term_id != correct_term` → Error "term_id incorrecto"

**Importante**: Al reasignar pagos, el frontend debe:
1. Primero actualizar los términos
2. Luego actualizar `term_id` de cada pago al valor correcto
3. El trigger aceptará porque `NEW.term_id == get_active_term()`

### Edición de Términos - Qué se puede modificar

| Campo | Editable | Notas |
|-------|----------|-------|
| `effective_from` | ✅ Sí | No puede superponerse con otros términos |
| `effective_until` | ✅ Sí | NULL = indefinido |
| `amount_original` | ✅ Sí | Cambia el monto esperado para ese período |
| `currency_original` | ✅ Sí | - |
| `frequency` | ✅ Sí | - |
| `due_day_of_month` | ✅ Sí | - |
| Eliminar término | ⚠️ Condicional | Solo si los pagos pueden reasignarse a otro término |

---

## 1. Funciones

| Función | Parámetros | Retorno | Descripción |
|---------|------------|---------|-------------|
| `calculate_amount_in_base()` | - | trigger | Calcula `amount_in_base = amount_original * fx_rate_to_base` |
| `calculate_effective_until()` | - | trigger | Auto-calcula `effective_until` cuando hay `installments_count` |
| `get_active_term(uuid, date)` | commitment_id, date | uuid | Busca term activo para una fecha (usado por `validate_payment_term`) |
| `validate_payment_term_period()` | - | trigger | Valida que `term_id` corresponda al `period_date` |
| `get_exchange_rate(text, text, date)` | from, to, date | numeric(15,6) | Obtiene tasa de cambio más reciente |
| `handle_new_user()` | - | trigger | Crea profile automáticamente al registrarse usuario |
| `normalize_category_name()` | - | trigger | Normaliza `name` a lowercase en `normalized_name` |
| `set_user_id_to_current_user()` | - | trigger | Asigna `auth.uid()` al `user_id` |
| `update_updated_at_column()` | - | trigger | Actualiza timestamp `updated_at` en cada UPDATE |

### Código de Funciones Clave

#### `get_active_term(uuid, date)`
> **IMPORTANTE**: Compara a nivel de MES, no día exacto (fix aplicado en 017_fix_date_comparison.sql)

```sql
SELECT id INTO v_term_id
FROM terms
WHERE commitment_id = p_commitment_id
  -- Comparación a nivel de MES (no día exacto)
  AND DATE_TRUNC('month', effective_from) <= DATE_TRUNC('month', p_date)
  AND (
    effective_until IS NULL
    OR DATE_TRUNC('month', effective_until) >= DATE_TRUNC('month', p_date)
  )
ORDER BY version DESC
LIMIT 1;
RETURN v_term_id;
```

#### `validate_payment_term_period()`
> Trigger que valida la consistencia entre `term_id` y `period_date` en pagos.

```sql
CREATE OR REPLACE FUNCTION validate_payment_term_period()
RETURNS TRIGGER AS $$
DECLARE
    v_correct_term_id UUID;
BEGIN
    v_correct_term_id := get_active_term(NEW.commitment_id, NEW.period_date);

    IF v_correct_term_id IS NULL THEN
        RAISE EXCEPTION 'No hay término activo para el período %. Este mes está pausado o fuera del rango del compromiso.',
            NEW.period_date
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.term_id != v_correct_term_id THEN
        RAISE EXCEPTION 'El term_id (%) no coincide con el término que cubre el período % (correcto: %)',
            NEW.term_id, NEW.period_date, v_correct_term_id
        USING ERRCODE = 'P0002';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### `calculate_effective_until()`
```sql
-- Solo recalcula en INSERT o si cambiaron campos relevantes
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
    -- Calcula fecha final basado en installments
    NEW.effective_until := NEW.effective_from +
        ((NEW.installments_count - 1) * months_per_period * INTERVAL '1 month');
END IF;
```

---

## 2. Tablas

### 2.1 `profiles`

Configuración del usuario.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `user_id` | UUID | NO | - | PK, FK → auth.users |
| `base_currency` | TEXT | NO | 'CLP' | Moneda base del usuario |
| `locale` | TEXT | NO | 'es-CL' | Configuración regional |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado |

---

### 2.2 `categories_v2`

Categorías de gastos/ingresos.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | YES | - | FK → auth.users, NULL para globales |
| `name` | TEXT | NO | - | Nombre visible |
| `normalized_name` | TEXT | YES | - | Nombre normalizado (trigger) |
| `is_global` | BOOLEAN | NO | FALSE | Si es categoría del sistema |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraint**: `categories_v2_unique_per_user` UNIQUE(user_id, normalized_name)

---

### 2.3 `commitments`

Compromisos financieros (gastos o ingresos recurrentes).

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → auth.users |
| `category_id` | UUID | YES | - | FK → categories_v2 |
| `name` | TEXT | NO | - | Nombre del compromiso |
| `flow_type` | TEXT | NO | - | 'EXPENSE' o 'INCOME' |
| `is_important` | BOOLEAN | NO | FALSE | Marcado como importante |
| `notes` | TEXT | YES | - | Notas adicionales |
| `linked_commitment_id` | UUID | YES | - | FK → commitments |
| `link_role` | TEXT | YES | - | 'PRIMARY' o 'SECONDARY' |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado |

**CHECK constraints**:
- `commitments_flow_type_check`: `flow_type IN ('EXPENSE', 'INCOME')`
- `commitments_link_role_check`: `link_role IN ('PRIMARY', 'SECONDARY')`

---

### 2.4 `terms`

Versiones/condiciones de un compromiso.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `commitment_id` | UUID | NO | - | FK → commitments (CASCADE) |
| `version` | INTEGER | NO | 1 | Número de versión |
| `effective_from` | DATE | NO | - | Fecha inicio de vigencia |
| `effective_until` | DATE | YES | - | Fecha fin (NULL = indefinido) |
| `frequency` | TEXT | NO | - | Frecuencia de pago |
| `installments_count` | INTEGER | YES | - | Número de cuotas |
| `due_day_of_month` | INTEGER | YES | - | Día de vencimiento (1-31) |
| `currency_original` | TEXT | NO | - | Moneda original |
| `amount_original` | NUMERIC(15,2) | NO | - | Monto en moneda original |
| `fx_rate_to_base` | NUMERIC(15,6) | NO | 1.0 | Tasa de cambio |
| `amount_in_base` | NUMERIC(15,2) | YES | - | Monto en CLP (calculado) |
| `estimation_mode` | TEXT | YES | - | 'FIXED', 'AVERAGE', 'LAST' |
| `is_divided_amount` | BOOLEAN | YES | FALSE | TRUE = divide monto entre cuotas |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado |

**Constraints**:
- `terms_unique_version`: UNIQUE(commitment_id, version)

**CHECK constraints**:
- `terms_due_day_of_month_check`: `due_day_of_month >= 1 AND due_day_of_month <= 31`
- `terms_frequency_check`: `frequency IN ('ONCE', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY')`
- `terms_estimation_mode_check`: `estimation_mode IN ('FIXED', 'AVERAGE', 'LAST')`

---

### 2.5 `payments`

Pagos realizados para un período específico.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `commitment_id` | UUID | NO | - | FK → commitments (CASCADE) |
| `term_id` | UUID | NO | - | FK → terms (CASCADE) |
| `period_date` | DATE | NO | - | Período (YYYY-MM-01) |
| `payment_date` | DATE | YES | - | Fecha real de pago |
| `currency_original` | TEXT | NO | - | Moneda del pago |
| `amount_original` | NUMERIC(15,2) | NO | - | Monto pagado |
| `fx_rate_to_base` | NUMERIC(15,6) | NO | 1.0 | Tasa de cambio |
| `amount_in_base` | NUMERIC(15,2) | YES | - | Monto en CLP (trigger) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraint**: `payments_unique_period` UNIQUE(commitment_id, period_date)

---

### 2.6 `exchange_rates`

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

**Constraint**: `exchange_rates_unique_rate` UNIQUE(from_currency, to_currency, effective_date)

---

### 2.7 `payment_adjustments`

Audit trail de reasignación de pagos.

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
| `adjusted_by` | UUID | YES | - | FK → auth.users |

---

## 3. Triggers

### Por Tabla

| Tabla | Trigger | Evento | Función |
|-------|---------|--------|---------|
| **profiles** | update_profiles_updated_at | BEFORE UPDATE | update_updated_at_column() |
| **categories_v2** | update_categories_v2_updated_at | BEFORE UPDATE | update_updated_at_column() |
| **categories_v2** | normalize_category_v2_name | BEFORE INSERT OR UPDATE | normalize_category_name() |
| **commitments** | update_commitments_updated_at | BEFORE UPDATE | update_updated_at_column() |
| **terms** | update_terms_updated_at | BEFORE UPDATE | update_updated_at_column() |
| **terms** | calculate_terms_amount_in_base | BEFORE INSERT OR UPDATE | calculate_amount_in_base() |
| **terms** | calculate_effective_until_trigger | BEFORE INSERT OR UPDATE | calculate_effective_until() |
| **payments** | update_payments_updated_at | BEFORE UPDATE | update_updated_at_column() |
| **payments** | calculate_payments_amount_in_base | BEFORE INSERT OR UPDATE | calculate_amount_in_base() |
| **payments** | validate_payment_term | BEFORE INSERT OR UPDATE | validate_payment_term_period() |

---

## 4. Índices

### categories_v2
- `idx_categories_v2_user_id` ON (user_id)
- `idx_categories_v2_normalized_name` ON (normalized_name)

### commitments
- `idx_commitments_user_id` ON (user_id)
- `idx_commitments_category_id` ON (category_id)
- `idx_commitments_linked_commitment_id` ON (linked_commitment_id)

### terms
- `idx_terms_commitment_id` ON (commitment_id)
- `idx_terms_effective_from` ON (effective_from)
- `idx_terms_effective_until` ON (effective_until)

### payments
- `idx_payments_commitment_id` ON (commitment_id)
- `idx_payments_term_id` ON (term_id)
- `idx_payments_period_date` ON (period_date)
- `idx_payments_payment_date` ON (payment_date)

### exchange_rates
- `idx_exchange_rates_currencies` ON (from_currency, to_currency, effective_date DESC)

---

## 5. Row Level Security (RLS)

Todas las tablas tienen RLS habilitado.

### profiles
- SELECT/INSERT/UPDATE: `auth.uid() = user_id`

### categories_v2
- SELECT: `user_id = auth.uid() OR is_global = TRUE`
- INSERT: `user_id = auth.uid() AND is_global = FALSE`
- UPDATE/DELETE: `user_id = auth.uid() AND is_global = FALSE`

### commitments
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`

### terms, payments
- Todas las operaciones verifican que el `commitment_id` pertenezca al usuario:
```sql
EXISTS (
  SELECT 1 FROM commitments
  WHERE commitments.id = terms.commitment_id
  AND commitments.user_id = auth.uid()
)
```

### exchange_rates
- SELECT: Cualquier usuario autenticado

### payment_adjustments
- Usuarios solo ven ajustes de sus propios pagos (via JOIN con commitments)

---

## 6. CHECK Constraints Completos

| Tabla | Constraint | Expresión |
|-------|------------|-----------|
| commitments | commitments_flow_type_check | `flow_type IN ('EXPENSE', 'INCOME')` |
| commitments | commitments_link_role_check | `link_role IN ('PRIMARY', 'SECONDARY')` |
| terms | terms_due_day_of_month_check | `due_day_of_month >= 1 AND due_day_of_month <= 31` |
| terms | terms_frequency_check | `frequency IN ('ONCE', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY')` |
| terms | terms_estimation_mode_check | `estimation_mode IN ('FIXED', 'AVERAGE', 'LAST')` |

---

### 2.8 `goals`

Metas de ahorro (Smart Buckets).

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK → auth.users |
| `name` | TEXT | NO | - | Nombre de la meta |
| `target_amount` | NUMERIC(15,2) | YES | - | Monto objetivo (NULL = sin límite) |
| `current_amount` | NUMERIC(15,2) | NO | 0 | Monto acumulado |
| `target_date` | DATE | YES | - | Fecha límite |
| `icon` | TEXT | YES | - | Emoji o nombre de ícono |
| `color` | TEXT | YES | - | Código hex |
| `is_archived` | BOOLEAN | NO | FALSE | Si está archivada |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-actualizado |

**RLS**: Solo el dueño puede ver/modificar sus metas.

---

## 7. Historial de Cambios

### 2026-01-07 (v2): Nueva lógica de edición de términos

**Cambio de diseño**: Los términos ahora son completamente editables (fechas, montos, todo).
Los pagos se reasignan automáticamente al término correcto según su `period_date`.

**Principios clave**:
1. `period_date` es **INMUTABLE** - un pago siempre pertenece a su período original
2. `term_id` es **DERIVADO** - se recalcula cuando cambian los términos
3. Términos no pueden **superponerse** - validación en frontend
4. Gaps (pausas) están **permitidos** - meses sin término

**Flujo de edición**:
```
1. Usuario edita términos en el modal
2. Frontend valida no-superposición
3. Se guardan términos (UPDATE/INSERT/DELETE)
4. Se reasignan pagos: payment.term_id = get_active_term(period_date)
5. Trigger valida que term_id sea correcto
```

**Archivos modificados**:
- `components/CommitmentForm.v2.tsx` - Modal con vista de términos editables
- `components/ExpenseCommitmentFormWrapper.tsx` - Lógica de guardado y reasignación
- `utils/termUtils.ts` - Funciones de validación de términos

---

### 2026-01-07 (v1): Fix de comparación de fechas + Trigger de validación

**Problema resuelto**: La función `get_active_term()` comparaba fechas exactas (día incluido),
lo que causaba que pagos para un período no encontraran el term correcto cuando `effective_from`
era un día distinto al 1 del mes.

**Archivos de migración**:
- `016_validate_payment_term.sql` - Trigger de validación term↔period
- `017_fix_date_comparison.sql` - Fix de comparación usando DATE_TRUNC('month', ...)

**Componentes agregados**:
| Componente | Tipo | Descripción |
|------------|------|-------------|
| `validate_payment_term_period()` | Función | Valida consistencia term_id ↔ period_date |
| `validate_payment_term` | Trigger | Ejecuta validación en INSERT/UPDATE de payments |
| Fix `get_active_term()` | Actualización | Ahora compara a nivel de MES, no día |

---

## 8. Queries de Auditoría

Ejecutar estas queries en Supabase SQL Editor para verificar el estado actual.

### Ver todas las funciones
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### Ver todos los triggers
```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### Ver todas las tablas
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Ver constraints
```sql
SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
```

### Ver CHECK constraints
```sql
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name;
```

### Ver índices
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Ver políticas RLS
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 9. Notas de Mantenimiento

1. **Al agregar nuevos campos**: Actualizar este documento y `docs/BACKEND_SPECS.md`
2. **Al agregar triggers/funciones**: Documentar aquí con el código SQL
3. **Al modificar constraints**: Verificar que no afecte datos existentes
4. **Antes de deployar migraciones**: Ejecutar queries de auditoría para verificar estado
