-- Modalidad de carga por ejercicio: externo / peso corporal / peso corporal + lastre.
-- Generaliza el booleano is_bodyweight (que se conserva como columna denormalizada
-- derivada, is_bodyweight = load_type <> 'external').
-- Idempotente: se puede re-ejecutar sin efectos secundarios.

-- 1) Columna load_type ------------------------------------------------------
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS load_type text NOT NULL DEFAULT 'external';

-- CHECK acotando el dominio (idempotente: se recrea).
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_load_type_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_load_type_check
  CHECK (load_type IN ('external', 'bodyweight', 'bodyweight_loaded'));

COMMENT ON COLUMN public.exercises.load_type IS
  'Modalidad de carga: external | bodyweight | bodyweight_loaded (peso corporal + lastre)';

-- 2) Backfill desde el flag actual -----------------------------------------
-- Los ejercicios ya marcados como peso corporal → 'bodyweight'.
UPDATE public.exercises
  SET load_type = 'bodyweight'
  WHERE is_bodyweight = true AND load_type = 'external';

-- 3) Auto-clasificación por nombre (solo ejercicios aún 'external') ---------
-- Conservador: patrones inequívocamente de peso corporal. Lo no reconocido
-- permanece 'external'. Coherente con el trigger autoclassify_muscle_group.
UPDATE public.exercises
  SET load_type = 'bodyweight'
  WHERE load_type = 'external'
    AND (
      LOWER(name) LIKE '%dominad%'      -- dominadas
      OR LOWER(name) LIKE '%pull%up%'   -- pull-up
      OR LOWER(name) LIKE '%chin%up%'   -- chin-up
      OR LOWER(name) LIKE '%muscle%up%' -- muscle-up
      OR LOWER(name) LIKE '%fondo%'     -- fondos (dips)
      OR LOWER(name) LIKE '%flexion%'   -- flexiones
      OR LOWER(name) LIKE '%flexión%'
      OR LOWER(name) LIKE '%push%up%'   -- push-up
      OR LOWER(name) LIKE '%plancha%'   -- plancha (plank)
      OR LOWER(name) LIKE '%abdominal%'
      OR LOWER(name) LIKE '%crunch%'
      OR LOWER(name) LIKE '%burpee%'
      OR LOWER(name) LIKE '%l-sit%'
      OR LOWER(name) LIKE '%elevación de piernas%'
      OR LOWER(name) LIKE '%elevacion de piernas%'
    );

-- 4) Mantener is_bodyweight coherente con load_type ------------------------
UPDATE public.exercises
  SET is_bodyweight = (load_type <> 'external')
  WHERE is_bodyweight <> (load_type <> 'external');

-- 5) RPC get_exercises_with_usage: exponer load_type -----------------------
-- Cambia el tipo de retorno, así que se recrea (DROP + CREATE).
DROP FUNCTION IF EXISTS public.get_exercises_with_usage(uuid);
CREATE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, muscle_group text, user_id uuid,
               created_at timestamp with time zone, usage_count bigint,
               is_bodyweight boolean, load_type text)
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
    e.load_type
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
