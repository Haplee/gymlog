-- ============================================================
-- Entrenador IA (opt-in)
--
-- Regla que gobierna todo este fichero: el entrenador está APAGADO salvo que
-- el usuario lo encienda, y apagarlo borra sus datos de verdad. Los datos de
-- entrenamiento cruzados con peso, sexo, sueño y pulso son datos de salud
-- (RGPD art. 9): consentimiento explícito, minimización y borrado real.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- ============================================================

-- ============================================================
-- 1. CONSENTIMIENTO EN EL PERFIL
-- ============================================================
-- Fuente de verdad de servidor. El store del cliente es solo un espejo para la
-- UI: si discrepan, gana esto.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_consent_at timestamptz;
-- Si sube la versión del texto de consentimiento, el coach queda inactivo
-- hasta que el usuario vuelva a aceptar.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_consent_version smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.ai_coach_enabled IS
  'Entrenador IA activado por el usuario. Por defecto false; nada sale del dispositivo sin esto';

-- ============================================================
-- 2. MEMORIA DEL COACH
-- ============================================================
-- Lo que hace que la segunda conversación sea mejor que la primera. El modelo
-- la escribe vía tool call, pero el user_id lo pone SIEMPRE el servidor desde
-- el JWT: no está en el esquema que ve el modelo.
CREATE TABLE IF NOT EXISTS public.ai_coach_memory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category   text NOT NULL CHECK (category IN ('injury', 'preference', 'constraint', 'goal')),
  fact       text NOT NULL CHECK (char_length(fact) <= 200),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_coach_memory IS
  'Hechos aprendidos del usuario. Visibles y borrables desde Ajustes';

-- ============================================================
-- 3. CONVERSACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_coach_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  mode       text NOT NULL CHECK (mode IN ('weekly', 'chat', 'exercise')),
  content    text NOT NULL CHECK (char_length(content) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_coach_messages IS 'Historial del entrenador; se purga al desactivarlo';

-- ============================================================
-- 4. SUGERENCIAS
-- ============================================================
-- El coach PROPONE. Aplicar una sugerencia es una acción del usuario, nunca un
-- efecto colateral de generarla: por eso nacen en 'pending'.
CREATE TABLE IF NOT EXISTS public.ai_coach_suggestions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('load', 'volume', 'frequency', 'deload', 'rest', 'exercise_swap')),
  exercise_name text CHECK (exercise_name IS NULL OR char_length(exercise_name) <= 200),
  action        text NOT NULL CHECK (char_length(action) <= 200),
  rationale     text NOT NULL CHECK (char_length(rationale) <= 300),
  confidence    text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_coach_suggestions IS
  'Sugerencias del coach. Nacen pending: nada se aplica sin que el usuario lo pida';

-- ============================================================
-- 5. CUOTA DE USO
-- ============================================================
-- Con proveedor gratuito el recurso escaso son los límites de tasa, no el
-- dinero: esto impide que un usuario agote el free tier de todos.
CREATE TABLE IF NOT EXISTS public.ai_coach_usage (
  user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day      date NOT NULL DEFAULT CURRENT_DATE,
  mode     text NOT NULL CHECK (mode IN ('weekly', 'chat', 'exercise')),
  calls    integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  tokens   integer NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  PRIMARY KEY (user_id, day, mode)
);
COMMENT ON TABLE public.ai_coach_usage IS 'Cuota diaria por usuario y modo';

-- ============================================================
-- 6. AUDITORÍA DE CONSENTIMIENTO
-- ============================================================
-- Sirve para demostrar el consentimiento, no para analítica: aquí NO entra
-- ningún dato de salud ni contenido de conversación.
CREATE TABLE IF NOT EXISTS public.ai_coach_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event           text NOT NULL CHECK (event IN ('consent_given', 'consent_revoked', 'data_purged')),
  consent_version smallint,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_coach_audit IS
  'Trazas de consentimiento sin contenido: solo qué pasó y cuándo';

-- ============================================================
-- 7. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_coach_memory_user
  ON public.ai_coach_memory USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_user
  ON public.ai_coach_messages USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_coach_suggestions_user
  ON public.ai_coach_suggestions USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_coach_audit_user
  ON public.ai_coach_audit USING btree (user_id, created_at DESC);

