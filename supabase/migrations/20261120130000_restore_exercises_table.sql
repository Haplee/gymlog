-- ============================================================
-- RESTAURACIÓN DE public.exercises Y DEPENDENCIAS
-- ------------------------------------------------------------
-- La migración 20261118092956_add_training_preferences_table.sql
-- eliminó (DROP TABLE / DROP FUNCTION) la tabla exercises y su RPC.
-- Esta migración lo restaura de forma IDEMPOTENTE:
--   * CREATE TABLE IF NOT EXISTS
--   * DROP POLICY IF EXISTS + CREATE POLICY
--   * DROP FUNCTION IF EXISTS + CREATE FUNCTION
--   * INSERT ... WHERE NOT EXISTS / ON CONFLICT DO NOTHING
--   * NOTIFY pgrst, 'reload schema' al final
-- ============================================================

SET local check_function_bodies = off;

-- ============================================================
-- 1) TABLA PUBLIC.EXERCISES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  muscle_group  text NOT NULL CHECK (muscle_group IN
    ('Pecho','Espalda','Hombro','Pierna','Glúteo','Brazos','Bíceps','Tríceps','Antebrazo','Core','Cardio','Otro')),
  muscle_detail text,
  equipment     text DEFAULT 'Barra' CHECK (equipment IN
    ('Barra','Mancuernas','Máquina','Polea','Peso corporal','Bandas','Kettlebell','Otro')),
  movement      text CHECK (movement IN
    ('Empuje','Tirón','Sentadilla','Bisagra','Aislamiento','Core','Pliometría','Otro')),
  is_bilateral  boolean DEFAULT true,
  user_id       uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  is_compound   boolean NOT NULL DEFAULT false,
  description   text,
  is_public     boolean NOT NULL DEFAULT false,
  media_url     text CHECK (media_url IS NULL OR char_length(media_url) <= 500),
  is_bodyweight boolean NOT NULL DEFAULT false,
  load_type     text NOT NULL DEFAULT 'external',
  UNIQUE (name, user_id)
);

-- Constraints adicionales (idempotentes: DROP IF EXISTS + ADD)
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_load_type_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_load_type_check
  CHECK (load_type IN ('external', 'bodyweight', 'bodyweight_loaded'));

COMMENT ON COLUMN public.exercises.load_type IS
  'Modalidad de carga: external | bodyweight | bodyweight_loaded (peso corporal + lastre)';

-- Índices
CREATE INDEX IF NOT EXISTS exercises_muscle_group_idx ON public.exercises USING btree (muscle_group);
CREATE INDEX IF NOT EXISTS exercises_user_id_idx ON public.exercises USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON public.exercises USING btree (muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_public ON public.exercises USING btree (is_public) WHERE (is_public = true);
CREATE INDEX IF NOT EXISTS idx_exercises_user ON public.exercises USING btree (user_id);
-- Índice único case-insensitive por usuario (para ejercicios de usuario, no catálogo público)
CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_lower_name_uniq
  ON public.exercises (user_id, lower(name))
  WHERE user_id IS NOT NULL;

-- Trigger de auto-clasificación muscular (si existe la función)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'autoclassify_muscle_group') THEN
    DROP TRIGGER IF EXISTS exercises_autoclassify ON public.exercises;
    CREATE TRIGGER exercises_autoclassify
      BEFORE INSERT ON public.exercises
      FOR EACH ROW EXECUTE FUNCTION autoclassify_muscle_group();
  END IF;
END $$;

-- ============================================================
-- 2) TABLA PUBLIC.EXERCISE_MUSCLES (músculos múltiples ponderados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercise_muscles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id  uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  muscle_group text NOT NULL CHECK (muscle_group IN
    ('Pecho','Espalda','Hombro','Pierna','Glúteo','Brazos','Bíceps','Tríceps','Antebrazo','Core','Cardio','Otro')),
  role         text NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary','secondary')),
  weight       numeric(5,2) NOT NULL DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),
  UNIQUE (exercise_id, muscle_group)
);

