-- ============================================================
-- GymLog — Baseline schema (squashed)
-- Proyecto: eoltmipoklizewxdpzfa
--
-- Esta migración es el estado COMPLETO del esquema de producción,
-- consolidado en un único baseline para que Supabase Branching pueda
-- reconstruir el esquema desde cero (Branching 2.0 usa los ficheros de
-- migración, no un dump). Sustituye al historial fragmentado anterior.
-- Idempotente donde es posible.
-- ============================================================

-- ── Extensiones ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

-- profiles ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email                text,
  full_name            text,
  username             text,
  avatar_url           text,
  bio                  text,
  weight_unit          text DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  updated_at           timestamptz DEFAULT now(),
  goal                 text CHECK (goal IN ('volume', 'strength', 'endurance', 'fat_loss')),
  days_per_week        smallint CHECK (days_per_week >= 1 AND days_per_week <= 7),
  equipment_available  text[] DEFAULT '{}'::text[],
  onboarding_completed boolean NOT NULL DEFAULT false,
  weight_kg            numeric(5,2) CHECK (weight_kg > 0 AND weight_kg < 500),
  height_cm            smallint CHECK (height_cm > 0 AND height_cm < 300),
  birth_year           smallint CHECK (birth_year >= 1920 AND birth_year <= 2015),
  sex                  text CHECK (sex IN ('male', 'female', 'other'))
);

-- exercises ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  muscle_group text NOT NULL CHECK (muscle_group IN ('Pecho','Espalda','Hombro','Pierna','Glúteo','Brazos','Bíceps','Tríceps','Antebrazo','Core','Cardio','Otro')),
  muscle_detail text,
  equipment    text DEFAULT 'Barra' CHECK (equipment IN ('Barra','Mancuernas','Máquina','Polea','Peso corporal','Bandas','Kettlebell','Otro')),
  movement     text CHECK (movement IN ('Empuje','Tirón','Sentadilla','Bisagra','Aislamiento','Core','Otro')),
  is_bilateral boolean DEFAULT true,
  user_id      uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  is_compound  boolean NOT NULL DEFAULT false,
  description  text,
  is_public    boolean NOT NULL DEFAULT false,
  media_url    text CHECK (media_url IS NULL OR char_length(media_url) <= 500),
  UNIQUE (name, user_id)
);

-- workouts ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name             text,
  notes            text,
  status           text DEFAULT 'completed' CHECK (status IN ('active', 'completed')),
  started_at       timestamptz DEFAULT now(),
  finished_at      timestamptz,
  total_volume     double precision DEFAULT 0,
  total_sets       integer DEFAULT 0,
  duration_min     integer,
  duration_seconds integer CHECK (duration_seconds >= 0),
  rating           smallint CHECK (rating >= 1 AND rating <= 5),
  total_volume_kg  numeric(10,2) DEFAULT 0 CHECK (total_volume_kg >= 0)
);

-- workout_sets ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id       uuid NOT NULL REFERENCES public.workouts (id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES public.exercises (id) ON DELETE RESTRICT,
  set_num          integer NOT NULL CHECK (set_num > 0),
  weight           double precision NOT NULL CHECK (weight >= 0),
  reps             integer NOT NULL CHECK (reps > 0),
  rir              integer CHECK (rir >= 0 AND rir <= 5),
  notes            text,
  is_pr            boolean DEFAULT false,
  one_rm           double precision,
  created_at       timestamptz DEFAULT now(),
  rpe              smallint CHECK (rpe >= 1 AND rpe <= 10),
  is_warmup        boolean NOT NULL DEFAULT false,
  duration_seconds integer CHECK (duration_seconds >= 0),
  set_type         text NOT NULL DEFAULT 'normal' CHECK (set_type IN ('normal', 'dropset', 'rest_pause', 'amrap')),
  CONSTRAINT workout_sets_reps_positive CHECK (reps > 0 AND reps <= 9999)
);

-- personal_records --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id    uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  weight         double precision NOT NULL,
  reps           integer NOT NULL,
  one_rm         double precision,
  workout_set_id uuid REFERENCES public.workout_sets (id) ON DELETE SET NULL,
  achieved_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

