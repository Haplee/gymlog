-- `get_exercises_with_usage` devolvía 9 columnas de `exercises`. El cliente las
-- usaba como si fueran la fila entera (`Exercise`), así que tres lecturas caían
-- en `undefined` sin que nadie se enterara:
--
--   * `RoutinePage` proponía «por lado`» con `is_bilateral` → siempre `undefined`,
--     la propuesta nunca se aplicaba.
--   * `WorkoutPage` duplica el descanso en ejercicios compuestos con
--     `is_compound` → la rama nunca se cumplía.
--   * `useHistoryTransfer` construye filas completas al vuelo (`muscle_detail`,
--     `description`, `media_url`…) y las mezclaba con las de la RPC.
--
-- Se devuelve la fila completa + `usage_count`. No cambia filas ni datos: la
-- función es de lectura. Idempotente: `DROP` + `CREATE`.
--
-- `muscle_detail`, `description`, `media_url`, `is_bilateral`, `is_compound`,
-- `is_public` ya existen en la tabla desde migraciones anteriores; esto sólo las
-- expone por la RPC.

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
