-- ============================================================
-- 2026-05-10 — Cardio sessions + Split Brazos + RPC for fast workout save
-- Already applied to Supabase project eoltmipoklizewxdpzfa
-- ============================================================

-- BLOQUE 0: Update muscle_group constraint to allow new groups
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_muscle_group_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_muscle_group_check
  CHECK (muscle_group = ANY (ARRAY[
    'Pecho','Espalda','Hombro','Pierna','Glúteo',
    'Brazos','Bíceps','Tríceps','Antebrazo',
    'Core','Cardio','Otro'
  ]));

-- BLOQUE 1: cardio_sessions table
CREATE TABLE IF NOT EXISTS cardio_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('running','cycling','rowing','swimming','elliptical','walking','jump_rope','other')),
  started_at  TIMESTAMPTZ NOT NULL,
  duration    INTEGER NOT NULL CHECK (duration >= 0),
  distance    NUMERIC(7,2) CHECK (distance IS NULL OR distance >= 0),
  calories    INTEGER CHECK (calories IS NULL OR calories >= 0),
  notes       TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cardio_sessions IS 'Cardio sessions tracked by user';

CREATE INDEX IF NOT EXISTS idx_cardio_user_started
  ON cardio_sessions(user_id, started_at DESC);

ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cardio_sessions_own" ON cardio_sessions;
CREATE POLICY "cardio_sessions_own" ON cardio_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- BLOQUE 2: Split Brazos -> Bíceps / Tríceps / Antebrazo
UPDATE exercises SET muscle_group = 'Antebrazo'
 WHERE muscle_group = 'Brazos'
   AND (LOWER(name) LIKE '%antebrazo%');

UPDATE exercises SET muscle_group = 'Tríceps'
 WHERE muscle_group = 'Brazos'
   AND (LOWER(name) LIKE '%tríceps%' OR LOWER(name) LIKE '%triceps%'
        OR LOWER(name) LIKE '%press francés%' OR LOWER(name) LIKE '%fondos%');

UPDATE exercises SET muscle_group = 'Bíceps'
 WHERE muscle_group = 'Brazos'
   AND (LOWER(name) LIKE '%bíceps%' OR LOWER(name) LIKE '%biceps%'
        OR LOWER(name) LIKE '%curl%' OR LOWER(name) LIKE '%martillo%');

UPDATE exercises SET muscle_group = 'Bíceps'
 WHERE muscle_group = 'Brazos';

-- BLOQUE 3: RPC for atomic fast workout save (single round-trip)
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
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO workouts (user_id, started_at, finished_at)
  VALUES (p_user_id, p_started_at, p_finished_at)
  RETURNING id INTO v_workout_id;

  INSERT INTO workout_sets (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    (s->>'reps')::INT,
    (s->>'weight')::NUMERIC,
    COALESCE((s->>'is_warmup')::BOOLEAN, FALSE),
    NULLIF(s->>'notes', '')
  FROM jsonb_array_elements(p_sets) AS s;

  RETURN v_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

-- BLOQUE 4: cache duration_seconds + autoclassify trigger (revised)
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

  INSERT INTO workout_sets (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    (s->>'reps')::INT,
    (s->>'weight')::NUMERIC,
    COALESCE((s->>'is_warmup')::BOOLEAN, FALSE),
    NULLIF(s->>'notes', '')
  FROM jsonb_array_elements(p_sets) AS s;

  RETURN v_workout_id;
END;
$$;

REVOKE ALL ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_workout_with_sets(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION autoclassify_muscle_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  n TEXT;
BEGIN
  IF NEW.muscle_group IS NOT NULL AND NEW.muscle_group <> 'Otro' THEN
    RETURN NEW;
  END IF;
  n := LOWER(COALESCE(NEW.name, ''));
  IF n LIKE '%antebrazo%' THEN NEW.muscle_group := 'Antebrazo';
  ELSIF n LIKE '%bíceps%' OR n LIKE '%biceps%' OR n LIKE '%curl%' OR n LIKE '%martillo%' THEN NEW.muscle_group := 'Bíceps';
  ELSIF n LIKE '%tríceps%' OR n LIKE '%triceps%' OR n LIKE '%press francés%' OR n LIKE '%fondos%' THEN NEW.muscle_group := 'Tríceps';
  ELSIF n LIKE '%pecho%' OR n LIKE '%press banca%' OR n LIKE '%aperturas%' OR n LIKE '%fly%' THEN NEW.muscle_group := 'Pecho';
  ELSIF n LIKE '%espalda%' OR n LIKE '%dominada%' OR n LIKE '%remo%' OR n LIKE '%jalón%' OR n LIKE '%jalon%' OR n LIKE '%pull%' THEN NEW.muscle_group := 'Espalda';
  ELSIF n LIKE '%hombro%' OR n LIKE '%militar%' OR n LIKE '%lateral%' OR n LIKE '%pájaro%' OR n LIKE '%pajaro%' THEN NEW.muscle_group := 'Hombro';
  ELSIF n LIKE '%glúteo%' OR n LIKE '%gluteo%' OR n LIKE '%hip thrust%' OR n LIKE '%puente%' THEN NEW.muscle_group := 'Glúteo';
  ELSIF n LIKE '%pierna%' OR n LIKE '%cuádriceps%' OR n LIKE '%cuadriceps%' OR n LIKE '%sentadilla%' OR n LIKE '%squat%' OR n LIKE '%peso muerto%' OR n LIKE '%femoral%' OR n LIKE '%isquio%' OR n LIKE '%gemelo%' OR n LIKE '%pantorrilla%' OR n LIKE '%lunge%' OR n LIKE '%zancada%' THEN NEW.muscle_group := 'Pierna';
  ELSIF n LIKE '%abdomen%' OR n LIKE '%core%' OR n LIKE '%plancha%' OR n LIKE '%crunch%' OR n LIKE '%abdominal%' THEN NEW.muscle_group := 'Core';
  ELSIF n LIKE '%correr%' OR n LIKE '%bici%' OR n LIKE '%cardio%' OR n LIKE '%elíptica%' OR n LIKE '%eliptica%' THEN NEW.muscle_group := 'Cardio';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exercises_autoclassify ON exercises;
CREATE TRIGGER exercises_autoclassify
  BEFORE INSERT ON exercises
  FOR EACH ROW EXECUTE FUNCTION autoclassify_muscle_group();
