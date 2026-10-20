-- The correction functions are SECURITY DEFINER and belong to the app role alone. Supabase's default privileges grant
-- EXECUTE on every new public function to anon and authenticated, the Data API's roles, and REVOKE ... FROM PUBLIC
-- (in *_correction_checks.sql) doesn't remove those grants: anyone with the project's anon key could have called
-- apply_correction or undo_correction over /rest/v1/rpc. Found in the post-apply check, 2026-10-20.
REVOKE EXECUTE ON FUNCTION public.claim_correction(bigint, int), public.correction_for_check(bigint),
  public.correction_status(uuid), public.hold_correction(bigint, text), public.fail_correction(bigint, text, int),
  public.release_stuck_corrections(int, int), public.received_corrections(int),
  public.apply_correction(bigint, text, text, text, jsonb, text, text), public.undo_correction(bigint)
  FROM anon, authenticated;
