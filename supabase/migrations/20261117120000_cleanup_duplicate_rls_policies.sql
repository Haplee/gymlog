-- Limpieza de políticas RLS duplicadas en la tabla exercises
-- Deja solo las políticas canónicas:
--   SELECT: exercises_own_or_public (auth.uid() = user_id OR is_public = true)
--   INSERT: exercises_insert_own (auth.uid() = user_id)
--   UPDATE: exercises_update_own (auth.uid() = user_id)
--   DELETE: exercises_delete_own (auth.uid() = user_id)
-- Idempotente: usa DROP POLICY IF EXISTS

-- Eliminar políticas SELECT duplicadas
DROP POLICY IF EXISTS exercises_select ON public.exercises;
-- exercises_own_or_public se mantiene (es la canónica)

-- Eliminar políticas INSERT duplicadas
DROP POLICY IF EXISTS exercises_insert ON public.exercises;
-- exercises_insert_own se mantiene

-- Eliminar políticas UPDATE duplicadas
DROP POLICY IF EXISTS exercises_update ON public.exercises;
-- exercises_update_own se mantiene

-- Eliminar políticas DELETE duplicadas
DROP POLICY IF EXISTS exercises_delete ON public.exercises;
-- exercises_delete_own se mantiene

-- Verificación: listar políticas restantes
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'exercises';