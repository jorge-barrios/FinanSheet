-- =====================================================
-- Query de Verificación: effective_until
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Este query verifica si effective_until está calculado correctamente
-- para compromisos con installments definidos

SELECT 
  c.name as "Compromiso",
  t.frequency as "Frecuencia",
  t.installments_count as "Nº Cuotas",
  t.effective_from as "Inicio",
  t.effective_until as "Fin",
  -- Calcular diferencia en meses
  (EXTRACT(YEAR FROM AGE(t.effective_until, t.effective_from)) * 12 +
   EXTRACT(MONTH FROM AGE(t.effective_until, t.effective_from))) as "Meses Diferencia",
  -- Calcular meses esperados según frecuencia
  CASE t.frequency
    WHEN 'ONCE' THEN 0  -- ONCE no tiene crecimiento de meses
    WHEN 'MONTHLY' THEN (t.installments_count - 1)
    WHEN 'BIMONTHLY' THEN (t.installments_count - 1) * 2
    WHEN 'QUARTERLY' THEN (t.installments_count - 1) * 3
    WHEN 'SEMIANNUALLY' THEN (t.installments_count - 1) * 6
    WHEN 'ANNUALLY' THEN (t.installments_count - 1) * 12
    ELSE NULL
  END as "Meses Esperados",
  -- Validación
  CASE 
    WHEN (EXTRACT(YEAR FROM AGE(t.effective_until, t.effective_from)) * 12 +
          EXTRACT(MONTH FROM AGE(t.effective_until, t.effective_from))) = 
         CASE t.frequency
           WHEN 'ONCE' THEN 0
           WHEN 'MONTHLY' THEN (t.installments_count - 1)
           WHEN 'BIMONTHLY' THEN (t.installments_count - 1) * 2
           WHEN 'QUARTERLY' THEN (t.installments_count - 1) * 3
           WHEN 'SEMIANNUALLY' THEN (t.installments_count - 1) * 6
           WHEN 'ANNUALLY' THEN (t.installments_count - 1) * 12
           ELSE NULL
         END
    THEN '✅ CORRECTO'
    ELSE '❌ INCORRECTO'
  END as "Estado"
FROM commitments c
JOIN terms t ON c.id = t.commitment_id
WHERE t.installments_count IS NOT NULL  -- Solo compromisos con cuotas definidas
  AND t.effective_until IS NOT NULL     -- Excluir indefinidos
ORDER BY 
  CASE 
    WHEN (EXTRACT(YEAR FROM AGE(t.effective_until, t.effective_from)) * 12 +
          EXTRACT(MONTH FROM AGE(t.effective_until, t.effective_from))) != 
         CASE t.frequency
           WHEN 'ONCE' THEN 0
           WHEN 'MONTHLY' THEN (t.installments_count - 1)
           WHEN 'BIMONTHLY' THEN (t.installments_count - 1) * 2
           WHEN 'QUARTERLY' THEN (t.installments_count - 1) * 3
           WHEN 'SEMIANNUALLY' THEN (t.installments_count - 1) * 6
           WHEN 'ANNUALLY' THEN (t.installments_count - 1) * 12
           ELSE NULL
         END
    THEN 0  -- Mostrar incorrectos primero
    ELSE 1
  END,
  c.created_at DESC;

-- =====================================================
-- Resumen de resultados esperados:
-- =====================================================
-- Si el script de migración ESTÁ CORREGIDO:
--   → Todos los registros mostrarán "✅ CORRECTO"
--
-- Si el script de migración NO está corregido:
--   → Verás "❌ INCORRECTO" 
--   → "Meses Diferencia" será 1 más que "Meses Esperados"
--
-- Ejemplo:
--   12 cuotas mensuales desde 2025-12-01
--   → Correcto: effective_until = 2026-11-01 (11 meses diferencia)
--   → Incorrecto: effective_until = 2026-12-01 (12 meses diferencia)
-- =====================================================
