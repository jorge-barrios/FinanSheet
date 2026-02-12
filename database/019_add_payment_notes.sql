-- =====================================================
-- Migration 019: Add notes and due_date to payments
-- =====================================================
-- notes: Optional user annotation about the payment
-- due_date: Specific due date override. NULL = calculate from term.due_day_of_month
-- =====================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN payments.notes IS 'Nota opcional del usuario sobre el pago (máx 500 caracteres recomendado)';
COMMENT ON COLUMN payments.due_date IS 'Fecha de vencimiento específica. NULL = calcular desde term.due_day_of_month + period_date';
