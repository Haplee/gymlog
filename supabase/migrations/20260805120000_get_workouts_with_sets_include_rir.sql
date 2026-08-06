-- Incluye el RIR en las series que devuelve get_workouts_with_sets.
--
-- El RPC (baseline en 20260101000000_remote_schema.sql) construia el jsonb de
-- cada serie con rpe pero sin rir: el RIR persistido por save_workout_with_sets
-- no llegaba nunca al cliente, asi que la autorregulacion (autoregulation.ts)
-- solo podia derivarlo del RPE. Con este cambio cierra el bucle de P3.

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
              'rir',         s.rir,
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

REVOKE EXECUTE ON FUNCTION public.get_workouts_with_sets(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workouts_with_sets(uuid, integer, timestamptz) TO authenticated;
