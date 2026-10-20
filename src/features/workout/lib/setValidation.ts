// Validación de las series antes de guardar. Vivía dentro de WorkoutPage; se
// extrajo para poder probarla sin montar la pantalla entera.
import { z } from 'zod';

/**
 * Una serie tiene que medir algo: repeticiones o segundos.
 *
 * Antes solo contemplaba repeticiones, así que una plancha de 48 s con 0 kg no
 * llegaba siquiera a validarse: se descartaba como fila en blanco y el guardado
 * respondía «añade al menos una serie válida» sobre una serie que estaba bien.
 *
 * Es la misma regla que el `CHECK workout_sets_measured` de la base de datos,
 * puesta aquí para que el usuario vea un mensaje entendible en vez de un error
 * de Postgres. Los `message` son claves de i18n, no frases: el schema vive a
 * nivel de módulo y no alcanza a `t`, así que traduce quien los pinta.
 */
export const setSchema = z
  .object({
    reps: z.string().optional().default(''),
    durationSeconds: z.string().optional().default(''),
    weight: z.coerce.number().nonnegative('workout.errors.weight_negative'),
  })
  .refine((s) => Number(s.reps) > 0 || Number(s.durationSeconds) > 0, {
    message: 'workout.errors.needs_measure',
  });

/** Lo mínimo que necesita saberse de una fila para validarla. */
export interface ValidatableSet {
  reps?: string;
  weight?: string;
  durationSeconds?: string;
  completed?: boolean;
}

/** ¿La fila tiene algo escrito? Una en blanco se salta, no se marca en rojo. */
export function isBlankSetRow(s: ValidatableSet): boolean {
  const vacio = (v?: string) => v === '' || v === '0' || v === undefined;
  return vacio(s.reps) && vacio(s.weight) && vacio(s.durationSeconds);
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

/**
 * Valida las filas que se van a guardar.
 *
 * Con `onlyCompleted` se ignoran las no marcadas. Las filas en blanco se
 * saltan (no cuentan como error ni como válidas). Devuelve el mapa
 * índice → clave de i18n y si al menos una fila es válida.
 */
export function validateSetsForSave(
  sets: readonly ValidatableSet[],
  onlyCompleted: boolean,
): { errors: Record<number, string>; hasValid: boolean } {
  const errors: Record<number, string> = {};
  let hasValid = false;

  sets.forEach((s, i) => {
    if (onlyCompleted && !s.completed) return;
    if (isBlankSetRow(s)) return;
    const validation = setSchema.safeParse(s);
    if (!validation.success) {
      errors[i] = validation.error.errors[0]?.message || 'workout.errors.invalid_set';
    } else {
      hasValid = true;
    }
  });

  return { errors, hasValid };
}
