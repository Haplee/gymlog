-- Sesiones de gimnasio importadas del agregador de salud (Health Connect /
-- HealthKit), en su propia tabla.
--
-- Por qué no reutilizar cardio_sessions ni workouts:
--   - Una sesión de fuerza del reloj NO trae ejercicios/series/pesos, así que no
--     reconstruye un workout de GymLog. Metiéndola en cardio_sessions aparecía
--     como "otro" y ensuciaba las estadísticas de cardio (caso real: 27-jul-2026,
--     56 min de pesas listados como cardio).
--   - Tampoco cabe 1:1 en workouts: el reloj graba UNA sesión por visita al
--     gimnasio, y el usuario puede tener varios workouts dentro de esa ventana.
-- Se guarda entera y se enlaza por solape temporal a los workouts del día.
--
-- Idempotente. RLS por user_id.

-- ============================================================
-- 1. TABLA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.health_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('health_connect','healthkit')),
  external_id text NOT NULL,
  type        text NOT NULL DEFAULT 'strength' CHECK (type IN ('strength')),
  title       text CHECK (title IS NULL OR char_length(title) <= 200),
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  duration    integer NOT NULL CHECK (duration >= 0),
  calories    integer CHECK (calories IS NULL OR calories >= 0),
  avg_hr      integer CHECK (avg_hr IS NULL OR (avg_hr BETWEEN 20 AND 250)),
  max_hr      integer CHECK (max_hr IS NULL OR (max_hr BETWEEN 20 AND 250)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);
COMMENT ON TABLE public.health_sessions IS
  'Sesiones de gimnasio del agregador de salud: tiempo/kcal/FC sin series ni pesos';

CREATE INDEX IF NOT EXISTS idx_health_sessions_user_started
  ON public.health_sessions USING btree (user_id, started_at DESC);

ALTER TABLE public.health_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_sessions_own ON public.health_sessions;
CREATE POLICY health_sessions_own ON public.health_sessions
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. RPC DE IMPORTACIÓN
-- ============================================================

-- p_rows: array de objetos
-- { external_id, source, type, title, started_at, ended_at, duration,
--   calories, avg_hr, max_hr }
CREATE OR REPLACE FUNCTION public.import_health_sessions(p_user_id uuid, p_rows jsonb)
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

  INSERT INTO public.health_sessions
    (user_id, source, external_id, type, title, started_at, ended_at,
     duration, calories, avg_hr, max_hr)
  SELECT
    p_user_id,
    r->>'source',
    r->>'external_id',
    COALESCE(NULLIF(r->>'type',''), 'strength'),
    NULLIF(r->>'title',''),
    (r->>'started_at')::timestamptz,
    NULLIF(r->>'ended_at','')::timestamptz,
    COALESCE(NULLIF(r->>'duration','')::integer, 0),
    NULLIF(r->>'calories','')::integer,
    NULLIF(r->>'avg_hr','')::integer,
    NULLIF(r->>'max_hr','')::integer
  FROM jsonb_array_elements(p_rows) AS r
  WHERE r->>'external_id' IS NOT NULL
    AND r->>'started_at' IS NOT NULL
  ON CONFLICT (user_id, external_id) DO UPDATE SET
    -- Se reescriben también duración y título: el agregador corrige sesiones a
    -- posteriori (el reloj sincroniza tarde) y una fila vieja no debe quedarse
    -- congelada con los primeros valores que llegaron.
    duration = EXCLUDED.duration,
    ended_at = COALESCE(EXCLUDED.ended_at, public.health_sessions.ended_at),
    title    = COALESCE(EXCLUDED.title, public.health_sessions.title),
    calories = COALESCE(EXCLUDED.calories, public.health_sessions.calories),
    avg_hr   = COALESCE(EXCLUDED.avg_hr, public.health_sessions.avg_hr),
    max_hr   = COALESCE(EXCLUDED.max_hr, public.health_sessions.max_hr);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_health_sessions(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_health_sessions(uuid, jsonb) TO authenticated;

-- ============================================================
-- 3. ARREGLAR import_wearable_workouts
-- ============================================================

-- Su ON CONFLICT no actualizaba `type`, así que una fila guardada con el tipo
-- equivocado (todas las que cayeron en 'other' por el mapeo incompleto del
-- plugin) no se corregía NUNCA por mucho que se resincronizara. Ahora sí, y de
-- paso se guarda el título de la sesión en notes.
CREATE OR REPLACE FUNCTION public.import_wearable_workouts(p_user_id uuid, p_rows jsonb)
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

  INSERT INTO public.cardio_sessions
    (user_id, type, started_at, duration, distance, calories, avg_hr, max_hr,
     source, external_id, notes)
  SELECT
    p_user_id,
    COALESCE(r->>'type','other'),
    (r->>'started_at')::timestamptz,
    COALESCE(NULLIF(r->>'duration','')::integer, 0),
    NULLIF(r->>'distance','')::real,
    NULLIF(r->>'calories','')::integer,
    NULLIF(r->>'avg_hr','')::integer,
    NULLIF(r->>'max_hr','')::integer,
    r->>'source',
    r->>'external_id',
    NULLIF(left(r->>'title', 500), '')
  FROM jsonb_array_elements(p_rows) AS r
  WHERE r->>'external_id' IS NOT NULL
  ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
    type     = EXCLUDED.type,
    duration = EXCLUDED.duration,
    distance = COALESCE(EXCLUDED.distance, public.cardio_sessions.distance),
    calories = COALESCE(EXCLUDED.calories, public.cardio_sessions.calories),
    avg_hr   = COALESCE(EXCLUDED.avg_hr, public.cardio_sessions.avg_hr),
    max_hr   = COALESCE(EXCLUDED.max_hr, public.cardio_sessions.max_hr),
    notes    = COALESCE(EXCLUDED.notes, public.cardio_sessions.notes);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_wearable_workouts(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_wearable_workouts(uuid, jsonb) TO authenticated;

-- ============================================================
-- 4. LIMPIEZA DE LO YA IMPORTADO MAL
-- ============================================================

-- Sesiones de gimnasio que el plugin metió en cardio como 'other'. Se borran
-- para que la siguiente sync las vuelva a traer, ya a health_sessions (el
-- external_id se conserva, así que no se duplica nada). El criterio es el mismo
-- que aplica ahora el plugin: origen del agregador, sin distancia real.
-- Las de cinta NO se tocan: con `type = EXCLUDED.type` se recolocan solas.
DELETE FROM public.cardio_sessions
 WHERE source IN ('health_connect','healthkit')
   AND type = 'other'
   AND COALESCE(distance, 0) < 0.2;
