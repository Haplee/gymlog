/**
 * Calculadora de discos: dado un peso objetivo y el peso de la barra, devuelve
 * qué discos cargar EN CADA LADO de la barra (reparto simétrico).
 */

export interface PlateStack {
  /** Peso del disco en kg. */
  weight: number;
  /** Número de discos de este peso por lado. */
  count: number;
}

export interface PlateResult {
  /** Discos a colocar por lado, de mayor a menor. */
  perSide: PlateStack[];
  /** Peso total realmente alcanzable con estos discos (barra + discos×2). */
  totalAchievable: number;
  /** Peso que sobra por lado y no se pudo cubrir con los discos disponibles. */
  leftoverPerSide: number;
}

/** Discos que se pueden encontrar en un gimnasio, de mayor a menor. */
export const COMMON_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 2, 1.5, 1.25, 1, 0.5, 0.25] as const;

/** Discos olímpicos estándar en kg, de mayor a menor. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/** Peso de barra olímpica estándar en kg. */
export const DEFAULT_BAR_KG = 20;

/** Los pesos vienen en kg con hasta 2 decimales: en centésimas son enteros. */
const CENTESIMAS = 100;

/**
 * Reparte el peso objetivo en discos por lado.
 *
 * Usa programación dinámica, no un algoritmo voraz. La diferencia importa en
 * cuanto el gimnasio tiene discos que no forman un sistema canónico —bastan un
 * 1,5 y un 1,25 conviviendo— porque entonces coger siempre el disco más grande
 * que quepa deja de ser óptimo. Caso real: 2,75 kg por lado. El voraz pone un
 * 2,5 y se queda a 0,25 de llegar; 1,5 + 1,25 lo clava.
 *
 * Criterio: primero acercarse lo máximo posible al objetivo **sin pasarse**, y
 * a igualdad de peso, usar el menor número de discos. Inventario ilimitado de
 * cada tipo.
 *
 * @param target    Peso total objetivo (barra incluida).
 * @param barWeight Peso de la barra (default 20 kg).
 * @param available Lista de pesos de disco disponibles (default olímpicos kg).
 */
export function calcularDiscos(
  target: number,
  barWeight: number = DEFAULT_BAR_KG,
  available: readonly number[] = DEFAULT_PLATES_KG,
): PlateResult {
  const empty: PlateResult = {
    perSide: [],
    totalAchievable: Number.isFinite(barWeight) ? barWeight : 0,
    leftoverPerSide: 0,
  };

  if (!Number.isFinite(target) || !Number.isFinite(barWeight)) return empty;
  if (target <= barWeight) return empty;

  // Todo el cálculo va en centésimas de kg: en coma flotante, 2.5 × 3 no da
  // exactamente 7.5 y el reparto se descuadra por errores de redondeo.
  const objetivo = Math.round(((target - barWeight) / 2) * CENTESIMAS);
  if (objetivo <= 0) return empty;

  const discos = [...new Set(available.filter((p) => Number.isFinite(p) && p > 0))]
    .map((p) => Math.round(p * CENTESIMAS))
    .sort((a, b) => b - a);
  if (discos.length === 0) {
    return { ...empty, leftoverPerSide: Math.round((objetivo / CENTESIMAS) * 100) / 100 };
  }

  // minDiscos[i] = mínimo nº de discos para sumar exactamente i centésimas.
  // usado[i] = disco con el que se alcanzó ese óptimo (para reconstruir).
  const minDiscos = new Array<number>(objetivo + 1).fill(Number.POSITIVE_INFINITY);
  const usado = new Array<number>(objetivo + 1).fill(0);
  minDiscos[0] = 0;

  for (let peso = 1; peso <= objetivo; peso++) {
    for (const disco of discos) {
      if (disco > peso) continue;
      const previo = minDiscos[peso - disco];
      if (previo + 1 < minDiscos[peso]) {
        minDiscos[peso] = previo + 1;
        usado[peso] = disco;
      }
    }
  }

  // El mayor peso alcanzable sin pasarse. Si no se puede clavar el objetivo,
  // se baja hasta el primer valor que sí se pueda montar.
  let alcanzado = objetivo;
  while (alcanzado > 0 && !Number.isFinite(minDiscos[alcanzado])) alcanzado--;

  const cuenta = new Map<number, number>();
  for (let resto = alcanzado; resto > 0; resto -= usado[resto]) {
    cuenta.set(usado[resto], (cuenta.get(usado[resto]) ?? 0) + 1);
  }

  const perSide: PlateStack[] = [...cuenta.entries()]
    .map(([peso, count]) => ({ weight: peso / CENTESIMAS, count }))
    .sort((a, b) => b.weight - a.weight);

  return {
    perSide,
    totalAchievable: Math.round((barWeight + (alcanzado / CENTESIMAS) * 2) * 100) / 100,
    leftoverPerSide: Math.round(((objetivo - alcanzado) / CENTESIMAS) * 100) / 100,
  };
}
