// Adaptador de proveedor (dialecto OpenAI chat-completions).
//
// Todo lo de aquí sale de medir, no de suponer (ver scripts/coach-eval):
//  - NVIDIA no usa `response_format`, usa `nvext.guided_json`.
//  - Groq acepta `json_schema` solo en algunos modelos; llama-3.3-70b-versatile
//    lo rechaza con 400 y hay que degradar a `json_object`.
//  - Los free tier devuelven 429/503 con normalidad: sin reintento, el usuario
//    ve un error que en realidad era congestión pasajera.
//
// Cambiar de proveedor son tres variables de entorno, sin tocar código.

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** `nvext` solo para NVIDIA NIM; el resto, estándar. */
  dialect: 'json_schema' | 'nvext';
}

export interface ChatResult {
  ok: boolean;
  text?: string;
  status?: number;
  error?: string;
  detail?: string;
  tokens: number;
  latencyMs: number;
  degraded?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deriva el dialecto de la URL para no obligar a configurar una variable más. */
export function dialectFor(baseUrl: string): ProviderConfig['dialect'] {
  return baseUrl.includes('api.nvidia.com') ? 'nvext' : 'json_schema';
}

function withStructuredOutput(
  body: Record<string, unknown>,
  dialect: ProviderConfig['dialect'],
  jsonSchema: unknown,
  degrade: boolean,
): Record<string, unknown> {
  if (degrade) return { ...body, response_format: { type: 'json_object' } };
  if (dialect === 'nvext') return { ...body, nvext: { guided_json: jsonSchema } };
  return {
    ...body,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'coach_output', strict: true, schema: jsonSchema },
    },
  };
}

async function callOnce(
  cfg: ProviderConfig,
  system: string,
  user: string,
  jsonSchema: unknown,
  degrade: boolean,
  timeoutMs: number,
): Promise<ChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  const body = withStructuredOutput(
    {
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 900,
      stream: false,
    },
    cfg.dialect,
    jsonSchema,
    degrade,
  );

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}`,
        detail: (await res.text()).slice(0, 400),
        tokens: 0,
        latencyMs,
      };
    }

    const json = await res.json();
    return {
      ok: true,
      text: json.choices?.[0]?.message?.content ?? '',
      tokens: json.usage?.total_tokens ?? 0,
      latencyMs,
      degraded: degrade,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'timeout' : 'network',
      detail: String(e instanceof Error ? e.message : e).slice(0, 400),
      tokens: 0,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatOptions {
  timeoutMs?: number;
  /**
   * Saltarse el intento con esquema estricto. Se usa en el reintento de
   * reparación: si la primera llamada ya tuvo que degradar, volver a probar
   * `json_schema` es un 400 garantizado y una vuelta perdida.
   */
  forceDegrade?: boolean;
}

export async function chat(
  cfg: ProviderConfig,
  system: string,
  user: string,
  jsonSchema: unknown,
  { timeoutMs = 30_000, forceDegrade = false }: ChatOptions = {},
): Promise<ChatResult> {
  let result = await callOnce(cfg, system, user, jsonSchema, forceDegrade, timeoutMs);

  // Congestión del free tier: un reintento corto antes de rendirse.
  if (!result.ok && (result.status === 429 || result.status === 503)) {
    await sleep(1500);
    result = await callOnce(cfg, system, user, jsonSchema, forceDegrade, timeoutMs);
  }

  // El modelo no admite json_schema: se pide JSON a secas. El esquema ya va en
  // el system prompt y Zod valida después, así que no se pierde garantía.
  if (
    !result.ok &&
    result.status === 400 &&
    /response_format|json_schema|guided/i.test(result.detail ?? '')
  ) {
    result = await callOnce(cfg, system, user, jsonSchema, true, timeoutMs);
  }

  return result;
}

function readProvider(prefix: string): ProviderConfig | null {
  const baseUrl = Deno.env.get(`${prefix}PROVIDER_URL`);
  const apiKey = Deno.env.get(`${prefix}API_KEY`);
  const model = Deno.env.get(`${prefix}MODEL`);
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl, apiKey, model, dialect: dialectFor(baseUrl) };
}

/** Proveedor principal. Sin él la función no tiene nada que hacer: revienta. */
export function requireProvider(): ProviderConfig {
  const cfg = readProvider('AI_COACH_');
  if (!cfg) throw new Error('Falta AI_COACH_PROVIDER_URL / AI_COACH_API_KEY / AI_COACH_MODEL');
  return cfg;
}

/**
 * Proveedor de respaldo. `null` si no está configurado: es opcional a
 * propósito, para no obligar a mantener dos cuentas solo para desplegar.
 */
export function optionalFallbackProvider(): ProviderConfig | null {
  return readProvider('AI_COACH_FALLBACK_');
}

/** El primario ha fallado por algo que al respaldo puede irle bien. */
export function shouldFallOver(result: ChatResult): boolean {
  if (result.ok) return false;
  if (result.error === 'timeout' || result.error === 'network') return true;
  return result.status === 429 || (result.status ?? 0) >= 500;
}
