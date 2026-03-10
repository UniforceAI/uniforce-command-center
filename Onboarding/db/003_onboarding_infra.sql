-- ============================================================================
-- MIGRATION: Onboarding Infrastructure
-- Projeto: yqdqmudsnjhixtxldqwi (Uniforce Dashboard)
-- Data: 2026-03-06
-- Descrição: Adiciona suporte a auto-cadastro de novos ISPs via fluxo de
--            onboarding: registro → ERP → pagamento → dashboard
-- ============================================================================
-- EXECUTAR NO: Supabase Studio > SQL Editor (após 001 e 002)
-- ============================================================================

-- ============================================================================
-- STEP 1: Adicionar coluna onboarding_status à tabela isps
-- ============================================================================

ALTER TABLE public.isps
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'complete',
  -- Valores: complete (ISPs existentes), pending, erp_configured, payment_pending
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ISPs existentes já estão completos
UPDATE public.isps
SET onboarding_status = 'complete',
    onboarding_completed_at = created_at
WHERE onboarding_status IS NULL OR onboarding_status = 'complete';

COMMENT ON COLUMN public.isps.onboarding_status IS 'Status do onboarding do ISP: pending | erp_configured | payment_pending | complete';
COMMENT ON COLUMN public.isps.onboarding_completed_at IS 'Data/hora em que o onboarding foi concluído (pagamento confirmado).';

-- Índice para filtrar ISPs ainda em onboarding
CREATE INDEX IF NOT EXISTS idx_isps_onboarding_status
  ON public.isps(onboarding_status) WHERE onboarding_status != 'complete';


-- ============================================================================
-- STEP 2: Função para criar novo ISP durante onboarding (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_isp_onboarding(
  p_isp_nome        TEXT,
  p_cnpj            TEXT,
  p_instancia_isp   TEXT,  -- 'ixc' | 'ispbox' | 'mk'
  p_erp_base_url    TEXT,
  p_erp_credentials JSONB,
  p_user_id         UUID   -- auth.uid() do usuário criador
)
  RETURNS TABLE (isp_id TEXT, isp_nome TEXT)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _isp_id TEXT;
  _slug   TEXT;
BEGIN
  -- Gerar slug único a partir do nome
  _slug := lower(regexp_replace(trim(p_isp_nome), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := regexp_replace(_slug, '^-|-$', '', 'g');

  -- Garantir unicidade do isp_id
  IF EXISTS (SELECT 1 FROM public.isps WHERE isps.isp_id = _slug) THEN
    _isp_id := _slug || '-' || floor(random() * 9000 + 1000)::TEXT;
  ELSE
    _isp_id := _slug;
  END IF;

  -- Criar registro do ISP
  INSERT INTO public.isps (
    isp_id, isp_nome, instancia_isp,
    erp_base_url, credentials,
    onboarding_status, ativo
  ) VALUES (
    _isp_id, p_isp_nome, p_instancia_isp,
    p_erp_base_url,
    jsonb_build_object(
      'cnpj', p_cnpj,
      'erp', p_erp_credentials
    ),
    'payment_pending', true
  );

  -- Vincular o perfil do usuário ao novo ISP
  UPDATE public.profiles
  SET
    isp_id        = _isp_id,
    instancia_isp = p_instancia_isp
  WHERE id = p_user_id;

  -- Garantir role 'admin' para o criador
  INSERT INTO public.user_roles (user_id, role, isp_id)
  VALUES (p_user_id, 'admin', _isp_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'admin', isp_id = _isp_id;

  RETURN QUERY SELECT _isp_id, p_isp_nome;
END;
$$;

COMMENT ON FUNCTION public.create_isp_onboarding IS 'Cria um novo ISP durante o onboarding de auto-cadastro. Chamada pelo Edge Function onboard-create-isp.';


-- ============================================================================
-- STEP 3: Função para concluir onboarding após pagamento confirmado
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_isp_onboarding(
  p_isp_id TEXT
)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _rows INTEGER;
BEGIN
  UPDATE public.isps
  SET
    onboarding_status       = 'complete',
    onboarding_completed_at = NOW()
  WHERE isp_id = p_isp_id
    AND onboarding_status = 'payment_pending';

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$$;

COMMENT ON FUNCTION public.complete_isp_onboarding IS 'Marca o onboarding como completo após confirmação de pagamento pelo stripe-webhook.';
