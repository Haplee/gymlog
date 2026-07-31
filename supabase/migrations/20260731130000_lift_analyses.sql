-- Resultados del análisis de vídeo de levantamientos (VBT).
--
-- Fase 3 del plan de docs/LIFT_ANALYSIS_PLAN.md. La tabla se crea ya para que
-- el esquema esté cerrado y revisado, aunque quien la escribe —el servicio de
-- análisis— todavía no exista. Hoy no la usa nadie desde la app.
--
-- Idempotente: se puede aplicar las veces que haga falta.

CREATE TABLE IF NOT EXISTS public.lift_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Si se borra la serie, el análisis sobrevive suelto en vez de desaparecer:
  -- el vídeo ya está procesado y su medición sigue valiendo.
  workout_set_id uuid REFERENCES public.workout_sets(id) ON DELETE SET NULL,
  -- Mismo contenido que el JSON del script: reps[], fps, escala y unidades.
  -- Va en jsonb porque el formato de las métricas todavía se está moviendo.
  metrics jsonb NOT NULL,
  -- Ruta en Storage, no una URL pública: un vídeo de alguien entrenando no
  -- puede quedar accesible a quien acierte el enlace.
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lift_analyses IS
  'Analisis de video por serie: bar path, reps y velocidad (VBT)';
COMMENT ON COLUMN public.lift_analyses.video_url IS
  'Ruta en Supabase Storage, no URL publica';

-- Consulta esperada: los análisis de un usuario, los más recientes primero.
CREATE INDEX IF NOT EXISTS lift_analyses_user_created_idx
  ON public.lift_analyses (user_id, created_at DESC);

-- Para pintar el análisis dentro del detalle de una serie.
CREATE INDEX IF NOT EXISTS lift_analyses_set_idx
  ON public.lift_analyses (workout_set_id)
  WHERE workout_set_id IS NOT NULL;

ALTER TABLE public.lift_analyses ENABLE ROW LEVEL SECURITY;

-- Una sola política, con USING y WITH CHECK explícitos. Nada de una política
-- por operación ni duplicados: las permissive se combinan con OR y cada una de
-- más es una vía que hay que recordar cerrar el día que esto se endurezca.
DROP POLICY IF EXISTS lift_analyses_own ON public.lift_analyses;
CREATE POLICY lift_analyses_own ON public.lift_analyses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
