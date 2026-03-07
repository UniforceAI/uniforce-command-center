-- ============================================================================
-- MIGRATION: Fix get_isp_stripe_data type mismatch + add missing columns
-- Projeto: yqdqmudsnjhixtxldqwi
-- Data: 2026-03-07
-- Problema: isp_id declarado como TEXT mas na tabela é VARCHAR(50) — erro 42804
-- Também: função não retornava stripe_billing_source e stripe_test_customer_id
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_isp_stripe_data();

CREATE OR REPLACE FUNCTION public.get_isp_stripe_data()
  RETURNS TABLE (
    isp_id                      VARCHAR(50),
    stripe_customer_id          TEXT,
    stripe_test_customer_id     TEXT,
    stripe_subscription_id      TEXT,
    stripe_subscription_status  TEXT,
    stripe_product_id           TEXT,
    stripe_price_id             TEXT,
    stripe_product_name         TEXT,
    stripe_monthly_amount       NUMERIC,
    stripe_current_period_start TIMESTAMPTZ,
    stripe_current_period_end   TIMESTAMPTZ,
    stripe_cancel_at_period_end BOOLEAN,
    stripe_trial_end            TIMESTAMPTZ,
    stripe_billing_source       TEXT
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  STABLE
  SET search_path TO 'public'
AS $$
DECLARE
  _isp_id VARCHAR(50);
BEGIN
  _isp_id := public.current_user_isp_id();

  IF _isp_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      i.isp_id,
      i.stripe_customer_id,
      i.stripe_test_customer_id,
      i.stripe_subscription_id,
      i.stripe_subscription_status,
      i.stripe_product_id,
      i.stripe_price_id,
      i.stripe_product_name,
      i.stripe_monthly_amount,
      i.stripe_current_period_start,
      i.stripe_current_period_end,
      i.stripe_cancel_at_period_end,
      i.stripe_trial_end,
      i.stripe_billing_source
    FROM public.isps i
    WHERE i.isp_id = _isp_id;
END;
$$;

COMMENT ON FUNCTION public.get_isp_stripe_data IS 'Retorna dados de billing Stripe do ISP do usuário autenticado. SECURITY DEFINER. v2: tipos corrigidos + billing_source + test_customer_id.';