CREATE INDEX IF NOT EXISTS idx_exercise_muscles_exercise ON public.exercise_muscles (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_muscles_group ON public.exercise_muscles (muscle_group);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_muscles_one_primary
  ON public.exercise_muscles (exercise_id) WHERE role = 'primary';

COMMENT ON TABLE public.exercise_muscles IS
  'Grupos musculares ponderados por ejercicio (primary/secondary + weight 0-100)';

-- ============================================================
-- 3) TABLA PUBLIC.EXERCISE_FAVORITES (favoritos de usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercise_favorites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_favorites_user ON public.exercise_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_exercise ON public.exercise_favorites (exercise_id);

-- ============================================================
-- 4) RLS EN PUBLIC.EXERCISES
-- ============================================================
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Políticas canónicas (idempotentes)
DROP POLICY IF EXISTS exercises_select ON public.exercises;
DROP POLICY IF EXISTS exercises_own_or_public ON public.exercises;
CREATE POLICY exercises_own_or_public ON public.exercises
  FOR SELECT TO public
  USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS exercises_insert ON public.exercises;
DROP POLICY IF EXISTS exercises_insert_own ON public.exercises;
CREATE POLICY exercises_insert_own ON public.exercises
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exercises_update ON public.exercises;
DROP POLICY IF EXISTS exercises_update_own ON public.exercises;
CREATE POLICY exercises_update_own ON public.exercises
  FOR UPDATE TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exercises_delete ON public.exercises;
DROP POLICY IF EXISTS exercises_delete_own ON public.exercises;
CREATE POLICY exercises_delete_own ON public.exercises
  FOR DELETE TO public
  USING (auth.uid() = user_id);

-- ============================================================
-- 5) RLS EN PUBLIC.EXERCISE_MUSCLES
-- ============================================================
ALTER TABLE public.exercise_muscles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_muscles_select ON public.exercise_muscles;
CREATE POLICY exercise_muscles_select ON public.exercise_muscles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = exercise_id AND (e.user_id = auth.uid() OR e.user_id IS NULL)
  ));

DROP POLICY IF EXISTS exercise_muscles_write ON public.exercise_muscles;
CREATE POLICY exercise_muscles_write ON public.exercise_muscles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = exercise_id AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = exercise_id AND e.user_id = auth.uid()
  ));

-- ============================================================
-- 6) RLS EN PUBLIC.EXERCISE_FAVORITES
-- ============================================================
ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_favorites_write ON public.exercise_favorites;
CREATE POLICY exercise_favorites_write ON public.exercise_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exercise_favorites_read ON public.exercise_favorites;
CREATE POLICY exercise_favorites_read ON public.exercise_favorites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 7) GRANTS BÁSICOS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_muscles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_favorites TO authenticated;

-- ============================================================
-- 8) FUNCIÓN PUBLIC.GET_EXERCISES_WITH_USAGE (versión completa)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_exercises_with_usage(uuid);
CREATE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(
   id uuid,
   name text,
   muscle_group text,
   user_id uuid,
   created_at timestamp with time zone,
   usage_count bigint,
   is_bodyweight boolean,
   load_type text,
   equipment text,
   description text,
   media_url text,
   movement text,
   muscle_detail text,
   is_bilateral boolean,
   is_compound boolean,
   is_public boolean
 )
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
    COALESCE(u.usage_count, 0) AS usage_count,
    e.is_bodyweight,
    e.load_type,
    e.equipment,
    e.description,
    e.media_url,
    e.movement,
    e.muscle_detail,
    e.is_bilateral,
    e.is_compound,
    e.is_public
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

REVOKE ALL ON FUNCTION public.get_exercises_with_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exercises_with_usage(uuid) TO authenticated;

-- ============================================================
-- 9) BACKFILL EXERCISE_MUSCLES: un primary 100% por ejercicio existente
-- ============================================================
INSERT INTO public.exercise_muscles (exercise_id, muscle_group, role, weight)
SELECT id, muscle_group, 'primary', 100
FROM public.exercises
ON CONFLICT (exercise_id, muscle_group) DO NOTHING;

