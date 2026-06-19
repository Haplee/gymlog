-- Objetivos de 1RM por ejercicio. Cada usuario fija una meta de 1RM estimado
-- para un ejercicio; la UI muestra progreso actual vs objetivo. Idempotente.

CREATE TABLE IF NOT EXISTS public.exercise_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  target_one_rm numeric NOT NULL CHECK (target_one_rm > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS exercise_goals_user_idx ON public.exercise_goals (user_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.touch_exercise_goals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_exercise_goals_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_exercise_goals_updated_at ON public.exercise_goals;
CREATE TRIGGER trg_exercise_goals_updated_at
  BEFORE UPDATE ON public.exercise_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_exercise_goals_updated_at();

-- RLS: cada usuario gestiona solo sus objetivos
ALTER TABLE public.exercise_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_goals_select_own ON public.exercise_goals;
CREATE POLICY exercise_goals_select_own ON public.exercise_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS exercise_goals_insert_own ON public.exercise_goals;
CREATE POLICY exercise_goals_insert_own ON public.exercise_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exercise_goals_update_own ON public.exercise_goals;
CREATE POLICY exercise_goals_update_own ON public.exercise_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exercise_goals_delete_own ON public.exercise_goals;
CREATE POLICY exercise_goals_delete_own ON public.exercise_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.exercise_goals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_goals TO authenticated;
