-- Favoritos por usuario sobre ejercicios (la estrella del kit FitBody).
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
--
-- Va en tabla aparte y no como columna de `exercises` porque el catálogo es
-- compartido (`user_id IS NULL` = ejercicio público): un booleano en la fila
-- del ejercicio marcaría el favorito para todo el mundo.

CREATE TABLE IF NOT EXISTS public.exercise_favorites (
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

-- La consulta habitual es "mis favoritos", por eso el índice por usuario.
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_user
  ON public.exercise_favorites (user_id);

COMMENT ON TABLE public.exercise_favorites IS
  'Ejercicios marcados como favoritos por cada usuario';

-- RLS: cada uno ve y escribe solo los suyos ---------------------------------
ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_favorites_select ON public.exercise_favorites;
CREATE POLICY exercise_favorites_select ON public.exercise_favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS exercise_favorites_write ON public.exercise_favorites;
CREATE POLICY exercise_favorites_write ON public.exercise_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Solo se puede marcar lo que se puede ver: propio o del catálogo público.
    AND EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = exercise_id AND (e.user_id = auth.uid() OR e.user_id IS NULL)
    )
  );
