-- ============================================================
-- GymLog v2.0 — Migration completa con manejo de errores
-- Proyecto: eoltmipoklizewxdpzfa
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- IMPORTANTE: Ejecutar en orden. Cada bloque es idempotente.
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- BLOQUE 1: PROFILES (mejoras)
-- ============================================================

DO $$
BEGIN
  -- goal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'goal'
  ) THEN
    ALTER TABLE profiles ADD COLUMN goal TEXT
      CHECK (goal IN ('volume', 'strength', 'endurance', 'fat_loss'))
      DEFAULT NULL;
    RAISE NOTICE 'profiles.goal añadida';
  END IF;

  -- days_per_week
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'days_per_week'
  ) THEN
    ALTER TABLE profiles ADD COLUMN days_per_week SMALLINT
      CHECK (days_per_week BETWEEN 1 AND 7)
      DEFAULT NULL;
    RAISE NOTICE 'profiles.days_per_week añadida';
  END IF;

  -- equipment_available
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'equipment_available'
  ) THEN
    ALTER TABLE profiles ADD COLUMN equipment_available TEXT[]
      DEFAULT '{}';
    RAISE NOTICE 'profiles.equipment_available añadida';
  END IF;

  -- avatar_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT DEFAULT NULL;
    RAISE NOTICE 'profiles.avatar_url añadida';
  END IF;

  -- onboarding_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN
      NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'profiles.onboarding_completed añadida';
  END IF;

  -- weight_kg
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'weight_kg'
  ) THEN
    ALTER TABLE profiles ADD COLUMN weight_kg NUMERIC(5,2)
      CHECK (weight_kg > 0 AND weight_kg < 500)
      DEFAULT NULL;
    RAISE NOTICE 'profiles.weight_kg añadida';
  END IF;

  -- height_cm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'height_cm'
  ) THEN
    ALTER TABLE profiles ADD COLUMN height_cm SMALLINT
      CHECK (height_cm > 0 AND height_cm < 300)
      DEFAULT NULL;
    RAISE NOTICE 'profiles.height_cm añadida';
  END IF;

  -- birth_year
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'birth_year'
  ) THEN
    ALTER TABLE profiles ADD COLUMN birth_year SMALLINT
      CHECK (birth_year BETWEEN 1920 AND 2015)
      DEFAULT NULL;
    RAISE NOTICE 'profiles.birth_year añadida';
  END IF;

  -- sex
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sex'
  ) THEN
    ALTER TABLE profiles ADD COLUMN sex TEXT
      CHECK (sex IN ('male', 'female', 'other'))
      DEFAULT NULL;
    RAISE NOTICE 'profiles.sex añadida';
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ
      NOT NULL DEFAULT NOW();
    RAISE NOTICE 'profiles.updated_at añadida';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BLOQUE 2: EXERCISES (mejoras)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'equipment'
  ) THEN
    ALTER TABLE exercises ADD COLUMN equipment TEXT
      CHECK (equipment IN (
        'barbell', 'dumbbell', 'machine', 'cable',
        'bodyweight', 'kettlebell', 'band', 'smith_machine', 'other'
      ))
      DEFAULT 'other';
    RAISE NOTICE 'exercises.equipment añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'is_compound'
  ) THEN
    ALTER TABLE exercises ADD COLUMN is_compound BOOLEAN
      NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'exercises.is_compound añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'description'
  ) THEN
    ALTER TABLE exercises ADD COLUMN description TEXT DEFAULT NULL;
    RAISE NOTICE 'exercises.description añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE exercises ADD COLUMN is_public BOOLEAN
      NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'exercises.is_public añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE exercises ADD COLUMN created_at TIMESTAMPTZ
      NOT NULL DEFAULT NOW();
    RAISE NOTICE 'exercises.created_at añadida';
  END IF;
END $$;

-- ============================================================
-- BLOQUE 3: WORKOUTS (mejoras)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE workouts ADD COLUMN duration_seconds INTEGER
      CHECK (duration_seconds >= 0)
      DEFAULT NULL;
    RAISE NOTICE 'workouts.duration_seconds añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'notes'
  ) THEN
    ALTER TABLE workouts ADD COLUMN notes TEXT
      CHECK (char_length(notes) <= 2000)
      DEFAULT NULL;
    RAISE NOTICE 'workouts.notes añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'rating'
  ) THEN
    ALTER TABLE workouts ADD COLUMN rating SMALLINT
      CHECK (rating BETWEEN 1 AND 5)
      DEFAULT NULL;
    RAISE NOTICE 'workouts.rating añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'finished_at'
  ) THEN
    ALTER TABLE workouts ADD COLUMN finished_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'workouts.finished_at añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'total_volume_kg'
  ) THEN
    ALTER TABLE workouts ADD COLUMN total_volume_kg NUMERIC(10,2)
      CHECK (total_volume_kg >= 0)
      DEFAULT 0;
    RAISE NOTICE 'workouts.total_volume_kg añadida';
  END IF;
