-- Wearables: Fitbit (Web API) + Health Connect (Android) + HealthKit (iOS).
-- Modelo normalizado: conexiones (tokens en Vault), resumen diario, sueño.
-- Workouts automáticos reutilizan cardio_sessions (source + external_id).
-- Idempotente. RLS por user_id. Tokens NUNCA en columnas planas.

-- Extensión Vault (en Supabase suele venir instalada; guard por si acaso)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- wearable_connections: una fila por (user, provider).
-- Los tokens OAuth (Fitbit) se guardan cifrados en Vault; aquí solo los UUID
-- de secreto. La edge function (service_role) es la única que los descifra.
CREATE TABLE IF NOT EXISTS public.wearable_connections (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider                text NOT NULL CHECK (provider IN ('fitbit','health_connect','healthkit')),
  status                  text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','error')),
  vault_access_secret_id  uuid,
  vault_refresh_secret_id uuid,
  scopes                  text[] NOT NULL DEFAULT '{}',
  fitbit_user_id          text,
  access_expires_at       timestamptz,
  last_sync_at            timestamptz,
  last_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
COMMENT ON TABLE public.wearable_connections IS 'Conexiones a wearables; tokens OAuth en Vault (solo UUID de secreto aquí)';

-- wearable_daily: resumen diario agregado (pasos, actividad, HR de reposo).
CREATE TABLE IF NOT EXISTS public.wearable_daily (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date        date NOT NULL,
  source      text NOT NULL CHECK (source IN ('fitbit','health_connect','healthkit')),
  steps       integer CHECK (steps IS NULL OR steps >= 0),
  distance_km real    CHECK (distance_km IS NULL OR distance_km >= 0),
  calories    integer CHECK (calories IS NULL OR calories >= 0),
  resting_hr  integer CHECK (resting_hr IS NULL OR (resting_hr BETWEEN 20 AND 250)),
  avg_hr      integer CHECK (avg_hr IS NULL OR (avg_hr BETWEEN 20 AND 250)),
  max_hr      integer CHECK (max_hr IS NULL OR (max_hr BETWEEN 20 AND 250)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, source)
);
COMMENT ON TABLE public.wearable_daily IS 'Resumen diario agregado por wearable';

-- wearable_sleep: sueño por noche.
CREATE TABLE IF NOT EXISTS public.wearable_sleep (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date           date NOT NULL,
  source         text NOT NULL CHECK (source IN ('fitbit','health_connect','healthkit')),
  duration_min   integer CHECK (duration_min IS NULL OR duration_min >= 0),
  deep_min       integer CHECK (deep_min IS NULL OR deep_min >= 0),
  light_min      integer CHECK (light_min IS NULL OR light_min >= 0),
  rem_min        integer CHECK (rem_min IS NULL OR rem_min >= 0),
  awake_min      integer CHECK (awake_min IS NULL OR awake_min >= 0),
  efficiency_pct integer CHECK (efficiency_pct IS NULL OR (efficiency_pct BETWEEN 0 AND 100)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, source)
);
COMMENT ON TABLE public.wearable_sleep IS 'Sueño por noche importado de wearable';

-- ============================================================
-- 2. EXTENDER cardio_sessions (workouts automáticos + HR de sesión)
-- ============================================================
ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','fitbit','health_connect','healthkit'));
ALTER TABLE public.cardio_sessions ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS avg_hr integer CHECK (avg_hr IS NULL OR (avg_hr BETWEEN 20 AND 250));
ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS max_hr integer CHECK (max_hr IS NULL OR (max_hr BETWEEN 20 AND 250));

-- Dedupe de workouts importados: único por (user, external_id) cuando no es nulo.
CREATE UNIQUE INDEX IF NOT EXISTS cardio_sessions_user_external_uniq
  ON public.cardio_sessions (user_id, external_id)
  WHERE external_id IS NOT NULL;

-- ============================================================
-- 3. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wearable_daily_user_date ON public.wearable_daily USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_sleep_user_date ON public.wearable_sleep USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_conn_user ON public.wearable_connections USING btree (user_id);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_sleep       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wearable_connections_own ON public.wearable_connections;
CREATE POLICY wearable_connections_own ON public.wearable_connections
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wearable_daily_own ON public.wearable_daily;
CREATE POLICY wearable_daily_own ON public.wearable_daily
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wearable_sleep_own ON public.wearable_sleep;
CREATE POLICY wearable_sleep_own ON public.wearable_sleep
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. RPCs (upsert masivo; SECURITY DEFINER + check auth.uid())
-- ============================================================

-- Upsert de resumen diario. p_rows = jsonb array de objetos:
-- { date, source, steps, distance_km, calories, resting_hr, avg_hr, max_hr }
CREATE OR REPLACE FUNCTION public.upsert_wearable_daily(p_user_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.wearable_daily
    (user_id, date, source, steps, distance_km, calories, resting_hr, avg_hr, max_hr)
  SELECT
    p_user_id,
    (r->>'date')::date,
    r->>'source',
    NULLIF(r->>'steps','')::integer,
    NULLIF(r->>'distance_km','')::real,
    NULLIF(r->>'calories','')::integer,
    NULLIF(r->>'resting_hr','')::integer,
    NULLIF(r->>'avg_hr','')::integer,
    NULLIF(r->>'max_hr','')::integer
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (user_id, date, source) DO UPDATE SET
    steps       = COALESCE(EXCLUDED.steps, public.wearable_daily.steps),
    distance_km = COALESCE(EXCLUDED.distance_km, public.wearable_daily.distance_km),
    calories    = COALESCE(EXCLUDED.calories, public.wearable_daily.calories),
    resting_hr  = COALESCE(EXCLUDED.resting_hr, public.wearable_daily.resting_hr),
    avg_hr      = COALESCE(EXCLUDED.avg_hr, public.wearable_daily.avg_hr),
    max_hr      = COALESCE(EXCLUDED.max_hr, public.wearable_daily.max_hr);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Upsert de sueño. p_rows = jsonb array:
-- { date, source, duration_min, deep_min, light_min, rem_min, awake_min, efficiency_pct }
CREATE OR REPLACE FUNCTION public.upsert_wearable_sleep(p_user_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.wearable_sleep
    (user_id, date, source, duration_min, deep_min, light_min, rem_min, awake_min, efficiency_pct)
  SELECT
    p_user_id,
    (r->>'date')::date,
    r->>'source',
    NULLIF(r->>'duration_min','')::integer,
    NULLIF(r->>'deep_min','')::integer,
    NULLIF(r->>'light_min','')::integer,
    NULLIF(r->>'rem_min','')::integer,
    NULLIF(r->>'awake_min','')::integer,
    NULLIF(r->>'efficiency_pct','')::integer
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (user_id, date, source) DO UPDATE SET
    duration_min   = COALESCE(EXCLUDED.duration_min, public.wearable_sleep.duration_min),
    deep_min       = COALESCE(EXCLUDED.deep_min, public.wearable_sleep.deep_min),
    light_min      = COALESCE(EXCLUDED.light_min, public.wearable_sleep.light_min),
    rem_min        = COALESCE(EXCLUDED.rem_min, public.wearable_sleep.rem_min),
    awake_min      = COALESCE(EXCLUDED.awake_min, public.wearable_sleep.awake_min),
    efficiency_pct = COALESCE(EXCLUDED.efficiency_pct, public.wearable_sleep.efficiency_pct);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Importar workouts detectados a cardio_sessions, dedupe por external_id.
-- p_rows = jsonb array:
-- { external_id, source, type, started_at, duration, distance, calories, avg_hr, max_hr }
CREATE OR REPLACE FUNCTION public.import_wearable_workouts(p_user_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.cardio_sessions
    (user_id, type, started_at, duration, distance, calories, avg_hr, max_hr, source, external_id)
  SELECT
    p_user_id,
    COALESCE(r->>'type','other'),
    (r->>'started_at')::timestamptz,
    COALESCE(NULLIF(r->>'duration','')::integer, 0),
    NULLIF(r->>'distance','')::real,
    NULLIF(r->>'calories','')::integer,
    NULLIF(r->>'avg_hr','')::integer,
    NULLIF(r->>'max_hr','')::integer,
    r->>'source',
    r->>'external_id'
  FROM jsonb_array_elements(p_rows) AS r
  WHERE r->>'external_id' IS NOT NULL
  ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
    duration = EXCLUDED.duration,
    distance = COALESCE(EXCLUDED.distance, public.cardio_sessions.distance),
    calories = COALESCE(EXCLUDED.calories, public.cardio_sessions.calories),
    avg_hr   = COALESCE(EXCLUDED.avg_hr, public.cardio_sessions.avg_hr),
    max_hr   = COALESCE(EXCLUDED.max_hr, public.cardio_sessions.max_hr);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Endurecer permisos: solo authenticated puede ejecutar los RPC.
REVOKE ALL ON FUNCTION public.upsert_wearable_daily(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_wearable_sleep(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_wearable_workouts(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_wearable_daily(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_wearable_sleep(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_wearable_workouts(uuid, jsonb) TO authenticated;

-- ============================================================
-- 6. TOKENS VAULT (wrappers public; SOLO service_role los ejecuta)
--    PostgREST no expone el esquema vault; estas funciones SECURITY DEFINER
--    (owner = postgres, con acceso a vault) son el único puente. El cliente
--    nunca llama a estas; solo la edge function con la service_role key.
-- ============================================================

-- Guarda/rota tokens en Vault y upserta la conexión. p_refresh opcional (Fitbit
-- a veces no rota el refresh en cada refresh; conservamos el anterior).
CREATE OR REPLACE FUNCTION public.wearable_store_tokens(
  p_user_id        uuid,
  p_provider       text,
  p_access         text,
  p_refresh        text,
  p_expires_at     timestamptz,
  p_scopes         text[],
  p_fitbit_user_id text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'pg_temp'
AS $function$
DECLARE
  v_access_id  uuid;
  v_refresh_id uuid;
BEGIN
  SELECT vault_access_secret_id, vault_refresh_secret_id
    INTO v_access_id, v_refresh_id
    FROM public.wearable_connections
   WHERE user_id = p_user_id AND provider = p_provider;

  IF v_access_id IS NULL THEN
    v_access_id := vault.create_secret(
      p_access,
      'wearable_' || p_provider || '_access_' || p_user_id::text,
      'GymLog wearable access token');
  ELSE
    PERFORM vault.update_secret(v_access_id, p_access);
  END IF;

  IF p_refresh IS NOT NULL AND p_refresh <> '' THEN
    IF v_refresh_id IS NULL THEN
      v_refresh_id := vault.create_secret(
        p_refresh,
        'wearable_' || p_provider || '_refresh_' || p_user_id::text,
        'GymLog wearable refresh token');
    ELSE
      PERFORM vault.update_secret(v_refresh_id, p_refresh);
    END IF;
  END IF;

  INSERT INTO public.wearable_connections
    (user_id, provider, status, vault_access_secret_id, vault_refresh_secret_id,
     scopes, fitbit_user_id, access_expires_at, last_sync_at, updated_at)
  VALUES
    (p_user_id, p_provider, 'connected', v_access_id, v_refresh_id,
     COALESCE(p_scopes, '{}'), p_fitbit_user_id, p_expires_at, now(), now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    status                  = 'connected',
    vault_access_secret_id  = EXCLUDED.vault_access_secret_id,
    vault_refresh_secret_id = COALESCE(EXCLUDED.vault_refresh_secret_id,
                                       public.wearable_connections.vault_refresh_secret_id),
    scopes                  = EXCLUDED.scopes,
    fitbit_user_id          = COALESCE(EXCLUDED.fitbit_user_id,
                                       public.wearable_connections.fitbit_user_id),
    access_expires_at       = EXCLUDED.access_expires_at,
    last_error              = NULL,
    updated_at              = now();
END;
$function$;

-- Devuelve los tokens descifrados de una conexión (solo service_role).
CREATE OR REPLACE FUNCTION public.wearable_get_tokens(p_user_id uuid, p_provider text)
 RETURNS TABLE(
   access_token      text,
   refresh_token     text,
   access_expires_at timestamptz,
   scopes            text[],
   fitbit_user_id    text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'pg_temp'
AS $function$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM public.wearable_connections
   WHERE user_id = p_user_id AND provider = p_provider;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT
    (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = c.vault_access_secret_id),
    (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = c.vault_refresh_secret_id),
    c.access_expires_at, c.scopes, c.fitbit_user_id;
END;
$function$;

-- Solo la service_role (edge function) puede tocar tokens.
REVOKE ALL ON FUNCTION public.wearable_store_tokens(uuid, text, text, text, timestamptz, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wearable_get_tokens(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wearable_store_tokens(uuid, text, text, text, timestamptz, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wearable_get_tokens(uuid, text) TO service_role;
