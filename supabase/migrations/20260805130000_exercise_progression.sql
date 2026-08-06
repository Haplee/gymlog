-- ============================================================
-- Progresión automática por ejercicio (P5, fases 2 y 4)
-- ------------------------------------------------------------
-- `exercise_progression` guarda el estado del ciclo de cada
-- ejercicio: carga de trabajo actual, doble progresión y
-- contador hacia la siguiente semana de descarga.
--
-- `progression_log` es el registro de auditoría: cada cambio de
-- carga, cada suma de repetición y el arranque/cierre de cada
-- descarga, para que el historial del entrenador y del usuario
-- sepan qué pasó y cuándo.
--
-- Idempotente: se puede aplicar las veces que haga falta.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_progression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- El catálogo identifica a los ejercicios del usuario por nombre (la rutina
  -- guarda nombres, no ids), así que la clave de progresión es el nombre.
  exercise_name text NOT NULL,
  rep_min integer,
  rep_max integer,
  increment_kg numeric NOT NULL DEFAULT 2.5,
  bodyweight boolean NOT NULL DEFAULT false,
  current_weight numeric,
  current_reps integer,
  session_count integer NOT NULL DEFAULT 0,
  next_deload_week integer NOT NULL DEFAULT 2,
  is_deload_week boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_name)
);

COMMENT ON TABLE public.exercise_progression IS
  'Estado del ciclo de progresion por ejercicio: carga, doble progresion y descarga programada';

CREATE TABLE IF NOT EXISTS public.progression_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  event text NOT NULL CHECK (
    event IN ('seed', 'increase', 'add-reps', 'deload-start', 'deload-end')
  ),
  from_weight numeric,
  to_weight numeric,
  reps integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.progression_log IS
  'Registro de auditoria de los cambios de la progresion automatica';

-- Consulta esperada: el ciclo de un usuario, que se pinta como lista.
CREATE INDEX IF NOT EXISTS exercise_progression_user_idx
  ON public.exercise_progression (user_id);

-- Consulta esperada: el historial de un ejercicio, de más reciente a más viejo.
CREATE INDEX IF NOT EXISTS progression_log_user_exercise_idx
  ON public.progression_log (user_id, exercise_name, created_at DESC);

-- Mantener `updated_at` al día en cada actualización de la progresión.
CREATE OR REPLACE FUNCTION public.set_progression_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exercise_progression_touch ON public.exercise_progression;
CREATE TRIGGER exercise_progression_touch
  BEFORE UPDATE ON public.exercise_progression
  FOR EACH ROW
  EXECUTE FUNCTION public.set_progression_updated_at();

ALTER TABLE public.exercise_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_log ENABLE ROW LEVEL SECURITY;

-- Una sola política por tabla, con USING y WITH CHECK explícitos, igual que en
-- el resto del esquema: cada usuario solo lee y escribe sus propias filas.
DROP POLICY IF EXISTS exercise_progression_own ON public.exercise_progression;
CREATE POLICY exercise_progression_own ON public.exercise_progression
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS progression_log_own ON public.progression_log;
CREATE POLICY progression_log_own ON public.progression_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
