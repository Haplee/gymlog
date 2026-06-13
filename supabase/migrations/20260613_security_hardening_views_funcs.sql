-- Security hardening (audit 2026-06-13)
-- V-01: vistas SECURITY DEFINER sin filtro auth.uid() exponían datos cross-tenant
--       a anon/authenticated. security_invoker=on hace que respeten el RLS del
--       que consulta. Se revocan grants de escritura (vistas agregadas no
--       actualizables) y SELECT de anon (solo usuarios logueados las usan).
-- V-03: pinnear search_path en funciones SECURITY DEFINER.
-- V-05: revocar EXECUTE de funciones trigger expuestas por error vía /rpc.
-- Idempotente.

-- ── V-01: vistas respetan RLS del invocador ──────────────────────────────────
ALTER VIEW public.v_daily_volume            SET (security_invoker = on);
ALTER VIEW public.v_weekly_volume_by_muscle SET (security_invoker = on);
ALTER VIEW public.v_last_trained_by_muscle  SET (security_invoker = on);
ALTER VIEW public.v_progression_1rm         SET (security_invoker = on);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_daily_volume,
     public.v_weekly_volume_by_muscle,
     public.v_last_trained_by_muscle,
     public.v_progression_1rm
  FROM anon, authenticated;

REVOKE SELECT
  ON public.v_daily_volume,
     public.v_weekly_volume_by_muscle,
     public.v_last_trained_by_muscle,
     public.v_progression_1rm
  FROM anon;

-- ── V-03: search_path inmutable en funciones SECURITY DEFINER ────────────────
ALTER FUNCTION public.process_new_set()       SET search_path = public, pg_temp;
ALTER FUNCTION public.check_personal_record() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_workout_volume()   SET search_path = public, pg_temp;

-- ── V-05: funciones trigger no deben ser ejecutables vía REST/RPC ────────────
-- Las funciones reciben EXECUTE para PUBLIC por defecto; anon/authenticated lo
-- heredan. Hay que revocar de PUBLIC (revocar solo de los roles no basta).
REVOKE EXECUTE ON FUNCTION public.process_new_set()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_personal_record() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_update_pr()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_workout_volume()   FROM PUBLIC, anon, authenticated;

-- ── handle_new_user: search_path + revoke EXECUTE ─────────────────────────────
-- Trigger de signup (auth.users → profiles). Dispara como owner; revocar
-- EXECUTE de PUBLIC impide que se llame vía /rpc pero no afecta al trigger.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
