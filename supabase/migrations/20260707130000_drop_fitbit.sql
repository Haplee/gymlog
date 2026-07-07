-- Elimina por completo la integración Fitbit a nivel de base de datos.
-- El código cliente y la edge function fitbit-oauth ya se retiraron.
-- Verificado antes de escribir: 0 filas con 'fitbit' en cardio_sessions,
-- wearable_connections, wearable_daily y wearable_sleep. Las salvaguardas de
-- reasignación se dejan por idempotencia (por si se aplicara en un entorno con
-- datos residuales). Se conservan Health Connect / HealthKit intactos.

-- 1. Funciones de tokens OAuth: solo las invocaba la edge function fitbit-oauth.
DROP FUNCTION IF EXISTS public.wearable_store_tokens(uuid, text, text, text, timestamptz, text[], text);
DROP FUNCTION IF EXISTS public.wearable_get_tokens(uuid, text);

-- 2. Columnas de tokens/Fitbit en wearable_connections (solo las rellenaba Fitbit).
ALTER TABLE public.wearable_connections
  DROP COLUMN IF EXISTS vault_access_secret_id,
  DROP COLUMN IF EXISTS vault_refresh_secret_id,
  DROP COLUMN IF EXISTS fitbit_user_id,
  DROP COLUMN IF EXISTS access_expires_at,
  DROP COLUMN IF EXISTS scopes;

-- 3. Salvaguarda: reasignar/eliminar cualquier fila residual con 'fitbit'
--    antes de endurecer los CHECK. Las sesiones de cardio se conservan (solo
--    pierden la etiqueta de origen); los datos de salud solo-Fitbit se eliminan.
UPDATE public.cardio_sessions SET source = 'manual' WHERE source = 'fitbit';
DELETE FROM public.wearable_daily WHERE source = 'fitbit';
DELETE FROM public.wearable_sleep WHERE source = 'fitbit';
DELETE FROM public.wearable_connections WHERE provider = 'fitbit';

-- 4. Endurecer los CHECK quitando 'fitbit' del dominio permitido.
ALTER TABLE public.wearable_connections DROP CONSTRAINT IF EXISTS wearable_connections_provider_check;
ALTER TABLE public.wearable_connections
  ADD CONSTRAINT wearable_connections_provider_check
  CHECK (provider IN ('health_connect', 'healthkit'));

ALTER TABLE public.wearable_daily DROP CONSTRAINT IF EXISTS wearable_daily_source_check;
ALTER TABLE public.wearable_daily
  ADD CONSTRAINT wearable_daily_source_check
  CHECK (source IN ('health_connect', 'healthkit'));

ALTER TABLE public.wearable_sleep DROP CONSTRAINT IF EXISTS wearable_sleep_source_check;
ALTER TABLE public.wearable_sleep
  ADD CONSTRAINT wearable_sleep_source_check
  CHECK (source IN ('health_connect', 'healthkit'));

ALTER TABLE public.cardio_sessions DROP CONSTRAINT IF EXISTS cardio_sessions_source_check;
ALTER TABLE public.cardio_sessions
  ADD CONSTRAINT cardio_sessions_source_check
  CHECK (source IN ('manual', 'health_connect', 'healthkit'));
