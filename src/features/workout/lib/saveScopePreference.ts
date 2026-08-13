/**
 * Qué series guardar cuando hay completadas y sin marcar a la vez.
 *
 * La pregunta solo tiene sentido la primera vez: quien marca series lo hace
 * siempre igual. Se recuerda la respuesta en `localStorage` con el mismo patrón
 * que `ExerciseLoadType` (lectura tolerante, escritura que ignora el fallo si el
 * almacenamiento está lleno) y a partir de ahí se aplica en silencio.
 *
 * La ausencia de valor es «preguntar»: así los usuarios que ya existen no
 * heredan una decisión que no han tomado, y un `localStorage` corrupto degrada a
 * preguntar en vez de a perder series sin avisar.
 */

const SCOPE_KEY = 'gymlog-save-scope';

/** `all` guarda todas las series válidas; `completed-only` descarta las no marcadas. */
export type SaveScope = 'all' | 'completed-only';

/** Qué hacer al pulsar guardar: un alcance ya decidido, o preguntar. */
export type SaveDecision = SaveScope | 'ask';

function isScope(value: unknown): value is SaveScope {
  return value === 'all' || value === 'completed-only';
}

/** Preferencia guardada, o `null` si no hay ninguna (o es ilegible). */
export function readSaveScope(): SaveScope | null {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    return isScope(raw) ? raw : null;
  } catch {
    // Almacenamiento no disponible: se vuelve a preguntar, que es lo seguro.
    return null;
  }
}

export function writeSaveScope(scope: SaveScope): void {
  try {
    localStorage.setItem(SCOPE_KEY, scope);
  } catch {
    // localStorage lleno o no disponible: el prompt reaparecerá, sin más.
  }
}

/** Vuelve al estado inicial: la próxima vez se pregunta. */
export function clearSaveScope(): void {
  try {
    localStorage.removeItem(SCOPE_KEY);
  } catch {
    // Nada que hacer: la preferencia sigue donde estaba.
  }
}

/**
 * Decide el alcance del guardado.
 *
 * Sin ambigüedad —ninguna serie marcada, o todas marcadas— se guarda todo, que
 * es el comportamiento de siempre y no pierde nada. Solo se pregunta cuando
 * elegir «solo completadas» descartaría datos y no se sabe aún qué prefiere el
 * usuario.
 */
export function resolveSaveScope(input: {
  completedCount: number;
  pendingCount: number;
  stored: SaveScope | null;
}): SaveDecision {
  const { completedCount, pendingCount, stored } = input;
  if (completedCount <= 0 || pendingCount <= 0) return 'all';
  return stored ?? 'ask';
}
