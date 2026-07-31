-- Elimina la política RLS duplicada de `user_routines`.
--
-- La tabla tenía dos políticas PERMISSIVE FOR ALL con la misma condición:
--
--   routines_all  USING (auth.uid() = user_id)                                  -- sin WITH CHECK
--   routines_own  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
--
-- Hoy son equivalentes (en una política FOR ALL sin WITH CHECK, Postgres usa la
-- expresión de USING también como comprobación de escritura), así que sobra una.
--
-- El problema no es el de ahora, es el de mañana: las políticas permissive se
-- combinan con OR. Si algún día se endurece `routines_own` —por ejemplo para
-- exigir además una organización o un rol—, `routines_all` seguiría concediendo
-- el acceso antiguo por su cuenta y el endurecimiento no serviría de nada. Y no
-- saltaría ningún error: simplemente no aplicaría.
--
-- Se conserva `routines_own` porque declara USING y WITH CHECK de forma
-- explícita, que es lo que se quiere leer en una auditoría.
--
-- Idempotente: se puede aplicar las veces que haga falta.

DROP POLICY IF EXISTS routines_all ON public.user_routines;

-- Red de seguridad: si alguien aplicase esto sobre una base donde solo existiera
-- la política que se elimina, la tabla se quedaría sin ninguna y RLS bloquearía
-- todo. Se recrea la buena si no está.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_routines'
      AND policyname = 'routines_own'
  ) THEN
    CREATE POLICY routines_own ON public.user_routines
      FOR ALL TO public
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;
