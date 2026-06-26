-- ============================================================
-- GymLog v2 — Migración: cerrar exposición RPC de handle_new_user
-- Corrige los avisos del linter de Supabase
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
-- para public.handle_new_user.
--
-- handle_new_user es un trigger AFTER INSERT en auth.users (crea la
-- fila en public.profiles). Como SECURITY DEFINER quedaba expuesta en
-- /rest/v1/rpc/handle_new_user a anon y authenticated. Los triggers se
-- ejecutan con independencia de los grants de EXECUTE, así que revocar
-- el acceso por RPC NO afecta al alta de usuarios; solo elimina la
-- superficie de ataque.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
