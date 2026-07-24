-- get_exercises_with_usage no exponía `equipment`, así que el picker de
-- ejercicios en el entrenamiento activo (que usa esta RPC, no el SELECT *)
-- nunca podía mostrar el icono real de barra/mancuerna/máquina — siempre caía
-- al icono genérico. Se añade la columna.
-- Idempotente: se puede re-ejecutar sin efectos secundarios (DROP + CREATE).

DROP FUNCTION IF EXISTS public.get_exercises_with_usage(uuid);
CREATE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(id uuid, name text, muscle_group text, user_id uuid,
               created_at timestamp with time zone, usage_count bigint,
               is_bodyweight boolean, load_type text, equipment text)
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
    e.equipment
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
