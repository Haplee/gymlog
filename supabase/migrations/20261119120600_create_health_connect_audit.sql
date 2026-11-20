CREATE TABLE IF NOT EXISTS public.health_connect_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  record_types text[] NOT NULL DEFAULT '{}',
  record_count integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_connect_audit_user_created
  ON public.health_connect_audit (user_id, created_at DESC);

ALTER TABLE public.health_connect_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_connect_audit_select_own
  ON public.health_connect_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY health_connect_audit_insert_own
  ON public.health_connect_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
