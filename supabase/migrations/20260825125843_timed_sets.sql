-- Series por tiempo: una plancha no tiene repeticiones.
--
-- Hasta ahora `workout_sets.reps` era NOT NULL CHECK (reps > 0), así que lo que
-- no se mide en repeticiones —planchas, isométricos, paseos del granjero— no
-- tenía dónde ir. La columna `duration_seconds` ya existía desde el esquema
-- inicial pero estaba latente: nadie la escribía ni la leía.
--
-- Decisión y alternativas descartadas en
-- `openspec/changes/add-logging-modes/design.md` §1 (opción A, aprobada).
-- La preparación del cliente está hecha: `src/shared/lib/setShape.ts` y el
-- commit de la fase 0 dejaron el código en 0 errores con `reps` nullable.
--
-- **No migra ni una fila.** Todo lo registrado hasta hoy tiene repeticiones y
-- sigue igual; lo único que cambia es que a partir de ahora se admite su
-- ausencia.
--
-- Idempotente: los CHECK se sueltan con IF EXISTS antes de crearse, y las
-- funciones van con CREATE OR REPLACE.

-- 1. reps deja de ser obligatoria ------------------------------------------

ALTER TABLE public.workout_sets ALTER COLUMN reps DROP NOT NULL;

COMMENT ON COLUMN public.workout_sets.reps IS
  'Repeticiones de la serie. NULL cuando la serie no se mide en repeticiones (serie por tiempo: ver duration_seconds).';

COMMENT ON COLUMN public.workout_sets.duration_seconds IS
  'Duración de la serie en segundos. Se rellena en las series por tiempo (planchas, isométricos, paseos del granjero), donde reps es NULL.';

-- El CHECK antiguo (reps > 0) rechazaría un NULL... en realidad no: en SQL un
-- CHECK sobre NULL da UNKNOWN y pasa. Pero se rehace de todas formas para que
-- la intención quede escrita y no dependa de esa sutileza, que es justo el tipo
-- de cosa que alguien "arregla" más adelante sin saber que la sostenía.
ALTER TABLE public.workout_sets DROP CONSTRAINT IF EXISTS workout_sets_reps_positive;
ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_reps_positive
  CHECK (reps IS NULL OR (reps > 0 AND reps <= 9999));

-- El CHECK sin nombre del esquema inicial (reps > 0) se creó como
-- workout_sets_reps_check. Se suelta si está: ya lo cubre el de arriba.
ALTER TABLE public.workout_sets DROP CONSTRAINT IF EXISTS workout_sets_reps_check;

-- 2. Una serie tiene que medir algo ----------------------------------------

-- Sin repeticiones y sin duración, la fila no dice nada de lo que se hizo. Es
-- mejor rechazarla al escribir que descubrirla dentro de una media.
ALTER TABLE public.workout_sets DROP CONSTRAINT IF EXISTS workout_sets_measured;
ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_measured
  CHECK (reps IS NOT NULL OR duration_seconds IS NOT NULL);

-- 3. Guardar la duración ----------------------------------------------------

-- **La firma no cambia.** La duración viaja dentro del JSON de series que la
-- función ya recibía, así que un APK sin actualizar sigue llamando igual y
-- guardando igual: manda series sin `duration_seconds` y se escriben con NULL.
-- Añadir un parámetro habría creado una sobrecarga y roto la resolución para
-- quien no hubiera actualizado todavía.
CREATE OR REPLACE FUNCTION public.save_workout_with_sets(
  p_user_id uuid,
  p_exercise_id uuid,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_sets jsonb,
  p_notes text DEFAULT NULL,
  p_rating integer DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
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

  INSERT INTO workouts (user_id, started_at, finished_at, duration_seconds, notes, rating, client_id)
  VALUES (
    p_user_id,
    p_started_at,
    p_finished_at,
    v_dur,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    CASE WHEN p_rating BETWEEN 1 AND 5 THEN p_rating::SMALLINT ELSE NULL END,
    p_client_id
  )
  -- Reintento de un envío ya escrito: no se inserta nada y v_workout_id queda NULL.
  ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_workout_id;

  IF v_workout_id IS NULL THEN
    SELECT id INTO v_workout_id
    FROM workouts
    WHERE user_id = p_user_id AND client_id = p_client_id;

    RETURN v_workout_id;
  END IF;

  INSERT INTO workout_sets
    (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes, rpe, rir, set_type, duration_seconds)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    -- NULL explícito cuando no viene o no es un entero positivo: una serie por
    -- tiempo manda `reps: null` y antes eso habría reventado el NOT NULL.
    CASE
      WHEN (s->>'reps') ~ '^\d+$' AND (s->>'reps')::INT > 0 THEN (s->>'reps')::INT
      ELSE NULL
    END,
    (s->>'weight')::NUMERIC,
    COALESCE((s->>'is_warmup')::BOOLEAN, FALSE),
    NULLIF(s->>'notes', ''),
    CASE
      WHEN (s->>'rpe') ~ '^\d+$' AND (s->>'rpe')::INT BETWEEN 1 AND 10
        THEN (s->>'rpe')::SMALLINT
      ELSE NULL
    END,
    CASE
      WHEN (s->>'rir') ~ '^\d+$' AND (s->>'rir')::INT BETWEEN 0 AND 5
        THEN (s->>'rir')::SMALLINT
      WHEN (s->>'rpe') ~ '^\d+$' AND (s->>'rpe')::INT BETWEEN 1 AND 10
        THEN LEAST(10 - (s->>'rpe')::INT, 5)::SMALLINT
      ELSE NULL
    END,
    CASE
      WHEN (s->>'set_type') IN ('normal', 'dropset', 'rest_pause', 'amrap')
        THEN s->>'set_type'
      ELSE 'normal'
    END,
    CASE
      WHEN (s->>'duration_seconds') ~ '^\d+$' AND (s->>'duration_seconds')::INT > 0
        THEN (s->>'duration_seconds')::INT
      ELSE NULL
    END
  FROM jsonb_array_elements(p_sets) AS s
  -- Una fila sin nada que medir se descarta aquí en vez de hacer fallar el
  -- entreno entero contra el CHECK: el resto de la sesión sí se guarda.
  WHERE (s->>'reps') ~ '^\d+$' AND (s->>'reps')::INT > 0
     OR (s->>'duration_seconds') ~ '^\d+$' AND (s->>'duration_seconds')::INT > 0;

  RETURN v_workout_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) TO authenticated;