-- ============================================================
-- 10) SEED IDEMPOTENTE: CATÁLOGO PÚBLICO BASE (user_id IS NULL)
-- ============================================================
-- 10.1 Ejercicios base (desde 20260101000000_remote_schema.sql y posteriores)
-- Nota: los nombres exactos deben coincidir con las migraciones de descripciones

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press banca', 'Pecho', 'Barra', 'Empuje', true, true, true, 'Press de banca plano con barra, bajada al pecho y empuje explosivo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press banca' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press banca inclinado', 'Pecho', 'Barra', 'Empuje', true, true, true, 'Press en banco inclinado (30-45°), foco en pecho superior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press banca inclinado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press banca declinado', 'Pecho', 'Barra', 'Empuje', true, true, true, 'Press en banco declinado, foco en pecho inferior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press banca declinado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Dominadas', 'Espalda', 'Peso corporal', 'Tirón', true, true, true, 'Cuelga de la barra, sube hasta que la barbilla pase la barra.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Dominadas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalón al pecho', 'Espalda', 'Máquina', 'Tirón', true, true, true, 'Sentado, tira de la barra al pecho llevando codos hacia atrás.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalón al pecho' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo con barra', 'Espalda', 'Barra', 'Tirón', true, true, true, 'Tirón horizontal con barra, torso inclinado, para dorsal y espalda media.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo con barra' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla libre', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla trasera con barra, bajada controlada y subida explosiva.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla libre' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Peso muerto', 'Pierna', 'Barra', 'Bisagra', true, true, true, 'Carga la barra del suelo extendiendo caderas y rodillas, cadena posterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Peso muerto' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press militar', 'Hombro', 'Barra', 'Empuje', true, true, true, 'Press vertical con barra de pie o sentado, hombro y tríceps.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press militar' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones laterales', 'Hombro', 'Mancuernas', 'Aislamiento', true, false, true, 'Eleva las mancuernas lateralmente hasta la altura del hombro.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones laterales' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl bíceps', 'Brazos', 'Mancuernas', 'Aislamiento', true, false, true, 'Codo fijo, supina la muñeca al subir la mancuerna.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl bíceps' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Extensiones tríceps', 'Brazos', 'Polea', 'Aislamiento', true, false, true, 'En polea alta, extiende los antebrazos hacia abajo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Extensiones tríceps' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Plancha', 'Core', 'Peso corporal', 'Core', true, false, true, 'Mantén posición de flexión con antebrazos en el suelo, core activo.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Plancha' AND user_id IS NULL);

-- 10.2 Variedad adicional (desde 20260724000000_add_exercise_variety.sql)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Peso muerto rumano', 'Pierna', 'Barra', 'Bisagra', true, true, true, 'Bisagra de cadera con piernas semi-rígidas, énfasis en isquiotibiales y glúteo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Peso muerto rumano' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Hip thrust', 'Glúteo', 'Barra', 'Bisagra', true, true, true, 'Extensión de cadera con barra apoyada en banco, glúteo mayor.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Hip thrust' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla frontal', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla con la barra en posición frontal, mayor énfasis en cuádriceps.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla frontal' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla búlgara', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Sentadilla a una pierna con el pie trasero elevado en banco.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla búlgara' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Zancada caminando', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Zancadas alternas avanzando con mancuernas a los lados.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Zancada caminando' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo a una mano', 'Espalda', 'Mancuernas', 'Tirón', false, true, true, 'Remo unilateral apoyado en banco, un brazo por serie.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo a una mano' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press de hombro a un brazo', 'Hombro', 'Mancuernas', 'Empuje', false, true, true, 'Press vertical unilateral con mancuerna, exige estabilidad de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press de hombro a un brazo' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Step-up con mancuerna', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Subida a banco o cajón con mancuernas, una pierna impulsa el ascenso.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Step-up con mancuerna' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Peso muerto rumano a una pierna', 'Pierna', 'Mancuernas', 'Bisagra', false, true, true, 'RDL a una pierna, equilibrio y activación unilateral de isquiotibiales.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Peso muerto rumano a una pierna' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevación lateral unilateral', 'Hombro', 'Mancuernas', 'Aislamiento', false, false, true, 'Elevación lateral con un brazo, aísla el deltoides medio.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevación lateral unilateral' AND user_id IS NULL);

