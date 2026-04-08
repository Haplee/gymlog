-- ============================================================
-- GymLog — Schema v2
-- ============================================================

-- 0. Limpiar
DROP TABLE IF EXISTS public.personal_records  CASCADE;
DROP TABLE IF EXISTS public.workout_sets      CASCADE;
DROP TABLE IF EXISTS public.workouts          CASCADE;
DROP TABLE IF EXISTS public.exercises         CASCADE;
DROP TABLE IF EXISTS public.profiles          CASCADE;
DROP TABLE IF EXISTS public.exercise_tags     CASCADE;
DROP TABLE IF EXISTS public.tags              CASCADE;

-- ============================================================
-- 1. Perfiles
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT,
  full_name     TEXT,
  username      TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  weight_unit   TEXT        DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Ejercicios
-- ============================================================
CREATE TABLE public.exercises (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  muscle_group  TEXT        NOT NULL CHECK (muscle_group IN (
                  'Pecho', 'Espalda', 'Hombro',
                  'Pierna', 'Glúteo', 'Brazos', 'Core', 'Cardio', 'Otro'
                )),
  muscle_detail TEXT,        -- ej: 'Cuádriceps', 'Bíceps femoral', 'Deltoides lateral'
  equipment     TEXT        DEFAULT 'Barra' CHECK (equipment IN (
                  'Barra', 'Mancuernas', 'Máquina', 'Polea',
                  'Peso corporal', 'Bandas', 'Kettlebell', 'Otro'
                )),
  movement      TEXT        CHECK (movement IN (
                  'Empuje', 'Tirón', 'Sentadilla', 'Bisagra', 'Aislamiento', 'Core', 'Otro'
                )),
  is_bilateral  BOOLEAN     DEFAULT TRUE,  -- FALSE = ejercicio unilateral (ej: zancadas)
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = global
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, user_id)
);

-- ============================================================
-- 3. Workouts
-- ============================================================
CREATE TABLE public.workouts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT,
  notes         TEXT,
  status        TEXT        DEFAULT 'completed' CHECK (status IN ('active', 'completed')),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  -- Campos calculados y cacheados para no recalcular en cada query de historial
  total_volume  FLOAT       DEFAULT 0,   -- SUM(weight * reps) de todos los sets
  total_sets    INT         DEFAULT 0,
  duration_min  INT                      -- finished_at - started_at en minutos
);

