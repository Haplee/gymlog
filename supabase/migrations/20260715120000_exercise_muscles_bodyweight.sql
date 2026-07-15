-- Ejercicios: músculos múltiples ponderados + flag de peso corporal.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

-- 1) Flag de peso corporal en exercises -----------------------------------
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_bodyweight boolean NOT NULL DEFAULT false;

-- 2) Tabla de relación ejercicio <-> grupo muscular (ponderado) ------------
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
-- Un único primario por ejercicio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_muscles_one_primary
  ON public.exercise_muscles (exercise_id) WHERE role = 'primary';

COMMENT ON TABLE public.exercise_muscles IS
  'Grupos musculares ponderados por ejercicio (primary/secondary + weight 0-100)';

-- 3) RLS: leer si el ejercicio es propio o público; escribir solo si propio -
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

-- 4) Backfill: cada ejercicio existente -> primario 100% desde muscle_group -
INSERT INTO public.exercise_muscles (exercise_id, muscle_group, role, weight)
SELECT id, muscle_group, 'primary', 100
FROM public.exercises
ON CONFLICT (exercise_id, muscle_group) DO NOTHING;

-- 5) RPC get_exercises_with_usage: exponer is_bodyweight ------------------
-- Cambia el tipo de retorno, así que se recrea (DROP + CREATE).
DROP FUNCTION IF EXISTS public.get_exercises_with_usage(uuid);
CREATE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, muscle_group text, user_id uuid,
               created_at timestamp with time zone, usage_count bigint,
               is_bodyweight boolean)
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
    e.is_bodyweight
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
