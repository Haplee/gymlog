-- ============================================================
-- Tope global de tokens del entrenador IA
--
-- La cuota diaria de `ai_coach_usage` protege a un usuario de otro, pero no
-- protege la cuenta del proveedor: cien usuarios dentro de su cuota pueden
-- agotar el free tier entre todos. Esto da el número que hace falta para
-- cortar antes de llegar ahí.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ai_coach_month_tokens()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(tokens), 0)::bigint
    FROM public.ai_coach_usage
   WHERE day >= date_trunc('month', CURRENT_DATE)::date;
$$;

COMMENT ON FUNCTION public.ai_coach_month_tokens() IS
  'Tokens consumidos por todos los usuarios en el mes en curso. Solo service_role';

-- Solo la Edge Function (service_role) la usa. Un usuario no tiene por qué
-- saber el consumo agregado de los demás.
--
-- OJO con el patrón: `REVOKE ... FROM public` NO basta. `PUBLIC` es el
-- pseudo-rol, y Supabase concede EXECUTE explícitamente a `anon` y
-- `authenticated` sobre las funciones nuevas de este esquema. Hay que
-- nombrarlos. Ver 20260729110000_ai_coach_fix_function_grants.sql.
REVOKE ALL     ON FUNCTION public.ai_coach_month_tokens() FROM public;
REVOKE EXECUTE ON FUNCTION public.ai_coach_month_tokens() FROM anon, authenticated;

-- ============================================================
-- Índice para el agregado mensual
-- ============================================================
-- Sin esto, el tope global hace un seq scan de toda la tabla de uso en cada
-- petición: justo lo que no quieres en el camino caliente.
CREATE INDEX IF NOT EXISTS idx_ai_coach_usage_day
  ON public.ai_coach_usage USING btree (day);