-- user_routines -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_routines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  routine    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- body_measurements -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date           date NOT NULL,
  weight_kg      numeric(5,2) CHECK (weight_kg > 0 AND weight_kg < 500),
  body_fat_pct   numeric(4,1) CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  muscle_mass_kg numeric(5,2) CHECK (muscle_mass_kg >= 0),
  notes          text CHECK (char_length(notes) <= 1000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
COMMENT ON TABLE public.body_measurements IS 'Medidas corporales periódicas del usuario';

-- exercise_notes ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_notes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  note        text NOT NULL CHECK (char_length(note) >= 1 AND char_length(note) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.exercise_notes IS 'Notas libres del usuario por ejercicio';

-- routine_templates -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.routine_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description text CHECK (char_length(description) <= 500),
  days_data   jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.routine_templates IS 'Plantillas de rutina predefinidas (PPL, Full Body, etc.)';

-- cardio_sessions ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cardio_sessions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('running','cycling','rowing','swimming','elliptical','walking','jump_rope','other')),
  started_at timestamptz NOT NULL,
  duration   integer NOT NULL CHECK (duration >= 0),
  distance   numeric(7,2) CHECK (distance IS NULL OR distance >= 0),
  calories   integer CHECK (calories IS NULL OR calories >= 0),
  notes      text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cardio_sessions IS 'Cardio sessions tracked by user';

-- exercise_goals ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  target_one_rm numeric NOT NULL CHECK (target_one_rm > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

-- push_tokens -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_measurements_user_date ON public.body_measurements USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_user_started ON public.cardio_sessions USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_user_type ON public.cardio_sessions USING btree (user_id, type);
CREATE INDEX IF NOT EXISTS exercise_goals_user_idx ON public.exercise_goals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_notes_user_exercise ON public.exercise_notes USING btree (user_id, exercise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exercises_muscle_group_idx ON public.exercises USING btree (muscle_group);
CREATE INDEX IF NOT EXISTS exercises_user_id_idx ON public.exercises USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON public.exercises USING btree (muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_public ON public.exercises USING btree (is_public) WHERE (is_public = true);
CREATE INDEX IF NOT EXISTS idx_exercises_user ON public.exercises USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_prs_user_exercise ON public.personal_records USING btree (user_id, exercise_id);
CREATE INDEX IF NOT EXISTS personal_records_user_id_exercise_id_idx ON public.personal_records USING btree (user_id, exercise_id);
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_key ON public.push_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_routines_user ON public.user_routines USING btree (user_id);
CREATE INDEX IF NOT EXISTS user_routines_user_id_idx ON public.user_routines USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_created ON public.workout_sets USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON public.workout_sets USING btree (exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_stats ON public.workout_sets USING btree (exercise_id, created_at DESC) WHERE (is_warmup = false);
CREATE INDEX IF NOT EXISTS idx_workout_sets_with_notes ON public.workout_sets USING btree (workout_id) WHERE (notes IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON public.workout_sets USING btree (workout_id);
CREATE INDEX IF NOT EXISTS workout_sets_exercise_id_idx ON public.workout_sets USING btree (exercise_id);
CREATE INDEX IF NOT EXISTS workout_sets_workout_id_exercise_id_idx ON public.workout_sets USING btree (workout_id, exercise_id);
CREATE INDEX IF NOT EXISTS workout_sets_workout_id_idx ON public.workout_sets USING btree (workout_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON public.workouts USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_user_finished ON public.workouts USING btree (user_id, finished_at DESC) WHERE (finished_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON public.workouts USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS workouts_user_id_started_at_idx ON public.workouts USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS workouts_user_id_status_idx ON public.workouts USING btree (user_id, status);

-- ============================================================
-- FUNCIONES
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.finish_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' AND NEW.finished_at IS NOT NULL THEN
    NEW.duration_min := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.autoclassify_muscle_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_workout_volume()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.check_and_update_pr()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_pr_1rm NUMERIC;
  v_estimated_1rm NUMERIC;
BEGIN
  IF NEW.is_warmup = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM workouts WHERE id = NEW.workout_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.reps >= 1 AND NEW.reps <= 36 THEN
    v_estimated_1rm := NEW.weight * (36.0 / (37.0 - NEW.reps));
  ELSE
    v_estimated_1rm := NEW.weight;
  END IF;

  SELECT one_rm INTO v_current_pr_1rm
  FROM personal_records
  WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;

  IF NOT FOUND THEN
    INSERT INTO personal_records (user_id, exercise_id, weight, reps, one_rm, workout_set_id, achieved_at)
    VALUES (v_user_id, NEW.exercise_id, NEW.weight, NEW.reps, v_estimated_1rm, NEW.id, NOW())
    ON CONFLICT (user_id, exercise_id) DO NOTHING;
  ELSIF v_estimated_1rm > COALESCE(v_current_pr_1rm, 0) THEN
    UPDATE personal_records
    SET weight = NEW.weight,
        reps = NEW.reps,
        one_rm = v_estimated_1rm,
        workout_set_id = NEW.id,
        achieved_at = NOW()
    WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error actualizando PR para exercise_id=%: %', NEW.exercise_id, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_personal_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.process_new_set()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id    UUID;
  v_current_pr FLOAT;
  v_one_rm     FLOAT;
BEGIN
  SELECT w.user_id INTO v_user_id
  FROM public.workouts w WHERE w.id = NEW.workout_id;

  IF NEW.reps = 1 THEN
    v_one_rm := NEW.weight;
  ELSE
    v_one_rm := ROUND((NEW.weight / (1.0278 - 0.0278 * NEW.reps))::NUMERIC, 2);
  END IF;

  UPDATE public.workout_sets SET one_rm = v_one_rm WHERE id = NEW.id;

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

  UPDATE public.workouts
  SET
    total_volume = total_volume + (NEW.weight * NEW.reps),
    total_sets   = total_sets + 1
  WHERE id = NEW.workout_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_volume_by_muscle_group(user_uuid uuid)
 RETURNS TABLE(muscle_group text, total_volume numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT e.muscle_group, SUM(ws.reps * ws.weight)::NUMERIC as total_volume
  FROM workout_sets ws
  JOIN exercises e ON ws.exercise_id = e.id
  JOIN workouts w ON ws.workout_id = w.id
  WHERE w.user_id = user_uuid
  GROUP BY e.muscle_group;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, muscle_group text, user_id uuid, created_at timestamp with time zone, usage_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    e.id,
    e.name,
    e.muscle_group,
    e.user_id,
    e.created_at,
    COALESCE(u.usage_count, 0) AS usage_count
  FROM exercises e
  LEFT JOIN (
    SELECT ws.exercise_id, COUNT(*)::BIGINT AS usage_count
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = p_user_id
    GROUP BY ws.exercise_id
  ) u ON u.exercise_id = e.id
  WHERE e.user_id = p_user_id OR e.user_id IS NULL
  ORDER BY COALESCE(u.usage_count, 0) DESC, e.name;
$function$;

CREATE OR REPLACE FUNCTION public.save_workout_with_sets(p_user_id uuid, p_exercise_id uuid, p_started_at timestamp with time zone, p_finished_at timestamp with time zone, p_sets jsonb)
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
$function$;

CREATE OR REPLACE FUNCTION public.get_workouts_with_sets(p_user_id uuid, p_limit integer DEFAULT 200, p_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(w_obj ORDER BY sort_key DESC), '[]'::jsonb)
  FROM (
    SELECT
      w.started_at AS sort_key,
      to_jsonb(w) || jsonb_build_object(
        'sets',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',          s.id,
              'weight',      s.weight,
              'reps',        s.reps,
              'set_num',     s.set_num,
              'exercise_id', s.exercise_id,
              'workout_id',  s.workout_id,
              'created_at',  s.created_at,
              'notes',       s.notes,
              'is_warmup',   s.is_warmup,
              'rpe',         s.rpe,
              'exercise',    jsonb_build_object('name', e.name, 'muscle_group', e.muscle_group),
              'workout',     jsonb_build_object('started_at', w.started_at)
            )
            ORDER BY s.created_at DESC
          )
          FROM public.workout_sets s
          LEFT JOIN public.exercises e ON e.id = s.exercise_id
          WHERE s.workout_id = w.id
        ), '[]'::jsonb)
      ) AS w_obj
    FROM public.workouts w
    WHERE w.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND (p_cursor IS NULL OR w.started_at < p_cursor)
    ORDER BY w.started_at DESC
    LIMIT p_limit
  ) sub;
$function$;

CREATE OR REPLACE FUNCTION public.touch_exercise_goals_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_push_tokens_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS exercises_autoclassify ON public.exercises;
CREATE TRIGGER exercises_autoclassify BEFORE INSERT ON public.exercises FOR EACH ROW EXECUTE FUNCTION autoclassify_muscle_group();

DROP TRIGGER IF EXISTS on_workout_finished ON public.workouts;
CREATE TRIGGER on_workout_finished BEFORE UPDATE ON public.workouts FOR EACH ROW EXECUTE FUNCTION finish_workout();

DROP TRIGGER IF EXISTS auto_update_pr ON public.workout_sets;
CREATE TRIGGER auto_update_pr AFTER INSERT OR UPDATE ON public.workout_sets FOR EACH ROW EXECUTE FUNCTION check_and_update_pr();

DROP TRIGGER IF EXISTS on_set_inserted ON public.workout_sets;
CREATE TRIGGER on_set_inserted AFTER INSERT ON public.workout_sets FOR EACH ROW EXECUTE FUNCTION process_new_set();

DROP TRIGGER IF EXISTS sync_volume_on_insert ON public.workout_sets;
CREATE TRIGGER sync_volume_on_insert AFTER INSERT OR DELETE OR UPDATE ON public.workout_sets FOR EACH ROW EXECUTE FUNCTION sync_workout_volume();

DROP TRIGGER IF EXISTS trg_exercise_goals_updated_at ON public.exercise_goals;
CREATE TRIGGER trg_exercise_goals_updated_at BEFORE UPDATE ON public.exercise_goals FOR EACH ROW EXECUTE FUNCTION touch_exercise_goals_updated_at();

DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER trg_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION touch_push_tokens_updated_at();

-- on_auth_user_created vive en auth.users (alta de usuario → crea profile).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- VISTAS (security_invoker = on)
-- ============================================================
CREATE OR REPLACE VIEW public.v_daily_volume
WITH (security_invoker = on) AS
 SELECT w.user_id,
    date(w.started_at) AS workout_date,
    COALESCE(sum(ws.weight * ws.reps::double precision), 0::double precision) AS total_volume_kg,
    count(DISTINCT ws.exercise_id) AS exercises_count,
    count(ws.id) AS sets_count
   FROM workouts w
     LEFT JOIN workout_sets ws ON ws.workout_id = w.id AND ws.is_warmup = false
  GROUP BY w.user_id, (date(w.started_at));

CREATE OR REPLACE VIEW public.v_weekly_volume_by_muscle
WITH (security_invoker = on) AS
 SELECT w.user_id,
    date_trunc('week'::text, w.started_at)::date AS week_start,
    e.muscle_group,
    COALESCE(sum(ws.weight * ws.reps::double precision), 0::double precision) AS volume_kg,
    count(ws.id) AS sets_count
   FROM workouts w
     JOIN workout_sets ws ON ws.workout_id = w.id AND ws.is_warmup = false
     JOIN exercises e ON e.id = ws.exercise_id
  GROUP BY w.user_id, (date_trunc('week'::text, w.started_at)), e.muscle_group;

CREATE OR REPLACE VIEW public.v_last_trained_by_muscle
WITH (security_invoker = on) AS
 SELECT DISTINCT ON (w.user_id, e.muscle_group) w.user_id,
    e.muscle_group,
    max(w.started_at) AS last_trained_at,
    EXTRACT(day FROM now() - max(w.started_at)) AS days_since
   FROM workouts w
     JOIN workout_sets ws ON ws.workout_id = w.id
     JOIN exercises e ON e.id = ws.exercise_id
  GROUP BY w.user_id, e.muscle_group
  ORDER BY w.user_id, e.muscle_group;

CREATE OR REPLACE VIEW public.v_progression_1rm
WITH (security_invoker = on) AS
 SELECT w.user_id,
    ws.exercise_id,
    date(w.started_at) AS session_date,
    max(ws.weight) AS max_weight,
    max(ws.weight * (36.0 / NULLIF(37.0 - ws.reps::numeric, 0::numeric))::double precision) AS estimated_1rm,
    sum(ws.weight * ws.reps::double precision) AS session_volume_kg
   FROM workouts w
     JOIN workout_sets ws ON ws.workout_id = w.id
  WHERE ws.is_warmup = false AND ws.reps >= 1 AND ws.reps <= 36
  GROUP BY w.user_id, ws.exercise_id, (date(w.started_at))
  ORDER BY w.user_id, ws.exercise_id, (date(w.started_at));

-- ============================================================
-- ROW LEVEL SECURITY + POLÍTICAS
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardio_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_goals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens       ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO public USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO public USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_own ON public.profiles FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- exercises
DROP POLICY IF EXISTS exercises_select ON public.exercises;
CREATE POLICY exercises_select ON public.exercises FOR SELECT TO public USING (user_id IS NULL OR auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_own_or_public ON public.exercises;
CREATE POLICY exercises_own_or_public ON public.exercises FOR SELECT TO public USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS exercises_insert ON public.exercises;
CREATE POLICY exercises_insert ON public.exercises FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_insert_own ON public.exercises;
CREATE POLICY exercises_insert_own ON public.exercises FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_update ON public.exercises;
CREATE POLICY exercises_update ON public.exercises FOR UPDATE TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_update_own ON public.exercises;
CREATE POLICY exercises_update_own ON public.exercises FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_delete ON public.exercises;
CREATE POLICY exercises_delete ON public.exercises FOR DELETE TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS exercises_delete_own ON public.exercises;
CREATE POLICY exercises_delete_own ON public.exercises FOR DELETE TO public USING (auth.uid() = user_id);

-- workouts
DROP POLICY IF EXISTS workouts_all ON public.workouts;
CREATE POLICY workouts_all ON public.workouts FOR ALL TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS workouts_own ON public.workouts;
CREATE POLICY workouts_own ON public.workouts FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- workout_sets
DROP POLICY IF EXISTS sets_all ON public.workout_sets;
CREATE POLICY sets_all ON public.workout_sets FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()));
DROP POLICY IF EXISTS workout_sets_own ON public.workout_sets;
CREATE POLICY workout_sets_own ON public.workout_sets FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()));

-- personal_records
DROP POLICY IF EXISTS pr_all ON public.personal_records;
CREATE POLICY pr_all ON public.personal_records FOR ALL TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS prs_own ON public.personal_records;
CREATE POLICY prs_own ON public.personal_records FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_routines
DROP POLICY IF EXISTS routines_all ON public.user_routines;
CREATE POLICY routines_all ON public.user_routines FOR ALL TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS routines_own ON public.user_routines;
CREATE POLICY routines_own ON public.user_routines FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- body_measurements
DROP POLICY IF EXISTS body_measurements_own ON public.body_measurements;
CREATE POLICY body_measurements_own ON public.body_measurements FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- exercise_notes
DROP POLICY IF EXISTS exercise_notes_own ON public.exercise_notes;
CREATE POLICY exercise_notes_own ON public.exercise_notes FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- routine_templates
DROP POLICY IF EXISTS routine_templates_read ON public.routine_templates;
CREATE POLICY routine_templates_read ON public.routine_templates FOR SELECT TO public USING (is_public = true);

-- cardio_sessions
DROP POLICY IF EXISTS cardio_sessions_own ON public.cardio_sessions;
CREATE POLICY cardio_sessions_own ON public.cardio_sessions FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- exercise_goals
DROP POLICY IF EXISTS exercise_goals_select_own ON public.exercise_goals;
CREATE POLICY exercise_goals_select_own ON public.exercise_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS exercise_goals_insert_own ON public.exercise_goals;
CREATE POLICY exercise_goals_insert_own ON public.exercise_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS exercise_goals_update_own ON public.exercise_goals;
CREATE POLICY exercise_goals_update_own ON public.exercise_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS exercise_goals_delete_own ON public.exercise_goals;
CREATE POLICY exercise_goals_delete_own ON public.exercise_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- push_tokens
DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;
CREATE POLICY push_tokens_select_own ON public.push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;
CREATE POLICY push_tokens_insert_own ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_tokens_update_own ON public.push_tokens;
CREATE POLICY push_tokens_update_own ON public.push_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;
CREATE POLICY push_tokens_delete_own ON public.push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SEGURIDAD: GRANTS / REVOKES (hardening)
-- ============================================================

-- Vistas: invoker; sin escritura para anon/authenticated; sin SELECT para anon.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_daily_volume, public.v_weekly_volume_by_muscle,
     public.v_last_trained_by_muscle, public.v_progression_1rm
  FROM anon, authenticated;
REVOKE SELECT
  ON public.v_daily_volume, public.v_weekly_volume_by_muscle,
     public.v_last_trained_by_muscle, public.v_progression_1rm
  FROM anon;

-- Funciones internas de trigger: no expuestas como RPC.
REVOKE EXECUTE ON FUNCTION public.process_new_set()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_personal_record() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_update_pr()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_workout_volume()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_workout()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoclassify_muscle_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_exercise_goals_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_push_tokens_updated_at()    FROM PUBLIC, anon, authenticated;

-- RPC expuestas solo a authenticated.
REVOKE ALL ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_workouts_with_sets(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workouts_with_sets(uuid, integer, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.get_exercises_with_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exercises_with_usage(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_volume_by_muscle_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volume_by_muscle_group(uuid) TO authenticated;

-- Tablas con acceso solo authenticated.
REVOKE ALL ON public.exercise_goals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_goals TO authenticated;
REVOKE ALL ON public.push_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- ============================================================
-- SEMILLA: plantillas de rutina públicas
-- ============================================================
INSERT INTO public.routine_templates (name, description, days_data, is_public)
VALUES
  ('PPL — Push Pull Legs',
   'Rutina de 6 días dividida en empuje, jalón y piernas. Ideal para intermedio-avanzado.',
   '[{"day":"monday","label":"Push","focus":["chest","shoulders","triceps"]},{"day":"tuesday","label":"Pull","focus":["back","biceps"]},{"day":"wednesday","label":"Legs","focus":["quads","hamstrings","glutes","calves"]},{"day":"thursday","label":"Push","focus":["chest","shoulders","triceps"]},{"day":"friday","label":"Pull","focus":["back","biceps"]},{"day":"saturday","label":"Legs","focus":["quads","hamstrings","glutes","calves"]},{"day":"sunday","label":"Rest","focus":[]}]'::jsonb,
   true),
  ('Full Body 3x',
   'Tres días a la semana de cuerpo completo. Perfecto para principiantes.',
   '[{"day":"monday","label":"Full Body A","focus":["chest","back","legs","shoulders"]},{"day":"wednesday","label":"Full Body B","focus":["chest","back","legs","shoulders"]},{"day":"friday","label":"Full Body C","focus":["chest","back","legs","shoulders"]}]'::jsonb,
   true),
  ('Upper / Lower',
   'Cuatro días divididos en tren superior e inferior. Ideal para fuerza.',
   '[{"day":"monday","label":"Upper A","focus":["chest","back","shoulders","arms"]},{"day":"tuesday","label":"Lower A","focus":["quads","hamstrings","glutes"]},{"day":"thursday","label":"Upper B","focus":["chest","back","shoulders","arms"]},{"day":"friday","label":"Lower B","focus":["quads","hamstrings","glutes"]}]'::jsonb,
   true)
ON CONFLICT DO NOTHING;
