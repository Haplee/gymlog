-- Endurecimiento de privacidad.
--
-- `public.backup_user_routines_20260902` es una tabla de copia que quedó de
-- una migración manual. Está en el esquema `public`, así que PostgREST la
-- expone, no tiene RLS y conserva los grants por defecto a `anon` y
-- `authenticated`. Cualquiera con la clave pública del proyecto podía leer
-- las rutinas de todas las cuentas. No se borra: se bloquea.
--
-- El bloque recorre **todas** las tablas `backup_%` de `public`, no solo la
-- que conocemos. Si mañana aparece otra copia con el mismo patrón, esta
-- migración la cierra al reejecutarse sin tocar sus datos.
--
-- Idempotente: se puede reejecutar sin efectos secundarios. No borra datos.

-- Copias antiguas: RLS activa, sin políticas y sin grants ---------------------
DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'backup\_%'
  LOOP
    -- Sin políticas, RLS activa = nadie salvo el propietario y `service_role`
    -- (que tiene BYPASSRLS). Es justo lo que queremos para una copia.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);

    -- Una política antigua podría seguir abriendo la tabla: se quitan todas.
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.relname
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t.relname);
    END LOOP;

    -- Segunda barrera: aunque alguien desactivara RLS, sin privilegio de tabla
    -- PostgREST no puede ni leerla.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t.relname);

    RAISE NOTICE 'Copia % bloqueada (RLS activa, sin políticas y sin grants)', t.relname;
  END LOOP;
END
$$;
