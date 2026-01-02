-- =====================================================
-- Migración 011: Features de Ahorro Inteligente
-- =====================================================
-- Agrega:
-- 1. Configuración de regla presupuestaria a profiles (50/30/20)
-- 2. Tipo de presupuesto a categorías (NEED/WANT/SAVING)
-- 3. Tabla de metas de ahorro (goals)
-- =====================================================

-- 1. Agregar configuración de regla presupuestaria a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_needs_pct NUMERIC(5,2) DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_wants_pct NUMERIC(5,2) DEFAULT 30;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_savings_pct NUMERIC(5,2) DEFAULT 20;

COMMENT ON COLUMN profiles.budget_needs_pct IS 'Porcentaje del ingreso para Necesidades (default 50%)';
COMMENT ON COLUMN profiles.budget_wants_pct IS 'Porcentaje del ingreso para Deseos (default 30%)';
COMMENT ON COLUMN profiles.budget_savings_pct IS 'Porcentaje del ingreso para Ahorro (default 20%)';

-- 2. Agregar tipo de presupuesto a categorías
ALTER TABLE categories_v2 ADD COLUMN IF NOT EXISTS budget_type TEXT DEFAULT NULL;

COMMENT ON COLUMN categories_v2.budget_type IS 'Tipo de presupuesto: NEED, WANT, SAVING, o NULL (sin clasificar)';

-- Clasificar categorías globales existentes
UPDATE categories_v2 SET budget_type = 'NEED'
WHERE is_global = TRUE AND normalized_name IN (
    'vivienda', 'transporte', 'alimentación', 'alimentacion',
    'salud', 'servicios', 'educación', 'educacion'
);

UPDATE categories_v2 SET budget_type = 'WANT'
WHERE is_global = TRUE AND normalized_name IN ('entretenimiento');

UPDATE categories_v2 SET budget_type = 'SAVING'
WHERE is_global = TRUE AND normalized_name IN ('inversiones');

-- 3. Crear tabla de metas de ahorro
CREATE TABLE IF NOT EXISTS goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(15,2),          -- NULL = meta sin límite
    current_amount NUMERIC(15,2) DEFAULT 0,
    target_date DATE,                      -- NULL = sin fecha límite
    priority INTEGER DEFAULT 0,            -- Para ordenar distribución
    icon TEXT,                             -- Emoji o nombre de ícono
    color TEXT,                            -- Código hex
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_archived ON goals(user_id, is_archived);

-- RLS para goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

CREATE POLICY "Users can view own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at en goals
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Verificación
-- =====================================================
SELECT
    'profiles' as tabla,
    COUNT(*) as columnas_budget
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name LIKE 'budget_%';

SELECT
    'categories_v2' as tabla,
    COUNT(*) as con_budget_type
FROM categories_v2
WHERE budget_type IS NOT NULL;

SELECT
    'goals' as tabla,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'goals') as existe;

-- ✅ Migración completada
