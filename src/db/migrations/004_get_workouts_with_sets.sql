-- ============================================================
-- GymLog v2 — Migración: RPC get_workouts_with_sets
-- Devuelve workouts con sus sets anidados resueltos en el
-- servidor (join SQL), evitando el patrón cliente
--   .in('workout_id', [cientos de UUIDs])
-- que puede superar el límite de longitud de URL de PostgREST
-- (414 URI Too Long) en usuarios con mucho historial.
--
-- Reemplaza el doble round-trip (workouts + sets) de
-- fetchWorkouts / fetchWorkoutsAndSets / fetchWorkoutsPaginated
-- / fetchRecentSets por una sola llamada RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_workouts_with_sets(
  p_user_id UUID,
  p_limit   INT         DEFAULT 200,
  p_cursor  TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Seguridad: solo el propio usuario. SECURITY DEFINER salta RLS,
    -- así que filtramos por auth.uid() explícitamente.
    WHERE w.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND (p_cursor IS NULL OR w.started_at < p_cursor)
    ORDER BY w.started_at DESC
    LIMIT p_limit
  ) sub;
$$;

-- Hardening: solo usuarios autenticados (no anon/public). El propio
-- filtro p_user_id = auth.uid() ya devuelve 0 filas para anon, pero
-- revocamos EXECUTE para alinear con el patrón del resto de RPCs.
REVOKE EXECUTE ON FUNCTION public.get_workouts_with_sets(UUID, INT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workouts_with_sets(UUID, INT, TIMESTAMPTZ) TO authenticated;

-- Índice de apoyo para el orden/cursor por started_at por usuario
CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON public.workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON public.workout_sets(workout_id);
