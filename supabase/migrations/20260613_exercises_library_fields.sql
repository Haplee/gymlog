-- ============================================================
-- 2026-06-13 — Campos de biblioteca de ejercicios
-- Aditivo + idempotente: instrucciones (description) y GIF/imagen (media_url).
-- ============================================================

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(description) <= 2000);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS media_url TEXT
    CHECK (media_url IS NULL OR char_length(media_url) <= 500);

COMMENT ON COLUMN exercises.description IS 'Instrucciones / cues de ejecución del ejercicio';
COMMENT ON COLUMN exercises.media_url IS 'URL de GIF o imagen demostrativa';