-- ============================================================
-- 8. RLS — cada usuario, solo lo suyo
-- ============================================================
ALTER TABLE public.ai_coach_memory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_audit       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_coach_memory_own ON public.ai_coach_memory;
CREATE POLICY ai_coach_memory_own ON public.ai_coach_memory
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_coach_messages_own ON public.ai_coach_messages;
CREATE POLICY ai_coach_messages_own ON public.ai_coach_messages
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_coach_suggestions_own ON public.ai_coach_suggestions;
CREATE POLICY ai_coach_suggestions_own ON public.ai_coach_suggestions
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- La cuota es de solo lectura para el usuario: la escribe la Edge Function con
-- service_role. Si el cliente pudiera tocarla, la cuota no serviría de nada.
DROP POLICY IF EXISTS ai_coach_usage_read_own ON public.ai_coach_usage;
CREATE POLICY ai_coach_usage_read_own ON public.ai_coach_usage
  FOR SELECT TO public USING (auth.uid() = user_id);

-- Igual con la auditoría: el usuario la lee, no la escribe.
DROP POLICY IF EXISTS ai_coach_audit_read_own ON public.ai_coach_audit;
CREATE POLICY ai_coach_audit_read_own ON public.ai_coach_audit
  FOR SELECT TO public USING (auth.uid() = user_id);

-- ============================================================
-- 9. PURGA
-- ============================================================
-- Desactivar el entrenador borra sus datos de verdad, en una transacción.
-- Acotada a auth.uid(): pasarle el UUID de otro usuario no hace nada.
CREATE OR REPLACE FUNCTION public.ai_coach_purge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no autenticado';
  END IF;

  DELETE FROM public.ai_coach_memory      WHERE user_id = v_user;
  DELETE FROM public.ai_coach_messages    WHERE user_id = v_user;
  DELETE FROM public.ai_coach_suggestions WHERE user_id = v_user;

  UPDATE public.profiles
     SET ai_coach_enabled = false,
         ai_coach_consent_at = NULL
   WHERE id = v_user;

  INSERT INTO public.ai_coach_audit (user_id, event) VALUES (v_user, 'data_purged');
END;
$$;

COMMENT ON FUNCTION public.ai_coach_purge() IS
  'Borra memoria, mensajes y sugerencias del usuario autenticado y apaga el coach';

REVOKE ALL ON FUNCTION public.ai_coach_purge() FROM public;
GRANT EXECUTE ON FUNCTION public.ai_coach_purge() TO authenticated;

-- ============================================================
-- 10. CUOTA ATÓMICA
-- ============================================================
-- Comprobar y consumir en la MISMA sentencia. Si fueran dos (SELECT y luego
-- UPDATE), diez peticiones simultáneas pasarían todas el control.
-- La llama la Edge Function con service_role, antes de tocar al proveedor.
CREATE OR REPLACE FUNCTION public.ai_coach_consume_quota(
  p_user  uuid,
  p_mode  text,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calls integer;
BEGIN
  INSERT INTO public.ai_coach_usage (user_id, day, mode, calls)
       VALUES (p_user, CURRENT_DATE, p_mode, 1)
  ON CONFLICT (user_id, day, mode) DO UPDATE
          SET calls = public.ai_coach_usage.calls + 1
        WHERE public.ai_coach_usage.calls < p_limit
    RETURNING calls INTO v_calls;

  -- Sin fila devuelta, el WHERE del DO UPDATE bloqueó la subida: cuota agotada.
  RETURN v_calls IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.ai_coach_consume_quota(uuid, text, integer) IS
  'Consume una llamada de cuota de forma atómica. false = cuota agotada';

REVOKE ALL ON FUNCTION public.ai_coach_consume_quota(uuid, text, integer) FROM public;

-- ============================================================
-- 11. SUMA DE TOKENS REALES
-- ============================================================
-- La cuota se consume ANTES de llamar (para que un fallo no dé reintentos
-- gratis) y se corrige después con el gasto real.
CREATE OR REPLACE FUNCTION public.ai_coach_add_tokens(
  p_user   uuid,
  p_mode   text,
  p_tokens integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_coach_usage
     SET tokens = tokens + GREATEST(p_tokens, 0)
   WHERE user_id = p_user AND day = CURRENT_DATE AND mode = p_mode;
$$;

REVOKE ALL ON FUNCTION public.ai_coach_add_tokens(uuid, text, integer) FROM public;
