/**
 * Traducción bajo demanda EN→ES vía MyMemory (gratis, sin clave), con caché
 * persistente en localStorage. El catálogo de ExerciseDB solo existe en inglés;
 * cuando el idioma de la app es español, traducimos nombres e instrucciones y
 * cacheamos por texto para no repetir peticiones. Si falla, se devuelve el
 * original (degradación sin ruido).
 */

const CACHE_KEY = 'gymlog-mm-cache-v1';
const ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_CONCURRENCY = 4;

const cache: Record<string, string> = load();

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* cuota llena: se ignora, la caché sigue en memoria */
    }
  }, 500);
}

const keyFor = (text: string, target: string) => `${target}:${text.trim().toLowerCase()}`;

async function translateOne(text: string, target: string, signal?: AbortSignal): Promise<string> {
  const k = keyFor(text, target);
  const cached = cache[k];
  if (cached !== undefined) return cached;
  if (!text.trim()) return text;

  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=en|${target}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return text;
    const json = (await res.json()) as { responseData?: { translatedText?: string } };
    const translated = json.responseData?.translatedText;
    // MyMemory a veces devuelve avisos de cuota en translatedText en MAYÚSCULAS.
    if (!translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) return text;
    cache[k] = translated;
    persist();
    return translated;
  } catch {
    return text;
  }
}

/**
 * Traduce una lista de textos EN→`target`. Devuelve un mapa original→traducción.
 * Si `target` es 'en' (o vacío) no traduce (el origen ya es inglés).
 */
export async function translateTexts(
  texts: string[],
  target: string,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (target === 'en' || !target) {
    for (const t of texts) result[t] = t;
    return result;
  }

  const unique = [...new Set(texts.filter((t) => t.trim()))];
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const original = unique[idx];
      result[original] = await translateOne(original, target, signal);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, unique.length) }, worker));
  return result;
}
