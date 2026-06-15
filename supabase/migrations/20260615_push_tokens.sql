-- Push remoto (FCM): almacén de tokens de dispositivo por usuario.
-- Cada dispositivo registra su token al arrancar (si las notificaciones están
-- activas). El envío lo hace una edge function con service_role (bypassa RLS).
-- Idempotente.

-- ── Tabla ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un token físico es único globalmente (un dispositivo, un registro). El upsert
-- del cliente usa este constraint para refrescar user_id/updated_at.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_key ON public.push_tokens (token);
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

-- ── updated_at automático ───────────────────────────────────────────────────--
CREATE OR REPLACE FUNCTION public.touch_push_tokens_updated_at()
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

REVOKE EXECUTE ON FUNCTION public.touch_push_tokens_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_push_tokens_updated_at();

-- ── RLS: cada usuario gestiona solo sus propios tokens ──────────────────────────
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;
CREATE POLICY push_tokens_select_own ON public.push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;
CREATE POLICY push_tokens_insert_own ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_tokens_update_own ON public.push_tokens;
CREATE POLICY push_tokens_update_own ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;
CREATE POLICY push_tokens_delete_own ON public.push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- anon no toca esta tabla
REVOKE ALL ON public.push_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
