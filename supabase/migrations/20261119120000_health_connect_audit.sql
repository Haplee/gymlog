-- Health Connect audit trail for RGPD compliance
-- Records sync events without PHI (no physiological values, no external record IDs)

CREATE TABLE IF NOT EXISTS public.health_connect_audit (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type      text NOT NULL, -- 'permission_granted', 'permission_revoked', 'sync_start', 'sync_complete', 'sync_error', 'disconnect'
    record_types    text[] NOT NULL DEFAULT '{}', -- e.g. ['resting_heart_rate', 'sleep', 'steps', 'exercise']
    record_count    integer NOT NULL DEFAULT 0,
    error_code      text, -- matches HealthConnectError codes: NOT_AVAILABLE, PERMISSION_DENIED, FEATURE_UNAVAILABLE, INVALID_TIME_RANGE, SYNC_INTERRUPTED, READ_FAILED, UNKNOWN_ERROR
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.health_connect_audit IS 'Audit trail for Health Connect access; no PHI stored';

-- Enable RLS
ALTER TABLE public.health_connect_audit ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users can only insert their own audit events
DROP POLICY IF EXISTS health_connect_audit_insert ON public.health_connect_audit;
CREATE POLICY health_connect_audit_insert ON public.health_connect_audit
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- SELECT: authenticated users can only read their own audit events
DROP POLICY IF EXISTS health_connect_audit_select ON public.health_connect_audit;
CREATE POLICY health_connect_audit_select ON public.health_connect_audit
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies: audit trail integrity preserved
-- Only service_role (edge functions) could purge via admin if needed

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_health_connect_audit_user_created ON public.health_connect_audit (user_id, created_at DESC);