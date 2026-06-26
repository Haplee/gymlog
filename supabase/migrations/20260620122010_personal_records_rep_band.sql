-- B1: PRs por rango de repeticiones (rep_band)
-- Antes había 1 PR por (user, exercise). Ahora 1 por (user, exercise, rep_band).
-- Bandas: 1, 3, 5, 8, 12, 15(+). Idempotente.

-- 1. Función de clasificación de banda
CREATE OR REPLACE FUNCTION public.pr_rep_band(p_reps integer)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_reps <= 1 THEN 1
    WHEN p_reps <= 3 THEN 3
    WHEN p_reps <= 5 THEN 5
    WHEN p_reps <= 8 THEN 8
    WHEN p_reps <= 12 THEN 12
    ELSE 15
  END::smallint
$function$;

-- 2. Columna rep_band
ALTER TABLE public.personal_records ADD COLUMN IF NOT EXISTS rep_band smallint;

-- 3. Backfill de la banda en las filas existentes (1 PR/ejercicio actual)
UPDATE public.personal_records SET rep_band = public.pr_rep_band(reps) WHERE rep_band IS NULL;
ALTER TABLE public.personal_records ALTER COLUMN rep_band SET NOT NULL;

-- 4. Cambiar unicidad: (user, exercise) -> (user, exercise, rep_band)
ALTER TABLE public.personal_records
  DROP CONSTRAINT IF EXISTS personal_records_user_id_exercise_id_key;
ALTER TABLE public.personal_records
  DROP CONSTRAINT IF EXISTS personal_records_user_ex_band_key;
ALTER TABLE public.personal_records
  ADD CONSTRAINT personal_records_user_ex_band_key UNIQUE (user_id, exercise_id, rep_band);

-- 5. Backfill histórico: mejor e1RM por (user, exercise, banda) desde workout_sets
INSERT INTO public.personal_records
  (user_id, exercise_id, weight, reps, one_rm, workout_set_id, rep_band, achieved_at)
SELECT DISTINCT ON (w.user_id, s.exercise_id, public.pr_rep_band(s.reps))
  w.user_id,
  s.exercise_id,
  s.weight,
  s.reps,
  ROUND((s.weight * (36.0 / (37.0 - LEAST(s.reps, 36))))::numeric, 2) AS e1rm,
  s.id,
  public.pr_rep_band(s.reps),
  now()
FROM public.workout_sets s
JOIN public.workouts w ON w.id = s.workout_id
WHERE COALESCE(s.is_warmup, false) = false AND s.reps >= 1 AND s.weight > 0
ORDER BY
  w.user_id,
  s.exercise_id,
  public.pr_rep_band(s.reps),
  (s.weight * (36.0 / (37.0 - LEAST(s.reps, 36)))) DESC
ON CONFLICT (user_id, exercise_id, rep_band) DO UPDATE
  SET weight = EXCLUDED.weight,
      reps = EXCLUDED.reps,
      one_rm = EXCLUDED.one_rm,
      workout_set_id = EXCLUDED.workout_set_id,
      achieved_at = EXCLUDED.achieved_at
  WHERE public.personal_records.one_rm IS NULL
     OR public.personal_records.one_rm < EXCLUDED.one_rm;

-- 6. Quitar el trigger competidor (mantenía 1 PR/ejercicio por e1RM)
DROP TRIGGER IF EXISTS auto_update_pr ON public.workout_sets;

-- 7. Reescribir process_new_set para mantener PR por banda (por e1RM).
--    Conserva one_rm del set, is_pr y los totales del workout.
CREATE OR REPLACE FUNCTION public.process_new_set()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id    UUID;
  v_band       SMALLINT;
  v_current_1rm FLOAT;
  v_one_rm     FLOAT;
BEGIN
  SELECT w.user_id INTO v_user_id
  FROM public.workouts w WHERE w.id = NEW.workout_id;

  IF NEW.reps >= 1 AND NEW.reps <= 36 THEN
    v_one_rm := ROUND((NEW.weight * (36.0 / (37.0 - NEW.reps)))::NUMERIC, 2);
  ELSE
    v_one_rm := NEW.weight;
  END IF;

  UPDATE public.workout_sets SET one_rm = v_one_rm WHERE id = NEW.id;

  UPDATE public.workouts
  SET total_volume = total_volume + (NEW.weight * NEW.reps),
      total_sets   = total_sets + 1
  WHERE id = NEW.workout_id;

  IF v_user_id IS NULL OR NEW.is_warmup = TRUE THEN
    RETURN NEW;
  END IF;

  v_band := public.pr_rep_band(NEW.reps);

  SELECT one_rm INTO v_current_1rm
  FROM public.personal_records
  WHERE user_id = v_user_id AND exercise_id = NEW.exercise_id AND rep_band = v_band;

  IF v_current_1rm IS NULL OR v_one_rm > v_current_1rm THEN
    INSERT INTO public.personal_records
      (user_id, exercise_id, weight, reps, one_rm, workout_set_id, rep_band, achieved_at)
    VALUES (v_user_id, NEW.exercise_id, NEW.weight, NEW.reps, v_one_rm, NEW.id, v_band, NOW())
    ON CONFLICT (user_id, exercise_id, rep_band)
    DO UPDATE SET
      weight         = EXCLUDED.weight,
      reps           = EXCLUDED.reps,
      one_rm         = EXCLUDED.one_rm,
      workout_set_id = EXCLUDED.workout_set_id,
      achieved_at    = NOW();

    UPDATE public.workout_sets SET is_pr = TRUE WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
