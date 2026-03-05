-- CRM Lifecycle Management: score reset + auto-archive
-- Adds 4 columns to crm_workflow for lifecycle tracking

ALTER TABLE public.crm_workflow
  ADD COLUMN IF NOT EXISTS archived           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_entered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS score_snapshot     JSONB;

-- Backfill status_entered_at for existing rows
UPDATE public.crm_workflow
  SET status_entered_at = COALESCE(last_action_at, created_at)
WHERE status_entered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_workflow_isp_active
  ON public.crm_workflow (isp_id, archived) WHERE archived = FALSE;
