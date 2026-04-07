-- ============================================================
-- GymLog — Schema completo
-- Ejecutar entero en Supabase SQL Editor
-- ============================================================

-- 0. Limpiar todo si ya existe
DROP TABLE IF EXISTS public.personal_records  CASCADE;
DROP TABLE IF EXISTS public.workout_sets      CASCADE;
DROP TABLE IF EXISTS public.workouts          CASCADE;
DROP TABLE IF EXISTS public.exercises         CASCADE;
DROP TABLE IF EXISTS public.profiles          CASCADE;

-- ============================================================
-- 1. Perfiles (extiende auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username   TEXT,
  avatar_url TEXT,
  bio        TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Ejercicios (globales + personales)
-- ============================================================
CREATE TABLE public.exercises (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  muscle_group TEXT,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = global
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, user_id)
);

-- ============================================================
-- 3. Sesiones de entrenamiento
-- ============================================================
CREATE TABLE public.workouts (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT,
  notes       TEXT,
  status      TEXT        DEFAULT 'completed' CHECK (status IN ('active', 'completed')),
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- ============================================================
-- 4. Series registradas
-- ============================================================
CREATE TABLE public.workout_sets (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id  UUID        REFERENCES public.workouts(id)  ON DELETE CASCADE NOT NULL,
  exercise_id UUID        REFERENCES public.exercises(id) ON DELETE RESTRICT NOT NULL,
  set_num     INT         NOT NULL CHECK (set_num > 0),
  weight      FLOAT       NOT NULL CHECK (weight >= 0),
  reps        INT         NOT NULL CHECK (reps > 0),
  is_pr       BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Personal Records (tabla dedicada para badges y gráficos)
-- ============================================================
CREATE TABLE public.personal_records (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        REFERENCES auth.users(id)       ON DELETE CASCADE NOT NULL,
  exercise_id    UUID        REFERENCES public.exercises(id)  ON DELETE CASCADE NOT NULL,
  weight         FLOAT       NOT NULL,
  reps           INT         NOT NULL,
  workout_set_id UUID        REFERENCES public.workout_sets(id) ON DELETE SET NULL,
  achieved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id) -- solo el PR actual por ejercicio
);

-- ============================================================
-- 6. Índices para historial y estadísticas
-- ============================================================
CREATE INDEX ON public.workouts        (user_id, started_at DESC);
CREATE INDEX ON public.workout_sets    (workout_id);
CREATE INDEX ON public.workout_sets    (exercise_id);
CREATE INDEX ON public.personal_records(user_id, exercise_id);

-- ============================================================
-- 7. Row Level Security
-- ============================================================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- exercises: globales visibles a todos, propias solo al dueño
CREATE POLICY "exercises_select" ON public.exercises
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "exercises_insert" ON public.exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercises_update" ON public.exercises
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "exercises_delete" ON public.exercises
  FOR DELETE USING (auth.uid() = user_id);

-- workouts
CREATE POLICY "workouts_all" ON public.workouts
  FOR ALL USING (auth.uid() = user_id);

-- workout_sets (acceso vía join con workouts)
CREATE POLICY "sets_all" ON public.workout_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE id = workout_sets.workout_id AND user_id = auth.uid()
    )
  );

-- personal_records
CREATE POLICY "pr_all" ON public.personal_records
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. Trigger: auto-crear perfil al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 9. Trigger: detectar y marcar PR automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_personal_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_current_pr FLOAT;
BEGIN
  SELECT w.user_id INTO v_user_id
  FROM public.workouts w WHERE w.id = NEW.workout_id;

  SELECT weight INTO v_current_pr
  FROM public.personal_records
  WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;

  IF v_current_pr IS NULL OR NEW.weight > v_current_pr THEN
    INSERT INTO public.personal_records (user_id, exercise_id, weight, reps, workout_set_id)
    VALUES (v_user_id, NEW.exercise_id, NEW.weight, NEW.reps, NEW.id)
    ON CONFLICT (user_id, exercise_id)
    DO UPDATE SET weight = NEW.weight, reps = NEW.reps,
                  workout_set_id = NEW.id, achieved_at = NOW();

    UPDATE public.workout_sets SET is_pr = TRUE WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_set_inserted ON public.workout_sets;
CREATE TRIGGER on_set_inserted
  AFTER INSERT ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.check_personal_record();

-- ============================================================
-- 10. Ejercicios globales predefinidos (30+)
-- ============================================================
INSERT INTO public.exercises (name, muscle_group) VALUES
  -- Pecho
  ('Press banca', 'Pecho'),
  ('Press banca inclinado', 'Pecho'),
  ('Press banca declinado', 'Pecho'),
  ('Aperturas con mancuernas', 'Pecho'),
  ('Fondos en paralelas', 'Pecho'),
  -- Espalda
  ('Dominadas', 'Espalda'),
  ('Remo con barra', 'Espalda'),
  ('Remo con mancuerna', 'Espalda'),
  ('Jalón al pecho', 'Espalda'),
  ('Peso muerto', 'Espalda/Pierna'),
  ('Peso muerto rumano', 'Espalda/Pierna'),
  -- Hombro
  ('Press militar', 'Hombro'),
  ('Elevaciones laterales', 'Hombro'),
  ('Elevaciones frontales', 'Hombro'),
  ('Pájaros', 'Hombro'),
  -- Pierna
  ('Sentadilla', 'Pierna'),
  ('Sentadilla búlgara', 'Pierna'),
  ('Prensa de piernas', 'Pierna'),
  ('Extensiones de cuádriceps', 'Pierna'),
  ('Curl femoral tumbado', 'Pierna'),
  ('Hip thrust', 'Pierna/Glúteo'),
  ('Zancadas', 'Pierna'),
  ('Gemelos de pie', 'Pierna'),
  -- Brazos
  ('Curl bíceps barra', 'Brazos'),
  ('Curl bíceps mancuerna', 'Brazos'),
  ('Curl martillo', 'Brazos'),
  ('Press francés', 'Brazos'),
  ('Tríceps polea', 'Brazos'),
  ('Fondos en banco', 'Brazos'),
  -- Core
  ('Plancha', 'Core'),
  ('Crunch abdominal', 'Core'),
  ('Rueda abdominal', 'Core')
ON CONFLICT DO NOTHING;