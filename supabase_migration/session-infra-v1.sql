-- ============================================================
-- MIGRATION: Session Infrastructure v1
-- Projeto: yqdqmudsnjhixtxldqwi (Uniforce Dashboard)
-- Data: 2026-03-11
-- ============================================================
-- Cobertura:
--   1. Tabela isp_email_domains — gestão dinâmica de domínios (escalável, substituição definitiva do hardcode)
--   2. handle_new_user() reescrito para lookup dinâmico via tabela
--   3. Tabela isps: colunas billing_blocked + billing_blocked_since
--   4. Tabela user_filter_presets — presets de filtros salvos por usuário
--   5. RLS para todas as novas tabelas
--   6. Seed dos domínios existentes
-- ============================================================


-- ============================================================
-- PARTE 1 — isp_email_domains
-- Permite que cada ISP gerencie seus próprios domínios de email
-- sem necessidade de alteração de código ou trigger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.isp_email_domains (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  isp_id      varchar(50) NOT NULL REFERENCES public.isps(isp_id) ON DELETE CASCADE,
  domain      text        NOT NULL,           -- minúsculo, sem @  (ex: 'igpfibra.com')
  added_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT isp_email_domains_domain_key UNIQUE (domain)
);

COMMENT ON TABLE  public.isp_email_domains IS 'Domínios de email permitidos por ISP — controla o mapeamento automático no cadastro de usuários.';
COMMENT ON COLUMN public.isp_email_domains.domain IS 'Domínio em minúsculas sem @ (ex: igpfibra.com). UNIQUE: cada domínio pertence a exatamente um ISP.';

CREATE INDEX IF NOT EXISTS idx_isp_email_domains_isp_id ON public.isp_email_domains(isp_id);
CREATE INDEX IF NOT EXISTS idx_isp_email_domains_domain ON public.isp_email_domains(domain);

-- ── RLS para isp_email_domains ─────────────────────────────────────────────
ALTER TABLE public.isp_email_domains ENABLE ROW LEVEL SECURITY;

-- Super admins gerenciam todos os domínios
DROP POLICY IF EXISTS "super_admin_all_isp_email_domains" ON public.isp_email_domains;
CREATE POLICY "super_admin_all_isp_email_domains"
  ON public.isp_email_domains FOR ALL TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Admins de ISP gerenciam domínios do seu próprio ISP
DROP POLICY IF EXISTS "admin_manage_own_isp_domains" ON public.isp_email_domains;
CREATE POLICY "admin_manage_own_isp_domains"
  ON public.isp_email_domains FOR ALL TO authenticated
  USING  (isp_id = public.current_user_isp_id() AND public.is_admin())
  WITH CHECK (isp_id = public.current_user_isp_id() AND public.is_admin());

-- Usuários autenticados leem apenas domínios do próprio ISP
-- ATENÇÃO: USING(true) foi removido — exporia todos os domínios de todos os ISPs
DROP POLICY IF EXISTS "authenticated_read_isp_email_domains" ON public.isp_email_domains;
DROP POLICY IF EXISTS "users_read_own_isp_domains" ON public.isp_email_domains;
CREATE POLICY "users_read_own_isp_domains"
  ON public.isp_email_domains FOR SELECT TO authenticated
  USING (isp_id = public.current_user_isp_id() OR public.is_super_admin());

-- Funções de serviço (trigger, edge functions) precisam ler via service_role — sem RLS extra


-- ============================================================
-- PARTE 2 — Seed dos domínios existentes (idempotente)
-- ============================================================

INSERT INTO public.isp_email_domains (isp_id, domain) VALUES
  ('uniforce',    'uniforce.com.br'),
  ('agy-telecom', 'agytelecom.com.br'),
  ('agy-telecom', 'agy-telecom.com.br'),
  ('zen-telecom', 'zentelecom.com.br'),
  ('zen-telecom', 'zen-telecom.com.br'),
  ('d-kiros',     'd-kiros.com.br'),
  ('d-kiros',     'dkiros.com.br'),
  ('igp-fibra',   'igpfibra.com.br'),
  ('igp-fibra',   'igp-fibra.com.br'),
  ('igp-fibra',   'igpfibra.com')   -- domínio real usado pelos usuários do IGP Fibra