-- 10.3 Pliometría
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto al cajón', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Salto explosivo a un cajón o plataforma, ambas piernas.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto al cajón' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla con salto', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Sentadilla con salto vertical al final del recorrido, potencia de tren inferior.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla con salto' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Burpees', 'Cardio', 'Peso corporal', 'Pliometría', true, true, true, 'Sentadilla, plancha, flexión y salto vertical encadenados, cardio de alta intensidad.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Burpees' AND user_id IS NULL);

-- 10.4 Catálogo de plantillas (desde 20261028130000_template_exercise_catalog.sql)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl femoral sentado', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Flexión de rodilla sentado en máquina, isquiotibiales con la cadera flexionada.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl femoral sentado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla parcial', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla recortada a un recorrido corto, cargas altas y énfasis en la salida.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla parcial' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl nórdico', 'Pierna', 'Peso corporal', 'Aislamiento', true, false, true, 'Flexión de rodilla excéntrica con los tobillos fijados, isquiotibiales.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl nórdico' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones disco', 'Hombro', 'Otro', 'Aislamiento', true, false, true, 'Elevación frontal con un disco sujeto con ambas manos, deltoides anterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones disco' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Rotación externa con goma', 'Hombro', 'Bandas', 'Aislamiento', false, false, true, 'Rotación externa del hombro contra banda, manguito rotador.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Rotación externa con goma' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Power Clean', 'Espalda', 'Barra', 'Bisagra', true, true, true, 'Cargada de potencia: la barra sube del suelo al hombro en un tirón explosivo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Power Clean' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Power Snatch', 'Espalda', 'Barra', 'Bisagra', true, true, true, 'Arrancada de potencia: la barra sube del suelo por encima de la cabeza en un tirón.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Power Snatch' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Plancha lateral', 'Core', 'Peso corporal', 'Core', false, false, true, 'Plancha sobre un antebrazo, oblicuos y estabilidad lateral de cadera.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Plancha lateral' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press Pallof', 'Core', 'Polea', 'Core', false, false, true, 'Empuje horizontal contra la rotación de la polea, antirrotación de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press Pallof' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Leñador en polea', 'Core', 'Polea', 'Core', false, false, true, 'Rotación de tronco de arriba abajo en polea, oblicuos y core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Leñador en polea' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento de balón medicinal', 'Core', 'Otro', 'Pliometría', false, false, true, 'Lanzamiento explosivo de balón medicinal, potencia rotacional de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento de balón medicinal' AND user_id IS NULL);

-- ============================================================
-- 11) DESCRIPCIONES IDEMPOTENTES (solo si NULL o vacía)
-- ============================================================
-- Desde 20260804120000_exercise_descriptions.sql
UPDATE public.exercises SET description = 'Press de banca plano con barra, bajada al pecho y empuje explosivo.' WHERE name = 'Press banca' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press en banco inclinado (30-45°), foco en pecho superior.' WHERE name = 'Press banca inclinado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press en banco declinado, foco en pecho inferior.' WHERE name = 'Press banca declinado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Cuelga de la barra, sube hasta que la barbilla pase la barra.' WHERE name = 'Dominadas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Sentado, tira de la barra al pecho llevando codos hacia atrás.' WHERE name = 'Jalón al pecho' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tirón horizontal con barra, torso inclinado, para dorsal y espalda media.' WHERE name = 'Remo con barra' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Sentadilla trasera con barra, bajada controlada y subida explosiva.' WHERE name = 'Sentadilla libre' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Carga la barra del suelo extendiendo caderas y rodillas, cadena posterior.' WHERE name = 'Peso muerto' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press vertical con barra de pie o sentado, hombro y tríceps.' WHERE name = 'Press militar' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Eleva las mancuernas lateralmente hasta la altura del hombro.' WHERE name = 'Elevaciones laterales' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Codo fijo, supina la muñeca al subir la mancuerna.' WHERE name = 'Curl bíceps' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'En polea alta, extiende los antebrazos hacia abajo.' WHERE name = 'Extensiones tríceps' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Mantén posición de flexión con antebrazos en el suelo, core activo.' WHERE name = 'Plancha' AND (description IS NULL OR description = '');

