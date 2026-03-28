-- 020_fix_admin_import_rpc_signature.sql
-- Compatibility overload for admin_import_cases_json parameter order mismatch.

BEGIN;

-- Existing canonical signature:
-- public.admin_import_cases_json(p_rows jsonb, p_replace_existing boolean DEFAULT false)
-- Add compatibility wrapper for callers sending:
-- public.admin_import_cases_json(p_replace_existing boolean, p_rows jsonb)
CREATE OR REPLACE FUNCTION public.admin_import_cases_json(
  p_replace_existing boolean,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.admin_import_cases_json(
    p_rows := p_rows,
    p_replace_existing := COALESCE(p_replace_existing, false)
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_cases_json(boolean, jsonb) TO authenticated;

COMMIT;