ON CONFLICT (domain) DO NOTHING;


-- ============================================================
-- PARTE 3 — Reescrever handle_new_user() com lookup dinâmico
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _email_domain  text;
  _isp_id        text;
  _instancia_isp text;
BEGIN
  -- Extrair domínio do email em minúsculas
  _email_domain := lower(split_part(NEW.email, '@', 2));

  -- Lookup dinâmico na tabela isp_email_domains
  -- (SECURITY DEFINER + search_path garante acesso mesmo com RLS ativo)
  SELECT d.isp_id, i.instancia_isp
    INTO _isp_id, _instancia_isp
    FROM public.isp_email_domains d
    JOIN public.isps i ON i.isp_id = d.isp_id
   WHERE d.domain = _email_domain
   LIMIT 1;

  -- Inserir perfil (isp_id NULL se domínio não cadastrado → admin atribuirá depois)
  INSERT INTO public.profiles (id, isp_id, instancia_isp, full_name, email)
  VALUES (
    NEW.id,
    _isp_id,                                          -- NULL se domínio não mapeado
    COALESCE(_instancia_isp, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Atribuir role 'admin' automaticamente apenas para domínio uniforce.com.br
  -- Os demais ISPs têm seus admins atribuídos manualmente após o cadastro
  IF _isp_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, isp_id, instancia_isp, role)
    VALUES (
      NEW.id,
      _isp_id,
      COALESCE(_instancia_isp, ''),
      CASE
        WHEN _isp_id = 'uniforce' THEN 'super_admin'::public.app_role
        ELSE 'viewer'::public.app_role
      END
    )
    ON CONFLICT (user_id, isp_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger AFTER INSERT em auth.users — cria profile e role inicial via lookup dinâmico em isp_email_domains. '
  'Domínios não cadastrados criam perfil sem isp_id (admin atribui posteriormente). '
  'Para adicionar novos domínios, INSERT em isp_email_domains — sem necessidade de alterar código.';


-- ============================================================
-- PARTE 4 — Tabela isps: colunas billing_blocked
-- ============================================================

ALTER TABLE public.isps
  ADD COLUMN IF NOT EXISTS billing_blocked        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_blocked_since  timestamptz;

COMMENT ON COLUMN public.isps.billing_blocked       IS 'true quando ISP tem fatura vencida há > 30 dias — acesso ao dashboard bloqueado (exceto super_admin).';
COMMENT ON COLUMN public.isps.billing_blocked_since IS 'Timestamp de quando billing_blocked foi setado para true pela última vez.';


-- ============================================================
-- PARTE 5 — Tabela user_filter_presets (Frente 7.3)
-- Presets de filtros salvos por usuário para uso recorrente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_filter_presets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isp_id      varchar(50) NOT NULL,
  page_key    text        NOT NULL,   -- ex: 'financeiro', 'clientes', 'crm'
  name        text        NOT NULL,   -- ex: 'Bloqueados Fibra 100'
  filters     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_global   boolean     NOT NULL DEFAULT false,  -- super_admin pode criar preset global por ISP
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_filter_presets IS 'Presets de filtros salvos por usuário por página. is_global=true permite super_admin criar presets compartilhados com todo o ISP.';

CREATE INDEX IF NOT EXISTS idx_user_filter_presets_user   ON public.user_filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filter_presets_isp    ON public.user_filter_presets(isp_id, page_key);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_user_filter_presets_updated_at ON public.user_filter_presets;
CREATE TRIGGER trg_user_filter_presets_updated_at
  BEFORE UPDATE ON public.user_filter_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS para user_filter_presets ──────────────────────────────────────────
ALTER TABLE public.user_filter_presets ENABLE ROW LEVEL SECURITY;

-- Super admin gerencia todos
DROP POLICY IF EXISTS "super_admin_all_filter_presets" ON public.user_filter_presets;
CREATE POLICY "super_admin_all_filter_presets"
  ON public.user_filter_presets FOR ALL TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Usuário vê e gerencia seus próprios presets
DROP POLICY IF EXISTS "user_own_filter_presets" ON public.user_filter_presets;
CREATE POLICY "user_own_filter_presets"
  ON public.user_filter_presets FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Todos os usuários do ISP podem ler presets globais do seu ISP
DROP POLICY IF EXISTS "isp_users_read_global_presets" ON public.user_filter_presets;
CREATE POLICY "isp_users_read_global_presets"
  ON public.user_filter_presets FOR SELECT TO authenticated
  USING (is_global = true AND isp_id = public.current_user_isp_id());


-- ============================================================
-- PARTE 6 — RPC get_isp_by_email_domain (SECURITY DEFINER)
-- Lookup de ISP por domínio de email sem depender de RLS
-- Necessário: (a) AuthContext domain fallback, (b) authUtils bootstrap pré-isp_id
-- Acessível por anon + authenticated (necessário antes do login completo)
-- IMPORTANTE: retornar todos os campos como text::text para evitar error 42804
-- (PostgREST espera text mas varchar(50) não faz cast implícito em RETURNS TABLE)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_isp_by_email_domain(text);
CREATE OR REPLACE FUNCTION public.get_isp_by_email_domain(p_domain text)
  RETURNS TABLE(isp_id text, isp_nome text, instancia_isp text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT
      d.isp_id::text,
      i.isp_nome::text,
      i.instancia_isp::text
    FROM public.isp_email_domains d
    JOIN public.isps i ON i.isp_id = d.isp_id
   WHERE d.domain = lower(p_domain)
   LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_isp_by_email_domain(text) IS
  'Retorna dados do ISP para o domínio de email informado. SECURITY DEFINER — bypassa RLS. '
  'Acessível por anon (necessário para domain lookup pré-autenticação). '
  'Todos os campos retornados como ::text para evitar type mismatch (error 42804) no PostgREST.';

GRANT EXECUTE ON FUNCTION public.get_isp_by_email_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_isp_by_email_domain(text) TO authenticated;


-- ============================================================
-- PARTE 7 — refresh_billing_blocked() + cron job
-- Bloqueia ISPs com billing_blocked_since há > 30 dias
-- Desbloqueio ocorre via webhook (asaas-webhook / stripe-webhook) ao receber pagamento
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_billing_blocked()
  RETURNS TABLE(isp_id text, action text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Bloquear ISPs com billing_blocked_since há > 30 dias que ainda não estão bloqueados
  RETURN QUERY
  WITH updated AS (
    UPDATE public.isps
       SET billing_blocked = true
     WHERE billing_blocked_since IS NOT NULL
       AND billing_blocked_since < now() - interval '30 days'
       AND billing_blocked = false
    RETURNING isps.isp_id
  )
  SELECT u.isp_id::text, 'blocked'::text FROM updated u;
END;
$$;

COMMENT ON FUNCTION public.refresh_billing_blocked() IS
  'Executada pelo cron a cada hora — bloqueia ISPs com fatura vencida há mais de 30 dias. '
  'Retorna lista de ISPs atualizados. '
  'Desbloqueio ocorre via webhook ao receber pagamento (billing_blocked=false, billing_blocked_since=null).';

-- Cron job — executar manualmente no Supabase SQL Editor após aplicar migration:
--
--   SELECT cron.schedule(
--     'refresh-billing-blocked',
--     '0 * * * *',
--     $$ SELECT refresh_billing_blocked(); $$
--   );
--
-- Para verificar:  SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'refresh-billing-blocked';
-- Para remover:    SELECT cron.unschedule('refresh-billing-blocked');


-- ============================================================
-- VERIFICAÇÃO — queries para confirmar que tudo foi criado
-- ============================================================
-- SELECT * FROM public.isp_email_domains ORDER BY isp_id, domain;
-- SELECT isp_id, billing_blocked, billing_blocked_since FROM public.isps;
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'handle_new_user';

-- ============================================================
-- CONFIGURAÇÃO DA SESSÃO (via Management API — não é SQL)
-- Executar após aplicar esta migration:
--
-- curl -X PATCH "https://api.supabase.com/v1/projects/yqdqmudsnjhixtxldqwi/config/auth" \
--   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "jwt_exp": 28800,
--     "sessions_timebox": 28800,
--     "sessions_inactivity_timeout": 14400
--   }'
-- ============================================================