END $$;

-- ============================================================
-- BLOQUE 4: WORKOUT_SETS (mejoras)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'rpe'
  ) THEN
    ALTER TABLE workout_sets ADD COLUMN rpe SMALLINT
      CHECK (rpe BETWEEN 1 AND 10)
      DEFAULT NULL;
    RAISE NOTICE 'workout_sets.rpe añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'notes'
  ) THEN
    ALTER TABLE workout_sets ADD COLUMN notes TEXT
      CHECK (char_length(notes) <= 500)
      DEFAULT NULL;
    RAISE NOTICE 'workout_sets.notes añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'is_warmup'
  ) THEN
    ALTER TABLE workout_sets ADD COLUMN is_warmup BOOLEAN
      NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'workout_sets.is_warmup añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE workout_sets ADD COLUMN duration_seconds INTEGER
      CHECK (duration_seconds >= 0)
      DEFAULT NULL;
    RAISE NOTICE 'workout_sets.duration_seconds añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE workout_sets ADD COLUMN created_at TIMESTAMPTZ
      NOT NULL DEFAULT NOW();
    RAISE NOTICE 'workout_sets.created_at añadida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'workout_sets'
      AND constraint_name = 'workout_sets_weight_positive'
  ) THEN
    BEGIN
      ALTER TABLE workout_sets
        ADD CONSTRAINT workout_sets_weight_positive
        CHECK (weight >= 0);
      RAISE NOTICE 'constraint weight_positive añadido';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'constraint weight_positive ya existía';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'workout_sets'
      AND constraint_name = 'workout_sets_reps_positive'
  ) THEN
    BEGIN
      ALTER TABLE workout_sets
        ADD CONSTRAINT workout_sets_reps_positive
        CHECK (reps > 0 AND reps <= 9999);
      RAISE NOTICE 'constraint reps_positive añadido';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'constraint reps_positive ya existía';
    END;
  END IF;
END $$;

