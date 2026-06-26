-- A1: notas y valoración de sesión en save_workout_with_sets
-- Las columnas workouts.notes y workouts.rating ya existen; el RPC no las escribía.
-- Se reemplaza por una versión con dos parámetros opcionales al final.
-- Idempotente: DROP de la firma antigua + CREATE OR REPLACE de la nueva.

DROP FUNCTION IF EXISTS public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb);

CREATE OR REPLACE FUNCTION public.save_workout_with_sets(
  p_user_id uuid,
  p_exercise_id uuid,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_sets jsonb,
  p_notes text DEFAULT NULL,
  p_rating integer DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_workout_id UUID;
  v_dur INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_dur := GREATEST(0, EXTRACT(EPOCH FROM (p_finished_at - p_started_at))::INT);

  INSERT INTO workouts (user_id, started_at, finished_at, duration_seconds, notes, rating)
  VALUES (
    p_user_id,
    p_started_at,
    p_finished_at,
    v_dur,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    CASE WHEN p_rating BETWEEN 1 AND 5 THEN p_rating::SMALLINT ELSE NULL END
  )
  RETURNING id INTO v_workout_id;

  INSERT INTO workout_sets
    (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes, rpe, set_type)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    (s->>'reps')::INT,
    (s->>'weight')::NUMERIC,
    COALESCE((s->>'is_warmup')::BOOLEAN, FALSE),
    NULLIF(s->>'notes', ''),
    CASE
      WHEN (s->>'rpe') ~ '^\d+$' AND (s->>'rpe')::INT BETWEEN 1 AND 10
        THEN (s->>'rpe')::SMALLINT
      ELSE NULL
    END,
    CASE
      WHEN (s->>'set_type') IN ('normal', 'dropset', 'rest_pause', 'amrap')
        THEN s->>'set_type'
      ELSE 'normal'
    END
  FROM jsonb_array_elements(p_sets) AS s;

  RETURN v_workout_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer) TO authenticated;
