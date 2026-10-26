-- Integridad de importaciones: cardio idempotente e importación JSON atómica.
--
-- Cierra los dos huecos que quedaban tras 20261026120000:
--
--   1. **Cardio de Excel.** Guardaba con un `INSERT` directo. Si la escritura
--      llegaba al servidor y se perdía la respuesta, el reintento creaba otra
--      sesión. Ahora la sesión lleva `client_id` (la operación) e
--      `idempotency_hash` (su contenido), y se escribe con `save_cardio_session`.
--      Un reenvío con la misma clave devuelve la fila original; con otra carga
--      falla con `idempotency_conflict`. El índice único existente
--      `(user_id, started_at)` se conserva como dedupe de contenido de cardio:
--      una operación nueva con la misma fecha y el mismo contenido recibe la
--      sesión existente; con contenido distinto falla con
--      `cardio_content_conflict`, que es un conflicto revisable, no un éxito
--      silencioso.
--
--   2. **Importación JSON parcial.** Antes hacía una RPC por (día, ejercicio):
--      una interrupción dejaba días escritos y otros no. `import_history_workouts`
--      recibe el lote completo y llama a `save_workout_with_sets` dentro de una
--      única transacción. O entra todo o no entra nada. Las claves de cada
--      entreno se derivan de `p_import_id` de forma determinista, así que el
--      reintento de la misma operación recupera lo escrito y una importación
--      manual nueva usa otra identidad.
--
-- Compatibilidad:
--   * `cardio_sessions` solo gana columnas anulables y un índice parcial: las
--     filas y el `upsert` de `cardioStore` siguen funcionando igual.
--   * Las filas de cardio anteriores a esta migración no tienen huella. En su
--     primer reenvío se calcula la huella de la fila real: si coincide con la
--     carga, se adopta; si no, es un conflicto explícito, nunca un éxito mudo.
--   * `import_history_workouts` es una función nueva; no cambia ninguna firma.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
-- CREATE OR REPLACE.
--
-- **Despliegue manual, no automático:** aplicar con `supabase db push` o desde el
-- SQL editor del proyecto. No borra ni migra filas.

-- 1. Identidad de operación del cardio --------------------------------------

ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS idempotency_hash text;

COMMENT ON COLUMN public.cardio_sessions.client_id IS
  'Clave de idempotencia de la operación que creó la sesión. NULL en filas manuales o anteriores a la migración.';
COMMENT ON COLUMN public.cardio_sessions.idempotency_hash IS
  'Huella md5 del contenido que acompañó a client_id. Detecta una clave reutilizada con otra carga. NULL en filas anteriores a la migración.';

-- El índice de contenido `(user_id, started_at)` de 20260711120000 se mantiene:
-- cardioStore hace upsert contra él y sigue siendo la red de seguridad del
-- guardado manual. Este nuevo índice es el de idempotencia de solicitud.
CREATE UNIQUE INDEX IF NOT EXISTS cardio_sessions_user_client_uniq
  ON public.cardio_sessions (user_id, client_id)
  WHERE client_id IS NOT NULL;

-- 2. Huella canónica del cardio --------------------------------------------

