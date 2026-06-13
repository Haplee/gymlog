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

/** Discos olímpicos estándar en kg, de mayor a menor. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/** Peso de barra olímpica estándar en kg. */
export const DEFAULT_BAR_KG = 20;

/**
 * Reparte el peso objetivo en discos por lado mediante un algoritmo voraz.
 * Asume inventario ilimitado de cada disco disponible.
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

  let perSideRemaining = (target - barWeight) / 2;
  const plates = [...available].filter((p) => p > 0).sort((a, b) => b - a);
  const perSide: PlateStack[] = [];

  for (const plate of plates) {
    // Pequeña tolerancia para errores de coma flotante (p. ej. 2.5 × 3).
    const count = Math.floor((perSideRemaining + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ weight: plate, count });
      perSideRemaining -= plate * count;
    }
  }

  const placedPerSide = perSide.reduce((sum, p) => sum + p.weight * p.count, 0);

  return {
    perSide,
    totalAchievable: barWeight + placedPerSide * 2,
    leftoverPerSide: Math.round(perSideRemaining * 100) / 100,
  };
}
