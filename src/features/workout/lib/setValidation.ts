// Validación de las series antes de guardar.
//
// Es la **única** fuente de verdad: la usan la pantalla de entreno, el store y
// los tests. Antes había tres copias (un schema zod en la pantalla, otro en el
// store y otro inline en la sesión de rutina) y no coincidían: la pantalla
// aceptaba una serie de repeticiones sin peso y el store la descartaba en
// silencio, así que el guardado respondía «añade al menos una serie válida»
// sobre una serie que el usuario acababa de escribir. Esa es la avería que se
// veía en la APK al guardar gemelos de pie sin lastre.
//
// Las reglas replican el contrato del RPC `save_workout_with_sets` y del
// `CHECK workout_sets_measured` de la base de datos:
//
//   * Una serie tiene que medir algo: repeticiones o segundos.
//   * Las repeticiones son enteras (`^\d+$`) y mayores que 0; la RPC descarta
//     en silencio cualquier otra cosa, así que aquí se avisa antes de enviar.
//   * El peso vacío significa 0 (serie sin lastre), no «inválida». Un peso
//     negativo o no numérico sí es un error.
//
// Los `message` son claves de i18n, no frases: este módulo no alcanza a `t`.

/** Lo mínimo que necesita saberse de una fila para validarla. */
export interface ValidatableSet {
  reps?: string;
  weight?: string;
  durationSeconds?: string;
  completed?: boolean;
  /** La abrió la app al cerrar la serie anterior; necesita el ✓ para contar. */
  autofilled?: boolean;
}

/** Serie ya validada, lista para construir el payload. */
export interface SelectedSet {
  /** Índice en el array original: es lo que la pantalla usa para marcar la fila. */
  index: number;
  reps: number | null;
  durationSeconds: number | null;
  /** Peso escrito por el usuario, en la unidad del formulario (kg en el store). */
  weightKg: number;
}

export interface SetSelection {
  selected: SelectedSet[];
  /** Índice de fila → clave de i18n. */
  errors: Record<number, string>;
  hasValid: boolean;
}

export const MAX_REPS = 9999;
export const MAX_DURATION_SECONDS = 3600;

/**
 * Repeticiones válidas de la serie, o `null` si no se mide en repeticiones.
 *
 * Solo enteros. La RPC filtra con `^\d+$` y descarta en silencio la serie que no
 * encaje —incluida una con `10.5`, que `Number()` aceptaba—, así que validarlo
 * aquí es la diferencia entre «no se guardó» y «se guardó un entreno al que le
 * falta una serie».
 */
export function parseReps(reps?: string): number | null {
  const texto = (reps ?? '').trim();
  if (!/^\d+$/.test(texto)) return null;
  const n = Number(texto);
  return n > 0 && n <= MAX_REPS ? n : null;
}

/** Segundos válidos de la serie, o `null` si no se mide en tiempo. */
export function parseDurationSeconds(durationSeconds?: string): number | null {
  const texto = (durationSeconds ?? '').trim();
  if (!/^\d+$/.test(texto)) return null;
  const n = Number(texto);
  return n > 0 && n <= MAX_DURATION_SECONDS ? n : null;
}

/**
 * Peso en kg, o `null` si no es un número finito no negativo.
 *
 * Vacío es 0: una serie sin lastre (peso corporal, dominadas, gemelos a una
 * pierna) es una serie completa, no una fila a medias.
 */
export function parseSetWeight(weight?: string): number | null {
  const texto = (weight ?? '').trim();
  if (texto === '') return 0;
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** ¿La fila tiene algo escrito? Una en blanco se salta, no se marca en rojo. */
export function isBlankSetRow(s: ValidatableSet): boolean {
  const vacio = (v?: string) => v === '' || v === '0' || v === undefined;
  return vacio(s.reps) && vacio(s.weight) && vacio(s.durationSeconds);
}

/**
 * ¿El usuario estaba usando esta fila?
 *
 * Una fila en blanco no. Una heredada por la app (`autofilled`) tampoco hasta
 * que la marca con el ✓. El resto sí, aunque no tenga peso: escribir las
 * repeticiones ya es decir «esto lo he hecho».
 */
export function isSetRowIntended(s: ValidatableSet): boolean {
  if (isBlankSetRow(s)) return false;
  return !(s.autofilled && !s.completed);
}

/**
 * Valida y selecciona las filas que se van a guardar.
 *
 * No descarta nada en silencio: una fila con datos pero mal formada vuelve en
 * `errors` para que la pantalla la abra y explique qué corregir. Las filas en
 * blanco y las heredadas sin confirmar se saltan sin error.
 */
export function selectSetsForSave(
  sets: readonly ValidatableSet[],
  opts: { onlyCompleted?: boolean } = {},
): SetSelection {
  const selected: SelectedSet[] = [];
  const errors: Record<number, string> = {};

  sets.forEach((s, i) => {
    if (opts.onlyCompleted && !s.completed) return;
    if (!isSetRowIntended(s)) return;

    const repsText = (s.reps ?? '').trim();
    const durationText = (s.durationSeconds ?? '').trim();

    const weightKg = parseSetWeight(s.weight);
    if (weightKg == null) {
      errors[i] = (s.weight ?? '').trim().startsWith('-')
        ? 'workout.errors.weight_negative'
        : 'workout.errors.weight_invalid';
      return;
    }

    const reps = parseReps(repsText);
    const durationSeconds = parseDurationSeconds(durationText);
    if (reps == null && durationSeconds == null) {
      // Se distingue el motivo: «escribe 10.5» y «escribe 9000 segundos» no
      // son el mismo problema y el mensaje genérico no ayuda a corregirlo.
      if (repsText !== '') errors[i] = 'workout.errors.reps_invalid';
      else if (durationText !== '') errors[i] = 'workout.errors.duration_invalid';
      else errors[i] = 'workout.errors.needs_measure';
      return;
    }

    selected.push({ index: i, reps, durationSeconds, weightKg });
  });

  return { selected, errors, hasValid: selected.length > 0 };
}

/**
 * Compatibilidad con quien solo necesita saber qué filas fallan.
 * `hasValid` mira las filas seleccionadas, no solo la ausencia de errores.
 */
export function validateSetsForSave(
  sets: readonly ValidatableSet[],
  onlyCompleted: boolean,
): { errors: Record<number, string>; hasValid: boolean } {
  const { errors, hasValid } = selectSetsForSave(sets, { onlyCompleted });
  return { errors, hasValid };
}

/**
 * Peso a partir del cual una serie pide confirmación.
 *
 * No es un límite de la app ni un dato del ejercicio: es un techo de
 * verosimilitud. Por encima de 400 kg en una sola serie, un número es más
 * probable que sea un dedo de más que un dato real. Visto en la APK: un «480»
 * donde iban 48 kg se guardó sin decir nada y dejó un entreno de 3,8 t que
 * ensucia a la vez el récord y la progresión.
 *
 * No bloquea —hay prensas, jalones y encogimientos por encima de eso—, así que
 * solo pide un segundo toque en el ✓: barato para quien de verdad levanta ese
 * peso, y suficiente para quien se equivocó al teclear.
 */
export const MAX_PLAUSIBLE_SET_WEIGHT_KG = 400;

/** ¿El peso de la serie es inverosímil? En kilos, como se guarda. */
export function isImplausibleSetWeight(weightKg: number): boolean {
  return Number.isFinite(weightKg) && weightKg > MAX_PLAUSIBLE_SET_WEIGHT_KG;
}
