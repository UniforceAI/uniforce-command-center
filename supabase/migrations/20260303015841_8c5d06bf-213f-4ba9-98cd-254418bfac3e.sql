
-- ============================================================
-- 1. PROFILES: restrict SELECT to own profile + admins
-- ============================================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. ACTIONS_LOG: add auth requirement to existing isp-scoped policies
-- ============================================================

-- Drop existing policies and recreate with auth.uid() check
DROP POLICY IF EXISTS "isp_select_actions_log" ON public.actions_log;
DROP POLICY IF EXISTS "isp_insert_actions_log" ON public.actions_log;
DROP POLICY IF EXISTS "isp_update_actions_log" ON public.actions_log;

-- SELECT: must be authenticated AND isp_id must match header
CREATE POLICY "isp_select_actions_log"
  ON public.actions_log
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND isp_id = current_setting('request.header.x-isp-id', true)
  );

-- INSERT: must be authenticated AND isp_id must match header
CREATE POLICY "isp_insert_actions_log"
  ON public.actions_log
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND isp_id = current_setting('request.header.x-isp-id', true)
  );

-- UPDATE: must be authenticated AND isp_id must match header
CREATE POLICY "isp_update_actions_log"
  ON public.actions_log
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND isp_id = current_setting('request.header.x-isp-id', true)
  );
