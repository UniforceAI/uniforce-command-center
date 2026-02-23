
-- ============================================================
-- 1. Add isp_id to actions_log (currently missing)
-- ============================================================
ALTER TABLE public.actions_log ADD COLUMN IF NOT EXISTS isp_id text;

-- ============================================================
-- 2. Drop ALL existing policies on multi-tenant tables
-- ============================================================

-- crm_workflow
DROP POLICY IF EXISTS "Authenticated users can insert crm workflow" ON public.crm_workflow;
DROP POLICY IF EXISTS "Authenticated users can update crm workflow" ON public.crm_workflow;
DROP POLICY IF EXISTS "Authenticated users can view crm workflow" ON public.crm_workflow;

-- crm_comments
DROP POLICY IF EXISTS "Authenticated users can insert crm comments" ON public.crm_comments;
DROP POLICY IF EXISTS "Authenticated users can view crm comments" ON public.crm_comments;

-- risk_bucket_config
DROP POLICY IF EXISTS "Authenticated users can insert risk config" ON public.risk_bucket_config;
DROP POLICY IF EXISTS "Authenticated users can update risk config" ON public.risk_bucket_config;
DROP POLICY IF EXISTS "Authenticated users can view risk config" ON public.risk_bucket_config;

-- actions_log
DROP POLICY IF EXISTS "Authenticated users can insert action logs" ON public.actions_log;
DROP POLICY IF EXISTS "Authenticated users can update action logs" ON public.actions_log;
DROP POLICY IF EXISTS "Authenticated users can view action logs" ON public.actions_log;

-- ============================================================
-- 3. Create isp_id-based RLS policies
--    Using: current_setting('request.header.x-isp-id', true)
-- ============================================================

-- ── crm_workflow ──
CREATE POLICY "isp_select_crm_workflow" ON public.crm_workflow
  FOR SELECT USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_crm_workflow" ON public.crm_workflow
  FOR INSERT WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_crm_workflow" ON public.crm_workflow
  FOR UPDATE USING (isp_id = current_setting('request.header.x-isp-id', true));

-- ── crm_comments ──
CREATE POLICY "isp_select_crm_comments" ON public.crm_comments
  FOR SELECT USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_crm_comments" ON public.crm_comments
  FOR INSERT WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_crm_comments" ON public.crm_comments
  FOR UPDATE USING (isp_id = current_setting('request.header.x-isp-id', true));

-- ── risk_bucket_config ──
CREATE POLICY "isp_select_risk_bucket_config" ON public.risk_bucket_config
  FOR SELECT USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_risk_bucket_config" ON public.risk_bucket_config
  FOR INSERT WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_risk_bucket_config" ON public.risk_bucket_config
  FOR UPDATE USING (isp_id = current_setting('request.header.x-isp-id', true));

-- ── actions_log ──
CREATE POLICY "isp_select_actions_log" ON public.actions_log
  FOR SELECT USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_actions_log" ON public.actions_log
  FOR INSERT WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_actions_log" ON public.actions_log
  FOR UPDATE USING (isp_id = current_setting('request.header.x-isp-id', true));

-- ============================================================
-- 4. NO DELETE policies on any table (blocked by RLS)
-- ============================================================
