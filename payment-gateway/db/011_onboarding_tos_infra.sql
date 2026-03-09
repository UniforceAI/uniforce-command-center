-- Migration 011: Onboarding ToS Infrastructure
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/yqdqmudsnjhixtxldqwi

-- 1. Novas colunas em isps
ALTER TABLE public.isps
  ADD COLUMN IF NOT EXISTS ip_blocking_requested  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS financial_email         TEXT,
  ADD COLUMN IF NOT EXISTS financial_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contract_accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_accepted_version    TEXT,
  ADD COLUMN IF NOT EXISTS tos_accepted_at         TIMESTAMPTZ;

-- 2. Tabela de versões de Termos de Serviço
CREATE TABLE IF NOT EXISTS public.terms_of_service (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de aceites (audit legal)
CREATE TABLE IF NOT EXISTS public.tos_acceptances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  isp_id      TEXT NOT NULL REFERENCES public.isps(isp_id),
  tos_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  UNIQUE (user_id, tos_version)
);
ALTER TABLE public.tos_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_acceptances" ON public.tos_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. Função SECURITY DEFINER para aceitar ToS
CREATE OR REPLACE FUNCTION public.record_tos_acceptance(
  p_user_id     UUID,
  p_isp_id      TEXT,
  p_tos_version TEXT,
  p_ip_address  TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.tos_acceptances (user_id, isp_id, tos_version, ip_address)
  VALUES (p_user_id, p_isp_id, p_tos_version, p_ip_address)
  ON CONFLICT (user_id, tos_version) DO NOTHING;

  UPDATE public.isps
  SET tos_accepted_version = p_tos_version,
      tos_accepted_at = NOW()
  WHERE isp_id = p_isp_id;
END;
$$;

-- 5. Seed: versão inicial dos Termos de Serviço
INSERT INTO public.terms_of_service (version, title, content, is_current) VALUES (
  'v1.0',
  'Termos de Serviço — Uniforce',
  E'## 1. Aceitação dos Termos\n\nAo contratar os serviços da Uniforce Tecnologia Ltda. ("Uniforce"), você ("Cliente") concorda com estes Termos de Serviço ("Termos"). Leia-os cuidadosamente antes de usar nossa plataforma.\n\n## 2. Descrição dos Serviços\n\nA Uniforce oferece uma plataforma de gestão de retenção e análise de dados para provedores de internet (ISPs), incluindo Dashboard de Retenção, Churn Score®, análise de inadimplência e módulos adicionais conforme contratados.\n\n## 3. Período Mínimo de Vigência\n\nA assinatura do serviço tem período mínimo de vigência de **3 (três) meses** a contar da data de ativação. Rescisões antecipadas estão sujeitas à cobrança proporcional ao período contratado.\n\n## 4. Pagamento\n\nO pagamento é processado mensalmente via cartão de crédito através da plataforma Stripe. Faturas vencidas podem resultar em suspensão temporária do acesso.\n\n## 5. Confidencialidade dos Dados\n\nA Uniforce trata todos os dados do Cliente com confidencialidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Os dados são utilizados exclusivamente para prestação dos serviços contratados.\n\n## 6. Limitação de Responsabilidade\n\nA Uniforce não se responsabiliza por danos indiretos, lucros cessantes ou interrupções de serviço decorrentes de fatores externos à plataforma.\n\n## 7. Modificações\n\nA Uniforce pode modificar estes Termos com aviso prévio de 30 dias. O uso continuado dos serviços após este período implica aceitação das modificações.\n\n## 8. Foro\n\nFica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer litígios decorrentes deste contrato.\n\n[CONTEÚDO LEGAL A SER REVISADO PELO TIME JURÍDICO]',
  TRUE
) ON CONFLICT (version) DO NOTHING;
