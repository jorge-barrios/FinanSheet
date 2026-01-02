-- =====================================================
-- Step 12: Add Payment Adjustments (Audit Trail)
-- =====================================================
-- Tracks changes to payment period_date when terms are modified
-- Preserves original period assignments for audit purposes
-- =====================================================

-- Create payment_adjustments table for audit trail
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  original_period_date DATE NOT NULL,
  new_period_date DATE NOT NULL,
  original_term_id UUID NOT NULL,
  new_term_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'term_effective_from_change',
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  adjusted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for quick lookups by payment
CREATE INDEX idx_payment_adjustments_payment_id ON payment_adjustments(payment_id);

-- Index for finding adjustments by date range
CREATE INDEX idx_payment_adjustments_adjusted_at ON payment_adjustments(adjusted_at);

-- RLS Policy: Users can only see adjustments for their own payments
ALTER TABLE payment_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_adjustments_select_policy ON payment_adjustments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN commitments c ON c.id = p.commitment_id
      WHERE p.id = payment_adjustments.payment_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY payment_adjustments_insert_policy ON payment_adjustments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN commitments c ON c.id = p.commitment_id
      WHERE p.id = payment_adjustments.payment_id
      AND c.user_id = auth.uid()
    )
  );

-- Comment for documentation
COMMENT ON TABLE payment_adjustments IS 'Audit trail for payment period reassignments when term effective_from changes';
COMMENT ON COLUMN payment_adjustments.reason IS 'Reason for adjustment: term_effective_from_change, manual_correction, etc.';
