-- Idempotencia en save_workout_with_sets: evita entrenos duplicados cuando la
-- petición se reintenta tras haberse ya escrito en el servidor.
--
-- El fallo real: el cliente lanza el RPC, Postgres hace COMMIT y la respuesta se
-- pierde por el camino (red móvil, WebView en segundo plano). El cliente ve un
-- error de red, encola el entreno en el outbox y al reabrir la app lo reenvía.
-- Resultado: la misma sesión escrita dos o tres veces. Sin una clave estable que
-- el servidor pueda reconocer, no hay forma de distinguir un reintento de un
-- entreno nuevo legítimo (repetir el mismo ejercicio el mismo día es válido).
--
-- La clave la genera el cliente ANTES del primer intento y la reutiliza en todos
-- los reintentos, incluido el paso por el outbox. Es la misma pieza que usan las
-- pasarelas de pago con su Idempotency-Key.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + DROP/CREATE
-- de la función.

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS client_id uuid;

COMMENT ON COLUMN public.workouts.client_id IS
  'Clave de idempotencia generada por el cliente. Un reintento del mismo envío trae el mismo valor y no crea un entreno nuevo. NULL en filas anteriores a la migración.';

-- Parcial: las filas históricas (client_id NULL) no se ven afectadas, y NULL no
-- colisiona consigo mismo en un índice único de todas formas.
CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_client_id_key
  ON public.workouts (user_id, client_id)
  WHERE client_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer);
DROP FUNCTION IF EXISTS public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid);

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
    -- Sin client_id no hay forma de deduplicar: un NULL aquí solo puede venir del
    -- ON CONFLICT, porque el INSERT plano o inserta o lanza excepción.
    SELECT id INTO v_workout_id
    FROM workouts
    WHERE user_id = p_user_id AND client_id = p_client_id;

    RETURN v_workout_id;
  END IF;

  INSERT INTO workout_sets
    (workout_id, exercise_id, set_num, reps, weight, is_warmup, notes, rpe, rir, set_type)
  SELECT
    v_workout_id,
    p_exercise_id,
    (s->>'set_num')::INT,
    (s->>'reps')::INT,
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
    END
  FROM jsonb_array_elements(p_sets) AS s;

  RETURN v_workout_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_with_sets(uuid, uuid, timestamptz, timestamptz, jsonb, text, integer, uuid) TO authenticated;
