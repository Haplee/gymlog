-- ============================================================
-- 2026-06-13 — Tipos de serie avanzados (set_type)
-- Aditivo + idempotente. Valores por-serie que encajan en el modelo actual
-- (un ejercicio por workout): normal | dropset | rest_pause | amrap.
-- Superset (cross-ejercicio) NO se incluye: requiere sesiones multi-ejercicio.
-- ============================================================

ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS set_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (set_type IN ('normal', 'dropset', 'rest_pause', 'amrap'));

-- RPC: añade set_type al insert (CREATE OR REPLACE, idempotente).
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
$$;

REVOKE ALL ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;
