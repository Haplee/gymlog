/**
 * Reparto ponderado del volumen de una serie entre los músculos de un ejercicio.
 *
 * Cada músculo tiene un peso (0–100). El reparto normaliza por la suma de pesos,
 * de modo que el usuario no está obligado a que sumen 100 exactos. Si un ejercicio
 * tiene un único músculo (primario 100%), todo el volumen va a ese músculo, igual
 * que el comportamiento previo.
 */

export interface WeightedMuscle {
  muscle_group: string;
  weight: number;
}

/**
 * Dado un volumen y los músculos ponderados, devuelve el volumen atribuido a cada
 * grupo muscular. Pesos ≤ 0 o lista vacía → se trata como reparto degenerado
 * (todo al primer músculo, o mapa vacío si no hay músculos).
 */
export function distributeVolume(
  volume: number,
  muscles: WeightedMuscle[],
): Record<string, number> {
  if (muscles.length === 0) return {};
  const total = muscles.reduce((sum, m) => sum + Math.max(0, m.weight), 0);
  const result: Record<string, number> = {};

  if (total <= 0) {
    // Sin pesos válidos: todo al primero para no perder el volumen.
    result[muscles[0].muscle_group] = (result[muscles[0].muscle_group] ?? 0) + volume;
    return result;
  }

  for (const m of muscles) {
    const share = (Math.max(0, m.weight) / total) * volume;
    if (share === 0) continue;
    result[m.muscle_group] = (result[m.muscle_group] ?? 0) + share;
  }
  return result;
}