-- ============================================================
-- 4. Series
-- ============================================================
CREATE TABLE public.workout_sets (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id    UUID        REFERENCES public.workouts(id)  ON DELETE CASCADE NOT NULL,
  exercise_id   UUID        REFERENCES public.exercises(id) ON DELETE RESTRICT NOT NULL,
  set_num       INT         NOT NULL CHECK (set_num > 0),
  weight        FLOAT       NOT NULL CHECK (weight >= 0),
  reps          INT         NOT NULL CHECK (reps > 0),
  rir           INT         CHECK (rir BETWEEN 0 AND 5),   -- Reps In Reserve (opcional)
  notes         TEXT,                                       -- "fallo muscular", "asistido"...
  is_pr         BOOLEAN     DEFAULT FALSE,
  one_rm        FLOAT,      -- Brzycki cacheado: weight / (1.0278 - 0.0278 * reps)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Personal Records
-- ============================================================
CREATE TABLE public.personal_records (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        REFERENCES auth.users(id)        ON DELETE CASCADE NOT NULL,
  exercise_id    UUID        REFERENCES public.exercises(id)  ON DELETE CASCADE NOT NULL,
  weight         FLOAT       NOT NULL,
  reps           INT         NOT NULL,
  one_rm         FLOAT,      -- 1RM estimado en el momento del PR
  workout_set_id UUID        REFERENCES public.workout_sets(id) ON DELETE SET NULL,
  achieved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

-- ============================================================
-- 6. Índices
-- ============================================================
CREATE INDEX ON public.workouts        (user_id, started_at DESC);
CREATE INDEX ON public.workouts        (user_id, status);
CREATE INDEX ON public.workout_sets    (workout_id);
CREATE INDEX ON public.workout_sets    (exercise_id);
CREATE INDEX ON public.workout_sets    (workout_id, exercise_id);
CREATE INDEX ON public.personal_records(user_id, exercise_id);
CREATE INDEX ON public.exercises       (muscle_group);
CREATE INDEX ON public.exercises       (user_id);

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

-- exercises: globales visibles a todos, personales solo al dueño
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
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 9. Trigger: detectar PR + cachear 1RM + actualizar totales del workout
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_new_set()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    UUID;
  v_current_pr FLOAT;
  v_one_rm     FLOAT;
BEGIN
  -- Usuario del workout
  SELECT w.user_id INTO v_user_id
  FROM public.workouts w WHERE w.id = NEW.workout_id;

  -- Calcular 1RM Brzycki
  IF NEW.reps = 1 THEN
    v_one_rm := NEW.weight;
  ELSE
    v_one_rm := ROUND((NEW.weight / (1.0278 - 0.0278 * NEW.reps))::NUMERIC, 2);
  END IF;

  -- Cachear 1RM en el set
  UPDATE public.workout_sets SET one_rm = v_one_rm WHERE id = NEW.id;

  -- Comprobar PR
  SELECT weight INTO v_current_pr
  FROM public.personal_records
  WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;

  IF v_current_pr IS NULL OR NEW.weight > v_current_pr THEN
    INSERT INTO public.personal_records (user_id, exercise_id, weight, reps, one_rm, workout_set_id)
    VALUES (v_user_id, NEW.exercise_id, NEW.weight, NEW.reps, v_one_rm, NEW.id)
    ON CONFLICT (user_id, exercise_id)
    DO UPDATE SET
      weight         = NEW.weight,
      reps           = NEW.reps,
      one_rm         = v_one_rm,
      workout_set_id = NEW.id,
      achieved_at    = NOW();

    UPDATE public.workout_sets SET is_pr = TRUE WHERE id = NEW.id;
  END IF;

  -- Actualizar totales cacheados en el workout
  UPDATE public.workouts
  SET
    total_volume = total_volume + (NEW.weight * NEW.reps),
    total_sets   = total_sets + 1
  WHERE id = NEW.workout_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_set_inserted ON public.workout_sets;
CREATE TRIGGER on_set_inserted
  AFTER INSERT ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.process_new_set();

-- ============================================================
-- 10. Trigger: calcular duración al completar workout
-- ============================================================
CREATE OR REPLACE FUNCTION public.finish_workout()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' AND NEW.finished_at IS NOT NULL THEN
    NEW.duration_min := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workout_finished ON public.workouts;
CREATE TRIGGER on_workout_finished
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.finish_workout();

-- ============================================================
-- 11. Ejercicios globales (muscle_detail + equipment + movement)
-- ============================================================
INSERT INTO public.exercises (name, muscle_group, muscle_detail, equipment, movement, is_bilateral) VALUES
  -- Pecho
  ('Press banca',               'Pecho',    'Pectoral mayor',        'Barra',         'Empuje',     TRUE),
  ('Press banca inclinado',     'Pecho',    'Pectoral superior',     'Barra',         'Empuje',     TRUE),
  ('Press banca declinado',     'Pecho',    'Pectoral inferior',     'Barra',         'Empuje',     TRUE),
  ('Press con mancuernas',      'Pecho',    'Pectoral mayor',        'Mancuernas',    'Empuje',     TRUE),
  ('Aperturas con mancuernas',  'Pecho',    'Pectoral mayor',        'Mancuernas',    'Aislamiento',TRUE),
  ('Aperturas en polea',        'Pecho',    'Pectoral mayor',        'Polea',         'Aislamiento',TRUE),
  ('Fondos en paralelas',       'Pecho',    'Pectoral inferior',     'Peso corporal', 'Empuje',     TRUE),
  -- Espalda
  ('Dominadas',                 'Espalda',  'Dorsal ancho',          'Peso corporal', 'Tirón',      TRUE),
  ('Jalón al pecho',            'Espalda',  'Dorsal ancho',          'Polea',         'Tirón',      TRUE),
  ('Remo con barra',            'Espalda',  'Dorsal / Trapecio',     'Barra',         'Tirón',      TRUE),
  ('Remo con mancuerna',        'Espalda',  'Dorsal ancho',          'Mancuernas',    'Tirón',      FALSE),
  ('Remo en polea baja',        'Espalda',  'Dorsal / Romboides',    'Polea',         'Tirón',      TRUE),
  ('Peso muerto',               'Espalda',  'Erector espinal',       'Barra',         'Bisagra',    TRUE),
  ('Peso muerto rumano',        'Espalda',  'Erector / Isquiotibial','Barra',         'Bisagra',    TRUE),
  -- Hombro
  ('Press militar',             'Hombro',   'Deltoides anterior',    'Barra',         'Empuje',     TRUE),
  ('Press Arnold',              'Hombro',   'Deltoides completo',    'Mancuernas',    'Empuje',     TRUE),
  ('Elevaciones laterales',     'Hombro',   'Deltoides lateral',     'Mancuernas',    'Aislamiento',TRUE),
  ('Elevaciones frontales',     'Hombro',   'Deltoides anterior',    'Mancuernas',    'Aislamiento',TRUE),
  ('Pájaros',                   'Hombro',   'Deltoides posterior',   'Mancuernas',    'Aislamiento',TRUE),
  ('Face pull',                 'Hombro',   'Deltoides posterior',   'Polea',         'Tirón',      TRUE),
  -- Pierna
  ('Sentadilla',                'Pierna',   'Cuádriceps',            'Barra',         'Sentadilla', TRUE),
  ('Sentadilla búlgara',        'Pierna',   'Cuádriceps',            'Mancuernas',    'Sentadilla', FALSE),
  ('Prensa de piernas',         'Pierna',   'Cuádriceps / Glúteo',   'Máquina',       'Sentadilla', TRUE),
  ('Extensiones de cuádriceps', 'Pierna',   'Cuádriceps',            'Máquina',       'Aislamiento',TRUE),
  ('Curl femoral tumbado',      'Pierna',   'Isquiotibiales',        'Máquina',       'Aislamiento',TRUE),
  ('Curl femoral de pie',       'Pierna',   'Isquiotibiales',        'Máquina',       'Aislamiento',FALSE),
  ('Zancadas',                  'Pierna',   'Cuádriceps / Glúteo',   'Mancuernas',    'Sentadilla', FALSE),
  ('Gemelos de pie',            'Pierna',   'Gastrocnemio',          'Máquina',       'Aislamiento',TRUE),
  ('Gemelos sentado',           'Pierna',   'Sóleo',                 'Máquina',       'Aislamiento',TRUE),
  -- Glúteo
  ('Hip thrust',                'Glúteo',   'Glúteo mayor',          'Barra',         'Bisagra',    TRUE),
  ('Patada trasera en polea',   'Glúteo',   'Glúteo mayor',          'Polea',         'Aislamiento',FALSE),
  ('Abducción de cadera',       'Glúteo',   'Glúteo medio',          'Máquina',       'Aislamiento',TRUE),
  -- Brazos
  ('Curl bíceps barra',         'Brazos',   'Bíceps',                'Barra',         'Tirón',      TRUE),
  ('Curl bíceps mancuerna',     'Brazos',   'Bíceps',                'Mancuernas',    'Tirón',      FALSE),
  ('Curl martillo',             'Brazos',   'Braquial / Bíceps',     'Mancuernas',    'Tirón',      FALSE),
  ('Curl en polea baja',        'Brazos',   'Bíceps',                'Polea',         'Tirón',      TRUE),
  ('Press francés',             'Brazos',   'Tríceps',               'Barra',         'Empuje',     TRUE),
  ('Tríceps polea',             'Brazos',   'Tríceps',               'Polea',         'Empuje',     TRUE),
  ('Patada de tríceps',         'Brazos',   'Tríceps',               'Mancuernas',    'Empuje',     FALSE),
  ('Fondos en banco',           'Brazos',   'Tríceps',               'Peso corporal', 'Empuje',     TRUE),
  -- Core
  ('Plancha',                   'Core',     'Transverso abdominal',  'Peso corporal', 'Core',       TRUE),
  ('Crunch abdominal',          'Core',     'Recto abdominal',       'Peso corporal', 'Core',       TRUE),
  ('Rueda abdominal',           'Core',     'Recto abdominal',       'Peso corporal', 'Core',       TRUE),
  ('Elevación de piernas',      'Core',     'Recto abdominal',       'Peso corporal', 'Core',       TRUE),
  ('Russian twist',             'Core',     'Oblicuos',              'Peso corporal', 'Core',       TRUE)
ON CONFLICT DO NOTHING;