-- =====================================================
-- Migración: Agregar campo is_divided_amount a terms
-- =====================================================
-- Este campo distingue entre:
-- - "Definido" (is_divided_amount = false): monto fijo por período
-- - "En cuotas" (is_divided_amount = true): monto total dividido entre cuotas
-- =====================================================

-- Agregar columna
ALTER TABLE terms ADD COLUMN IF NOT EXISTS is_divided_amount BOOLEAN DEFAULT FALSE;

-- Comentario descriptivo
COMMENT ON COLUMN terms.is_divided_amount IS
  'true = "En cuotas" (monto total se divide entre installments_count), false = "Definido" (monto por período)';

-- ✅ Migración completada
-- Ejecutar en Supabase Dashboard → SQL Editor
