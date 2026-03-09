-- ============================================================================
-- MIGRATION 012: Onboarding RLS fixes + SQL function corrections
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/yqdqmudsnjhixtxldqwi
-- ============================================================================

-- ============================================================================
-- FIX 1: Adicionar política RLS de UPDATE na tabela isps para ISP admins
--
-- Problema: client-side writes para contract_accepted_at (Step3 onboarding)
-- e financial_email (FinancialProfileBanner) falhavam silenciosamente porque
-- só existia política SELECT para usuários não-super_admin.
-- ============================================================================

DROP POLICY IF EXISTS "isp_admin_update_own_isp" ON public.isps;
CREATE POLICY "isp_admin_update_own_isp"
  ON public.isps
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.isp_id  = isps.isp_id
        AND ur.role    IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.isp_id  = isps.isp_id
        AND ur.role    IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- FIX 2: Corrigir create_isp_onboarding() — ON CONFLICT na tabela user_roles
--
-- Problema: ON CONFLICT (user_id) não tem unique constraint correspondente.
-- A constraint real é UNIQUE (user_id, isp_id, role).
-- Para novos usuários a inserção sempre funciona (sem conflito), mas para
-- reexecuções ou usuários com role pré-existente o ON CONFLICT falha.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_isp_onboarding(
  p_isp_nome        TEXT,
  p_cnpj            TEXT,
  p_instancia_isp   TEXT,
  p_erp_base_url    TEXT,
  p_erp_credentials JSONB,
  p_user_id         UUID
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
  -- ON CONFLICT usa a constraint real UNIQUE (user_id, isp_id, role)
  INSERT INTO public.user_roles (user_id, role, isp_id)
  VALUES (p_user_id, 'admin', _isp_id)
  ON CONFLICT (user_id, isp_id, role) DO NOTHING;

  RETURN QUERY SELECT _isp_id, p_isp_nome;
END;
$$;

COMMENT ON FUNCTION public.create_isp_onboarding IS
  'Cria um novo ISP durante o onboarding self-service. ON CONFLICT corrigido para (user_id, isp_id, role).';

-- ============================================================================
-- FIX 3: FK constraint em tos_acceptances.tos_version → terms_of_service(version)
--
-- Garante integridade do audit trail legal: não é possível registrar aceite
-- de uma versão de ToS que não existe na tabela terms_of_service.
-- ============================================================================

-- Só adicionar se ainda não existe (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tos_acceptances_tos_version_fkey'
      AND table_name = 'tos_acceptances'
  ) THEN
    ALTER TABLE public.tos_acceptances
      ADD CONSTRAINT tos_acceptances_tos_version_fkey
      FOREIGN KEY (tos_version)
      REFERENCES public.terms_of_service(version)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ============================================================================
-- FIX 4: Garantir que instancia_isp tem default vazio (idempotente)
-- Previne falha no trigger handle_new_user para usuários de domínio desconhecido
-- ============================================================================

ALTER TABLE public.profiles
  ALTER COLUMN instancia_isp SET DEFAULT '';

-- ============================================================================
-- VERIFICAÇÃO: rodar estas queries após aplicar e confirmar os resultados
-- ============================================================================
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='isps' ORDER BY policyname;
-- SELECT prosrc FROM pg_proc WHERE proname='create_isp_onboarding';
-- SELECT conname FROM pg_constraint WHERE conrelid='tos_acceptances'::regclass AND contype='f';
