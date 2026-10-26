-- Idempotencia: cerrar el contrato de `save_workout_with_sets`.
--
-- Desde 20260814115041 el servidor reconoce un reenvío por `(user_id, client_id)`
-- y no crea un entreno nuevo. Faltaban dos cosas para que la garantía fuese
-- completa:
--
--   1. **Misma clave, contenido distinto.** Hasta ahora se devolvía el id del
--      entreno original en silencio, así que un cliente con un bug (o una clave
--      reutilizada a mano) veía "guardado" mientras sus series se perdían. Ahora
--      se guarda una huella del contenido y un reenvío con otra huella falla con
--      `idempotency_conflict` (SQLSTATE P0001). Es el mismo contrato que usan las
--      pasarelas de pago: la clave identifica una operación, no un hueco libre.
--
--   2. **Escrituras de importación atómicas.** CSV y Excel insertaban el entreno
--      y cada serie con peticiones sueltas: si se perdía la respuesta a mitad, un
--      reintento duplicaba lo ya escrito. La función acepta ahora `exercise_id`
--      dentro de cada serie, de modo que un día completo de una importación
--      entra en UNA transacción, con una única clave de idempotencia. Sin ese
--      campo, el ejercicio sigue saliendo de `p_exercise_id` como siempre.
--
-- Compatibilidad:
--   * La firma no cambia. Un APK sin actualizar sigue llamando igual y sigue
--     guardando igual (sus series no traen `exercise_id`).
--   * `client_id` sigue siendo opcional: sin clave no hay deduplicación de
--     solicitud, exactamente como antes.
--   * Las filas históricas (`client_id` no nulo, `idempotency_hash` nulo) no se
--     tocan. En su primer reenvío se adopta la huella recibida para no romper un
--     reintento que cruzase el despliegue; a partir de ahí ya se detecta el
--     conflicto.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
--
-- **Despliegue manual, no automático:** aplicar con `supabase db push` o desde el
-- SQL editor del proyecto. No borra ni migra filas.

-- 1. Huella del contenido enviado con la clave ------------------------------

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS idempotency_hash text;

COMMENT ON COLUMN public.workouts.idempotency_hash IS
  'Huella md5 del contenido que acompañó a client_id. Detecta la reutilización de una clave de idempotencia con otra carga. NULL en filas anteriores a la migración.';

-- 2. Huella canónica del contenido ------------------------------------------

-- No se usa `p_sets::text` directamente: `jsonb` normaliza el orden de claves,
-- pero no la representación de los números ('80' y '80.0' son jsonb distintos).
-- Un reenvío puede serializar la misma serie de otra forma y parecer un
-- contenido distinto, que es justo el falso positivo que la huella debe evitar.
-- Se extraen los campos uno a uno, se normalizan con `trim_scale` y se
-- concatenan en el orden del array (un reenvío conserva el orden de las series).
--
-- `extract(epoch ...)` evita que la huella cambie con el huso horario de la
-- sesión (a diferencia de `timestamptz::text`). Es una huella de integridad, no
-- una firma: md5 basta para detectar una clave reutilizada con otra carga.
CREATE OR REPLACE FUNCTION public.workout_request_hash(
  p_user_id uuid,
  p_exercise_id uuid,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_sets jsonb,
  p_notes text,
  p_rating integer
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $function$
  SELECT md5(
    COALESCE(p_user_id::text, '') || chr(31) ||
    COALESCE(p_exercise_id::text, '') || chr(31) ||
    COALESCE(extract(epoch FROM p_started_at)::text, '') || chr(31) ||
    COALESCE(extract(epoch FROM p_finished_at)::text, '') || chr(31) ||
    COALESCE(p_notes, '') || chr(31) ||
    COALESCE(p_rating::text, '') || chr(31) ||
    COALESCE(
      (
        SELECT string_agg(
          concat_ws(
            chr(30),
            COALESCE(NULLIF(s->>'exercise_id', ''), ''),
            COALESCE((s->>'set_num')::numeric::text, ''),
            COALESCE((s->>'reps')::numeric::text, ''),
            COALESCE(trim_scale((s->>'weight')::numeric)::text, ''),
            COALESCE((s->>'is_warmup')::boolean::text, ''),
            COALESCE(s->>'notes', ''),
            COALESCE((s->>'rpe')::numeric::text, ''),
            COALESCE((s->>'rir')::numeric::text, ''),
            COALESCE(s->>'set_type', ''),
            COALESCE((s->>'duration_seconds')::numeric::text, '')
          ),
          chr(29) ORDER BY ord
        )
        FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb))
          WITH ORDINALITY AS t(s, ord)
      ),
      '[]'
    )
  );
