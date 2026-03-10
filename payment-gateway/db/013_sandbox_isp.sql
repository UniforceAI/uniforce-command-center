-- 013_sandbox_isp.sql
-- ISP de sandbox para testes de Stripe TEST mode
-- CNPJ da Uniforce: 60.293.381/0001-76
-- Credenciais IXC: Zen-Telecom (DEV ONLY — jamais usar em produção)
--
-- NOTA: stripe_test_mode_enabled=true aqui porque este ISP é exclusivamente de testes.
-- Os hooks stripe-checkout/stripe-list-products tratam isp_id='uniforce' como sandbox;
-- para que 'uniforce-sandbox' também use Stripe TEST, adicionar ao allowlist no código.
--
-- EXECUTE no Supabase SQL Editor: https://supabase.com/dashboard/project/yqdqmudsnjhixtxldqwi

INSERT INTO public.isps (
  isp_id,
  isp_nome,
  cnpj,
  instancia_isp,
  onboarding_status,
  credentials,
  stripe_test_mode_enabled,
  stripe_billing_source
) VALUES (
  'uniforce-sandbox',
  'Uniforce Sandbox (TEST)',
  '60.293.381/0001-76',
  'ixc',
  'complete',
  jsonb_build_object(
    'erp_type', 'ixc',
    'erp_base_url', 'https://ixc.zentelecom.com.br',   -- substituir pela URL real de teste do IXC
    'erp_api_key', '155',
    'erp_api_token', 'e5bc0ed55f06f0d2020c6597f9527632d8261a680a543e9e090279a48d5f5977'
  ),
  TRUE,
  'stripe'
)
ON CONFLICT (isp_id) DO NOTHING;

-- Vincular felipe@uniforce.com.br como admin deste ISP de sandbox
-- (ele já é super_admin do ISP 'uniforce'; este é um papel adicional)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'felipe@uniforce.com.br' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, isp_id, role)
    VALUES (v_user_id, 'uniforce-sandbox', 'admin')
    ON CONFLICT (user_id, isp_id, role) DO NOTHING;
  END IF;
END;
$$;

-- Verificar criação
SELECT isp_id, isp_nome, cnpj, onboarding_status, stripe_test_mode_enabled
FROM public.isps WHERE isp_id = 'uniforce-sandbox';
