# Plan: Sistema de Ahorro Inteligente

> Feature para agregar análisis de salud financiera y metas de ahorro al Dashboard.
> Enfoque: Simple, no invasivo, integrado con lo existente.

---

## Resumen

| Característica | Decisión |
|----------------|----------|
| Porcentajes configurables | ✅ En perfil de usuario (default 50/30/20) |
| Historial de contribuciones | ❌ No (mantener simple) |
| Sección separada de Goals | ❌ No, widget en Dashboard |
| Wizard obligatorio | ❌ No, solo sugerencias |
| Clasificación automática | ✅ Por categoría (NEED/WANT/SAVING) |

---

## Fase 1: Base de Datos

### 1.1 Migración: `011_add_savings_features.sql`

```sql
-- =====================================================
-- Migración: Agregar features de ahorro
-- =====================================================

-- 1. Agregar configuración de regla presupuestaria a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_needs_pct NUMERIC(5,2) DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_wants_pct NUMERIC(5,2) DEFAULT 30;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_savings_pct NUMERIC(5,2) DEFAULT 20;

-- 2. Agregar tipo de presupuesto a categorías
ALTER TABLE categories_v2 ADD COLUMN IF NOT EXISTS budget_type TEXT DEFAULT NULL;
-- Valores: 'NEED', 'WANT', 'SAVING', NULL (sin clasificar)

-- Clasificar categorías globales existentes
UPDATE categories_v2 SET budget_type = 'NEED' WHERE is_global = TRUE AND normalized_name IN ('vivienda', 'transporte', 'alimentación', 'salud', 'servicios', 'educación');
UPDATE categories_v2 SET budget_type = 'WANT' WHERE is_global = TRUE AND normalized_name IN ('entretenimiento');
UPDATE categories_v2 SET budget_type = 'SAVING' WHERE is_global = TRUE AND normalized_name IN ('inversiones');

-- 3. Crear tabla de metas de ahorro
CREATE TABLE IF NOT EXISTS goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(15,2),          -- NULL = meta sin límite
    current_amount NUMERIC(15,2) DEFAULT 0,
    target_date DATE,                      -- NULL = sin fecha límite
    priority INTEGER DEFAULT 0,            -- Para ordenar
    icon TEXT,                             -- Emoji o nombre de ícono
    color TEXT,                            -- Código hex
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_archived ON goals(user_id, is_archived);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Fase 2: Tipos TypeScript

### 2.1 Actualizar `types.v2.ts`

```typescript
// Ya existe Goal, agregar:

export type BudgetType = 'NEED' | 'WANT' | 'SAVING';

// Actualizar Category para incluir budget_type
export interface Category {
    // ... campos existentes
    budget_type: BudgetType | null;
}

// Actualizar Profile
export interface Profile {
    // ... campos existentes
    budget_needs_pct: number;
    budget_wants_pct: number;
    budget_savings_pct: number;
}

// Nuevo: Resultado del análisis financiero
export interface FinancialHealthAnalysis {
    period: { year: number; month: number };
    income: number;

    // Distribución real
    actual: {
        needs: number;
        wants: number;
        savings: number;
        unclassified: number;
    };

    // Distribución objetivo (según regla del usuario)
    target: {
        needs: number;
        wants: number;
        savings: number;
    };

    // Diferencias (positivo = gastaste más de lo debido)
    diff: {
        needs: number;      // ej: +80,000 = gastaste 80k de más en necesidades
        wants: number;
        savings: number;    // negativo = ahorraste menos de lo debido
    };

    // Sugerencia textual
    suggestion: string | null;
}
```

---

## Fase 3: Lógica de Negocio

### 3.1 Nuevo archivo: `utils/budgetAnalysis.ts`

```typescript
import { CommitmentWithTerm, Category, BudgetType, FinancialHealthAnalysis } from '../types.v2';

/**
 * Calcula la distribución 50/30/20 objetivo
 */
export function calculateTargetDistribution(
    income: number,
    needsPct: number = 50,
    wantsPct: number = 30,
    savingsPct: number = 20
): { needs: number; wants: number; savings: number } {
    return {
        needs: income * (needsPct / 100),
        wants: income * (wantsPct / 100),
        savings: income * (savingsPct / 100),
    };
}

/**
 * Clasifica gastos del mes según categoría
 */
