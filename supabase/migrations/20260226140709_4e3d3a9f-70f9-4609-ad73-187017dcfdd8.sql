
-- Drop restrictive policies
DROP POLICY IF EXISTS "isp_select_risk_bucket_config" ON public.risk_bucket_config;
DROP POLICY IF EXISTS "isp_insert_risk_bucket_config" ON public.risk_bucket_config;
DROP POLICY IF EXISTS "isp_update_risk_bucket_config" ON public.risk_bucket_config;

-- Recreate as PERMISSIVE
CREATE POLICY "isp_select_risk_bucket_config" ON public.risk_bucket_config
  FOR SELECT USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_risk_bucket_config" ON public.risk_bucket_config
  FOR INSERT WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_risk_bucket_config" ON public.risk_bucket_config
  FOR UPDATE USING (isp_id = current_setting('request.header.x-isp-id', true));
