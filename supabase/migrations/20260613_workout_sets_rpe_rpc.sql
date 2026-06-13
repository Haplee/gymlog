-- ============================================================
-- 2026-06-13 — Persistir RPE en save_workout_with_sets
-- Idempotente: CREATE OR REPLACE de la RPC para leer s->>'rpe'.
-- La columna workout_sets.rpe (SMALLINT 1-10, nullable) ya existe.
-- ============================================================

CREATE OR REPLACE FUNCTION save_workout_with_sets(
  p_user_id UUID,
  p_exercise_id UUID,
  p_started_at TIMESTAMPTZ,
  p_finished_at TIMESTAMPTZ,
  p_sets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workout_id UUID;
  v_dur INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_dur := GREATEST(0, EXTRACT(EPOCH FROM (p_finished_at - p_started_at))::INT);

  INSERT INTO workouts (user_id, started_at, finished_at, duration_seconds)
  VALUES (p_user_id, p_started_at, p_finished_at, v_dur)
  RETURNING id INTO v_workout_id;

  INSERT INTO workout_sets (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes, rpe)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    (s->>'reps')::INT,
    (s->>'weight')::NUMERIC,
    COALESCE((s->>'is_warmup')::BOOLEAN, FALSE),
    NULLIF(s->>'notes', ''),
    -- rpe opcional; solo valores 1-10 se persisten, resto NULL.
    CASE
      WHEN (s->>'rpe') ~ '^\d+$' AND (s->>'rpe')::INT BETWEEN 1 AND 10
        THEN (s->>'rpe')::SMALLINT
      ELSE NULL
    END
  FROM jsonb_array_elements(p_sets) AS s;

  RETURN v_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;
