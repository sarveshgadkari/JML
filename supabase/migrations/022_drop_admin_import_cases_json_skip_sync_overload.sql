-- 022_drop_admin_import_cases_json_skip_sync_overload.sql
-- Remove the ambiguous overload (boolean, jsonb, boolean) and keep only
-- the canonical overload (jsonb, boolean, boolean).

BEGIN;

DROP FUNCTION IF EXISTS public.admin_import_cases_json_skip_sync(boolean, jsonb, boolean);

GRANT EXECUTE ON FUNCTION public.admin_import_cases_json_skip_sync(jsonb, boolean, boolean) TO authenticated;

COMMIT;

