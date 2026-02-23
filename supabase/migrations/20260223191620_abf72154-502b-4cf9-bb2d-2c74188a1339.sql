
-- 1) Função genérica de updated_at (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2) risk_bucket_config — isp_id TEXT (mesmo slug do useActiveIsp, ex: "agy-telecom")
CREATE TABLE public.risk_bucket_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isp_id TEXT NOT NULL UNIQUE,
  ok_max INTEGER NOT NULL DEFAULT 39,
  alert_min INTEGER NOT NULL DEFAULT 40,
  alert_max INTEGER NOT NULL DEFAULT 69,
  critical_min INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_bucket_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view risk config"
  ON public.risk_bucket_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert risk config"
  ON public.risk_bucket_config FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update risk config"
  ON public.risk_bucket_config FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_risk_bucket_config_updated_at
  BEFORE UPDATE ON public.risk_bucket_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) crm_workflow — isp_id TEXT (mesmo slug), sem DELETE para usuários comuns
CREATE TYPE public.workflow_status AS ENUM ('em_tratamento', 'resolvido', 'perdido');

CREATE TABLE public.crm_workflow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isp_id TEXT NOT NULL,
  cliente_id INTEGER NOT NULL,
  status_workflow public.workflow_status NOT NULL DEFAULT 'em_tratamento',
  owner_user_id UUID,
  tags TEXT[] DEFAULT '{}',
  entered_workflow_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (isp_id, cliente_id)
);

ALTER TABLE public.crm_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view crm workflow"
  ON public.crm_workflow FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert crm workflow"
  ON public.crm_workflow FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crm workflow"
  ON public.crm_workflow FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- SEM policy de DELETE — registros nunca são deletados no MVP

CREATE INDEX idx_crm_workflow_isp_status ON public.crm_workflow (isp_id, status_workflow);
CREATE INDEX idx_crm_workflow_isp_cliente ON public.crm_workflow (isp_id, cliente_id);

CREATE TRIGGER update_crm_workflow_updated_at
  BEFORE UPDATE ON public.crm_workflow
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
