-- Huella de idempotencia: casts tolerantes a campos vacíos.
--
-- Avería que arregla: `workout_request_hash` casteaba cada campo numérico del
-- JSON directamente (`(s->>'rpe')::numeric`). Un campo **presente pero vacío**
-- no es un número, así que Postgres abortaba la llamada entera:
--
--   invalid input syntax for type numeric: ""
--
-- La APK manda `rpe: ''` en todas las series, de modo que desde que se desplegó
-- el contrato de idempotencia **ningún** guardado funcionaba: la RPC no llegaba
-- a insertar nada y la pantalla solo decía «Error guardando».
--
-- El cliente ya no manda el campo vacío, pero el servidor no puede depender de
-- eso: versiones antiguas instaladas, la cola offline con entradas ya guardadas
-- y cualquier cliente futuro seguirían rompiendo. Aquí un valor no numérico se
-- trata como «sin dato» (NULL), que es lo mismo que hace la inserción de series
-- unas líneas más abajo con sus expresiones regulares.

-- 1. Conversores que devuelven NULL en vez de abortar ------------------------

CREATE OR REPLACE FUNCTION public.try_numeric(p_value text)
  RETURNS numeric
  LANGUAGE sql
  IMMUTABLE
AS $function$
  SELECT CASE
    WHEN btrim(p_value) ~ '^-?\d+(\.\d+)?$' THEN btrim(p_value)::numeric
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.try_numeric(text) IS
  'Número del JSON o NULL si el valor falta, está vacío o no es numérico. Evita que un campo vacío aborte el guardado entero.';

CREATE OR REPLACE FUNCTION public.try_boolean(p_value text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
AS $function$
  SELECT CASE
    WHEN lower(btrim(p_value)) IN ('true', 'false', 't', 'f', '1', '0')
      THEN lower(btrim(p_value))::boolean
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.try_boolean(text) IS
  'Booleano del JSON o NULL si el valor falta o no se reconoce.';

-- 2. La huella, con los mismos valores para las cargas válidas ---------------
--
-- Los conversores producen exactamente el mismo texto que antes cuando el valor
-- era válido, así que las huellas ya guardadas siguen coincidiendo y un
-- reintento que cruzase este despliegue no se marca como conflicto.

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
            COALESCE(public.try_numeric(s->>'set_num')::text, ''),
            COALESCE(public.try_numeric(s->>'reps')::text, ''),
            COALESCE(trim_scale(public.try_numeric(s->>'weight'))::text, ''),
            COALESCE(public.try_boolean(s->>'is_warmup')::text, ''),
            COALESCE(s->>'notes', ''),
            COALESCE(public.try_numeric(s->>'rpe')::text, ''),
            COALESCE(public.try_numeric(s->>'rir')::text, ''),
            COALESCE(s->>'set_type', ''),
            COALESCE(public.try_numeric(s->>'duration_seconds')::text, '')
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
  'Huella estable del contenido de un guardado. Se usa para detectar una clave de idempotencia reutilizada con otra carga. Tolera campos vacíos en el JSON.';
