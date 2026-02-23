
-- Create crm_comments table for CRM actions/comments persistence
CREATE TABLE public.crm_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isp_id TEXT NOT NULL,
  cliente_id INTEGER NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'comment', -- 'comment' | 'action' | 'status_change'
  meta JSONB NULL
);

-- Enable RLS
ALTER TABLE public.crm_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view crm comments"
  ON public.crm_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert crm comments"
  ON public.crm_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_crm_comments_cliente ON public.crm_comments (isp_id, cliente_id, created_at DESC);
