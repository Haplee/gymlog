-- ============================================================
-- GymLog v2.0 — Migración aditiva
-- Ejecutar en Supabase Dashboard > SQL Editor
-- IMPORTANTE: Solo añade columnas/tablas — no elimina nada
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. exercises — nuevas columnas v2
-- ──────────────────────────────────────────────
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS equipment TEXT
    CHECK (equipment IN ('barbell','dumbbell','machine','bodyweight','cable','other')),
  ADD COLUMN IF NOT EXISTS is_compound BOOLEAN DEFAULT false;

-- ──────────────────────────────────────────────
-- 2. workout_sets — nuevas columnas v2
-- ──────────────────────────────────────────────
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS rpe SMALLINT
    CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN DEFAULT false;
-- NOTA: 'notes' ya existe en la tabla según el codebase actual

-- ──────────────────────────────────────────────
-- 3. workouts — nuevas columnas v2
-- ──────────────────────────────────────────────
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS rating SMALLINT
    CHECK (rating BETWEEN 1 AND 5);

-- ──────────────────────────────────────────────
-- 4. profiles — columnas onboarding + avatar
-- ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal TEXT
    CHECK (goal IN ('volume','strength','endurance','fat_loss')),
  ADD COLUMN IF NOT EXISTS days_per_week SMALLINT
    CHECK (days_per_week BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS equipment_available TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- ──────────────────────────────────────────────
-- 5. body_measurements — nueva tabla
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  weight_kg       NUMERIC(5,2),
  body_fat_pct    NUMERIC(4,1) CHECK (body_fat_pct BETWEEN 0 AND 100),
  muscle_mass_kg  NUMERIC(5,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 6. exercise_notes — nueva tabla
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- 7. Row Level Security — habilitar y políticas
-- ──────────────────────────────────────────────

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- exercises (globales = user_id IS NULL, propios = user_id = auth.uid())
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercises_read" ON exercises;
DROP POLICY IF EXISTS "exercises_insert_own" ON exercises;
DROP POLICY IF EXISTS "exercises_update_own" ON exercises;
DROP POLICY IF EXISTS "exercises_delete_own" ON exercises;
CREATE POLICY "exercises_read" ON exercises FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "exercises_insert_own" ON exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercises_update_own" ON exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "exercises_delete_own" ON exercises FOR DELETE USING (auth.uid() = user_id);

-- workouts
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workouts_all_own" ON workouts;
CREATE POLICY "workouts_all_own" ON workouts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- workout_sets (acceso via workout)
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_sets_all_own" ON workout_sets;
CREATE POLICY "workout_sets_all_own" ON workout_sets
  USING (
    EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
  );

-- personal_records
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pr_all_own" ON personal_records;
CREATE POLICY "pr_all_own" ON personal_records USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_routines
ALTER TABLE user_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routines_all_own" ON user_routines;
CREATE POLICY "routines_all_own" ON user_routines USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- body_measurements
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "measurements_all_own" ON body_measurements;
CREATE POLICY "measurements_all_own" ON body_measurements USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- exercise_notes
ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_notes_all_own" ON exercise_notes;
CREATE POLICY "exercise_notes_all_own" ON exercise_notes USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 8. Storage bucket avatars
-- ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- ──────────────────────────────────────────────
-- 9. Índices de rendimiento
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON body_measurements(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_notes_exercise ON exercise_notes(exercise_id);
