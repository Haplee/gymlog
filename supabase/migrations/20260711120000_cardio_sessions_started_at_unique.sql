-- Evita sesiones de cardio duplicadas: cuando el INSERT tiene éxito en el
-- servidor pero se pierde la respuesta (corte de red), el cliente reintenta y
-- reinsertaba la misma sesión. La red de seguridad por `started_at` en el
-- cliente comparaba strings ISO crudos ('...Z' vs '...+00:00') y nunca casaba.
-- Este índice único hace que un reintento (ahora upsert onConflict) sea
-- idempotente a nivel de base de datos.
-- Idempotente: dedup previo + CREATE UNIQUE INDEX IF NOT EXISTS.

-- 1. Deduplicar filas existentes conservando la más antigua por (user, started_at).
--    Sin esto, el CREATE UNIQUE INDEX fallaría si ya hay duplicados en producción.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, started_at
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.cardio_sessions
)
DELETE FROM public.cardio_sessions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Índice único: una sola sesión de cardio por (usuario, instante de inicio).
CREATE UNIQUE INDEX IF NOT EXISTS cardio_sessions_user_started_uniq
  ON public.cardio_sessions (user_id, started_at);