$function$;

COMMENT ON FUNCTION public.workout_request_hash(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer) IS
  'Huella estable del contenido de un guardado. Se usa para detectar una clave de idempotencia reutilizada con otra carga.';

-- 3. Guardado atómico e idempotente -----------------------------------------

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
  v_workout_id    UUID;
  v_existing_hash TEXT;
  v_hash          TEXT;
  v_dur           INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_sets IS NOT NULL AND jsonb_typeof(p_sets) <> 'array' THEN
    RAISE EXCEPTION 'invalid_sets';
  END IF;

  -- Un ejercicio privado de otra persona no se puede usar ni por id directo ni
  -- dentro de una serie. La función es SECURITY DEFINER (se salta RLS), así que
  -- la comprobación de propiedad va aquí. Los públicos tienen user_id NULL.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb)) AS s
    LEFT JOIN public.exercises e
      ON e.id = COALESCE(
        CASE
          WHEN (s->>'exercise_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (s->>'exercise_id')::uuid
          ELSE NULL
        END,
        p_exercise_id
      )
    WHERE e.id IS NULL
       OR (e.user_id IS NOT NULL AND e.user_id <> p_user_id)
  ) THEN
    RAISE EXCEPTION 'invalid_exercise';
  END IF;

  v_dur := CASE
    WHEN p_started_at IS NULL OR p_finished_at IS NULL THEN NULL
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (p_finished_at - p_started_at))::INT)
  END;

  v_hash := public.workout_request_hash(
    p_user_id, p_exercise_id, p_started_at, p_finished_at, p_sets, p_notes, p_rating
  );

  INSERT INTO workouts (user_id, started_at, finished_at, duration_seconds, notes, rating, client_id, idempotency_hash)
  VALUES (
    p_user_id,
    p_started_at,
    p_finished_at,
    v_dur,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    CASE WHEN p_rating BETWEEN 1 AND 5 THEN p_rating::SMALLINT ELSE NULL END,
    p_client_id,
    v_hash
  )
  -- Reintento concurrente: el índice único (user_id, client_id) hace que la
  -- segunda inserción espere a la primera y no escriba nada. Es la garantía de
  -- servidor; no depende de que el cliente consulte antes.
  ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_workout_id;

  IF v_workout_id IS NULL THEN
    SELECT id, idempotency_hash
      INTO v_workout_id, v_existing_hash
    FROM workouts
    WHERE user_id = p_user_id AND client_id = p_client_id
    FOR UPDATE;

    IF v_workout_id IS NULL THEN
      -- Imposible salvo corrupción: el conflicto vino de esta misma fila.
      RAISE EXCEPTION 'idempotency_state_missing';
    END IF;

    -- Fila anterior a esta migración: no había huella que comparar. Se adopta
    -- la del primer reenvío para no romper un reintento que cruzase el deploy.
    IF v_existing_hash IS NULL THEN
      UPDATE workouts SET idempotency_hash = v_hash WHERE id = v_workout_id;
      RETURN v_workout_id;
    END IF;

    IF v_existing_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict'
        USING ERRCODE = 'P0001',
              HINT = 'La clave de idempotencia ya se usó con otro contenido';
    END IF;

    RETURN v_workout_id;
  END IF;

  INSERT INTO workout_sets
    (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes, rpe, rir, set_type, duration_seconds)
  SELECT
    v_workout_id,
    COALESCE(
      CASE
        WHEN (s->>'exercise_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (s->>'exercise_id')::uuid
        ELSE NULL
      END,
      p_exercise_id
    ),
    (s->>'set_num')::INT,
    -- NULL explícito cuando no viene o no es un entero positivo: una serie por
    -- tiempo manda `reps: null`.
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
  FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb)) AS s
  -- Una fila sin nada que medir se descarta aquí en vez de hacer fallar el
  -- entreno entero contra el CHECK.
  WHERE (s->>'reps') ~ '^\d+$' AND (s->>'reps')::INT > 0
     OR (s->>'duration_seconds') ~ '^\d+$' AND (s->>'duration_seconds')::INT > 0;

  RETURN v_workout_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) TO authenticated;