-- 4. Blindar el trigger que se dispara en cada serie ------------------------

-- **Esta es la parte que hace que la migración no rompa nada, y no estaba en la
-- propuesta.** `process_new_set` corre en cada INSERT de workout_sets y da por
-- hecho que hay repeticiones. Con `reps` NULL pasaban tres cosas, en orden de
-- gravedad:
--
--   1. `personal_records.reps` es NOT NULL, y el trigger intenta insertar un PR
--      con NEW.reps. Una plancha habría hecho **fallar el guardado entero de la
--      serie**, no solo el récord.
--   2. `total_volume = total_volume + (NEW.weight * NEW.reps)` da NULL en
--      cuanto uno de los dos lo es, así que **una sola serie por tiempo dejaba
--      el volumen del entreno en NULL**.
--   3. `IF NEW.reps >= 1 AND NEW.reps <= 36` con NULL da UNKNOWN y caía en el
--      ELSE, guardando `one_rm = NEW.weight`: para una plancha lastrada con 20
--      kg, un "récord" de 20 kg a una repetición que nadie ha hecho.
--
-- La regla es la de design.md §4: una serie sin repeticiones no participa en
-- nada que se calcule sobre repeticiones. Los récords por tiempo son su propia
-- categoría y se harán aparte.
--
-- El otro trigger vivo sobre workout_sets, `sync_workout_volume`, **no hace
-- falta tocarlo**: recalcula con `SUM(weight * reps)`, y SUM ignora los NULL en
-- vez de propagarlos. Es la diferencia entre un agregado y el `+` de arriba, y
-- por eso uno se arregla y el otro no. Comprobado sobre la definición viva, no
-- sobre las migraciones: son los dos únicos triggers activos de la tabla.

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

  -- Serie por tiempo: cuenta como serie del entreno y nada más. Sin 1RM, sin
  -- volumen y sin récord por repeticiones.
  IF NEW.reps IS NULL THEN
    UPDATE public.workouts
    SET total_sets = COALESCE(total_sets, 0) + 1
    WHERE id = NEW.workout_id;

    RETURN NEW;
  END IF;

  IF NEW.reps >= 1 AND NEW.reps <= 36 THEN
    v_one_rm := ROUND((NEW.weight * (36.0 / (37.0 - NEW.reps)))::NUMERIC, 2);
  ELSE
    v_one_rm := NEW.weight;
  END IF;

  UPDATE public.workout_sets SET one_rm = v_one_rm WHERE id = NEW.id;

  UPDATE public.workouts
  SET total_volume = COALESCE(total_volume, 0) + (NEW.weight * NEW.reps),
      total_sets   = COALESCE(total_sets, 0) + 1
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

-- 5. Devolver la duración al cliente ---------------------------------------

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
              'id',               s.id,
              'weight',           s.weight,
              'reps',             s.reps,
              'duration_seconds', s.duration_seconds,
              'set_num',          s.set_num,
              'exercise_id',      s.exercise_id,
              'workout_id',       s.workout_id,
              'created_at',       s.created_at,
              'notes',            s.notes,
              'is_warmup',        s.is_warmup,
              'rpe',              s.rpe,
              'rir',              s.rir,
              'exercise',         jsonb_build_object('name', e.name, 'muscle_group', e.muscle_group),
              'workout',          jsonb_build_object('started_at', w.started_at)
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