export function classifyExpensesByBudgetType(
    commitments: CommitmentWithTerm[],
    categories: Category[],
    monthlyExpenses: Map<string, number> // commitment_id -> amount
): { needs: number; wants: number; savings: number; unclassified: number } {
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    let needs = 0, wants = 0, savings = 0, unclassified = 0;

    monthlyExpenses.forEach((amount, commitmentId) => {
        const commitment = commitments.find(c => c.id === commitmentId);
        if (!commitment) return;

        const category = commitment.category_id ? categoryMap.get(commitment.category_id) : null;
        const budgetType = category?.budget_type;

        switch (budgetType) {
            case 'NEED': needs += amount; break;
            case 'WANT': wants += amount; break;
            case 'SAVING': savings += amount; break;
            default: unclassified += amount;
        }
    });

    return { needs, wants, savings, unclassified };
}

/**
 * Analiza la salud financiera del mes
 */
export function analyzeFinancialHealth(
    income: number,
    actualDistribution: { needs: number; wants: number; savings: number; unclassified: number },
    userRule: { needsPct: number; wantsPct: number; savingsPct: number }
): FinancialHealthAnalysis {
    const target = calculateTargetDistribution(income, userRule.needsPct, userRule.wantsPct, userRule.savingsPct);

    const diff = {
        needs: actualDistribution.needs - target.needs,
        wants: actualDistribution.wants - target.wants,
        savings: actualDistribution.savings - target.savings,
    };

    // Generar sugerencia
    let suggestion: string | null = null;

    if (diff.savings < -10000) { // Ahorraste menos de lo debido (más de 10k)
        const deficit = Math.abs(diff.savings);
        if (diff.wants > 0) {
            suggestion = `Podrías ahorrar ${formatCurrency(deficit)} más reduciendo gastos en "Deseos"`;
        } else if (diff.needs > 0) {
            suggestion = `Tus gastos en "Necesidades" superan lo recomendado en ${formatCurrency(diff.needs)}`;
        }
    } else if (diff.savings > 50000) {
        suggestion = `¡Excelente! Estás ahorrando ${formatCurrency(diff.savings)} más de lo planificado`;
    }

    return {
        period: getCurrentPeriod(),
        income,
        actual: actualDistribution,
        target,
        diff,
        suggestion,
    };
}
```

---

## Fase 4: Componentes UI

### 4.1 Widget de Salud Financiera

**Ubicación**: Agregar al Dashboard.v2.tsx después del resumen mensual

```
┌─────────────────────────────────────────────────────┐
│  💡 Tu Salud Financiera - Diciembre 2025           │
│  ──────────────────────────────────────────────    │
│  Ingresos: $1,500,000                              │
│                                                     │
│  Necesidades  [■■■■■■■░░░] 58%  $870,000  ⚠️ +8%   │
│  Deseos       [■■■░░░░░░░] 28%  $420,000  ✓        │
│  Ahorro       [■■░░░░░░░░] 14%  $210,000  ⚠️ -6%   │
│                                                     │
│  💬 "Podrías ahorrar $90,000 más este mes"         │
│                                                     │
│  [⚙️ Configurar regla]                              │
└─────────────────────────────────────────────────────┘
```

### 4.2 Mini-cards de Metas

```
┌─────────────────────────────────────────────────────┐
│  🎯 Metas de Ahorro                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │ 🏦        │ │ ✈️        │ │           │        │
│  │ Emergencia│ │ Viaje     │ │  + Nueva  │        │
│  │ $500,000  │ │ $300,000  │ │   Meta    │        │
│  │ ━━━━━░░░░ │ │ ━━░░░░░░░ │ │           │        │
│  │ 60%       │ │ 25%       │ │           │        │
│  └───────────┘ └───────────┘ └───────────┘        │
└─────────────────────────────────────────────────────┘
```

---

## Fase 5: Orden de Implementación

1. **Migración SQL** - `011_add_savings_features.sql`
2. **Actualizar types.v2.ts** - Agregar BudgetType, actualizar Profile y Category
3. **Crear budgetAnalysis.ts** - Lógica de cálculo
4. **Crear GoalService** - CRUD para goals en dataService.v2.ts
5. **Componente FinancialHealthWidget** - Widget de análisis
6. **Componente GoalCard + GoalList** - Metas de ahorro
7. **Integrar en Dashboard.v2.tsx** - Agregar widgets
8. **Modal de configuración** - Editar porcentajes 50/30/20

---

## Notas de Implementación

- **No bloquear flujos existentes**: Los widgets son informativos, no obligatorios
- **Categorías sin clasificar**: Mostrar como "Sin clasificar" y sugerir al usuario que las clasifique
- **Goals simples**: Solo nombre, monto objetivo, monto actual, ícono y color
- **Sin wizard de income**: Solo mostrar sugerencias después de que el usuario tenga datos

---

## Dependencias

- Ninguna librería nueva requerida
- Usar componentes existentes de Tailwind/shadcn
- Progress bar se puede hacer con div y width dinámico
