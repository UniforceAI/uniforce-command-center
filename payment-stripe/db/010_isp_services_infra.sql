-- 010_isp_services_infra.sql
-- Infraestrutura de controle de produtos contratados e períodos de compromisso
-- Execute via Supabase Dashboard → SQL Editor

-- ─── 1. Novas colunas em isps (commitment tracking) ──────────────────────────
ALTER TABLE public.isps
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,  -- data do 1º checkout (nunca sobrescrita)
  ADD COLUMN IF NOT EXISTS last_agent_change_at    TIMESTAMPTZ;  -- última troca de agente de automação

-- ─── 2. Tabela central de produtos contratados ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.isp_subscription_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isp_id                 TEXT NOT NULL REFERENCES public.isps(isp_id),
  stripe_subscription_id TEXT NOT NULL,                           -- ID Stripe OU ID Asaas subscription
  product_id             TEXT NOT NULL,                           -- Stripe product ID
  product_name           TEXT NOT NULL,
  product_type           TEXT NOT NULL CHECK (product_type IN ('plan','addon')),
  billing_source         TEXT NOT NULL DEFAULT 'stripe',          -- 'stripe' | 'asaas'
  status                 TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','cancel_scheduled','canceled')),
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commitment_ends_at     TIMESTAMPTZ,                              -- started_at + 3 months (set on insert/update via trigger)
  cancel_at              TIMESTAMPTZ,    -- data efetiva de cancelamento (agendado ou imediato)
  canceled_at            TIMESTAMPTZ,    -- quando o cancelamento se tornou efetivo
  monthly_amount         NUMERIC(10,2),
  currency               TEXT DEFAULT 'BRL',
  is_test_mode           BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stripe_subscription_id, product_id)
);

ALTER TABLE public.isp_subscription_items ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS ───────────────────────────────────────────────────────────────────
CREATE POLICY "super_admin_all_subscription_items"
  ON public.isp_subscription_items FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_manage_own_isp_subscription_items"
  ON public.isp_subscription_items FOR ALL TO authenticated
  USING (
    isp_id = public.current_user_isp_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin')
    )
  );

CREATE POLICY "isp_read_own_subscription_items"
  ON public.isp_subscription_items FOR SELECT TO authenticated
  USING (isp_id = public.current_user_isp_id());

-- ─── 3b. Trigger para preencher commitment_ends_at automaticamente ───────────
CREATE OR REPLACE FUNCTION public.set_commitment_ends_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.commitment_ends_at := NEW.started_at + INTERVAL '3 months';
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commitment_ends_at
  BEFORE INSERT OR UPDATE OF started_at ON public.isp_subscription_items
  FOR EACH ROW EXECUTE FUNCTION public.set_commitment_ends_at();

-- ─── 4. Índices ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_isp_sub_items_isp_id ON public.isp_subscription_items (isp_id);
CREATE INDEX IF NOT EXISTS idx_isp_sub_items_status ON public.isp_subscription_items (isp_id, status);

-- ─── 5. SECURITY DEFINER para meta do ISP autenticado ────────────────────────
CREATE OR REPLACE FUNCTION public.get_isp_service_meta()
  RETURNS TABLE (
    isp_id                  VARCHAR(50),
    subscription_started_at TIMESTAMPTZ,
    last_agent_change_at    TIMESTAMPTZ,
    stripe_billing_source   TEXT
  )
  LANGUAGE plpgsql SECURITY DEFINER STABLE
  SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT i.isp_id, i.subscription_started_at, i.last_agent_change_at, i.stripe_billing_source
    FROM public.isps i
    WHERE i.isp_id = public.current_user_isp_id();
END;
$$;
