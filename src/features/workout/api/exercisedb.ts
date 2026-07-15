/**
 * Cliente de la API de ExerciseDB (catálogo de ejercicios con GIFs e instrucciones).
 *
 * Por defecto apunta al endpoint gratuito open-source SIN clave
 * (https://oss.exercisedb.dev/api/v1). Si se configura una key de RapidAPI por
 * variable de entorno, se añaden las cabeceras correspondientes.
 *
 * Nota sobre el tier gratuito: el listado no pagina de forma fiable (siempre
 * devuelve la primera página) y no soporta filtrado server-side por atributo.
 * Por eso la exploración es guiada por búsqueda de texto (`searchExercises`) y
 * el filtrado por parte del cuerpo / músculo / equipamiento se hace en cliente
 * sobre los resultados ya obtenidos.
 */

const BASE_URL = (
  import.meta.env.VITE_EXERCISEDB_BASE_URL || 'https://oss.exercisedb.dev/api/v1'
).replace(/\/$/, '');

const RAPIDAPI_KEY = import.meta.env.VITE_EXERCISEDB_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = import.meta.env.VITE_EXERCISEDB_RAPIDAPI_HOST || 'exercisedb.p.rapidapi.com';

/** Forma cruda de un ejercicio tal como lo devuelve ExerciseDB. */
export interface RawExercise {
  exerciseId: string;
  name: string;
  gifUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  bodyParts?: string[];
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  equipments?: string[];
  instructions?: string[];
  overview?: string;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

/** Cabeceras de autenticación: solo si hay key de RapidAPI configurada. */
function authHeaders(): Record<string, string> {
  if (!RAPIDAPI_KEY) return {};
  return {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
    signal,
  });
  if (!res.ok) {
    throw new Error(`ExerciseDB ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (json.error) {
    throw new Error(json.error.message || json.error.code || 'ExerciseDB error');
  }
  return json.data as T;
}

/** Busca ejercicios por texto libre en el nombre. */
export async function searchExercises(query: string, signal?: AbortSignal): Promise<RawExercise[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await apiGet<RawExercise[]>(
    `/exercises/search?search=${encodeURIComponent(q)}&limit=25`,
    signal,
  );
  return Array.isArray(data) ? data : [];
}

/** Devuelve la primera página del catálogo (destacados) para el estado inicial. */
export async function fetchFeaturedExercises(signal?: AbortSignal): Promise<RawExercise[]> {
  const data = await apiGet<RawExercise[]>(`/exercises?limit=25`, signal);
  return Array.isArray(data) ? data : [];
}

/** Detalle completo de un ejercicio por id (incluye músculos e instrucciones). */
export async function fetchExerciseById(
  id: string,
  signal?: AbortSignal,
): Promise<RawExercise | null> {
  const data = await apiGet<RawExercise>(`/exercises/${encodeURIComponent(id)}`, signal);
  return data ?? null;
}
