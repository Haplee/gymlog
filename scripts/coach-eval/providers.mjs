// Proveedores compatibles con OpenAI chat-completions.
//
// El adaptador de la Fase 2 tendrá esta misma forma. El matiz que justifica que
// exista un `dialect` en vez de un objeto único: NVIDIA NO usa `response_format`
// para la salida estructurada, sino su extensión propia `nvext.guided_json`.

export const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    envKeys: ['GROQ_API_KEY', 'AI_COACH_API_KEY'],
    dialect: 'json_schema',
    defaultModels: ['llama-3.3-70b-versatile'],
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    envKeys: ['CEREBRAS_API_KEY', 'AI_COACH_API_KEY'],
    dialect: 'json_schema',
    defaultModels: ['llama-3.3-70b'],
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKeys: ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY', 'AI_COACH_API_KEY'],
    dialect: 'nvext',
    defaultModels: [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'qwen/qwen2.5-72b-instruct',
    ],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    envKeys: ['OPENROUTER_API_KEY', 'AI_COACH_API_KEY'],
    dialect: 'json_schema',
    defaultModels: ['meta-llama/llama-3.3-70b-instruct:free'],
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'AI_COACH_API_KEY'],
    dialect: 'json_schema',
    defaultModels: ['gemini-2.5-flash'],
  },
};

export function resolveApiKey(provider) {
  const cfg = PROVIDERS[provider];
  for (const name of cfg.envKeys) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

/** Añade al cuerpo la forma de pedir JSON que entiende cada proveedor. */
function applyStructuredOutput(body, dialect, jsonSchema, formatMode) {
  if (formatMode === 'json_object') {
    return { ...body, response_format: { type: 'json_object' } };
  }
  if (dialect === 'nvext') {
    // NVIDIA: extensión propia. `response_format` aquí no hace nada.
    return { ...body, nvext: { guided_json: jsonSchema } };
  }
  return {
    ...body,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'coach_output', strict: true, schema: jsonSchema },
    },
  };
}

/** Lista los modelos que la cuenta tiene realmente disponibles. */
export async function listModels(provider) {
  const cfg = PROVIDERS[provider];
  const key = resolveApiKey(provider);
  if (!key) throw new Error(`Falta la clave: define ${cfg.envKeys[0]}`);

  const res = await fetch(`${cfg.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return (json.data ?? []).map((m) => m.id).sort();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Una llamada de chat. Devuelve el texto crudo y la telemetría; no interpreta
 * el contenido — de eso se encarga el evaluador.
 *
 * Reintenta ante 429/503 porque el endpoint gratuito de NVIDIA los devuelve de
 * forma habitual ("Worker local total request limit reached"): sin reintento se
 * estaría midiendo la congestión del proveedor, no la calidad del modelo.
 */
export async function chat({
  provider,
  model,
  system,
  user,
  jsonSchema,
  timeoutMs = 90_000,
  retries = 2,
}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await chatOnce({ provider, model, system, user, jsonSchema, timeoutMs });
    const retriable = !last.ok && (last.error === 'HTTP 503' || last.error === 'HTTP 429');
    if (!retriable || attempt === retries) break;
    await sleep(2000 * (attempt + 1));
  }

  // Degradado de formato: no todos los modelos aceptan json_schema (en Groq,
  // llama-3.3-70b-versatile lo rechaza con 400). Se reintenta pidiendo JSON a
  // secas; el esquema ya va descrito en el system prompt y Zod es la red real.
  if (!last.ok && last.error === 'HTTP 400' && /response_format|json_schema/i.test(last.detail ?? '')) {
    last = await chatOnce({
      provider,
      model,
      system,
      user,
      jsonSchema,
      timeoutMs,
      formatMode: 'json_object',
    });
    if (last.ok) last.degraded = true;
  }

  return last;
}

async function chatOnce({ provider, model, system, user, jsonSchema, timeoutMs, formatMode }) {
  const cfg = PROVIDERS[provider];
  const key = resolveApiKey(provider);
  if (!key) throw new Error(`Falta la clave: define ${cfg.envKeys[0]}`);

  let body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    max_tokens: 900,
    stream: false,
  };
  body = applyStructuredOutput(body, cfg.dialect, jsonSchema, formatMode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}`,
        detail: (await res.text()).slice(0, 300),
      };
    }

    const json = await res.json();
    return {
      ok: true,
      latencyMs,
      text: json.choices?.[0]?.message?.content ?? '',
      finishReason: json.choices?.[0]?.finish_reason ?? null,
      usage: json.usage ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: e.name === 'AbortError' ? 'timeout' : 'network',
      detail: String(e.message ?? e).slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}
