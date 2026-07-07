-- Fix: "ON CONFLICT DO UPDATE command cannot affect row a second time".
-- Health Connect puede devolver varias sesiones de sueño con la misma fecha
-- (siesta + noche, o sesión partida). El INSERT ... ON CONFLICT fallaba al
-- recibir claves (user_id, date, source) duplicadas en la misma sentencia.
-- Solución: agregar por (date, source) sumando minutos antes del upsert.
-- Idempotente: CREATE OR REPLACE, misma firma y permisos.

CREATE OR REPLACE FUNCTION public.upsert_wearable_sleep(p_user_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.wearable_sleep
    (user_id, date, source, duration_min, deep_min, light_min, rem_min, awake_min, efficiency_pct)
  SELECT
    p_user_id,
    s.date,
    s.source,
    SUM(s.duration_min)::integer,
    SUM(s.deep_min)::integer,
    SUM(s.light_min)::integer,
    SUM(s.rem_min)::integer,
    SUM(s.awake_min)::integer,
    ROUND(AVG(s.efficiency_pct))::integer
  FROM (
    SELECT
      (r->>'date')::date AS date,
      r->>'source' AS source,
      NULLIF(r->>'duration_min','')::integer AS duration_min,
      NULLIF(r->>'deep_min','')::integer AS deep_min,
      NULLIF(r->>'light_min','')::integer AS light_min,
      NULLIF(r->>'rem_min','')::integer AS rem_min,
      NULLIF(r->>'awake_min','')::integer AS awake_min,
      NULLIF(r->>'efficiency_pct','')::integer AS efficiency_pct
    FROM jsonb_array_elements(p_rows) AS r
  ) AS s
  GROUP BY s.date, s.source
  ON CONFLICT (user_id, date, source) DO UPDATE SET
    duration_min   = COALESCE(EXCLUDED.duration_min, public.wearable_sleep.duration_min),
    deep_min       = COALESCE(EXCLUDED.deep_min, public.wearable_sleep.deep_min),
    light_min      = COALESCE(EXCLUDED.light_min, public.wearable_sleep.light_min),
    rem_min        = COALESCE(EXCLUDED.rem_min, public.wearable_sleep.rem_min),
    awake_min      = COALESCE(EXCLUDED.awake_min, public.wearable_sleep.awake_min),
    efficiency_pct = COALESCE(EXCLUDED.efficiency_pct, public.wearable_sleep.efficiency_pct);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $function$;

REVOKE ALL ON FUNCTION public.upsert_wearable_sleep(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_wearable_sleep(uuid, jsonb) TO authenticated;
