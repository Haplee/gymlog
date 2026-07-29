-- ============================================================
-- Arreglo de permisos de las funciones del entrenador IA
--
-- QUÉ PASABA
--
-- Las migraciones del coach terminaban con `REVOKE ALL ON FUNCTION ... FROM
-- public`, dando por hecho que eso dejaba la función solo para la Edge
-- Function. No lo hace. `PUBLIC` es el pseudo-rol, y Supabase concede EXECUTE
-- explícitamente a `anon`, `authenticated` y `service_role` sobre las funciones
-- nuevas del esquema `public` vía ALTER DEFAULT PRIVILEGES. Revocar de PUBLIC
-- no toca esas concesiones nominales.
--
-- Comprobado con has_function_privilege(): las cuatro salían ejecutables por
-- `anon` y por `authenticated`.
--
-- POR QUÉ IMPORTA
--
-- `ai_coach_consume_quota(p_user, ...)` y `ai_coach_add_tokens(p_user, ...)`
-- reciben el usuario como PARÁMETRO y no comprueban auth.uid() — no pueden,
-- las llama la Edge Function con service_role, donde auth.uid() es NULL. Su
-- única protección era el permiso. Sin él, cualquiera podía:
--   - agotar la cuota diaria del coach de OTRO usuario llamándola en bucle;
--   - inflar el contador de tokens de cualquiera y, con el tope mensual
--     activado, dejar el entrenador apagado para todo el mundo.
--
-- SOLUCIÓN
--
-- Quitar EXECUTE a anon y authenticated. No se añade una guarda de auth.uid()
-- dentro porque romperia a quien las llama de verdad: service_role.
--
-- `ai_coach_purge()` es el caso distinto y se deja como está para
-- `authenticated`: no recibe usuario, lo saca de auth.uid() y revienta si es
-- NULL. La llama el cliente a propósito, para revocar el consentimiento.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- ============================================================

-- Solo la Edge Function (service_role) las necesita.
REVOKE EXECUTE ON FUNCTION public.ai_coach_consume_quota(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_coach_add_tokens(uuid, text, integer)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_coach_month_tokens()                     FROM anon, authenticated;

-- La purga sí la llama el cliente. A `anon` no le sirve de nada (auth.uid()
-- sería NULL y la función lanza excepción), pero no hay razón para ofrecérsela.
REVOKE EXECUTE ON FUNCTION public.ai_coach_purge() FROM anon;
GRANT  EXECUTE ON FUNCTION public.ai_coach_purge() TO authenticated;
