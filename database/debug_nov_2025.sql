-- =====================================================
-- Query de Diagnóstico: Gastos de Noviembre 2025
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Objetivo: Encontrar qué compromisos están sumando $27.877.884 en Nov 2025

SELECT 
  c.name as "Compromiso",
  c.flow_type as "Tipo",
  cat.name as "Categoría",
  t.amount_in_base as "Monto Base",
  t.amount_original as "Monto Original",
  t.currency_original as "Moneda",
  t.installments_count as "Cuotas",
  t.frequency as "Frecuencia",
  t.effective_from as "Desde",
  t.effective_until as "Hasta",
  t.version as "Versión",
  -- Calcular si aplica en Nov 2025
  CASE 
    WHEN t.effective_from <= '2025-11-01' 
         AND (t.effective_until IS NULL OR t.effective_until >= '2025-11-01')
    THEN '✅ ACTIVO EN NOV'
    ELSE '❌ No aplica'
  END as "Estado Nov 2025",
  -- Monto por período (si es en cuotas)
  CASE 
    WHEN t.installments_count > 1 
    THEN ROUND(t.amount_in_base / t.installments_count, 0)
    ELSE t.amount_in_base
  END as "Monto por Período"
FROM commitments c
JOIN terms t ON c.id = t.commitment_id
LEFT JOIN categories_v2 cat ON c.category_id = cat.id
WHERE 
  -- Solo compromisos que podrían aplicar en Nov 2025
  t.effective_from <= '2025-11-30'
  AND (t.effective_until IS NULL OR t.effective_until >= '2025-11-01')
  AND c.flow_type = 'EXPENSE'  -- Solo gastos
ORDER BY 
  -- Ordenar por monto descendente para ver el más grande primero
  CASE 
    WHEN t.installments_count > 1 
    THEN t.amount_in_base / t.installments_count
    ELSE t.amount_in_base
  END DESC;

-- =====================================================
-- Query Simplificada: Suma Total
-- =====================================================

SELECT 
  SUM(
    CASE 
      WHEN t.installments_count > 1 
      THEN t.amount_in_base / t.installments_count
      ELSE t.amount_in_base
    END
  ) as "Total Gastos Nov 2025 (Esperado)"
FROM commitments c
JOIN terms t ON c.id = t.commitment_id
WHERE 
  c.flow_type = 'EXPENSE'
  AND t.effective_from <= '2025-11-01'
  AND (t.effective_until IS NULL OR t.effective_until >= '2025-11-01')
  -- Filtrar por frecuencia si es necesario
  AND (
    t.frequency = 'MONTHLY'
    OR t.frequency = 'ONCE'
    -- Agregar otras frecuencias según apliquen
  );

-- =====================================================
-- Query: Buscar Montos Sospechosos (> $5M)
-- =====================================================

SELECT 
  c.name,
  t.amount_in_base,
  t.amount_original,
  t.currency_original,
  t.created_at,
  c.notes
FROM commitments c
JOIN terms t ON c.id = t.commitment_id
WHERE 
  t.amount_in_base > 5000000  -- Más de $5M
ORDER BY t.amount_in_base DESC;
