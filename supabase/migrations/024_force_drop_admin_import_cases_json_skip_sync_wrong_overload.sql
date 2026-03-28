-- 024_force_drop_admin_import_cases_json_skip_sync_wrong_overload.sql
-- Force-delete the ambiguous overload (boolean, jsonb, boolean).

BEGIN;

DROP FUNCTION IF EXISTS public.admin_import_cases_json_skip_sync(boolean, jsonb, boolean);

COMMIT;

