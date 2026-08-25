/**
 * Acceso único a la forma de una serie registrada.
 *
 * Existe para preparar los ejercicios por tiempo (ver
 * `openspec/changes/add-logging-modes/`). Hoy `workout_sets.reps` es
 * `NOT NULL`, así que **todo lo de aquí es un no-op**: `isRepSet` devuelve
 * `true` para cualquier serie real y `onlyRepSets` no filtra nada. Cuando la
 * columna pase a admitir NULL —una plancha no tiene repeticiones—, los sitios
 * que ya pasen por aquí seguirán siendo correctos sin tocarlos.
 *
 * **Por qué un predicado de tipo y no un `reps ?? 0`.** Un cero es un dato: una
 * serie de cero repeticiones que entra en el recuento de series, en las medias y
 * en el volumen aportando cero. Eso no es «no aplica», es «hice cero», y la
 * diferencia se ve en cuanto alguien divide entre el número de series. Filtrar
 * con narrowing hace que el compilador exija tomar la decisión en cada sitio en
 * vez de dejar que un `?? 0` la tome por su cuenta.
 *
 * Los `?? 0` repartidos a ojo por 26 sitios son exactamente la forma en que se
 * cuela un fallo silencioso en las estadísticas.
 */

/**
 * Lo mínimo que necesita saberse de una serie para clasificarla.
 *
 * Estructural a propósito: vale igual para `WorkoutSetWithDetails`, para una
 * fila cruda de la BD o para el objeto de un importador, sin acoplar este módulo
 * a ninguno de los tres.
 */
export interface SetShape {
  reps?: number | null;
  duration_seconds?: number | null;
}

/**
 * ¿Es una serie de repeticiones?
 *
 * Estrecha el tipo, así que a partir de la llamada `reps` es `number` y no hace
 * falta ningún `!` ni ningún `?? 0`.
 *
 * **Una serie con repeticiones y duración cuenta como serie de repeticiones.**
 * Registrar cuánto se tardó en hacer 10 sentadillas no convierte la serie en una
 * plancha, y la regla al revés borraría de las estadísticas de fuerza cualquier
 * serie a la que se le hubiera puesto el cronómetro.
 */
export function isRepSet<T extends SetShape>(s: T): s is T & { reps: number } {
  return typeof s.reps === 'number' && Number.isFinite(s.reps) && s.reps > 0;
}

/**
 * ¿Es una serie por tiempo? Tiene duración y no tiene repeticiones.
 *
 * Hoy no puede devolver `true` para nada guardado: `duration_seconds` existe en
 * el esquema pero no la escribe nadie todavía.
 */
export function isTimedSet<T extends SetShape>(s: T): s is T & { duration_seconds: number } {
  return (
    !isRepSet(s) &&
    typeof s.duration_seconds === 'number' &&
    Number.isFinite(s.duration_seconds) &&
    s.duration_seconds > 0
  );
}

/**
 * Solo las series que aportan volumen de fuerza.
 *
 * Es el filtro que va antes de cualquier `peso × reps`, media o estimación de
 * 1RM. Lo que quede fuera no es cero: es que no se mide así.
 */
export function onlyRepSets<T extends SetShape>(sets: readonly T[]): (T & { reps: number })[] {
  return sets.filter(isRepSet);
}

/** Solo las series por tiempo, para lo que sí se mide en segundos. */
export function onlyTimedSets<T extends SetShape>(
  sets: readonly T[],
): (T & { duration_seconds: number })[] {
  return sets.filter(isTimedSet);
}

/** Repeticiones de la serie, o `null` si no se mide en repeticiones. Para pintar. */
export function repsOf(s: SetShape): number | null {
  return isRepSet(s) ? s.reps : null;
}

/** Duración en segundos, o `null` si no se mide en tiempo. Para pintar. */
export function durationOf(s: SetShape): number | null {
  return isTimedSet(s) ? s.duration_seconds : null;
}

/**
 * Una serie tiene que medir algo. Sin repeticiones y sin duración está rota, y
 * conviene detectarlo antes de guardar en vez de descubrirlo en una media.
 */
export function isMeasuredSet(s: SetShape): boolean {
  return isRepSet(s) || isTimedSet(s);
}

/* ------------------------------------------------------------- el plan ---- */

/** Cómo se registra un ejercicio. `cardio` lo cubre su propia feature. */
export type LoggingMode = 'reps' | 'time' | 'cardio';

/** Lo mínimo del ejercicio planificado para saber cómo se registra. */
export interface PlannedShape {
  mode?: string | null;
}

/**
 * Modo de un ejercicio del plan.
 *
 * **La ausencia se lee como `reps`**, y eso es lo que hace que ninguna rutina
 * guardada hasta hoy necesite migrarse. Es la regla de compatibilidad de todo el
 * cambio, así que vive en una sola función y con test propio: repartida por la
 * app, bastaría un sitio que tratase el `undefined` de otra forma para que una
 * rutina vieja se leyera mal.
 */
export function modeOfPlanned(cfg: PlannedShape | null | undefined): LoggingMode {
  const m = cfg?.mode;
  return m === 'time' || m === 'cardio' ? m : 'reps';
}
