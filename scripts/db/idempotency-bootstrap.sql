-- Entorno mínimo para probar las funciones de guardado en un PostgreSQL real.
--
-- Supabase aporta `auth.uid()`, los roles `anon`/`authenticated` y los GRANT por
-- defecto. Un PostgreSQL limpio no, así que se recrean aquí con el mismo
-- contrato observable: `auth.uid()` devuelve el `sub` del JWT de la sesión.
--
-- Esto NO es una migración: es utillaje de pruebas. No aplicar a producción.
-- Re-ejecutable: se puede aplicar sobre una base donde ya existe.

DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END;
$bootstrap$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY,
  email              text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
