-- ============================================================
-- GymLog v2 — Migración: workout_exercises + notas
-- Añade la tabla pivot para gestionar ejercicios dentro
-- de workouts, junto con notas por ejercicio.
-- ============================================================

-- 0. Tabla de notas por ejercicio (ya existe? crearla si no)
CREATE TABLE IF NOT EXISTS public.exercise_notes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id   UUID        REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  note          TEXT        NOT NULL CHECK (char_length(note) > 0 AND char_length(note) <= 500),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exercise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_notes_all" ON public.exercise_notes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exercise_notes_exercise ON public.exercise_notes(exercise_id);

-- 1. Tabla pivot: ejercicios dentro de workouts
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id    UUID        REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_id   UUID        REFERENCES public.exercises(id) ON DELETE RESTRICT NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_index INT         DEFAULT 0 CHECK (order_index >= 0),
  notes       TEXT,                                      -- Notas específicas del ejercicio en este workout
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workout_id, exercise_id)
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON public.workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_user ON public.workout_exercises(user_id);

-- 3. Row Level Security
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

-- Solo el owner puede ver/manejar sus workout_exercises
CREATE POLICY "workout_exercises_select" ON public.workout_exercises
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workout_exercises_insert" ON public.workout_exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_exercises_update" ON public.workout_exercises
  FOR UPDATE USING (auth.uid() = user_id);

-- IMPORTANTE: Solo puede borrar quien creó el ejercicio en el workout
CREATE POLICY "workout_exercises_delete" ON public.workout_exercises
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Trigger: actualizar totales cuando se añade/borra ejercicio
CREATE OR REPLACE FUNCTION public.sync_workout_exercise_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Al borrar, restar las series de ese ejercicio del total
    UPDATE public.workouts w
    SET
      total_volume = total_volume - (
        SELECT COALESCE(SUM(ws.weight * ws.reps), 0)
        FROM public.workout_sets ws
        WHERE ws.workout_id = OLD.workout_id AND ws.exercise_id = OLD.exercise_id
      ),
      total_sets = total_sets - (
        SELECT COUNT(*)
        FROM public.workout_sets ws
        WHERE ws.workout_id = OLD.workout_id AND ws.exercise_id = OLD.exercise_id
      )
    WHERE w.id = OLD.workout_id;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workout_exercise_deleted ON public.workout_exercises;
CREATE TRIGGER on_workout_exercise_deleted
  AFTER DELETE ON public.workout_exercises
  FOR EACH ROW EXECUTE FUNCTION public.sync_workout_exercise_totals();

-- 5. Notas (ya existe tabla: solo aseguramos RLS si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'exercise_notes_all'
  ) THEN
    -- RLS para exercise_notes (si la tabla existe)
    EXECUTE '
      CREATE POLICY "exercise_notes_all" ON public.exercise_notes
        FOR ALL USING (auth.uid() = user_id);
    ';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END
$$;

-- ============================================================
-- Notas de la migración:
-- - Cada workout puede tener múltiples ejercicios
-- - Un ejercicio solo puede borrarse del workout por quien lo añadió
-- - Las notas se guardan por ejercicio dentro del workout (no confunde con notas globales)
-- - El order_index permite reordenar ejercicios drag-and-drop
-- ============================================================