-- ============================================================
-- BLOQUE 5: NUEVAS TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS body_measurements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  weight_kg      NUMERIC(5,2) CHECK (weight_kg > 0 AND weight_kg < 500),
  body_fat_pct   NUMERIC(4,1) CHECK (body_fat_pct BETWEEN 0 AND 100),
  muscle_mass_kg NUMERIC(5,2) CHECK (muscle_mass_kg >= 0),
  notes          TEXT CHECK (char_length(notes) <= 1000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

COMMENT ON TABLE body_measurements IS 'Medidas corporales periódicas del usuario';

CREATE TABLE IF NOT EXISTS exercise_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  note        TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE exercise_notes IS 'Notas libres del usuario por ejercicio';

CREATE TABLE IF NOT EXISTS routine_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT CHECK (char_length(description) <= 500),
  days_data   JSONB NOT NULL DEFAULT '[]',
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE routine_templates IS 'Plantillas de rutina predefinidas (PPL, Full Body, etc.)';

-- ============================================================
-- BLOQUE 6: ÍNDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workouts_user_date
  ON workouts(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workouts_user_finished
  ON workouts(user_id, finished_at DESC)
  WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sets_workout
  ON workout_sets(workout_id);

CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise
  ON workout_sets(exercise_id);

CREATE INDEX IF NOT EXISTS idx_workout_sets_created
  ON workout_sets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sets_stats
  ON workout_sets(exercise_id, created_at DESC)
  WHERE is_warmup = FALSE;

CREATE INDEX IF NOT EXISTS idx_exercises_user
  ON exercises(user_id);

CREATE INDEX IF NOT EXISTS idx_exercises_muscle
  ON exercises(muscle_group);

CREATE INDEX IF NOT EXISTS idx_exercises_public
  ON exercises(is_public)
  WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_prs_user_exercise
  ON personal_records(user_id, exercise_id);

CREATE INDEX IF NOT EXISTS idx_measurements_user_date
  ON body_measurements(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_notes_user_exercise
  ON exercise_notes(user_id, exercise_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routines_user
  ON user_routines(user_id);

DO $$
BEGIN
  RAISE NOTICE 'Índices creados correctamente';
END $$;

-- ============================================================
-- BLOQUE 7: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_own" ON body_measurements;
CREATE POLICY "body_measurements_own" ON body_measurements
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercise_notes_own" ON exercise_notes;
CREATE POLICY "exercise_notes_own" ON exercise_notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routine_templates_read" ON routine_templates;
CREATE POLICY "routine_templates_read" ON routine_templates
  FOR SELECT USING (is_public = TRUE);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "exercises_own_or_public" ON exercises;
CREATE POLICY "exercises_own_or_public" ON exercises
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS "exercises_insert_own" ON exercises;
CREATE POLICY "exercises_insert_own" ON exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercises_update_own" ON exercises;
CREATE POLICY "exercises_update_own" ON exercises
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercises_delete_own" ON exercises;
CREATE POLICY "exercises_delete_own" ON exercises
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workouts_own" ON workouts;
CREATE POLICY "workouts_own" ON workouts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_sets_own" ON workout_sets;
CREATE POLICY "workout_sets_own" ON workout_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_sets.workout_id
        AND w.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prs_own" ON personal_records;
CREATE POLICY "prs_own" ON personal_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routines_own" ON user_routines;
CREATE POLICY "routines_own" ON user_routines
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- BLOQUE 8: FUNCIONES Y TRIGGERS DE NEGOCIO
-- ============================================================

CREATE OR REPLACE FUNCTION sync_workout_volume()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workouts
  SET total_volume_kg = (
    SELECT COALESCE(SUM(weight * reps), 0)
    FROM workout_sets
    WHERE workout_id = COALESCE(NEW.workout_id, OLD.workout_id)
      AND is_warmup = FALSE
  )
  WHERE id = COALESCE(NEW.workout_id, OLD.workout_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_volume_on_insert ON workout_sets;
CREATE TRIGGER sync_volume_on_insert
  AFTER INSERT OR UPDATE OR DELETE ON workout_sets
  FOR EACH ROW EXECUTE FUNCTION sync_workout_volume();

CREATE OR REPLACE FUNCTION check_and_update_pr()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_current_pr_weight NUMERIC;
  v_current_pr_1rm NUMERIC;
  v_estimated_1rm NUMERIC;
BEGIN
  IF NEW.is_warmup = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id
  FROM workouts
  WHERE id = NEW.workout_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.reps >= 1 AND NEW.reps <= 36 THEN
    v_estimated_1rm := NEW.weight * (36.0 / (37.0 - NEW.reps));
  ELSE
    v_estimated_1rm := NEW.weight;
  END IF;

  SELECT weight, (weight * 36.0 / (37.0 - NULLIF(reps, 0)))
  INTO v_current_pr_weight, v_current_pr_1rm
  FROM personal_records
  WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;

  IF NOT FOUND THEN
    INSERT INTO personal_records (user_id, exercise_id, weight, reps, created_at)
    VALUES (v_user_id, NEW.exercise_id, NEW.weight, NEW.reps, NOW())
    ON CONFLICT (user_id, exercise_id) DO NOTHING;
  ELSIF v_estimated_1rm > COALESCE(v_current_pr_1rm, 0) THEN
    UPDATE personal_records
    SET weight = NEW.weight,
        reps = NEW.reps,
        created_at = NOW()
    WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error actualizando PR para exercise_id=%: %', NEW.exercise_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_update_pr ON workout_sets;
CREATE TRIGGER auto_update_pr
  AFTER INSERT OR UPDATE ON workout_sets
  FOR EACH ROW EXECUTE FUNCTION check_and_update_pr();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creando profile para user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- BLOQUE 9: VISTAS PARA QUERIES DE STATS
-- ============================================================

CREATE OR REPLACE VIEW v_daily_volume AS
SELECT
  w.user_id,
  DATE(w.started_at) AS workout_date,
  COALESCE(SUM(ws.weight * ws.reps), 0) AS total_volume_kg,
  COUNT(DISTINCT ws.exercise_id) AS exercises_count,
  COUNT(ws.id) AS sets_count
FROM workouts w
LEFT JOIN workout_sets ws ON ws.workout_id = w.id AND ws.is_warmup = FALSE
GROUP BY w.user_id, DATE(w.started_at);

CREATE OR REPLACE VIEW v_weekly_volume_by_muscle AS
SELECT
  w.user_id,
  DATE_TRUNC('week', w.started_at)::DATE AS week_start,
  e.muscle_group,
  COALESCE(SUM(ws.weight * ws.reps), 0) AS volume_kg,
  COUNT(ws.id) AS sets_count
FROM workouts w
JOIN workout_sets ws ON ws.workout_id = w.id AND ws.is_warmup = FALSE
JOIN exercises e ON e.id = ws.exercise_id
GROUP BY w.user_id, DATE_TRUNC('week', w.started_at), e.muscle_group;

CREATE OR REPLACE VIEW v_last_trained_by_muscle AS
SELECT DISTINCT ON (w.user_id, e.muscle_group)
  w.user_id,
  e.muscle_group,
  MAX(w.started_at) AS last_trained_at,
  EXTRACT(DAY FROM NOW() - MAX(w.started_at)) AS days_since
FROM workouts w
JOIN workout_sets ws ON ws.workout_id = w.id
JOIN exercises e ON e.id = ws.exercise_id
GROUP BY w.user_id, e.muscle_group
ORDER BY w.user_id, e.muscle_group;

CREATE OR REPLACE VIEW v_progression_1rm AS
SELECT
  w.user_id,
  ws.exercise_id,
  DATE(w.started_at) AS session_date,
  MAX(ws.weight) AS max_weight,
  MAX(ws.weight * (36.0 / NULLIF(37.0 - ws.reps, 0))) AS estimated_1rm,
  SUM(ws.weight * ws.reps) AS session_volume_kg
FROM workouts w
JOIN workout_sets ws ON ws.workout_id = w.id
WHERE ws.is_warmup = FALSE
  AND ws.reps BETWEEN 1 AND 36
GROUP BY w.user_id, ws.exercise_id, DATE(w.started_at)
ORDER BY w.user_id, ws.exercise_id, DATE(w.started_at);

DO $$
BEGIN
  RAISE NOTICE 'Vistas creadas correctamente';
END $$;

-- ============================================================
-- BLOQUE 10: DATOS SEMILLA (plantillas de rutina)
-- ============================================================

INSERT INTO routine_templates (name, description, days_data, is_public)
VALUES
  (
    'PPL — Push Pull Legs',
    'Rutina de 6 días dividida en empuje, jalón y piernas. Ideal para intermedio-avanzado.',
    '[
      {"day": "monday", "label": "Push", "focus": ["chest","shoulders","triceps"]},
      {"day": "tuesday", "label": "Pull", "focus": ["back","biceps"]},
      {"day": "wednesday", "label": "Legs", "focus": ["quads","hamstrings","glutes","calves"]},
      {"day": "thursday", "label": "Push", "focus": ["chest","shoulders","triceps"]},
      {"day": "friday", "label": "Pull", "focus": ["back","biceps"]},
      {"day": "saturday", "label": "Legs", "focus": ["quads","hamstrings","glutes","calves"]},
      {"day": "sunday", "label": "Rest", "focus": []}
    ]'::JSONB,
    TRUE
  ),
  (
    'Full Body 3x',
    'Tres días a la semana de cuerpo completo. Perfecto para principiantes.',
    '[
      {"day": "monday", "label": "Full Body A", "focus": ["chest","back","legs","shoulders"]},
      {"day": "wednesday", "label": "Full Body B", "focus": ["chest","back","legs","shoulders"]},
      {"day": "friday", "label": "Full Body C", "focus": ["chest","back","legs","shoulders"]}
    ]'::JSONB,
    TRUE
  ),
  (
    'Upper / Lower',
    'Cuatro días divididos en tren superior e inferior. Ideal para fuerza.',
    '[
      {"day": "monday", "label": "Upper A", "focus": ["chest","back","shoulders","arms"]},
      {"day": "tuesday", "label": "Lower A", "focus": ["quads","hamstrings","glutes"]},
      {"day": "thursday", "label": "Upper B", "focus": ["chest","back","shoulders","arms"]},
      {"day": "friday", "label": "Lower B", "focus": ["quads","hamstrings","glutes"]}
    ]'::JSONB,
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'profiles', 'exercises', 'workouts',
    'workout_sets', 'personal_records', 'user_routines',
    'body_measurements', 'exercise_notes', 'routine_templates'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      RAISE WARNING 'TABLA NO ENCONTRADA: %', v_table;
    ELSE
      RAISE NOTICE '✓ Tabla % OK', v_table;
    END IF;
  END LOOP;
  RAISE NOTICE '=== Migration GymLog v2.0 completada ===';
END $$;