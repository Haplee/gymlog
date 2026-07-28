// Edge Function: ai-coach
//
// Entrenador IA. Único camino entre el cliente y el proveedor de modelo.
//
// DIFERENCIA CRÍTICA CON send-push: aquella se autoriza con un secreto
// compartido (x-send-secret). Aquí eso sería un agujero, porque a esta función
// la llama la app: un secreto que viaja dentro del APK o del bundle de la PWA
// es un secreto público. Se verifica el JWT de Supabase del llamante y el
// user_id sale SIEMPRE del token, nunca del cuerpo de la petición.
//
// Secrets requeridos (supabase secrets set ...):
//   - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (plataforma)
//   - AI_COACH_API_KEY          clave del proveedor (NUNCA en el cliente)
//   - AI_COACH_PROVIDER_URL     p.ej. https://api.groq.com/openai/v1
//   - AI_COACH_MODEL            p.ej. llama-3.3-70b-versatile
//   - AI_COACH_ENABLED          'true' para servir; cualquier otra cosa = 503
//   - AI_COACH_ALLOWED_ORIGINS  lista separada por comas
//
// Body: { mode: 'weekly'|'chat'|'exercise', message?: string, exercise_name?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requestSchema, coachOutputSchema, outputJsonSchema, extractJson } from './schema.ts';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.ts';
import { buildContext } from './context.ts';
import { applySafety } from './safety.ts';
import { chat, dialectFor } from './provider.ts';

/** Cuota diaria por modo. Por debajo del límite del proveedor, nunca al ras. */
const DAILY_LIMITS: Record<string, number> = { weekly: 2, chat: 20, exercise: 30 };

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/**
 * Telemetría a los logs de Supabase. SOLO contadores y códigos: ni el prompt,
 * ni la respuesta, ni nada que el usuario haya escrito.
 *
 * Va por console.log a propósito (los logs de la plataforma se leen por nivel y
 * esto no es un aviso ni un fallo); la regla del repo asume código de navegador.
 */
// eslint-disable-next-line no-console
const logMetric = (payload: Record<string, unknown>) => console.log(JSON.stringify(payload));

/** CORS restringido: nada de '*' en un endpoint que gasta cuota. */
function corsFor(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('AI_COACH_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin'));

  // 1. Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  // 2. Kill switch: se apaga sin publicar versión y antes de tocar nada.
  if (Deno.env.get('AI_COACH_ENABLED') !== 'true') {
    return json({ error: 'coach_disabled' }, 503, cors);
  }

  // 3. Token presente
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);

  try {
    // 4. Identidad: del JWT y solo del JWT.
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await asUser.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401, cors);
    const userId = user.id;

    // 5. Cuerpo validado. Un `user_id` aquí se ignora: no está en el esquema.
    const parsedBody = requestSchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) return json({ error: 'bad_request' }, 400, cors);
    const { mode, message, exercise_name } = parsedBody.data;

    // 6. A partir de aquí service_role, siempre filtrando por userId.
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

    // 7. Consentimiento. Sin esto no se llama al proveedor bajo ningún concepto.
    const { data: profile } = await admin
      .from('profiles')
      .select('ai_coach_enabled')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.ai_coach_enabled) return json({ error: 'consent_required' }, 403, cors);

    // 8. Cuota atómica, ANTES de gastar. Si fallara la llamada, el usuario ya
    //    ha consumido: es el precio de que un error no dé reintentos infinitos.
    const { data: allowed } = await admin.rpc('ai_coach_consume_quota', {
      p_user: userId,
      p_mode: mode,
      p_limit: DAILY_LIMITS[mode] ?? 10,
    });
    if (allowed !== true) {
      return json({ error: 'quota_exceeded' }, 429, { ...cors, 'Retry-After': '3600' });
    }

    // 9. Contexto minimizado + memoria del propio usuario.
    const [{ context, lastWeightByExercise }, { data: memory }] = await Promise.all([
      buildContext(admin, userId),
      admin
        .from('ai_coach_memory')
        .select('category, fact')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // 10. Proveedor.
    const providerUrl = env('AI_COACH_PROVIDER_URL');
    const result = await chat(
      {
        baseUrl: providerUrl,
        apiKey: env('AI_COACH_API_KEY'),
        model: env('AI_COACH_MODEL'),
        dialect: dialectFor(providerUrl),
      },
      SYSTEM_PROMPT,
      buildUserMessage({
        mode,
        context,
        memory: memory ?? [],
        userText: message,
        exerciseName: exercise_name,
      }),
      outputJsonSchema,
    );

    // Métricas sí; contenido del prompt o de la respuesta, jamás.
    logMetric({
      fn: 'ai-coach',
      mode,
      ok: result.ok,
      status: result.status ?? 200,
      latency_ms: result.latencyMs,
      tokens: result.tokens,
      degraded: result.degraded ?? false,
    });

    if (!result.ok) {
      const status = result.status === 429 || result.status === 503 ? 503 : 502;
      return json({ error: 'provider_unavailable' }, status, cors);
    }

    // 11. Validación + barreras. El esquema del proveedor es ayuda; esto es la red.
    const raw = extractJson(result.text ?? '');
    const parsed = coachOutputSchema.safeParse(raw);
    if (!parsed.success) {
      logMetric({ fn: 'ai-coach', event: 'schema_invalid' });
      return json({ error: 'invalid_output' }, 502, cors);
    }

    const { output, corrections } = applySafety(parsed.data, {
      userText: message,
      lastWeightByExercise,
    });
    if (corrections.length > 0) {
      logMetric({ fn: 'ai-coach', event: 'safety', corrections });
    }

    // 12. Persistir y responder.
    await admin.rpc('ai_coach_add_tokens', {
      p_user: userId,
      p_mode: mode,
      p_tokens: result.tokens,
    });

    const rows = [];
    if (message) rows.push({ user_id: userId, role: 'user', mode, content: message });
    rows.push({ user_id: userId, role: 'assistant', mode, content: JSON.stringify(output) });
    await admin.from('ai_coach_messages').insert(rows);

    if (output.suggestions.length > 0) {
      // Nacen 'pending' por defecto: aplicarlas es cosa del usuario.
      await admin.from('ai_coach_suggestions').insert(
        output.suggestions.map((s) => ({
          user_id: userId,
          kind: s.kind,
          exercise_name: s.exercise_name,
          action: s.action,
          rationale: s.rationale,
          confidence: s.confidence,
        })),
      );
    }

    return json(output, 200, cors);
  } catch (e) {
    // Nunca se filtra la traza al cliente: podría llevar detalles del proveedor.
    console.error(JSON.stringify({ fn: 'ai-coach', event: 'unhandled', message: String(e) }));
    return json({ error: 'internal_error' }, 500, cors);
  }
});
