-- ============================================================
-- GymLog v2 — Migración: fijar search_path en funciones legacy
-- Corrige el aviso del linter de Supabase
--   "Function Search Path Mutable" (0011)
-- en funciones que no tenían search_path fijado. Un search_path
-- mutable permite que el rol que invoca altere la resolución de
-- nombres → riesgo de hijacking en funciones SECURITY DEFINER.
--
-- Se fija a `public, pg_temp` (no se vacía a '' porque los cuerpos
-- referencian objetos de public sin cualificar). Solo cambia la
-- config de la función, no su cuerpo. No rompe nada.
-- ============================================================

ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.finish_workout() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_volume_by_muscle_group(uuid) SET search_path = public, pg_temp;
