/**
 * Escalón de carga: cuánto se puede subir de verdad y cuánto conviene subir.
 *
 * El motor de progresión daba por hecho un escalón fijo de 2,5 kg. Eso hace dos
 * cosas mal a la vez:
 *
 *  - **Ignora el gimnasio.** Si el usuario ha declarado en Ajustes que su sala
 *    solo tiene discos de 5 kg, el escalón real es 10 kg, no 2,5: recomendar
 *    2,5 es recomendar un peso que no se puede montar. Y si tiene micro-discos
 *    de 0,5, obligarle a saltar 2,5 kg es tirar a la basura la progresión fina
 *    que sí tiene disponible.
 *  - **Ignora el tamaño de la carga.** 2,5 kg sobre una sentadilla de 120 kg es
 *    un +2 %; los mismos 2,5 kg sobre unas elevaciones laterales de 10 kg son un
 *    +25 %, un salto que nadie absorbe. Por eso el incremento se decide en
 *    términos relativos y solo después se traduce a hierro.
 *
 * Todo es aritmética pura: no lee stores ni toca la red.
 */

/** Escalón por defecto: un par de discos de 1,25 kg (juego olímpico estándar). */
export const DEFAULT_LOAD_STEP_KG = 2.5;

/**
 * Subida relativa máxima en una sola sesión.
 *
 * El «10 % semanal» viene del entrenamiento de resistencia y no es una ley
 * física, pero coincide con el umbral de riesgo del cociente agudo:crónico
 * (ACWR > 1,5 dispara la incidencia de lesión) y con la práctica habitual en
 * fuerza. Sirve de tope duro, no de objetivo.
 */
export const MAX_INCREASE_RATIO = 0.1;

/**
 * Subida relativa que se busca cuando toca progresar por carga.
 *
 * La literatura de autorregulación mueve la carga en torno a un 4 % por punto
 * de RPE de desviación. Un 2,5 % es la mitad de eso: el paso conservador de
 * quien ha cumplido el esquema y no tiene más información que esa.
 */
export const TARGET_INCREASE_RATIO = 0.025;

/** Ajuste de carga por cada punto de RIR/RPE de desviación sobre el objetivo. */
export const LOAD_RATIO_PER_RIR = 0.03;

/**
 * Escalón mínimo real con los discos disponibles.
 *
 * En barra el disco va por pares (uno a cada lado), así que el salto mínimo es
 * el doble del disco más pequeño. En mancuernas o máquinas de placas eso no
 * aplica y el escalón lo marca el propio material, por eso `paired` es
 * configurable.
 */
export function smallestLoadStep(
  availablePlatesKg?: readonly number[] | null,
  opts: { paired?: boolean } = {},
): number {
  const paired = opts.paired ?? true;
  const usable = (availablePlatesKg ?? []).filter((p) => Number.isFinite(p) && p > 0);
  if (usable.length === 0) return DEFAULT_LOAD_STEP_KG;
  const min = Math.min(...usable);
  return Math.round(min * (paired ? 2 : 1) * 100) / 100;
}

/** Redondea al múltiplo del escalón más cercano, con 2 decimales. */
export function roundToStep(weight: number, step: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(step) || step <= 0) return weight;
  return Math.round(Math.round(weight / step) * step * 100) / 100;
}

export interface NextLoadOptions {
  /** Subida relativa buscada (por defecto `TARGET_INCREASE_RATIO`). */
  ratio?: number;
  /** Escalón mínimo montable en kg. */
  stepKg?: number;
  /** Tope relativo duro (por defecto `MAX_INCREASE_RATIO`). */
  maxRatio?: number;
}

/**
 * Siguiente carga montable por encima de `base`, o `null` si no cabe ninguna.
 *
 * Devolver `null` **no es un fallo**: significa que ni el salto más pequeño que
 * el gimnasio permite entra por debajo del tope relativo, y entonces la única
 * progresión honesta es sumar repeticiones. Es la diferencia entre «no sé» y
 * «sé que por carga no toca».
 */
export function nextAchievableLoad(base: number, opts: NextLoadOptions = {}): number | null {
  const step = opts.stepKg && opts.stepKg > 0 ? opts.stepKg : DEFAULT_LOAD_STEP_KG;
  const ratio = opts.ratio ?? TARGET_INCREASE_RATIO;
  const maxRatio = opts.maxRatio ?? MAX_INCREASE_RATIO;
  if (!Number.isFinite(base) || base <= 0) return null;

  const cap = base * (1 + maxRatio);
  // Se sube al primer múltiplo del escalón que supere de verdad la base: el
  // redondeo al escalón puede devolver la misma carga y dejar la subida en nada.
  const wanted = base * (1 + ratio);
  let target = roundToStep(wanted, step);
  if (target <= base) target = roundToStep(base + step, step);
  if (target <= base) return null;

  // Si el salto pedido se pasa del tope, se prueba el escalón mínimo antes de
  // rendirse: en cargas medias el 2,5 % puede caer entre dos discos.
  if (target > cap) {
    const minimal = roundToStep(base + step, step);
    if (minimal > base && minimal <= cap) return minimal;
    return null;
  }
  return target;
}

/**
 * Carga reducida tras un fallo o un estancamiento, redondeada a algo montable.
 *
 * Nunca devuelve menos de un escalón: una carga de 0 kg no es una descarga, es
 * un dato roto.
 */
export function backOffLoad(base: number, ratio: number, stepKg: number): number {
  const step = stepKg > 0 ? stepKg : DEFAULT_LOAD_STEP_KG;
  const reduced = roundToStep(base * (1 - ratio), step);
  return Math.max(step, reduced);
}