-- Desde 20260804123000_exercise_descriptions_personal.sql (ejercicios que coinciden con catálogo)
UPDATE public.exercises SET description = 'Sentadilla a una pierna con el pie trasero apoyado en banco, baja en vertical y sube con la pierna delantera.' WHERE name = 'Sentadilla búlgara' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Flexión de muñeca en polea baja: apoya el antebrazo y sube la muñeca contra la resistencia, trabaja el antebrazo.' WHERE name = 'Elevaciones disco' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press de banca con mancuernas: tumbado, baja las mancuernas al pecho y empuja hacia arriba.' WHERE name = 'Press banca mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps con mancuernas: codos fijos al cuerpo, supinación al subir.' WHERE name = 'Curl bíceps mancuerna' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl martillo con mancuernas: agarre neutro, sube sin rotar, trabaja bíceps y braquiorradial.' WHERE name = 'Martillo' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps con cuerda: en polea alta con cuerda, extiende los antebrazos hacia abajo y separa las puntas al final.' WHERE name = 'Tríceps cuerda' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo de pie: tira de la barra o polea hacia el abdomen de pie, torso ligeramente inclinado, espalda y dorsal.' WHERE name = 'Remo de pie' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Crunches: tumbado boca arriba, eleva los hombros contrayendo el abdomen, espalda baja pegada al suelo.' WHERE name = 'Crunches' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Aperturas: con mancuernas o poleas, abre los brazos en arco amplio y vuelve juntándolos, foco en pectoral.' WHERE name = 'Aperturas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press inclinado: press con mancuernas o barra en banco inclinado, foco en la parte alta del pecho.' WHERE name = 'Press inclinado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensiones con disco: eleva un disco frente al pecho o hacia los lados trabajando hombro y antebrazo.' WHERE name = 'Elevaciones disco' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensiones de cuádriceps en máquina: extiende la rodilla contra la resistencia sin levantar la cadera.' WHERE name = 'Extensiones cuádriceps' AND (description IS NULL OR description = '');

-- ============================================================
-- 12) SYNC load_type / is_bodyweight coherentes (idempotente)
-- ============================================================
UPDATE public.exercises
SET load_type = 'bodyweight', is_bodyweight = true
WHERE load_type = 'external'
  AND (
    LOWER(name) LIKE '%dominad%' OR LOWER(name) LIKE '%pull%up%' OR LOWER(name) LIKE '%chin%up%'
    OR LOWER(name) LIKE '%muscle%up%' OR LOWER(name) LIKE '%fondo%' OR LOWER(name) LIKE '%flexion%'
    OR LOWER(name) LIKE '%flexión%' OR LOWER(name) LIKE '%push%up%' OR LOWER(name) LIKE '%plancha%'
    OR LOWER(name) LIKE '%abdominal%' OR LOWER(name) LIKE '%crunch%' OR LOWER(name) LIKE '%burpee%'
    OR LOWER(name) LIKE '%l-sit%' OR LOWER(name) LIKE '%elevación de piernas%' OR LOWER(name) LIKE '%elevacion de piernas%'
    OR LOWER(name) LIKE '%salto%' OR LOWER(name) LIKE '%sentadilla con salto%' OR LOWER(name) LIKE '%salto al caj%'
    OR LOWER(name) LIKE '%curl nórdico%' OR LOWER(name) LIKE '%plancha lateral%'
  );

UPDATE public.exercises
SET is_bodyweight = (load_type <> 'external')
WHERE is_bodyweight <> (load_type <> 'external');

-- ============================================================
-- 13) NOTIFICAR A POSTGREST PARA RECARGA DE ESQUEMA
-- ============================================================
NOTIFY pgrst, 'reload schema';