-- Igual que `workout_request_hash`: se normalizan números (`trim_scale`) y se
-- usa `extract(epoch ...)` para que el huso horario de la sesión no cambie la
-- huella. `distance` se normaliza a la precisión real de la columna
-- (`numeric(7,2)`) para que un reenvío con más decimales no parezca otra carga.
CREATE OR REPLACE FUNCTION public.cardio_request_hash(
  p_user_id uuid,
  p_type text,
  p_started_at timestamptz,
  p_duration integer,
  p_distance numeric,
  p_calories integer,
  p_notes text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $function$
  SELECT md5(
    COALESCE(p_user_id::text, '') || chr(31) ||
    COALESCE(p_type, '') || chr(31) ||
    COALESCE(extract(epoch FROM p_started_at)::text, '') || chr(31) ||
    COALESCE(p_duration::text, '') || chr(31) ||
    COALESCE(trim_scale(p_distance::numeric(7,2))::text, '') || chr(31) ||
    COALESCE(p_calories::text, '') || chr(31) ||
    COALESCE(btrim(COALESCE(p_notes, '')), '')
  );
$function$;

COMMENT ON FUNCTION public.cardio_request_hash(uuid, text, timestamptz, integer, numeric, integer, text) IS
  'Huella estable del contenido de una sesión de cardio. Detecta una clave de idempotencia reutilizada con otra carga.';

-- 3. Guardado idempotente de cardio -----------------------------------------

CREATE OR REPLACE FUNCTION public.save_cardio_session(
  p_user_id uuid,
  p_client_id uuid,
  p_type text,
  p_started_at timestamptz,
  p_duration integer,
  p_distance numeric DEFAULT NULL,
  p_calories integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id               UUID;
  v_client           UUID;
  v_existing_hash    TEXT;
  v_existing_type    TEXT;
  v_existing_start   TIMESTAMPTZ;
  v_existing_dur     INTEGER;
  v_existing_dist    NUMERIC;
  v_existing_cal     INTEGER;
  v_existing_notes   TEXT;
  v_hash             TEXT;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'invalid_client_id';
  END IF;

  IF p_started_at IS NULL
     OR p_duration IS NULL OR p_duration < 0
     OR p_type IS NULL
     OR p_type NOT IN ('running','cycling','rowing','swimming','elliptical','walking','jump_rope','other') THEN
    RAISE EXCEPTION 'invalid_cardio';
  END IF;

  v_hash := public.cardio_request_hash(
    p_user_id, p_type, p_started_at, p_duration, p_distance, p_calories, p_notes
  );

  -- Camino rápido: la clave es nueva. `ON CONFLICT` sobre el índice de
  -- idempotencia hace que un reenvío concurrente espere y no escriba.
  BEGIN
    INSERT INTO public.cardio_sessions
      (user_id, client_id, idempotency_hash, type, started_at, duration,
       distance, calories, notes)
    VALUES
      (p_user_id, p_client_id, v_hash, p_type, p_started_at, p_duration,
       p_distance, p_calories, NULLIF(btrim(COALESCE(p_notes, '')), ''))
    ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Colisión con `(user_id, started_at)`: otra clave para el mismo instante.
    -- No es un error de la operación; se resuelve abajo como dedupe de contenido
    -- o conflicto explícito.
    v_id := NULL;
  END;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Reintento de la misma clave o colisión de contenido. Se bloquea la fila
  -- para que dos reenvíos concurrentes comparen la misma huella.
  SELECT id, client_id, idempotency_hash,
         type, started_at, duration, distance, calories, notes
    INTO v_id, v_client, v_existing_hash,
         v_existing_type, v_existing_start, v_existing_dur,
         v_existing_dist, v_existing_cal, v_existing_notes
  FROM public.cardio_sessions
  WHERE user_id = p_user_id
    AND (client_id = p_client_id OR started_at = p_started_at)
  ORDER BY (client_id = p_client_id) DESC, created_at ASC, id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    -- Imposible salvo corrupción: el conflicto vino de una fila que ya no está.
    RAISE EXCEPTION 'idempotency_state_missing';
  END IF;

  -- Fila anterior a esta migración: no había huella. Se calcula con el contenido
  -- REAL de la fila y se compara: adoptar la huella entrante sin mirar la fila
  -- convertiría una sesión incompatible en un éxito silencioso. Si coincide, se
  -- adopta también la clave para que el siguiente reintento la encuentre por
  -- (user_id, client_id) y no dependa del índice de contenido.
  IF v_existing_hash IS NULL THEN
    v_existing_hash := public.cardio_request_hash(
      p_user_id, v_existing_type, v_existing_start, v_existing_dur,
      v_existing_dist, v_existing_cal, v_existing_notes
    );

    IF v_existing_hash <> v_hash THEN
      IF v_client IS NOT DISTINCT FROM p_client_id THEN
        RAISE EXCEPTION 'idempotency_conflict'
          USING ERRCODE = 'P0001',
                HINT = 'La clave de idempotencia ya se usó con otra sesión de cardio';
      END IF;
      RAISE EXCEPTION 'cardio_content_conflict'
        USING ERRCODE = 'P0001',
              HINT = 'Ya existe otra sesión de cardio en ese instante con contenido distinto';
    END IF;

    UPDATE public.cardio_sessions
       SET idempotency_hash = v_existing_hash,
           client_id = COALESCE(client_id, p_client_id)
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  IF v_existing_hash <> v_hash THEN
    IF v_client IS NOT DISTINCT FROM p_client_id THEN
      RAISE EXCEPTION 'idempotency_conflict'
        USING ERRCODE = 'P0001',
              HINT = 'La clave de idempotencia ya se usó con otra sesión de cardio';
    END IF;
    RAISE EXCEPTION 'cardio_content_conflict'
      USING ERRCODE = 'P0001',
            HINT = 'Ya existe otra sesión de cardio en ese instante con contenido distinto';
  END IF;

  -- Misma clave y misma carga, o clave distinta con el mismo contenido:
  -- la sesión ya existe y no se duplica.
  RETURN v_id;
END;
$function$;

COMMENT ON FUNCTION public.save_cardio_session(uuid, uuid, text, timestamptz, integer, numeric, integer, text) IS
  'Guarda una sesión de cardio de forma idempotente por (user_id, client_id). Un reintento devuelve la sesión original; otra carga falla con idempotency_conflict.';

REVOKE ALL ON FUNCTION public.save_cardio_session(uuid, uuid, text, timestamptz, integer, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cardio_session(uuid, uuid, text, timestamptz, integer, numeric, integer, text) TO authenticated;

-- 4. Clave determinista de un elemento de importación -----------------------

-- Deriva un UUID de la identidad de la importación y del ámbito del elemento
-- (`workout:<n>:<epoch>:<exercise_id>`). No es una firma: es un espacio de
-- nombres estable. Se evita `uuid_generate_v5` para no depender de que la
-- extensión `uuid-ossp` esté en el `search_path` de la función (en Supabase
-- puede vivir en `extensions`, y esta función fija `public`).
CREATE OR REPLACE FUNCTION public.import_operation_key(
  p_import_id uuid,
  p_scope text
)
  RETURNS uuid
  LANGUAGE sql
  IMMUTABLE
AS $function$
  SELECT (
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-4' ||
    substr(h, 14, 3) || '-' ||
    substr('89ab', (('x' || substr(h, 17, 1))::bit(4)::int & 3) + 1, 1) ||
    substr(h, 18, 3) || '-' ||
    substr(h, 21, 12)
  )::uuid
  FROM (
    SELECT md5(
      COALESCE(p_import_id::text, '') || chr(31) || COALESCE(p_scope, '')
    ) AS h
  ) AS digest;
$function$;

COMMENT ON FUNCTION public.import_operation_key(uuid, text) IS
  'UUID determinista por (importación, ámbito). No criptográfico: se usa como clave de idempotencia de un lote.';

-- 5. Importación JSON atómica ------------------------------------------------

-- p_workouts es un array de objetos:
--   { started_at, finished_at, exercise_id, sets: [...] }
-- Cada elemento se guarda con una clave derivada de p_import_id, su posición y
-- su contenido. Toda la función es una sola transacción: si un elemento falla
-- (validación, propiedad, conflicto de idempotencia), no queda ninguno escrito.
--
-- `p_import_id` se genera en el cliente antes de la primera escritura y se
-- conserva durante la operación y sus reintentos de red. Una importación manual
-- nueva usa otro id, aunque contenga entrenos del mismo día.
CREATE OR REPLACE FUNCTION public.import_history_workouts(
  p_user_id uuid,
  p_import_id uuid,
  p_workouts jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item        JSONB;
  v_ord         INTEGER := 0;
  v_started_at  TIMESTAMPTZ;
  v_finished_at TIMESTAMPTZ;
  v_exercise_id UUID;
  v_sets        JSONB;
  v_client_id   UUID;
  v_count       INTEGER := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_import_id IS NULL THEN
    RAISE EXCEPTION 'invalid_import_id';
  END IF;

  IF p_workouts IS NULL OR jsonb_typeof(p_workouts) <> 'array' THEN
    RAISE EXCEPTION 'invalid_workouts';
  END IF;

  IF jsonb_array_length(p_workouts) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_workouts) LOOP
    v_ord := v_ord + 1;

    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_workout';
    END IF;

    v_started_at := NULLIF(v_item->>'started_at', '')::TIMESTAMPTZ;
    v_finished_at := NULLIF(v_item->>'finished_at', '')::TIMESTAMPTZ;
    v_exercise_id := NULLIF(v_item->>'exercise_id', '')::UUID;
    v_sets := COALESCE(v_item->'sets', '[]'::JSONB);

    IF v_started_at IS NULL
       OR v_exercise_id IS NULL
       OR jsonb_typeof(v_sets) <> 'array' THEN
      RAISE EXCEPTION 'invalid_workout';
    END IF;

    v_client_id := public.import_operation_key(
      p_import_id,
      format(
        'workout:%s:%s:%s',
        v_ord,
        extract(EPOCH FROM v_started_at)::text,
        v_exercise_id::text
      )
    );

    PERFORM public.save_workout_with_sets(
      p_user_id,
      v_exercise_id,
      v_started_at,
      v_finished_at,
      v_sets,
      NULLIF(v_item->>'notes', ''),
      CASE
        WHEN (v_item->>'rating') ~ '^\d+$' THEN (v_item->>'rating')::INTEGER
        ELSE NULL
      END,
      v_client_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.import_history_workouts(uuid, uuid, jsonb) IS
  'Importa un lote JSON completo en una sola transacción. Las claves de cada entreno se derivan de p_import_id, así que un reintento de la misma operación no duplica y una importación nueva usa otra identidad.';

REVOKE ALL ON FUNCTION public.import_history_workouts(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_history_workouts(uuid, uuid, jsonb) TO authenticated;
