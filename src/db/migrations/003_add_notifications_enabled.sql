-- ============================================================
-- GymLog v2 — Migración 003: notificaciones y perfiles
-- Añade la columna applications_enabled a profiles
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
