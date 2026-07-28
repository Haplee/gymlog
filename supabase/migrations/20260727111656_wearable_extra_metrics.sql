-- ============================================================
-- wearable_extra_metrics — FICHERO DE RECONCILIACIÓN
--
-- Esta migración existe en el historial de producción (versión 20260727111656)
-- pero no tenía fichero en el repo: se aplicó suelta contra la base de datos y
-- sus cambios se doblaron hacia atrás dentro de 20260622194522_wearables.sql
-- en lugar de quedarse aparte.
--
-- Consecuencia: `supabase db push` veía un hueco en el historial y el repo no
-- podía recrear la base de datos por sí solo.
--
-- Qué hace: re-afirma de forma idempotente las métricas de frecuencia cardiaca
-- del resumen diario y el upsert que las escribe. Contra producción es un no-op
-- (ya están); en una reconstrucción desde cero también, porque el fichero base
-- ya las crea. Existe para que el historial local y el remoto coincidan.
--
-- Verificado contra producción el 2026-07-28: columnas y definición de la
-- función idénticas a las del fichero base.
-- ============================================================

-- Métricas de FC del resumen diario. IF NOT EXISTS porque el fichero base ya
-- las crea: aquí solo se garantizan para historiales que vengan de antes.
ALTER TABLE public.wearable_daily
  ADD COLUMN IF NOT EXISTS avg_hr integer;
ALTER TABLE public.wearable_daily
  ADD COLUMN IF NOT EXISTS max_hr integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wearable_daily'::regclass
      AND conname = 'wearable_daily_avg_hr_check'
  ) THEN
    ALTER TABLE public.wearable_daily
      ADD CONSTRAINT wearable_daily_avg_hr_check
      CHECK (avg_hr IS NULL OR (avg_hr BETWEEN 20 AND 250));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wearable_daily'::regclass
      AND conname = 'wearable_daily_max_hr_check'
  ) THEN
    ALTER TABLE public.wearable_daily
      ADD CONSTRAINT wearable_daily_max_hr_check
      CHECK (max_hr IS NULL OR (max_hr BETWEEN 20 AND 250));
  END IF;
END $$;

-- Upsert del resumen diario incluyendo las métricas de FC.
-- COALESCE en el DO UPDATE: una sincronización parcial (p. ej. de madrugada,
-- con pasos pero sin pulsaciones aún) no debe borrar lo que ya había medido.
CREATE OR REPLACE FUNCTION public.upsert_wearable_daily(p_user_id uuid, p_rows jsonb)
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

  INSERT INTO public.wearable_daily
    (user_id, date, source, steps, distance_km, calories, resting_hr, avg_hr, max_hr)
  SELECT
    p_user_id,
    (r->>'date')::date,
    r->>'source',
    NULLIF(r->>'steps','')::integer,
    NULLIF(r->>'distance_km','')::real,
    NULLIF(r->>'calories','')::integer,
    NULLIF(r->>'resting_hr','')::integer,
    NULLIF(r->>'avg_hr','')::integer,
    NULLIF(r->>'max_hr','')::integer
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (user_id, date, source) DO UPDATE SET
    steps       = COALESCE(EXCLUDED.steps, public.wearable_daily.steps),
    distance_km = COALESCE(EXCLUDED.distance_km, public.wearable_daily.distance_km),
    calories    = COALESCE(EXCLUDED.calories, public.wearable_daily.calories),
    resting_hr  = COALESCE(EXCLUDED.resting_hr, public.wearable_daily.resting_hr),
    avg_hr      = COALESCE(EXCLUDED.avg_hr, public.wearable_daily.avg_hr),
    max_hr      = COALESCE(EXCLUDED.max_hr, public.wearable_daily.max_hr);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
