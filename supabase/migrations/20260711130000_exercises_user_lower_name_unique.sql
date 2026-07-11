-- Bug §4.2 (ANALISIS_LOGICA.md): ejercicio custom duplicable.
-- El UNIQUE (name, user_id) existente es case-sensitive: 'Press banca' y
-- 'press banca' conviven. Además, si un INSERT tenía éxito pero la respuesta
-- se perdía, el reintento del outbox creaba otra fila. El cliente ahora
-- resuelve-o-crea (resolveOrCreateExercise, case-insensitive); este índice
-- único sobre (user_id, lower(name)) es la defensa en profundidad.
-- Idempotente: dedup previo con remapeo de FKs + CREATE UNIQUE INDEX IF NOT EXISTS.

-- 1. Mapa de duplicados → superviviente (la fila más antigua) por
--    (user_id, lower(name)). Solo ejercicios de usuario: la biblioteca global
--    (user_id IS NULL) queda fuera del índice parcial y del dedup.
CREATE TEMP TABLE exercise_dup_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(name)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id, lower(name)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id
  FROM public.exercises
  WHERE user_id IS NOT NULL
)
SELECT id AS dup_id, keep_id
FROM ranked
WHERE rn > 1;

-- 2. Remapear referencias sin constraint única sobre (user, exercise).
UPDATE public.workout_sets ws
SET exercise_id = m.keep_id
FROM exercise_dup_map m
WHERE ws.exercise_id = m.dup_id;

UPDATE public.exercise_notes en
SET exercise_id = m.keep_id
FROM exercise_dup_map m
WHERE en.exercise_id = m.dup_id;

-- 3. personal_records: UNIQUE (user_id, exercise_id, rep_band). Ante conflicto
--    entre el PR del duplicado y el del superviviente, gana el mejor e1RM.
DELETE FROM public.personal_records pr
USING exercise_dup_map m, public.personal_records pk
WHERE pr.exercise_id = m.dup_id
  AND pk.exercise_id = m.keep_id
  AND pk.user_id = pr.user_id
  AND pk.rep_band = pr.rep_band
  AND COALESCE(pk.one_rm, pk.weight) >= COALESCE(pr.one_rm, pr.weight);

DELETE FROM public.personal_records pk
USING exercise_dup_map m, public.personal_records pr
WHERE pr.exercise_id = m.dup_id
  AND pk.exercise_id = m.keep_id
  AND pk.user_id = pr.user_id
  AND pk.rep_band = pr.rep_band;

UPDATE public.personal_records pr
SET exercise_id = m.keep_id
FROM exercise_dup_map m
WHERE pr.exercise_id = m.dup_id;

-- 4. exercise_goals: UNIQUE (user_id, exercise_id). Ante conflicto se conserva
--    el objetivo actualizado más recientemente.
DELETE FROM public.exercise_goals g
USING exercise_dup_map m, public.exercise_goals gk
WHERE g.exercise_id = m.dup_id
  AND gk.exercise_id = m.keep_id
  AND gk.user_id = g.user_id
  AND gk.updated_at >= g.updated_at;

DELETE FROM public.exercise_goals gk
USING exercise_dup_map m, public.exercise_goals g
WHERE g.exercise_id = m.dup_id
  AND gk.exercise_id = m.keep_id
  AND gk.user_id = g.user_id;

UPDATE public.exercise_goals g
SET exercise_id = m.keep_id
FROM exercise_dup_map m
WHERE g.exercise_id = m.dup_id;

-- 5. Borrar los ejercicios duplicados ya sin referencias.
DELETE FROM public.exercises e
USING exercise_dup_map m
WHERE e.id = m.dup_id;

-- 6. Índice único case-insensitive por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_lower_name_uniq
  ON public.exercises (user_id, lower(name))
  WHERE user_id IS NOT NULL;
