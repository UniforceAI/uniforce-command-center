
-- Create global tag catalog table
CREATE TABLE public.crm_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isp_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(isp_id, name)
);

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isp_select_crm_tags" ON public.crm_tags FOR SELECT
  USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_insert_crm_tags" ON public.crm_tags FOR INSERT
  WITH CHECK (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_update_crm_tags" ON public.crm_tags FOR UPDATE
  USING (isp_id = current_setting('request.header.x-isp-id', true));

CREATE POLICY "isp_delete_crm_tags" ON public.crm_tags FOR DELETE
  USING (isp_id = current_setting('request.header.x-isp-id', true));

-- Allow delete on crm_comments for edit/delete functionality
CREATE POLICY "isp_delete_crm_comments" ON public.crm_comments FOR DELETE
  USING (isp_id = current_setting('request.header.x-isp-id', true));
